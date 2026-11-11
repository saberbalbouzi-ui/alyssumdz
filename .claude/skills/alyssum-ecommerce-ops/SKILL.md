---
name: alyssum-ecommerce-ops
description: منطق المتجر والتشغيل في أليسوم: الطلبات وتأكيدها وإرسالها لشركة التوصيل (ياليدين)، منع التكرار، رسوم التوصيل والبلديات، المخزون والتكلفة والمدفوعات والعملاء والأكواد. استعمله عند أي تعديل على الطلبات أو الشحن أو المخزون أو الحسابات المالية.
---
# التجارة والتشغيل

**الملفات:** `admin.html` (`Admin`: الطلبات/الشحن/المخزون/المالية)، `assets/js/api.js` (`API` بخلفيات php|sb|sheets)، `assets/js/app.js` (المتجر: `shipQuote`، السلة، الخصومات)، `admin-yalidine.js`، `admin-payments.js`، `admin-stockcheck.js`، `admin-manualorder.js`، `admin-orderedit.js`، `wilayas.js`.

## الطلبات والإرسال
- تأكيد الطلب (`confirmOrder` ← `afterManualStatus`) يرسل تلقائياً إذا `autoOpt("send")`. **كل إرسال يمرّ بـ`sendOrderToDelivery`** (قفل لكل طلب + سلسلة تتابع + علم بين النوافذ)، والطلب الذي له وسم `🚚شركة:تتبع` لا يُرسل ثانية (التكرار المقصود = «↩ تراجع» ثم إرسال). احفظ التتبع **بمعرّف الطلب لا بالفهرس** (`saveTracking`) لأن القائمة تُحدَّث أثناء الإرسال.
- سجلّ `alyssum_yd_sent` يربط الطرد باسم الزبون/هاتفه الحقيقيين (ياليدين تُقنِّع القائمة).
- ياليدين: `opening_decision:"accept", do_insurance:true` تُفرض (الوزن لا يُرسل)؛ رقم الطلب عندهم = العدد الكلي + 1. تعريفة الشركة: `labelRequest/parseLabel` للبوردرو، `listRequest/parseList` لقائمة الطرود. شركة جديدة تحتاج هذه الدوال في `DELIVERY_COMPANIES`.
- المسجَّل يُخفى من قائمة الطلبات إلا الجديد؛ سلة المهملات بدل الحذف؛ لا رجوع للخلف في الحالات (livree/annulee نهائيتان إلا إحياء الملغى من الشركة).

## الرسوم
- سعر الولاية (مناطق `SHIPPING` في wilayas.js أو أسعار الشركة الجالبة إن فُعّلت) + **إضافة البلدية** `sup` من `ship-co.json`. في المتجر `shipQuote`، وفي اللوحة `Admin.shipFeeFor` (الطلب اليدوي/التعديل) — أبقِ الاثنين متطابقين. الولايات 59–69 تُسعَّر بسعر الأم (`par`).

## المخزون والمالية
- الخصم عند التأكيد فقط (`syncStockForOrder`)، والجرد اليدوي يسبق؛ المخزون يُقرأ من `freshData()` لا من data.js المخزَّن. حدّث `StockCheck` عند تغيير حساب «خارج المخزون».
- التسوية: `AdminPayments.settle` (COD 0.75%، رسم الإرجاع 250، المرتجع يخسر الإرجاع فقط)؛ الأرباح لكل منتج في `#tab-finance`، التكلفة والوصفات في `#tab-costs`.

## معايرة حساب الشركة عند أول ربط (v1.89.158)
- أي شركة جديدة أو محوّل جديد: أضف `discover()` (قراءة فقط) في المحوّل PHP وJS، ومحاكيه يعرض نقاط القراءة بكتالوج بتهجئة مخالفة، ثم اختبر بـ`php scripts/test-calibration.php` وأعد اللقطة الذهبية (`gen-carrier-golden.php`). المحوّل يستهلك الملف عبر `profileCommune` و`status_overrides` فقط — لا منطق موازياً. التفاصيل في `platform/docs/carriers-reference.md` (قسم المعايرة).
- لم تُجرَّب على ياليدين حقيقي بعد؛ التجربة الحية بـ`scripts/calibrate-live.php` (قراءة فقط) بمفاتيح صالحة، ولا تنشئ طرداً حقيقياً دون إذن.

