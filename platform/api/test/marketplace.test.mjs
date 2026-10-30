/* السوق المشترك (دروبشيبينغ/أفلييت B2B): كتالوج مورّدين، استيراد بنقرة، حارس الطلب (مخزون + رصيد المورّد + ضمان العمولة)، تسوية «مُسلَّم»/«مرتجع»، وبقاء الدفتر متوازناً. */
import { makeEnv, Tally } from "./_harness.mjs";
import { marketplace, minPrice, feeOfCommission, supplierRef } from "../src/modules/marketplace.js";
import { commerce } from "../src/modules/commerce.js";
import { wallet } from "../src/modules/wallet.js";
const { ok, done } = Tally();
const E = makeEnv([marketplace, commerce, wallet]); const { call, adm, tenant, app, sql, sqlAll } = E;
const S = await tenant("Supplier", ["*"], "live", "supplier-site"), A = await tenant("Affiliate", ["*"], "live", "aff-site"), A2 = await tenant("Affiliate2");
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://aff.example"] } });
const [, pkr] = await adm("POST", `/admin/tenants/${A.id}/keys`, { scopes: ["order:create"], mode: "pub" }), PK = pkr.key;
const pub = (b) => call("POST", "/v1/orders", b, PK, {}, { origin: "https://aff.example" });
const bal = (tid, code) => E.sql("SELECT balance b FROM wl_accounts WHERE tenant_id=? AND code=? AND currency='DZD'", tid, code)?.b ?? 0;
const order = (o = {}) => ({ ref: "AFF-" + Math.random().toString(36).slice(2, 10), customer: { name: "أمين", phone: "0551234567" }, wilaya: "Alger", commune: "Kouba", dtype: "home", items: [{ slug: "mp-serum", qty: 2, price: 2400 }], subtotal: 4800, discount: 0, fee: 600, total: 5400, ...o });
const balanced = async () => (await adm("GET", "/admin/wallet/summary"))[1].balanced === true;

/* نقية */
ok("الحد الأدنى = سعر المورّد + العمولة", minPrice({ supplier_price: 1500, commission: 400 }) === 1900);
ok("رسم المنصة من العمولة", feeOfCommission(800, 10) === 80 && feeOfCommission(800, 0) === 0 && feeOfCommission(800, 100) === 800);
ok("مرجع المورّد", supplierRef(12) === "MKO-12");

/* ───── إدراج المورّد ───── */
const P = { slug: "serum", title: "سيروم الوجه", descr: "وصف <b>x</b>", image: "https://cdn.example/s.jpg", category: "تجميل", supplier_price: 1500, commission: 400, rrp: 2400, stock: 5 };
let [c, b] = await call("POST", "/v1/marketplace/products", { ...P, commission: 2400 }, S.key); ok("عمولة لا تقل عن سعر البيع مرفوضة (يبقى للمورّد جزء)", c === 400, b);
[c] = await call("POST", "/v1/marketplace/products", { ...P, commission: 0 }, S.key); ok("عمولة صفر مرفوضة", c === 400);
[c] = await call("POST", "/v1/marketplace/products", { ...P, slug: "bad slug" }, S.key); ok("slug غير صالح", c === 400);
[c, b] = await call("POST", "/v1/marketplace/products", P, S.key); ok("إدراج جديد ينتظر المراجعة", c === 201 && b.status === "pending", b);
const mpId = b.id;
[, b] = await call("GET", "/v1/marketplace/catalog", null, A.key); ok("الكتالوج لا يعرض ما لم يُعتمد", b.products.length === 0);
[c] = await call("POST", "/v1/marketplace/imports", { mp_id: mpId }, A.key); ok("لا استيراد لمنتج غير معتمد", c === 404);
[c] = await adm("POST", `/admin/marketplace/products/${mpId}/approve`, {}); ok("اعتماد المزوّد", c === 200);
[c] = await adm("POST", `/admin/marketplace/products/${mpId}/approve`, {}); ok("اعتماد مكرر 409", c === 409);
[, b] = await call("GET", "/v1/marketplace/catalog", null, A.key); ok("الكتالوج يعرض المنتج بأرقامه وصورة https", b.products.length === 1 && b.products[0].min_price === 2400 && b.products[0].supplier_price === 2000 && b.products[0].commission === 400 && b.products[0].imported === false && b.products[0].descr.includes("x") && !b.products[0].descr.includes("<"), b);
[, b] = await call("GET", "/v1/marketplace/catalog", null, S.key); ok("المورّد لا يرى منتجاته في كتالوج الاستيراد", b.products.length === 0);
[c] = await call("POST", "/v1/marketplace/imports", { mp_id: mpId }, S.key); ok("لا استيراد لمنتجك", c === 404 || c === 409);

