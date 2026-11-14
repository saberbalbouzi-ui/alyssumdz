# ═════════ الدفعة 2 من تحديث القوالب القديمة (5 قوالب مجال): s-supplements · s-accessories · s-it · s-digital · s-marketplace ═════════
# تُنفَّذ بعد gen-templates-batch1.py. تستعير لوحة ألوان كل قالب (TH/الأقنعة) من تعريفه الأصلي في gen-templates-niche.py
# (هوية الألوان محفوظة) وتعيد تركيب الهيرو والمنتجات والسرد. كل صور الأصل ومراجعها محفوظة؛ لا صور مضافة (tests/batch-image-audit.py).
_NICHE_SRC = open(os.path.join(HERE, "gen-templates-niche.py"), encoding="utf-8").read()
def _theme_chunk(k_marker, end_marker):
    """يشغّل مقطع التعريف الأصلي للثيم (k/ICC/th/الأقنعة) في هذا النطاق"""
    a = _NICHE_SRC.index(k_marker); b = _NICHE_SRC.index(end_marker, a)
    exec(_NICHE_SRC[a:b], globals())
def gauge(i, D, T_, M, n, label, c1):
    """مقياس دائري: عدّاد أصلي بحلقة مخروطية (conic) قيمتها ولونها وسيطان قابلان للتعديل. D/T_/M = (x%, y, w%, h) لسطح المكتب/التابلت/الجوال"""
    wd = W("counter", n=n, suf="%", label=label, fs=dm(36, 28), color="#ffffff", lc="#9ca3af", al={"d": "center"},
           fxs=[FX("حلقة القياس", "selector{display:flex;flex-direction:column;align-items:center;justify-content:center}selector::before{content:\"\";position:absolute;inset:0;border-radius:50%;background:conic-gradient([[c]] calc([[v]]*1%),rgba(255,255,255,.12) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px));mask:radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px));filter:drop-shadow(0 0 12px [[c]])}", v=("قيمة الحلقة %", "num", n), c=("لون الحلقة", "text", c1))], **anim("zoomIn", .9, .2 + i * .15))
    return FRW(wd, V(D[0], M[0], T_[0]), V(D[1], M[1], T_[1]), V(D[2], M[2], T_[2]), V(D[3], M[3], T_[3]), 6)

# ═══════════════════ s-supplements — فيتال أكتيف: لوحة قياس رياضية بحلقات، صفوف أهداف، بروتوكول عمودي ═══════════════════
_pilot_begin("s-supplements")
_theme_chunk('k = "nu"', 'hero = S(')
LIME, CYAN = "#a3e635", "#22d3ee"
thu = th
HUDP = FX("لوح زجاجي", "selector{background:rgba(255,255,255,.05);border:1px solid rgba(163,230,53,.28);border-radius:22px;backdrop-filter:blur(10px);box-shadow:0 30px 80px rgba(0,0,0,.45)}")
u_free = [
    FR("shape", V(2, 6, 6), V(50, 470, 470), V(46, 88, 88), V(520, 400, 470), 1, shape="rect", fill="#ffffff08", keep=False, fxs=[HUDP, scan(k, "rgba(163,230,53,.9)")]),
    gauge(0, (5.5, 100, 17.3, 190), (12, 500, 22, 180), (10, 500, 38, 148), 92, "الطاقة", LIME), gauge(1, (26.5, 100, 17.3, 190), (40, 500, 22, 180), (52, 500, 38, 148), 88, "التركيز", CYAN),
    gauge(2, (5.5, 320, 17.3, 190), (12, 720, 22, 180), (10, 668, 38, 148), 95, "التعافي", "#facc15"), gauge(3, (26.5, 320, 17.3, 190), (40, 720, 22, 180), (52, 668, 38, 148), 97, "الامتصاص", "#a855f7"),
    FT("⚡ طاقة · تركيز · تعافٍ", V(52, 6, 6), V(90, 24, 40), V(46, 88, 88), V(15, 14, 15), LIME, "start", 6, "900", **anim("fadeDown", .7)),
    FR("heading", V(52, 6, 6), V(124, 54, 72), V(46, 88, 88), None, 6, text="أداء بلا حدود، من أول جرعة", tag="h1", fs=V(58, 36, 50), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.15}, fxs=[gradtext(k, LIME, CYAN, LIME, 5)], **anim("fadeUp", .8)),
    FT("مكمّلات غذائية موثوقة بتركيبات مدروسة تدعم نشاطك الرياضي واليومي. شهادات جودة وتوصيل سريع.", V(52, 6, 6), V(320, 170, 190), V(44, 88, 88), V(18, 15, 17), "#9ca3af", "start", 6, "500", **anim("fadeUp", .8, .1)),
    FR("button", V(76, 30, 72), V(430, 280, 290), V(22, 64, 22), V(56, 50, 54), 6, text="ابدأ رحلتك", kind="link", link="#products", bgc=LIME, color="#0b1220", hbg=LIME, fs=V(18, 16, 17), fw="900", brad={"d": 12},
       fxs=[btngrad(LIME, CYAN, "rgba(163,230,53,.5)"), shine(k), pulse(k, "163,230,53", 2)], **anim("zoomIn", .8, .2)),
    FR("tbadges", V(52, 6, 6), V(510, 356, 370), V(46, 88, 88), None, 6, items="شهادة جودة\nبدون مواد محظورة", live=True, liveText="يطلبون الآن", lmin=21, lmax=64, cbg="#ffffff12", cc="#e5e7eb", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3)),
]
u_hero = canvas(u_free, dm(620, 900, 980), [FX("وهج ليموني", "selector::after{content:\"\";position:absolute;inset:0;background:radial-gradient(50% 60% at 85% 0%,rgba(163,230,53,.18),transparent 60%);pointer-events:none}")], PH("supp_green", "rgba(5,7,13,.78)", "rgba(5,7,13,.94)", bgFixed=True))
def u_step(i, ic, t, x):
    return C([W("heading", text="0%d" % (i + 1), tag="div", fs=dm(72, 56), fw="900", ta={"d": "start"}, color="transparent", lh={"d": 1}, fxs=[outlinetext(LIME, 2)], **anim("fadeIn", .8, .1 + i * .15)),
              IB(ic, t, x, tc="#ffffff", xc="#9ca3af", isz=40, al={"d": "start"}, fxs=[FX("بروتوكول", "selector .pb-ib{text-align:start;border-inline-start:3px solid #a3e635;padding:6px 22px;background:linear-gradient(90deg,rgba(163,230,53,.08),transparent)}selector h3,selector p{text-align:start}"), lift(".pb-ib", "rgba(163,230,53,.25)", -4, 2)], **anim("fadeUp", .7, .2 + i * .15))],
             w=dm(33, 100), pad=dm([0, 0, 10, 0]))
