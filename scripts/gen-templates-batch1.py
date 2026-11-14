# ═════════ الدفعة 1 من تحديث القوالب القديمة (5 قوالب مجال): s-jewelry · s-cosmetics · s-honey · s-herbs · s-fashion ═════════
# تُنفَّذ بعد gen-templates-pilots.py (تعيد استعمال مساعداته: _pilot_*, V, FR, FT, FH, canvas, focus, ratioframe, cardratio).
# كل قالب بمولّد معرّفات معزول وبهوية وهيرو وطريقة عرض منتجات وسرد مختلفة؛ كل صور الأصل ومراجعها محفوظة (تدقّقها tests/batch-image-audit.py).
# المنتجات التجريبية (dp) وبلاطات الفئات الأصلية كما هي؛ لا صور مضافة.

# ═══════════════════ s-jewelry — لؤلؤة: كولاج دوائر + منتج مُبرَز ═══════════════════
_pilot_begin("s-jewelry")
k = "nj"; ICC[0] = "#b76e79"
ROSE, ROSE2, WINE, MJ, PALE = "#b76e79", "#d4a373", "#4a1c2b", "#8a6270", "#f0d9d2"
CHJ = lambda s: [FX("خلفية شامبانيا", "selector{background:linear-gradient(180deg,#fdf6ee,#f8e9e4)}")]
CREAM = [FX("خلفية كريمية", "selector{background:#fffaf6}")]
thj = TH(k, False, WINE, MJ, ROSE, ROSE2, "#ffffff", CHJ, CREAM,
         dict(sbg="#2f1019", tc="#e6c7ce", hc="#ffffff", lc="#e6c7ce", lh="#f3c6cd"),
         [aurora(k + "o", WINE, "#b76e7999", "#d4a37366", "#f3c6cd55", 12), sparkle(k + "o", "#ffffff")],
         dict(hbg="#fdf6ee", hbr=PALE, lc=WINE, lac=ROSE, mc=WINE, cbg=ROSE),
         ("💎 ذهب عيار 18 وفضة 925  ·  شهادة أصالة مع كل قطعة  ·  تغليف هدايا مجاني", WINE, "#fbe8ea", "#f3c6cd"), ("#f8e9e4", WINE),
         hfx=lambda s: [gradtext(k + s, WINE, ROSE, ROSE2, 8)], ctr=[ctrcolor(ROSE, ROSE2)],
         cdc="#f3c6cd", cpbg="#ffffff22")
CIRCLE = lambda ring=True: FX("دائرة بإطار وردي", "selector .pb-im{border-radius:50%%;width:100%%;height:100%%;object-fit:cover;object-position:[[p]]}%s" % ("selector{transition:transform .6s cubic-bezier(.2,.8,.2,1)}selector:hover{transform:scale(1.04)}selector::after{content:\"\";position:absolute;inset:-12px;border:1px solid rgba(183,110,121,.55);border-radius:50%;pointer-events:none}" if ring else ""), p=("نقطة التركيز (س% ص%)", "text", "50% 50%"))
def jlabel(i, x, y, w, text):
    return FR("button", x, y, w, 40, 7, text=text, kind="link", link="#cats", bgc="#ffffff", color=WINE, hbg=ROSE, fs=15, fw="800", brad={"d": 999}, hm=True, ht=True,
              fxs=[FX("حبّة وردية", "selector .pb-btn{border:1px solid #f0d9d2;box-shadow:0 8px 22px rgba(183,110,121,.18);transition:all .3s}selector .pb-btn:hover{background:#b76e79;color:#fff;transform:translateY(-3px)}")], **anim("fadeUp", .7, .5 + i * .12))
hero_j = [
    FT("✦ ELEGANCE IN EVERY DETAIL ✦", V(52, 6, 6), V(110, 24, 40), V(46, 88, 88), V(14, 13, 14), ROSE, "start", 6, "800", **anim("fadeDown", .7)),
    FR("heading", V(52, 6, 6), V(142, 56, 72), V(46, 88, 88), None, 6, text="مجوهرات تحكي قصتك", tag="h1", fs=V(66, 36, 52), fw="900", ta={"d": "start"}, color=WINE, lh={"d": 1.2}, fxs=[gradtext(k, WINE, ROSE, ROSE2, 8)], **anim("fadeUp", .9)),
    FT("قطع من الذهب عيار 18 والفضة الخالصة بتصاميم خالدة، تُهدى وتُورَّث. شهادة أصالة وتغليف هدايا مع كل قطعة.", V(52, 6, 6), V(300, 112, 150), V(42, 88, 88), V(19, 15, 17), MJ, "start", 6, "500", **anim("fadeUp", .9, .1)),
    FR("button", V(76, 30, 72), V(430, 214, 262), V(22, 64, 22), V(58, 50, 54), 6, text="اكتشفي المجموعة", kind="link", link="#products", bgc=ROSE, color="#ffffff", hbg=ROSE, fs=V(18, 16, 17), fw="800", brad={"d": 999},
       fxs=[btngrad(ROSE, ROSE2, "rgba(183,110,121,.45)"), shine(k, 3)], **anim("zoomIn", .9, .2)),
    FR("shape", 88, 512, 10, 2, 5, shape="rect", fill=ROSE2, keep=False, hm=True, ht=True, **anim("fadeIn", .9, .4)),
    # عنقود الدوائر: الصور الأصلية الثلاث (القلائد/الخواتم/الأساور) صارت هنا بدل شريط الأعمدة
    FR("image", V(12, 26, 26), V(150, 336, 380), V(30, 50, 40), V(330, 207, 328), 3, src=IMG("jewel_ring"), alt="خاتم بحجر على سطح لامع", fit="cover", hauto=False, fxs=[CIRCLE()], **anim("zoomIn", 1, .1)),
    FR("image", V(2, 4, 12), V(70, 300, 330), V(15, 28, 20), V(165, 109, 164), 4, src=IMG("jewel_moon"), alt="قلادة هلال ذهبية", fit="cover", hauto=False, fxs=[CIRCLE(), floaty(k + "m", ".pb-im", 8, 6)], **anim("zoomIn", 1, .3)),
    FR("image", V(35, 58, 58), V(350, 440, 520), V(15, 34, 20), V(165, 133, 164), 4, src=IMG("jewel_gold"), alt="سوار ذهبي مرصّع", fit="cover", hauto=False, fxs=[CIRCLE(), floaty(k + "g", ".pb-im", 8, 7)], **anim("zoomIn", 1, .5)),
    jlabel(0, 21, 500, 12, "الخواتم"), jlabel(1, 1, 250, 11, "القلائد"), jlabel(2, 34, 530, 14, "الأساور"),
    FR("shape", 5, 430, 1.2, 14, 2, shape="ellipse", fill=ROSE2, keep=False, hm=True, ht=True, fxs=[pulse(k + "d1", "212,163,115", 3)]),
    FR("shape", 46, 120, 1, 12, 2, shape="ellipse", fill=ROSE, keep=False, hm=True, ht=True, fxs=[pulse(k + "d2", "183,110,121", 3.4)]),
]
w_hero = canvas(hero_j, dm(640, 620, 760), [aurora(k, "#fdf6ee", "#f3c6cd99", "#fde68a66", "#d4a37355", 18), sparkle(k, ROSE2)])
w_cats = S([C([W("anchor", aid="cats", aoff=dm(80)), *title("المجموعات", "اختاري ما يناسب ذوقك", k, thj, thj["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("jewel_leaf"), "dl": "قلائد وسلاسل"}, {"cat": "hair", "label": "", "img": IMG("jewel_studs"), "dl": "خواتم"}, {"cat": "honey", "label": "", "img": IMG("jewel_chain"), "dl": "أقراط وأطقم"}],
                 cols=dm(3, 1, 3), gap=dm(22, 14), rad=dm(6), fs=dm(17), tc="#ffffff", ov=WINE, ovo=30, ratio="1/1",
                 fxs=[FX("قوس علوي", "selector .pb-sci{border-radius:999px 999px 8px 8px;overflow:hidden;border:1px solid #f0d9d2}"), zoomcol("rgba(183,110,121,.35)")])], w=100)],
           pad=dm([40, 20, 60, 20], [24, 16, 40, 16]), fxs=CREAM)
_pj = dict(btn="اطلب الآن", showOld=True, bbg=ROSE, cbg="#ffffff", rad=dm(6))
_pjfx = [lift(".pb-pc", "rgba(183,110,121,.35)", -10, 2), FX("بطاقة ناعمة", "selector .pb-pc{border:1px solid #f0d9d2;box-shadow:0 14px 40px rgba(183,110,121,.14)}")]
w_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("قطع مختارة", "الأكثر إعجاباً", k, thj, thj["hfx"]("p"))["widgets"]], w=100),
            C([W("products", mode="all", limit=1, cardw=dm(400, 330), gap=dm(18), pdemo="a", fxs=_pjfx + [cardratio("1/1"), FX("قطعة الموسم", "selector .pb-pc{outline:1px solid rgba(183,110,121,.4);outline-offset:10px}")], **_pj)], w=dm(42, 100, 42), va="start"),
            C([W("products", mode="all", limit=5, cardw=dm(280, 150), gap=dm(18, 12), pdemo="b", fxs=_pjfx + [cardratio("1/1")], **_pj)], w=dm(58, 100, 58))],
           pad=dm([40, 20, 70, 20], [24, 16, 44, 16]), gap={"d": 30, "m": 18}, fxs=CREAM)
