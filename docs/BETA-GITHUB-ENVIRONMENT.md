# إعداد GitHub Environment `alyssumdz-beta` (متغيرات وأسرار)

> **الحالة:** هذا دليل الإعداد فقط. **البيئة لم تُنشأ بعد** ولم يُدخَل فيها أي متغير أو سرّ، ولذلك **لم يُشغَّل workflow الإصدار على GitHub Actions** ولم يُجرَّب النشر الحقيقي. المصدر المُولَّد للأسماء: `platform/env/beta-resources.json` (يتحقق منه `scripts/test-beta-resources.js` ويولّد `platform/env/beta.env.example`).
> **لا تكتب أي قيمة سرّية في المحادثة ولا في المستودع.** تُدخَل محلياً بـ`gh` أو من واجهة GitHub.

## 1) إنشاء البيئة وحمايتها
Settings ← Environments ← **New environment** ← الاسم **`alyssumdz-beta`** (الاسم حرفياً؛ تفرضه سياسة الـworkflows W6/W6r).
- **Required reviewers:** مراجع واحد على الأقل (أنت). يُفضَّل منع المراجعة الذاتية إن كان لديك أكثر من شخص.
- **Deployment branches and tags → Selected:** فروع `main` و`beta/*`، ووسوم `beta-approved/*`. (النشر من وسم الاعتماد أو من فرع Beta/‏main فقط.)
- لا تفعّل أي «Wait timer» ولا تضف أسراراً على مستوى المستودع (Repository secrets) لهذه الأسماء: تبقى في البيئة وحدها.

## 2) المتغيرات (Variables — غير سرّية)
| الاسم | القيمة | يستعمله |
|---|---|---|
| `BETA_CF_ACCOUNT_ID` | معرّف حساب Cloudflare المستقل لـBeta (32 خانة hex). **ليس** حساب Production (تحظره الآلية) | release، d1 |
| `BETA_SUPABASE_REF` | `xhdnqnxmcmfhrgctlkzy` (مشروع `alyssum-beta`؛ يجب أن يطابق السجل) | release، supabase |
| `BETA_SUPABASE_URL` | `https://xhdnqnxmcmfhrgctlkzy.supabase.co` | release (البناء)، supabase |
| `BETA_SUPABASE_ANON_KEY` | المفتاح العام (publishable/anon) — يصل المتصفح بطبيعته | release (البناء)، supabase |
| `BETA_APPROVERS` | معتمِدو النشر: أسماء مستخدمي GitHub بفاصلة، مثلاً `saberbalbouzi-ui`. **فارغ = لا نشر** | release |
| `BETA_D1_NAME` | `alyssum-platform-api-beta` | d1 (اختبار التكامل) |
| `BETA_ADMIN_EMAIL` | بريد مدير Beta المخصص (≠ بريد المالك) | supabase |
| `BETA_API_URL` | عنوان منصة Beta | api-smoke |

## 3) الأسرار (Secrets)
| الاسم | ما هو | صلاحياته | يستعمله |
|---|---|---|---|
| `BETA_CF_DEPLOY_TOKEN` | رمز نشر Beta على حساب Cloudflare المستقل | Account: Workers Scripts **Edit** · D1 **Edit** · Workers KV Storage **Edit** · Account Settings **Read**. بلا DNS/Zone/Routes/Pages | release |
| `BETA_SUPABASE_PAT` | Access Token **محدود النطاق** بمشروع `alyssum-beta` وحده | استعلام قاعدة البيانات (قراءة/كتابة) وقراءة المشروع | release، supabase |
| `BETA_CF_API_TOKEN` | رمز اختبار D1 (منفصل عن رمز النشر) | Account: D1 **Edit** فقط | d1 (اختبار التكامل) |
| `BETA_ADMIN_PASSWORD` | كلمة مرور مدير Beta | — | supabase |
| `BETA_API_ADMIN_TOKEN` | `ADMIN_TOKEN` لمنصة Beta | — | api-smoke |
| `BETA_CHARGILY_TEST_SECRET_KEY` | مفتاح Chargily التجريبي `test_sk_…` | Sandbox فقط | chargily |