u_proto = S([C([*title("كيف تعمل تركيباتنا؟", "ثلاث مراحل من التركيبة إلى النتيجة", k, thu, thu["hfx"]("h"))["widgets"]], w=100, pad=dm([0, 0, 24, 0]))]
            + [u_step(i, ic, t, x) for i, (ic, t, x) in enumerate([("pill", "تركيبة مدروسة", "عناصر نشطة بجرعات فعّالة"), ("zap", "امتصاص سريع", "تقنية تُسرّع وصول المغذّيات"), ("trophy", "نتائج ملموسة", "أداء وتعافٍ أفضل خلال أسابيع")])],
            pad=dm([70, 20, 60, 20], [44, 16, 40, 16]), gap={"d": 30}, fxs=NAVY("h"))
u_cats = S([C([*title("اختر هدفك الصحي", "مكملات لكل هدف: طاقة، عضلات، مناعة…", k, thu, thu["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("supp_veg"), "dl": "بروتين وعضلات"}, {"cat": "hair", "label": "", "img": IMG("supp_caps"), "dl": "فيتامينات ومعادن"}, {"cat": "honey", "label": "", "img": IMG("supp_smoothie"), "dl": "طاقة ومشروبات"}],
                 cols=dm(3, 1, 3), gap=dm(18, 12), rad=dm(0), fs=dm(18), tc="#ffffff", ov="#05070d", ovo=40, ratio="1/1",
                 fxs=[FX("زاوية مشطوبة مضيئة", "selector .pb-sci{clip-path:polygon(0 0,100% 0,100% 86%,86% 100%,0 100%);border:0;transition:filter .4s,transform .4s}selector .pb-sci:hover{filter:drop-shadow(0 0 18px rgba(163,230,53,.6));transform:translateY(-6px)}")])], w=100)],
           pad=dm([40, 20, 40, 20], [26, 16, 26, 16]), fxs=NAVY("c"))
def u_goal(i, name, desc, val, pd):
    return S([C([W("heading", text=name, tag="h3", fs=dm(26, 22), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp")),
                 T(desc, 15, "#9ca3af", "start", **anim("fadeUp", .7, .1)),
                 W("progress", pl="ملاءمة الهدف", pv=val, pc=LIME, pbg="#ffffff1a", ph=dm(10), color="#e5e7eb", fxs=[barfx(LIME, CYAN)], **anim("fadeUp", .7, .2))],
                w=dm(32, 100), va="center", pad=dm([26, 26, 26, 26], [20, 18, 20, 18]), fxs=[HUDP]),
              C([W("products", mode="all", limit=2, btn="اطلب الآن", showOld=True, cardw=dm(300, 150), gap=dm(18, 12), rad=dm(18), cbg="#ffffff", bbg="#65a30d", pdemo=pd,
                   fxs=[lift(".pb-pc", "rgba(163,230,53,.35)", -8, 3), cardratio("1/1")])], w=dm(68, 100))],
             pad=dm([14, 20, 14, 20], [10, 16, 10, 16]), gap={"d": 22, "m": 12}, fxs=NAVY("g%d" % i))
u_goals = [S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر طلباً", "تشكيلة موثوقة من المكملات حسب هدفك", k, thu, thu["hfx"]("p"))["widgets"]], w=100)], pad=dm([50, 20, 14, 20], [34, 16, 10, 16]), fxs=NAVY("pt")),
           u_goal(0, "بروتين وعضلات", "بناء وتعافٍ لعضلات أقوى", 95, "a"), u_goal(1, "فيتامينات ومناعة", "دعم يومي لجسم متوازن", 90, "b"), u_goal(2, "طاقة وتركيز", "نشاط يدوم لساعات التدريب", 92, "c"),
           S([C([])], pad=dm([30, 0, 30, 0]), fxs=NAVY("pe"))]
u_cmp = S([C([W("heading", text="لماذا نحن؟", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#ffffff", **anim("fadeUp")),
              W("table", tbl="الميزة | متجرنا | غيرنا\nمنتجات أصلية ومرخّصة | ✔ | ✘\nتحاليل جودة منشورة | ✔ | ✘\nدفع عند الاستلام | ✔ | ✘\nاستشارة تغذية مجانية | ✔ | ✘", thead=True, tzb=True, thbg="#65a30d", thc="#05070d", tbd="#ffffff22", tbfs=dm(17), tbal="center",
                fxs=[FX("جدول داكن", "selector table{color:#e5e7eb;background:#0b1220;border-radius:16px;overflow:hidden}")], **anim("fadeUp", .8, .1))], w=100)],
          cw={"d": 820}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=NAVY("t"))
_pilot_reg("s-supplements", "store", "مكملات غذائية", "متجر مكملات غذائية — فيتال أكتيف",
           "لوحة قياس رياضية: أربع حلقات مخروطية (طاقة، تركيز، تعافٍ، امتصاص) في لوح زجاجي بماسح ضوئي، بروتوكول عمودي مرقّم، فئات بزوايا مشطوبة مضيئة، وصفوف منتجات حسب الهدف.",
           [bar(*thu["bar"]), hdr(**thu["hdr"]), u_hero, mq("بروتين   ✦   كرياتين   ✦   فيتامينات   ✦   أوميغا 3   ✦   طاقة   ✦   تعافٍ   ✦   مضادات أكسدة", *thu["mqc"]), u_proto, u_cats] + u_goals + [u_cmp] + tail(k, thu),
           {"ff": "'Tajawal',sans-serif", "bg": "#05070d", "header": False, "footer": False})
_pilot_demo("s-supplements", {"a": [0, 4], "b": [1, 5], "c": [2, 3]})
_pilot_end()

# ═══════════════════ s-accessories — ميكس: ملصقات مائلة بحدود سميكة وظلال صلبة، شبكة متراصّة بنسب الصور الطبيعية، معادلة Mix & Match ═══════════════════
_pilot_begin("s-accessories")
# تصحيح خطأ بيانات في الأصل: عناوين بلاطات الفئات الثلاث كانت مقلوبة (acc_outfit «سماعات»، acc_headphones «نظارات»)؛ الصور وترتيبها كما هي
PACKS["s-accessories"] = dict(PACKS["s-accessories"], dc=["إطلالات", "سماعات", "حقائب"])
_theme_chunk('k = "na"', 'hero = S(')
INKA, VIO, PNK, YEL = "#1f1147", "#8b5cf6", "#ec4899", "#fcd34d"
tha = th
def stk(i, img, alt, x, y, w, h, tx, ty, tw, mx, my, mw, mh, rot, label, lx, ly, bg):
    """ملصق: صورة أصلية بإطار أسود سميك وظل صلب ودوران، عنصر حر مستقل"""
    im = FR("image", V(x, mx, tx), V(y, my, ty), V(w, mw, tw), V(h, mh, h), 3 + i, src=IMG(img), alt=alt, fit="cover", hauto=False, rot=V(rot, rot, rot),
            fxs=[FX("ملصق بحدود وظل صلب", "selector{border:3px solid #1f1147;border-radius:26px;box-shadow:7px 7px 0 #1f1147;overflow:hidden;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}selector:hover{transform:rotate(0deg) translateY(-8px)!important;box-shadow:12px 12px 0 #1f1147}selector .pb-im{width:100%;height:100%;object-fit:cover;object-position:[[p]]}", p=("نقطة التركيز (س% ص%)", "text", "50% 50%")), floaty(k + "s%d" % i, ".pb-im", 4, 5 + i * .6)], **anim("zoomIn", .8, .25 + i * .12))
    return im
def tagp(i, text, x, y, w, tx, ty, mx, my, mw, rot, bg):
    return FR("heading", V(x, mx, tx), V(y, my, ty), V(w, mw, w), None, 8 + i, text=text, tag="div", fs=V(17, 15, 16), fw="900", ta={"d": "center"}, color=INKA, lh={"d": 1.2}, rot=V(rot, rot, rot),
              fxs=[FX("حبّة اسم", "selector .pb-t{display:inline-block;background:%s;border:2px solid #1f1147;border-radius:999px;padding:4px 16px;box-shadow:3px 3px 0 #1f1147}" % bg)], **anim("fadeUp", .7, .55 + i * .1))
a_free = [
    FT("🎀 إكسسوارات تكمل إطلالتك", V(15, 6, 6), V(50, 24, 40), V(70, 88, 88), V(15, 14, 15), VIO, "center", 6, "800", **anim("fadeDown", .7)),
    FR("heading", V(4, 6, 6), V(84, 56, 74), V(92, 88, 88), None, 6, text="التفاصيل الصغيرة تصنع الفرق الكبير", tag="h1", fs=V(52, 34, 38), fw="900", ta={"d": "center"}, color=INKA, lh={"d": 1.2}, fxs=[gradtext(k, VIO, PNK, "#f59e0b", 6)], **anim("fadeUp", .8)),
    FT("حقائب، نظارات، أحزمة، قبعات وأكثر — ألوان مرحة وجودة تدوم. اطلب واختر هديتك المجانية.", V(20, 6, 8), V(196, 176, 160), V(60, 88, 84), V(19, 15, 17), "#6b5fa0", "center", 6, "500", **anim("fadeUp", .8, .1)),
    FR("button", V(40, 25, 36), V(268, 262, 238), V(20, 50, 28), V(56, 50, 54), 6, text="تسوّقي الآن", kind="link", link="#products", bgc=VIO, color="#ffffff", hbg=VIO, fs=V(18, 16, 17), fw="900", brad={"d": 999},
       fxs=[btngrad(VIO, PNK, "rgba(139,92,246,.45)"), shine(k), pulse(k, "139,92,246", 2.4), FX("حد وظل صلب", "selector .pb-btn{border:3px solid #1f1147;box-shadow:5px 5px 0 #1f1147}")], **anim("zoomIn", .8, .2)),
    stk(0, "acc_pink", "حقيبة وردية بخطوط على قاعدة بيضاء", 8, 350, 20, 250, 5, 330, 21, 5, 340, 42, 190, -6, "", 0, 0, ""),
    stk(1, "acc_sunglasses", "نظارة شمسية على خلفية ملوّنة", 29, 320, 20, 240, 27, 330, 21, 53, 360, 42, 190, 4, "", 0, 0, ""),
    stk(2, "acc_satchel", "حقيبة جلدية صغيرة بحزامين", 50, 360, 20, 240, 49, 330, 21, 5, 570, 42, 190, -3, "", 0, 0, ""),
    stk(3, "acc_rings", "حلقات أنيقة على سطح لامع", 71, 330, 20, 250, 71, 330, 21, 53, 590, 42, 190, 5, "", 0, 0, ""),
    tagp(0, "حقائب", 10, 556, 16, 6, 550, 10, 520, 34, -6, "#fcd34d"), tagp(1, "نظارات", 31, 526, 16, 28, 550, 56, 540, 34, 4, "#f9a8d4"),
    tagp(2, "حقائب جلدية", 52, 566, 16, 50, 550, 10, 750, 34, -3, "#a5f3fc"), tagp(3, "خواتم", 73, 546, 16, 72, 550, 56, 770, 34, 5, "#c4b5fd"),
    FR("heading", V(3, 76, 4), V(30, 250, 20), V(12, 22, 16), V(120, 86, 100), 9, text="اشترِ 2 والثالث هدية", tag="div", fs=V(15, 12, 14), fw="900", ta={"d": "center"}, color=INKA, lh={"d": 1.2}, hm=False, rot=V(-12, 10, -10),
       fxs=[FX("ملصق دوّار", "selector .pb-t{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:#fcd34d;border:3px solid #1f1147;box-shadow:4px 4px 0 #1f1147;padding:10px;box-sizing:border-box;animation:naSp 14s linear infinite}@keyframes naSp{to{transform:rotate(360deg)}}")]),
]
a_hero = canvas(a_free, dm(660, 880, 640), [aurora(k, "#fff8f0", "#ddd6fe99", "#fbcfe899", "#fde68a88", 16), blobs(k, "#c4b5fd", "#fcd34d", 320, .5)])
def a_op(txt, sz=64):
    return C([W("heading", text=txt, tag="div", fs=dm(sz, 44), fw="900", ta={"d": "center"}, color="#ffffff", lh={"d": 1}, fxs=[FX("دائرة مشغّل", "selector .pb-t{display:block;width:84px;height:84px;line-height:80px;margin:0 auto;border-radius:50%;background:#ec4899;border:3px solid #1f1147;box-shadow:4px 4px 0 #1f1147}")], **anim("zoomIn", .7, .3))],
             w=dm(8, 100), va="center", pad=dm([0, 0, 0, 0]))
def a_card(i, ic, t, x, c, d):
    return C([IB(ic, t, x, tc=INKA, xc="#6b5fa0", isz=44, fxs=[FX("بطاقة ملوّنة", "selector .pb-ib{background:%s;border:3px solid #1f1147;border-radius:26px;box-shadow:6px 6px 0 #1f1147;padding:26px;height:100%%;box-sizing:border-box}" % c), tiltcol(d), floaty(k + "x" + str(i), ".pb-ibi", 6, 3.8 + i * .5)], **anim("fadeUp", .7, .1 + i * .12))],
             w=dm(27, 100), pad=dm([0, 0, 0, 0]))
a_mix = S([C([W("heading", text="Mix & Match", tag="h2", fs=dm(40, 28), fw="900", ta={"d": "center"}, color=INKA, fxs=[gradtext(k + "m", VIO, PNK, "#f59e0b", 6)], **anim("fadeUp")), T("اختاري ثلاث قطع تكمل بعضها وتوفّري أكثر.", 17, "#6b5fa0", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0])),
           a_card(0, "gift", "الأساسية", "حقيبة صغيرة تناسب كل إطلالة", "#ede9fe", -1.5), a_op("+"), a_card(1, "sparkle", "اللمسة", "نظارة أو إكسسوار شعر لافت", "#fce7f3", 1.5), a_op("="), a_card(2, "heart", "الهدية", "الثالثة مجاناً مع طلبك", "#fef3c7", -1.5)],
          pad=dm([60, 20, 70, 20], [40, 16, 44, 16]), gap={"d": 14, "m": 6}, fxs=[FX("خلفية بيضاء", "selector{background:#ffffff}")])
a_cats = S([C([*title("اختر إكسسواراتك", "نظارات وحقائب وسماعات بأسعار لا تُقاوم", k, tha, tha["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("acc_outfit"), "dl": "إطلالات"}, {"cat": "hair", "label": "", "img": IMG("acc_headphones"), "dl": "سماعات"}, {"cat": "honey", "label": "", "img": IMG("acc_satchel"), "dl": "حقائب"}],
                 cols=dm(3, 1, 3), gap=dm(30, 22), rad=dm(8), fs=dm(18), tc="#ffffff", ov=INKA, ovo=20, ratio="1/1",
                 fxs=[FX("بولارويد مائل", "selector .pb-sci{border:9px solid #fff;border-bottom-width:30px;border-radius:6px;box-shadow:6px 6px 0 #1f1147;transition:transform .4s}selector .pb-sci:nth-child(1){transform:rotate(-3deg)}selector .pb-sci:nth-child(2){transform:rotate(2deg)}selector .pb-sci:nth-child(3){transform:rotate(-2deg)}selector .pb-sci:hover{transform:rotate(0) translateY(-8px)}")])], w=100)],
           pad=dm([40, 20, 70, 20], [24, 16, 40, 16]), fxs=[FX("خلفية كريمية", "selector{background:#fff8f0}")])
a_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر لفتاً للنظر", "قطع تكمل إطلالتك", k, tha, tha["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(330, 150), gap=dm(22, 12), rad=dm(26), cbg="#ffffff", bbg=VIO, pdemo="a",
                 fxs=[FX("شبكة متراصّة بنسب الصور الطبيعية (بحدّ أدنى وأقصى للارتفاع)", "selector .pb-pgrid{display:block;column-count:3;column-gap:22px}@media(max-width:767px){selector .pb-pgrid{column-count:2;column-gap:12px}}selector .pb-pc{break-inside:avoid;margin-bottom:22px;border:3px solid #1f1147;box-shadow:6px 6px 0 #1f1147;transition:transform .3s,box-shadow .3s}selector .pb-pc:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 #1f1147}selector .pb-pci{aspect-ratio:auto;min-height:170px;max-height:440px;overflow:hidden}selector .pb-pci img{position:static;width:100%;height:auto;min-height:170px;max-height:440px;object-fit:cover;display:block}")])], w=100)],
          pad=dm([50, 20, 70, 20], [34, 16, 44, 16]), fxs=[FX("خلفية بيضاء", "selector{background:#ffffff}")])
