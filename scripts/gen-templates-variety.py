# ═════════ تنويع الثلث الأخير والأرقام والأسماء بين قوالب المتاجر (مرحلة قبول القوالب — قرار صاحب المتجر) ═════════
# يُستدعى من reg() بعد توليد كل قالب متجر ويعمل على JSON الصفحة: لا يحذف ولا يفرّغ ولا يخفي عنصراً (عدّادات/آراء/عبارات تبقى بأعدادها وبقابليتها للتحرير)،
# وإنما: (1) أرقام وعناوين الإحصائيات خاصة بنوع المتجر بدل المجموعة المتطابقة (12000/58/98/24) (2) أسماء ومدن الآراء متفرّدة لكل قالب، وصورة الرأي
# للأسماء الذكورية فقط (لا صور أنثوية في المكتبة فتُترك صورة الاسم الأنثوي فارغة بدل صورة رجل) (3) ترتيب كتل النهاية (أرقام/آراء/عرض/أسئلة) يختلف بين القوالب
# (4) نمط عرض الأرقام (صف/بطاقات/فواصل). كله نصوص نموذجية قابلة للتعديل ويرصدها تنبيه «محتوى نموذجي».
import hashlib
STORE_ORDER = ["s-accessories", "s-aurora", "s-cosmetics", "s-digital", "s-fashion", "s-fresh", "s-gold", "s-herbs", "s-honey", "s-it", "s-jewelry", "s-kids", "s-makeup", "s-marketplace",
               "s-men", "s-perfume", "s-pop", "s-skincare", "s-supplements", "s-tech", "s-watches", "s-women"]
