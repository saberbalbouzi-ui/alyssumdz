# جاهزية تكاملات Beta الحقيقية (BETA-INTEGRATION-READINESS)

> **الحكم الصريح (محدَّث 2026-11-16):** **Supabase Beta (`alyssum-beta`) مُهيَّأ ومُختبَر فعلياً على المشروع الحقيقي**: الحزمة طُبِّقت (11 ملفاً) وإعدادات Auth ضُبطت، والاختبار التكاملي الحقيقي **34/34** (§11). **D1 وCloudflare وChargily لم يُنشأ لها أي مورد ولم تُشغَّل اختباراتها على خدمات حقيقية** (`SKIPPED`/`BLOCKED`). بيئة GitHub `alyssumdz-beta` **`BLOCKED`**: لم تُنشأ (واجهة البيئات محجوبة عن جلسة التنفيذ) والتعليمات جاهزة (§4). لم يُلمس مشروع Production، ولم يُنفَّذ أي نشر/DNS/دمج/دفع/عملية مالية. القرارات المعتمدة: Cloudflare Pages للواجهة، Workers للـAPI، D1 مستقل، Supabase مستقل، Chargily Sandbox فقط.
>
> **تركيبة هذا الفرع (`beta/supabase-isolation`، مبني على `main`):** يضم **سجل البيئات وأدوات Supabase Beta واختبارات العزل/التكامل (Supabase وChargily-stub) وسياسة الـworkflows ووثيقة الجاهزية هذه فقط**. الأجزاء التالية المذكورة في الأقسام 2 و5 و7 و8 **غير موجودة في هذا الفرع** (محجوزة بانتظار قرار): وحدة `beta` وهجرات D1 والمُطبِّق (`d1-migrate`) واختبارات `beta-isolation`/`beta-module`/`migrations`/`d1-beta`/`gateway beta-boot` و`test-beta-deploy` (تحتاج تعديلات في ملفات Worker/النشر المشتركة)، وبناء واجهة Beta (`build-beta.py`، يحتاج إصلاح تسرّب `payments.json` في `make-template.py`)، وتدريب PostgreSQL المحلي (`test-supabase-beta.js` + `tests/local/`، من مرحلة 12B وغير موجود على `main`)، و`test-beta-resources.js`، و`BETA-DEPLOYMENT-RUNBOOK`/`BETA-LAUNCH-READINESS`، وسطر CI في `tests.yml`. الأرقام في §8 للفرع القديم؛ نتائج هذا الفرع في آخر هذا الملف (§12).
>
> الحالات: `VERIFIED` أُثبت كما هو موصوف · `PARTIALLY VERIFIED` أُثبت محلياً/بمحاكاة فقط · `BLOCKED` ينتظر اعتماداً أو قراراً · `NOT TESTED` لم يُجرَّب.
> المصدر الوحيد للأسماء والأسرار: `platform/env/beta-resources.json` (يُولَّد منه `platform/env/beta.env.example` ويتحقق منه `scripts/test-beta-resources.js`).

## 1) ما يمكن تنفيذه الآن وما ينتظر

| البند | الحالة اليوم | ما يلزم لتشغيله حقيقياً |
|---|---|---|
| حزمة SQL لـSupabase Beta (ترتيب، استبدال بذور المالك، فحص الهوية) | **`VERIFIED`** — طُبِّقت على `alyssum-beta` الحقيقي (11/11 ملفاً ✓) وتحققت بالاختبار الحقيقي §11؛ تدريب PostgreSQL المحلي (25/25 في جلسة سابقة) **لم يُعاد إنتاجه هنا** (20/26 على الشجرة المعدّلة وغير المعدّلة؛ سبب بيئي: لا مخطط `auth` ولا دور `anon` في حاويتي) | — |
| حراسات أداة التطبيق على Supabase (مرجع Production/اسم مشروع/`--confirm-ref`) | `VERIFIED` بـfetch محاكى | — |
| هجرات D1 (`platform/api/migrations`) + المُطبِّق + checksum | `VERIFIED` محلياً (16/16) | — |
| اختبار D1 Beta (ادّعاء ذرّي، فهارس، خطط، تنظيف مقيَّد) | `PARTIALLY VERIFIED` — 15/15 على miniflare المحلي (ليس D1 البعيد) | قاعدة D1 `alyssum-platform-api-beta` + رمز D1:Edit |
| اختبار Supabase Auth/DB(RLS)/Storage على مشروع حقيقي | **`VERIFIED` (34/34)** على `alyssum-beta`؛ ما لم يُجرَّب مذكور في §11.3 | — |
| إعداد Auth لـBeta (`supabase-beta-auth.mjs`) | **`VERIFIED`** — Site URL وRedirect وحدّ كلمة المرور طُبِّقت وأُعيدت قراءتها | — |
| حواجز «لا رجوع احتياطي إلى Production» عند غياب متغير/فشل الاتصال | **`VERIFIED`** — `beta-no-fallback.test.mjs` 25/25 (بلا شبكة حقيقية) | — |
| اختبار Chargily Sandbox | `PARTIALLY VERIFIED` — `--stub` 11/11 (محاكاة صريحة) | مفتاح `test_sk_…` مخصص لـBeta |
| الحواجز المالية (لا مسار حيّ من Beta) | `VERIFIED` محلياً (طبقات §7) | — |
| workflow يدوي للتكامل `beta-integration.yml` | جاهز، **لم يُشغَّل**؛ بيئة GitHub **`alyssumdz-beta` `BLOCKED`** (لم تُنشأ) | إنشاء Environment `alyssumdz-beta` وإدخال متغيراته/أسراره (§4) |
| `_headers` لـPages (noindex + nosniff + no-store للإصدار) | `VERIFIED` في ناتج البناء المحلي | — |
| إنشاء أي مورد (§2، §3) / DNS / نشر | `BLOCKED` — **موافقة مستقلة** | قراراتك D1–D6 (§9) |

