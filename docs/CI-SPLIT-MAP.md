# خريطة فصل CI: Website وPlatform وBeta Integration

> المستودع واحد، و`.github/workflows/tests.yml` يبقى المرجع القديم ولم يتغير فيه **إلا** تثبيت `runs-on: ubuntu-24.04` لوظيفة المتصفح `ui` (سطر واحد؛ `ubuntu-latest` صار 26.04 ولا يدعمه Playwright 1.56.1). المسارات الجديدة منقولة منه **حرفياً** (أوامر وخطوات إعداد)، وتعمل على push/PR لمساراتها فقط، بلا أسرار ولا نشر (`contents: read`).
> الأداة `scripts/ci-coverage.py` تفرض ذلك (C1–C6) وتفشل عند أي خرق (جُرِّبت بطفرات لكل شرط). السياسة `scripts/test-workflow-policy.py` (W4) تمنع الكتابة/الأسرار/النشر في المسارين.

## المسارات
| المسار | الملف | يغطي | الحالة |
|---|---|---|---|
| **Website CI** | `website-ci.yml` | موقع ALYSSUM: المتجر ولوحته وإصدار PHP وقوالب العملاء | منطق (16 خطوة) + متصفح (14 اختباراً) + استوديوهات 3D/ذكاء (10 اختبارات، وظيفة `website-studios`) |
| **Platform CI** | `platform-ci.yml` | منصة SaaS: Worker `platform/api` وبوابة `platform/gateway` وواجهات `saas/` | منطق (28 أمراً، منها `test-toolpages`) + متصفح (8: 4 `test-saas-*` و4 واجهات عقد المنصة) |
| **Beta Integration CI** | `beta-integration.yml` (يدوي، تكامل حقيقي، بيئة `alyssumdz-beta`) و`beta-static-tests.yml` (ساكن، بلا أسرار) | عزل Beta والتكاملات الحقيقية | موجودان في فرعَي Beta |

## قاعدة التصنيف (بدليل نصي من الكود لا من الأسماء)
- **منصة:** اختبارات `platform/api/test` و`platform/gateway/test`، و`test-shipagg.js` (يستورد `platform/gateway/src`)، و`test-saas-*` (تستورد `platform-admin` وتفتح صفحات `saas/`).
- **موقع:** سكربتات تحمّل `assets/js/admin-*.js` أو `admin.html` أو `php-edition`، واختبارات إصدار PHP، و`test-hub` (Hub البائع، `hub.sql` مستبعَد من حزمة العميل).
- **الاختبارات الـ17 (صُنِّفت واعتُمدت، نُقلت):** منصة (5): `test-toolpages` ← `platform-logic`، و`test-agency-ui` و`test-appstore-ui` و`test-appstore-dev-ui` و`test-digital-ui` ← `platform-ui` (واجهات عقد المنصة). موقع (12): `test-digital-checkout` و`test-tryon-shopper` ← `website-ui` (وعقدهما مع المنصة: مساراتا `platform/api/src/modules/digital.js` و`tryon.js` تشغّلان website-ci)، والعشرة الباقية ← `website-studios`. التفصيل والأدلة: `docs/CI-UNCLASSIFIED-17-REVIEW.md`.
- **اختبار جديد وحيد** في Website CI: `test-template-no-order-leak.js` (انحدار تسرّب `payments.json`، M-1) — ليس في `tests.yml`، ومُدرَج في قائمة `NEW` الموثَّقة.

