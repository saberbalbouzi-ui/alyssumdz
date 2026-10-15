/* المحفظة والدفتر: قيد مزدوج متوازن، ضمان (escrow) من حدث دفع موثوق، رسوم المنصة، السحب، رصيد الإعلانات بالدولار، وتعطيل الوحدات لكل مستأجر. */
import { makeEnv, Tally } from "./_harness.mjs";
import { wallet, checkLegs, feeOf } from "../src/modules/wallet.js";
import { payments } from "../src/modules/payments.js";
import { carts } from "../src/modules/carts.js";
import { createHmac } from "node:crypto";
const { ok, done } = Tally();
const E = makeEnv([wallet, payments, carts], { providers: ["chargily"] }); const { call, adm, tenant, app, sql, sqlAll, fake } = E;
const A = await tenant("A"), B = await tenant("B");

/* ── نقي ── */
ok("checkLegs: متوازن", checkLegs([{ code: "aaa", ccy: "DZD", amount: -5 }, { code: "bbb", ccy: "DZD", amount: 5 }]) === "");
ok("checkLegs: غير متوازن/صفري/عملة/رجل واحدة", checkLegs([{ code: "aaa", ccy: "DZD", amount: -5 }, { code: "bbb", ccy: "DZD", amount: 4 }]) !== "" && checkLegs([{ code: "aaa", ccy: "DZD", amount: 0 }, { code: "bbb", ccy: "DZD", amount: 0 }]) !== "" && checkLegs([{ code: "aaa", ccy: "XXX", amount: 1 }, { code: "bbb", ccy: "XXX", amount: -1 }]) !== "" && checkLegs([{ code: "aaa", ccy: "DZD", amount: 1 }]) !== "");
ok("checkLegs: التوازن لكل عملة على حدة", checkLegs([{ code: "aaa", ccy: "DZD", amount: -5 }, { code: "bbb", ccy: "USD", amount: 5 }]) !== "" && checkLegs([{ code: "aaa", ccy: "DZD", amount: -5 }, { code: "bbb", ccy: "DZD", amount: 5 }, { code: "ccc", ccy: "USD", amount: -3 }, { code: "ddd", ccy: "USD", amount: 3 }]) === "");
ok("feeOf: نسبة + ثابت ولا يتجاوز المبلغ", feeOf(1000, { fee_pct: 5 }) === 50 && feeOf(1000, { fee_pct: 5, fee_fixed: 30 }) === 80 && feeOf(100, { fee_pct: 50, fee_fixed: 500 }) === 100 && feeOf(1000, {}) === 0);

const bal = async (k) => (await call("GET", "/v1/wallet", null, k))[1].balances;
const invariant = () => sqlAll("SELECT currency, SUM(balance) s FROM wl_accounts GROUP BY currency").every((x) => x.s === 0);
const legsBalanced = () => sqlAll("SELECT l.tx_id, a.currency, SUM(l.amount) s FROM wl_legs l JOIN wl_accounts a ON a.id=l.account_id GROUP BY l.tx_id, a.currency").every((x) => x.s === 0);
const cron = () => app.cron();

/* ── إيداع بتأكيد الإدارة ── */
let [c, b] = await adm("POST", `/admin/wallet/${A.id}/deposit`, { amount: 50000, ref: "BANK-001", memo: "حوالة" }); ok("إيداع", c === 200 && !b.duplicate, b);
[c, b] = await adm("POST", `/admin/wallet/${A.id}/deposit`, { amount: 50000, ref: "BANK-001" }); ok("نفس المرجع لا يُقيَّد مرتين", c === 200 && b.duplicate === true);
[c] = await adm("POST", `/admin/wallet/${A.id}/deposit`, { amount: -5, ref: "BANK-002" }); ok("مبلغ سالب مرفوض", c === 400);
[c] = await adm("POST", `/admin/wallet/${A.id}/deposit`, { amount: 5, ref: "x" }); ok("مرجع قصير مرفوض", c === 400);
[c] = await adm("POST", `/admin/wallet/999/deposit`, { amount: 5, ref: "BANK-003" }); ok("مستأجر مجهول 404", c === 404);
[c] = await call("GET", "/v1/wallet", null, A.key); ok("قراءة المحفظة", c === 200);
let B1 = await bal(A.key); ok("المتاح 50000", B1.available.DZD === 50000 && B1.escrow.DZD === undefined, B1);
ok("عزل المستأجرين", (await bal(B.key)).available.DZD === undefined);
ok("الدفتر متوازن", invariant() && legsBalanced());