w_gift = S([C([T("— هدية لا تُنسى —", 14, "#f3c6cd", "center", fw="800", **anim("fadeDown")),
               W("heading", text="تغليف هدايا يليق بالمناسبة", tag="h2", fs=dm(46, 30), fw="900", ta={"d": "center"}, color="#ffffff", lh={"d": 1.3}, **anim("fadeUp")),
               T("علبة مخملية، شريط ساتان، وبطاقة إهداء بخط يدك — مجاناً مع كل طلب.", 19, "#fbe8ea", "center", **anim("fadeUp", .7, .1)),
               W("tbadges", items="علبة مخملية\nشريط ساتان\nبطاقة إهداء", cbg="#ffffff22", cc="#ffffff", cbc="#f3c6cd", crad=dm(999), cfs=dm(15), gap=dm(10), jc="center", **anim("fadeUp", .7, .2)),
               W("counter", n=0, pre="", suf=" دج", label="تغليف الهدايا", fs=dm(60, 40), color="#ffffff", lc="#f3c6cd", al={"d": "center"}, **anim("zoomIn", .7, .3)),
               BTN("اطلبي هديتك", bg="#ffffff", color=WINE, link="#products", fxs=[shine(k + "g")], **anim("fadeUp", .7, .4))], w=100,
              fxs=[FX("إطار ذهبي مزدوج", "selector{border:1px solid rgba(243,198,205,.6);outline:1px solid rgba(243,198,205,.3);outline-offset:10px;border-radius:6px;background:rgba(74,28,43,.45);backdrop-filter:blur(3px)}")], pad=dm([56, 40, 56, 40], [36, 18, 36, 18]))],
          cw={"d": 880}, pad=dm([100, 20, 100, 20], [60, 16, 60, 16]), **PH("jewel_pearl", "rgba(74,28,43,.55)", "rgba(74,28,43,.8)"))
def medal(n, p, s, l, i):
    return C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(46, 30), color=ROSE, lc=MJ, fxs=[ctrcolor(ROSE, ROSE2)], **anim("zoomIn", .7, .1 + i * .1))], w=dm(25, 50), pad=dm([34, 10, 34, 10], [22, 6, 22, 6]),
             fxs=[FX("ميدالية", "selector{border:1px solid #f0d9d2;border-radius:999px;background:#fff;box-shadow:0 14px 34px rgba(183,110,121,.1)}")])
w_carat = S([medal(n, p, s, l, i) for i, (n, p, s, l) in enumerate([(18, "", "K", "ذهب عيار"), (925, "", "", "فضة خالصة"), (100, "", "%", "شهادة أصالة"), (30, "", " يوم", "ضمان واستبدال")])],
            pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 18, "m": 12}, fxs=CHJ("m"))
_pilot_reg("s-jewelry", "store", "مجوهرات", "متجر مجوهرات — لؤلؤة",
           "كولاج دوائر بصور القلائد والخواتم والأساور بإطارات وردية، فئات بأقواس، قطعة مُبرَزة بجوار شبكة مجموعة، قسم هدايا بإطار ذهبي مزدوج وميداليات عيار.",
           [bar(*thj["bar"]), hdr(**thj["hdr"]), w_hero, mq("ذهب 18K   ✦   فضة 925   ✦   ألماس   ✦   لؤلؤ   ✦   خواتم   ✦   أساور   ✦   قلائد   ✦   أقراط", *thj["mqc"]), w_cats, w_prod, w_gift, w_carat] + tail(k, thj, skipstats=True),
           {"ff": "'Amiri',sans-serif", "bg": "#fffaf6", "header": False, "footer": False})
