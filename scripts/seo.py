#!/usr/bin/env python3
"""Generate sitemap, robots, product metadata and legacy redirects from the current store data."""
import json, re, html, pathlib, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = (ROOT / "assets/js/config.js").read_text(encoding="utf-8")
m = re.search(r'domain:\s*"([^"]+)"', cfg)
DOMAIN = m.group(1) if m else "example.com"
BASE = f"https://{DOMAIN}"
SITE = (re.search(r'name:\s*"([^"]+)"', cfg) or [0, DOMAIN])[1]
src = (ROOT / "assets/js/data.js").read_text(encoding="utf-8")
products = json.loads(re.search(r"var PRODUCTS\s*=\s*(\[.*?\]);\s*\n", src, re.S).group(1))
by_slug = {p["slug"]: p for p in products if p.get("slug")}
SEO_PATH = ROOT / "assets/data/seo.json"
try:
    seo = json.loads(SEO_PATH.read_text(encoding="utf-8")) if SEO_PATH.exists() else {}
except (OSError, json.JSONDecodeError):
    seo = {}
seo_products = seo.get("products") if isinstance(seo.get("products"), dict) else {}
raw_noindex = seo.get("noindex", []) if isinstance(seo.get("noindex", []), list) else []
noindex = {str(x).strip().lower() for x in raw_noindex if str(x).strip()}

def esc(s):
    return html.escape(str(s), quote=True)

def path_key(value):
    value = str(value or "").strip().lower()
    value = re.sub(r"^https?://[^/]+", "", value)
    return "/" + value.strip("/")

noindex_paths = {path_key(x) for x in noindex}

def excluded(slug, path):
    normalized = path_key(path)
    keys = {str(slug or "").strip("/").lower(), normalized, normalized.lstrip("/")}
    return any(k and k in noindex for k in keys) or normalized in noindex_paths

def url_path(slug):
    return f"{BASE}/p/{slug}/"

def abs_img(value):
    value = str(value or "")
    if re.match(r"^(?:https?:|data:)", value, re.I):
        return value
    return f"{BASE}/" + urllib.parse.quote(value.lstrip("/"))

def robots_tag(text, enabled):
    marker = r"<!--seo:noindex:start-->.*?<!--seo:noindex:end-->\s*"
    text = re.sub(marker, "", text, flags=re.S)
    if not enabled:
        return text
    block = '<!--seo:noindex:start--><meta name="robots" content="noindex" data-seo-managed="1"><!--seo:noindex:end-->\n'
    return re.sub(r"</head>", block + "</head>", text, count=1, flags=re.I)

live = [p for p in products if p.get("active", True) and p["slug"] != "test" and (ROOT / "p" / p["slug"] / "index.html").exists()]

