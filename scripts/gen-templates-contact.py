# ═════════ نماذج الاتصال (5) ═════════
# 1) أورورا زجاجية
k = "ca"; ICC[0] = "#a78bfa"
form = contact("أرسل لنا رسالة", "املأ النموذج وسيتواصل معك فريقنا خلال ساعات قليلة.", FLD_STD, btn="إرسال الرسالة", fbg="#ffffff10", fbc="#ffffff30", tcol="#ffffff", lcol="#e2e8f0", ibg="#ffffff14", ibc="#ffffff35", bbg="#7c3aed", bcol="#ffffff", frad=dm(24), irad=dm(14), brad=dm(14), fpad=dm([30, 28, 30, 28]),
               fxs=[glass("rgba(255,255,255,.07)", "rgba(255,255,255,.22)", 20, 26), rotborder(k, "#22d3ee", "#a855f7", 2, 6, 26), inputs(k, "34,211,238", bg="rgba(255,255,255,.08)", color="#ffffff", ph="rgba(255,255,255,.55)"), btngrad("#7c3aed", "#06b6d4", "rgba(124,58,237,.5)", sel=".pb-cf-b")], **anim("fadeUp", .8, .1))
left = C([
    PIC("dig_code", "مكتب الدعم", 26, fxs=[FX("إطار متوهج", "selector img{box-shadow:0 30px 70px rgba(124,58,237,.35);border:1px solid rgba(255,255,255,.2)}")], **anim("zoomIn", .8)),
    H("لنتحدّث ", 50, 34, ta="start", fxs=[gradtext(k, "#a78bfa", "#22d3ee", "#f472b6", 7)], **anim("fadeUp", .7)),
    T("نحن هنا لنجيب على كل أسئلتك حول المنتجات والطلبات والتوصيل. اختر الطريقة الأنسب لك.", 18, "#cbd5e1", "start", **anim("fadeUp", .7, .1)),
    IB("phone", "اتصل بنا", "0555 00 00 00 — كل يوم من 9 صباحاً إلى 9 مساءً", isz=34, fxs=[cardgrid(), lift(".pb-ib", "rgba(124,58,237,.35)", -6), floaty(k, ".pb-ibi", 6, 4.5)], **anim("slideStart", .7, .2), al={"d": "start"}),
    IB("chat", "واتساب مباشر", "ردّ فوري خلال دقائق على رسائلك", isz=34, fxs=[cardgrid(), lift(".pb-ib", "rgba(34,211,238,.3)", -6), floaty(k + "b", ".pb-ibi", 6, 5.2)], **anim("slideStart", .7, .3)),
    IB("pin", "زورونا", "الجزائر العاصمة — التوصيل لكل الولايات", isz=34, fxs=[cardgrid(), lift(".pb-ib", "rgba(244,114,182,.3)", -6), floaty(k + "c", ".pb-ibi", 6, 5.8)], **anim("slideStart", .7, .4)),
], w=42, va="center")
for w in left["widgets"][2:]:
    w["set"]["al"] = {"d": "start"}
left["set"]["pad"] = dm([0, 0, 0, 0], [0, 0, 28, 0])
right = C([form], w=58, va="center")
reg("c-aurora", "contact", "عام", "اتصال أورورا زجاجي", "خلفية أورورا متحركة، نموذج زجاجي بإطار متوهج دوّار، بطاقات تواصل تطفو وترتفع بالمرور.",
    [S([left, right], pad=dm([90, 20, 90, 20], [56, 16, 56, 16]), gap={"d": 40}, fxs=[aurora(k), blobs(k, "#7c3aed", "#06b6d4", 380, .35)])])

# 2) نيون سايبر
k = "cn"
form = contact("اتصال آمن", "قناة مباشرة معنا — نردّ على رسالتك فور وصولها.", FLD_STD, btn="إرسال ◂", fbg="#05070f", fbc="#0e7490", tcol="#22d3ee", lcol="#67e8f9", ibg="#0a1224", ibc="#0e7490", bbg="#0891b2", bcol="#021014", frad=dm(18), irad=dm(10), brad=dm(10), fpad=dm([34, 30, 34, 30]),
               fxs=[rotborder(k, "#22d3ee", "#f0abfc", 2, 4, 18), scan(k), inputs(k, "34,211,238", bg="#0a1224", color="#e0f2fe", ph="#64748b"), pulse(k, "34,211,238", 2.4, sel=".pb-cf-b"), shine(k, 2.8, sel=".pb-cf-b")], **anim("zoomIn", .8))
