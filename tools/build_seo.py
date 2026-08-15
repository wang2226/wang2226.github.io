#!/usr/bin/env python3
"""Writes robots.txt, sitemap.xml, and feed.xml from the live pages.

Crawls the HTML that actually ships, so the sitemap cannot drift away from
the site. Run after adding or renaming a page:

    python3 tools/build_seo.py
"""

import glob
import html as htmlmod
import json
import os
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "https://brucehrwang.com"
GALLERY = os.path.join(ROOT, "tools", "gallery.json")

PAGES = [
    {
        "path": "index.html",
        "loc": HOST + "/",
        "priority": "1.00",
    },
    {
        "path": "blogs/blogs.html",
        "loc": HOST + "/blogs/blogs.html",
        "priority": "0.90",
    },
    {
        "path": "photography/portfolio.html",
        "loc": HOST + "/photography/portfolio.html",
        "priority": "0.90",
    },
]


def attr(html, name, prop=False):
    key = "property" if prop else "name"
    match = re.search(
        r'<meta\s+%s="%s"\s+content="([^"]*)"' % (key, re.escape(name)),
        html,
        re.I,
    )
    if match:
        return match.group(1)
    match = re.search(
        r'<meta\s+content="([^"]*)"\s+%s="%s"' % (key, re.escape(name)),
        html,
        re.I,
    )
    return match.group(1) if match else None


def lastmod(path, html):
    published = attr(html, "article:modified_time", prop=True) or attr(
        html, "article:published_time", prop=True
    )
    if published:
        if "T" not in published:
            published = published + "T00:00:00+00:00"
        return published[:10]
    stamp = os.path.getmtime(path)
    return datetime.fromtimestamp(stamp, timezone.utc).strftime("%Y-%m-%d")


def posts():
    entries = []
    for path in sorted(glob.glob(os.path.join(ROOT, "blogs", "*.html"))):
        name = os.path.basename(path)
        if name == "blogs.html":
            continue
        html = open(path).read()
        canonical = re.search(r'rel="canonical" href="([^"]+)"', html)
        title = attr(html, "og:title", prop=True) or re.search(
            r"<title>([^<]+)</title>", html
        ).group(1)
        entries.append(
            {
                "file": path,
                "html": html,
                "loc": canonical.group(1) if canonical else HOST + "/blogs/" + name,
                "title": title,
                "description": attr(html, "description")
                or attr(html, "og:description", prop=True)
                or "",
                "image": attr(html, "og:image", prop=True),
                "image_alt": attr(html, "og:image:alt", prop=True) or title,
                "published": attr(html, "article:published_time", prop=True),
                "modified": lastmod(path, html),
                "priority": "0.70",
            }
        )
    entries.sort(key=lambda item: item["published"] or "", reverse=True)
    return entries


def write_robots():
    text = """User-agent: *
Allow: /

# Build scripts and source lists are not pages.
Disallow: /tools/

Sitemap: %s/sitemap.xml
""" % HOST
    dest = os.path.join(ROOT, "robots.txt")
    open(dest, "w").write(text)
    print("wrote robots.txt")


def xml_text(value):
    return escape(htmlmod.unescape(value or ""))


def image_tag(loc, title, caption=None):
    parts = [
        "    <image:image>",
        "      <image:loc>%s</image:loc>" % escape(loc),
    ]
    if title:
        parts.append("      <image:title>%s</image:title>" % xml_text(title))
    if caption:
        parts.append("      <image:caption>%s</image:caption>" % xml_text(caption))
    parts.append("    </image:image>")
    return "\n".join(parts)


def write_sitemap(blog_posts):
    urls = []

    for page in PAGES:
        path = os.path.join(ROOT, page["path"])
        html = open(path).read()
        block = [
            "  <url>",
            "    <loc>%s</loc>" % escape(page["loc"]),
            "    <lastmod>%s</lastmod>" % lastmod(path, html),
            "    <priority>%s</priority>" % page["priority"],
        ]
        if page["path"] == "photography/portfolio.html":
            for photo in json.load(open(GALLERY)):
                block.append(
                    image_tag(
                        HOST + "/images/web/" + photo["file"],
                        photo["location"],
                        "Photograph from " + photo["location"],
                    )
                )
        elif page["path"] == "index.html":
            block.append(
                image_tag(
                    HOST + "/images/web/8.jpg",
                    "Sunrise over a mountain lake",
                )
            )
        urls.append("\n".join(block) + "\n  </url>")

    for post in blog_posts:
        block = [
            "  <url>",
            "    <loc>%s</loc>" % escape(post["loc"]),
            "    <lastmod>%s</lastmod>" % post["modified"],
            "    <priority>%s</priority>" % post["priority"],
        ]
        if post["image"]:
            block.append(image_tag(post["image"], post["image_alt"], post["title"]))
        urls.append("\n".join(block) + "\n  </url>")

    dest = os.path.join(ROOT, "sitemap.xml")
    open(dest, "w").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
        "<!-- Generated by tools/build_seo.py. Do not edit by hand. -->\n\n"
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    print("wrote sitemap.xml (%d URLs)" % len(urls))