_pilot_reg("s-accessories", "store", "إكسسوارات", "متجر إكسسوارات — ميكس",
           "ملصقات مائلة بحدود سوداء سميكة وظلال صلبة تنتشر كمجموعة حول العنوان، ملصق عرض دوّار، معادلة Mix & Match بدوائر المشغّلين، بولارويد مائل للفئات وشبكة متراصّة بنسب الصور الطبيعية.",
           [bar(*tha["bar"]), hdr(**tha["hdr"]), a_hero, mq("حقائب   ✦   نظارات   ✦   أحزمة   ✦   قبعات   ✦   أوشحة   ✦   محافظ   ✦   إكسسوارات شعر   ✦   ساعات يد", *tha["mqc"]), a_mix, a_cats, a_prod] + tail(k, tha),
           {"ff": "'Changa',sans-serif", "bg": "#fff8f0", "header": False, "footer": False})
_pilot_demo("s-accessories", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-it — تيك هب: مخطط HUD فوق لوحة الدوائر، فئات كنوافذ طرفية، صفوف مواصفات، خط أنابيب ═══════════════════
_pilot_begin("s-it")
_theme_chunk('k = "ni"', 'term = W(')
SKY, IND, CYN = "#38bdf8", "#818cf8", "#22d3ee"
thi = th
MONO = "font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr;text-align:left"
HUDC = FX("بطاقة HUD بأقواس زاوية", "selector{background:rgba(8,15,30,.72);border:1px solid rgba(56,189,248,.35);backdrop-filter:blur(8px);box-shadow:0 20px 50px rgba(0,0,0,.45)}selector::before,selector::after{content:\"\";position:absolute;width:14px;height:14px;border:2px solid #38bdf8;pointer-events:none}selector::before{top:-2px;left:-2px;border-right:0;border-bottom:0}selector::after{bottom:-2px;right:-2px;border-left:0;border-top:0}selector p{%s;margin:0}" % MONO)
def chip(i, cmd, line, y, ty, my):
    wd = W("text", html="<p><span style='color:#22c55e'>$</span> <b style='color:#38bdf8'>%s</b><br><span style='color:#e2e8f0;font-size:1.25em'>%s</span></p>" % (cmd, line), fs=dm(17, 15), lh={"d": 1.7}, ta={"d": "start"}, color="#94a3b8", fxs=[HUDC, floaty(k + "c%d" % i, "", 5, 5 + i * .6)], **anim("fadeUp", .8, .3 + i * .15))
    return FRW(wd, V(4 + (i % 2) * 8, 6, 6), V(y, my, ty), V(34, 88, 88), V(96, 80, 84), 6)
i_free = [
    FRW(W("text", html="<p><span style='color:#22c55e'>$</span> specs --best <span style='color:#38bdf8'>▍</span></p>", fs=dm(18, 15), color="#64748b", fxs=[FX("نصّ طرفية", "selector p{%s;margin:0}" % MONO)], **anim("fadeIn", 1)), V(4, 6, 6), V(70, 640, 640), V(40, 88, 88), None, 6),
    chip(0, "CPU", "Core i7 · 14 cores", 130, 690, 690), chip(1, "RAM", "32 GB DDR5", 260, 790, 790), chip(2, "SSD", "1 TB NVMe", 390, 890, 890),
    FT("▍ تقنية بلا حدود", V(52, 6, 6), V(90, 24, 40), V(46, 88, 88), V(15, 14, 15), SKY, "start", 6, "800", **anim("fadeDown", .7)),
    FR("heading", V(52, 6, 6), V(124, 54, 72), V(46, 88, 88), None, 6, text="جهّز مكتبك وعالم ألعابك بأقوى العتاد", tag="h1", fs=V(54, 32, 46), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.2}, fxs=[gradtext(k, SKY, IND, SKY, 6)], **anim("fadeUp", .8)),
    FT("حواسيب، لابتوبات، قطع وملحقات أصلية بضمان رسمي وتقسيط مرن. نركّب ونسلّم حتى باب بيتك.", V(52, 6, 6), V(300, 176, 180), V(44, 88, 88), V(18, 15, 17), "#94a3b8", "start", 6, "500", **anim("fadeUp", .8, .1)),
    FR("button", V(76, 30, 72), V(410, 280, 280), V(22, 64, 22), V(56, 50, 54), 6, text="تصفّح العتاد", kind="link", link="#products", bgc="#0284c7", color="#ffffff", hbg="#0284c7", fs=V(18, 16, 17), fw="800", brad={"d": 8},
       fxs=[btngrad("#0284c7", "#6366f1", "rgba(56,189,248,.45)"), shine(k), pulse(k, "56,189,248", 2.2)], **anim("zoomIn", .8, .2)),
    FR("tbadges", V(52, 6, 6), V(490, 356, 360), V(46, 88, 88), None, 6, items="ضمان رسمي\nتقسيط مرن\nدعم فني", live=True, liveText="يتصفّحون الآن", lmin=16, lmax=57, cbg="#ffffff12", cc="#e2e8f0", cbc="#ffffff30", crad=dm(8), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3)),
]
i_hero = canvas(i_free, dm(620, 1000, 600), SL("h"), PH("it_circuit", "rgba(8,15,30,.55)", "rgba(8,15,30,.9)"))
i_brands = mq("HP   ✦   DELL   ✦   ASUS   ✦   LENOVO   ✦   ACER   ✦   MSI   ✦   LOGITECH   ✦   KINGSTON   ✦   SAMSUNG   ✦   NVIDIA", *thi["mqc"])
i_cats = S([C([*title("الأقسام", "كل ما تحتاجه من عتاد وملحقات", k, thi, thi["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("it_pc"), "dl": "حواسيب وقطع"}, {"cat": "hair", "label": "", "img": IMG("it_circuit"), "dl": "دوائر ولوحات"}, {"cat": "honey", "label": "", "img": IMG("it_code"), "dl": "لوازم المبرمجين"}],
                 cols=dm(3, 1, 3), gap=dm(20, 12), rad=dm(12), fs=dm(17), tc="#ffffff", ov="#0b1220", ovo=35, ratio="1/1",
                 fxs=[FX("نافذة طرفية", "selector .pb-sci{border:1px solid rgba(56,189,248,.4);border-radius:12px;overflow:hidden}selector .pb-sci::before{content:\"● ● ●   ~/dir\";position:absolute;top:0;inset-inline:0;z-index:3;padding:9px 14px;background:rgba(11,18,32,.92);color:#38bdf8;font:12px ui-monospace,Menlo,monospace;direction:ltr;text-align:left;letter-spacing:.5px}"), lift(".pb-sc,.pb-cat,a", "rgba(56,189,248,.35)", -8, 3)])], w=100)],
           pad=dm([50, 20, 50, 20], [34, 16, 34, 16]), fxs=SL("c"))
i_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر طلباً", "تجميعات ومستلزمات مجرّبة", k, thi, thi["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(1100, 300), gap=dm(12), rad=dm(14), cbg="#0f172a", bbg="#0284c7", pdemo="a",
                 fxs=[FX("صفوف مواصفات", "@media(min-width:768px){selector .pb-pc{display:grid;grid-template-columns:130px 1fr auto auto;align-items:center;column-gap:26px;padding:12px 22px 12px 12px;border:1px solid rgba(56,189,248,.25);color:#e2e8f0}selector .pb-pci{width:130px;border-radius:10px;overflow:hidden}selector .pb-pc h3{margin:0;font-size:19px;color:#fff}selector .pb-pcp{margin:0;display:flex;gap:10px;align-items:baseline}selector .pb-pcb{padding:10px 22px;border-radius:8px;white-space:nowrap}}selector .pb-pc{transition:transform .3s,box-shadow .3s}selector .pb-pc:hover{transform:translateX(-6px);box-shadow:0 0 0 1px #38bdf8,0 18px 40px rgba(56,189,248,.25)}"), cardratio("1/1")])], w=100)],
          pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=SL("p"))
