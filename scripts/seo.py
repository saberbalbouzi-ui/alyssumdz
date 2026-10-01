#!/usr/bin/env python3
"""يولّد ملفات SEO الثابتة للموقع من assets/js/data.js (آمن لإعادة التشغيل):
  • sitemap.xml و robots.txt
  • canonical + og + JSON-LD (Product) داخل p/<slug>/index.html (بين علامتي seo:start / seo:end)
  • صفحات تحويل للروابط القديمة بنمط ووردبريس: /<slug>/ و/<alias>/ ⟵ /p/<slug>/ (canonical + meta refresh)
الاستعمال:  python3 scripts/seo.py"""
import json, re, html, pathlib, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = (ROOT / "assets/js/config.js").read_text(encoding="utf-8")
m = re.search(r'domain:\s*"([^"]+)"', cfg)
DOMAIN = m.group(1) if m else "example.com"
BASE = f"https://{DOMAIN}"
SITE = (re.search(r'name:\s*"([^"]+)"', cfg) or [0, DOMAIN])[1]

src = (ROOT / "assets/js/data.js").read_text(encoding="utf-8")
products = json.loads(re.search(r"var PRODUCTS\s*=\s*(\[.*?\]);\s*\n", src, re.S).group(1))
by_slug = {p["slug"]: p for p in products}
live = [p for p in products if p.get("active", True) and p["slug"] != "test" and (ROOT / "p" / p["slug"] / "index.html").exists()]
RESERVED = {"p", "assets", "admin", "api", "supabase", "scripts", "releases", "php-edition", "sales", "dist", "apps-script"}

def esc(s): return html.escape(str(s), quote=True)
def url_path(slug): return f"{BASE}/p/{slug}/"
def abs_img(rel): return f"{BASE}/" + urllib.parse.quote(rel.lstrip("/"))

# ── sitemap + robots ──
urls = [f"{BASE}/"] + [url_path(p["slug"]) for p in live]
(ROOT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "".join(f"  <url><loc>{esc(u)}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
(ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")

# ── canonical + og + JSON-LD داخل صفحات المنتجات ──
S, E = "<!--seo:start-->", "<!--seo:end-->"
n_seo = 0
for p in live:
    f = ROOT / "p" / p["slug"] / "index.html"
    t = f.read_text(encoding="utf-8")
    t = re.sub(re.escape(S) + r".*?" + re.escape(E) + r"\n?", "", t, flags=re.S)
    title = (re.search(r"<title>(.*?)</title>", t, re.S) or [0, p["title"]])[1].strip()
    d = re.search(r'<meta name="description" content="([^"]*)"', t)
    desc = html.unescape(d.group(1)) if d else (p.get("seoDesc") or p.get("desc") or "")
    imgs = [abs_img(i) for i in (p.get("images") or [])[:5]]
    stock = p.get("stock")
    ld = {"@context": "https://schema.org", "@type": "Product", "name": p["title"], "description": desc, "image": imgs, "sku": p["slug"],
          "brand": {"@type": "Brand", "name": SITE},
          "offers": {"@type": "Offer", "url": url_path(p["slug"]), "priceCurrency": "DZD", "price": str(int(p.get("price") or 0)),
                     "availability": "https://schema.org/OutOfStock" if (stock is not None and int(stock) <= 0) else "https://schema.org/InStock",
                     "itemCondition": "https://schema.org/NewCondition"}}
    block = (f'{S}\n<link rel="canonical" href="{esc(url_path(p["slug"]))}">\n<meta property="og:locale" content="ar_DZ"><meta property="og:site_name" content="{esc(SITE)}">\n'
             f'<meta property="og:type" content="product"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{esc(url_path(p["slug"]))}">'
             + (f'<meta property="og:image" content="{esc(imgs[0])}">' if imgs else "") +
             f'\n<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n{E}\n')
    t = t.replace("</head>", block + "</head>", 1)
    f.write_text(t, encoding="utf-8"); n_seo += 1

# الصفحة الرئيسية
idx = ROOT / "index.html"; t = idx.read_text(encoding="utf-8")
t = re.sub(re.escape(S) + r".*?" + re.escape(E) + r"\n?", "", t, flags=re.S)
ld = {"@context": "https://schema.org", "@graph": [{"@type": "Organization", "name": SITE, "url": BASE + "/", "logo": BASE + "/assets/img/icon-512.png"},
                                              {"@type": "WebSite", "name": SITE, "url": BASE + "/"}]}
t = t.replace("</head>", f'{S}\n<link rel="canonical" href="{BASE}/">\n<meta property="og:locale" content="ar_DZ"><meta property="og:site_name" content="{esc(SITE)}"><meta property="og:url" content="{BASE}/">\n<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n{E}\n</head>', 1)
idx.write_text(t, encoding="utf-8")

# ── صفحات تحويل الروابط القديمة: /<slug>/ و/<alias>/ ⟵ /p/<slug>/ ──
MARK = "<!--seo-redirect-->"
aliases = {k: v for k, v in json.loads((ROOT / "redirects.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
want = {p["slug"]: p["slug"] for p in live}
want.update({a: s for a, s in aliases.items() if s in by_slug})
made = 0
for old, new in want.items():
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", old) or old in RESERVED: continue
    d = ROOT / old; f = d / "index.html"
    if d.exists() and not (f.exists() and MARK in f.read_text(encoding="utf-8")): continue      # لا نلمس مجلداً حقيقياً
    d.mkdir(exist_ok=True)
    tgt = f"/p/{new}/"; abs_t = url_path(new); title = by_slug[new]["title"]
    f.write_text(f'<!DOCTYPE html>\n<html lang="ar" dir="rtl"><head>{MARK}<meta charset="utf-8"><title>{esc(title)} — {esc(SITE)}</title>'
                 f'<link rel="canonical" href="{esc(abs_t)}"><meta http-equiv="refresh" content="0;url={esc(tgt)}"><meta name="viewport" content="width=device-width,initial-scale=1">'
                 f'<script>location.replace({json.dumps(tgt)}+location.search+location.hash)</script></head>'
                 f'<body><p>انتقلت هذه الصفحة إلى <a href="{esc(tgt)}">{esc(title)}</a></p></body></html>\n', encoding="utf-8"); made += 1
# حذف تحويلات لم تعد مطلوبة
for d in ROOT.iterdir():
    f = d / "index.html"
    if d.is_dir() and d.name not in want and f.exists() and MARK in f.read_text(encoding="utf-8"):
        f.unlink(); d.rmdir()
print(f"sitemap: {len(urls)} رابط | seo: {n_seo} صفحة منتج | تحويلات قديمة: {made} | النطاق: {DOMAIN}")
