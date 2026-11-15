# جاهزية الإطلاق التجريبي المستقل (Beta Launch Readiness)

> **الحكم الصريح:** النسخة **جاهزة تقنياً في الشيفرة** لفتح Closed Beta بجانب المنصة القديمة، **لكن Beta غير جاهزة للإطلاق فعلياً**: لم يُنشأ أي مورد حقيقي (Supabase/D1/Workers/DNS/SSL) ولم يُنفَّذ أي نشر، وبعض شروط القبول `BLOCKED` لغياب بيئات خارجية (مفصَّلة أدناه). كل ما أُثبت أُثبت **محلياً** (محاكاة D1 على `node:sqlite` وminiflare، Chromium على ملفات ساكنة)، ولم يُشغَّل CI على GitHub لهذه التعديلات بعد (لا دفع دون موافقتك). **لا نشر، لا DNS، لا تغيير في Production، لا تسجيل عام، لا دعوات حقيقية، لا دمج في `main`، `VERSION` كما هو (1.89.1071).**
>
> الحالات: `VERIFIED` أُثبت كما هو موصوف · `PARTIALLY VERIFIED` أُثبت جزئياً/محلياً فقط · `BLOCKED` لا بيئة/اعتماد · `NOT TESTED` لم يُجرَّب.

## 1) بنية البيئتين

| | **Production (القائمة — لم تُمَسّ)** | **Beta (مقترحة — لم تُنشأ)** |
|---|---|---|
| الواجهة | GitHub Pages من `main` على `alyssumdz.com` | ملفات ساكنة من `scripts/build-beta.py` (ناتج `dist/beta`) على استضافة ساكنة مستقلة (مقترح: Cloudflare Pages) عند `beta.alyssumdz.com`. **ليست فرعاً من Pages ولا تشارك `CNAME`** |
| قاعدة المتجر/الدخول/الإدارة | Supabase `qvdaiundlkfbmjlummni` | **مشروع Supabase مستقل — غير مُنشأ (BLOCKED)** |
| منصة API (Worker + D1) | `alyssum-platform-api` / D1 بالاسم نفسه / `api.alyssumhub.fyi` | `alyssum-platform-api-beta` / D1 `alyssum-platform-api-beta` / `beta-api.alyssumhub.fyi` |
| بوابة الشحن | `alyssum-shipping-gateway` / `shipping.alyssumhub.fyi` | `alyssum-shipping-gateway-beta` / `beta-shipping.alyssumhub.fyi` (مربوطة بمنصة Beta حصراً) |
| الأسرار | أسرار Worker الحالية + Supabase Functions | **مجموعة جديدة كلياً** (`deploy.mjs secrets` يولّدها لكل بيئة؛ أسرار Functions تُضبط على مشروع Beta) |
| الدفع/الرسائل/الشحن | Chargily حيّ، SMS/بريد، شركات التوصيل | Chargily `test` فقط، بلا بريد/SMS/Meta، `courier=sandbox` |
| الجدولة | cron كل دقيقة لكل Worker | cron مستقل لكل Worker Beta |
| الإصدار | VERSION + `main` | `beta-build.json` + `/health` (SHA، إصدار، بصمة المخطط، هوية القاعدة) |

> الأسماء والنطاقات **مقترحة** في `platform/env/environments.json`؛ لم يُفترض وجود أي منها. الموجود فعلاً (من الجرد): ثوابت النشر الحالية وCNAME وإعدادات `wrangler.toml`؛ غير المعروف: منطقة DNS الفعلية وإعدادات Cloudflare والحساب (انظر §10).

## 2) نظام الإعدادات
`platform/env/` (انظر `platform/env/README.md`): سجل بيئات بلا أسرار + حارس `envguard` (يعمل في Worker وNode وفي أدوات النشر) + مثال محلي. `ENVIRONMENT=production|beta|local`؛ غيابه = production ضمنياً (توافق مع النشر القائم). **فحوص تمنع الإقلاع** في Beta إن حملت أي متغير: مضيف/مرجع Supabase/مفتاح عام لـProduction، مفتاح حيّ (`live_`/`sk_live`/`pk_live`/`gk_live_`)، `CHARGILY_MODE≠test`، `PUBLIC_URL` بمضيف آخر، بيانات Meta، أو قائمة سماح خروج فيها محظور. لا قيمة تُطبع في الأخطاء. الحالة: **VERIFIED** (محلياً، `envguard.test.mjs` 41).

