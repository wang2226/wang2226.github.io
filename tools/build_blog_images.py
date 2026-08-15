#!/usr/bin/env python3
"""Generates web-sized copies of the blog photos and points the posts at them.

The posts used to embed the originals straight off the camera, which meant
20-90 MB per page. Figures never render wider than 940 CSS px and the cards on
the index never wider than ~400, so the copies below cover retina with room to
spare while cutting the pages to a few MB.

Originals stay in blogs/images/ and are never touched. Re-run after adding
photos to a post:

    python3 tools/build_blog_images.py
"""

import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOGS = os.path.join(ROOT, "blogs")
IMAGES = os.path.join(BLOGS, "images")
WEB = os.path.join(IMAGES, "web")

QUALITY = "65"
FIGURE_EDGE = 1600
CARD_EDGE = 900

# The index shows small cards; every other page shows full-width figures.
EDGES = {"blogs.html": CARD_EDGE}

IMG_TAG = re.compile(r"<img\b[^>]*?>", re.S)


def attr_of(tag, name):
    match = re.search(r'\b%s="([^"]*)"' % name, tag)
    return match.group(1) if match else None


def relative_source(src):
    """'./images/hood/start.jpeg' or './images/web/hood/start.jpeg' -> 'hood/start.jpeg'"""
    path = src.split("images/", 1)[1]
    if path.startswith("web/"):
        path = path[len("web/"):]
    return path


def measure(path):
    probe = subprocess.check_output(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
        universal_newlines=True,
    )
    return (int(re.search(r"pixelWidth: (\d+)", probe).group(1)),
            int(re.search(r"pixelHeight: (\d+)", probe).group(1)))


def convert(rel, max_edge):
    """Downscales one photo into images/web/, and returns its final size."""
    source = os.path.join(IMAGES, rel)
    target = os.path.join(WEB, rel)
    if not os.path.exists(source):
        sys.exit("missing source image: %s" % source)

    folder = os.path.dirname(target)
    if not os.path.isdir(folder):
        os.makedirs(folder)

    stale = (not os.path.exists(target)
             or os.path.getmtime(target) < os.path.getmtime(source))
    if stale:
        subprocess.check_call(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", QUALITY,
             "-Z", str(max_edge), source, "--out", target],
            stdout=subprocess.PIPE,
        )
    return measure(target)


def rewrite(tag, rel, size):
    """Points one <img> at the web copy and gives it intrinsic dimensions."""
    width, height = size
    tag = re.sub(r'(\bsrc=")[^"]*(")',
                 lambda m: m.group(1) + "./images/web/" + rel + m.group(2), tag)

    for name, value in (("width", width), ("height", height)):
        if attr_of(tag, name) is None:
            anchor = re.search(r'\balt="[^"]*"', tag)
            insert = '\n              %s="%d"' % (name, value)
            at = anchor.end() if anchor else tag.index(" ")
            tag = tag[:at] + insert + tag[at:]
        else:
            tag = re.sub(r'\b%s="[^"]*"' % name, '%s="%d"' % (name, value), tag)
    return tag


def main():
    total_before = 0
    total_after = 0
    converted = set()

    for page in sorted(glob.glob(os.path.join(BLOGS, "*.html"))):
        name = os.path.basename(page)
        edge = EDGES.get(name, FIGURE_EDGE)
        html = open(page).read()
        changed = 0

        def replace(match):
            nonlocal changed, total_before, total_after
            tag = match.group(0)
            src = attr_of(tag, "src")
            if not src or "images/" not in src or src.startswith("http"):
                return tag
            rel = relative_source(src)
            size = convert(rel, edge)
            if rel not in converted:
                converted.add(rel)
                total_before += os.path.getsize(os.path.join(IMAGES, rel))
                total_after += os.path.getsize(os.path.join(WEB, rel))
            changed += 1
            return rewrite(tag, rel, size)

        updated = IMG_TAG.sub(replace, html)
        if updated != html:
            open(page, "w").write(updated)
        print("%-18s %2d photos at %d px" % (name, changed, edge))

    print("\n%d photos: %.1f MB of originals -> %.1f MB of web copies (%.0f%% smaller)"
          % (len(converted), total_before / 1e6, total_after / 1e6,
             100 - 100.0 * total_after / total_before))


if __name__ == "__main__":
    main()
