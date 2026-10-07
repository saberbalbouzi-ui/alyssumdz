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
  <div class="grid" id="shop-grid"></div>
</div></section>
'''
ACCT = '''<section class="shop-page"><div class="container" style="max-width:560px;text-align:center">
  <div class="sec-title"><span class="kicker">حسابي</span><h1 style="font-size:clamp(1.6rem,4vw,2.2rem);margin:.2rem 0">👤 حسابي</h1></div>
  <div id="acct-box" style="background:#fff;border:1px solid var(--line);border-radius:20px;padding:1.6rem"></div>
</div></section>
'''
INIT = '<script>document.addEventListener("DOMContentLoaded",()=>{bootStore().then(()=>{%s;initCartDrawer();fillCartWilayas();initReveal();});});</script></body></html>'


def page(title, desc, body, init, noindex=False):
    h = head + icon + "\n<title>%s | %s</title><meta name=\"description\" content=\"%s\">%s\n</head><body>\n" % (title, site, desc, '<meta name="robots" content="noindex">' if noindex else "")
    return h + top + "\n" + body + "</main>" + tail + INIT % init


out.mkdir(parents=True, exist_ok=True)
(out / "shop.html").write_text(page("المتجر", "تصفّح كل المنتجات والتصنيفات والعروض — الدفع عند الاستلام", SHOP, "initShop()"), encoding="utf-8")
(out / "account.html").write_text(page("حسابي", "سجّل الدخول أو أنشئ حساباً جديداً لتتبّع طلباتك", ACCT, "initAccountPage()", True), encoding="utf-8")
print("ok: shop.html, account.html ←", src)
