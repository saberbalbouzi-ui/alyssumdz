# إعدادات البيئات (Production / Beta / Local)

**المبدأ:** كل بيئة مستقلة بمواردها وأسرارها وقاعدتها. السجل `environments.json` هو المصدر الوحيد لأسماء الموارد والنطاقات والأوضاع (بلا أي سرّ). كل ما يلي يُنفَّذ بفشل مُغلَق: إعداد خاطئ ⇒ لا إقلاع/لا نشر.

| الملف | الدور |
|---|---|
| `environments.json` | أسماء Workers/D1/المضيفين/مرجع Supabase والأوضاع (live/sandbox) وسياسة الخروج، وقائمة «ما لا يخرج من الإنتاج» (مضيفات، مرجع Supabase، مفاتيح عامة، هويات مالك). |
| `sync.mjs` | يولّد `platform/api/src/env-registry.js` و`platform/gateway/src/env-registry.js` (وحدتان يرفعهما deploy مع الـWorker). `node platform/env/sync.mjs --check` في CI. |
| `platform/api/src/envguard.js` | حارس نقي (يُنسخ طبق الأصل إلى `platform/gateway/src/`): التحقق من الإعدادات، سياسة الخروج، `guardFetch`، `deployPlan`. |
| `beta/beta-banner.js` | شريط Beta ونموذج الملاحظات (يُحقن في بناء Beta فقط). |
| `local.env.example` | أسماء المتغيرات للتطوير المحلي بقيم وهمية. |

## كيف تُحدَّد البيئة
المتغير `ENVIRONMENT` (`production` | `beta` | `local`) — يضبطه `deploy.mjs` كـplain_text binding. **غيابه = production ضمنياً** (توافقاً مع النشر القائم) مع تحذير. بيئة غير الإنتاج تُحمَّل فيها وحدة Beta، ويُغلَّف كل اتصال صادر بحارس الخروج.

## ما يفرضه الحارس عند الإقلاع (Beta/Local) — رموز الأخطاء بلا قيم
`production_host_in_var` · `production_supabase_ref_in_var` · `production_public_key_in_var` · `live_credential_in_beta` (`live_`/`sk_live`/`pk_live`/`gk_live_`) · `payments_mode_not_test` (CHARGILY_MODE ≠ test) · `public_url_host_mismatch` · `supabase_is_production`/`supabase_url_invalid` · `meta_credentials_in_beta` (إلا `BETA_ALLOW_META=yes`) · `egress_extra_denied`.
والإنتاج يرفض أي مضيف Beta في متغيراته (`beta_host_in_production`).

## هوية القاعدة
`pf_meta('environment')` تُكتب عند `deploy db`؛ Worker Beta يرفض الإقلاع على قاعدة بلا هوية `beta` أو بهوية مخالفة (والإنتاج يرفض الهوية `beta`). فلا يمكن ربط Beta بقاعدة Production ولا العكس.

## الأسرار
**لا تُكتب في المستودع ولا في ملفات تصل المتصفح.** أسرار Worker (`ADMIN_TOKEN`, `PLATFORM_SECRET`, `APP_ENCRYPTION_KEY`, …) يولّدها `deploy.mjs secrets` لكل بيئة بقيم جديدة مستقلة (تُحفظ خارج المستودع بـ`--save-secrets <مسار>`). مفاتيح Supabase Edge Functions تُضبط على مشروع كل بيئة منفصلاً. المفتاح العام (publishable/anon) وحده يصل المتصفح.
