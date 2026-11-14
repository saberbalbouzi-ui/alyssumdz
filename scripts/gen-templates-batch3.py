# ═════════ الدفعة 3 من تحديث القوالب القديمة (4 متاجر عامة): s-aurora · s-gold · s-fresh · s-pop ═════════
# تُنفَّذ بعد gen-templates-batch2.py. تستعير لوحة ألوان كل قالب من تعريفه الأصلي في gen-templates-store.py (هوية الألوان محفوظة)
# وتعيد تركيب الهيرو والمنتجات والسرد بهوية مستقلة لكل قالب. كل صور الأصل ومراجعها محفوظة؛ لا صور مضافة (tests/batch-image-audit.py).
_STORE_SRC = open(os.path.join(HERE, "gen-templates-store.py"), encoding="utf-8").read()
def _store_chunk(k_marker):
    """يشغّل مقطع الثيم الأصلي (k/ICC/th/الأقنعة) لقالب متجر من gen-templates-store.py حتى بداية هيرو الأصل"""
    a = _STORE_SRC.index(k_marker); b = _STORE_SRC.index("hero = [", a)
    exec(_STORE_SRC[a:b], globals())
def tail3(k, th, vals=None, ctr_cols=None):
    """نهاية المتجر: أرقام ثم آراء ثم عرض اليوم ثم الأسئلة ثم التذييل (نفس مكوّنات الأصل ونصوصه المحلّية)"""
    vals = vals or [(12000, "+", "", "طلب مُسلَّم"), (58, "", "", "ولاية نغطيها"), (98, "", "%", "رضا الزبائن"), (24, "", "h", "متوسط التوصيل")]
    return [S(stats(th, vals, th["ctr"]), pad=dm([50, 20, 20, 20], [34, 16, 16, 16]), gap={"d": 16}, fxs=th["bgB"]("d")),
            S(tests(th, th["tsfx"]), pad=dm([20, 20, 60, 20], [16, 16, 40, 16]), gap={"d": 20}, fxs=th["bgB"]("e")),
            offer(k, th, th["offfx"], th.get("offc", "#ffffff"), th.get("offm", "#e2e8f0")),
            faq(th, th["bgA"]("f"), th["accfx"]), foot(**th["foot"])]
def ring(inset, style, c, dur, rev=False, side="before"):
    """حلقة مدارية حول عنصر (طبقة وهمية، لا تغطّي الحدث): inset سالب بالنسبة المئوية"""
    return "selector::%s{content:\"\";position:absolute;inset:-%s%%;border:%s %s;border-radius:50%%;pointer-events:none;animation:%s %ss linear infinite %s}" % (side, inset, style, c, "b3spin", dur, "reverse" if rev else "normal")
def canvas3(free, mh, fxs, bg_set=None, cw=1100):
    """قسم قماش بهامش علوي على الجوال يتّسع لترويسة المتجر (شعار من سطرين) فلا يغطّي عنصراً حراً"""
    sec = canvas(free, mh, fxs, bg_set, cw); sec["set"]["pad"] = dm([0, 0, 0, 0], [56, 0, 0, 0]); return sec
B3SPIN = "@keyframes b3spin{to{transform:rotate(360deg)}}"

# ═══════════════════ s-aurora — مدار: صورة بيضاوية في مدارات دوّارة وشرائح زجاج عائمة، رفّ نيون أفقي، لوح بنتو ═══════════════════
_pilot_begin("s-aurora")
_store_chunk('k = "sa"')
VIO, CYA, PNK = "#a78bfa", "#22d3ee", "#f472b6"
tha = th
GL = lambda a=.07, b=.22, r=20: glass("rgba(255,255,255,%s)" % a, "rgba(255,255,255,%s)" % b, 18, r)
def chip(i, ic, t, x, D, M, Tb):
    """شريحة زجاجية عائمة حول الصورة (عنصر حر مستقل): D/M/T = (x%, y) للمكتب/الجوال/التابلت"""
    wd = IB(ic, t, "", tc="#ffffff", xc="#cbd5e1", isz=28, fxs=[FX("شريحة زجاج", "selector .pb-ib{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:10px 18px;backdrop-filter:blur(14px);display:flex;align-items:center;gap:10px;box-shadow:0 14px 40px rgba(124,58,237,.35)}selector .pb-ib h3{font-size:15px;margin:0}"), floaty(k + "c%d" % i, ".pb-ib", 9, 4.5 + i * .7)], **anim("zoomIn", .8, .5 + i * .15))
    return FRW(wd, V(D[0], M[0], Tb[0]), V(D[1], M[1], Tb[1]), V(17, 46, 30), None, 7)
