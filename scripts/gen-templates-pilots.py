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
PACKS["s-watches"] = dict(PACKS["s-watches"], dp=[
    _P("ساعة رياضية مقاومة للماء", 12800, 0, "watch_wrist"), _P("ساعة بيضاء أنيقة", 14200, 0, "watch_white"), _P("ساعة ذكية هجينة", 26000, 0, "gad_watch")])

def callout(i, y, title, text, mx, my, mw):
    """مواصفة حول الساعة: عنوان + شرح + خط وصل ونقطة (الخط والنقطة يختفيان على الجوال). mx,my,mw = موضع الجوال"""
    return [
        FR("heading", V(1.5, mx), V(y, my), V(21, mw), None, 6, text=title, tag="h3", fs=V(22, 18), fw="900", ta={"d": "end", "m": "start"}, color=GOLD2, lh={"d": 1.25}, fxs=[goldshimmer(k + "c%d" % i, 6)], **anim("fadeUp", .7, .35 + i * .12)),
        FR("text", V(1.5, mx), V(y + 34, my + 30), V(21, mw), None, 6, html="<p>%s</p>" % text, fs=V(15, 14), lh={"d": 1.7}, ta={"d": "end", "m": "start"}, color=MUTE, fw="500", **anim("fadeUp", .7, .45 + i * .12)),
        FR("shape", 23, y + 14, 9.5, 2, 4, shape="rect", fill=GOLD, keep=False, hm=True, **anim("fadeIn", .8, .6 + i * .12)),
        FR("shape", 32.6, y + 9, 1, 12, 4, shape="ellipse", fill=GOLD2, keep=False, hm=True, fxs=[pulse(k + "d%d" % i, "245,215,122", 2.6)]),
    ]
hero_free = [
    FR("heading", 0, V(40, 280), 100, None, 1, text="CHRONOS", tag="p", fs=V(230, 104), fw="900", ta={"d": "center"}, color=GOLD, op=.07, lh={"d": 1}, hm=True, **anim("fadeIn", 1.4)),
    FR("shape", 27, 110, 46, 440, 2, shape="ellipse", fill=GOLD, keep=False, op=.2, hm=True, fxs=[FX("هالة ضوء ذهبية", "selector{filter:blur(70px)}")]),
    FR("image", V(29, 6, 27), V(96, 336, 100), V(42, 88, 46), V(488, 362, 400), 3, src=IMG("men_watch"), alt="ساعة كرونوغراف بسوار جلدي على خلفية سوداء", fit="cover", hauto=False, crop={"x": 0, "y": -66.7, "w": 117.6, "h": 166.7},
       fxs=[FX("حواف تذوب في الخلفية", "selector{-webkit-mask-image:radial-gradient(closest-side,#000 62%,transparent 100%);mask-image:radial-gradient(closest-side,#000 62%,transparent 100%)}"),
            FX("طفو هادئ", "selector{animation:nwFl 7s ease-in-out infinite}@keyframes nwFl{50%{transform:translateY(-10px)}}")], **anim("zoomIn", 1.1, .1)),
    FT("— SWISS INSPIRED —", V(68, 6), V(116, 28), V(30, 88), V(15, 14), GOLD, "start", 6, "800", **anim("fadeDown", .7)),
    FR("heading", V(66, 6), V(150, 52), V(32, 88), None, 6, text="الوقت يليق بمن يقدّره", tag="h1", fs=V(54, 40, 44), fw="900", ta={"d": "start"}, color=GOLD2, lh={"d": 1.2}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .9)),
    FT("ساعة بحركة دقيقة ومواد متينة، صُمّمت لترافقك سنوات. ضمان دولي وتغليف هدايا فاخر.", V(66, 6), V(330, 150), V(32, 88), V(17, 15), MUTE, "start", 6, "500", **anim("fadeUp", .9, .1)),
    FR("button", V(66, 6), V(442, 262), V(21, 88), V(56, 54), 6, text="اكتشف المجموعة", kind="link", link="#products", bgc="#b8860b", color="#1a1409", hbg="#b8860b", fs=V(18, 16), fw="800", brad={"d": 6},
       fxs=[btngrad("#b8860b", GOLD2, "rgba(201,153,46,.55)", -3), shine(k, 3)], **anim("zoomIn", .9, .2)),
    FR("tbadges", V(66, 6), V(530, 930), V(32, 88), None, 6, items="ضمان سنتان\nزجاج سافير\nمقاومة 100م", cbg="#00000050", cc=GOLD2, cbc=GOLD, crad=dm(6), cfs=dm(13), gap=dm(8), jc="flex-start", **anim("fadeUp", .9, .3)),
]
hero_free += callout(0, 130, "زجاج سافير", "مضاد للخدش وللانعكاس", 52, 726, 44) + callout(1, 290, "حركة أوتوماتيكية", "احتياطي طاقة 72 ساعة", 4, 726, 44) + callout(2, 450, "مقاومة الماء 100م", "فولاذ 316L وتاج مبرغى", 4, 836, 92)
hero_free = hero_free[1:] + hero_free[:1]      # كلمة الخلفية الكبيرة (zi=1) آخر القائمة: الترتيب البصري بـzi لا بالموضع، وأول عنوان في القائمة هو عنوان الهيرو الظاهر
w_hero = canvas(hero_free, dm(690, 980, 700), BLKW("h") + [spotlight(k, "rgba(201,153,46,.16)")])

