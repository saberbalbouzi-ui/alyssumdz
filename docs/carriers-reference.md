# مرجع محوّلات شركات التوصيل (التوحيد القسري)

**القاعدة (أمر صاحب المتجر):** ما ينجح مع ياليدين يجب أن ينجح مع كل الشركات بالسلوك نفسه، ولا ننتظر عميلاً حقيقياً ليكتشف الخطأ.
الطريقة (مثل dzship): المنصة وسيط ترجمة؛ قواميس مطابقة مكتوبة في الشيفرة، ومحوّل لكل شركة (نمط Adapter) يترجم طلبنا الموحَّد إلى صيغتها وردّها إلى حالاتنا الموحَّدة.

## ما يضمنه النظام
| الطبقة | أين | ماذا |
|---|---|---|
| حالات موحّدة | `Status` / `status.js` | pending · shipped · out_for_delivery · delivered · failed_attempt · returned · cancelled · unknown |
| قاموس حالات صريح لكل شركة | `php-edition/shipping/data/status-dict.json` (المصدر الوحيد) ← يولّد `saas/gateway/src/status-dict.js` بـ`node saas/gateway/tools/gen-status-dict.mjs` | `exact` (نص الحالة) · `codes` (رموز رقمية) · `event_key` (NOEST) · `ignore` (أحداث مالية/إدارية لا تغيّر حالة الطرد) |
| حالة جديدة لا يعرفها القاموس | `StatusMapper::explain` ← regex احتياطي ← `unknown` | لا تُطبَّق على الطلب، وتُسجَّل (PHP: `error_log` + `ship_unknown` تظهر في بطاقة الشركات؛ البوابة: `gw_audit` بالفعل `status.unknown`) فلا تضيع صامتة |
| مطابقة البلديات | `CommuneMatcher` / `commune.js` (تطبيع صوامت + Levenshtein، حدّ 0.82) | تصحيح التهجئة على قائمة البلديات الحقيقية للشركة (`get/communes`) أو رفض بلا طلب إنشاء مع «الأقرب: …» |
| الولايات 59–69 | `Parcel::legacyWilaya()` | تُرسل دائماً برمز/اسم الولاية الأم (≤58) لأن الشركات لم تحدّث ولاياتها |
| اختبار اتصال | `ping()` في كل محوّل (قراءة فقط) | عند التفعيل: مفاتيح ترفضها الشركة **لا تُحفظ** (يُكتشف الخطأ فوراً)؛ ردّ غامض ⇒ تُحفظ مع تنبيه؛ زر «اختبار الاتصال» لاحقاً |
| محاكيات صارمة | `scripts/lib/carrier-sims.php` | كل محاكٍ يتحقق من الترويسات وموضع المعاملات (استعلام/جسم) والحقول المطلوبة وأنواعها وتهجئة البلدية كما تفعل الشركة؛ أي مخالفة ⇒ HTTP 400 + تسجيل في `violations` |
| اختبار مطابقة مشترك | `php scripts/test-carriers.php` (167 فحصاً) | السيناريوهات نفسها على الشركات الخمس: ping، إنشاء منزل، تهجئات البلدية، الولايات الجديدة، Stop Desk بلا رمز/برمز، بلدية مجهولة، تكرار، 429، مفاتيح خاطئة، **كل مدخلات القاموس عبر ردّ المحاكي الكامل**، حالة غريبة، إلغاء قبل/بعد |
| تطابق PHP ↔ بوابة JS | `scripts/gen-carrier-golden.php` ← `saas/gateway/test/carrier-golden.json` + `carriers.parity.test.mjs` | اللقطة تسجّل كل طلب صادر وردّه ونتيجته؛ المحوّلات JS تُعاد عليها وتشترط التطابق بالحرف (مسار/معاملات/ترويسات/جسم/نتيجة). تعديل محوّل PHP ⇒ أعد توليد اللقطة وإلا فشل الاختبار |

