#!/usr/bin/env python3
"""تدقيق صور قوالب الدفعات مقابل الأصل (ثابت، بلا متصفح):
   python3 tests/batch-image-audit.py <أصل> id1 id2 ...      مثال: python3 tests/batch-image-audit.py c83b917 s-jewelry s-honey
للقالب الواحد يتحقق من: (1) كل صورة أصلية ما زالت مُستعملة وبعدد مراجع ≤ الأصل (لا تكرار فوق الأصل) (2) لا صور خارج الأصل (الإضافات تحتاج موافقة)
(3) المنتجات التجريبية الأصلية (اسم/سعر/قديم/صورة/تصنيف) وبلاطات الفئات الأصلية (صورة + عنوان + ترتيب) محفوظة
(4) إطارات الصور ذات «نسبة الإطار» افتراضها نسبة الصورة الطبيعية ونقطة التركيز 50% 50%  (5) ملفات الصور متطابقة بايتاً مع الأصل
المرجع: docs/pilots/IMAGE-AUDIT.md"""
import json, re, subprocess, sys, os, collections
from PIL import Image
ORIG = sys.argv[1]; IDS = sys.argv[2:]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
res = []
def check(t, n, c, x=""): res.append(c); print(("PASS " if c else "FAIL ") + f"[{t}] {n}" + (f"  — {x}" if x else ""))
def git(path): return subprocess.run(["git", "show", f"{ORIG}:{path}"], capture_output=True).stdout
def widgets(pg):
    out = []
    def walk(n):
        if isinstance(n, dict):
            if n.get("type") and "set" in n: out.append(n)
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(pg["sections"]); return out
def imgs(pg): return re.findall(r'assets/img/tpl/([a-z0-9_\-]+)\.webp', json.dumps(pg, ensure_ascii=False))
# إصلاحات بيانات معلنة وحيدة مسموحة لعناوين البلاطات (الصور وترتيبها كما هي): عناوين الأصل كانت مقلوبة
LABEL_FIX = {"s-watches": ["ساعات كلاسيكية", "ساعات جيب", "ساعات رياضية"], "s-accessories": ["إطلالات", "سماعات", "حقائب"]}
for t in IDS:
    o = json.loads(git(f"assets/pages/templates/{t}.json")); n = json.load(open(f"assets/pages/templates/{t}.json", encoding="utf-8"))
    co, cn = collections.Counter(imgs(o)), collections.Counter(imgs(n))
    miss = [k for k in co if k not in cn]; check(t, "كل صورة أصلية ما زالت مُستعملة", not miss, miss or f"{len(co)} صورة")
    more = {k: (cn[k], co[k]) for k in cn if k in co and cn[k] > co[k]}; check(t, "لا صورة تتكرر أكثر من عدد مراجعها في الأصل", not more, more or dict(cn))
    extra = [k for k in cn if k not in co]; check(t, "لا صور خارج الأصل (الإضافات تحتاج موافقة)", not extra, extra)
    ow, nw = widgets(o), widgets(n)
    # منتجات: كل عنصر أصلي موجود في ودجات المنتجات الجديدة (قد تتوزّع على أكثر من ودجت)
    op = [d for w in ow if w["type"] == "products" for d in w["set"].get("demo", [])]; npd = [d for w in nw if w["type"] == "products" for d in w["set"].get("demo", [])]
    lost = [d["t"] for d in op if not any(x["i"] == d["i"] and x["t"] == d["t"] and x["p"] == d["p"] and x["o"] == d["o"] and x["c"] == d["c"] for x in npd)]
    check(t, f"المنتجات التجريبية الأصلية ({len(op)}) محفوظة بالاسم والسعر والصورة", not lost, lost)
    dupn = [k for k, v in collections.Counter(d["i"] for d in npd).items() if v > 1]; check(t, "لا منتج تجريبي مكرّر", not dupn, dupn)
    oc = [w["set"]["items"] for w in ow if w["type"] == "shopcats"]; nc = [w["set"]["items"] for w in nw if w["type"] == "shopcats"]
    if t in LABEL_FIX: ok = bool(oc) and bool(nc) and [i["img"] for i in oc[0]] == [i["img"] for i in nc[0]] and [i.get("dl") for i in nc[0]] == LABEL_FIX[t]
    else: ok = bool(oc) and bool(nc) and [(i["img"], i.get("dl")) for i in oc[0]] == [(i["img"], i.get("dl")) for i in nc[0]]
    check(t, "بلاطات الفئات الأصلية (صورة + ترتيب + عنوان" + (" بعد إصلاح الخطأ المعلن" if t in LABEL_FIX else "") + ") محفوظة", ok, [(i["img"].split("/")[-1], i.get("dl")) for i in nc[0]] if nc else "لا قسم فئات")
    for w in nw:
        for fx in w["set"].get("fxs", []) if w["type"] == "image" else []:
            if fx["n"].startswith("إطار الصورة"):
                src = os.path.basename(w["set"]["src"]).replace(".webp", ""); W_, H_ = Image.open(f"assets/img/tpl/{src}.webp").size; a, b = [float(x) for x in fx["p"]["r"]["v"].split("/")]
                check(t, f"نسبة الإطار الافتراضية = نسبة {src} الطبيعية ({W_}/{H_})", abs(a / b - W_ / H_) / (W_ / H_) < .01, fx["p"]["r"]["v"])
                check(t, f"نقطة التركيز الافتراضية 50% 50% ({src})", fx["p"]["p"]["v"] == "50% 50%")
    for w in nw:
        if w["type"] == "products":
            fr = [fx for fx in w["set"].get("fxs", []) if fx["n"].startswith("نسبة صورة")]
            if fr: check(t, "نسبة صور بطاقات المنتجات 1:1 كالأصل", all(fx["p"]["r"]["v"] == "1/1" for fx in fr)); break
    same = all(git(f"assets/img/tpl/{k}.webp") == open(f"assets/img/tpl/{k}.webp", "rb").read() for k in cn)
    check(t, "ملفات الصور المستعملة متطابقة بايتاً مع الأصل", same)
f = res.count(False); print(f"\n{len(res)-f}/{len(res)} PASS" + (f" — {f} FAILURES" if f else " — 0 FAILURES")); sys.exit(1 if f else 0)