head = W("heading", text="◂ ابقَ على اتصال ▸", tag="h2", fs=dm(44, 28), fw="900", ta={"d": "center"}, color="#22d3ee", lh={"d": 1.3}, fxs=[neontext(k, "#22d3ee")], **anim("fadeDown", .7))
pic = PIC("it_dark", "غرفة التحكم", 20, w=dm(70, 100), al={"d": "center"}, fxs=[FX("وهج سماوي", "selector img{box-shadow:0 0 60px rgba(34,211,238,.35);border:1px solid rgba(34,211,238,.4)}")], **anim("zoomIn", .8, .25))
sub = T("غرفة التحكم مفتوحة على مدار الساعة. أرسل رسالتك وسيصلك الرد بسرعة الضوء.", 18, "#94a3b8", **anim("fadeUp", .7, .15))
stats = [C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(44, 30), color="#22d3ee", lc="#94a3b8", fxs=[ctrcolor("#22d3ee", "#f0abfc")], **anim("fadeUp", .6, .2 + i * .1))], w=33, pad=dm([0, 0, 28, 0]))
         for i, (n, p, s, l) in enumerate([(24, "", "/7", "دعم متواصل"), (15, "<", " د", "متوسط زمن الرد"), (98, "", "%", "رضا الزبائن")])]
form["set"]["w"] = dm(72, 100); form["set"]["al"] = {"d": "center"}
reg("c-neon", "contact", "عام", "اتصال نيون سايبر", "خلفية شبكية متحركة، عنوان نيون يومض، نموذج بإطار دوّار وخط مسح، وعدّادات بتدرّج.",
    [S([COL([head, sub, pic], 100, 20)] + stats + [COL([form], 100, 0)], pad=dm([80, 20, 90, 20], [48, 16, 56, 16]), bg="#03060d", fxs=[gridbg(k, "rgba(34,211,238,.09)", 44), blobs(k, "#0891b2", "#a21caf", 340, .28)])])

# 3) فخامة ذهبية
k = "cg"; ICC[0] = "#f5d77a"
form = contact("طلب خاص", "خدمة العملاء المميّزين — نخصّص لك وقتاً ونردّ بنفسنا.", FLD_STD, btn="إرسال الطلب", fbg="#fbf6e9", fbc="#d4af37", tcol="#1a1409", lcol="#4a3b14", ibg="#ffffff", ibc="#e6d9aa", bbg="#b8860b", bcol="#ffffff", frad=dm(8), irad=dm(6), brad=dm(6), fpad=dm([34, 32, 34, 32]),
               fxs=[goldborder("#c9992e"), shine(k, 3.2, sel=".pb-cf-b"), inputs(k, "201,153,46", bg="#ffffff", color="#1a1409"), btngrad("#b8860b", "#f5d77a", "rgba(201,153,46,.5)", -2, sel=".pb-cf-b")], **anim("fadeLeft" if False else "fadeUp", .9, .1))
