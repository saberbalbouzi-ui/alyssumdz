# مرجع محوّلات شركات التوصيل (التوحيد القسري)

**القاعدة (أمر صاحب المتجر):** ما ينجح مع ياليدين يجب أن ينجح مع كل الشركات بالسلوك نفسه، ولا ننتظر عميلاً حقيقياً ليكتشف الخطأ.
الطريقة (مثل dzship): المنصة وسيط ترجمة؛ قواميس مطابقة مكتوبة في الشيفرة، ومحوّل لكل شركة (نمط Adapter) يترجم طلبنا الموحَّد إلى صيغتها وردّها إلى حالاتنا الموحَّدة.

## ما يضمنه النظام
| الطبقة | أين | ماذا |
|---|---|---|
| حالات موحّدة | `Status` / `status.js` | pending · shipped · out_for_delivery · delivered · failed_attempt · returned · cancelled · unknown |
| قاموس حالات صريح لكل شركة | `platform/php-edition/shipping/data/status-dict.json` (المصدر الوحيد) ← يولّد `platform/gateway/src/status-dict.js` بـ`node platform/gateway/tools/gen-status-dict.mjs` | `exact` (نص الحالة) · `codes` (رموز رقمية) · `event_key` (NOEST) · `ignore` (أحداث مالية/إدارية لا تغيّر حالة الطرد) |
| حالة جديدة لا يعرفها القاموس | `StatusMapper::explain` ← regex احتياطي ← `unknown` | لا تُطبَّق على الطلب، وتُسجَّل (PHP: `error_log` + `ship_unknown` تظهر في بطاقة الشركات؛ البوابة: `gw_audit` بالفعل `status.unknown`) فلا تضيع صامتة |
| مطابقة البلديات | `CommuneMatcher` / `commune.js` (تطبيع صوامت + Levenshtein، حدّ 0.82) | تصحيح التهجئة على قائمة البلديات الحقيقية للشركة (`get/communes`) أو رفض بلا طلب إنشاء مع «الأقرب: …» |
| الولايات 59–69 | `Parcel::legacyWilaya()` | تُرسل دائماً برمز/اسم الولاية الأم (≤58) لأن الشركات لم تحدّث ولاياتها |
| اختبار اتصال | `ping()` في كل محوّل (قراءة فقط) | عند التفعيل: مفاتيح ترفضها الشركة **لا تُحفظ** (يُكتشف الخطأ فوراً)؛ ردّ غامض ⇒ تُحفظ مع تنبيه؛ زر «اختبار الاتصال» لاحقاً |
| محاكيات صارمة | `scripts/lib/carrier-sims.php` | كل محاكٍ يتحقق من الترويسات وموضع المعاملات (استعلام/جسم) والحقول المطلوبة وأنواعها وتهجئة البلدية كما تفعل الشركة؛ أي مخالفة ⇒ HTTP 400 + تسجيل في `violations` |
| اختبار مطابقة مشترك | `php scripts/test-carriers.php` (167 فحصاً) | السيناريوهات نفسها على الشركات الخمس: ping، إنشاء منزل، تهجئات البلدية، الولايات الجديدة، Stop Desk بلا رمز/برمز، بلدية مجهولة، تكرار، 429، مفاتيح خاطئة، **كل مدخلات القاموس عبر ردّ المحاكي الكامل**، حالة غريبة، إلغاء قبل/بعد |
| تطابق PHP ↔ بوابة JS | `scripts/gen-carrier-golden.php` ← `platform/gateway/test/carrier-golden.json` + `carriers.parity.test.mjs` | اللقطة تسجّل كل طلب صادر وردّه ونتيجته؛ المحوّلات JS تُعاد عليها وتشترط التطابق بالحرف (مسار/معاملات/ترويسات/جسم/نتيجة). تعديل محوّل PHP ⇒ أعد توليد اللقطة وإلا فشل الاختبار |

