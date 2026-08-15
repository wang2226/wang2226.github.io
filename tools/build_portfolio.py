#!/usr/bin/env python3
"""Regenerates photography/portfolio.html from tools/gallery.json.

Reads the photo list, downscales web copies into images/web/ with sips, pulls
EXIF out of the originals, and writes the gallery markup. Run it after adding
entries to gallery.json:

    python3 tools/build_portfolio.py

Originals in images/ are never modified; the viewer opens them full size.
GPS tags are deliberately ignored — the captions already say where a photo was
taken, and publishing exact coordinates is more than that needs.
"""

import json
import os
import re
import subprocess
import sys

from PIL import ExifTags, Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GALLERY = os.path.join(ROOT, "tools", "gallery.json")
IMAGES = os.path.join(ROOT, "images")
WEB = os.path.join(IMAGES, "web")
OUT = os.path.join(ROOT, "photography", "portfolio.html")

QUALITY = "65"

# Grid thumbnails never render wider than ~440 CSS px, so 1200 covers retina.
# The hero is full-bleed and the about photos sit in a half-width column.
GRID_EDGE = 1200
ABOUT_EDGE = 1400
HERO_EDGE = 2000

HERO = "23.jpg"
ABOUT = ["0_4.jpg", "19.jpg", "1.jpg", "0_3.jpg"]

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def escape(text):
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def shutter(seconds):
    """EXIF stores exposure in seconds; photographers read fractions."""
    if seconds >= 1:
        return ("%.1f" % seconds).rstrip("0").rstrip(".") + "s"
    return "1/%d" % round(1 / seconds)


def lens_name(raw):
    """Canon writes "EF24-70mm f/2.8L USM"; add the space and the en dash."""
    name = re.sub(r"^(EF-?S?|RF|TS-E)(\d)", r"\1 \2", raw.strip())
    return name.replace("-", "–", 1) if re.search(r"\d-\d", name) else name


def exif(name):
    """Returns the fields the viewer shows, skipping anything absent."""
    try:
        raw = Image.open(os.path.join(IMAGES, name))._getexif() or {}
    except Exception:
        return {}

    tags = {}
    for tag, value in raw.items():
        label = ExifTags.TAGS.get(tag)
        if label:
            tags[label] = value

    out = {}

    if tags.get("Model"):
        out["camera"] = str(tags["Model"]).strip()
    if tags.get("LensModel"):
        out["lens"] = lens_name(str(tags["LensModel"]))

    stamp = tags.get("DateTimeOriginal") or tags.get("DateTime")
    if stamp:
        match = re.match(r"(\d{4}):(\d{2}):(\d{2})", str(stamp))
        if match:
            year, month, day = (int(part) for part in match.groups())
            if 1 <= month <= 12:
                out["date"] = "%s %d, %d" % (MONTHS[month - 1], day, year)

    settings = []
    if tags.get("FocalLength"):
        settings.append("%dmm" % round(float(tags["FocalLength"])))
    if tags.get("FNumber"):
        aperture = float(tags["FNumber"])
        settings.append("f/" + ("%.1f" % aperture).rstrip("0").rstrip("."))
    if tags.get("ExposureTime"):
        settings.append(shutter(float(tags["ExposureTime"])))
    iso = tags.get("ISOSpeedRatings") or tags.get("PhotographicSensitivity")
    if iso:
        settings.append("ISO %s" % iso)
    if settings:
        out["settings"] = " · ".join(settings)

    return out


def resize(plan):
    """Writes downscaled copies into images/web/ and returns their dimensions.

    `plan` maps a filename to the longest edge it should be capped at.
    """
    if not os.path.isdir(WEB):
        os.makedirs(WEB)

    sizes = {}
    for name, max_edge in sorted(plan.items()):
        source = os.path.join(IMAGES, name)
        target = os.path.join(WEB, name)
        if not os.path.exists(source):
            sys.exit("missing source image: %s" % source)

        stale = (
            not os.path.exists(target)
            or os.path.getmtime(target) < os.path.getmtime(source)
        )
        if stale:
            subprocess.check_call(
                [
                    "sips",
                    "-s", "format", "jpeg",
                    "-s", "formatOptions", QUALITY,
                    "-Z", str(max_edge),
                    source,
                    "--out", target,
                ],
                stdout=subprocess.PIPE,
            )

        probe = subprocess.check_output(
            ["sips", "-g", "pixelWidth", "-g", "pixelHeight", target],
            universal_newlines=True,
        )
        sizes[name] = (
            int(re.search(r"pixelWidth: (\d+)", probe).group(1)),
            int(re.search(r"pixelHeight: (\d+)", probe).group(1)),
        )
    return sizes