## حدود لا تُنسَ
- لم تُجرَّب إجراءات الشركات على حسابات حقيقية؛ اختبر بمحاكاة `courierFetch` وصرّح بذلك.
- لا تعدّل جدول `orders` في الإنتاج من الجلسة.

## مركز الاتصال والوسوم (v1.89.166)
- وسوم ملاحظة الطلب للاتصال: `📞1..3` غير متاح، `⏰لاحقاً`، `📅YYYY-MM-DD` (مؤجَّل لغد: `Admin.postponeOrder`/`callDue`)، `📵خطأ`، `🏠✔|🏠⏳ «نص»` (عنوان معدَّل: `setAddrFix/addrFix`؛ ⏳ = دوّنته مؤكِّدة بلا `orders.edit` فيُمنع الإرسال التلقائي ويطلب الإرسال اليدوي مراجعة). `_call_marks` (SQL) و`callMarks` (PHP) يجب أن يعرفا كل وسم جديد وإلا لا يُسجَّل في التدقيق.
- طابور `CallCenter.queue()`: المؤجَّل لتاريخ لم يحلّ خارج الطابور، والحال موعده في المقدمة. تفصيل الأداء في `AdminRoles.summarize` (try1..3/later/tomorrow/wrong/addr). وسم اتصال جديد = أضفه للثلاثة (SQL، PHP، summarize) مع اختبار.
- (v1.89.167) وسما `🔒<هوية>#<دقيقة>` (قفل ناعم، ينتهي بعد 10 د) و`❌سبب:<مفتاح>` (سبب الإلغاء، يُكتب قبل تغيير الحالة فيدخل حدث `order.status.reason`). الأداء: RPC `audit_perf` / PHP `team.perf` (زمن أول استجابة، اليوم، الأسباب، الهدف `callgoal`). أي وسم جديد يؤثر في المسح (`confirmOrder`/`setAttempt`/`setCallMark`/`postponeOrder`) أضفه لتعابيرها النمطية.
- (v1.89.168) `callgoal` = {daily, rate, alertMin, per, assign{on,weights,overflow}}؛ الإسناد المسبق `AdminRoles.assigneeOf` (تجزئة ثابتة بالأوزان) ويفلتر `CallCenter.queue()`؛ تنبيه التأخر `Admin.overdueList/overdueAlert`. أي ميزة طابور جديدة تمرّ بـ`queue()` فقط كي تبقى القاعدة موحّدة.
- (v1.89.169) أولوية شركة الطلب في `orderCompanyKey`: تتبع مسجَّل ← `p.shipCo` الصريح ← `AdminDispatch.route` (توجيه المنطقة/الأداء) ← الافتراضية. أي طريق إرسال جديد يمرّ بـ`orderCompanyKey` وإلا تجاوز التوجيه. بوردرو الشركات: ما تُرجعه الشركة لحظة الإنشاء يُحفظ بـ`cacheLabel`، والبقية `labelRequest` وإلا وصل `AdminOrderDocs.waybill` بباركود. شركة جديدة تحتاج `labelRequest/parseLabel` لتظهر بوردرو أصلية.
- (v1.89.170) كل إخفاق في `_sendOrderToDelivery` يمرّ بـ`fail(kind,…)`: `area|input|reject` تُعاد توجيهها لشركة بديلة (`_sendWithFallback`)، و`amb` لا (احتمال وجود طرد). إخفاق جديد = صنّفه بعناية: لا تضع `area/input/reject` إلا إن كان الطرد لم يُنشأ قطعاً.
- (v1.89.171) «الربح الحقيقي» (`AdminProfit`): الصافي = `K.real + K.adTotal` (الربح قبل الإعلان من `computeFinance`) − إنفاق الإعلانات الفعلي من منصة API (`/v1/ads/spend` مضروب بسعر الصرف الذي يحدده التاجر) إن وُجد وإلا تقدير الإعلان − الثابت الشهري × أيام/30. أي بند تكلفة جديد في `computeFinance` أضفه أيضاً إلى `K.parts` وإلا اختلّ الشلال. نسب الطلب للحملة بالاسم المطبَّع بين `extra["📣 الحملة"]` واسم الحملة في المنصة.
- (v1.89.172) وسم المخزون على الطلب `📦` أو `📦@<مستودع>` — لا تستعمل `/📦/` وحدها لأن `📦livree:` وسم تسليم؛ استعمل `AdminWh.tagOf/TAG_RE_G`. الإعادة إلى المخزون عند `echec` تمرّ بـ`holdReturn(returnPhase(o))` (لا تعود العلب قبل «Retourné au vendeur» إلا بسياسة «فوراً»)؛ أي مسار جديد يغيّر المخزون يستعمل `moveStock(o,dir,wh)` ليصحّ توزيع المستودعات. حالات شركة جديدة: أضف تعابير مرحلتها إلى `AdminWh.returnPhase` و`retPhase` في الـwebhook معاً.
- (v1.89.173) أي شركة توصيل جديدة تحتاج `pingRequest(cfg)` (قراءة فقط) ليعمل الفحص الاستباقي للمفاتيح؛ وأي استدعاء للشركة يعالج الفشل عبر `Admin.coHttpErr(co,key,r)` لا `throw new Error("رد الشركة "+status)`، كي يظهر شريط «مفاتيح مرفوضة» ولا تتكرر المحاولات على كل طرد.
- (v1.89.233) webhook PHP يكتب `🔁<مرحلة>` أيضاً (`ydRetPhase` في api/index.php؛ أبقِه مطابقاً لـ`retPhase` في yalidine-webhook وAdminWh.returnPhase، اختبار `scripts/test-webhook-php.php`). حدّ أدنى لكل مستودع `cfg.min` و`AdminWh.lowCells`. الإرجاع الفعلي للمخزون يتم من اللوحة فقط.
- (v1.89.240) كل طلب من عرض يحمل `extra["🆔 قاعدة العرض"]=<id القاعدة>` (app.js/upsell.js) ← `AdminUpsell.ruleStats` يحسب لكل قاعدة طلبات/إيراد/ربح (من `Admin.orderLines` و`fin.costs`، المُلغى والفاشل خارج، 30 يوماً)؛ `mergeable()` تغذي بطاقة الرئيسية `data-go=merge`؛ وفي `AdminPack` ماسح (`onScan/findRow/normScan`، كاميرا BarcodeDetector). اختبار: `scripts/test-upsell-follow.js`.
- (v1.89.239) العروض الإضافية: `assets/js/upsell.js` (Order Bump في صفحة المنتج/السلة + Upsell بعد الشراء في `Thanks.show`) تقرؤها من `assets/data/upsell.json`؛ لوحة `admin-upsell.js` (قواعد + إحصاء + **دمج الطلب المرتبط** عبر وسم `extra["🧺 مجموعة"]` للطلبين الجديدين غير المرسَلين فقط). دور `warehouse` (صلاحية `pack`) يقرأ دالة `pack_orders` لا جدول الطلبات؛ وسم التجهيز `🧰@<تاريخ>` في ملاحظة الطلب (لا يتعارض مع `📦` للمخزون). اختبارات: test-upsell، test-upsell-admin، test-roles*.
- (v1.89.820) أي شركة جديدة: عند التفعيل `onboardCompany` ← `calibrateCompany` (إن كان لها `wilayasRequest`، وللقوائم الموحّدة `listWilayas`/`listCommunes`) ثم `diagnoseCompany` (صفوف {label,ok,detail,fix}) وبطاقة `showDiagnosis` مع «نسخ تقرير للدعم» (بلا مفاتيح) وزر «🩺 فحص الشركة». أضف `ownTariff:true` إن كانت تعريفتها كاملة من الشركة (لا إضافات بلديات ياليدين). الأخطاء تُترجم بـ`diagFix` (لا مصطلحات تقنية في الواجهة).
- (v1.89.836) أولوية الشركة في `orderCompanyKey`: وسم «تحويل» يدوي `🏢<شركة>` ← شركة المنتج (`shipCo`) ← التوجيه الذكي `AdminDispatch.route` ← الافتراضية. «🔀 تحويل» (`moveOrderTo`/`moveSelHtml`) قبل الإرسال فقط: يضع/ينزع الوسم بلا اتصال بأي شركة، ويظهر في شرائح الطلبات؛ الوسم مخفيّ من معاينة الملاحظة. بعد الإرسال: «↩ التراجع عن الإرسال» ثم إرسال. لا قائمة «إرسال عبر شركة أخرى» (أُزيلت v1.89.835).

