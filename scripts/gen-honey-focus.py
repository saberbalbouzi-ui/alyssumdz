#!/usr/bin/env python3
"""صفحة هبوط «عسل التركيز — MEMORY FOCUS» (assets/pages/honey-focus.json) بعناصر مطوّر حقيقية قابلة للتعديل،
مبنية على تصميم HTML الذي أرسله صاحب المتجر (أزرق/برتقالي/أخضر) ومرتبطة بالمنتج tarkiz (أسعار وعروض ونموذج الطلب الحقيقي).
تشغيل: python3 scripts/gen-honey-focus.py ثم: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/publish-lp.js honey-focus ثم python3 scripts/seo.py"""
import json, os, random, string, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
# مساعدات البناء والتأثيرات نفسها المستعملة في gen-focus-page.py (الجزء السابق للبيانات)
_src = open(os.path.join(HERE, "gen-focus-page.py"), encoding="utf-8").read()
exec(compile(_src.split("GREEN, BLUE, GOLD, RED")[0].replace("R = random.Random(2026101801)", "R = random.Random(2026102001)"), "gen-focus-page-helpers", "exec"), globals())

NAVY, ORANGE, GREEN, RED = "#123e72", "#f39a18", "#187a3b", "#d8322a"
P = "assets/img/tarkiz/"; PG = "assets/img/pages/"
def BTN2(text, bg=ORANGE, link="#order", **x):
    return BTN(text, bg, link=link, hbg="#d9820a" if bg == ORANGE else "#0f5a2a", **x)
secs = []
# 1) الهيرو
secs.append(S([
    C([H("روتين طبيعي لدعم رحلة التعلّم", 14, 13, GREEN, "start", bg="#ffffff", rad=dm(30), pad=dm([7, 16, 7, 16]), w=dm(60, 100), border="1px solid #c9e1c1"),
       H("عسل طبيعي", 56, 38, NAVY, "start", tag="h1"), H("لدعم التركيز والذاكرة", 56, 38, ORANGE, "start"),
       T("ALYSSUM MEMORY FOCUS، مزيج العسل والمستخلصات النباتية (الجنكة، إكليل الجبل، الريحان، الزبيب والمكسرات) ليدخل بسهولة ضمن الروتين اليومي للتلميذ.", 18, 15, "#4c6278", "start"),
       BTN2("اطلب الآن · الدفع عند الاستلام", al="start"), W("pprice", fs=dm(34, 28))], w=dm(52), va="center"),
    C([IMG(P + "lp/mf-family-jar.webp", "أم وطفلان في وقت الدراسة بجانب عسل أليسوم للتركيز", 40, shadow="lg")], w=dm(48), va="center")],
    grad1="#fffaf0", grad2="#e9f5e7", gradAng=135, pad=dm([54, 20, 60, 20], [26, 14, 34, 14])))
# شريط المزايا
secs.append(S([C([IB(i, t, d, tc=NAVY, isz=34, icc=GREEN)], w=dm(25, 50)) for i, t, d in [
    ("leaf", "عسل ومستخلصات نباتية", "التفاصيل على ملصق العبوة"), ("sparkle", "روتين يومي بسيط", "ضمن نمط حياة متوازن"),
    ("cash", "الدفع عند الاستلام", "تدفع بعد أن تستلم طلبك"), ("heart", "للتلاميذ والعائلة", "مع مراعاة العمر والإرشادات")]],
    pad=dm([22, 20, 22, 20], [14, 12, 14, 12]), bg="#ffffff", cid="benefits"))
# 2) التحديات
secs.append(S([C([H("فهم التحديات اليومية", 15, 14, GREEN), H("كل طفل يتعلّم بطريقته", 40, 28, NAVY, tag="h2"),
                  T("تختلف أجواء الدراسة من يوم لآخر. تنظيم البيئة، والراحة، والتغذية المتوازنة خطوات مهمة لبناء روتين أكثر هدوءًا.", 16, 14, "#627487")], w=dm(100))],
              grad1="#fff9f3", grad2="#ffffff", gradAng=180, pad=dm([60, 20, 8, 20], [36, 16, 4, 16]), cid="challenge"))
probs = [("lp/mf-girl-homework-card.webp", "تشتّت أثناء الدراسة", "تهيئة مكان هادئ وتقليل الملهيات يساعدان على تنظيم وقت التعلّم.", "طفلة تكتب واجباتها وتبدو متعبة من الدراسة"),
         ("lp/mf-mother-boy-card.webp", "الحاجة إلى روتين ثابت", "الخطوات الصغيرة والمتكررة تجعل وقت الدراسة أكثر انتظامًا.", "طفل يتعلم بمساعدة أمه المحجبة في منزل مضيء"),
         ("lp/mf-study-break-card.webp", "الإرهاق من الجلوس الطويل", "الاستراحات القصيرة والحركة والنوم الكافي عناصر لا غنى عنها.", "طفل يأخذ استراحة قصيرة بعد حل الواجب"),
         ("lp/mf-boy-jar-card.webp", "دعم العادات الجيدة", "التشجيع والتغذية المتوازنة يكمّلان بيئة تعلّم صحية.", "تلميذ يبتسم في مكتبه ومعه عبوة عسل أليسوم")]