/* ───── الاستيراد بنقرة ───── */
[c, b] = await call("POST", "/v1/marketplace/imports", { mp_id: mpId, price: 1800 }, A.key); ok("الأفلييت لا يغيّر سعر البيع (مقفل)", c === 400 && b.error.code === "price_locked", b);
[c, b] = await call("POST", "/v1/marketplace/imports", { mp_id: mpId }, A.key); ok("استيراد بالسعر المقترح", c === 201 && b.slug === "mp-serum" && b.price === 2400 && b.product.title === "سيروم الوجه", b);
[c, b] = await call("POST", "/v1/marketplace/imports", { mp_id: mpId, price: 2500 }, A.key); ok("إعادة الاستيراد بسعر مختلف مرفوضة", c === 400);
[c] = await call("POST", "/v1/marketplace/imports", { mp_id: mpId }, A.key); ok("إعادة الاستيراد لا تكرّر", c === 200 && sql("SELECT COUNT(*) n FROM mk_imports WHERE tenant_id=?", A.id).n === 1 && sql("SELECT price p FROM mk_imports WHERE tenant_id=?", A.id).p === 2400);
await call("POST", "/v1/marketplace/imports", { mp_id: mpId }, A.key); await app.cron();
ok("المنتج يصل كتالوج الأفلييت (commerce) بمخزون المورّد", sql("SELECT s.stock st, s.price pr FROM cm_skus s WHERE s.tenant_id=? AND s.slug='mp-serum' AND s.vkey=''", A.id)?.st === 5 && sql("SELECT s.price pr FROM cm_skus s WHERE s.tenant_id=? AND s.slug='mp-serum'", A.id).pr === 2400);
[, b] = await call("GET", "/v1/marketplace/imports", null, A.key); ok("قائمة المستورد بمخزون حيّ وحالة قابل للبيع", b.imports[0].stock === 5 && b.imports[0].sellable === true && b.imports[0].min_price === 2400 && b.imports[0].price === 2400, b);
[, b] = await call("GET", "/v1/marketplace/catalog", null, A.key); ok("الكتالوج يعلّم المستورد", b.products[0].imported === true);

/* ───── حارس الطلب: رصيد المورّد صفر ← رفض + تنبيه ───── */
const o1 = order(); [c, b] = await pub(o1); ok("رصيد المورّد لا يكفي العمولة ← الطلب مرفوض", c === 409 && b.error.code === "supplier_unavailable", b);
ok("لا طلب عند الأفلييت ولا مخزون مستهلك", !sql("SELECT 1 x FROM cm_orders WHERE ref=?", o1.ref) && sql("SELECT stock s FROM mk_products WHERE id=?", mpId).s === 5);
ok("يُسجَّل طلب مرفوض لتنبيه المورّد", sql("SELECT state s, detail d FROM mk_orders WHERE ref=?", o1.ref).s === "rejected" && sql("SELECT detail d FROM mk_orders WHERE ref=?", o1.ref).d === "supplier_funds");
await app.cron(); ok("حدث تنبيه نقص الرصيد على مستأجر المورّد", sqlAll("SELECT type FROM pf_events WHERE tenant_id=? AND type='marketplace.supplier_low_funds'", S.id).length === 1);
[, b] = await call("GET", "/v1/marketplace/wallet", null, S.key); ok("ملخص المورّد: رفض لعدم الرصيد", b.supplier.rejected_for_funds === 1, b);