a_free = [
    FT("✦ وصل حديثاً إلى المدار", V(52, 6, 6), V(100, 450, 640), V(44, 88, 88), V(15, 14, 15), "#c4b5fd", "start", 6, "800", **anim("fadeDown")),
    FR("heading", V(52, 6, 6), V(140, 490, 680), V(46, 88, 88), None, 6, text="تسوّق بذكاء، واستلم عند بابك", tag="h1", fs=V(60, 36, 50), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.2}, fxs=[gradtext(k, VIO, CYA, PNK, 6)], **anim("fadeUp", .8)),
    FT("منتجات أصلية مختارة بعناية، بأسعار منافسة وتوصيل سريع لكل الولايات. اطلب اليوم وادفع عند الاستلام.", V(52, 6, 6), V(320, 600, 770), V(42, 88, 88), V(19, 16, 18), "#cbd5e1", "start", 6, "500", **anim("fadeUp", .8, .1)),
    FR("button", V(76, 6, 6), V(440, 740, 870), V(22, 64, 28), V(56, 50, 54), 6, text="تسوّق الآن", kind="link", link="#products", bgc="#7c3aed", color="#ffffff", hbg="#7c3aed", fs=V(18, 16, 17), fw="800", brad={"d": 14},
       fxs=[btngrad("#7c3aed", "#06b6d4", "rgba(124,58,237,.5)"), shine(k), pulse(k, "124,58,237", 2.4)], **anim("fadeUp", .8, .2)),
    FR("tbadges", V(52, 6, 6), V(530, 820, 950), V(46, 88, 88), None, 6, items="دفع عند الاستلام\nتوصيل 58 ولاية", live=True, liveText="يتصفحون المتجر الآن", lmin=14, lmax=41, cbg="#ffffff14", cc="#e2e8f0", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3)),
    # الصورة الأصلية it_color بنسبتها الطبيعية 4:5 داخل بيضاوي تحيط به مداران دوّاران (نسبة الإطار ونقطة التركيز وسيطان)
    FR("image", V(10, 14, 25), V(90, 50, 60), V(32, 72, 50), None, 3, src=IMG("it_color"), alt="حاسوب محمول بإضاءة ملوّنة على لوحة مفاتيح", fit="cover", hauto=True,
       fxs=[ratioframe("4/5"), FX("بيضاوي ومداران", "selector{overflow:visible!important}selector .pb-im{border-radius:50%;box-shadow:0 0 90px rgba(124,58,237,.55),inset 0 0 0 2px rgba(255,255,255,.2)}" + ring(9, "1.5px dashed", "rgba(167,139,250,.65)", 46) + ring(20, "1px dotted", "rgba(34,211,238,.6)", 70, True, "after") + B3SPIN)], **anim("zoomIn", 1, .1)),
    chip(0, "truck", "توصيل 24–72 ساعة", 0, (31, 120), (2, 100), (6, 110)),
    chip(1, "shield-check", "منتجات أصلية", 0, (0, 330), (50, 250), (66, 300)),
    chip(2, "gift", "هدية مع الطلب", 0, (24, 560), (4, 370), (8, 480)),
]
a_hero = canvas3(a_free, dm(700, 900, 1030), [aurora(k, "#070b18", "#7c3aed88", "#06b6d466", "#db277755", 18), blobs(k, "#7c3aed", "#06b6d4", 420, .35)])
def a_prod_rail():
    return S([C([W("anchor", aid="products", aoff=dm(80)),
                 W("heading", text="وصل حديثاً", tag="h2", fs=dm(44, 30), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.2}, fxs=th["hfx"]("p"), **anim("fadeUp")),
                 T("مرّر أفقياً لتتصفّح أحدث ما وصل — بطاقات زجاجية بحدّ نيون يضيء عند المرور.", 17, "#cbd5e1", "start", **anim("fadeUp", .7, .1)),
                 W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(290, 230), gap=dm(22, 14), rad=dm(24), cbg="#0f1530", bbg="#7c3aed", pdemo="a",
                   fxs=[FX("رفّ نيون أفقي", "selector .pb-pgrid{display:flex!important;overflow-x:auto;scroll-snap-type:x mandatory;padding:14px 4px 26px;scrollbar-width:thin;scrollbar-color:#7c3aed transparent}selector .pb-pc{flex:0 0 min(290px,74vw);scroll-snap-align:start;background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03))!important;border:1px solid rgba(167,139,250,.35);color:#fff;backdrop-filter:blur(10px);transition:transform .4s,box-shadow .4s,border-color .4s}selector .pb-pc:hover{transform:translateY(-12px);border-color:#22d3ee;box-shadow:0 0 0 1px #22d3ee,0 26px 60px rgba(124,58,237,.5)}selector .pb-pc h3{color:#fff}selector .pb-pcp b{color:#c4b5fd}selector .pb-pcp s{color:#64748b}"), cardratio("1/1")])], w=100)],
             pad=dm([70, 20, 40, 20], [44, 16, 24, 16]), fxs=th["bgB"]("p"))
def bcell(ic, t, x, i, accent):
    return IB(ic, t, x, tc="#ffffff", xc="#cbd5e1", isz=36, al={"d": "start"}, fxs=[FX("خلية بنتو", "selector .pb-ib{text-align:start;padding:26px;border-radius:26px;background:linear-gradient(150deg,%s,rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.14);height:100%%;box-sizing:border-box;transition:transform .4s,box-shadow .4s}selector .pb-ib:hover{transform:translateY(-6px);box-shadow:0 22px 50px %s}selector h3,selector p{text-align:start}" % (accent[0], accent[1])), floaty(k + "bn%d" % i, ".pb-ibi", 6, 4 + i * .4)], **anim("fadeUp", .7, .1 + i * .1))
def bigcell():
    return C([T("✦ لماذا تتسوّق معنا", 14, "#c4b5fd", "start", fw="800", **anim("fadeDown")),
              W("heading", text="كل شيء في مداره الصحيح", tag="h2", fs=dm(40, 28), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.25}, fxs=[gradtext(k + "bg", VIO, CYA, PNK, 6)], **anim("fadeUp")),
              T("منتجات مفحوصة قبل الشحن، ثم تأكيد هاتفي سريع، ثم توصيل إلى بابك — وتدفع فقط بعد أن تعاين طلبك.", 17, "#cbd5e1", "start", **anim("fadeUp", .7, .1)),
              W("bullets", items="فحص دقيق قبل الشحن\nتأكيد الطلب بمكالمة\nاستبدال سهل خلال 7 أيام", micon="ic:sparkle", mc=CYA, ms=dm(22), gap=dm(12), fs=dm(17, 16), color="#e2e8f0", manim="pop", **anim("fadeUp", .7, .2))],
             w=dm(40, 100), va="center", pad=dm([34, 32, 34, 32], [26, 22, 26, 22]),
             fxs=[FX("خلية بنتو كبرى", "selector{border-radius:30px;background:linear-gradient(150deg,rgba(124,58,237,.28),rgba(6,182,212,.1) 60%,rgba(255,255,255,.03));border:1px solid rgba(167,139,250,.4);box-shadow:0 30px 80px rgba(0,0,0,.4)}")])
V1, V2, V3, V4 = ("rgba(124,58,237,.3)", "rgba(124,58,237,.4)"), ("rgba(6,182,212,.26)", "rgba(6,182,212,.35)"), ("rgba(219,39,119,.26)", "rgba(219,39,119,.35)"), ("rgba(250,204,21,.18)", "rgba(250,204,21,.3)")
a_bento = S([bigcell(),
             C([bcell("truck", ICONS4[0][1], ICONS4[0][2], 0, V1), bcell("cash", ICONS4[1][1], ICONS4[1][2], 1, V2)], w=dm(30, 100), pad=dm([0, 0, 0, 0]), gap=dm(18, 12)),
             C([bcell("shield-check", ICONS4[2][1], ICONS4[2][2], 2, V3), bcell("headset", ICONS4[3][1], ICONS4[3][2], 3, V4)], w=dm(30, 100), pad=dm([0, 0, 0, 0]), gap=dm(18, 12))],
            pad=dm([60, 20, 50, 20], [34, 16, 30, 16]), gap={"d": 18, "m": 12}, fxs=th["bgA"]("bn"))
