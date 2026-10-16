/* التجارة (M7): كتالوج، تحقق أسعار، مخزون ذرّي، وضعا observe/enforce، تسلسل الأحداث. */
import { makeEnv, Tally } from "./_harness.mjs";
import { commerce, verifyOrder, allowedUnits } from "../src/modules/commerce.js";
const { ok, done } = Tally();
const E = makeEnv([commerce]); const { call, adm, tenant, app, sql, sqlAll } = E;
const A = await tenant("A"), B = await tenant("B");
const prod = (o = {}) => ({ slug: "honey", title: "عسل", price: 2400, stock: 5, offers: [{ qty: 1, price: 2400, free: 0 }, { qty: 2, price: 4550, free: 0 }, { qty: 3, price: 4800, free: 1 }], ...o });
/* نقي */
ok("وحدات السعر: أساسي + وحدة كل عرض", JSON.stringify(allowedUnits({ price: 2400, vkey: "" }, { price: 2400 }, [{ qty: 2, price: 4550 }, { qty: 3, price: 4800 }])) === "[2400,2275,1600]");
ok("تنويع: العروض تُضرب بنسبة سعره", allowedUnits({ price: 3000, vkey: "v1" }, { price: 2400 }, [{ qty: 2, price: 4800 }]).includes(3000));
/* مزامنة الكتالوج */
let [c, b] = await call("PUT", "/v1/catalog/products", { products: [prod(), prod({ slug: "cream", title: "كريم", price: 1500, stock: null, offers: [], variations: [{ id: "s", price: 1500, stock: 2, label: "صغير" }, { id: "l", price: 2500, stock: 0, label: "كبير" }] })] }, A.key);
ok("مزامنة منتجين", c === 200 && b.products === 2, b);
[c] = await call("PUT", "/v1/catalog/products", { products: "x" }, A.key); ok("حمولة خاطئة 400", c === 400);
[, b] = await call("GET", "/v1/catalog/products", null, A.key); ok("قراءة الكتالوج: SKUs للتنويعات", b.products.find((p) => p.slug === "cream").skus.length === 3 && b.products.find((p) => p.slug === "honey").skus[0].stock === 5, b);
[, b] = await call("GET", "/v1/catalog/products", null, B.key); ok("عزل المستأجرين", b.products.length === 0);
await call("PUT", "/v1/catalog/coupons", { coupons: [{ code: "ramadan", type: "percent", value: 10, min: 2000 }, { code: "SHIP", type: "freeship" }] }, A.key);
const order = (o = {}) => ({ ref: "W-" + Math.random().toString(36).slice(2, 10), customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "honey", qty: 2, price: 2275 }], subtotal: 4550, discount: 0, fee: 600, total: 5150, ...o });
const sendPub = async (o) => { const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create"], mode: "pub" }); return call("POST", "/v1/orders", o, pk.key, {}, { origin: "https://shop.example" }); };
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"] } });
/* observe */
[c, b] = await sendPub(order()); ok("observe: طلب سليم يُقبل ومُتحقَّق", c === 201 && b.verified === true && b.mode === "observe", b);
ok("observe: لا حجز للمخزون", sql("SELECT stock s FROM cm_skus WHERE slug='honey' AND vkey=''").s === 5);
ok("الهاتف مشفّر في التخزين", !JSON.stringify(sqlAll("SELECT * FROM cm_orders")).includes("0551234567"));
const o1 = order({ items: [{ slug: "honey", qty: 2, price: 1000 }], subtotal: 2000, total: 2600 }); [c, b] = await sendPub(o1); ok("observe: سعر معدَّل يُقبل بعلامة", c === 201 && b.verified === false && JSON.parse(sql("SELECT flags f FROM cm_orders WHERE ref=?", o1.ref).f).some((f) => f.startsWith("price_mismatch")));
[c, b] = await sendPub(o1); ok("نفس ref: مكرر بلا طلب ثانٍ", b.duplicate === true && sql("SELECT COUNT(*) n FROM cm_orders WHERE ref=?", o1.ref).n === 1);
[c] = await sendPub(order({ customer: { phone: "12" } })); ok("هاتف خاطئ 422", c === 422);
[c] = await sendPub(order({ ref: "x" })); ok("ref قصير 400", c === 400);
/* تحقق نقي لحالات إضافية */
const sk = { "honey\u0000": { slug: "honey", vkey: "", price: 2400, stock: 5, active: true, pActive: 1 } }, of = { honey: [{ qty: 2, price: 4550 }] };
const V = (o) => verifyOrder({ lines: [{ slug: "honey", vkey: "", qty: 2, unit: 2275 }], skus: sk, offers: of, subtotal: 4550, discount: 0, fee: 600, total: 5150, coupon: "", couponRow: null, ...o }).flags;
ok("سليم بلا علامات", V({}).length === 0);
ok("مجموع لا يطابق", V({ total: 4000 }).includes("total_mismatch"));
ok("رسم توصيل خارج النطاق", V({ fee: 9000, total: 13550 }).includes("fee_out_of_range"));
ok("تخفيض بلا كود معروف", V({ discount: 500, total: 4650 }).includes("discount_unverified"));
ok("كود نسبة صحيح", V({ discount: 455, total: 4695, coupon: "RAMADAN", couponRow: { type: "percent", value: 10, min: 2000, active: 1 } }).length === 0);
ok("تخفيض أكبر من الكود", V({ discount: 2000, total: 3150, coupon: "RAMADAN", couponRow: { type: "percent", value: 10, min: 2000, active: 1 } }).includes("coupon_mismatch"));
ok("منتج غير معروف", verifyOrder({ lines: [{ slug: "zzz", vkey: "", qty: 1, unit: 1 }], skus: sk, offers: of, subtotal: 1, discount: 0, fee: 0, total: 1 }).flags.some((f) => f.startsWith("unknown_product")));
/* enforce */
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://shop.example"], order_mode: "enforce" } });
[c, b] = await sendPub(order({ items: [{ slug: "honey", qty: 2, price: 1000 }], subtotal: 2000, total: 2600 })); ok("enforce: سعر معدَّل مرفوض 422", c === 422 && b.error.code === "order_rejected", b);
const okOrder = order(); [c, b] = await sendPub(okOrder); ok("enforce: طلب سليم يُقبل ويحجز", c === 201 && sql("SELECT stock s FROM cm_skus WHERE slug='honey' AND vkey=''").s === 3 && sql("SELECT reserved r FROM cm_orders WHERE ref=?", okOrder.ref).r === 1, b);
const big = order({ items: [{ slug: "honey", qty: 4, price: 2275 }], subtotal: 9100, total: 9700 }); [c, b] = await sendPub(big); ok("enforce: كمية فوق المخزون 409 بلا تغيير", c === 409 && b.error.code === "out_of_stock" && sql("SELECT stock s FROM cm_skus WHERE slug='honey' AND vkey=''").s === 3, b);
const two = order({ items: [{ slug: "honey", qty: 1, price: 2400 }, { slug: "cream", vid: "l", qty: 1, price: 2500 }], subtotal: 4900, total: 5500 }); [c, b] = await sendPub(two);
ok("enforce: سطر نفد يلغي حجز السطر الأول (تعويض)", c === 409 && sql("SELECT stock s FROM cm_skus WHERE slug='honey' AND vkey=''").s === 3);
const both = order({ items: [{ slug: "honey", qty: 1, price: 2400 }, { slug: "cream", vid: "s", qty: 1, price: 1500 }], subtotal: 3900, total: 4500 }); [c] = await sendPub(both);
ok("enforce: طلب بتنويع يحجز السطرين", c === 201 && sql("SELECT stock s FROM cm_skus WHERE slug='honey' AND vkey=''").s === 2 && sql("SELECT stock s FROM cm_skus WHERE slug='cream' AND vkey='s'").s === 1);
/* حالة وإلغاء */
await call("POST", "/v1/events", { type: "order.confirmed", id: okOrder.ref, data: { order_id: okOrder.ref } }, A.key); await app.cron();
ok("حدث التأكيد يحدّث الحالة", sql("SELECT status s FROM cm_orders WHERE ref=?", okOrder.ref).s === "confirmee");
await call("POST", "/v1/events", { type: "order.cancelled", id: okOrder.ref, data: { order_id: okOrder.ref } }, A.key); await app.cron();
ok("الإلغاء يعيد المحجوز مرة واحدة (3 ← 4 للعسل)", sql("SELECT stock s FROM cm_skus WHERE slug='honey' AND vkey=''").s === 4 && sql("SELECT reserved r FROM cm_orders WHERE ref=?", okOrder.ref).r === 0);
await call("POST", "/v1/events", { type: "order.cancelled", id: okOrder.ref + "x", data: { order_id: okOrder.ref } }, A.key); await app.cron();
ok("إلغاء ثانٍ لا يعيد ثانية", sql("SELECT stock s FROM cm_skus WHERE slug='honey' AND vkey=''").s === 4);
/* أحداث وقوائم */
ok("order.created صدر مرة لكل طلب وبمرجعه", sqlAll("SELECT ext_id FROM pf_events WHERE type='order.created'").every((e) => e.ext_id.startsWith("order.created:")) && sqlAll("SELECT id FROM pf_events WHERE type='order.created' AND ext_id=?", "order.created:" + okOrder.ref).length === 1);
[, b] = await call("GET", "/v1/orders", null, A.key, { flagged: "1" }); ok("قائمة المخالفة فقط (مع الهاتف)", b.orders.length === 1 && b.orders[0].phone === "0551234567" && b.orders[0].flags.length > 0, b);
[, b] = await call("GET", "/v1/orders/stats", null, A.key); ok("إحصاء الطلبات والوضع", b.orders >= 4 && b.flagged === 1 && b.mode === "enforce", b);
[, b] = await call("GET", "/v1/orders", null, B.key); ok("عزل الطلبات", b.orders.length === 0);
const [, pk] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create"], mode: "pub" });
[c] = await call("GET", "/v1/orders", null, pk.key, {}, { origin: "https://shop.example" }); ok("المفتاح العام لا يقرأ الطلبات 403", c === 403);
[c] = await call("POST", "/v1/orders", order(), pk.key, {}, { origin: "https://evil.example" }); ok("أصل غريب 403", c === 403);
done();