secs.append(S([C([IMG(P + i, a, 18, shadow="sm"), H(t, 19, 16, "#d84b37", "start", tag="h3", mar=dm([10, 0, 0, 0])), T(d, 14, 13, "#637386", "start")],
                 w=dm(25, 50), pad=dm([0, 7, 18, 7])) for i, t, d, a in probs],
              grad1="#ffffff", grad2="#ffffff", pad=dm([8, 20, 60, 20], [4, 12, 36, 12]), va={"d": "start"}))
# 3) الحل
secs.append(S([
    C([IMG(P + "presentation/03.webp", "عبوة عسل التركيز وتنشيط الذاكرة وسط الأعشاب والزبيب", 34, shadow="lg")], w=dm(46), va="center"),
    C([H("التعرّف على المنتج", 15, 14, GREEN, "start"), H("تعرّف على MEMORY FOCUS", 38, 28, NAVY, "start", tag="h2"),
       T("عسل طبيعي بمستخلصات نباتية في عبوة 250 غ، بطعم محبّب للأطفال ليكون جزءًا من روتين الأسرة اليومي. اقرأ المكونات وتعليمات الملصق قبل الاستخدام.", 17, 15, "#627487", "start"),
       IB("leaf", "مزيج عسل ومستخلصات", "جنكة، إكليل الجبل، ريحان، زبيب ومكسرات.", al={"d": "start"}, tc=NAVY, icc=GREEN),
       IB("shield-check", "تفاصيل واضحة", "الوزن والمعلومات الأساسية على الملصق.", al={"d": "start"}, tc=NAVY, icc=GREEN),
       IB("sun", "ضمن روتين متوازن", "مع النوم الجيد والطعام المتنوع والنشاط.", al={"d": "start"}, tc=NAVY, icc=GREEN),
       IB("check-circle", "اقرأ الإرشادات أولًا", "خصوصًا عند تقديم المنتج للأطفال.", al={"d": "start"}, tc=NAVY, icc=GREEN),
       BTN2("شاهد العروض", GREEN, link="#offers", al="start")], w=dm(54), va="center")],
    grad1="#f1f9ec", grad2="#eaf5ff", gradAng=125, cid="solution"))
# 4) المكوّنات
secs.append(S([
    C([IMG(P + "presentation/04.webp", "عبوة أليسوم محاطة بالجنكة والريحان والمكسرات والزبيب", 30, shadow="md")], w=dm(50), va="center"),
    C([H("من الطبيعة إلى العبوة", 15, 14, GREEN, "start"), H("تفاصيل المكونات", 36, 28, NAVY, "start", tag="h2"),
       T("تجمع هوية المنتج بين لون العسل الذهبي ولمسات النباتات الخضراء. اعتمد دائمًا على قائمة المكونات المطبوعة على العبوة لتأكيد التركيبة الدقيقة. الصور توضيحية.", 16, 14, "#627487", "start")], w=dm(50), va="center")],
    bg="#fffdf6", pad=dm([60, 20, 20, 20], [36, 16, 12, 16]), cid="ingredients"))
ING = [("lp/c-honey.webp", "العسل الطبيعي"), ("lp/c-ginkgo.webp", "الجنكة"), ("lp/c-rosemary.webp", "إكليل الجبل"), ("lp/c-basil.webp", "الريحان"), ("lp/c-raisin.webp", "الزبيب"), ("lp/c-nuts.webp", "المكسرات")]
secs.append(S([C([IMG(P + i, n, 200, shadow="sm"), H(n, 16, 14, NAVY, tag="h3", mar=dm([8, 0, 0, 0]))], w=dm(16.6, 33), pad=dm([0, 8, 14, 8])) for i, n in ING],
              bg="#fffdf6", pad=dm([10, 20, 56, 20], [6, 12, 34, 12]), va={"d": "start"}))
# 5) العروض (مرتبطة بالمنتج)
secs.append(S([
    C([IMG(PG + "mf-jar-250g.webp", "عبوة ALYSSUM MEMORY FOCUS 250 غ", 0, fit="contain")], w=dm(26, 60), va="center"),
    C([H("اختر ما يناسبك", 15, 14, GREEN, "start"), H("عروض ALYSSUM", 38, 28, NAVY, "start", tag="h2"),
       T("الأسعار بالدينار الجزائري، والدفع عند الاستلام. اختر العرض ثم أكمل الطلب في الأسفل.", 16, 14, "#6a6c5b", "start"),
       W("pprice", fs=dm(44, 34)), W("poffers"), BTN2("اطلب هذا العرض الآن", RED, al="start")], w=dm(74), va="center")],
    grad1="#fff5d7", grad2="#fff0d6", gradAng=130, cid="offers"))
