# مزامنة Beta مع المنصة الأساسية (BETA-SYNC)

> **الحكم الصريح:** الآلية **مكتملة ومختبرة محلياً بمحاكيات صريحة** (نواة، منسّق، محوّل Cloudflare الحقيقي على بروتوكول محاكى، واجهة تشغيل على مستودع git حقيقي، Worker ساكن على محرك Workers المحلي). **لم تُجرَّب بعد على Cloudflare/Supabase الحقيقيين ولا على GitHub Actions** — وهذا مذكور بالتفصيل في §10. لا شيء نُشر ولا دُفع ولا دُمج ولا مُسّ فيه Production.
> الحالات: `VERIFIED` أُثبت كما هو موصوف · `PARTIALLY VERIFIED` أُثبت بمحاكاة · `NOT TESTED` لم يُجرَّب.

## 1) المبدأ
**إصدار Beta = commit معتمَد اجتاز CI، يُبنى مرة واحدة، ويُنشر بخطوات مرتّبة آمنة، ويُسجَّل ببيان (manifest) وتقرير، ويمكن الرجوع عنه.** لا يُنشر كل commit: النشر **بقرار** (وسم اعتماد أو تشغيل يدوي).

```
commit على main (أو موسوم beta-approved/<sha8>)
   │  بوابة CI: نجاح وظيفة tests على الـSHA نفسه (لا تجاوز)
   │  بوابة الاعتماد: سلف origin/main أو وسم beta-approved/<sha8>
   │  شجرة نظيفة تطابق الـSHA · عقود التوافق · ترحيلات إضافية فقط · beta-content بيانات فقط ومعزول
   ▼
بناء الواجهة (build-beta.py) → بصمات المكوّنات الأربعة → بيان الإصدار
   ▼
لقطة بيانات (D1+Supabase) + علامة استعادة (D1 Time Travel) ← قبل أي كتابة
   ▼
ترحيلات إضافية → api → gateway → ui → templates (ترتيب يضمن توافق كل حالة وسيطة)
   │  فحص صحة بعد كل مكوّن؛ أي فشل ⇒ رجوع تلقائي (واستعادة القاعدة إن فشل الترحيل/نقصت بيانات D1)
   ▼
تحقق نهائي: هوية beta، مخطط، سلامة البيانات، دخان ← تسجيل الإصدار + التقرير
```

## 2) الخطوط والفجوة الحقيقية (قيست اليوم)
| | |
|---|---|
| خط شيفرة Beta (`beta/launch-local`) | VERSION **1.89.1236**، متقدّم 13 التزاماً عن الأصل المشترك |
| `main` (المنصة الأساسية) | VERSION **1.89.1264** (يتحرك: كان 1.89.1260 قبل ساعات) |
| الفجوة | Beta **متأخر 86 التزاماً**؛ دمج main فيه **بلا تعارض** اليوم |

الفجوة نفسها هي ما تعالجه الآلية: `node platform/release/beta-release.mjs sync-status` يقيسها (قراءة git فقط). **الإجراء الدوري:** (1) `sync-status` ← (2) دمج `origin/main` في خط Beta ← (3) CI يجتاز ← (4) وسم `beta-approved/<sha8>` ← (5) النشر. *الدمج الآلي لـmain في خط Beta (دفع) غير مُنفَّذ عمداً: يحتاج تفويضك.* بديل أبسط معماري: دمج طبقة Beta (حارس البيئة، وحدة beta، أدوات النشر) في `main` نفسه فيبنى Beta من الالتزامات المعتمدة مباشرة؛ قرار لك (انظر §11).