a_cats = S([C([*title("اختر مدارك", "ثلاث بوّابات إلى أحدث الأجهزة والإكسسوارات", k, tha, tha["hfx"]("c"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("gad_watch"), "dl": "أجهزة ذكية"}, {"cat": "hair", "label": "", "img": IMG("gad_earbuds"), "dl": "صوتيات محمولة"}, {"cat": "honey", "label": "", "img": IMG("acc_sunglasses"), "dl": "نظارات وإكسسوارات"}],
                 cols=dm(3, 1, 3), gap=dm(22, 16), rad=dm(34), fs=dm(19), tc="#ffffff", ov="#0b1020", ovo=35, ratio="3/4",
                 fxs=[FX("بوّابات نيون", "selector .pb-sci{border:1px solid rgba(167,139,250,.45);box-shadow:0 0 0 0 rgba(124,58,237,0);transition:transform .45s,box-shadow .45s,border-color .45s}selector .pb-sci:hover{transform:translateY(-10px) scale(1.02);border-color:#22d3ee;box-shadow:0 0 40px rgba(34,211,238,.4),0 30px 70px rgba(124,58,237,.45)}selector .pb-sci span{backdrop-filter:blur(10px);background:rgba(7,11,24,.45);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:6px 16px}")])], w=100)],
           pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), fxs=th["bgA"]("c"))
_pilot_reg("s-aurora", "store", "عام", "متجر أورورا داكن",
           "مدار: صورة بيضاوية في مدارين دوّارين مع شرائح زجاج عائمة (عناصر حرة)، رفّ نيون أفقي للمنتجات، لوح بنتو للمزايا وبوّابات نيون للفئات فوق خلفية أورورا متحركة.",
           [bar(*tha["bar"]), hdr(**tha["hdr"]), a_hero, mq(MQ, *tha["mqc"]), a_prod_rail(), a_bento, a_cats] + tail3(k, tha),
           {"ff": "'Tajawal',sans-serif", "bg": "#070b18", "header": False, "footer": False})
_pilot_demo("s-aurora", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-gold — دار الذهب: بطاقة دعوة بإطار مزدوج وأشعة آرت ديكو، فتارين مرقّمة، خطوط ذهبية بين المزايا ═══════════════════
_pilot_begin("s-gold")
_store_chunk('k = "sg"')
GD, GD2, GT, GM = "#c9992e", "#f5d77a", "#e7ddc0", "#cbbf9c"
thg = th
DECO = FX("أشعة آرت ديكو", "selector::before{content:\"\";position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 118%,rgba(201,153,46,.24) 0 3deg,transparent 3deg 9deg);-webkit-mask:radial-gradient(70% 90% at 50% 100%,#000,transparent 72%);mask:radial-gradient(70% 90% at 50% 100%,#000,transparent 72%);pointer-events:none}")
def gold_vert(text, x, tx):
    return FR("heading", V(x, -3, tx), V(300, 0, 300), V(20, 10, 20), None, 4, text=text, tag="div", fs=V(13, 12, 13), fw="800", ta={"d": "center"}, color=GD, lh={"d": 1}, rot=V(-90, 0, -90), hm=True,
              fxs=[FX("حروف متباعدة", "selector .pb-t{letter-spacing:.5em}")], **anim("fadeIn", 1.2))
g_free = [
    FR("shape", V(18, 4, 4), V(60, 36, 50), V(64, 92, 92), V(500, 450, 480), 2, shape="rect", fill="rgba(12,10,6,.55)", keep=False,
       fxs=[FX("إطار ذهبي مزدوج", "selector{border:1px solid #c9992e;box-shadow:0 0 0 7px rgba(12,10,6,.55),0 0 0 8px rgba(201,153,46,.65),0 40px 100px rgba(0,0,0,.6);backdrop-filter:blur(3px)}selector::before{content:\"◆\";position:absolute;top:-13px;left:50%;transform:translateX(-50%);color:#c9992e;background:#0c0a06;padding:0 10px;font-size:15px;line-height:1}")], **anim("zoomIn", 1)),
    FT("✦ ELEGANCE ✦", V(18, 4, 4), V(100, 72, 90), V(64, 92, 92), V(15, 14, 15), GD, "center", 5, "800", **anim("fadeDown")),
    FR("heading", V(22, 8, 8), V(140, 120, 160), V(56, 84, 84), None, 5, text="تشكيلة فاخرة تليق بذوقك الرفيع", tag="h1", fs=V(58, 32, 46), fw="900", ta={"d": "center"}, color=GD2, lh={"d": 1.25}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .9)),
    FT("قطع مختارة بعناية، بجودة استثنائية وتغليف يليق بالهدايا. نوصّلها إلى باب بيتك بكل أناقة.", V(26, 8, 10), V(330, 238, 380), V(48, 84, 80), V(19, 15, 17), GM, "center", 5, "500", **anim("fadeUp", .9, .1)),
    FR("button", V(40, 22, 32), V(420, 360, 500), V(20, 56, 36), V(56, 52, 54), 5, text="اكتشف التشكيلة", kind="link", link="#products", bgc="#b8860b", color="#1a1409", hbg="#b8860b", fs=V(18, 16, 17), fw="800", brad={"d": 4},
       fxs=[btngrad("#b8860b", GD2, "rgba(201,153,46,.55)", -3), shine(k, 3)], **anim("zoomIn", .9, .2)),
    gold_vert("MAISON · COLLECTION", -2, -2), gold_vert("LUXURY · JEWELRY · WATCHES", 82, 82),
]
g_hero = canvas3(g_free, dm(620, 540, 640), [DECO, spotlight(k, "rgba(201,153,46,.2)")], PH("jewel_dark", "rgba(12,10,6,.55)", "rgba(12,10,6,.9)", bgFixed=True))
def g_vitrine():
    return S([C([W("anchor", aid="products", aoff=dm(80)), *title("تحف مختارة", "قطع نادرة تُعرض كما في الفتارين — كل قطعة برقمها", k, thg, thg["hfx"]("p"))["widgets"],
                 W("products", mode="all", limit=6, btn="اطلب الآن", showOld=True, cardw=dm(330, 170), cols=dm(3, 2, 2), gap=dm(34, 14), rad=dm(2), cbg="#0c0a06", bbg="#b8860b", pdemo="a",
                   fxs=[FX("فتارين مرقّمة بإطار مزدوج", "selector .pb-pgrid{counter-reset:pc}selector .pb-pc{counter-increment:pc;position:relative;padding:14px 14px 18px;background:linear-gradient(170deg,#17120a,#0c0a06)!important;border:1px solid #c9992e;box-shadow:inset 0 0 0 5px #0c0a06,inset 0 0 0 6px rgba(201,153,46,.55),0 24px 60px rgba(0,0,0,.5);text-align:center;transition:transform .5s,box-shadow .5s}selector .pb-pc::before{content:\"N° \" counter(pc,decimal-leading-zero);display:block;color:#c9992e;font-size:12px;letter-spacing:.3em;font-weight:800;margin:4px 0 10px}selector .pb-pc:hover{transform:translateY(-10px);box-shadow:inset 0 0 0 5px #0c0a06,inset 0 0 0 6px #f5d77a,0 40px 80px rgba(201,153,46,.32)}selector .pb-pc h3{color:#f5d77a;font-weight:800;letter-spacing:.03em}selector .pb-pcp{justify-content:center}selector .pb-pcp b{color:#c9992e}selector .pb-pcp s{color:#8a7a52}selector .pb-pcb{background:transparent!important;border:1px solid #c9992e;color:#f5d77a;border-radius:2px}selector .pb-pc:hover .pb-pcb{background:#b8860b!important;color:#1a1409}"), cardratio("1/1")])], w=100)],
             pad=dm([80, 20, 80, 20], [44, 16, 48, 16]), fxs=GOLDBG("p"))
