# FINAL-TEST-RESULTS — سجل الاختبارات الفعلي

- **تاريخ التشغيل:** 2026-11-14/15 · **البيئة:** حاوية Linux، Node 22.23.4، PHP 8.3.6، Python 3.13، Playwright 1.63.0 (Chromium 153)، PostgreSQL 16 محلي. لا CI حقيقي على GitHub (لا وصول لـGitHub Actions من هذه الجلسة).
- **نقطة البداية:** `67a5a7e9a81e21cfa89b5d447200d0db9fffea67`.
- **التسمية:** `rc=0` = نجاح الأمر. كل اختبار Worker **LOCAL ONLY** (SQLite داخل الذاكرة، لا D1 حقيقي). لا اختبار هنا يتصل بـSupabase/Cloudflare/Chargily الحقيقية (BLOCKED).
- المصدر الخام لكل سطر: ناتج الأمر المسجَّل أثناء التشغيل؛ الملخص عمود «النتيجة» آخر سطر ملخّص يطبعه الاختبار.


| # | الاختبار | الأمر | البيئة | rc | المدة | النتيجة |
|---|---|---|---|---|---|---|
| 1 | `ci-syntax` | `bash -c fail=0; for f in assets/js/*.js scripts/pagebuilder*.js sw.js; do if grep -q "^import " "$f"; then cp ` | Node 22.23.4 / محلي | 0 | 4s | — |
| 2 | `test-admin-sync` | `node scripts/test-admin-sync.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ admin.html مطابق للمصادر (E-07) |
| 3 | `test-voice` | `node scripts/test-voice.js` | Node 22.23.4 / محلي | 0 | 1s | ✓ نجح 290 من 290 |
| 4 | `test-stock` | `node scripts/test-stock.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ نجح 12 من 12 |
| 5 | `test-payments` | `node scripts/test-payments.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ نجح 22 من 22 |
| 6 | `test-shiptable` | `node scripts/test-shiptable.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ نجح 11 من 11 |
| 7 | `test-shipsup` | `node scripts/test-shipsup.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ نجح 27 من 27 |
| 8 | `test-hub` | `node scripts/test-hub.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ نجح 30 من 30 |
| 9 | `test-roles` | `node scripts/test-roles.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ 49 فحصاً ناجحاً |
| 10 | `test-dispatch` | `node scripts/test-dispatch.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ 10 فحصاً ناجحاً |
| 11 | `test-wh` | `node scripts/test-wh.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ 24 فحصاً ناجحاً |
| 12 | `test-toolpages` | `node scripts/test-toolpages.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ نجح 15 من 15 |
| 13 | `test-shipagg` | `node scripts/test-shipagg.js` | Node 22.23.4 / محلي | 0 | 0s | ✓ 38 فحصاً ناجحاً |
| 14 | `test-shipping` | `php scripts/test-shipping.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 0s | ✓ نجح 124 من 124 |
| 15 | `test-carriers` | `php scripts/test-carriers.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 0s | ✓ 240 فحصاً ناجحاً |
| 16 | `test-calibration` | `php scripts/test-calibration.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 0s | ✓ 63 فحصاً ناجحاً |
| 17 | `test-ship-php` | `php scripts/test-ship-php.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 10s | ✓ 41 فحصاً ناجحاً |
| 18 | `test-gateway` | `php scripts/test-gateway.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 0s | ✓ 77 فحصاً ناجحاً |
| 19 | `test-roles-php` | `php scripts/test-roles-php.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 6s | ✓ 122 فحصاً ناجحاً |
| 20 | `test-webhook-php` | `php scripts/test-webhook-php.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 1s | ✓ 12 فحصاً ناجحاً |
| 21 | `test-update-allow` | `php scripts/test-update-allow.php` | PHP 8.3.6 CLI (SQLite محلي) | 0 | 0s | 1714 فحصاً، 0 إخفاقاً |
| 22 | `gateway.test` | `node --no-warnings platform/gateway/test/gateway.test.mjs` | Node 22.23.4 / محلي | 0 | 0s | ✓ 139 فحصاً ناجحاً |
| 23 | `carriers.parity` | `node --no-warnings platform/gateway/test/carriers.parity.test.mjs` | Node 22.23.4 / محلي | 0 | 1s | ✓ 8 فحصاً ناجحاً |
| 24 | `worker-ads` | `node --no-warnings platform/api/test/ads.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 28 فحصاً ناجحاً |
| 25 | `worker-adsoauth` | `node --no-warnings platform/api/test/adsoauth.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 47 فحصاً ناجحاً |
| 26 | `worker-agency` | `node --no-warnings platform/api/test/agency.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 75 فحصاً ناجحاً |
| 27 | `worker-appstore` | `node --no-warnings platform/api/test/appstore.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 179 فحصاً ناجحاً |
| 28 | `worker-boundaries` | `node --no-warnings platform/api/test/boundaries.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 269 فحصاً ناجحاً |
| 29 | `worker-carts` | `node --no-warnings platform/api/test/carts.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 25 فحصاً ناجحاً |
| 30 | `worker-commerce-modules` | `node --no-warnings platform/api/test/commerce-modules.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 53 فحصاً ناجحاً |
| 31 | `worker-commerce-strict-catalog` | `node --no-warnings platform/api/test/commerce-strict-catalog.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 1s | ✓ 2 فحصاً ناجحاً |
| 32 | `worker-commerce-strict` | `node --no-warnings platform/api/test/commerce-strict.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 102 فحصاً ناجحاً |
| 33 | `worker-commerce` | `node --no-warnings platform/api/test/commerce.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 34 فحصاً ناجحاً |
| 34 | `worker-core-modules` | `node --no-warnings platform/api/test/core-modules.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 52 فحصاً ناجحاً |
| 35 | `worker-deposits` | `node --no-warnings platform/api/test/deposits.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 33 فحصاً ناجحاً |
| 36 | `worker-digital-vault` | `node --no-warnings platform/api/test/digital-vault.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 79 فحصاً ناجحاً |
| 37 | `worker-growth-modules` | `node --no-warnings platform/api/test/growth-modules.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 1s | ✓ 46 فحصاً ناجحاً |
| 38 | `worker-hardening` | `node --no-warnings platform/api/test/hardening.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 45 فحصاً ناجحاً |
| 39 | `worker-idempotency-claim-ownership` | `node --no-warnings platform/api/test/idempotency-claim-ownership.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 24 فحصاً ناجحاً |
| 40 | `worker-isolation-fuzz` | `node --no-warnings platform/api/test/isolation-fuzz.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 1s | ✓ 2 فحصاً ناجحاً |
| 41 | `worker-isolation` | `node --no-warnings platform/api/test/isolation.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 40 فحصاً ناجحاً |
| 42 | `worker-logistics` | `node --no-warnings platform/api/test/logistics.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 18 فحصاً ناجحاً |
| 43 | `worker-marketplace` | `node --no-warnings platform/api/test/marketplace.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 75 فحصاً ناجحاً |
| 44 | `worker-orders-concurrency-isolation` | `node --no-warnings platform/api/test/orders-concurrency-isolation.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 1s | ✓ 9 فحصاً ناجحاً |
| 45 | `worker-orders-idempotency-concurrency` | `node --no-warnings platform/api/test/orders-idempotency-concurrency.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 19 فحصاً ناجحاً |
| 46 | `worker-orders-idempotency` | `node --no-warnings platform/api/test/orders-idempotency.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 19 فحصاً ناجحاً |
| 47 | `worker-payments-12c` | `node --no-warnings platform/api/test/payments-12c.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 24 فحصاً ناجحاً |
| 48 | `worker-payments-currency` | `node --no-warnings platform/api/test/payments-currency.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 33 فحصاً ناجحاً |
| 49 | `worker-payments` | `node --no-warnings platform/api/test/payments.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 29 فحصاً ناجحاً |
| 50 | `worker-platform` | `node --no-warnings platform/api/test/platform.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 56 فحصاً ناجحاً |
| 51 | `worker-reservations` | `node --no-warnings platform/api/test/reservations.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 33 فحصاً ناجحاً |
| 52 | `worker-sms` | `node --no-warnings platform/api/test/sms.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 1s | ✓ 27 فحصاً ناجحاً |
| 53 | `worker-sources` | `node --no-warnings platform/api/test/sources.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 68 فحصاً ناجحاً |
| 54 | `worker-suppliers` | `node --no-warnings platform/api/test/suppliers.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 49 فحصاً ناجحاً |
| 55 | `worker-tryon` | `node --no-warnings platform/api/test/tryon.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 22 فحصاً ناجحاً |
| 56 | `worker-wallet-currency` | `node --no-warnings platform/api/test/wallet-currency.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 26 فحصاً ناجحاً |
| 57 | `worker-wallet` | `node --no-warnings platform/api/test/wallet.test.mjs` | Worker: Node 22 + node:sqlite (محاكاة D1) — LOCAL ONLY | 0 | 0s | ✓ 75 فحصاً ناجحاً |
| 58 | `test-hand` | `node scripts/test-hand.js` | Chromium (Playwright 1.63.0) + PHP | 0 | 321s | ✓ نجح 322 من 322 |
| 59 | `test-saas-wallet` | `node scripts/test-saas-wallet.js` | Chromium (Playwright 1.63.0) | 0 | 4s | ✓ كل الفحوص نجحت |
| 60 | `test-saas-wallet-e2e` | `node scripts/test-saas-wallet-e2e.js` | Chromium (Playwright 1.63.0) | 0 | 2s | ✓ كل الفحوص نجحت |
| 61 | `test-saas-agency` | `node scripts/test-saas-agency.js` | Chromium (Playwright 1.63.0) | 0 | 2s | كل الفحوص نجحت |
| 62 | `test-agency-ui` | `node scripts/test-agency-ui.js` | Chromium (Playwright 1.63.0) | 0 | 1s | كل الفحوص نجحت |
| 63 | `test-speed` | `node scripts/test-speed.js` | Chromium (Playwright 1.63.0) | 0 | 15s | ✓ كل اختبارات سرعة الموقع نجحت |
| 64 | `test-speed-fix` | `node scripts/test-speed-fix.js` | Node 22.23.4 / محلي | 0 | 1s | — |
| 65 | `test-saas-appstore` | `node scripts/test-saas-appstore.js` | Chromium (Playwright 1.63.0) | 0 | 2s | كل الفحوص نجحت |
| 66 | `test-appstore-ui` | `node scripts/test-appstore-ui.js` | Chromium (Playwright 1.63.0) | 0 | 2s | كل الفحوص نجحت |
| 67 | `test-appstore-dev-ui` | `node scripts/test-appstore-dev-ui.js` | Chromium (Playwright 1.63.0) | 0 | 3s | كل الفحوص نجحت |
| 68 | `test-digital-ui` | `node scripts/test-digital-ui.js` | Chromium (Playwright 1.63.0) | 0 | 2s | كل الفحوص نجحت |
| 69 | `test-kind` | `node scripts/test-kind.js` | Chromium (Playwright 1.63.0) | 0 | 6s | ALL OK |
| 70 | `test-assets` | `node scripts/test-assets.js` | Chromium (Playwright 1.63.0) | 0 | 3s | test-assets: 30 passed, 0 failed |
| 71 | `test-vgen` | `node scripts/test-vgen.js` | Chromium (Playwright 1.63.0) | 0 | 5s | نجح 28 من 28 |
| 72 | `test-vad` | `node scripts/test-vad.js` | Chromium (Playwright 1.63.0) | 0 | 1s | نجح 16 من 16 |
| 73 | `test-pagerater` | `node scripts/test-pagerater.js` | Chromium (Playwright 1.63.0) | 0 | 1s | نجح 23 من 23 |
| 74 | `test-edition` | `node scripts/test-edition.js` | Node 22.23.4 / محلي | 0 | 1s | نجح 19 من 19 |
| 75 | `test-edition-live` | `node scripts/test-edition-live.js` | Chromium (Playwright 1.63.0) | 0 | 1s |  ALL OK |
| 76 | `test-edition-real` | `node scripts/test-edition-real.js` | Chromium (Playwright 1.63.0) + PHP | 0 | 26s | ALL OK |
| 77 | `test-barcode` | `node scripts/test-barcode.js` | Chromium (Playwright 1.63.0) | 0 | 3s | ALL OK |
| 78 | `test-pack3d` | `node scripts/test-pack3d.js` | Chromium (Playwright 1.63.0) | 0 | 24s | كل الفحوص نجحت |
| 79 | `test-mockup` | `node scripts/test-mockup.js` | Chromium (Playwright 1.63.0) | 0 | 127s | — |
| 80 | `test-boxdesigner` | `node scripts/test-boxdesigner.js` | Chromium (Playwright 1.63.0) | 0 | 30s | كل الفحوص نجحت |
| 81 | `test-boxprofiles` | `node scripts/test-boxprofiles.js` | Node 22.23.4 / محلي | 0 | 1s | ✓ 29 فحصاً ناجحاً |
| 82 | `test-boxprofiles3d` | `node scripts/test-boxprofiles3d.js` | Chromium (Playwright 1.63.0) | 0 | 51s | كل الفحوص نجحت |
| 83 | `test-boxstudio` | `node scripts/test-boxstudio.js` | Chromium (Playwright 1.63.0) | 0 | 86s | كل الفحوص نجحت |
| 84 | `test-fashion` | `node scripts/test-fashion.js` | Chromium (Playwright 1.63.0) | 0 | 1s | نجح 15 من 15 |
| 85 | `test-tryon-shopper` | `node scripts/test-tryon-shopper.js` | Chromium (Playwright 1.63.0) | 0 | 8s | نجح 15 من 15 |
| 86 | `test-digital-checkout` | `node scripts/test-digital-checkout.js` | Chromium (Playwright 1.63.0) | 0 | 15s | كل الفحوص نجحت |
| 87 | `test-upsell` | `node scripts/test-upsell.js` | Chromium (Playwright 1.63.0) | 0 | 7s | ✓ كل الفحوص نجحت |
| 88 | `test-upsell-admin` | `node scripts/test-upsell-admin.js` | Chromium (Playwright 1.63.0) | 0 | 1s | ✓ كل الفحوص نجحت |
| 89 | `test-upsell-follow` | `node scripts/test-upsell-follow.js` | Chromium (Playwright 1.63.0) | 0 | 1s | كل الفحوص نجحت |
| 90 | `phase12c-midnight` | `node admin-preview/spatial-os/test/phase12c-midnight.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 1s | ALL PASS 44/44 (كل المناطق: UTC, Africa/Algiers, Pacific/Kiritimati, Pacific/Pago_Pago) |
| 91 | `phase12c-matrix` | `node admin-preview/spatial-os/test/phase12c-matrix.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 0s | ALL PASS 22/22 |
| 92 | `phase12c-security-static` | `node admin-preview/spatial-os/test/phase12c-security-static.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 0s | ALL PASS 11/11 (ملفات ممسوحة: 379) |
| 93 | `phase12b1-client` | `node admin-preview/spatial-os/test/phase12b1-client.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 0s | ALL PASS 101/101 |
| 94 | `phase12b1c-client` | `node admin-preview/spatial-os/test/phase12b1c-client.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 0s | ALL PASS 56/56 |
| 95 | `phase12b-client` | `node admin-preview/spatial-os/test/phase12b-client.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 1s | ALL PASS 11/11 |
| 96 | `phase12b1-e2e` | `node admin-preview/spatial-os/test/phase12b1-e2e.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 17s | ALL PASS 32/32 |
| 97 | `phase12b1-ui` | `node admin-preview/spatial-os/test/phase12b1-ui.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 134s | ALL PASS 67/67 |
| 98 | `phase12b1c-ui` | `node admin-preview/spatial-os/test/phase12b1c-ui.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 62s | ALL PASS 34/34 |
| 99 | `phase12c-ui` | `node admin-preview/spatial-os/test/phase12c-ui.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 1 | 69s | FAILED 1/12 |
| 100 | `phase12b-orders` | `node admin-preview/spatial-os/test/phase12b-orders.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 64s | 24 PASS / 0 FAIL (JSON) |
| 101 | `phase12b-data` | `node admin-preview/spatial-os/test/phase12b-data.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 41s | 53 PASS / 0 FAIL (JSON) |
| 102 | `phase12b-tenant` | `node admin-preview/spatial-os/test/phase12b-tenant.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 17s | 20 PASS / 0 FAIL (JSON) |
| 103 | `phase12b-panels` | `node admin-preview/spatial-os/test/phase12b-panels.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 60s | 15 PASS / 0 FAIL (JSON) |
| 104 | `spatial-run-all-default` | `env URL=http://127.0.0.1:8765/admin-preview/spatial-os/index.html node admin-preview/spatial-os/test/run.js al` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 311s | ALL PASSED (145) |
| 105 | `spatial-run-desktop-default` | `env URL=http://127.0.0.1:8765/admin-preview/spatial-os/index.html node admin-preview/spatial-os/test/run.js de` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 262s | ALL PASSED (114) |
| 106 | `spatial-run-mobile-default` | `env URL=http://127.0.0.1:8765/admin-preview/spatial-os/index.html node admin-preview/spatial-os/test/run.js mo` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 63s | ALL PASSED (31) |
| 107 | `phase5` | `env URL=http://127.0.0.1:8765/admin-preview/spatial-os/index.html node admin-preview/spatial-os/test/phase5.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 117s | ALL PASSED (75) |
| 108 | `phase7` | `env URL=http://127.0.0.1:8765/admin-preview/spatial-os/index.html node admin-preview/spatial-os/test/phase7.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 98s | ALL PASSED (37) |
| 109 | `phase8` | `node admin-preview/spatial-os/test/phase8.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 194s | ALL PASSED (60) |
| 110 | `phase9` | `node admin-preview/spatial-os/test/phase9.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 471s | ALL PASSED (95) |
| 111 | `phase10` | `node admin-preview/spatial-os/test/phase10.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 395s | 0 إخفاقات |
| 112 | `phase11` | `node admin-preview/spatial-os/test/phase11.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 342s | 0 إخفاقات |
| 113 | `phase11a` | `node admin-preview/spatial-os/test/phase11a.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 1 | 335s | **1 إخفاق: R5 — قائم على خط الأساس 388f8636** |
| 114 | `phase12-workload` | `node admin-preview/spatial-os/test/phase12-workload.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 83s | 18 PASS + 2 PARTIAL + 0 FAIL (20 سيناريو، JSON) |
| 115 | `phase12-load` | `node admin-preview/spatial-os/test/phase12-load.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 184s | 3/3 PASS (100/1000/10000 طلب، JSON) |
| 116 | `sb-local-pg` | `bash platform/supabase/tests/local/run-order-idem.sh` | PostgreSQL 16 محلي (ليس Supabase) / فحص حراسة بلا شبكة | 0 | 5s | — |
| 117 | `sb-real-guard` | `node platform/supabase/tests/real/validate-real.mjs --selfcheck` | PostgreSQL 16 محلي (ليس Supabase) / فحص حراسة بلا شبكة | 0 | 0s | — |
| 118 | `phase12c-ui-rerun` | `node admin-preview/spatial-os/test/phase12c-ui.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 1 | 69s | FAILED 1/13 |
| 119 | `phase12c-ui-rerun2` | `node admin-preview/spatial-os/test/phase12c-ui.js` | Chromium (Playwright 1.63.0) + متجر PHP معزول/معاينة؛ بيانات اصطناعية | 0 | 70s | ALL PASS 13/13 (بعد تصحيح F3b) |