def chapter(num, kick, title, text, items, img, alt, img_first, tilt=0):
    txt = C([
        W("heading", text=num, tag="p", fs=dm(120, 80), fw="900", ta={"d": "start"}, color="transparent", lh={"d": 1}, fxs=[outlinetext(GOLD, 2)], **anim("fadeIn", 1)),
        T("— %s —" % kick, 14, GOLD, "start", fw="800", **anim("fadeDown")),
        W("heading", text=title, tag="h2", fs=dm(44, 30), fw="900", ta={"d": "start"}, color=GOLD2, lh={"d": 1.25}, fxs=[goldshimmer(k + "t" + num, 6)], **anim("fadeUp")),
        T(text, 18, MUTE, "start", **anim("fadeUp", .7, .1)),
        bullets(items, "check-circle", GOLD, TXT, 17, **anim("fadeUp", .7, .2))], w=46, va="center", pad=dm([0, 0, 0, 0], [20, 0, 0, 0]))
    pic = C([PIC(img, alt, 4, fxs=[FX("إطار ذهبي مزاح", "selector{position:relative}selector::before{content:\"\";position:absolute;inset:18px -18px -18px 18px;border:1px solid #c9992e;border-radius:4px;z-index:0;pointer-events:none}selector .pb-im{position:relative;z-index:1}"), zoomcol("rgba(201,153,46,.3)")], **anim("zoomIn", .9))],
            w=50, va="center", pad=dm([0, 0, 0, 0]))
    cols = [pic, txt] if img_first else [txt, pic]
    return S(cols, pad=dm([90, 20, 90, 20], [50, 16, 56, 16]), gap={"d": 64, "m": 28}, fxs=BLKW(num))
w_c1 = chapter("01", "الحرفة", "تصنيع بدقة لا تقبل التقريب", "كل قطعة تُجمَّع وتُفحص يدوياً قبل أن تصل إليك: الحركة والزجاج والعلبة والسوار، لتبقى دقيقة سنوات طويلة.",
               "حركة أوتوماتيكية مضبوطة\nزجاج سافير مضاد للخدش\nعلبة فولاذ 316L", "watch_hand", "ساعة بقرص أبيض بيد تحملها", False)
