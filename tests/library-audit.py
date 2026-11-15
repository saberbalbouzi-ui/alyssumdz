#!/usr/bin/env python3
"""مراجعة سلامة مكتبة القوالب بعد الدفعات الأربع (ثابتة، بلا متصفح): python3 tests/library-audit.py [أصل=c83b917]
(1) النطاق: لا قالب خارج الدفعات تغيّر (ومنها s-alyssum) والفهرس بالمعرّفات والترتيب نفسهما (2) سلامة الفهرس: حقول، تفرّد، نوع/تصنيف، نصوص بلا مصطلحات تقنية ممنوعة
(3) الملفات: JSON، أقسام، معاينتان، جلد صفحة المنتج لكل متجر (4) داخل الصفحة: معرّفات العناصر فريدة، كل صورة موجودة، لا عنصر HTML/كود (5) تمايز المعاينات: بصمة بصرية لكل قالب وأقرب زوج"""
import json, os, re, subprocess, sys, collections
from PIL import Image
ORIG = sys.argv[1] if len(sys.argv) > 1 else "c83b917"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
T = "assets/pages/templates"
res = []; rows = []
def check(t, n, c, x=""): res.append(c); print(("PASS " if c else "FAIL ") + f"[{t}] {n}" + (f"  — {x}" if x else ""))
def git(p): return subprocess.run(["git", "show", f"{ORIG}:{p}"], capture_output=True).stdout
BATCH = {"s-watches", "s-tech", "s-jewelry", "s-cosmetics", "s-honey", "s-herbs", "s-fashion", "s-supplements", "s-accessories", "s-it", "s-digital", "s-marketplace", "s-aurora", "s-gold", "s-fresh", "s-pop",
         "c-aurora", "c-neon", "c-gold", "c-soft", "c-steps", "o-flash", "o-lux", "o-steps", "o-bundle", "o-proof"}
idx = json.load(open(f"{T}/index.json", encoding="utf-8")); oidx = json.loads(git(f"{T}/index.json"))
ids = [x["id"] for x in idx]
# 1) النطاق
changed = subprocess.run(["git", "diff", "--name-only", ORIG, "--", T], capture_output=True, text=True).stdout.split()
def tid(f):
    b = os.path.basename(f)[:-5] if f.endswith(".json") else None
    return b[5:] if b and b.startswith("prod-") else b
touched = {tid(f) for f in changed if f.endswith(".json") and not f.endswith("index.json")}
check("scope", "لا قالب خارج الدفعات الأربع تغيّر ملفه أو جلد منتجه", touched <= BATCH, sorted(touched - BATCH))
check("scope", "s-alyssum وملفاته (قالب وجلد منتج) غير ممسوسة", not any("alyssum" in f for f in changed), [f for f in changed if "alyssum" in f])
thumbs_changed = {os.path.basename(f).replace("-full", "")[:-4] for f in changed if "/thumbs/" in f}
check("scope", "لا معاينة مصغّرة خارج الدفعات تغيّرت", thumbs_changed <= BATCH, sorted(thumbs_changed - BATCH))
check("scope", "الفهرس بالمعرّفات والترتيب نفسهما (33)", ids == [x["id"] for x in oidx], len(ids))
od = {x["id"]: x for x in oidx}
diff_other = [x["id"] for x in idx if x["id"] not in BATCH and x != od[x["id"]]]
check("scope", "مداخل الفهرس خارج الدفعات متطابقة مع الأصل", not diff_other, diff_other)
chg_fields = collections.Counter(k for x in idx if x["id"] in BATCH for k in x if x[k] != od[x["id"]].get(k))
check("scope", "تغيّر في مداخل الدفعات وصف القالب فقط (لا معرّف/تصنيف/ميدان/اسم)", set(chg_fields) <= {"d"}, dict(chg_fields))
# 2) الفهرس
FORB = re.compile(r"github|supabase|php|cloudflare|gemini|openai|anthropic|claude|photoroom|فوتوروم|\.json|assets/|http", re.I)
need = {"id", "cat", "fld", "n", "d", "kind"}
check("index", "معرّفات فريدة", len(set(ids)) == len(ids))
for x in idx:
    t = x["id"]; ok = need <= set(x) and all(str(x[k]).strip() for k in need)
    check(t, "حقول الفهرس مكتملة", ok, sorted(need - set(x)))
    check(t, "نوع/تصنيف متسق (store→page وغيره→sec)", (x["cat"] == "store") == (x["kind"] == "page") and x["cat"] in ("store", "contact", "order"), f'{x["cat"]}/{x["kind"]}')
    check(t, "اسم/وصف بلا مصطلحات تقنية ممنوعة وبطول معقول", not FORB.search(x["n"] + " " + x["d"]) and 8 <= len(x["d"]) <= 330, len(x["d"]))