def i_step(i, ic, t, x):
    return C([W("text", html="<p style='%s;margin:0;color:#38bdf8'>$ step_%d</p>" % (MONO, i + 1), fs=dm(15, 14), **anim("fadeIn", .7, .1 + i * .12)),
              IB(ic, t, x, tc="#ffffff", xc="#94a3b8", isz=36, fxs=[softcard("#ffffff10", "rgba(0,0,0,.35)", 14, 22, "#ffffff22"), lift(".pb-ib", "rgba(56,189,248,.3)", -6, 2)], **anim("fadeUp", .7, .2 + i * .12))],
             w=dm(25, 100), pad=dm([0, 0, 0, 0]), fxs=[FX("سهم الأنبوب", "@media(min-width:768px){selector:not(:last-child)::after{content:\"→\";position:absolute;inset-inline-end:-22px;top:46%;color:#38bdf8;font-size:26px;font-weight:900}}selector{position:relative}")] if i < 3 else [])
i_pipe = S([C([*title("خط التجميع والتسليم", "من الاختيار حتى باب بيتك", k, thi, thi["hfx"]("q"))["widgets"]], w=100, pad=dm([0, 0, 24, 0]))]
           + [i_step(i, ic, t, x) for i, (ic, t, x) in enumerate([("shield-check", "ضمان رسمي", "سنة إلى سنتين على الأجهزة"), ("cash", "تقسيط مرن", "ادفع على دفعات مريحة"), ("headset", "دعم فني", "صيانة واستشارة تقنية"), ("truck", "توصيل وتركيب", "نوصّل ونركّب في مكانك")])],
           pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), gap={"d": 30, "m": 14}, fxs=SL("q"))
