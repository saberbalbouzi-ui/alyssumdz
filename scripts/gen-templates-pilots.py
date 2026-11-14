# ═════════ تجربتا التصميم (الطور 2) — s-watches و s-tech ═════════
# يُنفَّذ أخيراً من gen-templates.py. يستبدل ناتج القالبين فقط، بمولّد عشوائي معزول
# (معرّفات العناصر ثابتة ولا تتغيّر معها معرّفات أي قالب آخر)، ويُبقي موضع كل قالب في index.json.
# المكوّنات كلها أصلية في المطوّر (عناوين/نصوص/صور/أزرار/أشكال/عدّادات/منتجات…) بلا HTML ولا كود مخصص.
_PILOT = {}

def _pilot_begin(id):
    global R
    _PILOT["R"] = R
    R = random.Random("pilot:" + id)
def _pilot_end():
    global R
    R = _PILOT.pop("R")
def _pilot_reg(id, *a, **k):
    old = next(i for i, t in enumerate(TEMPLATES) if t["id"] == id)
    reg(id, *a, **k)
    TEMPLATES[old] = TEMPLATES.pop()
def _pilot_demo(id, groups):
    """يوزّع بيانات المنتجات التجريبية على عناصر المنتجات حسب العلامة set.pdemo (كل عنصر قائمته الخاصة)"""
    p = os.path.join(OUT, id + ".json"); pg = json.load(open(p, encoding="utf-8")); dp = PACKS[id]["dp"]
    def walk(n):
        if isinstance(n, dict):
            st = n.get("set") if n.get("type") else None
            if st and "pdemo" in st:
                g = st.pop("pdemo"); st["demo"] = [dp[i] for i in groups[g]]
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(pg["sections"])
    json.dump(pg, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

def V(d, m=None, t=None): return dm(d, m, t)
def _v(x): return x if isinstance(x, dict) else V(x)
def FR(_ty, x, y, w, h=None, z=1, **s):
    """عنصر حر في قسم قماش: x و w نسبة % من عرض القسم، y و h بكسل؛ كل قيمة رقم أو V(مكتب، جوال، تابلت)"""
    st = {"fx": _v(x), "fy": _v(y), "fwd": _v(w), "zi": z}
    if h is not None: st["fh"] = _v(h)
    st.update(s); return W(_ty, **st)
def FT(text, x, y, w, fs, color, ta="start", z=5, fw="500", lh=1.8, **s):
    return FR("text", x, y, w, None, z, html="<p>%s</p>" % text, fs=_v(fs), lh={"d": lh}, ta={"d": ta}, color=color, fw=fw, **s)
def FH(text, x, y, w, fs, color, ta="start", z=5, fw="900", tag="h2", **s):
    return FR("heading", x, y, w, None, z, text=text, tag=tag, fs=_v(fs), fw=fw, ta={"d": ta}, color=color, lh={"d": 1.25}, **s)
def focus(pos="50% 50%", sel=".pb-im"):
    """نقطة تركيز الصورة: تُبقي الإطار ونسبته ثابتين وتغيّر الجزء الظاهر عند استبدال الصورة بأي أبعاد (وسيط قابل للتعديل)"""
    return FX("نقطة تركيز الصورة", "selector %s{object-fit:cover;object-position:[[p]]}" % sel, p=("نقطة التركيز (س%% ص%%)", "text", pos))
def ratioframe(r, pos="50% 50%"):
    """إطار بنسبة ثابتة: الافتراضي نسبة الصورة الأصلية نفسها (بلا قص). استبدال الصورة بأخرى بنسبة مختلفة يقصّها بالتغطية، ونقطة التركيز تضبط الجزء الظاهر"""
    return FX("إطار الصورة: النسبة ونقطة التركيز", "selector .pb-im{aspect-ratio:[[r]];width:100%;height:auto!important;object-fit:cover;object-position:[[p]]}", r=("نسبة الإطار (عرض/ارتفاع)", "text", r), p=("نقطة التركيز (س% ص%)", "text", pos))
def cardratio(r="1/1"):
    """نسبة صورة بطاقة المنتج ثابتة: أي صورة منتج تُقصّ بالتغطية فتتساوى البطاقات"""
    return FX("نسبة صورة البطاقة", "selector .pb-pci{aspect-ratio:[[r]];position:relative;overflow:hidden}selector .pb-pci img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}", r=("النسبة", "text", r))
def canvas(free, mh, fxs, bg_set=None, cw=1100):
    sec = S([C([])], kind="canvas", layout="boxed", cw={"d": cw}, mh=mh, pad=dm([0, 0, 0, 0]), fxs=fxs, **(bg_set or {}))
    sec["free"] = free; return sec

# ═══════════════════ التجربة أ — s-watches: تحرير مجلاتي بساعة بطلة ═══════════════════
_pilot_begin("s-watches")
k = "nw"; ICC[0] = "#c9992e"
GOLD, GOLD2, MUTE, TXT = "#c9992e", "#f5d77a", "#b9ae8f", "#e7ddc0"
BLKW = lambda s: [FX("خلفية فحمية", "selector{background:radial-gradient(70% 90% at 75% 0%,#262218,#0a0a0a 62%),#0a0a0a}")]
thw = TH(k, True, GOLD2, MUTE, GOLD, GOLD2, "#ffffff08", BLKW, BLKW,
         dict(sbg="#050505", tc="#8a8168", hc=GOLD2, lc="#8a8168", lh=GOLD2),
         [FX("لوحة ذهبية", "selector{background:linear-gradient(135deg,#17130a,#2b2110);border:1px solid #c9992e;box-shadow:0 0 0 7px rgba(201,153,46,.1),0 40px 90px rgba(0,0,0,.6)}"), spotlight(k + "o", "rgba(201,153,46,.2)")],
         dict(hbg="#0a0a0a", hbr="#c9992e55", lc=GOLD2, lac="#ffffff", mc=TXT, cbg="#b8860b"),
         ("⌚ ضمان دولي سنتان  ·  تغليف فاخر مع كل ساعة  ·  الدفع عند الاستلام", "#0a0a0a", GOLD2, GOLD), ("#14100a", GOLD2),
         hfx=lambda s: [goldshimmer(k + s, 6)], ctr=[goldshimmer(k + "c", 6)],
         prods=dict(cbg="#14100a", bbg="#b8860b", rad=6, fxs=[FX("بطاقة ساعة", "selector .pb-pc{border:1px solid #c9992e66;transition:transform .45s,box-shadow .45s}selector .pb-pc:hover{transform:translateY(-10px);box-shadow:0 30px 64px rgba(201,153,46,.3)}selector .pb-pc *{color:#f5d77a}")]),
         cats=dict(imgs=[], ov="#0a0a0a", ovo=35, rad=6, cols=3, tc=GOLD2, fxs=[]),
         offc=GOLD2, offm=TXT, cdc=GOLD2)
# المنتجات التجريبية الستة الأصلية (PACKS["s-watches"]["dp"]) تبقى كما هي بصورها وأسمائها وأسعارها

import math
ARCH = "50% 50% 0 0/34% 34% 0 0"
def archx(y, top=60, wpct=40, h=660, left=30, W=1100):
    """x (٪ من عرض القسم) لحافة القوس عند الارتفاع y — لتلامس خطوط الوصل الحافة تماماً"""
    rv = .34 * h
    if y >= top + rv: return left
    d = (top + rv - y) / rv; return left + (wpct / 100 * W / 2) * (1 - math.sqrt(max(0, 1 - d * d))) / W * 100
def callout(i, y, title, text, mx, my, mw):
    """مواصفة حول الساعة: عنوان + شرح + خط وصل ونقطة تلامس إطار القوس (الخط والنقطة يختفيان على الجوال). mx,my,mw = موضع الجوال"""
    ex = archx(y + 14) - .3
    return [
        FR("heading", V(1.5, mx), V(y, my), V(21, mw), None, 6, text=title, tag="h3", fs=V(22, 18), fw="900", ta={"d": "end", "m": "start"}, color=GOLD2, lh={"d": 1.25}, fxs=[goldshimmer(k + "c%d" % i, 6)], **anim("fadeUp", .7, .35 + i * .12)),
        FR("text", V(1.5, mx), V(y + 34, my + 30), V(21, mw), None, 6, html="<p>%s</p>" % text, fs=V(15, 14), lh={"d": 1.7}, ta={"d": "end", "m": "start"}, color=MUTE, fw="500", **anim("fadeUp", .7, .45 + i * .12)),
        FR("shape", 23, y + 14, round(ex - 23, 1), 2, 4, shape="rect", fill=GOLD, keep=False, hm=True, **anim("fadeIn", .8, .6 + i * .12)),
        FR("shape", round(ex - .5, 1), y + 9, 1, 12, 4, shape="ellipse", fill=GOLD2, keep=False, hm=True, fxs=[pulse(k + "d%d" % i, "245,215,122", 2.6)]),
    ]
hero_free = [
    FR("heading", 0, V(40, 280), 100, None, 1, text="CHRONOS", tag="p", fs=V(230, 104), fw="900", ta={"d": "center"}, color=GOLD, op=.07, lh={"d": 1}, hm=True, **anim("fadeIn", 1.4)),
    FR("shape", 28, 90, 44, 560, 2, shape="ellipse", fill=GOLD, keep=False, op=.2, hm=True, fxs=[FX("هالة ضوء ذهبية", "selector{filter:blur(70px)}")]),
    FR("image", V(30, 12, 27), V(60, 336, 100), V(40, 76, 46), V(660, 444, 565), 3, src=IMG("men_watch"), alt="ساعة كرونوغراف بسوار جلدي على خلفية سوداء", fit="cover", hauto=False,
       fxs=[FX("قوس الصورة وإطاره الذهبي", "selector{overflow:hidden;border-radius:%s}selector .pb-im{width:100%%;height:100%%;object-fit:cover;object-position:[[p]];transform:scale([[z]]);transition:transform 1.4s cubic-bezier(.2,.8,.2,1)}selector:hover .pb-im{transform:scale(calc([[z]] + .06))}selector::after{content:\"\";position:absolute;inset:12px;border:1px solid rgba(201,153,46,.65);border-radius:%s;pointer-events:none}" % (ARCH, ARCH),
               p=("نقطة التركيز (س% ص%)", "text", "50% 50%"), z=("تقريب الصورة داخل القوس", "num", 1)),
            FX("طفو هادئ", "selector{animation:nwFl 7s ease-in-out infinite}@keyframes nwFl{50%{transform:translateY(-10px)}}")], **anim("zoomIn", 1.1, .1)),
    FT("— SWISS INSPIRED —", V(68, 6), V(116, 28), V(30, 88), V(15, 14), GOLD, "start", 6, "800", **anim("fadeDown", .7)),
    FR("heading", V(66, 6), V(150, 52), V(32, 88), None, 6, text="الوقت يليق بمن يقدّره", tag="h1", fs=V(54, 40, 44), fw="900", ta={"d": "start"}, color=GOLD2, lh={"d": 1.2}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .9)),
    FT("ساعة بحركة دقيقة ومواد متينة، صُمّمت لترافقك سنوات. ضمان دولي وتغليف هدايا فاخر.", V(66, 6), V(330, 150), V(32, 88), V(17, 15), MUTE, "start", 6, "500", **anim("fadeUp", .9, .1)),
    FR("button", V(66, 6), V(442, 262), V(21, 88), V(56, 54), 6, text="اكتشف المجموعة", kind="link", link="#products", bgc="#b8860b", color="#1a1409", hbg="#b8860b", fs=V(18, 16), fw="800", brad={"d": 6},
       fxs=[btngrad("#b8860b", GOLD2, "rgba(201,153,46,.55)", -3), shine(k, 3)], **anim("zoomIn", .9, .2)),
    FR("tbadges", V(66, 6), V(560, 1014), V(32, 88), None, 6, items="ضمان سنتان\nزجاج سافير\nمقاومة 100م", cbg="#00000050", cc=GOLD2, cbc=GOLD, crad=dm(6), cfs=dm(13), gap=dm(8), jc="flex-start", **anim("fadeUp", .9, .3)),
]
hero_free += callout(0, 150, "زجاج سافير", "مضاد للخدش وللانعكاس", 52, 810, 44) + callout(1, 340, "حركة أوتوماتيكية", "احتياطي طاقة 72 ساعة", 4, 810, 44) + callout(2, 530, "مقاومة الماء 100م", "فولاذ 316L وتاج مبرغى", 4, 920, 92)
hero_free = hero_free[1:] + hero_free[:1]      # كلمة الخلفية الكبيرة (zi=1) آخر القائمة: الترتيب البصري بـzi لا بالموضع، وأول عنوان في القائمة هو عنوان الهيرو الظاهر
w_hero = canvas(hero_free, dm(780, 1064, 760), BLKW("h") + [spotlight(k, "rgba(201,153,46,.16)")])

