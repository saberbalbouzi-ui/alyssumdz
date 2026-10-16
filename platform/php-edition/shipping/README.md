# وحدة تجميع شركات التوصيل (Shipping Aggregator) — PHP 8.1+

نمط **Adapter**: عقد واحد `ShippingInterface` ومحوّل لكل شركة، و`ShippingFactory` يختار المحوّل، و`webhook.php` واحد يترجم كل الحالات إلى حالات موحَّدة. بلا Composer ولا وسيط خارجي: المنصة هي نفسها المجمِّع.

## المحتويات
| الملف | الدور |
|---|---|
| `src/ShippingInterface.php` | العقد: `authenticate`, `createParcel`, `trackParcel`, `cancelParcel`, `labelUrl`, `wilayas`, `mapStatus`, `parseWebhook` |
| `src/Adapters/*` | Yalidine، ZR Express (Procolis)، Maystro، NOEST، **Ecotrack العام** (DHD وغيرها) |
| `src/CarrierRegistry.php` + `ShippingFactory.php` | السجلّ والمصنع (شركات Ecotrack كلها ← `EcotrackAdapter` برابطها) |
| `src/CredentialVault.php` | تشفير **AES-256-GCM** للمفاتيح (مفتاح من البيئة، ربط بالسياق، تدوير) |
| `schema.sql` / `schema.sqlite.sql` | `user_carriers` (مفاتيح مشفَّرة)، `shipments`، `shipment_events` |
| `src/ConnectionRepository.php` | تفعيل شركة لتاجر وتخزين المفاتيح مشفَّرة |
| `src/ShippingService.php` | «أرسل هذا الطلب»: عدم تكرار مضمون بقيد فريد في القاعدة |
| `webhook.php` + `src/WebhookProcessor.php` | نقطة الاستقبال الموحَّدة + `mapCarrierStatus()` |
| `src/StatusMapper.php` | قواعد الترجمة إلى الحالات الموحَّدة |
| `scripts/test-shipping.php` | 111 فحصاً بلا شبكة (عميل HTTP وهمي + SQLite) |

## التشغيل
1. أنشئ الجداول: `schema.sql` على MySQL أو `schema.sqlite.sql` على SQLite.
2. ولّد مفتاح التشفير وضعه **خارج المستودع والجذر العام**: `php -r 'echo base64_encode(random_bytes(32));'` ← `APP_ENCRYPTION_KEY` (انظر `config.example.env`). احفظ نسخة منه في مكان آمن: ضياعه = ضياع كل المفاتيح المخزَّنة.
3. اضبط `SHIPPING_DB_DSN` (و`SHIPPING_ENV_FILE` إن استعملت ملفاً). على Nginx احجب `data/` (على Apache يكفي `.htaccess` الموجود).
4. الاستعمال من شيفرة المنصة:
```php
require 'platform/php-edition/shipping/bootstrap.php';
['repo' => $repo, 'service' => $svc] = shipping_services();

// تفعيل التاجر لشركة (مرة واحدة): المفاتيح تُشفَّر ويُعاد رابط الـwebhook
$c = $repo->connect($userId, 'yalidine', ['apiId' => '…', 'apiToken' => '…']);
$webhookUrl = "https://منصتك/shipping/webhook.php?c={$c['public_id']}&t={$c['webhook_secret']}";   // السرّ يظهر مرة واحدة فقط

// شركات Ecotrack: بعضها برابط معروف (dhd)، وغيرها يُدخل التاجر رابط منصته
$repo->connect($userId, 'conexlog', ['token' => '…', 'baseUrl' => 'https://xxx.ecotrack.dz']);

// إرسال طلب (الاستدعاء الثاني لنفس الطلب لا ينشئ طرداً ثانياً)
$res = $svc->ship($userId, 'yalidine', Parcel::fromArray([...]));
```
5. سجّل رابط الـwebhook عند الشركة أو في حساب التاجر؛ GET بـ`?subscribe&crc_token=` يردّ بالتحقق CRC (ياليدين).

