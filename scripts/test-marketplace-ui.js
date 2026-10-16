/* واجهة «سوق التوريد» على متصفح حقيقي بوسيط مُحاكى (الخادم والدفتر مختبَران في platform/api/test/marketplace.test.mjs):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-marketplace-ui.js */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0, total = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const NOW = Math.floor(Date.now() / 1000);
const DB = { off: false, calls: [], stock: 4,
  cat: [{ id: 7, slug: "serum", title: "سيروم <img src=x onerror=window.__pwn=1>", supplier: "مورّد", seller: { kind: "wholesale", delivered: 9, returned: 1, rate: 90 }, category: "skin", image: "https://cdn.example/s.jpg", supplier_price: 2000, commission: 400, rrp: 2800, stock: 4, imported: false }, { id: 8, slug: "oil", title: "زيت", supplier: "مورّد", image: "", supplier_price: 900, commission: 150, rrp: 1300, stock: null, imported: true }],
  imps: [], mine: [{ id: 3, slug: "honey", title: "عسل", supplier_price: 1500, commission: 300, rrp: 2200, stock: 9, status: "active", importers: 2, pending_orders: 1 }],
  ord: [{ id: 11, mko: "MKO-11", ref: "W1", title: "عسل", qty: 1, commission: 300, state: "pending", ship: "new", collect: 2200, created_at: NOW, customer: { name: "<b>علي</b>", phone: "0551234567", wilaya: "الجزائر", commune: "باب الزوار", dtype: "home" } }],
  aff: [{ id: 12, ref: "W9", title: "زيت", qty: 1, commission: 150, fee: 15, net_commission: 135, state: "pending", ship: "new", created_at: NOW, customer: { name: "سارة", wilaya: "وهران" } }] };
