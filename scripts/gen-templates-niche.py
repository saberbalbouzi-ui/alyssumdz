# ═════════ قوالب المتاجر المتخصصة بالمجال (11) ═════════
def TH(k, dark, h, m, a, a2, card, bgA, bgB, foot, offfx, hdrc, barc, mqc, **o):
    th = dict(h=h, m=m, a=a, card=card, bar=barc, hdr=hdrc, mqc=mqc, foot=foot, offfx=offfx)
    th["hfx"] = o.get("hfx") or (lambda s: [gradtext(k + s, a, a2, a, 7)])
    th["bgA"] = (lambda s: bgA) if isinstance(bgA, list) else bgA
    th["bgB"] = (lambda s: bgB) if isinstance(bgB, list) else bgB
    th["ctr"] = o.get("ctr") or [ctrcolor(a, a2)]
    th["tsfx"] = o.get("tsfx") or ([tscard("rgba(255,255,255,.07)", "rgba(255,255,255,.2)", 22, "#f1f5f9")] if dark else [tscard("#ffffff", "#eee", 22, None)]) + [lift(".pb-ts", "rgba(0,0,0,.25)", -8)]
    th["fcard"] = o.get("fcard") or (lambda i: ([cardgrid(), sheen(k + str(i), ".pb-ib")] if dark else [softcard("#ffffff", "rgba(0,0,0,.08)", 22, 24, "#00000010")]) + [lift(".pb-ib", "rgba(0,0,0,.25)", -6, 3), floaty(k + "f" + str(i), ".pb-ibi", 6, 4 + i * .5)])
    th["accfx"] = o.get("accfx") or [accfx("rgba(255,255,255,.07)" if dark else "#ffffff", "rgba(255,255,255,.18)" if dark else "#00000014", 16)]
    th["cats"] = o.get("cats") or dict(ov="#000000", ovo=45, rad=24, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(0,0,0,.3)", -8, 3)])
    th["prods"] = o.get("prods") or dict(cbg="#ffffff", bbg=a, rad=22, fxs=[lift(".pb-pc", "rgba(0,0,0,.28)", -10, 3)])
    th["cdbg"] = o.get("cdbg", "#00000066"); th["cdc"] = o.get("cdc", "#ffffff")
    th["offc"] = o.get("offc", "#ffffff"); th["offm"] = o.get("offm", "#e2e8f0"); th["cpbg"] = o.get("cpbg", "#ffffff18")
    return th
def prodsec(k, th, ttl="منتجاتنا المميّزة", sub="الأكثر طلباً هذا الأسبوع", fxs=None):
    return S([title(ttl, sub, k, th, th["hfx"]("p")), C([prodsw(**th["prods"])], w=100)], pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=fxs or th["bgB"]("p"))
def catsec(k, th, ttl="تسوّق حسب الفئة", sub="اختر ما يناسبك"):
    return S([title(ttl, sub, k, th, th["hfx"]("c")), C([cats(**th["cats"])], w=100)], pad=dm([60, 20, 20, 20], [40, 16, 16, 16]), fxs=th["bgA"]("c"))
def tail(k, th, vals=None, skipstats=False):
    vals = vals or [(12000, "+", "", "طلب مُسلَّم"), (58, "", "", "ولاية نغطيها"), (98, "", "%", "رضا الزبائن"), (24, "", "h", "متوسط التوصيل")]
    L = []
    if not skipstats:
        L.append(S(stats(th, vals, th["ctr"]), pad=dm([50, 20, 20, 20], [34, 16, 16, 16]), gap={"d": 16}, fxs=th["bgB"]("d")))
    L.append(S(tests(th, th["tsfx"]), pad=dm([20, 20, 60, 20], [16, 16, 40, 16]), gap={"d": 20}, fxs=th["bgB"]("e")))
    L.append(offer(k, th, th["offfx"], th["offc"], th["offm"]))
    L.append(faq(th, th["bgA"]("f"), th["accfx"]))
    L.append(foot(**th["foot"]))
    return L
def feat(k, th, items, w=25, pb=0):
    return S([C([IB(ic, t, x, tc=th["h"], xc=th["m"], isz=38, fxs=th["fcard"](i), **anim("fadeUp", .7, .08 + i * .1))], w=w, pad=dm([0, 0, pb, 0])) for i, (ic, t, x) in enumerate(items)], pad=dm([40, 20, 60, 20], [28, 16, 40, 16]), gap={"d": 18}, fxs=th["bgA"]("f"))
def niche(id, n, d, fld, ff, pagebg, secs):
    reg(id, "store", fld, n, d, secs, {"ff": "'%s',sans-serif" % ff, "bg": pagebg, "header": False, "footer": False})
def bullets(items, ic, color, tc, fs=19, **x):
    return W("bullets", items=items, micon="ic:" + ic, mc=color, ms=dm(24), gap=dm(14), fs=dm(fs, 16), color=tc, manim="pop", **x)

# ───────── 1) تجميل وعناية ─────────
k = "nc"; ICC[0] = "#e11d77"
ROSEBG = "selector{background:linear-gradient(180deg,#fff5f7,#ffe9f0)}"
th = TH(k, False, "#4a1d33", "#8a5a6e", "#e11d77", "#a855f7", "#ffffff",
        [FX("خلفية وردية", ROSEBG)], [FX("خلفية كريمية", "selector{background:#fffafb}")],
        dict(sbg="#3b1327", tc="#f5c8da", hc="#ffffff", lc="#f5c8da", lh="#f9a8d4"),
        [aurora(k + "o", "#4a1d33", "#e11d7799", "#a855f777", "#fbbf2455", 12), sticker(k, "عيّنة مجانية", "#fde68a", "#4a1d33", 118)],
        dict(hbg="#fff5f7", hbr="#fbcfe8", lc="#4a1d33", lac="#e11d77", mc="#4a1d33", cbg="#e11d77"),
        ("✿ عيّنة مجانية مع كل طلب  ·  توصيل لكل الولايات  ·  الدفع عند الاستلام", "#4a1d33", "#ffe4ee", "#f9a8d4"), ("#fbcfe8", "#4a1d33"),
        cats=dict(ov="#9d174d", ovo=45, rad=40, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(225,29,119,.35)", -8, 3)]),
        prods=dict(cbg="#ffffff", bbg="#e11d77", rad=34, fxs=[lift(".pb-pc", "rgba(225,29,119,.3)", -10, 2), FX("بطاقة وردية", "selector .pb-pc{border:1px solid #fbcfe8;box-shadow:0 14px 40px rgba(225,29,119,.12)}")]),
        cpbg="#ffffff22", cdc="#fde68a")
orb = FX("كرة عناية سائلة تتحوّل", "selector{position:relative;min-height:470px}selector::before{content:\"\";position:absolute;inset:6% 4%;background:radial-gradient(circle at 30% 28%,#fff,#fbcfe8 38%,#f472b6 72%,#be185d);border-radius:58% 42% 46% 54%/52% 48% 52% 48%;animation:ncMorph 10s ease-in-out infinite alternate;box-shadow:0 50px 100px rgba(225,29,119,.35),inset -20px -30px 60px rgba(190,24,93,.35)}selector::after{content:\"\";position:absolute;inset:2% 0;border-radius:50%;border:1.5px dashed rgba(225,29,119,.35);animation:ncSpin 36s linear infinite}@keyframes ncMorph{to{border-radius:44% 56% 58% 42%/58% 42% 58% 42%;transform:rotate(8deg) scale(1.04)}}@keyframes ncSpin{to{transform:rotate(360deg)}}")
glassrose = lambda dl: [glass("rgba(255,255,255,.55)", "rgba(255,255,255,.9)", 16, 22), floaty(k + dl, ".pb-ibi", 8, 4.6)]
hero = S([
    C([T("✿ علم الجمال الطبيعي", 15, "#e11d77", "start", fw="800", **anim("fadeDown")),
       W("heading", text="بشرة تتوهّج بروتين عناية يليق بكِ", tag="h1", fs=dm(58, 34), fw="900", ta={"d": "start"}, color="#4a1d33", lh={"d": 1.25}, fxs=[gradtext(k, "#e11d77", "#a855f7", "#f59e0b", 8)], **anim("fadeUp", .8)),
       T("مستحضرات تجميل وعناية آمنة ومختبرة بمكوّنات فعّالة. اكتشفي روتينك المثالي واطلبي الآن وادفعي عند الاستلام.", 19, "#8a5a6e", "start", **anim("fadeUp", .8, .1)),
       BTN("اكتشفي المجموعة", bg="#e11d77", al="start", link="#products", fxs=[btngrad("#e11d77", "#a855f7", "rgba(225,29,119,.45)"), shine(k), pulse(k, "225,29,119", 2.4)], **anim("fadeUp", .8, .2)),
       W("tbadges", items="بدون بارابين\nمختبر جلدياً\nنباتي 100%", live=True, liveText="يتسوّقن الآن", lmin=18, lmax=52, cbg="#ffffffcc", cc="#4a1d33", cbc="#fbcfe8", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=54, va="center"),
    C([IB("drop", "ترطيب 24 ساعة", "عمق وإشراقة", tc="#4a1d33", xc="#8a5a6e", isz=34, fxs=glassrose("a"), w=dm(70), al={"d": "start"}, **anim("zoomIn", .8, .2)),
       IB("sparkle", "إشراقة فورية", "نتيجة من أول استعمال", tc="#4a1d33", xc="#8a5a6e", isz=34, fxs=glassrose("b"), w=dm(70), al={"d": "end"}, **anim("zoomIn", .8, .35))], w=46, va="center", fxs=[orb])
], pad=dm([90, 20, 100, 20], [50, 16, 56, 16]), gap={"d": 36}, fxs=[aurora(k, "#fff5f7", "#fbcfe899", "#e9d5ff77", "#fde68a66", 20), blobs(k, "#f9a8d4", "#ddd6fe", 340, .5)])
steps = S([C([W("heading", text="روتين العناية في 3 خطوات", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#4a1d33", fxs=[gradtext(k + "r", "#e11d77", "#a855f7", "#f59e0b", 8)], **anim("fadeUp")), T("بسيط، سريع ومثبت النتائج.", 17, "#8a5a6e", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0]))]
          + [C([IB(ic, t, x, tc="#4a1d33", xc="#8a5a6e", isz=40, fxs=[softcard("#ffffff", "rgba(225,29,119,.12)", 30, 26, "#fce7f3"), tiltcol([-2, 0, 2][i]), floaty(k + "s" + str(i), ".pb-ibi", 6, 4 + i * .5)], **anim("fadeUp", .7, .1 + i * .15))], w=33, pad=dm([0, 0, 20, 0])) for i, (ic, t, x) in enumerate([("drop", "1 · نظّفي", "غسول لطيف يزيل الشوائب بلا جفاف"), ("sparkle", "2 · غذّي", "سيروم مركّز بمكوّنات فعّالة"), ("sun", "3 · احمي", "كريم نهاري بحماية وترطيب")])],
         pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=[FX("خلفية كريمية", "selector{background:#fffafb}")])
ingr = S([C([W("heading", text="مكوّنات فعّالة، نتائج ملموسة", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color="#4a1d33", **anim("fadeUp")),
            bullets("حمض الهيالورونيك لترطيب عميق\nفيتامين C لإشراقة موحّدة\nنياسيناميد لتقليل المسام\nزيوت نباتية مغذّية", "check-circle", "#e11d77", "#4a1d33", **anim("fadeUp", .7, .1))], w=50, va="center"),
          C([W("progress", pl="الترطيب", pv=96, pc="#e11d77", pbg="#fce7f3", ph=dm(14), color="#4a1d33", fxs=[barfx("#e11d77", "#a855f7")], **anim("fadeUp", .6, .1)),
             W("progress", pl="إشراقة البشرة", pv=91, pc="#e11d77", pbg="#fce7f3", ph=dm(14), color="#4a1d33", fxs=[barfx("#f59e0b", "#e11d77")], **anim("fadeUp", .6, .2)),
             W("progress", pl="نعومة الملمس", pv=94, pc="#e11d77", pbg="#fce7f3", ph=dm(14), color="#4a1d33", fxs=[barfx("#a855f7", "#e11d77")], **anim("fadeUp", .6, .3))], w=50, va="center")],
         pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 40}, fxs=[aurora(k + "i", "#fff5f7", "#fbcfe888", "#e9d5ff66", "#fde68a55", 22)])
niche("s-cosmetics", "متجر تجميل — روز كريستال", "وردي ناعم بكرة عناية سائلة متحوّلة، روتين من 3 خطوات، شرائط مكوّنات متحركة وبطاقات مائلة تستقيم بالمرور.", "تجميل وعناية", "Almarai", "#fffafb",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq(MQ, *th["mqc"]), steps, catsec(k, th), prodsec(k, th), ingr, feat(k, th, ICONS4)] + tail(k, th))

# ───────── 2) مكملات غذائية ─────────
k = "nu"; ICC[0] = "#a3e635"
NAVY = lambda s: [FX("خلفية داكنة بوهج ليموني", "selector{background:radial-gradient(60% 70% at 85% 0%,rgba(163,230,53,.14),transparent 60%),radial-gradient(50% 60% at 5% 100%,rgba(34,211,238,.12),transparent 60%),#05070d}")]
th = TH(k, True, "#ffffff", "#9ca3af", "#a3e635", "#22d3ee", "#ffffff10", NAVY, NAVY,
        dict(sbg="#020306", tc="#9ca3af", hc="#ffffff", lc="#9ca3af", lh="#a3e635"),
        [aurora(k + "o", "#0b1220", "#a3e63566", "#22d3ee55", "#8b5cf644", 10), rotborder(k, "#a3e635", "#22d3ee", 2, 4, 34)],
        dict(hbg="#05070d", hbr="#ffffff1a", lc="#ffffff", lac="#a3e635", mc="#e5e7eb", cbg="#65a30d"),
        ("⚡ شحن مجاني فوق 6000 دج  ·  منتجات أصلية ومرخّصة  ·  الدفع عند الاستلام", "#a3e635", "#0b1220", "#0b1220"), ("#0b1220", "#a3e635"),
        prods=dict(cbg="#ffffff", bbg="#65a30d", rad=18, fxs=[lift(".pb-pc", "rgba(163,230,53,.35)", -10, 3)]),
        cats=dict(ov="#05070d", ovo=55, rad=18, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(163,230,53,.35)", -8, 3)]), cdc="#a3e635")
hero = S([
    C([T("⚡ طاقة · تركيز · تعافٍ", 15, "#a3e635", "start", fw="900", **anim("fadeDown")),
       W("heading", text="أداء بلا حدود، من أول جرعة", tag="h1", fs=dm(64, 36), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.15}, fxs=[gradtext(k, "#a3e635", "#22d3ee", "#a3e635", 5)], **anim("fadeUp", .8)),
       T("مكمّلات غذائية موثوقة بتركيبات مدروسة تدعم نشاطك الرياضي واليومي. شهادات جودة وتوصيل سريع.", 19, "#9ca3af", "start", **anim("fadeUp", .8, .1)),
       BTN("ابدأ رحلتك", bg="#a3e635", color="#0b1220", al="start", link="#products", fxs=[btngrad("#a3e635", "#22d3ee", "rgba(163,230,53,.5)"), shine(k), pulse(k, "163,230,53", 2)], **anim("zoomIn", .8, .2)),
       W("tbadges", items="شهادة جودة\nبدون مواد محظورة", live=True, liveText="يطلبون الآن", lmin=21, lmax=64, cbg="#ffffff12", cc="#e5e7eb", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=54, va="center"),
    C([W("heading", text="لوحة النتائج", tag="h3", fs=dm(22, 20), fw="900", ta={"d": "start"}, color="#a3e635", **anim("fadeUp")),
       W("progress", pl="الطاقة", pv=92, pc="#a3e635", pbg="#ffffff1a", ph=dm(14), color="#e5e7eb", fxs=[barfx("#a3e635", "#22d3ee")], **anim("fadeUp", .6, .1)),
       W("progress", pl="التركيز", pv=88, pc="#a3e635", pbg="#ffffff1a", ph=dm(14), color="#e5e7eb", fxs=[barfx("#22d3ee", "#a3e635")], **anim("fadeUp", .6, .2)),
       W("progress", pl="التعافي العضلي", pv=95, pc="#a3e635", pbg="#ffffff1a", ph=dm(14), color="#e5e7eb", fxs=[barfx("#a3e635", "#facc15")], **anim("fadeUp", .6, .3)),
       W("progress", pl="الامتصاص", pv=97, pc="#a3e635", pbg="#ffffff1a", ph=dm(14), color="#e5e7eb", fxs=[barfx("#22d3ee", "#a855f7")], **anim("fadeUp", .6, .4))],
      w=46, va="center", pad=dm([30, 30, 20, 30]), fxs=[glass("rgba(255,255,255,.06)", "rgba(163,230,53,.35)", 18, 24), scan(k, "rgba(163,230,53,.9)")])
], pad=dm([90, 20, 90, 20], [50, 16, 50, 16]), gap={"d": 40}, fxs=[aurora(k, "#05070d", "#a3e63544", "#22d3ee33", "#8b5cf633", 16), gridbg(k, "rgba(163,230,53,.05)", 48)])
how = S([C([W("heading", text="كيف تعمل تركيباتنا؟", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#ffffff", fxs=[gradtext(k + "h", "#a3e635", "#22d3ee", "#a3e635", 6)], **anim("fadeUp"))], w=100, pad=dm([0, 0, 24, 0]))]
        + [C([IB(ic, t, x, tc="#ffffff", xc="#9ca3af", isz=44, fxs=[FX("بطاقة سداسية مضيئة", "selector .pb-ib{background:linear-gradient(160deg,rgba(163,230,53,.12),rgba(34,211,238,.06));border:1px solid rgba(163,230,53,.3);border-radius:22px;padding:28px;height:100%;box-sizing:border-box;clip-path:polygon(0 0,100% 0,100% 88%,88% 100%,0 100%)}"), lift(".pb-ib", "rgba(163,230,53,.3)", -8), floaty(k + "w" + str(i), ".pb-ibi", 6, 4 + i * .6)], **anim("fadeUp", .7, .1 + i * .15))], w=33, pad=dm([0, 0, 20, 0])) for i, (ic, t, x) in enumerate([("pill", "1 · تركيبة مدروسة", "عناصر نشطة بجرعات فعّالة"), ("zap", "2 · امتصاص سريع", "تقنية تُسرّع وصول المغذّيات"), ("trophy", "3 · نتائج ملموسة", "أداء وتعافٍ أفضل خلال أسابيع")])],
       pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=NAVY("h"))
cmp_ = S([C([W("heading", text="لماذا نحن؟", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#ffffff", **anim("fadeUp")),
             W("table", tbl="الميزة | متجرنا | غيرنا\nمنتجات أصلية ومرخّصة | ✔ | ✘\nتحاليل جودة منشورة | ✔ | ✘\nدفع عند الاستلام | ✔ | ✘\nاستشارة تغذية مجانية | ✔ | ✘", thead=True, tzb=True, thbg="#65a30d", thc="#05070d", tbd="#ffffff22", tbfs=dm(17), tbal="center", fxs=[FX("جدول داكن", "selector table{color:#e5e7eb;background:#0b1220;border-radius:16px;overflow:hidden;border:1px solid rgba(163,230,53,.3)}")], **anim("fadeUp", .8, .1))], w=100)],
         cw={"d": 820}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=NAVY("t"))
niche("s-supplements", "متجر مكملات غذائية — فيتال أكتيف", "أسود وليموني نيون بلوحة نتائج متحركة، شرائط تقدّم لامعة، بطاقات مشطوبة الزاوية وجدول مقارنة.", "مكملات غذائية", "Tajawal", "#05070d",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("بروتين   ✦   كرياتين   ✦   أوميغا 3   ✦   فيتامينات   ✦   BCAA   ✦   مغنيسيوم   ✦   كولاجين", *th["mqc"]), how, catsec(k, th), prodsec(k, th), cmp_] + tail(k, th))

# ───────── 3) عسل ─────────
k = "nh"; ICC[0] = "#b45309"
HONEY = lambda s: [honeycomb("#f59e0b", .16, "#fff7df")]
th = TH(k, False, "#5a3411", "#8a6a3c", "#d97706", "#92400e", "#ffffff", HONEY, [FX("خلفية كريمية", "selector{background:#fffbf0}")],
        dict(sbg="#3a2108", tc="#e8d3a8", hc="#ffffff", lc="#e8d3a8", lh="#fbbf24"),
        [honeycomb("#fbbf24", .22, "#7c2d12"), sticker(k, "عسل خام 100%", "#fbbf24", "#5a3411", 120)],
        dict(hbg="#fff7df", hbr="#fde68a", lc="#5a3411", lac="#d97706", mc="#5a3411", cbg="#d97706"),
        ("🍯 عسل طبيعي مفحوص  ·  توصيل لكل الولايات  ·  الدفع عند الاستلام", "#5a3411", "#fef3c7", "#fbbf24"), ("#d97706", "#fffbeb"),
        hfx=lambda s: [gradtext(k + s, "#5a3411", "#d97706", "#5a3411", 8)],
        prods=dict(cbg="#fffdf6", bbg="#d97706", rad=26, fxs=[lift(".pb-pc", "rgba(217,119,6,.35)", -10, 2), FX("بطاقة عسلية", "selector .pb-pc{border:1.5px solid #fde68a;box-shadow:0 14px 36px rgba(217,119,6,.14)}")]),
        cats=dict(ov="#5a3411", ovo=45, rad=30, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(217,119,6,.35)", -8, 3)]), cdc="#fbbf24")
hero = S([
    C([T("🍯 من الخلية مباشرة", 15, "#b45309", "start", fw="800", **anim("fadeDown")),
       W("heading", text="ذهبٌ سائل من قلب الطبيعة", tag="h1", fs=dm(62, 36), fw="900", ta={"d": "start"}, color="#5a3411", lh={"d": 1.2}, fxs=[gradtext(k, "#5a3411", "#d97706", "#5a3411", 8)], **anim("fadeUp", .8)),
       T("عسل خام غير مُسخَّن من أجود المناحل، مفحوص ومضمون الأصل. اكتشف النكهات والفوائد واطلب بكل ثقة.", 19, "#8a6a3c", "start", **anim("fadeUp", .8, .1)),
       BTN("تذوّق الآن", bg="#d97706", al="start", link="#products", fxs=[btngrad("#f59e0b", "#b45309", "rgba(217,119,6,.45)"), shine(k), pulse(k, "217,119,6", 2.4)], **anim("fadeUp", .8, .2)),
       W("tbadges", items="خام 100%\nمفحوص مخبرياً\nبدون سكر مضاف", live=True, liveText="يتذوّقون الآن", lmin=10, lmax=38, cbg="#ffffffd0", cc="#5a3411", cbc="#fde68a", crad=dm(999), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=56, va="center"),
    C([W("counter", n=100, suf="%", label="عسل طبيعي خام", fs=dm(70, 48), color="#b45309", lc="#5a3411", al={"d": "center"}, fxs=[ctrcolor("#f59e0b", "#92400e")], **anim("zoomIn", .8, .2)),
       T("مفحوص • غير مُسخَّن • بلا إضافات", 16, "#8a6a3c", **anim("fadeUp", .8, .3))], w=44, va="center", pad=dm([36, 24, 36, 24]),
      fxs=[FX("قرص عسلي زجاجي", "selector{background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.9),rgba(253,230,138,.85) 60%,rgba(245,158,11,.75));border-radius:46% 54% 52% 48%/54% 46% 54% 46%;box-shadow:0 40px 90px rgba(217,119,6,.35),inset 0 2px 0 rgba(255,255,255,.8);animation:nhB 9s ease-in-out infinite alternate}@keyframes nhB{to{border-radius:54% 46% 48% 52%/46% 54% 46% 54%;transform:translateY(-10px)}}")])
], pad=dm([90, 20, 110, 20], [50, 16, 60, 16]), gap={"d": 36}, fxs=[honeycomb("#f59e0b", .18, "#fff3cf"), drip(k, "#f59e0b", 46)])
journey = S([C([W("heading", text="من الخلية إلى بيتك", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#5a3411", fxs=[gradtext(k + "j", "#5a3411", "#d97706", "#5a3411", 8)], **anim("fadeUp")), T("أربع محطات تضمن لك النقاء والطعم الأصيل.", 17, "#8a6a3c", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 28, 0]))]
            + [C([IB(ic, t, x, tc="#5a3411", xc="#8a6a3c", isz=40, fxs=[softcard("#ffffff", "rgba(217,119,6,.16)", 26, 24, "#fde68a"), lift(".pb-ib", "rgba(217,119,6,.3)", -8, 3), floaty(k + "j" + str(i), ".pb-ibi", 7, 4 + i * .5)], **anim("fadeUp", .7, .1 + i * .12))], w=25, pad=dm([0, 0, 20, 0])) for i, (ic, t, x) in enumerate([("sprout", "المنحل", "مواقع نقية بعيدة عن التلوث"), ("flower", "الرحيق", "من أزهار برية ومواسم محددة"), ("shield-check", "الفحص", "تحاليل نقاء قبل التعبئة"), ("truck", "التوصيل", "إلى باب بيتك بتغليف آمن")])],
           pad=dm([70, 20, 60, 20], [44, 16, 40, 16]), gap={"d": 16}, fxs=[FX("خلفية كريمية", "selector{background:#fffbf0}"), timeline("#f59e0b")])
niche("s-honey", "متجر عسل — ذهب الخلية", "خلايا نحل سداسية متحركة، قطرات عسل تنساب من القسم، قرص عسلي زجاجي، ورحلة من الخلية إلى البيت.", "عسل", "Almarai", "#fffbf0",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, S([C([])], pad=dm([26, 0, 26, 0]), fxs=[FX("فاصل كريمي", "selector{background:#fffbf0}")]), mq("عسل السدر   ✦   عسل الجبل   ✦   عسل الأزهار   ✦   عسل الخرّوب   ✦   عسل الكالبتوس   ✦   غذاء ملكات", *th["mqc"]), journey, catsec(k, th), prodsec(k, th), feat(k, th, ICONS4)] + tail(k, th))

# ───────── 4) أعشاب وزيوت ─────────
k = "nb"; ICC[0] = "#3f6212"
PAPER = lambda s: [paper("#f3ead7")]
th = TH(k, False, "#2f4a12", "#6b5b3a", "#4d7c0f", "#78350f", "#fffaf0", PAPER, [paper("#f8f1df")],
        dict(sbg="#1f2f0a", tc="#d9d5b8", hc="#ffffff", lc="#d9d5b8", lh="#bef264"),
        [paper("#2f4a12", "0.9,0.9,0.7", .12), ribbon("طبيعي 100%", "#bef264", "#1f2f0a")],
        dict(hbg="#f3ead7", hbr="#d6c9a2", lc="#2f4a12", lac="#78350f", mc="#2f4a12", cbg="#4d7c0f"),
        ("🌿 أعشاب وزيوت نقية  ·  بلا إضافات كيميائية  ·  الدفع عند الاستلام", "#2f4a12", "#f3ead7", "#bef264"), ("#4d7c0f", "#f3ead7"),
        hfx=lambda s: [gradtext(k + s, "#3f6212", "#78350f", "#3f6212", 9)],
        prods=dict(cbg="#fffaf0", bbg="#4d7c0f", rad=14, fxs=[lift(".pb-pc", "rgba(77,124,15,.3)", -8, 2), FX("بطاقة ورقية", "selector .pb-pc{border:1.5px solid #d6c9a2;box-shadow:0 10px 28px rgba(80,60,20,.12)}")]),
        cats=dict(ov="#2f4a12", ovo=50, rad=16, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(77,124,15,.35)", -8, 2)]), cdc="#bef264", offc="#f3ead7", offm="#e5e7d0")
label_fx = FX("لصيقة صيدلية عشبية", "selector{background:#fffaf0;border:2px solid #3f6212;outline:1px solid #3f6212;outline-offset:-10px;border-radius:6px;box-shadow:0 30px 60px rgba(60,50,20,.25);text-align:center}selector::before{content:\"✦ ✦ ✦\";position:absolute;top:14px;inset-inline:0;text-align:center;color:#78350f;letter-spacing:12px;font-size:14px}")
hero = S([C([
    T("— صيدلية الطبيعة —", 15, "#78350f", "center", fw="800", **anim("fadeDown")),
    W("heading", text="أعشاب وزيوت أصيلة بخبرة الأجداد", tag="h1", fs=dm(56, 32), fw="900", ta={"d": "center"}, color="#2f4a12", lh={"d": 1.3}, fxs=[gradtext(k, "#3f6212", "#78350f", "#3f6212", 9)], **anim("fadeUp", .8)),
    T("نختار أجود الأعشاب ونعصر الزيوت على البارد لنوصلها إليك نقية كما خلقها الله، مع دليل استعمال لكل منتج.", 19, "#6b5b3a", **anim("fadeUp", .8, .1)),
    BTN("تصفّح العطّار", bg="#4d7c0f", link="#products", fxs=[btngrad("#4d7c0f", "#3f6212", "rgba(77,124,15,.4)"), shine(k)], **anim("zoomIn", .8, .2)),
    W("tbadges", items="بدون مواد حافظة\nعصر على البارد\nمخبري الفحص", live=False, cbg="#f8f1df", cc="#2f4a12", cbc="#bfae7b", crad=dm(6), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeUp", .8, .3))], w=100, pad=dm([50, 30, 50, 30]), fxs=[label_fx])],
    cw={"d": 860}, pad=dm([80, 20, 90, 20], [46, 16, 50, 16]), fxs=[paper("#efe3c6"), floaty(k + "x", "::after", 0, 0)] if False else [paper("#efe3c6")])
benefits = S([C([W("heading", text="فوائد من الطبيعة", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#2f4a12", fxs=[gradtext(k + "b", "#3f6212", "#78350f", "#3f6212", 9)], **anim("fadeUp"))], w=100, pad=dm([0, 0, 24, 0]))]
          + [C([IB(ic, t, x, tc="#2f4a12", xc="#6b5b3a", isz=38, fxs=[softcard("#fffaf0", "rgba(80,60,20,.1)", 8, 24, "#d6c9a2"), lift(".pb-ib", "rgba(77,124,15,.25)", -6, 2), floaty(k + "g" + str(i), ".pb-ibi", 6, 4 + i * .4)], **anim("fadeUp", .7, .08 + i * .08))], w=33, pad=dm([0, 0, 18, 0])) for i, (ic, t, x) in enumerate([("leaf", "تهدئة وراحة", "أعشاب لتهدئة الأعصاب وصفاء الذهن"), ("heart-pulse", "دعم القلب", "زيوت غنية بالأوميغا والمضادات"), ("drop", "ترطيب وعناية", "زيوت للبشرة والشعر بلا كيمياء"), ("shield-check", "مناعة قوية", "أعشاب تقوّي الدفاعات الطبيعية"), ("sprout", "هضم أفضل", "مشروبات عشبية للراحة الهضمية"), ("sun", "نشاط وحيوية", "خلطات طبيعية للطاقة اليومية")])],
          pad=dm([60, 20, 50, 20], [40, 16, 36, 16]), gap={"d": 16}, fxs=[paper("#f8f1df")])
guide = S([C([W("heading", text="دليل الاستعمال", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#2f4a12", **anim("fadeUp")),
              W("accordion", items=[{"q": "كيف أستعمل زيت الأعشاب؟", "a": "مساء على بشرة نظيفة بتدليك خفيف، ثلاث مرات أسبوعياً."}, {"q": "كيف أحضّر المشروب العشبي؟", "a": "ملعقة صغيرة لكل كوب ماء مغلي، تُغطّى 5 دقائق ثم تُصفّى."}, {"q": "هل هناك آثار جانبية؟", "a": "منتجاتنا طبيعية لكن استشر طبيبك في حال الحمل أو الأمراض المزمنة."}, {"q": "كيف أحفظ المنتجات؟", "a": "في مكان بارد وجاف بعيداً عن الضوء المباشر."}], first=True, qbg="#fffaf0", qc="#2f4a12", ac="#6b5b3a", qfs=dm(18, 16), fxs=[accfx("#fffaf0", "#d6c9a2", 8)], **anim("fadeUp", .7, .1))], w=100)],
          cw={"d": 820}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=[paper("#efe3c6")])
niche("s-herbs", "متجر أعشاب وزيوت — العطّار", "ورق مصنّع بملمس خشن، لصيقة صيدلية أصيلة، شبكة فوائد ودليل استعمال، بدرجات الأخضر الزيتوني والبني.", "أعشاب وزيوت", "Amiri", "#f3ead7",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("البابونج   ✦   الزعتر   ✦   الحبة السوداء   ✦   زيت الأرغان   ✦   زيت الزيتون   ✦   النعناع   ✦   إكليل الجبل   ✦   الشيح", *th["mqc"]), benefits, catsec(k, th), prodsec(k, th), guide] + tail(k, th))

# ───────── 5) أزياء (Editorial) ─────────
k = "nf"; ICC[0] = "#111111"
WH = [FX("خلفية بيضاء", "selector{background:#ffffff}")]
GR = [FX("خلفية رمادية", "selector{background:#f4f4f2}")]
th = TH(k, False, "#111111", "#6b6b6b", "#111111", "#7c3aed", "#ffffff", WH, GR,
        dict(sbg="#0a0a0a", tc="#a3a3a3", hc="#ffffff", lc="#a3a3a3", lh="#ffffff"),
        [FX("لوحة سوداء", "selector{background:#111;color:#fff}"), sticker(k, "-40%", "#ffffff", "#111", 110)],
        dict(hbg="#ffffff", hbr="#111111", lc="#111111", lac="#111111", mc="#111111", cbg="#111111"),
        ("NEW SEASON — توصيل لكل الولايات  ·  استبدال مجاني خلال 7 أيام  ·  الدفع عند الاستلام", "#111111", "#ffffff", "#ffffff"), ("#111111", "#ffffff"),
        hfx=lambda s: [FX("عنوان أسود ثقيل", "selector .pb-t{letter-spacing:-.5px}")],
        ctr=[FX("أرقام مفرّغة", "selector .pb-ctn{color:transparent!important;-webkit-text-stroke:2px #111;font-weight:900}")],
        fcard=lambda i: [FX("بطاقة خطّية", "selector .pb-ib{border:1px solid #111;border-radius:0;padding:26px;height:100%;box-sizing:border-box;background:#fff;transition:background .3s,color .3s,transform .3s}selector .pb-ib:hover{background:#111;transform:translateY(-6px)}selector .pb-ib:hover *{color:#fff!important}")],
        prods=dict(cbg="#ffffff", bbg="#111111", rad=0, fxs=[FX("بطاقة تحريرية", "selector .pb-pc{border:0;border-radius:0;box-shadow:none;transition:transform .5s cubic-bezier(.2,.8,.2,1)}selector .pb-pc:hover{transform:translateY(-8px)}selector .pb-pc:hover img{transform:scale(1.06)}selector .pb-pc img{transition:transform .8s}")]),
        cats=dict(ov="#111111", ovo=35, rad=0, cols=3, fxs=[zoomcol("rgba(0,0,0,.3)")]), accfx=[accfx("#ffffff", "#111111", 0)],
        tsfx=[FX("رأي مربّع", "selector .pb-ts{background:#fff!important;border:1px solid #111;border-radius:0;box-shadow:8px 8px 0 #111}"), lift(".pb-ts", "rgba(0,0,0,.2)", -6)])
hero = S([
    C([W("heading", text="NEW", tag="h1", fs=dm(128, 64), fw="900", ta={"d": "start"}, color="#111111", lh={"d": .95}, fxs=[outlinetext("#111111", 2)], **anim("slideStart", .9)),
       W("heading", text="SEASON", tag="div", fs=dm(128, 64), fw="900", ta={"d": "start"}, color="#111111", lh={"d": .9}, **anim("slideStart", .9, .15)),
       T("مجموعة الموسم الجديد — قصّات عصرية، أقمشة فاخرة وأسعار عادلة.", 20, "#6b6b6b", "start", **anim("fadeUp", .8, .3)),
       BTN("تسوّق الإطلالة", bg="#111111", al="start", link="#products", fxs=[FX("زر خطّي", "selector .pb-btn{border-radius:0!important;border:2px solid #111;transition:background .3s,color .3s,transform .3s}selector .pb-btn:hover{background:#fff!important;color:#111!important;transform:translateX(-6px)}")], **anim("fadeUp", .8, .4))], w=58, va="center"),
    C([W("heading", text="LOOK 01", tag="div", fs=dm(26, 20), fw="900", ta={"d": "center"}, color="#ffffff", **anim("zoomIn", .8, .2)),
       T("إطلالة مسائية", 16, "#ffffffcc", **anim("fadeUp", .8, .3))], w=42, va="flex-end", pad=dm([200, 20, 24, 20]),
      fxs=[bgfade("#111111", "#7c3aed", 160), zoomcol("rgba(124,58,237,.4)"), ribbon("جديد", "#ffffff", "#111")])
], pad=dm([70, 20, 70, 20], [40, 16, 40, 16]), gap={"d": 30}, fxs=WH)
look = S([C([W("heading", text="LOOKBOOK", tag="h2", fs=dm(40, 28), fw="900", ta={"d": "center"}, color="#111", **anim("fadeUp"))], w=100, pad=dm([0, 0, 24, 0]))]
         + [C([W("heading", text=t, tag="div", fs=dm(22, 18), fw="900", ta={"d": "center"}, color="#ffffff", **anim("zoomIn", .7, .1 + i * .1)), T(x, 15, "#ffffffcc", **anim("fadeUp", .7, .2 + i * .1))], w=w, va="flex-end", pad=dm([h, 18, 22, 18]), fxs=[bgfade(c1, c2, 160), zoomcol("rgba(0,0,0,.35)")])
            for i, (t, x, w, h, c1, c2) in enumerate([("CASUAL", "يومي مريح", 33, 280, "#1f2937", "#6b7280"), ("STREET", "ستايل الشارع", 34, 360, "#7c2d12", "#f97316"), ("CLASSIC", "أناقة كلاسيكية", 33, 280, "#0f172a", "#475569")])],
         pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 12}, fxs=GR)
big = S([C([W("marquee", mqt="NEW COLLECTION   ✦   FREE DELIVERY   ✦   COD   ✦   RETURNS 7 DAYS", mqs=22, mqd="rtl", mqg=dm(60), mqp=True, mqbg="#111111", mqc="#ffffff", fs=dm(44, 28), fw="900", fxs=[marqueefx()])], w=100)], layout="full", pad=dm([0, 0, 0, 0]))
size = S([C([W("heading", text="دليل المقاسات", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#111", **anim("fadeUp")),
             W("table", tbl="المقاس | الصدر | الخصر | الطول\nS | 90 | 74 | 66\nM | 96 | 80 | 68\nL | 102 | 86 | 70\nXL | 108 | 92 | 72", thead=True, tzb=True, thbg="#111111", thc="#ffffff", tbd="#111111", tbfs=dm(17), tbal="center", **anim("fadeUp", .8, .1))], w=100)],
        cw={"d": 760}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=WH)
niche("s-fashion", "متجر أزياء — إديتوريال", "نمط مجلات الأزياء: عنوان عملاق مفرّغ، لوح لوك بوك غير متماثل، شريط نصي ضخم، بطاقات خطّية تسودّ بالمرور وجدول مقاسات.", "أزياء", "Noto Kufi Arabic", "#ffffff",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, big, look, prodsec(k, th, "وصل حديثاً", "اختياراتنا لهذا الموسم", WH), size, catsec(k, th, "تسوّقي حسب الفئة")] + tail(k, th))

# ───────── 6) معلوماتية ─────────
k = "ni"; ICC[0] = "#38bdf8"
SL = lambda s: [FX("خلفية سليت", "selector{background:radial-gradient(60% 80% at 80% 0%,rgba(56,189,248,.14),transparent 60%),#0b1220}"), gridbg(k + s, "rgba(56,189,248,.05)", 44)]
th = TH(k, True, "#e2e8f0", "#94a3b8", "#38bdf8", "#818cf8", "#ffffff10", SL, SL,
        dict(sbg="#060a14", tc="#94a3b8", hc="#ffffff", lc="#94a3b8", lh="#38bdf8"),
        [aurora(k + "o", "#0b1220", "#38bdf888", "#818cf877", "#22d3ee44", 10), rotborder(k, "#38bdf8", "#818cf8", 2, 4, 34)],
        dict(hbg="#0b1220", hbr="#ffffff1a", lc="#ffffff", lac="#38bdf8", mc="#e2e8f0", cbg="#0284c7"),
        ("💻 ضمان رسمي على كل الأجهزة  ·  تقسيط مرن  ·  توصيل سريع  ·  الدفع عند الاستلام", "#0284c7", "#ffffff", "#bae6fd"), ("#0f172a", "#38bdf8"),
        prods=dict(cbg="#ffffff", bbg="#0284c7", rad=16, fxs=[lift(".pb-pc", "rgba(56,189,248,.4)", -10, 3)]),
        cats=dict(ov="#0b1220", ovo=55, rad=16, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(56,189,248,.35)", -8, 3)]), cdc="#38bdf8")
term = W("text", html="<p style='font-family:monospace;direction:ltr;text-align:left;margin:0'><span style='color:#22c55e'>$</span> specs --best<br><span style='color:#38bdf8'>CPU</span>&nbsp;&nbsp;Core i7 · 14 cores<br><span style='color:#38bdf8'>RAM</span>&nbsp;&nbsp;32 GB DDR5<br><span style='color:#38bdf8'>SSD</span>&nbsp;&nbsp;1 TB NVMe<br><span style='color:#38bdf8'>GPU</span>&nbsp;&nbsp;RTX 4060 8GB<br><span style='color:#22c55e'>$</span> order --now</p>", fs=dm(18, 15), lh={"d": 1.9}, color="#e2e8f0", fw="600", fxs=[cursor(k)], **anim("fadeUp", .8, .2))
hero = S([
    C([T("▍ تقنية بلا حدود", 15, "#38bdf8", "start", fw="800", **anim("fadeDown")),
       W("heading", text="جهّز مكتبك وعالم ألعابك بأقوى العتاد", tag="h1", fs=dm(58, 32), fw="900", ta={"d": "start"}, color="#ffffff", lh={"d": 1.2}, fxs=[gradtext(k, "#38bdf8", "#818cf8", "#38bdf8", 6)], **anim("fadeUp", .8)),
       T("حواسيب، لابتوبات، قطع وملحقات أصلية بضمان رسمي وتقسيط مرن. نركّب ونسلّم حتى باب بيتك.", 19, "#94a3b8", "start", **anim("fadeUp", .8, .1)),
       BTN("تصفّح العتاد", bg="#0284c7", al="start", link="#products", fxs=[btngrad("#0284c7", "#6366f1", "rgba(56,189,248,.45)"), shine(k), pulse(k, "56,189,248", 2.2)], **anim("zoomIn", .8, .2)),
       W("tbadges", items="ضمان رسمي\nتقسيط مرن\nدعم فني", live=True, liveText="يتصفّحون الآن", lmin=16, lmax=57, cbg="#ffffff12", cc="#e2e8f0", cbc="#ffffff30", crad=dm(8), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .8, .3))], w=56, va="center"),
    C([term], w=44, va="center", pad=dm([34, 30, 34, 30]), fxs=[glass("rgba(8,15,30,.8)", "rgba(56,189,248,.35)", 16, 16), scan(k, "rgba(56,189,248,.9)")])
], pad=dm([90, 20, 90, 20], [50, 16, 50, 16]), gap={"d": 40}, fxs=SL("h"))
brands = mq("HP   ✦   DELL   ✦   ASUS   ✦   LENOVO   ✦   ACER   ✦   MSI   ✦   LOGITECH   ✦   KINGSTON   ✦   SAMSUNG   ✦   NVIDIA", *th["mqc"])
cmp2 = S([C([W("heading", text="قارن المواصفات", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "center"}, color="#ffffff", **anim("fadeUp")),
             W("table", tbl="الفئة | اقتصادي | متوسط | احترافي\nالمعالج | i3 | i5 | i7\nالذاكرة | 8GB | 16GB | 32GB\nالتخزين | 256GB | 512GB | 1TB\nالضمان | سنة | سنة | سنتان", thead=True, tzb=True, thbg="#0284c7", thc="#ffffff", tbd="#ffffff22", tbfs=dm(17), tbal="center", fxs=[FX("جدول تقني", "selector table{color:#e2e8f0;background:#0f172a;border-radius:14px;overflow:hidden;border:1px solid rgba(56,189,248,.3)}")], **anim("fadeUp", .8, .1))], w=100)],
          cw={"d": 880}, pad=dm([50, 20, 60, 20], [34, 16, 40, 16]), fxs=SL("t"))
niche("s-it", "متجر معلوماتية — تيك هب", "طرفية برمجية حيّة بمؤشر يومض ولوحة مسح، شبكة تقنية متحركة، شريط علامات تجارية وجدول مقارنة المواصفات.", "معلوماتية", "Tajawal", "#0b1220",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, brands, catsec(k, th, "الأقسام", "كل ما تحتاجه من عتاد وملحقات"), prodsec(k, th), cmp2, feat(k, th, [("shield-check", "ضمان رسمي", "سنة إلى سنتين على الأجهزة"), ("cash", "تقسيط مرن", "ادفع على دفعات مريحة"), ("headset", "دعم فني", "صيانة واستشارة تقنية"), ("truck", "توصيل وتركيب", "نوصّل ونركّب في مكانك")])] + tail(k, th))

# ───────── 7) منتجات رقمية ─────────
k = "nd"; ICC[0] = "#c084fc"
PUR = lambda s: [FX("خلفية بنفسجية", "selector{background:radial-gradient(70% 80% at 50% 0%,rgba(168,85,247,.28),transparent 60%),radial-gradient(50% 60% at 100% 100%,rgba(236,72,153,.18),transparent 60%),#0a0614}")]
th = TH(k, True, "#ffffff", "#c4b5fd", "#c084fc", "#f472b6", "#ffffff10", PUR, PUR,
        dict(sbg="#05030b", tc="#a78bfa", hc="#ffffff", lc="#a78bfa", lh="#f472b6"),
        [aurora(k + "o", "#1e1b4b", "#a855f7aa", "#ec489988", "#38bdf855", 9), rotborder(k, "#c084fc", "#f472b6", 2, 4, 34)],
        dict(hbg="#0a0614", hbr="#ffffff1a", lc="#ffffff", lac="#c084fc", mc="#e9d5ff", cbg="#9333ea"),
        ("⚡ تسليم فوري بعد الدفع  ·  تحديثات مدى الحياة  ·  ضمان استرجاع 14 يوماً", "#7e22ce", "#ffffff", "#f5d0fe"), ("#1e1b4b", "#e9d5ff"),
        prods=dict(cbg="#ffffff", bbg="#9333ea", rad=24, fxs=[lift(".pb-pc", "rgba(168,85,247,.45)", -10, 3)]),
        cats=dict(ov="#0a0614", ovo=50, rad=24, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(168,85,247,.4)", -8, 3)]), cdc="#f0abfc")
hero = S([C([
    W("tbadges", items="⚡ تسليم فوري\nتحديثات مدى الحياة\nدعم مباشر", live=False, cbg="#ffffff14", cc="#e9d5ff", cbc="#ffffff30", crad=dm(999), cfs=dm(14), gap=dm(10), jc="center", **anim("fadeDown")),
    W("heading", text="منتجات رقمية تبني دخلك وتختصر وقتك", tag="h1", fs=dm(64, 34), fw="900", ta={"d": "center"}, color="#ffffff", lh={"d": 1.2}, fxs=[gradtext(k, "#c084fc", "#f472b6", "#38bdf8", 5)], **anim("fadeUp", .8)),
    T("قوالب، كتب إلكترونية، دورات وأدوات جاهزة للتحميل الفوري بعد الدفع — بلا انتظار ولا شحن.", 20, "#c4b5fd", **anim("fadeUp", .8, .1)),
    BTN("استعرض المنتجات", bg="#9333ea", link="#products", fxs=[btngrad("#9333ea", "#ec4899", "rgba(168,85,247,.55)"), shine(k), pulse(k, "168,85,247", 2)], **anim("zoomIn", .8, .2))], w=100)],
    cw={"d": 900}, pad=dm([110, 20, 100, 20], [60, 16, 56, 16]), fxs=[aurora(k, "#0a0614", "#a855f788", "#ec489966", "#38bdf855", 14), blobs(k, "#a855f7", "#ec4899", 420, .35), sparkle(k, "#e9d5ff")] if False else [aurora(k, "#0a0614", "#a855f788", "#ec489966", "#38bdf855", 14), blobs(k, "#a855f7", "#ec4899", 420, .35)])
gets = S([C([W("heading", text="ماذا ستحصل عليه؟", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp")),
             bullets("ملفات جاهزة للتحميل المباشر\nتحديثات مجانية مدى الحياة\nدليل استعمال خطوة بخطوة\nدعم فني عبر واتساب\nضمان استرجاع 14 يوماً", "check-circle", "#c084fc", "#ede9fe", **anim("fadeUp", .7, .1))], w=50, va="center"),
          C([W("counter", n=4800, pre="+", label="عميل يستعمل منتجاتنا", fs=dm(56, 38), color="#c084fc", lc="#c4b5fd", fxs=[ctrcolor("#c084fc", "#f472b6")], **anim("zoomIn", .7)),
             W("counter", n=60, suf=" ث", label="متوسط زمن وصول الملف", fs=dm(44, 30), color="#c084fc", lc="#c4b5fd", fxs=[ctrcolor("#38bdf8", "#c084fc")], **anim("zoomIn", .7, .15))], w=50, va="center", pad=dm([30, 20, 30, 20]), fxs=[glass("rgba(255,255,255,.06)", "rgba(192,132,252,.35)", 18, 26)])],
        pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 40}, fxs=PUR("g"))
def plan(name, price, sub, items, hot=False, col="#c084fc"):
    fx = [glass("rgba(255,255,255,.07)", "rgba(255,255,255,.2)", 18, 26), zoomcol("rgba(168,85,247,.4)")]
    if hot: fx = [glass("rgba(168,85,247,.16)", "rgba(192,132,252,.5)", 18, 26), rotborder(k + name[:1], "#c084fc", "#f472b6", 2, 4, 26), ribbon("الأكثر طلباً", "#f472b6", "#fff")]
    return C([W("heading", text=name, tag="h3", fs=dm(24, 20), fw="900", ta={"d": "center"}, color="#ffffff"),
              W("heading", text=price, tag="div", fs=dm(46, 34), fw="900", ta={"d": "center"}, color="#ffffff", fxs=[gradtext(k + name[:1] + "p", "#c084fc", "#f472b6", "#38bdf8", 6)]),
              T(sub, 15, "#c4b5fd"), bullets(items, "check", col, "#ede9fe", fs=17),
              BTN("اختر الباقة", bg="#9333ea", fxs=[btngrad("#9333ea", "#ec4899", "rgba(168,85,247,.45)")] if hot else [FX("زر شفاف", "selector .pb-btn{background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.3)}")])],
             w=33, pad=dm([34, 24, 34, 24]), fxs=fx)
pricing = S([C([W("heading", text="اختر باقتك", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#ffffff", fxs=[gradtext(k + "pr", "#c084fc", "#f472b6", "#38bdf8", 6)], **anim("fadeUp")), T("دفعة واحدة — بلا اشتراكات خفية.", 17, "#c4b5fd", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0])),
             plan("أساسية", "2,900 دج", "للمبتدئين", "منتج واحد\nتحديثات سنة\nدعم بالبريد"),
             plan("احترافية", "5,900 دج", "الأفضل قيمة", "3 منتجات\nتحديثات مدى الحياة\nدعم واتساب\nقوالب إضافية", True),
             plan("شاملة", "9,900 دج", "للفرق", "كل المنتجات\nتحديثات مدى الحياة\nدعم أولوية\nاستشارة 30 دقيقة")],
            pad=dm([60, 20, 70, 20], [40, 16, 44, 16]), gap={"d": 22}, fxs=PUR("pp"))
niche("s-digital", "متجر منتجات رقمية — ديجيتال هب", "نمط SaaS بنفسجي: أورورا وكرات ضوئية، لوحة ما ستحصل عليه، ثلاث باقات تسعير بأوسطها إطار دوّار وشريط «الأكثر طلباً».", "منتجات رقمية", "Tajawal", "#0a0614",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("قوالب   ✦   كتب إلكترونية   ✦   دورات   ✦   أدوات   ✦   إضافات   ✦   تصاميم   ✦   خطوط   ✦   ملفات PSD", *th["mqc"]), gets, prodsec(k, th), pricing, catsec(k, th, "التصنيفات")] + tail(k, th, [(4800, "+", "", "عميل سعيد"), (120, "+", "", "منتج رقمي"), (60, "", " ث", "زمن التسليم"), (14, "", " يوم", "ضمان الاسترجاع")]))

# ───────── 8) ماركت بليس ─────────
k = "nm"; ICC[0] = "#f97316"
LG = lambda s: [FX("خلفية فاتحة", "selector{background:#f1f5f9}")]
WHT = lambda s: [FX("خلفية بيضاء", "selector{background:#ffffff}")]
th = TH(k, False, "#0f172a", "#64748b", "#f97316", "#ef4444", "#ffffff", LG, WHT,
        dict(sbg="#0f172a", tc="#94a3b8", hc="#ffffff", lc="#94a3b8", lh="#fb923c"),
        [aurora(k + "o", "#7c2d12", "#f9731699", "#ef444477", "#facc1544", 9), sticker(k, "عروض اليوم", "#fde047", "#111", 116)],
        dict(hbg="#ffffff", hbr="#e2e8f0", lc="#0f172a", lac="#f97316", mc="#0f172a", cbg="#f97316"),
        ("🏪 آلاف المنتجات من بائعين موثوقين  ·  دفع عند الاستلام  ·  توصيل لكل الولايات", "#f97316", "#ffffff", "#fff7ed"), ("#0f172a", "#fb923c"),
        prods=dict(cbg="#ffffff", bbg="#f97316", rad=14, fxs=[lift(".pb-pc", "rgba(249,115,22,.3)", -8, 2), FX("بطاقة سوق", "selector .pb-pc{border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(15,23,42,.06)}")]),
        cats=dict(ov="#0f172a", ovo=40, rad=14, cols=3, fxs=[lift(".pb-sc,.pb-cat,a", "rgba(249,115,22,.3)", -6, 2)]), cdc="#fde047")
def tile(t, x, c1, c2, w, h=250, btn="تسوّق الآن"):
    return C([W("heading", text=t, tag="h2", fs=dm(30, 24), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp")), T(x, 16, "#ffffffdd", "start", **anim("fadeUp", .7, .1)),
              BTN(btn, bg="#ffffff", color="#111", al="start", link="#products", fxs=[FX("زر أبيض", "selector .pb-btn{border-radius:999px!important}"), shine(k + t[:2])], **anim("fadeUp", .7, .2))],
             w=w, va="flex-end", pad=dm([h, 24, 24, 24]), fxs=[bgfade(c1, c2, 150), zoomcol("rgba(0,0,0,.3)")])
hero = S([tile("خصومات تصل إلى 60%", "على آلاف المنتجات من بائعين موثوقين", "#f97316", "#ef4444", 50, 260),
          tile("وصل حديثاً", "اكتشف أحدث العروض", "#6366f1", "#06b6d4", 25, 260, "اكتشف"),
          tile("توصيل مجاني", "فوق 6000 دج", "#10b981", "#22c55e", 25, 260, "التفاصيل")],
         pad=dm([30, 20, 20, 20], [20, 12, 12, 12]), gap={"d": 14}, fxs=LG("h"), cw={"d": 1240})
chips = S([C([W("tbadges", items="إلكترونيات\nأزياء\nالمنزل والمطبخ\nجمال وعناية\nأطفال\nرياضة\nكتب\nسيارات", live=True, liveText="مستخدم متصل", lmin=120, lmax=480, cbg="#ffffff", cc="#0f172a", cbc="#e2e8f0", crad=dm(999), cfs=dm(15), gap=dm(10), jc="center", **anim("fadeUp"))], w=100)],
         pad=dm([14, 20, 20, 20], [10, 12, 14, 12]), fxs=LG("c"))
flash = S([C([W("heading", text="⚡ عروض فلاش", tag="h2", fs=dm(34, 24), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp"))], w=40, va="center"),
           C([W("countdown", mode="daily", cbg="#00000055", color="#fde047", fs=dm(34, 24), crad=dm(10), al={"d": "end"}, fxs=[cdglow(k, "#fde047")], **anim("zoomIn"))], w=60, va="center")],
          pad=dm([28, 28, 28, 28], [20, 16, 20, 16]), cw={"d": 1140}, mar=dm([20, 20, 0, 20], [14, 12, 0, 12]), rad=dm(18, 14), fxs=[aurora(k + "fl", "#9a3412", "#f9731699", "#ef444488", "#facc1555", 8)])
deals = S([C([W("progress", pl="تم بيع 82% من الكمية", pv=82, pc="#f97316", pbg="#fed7aa", ph=dm(12), color="#0f172a", fxs=[barfx("#f97316", "#ef4444")], **anim("fadeUp")),
              W("progress", pl="تم بيع 64% من الكمية", pv=64, pc="#f97316", pbg="#fed7aa", ph=dm(12), color="#0f172a", fxs=[barfx("#ef4444", "#f97316")], **anim("fadeUp", .7, .1))], w=100)],
          cw={"d": 760}, pad=dm([30, 20, 10, 20]), fxs=WHT("d"))
sell = S([C([W("heading", text="بائعون مميّزون", tag="h2", fs=dm(34, 26), fw="900", ta={"d": "center"}, color="#0f172a", fxs=[gradtext(k + "s", "#f97316", "#ef4444", "#f97316", 6)], **anim("fadeUp")), T("متاجر موثوقة بتقييمات حقيقية من الزبائن.", 17, "#64748b", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 24, 0]))]
         + [C([IB("user", n, "★ %s · %s منتج" % (r, c), tc="#0f172a", xc="#64748b", isz=36, fxs=[softcard("#ffffff", "rgba(15,23,42,.08)", 16, 22, "#e2e8f0"), lift(".pb-ib", "rgba(249,115,22,.25)", -6, 2), ribbon("موثّق", "#10b981", "#fff") if i == 0 else FX("بدون", "selector{}")], **anim("fadeUp", .7, .1 + i * .1))], w=25, pad=dm([0, 0, 18, 0])) for i, (n, r, c) in enumerate([("متجر الأناقة", "4.9", 320), ("عالم التقنية", "4.8", 540), ("بيت الجمال", "4.9", 210), ("أسرة سعيدة", "4.7", 380)])],
        pad=dm([50, 20, 50, 20], [34, 16, 34, 16]), gap={"d": 16}, fxs=LG("s"))
app = S([C([W("heading", text="حمّل تطبيق السوق", tag="h2", fs=dm(32, 24), fw="900", ta={"d": "start"}, color="#ffffff"), T("تابع عروضك وتتبّع طلباتك من هاتفك.", 17, "#ffffffdd", "start")], w=60, va="center"),
         C([BTN("تواصل عبر واتساب", bg="#ffffff", color="#111", kind="whatsapp", al="end", fxs=[pulse(k, "255,255,255", 2)])], w=40, va="center")],
        pad=dm([36, 28, 36, 28], [26, 16, 26, 16]), mar=dm([10, 20, 30, 20], [8, 12, 24, 12]), rad=dm(20), cw={"d": 1140}, fxs=[bgfade("#0f172a", "#334155", 135), blobs(k + "a", "#f97316", "#6366f1", 260, .4)])
niche("s-marketplace", "ماركت بليس — سوق مفتوح", "تخطيط أسواق كثيف: لافتات ترويجية ملوّنة، شرائح فئات، عروض فلاش بعدّاد وشرائط بيع، متاجر بائعين موثّقين ودعوة تطبيق.", "ماركت بليس", "Tajawal", "#f1f5f9",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, chips, flash, deals, prodsec(k, th, "الأكثر مبيعاً", "اختيارات المتسوّقين", WHT("p")), sell, catsec(k, th, "تسوّق حسب الفئة"), feat(k, th, [("shield-check", "حماية المشتري", "استرجاع إذا لم يطابق الوصف"), ("truck", "توصيل سريع", "لكل الولايات"), ("cash", "دفع عند الاستلام", "ادفع بعد المعاينة"), ("headset", "دعم 7/7", "فريقنا في خدمتك")]), app] + tail(k, th, skipstats=False))

# ───────── 9) ساعات ─────────
k = "nw"; ICC[0] = "#c9992e"
BLK = lambda s: [FX("خلفية فحمية", "selector{background:radial-gradient(70% 90% at 75% 0%,#262218,#0a0a0a 62%),#0a0a0a}")]
th = TH(k, True, "#f5d77a", "#b9ae8f", "#c9992e", "#f5d77a", "#ffffff08", BLK, BLK,
        dict(sbg="#050505", tc="#8a8168", hc="#f5d77a", lc="#8a8168", lh="#f5d77a"),
        [FX("لوحة ذهبية", "selector{background:linear-gradient(135deg,#17130a,#2b2110);border:1px solid #c9992e;box-shadow:0 0 0 7px rgba(201,153,46,.1),0 40px 90px rgba(0,0,0,.6)}"), spotlight(k + "o", "rgba(201,153,46,.2)")],
        dict(hbg="#0a0a0a", hbr="#c9992e55", lc="#f5d77a", lac="#ffffff", mc="#e7ddc0", cbg="#b8860b"),
        ("⌚ ضمان دولي سنتان  ·  تغليف فاخر مع كل ساعة  ·  الدفع عند الاستلام", "#0a0a0a", "#f5d77a", "#c9992e"), ("#14100a", "#f5d77a"),
        hfx=lambda s: [goldshimmer(k + s, 6)], ctr=[goldshimmer(k + "c", 6)],
        prods=dict(cbg="#14100a", bbg="#b8860b", rad=6, fxs=[FX("بطاقة ساعة", "selector .pb-pc{border:1px solid #c9992e66;transition:transform .45s,box-shadow .45s}selector .pb-pc:hover{transform:translateY(-10px);box-shadow:0 30px 64px rgba(201,153,46,.3)}selector .pb-pc *{color:#f5d77a}")]),
        cats=dict(ov="#0a0a0a", ovo=50, rad=6, cols=3, tc="#f5d77a", fxs=[FX("حد ذهبي", "selector a,selector .pb-sc{border:1px solid #c9992e;border-radius:6px}"), zoomcol("rgba(201,153,46,.3)")]),
        fcard=lambda i: [FX("بطاقة فاخرة", "selector .pb-ib{border:1px solid #c9992e66;border-radius:6px;padding:26px;background:linear-gradient(160deg,#17120a,#0a0a0a);height:100%;box-sizing:border-box}"), lift(".pb-ib", "rgba(201,153,46,.25)", -8), floaty(k + "f" + str(i), ".pb-ibi", 5, 5 + i * .4)],
        offc="#f5d77a", offm="#e7ddc0", cdc="#f5d77a")
hero = S([
    C([T("— SWISS INSPIRED —", 15, "#c9992e", "start", fw="800", **anim("fadeDown")),
       W("heading", text="الوقت يليق بمن يقدّره", tag="h1", fs=dm(64, 36), fw="900", ta={"d": "start"}, color="#f5d77a", lh={"d": 1.2}, fxs=[goldshimmer(k, 5)], **anim("fadeUp", .9)),
       T("ساعات أنيقة بحركات دقيقة ومواد متينة وتصميم يرافقك لسنوات. ضمان دولي وتغليف هدايا فاخر.", 19, "#b9ae8f", "start", **anim("fadeUp", .9, .1)),
       BTN("اكتشف المجموعة", bg="#b8860b", color="#1a1409", al="start", link="#products", fxs=[btngrad("#b8860b", "#f5d77a", "rgba(201,153,46,.55)", -3), shine(k, 3)], **anim("zoomIn", .9, .2)),
       W("tbadges", items="ضمان سنتان\nمقاومة للماء\nزجاج سافير", live=True, liveText="يشاهدون الآن", lmin=12, lmax=44, cbg="#00000050", cc="#f5d77a", cbc="#c9992e", crad=dm(6), cfs=dm(14), gap=dm(10), jc="flex-start", **anim("fadeUp", .9, .3))], w=54, va="center"),
    C([W("spacer", mh=dm(380))], w=46, va="center", fxs=[dial(k)])
], pad=dm([90, 20, 90, 20], [50, 16, 50, 16]), gap={"d": 30}, fxs=BLK("h") + [spotlight(k, "rgba(201,153,46,.16)")])
move = S([C([W("heading", text="هندسة الدقّة", tag="h2", fs=dm(38, 26), fw="900", ta={"d": "center"}, color="#f5d77a", fxs=[goldshimmer(k + "m", 6)], **anim("fadeUp"))], w=100, pad=dm([0, 0, 24, 0]))]
        + [C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(52, 34), color="#f5d77a", lc="#b9ae8f", fxs=[goldshimmer(k + "n" + str(i), 6)], **anim("zoomIn", .7, .1 + i * .1))], w=25, pad=dm([0, 0, 20, 0])) for i, (n, p, s, l) in enumerate([(21, "", "", "حجراً كريماً"), (100, "", "م", "مقاومة الماء"), (72, "", "h", "احتياطي الطاقة"), (2, "", " سنة", "ضمان دولي")])],
       pad=dm([60, 20, 50, 20], [40, 16, 36, 16]), gap={"d": 16}, fxs=BLK("m"))
spec = S([C([W("heading", text="المواصفات", tag="h2", fs=dm(34, 26), fw="900", ta={"d": "center"}, color="#f5d77a", **anim("fadeUp")),
             W("table", tbl="البند | التفصيل\nالحركة | أوتوماتيكية\nالزجاج | سافير مضاد للخدش\nالعلبة | فولاذ 316L\nالسوار | جلد إيطالي / فولاذ\nالمقاومة | 100 متر", thead=True, tzb=True, thbg="#b8860b", thc="#1a1409", tbd="#c9992e55", tbfs=dm(17), tbal="center", fxs=[FX("جدول داكن", "selector table{color:#e7ddc0;background:#14100a;border-radius:6px;overflow:hidden}")], **anim("fadeUp", .8, .1))], w=100)],
        cw={"d": 760}, pad=dm([40, 20, 60, 20], [30, 16, 40, 16]), fxs=BLK("s"))
niche("s-watches", "متجر ساعات — كرونوس", "قرص ساعة حقيقي بعقرب ثوانٍ يدور داخل الهيرو، ذهب لامع على فحمي، عدّادات الهندسة الدقيقة وجدول المواصفات.", "ساعات", "El Messiri", "#0a0a0a",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("AUTOMATIC   ✦   SAPPHIRE   ✦   316L STEEL   ✦   WATER RESISTANT   ✦   SWISS MADE   ✦   LIMITED EDITION", *th["mqc"]), move, prodsec(k, th, "المجموعة", "قطع مختارة بعناية"), spec, catsec(k, th, "الفئات"), feat(k, th, [("shield-check", "ضمان دولي", "سنتان على الحركة"), ("gift", "تغليف فاخر", "علبة هدية أنيقة"), ("truck", "توصيل مؤمَّن", "لكل الولايات"), ("refresh", "استبدال", "خلال 7 أيام")])] + tail(k, th, skipstats=True))

# ───────── 10) مجوهرات ─────────
k = "nj"; ICC[0] = "#b76e79"
CH = lambda s: [FX("خلفية شامبانيا", "selector{background:linear-gradient(180deg,#fdf6ee,#f8e9e4)}")]
th = TH(k, False, "#4a1c2b", "#8a6270", "#b76e79", "#d4a373", "#ffffff", CH, [FX("خلفية كريمية", "selector{background:#fffaf6}")],
        dict(sbg="#2f1019", tc="#e6c7ce", hc="#ffffff", lc="#e6c7ce", lh="#f3c6cd"),
        [aurora(k + "o", "#4a1c2b", "#b76e7999", "#d4a37366", "#f3c6cd55", 12), sparkle(k + "o", "#ffffff")],
        dict(hbg="#fdf6ee", hbr="#f0d9d2", lc="#4a1c2b", lac="#b76e79", mc="#4a1c2b", cbg="#b76e79"),
        ("💎 ذهب عيار 18 وفضة 925  ·  شهادة أصالة مع كل قطعة  ·  تغليف هدايا مجاني", "#4a1c2b", "#fbe8ea", "#f3c6cd"), ("#f8e9e4", "#4a1c2b"),
        hfx=lambda s: [gradtext(k + s, "#4a1c2b", "#b76e79", "#d4a373", 8)], ctr=[ctrcolor("#b76e79", "#d4a373")],
        prods=dict(cbg="#ffffff", bbg="#b76e79", rad=6, fxs=[lift(".pb-pc", "rgba(183,110,121,.35)", -10, 2), FX("بطاقة ناعمة", "selector .pb-pc{border:1px solid #f0d9d2;box-shadow:0 14px 40px rgba(183,110,121,.14)}")]),
        cats=dict(ov="#4a1c2b", ovo=40, rad=6, cols=3, fxs=[zoomcol("rgba(183,110,121,.35)")]), cdc="#f3c6cd", cpbg="#ffffff22")
hero = S([C([
    T("✦ ELEGANCE IN EVERY DETAIL ✦", 14, "#b76e79", "center", fw="800", **anim("fadeDown")),
    W("heading", text="مجوهرات تحكي قصتك", tag="h1", fs=dm(70, 38), fw="900", ta={"d": "center"}, color="#4a1c2b", lh={"d": 1.2}, fxs=[gradtext(k, "#4a1c2b", "#b76e79", "#d4a373", 8)], **anim("fadeUp", .9)),
    T("قطع من الذهب عيار 18 والفضة الخالصة بتصاميم خالدة، تُهدى وتُورَّث. شهادة أصالة وتغليف هدايا مع كل قطعة.", 20, "#8a6270", **anim("fadeUp", .9, .1)),
    BTN("اكتشفي المجموعة", bg="#b76e79", link="#products", fxs=[btngrad("#b76e79", "#d4a373", "rgba(183,110,121,.45)"), shine(k, 3)], **anim("zoomIn", .9, .2))], w=100)],
    cw={"d": 900}, pad=dm([120, 20, 120, 20], [64, 16, 64, 16]), fxs=[aurora(k, "#fdf6ee", "#f3c6cd99", "#fde68a66", "#d4a37355", 18), sparkle(k, "#d4a373")])
carat = S([C([W("counter", n=n, pre=p, suf=s, label=l, fs=dm(54, 34), color="#b76e79", lc="#8a6270", fxs=[ctrcolor("#b76e79", "#d4a373")], **anim("zoomIn", .7, .1 + i * .1))], w=25, pad=dm([0, 0, 18, 0])) for i, (n, p, s, l) in enumerate([(18, "", "K", "ذهب عيار"), (925, "", "", "فضة خالصة"), (100, "", "%", "شهادة أصالة"), (30, "", " يوم", "ضمان واستبدال")])],
         pad=dm([60, 20, 50, 20], [40, 16, 36, 16]), gap={"d": 16}, fxs=[FX("خلفية كريمية", "selector{background:#fffaf6}")])
gift = S([C([W("heading", text="تغليف هدايا يليق بالمناسبة", tag="h2", fs=dm(36, 26), fw="900", ta={"d": "start"}, color="#ffffff", **anim("fadeUp")),
             T("علبة مخملية، شريط ساتان، وبطاقة إهداء بخط يدك — مجاناً مع كل طلب.", 18, "#fbe8ea", "start", **anim("fadeUp", .7, .1)),
             BTN("اطلبي هديتك", bg="#ffffff", color="#4a1c2b", al="start", link="#products", fxs=[shine(k + "g")], **anim("fadeUp", .7, .2))], w=60, va="center"),
          C([W("counter", n=0, pre="", suf=" دج", label="تغليف الهدايا", fs=dm(54, 38), color="#ffffff", lc="#fbe8ea", **anim("zoomIn", .7, .2))], w=40, va="center", pad=dm([30, 20, 30, 20]), fxs=[glass("rgba(255,255,255,.12)", "rgba(255,255,255,.4)", 14, 140), ribbon("مجاني", "#d4a373", "#4a1c2b")])],
         pad=dm([50, 40, 50, 40], [36, 20, 36, 20]), cw={"d": 1100}, mar=dm([20, 20, 40, 20], [14, 12, 30, 12]), rad=dm(10), fxs=[aurora(k + "gf", "#4a1c2b", "#b76e79aa", "#d4a37377", "#f3c6cd55", 12), sparkle(k + "gf", "#ffffff")])
niche("s-jewelry", "متجر مجوهرات — لؤلؤة", "شامبانيا وذهب وردي ببريق لامع يومض كالألماس، عدّادات العيار والأصالة، وقسم تغليف هدايا ملكي.", "مجوهرات", "Amiri", "#fffaf6",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("ذهب 18K   ✦   فضة 925   ✦   ألماس   ✦   لؤلؤ   ✦   خواتم   ✦   أساور   ✦   قلائد   ✦   أقراط", *th["mqc"]), catsec(k, th, "المجموعات", "اختاري ما يناسب ذوقك"), prodsec(k, th, "قطع مختارة", "الأكثر إعجاباً"), carat, gift] + tail(k, th, skipstats=True))

# ───────── 11) إكسسوارات ─────────
k = "na"; ICC[0] = "#8b5cf6"
CRM = lambda s: [FX("خلفية كريمية", "selector{background:#fff8f0}")]
th = TH(k, False, "#1f1147", "#6b5fa0", "#8b5cf6", "#ec4899", "#ffffff", CRM, [FX("خلفية بيضاء", "selector{background:#ffffff}")],
        dict(sbg="#1f1147", tc="#c4b5fd", hc="#ffffff", lc="#c4b5fd", lh="#fcd34d"),
        [aurora(k + "o", "#4c1d95", "#8b5cf6aa", "#ec489988", "#fcd34d55", 9), sticker(k, "اشترِ 2 والثالث هدية", "#fcd34d", "#1f1147", 128)],
        dict(hbg="#fff8f0", hbr="#fde4c8", lc="#1f1147", lac="#8b5cf6", mc="#1f1147", cbg="#8b5cf6"),
        ("🎀 اشترِ قطعتين والثالثة هدية  ·  توصيل لكل الولايات  ·  الدفع عند الاستلام", "#1f1147", "#fff8f0", "#fcd34d"), ("#8b5cf6", "#ffffff"),
        prods=dict(cbg="#ffffff", bbg="#8b5cf6", rad=26, fxs=[tiltcol(-1.5), FX("بطاقة مرحة", "selector .pb-pc{border:2px solid #1f1147;box-shadow:5px 5px 0 #1f1147}")]),
        cats=dict(ov="#1f1147", ovo=35, rad=30, cols=3, fxs=[tiltcol(-2)]), cdc="#fcd34d")
def blob(c, sz, extra=""):
    return FX("شكل لوني عائم", "selector{position:relative}selector::before{content:\"\";position:absolute;width:%spx;height:%spx;border-radius:50%%;background:%s;filter:blur(2px);opacity:.9;%s animation:naBl 7s ease-in-out infinite alternate}@keyframes naBl{to{transform:translate(18px,-24px) rotate(12deg)}}" % (sz, sz, c, extra))
hero = S([
    C([T("🎀 إكسسوارات تكمل إطلالتك", 15, "#8b5cf6", "start", fw="800", **anim("fadeDown")),
       W("heading", text="التفاصيل الصغيرة تصنع الفرق الكبير", tag="h1", fs=dm(58, 34), fw="900", ta={"d": "start"}, color="#1f1147", lh={"d": 1.25}, fxs=[gradtext(k, "#8b5cf6", "#ec4899", "#f59e0b", 6)], **anim("fadeUp", .8)),
       T("حقائب، نظارات، أحزمة، قبعات وأكثر — ألوان مرحة وجودة تدوم. اطلب واختر هديتك المجانية.", 19, "#6b5fa0", "start", **anim("fadeUp", .8, .1)),
       BTN("تسوّقي الآن", bg="#8b5cf6", al="start", link="#products", fxs=[btngrad("#8b5cf6", "#ec4899", "rgba(139,92,246,.45)"), shine(k), pulse(k, "139,92,246", 2.4)], **anim("zoomIn", .8, .2))], w=54, va="center"),
    C([W("heading", text=t, tag="div", fs=dm(26, 22), fw="900", ta={"d": "center"}, color=c, pad=dm([34, 10, 34, 10]), rad=dm(28), w=dm(86 - i * 6), al={"d": "start" if i % 2 else "end"}, fxs=[bgfade(c1, c2, 140), tiltcol(d)], **anim("zoomIn", .7, .1 + i * .1)) for i, (t, c, c1, c2, d) in enumerate([("حقائب", "#ffffff", "#8b5cf6", "#ec4899", -3), ("نظارات", "#1f1147", "#fcd34d", "#fb923c", 3), ("أحزمة", "#1f1147", "#6ee7b7", "#38bdf8", -2), ("قبعات", "#ffffff", "#f472b6", "#a855f7", 2)])], w=46, va="center", pad=dm([10, 10, 10, 10]))
], pad=dm([90, 20, 90, 20], [50, 16, 50, 16]), gap={"d": 36}, fxs=[aurora(k, "#fff8f0", "#ddd6fe99", "#fbcfe899", "#fde68a88", 16), blobs(k, "#c4b5fd", "#fcd34d", 320, .5)])
mix = S([C([W("heading", text="Mix & Match", tag="h2", fs=dm(40, 28), fw="900", ta={"d": "center"}, color="#1f1147", fxs=[gradtext(k + "m", "#8b5cf6", "#ec4899", "#f59e0b", 6)], **anim("fadeUp")), T("اختاري ثلاث قطع تكمل بعضها وتوفّري أكثر.", 17, "#6b5fa0", **anim("fadeUp", .7, .1))], w=100, pad=dm([0, 0, 26, 0]))]
        + [C([IB(ic, t, x, tc="#1f1147", xc="#6b5fa0", isz=44, fxs=[FX("بطاقة ملوّنة", "selector .pb-ib{background:%s;border:2px solid #1f1147;border-radius:26px;box-shadow:6px 6px 0 #1f1147;padding:26px;height:100%%;box-sizing:border-box}" % c), tiltcol(d), floaty(k + "x" + str(i), ".pb-ibi", 6, 3.8 + i * .5)], **anim("fadeUp", .7, .1 + i * .12))], w=33, pad=dm([0, 0, 20, 0])) for i, (ic, t, x, c, d) in enumerate([("gift", "الأساسية", "حقيبة صغيرة تناسب كل إطلالة", "#ede9fe", -2), ("sparkle", "اللمسة", "نظارة أو إكسسوار شعر لافت", "#fef3c7", 2), ("heart", "الهدية", "الثالثة مجاناً مع طلبك", "#fce7f3", -1.5)])],
       pad=dm([60, 20, 60, 20], [40, 16, 40, 16]), gap={"d": 20}, fxs=[FX("خلفية بيضاء", "selector{background:#ffffff}")])
niche("s-accessories", "متجر إكسسوارات — ميكس", "ألوان مرحة وبطاقات مائلة تستقيم بالمرور، ظلال صلبة ناعمة، ملصق عرض دوّار وقسم Mix & Match.", "إكسسوارات", "Changa", "#fff8f0",
      [bar(*th["bar"]), hdr(**th["hdr"]), hero, mq("حقائب   ✦   نظارات   ✦   أحزمة   ✦   قبعات   ✦   أوشحة   ✦   محافظ   ✦   إكسسوارات شعر   ✦   ساعات يد", *th["mqc"]), mix, catsec(k, th), prodsec(k, th)] + tail(k, th))
