#!/usr/bin/env python3
"""يضيف حقل keywords (كلمات مفتاحية للوكيل الذكي) لكل منتج في assets/js/data.js إن كان فارغاً. لا يستبدل ما كتبته أنت."""
import json, re, pathlib
P = pathlib.Path(__file__).resolve().parent.parent / "assets/js/data.js"
KW = {
 "tarkiz": "عسل التركيز, تركيز الاطفال, تنشيط الذاكرة للأطفال, ذاكرة الاطفال, الدراسة, الامتحانات, المدرسة, التلميذ, ضعف التركيز, النسيان عند الطفل, عسل للأطفال, طاقة الاطفال, miel concentration, mémoire enfants, concentration enfant, écolier",
 "memory-drops": "قطرات التركيز, تركيز الكبار, ذاكرة الكبار, تنشيط الذاكرة, الجنكة, نسيان, ضعف التركيز, الطلبة الجامعيين, الموظفين, مكمل عشبي للذاكرة, memory drops, concentration adulte, mémoire adultes, gingko",
 "anti-acne": "حب الشباب, بثور, حبوب الوجه, البشرة الدهنية, رؤوس سوداء, اثار الحبوب, كريم للوجه, acné, boutons, peau grasse, crème visage",
 "anti-chute": "تساقط الشعر, الصلع, تقوية الشعر, تطويل الشعر, زيت الشعر, فراغات الشعر, شعر ضعيف, chute de cheveux, perte de cheveux, huile cheveux, repousse",
 "anti-colon": "القولون, الخلعة, عسل القولون, انتفاخ, اضطراب الهضم, مغص, الم البطن, colon, ballonnements, digestion, miel colon",
 "anti-rides": "التجاعيد, البقع, زيت الوجه, تصبغات, توحيد لون البشرة, شد البشرة, rides, taches, huile visage, anti-âge",
 "anti-rides-2": "كريم التجاعيد, كريمة للتجاعيد, البقع الداكنة, تصبغات الوجه, شد الوجه, crème anti-rides, taches brunes, anti-âge",
 "barbarie": "زيت التين الشوكي, ترطيب البشرة, حول العين, زيت الوجه, نضارة, huile de figue de barbarie, hydratation, cernes",
 "breatyfresh": "رائحة الفم, نكهة الفم, مضمضة, رائحة كريهة, انتعاش الفم, haleine, mauvaise haleine, bain de bouche",
 "creme-tachouih": "تشويه الجمال, كريمة تشويه الجمال, رقية الجمال, عين, حسد على الوجه, تغير ملامح الوجه, tachouih, beauté roqia",
 "tachouih-el-jamal": "تشويه الجمال, زيت تشويه الجمال, رقية الجمال, تغير الملامح, tachouih, huile roqia beauté",
 "tachouih-pack": "باقة تشويه الجمال, تشويه الجمال, ماء الورد, رقية الجمال, pack tachouih, eau de rose",
 "eczema": "الاكزيما, الصدفية, حكة, جفاف الجلد, احمرار الجلد, حساسية الجلد, eczéma, psoriasis, démangeaisons, peau sèche",
 "flexi-relief": "الم المفاصل, الام العضلات, ركبة, الظهر, الروماتيزم, التهاب المفاصل, مرهم المفاصل, douleurs articulaires, muscles, genou, dos, pommade",
 "hemorroides": "البواسير, مرهم البواسير, الم الشرج, نزيف, hémorroïdes, pommade hémorroïdes",
 "henna": "حنة, حنة الشفاء, حنة الشعر, حنة اليدين, صبغ الشعر, سدر, henné, henna, coloration naturelle",
 "huile-a-barbe": "زيت اللحية, تطويل اللحية, تنعيم اللحية, كثافة اللحية, huile barbe, barbe, soin barbe",
 "ithmed": "كحل, اثمد, كحل الاثمد, كحل اصفهاني, تقوية النظر, العين, khol, kohl, ithmed, vue",
 "massage-oil": "الزيت الحارقة, زيت الرقية, زيت التدليك, دهن خارجي, حبة البركة, رقية شرعية, huile roqia, huile massage, nigelle",
 "miel-de-cresson": "عسل الجرجير, عسل طبيعي, مناعة, طاقة, miel de cresson, miel naturel",
 "miel-de-montagne": "عسل جبلي, عسل الجبل, عسل طبيعي, طاقة, miel de montagne, miel naturel",
 "miel-oranger": "عسل البرتقال, عسل زهر البرتقال, عسل طبيعي, miel d'oranger, miel naturel",
 "miel-sidr": "عسل السدر, عسل فاخر, عسل طبيعي, مناعة, miel de sidr, miel naturel, jujubier",
 "misk-noir": "مسك اسود, مسك ابيض, مسك الرقية, عطر الرقية, رقية شرعية, musc noir, musc blanc, roqia",
 "nocturna-honey": "التبول اللاارادي, التبول الليلي عند الاطفال, تبول الطفل, سلس البول للاطفال, عسل للتبول, énurésie, pipi au lit, enfant nuit",
 "uroflow": "المثانة, التبول الليلي للكبار, سلس البول, كثرة التبول, تبول لاارادي للكبار, راحة المثانة, vessie, incontinence, énurésie adulte",
 "pack-djin-el-achiq": "الجن العاشق, باقة الجن العاشق, رقية الجن, المس العاشق, جني عاشق, pack djin, djinn amoureux, roqia",
 "pack13": "الباقة الشاملة للرقية, باقة الرقية, الرقية الشرعية, المس والسحر والعين, 13 دواء, pack roqia complet, roqia",
 "pack4": "الباقة الرباعية للرقية, باقة الرقية, الرقية الشرعية, عسل الشفاء, pack roqia 4, roqia",
}
src = P.read_text(encoding="utf-8")
m = re.search(r"(var PRODUCTS\s*=\s*)(\[.*?\])(;\s*\n)", src, re.S)
prods = json.loads(m.group(2)); n = 0
for p in prods:
    if not (p.get("keywords") or "").strip() and p["slug"] in KW:
        p["keywords"] = KW[p["slug"]]; n += 1
P.write_text(src[:m.start(2)] + json.dumps(prods, ensure_ascii=False, separators=(",", ":")) + src[m.end(2):], encoding="utf-8")
print("أُضيفت كلمات مفتاحية لـ", n, "منتج")