_pilot_demo("s-jewelry", {"a": [0], "b": [1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-cosmetics — روز كريستال: صورة كاملة بخلفية القسم + بطاقة زجاجية، خط زمني للروتين، شبكة متدرّجة ═══════════════════
_pilot_begin("s-cosmetics")
k = "nc"; ICC[0] = "#e11d77"
PINK, VIOLET, PLUM, MC = "#e11d77", "#a855f7", "#4a1d33", "#8a5a6e"
ROSEBG = "selector{background:linear-gradient(180deg,#fff5f7,#ffe9f0)}"
thc = TH(k, False, PLUM, MC, PINK, VIOLET, "#ffffff", [FX("خلفية وردية", ROSEBG)], [FX("خلفية كريمية", "selector{background:#fffafb}")],
         dict(sbg="#3b1327", tc="#f5c8da", hc="#ffffff", lc="#f5c8da", lh="#f9a8d4"),
         [aurora(k + "o", PLUM, "#e11d7799", "#a855f777", "#fbbf2455", 12), sticker(k, "عيّنة مجانية", "#fde68a", PLUM, 118)],
         dict(hbg="#fff5f7", hbr="#fbcfe8", lc=PLUM, lac=PINK, mc=PLUM, cbg=PINK),
         ("✿ عيّنة مجانية مع كل طلب  ·  توصيل لكل الولايات  ·  الدفع عند الاستلام", PLUM, "#ffe4ee", "#f9a8d4"), ("#fbcfe8", PLUM), cpbg="#ffffff22", cdc="#fde68a")
GLASS = lambda s, rad=26: [FX("بطاقة زجاجية", "selector{background:rgba(255,255,255,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.85);border-radius:%dpx;box-shadow:0 30px 70px rgba(225,29,119,.18)}" % rad)]
cglass = lambda dl: [glass("rgba(255,255,255,.62)", "rgba(255,255,255,.9)", 16, 22), floaty(k + dl, ".pb-ibi", 8, 4.6)]
# الهيرو: صورة cosm_terra الأصلية خلفية القسم كاملة، بطاقة النص زجاجية، وبطاقتا الميزة (الأصل) عائمتان فوق الصورة
c_hero = S([
    C([T("✿ علم الجمال الطبيعي", 15, PINK, "start", fw="800", **anim("fadeDown")),
       W("heading", text="بشرة تتوهّج بروتين عناية يليق بكِ", tag="h1", fs=dm(54, 34), fw="900", ta={"d": "start"}, color=PLUM, lh={"d": 1.25}, fxs=[gradtext(k, PINK, VIOLET, "#f59e0b", 8)], **anim("fadeUp", .8)),
       T("مستحضرات تجميل وعناية آمنة ومختبرة بمكوّنات فعّالة. اكتشفي روتينك المثالي واطلبي الآن وادفعي عند الاستلام.", 18, MC, "start", **anim("fadeUp", .8, .1)),
       BTN("اكتشفي المجموعة", bg=PINK, al="start", link="#products", fxs=[btngrad(PINK, VIOLET, "rgba(225,29,119,.45)"), shine(k), pulse(k, "225,29,119", 2.4)], **anim("fadeUp", .8, .2)),
       W("tbadges", items="بدون بارابين\nمختبر جلدياً\nنباتي 100%", live=True, liveText="يتسوّقن الآن", lmin=18, lmax=52, cbg="#ffffffcc", cc=PLUM, cbc="#fbcfe8", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))],
      w=dm(50, 100, 64), va="center", pad=dm([46, 40, 46, 40], [28, 20, 28, 20]), fxs=GLASS("h")),
    C([IB("drop", "ترطيب 24 ساعة", "عمق وإشراقة", tc=PLUM, xc=MC, isz=34, fxs=cglass("a"), w=dm(64), al={"d": "start"}, **anim("zoomIn", .8, .2)),
       IB("sparkle", "إشراقة فورية", "نتيجة من أول استعمال", tc=PLUM, xc=MC, isz=34, fxs=cglass("b"), w=dm(64), al={"d": "end"}, **anim("zoomIn", .8, .35))],
      w=dm(50, 100, 36), va="flex-end", pad=dm([200, 0, 10, 0], [120, 0, 10, 0]))],
    pad=dm([80, 40, 80, 40], [36, 16, 36, 16]), gap={"d": 30, "m": 18}, cw={"d": 1280},
    **PH("cosm_terra", "rgba(255,245,247,.92)", "rgba(255,245,247,.05)", 90, pos="right center"), fxs=[sparkle(k, "#f9a8d4")])
def cstep(n, ic, t, x, i):
    return C([W("heading", text=str(n), tag="div", fs=dm(30, 26), fw="900", ta={"d": "center"}, color="#ffffff", lh={"d": 1},
                fxs=[FX("دائرة الخطوة", "selector .pb-t{display:block;width:76px;height:76px;line-height:76px;margin:0 auto;border-radius:50%%;background:linear-gradient(135deg,%s,%s);box-shadow:0 14px 34px rgba(225,29,119,.35);position:relative;z-index:2}" % (PINK, VIOLET))], **anim("zoomIn", .7, .1 + i * .15)),
              IB(ic, t, x, tc=PLUM, xc=MC, isz=34, fxs=[softcard("#ffffff", "rgba(225,29,119,.12)", 26, 22, "#fce7f3"), floaty(k + "s" + str(i), ".pb-ibi", 6, 4 + i * .5)], **anim("fadeUp", .7, .2 + i * .15))], w=dm(33, 100), pad=dm([0, 0, 18, 0]))
c_steps = S([C([W("heading", text="روتين العناية في 3 خطوات", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color=PLUM, fxs=[gradtext(k + "r", PINK, VIOLET, "#f59e0b", 8)], **anim("fadeUp")), T("بسيط، سريع ومثبت النتائج.", 17, MC, **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 30, 0]))]
            + [cstep(i + 1, ic, t, x, i) for i, (ic, t, x) in enumerate([("drop", "نظّفي", "غسول لطيف يزيل الشوائب بلا جفاف"), ("sparkle", "غذّي", "سيروم مركّز بمكوّنات فعّالة"), ("sun", "احمي", "كريم نهاري بحماية وترطيب")])],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=[FX("خلفية كريمية وخط الخطوات", "selector{background:#fffafb;position:relative}@media(min-width:768px){selector::before{content:\"\";position:absolute;top:calc(60px + 138px + 38px);inset-inline:24%;border-top:2px dashed #f9a8d4}}")])
c_cats = S([C([*title("روتين عنايتك", "كل ما يلزم لبشرة نضرة وشعر لامع", k, thc, thc["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("skin_gua"), "dl": "عناية بالبشرة"}, {"cat": "hair", "label": "", "img": IMG("cosm_pink"), "dl": "مستحضرات الوجه"}, {"cat": "honey", "label": "", "img": IMG("skin_dropper"), "dl": "الزيوت والسيرومات"}],
                 cols=dm(3, 1, 3), gap=dm(24, 14), rad=dm(40), fs=dm(17), tc="#ffffff", ov="#9d174d", ovo=30, ratio="1/1",
                 fxs=[FX("تدرّج بصري", "@media(min-width:768px){selector .pb-sci:nth-child(2){transform:translateY(40px)}}"), lift(".pb-sc,.pb-cat,a", "rgba(225,29,119,.35)", -8, 3)])], w=100)],
           pad=dm([60, 20, 90, 20], [40, 16, 50, 16]), fxs=[FX("خلفية وردية", ROSEBG)])
c_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("نجمات المتجر", "الأكثر طلباً من زبوناتنا", k, thc, thc["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(330, 150), gap=dm(26, 12), rad=dm(34), cbg="#ffffff", bbg=PINK, pdemo="a",
                 fxs=[lift(".pb-pc", "rgba(225,29,119,.3)", -10, 2), FX("بطاقة وردية", "selector .pb-pc{border:1px solid #fbcfe8;box-shadow:0 14px 40px rgba(225,29,119,.12)}"),
                      FX("شبكة متدرّجة", "@media(min-width:768px){selector .pb-pc:nth-child(3n+2){margin-top:44px}}"), cardratio("1/1")])], w=100)],
          pad=dm([50, 20, 80, 20], [34, 16, 44, 16]), fxs=[FX("خلفية كريمية", "selector{background:#fffafb}")])