/* ───── شحن رصيد المورّد ثم طلب ناجح: العمولة تُحجز في escrow ───── */
await adm("POST", `/admin/wallet/${S.id}/deposit`, { amount: 10000, ref: "DEP-S-1" });
[c, b] = await pub(o1); ok("بعد الشحن يُقبل الطلب (نفس ref بعد الرفض)", c === 201, b);
ok("العمولة 800 انتقلت من المتاح إلى escrow المورّد", bal(S.id, "available") === 9200 && bal(S.id, "mk_escrow") === 800);
ok("مخزون المورّد 3", sql("SELECT stock s FROM mk_products WHERE id=?", mpId).s === 3);
const row = sql("SELECT * FROM mk_orders WHERE ref=? AND state='pending'", o1.ref); ok("سطر موجَّه pending بالعمولة والهاتف مشفّر", row && row.commission === 800 && row.qty === 2 && row.supplier_id === S.id && !JSON.stringify(row).includes("0551234567"), row);
await app.cron();
ok("المرآة: مخزون الأفلييت صار 3", sql("SELECT stock s FROM cm_skus WHERE tenant_id=? AND slug='mp-serum'", A.id).s === 3);
ok("حدث توجيه الطلب للمورّد", sqlAll("SELECT payload FROM pf_events WHERE tenant_id=? AND type='marketplace.order_routed'", S.id).length === 1);
ok("الدفتر متوازن", await balanced());

/* حراس إضافية */
[c, b] = await pub(order({ items: [{ slug: "mp-serum", qty: 4, price: 2400 }], subtotal: 9600, total: 10200 })); ok("كمية فوق مخزون المورّد 409 بلا أثر", c === 409 && b.error.code === "out_of_stock" && bal(S.id, "mk_escrow") === 800 && sql("SELECT stock s FROM mk_products WHERE id=?", mpId).s === 3, b);
await call("POST", "/v1/marketplace/products", { ...P, commission: 1000, rrp: 2600 }, S.key);       // المورّد رفع سعر البيع: يصل كل المستوردين (السعر مقفل)
await app.cron();
ok("تغيير المورّد لسعر البيع يصل المستورد وكتالوجه", sql("SELECT price p FROM mk_imports WHERE tenant_id=?", A.id).p === 2600 && sql("SELECT s.price pr FROM cm_skus s WHERE s.tenant_id=? AND s.slug='mp-serum'", A.id).pr === 2600);
await call("POST", "/v1/marketplace/products", { ...P, stock: 3 }, S.key);
[c, b] = await pub(order({ items: [{ slug: "mp-serum", vid: "x", qty: 1, price: 2400 }], subtotal: 2400, total: 3000 })); ok("التنويعات غير مدعومة في السوق (حتى لو جهلها الكتالوج)", c === 422 && b.error.code === "variant_unsupported", b);

/* ───── عرض الطلب عند المورّد (للشحن) وعند الأفلييت (للقراءة) ───── */
[, b] = await call("GET", "/v1/marketplace/orders", null, S.key, { role: "supplier" }); const so = b.orders.find((x) => x.ref === o1.ref && x.state === "pending");
ok("المورّد يرى بيانات الزبون ومبلغ التحصيل", so && so.customer.phone === "0551234567" && so.customer.wilaya === "Alger" && so.collect === 5400 && so.mko === supplierRef(so.id), b);
[, b] = await call("GET", "/v1/marketplace/orders", null, A.key, { role: "affiliate" }); ok("الأفلييت يرى عمولته بلا هاتف", b.orders[0].commission === 800 && b.orders[0].state === "pending" && !JSON.stringify(b).includes("0551234567"), b);
[, b] = await call("GET", "/v1/marketplace/orders", null, A2.key, { role: "supplier" }); ok("عزل: مستأجر آخر لا يرى شيئاً", b.orders.length === 0);
[c] = await call("POST", `/v1/marketplace/orders/${so.id}/status`, { status: "delivered" }, A.key); ok("الأفلييت لا يحدّث حالة طلب المورّد", c === 404);
[c] = await call("POST", `/v1/marketplace/orders/${so.id}/status`, { status: "bogus" }, S.key); ok("حالة غير معروفة 400", c === 400);
[c, b] = await call("POST", `/v1/marketplace/orders/${so.id}/status`, { status: "shipped" }, S.key); ok("شُحن", c === 200 && b.ship === "shipped");