# 3) و4) الملفات والمحتوى
SKIP = {"src", "img", "bgImg", "link", "id", "tpl", "fxs", "css", "icon", "micon", "anim", "ff", "bg", "slug", "dest", "url", "phone", "email", "aid", "kind", "type"}
sigs = {}
def aHash(p):
    im = Image.open(p).convert("L").resize((16, 16)); px = list(im.getdata()); m = sum(px) / len(px); return [1 if v > m else 0 for v in px]
for x in idx:
    t = x["id"]; fp = f"{T}/{t}.json"
    try: pg = json.load(open(fp, encoding="utf-8"))
    except Exception as e: check(t, "JSON صالح", False, e); continue
    secs = pg.get("sections", []); check(t, "أقسام غير فارغة", len(secs) > 0, len(secs))
    ids_seen = collections.Counter(); imgs = set(); types = collections.Counter(); strs = []
    def walk(n, k=None):
        if isinstance(n, dict):
            if "id" in n and isinstance(n["id"], str): ids_seen[n["id"]] += 1
            if n.get("type"): types[n["type"]] += 1
            for kk, v in n.items():
                if kk in ("src", "img", "bgImg", "i") and isinstance(v, str) and v.startswith("assets/img/"): imgs.add(v)
                if kk in SKIP and kk not in ("src", "img", "bgImg", "i"): continue
                walk(v, kk)
        elif isinstance(n, list):
            for v in n: walk(v, k)
        elif isinstance(n, str) and k not in SKIP and not n.startswith("assets/img/") and re.search(r"[A-Za-z؀-ۿ]", n): strs.append(n)
    walk(secs); walk(pg.get("demo", []))
    dup = [i for i, c in ids_seen.items() if c > 1]
    check(t, "معرّفات العناصر فريدة داخل الصفحة", not dup, dup[:3])
    miss = [i for i in imgs if not os.path.exists(i)]
    check(t, f"كل الصور المشار إليها موجودة ({len(imgs)})", not miss, miss[:3])
    bad = types.keys() & {"html", "code", "embed", "customcss"}
    if t == "s-alyssum": print(f"NOTE [s-alyssum] قالب المتجر الأصلي خارج النطاق ولم يُمسّ: يحوي {sorted(bad)} ورقم واتساب حقيقياً في نصوصه (قائم في الأصل)")
    else: check(t, "لا عنصر HTML/كود مخصص", not bad, sorted(bad))
    leak = [s[:50] for s in strs if FORB.search(re.sub(r"<[^>]+>", "", s))]
    if t != "s-alyssum": check(t, "نصوص الصفحة بلا مصطلحات تقنية ممنوعة (GitHub/Supabase/PHP/مسارات/مزوّدو ذكاء)", not leak, leak[:2])
    th, tf = f"{T}/thumbs/{t}.jpg", f"{T}/thumbs/{t}-full.jpg"
    check(t, "المعاينتان (مصغّرة + كاملة) موجودتان وغير فارغتين", os.path.exists(th) and os.path.exists(tf) and os.path.getsize(th) > 3000 and os.path.getsize(tf) > 3000)
    if x["cat"] == "store" and t != "s-alyssum": check(t, "جلد صفحة المنتج prod-<id>.json موجود", os.path.exists(f"{T}/prod-{t}.json"))
    if os.path.exists(th): sigs[t] = aHash(th)
    rows.append((t, x["cat"], len(secs), sum(types.values()), len(imgs), t in BATCH))
# 5) تمايز المعاينات
names = sorted(sigs); mind = []
for i, a in enumerate(names):
    for b in names[i + 1:]:
        if idx[ids.index(a)]["cat"] != idx[ids.index(b)]["cat"]: continue
        mind.append((sum(p != q for p, q in zip(sigs[a], sigs[b])), a, b))
mind.sort(); print("\nأقرب الأزواج بصرياً (مسافة بصمة 0..256):", mind[:5])
check("distinct", "لا معاينتان متطابقتان تقريباً (مسافة ≥ 20 لأقرب زوج من النوع نفسه)", not mind or mind[0][0] >= 20, mind[:2])
print("\n| القالب | النوع | أقسام | عناصر | صور | ضمن الدفعات |\n|---|---|---|---|---|---|")
for r in rows: print("| %s | %s | %d | %d | %d | %s |" % (r[0], r[1], r[2], r[3], r[4], "✓" if r[5] else "—"))
bad = res.count(False); print(f"\n{len(res) - bad}/{len(res)} PASS — {bad} FAILURES"); sys.exit(1 if bad else 0)