i_cmp = S([C([W("heading", text="قارن المواصفات", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#ffffff", **anim("fadeUp")),
              W("table", tbl="الفئة | اقتصادي | متوسط | احترافي\nالمعالج | i3 | i5 | i7\nالذاكرة | 8GB | 16GB | 32GB\nالتخزين | 256GB | 512GB | 1TB\nالضمان | سنة | سنة | سنتان", thead=True, tzb=True, thbg="#0284c7", thc="#ffffff", tbd="#ffffff22", tbfs=dm(17), tbal="center",
                fxs=[FX("جدول تقني", "selector table{color:#e2e8f0;background:#0b1220;border-radius:12px;overflow:hidden;font-family:ui-monospace,Menlo,monospace}")], **anim("fadeUp", .8, .1))], w=100)],
          cw={"d": 880}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=SL("t"))
_pilot_reg("s-it", "store", "معلوماتية", "متجر معلوماتية — تيك هب",
           "مخطط HUD: لوحة الدوائر الأصلية خلفية مع بطاقات مواصفات طرفية بأقواس زاوية، فئات كنوافذ طرفية، صفوف منتجات بمواصفات كجدول، خط تجميع وتسليم بأسهم، وجدول مقارنة بخط أحادي.",
           [bar(*thi["bar"]), hdr(**thi["hdr"]), i_hero, i_brands, i_cats, i_prod, i_pipe, i_cmp] + tail(k, thi, [(12000, "+", "", "مشروع مُنجز"), (58, "", "", "ولاية نغطيها"), (98, "", "%", "رضا العملاء"), (24, "", "h", "ساعة متوسط التوصيل")]),
           {"ff": "'Tajawal',sans-serif", "bg": "#0b1220", "header": False, "footer": False})
_pilot_demo("s-it", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-digital — ديجيتال هب: نافذة متصفح بلوحة التحكم الأصلية وبطاقات واجهة عائمة، بطاقات بمعاينة عند المرور، جدول باقات موحّد ═══════════════════
_pilot_begin("s-digital")
_theme_chunk('k = "nd"', 'hero = S(')
PUR1, PNK1, SKY1 = "#c084fc", "#f472b6", "#38bdf8"
thd = th
WIN = FX("نافذة متصفح", "selector{border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.22);box-shadow:0 50px 110px rgba(168,85,247,.5)}selector::before{content:\"\";display:block;height:36px;background:radial-gradient(circle at 20px 18px,#ef4444 5px,transparent 6px),radial-gradient(circle at 40px 18px,#facc15 5px,transparent 6px),radial-gradient(circle at 60px 18px,#22c55e 5px,transparent 6px),#1e1b4b;border-bottom:1px solid rgba(255,255,255,.14)}selector .pb-im{width:100%;display:block;object-fit:cover;object-position:[[p]]}", p=("نقطة التركيز (س% ص%)", "text", "50% 50%"))
def uichip(i, ic, t, x, y, w, tx, ty, mx, my, mw):
    wd = IB(ic, t, "", tc="#ffffff", xc="#ffffff", isz=24, fxs=[FX("بطاقة واجهة", "selector .pb-ib{display:flex;align-items:center;gap:10px;background:rgba(30,27,75,.82);backdrop-filter:blur(12px);border:1px solid rgba(192,132,252,.5);border-radius:14px;padding:12px 16px;box-shadow:0 20px 50px rgba(0,0,0,.45)}selector h3{margin:0;font-size:15px}selector p{display:none}"), floaty(k + "u%d" % i, "", 7, 5 + i * .7)], **anim("zoomIn", .8, .5 + i * .15))
    return FRW(wd, V(x, mx, tx), V(y, my, ty), V(w, mw, w), V(58, 50, 54), 8)
d_free = [
    FRW(W("tbadges", items="⚡ تسليم فوري\nتحديثات مدى الحياة\nدعم مباشر", live=False, cbg="#ffffff14", cc="#e9d5ff", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeDown")), V(14, 6, 6), V(40, 20, 40), V(72, 88, 88), None, 6),
    FR("heading", V(4, 6, 6), V(96, 104, 96), V(92, 88, 88), None, 6, text="منتجات رقمية تبني دخلك وتختصر وقتك", tag="h1", fs=V(52, 34, 48), fw="900", ta={"d": "center"}, color="#ffffff", lh={"d": 1.2}, fxs=[gradtext(k, PUR1, PNK1, SKY1, 5)], **anim("fadeUp", .8)),
    FT("قوالب، كتب إلكترونية، دورات وأدوات جاهزة للتحميل الفوري بعد الدفع — بلا انتظار ولا شحن.", V(20, 6, 8), V(236, 236, 200), V(60, 88, 84), V(20, 15, 18), "#c4b5fd", "center", 6, "500", **anim("fadeUp", .8, .1)),
    FR("button", V(40, 25, 38), V(310, 338, 290), V(20, 50, 24), V(56, 50, 54), 6, text="استعرض المنتجات", kind="link", link="#products", bgc="#9333ea", color="#ffffff", hbg="#9333ea", fs=V(18, 16, 17), fw="800", brad={"d": 14},
       fxs=[btngrad("#9333ea", "#ec4899", "rgba(168,85,247,.55)"), shine(k), pulse(k, "168,85,247", 2)], **anim("zoomIn", .8, .2)),
    FR("image", V(14, 5, 8), V(410, 420, 380), V(72, 90, 84), None, 3, src=IMG("dig_dash"), alt="لوحة تحكم منتجات رقمية", fit="cover", hauto=False, fxs=[ratioframe("1400/933"), WIN], **anim("fadeUp", 1, .3)),
    uichip(0, "zap", "تسليم فوري", 6, 470, 17, 4, 470, 2, 400, 52), uichip(1, "shield-check", "ضمان 14 يوماً", 76, 700, 18, 76, 700, 46, 540, 50), uichip(2, "sparkle", "تحديثات مجانية", 4, 900, 18, 4, 900, 4, 660, 50),
]
d_hero = canvas(d_free, dm(1090, 760, 1000), [blobs(k, "#a855f7", "#ec4899", 420, .3)])
d_get = S([C([W("heading", text="ماذا ستحصل عليه؟", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp")),
              bullets("ملفات جاهزة للتحميل المباشر\nتحديثات مجانية مدى الحياة\nدليل استعمال خطوة بخطوة\nدعم فني عبر واتساب\nضمان استرجاع 14 يوماً", "check-circle", PUR1, "#ede9fe", **anim("fadeUp", .7, .1))], w=dm(46, 100), va="center", pad=dm([34, 32, 34, 32], [24, 20, 24, 20]), fxs=[glass("rgba(255,255,255,.06)", "rgba(192,132,252,.35)", 18, 26)]),
           C([W("counter", n=4800, pre="+", label="عميل يستعمل منتجاتنا", fs=dm(52, 38), color=PUR1, lc="#c4b5fd", fxs=[ctrcolor(PUR1, PNK1)], **anim("zoomIn", .7))], w=dm(27, 100), va="center", pad=dm([40, 20, 40, 20], [24, 16, 24, 16]), fxs=[glass("rgba(168,85,247,.14)", "rgba(192,132,252,.5)", 18, 26)]),
           C([W("counter", n=60, suf=" ث", label="متوسط زمن وصول الملف", fs=dm(52, 38), color=PUR1, lc="#c4b5fd", fxs=[ctrcolor(SKY1, PUR1)], **anim("zoomIn", .7, .15))], w=dm(27, 100), va="center", pad=dm([40, 20, 40, 20], [24, 16, 24, 16]), fxs=[glass("rgba(56,189,248,.1)", "rgba(56,189,248,.4)", 18, 26)])],
          pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20, "m": 14}, fxs=PUR("g"))
d_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر تحميلاً", "منتجات رقمية جاهزة للاستخدام", k, thd, thd["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(340, 150), gap=dm(24, 12), rad=dm(24), cbg="#ffffff", bbg="#9333ea", pdemo="a",
                 fxs=[lift(".pb-pc", "rgba(168,85,247,.45)", -10, 3), FX("معاينة عند المرور", "selector .pb-pci{overflow:hidden}selector .pb-pci::after{content:\"معاينة ◂  تحميل فوري\";position:absolute;inset:auto 0 0 0;padding:34px 14px 12px;background:linear-gradient(transparent,rgba(10,6,20,.92));color:#fff;font-weight:800;font-size:14px;transform:translateY(101%);transition:transform .35s}selector .pb-pc:hover .pb-pci::after{transform:none}"), cardratio("1/1")])], w=100)],
          pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), fxs=PUR("pr"))