## 3) المكوّنات منفصلة الإصدار وتوافقها (متطلب 6)
أربعة مكوّنات، لكل منها بصمة محتوى ورقم `contract` في `platform/release/contracts.json`:
`api` (Worker المنصة) · `gateway` (بوابة الشحن) · `ui` (الواجهة الساكنة + الـWorker الساكن) · `templates` (مسارات القوالب داخل الواجهة المبنية: `assets/pages/` `assets/img/tpl/` `p/_template/` `lp/`).
- يُنشر **المتغيّر منها فقط**: تغيير قالب وحده ⇒ تُنشر القوالب وحدها (اختبار E13).
- `requires` و`min_ui/min_gateway` تُفحص عند البناء **وضد ما هو منشور فعلاً** وقت النشر؛ **ترتيب النشر يُحسَب** بحيث تبقى كل حالة وسيطة صالحة (يُنشر api أولاً إن احتاجه ui، وui أولاً إن أسقط api دعمه القديم)؛ كسر متزامن في الاتجاهين **مرفوض** مع نصيحة التقسيم إلى إصدارين (توسيع ثم تقليص).
- بادئات القوالب مصدرها واحد (العقود) ويفحص الاختبار تطابقها مع الـWorker الساكن.

## 4) الترحيلات (متطلب 5)
- **إضافية فقط:** `classifyMigration` يرفض `DROP`/`ALTER … DROP|RENAME`/`TRUNCATE`/`DELETE FROM`/`UPDATE` بلا `WHERE`/`INSERT OR REPLACE`/`CREATE` بلا `IF NOT EXISTS`/`ADD COLUMN NOT NULL` بلا `DEFAULT`. التعليقات لا تخدعه. الاستثناء الوحيد: علامة `-- release:breaking-approved:<سبب>` **و**`--allow-breaking` يدوياً.
- **فحص قبل التطبيق:** تغيّر محتوى ترحيل مُطبَّق (checksum) أو ترحيل مُطبَّق غير موجود في الإصدار ⇒ رفض قبل أي أثر.
- **استعادة آمنة:** علامة D1 Time Travel قبل أي ترحيل؛ فشل الترحيل ⇒ استعادة تلقائية. **الرجوع لا يعكس ترحيلاً إضافياً عمداً** (يبقى الكود القديم يعمل عليه).
- **حدّ صريح:** استعادة Time Travel **تُضيّع كل كتابة بعد العلامة**؛ لذلك تُستعمل تلقائياً فقط عند فشل الترحيل (ثوانٍ) أو فقدان بيانات D1 مؤكَّد. **Supabase لا علامة استعادة له هنا**: فقدان بياناته ⇒ رجوع الكود + تنبيه صريح باستعادة يدوية (لا استعادة D1 بلا داعٍ).

## 5) حماية بيانات Beta (متطلب 4)
- لا شيء ينتقل بين Production وBeta: لا اعتماد Production في الآلية؛ المحوّل يرفض حساب Production المعروف وأي حساب فيه Worker/D1 بأسماء Production وأي مرجع Supabase غير المسجَّل لـBeta؛ اختبار يثبت أن كل الطلبات الصادرة إلى مضيفات Beta/Cloudflare/Supabase فقط.
- **لقطة بيانات** قبل النشر وبعده لجداول محمية (`protected_tables` في العقود: متاجر/مفاتيح/طلبات في D1، وطلبات/عملاء/مديرون في Supabase). المعيار: **لا يختفي أي معرّف كان موجوداً**؛ الكتابات الجديدة أثناء النشر مسموحة ولا تُنذر (إنذار كاذب كان سيسبّب استعادة تُضيّع طلبات حقيقية).
- النشر لا يمسّ البيانات: الترحيلات إضافية، والواجهة محتوى معنوَن بالبصمة في KV، والـWorkers نسخ.

