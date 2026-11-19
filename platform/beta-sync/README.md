# مزامنة اللوحة التقليدية (main) ← Beta

**المصدر:** مستودع اللوحة التقليدية (`main`)، قراءة فقط. اللوحة التقليدية تحفظ المحتوى العام (المنتجات، الإعدادات، الصفحات، الصور) كملفات في المستودع (`GH.putFile`)، فتُقرأ الحالة من المستودع بعد كل commit ولا يُعدَّل مسار الحفظ.
**الوجهة:** واجهة Beta الساكنة (KV `alyssum-beta-web-files`) بنفس بنية الإصدارات (`__ptr` / `__m` / `o/<sha>`) فلا يتغيّر `static-worker.js`. الحالة والسجل في D1 `alyssum-beta-sync`.

## التدفق
`Worker alyssum-beta-sync` (cron كل دقيقة) ← رأس المصدر (info/refs ← Atom ← API) ← تغييرات `compare/<آخر رأس>...<الرأس>.diff` (وضع delta، بلا حصة REST) أو شجرة git عند الحاجة
← allowlist + تنظيف (`src/rules.js`) ← أحداث مرتّبة في `sync_events` (Outbox) ← رفع `o/<sha>` ثم كتابة بيان واحدة لكل مكوّن ← تحقق حيّ من الواجهة (service binding) ← `sync_items`.

## ما يُزامَن وما لا يُزامَن
| يُزامَن | لا يُزامَن أبداً |
|---|---|
| `assets/js/data.js`، `assets/img/**` (عدا `tpl/`)، `p/<slug>/`، `lp/<slug>/`، `index.html`، `assets/pages/<slug>.json` | الطلبات، العملاء، الموظفون، التدقيق (Supabase/SQLite) |
| `assets/data/{theme,seo,chrome,collections,welcome,ship-co,upsell,coupons,blog,store,checkout,pay-methods}.json` (مع التنظيف) | `payments/customers/returns/social/pixels.json`، أي سرّ أو مفتاح، `admin_kv` |
| | الشيفرة (`assets/js`, `css`, `admin.html`…): تصل Beta بمسار الإصدارات |

التنظيف: `store.json` يُفرَّغ من الهاتف/البريد/العنوان؛ `checkout.json` يطابق المصدر عدا `waNumber`؛ `pay-methods.json` أعلام التفعيل فقط (بلا RIP/حسابات/مفاتيح)؛ مضيفات ومراجع ومفاتيح Production العامة تُستبدل بقيم Beta؛ أي سرّ/هوية مالك لا يُستبدل ⇒ **حجر** (لا يُنسخ ويظهر في اللوحة).

## الضمانات
idempotent (لا حدث بلا فرق حقيقي)، ترتيب (وسائط ← صفحات ← إعدادات ← منتجات)، حذف آمن (`sync_trash` والكائن باقٍ ⇒ `/restore`)، رفض رأس أقدم من المرصود، كشف تراجع/تفرّع، انحراف البيان بعد إصدار واجهة جديد يُصحَّح تلقائياً، لا مزامنة عكسية (لا رمز كتابة).

## التشغيل والمراقبة
`GET /` لوحة مراقبة، `GET /status` JSON، `POST /run?kind=incremental|reconcile|full`، `POST /restore {"path":…}` — كلها بـ`Authorization: Bearer <SYNC_TOKEN>` (السرّ في Worker وملف أسرار محلي فقط).
النشر: `node platform/beta-sync/tools/deploy.mjs` (حساب Beta فقط). التهيئة الكبيرة/اليدوية: `tools/sync-cli.mjs`. الاختبارات: `test/engine.test.mjs` (71) وقبول: `tools/acceptance-github.mjs` (مصدر GitHub حقيقي) و`tools/acceptance-live.mjs` (Beta الحي).

## قيود مثبتة بالقياس (حساب Cloudflare Beta على الخطة المجانية)
- **KV: 1000 كتابة/يوم.** تهيئة `main` كاملة (1833 صورة ≈ 41MB) ≈ 1900 كتابة فلا تكتمل في يوم؛ المطلوب خطة Workers Paid أو تقليل الوسائط.
- **50 subrequest لكل تشغيل Worker** ⇒ ≈12 ملفاً/تشغيل (`SYNC_BUDGET_FILES`).
- **GitHub من عناوين Cloudflare المشتركة** تُحدّ (403/429): يُخفَّف بـdelta عبر الويب وبدائل الرأس وتراجع منفصل للشجرة؛ والحل الجذري رمز قراءة فقط `GITHUB_READ_TOKEN` (5000/ساعة).