## 2) موارد Cloudflare المطلوبة (كلها `NOT CREATED`، كلها تتطلب موافقتك)

| المعرّف | النوع | الاسم | يُنشأ بـ | يعتمد على |
|---|---|---|---|---|
| cf-d1-api | D1 | `alyssum-platform-api-beta` | `deploy.mjs --env beta db` | — |
| cf-d1-gateway | D1 | `alyssum-shipping-gateway-beta` | gateway `deploy.mjs --env beta db` | — |
| cf-worker-api | Worker (+cron) | `alyssum-platform-api-beta` | `deploy.mjs --env beta worker` | D1 + أسرار |
| cf-worker-gateway | Worker | `alyssum-shipping-gateway-beta` | gateway `deploy.mjs --env beta worker` | Worker الـAPI |
| cf-route-api | Route | `beta-api.alyssumhub.fyi/*` | `deploy.mjs --env beta route` | D2 + سجل DNS |
| cf-route-gateway | Route | `beta-shipping.alyssumhub.fyi/*` | gateway `route` | سجل DNS |
| cf-pages | Pages | `alyssum-beta-web` | `wrangler pages deploy dist/beta` | ناتج `build-beta.py` |
| cf-pages-domain | نطاق Pages | `beta.alyssumdz.com` | لوحة Pages | D2 |
| cf-dns | CNAME | `beta` / `beta-api` / `beta-shipping` | يدوي منك أو رمز DNS مؤقت بموافقة | D2 |

**رمزان منفصلان (لا رمز Production):**
- **رمز النشر (خارج GitHub — على جهازك فقط):** Workers Scripts:Edit، D1:Edit، Pages:Edit، Workers Routes:Edit (منطقة Beta فقط)، Account Settings:Read. **بلا DNS** (يُمنح لاحقاً بموافقة مستقلة وبنطاق المنطقة).
- **رمز الاختبار (`BETA_CF_API_TOKEN` في GitHub):** `Account: D1: Edit` فقط. تحذير: على حساب مشترك لا يمكن حصر رمز D1 بقاعدة واحدة؛ لذا نوصي بحساب Cloudflare مستقل لـBeta (قرار D1).

## 3) موارد Supabase (المشروع أُنشئ في حساب مستقل، **والحزمة طُبِّقت عليه** — انظر §11)

| البند | القيمة |
|---|---|
| المشروع | اسمه **`alyssum-beta`** حصراً. أُنشئ بحساب Supabase مستقل، مرجعه `xhdnqnxmcmfhrgctlkzy` (غير سرّي، مثبَّت في السجل؛ **تحقق منه الـAPI فعلاً**: الاسم `alyssum-beta`، المنطقة `eu-west-1`، `ACTIVE_HEALTHY`، والـPAT يرى هذا المشروع وحده)؛ ممنوع الخلط مع `ALYSSUMDZ` (Production) و`imaginia-staging` (منتج آخر) — تتحقق منه الأداة والاختبار |
| Auth | التسجيل العام **OFF** (إلزامي؛ الاختبار `[A1]` يفشل إن بقي مفعّلاً)، مستخدم واحد: مدير Beta ببريد مخصص ≠ بريد المالك، Site URL `https://beta.alyssumdz.com`، Redirect `https://beta.alyssumdz.com/**` |
| Storage | `tenants` (قراءة عامة، لا سياسة كتابة) و`editor` (رفع للمجهول بمنحة `editor.upload_grants` وأنواع صور فقط) — تُنشأ بـSQL لا يدوياً |
| SQL | **9 ملفات** + صف `admins` لبريد Beta (مولَّد): `supabase/schema` ← `sql/schema` ← `roles` ← `hub` ← `editor` ← `experts` ← `pixabay-cache` ← `hardening-v01` ← `hardening-v01b` (**بعد تجريد كتلة RUQYA**). مستبعَد: `apply-pending.sql` و**`ruqya.sql`** (الرقية وحجز المواعيد وظيفة موقع ALYSSUM فقط). القاعدة القائمة طُبِّق عليها سابقاً ما قبل هذا الاستثناء: انظر `docs/BETA-RUQYA-OBJECTS-REPORT.md` |
| Edge Functions | لا تُنشر الآن؛ إن لزم: `courier`/`ship-gateway`/`platform-proxy` بأسرار Beta فقط، **لا `domains` ولا مفاتيح `*_live_`** |
| `service_role` | **لا يُخزَّن في GitHub ولا في أي ملف**؛ الاختبارات تستعمل جلسة المدير + PAT لاستعلامات SQL |

