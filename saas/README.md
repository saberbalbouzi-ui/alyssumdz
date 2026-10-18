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

## الحالة (v1.89.330)
الرصيد والرموز صارت في جدول `saas_sites` (`platform/sql/schema.sql`: `api_token`, `ai_text_left`, `ai_image_left`, الدالتان `saas_ai_charge/refund`) وتديرها لوحة المزوّد (تبويب «إعدادات API»)، والواجهة مربوطة: `assets/js/ai-proxy.js` (`AiProxy`) يحوّل أي استدعاء توليد (نص/صورة) إلى هذه الدالة متى وُجد **رمز الموقع** (`alyssum_ai_token`، حقل «رمز الموقع» في إعدادات مولّد الصور)، فلا يظهر أي مفتاح في المتصفح.
**للتفعيل (مرة واحدة، على مشروع المنصة):**
1. Edge Functions ← Secrets: `GEMINI_API_KEY` (مفتاحك أنت؛ لا يُكتب في المستودع ولا في المحادثة).
2. نشر الدالة من `platform/functions/ai/index.ts` (اسمها `ai`، **Verify JWT مطفأ**) — أعد نشرها بعد تحديث v1.89.330 (قائمة سماح لأجزاء الطلب، سقف صور 6، سقف مخرجات، حدّ معدّل لكل توكن 40 نصاً و12 صورة/دقيقة).
3. من لوحة المزوّد: خذ `api_token` الموقع وأعطه لصاحبه (أو ضعه أنت في «رمز الموقع»)، واضبط رصيده بـ`saas_ai_topup`.
**اختبار الخادم:** `node --experimental-strip-types --no-warnings scripts/test-ai-fn.mjs` (Deno مُحاكى). **اختبار الواجهة:** `node scripts/test-ai-proxy.js`.
