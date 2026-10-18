#!/usr/bin/env python3
"""صفحة هبوط «عسل التركيز» (assets/pages/01.json) كعناصر مطوّر حقيقية بدل صورة واحدة.
الصور (هيرو/مشاكل) مقتطعة من تصميم صاحب المتجر إلى assets/img/tarkiz/lp، والمكوّنات والمنتج وآراء الزبائن من صور المنتج الأصلية.
تشغيل: python3 scripts/gen-focus-page.py ثم: NODE_PATH=/opt/node-tools/node_modules node scripts/publish-lp.js 01"""
import json, os, random, string
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
R = random.Random(2026101801)
def uid(): return "".join(R.choice(string.ascii_lowercase + string.digits) for _ in range(7))
def dm(d, m=None, t=None):
    o = {"d": d}
    if t is not None: o["t"] = t
    if m is not None: o["m"] = m
    return o
def W(ty, **s): return {"id": uid(), "type": ty, "set": s}
def C(ws, **s): return {"id": uid(), "set": s, "widgets": ws}
def S(cols, **s):
    b = {"layout": "boxed", "cw": {"d": 1140}, "pad": dm([48, 20, 48, 20], [30, 16, 30, 16]), "gap": {"d": 28}, "va": {"d": "center"}}; b.update(s)
    return {"id": uid(), "set": b, "cols": cols}
def H(text, fs=40, m=None, color="#1a1a1a", ta="center", tag="div", **x):
    s = dict(text=text, tag=tag, fs=dm(fs, m or max(22, int(fs * .7))), fw="900", ta={"d": ta}, color=color, lh={"d": 1.3}); s.update(x); return W("heading", **s)
def T(text, fs=18, m=None, color="#444", ta="center", fw="600", **x):
    s = dict(html="<p>%s</p>" % text, fs=dm(fs, m or max(14, fs - 2)), lh={"d": 1.9}, ta={"d": ta}, color=color, fw=fw); s.update(x); return W("text", **s)
def BTN(text, bg="#2e7d32", **x):
    s = dict(text=text, kind="link", link="#order", bgc=bg, color="#fff", hbg="#1b5e20", fs=dm(20, 18), fw="900", brad={"d": 40}, bpad={"d": [16, 44, 16, 44]}, al={"d": "center"}); s.update(x); return W("button", **s)
def IB(icon, title, text="", tc="#1a1a1a", xc="#555", isz=40, icc="#2e7d32", **x):
    s = dict(icon="ic:" + icon, title=title, text=text, al={"d": "center"}, isz={"d": isz}, tc=tc, xc=xc, w=dm(100), tfs={"d": 16}); s.update(x)
    s["fxs"] = [{"id": uid(), "n": "لون الأيقونة", "on": True, "tpl": "selector .pb-ibi{color:[[c]]}", "p": {"c": {"l": "اللون", "t": "text", "v": icc}}}]
    return W("iconbox", **s)
def IMG(path, alt, rad=18, **x):
    s = dict(src=path, alt=alt, fit="cover", hauto=True, rad=dm(rad)); s.update(x); return W("image", **s)

# ═════════ تأثيرات إضافية (عناصر set.fxs قابلة للتعديل من المطوّر + حركات الظهور) ═════════
def FX(name, tpl, **p):
    return {"id": uid(), "n": name, "on": True, "tpl": tpl, "p": {k: {"l": l, "t": t, "v": v} for k, (l, t, v) in p.items()}}
def fx_pulse(k, rgb="46,125,50"):
    return FX("نبض حلقي للزر", "selector .pb-btn{animation:%sPu [[d]]s infinite}@keyframes %sPu{0%%{box-shadow:0 0 0 0 rgba([[rgb]],.5)}70%%{box-shadow:0 0 0 18px rgba([[rgb]],0)}100%%{box-shadow:0 0 0 0 rgba([[rgb]],0)}}" % (k, k), rgb=("اللون RGB", "text", rgb), d=("الدورة ثانية", "num", 2.2))