- طرود الشركات غير ياليدين: بطاقة `#cop-card` موحّدة (`AdminCoP.draw` + `Admin.renderCoCard/coRows/coAct`)؛ عند إضافة شركة تُغذّى تلقائياً من `batchTrackRequest` أو طلباتنا المرتبطة. البوردرو الرسمي بـ`labelRequest` (+`labelDirect` لملف PDF مباشر، `labelHtml` لملف HTML) — لا تخترع وصلاً.
- (v1.89.896) **تسعير الشركات:** الشركة التي تحسب التوصيل بنفسها وتضيفه فوق `price` (ياليدين، WeCan) يُخصم من مجموع الزبون **رسمها هي** `Admin.carrierFee(key, order)` (تعريفتها المحفوظة بلا نقص `adj` وبلا إضافات ياليدين لشركات `ownTariff`) لا رسم المتجر، فيطابق ما تحصّله ما دفعه الزبون. WeCan تعريفتها مدمجة في `DELIVERY_COMPANIES.wecan.tariff` (من ملف أسعارهم، يتجاوزها حقل `priceFix`) وتُطبَّق عند كل تحميل للإعدادات وفي `shipCoData`. `refreshStalePrices` تجدّد أسعار الشركات المفعّلة كل 3 أيام بصمت (إلا ذات التعريفة المدمجة). Noest/ZR/Maystro/Ecotrack ترسل المجموع كاملاً (`montant`/`amount`) فلا تحتاج ذلك.
- (v1.89.919) **WeCan تبني الطلب من «مجموع فرعي (price) + رسم توصيل من تعريفتها»**: نرسل `price` = مجموع الزبون − رسمها (`carrierFee`) مع `delivery_fee` و`shipping_type` و`freeshipping:false` (إرسال المجموع كاملاً يجعل المجموع الفرعي 0 والتوصيل = المبلغ كله: خطأ 1.89.897). `/parcels` لا تحفظ `is_fragile`/`allow_open` ⟵ نكتب `[FRAGILE]`/`[NE PAS OUVRIR]` في `product_list`.