/* ── ضمان: حدث دفع موثوق (من Chargily) ── */
await adm("PUT", `/admin/wallet/${A.id}/settings`, { fee_pct: 10, fee_fixed: 20 });
await call("PUT", "/v1/integrations/chargily", { config: { mode: "test" }, secrets: { secret_key: "sk_test_abcdef" } }, A.key);
const [, st] = await call("POST", "/v1/payments/setup", {}, A.key); const hook = st.webhook_url.split("/").pop();
let chk = 0; fake.handler = (url) => /\/checkouts$/.test(url) ? (chk++, [200, { id: "chk_" + chk, checkout_url: "https://pay.chargily.net/test/checkouts/chk_" + chk }]) : [200, {}];
await call("POST", "/v1/payments/checkouts", { order_id: "W1", amount: 5000, success_url: "https://shop.example/ok" }, A.key);
const hookEv = (id, amount, type = "checkout.paid", eid = "ev1") => { const body = JSON.stringify({ id: eid, type, data: { id, amount } }); return call("POST", `/v1/payments/hook/${hook}`, body, null, {}, { signature: createHmac("sha256", "sk_test_abcdef").update(body).digest("hex") }); };
[c] = await hookEv("chk_1", 5000); ok("إشعار دفع صحيح", c === 200); await cron();
let es = (await call("GET", "/v1/wallet/escrow", null, A.key))[1].escrow; ok("الضمان يُحجز 5000", es.length === 1 && es[0].order_id === "W1" && es[0].amount === 5000, es);
B1 = await bal(A.key); ok("escrow=5000 والمتاح لم يتغير", B1.escrow.DZD === 5000 && B1.available.DZD === 50000);
ok("الدفتر متوازن بعد الحجز", invariant() && legsBalanced());
await cron(); es = (await call("GET", "/v1/wallet/escrow", null, A.key))[1].escrow; ok("إعادة المعالجة لا تضاعف الحجز", es.length === 1 && (await bal(A.key)).escrow.DZD === 5000);

/* تاجر يختلق payment.confirmed عبر /v1/events: لا ضمان ولا مال */
await call("POST", "/v1/events", { type: "payment.confirmed", id: "FAKE1", data: { order_id: "FAKE1", amount: 999999, currency: "DZD" } }, A.key); await cron();
ok("حدث دفع مُدخَل من التاجر لا يخلق ضمانا", sql("SELECT COUNT(*) n FROM wl_escrow WHERE order_id='FAKE1'").n === 0 && (await bal(A.key)).escrow.DZD === 5000);

/* تسليم: تحرير بعد الرسم (10% + 20 = 520) */
await call("POST", "/v1/events", { type: "order.delivered", id: "W1", data: { order_id: "W1" } }, A.key); await cron();
B1 = await bal(A.key); ok("بعد التسليم: escrow 0 والمتاح 50000+4480", (B1.escrow.DZD ?? 0) === 0 && B1.available.DZD === 54480, B1);
ok("رسم المنصة 520 في حساب النظام", sql("SELECT balance b FROM wl_accounts WHERE tenant_id=0 AND code='platform_fees' AND currency='DZD'").b === 520);
const e0 = sql("SELECT state, fee FROM wl_escrow WHERE order_id='W1'"); ok("حالة الضمان released بالرسم", e0.state === "released" && e0.fee === 520);
await call("POST", "/v1/events", { type: "order.delivered", id: "W1b", data: { order_id: "W1" } }, A.key); await cron();
ok("تسليم مكرر لا يحرّر مرتين", (await bal(A.key)).available.DZD === 54480 && invariant() && legsBalanced());

