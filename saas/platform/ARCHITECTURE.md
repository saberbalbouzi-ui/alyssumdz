# معمارية المنصة — Monolithe modulaire، API-first، Event-driven

> مرجع قاعدة الاعتماد بين الوحدات. يحرسه الاختبار `test/boundaries.test.mjs` (في CI)؛ أي استثناء يُكتب هنا **وفي الاختبار** معاً.
> التفاصيل التشغيلية والخارطة: `docs/platform-api-architecture.md`.

## 1) الصورة
Worker واحد (Cloudflare) + D1 واحدة = **monolithe modulaire**. كل «نطاق» وحدة مستقلة تسجّلها `src/index.js`:

```
Router (core.js) ─► وحدة.routes ─► خدمة نقية (دوال بلا I/O) ─► Repository (SQL بجداول الوحدة) ─► Adapter (مزوّد خارجي)
                         │
                         └── ctx.emit(tenant, type, data, extId) ─► pf_events (صندوق صادر) ─► cron ─► وحدة.on[type]
```

العقد: `{ id, routes(r, ctx), on?: { "نوع.الحدث": handler }, cron?(ctx) }`. المعالجة **مستقلة لكل وحدة** (`done`) مع إعادة محاولة؛ فشل وحدة لا يوقف غيرها، وتعطيلها لمستأجر (`PUT /admin/tenants/:id/modules`) لا يمسّ البقية.

## 2) خريطة النطاقات (اقتراح DDD ↔ الواقع)

| النطاق المقترح | ما يقابله اليوم | الحالة |
|---|---|---|
| **Core** (Auth/Tenant) | `core.js` + `platform.js` (`pf_*`: مستأجرون، مفاتيح بنطاقات، أحداث، تكاملات مشفّرة، تدقيق، idempotency) | منجَز |
| **BillingWallet** | `wallet.js` (`wl_*`: دفتر قيد مزدوج، ضمان escrow، سحب، دولار إعلانات) + `payments.js` (Chargily) + `sms.js` (رصيد رسائل) | منجَز (واجهة اللوحة v1.89.235؛ شاشة المزوّد معلّقة) |
| **Storefront** | `commerce.js` (`cm_*`: كتالوج، تحقق سعر/مخزون، طلبات) + `carts.js` + `ab.js` + `ai.js` + `digital.js` | منجَز (وضع المراقبة؛ `enforce` ينتظر نقل مصدر المخزون) |
| **Logistics** | `saas/gateway` (Worker+D1 مستقل: محوّلات الشركات، webhooks، قواميس الحالات) + `sources.js` | منجَز؛ **البوابة تصدر `order.shipped|out_for_delivery|delivered|returned` إلى الناقل (v1.89.237)** عبر `POST /admin/events` (extId `gw:`) |
| **CallCenter** | داخل لوحة التاجر (`admin-callcenter.js`: طابور، أدوار، أهداف) | **غير موجود كوحدة منصة** (ثغرة 2) |
| **AppStore** (النظام البيئي) | **`appstore.js`** (v1.89.243: `apps`/`app_*`/`oauth_*`/`platform_revenues`؛ OAuth 2.0 بنطاقات مغلقة، مراجعة يدوية، تقاسم إيراد عبر المحفظة، webhooks صادرة موقَّعة) | منجَز؛ لم يُجرَّب مع تطبيق طرف ثالث حقيقي (دليل المطوّر: `docs/app-store-developers.md`) |
| **MarketingAgency** | `ads.js` + `adsoauth.js` (إنفاق Meta/TikTok، OAuth) + `capi.js` + `whatsapp.js` + `sheets.js` + `antifraud.js` + **`agency.js`** (v1.89.241: بيع حسابات إعلانية بعلامة بيضاء: `marketing_services`/`agency_orders`) | منجَز؛ توفير الحسابات يدوي عند الوكالة الشريكة (webhook/بريد + رد موقَّع)، وحسابات Master BM يدوية (ثغرة 3) |

