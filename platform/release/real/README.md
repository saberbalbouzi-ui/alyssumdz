# تشغيل اختبار المزامنة الحقيقي على Beta (سيناريو إصلاح خطأ)

> **لم يُنفَّذ بعد.** يتطلب: بيئة GitHub `alyssumdz-beta` بأسرارها (`docs/BETA-GITHUB-ENVIRONMENT.md`)، وتفويضك الصريح عند كل خطوة تكتب في Beta. المحاكيات لا تُعدّ دليلاً على نجاحه.
> يعمل من جلسة أسرار Beta فيها (بيئة Claude `alyssumdz-beta`) أو من GitHub Actions + جهازك. كل الأوامر تحتاج `BETA_CF_ACCOUNT_ID` و`BETA_CF_DEPLOY_TOKEN` (أو الوكيل) و`BETA_SUPABASE_REF` و`BETA_SUPABASE_PAT` و`BETA_SUPABASE_URL` و`BETA_SUPABASE_ANON_KEY`.

## المتطلبات
- إصداران معتمدان على `main`/موسومان: **A** (فيه خطأ مُعرَّف) و**B** (إصلاحه، يُفضَّل مع ترحيل إضافي وتغيير قالب)، وكلاهما اجتاز CI.
- معتمِد مُسمّى (`BETA_APPROVERS` أو `--approved-by`).

## الخطوات (كل واحدة تُسجَّل مخرجاتها كما هي في docs/BETA-SYNC.md §11)
```bash
# 0) حالة وصحة (قراءة فقط) — أو workflow beta-release بـmode=status
node platform/release/beta-release.mjs status

# 1) انشر A  (checkout للـcommit A ثم:)
node platform/release/beta-release.mjs deploy --approved-by <اسم>        # أو workflow: mode=deploy / وسم beta-approved/<sha8A>

# 2) ازرع بيانات اصطناعية موسومة (يكتب في Beta: متجر+طلب في D1 وطلب Supabase) ← بتفويضك
node platform/release/real/probe.mjs seed --confirm-write-beta
node platform/release/real/probe.mjs verify --confirm-write-beta           # يجب: كلها ✓

# 3) انشر B (الإصلاح)  (checkout للـcommit B ثم نفس أمر deploy)
node platform/release/beta-release.mjs deploy --approved-by <اسم>
node platform/release/real/probe.mjs verify --confirm-write-beta           # البيانات باقية بعد التحديث
#    + تحقق يدوي أن الخطأ زال (السلوك الذي يصلحه B) وأن /beta-release.json يحمل sha الإصدار B

# 4) رجوع إلى A
node platform/release/beta-release.mjs rollback --approved-by <اسم>
node platform/release/real/probe.mjs verify --confirm-write-beta           # البيانات باقية بعد الرجوع (بما فيها ما أُنشئ أثناء النشر)

# 5) (اختياري) الاستعادة الجراحية: احذف عمداً صفاً موسوماً من D1 ثم
node platform/release/beta-release.mjs recover-missing --release <id>      # معاينة
node platform/release/beta-release.mjs recover-missing --release <id> --apply --approved-by <اسم>

# 6) نظّف الموسوم وحده
node platform/release/real/probe.mjs cleanup --confirm-write-beta
```
**معيار النجاح:** كل `verify` ✓، الخطأ زال بعد B وعاد بعد الرجوع إلى A، التقارير مكتوبة، لا طلب إلى مضيف خارج Beta، ولا استعادة تلقائية لـD1 في أي مرحلة.