> **ثلاثة أخطاء في خطتي الأولى اكتشفها تدريب PostgreSQL المحلي وصُحِّحت قبل أي تطبيق حقيقي:** (1) `hardening-v01.sql` يعتمد على `hub_my_sites` فلا يصح استبعاد `hub.sql` (يُضمَّن الآن **بعد حذف بذرة مستودع Production منه**)؛ (2) يعتمد على جداول `experts`/`pixabay_cache` (لا الرقية؛ تصحيح لاحق: `hardening-v01` يذكر الرقية 0 مرة) فلم تكن «اختيارية»؛ (3) سجل الموارد وصف حاوية `editor` عامةً/خاصةً خطأً. لولا التدريب لانهار `hardening-v01` على Beta أثناء التطبيق.

## 4) إعدادات GitHub وأسماء الأسرار (دون أي قيمة في المستودع)

**الحالة: `BLOCKED` — البيئة `alyssumdz-beta` لم تُنشأ.** واجهة `repos/…/environments` محجوبة عبر وكيل جلسة التنفيذ (HTTP 403 «not permitted through this proxy»)، ولا أضع أسراراً في ملفات المستودع. أُعيدت تسمية البيئة في السجل والـworkflow والسياسة (W6/W7 تلتقط الاسمين) والتوليد (`sync.mjs --check` نظيف).

الإعداد مرة واحدة (بيدك): GitHub ← Settings ← Environments ← **New environment: `alyssumdz-beta`** ثم (قرار D6) مراجعون مطلوبون + تقييد الفروع (`claude/*` وmain).

**متغيرات (Variables — غير سرّية):** `BETA_CF_ACCOUNT_ID` · `BETA_D1_NAME` (= `alyssum-platform-api-beta`) · `BETA_API_URL` · `BETA_SUPABASE_URL` · `BETA_SUPABASE_REF` · `BETA_SUPABASE_ANON_KEY` (مفتاح عام) · `BETA_ADMIN_EMAIL`.

**أسرار (Secrets):** `BETA_CF_API_TOKEN` · `BETA_SUPABASE_PAT` · `BETA_ADMIN_PASSWORD` · `BETA_API_ADMIN_TOKEN` · `BETA_CHARGILY_TEST_SECRET_KEY`.

**طريقة الإدخال الآمن (لا تكتب القيمة في المحادثة أبداً):**
```bash
gh secret set BETA_SUPABASE_PAT --env alyssumdz-beta          # يطلب منك اللصق محلياً في الطرفية
gh secret set BETA_ADMIN_PASSWORD --env alyssumdz-beta
gh variable set BETA_SUPABASE_REF --env alyssumdz-beta --body "xhdnqnxmcmfhrgctlkzy"   # للمتغيرات غير السرّية فقط
gh variable set BETA_SUPABASE_URL --env alyssumdz-beta --body "https://xhdnqnxmcmfhrgctlkzy.supabase.co"
gh variable set BETA_ADMIN_EMAIL --env alyssumdz-beta     # بريد مدير Beta (غير سرّي لكن لا تُدخله في المحادثة)
```
أو من الواجهة: Settings ← Environments ← alyssumdz-beta ← Add secret. المفتاح العام `BETA_SUPABASE_ANON_KEY` (publishable) يُقرأ من لوحة المشروع ← API Keys (لا `service_role` ولا `sb_secret_` أبداً). وللتشغيل المحلي: انسخ `platform/env/beta.env.example` إلى مسار **خارج المستودع** وعبّئه ثم `set -a; . ~/.alyssum/beta.env; set +a`.

