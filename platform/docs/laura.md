# LAURA — الوكيل التنفيذي على Cloudflare Worker

> الحالة: **تطوير محلي مكتمل ومُختبَر محلياً؛ غير منشور**. لا أسرار أُضيفت إلى Cloudflare، ولا Worker نُشر، ولا دمج في `main` (قيد من صاحب المتجر).
> المرجع التنفيذي للاختبارات والتقرير: `platform/docs/LAURA-REPORT.md`.

## السلسلة
```
المتصفح (Spatial Core / واجهة LAURA)            ← لا مفتاح نموذج ولا مفتاح منصة
   │  جلسة Supabase للمستخدم
   ▼
platform-proxy (Supabase Edge)                   ← يتحقق من الجلسة (staff_me) ويوقّع X-Laura-Actor (HMAC) بسرّ مشترك
   │  Authorization: Bearer <PLATFORM_KEY للموقع> + X-Laura-Actor
   ▼
Cloudflare Worker  /v1/laura/{chat,confirm,tools,health}   (platform/api/src/modules/laura.js)
   │  generateContent + functionCalling (مفتاح النموذج سرّ Worker: LAURA_LLM_KEY)
   ▼
مزوّد النموذج          ◄──►  أدوات LAURA = مسارات المنصة الحقيقية (ctx.invoke بمفتاح الطالب نفسه)
```

## الهوية والصلاحيات (على الخادم فقط)
- **الهوية**: `X-Laura-Actor = v1.<base64url(JSON)>.<hex HMAC-SHA256("laura.v1."+body)>` بادّعاءات `{sub, role, perms[], tid, iat, exp}` عمرها ≤ 10 دقائق (الوسيط يعطي 5). يرفضها الـWorker إن كانت غير موقَّعة/معدَّلة/منتهية/من المستقبل/لمستأجر آخر، وإن كان `LAURA_ACTOR_SECRET` مضبوطاً فبلا ترويسة = 401 (`actor_required`). بلا سرّ مضبوط (تطوير محلي فقط) يعمل «وضع المفتاح المباشر» بدور `key`، وأي ترويسة هوية تُرفض (لا ثقة بما لا يمكن التحقق منه).
- **الأدوات المتاحة = نطاق مفتاح المنصة ∧ صلاحية المستخدم** (`perm` من `admin-roles`: المالك `*`؛ الموظف من جدول `staff`). تُفحص عند عرض الأدوات للنموذج **وعند التنفيذ**؛ ما يخرج عن ذلك يُرفض (`forbidden`) ويُسجَّل `laura.denied`.
- كل أداة تمرّ على **المسار الحقيقي** عبر `ctx.invoke(req, …)` بنفس ترويسة `Authorization` للطالب: تُطبَّق نطاقات المفتاح وحدود المعدّل وتعطيل الوحدات؛ لا رفع صلاحية. المسارات `/admin/*` و`/v1/laura/*` ممنوعة داخلياً.
## الحماية من النموذج
مخرجات النموذج غير موثوقة: مخطط صارم لكل أداة (لا مفاتيح زائدة ولا أنماط خارجية)، حدّ 4 جولات و8 استدعاءات، `history` من العميل نصّ بدورَي user/assistant فقط (لا system/tool)، نتائج الأدوات بيانات (تعليمات النظام تأمر بتجاهل أي أوامر داخلها)، وأسماء الزبائن تُختصر ولا تخرج الهواتف للنموذج. **لا توجد أداة موافقة**: الموافقة نداء عميل مستقل.
## الكتابة = موافقة صريحة + تحقق + تسجيل
1. النموذج يطلب `order_confirm`/`order_cancel` ← الخادم يتحقق (`precheck` قراءة فقط) ويُنشئ صفاً في `lr_pending` (TTL 10 د) ويُرجع بطاقة موافقة؛ **لا شيء يُنفَّذ**.
2. المستخدم يضغط «موافقة» ← `POST /v1/laura/confirm {id, approve}` بنفس المفتاح **ونفس هوية المستخدم** (وإلا 403)، يُعاد فحص الصلاحية، **claim ذرّي** (تنفيذ واحد حتى مع تسابق)، التنفيذ عبر `/v1/events` الحقيقي، ثم `verify()` يقرأ الحالة من المنصة؛ الردّ «تم» **فقط** إن تطابقت (`verified`).
3. كل خطوة في `pf_audit`: `laura.tool`، `laura.pending`، `laura.exec` (الحالة + التحقق)، `laura.rejected`، `laura.denied`، `laura.llm_error`.
## الأدوات الحالية (9)
قراءة: `orders_list`، `orders_stats`، `sales_summary`، `customers_top`، `products_list` (مخزون)، `carts_summary`، `settings_overview` (مالك فقط). كتابة: `order_confirm`، `order_cancel` (حساسة). **توسيع «إدارة المنصة»**: أضِف أداة في `src/laura/tools.js` (مسار حقيقي + `scope` + `perm` + `tier`؛ أي كتابة `tier:"write"` + `verify()` إلزامية) ثم اختبرها في `test/laura.test.mjs`. لم تُضَف أدوات تعديل المنتجات/المخزون/الإعدادات بعد (تحتاج مساراً ومراجعة لكل منها).
## الإعداد المطلوب عند النشر (لم يُنفَّذ — يحتاج موافقة جديدة)
| أين | ماذا | ملاحظة |
|---|---|---|
| Worker (أسرار) | `LAURA_LLM_KEY`، `LAURA_ACTOR_SECRET` (≥16 حرفاً) | اختياري: `LAURA_MODEL`، `LAURA_LLM_ENDPOINT`، `LAURA_TIMEOUT_MS` |
| Worker (D1) | تطبيق الهجرة `migrations/0002_laura.sql` (جدول `lr_pending`) | إضافية فقط (CREATE IF NOT EXISTS) |
| Worker (مفتاح الموقع) | إضافة النطاق `laura:chat` + نطاقات الأدوات (`orders:read`، `catalog:read`، `carts:read`، `modules:read`، `integrations:read`، `events:write`) إلى `PLATFORM_KEY` | الأدوات تُصفّى بنطاقات المفتاح |
| Supabase (أسرار الدالة) | `LAURA_ACTOR_SECRET` (نفس قيمة الـWorker)، `PLATFORM_TENANT_ID` | ثم نشر `platform-proxy` |
## التشغيل المحلي
- اختبارات الوحدة/التكامل (بلا شبكة): `node platform/api/test/laura.test.mjs` · `laura-proxy.test.mjs`.
- الـWorker الحقيقي في workerd + نموذج محاكى: `WRANGLER_BIN=<wrangler> node platform/api/tools/laura-local-e2e.mjs` (يحتاج `npm i wrangler` في مجلد مؤقت).
- المتصفح ← الوسيط ← Worker: `WRANGLER_BIN=… node admin-preview/spatial-os/test/laura-ui.js`.
- **نموذج حقيقي** (يحتاج مفتاحاً محلياً): `LAURA_LLM_KEY=… node platform/api/tools/laura-live-check.mjs` — بلا مفتاح يعلن `NOT TESTED`.