w_c2 = chapter("02", "الإرث", "إرث يتوارثه الأجيال", "الساعة الجيدة لا تنتهي بانتهاء الموضة. نختار تصاميم كلاسيكية تبقى أنيقة، ونقدّم خدمة ضبط وصيانة بعد البيع.",
               "تصاميم كلاسيكية خالدة\nضبط السوار مجاناً\nخدمة ما بعد البيع", "watch_pocket", "ساعة جيب عتيقة معلّقة بسلسلة", True)
w_stats = S([C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(52, 34), color=GOLD2, lc=MUTE, fxs=[goldshimmer(k + "n" + str(i), 6)], **anim("zoomIn", .7, .1 + i * .1))], w=dm(25, 50), pad=dm([0, 0, 0, 0]),
              fxs=[FX("فاصل ذهبي", "@media(min-width:768px){selector{border-inline-start:1px solid #c9992e55}}")] if i else [])
             for i, (n, p, s, l) in enumerate([(21, "", "", "حجراً كريماً"), (100, "", "م", "مقاومة الماء"), (72, "", "h", "احتياطي الطاقة"), (2, "", " سنة", "ضمان دولي")])],
            pad=dm([40, 20, 50, 20], [30, 16, 36, 16]), gap={"d": 16}, fxs=BLKW("m"))
w_banner = S([C([T("— 03 —", 14, GOLD, "center", fw="800"),
                 W("heading", text="ليس مجرّد ساعة، بل رفيق رحلة", tag="h2", fs=dm(48, 30), fw="900", ta={"d": "center"}, color=GOLD2, fxs=[goldshimmer(k + "bn", 6)], **anim("fadeUp")),
                 BTN("شاهد المجموعة", bg="#b8860b", color="#1a1409", link="#products", fxs=[btngrad("#b8860b", GOLD2, "rgba(201,153,46,.55)", -3), shine(k, 3)], **anim("zoomIn", .9, .2))], w=100)],
           cw={"d": 860}, pad=dm([170, 20, 170, 20], [100, 16, 100, 16]), **PH("watch_rock", "rgba(10,10,10,.5)", "rgba(10,10,10,.82)"))
w_prod = S([C([W("anchor", aid="products", aoff=dm(80)), *title("المجموعة", "قطع مختارة بعناية — مرّر لتكتشف المزيد", k, thw, thw["hfx"]("p"))["widgets"],
               W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, slider=True, slauto=5, cardw=dm(330, 240), gap=dm(22), rad=dm(6), cbg="#14100a", bbg="#b8860b", pdemo="a", fxs=thw["prods"]["fxs"])], w=100)],
           pad=dm([70, 20, 80, 20], [44, 16, 52, 16]), fxs=BLKW("p"))
w_serv = S([C([IB(ic, t, x, tc=GOLD2, xc=TXT, isz=38, fxs=[glass("rgba(10,10,10,.55)", "rgba(201,153,46,.35)", 14, 8), lift(".pb-ib", "rgba(201,153,46,.25)", -8), floaty(k + "sv" + str(i), ".pb-ibi", 5, 5 + i * .4)], **anim("fadeUp", .7, .1 + i * .12))], w=33, pad=dm([0, 0, 0, 0]))
            for i, (ic, t, x) in enumerate([("gift", "تغليف هدايا فاخر", "علبة مخملية مع بطاقة إهداء"), ("shield-check", "ضمان دولي سنتان", "على الحركة، مع شهادة ضمان"), ("target", "ضبط السوار مجاناً", "نضبطه على معصمك قبل الشحن")])],
           pad=dm([110, 20, 110, 20], [60, 16, 60, 16]), gap={"d": 22}, **PH("men_suit", "rgba(10,10,10,.6)", "rgba(10,10,10,.85)"))
w_secs = [bar(*thw["bar"]), hdr(**thw["hdr"]), w_hero, mq("AUTOMATIC   ✦   SAPPHIRE   ✦   316L STEEL   ✦   WATER RESISTANT   ✦   SWISS MADE   ✦   LIMITED EDITION", *thw["mqc"]),
          w_c1, w_c2, w_stats, w_banner, w_prod, w_serv, S(tests(thw, thw["tsfx"]), pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=BLKW("e")),
          offer(k, thw, thw["offfx"], thw["offc"], thw["offm"]), faq(thw, BLKW("f"), thw["accfx"]), foot(**thw["foot"])]
