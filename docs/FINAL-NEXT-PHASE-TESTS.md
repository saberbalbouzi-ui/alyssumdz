# سجل اختبارات المرحلة التالية

**البيئة المحلية لكل ما يلي:** حاوية Linux (4 أنوية، 16GB)، Node (`/opt/node-tools`)، Chromium من `/opt/pw-browsers` (Playwright)، PHP محلي لمتجر معزول، **SwiftShader (WebGL برمجي)**، بيانات اصطناعية فقط. **النوع** = `محلي` (هذه الحاوية) / `CI` (GitHub Actions) / `تكامل حقيقي`. **لا اختبار هنا من نوع «تكامل حقيقي»** (لا D1/Chargily/Supabase/GPU/ميكروفون حقيقي).
**SHA وقت التشغيل المحلي:** `ac88e69d` + تعديلات هذه المرحلة؛ أُودعت لاحقاً كـ`f91e5b37856b8d0699f052fec1397a6dd405d7d2` وشُغِّل عليها **CI على GitHub (التشغيل 4289) فنجحت مهامه الثلاث** (انظر القسم F). لا دمج ولا نشر.
**الحالات:** `VERIFIED` أُثبت كما هو موصوف · `PARTIALLY VERIFIED` أُثبت جزئياً/محلياً فقط · `BLOCKED` لا بيئة · `NOT TESTED` لم يُشغَّل.

## A) اختبارات المهام الأربع (جديدة/معدّلة)
| الاختبار | الأمر | ناجح/فاشل | المدة | النوع | الحالة |
|---|---|---|---|---|---|
| `test-template-pack` (E-10) — **قبل الإصلاح** | `node scripts/test-template-pack.js` | 4 / 4 فاشل | ~6ث | محلي | يثبت العيب |
| `test-template-pack` (E-10) — بعد الإصلاح | نفسه | **8 / 0** | 6ث | محلي | `VERIFIED` |
| `idem-prune` (pf_idem) — **قبل التنفيذ** | `node --no-warnings platform/api/test/idem-prune.test.mjs` | 10 / 9 فاشل | <2ث | محلي (node:sqlite) | يثبت الفجوة |
| `idem-prune` — بعد التنفيذ | نفسه | **19 / 0** | <2ث | محلي (node:sqlite، **ليس D1**) | `PARTIALLY VERIFIED` |
| `phase11a` كامل على HEAD (قبل الإصلاح) | `NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phase11a.js` | 30 / 1 فاشل (R5) | 283ث | محلي (Qwen+LoRA حقيقي محلي، متجر PHP) | يثبت العيب |
| `phase11a` كامل على خط الأساس `388f8636` (worktree) + تشخيص | نفسه + سطر تشخيص مؤقت | 30 / 1 فاشل (R5، `y=8853.4765625`) | 275ث | محلي | يثبت أنه قديم |
| `phase11a` `ONLY=R5` على HEAD | `ONLY=R5 node …/phase11a.js` | تشغيل 1: 0/2 فاشل (`local:timeout` 12004ms بارد)؛ تشغيلان لاحقان (THREADS=2 و4): 3/0 | 84ث؛ 30ث؛ 29ث | محلي | عامل بيئي موثَّق |
| `phase11a` كامل بعد إصلاح الاختبار | `node …/phase11a.js` | **32 / 0**، rc=0 | 213ث | محلي | `VERIFIED` محلياً؛ **ليس في CI** (`NOT TESTED` على GitHub) |
| بوابة `nlu-eval` السلبية (حدّ 99 مؤقت) | نسخة مؤقتة محذوفة | rc=1 كما يُراد | <1ث | محلي | `VERIFIED` |

