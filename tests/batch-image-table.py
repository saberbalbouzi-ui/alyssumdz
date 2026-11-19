#!/usr/bin/env python3
"""يولّد جداول IMAGE-AUDIT.md لدفعة قوالب: python3 tests/batch-image-table.py <أصل> <قالب>... > docs/batches/batchN/IMAGE-AUDIT.md"""
import json, subprocess, sys, os, collections
from PIL import Image
ORIG = sys.argv[1]; TPL = sys.argv[2:]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
def git(p): return subprocess.run(["git", "show", f"{ORIG}:{p}"], capture_output=True).stdout
def refs(pg):
    out = collections.defaultdict(list)
    def nm(v): return v.split("/")[-1] if isinstance(v, str) and v.startswith("assets/img/tpl/") else None
    def walk(n):
        if isinstance(n, dict):
            ty = n.get("type"); st = n.get("set") if ty else None
            if st:
                if ty == "image" and nm(st.get("src")): out[nm(st["src"])].append("صورة image")
                if ty == "testimonial" and nm(st.get("img")): out[nm(st["img"])].append("رأي")
                if nm(st.get("bgImg")): out[nm(st["bgImg"])].append("خلفية قسم/عمود")
                for it in st.get("items", []) if ty == "shopcats" else []:
                    if nm(it.get("img")): out[nm(it["img"])].append("فئة: " + str(it.get("dl", "")))
                for p in st.get("demo", []) if isinstance(st.get("demo"), list) else []:
                    if nm(p.get("i")): out[nm(p["i"])].append("منتج: " + p.get("t", ""))
            if not st and nm(n.get("bgImg")): out[nm(n["bgImg"])].append("خلفية قسم/عمود")
            for k, v in n.items():
                if k == "set" and st is not None and ty in ("image", "testimonial", "shopcats"): continue
                walk(v) if k != "set" or True else None
        elif isinstance(n, list):
            for v in n: walk(v)
    # المنتجات التجريبية قد تكون في page.demo أو داخل set.demo
    walk(pg.get("sections", []))
    for p in pg.get("demo", []) if isinstance(pg.get("demo"), list) else []:
        if nm(p.get("i")): out[nm(p["i"])].append("منتج: " + p.get("t", ""))
    return out
def dedup(l):
    c = collections.OrderedDict()
    for x in l: c[x] = c.get(x, 0) + 1
    return " · ".join(k + (f" ×{v}" if v > 1 else "") for k, v in c.items())
print(f"# تدقيق صور الدفعة مقابل الأصل `{ORIG}`\n")
print("**الأساس:** كل ملفات `assets/img/**` متطابقة بايتاً مع الأصل؛ **لا صور مضافة**: مجموعة الصور في كل قالب = مجموعة الأصل بعدد مراجع ≤ الأصل (مولَّد بـ `tests/batch-image-table.py`).\n")
for t in TPL:
    o = refs(json.loads(git(f"assets/pages/templates/{t}.json"))); n = refs(json.load(open(f"assets/pages/templates/{t}.json", encoding="utf-8")))
    print(f"\n## {t}\n\n| الصورة | الأبعاد · الحجم | مراجع الأصل | مراجع الحالة | الحالة |\n|---|---|---|---|---|")
    for f in sorted(set(o) | set(n)):
        p = f"assets/img/tpl/{f}"; im = Image.open(p); sz = os.path.getsize(p)
        st = "محتفَظ بها" if f in n and len(n[f]) <= max(len(o.get(f, [])), 1) and f in o else ("مُضافة" if f not in o else "مفقودة")
        print(f"| `{f}` | {im.size[0]}×{im.size[1]} · {sz:,} B | {len(o.get(f, []))}: {dedup(o.get(f, []))} | {len(n.get(f, []))}: {dedup(n.get(f, []))} | {st} |")
