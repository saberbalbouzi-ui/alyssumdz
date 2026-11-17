# مراجعة الاختبارات الـ17 غير المصنَّفة — جدول فردي (للمراجعة النهائية)

> **لم يُنقل أي اختبار.** بقيت الـ17 في `tests.yml` فقط. التصنيف بدليل من محتوى كل اختبار ومن `shared-files.json` (الملفات التي تصل **كل العملاء**) وليس من الأسماء.

## قاعدة الحسم المستعملة
1. **الشيفرة المختبَرة هي كود لوحة التاجر المشترك** (`assets/js/*` المدرجة في `shared-files.json`): منتج «الموقع/القالب» الذي يبني منه ALYSSUM وتُسلَّم نسخه للعملاء، **وليس** Worker المنصة. لذلك أي اختبار واجهة بلا عقد مع المنصة ⇒ **Website**.
2. **اختبار واجهة يحاكي وسيط المنصة (`/v1/…` وplatform-admin) ويحيل صراحةً إلى اختبار خادمه في `platform/api/test`** ⇒ **عقد منصة**: يُقترح له Platform CI بمسارات الملفات المحدّدة.
3. **`saas/`** غير مدرج في `shared-files.json` (0 مرة) ⇒ موقع المنصة التسويقي، لا يصل العملاء ⇒ **Platform**.