- **WeCan (1.89.958، ثبت بتجارب حقيقية):** الصيغة الافتراضية `legacy=2` (الحقل فارغ): `POST /parcels` بـ`price`=المجموع كاملاً **بلا `delivery_fee` ولا `shipping_type`** ⇒ يدخل الطلب Expéditions «En préparation» (وتظهر نسخة في «Commandes de l'entrepôt» بـ«En Attente»)، Montant صحيح، يعرض «Sous-total 0 / Frais = كل المبلغ» (تجميلي). الصيغة الحديثة (`delivery_fee`+`shipping_type`، `legacy=0`) تُدخله «Commandes/En traitement». **لا يمكن** تحديد خيار التوصيل (منزل/مكتب) ولا Fragile/Autoriser l'ouverture: `PATCH /orders/{id}` ⇒ 403 «Cannot update confirmed orders»؛ `PATCH /parcels/{tracking}` (`legacy=7`) يقبل الحقول ولا يطبّقها؛ `shipping_type` وحده (`legacy=3`) يفشل؛ `shipping_option` (`legacy=5`) يحتاج `tariff_uuid` لكل ولاية من مسار لوحتهم الداخلي. لا لواحق على `product_list`. التعريفة المدمجة 58 ولاية تطابق شبكة WeCan الرسمية (PDF 2026‑11‑09). الوثائق: `https://wecanservices.com/docs/api.json`.

## تكاليف الشحن لنموذج الطلب المضمَّن (v1.89.974)
إعداد `fsc` في عنصر «نموذج الطلب (الأصلي)» ← `oc.sc` في رابط الإطار: `""`(لا يُرسَل) = حسب `shipCo` للمنتج، `def` = الشركة الافتراضية، `zones` = أسعار مناطق التوصيل. يطبّقه `app.js` عبر `__OCSC`/`pshipCo(p)` في كل استدعاءات `shipQuote` الخاصة بالمنتج (السلة لا تتأثر). تغييره يحتاج إعادة نشر الصفحة.

## فصل المدفوعات والإحصائيات حسب الشركة
- `assets/js/admin-costats.js` (`AdminCoStats`): الشركة = شركة وسم `🚚` على الطلب (لا شركة المنتج الافتراضية)؛ الطلبات بلا وسم = «غير مرسلة». يغذّي بطاقة التحليلات و`admin-payments.js` (شرائح الشركات `S.co` + جدول الخلاصة العامة). تسوية ياليدين (`sItems`/`sumSettle`/`settleCells`) لطرود `co==="yalidine"` فقط؛ `inCo` يقبل أي شركة أخرى بمجرد رقم التتبع. الاختبار `scripts/test-costats.js`.