## الشركات: المصدر ودرجة الثقة
| الشركة | المصدر | الثقة | ملاحظات |
|---|---|---|---|
| **Yalidine** | حساب حقيقي (إنشاء/تتبع/بوليصة/إلغاء، 1216 طرداً) | عالية | `POST /v1/parcels/` مصفوفة، `to_wilaya_name` باسم الأم، `stopdesk_id` رقمي |
| **Ecotrack** (DHD وعائلتها) | نص وثيقة الشركة | متوسطة–عالية | `create/order` **معاملات استعلام وبلا جسم**، Bearer، `valid/order` (يُستدعى تلقائياً ما لم `autoValidate=0`)، `delete/order` قبل التصديق فقط، البلدية من `get/communes`، المحطة `code_postal`، `validate/token` للفحص |
| **NOEST** | نص وثيقة الشركة | متوسطة–عالية | Bearer + `api_token`/`user_guid` في الجسم، حقول `client/phone/adresse/wilaya_id/commune/montant/produit/type_id/poids/stop_desk`، `station_code` (16A) للمكتب، الحالة من آخر `event_key` غير المالي |
| **Maystro** | مستودعات عامة متفقة (CourierDZ, uften, dzcouriers, Vargo) — لا وثائق رسمية | متوسطة | `Authorization: Token`، **معرّف بلدية رقمي** من `base/communes`، `products[]` و`source`=4، `delivery_type` v2 (1 منزل/2 مكتب) أو v1 عبر `scheme`، الإلغاء `PATCH status=50`، الحالة رقمية (`codes`) |
| **ZR Express** (Procolis القديمة) | مستودعات عامة متفقة — لا وثائق رسمية | متوسطة | ترويستا `token`/`key`، `add_colis {Colis:[…]}` بتهجئة الشركة `Confrimee`، الرفض يعود HTTP 200 + `MessageRetour`، `Double Tracking` = مكرّر، لا إلغاء ولا بوليصة |

## المعايرة عند أول ربط (Calibration)
**الفكرة:** مع أول مفاتيح (توكن/معرّف/…) يلتقط النظام حساب الشركة نفسه بقراءة فقط ويبني «ملف معايرة» يصحّح النظام **قبل** أن يُعاد التحكم للتاجر، فلا ينتظر أحد أول طلب حقيقي ليكتشف الخطأ.
| ما يُلتقط | كيف | أثره على الإرسال |
|---|---|---|
| بلديات الشركة لكل ولاية (وقابلية التوصيل) | `discover()` في كل محوّل ← `Calibrator::mergeGeo` | خريطة «اسمنا ← اسم الشركة» (وبمعرّفات Maystro الرقمية)؛ بلدية غير موجودة أو لا توصّل إليها الشركة ⇒ **منع مبكر برسالة عربية بلا استدعاء** |
| مكاتب Stop Desk الحقيقية (ياليدين: `/v1/centers/`، Ecotrack: من البلديات) | `discover(desks)` | مكتب غير موجود في حسابك ⇒ منع مبكر |
| تعريفة الحساب (ياليدين `/v1/deliveryfees/`) | `discover(fees)` | تُعرض في التقرير |
| حالات طرودك الحالية (قائمة الطرود) | `auditStatuses` + `explainStatus` | المجهول يُعلَن ولا يُطبَّق؛ ما قُدِّر بالقواعد العامة يُثبَّت صراحةً في `status_overrides` |
| صلاحية قراءة ردّ التتبع | `verify`: `trackParcel` على ≤3 طرود حقيقية | إخفاق ⇒ تحذير يُرسل للدعم لتصحيح المحوّل |
| شكل إشعارات الـwebhook الأولى + التوقيع | `WebhookProcessor::capture` / `inbound` | تقرير «وصل N إشعار وحُلِّل M» ؛ مع `webhookSecret` (ياليدين) يُرفض أي إشعار بتوقيع خاطئ (401) |
**الحالة:** `phase` = geo ← meta ← verify ← done، مخزَّنة داخل الملف نفسه (PHP: جدول `carrier_profiles`؛ البوابة: `gw_profiles`) فتُنفَّذ على دفعات بين طلبات قصيرة وتُستأنف. الواجهة: بعد «حفظ وتفعيل» تتابع دورة `ship_calibrate` (أو `POST /v1/connections/:c/calibrate`) حتى `done`. **الزبون لا يقرأ أي تقرير** (يرى «تم ربط الشركة» فقط)؛ المشاكل تُرسل صامتةً إلى الإدارة (تذكرة `support` «[معايرة] …» بحمولة `carrier_calibration`). **إعادة الربط بمفاتيح جديدة تمسح الملف القديم.**
**معالجة البلاغات (للمدير فقط):** تبويب «المعايرة» في لوحة المزوّد: الحالات المجهولة تُعتمد بنقرة وتُعمَّم على كل الزبائن تلقائياً (`saas_carrier_fixes` ← `fixes` في ملف الاتصال، تسبق القاموس)؛ بقية المشاكل مجمّعة بعدد المواقع المتأثرة وتحتاج تصحيح كتالوج أو محوّل.
**الحدود:** ZR Express/NOEST/Maystro لا تتيح قراءة الطرود أو المكاتب أو التعريفة (تُسجَّل ملاحظة صريحة، والبلديات تُقرأ حيث تتيح الشركة)؛ حدود المعدّل (ياليدين) تُحترم بتمهّل متصاعد وإعادة الولايات المتعثرة مرة واحدة؛ **لم تُجرَّب المعايرة على حساب ياليدين حقيقي بعد** (المحاكيات الصارمة فقط + سكربت القراءة `scripts/calibrate-live.php` جاهز للتشغيل بمفاتيحك).
**اختبارات:** `php scripts/test-calibration.php` (57)، لقطة ذهبية (`calibrate` و`create_profile` و`verify_webhook` لكل شركة) تعيدها بوابة JS بالحرف، و`platform/gateway/test/gateway.test.mjs` (دفعات `/calibrate` + التقاط webhook).