left = C([
    PIC("jewel_pearl", "تغليف فاخر", 8, fxs=[FX("إطار ذهبي", "selector img{border:1px solid #c9992e;box-shadow:0 0 0 6px rgba(201,153,46,.12),0 30px 70px rgba(0,0,0,.5)}")], **anim("fadeUp", .8)),
    W("heading", text="خدمة بمقام الضيوف", tag="h2", fs=dm(46, 30), fw="900", ta={"d": "start"}, color="#f5d77a", lh={"d": 1.3}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .8)),
    T("لأن ثقتكم أغلى ما نملك، نتولّى كل استفسار بعناية فائقة وخصوصية تامة.", 18, "#cbbf9c", "start", **anim("fadeUp", .8, .1)),
    T("<b style='color:#f5d77a'>ساعات العمل</b><br>السبت – الخميس: 9:00 صباحاً — 6:00 مساءً<br><b style='color:#f5d77a'>الهاتف</b> 0555 00 00 00 &nbsp;·&nbsp; <b style='color:#f5d77a'>واتساب</b> متاح دائماً", 17, "#e7ddc0", "start", lh=2.1, **anim("fadeUp", .8, .2)),
    W("tbadges", items="ضمان الجودة\nتوصيل مؤمَّن\nدفع عند الاستلام", live=False, cbg="#00000040", cc="#f5d77a", cbc="#c9992e", crad=dm(8), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3)),
], w=44, va="center")
reg("c-gold", "contact", "فخامة", "اتصال فخامة ذهبية", "خلفية سوداء ناعمة، عنوان بلمعان ذهبي، نموذج بحد ذهبي مزدوج وزر ذهبي يلمع.",
    [S([left, C([form], w=56, va="center")], pad=dm([90, 20, 90, 20], [56, 16, 56, 16]), gap={"d": 44}, fxs=[FX("خلفية سوداء بتدرّج دافئ", "selector{background:radial-gradient(80% 90% at 80% 10%,#2b2110,#0c0a06 60%),#0c0a06}"), spotlight(k, "rgba(201,153,46,.22)")])])

# 4) عائم ناعم (باستيل)
k = "cs"; ICC[0] = "#7c3aed"
form = contact("اكتب لنا", "نحب أن نسمع منك — رسالتك تصلنا مباشرة.", FLD_STD, btn="أرسل الآن", fbg="#ffffff", fbc="#ffffff", tcol="#4c1d95", lcol="#6b5b95", ibg="#f5f3ff", ibc="#ddd6fe", bbg="#8b5cf6", bcol="#ffffff", frad=dm(34), irad=dm(999), brad=dm(999), fpad=dm([38, 34, 38, 34]),
               fxs=[FX("ظلّ ناعم عائم", "selector .pb-cf{box-shadow:0 40px 90px rgba(139,92,246,.25),0 8px 24px rgba(139,92,246,.12);animation:csFl 7s ease-in-out infinite}@keyframes csFl{50%{transform:translateY(-10px)}}"), inputs(k, "139,92,246", bg="#f5f3ff", color="#3b0764"), btngrad("#8b5cf6", "#ec4899", "rgba(139,92,246,.45)", -3, sel=".pb-cf-b"), shine(k, 3.6, sel=".pb-cf-b")], **anim("zoomIn", .9))
cards = [C([IB(ic, t, x, tc="#4c1d95", xc="#6b5b95", isz=36, fxs=[softcard("#ffffffcc", "rgba(139,92,246,.18)", 26, 22), lift(".pb-ib", "rgba(139,92,246,.3)", -8, 5), floaty(k + str(i), ".pb-ibi", 8, 4 + i)], **anim("fadeUp", .7, .1 + i * .12))], w=33)
         for i, (ic, t, x) in enumerate([("chat", "دردشة سريعة", "نردّ على واتساب خلال دقائق"), ("mail", "بريد إلكتروني", "للاستفسارات التفصيلية"), ("clock", "ساعات العمل", "كل يوم 9 ص — 9 م")])]
heading = [C([PIC("cosm_pink", "عناية", 40, w=dm(40, 70), al={"d": "center"}, fxs=[FX("ظل بنفسجي", "selector img{box-shadow:0 30px 80px rgba(139,92,246,.3)}")], **anim("zoomIn", .8)), H("يسعدنا سماعك", 46, 30, "#4c1d95", fxs=[gradtext(k, "#7c3aed", "#ec4899", "#f59e0b", 8)], **anim("fadeUp")), T("اختر الطريقة المناسبة أو اترك رسالتك في النموذج أدناه.", 18, "#6b5b95", **anim("fadeUp", .7, .1))], w=100)]
heading[0]["set"]["pad"] = dm([0, 0, 20, 0]); form["set"]["w"] = dm(64, 100); form["set"]["al"] = {"d": "center"}
for c_ in cards: c_["set"]["pad"] = dm([0, 0, 30, 0])
reg("c-soft", "contact", "عام", "اتصال باستيل عائم", "خلفية باستيل متحركة وكرات ضوئية، بطاقات ناعمة تميل بالمرور، ونموذج دائري الحقول يطفو برفق.",
    [S(heading + cards + [COL([form], 100, 0)], pad=dm([80, 20, 90, 20], [48, 16, 56, 16]), fxs=[aurora(k, "#faf5ff", "#c4b5fd99", "#fbcfe899", "#fde68a88", 20), blobs(k, "#c4b5fd", "#fbcfe8", 360, .6)])])