# Sitemap contains the home page plus active, published products and live page-builder pages.
urls = [] if excluded("", "/") else [f"{BASE}/"]
urls += [url_path(p["slug"]) for p in live if not excluded(p["slug"], f"/p/{p['slug']}/")]
pages_path = ROOT / "assets/pages/index.json"
pages = []
if pages_path.exists():
    try:
        pages = json.loads(pages_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        pages = []
for page in pages if isinstance(pages, list) else []:
    slug = str(page.get("slug") or "").strip("/") if isinstance(page, dict) else ""
    if slug and page.get("live", True) and not excluded(slug, f"/lp/{slug}/"):
        urls.append(f"{BASE}/lp/{slug}/")
urls = list(dict.fromkeys(urls))
(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "".join(f"  <url><loc>{esc(u)}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
(ROOT / "robots.txt").write_text(
    f"User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")

# Canonical, Open Graph, Product JSON-LD and noindex for published product pages.
S, E = "<!--seo:start-->", "<!--seo:end-->"
n_seo = 0
for p in live:
    f = ROOT / "p" / p["slug"] / "index.html"
    text = f.read_text(encoding="utf-8")
    text = re.sub(re.escape(S) + r".*?" + re.escape(E) + r"\n?", "", text, flags=re.S)
    record = seo_products.get(p["slug"], {}) if isinstance(seo_products, dict) else {}
    title_match = re.search(r"<title>(.*?)</title>", text, re.S)
    fallback_title = html.unescape(title_match.group(1)).strip() if title_match else p["title"]
    title = record.get("title") or p.get("seoTitle") or fallback_title
    desc_match = re.search(r'<meta name="description" content="([^"]*)"', text)
    fallback_desc = html.unescape(desc_match.group(1)) if desc_match else (p.get("seoDesc") or p.get("desc") or seo.get("siteDesc", ""))
    desc = record.get("desc") or p.get("seoDesc") or fallback_desc
    og_image = record.get("ogImage") or p.get("cover") or (p.get("images") or [None])[0] or seo.get("ogImage")
    images = [abs_img(og_image)] if og_image else [abs_img(i) for i in (p.get("images") or [])[:5]]
    stock = p.get("stock")
    is_out = stock is not None and int(stock) <= 0
    ld = {"@context": "https://schema.org", "@type": "Product", "name": p["title"], "description": desc, "image": images, "sku": p["slug"],
          "brand": {"@type": "Brand", "name": SITE},
          "offers": {"@type": "Offer", "url": url_path(p["slug"]), "priceCurrency": "DZD", "price": str(int(p.get("price") or 0)),
                     "availability": "https://schema.org/OutOfStock" if is_out else "https://schema.org/InStock",
                     "itemCondition": "https://schema.org/NewCondition"}}
    no_idx = excluded(p["slug"], f"/p/{p['slug']}/")
    block = (f'{S}\n<link rel="canonical" href="{esc(url_path(p["slug"]))}">\n<meta property="og:locale" content="ar_DZ"><meta property="og:site_name" content="{esc(SITE)}">\n'
             f'<meta property="og:type" content="product"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{esc(url_path(p["slug"]))}">'
             + (f'<meta property="og:image" content="{esc(images[0])}">' if images else "") +
             ( '<!--seo:noindex:start--><meta name="robots" content="noindex"><!--seo:noindex:end-->' if no_idx else "") +
             f'\n<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n{E}\n')
    text = text.replace("</head>", block + "</head>", 1)
    f.write_text(text, encoding="utf-8")
    n_seo += 1

# Homepage receives the global title/description and Organization/WebSite JSON-LD.
index = ROOT / "index.html"
text = index.read_text(encoding="utf-8")
text = re.sub(re.escape(S) + r".*?" + re.escape(E) + r"\n?", "", text, flags=re.S)
site_title = str(seo.get("siteTitle") or SITE).strip()
site_desc = str(seo.get("siteDesc") or "").strip()
if site_title:
    text = re.sub(r"<title>.*?</title>", f"<title>{esc(site_title)}</title>", text, count=1, flags=re.S)
if site_desc:
    meta = f'<meta name="description" content="{esc(site_desc)}">'
    if re.search(r'<meta\s+name="description"[^>]*>', text, re.I):
        text = re.sub(r'<meta\s+name="description"[^>]*>', meta, text, count=1, flags=re.I)
    else:
        text = text.replace("</head>", meta + "\n</head>", 1)
ld = {"@context": "https://schema.org", "@graph": [{"@type": "Organization", "name": site_title, "url": BASE + "/", "logo": BASE + "/assets/img/icon-512.png"},
                                                   {"@type": "WebSite", "name": site_title, "url": BASE + "/"}]}
home_block = (f'{S}\n<link rel="canonical" href="{BASE}/">\n<meta property="og:locale" content="ar_DZ"><meta property="og:site_name" content="{esc(site_title)}"><meta property="og:url" content="{BASE}/">' + ('<!--seo:noindex:start--><meta name="robots" content="noindex"><!--seo:noindex:end-->' if excluded("", "/") else "")
              + (f'<meta property="og:title" content="{esc(site_title)}"><meta property="og:description" content="{esc(site_desc)}">' if site_desc else "")
              + (f'<meta property="og:image" content="{esc(abs_img(seo.get("ogImage")))}">' if seo.get("ogImage") else "")
              + f'\n<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n{E}\n')
text = text.replace("</head>", home_block + "</head>", 1)
index.write_text(text, encoding="utf-8")

# Mark noindex on live page-builder pages; only live pages enter the sitemap.
n_pages = 0
for page in pages if isinstance(pages, list) else []:
    slug = str(page.get("slug") or "").strip("/") if isinstance(page, dict) else ""
    if not slug or not page.get("live", True):
        continue
    target = ROOT / "lp" / slug / "index.html"
    if not target.is_file():
        continue
    text = target.read_text(encoding="utf-8")
    text = robots_tag(text, excluded(slug, f"/lp/{slug}/"))
    target.write_text(text, encoding="utf-8")
    n_pages += 1

# Legacy WordPress-style routes redirect to each published product URL.
MARK = "<!--seo-redirect-->"
aliases = {k: v for k, v in json.loads((ROOT / "redirects.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
want = {p["slug"]: p["slug"] for p in live}
want.update({a: s for a, s in aliases.items() if s in by_slug})
RESERVED = {"p", "assets", "admin", "api", "supabase", "scripts", "releases", "php-edition", "sales", "dist", "apps-script"}
made = 0
for old, new in want.items():
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", old) or old in RESERVED:
        continue
    directory = ROOT / old
    target = directory / "index.html"
    if directory.exists() and not (target.exists() and MARK in target.read_text(encoding="utf-8")):
        continue
    directory.mkdir(exist_ok=True)
    href = f"/p/{new}/"
    abs_target = url_path(new)
    title = by_slug[new]["title"]
    target.write_text(f'<!DOCTYPE html>\n<html lang="ar" dir="rtl"><head>{MARK}<meta charset="utf-8"><title>{esc(title)} — {esc(SITE)}</title>'
                      f'<link rel="canonical" href="{esc(abs_target)}"><meta http-equiv="refresh" content="0;url={esc(href)}"><meta name="viewport" content="width=device-width,initial-scale=1">'
                      f'<script>location.replace({json.dumps(href)}+location.search+location.hash)</script></head>'
                      f'<body><p>انتقلت هذه الصفحة إلى <a href="{esc(href)}">{esc(title)}</a></p></body></html>\n', encoding="utf-8")
    made += 1
for directory in ROOT.iterdir():
    target = directory / "index.html"
    if directory.is_dir() and directory.name not in want and target.exists() and MARK in target.read_text(encoding="utf-8"):
        target.unlink()
        directory.rmdir()
print(f"sitemap: {len(urls)} رابط | SEO: {n_seo} منتج، {n_pages} صفحة منشورة | تحويلات: {made} | النطاق: {DOMAIN}")
