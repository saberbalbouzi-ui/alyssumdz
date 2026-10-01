#!/usr/bin/env python3
"""يحوّل صفحات المنتجات الحالية (p/*/index.html) إلى النموذج الجديد دون المساس بنصوصها:
  1) معرض صور ثابت داخل الصفحة (من صور المنتج الحالية في data.js) بتدوير تلقائي — قابل للتعديل من محرر اللوحة
  2) نموذج الطلب خارج عمود المعلومات وبعرض كامل على الحاسوب
  3) التصميم الفاخر (أنماط premium) للصفحات التي لا تملكه
يعمل مرة واحدة لكل صفحة (يتخطى ما حُوِّل). الاستعمال:  python3 scripts/convert-pages.py [--dry-run] [slug ...]"""
import glob, json, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
dry = "--dry-run" in sys.argv

tpl = (root / "p/_template/index.html").read_text(encoding="utf-8")
STYLE = re.search(r'<style id="premium-overrides">.*?</style>', tpl, re.S).group(0)
GALLERY_JS = re.search(r"<script>\n/\* معرض الصور:.*?</script>\n", tpl, re.S).group(0)
WIDE_CSS = STYLE[STYLE.index("/* نموذج الطلب العريض */"):STYLE.rindex("</style>")]

data = (root / "assets/js/data.js").read_text(encoding="utf-8")
products = {p["slug"]: p for p in json.loads(re.search(r"var PRODUCTS = (\[.*?\]);\n", data, re.S).group(1))}

done, skipped = [], []
for f in sorted(glob.glob(str(root / "p/*/index.html"))):
    slug = f.split("/")[-2]
    if slug.startswith("_") or (args and slug not in args): continue
    s = pathlib.Path(f).read_text(encoding="utf-8")
    if "data-static" in s:
        skipped.append(slug); continue
    p = products.get(slug)
    if not p or not p.get("images"):
        print("تخطّي (لا صور):", slug); continue
    # 1) معرض ثابت
    esc = lambda t: str(t).replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
    thumbs = "".join('<img src="../../%s" alt="%s"%s>' % (img, esc(p["title"]), ' class="on active"' if i == 0 else "") for i, img in enumerate(p["images"][:8]))
    assert s.count('<div class="gthumbs"></div>') == 1, slug
    s = s.replace('<div class="gthumbs"></div>', '<div class="gthumbs" data-static="1">' + thumbs + "</div>")
    s = re.sub(r'(<img id="gmain" src=")[^"]*"', lambda m: m.group(1) + "../../" + p["images"][0] + '"', s, count=1)
    # سكربت المعرض القديم (anti-acne) يُستبدل
    s = re.sub(r"<script>\n// Galerie.*?</script>\n", "", s, flags=re.S)
    # 2) نموذج الطلب
    m = re.search(r'\s*<form class="form" id="order-form".*?</form>', s, re.S)
    assert m, slug
    form = m.group(0).strip(); s = s.replace(m.group(0), "", 1)
    s, n = re.subn(r'(</div>\s*</div>)(\s*</div>\s*)(?=<section)', lambda mm: mm.group(1) + '\n  <div class="order-wide">\n' + form + "\n  </div>" + mm.group(2), s, count=1)
    assert n == 1, slug
    # 3) أنماط
    if 'id="premium-overrides"' in s or 'id="alyssum-premium-overrides"' in s:
        s = re.sub(r"(<style id=\"(?:alyssum-)?premium-overrides\">.*?)</style>", lambda mm: mm.group(1) + WIDE_CSS + "</style>", s, count=1, flags=re.S)
    else:
        s = s.replace("</head>", STYLE + "\n</head>", 1)
    # سكربت المعرض قبل سكربت التهيئة
    s = s.replace('<script>document.addEventListener("DOMContentLoaded",()=>{bootStore()', GALLERY_JS + '<script>document.addEventListener("DOMContentLoaded",()=>{bootStore()', 1)
    assert "GALLERY" not in s and "data-static" in s and "order-wide" in s and "معرض الصور" in s, slug
    if not dry: pathlib.Path(f).write_text(s, encoding="utf-8")
    done.append(slug)
print(("[معاينة] " if dry else "") + f"حُوِّلت {len(done)} صفحة:", " ".join(done)); print("متخطّاة (محوّلة سابقاً):", len(skipped))