## 6) الرجوع والإصدارات (متطلب 7)
- Workers: نشرة نسخة سابقة (Workers Versions/Deployments). الواجهة والقوالب: **كتابة مؤشر واحد** (`__ptr/ui` أو `__ptr/templates`) — المحتوى غير قابل للتغيير (`o/<بصمة>`)، فيسري الرجوع خلال ثوانٍ (ذاكرة الـWorker الساكن 5 ث).
- سجل الإصدارات (آخر 20) في KV: `__registry/{index,current,<id>}` مع مقابض كل مكوّن. `beta-release.mjs rollback [--to <id>]` يفحص التوافق وسلامة البيانات ويحدّد الإصدار الحالي. إصدار الرجوع يُصرَّح به في التقرير.
- نشر الإصدار المنشور نفسه ⇒ `noop` بتحقق صحة فقط.

## 7) beta-content (متطلب 8)
`beta-content/` **بيانات متاجر Beta فقط** (امتدادات `json md txt` وصور): لا شيفرة، لا `manifest.json` ناقص، لا مسارات خارجه. وفحص عزل: **لا ملف في `platform/` أو `scripts/` أو `assets/js/` أو workflows يقرأ منه أو يستورده** (المسموح: أدوات الإصدار والتوثيق والاختبارات). يُفحص في كل `verify` وفي CI، وتُرفض المخالفة قبل أي بناء. *تطبيق المحتوى على متاجر Beta عبر API (إنشاء ما غاب دون استبدال الموجود) **غير منفَّذ**: يحتاج عقد API لإنشاء المتاجر.*

## 8) التقرير والتتبّع (متطلب 9)
كل نشر يكتب `beta-release/report-<id>.md` و`latest.md` و`result-<id>.json`: الـcommit، VERSION، وقت البناء، الإصدار السابق، بوابة CI (رقم التشغيل) وبوابة الاعتماد، المكوّنات (contract/بصمة/ملفات)، الترحيلات (والمُطبَّق منها)، كل خطوة ونتيجتها، والرجوع/التنبيهات. وعلى الموقع نفسه: `/beta-release.json` (البيان) وترويستا `X-Beta-Ui` و`X-Beta-Templates`، وعلى الـAPI `/health` (sha، environment، schema). في GitHub Actions يُلحق التقرير بملخص التشغيل ويُرفع artifact.

## 9) التشغيل
```bash
node platform/release/beta-release.mjs sync-status                 # فجوة Beta عن main
node platform/release/beta-release.mjs verify                       # بوابات (يحتاج GITHUB_TOKEN+GITHUB_REPOSITORY أو --ci-runs-file)
node platform/release/beta-release.mjs plan --skip-gates --dist-dir dist/beta   # بيان/خطة بلا نشر (محلي)
node platform/release/beta-release.mjs deploy                       # النشر (بوابات + بناء + نشر + تقرير)
node platform/release/beta-release.mjs rollback [--to <id>]
node platform/release/beta-release.mjs status
node platform/release/beta-release.mjs deploy --rehearsal-sim ...    # تدريب كامل على محاكي بلا شبكة
```
**من GitHub:** workflow `beta-release.yml` — تشغيل يدوي (`mode=deploy|rollback`) أو دفع وسم `beta-approved/<sha8>` (الوسم = اعتماد بشري)؛ بيئة `alyssumdz-beta` (متغيرات `BETA_CF_ACCOUNT_ID` `BETA_SUPABASE_REF` `BETA_SUPABASE_URL` `BETA_SUPABASE_ANON_KEY`، أسرار `BETA_CF_API_TOKEN` `BETA_SUPABASE_PAT`) وحماية مراجعين موصى بها. **من جلسة Claude:** المتغيرات نفسها من بيئة الجلسة، وحالة CI تُمرَّر بـ`--ci-runs-file` (ناتج `actions_list` لتشغيلات `tests`).
سياسة الـworkflows (صنف W6r) تفرض: وسوم `beta-approved/**` أو يدوي فقط، `contents: read`+`actions: read`، `needs: gate` للنشر، بيئة `alyssumdz-beta`، أسرار `BETA_*` فقط، لا استدعاء مباشر لأدوات النشر ولا Cloudflare ولا دفع — مع 10 اختبارات سلبية.

