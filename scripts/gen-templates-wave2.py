# ═════════ الموجة الثانية: قوالب متاجر جديدة (6) — عطور، عناية بالبشرة، مكياج، أزياء نسائية، أزياء رجالية، أطفال ═════════
# تُنفَّذ من gen-templates.py بعد gen-templates-niche.py. كل قالب بتركيبة أقسام مختلفة وهوية بصرية مستقلة.
# الصور: assets/img/tpl/ (مُراجعة بصرياً — انظر CREDITS.md). النصوص التجريبية: PACKS في gen-templates-copy.py.

# ───────── 1) عطور — «عبق» (فخامة شرقية داكنة: عنبر وعود) ─────────
k = "np"; ICC[0] = "#d4a24e"
OUD = lambda s: [FX("خلفية عود داكنة", "selector{background:radial-gradient(70% 80% at 82% 0%,rgba(212,162,78,.13),transparent 60%),radial-gradient(50% 60% at 8% 100%,rgba(139,90,43,.14),transparent 60%),#120a06}")]
th = TH(k, True, "#f2dfb8", "#b8a284", "#d4a24e", "#8b5a2b", "#ffffff08", OUD, OUD,
        dict(sbg="#0a0503", tc="#a08a64", hc="#f2dfb8", lc="#a08a64", lh="#d4a24e"),
        [aurora(k + "o", "#1c1006", "#d4a24e88", "#8b5a2b66", "#b76e7955", 12), spotlight(k + "o", "rgba(212,162,78,.16)")],
        dict(hbg="#120a06", hbr="#d4a24e44", lc="#f2dfb8", lac="#d4a24e", mc="#e8d5ae", cbg="#a5722a"),
        ("✦ عطور نيش أصلية  ·  ثبات يدوم  ·  تغليف هدايا  ·  الدفع عند الاستلام", "#0a0503", "#f2dfb8", "#d4a24e"), ("#1c1006", "#e8d5ae"),
        hfx=lambda s: [goldshimmer(k + s, 6)],
        prods=dict(cbg="#160d07", bbg="#a5722a", rad=18, fxs=[FX("بطاقة عطر", "selector .pb-pc{border:1px solid #d4a24e55;transition:transform .45s,box-shadow .45s}selector .pb-pc:hover{transform:translateY(-10px);box-shadow:0 28px 60px rgba(212,162,78,.25)}selector .pb-pc *{color:#f2dfb8}")]),
        cats=dict(imgs=["perf_bottle", "perf_rose", "perf_candle"], ov="#120a06", ovo=40, rad=50, cols=3, tc="#f2dfb8", fxs=[FX("بطاقة دائرية بحد ذهبي", "selector a,selector .pb-sc{border:1px solid #d4a24e66;transition:transform .4s,box-shadow .4s}selector a:hover,selector .pb-sc:hover{transform:translateY(-8px);box-shadow:0 24px 54px rgba(212,162,78,.3)}")]),
        fcard=lambda i: [FX("بطاقة نيش", "selector .pb-ib{border:1px solid #d4a24e44;border-radius:18px;padding:26px;background:linear-gradient(160deg,#1c1006,#120a06);height:100%;box-sizing:border-box;transition:transform .4s}selector .pb-ib:hover{transform:translateY(-8px)}"), floaty(k + "f" + str(i), ".pb-ibi", 5, 5 + i * .4)],
        ctr=[goldshimmer(k + "c", 6)], offc="#f2dfb8", offm="#e8d5ae", cdc="#f2dfb8", cpbg="#00000055")