def _num(num, al="start"):
    return W("heading", text=num, tag="p", fs=dm(120, 80), fw="900", ta={"d": al}, color="transparent", lh={"d": 1}, fxs=[outlinetext(GOLD, 2)], **anim("fadeIn", 1))
def chapter_ledger(num, kick, title, text, rows):
    """فصل نصّي: عنوان وفقرة على جهة، و«دفتر» من ثلاثة بنود بخطوط ذهبية رفيعة على الجهة الأخرى"""
    left = C([_num(num), T("— %s —" % kick, 14, GOLD, "start", fw="800", **anim("fadeDown")),
              W("heading", text=title, tag="h2", fs=dm(44, 30), fw="900", ta={"d": "start"}, color=GOLD2, lh={"d": 1.25}, fxs=[goldshimmer(k + "t" + num, 6)], **anim("fadeUp")),
              T(text, 18, MUTE, "start", **anim("fadeUp", .7, .1))], w=44, va="center", pad=dm([0, 0, 0, 0], [20, 0, 0, 0]))
    ws = []
    for i, (t, x) in enumerate(rows):
        ws += [W("heading", text=t, tag="h3", fs=dm(24, 20), fw="900", ta={"d": "start"}, color=GOLD2, lh={"d": 1.3},
                 fxs=[FX("خط ذهبي علوي", "selector{border-top:1px solid rgba(201,153,46,.45);padding-top:20px;margin-top:10px}")], **anim("fadeUp", .7, .1 + i * .12)),
               T(x, 16, MUTE, "start", **anim("fadeUp", .7, .2 + i * .12))]
    right = C(ws, w=52, va="center", pad=dm([0, 0, 0, 0]))
    return S([left, right], pad=dm([90, 20, 90, 20], [50, 16, 56, 16]), gap={"d": 64, "m": 28}, fxs=BLKW(num))