## ملخص الأعداد
| البند | العدد |
|---|---|
| أوامر اختبار مُشغَّلة (صفوف الجدول) | 119 |
| rc=0 | 116 |
| rc≠0 | 3 — `phase12c-ui` و`phase12c-ui-rerun` (إخفاقان في اختبار **جديد** F3b أُصلحا أثناء الجولة، والصف الأخير `rerun2` **13/13 ناجح**) + `phase11a` (**R5، قائم على خط الأساس `388f8636` أيضاً — لم يُصلَح ولم يُخفَ**) |
| فحوص Worker (34 ملفاً، LOCAL ONLY) | 1717 ناجحة، 0 فاشلة |
| Spatial OS `run.js` (مستوى جودة مثبَّت q=3) | **145/145** = سطح مكتب 114 + هاتف 31 |
| `test-hand.js` | 322/322 |

### تفسير الفرق 144 ↔ 145 في Spatial OS
`run.js` يحوي **145 فحصاً** (114 سطح مكتب + 31 هاتف). ظهور 144 في تقارير سابقة سببه **الوضع التكيّفي للجودة**: في المُصيِّر البرمجي البطيء (SwiftShader) يُخفي المنتج لوحة الأرضية فيفشل فحص «أرضية لامعة مرسومة» (سلوك مقصود في المنتج لا خلل). التشغيل بلا تثبيت أعاد 113 ناجحاً + 1 فاشلاً في سطح المكتب و31 في الهاتف (=144 ناجحاً/145)، قبل هذه الرقعة. **التغيير:** `run.js` يثبّت الآن `q=3` افتراضياً (موثَّق في رأس الملف) ويمكن تفعيل التكيّفي بـ`Q=adaptive`. بعده: 145/145 افتراضياً (سطر `spatial-run-all-default`).

