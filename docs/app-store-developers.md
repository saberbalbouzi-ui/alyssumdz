# دليل مطوّري متجر التطبيقات (Alyssum Platform)

> وثيقة للمطوّر الخارجي. القاعدة: تطبيقك يرى **أقل ما يلزم**، والتاجر يوافق على كل صلاحية، والإدارة تراجع قبل الظهور.

## 1) الحصول على حساب مطوّر
تفعّل الإدارة حساب مستأجرك كمطوّر. تنشئ تطبيقك بمفتاح مستأجرك (نطاق `appstore:dev`):

```
POST /v1/appstore/dev/apps
{ "slug":"sms-tools", "name":"أدوات SMS", "description":"…", "price":2000, "billing":"once|monthly",
  "scopes":["read_orders"], "redirect_uris":["https://app.example/oauth/callback"],
  "webhook_url":"https://app.example/hooks", "events":["order.created"] }
→ 201 { id, client_id, client_secret, webhook_secret }     ← تظهر الأسرار مرة واحدة فقط
```
ثم `POST /v1/appstore/dev/apps/:id/submit` للمراجعة. تعديل أي حقل حسّاس (السعر، النطاقات، الروابط، الأحداث) على تطبيق معتمد يعيده إلى المراجعة. `POST …/rotate-secrets` يدوّر الأسرار (القديمة تبطل فوراً). `GET /v1/appstore/dev/earnings` لإيراداتك.

## 2) النطاقات (Scopes) — كتالوج مغلق
| النطاق | ما يتيحه |
|---|---|
| `read_orders` | قراءة الطلبات (`GET /v1/orders`) والاشتراك في أحداث `order.*` و`payment.*` — **بلا اسم الزبون وهاتفه** |
| `read_customers` ⚠️ | يكشف الأسماء والهواتف في الطلبات والسلال والأحداث. حسّاس: يظهر للتاجر بتحذير ويطلب موافقة منفصلة |
| `read_products` / `write_products` | قراءة / تعديل الكتالوج والأكواد |
| `read_carts` | السلال المتروكة (الهواتف مخفية دون `read_customers`) |

لا يوجد نطاق للمحفظة أو المفاتيح أو التكاملات أو إدخال الأحداث. أي مسار آخر يردّ `403 insufficient_scope`.

## 3) التثبيت وتدفق OAuth 2.0
1. التاجر يثبّت من لوحته ويوافق على **كل** النطاقات (وإلا `409 consent_mismatch`).
2. يُحوَّل المتصفح إلى أول `redirect_uris`: `?code=ac_…&installation=ID&shop=الدومين&timestamp=…&signature=…`
   - تحقّق من `signature` = `HMAC-SHA256(webhook_secret, "code=…&installation=…&shop=…&timestamp=…")` (المفاتيح مرتّبة أبجدياً) وأن `timestamp` حديث.
3. بدّل الرمز (مرة واحدة، صلاحيته 10 دقائق):
```
POST /oauth/token   (Authorization: Basic base64(client_id:client_secret) أو في الجسم)
grant_type=authorization_code&code=ac_…&redirect_uri=<نفس المسجَّل تماماً>
→ { access_token:"at_…", refresh_token:"rt_…", token_type:"Bearer", expires_in:3600, scope:"read_orders" }
```
4. استعمل `Authorization: Bearer at_…` على `api.alyssumhub.fyi`. `GET /v1/appstore/me` يعرّفك بالمتجر والنطاقات.
5. جدّد: `grant_type=refresh_token&refresh_token=rt_…` (دوّار: يصدر زوج جديد ويبطل القديم؛ **إعادة استعمال رمز تجديد مستعمل تبطل السلسلة كلها** لأنها تدل على تسريب). الحدّ 300 طلب/دقيقة لكل تثبيت. `POST /oauth/revoke` لإبطال رمز.
- الأخطاء بصيغة RFC 6749: `{ "error":"invalid_grant", "error_description":"…" }`. الرموز معتمة وتُخزَّن مجزَّأة عندنا فلا نستطيع إعادة عرضها.