def chapter_quote(num, kick, quote, text, chips):
    """فصل نصّي: اقتباس كبير محاط بقاعدتين ذهبيتين وشارات تحته"""
    c = C([_num(num, "center"), T("— %s —" % kick, 14, GOLD, "center", fw="800", **anim("fadeDown")),
           W("heading", text=quote, tag="h2", fs=dm(44, 28), fw="900", ta={"d": "center"}, color=GOLD2, lh={"d": 1.3}, fxs=[goldshimmer(k + "q" + num, 6)], **anim("fadeUp")),
           T(text, 18, MUTE, "center", **anim("fadeUp", .7, .1)),
           W("tbadges", items=chips, cbg="#00000050", cc=GOLD2, cbc=GOLD, crad=dm(6), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .7, .2))],
          w=100, pad=dm([54, 30, 54, 30], [34, 14, 34, 14]),
          fxs=[FX("قاعدتان تحريريتان", "selector{border-top:1px solid rgba(201,153,46,.45);border-bottom:1px solid rgba(201,153,46,.45)}")])
    return S([c], cw={"d": 1000}, pad=dm([90, 20, 90, 20], [50, 16, 56, 16]), fxs=BLKW(num))
w_c1 = chapter_ledger("01", "الحرفة", "تصنيع بدقة لا تقبل التقريب", "كل قطعة تُجمَّع وتُفحص يدوياً قبل أن تصل إليك، لتبقى دقيقة سنوات طويلة.",
                      [("حركة أوتوماتيكية مضبوطة", "تعمل بحركة معصمك وتُضبط قبل الشحن."), ("زجاج سافير مضاد للخدش", "شفافية عالية ومقاومة للخدوش اليومية."), ("علبة فولاذ 316L", "فولاذ متين لا يتأثر بالاستعمال اليومي.")])