function handle(b) {
  DB.calls.push(b); const m = b.method, p = b.path; if (DB.off) return null;
  if (m === "GET" && p === "/v1/marketplace/wallet") return { available: 9000, supplier_escrow: 600, affiliate: { pending: 150, available: 800, returned: 0 }, supplier: { rejected_for_funds: 2, to_ship: 1 } };
  if (m === "GET" && p === "/v1/marketplace/catalog") return { products: DB.cat, next_offset: null };
  if (m === "GET" && p === "/v1/marketplace/imports") return { imports: DB.imps };
  if (m === "GET" && p === "/v1/marketplace/products") return { products: DB.mine };
  if (m === "GET" && p === "/v1/marketplace/orders") return { orders: b.query.role === "supplier" ? DB.ord : DB.aff };
  if (m === "POST" && p === "/v1/marketplace/imports") { const c = DB.cat.find((x) => x.id === b.body.mp_id); if (b.body.price < c.supplier_price + c.commission) return { __err: { status: 400, error: { code: "validation_error", message: "x" } } }; DB.imps = [{ id: 1, slug: b.body.slug, price: b.body.price, active: true, mp_id: c.id, min_price: c.supplier_price + c.commission, sellable: true, title: c.title, commission: c.commission, stock: DB.stock, product_status: "active", rrp: c.rrp }]; c.imported = true; return { id: 1, slug: b.body.slug, price: b.body.price, product: { ...c, descr: "وصف", images: [c.image] } }; }
  if (m === "POST" && /\/orders\/\d+\/status$/.test(p)) { DB.ord[0].state = b.body.status === "delivered" ? "available" : "pending"; if (b.body.status === "shipped") DB.ord[0].ship = "shipped"; return { ok: true }; }
  if (m === "PATCH" && /products\/\d+$/.test(p)) return { ok: true };
  return { __err: { status: 404, error: { code: "not_found" } } };
}
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("**/sb/functions/v1/platform-proxy", async (route) => {
    const b = JSON.parse(route.request().postData() || "{}"), r = handle(b);
    if (r === null) return route.fulfill({ status: 404, body: "{}" });
    if (r.__err) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: r.__err.status, data: { error: r.__err.error } }) });
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: 200, data: r }) });
  });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
  await p.goto(base + "/__blank");
  await p.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-market" class="hidden"><div id="market-content"></div></div>';
    window.__toasts = []; window.__pub = 0; window.API = { sb: { token: async () => "tok", url: (p) => "/sb" + p, headers: () => ({ "Content-Type": "application/json" }) } };
    window.Admin = { tab() { }, toast: (t) => window.__toasts.push(t), categories: { skin: "بشرة" }, products: [{ slug: "honey", title: "عسل", price: 2200, cover: "assets/img/h.webp", images: [], cat: "skin", desc: "ع" }], publishDataJs: async () => { window.__pub++; return true; }, renderProducts() { } };
    await new Promise((r) => { const e = document.createElement("script"); e.src = "/assets/js/admin-marketplace.js"; e.onload = r; document.body.appendChild(e); });
    Admin.tab("market");
  });
  await p.waitForSelector(".mk-cards", { timeout: 8000 });
  const txt = () => p.evaluate(() => document.getElementById("mk-app").textContent.replace(/[  ]/g, " "));
  let t = await txt();
  ok("بطاقات الملخص: المتاح والضمان والعمولات", /9 000 دج/.test(t) && /600 دج/.test(t) && /800 دج/.test(t));
  ok("تنبيه رصيد المورّد غير الكافي (طلبان مرفوضان)", /رُفض 2 طلب/.test(t));
  ok("الكتالوج: سعر المورّد والعمولة والمقترح، والعنوان يُهرَّب", /2 000 دج/.test(t) && /400 دج/.test(t) && /2 800 دج/.test(t) && await p.evaluate(() => !window.__pwn && !document.querySelector("#mk-app .mk-p img[src=x]")));
  ok("الكتالوج: شارة جملة ونسبة التسليم", /🏭 جملة/.test(t) && /90%/.test(t));
  await p.selectOption("#mk-seller", "retail"); await p.click('[data-mk="search"]'); await p.waitForTimeout(200);
  ok("فلتر البائع يُرسل seller", DB.calls.some((c) => c.path === "/v1/marketplace/catalog" && c.query && c.query.seller === "retail")); await p.selectOption("#mk-seller", ""); await p.click('[data-mk="search"]'); await p.waitForTimeout(200);
  ok("المنتج المستورد سابقاً يظهر «مستورد» بلا زر", /مستورد في متجرك/.test(t) && (await p.evaluate(() => document.querySelectorAll('[data-mk="imp"]').length === 1)));
  /* سعر أقل من الحد الأدنى */
  await p.fill("#mk-pr-7", "2300"); await p.click('[data-mk="imp"]'); ok("سعر أقل من (المورّد+العمولة) لا يُرسل", !DB.calls.some((c) => c.method === "POST" && c.path === "/v1/marketplace/imports"));
  /* استيراد بنقرة */
  await p.fill("#mk-pr-7", "2800"); await p.click('[data-mk="imp"]');
  await p.waitForFunction(() => window.__pub >= 1);
  const imp = DB.calls.find((c) => c.method === "POST" && c.path === "/v1/marketplace/imports");
  ok("الاستيراد يرسل المعرّف والسعر وslug نظيفاً [a-z0-9-]", imp && imp.body.mp_id === 7 && imp.body.price === 2800 && /^[a-z0-9-]+$/.test(imp.body.slug), imp && imp.body);
  const pr = await p.evaluate(() => Admin.products.find((x) => x.mpId === 7));
  ok("المنتج أُنشئ في المتجر مرتبطاً بالمورّد بالسعر والمخزون والحد الأدنى", pr && pr.price === 2800 && pr.stock === 4 && pr.mpMin === 2400 && pr.active === true && pr.cover === "https://cdn.example/s.jpg" && pr.cat === "skin", pr);
  /* مزامنة المخزون: نفد عند المورّد */
  await p.click('[data-mk="v"][data-v="imp"]'); DB.stock = 0; DB.imps[0].stock = 0; DB.imps[0].sellable = false;
  await p.click('[data-mk="sync"]'); await p.waitForFunction(() => window.__pub >= 2);
  const pr2 = await p.evaluate(() => Admin.products.find((x) => x.mpId === 7));
  ok("نفاد المخزون عند المورّد يوقف المنتج في متجرك", pr2.stock === 0 && pr2.active === false, pr2);
  /* سعر المستورد */
  await p.fill("#mk-ip-1", "2900"); await p.click('[data-mk="ipr"]');
  ok("تعديل سعر المستورد يرسل PATCH", DB.calls.some((c) => c.method === "PATCH" && /imports\/1$/.test(c.path) && c.body.price === 2900));
  /* عمولاتي */
  await p.click('[data-mk="v"][data-v="aff"]'); t = await txt(); ok("عمولاتي: معلّقة بحالتها العربية", /معلّقة/.test(t) && /سارة/.test(t));
  /* كمورّد */
  await p.click('[data-mk="v"][data-v="sup"]'); t = await txt(); ok("منتجاتي كمورّد: الحالة والمستوردون", /معروض/.test(t) && /عسل/.test(t));
  await p.click('[data-mk="stk"]'); ok("تعديل المخزون يرسل PATCH", DB.calls.some((c) => c.method === "PATCH" && /products\/3$/.test(c.path) && "stock" in c.body));
  /* طلبات للشحن */
  await p.click('[data-mk="v"][data-v="ord"]'); t = await txt();
  ok("طلب الشحن: بيانات الزبون والتحصيل وروابط اتصال/واتساب، والاسم يُهرَّب", /علي/.test(t) && /2 200 دج/.test(t) && await p.evaluate(() => !!document.querySelector('#mk-app a[href^="tel:"]') && !!document.querySelector('#mk-app a[href*="wa.me/213551234567"]') && document.getElementById("mk-app").textContent.includes("<b>علي</b>")));
  await p.click('[data-mk="ost"][data-s="shipped"]'); await p.waitForFunction(() => /شُحن/.test(document.getElementById("mk-app").textContent));
  ok("زر «شُحن» يرسل الحالة", DB.calls.some((c) => c.path === "/v1/marketplace/orders/11/status" && c.body.status === "shipped"));
  await p.click('[data-mk="ost"][data-s="delivered"]'); await p.waitForFunction(() => /متاحة/.test(document.getElementById("mk-app").textContent));
  ok("«سُلِّم» يحرّر العمولة", DB.calls.some((c) => c.body && c.body.status === "delivered"));
  /* الرئيسية: تنبيه */
  ok("تنبيه الرئيسية: طلبات تنتظر الشحن/رُفضت", await p.evaluate(async () => { const a = await AdminMarketplace.warm(); return a.to_ship === 1 && a.rej === 2; }));
  await p.setViewportSize({ width: 390, height: 800 }); await p.evaluate(() => AdminMarketplace.refresh()); ok("الجوال: بلا اتساع أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  DB.off = true; await p.evaluate(() => AdminMarketplace.refresh()); ok("الوسيط غير منشور: رسالة «غير مفعّل»", await p.evaluate(() => /غير مفعّل/.test(document.getElementById("mk-app").textContent)));
  /* المتجر: فحص متزامن لمنتج السوق قبل قبول الطلب */
  const hold = await p.evaluate(async () => {
    window.CONFIG = { PLATFORM_URL: "https://api.example", PLATFORM_ORDER_KEY: "pk_pub_x" }; const calls = []; let mode = "ok";
    window.fetch = async (u, o) => { calls.push(JSON.parse(o.body)); return mode === "ok" ? new Response(JSON.stringify({ ok: true }), { status: 201 }) : new Response(JSON.stringify({ error: { code: mode, message: "m" } }), { status: 409 }); };
    await new Promise((r) => { const e = document.createElement("script"); e.src = "/assets/js/platform-order.js"; e.onload = r; document.body.appendChild(e); });
    const o = { name: "س", phone: "0551234567", wilaya: "الجزائر", commune: "x", dtype: "home", items: [{ slug: "mp-serum", qty: 1, price: 2800 }], subtotal: 2800, fee: 400, total: 3200 };
    const a = await PFOrder.hold(o, "Wabc", o.items); mode = "supplier_unavailable"; const b = await PFOrder.hold(o, "Wabc2", o.items); mode = "out_of_stock"; const c = await PFOrder.hold(o, "Wabc3", o.items);
    return { a, b, c, ref: calls[0].ref, slug: calls[0].items[0].slug };
  });
  ok("PFOrder.hold: يقبل عند النجاح ويرفض برسالة عربية عند عدم توفر المورّد/نفاد المخزون", hold.a.ok === true && hold.b.ok === false && /غير متاح/.test(hold.b.msg) && hold.c.ok === false && /نفدت/.test(hold.c.msg) && hold.ref === "Wabc" && hold.slug === "mp-serum", hold);
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `\n✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