c_lab = S([C([W("heading", text="مكوّنات فعّالة، نتائج ملموسة", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color=PLUM, **anim("fadeUp")),
              bullets("حمض الهيالورونيك لترطيب عميق\nفيتامين C لإشراقة موحّدة\nنياسيناميد لتقليل المسام\nزيوت نباتية مغذّية", "check-circle", PINK, PLUM, **anim("fadeUp", .7, .1))], w=50, va="center"),
            C([W("progress", pl="الترطيب", pv=96, pc=PINK, pbg="#fce7f3", ph=dm(14), color=PLUM, fxs=[barfx(PINK, VIOLET)], **anim("fadeUp", .6, .1)),
               W("progress", pl="إشراقة البشرة", pv=91, pc=PINK, pbg="#fce7f3", ph=dm(14), color=PLUM, fxs=[barfx("#f59e0b", PINK)], **anim("fadeUp", .6, .2)),
               W("progress", pl="نعومة الملمس", pv=94, pc=PINK, pbg="#fce7f3", ph=dm(14), color=PLUM, fxs=[barfx(VIOLET, PINK)], **anim("fadeUp", .6, .3))], w=50, va="center", pad=dm([34, 34, 34, 34], [24, 20, 24, 20]),
              fxs=GLASS("l"))],
          pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 40}, fxs=[aurora(k + "i", "#fff5f7", "#fbcfe888", "#e9d5ff66", "#fde68a55", 22)])
_pilot_reg("s-cosmetics", "store", "تجميل وعناية", "متجر تجميل — روز كريستال",
           "صورة كاملة بخلفية الهيرو مع بطاقة نص زجاجية وبطاقتي ميزة عائمتين، روتين من 3 خطوات بخط زمني متقطع، فئات متدرّجة، شبكة منتجات متدرّجة وشرائط مكوّنات في لوح زجاجي.",
           [bar(*thc["bar"]), hdr(**thc["hdr"]), c_hero, mq("عناية بالبشرة   ✦   سيروم   ✦   كريمات   ✦   أقنعة   ✦   زيوت   ✦   بدون بارابين   ✦   مختبر جلدياً   ✦   نباتي 100%", *thc["mqc"]), c_steps, c_cats, c_prod, c_lab, feat(k, thc, ICONS4)] + tail(k, thc),
           {"ff": "'Almarai',sans-serif", "bg": "#fffafb", "header": False, "footer": False})
