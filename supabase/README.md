# Supabase لأليسوم — المرحلة 1 (الزيارات + المشاهدون الآن + أسئلة الوكيل)

المشروع: `https://qvdaiundlkfbmjlummni.supabase.co`

## الإعداد (مرة واحدة)
1. **أنشئ الجداول والدوال:** لوحة Supabase ← **SQL Editor** ← New query ← الصق محتوى `schema.sql` كاملاً ← **Run**. (يمكن إعادة تشغيله بأمان.)
2. **أنشئ حساب المدير:** **Authentication ← Users ← Add user** (بريدك وكلمة مرور قوية، فعّل Auto Confirm).
3. **عطّل التسجيل العام:** Authentication ← Sign In / Providers ← Email ← أوقف «Allow new users to sign up».
4. **أضف بريدك كمدير** (SQL Editor):
   ```sql
   insert into public.admins (email) values ('بريدك@example.com') on conflict do nothing;
   ```
5. **انسخ المفتاح العام:** Project Settings ← **API Keys** ← المفتاح `anon` (أو `publishable`) — وليس `service_role`. الصقه في `assets/js/config.js` داخل `SUPABASE_ANON_KEY` (أو أرسله لـ Claude ليضعه).
6. **في لوحة التحكم:** اضغط «🔐 Supabase» أعلى الصفحة وسجّل الدخول بحساب المدير.

## الأمان
- الزائر لا يقرأ أي جدول ولا يكتب فيها مباشرة؛ يستدعي فقط `track_hit` و`track_ping` و`log_question`.
- قراءة الإحصاءات والأسئلة وتعديلها للمدير فقط (بريده في جدول `admins`).
- المفتاح العام في `config.js` آمن للنشر؛ **لا تنشر أبداً `service_role`**.
- يمكن لأي زائر نظرياً إرسال طلبات كثيرة إلى الدوال (إغراق)؛ للحد من ذلك فعّل لاحقاً حدّ المعدّل أو Cloudflare أمام الموقع.

## ما بعد المرحلة 1
نقل الطلبات من Google Sheets إلى جدول `orders` مع RLS، ثم إزالة `ADMIN_KEY` من `config.js` نهائياً.

## المرحلة 2: الطلبات (تُنفَّذ بالترتيب، وكل مرحلة قابلة للرجوع)
1. شغّل `schema.sql` مجدداً (يضيف جدول `orders` ودالة `submit_order`).
2. في `assets/js/config.js` غيّر `ORDERS_BACKEND` إلى `"both"`: كل طلب جديد يُكتب في Google Sheets **وفي Supabase** معاً. جرّب طلباً حقيقياً وتأكد أنه ظهر في Table Editor ← orders.
3. ادخل اللوحة، سجّل دخول «🔐 Supabase»، ثم من تبويب الطلبات اضغط «⬆️ استيراد الطلبات القديمة» (مرة واحدة؛ لا يكرر الموجود).
4. غيّر `ORDERS_BACKEND` إلى `"supabase"`: الطلبات تُكتب وتُقرأ من Supabase فقط، ويصبح دخول اللوحة بالبريد وكلمة المرور (لا مفتاح).
5. **غيّر `ADMIN_KEY` في Code.gs (Apps Script)** إلى قيمة جديدة طويلة، لأن القديمة كانت منشورة علناً في `config.js` (حُذفت من الملف الآن لكنها قد تكون قُرئت).
- الرجوع في أي وقت: أعد `ORDERS_BACKEND` إلى `"sheets"`.
- حماية الدالة: ترفض الطلب إن كان الاسم/الهاتف غير صالح، وتحدّ 5 طلبات لكل هاتف خلال 10 دقائق.

## Webhook ياليدين (تحديث الحالات لحظياً)
الدالة `functions/yalidine-webhook/index.ts` تستقبل أحداث ياليدين وتحدّث `orders.status` (لا تتراجع بالحالة، `livree` و`annulee` نهائيتان).
1. من لوحة الإدارة ← شركات التوصيل ← «Webhook ياليدين» ← «إنشاء / عرض الرابط»، ويُعرض السر والأمر.
2. ثبّت Supabase CLI ثم من مجلد المشروع:
   `supabase secrets set YALIDINE_WEBHOOK_SECRET=<السر>` ثم `supabase functions deploy yalidine-webhook --no-verify-jwt --project-ref qvdaiundlkfbmjlummni`
3. الصق الرابط (`…/functions/v1/yalidine-webhook?s=<السر>`) في لوحة ياليدين ← Webhooks.
4. عند فتح اللوحة تُطبَّق على الحالات الجديدة آثارها (إشعار الزبون، القائمة السوداء عند الفشل، إعادة المخزون).
مفتاح `service_role` يحقنه Supabase في الدالة تلقائياً ولا يوضع في المستودع.

## وسيط شركات التوصيل (Edge Function `courier`) — يلزم لموقع GitHub+Supabase
المتصفح يحجب اتصال اللوحة المباشر بياليدين (CORS)، فتمرّ الطلبات عبر دالة تتحقق أنك مدير. النشر بدون طرفية: لوحة Supabase ← Edge Functions ← Deploy a new function ← الاسم `courier` ← الصق `functions/courier/index.ts` ← Deploy (اترك Verify JWT مفعّلاً). المضيفون المسموحون افتراضياً `api.yalidine.app`؛ لإضافة شركة أخرى عرّف السر `COURIER_HOSTS` (مفصولاً بفواصل).
الأمر نفسه ممكن لـ `yalidine-webhook` (بسر `YALIDINE_WEBHOOK_SECRET` من Edge Functions ← Secrets، وبإلغاء Verify JWT لأن ياليدين لا ترسل توكن).