ملاحظات صريحة: `BETA_API_URL` و`BETA_API_ADMIN_TOKEN` مُعرَّفان لاختبار دخان API **لم يُكتب بعد** (لا اختبار يستعملهما اليوم). أسرار Workers نفسها (`APP_ENCRYPTION_KEY`, `ADMIN_TOKEN`, `PLATFORM_SECRET`…) يولّدها `deploy.mjs --env beta secrets --save-secrets <ملف-خارج-المستودع>` ولا تدخل GitHub سوى `ADMIN_TOKEN` عند الحاجة.

## 5) هجرات واختبارات D1 التجريبي

- `platform/api/migrations/0001_baseline.sql` (+ أي لاحقة) تُطبَّق بـ`node platform/api/tools/d1-migrate.mjs --env beta [--status|--dry-run]`: ترفض غير `beta`/`local`، تتحقق من `pf_meta.environment` قبل أي كتابة، وتسجّل `pf_migrations(name, sha)` وترفض تعديل هجرة مطبَّقة (`migration_checksum_mismatch`).
- `platform/api/test/integration/d1-beta.integration.mjs`: S0 هوية القاعدة · S1 الهجرات بنفس الـchecksum · ادّعاء ذرّي متزامن وملكية الرمز · خطط الاستعلام والفهارس (`ix_pf_idem_st`) · عدّاد `rows_read/rows_written` · تنظيف **مقيَّد بمستأجر الاختبار** (لا يمسّ بيانات Beta الأخرى).
- الأوضاع: `--local` (miniflare/workerd — **ليس** D1 الحقيقي، 15/15) · بلا علم = D1 البعيد عبر REST (`SKIPPED` بلا اعتماد، ويرفض اسماً غير `alyssum-platform-api-beta` أو أي قاعدة إنتاج برمز 2 قبل أي اتصال).
- `ix_pf_idem_at` الاختياري **لم يُطبَّق على أي قاعدة**، ومقرَّر ألا يُطبَّق على Production.

## 6) اختبارات Supabase Beta (Auth وStorage وDatabase)

`platform/supabase/tests/beta/beta-supabase.integration.mjs` (حقيقي؛ `--selfcheck` للحراسات فقط؛ **`--group core|store|all`**، انظر `docs/BETA-TEST-GROUPS.md`):

| المحور | الفحوص |
|---|---|
| هوية (P) | اسم المشروع المُسترجَع بالـPAT = `alyssum-beta` وليس محمياً؛ وإلا يتوقف **قبل أي كتابة** |
| Database (D) | RLS مفعّل على كل جداول `public`؛ مدير Beta وحده في `saas_admins`؛ لا عملاء/مواقع/مستودعات Production؛ لا أثر لهوية المالك |
| Auth (A) | `disable_signup=true`؛ محاولة تسجيل مرفوضة؛ كلمة مرور خاطئة 400؛ دخول المدير ينجح؛ الجلسة ببريد المدير |
| RLS عبر API (R) | `is_admin()` = true للمدير، ومرفوض لـanon؛ anon لا يقرأ `orders/staff/saas_admins/audit_log/pixabay_cache/admins` |
| طلب اصطناعي (S) | `submit_order` بهاتف اصطناعي ثم إعادة بالمفتاح نفسه ⇒ المعرّف نفسه بلا تكرار؛ **يُحذف الطلب في النهاية** |
| Storage (ST) | الحاويتان موجودتان؛ anon والمدير لا يكتبان في `tenants`؛ anon لا يرفع إلى `editor` بلا منحة؛ نوع `text/plain` مرفوض؛ لا كائنات متبقية |

حراسات قبل الاتصال: المفتاح ليس `service_role` ولا `sb_secret_` (وإن كان JWT فـ`role=anon` و`ref` يطابق)، الرابط = `https://<ref>.supabase.co`، المرجع ≠ Production، بريد المدير ≠ هوية المالك. **كل ما سبق على مشروع حقيقي `BLOCKED`/`NOT TESTED`.** المُجرَّب فعلاً: `scripts/test-supabase-beta.js` على PostgreSQL 16 المحلي (يغطي RLS وهوية البذور و`is_admin`/`submit_order`/منع التكرار بأدوار `anon`/`authenticated` — **لكن لا GoTrue ولا Storage API ولا PostgREST**، فتبقى محاور Auth/Storage بلا إثبات حقيقي).

## 7) Chargily Sandbox والحواجز المالية

`platform/api/test/integration/chargily-sandbox.integration.mjs`: رصيد اختباري (قراءة) ← جلسة دفع اختبارية بمبلغ رمزي (لا أموال حقيقية في بيئة `test`) ← قراءتها (غير مدفوعة) ← **إنهاء صلاحيتها**؛ لا يدفعها ولا يُرسل webhook خارجياً. كل طلب يمرّ عبر `guardFetch` بسياسة Beta. `--stub` = محاكاة محلية موسومة صراحةً.