## 3) مكونات العزل (الحالة الفعلية لكل مكوّن)

| المكوّن | آلية العزل | الدليل | الحالة |
|---|---|---|---|
| قواعد البيانات والجداول (D1) | قاعدة باسم مستقل + هوية `pf_meta('environment')`؛ Worker يرفض الإقلاع بهوية غائبة/مخالفة (Beta على قاعدة Production وبالعكس) ولا يكتب فيها | `beta-isolation` I3 (نقطة دخول Worker الفعلية، D1 محاكاة) | `PARTIALLY VERIFIED` — محلي؛ **D1 البعيد: BLOCKED** |
| قاعدة Supabase (متجر/دخول/إدارة/تحليلات) | مشروع مستقل؛ الباني والحارس يرفضان مرجع/مفتاح Production | `test-beta-build` B1–B5، `envguard` G2 | **BLOCKED** (المشروع غير مُنشأ) — الرفض مُثبَت، والاستقلال الفعلي لا |
| مفاتيح API والأسرار | تُولَّد جديدة لكل بيئة؛ مفتاح بيئة لا يعمل في الأخرى (تجزئة في قاعدتها)؛ رمز الإدارة منفصل | `beta-isolation` I4؛ `test-beta-deploy` (dry-run) | `PARTIALLY VERIFIED` — لا يمكن إثبات قيم الأسرار الفعلية |
| جلسات المستخدمين والمصادقة | origin مختلف ⇒ localStorage/كوكيز منفصلة؛ Supabase Auth لمشروع Beta؛ مفاتيح مستأجرين لكل قاعدة | I4؛ جرد الجلسات | `PARTIALLY VERIFIED` (Auth Beta: **BLOCKED**) |
| ملفات Storage | لا R2/KV مربوط في النشر؛ buckets Supabase تتبع المشروع | جرد | `PARTIALLY VERIFIED` (لا ملفات مشتركة في الكود؛ Beta Storage: BLOCKED) |
| الصور والوسائط | حزمة Beta بلا صور/منتجات الإنتاج (أساس `make-template` + طبقة Beta)؛ أرقام طلبات/مبالغ Production أُزيلت | `test-beta-build` B4 | `VERIFIED` (محلياً) |
| الطلبات والمدفوعات والمحافظ | قاعدة مستقلة + وضع test + حجب الخروج؛ **سيناريو أسوأ حالة** (مفتاح حيّ ووضع live مخزَّنان داخل بيانات Beta) ⇒ 502 ولا طلب يخرج؛ وضع test يمرّ لمضيف Chargily التجريبي فقط | `beta-isolation` I5 (+ شاهد ضابط: Production يصل للمضيف الحيّ على stub) | `VERIFIED` محلياً على stub؛ **Chargily sandbox الحقيقي: BLOCKED** |
| Webhooks | الصادرة: كل وجهة خارج السماح محجوبة؛ الواردة: `PUBLIC_URL` يُلزَم بمضيف Beta وأسرار التوقيع لكل مستأجر/قاعدة | I6؛ `envguard` | `PARTIALLY VERIFIED` (استقبال Webhook حقيقي من Chargily/ياليدين: BLOCKED) |
| البريد والرسائل | الخروج لمزوّدي البريد/SMS/WhatsApp/Meta محجوب؛ إنشاء دعوة Beta لا يُرسل شيئاً (الكود يُعرَض للمشغّل) | I5، `beta-module` M2/M10، `envguard` G3 | `VERIFIED` محلياً |
| المهام المجدولة وQueues | cron لكل Worker Beta وحده (`deploy.mjs` على اسم Worker Beta)؛ بوابة Beta تُربط بمنصة Beta (`service`+`PLATFORM_URL`)؛ لا workflow ينشر | `test-beta-deploy`، `test-workflow-policy`، I8 | `PARTIALLY VERIFIED` (dry-run بلا Cloudflare) |
| Logs وAnalytics | `pf_audit` لكل قاعدة (+ أثر `egress.blocked`)؛ `pixels.json` فارغ في Beta؛ زيارات/تحليلات Beta في مشروع Supabase Beta | I5؛ بناء Beta | `PARTIALLY VERIFIED` (Supabase Beta: BLOCKED) |
| النطاقات وSSL | `beta.alyssumdz.com` + `beta-api`/`beta-shipping` على `alyssumhub.fyi`؛ لا CNAME ولا sitemap ولا فهرسة | `test-beta-build` B6 | **BLOCKED/NOT TESTED** — لم تُنشأ سجلات DNS ولا شهادات |
| Cache وCDN | origin وservice-worker منفصلان؛ لا اشتراك في مفاتيح cache مع Production | جرد | `NOT TESTED` (إعداد Cloudflare غير معروف) |

