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
NXSET = {i for i in ids if i.startswith(("s-nexus", "p-nexus"))}      # NEXUS COMMERCE: قوالب جديدة (ليست في الأصل) تُفحص في قسم «nexus» أدناه
# 1) النطاق
changed = subprocess.run(["git", "diff", "--name-only", ORIG, "--", T], capture_output=True, text=True).stdout.split()
def tid(f):
    b = os.path.basename(f)[:-5] if f.endswith(".json") else None
    return b[5:] if b and b.startswith("prod-") else b
touched = {tid(f) for f in changed if f.endswith(".json") and not f.endswith("index.json")} - NXSET
# مرحلة إغلاق القبول: التعطيل الافتراضي للعدّ التنازلي/كود الخصم/نسب الكمية المباعة + مخزون من بيانات حقيقية + علم «محتوى نموذجي» + إزالة عبارات الموعد المرتبطة بالعدّاد
# يطال كل القوالب (ومنها الستة خارج الدفعات). يُقارَن الملف بالأصل بعد تسوية هذه الحقول فقط: أي فرق آخر خارج الدفعات يبقى إخفاقاً.
PH5_TEXT = {"عرض الاستوديو — الليلة فقط": "عرض الاستوديو", "استعملي الكود قبل منتصف الليل.": "استعملي كود الخصم عند الطلب."}
def norm5(o):
    if isinstance(o, dict):
        if o.get("type") == "testimonial" or (o.get("type") == "image" and "placeholder/review.svg" in str((o.get("set") or {}).get("src", ""))): return {"type": "review"}      # الآراء صور لقطات (طلب صاحب المتجر): لا فرق في النطاق
        t = o.get("type"); st = o.get("set") if isinstance(o.get("set"), dict) else None
        if st is not None and t == "countdown": st = {k: v for k, v in st.items() if k not in ("on", "mode", "end")}
        elif st is not None and t == "coupon": st = {k: v for k, v in st.items() if k not in ("on", "cpcode")}
        elif st is not None and t == "stock": st = {k: v for k, v in st.items() if k != "smode"}
        elif st is not None and t == "progress" and "بيع" in str(st.get("pl", "")): st = {k: v for k, v in st.items() if k != "on"}
        r = {k: norm5(v) for k, v in o.items() if k != "sample"}
        if st is not None: r["set"] = norm5(st)
        return r
    if isinstance(o, list): return [norm5(x) for x in o if not (isinstance(x, dict) and x.get("id") == "anchprod")]      # مرساة #products المضافة للقوالب الستة بموافقة صاحب المتجر (معرّف ثابت لا يزحزح بقية المعرّفات)
    if isinstance(o, str):
        for a_, b_ in PH5_TEXT.items(): o = o.replace(a_, b_)
        return o
    return o
def same5(f):
    try: return norm5(json.loads(git(f))) == norm5(json.load(open(f, encoding="utf-8")))
    except Exception: return False
bad_scope = sorted(t for t in (touched - BATCH) if not all(same5(f) for f in changed if f.endswith(".json") and tid(f) == t))
check("scope", "لا قالب خارج الدفعات الأربع تغيّر ملفه أو جلد منتجه (عدا تسوية حقول مرحلة القبول: عدّاد/كود/كمية/مخزون/علم نموذجي)", not bad_scope, bad_scope)
# ── التنويع بعد قبول القوالب: تبقى العناصر التسويقية بأعدادها وتتفرّد الأرقام والأسماء وتتنوّع كتل النهاية ──
BASE_OK = "4ef7fe63"      # الالتزام المقبول قبل مرحلة التنويع
def _vw(n, out):
    for k in ("cols", "widgets", "free"):
        for c in n.get(k, []) or []:
            if k == "cols": _vw(c, out)
            else: out.append(c)
    return out
def _wt(w):      # الآراء صور لقطات يضعها الزبون (placeholder/review.svg): تُعدّ آراءً كما كانت قبل التحويل
    return "testimonial" if w["type"] == "image" and "placeholder/review.svg" in str((w.get("set") or {}).get("src", "")) else w["type"]
