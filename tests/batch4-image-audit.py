#!/usr/bin/env python3
"""تدقيق صور أقسام الاتصال والطلب (الدفعة 4) مقابل الأصل: python3 tests/batch4-image-audit.py [أصل=c83b917]
(1) كل صورة أصلية ما زالت مُستعملة (2) لا تتجاوز مراجعها عدد مراجع الأصل (3) لا صور خارج الأصل (4) نسبة إطار الصورة الافتراضية = نسبتها الطبيعية
(5) ملفات الصور متطابقة بايتاً مع الأصل (6) لا عنصر html/كود مخصص (7) المكوّن الوظيفي الأصلي (contact/orderorig) محفوظ بكل حقوله الأصلية"""
import json, subprocess, sys, os, collections, re
from PIL import Image
ORIG = sys.argv[1] if len(sys.argv) > 1 else "c83b917"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
IDS = "c-aurora c-neon c-gold c-soft c-steps o-flash o-lux o-steps o-bundle o-proof".split()
res = []
def check(t, n, c, x=""): res.append(c); print(("PASS " if c else "FAIL ") + f"[{t}] {n}" + (f"  — {x}" if x else ""))
def git(p): return subprocess.run(["git", "show", f"{ORIG}:{p}"], capture_output=True).stdout
def nm(v): return v.split("/")[-1][:-5] if isinstance(v, str) and v.startswith("assets/img/tpl/") else None
def walk(pg):
    imgs = collections.Counter(); wid = []
    def w(n):
        if isinstance(n, dict):
            if n.get("type"):
                st = n["set"]; wid.append(n)
                for k in ("src", "img", "bgImg"):
                    if nm(st.get(k)): imgs[nm(st[k])] += 1
                for it in st.get("items", []) if n["type"] == "shopcats" else []:
                    if nm(it.get("img")): imgs[nm(it["img"])] += 1
            elif nm(n.get("bgImg") or (n.get("set") or {}).get("bgImg")): imgs[nm(n.get("bgImg") or n["set"]["bgImg"])] += 1
            for k in ("cols", "widgets", "free", "sections"):
                for x in n.get(k, []): w(x)
        elif isinstance(n, list):
            for x in n: w(x)
    w(pg.get("sections", [])); return imgs, wid
for t in IDS:
    o = json.loads(git(f"assets/pages/templates/{t}.json")); n = json.load(open(f"assets/pages/templates/{t}.json", encoding="utf-8"))
    oi, ow = walk(o); ni, nw = walk(n)
    check(t, "كل صورة أصلية ما زالت مُستعملة", all(ni[k] >= 1 for k in oi), dict(ni))
    check(t, "لا صورة تتكرر أكثر من عدد مراجعها في الأصل", all(ni[k] <= oi[k] for k in ni), f"orig={dict(oi)}")
    check(t, "لا صور خارج الأصل", set(ni) <= set(oi), sorted(set(ni) - set(oi)))
    ok = True; det = []
    for x in nw:
        if x["type"] == "image" and nm(x["set"].get("src")):
            f = nm(x["set"]["src"]); im = Image.open(f"assets/img/tpl/{f}.webp")
            fx = next((e for e in x["set"].get("fxs", []) if "r" in e.get("p", {})), None)
            if fx:
                r = fx["p"]["r"]["v"]; a, b = r.split("/"); good = abs(float(a) / float(b) - im.size[0] / im.size[1]) < .005; ok &= good; det.append(f"{f}:{r}~{im.size[0]}/{im.size[1]}")
    check(t, "نسبة إطار الصورة الافتراضية = الطبيعية (وسيط قابل للتعديل)", ok, det)
    same = all(open(f"assets/img/tpl/{f}.webp", "rb").read() == git(f"assets/img/tpl/{f}.webp") for f in ni)
    check(t, "ملفات الصور متطابقة بايتاً مع الأصل", same)
    types = {x["type"] for x in nw}
    check(t, "لا عنصر html/كود مخصص", not (types & {"html", "code", "embed", "customcss"}), sorted(types))
    for ty in ("contact", "orderorig"):
        if any(x["type"] == ty for x in ow):
            o_s = next(x for x in ow if x["type"] == ty)["set"]; n_s = next((x for x in nw if x["type"] == ty), None)
            check(t, f"المكوّن الوظيفي الأصلي ({ty}) محفوظ", n_s is not None)
            if ty == "contact" and n_s:
                of = [f["label"] for f in o_s.get("fields", [])]; nf = [f["label"] for f in n_s["set"].get("fields", [])]
                check(t, "حقول النموذج الأصلية الأربعة (اسم/هاتف/بريد/رسالة) محفوظة ومعها حقول مضافة", all(any(l.split(" (")[0] in x for x in nf) for l in of), nf)
                check(t, "الوجهة الافتراضية واتساب والتحقق من الهاتف الجزائري مفعّلان (لم تُغيَّر)", n_s["set"].get("dest", "whatsapp") == "whatsapp" and n_s["set"].get("dzPhone", True) is not False)
            if ty == "orderorig" and n_s:
                check(t, "نموذج الطلب الأصلي لم يُقيَّد (لا تعطيل لعروض/توصيل/كوبون/واتساب)", all(n_s["set"].get(k, True) is not False for k in ("fcm", "fgp", "fdt", "fcp", "fwa", "fnt", "fof", "fbt")))
bad = res.count(False); print(f"\n{len(res) - bad}/{len(res)} PASS — {bad} FAILURES"); sys.exit(1 if bad else 0)
