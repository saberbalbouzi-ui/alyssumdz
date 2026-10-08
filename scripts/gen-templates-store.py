# ═════════ صفحات متاجر إيكومارس (5) ═════════
FAQ = [{"q": "كيف أطلب؟", "a": "اختر المنتج، اضغط «اطلب الآن»، املأ الاسم والهاتف والعنوان وسنؤكّد طلبك هاتفياً."},
       {"q": "هل الدفع عند الاستلام؟", "a": "نعم، تدفع فقط بعد استلام طلبك ومعاينته."},
       {"q": "كم يستغرق التوصيل؟", "a": "من 24 إلى 72 ساعة حسب ولايتك، ونغطي كل الولايات."},
       {"q": "هل يمكن الاستبدال؟", "a": "نعم، خلال 7 أيام إذا كان المنتج بحالته الأصلية."}]

def hdr(**o):
    h = reid(PARTS["sitehead"]); s = h["free"][0]["set"]
    s.pop("hsite", None); s.update({"ltx": True, "la": "متجرك", "lion": True, "lsplit": False})
    s.update(o); return h
def bar(txt, tbg, ttc, tbc, **o):
    b = reid(PARTS["sitebar"]); s = b["free"][0]["set"]; s.update({"txt": txt, "tbg": tbg, "ttc": ttc, "tbc": tbc}); s.update(o); return b
def foot(**o):
    f = reid(PARTS["sitefoot"]); s = f["cols"][0]["widgets"][0]["set"]
    s["cols"][0] = {"h": "متجرك", "b": "متجرك الإلكتروني: منتجات أصلية، توصيل سريع لكل الولايات والدفع عند الاستلام."}
    s["copy"] = "© 2026 متجرك — جميع الحقوق محفوظة"; s.update(o); return f
def cats(tc="#ffffff", ov="#0a201a", ovo=70, rad=22, cols=3, fxs=None, imgs=None, **o):
    im = [IMG(x) for x in (imgs or [])] + ["", "", ""]
    w = W("shopcats", items=[{"cat": "skin", "label": "", "img": im[0]}, {"cat": "hair", "label": "", "img": im[1]}, {"cat": "honey", "label": "", "img": im[2]}],
          cols={"d": cols, "t": 3, "m": 2}, gap={"d": 18}, rad={"d": rad}, fs={"d": 16}, tc=tc, ov=ov, ovo=ovo, ratio="1/1", **o)
    if fxs: w["set"]["fxs"] = fxs
    return w
def prodsw(cbg="#ffffff", bbg="#16a34a", rad=20, fxs=None, limit=8, **o):
    w = W("products", mode="all", limit=limit, btn="اطلب الآن", showOld=True, cardw=dm(250, 160), gap=dm(20), rad=dm(rad), cbg=cbg, bbg=bbg, **o)
    if fxs: w["set"]["fxs"] = fxs
    return w
def title(text, sub, k, th, fxs):
    return C([W("heading", text=text, tag="h2", fs=dm(40, 28), fw="900", ta={"d": "center"}, color=th["h"], lh={"d": 1.3}, fxs=fxs, **anim("fadeUp")),
              T(sub, 17, th["m"], **anim("fadeUp", .7, .1))], w=100)
def feat4(k, th, icons, fxs_card):
    out = []
    for i, (ic, t, x) in enumerate(icons):
        out.append(C([IB(ic, t, x, tc=th["h"], xc=th["m"], isz=38, fxs=fxs_card(i), **anim("fadeUp", .7, .08 + i * .1))], w=25))
    return out
ICONS4 = [("truck", "توصيل لكل الولايات", "من 24 إلى 72 ساعة إلى باب بيتك"), ("cash", "الدفع عند الاستلام", "لا تدفع إلا بعد المعاينة"), ("shield-check", "جودة مضمونة", "منتجات أصلية ومفحوصة بعناية"), ("headset", "دعم متواصل", "فريقنا يردّ على واتساب بسرعة")]
def stats(th, vals, fxc, colw=25):
    return [C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(48, 30), color=th["a"], lc=th["m"], fxs=fxc, **anim("fadeUp", .6, .08 + i * .1))], w=colw) for i, (n, p, s, l) in enumerate(vals)]
def tests(th, fx):
    data = [("ياسين ب.", "وهران", "وصلني الطلب بسرعة والجودة ممتازة، شكراً لكم.", "av_m1"), ("كريم ع.", "قسنطينة", "تعامل محترم وتأكيد سريع، سأكرر الطلب بالتأكيد.", "av_m2"), ("أمين ر.", "العاصمة", "منتجات أصلية وأسعار معقولة، أنصح بالتجربة.", "av_m3")]
    return [C([W("testimonial", name=n, role=r, text=t, img=IMG(a), stars=5, rad=dm(22), tbg=th["card"], fxs=fx, **anim("fadeUp", .7, .1 + i * .12))], w=33) for i, (n, r, t, a) in enumerate(data)]