def d_plan(i, name, price, sub, items, hot=False):
    ws = [W("heading", text=name, tag="h3", fs=dm(24, 20), fw="900", ta={"d": "center"}, color="#ffffff"),
          W("heading", text=price, tag="div", fs=dm(46, 34), fw="900", ta={"d": "center"}, color="#ffffff", fxs=[gradtext(k + "p%d" % i, PUR1, PNK1, SKY1, 6)]),
          T(sub, 15, "#c4b5fd"), bullets(items, "check", PUR1, "#ede9fe", fs=17),
          BTN("اختر الباقة", bg="#9333ea", fxs=[btngrad("#9333ea", "#ec4899", "rgba(168,85,247,.45)")] if hot else [FX("زر شفاف", "selector .pb-btn{background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.3)}")])]
    fx = [FX("عمود باقة", "@media(min-width:768px){selector{border-inline-start:1px solid rgba(255,255,255,.12)}}")]
    if hot: fx = [FX("الباقة الأنسب", "selector{background:linear-gradient(180deg,rgba(168,85,247,.28),rgba(236,72,153,.1));box-shadow:inset 0 3px 0 #f472b6}"), ribbon("الأكثر طلباً", "#f472b6", "#fff")]
    return C(ws, w=dm(33, 100), pad=dm([40, 28, 40, 28], [30, 20, 30, 20]), fxs=fx)