/* إلغاء بعد الدفع ← استرداد مستحق، وترتيب معكوس: النهائي يصل قبل الدفع */
await call("POST", "/v1/events", { type: "order.cancelled", id: "W2", data: { order_id: "W2" } }, A.key); await cron();
await call("POST", "/v1/payments/checkouts", { order_id: "W2", amount: 3000, success_url: "https://shop.example/ok" }, A.key);
await hookEv("chk_2", 3000, "checkout.paid", "ev2"); await cron(); await cron();
ok("الإلغاء السابق للدفع: الضمان يُسترد تلقائياً (refunded) لا يعلق", sql("SELECT state FROM wl_escrow WHERE order_id='W2'")?.state === "refunded", sqlAll("SELECT order_id,state FROM wl_escrow"));
ok("حدث wallet.refund_due صدر", sql("SELECT COUNT(*) n FROM pf_events WHERE type='wallet.refund_due'").n === 1);
ok("الدفتر متوازن بعد الاسترداد", invariant() && legsBalanced() && ((await bal(A.key)).escrow.DZD ?? 0) === 0);

/* ── سحب ── */
const wd = { amount: 20000, method: "ccp", destination: "0012345678 clé 12" };
[c] = await call("POST", "/v1/wallet/withdrawals", { ...wd, amount: 100 }, A.key); ok("تحت الحد الأدنى 400", c === 400);
[c] = await call("POST", "/v1/wallet/withdrawals", { ...wd, method: "cash" }, A.key); ok("وسيلة غير معروفة 400", c === 400);
[c] = await call("POST", "/v1/wallet/withdrawals", { ...wd, amount: 900000 }, A.key); ok("أكبر من المتاح 409 ولا أثر", c === 409 && sql("SELECT COUNT(*) n FROM wl_withdrawals").n === 0, sqlAll("SELECT * FROM wl_withdrawals"));
[c, b] = await call("POST", "/v1/wallet/withdrawals", wd, A.key); ok("طلب سحب", c === 201 && b.status === "requested"); const wid = b.id;
B1 = await bal(A.key); ok("المبلغ محجوز: المتاح 34480 والمحجوز 20000", B1.available.DZD === 34480 && B1.withdraw_hold.DZD === 20000, B1);
ok("الوجهة مشفّرة في القاعدة", !JSON.stringify(sql("SELECT * FROM wl_withdrawals")).includes("0012345678"));
[, b] = await adm("GET", "/admin/wallet/withdrawals/list"); ok("الإدارة ترى الوجهة مفكوكة", b.withdrawals.length === 1 && b.withdrawals[0].destination === wd.destination, b);
[c] = await call("DELETE", `/v1/wallet/withdrawals/${wid}`, null, B.key); ok("مستأجر آخر لا يلغي 404", c === 404);
[c] = await adm("POST", `/admin/wallet/withdrawals/${wid}/approve`, {}); ok("اعتماد", c === 200);
[c] = await call("DELETE", `/v1/wallet/withdrawals/${wid}`, null, A.key); ok("بعد الاعتماد لا إلغاء 409", c === 409);
[c] = await adm("POST", `/admin/wallet/withdrawals/${wid}/pay`, {}); ok("صرف", c === 200);
[c] = await adm("POST", `/admin/wallet/withdrawals/${wid}/pay`, {}); ok("صرف مرتين 409", c === 409);
B1 = await bal(A.key); ok("بعد الصرف: المحجوز 0 والمتاح 34480", (B1.withdraw_hold.DZD ?? 0) === 0 && B1.available.DZD === 34480, B1);
ok("المبلغ خرج للعالم الخارجي ext_payouts=20000", sql("SELECT balance b FROM wl_accounts WHERE tenant_id=0 AND code='ext_payouts'").b === 20000);
[, b] = await call("POST", "/v1/wallet/withdrawals", { ...wd, amount: 5000 }, A.key); const w2 = b.id;
[c] = await adm("POST", `/admin/wallet/withdrawals/${w2}/reject`, { note: "بيانات خاطئة" }); ok("رفض", c === 200); B1 = await bal(A.key); ok("الرفض يعيد المبلغ للمتاح", B1.available.DZD === 34480 && (B1.withdraw_hold.DZD ?? 0) === 0, B1);
[, b] = await call("POST", "/v1/wallet/withdrawals", { ...wd, amount: 2000 }, A.key); [c] = await call("DELETE", `/v1/wallet/withdrawals/${b.id}`, null, A.key); ok("إلغاء طلب لم يُراجَع", c === 200 && (await bal(A.key)).available.DZD === 34480);
ok("الدفتر متوازن بعد السحب", invariant() && legsBalanced());