def g_cats():
    return S([C([*title("المجموعات الفاخرة", "ثلاث دور عرض لتختار منها", k, thg, thg["hfx"]("c"))["widgets"],
                 W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("jewel_pearl"), "dl": "مجوهرات وقلائد"}, {"cat": "hair", "label": "", "img": IMG("watch_hand"), "dl": "ساعات راقية"}, {"cat": "honey", "label": "", "img": IMG("jewel_ring"), "dl": "خواتم وأطقم"}],
                   cols=dm(3, 1, 3), gap=dm(34, 22), rad=dm(2), fs=dm(17), tc=GD2, ov="#0c0a06", ovo=30, ratio="4/5",
                   fxs=[FX("لوحات بإطار مزدوج وشريط ذهبي", "selector .pb-sci{border:1px solid #c9992e;padding:0;transition:transform .5s,box-shadow .5s}selector .pb-sci::after{content:\"\";position:absolute;inset:10px;border:1px solid rgba(245,215,122,.7);pointer-events:none;transition:inset .5s}selector .pb-sci:hover{transform:translateY(-8px);box-shadow:0 30px 60px rgba(201,153,46,.3)}selector .pb-sci:hover::after{inset:16px}selector .pb-sci span{background:rgba(12,10,6,.82);border-top:1px solid #c9992e;letter-spacing:.08em}")])], w=100)],
             pad=dm([70, 20, 70, 20], [40, 16, 44, 16]), fxs=GOLDBG("c"))
def g_story():
    tx = C([T("— حكاية الدار —", 14, GD, "start", fw="800", **anim("fadeDown")),
            W("heading", text="قصتنا", tag="h2", fs=dm(44, 30), fw="900", ta={"d": "start"}, color=GD2, fxs=[goldshimmer(k + "s", 6)], **anim("fadeUp")),
            T("بدأنا بشغف واحد: تقديم منتجات أصلية بمقاييس الجودة العالية. كل قطعة تمرّ بفحص دقيق قبل أن تصل إليك، ونلتزم بالشفافية والسرعة في كل طلب.", 18, GM, "start", **anim("fadeUp", .8, .1))], w=dm(42, 100), va="center", pad=dm([0, 0, 0, 0]))
    tb = C([W("table", tbl="الميزة | متجرنا | غيرنا\nمنتجات أصلية | ✔ | ✘\nدفع عند الاستلام | ✔ | ✘\nاستبدال 7 أيام | ✔ | ✘", thead=True, tzb=True, thbg="#b8860b", thc="#1a1409", tbd="#c9992e66", tbfs=dm(16), tbal="center",
              fxs=[FX("جدول داكن", "selector table{color:#e7ddc0;background:#14100a;border-radius:2px;overflow:hidden}")], **anim("fadeUp", .8, .15))], w=dm(58, 100), va="center", pad=dm([10, 0, 10, 0], [0, 0, 0, 0]),
            fxs=[FX("خط فاصل ذهبي", "@media(min-width:768px){selector{border-inline-start:1px solid rgba(201,153,46,.55);padding-inline-start:48px}}")])
    return S([tx, tb], pad=dm([70, 20, 50, 20], [44, 16, 30, 16]), gap={"d": 48, "m": 22}, fxs=GOLDBG("s"))
def g_vows():
    cols = []
    for i, (ic, t, x) in enumerate(ICONS4):
        cols.append(C([IB(ic, t, x, tc=GD2, xc=GM, isz=40, fxs=[FX("بلا بطاقة: خط ذهبي رفيع", "selector .pb-ib{background:none;border:0;box-shadow:none;padding:12px 8px;text-align:center}selector .pb-ibi{filter:drop-shadow(0 0 14px rgba(201,153,46,.5))}selector h3,selector p{text-align:center;letter-spacing:.04em}"), floaty(k + "v%d" % i, ".pb-ibi", 4, 5 + i * .4)], **anim("fadeUp", .7, .1 + i * .1))],
                      w=dm(25, 50), pad=dm([8, 0, 8, 0]), fxs=([FX("فاصل ذهبي", "@media(min-width:768px){selector{border-inline-start:1px solid rgba(201,153,46,.45)}}")] if i else [])))
    return S(cols, pad=dm([40, 20, 70, 20], [26, 16, 40, 16]), gap={"d": 0, "m": 8}, fxs=GOLDBG("v"))
