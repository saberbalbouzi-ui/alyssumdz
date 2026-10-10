# saas/ — أدوات مزوّد الخدمة (لا تُشحن لمواقع الزبائن)

هذا المجلد خاص بك أنت كمزوّد SaaS، وليس ضمن حزمة الزبون (`make-template.py` لا يأخذ منه شيئاً). يضع **مفتاح Gemini عندك** ويقيس رصيد كل موقع.

## الفكرة
```
موقع الزبون (توكن سرّي) ──► دالة ai (مشروعك) ──► Gemini بمفتاحك
                              │ تخصم من الرصيد؛ إن فشل Google يُعاد الرصيد
                              └ جدول ai_sites: رصيد النص والصور بعدّادين منفصلين + الصلاحية + الإيقاف
```
- عدّادان منفصلان (نص / صور) لأن الصور أغلى بكثير. `null` = بلا حدّ.
- الرصيد يُحسَب على الخادم فلا يستطيع المشترك تجاوزه من المتصفح.
- الإجابات المحفوظة (ذاكرة الكتابة السحرية) لا تستهلك رصيداً.

## التركيب (مرة واحدة)
1. في مشروع Supabase **الخاص بك**: SQL Editor ← الصق `ai-credits.sql` ← Run.
2. Edge Functions ← Secrets: `GEMINI_API_KEY` (مفتاحك). اختيارياً `AI_TEXT_MODELS` و`AI_IMAGE_MODELS` (قوائم مفصولة بفواصل؛ الافتراضي `gemini-2.5-flash,gemini-2.5-flash-lite` و`gemini-2.5-flash-image`).
3. Edge Functions ← Deploy a new function ← الاسم `ai` ← الصق `functions/ai/index.ts` ← **أطفئ Verify JWT** (التحقق بالتوكن داخل الدالة) ← Deploy.

## الإدارة اليومية (SQL Editor)
```sql
-- عرّف الخطط حين تقرّر أرقامها (null = بلا حدّ)
insert into public.ai_plans (plan, text_credits, image_credits, days, note) values ('free', 30, 3, 30, 'مجاني مع الموقع');

select public.ai_new_site('اسم-الموقع.com', 'free');          -- يعيد التوكن لوضعه في إعدادات الموقع
select public.ai_topup('اسم-الموقع.com', 100, 20, 30);       -- شحن: نص، صور، أيام إضافية
update public.ai_sites set status = 'suspended' where site = 'اسم-الموقع.com';   -- إيقاف
select site, plan, text_left, image_left, expires_at, status from public.ai_sites order by created_at desc;   -- حالة المواقع
select site, kind, count(*) from public.ai_usage where ok and at > now() - interval '30 days' group by 1, 2;   -- استهلاك آخر 30 يوماً
```

## الطلب (للمرحلة التالية: ربط اللوحة)
`POST https://<مشروعك>.supabase.co/functions/v1/ai` بجسم `{ "token": "...", "kind": "text" | "image", "parts": [...], "cfg": {...} }`.
الرد الناجح `{ ok, left, model, data }` (`data` = رد Gemini كما هو). الأخطاء: `no_credits` / `expired` / `suspended` (HTTP 402) و`unknown_token` (401)، وكلها مع `message` عربية جاهزة للعرض كإشعار «فعّل اشتراكك».

## الحالة
المرحلة 1 (هذا المجلد): الخادم وجدول الرصيد — **غير مربوطة بلوحة الإدارة بعد**، فلا تأثير على أي موقع حالياً.
المرحلة 2: ربط «حرر» وتوليد الصور في اللوحة بالوسيط عند وجود `CONFIG.AI_PROXY` + توكن، مع عدّاد «بقي لك N» وإشعار انتهاء الرصيد.


---

# لوحة مزوّد المنصة (v1.89.40) — `saas/index.html`

الرابط: `https://alyssumdz.com/saas/` (noindex، ولا تُشحن لمواقع الزبائن). تستقبل **كل طلبات الزبائن بدل واتساب**: إنشاء موقع، حذف/إلغاء حذف، طلب دومين، ربط دومين خاص + DNS، دعم فني؛ مع إشعارات مباشرة وخط سير للمواقع وزبائن وتحليلات.

## التركيب (مرة واحدة)
1. Supabase ← SQL Editor ← الصق `saas/schema.sql` ← Run (آمن لإعادة التشغيل؛ يُنشئ الجداول والدوال والصلاحيات ويضيف بريد المدير `saas_admins` وموقع أليسوم كأول زبون).
2. Authentication ← Users ← Add user: بريد المدير وكلمة مرور قوية (Auto Confirm). (غيّر كلمة المرور من «الإعدادات» في اللوحة بعد أول دخول.)
3. ادخل إلى `/saas/` بالبريد وكلمة المرور. لإضافة مدير آخر: `insert into public.saas_admins (email) values ('x@y.com');` ثم أنشئ له مستخدماً.

## الأمان
- لوحات الزبائن (anon) تستدعي فقط `saas_submit` و`saas_ticket_view` و`saas_ticket_reply` و`saas_site_status` و`saas_site_ping`، ولا تقرأ أي جدول. رمز كل طلب (uuid) سرّي في متصفح الزبون.
- القراءة والكتابة الكاملة لمدير المنصة فقط (RLS + `is_saas_admin()`).
- **الطلب غير موثَّق الهوية** (يُنسب إلى عنوان الموقع المرسِل): لذلك لا تغيّر الدوال حالة أي موقع تلقائياً؛ المدير يعتمد الإجراء (تفعيل/حذف/دومين) من زر في الطلب. حدّ معدّل: 12 طلباً/ساعة لكل موقع و120 عالمياً.
- لا تضع `service_role` في أي ملف.

## الإشعارات
Supabase Realtime (قنوات `postgres_changes` على `saas_tickets/messages/sites`) + استعلام دوري احتياطي كل 25ث؛ داخل الصفحة وصوت وإشعار سطح المكتب (والصفحة مفتوحة). **حدّ:** لا إشعار والصفحة مغلقة (يحتاج بريداً/تيليغرام عبر Edge Function).
