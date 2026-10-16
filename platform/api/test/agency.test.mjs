/* خدمات التسويق بعلامة بيضاء: شراء بالمحفظة (ضمان)، إبلاغ الوكالة (webhook موقَّع / بريد)، انتقالات الحالة، تحرير/استرداد الضمان، رد الوكالة الموقَّع، وعزل التجار. */
import { makeEnv, Tally } from "./_harness.mjs";
import { wallet } from "../src/modules/wallet.js";
import { agency, validateOrder, canMove, isLate } from "../src/modules/agency.js";
import { createHmac } from "node:crypto";
const { ok, done } = Tally();
const E = makeEnv([wallet, agency]); const { call, adm, tenant, app, sql, sqlAll, fake, clock } = E;
const A = await tenant("A"), B = await tenant("B");
const bal = async (k) => (await call("GET", "/v1/wallet", null, k))[1].balances;
const invariant = () => sqlAll("SELECT currency, SUM(balance) s FROM wl_accounts GROUP BY currency").every((x) => x.s === 0);
const legsBalanced = () => sqlAll("SELECT l.tx_id, a.currency, SUM(l.amount) s FROM wl_legs l JOIN wl_accounts a ON a.id=l.account_id GROUP BY l.tx_id, a.currency").every((x) => x.s === 0);

/* ── نقي ── */
ok("الانتقالات: pending→processing→delivered فقط للأمام", canMove("pending", "processing") && canMove("processing", "delivered") && canMove("processing", "rejected") && !canMove("delivered", "rejected") && !canMove("rejected", "pending") && !canMove("processing", "pending"));
let v = validateOrder({ store_name: "م", client_email: "x", facebook_page_url: "http://a.b" }, { needs_page: 1 });
ok("تحقق النموذج: اسم قصير/بريد/رابط غير https", v.errors.store_name && v.errors.client_email && v.errors.facebook_page_url);
v = validateOrder({ store_name: "متجر الورد", client_email: "A@Shop.DZ " }, { needs_page: 1 }); ok("رابط الصفحة مطلوب إن طلبته الخدمة", !!v.errors.facebook_page_url && !v.errors.client_email);
v = validateOrder({ store_name: "متجر الورد", client_email: "A@Shop.DZ " }, { needs_page: 0 }); ok("اختياري إن لم تطلبه، والبريد يُطبَّع", !Object.keys(v.errors).length && v.value.client_email === "a@shop.dz" && v.value.facebook_page_url === null);

ok("isLate: بعد المهلة فقط وللمعلّقة فقط", isLate({ status: "pending", created_at: "2026-10-12 00:00:00" }, Date.parse("2026-10-13T01:00:00Z"), 24) && !isLate({ status: "pending", created_at: "2026-10-12 00:00:00" }, Date.parse("2026-10-12T23:00:00Z"), 24) && !isLate({ status: "delivered", created_at: "2020-01-01 00:00:00" }, Date.now(), 24) && isLate({ status: "processing", created_at: "2026-10-12 00:00:00" }, Date.parse("2026-10-12T03:00:00Z"), 2));

/* ── كتالوج الإدارة ── */
let [c, b] = await adm("POST", "/admin/agency/services", { code: "tiktok-ads", name: "حساب TikTok Ads", price: 15000, kind: "tiktok", description: "حساب إعلاني جاهز" }); ok("إضافة خدمة TikTok", c === 201, b); const S1 = b.id;
[c, b] = await adm("POST", "/admin/agency/services", { code: "meta-ads", name: "حساب Meta Ads", price: 20000, kind: "meta", needs_page: true }); ok("إضافة خدمة Meta", c === 201); const S2 = b.id;
[c] = await adm("POST", "/admin/agency/services", { code: "tiktok-ads", name: "اسم", price: 1000, kind: "tiktok" }); ok("كود مكرر 409", c === 409);
[c] = await adm("POST", "/admin/agency/services", { code: "bad one", name: "x", price: 1000, kind: "tiktok" }); ok("كود غير صالح 400", c === 400);
[c] = await adm("POST", "/admin/agency/services", { code: "zz", name: "خدمة", price: 0, kind: "tiktok" }); ok("سعر صفر 400", c === 400);
[c] = await adm("POST", "/admin/agency/services", { code: "old", name: "خدمة قديمة", price: 5000, kind: "other", active: false }); 
[c, b] = await call("GET", "/v1/agency/services", null, A.key); ok("التاجر يرى النشطة فقط بالدينار", c === 200 && b.services.length === 2 && b.services.every((s) => s.currency === "DZD") && b.services.find((s) => s.code === "meta-ads").needs_page === true, b);
[c] = await call("GET", "/v1/agency/services"); ok("بلا مفتاح 401", c === 401);

