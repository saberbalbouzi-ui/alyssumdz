# نتيجة فرع التكامل `integration/merge-main` (دمج `origin/main` في `feature/alyssum-theme-studio`)

**لا دمج في `main`، لا إصدار.** `main` عند القياس: `10222f7e`. أب الفرع: `b26db4cf`. الفرع: دمج `4a0f98b4` + إصلاح الاختبارين.

## التحقق قبل الدفع (`verify-integration.py`: 12/12)
الملفات الستة و`VERSION` مطابقة لـmain؛ `admin-nav.js` وقيمة `V` و`protect.json` وملفات `s-alyssum` (9) لم تتغيّر؛ لا تعارض ولا علامات؛ لا تراجع لأي سطر أضافه main؛ المولَّدان متسقان. الفرق عن main: 604 ملفاً (+17487/−463) — 380 توثيق، 120 قوالب/معاينات/صور، 28 سكربتاً، 14 اختباراً، 3 مهارات، و9 أخرى (`tests.yml` `CLAUDE.md` `admin.html` `admin-help.json` `admin-nav.js` `admin-pb.js` `changelog.md` `php-edition/api/index.php` `shared-files.json`). **متجر العرض (`app.js` وغيره) مطابق لـmain.**

## النتائج (على أحدث شجرة تكامل)
| المجموعة | النتيجة |
|---|---|
| CI (التشغيل 4410 على `fafc6a81`) — المنطق | **نجح** |
| CI — المتصفح الثلاثون | **29/30**؛ الفاشلة `test-digital-checkout` (فحص خلل منتج حقيقي في main، انظر أدناه) |
| `library-audit` / `package-audit` / `test-templates` / حماية البوتات | 332/332 · 23/23 (لا تسريب) · 33 قالباً · ناجح |
| `test-upsell` (نموذج المرحلتين الحقيقي) | 29/29 |
| `test-digital-checkout` | 22 ناجحاً + 1 إخفاق (الخلل أدناه) |
| `library-review` | 294/294 |
| `batch4-sections` | 138/138 (تشغيل واحد فشل فيه فحص `c-soft` «إرسال فارغ» تحت ضغط ثم نجح) |
| `free-elements-qa` (9 قوالب) | 121 + 120 + 119/120 (فاشل: `s-aurora T15` «تحديد القسم») |
| `pilot-library-replace` متجر/أقسام | 23/24 + 23/24 (الفاشل: «PB is not defined») |
| `pilot-editability` متجر/أقسام | **10/16 + 10/16** (انظر أدناه) |
| الأوراق البصرية (32 قالباً × 1360/390) | 0 أخطاء JS، 0 صور مكسورة، 0 تعدٍّ أفقي، 0 نص <11.5px، 0 هدف لمس <36px على الجوال، `clipped` 0، h1 واحد بكل صفحة |

## إخفاقات متبقية وتفسيرها
1. **`test-digital-checkout` (خلل حقيقي في main):** `OrderSteps.unsupported()` يبحث عن علامات (`[data-digital]` `#digital-pay` `.digital-checkout`) لا يضعها `digital-checkout.js` (يضع `#dg-box`)، فيدخل المنتج الرقمي نموذج المرحلتين (إعداد main `steps:true`) ويعلق: `validate(1)` يطلب الولاية المخفية. إصلاح سطر واحد جُرِّب (23/23) ولم يُطبَّق: `proposed-fix-digital-steps.patch`.
2. **`pilot-editability` (s-watches/s-tech) و`free-elements-qa` (`s-aurora T15`): تعارض وظيفي بين محرّر main الجديد وتخطيط قوالبنا — نتيجة الدمج لا الفرع وحده.** كلاهما ينجح على فرع الميزة (16/16 و361 فحصاً). التجربة: تعطيل `pointer-events` لـ`.pbx-sdiv` (فاصل الأقسام الجديد في main، شريط 14px بـ`pointer-events:auto`) في متجر تجريبي فقط ⟵ ينجح T1 وT1b (تحديد شريط الأخبار المتحرك الرفيع على حدود الأقسام)، فالفاصل يعترض نقرات العناصر الرفيعة عند حدود الأقسام. يبقى T2 (سحب صورة `nwb17ww` يحرّك 18 عنصراً بدل واحد) لم أحدّد سببه. لم أعدّل شيئاً من محرّر main ولا من قوالبنا لإخفاء ذلك.
3. **«PB is not defined» (قائم في main):** `Admin.renderCollections()` في `admin.html` (مطابق لـmain) يستعمل `PB` قبل تحميل `admin-pb.js` الخارجي عند إعادة تحميل اللوحة أثناء الفتح؛ يظهر كخطأ JS غير ملتقط في اختبارات الاستبدال/التحرير. ليس من الدمج (الكود مطابق لـmain)؛ حارس `typeof PB` يعالجه.

## ما لم يُجرَّب
زبون حقيقي على جهاز فعلي، الدفع الفعلي بالبطاقة، متصفحات غير Chromium، المراجعة اللغوية البشرية، ومحتوى الصفحات الحيّة القادمة من main (نُقل كما هو).

## الأوراق البصرية
`docs/library-review/experience/variety-sheet-store-{1..4}.jpg` و`variety-sheet-sec-{1,2}.jpg` (حاسوب + جوال)، ومقاييسها `metrics-after-variety.json`.

## التوصية
**لا دمج في main الآن.** الدمج نظيف نصياً ومحقَّق، لكنه يكشف تعارضاً في المحرّر (البند 2) يحتاج قراراً: إما أن يُصلَح `.pbx-sdiv` (مثلاً تضييقه أو إعطاؤه `pointer-events` فقط على مقبض ظاهر) أو تُعدَّل تجارب `pilot-editability` لتحتسب الفاصل، بعد فحص T2.
