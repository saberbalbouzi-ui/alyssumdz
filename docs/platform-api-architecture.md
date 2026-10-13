# معمارية API المنصة (MVC موجّه للـAPI) — الركيزة 2

**القرار (على معايير لجنة الخبراء):** Worker واحد على Cloudflare + D1، **طبقات صارمة** بدل PHP/MySQL (ملاءمة لبقية بنيتنا: بوابة الشحن، الموزّع، Supabase للهوية). كل وحدة (module) قابلة للتركيب والاختبار منفصلة، ولا وحدة تلمس جداول وحدة أخرى — التواصل بالأحداث فقط.

## الطبقات (`saas/platform/src`)
| الطبقة | أين | المسؤولية |
|---|---|---|
| Router | `core.js` `createPlatform` | مطابقة المسار، المصادقة (`public`/`tenant`/`admin`)، النطاق `scope`، حدّ المعدّل، أخطاء موحّدة `{error:{code,message,fields?}}` |
| Controller | `modules/*.js` ← `routes(r, ctx)` | تحقق من المدخلات وتحويلها إلى استدعاءات الخدمة؛ لا منطق أعمال |
| Service | دوال نقية مثل `scoreOrder` | منطق الأعمال بلا قاعدة بيانات ولا شبكة (تُختبر مباشرة) |
| Repository | استعلامات SQL داخل الوحدة | الوصول إلى D1 فقط؛ `tenant_id` في كل استعلام |
| Adapter | `ctx.fetchFn` + ملف الوحدة | خدمات خارجية (Meta/TikTok/WhatsApp/…) |
| Event bus | `ctx.emit` + جدول `pf_events` + `cron()` | صندوق صادر (outbox) بإعادة محاولة [60,300,1800,7200,43200]ث؛ الوحدات تشترك بـ`on:{نوع_الحدث}` |

عقد الوحدة: `{ id, routes(r, ctx), on?: {حدث: handler}, cron?(ctx) }`. مستأجر ← مفاتيح `pk_live_/pk_test_` بنطاقات `وحدة:إجراء` (مثل `fraud:check`) أو `*`؛ مفتاح الاختبار لا يكتب بيانات. إدارة المزوّد `/admin/*` برمز `ADMIN_TOKEN` (يمرّ عبر دالة Supabase تتحقق `is_saas_admin` كما في `ship-admin`) وكل إجراء إداري في `pf_audit`.

## الأمان والخصوصية (القانون 18-07)
- لا هاتف ولا IP ولا بصمة جهاز صريحة تُخزَّن: بصمات HMAC-SHA256 بسرّ `PLATFORM_SECRET` (تدويره = فقدان الربط بين الفحوص السابقة، مقبول).
- البلاغات المشتركة تكشف **عدد التجّار المبلِّغين فقط** لا هويتهم ولا أسبابهم؛ المستأجر يسحب بلاغاته (`DELETE /v1/fraud/report/:phone`)، والمزوّد يمحو كل أثر لرقم (`POST /admin/fraud/erase`) عند طلب صاحبه؛ احتفاظ تلقائي: فحوص 90 يوماً، بلاغات 365.
- كل شيء يُهرَّب عند العرض؛ أخطاء الداخل لا تُسرَّب؛ جسم ≤256KB؛ حدّ معدّل لكل IP ولكل مفتاح ولمحاولات المصادقة الفاشلة.

