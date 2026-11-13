/* المرحلة 12B: تزامن الطلبات وعزل المستأجرين في Worker المنصة (cm_orders): نفس ref متزامناً ← طلب واحد وخصم مخزون واحد؛ ref مشترك بين مستأجرين مستقل؛
   مؤشر after وقوائم الطلبات والمفاتيح لا تتسرّب عبر المستأجرين؛ مفتاح A لا يغيّر شيئاً في B. (قاعدة D1 محاكاة بـSQLite كبقية اختبارات هذا المجلد.) */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce } from "../src/modules/commerce.js";
const { ok, done } = Tally(); const E = makeEnv([commerce]); const { call, adm, tenant, sql, sqlAll } = E; const A = await tenant("A"), B = await tenant("B");
const prod = { slug: "honey", title: "عسل", price: 2400, stock: 50, offers: [{ qty: 1, price: 2400, free: 0 }] };
for (const T of [A, B]) { await call("PUT", "/v1/catalog/products", { products: [prod] }, T.key); await adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce" } }); }
const pubKey = async T => (await adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create"], mode: "pub" }))[1].key;
const pkA = await pubKey(A), pkB = await pubKey(B), O = { origin: "https://shop.example" };
const mk = (ref, qty = 2) => ({ ref, customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "honey", qty, price: 2400 }], subtotal: 2400 * qty, discount: 0, fee: 600, total: 2400 * qty + 600 });
const stockOf = tid => sql("SELECT stock s FROM cm_skus WHERE tenant_id=? AND slug='honey' AND vkey=''", tid).s;
/* 1) نفس ref متزامناً في مستأجر واحد */
const ref = "RACE-" + Math.random().toString(36).slice(2, 10), res = await Promise.all(Array.from({ length: 20 }, () => call("POST", "/v1/orders", mk(ref), pkA, {}, O)));
ok("20 طلباً متزامناً بنفس ref: طلب واحد فقط في القاعدة", sql("SELECT COUNT(*) n FROM cm_orders WHERE tenant_id=? AND ref=?", A.id, ref).n === 1, res.map(r => r[0]).join(","));
ok("وخصم مخزون واحد فقط (50 → 48)", stockOf(A.id) === 48, { stock: stockOf(A.id) });
ok("بقية الردود مكرّرة (duplicate) لا أخطاء", res.filter(r => r[0] === 201).length === 1 && res.every(r => r[0] === 201 || (r[0] === 200 && r[1].duplicate === true)), res.map(r => r[0]));
/* 2) نفس ref في مستأجرين مختلفين = طلبان مستقلان */
const shared = "SHARED-REF-001"; const [ca] = await call("POST", "/v1/orders", mk(shared), pkA, {}, O), [cb, bb] = await call("POST", "/v1/orders", mk(shared), pkB, {}, O);
ok("ref مشترك بين مستأجرين: كلاهما يُنشأ (201) ومستقلان", ca === 201 && cb === 201 && !bb.duplicate && sql("SELECT COUNT(*) n FROM cm_orders WHERE ref=?", shared).n === 2);
ok("مخزون كل مستأجر يُخصم من مخزونه وحده (A: 46، B: 48)", stockOf(A.id) === 46 && stockOf(B.id) === 48, { A: stockOf(A.id), B: stockOf(B.id) });
/* 3) قوائم وعزل */
const [, la] = await call("GET", "/v1/orders", null, A.key), [, lb] = await call("GET", "/v1/orders", null, B.key);
ok("قائمة A لا تحوي طلبات B وبالعكس", la.orders.every(o => sql("SELECT tenant_id t FROM cm_orders WHERE ref=? AND tenant_id=?", o.ref, A.id)) && lb.orders.length === 1 && lb.orders[0].ref === shared && !la.orders.some(o => o.ref !== ref && o.ref !== shared));
const idB = sql("SELECT MAX(id) m FROM cm_orders WHERE tenant_id=?", B.id).m, [, atk] = await call("GET", "/v1/orders", null, A.key, { after: String(idB + 1) });
ok("مؤشر after بمعرّف B على قائمة A لا يُظهر إلا طلبات A", atk.orders.every(o => [ref, shared].includes(o.ref)) && atk.orders.length === 2, atk.orders.map(o => o.ref));
const [c403] = await call("GET", "/v1/orders", null, pkB, {}, O); ok("المفتاح العام (نشر فقط) لا يقرأ الطلبات (403)", c403 === 403);
const [, pg] = await call("GET", "/v1/orders", null, A.key, { limit: "1" }); const [, pg2] = await call("GET", "/v1/orders", null, A.key, { limit: "1", after: String(pg.next) });
ok("ترقيم A: صفحتان متتاليتان بلا تكرار", pg.orders.length === 1 && pg2.orders.length === 1 && pg.orders[0].ref !== pg2.orders[0].ref, { next: pg.next });
done();