w_c2 = chapter_quote("02", "الإرث", "الساعة الجيدة لا تنتهي بانتهاء الموضة", "نختار تصاميم كلاسيكية تبقى أنيقة جيلاً بعد جيل، ونقدّم خدمة ضبط وصيانة بعد البيع.",
                     "تصاميم كلاسيكية خالدة\nضبط السوار مجاناً\nخدمة ما بعد البيع")
w_stats = S([C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(52, 34), color=GOLD2, lc=MUTE, fxs=[goldshimmer(k + "n" + str(i), 6)], **anim("zoomIn", .7, .1 + i * .1))], w=dm(25, 50), pad=dm([0, 0, 0, 0]),
              fxs=[FX("فاصل ذهبي", "@media(min-width:768px){selector{border-inline-start:1px solid #c9992e55}}")] if i else [])
             for i, (n, p, s, l) in enumerate([(21, "", "", "حجراً كريماً"), (100, "", "م", "مقاومة الماء"), (72, "", "h", "احتياطي الطاقة"), (2, "", " سنة", "ضمان دولي")])],
            pad=dm([40, 20, 50, 20], [30, 16, 36, 16]), gap={"d": 16}, fxs=BLKW("m"))
w_banner = S([C([T("— 03 —", 14, GOLD, "center", fw="800"),
                 W("heading", text="ليس مجرّد ساعة، بل رفيق رحلة", tag="h2", fs=dm(48, 30), fw="900", ta={"d": "center"}, color=GOLD2, fxs=[goldshimmer(k + "bn", 6)], **anim("fadeUp")),
                 BTN("شاهد المجموعة", bg="#b8860b", color="#1a1409", link="#products", fxs=[btngrad("#b8860b", GOLD2, "rgba(201,153,46,.55)", -3), shine(k, 3)], **anim("zoomIn", .9, .2))], w=100)],
           cw={"d": 860}, pad=dm([170, 20, 170, 20], [100, 16, 100, 16]), **PH("watch_rock", "rgba(10,10,10,.5)", "rgba(10,10,10,.82)", bgFixed=True))
