# دليل تشغيل Beta (مستقبلي) — بالترتيب، مع التحقق والتراجع

> **هذا دليل للمستقبل. لم يُنفَّذ أي خطوة منه.** كل خطوة تحمل علامة: 🟢 آمنة محلياً (بلا أثر خارجي) · 🟡 تُنشئ موارد Beta (تحتاج موافقتك) · 🔴 تغيّر DNS/تفتح تسجيلاً/ترسل شيئاً (موافقة مستقلة صريحة). **لا تنفّذ شيئاً يخص Production.** `main` لا يُدمَج. `VERSION` لا يتغير.
> الأوامر تفترض الجذر `/path/to/alyssumdz` وNode 22 وPython 3 وPHP لا يلزم. القيم بين `<…>` أنت تحددها؛ **لا تضع أسراراً في المستودع ولا في سجل الأوامر** (استعمل متغيرات بيئة وملفات خارج المستودع).

## 0) المتطلبات (قبل البدء)
| المتطلب | من يوفره | ملاحظة |
|---|---|---|
| قرار حساب Cloudflare (مشترك/مستقل) + رمز API **خاص بـBeta** | أنت | صلاحيات: Workers Scripts:Edit وD1:Edit وZone→Workers Routes:Edit للمنطقة المعنية فقط؛ لا تستعمل رمز Production |
| `CF_ACCOUNT_ID` و`CF_ZONE_ID` (صريحان) | أنت | الأداة ترفض Beta بلا قيم صريحة |
| مشروع Supabase جديد لـBeta (`<beta-ref>`) + مفتاحه العام (publishable) | أنت (🟡) | **لا تستعمل `qvdaiundlkfbmjlummni`** (الباني يرفضه) |
| استضافة ساكنة لواجهة Beta (مقترح: Cloudflare Pages) | قرارك | لا تستعمل GitHub Pages الخاص بـ`main` |
| مفاتيح sandbox (Chargily test…) إن لزم | أنت | `test_`/`test` فقط؛ الحارس يرفض الحيّ |
| إثبات أن الاختبارات خضراء على الالتزام المراد نشره (CI على GitHub) | أنا/أنت | دفع بموافقتك |

متغيرات البيئة (أسماء فقط): `CF_API_TOKEN` (Beta) · `CF_ACCOUNT_ID` · `CF_ZONE_ID` · `GIT_SHA` (اختياري) · `BETA_SUPABASE_URL` · `BETA_SUPABASE_ANON_KEY` · `BETA_ALLOW_META` (لا تضبطه إلا بتطبيق Meta مستقل). **لا** `ALLOW_PRODUCTION_DEPLOY` أبداً مع Beta.

## 1) 🟢 تحقق محلي قبل أي شيء
```bash
node platform/env/sync.mjs --check                       # سجل البيئات متزامن
node --no-warnings platform/api/test/envguard.test.mjs
node --no-warnings platform/api/test/beta-isolation.test.mjs
node --no-warnings platform/api/test/beta-module.test.mjs
node scripts/test-beta-deploy.js && python3 scripts/test-workflow-policy.py && node scripts/test-beta-build.js
```
**نجاح** = كلها 0 فاشل. **راجع** `git status` نظيفاً وأن SHA المراد نشره هو المختبَر.

## 2) 🟡 مشروع Supabase لـBeta (قاعدة المتجر/الدخول)
1. أنشئ المشروع من لوحة Supabase (أو بإذنك عبر الأداة) واحفظ `<beta-ref>` والمفتاح العام. عطّل **Auth public sign-up** يدوياً.
2. طبّق المخطط: `SUPABASE_PAT=<رمز> ./scripts/setup-supabase.sh <beta-ref> <بريد-مدير-beta>` (يطبّق `schema.sql` فقط). **بريد مدير Beta غير بريد المالك.**
3. بقية ملفات SQL تُطبَّق يدوياً بالترتيب الموثَّق في `platform/supabase/README.md` (`hub.sql`, `roles.sql`, `hardening-v01*.sql`, `editor.sql`, …). **لا تطبّق `apply-pending.sql` ولا `platform/sql/schema.sql` كما هما:** يزرعان بريد المالك كمدير؛ استبدل البريد في نسخة مؤقتة خارج المستودع. *(الترتيب الدقيق لم يُجرَّب — NOT TESTED.)*
4. أسرار Edge Functions تُضبط **على مشروع Beta** (قيم Beta فقط): `supabase secrets set … --project-ref <beta-ref>`. لا تنسخ `CF_API_TOKEN` (دالة `domains`) ولا `GATEWAY_KEY`/`PLATFORM_KEY` الحيّة.
**تحقق:** `curl -s https://<beta-ref>.supabase.co/rest/v1/ -H "apikey: <beta-publishable>"` يردّ؛ ولا يوجد أي صف للإنتاج (`select count(*) from orders` = 0).
**تراجع:** احذف مشروع Beta (لا أثر على Production).