# 6) الاستعمال
steps = [("eye", "1", "اقرأ ملصق العبوة", "تأكد من المكونات، والفئة العمرية، والتحذيرات، وظروف الحفظ."),
         ("check-circle", "2", "اتبع الإرشادات الرسمية", "استخدم المنتج فقط بالطريقة والكمية المذكورتين على العبوة."),
         ("user", "3", "استشر مختصًا عند الحاجة", "خصوصًا للأطفال أو عند وجود حساسية من العسل أو أي مكوّن.")]
secs.append(S([
    C([IMG(P + "presentation/01.webp", "طفلة تبتسم في مكتبها وبيدها عبوة عسل أليسوم", 40, shadow="lg")], w=dm(40), va="center"),
    C([H("قبل الاستخدام", 15, 14, GREEN, "start"), H("معلومات واضحة، خطوة بخطوة", 36, 26, NAVY, "start", tag="h2"),
       T("التزم بتعليمات الملصق الرسمي، ولا تعتمد على صور أو نصوص تسويقية لتحديد الكمية.", 16, 14, "#627487", "start")] +
      [IB(i, "%s. %s" % (n, t), d, al={"d": "start"}, tc=NAVY, icc=ORANGE, isz=34) for i, n, t, d in steps] +
      [T("تنبيه: لا يُعطى العسل للأطفال دون عمر سنة. هذا المنتج ليس بديلًا عن نظام غذائي متوازن أو استشارة مختص صحي.", 13, 12, "#78684c", "start")], w=dm(60), va="center")],
    grad1="#f5faef", grad2="#ffffff", gradAng=180, cid="usage"))
# 7) آراء الزبائن الحقيقية (لقطات ماسنجر)
secs.append(S([C([H("تجربة العميل مهمة", 15, 14, GREEN), H("آراء زبائننا", 38, 28, NAVY, tag="h2"), T("رسائل حقيقية وصلتنا من زبائننا على ماسنجر.", 16, 14, "#627487")], w=dm(100))],
              bg="#ffffff", pad=dm([56, 20, 6, 20], [34, 16, 4, 16]), cid="reviews"))
secs.append(S([C([IMG(P + "avis/%s.webp" % f, "رأي زبون عن عسل التركيز", 16, shadow="sm")], w=dm(33.3, 100), pad=dm([0, 8, 14, 8])) for f in ["avis02", "SmartSelect_20250225_231134_Messenger", "avis03"]],
              bg="#ffffff", pad=dm([10, 20, 50, 20], [6, 14, 30, 14]), va={"d": "center"}))
# 8) الطلب (النموذج الحقيقي)
secs.append(S([C([H("روتين دراسة أهدأ يبدأ بخطوة صغيرة", 36, 26, "#ffffff", tag="h2"), T("اطلب عسل التركيز وتنشيط الذاكرة من متجر أليسوم. الدفع عند الاستلام والتوصيل حسب الولاية.", 17, 15, "#e8f2f7")], w=dm(100)),
               C([W("orderorig", prod="tarkiz", auto=True)], w=dm(100))],
              grad1="#123e72", grad2="#17607a", gradAng=160, cid="order", pad=dm([48, 20, 56, 20], [30, 12, 36, 12])))

# تأثيرات خفيفة: ظهور تدريجي + لمعة/نبض للأزرار
def add_fx(w, *f): w["set"]["fxs"] = list(w["set"].get("fxs", [])) + list(f)
for si, sec in enumerate(secs):
    for ci, col in enumerate(sec["cols"]):
        for w in col["widgets"]:
            t = w["type"]; st = w["set"]
            if t in ("orderorig", "pprice", "poffers") or (t == "text" and "ملاحظة" in st.get("html", "")): continue
            st["anim"] = "zoomIn" if (si == 0 and t == "image") else "fadeUp"; st["animDur"] = .75; st["animDelay"] = round(min(ci, 5) * .1, 2)
            if t == "button": add_fx(w, fx_pulse("hfb%d" % si, "216,50,42" if st.get("bgc") == RED else "243,154,24"), fx_shine("hfs%d" % si))
            elif t == "image":
                if si == 0: add_fx(w, fx_float("hfh", "img", 9, 6))
                else: add_fx(w, fx_lift("img"))

path = os.path.join(ROOT, "assets/pages/honey-focus.json")
page = {"v": 1, "title": "عسل التركيز وتنشيط الذاكرة — ALYSSUM MEMORY FOCUS", "slug": "honey-focus",
        "desc": "ALYSSUM MEMORY FOCUS عسل طبيعي بالجنكة وإكليل الجبل والريحان والزبيب والمكسرات ضمن روتين الدراسة اليومي. الدفع عند الاستلام والتوصيل حسب الولاية.",
        "bg": "#ffffff", "ff": "", "header": True, "footer": True, "css": "", "sections": secs, "seoTitle": "", "kw": "", "cover": P + "lp/mf-family-jar.webp", "product": "tarkiz"}
json.dump(page, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("sections:", len(secs))