_pilot_reg("s-watches", "store", "ساعات", "متجر ساعات — كرونوس",
           "تحرير مجلاتي: ساعة بطلة بمواصفات موزعة حولها كعناصر حرة، فصول سرد بصري متناوبة بين الصورة والنص، سلايدر منتجات عريض وشريط خدمة بصورة كاملة.",
           w_secs, {"ff": "'El Messiri',sans-serif", "bg": "#0a0a0a", "header": False, "footer": False})
_pilot_demo("s-watches", {"a": [0, 1, 2]})
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
PACKS["s-tech"] = dict(PACKS["s-tech"], dp=[
    _P("حاسوب مكتبي كامل", 98000, 105000, "it_pc", "حواسيب"), _P("لابتوب للعمل 15.6 بوصة", 84000, 90000, "it_laptop", "حواسيب"),
    _P("لوحة أم ومعالج", 42000, 46000, "it_circuit", "حواسيب"), _P("لوحة مفاتيح للمبرمجين", 6900, 0, "it_code", "ملحقات"),
    _P("سماعة أذن لاسلكية", 5200, 6400, "gad_earbuds", "صوتيات"), _P("مكبر صوت مكتبي", 4700, 0, "gad_speaker", "صوتيات"),
    _P("نظارة واقع افتراضي", 52000, 58000, "gad_vr", "أجهزة ذكية"), _P("ساعة ذكية", 18500, 0, "gad_watch", "أجهزة ذكية")])

t_hero = S([
    C([T("✦ تقنية بضمان ودعم محلي", 14, BLUE, "start", fw="800", **anim("fadeDown")),
       W("heading", text="اختر جهازك حسب ما تفعله به، لا حسب اسمه", tag="h1", fs=dm(52, 32), fw="900", ta={"d": "start"}, color=DARK, lh={"d": 1.2}, fxs=[gradtext(k, BLUE, "#7c3aed", "#0ea5e9", 6)], **anim("fadeUp", .8)),
       T("أجهزة وإكسسوارات أصلية بضمان، توصيل سريع ودفع عند الاستلام، ودعم فني على واتساب.", 19, SLATE, "start", **anim("fadeUp", .8, .1)),
       BTN("تصفّح المنتجات", bg=BLUE, al="start", link="#products", fxs=[btngrad(BLUE, "#7c3aed", "rgba(37,99,235,.45)"), shine(k), pulse(k, "37,99,235", 2.4)], **anim("zoomIn", .8, .2)),
       BTN("اختر حسب الاستعمال", bg="#e0e7ff", color="#1d4ed8", al="start", link="#use", fxs=[lift(".pb-btn", "rgba(37,99,235,.3)", -3, 0)], **anim("zoomIn", .8, .3)),
       W("tbadges", items="ضمان سنة\nدفع عند الاستلام\nدعم على واتساب", cbg="#ffffff", cc=DARK, cbc="#e2e8f0", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .4))], w=50, va="center"),
    C([PIC("it_color", "حاسوب محمول بإضاءة ملوّنة على لوحة المفاتيح", 28, fxs=[FX("طفو الصورة", "selector img{animation:stPf 6s ease-in-out infinite}@keyframes stPf{50%{transform:translateY(-12px)}}"), FX("ظل ناعم", "selector{filter:drop-shadow(0 40px 60px rgba(37,99,235,.3))}")], **anim("fadeUp", .9, .3))],
      w=50, va="center", pad=dm([26, 26, 26, 26], [14, 14, 14, 14]), fxs=[FX("لوحة تدرّج", "selector{background:linear-gradient(145deg,#e0e7ff,#f5f3ff);border-radius:36px}")]),
], pad=dm([90, 20, 80, 20], [50, 16, 50, 16]), gap={"d": 44, "m": 26}, fxs=[gridbg(k, "rgba(37,99,235,.08)", 46), spotlight(k, "rgba(37,99,235,.18)")])