w_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("المجموعة", "قطع مختارة بعناية — مرّر لتكتشف المزيد", k, thw, thw["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, slider=True, slauto=5, cardw=dm(330, 240), gap=dm(22), rad=dm(6), cbg="#14100a", bbg="#b8860b", pdemo="a", fxs=thw["prods"]["fxs"] + [cardratio("1/1")])], w=100)],
           pad=dm([70, 20, 80, 20], [44, 16, 52, 16]), fxs=BLKW("p"))
w_cats = S([C([*title("الفئات", "اختر ما يناسب ذوقك", k, thw, thw["hfx"]("k"))["widgets"],
              W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("watch_hand"), "dl": "ساعات كلاسيكية"}, {"cat": "hair", "label": "", "img": IMG("watch_pocket"), "dl": "ساعات جيب"}, {"cat": "honey", "label": "", "img": IMG("watch_wrist"), "dl": "ساعات رياضية"}],
                cols=dm(3, 2, 3), gap=dm(18), rad=dm(6), fs=dm(16), tc=GOLD2, ov="#0a0a0a", ovo=35, ratio="1/1",
                fxs=[FX("حد ذهبي", "selector a,selector .pb-sc{border:1px solid #c9992e;border-radius:6px}"), zoomcol("rgba(201,153,46,.3)")])], w=100)],
           pad=dm([60, 20, 70, 20], [40, 16, 46, 16]), fxs=BLKW("k"))
w_serv = S([C([IB(ic, t, x, tc=GOLD2, xc=TXT, isz=38, fxs=[glass("rgba(10,10,10,.55)", "rgba(201,153,46,.35)", 14, 8), lift(".pb-ib", "rgba(201,153,46,.25)", -8), floaty(k + "sv" + str(i), ".pb-ibi", 5, 5 + i * .4)], **anim("fadeUp", .7, .1 + i * .12))], w=33, pad=dm([0, 0, 0, 0]))
            for i, (ic, t, x) in enumerate([("gift", "تغليف هدايا فاخر", "علبة مخملية مع بطاقة إهداء"), ("shield-check", "ضمان دولي سنتان", "على الحركة، مع شهادة ضمان"), ("target", "ضبط السوار مجاناً", "نضبطه على معصمك قبل الشحن")])],
           pad=dm([110, 20, 110, 20], [60, 16, 60, 16]), gap={"d": 22}, **PH("men_suit", "rgba(10,10,10,.6)", "rgba(10,10,10,.85)"))
w_secs = [bar(*thw["bar"]), hdr(**thw["hdr"]), w_hero, mq("AUTOMATIC   ✦   SAPPHIRE   ✦   316L STEEL   ✦   WATER RESISTANT   ✦   SWISS MADE   ✦   LIMITED EDITION", *thw["mqc"]),
          w_c1, w_c2, w_stats, w_banner, w_prod, w_cats, w_serv, S(tests(thw, thw["tsfx"]), pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=BLKW("e")),
          offer(k, thw, thw["offfx"], thw["offc"], thw["offm"]), faq(thw, BLKW("f"), thw["accfx"]), foot(**thw["foot"])]
_pilot_reg("s-watches", "store", "ساعات", "متجر ساعات — كرونوس",
           "تحرير مجلاتي: ساعة بطلة بمواصفات موزعة حولها كعناصر حرة، فصول سرد بصري متناوبة بين الصورة والنص، سلايدر منتجات عريض وشريط خدمة بصورة كاملة.",
           w_secs, {"ff": "'El Messiri',sans-serif", "bg": "#0a0a0a", "header": False, "footer": False})
_pilot_demo("s-watches", {"a": [0, 1, 2, 3, 4, 5]})
_pilot_end()

# ═══════════════════ التجربة ب — s-tech: متجر عملي موجَّه بالاستعمال والمقارنة ═══════════════════
_pilot_begin("s-tech")
k = "st"; ICC[0] = "#2563eb"
BLUE, DARK, SLATE = "#2563eb", "#0f172a", "#64748b"
tht = dict(h=DARK, m=SLATE, a=BLUE, card="#ffffff",
           bar=("⚡ شحن سريع  ·  ضمان سنة  ·  الدفع عند الاستلام  ·  دعم فني على واتساب", DARK, "#e2e8f0", "#60a5fa"),
           hdr=dict(hbg="#ffffff", hbr="#e2e8f0", lc=DARK, lac=BLUE, mc=DARK, cbg=BLUE),
           mqc=(DARK, "#e2e8f0"),
           hfx=lambda s: [gradtext(k + s, BLUE, "#7c3aed", "#0ea5e9", 7)],
           bgA=lambda s: [gridbg(k + s, "rgba(37,99,235,.07)", 46)],
           bgB=lambda s: [FX("خلفية رمادية فاتحة", "selector{background:#f8fafc}")],
           fcard=lambda i: [softcard("#ffffff", "rgba(15,23,42,.08)", 20, 26, "#e2e8f0"), sheen(k + str(i), ".pb-ib", "rgba(37,99,235,.18)"), lift(".pb-ib", "rgba(37,99,235,.25)", -8, 3), floaty(k + "f" + str(i), ".pb-ibi", 6, 4 + i * .5)],
           ctr=[ctrcolor(BLUE, "#7c3aed")], tsfx=[tscard("#ffffff", "#e2e8f0", 20, None), lift(".pb-ts", "rgba(37,99,235,.25)", -8)],
           offfx=[aurora(k + "o", DARK, "#2563eb99", "#7c3aed77", "#0ea5e955", 12), rotborder(k, "#60a5fa", "#c084fc", 2, 5, 34)],
           accfx=[accfx("#ffffff", "#e2e8f0", 14)],
           foot=dict(sbg=DARK, tc="#94a3b8", hc="#ffffff", lc="#94a3b8", lh="#60a5fa"), cdbg="#00000066", cdc="#ffffff")