## 3) قاعدة الاعتماد (الملزِمة)
1. **لا وحدة تكتب في جدول وحدة أخرى.** لكل وحدة بادئة جداول (`cm_`، `wl_`، `ad_`…)؛ `pf_*` ملك النواة/`platform` (قراءة فقط لغيرها).
2. **التواصل بين الوحدات = أحداث فقط** (`ctx.emit` ← `on`). لا استيراد وحدة لأخرى ولا استدعاء مباشر.
3. **كل حدث تستمع إليه وحدة له مُصدِر معروف** (وحدة أو مصدر خارجي موثّق `EXTERNAL`)؛ الاختبار يفشل لحدث «يتيم».
4. **المال لا يتحرك إلا عبر `wallet.post()`** وبحدث من مصدر موثوق (`TRUSTED_PAYMENT_SOURCES`) — لا من `/v1/events` الذي يملكه التاجر.
5. **كل جدول له مالك**؛ جدول بلا بادئة معروفة يفشل الاختبار.

### الاستثناءات الموثّقة (الوحيدة)
- قراءة `pf_tenants` و`pf_integrations` مسموحة للجميع (هوية المستأجر وأسرار التكاملات عبر الخزنة).
- `wallet` يقرأ `pf_events` ليتحقق من مصدر `payment.confirmed`.
- **`ctx.authProviders` (خطّاف مصادقة)**: النواة تحلّ رموز المفاتيح `pk_*` بنفسها، وأي وحدة تسجّل `{prefix, resolve}` لتحلّ رمزاً ببادئتها (`appstore` ← `at_`). الرمز المحلول لا يمرّ إلا على مسارات لها نطاق صريح ضمن نطاقات الرمز (غير المعلَن = 403 `insufficient_scope`)، وبحدّ معدّل لكل تثبيت. بيانات الزبائن في `commerce`/`carts` تُقنَّع تلقائياً لمن لا يملك `read_customers` (`util.seesPii`).
- **`ctx.wallet` (استثناء مالي وحيد لقاعدة «لا استدعاء مباشر»)**: وحدة `wallet` تسجّل في `routes()` خدمة `ctx.wallet = { hold, release, refund, charge, payout, fee, unwind }` (الأربعة الأخيرة لتقاسم إيراد التطبيقات عبر الحساب الوسيط `app_clearing` الذي يعود صفراً بعد كل تسوية) (متاح→ضمان→رسوم المنصة، أو ضمان→متاح) ليشتري بها `agency` خدمات بالدينار **بشكل متزامن** (ردّ فوري «الرصيد غير كافٍ» بدل حدث غير متزامن). كل قيد مرجعه فريد (`svc:hold|rel|ref:<رقم الطلب>`) فلا يتكرر، والدفتر يبقى متوازناً؛ لا وحدة غير `wallet` تكتب جداول `wl_*`.
- `adsoauth` يكتب `ad_accounts` (مملوك لـ`ads`) عند «الربط السريع»، ويستورد `MAX_ACCOUNTS` و`validateAccount` (دوال نقية بلا I/O) من `ads.js`؛ تحويله إلى حدث `ads.account_linked` مؤجَّل.

## 4) لماذا لم نعتمد PHP/Laravel (قرار)
المقترح الخارجي طلب monolithe modulaire بـ PHP/Laravel وDDD. **النمط نفسه منفَّذ أصلاً** وإعادة كتابته كلفتها أعلى من فائدتها:
- المنصة منشورة على Workers+D1 (≈19 وحدة، 600+ فحص آلي، مفاتيح بنطاقات، صندوق أحداث، OpenAPI تلقائي)؛ Laravel يحتاج استضافة PHP دائمة ولا يعمل على Workers.
- نسخة PHP موجودة لعملاء الاستضافة (`php-edition/`) وبوابة الشحن بنسخة PHP وJS متطابقتين بلقطة ذهبية؛ لا حاجة لطبقة ثالثة.
- ما كان ينقص هو **التوثيق والإنفاذ** لقاعدة الاعتماد — وقد أُضيفا (هذا الملف + `boundaries.test.mjs`).