def usecard(img, alt, kick, title, desc, link):
    return C([W("spacer", mh=dm(200, 130)), T(kick, 13, "#bfdbfe", "start", fw="800"),
              W("heading", text=title, tag="h3", fs=dm(30, 26), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.2}),
              T(desc, 16, "#e2e8f0", "start"),
              BTN("اعرض الخيارات", bg="#ffffff", color=DARK, al="start", link=link, fxs=[lift(".pb-btn", "rgba(255,255,255,.35)", -3, 0)])],
             w=33, pad=dm([30, 28, 30, 28], [24, 20, 24, 20]), fxs=[FX("زوايا مدوّرة", "selector{border-radius:26px;overflow:hidden}"), zoomcol("rgba(37,99,235,.35)")],
             **PH(img, "rgba(15,23,42,.05)", "rgba(15,23,42,.9)"))
t_use = S([C([W("anchor", aid="use", aoff=dm(80)), *title("تسوّق حسب استعمالك", "قل لنا ماذا ستفعل بالجهاز، ونرشّح لك الأنسب", k, tht, tht["hfx"]("u"))["widgets"]], w=100),
           usecard("gad_vr2", "رجل بنظارة واقع افتراضي", "ألعاب وترفيه", "للّعب والترفيه", "أداء رسومي وتجربة غامرة بلا تقطيع.", "#products"),
           usecard("dig_code", "حاسوب محمول على مكتب عمل", "عمل ودراسة", "للعمل والدراسة", "خفة وبطارية تدوم ولوحة مفاتيح مريحة.", "#products"),
           usecard("it_dark", "حاسوب محمول مضيء في العتمة", "إبداع وتصميم", "للإبداع والتصميم", "شاشة دقيقة الألوان وقوة معالجة للمشاريع الثقيلة.", "#products")],
          pad=dm([70, 20, 70, 20], [44, 16, 44, 16]), gap={"d": 22}, fxs=tht["bgB"]("u"))

def tier(name, tag, bars, desc, best=False):
    ws = [T(tag, 13, BLUE if best else SLATE, "center", fw="800"), W("heading", text=name, tag="h3", fs=dm(28, 24), fw="900", ta={"d": "center"}, color=DARK)]
    ws += [W("progress", pl=l, pv=v, pc=BLUE if best else "#94a3b8", pbg="#e2e8f0", ph=dm(10), color=DARK) for l, v in bars]
    ws += [T(desc, 15, SLATE, "center"), BTN("اعرض الخيارات", bg=BLUE if best else DARK, al="center", link="#products", fxs=[lift(".pb-btn", "rgba(37,99,235,.3)", -3, 0)])]
    fx = ([FX("بطاقة الأنسب", "@media(min-width:768px){selector{transform:translateY(-14px)}}selector{border:2px solid #2563eb;box-shadow:0 30px 70px rgba(37,99,235,.22)}"), ribbon("الأنسب", BLUE, "#ffffff")]
          if best else [softcard("#ffffff", "rgba(15,23,42,.08)", 24, 30, "#e2e8f0"), lift(".pb-col", "rgba(15,23,42,.18)", -8, 0)])
    return C(ws, w=33, pad=dm([34, 28, 34, 28], [26, 20, 26, 20]), fxs=[softcard("#ffffff", "rgba(15,23,42,.08)", 24, 30, "#e2e8f0")] + fx if best else fx)
