# جاهزية تكاملات Beta الحقيقية (BETA-INTEGRATION-READINESS)

> **الحكم الصريح:** كل ما يمكن تجهيزه **دون بيانات اعتماد** جُهِّز واختُبر **محلياً**. **لم يُنشأ أي مورد حقيقي** (لا Cloudflare ولا Supabase ولا Chargily)، ولم يُنفَّذ أي نشر/DNS/تغيير إنتاجي/دفع. اختبارات التكامل الثلاثة (D1 وSupabase وChargily) **لم تُشغَّل على خدمات حقيقية** — وتُبلغ بـ`SKIPPED` لا بـ«نجاح» حتى تتوفر بياناتها. القرارات المعتمدة: Cloudflare Pages للواجهة، Workers للـAPI، D1 مستقل، Supabase مستقل، Chargily Sandbox فقط.
>
> الحالات: `VERIFIED` أُثبت كما هو موصوف · `PARTIALLY VERIFIED` أُثبت محلياً/بمحاكاة فقط · `BLOCKED` ينتظر اعتماداً أو قراراً · `NOT TESTED` لم يُجرَّب.
> المصدر الوحيد للأسماء والأسرار: `platform/env/beta-resources.json` (يُولَّد منه `platform/env/beta.env.example` ويتحقق منه `scripts/test-beta-resources.js`).

## 1) ما يمكن تنفيذه الآن وما ينتظر

| البند | الحالة اليوم | ما يلزم لتشغيله حقيقياً |
|---|---|---|
| حزمة SQL لـSupabase Beta (ترتيب، استبدال بذور المالك، فحص الهوية) | `PARTIALLY VERIFIED` — 25/25 على PostgreSQL 16 محلي (ليس Supabase) | مشروع `alyssum-beta` + PAT + بريد مدير Beta |
| حراسات أداة التطبيق على Supabase (مرجع Production/اسم مشروع/`--confirm-ref`) | `VERIFIED` بـfetch محاكى | — |
| هجرات D1 (`platform/api/migrations`) + المُطبِّق + checksum | `VERIFIED` محلياً (16/16) | — |
| اختبار D1 Beta (ادّعاء ذرّي، فهارس، خطط، تنظيف مقيَّد) | `PARTIALLY VERIFIED` — 15/15 على miniflare المحلي (ليس D1 البعيد) | قاعدة D1 `alyssum-platform-api-beta` + رمز D1:Edit |
| اختبار Supabase Auth/DB(RLS)/Storage على مشروع حقيقي | `BLOCKED` (حراساته 9/9 محلياً) | مشروع + PAT + كلمة مرور المدير + المفتاح العام |
| اختبار Chargily Sandbox | `PARTIALLY VERIFIED` — `--stub` 11/11 (محاكاة صريحة) | مفتاح `test_sk_…` مخصص لـBeta |
| الحواجز المالية (لا مسار حيّ من Beta) | `VERIFIED` محلياً (طبقات §7) | — |
| workflow يدوي للتكامل `beta-integration.yml` | جاهز، **لم يُشغَّل** (لا بيئة `beta` في GitHub) | إنشاء Environment `beta` وإدخال متغيراته/أسراره |
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

## 3) موارد Supabase المطلوبة (غير مُنشأة)

| البند | القيمة |
|---|---|
| المشروع | اسمه **`alyssum-beta`** حصراً؛ ممنوع الخلط مع `ALYSSUMDZ` (Production) و`imaginia-staging` (منتج آخر) — تتحقق منه الأداة والاختبار |
| Auth | التسجيل العام **OFF** (إلزامي؛ الاختبار `[A1]` يفشل إن بقي مفعّلاً)، مستخدم واحد: مدير Beta ببريد مخصص ≠ بريد المالك، Site URL `https://beta.alyssumdz.com`، Redirect `https://beta.alyssumdz.com/**` |
| Storage | `tenants` (قراءة عامة، لا سياسة كتابة) و`editor` (رفع للمجهول بمنحة `editor.upload_grants` وأنواع صور فقط) — تُنشأ بـSQL لا يدوياً |
| SQL | 10 ملفات بترتيب مُجرَّب: `supabase/schema` ← `sql/schema` ← `roles` ← `hub` ← `editor` ← `experts` ← `ruqya` ← `pixabay-cache` ← `hardening-v01` ← `hardening-v01b` + صف `admins` لبريد Beta (مولَّد). مستبعَد: `apply-pending.sql` |
| Edge Functions | لا تُنشر الآن؛ إن لزم: `courier`/`ship-gateway`/`platform-proxy` بأسرار Beta فقط، **لا `domains` ولا مفاتيح `*_live_`** |
| `service_role` | **لا يُخزَّن في GitHub ولا في أي ملف**؛ الاختبارات تستعمل جلسة المدير + PAT لاستعلامات SQL |