def offer(k, th, fxs_box, ctx="#ffffff", ctxm="#e2e8f0", cd=None):
    return S([C([
        W("heading", text="عرض اليوم — ينتهي منتصف الليل", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color=ctx, **anim("fadeDown")),
        T("اطلب اليوم وشارك الكود لتحصل على خصم إضافي على سلّتك.", 18, ctxm, **anim("fadeUp", .7, .1)),
        W("countdown", mode="daily", cbg=th.get("cdbg", "#00000066"), color=th.get("cdc", "#ffffff"), fs=dm(40, 28), crad=dm(14), al={"d": "center"}, fxs=[cdglow(k, th["a"])], **anim("zoomIn", .7, .2)),
        W("coupon", cpcode="SAVE15", cpt="خصم 15% على طلبك الأول", cpbtn="نسخ الكود", cpbg=th.get("cpbg", "#ffffff18"), cpbc=th["a"], cpc=ctx, cpb=th["a"], fxs=[couponfx(th["a"])], **anim("fadeUp", .7, .3)),
    ], w=100)], cw={"d": 860}, pad=dm([54, 28, 54, 28], [34, 18, 34, 18]), fxs=fxs_box, mar=dm([20, 20, 20, 20], [14, 12, 14, 12]), rad=dm(34))
def faq(th, fxs, acc_fx):
    return S([C([W("heading", text="أسئلة شائعة", tag="h2", fs=dm(38, 28), fw="900", ta={"d": "center"}, color=th["h"], **anim("fadeUp")),
                 W("accordion", items=FAQ, first=True, qbg=th["card"], qc=th["h"], ac=th["m"], qfs=dm(18, 16), fxs=acc_fx, **anim("fadeUp", .7, .1))], w=100)],
             cw={"d": 820}, pad=dm([60, 20, 70, 20], [40, 16, 48, 16]), fxs=fxs)
def mq(txt, bg, c, k=""):
    return S([C([W("marquee", mqt=txt, mqs=26, mqd="rtl", mqg=dm(56), mqp=True, mqbg=bg, mqc=c, fs=dm(18), fw="800", fxs=[marqueefx()])], w=100)], layout="full", pad=dm([0, 0, 0, 0]))

MQ = "توصيل لكل الولايات   ✦   الدفع عند الاستلام   ✦   منتجات أصلية 100%   ✦   استبدال خلال 7 أيام   ✦   دعم على واتساب"

def store(id, n, d, fld, k, th, hero, extra, ff, pagebg):
    secs = []
    secs.append(bar(*th["bar"]))
    secs.append(hdr(**th["hdr"]))
    secs += hero
    secs.append(mq(th.get("mq", MQ), *th["mqc"]))
    secs.append(S([title("تسوّق حسب الفئة", "اختر ما يناسبك من فئاتنا", k, th, th["hfx"]("a")), C([cats(**th["cats"])], w=100)], pad=dm([60, 20, 20, 20], [40, 16, 16, 16]), fxs=th["bgA"]("a")))
    secs.append(S([title("منتجاتنا المميّزة", "أكثر المنتجات طلباً هذا الأسبوع", k, th, th["hfx"]("b")), C([prodsw(**th["prods"])], w=100)], pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=th["bgB"]("b")))
    secs.append(S(feat4(k, th, ICONS4, th["fcard"]), pad=dm([40, 20, 60, 20], [28, 16, 40, 16]), gap={"d": 18}, fxs=th["bgA"]("c")))
    secs += extra
    secs.append(S(stats(th, [(12000, "+", "", "طلب مُسلَّم"), (58, "", "", "ولاية نغطيها"), (98, "", "%", "رضا الزبائن"), (24, "", "h", "متوسط التوصيل")], th["ctr"]), pad=dm([50, 20, 20, 20], [34, 16, 16, 16]), gap={"d": 16}, fxs=th["bgB"]("d")))
    secs.append(S(tests(th, th["tsfx"]), pad=dm([20, 20, 60, 20], [16, 16, 40, 16]), gap={"d": 20}, fxs=th["bgB"]("e")))
    secs.append(offer(k, th, th["offfx"], th.get("offc", "#ffffff"), th.get("offm", "#e2e8f0")))
    secs.append(faq(th, th["bgA"]("f"), th["accfx"]))
    secs.append(foot(**th["foot"]))
    reg(id, "store", fld, n, d, secs, {"ff": "'%s',sans-serif" % ff, "bg": pagebg, "header": False, "footer": False})