/* ── رصيد الإعلانات بالدولار ── */
[c, b] = await call("GET", "/v1/wallet/ads-quote", null, A.key, { usd: "50" }); ok("بلا سعر صرف 409", c === 409 && b.error.code === "rate_not_set");
await adm("PUT", `/admin/wallet/${A.id}/settings`, { usd_rate: 260 });
[, b] = await call("GET", "/v1/wallet/ads-quote", null, A.key, { usd: "50" }); ok("عرض سعر: 50$ = 13000 دج", b.dzd === 13000 && b.usd === 50, b);
[c] = await call("POST", "/v1/wallet/ads-topup", { usd: 0.5 }, A.key); ok("أقل من 1$ مرفوض", c === 400);
[c] = await call("POST", "/v1/wallet/ads-topup", { usd: 50 }, A.key); ok("شراء 50$", c === 201);
B1 = await bal(A.key); ok("المتاح 21480 ورصيد الإعلانات 5000 سنت", B1.available.DZD === 21480 && B1.ads_credit.USD === 5000, B1);
ok("فارق العملات يمرّ عبر fx_clearing وكل عملة متوازنة", invariant() && legsBalanced());
[c] = await call("POST", "/v1/wallet/ads-topup", { usd: 500 }, A.key); ok("لا رصيد كافٍ لشراء 500$ → 409 بلا أثر", c === 409 && (await bal(A.key)).ads_credit.USD === 5000 && invariant());
[c] = await adm("POST", `/admin/wallet/${A.id}/ads-spend`, { usd: 20, ref: "BM-2026-10-A" }); ok("قيد إنفاق Master BM", c === 200); B1 = await bal(A.key); ok("الرصيد 3000 سنت", B1.ads_credit.USD === 3000, B1);
[c] = await adm("POST", `/admin/wallet/${A.id}/ads-spend`, { usd: 100, ref: "BM-2026-10-B" }); ok("إنفاق أكبر من الرصيد 409", c === 409);
[c, b] = await adm("POST", `/admin/wallet/${A.id}/ads-spend`, { usd: 20, ref: "BM-2026-10-A" }); ok("المرجع نفسه لا يُقيَّد مرتين", c === 200 && b.duplicate === true && (await bal(A.key)).ads_credit.USD === 3000);

/* ── اشتراك/رسم ── */
[c] = await adm("POST", `/admin/wallet/${A.id}/fee`, { amount: 4000, ref: "SUB-2026-10", kind: "subscription" }); ok("خصم الاشتراك", c === 200 && (await bal(A.key)).available.DZD === 17480);
[c] = await adm("POST", `/admin/wallet/${B.id}/fee`, { amount: 4000, ref: "SUB-2026-10" }); ok("لا اشتراك بلا رصيد 409", c === 409);

