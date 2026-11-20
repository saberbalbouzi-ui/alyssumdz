#!/usr/bin/env python3
"""حلّ دمج origin/main داخل feature/alyssum-theme-studio بأمان (تجريبي محلي، لا يدفع شيئاً ولا يلمس main).
الاستعمال في نسخة عمل نظيفة (git worktree) من رأس الفرع:
    git merge --no-commit --no-ff origin/main ; python3 docs/merge-plan/resolve-merge.py ; (راجع ثم) git commit
ما يفعله (انظر README.md للأسباب):
  1) ملفات أدخلها الالتزام c83b9174 بنسخ قديمة عن غير قصد ← نسخة main كاملةً
  2) shared-files.json ← نسخة الفرع + ما أضافه main فقط منذ الأساس
  3) make-template.py ← نسخة الفرع (_leak_scan) + نمط ruqya الجديد من main
  4) pagebuilder.js ← نسخة الفرع + تعديلات main على tick (data-nod وتنسيق الرقم)
  5) admin-help.json وchangelog.md ← main ثم ما أضافه الفرع
  6) admin.html وadmin-pb.js ← مولَّدان: نسخة main ثم build-admin-pb.py من المصادر المدموجة
يتوقف بخطأ إن ظهر تعارض خارج هذه القائمة."""
import json, re, subprocess, sys
def sh(*a, check=False):
    r = subprocess.run(a, capture_output=True, text=True)
    if check and r.returncode: sys.exit("فشل: " + " ".join(a) + "\n" + r.stderr)
    return r.stdout
def show(rev, f): return sh("git", "show", f"{rev}:{f}")
BASE = sh("git", "merge-base", "origin/main", "ORIG_HEAD").strip() or sh("git", "merge-base", "origin/main", "HEAD").strip()
STALE = ["VERSION", "assets/data/ship-co.json", "assets/js/data.js", "assets/js/admin-home.js", "assets/js/admin-pack.js", "assets/js/admin-theme.js"]
HANDLED = set(STALE) | {"shared-files.json", "scripts/make-template.py", "scripts/pagebuilder.js", "assets/data/admin-help.json", "platform/docs/changelog.md", "admin.html", "assets/js/admin-pb.js"}
un = set(sh("git", "diff", "--name-only", "--diff-filter=U").split())
if un - HANDLED: sys.exit("تعارض غير متوقَّع (يحتاج قراراً بشرياً): " + ", ".join(sorted(un - HANDLED)))
# تحقق أن الفرع لم يعدّل ملفات (1) بعد الالتزام c83b9174 (وإلا لا تُؤخذ نسخة main كاملةً)
for f in STALE:
    own = [c for c in sh("git", "log", "--format=%h", f"{BASE}..ORIG_HEAD" if False else f"{BASE}..HEAD", "--", f).split() if not c.startswith("c83b9174")]
    if own: sys.exit(f"{f}: عدّله التزام آخر غير c83b9174 ({own}) — راجع يدوياً")
for f in STALE: sh("git", "checkout", "origin/main", "--", f, check=True)
# (2)
base, main, br = (json.loads(show(r, "shared-files.json")) for r in (BASE, "origin/main", "HEAD"))
for x in (x for x in main["shared"] if x not in base["shared"]):
    if x not in br["shared"]: br["shared"].append(x)
open("shared-files.json", "w", encoding="utf-8").write(json.dumps(br, ensure_ascii=False, indent=2) + "\n")
# (3)
t = open("scripts/make-template.py", encoding="utf-8").read()
t = re.sub(r"<<<<<<< [^\n]*\n(.*?)=======\n.*?>>>>>>> [^\n]*\n", r"\1", t, flags=re.S)
a = 'bad = [r"SELLER:\\s*true",'
if a not in t: sys.exit("make-template.py: لم أجد قائمة bad داخل _leak_scan")
if "ruqya_(?:book" not in t: t = t.replace(a, 'bad = [r"ruqya_(?:book|lookup|taken)|ruqya_bookings|admin-ruqya|tab-ruqya", r"SELLER:\\s*true",', 1)
open("scripts/make-template.py", "w", encoding="utf-8").write(t)
# (4)
p = open("scripts/pagebuilder.js", encoding="utf-8").read()
m = re.search(r"<<<<<<< [^\n]*\n(.*?)=======\n.*?>>>>>>> [^\n]*\n", p, flags=re.S)
if m:
    h = m.group(1)
    h = h.replace("v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:", "nod=el.hasAttribute('data-nod'),v={d:Math.floor(s/86400),h:nod?Math.floor(s/3600):Math.floor(s%86400/3600),m:", 1)
    h = h.replace("if(b)b.textContent=('0'+v[k]).slice(-2)}})}", "if(b){var tx=String(v[k]);b.textContent=tx.length<2?'0'+tx:tx}}})}", 1)
    if "nod=el.hasAttribute" not in h or "tx.length<2" not in h: sys.exit("pagebuilder.js: تعذّر نقل تعديل tick من main")
    p = p[:m.start()] + h + p[m.end():]; open("scripts/pagebuilder.js", "w", encoding="utf-8").write(p)
# (5)
mh = json.loads(show("origin/main", "assets/data/admin-help.json")); hh = json.loads(show("HEAD", "assets/data/admin-help.json")); ids = {x["id"] for x in mh}
raw = show("origin/main", "assets/data/admin-help.json")
open("assets/data/admin-help.json", "w", encoding="utf-8").write(json.dumps(mh + [x for x in hh if x["id"] not in ids], ensure_ascii=False, indent=2) + ("\n" if raw.endswith("\n") else ""))
c = open("platform/docs/changelog.md", encoding="utf-8").read()
r = re.search(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", c, flags=re.S)
if r: c = c[:r.start()] + r.group(2) + r.group(1) + c[r.end():]; open("platform/docs/changelog.md", "w", encoding="utf-8").write(c)
# (6)
sh("git", "checkout", "origin/main", "--", "admin.html", "assets/js/admin-pb.js", check=True)
print(sh("python3", "scripts/build-admin-pb.py").strip())
left = [f for f in HANDLED if "<<<<<<<" in open(f, encoding="utf-8", errors="ignore").read()]
if left: sys.exit("بقيت علامات تعارض في: " + ", ".join(left))
sh("git", "add", "-A")
print("تم الحلّ. راجع: git diff --stat origin/main  (يجب أن يقتصر على أدوات القوالب/الاختبارات/المطوّر/التوثيق) ثم اختبر قبل git commit.")