def fx_shine(k):
    return FX("لمعة تعبر الزر", "selector .pb-btn{position:relative;overflow:hidden}selector .pb-btn::after{content:\"\";position:absolute;top:0;left:-70%%;width:45%%;height:100%%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-22deg);animation:%sSh [[d]]s ease-in-out infinite}@keyframes %sSh{0%%,55%%{left:-70%%}100%%{left:140%%}}" % (k, k), d=("زمن الدورة ثانية", "num", 3.4))
def fx_float(k, sel="img", amp=10, dur=5):
    return FX("طفو هادئ", "selector %s{animation:%sFl [[d]]s ease-in-out infinite}@keyframes %sFl{50%%{transform:translateY(-[[a]]px)}}" % (sel, k, k), a=("المسافة px", "num", amp), d=("الدورة ثانية", "num", dur))
def fx_zoom(sel="img", z=1.06):
    return FX("تكبير بالمرور", "selector %s{transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .5s}selector %s:hover{transform:scale([[z]]);box-shadow:0 18px 40px rgba(20,60,30,.28)}" % (sel, sel), z=("نسبة التكبير", "num", z))
def fx_lift(sel="img"):
    return FX("رفع بالمرور", "selector %s{transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s}selector %s:hover{transform:translateY(-8px);box-shadow:0 22px 44px rgba(0,0,0,.22)}" % (sel, sel))
def fx_sweep(k):
    return FX("لمعة تعبر الصورة", "selector{position:relative}selector::after{content:\"\";position:absolute;top:0;left:-80%%;width:45%%;height:100%%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-22deg);animation:%sSw [[d]]s ease-in-out infinite}@keyframes %sSw{0%%,60%%{left:-80%%}100%%{left:150%%}}" % (k, k), d=("زمن الدورة ثانية", "num", 5))
def fx_kb(k, z=1.1, d=9):
    return FX("تكبير سينمائي بطيء", "selector img{animation:%sKb [[d]]s ease-in-out infinite alternate}@keyframes %sKb{from{transform:scale(1)}to{transform:scale([[z]])}}" % (k, k), z=("نسبة التكبير", "num", z), d=("الدورة ثانية", "num", d))
def fx_tilt(sel="img"):
    return FX("ميلان وتكبير بالمرور", "selector %s{transition:transform .4s cubic-bezier(.2,.8,.2,1),filter .4s}selector %s:hover{transform:scale(1.1) rotate(-3deg);filter:saturate(1.25) drop-shadow(0 10px 18px rgba(0,0,0,.25))}" % (sel, sel))
def fx_hue(k):
    return FX("نبض سطوع وتشبّع", "selector img{animation:%sHu [[d]]s ease-in-out infinite}@keyframes %sHu{50%%{filter:brightness(1.08) saturate(1.2)}}" % (k, k), d=("الدورة ثانية", "num", 4))
def fx_icon(k):
    return FX("طفو الأيقونة", "selector .pb-ibi{display:inline-block;animation:%sIf [[d]]s ease-in-out infinite}@keyframes %sIf{50%%{transform:translateY(-6px) rotate(-5deg)}}" % (k, k), d=("الدورة ثانية", "num", 3.6))
def fx_grad(k, c1, c2, c3):
    return FX("نص بتدرّج متحرك", "selector .pb-t{background:linear-gradient(90deg,[[c1]],[[c2]],[[c3]],[[c1]]);background-size:260%% 100%%;-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;animation:%sGt [[d]]s linear infinite}@keyframes %sGt{to{background-position:260%% 0}}" % (k, k), c1=("اللون 1", "text", c1), c2=("اللون 2", "text", c2), c3=("اللون 3", "text", c3), d=("الدورة ثانية", "num", 7))

GREEN, BLUE, GOLD, RED = "#2e7d32", "#1b4a8a", "#c8920a", "#c62828"
P = "assets/img/tarkiz/"

