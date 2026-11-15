/* رقعة التدقيق — شحن المحفظة عبر إشعار Chargily «مدفوع»: العملة الصريحة DZD إلزامية. ⚠ LOCAL ONLY: Chargily وهمي، D1 محاكاة؛ لا sandbox حقيقي (BLOCKED).
   قبل الرقعة: wallet.js يقارن المبلغ فقط ← عملة غائبة/أجنبية بمبلغ مطابق كانت تقيّد الرصيد. */
import { makeEnv, Tally } from "./_harness.mjs";
import { wallet } from "../src/modules/wallet.js";
import { hmacHex } from "../src/util.js";
const { ok, done } = Tally(); const SECRET = "test_sk_platform_cur";
const E = makeEnv([wallet], { config: { CHARGILY_SECRET_KEY: SECRET, CHARGILY_MODE: "test" } }); const { call, adm, tenant, fake, sql, sqlAll } = E; const T = await tenant("Supplier");
await adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"] } });
const bal = () => sql("SELECT balance b FROM wl_accounts WHERE tenant_id=? AND code='available' AND currency='DZD'", T.id)?.b ?? 0, st = id => sql("SELECT status s FROM wl_deposits WHERE id=?", id).s;
let n = 0; const dep = async (amount = 5000) => { const cid = "chk_wcur_" + (++n); fake.handler = () => [200, { id: cid, checkout_url: `https://pay.chargily.dz/test/checkouts/${cid}/pay` }]; const [c, b] = await call("POST", "/v1/wallet/deposits", { amount, method: "chargily", return_url: "https://shop.example/w" }, T.key); if (c !== 201) throw new Error("deposit " + c); return { id: b.id, cid }; };
const send = async (cid, data, eid) => { const raw = JSON.stringify({ id: eid, type: "checkout.paid", data: { id: cid, ...data } }); return call("POST", "/v1/wallet/chargily-webhook", raw, null, {}, { signature: await hmacHex(SECRET, raw) }); };
const mm = () => sqlAll("SELECT payload p FROM pf_events WHERE type='wallet.deposit_mismatch'").map(r => JSON.parse(r.p));
const d1 = await dep(); let i = 0;
for (const [lab, data, seen] of [["usd (مبلغ مطابق)", { amount: 5000, currency: "usd" }, "usd"], ["غائبة", { amount: 5000 }, "missing"], ["null", { amount: 5000, currency: null }, "missing"], ["فارغة", { amount: 5000, currency: "" }, "empty"], ["رقم", { amount: 5000, currency: 12 }, "invalid_type"], ["كائن", { amount: 5000, currency: { c: "dzd" } }, "invalid_type"], ["مصفوفة", { amount: 5000, currency: ["dzd"] }, "invalid_type"], ["منطقي", { amount: 5000, currency: true }, "invalid_type"], ["« dzd » بمسافات", { amount: 5000, currency: " dzd " }, "dzd"], ["dzdx", { amount: 5000, currency: "dzdx" }, "dzdx"]]) {
  const m0 = mm().length; const [c, b] = await send(d1.cid, data, "ev-bad-" + (++i));
  ok("[C" + i + "] عملة " + lab + " ← لا قيد: ignored=currency_mismatch، الرصيد 0، الحالة pending", c === 200 && b.ignored === "currency_mismatch" && bal() === 0 && st(d1.id) === "pending", { c, b });
  ok("[C" + i + "] سُجّل wallet.deposit_mismatch برمز عملة منقّى (" + seen + ") وبلا أسرار", mm().some((x) => x.currency === seen) && !JSON.stringify(mm()).includes("test_sk_"), { seen, all: mm().map((x) => x.currency) });   /* الحدث يُزال تكراره لكل (إيداع، سبب) */ }
{ const [c, b] = await send(d1.cid, { amount: 4999, currency: "dzd" }, "ev-amt"); ok("[W] عملة صحيحة ومبلغ خاطئ ← amount_mismatch ولا قيد (المقارنة محفوظة)", c === 200 && b.ignored === "amount_mismatch" && bal() === 0); }
{ const [c, b] = await send(d1.cid, { amount: 5000, currency: "DZD" }, "ev-ok-up"); ok("[V1] DZD كبيرة + مبلغ صحيح ← approved ورصيد 5000", c === 200 && b.status === "approved" && bal() === 5000 && st(d1.id) === "approved", { c, b }); }
{ const [c, b] = await send(d1.cid, { amount: 5000, currency: "dzd" }, "ev-ok-up2"); ok("[D1] إعادة إشعار صحيح بعد الاعتماد ← duplicate بلا قيد ثانٍ", b.duplicate === true && bal() === 5000); }
const d2 = await dep(900); { const [c, b] = await send(d2.cid, { amount: 900, currency: "dzd" }, "ev-ok-low"); ok("[V2] dzd صغيرة + مبلغ صحيح ← approved (5900)", b.status === "approved" && bal() === 5900, { b }); }
const d3 = await dep(1200); { const raw = JSON.stringify({ id: "ev-cancel", type: "checkout.canceled", data: { id: d3.cid, amount: 1200 } }); const [c, b] = await call("POST", "/v1/wallet/chargily-webhook", raw, null, {}, { signature: await hmacHex(SECRET, raw) }); ok("[N1] إلغاء بلا عملة يُعالَج كالسابق (failed)", c === 200 && st(d3.id) === "failed" && bal() === 5900); }
ok("[S1] أمان: لا مفتاح سرّي في الأحداث", !JSON.stringify(sqlAll("SELECT payload p FROM pf_events")).includes("test_sk_"));
done();
