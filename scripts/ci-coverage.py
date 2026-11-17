#!/usr/bin/env python3
"""مقارنة تغطية مسارات CI الجديدة (website-ci.yml وplatform-ci.yml) بالمسار القديم (tests.yml الذي لا يُعدَّل).
القواعد (تفشل إن خُرقت):
 C1  كل أمر في المسارين الجديدين موجود حرفياً في tests.yml (لا اختبار جديد ولا مُعدَّل) — عدا قائمة الاستثناء NEW الموثّقة.
 C2  لا أمر في المسارين معاً (لا تكرار بين المسارين الجديدين).
 C3  كل أمر في tests.yml مصنَّف «موقع» يظهر في website-ci، و«منصة» في platform-ci؛ ولا أمر مصنَّف في المسار الخطأ.
 C5  لا أمر «غير مصنَّف»: كل أوامر tests.yml مغطاة بمسار واحد بالضبط (لا نقص ولا تكرار).
 C4  tests.yml لم يتغير بالنسبة لـ --base إلا في تثبيت runs-on: ubuntu-24.04 لوظيفة المتصفح ui (بنية yaml متطابقة عدا ذلك).
التصنيف (docs/CI-SPLIT-MAP.md وdocs/CI-UNCLASSIFIED-17-REVIEW.md): منصة = كود platform/api|gateway أو test-saas-* أو واجهات عقد المنصة (وكالة/متجر التطبيقات/المطوّر/رقمي) وصفحات دليل الأدوات saas/؛
موقع = لوحة الموقع وإصدار PHP وHub البائع واستوديوهات التصميم/الذكاء وصفحات المتجر (ولو استدعت المنصة: digital-checkout وtryon-shopper، بمسارات عقدها في website-ci).
  python3 scripts/ci-coverage.py [--base origin/main] [--markdown]"""
