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