# الستة الأصلية بترتيبها (+ إضافتان من المكتبة: نظارة واقع افتراضي وساعة ذكية) مع تصنيفات لتبويبات الفئات
_dp0 = PACKS["s-tech"]["dp"]
PACKS["s-tech"] = dict(PACKS["s-tech"], dp=[dict(x, c=c) for x, c in zip(_dp0, ["حواسيب", "حواسيب", "ملحقات", "ملحقات", "صوتيات", "صوتيات"])] + [
    _P("نظارة واقع افتراضي", 52000, 58000, "gad_vr", "أجهزة ذكية"), _P("ساعة ذكية", 18500, 0, "gad_watch", "أجهزة ذكية")])

t_hero = S([
    C([T("✦ تقنية بضمان ودعم محلي", 14, BLUE, "start", fw="800", **anim("fadeDown")),
       W("heading", text="اختر جهازك حسب ما تفعله به، لا حسب اسمه", tag="h1", fs=dm(52, 32), fw="900", ta={"d": "start"}, color=DARK, lh={"d": 1.2}, fxs=[gradtext(k, BLUE, "#7c3aed", "#0ea5e9", 6)], **anim("fadeUp", .8)),
       T("أجهزة وإكسسوارات أصلية بضمان، توصيل سريع ودفع عند الاستلام، ودعم فني على واتساب.", 19, SLATE, "start", **anim("fadeUp", .8, .1)),
       BTN("تصفّح المنتجات", bg=BLUE, al="start", link="#products", fxs=[btngrad(BLUE, "#7c3aed", "rgba(37,99,235,.45)"), shine(k), pulse(k, "37,99,235", 2.4)], **anim("zoomIn", .8, .2)),
       BTN("اختر حسب الاستعمال", bg="#e0e7ff", color="#1d4ed8", al="start", link="#use", fxs=[lift(".pb-btn", "rgba(37,99,235,.3)", -3, 0)], **anim("zoomIn", .8, .3)),
       W("tbadges", items="ضمان سنة\nدفع عند الاستلام\nدعم على واتساب", cbg="#ffffff", cc=DARK, cbc="#e2e8f0", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .4))], w=50, va="center"),
    C([PIC("it_color", "حاسوب محمول بإضاءة ملوّنة على لوحة المفاتيح", 28, hauto=False, fxs=[ratioframe("1000/1250"), FX("طفو الصورة", "selector{animation:stPf 6s ease-in-out infinite}@keyframes stPf{50%{transform:translateY(-12px)}}"), FX("ظل ناعم", "selector .pb-im{box-shadow:0 40px 60px -20px rgba(37,99,235,.35)}")], **anim("fadeUp", .9, .3))],
      w=50, va="center", pad=dm([26, 26, 26, 26], [14, 14, 14, 14]), fxs=[FX("لوحة تدرّج", "selector{background:linear-gradient(145deg,#e0e7ff,#f5f3ff);border-radius:36px}")]),
], pad=dm([90, 20, 80, 20], [50, 16, 50, 16]), gap={"d": 44, "m": 26}, fxs=[gridbg(k, "rgba(37,99,235,.08)", 46), spotlight(k, "rgba(37,99,235,.18)")])

def usepill(text, link):
    return C([BTN(text, bg="#ffffff", color=DARK, al="center", link=link, brad={"d": 999}, fxs=[FX("حبّة استعمال", "selector .pb-btn{border:1px solid #cbd5e1;box-shadow:0 6px 18px rgba(15,23,42,.06);transition:transform .3s,box-shadow .3s,background .3s,color .3s}selector .pb-btn:hover{transform:translateY(-4px);background:#2563eb;color:#fff;border-color:#2563eb;box-shadow:0 16px 34px rgba(37,99,235,.35)}")])], w=dm(20, 50), pad=dm([0, 0, 0, 0]))
