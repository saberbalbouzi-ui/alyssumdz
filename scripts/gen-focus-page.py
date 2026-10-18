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

path = os.path.join(ROOT, "assets/pages/01.json"); old = json.load(open(path, encoding="utf-8"))
old.update({"title": "عسل التركيز وتنشيط الذاكرة", "desc": "عسل طبيعي بمكوّنات نباتية لدعم التركيز والنشاط الذهني لدى الأطفال من 4 إلى 18 سنة. الدفع عند الاستلام والتوصيل حسب الولاية.",
            "sections": secs, "css": "", "header": True, "footer": True, "bg": "#ffffff", "cover": P + "lp/hero.webp", "product": "tarkiz"})
json.dump(old, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("sections:", len(secs))