# ───────── 1) أورورا داكن ─────────
k = "sa"; ICC[0] = "#a78bfa"
th = dict(h="#ffffff", m="#cbd5e1", a="#a78bfa", card="#ffffff10",
          bar=("✦ شحن مجاني فوق 6000 دج  ·  الدفع عند الاستلام  ·  خصم 15% على أول طلب", "#0b1020", "#e2e8f0", "#a78bfa"),
          hdr=dict(hbg="#0b1020", hbr="#ffffff1a", lc="#ffffff", lac="#a78bfa", mc="#e2e8f0", cbg="#7c3aed"),
          mqc=("#7c3aed26", "#e2e8f0"),
          hfx=lambda s: [gradtext(k + s, "#a78bfa", "#22d3ee", "#f472b6", 7)],
          bgA=lambda s: [FX("خلفية داكنة ببقع ضوء", "selector{background:radial-gradient(60% 70% at 10% 0%,rgba(124,58,237,.22),transparent 60%),radial-gradient(50% 60% at 95% 100%,rgba(6,182,212,.14),transparent 60%),#070b18}")],
          bgB=lambda s: [FX("خلفية داكنة ببقع ضوء", "selector{background:radial-gradient(55% 70% at 90% 0%,rgba(219,39,119,.14),transparent 60%),radial-gradient(60% 60% at 5% 100%,rgba(124,58,237,.18),transparent 60%),#080c1b}")],
          cats=dict(imgs=["it_laptop", "it_pc", "it_dark"], ov="#0b1020", ovo=45, rad=24, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(124,58,237,.4)", -8, 4)]),
          prods=dict(cbg="#ffffff", bbg="#7c3aed", rad=22, fxs=[lift(".pb-pc", "rgba(124,58,237,.45)", -10, 3)]),
          fcard=lambda i: [cardgrid(), sheen(k + str(i), ".pb-ib"), lift(".pb-ib", "rgba(124,58,237,.35)", -6, 4), floaty(k + "f" + str(i), ".pb-ibi", 6, 4 + i * .5)],
          ctr=[ctrcolor("#a78bfa", "#22d3ee")], tsfx=[tscard("rgba(255,255,255,.07)", "rgba(255,255,255,.2)", 22, "#f1f5f9"), lift(".pb-ts", "rgba(124,58,237,.4)", -8)],
          offfx=[aurora(k + "o", "#1e1b4b", "#7c3aed99", "#06b6d466", "#db277766", 10), rotborder(k, "#22d3ee", "#a855f7", 2, 5, 34)],
          accfx=[accfx("rgba(255,255,255,.07)", "rgba(255,255,255,.18)", 16)],
          foot=dict(sbg="#05070f", tc="#94a3b8", hc="#ffffff", lc="#94a3b8", lh="#a78bfa"), cdbg="#00000066", cdc="#ffffff")
hero = [S([
    C([T("✦ مجموعة جديدة وصلت للتو", 15, "#c4b5fd", "start", fw="800", **anim("fadeDown")),
       W("heading", text="تسوّق بذكاء، واستلم عند بابك", tag="h1", fs=dm(60, 34), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.2}, fxs=[gradtext(k, "#a78bfa", "#22d3ee", "#f472b6", 6)], **anim("fadeUp", .8)),
       T("منتجات أصلية مختارة بعناية، بأسعار منافسة وتوصيل سريع لكل الولايات. اطلب اليوم وادفع عند الاستلام.", 19, "#cbd5e1", "start", **anim("fadeUp", .8, .1)),
       BTN("تسوّق الآن", al="start", link="#products", fxs=[btngrad("#7c3aed", "#06b6d4", "rgba(124,58,237,.5)"), shine(k), pulse(k, "124,58,237", 2.4)], **anim("fadeUp", .8, .2)),
       W("tbadges", items="دفع عند الاستلام\nتوصيل 58 ولاية", live=True, liveText="يتصفحون المتجر الآن", lmin=14, lmax=41, cbg="#ffffff14", cc="#e2e8f0", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=56, va="center"),
    C([IB("sparkle", "منتجات أصلية", "فحص دقيق قبل الشحن", isz=34, fxs=[glass("rgba(255,255,255,.08)", "rgba(255,255,255,.22)", 18, 22), floaty(k + "h1", ".pb-ibi", 8, 4.4)], **anim("slideStart", .8, .2)),
       IB("truck", "توصيل سريع", "24 – 72 ساعة", isz=34, fxs=[glass("rgba(255,255,255,.08)", "rgba(255,255,255,.22)", 18, 22), floaty(k + "h2", ".pb-ibi", 8, 5)], **anim("slideStart", .8, .35)),
       IB("gift", "هدايا مع الطلب", "مفاجأة مع كل طلبية", isz=34, fxs=[glass("rgba(255,255,255,.08)", "rgba(255,255,255,.22)", 18, 22), floaty(k + "h3", ".pb-ibi", 8, 5.6)], **anim("slideStart", .8, .5))], w=44, va="center",
      pad=dm([30, 24, 30, 24]), rad=dm(30), **PH("it_color", "rgba(7,11,24,.15)", "rgba(7,11,24,.7)"), fxs=[rotborder(k + "ph", "#a78bfa", "#22d3ee", 2, 6, 30)]),
], pad=dm([90, 20, 90, 20], [50, 16, 50, 16]), gap={"d": 40}, fxs=[aurora(k, "#070b18", "#7c3aed88", "#06b6d466", "#db277755", 18), blobs(k, "#7c3aed", "#06b6d4", 420, .35)])]
extra = []
store("s-aurora", "متجر أورورا داكن", "متجر داكن بخلفيات أورورا متحركة وبطاقات زجاجية وعناوين بتدرّج متحرك وأزرار نابضة.", "عام", k, th, hero, extra, "Tajawal", "#070b18")

# ───────── 2) فخامة ذهبية ─────────
k = "sg"; ICC[0] = "#c9992e"
GOLDBG = lambda s: [FX("خلفية سوداء بتدرّج دافئ", "selector{background:radial-gradient(80% 90% at 80% 0%,#2b2110,#0c0a06 62%),#0c0a06}")]
th = dict(h="#f5d77a", m="#cbbf9c", a="#c9992e", card="#00000040",
          bar=("✦ شحن مؤمَّن وتغليف هدايا فاخر لكل طلب  ·  الدفع عند الاستلام", "#0c0a06", "#f5d77a", "#c9992e"),
          hdr=dict(hbg="#0c0a06", hbr="#c9992e55", lc="#f5d77a", lac="#ffffff", mc="#e7ddc0", cbg="#b8860b"),
          mqc=("#14100a", "#f5d77a"),
          hfx=lambda s: [goldshimmer(k + s, 5)],
          bgA=lambda s: GOLDBG(s) + [spotlight(k + s, "rgba(201,153,46,.12)")],
          bgB=lambda s: GOLDBG(s),
          cats=dict(imgs=["jewel_pearl", "watch_hand", "jewel_ring"], ov="#0c0a06", ovo=40, rad=6, cols=3, tc="#f5d77a", fxs=[FX("حد ذهبي للبطاقات", "selector a,selector .pb-sc{border:1px solid #c9992e;border-radius:6px;transition:transform .4s,box-shadow .4s}selector a:hover,selector .pb-sc:hover{transform:translateY(-8px);box-shadow:0 22px 50px rgba(201,153,46,.28)}")]),
          prods=dict(cbg="#14100a", bbg="#b8860b", rad=6, fxs=[FX("بطاقة سوداء بحد ذهبي", "selector .pb-pc{border:1px solid #c9992e66;color:#f5d77a;transition:transform .4s,box-shadow .4s}selector .pb-pc:hover{transform:translateY(-10px);box-shadow:0 28px 60px rgba(201,153,46,.3)}selector .pb-pcd,selector .pb-pci{color:#e7ddc0}")]),
          fcard=lambda i: [FX("بطاقة فاخرة", "selector .pb-ib{border:1px solid #c9992e66;border-radius:6px;padding:26px;background:linear-gradient(160deg,#17120a,#0c0a06);height:100%;box-sizing:border-box;transition:transform .4s,box-shadow .4s}selector .pb-ib:hover{transform:translateY(-8px);box-shadow:0 24px 50px rgba(201,153,46,.25)}"), floaty(k + "f" + str(i), ".pb-ibi", 5, 5 + i * .4)],
          ctr=[goldshimmer(k + "c", 6)], tsfx=[tscard("#14100a", "#c9992e66", 6, "#e7ddc0"), lift(".pb-ts", "rgba(201,153,46,.3)", -8)],
          offfx=[FX("خلفية ذهبية", "selector{background:linear-gradient(135deg,#1a1409,#2b2110);border:1px solid #c9992e;box-shadow:0 0 0 7px rgba(201,153,46,.12),0 40px 90px rgba(0,0,0,.6)}"), spotlight(k + "o", "rgba(201,153,46,.2)")],
          accfx=[accfx("#14100a", "#c9992e55", 6)], offc="#f5d77a", offm="#e7ddc0", cdbg="#000000aa", cdc="#f5d77a", cpbg="#00000055",
          foot=dict(sbg="#070604", tc="#a8987a", hc="#f5d77a", lc="#a8987a", lh="#f5d77a"))
hero = [S([C([
    T("✦ ELEGANCE ✦", 15, "#c9992e", "center", fw="800", **anim("fadeDown")),
    W("heading", text="تشكيلة فاخرة تليق بذوقك الرفيع", tag="h1", fs=dm(64, 34), fw="900", ta={"d": "center"}, color="#f5d77a", lh={"d": 1.25}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .9)),
    T("قطع مختارة بعناية، بجودة استثنائية وتغليف يليق بالهدايا. نوصّلها إلى باب بيتك بكل أناقة.", 20, "#cbbf9c", **anim("fadeUp", .9, .1)),
    BTN("اكتشف التشكيلة", bg="#b8860b", color="#1a1409", link="#products", fxs=[btngrad("#b8860b", "#f5d77a", "rgba(201,153,46,.55)", -3), shine(k, 3)], **anim("zoomIn", .9, .2)),
], w=100)], pad=dm([120, 20, 120, 20], [64, 16, 64, 16]), cw={"d": 900}, **PH("jewel_dark", "rgba(12,10,6,.55)", "rgba(12,10,6,.88)", bgFixed=True), fxs=[spotlight(k, "rgba(201,153,46,.2)")])]
extra = [S([C([W("heading", text="قصتنا", tag="h2", fs=dm(38, 28), fw="900", ta={"d": "start"}, color="#f5d77a", fxs=[goldshimmer(k + "s", 6)], **anim("fadeUp")),
               T("بدأنا بشغف واحد: تقديم منتجات أصلية بمقاييس الجودة العالية. كل قطعة تمرّ بفحص دقيق قبل أن تصل إليك، ونلتزم بالشفافية والسرعة في كل طلب.", 18, "#cbbf9c", "start", **anim("fadeUp", .8, .1))], w=55, va="center"),
           C([W("table", tbl="الميزة | متجرنا | غيرنا\nمنتجات أصلية | ✔ | ✘\nدفع عند الاستلام | ✔ | ✘\nاستبدال 7 أيام | ✔ | ✘", thead=True, tzb=True, thbg="#b8860b", thc="#1a1409", tbd="#c9992e66", tbfs=dm(16), tbal="center", fxs=[FX("جدول داكن", "selector table{color:#e7ddc0;background:#14100a;border-radius:6px;overflow:hidden}")], **anim("fadeUp", .8, .15))], w=45, va="center")],
          pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 40}, fxs=GOLDBG("s"))]