_pilot_reg("s-gold", "store", "فخامة", "متجر فخامة ذهبية",
           "بطاقة دعوة بإطار ذهبي مزدوج وأشعة آرت ديكو فوق صورة الهيرو، فتارين منتجات مرقّمة بإطار مزدوج، لوحات فئات بإطار داخلي، قصة العلامة بفاصل ذهبي رفيع ومزايا بخطوط بلا بطاقات.",
           [bar(*thg["bar"]), hdr(**thg["hdr"]), g_hero, mq(MQ, *thg["mqc"]), g_cats(), g_vitrine(), g_story(), g_vows()] + tail3(k, thg),
           {"ff": "'El Messiri',sans-serif", "bg": "#0c0a06", "header": False, "footer": False})
_pilot_demo("s-gold", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-fresh — نقاء: كتلة عضوية متحوّلة للصورة، بطاقات منتجات باستيل بصور دائرية، فئات حبّات، وصفة بثلاث خطوات ═══════════════════
_pilot_begin("s-fresh")
_store_chunk('k = "sf"')
GRN, GRN2, LIM, DKG, MUT = "#16a34a", "#15803d", "#65a30d", "#14532d", "#4b6358"
thf = th
BLOB = "58% 42% 52% 48% / 46% 56% 44% 54%"
def benefit(i, ic, t, x, D, M, Tb):
    wd = IB(ic, t, x, tc=DKG, xc=MUT, isz=34, fxs=[FX("بطاقة منعشة بيضاء", "selector .pb-ib{background:#fff;border:1px solid #ecfccb;border-radius:22px;padding:14px 18px;box-shadow:0 18px 44px rgba(20,83,45,.16);display:flex;align-items:center;gap:12px;text-align:start}selector h3{font-size:16px;margin:0}selector p{font-size:13px;margin:2px 0 0}"), floaty(k + "b%d" % i, ".pb-ib", 8, 4.2 + i * .6)], **anim("zoomIn", .8, .4 + i * .15))
    return FRW(wd, V(D[0], M[0], Tb[0]), V(D[1], M[1], Tb[1]), V(23, 54, 34), None, 7)
f_free = [
    FR("shape", V(8, -8, 6), V(40, 20, 30), V(36, 110, 66), V(580, 360, 560), 1, shape="ellipse", fill="#bbf7d0", keep=False, op=.75,
       fxs=[FX("كتلة خضراء خلف الصورة", "selector{border-radius:58% 42% 52% 48%/46% 56% 44% 54%;animation:b3morph 14s ease-in-out infinite}@keyframes b3morph{50%{border-radius:42% 58% 46% 54%/56% 44% 56% 44%;transform:rotate(6deg)}}")]),
    FR("image", V(14, 22, 27), V(50, 40, 52), V(26, 56, 46), None, 3, src=IMG("skin_oil"), alt="زجاجة زيت عناية طبيعي", fit="cover", hauto=True,
       fxs=[ratioframe("2/3"), FX("كتلة عضوية للصورة", "selector{overflow:visible!important}selector .pb-im{border-radius:58% 42% 52% 48%/46% 56% 44% 54%;box-shadow:0 40px 80px rgba(20,83,45,.28);animation:b3morph2 12s ease-in-out infinite}@keyframes b3morph2{50%{border-radius:46% 54% 44% 56%/54% 44% 56% 46%}}")], **anim("zoomIn", 1, .1)),
    benefit(0, "leaf", "طبيعي 100%", "بلا مواد كيميائية ضارة", (2, 150), (2, 70), (6, 90)),
    benefit(1, "drop", "زيوت نقية", "معصورة على البارد", (34, 500), (46, 330), (58, 470)),
    FT("🌿 طبيعة صافية — صحة أفضل", V(52, 6, 6), V(100, 440, 660), V(44, 88, 88), V(15, 14, 15), GRN2, "start", 6, "800", **anim("fadeDown")),
    FR("heading", V(52, 6, 6), V(140, 480, 700), V(46, 88, 88), None, 6, text="عافية من قلب الطبيعة تصلك حتى باب بيتك", tag="h1", fs=V(48, 32, 46), fw="900", ta={"d": "start"}, color=DKG, lh={"d": 1.25}, fxs=[gradtext(k, GRN2, LIM, "#0d9488", 8)], **anim("fadeUp", .8)),
    FT("أعشاب وزيوت وعسل ومنتجات عناية طبيعية مفحوصة ومضمونة. اطلب الآن وادفع عند الاستلام.", V(52, 6, 6), V(318, 610, 820), V(42, 88, 88), V(19, 16, 18), MUT, "start", 6, "500", **anim("fadeUp", .8, .1)),
    FR("button", V(76, 6, 6), V(430, 720, 920), V(22, 64, 28), V(56, 50, 54), 6, text="تسوّق المنتجات", kind="link", link="#products", bgc=GRN, color="#ffffff", hbg=GRN, fs=V(18, 16, 17), fw="800", brad={"d": 999},
       fxs=[btngrad(GRN, LIM, "rgba(22,163,74,.4)"), shine(k), pulse(k, "22,163,74", 2.4)], **anim("fadeUp", .8, .2)),
    FR("tbadges", V(52, 6, 6), V(520, 800, 1000), V(46, 88, 88), None, 6, items="100% طبيعي\nمفحوص ومضمون", live=True, liveText="يتصفحون الآن", lmin=9, lmax=33, cbg="#ffffff", cc=DKG, cbc="#d9f99d", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3)),
]
WAVE = FX("حافة متموّجة أسفل الهيرو", "selector::after{content:\"\";position:absolute;left:-6%;right:-6%;bottom:-1px;height:64px;background:#fff;border-radius:50% 50% 0 0/100% 100% 0 0;pointer-events:none}")
f_hero = canvas3(f_free, dm(660, 890, 1080), [aurora(k, "#f7fee7", "#bef26499", "#6ee7b777", "#fef08a66", 20), blobs(k, "#86efac", "#fde68a", 360, .5), WAVE])
PAST = ["#ecfccb", "#fef9c3", "#ffedd5", "#e0f2fe", "#f3e8ff", "#fce7f3"]
def f_shelf():
    css = "selector .pb-pgrid{counter-reset:pc}selector .pb-pc{text-align:center;border-radius:34px;border:0;padding:20px 16px 18px;transition:transform .45s cubic-bezier(.3,1.6,.5,1),box-shadow .4s;box-shadow:0 14px 34px rgba(20,83,45,.1)}" + "".join("selector .pb-pc:nth-child(6n+%d){background:%s!important}" % (i + 1, c) for i, c in enumerate(PAST)) + "selector .pb-pc:hover{transform:translateY(-12px) rotate(-1.2deg);box-shadow:0 30px 60px rgba(22,163,74,.28)}selector .pb-pci{width:88%;margin:0 auto 12px;overflow:visible!important}selector .pb-pci img{border-radius:50%;box-shadow:0 12px 30px rgba(20,83,45,.2);border:5px solid #fff;box-sizing:border-box}selector .pb-pcd{top:6px;left:auto;right:auto;width:auto;inset-inline-end:2px;z-index:2}selector .pb-pc h3{color:#14532d}selector .pb-pcp{justify-content:center}selector .pb-pcp b{background:#16a34a;color:#fff;border-radius:999px;padding:3px 14px}selector .pb-pcb{border-radius:999px!important;width:auto;padding:9px 26px;margin-inline:auto}@media(max-width:767px){selector .pb-pc{padding:14px 8px 14px}selector .pb-pc h3{font-size:14px}selector .pb-pcp b{font-size:14px;padding:2px 9px;white-space:nowrap}selector .pb-pcp s{display:none}selector .pb-pcb{padding:8px 16px;font-size:14px}}"
    return S([C([W("anchor", aid="products", aoff=dm(80)), *title("من أرض الطبيعة", "منتجات طازجة وصافية بلا إضافات", k, thf, thf["hfx"]("p"))["widgets"],
                 W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(340, 150), cols=dm(3, 2, 2), gap=dm(24, 12), rad=dm(34), cbg="#ecfccb", bbg=GRN, pdemo="a", fxs=[FX("رفّ الطبيعة: بطاقات باستيل بصور دائرية", css), cardratio("1/1")])], w=100)],
             pad=dm([40, 20, 80, 20], [24, 16, 48, 16]), fxs=[FX("خلفية بيضاء", "selector{background:#fff}")])