## خارطة الوحدات (الركيزة 2) — كلها مبنية ومُختبرة بمحاكاة؛ **لا شيء منها منشور بعد**
| الوحدة | الملف | ما تفعله | اختبارات |
|---|---|---|---|
| `antifraud` | `modules/antifraud.js` | تقييم خطر الطلب (هاتف، اسم، تكرار، بصمة جهاز، IP، بلاغات مشتركة، مبلغ شاذ) + بلاغات + حق المحو. بصمات HMAC فقط | `platform.test.mjs` (50) |
| `platform` (نواة) | `modules/platform.js` + `core.js` | `POST /v1/events` موحّد (idempotent)، `GET /v1/events` (ترقيم بمؤشر لمشغّلات Zapier)، تكاملات المزوّدين بأسرار مشفّرة، مفاتيح عامة `pk_pub_` + CORS بقائمة أصول، `Idempotency-Key`، OpenAPI تلقائي | `core-modules.test.mjs` (52) |
| `capi` | `modules/capi.js` | Meta CAPI + TikTok Events API + Snapchat CAPI من الخادم عند `order.created`/`order.confirmed`؛ تجزئة SHA-256 حسب تطبيع كل منصة؛ `event_id` ثابت لإزالة التكرار مع بكسل المتصفح؛ إعادة المحاولة للمزوّد الفاشل فقط | `core-modules` |
| `hooks` | `modules/hooks.js` | webhooks صادرة موقَّعة (HMAC + طابع زمني) لأي حدث أو نمط `order.*` مع إعادة محاولة — تغذّي Zapier/Make/n8n | `core-modules` |
| `digital` | `modules/digital.js` | ملفات رقمية: روابط بمدة وعدد تنزيلات محدودين (الرمز 256 بتاً مجزّأ، العدّ ذرّي ويُردّ عند فشل المصدر)، موقع الملف مشفّر، بريد تلقائي عند `payment.confirmed` (يلغي المنحة ويعيد الحدث إن فشل البريد) | `commerce-modules.test.mjs` (53) |
| `whatsapp` | `modules/whatsapp.js` | قالب تأكيد معتمد عند `order.created` + استقبال ردّ «نعم/لا» (توقيع `X-Hub-Signature-256` على الجسم الخام) ← `order.customer_confirmed/cancelled` | `commerce-modules` |
| `sheets` | `modules/sheets.js` + `sheets/Code.gs` | المنصة ← الجدول (صف لكل طلب عبر Apps Script) والجدول ← المنصة (`order.sheet_update`) لمركز الاتصال | `commerce-modules` |
| `ab` | `modules/ab.js` | اختبار A/B أصلي: توزيع حتمي بهاش الزائر، مشاهدة/تحويل مرة واحدة، اختبار z لنسبتين مع حدّ أدنى للعينة | `growth-modules.test.mjs` (46) |
| `ai` | `modules/ai.js` | توليد نص صفحة هبوط (دارجة/فرنسية/إنجليزية/فصحى، 1–3 نسخ) عبر نموذج المستأجر؛ محث صارم يمنع الوعود العلاجية والآراء والأرقام المختلقة + كاشف ادعاءات + تنظيف HTML + حصة يومية | `growth-modules` |
| `carts` | `modules/carts.js` | سلال متروكة: التقاط من المتجر بمفتاح عام (`cart:capture`) **بموافقة صريحة `consent:true`**، الهاتف مشفّر + بصمة HMAC (صف لكل رقم)، يصير `recovered` تلقائياً عند `order.created` لنفس الرقم، قائمة للتاجر بعمر أدنى 15 دقيقة، محو برقم الزبون (18-07)، احتفاظ 30 يوماً | `carts.test.mjs` (25) |
| `payments` | `modules/payments.js` | **M1** دفع إلكتروني عبر Chargily Pay V2 (موثّق من dev.chargily.com): `POST /v1/payments/checkouts` (يُعاد الرابط نفسه للمبلغ ذاته، يرفض المدفوع)، إشعار موقّع `signature`=HMAC-SHA256(المفتاح السرّي، الجسم الخام)، تطابق المبلغ إلزامي قبل التأكيد، أحداث `payment.confirmed|failed|cancelled|mismatch` | `payments.test.mjs` (29) |
| `sms` | `modules/sms.js` | **M4** SMS بمحوّل HTTP عام (الرابط/التوثيق/أسماء الحقول من إعداد المستأجر فيعمل مع أي مزوّد REST)، قوالب لكل حدث `{name} {order_id} {total} {tracking}`، **رصيد شرائح لكل مستأجر** (خصم ذرّي قبل الإرسال، ردّ عند الفشل، دفتر حركات، شحن من المزوّد `POST /admin/tenants/:id/sms-credits`)، فريد لكل (حدث، نوع)، نافذة 08–21 توقيت الجزائر (تؤجَّل خارجها)، حدث `sms.credit_empty` | `sms.test.mjs` (26) |

### «بلا واجهة» ومتعدد القنوات (Headless / Mobile-first)
كل ما سبق REST/JSON خالص: ترقيم بمؤشر (`limit/after`)، أخطاء موحّدة، `Idempotency-Key` لإعادة الإرسال عند ضعف الشبكة، OpenAPI على `/openapi.json`، ومفاتيح بنطاقات (تطبيق Android للتاجر بمفتاح `events:read` + `integrations:*`؛ ومتصفح الزائر بـ`pk_pub_`). **نقطة البيع (POS)** تحتاج نموذج بيانات للطلبات والمخزون داخل المنصة (اليوم تبقى الطلبات في Supabase/PHP) — تُبنى كوحدة `orders` عند بدء الخلفية متعددة المستأجرين؛ لا تُحاكى هنا.

## ما لم يُنجز / حدود صريحة
- **نُشرت** على `https://api.alyssumhub.fyi` (Worker + D1 + cron كل دقيقة) وتحقّقنا حياً من المصادقة والفحص والأحداث والمفتاح العام/CORS؛ **لم تُربط بالمتجر بعد**، وبقية الاختبارات بمحاكاة D1 (201 فحص).
- **صيغ المنصات الخارجية غير مُجرَّبة على حسابات حقيقية**: Meta CAPI وTikTok Events API وSnapchat CAPI وWhatsApp Cloud API وResend بُنيت من الوثائق العامة وتُراجع بـ«حدث اختبار» (`test_event_code`) قبل أي إنفاق؛ نقطة Snapchat (`tr.snapchat.com/v3/<pixel>/events`) أقلّها يقيناً.
- **R2** (ملفات المنتجات الرقمية) غير متاح برمز Cloudflare الحالي؛ حتى يُفعَّل تعمل الروابط الخارجية https (مثل تخزين موقّع) فقط.
- WhatsApp: القوالب يعتمدها Meta ويلزم حساب Business؛ ولا ردّ آلي حرّ خارج نافذة 24 ساعة.
- Google Sheets عبر Apps Script (حدود حصة Google): مناسب لمئات الطلبات يومياً لا آلافها.
- معايرة أوزان التقييم تحتاج بيانات حقيقية (الأوزان الحالية تقديرية من قواعد خبرة)؛ يُنصح بتشغيلها أولاً بوضع «مراجعة» لا «حجب».
- حدّ المعدّل على D1 مبدئي (نافذة بجدول)؛ يُستبدل بـDurable Objects/KV عند الحمل.
- بصمة الجهاز تُحسب في المتصفح (ليست دليل هوية)، وقابلة للتحايل.