def write_feed(blog_posts):
    now = format_datetime(datetime.now(timezone.utc))
    items = []
    for post in blog_posts:
        published = post["published"] or post["modified"]
        try:
            if "T" in published:
                stamp = datetime.fromisoformat(published.replace("Z", "+00:00"))
            else:
                stamp = datetime.strptime(published, "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
            pub = format_datetime(stamp)
        except ValueError:
            pub = now
        enclosure = ""
        if post["image"]:
            enclosure = (
                '\n      <enclosure url="%s" type="image/jpeg" />' % escape(post["image"])
            )
        items.append(
            "    <item>\n"
            "      <title>%s</title>\n"
            "      <link>%s</link>\n"
            "      <guid isPermaLink=\"true\">%s</guid>\n"
            "      <pubDate>%s</pubDate>\n"
            "      <description>%s</description>%s\n"
            "    </item>"
            % (
                xml_text(post["title"]),
                escape(post["loc"]),
                escape(post["loc"]),
                pub,
                xml_text(post["description"]),
                enclosure,
            )
        )

    dest = os.path.join(ROOT, "feed.xml")
    open(dest, "w").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        "    <title>Uphill Pursuit — Adventure Blogs</title>\n"
        "    <link>%s/blogs/blogs.html</link>\n"
        "    <description>Trip reports from hiking, skiing, mountaineering, "
        "and biking across the Cascades, Rockies, and beyond.</description>\n"
        "    <language>en-us</language>\n"
        "    <lastBuildDate>%s</lastBuildDate>\n"
        '    <atom:link href="%s/feed.xml" rel="self" type="application/rss+xml" />\n'
        "%s\n"
        "  </channel>\n"
        "</rss>\n"
        % (HOST, now, HOST, "\n".join(items))
    )
    print("wrote feed.xml (%d posts)" % len(items))


def add_twitter_tags():
    """Fill in twitter:title / description / image from the matching og tags."""
    pages = glob.glob(os.path.join(ROOT, "blogs", "*.html"))
    pages += [
        os.path.join(ROOT, "index.html"),
        os.path.join(ROOT, "photography", "portfolio.html"),
    ]
    updated = 0
    for path in pages:
        html = open(path).read()
        if "twitter:title" in html or "twitter:card" not in html:
            continue
        title = attr(html, "og:title", prop=True)
        description = attr(html, "og:description", prop=True) or attr(
            html, "description"
        )
        image = attr(html, "og:image", prop=True)
        alt = attr(html, "og:image:alt", prop=True)
        if not (title and description and image):
            print("skip twitter tags, missing og fields:", os.path.relpath(path, ROOT))
            continue
        extra = (
            '    <meta name="twitter:title" content="%s" />\n'
            '    <meta name="twitter:description" content="%s" />\n'
            '    <meta name="twitter:image" content="%s" />'
            % (title, description, image)
        )
        if alt:
            extra += (
                '\n    <meta name="twitter:image:alt" content="%s" />' % alt
            )
        html = html.replace(
            '<meta name="twitter:card" content="summary_large_image" />',
            '<meta name="twitter:card" content="summary_large_image" />\n' + extra,
            1,
        )
        open(path, "w").write(html)
        updated += 1
    print("added twitter tags on %d pages" % updated)


def add_feed_links():
    """Point crawlers and readers at feed.xml from the two index pages."""
    targets = {
        os.path.join(ROOT, "index.html"): "    <link rel=\"canonical\"",
        os.path.join(ROOT, "blogs", "blogs.html"): "    <link rel=\"canonical\"",
    }
    link = (
        '    <link rel="alternate" type="application/rss+xml" '
        'title="Adventure blogs" href="%s/feed.xml" />\n' % HOST
    )
    for path, needle in targets.items():
        html = open(path).read()
        if "application/rss+xml" in html:
            continue
        if needle not in html:
            print("skip feed link, no canonical:", os.path.relpath(path, ROOT))
            continue
        open(path, "w").write(html.replace(needle, link + needle, 1))
        print("linked feed.xml from", os.path.relpath(path, ROOT))


def main():
    blog_posts = posts()
    add_twitter_tags()
    add_feed_links()
    write_robots()
    write_sitemap(blog_posts)
    write_feed(blog_posts)


if __name__ == "__main__":
    main()