d_price = S([C([W("heading", text="اختر باقتك", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#ffffff", fxs=[gradtext(k + "pr", PUR1, PNK1, SKY1, 6)], **anim("fadeUp")), T("دفعة واحدة — بلا اشتراكات خفية.", 17, "#c4b5fd", **anim("fadeUp", .7, .1))], w=100, pad=dm([34, 0, 20, 0])),
             d_plan(0, "أساسية", "2,900 دج", "للمبتدئين", "منتج واحد\nتحديثات سنة\nدعم بالبريد"),
             d_plan(1, "احترافية", "5,900 دج", "الأفضل قيمة", "3 منتجات\nتحديثات مدى الحياة\nدعم واتساب\nقوالب إضافية", True),
             d_plan(2, "شاملة", "9,900 دج", "للفرق", "كل المنتجات\nتحديثات مدى الحياة\nدعم أولوية\nاستشارة 30 دقيقة")],
            pad=dm([60, 20, 70, 20], [40, 16, 44, 16]), gap={"d": 0}, fxs=PUR("pp") + [FX("إطار جدول الباقات", "selector .pb-in{background:rgba(255,255,255,.05);border:1px solid rgba(192,132,252,.35);border-radius:28px;backdrop-filter:blur(10px);overflow:hidden;max-width:1100px;margin:0 auto}")])
d_cats = S([C([*title("التصنيفات", "قوالب ودورات وأدوات تنزلها فور الدفع", k, thd, thd["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("dig_dash"), "dl": "قوالب مواقع"}, {"cat": "hair", "label": "", "img": IMG("dig_analytics"), "dl": "لوحات تحكم"}, {"cat": "honey", "label": "", "img": IMG("dig_code"), "dl": "أدوات المطورين"}],
                 cols=dm(3, 1, 3), gap=dm(22, 14), rad=dm(24), fs=dm(17), tc="#ffffff", ov="#0a0614", ovo=40, ratio="1/1", fxs=[lift(".pb-sc,.pb-cat,a", "rgba(168,85,247,.4)", -8, 3)])], w=100)],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), fxs=PUR("c"))
_pilot_reg("s-digital", "store", "منتجات رقمية", "متجر منتجات رقمية — ديجيتال هب",
           "نافذة متصفح تعرض لوحة التحكم الأصلية وحولها بطاقات واجهة عائمة، لوح بنتو للمزايا والعدّادات، بطاقات منتجات بمعاينة تنزلق عند المرور، وجدول باقات موحّد بإطار زجاجي.",
           [bar(*thd["bar"]), hdr(**thd["hdr"]), d_hero, mq("قوالب   ✦   كتب إلكترونية   ✦   دورات   ✦   أدوات   ✦   إضافات   ✦   تصاميم   ✦   خطوط   ✦   ملفات PSD", *thd["mqc"]), d_get, d_prod, d_price, d_cats] + tail(k, thd, [(4800, "+", "", "عميل سعيد"), (120, "+", "", "منتج رقمي"), (60, "", " ث", "زمن التسليم"), (14, "", " يوم", "ضمان الاسترجاع")]),
           {"ff": "'Tajawal',sans-serif", "bg": "#0a0614", "header": False, "footer": False})
_pilot_demo("s-digital", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-marketplace — سوق مفتوح: واجهة سوق كثيفة (قائمة أقسام + لافتة كبرى + لافتتان)، شريط فلاش، بطاقات مضغوطة ═══════════════════
_pilot_begin("s-marketplace")
_theme_chunk('k = "nm"', 'hero = S(')
ORG, RED = "#f97316", "#ef4444"
thm = th
m_rail = C([W("heading", text="الأقسام", tag="h3", fs=dm(18, 16), fw="900", ta={"d": "start"}, color="#0f172a", **anim("fadeUp")),
            W("bullets", items="إلكترونيات\nأزياء\nالمنزل والمطبخ\nجمال وعناية\nأطفال\nرياضة\nكتب\nسيارات", micon="ic:tag", mc=ORG, ms=dm(18), gap=dm(8), fs=dm(15, 15), color="#0f172a", **anim("fadeUp", .7, .1))],
           w=dm(18, 100), pad=dm([20, 18, 20, 18], [16, 14, 16, 14]), hm=False,
           fxs=[FX("قائمة الأقسام", "selector{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 6px 20px rgba(15,23,42,.06)}@media(max-width:1023px){selector{display:none}}")])
m_hero = S([m_rail,
            tile("خصومات تصل إلى 60%", "على آلاف المنتجات من بائعين موثوقين", "rgba(249,115,22,.55)", "rgba(239,68,68,.88)", dm(44, 100, 100), 300, "تسوّق الآن", "mkt_bags"),
            tile("وصل حديثاً", "اكتشف أحدث العروض", "rgba(99,102,241,.5)", "rgba(6,182,212,.88)", dm(19, 100, 50), 300, "اكتشف", "fashion_shirts"),
            tile("توصيل مجاني", "فوق 6000 دج", "rgba(16,185,129,.5)", "rgba(21,128,61,.9)", dm(19, 100, 50), 300, "التفاصيل", "mkt_open")],
           pad=dm([24, 20, 16, 20], [16, 12, 12, 12]), gap={"d": 12, "m": 10}, fxs=LG("h"), cw={"d": 1240})
m_chips = S([C([W("tbadges", items="إلكترونيات\nأزياء\nالمنزل والمطبخ\nجمال وعناية\nأطفال\nرياضة\nكتب\nسيارات", live=True, liveText="مستخدم متصل", lmin=120, lmax=480, cbg="#ffffff", cc="#0f172a", cbc="#e2e8f0", crad=dm(999), cfs=dm(15), gap=dm(10), jc="center", hd=True, **anim("fadeUp"))], w=100)],
            pad=dm([8, 20, 18, 20], [8, 12, 12, 12]), fxs=LG("c") + [FX("إخفاء الشريط على سطح المكتب", "@media(min-width:1024px){selector{display:none}}")])
m_flash = S([C([W("heading", text="⚡ عروض فلاش", tag="h2", fs=dm(34, 24), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp")),
                W("progress", pl="تم بيع 82% من الكمية", pv=82, pc=ORG, pbg="#ffffff33", ph=dm(12), color="#ffffff", fxs=[barfx("#fde047", RED)], **anim("fadeUp", .7, .1)),
                W("progress", pl="تم بيع 64% من الكمية", pv=64, pc=ORG, pbg="#ffffff33", ph=dm(12), color="#ffffff", fxs=[barfx(RED, "#fde047")], **anim("fadeUp", .7, .2))], w=dm(56, 100), va="center"),
             C([T("ينتهي العرض خلال", 15, "#ffffffdd", "center"), W("countdown", mode="daily", cbg="#00000055", color="#fde047", fs=dm(34, 24), crad=dm(10), al={"d": "center"}, fxs=[cdglow(k, "#fde047")], **anim("zoomIn"))], w=dm(44, 100), va="center")],
            pad=dm([28, 32, 28, 32], [20, 16, 20, 16]), cw={"d": 1140}, mar=dm([8, 20, 0, 20], [8, 12, 0, 12]), rad=dm(18, 14), gap={"d": 26, "m": 12},
            fxs=[aurora(k + "fl", "#9a3412", "#f9731699", "#ef444488", "#facc1555", 8), FX("حدّ لامع", "selector{box-shadow:0 20px 60px rgba(249,115,22,.35)}")])
m_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر مبيعاً", "اختيارات المتسوّقين", k, thm, thm["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(170, 150), gap=dm(12), rad=dm(14), cbg="#ffffff", bbg=ORG, pdemo="a",
                 fxs=[lift(".pb-pc", "rgba(249,115,22,.3)", -8, 2), FX("بطاقة سوق مضغوطة", "selector .pb-pc{border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(15,23,42,.06)}selector .pb-pc h3{font-size:14px;line-height:1.4}selector .pb-pcp b{font-size:17px;color:#ea580c}selector .pb-pcb{border-radius:8px}"), cardratio("1/1")])], w=100)],
          pad=dm([40, 20, 60, 20], [28, 12, 40, 12]), cw={"d": 1240}, fxs=WHT("p"))
