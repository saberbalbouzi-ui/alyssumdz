/* أحداث الشحن من بوابة الشحن إلى ناقل المنصة: POST /admin/events (extId «gw:»)، وتحرير الضمان من التسليم الموثوق (require_carrier). */
import { makeEnv, Tally } from "./_harness.mjs";
import { wallet } from "../src/modules/wallet.js";
import { payments } from "../src/modules/payments.js";
import { createHmac } from "node:crypto";
const { ok, done } = Tally();
const E = makeEnv([wallet, payments], { providers: ["chargily"] }); const { call, adm, tenant, app, sql, fake } = E;
const A = await tenant("A", ["*"], "live", "site-a"), B = await tenant("B", ["*"], "live", "site-b");
const bal = async (k) => (await call("GET", "/v1/wallet", null, k))[1].balances;
const cron = () => app.cron();

/* ── المدخل: صلاحية + تحقق ── */
let [c, b] = await call("POST", "/admin/events", { site_ref: "site-a", type: "order.delivered", id: "x1", data: { order_id: "O1" } }, A.key); ok("مفتاح التاجر لا يدخل /admin/events", c === 401 || c === 403, c);
[c] = await adm("POST", "/admin/events", { site_ref: "site-a", type: "order.created", id: "x1", data: { order_id: "O1" } }); ok("نوع غير شحني مرفوض", c === 400);
[c] = await adm("POST", "/admin/events", { site_ref: "site-a", type: "order.delivered", data: { order_id: "O1" } }); ok("id مطلوب", c === 400);
[c] = await adm("POST", "/admin/events", { site_ref: "site-a", type: "order.delivered", id: "x1", data: {} }); ok("data.order_id مطلوب", c === 400);
[c] = await adm("POST", "/admin/events", { site_ref: "nope", type: "order.delivered", id: "x1", data: { order_id: "O1" } }); ok("موقع مجهول 404", c === 404);
[c, b] = await adm("POST", "/admin/events", { site_ref: "site-a", type: "order.shipped", id: "ship:O1", data: { order_id: "O1", tracking: "T1" } }); ok("حدث شحن مقبول", c === 202 && b.accepted === true, b);
[c, b] = await adm("POST", "/admin/events", { site_ref: "site-a", type: "order.shipped", id: "ship:O1", data: { order_id: "O1" } }); ok("نفس المعرّف لا يتكرر", c === 200 && b.duplicate === true);
const ev = sql("SELECT ext_id, tenant_id, payload FROM pf_events WHERE type='order.shipped'");
ok("extId يبدأ بـgw: والمستأجر صحيح ومصدر carrier", ev.ext_id === "gw:ship:O1" && ev.tenant_id === A.id && JSON.parse(ev.payload).source === "carrier", ev);
[c, b] = await call("POST", "/v1/events", { type: "order.delivered", id: "O9", data: { order_id: "O9" } }, A.key); ok("حدث التاجر يبقى extId بلا gw:", sql("SELECT ext_id FROM pf_events WHERE type='order.delivered'").ext_id === "order.delivered:O9");

/* ── الضمان: بدون require_carrier يكفي حدث التاجر؛ معه لا يكفي ── */
await adm("PUT", `/admin/wallet/${A.id}/settings`, { fee_pct: 10 });
await call("PUT", "/v1/integrations/chargily", { config: { mode: "test" }, secrets: { secret_key: "sk_test_abcdef" } }, A.key);
const [, st] = await call("POST", "/v1/payments/setup", {}, A.key); const hook = st.webhook_url.split("/").pop();
let chk = 0; fake.handler = (url) => /\/checkouts$/.test(url) ? (chk++, [200, { id: "chk_" + chk, checkout_url: "https://pay.chargily.net/test/checkouts/chk_" + chk }]) : [200, {}];
const pay = async (oid, amount) => { await call("POST", "/v1/payments/checkouts", { order_id: oid, amount, success_url: "https://shop.example/ok" }, A.key); const id = "chk_" + chk, body = JSON.stringify({ id: "ev_" + id, type: "checkout.paid", data: { id, amount } }); await call("POST", `/v1/payments/hook/${hook}`, body, null, {}, { signature: createHmac("sha256", "sk_test_abcdef").update(body).digest("hex") }); await cron(); };
await pay("P1", 1000);
let w = await bal(A.key); ok("P1 محجوز", w.escrow.DZD === 1000, w);
await call("POST", "/v1/events", { type: "order.delivered", id: "P1", data: { order_id: "P1" } }, A.key); await cron();
w = await bal(A.key); ok("الوضع الافتراضي: حدث التاجر يحرّر الضمان (سلوك v1.89.234 محفوظ)", (w.escrow.DZD ?? 0) === 0 && w.available.DZD === 900, w);

await adm("PUT", `/admin/wallet/${A.id}/settings`, { require_carrier: true });
ok("الإعداد يظهر في ملخص المحفظة", (await adm("GET", `/admin/wallet/${A.id}`))[1].settings.require_carrier === true);
await pay("P2", 2000);
await call("POST", "/v1/events", { type: "order.delivered", id: "P2", data: { order_id: "P2" } }, A.key); await cron();
w = await bal(A.key); ok("require_carrier: تسليم التاجر لا يحرّر", w.escrow.DZD === 2000 && w.available.DZD === 900, w);
ok("لم يُسجَّل نتيجة نهائية من التاجر", sql("SELECT COUNT(*) n FROM wl_orders WHERE order_id='P2'").n === 0);
[c] = await adm("POST", "/admin/events", { site_ref: "site-a", type: "order.delivered", id: "deliv:P2", data: { order_id: "P2" } }); await cron();
w = await bal(A.key); ok("تسليم البوابة يحرّر (2000 − 10% = 1800)", c === 202 && (w.escrow.DZD ?? 0) === 0 && w.available.DZD === 2700, w);

/* ── مرتجع من البوابة ← استرداد مستحق ── */
await pay("P3", 500);
await adm("POST", "/admin/events", { site_ref: "site-a", type: "order.returned", id: "ret:P3", data: { order_id: "P3" } }); await cron();
const es = sql("SELECT state FROM wl_escrow WHERE order_id='P3'"); ok("order.returned من البوابة ← refunded", es.state === "refunded", es);

/* ── عزل المستأجرين ── */
ok("حدث A لم يصل B", sql("SELECT COUNT(*) n FROM pf_events WHERE tenant_id=?", B.id).n === 0);
const inv = E.sqlAll("SELECT currency, SUM(balance) s FROM wl_accounts GROUP BY currency").every((x) => x.s === 0); ok("الدفتر متوازن", inv);
done();
