# ═════════ NEXUS COMMERCE — القالب الافتراضي الجديد (5 مجالات) + صفحات الموقع ═════════
# يُنفَّذ بعد الدفعات من gen-templates.py وبمولّد عشوائي معزول لكل قالب (لا يتغيّر ناتج أي قالب آخر).
# بنية واحدة بهوية «شبكة غير متماثلة تحريرية»: هيرو بكولاج عناصر حرة، فسيفساء فئات (من فئات المتجر الحقيقية)،
# عرض منتجات بتبويبات التجميعات الحقيقية (الأكثر مبيعاً/الأكثر طلباً/التخفيضات/الجديدة)، مساحات تحريرية بعناصر متراكبة.
# كله بمكوّنات المطوّر الأصلية (لا HTML مخصص): عناوين/نصوص/صور/أزرار/أشكال/منتجات/فئات/نموذج اتصال/أسئلة…
_NX = {}
def _nx_begin(id):
    global R
    _NX["R"] = R; R = random.Random("nexus:" + id)
def _nx_end():
    global R
    R = _NX.pop("R")

def _nx_cvs(free, mh, fxs=None, cw=1180, **o):
    sec = S([C([])], kind="canvas", layout="boxed", cw={"d": cw}, mh=mh, pad=dm([0, 0, 0, 0]), fxs=fxs or [], **o)
    sec["free"] = free; return sec

# ───────── تأثيرات خاصة بالقالب ─────────
def _nx_bg(P, k, tone="paper"):
    c = {"paper": P["paper"], "card": P["card"], "ink": P["ink"], "soft": P["soft"], "acc": P["acc"]}[tone]
    return FX("خلفية القسم", "selector{background:[[c]]}", c=("اللون", "text", c))
def _nx_card(P, hover=True):
    """بطاقة منتج بتصميم NEXUS: إطار رفيع بزاوية مختلفة (أعلى-يمين أكبر)، سعر بارز، رفع عند المرور"""
    r = P["rad"]
    return FX("بطاقة المنتج", "selector .pb-pc{background:[[bg]]!important;border:1px solid [[bd]];border-radius:[[r]]px [[r2]]px [[r]]px [[r]]px!important;overflow:hidden;box-shadow:none;transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,border-color .3s}"
              "selector .pb-pc:hover{transform:translateY(-8px);border-color:[[a]];box-shadow:0 24px 50px [[sh]]}"
              "selector .pb-pci img{transition:transform .8s cubic-bezier(.2,.8,.2,1)}selector .pb-pc:hover .pb-pci img{transform:scale(1.06)}"
              "selector .pb-pcb{border-radius:[[r]]px!important;font-weight:800;letter-spacing:.2px;background:[[btn]]!important;color:[[onbtn]]!important}selector .pb-pcp b{color:[[ink]]}selector .pb-pc h3{color:[[ink]]}selector .pb-pcp s{color:[[mut]]}",
              bg=("خلفية البطاقة", "text", P["card"]), bd=("لون الإطار", "text", P["ink"] + "1f"), a=("لون التمييز", "text", P["acc"]),
              r=("تدوير الزوايا px", "num", r), r2=("تدوير الزاوية العليا اليمنى px", "num", r * 2), sh=("ظل المرور", "text", P["ink"] + "26"), ink=("لون الاسم والسعر", "text", P["ink"]), btn=("لون زر الطلب", "text", P["btn"]), onbtn=("لون نص الزر", "text", P["onbtn"]), mut=("لون السعر القديم", "text", P["mut"]))
def _nx_stagger(P):
    """شبكة منتجات متدرّجة غير متماثلة: الأعمدة الزوجية مُزاحة للأسفل (لا صفوف متراصّة متطابقة)، وتتكيّف مع أي عدد منتجات"""
    return FX("شبكة متدرّجة", "selector .pb-pgrid{align-items:start;padding-bottom:[[o]]px}@media(min-width:768px){selector .pb-pgrid .pb-pc:nth-child(even){margin-top:[[o]]px}}@media(max-width:767px){selector .pb-pgrid .pb-pc:nth-child(even){margin-top:[[om]]px}}",
              o=("إزاحة الأعمدة الزوجية px", "num", 46), om=("الإزاحة على الجوال px", "num", 22))
def _nx_balance():
    return FX("توازن أسطر العنوان", "selector .pb-t{text-wrap:balance}")
def _nx_cardratio(r="4/5"):
    return cardratio(r)
def _nx_underline(P, k):
    """عنوان بخط تمييز سفلي بلون القالب"""
    return FX("خط تمييز تحت العنوان", "selector .pb-t{display:inline;background:linear-gradient(transparent 68%,[[c]] 68%);background-repeat:no-repeat;background-size:100% 100%;padding-inline:.12em}", c=("لون الخط", "text", P["soft"]))
def _nx_hover_zoom():
    return FX("تكبير الصورة بالمرور", "selector .pb-im{transition:transform 1s cubic-bezier(.2,.8,.2,1)}selector:hover .pb-im{transform:scale(1.06)}")
def _nx_imgframe(P, rad, ratio=None, pos="50% 50%", ring=True):
    extra = "box-shadow:0 0 0 8px [[ring]],0 30px 60px rgba(0,0,0,.18);" if ring else "box-shadow:0 30px 60px rgba(0,0,0,.14);"
    return FX("إطار الصورة", "selector{overflow:hidden;border-radius:[[r]]px;" + extra + "}selector .pb-im{width:100%;height:100%;object-fit:cover;object-position:[[p]]}",
              r=("تدوير الزوايا px", "num", rad), p=("نقطة التركيز", "text", pos), ring=("لون الحلقة", "text", P["card"]))
def _nx_bento(P):
    """فسيفساء فئات غير متماثلة من فئات المتجر الحقيقية: تتكيّف مع 1–6+ فئات (لا فراغات)"""
    css = ["selector .pb-sc{display:grid!important;grid-template-columns:repeat(12,1fr)!important;grid-auto-rows:[[h]]px;grid-auto-flow:dense;gap:[[g]]px!important}",
           "selector .pb-sci{aspect-ratio:auto!important;border-radius:[[r]]px!important;min-height:0}",
           "selector .pb-sci:nth-child(n){grid-column:span 4;grid-row:span 1}",
           "selector .pb-sci:nth-child(1){grid-column:span 5;grid-row:span 3}selector .pb-sci:nth-child(2){grid-column:span 4;grid-row:span 2}selector .pb-sci:nth-child(3){grid-column:span 3;grid-row:span 2}",
           "selector .pb-sci:nth-child(4){grid-column:span 3}selector .pb-sci:nth-child(5){grid-column:span 4}",
           # عدد الفئات الإجمالي (أقل من 5): ملء كامل بلا فراغات
           "selector .pb-sci:first-child:nth-last-child(4){grid-row:span 3}selector .pb-sci:nth-child(4):last-child{grid-column:span 7}",
           "selector .pb-sci:first-child:nth-last-child(3){grid-column:span 6;grid-row:span 2}selector .pb-sci:nth-child(2):nth-last-child(2){grid-column:span 6;grid-row:span 1}selector .pb-sci:nth-child(3):last-child{grid-column:span 6;grid-row:span 1}",
           "selector .pb-sci:first-child:nth-last-child(2){grid-column:span 6;grid-row:span 2}selector .pb-sci:nth-child(2):last-child{grid-column:span 6;grid-row:span 2}",
           "selector .pb-sci:first-child:last-child{grid-column:span 12;grid-row:span 2}",
           "selector .pb-sci img,selector .pb-sci{transition:transform .8s cubic-bezier(.2,.8,.2,1),filter .5s}selector .pb-sci:hover{transform:scale(.985)}selector .pb-sci:hover span{transform:translateY(-4px)}",
           "selector .pb-sci span{transition:transform .4s;text-shadow:0 2px 14px rgba(0,0,0,.45)}",
           "@media(max-width:767px){selector .pb-sc{grid-template-columns:repeat(2,1fr)!important;grid-auto-rows:[[hm]]px}selector .pb-sci:nth-child(n){grid-column:span 1;grid-row:span 1}selector .pb-sci:first-child{grid-column:span 2;grid-row:span 2}selector .pb-sci:nth-child(4){grid-column:span 2}}"]
    return FX("فسيفساء الفئات غير المتماثلة", "".join(css), h=("ارتفاع الصف px", "num", 150), hm=("ارتفاع الصف على الجوال px", "num", 120), g=("التباعد px", "num", 14), r=("تدوير الزوايا px", "num", P["rad"]))