## 10) ما اختُبر وما لم يُختبر
| المتطلب | الدليل | الحالة |
|---|---|---|
| 1 نشر الإصدارات المعتمدة (يدوي/وسم) | `cli.test` (بوابات CI/اعتماد/شجرة/SHA)، `beta-release.yml` + سياسة W6r | `PARTIALLY` (الـworkflow لم يعمل على Actions) |
| 2 حساب Cloudflare المستقل وalyssum-beta فقط | حواجز المحوّل (حساب Production، أسماء، مرجع Supabase، فحص نظافة الحساب) + اختبار المضيفات | `PARTIALLY` (بروتوكول محاكى) |
| 3 لا نشر عند فشل الاختبارات | `ciGate` بلا تجاوز + `--skip-gates` ممنوع مع deploy؛ CLI [2][3][19] | `VERIFIED` منطقاً |
| 4 لا نقل بيانات ولا مسح | لقطات D1/Supabase، F8/F9، [15] [27]، لا طلبات لمضيفات غير Beta | `PARTIALLY` |
| 5 ترحيلات متدرجة وفحص واستعادة | `classifyMigration` (B1–B11)، F1–F4، [25][26] | `PARTIALLY` (Time Travel REST غير مُجرَّب حقيقياً) |
| 6 فصل الإصدارات | `planOrder` A2–A7، E13/E14، فصل مؤشرات الواجهة/القوالب (miniflare 17/17) | `VERIFIED` منطقاً |
| 7 الرجوع | E15–E17، [21]–[23]، CLI [24]، pointer rollback على miniflare | `PARTIALLY` |
| 8 beta-content | `validateBetaContent`/`checkContentIsolation` + CLI [10]–[12] | `VERIFIED`؛ التطبيق على المتاجر `NOT IMPLEMENTED` |
| 9 تقرير الإصدار | `renderReport`، E11، [20]، CLI [15][16]، `beta-release.json` | `VERIFIED` |
| 10 سيناريو إصلاح خطأ | E (محاكي) و[8]–[23] (محوّل حقيقي على بروتوكول محاكى) و[14]–[24] (CLI على مستودع git حقيقي): خطأ ← إصلاح + ترحيل + قالب ← بيانات المتجر والطلبات باقية ← رجوع | `PARTIALLY` (**لم يُنفَّذ على Beta الحقيقي**) |

**لم يُجرَّب (NOT TESTED) وهو متوقع قبل الاعتماد على الآلية:** (أ) أي نشر حقيقي على Cloudflare: مسارات Time Travel (`bookmark`/`restore`) وWorkers Deployments، ومطابقة `/health` للـAPI والـgateway (ظاهر أن gateway `/health` لا يحمل sha فيُستنتج من النسخة المنشورة)؛ (ب) تشغيل `beta-release.yml` على GitHub Actions (بيئة `alyssumdz-beta` لم تُنشأ)؛ (ج) استعلام Supabase الحقيقي للقطات (بدّلنا بمحاكاة)؛ (د) الأداء على نشرات كبيرة (حدود KV المجانية: الكتابة للملفات المتغيرة فقط وتخطّي المتطابق يخفّفها دون قياس)؛ (هـ) تطبيق beta-content على المتاجر؛ (و) الدمج الآلي لـmain في خط Beta.

## 11) قرارات تنتظرك
1. **معمارية الخط:** دمج طبقة Beta في `main` (فيُبنى Beta من الإصدارات المعتمدة مباشرة، وتختفي فجوة الـ86) أم إبقاؤها خطاً منفصلاً يُدمج فيه `main` دورياً (الحالي).
2. إنشاء بيئة GitHub `alyssumdz-beta` بمراجعين، وإدخال متغيراتها وأسرارها (أسماء في §9).
3. أول نشر حقيقي بالآلية (سيناريو إصلاح خطأ حقيقي على Beta) — بتفويضك صراحةً.