/* ── شراء: رصيد غير كافٍ ← لا أثر ── */
const form = { service_id: S1, store_name: "متجر الورد", client_email: "owner@rose.dz" };
[c, b] = await call("POST", "/v1/agency/orders", form, A.key); ok("الرصيد غير كافٍ 409", c === 409 && b.error.code === "insufficient_funds");
ok("لا طلب ولا قيد بعد الفشل", sql("SELECT COUNT(*) n FROM agency_orders").n === 0 && sql("SELECT COUNT(*) n FROM wl_tx WHERE kind='service_hold'").n === 0);
E.db.exec("DELETE FROM sqlite_sequence WHERE name='agency_orders'");      // الفاشلة تستهلك رقماً؛ نصفّر ليبقى ترقيم الاختبار مقروءاً
await adm("POST", `/admin/wallet/${A.id}/deposit`, { amount: 50000, ref: "BANK-A1" });
[c, b] = await call("POST", "/v1/agency/orders", { ...form, client_email: "bad" }, A.key); ok("بريد غير صالح 400 مع الحقل", c === 400 && b.error.fields.client_email);
[c] = await call("POST", "/v1/agency/orders", { ...form, service_id: S2 }, A.key); ok("خدمة تتطلب الصفحة بلا رابط 400", c === 400);
[c] = await call("POST", "/v1/agency/orders", { ...form, service_id: 999 }, A.key); ok("خدمة مجهولة 404", c === 404);

/* ── شراء ناجح، الشريك غير مضبوط بعد ── */
[c, b] = await call("POST", "/v1/agency/orders", form, A.key, {}, { "idempotency-key": "buy-1" }); ok("شراء ناجح", c === 201 && b.order.status === "pending" && b.order.price === 15000 && b.order.ref === "AG-1", b);
const again = await call("POST", "/v1/agency/orders", form, A.key, {}, { "idempotency-key": "buy-1" }); ok("إعادة نفس المفتاح لا تشتري ثانية", again[3].headers["Idempotent-Replayed"] === "true" && sql("SELECT COUNT(*) n FROM agency_orders").n === 1);
let B1 = await bal(A.key); ok("المبلغ في الضمان: المتاح 35000 والضمان 15000", B1.available.DZD === 35000 && B1.escrow.DZD === 15000, B1);
ok("الدفتر متوازن", invariant() && legsBalanced());
ok("الشريك غير مضبوط ← تبقى pending بلا خطأ", sql("SELECT status, partner_state FROM agency_orders WHERE id=1").partner_state === "unconfigured" && fake.calls.length === 0);
ok("حدث agency.order_paid صدر مرة", sql("SELECT COUNT(*) n FROM pf_events WHERE type='agency.order_paid'").n === 1);

/* ── إعدادات الشريك ── */
[c] = await adm("PUT", "/admin/agency/partner", { notify: "webhook", webhook_url: "http://insecure.example/x", webhook_secret: "s" }); ok("webhook غير https مرفوض", c === 400);
[c, b] = await adm("PUT", "/admin/agency/partner", { notify: "webhook", webhook_url: "https://agency.example/hook", webhook_secret: "whsec_partner_secret" }); ok("ضبط الشريك يعيد إدراج المنتظرة", c === 200 && b.requeued === 1, b);
[, b] = await adm("GET", "/admin/agency/partner"); ok("الأسرار لا تُعرض", b.has_webhook_secret === true && !JSON.stringify(b).includes("whsec_partner_secret"));
ok("السرّ مشفّر في القاعدة", !JSON.stringify(sql("SELECT * FROM agency_settings")).includes("whsec_partner_secret"));