def nx_bar(P, N):
    b = bar("توصيل لكل الولايات  ·  الدفع عند الاستلام  ·  دعم على واتساب", P["fbg"], P["fon"], P["acc"])
    b["set"]["mh"] = dm(58, 76, 64); b["free"][0]["set"]["fh"] = dm(58, 76, 64)      # شريط أعلى قليلاً: يسهل تحديده وسحبه في المحرّر على أي تكبير
    return b
def nx_hdr(P, N):
    h = hdr(hbg=P["paper"], hbr=P["ink"] + "22", lc=P["ink"], lac=P["acc"], mc=P["ink"], cbg=P["btn"], la=N["brand"], lfs=dm(26))
    return h
def nx_foot(P, N):
    f = foot(sbg=P["fbg"], tc="#b9b4a8", hc="#ffffff", lc="#b9b4a8", lh=P["acc"])
    st = f["cols"][0]["widgets"][0]["set"]; c = st["cols"]
    c[0] = {"h": N["brand"], "b": "%s: متجر إلكتروني بتوصيل لكل الولايات والدفع عند الاستلام." % N["brand"]}      # لا رقم ولا اسم حقيقي: يأتي من إعدادات المتجر
    if len(c) >= 2: c[1] = {"h": "روابط سريعة", "b": "[الرئيسية](index.html)\n[المتجر](shop.html)\n[السلة](cart.html)\n[حسابي](account.html)"}      # روابط نسبية لجذر المتجر: يحلّها sfoot بـ ctx.base ("" في الرئيسية، "../../" في /lp/ والمنتج) فتصلح في أي مجلد تثبيت
    if len(c) >= 3: c[2] = {"h": "تواصل معنا", "b": "📱 واتساب: أضف رقم متجرك من الإعدادات\n🕐 السبت – الخميس: 9ص – 8م\n📍 الجزائر — التوصيل لكل الولايات"}
    st["copy"] = "© 2026 %s — جميع الحقوق محفوظة" % N["brand"]
    return f

# ───────── الهيرو: كولاج عناصر حرة ─────────
def _nx_hero_text(P, N, k, x, w, mob_y0=36):
    """كتلة نص الهيرو (مشتركة بين كل الأنماط): شارة، عنوان، وصف، زرّان، شارات ثقة"""
    ink, acc, soft = P["ink"], P["acc"], P["soft"]
    return [
        FT("— %s —" % N["kick"], V(x, 6), V(96, mob_y0), V(w, 88), V(15, 13), acc, "start", 6, "800", **anim("fadeDown", .7)),
        FR("heading", V(x - 2, 6), V(132, mob_y0 + 42), V(w + 3, 88), None, 6, text=N["h1"], tag="h1", fs=V(62, 40, 54), fw="800", ta={"d": "start"}, color=ink, lh={"d": 1.15}, ff=N["hf"], fxs=[_nx_balance()], **anim("fadeUp", .9)),
        FT(N["sub"], V(x, 6), V(360, mob_y0 + 214), V(w - 4, 88), V(18, 15), P["mut"], "start", 6, "500", **anim("fadeUp", .9, .1)),
        FR("button", V(x, 6), V(468, mob_y0 + 310), V(20, 88), V(58, 54), 6, text="تسوّق الآن", kind="link", link="#featured", bgc=P["btn"], color=P["onbtn"], hbg=acc, fs=V(18, 16), fw="800", brad={"d": 999},
           fxs=[FX("زر بسهم", "selector .pb-btn{transition:transform .3s,background .3s,box-shadow .3s}selector .pb-btn:hover{transform:translateY(-3px);box-shadow:0 14px 30px [[g]]}", g=("لون التوهج", "text", acc + "66"))], **anim("zoomIn", .9, .2)),
        FR("button", V(x + 21.5, 6), V(468, mob_y0 + 382), V(18.5, 88), V(58, 54), 6, text="الفئات", kind="link", link="#cats", bgc="transparent", color=ink, hbg=soft, fs=V(18, 16), fw="800", brad={"d": 999},
           fxs=[FX("حدّ رفيع", "selector .pb-btn{border:1.5px solid [[c]]}", c=("لون الحدّ", "text", ink))], **anim("zoomIn", .9, .3)),
        FR("tbadges", V(x, 6), V(570, mob_y0 + 456), V(w, 88), None, 6, items="توصيل لكل الولايات\nالدفع عند الاستلام\nاستبدال وفق الشروط", cbg=P["card"], cc=ink, cbc=ink + "22", crad=dm(999), cfs=dm(14), gap=dm(8), jc="flex-start", **anim("fadeUp", .9, .4)),
    ]
def _nx_round(P, ring=None):
    return FX("صورة دائرية بحلقة", "selector{overflow:hidden;border-radius:999px;box-shadow:0 0 0 6px [[c]],0 20px 40px rgba(0,0,0,.18)}selector .pb-im{width:100%;height:100%;object-fit:cover}", c=("لون الحلقة", "text", ring or P["card"]))