_pilot_demo("s-cosmetics", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-honey — ذهب الخلية: صورة سداسية بشارات سداسية، مسار متعرّج، رفوف عسل ═══════════════════
_pilot_begin("s-honey")
k = "nh"; ICC[0] = "#b45309"
AMB, AMB2, BRN, MH = "#d97706", "#f59e0b", "#5a3411", "#8a6a3c"
HEX = "polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)"
thh = TH(k, False, BRN, MH, AMB, "#92400e", "#ffffff", lambda s: [honeycomb(AMB2, .16, "#fff7df")], [FX("خلفية كريمية", "selector{background:#fffbf0}")],
         dict(sbg="#3a2108", tc="#e8d3a8", hc="#ffffff", lc="#e8d3a8", lh="#fbbf24"),
         [honeycomb("#fbbf24", .22, "#7c2d12"), sticker(k, "عسل خام 100%", "#fbbf24", BRN, 120)],
         dict(hbg="#fff7df", hbr="#fde68a", lc=BRN, lac=AMB, mc=BRN, cbg=AMB),
         ("🍯 عسل طبيعي مفحوص  ·  توصيل لكل الولايات  ·  الدفع عند الاستلام", BRN, "#fef3c7", "#fbbf24"), (AMB, "#fffbeb"),
         hfx=lambda s: [gradtext(k + s, BRN, AMB, BRN, 8)], cdc="#fbbf24")
def FRW(wd, x, y, w, h, z):
    st = wd["set"]; st.update({"fx": _v(x), "fy": _v(y), "fwd": _v(w), "zi": z})
    if h is not None: st["fh"] = _v(h)
    return wd
def hexbadge(i, x, y, w, h, mx, my, mw, mh, tx, ty, ic, t, bg):
    wd = IB(ic, t, "", tc=BRN, xc=BRN, isz=30, fxs=[FX("سداسي عسلي", "selector .pb-ib{clip-path:%s;background:%s;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%%;box-sizing:border-box;padding:0;box-shadow:none;border:0}selector{filter:drop-shadow(0 14px 22px rgba(217,119,6,.35))}selector h3{font-size:15px;margin:.2rem 0 0}selector p{display:none}" % (HEX, bg)), floaty(k + "x%d" % i, "", 7, 5 + i * .6)], **anim("zoomIn", .8, .3 + i * .15))
    return FRW(wd, V(x, mx, tx), V(y, my, ty), V(w, mw, w), V(h, mh, h), 6)
h_hero_free = [
    FT("🍯 من الخلية مباشرة", V(52, 6, 6), V(100, 24, 40), V(46, 88, 88), V(15, 14, 15), "#b45309", "start", 6, "800", **anim("fadeDown", .7)),
    FR("heading", V(52, 6, 6), V(130, 52, 72), V(46, 88, 88), None, 6, text="ذهبٌ سائل من قلب الطبيعة", tag="h1", fs=V(58, 36, 52), fw="900", ta={"d": "start"}, color=BRN, lh={"d": 1.2}, fxs=[gradtext(k, BRN, AMB, BRN, 8)], **anim("fadeUp", .8)),
    FT("عسل خام غير مُسخَّن من أجود المناحل، مفحوص ومضمون الأصل. اكتشف النكهات والفوائد واطلب بكل ثقة.", V(52, 6, 6), V(290, 150, 160), V(44, 88, 88), V(18, 15, 17), MH, "start", 6, "500", **anim("fadeUp", .8, .1)),
    FR("button", V(76, 30, 72), V(400, 262, 270), V(22, 64, 22), V(56, 50, 54), 6, text="تذوّق الآن", kind="link", link="#products", bgc=AMB, color="#ffffff", hbg=AMB, fs=V(18, 16, 17), fw="800", brad={"d": 999},
       fxs=[btngrad(AMB2, "#b45309", "rgba(217,119,6,.45)"), shine(k), pulse(k, "217,119,6", 2.4)], **anim("zoomIn", .8, .2)),
    FR("tbadges", V(52, 6, 6), V(480, 340, 340), V(46, 88, 88), None, 6, items="خام 100%\nمفحوص مخبرياً\nبدون سكر مضاف", cbg="#ffffffd0", cc=BRN, cbc="#fde68a", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3)),
    # الصورة الأصلية honey_amber داخل سداسي كبير
    FR("image", V(6, 16, 14), V(70, 420, 430), V(38, 68, 72), V(500, 360, 450), 3, src=IMG("honey_amber"), alt="برطمان عسل ذهبي", fit="cover", hauto=False,
       fxs=[FX("سداسي العسل", "selector .pb-im{clip-path:%s;width:100%%;height:100%%;object-fit:cover;object-position:[[p]]}selector{filter:drop-shadow(0 40px 60px rgba(217,119,6,.4));animation:nhFl 8s ease-in-out infinite}@keyframes nhFl{50%%{transform:translateY(-10px)}}" % HEX, p=("نقطة التركيز (س% ص%)", "text", "50% 50%"))], **anim("zoomIn", 1, .1)),
    hexbadge(0, 1, 90, 13, 150, 2, 372, 28, 120, 3, 430, "shield-check", "مفحوص", "linear-gradient(135deg,#fde68a,#f59e0b)"),
    hexbadge(1, 38, 400, 13, 150, 70, 560, 28, 120, 80, 520, "shield-check", "غير مُسخَّن", "linear-gradient(135deg,#fbbf24,#d97706)"),
    hexbadge(2, 1, 300, 13, 150, 36, 560, 28, 120, 5, 650, "leaf", "بلا إضافات", "linear-gradient(135deg,#fef3c7,#fbbf24)"),
]
h_hero = canvas(h_hero_free, dm(680, 760, 720), [honeycomb(AMB2, .18, "#fff3cf"), drip(k, AMB2, 46)])
def hstep(i, ic, t, x):
    return C([IB(ic, t, x, tc=BRN, xc=MH, isz=40, fxs=[softcard("#ffffff", "rgba(217,119,6,.16)", 26, 24, "#fde68a"), lift(".pb-ib", "rgba(217,119,6,.3)", -8, 3), floaty(k + "j" + str(i), ".pb-ibi", 7, 4 + i * .5)], **anim("fadeUp", .7, .1 + i * .12))],
             w=dm(25, 100), pad=dm([0, 0, 20, 0]), fxs=[FX("تعرّج المسار", "@media(min-width:768px){selector{margin-top:%dpx}}" % (0 if i % 2 == 0 else 54))])
h_path = S([C([*title("من الخلية إلى بيتك", "أربع محطات تضمن لك النقاء والطعم الأصيل.", k, thh, thh["hfx"]("j"))["widgets"]], w=100, pad=dm([0, 0, 24, 0]))]
           + [hstep(i, ic, t, x) for i, (ic, t, x) in enumerate([("sprout", "المنحل", "مواقع نقية بعيدة عن التلوث"), ("flower", "الرحيق", "من أزهار برية ومواسم محددة"), ("shield-check", "الفحص", "تحاليل نقاء قبل التعبئة"), ("truck", "التوصيل", "إلى باب بيتك بتغليف آمن")])],
           pad=dm([70, 20, 80, 20], [44, 16, 40, 16]), gap={"d": 16}, fxs=[FX("خلفية كريمية", "selector{background:#fffbf0}"), timeline("#f59e0b")])
h_cats = S([C([*title("تشكيلة العسل", "عسل من أجود المناحل بنكهات متنوعة", k, thh, thh["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("honey_comb"), "dl": "عسل السدر"}, {"cat": "hair", "label": "", "img": IMG("honey_dipper"), "dl": "عسل الأعشاب"}, {"cat": "honey", "label": "", "img": IMG("honey_bee"), "dl": "منتجات الخلية"}],
                 cols=dm(3, 1, 3), gap=dm(26, 14), rad=dm(0), fs=dm(18), tc="#ffffff", ov=BRN, ovo=35, ratio="1/1",
                 fxs=[FX("قرص سداسي", "selector .pb-sci{clip-path:%s;border-radius:0}" % HEX), zoomcol("rgba(217,119,6,.35)")])], w=100)],
           pad=dm([40, 20, 70, 20], [24, 16, 40, 16]), fxs=[FX("خلفية عسلية", "selector{background:linear-gradient(180deg,#fffbf0,#fff3cf)}")])
h_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("عسلنا المميز", "مباشرة من النحال إلى مائدتك", k, thh, thh["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(330, 150), gap=dm(30, 12), rad=dm(26), cbg="#fffdf6", bbg=AMB, pdemo="a",
                 fxs=[lift(".pb-pc", "rgba(217,119,6,.35)", -10, 2), FX("رفّ العسل", "selector .pb-pc{border:1.5px solid #fde68a;border-bottom:12px solid #d97706;border-radius:26px 26px 6px 6px;box-shadow:0 14px 36px rgba(217,119,6,.14)}selector .pb-pgrid{row-gap:34px}"), cardratio("1/1")])], w=100)],
          pad=dm([50, 20, 80, 20], [34, 16, 44, 16]), fxs=[FX("خلفية كريمية", "selector{background:#fffbf0}")])
_pilot_reg("s-honey", "store", "عسل", "متجر عسل — ذهب الخلية",
           "صورة العسل داخل سداسي كبير تحيط به شارات سداسية، مسار متعرّج من الخلية إلى البيت، فئات بأقراص سداسية ورفوف عسل بحافة عسلية.",
           [bar(*thh["bar"]), hdr(**thh["hdr"]), h_hero, mq("عسل السدر   ✦   عسل الجبل   ✦   عسل الأزهار   ✦   عسل الخرّوب   ✦   عسل الكالبتوس   ✦   غذاء ملكات", *thh["mqc"]), h_path, h_cats, h_prod, feat(k, thh, ICONS4)] + tail(k, thh),
           {"ff": "'Almarai',sans-serif", "bg": "#fffbf0", "header": False, "footer": False})
