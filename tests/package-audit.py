#!/usr/bin/env python3
"""فحص حزم العملاء (تثبيت + تحديث يدوي + تحديث عن بُعد) بحثاً عن أي أثر لهوية متجر أليسوم أو رقم المالك، والتأكد أن مكتبة القوالب المشحونة نظيفة وعامة ومتكاملة:
python3 tests/package-audit.py   (يبني الحزم الثلاث في dist/_pa_* ثم يحذفها)
(1) نجاح البناء وفحص التسرّب المدمج (2) لا مسار ملف يحوي alyssum/focus-honey (3) فحص مستقل أوسع لنصوص كل الملفات: رقم المالك/اسمه/حساباته/مشروعه/سلاجات منتجاته
(4) الفهرس المشحون بلا قوالب البائع وكل مدخل له ملف ومعاينتان وكل صورة مشار إليها موجودة داخل الحزمة نفسها (5) كل ملف في حزمة التحديث البعيدة ضمن القائمة المشتركة ولا شيء من owner_only
(6) كود المكتبة في الحزمة بلا عناصر البائع (ولا أعلام alyssum) وصياغته سليمة"""
import fnmatch, json, os, re, shutil, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
res = []
def check(t, n, c, x=""): res.append(c); print(("PASS " if c else "FAIL ") + f"[{t}] {n}" + (f"  — {x}" if x else ""))
def build(args, out):
    shutil.rmtree(out, ignore_errors=True)
    r = subprocess.run([sys.executable, "scripts/make-template.py", "--target", "php", "--out", out, "--name", "متجري", "--wa", "213000000000", "--kind", "physical"] + args, capture_output=True, text=True)
    return r
