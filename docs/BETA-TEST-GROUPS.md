# مجموعات اختبارات Supabase Beta وتبعياتها

`node platform/supabase/tests/beta/beta-supabase.integration.mjs --group core|store|all [--require]` (الافتراضي `all`).
المجموعتان **مستقلتان**: فشل Store لا يُسقط Core. في CI (`beta-integration.yml`) لكل منهما job منفصل، وStore بـ`continue-on-error: true` فلا يُفشل تشغيل Core. حراسة الهوية (`guard`) تُحتسب في كل تشغيل.

## Platform Core — وظائف المنصة الأساسية
| الفحص | ما يغطيه | يعتمد على |
|---|---|---|
| P1 (guard) | اسم المشروع = `alyssum-beta` وغير محمي؛ وإلا إيقاف قبل أي كتابة | Management API + PAT |
| D1 | RLS مفعّل على كل جداول `public` | كل ملفات الحزمة |
| D2 | مدير Beta وحده؛ لا عملاء/مواقع/مستودعات Production | `platform/sql/schema.sql` (saas_admins وsaas_customers وsaas_sites) و`hub.sql` |
| D3a | لا هوية مالك في `saas_admins` | `platform/sql/schema.sql` |
| A1–A5 | التسجيل العام معطَّل، التسجيل مرفوض، كلمة خاطئة مرفوضة، دخول المدير، الجلسة ببريده | Auth على مستوى المشروع + `BETA_ADMIN_*` |
| R3 (saas_admins، pixabay_cache) | الزائر لا يقرأهما | `platform/sql/schema.sql` و`pixabay-cache.sql` و`hardening-v01.sql` |
| C1 | الزائر يستدعي `experts_categories()` | `experts.sql` |
| C2 | الزائر لا يقرأ 8 جداول منصة حساسة (saas_customers…expert_contacts) | `platform/sql/schema.sql` و`experts.sql` |
| C3 | `saas_admins` مغلق حتى للمدير عبر API | `platform/sql/schema.sql` |
| ST1–ST10 | حاويتا `tenants` و`editor`، رفع PNG بمنحة وقراءته، رفض بلا منحة/نوع خاطئ/استبدال، لا بقايا | `editor.sql` |

## Store / Commerce — المتجر
| الفحص | ما يغطيه | يعتمد على |
|---|---|---|
| D3b | لا هوية مالك في `admins` | `supabase/schema.sql` |
| R1، R2 | `is_admin()` للمدير ومرفوضة للزائر | `supabase/schema.sql` و`roles.sql` (`public.admins`) |
| R3 (orders، staff، audit_log، admins) | الزائر لا يقرأها | `supabase/schema.sql` و`roles.sql` |
| S1 | `submit_order` يقبل طلباً اصطناعياً | `supabase/schema.sql` |
| S2 | إعادة المفتاح الاعتمادي تعيد المعرّف نفسه | **12B.1** (غير موجودة على `main`) ⇒ `NOT TESTED` إن غابت |
| RO1–RO4 | المدير يقرأ طلبه، الزائر لا يراه، الطلبات = الاصطناعي فقط، `admins` ≤ مدير Beta | `roles.sql` (سياسات الطلبات) |

## ملاحظات
- **لا شيء من الرقية أو حجز المواعيد في أي مجموعة** (وظيفة موقع ALYSSUM فقط).
- جداول المتجر ووظائفه باقية في Beta ولم تُحذف؛ اختباراتها فقط هي المفصولة وغير الشرطية.
- كل تشغيل يكتب في Beta فقط: Core يرفع ملف اختبار (يبقى بايت يتيم 70 بايتاً لأن حذفه يحتاج `service_role`)، وStore يُدرج طلباً اصطناعياً ويحذفه. لا يعمل أي منهما على Production.