# مكوّنات: مربعات مقصوصة من صور مكوّنات المنتج (بلا تغيير في المحتوى)
os.makedirs(os.path.join(ROOT, P + "lp"), exist_ok=True)
ING = [("العسل الطبيعي", "عسل طبيعي", "c-honey"), ("الجنكة", "الجنكة بيلوبا", "c-ginkgo"), ("الاكليل", "إكليل الجبل", "c-rosemary"),
       ("الريحان", "الريحان", "c-basil"), ("خلاصة الزبيب", "مستخلص الزبيب", "c-raisin"), ("مكسرات مطحونة", "مكسرات مطحونة", "c-nuts")]
for f, _, o in ING:
    im = Image.open(os.path.join(ROOT, P + "composants/%s.webp" % f)).convert("RGB"); w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((420, 420), Image.LANCZOS)
    im.save(os.path.join(ROOT, P + "lp/%s.webp" % o), quality=84, method=6)

secs = []
# 1) الهيرو
secs.append(S([
    C([H("مستخلصات طبيعية لعقل أكثر نشاطاً", 18, 15, "#ffffff", "start", bg=GREEN, rad=dm(10), pad=dm([6, 16, 6, 16]), w=dm(70, 100)),
       H("عسل طبيعي", 50, 36, BLUE, "start", tag="h1"), H("لدعم التركيز", 50, 36, GREEN, "start"), H("وتنشيط الذاكرة", 50, 36, GOLD, "start"),
       T("مزيج فريد من العسل ومستخلصات نباتية طبيعية لدعم التعلّم والنشاط الذهني لدى الأطفال.", 19, 16, "#444", "start"),
       BTN("اطلب الآن", al="start")], w=dm(55), va="center"),
    C([IMG(P + "lp/hero.webp", "عسل التركيز وتنشيط الذاكرة للأطفال — أليسوم", 22, shadow="lg")], w=dm(45), va="center")],
    grad1="#f5faee", grad2="#ffffff", gradAng=180, pad=dm([44, 20, 36, 20], [24, 14, 24, 14])))
# شريط مزايا
secs.append(S([C([IB(i, t, tc="#1a1a1a", isz=34)], w=dm(25, 50)) for i, t in [("leaf", "مكوّنات طبيعية"), ("brain", "يدعم التركيز والانتباه"), ("sparkle", "يساعد على التعلّم"), ("shield-check", "للأطفال من 4 إلى 18 سنة")]],
              pad=dm([20, 20, 20, 20], [14, 12, 14, 12]), bg="#ffffff", cid="benefits"))
# 2) المشكلة
probs = [("p-focus", "صعوبة في التركيز", "ينشتت بسرعة أثناء الدراسة أو الفراغ", "#e91e63"), ("p-memory", "نسيان متكرر", "يصعب عليه تذكّر المعلومات", "#1976d2"),
         ("p-learn", "ضعف الاستيعاب", "يحتاج وقتاً أطول لفهم الدروس", "#ef6c00"), ("p-screen", "التشتت بسبب الشاشات", "يقضي وقتاً طويلاً على الهاتف أو التلفاز", "#2e7d32")]
secs.append(S([C([H("المشكلة", 20, 18, RED), H("هل يواجه طفلك هذه التحديات؟", 38, 26, "#b71c1c", tag="h2")], w=dm(100))],
              grad1="#fff4f2", grad2="#fff9f8", gradAng=180, pad=dm([40, 20, 6, 20], [28, 16, 4, 16]), cid="problem"))
secs.append(S([C([IMG(P + "lp/%s.webp" % i, t, 16), H(t, 20, 17, c, tag="h3", mar=dm([8, 0, 0, 0])), T(d, 16, 14, "#666")], w=dm(25, 50), pad=dm([0, 6, 18, 6]))
               for i, t, d, c in probs], grad1="#fff9f8", grad2="#ffffff", gradAng=180, pad=dm([8, 20, 40, 20], [4, 12, 28, 12]), va={"d": "start"}))