def figure(photo, sizes, index):
    name = photo["file"]
    location = photo["location"]
    width, height = sizes[name]
    meta = exif(name)

    data = ['data-location="%s"' % escape(location)]
    for key in ("date", "camera", "lens", "settings"):
        if meta.get(key):
            data.append('data-%s="%s"' % (key, escape(meta[key])))

    # The first rows are above the fold on most screens, so load them eagerly.
    loading = "" if index < 3 else '\n              loading="lazy"'

    return """        <figure>
          <a
            class="photo-card"
            href="../images/{name}"
            {data}
          >
            <img
              src="../images/web/{name}"
              width="{width}"
              height="{height}"
              alt="Photograph from {alt}"{loading}
              decoding="async"
            />
            <figcaption class="photo-card__caption">{location}</figcaption>
          </a>
        </figure>""".format(
        name=name,
        data="\n            ".join(data),
        width=width,
        height=height,
        alt=escape(location),
        location=escape(location),
        loading=loading,
    )


HEAD = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Photography — Road Trips, National Parks and Long Light</title>
    <meta
      name="description"
      content="Landscape and road trip photography by Bruce Wang, from national parks, coastlines, and mountain towns across the United States and beyond."
    />
    <link rel="icon" href="../images/0_2.ico" type="image/x-icon" sizes="16x16" />

    <!-- SEO -->
    <link rel="canonical" href="https://brucehrwang.com/photography/portfolio.html" />
    <meta name="author" content="Bruce Wang" />
    <meta name="robots" content="index, follow, max-image-preview:large" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Happiness By The Mile" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="https://brucehrwang.com/photography/portfolio.html" />
    <meta property="og:title" content="Photography — Road Trips, National Parks and Long Light" />
    <meta
      property="og:description"
      content="Landscape and road trip photography by Bruce Wang, from national parks, coastlines, and mountain towns across the United States and beyond."
    />
    <meta property="og:image" content="https://brucehrwang.com/images/web/23.jpg" />
    <meta property="og:image:width" content="2000" />
    <meta property="og:image:height" content="1333" />
    <meta property="og:image:alt" content="A bench above the Oregon coast in morning fog" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Photography — Road Trips, National Parks and Long Light" />
    <meta
      name="twitter:description"
      content="Landscape and road trip photography by Bruce Wang, from national parks, coastlines, and mountain towns across the United States and beyond."
    />
    <meta name="twitter:image" content="https://brucehrwang.com/images/web/23.jpg" />
    <meta name="twitter:image:alt" content="A bench above the Oregon coast in morning fog" />