def f_cats():
    return S([C([*title("اختر حاجتك الطبيعية", "أعشاب وزيوت وعسل من الطبيعة", k, thf, thf["hfx"]("c"))["widgets"],
                 W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("herb_tea"), "dl": "أعشاب وشاي"}, {"cat": "hair", "label": "", "img": IMG("skin_dropper"), "dl": "زيوت العناية"}, {"cat": "honey", "label": "", "img": IMG("honey_dipper"), "dl": "عسل طبيعي"}],
                   cols=dm(3, 1, 3), gap=dm(22, 14), rad=dm(999), fs=dm(20), tc="#ffffff", ov=DKG, ovo=35, ratio="5/3",
                   fxs=[FX("حبّات بيضاوية", "selector .pb-sci{border:6px solid #fff;box-shadow:0 18px 44px rgba(20,83,45,.2);transition:transform .45s cubic-bezier(.3,1.6,.5,1),box-shadow .4s}selector .pb-sci:hover{transform:scale(1.05) rotate(-1deg);box-shadow:0 28px 60px rgba(22,163,74,.35)}selector .pb-sci span{font-weight:900;text-shadow:0 2px 12px rgba(20,83,45,.7)}")])], w=100)],
             pad=dm([50, 20, 60, 20], [30, 16, 36, 16]), fxs=thf["bgA"]("c"))
def f_step(i, n, ic, t, x, c):
    return C([IB(ic, t, x, tc=DKG, xc=MUT, isz=36, fxs=[FX("حبّة خطوة", "selector .pb-ib{display:flex;align-items:center;gap:16px;text-align:start;background:" + c + ";border-radius:999px;padding:16px 26px 16px 16px;box-shadow:0 12px 30px rgba(20,83,45,.1);position:relative}selector .pb-ib h3{margin:0;font-size:18px}selector .pb-ib p{margin:2px 0 0;font-size:14px}selector .pb-ib::before{content:\"" + n + "\";position:absolute;inset-inline-start:-14px;top:-14px;width:40px;height:40px;border-radius:50%;background:#16a34a;color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;border:3px solid #fff}"), lift(".pb-ib", "rgba(22,163,74,.3)", -6, 0)], **anim("fadeUp", .7, .1 + i * .12))], w=dm(33, 100), pad=dm([0, 0, 0, 0]))
f_steps = S([C([*title("الوصفة في ثلاث خطوات", "من اختيارك إلى باب بيتك دون عناء", k, thf, thf["hfx"]("s"))["widgets"]], w=100, pad=dm([0, 0, 26, 0])),
             f_step(0, "1", "leaf", "اختر منتجك", "من أعشاب وزيوت وعسل", "#ecfccb"), f_step(1, "2", "headset", "نؤكّد طلبك", "بمكالمة قصيرة", "#fef9c3"), f_step(2, "3", "truck", "استلم وادفع", "بعد المعاينة عند بابك", "#e0f2fe")],
            pad=dm([60, 20, 70, 20], [36, 16, 44, 16]), gap={"d": 26, "m": 18}, fxs=[aurora(k + "st", "#ffffff", "#d9f99d66", "#a7f3d044", "#fef9c333", 26)])
def f_feat():
    return S(feat4(k, thf, ICONS4, thf["fcard"]), pad=dm([20, 20, 60, 20], [14, 16, 40, 16]), gap={"d": 18}, fxs=thf["bgA"]("c2"))
_pilot_reg("s-fresh", "store", "صحة وعسل", "متجر طبيعي منعش",
           "كتلة عضوية متحوّلة تحمل صورة المنتج مع بطاقتي ميزة عائمتين وحافة متموّجة، رفّ بطاقات باستيل بصور دائرية، فئات حبّات بيضاوية ووصفة بثلاث خطوات على شكل حبّات.",
           [bar(*thf["bar"]), hdr(**thf["hdr"]), f_hero, mq(MQ, *thf["mqc"]), f_cats(), f_shelf(), f_steps, f_feat()] + tail3(k, thf),
           {"ff": "'Almarai',sans-serif", "bg": "#ffffff", "header": False, "footer": False})