## ما يفعله التاجر
1. «وسائل التوصيل» ← الشركة ← «تفعيل» ← يلصق مفاتيحه (تُشفَّر).
2. على الطلب: «إرسال» ← يختار من الشركات المفعَّلة.
3. زر «طباعة البوليصة» عندما تدعمه الشركة.
4. التتبع تلقائي عبر الـwebhook (وتُنقَّل الحالة ولا تتراجع).

## الحالات الموحَّدة
`pending` · `shipped` · `out_for_delivery` · `delivered` · `failed_attempt` · `returned` · `cancelled` · `unknown`.
النهائية (`delivered/returned/cancelled`) لا تتغيّر برسالة متأخرة، والمجهول لا يُطبَّق، وإعادة إرسال الحدث نفسه تُتجاهل.

## الأمان
- AES-256-GCM مصادَق عليه، nonce جديد لكل تشفير، **AAD = user|carrier** فنسخ صف إلى مستخدم آخر لا يُفكّ.
- المفتاح من البيئة؛ التدوير: أضف `k2` في `APP_ENCRYPTION_KEYS` واجعله `APP_ENCRYPTION_KID` ثم `ConnectionRepository::rotate()`.
- سرّ الـwebhook عشوائي (48 حرفاً)، يُحفظ sha256 فقط، ويُقارن بـ`hash_equals`.
- عميل HTTP: HTTPS فقط، يرفض العناوين الداخلية ويثبّت الـIP (ضد SSRF وتبديل DNS)، مهلة وحدّ حجم، بلا تتبّع تحويلات.
- لا تُسجَّل المفاتيح ولا أجسام الطلبات في أي سجلّ.

## ⚠️ حدود صريحة (اقرأها قبل البيع)
- **لم يُجرَّب أي محوّل على حساب شركة حقيقي** (لا شبكة ولا مفاتيح هنا). الاختبارات تتحقق من الصيغة التي نبنيها ونفسّرها، لا من قبول الشركة لها.
- **Yalidine** مبني على التوثيق وعلى تكامل لوحة أليسوم القائم (الأوثق). **ZR/Maystro/NOEST/Ecotrack = تجريبي**: ZR تعمل على منصة Procolis (مسار `/lire` وردّه غير مؤكَّدين)؛ Maystro قد تطلب معرّفات ولاية/بلدية رقمية خاصة بها؛ مسارات NOEST للتتبع/الإلغاء مبنية على النمط المعتاد؛ بوليصة Ecotrack تتطلب ترويسة Bearer فلا يوجد رابط مباشر.
- **روابط شركات Ecotrack:** المؤكَّد في المستودع `dhd.ecotrack.dz` فقط؛ الباقي (Conexlog, Zimou, HHD, Anderson, E-com Delivery, Elogistia, 48H) يُدخل التاجر رابط منصته. أي رابط غير مؤكَّد لم أخمّنه.
- **Mylers:** لا توثيق عام مؤكَّد فلا محوّل (يظهر `planned`).
- **Procolis** هي منصة ZR Express نفسها (`procolis.com/api_v1`) فتُوجَّه إلى `ZRExpressAdapter` لا إلى Ecotrack.
- صيغ webhook للشركات غير ياليدين عامة (`tracking` + `status`) وتحتاج مطابقة مع ما ترسله كل شركة فعلاً.
- مطابقة الولايات/البلديات: يُرسَل اسم الولاية الأم للولايات 59–69 عند الشركات ذات الترقيم القديم؛ أسماء البلديات تُرسل كما أدخلها التاجر (قد ترفضها الشركة إن اختلفت تهجئتها — راجع `communes` في `assets/js/wilayas.js`).
- الوحدة مستقلة عن `platform/php-edition/api/index.php` الحالي ولم تُدمج في حزم العملاء بعد.


## التشغيل داخل نسخة PHP (v1.89.138)

تُشغَّل الوحدة تلقائياً من `api/index.php` عبر `integration.php` (انظر CLAUDE.md): مسارات `ship_*` للمدير و`ship_webhook` العام، قاعدة `api/_data/shipping.sqlite` ومفتاح `api/_data/ship.key` يُولَّدان تلقائياً. `webhook.php` و`bootstrap.php` هنا للاستعمال المستقل (منصة منفصلة) ولا يدخلان حزمة العميل.
الاختبار: `php scripts/test-ship-php.php`.