## حدود صريحة (لا نضلّلك)
- **لا ضمان يتجاوز الوثائق:** الشركات عدا ياليدين لم تُجرَّب بحساب حقيقي؛ المحاكيات صارمة بقدر ما نُشر من وثائق/مستودعات، فقد يختلف الواقع في تفصيل لم يُوثَّق (أسماء حقول اختيارية، قيود أسعار…).
- **أول استعمال حقيقي لأي شركة:** ردّ الشركة الخام يُحفظ في `ShipmentResult::raw` (والبوابة في `raw`) — أي رفض غير متوقع يظهر بنصه للتاجر، وتُضاف التصحيحات إلى المحوّل **والمحاكي معاً** ثم تُجدَّد اللقطة.
- **ZR Express (المنصة الجديدة)** `zrexpress_app` (بوابة JS): `api.zrexpress.app/api/v1` بترويستي `X-Api-Key` (اللوحة ← API Rest ← Token API) و`X-Tenant`؛ الولاية والبلدية معرّفات UUID من `territories/search` (طلب واحد)؛ الإنشاء `POST /parcels` (201 يعيد `id` فقط ← نجلب `trackingNumber` بـ`GET /parcels/{id}`)؛ الطرد يُنشأ «استلام الطلب» حتى يُمرَّر `stateId` الجاهز للإرسال من `workflows/search`؛ حدّ 150,000 دج؛ نقاط الاستلام `deliveryType=pickup-point` مع `hubId` (UUID من `POST /hubs/search`)؛ التعريفة من `GET /delivery-pricing/rates`؛ البوليصة الأصلية `POST /parcels/labels/individual`؛ تتبّع/إلغاء؛ إشعارات (`parcel.state.updated` و`parcel.isReturn.updated` فقط، والحالة الفرعية تُتجاهل) وتوقيع Svix (`whsec_…`). ✅ جُرِّب حياً بقراءة فقط (فحص المفتاح، 1585 إقليماً = 54 ولاية + 1531 بلدية، حالة «جاهز للإرسال») ⚠️ لم يُنشأ طرد حقيقي بعد. الواجهة تقصّ صفحة الأقاليم عند 1000 فنتصفّح حتى hasNext. حدود ZR: 200 طلب/دقيقة للمفتاح، 120 للبحث، 10 للعمليات الجماعية، 600/5 دقائق للعنوان، وذاكرة 30ث لـGET الطرد. نسخة PHP (`ZRExpressAppAdapter`) مطابقة لبوابة JS باختبار اللقطة الذهبية.
- `Mylers` وشركات Ecotrack ذات الروابط غير المؤكدة (`base_verified=false`) يُدخل التاجر رابطها بنفسه.
- طرد غير مصدَّق عند Ecotrack/NOEST (`autoValidate=0`) يبقى مسوّدة عند الشركة ولا يتحرك حتى التصديق.

## كيف تُضاف شركة أو تصحَّح
1. حدّث/أنشئ المحوّل في `platform/php-edition/shipping/src/Adapters/` + مدخل في `CarrierRegistry` + قاموسها في `data/status-dict.json`.
2. أضف/عدّل محاكيها في `scripts/lib/carrier-sims.php` (القواعد من وثيقة الشركة، لا من المحوّل) وأدرجها في مصفوفة `test-carriers.php` و`carrier-golden.php`.
3. `php scripts/test-carriers.php` ثم `php scripts/gen-carrier-golden.php` ثم `node platform/gateway/tools/gen-status-dict.mjs`.
4. انقل المنطق نفسه إلى `platform/gateway/src/carriers.js` وشغّل `node --no-warnings platform/gateway/test/carriers.parity.test.mjs` حتى يتطابق.


