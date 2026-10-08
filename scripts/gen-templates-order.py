# ═════════ نماذج الطلبات (5) ═════════
def orderw(**x):
    return W("orderorig", prod="", auto=True, **x)

# 1) عرض فلاش
k = "of"; ICC[0] = "#fde047"
head = C([
    W("heading", text="عرض فلاش — ينتهي قريباً", tag="h2", fs=dm(46, 30), fw="900", ta={"d": "center"}, color="#ffffff", lh={"d": 1.3}, fxs=[gradtext(k, "#fde047", "#fb923c", "#f43f5e", 4)], **anim("fadeDown", .7)),
    T("خصم حصري على الطلبات اليوم فقط — أكمل بياناتك في النموذج أدناه وادفع عند الاستلام.", 19, "#fecaca", **anim("fadeUp", .7, .1)),
    W("countdown", mode="daily", cbg="#00000055", color="#fde047", fs=dm(42, 30), crad=dm(14), al={"d": "center"}, fxs=[cdglow(k, "#f97316")], **anim("zoomIn", .7, .2)),
    W("stock", smode="manual", sn=9, smax=40, stx="🔥 بقيت {n} قطع فقط بسعر العرض!", color="#ffffff", sbgc="#ffffff22", fs=dm(18, 15), fxs=[stockbar(k)], **anim("fadeUp", .7, .3)),
], w=100)
body = C([W("coupon", cpcode="FLASH20", cpt="كود خصم إضافي 20% لأول طلب", cpbtn="نسخ الكود", cpbg="#ffffff14", cpbc="#fde047", cpc="#ffffff", cpb="#f97316", fxs=[couponfx("#fde047")], **anim("fadeUp", .7)),
          orderw(fxs=[rotborder(k, "#fde047", "#f43f5e", 3, 4, 22), FX("بطاقة بيضاء ناعمة", "selector{background:#fff;border-radius:22px;padding:6px;box-shadow:0 30px 80px rgba(0,0,0,.45)}")], **anim("fadeUp", .8, .1))], w=100)
body["set"]["pad"] = dm([0, 0, 0, 0]); head["set"]["pad"] = dm([0, 0, 24, 0])
reg("o-flash", "order", "عروض", "طلب بعرض فلاش", "خلفية نارية متحركة، عدّاد تنازلي متوهج، شريط مخزون يلمع، كوبون نابض، ونموذج الطلب بإطار متوهج دوّار.",
    [S([head, body], cw={"d": 860}, pad=dm([70, 20, 90, 20], [44, 16, 56, 16]), fxs=[aurora(k, "#450a0a", "#ef444499", "#f9731699", "#facc1566", 12), blobs(k, "#f97316", "#e11d48", 320, .45)])])

# 2) فاخر داكن
k = "ol"; ICC[0] = "#f5d77a"
ben = C([
    W("heading", text="لماذا تطلب منّا؟", tag="h2", fs=dm(38, 28), fw="900", ta={"d": "start"}, color="#f5d77a", fxs=[goldshimmer(k, 5)], **anim("fadeUp")),
    W("bullets", items="جودة أصلية مضمونة 100%\nتوصيل سريع لجميع الولايات\nالدفع عند الاستلام بعد المعاينة\nإمكانية الاستبدال خلال 7 أيام\nدعم متواصل عبر واتساب", micon="ic:check-circle", mc="#f5d77a", ms=dm(24), gap=dm(14), fs=dm(19, 16), color="#f1ead2", manim="pop", **anim("fadeUp", .7, .1)),
    W("tbadges", items="ضمان الجودة\nتوصيل مؤمَّن", live=True, liveText="يشاهدون العرض الآن", lmin=9, lmax=26, cbg="#00000050", cc="#f5d77a", cbc="#c9992e", crad=dm(10), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .7, .2)),
], w=40, va="center")
ordc = C([orderw(fxs=[goldborder("#c9992e"), FX("خلفية كريمية", "selector{background:#fffaf0;padding:8px;border-radius:8px}")], **anim("fadeUp", .8, .15))], w=60, va="center")
reg("o-lux", "order", "فخامة", "طلب فاخر داكن ذهبي", "قسم داكن بتوهّج دافئ ومزايا بلمعان ذهبي وشارات حيّة بجانب نموذج الطلب بحد ذهبي مزدوج.",
    [S([ben, ordc], pad=dm([90, 20, 90, 20], [56, 16, 56, 16]), gap={"d": 40}, fxs=[FX("خلفية سوداء بتدرّج دافئ", "selector{background:radial-gradient(80% 90% at 15% 10%,#2b2110,#0c0a06 60%),#0c0a06}"), spotlight(k, "rgba(201,153,46,.2)")])])