## B) مجموعة Spatial OS كما سيشغّلها CI (`bash admin-preview/spatial-os/test/ci-run.sh`) — تشغيل واحد كامل محلي
| الاختبار | ناجح / فاشل | المدة | rc | الحالة |
|---|---|---|---|---|
| `nlu-eval.js` (AgentNLU حتمي) | 75 PASS / 0 FAIL محسوب (= **73/73 ضمن النطاق** + 2 من `darija-latin` الخارج عن النطاق؛ 1 فاشل خارج النطاق معروض لا يحجب) | <1ث | 0 | `VERIFIED` (محلي) |
| `spatial-viewports.js` (11 عرضاً 280–2560، Chromium محاكاة) | 66 / 0 | 44ث | 0 | `VERIFIED` (محلي) |
| `run.js all` (سطح مكتب + هاتف، q=3) | 145 / 0 | 320ث | 0 | `VERIFIED` (محلي) |
| `phase9.js all` (المزامنة الحيّة) | 95 / 0 | 490ث | 0 | `VERIFIED` (محلي) |
| `phase10.js all` (وكيل «اسألني») | 136 / 0 | 415ث | 0 | `VERIFIED` (محلي) |
| `phase11.js` (النواة 3D + صوت بميكروفون **وهمي**) | 96 / 0 | 315ث | 0 | `PARTIALLY VERIFIED` (محاكاة Chromium؛ لا ميكروفون ولا GPU حقيقي) |
| `phase12b-client.js` | 11 / 0 | <1ث | 0 | `VERIFIED` (محلي، vm + fetch وهمي) |
| `phase12b1-client.js` | 101 / 0 | 1ث | 0 | `VERIFIED` (محلي، vm) |
| `phase12b1c-client.js` | 56 / 0 | <1ث | 0 | `VERIFIED` (محلي، vm؛ **ليس** PostgREST حقيقياً) |
| **المجموع** | **781 PASS / 0 FAIL** | **1585ث (≈26.4د)** | 0 | job `spatial-os` على GitHub (التشغيل 4289): **`VERIFIED`** بأعداد مطابقة، 25.5د |

## C) انحدار Worker (Idempotency والمدفوعات/Webhook) — بعد تعديل `core.js`
أمر كل منها: `node --no-warnings platform/api/test/<الاسم>.test.mjs` — كلها **ناجحة، 0 فاشل**، محلي node:sqlite (**ليس D1**)، الحالة `PARTIALLY VERIFIED`:
`platform` 56 · `core-modules` 52 · `commerce-modules` 53 · `growth-modules` 46 · `carts` 25 · `tryon` 22 · `payments` 29 · **`payments-12c` 24** · **`payments-currency` 33** (Webhook/عملة) · `sms` 27 · `commerce` 34 · `commerce-strict` 102 · `commerce-strict-catalog` 2 · `sources` 68 · `ads` 28 · `adsoauth` 47 · `wallet` 75 · **`wallet-currency` 26** · `deposits` 33 · `agency` 75 · `appstore` 179 · `logistics` 18 · `digital-vault` 79 · `boundaries` 269 · `hardening` 45 · `reservations` 33 · `suppliers` 49 · `marketplace` 75 · `isolation` 40 · `isolation-fuzz` 2 · `orders-concurrency-isolation` 9 · **`orders-idempotency` 19** · **`orders-idempotency-concurrency` 19** · **`idempotency-claim-ownership` 24** · **`idem-prune` 19 (جديد)**. (35 ملفاً.) المدة لكل ملف لم تُقَس منفرداً (ثوانٍ قليلة).
بوابة الشحن: `gateway.test.mjs` 139 ✓ · `carriers.parity.test.mjs` 8 ✓ (محلي).

## D) انحدار المنطق والمتصفح (محلي، على التعديلات الحالية)
| الاختبار | الأمر | النتيجة | المدة | الحالة |
|---|---|---|---|---|
| E-07 (توليد `admin.html`/`admin-pb.js` ثم `git diff --quiet`) | `python3 scripts/build-admin-pb.py && git diff --quiet -- admin.html assets/js/admin-pb.js` | rc=0 | <1ث | `VERIFIED` |
| `test-admin-sync` | `node scripts/test-admin-sync.js` | ✓ مطابق | <1ث | `VERIFIED` |
| `test-voice` | `node scripts/test-voice.js` | 290/290 | 1ث | `VERIFIED` |
| `test-hand` (المتصفح الحقيقي) | `NODE_PATH=… node scripts/test-hand.js` | 322/322 | 326ث | `VERIFIED` (محلي) |
| `test-digital-checkout` | نفسه نمطاً | كل الفحوص ✓ | 18ث | `VERIFIED` (محلي) |
| `test-upsell` | | كل الفحوص ✓ | 9ث | `VERIFIED` (محلي) |
| `test-edition-real` (PHP حقيقي معزول) | | ALL OK | 26ث | `VERIFIED` (محلي) |
| `test-shipagg` | | 38 ✓ | <1ث | `VERIFIED` (محلي) |
| `test-stock` 12 · `test-payments` 22 · `test-shiptable` 11 · `test-shipsup` 27 · `test-hub` 30 · `test-roles` 49 · `test-dispatch` 10 · `test-wh` 24 | `node scripts/<الاسم>.js` | كلها ✓ | ≤1ث لكل منها | `VERIFIED` (محلي) |
| فحص صياغة كل `scripts/*.js` و`assets/js/*.js` | `node --check` | 0 أخطاء | — | `VERIFIED` |
| فحص أسرار على فرق هذه المرحلة | `grep` على `service_role|sb_secret|AKfycb|BEGIN PRIVATE…` | لا نتائج | — | `VERIFIED` (فحص نصي بسيط، ليس ماسح أسرار كاملاً) |