m_sell = S([C([*title("بائعون مميّزون", "متاجر موثوقة بتقييمات حقيقية من الزبائن.", k, thm, thm["hfx"]("s"))["widgets"]], w=100, pad=dm([0, 0, 20, 0]))]
           + [C([IB("user", n, "★ %s · %s منتج" % (r, c), tc="#0f172a", xc="#64748b", isz=30, al={"d": "start"},
                    fxs=[FX("بطاقة بائع", "selector .pb-ib{display:grid;grid-template-columns:auto 1fr;column-gap:14px;align-items:center;text-align:start;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;box-shadow:0 4px 14px rgba(15,23,42,.06)}selector .pb-ibi{grid-row:span 2;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ef4444);color:#fff!important;display:grid;place-items:center}selector h3,selector p{margin:0;text-align:start}"), lift(".pb-ib", "rgba(249,115,22,.25)", -6, 2)] + ([ribbon("موثّق", "#10b981", "#fff")] if i == 0 else []), **anim("fadeUp", .7, .1 + i * .1))], w=dm(25, 100), pad=dm([0, 0, 14, 0]))
              for i, (n, r, c) in enumerate([("متجر الأناقة", "4.9", "320"), ("عالم التقنية", "4.8", "540"), ("بيت الجمال", "4.9", "210"), ("أسرة سعيدة", "4.7", "380")])],
           pad=dm([50, 20, 40, 20], [34, 16, 30, 16]), gap={"d": 16}, fxs=LG("s"))
m_cats = S([C([*title("تسوّق حسب القسم", "كل ما تحتاجه من عدة بائعين", k, thm, thm["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("mkt_bags"), "dl": "حقائب وإكسسوارات"}, {"cat": "hair", "label": "", "img": IMG("fashion_rack"), "dl": "أزياء"}, {"cat": "honey", "label": "", "img": IMG("mkt_open"), "dl": "عروض وتخفيضات"}],
                 cols=dm(3, 1, 3), gap=dm(16, 12), rad=dm(14), fs=dm(17), tc="#ffffff", ov="#0f172a", ovo=30, ratio="1/1", fxs=[lift(".pb-sc,.pb-cat,a", "rgba(249,115,22,.3)", -6, 2), FX("حدّ برتقالي بالمرور", "selector .pb-sci{border:3px solid transparent;transition:border-color .3s}selector .pb-sci:hover{border-color:#f97316}")])], w=100)],
           pad=dm([50, 20, 50, 20], [34, 16, 34, 16]), fxs=LG("k"))
m_app = S([C([W("heading", text="حمّل تطبيق السوق", tag="h2", fs=dm(32, 24), fw="900", ta={"d": "start"}, color="#ffffff"), T("تابع عروضك وتتبّع طلباتك من هاتفك.", 17, "#ffffffdd", "start")], w=60, va="center"),
           C([BTN("تواصل عبر واتساب", bg="#ffffff", color="#111", kind="whatsapp", al="end", fxs=[pulse(k, "255,255,255", 2)])], w=40, va="center")],
          pad=dm([36, 28, 36, 28], [26, 16, 26, 16]), mar=dm([10, 20, 30, 20], [8, 12, 24, 12]), rad=dm(20), cw={"d": 1140}, fxs=[bgfade("#0f172a", "#334155", 135), blobs(k + "a", ORG, "#6366f1", 260, .4)])
_pilot_reg("s-marketplace", "store", "ماركت بليس", "ماركت بليس — سوق مفتوح",
           "واجهة سوق كثيفة: قائمة أقسام جانبية ولافتة كبرى ولافتتان، شريط عروض فلاش بعدّاد وشرائط بيع، بطاقات منتجات مضغوطة ست في الصف، وبطاقات بائعين بأفاتار متدرّج.",
           [bar(*thm["bar"]), hdr(**thm["hdr"]), m_hero, m_chips, m_flash, m_prod, m_sell, m_cats,
            feat(k, thm, [("shield-check", "حماية المشتري", "استرجاع إذا لم يطابق الوصف"), ("truck", "توصيل سريع", "لكل الولايات"), ("cash", "دفع عند الاستلام", "ادفع بعد المعاينة"), ("headset", "دعم 7/7", "فريقنا في خدمتك")]), m_app] + tail(k, thm, [(12000, "+", "", "طلب مكتمل"), (58, "", "", "ولاية نغطيها"), (98, "", "%", "رضا المشترين"), (24, "", "h", "ساعة متوسط التوصيل")]),
           {"ff": "'Tajawal',sans-serif", "bg": "#f1f5f9", "header": False, "footer": False})
_pilot_demo("s-marketplace", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()
