---
name: alyssum-saas-platform
description: العمل على منصة SaaS (متعددة المستأجرين) فوق متجر أليسوم: حزم العملاء والتحديث عن بُعد، لوحة المزوّد، Supabase/Hub، الاشتراكات، النطاقات، وخطة Cloudflare. استعمله عند أي عمل على تسليم المواقع للعملاء أو بنية المنصة.
---
# منصة SaaS

- **المرجع الأعلى:** `docs/cahier-des-charges.md` ثم `docs/roadmap.md`، `docs/shopify-admin-modules.md`، `docs/multitenant-plan.md` (خطة فقط: دومين جديد للمنصة على Cloudflare، و`alyssumdz.com` لا يُمسّ؛ الاسم المرشح Tesave لم يُشترَ). **المنصة عالمية:** لا تضيّق القرارات على العسل/الجزائر؛ متعددة اللغات والعملات والمستأجرين.
- **حزم العملاء:** `python3 scripts/make-template.py --target php [--update]` (نسخة PHP: `php-edition/`). `shared-files.json` يفصل المشترك (يُحدَّث عن بُعد) عن الخاص بكل موقع (data/*.json، أيقونات PWA، store.json…). ملف مشترك جديد يجب تسجيله، وملف خاص لا يدخل المشترك. فحص التسرّب في make-template يمنع بيانات أليسوم (الاسم/الأرقام).
- **التحديث عن بُعد:** `scripts/release.py` + `.github/workflows/release.yml`، توقيع ECDSA، وتبويب «نشر التحديثات» في لوحة المزوّد `saas/` (لا تُشحن للعملاء). لا توسّع `updAllowed` إلا بتحديث يدوي أولاً (HANDOVER.md §8).
- **لوحة المزوّد `saas/`:** `schema.sql` (طلبات الدعم، المواقع، الاشتراكات، الإغلاق الآلي، الإشعارات) يُشغَّل يدوياً في SQL Editor؛ لا رمز Management API في الجلسة لتطبيقه. المدير بريده في CLAUDE.md؛ لا تكتب كلمات مرور.
- **Supabase:** `supabase/schema.sql`، دوال Edge: `courier` (وسيط الشركات)، `hub` (نشر بلا رمز GitHub لدى العميل)، `ai` (رصيد API لكل موقع)، `yalidine-webhook`. **لا `service_role` في المستودع**؛ الجلسة تستبدل Authorization لنطاق supabase بمفتاح إدارة فلا تجرّب رفعاً حقيقياً.
- **الموزّع:** `saas/worker/tenant-router.js` (Cloudflare Worker، مصدر `gh:` أو `sb:<site>`) — الواجهة ثابتة حتى تُبنى خلفية بـ`store_id`.
- **الاشتراك والإغلاق:** `saas_lifecycle_run()` وحجب الواجهة للزوار (`siteGate`) — لا إيقاف استضافة؛ الإنشاء الفعلي للمواقع/النطاقات يدوي عند الدعم حالياً.
- **العملاء يرون اللوحة كمنتج:** لا ذكر لتقنيات خلفية في نصوصها.
- **شبكة الخبراء (M6):** `supabase/experts.sql` (RPC فقط، RLS مغلق، هوية المستقل بمفتاح سرّي مجزَّأ، واتساب لموقع مسجَّل فقط، تقييم بعد 48 ساعة من التواصل، موافقة يدوية) + تبويب التاجر `admin-experts.js` + `saas/experts.html|js|css` + `saas/experts-admin.js`. اختبارات: `bash scripts/test-experts.sh` و`node scripts/test-experts-ui.js`. دالة جديدة = أضفها لقائمة الصلاحيات في آخر experts.sql واختبرها.