/* ── الإبلاغ: webhook موقَّع ── */
fake.calls.length = 0; fake.handler = () => [200, { partner_ref: "AGN-77" }];
await app.cron();
ok("cron أرسل الطلب للوكالة", fake.calls.length === 1 && fake.calls[0].url === "https://agency.example/hook", fake.calls.length);
const call0 = fake.calls[0], body0 = JSON.parse(call0.init.body), sig = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(call0.init.headers["X-Agency-Signature"]);
ok("التوقيع HMAC صحيح", sig && sig[2] === createHmac("sha256", "whsec_partner_secret").update(sig[1] + "." + call0.init.body).digest("hex"));
ok("الحمولة: تفاصيل الزبون والخدمة والسعر ورابط الرد", body0.order_id === "AG-1" && body0.client.store_name === "متجر الورد" && body0.client.email === "owner@rose.dz" && body0.service.code === "tiktok-ads" && body0.price === 15000 && body0.callback_url === "https://api.example/v1/agency/partner/callback", body0);
let o1 = sql("SELECT * FROM agency_orders WHERE id=1"); ok("الحالة processing ومرجع الشريك محفوظ", o1.status === "processing" && o1.partner_state === "sent" && o1.partner_ref === "AGN-77", o1);
[, b] = await call("GET", "/v1/agency/orders/1", null, A.key); ok("التاجر لا يرى بيانات الشريك", b.order.status === "processing" && !JSON.stringify(b).includes("AGN-77") && !JSON.stringify(b).includes("partner") && b.order.invite_link === null);
fake.calls.length = 0; await app.cron(); ok("لا يُرسل ثانية", fake.calls.length === 0);

/* ── فشل الشريك ثم نجاح بالتباعد ── */
await adm("POST", `/admin/wallet/${A.id}/deposit`, { amount: 40000, ref: "BANK-A2" });
fake.handler = () => [500, "boom"];
[c, b] = await call("POST", "/v1/agency/orders", { ...form, store_name: "متجر ثانٍ" }, A.key); ok("الشراء ينجح رغم تعذّر الشريك (المبلغ في الضمان)", c === 201 && b.order.status === "pending", b);
let o2 = sql("SELECT * FROM agency_orders WHERE id=2"); ok("partner_state=failed وسبب الخطأ محفوظ للإدارة", o2.partner_state === "failed" && /HTTP 500/.test(o2.last_error), o2);
ok("السبب لا يصل التاجر", !JSON.stringify((await call("GET", "/v1/agency/orders", null, A.key))[1]).includes("HTTP 500"));
fake.calls.length = 0; await app.cron(); ok("لا إعادة قبل التباعد", fake.calls.length === 0);
clock.t += 90e3; fake.handler = () => [200, "ok"]; await app.cron();
ok("بعد التباعد يُبلَّغ الشريك وتصير processing", sql("SELECT status FROM agency_orders WHERE id=2").status === "processing" && fake.calls.length === 1);

/* ── التسليم (back-office) ── */
[c] = await adm("PATCH", "/admin/agency/orders/1", { status: "delivered" }); ok("التسليم بلا رابط دعوة 400", c === 400);
[c] = await adm("PATCH", "/admin/agency/orders/1", { status: "delivered", invite_link: "javascript:alert(1)" }); ok("رابط غير https 400", c === 400);
ok("لا أثر مالي من المحاولات الفاشلة", (await bal(A.key)).escrow.DZD === 30000 && sql("SELECT status FROM agency_orders WHERE id=1").status === "processing");
[c, b] = await adm("PATCH", "/admin/agency/orders/1", { status: "delivered", invite_link: "https://business.tiktok.com/invite/abc123", note: "تم" }); ok("تسليم", c === 200 && b.order.status === "delivered", b);
B1 = await bal(A.key); ok("الضمان حُرِّر لرسوم المنصة: escrow 15000 والمتاح 60000", B1.escrow.DZD === 15000 && B1.available.DZD === 60000, B1);
ok("إيراد المنصة 15000", sql("SELECT balance b FROM wl_accounts WHERE tenant_id=0 AND code='platform_fees' AND currency='DZD'").b === 15000);
ok("الدفتر متوازن بعد التحرير", invariant() && legsBalanced());
[, b] = await call("GET", "/v1/agency/orders/1", null, A.key); ok("التاجر يرى رابط الدعوة بعد التسليم", b.order.invite_link === "https://business.tiktok.com/invite/abc123" && b.order.status === "delivered" && !!b.order.delivered_at, b);
[c] = await call("GET", "/v1/agency/orders/1", null, B.key); ok("تاجر آخر لا يرى الطلب 404", c === 404);
[c, b] = await adm("PATCH", "/admin/agency/orders/1", { status: "delivered", invite_link: "https://business.tiktok.com/invite/abc123" }); ok("تسليم مكرر لا يضاعف التحرير", c === 200 && b.unchanged === true && invariant() && (await bal(A.key)).escrow.DZD === 15000);
[c] = await adm("PATCH", "/admin/agency/orders/1", { status: "rejected" }); ok("بعد التسليم لا رفض 409", c === 409);