t_cmp = S([C([*title("قارن بنظرة واحدة", "ثلاث فئات تغطي أغلب الاحتياجات (المؤشرات توضيحية — عدّلها بحسب منتجاتك)", k, tht, tht["hfx"]("m"))["widgets"]], w=100),
           tier("اقتصادي", "للاستعمال اليومي", [("الأداء", 55), ("البطارية", 70), ("السعر", 90)], "يكفي للتصفح والمتابعة والمهام الخفيفة."),
           tier("متوازن", "الأنسب لمعظم الناس", [("الأداء", 78), ("البطارية", 80), ("السعر", 70)], "توازن ممتاز بين السرعة والسعر والعمر.", True),
           tier("احترافي", "للأعمال الثقيلة", [("الأداء", 96), ("البطارية", 65), ("السعر", 45)], "أقصى قوة للتصميم والبرمجة والألعاب.")],
          pad=dm([80, 20, 80, 20], [50, 16, 50, 16]), gap={"d": 24}, fxs=[gridbg(k + "m", "rgba(37,99,235,.05)", 46)])
t_featured = S([C([W("anchor", aid="products", aoff=dm(80)), *title("الأكثر طلباً", "اختيارات زبائننا هذا الأسبوع", k, tht, tht["hfx"]("f"))["widgets"],
                   W("products", mode="all", limit=4, btn="اطلب الآن", showOld=True, cardw=dm(250, 160), cols=dm(4, 2), gap=dm(20), rad=dm(20), cbg="#ffffff", bbg=BLUE, pdemo="a",
                     fxs=[lift(".pb-pc", "rgba(37,99,235,.28)", -10, 2), FX("بطاقة بحد خفيف", "selector .pb-pc{border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,.06)}")])], w=100)],
               pad=dm([70, 20, 40, 20], [44, 16, 24, 16]), fxs=tht["bgB"]("f"))
t_browse = S([C([*title("تصفّح بحسب الفئة", "بدّل بين الفئات لترى كل ما يخصّها", k, tht, tht["hfx"]("b"))["widgets"],
                 W("products", mode="all", limit=8, btn="اطلب الآن", showOld=True, tabs="cats", cardw=dm(250, 160), cols=dm(4, 2), gap=dm(20), rad=dm(20), cbg="#ffffff", bbg=BLUE, pdemo="b",
                   fxs=[lift(".pb-pc", "rgba(37,99,235,.28)", -10, 2), FX("بطاقة بحد خفيف", "selector .pb-pc{border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,.06)}")])], w=100)],
             pad=dm([30, 20, 70, 20], [20, 16, 44, 16]), fxs=tht["bgB"]("b"))
t_secs = [bar(*tht["bar"]), hdr(**tht["hdr"]), t_hero, mq("توصيل لكل الولايات   ✦   الدفع عند الاستلام   ✦   ضمان على الأجهزة   ✦   استبدال خلال 7 أيام   ✦   دعم على واتساب", *tht["mqc"]),
          t_use, t_cmp, t_featured, t_browse, S(feat4(k, tht, ICONS4, tht["fcard"]), pad=dm([50, 20, 60, 20], [30, 16, 40, 16]), gap={"d": 18}, fxs=tht["bgA"]("c")),
          S(tests(tht, tht["tsfx"]), pad=dm([40, 20, 60, 20], [30, 16, 40, 16]), gap={"d": 20}, fxs=tht["bgB"]("e")),
          offer(k, tht, tht["offfx"], "#ffffff", "#e2e8f0"), faq(tht, tht["bgA"]("q"), tht["accfx"]), foot(**tht["foot"])]
_pilot_reg("s-tech", "store", "إلكترونيات", "متجر تقني بسيط",
           "تسوّق موجَّه بالاستعمال: هيرو مقسوم بصورة المنتج ورسالة واضحة، بطاقات «حسب استعمالك» بصور كاملة، بطاقات مقارنة بمؤشرات، صفّ الأكثر طلباً ثم تصفّح بتبويب الفئات.",
           t_secs, {"ff": "'Noto Kufi Arabic',sans-serif", "bg": "#ffffff", "header": False, "footer": False})
_pilot_demo("s-tech", {"a": [0, 1, 4, 6], "b": [2, 3, 5, 7]})
_pilot_end()