**طبقات منع أي عملية مالية حقيقية من Beta (كلها مُختبرة محلياً):**
1. سجل البيئات: `payments=sandbox` ومسار الخروج المسموح `pay.chargily.net/test/` فقط (+DoH).
2. حارس الخروج `guardFetch`: القاعدة الحيّة `/api/v2` وكل مضيف آخر (ياليدين/بريد/واتساب/Production) ⇒ `EgressBlocked` قبل خروج أي بايت.
3. واجهة API ترفض تكامل Chargily بـ`mode≠test` أو مفتاح لا يبدأ بـ`test_` أو بادئات حيّة، وتحظر مزوّدين خارج القائمة المسموحة (`beta-isolation` 34/34).
4. وحدتا `payments`/`wallet` ترفضان `live_payments_forbidden` حتى لصفوف مستعادة من الإنتاج.
5. اختبار Chargily نفسه يرفض مفتاحاً غير `test_` برمز 2 قبل أي اتصال، ويُثبت أن كل الطلبات الصادرة ذهبت إلى `/test/`.
6. سياسة workflows (W6/W7، 57/57 مع 13 اختباراً سلبياً): `beta-integration.yml` يدوي فقط، `contents: read`، بيئة `alyssumdz-beta`، أسرار `BETA_*` فقط، بلا نشر/دفع/`service_role`/رموز Production.
7. `build-beta.py` + `test-beta-build.js`: لا مفتاح حيّ/سرّي/هوية إنتاج في ملفات المتصفح.

## 8) نتائج الاختبارات المحلية (هذه الجلسة)

| الاختبار | النتيجة |
|---|---|
| `scripts/test-supabase-beta.js` (حزمة + حراسات + PostgreSQL 16 محلي) | 25/25 في جلسة سابقة؛ **20/26 في هذه الحاوية** (نفس النتيجة على `HEAD` غير المعدّل؛ مخطط `auth`/دور `anon` غير مهيّأين بجذر) — `NOT REPRODUCED` |
| `scripts/test-beta-resources.js` / `test-beta-build.js` (بلا متغيرات `BETA_*` في البيئة؛ البناء يقرأها افتراضياً) | **24/24** / **19/19** |
| `scripts/test-workflow-policy.py` (W1–W7 + 13 اختباراً سلبياً) | **57/57** |
| `scripts/test-beta-deploy.js` | 40/40 |
| `platform/api/test/` `migrations` 16 · `envguard` 41 · `beta-isolation` 34 · `beta-module` 37 · `boundaries` 282 · `idem-prune` 19 · `idem-review` 34 · `platform` 56 · `payments` 29 · `payments-12c` 24 · `wallet` 75 · gateway `beta-boot` 8 | كلها ناجحة |
| `d1-beta.integration.mjs --local` (miniflare) | PASS 15/15 |
| `idem-d1-local.mjs` (N=20000) | 14/14 |
| `chargily-sandbox.integration.mjs --stub` | 11/11 (محاكاة) |
| `beta-supabase.integration.mjs --selfcheck` | 11/11 (حراسات؛ أُضيف G11) |
| `beta-supabase.integration.mjs --require` **على Beta الحقيقي** | **34/34** (§11) |
| `beta-no-fallback.test.mjs` | **25/25** |
| الثلاثة بلا اعتماد | `SKIPPED` برمز 0؛ مع `--require` برمز 3 (لا يمرّ كنجاح) |
| `test-template-pack.js` | 9/9 |

**لم يُشغَّل في هذه الجلسة:** مجموعة `test-hand.js` الكاملة واختبارات المتصفح (التعديلات لا تمسّ الواجهة سوى ملف `_headers` الجديد في ناتج Beta)، ولا CI البعيد للالتزام الجديد (لم يُدفع).

## 9) قرارات مطلوبة منك وترتيب التنفيذ المقترح

| القرار | توصيتي |
|---|---|
| D1 حساب Cloudflare مستقل لـBeta أم مشترك | مستقل (رمز D1 لا يُحصر بقاعدة واحدة) |
| D2 هل `alyssumdz.com` على Cloudflare (لا يُعرف من المستودع) | إن لم يكن: نطاق فرعي مفوَّض أو `pages.dev` مؤقتاً |
| D3 بريد مدير Beta (≠ بريد المالك) وكلمة مروره (تُدخَل في لوحة Supabase/GitHub لا في المحادثة) | `beta-admin@<نطاقك>` |
| D4 منطقة وخطة Supabase | منطقة أوروبية قريبة؛ المجانية تكفي وتتوقف عند الخمول |
| D5 حساب Chargily اختبار ومفتاح `test_sk_…` مخصص لـBeta | مفتاح جديد |
| D6 حماية بيئة GitHub `alyssumdz-beta` | مراجع واحد على الأقل + فروع `claude/*` وmain |