# 3) ثلاث خطوات
k = "os"; ICC[0] = "#2563eb"
head = C([H("اطلب في 3 خطوات بسيطة", 42, 28, "#0f172a", fxs=[gradtext(k, "#2563eb", "#7c3aed", "#db2777", 7)], **anim("fadeUp")), T("لا حساب ولا بطاقة بنكية — فقط اسمك وهاتفك وعنوانك، وتدفع عند الاستلام.", 18, "#475569", **anim("fadeUp", .7, .1))], w=100)
steps = [C([IB(ic, t, x, tc="#0f172a", xc="#64748b", isz=36, fxs=[softcard("#ffffff", "rgba(37,99,235,.14)", 22, 24, "#e0e7ff"), lift(".pb-ib", "rgba(37,99,235,.25)", -8), floaty(k + str(i), ".pb-ibi", 6, 4 + i * .6)], **anim("fadeUp", .7, .1 + i * .15))], w=33, pad=dm([0, 0, 24, 0]))
         for i, (ic, t, x) in enumerate([("cart", "1 · اختر منتجك", "حدّد الباقة المناسبة من النموذج"), ("user", "2 · أدخل بياناتك", "الاسم والهاتف والولاية فقط"), ("truck", "3 · استلم وادفع", "نوصّل لباب بيتك وتدفع عند الاستلام")])]
SOL = lambda: [FX("خلفية هادئة", "selector{background:#f4f7ff}")]
reg("o-steps", "order", "عام", "طلب بثلاث خطوات", "خلفية هادئة، ثلاث بطاقات خطوات يربطها خط متقطع، ونموذج طلب بإطار دوّار وشارات ضمان.",
    [S([head], pad=dm([80, 20, 10, 20], [48, 16, 10, 16]), fxs=SOL()),
     S(steps, pad=dm([10, 20, 20, 20]), gap={"d": 20}, fxs=SOL() + [timeline("#2563eb")]),
     S([C([orderw(fxs=[rotborder(k, "#2563eb", "#db2777", 2, 5, 22), FX("بطاقة ناصعة", "selector{background:#fff;border-radius:22px;padding:8px;box-shadow:0 30px 70px rgba(37,99,235,.18)}")], **anim("fadeUp", .8)),
         W("tbadges", items="دفع عند الاستلام\nتوصيل 58 ولاية\nاستبدال خلال 7 أيام", live=False, cbg="#ffffff", cc="#334155", cbc="#e0e7ff", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .8, .2))], w=100)],
       cw={"d": 900}, pad=dm([20, 20, 90, 20], [16, 16, 56, 16]), fxs=SOL())])

# 4) اختر باقتك (منتجات + كوبون + نموذج)
k = "ob"; ICC[0] = "#86efac"
head = C([H("اختر باقتك ووفّر أكثر", 44, 30, "#ffffff", fxs=[gradtext(k, "#86efac", "#67e8f9", "#fde68a", 6)], **anim("fadeUp")), T("اطّلع على منتجاتنا، ثم أكمل طلبك أدناه — كلما زادت الكمية زاد التوفير.", 18, "#bbf7d0", **anim("fadeUp", .7, .1))], w=100)
prods = C([W("products", mode="all", limit=3, btn="اطلب الآن", showOld=True, cardw=dm(300, 220), gap=dm(22), rad=dm(22), cbg="#ffffffee", bbg="#16a34a",
             fxs=[lift(".pb-pc", "rgba(0,0,0,.35)", -10, 3), FX("سعر بارز", "selector .pb-pcp{font-weight:900}")], **anim("fadeUp", .8, .1))], w=100)
body = C([W("coupon", cpcode="PACK15", cpt="وفّر 15% عند اختيار أي باقة", cpbtn="نسخ الكود", cpbg="#ffffff18", cpbc="#86efac", cpc="#ffffff", cpb="#16a34a", fxs=[couponfx("#86efac")], **anim("zoomIn", .7)),
          orderw(fxs=[rotborder(k, "#86efac", "#67e8f9", 3, 5, 22), FX("بطاقة بيضاء", "selector{background:#fff;border-radius:22px;padding:6px;box-shadow:0 30px 80px rgba(0,0,0,.4)}")], **anim("fadeUp", .8, .1))], w=100)