## الأوامر ومكانها بعد الفصل (مولَّد بـ `python3 scripts/ci-coverage.py --markdown`)
| الأمر | الإنتاج | أين يُشغَّل بعد الفصل |
|---|---|---|
| `step:فحص صياغة ملفات JavaScript` | website | website-ci.yml |
| `step:admin.html مولَّد ومطابق للمصادر (E-07)` | website | website-ci.yml |
| `node scripts/test-voice.js` | website | website-ci.yml |
| `node scripts/test-stock.js` | website | website-ci.yml |
| `node scripts/test-payments.js` | website | website-ci.yml |
| `node scripts/test-shiptable.js` | website | website-ci.yml |
| `node scripts/test-shipsup.js` | website | website-ci.yml |
| `node scripts/test-hub.js` | website | website-ci.yml |
| `node scripts/test-roles.js` | website | website-ci.yml |
| `node scripts/test-dispatch.js` | website | website-ci.yml |
| `node scripts/test-wh.js` | website | website-ci.yml |
| `php scripts/test-shipping.php` | website | website-ci.yml |
| `php scripts/test-carriers.php` | website | website-ci.yml |
| `php scripts/test-calibration.php` | website | website-ci.yml |
| `php scripts/test-ship-php.php` | website | website-ci.yml |
| `php scripts/test-gateway.php` | website | website-ci.yml |
| `php scripts/test-roles-php.php` | website | website-ci.yml |
| `php scripts/test-webhook-php.php` | website | website-ci.yml |
| `node scripts/test-toolpages.js` | platform | platform-ci.yml |
| `node --no-warnings platform/gateway/test/gateway.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/gateway/test/carriers.parity.test.mjs` | platform | platform-ci.yml |
| `node scripts/test-shipagg.js` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/platform.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/core-modules.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/commerce-modules.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/growth-modules.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/carts.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/tryon.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/payments.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/sms.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/commerce.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/commerce-strict.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/commerce-strict-catalog.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/sources.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/ads.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/adsoauth.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/wallet.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/agency.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/appstore.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/logistics.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/digital-vault.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/boundaries.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/hardening.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/reservations.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/isolation.test.mjs` | platform | platform-ci.yml |
| `node --no-warnings platform/api/test/isolation-fuzz.test.mjs` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-hand.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-saas-wallet.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-saas-wallet-e2e.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-saas-agency.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-agency-ui.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-speed.js` | website | website-ci.yml |
| `node scripts/test-speed-fix.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-saas-appstore.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-appstore-ui.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-appstore-dev-ui.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-digital-ui.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-kind.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-assets.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-vgen.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-vad.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-pagerater.js` | website | website-ci.yml |
| `node scripts/test-edition.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-edition-live.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-edition-real.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-barcode.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-pack3d.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-mockup.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxdesigner.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxprofiles.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxprofiles3d.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxstudio.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-fashion.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-tryon-shopper.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-digital-checkout.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-upsell.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-upsell-admin.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-upsell-follow.js` | website | website-ci.yml |

## التغطية (آلية، تُفرض عند كل تشغيل لـ `scripts/ci-coverage.py`)
| الشرط | المعنى |
|---|---|
| C1 | كل أمر في المسارين الجديدين موجود حرفياً في `tests.yml` (عدا `test-template-no-order-leak.js` الموثَّق) |
| C2 | لا أمر مشترك بين المسارين ولا مكرر داخل مسار |
| C3 | كل أمر «موقع» في website-ci وكل أمر «منصة» في platform-ci، ولا أمر في المسار الخطأ |
| C5 | **لا أمر غير مصنَّف**: الأوامر الـ78 في `tests.yml` = 42 website + 36 platform، كل واحد في مسار واحد بالضبط |
| C4 | `tests.yml` لم يتغير إلا بتثبيت `ubuntu-24.04` لوظيفة `ui` (بنية yaml متطابقة عدا ذلك) |
| C6 | شروط التشغيل (`paths`): تغيّر ملف عقد المنصة (`digital.js` و`tryon.js` ⇒ website-ci؛ `agency`/`appstore`/واجهات `admin-agency|appstore|appdev|digital` و`saas/**` و`test-*` المنصّية ⇒ platform-ci)، واختبارات المنصة لا تشغّل website-ci وحدها |

## تشغيل GitHub الحقيقي وما استُخلص منه
- أول تشغيل (2026-11-17) كشف عيبين **في المسارين الجديدين**: (1) `platform-logic` على Node 20 بينما `tests.yml` يشغّل خطوة الشحن على Node 22 (`node:sqlite`) ⇒ صار Node 22؛ (2) `ubuntu-latest` صار 26.04 ولا يدعمه Playwright ⇒ وظائف المتصفح مثبَّتة على `ubuntu-24.04` (ومعها `ui` في `tests.yml` بإذنك).
- وظائف المتصفح في المسارين الجديدين تعمل كل خطوة فيها حتى لو فشلت سابقتها (`if: ${{ !cancelled() }}` كما في `ui` القديم) والوظيفة تفشل إن فشلت أي خطوة؛ كان غيابه يخفي نتائج ما بعد أول فشل.
- الاختبارات الأربعة القديمة صُحِّحت كما في `docs/CI-BASELINE-FAILURES.md`.
- نتائج الـRuns وروابطها في تقرير التسليم.

## قيود
- الازدواج: ما دام `tests.yml` لم يُقلَّص، يعمل الاختباران معاً عند تغيير ملفات مشتركة. اقتراح لاحق (يحتاج قراراً ولم يُنفَّذ): تقليص `tests.yml` بعد استقرار المسارين.
- `beta-integration.yml` يدوي ويحتاج بيئة `alyssumdz-beta` وأسرارها (إجراء خارجي).