## الجدول
| # | الاختبار | الملفات التي يغطيها (وجدتُها في الاختبار) | المنتج | سبب التصنيف | Workflow المقترح | الثقة |
|---|---|---|---|---|---|---|
| 1 | `test-toolpages` | `saas/brand.js` · `saas/landing/landing.js` · `saas/landing/remove-background/index.html` · `assets/js/admin-nav.js` (مشترك) | **Platform** | يفحص صفحات دليل الأدوات المولَّدة بـ`gen-tool-pages.py` تحت `saas/` (غير مشترك مع العملاء)؛ لمسه الوحيد للوحة هو `admin-nav.js` | `platform-ci` ← `platform-logic`، مسارات: `saas/**` · `scripts/gen-tool-pages.py` · `scripts/test-toolpages.js` | متوسطة |
| 2 | `test-agency-ui` | `assets/js/admin-agency.js` (مشترك) | **Platform (واجهة عقد)** | يحاكي وسيط المنصة (5 مراجع `/v1/`، platform-admin) ويحيل إلى `platform/api/test/agency.test.mjs`؛ الكود ميزة خدمات التسويق | `platform-ci` ← `platform-ui`، مسارات: `assets/js/admin-agency.js` · `platform/api/src/modules/agency*` | متوسطة |
| 3 | `test-appstore-ui` | `assets/js/admin-appstore.js` (مشترك) | **Platform (واجهة عقد)** | عقد `/v1/` (4) ويحيل إلى `appstore.test.mjs` | `platform-ci` ← `platform-ui`، مسارات: `assets/js/admin-appstore.js` · `platform/api/src/modules/appstore*` | متوسطة |
| 4 | `test-appstore-dev-ui` | `assets/js/admin-appdev.js` (مشترك) | **Platform (واجهة عقد)** | بوابة المطوّر: 9 مراجع `/v1/` ويحيل إلى `appstore.test.mjs` | `platform-ci` ← `platform-ui`، مسارات: `assets/js/admin-appdev.js` · `platform/api/src/modules/appstore*` | متوسطة |
| 5 | `test-digital-ui` | `assets/js/admin-digital.js` (مشترك) | **Platform (واجهة عقد)** | 24 مرجع `/v1/` ويحيل إلى `digital-vault.test.mjs` | `platform-ci` ← `platform-ui`، مسارات: `assets/js/admin-digital.js` · `platform/api/src/modules/digital*` | متوسطة |
| 6 | `test-digital-checkout` | `assets/js/config.js` · `assets/js/data.js` · `p/anti-acne/index.html` · `p/anti-colon/index.html` | **Website (واجهة متجر) بتبعية منصة** | يفحص نموذج الطلب في صفحات المنتج (متجر) مع «منصة وهمية» (9 `/v1/`)؛ الكود المختبَر صفحات المتجر | `website-ci` ← `website-ui`، ومسار إضافي: `platform/api/src/modules/digital*` (تغيير العقد يشغّله) | متوسطة |
| 7 | `test-assets` | `scripts/pagebuilder-assets.js` (PBAssets) | **Website** | وحدة «مكتبة الأصول» في منشئ الصفحات، معزولة بمحاكاة PBApp/fetch؛ مرجع `/v1/` واحد عرضي | `website-ci` ← `website-studios` | عالية |
| 8 | `test-vgen` | `assets/js/img-gen.js` (مشترك) + PBVGen | **Website** | مولّد فيديو بمحاكاة ImgGen «بلا مفتاح ولا شبكة»؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 9 | `test-vad` | `scripts/pagebuilder-vad.js` (PBVAd) | **Website** | صانع إعلانات فيديو بمحاكاة ImgGen؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 10 | `test-pack3d` | `assets/js/pack3d.js` · `assets/js/admin-imgbatch.js` (مشتركان) | **Website** | استوديو 3D بعرض WebGL (SwiftShader)؛ لا اتصال بالمنصة | `website-ci` ← `website-studios` | عالية |
| 11 | `test-mockup` | `assets/js/mockup-studio.js` · `mockup-models.js` · `admin-imgbatch.js` · `vendor/three.module.min.js` | **Website** | استوديو الموكاب 3D؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 12 | `test-boxdesigner` | `assets/js/box-designer.js` | **Website** | هندسة قوالب العلب وتصديرها؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 13 | `test-boxprofiles` | `assets/js/box-profiles.js` | **Website** | 23 نموذج علبة وتصدير؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 14 | `test-boxprofiles3d` | مسار قوالب العلب ← ستوديو 3D (`box-profiles.js` + `box-studio.js` + `pack3d.js`) | **Website** | تكامل ثلاث وحدات واجهة؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 15 | `test-boxstudio` | `assets/js/box-studio.js` · `vendor/three.module.min.js` | **Website** | استوديو العلب 3D؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 16 | `test-fashion` | `scripts/pagebuilder-ai.js` · `scripts/pagebuilder-more.js` | **Website** | استوديو الأزياء و«المشهد الذكي» بمحاكاة ImgGen؛ لا عقد منصة | `website-ci` ← `website-studios` | عالية |
| 17 | `test-tryon-shopper` | `assets/js/tryon-shopper.js` (مشترك) | **Website (ودجت متجر) بتبعية منصة** | زر «جرّب عليك» في صفحة المنتج (متجر) يستدعي خدمة المنصة (5 مراجع platform)؛ الخادم في `platform/api/test/tryon.test.mjs` (موجود أصلاً في Platform CI) | `website-ci` ← `website-ui`، ومسار إضافي: `platform/api/src/modules/tryon*` | متوسطة |

## الخلاصة المقترحة (بعد موافقتك فقط)
- **Platform CI:** +5 (1–5) ← `platform-logic` (1) و`platform-ui` (2–5).
- **Website CI:** +12 (6–17) ← `website-ui` (6 و17) وجوب جديد `website-studios` (7–16: استوديوهات 3D/ذكاء، تحتاج WebGL فتُعزل عن لوحة الموقع الخفيفة).
- **بلا تكرار:** كل اختبار في مسار واحد فقط؛ ويُحدَّث `scripts/ci-coverage.py` (قائمة `WEBSITE`/`PLATFORM`) لفرض ذلك.
- **تنبيه:** الاختبارات 2–5 و6 و17 تتعلق بحدود المنتجين؛ الثقة «متوسطة» لأن شيفرة الواجهة في ملفات الموقع المشتركة بينما عقدها مع المنصة. قرارك: Platform CI بمسارات ضيقة (المقترح) أم Website CI؟
- **حالة التشغيل المحلي:** لم تُشغَّل الـ17 هنا (لم تُنقل)؛ عند التشغيل على `main` النظيف نتائجها تتبع حالة `tests.yml` الحالية.
