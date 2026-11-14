#!/usr/bin/env python3
"""تدقيق صور تجربتي s-watches وs-tech مقابل الأصل (ثابت، بلا متصفح): python3 tests/pilot-image-audit.py [أصل=c83b917]
يتحقق من: (1) مراجع المنتجات والفئات الأصلية (2) النسب ونقاط التركيز الافتراضية (3) خلفية اللافتة الأصلية (4) عدم تكرار صورة أكثر مما في الأصل
(5) ملفات الصور متطابقة بايتاً مع الأصل. المرجع: docs/pilots/IMAGE-AUDIT.md"""
import json, re, subprocess, sys, io, os, collections
from PIL import Image
ORIG = sys.argv[1] if len(sys.argv) > 1 else "c83b917"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
res = []
def check(t, n, c, x=""):
    res.append(c); print(("PASS " if c else "FAIL ") + f"[{t}] {n}" + (f"  — {x}" if x else ""))
def git(path): return subprocess.run(["git", "show", f"{ORIG}:{path}"], capture_output=True).stdout
def load_orig(t): return json.loads(git(f"assets/pages/templates/{t}.json"))
def load_now(t): return json.load(open(f"assets/pages/templates/{t}.json", encoding="utf-8"))
def widgets(pg):
    out = []
    def walk(n, sec=None):
        if isinstance(n, dict):
            if n.get("type") and "set" in n: out.append(n)
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(pg["sections"]); return out
def imgs_in(pg):
    return re.findall(r'assets/img/tpl/([a-z0-9_\-]+)\.webp', json.dumps(pg, ensure_ascii=False))
def dims(n): return Image.open(f"assets/img/tpl/{n}.webp").size
ADDED = {"s-watches": {"men_watch", "men_suit"}, "s-tech": {"gad_vr", "gad_watch", "gad_vr2", "dig_code", "it_dark"}}
for t in ("s-watches", "s-tech"):
    o, n = load_orig(t), load_now(t); ow, nw = widgets(o), widgets(n)
    # 1) منتجات وبلاطات
    op = next(w for w in ow if w["type"] == "products")["set"]["demo"]; np_ = [d for w in nw if w["type"] == "products" for d in w["set"].get("demo", [])]
    for i, d in enumerate(op):
        m = next((x for x in np_ if x["i"] == d["i"]), None)
        check(t, f"منتج أصلي {i+1} موجود بصورته واسمه وسعره: {d['i'].split('/')[-1]}", bool(m) and m["t"] == d["t"] and m["p"] == d["p"] and m["o"] == d["o"])
    oc = next(w for w in ow if w["type"] == "shopcats")["set"]; ncs = [w for w in nw if w["type"] == "shopcats"]
    check(t, "قسم الفئات موجود", len(ncs) == 1)
    if ncs:
        c = ncs[0]["set"]
        check(t, "صور بلاطات الفئات الأصلية بترتيبها", [x["img"] for x in c["items"]] == [x["img"] for x in oc["items"]], [x["img"].split("/")[-1] for x in c["items"]])
        check(t, "نسبة البلاطات 1:1 كالأصل", c.get("ratio") == oc.get("ratio") == "1/1")
    # 2) النسب ونقاط التركيز الافتراضية
    fr = [(w, fx) for w in nw if w["type"] == "image" for fx in w["set"].get("fxs", []) if fx["n"].startswith("إطار الصورة")]
    for w, fx in fr:
        src = os.path.basename(w["set"]["src"]).replace(".webp", ""); W_, H_ = dims(src); r = fx["p"]["r"]["v"]; a, b = [float(x) for x in r.split("/")]
        check(t, f"نسبة الإطار الافتراضية = نسبة {src} الطبيعية ({W_}/{H_})", abs(a / b - W_ / H_) / (W_ / H_) < .01, r)
        check(t, f"نقطة التركيز الافتراضية للإطار 50% 50% ({src})", fx["p"]["p"]["v"] == "50% 50%")
    arch = [(w, fx) for w in nw if w["type"] == "image" for fx in w["set"].get("fxs", []) if fx["n"].startswith("قوس")]
    for w, fx in arch:
        src = os.path.basename(w["set"]["src"]).replace(".webp", ""); W_, H_ = dims(src); st = w["set"]
        fw, fh = st["fwd"]["d"] / 100 * 1100, st["fh"]["d"]
        check(t, f"قوس الهيرو: نسبة الإطار ≈ نسبة {src} الطبيعية ({W_}/{H_})", abs(fw / fh - W_ / H_) / (W_ / H_) < .03, f"{fw:.0f}/{fh}")
        check(t, "قوس الهيرو: تقريب افتراضي 1 ونقطة تركيز 50% 50% (بلا قص)", fx["p"]["z"]["v"] == 1 and fx["p"]["p"]["v"] == "50% 50%")
    pr = [fx for w in nw if w["type"] == "products" for fx in w["set"].get("fxs", []) if fx["n"].startswith("نسبة صورة")]
    check(t, "نسبة صور بطاقات المنتجات 1:1 كالأصل", pr and all(fx["p"]["r"]["v"] == "1/1" for fx in pr))
    # 3) اللافتة
    ob = [x["set"] for x in o["sections"] if "bgImg" in x["set"]]; nb = [x["set"] for x in n["sections"] if "bgImg" in x["set"]]
    if t == "s-watches":
        ob0, nb0 = ob[0], next(x for x in nb if x["bgImg"] == ob[0]["bgImg"])
        keys = ["bgImg", "bgSize", "bgPos", "grad1", "grad2", "gradAng", "bgFixed"]
        check(t, "خلفية اللافتة الأصلية (الصورة/الحجم/الموضع/التدرّج/bgFixed) كما هي", all(ob0.get(k) == nb0.get(k) for k in keys), {k: nb0.get(k) for k in keys})
    # 4) التكرار
    co, cn = collections.Counter(imgs_in(o)), collections.Counter(imgs_in(n))
    bad = {k: (cn[k], co.get(k, 0)) for k in cn if k in co and cn[k] > co[k]}
    check(t, "لا صورة أصلية تتكرر أكثر مما في الأصل", not bad, bad or dict(cn))
    bad2 = {k: v for k, v in cn.items() if k in ADDED[t] and v > 1}
    check(t, "الصور المضافة المعتمدة تظهر مرة واحدة", not bad2, bad2)
    unk = [k for k in cn if k not in co and k not in ADDED[t]]
    check(t, "لا صور خارج الأصل والإضافات المعتمدة", not unk, unk)
    # 5) الملفات
    same = all(git(f"assets/img/tpl/{k}.webp") == open(f"assets/img/tpl/{k}.webp", "rb").read() for k in cn)
    check(t, "ملفات كل الصور المستعملة متطابقة بايتاً مع الأصل", same)
f = res.count(False); print(f"\n{len(res)-f}/{len(res)} PASS" + (f" — {f} FAILURES" if f else " — 0 FAILURES")); sys.exit(1 if f else 0)
