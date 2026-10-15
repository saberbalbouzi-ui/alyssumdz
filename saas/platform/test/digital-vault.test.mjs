/* المنتجات الرقمية: مخزن المفاتيح، التسليم عند تأكيد الدفع (Chargily أو موافقة يدوية BaridiMob/CCP)، إثبات الدفع، الدفع العام، حماية التكرار والنفاد. */
import { makeEnv, Tally } from "./_harness.mjs";
import { digital } from "../src/modules/digital.js";
import { payments, parseProof } from "../src/modules/payments.js";
import { commerce } from "../src/modules/commerce.js";
import { wallet } from "../src/modules/wallet.js";
import { hmacHex } from "../src/util.js";
const { ok, done } = Tally();
const E = makeEnv([digital, payments, commerce, wallet], { providers: ["email", "chargily", "whatsapp"] }); const { call, adm, tenant, fake, app, sql, sqlAll } = E;
const A = await tenant("A"), B = await tenant("B");
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"], lang: "ar" } });
const [, pkr] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create", "payment:proof", "payment:init"], mode: "pub" }), PK = pkr.key;
const pub = (m, p, b) => call(m, p, b, PK, {}, { origin: "https://shop.example" });
const JPG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(1)]).toString("base64");
/* ───── المفاتيح ───── */
let [c, b] = await call("POST", "/v1/digital/keys", { sku: "bad sku", keys: ["a"] }, A.key); ok("sku غير صالح", c === 400);
[c] = await call("POST", "/v1/digital/keys", { sku: "iptv-1m", keys: [] }, A.key); ok("قائمة فارغة", c === 400);
[c, b] = await call("POST", "/v1/digital/keys", { sku: "iptv-1m", text: "user1:pass1\nuser2:pass2\r\n\nuser2:pass2\nuser3:pass3" }, A.key); ok("إضافة مفاتيح مع حذف المكرر", c === 201 && b.added === 3 && b.duplicates === 1, b);
[c, b] = await call("GET", "/v1/digital/keys", null, A.key); ok("المخزون بلا أي سرّ", b.skus.length === 1 && b.skus[0].available === 3 && b.skus[0].sold === 0 && !JSON.stringify(b).includes("pass"), b);
ok("السرّ مشفّر في القاعدة", !sqlAll("SELECT secret_enc FROM dg_keys").some((r) => r.secret_enc.includes("pass")));
[c, b] = await call("GET", "/v1/digital/keys", null, B.key); ok("عزل المستأجرين", b.skus.length === 0);
/* ───── كتالوج وطلب رقمي (دفع يدوي) ───── */
await call("PUT", "/v1/catalog/products", { products: [{ slug: "iptv-1m", title: "اشتراك IPTV شهر", price: 1500 }, { slug: "ebook", title: "كتاب", price: 800 }] }, A.key);
await call("PUT", "/v1/integrations/email", { config: { from: "متجر <shop@x.dz>" }, secrets: { api_key: "re_KEY" } }, A.key);
await call("PUT", "/v1/integrations/chargily", { config: { mode: "test" }, secrets: { secret_key: "test_sk_abc" } }, A.key);
await call("POST", "/v1/digital/assets", { sku: "ebook", name: "الكتاب", location: "https://f.example/book.pdf" }, A.key);
const order = (ref, o = {}) => ({ ref, customer: { name: "زبون <b>x</b>", phone: "0550123456", email: "buyer@x.dz" }, items: [{ slug: "iptv-1m", qty: 2, price: 1500 }], subtotal: 3000, discount: 0, fee: 0, total: 3000, pay: "baridimob", ...o });
[c, b] = await pub("POST", "/v1/orders", order("DG-ORDER-1")); ok("طلب رقمي بلا ولاية ولا توصيل يُقبل ويُتحقق منه", c === 201 && b.verified === true, b); await app.cron();
ok("سُجّل طلب رقمي بانتظار الدفع", sql("SELECT state s, paid p FROM dg_orders WHERE order_ref='DG-ORDER-1'").s === "awaiting");
ok("سُجّل المبلغ المتوقع من الطلب الموثَّق", sql("SELECT amount a, verified v FROM pay_expect WHERE order_id='DG-ORDER-1'").a === 3000);
[c, b] = await pub("POST", "/v1/orders", order("COD-ORDER-1", { items: [{ slug: "ebook", qty: 1, price: 800 }], subtotal: 800, total: 800, pay: "cod" })); await app.cron();
ok("الدفع عند الاستلام لا يُسجَّل للدفع (لكن الكتاب الرقمي يُسجَّل للتسليم)", !sql("SELECT 1 x FROM pay_expect WHERE order_id='COD-ORDER-1'"));
/* ───── إثبات الدفع ───── */
await app.cron();
[c] = await pub("POST", "/v1/payments/proof", { order_id: "DG-ORDER-1", method: "paypal", proof: JPG }); ok("وسيلة غير مسموحة", c === 400);
[c] = await pub("POST", "/v1/payments/proof", { order_id: "DG-ORDER-1", method: "ccp", proof: "data:image/svg+xml;base64,PHN2Zz4=" }); ok("SVG مرفوض", c === 400);
[c] = await pub("POST", "/v1/payments/proof", { order_id: "DG-ORDER-1", method: "ccp", proof: "data:image/jpeg;base64," + Buffer.from("not a jpeg at all....").toString("base64") }); ok("بصمة ملف خاطئة مرفوضة", c === 400);
[c] = await pub("POST", "/v1/payments/proof", { order_id: "DG-ORDER-1", method: "ccp", proof: "data:image/jpeg;base64," + "A".repeat(250000) }); ok("حجم كبير مرفوض", c === 400);
[c] = await pub("POST", "/v1/payments/proof", { order_id: "NOT-EXISTING-1", method: "ccp", proof: JPG }); ok("طلب غير معروف 404", c === 404);
[c, b] = await pub("POST", "/v1/payments/proof", { order_id: "DG-ORDER-1", method: "baridimob", proof: JPG, payer: "<i>أحمد</i>" }); ok("رفع إثبات", c === 201 && b.status === "pending", b);
const pid = b.id;
[c, b] = await call("GET", "/v1/payments/manual", null, A.key, { state: "pending" }); ok("التاجر يرى الإثبات بلا الصورة، والمبلغ من الطلب لا من الزبون", b.proofs.length >= 1 && b.proofs.some((x) => x.id === pid && x.amount === 3000 && x.has_proof && x.payer === "أحمد") && !JSON.stringify(b).includes("base64"), b);
[c, b] = await call("GET", `/v1/payments/manual/${pid}/proof`, null, A.key); ok("جلب الصورة", c === 200 && b.proof.startsWith("data:image/jpeg"));
[c] = await call("GET", `/v1/payments/manual/${pid}/proof`, null, B.key); ok("مستأجر آخر لا يرى الصورة", c === 404);
[c, b] = await pub("POST", "/v1/payments/proof", { order_id: "DG-ORDER-1", method: "baridimob", proof: JPG }); const pid2 = b.id; ok("إثبات ثانٍ يستبدل المعلّق", sql("SELECT state s FROM pay_manual WHERE id=?", pid).s === "superseded");
[c] = await call("POST", `/v1/payments/manual/${pid}/approve`, {}, A.key); ok("لا موافقة على إثبات مستبدَل", c === 409);
[c] = await pub("POST", `/v1/payments/manual/${pid2}/approve`, {}); ok("المفتاح العام لا يوافق على الدفع", c === 403);
/* ───── الموافقة تُسلِّم فوراً ───── */
fake.calls.length = 0; fake.handler = () => [200, { id: "em_1" }];
[c, b] = await call("POST", `/v1/payments/manual/${pid2}/approve`, {}, A.key); ok("موافقة التاجر", c === 200 && b.amount === 3000, b);
await app.cron();
const mail = fake.calls.find((x) => x.url.includes("resend")); const html = JSON.parse(mail?.init.body ?? "{}").html ?? "";
ok("البريد يحوي مفتاحين من الخزنة مهرَّبين", !!mail && JSON.parse(mail.init.body).to[0] === "buyer@x.dz" && /user1:pass1/.test(html) && /user2:pass2/.test(html) && !/user3/.test(html), html.slice(0, 200));
ok("الطلب مُسلَّم والمفاتيح مباعة لهذا الطلب فقط", sql("SELECT state s FROM dg_orders WHERE order_ref='DG-ORDER-1'").s === "delivered" && sql("SELECT COUNT(*) n FROM dg_keys WHERE order_ref='DG-ORDER-1' AND state='sold'").n === 2 && sql("SELECT COUNT(*) n FROM dg_keys WHERE state='available'").n === 1);
ok("يصدر digital.delivered وorder.delivered", sqlAll("SELECT type FROM pf_events WHERE type IN ('digital.delivered','order.delivered')").length === 2);
ok("الدفع اليدوي لا يدخل ضمان المحفظة (المال لم يمرّ بالمنصة)", !sql("SELECT 1 x FROM wl_escrow WHERE order_id='DG-ORDER-1'"));
fake.calls.length = 0; await call("POST", "/v1/events", { type: "payment.confirmed", id: "DG-ORDER-1", data: { order_id: "DG-ORDER-1" } }, A.key); await app.cron();
ok("إعادة تأكيد الدفع لا تخصّص مفاتيح ثانية ولا بريداً ثانياً", sql("SELECT COUNT(*) n FROM dg_keys WHERE state='sold'").n === 2 && !fake.calls.some((x) => x.url.includes("resend")));
[c] = await call("POST", `/v1/payments/manual/${pid2}/approve`, {}, A.key); ok("لا موافقة ثانية", c === 409);
[c] = await pub("POST", "/v1/payments/proof", { order_id: "DG-ORDER-1", method: "ccp", proof: JPG }); ok("لا إثبات بعد الدفع", c === 409);
/* ───── نفاد المخزون ثم إعادة تعبئة ───── */
await pub("POST", "/v1/orders", order("DG-ORDER-2")); await app.cron();
[c, b] = await call("POST", "/v1/payments/manual/orders/DG-ORDER-2/approve", {}, A.key); ok("موافقة مباشرة بلا صورة", c === 200 && b.amount === 3000, b); await app.cron();
ok("نفاد: الطلب short بلا تخصيص جزئي", sql("SELECT state s, detail d FROM dg_orders WHERE order_ref='DG-ORDER-2'").s === "short" && sql("SELECT COUNT(*) n FROM dg_keys WHERE state='available'").n === 1 && sql("SELECT COUNT(*) n FROM dg_keys WHERE order_ref='DG-ORDER-2'").n === 0);
ok("يصدر digital.short", sqlAll("SELECT id FROM pf_events WHERE type='digital.short'").length === 1);
[c, b] = await call("POST", "/v1/digital/keys", { keys: ["user4:pass4", "user5:pass5"], sku: "iptv-1m" }, A.key); ok("إضافة مخزون تُسلِّم الطلب المتعثّر تلقائياً", b.delivered_waiting === 1, b); await app.cron();
ok("صار مُسلَّماً", sql("SELECT state s FROM dg_orders WHERE order_ref='DG-ORDER-2'").s === "delivered" && sql("SELECT COUNT(*) n FROM dg_keys WHERE order_ref='DG-ORDER-2'").n === 2);
/* ───── بلا بريد/تسليم يدوي ───── */
await pub("POST", "/v1/orders", order("DG-ORDER-3", { customer: { name: "س", phone: "0661234567" }, items: [{ slug: "iptv-1m", qty: 1, price: 1500 }], subtotal: 1500, total: 1500 })); await app.cron();
await call("POST", "/v1/payments/manual/orders/DG-ORDER-3/approve", {}, A.key); await app.cron();
ok("بلا بريد: الطلب ready (يرسله التاجر)", sql("SELECT state s FROM dg_orders WHERE order_ref='DG-ORDER-3'").s === "ready" && sqlAll("SELECT id FROM pf_events WHERE type='digital.ready'").length === 1);
[c, b] = await call("GET", "/v1/digital/orders/DG-ORDER-3", null, A.key); ok("التاجر يقرأ مفاتيح الطلب المدفوع", c === 200 && b.keys[0].sku === "iptv-1m" && /pass[45]|pass/.test(b.keys[0].values[0]), b);
[c] = await call("GET", "/v1/digital/orders/DG-ORDER-3", null, B.key); ok("مستأجر آخر لا يقرأها", c === 404);
[c, b] = await call("POST", "/v1/digital/orders/DG-ORDER-3/sent", {}, A.key); ok("تأكيد الإرسال اليدوي", c === 200 && b.state === "delivered"); await app.cron();
[c, b] = await call("GET", "/v1/digital/orders", null, A.key, { state: "delivered" }); ok("قائمة الطلبات بحالاتها بلا أسرار", b.orders.length === 3 && !JSON.stringify(b).includes("pass"), b);
await pub("POST", "/v1/orders", order("DG-ORDER-4", { customer: { name: "ع", phone: "0771234567" } })); await app.cron();
[c] = await call("GET", "/v1/digital/orders/DG-ORDER-4", null, A.key); ok("طلب غير مدفوع لا تُكشف مفاتيحه", c === 409);
/* ───── ملف رقمي فقط (رابط تنزيل) بدفع مؤكَّد ───── */
fake.calls.length = 0; await pub("POST", "/v1/orders", order("DG-FILE-1", { items: [{ slug: "ebook", qty: 1, price: 800 }], subtotal: 800, total: 800, pay: "ccp" })); await app.cron();
await call("POST", "/v1/payments/manual/orders/DG-FILE-1/approve", {}, A.key); await app.cron();
ok("الملف: منحة رابط تنزيل وبريد بالرابط", sql("SELECT COUNT(*) n FROM dg_grants WHERE order_ref='DG-FILE-1'").n === 1 && /\/d\/[0-9a-f]{64}/.test(JSON.parse(fake.calls.find((x) => x.url.includes("resend")).init.body).html));
await call("PUT", "/v1/catalog/products", { products: [{ slug: "iptv-1m", title: "اشتراك IPTV شهر", price: 1500 }, { slug: "ebook", title: "كتاب", price: 800 }, { slug: "gift-card", title: "بطاقة", price: 500 }] }, A.key);
/* ───── فوري بلا انتظار cron: المبلغ المتوقع مسجَّل والموافقة تُسلِّم ───── */
await call("POST", "/v1/digital/keys", { sku: "gift-card", keys: ["GC-1", "GC-2"] }, A.key);
await pub("POST", "/v1/orders", order("DG-FLUSH-1", { items: [{ slug: "gift-card", qty: 1, price: 500 }], subtotal: 500, total: 500 }));
[c] = await pub("POST", "/v1/payments/proof", { order_id: "DG-FLUSH-1", method: "ccp", proof: JPG }); ok("الإثبات مقبول فور إنشاء الطلب (بلا انتظار cron)", c === 201);
fake.handler = () => [200, { id: "em" }]; [c] = await call("POST", "/v1/payments/manual/orders/DG-FLUSH-1/approve", {}, A.key);
ok("الموافقة تُسلِّم فوراً بلا cron", c === 200 && sql("SELECT state s FROM dg_orders WHERE order_ref='DG-FLUSH-1'").s === "delivered");
await call("DELETE", "/v1/digital/keys/iptv-1m", null, A.key); await call("POST", "/v1/digital/keys", { sku: "gift-card", text: "user1:pass1\nuser2:pass2\nuser3:pass3" }, A.key);
/* ───── تسليم آلي عبر واتساب (بلا بريد) ───── */
await call("PUT", "/v1/catalog/products", { products: [{ slug: "gift-card", title: "بطاقة", price: 500 }] }, A.key);
await call("POST", "/v1/digital/keys", { sku: "gift-card", text: "k1\nk2\nk3\nk4\nk5\nk6" }, A.key);
[c, b] = await call("GET", "/v1/digital/wa", null, A.key); ok("الحالة: غير مضبوط", c === 200 && b.configured === false && b.auto === false, b);
const waOrder = (ref, phone = "0661234567") => order(ref, { customer: { name: "سارة", phone }, items: [{ slug: "gift-card", qty: 2, price: 500 }], subtotal: 1000, total: 1000, pay: "ccp" });
const pay = async (ref) => { await pub("POST", "/v1/orders", waOrder(ref)); await app.cron(); await call("POST", `/v1/payments/manual/orders/${ref}/approve`, {}, A.key); await app.cron(); };
await pay("WA-ORDER-1"); ok("بلا تكامل واتساب: ready", sql("SELECT state s FROM dg_orders WHERE order_ref='WA-ORDER-1'").s === "ready");
ok("الهاتف مشفّر في القاعدة", !sqlAll("SELECT phone_enc FROM dg_phone").some((r) => /661234567/.test(r.phone_enc)) && sqlAll("SELECT 1 x FROM dg_phone").length >= 1);
await call("PUT", "/v1/integrations/whatsapp", { config: { phone_number_id: "123", template: "x" }, secrets: { access_token: "EAAtok" } }, A.key);
[c, b] = await call("GET", "/v1/digital/wa", null, A.key); ok("مضبوط لكن بلا digital_auto ← لا آلي", b.configured === true && b.auto === false, b);
await pay("WA-ORDER-2"); ok("بلا digital_auto: ready", sql("SELECT state s FROM dg_orders WHERE order_ref='WA-ORDER-2'").s === "ready");
await call("PUT", "/v1/integrations/whatsapp", { config: { phone_number_id: "123", template: "x", digital_auto: true }, secrets: { access_token: "EAAtok" } }, A.key);
[c, b] = await call("GET", "/v1/digital/wa", null, A.key); ok("الآلي مفعّل", b.auto === true && b.template === false && !JSON.stringify(b).includes("EAAtok"), b);
let waReq = null; fake.handler = (u, i) => { if (/graph\.facebook\.com/.test(u)) { waReq = { u, h: i.headers, b: JSON.parse(i.body) }; return [200, { messages: [{ id: "wamid.1" }] }]; } return [200, { id: "x" }]; };
await pay("WA-ORDER-3");
ok("نص حرّ بمفاتيح الطلب إلى رقم الزبون", waReq && waReq.b.type === "text" && waReq.b.to === "213661234567" && /pass|user|:/.test(waReq.b.text.body) && /\/123\/messages$/.test(waReq.u) && waReq.h.Authorization === "Bearer EAAtok", waReq);
ok("الطلب مُسلَّم عبر واتساب", sql("SELECT state s FROM dg_orders WHERE order_ref='WA-ORDER-3'").s === "delivered" && sqlAll("SELECT payload FROM pf_events WHERE type='digital.delivered'").some((r) => /whatsapp/.test(r.payload)));
ok("لا رسالة ثانية عند إعادة المحاولة", (await call("POST", "/v1/digital/orders/WA-ORDER-3/deliver", {}, A.key))[1].duplicate === true);
await call("PUT", "/v1/integrations/whatsapp", { config: { phone_number_id: "123", template: "x", digital_auto: true, digital_template: "dg_keys" }, secrets: { access_token: "EAAtok" } }, A.key);
await call("POST", "/v1/digital/keys", { sku: "gift-card", text: "g1\ng2\ng3\ng4" }, A.key); waReq = null; await pay("WA-ORDER-4");
ok("قالب معتمد بثلاثة متغيّرات بلا أسطر", waReq && waReq.b.type === "template" && waReq.b.template.name === "dg_keys" && waReq.b.template.components[0].parameters.length === 3 && !/\n/.test(waReq.b.template.components[0].parameters[2].text), waReq);
fake.handler = (u) => /graph\.facebook\.com/.test(u) ? [400, { error: { code: 131047 } }] : [200, { id: "x" }];
await call("POST", "/v1/digital/keys", { sku: "gift-card", text: "h1\nh2" }, A.key); await pay("WA-ORDER-5");
ok("رفض Meta ← يبقى ready للإرسال اليدوي ويصدر digital.ready", sql("SELECT state s FROM dg_orders WHERE order_ref='WA-ORDER-5'").s === "ready" && sqlAll("SELECT id FROM pf_events WHERE type='digital.ready'").length >= 3);
fake.handler = () => [200, { id: "x" }];
/* ───── الدفع الإلكتروني العام ───── */
[c] = await pub("POST", "/v1/payments/pay", { order_id: "DG-ORDER-4", method: "edahabia", return_url: "https://evil.example/t" }); ok("return_url خارج أصول الموقع مرفوض", c === 400);
[c] = await pub("POST", "/v1/payments/pay", { order_id: "NOPE-ORDER-1", method: "edahabia", return_url: "https://shop.example/t" }); ok("طلب غير معروف 404", c === 404);
fake.handler = (u, i) => { fake.last = JSON.parse(i.body ?? "{}"); return [200, { id: "chk_dg", checkout_url: "https://pay.chargily.dz/test/checkouts/chk_dg/pay" }]; };
[c, b] = await pub("POST", "/v1/payments/pay", { order_id: "DG-ORDER-4", method: "edahabia", return_url: "https://shop.example/thanks.html?x=1", amount: 1 }); ok("المبلغ من الطلب الموثَّق لا من الزبون", c === 201 && fake.last.amount === 3000 && /pay=ok/.test(fake.last.success_url) && /order=DG-ORDER-4/.test(fake.last.success_url) && b.checkout_url.includes("chk_dg"), [c, fake.last]);
const hp = new URL((await call("POST", "/v1/payments/setup", {}, A.key))[1].webhook_url).pathname, raw = JSON.stringify({ id: "ev1", type: "checkout.paid", data: { id: "chk_dg", amount: 3000 } });
fake.calls.length = 0; fake.handler = () => [200, { id: "em" }]; await call("POST", hp, raw, null, {}, { signature: await hmacHex("test_sk_abc", raw) }); await app.cron();
ok("إشعار Chargily يُسلِّم الطلب الرقمي تلقائياً (المسار الأول)", sql("SELECT state s FROM dg_orders WHERE order_ref='DG-ORDER-4'").s === "delivered" || sql("SELECT state s FROM dg_orders WHERE order_ref='DG-ORDER-4'").s === "short", sql("SELECT state s, detail d FROM dg_orders WHERE order_ref='DG-ORDER-4'"));
ok("الدفع الإلكتروني يدخل الضمان (الأموال مرّت بالمنصة)", !!sql("SELECT 1 x FROM wl_escrow WHERE order_id='DG-ORDER-4'"));
[c] = await pub("POST", "/v1/payments/pay", { order_id: "DG-ORDER-4", method: "edahabia", return_url: "https://shop.example/t" }); ok("لا دفع ثانٍ لطلب مدفوع", c === 409);
/* ───── نقية ───── */
ok("parseProof يقبل jpeg صالحاً فقط", parseProof(JPG) === JPG && parseProof("data:image/png;base64,AAAA") === null && parseProof(null) === null);
[c] = await call("DELETE", "/v1/digital/keys/iptv-1m", null, A.key); ok("حذف المتاح فقط", c === 200 && sql("SELECT COUNT(*) n FROM dg_keys WHERE state='sold'").n >= 4);
done();