## تصنيف الحالات
| المجال | الحالة | الدليل |
|---|---|---|
| E-07 (`admin.html` مولَّد) | **VERIFIED** | أُعيد إنتاجه (سطر واحد: هاش `admin-manualorder.js`)؛ `test-admin-sync.js` فشل قبل الإصلاح ونجح بعده؛ صف `test-admin-sync` rc=0 |
| إخفاق تثبيت Chromium في CI | **PARTIALLY VERIFIED** | لا وصول لسجلات GitHub Actions ولا لتشغيلها؛ السبب الجذري **غير مُثبَت**؛ طُبِّقت تحصينات (مشغّل `ubuntu-24.04` ثابت، Playwright 1.63.0 المُتحقَّق محلياً، فصل التنزيل عن اعتماديات النظام، 3 محاولات، ذاكرة مؤقتة، فحص تشغيل). YAML صالح وأمر الفحص يعمل محلياً. **تشغيل CI الحقيقي: NOT TESTED** |
| اختبارات المتصفح في CI (33 سكربتاً) | **VERIFIED محلياً** | كلها rc=0 بعد الإصلاحات (انظر الجدول)؛ ثلاثة منها كانت فاشلة فعلاً لأسباب مستقلة (انظر التقرير) |
| منطق Worker (34 ملفاً) | **VERIFIED — LOCAL ONLY** | 1717 فحصاً؛ D1 الحقيقي **BLOCKED** |
| ملكية مطالبة Idempotency | **PARTIALLY VERIFIED — LOCAL ONLY** | `idempotency-claim-ownership` 24/24 (+19 تزامن)؛ سلوك D1/تزامن isolates الحقيقي **BLOCKED** |
| Webhook العملة (payments + wallet) | **PARTIALLY VERIFIED — LOCAL ONLY** | 33 + 26 + 24؛ حمولة Chargily الحقيقية الموقّعة **BLOCKED** (قد ترفض الشرطُ الدفعاتِ إن غابت `currency`) |
| Supabase الحقيقي (PostgREST/RLS/تزامن) | **BLOCKED** | لا مشروع اختباري؛ PG16 المحلي PARTIAL |
| Spatial OS (145 فحصاً + المراحل 5–12) | **VERIFIED** (للاختبارات الآلية) | الجدول |
| WebGL على GPU حقيقي / ميكروفون وSTT/TTS بأجهزة حقيقية | **NOT TESTED** | SwiftShader وأجهزة صوت وهمية فقط؛ مسار `webgl` ومعالجة `webglcontextlost` موجودان (فحص ثابت S11) |
| دقة فهم الدارجة/الفرنسية بنموذج LLM حقيقي | **NOT TESTED / PARTIAL** | المراحل 10/11 تختبر المحرّك الحتمي والمخطِّط بنموذج محاكى؛ مزوّد حقيقي BLOCKED |
| WebKit / Firefox | **NOT TESTED** | غير مثبتين |
| الإنتاج/النشر | **لم يحدث** | لا نشر ولا تعديل إنتاج |

