#!/usr/bin/env python3
"""يولّد shop.html (المتجر/التصنيفات/الفئات) و account.html (حسابي) من هيدر وفوتر وسلة index.html نفسه،
فتحمل الصفحتان هوية الموقع كما هي. يُستعمل للموقع الحالي ولقالب الزبائن:
    python3 scripts/build-shop-pages.py [index.html المصدر] [مجلد الإخراج]
"""
import sys, re
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
out = Path(sys.argv[2] if len(sys.argv) > 2 else ".")
t = src.read_text(encoding="utf-8")

# الرأس: من البداية حتى أيقونة الموقع (بلا العنوان/الوصف/JSON-LD الخاصة بالرئيسية)
head = t[: t.index('<link rel="icon"')]
head = re.sub(r'<link rel="preload"[^>]*>', "", head)
icon = re.search(r'<link rel="icon"[^>]*>', t).group(0)
name_m = re.search(r"<title>(.*?)</title>", t, re.S)
site = (name_m.group(1).split("|")[0].split("—")[0].strip() if name_m else "المتجر")

# قالب المتجر المثبَّت على الرئيسية (مثل أليسوم): نحمل CSSه إلى صفحتي المتجر/حسابي فيبقيان بالهوية نفسها (الخلفية والزجاج والبطاقات)
tpl = re.search(r'<style id="pb-tpl-css">.*?</style>', t, re.S)
tplcss = tpl.group(0) if tpl else ""
ALY = "aly-grid" in t
# تكملة هوية أليسوم لصفحات الفئات: لافتة بصورة الفئة (يضع initShop المتغيّر --shop-hero)، شرائح زجاجية، وعنوان بتدرّج
ALYSHOP = """<style id="aly-shop-css">
.shop-page .sec-title{position:relative;margin:0 auto 22px;padding:44px 22px 36px;border-radius:26px;overflow:hidden;border:1px solid rgba(134,239,172,.28);background:linear-gradient(0deg,rgba(3,16,9,.9),rgba(3,16,9,.5)),var(--shop-hero,linear-gradient(145deg,rgba(12,54,29,.88),rgba(3,16,9,.94))) center/cover no-repeat;box-shadow:0 22px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.14)}
.shop-page .sec-title h1{color:#ecfdf5;text-shadow:0 2px 22px rgba(0,0,0,.55)}.shop-page .sec-title p{color:#c5dccd}.shop-page .sec-title .kicker{color:#bef264}
#shop-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:24px}
#shop-chips .chip{background:rgba(255,255,255,.07)!important;border:1px solid rgba(134,239,172,.3)!important;color:#d1fae5!important;border-radius:999px;padding:.5rem 1.2rem;font-weight:800;backdrop-filter:blur(10px);transition:transform .2s,border-color .2s}
#shop-chips .chip:hover{transform:translateY(-2px);border-color:#86efac!important}
#shop-chips .chip.active{background:rgba(74,222,128,.22)!important;border-color:#bef264!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.shop-page .grid .card .cta{background:rgba(74,222,128,.2)!important;border:1px solid rgba(134,239,172,.4);color:#ecfdf5!important;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -6px 12px rgba(0,0,0,.18);backdrop-filter:blur(8px)}
.shop-page .grid .card:hover .cta{background:rgba(74,222,128,.34)!important;transform:translateY(-2px)}
#acct-box{background:linear-gradient(145deg,rgba(12,54,29,.88),rgba(3,16,9,.94))!important;border:1px solid rgba(134,239,172,.28)!important;color:#ecfdf5;backdrop-filter:blur(14px)}
</style>"""
if ALY: tplcss += ALYSHOP

# جسم الصفحة: الشريط العلوي + الهيدر
b0 = t.index("<body>") + len("<body>")
b1 = t.index("<main")
top = t[b0:b1]
top = top.strip() + '<main id="main">'

# الفوتر + السلة + السكربتات حتى سكربت التهيئة الأخير
f0 = t.index("</main>") + len("</main>")
tail = t[f0:]
tail = tail[: tail.rindex("<script>document.addEventListener")]

SHOP = '''<section class="shop-page"><div class="container">
  <div class="sec-title"><span class="kicker">تسوّق بسهولة</span><h1 id="shop-title" style="font-size:clamp(1.6rem,4vw,2.4rem);margin:.2rem 0">المتجر</h1><p id="shop-sub"></p></div>
  <div class="chips" id="shop-chips"></div>
  <div class="grid%GRID%" id="shop-grid"></div>
</div></section>
'''
ACCT = '''<section class="shop-page"><div class="container" style="max-width:560px;text-align:center">
  <div class="sec-title"><span class="kicker">حسابي</span><h1 style="font-size:clamp(1.6rem,4vw,2.2rem);margin:.2rem 0">👤 حسابي</h1></div>
  <div id="acct-box" style="background:#fff;border:1px solid var(--line);border-radius:20px;padding:1.6rem"></div>
</div></section>
'''
INIT = '<script>document.addEventListener("DOMContentLoaded",()=>{bootStore().then(()=>{%s;initCartDrawer();fillCartWilayas();initReveal();});});</script></body></html>'


def page(title, desc, body, init, noindex=False):
    body = body.replace("%GRID%", " aly-grid" if ALY else "")
    h = head + icon + "\n<title>%s | %s</title><meta name=\"description\" content=\"%s\">%s\n%s</head><body>\n" % (title, site, desc, '<meta name="robots" content="noindex">' if noindex else "", tplcss)
    return h + top + "\n" + body + "</main>" + tail + INIT % init


out.mkdir(parents=True, exist_ok=True)
(out / "shop.html").write_text(page("المتجر", "تصفّح كل المنتجات والتصنيفات والعروض — الدفع عند الاستلام", SHOP, "initShop()"), encoding="utf-8")
(out / "account.html").write_text(page("حسابي", "سجّل الدخول أو أنشئ حساباً جديداً لتتبّع طلباتك", ACCT, "initAccountPage()", True), encoding="utf-8")
print("ok: shop.html, account.html ←", src)
