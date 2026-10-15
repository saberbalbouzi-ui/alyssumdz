/* شحن المحفظة (إيداعات): Chargily على حساب المنصة بإشعار موقَّع وتطابق مبلغ، وحوالة CCP بإثبات صورة يوافق عليها المزوّد؛ لا قيد مزدوج ولا اعتماد بلا تحقق. */
import { makeEnv, Tally } from "./_harness.mjs";
import { wallet } from "../src/modules/wallet.js";
import { hmacHex } from "../src/util.js";
const { ok, done } = Tally();
const SECRET = "test_sk_platform";
const E = makeEnv([wallet], { config: { CHARGILY_SECRET_KEY: SECRET, CHARGILY_MODE: "test" } }); const { call, adm, tenant, fake, sql, sqlAll } = E;
const T = await tenant("Supplier"), U = await tenant("Other");
await adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"] } });
const bal = (tid) => sql("SELECT balance b FROM wl_accounts WHERE tenant_id=? AND code='available' AND currency='DZD'", tid)?.b ?? 0;
const JPG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(1)]).toString("base64");
const hook = async (obj, sig) => { const raw = JSON.stringify(obj); return call("POST", "/v1/wallet/chargily-webhook", raw, null, {}, sig === undefined ? { signature: await hmacHex(SECRET, raw) } : sig ? { signature: sig } : {}); };

/* ───── Chargily ───── */
let [c, b] = await call("POST", "/v1/wallet/deposits", { amount: 100, method: "chargily", return_url: "https://shop.example/w" }, T.key); ok("أقل من الحد الأدنى", c === 400);
[c] = await call("POST", "/v1/wallet/deposits", { amount: 5000, method: "paypal" }, T.key); ok("وسيلة غير مدعومة", c === 400);
[c] = await call("POST", "/v1/wallet/deposits", { amount: 5000, method: "chargily", return_url: "https://evil.example/x" }, T.key); ok("return_url خارج أصول الموقع", c === 400);
fake.handler = (u, i) => { fake.last = { u, i, body: JSON.parse(i.body ?? "{}") }; return [200, { id: "chk_1", checkout_url: "https://pay.chargily.dz/test/checkouts/chk_1/pay" }]; };
[c, b] = await call("POST", "/v1/wallet/deposits", { amount: 5000, method: "chargily", return_url: "https://shop.example/w", payment_method: "cib" }, T.key);
ok("جلسة دفع على حساب المنصة بالمبلغ والبيانات", c === 201 && b.checkout_url.includes("chk_1") && fake.last.i.headers.Authorization === "Bearer " + SECRET && fake.last.body.amount === 5000 && fake.last.body.currency === "dzd" && fake.last.body.payment_method === "cib" && fake.last.body.metadata.deposit_id === b.id && fake.last.u.startsWith("https://pay.chargily.net/test/api/v2/checkouts") && fake.last.body.webhook_endpoint === "https://api.example/v1/wallet/chargily-webhook", [c, fake.last]);
const dep1 = b.id;
ok("pending ولا رصيد قبل الدفع", sql("SELECT status s, chargily_checkout_id c FROM wl_deposits WHERE id=?", dep1).s === "pending" && sql("SELECT chargily_checkout_id c FROM wl_deposits WHERE id=?", dep1).c === "chk_1" && bal(T.id) === 0);
const paid = { id: "ev1", type: "checkout.paid", data: { id: "chk_1", amount: 5000 } };
[c] = await hook(paid, ""); ok("إشعار بلا توقيع 400", c === 400);
[c] = await hook(paid, "deadbeef"); ok("توقيع خاطئ 403", c === 403 && bal(T.id) === 0);
[c, b] = await hook({ ...paid, data: { id: "chk_1", amount: 1 } }); ok("مبلغ مختلف يُتجاهل ولا يُقيَّد", c === 200 && b.ignored === "amount_mismatch" && bal(T.id) === 0 && sql("SELECT status s FROM wl_deposits WHERE id=?", dep1).s === "pending");
[c, b] = await hook(paid); ok("إشعار صحيح ← approved ورصيد 5000", c === 200 && b.status === "approved" && bal(T.id) === 5000 && sql("SELECT status s FROM wl_deposits WHERE id=?", dep1).s === "approved", b);
[c, b] = await hook(paid); ok("إعادة الإشعار لا تقيّد مرتين", c === 200 && b.duplicate === true && bal(T.id) === 5000);
[c, b] = await hook({ id: "ev2", type: "checkout.paid", data: { id: "unknown", amount: 5000 } }); ok("جلسة مجهولة تُتجاهل", b.ignored === "unknown_checkout");
fake.handler = () => [200, { id: "chk_2", checkout_url: "https://pay.chargily.dz/test/checkouts/chk_2/pay" }];
[, b] = await call("POST", "/v1/wallet/deposits", { amount: 900, method: "chargily", return_url: "https://shop.example/w" }, T.key); const dep2 = b.id;
[c, b] = await hook({ id: "ev3", type: "checkout.failed", data: { id: "chk_2", amount: 900 } }); ok("فشل الدفع ← failed بلا رصيد", b.status === "failed" && bal(T.id) === 5000 && sql("SELECT status s FROM wl_deposits WHERE id=?", dep2).s === "failed");
fake.handler = () => [500, "err"]; [c] = await call("POST", "/v1/wallet/deposits", { amount: 1000, method: "chargily", return_url: "https://shop.example/w" }, T.key); ok("رفض المزوّد ← 502 والإيداع failed", c === 502 && sqlAll("SELECT status s FROM wl_deposits WHERE status='failed'").length >= 2);
ok("الإيداع في الدفتر kind=deposit بمرجع فريد", sql("SELECT COUNT(*) n FROM wl_tx WHERE tenant_id=? AND ref=?", T.id, `dep:wd:${dep1}`).n === 1);

