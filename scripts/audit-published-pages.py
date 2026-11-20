#!/usr/bin/env python3
"""تدقيق للقراءة فقط: يكشف صفحات منشورة (من Page Builder) في متجر مثبَّت تحمل روابط فوتر نسبية خاطئة لمكانها (نُشرت قبل أن يحلّ عنصر الفوتر الروابط النسبية بـ ctx.base).
الاستعمال: python3 scripts/audit-published-pages.py <مجلد المتجر> [--json] [--fail]
 - الصفحات في عمق مستويين (lp/<slug>/ وp/<slug>/) يجب أن تبدأ روابطها النسبية إلى صفحات المتجر بـ ../../ ؛ أما الجذر (الرئيسية/المتجر/السلة/حسابي) فبلا بادئة.
 - لا يعدّل أي ملف ولا يلمس النصوص (القانونية وغيرها): إعادة النشر من المحرّر تعيد توليد الروابط وحدها من JSON الصفحة المحفوظ نفسه.
 - --fail يُنهي بكود 1 إن وُجدت صفحات متأثرة (للاستعمال الآلي)."""
import json, os, re, sys
root = next((a for a in sys.argv[1:] if not a.startswith("--")), None)
if not root or not os.path.isdir(root): sys.exit(__doc__)
STORE_PAGES = re.compile(r"^(index|shop|cart|account)\.html(?:[#?].*)?$|^assets/")
FOOT = re.compile(r"<footer[^>]*class=\"[^\"]*\bpb-sf\b[^\"]*\"[^>]*>(.*?)</footer>", re.S | re.I)
HREF = re.compile(r"<a\s[^>]*href=\"([^\"]*)\"", re.I)
EXTERNAL = re.compile(r"^([a-z][a-z0-9+.-]*:|/|#|\?)", re.I)
LEGAL = re.compile(r"privacy|terms|returns|conditions|legal|mentions|politique|cgv|cgu|retour|confidential", re.I)
def depth(rel):  # عدد المجلدات تحت الجذر لملف index.html
    return len(os.path.dirname(rel).split("/")) if os.path.dirname(rel) else 0
pages = []
for dp, dn, fn in os.walk(root):
    rel_dir = os.path.relpath(dp, root).replace("\\", "/")
    if rel_dir.split("/")[0] in ("api", "assets", "node_modules", ".git", "releases", "dist", "saas", "admin-preview", "platform", "scripts", "docs", "tests"): dn[:] = []; continue
    for f in fn:
        if f.endswith(".html"): pages.append(os.path.normpath(os.path.join(dp, f)))
affected, checked = [], 0
for p in sorted(pages):
    rel = os.path.relpath(p, root).replace("\\", "/")
    if rel.startswith("p/_template/"): continue
    try: html = open(p, encoding="utf-8", errors="replace").read()
    except OSError: continue
    m = FOOT.search(html)
    if not m: continue
    checked += 1
    d = depth(rel); want = "../" * d if os.path.basename(rel) == "index.html" else ""
    bad = []
    for h in HREF.findall(m.group(1)):
        if EXTERNAL.match(h): continue
        stripped = re.sub(r"^(\.\./)+", "", h); ups = (len(h) - len(stripped)) // 3
        if STORE_PAGES.match(stripped) and ups != d: bad.append({"href": h, "should_start_with": want or "(بلا بادئة)"})
    if bad: affected.append({"page": rel, "legal_text_page": bool(LEGAL.search(rel)), "links": bad})
out = {"checked_pages": checked, "affected_pages": len(affected), "affected": affected}
if "--json" in sys.argv: print(json.dumps(out, ensure_ascii=False, indent=1))
else:
    print(f"صفحات فيها فوتر Page Builder: {checked} — متأثرة بروابط خاطئة المكان: {len(affected)}")
    for a in affected:
        print(f"  • {a['page']}" + ("  (صفحة نصوص قانونية: لا تُعدَّل نصوصها؛ إعادة النشر تحدّث الروابط فقط)" if a["legal_text_page"] else ""))
        for l in a["links"]: print(f"      {l['href']}  ← يجب أن يبدأ بـ {l['should_start_with']}")
    if affected: print("\nالإصلاح: افتح كل صفحة من «صفحاتي» في لوحة التحكم ← «حفظ ونشر» (لا تغيّر أي نص).")
sys.exit(1 if (affected and "--fail" in sys.argv) else 0)