## 4) الخدمات المشتركة (غير قابلة للفصل بأمان — تُصنَّف صراحةً)
1. **حساب Cloudflare ورمز API:** مقترح استعمال الحساب نفسه (`CF_ACCOUNT_ID` صريح) ما لم تقرّر حساباً مستقلاً. **رمز واسع الصلاحية يعني أن تسرّبه يؤثر على البيئتين** ⇒ التوصية: رمز لـBeta بصلاحية Workers/D1 على الحساب مع حذف اعتماد Production من بيئة نشر Beta. **BLOCKED/قرار مطلوب.**
2. **منطقة `alyssumhub.fyi`:** مضيفا Beta (`beta-api`, `beta-shipping`) في المنطقة نفسها؛ مسار شامل `*/*` للموزّع (tenant-router) إن فُعِّل في المنطقة **يلتقط مضيفي Beta** ⇒ يجب ألا يُفعَّل أو يُستثنى. **غير معروف من المستودع.**
3. **مستودع GitHub:** لوحة المتجر تكتب إلى `main` عبر PAT المالك؛ حزمة Beta تُفرَّغ فيها `repoOwner/repoName` ويُحجب `saberbalbouzi-ui` (فحص B4) فلا تكتب Beta إلى مستودع الإنتاج. قناة التحديث `raw.githubusercontent…/main/releases` تخص عملاء PHP وليست جزءاً من Beta.
4. **تطبيق Meta الواحد** (مسارات رجوع محددة): محظور في Beta (`meta_credentials_in_beta`، خطوة `meta` مرفوضة) ما لم يُنشأ تطبيق مستقل.

## 5) وظائف المنصة في Beta (17 بنداً) — بنوع الدليل
**الأنواع:** `حقيقي-محلي` = متجر PHP حقيقي معزول + Chromium حقيقي · `نقطة دخول Worker` = شيفرة Worker الحقيقية فوق D1 محاكى · `stub` = fetch مُحاكى · `تكامل حقيقي` = خدمة خارجية فعلية (**لا شيء منها أُجري**). نتائج «CI» = التشغيل 4289 على `f91e5b37` (قبل تعديلات هذه الجولة).