/* ───── CCP يدوي ───── */
[c] = await call("POST", "/v1/wallet/deposits", { amount: 3000, method: "ccp" }, T.key); ok("بلا صورة مرفوض", c === 400);
[c] = await call("POST", "/v1/wallet/deposits", { amount: 3000, method: "ccp", proof: "data:image/svg+xml;base64,PHN2Zz4=" }, T.key); ok("SVG مرفوض", c === 400);
[c] = await call("POST", "/v1/wallet/deposits", { amount: 3000, method: "ccp", proof: "data:image/jpeg;base64," + Buffer.from("not a jpeg at all...").toString("base64") }, T.key); ok("بصمة ملف خاطئة", c === 400);
[c, b] = await call("POST", "/v1/wallet/deposits", { amount: 3000, method: "ccp", proof: JPG, payer: "<i>علي</i>" }, T.key); ok("حوالة CCP بصورة ← pending", c === 201 && b.status === "pending", b); const ccp1 = b.id;
ok("لا رصيد قبل موافقة المزوّد", bal(T.id) === 5000);
[, b] = await call("GET", "/v1/wallet/deposits", null, T.key); ok("قائمة التاجر بلا صورة الإثبات", b.deposits.some((d) => d.id === ccp1 && d.has_proof === true && d.status === "pending") && !JSON.stringify(b).includes("base64") && b.chargily === true, b);
[, b] = await call("GET", "/v1/wallet/deposits", null, U.key); ok("عزل المستأجرين", b.deposits.length === 0);
[c] = await call("POST", `/admin/wallet/deposits/${ccp1}/approve`, {}, T.key); ok("التاجر لا يملك الموافقة", c === 401 || c === 403);
[, b] = await adm("GET", "/admin/wallet/deposits/list"); ok("المزوّد يرى المعلّق بلا صورة", b.deposits.some((d) => d.id === ccp1 && d.payer === "علي" || d.id === ccp1) && !JSON.stringify(b).includes("base64"), b);
[, b] = await adm("GET", `/admin/wallet/deposits/${ccp1}/proof`); ok("صورة الإثبات عند الطلب فقط", b.proof === JPG);
[c] = await adm("POST", `/admin/wallet/deposits/${dep1}/approve`, {}); ok("إيداع Chargily لا يُعتمد يدوياً", c === 409);
[c] = await adm("POST", `/admin/wallet/deposits/${ccp1}/approve`, {}); ok("موافقة المزوّد ← رصيد 8000", c === 200 && bal(T.id) === 8000);
[c] = await adm("POST", `/admin/wallet/deposits/${ccp1}/approve`, {}); ok("لا اعتماد مرتين", c === 409 && bal(T.id) === 8000);
[c] = await adm("POST", `/admin/wallet/deposits/${ccp1}/reject`, {}); ok("لا رفض بعد الاعتماد", c === 409);
[, b] = await call("POST", "/v1/wallet/deposits", { amount: 1200, method: "ccp", proof: JPG }, T.key); const ccp2 = b.id;
[c] = await adm("POST", `/admin/wallet/deposits/${ccp2}/reject`, { note: "الوصل غير واضح" }); ok("رفض بسبب", c === 200 && bal(T.id) === 8000 && sql("SELECT status s, note n FROM wl_deposits WHERE id=?", ccp2).s === "rejected");
for (let i = 0; i < 3; i++) await call("POST", "/v1/wallet/deposits", { amount: 1000 + i, method: "ccp", proof: JPG }, T.key);
[c] = await call("POST", "/v1/wallet/deposits", { amount: 2000, method: "ccp", proof: JPG }, T.key); ok("حدّ 3 حوالات معلّقة", c === 429);
const s = (await adm("GET", "/admin/wallet/summary"))[1]; ok("الدفتر متوازن", s.balanced === true, s);
/* بلا مفتاح Chargily للمنصة */
const E2 = makeEnv([wallet]); const T2 = await E2.tenant("X"); await E2.adm("PATCH", `/admin/tenants/${T2.id}`, { settings: { origins: ["https://shop.example"] } });
[c, b] = await E2.call("POST", "/v1/wallet/deposits", { amount: 5000, method: "chargily", return_url: "https://shop.example/w" }, T2.key); ok("بلا إعداد المنصة ← 503 مع إبقاء CCP", c === 503);
[, b] = await E2.call("GET", "/v1/wallet/deposits", null, T2.key); ok("الواجهة تعرف أن البطاقة غير مفعّلة", b.chargily === false);
done();
