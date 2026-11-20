# الملفات المحجوزة من عمل Beta القديم — تصنيفها بحسب المنتج

> مصدرها الفرع القديم `claude/charming-ramanujan-j9ikd8` (الالتزام `f1e6360`). **لم يُنقل أيٌّ منها إلى Platform CI**، ولا يوجد دليل على حاجة المنصة إليها. التصنيف بدليل من محتوى الملف لا من اسمه.

| الملف | المنتج الذي يخدمه | الدليل | الحالة والقرار |
|---|---|---|---|
| `scripts/build-beta.py` | **Website** (نسخة Beta من واجهة المتجر) | يستدعي `make-template.py --target github` (مولِّد قالب الموقع)، ويكتب `config.js` للموقع، ويحقن الشريط في صفحاته، ويضع noindex/robots | محجوز. لا حاجة للمنصة. بعد إصلاح M-1 نجح اختباره 19/19 مؤقتاً. المكان المقترح: Website CI عند موافقتك |
| `scripts/test-beta-build.js` | **Website** | يفحص ناتج بناء الموقع ويقرأ `assets/data/payments.json` (بيانات المتجر) | محجوز مع `build-beta.py` |
| `scripts/test-beta-browser.js` | **Website** | Chromium على الموقع الساكن المبنيّ (صفحات وشريط) | محجوز مع `build-beta.py` (يحتاج Playwright) |
| `platform/env/beta/beta-banner.js` | **Website** (واجهة) + نقطة نهاية **المنصة** | يُحقَن في صفحات الموقع فقط، ويرسل الملاحظات إلى `/v1/beta/feedback` (وحدة `beta` في فرع Worker) | محجوز مع `build-beta.py` |
| `scripts/test-beta-resources.js` | **Beta / بنية المنصة** | يتحقق من `beta-resources.json` ومن أن اختبارات D1 وSupabase وChargily تتخطى بصدق | **نُقل إلى الفرع `beta/worker-runtime-isolation`** (24/24) لأن الاختبارات الثلاثة موجودة فيه |
| `scripts/test-supabase-beta.js` + `platform/supabase/tests/local/` | **Beta / Supabase (حزمة المتجر)** | تدريب PostgreSQL محلي للحزمة؛ الحزمة المحلية جاءت من مرحلة 12B WS3 | محجوز. الحزمة المحلية موجودة الآن في فرع `site/12b-order-truth`؛ تشغيله هنا غير ممكن (جذر ومسار غير قابل للقراءة لمستخدم postgres) ⇒ `NOT TESTED` |
| `docs/BETA-DEPLOYMENT-RUNBOOK.md` | **مختلط** | 12 قسماً: Supabase (§2) · بناء واجهة الموقع (§3) · Worker/D1 (§4) · بوابة الشحن (§5) · النطاق/SSL (§6) · مستخدمو Beta (§7–8) | محجوز؛ يُقسَّم بحسب المنتج قبل ضمّه (يشير إلى `build-beta.py` المحجوز) |
| `docs/BETA-LAUNCH-READINESS.md` | **مختلط** | حالة جاهزية شاملة بأرقام الفرع القديم، ويحيل إلى `docs/FINAL-NEXT-PHASE-TESTS.md` غير الموجود على `main` | محجوز؛ يُعاد كتابته بنتائج حقيقية جديدة بدل أرقام قديمة |

**لا شيء من هذه الملفات يدخل Platform CI** لعدم وجود دليل على حاجة المنصة إليها؛ ما يخص الموقع يُقترح له Website CI بعد موافقتك.
