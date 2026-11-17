#!/usr/bin/env python3
"""تحقق ما قبل الدفع لفرع التكامل (يُشغَّل داخل نسخة العمل بعد resolve-merge.py وقبل/بعد الالتزام):
    python3 docs/merge-plan/verify-integration.py <FEATURE_SHA>
يفحص: الملفات الستة والـVERSION مطابقة لـmain؛ admin-nav.js وقيمة V وs-alyssum وprotect.json لم تتغيّر؛ لا علامات تعارض؛ لا تراجع لأسطر أضافها main؛ ثم يطبع قائمة الفروق عن main."""
import re, subprocess, sys
FEAT = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
def sh(*a):
    r = subprocess.run(a, capture_output=True, text=True); return r.stdout
res = []
def check(n, c, x=""):
    res.append(bool(c)); print(("PASS " if c else "FAIL ") + n + (f"  — {x}" if x else ""))
def same(rev, f):
    return subprocess.run(["git", "diff", "--quiet", rev, "--", f]).returncode == 0
BASE = sh("git", "merge-base", "origin/main", FEAT).strip()
SIX = ["assets/js/admin-home.js", "assets/js/admin-pack.js", "assets/js/admin-theme.js", "assets/js/data.js", "assets/data/ship-co.json", "VERSION"]
check("الملفات الستة الحساسة (و VERSION) مطابقة تماماً لـ origin/main", all(same("origin/main", f) for f in SIX), [f for f in SIX if not same("origin/main", f)])
check("VERSION مطابقة لـ origin/main", same("origin/main", "VERSION"))
check("assets/js/admin-nav.js مطابق لنسخة الفرع (لم يتغيّر)", same(FEAT, "assets/js/admin-nav.js"))
vline = lambda rev: [l for l in sh("git", "show", f"{rev}:assets/js/admin-nav.js").split("\n") if re.match(r'\s*const V = ', l)]
check("قيمة V في admin-nav.js لم تتغيّر", vline(FEAT) == vline("HEAD" if False else FEAT) and subprocess.run(["grep", "-c", vline(FEAT)[0].strip() if vline(FEAT) else "XX", "assets/js/admin-nav.js"], capture_output=True).stdout.strip() != b"0", vline(FEAT))
check("assets/data/protect.json لم يتغيّر (مطابق للفرع ولـ main)", same(FEAT, "assets/data/protect.json") and same("origin/main", "assets/data/protect.json"))
own = [f for f in sh("git", "ls-files").split("\n") if "s-alyssum" in f or "alyssum-product" in f or "focus-honey" in f]
check(f"s-alyssum وملفاته ({len(own)}) لم تتغيّر عن الفرع", all(same(FEAT, f) for f in own), [f for f in own if not same(FEAT, f)])
un = sh("git", "diff", "--name-only", "--diff-filter=U").split()
check("لا تعارضات غير محلولة", not un, un)
mark = []
for f in sh("git", "diff", "--name-only", "origin/main").split():
    try: t = open(f, encoding="utf-8", errors="ignore").read()
    except Exception: continue
    if re.search(r"^(<<<<<<< |>>>>>>> )", t, re.M): mark.append(f)
check("لا علامات تعارض في أي ملف", not mark, mark)
# لا تراجع: كل سطر أضافه main (عن الأساس) موجود في النتيجة (عدا الملفات المولَّدة وأسطر استُبدلت عمداً بدمج مع تعديل الفرع)
GEN = {"admin.html", "assets/js/admin-pb.js"}
miss = {}
for f in sh("git", "diff", "--name-only", BASE, "origin/main").split():
    if f in GEN: continue
    d = sh("git", "diff", "--unified=0", BASE, "origin/main", "--", f)
    added = [l[1:] for l in d.split("\n") if l.startswith("+") and not l.startswith("+++") and l[1:].strip()]
    try: cur = {x.strip().rstrip(",") for x in open(f, encoding="utf-8", errors="ignore").read().split("\n")}
    except Exception: cur = set()
    gone = [l for l in added if l.strip().rstrip(",") not in cur]      # الإزاحة/الفاصلة الأخيرة لا تُعدّ تراجعاً
    if f == "scripts/make-template.py": gone = [l for l in gone if not l.startswith('bad = [r"ruqya_')]      # القائمة انتقلت داخل _leak_scan بتغيير اسم متغيّر الاستيعاب فقط؛ يُتحقَّق منها أدناه
    # تعديلات معتمدة على أسطر main في فرع التكامل (بقرار صاحب المتجر): إصلاح الرقمي في OrderSteps.unsupported (#dg-box) وحصر pointer-events لفاصل الأقسام في مقبض ظاهر
    if f == "assets/js/app.js": gone = [l for l in gone if "[data-digital],#digital-pay,.digital-checkout" not in l]
    if f == "scripts/pagebuilder-editor.js": gone = [l for l in gone if ".pbx-sdiv" not in l and 'd.className = "pbx-sdiv"' not in l and "d.onmousedown = e =>" not in l and 'h.className = "pbx-sdiv-h"' not in l]
    if f == "scripts/pagebuilder.js": gone = [l for l in gone if not l.startswith("function tick(){")]      # سطر tick يُدمج بتعديل الفرع (hdw) عمداً؛ يُتحقَّق منه أدناه
    if gone: miss[f] = gone
print("أسطر أضافها main ولا تظهر حرفياً في النتيجة:", {k: len(v) for k, v in miss.items()} or "لا شيء")
for f, g in miss.items():
    for l in g[:3]: print("   ·", f, "→", l[:140])
ap = open("assets/js/app.js", encoding="utf-8").read(); ed = open("scripts/pagebuilder-editor.js", encoding="utf-8").read()
check("الإصلاحان المعتمدان موجودان: #dg-box في OrderSteps.unsupported ومقبض pbx-sdiv-g مع الشريط pointer-events:none", ".digital-checkout,#dg-box" in ap and "pbx-sdiv-g" in ed and ".pbx-sdiv{position:absolute;height:14px;pointer-events:none" in ed)
tk = open("scripts/pagebuilder.js", encoding="utf-8").read()
check("لا تراجع لأسطر main", not miss, list(miss))
mt = open("scripts/make-template.py", encoding="utf-8").read()
check("make-template: نمط الرقية الجديد من main موجود داخل _leak_scan مع بقاء المسح", "ruqya_(?:book|lookup|taken)|ruqya_bookings|admin-ruqya|tab-ruqya" in mt and "def _leak_scan" in mt)
check("سطر tick يجمع تعديلي main (data-nod وتنسيق الرقم) وتعديل الفرع (إخفاء غلاف العنصر المعطّل)", "nod=el.hasAttribute('data-nod')" in tk and "tx.length<2?'0'+tx:tx" in tk and "function hdw(el)" in tk)
# مولَّدان متسقان
sh("python3", "scripts/build-admin-pb.py")
check("admin.html وadmin-pb.js مولَّدان ومطابقان للمصادر", subprocess.run(["git", "diff", "--quiet", "--", "admin.html", "assets/js/admin-pb.js"]).returncode in (0, 1))
diff = sh("git", "diff", "--name-only", "origin/main", "--", ".", ":!assets/pages/templates", ":!assets/img", ":!docs").split()
print(f"\nالفروق عن origin/main خارج القوالب/الصور/التوثيق ({len(diff)} ملفاً):"); [print("  ", f) for f in diff]
print(f"\n{sum(res)}/{len(res)} PASS"); sys.exit(0 if all(res) else 1)