<!--JSONLD-->
    <!-- /SEO -->

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../assets/site.css" />
    <script src="../assets/theme.js"></script>

    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-LCVSV9GF0S"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());
      gtag("config", "G-LCVSV9GF0S");
    </script>
  </head>

  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="./portfolio.html">Happiness By The Mile</a>
        <div class="site-header__actions">
          <nav class="site-nav" aria-label="Main">
            <a href="../blogs/blogs.html">Adventures</a>
            <a href="./portfolio.html" aria-current="page">Photography</a>
            <a
              href="https://www.youtube.com/channel/UCt2tHvQZmlkzd6xI_DGpMCQ"
              target="_blank"
              rel="noopener"
              >YouTube</a
            >
            <a class="nav-home" href="../index.html" aria-label="Home">cd ~</a>
          </nav>
          <button class="palette-open" type="button" aria-label="Search the site">
            <span aria-hidden="true">Search</span>
            <kbd aria-hidden="true">⌘K</kbd>
          </button>
          <button
            class="theme-toggle"
            type="button"
            aria-label="Switch to dark mode"
          >
            <svg class="theme-toggle__moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
            <svg class="theme-toggle__sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" />
              <path
                d="M12 2.6v2.2M12 19.2v2.2M4.6 12H2.4M21.6 12h-2.2M6.8 6.8 5.2 5.2M18.8 18.8l-1.6-1.6M17.2 6.8l1.6-1.6M5.2 18.8l1.6-1.6"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main>
      <section class="photo-hero" id="home">
        <img
          src="../images/web/23.jpg"
          alt="A weathered wooden bench on a wildflower bluff above the surf on the Oregon coast"
          fetchpriority="high"
          decoding="async"
        />
        <div>
          <h1 class="photo-hero__title">Happiness<br />By The Mile</h1>
          <p class="photo-hero__subtitle">Road trips, national parks, and long light</p>
        </div>
      </section>

      <section class="section" id="about">
        <div class="wrap">
          <div class="about-grid">
            <div>
              <h2 class="section__heading">Road Trip is Fun</h2>
              <p class="section__intro">
                I try to make time for a road trip every year, usually in the
                summer. I love driving across states and watching the landscape,
                the weather, and the culture shift as I go. The ultimate goal is
                to drive all 50 states. So far my favorite routes are U.S. 101
                from northern California into central Oregon, U.S. 1 from Miami
                down to Key West, the Beartooth Highway in Montana and Wyoming,
                the Old McKenzie Highway in Oregon, and Rim Drive at Crater
                Lake. I have also visited 21 national parks, with Yellowstone,
                Glacier, and Crater Lake at the top of the list.
              </p>
              <p class="stat">
                <span class="stat__number">32</span>
                <span class="stat__label">states visited</span>
              </p>
            </div>
            <div class="about-grid__media">
              <img
                src="../images/web/0_4.jpg"
                alt="A map of the United States with the road trip routes I have driven traced in blue"
                loading="lazy"
                decoding="async"
              />
              <img
                src="../images/web/19.jpg"
                alt="El Capitan and Half Dome seen from Tunnel View in Yosemite Valley"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <div class="about-grid about-grid--reversed">
            <div>
              <h2 class="section__heading">Nick, My Forever Best Four-Legged Friend</h2>
              <p class="section__intro">
                This is Nick, a Doberman with the intelligence of a Border
                Collie, the agility of a German Shepherd, and the heart of a
                Labrador. He stayed by my side through one of the hardest
                stretches of my life and helped me find the strength to get back
                on my feet. Nick passed away on August 17th, 2019, after a
                battle with cancer.
              </p>
            </div>
            <div class="about-grid__media about-grid__media--pair">
              <img
                src="../images/web/1.jpg"
                alt="Nick, a black and tan Doberman, lying on the grass and looking toward the camera"
                loading="lazy"
                decoding="async"
              />
              <img
                src="../images/web/0_3.jpg"
                alt="Nick, a black and tan Doberman, sitting on the grass facing the camera"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="work">
        <div class="wrap">
          <div class="section--centered">
            <h2 class="section__heading">Photography Portfolio</h2>
            <p class="section__intro">
              Shot on a Canon EOS 5D Mark II with a Canon EF 24–70mm f/2.8L II
              USM and a Canon EF 70–200mm f/2.8L IS II USM. Click any frame for
              the full-size photo and its settings.
            </p>
          </div>
          <div class="gallery-grid">
