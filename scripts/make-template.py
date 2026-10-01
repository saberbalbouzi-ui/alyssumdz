#!/usr/bin/env python3
"""يولّد نسخة قالب نظيفة للبيع في dist/template (بلا منتجاتك ولا صورك ولا طلباتك ولا مفاتيحك).

  python3 scripts/make-template.py [--out dist/template] [--name "اسم المتجر"] [--wa 2135XXXXXXXX]

ثم يفحص النسخة بحثاً عن أي أثر لهويتك (الاسم، النطاق، الرقم، المنتجات، المشروع…) ويفشل إن وجد.
"""
import argparse, json, pathlib, re, shutil, struct, sys, zlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="dist/template")
ap.add_argument("--name", default="اسم متجرك")
ap.add_argument("--wa", default="213000000000")
ap.add_argument("--update", action="store_true", help="مع --target php: حزمة تحديث تحوي الكود فقط ولا تمسّ بيانات الزبون")
ap.add_argument("--remote", action="store_true", help="مع --update: حزمة للتحديث عن بُعد (الملفات المشتركة فقط، بلا update.php)")
ap.add_argument("--channel", default="https://raw.githubusercontent.com/saberbalbouzi-ui/alyssumdz/main/releases", help="رابط قناة التحديث (مجلد releases)")
ap.add_argument("--pubkey", default="releases/pubkey.pem", help="المفتاح العام لتوقيع التحديثات")
ap.add_argument("--target", choices=["github", "php"], default="github", help="github: القالب الحالي (Supabase+GitHub) | php: حزمة للاستضافة العادية")
a = ap.parse_args()
OUT = (ROOT / a.out).resolve()
if a.update:
    if a.target != "php": sys.exit("--update يتطلب --target php")
    import subprocess, tempfile
    tmp = ROOT / "dist" / ("_upd_" + OUT.name)
    r = subprocess.run([sys.executable, __file__, "--target", "php", "--out", str(tmp.relative_to(ROOT)), "--name", a.name, "--wa", a.wa, "--channel", a.channel, "--pubkey", a.pubkey], capture_output=True, text=True)
    if r.returncode != 0: print(r.stdout, r.stderr); sys.exit("فشل توليد الحزمة (فحص التسرّب؟)")
    if OUT.exists(): shutil.rmtree(OUT)
    keep = json.loads((ROOT / "shared-files.json").read_text(encoding="utf-8"))["shared"] + ["version.json"]
    for rel in keep:
        (OUT / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(tmp / rel, OUT / rel)
    if not a.remote:
        # تحديث يدوي: يحمل أيضاً ملفات إعداد المحدِّث لتفعيل التحديث عن بُعد في المواقع القديمة (لا تدخل القناة البعيدة)
        for rel in ("api/update-config.php", "api/update-key.pem"):
            if (tmp / rel).exists(): shutil.copy2(tmp / rel, OUT / rel)
        upd = (ROOT / "php-edition/update.php").read_text(encoding="utf-8").replace("__DEFAULT_NAME__", a.name).replace("__DEFAULT_WA__", a.wa)
        (OUT / "update.php").write_text(upd, encoding="utf-8")
    shutil.rmtree(tmp)
    ver = json.loads((OUT / "version.json").read_text())["version"]
    if not a.remote: (OUT / "README-UPDATE.txt").write_text(f"""تحديث الموقع إلى الإصدار {ver}

1) ارفع محتوى هذا المجلد فوق ملفات الموقع في الاستضافة واقبل استبدال الملفات المتشابهة.
2) سجّل الدخول من admin.html كمدير، ثم افتح https://نطاقك/update.php (مرة واحدة، يحذف نفسه).
لا يمسّ هذا التحديث: كلمة المرور، الطلبات، المنتجات، الصور، الإعدادات، رسوم التوصيل.
احتفظ بنسخة احتياطية من مجلد الموقع قبل التحديث.
""", encoding="utf-8")
    print(f"✅ حزمة تحديث الإصدار {ver}:", OUT, "—", sum(1 for x in OUT.rglob("*") if x.is_file()), "ملفاً")
    sys.exit(0)
if ROOT not in OUT.parents:
    sys.exit("المسار يجب أن يكون داخل المستودع")

# اقرأ منتجاتك الحالية لاستعمالها في فحص التسرّب فقط
data = (ROOT / "assets/js/data.js").read_text(encoding="utf-8")
slugs = re.findall(r'"slug":"([^"]+)"', data)

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

def cp(rel):
    s = ROOT / rel; d = OUT / rel
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(s, d) if s.is_dir() else shutil.copy2(s, d)

for rel in ["admin.html", "assets/css", "assets/js", "assets/data", "supabase", "p/_template", "assets/img/placeholder", "scripts/rebrand.py", "scripts/build-page-template.py", "scripts/setup-supabase.sh"]:
    cp(rel)

vals = {"SITE_NAME": a.name, "SITE_EN": a.name, "WA": a.wa, "YEAR": str(datetime.date.today().year)}
fill = lambda t: re.sub(r"\{\{([A-Z_]+)\}\}", lambda m: vals.get(m.group(1), m.group(0)), t)

# الصفحة الرئيسية + صفحة منتج تجريبي
(OUT / "index.html").write_text(fill((ROOT / "scripts/template/index.html").read_text(encoding="utf-8")), encoding="utf-8")
demo = {"SLUG": "demo", "TITLE": "منتج تجريبي", "TITLE_URL": "%D9%85%D9%86%D8%AA%D8%AC%20%D8%AA%D8%AC%D8%B1%D9%8A%D8%A8%D9%8A", "DESC": "وصف المنتج التجريبي — عدّله أو احذفه من لوحة التحكم.", "SUB": "المنتجات", "CAT": "المنتجات"}
page = (ROOT / "p/_template/index.html").read_text(encoding="utf-8").replace('<meta name="robots" content="noindex" data-template>\n', "")
(OUT / "p/demo").mkdir(parents=True, exist_ok=True)
(OUT / "p/demo/index.html").write_text(re.sub(r"\{\{([A-Z_]+)\}\}", lambda m: {**vals, **demo}.get(m.group(1), m.group(0)), page), encoding="utf-8")

# صور محايدة
(OUT / "assets/img/demo").mkdir(parents=True, exist_ok=True)
shutil.copy2(ROOT / "scripts/template/demo.svg", OUT / "assets/img/demo/0.svg")
def png(w, h, rgb):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
(OUT / "assets/img/favicon.png").write_bytes(png(64, 64, (23, 63, 53)))

# بيانات المتجر
(OUT / "assets/js/data.js").write_text(
    "/* منتجات المتجر — يُعدَّل تلقائياً من لوحة التحكم admin.html */\n"
    'var CATEGORIES = {"general":"المنتجات"};\n'
    "var PRODUCTS = " + json.dumps([{"slug": "demo", "title": "منتج تجريبي", "price": 2000, "old": 2800, "images": ["assets/img/demo/0.svg"],
        "desc": "وصف المنتج التجريبي — عدّله أو احذفه من لوحة التحكم.", "cat": "general", "active": True, "stock": None, "seoTitle": "", "seoDesc": "",
        "offers": [{"qty": 1, "price": 2000}, {"qty": 2, "price": 3600}, {"qty": 3, "price": 4800, "free": 1}]}], ensure_ascii=False) + ";\n", encoding="utf-8")
for f, v in {"coupons": "[]", "pixels": "[]", "agent-faq": "[]", "agent-training": '{"version":1,"scopes":{}}'}.items():
    (OUT / "assets/data" / (f + ".json")).write_text(v + "\n", encoding="utf-8")
for f in ("checkout.json",):
    (OUT / "assets/data" / f).unlink(missing_ok=True)

# الإعدادات: هوية محايدة وبلا مفاتيح
cfg = (ROOT / "assets/js/config.js").read_text(encoding="utf-8")
cfg = re.sub(r'API_URL:\s*"[^"]*"', 'API_URL: ""', cfg)
cfg = re.sub(r'ORDERS_BACKEND:\s*"[^"]*"', 'ORDERS_BACKEND: "supabase"', cfg)
cfg = re.sub(r'SUPABASE_URL:\s*"[^"]*"', 'SUPABASE_URL: ""', cfg)
cfg = re.sub(r'SUPABASE_ANON_KEY:\s*"[^"]*"', 'SUPABASE_ANON_KEY: ""', cfg)
site = 'SITE: {\n    name: %s,\n    domain: "example.com",\n    waNumber: %s,\n    instagram: "",\n    repoOwner: "",\n    repoName: "",\n  },' % (json.dumps(a.name, ensure_ascii=False), json.dumps(a.wa))
cfg = re.sub(r"SITE:\s*\{.*?\n  \},", site, cfg, flags=re.S)
(OUT / "assets/js/config.js").write_text(cfg, encoding="utf-8")

(OUT / "README.md").write_text("""# قالب متجر بالدفع عند الاستلام (عربي)

متجر ثابت على GitHub Pages مع لوحة تحكم (`admin.html`) وSupabase للطلبات والإحصاءات.

## البدء
1. أنشئ مستودعاً جديداً وارفع هذه الملفات، وفعّل GitHub Pages (وضع النطاق في ملف `CNAME`).
2. عدّل `CONFIG.SITE` في `assets/js/config.js` (الاسم، النطاق، واتساب، حساب GitHub والمستودع).
3. أنشئ مشروع Supabase وشغّل: `SUPABASE_PAT=... ./scripts/setup-supabase.sh <project_ref> <بريدك>` ثم ضع الرابط والمفتاح العام في `config.js`.
4. أنشئ مستخدم المدير في Supabase ← Authentication ← Users، وعطّل التسجيل العام.
5. افتح `admin.html`، سجّل الدخول، وأدخل توكن GitHub (Contents: write) في إعدادات GitHub، ثم أضف منتجاتك: تُنشأ صفحة كل منتج تلقائياً.
6. احذف المنتج التجريبي `demo` (ومجلد `p/demo`) بعد إضافة منتجاتك.

تفاصيل الأمان في `supabase/README.md`. لا تضع مفتاح `service_role` في المستودع أبداً.
""", encoding="utf-8")

# الوكيل الذكي: أفرغ معرفة منتجاتك (KNOWLEDGE/COMPLEMENTS) ونوايا المنتجات الخاصة بها؛ يتدرّب المشتري على منتجاته من اللوحة
ag = OUT / "assets/js/agent.js"
t = ag.read_text(encoding="utf-8")
for const in ("KNOWLEDGE", "COMPLEMENTS"):
    t, n = re.subn(r"(  const %s = )\{.*?\n  \};" % const, r"\1{};", t, count=1, flags=re.S)
    assert n == 1, const
sl = "|".join(re.escape(x) for x in slugs)
t = re.sub(r'^[ \t]*\{ re: /[^\n]*?, act: "(?:%s)" \},?\n' % sl, "", t, flags=re.M)
ag.write_text(t, encoding="utf-8")

# إزالة أي أثر لهويتك من نصوص الشيفرة (مفاتيح التخزين، أمثلة، اسم العلامة…)
NAME = a.name.replace('"', "'").replace("\\", "")
SCRUB = [("alyssum_", "store_"), ("alyssumdz.com", "example.com"), ("saberbalbouzi-ui", "your-account"), ("alyssumdz", "your-repo"),
         ("213559237239", "213550000000"), ("anti-acne", "demo"), ("ALYSSUM DZ", NAME), ("ALYSSUM", NAME), ("أليسوم", NAME), ("alyssum", "store"), ("qvdaiundlkfbmjlummni", "YOUR_PROJECT_REF")]
for f in OUT.rglob("*"):
    if f.is_file() and f.suffix in {".html", ".js", ".json", ".md", ".css", ".sql", ".sh", ".py"} and f.name not in ("make-template.py",):
        t = f.read_text(encoding="utf-8"); n = t
        for o, new in SCRUB:
            n = n.replace(o, new)
        if n != t:
            f.write_text(n, encoding="utf-8")

(OUT / "LICENSE.md").write_text("""# ترخيص استعمال القالب

> نص مبدئي للتعديل فقط، وليس استشارة قانونية. اعرضه على محامٍ قبل اعتماده.

1. يمنح البائع المشتري ترخيصاً غير حصري وغير قابل للتحويل لاستعمال هذا القالب وتعديله في **متجر واحد** يملكه المشتري.
2. لا يجوز إعادة بيع القالب أو توزيعه أو نشره علناً، كلياً أو جزئياً، ولا استعماله في أكثر من متجر دون اتفاق مكتوب.
3. يبقى البائع مالكاً للشيفرة الأصلية وله حق بيعها لآخرين.
4. يُقدَّم القالب «كما هو» دون ضمان نتيجة تجارية. مسؤولية المنتجات والمحتوى والزبائن والامتثال للقوانين على المشتري.
5. بيانات الزبائن والطلبات في مشروع Supabase الخاص بالمشتري ملك له، ولا يحتفظ البائع بأي نسخة منها.
""", encoding="utf-8")

# ── الهدف php: حزمة للرفع على أي استضافة PHP (بدون Supabase وGitHub)
if a.target == "php":
    import secrets
    shutil.rmtree(OUT / "supabase", ignore_errors=True)
    shutil.rmtree(OUT / "scripts", ignore_errors=True)          # أدوات البائع (Python) لا تلزم الزبون، وتمنع استيراد Hostinger للأرشيف
    (OUT / "scripts/setup-supabase.sh").unlink(missing_ok=True)
    shutil.copytree(ROOT / "php-edition/api", OUT / "api")
    code = "-".join(secrets.token_hex(2).upper() for _ in range(4))
    import subprocess
    h = subprocess.check_output(["php", "-r", "echo password_hash($argv[1], PASSWORD_DEFAULT);", code], text=True)
    ins = (ROOT / "php-edition/install.php").read_text(encoding="utf-8").replace("__INSTALL_CODE_HASH__", h).replace("__DEFAULT_NAME__", a.name).replace("__DEFAULT_WA__", a.wa)
    (OUT / "install.php").write_text(ins, encoding="utf-8")
    (OUT / "api/update-config.php").write_text("<?php\nreturn " + "['channel' => " + json.dumps(a.channel) + "];\n", encoding="utf-8")
    pk = ROOT / a.pubkey
    if pk.exists(): shutil.copy2(pk, OUT / "api/update-key.pem")
    else: print("⚠️ لا يوجد مفتاح توقيع (" + a.pubkey + "): التحديث عن بُعد معطّل في هذه الحزمة")
    cfgp = OUT / "assets/js/config.js"; c = cfgp.read_text(encoding="utf-8")
    c = c.replace('ORDERS_BACKEND: "supabase",', 'ORDERS_BACKEND: "sheets",\n  BACKEND: "php",')
    cfgp.write_text(c, encoding="utf-8")
    (OUT / "README.md").write_text("""# متجرك — دليل التثبيت

1. ارفع محتويات هذا المجلد كاملة إلى مجلد الموقع في الاستضافة (public_html).
2. افتح `https://نطاقك/install.php` وأدخل رمز التثبيت الذي سلّمه لك البائع، واختر كلمة مرور قوية.
3. بعد النجاح يُحذف ملف التثبيت تلقائياً. ادخل إلى `https://نطاقك/admin.html` بكلمة المرور.
4. أضف منتجاتك من اللوحة: تُنشأ صفحة كل منتج تلقائياً. احذف المنتج التجريبي `demo` بعد ذلك.

المتطلبات: PHP 8.1 فأعلى مع `pdo_sqlite` و`fileinfo` و`mbstring`، وصلاحية الكتابة على المجلدات.
النسخ الاحتياطي: انسخ مجلد الموقع كاملاً (يشمل `api/_data` الذي فيه الطلبات).
""", encoding="utf-8")
    print("🔑 رمز التثبيت (سلّمه للمشتري فقط، لا يُحفظ في أي ملف):", code)

(OUT / "version.json").write_text(json.dumps({"version": (ROOT / "VERSION").read_text(encoding="utf-8").strip()}) + "\n", encoding="utf-8")

# فحص التسرّب
bad = [r"alyssum", "أليسوم", "ألي<span", "213559237239", "0559", "saberbalbouzi", "balbouzi", "qvdaiundlkfbmjlummni", "AKfycb", "sb_publishable", "ADMIN-2026"] + [r"(?<=[\"'/])" + re.escape(s) + r"(?=[\"'/])" for s in slugs if s != "demo"]
hits = []
for f in OUT.rglob("*"):
    if f.is_file() and f.suffix in {".html", ".js", ".json", ".md", ".sql", ".sh", ".py", ".svg", ".css", ".txt"}:
        t = f.read_text(encoding="utf-8", errors="ignore")
        for b in bad:
            for m in re.finditer(b, t, re.I):
                hits.append((str(f.relative_to(OUT)), b, t[max(0, m.start() - 30):m.end() + 30].replace("\n", " ")))
for h in hits[:60]:
    print("تسرّب:", *h)
print(f"{len(hits)} أثر" if hits else "✅ لا آثار لهويتك في النسخة", "—", OUT)
sys.exit(1 if hits else 0)
