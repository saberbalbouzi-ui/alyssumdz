# alyssumdz — ملاحظات العمل لهذا المستودع

## منهج العمل (طلب صاحب المتجر)
- لا تكتفِ بتنفيذ التعليمات حرفياً: مع كل مهمة **اقترح** تعديلات وإضافات تحسّن الأداء أو التجربة، ونفّذ الصغير منها ما دام داخل نطاق المهمة وآمناً، وسمِّ الباقي كاقتراحات في ردك.
- صاحب المتجر يتحدث العربية: أجب بالعربية (والفرنسية إن بدأ بها).
- لا تنشر على الموقع الحي (الدمج في `main`) إلا بعد موافقته؛ وقد يقول «ادمج مباشرة» ضمن الطلب نفسه فيُعدّ ذلك موافقة لتلك المهمة فقط.

## بنية المشروع
- موقع ثابت (GitHub Pages، النطاق في `CNAME`): `index.html`، صفحات المنتجات في `p/<slug>/index.html`، لوحة التحكم `admin.html`.
- بيانات المنتجات في `assets/js/data.js` (تُكتب من لوحة التحكم عبر GitHub API)، ورسوم التوصيل في `assets/js/wilayas.js`.
- الطلبات تُحفظ في Google Sheets عبر Google Apps Script (`assets/js/config.js` ← `API_URL`)؛ الكود الإضافي (زيارات/مشاهدون الآن/أسئلة الوكيل) في `apps-script/Code-additions.gs` ويلزم لصقه ونشره يدوياً.
- Supabase (`https://qvdaiundlkfbmjlummni.supabase.co`): مخطط وأمان في `supabase/schema.sql` وتعليمات في `supabase/README.md`؛ الزيارات والمشاهدون الآن وأسئلة الوكيل تُرسل إليه إن ضُبط `SUPABASE_ANON_KEY` في `config.js`، وإلا تعود إلى Apps Script. لا تضع `service_role` في المستودع أبداً.
- التقاط العناصر الذكي (بلا مفتاح): `assets/js/ai-vision.js` + `ai-vision-worker.js` (D-FINE + SAM2 + MI-GAN في Web Worker من jsDelivr/Hugging Face)؛ Gemini اختياري ومُطفأ افتراضياً.
- الوكيل الذكي: `assets/js/agent.js` (واجهة وردود افتراضية) + `assets/js/agent-brain.js` (استنتاج) + تدريبه في `assets/data/agent-training.json`.

- حسابات الزبائن + PWA: `Account`/`PWA` في آخر `assets/js/app.js`، والخلفية `API.cust` في `api.js` (php | sb | local)؛ دوال `customer_*` في `supabase/schema.sql` ومسارات `customer_*` في `api/index.php`؛ ملفات PWA: `manifest.webmanifest` و`sw.js` وأيقونات `assets/img/icon-*.png` (خاصة بكل موقع، لا تدخل في `shared-files.json`).

- الهيدر والفوتر وزر المشاركة: `assets/js/chrome.js` (يحمّله آخر `app.js` على كل صفحة) + أيقونات التواصل الرسمية `assets/js/social-icons.js` (مسارات Simple Icons)؛ الإعداد في `assets/data/chrome.json` (بلا ملف = يبقى الموقع كما هو عدا أيقونة المشاركة، و`{"off":true}` = استرجاع) وتُحرَّر من تبويبَي «الهيدر» و«الفوتر» في admin.html عبر `assets/js/chrome-admin.js`؛ وعنصر `social` في منشئ الصفحات.

- تحويل المنتج/الرئيسية إلى المطوّر: `scripts/pagebuilder-convert.js` (`PBConvert`)؛ زر «تعديل» في معاينة الصفحة وزر «تعديل» في قائمة الصفحات يفتحان صفحة المنتج/الرئيسية في المطوّر. «حفظ ونشر» ← حفظ مباشر (يستبدل الأصل بعد نسخه إلى `assets/pages/_conv/<key>.orig.html`، وللمنتج يبقى الأصل في `p/<slug>/classic/` ليُضمَّن نموذج الطلب) أو نسخة جديدة `/lp/…` أو استرجاع.

## نقل الموقع / البيع
- هوية الموقع (الاسم، النطاق، واتساب، انستغرام، مستودع GitHub) في `CONFIG.SITE` داخل `assets/js/config.js`؛ لا تكتبها نصّاً في JS جديد. خطوات النقل في `HANDOVER.md`، وأدوات `scripts/rebrand.py` و`scripts/setup-supabase.sh`.

## نسخة الاستضافة (PHP)
- `php-edition/api/index.php` (دخول + ملفات + طلبات/إحصاءات على SQLite) و`php-edition/install.php`؛ تُفعَّل بـ `CONFIG.BACKEND = "php"` فقط (`PHPAPI` في admin.html و`API.php` في api.js)، والوضع الافتراضي (GitHub/Supabase) لا يتغير. الحزمة: `scripts/make-template.py --target php`. الاختبار محلياً: `php -S` + Playwright. حزمة تحديث مواقع الزبائن: `make-template.py --target php --update` (انظر HANDOVER.md §7) — ارفع `VERSION` عند كل إصدار. التحديث عن بُعد: `shared-files.json` (المشترك/الخاص)، `scripts/release.py` + `.github/workflows/release.yml`، توقيع المتصفح في `Seller` وتحقق PHP في `api/index.php` (`update_*`)؛ لا توسّع قائمة `updAllowed` إلا بتحديث يدوي أولاً (HANDOVER.md §8). لا تستعمل `pkill -f` في الأوامر (يقتل الصدفة).

## تنبيهات تقنية
- `const CONFIG` و`const API` ليسا خصائص على `window`؛ استعمل `typeof CONFIG !== "undefined"`.
- أداة «توليد صفحة منتج» (`GenPage` في admin.html) معطّلة مؤقتاً.
- الاختبار: خادم محلي `python3 -m http.server` + Playwright؛ الشبكة الخارجية (Google) محجوبة في بيئة Claude السحابية.