OUT_OF_BATCH = {"s-kids", "s-makeup", "s-men", "s-perfume", "s-skincare", "s-women"}      # الستة خارج الدفعات: استثناء محدود (حقول مرحلة القبول فقط) فلا تُنوَّع هنا إلا بموافقة صريحة
GENERIC_STATS = [(12000, "+", ""), (58, "", ""), (98, "", "%"), (24, "", "h")]
STATS_SET = {      # (الرقم، بادئة، لاحقة، العنوان) — نصوص نموذجية بحسب النوع
 "s-accessories": [(3400, "+", "", "قطعة بيعت"), (45, "", "", "موديل جديد كل شهر"), (7, "", " أيام", "للاستبدال"), (96, "", "%", "تقييم إيجابي")],
 "s-aurora": [(850, "+", "", "جهاز مُسلَّم"), (12, "", " شهراً", "ضمان على الأجهزة"), (48, "", "h", "لتجهيز الطلب"), (4, "", " ساعات", "متوسط ردّ الدعم")],
 "s-cosmetics": [(2600, "+", "", "روتين مُجهَّز"), (35, "", "", "منتجاً للعناية"), (15, "", " يوماً", "لتجربة المنتج"), (94, "", "%", "يكررن الطلب")],
 "s-fashion": [(5200, "+", "", "قطعة بيعت"), (120, "", "", "موديل في الموسم"), (7, "", " أيام", "للاستبدال"), (48, "", "h", "وقت الشحن")],
 "s-fresh": [(1800, "+", "", "عائلة تطلب منا"), (40, "", "", "صنفاً من الطبيعة"), (2, "", " يوم", "للتوصيل"), (97, "", "%", "طلبات مكتملة")],
 "s-gold": [(950, "+", "", "قطعة مُسلَّمة"), (14, "", " يوماً", "للاستبدال"), (100, "", "%", "تغليف هدايا"), (24, "", "h", "للرد على استفسارك")],
 "s-herbs": [(2100, "+", "", "عبوة مُسلَّمة"), (60, "", "", "صنف أعشاب وزيوت"), (15, "", " سنة", "خبرة العطّار"), (95, "", "%", "زبائن يعودون")],
 "s-honey": [(7400, "+", "", "كيلوغرام مُسلَّم"), (12, "", "", "منحلاً نتعامل معه"), (5, "", " مواسم", "من القطاف"), (96, "", "%", "رضا الزبائن")],
 "s-it": [(1400, "+", "", "جهاز وقطعة مُسلَّمة"), (24, "", " شهراً", "ضمان الحواسيب"), (48, "", "h", "لتجهيز الطلب"), (120, "+", "", "طلب شهرياً")],
 "s-kids": [(2900, "+", "", "هدية ولعبة مُسلَّمة"), (35, "", "", "لعبة وقطعة جديدة"), (7, "", " أيام", "للاستبدال"), (97, "", "%", "أمهات راضيات")],
 "s-marketplace": [(150, "+", "", "بائع شريك"), (8500, "+", "", "منتج متوفر"), (69, "", "", "ولاية نصلها"), (24, "", "h", "متوسط التوصيل")],
 "s-perfume": [(3100, "+", "", "قارورة مُسلَّمة"), (80, "", "", "عطراً من كبرى الدور"), (5, "", " مل", "عيّنات مجانية"), (95, "", "%", "رضا الزبائن")],
 "s-pop": [(9800, "+", "", "حذاء وقطعة مُسلَّمة"), (300, "", "", "موديل جريء"), (48, "", "h", "وقت التوصيل"), (4, "", " ألوان", "لكل موديل")],
 "s-skincare": [(1900, "+", "", "روتين مُجهَّز"), (28, "", " يوماً", "لتجربة الروتين"), (40, "", "", "منتجاً للعناية"), (93, "", "%", "رضا الزبائن")],
 "s-supplements": [(6200, "+", "", "علبة مُسلَّمة"), (70, "", "", "منتجاً رياضياً"), (24, "", "h", "توصيل سريع"), (98, "", "%", "طلبات مكتملة")],
 "s-women": [(4100, "+", "", "قطعة مُسلَّمة"), (90, "", "", "تصميماً جديداً"), (7, "", " أيام", "للاستبدال"), (96, "", "%", "زبونات راضيات")],
}
MALE = ["أمين", "كريم", "ياسين", "رضا", "وليد", "سفيان", "نبيل", "إلياس", "بلال", "هشام", "طارق", "مراد", "عادل", "فيصل", "زكرياء", "أيوب", "سمير", "حمزة", "لطفي", "إسلام"]
FEM = ["سارة", "ليلى", "مريم", "إيمان", "نادية", "هناء", "آسيا", "سمية", "فاطمة", "خديجة", "ريم", "نسرين", "وفاء", "سلمى", "أميرة", "جيهان", "حنان", "سهام", "لمياء", "شيماء"]
INI = ["ب.", "ع.", "ر.", "م.", "ح.", "ق.", "ز.", "س.", "ط.", "ك.", "د.", "ن."]
CITY = ["الجزائر", "وهران", "قسنطينة", "عنابة", "سطيف", "باتنة", "بجاية", "تلمسان", "البليدة", "بسكرة", "غرداية", "ورقلة", "تيزي وزو", "سكيكدة", "مستغانم", "الشلف", "جيجل", "المسيلة", "سعيدة", "الأغواط"]
WHO = {"s-cosmetics": "f", "s-skincare": "f", "s-makeup": "f", "s-women": "f", "s-kids": "f", "s-jewelry": "f", "s-accessories": "x", "s-perfume": "x", "s-fresh": "x", "s-herbs": "x", "s-honey": "x"}
PERMS = [["S", "T", "P", "F"], ["T", "S", "F", "P"], ["S", "P", "T", "F"], ["P", "S", "T", "F"], ["T", "P", "S", "F"], ["S", "T", "F", "P"]]
STYLE_FX = {"cards": ("بطاقات الأرقام", "selector .pb-colin{background:rgba(127,127,127,.09);border:1px solid rgba(127,127,127,.28);border-radius:18px;padding:22px 10px}"),
            "bar": ("فواصل بين الأرقام", "@media(min-width:768px){selector .pb-col+.pb-col>.pb-colin{border-inline-start:1px solid rgba(127,127,127,.35)}}")}
def _build_names():      # توزيع ثابت: ثلاثة أسماء/مدن متفرّدة لكل قالب (لا اسم يتكرر بين القوالب)
    used, out = set(), {}
    for i, tid in enumerate(STORE_ORDER):
        if tid in OUT_OF_BATCH: continue
        who = WHO.get(tid, "m"); L = []
        for j in range(3):
            g = "f" if who == "f" else "m" if who == "m" else ("f" if j == 1 else "m"); k = i * 3 + j
            while True:
                nm = (FEM if g == "f" else MALE)[(k * 7 + (3 if g == "f" else 1)) % 20] + " " + INI[(k * 5 + 2) % 12]
                if tid == "s-kids": nm = "أم " + MALE[(k * 7 + 1) % 20]
                if nm not in used: break
                k += 1
            used.add(nm); L.append((nm, CITY[(i * 9 + j * 3 + 4) % 20], g))
        out[tid] = L
    return out
