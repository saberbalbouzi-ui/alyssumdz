# platform/ — شيفرة المنصة (SaaS) منفصلة عن موقع أليسوم

هذا المجلد يضم **كل ما يخصّ المنصة** ولا يخصّ موقع أليسوم نفسه، كي يسهل نقله لاحقاً إلى مستودع مستقل (`git subtree split --prefix=platform` أو `git filter-repo --path platform/`).

| المجلد | المحتوى |
|---|---|
| `api/` | منصة API (Cloudflare Worker + D1): النواة والوحدات والاختبارات وأدوات النشر |
| `gateway/` | بوابة الشحن (Worker + D1) |
| `worker/` | موزّع المستأجرين |
| `functions/` | دوال Edge المساندة (`ai`، `domains`…) |
| `tools/` | أدوات نشر المواقع للمخزن المركزي |
| `supabase/` | مخطط Supabase ودوال Edge (`hub`، `platform-proxy`، `pixabay-proxy`…) |
| `sql/` | مخطط لوحة المزوّد (`schema.sql`) وملحقاته |
| `php-edition/` | نسخة الاستضافة PHP (واجهة API + وحدة شركات التوصيل + بوابة الشحن) |
| `extension/` | إضافة كروم لنسخ القوالب |
| `docs/` | وثائق المنصة والتخطيط والتقارير |

## ما بقي خارج `platform/` ولماذا
- **موقع أليسوم:** `index.html`، `shop.html`، `p/`، `lp/`، مجلدات المنتجات، `assets/` (بياناته وصوره)، `CNAME`، `sitemap.xml`…
- **لوحة التحكم وملفاتها المشتركة** (`admin.html`، `assets/js/admin-*.js`، `assets/css/admin-*.css`، `shared-files.json`): هي نفسها التي تُشحن للعملاء، وتعمل على موقع أليسوم من الجذر عبر واجهة النشر؛ فصلها يحتاج خطوة لاحقة (لوحة كحزمة مستقلة يستهلكها الموقع).
- **`saas/`** (لوحة المزوّد وصفحات التعريف بالأدوات والمورّدين والخبراء): صفحات ثابتة **عامة** تُخدم من `alyssumdz.com/saas/…` وروابطها مضمّنة في لوحات العملاء، فبقيت في مكانها حتى لا تتغير العناوين.
- **`scripts/`** (أدوات البناء والاختبار المشتركة، و`make-template.py` الذي يقرأ من `platform/php-edition` و`platform/supabase` ويكتب `supabase/` و`api/` في حزمة العميل).
- **`.github/workflows/`**: يجب أن يبقى في الجذر (شرط GitHub)؛ مساراته تشير إلى `platform/…`.

## قواعد
- مجلد `platform/` **ممنوع الكتابة فيه عبر خدمة النشر `hub`** (`BLOCKED_PATH` في `platform/supabase/functions/hub/index.ts`) ومُستثنى من نشر المخزن المركزي ومن تنظيف الصور ومن أسماء المنتجات (`RESERVED` في `scripts/seo.py`).
- في حزم العملاء يبقى التخطيط كما كان: `supabase/` و`api/` في جذر الحزمة (يتولّى `make-template.py` التحويل).