for c_ in (head, prods): c_["set"]["pad"] = dm([0, 0, 28, 0])
reg("o-bundle", "order", "متجر", "طلب باقات وكوبون", "قسم أخضر بأورورا يعرض منتجات المتجر ببطاقات ترتفع بالمرور، كوبون متوهج ثم نموذج الطلب بإطار دوّار.",
    [S([head, prods, body], pad=dm([80, 20, 90, 20], [48, 16, 56, 16]), fxs=[aurora(k, "#052e16", "#22c55e88", "#06b6d466", "#a3e63555", 16), blobs(k, "#22c55e", "#06b6d4", 340, .35)])])

# 5) إثبات اجتماعي
k = "op"; ICC[0] = "#a78bfa"
cnt = [C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(46, 30), color="#a78bfa", lc="#cbd5e1", fxs=[ctrcolor("#a78bfa", "#22d3ee")], **anim("fadeUp", .6, .1 + i * .1))], w=25)
       for i, (n, p, s, l) in enumerate([(12000, "+", "", "طلب مُسلَّم"), (58, "", "", "ولاية نغطيها"), (98, "", "%", "نسبة الرضا"), (24, "", "h", "متوسط التوصيل")])]
tes = [C([W("testimonial", name=n, role=r, text=t, stars=5, tbg="#ffffff14", rad=dm(22), fxs=[tscard("rgba(255,255,255,.08)", "rgba(255,255,255,.2)", 22, "#f1f5f9"), lift(".pb-ts", "rgba(124,58,237,.4)", -8)], **anim("fadeUp", .7, .1 + i * .12))], w=33)
       for i, (n, r, t) in enumerate([("سمية ب.", "وهران", "طلبت صباحاً ووصلني بعد يومين، الجودة فاقت توقعاتي بكثير."), ("كريم ع.", "قسنطينة", "تعامل راقٍ وسرعة في التأكيد، والدفع عند الاستلام أراحني."), ("نور الهدى", "الجزائر العاصمة", "أنصح الجميع، المنتج أصلي والخدمة ممتازة.")])]
head = C([H("آلاف الزبائن وثقوا بنا", 44, 30, "#ffffff", fxs=[gradtext(k, "#a78bfa", "#22d3ee", "#f472b6", 7)], **anim("fadeUp")),
          W("tbadges", items="تقييم 4.9 من 5\nتوصيل مضمون", live=True, liveText="يشترون الآن", lmin=11, lmax=34, cbg="#ffffff14", cc="#e2e8f0", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .7, .1))], w=100)
cta = W("addcart", t="اطلب الآن — الدفع عند الاستلام", dest="page", abg="#7c3aed", atc="#ffffff", afs=dm(20, 17), apad=dm([16, 34, 16, 34]), arad=dm(16), ashine=True, al={"d": "center"}, fxs=[pulse(k, "124,58,237", 2.2, sel=".pb-ac"), btngrad("#7c3aed", "#db2777", "rgba(124,58,237,.5)", sel=".pb-ac")], **anim("zoomIn", .8))
head["set"]["pad"] = dm([0, 0, 24, 0])
for c_ in cnt + tes: c_["set"]["pad"] = dm([0, 0, 26, 0])
reg("o-proof", "order", "عام", "طلب بإثبات اجتماعي", "عدّادات بتدرّج، آراء زبائن زجاجية ترتفع بالمرور، شارة «يشترون الآن»، زر نابض ثم نموذج الطلب.",
    [S([head] + cnt + tes + [COL([cta], 100, 24), COL([orderw(fxs=[rotborder(k, "#a78bfa", "#22d3ee", 2, 5, 22), FX("بطاقة بيضاء", "selector{background:#fff;border-radius:22px;padding:6px;box-shadow:0 30px 80px rgba(0,0,0,.5)}")], w=dm(72, 100), al={"d": "center"}, **anim("fadeUp", .8))], 100, 0)],
       pad=dm([80, 20, 90, 20], [48, 16, 56, 16]), fxs=[aurora(k, "#0b0620", "#7c3aed88", "#06b6d466", "#db277755", 20), blobs(k, "#7c3aed", "#db2777", 340, .3)])])