**الترتيب (كل خطوة بموافقة مستقلة):** (1) ~~Supabase~~ **أُنجز** (§11): مشروع `alyssum-beta` + `supabase-beta-apply.mjs --apply` + `supabase-beta-auth.mjs --apply` + الاختبار الحقيقي 34/34. (2) D1 ← إنشاء D1 Beta ← `d1-migrate` ← اختبار D1 الحقيقي. (3) D5 ← اختبار Chargily Sandbox. (4) إنشاء بيئة GitHub `alyssumdz-beta` وإدخال الأسرار ← `beta-integration.yml`. (5) لاحقاً فقط: نشر Workers/Pages وDNS (D2) ← اختبار دخان API. **لا شيء من هذا يُنفَّذ دون قولك.**

## 10) ما لم يُجرَّب / حدود الصدق

- لا مورد Cloudflare/Chargily أُنشئ (Supabase Beta أُنشئ سابقاً بيدك وهُيِّئ هنا)؛ رمز Cloudflare المحقون في هذه البيئة غير صالح (`Invalid API Token`) فلا D1 بعيد.
- Auth (GoTrue) وStorage API وPostgREST **جُرِّبت فعلياً على Beta** (§11)؛ الباقي غير المُجرَّب مفصَّل في §11.3.
- لم يُجرَّب نشر `_headers` على Pages (ترويسات HTTP الفعلية)، ولا SSL، ولا تفويض النطاق.
- سلوك `Management API /database/query` (حدود الحجم/المهلة/المعاملة الواحدة لكل ملف) لم يُقَس؛ قد يلزم تقسيم ملف كبير.
- اختبار Chargily الحقيقي لم يتحقق من سلوك webhook المُستضاف (يحتاج Worker Beta منشوراً ومسار خارجي)؛ التوقيع فقط مُختبَر محلياً بدالة المنصة.
- لا قناة تنبيه خارجية لتنبيهات `pf_idem`، و`products_max` غير مُنفَّذ، وإنشاء مستخدمين عبر دعوات Beta الحقيقية خارج هذه المرحلة.

## 11) تهيئة Supabase Beta المستقل — نتائج التنفيذ الحقيقي (2026-11-16)

المشروع المستهدف: **`alyssum-beta`** (`xhdnqnxmcmfhrgctlkzy`، `eu-west-1`، `ACTIVE_HEALTHY`). **لم يُلمس مشروع Production** (`qvdaiundlkfbmjlummni`): الـPAT المحقون يرى `alyssum-beta` وحده، ولم يُرسَل أي طلب إلى مضيف Production ولا إلى `ALYSSUMDZ` أو `imaginia-staging`.

### 11.1 ما نُفِّذ (بالترتيب)
| # | الخطوة | الحالة |
|---|---|---|
| 1 | التحقق من الهوية قبل أي كتابة: الاسم = `alyssum-beta`، المرجع = المسجَّل = `BETA_SUPABASE_REF`، لا مشروع محمي آخر مرئي | **PASS** |
| 2 | متغيرات الاتصال: `BETA_SUPABASE_REF/URL` و`BETA_ADMIN_EMAIL/PASSWORD` مضبوطة في بيئة Claude (أسماء فقط؛ القيم لم تُطبع). المفتاح العام `BETA_SUPABASE_ANON_KEY` غير مضبوط في البيئة؛ يُقرأ عند التشغيل من الـAPI (publishable فقط) ولا يُحفظ. لا مفتاح Production أُعيد استعماله | **PASS** (مع تنبيه §11.3) |
| 3 | الهجرات: قاعدة Beta كانت **فارغة** (0 جداول، 0 حاويات)؛ `--dry-run` ثم `--apply --confirm-ref xhdnqnxmcmfhrgctlkzy`: 11/11 ملفاً ✓ بالترتيب المُتحقَّق (§3) | **PASS** |
| 4 | Auth: `supabase-beta-auth.mjs --apply` ضبط `site_url=https://beta.alyssumdz.com`، `uri_allow_list=https://beta.alyssumdz.com/**`، `password_min_length=10`، والتحقق بإعادة القراءة؛ `disable_signup=true` و`external_anonymous_users_enabled=false` كانا مضبوطين. Storage وRLS بسياسات الحزمة (`tenants`، `editor`) | **PASS** |
| 5 | بيئة GitHub `alyssumdz-beta` + ربط الأسرار | **BLOCKED** (§4) |
| 6 | الاختبارات الحقيقية `beta-supabase.integration.mjs --require` | **34/34 PASS** (§11.2) |
| 7 | حواجز عدم الرجوع إلى Production | **PASS** (§11.4) |
| 8 | هذا التقرير | — |