t_pills = S([C([T("ابحث بالاستعمال:", 17, DARK, "start", fw="900")], w=dm(14, 100), va="center", pad=dm([0, 0, 0, 0]))] +
            [usepill(t, "#use") for t in ("ألعاب وترفيه", "عمل ودراسة", "إبداع وتصميم", "تصفّح وبثّ")],
            pad=dm([34, 20, 34, 20], [22, 16, 22, 16]), gap={"d": 14, "m": 10}, fxs=[FX("شريط أبيض", "selector{background:#ffffff;border-bottom:1px solid #e2e8f0}")])

def usecard(img, alt, kick, title, desc, link, num="01"):
    return C([W("heading", text=num, tag="p", fs=dm(64, 48), fw="900", ta={"d": "start"}, color="transparent", lh={"d": 1}, fxs=[outlinetext("#ffffff", 2)]), W("spacer", mh=dm(150, 90)), T(kick, 13, "#bfdbfe", "start", fw="800"),
              W("heading", text=title, tag="h3", fs=dm(30, 26), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.2}),
              T(desc, 16, "#e2e8f0", "start"),
              BTN("اعرض الخيارات", bg="#ffffff", color=DARK, al="start", link=link, fxs=[lift(".pb-btn", "rgba(255,255,255,.35)", -3, 0)])],
             w=33, pad=dm([30, 28, 30, 28], [24, 20, 24, 20]), fxs=[FX("زوايا مدوّرة", "selector{border-radius:26px;overflow:hidden}"), zoomcol("rgba(37,99,235,.35)")],
             **PH(img, "rgba(15,23,42,.05)", "rgba(15,23,42,.9)"))
t_use = S([C([W("anchor", aid="use", aoff=dm(80)), *title("تسوّق حسب استعمالك", "قل لنا ماذا ستفعل بالجهاز، ونرشّح لك الأنسب", k, tht, tht["hfx"]("u"))["widgets"]], w=100),
           usecard("gad_vr2", "رجل بنظارة واقع افتراضي", "ألعاب وترفيه", "للّعب والترفيه", "أداء رسومي وتجربة غامرة بلا تقطيع.", "#products", "01"),
           usecard("dig_code", "حاسوب محمول على مكتب عمل", "عمل ودراسة", "للعمل والدراسة", "خفة وبطارية تدوم ولوحة مفاتيح مريحة.", "#products", "02"),
           usecard("it_dark", "حاسوب محمول مضيء في العتمة", "إبداع وتصميم", "للإبداع والتصميم", "شاشة دقيقة الألوان وقوة معالجة للمشاريع الثقيلة.", "#products", "03")],
          pad=dm([70, 20, 70, 20], [44, 16, 44, 16]), gap={"d": 22}, fxs=tht["bgB"]("u"))

t_cats = S([C([*title("تسوّق حسب الفئة", "أو تصفّح الأقسام الرئيسية", k, tht, tht["hfx"]("k"))["widgets"],
               W("shopcats", items=[{"cat": "skin", "label": "", "img": IMG("it_pc"), "dl": "حواسيب مكتبية"}, {"cat": "hair", "label": "", "img": IMG("it_laptop"), "dl": "حواسيب محمولة"}, {"cat": "honey", "label": "", "img": IMG("it_code"), "dl": "برمجة وتطوير"}],
                 cols=dm(3, 2, 3), gap=dm(18), rad=dm(20), fs=dm(16), tc="#ffffff", ov="#0f172a", ovo=40, ratio="1/1",
                 fxs=[zoomcol("rgba(37,99,235,.3)")])], w=100)],
          pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), fxs=tht["bgA"]("k"))

def tier(name, tag, bars, desc, best=False):
    ws = [T(tag, 13, BLUE if best else SLATE, "center", fw="800"), W("heading", text=name, tag="h3", fs=dm(28, 24), fw="900", ta={"d": "center"}, color=DARK)]
    ws += [W("progress", pl=l, pv=v, pc=BLUE if best else "#94a3b8", pbg="#e2e8f0", ph=dm(10), color=DARK) for l, v in bars]
    ws += [T(desc, 15, SLATE, "center"), BTN("اعرض الخيارات", bg=BLUE if best else DARK, al="center", link="#products", fxs=[lift(".pb-btn", "rgba(37,99,235,.3)", -3, 0)])]
    fx = ([FX("بطاقة الأنسب", "@media(min-width:768px){selector{transform:translateY(-14px)}}selector{border:2px solid #2563eb;box-shadow:0 30px 70px rgba(37,99,235,.22)}"), ribbon("الأنسب", BLUE, "#ffffff")]
          if best else [softcard("#ffffff", "rgba(15,23,42,.08)", 24, 30, "#e2e8f0"), lift(".pb-col", "rgba(15,23,42,.18)", -8, 0)])
    return C(ws, w=33, pad=dm([34, 28, 34, 28], [26, 20, 26, 20], [56, 16, 30, 16]), fxs=[softcard("#ffffff", "rgba(15,23,42,.08)", 24, 30, "#e2e8f0")] + fx if best else fx)