## E) غير مُعاد تشغيله في هذه المرحلة / غير مُشغَّل
| البند | الحالة | السبب |
|---|---|---|
| بقية خطوات job المتصفح (saas-wallet/-e2e، agency، speed، appstore×3، digital-ui، kind، assets، vgen، vad، pagerater، edition/-live، barcode، pack3d، mockup، boxdesigner/profiles/3d/studio، fashion، tryon-shopper، upsell-admin/-follow) واختبارات PHP (`test-gateway.php`، وحدة الشحن) | `PARTIALLY VERIFIED` | نجحت في CI التشغيل 4266 عند `ac88e69d`؛ **لم أُعدها على الشجرة الجديدة** ولم يتغير `assets/` ولا الشيفرة التي تختبرها؛ لم يُشغَّل CI على التعديلات |
| بقية الخطوات (كل ما في A–D غير المذكور في F) على مشغّل GitHub | — | انظر F: job المتصفح (42 خطوة) والمنطق نجحا على `f91e5b37` |
| `phase11a` في CI | `NOT TESTED` | يحتاج Qwen+LoRA وPyTorch (~5.6GB) |
| D1 الحقيقي (تنظيف pf_idem والفهرس والتزامن) | `BLOCKED` | لا D1 اختباري |
| Chargily/Supabase الحقيقيان | `BLOCKED` | لا بيئات اختبارية |
| WebGL على GPU حقيقي، ميكروفون/STT/TTS حقيقي | `NOT TESTED` | SwiftShader وجهاز وهمي |
| WebKit / Firefox / Safari | `NOT TESTED` | غير مثبتة |
| تثبيت حزمة github فعلياً عند عميل (`setup-supabase.sh`) | `NOT TESTED` | يحتاج مشروع Supabase اختباري |


## F) نتيجة CI على GitHub Actions — التشغيل 4289 (`f91e5b37856b8d0699f052fec1397a6dd405d7d2`، push على الفرع)
| Job | النتيجة | المدة | ملاحظات |
|---|---|---|---|
| اختبارات المنطق (بلا متصفح) | `VERIFIED` نجح (كل الخطوات، منها E-07 وE-10 `test-template-pack` 7ث وWorker وبوابة الشحن) | ~50ث | `idem-prune` ضمن حلقة Worker |
| اختبار اللوحة في متصفح حقيقي | `VERIFIED` نجح (42 خطوة، `test-hand` 5د16ث) | ~13د | Chromium 153 |
| Spatial OS (الجديد) | `VERIFIED` نجح: nlu 75 · viewports 66 · run 145 · phase9 95 · phase10 136 · phase11 96 · 12b 11 · 12b1 101 · 12b1c 56 = **781 / 0** | 25.5د | المدد: 1/42/293/475/387/331/0/1/0 ث؛ artifact `spatial-os-logs` رُفع |
**قيود صريحة:** تشغيل واحد (لا إثبات ثبات)؛ أعداد المنطق والمتصفح استُنتجت من حالة الخطوات (نجاح/فشل) لا من قراءة سجل كل خطوة؛ أعداد Spatial OS قُرئت من سجل الخطوة. تنظيف `pf_idem` يُختبر في CI على SQLite لا D1. لا يعني هذا جاهزية للإنتاج.