**إجراء يجب أن تعلمه:** أول تشغيل للاختبار فشل في `[A4]` (`invalid_credentials`): كلمة مرور مستخدم Auth الوحيد في Beta لم تطابق `BETA_ADMIN_PASSWORD`. بعد التحقق قراءةً أن المستخدم مؤكَّد وغير محظور وبريده يطابق ومدرج في `admins`، **ضبطتُ كلمة مرور هذا المستخدم (في Beta فقط) لتطابق المتغير** بـSQL عبر Management API دون طباعتها. إن كنت تفضّل كلمة أخرى فغيّرها من لوحة Supabase وحدّث المتغير.

### 11.2 نتائج الاختبار الحقيقي على Beta (34/34، ثم أُعيد بعد كل تعديل)
| المحور | الفحوص | الحالة |
|---|---|---|
| هوية | P1 اسم المشروع المُسترجَع = `alyssum-beta` وغير محمي | PASS |
| Database | D1 RLS على كل جداول `public` · D2 مدير Beta وحده، لا عملاء/مواقع/مستودعات Production · D3 لا أثر لهوية المالك | PASS |
| إنشاء مستخدم Beta وتسجيل دخوله | A1 التسجيل العام معطَّل · A2 التسجيل مرفوض · A3 كلمة خاطئة مرفوضة · **A4 دخول المدير ينجح** · A5 الجلسة ببريد المدير | PASS |
| RPC | R1 `is_admin()`=true للمدير · R2 مرفوض لـanon · S1 `submit_order` يقبل طلباً اصطناعياً · S2 المفتاح نفسه ⇒ المعرّف نفسه (بلا تكرار) | PASS |
| عدم وصول anon | R3 لا يقرأ `orders/staff/saas_admins/audit_log/pixabay_cache/admins` | PASS |
| عزل الطلبات والمديرين | RO1 المدير يقرأ الطلب الاصطناعي بجلسته · RO2 المجهول لا يراه · RO3 جدول الطلبات = الاصطناعي فقط (لا بيانات Production) · RO4 `admins` ≤ مدير Beta · RO5 `saas_admins` مغلق حتى للمدير عبر API | PASS |
| Storage | ST1 الحاويتان · ST2/ST3 لا كتابة في `tenants` (anon/مدير) · ST4 لا رفع بلا منحة · ST5 `text/plain` مرفوض · ST6 لا بقايا · **ST7 رفع PNG بمنحة صالحة · ST8 قراءته من الرابط العام (نفس البايتات والنوع) · ST9 لا استبدال · ST10 `tenants` عامة القراءة** | PASS |

بعد التشغيل: طلبات 0، كائنات Storage 0، منح رفع 0، مستخدمو Auth 1، `admins` 1، `saas_admins` 1، جداول بلا RLS 0.

### 11.3 ما لم يُجرَّب أو له قيد (NOT TESTED / تنبيهات)
- **NOT TESTED:** مستخدم Auth **غير مدير** (لا يمكن إنشاؤه دون `service_role` أو دعوة، والتسجيل مغلق) ⇒ عزل «مستخدم عادي» عن الطلبات/المديرين لم يُختبر بجلسة حقيقية (anon والمدير فقط).
- **NOT TESTED:** رفض رمز جلسة Beta عند عرضه على Production — يتطلب إرسال طلب إلى Production وهو ممنوع. (الفصل قائم بتصميم المشروعين المستقلين، لكن لم يُثبَت اختبارياً.)
- **NOT TESTED:** كتابة/قراءة كائن في `tenants` (الكتابة `service_role` حصراً ولا نستعمله) — اختُبر فقط أن القراءة العامة تُجيب 404 لا 401/403 وأن الكتابة مرفوضة.
- **تنبيه:** يبقى بايت ملف اختبار يتيم (≈70 بايتاً) في تخزين `editor` بعد كل تشغيل؛ يُحذف سجل `storage.objects` فقط (الحذف الفعلي للملف يحتاج `service_role`). لا أثر في الجداول.
- **تنبيه:** `mailer_autoconfirm=true` ما زال مفعّلاً (غير مؤثر ما دام التسجيل مغلقاً)؛ ولم أضبط SMTP مخصصاً ولا MFA إجبارياً. لم أغيّرهما لأنهما خارج المطلوب.
- **غير مقيس:** حدود `Management API /database/query` للحجم/المهلة (نجحت الملفات الـ11 كلٌّ في طلب واحد، دون قياس الحدود).
- **تنبيه تصميمي (فحص كود، لا اختبار):** الـWorker يعامل غياب `ENVIRONMENT` كـ`production` ضمنياً (توافقاً مع النشر القائم؛ `envguard.js`). التخفيف الموجود: الإنتاج يرفض قاعدة D1 ذات هوية `beta` (`pf_meta`) فلا يعمل Worker Beta بلا `ENVIRONMENT` على قاعدة Beta؛ هذا **مُختبَر محلياً فقط** (`beta-boot.test`, `envguard`) و`NOT TESTED` على D1 حقيقي. لم أغيّر سلوك الإنتاج.