| # | الوظيفة | ما يغطيها | النوع | الحالة |
|---|---|---|---|---|
| 1 | التسجيل وتسجيل الدخول | تسجيل Beta بدعوة وبمرحلة (`beta-module` M1–M6، 37 فحصاً)؛ دخول لوحة المتجر: `test-hand` | نقطة دخول Worker؛ حقيقي-محلي (PHP) | `PARTIALLY VERIFIED` — Supabase Auth لـBeta **BLOCKED** |
| 2 | إنشاء متجر جديد | إنشاء المستأجر + مفتاح test عند التسجيل؛ إنشاء موقع SaaS (RPC `saas_submit`) | نقطة دخول Worker | `PARTIALLY VERIFIED` — مسار Supabase **NOT TESTED** |
| 3 | إعداد بيانات المتجر | `test-hand` (322) | حقيقي-محلي · CI ✓ | `VERIFIED` (للمتجر القائم؛ على حزمة Beta: NOT TESTED) |
| 4 | إنشاء المنتجات وإدارتها | `test-hand`، `commerce*` Worker | حقيقي-محلي · نقطة دخول Worker | `VERIFIED` (نفس التحفظ) |
| 5 | رفع الصور والوسائط | `test-assets`، `test-edition-real` | حقيقي-محلي · CI ✓ | `PARTIALLY VERIFIED` (تخزين Beta: BLOCKED) |
| 6 | صفحات الهبوط وتحريرها | `test-hand` (مطوّر الصفحات)، `test-pagerater` | حقيقي-محلي · CI ✓ | `VERIFIED` (نفس التحفظ) |
| 7 | إعداد النطاقات | واجهة إدارة النطاقات فقط | — | **NOT TESTED / BLOCKED** (Cloudflare for SaaS لـBeta غير مُنشأ) |
| 8 | تجربة إصدار SSL | — | — | **BLOCKED** (يلزم نطاق اختبار وCloudflare for SaaS) |
| 9 | طلب تجريبي | `test-edition-real`، `test-digital-checkout`، `test-upsell`، `orders-idempotency*` | حقيقي-محلي + Worker محلي · CI ✓ | `VERIFIED` (محلياً/CI) |
| 10 | سعر المنتج والتوصيل | `test-shiptable`، `test-shipagg`، `commerce-strict` | محلي · CI ✓ | `VERIFIED` |
| 11 | مسار تأكيد الطلب | `phase*` وSpatial OS وorders tests | حقيقي-محلي · CI ✓ | `VERIFIED` |
| 12 | المحفظة والدفع Sandbox | `wallet*`، `payments*` (stub)، `beta-isolation` I5 (مسار test عبر حارس الخروج) | stub/محاكاة | `PARTIALLY VERIFIED` — **Chargily sandbox الحقيقي BLOCKED** |
| 13 | Webhooks | `payments-12c` (توقيع)، `test-webhook-php.php` | محلي | `PARTIALLY VERIFIED` — لا Webhook حقيقي |
| 14 | إدارة الطلبات | `test-hand`، `phase12b-orders` | حقيقي-محلي · CI ✓ | `VERIFIED` |
| 15 | لوحة الإدارة | `test-hand`، E-07، `test-beta-browser` (admin.html تحمّل بلا اتصال بالإنتاج) | حقيقي-محلي · CI ✓ (Beta: محلي) | `PARTIALLY VERIFIED` |
| 16 | الهاتف والحاسوب | `test-hand` (جوال)، Viewports 66، `test-beta-browser` (360 و1280) | Chromium محاكاة (ليس جهازاً) | `PARTIALLY VERIFIED` |
| 17 | Spatial OS وAgentNLU | job `spatial-os` (781 فحصاً) على GitHub (التشغيل 4289) | Chromium برمجي (SwiftShader)، ميكروفون وهمي | `VERIFIED` على CI؛ GPU/ميكروفون حقيقي: NOT TESTED |

> لا يُحتسب نجاح ما هو `stub` على أنه تكامل حقيقي. **أي تكامل حقيقي (Supabase Beta، Chargily sandbox، رسائل، شركات توصيل، SSL، DNS) لم يُجرَّ.**

## 6) إدارة مستخدمي Beta (وحدة `beta`، تُحمَّل في غير الإنتاج فقط)
المراحل `internal` (افتراضي) · `closed` · `public`؛ **التسجيل مغلق افتراضياً** (`signups_open=false`). دعوات (كود يُعرَض مرة واحدة، يُخزَّن هاشاً، انتهاء 14 يوماً افتراضياً، استهلاك ذرّي، سحب)، إيقاف/تفعيل التسجيل، تعطيل/تفعيل حساب تجريبي (مفتاحه يتوقف فوراً)، حدود يومية ذرّية لكل مستأجر (طلبات API وطلبات المتجر؛ افتراضيّاً 5000/200)، تنبيه Beta (`/v1/beta/status` + شريط في الواجهة)، تقارير أخطاء وملاحظات (`/v1/beta/feedback`، 10/ساعة لكل IP، الواجهة تلتقط أخطاء JS بحدّ 3). **كل حساب يُنشأ بمفتاح `pk_test_` فقط.** لا إرسال بريد/دعوات (يُسلَّم الكود يدوياً). مُختبَر: `beta-module` 37. **غير منفَّذ:** حدّ عدد المنتجات (`products_max`)، حذف دوري لجداول `beta_usage/feedback`، قناة إشعار للمشغّل (بريد/واتساب).

