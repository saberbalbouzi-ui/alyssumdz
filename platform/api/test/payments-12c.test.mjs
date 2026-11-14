/* المرحلة 12C — الدفع الرقمي (Worker): ⚠ LOCAL ONLY — Chargily وهمي (fetch محاكى) وقاعدة SQLite داخل الذاكرة؛ لا Chargily sandbox ولا Worker حقيقي (BLOCKED).
   يكمّل payments.test.mjs وdigital-vault.test.mjs: عملة غير متوقعة، بيانات ناقصة، إلغاء ثم مدفوع، توقيع مُعاد استعماله لجسم آخر، إثبات الدفع لا يؤكّد الدفع، موافقة بالمفتاح العام مرفوضة، ربط الإثبات بمستأجر الطلب. */
import { makeEnv, Tally } from "./_harness.mjs";
import { digital } from "../src/modules/digital.js";
import { payments } from "../src/modules/payments.js";
import { commerce } from "../src/modules/commerce.js";
import { wallet } from "../src/modules/wallet.js";
import { hmacHex } from "../src/util.js";
const { ok, done } = Tally();
const E = makeEnv([digital, payments, commerce, wallet], { providers: ["email", "chargily", "whatsapp"] }); const { call, adm, tenant, fake, app, sql, sqlAll } = E;
const A = await tenant("A"), B = await tenant("B");
const O = { origin: "https://shop.example" };
for (const T of [A, B]) await adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"], lang: "ar" } });
const pk = async T => (await adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create", "payment:proof", "payment:init"], mode: "pub" }))[1].key; const PKA = await pk(A), PKB = await pk(B);
const JPG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(1)]).toString("base64");
for (const T of [A, B]) { await call("PUT", "/v1/catalog/products", { products: [{ slug: "ebook", title: "كتاب", price: 800 }] }, T.key); await call("PUT", "/v1/integrations/chargily", { config: { mode: "test" }, secrets: { secret_key: "test_sk_" + T.id } }, T.key); await call("POST", "/v1/digital/assets", { sku: "ebook", name: "الكتاب", location: "https://f.example/book.pdf" }, T.key); }
const order = (ref, pay = "baridimob") => ({ ref, customer: { name: "زبون", phone: "0550123456", email: "b@x.dz" }, items: [{ slug: "ebook", qty: 1, price: 800 }], subtotal: 800, discount: 0, fee: 0, total: 800, pay });
let [c, b] = await call("POST", "/v1/orders", order("PAY-12C-1", "chargily"), PKA, {}, O); await app.cron(); ok("[P0] طلب رقمي بدفع chargily سُجّل (للاختبارات التالية)", c === 201, { c, b });
fake.handler = (url, init) => { fake.last = { url, init }; return [200, { id: "chk_c1", checkout_url: "https://pay.chargily.dz/test/checkouts/chk_c1/pay", status: "pending" }]; };
[c, b] = await call("POST", "/v1/payments/pay", { order_id: "PAY-12C-1", method: "edahabia", locale: "ar", return_url: "https://shop.example/p/ebook/" }, PKA, {}, O); ok("[P0] بدء الدفع: المبلغ من الطلب الموثَّق (800) لا من الزبون", c === 201 && JSON.parse(fake.last?.init?.body ?? "{}").amount === 800, { c, b });
const hp = new URL((await call("POST", "/v1/payments/setup", {}, A.key))[1].webhook_url).pathname;
const evj = (type, id, extra = {}, eid = "evt-" + Math.random().toString(36).slice(2, 8)) => JSON.stringify({ id: eid, entity: "event", type, data: { id, entity: "checkout", amount: 800, currency: "dzd", status: type.split(".")[1], ...extra } });
const hook = async (raw, sig) => call("POST", hp, raw, null, {}, { signature: sig ?? await hmacHex("test_sk_" + A.id, raw), "content-type": "application/json" });
const evts = () => sqlAll("SELECT type FROM pf_events WHERE tenant_id=?", A.id).map(r => r.type).filter(t => t.startsWith("payment."));
/* عملة غير متوقعة */
let raw = evj("checkout.paid", "chk_c1", { currency: "usd" }); [c, b] = await hook(raw);
ok("[P1] إشعار paid بعملة غير DZD (نفس المبلغ) ← لا تأكيد (mismatch)", c === 200 && b.mismatch === true && !evts().includes("payment.confirmed") && sql("SELECT status s FROM pay_checkouts WHERE ext_id='chk_c1'").s === "pending", { c, b, evts: evts() });
/* بيانات ناقصة */
raw = evj("checkout.paid", "chk_c1", { amount: undefined }); [c, b] = await hook(raw); ok("[P2] إشعار paid بلا مبلغ ← لا تأكيد", !evts().includes("payment.confirmed") && b.mismatch === true, { c, b });
raw = JSON.stringify({ id: "e-x", type: "checkout.paid", data: {} }); [c, b] = await hook(raw); ok("[P3] إشعار بلا data.id ← يُتجاهل بلا أثر", c === 200 && b.ignored === true && !evts().includes("payment.confirmed"));
raw = JSON.stringify({ id: "e-y", type: "checkout.paid" }); [c, b] = await hook(raw); ok("[P3] إشعار بلا data ← يُتجاهل", c === 200 && b.ignored === true);
/* توقيع مُعاد استعماله لجسم آخر */
const good = evj("checkout.paid", "chk_c1", {}, "evt-good"), sigGood = await hmacHex("test_sk_" + A.id, good), tampered = evj("checkout.paid", "chk_c1", { amount: 1 }, "evt-good"); [c] = await hook(tampered, sigGood); ok("[P4] توقيع صالح لجسم آخر (تلاعب بالمبلغ) ← 403", c === 403);
/* توقيع بمفتاح مستأجر آخر */
[c] = await hook(good, await hmacHex("test_sk_" + B.id, good)); ok("[P5] توقيع بمفتاح مستأجر آخر ← 403", c === 403);
/* ما زال الطلب غير مؤكَّد قبل الإشعار الصحيح؛ «عودة العميل» لا تغيّر حالة الخادم */
[c, b] = await call("GET", "/v1/payments/checkouts/PAY-12C-1", null, A.key); ok("[P6] قبل الإشعار الموقَّع الصحيح: paid=false (لا أثر لأي عودة من المتصفح)", b.paid === false && !evts().includes("payment.confirmed"), b);
/* إلغاء ثم إشعار صحيح لاحق */
[c, b] = await hook(evj("checkout.canceled", "chk_c1", {}, "evt-cancel")); ok("[P7] إلغاء الدفع ← payment.cancelled وحالة canceled", c === 200 && evts().includes("payment.cancelled") && sql("SELECT status s FROM pay_checkouts WHERE ext_id='chk_c1'").s === "canceled", { c, b });
[c, b] = await hook(good); ok("[P8] إشعار مدفوع صحيح موقَّع بالمبلغ والعملة الصحيحين ← تأكيد وحيد", c === 200 && b.event === "payment.confirmed" && evts().filter(t => t === "payment.confirmed").length === 1, { c, b });
[c, b] = await hook(good); ok("[P9] إعادة إرسال الإشعار نفسه ← duplicate بلا حدث ثانٍ", c === 200 && b.duplicate === true && evts().filter(t => t === "payment.confirmed").length === 1);
[c, b] = await hook(evj("checkout.canceled", "chk_c1", {}, "evt-late-cancel")); ok("[P10] إلغاء متأخر بعد الدفع ← يُتجاهل (المدفوع نهائي)", b.duplicate === true && sql("SELECT status s FROM pay_checkouts WHERE ext_id='chk_c1'").s === "paid");
[c, b] = await call("GET", "/v1/payments/checkouts/PAY-12C-1", null, A.key); ok("[P11] بعد الإشعار: paid=true", b.paid === true);
/* إثبات الدفع اليدوي */
[c, b] = await call("POST", "/v1/orders", order("PAY-12C-2", "baridimob"), PKA, {}, O); await app.cron();
const proof = (T, oid, p = JPG) => call("POST", "/v1/payments/proof", { order_id: oid, method: "baridimob", proof: p, payer: "x" }, T, {}, O);
[c, b] = await proof(PKB, "PAY-12C-2"); ok("[P12] إثبات من مستأجر آخر لطلب ليس له ← 404 (لا ربط عابر)", c === 404, { c });
[c, b] = await proof(PKA, "PAY-12C-2"); ok("[P13] رفع إثبات صحيح ← 201 pending", c === 201 && b.status === "pending", { c, b });
const before = evts().filter(t => t === "payment.confirmed").length;
ok("[P14] رفع الصورة لا يؤكّد الدفع: لا payment.confirmed ولا paid", evts().filter(t => t === "payment.confirmed").length === before && (await call("GET", "/v1/payments/checkouts/PAY-12C-2", null, A.key))[1].paid === false);
const pid = b.id; [c] = await call("POST", `/v1/payments/manual/${pid}/approve`, {}, PKA, {}, O); ok("[P15] الموافقة بالمفتاح العام (متصفح الزبون) ← مرفوضة (403/401)", c === 403 || c === 401, { c });
[c, b] = await proof(PKA, "PAY-12C-2"); ok("[P16] إعادة الرفع: يُستبدل السابق (superseded)", c === 201 && sql("SELECT state s FROM pay_manual WHERE id=?", pid).s === "superseded");
let last = 0; for (let i = 0; i < 4; i++) { const r = await proof(PKA, "PAY-12C-2"); last = r[0]; } ok("[P17] تجاوز عدد المحاولات (4) ← 429", last === 429, { last });
const pend = sql("SELECT id i FROM pay_manual WHERE order_id='PAY-12C-2' AND state='pending'")?.i; if (pend) { [c] = await call("POST", `/v1/payments/manual/${pend}/approve`, {}, A.key); ok("[P18] موافقة إدارية فعلية (مفتاح المتجر السرّي) ← payment.confirmed", c === 200 && evts().filter(t => t === "payment.confirmed").length === before + 1, { c }); }
[c] = await call("POST", `/v1/payments/manual/${pend}/approve`, {}, B.key); ok("[P19] موافقة من مستأجر آخر على إثبات ليس له ← 404", c === 404);
[c, b] = await call("POST", "/v1/payments/pay", { order_id: "PAY-12C-1", method: "edahabia", locale: "ar", return_url: "https://shop.example/p/ebook/" }, PKA, {}, O); ok("[P20] طلب مدفوع لا يُنشأ له دفع جديد (409 already_paid)", c === 409);
[c] = await call("POST", "/v1/payments/pay", { order_id: "PAY-12C-1", method: "edahabia", locale: "ar", return_url: "https://evil.example/x" }, PKA, {}, O); ok("[P21] return_url من أصل غير مسجَّل ← 400", c === 400);
done();