## 4) Webhooks الصادرة
نرسل `POST` JSON إلى `webhook_url` لكل حدث اشتركت به **ولك له نطاق** (`order.*`/`payment.*` تتطلب `read_orders`)، إضافة إلى `appstore.installed|uninstalled|suspended` الخاصة بتثبيتك:
```
X-App-Signature: t=<unix>,v1=<hex>      X-App-Event: order.created      X-App-Delivery: <id>
{ "id":"adl_12", "type":"order.created", "created":1790000000, "shop":{"id":7,"domain":"shop-a"}, "data":{…} }
```
- `v1 = HMAC-SHA256(webhook_secret, t + "." + <الجسم الخام>)`. ارفض إن مضى على `t` أكثر من 5 دقائق (ضد إعادة البث) وقارن بزمن ثابت.
- ردّ بـ`2xx` خلال 10 ثوانٍ. الفشل يُعاد بتباعد 1د، 5د، 30د، 2س، 12س ثم يُهمل. **اجعل المعالجة idempotent** بـ`X-App-Delivery`. لا نتبع التحويلات.
- بيانات الزبون (`customer`, `name`, `phone`, `address`…) تُحذف من الحمولة ما لم تملك `read_customers`.

```js
// تحقق Node.js
const [t, v1] = h['x-app-signature'].split(',').map(x => x.split('=')[1]);
const ok = Math.abs(Date.now()/1000 - +t) < 300 &&
  crypto.timingSafeEqual(Buffer.from(v1,'hex'), crypto.createHmac('sha256', SECRET).update(t + '.' + rawBody).digest());
```

## 5) الفوترة وتقاسم الإيراد
عند التثبيت المدفوع يُخصم السعر من **متاح** محفظة التاجر ويُقسَّم: عمولة المنصة (20% افتراضياً، تضبطها الإدارة) وباقيها إلى **متاح** محفظتك، قيدان في دفتر مزدوج متوازن بمراجع فريدة (لا خصم مرتين). الاشتراك الشهري يُخصم كل 30 يوماً؛ عند عجز الرصيد تُمنح مهلة 3 أيام (`past_due`) ثم يُعلَّق التثبيت وتُبطل رموزه. إعادة تثبيت تطبيق دُفع ثمنه مرة واحدة (`once`) لا تُخصم ثانية.

## 6) سجلّ التسليمات وإعادة الإرسال
`GET /v1/appstore/dev/deliveries?app_id=&state=failed|sent|pending` يعرض تسليمات webhooks لتطبيقاتك بحالتها وعدد المحاولات وسبب الفشل. `POST /v1/appstore/dev/deliveries/:id/retry` يعيد إرسال تسليم **فاشل** فوراً (بعد 6 محاولات فاشلة يتوقف التسليم حتى تعيده أنت).

## 7) توثيق نطاقك (شارة «✔ نطاق موثّق»)
انشر على نطاق `webhook_url` الملف `https://<نطاقك>/.well-known/alyssum-app.json` بمحتوى `{"client_id":"ci_…"}` ثم استدعِ `POST /v1/appstore/dev/apps/:id/verify-domain`. الشارة تظهر للتجار وتسقط تلقائياً إن غيّرتَ نطاق الـwebhook.

## 8) التقييمات والتمييز والاسترداد
التاجر الذي ثبّت تطبيقك يقيّمه من 1 إلى 5 (تقييم واحد يُحدَّث). الإدارة قد تضع «⭐ مميّز» على تطبيقات جيدة فتتصدّر السوق. **الاسترداد:** يستطيع التاجر استرداد آخر دفعة خلال **7 أيام** (مرة واحدة): يُسحب نصيبك من متاح محفظتك وتُعاد العمولة ويُردّ المبلغ كاملاً للتاجر ويُلغى التثبيت وتُبطل رموزه. إن كنتَ سحبتَ الحصة فيتعذّر الاسترداد الآلي ويُحال للدعم — أبقِ في محفظتك ما يغطي أول 7 أيام.

## 9) ما يحميك ويحمي التاجر
مراجعة يدوية قبل الظهور · تعليق فوري يبطل الرموز في كل المتاجر · إلغاء التاجر يقطع الوصول لحظياً · تقليص النطاقات يسري على الرموز القائمة · حدّ معدّل · قفل المصادقة الفاشلة لكل IP · تقنيع PII · عزل كامل للمستأجرين · مفاتيح الاختبار (`pk_test_`) لا تثبّت ولا تخصم.
