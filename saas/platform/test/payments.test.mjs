/* الدفع الإلكتروني (Chargily Pay V2): جلسة دفع، تعدّد الاستدعاء، إشعارات موقّعة، تطابق المبلغ، عدم التكرار. */
import { makeEnv, Tally } from "./_harness.mjs";
import { payments } from "../src/modules/payments.js";
import { hmacHex } from "../src/util.js";
const { ok, done } = Tally();
const E = makeEnv([payments], { providers: ["chargily"] }); const { call, adm, tenant, fake, app, sql, sqlAll } = E;
const A = await tenant("A"), B = await tenant("B");
const body = { order_id: "O-100", amount: 4500, success_url: "https://shop.example/thanks", failure_url: "https://shop.example/fail", description: "طلب 100" };
let [c, b] = await call("POST", "/v1/payments/checkouts", body, A.key); ok("بلا تكامل 409", c === 409 && b.error.code === "integration_missing", b);
[c] = await call("PUT", "/v1/integrations/chargily", { config: { mode: "test" }, secrets: { secret_key: "test_sk_abc" } }, A.key); ok("ضبط التكامل", c === 200);
for (const [n, bad] of [["مبلغ سالب", { amount: -5 }], ["مبلغ نص", { amount: "abc" }], ["رابط http", { success_url: "http://x.com/a" }], ["رابط داخلي", { success_url: "https://localhost/a" }], ["طلب خاطئ", { order_id: "a b" }], ["وسيلة خاطئة", { payment_method: "paypal" }], ["لغة خاطئة", { locale: "de" }]]) { [c] = await call("POST", "/v1/payments/checkouts", { ...body, ...bad }, A.key); ok("رفض: " + n, c === 400, c); }
fake.handler = (url, init) => { fake.last = { url, init }; return [200, { id: "chk_1", checkout_url: "https://pay.chargily.dz/test/checkouts/chk_1/pay", status: "pending" }]; };
[c, b] = await call("POST", "/v1/payments/checkouts", body, A.key); ok("إنشاء جلسة 201 برابط الدفع", c === 201 && b.checkout_url.includes("chk_1"), b);
const sent = JSON.parse(fake.last.init.body); ok("الطلب لـChargily: عنوان الاختبار وBearer والحقول", fake.last.url === "https://pay.chargily.net/test/api/v2/checkouts" && fake.last.init.headers.Authorization === "Bearer test_sk_abc" && sent.amount === 4500 && sent.currency === "dzd" && sent.metadata.order_id === "O-100" && /\/v1\/payments\/hook\/[0-9a-f]{24}$/.test(sent.webhook_endpoint), sent);
fake.calls.length = 0; [c, b] = await call("POST", "/v1/payments/checkouts", body, A.key); ok("استدعاء ثانٍ بالمبلغ نفسه يعيد الرابط بلا طلب جديد", c === 200 && b.reused === true && fake.calls.length === 0);
fake.handler = () => [200, { id: "chk_2", checkout_url: "https://pay.chargily.dz/test/checkouts/chk_2/pay" }];
[c, b] = await call("POST", "/v1/payments/checkouts", { ...body, amount: 5000 }, A.key); ok("مبلغ مختلف: جلسة جديدة", c === 201 && b.id === "chk_2");
fake.handler = () => [401, { message: "bad key" }]; [c, b] = await call("POST", "/v1/payments/checkouts", { ...body, order_id: "O-101" }, A.key); ok("رفض المزوّد 502 بلا تسريب", c === 502 && b.error.code === "provider_rejected" && !JSON.stringify(b).includes("bad key"));
fake.handler = () => [200, { id: "x", checkout_url: "http://evil.example/pay" }]; [c] = await call("POST", "/v1/payments/checkouts", { ...body, order_id: "O-102" }, A.key); ok("رابط دفع غير https من المزوّد مرفوض", c === 502);
/* الإشعارات */
const hookUrl = (await call("POST", "/v1/payments/setup", {}, A.key))[1].webhook_url, hp = new URL(hookUrl).pathname;
const ev = (type, id, amount, eid) => JSON.stringify({ id: eid, entity: "event", type, data: { id, entity: "checkout", amount, status: type.split(".")[1] } });
const post = async (raw, sigOverride, path = hp) => { const sig = sigOverride ?? await hmacHex("test_sk_abc", raw); return call("POST", path, raw, null, {}, { signature: sig, "content-type": "application/json" }); };
[c] = await call("POST", hp, ev("checkout.paid", "chk_2", 5000, "e1"), null); ok("بلا signature 400", c === 400);
[c] = await post(ev("checkout.paid", "chk_2", 5000, "e1"), "deadbeef"); ok("توقيع خاطئ 403", c === 403);
[c] = await post(ev("checkout.paid", "chk_2", 5000, "e1"), null, "/v1/payments/hook/nope"); ok("رابط مجهول 401", c === 401);
[c, b] = await post(ev("checkout.paid", "chk_2", 4999, "e0")); ok("مبلغ لا يطابق: لا تأكيد", b.mismatch === true && sql("SELECT status s FROM pay_checkouts WHERE ext_id='chk_2'").s === "pending");
[c, b] = await post(ev("checkout.paid", "chk_2", 5000, "e1")); ok("إشعار مدفوع صحيح", c === 200 && b.event === "payment.confirmed" && sql("SELECT status s FROM pay_checkouts WHERE ext_id='chk_2'").s === "paid", b);
[c, b] = await post(ev("checkout.paid", "chk_2", 5000, "e1")); ok("إعادة نفس الإشعار: مكرر بلا حدث ثانٍ", b.duplicate === true && sqlAll("SELECT id FROM pf_events WHERE type='payment.confirmed'").length === 1);
[c, b] = await post(ev("checkout.failed", "chk_1", 4500, "e2")); ok("فشل الدفع يُسجَّل ويصدر payment.failed", b.event === "payment.failed" && sqlAll("SELECT id FROM pf_events WHERE type='payment.failed'").length === 1);
[c, b] = await post(ev("checkout.canceled", "chk_unknown", 1, "e3")); ok("جلسة مجهولة تُتجاهل", b.ignored === "unknown_checkout");
[c, b] = await post(JSON.stringify({ type: "customer.created", data: { id: "z" } })); ok("نوع حدث آخر يُتجاهل", b.ignored === true);
[c] = await call("POST", "/v1/payments/checkouts", { ...body, amount: 5000 }, A.key); ok("طلب مدفوع لا يُنشأ له رابط جديد 409", c === 409);
[, b] = await call("GET", "/v1/payments/checkouts/O-100", null, A.key); ok("حالة الطلب: paid=true", b.paid === true && b.checkouts.length === 2, b);
[, b] = await call("GET", "/v1/payments/checkouts/O-100", null, B.key); ok("عزل المستأجرين", b.checkouts.length === 0);
/* أحداث payment.confirmed تصل لبقية الوحدات */
await app.cron(); ok("الحدث في صندوق الأحداث بمعرّف الطلب", JSON.parse(sql("SELECT payload p FROM pf_events WHERE type='payment.confirmed'").p).order_id === "O-100");
/* وضع الاختبار */
const [, tk] = await adm("POST", `/admin/tenants/${B.id}/keys`, { scopes: ["*"], mode: "test" }); fake.calls.length = 0;
[c, b] = await call("POST", "/v1/payments/checkouts", body, tk.key); ok("وضع الاختبار: وهمي بلا اتصال", c === 201 && b.sandbox === true && fake.calls.length === 0);
done();
