# تحليل الفرق التاريخي وطريقة الدمج الآمن في `main` — **لم يُنفَّذ دمج ولم يُدفع شيء إلى `main`**

الفرع: `feature/alyssum-theme-studio`. التحليل بتاريخ 2026-11-16 على `origin/main` (الرأس `4a9fa811` عند القياس). كل التجارب جرت في `git worktree` مؤقتة محلية.

## 1) الحقائق
| | الفرع | main (منذ الأساس المشترك) |
|---|---|---|
| الأساس المشترك | `e51e2a76` (2026-11-12 «merge main») | |
| الالتزامات | 80 | 488 (252 للمالك، 210 Claude، 26 بوت) |
| الملفات | 601 (+16758/−598) — معظمها قوالب/معاينات/توثيق/اختبارات | 131 (+17515/−7358) — معظمها صفحات حيّة (`honey-focus`، `lp/*`، الرقية) + `VERSION` + اللوحة |
| ملفات تعدّل في الجهتين | 15 | |
| تعارضات الدمج الفعلية | 12 ملفاً: `VERSION` `admin.html` `admin-pb.js` `admin-help.json` `ship-co.json` `admin-home.js` `admin-theme.js` `data.js` `changelog.md` `make-template.py` `pagebuilder.js` `shared-files.json` | |

## 2) السبب الجذري للتغييرات التاريخية الواسعة
الالتزام **`c83b9174`** (2026-11-13 «طور القوالب: مكتبة القوالب الستة…») حمل معه **نسخاً قديمة بالخطأ من ستة ملفات لا علاقة لها بالقوالب**، فهي تُرجِع ميزات وبيانات أحدث في main:
`VERSION` (1.89.1109 ← 1.89.1101)، `assets/js/admin-home.js` (يحذف بطاقة الحملات الإعلانية `adsCard` وعدّاد «بانتظار التجهيز»)، `assets/js/admin-pack.js` (يحذف `count()`)، `assets/js/admin-theme.js` (يحذف `T.netInfo`)، `assets/js/data.js` (لقطة منتجات 11-11 بدل 11-12)، `assets/data/ship-co.json` (طابع أقدم). هذه الملفات **لم يعدّلها أي التزام آخر في الفرع** (تحققتُ بـ`git log`).
**الخطر الأخفى:** `admin-pack.js` يُدمَج **تلقائياً بلا تعارض** فيُحذف `count()` من main **بصمت**؛ فالدمج المباشر قد يبدو نظيفاً وهو يُرجع ميزات.

## 3) لماذا لا دمج مباشر
دمج مباشر = (أ) 12 تعارضاً تُحلّ تحت ضغط، (ب) ارتداد صامت لميزات main (ملف واحد على الأقل بلا تعارض)، (ج) `admin.html`/`admin-pb.js` مولَّدان فلا يُحلّان يدوياً، (د) خطر نشر `VERSION` أقدم.

## 4) الطريقة الموصى بها (اتجاه واحد: main إلى الفرع أولاً)
1. نسخة عمل نظيفة من رأس الفرع: `git worktree add --detach /tmp/mrg HEAD && cd /tmp/mrg`.
2. `git fetch origin main` ثم `git merge --no-commit --no-ff origin/main` (يُنتظَر 12 تعارضاً).
3. `python3 docs/merge-plan/resolve-merge.py` — **يتوقف بخطأ إن ظهر تعارض خارج القائمة المعروفة** أو إن عدّل الفرع أحد الملفات الستة بعد `c83b9174`. يفعل:
   - الملفات الستة ← نسخة main كاملةً.
   - `shared-files.json` ← الفرع + ما أضافه main فقط (ستة مداخل: `manifest-admin.webmanifest` `admin-delhealth.js` `admin-busy.js` `admin-v360.js` `lp-pixels.js` `admin-aiswitch.js`).
   - `make-template.py` ← الفرع (`_leak_scan`) + نمط الرقية الجديد من main.
   - `pagebuilder.js` ← الفرع + تعديلا main على `tick` (`data-nod`، تنسيق الرقم).
   - `admin-help.json` و`changelog.md` ← main ثم ما أضافه الفرع.
   - `admin.html` و`admin-pb.js` ← نسخة main ثم `build-admin-pb.py` من المصادر المدموجة.
4. مراجعة: `git diff --stat origin/main` يجب أن يقتصر على **54 ملفاً غير قوالب** (أدوات القوالب/الاختبارات/المطوّر/PHP/التوثيق) و`assets/pages/templates/**`، وملفات الستة والـ`VERSION` **مطابقة لـmain**.
5. اختبارات (القسم 5) ثم `git commit` في الفرع (ليس main) ودفعه ليشغّل CI على النتيجة الكاملة.
6. **بعد نجاح CI ومراجعتك فقط:** دمج الفرع في `main` (سيكون دمجاً نظيفاً لأن الفرع صار يحوي main كاملاً)، ثم رفع `VERSION` وإصدار (`alyssum-release`)، وتفريغ كاش Cloudflare. main يتحرك سريعاً (488 التزام في 4 أيام): تُعاد الخطوات 1–3 قبل التنفيذ.
بدائل نُظر فيها: **rebase** مرفوض (80 التزاماً وتاريخ مشترك مع جلسات أخرى)؛ **cherry-pick بمجموعات مسارات** أنظف تاريخاً لكنه أكثر عملاً وأخطر على التبعيّات بين الملفات؛ **squash** يضيّع تاريخ القوالب.