/* ── دفتر وملخص ── */
[, b] = await call("GET", "/v1/wallet/ledger", null, A.key, { limit: "5" }); ok("الدفتر بأرجل متوازنة وترقيم", b.entries.length === 5 && b.next && b.entries.every((x) => x.legs.reduce((a, l) => a + (l.currency === "DZD" ? l.amount : 0), 0) === 0 && x.legs.reduce((a, l) => a + (l.currency === "USD" ? l.amount : 0), 0) === 0), b.entries[0]);
[, b] = await call("GET", "/v1/wallet/ledger", null, A.key, { kind: "deposit" }); ok("تصفية kind", b.entries.length === 1 && b.entries[0].kind === "deposit");
[, b] = await adm("GET", "/admin/wallet/summary"); ok("ملخص الإدارة: متوازن ورسوم المنصة", b.balanced === true && b.platform_fees.find((x) => x.currency === "DZD").balance === 4520, b);
[c] = await call("GET", "/admin/wallet/summary", null, A.key); ok("المستأجر لا يدخل الإدارة 401", c === 401);
[c] = await call("POST", "/v1/wallet/withdrawals", wd, (await tenant("R", ["wallet:read"])).key); ok("نطاق القراءة لا يطلب سحباً 403", c === 403);
const T = await tenant("T", ["*"], "test"); [c, b] = await call("POST", "/v1/wallet/withdrawals", wd, T.key); ok("مفتاح الاختبار sandbox بلا أثر", c === 201 && b.sandbox === true && sql("SELECT COUNT(*) n FROM wl_withdrawals WHERE tenant_id=?", T.id).n === 0);

/* ── تعطيل الوحدات لكل مستأجر (Core): الباقي يعمل ── */
[, b] = await call("GET", "/v1/modules", null, A.key); ok("قائمة الوحدات تشمل wallet والنواة", b.modules.some((m) => m.id === "wallet" && m.enabled) && b.modules.find((m) => m.id === "admin").core === true, b);
[c] = await adm("PUT", `/admin/tenants/${A.id}/modules`, { off: ["admin"] }); ok("لا تعطيل للنواة 400", c === 400);
[c] = await adm("PUT", `/admin/tenants/${A.id}/modules`, { off: ["nope"] }); ok("وحدة مجهولة 400", c === 400);
[c] = await adm("PUT", `/admin/tenants/${A.id}/modules`, { off: ["wallet"] }); ok("تعطيل wallet", c === 200);
[c, b] = await call("GET", "/v1/wallet", null, A.key); ok("مسار المحفظة 403 module_disabled", c === 403 && b.error.code === "module_disabled", b);
[c] = await call("GET", "/v1/carts/stats", null, A.key); ok("وحدة السلال تعمل دون المحفظة", c === 200);
const before = (await call("GET", "/v1/wallet", null, B.key))[0]; ok("مستأجر آخر لم يتأثر", before === 200);
await call("POST", "/v1/events", { type: "order.delivered", id: "OFF1", data: { order_id: "OFF1" } }, A.key); await cron();
ok("المحفظة المعطّلة لا تستقبل أحداث المستأجر", sql("SELECT COUNT(*) n FROM wl_orders WHERE order_id='OFF1'").n === 0 && sql("SELECT state FROM pf_events WHERE ext_id='order.delivered:OFF1'").state === "done");
await adm("PUT", `/admin/tenants/${A.id}/modules`, { off: [] }); [c] = await call("GET", "/v1/wallet", null, A.key); ok("إعادة التفعيل", c === 200);
[c, b] = await adm("GET", "/admin/wallet/tenants"); ok("قائمة المستأجرين بأرصدتهم", c === 200 && Array.isArray(b.tenants) && b.tenants.some((t) => t.id === A.id && t.balances.available && "pending_withdrawals" in t), b);
[c] = await call("GET", "/admin/wallet/tenants", null, A.key); ok("مفتاح التاجر لا يقرأ قائمة الإدارة", c === 401 || c === 403, c);
ok("الدفتر متوازن في النهاية", invariant() && legsBalanced());
done();