_pilot_demo("s-honey", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-herbs — العطّار: لوحة نباتية بإطار مزدوج بين عمودين، قوائم منتجات أفقية مرقّمة ═══════════════════
_pilot_begin("s-herbs")
k = "nb"; ICC[0] = "#3f6212"
OLV, OLV2, BRW, MB = "#2f4a12", "#4d7c0f", "#78350f", "#6b5b3a"
thb = TH(k, False, OLV, MB, OLV2, BRW, "#fffaf0", lambda s: [paper("#f3ead7")], [paper("#f8f1df")],
         dict(sbg="#1f2f0a", tc="#d9d5b8", hc="#ffffff", lc="#d9d5b8", lh="#bef264"),
         [paper(OLV, "0.9,0.9,0.7", .12), ribbon("طبيعي 100%", "#bef264", "#1f2f0a")],
         dict(hbg="#f3ead7", hbr="#d6c9a2", lc=OLV, lac=BRW, mc=OLV, cbg=OLV2),
         ("🌿 أعشاب وزيوت نقية  ·  بلا إضافات كيميائية  ·  الدفع عند الاستلام", OLV, "#f3ead7", "#bef264"), (OLV2, "#f3ead7"),
         hfx=lambda s: [gradtext(k + s, "#3f6212", BRW, "#3f6212", 9)], cdc="#bef264", offc="#f3ead7", offm="#e5e7d0")
PLATE = FX("لوحة نباتية بإطار مزدوج", "selector .pb-im{border:2px solid #3f6212;outline:1px solid #3f6212;outline-offset:-12px;border-radius:4px;padding:0;box-shadow:0 30px 60px rgba(60,50,20,.28);background:#fffaf0}selector::after{content:\"لوحة رقم ١ · أعشاب الجبل\";display:block;text-align:center;font-size:14px;letter-spacing:.5px;color:#78350f;padding:10px 0 0;font-weight:700}")
b_hero = S([
    C([T("— صيدلية الطبيعة —", 15, BRW, "start", fw="800", **anim("fadeDown")),
       W("heading", text="أعشاب وزيوت أصيلة بخبرة الأجداد", tag="h1", fs=dm(54, 32), fw="900", ta={"d": "start"}, color=OLV, lh={"d": 1.3}, fxs=[gradtext(k, "#3f6212", BRW, "#3f6212", 9)], **anim("fadeUp", .8)),
       T("نختار أجود الأعشاب ونعصر الزيوت على البارد لنوصلها إليك نقية كما خلقها الله، مع دليل استعمال لكل منتج.", 19, MB, "start", **anim("fadeUp", .8, .1)),
       BTN("تصفّح العطّار", bg=OLV2, al="start", link="#products", fxs=[btngrad(OLV2, "#3f6212", "rgba(77,124,15,.4)"), shine(k)], **anim("zoomIn", .8, .2))], w=dm(38, 100), va="center"),
    C([PIC("herb_jars", "برطمانات أعشاب مجففة على رفّ", 4, hauto=False, fxs=[ratioframe("800/1200"), PLATE], **anim("zoomIn", .9, .1))], w=dm(28, 100), va="center", pad=dm([0, 0, 0, 0])),
    C([W("tbadges", items="بدون مواد حافظة\nعصر على البارد\nمخبري الفحص", live=False, cbg="#f8f1df", cc=OLV, cbc="#bfae7b", crad=dm(6), cfs=dm(15), gap=dm(10), jc="center", stack=True, **anim("fadeUp", .8, .3))], w=dm(34, 100), va="center",
      fxs=[FX("لصيقة جانبية", "selector{border-inline-start:3px double #3f6212;padding-inline-start:26px}@media(max-width:767px){selector{border:0;padding:0}}")])],
    pad=dm([80, 20, 90, 20], [46, 16, 50, 16]), gap={"d": 40, "m": 22}, fxs=[paper("#efe3c6")])
def bcard(i, ic, t, x):
    return C([IB(ic, t, x, tc=OLV, xc=MB, isz=34, al={"d": "start"}, fxs=[FX("بطاقة وصفة", "selector .pb-ib{background:#fffaf0;border:1px dashed #bfae7b;border-radius:6px;padding:20px 24px;display:grid;grid-template-columns:auto 1fr;column-gap:16px;align-items:center;text-align:start;box-shadow:0 6px 18px rgba(80,60,20,.08)}selector .pb-ibi{grid-row:span 2}selector h3,selector p{margin:0;text-align:start}"), lift(".pb-ib", "rgba(77,124,15,.25)", -4, 2)], **anim("fadeUp", .7, .08 + i * .08))],
             w=dm(50, 100), pad=dm([0, 0, 14, 0]))
b_ben = S([C([*title("فوائد من الطبيعة", "وصفات الأجداد بين يديك", k, thb, thb["hfx"]("b"))["widgets"]], w=100, pad=dm([0, 0, 24, 0]))]
          + [bcard(i, ic, t, x) for i, (ic, t, x) in enumerate([("leaf", "تهدئة وراحة", "أعشاب لتهدئة الأعصاب وصفاء الذهن"), ("heart-pulse", "دعم القلب", "زيوت غنية بالأوميغا والمضادات"), ("drop", "ترطيب وعناية", "زيوت للبشرة والشعر بلا كيمياء"), ("shield-check", "مناعة قوية", "أعشاب تقوّي الدفاعات الطبيعية"), ("sprout", "هضم أفضل", "مشروبات عشبية للراحة الهضمية"), ("sun", "نشاط وحيوية", "خلطات طبيعية للطاقة اليومية")])],
          pad=dm([60, 20, 50, 20], [40, 16, 36, 16]), gap={"d": 18}, fxs=[paper("#f8f1df")])
b_cats = S([C([*title("اختر ما تحتاجه", "أعشاب وزيوت وتوابل من العطّار", k, thb, thb["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("herb_tea"), "dl": "شاي وأعشاب"}, {"cat": "hair", "label": "", "img": IMG("oil_olive"), "dl": "زيوت طبيعية"}, {"cat": "honey", "label": "", "img": IMG("herb_rosemary"), "dl": "توابل وبذور"}],
                 cols=dm(3, 1, 3), gap=dm(24, 14), rad=dm(16), fs=dm(17), tc="#ffffff", ov=OLV, ovo=35, ratio="1/1",
                 fxs=[FX("إطار مزدوج", "selector .pb-sci{border:2px solid #3f6212;outline:1px solid #3f6212;outline-offset:-10px;border-radius:4px}"), lift(".pb-sc,.pb-cat,a", "rgba(77,124,15,.35)", -8, 2)])], w=100)],
           pad=dm([40, 20, 40, 20], [24, 16, 24, 16]), fxs=[paper("#efe3c6")])
b_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("من رفوف العطّار", "أعشاب مجففة وزيوت معصورة", k, thb, thb["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(500, 150), gap=dm(20, 12), rad=dm(14), cbg="#fffaf0", bbg=OLV2, pdemo="a",
                 fxs=[lift(".pb-pc", "rgba(77,124,15,.3)", -6, 2),
                      FX("بطاقة قائمة أفقية مرقّمة", "selector .pb-pgrid{counter-reset:bn}selector .pb-pc{flex-direction:row;align-items:stretch;border:1.5px solid #d6c9a2;box-shadow:0 10px 28px rgba(80,60,20,.12);counter-increment:bn;position:relative}@media(min-width:768px){selector .pb-pci{flex:0 0 40%;width:40%}selector .pb-pc>*:not(.pb-pci){flex:1}}selector .pb-pc::before{content:counter(bn,arabic-indic);position:absolute;top:10px;inset-inline-end:14px;z-index:3;font:900 26px Amiri,serif;color:#78350f;opacity:.8}"),
                      cardratio("1/1")])], w=100)],
          pad=dm([50, 20, 70, 20], [34, 16, 44, 16]), fxs=[paper("#f8f1df")])