def nx_hero(P, N, k):
    A, B, Cc = N["hero"]; aa, ab, ac = N["hero_alt"]; acc, soft, r = P["acc"], P["soft"], P["rad"]; st = N.get("hero_style", "collage")
    text = _nx_hero_text(P, N, k, 54, 44)
    if st == "arch":
        ARCH = "50%% 50%% %dpx %dpx / 36%% 36%% %dpx %dpx" % (r, r, r, r)
        col = [
            FR("shape", 2, 120, 38, 560, 1, shape="ellipse", fill=soft, keep=False, op=.9, hm=True, fxs=[FX("هالة ناعمة", "selector{filter:blur(50px)}")]),
            FR("image", V(6, 6), V(60, 620), V(30, 52), V(600, 470), 3, src=IMG(A), alt=aa, fit="cover", hauto=False, fxs=[FX("قوس وإطار", "selector{overflow:hidden;border-radius:[[r]];box-shadow:0 0 0 8px [[ring]],0 36px 70px rgba(0,0,0,.16)}selector .pb-im{width:100%;height:100%;object-fit:cover;object-position:[[p]]}", r=("التدوير", "text", ARCH), p=("نقطة التركيز", "text", "50% 40%"), ring=("لون الحلقة", "text", P["card"]))], **anim("zoomIn", 1, .1)),
            FR("image", V(30, 44), V(380, 940), V(18, 40), V(220, 160), 4, src=IMG(B), alt=ab, fit="cover", hauto=False, fxs=[_nx_round(P), focus("50% 50%")], **anim("zoomIn", .9, .3)),
            FR("image", V(2.5, 60), V(80, 700), V(14, 32), V(150, 125), 5, src=IMG(Cc), alt=ac, fit="cover", hauto=False, fxs=[_nx_round(P, acc), focus("50% 50%")], **anim("zoomIn", .9, .45)),
            FR("heading", 33, 520, 11, None, 7, text="جديد", tag="p", fs=V(22, 18), fw="900", ta={"d": "center"}, color=P["onacc"], lh={"d": 1.1}, hm=True, fxs=[FX("ملصق", "selector .pb-t{background:[[c]];border-radius:999px;padding:.55em 1.1em;display:inline-block;transform:rotate(-8deg)}", c=("اللون", "text", acc))], **anim("zoomIn", .7, .7)),
        ]
        mh = dm(720, 1260, 700)
    elif st == "wide":
        def tall(img, alt, x, y, w, h, z, d, my, mh_, mx, mw):
            return FR("image", V(x, mx), V(y, my), V(w, mw), V(h, mh_), z, src=IMG(img), alt=alt, fit="cover", hauto=False, fxs=[_nx_imgframe(P, r + 4, ring=False), focus("50% 40%")], **anim("fadeUp", .9, d))
        col = [
            tall(A, aa, 2, 70, 17, 520, 3, .1, 640, 300, 3, 46),
            tall(B, ab, 19.8, 130, 17, 440, 3, .25, 720, 250, 51, 46),
            tall(Cc, ac, 37.6, 90, 14.5, 480, 3, .4, 960, 270, 3, 46),
            FR("shape", 2, 600, 50, 10, 2, shape="rect", fill=acc, keep=False, hm=True),
            FR("heading", 2, 625, 50, None, 4, text="مجموعة الموسم", tag="p", fs=V(14, 13), fw="800", ta={"d": "start"}, color=P["mut"], hm=True),
        ]
        mh = dm(720, 1280, 700)
    elif st == "circle":
        col = [
            FR("shape", 3, 70, 42, 560, 1, shape="ellipse", fill=soft, keep=False, op=.8, hm=True),
            FR("image", V(6, 8), V(80, 640), V(33, 62), V(470, 280), 3, src=IMG(A), alt=aa, fit="cover", hauto=False, fxs=[FX("دائرة كبيرة بحلقة", "selector{overflow:hidden;border-radius:999px;box-shadow:0 0 0 10px [[c]],0 40px 80px rgba(0,0,0,.2)}selector .pb-im{width:100%;height:100%;object-fit:cover}", c=("لون الحلقة", "text", P["card"])), focus("50% 40%")], **anim("zoomIn", 1, .1)),
            FR("image", V(33, 56), V(60, 940), V(15, 34), V(190, 130), 4, src=IMG(B), alt=ab, fit="cover", hauto=False, fxs=[_nx_round(P, acc), focus("50% 50%")], **anim("zoomIn", .9, .3)),
            FR("image", V(30, 4), V(400, 940), V(16, 34), V(200, 130), 5, src=IMG(Cc), alt=ac, fit="cover", hauto=False, fxs=[_nx_round(P), focus("50% 50%")], **anim("zoomIn", .9, .45)),
        ]
        mh = dm(720, 1260, 700)
    else:       # collage (الافتراضي)
        col = [
            FR("shape", 2, 140, 46, 520, 1, shape="ellipse", fill=soft, keep=False, op=.7, hm=True, fxs=[FX("هالة ناعمة", "selector{filter:blur(60px)}")]),
            FR("shape", V(8.5, 12), V(100, 660), V(29, 52), V(540, 430), 2, shape="rect", fill=acc, keep=False, op=.16, rad=dm(r + 8), fxs=[FX("كتلة الإزاحة", "selector{border-radius:[[r]]px}", r=("التدوير px", "num", r + 8))]),
            FR("image", V(4, 5), V(60, 620), V(29, 52), V(540, 430), 3, src=IMG(A), alt=aa, fit="cover", hauto=False, fxs=[_nx_imgframe(P, r + 6, ring=False), focus("50% 40%")], **anim("zoomIn", 1, .1)),
            FR("image", V(24, 42), V(330, 880), V(23, 50), V(290, 290), 4, src=IMG(B), alt=ab, fit="cover", hauto=False, fxs=[_nx_imgframe(P, r), focus("50% 50%")], **anim("fadeUp", .9, .3)),
            FR("image", V(36, 66), V(60, 700), V(13, 34), V(150, 130), 5, src=IMG(Cc), alt=ac, fit="cover", hauto=False, fxs=[_nx_round(P), focus("50% 50%")], **anim("zoomIn", .9, .45)),
            FR("shape", 40, 320, 10.5, 118, 6, shape="ellipse", fill=acc, keep=False, hm=True, fxs=[pulse(k + "b", "255,90,54", 2.8)], **anim("zoomIn", .7, .6)),
            FR("heading", 40.4, 345, 9.7, None, 7, text="جديد\nالآن", tag="p", fs=V(22, 18), fw="900", ta={"d": "center"}, color=P["onacc"], lh={"d": 1.15}, hm=True, **anim("zoomIn", .7, .7)),
        ]
        mh = dm(720, 1230, 700)
    return _nx_cvs(col + text, mh, [_nx_bg(P, k, "paper")], cw=1180)

# ───────── الأقسام ─────────
def nx_title(P, k, kick, text, sub="", ta="start", dark=False):
    c = "#ffffff" if dark else P["ink"]; m = "#d8d2c4" if dark else P["mut"]
    ws = [T("— %s —" % kick, 14, P["acc"], ta, fw="800", **anim("fadeDown")),
          W("heading", text=text, tag="h2", fs=dm(44, 30), fw="800", ta={"d": ta}, color=c, lh={"d": 1.25}, ff=P["hf"], **anim("fadeUp"))]
    if sub: ws.append(T(sub, 17, m, ta, **anim("fadeUp", .7, .1)))
    return ws

def nx_cats(P, N, k):
    im = [IMG(x) for x in N["catimg"]]
    items = [{"cat": "skin", "label": "", "img": im[0], "dl": N["cats"][0]}, {"cat": "hair", "label": "", "img": im[1], "dl": N["cats"][1]}, {"cat": "honey", "label": "", "img": im[2], "dl": N["cats"][2]},
             {"cat": "health", "label": "", "img": im[3], "dl": N["cats"][3]}, {"cat": "roqia", "label": "", "img": im[4], "dl": N["cats"][4]}]
    return S([C([W("anchor", aid="cats", aoff=dm(80)), *nx_title(P, k, "الفئات", "تسوّق بحسب ما تبحث عنه", "فئات متجرك الحقيقية تظهر هنا تلقائياً"),
                 W("spacer", mh=dm(18, 8)),
                 W("shopcats", items=items, cols=dm(6, 2, 3), gap=dm(14), rad=dm(P["rad"]), fs=dm(20, 16), tc="#ffffff", ov=P["ink"], ovo=55, ratio="1/1", fxs=[_nx_bento(P)])], w=100)],
             pad=dm([80, 20, 70, 20], [48, 14, 44, 14]), fxs=[_nx_bg(P, k, "paper")], cw={"d": 1180})