/* ───── «مُسلَّم» ← العمولة من escrow المورّد إلى متاح الأفلييت ───── */
[c, b] = await call("POST", `/v1/marketplace/orders/${so.id}/status`, { status: "delivered" }, S.key); ok("تسليم يحرّر العمولة", c === 200 && b.state === "available", b);
ok("escrow المورّد صفر ومتاح الأفلييت 800", bal(S.id, "mk_escrow") === 0 && bal(S.id, "available") === 9200 && bal(A.id, "available") === 800);
[c] = await call("POST", `/v1/marketplace/orders/${so.id}/status`, { status: "delivered" }, S.key); ok("لا تسوية مرتين", c === 409 && bal(A.id, "available") === 800);
await app.cron(); ok("طلب الأفلييت الأصلي صار livree (قراءة فقط ثم يتحدّث بالحدث)", sql("SELECT status s FROM cm_orders WHERE tenant_id=? AND ref=?", A.id, o1.ref).s === "livree");
ok("الدفتر متوازن بعد التسليم", await balanced());
[, b] = await call("GET", "/v1/marketplace/wallet", null, A.key); ok("محفظة الأفلييت: متاح 800 وعمولات محرَّرة", b.available === 800 && b.affiliate.available === 800 && b.affiliate.pending === 0, b);

/* ───── «مرتجع» من ناقل موثوق (gw:) ← تعود العمولة للمورّد والمخزون ───── */
const o2 = order({ items: [{ slug: "mp-serum", qty: 1, price: 2400 }], subtotal: 2400, total: 3000 }); await pub(o2);
const r2 = sql("SELECT id FROM mk_orders WHERE ref=?", o2.ref).id;
ok("عمولة 400 محجوزة والمخزون 2", bal(S.id, "mk_escrow") === 400 && sql("SELECT stock s FROM mk_products WHERE id=?", mpId).s === 2);
[c] = await adm("POST", "/admin/events", { site_ref: "supplier-site", type: "order.returned", id: "gw-ret-1", data: { order_id: supplierRef(r2) } }); ok("حدث مرتجع من البوابة", c === 200 || c === 201 || c === 202);
await app.cron();
ok("العمولة عادت للمتاح والمخزون 3 والحالة returned", bal(S.id, "mk_escrow") === 0 && bal(S.id, "available") === 9200 && sql("SELECT stock s FROM mk_products WHERE id=?", mpId).s === 3 && sql("SELECT state s FROM mk_orders WHERE id=?", r2).s === "returned" && bal(A.id, "available") === 800);
await app.cron(); ok("طلب الأفلييت صار echec بعد المرتجع", sql("SELECT status s FROM cm_orders WHERE tenant_id=? AND ref=?", A.id, o2.ref).s === "echec");
ok("الدفتر متوازن بعد المرتجع", await balanced());

/* ───── ادّعاء مرتجع من المورّد بلا ناقل ← تبقى العمولة محجوزة حتى قرار المزوّد ───── */
const o3 = order({ items: [{ slug: "mp-serum", qty: 1, price: 2400 }], subtotal: 2400, total: 3000 }); await pub(o3); const r3 = sql("SELECT id FROM mk_orders WHERE ref=?", o3.ref).id;
await call("POST", `/v1/marketplace/orders/${r3}/status`, { status: "shipped" }, S.key);
[c, b] = await call("POST", `/v1/marketplace/orders/${r3}/status`, { status: "returned" }, S.key); ok("ادّعاء مرتجع ← return_claimed والعمولة محجوزة", c === 200 && b.state === "return_claimed" && bal(S.id, "mk_escrow") === 400, b);
[c] = await call("POST", `/v1/marketplace/orders/${r3}/status`, { status: "delivered" }, S.key); ok("لا تغيير بعد الادّعاء من المورّد", c === 409);
[, b] = await adm("GET", "/admin/marketplace/orders"); ok("المزوّد يرى الطلب بانتظار القرار", b.orders.some((x) => x.id === r3));
await adm("PUT", "/admin/marketplace/settings", { fee_pct: 10 });
[c, b] = await adm("POST", `/admin/marketplace/orders/${r3}/resolve`, { outcome: "delivered" }); ok("المزوّد يحسم لصالح الأفلييت ← تُحرَّر العمولة برسم 10%", c === 200 && b.state === "available" && bal(S.id, "mk_escrow") === 0 && bal(A.id, "available") === 800 + 360 && sql("SELECT balance b FROM wl_accounts WHERE tenant_id=0 AND code='platform_fees'").b === 40, b);
[c] = await adm("POST", `/admin/marketplace/orders/${r3}/resolve`, { outcome: "returned" }); ok("لا حسم مرتين", c === 409);
ok("الدفتر متوازن", await balanced());

