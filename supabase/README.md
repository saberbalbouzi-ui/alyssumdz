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
المتصفح يحجب اتصال اللوحة المباشر بياليدين (CORS)، فتمرّ الطلبات عبر دالة تتحقق أنك مدير. النشر بدون طرفية: لوحة Supabase ← Edge Functions ← Deploy a new function ← الاسم `courier` ← الصق `functions/courier/index.ts` ← **أطفئ Verify JWT** (الدالة تتحقق بنفسها أنك مدير؛ وإبقاؤه مفعّلاً قد يحجب طلب الفحص المسبق فتبدو الدالة غير موجودة) ← Deploy. المضيفون المسموحون افتراضياً `api.yalidine.app`؛ لإضافة شركة أخرى عرّف السر `COURIER_HOSTS` (مفصولاً بفواصل).
الأمر نفسه ممكن لـ `yalidine-webhook` (بسر `YALIDINE_WEBHOOK_SECRET` من Edge Functions ← Secrets، وبإلغاء Verify JWT لأن ياليدين لا ترسل توكن).

## محرر التصميم `/editor/` (المرحلة 2) — مفتاح خاص مستقل
1. في SQL Editor شغّل `editor.sql` كاملاً (آمن لإعادة التشغيل؛ ينشئ مخطّط `editor` الخاص وحاوية Storage `editor` ودوال `editor_*`).
2. عيّن مفتاحك (يُخزَّن sha256 له فقط؛ اختر عبارة طويلة عشوائية ≥ 16 حرفاً):
   ```sql
   select editor.set_key('مفتاحك-الطويل-السري');
   ```
   لتغييره لاحقاً شغّل الأمر نفسه بمفتاح جديد. لا تضعه في أي ملف.
3. افتح `/editor/` ← «☁ المشاريع» ← أدخل المفتاح (يُحفظ في الجهاز إن اخترت «تذكّر»).
- الأمان: الجداول مغلقة (RLS بلا سياسات)، الدوال تتحقق من المفتاح وتُبطئ المحاولات الخاطئة دون حجب المفتاح الصحيح، والرفع إلى Storage يتم فقط إلى مسار مأذون مسبقاً لمدة 10 دقائق. روابط الصور عامة لكن مساراتها uuid غير قابلة للتخمين.
- حذف مشروع لا يحذف ملفات Storage (تبقى يتيمة؛ احذفها من لوحة Storage إن أردت).

## ما لم يُطبَّق بعد (v1.89.54)
الصق `supabase/apply-pending.sql` كاملاً في **SQL Editor ← Run** مرة واحدة: يضيف صلاحية حذف الطلبات للمدير ومنصة SaaS (جداولها ودوالها وأمانها). الملف آمن لإعادة التشغيل. ثم أنشئ مستخدم دخول لوحة المنصة من **Authentication ← Users**. دالتا الحافة `ai` و`saas-notify` (في `saas/functions/`) اختياريتان وتُنشران بـ`supabase functions deploy`.

## النشر التلقائي بالبريد وكلمة المرور (Hub، v1.89.77) — يزيل «رمز النشر» من المتصفح
المدير يدخل ببريده وكلمة مروره، وتنشر دالة `hub` على الموقع نيابةً عنه بالرمز المحفوظ **مشفَّراً** عندها (AES-GCM بمفتاح `HUB_KEY`). 4 خطوات مرة واحدة:
1. **SQL Editor** ← شغّل `supabase/hub.sql` كاملاً (آمن لإعادة التشغيل): جداول `hub_sites/hub_members/hub_secrets` (مغلقة بـRLS) ودالة `hub_my_sites`، ويُبذَّر متجر `alyssum` ويصير مديرو `admins` مالكين له.
2. **Edge Functions ← Secrets**: أضف `HUB_KEY` = نص عشوائي طويل (≥ 32 حرفاً؛ مثلاً `openssl rand -base64 32`). لا تضعه في أي ملف.
3. **Edge Functions ← Deploy a new function**: الاسم `hub`، الصق `supabase/functions/hub/index.ts`، وأطفئ **Verify JWT** (الدالة تتحقق بنفسها من الجلسة وتأكيد البريد والعضوية).
4. في اللوحة ← «إعدادات الموقع» ← «ربط النشر الآن» ← ألصق رمز النشر **مرة واحدة** ← «تفعيل النشر التلقائي»؛ يُمسح من المتصفح ولا تحتاجه بعدها.
- `CONFIG.HUB_SITE` في `config.js` = معرّف المتجر (`alyssum`)؛ بلا قيمة يبقى الربط اليدوي القديم. قبل تجهيز الخدمة (الخطوات 1–3) لا يتغير شيء في اللوحة.
- الأمان: لا يمرّ إلا مسارات المستودع المسموحة (ملفات/نشر دفعي/تشغيل نسخ القالب)، ويُمنع الكتابة في `.github/` وتغيير النطاق وإعدادات المستودع، ولا يُحدَّث إلا فرع المتجر. الاختبار: `node scripts/test-hub.js`.
- حدّ: حجم الطلب الواحد محدود بحدّ دوال Supabase (فيديو كبير جداً قد يُرفض).

## وسيط منصة API (`platform-proxy`) — السلال المتروكة ومزامنة الأحداث
1. أسرار الدالة (Edge Functions ← Secrets): `PLATFORM_URL` = `https://api.alyssumhub.fyi` و`PLATFORM_KEY` = مفتاح الخادم `pk_live_…` لمستأجر الموقع (من ملف أسرار المنصة، لا يُكتب في المستودع).
2. نشر الدالة `supabase/functions/platform-proxy` مع إطفاء Verify JWT (تتحقق بـ`is_admin` بنفسها): `functions/deploy?slug=platform-proxy`.
3. تظهر في الطلبات أزرار «📞 السلال المتروكة» تلقائياً (`assets/js/admin-carts.js`) وتختفي إن لم تُنشر الدالة.

## شبكة الخبراء (M6، v1.89.163)
شغّل `supabase/experts.sql` في SQL Editor (idempotent؛ يتطلب `saas/schema.sql` قبله لأنه يستعمل `saas_sites` و`is_saas_admin`). الجداول مغلقة بـRLS والدوال `experts_*`/`expert_*` تُستدعى من المتصفح بالمفتاح العام؛ لا تُنشر دوال Edge. للتحقق محلياً: `bash scripts/test-experts.sh` (51 فحصاً). مساحة المستقل العامة: `saas/experts.html`، والإشراف من تبويب «شبكة الخبراء» في لوحة المزوّد.