b_guide = S([C([W("heading", text="دليل الاستعمال", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color=OLV, **anim("fadeUp")),
                W("accordion", items=[{"q": "كيف أستعمل زيت الأعشاب؟", "a": "مساء على بشرة نظيفة بتدليك خفيف، ثلاث مرات أسبوعياً."}, {"q": "كيف أحضّر المشروب العشبي؟", "a": "ملعقة صغيرة لكل كوب ماء مغلي، تُغطّى 5 دقائق ثم تُصفّى."}, {"q": "هل هناك آثار جانبية؟", "a": "منتجاتنا طبيعية لكن استشر طبيبك في حال الحمل أو الأمراض المزمنة."}], fxs=thb["accfx"], **anim("fadeUp", .8, .1))], w=100)],
           cw={"d": 820}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=[paper("#efe3c6")])
_pilot_reg("s-herbs", "store", "أعشاب وزيوت", "متجر أعشاب وزيوت — العطّار",
           "لوحة نباتية بإطار مزدوج وتسمية بين نصّ وشارات بخط مزدوج، بطاقات وصفات ببنود جانبية، فئات بإطارات صيدلية، وقوائم منتجات أفقية مرقّمة بالأرقام الهندية.",
           [bar(*thb["bar"]), hdr(**thb["hdr"]), b_hero, mq("البابونج   ✦   الزعتر   ✦   الحبة السوداء   ✦   زيت الأرغان   ✦   زيت الزيتون   ✦   النعناع   ✦   إكليل الجبل   ✦   الشيح", *thb["mqc"]), b_ben, b_cats, b_prod, b_guide] + tail(k, thb),
           {"ff": "'Amiri',sans-serif", "bg": "#f3ead7", "header": False, "footer": False})
_pilot_demo("s-herbs", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-fashion — إديتوريال: بوستر طباعي بصورة متداخلة، لوك بوك غير متماثل، سلايدر كبير ═══════════════════
_pilot_begin("s-fashion")
k = "nf"; ICC[0] = "#111111"
INK, GRY = "#111111", "#6b6b6b"
WH = [FX("خلفية بيضاء", "selector{background:#ffffff}")]
GR = [FX("خلفية رمادية", "selector{background:#f4f4f2}")]
thf = TH(k, False, INK, GRY, INK, "#7c3aed", "#ffffff", WH, GR,
         dict(sbg="#0a0a0a", tc="#a3a3a3", hc="#ffffff", lc="#a3a3a3", lh="#ffffff"),
         [FX("لوحة سوداء", "selector{background:#111;color:#fff}"), sticker(k, "-40%", "#ffffff", "#111", 110)],
         dict(hbg="#ffffff", hbr="#111111", lc=INK, lac=INK, mc=INK, cbg=INK),
         ("NEW SEASON — توصيل لكل الولايات  ·  استبدال مجاني خلال 7 أيام  ·  الدفع عند الاستلام", INK, "#ffffff", "#ffffff"), (INK, "#ffffff"),
         hfx=lambda s: [FX("عنوان أسود ثقيل", "selector .pb-t{letter-spacing:-.5px}")],
         ctr=[FX("أرقام مفرّغة", "selector .pb-ctn{color:transparent!important;-webkit-text-stroke:2px #111;font-weight:900}")],
         fcard=lambda i: [FX("بطاقة خطّية", "selector .pb-ib{border:1px solid #111;border-radius:0;padding:26px;height:100%;box-sizing:border-box;background:#fff;transition:background .3s,color .3s,transform .3s}selector .pb-ib:hover{background:#111;transform:translateY(-6px)}selector .pb-ib:hover *{color:#fff!important}")],
         accfx=[accfx("#ffffff", "#111111", 0)],
         tsfx=[FX("رأي مربّع", "selector .pb-ts{background:#fff!important;border:1px solid #111;border-radius:0;box-shadow:8px 8px 0 #111}"), lift(".pb-ts", "rgba(0,0,0,.2)", -6)])
f_hero_free = [
    FR("heading", V(0, 3, 3), V(40, 24, 24), V(68, 94, 94), None, 1, text="SEASON", tag="div", fs=V(170, 62, 120), fw="900", ta={"d": "start"}, color="transparent", lh={"d": 1}, fxs=[outlinetext(INK, 2)], **anim("slideStart", 1)),
    FR("image", V(44, 22, 30), V(120, 110, 150), V(26, 56, 40), V(520, 327, 492), 3, src=IMG("fashion_man"), alt="موديل بإطلالة مسائية", fit="cover", hauto=False,
       fxs=[FX("كتلة سوداء مزاحة", "selector{box-shadow:20px 20px 0 #111;overflow:hidden}selector .pb-im{object-fit:cover;width:100%;height:100%;object-position:[[p]];transition:transform 1.2s cubic-bezier(.2,.8,.2,1)}selector:hover .pb-im{transform:scale(1.04)}", p=("نقطة التركيز (س% ص%)", "text", "50% 50%"))], **anim("fadeUp", .9, .1)),
    FR("heading", V(8, 6, 6), V(290, 460, 640), V(44, 70, 60), None, 5, text="NEW", tag="h1", fs=V(190, 84, 130), fw="900", ta={"d": "start"}, color=INK, lh={"d": .9}, **anim("slideStart", .9, .2)),
    FR("heading", V(74, 6, 6), V(120, 600, 790), V(24, 88, 88), None, 6, text="LOOK 01", tag="div", fs=V(26, 20, 22), fw="900", ta={"d": "start"}, color=INK, lh={"d": 1.1}, **anim("fadeUp", .8, .4)),
    FT("مجموعة الموسم الجديد — قصّات عصرية، أقمشة فاخرة وأسعار عادلة. إطلالة مسائية بقصّة نظيفة.", V(74, 6, 6), V(170, 648, 836), V(24, 88, 88), V(17, 15, 16), GRY, "start", 6, "500", **anim("fadeUp", .8, .5)),
    FR("button", V(74, 6, 6), V(330, 764, 930), V(22, 60, 40), V(58, 52, 54), 6, text="تسوّق الإطلالة", kind="link", link="#products", bgc=INK, color="#ffffff", hbg=INK, fs=V(17, 16, 16), fw="800", brad={"d": 0},
       fxs=[FX("زر خطّي", "selector .pb-btn{border-radius:0!important;border:2px solid #111;transition:background .3s,color .3s,transform .3s}selector .pb-btn:hover{background:#fff!important;color:#111!important;transform:translateX(-6px)}")], **anim("fadeUp", .8, .6)),
    FR("shape", V(74, 6, 6), V(110, 590, 780), V(24, 88, 88), 2, 5, shape="rect", fill=INK, keep=False, **anim("fadeIn", .8, .3)),
]
f_hero = canvas(f_hero_free, dm(720, 860, 1030), WH)
def look_col(i, t, x, w, h, img):
    return C([W("heading", text="0%d" % (i + 1), tag="div", fs=dm(64, 44), fw="900", ta={"d": "start"}, color="transparent", lh={"d": 1}, fxs=[outlinetext("#ffffff", 2)], **anim("fadeIn", .8, .1 + i * .1)),
              W("heading", text=t, tag="div", fs=dm(24, 20), fw="900", ta={"d": "start"}, color="#ffffff", **anim("zoomIn", .7, .1 + i * .1)), T(x, 15, "#ffffffcc", "start", **anim("fadeUp", .7, .2 + i * .1))],
             w=dm(w, 100), va="flex-end", pad=dm([h, 22, 24, 22], [min(h, 260), 18, 22, 18]), **PH(img, "rgba(0,0,0,0)", "rgba(0,0,0,.68)", pos="top"), fxs=[zoomcol("rgba(0,0,0,.35)")])
f_look = S([C([W("heading", text="LOOKBOOK", tag="h2", fs=dm(44, 28), fw="900", ta={"d": "center"}, color=INK, **anim("fadeUp"))], w=100, pad=dm([0, 0, 24, 0]))]
           + [look_col(0, "CASUAL", "يومي مريح", 28, 360, "fashion_blue"), look_col(1, "STREET", "ستايل الشارع", 44, 520, "fashion_sneakers"), look_col(2, "CLASSIC", "أناقة كلاسيكية", 28, 360, "fashion_shirts")],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 14, "m": 12}, fxs=GR)