## 3) 🟢 بناء واجهة Beta (ملفات ساكنة)
```bash
BETA_SUPABASE_URL=https://<beta-ref>.supabase.co BETA_SUPABASE_ANON_KEY=<beta-publishable> \
  python3 scripts/build-beta.py --out dist/beta
```
البناء **يرفض** مرجع/مفتاح Production، ويفشل عند أي هوية إنتاجية أو نمط سرّ. ناتجه `dist/beta` (غير مُلتزَم). **تحقق:** `cat dist/beta/beta-build.json` (SHA = المراد، `supabase_configured:true`)؛ `node scripts/test-beta-build.js`.
*(بلا مشروع Supabase: `--allow-placeholder` ينتج بناءً **غير صالح للنشر** (`supabase_configured:false`).)*

## 4) 🟡 منصة API لـBeta (Worker + D1) — جرِّب أولاً بلا شبكة
```bash
export CF_ACCOUNT_ID=<id> CF_ZONE_ID=<zone> CF_API_TOKEN=<رمز-Beta>      # من بيئتك لا من الملفات
node platform/api/tools/deploy.mjs --env beta --dry-run all                # يطبع الخطة بلا شبكة: راجع الأسماء
node platform/api/tools/deploy.mjs --env beta db                           # D1 + المخطط + هوية القاعدة (beta)
node platform/api/tools/deploy.mjs --env beta secrets --save-secrets /secure/beta-secrets.json   # أسرار جديدة لـBeta (الملف خارج المستودع)
node platform/api/tools/deploy.mjs --env beta worker                       # الكود + ENVIRONMENT/GIT_SHA/APP_VERSION/SCHEMA_HASH + cron
node platform/api/tools/deploy.mjs --env beta route                        # مسار beta-api.alyssumhub.fyi/* (🔴 يعتمد DNS)
```
**قواعد حاكمة:** الأداة ترفض `--env` المفقود، وترفض Beta مع `--production`/`ALLOW_PRODUCTION_DEPLOY`، وتتحقق أن اسم Worker/D1/المضيف ≠ Production. هوية القاعدة تُكتب `beta` ويرفض الـWorker الإقلاع بخلافها.
**تحقق:** `node platform/api/tools/deploy.mjs --env beta status` ثم `curl -s https://beta-api.alyssumhub.fyi/health` ⇒ `environment:"beta"`، `sha` = المراد، `schema.actual == schema.expected`، `db_environment:"beta"`، `egress_blocked:0`.
**تراجع:** `node platform/api/tools/deploy.mjs --env beta rollback` (الكود فقط). تحذير: **لا تنفّذ أي أمر `--env production`**.

## 5) 🟡 بوابة الشحن لـBeta
```bash
node platform/gateway/tools/deploy.mjs --env beta --dry-run all
node platform/gateway/tools/deploy.mjs --env beta db && node platform/gateway/tools/deploy.mjs --env beta secrets --save-secrets /secure/beta-gw-secrets.json
# سرّ PLATFORM_ADMIN_TOKEN: اضبطه يدوياً بقيمة ADMIN_TOKEN الخاص بمنصة **Beta** (لا Production)
node platform/gateway/tools/deploy.mjs --env beta worker && node platform/gateway/tools/deploy.mjs --env beta route
```
الربط `PLATFORM` يشير إلى `alyssum-platform-api-beta` حصراً (مُختبَر). **حجب الخروج** يمنع أي شركة توصيل حقيقية؛ استعمل `courier=sandbox` فقط. **تحقق:** `curl https://beta-shipping.alyssumhub.fyi/health` (200) ثم تأكد أن cron منصة Beta يُنبَّه من بوابة Beta وليس Production (سجلات Worker Beta).

