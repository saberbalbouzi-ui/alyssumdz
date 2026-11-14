/* المرحلة 12C (رقعة المراجعة) — إشعار Chargily «مدفوع» يتطلب عملة صريحة DZD. ⚠ LOCAL ONLY: Chargily وهمي، D1 محاكاة بـnode:sqlite؛ لا sandbox حقيقي (BLOCKED).
   قبل الرقعة: ev.data.currency ?? "dzd" ← الغائب كان يُعدّ دينارا. بعدها: نصّ غير فارغ = "dzd" (أي حالة أحرف) وإلا لا تأكيد ولا payment.confirmed. */
import { makeEnv, Tally } from "./_harness.mjs";
import { payments } from "../src/modules/payments.js";
import { commerce } from "../src/modules/commerce.js";
import { hmacHex } from "../src/util.js";
const { ok, done } = Tally();
const E = makeEnv([payments, commerce], { providers: ["chargily"] }); const { call, fake, app, sql, sqlAll, db } = E; const [A] = [await E.tenant("A")];
await call("PUT", "/v1/integrations/chargily", { config: { mode: "test" }, secrets: { secret_key: "test_sk_currency_secret" } }, A.key);
const hook = new URL((await call("POST", "/v1/payments/setup", {}, A.key))[1].webhook_url).pathname;
let n = 0; const mkCheckout = async (orderId, amount = 800) => { const id = "chk_cur_" + (++n); fake.handler = (url, init) => [200, { id, checkout_url: `https://pay.chargily.dz/test/checkouts/${id}/pay` }]; const [c] = await call("POST", "/v1/payments/checkouts", { order_id: orderId, amount, success_url: "https://shop.example/ok", failure_url: "https://shop.example/no" }, A.key); if (c !== 201) throw new Error("checkout " + c); return id; };
const send = async (id, data, evId) => { const raw = JSON.stringify({ id: evId, entity: "event", type: "checkout.paid", data: { id, entity: "checkout", status: "paid", ...data } }); const [c, b] = await call("POST", hook, raw, null, {}, { signature: await hmacHex("test_sk_currency_secret", raw), "content-type": "application/json" }); return [c, b, raw]; };
const status = id => sql("SELECT status s FROM pay_checkouts WHERE ext_id=?", id).s, evs = t => sqlAll("SELECT payload p FROM pf_events WHERE type=?", t).map(r => JSON.parse(r.p)), confirmed = () => evs("payment.confirmed").length;
const cases = [["usd (نفس المبلغ)", { amount: 800, currency: "usd" }, "usd"], ["غائبة", { amount: 800 }, "missing"], ["null", { amount: 800, currency: null }, "missing"], ["نصّ فارغ", { amount: 800, currency: "" }, "empty"], ["مسافات فقط", { amount: 800, currency: "  " }, "empty"], ["رقم", { amount: 800, currency: 12 }, "invalid_type"], ["كائن", { amount: 800, currency: { code: "dzd" } }, "invalid_type"], ["مصفوفة", { amount: 800, currency: ["dzd"] }, "invalid_type"], ["منطقي", { amount: 800, currency: true }, "invalid_type"], ["« dzd » بمسافات", { amount: 800, currency: " dzd " }, "dzd"], ["dzd مع لاحقة", { amount: 800, currency: "dzdx" }, "dzdx"], ["eur", { amount: 800, currency: "eur" }, "eur"]];
const id1 = await mkCheckout("CUR-ORDER-1"); let i = 0;
for (const [lab, data, seen] of cases) { const before = confirmed(), mm = evs("payment.mismatch").length; const [c, b] = await send(id1, data, "ev-bad-" + (++i));
  ok("[C" + i + "] عملة " + lab + " ← لا تأكيد: mismatch، الحالة pending، لا payment.confirmed", c === 200 && b.mismatch === true && status(id1) === "pending" && confirmed() === before, { c, b });
  await app.cron(); const m = evs("payment.mismatch"); ok("[C" + i + "] سُجّل mismatch بآمن: رمز العملة المنقّى فقط (" + seen + ") وبلا أسرار/الجسم", m.length === mm + 1 && m[m.length - 1].currency === seen && !JSON.stringify(m).includes("test_sk_") && !JSON.stringify(m[m.length - 1]).includes("signature"), m[m.length - 1]); }
/* مبلغ خاطئ بعملة صحيحة */
{ const [c, b] = await send(id1, { amount: 799, currency: "dzd" }, "ev-amt-1"); ok("[W] عملة صحيحة ومبلغ خاطئ ← mismatch ولا تأكيد (مقارنة المبلغ محفوظة)", c === 200 && b.mismatch === true && status(id1) === "pending" && confirmed() === 0, { c, b }); }
{ const [c, b] = await send(id1, { currency: "dzd" }, "ev-amt-2"); ok("[W] عملة صحيحة ومبلغ غائب ← mismatch", b.mismatch === true && confirmed() === 0); }
ok("[W] لا payment.confirmed إطلاقاً بعد كل الحالات الفاسدة (14)", confirmed() === 0 && evs("payment.mismatch").length >= 14);
/* صحيح: حروف كبيرة ثم صغيرة (على جلستين) */
{ const [c, b] = await send(id1, { amount: 800, currency: "DZD" }, "ev-ok-upper"); await app.cron(); ok("[V1] DZD بأحرف كبيرة + مبلغ صحيح ← تأكيد وحيد وحالة paid", c === 200 && b.event === "payment.confirmed" && status(id1) === "paid" && confirmed() === 1, { c, b }); }
const id2 = await mkCheckout("CUR-ORDER-2"); { const [c, b] = await send(id2, { amount: 800, currency: "dzd" }, "ev-ok-lower"); await app.cron(); ok("[V2] dzd بأحرف صغيرة + مبلغ صحيح ← تأكيد وحيد", c === 200 && b.event === "payment.confirmed" && status(id2) === "paid" && confirmed() === 2, { c, b }); }
/* تكرار بعد دفع صحيح (نفس الإشعار وإشعار بعملة فاسدة) */
{ const [c, b] = await send(id2, { amount: 800, currency: "dzd" }, "ev-ok-lower"); ok("[D1] إعادة نفس الإشعار الصحيح ← duplicate بلا حدث ثانٍ", c === 200 && b.duplicate === true && confirmed() === 2, { c, b });
  const [c2, b2] = await send(id2, { amount: 800, currency: "usd" }, "ev-after-paid"); ok("[D2] إشعار بعملة فاسدة بعد دفع صحيح ← المدفوع نهائي (لا تغيير ولا حدث تأكيد ثانٍ)", c2 === 200 && b2.duplicate === true && status(id2) === "paid" && confirmed() === 2, { c2, b2 }); }
/* أنواع غير «مدفوع» لا تتطلب عملة (إلغاء/فشل) */
const id3 = await mkCheckout("CUR-ORDER-3"); { const raw = JSON.stringify({ id: "ev-cancel", type: "checkout.canceled", data: { id: id3, amount: 800 } }); const [c] = await call("POST", hook, raw, null, {}, { signature: await hmacHex("test_sk_currency_secret", raw), "content-type": "application/json" }); ok("[N1] إلغاء بلا عملة يُعالَج كالسابق (العملة شرط الدفع فقط)", c === 200 && status(id3) === "canceled"); }
ok("[S1] أمان: لا مفتاح سرّي في أي حدث مُخزَّن", !JSON.stringify(sqlAll("SELECT payload p FROM pf_events")).includes("test_sk_"));
done();