/* ── الرفض ← استرداد ── */
[c, b] = await adm("PATCH", "/admin/agency/orders/2", { status: "rejected", note: "الوكالة لم تقبل الصفحة" }); ok("رفض", c === 200 && b.order.status === "rejected");
B1 = await bal(A.key); ok("استُرد المبلغ للمتاح: 75000 والضمان 0", B1.available.DZD === 75000 && (B1.escrow.DZD ?? 0) === 0, B1);
[, b] = await call("GET", "/v1/agency/orders/2", null, A.key); ok("التاجر يرى سبب الرفض", b.order.status === "rejected" && /الصفحة/.test(b.order.note) && b.order.invite_link === null);
ok("الدفتر متوازن بعد الاسترداد", invariant() && legsBalanced());
[c] = await adm("PATCH", "/admin/agency/orders/2", { status: "delivered", invite_link: "https://x.example/i" }); ok("المرفوض لا يُسلَّم 409", c === 409);

/* ── رد الوكالة الموقَّع (API) ── */
await call("POST", "/v1/agency/orders", { ...form, store_name: "متجر ثالث" }, A.key); await app.cron();
const cb = (payload, secret = "whsec_partner_secret", ts = Math.floor(clock.t / 1000)) => { const raw = JSON.stringify(payload); return call("POST", "/v1/agency/partner/callback", raw, null, {}, { "x-agency-signature": `t=${ts},v1=${createHmac("sha256", secret).update(ts + "." + raw).digest("hex")}` }); };
[c] = await cb({ order_id: "AG-3", status: "delivered", invite_link: "https://x.example/i" }, "wrong"); ok("توقيع خاطئ 401", c === 401);
[c] = await cb({ order_id: "AG-3", status: "delivered", invite_link: "https://x.example/i" }, "whsec_partner_secret", Math.floor(clock.t / 1000) - 3600); ok("توقيع قديم (إعادة بث) 401", c === 401);
[c] = await call("POST", "/v1/agency/partner/callback", JSON.stringify({ order_id: "AG-3", status: "delivered" })); ok("بلا توقيع 401", c === 401);
[c] = await cb({ order_id: "AG-3", status: "delivered" }); ok("رد بلا رابط دعوة 400", c === 400);
[c, b] = await cb({ order_id: "AG-3", status: "delivered", invite_link: "https://ads.example/invite/xyz" }); ok("رد الوكالة بالتسليم", c === 200 && b.status === "delivered", b);
ok("تحرير الضمان بعد رد الوكالة", invariant() && sql("SELECT balance b FROM wl_accounts WHERE tenant_id=0 AND code='platform_fees' AND currency='DZD'").b === 30000);

/* ── بريد منظَّم (Resend) ── */
await adm("PUT", "/admin/agency/partner", { notify: "email", email_to: "ops@agency.example", email_from: "Alyssum <noreply@alyssum.example>", resend_key: "re_test_key" });
fake.calls.length = 0; fake.handler = () => [200, { id: "em1" }];
[c, b] = await call("POST", "/v1/agency/orders", { ...form, service_id: S2, store_name: "<b>متجر</b> رابع", facebook_page_url: "https://facebook.com/shop4" }, A.key); ok("شراء Meta بالبريد", c === 201 && b.order.status === "processing", b);
const em = fake.calls.find((x) => x.url === "https://api.resend.com/emails"), emb = JSON.parse(em.init.body);
ok("بريد إلى الوكالة بهيدر الاعتماد", em.init.headers.Authorization === "Bearer re_test_key" && emb.to[0] === "ops@agency.example" && /AG-4/.test(emb.subject));
ok("نص البريد مهرَّب (لا HTML من الزبون)", emb.html.includes("&lt;b&gt;متجر") && !emb.html.includes("<b>متجر") && emb.html.includes("https://facebook.com/shop4"));

