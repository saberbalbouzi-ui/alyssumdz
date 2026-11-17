# خريطة فصل CI: Website وPlatform وBeta Integration

> المستودع واحد، و`.github/workflows/tests.yml` **لم يُعدَّل** (يبقى المرجع القديم). المسارات الجديدة منقولة منه **حرفياً** (أوامر وخطوات إعداد)، وتعمل على push/PR لمساراتها فقط، بلا أسرار ولا نشر (`contents: read`).
> الأداة `scripts/ci-coverage.py` تفرض ذلك (C1–C4) وتفشل عند أي خرق (جُرِّبت بـ4 طفرات). السياسة `scripts/test-workflow-policy.py` (W4) تمنع الكتابة/الأسرار/النشر في المسارين.

## المسارات
| المسار | الملف | يغطي | الحالة |
|---|---|---|---|
| **Website CI** | `website-ci.yml` | موقع ALYSSUM: المتجر ولوحته وإصدار PHP وقوالب العملاء | منطق (16 خطوة) + متصفح (12 اختباراً) |
| **Platform CI** | `platform-ci.yml` | منصة SaaS: Worker `platform/api` وبوابة `platform/gateway` وواجهات `saas/` | منطق (27 أمراً) + متصفح (4) |
| **Beta Integration CI** | `beta-integration.yml` (يدوي، تكامل حقيقي، بيئة `alyssumdz-beta`) و`beta-static-tests.yml` (ساكن، بلا أسرار) | عزل Beta والتكاملات الحقيقية | موجودان في فرعَي Beta |

## قاعدة التصنيف (بدليل نصي من الكود لا من الأسماء)
- **منصة:** اختبارات `platform/api/test` و`platform/gateway/test`، و`test-shipagg.js` (يستورد `platform/gateway/src`)، و`test-saas-*` (تستورد `platform-admin` وتفتح صفحات `saas/`).
- **موقع:** سكربتات تحمّل `assets/js/admin-*.js` أو `admin.html` أو `php-edition`، واختبارات إصدار PHP، و`test-hub` (Hub البائع، `hub.sql` مستبعَد من حزمة العميل).
- **غير مصنَّف — يبقى في `tests.yml` فقط بانتظار قرارك (17):** `test-toolpages` (يحمّل `saas/landing` و`admin-nav` معاً)، وواجهات ميزات المنصة داخل لوحة التاجر (`test-agency-ui` و`test-appstore-ui` و`test-appstore-dev-ui` و`test-digital-ui` و`test-digital-checkout`)، واستوديوهات التصميم والذكاء (`test-assets` و`test-vgen` و`test-vad` و`test-pack3d` و`test-mockup` و`test-boxdesigner` و`test-boxprofiles` و`test-boxprofiles3d` و`test-boxstudio` و`test-fashion` و`test-tryon-shopper`): أدلتها متعارضة أو غير كافية فلم تُنقل.
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
| `node scripts/test-toolpages.js` | unclassified | يبقى في tests.yml فقط |
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
| `NODE_PATH=$PWD/node_modules node scripts/test-agency-ui.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-speed.js` | website | website-ci.yml |
| `node scripts/test-speed-fix.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-saas-appstore.js` | platform | platform-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-appstore-ui.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-appstore-dev-ui.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-digital-ui.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-kind.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-assets.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-vgen.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-vad.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-pagerater.js` | website | website-ci.yml |
| `node scripts/test-edition.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-edition-live.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-edition-real.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-barcode.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-pack3d.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-mockup.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxdesigner.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxprofiles.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxprofiles3d.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-boxstudio.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-fashion.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-tryon-shopper.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-digital-checkout.js` | unclassified | يبقى في tests.yml فقط |
| `NODE_PATH=$PWD/node_modules node scripts/test-upsell.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-upsell-admin.js` | website | website-ci.yml |
| `NODE_PATH=$PWD/node_modules node scripts/test-upsell-follow.js` | website | website-ci.yml |

## مقارنة التغطية بنتائج المسار القديم (محلياً، محاكاة runner — **سابقة للتشغيل الحقيقي أدناه**)
| المقارنة | النتيجة |
|---|---|
| ساكنة (C1–C4) | 78 أمراً في `tests.yml` = 30 موقع + 31 منصة + 17 غير مصنَّف؛ لا أمر مكرر بين المسارين؛ كل أمر منقول حرفياً |
| منطق (وظيفة `domain` القديمة مقابل `website-logic` + `platform-logic`) | **45 من 46 أمراً بنتيجة متطابقة** (رمز الخروج وسطر الخلاصة)، والأمر الباقي `test-toolpages` غير مصنَّف ويبقى في `tests.yml` |
| متصفح: Platform (4 اختبارات `test-saas-*`) | 4/4 ناجحة |
| متصفح: Website (12 اختباراً) | 9 ناجحة؛ 3 فاشلة **بالنتيجة نفسها على `main` النظيف**: `test-edition-real` (2 فحصان) و`test-upsell` (`TimeoutError`) و`test-hand` (فحصان: بريكة/باتنة وتبويب تعديل الصورة؛ المجموعة المتطابقة بالضبط) |
| عطل سابق في الأساس | `test-shipagg.js` يفشل فحصاً واحداً (1 من 37) على `main` النظيف وفي المسار الجديد بالنتيجة نفسها |

**الخلاصة:** المسارات الجديدة لا تُغيّر نتيجة أي اختبار منقول. الإخفاقات الأربعة أعلاه **موجودة في الأساس** وليست من الفصل. لا أعرف إن كانت تحدث على GitHub (بيئة هنا: بلا شبكة كاملة وتاريخ مختلف).

## تشغيل GitHub الحقيقي (2026-11-17) وما استُخلص منه
- أول تشغيل كشف عيبين **في المسارين الجديدين نفسيهما** وأُصلحا: (1) `platform-logic` كان على Node 20 بينما `tests.yml` يشغّل خطوة الشحن على Node 22 (`node:sqlite` غير موجود في 20) ⇒ صار Node 22؛ (2) `ubuntu-latest` صار Ubuntu 26.04 ولا يدعمه Playwright 1.56.1 (آخر نجاح لـ`tests.yml` كان على `ubuntu-24.04`) ⇒ وظيفتا المتصفح `website-ui` و`platform-ui` مثبَّتتان على `ubuntu-24.04`.
- `tests.yml` لم يُعدَّل ويبقى أحمر على `main` للسبب الثاني (قرار منفصل: تثبيت `ubuntu-24.04` فيه أو ترقية Playwright).
- تُشغَّل الاختبارات الأربعة الفاشلة سابقاً (`test-shipagg` وedition-real وupsell وhand) بعد تصحيحها كما في `docs/CI-BASELINE-FAILURES.md`.
- نتائج الـRuns تُسجَّل في تقرير التسليم (روابط وJobs)، لا هنا.

## قيود
- الازدواج: ما دام `tests.yml` لم يُقلَّص، يعمل الاختباران معاً عند تغيير ملفات مشتركة. اقتراح (يحتاج موافقتك ولم يُنفَّذ): بعد استقرار المسارين يُقلَّص `tests.yml` إلى الاختبارات غير المصنَّفة.
- الاختبارات الـ17 غير المصنَّفة لم تُنقل (بانتظار قرار التصنيف، `docs/CI-UNCLASSIFIED-17-REVIEW.md`).