def _nx_prod(P, N, k, mode="tabs", cardw=(260, 160), ratio="4/5", cols=None, limit=8, tag="best", slider=False):
    st = dict(mode="all", tag="", tabs="tags" if mode == "tabs" else "", limit=limit, btn="اطلب الآن", showOld=True,
              cardw=dm(*cardw), gap=dm(20, 12), rad=dm(P["rad"]), cbg=P["card"], bbg=P["btn"], pdemo="a", slider=slider)
    if slider: st["slauto"] = 5
    if cols: st["cols"] = dm(*cols)
    st["fxs"] = [_nx_card(P), _nx_cardratio(ratio)] + ([] if slider or P.get("style") == "tech" else [_nx_stagger(P)]) + [
                 FX("تبويبات التجميعات", "selector .pb-ptabs button,selector .pb-ptab{border-radius:999px;border:1.5px solid [[ink]];background:transparent;color:[[ink]];font-weight:800;padding:.5em 1.2em;transition:.25s}selector .pb-ptabs button.on,selector .pb-ptab.on,selector .pb-ptabs button:hover{background:[[ink]];color:#fff}", ink=("اللون", "text", P["ink"]))]
    return W("products", **st)

def nx_featured(P, N, k):
    return S([C([W("anchor", aid="featured", aoff=dm(80)), *nx_title(P, k, "المتجر", "اختيارات مميزة لك", "بدّل بين الأكثر مبيعاً والأكثر طلباً والتخفيضات والجديد"), W("spacer", mh=dm(14, 6)),
                 _nx_prod(P, N, k, "tabs", (250, 160), "4/5", limit=8)], w=100)],
             pad=dm([30, 20, 80, 20], [20, 14, 50, 14]), fxs=[_nx_bg(P, k, "paper")], cw={"d": 1240})

def nx_slider(P, N, k):
    return S([C([*nx_title(P, k, "وصل حديثاً", "جديد المتجر", "اسحب لاكتشاف المزيد"), W("spacer", mh=dm(14, 6)),
                 _nx_prod(P, N, k, "all", (300, 220), "4/5", limit=10, slider=True)], w=100)],
             pad=dm([70, 20, 80, 20], [44, 14, 50, 14]), fxs=[_nx_bg(P, k, "soft")], cw={"d": 1240})

def nx_editorial(P, N, k):
    """مساحة تحريرية: صورتان متراكبتان بأحجام مختلفة + عنوان كبير + نقاط + زر (عناصر حرة)"""
    ink, acc = P["ink"], P["acc"]; a, b = N["ed"]; aa, ab = N["ed_alt"]
    bul = N["ed_b"]
    free = [
        FR("image", V(4, 4), V(40, 24), V(40, 92), V(520, 340), 2, src=IMG(a), alt=aa, fit="cover", hauto=False, fxs=[_nx_imgframe(P, P["rad"] + 10, ring=False), focus("50% 50%")], **anim("fadeUp", .9)),
        FR("image", V(30, 40), V(300, 330), V(22, 52), V(300, 260), 3, src=IMG(b), alt=ab, fit="cover", hauto=False, fxs=[_nx_imgframe(P, P["rad"]), focus("50% 50%")], **anim("zoomIn", .9, .2)),
        FT("— %s —" % N["ed_k"], V(54, 6), V(60, 410), V(42, 88), V(14, 13), acc, "start", 5, "800"),
        FH(N["ed_h"], V(54, 6), V(94, 440), V(42, 88), V(48, 32), ink, "start", 5, "900", ff=N["hf"], **anim("fadeUp", .8)),
        FT(N["ed_p"], V(54, 6), V(250, 590), V(40, 88), V(17, 15), P["mut"], "start", 5, "500", **anim("fadeUp", .8, .1)),
        FR("bullets", V(54, 6), V(396, 760), V(40, 88), None, 5, items="\n".join(bul), micon="ic:check", mc=acc, ms=dm(24), gap=dm(12), fs=dm(17, 15), color=ink, manim="pop", **anim("fadeUp", .8, .2)),
        FR("button", V(56, 6), V(500, 890), V(20, 60), V(56, 52), 5, text="اعرف أكثر", kind="link", link="#featured", bgc=P["btn"], color=P["onbtn"], hbg=acc, fs=V(17, 15), fw="800", brad={"d": 999}, **anim("zoomIn", .8, .3)),
    ]
    return _nx_cvs(free, dm(640, 960, 640), [_nx_bg(P, k, "paper")], cw=1180)

def nx_values(P, N, k):
    ic = [("truck", 0), ("cash", 1), ("shield-check", 2), ("headset", 3)]
    cols = []
    for i, (icon, j) in enumerate(ic):
        t, x = N["trust"][j]
        cols.append(C([IB(icon, t, x, tc=P["ink"], xc=P["mut"], isz=36, icc=P["acc"], al={"d": "start"}, **anim("fadeUp", .7, .08 + i * .1),
                          fxs=[FX("بطاقة ميزة", "selector .pb-ib{background:[[bg]];border:1px solid [[bd]];border-radius:[[r]]px;padding:26px 22px;text-align:start;transition:transform .4s,box-shadow .4s}selector .pb-ib:hover{transform:translateY(-6px);box-shadow:0 18px 40px [[sh]]}",
                                  bg=("الخلفية", "text", P["card"]), bd=("الإطار", "text", P["ink"] + "1a"), r=("التدوير px", "num", P["rad"]), sh=("الظل", "text", P["ink"] + "1f"))])], w=25))
    return S(cols, pad=dm([50, 20, 70, 20], [30, 14, 44, 14]), gap={"d": 18, "m": 12}, fxs=[_nx_bg(P, k, "paper")], cw={"d": 1180})

def nx_promo(P, N, k):
    ink, acc = P["ink"], P["acc"]
    return S([C([T("— عرض —", 14, "#ffffff", "start", fw="800"),
                 W("heading", text=N["promo_h"], tag="h2", fs=dm(54, 32), fw="900", ta={"d": "start"}, color=P["fon"], lh={"d": 1.2}, ff=N["hf"], **anim("fadeUp")),
                 T(N["promo_p"], 18, P["fon"] + "e0", "start", **anim("fadeUp", .7, .1)),
                 W("countdown", mode="date", on=False, end="", cbg="#ffffff22", color="#ffffff", fs=dm(38, 26), crad=dm(14), al={"d": "start"}, **anim("zoomIn", .7, .2)),
                 W("coupon", on=False, cpcode="YOURCODE", cpt="كود خصم", cpbtn="نسخ الكود", cpbg="#ffffff1c", cpbc="#ffffff", cpc="#ffffff", cpb=acc, **anim("fadeUp", .7, .3)),
                 BTN("تسوّق العرض", bg=P["fon"], color=P["fbg"], al="start", link="#featured", brad={"d": 999}, fxs=[lift(".pb-btn", "rgba(0,0,0,.35)", -3, 0)], **anim("zoomIn", .8, .3))],
                w=60, pad=dm([20, 10, 20, 10]))],
             cw={"d": 1100}, pad=dm([110, 40, 110, 40], [60, 20, 60, 20]), mar=dm([10, 20, 10, 20], [8, 10, 8, 10]), rad=dm(P["rad"] + 14),
             fxs=[FX("طبقة الصورة", "selector{overflow:hidden}")], **PH(N["promo_img"], P["fbg"] + "99", P["fbg"] + "e6", 100, "center"))

