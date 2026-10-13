/* الهَب المركزي للمصادر: دوال نقية + مزامنة Shopify/WooCommerce/Google Sheets بمحاكاة fetch + عرض موحّد + عزل المستأجرين. */
import { makeEnv, Tally } from "./_harness.mjs";
import { sources, parseNum, parseDate, statusFromText, cleanPhone, parseCsv, sheetColumns, parseSheetRows, sheetRef, linkNext, parseShopify, parseWoo, validateSource } from "../src/modules/sources.js";
const { ok, done } = Tally();

/* ── نقية ── */
ok("parseNum: آلاف بنقطة/فاصلة/مسافة وعربية", parseNum("3 500 دج") === 3500 && parseNum("3.500") === 3500 && parseNum("3.500,50") === 3500.5 && parseNum("1,234.5") === 1234.5 && parseNum("٣٥٠٠") === 3500 && parseNum("1500.50") === 1500.5 && parseNum("12,5") === 12.5 && parseNum("3,500") === 3500 && parseNum("abc") === 0);
ok("parseDate: ISO وdd/mm/yyyy بتوقيت الجزائر", parseDate("2026-10-12T10:00:00Z") === 1791799200 && parseDate("12/10/2026 11:00:00") === 1791799200 && parseDate("2026-10-12 11:00:00") === 1791799200 && parseDate("") === null && parseDate("غير تاريخ") === null);
ok("parseDate: شهر>12 يُعكس", parseDate("10/25/2026") === parseDate("25/10/2026"));
ok("statusFromText: fr/ar/en", statusFromText("Confirmé") === "confirmee" && statusFromText("annulé") === "annulee" && statusFromText("تم التسليم") === "livree" && statusFromText("En livraison") === "expediee" && statusFromText("Retour") === "echec" && statusFromText("") === "nouvelle" && statusFromText("تم التأكيد") === "confirmee" && statusFromText("non livré") !== "livree");
ok("cleanPhone: جزائري محلي وغيره أرقام", cleanPhone("+213 551 23 45 67") === "0551234567" && cleanPhone("0033612345678").length > 6 && cleanPhone("12") === "");
const csv = parseCsv('﻿Horodateur;Nom;Téléphone;Wilaya;Produit;Total;Statut\n12/10/2026 11:00:00;"Amine ""Z""";0551234567;Alger;"Miel\nSidr";3 500;Confirmé\n\n13/10/2026 09:00;Sara;0661000000;Oran;Crème;1.800;');
ok("parseCsv: BOM وفاصلة منقوطة وعلامات اقتباس وسطر داخل خلية", csv.length === 3 && csv[1][1] === 'Amine "Z"' && csv[1][4] === "Miel\nSidr" && csv[2][3] === "Oran");
const cols = sheetColumns(csv[0]); ok("sheetColumns: كشف fr", cols.date === 0 && cols.name === 1 && cols.phone === 2 && cols.wilaya === 3 && cols.product === 4 && cols.total === 5 && cols.status === 6, cols);
const ar = sheetColumns(["التاريخ", "الاسم واللقب", "رقم الهاتف", "الولاية", "المنتج", "الكمية", "السعر"]); ok("sheetColumns: كشف عربي", ar.date === 0 && ar.name === 1 && ar.phone === 2 && ar.wilaya === 3 && ar.product === 4 && ar.qty === 5 && ar.total === 6, ar);
ok("sheetColumns: خريطة يدوية تتغلب", sheetColumns(["A", "B", "Num"], { phone: "Num", name: "B" }).phone === 2);
const ps = parseSheetRows(csv, { tz_offset_min: 60 }); ok("parseSheetRows: صفان صحيحان", ps.orders.length === 2 && ps.orders[0].total === 3500 && ps.orders[0].status === "confirmee" && ps.orders[0].at === 1791799200 && ps.orders[1].total === 1800 && ps.orders[1].ext_id === "r2", ps.orders);
ok("parseSheetRows: بلا عمود هاتف", parseSheetRows([["x", "y"], ["1", "2"]]).missing.includes("phone"));
ok("sheetRef: رابط/معرّف/منشور", sheetRef("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=345").gid === "345" && sheetRef("1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789").sheet_id && sheetRef("https://docs.google.com/spreadsheets/d/e/2PACX-1vTabcdefghijklmnopqrstuvwxyz/pub?output=csv").csv_url && sheetRef("https://evil.com/x") === null && sheetRef("") === null);
ok("linkNext", linkNext('<https://x.myshopify.com/a?page_info=1>; rel="previous", <https://x.myshopify.com/a?page_info=2>; rel="next"') === "https://x.myshopify.com/a?page_info=2" && linkNext("") === null);
const shop1 = { id: 1001, name: "#1001", created_at: "2026-10-12T10:05:00+01:00", updated_at: "2026-10-12T10:06:00+01:00", financial_status: "pending", fulfillment_status: null, total_price: "3500.00", currency: "DZD", phone: null, customer: { first_name: "Amine", last_name: "B", phone: "+213551234567" }, shipping_address: { name: "Amine Benali", city: "Kouba", province: "Alger", address1: "Rue 1", address2: "Bt 2", phone: "" }, line_items: [{ title: "Miel", quantity: 2, price: "1750.00", variant_title: "500g" }] };
const ph = parseShopify(shop1); ok("parseShopify: حقول وحالة جديدة (COD pending)", ph.ext_id === "1001" && ph.number === "#1001" && ph.status === "nouvelle" && ph.name === "Amine Benali" && ph.phone === "0551234567" && ph.wilaya === "Alger" && ph.address === "Rue 1 Bt 2" && ph.total === 3500 && ph.items[0].qty === 2 && ph.items[0].title === "Miel — 500g", ph);
ok("parseShopify: ملغى/مشحون/مدفوع/مسترد", parseShopify({ ...shop1, cancelled_at: "2026-10-12T12:00:00Z" }).status === "annulee" && parseShopify({ ...shop1, fulfillment_status: "fulfilled" }).status === "expediee" && parseShopify({ ...shop1, financial_status: "paid" }).status === "confirmee" && parseShopify({ ...shop1, financial_status: "refunded" }).status === "echec");
ok("parseShopify: بيانات عميل محجوبة لا تكسر", parseShopify({ id: 5, name: "#5", created_at: "2026-10-12T10:00:00Z", total_price: "10", currency: "USD", line_items: [] }).name === "");
const woo1 = { id: 77, number: "77", status: "processing", date_created_gmt: "2026-10-12T09:00:00", total: "4200.00", currency: "DZD", billing: { first_name: "Sara", last_name: "L", phone: "0661000000", city: "Oran", state: "DZ-31", address_1: "Cité 5" }, shipping: { first_name: "", last_name: "", state: "", city: "" }, line_items: [{ name: "Crème", quantity: 2, total: "4200.00" }], date_modified_gmt: "2026-10-12T09:30:00" };
const pw = parseWoo(woo1); ok("parseWoo: حقول (الشحن الفارغ يعود للفوترة)", pw.ext_id === "77" && pw.status === "confirmee" && pw.name === "Sara L" && pw.city === "Oran" && pw.wilaya === "DZ-31" && pw.at === 1791795600 && pw.items[0].price === 2100, pw);
ok("parseWoo: حالات", parseWoo({ ...woo1, status: "completed" }).status === "livree" && parseWoo({ ...woo1, status: "cancelled" }).status === "annulee" && parseWoo({ ...woo1, status: "on-hold" }).status === "nouvelle" && parseWoo({ ...woo1, status: "refunded" }).status === "echec");
const thr = (f) => { try { f(); return null; } catch (e) { return e; } };
ok("validateSource: نطاق shopify/مفاتيح woo", thr(() => validateSource("shopify", { shop: "evil.com" }, { token: "x".repeat(20) }))?.status === 400 && thr(() => validateSource("shopify", { shop: "https://My-Shop.myshopify.com/admin" }, { token: "shpat_" + "a".repeat(30) })) === null && thr(() => validateSource("woocommerce", { url: "https://10.0.0.1" }, { key: "ck_" + "a".repeat(30), secret: "cs_" + "a".repeat(30) }))?.status === 400 && thr(() => validateSource("woocommerce", { url: "mysite.com/wp-json/wc/v3" }, { key: "bad", secret: "cs_" + "a".repeat(30) }))?.status === 400 && validateSource("woocommerce", { url: "mysite.com/wp-json/wc/v3" }, { key: "ck_" + "a".repeat(30), secret: "cs_" + "a".repeat(30) }).cfg.url === "https://mysite.com");
ok("validateSource: فاصل المزامنة", thr(() => validateSource("gsheet", { url: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", interval_min: 1 }))?.status === 400 && validateSource("gsheet", { url: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789" }).cfg.interval_min === 5);

/* ── تكامل ── */
const E = makeEnv([sources]); const { call, tenant, fake, clock, sql, sqlAll, app } = E;
const A = await tenant("A"), B = await tenant("B"), T = await tenant("T", ["*"], "test");
const SH = "mystore.myshopify.com", TOKEN = "shpat_" + "a1".repeat(16);
let [c, b] = await call("PUT", "/v1/sources", { kind: "shopify", name: "متجري <b>شوبيفاي</b>", config: { shop: SH }, secrets: { token: TOKEN } }, A.key);
ok("إضافة Shopify 201", c === 201 && b.id > 0, b); const shId = b.id;
ok("الرمز مشفّر في القاعدة", !JSON.stringify(sql("SELECT * FROM src_sources WHERE id=?", shId)).includes(TOKEN) && sql("SELECT secret_enc FROM src_sources WHERE id=?", shId).secret_enc.includes('"ct"'));
ok("الاسم يُنظَّف من الوسوم", sql("SELECT name FROM src_sources WHERE id=?", shId).name === "متجري شوبيفاي");
[c, b] = await call("GET", "/v1/sources", null, A.key); ok("القائمة بلا أسرار", c === 200 && b.sources.length === 1 && b.sources[0].has_secrets === true && !JSON.stringify(b).includes(TOKEN) && b.sources[0].config.shop === SH);
[c] = await call("PUT", "/v1/sources", { kind: "shopify", name: "x", config: { shop: "evil.com" }, secrets: { token: TOKEN } }, A.key); ok("نطاق غير myshopify 400", c === 400);
[c] = await call("PUT", "/v1/sources", { kind: "shopify", name: "x", config: { shop: SH } }, A.key); ok("بلا رمز 400", c === 400);
[c, b] = await call("PUT", "/v1/sources", { kind: "shopify", name: "x", config: { shop: SH }, secrets: { token: TOKEN } }, T.key); ok("مفتاح الاختبار sandbox بلا كتابة", c === 200 && b.sandbox === true && sql("SELECT COUNT(*) n FROM src_sources").n === 1);

/* مزامنة Shopify بصفحتين */
const mkShop = (id, extra = {}) => ({ ...shop1, id, name: "#" + id, ...extra });
fake.handler = (url, init) => {
  if (url.startsWith(`https://${SH}/admin/api/`) && !url.includes("page_info")) return [200, { orders: [mkShop(1001), mkShop(1002, { financial_status: "paid" })] }, { link: `<https://${SH}/admin/api/2026-07/orders.json?page_info=P2&limit=250>; rel="next"` }];
  if (url.includes("page_info=P2")) return [200, { orders: [mkShop(1003, { cancelled_at: "2026-10-12T12:00:00Z" })] }, {}];
  return [404, "{}"];
};
[c, b] = await call("POST", `/v1/sources/${shId}/sync`, null, A.key);
ok("مزامنة Shopify: 3 طلبات عبر صفحتين", c === 200 && b.ok === true && b.added === 3 && b.more === false, b);
ok("الترويسة والمسار: رمز الوصول وstatus=any وcreated_at_min للمزامنة الأولى", fake.calls[0].init.headers["X-Shopify-Access-Token"] === TOKEN && /orders\.json\?status=any&limit=250&created_at_min=/.test(fake.calls[0].url) && fake.calls.length === 2);
ok("الهاتف والعنوان مشفّران، والاسم نص", !JSON.stringify(sqlAll("SELECT * FROM src_orders")).includes("0551234567") && !JSON.stringify(sqlAll("SELECT * FROM src_orders")).includes("Rue 1") && sql("SELECT name FROM src_orders LIMIT 1").name === "Amine Benali");
[c, b] = await call("GET", "/v1/sources", null, A.key); ok("حالة المصدر بعد المزامنة", b.sources[0].order_count === 3 && b.sources[0].last_error === null && b.sources[0].last_ok_at > 0 && b.sources[0].syncing === false);
fake.calls.length = 0; clock.t += 7 * 60_000;
fake.handler = (url) => [200, { orders: [mkShop(1001, { financial_status: "paid", fulfillment_status: "fulfilled" }), mkShop(1002, { financial_status: "paid" })] }, {}];
[c, b] = await call("POST", `/v1/sources/${shId}/sync`, null, A.key);
ok("مزامنة ثانية: يُعدَّل المتغيّر فقط ولا تكرار", b.added === 0 && b.changed === 1 && sql("SELECT COUNT(*) n FROM src_orders").n === 3 && sql("SELECT status FROM src_orders WHERE ext_id='1001'").status === "expediee", b);
ok("المزامنة التزايدية تستعمل updated_at_min", /updated_at_min=/.test(fake.calls[0].url) && !/created_at_min/.test(fake.calls[0].url), fake.calls[0].url);

/* WooCommerce: صفحتان (100 + 1) */
[c, b] = await call("PUT", "/v1/sources", { kind: "woocommerce", name: "Woo", config: { url: "https://boutique.dz/wp-json/wc/v3/" }, secrets: { key: "ck_" + "b".repeat(32), secret: "cs_" + "c".repeat(32) } }, A.key); const wooId = b.id; ok("إضافة WooCommerce وتطبيع الرابط", c === 201 && JSON.parse(sql("SELECT config FROM src_sources WHERE id=?", wooId).config).url === "https://boutique.dz");
fake.calls.length = 0;
fake.handler = (url, init) => {
  if (!url.startsWith("https://boutique.dz/wp-json/wc/v3/orders")) return [404, "{}"];
  const pg = +/[?&]page=(\d+)/.exec(url)[1];
  return [200, pg === 1 ? Array.from({ length: 100 }, (_, i) => ({ ...woo1, id: 2000 + i, number: String(2000 + i) })) : [{ ...woo1, id: 2100, number: "2100", status: "completed" }]];
};
[c, b] = await call("POST", `/v1/sources/${wooId}/sync`, null, A.key);
ok("Woo: 101 طلباً عبر صفحتين", b.ok && b.added === 101 && fake.calls.length === 2, b);
ok("Woo: مصادقة Basic بالمفتاحين و after للمزامنة الأولى", fake.calls[0].init.headers.Authorization === "Basic " + btoa("ck_" + "b".repeat(32) + ":cs_" + "c".repeat(32)) && /after=/.test(fake.calls[0].url) && /page=1/.test(fake.calls[0].url) && /page=2/.test(fake.calls[1].url));

/* Google Sheets */
const SHEET = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0";
[c, b] = await call("PUT", "/v1/sources", { kind: "gsheet", name: "فورم تيك توك", config: { url: SHEET } }, A.key); const gsId = b.id; ok("إضافة جدول بلا أسرار", c === 201 && sql("SELECT secret_enc FROM src_sources WHERE id=?", gsId).secret_enc === null);
fake.calls.length = 0; fake.handler = () => [200, 'Horodateur,Nom,Téléphone,Wilaya,Produit,Total,Statut\n12/10/2026 11:30:00,Karim,0771234567,Blida,Miel,2500,\n12/10/2026 12:00:00,Lina,0551111111,Alger,Crème,1800,Annulé\n'];
[c, b] = await call("POST", `/v1/sources/${gsId}/sync`, null, A.key); ok("جدول: صفان", b.ok && b.added === 2 && /export\?format=csv&gid=0/.test(fake.calls[0].url), b);
clock.t += 7 * 60_000; fake.handler = () => [200, 'Horodateur,Nom,Téléphone,Wilaya,Produit,Total,Statut\n12/10/2026 11:30:00,Karim,0771234567,Blida,Miel,2500,Confirmé\n12/10/2026 12:00:00,Lina,0551111111,Alger,Crème,1800,Annulé\n13/10/2026 08:00:00,Omar,0661222333,Sétif,Savon,900,\n'];
[, b] = await call("POST", `/v1/sources/${gsId}/sync`, null, A.key); ok("جدول: صف جديد وتغيير حالة بلا تكرار", b.added === 1 && b.changed === 1 && sql("SELECT COUNT(*) n FROM src_orders WHERE source_id=?", gsId).n === 3, b);
fake.handler = () => [200, "<!DOCTYPE html><html><body>Sign in</body></html>"]; [, b] = await call("POST", `/v1/sources/${gsId}/sync`, null, A.key);
ok("جدول غير عام ← رسالة واضحة محفوظة", b.ok === false && /غير عام/.test(b.error) && /غير عام/.test(sql("SELECT last_error FROM src_sources WHERE id=?", gsId).last_error));
fake.handler = () => [200, "a,b\n1,2\n"]; [, b] = await call("POST", `/v1/sources/${gsId}/sync`, null, A.key); ok("جدول بلا عمود هاتف ← رسالة", b.ok === false && /الهاتف/.test(b.error));

/* العرض الموحّد */
[c, b] = await call("GET", "/v1/sources/orders", null, A.key, { limit: "200" });
ok("القائمة الموحّدة: 3+101+3 طلباً من 3 مصادر، الأحدث أولاً", c === 200 && b.orders.length === 107 && new Set(b.orders.map((o) => o.kind)).size === 3 && b.orders.every((o, i, a) => i === 0 || a[i - 1].created_at >= o.created_at), b.orders?.length);
const one = b.orders.find((o) => o.ext_id === "1001"); ok("الطلب: هاتف وعنوان مفكوكان وعناصر", one.phone === "0551234567" && one.address === "Rue 1 Bt 2" && one.items[0].qty === 2 && one.source_name === "متجري شوبيفاي" && one.status === "expediee", one);
[, b] = await call("GET", "/v1/sources/orders", null, A.key, { source: String(gsId) }); ok("مرشّح المصدر", b.orders.length === 3 && b.orders.every((o) => o.source_id === gsId));
[, b] = await call("GET", "/v1/sources/orders", null, A.key, { status: "annulee" }); ok("مرشّح الحالة", b.orders.length >= 2 && b.orders.every((o) => o.status === "annulee"));
[, b] = await call("GET", "/v1/sources/orders", null, A.key, { q: "karim" }); ok("بحث بالاسم", b.orders.length === 1 && b.orders[0].name === "Karim");
[, b] = await call("GET", "/v1/sources/orders", null, A.key, { q: "0771234567" }); ok("بحث بالهاتف (بصمة)", b.orders.length === 1 && b.orders[0].name === "Karim");
[, b] = await call("GET", "/v1/sources/orders", null, A.key, { q: "%" }); ok("% لا يعمل كشرط عام", b.orders.length === 0);
let p1; [, p1] = await call("GET", "/v1/sources/orders", null, A.key, { limit: "50" }); ok("ترقيم بمؤشر: 50 ثم التالي", p1.orders.length === 50 && /^\d+\.\d+$/.test(p1.next));
const seen = new Set(p1.orders.map((o) => o.id)); let cur = p1.next, n = 50; while (cur) { const [, pg] = await call("GET", "/v1/sources/orders", null, A.key, { limit: "50", after: cur }); pg.orders.forEach((o) => { if (seen.has(o.id)) n = -1e9; seen.add(o.id); }); n += pg.orders.length; cur = pg.next; }
ok("الترقيم يغطي الكل بلا تكرار", n === 107 && seen.size === 107, { n, size: seen.size });
[, b] = await call("GET", "/v1/sources/orders", null, B.key); ok("عزل المستأجرين (قائمة فارغة)", b.orders.length === 0);
[c] = await call("POST", `/v1/sources/${shId}/sync`, null, B.key); ok("مستأجر آخر لا يزامن مصدرنا (404)", c === 404);
[c] = await call("DELETE", `/v1/sources/${shId}`, null, B.key); ok("ولا يحذفه", c === 404 && sql("SELECT COUNT(*) n FROM src_sources WHERE id=?", shId).n === 1);
const oid = one.id; [c] = await call("POST", `/v1/sources/orders/${oid}/imported`, {}, A.key); [, b] = await call("GET", "/v1/sources/orders", null, A.key, { q: "Amine" }); ok("تعليم «مستورد»", c === 200 && b.orders.find((o) => o.id === oid).imported === true);

/* إحصاءات */
[c, b] = await call("GET", "/v1/sources/stats", null, A.key, { tz: "60" });
const shS = b.sources.find((s) => s.id === shId), gsS = b.sources.find((s) => s.id === gsId);
ok("إحصاءات: كل مصدر بنافذاته (المبيعات تستثني الملغى)", c === 200 && b.sources.length === 3 && shS.windows.DZD.d30.n === 3 && shS.windows.DZD.d30.total === 7000 && gsS.windows.DZD.d30.n === 3 && gsS.windows.DZD.d30.total === 2500 + 900 && gsS.statuses.annulee === 1, { shS, gsS });
ok("إحصاءات: سلسلة يومية بالمصدر", Array.isArray(b.series) && b.series.some((x) => x.d === "2026-10-12" && x.source_id === shId && x.n === 3), b.series.slice(0, 3));

/* cron: يحترم الفاصل ويكمل المصادر المستحقة فقط */
fake.calls.length = 0; fake.handler = (url) => (url.includes("docs.google.com") ? [200, "Nom,Téléphone,Total\nZed,0550000001,500\n"] : url.includes("myshopify") ? [200, { orders: [] }, {}] : [200, []]);
await app.cron(); await app.cron(); await app.cron(); let cr = await app.cron(); ok("cron: لا شيء مستحق قبل الفاصل بعد مزامنة الكل", cr.sources.synced === 0, cr.sources);
const before = fake.calls.length; clock.t += 6 * 60_000; cr = await app.cron(); ok("cron: بعد 6 دقائق يزامن حتى 3 مصادر", cr.sources.synced >= 1 && cr.sources.synced <= 3 && fake.calls.length > before, cr.sources);
await call("POST", `/v1/sources/${wooId}/pause`, { paused: true }, A.key); fake.calls.length = 0; clock.t += 60 * 60_000; await app.cron(); ok("المصدر الموقوف لا يُزامن", !fake.calls.some((x) => x.url.includes("boutique.dz")));

/* أخطاء المتجر */
fake.handler = () => [401, "{}"]; [, b] = await call("POST", `/v1/sources/${shId}/sync`, null, A.key); ok("401 ← رسالة الرمز المرفوض، ولا تضيع الطلبات المخزَّنة", b.ok === false && /مرفوض/.test(b.error) && sql("SELECT COUNT(*) n FROM src_orders WHERE source_id=?", shId).n === 3);
fake.handler = () => [200, { orders: [mkShop(9)] }, { link: '<https://evil.example/steal?page_info=1>; rel="next"' }]; await call("PUT", "/v1/sources", { id: shId, name: "x", config: { shop: SH } }, A.key);
[, b] = await call("POST", `/v1/sources/${shId}/sync`, null, A.key); ok("رابط تصفح من نطاق آخر يُرفض (SSRF)", b.ok === false || b.more === false);
ok("لم يُجلب النطاق الغريب أبداً", !fake.calls.some((x) => x.url.includes("evil.example")));
fake.handler = () => [429, "{}"]; [, b] = await call("POST", `/v1/sources/${shId}/sync`, null, A.key); ok("429 ← رسالة تمهّل", b.ok === false && /التمهّل/.test(b.error) && b.status === 429);

/* التعديل والحذف والحد */
[c] = await call("PUT", "/v1/sources", { id: shId, name: "اسم جديد", config: { shop: SH, interval_min: 30 } }, A.key); ok("تعديل بلا أسرار يُبقي الرمز القديم", c === 200 && sql("SELECT name, secret_enc FROM src_sources WHERE id=?", shId).name === "اسم جديد" && sql("SELECT secret_enc FROM src_sources WHERE id=?", shId).secret_enc !== null);
[c] = await call("PUT", "/v1/sources", { id: shId, kind: "woocommerce", name: "x" }, A.key); ok("لا تغيير نوع", c === 400);
[c] = await call("DELETE", `/v1/sources/${gsId}`, null, A.key); ok("حذف مصدر يحذف طلباته", c === 200 && sql("SELECT COUNT(*) n FROM src_orders WHERE source_id=?", gsId).n === 0);
for (let i = 0; i < 12; i++) { [c, b] = await call("PUT", "/v1/sources", { kind: "gsheet", name: "g" + i, config: { url: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789" } }, B.key); if (c !== 201) break; }
ok("حدّ 10 مصادر لكل مستأجر", c === 409 && sql("SELECT COUNT(*) n FROM src_sources WHERE tenant_id=?", B.id).n === 10);
[c] = await call("GET", "/v1/sources", null, null); ok("بلا مفتاح 401", c === 401);
done();