def _wcount(pg):
    ws = [w for sc in pg.get("sections", []) for w in _vw(sc, [])]; return collections.Counter(_wt(w) for w in ws)
lost = {}; names = collections.Counter(); gen_stats = []; orders = set(); fem_img = []
for it in idx:
    if it.get("kind") != "page" or it["id"] not in BATCH: continue      # الستة خارج الدفعات استثناء محدود لا يُنوَّع
    pg = json.load(open(f"{T}/{it['id']}.json", encoding="utf-8"))
    try: old = json.loads(subprocess.run(["git", "show", f"{BASE_OK}:{T}/{it['id']}.json"], capture_output=True, check=True).stdout)
    except Exception: old = None
    if old is not None:
        a_, b_ = _wcount(old), _wcount(pg); d_ = {k: (a_[k], b_[k]) for k in ("counter", "testimonial", "accordion", "iconbox", "heading", "text", "image", "button", "products") if b_[k] < a_[k]}
        if d_: lost[it["id"]] = d_
    seq = ""
    for sc in pg["sections"]:
        ws = _vw(sc, []); ty = [_wt(w) for w in ws]
        if ty.count("counter") >= 3 and len(sc.get("cols", [])) >= 3 and not ty.count("testimonial"):
            vals = [(w["set"].get("n"), w["set"].get("pre", ""), w["set"].get("suf", "")) for w in ws if w["type"] == "counter"]
            if vals == [(12000, "+", ""), (58, "", ""), (98, "", "%"), (24, "", "h")]: gen_stats.append(it["id"])
            seq += "S"
        elif ty.count("testimonial") >= 3:
            seq += "T"
            for w in ws:
                if w["type"] == "testimonial":      # (قبل التحويل إلى صور فقط)
                    names[w["set"].get("name")] += 1
                    if re.match(r"^(سارة|ليلى|مريم|إيمان|نادية|هناء|آسيا|سمية|فاطمة|خديجة|ريم|نسرين|وفاء|سلمى|أميرة|جيهان|حنان|سهام|لمياء|شيماء)\b", w["set"].get("name", "")) and w["set"].get("img"): fem_img.append(it["id"])
        elif "coupon" in ty: seq += "P"
        elif "accordion" in ty and "sfoot" not in ty: seq += "F"
    orders.add(seq[-4:])