## 7) النطاق والنشر (مقترحات — لم يُنفَّذ شيء)
- **النطاق:** `beta.alyssumdz.com` (واجهة)، `beta-api.alyssumhub.fyi`، `beta-shipping.alyssumhub.fyi`. بدائل: `api.beta.alyssumdz.com` يحتاج شهادة متقدمة (Advanced Certificate Manager).
- **SSL:** شهادة Universal من Cloudflare لنطاقات المستوى الأول؛ نطاقات عملاء Beta عبر Cloudflare for SaaS على منطقة Beta. **تجربة الإصدار: BLOCKED.**
- **فصل البناء والنشر:** الواجهة: `build-beta.py` ⇒ `dist/beta` (غير مُلتزَم به) ⇒ رفع يدوي. الـAPI: `deploy.mjs --env beta`. لا workflow ينشر (سياسة مُختبَرة: `test-workflow-policy.py`).
- **منع النشر المتبادل:** `--env` إلزامي بلا افتراضي؛ Beta بلا `--production` ولا `ALLOW_PRODUCTION_DEPLOY`؛ Production يتطلب التأكيدين معاً؛ أسماء موارد Beta ≠ Production؛ حساب/منطقة Beta صريحان بلا افتراضات إنتاجية. **VERIFIED** (`test-beta-deploy` 40، dry-run بلا شبكة).
- **Rollback:** `deploy.mjs --env beta rollback` يعيد **كود الـWorker** إلى النشرة السابقة (لا يمسّ D1 ولا Worker آخر)؛ المخطط إضافي دائماً (`IF NOT EXISTS`) فالتراجع عن الكود آمن مع المخطط الأحدث؛ استعادة البيانات: D1 Time Travel على قاعدة **Beta** فقط. **PARTIALLY VERIFIED** (محاكى؛ شكل ردّ Cloudflare الحقيقي لم يُتحقَّق منه).

## 8) الإصدارات والتحديثات
`/health` في غير الإنتاج: `environment`، `version`، `sha` (يحقنهما `deploy.mjs` كـbindings)، `schema.{expected,actual}` (بصمة `schema.sql` مقابل ما في `pf_meta`)، `db_environment`، `egress_blocked`. `deploy.mjs status` يقارن المنشور بالمستودع. ترقية Beta = `worker` فقط (`db` أولاً إن تغيّر المخطط) دون لمس Production. **مقارنة الأخطاء/الأداء بين الإصدارات:** كل ملاحظة Beta مختومة بـSHA؛ والمقارنة الدقيقة للأداء تتطلب تحليلات Cloudflare لكل إصدار — **NOT TESTED**. `VERSION` لم يتغيّر.

## 9) شروط القبول (الحالة اليوم)
| # | الشرط | الحالة | ملاحظة |
|---|---|---|---|
| 1 | استقلال قاعدة بيانات Beta | `PARTIALLY VERIFIED` | بالهوية والرفض على محاكاة D1؛ **D1 وSupabase Beta الحقيقيان: BLOCKED** |
| 2 | عدم الوصول إلى Production | `PARTIALLY VERIFIED` | لا اتصال صادر من Worker/المتصفح (مُثبَت)؛ لكن اعتماد Cloudflare المشترك قد يصل للبيئتين (§4) |
| 3 | استقلال الأسرار والتكاملات | `PARTIALLY VERIFIED` | توليد/فحص آلي؛ لا إثبات للقيم الفعلية |
| 4 | نجاح اختبارات العزل | `VERIFIED` محلياً | جدول §11؛ **لم تُشغَّل على GitHub بعد** |
| 5 | الاختبارات الأساسية للمنصة | `VERIFIED` محلياً + CI سابق | انظر §5 |
| 6 | مسار نشر مستقل | `PARTIALLY VERIFIED` | أدوات + باني + دليل؛ لا نشر فعلي ولا قرار استضافة الواجهة |
| 7 | Rollback واضح | `PARTIALLY VERIFIED` | §7 |
| 8 | تقارير القيود | `VERIFIED` | هذا الملف + `BETA-DEPLOYMENT-RUNBOOK.md` |
⇒ **Beta ليست «جاهزة» بتعريفك حتى تُغلَق (1)–(3) و(6)–(7) بموارد حقيقية.**

