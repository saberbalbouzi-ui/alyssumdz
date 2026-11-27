# SABER DIGITAL PRO — صفحة هبوط ثلاثية اللغة داخل موقع أليسوم

المخرجات (ملفات ثابتة تُلتزم كما هي، بلا خطوة بناء في المتصفح):

| الرابط | الملف |
|---|---|
| `/lp/saber-digital-pro/` (EN، الافتراضية) | `lp/saber-digital-pro/index.html` |
| `/lp/saber-digital-pro/fr/` | `lp/saber-digital-pro/fr/index.html` |
| `/lp/saber-digital-pro/ar/` (RTL كامل) | `lp/saber-digital-pro/ar/index.html` |

الأصول: `lp/saber-digital-pro/assets/` (`css/site.css`، `js/site.js`، خطوط woff2 محلية OFL، `og-*.jpg`، `favicon.svg`). لا مكتبات ولا طلبات لطرف ثالث.

## البنية
- `content/{en,fr,ar}.json` — كل النصوص (البنية متطابقة تماماً؛ `*كلمة*` في العناوين = إبراز بلون الحملة).
- `css/site.css` — نظام التصميم (خصائص منطقية فقط: يعمل LTR وRTL من ملف واحد).
- `js/site.js` — تفاعلات بلا مكتبات (قائمة الجوال، كشف عند التمرير، مبدّل اللغة الذي يحفظ القسم، التحقق من النموذج).
- `build.py` — يولّد الصفحات الثلاث (+ `seo-urls.txt` لخريطة الموقع، يلتقطه `scripts/seo.py`).
- `og.js` — صور المشاركة 1200×630 بنفس الخطوط. `test.js` — اختبارات القبول (Playwright + axe).
- `social.json` — روابط التواصل الاجتماعي للتذييل `{"LinkedIn": "https://…"}`؛ فارغ الآن فلا يظهر شيء (لا روابط وهمية).

## التعديل
```
# عدّل content/*.json أو css/site.css أو js/site.js ثم:
python3 scripts/saber-digital-pro/build.py
NODE_PATH=/opt/node-tools/node_modules node scripts/saber-digital-pro/og.js     # إن تغيّر العنوان/الوسوم
```
تغيير النطاق (canonical/hreflang/OG/JSON-LD): `SDP_BASE=https://نطاقك/مسار python3 scripts/saber-digital-pro/build.py`.

## الاختبار
```
python3 -m http.server 8765        # من جذر المستودع
NODE_PATH=/opt/node-tools/node_modules SDP_AXE=/path/to/axe.min.js node scripts/saber-digital-pro/test.js
```
يغطي: SEO وhreflang وJSON-LD، الروابط والمراسي، عدم وجود تمرير أفقي من 320 إلى 1920، RTL، لوحة المفاتيح، مبدّل اللغة، النموذج بحالاته، قائمة الجوال، تقليل الحركة، بلا JavaScript، وaxe (WCAG 2.2 AA).

## النموذج
بلا خادم: بعد التحقق يُجهَّز نص الطلب (بلغة الصفحة) ويختار الزائر الإرسال بواتساب (`wa.me/213697236128`) أو البريد (`mailto:saberdigitpro@gmail.com`) أو نسخه؛ ولا يُرسَل شيء قبل ضغطه إرسال في تطبيقه. بلا JavaScript يعمل `action="mailto:…"` احتياطاً. لإرسال مباشر من الصفحة يلزم نقطة نهاية خادم (لم تُحدَّد).

الخط: Cairo المتغيّر (عربي + لاتيني، ملفان فقط ~65KB) (رخصة OFL في `assets/fonts/LICENSES.txt`).
