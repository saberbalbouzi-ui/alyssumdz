#!/usr/bin/env python3
"""Generate sitemap.xml and robots.txt from published products and static pages."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def load_products(path: Path) -> list[dict]:
    source = path.read_text(encoding="utf-8")
    match = re.search(r"\bvar\s+PRODUCTS\s*=\s*(\[.*?\])\s*;", source, re.S)
    if not match:
        raise ValueError(f"Could not find the PRODUCTS array in {path}")
    value = json.loads(match.group(1))
    if not isinstance(value, list):
        raise ValueError("PRODUCTS must be a JSON array")
    return [p for p in value if isinstance(p, dict)]


def site_url(config_path: Path, explicit: str | None) -> str:
    value = explicit or os.environ.get("SITE_URL", "")
    if not value and config_path.exists():
        config = config_path.read_text(encoding="utf-8")
        site = re.search(r"SITE\s*:\s*\{([\s\S]*?)\n\s*\}", config)
        if site:
            domain = re.search(r"\bdomain\s*:\s*['\"]([^'\"]+)['\"]", site.group(1))
            if domain:
                value = "https://" + domain.group(1)
    value = value or "https://example.com"
    return value.rstrip("/")


def url_key(value: str) -> str:
    value = value.strip()
    if value.startswith(("http://", "https://")):
        value = re.sub(r"^https?://[^/]+", "", value)
    return "/" + value.strip("/")


def page_has_noindex(path: Path) -> bool:
    try:
        head = path.read_text(encoding="utf-8", errors="replace")[:30000]
    except OSError:
        return False
    for tag in re.findall(r"<meta\b[^>]*>", head, re.I):
        if re.search(r'\bname\s*=\s*["\']robots["\']', tag, re.I) and re.search(r'\bcontent\s*=\s*["\'][^"\']*noindex', tag, re.I):
            return True
    return False


def lastmod(path: Path) -> str:
    try:
        stamp = dt.datetime.fromtimestamp(path.stat().st_mtime, tz=dt.timezone.utc)
    except OSError:
        stamp = dt.datetime.now(dt.timezone.utc)
    return stamp.date().isoformat()


def generate(base: str, products_path: Path, seo_path: Path, output: Path) -> tuple[int, int]:
    products = load_products(products_path)
    seo = json.loads(seo_path.read_text(encoding="utf-8")) if seo_path.exists() else {}
    noindex = {url_key(str(x)).lower() for x in seo.get("noindex", []) if str(x).strip()}
    noindex_slugs = {str(x).strip().strip("/").lower() for x in seo.get("noindex", []) if str(x).strip()}
    urls: dict[str, str] = {}

    def add(path: str, source: Path | None = None, key: str | None = None) -> None:
        normalized = url_key(path)
        if normalized.lower() in noindex or (key and key.strip("/").lower() in noindex_slugs):
            return
        urls[normalized] = lastmod(source) if source else dt.datetime.now(dt.timezone.utc).date().isoformat()

    home = ROOT / "index.html"
    add("/", home)

    active = {str(p.get("slug", "")): p for p in products if p.get("slug") and p.get("active") is not False}
    for slug, product in active.items():
        product_url = f"/p/{slug}/"
        product_file = ROOT / "p" / slug / "index.html"
        if product_file.exists() and page_has_noindex(product_file):
            continue
        add(product_url, product_file if product_file.exists() else products_path, key=slug)
        route = str(product.get("route") or "").strip("/")
        if route:
            landing = ROOT / "lp" / route / "index.html"
            if landing.is_file() and not page_has_noindex(landing):
                add(f"/lp/{route}/", landing, key=route)

    # Existing static files are treated as published pages. Technical/admin files are excluded.
    for filename in ("shop.html", "about.html", "contact.html", "faq.html"):
        page = ROOT / filename
        if page.is_file() and not page_has_noindex(page):
            add("/" + filename, page, key=filename)
    for folder in ("blog", "policy", "pages", "lp"):
        base_dir = ROOT / folder
        if not base_dir.is_dir():
            continue
        for page in sorted(base_dir.rglob("index.html")):
            if page_has_noindex(page):
                continue
            rel = page.parent.relative_to(ROOT).as_posix().strip("/")
            add(f"/{rel}/", page, key=rel)

    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for path, modified in sorted(urls.items()):
        item = ET.SubElement(urlset, "url")
        ET.SubElement(item, "loc").text = base + ("" if path == "/" else path)
        ET.SubElement(item, "lastmod").text = modified
    ET.indent(urlset, space="  ")
    output.mkdir(parents=True, exist_ok=True)
    (output / "sitemap.xml").write_bytes(ET.tostring(urlset, encoding="utf-8", xml_declaration=True))
    (output / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /admin.html\n"
        f"Sitemap: {base}/sitemap.xml\n",
        encoding="utf-8",
        newline="\n",
    )
    return len(urls), len(active)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", help="Public site origin; defaults to CONFIG.SITE.domain")
    parser.add_argument("--root", type=Path, default=ROOT, help="Site repository root")
    args = parser.parse_args()
    root = args.root.resolve()
    base = site_url(root / "assets/js/config.js", args.base_url)
    total, active = generate(base, root / "assets/js/data.js", root / "assets/data/seo.json", root)
    print(f"Generated sitemap.xml ({total} URLs; {active} active products) and robots.txt for {base}")


if __name__ == "__main__":
    main()