## الشركات: المصدر ودرجة الثقة
| الشركة | المصدر | الثقة | ملاحظات |
|---|---|---|---|
| **Yalidine** | حساب حقيقي (إنشاء/تتبع/بوليصة/إلغاء، 1216 طرداً) | عالية | `POST /v1/parcels/` مصفوفة، `to_wilaya_name` باسم الأم، `stopdesk_id` رقمي |
| **Ecotrack** (DHD وعائلتها) | نص وثيقة الشركة | متوسطة–عالية | `create/order` **معاملات استعلام وبلا جسم**، Bearer، `valid/order` (يُستدعى تلقائياً ما لم `autoValidate=0`)، `delete/order` قبل التصديق فقط، البلدية من `get/communes`، المحطة `code_postal`، `validate/token` للفحص |
| **NOEST** | نص وثيقة الشركة | متوسطة–عالية | Bearer + `api_token`/`user_guid` في الجسم، حقول `client/phone/adresse/wilaya_id/commune/montant/produit/type_id/poids/stop_desk`، `station_code` (16A) للمكتب، الحالة من آخر `event_key` غير المالي |
| **Maystro** | مستودعات عامة متفقة (CourierDZ, uften, dzcouriers, Vargo) — لا وثائق رسمية | متوسطة | `Authorization: Token`، **معرّف بلدية رقمي** من `base/communes`، `products[]` و`source`=4، `delivery_type` v2 (1 منزل/2 مكتب) أو v1 عبر `scheme`، الإلغاء `PATCH status=50`، الحالة رقمية (`codes`) |
| **ZR Express** (Procolis القديمة) | مستودعات عامة متفقة — لا وثائق رسمية | متوسطة | ترويستا `token`/`key`، `add_colis {Colis:[…]}` بتهجئة الشركة `Confrimee`، الرفض يعود HTTP 200 + `MessageRetour`، `Double Tracking` = مكرّر، لا إلغاء ولا بوليصة |

## حدود صريحة (لا نضلّلك)
- **لا ضمان يتجاوز الوثائق:** الشركات عدا ياليدين لم تُجرَّب بحساب حقيقي؛ المحاكيات صارمة بقدر ما نُشر من وثائق/مستودعات، فقد يختلف الواقع في تفصيل لم يُوثَّق (أسماء حقول اختيارية، قيود أسعار…).
- **أول استعمال حقيقي لأي شركة:** ردّ الشركة الخام يُحفظ في `ShipmentResult::raw` (والبوابة في `raw`) — أي رفض غير متوقع يظهر بنصه للتاجر، وتُضاف التصحيحات إلى المحوّل **والمحاكي معاً** ثم تُجدَّد اللقطة.
- ZR أطلقت منصة جديدة (`api.zrexpress.app` بترويستي `X-Api-Key` و`X-Tenant`) لم يُبنَ لها محوّل بعد.
- `Mylers` وشركات Ecotrack ذات الروابط غير المؤكدة (`base_verified=false`) يُدخل التاجر رابطها بنفسه.
- طرد غير مصدَّق عند Ecotrack/NOEST (`autoValidate=0`) يبقى مسوّدة عند الشركة ولا يتحرك حتى التصديق.

## كيف تُضاف شركة أو تصحَّح
1. حدّث/أنشئ المحوّل في `php-edition/shipping/src/Adapters/` + مدخل في `CarrierRegistry` + قاموسها في `data/status-dict.json`.
2. أضف/عدّل محاكيها في `scripts/lib/carrier-sims.php` (القواعد من وثيقة الشركة، لا من المحوّل) وأدرجها في مصفوفة `test-carriers.php` و`carrier-golden.php`.
3. `php scripts/test-carriers.php` ثم `php scripts/gen-carrier-golden.php` ثم `node saas/gateway/tools/gen-status-dict.mjs`.
4. انقل المنطق نفسه إلى `saas/gateway/src/carriers.js` وشغّل `node --no-warnings saas/gateway/test/carriers.parity.test.mjs` حتى يتطابق.