## 5) نتيجة التجربة المحلية (لم تُدفع)
بعد تطبيق الوصفة في نسخة عمل: لا تعارض متبقٍّ؛ `git diff origin/main` = 54 ملفاً غير قوالب؛ الملفات الستة و`VERSION` مطابقة لـmain.
- **مهمة المنطق في CI (14 خطوة)** على النتيجة: **14/14 ناجحة**.
- `tests/library-audit.py`: **332/332**. `tests/package-audit.py`: **23/23** (لا تسريب). `scripts/test-protect-bots.js`: ناجح.
- `scripts/test-hand.js`: **323/323** (`merged-tree-test-hand.log`). `scripts/test-edition-real.js`: ناجح. `test-upsell-admin` و`test-upsell-follow` و`test-digital-ui` و`test-kind`: ناجحة.
- **إخفاقان متوقَّعان بعد الدمج، ومصدرهما main لا الفرع:** `test-digital-checkout.js` و`test-upsell.js` تفشلان بمهلة `#dg-box`/`#name` لأن main (v1.89.1156–1162) جعل نموذج الطلب **بمرحلتين تراكميتين** (المرحلة 2 مخفية `os-hide` حتى «متابعة»). **أثبتُّ أنهما تفشلان على `origin/main` نفسه** بالنسخة الحالية من الاختبارين (`origin-main-test-*.log`)، فهما قديمان أمام النموذج الجديد. محاولتي البسيطة (نقر `.os-next`) لم تكفِ؛ إصلاحهما يتطلب فهم تحقق المرحلة 1 في main، وهو عمل منفصل قبل الدمج النهائي أو معه.

## 6) ما لم يُجرَّب وما يحتاج قرارك
- لم يُشغَّل CI على نتيجة الدمج (لا يعمل إلا بالدفع)، ولا بقية مهمة المتصفح الثلاثين على النتيجة (جُرّب منها ما سبق).
- لم أدفع فرع دمج تجريبياً (يتطلب إذنك). هل تريدني دفع `integration/merge-main` منفصلاً لتشغيل CI؟
- قرار: إصلاح اختباري `digital-checkout`/`upsell` للنموذج الجديد ضمن مرحلة الدمج؟
- الملفات الحيّة القادمة من main (`honey-focus`، `lp/*`، الرقية) تُنقَل كما هي ولم أراجع محتواها.

## 7) فرع التكامل `integration/merge-main` (بموافقتك الصريحة على دفع هذا الفرع فقط)
- يُبنى بـ`resolve-merge.py` ثم يُتحقَّق منه بـ`verify-integration.py <FEATURE_SHA>` (12 فحصاً: الملفات الستة و`VERSION` مطابقة لـ`origin/main`؛ `admin-nav.js` وقيمة `V` و`protect.json` و`s-alyssum` بلا تغيير؛ لا تعارضات ولا علامات؛ لا تراجع لأي سطر أضافه `main`؛ المولَّدان متسقان). نتائجه الفعلية في `INTEGRATION-RESULT.md` على فرع التكامل.
- **الملفات المأخوذة من `main` كما هي:** `VERSION`، `assets/js/{admin-home,admin-pack,admin-theme,data}.js`، `assets/data/ship-co.json`، وكل ما لم يمسّه الفرع (≈118 ملفاً: صفحات حيّة وهبوط ورقية ولوحة).
- **المحتفَظ به من الفرع:** القوالب ومعاينتها والصور والمولّدات والاختبارات والتوثيق والمهارات، `admin-nav.js` (علم المالك)، `platform/php-edition/api/index.php` (مسارات `_conv` وshop/account)، `make-template.py` (`_leak_scan`)، `pagebuilder*.js` (المحتوى النموذجي، الكود/العدّاد/النسب المعطّلة، أهداف اللمس، `.pb-offw`)، `shared-files.json` (`owner_only`).
- **المدموج يدوياً بالوصفة:** `shared-files.json` (الفرع + ستة مداخل من main)، `make-template.py` (نمط الرقية)، `pagebuilder.js` (`tick`: `data-nod` وتنسيق الرقم + إخفاء غلاف المعطّل)، `admin-help.json` و`changelog.md` (الاثنان)، و`admin.html`/`admin-pb.js` (يُولَّدان).
- **اكتُشف عند الدمج:** `assets/data/checkout.json` في main يفعّل `steps:true` وحماية التكرار `guard.dup:true` ومكافحة الروبوت (`antibot`)، بينما نسخة الفرع القديمة بلا ذلك ⟵ فصارت اختبارات الطلب (`test-upsell`، `test-digital-checkout`) تعمل تحت إعداد main الحقيقي: نموذج بمرحلتين وسجلّ تكرار 24 ساعة.
- **إخفاق حقيقي في `main` (لا يُخفى):** المنتج الرقمي يعلق في المرحلة 1 من نموذج المرحلتين لأن `OrderSteps.unsupported()` يبحث عن علامات (`[data-digital]` `#digital-pay` `.digital-checkout`) لا يضعها `digital-checkout.js` (يضع `#dg-box`)، بينما `validate(1)` يطلب الولاية المخفية. الاختبار يحمل فحصاً صريحاً لذلك. إصلاح من سطر واحد مجرَّب (23/23) ولكنه **لم يُطبَّق** لأنه تغيير في منطق الطلب: `proposed-fix-digital-steps.patch`.