## 6) 🔴 الواجهة والنطاق وSSL (موافقة مستقلة)
1. ارفع `dist/beta` إلى الاستضافة الساكنة (يدوياً). لا تلمس GitHub Pages/CNAME الخاص بالإنتاج.
2. DNS (أنت أو بموافقتك): `beta.alyssumdz.com` → الاستضافة؛ `beta-api` و`beta-shipping` → Cloudflare (Proxied) على Workers Routes. **لا تعدّل سجلات الإنتاج.** تأكد أن مسار الموزّع الشامل `*/*` على المنطقة لا يلتقط مضيفي Beta.
3. SSL: Universal من Cloudflare للمستوى الأول؛ للنطاقات المخصّصة لعملاء Beta: Cloudflare for SaaS على منطقة Beta (اختبر بنطاق تجريبي أولاً).
**تحقق:** `curl -sI https://beta.alyssumdz.com/` (200 + `X-Robots`/noindex في الصفحة)، `curl https://beta.alyssumdz.com/robots.txt` ⇒ `Disallow: /`؛ افتح الصفحة وتأكد من الشريط الأصفر «نسخة تجريبية (Beta)». **تراجع:** احذف سجلات Beta وحدها.

## 7) Internal Beta (الفريق فقط)
```bash
A=https://beta-api.alyssumhub.fyi; T=<ADMIN_TOKEN-beta>      # من /secure/beta-secrets.json
curl -s $A/admin/beta -H "Authorization: Bearer $T"                          # المرحلة internal، signups_open=false
curl -s -X POST $A/admin/beta/signups -H "Authorization: Bearer $T" -d '{"open":true}'          # 🔴 يفتح التسجيل للدعوات الداخلية فقط
curl -s -X POST $A/admin/beta/invites -H "Authorization: Bearer $T" -d '{"note":"فريق","internal":true,"max_uses":3}'   # الكود يُعرَض مرة واحدة؛ لا يُرسَل تلقائياً
```
سلّم الكود يدوياً. **تحقق:** تسجيل تجريبي ⇒ مفتاح `pk_test_…`؛ `curl $A/v1/beta/status`.

## 8) Closed Beta (تجار مختارون) — بموافقتك
`curl -X POST $A/admin/beta/phase -d '{"phase":"closed"}'` ثم دعوات عادية (`internal:false`). حدود لكل تاجر: `POST $A/admin/beta/tenants/<id>/limits -d '{"requests_per_day":2000,"orders_per_day":100}'`. تعطيل حساب: `POST …/tenants/<id>/disable`. إيقاف التسجيل فوراً: `/admin/beta/signups {"open":false}`. الملاحظات: `GET $A/admin/beta/feedback`. **Public Beta** (`phase:"public"` + `signups_open:true`) قرار مستقل لاحق.

## 9) تحديث Beta دون المساس بـProduction
1. اختبر محلياً/CI على الالتزام الجديد؛ ابنِ الواجهة من جديد (§3).
2. `deploy.mjs --env beta status` (سجّل SHA الحالي) ← `db` إن تغيّر `schema.sql` (إضافي فقط) ← `worker`.
3. تحقق `/health`: `sha` الجديد و`schema.actual == schema.expected`. قارن الأخطاء: `GET $A/admin/beta/feedback` (كل ملاحظة مختومة بـSHA) وسجلات Worker Beta.
4. فشل ⇒ `rollback` (§4) ثم أبلغ؛ البيانات لا تُمسّ.

## 10) استعادة بيانات Beta (عند الضرورة)
D1 Time Travel **على قاعدة Beta فقط** (`alyssum-platform-api-beta`) إلى لحظة قبل الحادث. **لا تنفّذه على Production.** (لم يُجرَّب — NOT TESTED.)

## 11) إيقاف طارئ
أوقف التسجيل (`signups_open:false`)، عطّل الحسابات المتأثرة، وإن لزم أزل مسار Worker Beta من Cloudflare (تأثيره على Beta وحدها). Production لا يتأثر لأن لا يوجد أي اعتماد/اتصال مشترك في الشيفرة (يبقى خطر الرمز المشترك §4 من وثيقة الجاهزية).

## 12) ما لا يُنفَّذ أبداً من هذا الدليل
نشر/تعديل Production · تعديل DNS الإنتاج · فتح تسجيل عام دون موافقة · إرسال دعوات حقيقية آلياً · استعمال مفاتيح Production · دمج الفرع في `main`.