NAMES = _build_names()
_USED = {n for L in NAMES.values() for n, _, _ in L}
def _male_alt(seed):      # صورة الرأي الأصلية (رجل) تبقى؛ فيُسمّى صاحبها باسم ذكوري متفرّد بدل اسم أنثوي لا يطابق الصورة
    k = seed
    while True:
        nm = MALE[(k * 7 + 1) % 20] + " " + INI[(k * 5 + 2) % 12]
        if nm not in _USED: _USED.add(nm); return nm
        k += 1
def _vwalk(n, out):
    for k in ("cols", "widgets", "free"):
        for c in n.get(k, []) or []:
            if k == "cols": _vwalk(c, out)
            else: out.append(c)
    return out
def _vfx(sec, key):
    n, tpl = STYLE_FX[key]; h = hashlib.md5((sec.get("id", "") + key).encode()).hexdigest()[:7]
    sec.setdefault("set", {}).setdefault("fxs", []).append({"id": h, "n": n, "on": True, "tpl": tpl, "p": {}})
def variety(id, pg):
    if id not in STORE_ORDER or id in OUT_OF_BATCH: return
    i = STORE_ORDER.index(id); secs = pg.get("sections", []); n = len(secs)
    info = []
    for k, s in enumerate(secs):
        ws = _vwalk(s, []); ty = [w["type"] for w in ws]
        info.append(dict(ctr=ty.count("counter"), cols=len(s.get("cols", [])), tst=ty.count("testimonial"), cp="coupon" in ty, acc=ty.count("accordion"), ft="sfoot" in ty))
    pick = lambda cond: next((k for k in range(n - 1, -1, -1) if cond(info[k])), None)
    iS = pick(lambda x: x["ctr"] >= 3 and x["cols"] >= 3 and x["tst"] == 0); iT = pick(lambda x: x["tst"] >= 3); iP = pick(lambda x: x["cp"]); iF = pick(lambda x: x["acc"] >= 1 and not x["ft"])
    role = {"S": iS, "T": iT, "P": iP, "F": iF}
    # 1) أرقام الإحصائيات
    if iS is not None and id in STATS_SET:
        s = secs[iS]; cs = [c for c in s["cols"] if any(w["type"] == "counter" for w in c.get("widgets", []))]; vals = STATS_SET[id]
        cur = [(w["set"].get("n"), w["set"].get("pre", ""), w["set"].get("suf", "")) for c in cs for w in c.get("widgets", []) if w["type"] == "counter"]
        if cur == GENERIC_STATS:
            for c, v in zip(cs, vals):
                for w in c["widgets"]:
                    if w["type"] == "counter": w["set"].update(n=v[0], pre=v[1], suf=v[2], label=v[3])
            for c in cs[len(vals):]: s["cols"].remove(c)      # قالب بثلاثة أرقام: عمود أقل (العناصر الباقية بحالها)
    # 2) أسماء الآراء ومدنها (لكل قالب ثلاثة متفرّدة) — الصور الأصلية للآراء لا تُمَسّ
    if iT is not None:
        tw = [w for w in _vwalk(secs[iT], []) if w["type"] == "testimonial"]
        for j, w in enumerate(tw):
            nm, city, g = NAMES[id][j % 3]
            if g != "m" and w["set"].get("img"): nm = _male_alt(100 + i * 3 + j)
            w["set"]["name"] = nm; w["set"]["role"] = city
            # صورة الرأي الأصلية تبقى كما هي (لا حذف ولا استبدال لصورة أصلية)؛ يتغيّر الاسم والمدينة فقط
    # 3) ترتيب كتل النهاية + 4) نمط الأرقام
    if all(role[r] is not None for r in "STF") and iS < n and iF < n:
        found = [r for r in "STPF" if role[r] is not None]; slots = sorted(role[r] for r in found)
        perm = [r for r in PERMS[i % 6] if r in found]
        blocks = {r: secs[role[r]] for r in found}
        for r in found:                                      # حشوات تتّسق مع الجوار الجديد (الأرقام فوق الآراء مباشرة تشترك بالخلفية)
            pass
        for slot, r in zip(slots, perm): secs[slot] = blocks[r]
        if "S" in perm and "T" in perm:
            si, ti = perm.index("S"), perm.index("T"); adj = (ti == si + 1)
            ps, pt = blocks["S"]["set"].get("pad"), blocks["T"]["set"].get("pad")
            if isinstance(ps, dict) and not adj: ps["d"][2] = 50; ps["m"][2] = 34
            if isinstance(pt, dict) and not (si + 1 == ti): pt["d"][0] = 50; pt["m"][0] = 34
    if iS is not None and i % 3 in (1, 2): _vfx(secs[iS] if secs[iS].get("cols") else secs[iS], ("cards", "bar")[i % 3 - 1])