## 5) كتالوج الأحداث (المُصدِر ← المستمعون)
| الحدث | يصدره | يستمع |
|---|---|---|
| `order.created` | `commerce` (وكذلك لوحة التاجر) | capi, whatsapp, sheets, carts, sms |
| `order.confirmed/cancelled/failed` | لوحة التاجر (`/v1/events`) | capi, sheets, sms, commerce, wallet |
| `order.shipped/out_for_delivery/delivered/returned` | **بوابة الشحن** (`/admin/events`، extId `gw:…`) وللتسليم أيضاً لوحة التاجر | sheets, sms, commerce, wallet (`delivered` ضمان؛ `returned` استرداد) |
| `payment.confirmed/failed/cancelled` | `payments` (Chargily موثَّق) | digital, sms, wallet |
| `wallet.escrow_held/released`, `refund_due`, `withdrawal_*`, `deposit`, `ads_topup` | `wallet` | hooks (وأي مشترك خارجي) |
| `agency.order_paid/processing/delivered/rejected/client_mailed` | `agency` | hooks (وأي مشترك خارجي؛ التسليم يحمل `invite_link`) |
| `appstore.installed/uninstalled/suspended` | `appstore` | hooks، وتطبيق التثبيت نفسه (webhook دورة الحياة) |
| `fraud.high_risk` | `antifraud` | hooks |
| `ads.token_expiring/expired` | `adsoauth` | hooks |
| `sms.credit_empty`, `digital.delivered`, `digital.ready`, `digital.short`, `payment.proof_submitted`, `whatsapp.sent`, `order.customer_confirmed/cancelled` | sms/digital/whatsapp | hooks, sheets |

`hooks` يستمع إلى `*` ويوزّع كل حدث على نقاط المشتركين الخارجيين.

## 6) ثغرات معروفة (لا تُخفى)
1. ~~Logistics → ناقل الأحداث~~ **أُغلقت (v1.89.237):** البوابة تصدر الأحداث (صندوق `gw_bus` + إعادة محاولة) والمحفظة تقبل `wallet.require_carrier` فلا يُحرَّر الضمان إلا بتسليم مؤكَّد من الشركة. يبقى: الطلبات المرسلة مباشرة من اللوحة بلا البوابة (ياليدين المباشر) لا تمرّ بها فتحتاج `require_carrier=false`.
2. **CallCenter** (طابور المؤكِّدات، أهداف، أداء) في اللوحة وSupabase فقط؛ لا وحدة `cc_*` على المنصة بعد.
3. **Master BM:** إسناد حسابات إعلان للتجار يدوي؛ المحفظة تسجّل شراء الدولار فقط (قيد الإنفاق الفعلي صار من تبويب «المحفظة» في لوحة المزوّد v1.89.238، والصرف الفعلي للسحب ما زال تحويلاً يدوياً يؤكّده المدير).
4. **المخزون:** مصدره لوحة التاجر؛ لذلك `order_mode=observe`.
5. الاشتراكات ما زالت في Supabase (لا في `wl_*`).

## 7) إضافة وحدة جديدة
1. ملف `src/modules/<اسم>.js` بالعقد أعلاه، جداولها ببادئة فريدة في `schema.sql`.
2. سجّل البادئة في `OWN` داخل `test/boundaries.test.mjs` وأدرج الوحدة في `MODS` (وسجّلها في `src/index.js`).
3. أحداثها: صدّرها بـ`ctx.emit` وأضفها للكتالوج أعلاه؛ أي حدث خارجي جديد يُضاف إلى `EXTERNAL` مع تبرير.
4. اختبار الوحدة نفسها + تشغيل `boundaries.test.mjs`.