store("s-gold", "متجر فخامة ذهبية", "سواد ملكي وذهب لامع: عناوين بلمعان متحرك، حدود ذهبية، بطاقات ترتفع بظلال ذهبية وقصة العلامة.", "فخامة", k, th, hero, extra, "El Messiri", "#0c0a06")

# ───────── 3) طبيعي منعش ─────────
k = "sf"; ICC[0] = "#16a34a"
th = dict(h="#14532d", m="#4b6358", a="#16a34a", card="#ffffff",
          bar=("🌿 منتجات طبيعية 100%  ·  توصيل لكل الولايات  ·  الدفع عند الاستلام", "#14532d", "#ecfdf5", "#bef264"),
          hdr=dict(hbg="#f7fee7", hbr="#d9f99d", lc="#14532d", lac="#16a34a", mc="#14532d", cbg="#16a34a"),
          mqc=("#14532d", "#ecfccb"),
          hfx=lambda s: [gradtext(k + s, "#15803d", "#65a30d", "#0d9488", 8)],
          bgA=lambda s: [aurora(k + s, "#f7fee7", "#bef26488", "#6ee7b755", "#fef08a55", 22)],
          bgB=lambda s: [aurora(k + s, "#ffffff", "#d9f99d66", "#a7f3d044", "#fef9c333", 26)],
          cats=dict(imgs=["herb_tea", "skin_dropper", "honey_dipper"], ov="#14532d", ovo=40, rad=30, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(22,163,74,.35)", -8, 3)]),
          prods=dict(cbg="#ffffff", bbg="#16a34a", rad=26, fxs=[lift(".pb-pc", "rgba(22,163,74,.3)", -10, 2), FX("بطاقة ناعمة", "selector .pb-pc{box-shadow:0 14px 40px rgba(20,83,45,.12);border:1px solid #ecfccb}")]),
          fcard=lambda i: [softcard("#ffffff", "rgba(20,83,45,.12)", 28, 26, "#ecfccb"), lift(".pb-ib", "rgba(22,163,74,.3)", -8, 3), floaty(k + "f" + str(i), ".pb-ibi", 8, 4 + i * .5)],
          ctr=[ctrcolor("#15803d", "#65a30d")], tsfx=[tscard("#ffffff", "#ecfccb", 26, None), lift(".pb-ts", "rgba(22,163,74,.28)", -8)],
          offfx=[aurora(k + "o", "#14532d", "#4ade8099", "#a3e63555", "#06b6d444", 12), sticker(k, "خصم 25%", "#fde047", "#14532d", 120)],
          accfx=[accfx("#ffffff", "#d9f99d", 18)],
          foot=dict(sbg="#0f3d22", tc="#bbf7d0", hc="#ffffff", lc="#bbf7d0", lh="#bef264"), cdbg="#00000055", cdc="#ecfccb")
hero = [S([
    C([T("🌿 طبيعة صافية — صحة أفضل", 15, "#15803d", "start", fw="800", **anim("fadeDown")),
       W("heading", text="عافية من قلب الطبيعة تصلك حتى باب بيتك", tag="h1", fs=dm(56, 32), fw="900", ta={"d": "start"}, color="#14532d", lh={"d": 1.25}, fxs=[gradtext(k, "#15803d", "#65a30d", "#0d9488", 8)], **anim("fadeUp", .8)),
       T("أعشاب وزيوت وعسل ومنتجات عناية طبيعية مفحوصة ومضمونة. اطلب الآن وادفع عند الاستلام.", 19, "#4b6358", "start", **anim("fadeUp", .8, .1)),
       BTN("تسوّق المنتجات", bg="#16a34a", al="start", link="#products", fxs=[btngrad("#16a34a", "#65a30d", "rgba(22,163,74,.4)"), shine(k), pulse(k, "22,163,74", 2.4)], **anim("fadeUp", .8, .2)),
       W("tbadges", items="100% طبيعي\nمفحوص ومضمون", live=True, liveText="يتصفحون الآن", lmin=9, lmax=33, cbg="#ffffff", cc="#14532d", cbc="#d9f99d", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=56, va="center"),
    C([IB("leaf", "طبيعي 100%", "بلا مواد كيميائية ضارة", tc="#14532d", xc="#4b6358", isz=40, fxs=[softcard("#ffffffee", "rgba(20,83,45,.16)", 28, 24, "#ecfccb"), floaty(k + "h1", ".pb-ibi", 8, 4.2)], **anim("zoomIn", .8, .2)),
       IB("drop", "زيوت نقية", "معصورة على البارد", tc="#14532d", xc="#4b6358", isz=40, fxs=[softcard("#ffffffee", "rgba(20,83,45,.16)", 28, 24, "#ecfccb"), floaty(k + "h2", ".pb-ibi", 8, 5)], **anim("zoomIn", .8, .35))],
      w=44, va="center", pad=dm([40, 26, 40, 26]), rad=dm(40), **PH("skin_oil", "rgba(20,83,45,.05)", "rgba(20,83,45,.35)"), fxs=[sticker(k + "h", "جديد!", "#fde047", "#14532d", 96)])
], pad=dm([90, 20, 110, 20], [50, 16, 70, 16]), gap={"d": 40}, fxs=[aurora(k, "#f7fee7", "#bef26499", "#6ee7b777", "#fef08a66", 20), blobs(k, "#86efac", "#fde68a", 360, .5)])]
extra = []
store("s-fresh", "متجر طبيعي منعش", "ألوان خضراء منعشة بكرات ضوئية عائمة، حافات متموّجة، بطاقات ناعمة ترتفع، وملصق دوّار على العرض.", "صحة وعسل", k, th, hero, extra, "Almarai", "#ffffff")

# ───────── 4) بوب جريء ─────────
k = "sp"; ICC[0] = "#111111"
POPBG = lambda s: [FX("خلفية صفراء منقّطة", "selector{background-color:#fde047;background-image:radial-gradient(#11111122 1.5px,transparent 1.5px);background-size:22px 22px;animation:%sPd 20s linear infinite}@keyframes %sPd{to{background-position:44px 44px}}" % (k + s, k + s))]
POPBG2 = lambda s: [FX("خلفية بيضاء منقّطة", "selector{background-color:#ffffff;background-image:radial-gradient(#11111114 1.5px,transparent 1.5px);background-size:22px 22px}")]
th = dict(h="#111111", m="#333333", a="#ff3d81", card="#ffffff",
          bar=("★ توصيل مجاني فوق 6000 دج!  ·  الدفع عند الاستلام  ·  هدية مع كل طلب ★", "#111111", "#fde047", "#ff3d81"),
          hdr=dict(hbg="#fde047", hbr="#111111", lc="#111111", lac="#ff3d81", mc="#111111", cbg="#ff3d81"),
          mqc=("#ff3d81", "#ffffff"),
          hfx=lambda s: [FX("نص بحدّ وظلّ صلب", "selector .pb-t{color:#fff!important;-webkit-text-stroke:2px #111;text-shadow:5px 5px 0 #111;letter-spacing:1px}")],
          bgA=POPBG, bgB=POPBG2,
          cats=dict(imgs=["fashion_sneakers", "acc_pink", "fashion_shoe"], ov="#111111", ovo=25, rad=20, cols=3, fxs=[hardshadow("#111111", 7, 3, 20)]),
          prods=dict(cbg="#ffffff", bbg="#ff3d81", rad=20, fxs=[FX("بطاقة بظلّ صلب", "selector .pb-pc{border:3px solid #111;border-radius:20px;box-shadow:7px 7px 0 #111;transition:transform .18s,box-shadow .18s}selector .pb-pc:hover{transform:translate(-4px,-4px);box-shadow:11px 11px 0 #111}")]),
          fcard=lambda i: [FX("بطاقة بظلّ صلب", "selector .pb-ib{background:%s;border:3px solid #111;border-radius:20px;box-shadow:6px 6px 0 #111;padding:24px;height:100%%;box-sizing:border-box;transition:transform .18s,box-shadow .18s}selector .pb-ib:hover{transform:translate(-4px,-4px) rotate(-1.5deg);box-shadow:10px 10px 0 #111}" % ["#a5f3fc", "#fbcfe8", "#bbf7d0", "#fed7aa"][i % 4]), floaty(k + "f" + str(i), ".pb-ibi", 6, 3.6 + i * .4)],
          ctr=[FX("أرقام بحدّ صلب", "selector .pb-ctn{color:#fff;-webkit-text-stroke:2px #111;text-shadow:4px 4px 0 #111;font-weight:900}")], tsfx=[FX("رأي بظلّ صلب", "selector .pb-ts{background:#fff!important;border:3px solid #111;border-radius:20px;box-shadow:7px 7px 0 #111}"), lift(".pb-ts", "rgba(0,0,0,.2)", -6, 0)],
          offfx=[FX("لوحة العرض", "selector{background:#ff3d81;border:4px solid #111;box-shadow:10px 10px 0 #111}"), sticker(k, "خصم 30%", "#fde047", "#111", 122)],
          accfx=[accfx("#ffffff", "#111111", 14)], cdbg="#111111", cdc="#fde047", cpbg="#ffffff",
          foot=dict(sbg="#111111", tc="#d4d4d8", hc="#fde047", lc="#d4d4d8", lh="#ff3d81"))
hero = [S([
    C([W("heading", text="تسوّق بجرأة!", tag="h1", fs=dm(80, 44), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.1}, fxs=[FX("نص بحدّ وظلّ صلب", "selector .pb-t{-webkit-text-stroke:3px #111;text-shadow:7px 7px 0 #111}")], **anim("zoomIn", .8)),
       T("أحدث الصيحات بأسعار مجنونة. اطلب الآن وادفع عند الاستلام — لا مجال للمخاطرة!", 21, "#111111", "start", fw="800", **anim("fadeUp", .8, .1)),
       BTN("اطلب قبل نفاد الكمية", bg="#ff3d81", color="#ffffff", al="start", link="#products", fxs=[FX("زر بظلّ صلب", "selector .pb-btn{border:3px solid #111;box-shadow:6px 6px 0 #111;transition:transform .15s,box-shadow .15s}selector .pb-btn:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 #111}selector .pb-btn:active{transform:translate(4px,4px);box-shadow:2px 2px 0 #111}"), shine(k, 2.6)], **anim("fadeUp", .8, .2))], w=60, va="center"),
    C([W("stock", smode="manual", sn=11, smax=40, stx="⚡ بقيت {n} قطع فقط!", color="#111111", sbgc="#ffffff", fs=dm(20, 16), fxs=[stockbar(k), FX("لوحة", "selector{background:#fff;border:3px solid #111;border-radius:20px;box-shadow:7px 7px 0 #111;padding:20px}")], **anim("zoomIn", .8, .3)),
       W("countdown", mode="daily", cbg="#111111", color="#fde047", fs=dm(38, 26), crad=dm(12), al={"d": "center"}, fxs=[cdglow(k, "#ff3d81")], **anim("zoomIn", .8, .4))], w=40, va="center", pad=dm([200, 24, 24, 24]), rad=dm(26), **PH("fashion_sneakers", "rgba(0,0,0,0)", "rgba(0,0,0,.25)", pos="center"), fxs=[sticker(k + "h", "HOT!", "#a5f3fc", "#111", 96), FX("إطار أسود", "selector{border:4px solid #111;box-shadow:8px 8px 0 #111}")]),
], pad=dm([80, 20, 90, 20], [46, 16, 56, 16]), gap={"d": 36}, fxs=POPBG("h"))]
extra = [S([C([W("heading", text="لماذا نحن؟", tag="h2", fs=dm(44, 30), fw="900", ta={"d": "center"}, color="#ffffff", fxs=[FX("نص بحدّ وظلّ صلب", "selector .pb-t{-webkit-text-stroke:2px #111;text-shadow:5px 5px 0 #111}")], **anim("fadeUp")),
               W("bullets", items="أسعار لا تُقاوَم\nمنتجات أصلية 100%\nتوصيل سريع لكل الولايات\nالدفع عند الاستلام فقط\nاستبدال سهل خلال 7 أيام", micon="ic:star", mc="#ff3d81", ms=dm(26), gap=dm(14), fs=dm(21, 17), color="#111111", fw="800", manim="pop", **anim("fadeUp", .7, .1))], w=100)],
          pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), cw={"d": 760}, fxs=[FX("خلفية سماوية", "selector{background:#a5f3fc;border-top:4px solid #111;border-bottom:4px solid #111}")])]
store("s-pop", "متجر بوب جريء", "ألوان صاخبة وإطارات سوداء وظلال صلبة تتحرك بالمرور، ملصقات دوّارة وعناوين بحدّ ونقاط خلفية متحركة.", "أزياء وترفيه", k, th, hero, extra, "Changa", "#ffffff")

# ───────── 5) تقني بسيط ─────────
k = "st"; ICC[0] = "#2563eb"
th = dict(h="#0f172a", m="#64748b", a="#2563eb", card="#ffffff",
          bar=("⚡ شحن سريع  ·  ضمان سنة  ·  الدفع عند الاستلام  ·  دعم فني على واتساب", "#0f172a", "#e2e8f0", "#60a5fa"),
          hdr=dict(hbg="#ffffff", hbr="#e2e8f0", lc="#0f172a", lac="#2563eb", mc="#0f172a", cbg="#2563eb"),
          mqc=("#0f172a", "#e2e8f0"),
          hfx=lambda s: [gradtext(k + s, "#2563eb", "#7c3aed", "#0ea5e9", 7)],
          bgA=lambda s: [gridbg(k + s, "rgba(37,99,235,.07)", 46)],
          bgB=lambda s: [FX("خلفية رمادية فاتحة", "selector{background:#f8fafc}")],
          cats=dict(imgs=["it_pc", "it_laptop", "it_code"], ov="#0f172a", ovo=40, rad=20, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(37,99,235,.35)", -8, 3)]),
          prods=dict(cbg="#ffffff", bbg="#2563eb", rad=20, fxs=[lift(".pb-pc", "rgba(37,99,235,.28)", -10, 2), FX("بطاقة بحد خفيف", "selector .pb-pc{border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,.06)}")]),
          fcard=lambda i: [softcard("#ffffff", "rgba(15,23,42,.08)", 20, 26, "#e2e8f0"), sheen(k + str(i), ".pb-ib", "rgba(37,99,235,.18)"), lift(".pb-ib", "rgba(37,99,235,.25)", -8, 3), floaty(k + "f" + str(i), ".pb-ibi", 6, 4 + i * .5)],
          ctr=[ctrcolor("#2563eb", "#7c3aed")], tsfx=[tscard("#ffffff", "#e2e8f0", 20, None), lift(".pb-ts", "rgba(37,99,235,.25)", -8)],
          offfx=[aurora(k + "o", "#0f172a", "#2563eb99", "#7c3aed77", "#0ea5e955", 12), rotborder(k, "#60a5fa", "#c084fc", 2, 5, 34)],
          accfx=[accfx("#ffffff", "#e2e8f0", 14)],
          foot=dict(sbg="#0f172a", tc="#94a3b8", hc="#ffffff", lc="#94a3b8", lh="#60a5fa"), cdbg="#00000066", cdc="#ffffff")
hero = [S([C([
    T("✦ جديد — الجيل القادم", 15, "#2563eb", "center", fw="800", **anim("fadeDown")),
    W("heading", text="تقنية تُبسّط يومك، بسعر يناسبك", tag="h1", fs=dm(62, 34), fw="900", ta={"d": "center"}, color="#0f172a", lh={"d": 1.2}, fxs=[gradtext(k, "#2563eb", "#7c3aed", "#0ea5e9", 6)], **anim("fadeUp", .8)),
    T("أجهزة وإكسسوارات أصلية بضمان، مع توصيل سريع ودفع عند الاستلام ودعم فني على واتساب.", 20, "#64748b", **anim("fadeUp", .8, .1)),
    BTN("تصفّح المنتجات", bg="#2563eb", link="#products", fxs=[btngrad("#2563eb", "#7c3aed", "rgba(37,99,235,.45)"), shine(k), pulse(k, "37,99,235", 2.4)], **anim("zoomIn", .8, .2)),
    PIC("it_color", "جهاز بتصميم أنيق", 30, w=dm(78, 100), al={"d": "center"}, fxs=[FX("طفو الصورة", "selector img{animation:stPf 6s ease-in-out infinite}@keyframes stPf{50%{transform:translateY(-12px)}}"), FX("ظل ناعم", "selector{filter:drop-shadow(0 40px 60px rgba(37,99,235,.35))}")], **anim("fadeUp", .9, .4)),
], w=100)], cw={"d": 900}, pad=dm([110, 20, 50, 20], [60, 16, 30, 16]), fxs=[gridbg(k, "rgba(37,99,235,.08)", 46), spotlight(k, "rgba(37,99,235,.18)")]),
    S([C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(40, 26), color="#2563eb", lc="#64748b", fxs=[ctrcolor("#2563eb", "#7c3aed")], **anim("fadeUp", .6, .1 + i * .1))], w=25)
        for i, (n, p, s, l) in enumerate([(12000, "+", "", "عميل راضٍ"), (365, "", "", "يوم ضمان"), (48, "", "h", "أقصى مدة توصيل"), (4.9, "", "/5", "التقييم")])],
      cw={"d": 960}, pad=dm([30, 28, 30, 28], [24, 16, 24, 16]), mar=dm([0, 20, 70, 20], [0, 12, 40, 12]), rad=dm(28), gap={"d": 16},
      fxs=[FX("لوحة عائمة", "selector{background:#fff;box-shadow:0 30px 80px rgba(37,99,235,.15)}"), rotborder(k + "x", "#2563eb", "#c084fc", 2, 6, 28)])]