import os, re, subprocess, sys, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WF = os.path.join(ROOT, ".github/workflows")
NEW = {"node scripts/test-template-no-order-leak.js"}          # تغطية جديدة موثّقة (انحدار M-1 للقوالب) ليست من tests.yml
SYNTHETIC = {"فحص صياغة ملفات JavaScript": "website", "admin.html مولَّد ومطابق للمصادر (E-07)": "website"}
WEBSITE = set("""test-voice test-stock test-payments test-shiptable test-shipsup test-hub test-roles test-dispatch test-wh
test-shipping test-carriers test-calibration test-ship-php test-gateway test-roles-php test-webhook-php
test-hand test-speed test-speed-fix test-kind test-edition test-edition-live test-edition-real test-pagerater test-barcode
test-upsell test-upsell-admin test-upsell-follow
test-assets test-vgen test-vad test-pack3d test-mockup test-boxdesigner test-boxprofiles test-boxprofiles3d test-boxstudio test-fashion
test-digital-checkout test-tryon-shopper""".split())
def product(key):
    if key.startswith("step:"): return SYNTHETIC.get(key[5:], "unclassified")
    if re.search(r"platform/(api|gateway)/test/|scripts/test-shipagg\.js|scripts/test-saas-|scripts/test-(toolpages|agency-ui|appstore-ui|appstore-dev-ui|digital-ui)\.js", key): return "platform"
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
    ok("[C3] لا أمر مصنَّف في المسار الخطأ", not ((wset - NEW) - exp_w) and not (pset - exp_p), sorted(((wset - NEW) - exp_w) | (pset - exp_p)))
    ok("[C5] لا أمر «غير مصنَّف»، وكل أوامر tests.yml مغطاة بمسار واحد بالضبط", not exp_u and (wset | pset) >= oldset and not (wset & pset), sorted(exp_u | (oldset - wset - pset)))
    # [C6] شروط التشغيل (paths) لاختبارات عقود المنصة: تغيير الملف المختبَر أو الاختبار أو ملف عقد المنصة يشغّل المسار الذي يحوي الاختبار
    def paths(wf, ev):
        y = yaml.safe_load(open(os.path.join(WF, wf), encoding="utf-8")); on = y.get(True, y.get("on")); return on[ev].get("paths", [])
    NEED = {"website-ci.yml": ["platform/api/src/modules/digital.js", "platform/api/src/modules/tryon.js", "scripts/test-digital-checkout.js", "scripts/test-tryon-shopper.js", "assets/js/tryon-shopper.js", "assets/js/data.js", "p/anti-acne/index.html"],
            "platform-ci.yml": ["assets/js/admin-agency.js", "assets/js/admin-appstore.js", "assets/js/admin-appdev.js", "assets/js/admin-digital.js", "assets/js/admin-nav.js", "scripts/test-agency-ui.js", "scripts/test-appstore-ui.js", "scripts/test-appstore-dev-ui.js", "scripts/test-digital-ui.js", "scripts/test-toolpages.js", "scripts/gen-tool-pages.py", "saas/landing/landing.js", "platform/api/src/modules/agency.js", "platform/api/src/modules/appstore.js"]}
    import fnmatch
    def triggers(wf, ev, f):
        hit = False
        for pat in paths(wf, ev):
            neg = pat.startswith("!"); g = pat[1:] if neg else pat
            rx = re.compile("^" + re.escape(g).replace(r"\*\*", ".*").replace(r"\*", "[^/]*") + "$")
            if rx.match(f): hit = not neg
        return hit
    miss = [f"{wf}:{ev}:{f}" for wf, fs in NEED.items() for ev in ("push", "pull_request") for f in fs if not triggers(wf, ev, f)]
    ok("[C6] ملفات عقد المنصة واختباراتها تشغّل المسار الصحيح (push وpull_request)", not miss, miss)
    wrong = [f for f in ("scripts/test-agency-ui.js", "scripts/test-toolpages.js", "scripts/test-saas-wallet.js") if triggers("website-ci.yml", "push", f)]
    ok("[C6b] اختبارات المنصة لا تشغّل website-ci وحدها", not wrong, wrong)
    rc, old_txt = sh("git", "show", f"{base}:.github/workflows/tests.yml")
    cur = yaml.safe_load(open(os.path.join(WF, "tests.yml"), encoding="utf-8")); prev = yaml.safe_load(old_txt) if rc == 0 else None
    pinned = bool(prev) and cur["jobs"]["ui"].get("runs-on") == "ubuntu-24.04" and prev["jobs"]["ui"].get("runs-on") in ("ubuntu-latest", "ubuntu-24.04")
    if prev:
        cur["jobs"]["ui"]["runs-on"] = prev["jobs"]["ui"]["runs-on"]
    rc2, d = sh("git", "diff", "--numstat", base, "--", ".github/workflows/tests.yml")
    ok(f"[C4] tests.yml لم يتغير بالنسبة لـ {base} إلا بتثبيت ubuntu-24.04 لوظيفة ui (سطر واحد)", rc == 0 and pinned and cur == prev and d.strip() in ("", "1\t1\t.github/workflows/tests.yml"), d.strip())
    print(f"\nتغطية: tests.yml={len(old)} أمراً | موقع→website-ci {len(exp_w)} | منصة→platform-ci {len(exp_p)} | غير مصنَّف {len(exp_u)} | جديد موثَّق {len(NEW)}")
    if "--markdown" in sys.argv:
        print("\n| الأمر | الإنتاج | أين يُشغَّل بعد الفصل |\n|---|---|---|")
        for jn, c in old:
            p = product(c); where = {"website": "website-ci.yml", "platform": "platform-ci.yml", "unclassified": "غير مصنَّف"}[p]
            print(f"| `{c[:110]}` | {p} | {where} |")
    print(f"\nالنتيجة: {'نجاح' if not bad else 'فشل ' + str(len(bad))}"); sys.exit(1 if bad else 0)
main()