hero = S([
    C([T("✦ عطور نيش — إصدار محدود", 15, "#d4a24e", "start", fw="800", **anim("fadeDown")),
       W("heading", text="عبقٌ يسبقك… ويظل بعدك", tag="h1", fs=dm(66, 36), fw="900", ta={"d": "start"}, color="#f2dfb8", lh={"d": 1.2}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .9)),
       T("تشكيلة عطور شرقية وفرنسية منتقاة: عود، عنبر، مسك وورد طائفي. تركيز عالٍ وثبات يدوم، مع تغليف هدايا يليق بمن تُحب.", 19, "#b8a284", "start", **anim("fadeUp", .9, .1)),
       BTN("اكتشف التشكيلة", bg="#a5722a", color="#120a06", al="start", link="#products", fxs=[btngrad("#a5722a", "#f2dfb8", "rgba(212,162,78,.5)", -3), shine(k, 3)], **anim("zoomIn", .9, .2)),
       W("tbadges", items="ثبات +12 ساعة\nتركيز بارفان\nتغليف هدية مجاني", live=True, liveText="يشاهدون الآن", lmin=11, lmax=39, cbg="#00000050", cc="#f2dfb8", cbc="#d4a24e55", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .9, .3))], w=52, va="center"),
    C([W("spacer", mh=dm(430))], w=48, va="center", **PH("perf_dark", "rgba(18,10,6,.05)", "rgba(18,10,6,.35)"),
      fxs=[rotborder(k + "ph", "#d4a24e", "#8b5a2b", 2, 6, 46), FX("صورة العطر", "selector{border-radius:46px;box-shadow:0 50px 100px rgba(0,0,0,.55);animation:npF 7s ease-in-out infinite alternate}@keyframes npF{to{transform:translateY(-12px)}}")]),
], pad=dm([100, 20, 100, 20], [56, 16, 60, 16]), gap={"d": 40}, fxs=OUD("h") + [blobs(k, "#d4a24e", "#8b5a2b", 380, .3)])
notes = S([C([W("heading", text="هرم النوتات العطرية", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#f2dfb8", fxs=[goldshimmer(k + "n", 6)], **anim("fadeUp")), T("هكذا يتطوّر عطرك على مدار اليوم.", 17, "#b8a284", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0]))]
          + [C([IB(ic, t, x, tc="#f2dfb8", xc="#b8a284", isz=40, fxs=[glass("rgba(255,255,255,.05)", "rgba(212,162,78,.3)", 16, 22), lift(".pb-ib", "rgba(212,162,78,.3)", -8), floaty(k + "n" + str(i), ".pb-ibi", 6, 4 + i * .5)], **anim("fadeUp", .7, .1 + i * .15))], w=33, pad=dm([0, 0, 20, 0])) for i, (ic, t, x) in enumerate([("sparkle", "القمة — أول رشّة", "حمضيات وبرغموت منعش يخطف الأنفاس"), ("flower", "القلب — بعد ساعة", "ورد طائفي وياسمين بلمسة دافئة"), ("star", "القاعدة — حتى المساء", "عود وعنبر ومسك بثبات عميق")])],
         pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=OUD("n"))
sillage = S([C([W("heading", text="لماذا تدوم عطورنا؟", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color="#f2dfb8", **anim("fadeUp")),
               bullets("زيوت عطرية بتركيز بارفان 20%+\nتثبيت طبيعي بلا كحول مهيّج\nقوارير زجاجية تحفظ التركيبة\nتعبئة حديثة لكل دفعة", "check-circle", "#d4a24e", "#f2dfb8", **anim("fadeUp", .7, .1))], w=50, va="center"),
            C([W("progress", pl="الثبات", pv=96, pc="#d4a24e", pbg="#ffffff14", ph=dm(14), color="#f2dfb8", fxs=[barfx("#d4a24e", "#8b5a2b")], **anim("fadeUp", .6, .1)),
               W("progress", pl="الانتشار", pv=90, pc="#d4a24e", pbg="#ffffff14", ph=dm(14), color="#f2dfb8", fxs=[barfx("#8b5a2b", "#d4a24e")], **anim("fadeUp", .6, .2)),
               W("progress", pl="نقاء التركيبة", pv=98, pc="#d4a24e", pbg="#ffffff14", ph=dm(14), color="#f2dfb8", fxs=[barfx("#b76e79", "#d4a24e")], **anim("fadeUp", .6, .3))], w=50, va="center")],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 40}, fxs=OUD("s"))
niche("s-perfume", "متجر عطور — عبق", "فخامة العود والعنبر: ذهب معدني على أسود دافئ، هرم النوتات العطرية، شرائط الثبات والانتشار، وبطاقات دائرية بحدود ذهبية.", "عطور", "El Messiri", "#120a06",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("عود   ✦   عنبر   ✦   مسك   ✦   ورد طائفي   ✦   بخور   ✦   شموع معطرة   ✦   عطور نيش", *th["mqc"]), notes, catsec(k, th, "الأقسام", "اختر عالمك العطري"), prodsec(k, th, "التشكيلة", "الأكثر طلباً هذا الأسبوع"), sillage, feat(k, th, ICONS4)] + tail(k, th))

# ───────── 2) عناية بالبشرة — «لوميير» (مختبري نظيف: أبيض وفيروزي) ─────────
k = "nl"; ICC[0] = "#0e7490"
LAB = lambda s: [FX("خلفية مختبرية", "selector{background:linear-gradient(180deg,#f8fbfb,#eef6f7)}")]
LAB2 = [FX("خلفية بيضاء", "selector{background:#ffffff}")]
th = TH(k, False, "#123d47", "#5b7a82", "#0e7490", "#14b8a6", "#ffffff", LAB, LAB2,
        dict(sbg="#0d2b33", tc="#a5ced6", hc="#ffffff", lc="#a5ced6", lh="#67e8f9"),
        [aurora(k + "o", "#0e7490", "#14b8a699", "#67e8f977", "#a5f3fc55", 12), sticker(k, "تحليل بشرة مجاني", "#ccfbf1", "#0d2b33", 130)],
        dict(hbg="#f8fbfb", hbr="#bae6fd", lc="#123d47", lac="#0e7490", mc="#123d47", cbg="#0e7490"),
        ("🧪 مكوّنات مدروسة مخبرياً  ·  استشارة مجانية  ·  الدفع عند الاستلام", "#0e7490", "#ffffff", "#cffafe"), ("#0d2b33", "#a5f3fc"),
        prods=dict(cbg="#ffffff", bbg="#0e7490", rad=24, fxs=[lift(".pb-pc", "rgba(14,116,144,.3)", -10, 2), FX("بطاقة مختبرية", "selector .pb-pc{border:1px solid #d7ecef;box-shadow:0 14px 40px rgba(14,116,144,.1)}")]),
        cats=dict(imgs=["skin_clean", "skin_cream", "skin_serum"], ov="#0d2b33", ovo=30, rad=999, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(14,116,144,.3)", -8, 3)]),
        ctr=[ctrcolor("#0e7490", "#14b8a6")])
hero = S([
    C([W("spacer", mh=dm(400))], w=44, va="center", **PH("skin_lab", "rgba(13,43,51,.04)", "rgba(13,43,51,.18)"),
      fxs=[FX("قناع دائري", "selector{border-radius:50% 50% 46% 54%/56% 52% 48% 44%;box-shadow:0 40px 80px rgba(14,116,144,.22);animation:nlM 9s ease-in-out infinite alternate}@keyframes nlM{to{border-radius:52% 48% 54% 46%/46% 54% 48% 52%;transform:translateY(-8px)}}")]),
    C([T("🧪 عناية مبنية على العلم", 15, "#0e7490", "start", fw="800", **anim("fadeDown")),
       W("heading", text="بشرة صافية بروتين بسيط ومثبت", tag="h1", fs=dm(58, 33), fw="900", ta={"d": "start"}, color="#123d47", lh={"d": 1.25}, fxs=[gradtext(k, "#0e7490", "#14b8a6", "#0e7490", 7)], **anim("fadeUp", .8)),
       T("سيرومات وكريمات بمكوّنات فعّالة بتركيزات مدروسة، بلا عطور مهيّجة ولا وعود مبالغ فيها. نرشدك لما يناسب بشرتك فعلاً.", 19, "#5b7a82", "start", **anim("fadeUp", .8, .1)),
       BTN("ابدئي روتينك", bg="#0e7490", al="start", link="#products", fxs=[btngrad("#0e7490", "#14b8a6", "rgba(14,116,144,.4)"), shine(k), pulse(k, "14,116,144", 2.4)], **anim("fadeUp", .8, .2)),
       W("tbadges", items="خالٍ من البارابين\nمختبَر جلدياً\nنتائج خلال 4 أسابيع", live=True, liveText="يتسوّقن الآن", lmin=14, lmax=42, cbg="#ffffffd0", cc="#123d47", cbc="#bae6fd", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=56, va="center"),
], pad=dm([90, 20, 100, 20], [50, 16, 56, 16]), gap={"d": 40}, fxs=[aurora(k, "#f8fbfb", "#a5f3fc88", "#99f6e466", "#e0f2fe77", 20), blobs(k, "#67e8f9", "#5eead4", 340, .45)])
skintypes = S([C([W("heading", text="روتينك حسب نوع بشرتك", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#123d47", fxs=[gradtext(k + "t", "#0e7490", "#14b8a6", "#0e7490", 7)], **anim("fadeUp")), T("اختاري نوعك ونقترح عليك الروتين الأنسب.", 17, "#5b7a82", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0]))]
              + [C([IB(ic, t, x, tc="#123d47", xc="#5b7a82", isz=36, fxs=[softcard("#ffffff", "rgba(14,116,144,.12)", 24, 24, "#d7ecef"), lift(".pb-ib", "rgba(14,116,144,.25)", -8, 2), floaty(k + "t" + str(i), ".pb-ibi", 6, 4 + i * .4)], **anim("fadeUp", .7, .08 + i * .1))], w=25, pad=dm([0, 0, 18, 0])) for i, (ic, t, x) in enumerate([("drop", "جافة", "ترطيب عميق بحمض الهيالورونيك"), ("sun", "دهنية", "توازن لطيف بلا لمعان"), ("leaf", "مختلطة", "روتين متوازن لكل منطقة"), ("heart", "حساسة", "تركيبات مهدئة بلا عطور")])],
              pad=dm([60, 20, 50, 20], [40, 16, 36, 16]), gap={"d": 16}, fxs=LAB("t"))
ingred = S([C([W("heading", text="مكوّناتنا النشطة", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color="#123d47", **anim("fadeUp")),
               bullets("نياسيناميد 10% لتوحيد اللون\nريتينول مغلّف بلا تهيّج\nفيتامين C ثابت للإشراق\nسيراميد لحاجز بشرة أقوى", "check-circle", "#0e7490", "#123d47", **anim("fadeUp", .7, .1))], w=50, va="center"),
            C([W("progress", pl="رضا المستخدمات", pv=96, pc="#0e7490", pbg="#d7ecef", ph=dm(14), color="#123d47", fxs=[barfx("#0e7490", "#14b8a6")], **anim("fadeUp", .6, .1)),
               W("progress", pl="تحسّن الترطيب", pv=93, pc="#0e7490", pbg="#d7ecef", ph=dm(14), color="#123d47", fxs=[barfx("#14b8a6", "#67e8f9")], **anim("fadeUp", .6, .2)),
               W("progress", pl="توحيد اللون", pv=89, pc="#0e7490", pbg="#d7ecef", ph=dm(14), color="#123d47", fxs=[barfx("#67e8f9", "#0e7490")], **anim("fadeUp", .6, .3))], w=50, va="center")],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 40}, fxs=LAB2)
niche("s-skincare", "متجر عناية بالبشرة — لوميير", "مختبري نظيف بأبيض فيروزي: قناع صورة عضوي متحوّل، بطاقات أنواع البشرة الأربع، مكوّنات نشطة بنِسَب وبطاقات دائرية بالكامل.", "عناية بالبشرة", "Tajawal", "#f8fbfb",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("سيروم   ✦   مرطّب   ✦   غسول   ✦   واقي شمس   ✦   ماسك   ✦   تونر   ✦   ريتينول   ✦   فيتامين C", *th["mqc"]), skintypes, prodsec(k, th), catsec(k, th, "الأقسام", "كل خطوة في روتينك"), ingred, feat(k, th, ICONS4)] + tail(k, th))

# ───────── 3) مكياج — «روج ستوديو» (تحريري جريء: أسود وأحمر) ─────────
k = "nk"; ICC[0] = "#ff2d55"
MU = lambda s: [FX("خلفية ستوديو", "selector{background:radial-gradient(60% 70% at 88% 0%,rgba(255,45,85,.12),transparent 60%),#0d0a0c}")]
MU2 = [FX("خلفية داكنة", "selector{background:#120d10}")]
th = TH(k, True, "#ffffff", "#c9a9b5", "#ff2d55", "#f5c518", "#ffffff10", MU, MU2,
        dict(sbg="#080507", tc="#c9a9b5", hc="#ffffff", lc="#c9a9b5", lh="#ff2d55"),
        [aurora(k + "o", "#1c0a12", "#ff2d5588", "#f5c51855", "#ff8fa366", 10), sticker(k, "عرض الاستوديو", "#f5c518", "#0d0a0c", 116)],
        dict(hbg="#0d0a0c", hbr="#ff2d5544", lc="#ffffff", lac="#ff2d55", mc="#f3d9e2", cbg="#c21740"),
        ("💄 شحن مجاني فوق 5000 دج  ·  ألوان حقيقية كما في الصور  ·  الدفع عند الاستلام", "#ff2d55", "#ffffff", "#ffd3dd"), ("#f5c518", "#0d0a0c"),
        hfx=lambda s: [FX("عنوان ستوديو مفرّغ", "selector .pb-t{color:transparent!important;-webkit-text-stroke:1.5px #ffffff;letter-spacing:1px}")],
        prods=dict(cbg="#160d12", bbg="#c21740", rad=4, fxs=[FX("بطاقة ستوديو", "selector .pb-pc{border:1px solid #ff2d5544;transition:transform .4s,box-shadow .4s}selector .pb-pc:hover{transform:translateY(-8px) rotate(-.5deg);box-shadow:0 26px 56px rgba(255,45,85,.22)}selector .pb-pc *{color:#ffffff}")]),
        cats=dict(imgs=["mkp_lipstick", "mkp_palette", "mkp_nails"], ov="#0d0a0c", ovo=30, rad=4, cols=3, fxs=[tiltcol(-1.5)]),
        fcard=lambda i: [FX("بطاقة تحريرية داكنة", "selector .pb-ib{border:1px solid #ff2d5555;border-radius:4px;padding:26px;background:#160d12;height:100%;box-sizing:border-box;transition:background .3s,transform .3s}selector .pb-ib:hover{background:#ff2d55;transform:translateY(-6px)}"), floaty(k + "f" + str(i), ".pb-ibi", 5, 4.5 + i * .4)],
        ctr=[FX("أرقام مفرّغة حمراء", "selector .pb-ctn{color:transparent!important;-webkit-text-stroke:2px #ff2d55;font-weight:900}")],
        offc="#ffffff", offm="#ffd3dd", cdc="#f5c518", cpbg="#00000055")
def muphoto(im, t, d):
    return C([W("heading", text=t, tag="div", fs=dm(22, 18), fw="900", ta={"d": "center"}, color="#ffffff", pad=dm([190, 12, 18, 12]), w=100, **PH(im, "rgba(13,10,12,0)", "rgba(13,10,12,.72)", pos="top"))], w=33, va="flex-end", fxs=[tiltcol(d), FX("إطار صورة", "selector{border:1px solid #ff2d5566;box-shadow:0 30px 60px rgba(0,0,0,.5)}")])
hero = S([
    C([W("heading", text="ROUGE", tag="h1", fs=dm(120, 58), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": .95}, fxs=[outlinetext("#ff2d55", 2)], **anim("slideStart", .9)),
       W("heading", text="STUDIO", tag="div", fs=dm(120, 58), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": .95}, **anim("slideStart", .9, .12)),
       T("ألوان صريحة وثبات حقيقي — مكياج يُصوَّر بلا فلاتر. اختاري درجتك واطلبي وادفعي عند الاستلام.", 20, "#c9a9b5", "start", **anim("fadeUp", .8, .25)),
       BTN("تسوّقي الألوان", bg="#c21740", al="start", link="#products", fxs=[FX("زر ستوديو", "selector .pb-btn{border-radius:0!important;border:1px solid #ff2d55;transition:transform .3s,box-shadow .3s}selector .pb-btn:hover{transform:translate(-4px,-4px);box-shadow:6px 6px 0 #ff2d55}"), shine(k, 2.6)], **anim("fadeUp", .8, .35))], w=52, va="center"),
    C([], w=48, va="center", pad=dm([340, 20, 20, 20]), **PH("mkp_flat", "rgba(13,10,12,.15)", "rgba(13,10,12,.5)"),
      fxs=[tiltcol(2), rotborder(k + "ph", "#ff2d55", "#f5c518", 2, 5, 4), FX("صورة الهيرو", "selector{box-shadow:0 40px 90px rgba(0,0,0,.6)}")]),
], pad=dm([80, 20, 90, 20], [46, 16, 50, 16]), gap={"d": 36}, fxs=MU("h") + [blobs(k, "#ff2d55", "#f5c518", 320, .28)])
bigm = S([C([W("marquee", mqt="MATTE   ✦   GLOW   ✦   VELVET   ✦   SATIN   ✦   24H WEAR   ✦   CRUELTY FREE", mqs=24, mqd="rtl", mqg=dm(56), mqp=True, mqbg="#ff2d55", mqc="#ffffff", fs=dm(40, 26), fw="900", fxs=[marqueefx()])], w=100)], layout="full", pad=dm([0, 0, 0, 0]))
lessons = S([C([W("heading", text="دروس سريعة من الاستوديو", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#ffffff", fxs=[gradtext(k + "l", "#ff2d55", "#f5c518", "#ff2d55", 6)], **anim("fadeUp")), T("ثلاث خطوات لإطلالة تدوم.", 17, "#c9a9b5", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0]))]
            + [C([IB(ic, t, x, tc="#ffffff", xc="#c9a9b5", isz=42, fxs=th["fcard"](i), **anim("fadeUp", .7, .1 + i * .15))], w=33, pad=dm([0, 0, 20, 0])) for i, (ic, t, x) in enumerate([("drop", "1 · التمهيد", "برايمر يثبّت الإطلالة ويملّس الملمس"), ("sparkle", "2 · اللون", "درجات مصطبغة بكثافة تُبنى تدريجياً"), ("check-circle", "3 · التثبيت", "بخاخ تثبيت لثبات يدوم حتى 24 ساعة")])],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=MU2)
strip3 = S([muphoto("mkp_lipstick", "الشفاه", -2), muphoto("mkp_brush", "الأدوات", 1.5), muphoto("mkp_nails", "الأظافر", -1)],
           pad=dm([50, 20, 60, 20], [34, 16, 44, 16]), gap={"d": 16}, fxs=MU("s"))
niche("s-makeup", "متجر مكياج — روج ستوديو", "ستوديو تحريري داكن: عنوان مفرّغ ضخم، صور مائلة بإطارات نيون، شريط أحمر عملاق، وعرض يظهر مبكراً بعد المنتجات مباشرة.", "مكياج", "Changa", "#0d0a0c",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, bigm, prodsec(k, th, "الأكثر مبيعاً", "درجات تنفد بسرعة"), offer(k, th, th["offfx"], th["offc"], th["offm"]), lessons, strip3, catsec(k, th, "الأقسام", "اختاري لوحة ألوانك"),
       S(stats(th, [(3800, "+", "", "زبونة سعيدة"), (120, "+", "", "درجة لون"), (24, "", "h", "ثبات يدوم"), (58, "", "", "ولاية نغطيها")], th["ctr"]), pad=dm([50, 20, 20, 20], [34, 16, 16, 16]), gap={"d": 16}, fxs=MU("d")),
       S(tests(th, th["tsfx"]), pad=dm([20, 20, 60, 20], [16, 16, 40, 16]), gap={"d": 20}, fxs=MU("e")),
       faq(th, MU("f"), th["accfx"]), foot(**th["foot"])])

# ───────── 4) أزياء نسائية — «أتيليه نوا» (أزياء محتشمة: كريمي وعنّابي) ─────────
k = "nw2"; ICC[0] = "#862c4a"
NOA = lambda s: [FX("خلفية أتيليه", "selector{background:linear-gradient(180deg,#f7f1e8,#f1e7da)}")]
NOA2 = [FX("خلفية رملية", "selector{background:#f3ead9}")]
th = TH(k, False, "#5b2333", "#8a6a72", "#862c4a", "#c99e6f", "#ffffff", NOA, NOA2,
        dict(sbg="#3a1622", tc="#d9b8c2", hc="#ffffff", lc="#d9b8c2", lh="#e9c8a8"),
        [aurora(k + "o", "#5b2333", "#862c4a99", "#c99e6f66", "#f7f1e844", 12), ribbon("قصّة الأتيليه", "#e9c8a8", "#5b2333")],
        dict(hbg="#f7f1e8", hbr="#e5d3c2", lc="#5b2333", lac="#862c4a", mc="#5b2333", cbg="#862c4a"),
        ("✦ قصّات محتشمة أنيقة  ·  تبديل المقاس مجاني  ·  الدفع عند الاستلام", "#5b2333", "#f7f1e8", "#e9c8a8"), ("#862c4a", "#f7f1e8"),
        hfx=lambda s: [FX("عنوان أتيليه", "selector .pb-t{font-style:normal;letter-spacing:.5px;text-decoration:underline;text-decoration-color:#c99e6f;text-decoration-thickness:3px;text-underline-offset:10px}")],
        prods=dict(cbg="#ffffff", bbg="#862c4a", rad=2, fxs=[FX("بطاقة أتيليه", "selector .pb-pc{border:0;border-radius:2px;box-shadow:0 18px 44px rgba(91,35,51,.12);transition:transform .5s cubic-bezier(.2,.8,.2,1)}selector .pb-pc:hover{transform:translateY(-8px)}selector .pb-pc img{transition:transform .8s}selector .pb-pc:hover img{transform:scale(1.05)}")]),
        cats=dict(imgs=["wm_dress", "wm_hijab", "wm_bag"], ov="#3a1622", ovo=35, rad=2, cols=3, fxs=[zoomcol("rgba(91,35,51,.35)")]),
        fcard=lambda i: [FX("بطاقة قماش", "selector .pb-ib{border:1px solid #e5d3c2;border-radius:2px;padding:28px;background:#fffdf8;height:100%;box-sizing:border-box;border-top:3px solid #862c4a;transition:transform .35s}selector .pb-ib:hover{transform:translateY(-6px)}"), floaty(k + "f" + str(i), ".pb-ibi", 5, 4.6 + i * .4)],
        ctr=[ctrcolor("#862c4a", "#c99e6f")], accfx=[accfx("#fffdf8", "#e5d3c2", 2)])
hero = S([
    C([T("— أتيليه نوا · مجموعة الموسم —", 15, "#862c4a", "start", fw="800", **anim("fadeDown")),
       W("heading", text="أناقة محتشمة، بقصّة تليق بكِ", tag="h1", fs=dm(60, 34), fw="900", ta={"d": "start"}, color="#5b2333", lh={"d": 1.25}, fxs=[gradtext(k, "#5b2333", "#862c4a", "#c99e6f", 8)], **anim("fadeUp", .8)),
       T("فساتين وأطقم وأزياء محتشمة بخامات مريحة وقصّات مدروسة. صُممت لتُلبس كل يوم، لا لتبقى في الخزانة.", 19, "#8a6a72", "start", **anim("fadeUp", .8, .1)),
       BTN("تسوّقي المجموعة", bg="#862c4a", al="start", link="#products", fxs=[btngrad("#862c4a", "#c99e6f", "rgba(134,44,74,.4)"), shine(k)], **anim("fadeUp", .8, .2)),
       W("tbadges", items="خامات مريحة\nقصّات محتشمة\nتبديل مجاني", live=True, liveText="يتصفّحن الآن", lmin=13, lmax=40, cbg="#ffffffcc", cc="#5b2333", cbc="#e5d3c2", crad=dm(2), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=52, va="center"),
    C([W("spacer", mh=dm(420))], w=48, va="center", **PH("wm_abaya", "rgba(59,22,34,.05)", "rgba(59,22,34,.2)"),
      fxs=[FX("صورة الأتيليه", "selector{border-radius:220px 220px 4px 4px;border:6px solid #fffdf8;box-shadow:0 40px 80px rgba(91,35,51,.25)}"), floaty(k + "ph", "selector", 6, 6)]),
], pad=dm([90, 20, 100, 20], [52, 16, 56, 16]), gap={"d": 40}, fxs=NOA("h") + [blobs(k, "#e9c8a8", "#d9b8c2", 300, .5)])
guide = S([C([W("heading", text="كيف نختار قطعنا؟", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#5b2333", **anim("fadeUp"))], w=100, pad=dm([0, 0, 26, 0]))]
          + [C([IB(ic, t, x, tc="#5b2333", xc="#8a6a72", isz=40, fxs=th["fcard"](i), **anim("fadeUp", .7, .1 + i * .15))], w=33, pad=dm([0, 0, 20, 0])) for i, (ic, t, x) in enumerate([("leaf", "خامة أولاً", "أقمشة تتنفّس وتدوم بعد الغسيل"), ("shield-check", "قصّة محتشمة", "تغطية كاملة بلا تنازل عن الأناقة"), ("sparkle", "تنسيق سهل", "قطع تتركّب مع بعضها بلا مجهود")])],
         pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=NOA2)
sizew = S([C([W("heading", text="دليل المقاسات", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#5b2333", **anim("fadeUp")),
              W("table", tbl="المقاس | الصدر | الخصر | طول الفستان\nS | 88 | 70 | 135\nM | 94 | 76 | 138\nL | 100 | 82 | 141\nXL | 106 | 88 | 144", thead=True, tzb=True, thbg="#862c4a", thc="#ffffff", tbd="#e5d3c2", tbfs=dm(17), tbal="center", fxs=[FX("جدول الأتيليه", "selector table{background:#fffdf8;border-radius:2px;overflow:hidden;box-shadow:0 18px 44px rgba(91,35,51,.1)}")], **anim("fadeUp", .8, .1))], w=100)],
          cw={"d": 780}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=NOA("z"))
niche("s-women", "متجر أزياء نسائية — أتيليه نوا", "أزياء محتشمة بروح الأتيليه: كريمي وعنّابي، صورة هيرو بقوس عالٍ، خطوات اختيار القماش وجدول مقاسات الفساتين.", "أزياء نسائية", "Amiri", "#f7f1e8",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("فساتين   ✦   أطقم   ✦   عبايات   ✦   أزياء محتشمة   ✦   حقائب   ✦   أحذية   ✦   أوشحة", *th["mqc"]), catsec(k, th, "الأقسام", "تسوّقي حسب احتياجك"), prodsec(k, th, "وصل حديثاً", "اختيارات الأتيليه لهذا الموسم"), guide, sizew, feat(k, th, ICONS4)] + tail(k, th))

# ───────── 5) أزياء رجالية — «غرين» (خياطة رجالية: فحمي وشبكة سويسرية) ─────────
k = "ng"; ICC[0] = "#c8a24b"
GRN = lambda s: [FX("خلفية فحمية بشبكة", "selector{background:#0e1116}"), gridbg(k + s, "rgba(200,162,75,.06)", 52)]
th = TH(k, True, "#e8e4da", "#9aa3ad", "#c8a24b", "#64748b", "#ffffff08", GRN, GRN,
        dict(sbg="#08090c", tc="#9aa3ad", hc="#e8e4da", lc="#9aa3ad", lh="#c8a24b"),
        [aurora(k + "o", "#161a20", "#c8a24b77", "#64748b55", "#e8e4da33", 10), FX("إطار سويسري", "selector{border:1px solid #c8a24b66;box-shadow:0 0 0 8px rgba(200,162,75,.08)}")],
        dict(hbg="#0e1116", hbr="#c8a24b44", lc="#e8e4da", lac="#c8a24b", mc="#c3c9d1", cbg="#9a7734"),
        ("— قياس مجاني عند التسليم  ·  تبديل خلال 7 أيام  ·  الدفع عند الاستلام", "#0e1116", "#e8e4da", "#c8a24b"), ("#161a20", "#c8a24b"),
        hfx=lambda s: [FX("عنوان سويسري", "selector .pb-t{letter-spacing:-.5px;text-transform:none;border-inline-start:5px solid #c8a24b;padding-inline-start:16px}")],
        prods=dict(cbg="#161a20", bbg="#9a7734", rad=2, fxs=[FX("بطاقة خياطة", "selector .pb-pc{border:1px solid #ffffff14;transition:transform .4s,border-color .4s}selector .pb-pc:hover{transform:translateY(-8px);border-color:#c8a24b}selector .pb-pc *{color:#e8e4da}")]),
        cats=dict(imgs=["men_suit", "men_shirt", "men_watch"], ov="#0e1116", ovo=45, rad=2, cols=3, fxs=[FX("بطاقة شبكية", "selector a,selector .pb-sc{border:1px solid #ffffff1a;transition:border-color .3s,transform .3s}selector a:hover,selector .pb-sc:hover{border-color:#c8a24b;transform:translateY(-6px)}")]),
        fcard=lambda i: [FX("بطاقة رقمية", "selector .pb-ib{border:1px solid #ffffff14;border-radius:2px;padding:26px;background:#12151b;height:100%;box-sizing:border-box;position:relative}selector .pb-ib::before{content:\"0" + "%s\";position:absolute;top:14px;inset-inline-end:16px;font-size:13px;color:#c8a24b;letter-spacing:2px}" % (i + 1))],
        ctr=[FX("أرقام مفرّغة نحاسية", "selector .pb-ctn{color:transparent!important;-webkit-text-stroke:1.5px #c8a24b;font-weight:900}")],
        tsfx=[tscard("#12151b", "#ffffff1a", 2, "#e8e4da"), lift(".pb-ts", "rgba(200,162,75,.25)", -8)],
        accfx=[accfx("#12151b", "#ffffff1a", 2)], offc="#e8e4da", offm="#9aa3ad", cdc="#c8a24b", cpbg="#00000055")
hero = S([
    C([T("NG — TAILORED FOR YOU", 14, "#c8a24b", "start", fw="800", **anim("fadeDown")),
       W("heading", text="البدلة التي تُقاس بك، لا تُقاس عليها", tag="h1", fs=dm(56, 32), fw="900", ta={"d": "start"}, color="#e8e4da", lh={"d": 1.25}, **anim("fadeUp", .8)),
       T("بدلات وقمصان وأحذية رجالية بقصّات نظيفة وخامات ثقيلة. نرشدك للمقاس الصحيح، ونبدّل مجاناً إن لم يضبط.", 19, "#9aa3ad", "start", **anim("fadeUp", .8, .1)),
       BTN("تصفّح المجموعة", bg="#9a7734", color="#0e1116", al="start", link="#products", fxs=[FX("زر سويسري", "selector .pb-btn{border-radius:0!important;border:1px solid #c8a24b;transition:background .3s,color .3s}selector .pb-btn:hover{background:transparent!important;color:#e8e4da!important}")], **anim("fadeUp", .8, .2)),
       W("tbadges", items="خامات ثقيلة\nقصّة سليم وكلاسيك\nتبديل مجاني", live=True, liveText="يتصفحون الآن", lmin=9, lmax=31, cbg="#ffffff10", cc="#e8e4da", cbc="#c8a24b55", crad=dm(2), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=52, va="center"),
    C([W("spacer", mh=dm(430))], w=48, va="center", **PH("men_blazer", "rgba(14,17,22,.05)", "rgba(14,17,22,.3)"),
      fxs=[FX("صورة بإطار مزدوج", "selector{border:1px solid #c8a24b;outline:1px solid #c8a24b55;outline-offset:10px;box-shadow:0 40px 80px rgba(0,0,0,.5)}")]),
], pad=dm([90, 20, 90, 20], [50, 16, 50, 16]), gap={"d": 40}, fxs=GRN("h"))
specm = S([C([W("heading", text="دليل القياس", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#e8e4da", **anim("fadeUp")),
              W("table", tbl="المقاس | الصدر | الكتف | طول الجاكيت\n46 | 92 | 42 | 70\n48 | 97 | 44 | 72\n50 | 102 | 46 | 74\n52 | 107 | 48 | 76", thead=True, tzb=True, thbg="#9a7734", thc="#0e1116", tbd="#ffffff1e", tbfs=dm(17), tbal="center", fxs=[FX("جدول القياس", "selector table{color:#e8e4da;background:#12151b;border-radius:2px;overflow:hidden;border:1px solid #c8a24b44}")], **anim("fadeUp", .8, .1))], w=100)],
          cw={"d": 780}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=GRN("m"))
niche("s-men", "متجر أزياء رجالية — غرين", "خياطة رجالية على شبكة سويسرية: فحمي ونحاسي، بطاقات مرقّمة، إطار صورة مزدوج، جدول قياس الجاكيت وعناوين بشريط جانبي.", "أزياء رجالية", "Noto Kufi Arabic", "#0e1116",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("SUITS   ✦   BLAZERS   ✦   SHIRTS   ✦   OXFORD   ✦   WATCHES   ✦   LEATHER   ✦   TAILORED", *th["mqc"]), prodsec(k, th, "المجموعة", "قطع مختارة بعناية"), specm, catsec(k, th, "الأقسام", "كل ما يحتاجه رجل أنيق"), feat(k, th, [("shield-check", "خامة مضمونة", "أقمشة ثقيلة تدوم"), ("refresh", "تبديل مجاني", "خلال 7 أيام"), ("truck", "توصيل لكل الولايات", "24 – 72 ساعة"), ("cash", "الدفع عند الاستلام", "عاين ثم ادفع")])] + tail(k, th, skipstats=True))

# ───────── 6) أطفال وألعاب — «بوبون» (حلوى مرحة: أصفر ووردي وسماوي) ─────────
k = "nb2"; ICC[0] = "#ff5d8f"
CANDY = lambda s: [FX("خلفية حلوى", "selector{background-color:#fff9ec;background-image:radial-gradient(#ff5d8f18 2px,transparent 2px),radial-gradient(#38bdf814 2px,transparent 2px);background-size:34px 34px,34px 34px;background-position:0 0,17px 17px}")]
CANDY2 = [FX("خلفية كريمية", "selector{background:#fffdf4}")]
th = TH(k, False, "#3d2c10", "#7a6a4a", "#ff5d8f", "#38bdf8", "#ffffff", CANDY, CANDY2,
        dict(sbg="#3d2c10", tc="#ffe3a3", hc="#ffffff", lc="#ffe3a3", lh="#7dd3fc"),
        [aurora(k + "o", "#ff5d8f", "#ffb3c966", "#7dd3fc66", "#fde04766", 12), sticker(k, "هدية مع كل طلب", "#fde047", "#3d2c10", 122)],
        dict(hbg="#fff9ec", hbr="#ffd6a5", lc="#3d2c10", lac="#ff5d8f", mc="#3d2c10", cbg="#ff5d8f"),
        ("🎈 شحن مجاني فوق 4000 دج  ·  هدية مفاجأة مع كل طلب  ·  الدفع عند الاستلام", "#ff5d8f", "#ffffff", "#fff3c4"), ("#fde047", "#3d2c10"),
        prods=dict(cbg="#ffffff", bbg="#ff5d8f", rad=30, fxs=[FX("بطاقة حلوى", "selector .pb-pc{border:3px solid #3d2c10;box-shadow:6px 6px 0 #ffd6a5;transition:transform .2s,box-shadow .2s}selector .pb-pc:hover{transform:translate(-3px,-5px) rotate(-1deg);box-shadow:10px 10px 0 #ffd6a5}")]),
        cats=dict(imgs=["kid_blocks", "kid_clothes", "kid_book"], ov="#3d2c10", ovo=30, rad=36, cols=3, fxs=[FX("بطاقة مرحة", "selector a,selector .pb-sc{border:3px solid #3d2c10;box-shadow:5px 5px 0 #7dd3fc;transition:transform .2s}selector a:hover,selector .pb-sc:hover{transform:translateY(-6px) rotate(1deg)}")]),
        fcard=lambda i: [FX("بطاقة سكر", "selector .pb-ib{background:%s;border:3px solid #3d2c10;border-radius:26px;box-shadow:6px 6px 0 #ffd6a5;padding:26px;height:100%%;box-sizing:border-box;transition:transform .2s}selector .pb-ib:hover{transform:translate(-3px,-3px) rotate(-1.5deg)}" % ["#ffe8f0", "#e0f2fe", "#fff3c4", "#e7f8e7"][i % 4]), floaty(k + "f" + str(i), ".pb-ibi", 7, 3.6 + i * .4)],
        ctr=[FX("أرقام حلوى", "selector .pb-ctn{color:#fff!important;-webkit-text-stroke:2px #3d2c10;text-shadow:4px 4px 0 #ff5d8f;font-weight:900}")],
        tsfx=[FX("رأي مرح", "selector .pb-ts{background:#fff!important;border:3px solid #3d2c10;border-radius:24px;box-shadow:6px 6px 0 #7dd3fc}"), lift(".pb-ts", "rgba(61,44,16,.2)", -6)],
        accfx=[accfx("#ffffff", "#ffd6a5", 20)], cdbg="#3d2c10", cdc="#fde047", cpbg="#ffffff")
hero = S([
    C([T("🎈 متجر الصغار المفضّل", 15, "#ff5d8f", "start", fw="900", **anim("fadeDown")),
       W("heading", text="لعبٌ يعلّم… وفرح يصل حتى الباب", tag="h1", fs=dm(58, 34), fw="900", ta={"d": "start"}, color="#3d2c10", lh={"d": 1.25}, fxs=[gradtext(k, "#ff5d8f", "#38bdf8", "#ff9f1c", 6)], **anim("zoomIn", .8)),
       T("ألعاب تعليمية وملابس مريحة وقصص محببة — كلها آمنة ومنتقاة بعناية لكل عمر. اطلب وادفع عند الاستلام.", 19, "#7a6a4a", "start", fw="700", **anim("fadeUp", .8, .1)),
       BTN("تسوّق المرح", bg="#ff5d8f", color="#ffffff", al="start", link="#products", fxs=[FX("زر حلوى", "selector .pb-btn{border:3px solid #3d2c10;box-shadow:5px 5px 0 #3d2c10;transition:transform .15s,box-shadow .15s}selector .pb-btn:hover{transform:translate(-3px,-3px);box-shadow:8px 8px 0 #3d2c10}selector .pb-btn:active{transform:translate(3px,3px);box-shadow:1px 1px 0 #3d2c10}"), shine(k, 2.6)], **anim("zoomIn", .8, .2)),
       W("tbadges", items="آمن 100%\nمعايير CE\nهدية مفاجأة", live=True, liveText="يطلبون الآن", lmin=17, lmax=49, cbg="#ffffff", cc="#3d2c10", cbc="#ffd6a5", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=54, va="center"),
    C([W("spacer", mh=dm(400))], w=46, va="center", **PH("kid_toys", "rgba(255,255,255,.02)", "rgba(61,44,16,.12)"),
      fxs=[FX("صورة فقاعة", "selector{border-radius:44% 56% 52% 48%/52% 46% 54% 48%;border:4px solid #3d2c10;box-shadow:10px 10px 0 #ffd6a5;animation:nbB 8s ease-in-out infinite alternate}@keyframes nbB{to{border-radius:54% 46% 46% 54%/48% 54% 46% 52%;transform:translateY(-10px) rotate(1.5deg)}}"), sticker(k + "h", "جديد!", "#7dd3fc", "#3d2c10", 96)]),
], pad=dm([80, 20, 90, 20], [46, 16, 56, 16]), gap={"d": 36}, fxs=CANDY("h") + [blobs(k, "#ffb3c9", "#7dd3fc", 340, .5)])
ages = S([C([W("heading", text="تسوّق حسب العمر", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#3d2c10", fxs=[gradtext(k + "a", "#ff5d8f", "#38bdf8", "#ff9f1c", 6)], **anim("fadeUp")), T("كل عمر له عالمه الخاص.", 17, "#7a6a4a", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0]))]
         + [C([IB(ic, t, x, tc="#3d2c10", xc="#7a6a4a", isz=42, fxs=th["fcard"](i), **anim("zoomIn", .7, .1 + i * .12))], w=33, pad=dm([0, 0, 20, 0])) for i, (ic, t, x) in enumerate([("heart", "0 – 3 سنوات", "ألعاب حسية وملابس قطنية ناعمة"), ("star", "3 – 6 سنوات", "مكعبات وألغاز وقصص ما قبل النوم"), ("zap", "6 – 12 سنة", "ألعاب ذكاء وتحدّيات وهوايات")])],
        pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=CANDY2)
safety = S([C([W("heading", text="أمان أطفالكم أولاً", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color="#3d2c10", **anim("fadeUp")),
               bullets("مواد آمنة بلا أجزاء حادة أو سامة\nألعاب مطابقة لمعايير CE\nملابس قطنية مضادة للحساسية\nإرجاع سهل إن لم يعجب طفلك", "check-circle", "#ff5d8f", "#3d2c10", **anim("fadeUp", .7, .1))], w=50, va="center"),
            C([W("stock", smode="manual", sn=17, smax=60, stx="🎁 بقيت {n} هدية مفاجأة هذا الأسبوع!", color="#3d2c10", sbgc="#fff3c4", fs=dm(19, 15), fxs=[stockbar(k), FX("لوحة الهدية", "selector{background:#fff;border:3px solid #3d2c10;border-radius:22px;box-shadow:6px 6px 0 #ffd6a5;padding:20px}")], **anim("zoomIn", .8, .2)),
               W("countdown", mode="daily", cbg="#3d2c10", color="#fde047", fs=dm(36, 26), crad=dm(14), al={"d": "center"}, fxs=[cdglow(k, "#ff5d8f")], **anim("zoomIn", .8, .3))], w=50, va="center")],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 40}, fxs=CANDY("s"))
niche("s-kids", "متجر أطفال وألعاب — بوبون", "حلوى مرحة: خلفية منقّطة بألوان الفاكهة، بطاقات بظلال صلبة ترتفع بمرح، صورة فقاعة متحوّلة، تسوق حسب العمر وعدّاد هدايا.", "أطفال وألعاب", "Almarai", "#fff9ec",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("مكعبات   ✦   ألغاز   ✦   دمى   ✦   قصص   ✦   ملابس   ✦   ألعاب ذكاء   ✦   رسم وتلوين", *th["mqc"]), ages, catsec(k, th, "الأقسام", "اختاروا ما يحبّه صغاركم"), prodsec(k, th, "الأكثر حبّاً", "ألعاب وملابس تنفد بسرعة"), safety, feat(k, th, ICONS4)] + tail(k, th))