# 3) الحل
secs.append(S([
    C([IMG(P + "presentation/03.webp", "عسل التركيز مع مكوّناته الطبيعية", 22, shadow="lg")], w=dm(46), va="center"),
    C([H("الحل", 20, 18, GREEN, "start"), H("عسل أليسوم لدعم التركيز والذاكرة", 36, 26, BLUE, "start", tag="h2"),
       T("مزيج طبيعي من العسل وخلاصات أعشاب ومكوّنات نباتية، مناسب للأطفال من 4 إلى 18 سنة ضمن روتينهم اليومي.", 18, 16, "#444", "start"),
       IB("leaf", "مكوّنات نباتية طبيعية", "مختارة بعناية", al={"d": "start"}), IB("brain", "يدعم التركيز والانتباه", "", al={"d": "start"}),
       IB("zap", "يعزّز النشاط الذهني", "بشكل طبيعي", al={"d": "start"}), IB("sprout", "يساعد في التعلّم والاستيعاب", "", al={"d": "start"})], w=dm(54), va="center")],
    grad1="#eef8e8", grad2="#ffffff", gradAng=160, cid="solution"))
# 4) المكوّنات
secs.append(S([C([H("مكوّنات طبيعية مختارة", 36, 26, "#1b5e20", tag="h2")], w=dm(100))], pad=dm([40, 20, 6, 20], [28, 16, 4, 16]), bg="#ffffff", cid="ingredients"))
secs.append(S([C([IMG(P + "lp/%s.webp" % o, n, 200), H(n, 17, 15, "#1a1a1a", tag="h3", mar=dm([8, 0, 0, 0]))], w=dm(16.6, 33), pad=dm([0, 6, 14, 6])) for _, n, o in ING],
              pad=dm([10, 20, 36, 20], [6, 12, 24, 12]), bg="#ffffff", va={"d": "start"}))
# 5) العروض والسعر (مرتبطة بالمنتج)
secs.append(S([
    C([IMG(P + "cover-1791065932434.webp", "عسل التركيز وتنشيط الذاكرة", 22)], w=dm(34), va="center"),
    C([H("عروض التوفير", 22, 20, "#ffffff", "start", bg=RED, rad=dm(30), pad=dm([6, 22, 6, 22]), w=dm(40, 70)),
       H("اختر العرض الذي يناسبك", 34, 26, "#1a1a1a", "start", tag="h2"), W("pprice", fs=dm(44, 36)), W("poffers"),
       BTN("اطلب هذا العرض الآن", RED, al="start", hbg="#8e0000")], w=dm(66), va="center")],
    grad1="#fff6df", grad2="#fffdf5", gradAng=160, cid="offers"))
# شريط الثقة
secs.append(S([C([IB(i, t, tc="#1a1a1a", isz=34)], w=dm(25, 50)) for i, t in [("truck", "التوصيل متوفر حسب الولاية"), ("cash", "الدفع عند الاستلام"), ("leaf", "منتج طبيعي"), ("headset", "دعم ومتابعة بعد الطلب")]],
              pad=dm([24, 20, 24, 20], [16, 12, 16, 12]), bg="#ffffff"))
# 6) آراء الزبائن الحقيقية (لقطات محادثات الزبائن)
secs.append(S([C([H("آراء بعض زبائننا", 36, 26, "#1b5e20", tag="h2")], w=dm(100))], pad=dm([36, 20, 6, 20], [26, 16, 4, 16]), bg="#f4faf0", cid="reviews"))
secs.append(S([C([IMG(P + "avis/%s.webp" % f, "رأي زبون", 14, shadow="sm")], w=dm(33.3, 100), pad=dm([0, 6, 14, 6])) for f in ["avis02", "SmartSelect_20250225_231134_Messenger", "avis03"]],
              pad=dm([10, 20, 36, 20], [6, 14, 24, 14]), bg="#f4faf0", va={"d": "center"}))