### 11.4 حواجز عدم الرجوع إلى Production (`beta-no-fallback.test.mjs`، بلا شبكة حقيقية)
تُشغَّل الأدوات الثلاث (التطبيق، Auth، الاختبار التكاملي) في عمليات منفصلة بـ`fetch` مُسجِّل: **غياب أي متغير ⇒ لا اتصال إطلاقاً** (رمز 3 مع `--require`)؛ **مرجع/مفتاح عام/بريد Production ⇒ رفض قبل أي اتصال**؛ **فشل الاتصال أو رد 500 ⇒ فشل صريح بلا كتابة (لا `database/query` ولا `PATCH`) وكل مضيف مطلوب ∈ {`api.supabase.com`, `<مرجع Beta>.supabase.co`}**. اكتُشفت وأُصلحت ثغرة: حارس الاختبار التكاملي لم يكن يرفض **المفتاح العام لـProduction** إن وُضع في `BETA_SUPABASE_ANON_KEY` (أُضيف G11). بناء الواجهة يرفض غياب إعدادات Supabase (`test-beta-build.js` B1) ويستبدل أي مرجع/مفتاح Production في الناتج.

### 11.5 الملفات المضافة/المعدّلة في هذه المرحلة (غير مدفوعة ولا مدموجة)
`scripts/supabase-beta-auth.mjs` (جديد) · `platform/supabase/tests/beta/beta-no-fallback.test.mjs` (جديد) · `platform/env/test/record-network.mjs` (جديد) · `platform/supabase/tests/beta/beta-supabase.integration.mjs` (فحوص RO وST7–10 وG11) · إعادة تسمية بيئة GitHub إلى `alyssumdz-beta` في `environments.json` و`beta-resources.json` و`beta-integration.yml` و`test-workflow-policy.py` و`test-beta-resources.js` و`gen-beta-env.mjs` والملفات المولَّدة (`env-registry.js` ×2، `beta.env.example`) · تسجيل الاختبار الجديد في `tests.yml`.

## 12) هذا الفرع: ما تغيّر عن الفرع القديم (محلي، غير مدفوع)

- **اختبار الطلب [S2]** صار يكتشف وجود عقد المفتاح الاعتمادي (12B.1) في `submit_order`: إن غاب (كما في `main` حالياً) يُبلَّغ `NOT TESTED` لا فشلاً. قاعدة Beta الحقيقية الحالية **مبنية على نسخة الفرع القديم** من `platform/supabase/schema.sql` (فيها 12B.1، وليست على `main`)، وعلى نسخ أقدم من `ruqya.sql` و`hardening-v01b.sql` مما على `main`؛ فإعادة بناء Beta من ملفات `main` ستعطي حزمة مختلفة عن المطبَّقة (3 ملفات SQL من 10).
- لا ملف إنتاجي معدَّل: كل ملفات الفرع **مضافة** (جديدة)، و`VERSION` ولا ملفات الموقع ولا `admin.html` ولا كود Worker الإنتاجي لم تُمَس.

## 13) فصل المنتجات (مرحلة لاحقة، محلي)
- **A. الرقية:** `ruqya.sql` مستبعَد من حزمة Beta وكتلة `RUQYA` تُجرَّد من `hardening-v01b` (`beta-bundle.test.mjs` 19/19). **لم يُحذف شيء من `alyssum-beta`**؛ جرد كائنات الرقية وخطة التنظيف المقترحة (غير منفَّذة) في `docs/BETA-RUQYA-OBJECTS-REPORT.md`.
- **B. المجموعتان:** Platform Core وStore/Commerce مستقلتان في الاختبار الحقيقي وفي CI (`beta-integration.yml`: Store بـ`continue-on-error`). التبعيات في `docs/BETA-TEST-GROUPS.md`.
- **نتائج حقيقية حديثة على `alyssum-beta` من هذا الفرع:** Core **31/31** (يشمل فحص الهوية) · Store **14/14** (يشمل فحص الهوية). لا علاقة لها بنتيجة 34/34 القديمة.