_pilot_demo("s-fresh", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ s-pop — بوب ماركت: عنوان ضخم بحدّ صلب، حذاء داخل انفجار نجمي دوّار، تذكرة عدّاد، شريط تحذير مائل، صفوف منتجات ملوّنة ═══════════════════
_pilot_begin("s-pop")
_store_chunk('k = "sp"')
INK, PINK, YEL, CYN, LIMP, ORG = "#111111", "#ff3d81", "#fde047", "#a5f3fc", "#bef264", "#fdba74"
thp = th
STROKE = lambda w=3, o=6: FX("نص بحدّ وظلّ صلب", "selector .pb-t{-webkit-text-stroke:" + str(w) + "px #111;text-shadow:" + str(o) + "px " + str(o) + "px 0 #111}")
STAR = "polygon(50% 0,61% 16%,79% 7%,80% 26%,100% 30%,90% 47%,100% 65%,81% 69%,79% 90%,61% 83%,50% 100%,39% 83%,21% 90%,19% 69%,0 65%,10% 47%,0 30%,19% 26%,21% 7%,39% 16%)"
p_free = [
    FR("heading", V(4, 4, 4), V(40, 10, 40), V(92, 92, 92), None, 5, text="تسوّق بجرأة!", tag="h1", fs=V(104, 50, 80), fw="900", ta={"d": "center"}, color="#ffffff", lh={"d": 1.05}, fxs=[STROKE(4, 8)], **anim("zoomIn", .8)),
    # انفجار نجمي دوّار خلف الحذاء + الصورة الأصلية fashion_sneakers داخل شكل نجمي بنسبتها 4:5 (النسبة ونقطة التركيز وسيطان)
    FR("shape", V(6, 8, 17), V(190, 200, 205), V(36, 84, 66), V(460, 330, 540), 2, shape="burst", fill=PINK, keep=False, rot=V(0, 0, 0),
       fxs=[FX("انفجار دوّار", "selector{animation:b3burst 22s linear infinite;filter:drop-shadow(8px 8px 0 #111)}@keyframes b3burst{to{transform:rotate(360deg)}}")]),
    FR("image", V(11, 18, 30), V(241, 209, 270), V(26, 64, 40), None, 3, src=IMG("fashion_sneakers"), alt="حذاء رياضي ملوّن على خلفية صفراء", fit="cover", hauto=True, rot=V(-8, -8, -8),
       fxs=[ratioframe("4/5"), FX("إطار نجمي بظلّ صلب", "selector{overflow:visible!important}selector .pb-im{clip-path:" + STAR + ";filter:drop-shadow(0 0 0 #111)}selector{filter:drop-shadow(6px 6px 0 #111);transition:transform .35s cubic-bezier(.2,.8,.2,1)}selector:hover{transform:rotate(-2deg) scale(1.05)!important}")], **anim("zoomIn", .9, .2)),
    FT("أحدث الصيحات بأسعار مجنونة. اطلب الآن وادفع عند الاستلام — لا مجال للمخاطرة!", V(52, 6, 6), V(230, 560, 770), V(44, 88, 88), V(22, 18, 20), INK, "start", 6, "800", **anim("fadeUp", .8, .1)),
    FR("button", V(70, 6, 6), V(340, 690, 880), V(28, 88, 44), V(60, 56, 58), 6, text="اطلب قبل نفاد الكمية", kind="link", link="#products", bgc=PINK, color="#ffffff", hbg=PINK, fs=V(19, 17, 18), fw="900", brad={"d": 14},
       fxs=[FX("زر بظلّ صلب", "selector .pb-btn{border:3px solid #111;box-shadow:6px 6px 0 #111;transition:transform .15s,box-shadow .15s}selector .pb-btn:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 #111}selector .pb-btn:active{transform:translate(4px,4px);box-shadow:2px 2px 0 #111}"), shine(k, 2.6)], **anim("fadeUp", .8, .2)),
    # تذكرة: مخزون + عدّاد (عنصران أصليان) على لوح أبيض بحدّ مسنّن
    FRW(W("stock", smode="manual", sn=11, smax=40, stx="⚡ بقيت {n} قطع فقط!", color=INK, sbgc="#ffffff", fs=dm(20, 16), fxs=[stockbar(k), FX("لوحة", "selector{background:#fff;border:3px solid #111;border-radius:18px;box-shadow:6px 6px 0 #111;padding:16px}")], **anim("zoomIn", .8, .3)), V(52, 6, 6), V(430, 760, 970), V(44, 88, 88), None, 6),
    FRW(W("countdown", mode="daily", cbg="#111111", color=YEL, fs=dm(38, 26), crad=dm(12), al={"d": "center"}, fxs=[cdglow(k, PINK)], **anim("zoomIn", .8, .4)), V(52, 6, 6), V(530, 860, 1060), V(44, 88, 88), None, 6),
]
p_hero = canvas3(p_free, dm(660, 1010, 1160), POPBG("h") + [FX("قصّ الدوران", "selector{overflow:hidden}")])
def p_tape():
    """شريط تحذير مائل: عنصر «شريط متحرك» أصلي بزاوية، يعبر الصفحة بين الهيرو والفئات"""
    return S([C([W("marquee", mqt="جديد   ★   مجنون   ★   حصري   ★   لفترة محدودة   ★   اطلب الآن   ★   الدفع عند الاستلام", mqs=18, mqd="ltr", mqg=dm(40), mqp=True, mqbg=INK, mqc=YEL, fs=dm(26, 20), fw="900",
                   fxs=[FX("شريط مائل", "selector{transform:rotate(-1.6deg);margin:0 -2%;width:104%;border-top:3px solid #111;border-bottom:3px solid #111;box-shadow:0 8px 0 rgba(0,0,0,.18)}"), marqueefx()])], w=100)],
             layout="full", pad=dm([14, 0, 14, 0]), fxs=[FX("خلفية صفراء", "selector{background:#fde047;overflow:hidden}")])
def p_cats():
    return S([C([*title("اختر ستايلك!", "ألوان وأحذية وإكسسوارات للجريئين", k, thp, thp["hfx"]("c"))["widgets"],
                 W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("shoe_sneaker"), "dl": "أحذية رياضية"}, {"cat": "hair", "label": "", "img": IMG("acc_pink"), "dl": "إكسسوارات وردية"}, {"cat": "honey", "label": "", "img": IMG("fashion_shirts"), "dl": "ستايل يومي"}],
                   cols=dm(3, 1, 3), gap=dm(26, 20), rad=dm(0), fs=dm(24), tc="#ffffff", ov=INK, ovo=15, ratio="1/1",
                   fxs=[FX("بلاطات مائلة بحدّ صلب", "selector .pb-sci{clip-path:polygon(9% 0,100% 0,91% 100%,0 100%);transition:transform .2s,filter .2s;filter:drop-shadow(7px 7px 0 #111)}selector .pb-sci:hover{transform:translate(-4px,-4px) skewX(-3deg);filter:drop-shadow(11px 11px 0 #111)}selector .pb-sci span{font-weight:900;-webkit-text-stroke:1.5px #111;text-shadow:3px 3px 0 #111;font-size:26px}")])], w=100)],
             pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), fxs=POPBG2("c"))