f_big = S([C([W("marquee", mqt="NEW COLLECTION   ✦   FREE DELIVERY   ✦   COD   ✦   RETURNS 7 DAYS", mqs=22, mqd="rtl", mqg=dm(60), mqp=True, mqbg=INK, mqc="#ffffff", fs=dm(44, 28), fw="900", fxs=[marqueefx()])], w=100)], layout="full", pad=dm([0, 0, 0, 0]))
f_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("وصل حديثاً", "اختياراتنا لهذا الموسم", k, thf, thf["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(330, 150), gap=dm(24, 12), rad=dm(0), cbg="#ffffff", bbg=INK, pdemo="a",
                 fxs=[FX("بطاقة تحريرية", "selector .pb-pc{border:0;border-radius:0;box-shadow:none;transition:transform .5s cubic-bezier(.2,.8,.2,1)}selector .pb-pc:hover{transform:translateY(-8px)}selector .pb-pc:hover img{transform:scale(1.06)}selector .pb-pc img{transition:transform .8s}selector .pb-pc .pb-pcb{border-radius:0}"),
                      FX("فسيفساء: منتج مُبرَز 2×2", "@media(min-width:768px){selector .pb-pgrid{grid-auto-flow:dense}selector .pb-pc:first-child{grid-column:span 2;grid-row:span 2}selector .pb-pc:first-child .pb-pci{aspect-ratio:1/1}}"), cardratio("1/1")])], w=100)],
          pad=dm([60, 20, 70, 20], [44, 16, 48, 16]), fxs=WH)
f_size = S([C([W("heading", text="دليل المقاسات", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color=INK, **anim("fadeUp")),
               W("table", tbl="المقاس | الصدر | الخصر | الطول\nS | 90 | 74 | 66\nM | 96 | 80 | 68\nL | 102 | 86 | 70\nXL | 108 | 92 | 72", thead=True, tzb=True, thbg=INK, thc="#ffffff", tbd=INK, tbfs=dm(17), tbal="center", **anim("fadeUp", .8, .1))], w=100)],
          cw={"d": 760}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=WH)
f_cats = S([C([*title("تسوّقي حسب الفئة", "مجموعات منسّقة لكل مناسبة", k, thf, thf["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("fashion_shirts"), "dl": "قمصان وبدلات"}, {"cat": "hair", "label": "", "img": IMG("fashion_shoe"), "dl": "أحذية"}, {"cat": "honey", "label": "", "img": IMG("fashion_man"), "dl": "ستايل رجالي"}],
                 cols=dm(3, 1, 3), gap=dm(18, 12), rad=dm(0), fs=dm(18), tc="#ffffff", ov=INK, ovo=25, ratio="1/1",
                 fxs=[FX("أبيض وأسود يتلوّن بالمرور", "selector .pb-sci{filter:grayscale(1);transition:filter .5s,transform .5s}selector .pb-sci:hover{filter:none;transform:translateY(-6px)}"), zoomcol("rgba(0,0,0,.3)")])], w=100)],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), fxs=GR)
_pilot_reg("s-fashion", "store", "أزياء", "متجر أزياء — إديتوريال",
           "بوستر طباعي: كلمة SEASON مفرّغة خلف صورة بكتلة سوداء مزاحة وكلمة NEW عملاقة متداخلة، لوك بوك غير متماثل مرقّم، شريط نصي ضخم، سلايدر كبير بحدود حادة ودليل مقاسات.",
           [bar(*thf["bar"]), hdr(**thf["hdr"]), f_hero, f_big, f_look, f_prod, f_size, f_cats] + tail(k, thf),
           {"ff": "'Noto Kufi Arabic',sans-serif", "bg": "#ffffff", "header": False, "footer": False})
_pilot_demo("s-fashion", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()