> **ثلاثة أخطاء في خطتي الأولى اكتشفها تدريب PostgreSQL المحلي وصُحِّحت قبل أي تطبيق حقيقي:** (1) `hardening-v01.sql` يعتمد على `hub_my_sites` فلا يصح استبعاد `hub.sql` (يُضمَّن الآن **بعد حذف بذرة مستودع Production منه**)؛ (2) يعتمد على جداول `experts`/`ruqya`/`pixabay_cache` فلم تكن «اختيارية»؛ (3) سجل الموارد وصف حاوية `editor` عامةً/خاصةً خطأً. لولا التدريب لانهار `hardening-v01` على Beta أثناء التطبيق.

## 4) إعدادات GitHub وأسماء الأسرار (دون أي قيمة في المستودع)

الإعداد مرة واحدة: GitHub ← Settings ← Environments ← **New environment: `beta`** ثم (قرار D6) مراجعون مطلوبون + تقييد الفروع (`claude/*` وmain).

**متغيرات (Variables — غير سرّية):** `BETA_CF_ACCOUNT_ID` · `BETA_D1_NAME` (= `alyssum-platform-api-beta`) · `BETA_API_URL` · `BETA_SUPABASE_URL` · `BETA_SUPABASE_REF` · `BETA_SUPABASE_ANON_KEY` (مفتاح عام) · `BETA_ADMIN_EMAIL`.

**أسرار (Secrets):** `BETA_CF_API_TOKEN` · `BETA_SUPABASE_PAT` · `BETA_ADMIN_PASSWORD` · `BETA_API_ADMIN_TOKEN` · `BETA_CHARGILY_TEST_SECRET_KEY`.

**طريقة الإدخال الآمن (لا تكتب القيمة في المحادثة أبداً):**
```bash
gh secret set BETA_SUPABASE_PAT --env beta          # يطلب منك اللصق محلياً في الطرفية
gh variable set BETA_SUPABASE_REF --env beta --body "<ref>"   # للمتغيرات غير السرّية فقط
```
أو من الواجهة: Settings ← Environments ← beta ← Add secret. وللتشغيل المحلي: انسخ `platform/env/beta.env.example` إلى مسار **خارج المستودع** وعبّئه ثم `set -a; . ~/.alyssum/beta.env; set +a`.

ملاحظات صريحة: `BETA_API_URL` و`BETA_API_ADMIN_TOKEN` مُعرَّفان لاختبار دخان API **لم يُكتب بعد** (لا اختبار يستعملهما اليوم). أسرار Workers نفسها (`APP_ENCRYPTION_KEY`, `ADMIN_TOKEN`, `PLATFORM_SECRET`…) يولّدها `deploy.mjs --env beta secrets --save-secrets <ملف-خارج-المستودع>` ولا تدخل GitHub سوى `ADMIN_TOKEN` عند الحاجة.

## 5) هجرات واختبارات D1 التجريبي

- `platform/api/migrations/0001_baseline.sql` (+ أي لاحقة) تُطبَّق بـ`node platform/api/tools/d1-migrate.mjs --env beta [--status|--dry-run]`: ترفض غير `beta`/`local`، تتحقق من `pf_meta.environment` قبل أي كتابة، وتسجّل `pf_migrations(name, sha)` وترفض تعديل هجرة مطبَّقة (`migration_checksum_mismatch`).
- `platform/api/test/integration/d1-beta.integration.mjs`: S0 هوية القاعدة · S1 الهجرات بنفس الـchecksum · ادّعاء ذرّي متزامن وملكية الرمز · خطط الاستعلام والفهارس (`ix_pf_idem_st`) · عدّاد `rows_read/rows_written` · تنظيف **مقيَّد بمستأجر الاختبار** (لا يمسّ بيانات Beta الأخرى).
- الأوضاع: `--local` (miniflare/workerd — **ليس** D1 الحقيقي، 15/15) · بلا علم = D1 البعيد عبر REST (`SKIPPED` بلا اعتماد، ويرفض اسماً غير `alyssum-platform-api-beta` أو أي قاعدة إنتاج برمز 2 قبل أي اتصال).
- `ix_pf_idem_at` الاختياري **لم يُطبَّق على أي قاعدة**، ومقرَّر ألا يُطبَّق على Production.