def nx_tests(P, N, k):
    th = dict(h=P["ink"], m=P["mut"], a=P["acc"], card=P["card"])
    fx = [tscard(P["card"], P["ink"] + "1a", P["rad"], P["ink"]), lift(".pb-ts", P["ink"] + "26", -8)]
    return S([C(nx_title(P, k, "آراء العملاء", "ماذا يقول من جرّب", "نصوص نموذجية للمعاينة — استبدلها بآراء عملائك", "center") + [W("spacer", mh=dm(20, 8))], w=100)] + tests(th, fx),
             pad=dm([70, 20, 80, 20], [44, 14, 50, 14]), gap={"d": 20}, fxs=[_nx_bg(P, k, "paper")], cw={"d": 1180})

def nx_faq(P, N, k):
    th = dict(h=P["ink"], m=P["mut"], a=P["acc"], card=P["card"])
    return faq(th, [_nx_bg(P, k, "soft")], [accfx(P["card"], P["ink"] + "1a", 14, P["ink"])])

def nx_news(P, N, k):
    ink, acc = P["ink"], P["acc"]
    flds = [{"label": "الاسم", "type": "text", "ph": "اكتب اسمك", "req": True, "w": "full"}, {"label": "رسالتك", "type": "textarea", "ph": "ما الذي تريد معرفته قبل الطلب؟", "req": True, "w": "full"}]
    return S([C(nx_title(P, k, "تواصل معنا", "عندك سؤال قبل الطلب؟", "اكتب رسالتك فتصلنا على واتساب ونردّ عليك", "center") + [W("spacer", mh=dm(16, 6)),
                 contact("راسلنا", "", flds, btn="أرسل عبر واتساب", dest="whatsapp", subject="سؤال قبل الطلب", fbg=P["card"], fbc=ink + "22", frad=dm(P["rad"]), tcol=ink, lcol=P["mut"], ibg=P["paper"], ibc=ink + "33", irad=dm(12), bbg=P["btn"], bcol=P["onbtn"], brad=dm(999), bfull=True, **anim("fadeUp", .7, .2))], w=100)],
             cw={"d": 640}, pad=dm([70, 20, 90, 20], [44, 14, 56, 14]), fxs=[_nx_bg(P, k, "paper")])

SEC_FN = dict(hero=nx_hero, cats=nx_cats, feat=nx_featured, slider=nx_slider, ed=nx_editorial, values=nx_values, promo=nx_promo, tests=nx_tests, faq=nx_faq, news=nx_news)

def nx_css(P):
    """CSS يكسو القسم «كل منتجاتنا» الذي تحقنه المنصة عند التثبيت على الرئيسية (#chips/#grid لازمان لسكربت الرئيسية وبطاقات الفئات) بهوية القالب"""
    i, c, a, m, r, bt, ob = P["ink"], P["card"], P["acc"], P["mut"], P["rad"], P["btn"], P["onbtn"]; B = "body "
    return ("body header .cart-btn{background:%s!important;color:%s!important}" % (bt, ob) + B + "#products{background:transparent!important}" + B + "#chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}" + B + "#chips .chip{border:1.5px solid %s!important;background:transparent!important;color:%s!important;border-radius:999px;padding:.45em 1.15em;font-weight:800;transition:.25s}" % (i, i)
            + B + "#chips .chip.active,body #chips .chip:hover{background:%s!important;color:%s!important}" % (bt, ob)
            + B + "#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px;align-items:start}"
            + B + "#grid .card{display:block;background:%s!important;color:%s!important;border:1px solid %s!important;border-radius:%dpx %dpx %dpx %dpx!important;overflow:hidden;box-shadow:none!important;transition:transform .45s cubic-bezier(.2,.8,.2,1),border-color .3s,box-shadow .45s}" % (c, i, i + "1f", r, r * 2, r, r)
            + B + "#grid .card:hover{transform:translateY(-8px);border-color:%s!important;box-shadow:0 24px 50px %s!important}" % (a, i + "26")
            + B + "#grid .card:nth-child(even){margin-top:30px}"
            + B + "#grid .card .thumb{aspect-ratio:4/5;overflow:hidden;position:relative;background:transparent}" + B + "#grid .card .thumb img{width:100%;height:100%;object-fit:cover;transition:transform .8s cubic-bezier(.2,.8,.2,1)}" + B + "#grid .card:hover .thumb img{transform:scale(1.06)}"
            + B + "#grid .card .body{padding:12px 14px 16px}" + B + "#grid .card h3{color:%s!important;font-size:1rem;margin:0 0 6px}" % i
            + B + "#grid .card .price,body #grid .card .price-row .price{color:%s!important;font-weight:900}" % i + B + "#grid .card .old{color:%s!important;margin-inline-start:8px;text-decoration:line-through}" % m
            + B + "#grid .card .cta{background:%s!important;color:%s!important;border-radius:999px!important;font-weight:800;padding:.7rem;text-align:center;margin-top:.7rem}" % (bt, ob)
            + "@media(max-width:767px){" + B + "#grid{grid-template-columns:repeat(2,1fr);gap:12px}" + B + "#grid .card:nth-child(even){margin-top:18px}}")
def nx_build(tid, N):
    P = N; k = "nx" + tid[-2:]
    secs = [nx_bar(P, N), nx_hdr(P, N)]
    for key in N["order"]:
        if key == "mq": secs.append(mq("توصيل لكل الولايات   ✦   الدفع عند الاستلام   ✦   دعم على واتساب   ✦   استبدال وفق الشروط   ✦   ", P["fbg"], P["fon"])); continue
        secs.append(SEC_FN[key](P, N, k))
    secs.append(nx_foot(P, N))
    return secs