## 10) المخاطر
1. **ثغرة مكتشَفة وأُصلحت:** `make-template.py` كان ينقل `assets/data/payments.json` (أرقام طلبات ومبالغ حقيقية) إلى كل حزمة عميل — أُصلح + اختبار (`test-template-pack`، `test-beta-build` B4).
2. **أداة النشر القائمة كانت تنشر فوق Production بمجرد تشغيلها** (ثوابت + حساب/منطقة افتراضيان) — استُبدلت بـ`--env` إلزامي وتأكيدين للإنتاج. **أمر النشر القديم بلا `--env` لم يعد يعمل** (يلزم تحديث أي توثيق/سكربت قديم).
3. حساب/رمز Cloudflare مشترك (§4)؛ منطقة DNS مشتركة؛ `*/*` للموزّع.
4. مفاتيح تخزَّن **داخل بيانات** Beta (تكامل Chargily بمفتاح حيّ مثلاً) لا تكشفها فحوص المتغيرات — يغطيها حجب الخروج فقط (مُثبَت على stub).
5. D1 البعيد: دعم بعض عبارات التنظيف/الفهارس وتفاصيل `meta` غير مُجرَّب (انظر `FINAL-NEXT-PHASE-REPORT.md` §10).
6. حارس `acg-ov` (منع الأتمتة) في بناء Beta يتطلب مفتاح المالك في الاختبارات الآلية؛ لم يُغيَّر.
7. قناة تنبيه خارجية غائبة (لا بريد/واتساب للمشغّل) لتنبيهات `pf_idem` ولملاحظات Beta.

## 11) ما اختُبر فعلياً (محلياً، هذه الجولة)
| الاختبار | الأمر | النتيجة | النوع |
|---|---|---|---|
| حارس البيئات | `node platform/api/test/envguard.test.mjs` | 41/41 | منطق نقي |
| عزل Beta (نقطة دخول Worker، بيئتان وقاعدتان) | `…/beta-isolation.test.mjs` | 31/31 | Worker حقيقي + D1 محاكى + fetch مسجَّل |
| وحدة Beta | `…/beta-module.test.mjs` | 37/37 | Worker حقيقي + D1 محاكى |
| إقلاع البوابة في Beta | `platform/gateway/test/beta-boot.test.mjs` | 8/8 | Worker حقيقي + D1 محاكى |
| أدوات النشر (dry-run، fetch معطَّل) | `node scripts/test-beta-deploy.js` | 40/40 | بلا شبكة |
| سياسة workflows (+ اختبار سلبي) | `python3 scripts/test-workflow-policy.py` | 31/31 | ثابت |
| بناء Beta (فحص تسرّب/أسرار/فهرسة) | `node scripts/test-beta-build.js` | 18/18 | ملفات |
| Beta في Chromium (لا اتصال بالإنتاج، شريط، ملاحظات) | `node scripts/test-beta-browser.js` | 29/29 | متصفح حقيقي |
| ملكية الجداول (boundaries) | `…/boundaries.test.mjs` | 282/282 | ثابت |
| سجل البيئات متزامن | `node platform/env/sync.mjs --check` | ✓ | |
تفاصيل الانحدار الكامل في `docs/FINAL-NEXT-PHASE-TESTS.md` §G.

## 12) ما لم يُختبر / محظور
Supabase Beta (إنشاء، تطبيق SQL، Auth، Storage، Functions)؛ D1 وWorkers الحقيقية على Cloudflare (النشر/rollback/Time Travel)؛ DNS وSSL؛ Chargily sandbox وWebhook حقيقي؛ البريد/SMS/WhatsApp؛ شركات التوصيل sandbox (`gk_test_`)؛ Cloudflare for SaaS للنطاقات؛ استضافة الواجهة الساكنة؛ مقارنة أداء الإصدارات؛ مسار Beta على أجهزة/متصفحات حقيقية؛ tenant-router لـBeta؛ تحليلات Beta.

## 13) ما يحتاج موافقتك/إدخالك
1. **قرار استضافة واجهة Beta** (Cloudflare Pages؟ أم غيرها) وحساب Cloudflare (مشترك أم مستقل) ورمز Beta محدود الصلاحية.
2. **إنشاء مشروع Supabase مستقل لـBeta** (بإذنك) وتطبيق SQL بالترتيب (الدليل).
3. **اعتماد sandbox:** مفاتيح Chargily test، sandbox الشحن، ومزوّد بريد/رسائل تجريبي (أو إبقاؤها محجوبة).
4. **DNS/SSL:** إنشاء السجلات الثلاثة (أنت أو بموافقتك) — لم أنشئ شيئاً.
5. دفع هذا الالتزام لتشغيل CI، ثم قرار دمج لاحق (لا دمج في `main` الآن).
6. قناة إشعار للمشغّل (تنبيهات pf_idem/ملاحظات Beta).
