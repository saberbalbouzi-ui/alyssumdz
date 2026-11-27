# تفعيل LAURA على الإنتاج — دليل الخطوات (2026-11-27)

**الحالة الفعلية (مقاسة اليوم):**
- `https://api.alyssumhub.fyi/health` يعيد وحدات المنصة **بلا `laura`** ← الـWorker الإنتاجي لا يحمل وحدة LAURA ولا هجرتها.
- دالة Supabase `platform-proxy` المنشورة هي النسخة 23 (2026-10-31): بلا مسارات LAURA ولا `LAURA_ACTOR_SECRET`.
- لذلك زر LAURA في اللوحة يفتح «اسألني» مع إشعار «غير مفعَّلة» (تصحيح 1.89.1421)؛ وهذا السلوك صحيح حتى تكتمل الخطوات.
- **ما لا أستطيع فعله من جلسة Claude:** الحساب الإنتاجي في Cloudflare (`1dffae72…`) خارج وصولي (رمز الوكيل منتهٍ؛ والمتاح لي حساب Beta فقط)، وسرّا LAURA (`LAURA_LLM_KEY` و`LAURA_ACTOR_SECRET`) يجب أن تُدخلهما أنت ولا يمرّان بي.

## الخطوات (بالترتيب؛ كل خطوة إضافية وآمنة الرجوع إلا ما ذُكر)
1. **تجهيز سرَّين** (على جهازك): `LAURA_ACTOR_SECRET` = نص عشوائي ≥ 32 حرفاً (مثلاً `openssl rand -hex 32`)، و`LAURA_LLM_KEY` = مفتاح مزوّد النموذج اللغوي. لا تكتبهما في محادثة ولا في المستودع.
2. **هجرة D1** (إضافية: `CREATE TABLE IF NOT EXISTS` لجدولي `lr_pending` و`lr_conv`): تطبيق `platform/api/migrations/0002_laura.sql` على قاعدة الإنتاج `alyssum-platform-api` (أو الاسم المسجَّل في `platform/env/environments.json`).
3. **أسرار الـWorker الإنتاجي:** `wrangler secret put LAURA_ACTOR_SECRET` و`wrangler secret put LAURA_LLM_KEY` (اختيارياً `LAURA_MODEL`).
4. **نشر الـWorker:** `ALLOW_PRODUCTION_DEPLOY=yes CF_API_TOKEN=<رمز بصلاحية Workers+D1 للحساب الإنتاجي> node platform/api/tools/deploy.mjs --env production --production worker` (يرفض الأداة أي خلط مع Beta؛ `--dry-run` أولاً للتجربة بلا شبكة). **تنبيه:** هذا ينشر كود `platform/api` كاملاً من المستودع لا وحدة LAURA وحدها؛ قارن أولاً بالنسخة المنشورة (`git log platform/api`) كي لا يدخل تغيير غير مقصود.
5. **نطاقات مفتاح الموقع** (المفتاح `pk_live_…` الذي تستعمله `platform-proxy`): إضافة `laura:chat` ونطاقات القراءة `orders:read catalog:read carts:read payments:read wallet:read` (وغيرها حسب ما تريد أن تقرأه LAURA)؛ الكتابة بموافقة فقط وتُضاف لاحقاً (`orders:write`…).
6. **Supabase** (أسرار الدالة): `LAURA_ACTOR_SECRET` (**القيمة نفسها** في الخطوة 3) و`PLATFORM_TENANT_ID` (رقم مستأجر هذا الموقع في المنصة). تُدخَل القيمة في لوحة Supabase بيدك. ثم أنشر `platform/supabase/functions/platform-proxy/index.ts` (أستطيع نشره أنا بعد أن تؤكد أن الخطوات 2–5 تمّت).
7. **تحقق:** `curl https://api.alyssumhub.fyi/health` يجب أن تظهر فيه `laura`؛ ثم زر LAURA في اللوحة يفتح المحادثة بدل «اسألني».

## قبل أن تعوّل على إجاباتها
LAURA تقرأ **من قاعدة المنصة (D1)** عبر مفتاح الموقع. تأكد أن طلبات متجرك ومنتجاته موجودة فعلاً في المنصة (وحدتا `commerce`/`sources` والمزامنة)؛ وإلا ستجيب بأرقام فارغة أو ناقصة. هذا لم أستطع فحصه (يحتاج المفتاح).