## 6) اختبارات Supabase Beta (Auth وStorage وDatabase)

`platform/supabase/tests/beta/beta-supabase.integration.mjs` (حقيقي؛ `--selfcheck` للحراسات فقط):

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
6. سياسة workflows (W6/W7، 55/55 مع اختبارات سلبية): `beta-integration.yml` يدوي فقط، `contents: read`، بيئة `beta`، أسرار `BETA_*` فقط، بلا نشر/دفع/`service_role`/رموز Production.
7. `build-beta.py` + `test-beta-build.js`: لا مفتاح حيّ/سرّي/هوية إنتاج في ملفات المتصفح.

## 8) نتائج الاختبارات المحلية (هذه الجلسة)

| الاختبار | النتيجة |
|---|---|
| `scripts/test-supabase-beta.js` (حزمة + حراسات + PostgreSQL 16 محلي، بجذر وبمستخدم غير جذر) | **25/25** |
| `scripts/test-beta-resources.js` | **24/24** |
| `scripts/test-workflow-policy.py` (W1–W7 + 11 اختباراً سلبياً) | **55/55** |
| `scripts/test-beta-build.js` (بما فيه `_headers`) | **19/19** |
| `scripts/test-beta-deploy.js` | 40/40 |
| `platform/api/test/` `migrations` 16 · `envguard` 41 · `beta-isolation` 34 · `beta-module` 37 · `boundaries` 282 · `idem-prune` 19 · `idem-review` 34 · `platform` 56 · `payments` 29 · `payments-12c` 24 · `wallet` 75 · gateway `beta-boot` 8 | كلها ناجحة |
| `d1-beta.integration.mjs --local` (miniflare) | PASS 15/15 |
| `idem-d1-local.mjs` (N=20000) | 14/14 |
| `chargily-sandbox.integration.mjs --stub` | 11/11 (محاكاة) |
| `beta-supabase.integration.mjs --selfcheck` | 9/9 (حراسات) |
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
| D6 حماية بيئة GitHub `beta` | مراجع واحد على الأقل + فروع `claude/*` وmain |

**الترتيب (كل خطوة بموافقة مستقلة):** (1) D3+D4 ← إنشاء مشروع `alyssum-beta` وتعطيل التسجيل العام ← `supabase-beta-apply.mjs --apply` ← اختبار Supabase الحقيقي. (2) D1 ← إنشاء D1 Beta ← `d1-migrate` ← اختبار D1 الحقيقي. (3) D5 ← اختبار Chargily Sandbox. (4) إنشاء بيئة GitHub `beta` وإدخال الأسرار ← `beta-integration.yml`. (5) لاحقاً فقط: نشر Workers/Pages وDNS (D2) ← اختبار دخان API. **لا شيء من هذا يُنفَّذ دون قولك.**

## 10) ما لم يُجرَّب / حدود الصدق

- لا مورد Cloudflare/Supabase/Chargily أُنشئ؛ رمز Cloudflare المحقون في هذه البيئة غير صالح (`Invalid API Token`) فلا D1 بعيد.
- Auth الحقيقي (GoTrue) وStorage API وPostgREST وقيود المنصة الفعلية (مثل سياسات Storage في خدمة Supabase المُدارة) **غير مُجرَّبة**؛ التدريب المحلي يغطي منطق SQL/RLS فقط.
- لم يُجرَّب نشر `_headers` على Pages (ترويسات HTTP الفعلية)، ولا SSL، ولا تفويض النطاق.
- سلوك `Management API /database/query` (حدود الحجم/المهلة/المعاملة الواحدة لكل ملف) لم يُقَس؛ قد يلزم تقسيم ملف كبير.
- اختبار Chargily الحقيقي لم يتحقق من سلوك webhook المُستضاف (يحتاج Worker Beta منشوراً ومسار خارجي)؛ التوقيع فقط مُختبَر محلياً بدالة المنصة.
- لا قناة تنبيه خارجية لتنبيهات `pf_idem`، و`products_max` غير مُنفَّذ، وإنشاء مستخدمين عبر دعوات Beta الحقيقية خارج هذه المرحلة.