## تتمة Spatial OS (جولة لاحقة على الالتزامات المحلية)
| الاختبار | الأمر | البيئة | النتيجة |
|---|---|---|---|
| `nlu-eval` | `node admin-preview/spatial-os/test/nlu-eval.js` | Node، `AgentNLU` الحقيقي (محلّل حتمي) | **73/73 ضمن النطاق المعلن** (فصحى 18/18، دارجة بالعربية 17/17، فرنسية 15/15، إنجليزية 7/7، متابعات 3/3، موافقة 3/3، أوامر خطرة 10/10)؛ **الدارجة بالأحرف اللاتينية (Arabizi) خارج النطاق المعلن: 2/3** (`chhal bi3na lyoum` ← unknown). مجموعة اصطناعية كتبتُها أنا؛ الرقم تقدير لا ضمان |
| `spatial-viewports` | `node admin-preview/spatial-os/test/spatial-viewports.js` | Chromium (Playwright) بمحاكاة 11 حجماً (280→2560 عرضاً) مع/بلا لمس؛ **ليس أجهزة حقيقية** | **66/66** (بلا تمرير أفقي، النواة والعقد، رأس اللوح ضمن الشاشة، عرض اللوح، بلا أخطاء JS) |
| `phase10` بعد تعديل NLU | `node admin-preview/spatial-os/test/phase10.js` | Chromium + متجر PHP معزول | **0 إخفاقات** (400ث) |