## G) جولة تجهيز Beta ومراجعة pf_idem — الانحدار المحلي الكامل (على التعديلات غير المدفوعة)
**البيئة:** نفسها أعلاه + miniflare 4 (workerd المحلي) لاختبار D1. **لم يُدفَع شيء ولم يُشغَّل CI على GitHub لهذه التعديلات.** 56 خطوة، كلها rc=0.
| المجموعة | الأمر | الأعداد | النوع | الحالة |
|---|---|---|---|---|
| Worker (39 ملفاً) | `node --no-warnings platform/api/test/<اسم>.test.mjs` | **1892 فحصاً ناجحاً، 0 فاشل** | محلي (node:sqlite ≠ D1) | `PARTIALLY VERIFIED` |
| البوابة (3 ملفات) | `node --no-warnings platform/gateway/test/*.test.mjs` | 155 (139 + 8 + 8) | محلي | `PARTIALLY VERIFIED` |
| مراجعة pf_idem | `…/idem-review.test.mjs` | 34/34 | محلي | `PARTIALLY VERIFIED` |
| pf_idem على D1 المحلي (workerd) | `MF_DIR=… N=20000 node platform/api/test/d1/idem-d1-local.mjs` | 14/14، 17ث | محرك D1 محلي (**ليس الخدمة البعيدة**) | `PARTIALLY VERIFIED`؛ D1 بعيد `BLOCKED` |
| حارس البيئات | `…/envguard.test.mjs` | 41/41 | منطق نقي | `VERIFIED` |
| عزل Beta (نقطة دخول Worker) | `…/beta-isolation.test.mjs` | 31/31 | Worker حقيقي + D1 محاكى + fetch مسجَّل | `PARTIALLY VERIFIED` |
| وحدة Beta | `…/beta-module.test.mjs` | 37/37 | نفسه | `PARTIALLY VERIFIED` |
| ملكية الجداول | `…/boundaries.test.mjs` | 282/282 | ثابت | `VERIFIED` |
| إقلاع البوابة Beta | `…/beta-boot.test.mjs` | 8/8 | Worker حقيقي + D1 محاكى | `PARTIALLY VERIFIED` |
| أدوات النشر (dry-run بلا شبكة) | `node scripts/test-beta-deploy.js` | 40/40 | بلا شبكة | `VERIFIED` (لا Cloudflare حقيقي) |
| سياسة workflows | `python3 scripts/test-workflow-policy.py` | 31/31 + اختبار سلبي (rc=1 مع workflow سيئ) | ثابت | `VERIFIED` |
| بناء Beta | `node scripts/test-beta-build.js` | 18/18، 19ث | ملفات | `PARTIALLY VERIFIED` (Supabase Beta وهمي) |
| Beta في Chromium | `NODE_PATH=… node scripts/test-beta-browser.js` | 29/29، 22ث | متصفح حقيقي، شبكة مقطوعة | `PARTIALLY VERIFIED` |
| حزمة القالب (+ payments.json فارغ) | `node scripts/test-template-pack.js` | 9/9 | ملفات | `VERIFIED` |
| سجل البيئات متزامن · E-07 · admin-sync · roles | `sync.mjs --check` · `build-admin-pb.py + git diff` · `test-admin-sync` · `test-roles` | ✓ · ✓ · ✓ · 49 | | `VERIFIED` |
| متصفح المتجر/PHP حقيقي | `test-hand` · `test-edition` · `test-edition-real` · `test-digital-checkout` | 322/322 (325ث) · 19/19 · ALL OK (27ث) · ✓ (18ث) | حقيقي-محلي | `VERIFIED` (محلياً) |
**نتائج اختبار سلبي موثَّقة:** بناء Beta بمشروع/مفتاح Production، أو مفتاح سرّي، أو رابط غير صالح، أو بلا مشروع ⇒ رفض (rc=2)؛ `workflow` يخرق السياسة ⇒ فشل.
**لم يُعَد تشغيله في هذه الجولة:** بقية خطوات job المتصفح وSpatial OS (لم يتغير `assets/` ولا Spatial OS؛ نجحت في CI 4289) — ما زال `PARTIALLY VERIFIED` على الالتزام الجديد حتى يُشغَّل CI.
