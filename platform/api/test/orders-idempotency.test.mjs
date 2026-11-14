/* المرحلة 12C — Worker: عقد Idempotency-Key على POST /v1/orders. ⚠ LOCAL ONLY: قاعدة D1 محاكاة بـSQLite داخل الذاكرة (node:sqlite)، لا Worker ولا D1 حقيقيين (BLOCKED).
   يثبت: نفس المفتاح+المحتوى ← إعادة الردّ الأصلي بلا طلب ثانٍ ولا خصم مخزون ثانٍ؛ نفس المفتاح بمحتوى مختلف ← 409؛ تزامن؛ عزل المستأجرين؛ مفتاح غير صالح ← 400؛ بلا مفتاح ← السلوك القديم (ref). */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce } from "../src/modules/commerce.js";
const { ok, done } = Tally(); const E = makeEnv([commerce]); const { call, adm, tenant, sql } = E; const A = await tenant("A"), B = await tenant("B");
const prod = { slug: "honey", title: "عسل", price: 2400, stock: 50, offers: [{ qty: 1, price: 2400, free: 0 }] };
for (const T of [A, B]) { await call("PUT", "/v1/catalog/products", { products: [prod] }, T.key); await adm("PATCH", `/admin/tenants/${T.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce" } }); }
const pubKey = async T => (await adm("POST", `/admin/tenants/${T.id}/keys`, { scopes: ["order:create"], mode: "pub" }))[1].key;
const pkA = await pubKey(A), pkB = await pubKey(B), O = { origin: "https://shop.example" };
const mk = (ref, qty = 2, name = "أمين") => ({ ref, customer: { name, phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "honey", qty, price: 2400 }], subtotal: 2400 * qty, discount: 0, fee: 0, total: 2400 * qty });
const stock = tid => sql("SELECT stock s FROM cm_skus WHERE tenant_id=? AND slug='honey' AND vkey=''", tid).s, cnt = (tid) => sql("SELECT COUNT(*) n FROM cm_orders WHERE tenant_id=?", tid).n;
const H = k => ({ ...O, "idempotency-key": k });
const K1 = "idem-key-0001-" + Date.now(), REF1 = "IDEM-REF-0001";
let [c, b, h] = await call("POST", "/v1/orders", mk(REF1), pkA, {}, H(K1));
ok("[W1] طلب بمفتاح جديد ← 201 وردّ ok+ref", c === 201 && b.ok === true && b.ref === REF1, { c, b });
const s1 = stock(A.id), n1 = cnt(A.id); ok("[W1] طلب واحد وخصم مخزون واحد (50→48)", n1 === 1 && s1 === 48, { n1, s1 });
[c, b, h] = await call("POST", "/v1/orders", mk(REF1), pkA, {}, H(K1));
ok("[W2] نفس المفتاح والمحتوى ← يُعاد الردّ الأصلي نفسه (201) مع Idempotent-Replayed، بلا طلب ثانٍ", c === 201 && b.ref === REF1 && !b.duplicate && (h?.["Idempotent-Replayed"] === "true" || h?.["idempotent-replayed"] === "true") && cnt(A.id) === 1 && stock(A.id) === 48, { c, b, h });
/* نفس المفتاح بمحتوى مختلف (كمية/اسم/مرجع) — يجب 409 صريحاً لا «مكرر» صامتاً */
for (const [lab, body] of [["كمية مختلفة", mk(REF1, 5)], ["اسم مختلف", mk(REF1, 2, "شخص آخر")], ["ref مختلف", mk("IDEM-REF-OTHER-1")]]) {
  const [cc, bb] = await call("POST", "/v1/orders", body, pkA, {}, H(K1)); ok("[W3] نفس المفتاح + " + lab + " ← 409 idempotency_conflict ولا طلب جديد", cc === 409 && bb.error?.code === "idempotency_conflict" && cnt(A.id) === 1, { cc, bb }); }
ok("[W3] المخزون لم يتغيّر بعد كل التعارضات", stock(A.id) === 48, { s: stock(A.id) });
/* مفتاح غير صالح */
const n4 = cnt(A.id);
for (const bad of ["bad key with spaces", "x".repeat(81), "مفتاح"]) { const [cc] = await call("POST", "/v1/orders", mk("IDEM-REF-BAD-1"), pkA, {}, H(bad)); ok("[W4] مفتاح غير صالح ← 400 ولا طلب", cc === 400 && cnt(A.id) === n4, { cc, bad: bad.slice(0, 10) }); }
/* تزامن: 10 طلبات بنفس المفتاح */
const K2 = "idem-key-0002-" + Date.now(), REF2 = "IDEM-REF-0002", before = cnt(A.id), stk = stock(A.id);
const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/orders", mk(REF2), pkA, {}, H(K2))));
ok("[W5] 10 طلبات متزامنة بنفس المفتاح ← طلب واحد فقط وخصم مخزون واحد", cnt(A.id) === before + 1 && stock(A.id) === stk - 2, { delta: cnt(A.id) - before, stock: stock(A.id), codes: rs.map(r => r[0]) });
ok("[W5] كل الردود نجاح (200/201) بالمرجع نفسه (لا أخطاء 5xx/409)", rs.every(r => (r[0] === 201 || r[0] === 200) && r[1].ref === REF2), rs.map(r => [r[0], r[1].duplicate]));
/* عزل المستأجرين: نفس المفتاح عند B مستقل */
const [cb, bb] = await call("POST", "/v1/orders", mk(REF1), pkB, {}, H(K1)); ok("[W6] نفس المفتاح عند مستأجر آخر ← طلب مستقل (201)، لا تسرّب ولا تكرار عابر", cb === 201 && !bb.duplicate && cnt(B.id) === 1 && stock(B.id) === 48, { cb, bb });
const [cb2] = await call("POST", "/v1/orders", mk(REF1, 9), pkB, {}, H(K1)); ok("[W6] وتعارض المفتاح يُقاس داخل كل مستأجر (409 في B بمحتوى B)", cb2 === 409);
/* بلا مفتاح: السلوك القديم (ref فريد) + نفس ref بمحتوى مختلف يبقى «duplicate» (توثيق الفرق عن PHP) */
const [c0, b0] = await call("POST", "/v1/orders", mk("NO-KEY-REF-001"), pkA, {}, O), [c0b, b0b] = await call("POST", "/v1/orders", mk("NO-KEY-REF-001"), pkA, {}, O);
ok("[W7] بلا مفتاح: توافق رجعي — الإعادة بنفس ref ← 200 duplicate:true وطلب واحد", c0 === 201 && c0b === 200 && b0b.duplicate === true, { c0, c0b });
const [c0c, b0c] = await call("POST", "/v1/orders", mk("NO-KEY-REF-001", 7), pkA, {}, O); ok("[W7] ملاحظة موثَّقة: بلا مفتاح نفس ref بمحتوى مختلف يُعاد كـduplicate (حماية ref فقط، لا مقارنة محتوى) — لا طلب جديد", c0c === 200 && b0c.duplicate === true, { c0c });
/* مفتاح عام فقط لا يقرأ، وغير مصادَق ← 401، وفشل التحقق لا يُخزَّن */
const [cu] = await call("POST", "/v1/orders", mk("IDEM-REF-UNAUTH"), null, {}, H("idem-unauth-0001")); ok("[W8] بلا مصادقة ← 401", cu === 401, { cu });
const KV = "idem-key-0003-" + Date.now(); const [cv] = await call("POST", "/v1/orders", { ...mk("IDEM-REF-VAL-1"), customer: { name: "x", phone: "123" } }, pkA, {}, H(KV)); const before2 = cnt(A.id);
const [cv2, bv2] = await call("POST", "/v1/orders", mk("IDEM-REF-VAL-1"), pkA, {}, H(KV)); ok("[W9] رفض تحقق (422) لا يُخزَّن (لم يُنشأ شيء): تصحيح المحتوى بالمفتاح نفسه ينجح (201) بطلب واحد", cv === 422 && cv2 === 201 && cnt(A.id) === before2 + 1, { cv, cv2 });
done();