# أدوات المنصة المشحونة بالتصميم (اسم الأداة لا هوية المتجر): امتداد المتصفح «Alyssum Clone Helper» لناسخ القوالب
CHANNEL = "https://raw.githubusercontent.com/saberbalbouzi-ui/alyssumdz/main/releases"
PLATFORM_TOOLS = {"assets/ext/alyssum-clone-helper.zip"}
PK = {"install": ("dist/_pa_base", []), "update": ("dist/_pa_upd", ["--update"]), "remote": ("dist/_pa_rem", ["--update", "--remote"])}
sh = json.load(open("shared-files.json", encoding="utf-8")); shared = set(sh["shared"]); own = sh["owner_only"]
data = open("assets/js/data.js", encoding="utf-8").read(); slugs = [s for s in re.findall(r'"slug":"([^"]+)"', data) if s not in ("demo", "test")]
STRICT = [r"0559\s?23\s?72\s?39", r"213559237239", r"(?<!\d)0559(?!\d)", r"alyssumdz", r"saberbalbouzi", r"balbouzi", r"qvdaiundlkfbmjlummni", r"أليسوم", r"ألي<span", r"ALYSSUM", r"AKfycb", r"sb_publishable", r"ADMIN-2026", r"focus-honey", r"s-alyssum", r"alyssum[-_]"] + [r"(?<=[\"'/])" + re.escape(s) + r"(?=[\"'/])" for s in slugs]
ALLOWED = re.compile(r"alyssum\s+(?:api|الذكية|الذكي|3d|box|mockup|studio|pack)|تقنية\s+alyssum|\(alyssum\)|issuer:\s*\"alyssum\"|\"alyssum \"\s*\+", re.I)
sk = re.search(r'SAAS_KEY:\s*"(sb_publishable_[^"]+)"', open("assets/js/config.js", encoding="utf-8").read()); SK = sk.group(1) if sk else None
TEXT = {".html", ".js", ".json", ".md", ".sql", ".sh", ".py", ".svg", ".css", ".txt", ".php", ".webmanifest", ".xml", ".pem"}
try:
    for name, (out, args) in PK.items():
        r = build(args, out); check(name, "البناء ينجح وفحص التسرّب المدمج نظيف", r.returncode == 0 and ("لا آثار" in r.stdout), (r.stdout + r.stderr).strip().splitlines()[-1][:160] if r.returncode else "")
        if r.returncode: continue
        files = [os.path.relpath(os.path.join(d, f), out) for d, _, fs in os.walk(out) for f in fs]
        bad_paths = [f for f in files if re.search(r"alyssum|focus-honey", f, re.I) and f not in PLATFORM_TOOLS]
        check(name, f"لا مسار ملف يحمل اسم البائع أو هبوطه ({len(files)} ملفاً)", not bad_paths, bad_paths[:4])
        hits = []
        for f in files:
            if os.path.splitext(f)[1].lower() in TEXT:
                t = open(os.path.join(out, f), encoding="utf-8", errors="ignore").read()
                t = ALLOWED.sub(lambda m: " " * len(m.group(0)), t)
                if f == "api/update-config.php": t = t.replace(CHANNEL, "")      # قناة التحديث: عنوان مقصود يسحب منه العميل التحديثات (يُسرَد في التقرير)
                if SK: t = t.replace(SK, "")
                for b in STRICT:
                    for m in re.finditer(b, t, re.I if b not in (r"ALYSSUM",) else 0): hits.append((f, b, t[max(0, m.start() - 25):m.end() + 25].replace("\n", " ")))
        check(name, "فحص مستقل أوسع: لا رقم/اسم/حساب/مشروع/سلاج للبائع في أي ملف نصي", not hits, hits[:3])
        if name == "install": continue
        T = os.path.join(out, "assets/pages/templates")
        idx = json.load(open(os.path.join(T, "index.json"), encoding="utf-8")); ids = [x["id"] for x in idx]
        check(name, f"فهرس المكتبة المشحون بلا قوالب البائع ({len(ids)} مدخلاً)", "s-alyssum" not in ids and not any(x.get("alyssum") or x.get("owner") for x in idx), len(ids))
        miss = [i for i in ids if not (os.path.exists(f"{T}/{i}.json") and os.path.exists(f"{T}/thumbs/{i}.jpg") and os.path.exists(f"{T}/thumbs/{i}-full.jpg"))]
        check(name, "لكل مدخل ملف ومعاينتان", not miss, miss[:3])
        sk_miss = [i for i in ids if i.startswith("s-") and not os.path.exists(f"{T}/prod-{i}.json")]
        check(name, "لكل متجر جلد صفحة منتج", not sk_miss, sk_miss[:3])
        refs = set()
        for d, _, fs in os.walk(T):
            for f in fs:
                if f.endswith((".json", ".css")): refs |= set(re.findall(r"assets/img/[A-Za-z0-9_./-]+\.(?:webp|png|jpg|svg)", open(os.path.join(d, f), encoding="utf-8").read()))
        no_img = sorted(i for i in refs if not os.path.exists(os.path.join(out, i)))
        check(name, f"كل صورة تشير إليها قوالب الحزمة موجودة داخلها ({len(refs)} صورة)", not no_img, no_img[:3])
        nav = open(os.path.join(out, "assets/js/admin-nav.js"), encoding="utf-8").read()
        check(name, "كود المكتبة بلا عناصر البائع ولا علم alyssum (والحارس قائم)", "p-focus-honey" not in nav and "owner: true" not in nav and "x.alyssum" not in nav and "x.owner" in nav)
        r2 = subprocess.run(["node", "--check", os.path.join(out, "assets/js/admin-nav.js")], capture_output=True, text=True); check(name, "صياغة admin-nav.js في الحزمة سليمة", r2.returncode == 0, r2.stderr[:100])
        if name == "remote":
            def covered(p): return p in shared or any(g.endswith("/**") and p.startswith(g[:-2]) for g in shared)
            extra = [f for f in files if not covered(f) and f != "version.json"]
            check(name, "كل ملفات حزمة التحديث البعيدة ضمن القائمة المشتركة", not extra, extra[:4])
            leaked = [f for f in files if any(fnmatch.fnmatch(f, g) for g in own["files"])]
            check(name, "لا ملف من owner_only في الحزمة البعيدة", not leaked, leaked[:4])
finally:
    for out, _ in PK.values(): shutil.rmtree(out, ignore_errors=True)
    shutil.rmtree("dist/_upd__pa_upd", ignore_errors=True)
    for d in os.listdir("dist") if os.path.isdir("dist") else []:
        if d.startswith("_upd_"): shutil.rmtree(os.path.join("dist", d), ignore_errors=True)
bad = res.count(False); print(f"\n{len(res) - bad}/{len(res)} PASS — {bad} FAILURES"); sys.exit(1 if bad else 0)