def nx_demo(tid, groups):
    p = os.path.join(OUT, tid + ".json"); pg = json.load(open(p, encoding="utf-8")); dp = NX_NICHES.get(tid, NX_NICHES["s-nexus"])["dp"]
    def walk(n):
        if isinstance(n, dict):
            st = n.get("set") if n.get("type") else None
            if st and st.get("pdemo"):
                g = st.pop("pdemo"); st["demo"] = [dp[i] for i in groups.get(g, range(len(dp)))]
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(pg["sections"])
    json.dump(pg, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

for _tid in NX_IDS:
    _nx_begin(_tid)
    _N = NX_NICHES[_tid]
    _desc = "هوية «شبكة غير متماثلة»: هيرو بكولاج صور متراكبة وعناصر حرة، فسيفساء فئات من فئات متجرك، منتجات بتبويبات التجميعات، مساحة تحريرية، آراء وأسئلة ونموذج اشتراك — كلها بمكوّنات المطوّر وقابلة للتحرير."
    reg(_tid, "store", _N["fld"], _N["n"], _desc, nx_build(_tid, _N), {"ff": _N["ff"], "bg": _N["paper"], "header": False, "footer": False, "css": nx_css(_N)})
    nx_demo(_tid, {"a": range(8)})
    _nx_end()


# ═══════════ صفحات الموقع (قوالب صفحات كاملة بالهوية العامة: هيدر/محتوى/فوتر) ═══════════
_NP = NX_NICHES["s-nexus"]
def _np_wrap(k, body, N=None):
    N = N or _NP
    return [nx_bar(N, N), nx_hdr(N, N)] + body + [nx_foot(N, N)]
def _np_hero(P, k, kick, h, sub, img=None, alt="", dark=False):
    """ترويسة صفحة: عنوان كبير + وصف، وصورة بإطار غير متماثل اختيارية"""
    ink = P["ink"]
    left = [T("— %s —" % kick, 14, P["acc"], "start", fw="800", **anim("fadeDown")),
            W("heading", text=h, tag="h1", fs=dm(58, 34), fw="800", ta={"d": "start"}, color=ink, lh={"d": 1.2}, ff=P["hf"], fxs=[_nx_balance()], **anim("fadeUp")),
            T(sub, 18, P["mut"], "start", **anim("fadeUp", .7, .1))]
    cols = [C(left, w=58 if img else 100, va="center", pad=dm([0, 0, 0, 0]))]
    if img: cols.append(C([PIC(img, alt, P["rad"] + 10, hauto=False, fxs=[ratioframe("4/3"), _nx_imgframe(P, P["rad"] + 10, ring=False)], **anim("zoomIn", .9))], w=42, pad=dm([0, 0, 0, 0])))
    return S(cols, cw={"d": 1180}, pad=dm([80, 20, 60, 20], [44, 14, 36, 14]), gap={"d": 40, "m": 22}, fxs=[_nx_bg(P, k, "paper")])
def _np_doc(P, k, kick, title, sub, blocks):
    """صفحة نصية قانونية/سياسة: عمود قراءة مريح، عناوين مرقّمة"""
    ws = []
    for i, (h, body) in enumerate(blocks):
        ws.append(W("heading", text="%d. %s" % (i + 1, h), tag="h2", fs=dm(26, 21), fw="800", ta={"d": "start"}, color=P["ink"], lh={"d": 1.3}, ff=P["hf"], fxs=[FX("خط علوي", "selector{border-top:1px solid [[c]];padding-top:22px;margin-top:10px}", c=("اللون", "text", P["ink"] + "26"))]))
        ws.append(T(body, 17, P["mut"], "start", lh=2))
    return [_np_hero(P, k, kick, title, sub),
            S([C(ws, w=100)], cw={"d": 820}, pad=dm([20, 20, 90, 20], [10, 16, 60, 16]), fxs=[_nx_bg(P, k, "paper")])]
def _np_cta(P, k, h, sub, btn, link="#"):
    ink = P["fbg"]
    return S([C([W("heading", text=h, tag="h2", fs=dm(40, 28), fw="800", ta={"d": "center"}, color=P["fon"], lh={"d": 1.25}, ff=P["hf"], fxs=[_nx_balance()]),
                 T(sub, 17, P["fon"] + "e0", "center"), BTN(btn, bg=P["fon"], color=ink, al="center", link=link, brad={"d": 999}, fxs=[lift(".pb-btn", "rgba(0,0,0,.35)", -3, 0)])], w=100)],
             cw={"d": 900}, pad=dm([70, 30, 70, 30], [44, 18, 44, 18]), mar=dm([20, 20, 60, 20], [10, 10, 40, 10]), rad=dm(P["rad"] + 14), fxs=[FX("خلفية داكنة", "selector{background:[[c]]}", c=("اللون", "text", ink))])

def np_collection(P, k):
    ink = P["ink"]
    hero = _np_hero(P, k, "مجموعة", "كل منتجاتنا في مكان واحد", "تصفّح بالفئة، ابحث بالاسم، وافرز بالسعر — الأسعار والمخزون من بيانات متجرك مباشرة.", "acc_outfit", "إطلالة بألوان هادئة مع إكسسوارات")
    prods = S([C([W("anchor", aid="products", aoff=dm(80)),
                  W("products", mode="all", limit=0, btn="اطلب الآن", showOld=True, tabs="cats", tsrch=True, tsort=True, tpage=8, tmore="عرض المزيد", cardw=dm(250, 160), gap=dm(20, 12), rad=dm(P["rad"]), cbg=P["card"], bbg=P["btn"], pdemo="a",
                    fxs=[_nx_card(P), _nx_cardratio("4/5"), _nx_stagger(P),
                         FX("أدوات المجموعة", "selector .pb-ptools input,selector .pb-ptools select{border-color:[[ink]];background:[[bg]];color:[[ink]]}selector .pb-pmore{color:[[ink]]}selector .pb-ptabs button{border-color:[[ink]];background:transparent;color:[[ink]];font-weight:800}selector .pb-ptabs button.on,selector .pb-ptabs button:hover{background:[[ink]];color:#fff}", ink=("اللون", "text", ink), bg=("خلفية الحقول", "text", P["card"]))])], w=100)],
               cw={"d": 1240}, pad=dm([20, 20, 90, 20], [10, 14, 56, 14]), fxs=[_nx_bg(P, k, "paper")])
    return _np_wrap(k, [hero, prods, _np_cta(P, k, "لم تجد ما تبحث عنه؟", "راسلنا على واتساب ونساعدك في الاختيار.", "اسألنا الآن", "https://wa.me/213555000000")])
def np_categories(P, k):
    hero = _np_hero(P, k, "الفئات", "تسوّق بحسب الفئة", "فئات متجرك تظهر هنا تلقائياً بصورها — أضف فئة جديدة من إعدادات المتجر فتظهر بلا أي تعديل.")
    im = [IMG(x) for x in _NP["catimg"]]
    items = [{"cat": "skin", "label": "", "img": im[0], "dl": _NP["cats"][0]}, {"cat": "hair", "label": "", "img": im[1], "dl": _NP["cats"][1]}, {"cat": "honey", "label": "", "img": im[2], "dl": _NP["cats"][2]},
             {"cat": "health", "label": "", "img": im[3], "dl": _NP["cats"][3]}, {"cat": "roqia", "label": "", "img": im[4], "dl": _NP["cats"][4]}]
    cats = S([C([W("shopcats", items=items, cols=dm(6, 2, 3), gap=dm(14), rad=dm(P["rad"]), fs=dm(20, 16), tc="#ffffff", ov=P["ink"], ovo=55, ratio="1/1", fxs=[_nx_bento(P)])], w=100)],
             cw={"d": 1180}, pad=dm([20, 20, 70, 20], [10, 14, 44, 14]), fxs=[_nx_bg(P, k, "paper")])
    browse = S([C(nx_title(P, k, "كل المنتجات", "تصفّح بالفئة") + [W("spacer", mh=dm(14, 6)),
                 W("products", mode="all", limit=12, btn="اطلب الآن", showOld=True, tabs="cats", cardw=dm(250, 160), gap=dm(20, 12), rad=dm(P["rad"]), cbg=P["card"], bbg=P["btn"], pdemo="a", fxs=[_nx_card(P), _nx_cardratio("4/5")])], w=100)],
               cw={"d": 1240}, pad=dm([30, 20, 90, 20], [20, 14, 56, 14]), fxs=[_nx_bg(P, k, "soft")])
    return _np_wrap(k, [hero, cats, browse])
def np_about(P, k):
    ink = P["ink"]
    hero = _np_hero(P, k, "من نحن", "متجر صغير بتفاصيل كبيرة", "نبيع ما نثق به فقط، ونكتب لك عنه بصدق، ونوصّله لك بعناية.", "acc_pink", "حقيبة وردية على سطح فاتح")
    story = _nx_cvs([
        FR("image", V(4, 4), V(20, 20), V(40, 92), V(480, 320), 2, src=IMG("fashion_knit"), alt="كنزات مطوية بألوان هادئة", fit="cover", hauto=False, fxs=[_nx_imgframe(P, P["rad"] + 10, ring=False), focus("50% 50%")], **anim("fadeUp", .9)),
        FR("image", V(30, 40), V(270, 300), V(22, 52), V(280, 250), 3, src=IMG("acc_round"), alt="نظارة دائرية", fit="cover", hauto=False, fxs=[_nx_imgframe(P, P["rad"]), focus("50% 50%")], **anim("zoomIn", .9, .2)),
        FT("— قصتنا —", V(54, 6), V(40, 380), V(42, 88), V(14, 13), P["acc"], "start", 5, "800"),
        FH("بدأنا بفكرة: أن يكون الشراء عبر الإنترنت بسيطاً وصادقاً", V(54, 6), V(74, 410), V(42, 88), V(40, 28), ink, "start", 5, "800", ff=P["hf"], **anim("fadeUp", .8)),
        FT("اكتب هنا قصة متجرك: كيف بدأت، ولماذا تختار منتجاتك، وما الذي يميّزك. هذا النص نموذجي للمعاينة ويُستبدل بقصتك.", V(54, 6), V(250, 560), V(40, 88), V(17, 15), P["mut"], "start", 5, "500", **anim("fadeUp", .8, .1)),
    ], dm(520, 760, 520), [_nx_bg(P, k, "paper")], cw=1180)
    vals = S([C([IB(ic, t, x, tc=ink, xc=P["mut"], isz=36, icc=P["acc"], al={"d": "start"}, fxs=[FX("بطاقة", "selector .pb-ib{background:[[bg]];border:1px solid [[bd]];border-radius:[[r]]px;padding:26px 22px}", bg=("الخلفية", "text", P["card"]), bd=("الإطار", "text", ink + "1a"), r=("التدوير", "num", P["rad"]))])], w=33)
                for ic, t, x in [("shield-check", "وضوح", "وصف دقيق وأسعار مكتوبة بلا مفاجآت."), ("truck", "عناية بالتوصيل", "تغليف محكم ومتابعة للطلب حتى باب بيتك."), ("headset", "قرب منك", "نردّ على أسئلتك على واتساب قبل الطلب وبعده.")]],
             cw={"d": 1180}, pad=dm([40, 20, 80, 20], [24, 14, 50, 14]), gap={"d": 18, "m": 12}, fxs=[_nx_bg(P, k, "paper")])
    return _np_wrap(k, [hero, story, vals, _np_cta(P, k, "تحب أن تسألنا عن شيء؟", "نسعد بسماعك في أي وقت خلال ساعات العمل.", "راسلنا على واتساب", "https://wa.me/213555000000")])
def np_contact(P, k):
    ink = P["ink"]
    hero = _np_hero(P, k, "اتصل بنا", "نحب أن نسمع منك", "اكتب لنا أو اتصل — نردّ في أقرب وقت خلال ساعات العمل.")
    flds = [{"label": "الاسم الكامل", "type": "text", "ph": "اكتب اسمك", "req": True, "w": "half"}, {"label": "رقم الهاتف", "type": "tel", "ph": "05XXXXXXXX", "req": True, "w": "half"},
            {"label": "الموضوع", "type": "select", "ph": "اختر الموضوع", "opts": "استفسار عن منتج، متابعة طلب، الاستبدال والإرجاع، أخرى", "req": True, "w": "full"}, {"label": "رسالتك", "type": "textarea", "ph": "كيف نساعدك؟", "req": True, "w": "full"}]
    form = contact("راسلنا", "", flds, btn="أرسل الرسالة", dest="whatsapp", subject="رسالة من صفحة اتصل بنا", fbg=P["card"], fbc=ink + "22", frad=dm(P["rad"]), tcol=ink, lcol=P["mut"], ibg=P["paper"], ibc=ink + "33", irad=dm(12), bbg=P["btn"], bcol=P["onbtn"], brad=dm(999), bfull=True, **anim("fadeUp", .7, .1))
    side = [W("heading", text="قنوات مباشرة", tag="h3", fs=dm(26, 22), fw="800", ta={"d": "start"}, color=ink, ff=P["hf"]),
            T("اختر الأنسب لك:", 16, P["mut"], "start"),
            BTN("واتساب", bg=ink, color="#fff", al="start", link="https://wa.me/213555000000", brad={"d": 999}),
            BTN("اتصل: 05XXXXXXXX", bg="transparent", color=ink, al="start", link="tel:05XXXXXXXX", brad={"d": 999}, fxs=[FX("حدّ", "selector .pb-btn{border:1.5px solid [[c]]}", c=("اللون", "text", ink))]),
            T("ساعات العمل: السبت – الخميس، 9ص – 8م", 16, P["mut"], "start"), T("العنوان: يضاف من إعدادات المتجر", 16, P["mut"], "start")]
    body = S([C(side, w=40, pad=dm([0, 0, 0, 0])), C([form], w=60, pad=dm([0, 0, 0, 0]))], cw={"d": 1100}, pad=dm([20, 20, 80, 20], [10, 14, 50, 14]), gap={"d": 40, "m": 22}, fxs=[_nx_bg(P, k, "paper")])
    return _np_wrap(k, [hero, body])
def np_faq(P, k):
    hero = _np_hero(P, k, "الأسئلة الشائعة", "إجابات سريعة قبل أن تسأل", "جمعنا أكثر ما يسأله زبائننا. إن لم تجد إجابتك راسلنا.")
    G = [("الطلب والدفع", [("كيف أطلب؟", "اختر المنتج واضغط «اطلب الآن» ثم املأ بياناتك وسنؤكّد طلبك هاتفياً."), ("هل الدفع عند الاستلام؟", "نعم، تدفع بعد استلام طلبك ومعاينته."), ("هل يمكنني تعديل طلبي؟", "تواصل معنا قبل الشحن وسنعدّله لك.")]),
         ("التوصيل", [("كم يستغرق التوصيل؟", "من 24 إلى 72 ساعة حسب ولايتك."), ("هل تغطون كل الولايات؟", "نعم، نوصّل إلى كل الولايات عبر شركات التوصيل."), ("كيف أتابع طلبي؟", "من صفحة «تتبّع الطلب» أو حسابك.")]),
         ("الاستبدال", [("هل يمكن الاستبدال؟", "نعم وفق شروط الاستبدال المكتوبة في صفحة الاستبدال والإرجاع."), ("ماذا لو وصلتني قطعة غير مطابقة؟", "راسلنا بصورة وسنجد لك حلاً.")])]
    secs = []
    for gi, (gt, qs) in enumerate(G):
        secs.append(S([C([W("heading", text=gt, tag="h2", fs=dm(30, 24), fw="800", ta={"d": "start"}, color=P["ink"], ff=P["hf"]), W("accordion", items=[{"q": q, "a": a} for q, a in qs], first=(gi == 0), qbg=P["card"], qc=P["ink"], ac=P["mut"], qfs=dm(18, 16), fxs=[accfx(P["card"], P["ink"] + "1a", 14, P["ink"])])], w=100)],
                       cw={"d": 820}, pad=dm([24, 20, 24, 20], [14, 16, 14, 16]), fxs=[_nx_bg(P, k, "paper")]))
    return _np_wrap(k, [hero] + secs + [_np_cta(P, k, "ما زال عندك سؤال؟", "اكتب لنا وسنردّ عليك.", "راسلنا على واتساب", "https://wa.me/213555000000")])
def np_privacy(P, k):
    return _np_wrap(k, _np_doc(P, k, "قانوني", "سياسة الخصوصية", "نص مبدئي للمراجعة والتعديل قبل النشر — عدّله ليطابق ممارسات متجرك.", [
        ("البيانات التي نجمعها", "نجمع الاسم ورقم الهاتف وعنوان التوصيل وما تكتبه في نماذج الطلب والاتصال، لأجل تنفيذ طلبك والتواصل معك فقط."),
        ("كيف نستعمل بياناتك", "نستعمل بياناتك لتأكيد الطلب وتوصيله والرد على استفساراتك. لا نبيع بياناتك لأي طرف."),
        ("مشاركة البيانات", "نشارك الحدّ الأدنى اللازم (الاسم والهاتف والعنوان) مع شركة التوصيل لتسليم طلبك."),
        ("ملفات الارتباط والتحليلات", "قد نستعمل ملفات ارتباط وأدوات قياس لتحسين المتجر. يمكنك تعطيلها من إعدادات متصفحك."),
        ("حقوقك", "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها بمراسلتنا."),
        ("التواصل", "لأي استفسار حول الخصوصية راسلنا عبر قنوات التواصل المذكورة في المتجر.")]))
def np_terms(P, k):
    return _np_wrap(k, _np_doc(P, k, "قانوني", "الشروط والأحكام", "نص مبدئي للمراجعة والتعديل قبل النشر — عدّله ليطابق شروط متجرك.", [
        ("القبول", "باستعمالك المتجر وإرسالك طلباً فإنك توافق على هذه الشروط."),
        ("الأسعار والتوفر", "الأسعار بالدينار الجزائري وقد تتغير. نؤكّد التوفر والسعر عند تأكيد الطلب."),
        ("الطلب والتأكيد", "يُعدّ الطلب نهائياً بعد تأكيده هاتفياً. لنا الحق في رفض الطلبات غير الجادة."),
        ("الدفع والتوصيل", "الدفع عند الاستلام ما لم يُذكر خلاف ذلك. مدة التوصيل تقديرية وتختلف بحسب الولاية."),
        ("الاستبدال والإرجاع", "تسري شروط صفحة الاستبدال والإرجاع."),
        ("المسؤولية", "نبذل جهدنا في دقة الوصف والصور، وقد تختلف الألوان قليلاً بحسب الشاشة.")]))
def np_returns(P, k):
    return _np_wrap(k, _np_doc(P, k, "الاستبدال والإرجاع", "الاستبدال والإرجاع", "نص مبدئي للمراجعة والتعديل قبل النشر — عدّل المدة والشروط بما يناسب متجرك.", [
        ("مدة الاستبدال", "يمكنك طلب الاستبدال خلال 7 أيام من الاستلام (عدّل المدة بما تلتزم به)."),
        ("الشروط", "أن يكون المنتج بحالته الأصلية وغير مستعمل وبتغليفه. بعض المنتجات (مثل مستلزمات العناية الشخصية المفتوحة) لا تُستبدل لأسباب صحية."),
        ("كيف تطلب الاستبدال", "راسلنا على واتساب بصورة للمنتج ورقم الطلب وسنوجّهك للخطوات."),
        ("المنتج المعيب أو غير المطابق", "إن وصلك منتج معيب أو مختلف عن الطلب فنتحمل تكلفة الاستبدال بعد المعاينة."),
        ("الإرجاع المالي", "يتم وفق سياسة المتجر وبحسب حالة الطلب؛ اكتب هنا ما تلتزم به فعلاً.")]))
def np_track(P, k):
    ink = P["ink"]
    hero = _np_hero(P, k, "تتبّع الطلب", "أين طلبي الآن؟", "سجّل دخولك إلى حسابك لتتبّع طلباتك وحالتها، أو راسلنا برقم الطلب.", "acc_pink", "حقيبة وردية على سطح فاتح")
    steps = S([C([IB(ic, t, x, tc=ink, xc=P["mut"], isz=36, icc=P["acc"], al={"d": "start"}, fxs=[FX("بطاقة", "selector .pb-ib{background:[[bg]];border:1px solid [[bd]];border-radius:[[r]]px;padding:26px 22px}", bg=("الخلفية", "text", P["card"]), bd=("الإطار", "text", ink + "1a"), r=("التدوير", "num", P["rad"]))])], w=25)
                 for ic, t, x in [("check", "تم استلام الطلب", "نراجع طلبك ونتصل بك للتأكيد."), ("shield-check", "تم التأكيد", "نجهّز طلبك ونغلّفه."), ("truck", "قيد التوصيل", "سلّمناه لشركة التوصيل."), ("gift", "تم التسليم", "استلمت طلبك ودفعت عند الاستلام.")]],
             cw={"d": 1180}, pad=dm([20, 20, 40, 20], [10, 14, 30, 14]), gap={"d": 16, "m": 10}, fxs=[_nx_bg(P, k, "paper")])
    cta = S([C([BTN("افتح حسابي وتتبّع طلباتي", bg=P["btn"], color=P["onbtn"], al="center", link="../../account.html", brad={"d": 999}, fxs=[lift(".pb-btn", "rgba(0,0,0,.3)", -3, 0)]), W("spacer", mh=dm(10)),
                T("أو راسلنا على واتساب برقم الطلب وسنخبرك بحالته.", 16, P["mut"], "center"), BTN("راسلنا على واتساب", bg="transparent", color=ink, al="center", link="https://wa.me/213555000000", brad={"d": 999}, fxs=[FX("حدّ", "selector .pb-btn{border:1.5px solid [[c]]}", c=("اللون", "text", ink))])], w=100)],
            cw={"d": 700}, pad=dm([20, 20, 90, 20], [10, 14, 60, 14]), fxs=[_nx_bg(P, k, "paper")])
    return _np_wrap(k, [hero, steps, cta])

NP_PAGES = [("p-nexus-collection", "صفحة مجموعة المنتجات", "منتجات بتبويبات التصنيف وبحث وفرز وتحميل تدريجي — مرتبطة ببيانات المتجر.", np_collection),
            ("p-nexus-categories", "صفحة الفئات", "فسيفساء فئات غير متماثلة من فئات المتجر الحقيقية + تصفّح بالفئة.", np_categories),
            ("p-nexus-about", "من نحن", "قصة المتجر بتراكب صور وقيم ودعوة للتواصل.", np_about),
            ("p-nexus-contact", "اتصل بنا", "نموذج اتصال يصل واتساب المتجر وقنوات مباشرة وساعات العمل.", np_contact),
            ("p-nexus-faq", "الأسئلة الشائعة", "أسئلة مجمّعة (الطلب/التوصيل/الاستبدال) بقوائم قابلة للطيّ.", np_faq),
            ("p-nexus-privacy", "سياسة الخصوصية", "نص مبدئي للمراجعة بقراءة مريحة وعناوين مرقّمة.", np_privacy),
            ("p-nexus-terms", "الشروط والأحكام", "نص مبدئي للمراجعة بقراءة مريحة وعناوين مرقّمة.", np_terms),
            ("p-nexus-returns", "الاستبدال والإرجاع", "نص مبدئي للمراجعة: المدة والشروط وطريقة الطلب.", np_returns),
            ("p-nexus-track", "تتبّع الطلب", "مراحل الطلب وزر لحسابك (تتبّع الطلبات) وواتساب المتجر.", np_track)]
for _pid, _pn, _pd, _pf in NP_PAGES:
    _nx_begin(_pid)
    reg(_pid, "page", "عام", "NEXUS — " + _pn, _pd, _pf(_NP, "np" + _pid[-3:]), {"ff": _NP["ff"], "bg": _NP["paper"], "header": False, "footer": False, "demo": True})
    nx_demo(_pid, {"a": range(8)})
    _nx_end()


# القوالب الجديدة تتصدّر المكتبة (NEXUS هو القالب الافتراضي الجديد)
_NX_ALL = NX_IDS + [p[0] for p in NP_PAGES]
_nx_front = [t for t in TEMPLATES if t["id"] in _NX_ALL]
TEMPLATES[:] = _nx_front + [t for t in TEMPLATES if t["id"] not in _NX_ALL]