# 7) طريقة الطلب
steps = [("cart", "1", "اختر العرض", "الذي يناسبك"), ("check-circle", "2", "املأ معلوماتك", "الاسم، الهاتف، الولاية"), ("pin", "3", "نؤكد الطلب", "وتفاصيل التوصيل"), ("box", "4", "استلم طلبك", "وادفع عند الاستلام")]
secs.append(S([C([H("طريقة الطلب", 34, 26, "#1b5e20", tag="h2")], w=dm(100))], pad=dm([36, 20, 6, 20], [26, 16, 4, 16]), bg="#ffffff"))
secs.append(S([C([IB(i, "%s. %s" % (n, t), d, isz=36)], w=dm(25, 50)) for i, n, t, d in steps], pad=dm([8, 20, 36, 20], [4, 12, 24, 12]), bg="#ffffff"))
# 8) الطلب (النموذج الحقيقي)
secs.append(S([C([H("مستقبل أفضل لأطفالنا", 34, 24, "#ffffff", tag="h2"), T("دعم طبيعي للتركيز والنشاط الذهني. اطلب الآن والدفع عند الاستلام.", 18, 16, "#e8f5e9")], w=dm(100)),
               C([T("ملاحظة: هذا المنتج مكمّل غذائي طبيعي وليس دواءً، ولا يُغني عن استشارة الطبيب أو الصيدلي، خصوصاً للأطفال ومن يتناولون علاجاً. النتائج تختلف من شخص لآخر.", 14, 13, "#fde68a", fw="600", bg="rgba(0,0,0,.22)", rad=dm(12), pad=dm([10, 16, 10, 16])),
                  W("orderorig", prod="tarkiz", auto=True)], w=dm(100))],
              grad1="#1b5e20", grad2="#2e7d32", gradAng=160, cid="order", pad=dm([44, 20, 56, 20], [28, 12, 36, 12])))


# ═════════ تطبيق التأثيرات ═════════
def add_fx(w, *f): w["set"]["fxs"] = list(w["set"].get("fxs", [])) + list(f)
def each(n, fn):
    for c in n.get("cols", []):
        fn(c, "col"); each(c, fn)
    for w in n.get("widgets", []): fn(w, "w")
ANIMS = ["fadeUp", "zoomIn", "fadeUp", "slideStart"]
for si, sec in enumerate(secs):
    for ci, col in enumerate(sec["cols"]):
        for w in col["widgets"]:
            t = w["type"]; st = w["set"]
            if t == "orderorig" or (t == "text" and "ملاحظة" in st.get("html", "")): continue
            d = round(min(ci, 5) * .1, 2)
            st["anim"] = "zoomIn" if (si == 0 and t == "image") else "fadeUp"; st["animDur"] = .75; st["animDelay"] = d
            if t == "button": add_fx(w, fx_pulse("fkb%d" % si, "198,40,40" if st.get("bgc") == RED else "46,125,50"), fx_shine("fks%d" % si))
            elif t == "iconbox": add_fx(w, fx_icon("fki%d_%d" % (si, ci)))
            elif t == "image":
                if si == 0: add_fx(w, fx_float("fkh", "img", 9, 5.5), fx_hue("fkhu"), fx_sweep("fksw0"))
                elif si == 2: add_fx(w, fx_kb("fkb2_%d" % ci, 1.12, 8 + ci), fx_sweep("fksw2_%d" % ci), fx_lift("img"))
                elif si == 3: add_fx(w, fx_kb("fkb3", 1.08, 10), fx_sweep("fksw3"), fx_zoom("img", 1.04))
                elif si == 4: add_fx(w, fx_tilt("img"), fx_hue("fkhu4_%d" % ci))
                elif si == 5: add_fx(w, fx_float("fkh5", "img", 8, 5), fx_sweep("fksw5"), fx_hue("fkhu5"))
                else: add_fx(w, fx_lift("img"), fx_sweep("fksw%d_%d" % (si, ci)))

path = os.path.join(ROOT, "assets/pages/01.json"); old = json.load(open(path, encoding="utf-8"))
old.update({"title": "عسل التركيز وتنشيط الذاكرة", "desc": "عسل طبيعي بمكوّنات نباتية لدعم التركيز والنشاط الذهني لدى الأطفال من 4 إلى 18 سنة. الدفع عند الاستلام والتوصيل حسب الولاية.",
            "sections": secs, "css": "", "header": True, "footer": True, "bg": "#ffffff", "cover": P + "lp/hero.webp", "product": "tarkiz"})
json.dump(old, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("sections:", len(secs))