t_cmp = S([C([*title("قارن بنظرة واحدة", "ثلاث فئات تغطي أغلب الاحتياجات (المؤشرات توضيحية — عدّلها بحسب منتجاتك)", k, tht, tht["hfx"]("m"))["widgets"], W("spacer", mh=dm(26, 4))], w=100),
           tier("اقتصادي", "للاستعمال اليومي", [("الأداء", 55), ("البطارية", 70), ("السعر", 90)], "يكفي للتصفح والمتابعة والمهام الخفيفة."),
           tier("متوازن", "للجميع", [("الأداء", 78), ("البطارية", 80), ("السعر", 70)], "توازن ممتاز بين السرعة والسعر والعمر.", True),
           tier("احترافي", "للأعمال الثقيلة", [("الأداء", 96), ("البطارية", 65), ("السعر", 45)], "أقصى قوة للتصميم والبرمجة والألعاب.")],
          pad=dm([80, 20, 80, 20], [50, 16, 50, 16]), gap={"d": 24}, fxs=[gridbg(k + "m", "rgba(37,99,235,.05)", 46)])
t_featured = S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر طلباً", "اختيارات زبائننا هذا الأسبوع", k, tht, tht["hfx"]("f"))["widgets"],
                   W("products", mode="all", limit=4, btn="اطلب الآن", showOld=True, cardw=dm(250, 160), cols=dm(4, 2), gap=dm(20), rad=dm(20), cbg="#ffffff", bbg=BLUE, pdemo="a",
                     fxs=[lift(".pb-pc", "rgba(37,99,235,.28)", -10, 2), FX("بطاقة بحد خفيف", "selector .pb-pc{border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,.06)}"), cardratio("1/1")])], w=100)],
               pad=dm([70, 20, 40, 20], [44, 16, 24, 16]), fxs=tht["bgB"]("f"))
t_browse = S([C([*title("تصفّح بحسب الفئة", "بدّل بين الفئات لترى كل ما يخصّها", k, tht, tht["hfx"]("b"))["widgets"],
                 W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, tabs="cats", cardw=dm(250, 160), cols=dm(4, 2), gap=dm(20), rad=dm(20), cbg="#ffffff", bbg=BLUE, pdemo="b",
                   fxs=[lift(".pb-pc", "rgba(37,99,235,.28)", -10, 2), FX("بطاقة بحد خفيف", "selector .pb-pc{border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,.06)}"), cardratio("1/1")])], w=100)],
             pad=dm([30, 20, 70, 20], [20, 16, 44, 16]), fxs=tht["bgB"]("b"))
t_secs = [bar(*tht["bar"]), hdr(**tht["hdr"]), t_hero, mq("توصيل لكل الولايات   ✦   الدفع عند الاستلام   ✦   ضمان على الأجهزة   ✦   استبدال خلال 7 أيام   ✦   دعم على واتساب", *tht["mqc"]),
          t_pills, t_use, t_cats, t_cmp, t_featured, t_browse, S(feat4(k, tht, ICONS4, tht["fcard"]), pad=dm([50, 20, 60, 20], [30, 16, 40, 16]), gap={"d": 18}, fxs=tht["bgA"]("c")),
          S(tests(tht, tht["tsfx"]), pad=dm([40, 20, 60, 20], [30, 16, 40, 16]), gap={"d": 20}, fxs=tht["bgB"]("e")),
          offer(k, tht, tht["offfx"], "#ffffff", "#e2e8f0"), faq(tht, tht["bgA"]("q"), tht["accfx"]), foot(**tht["foot"])]
_pilot_reg("s-tech", "store", "إلكترونيات", "متجر تقني بسيط",
           "تسوّق موجَّه بالاستعمال: هيرو مقسوم بصورة المنتج ورسالة واضحة، بطاقات «حسب استعمالك» بصور كاملة، بطاقات مقارنة بمؤشرات، صفّ الأكثر طلباً ثم تصفّح بتبويب الفئات.",
           t_secs, {"ff": "'Noto Kufi Arabic',sans-serif", "bg": "#ffffff", "header": False, "footer": False})
_pilot_demo("s-tech", {"a": [0, 1, 2, 3], "b": [4, 5, 6, 7]})
_pilot_end()