**لا يوضع أبداً في GitHub:** `service_role` ولا مفاتيح Production (Cloudflare/Supabase/Chargily الحيّة/الشحن) ولا رمز DNS. الآلية ترفض حساب Production ومشروعه ومضيفاته وأسماء مواردهما حتى لو وُضعت بالخطأ (اختبارات `cloudflare-adapter` [31]–[37] وCLI [33]–[37]).

## 4) أوامر الإدخال الآمن (من جهازك، دون لصق القيم في محادثة)
```bash
gh variable set BETA_CF_ACCOUNT_ID --env alyssumdz-beta --body "<account-id>"
gh variable set BETA_SUPABASE_REF  --env alyssumdz-beta --body "xhdnqnxmcmfhrgctlkzy"
gh variable set BETA_SUPABASE_URL  --env alyssumdz-beta --body "https://xhdnqnxmcmfhrgctlkzy.supabase.co"
gh variable set BETA_SUPABASE_ANON_KEY --env alyssumdz-beta --body "<publishable-key>"
gh variable set BETA_APPROVERS     --env alyssumdz-beta --body "<github-login1,github-login2>"
gh secret set BETA_CF_DEPLOY_TOKEN --env alyssumdz-beta     # يطلب اللصق في الطرفية
gh secret set BETA_SUPABASE_PAT    --env alyssumdz-beta
```
(الأسرار الأخرى تُدخَل بالطريقة نفسها عند تشغيل اختبارات التكامل المقابلة.)

## 5) رمز Cloudflare (BETA_CF_DEPLOY_TOKEN)
لوحة Cloudflare بحساب Beta الجديد ← My Profile ← API Tokens ← Create Token ← Custom ← الصلاحيات الأربع أعلاه ← Account Resources: حساب Beta وحده ← TTL قصير (≤ 90 يوماً) ← أنشئه وانسخه فوراً (يظهر مرة واحدة). لا تُضف أي صلاحية DNS أو Zone: Beta على `workers.dev`.

## 6) رمز Supabase (BETA_SUPABASE_PAT)
حساب Supabase المستقل ← Account ← Access Tokens ← Generate (محدود النطاق): المنظمة الجديدة ومشروع `alyssum-beta` وحده، بصلاحية استعلام قاعدة البيانات وقراءة المشروع، وبتاريخ انتهاء. لا تستعمل رمزاً كامل الصلاحيات (شارة LEGACY).

## 7) دورة الاعتماد والتشغيل
1. الإصلاح يُدمج في `main` ويجتاز CI (`tests`).
2. معتمِد (ضمن `BETA_APPROVERS`) يدفع الوسم `beta-approved/<sha8>` على الـcommit **أو** يشغّل workflow `beta-release` يدوياً (`mode=deploy`).
3. وظيفة `gate` تتحقق (CI على الـSHA نفسه، اعتماد، عقود، ترحيلات، beta-content) **بلا أسرار**.
4. وظيفة `deploy` تنتظر موافقة مراجع البيئة، ثم تنشر وتكتب التقرير (artifact + ملخص التشغيل).
5. الرجوع: `mode=rollback` (يتطلب معتمِداً أيضاً). الحالة: `mode=status` (قراءة فقط).
6. **الانتقال إلى Production قرار مستقل تماماً**: لا workflow ولا أمر في هذه الآلية يلمس Production، وتفرض السياسة W8 ألا يتسلسل أي workflow إنتاج مع `beta-release`.

## 8) قائمة تحقق بعد الإعداد (قبل أول نشر حقيقي)
- [ ] البيئة بالاسم الصحيح وبمراجعين وقيود الفروع/الوسوم.
- [ ] المتغيرات والأسرار أعلاه مُدخَلة (تحقق بـ`gh variable list --env alyssumdz-beta` و`gh secret list --env alyssumdz-beta`: أسماء فقط).
- [ ] تشغيل `beta-release` بـ`mode=status`: يجب أن يطبع «لا إصدار مسجَّل» أو الإصدار الحالي، ويجتاز حارس نظافة الحساب (لا موارد Production)، ويعرض صحة Beta.
- [ ] ثم اختبار التكامل الحقيقي (سيناريو إصلاح خطأ) — انظر `docs/BETA-SYNC.md` §10.