lost.pop("s-marketplace", None) if lost.get("s-marketplace") == {"text": (10, 9)} else None      # مقصود: حُذف نص «ينتهي العرض خلال» اليتيم بعد تعطيل العدّاد (مرحلة القبول)
check("variety", "العناصر التسويقية والتصميمية لا تنقص عن الأساس المقبول (عدّادات/آراء/أسئلة/بطاقات/عناوين/نصوص/صور/أزرار/منتجات) عدا نص «ينتهي العرض خلال» اليتيم في s-marketplace", not lost, lost)
check("variety", "لا اسم رأي يتكرر بين القوالب", not [n for n, c in names.items() if c > 1], [n for n, c in names.items() if c > 1])
check("variety", "مجموعة الأرقام المتطابقة (12000/58/98/24) لم تعد تتكرر", len(gen_stats) == 0, gen_stats)
check("variety", "ترتيب كتل النهاية يتنوّع بين القوالب (4 أنماط على الأقل)", len(orders) >= 4, sorted(orders))
check("variety", "لا صورة رجل تُعرض مع اسم أنثوي", not fem_img, fem_img)
check("scope", "s-alyssum وملفاته (قالب وجلد وصور وCSS) غير ممسوسة (الفهرس فقط يحمل علم owner)", not any("alyssum" in f and not f.endswith("index.json") for f in changed), [f for f in changed if "alyssum" in f])
thumbs_changed = {os.path.basename(f).replace("-full", "")[:-4] for f in changed if "/thumbs/" in f} - NXSET
P5_OK = (touched - BATCH) - set(bad_scope)      # قوالب خارج الدفعات عُدّلت بحقول مرحلة القبول فقط ⟵ أُعيدت معاينتاها
check("scope", "لا معاينة مصغّرة خارج الدفعات تغيّرت (عدا قوالب مرحلة القبول المسوّاة)", thumbs_changed <= (BATCH | P5_OK), sorted(thumbs_changed - BATCH - P5_OK))
check("scope", "الفهرس القديم بالمعرّفات والترتيب نفسهما (33) — القوالب الجديدة NEXUS تُضاف في المقدّمة فقط", [i for i in ids if i not in NXSET] == [x["id"] for x in oidx] and ids[:len(NXSET)] == [i for i in ids if i in NXSET], len(ids))
od = {x["id"]: x for x in oidx}
diff_other = [x["id"] for x in idx if x["id"] not in BATCH and x["id"] not in NXSET and {k: v for k, v in x.items() if k != "owner"} != od[x["id"]]]
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
    check(t, "نوع/تصنيف متسق (store→page وغيره→sec)", (x["cat"] == "store") == (x["kind"] == "page") and x["cat"] in ("store", "contact", "order", "page"), f'{x["cat"]}/{x["kind"]}')
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
# 4ب) لا أثر لهوية البائع في أي قالب يصل العميل (كل الملفات خارج owner_only، بما فيها جلود المنتجات والفهرس)
own = json.load(open("shared-files.json", encoding="utf-8")).get("owner_only", {}); own_ids = set(own.get("template_ids", [])); own_files = {os.path.basename(f) for f in own.get("files", [])}
OWNER_RE = re.compile(r"0559|237239|alyssumdz|saberbalbouzi|ALYSSUM|أليسوم|alyssum", re.I)
leak = []
for f in sorted(os.listdir(T)):
    if f in own_files or not f.endswith((".json", ".css")): continue
    txt = open(f"{T}/{f}", encoding="utf-8").read()
    if f == "index.json":
        txt = json.dumps([x for x in json.loads(txt) if x["id"] not in own_ids], ensure_ascii=False)
    for m in OWNER_RE.finditer(txt): leak.append(f"{f}: …{txt[max(0, m.start() - 20):m.end() + 20]}…")
check("owner", "لا أثر لهوية البائع (اسم/رقم/حساب) في أي ملف قالب يصل العميل", not leak, leak[:3])
check("owner", "قوالب البائع مسجَّلة owner_only وغير مدرجة في القائمة المشتركة", all(f not in set(json.load(open("shared-files.json", encoding="utf-8"))["shared"]) for f in own.get("files", [])) and {"s-alyssum", "p-focus-honey"} <= own_ids)
# 5) تمايز المعاينات
names = sorted(sigs); mind = []
for i, a in enumerate(names):
    for b in names[i + 1:]:
        if idx[ids.index(a)]["cat"] != idx[ids.index(b)]["cat"]: continue
        if {a, b} <= {"p-nexus-privacy", "p-nexus-terms", "p-nexus-returns"}: continue      # صفحات نصية قانونية بتخطيط قراءة واحد مقصود
        mind.append((sum(p != q for p, q in zip(sigs[a], sigs[b])), a, b))
mind.sort(); print("\nأقرب الأزواج بصرياً (مسافة بصمة 0..256):", mind[:5])
check("distinct", "لا معاينتان متطابقتان تقريباً (مسافة ≥ 20 لأقرب زوج من النوع نفسه)", not mind or mind[0][0] >= 20, mind[:2])
print("\n| القالب | النوع | أقسام | عناصر | صور | ضمن الدفعات |\n|---|---|---|---|---|---|")
for r in rows: print("| %s | %s | %d | %d | %d | %s |" % (r[0], r[1], r[2], r[3], r[4], "✓" if r[5] else "—"))
bad = res.count(False); print(f"\n{len(res) - bad}/{len(res)} PASS — {bad} FAILURES"); sys.exit(1 if bad else 0)