/* ───── تراجع كامل إن فشل الطلب بعد الحارس (enforce: سعر مخالف) ───── */
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://aff.example"], order_mode: "enforce" } });
const before = { esc: bal(S.id, "mk_escrow"), av: bal(S.id, "available"), st: sql("SELECT stock s FROM mk_products WHERE id=?", mpId).s };
const bad = order({ items: [{ slug: "mp-serum", qty: 1, price: 2400 }], subtotal: 2400, total: 99999 }); [c, b] = await pub(bad);
ok("طلب مخالف في enforce مرفوض", c === 422, b);
ok("الحجز والمخزون والسطر تراجعت", bal(S.id, "mk_escrow") === before.esc && bal(S.id, "available") === before.av && sql("SELECT stock s FROM mk_products WHERE id=?", mpId).s === before.st && !sql("SELECT 1 x FROM mk_orders WHERE ref=?", bad.ref));
[c] = await pub(order({ items: [{ slug: "mp-serum", qty: 1, price: 2400 }], subtotal: 2400, total: 3000 })); ok("طلب سليم في enforce يمرّ", c === 201);
await adm("PATCH", `/admin/tenants/${A.id}`, { settings: { origins: ["https://aff.example"] } });

/* ───── إيقاف المورّد للمنتج ← يختفي من كتالوج الأفلييت ويُرفض الطلب ───── */
const mine = (await call("GET", "/v1/marketplace/products", null, S.key))[1].products[0]; ok("منتجاتي بعدد المستوردين", mine.importers === 1, mine);
[c, b] = await call("PATCH", `/v1/marketplace/products/${mpId}`, { status: "paused" }, S.key); ok("إيقاف الإدراج", c === 200 && b.status === "paused");
await app.cron(); ok("المرآة: المنتج غير نشط عند الأفلييت", sql("SELECT active a FROM cm_skus WHERE tenant_id=? AND slug='mp-serum'", A.id).a === 0);
[c, b] = await pub(order()); ok("منتج موقوف ← طلب مرفوض", c === 409 && b.error.code === "supplier_unavailable", b);
[c] = await call("PATCH", `/v1/marketplace/products/${mpId}`, { status: "active", stock: 20 }, S.key); await app.cron();
ok("استئناف وتحديث المخزون لحظياً عند الأفلييت", c === 200 && sql("SELECT stock s, active a FROM cm_skus WHERE tenant_id=? AND slug='mp-serum'", A.id).s === 20 && sql("SELECT active a FROM cm_skus WHERE tenant_id=? AND slug='mp-serum'", A.id).a === 1);
[c] = await adm("POST", `/admin/marketplace/products/${mpId}/suspend`, { note: "مخالفة" }); await app.cron(); ok("إيقاف الإدارة", c === 200 && sql("SELECT active a FROM cm_skus WHERE tenant_id=? AND slug='mp-serum'", A.id).a === 0);
[c] = await call("PATCH", `/v1/marketplace/products/${mpId}`, { status: "active" }, S.key); ok("المورّد لا يرفع إيقاف الإدارة", c === 409);
[c] = await adm("POST", `/admin/marketplace/products/${mpId}/approve`, {}); ok("الإدارة تعيده", c === 200);
[c, b] = await call("PATCH", `/v1/marketplace/imports/${sql("SELECT id i FROM mk_imports WHERE tenant_id=?", A.id).i}`, { price: 1000 }, A.key); ok("تعديل سعر الاستيراد مرفوض (مقفل)", c === 400 && b.error.code === "price_locked", b);
[c, b] = await call("PATCH", `/v1/marketplace/imports/${sql("SELECT id i FROM mk_imports WHERE tenant_id=?", A.id).i}`, { active: false }, A.key); ok("الأفلييت يوقف منتجه", c === 200 && b.active === false);
[c] = await pub(order()); ok("استيراد موقوف ← طلب مرفوض", c === 409);

/* ───── منتج عادي (غير مستورد) لا يتأثر بالحارس ───── */
await call("PUT", "/v1/catalog/products", { products: [{ slug: "own", title: "منتجي", price: 1000, stock: 3 }] }, A.key);
[c] = await pub(order({ items: [{ slug: "own", qty: 1, price: 1000 }], subtotal: 1000, total: 1600 })); ok("منتج عادي يمرّ بلا مرور بالسوق", c === 201);
[c] = await call("GET", "/admin/marketplace/settings"); ok("الإعدادات للإدارة فقط", c === 401 || c === 403);
done();