extra = [S([C([W("heading", text="قارن واختر الأفضل", tag="h2", fs=dm(38, 28), fw="900", ta={"d": "center"}, color="#0f172a", fxs=[gradtext(k + "t", "#2563eb", "#7c3aed", "#0ea5e9", 7)], **anim("fadeUp")),
               W("table", tbl="الميزة | متجرنا | غيرنا\nضمان سنة كاملة | ✔ | ✘\nالدفع عند الاستلام | ✔ | ✘\nدعم فني على واتساب | ✔ | ✘\nاستبدال خلال 7 أيام | ✔ | ✘", thead=True, tzb=True, thbg="#2563eb", thc="#ffffff", tbd="#e2e8f0", tbfs=dm(17), tbal="center", fxs=[FX("جدول بزوايا ناعمة", "selector table{border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,.08)}")], **anim("fadeUp", .8, .1))], w=100)],
          cw={"d": 820}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=[gridbg(k + "c", "rgba(37,99,235,.06)", 46)])]
store("s-tech", "متجر تقني بسيط", "أبيض أنيق بشبكة خلفية متحركة وبقعة ضوء، لوحة أرقام بإطار دوّار، جدول مقارنة وبطاقات تلمع بالمرور.", "إلكترونيات", k, th, hero, extra, "Noto Kufi Arabic", "#ffffff")
