#!/usr/bin/env python3
"""مقارنة تغطية مسارات CI الجديدة (website-ci.yml وplatform-ci.yml) بالمسار القديم (tests.yml الذي لا يُعدَّل).
القواعد (تفشل إن خُرقت):
 C1  كل أمر في المسارين الجديدين موجود حرفياً في tests.yml (لا اختبار جديد ولا مُعدَّل) — عدا قائمة الاستثناء NEW الموثّقة.
 C2  لا أمر في المسارين معاً (لا تكرار بين المسارين الجديدين).
 C3  كل أمر في tests.yml مصنَّف «موقع» يظهر في website-ci، و«منصة» في platform-ci، و«غير مصنَّف» في لا واحد منهما (يبقى في tests.yml).
 C4  tests.yml نفسه لم يتغير بالنسبة لـ --base (افتراضي origin/main).
التصنيف (قائمة مُعدَّة بدليل نصي من رأس كل سكربت، انظر docs/CI-SPLIT-MAP.md): منصة = كود platform/api|gateway أو test-saas-* أو ما يستورد platform/gateway/src؛
موقع = لوحة الموقع (assets/js/admin-*.js وadmin.html) وإصدار PHP وHub البائع؛ ما فيه أدلة متعارضة ⇒ غير مصنَّف (يبقى في tests.yml).
  python3 scripts/ci-coverage.py [--base origin/main] [--markdown]"""
import os, re, subprocess, sys, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WF = os.path.join(ROOT, ".github/workflows")
NEW = {"node scripts/test-template-no-order-leak.js"}          # تغطية جديدة موثّقة (انحدار M-1 للقوالب) ليست من tests.yml
SYNTHETIC = {"فحص صياغة ملفات JavaScript": "website", "admin.html مولَّد ومطابق للمصادر (E-07)": "website"}
WEBSITE = set("""test-voice test-stock test-payments test-shiptable test-shipsup test-hub test-roles test-dispatch test-wh
test-shipping test-carriers test-calibration test-ship-php test-gateway test-roles-php test-webhook-php
test-hand test-speed test-speed-fix test-kind test-edition test-edition-live test-edition-real test-pagerater test-barcode
test-upsell test-upsell-admin test-upsell-follow""".split())
def product(key):
    if key.startswith("step:"): return SYNTHETIC.get(key[5:], "unclassified")
    if re.search(r"platform/(api|gateway)/test/|scripts/test-shipagg\.js|scripts/test-saas-", key): return "platform"
    m = re.search(r"scripts/(test-[\w\-]+)\.(js|php)", key)
    if m and m.group(1) in WEBSITE: return "website"
    return "unclassified"
INFRA = re.compile(r"apt-get|npm i |npx playwright install")
def commands(path):
    y = yaml.safe_load(open(path, encoding="utf-8")); out = []
    for jn, j in y["jobs"].items():
        for s in j["steps"]:
            run = (s.get("run") or "").strip(); nm = s.get("name") or ""
            if not run: continue
            if nm in SYNTHETIC: out.append((jn, "step:" + nm)); continue
            m = re.search(r"for t in ([a-z0-9\- ]+); do node --no-warnings platform/api/test/\$t\.test\.mjs; done", run)
            for l in run.splitlines():
                l = l.strip()
                if not l or INFRA.search(l): continue
                if m and l.startswith("for t in"):
                    out += [(jn, f"node --no-warnings platform/api/test/{t}.test.mjs") for t in m.group(1).split()]; continue
                out.append((jn, l))
    return out
def sh(*a):
    r = subprocess.run(a, cwd=ROOT, capture_output=True, text=True); return r.returncode, r.stdout
def main():
    base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "origin/main"
    old = commands(os.path.join(WF, "tests.yml")); oldset = {c for _, c in old}
    web = commands(os.path.join(WF, "website-ci.yml")); plat = commands(os.path.join(WF, "platform-ci.yml"))
    wset = {c for _, c in web}; pset = {c for _, c in plat}
    bad = []; ok = lambda m, c, x="": (print(("✓ " if c else "✗ ") + m + ("" if c or not x else "  " + str(x)[:300])), None if c else bad.append(m))
    ok("[C1] كل أوامر website-ci موجودة حرفياً في tests.yml (عدا الاستثناء الموثَّق)", wset - NEW <= oldset, sorted(wset - NEW - oldset))
    ok("[C1] كل أوامر platform-ci موجودة حرفياً في tests.yml", pset <= oldset, sorted(pset - oldset))
    ok("[C1b] الاستثناء الموثَّق الوحيد في website-ci وهو ضمن NEW", (wset & NEW) == NEW and not (pset & NEW), sorted(wset & NEW))
    ok("[C2] لا أمر مشترك بين المسارين الجديدين", not (wset & pset), sorted(wset & pset))
    ok("[C2b] لا أمر مكرر داخل المسار الواحد", len(web) == len(wset) and len(plat) == len(pset), [c for _, c in web if [x for _, x in web].count(c) > 1][:3])
    exp_w = {c for _, c in old if product(c) == "website"}; exp_p = {c for _, c in old if product(c) == "platform"}; exp_u = {c for _, c in old if product(c) == "unclassified"}
    ok("[C3] كل أمر «موقع» من tests.yml يظهر في website-ci", exp_w <= wset, sorted(exp_w - wset))
    ok("[C3] كل أمر «منصة» من tests.yml يظهر في platform-ci", exp_p <= pset, sorted(exp_p - pset))
    ok("[C3] لا أمر مصنَّف في المسار الخطأ، ولا «غير مصنَّف» نُقل", not ((wset - NEW) - exp_w) and not (pset - exp_p) and not (exp_u & (wset | pset)), sorted(((wset - NEW) - exp_w) | (pset - exp_p) | (exp_u & (wset | pset))))
    rc, d = sh("git", "diff", "--stat", base, "--", ".github/workflows/tests.yml")
    ok(f"[C4] tests.yml لم يتغير بالنسبة لـ {base}", rc == 0 and not d.strip(), d.strip())
    print(f"\nتغطية: tests.yml={len(old)} أمراً | موقع→website-ci {len(exp_w)} | منصة→platform-ci {len(exp_p)} | غير مصنَّف (يبقى في tests.yml) {len(exp_u)} | جديد موثَّق {len(NEW)}")
    if "--markdown" in sys.argv:
        print("\n| الأمر | الإنتاج | أين يُشغَّل بعد الفصل |\n|---|---|---|")
        for jn, c in old:
            p = product(c); where = {"website": "website-ci.yml", "platform": "platform-ci.yml", "unclassified": "يبقى في tests.yml فقط"}[p]
            print(f"| `{c[:110]}` | {p} | {where} |")
    print(f"\nالنتيجة: {'نجاح' if not bad else 'فشل ' + str(len(bad))}"); sys.exit(1 if bad else 0)
main()