# 5) خطوات + محادثة سريعة
k = "ct"; ICC[0] = "#10b981"
steps = [C([IB(ic, t, x, tc="#064e3b", xc="#475569", isz=34, fxs=[softcard("#ffffff", "rgba(16,185,129,.18)", 22, 22, "#d1fae5"), lift(".pb-ib", "rgba(16,185,129,.28)", -8), floaty(k + str(i), ".pb-ibi", 6, 4.2 + i * .5)], **anim("fadeUp", .7, .1 + i * .15))], w=33, pad=dm([0, 0, 24, 0]))
         for i, (ic, t, x) in enumerate([("chat", "1 · أرسل رسالتك", "املأ النموذج أو راسلنا على واتساب"), ("headset", "2 · نتّصل بك", "يتواصل معك مستشارنا خلال دقائق"), ("gift", "3 · نسلّمك الطلب", "توصيل لباب بيتك والدفع عند الاستلام")])]
form = contact("ابدأ محادثتك الآن", "اتركها لنا — سنتولّى الباقي.", FLD_STD, btn="أرسل عبر واتساب", fbg="#ffffff14", fbc="#ffffff40", tcol="#ffffff", lcol="#d1fae5", ibg="#ffffff22", ibc="#ffffff55", bbg="#22c55e", bcol="#052e16", frad=dm(26), irad=dm(14), brad=dm(14), fpad=dm([30, 28, 30, 28]),
               fxs=[glass("rgba(255,255,255,.1)", "rgba(255,255,255,.3)", 16, 26), inputs(k, "187,247,208", bg="rgba(255,255,255,.14)", color="#ffffff", ph="rgba(255,255,255,.7)"), pulse(k, "34,197,94", 2, sel=".pb-cf-b"), shine(k, 3, sel=".pb-cf-b")], **anim("fadeUp", .8, .1))
panel = COL([PIC("mkt_open", "متجرنا", 22, w=dm(70, 100), al={"d": "center"}, fxs=[FX("ظل أخضر", "selector img{box-shadow:0 30px 70px rgba(16,185,129,.25)}")], **anim("zoomIn", .8)), W("heading", text="كيف نردّ عليك؟", tag="h2", fs=dm(34, 26), fw="900", ta={"d": "center"}, color="#064e3b", lh={"d": 1.3}, **anim("fadeUp"))], 100, 30)
reg("c-steps", "contact", "عام", "اتصال بخطوات ومحادثة سريعة", "ثلاث خطوات واضحة لطريقة الرد مع خط وصل، ولوحة خضراء زجاجية فيها نموذج واتساب بزر نابض وشارات ثقة.",
    [S([panel] + steps, pad=dm([70, 20, 80, 20], [44, 16, 40, 16]), bg="#ecfdf5", gap={"d": 20}, fxs=[blobs(k, "#6ee7b7", "#a7f3d0", 320, .5)]),
     S([C([form, W("tbadges", items="رد خلال 15 دقيقة\nخصوصية تامة", live=True, liveText="يتحدثون معنا الآن", lmin=6, lmax=19, cbg="#ffffff22", cc="#ffffff", cbc="#ffffff44", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .8, .3))], w=70)],
       pad=dm([70, 20, 90, 20], [44, 16, 56, 16]), cw={"d": 920}, fxs=[aurora(k, "#064e3b", "#10b98199", "#06b6d466", "#a3e63555", 16), wave(k, "#ecfdf5", "top")])])
