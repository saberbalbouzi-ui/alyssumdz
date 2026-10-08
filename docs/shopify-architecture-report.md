# تقرير: تقنيات منصة Shopify (مرجع لبناء منصتنا SaaS)

> محفوظ بطلب صاحب المتجر ليُعمل به لاحقاً. المصدر: تقرير مقدَّم من صاحب المتجر (حتى أكتوبر 2026) مبني على مصادر Shopify الرسمية؛ لم أتحقق منه بنفسي.
> تنبيه من التقرير نفسه: Shopify لا تنشر الـStack الكامل؛ ما يلي مؤكَّد رسمياً أو معلن جزئياً/تاريخياً، وبعض الأنظمة الداخلية غير معلنة أو تتغير.

## 1. الصورة الكبيرة
Shopify ليست أداة واحدة بل طبقات: **Merchant Admin** (React + TS + Polaris + GraphQL) و**Storefront** (Liquid / Hydrogen / Storefront API) و**نظام التطبيقات** (App Bridge، Extensions، Functions) فوق **واجهات Shopify APIs** ثم **نواة Ruby on Rails** وخلفها MySQL وVitess وKafka وMemcached/Redis وKubernetes (GKE) وGoogle Cloud.

## 2. الطبقات

| الطبقة | Shopify |
|---|---|
| Backend الأساسي | Ruby |
| Framework | Ruby on Rails (القلب التاريخي؛ ليست Node/Laravel/Django/PHP) |
| Admin Frontend | React + TypeScript (انتقال من Rails/ERB منذ 2017) |
| نظام الواجهة | Polaris (Web Components في الأسطح الحديثة) |
| ربط التطبيقات بالـAdmin | App Bridge |
| API | GraphQL Admin API (REST صار Legacy للتطبيقات الجديدة) |
| الواجهة الأمامية للمتجر | Liquid (تقليدي) / Hydrogen (React، headless) |
| API المتجر | GraphQL Storefront API |
| منطق مخصص في الخادم | Shopify Functions (WebAssembly، Rust مفضّل) |
| قاعدة البيانات | MySQL + sharding + replicas |
| توسيع MySQL | Vitess (VTGate يوجّه الاستعلام للـshard) ومنصة KateSQL الداخلية على GKE |
| الكاش | Memcached (كاش موزّع) + Redis (طوابير/مهام/بعض الكاش) — ملاحظة 2026: استُبدل Redis بـMySQL في حجوزات المخزون |
| الأحداث | Apache Kafka (data/event bus منذ 2014) + Webhooks |
| الحاويات | Docker ثم Kubernetes (GKE) |
| السحابة | Google Cloud تاريخياً + multi-cloud في بعض الأحمال (GPU/AI) — لا يصح قول «Google فقط» |
| التحليلات | Trino (SQL موزّع) |
| البث | Apache Flink (RocksDB للحالة، GCS للـcheckpoints) |
| سير العمل | Apache Airflow (على Kubernetes) |
| التخزين | Google Cloud Storage |
| تعلّم الآلة | Merlin (تدريب/استدلال) + Pano + Model Registry |
| أدوات المطوّر | Shopify CLI (`app init|dev|build|deploy|generate extension|logs`…) |
| التوسعات | App Extensions (Admin، Checkout، Thank you، Customer accounts، POS، Functions، Theme) |
| بيانات مخصصة | Metafields / Metaobjects (بدل `ALTER TABLE` لكل متجر) |
| لغة التحليل | ShopifyQL |

## 3. أفكار معمارية مهمة
- **Polaris:** نظام تصميم كامل (مكوّنات + تخطيط + نماذج + تنقل + إتاحة)، لا مجرد CSS. الفلسفة: نظيف، محايد، تباين عالٍ، كثافة معلومات، اتساق، سلوك متوقع (وليس Glass/Neon).
- **App Bridge مقابل Polaris:** Polaris يبني الواجهة داخل التطبيق؛ App Bridge يتحكم بإطار الـAdmin المحيط (التنقل، شريط العنوان، شريط الحفظ، النوافذ، السياق).
- **GraphQL:** استعلام واحد بدل endpoint لكل شيء (منتجات، عملاء، طلبات، مخزون، خصومات…).
- **Functions + WebAssembly:** تشغيل منطق غير موثوق داخل صندوق رمل (أمان، أداء، مرونة): خصومات، شحن، دفع، تحقق، توجيه الطلبات — دون إعطاء التطبيق وصولاً كاملاً للنواة.
- **Event-driven:** حدث ← Kafka ← مستهلكون (تحليلات، مخزون، إشعارات)؛ وWebhooks بدل أن يسأل التطبيق كل دقيقة «هل تغيّر شيء؟».
- **Metafields/Metaobjects:** مخطط مرن لكل متجر دون تعديل المخطط الأساسي.

## 4. ما نأخذه لمنصتنا (توصية التقرير)
لا ننسخ Shopify تقنياً؛ نحتاج نسخة أصغر بكثير:

```
Admin (JS + نظام واجهة خاص)      Storefront (HTML/CSS/JS)
              └────────── API ──────────┘
                      Supabase
        Auth · PostgreSQL (RLS + Functions) · Storage
                   Multi-tenant (store_id)
        Stores · Products · Orders · Customers · Pages · Analytics
```

1. **Multi-tenant:** كل متجر له `store_id` في كل جدول (مع RLS).
2. **صلاحيات:** Owner / Admin / Editor / Support / Marketing.
3. **نظام Extensions/Apps:** نقاط توسعة ثابتة تتيح لاحقاً تطبيقات وتكاملات وأدوات ذكاء اصطناعي ودفع وشحن وتحليلات.
4. **نظام أحداث:** `ORDER_CREATED`, `PRODUCT_UPDATED`, `CUSTOMER_CREATED`, `PAYMENT_CONFIRMED`… مع Webhooks.
5. **API-first:** ألّا يحمل `admin.html` كل المنطق؛ يصير عميلاً لواجهة API.
6. **نظام تصميم خاص** مستوحى من فلسفة Polaris (لا من شكلها): عناصر أولية، بطاقات، جداول، نماذج، نوافذ، تنقل، رسوم، لوحة أوامر، إشعارات — بهويتنا.

## 5. ربط بما هو موجود في المستودع (ملاحظات لنا)
- Supabase موجود أصلاً (`supabase/schema.sql`، RLS)؛ المطلوب لاحقاً إضافة `store_id` وجداول الأدوار والأحداث (مخطط `saas/` مرحلة 1 غير مربوط).
- منشئ الصفحات وأدوات اللوحة صارت قريبة من «نظام Extensions» بعناصر `PB.WIDGETS` (يمكن تعميم الفكرة).
- `Seller`/`PHPAPI`/`API.cust` تمثّل طبقات خلفية متعددة (github|php|sb) — مرشّحة لتوحيدها خلف واجهة API واحدة.