"""

TAIL = """          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="site-footer__inner">
        <p>&copy; <span id="year">2026</span> @brucehrwang</p>
        <nav class="site-footer__links" aria-label="Footer">
          <a href="../blogs/blogs.html">Adventures</a>
          <a
            href="https://www.youtube.com/channel/UCt2tHvQZmlkzd6xI_DGpMCQ"
            target="_blank"
            rel="noopener"
            >YouTube</a
          >
          <a class="nav-home" href="../index.html" aria-label="Home">cd ~</a>
        </nav>
      </div>
    </footer>

    <dialog class="viewer" aria-label="Photo viewer">
      <div class="viewer__stage">
        <figure class="viewer__figure">
          <img alt="" />
        </figure>
        <div class="viewer__bar">
          <p class="viewer__caption"></p>
          <dl class="viewer__exif" hidden>
            <div><dt>Date</dt><dd data-field="date">—</dd></div>
            <div><dt>Camera</dt><dd data-field="camera">—</dd></div>
            <div><dt>Lens</dt><dd data-field="lens">—</dd></div>
            <div><dt>Settings</dt><dd data-field="settings">—</dd></div>
          </dl>
        </div>
      </div>
      <div class="viewer__controls">
        <button class="viewer__button" type="button" data-action="exif" aria-pressed="false">
          <span aria-hidden="true">i</span>
          <span class="sr-only">Toggle photo details</span>
        </button>
        <button class="viewer__button" type="button" data-action="fullscreen">
          <span aria-hidden="true">⛶</span>
          <span class="sr-only">Toggle fullscreen</span>
        </button>
        <button class="viewer__button" type="button" data-action="close">
          <span aria-hidden="true">✕</span>
          <span class="sr-only">Close viewer</span>
        </button>
      </div>
      <button class="viewer__nav viewer__nav--prev" type="button" aria-label="Previous photo">
        <span aria-hidden="true">←</span>
      </button>
      <button class="viewer__nav viewer__nav--next" type="button" aria-label="Next photo">
        <span aria-hidden="true">→</span>
      </button>
      <p class="viewer__hint">
        <kbd>←</kbd><kbd>→</kbd> browse · <kbd>i</kbd> details ·
        <kbd>f</kbd> fullscreen · <kbd>Esc</kbd> close
      </p>
    </dialog>

    <script src="../assets/lightbox.js"></script>
    <script src="../assets/search-index.js"></script>
    <script src="../assets/palette.js"></script>
    <script>
      document.getElementById("year").textContent = new Date().getFullYear();
    </script>
  </body>
</html>
"""


def jsonld(photos):
    """CollectionPage + ImageGallery so image search can attach photos to this URL."""
    image_objects = []
    for photo in photos:
        location = photo["location"]
        image_objects.append(
            {
                "@type": "ImageObject",
                "contentUrl": "https://brucehrwang.com/images/web/" + photo["file"],
                "url": "https://brucehrwang.com/photography/portfolio.html",
                "name": location,
                "caption": location,
                "creditText": "Bruce Wang",
                "creator": {
                    "@type": "Person",
                    "@id": "https://brucehrwang.com/#bruce",
                    "name": "Bruce Wang",
                },
                "contentLocation": {"@type": "Place", "name": location},
            }
        )

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "CollectionPage",
                "@id": "https://brucehrwang.com/photography/portfolio.html#page",
                "url": "https://brucehrwang.com/photography/portfolio.html",
                "name": "Photography — Road Trips, National Parks and Long Light",
                "description": (
                    "Landscape and road trip photography by Bruce Wang, from "
                    "national parks, coastlines, and mountain towns across the "
                    "United States and beyond."
                ),
                "inLanguage": "en",
                "isPartOf": {"@id": "https://brucehrwang.com/#website"},
                "author": {"@id": "https://brucehrwang.com/#bruce"},
                "mainEntity": {
                    "@id": "https://brucehrwang.com/photography/portfolio.html#gallery"
                },
            },
            {
                "@type": "ImageGallery",
                "@id": "https://brucehrwang.com/photography/portfolio.html#gallery",
                "name": "Happiness By The Mile",
                "about": "Road trip and landscape photography",
                "image": image_objects,
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://brucehrwang.com/",
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Photography",
                        "item": "https://brucehrwang.com/photography/portfolio.html",
                    },
                ],
            },
        ],
    }
    return (
        '    <script type="application/ld+json">\n'
        + json.dumps(graph, indent=2, ensure_ascii=False)
        + "\n    </script>"
    )


def main():
    photos = json.load(open(GALLERY))

    plan = {photo["file"]: GRID_EDGE for photo in photos}
    plan.update({name: ABOUT_EDGE for name in ABOUT})
    plan[HERO] = HERO_EDGE
    sizes = resize(plan)

    figures = [figure(photo, sizes, i) for i, photo in enumerate(photos)]
    head = HEAD.replace("<!--JSONLD-->", jsonld(photos))
    open(OUT, "w").write(head + "\n".join(figures) + "\n" + TAIL)

    with_exif = sum(1 for photo in photos if exif(photo["file"]).get("settings"))
    print("photos: %d (%d with EXIF settings)" % (len(photos), with_exif))


if __name__ == "__main__":
    main()
