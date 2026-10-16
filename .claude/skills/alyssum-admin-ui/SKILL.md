---
name: alyssum-admin-ui
description: اتفاقيات واجهة لوحة تحكم أليسوم: المظاهر (زجاج داكن/فاتح)، أزرار زجاجية، نوافذ وقوائم عائمة، قواعد النصوص، تسجيل الأقسام في القائمة والبحث و«اسألني». استعمله عند إضافة قسم أو زر أو نافذة أو إعداد في admin.html.
---
# واجهة اللوحة

- **الملفات:** `admin.html` (الأصل)، `assets/js/admin-*.js` (وحدات)، `assets/css/admin-glass.css` (يدوي، آخر الملف أقوى) + `admin-glass-auto.css` (مولَّد `scripts/gen-glass.py` — لا تعدّله)، `admin-theme.css` للفاتح.
- **المظهران:** `html.glass` (داكن، `--g-mint` أخضر ليموني) و`html.white` (فاتح، `--ac`). كل قاعدة جديدة تُكتب لكليهما؛ لون التمييز من `AdminTheme` فاستعمل `rgba(var(--g-mint-rgb),α)` وأسماء الحالات `--g-ok|warn|err|info` (v1.89.198)، و `var(--g-mint,var(--ac))` لا ألواناً ثابتة.
- **أي سطح عائم جديد (نافذة/قائمة/لوحة) يجب خلفية معتمة صراحةً** في admin-glass.css؛ التحويل التلقائي يجعلها شفافة.
- **أزرار:** زجاج شفاف منتفخ بنص أبيض (inset لمعة علوية + ظل داخلي سفلي + blur)، مرور = تلوين + `translateY(-2px)` بلا توهج.
- **لا إيموجي في واجهة جديدة** حيث توجد أيقونات (`modern-icons.js` مولَّد).
- **نصوص الواجهة:** بلا GitHub/Supabase/مسارات ملفات/أسماء مزوّدي الذكاء؛ «Alyssum API» فقط.
- **قسم جديد:** زر `.nav-btn` بـ`data-grp` (gen|products|shop|look|apps) + `#tab-<id>` + اسمه في مصفوفة `Admin.tab` + أيقونة في `P` + وصله في admin-search.js (`ACTIONS`) + مقال في `admin-help.json` + بند في `shared-files.json`. تطبيق جديد: `APPS` في admin-nav.js.
- **الذاكرة المحلية:** مفاتيح `alyssum_*`؛ ما يجب مزامنته بين الأجهزة يمرّ بـ`Priv`/PrivSync.
- **الجداول:** أضفها إلى `LIST` في admin-tablesel.js ليأخذ التحديد وقائمة Action؛ صفوف الطرود تحمل `data-trk`/`data-co` للبوردرو.
- **الصوت واليد:** الفهرس الحي يلتقط أي زر جديد تلقائياً بتسمية واضحة (`aria-label`/`label`/نص)؛ سمِّ الأزرار بوضوح.
- (v1.89.239) قسم جديد بصلاحية جديدة (مثل `pack`): أضف الصلاحية في `PERMS` بـ`admin-roles.js` و`staff-admin/index.ts` و`platform/php-edition/api/index.php` (`STAFF_PERMS`) و`TAB_PERM`، ودور جديد يُضاف لـ`ROLES` وللثلاثة نفسها ولقيد `staff_role_check` في `platform/supabase/roles.sql`؛ `test-roles.js` يتحقق من التطابق. دور لا يقرأ جدول الطلبات يحتاج دوال خادم تُرجع الحقول اللازمة فقط (نموذج `pack_orders`).