/* ── بريد الزبون عند التسليم + مهلة التأخر ── */
fake.calls.length = 0; fake.handler = () => [200, { id: "em2" }];
[c] = await adm("PATCH", "/admin/agency/orders/4", { status: "delivered", invite_link: "https://business.facebook.com/invite/q1" }); ok("تسليم طلب Meta", c === 200);
const cm = fake.calls.find((x) => x.url === "https://api.resend.com/emails"), cmb = cm && JSON.parse(cm.init.body);
ok("بريد الزبون برابط الدعوة (مهرَّب)", cmb && cmb.to[0] === "owner@rose.dz" && cmb.html.includes("https://business.facebook.com/invite/q1") && cmb.html.includes("&lt;b&gt;متجر") && !cmb.html.includes("<b>متجر</b> رابع"), cmb && cmb.to);
await adm("PUT", "/admin/agency/partner", { notify_client: false }); fake.calls.length = 0;
await call("POST", "/v1/agency/orders", { ...form, store_name: "متجر خامس" }, A.key, {}, { "idempotency-key": "buy-5" }); await adm("PATCH", "/admin/agency/orders/5", { status: "delivered", invite_link: "https://x.example/inv5" });
ok("notify_client=false يوقف بريد الزبون", !fake.calls.some((x) => x.url === "https://api.resend.com/emails" && /inv5/.test(x.init.body) && /حسابك الإعلاني/.test(x.init.body)));
[c] = await adm("PUT", "/admin/agency/partner", { sla_hours: 0 }); ok("sla_hours خارج النطاق 400", c === 400);
await adm("PUT", "/admin/agency/partner", { sla_hours: 6 }); await call("POST", "/v1/agency/orders", { ...form, store_name: "متجر سادس" }, A.key); 
clock.t += 7 * 3600e3;
[, b] = await call("GET", "/v1/agency/orders", null, A.key); ok("التاجر يرى متأخر=true بعد المهلة", b.sla_hours === 6 && b.orders[0].ref === "AG-6" && b.orders[0].late === true && b.orders.find((x) => x.status === "delivered").late === false, b.orders.map((x) => [x.ref, x.late]));
[, b] = await adm("GET", "/admin/agency/orders"); ok("الإدارة ترى late", b.orders.find((x) => x.id === 6).late === true);

/* ── مفاتيح الاختبار (sandbox) لا تمسّ المال ── */
const T = await tenant("T", ["*"], "test"); const before = sql("SELECT COUNT(*) n FROM wl_tx").n;
[c, b] = await call("POST", "/v1/agency/orders", form, T.key); ok("sandbox بلا خصم ولا طلب", c === 201 && b.sandbox === true && sql("SELECT COUNT(*) n FROM wl_tx").n === before);

/* ── تعطيل الوحدة لمستأجر ── */
await adm("PUT", `/admin/tenants/${B.id}/modules`, { off: ["agency"] }); [c, b] = await call("GET", "/v1/agency/services", null, B.key); ok("وحدة معطّلة 403", c === 403 && b.error.code === "module_disabled");
[c] = await call("GET", "/admin/agency/orders"); ok("مسارات الإدارة تتطلب رمز الإدارة", c === 401);
[, b] = await adm("GET", "/admin/agency/orders"); ok("الإدارة ترى الطلبات مع اسم التاجر وحالة الإبلاغ", b.orders.length === 6 && b.orders[0].tenant_name === "A" && "partner_state" in b.orders[0], b.orders.length);
[, b] = await adm("GET", "/admin/agency/orders", null); const f = await app.handle("GET", "/admin/agency/orders", { status: "delivered" }, { authorization: "Bearer adm-tok" }, ""); ok("تصفية بالحالة", JSON.parse(f.body).orders.length === 4);
ok("الدفتر متوازن في النهاية", invariant() && legsBalanced());
done();