def p_rows():
    cols = ["#a5f3fc", "#fbcfe8", "#bef264", "#fdba74", "#c4b5fd", "#fde047"]
    css = "selector .pb-pgrid{counter-reset:pc}selector .pb-pc{counter-increment:pc;position:relative;overflow:visible!important;display:grid!important;grid-template-columns:42% 1fr;grid-template-rows:1fr auto auto 1fr;column-gap:18px;align-items:center;text-align:start;border:3px solid #111;border-radius:22px;box-shadow:8px 8px 0 #111;padding:14px;transition:transform .18s,box-shadow .18s}" + "".join("selector .pb-pc:nth-child(6n+%d){background:%s!important}" % (i + 1, c) for i, c in enumerate(cols)) + "selector .pb-pc:hover{transform:translate(-5px,-5px) rotate(-.8deg);box-shadow:13px 13px 0 #111}selector .pb-pci{grid-row:1/5;border:3px solid #111;border-radius:16px;background:#fff}selector .pb-pc h3{grid-column:2;align-self:end;font-size:20px;font-weight:900;color:#111;margin:0}selector .pb-pcp{grid-column:2;justify-content:flex-start}selector .pb-pcp b{font-size:24px;background:#111;color:#fde047;padding:2px 12px;border-radius:8px;transform:rotate(-2deg)}selector .pb-pcb{grid-column:2;align-self:start;justify-self:start;border:3px solid #111;box-shadow:4px 4px 0 #111;border-radius:12px!important;color:#fff;padding:8px 22px}selector .pb-pc::after{content:\"#\" counter(pc,decimal-leading-zero);position:absolute;top:-14px;inset-inline-end:14px;background:#111;color:#fde047;font-weight:900;padding:2px 12px;border-radius:8px;font-size:15px}@media(max-width:1023px){selector .pb-pc{grid-template-columns:1fr;grid-template-rows:auto}selector .pb-pci,selector .pb-pc h3,selector .pb-pcp,selector .pb-pcb{grid-column:1;grid-row:auto}}"
    return S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر جنوناً", "قطع تنفد بسرعة قبل أن تلحق بها", k, thp, thp["hfx"]("p"))["widgets"],
                 W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, cardw=dm(520, 300, 340), cols=dm(2, 1, 2), gap=dm(34, 26), rad=dm(22), cbg="#ffffff", bbg=PINK, pdemo="a", fxs=[FX("صفوف ملوّنة: صورة + اسم + سعر + زر", css), cardratio("1/1")])], w=100)],
             pad=dm([50, 20, 80, 20], [34, 16, 50, 16]), fxs=POPBG("p"))
def p_step(i, n, ic, t, x, c):
    return IB(ic, t, x, tc=INK, xc="#222222", isz=40, fxs=[FX("شريط خطوة", "selector .pb-ib{display:flex;align-items:center;gap:20px;text-align:start;background:" + c + ";border:3px solid #111;border-radius:18px;box-shadow:7px 7px 0 #111;padding:18px 24px;transition:transform .18s,box-shadow .18s;transform:rotate(" + ("-1" if i % 2 == 0 else "1") + "deg)}selector .pb-ib:hover{transform:translate(-4px,-4px) rotate(0);box-shadow:11px 11px 0 #111}selector h3{margin:0;font-size:22px;font-weight:900}selector p{margin:2px 0 0}selector .pb-ib::after{content:\"" + n + "\";margin-inline-start:auto;font-size:54px;font-weight:900;color:transparent;-webkit-text-stroke:2px #111;line-height:1}"), ], **anim("fadeUp", .7, .1 + i * .12))
p_why = S([C([W("heading", text="لماذا نحن؟", tag="h2", fs=dm(52, 34), fw="900", ta={"d": "start"}, color="#ffffff", fxs=[STROKE(2, 5)], **anim("fadeUp")),
              W("bullets", items="أسعار لا تُقاوَم\nمنتجات أصلية 100%\nتوصيل سريع لكل الولايات\nالدفع عند الاستلام فقط\nاستبدال سهل خلال 7 أيام", micon="ic:star", mc=PINK, ms=dm(26), gap=dm(14), fs=dm(21, 17), color=INK, fw="800", manim="pop", **anim("fadeUp", .7, .1))], w=dm(44, 100), va="center"),
           C([p_step(0, "1", "target", "اختر قطعتك", "بين أحدث الصيحات", "#a5f3fc"), p_step(1, "2", "headset", "نؤكّد معك", "مكالمة سريعة", "#fbcfe8"), p_step(2, "3", "truck", "استلم وادفع", "عند باب بيتك", "#bef264")], w=dm(56, 100), va="center", gap=dm(22, 18))],
          pad=dm([70, 20, 70, 20], [44, 16, 44, 16]), gap={"d": 44, "m": 26}, fxs=[FX("خلفية سماوية", "selector{background:#a5f3fc;border-top:4px solid #111;border-bottom:4px solid #111}")])
_pilot_reg("s-pop", "store", "أزياء وترفيه", "متجر بوب جريء",
           "عنوان ضخم بحدّ وظلّ صلب، حذاء داخل انفجار نجمي دوّار، تذكرة مخزون وعدّاد، شريط تحذير مائل، بلاطات فئات مائلة، صفوف منتجات ملوّنة مرقّمة وخطوات بشرائط متراصّة.",
           [bar(*thp["bar"]), hdr(**thp["hdr"]), p_hero, p_tape(), p_cats(), p_rows(), p_why] + tail3(k, thp),
           {"ff": "'Changa',sans-serif", "bg": "#ffffff", "header": False, "footer": False})
_pilot_demo("s-pop", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()