## WeCan Service (محوّل أصلي منذ 1.89.891)
- الأساس `https://wecanservices.com/api/v1`، الترويسات `X-API-Key` و`X-API-Secret`.
- الإنشاء `POST /parcels` (مصفوفة بصيغة ياليدين) فيدخل الطلب «Commandes» عندهم؛ **لا** يُستعمل `POST /orders` (ينشئ «Commandes d'entrepôt»).
- حقول إلزامية اكتُشفت من أخطاء التحقق: `order_id, from_wilaya_name, length, width, height, weight`. نرسل `delivery_fee` و`shipping_type` (`express_home|express_desk`)؛ تعرفة المتجر عندهم تُحسب على جانبهم وقد تختلف عن `/fees` العامة.
- التتبع `GET /parcels/{tracking}` (`last_status` بقاموس ياليدين)، الإلغاء `DELETE /parcels/{tracking}`، البوليصة من حقل `label` ولا تظهر إلا بعد أن تؤكد الشركة الطلب وتسند الشحنة.
- الإشعارات: صيغة JSON:API (`data.attributes`) أو صيغة ياليدين.
- لم يُجرَّب على حساب إنتاج حقيقي من هذا الباكند؛ المطابقة مع محاكٍ صارم فقط (`WeCanSim`).

## تحديثات 1.89.892 (نقل ما جُرّب في اللوحة إلى الباكند)
- **NOEST:** `labelUrl` = `GET /get/order/label` يردّ 302 إلى رابط PDF موقَّع (يعيش ~5 دقائق) فنعيد الرابط والمفاتيح تبقى في الخادم؛ والتعريفة `GET /fees` (`tarifs.delivery` فقط لا `return`) داخل المعايرة. لا إشعارات موثَّقة لها: يُستعمل الاستقبال العام (`tracking` + `status`).
- **الواجهة المشتركة:** `HttpResponse` (PHP) و`makeHttp` (JS) تُعيدان الآن ترويسة `Location` للتحويلات.

## WeCan — شبكة التعريفة الرسمية لمتجر alyssumdz (PDF «Grille tarifaire de livraison» بتاريخ 2026‑11‑09)
- المزوّد المرتبط بحساب صاحب المتجر: **ZR Express** (58 ولاية). المنزل 540–1,550 والمكتب 400–1,350 دج.
- طريقة الفوترة: الشحن حسب الولاية (منزل أو مكتب) + رسوم COD **0%** + تأمين **0%** (للطلبات المؤمَّنة فقط) + زيادة الوزن بعد 5 كغ للكيلوغرام: 100 دج (أغلب الولايات)، 200 دج (أدرار الصحراء الكبرى: بشار، تمنراست، العلمة…)، 0 لجانت. غير مفوتر: التأكيد والتغليف والتخزين والإرجاع.
- وحدات المتجر عندهم: Expédition **مفعّلة**، Fulfilment وConfirmation وInventaire **غير مفعّلة**.
- **تحقق:** قارنتُ الجدول بالتعريفة المدمجة في اللوحة (`DELIVERY_COMPANIES.wecan.tariff`، 58 ولاية منزل/مكتب) فتطابقت كلها بلا فرق (1.89.950). من الفروق السابقة المنتهية: تيبازة 650/550 (لا 850).
- أسعار الزيادة بالكيلوغرام (للتوسعة لاحقاً): 100 = 1–7,9–10,12–29(عدا 8,11,30…)… التفصيل في الملف المرفق؛ الأوزان الافتراضية للطرد 1 كغ فلا تُطبَّق.

## Ecotrack — `GET /api/v1/get/fees` (من وثيقة الشركة الرسمية)
الردّ: `{livraison, pickup, echnage (كذا بالإملاء)، recouvrement, retours}`، وكل مصفوفة صفوفها `{wilaya_id, tarif, tarif_stopdesk}` (نصوص). **للتسعير يُقرأ `livraison` فقط**؛ `tarif_stopdesk = "0"` تعني لا يوجد مكتب Stop Desk في تلك الولاية؛ الولايات غير المفعّلة لا تُرجَع. `GET /api/v1/get/products/list` (بتوكن Bearer) يُرجع منتجات المخزون عند الشركة `{reference, barcode, title, is_active, image, stock_disponible, stock_reserve, stock_phisique}` مع `pagination` — غير مستعمل حالياً (مرجع لو أُضيفت مزامنة مخزون Ecotrack).

