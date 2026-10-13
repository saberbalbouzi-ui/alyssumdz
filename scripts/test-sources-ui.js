/* واجهة «مركز المتاجر» على متصفح حقيقي بوسيط مُحاكى (الخادم مختبَر في saas/platform/test/sources.test.mjs):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-sources-ui.js
   يغطي: البطاقات والأرقام، المرشّحات، ربط متجر (الأسرار لا تُخزَّن)، التعديل، الإيقاف/الحذف، النقل إلى «طلباتي» عبر نافذة الطلب اليدوي، وتعطّل الخدمة. */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0, total = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });

const NOW = Math.floor(Date.now() / 1000);
const DB = { off: false, calls: [], sources: [
  { id: 1, kind: "shopify", name: "متجر <b>العسل</b>", status: "active", config: { shop: "honey.myshopify.com", interval_min: 5 }, has_secrets: true, last_sync_at: NOW - 120, last_ok_at: NOW - 120, last_error: null, order_count: 3, syncing: false },
  { id: 2, kind: "gsheet", name: "فورم تيك توك", status: "active", config: { sheet_id: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", gid: "0", interval_min: 5 }, has_secrets: false, last_sync_at: NOW - 3600, last_ok_at: NOW - 7200, last_error: "الجدول غير عام: فعّل المشاركة", order_count: 2, syncing: false }],
  orders: [
    { id: 11, source_id: 1, source_name: "متجر <b>العسل</b>", kind: "shopify", ext_id: "1001", number: "#1001", created_at: NOW - 600, status: "nouvelle", name: '<img src=x onerror="window.__pwn=1">Amine', phone: "0551234567", address: "Rue 1", city: "Kouba", wilaya: "Alger", items: [{ title: "عسل سدر", qty: 2, price: 1750 }], total: 3500, currency: "DZD", imported: false, raw_status: "pending/unfulfilled", paid: false },
    { id: 12, source_id: 2, source_name: "فورم تيك توك", kind: "gsheet", ext_id: "r1", number: "#1", created_at: NOW - 900, status: "confirmee", name: "Karim", phone: "0771234567", address: "", city: "", wilaya: "Blida", items: [{ title: "صابون", qty: 1, price: 900 }], total: 900, currency: "DZD", imported: false },
    { id: 13, source_id: 1, source_name: "متجر <b>العسل</b>", kind: "shopify", ext_id: "1003", number: "#1003", created_at: NOW - 1200, status: "annulee", name: "Lina", phone: "0661000000", address: "", city: "", wilaya: "Oran", items: [], total: 1000, currency: "DZD", imported: false }] };
function handle(b) {
  DB.calls.push(b); const m = b.method, p = b.path, q = b.query || {};
  if (DB.off) return null;
  if (m === "GET" && p === "/v1/sources") return { sources: DB.sources };
  if (m === "GET" && p === "/v1/sources/stats") return { sources: [{ id: 1, name: "x", kind: "shopify", windows: { DZD: { today: { n: 2, total: 3500 }, d7: { n: 2, total: 3500 }, d30: { n: 3, total: 3500 } } }, statuses: { nouvelle: 1, annulee: 1 } }, { id: 2, name: "y", kind: "gsheet", windows: { DZD: { today: { n: 1, total: 900 }, d7: { n: 2, total: 2900 }, d30: { n: 2, total: 2900 } } }, statuses: { confirmee: 1 } }], series: [] };
  if (m === "GET" && p === "/v1/sources/orders") { let L = DB.orders.filter((o) => (!q.source || o.source_id === +q.source) && (!q.status || o.status === q.status) && (!q.q || (o.name + o.number).toLowerCase().includes(String(q.q).toLowerCase()))); return { orders: L, next: null }; }
  if (m === "PUT" && p === "/v1/sources") { if (b.body.config && b.body.config.shop === "bad") return { __err: { status: 400, error: { code: "validation_error", message: "x", fields: { shop: "نطاق المتجر بصيغة mystore.myshopify.com" } } } }; const id = b.body.id || 9; if (!b.body.id) DB.sources.push({ id, kind: b.body.kind, name: b.body.name, status: "active", config: b.body.config, has_secrets: true, last_sync_at: null, order_count: 0 }); return { ok: true, id }; }
  if (m === "POST" && /\/sync$/.test(p)) return { ok: true, added: 5, changed: 1, more: false, source: {} };
  if (m === "POST" && /\/pause$/.test(p)) { const s = DB.sources.find((x) => p.includes("/" + x.id + "/")); if (s) s.status = b.body.paused ? "paused" : "active"; return { ok: true }; }
  if (m === "DELETE") { const id = +p.split("/").pop(); DB.sources = DB.sources.filter((x) => x.id !== id); return { ok: true }; }
  if (m === "POST" && /\/imported$/.test(p)) { const o = DB.orders.find((x) => p.includes("/" + x.id + "/")); if (o) o.imported = true; return { ok: true }; }
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
  await p.evaluate(async (base) => {
    document.body.innerHTML = '<div id="tab-sources" class="hidden"><div id="sources-content"></div></div>';
    window.CONFIG = { SITE: { name: "Mystore" } }; window.toast = () => {}; window.__saved = []; window.__toasts = [];
    window.API = { sb: { token: async () => "tok", url: (p) => "/sb" + p, headers: () => ({ "Content-Type": "application/json" }) }, addOrder: async (o) => { window.__saved.push(o); return { ok: true, id: "M-TEST1" }; } };
    window.Admin = { tab() { }, products: [], orders: [], key: "k", fmt: (n) => Math.round(n).toLocaleString("fr-DZ") + " دج", toast: (t) => window.__toasts.push(t), shipFeeFor: () => ({ fee: 600, base: 600, sup: 0 }), wCo: () => ({ desks: [] }), renderStats() { }, renderOrders() { }, refreshAlerts() { }, openOrderPreview() { } };
    for (const s of ["/assets/js/wilayas.js", "/assets/js/admin-manualorder.js", "/assets/js/admin-sources.js"]) await new Promise((r) => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); });
    Admin.tab("sources");
  }, base);
  await p.waitForSelector(".hs-tbl", { timeout: 8000 });
  ok("بطاقة «كل المتاجر» + بطاقة لكل مصدر", await p.evaluate(() => document.querySelectorAll(".hs-card[data-sid]").length === 2 && !!document.querySelector(".hs-card.all")));
  ok("أرقام اليوم مجمّعة (3 طلبات، 4 400 دج)", await p.evaluate(() => { const t = document.querySelector(".hs-card.all").textContent; return /3\s*طلب/.test(t) && /4\s?400/.test(t.replace(/[  ]/g, " ")); }), await p.evaluate(() => document.querySelector(".hs-card.all").textContent));
  ok("خطأ المزامنة يظهر على بطاقة الجدول", await p.evaluate(() => /غير عام/.test(document.querySelector('[data-sid="2"]').textContent)));
  ok("الجدول الموحّد: 3 صفوف", await p.evaluate(() => document.querySelectorAll(".hs-tbl tbody tr").length === 3));
  ok("اسم المتجر والزبون يُهرَّبان (لا تنفيذ ولا وسوم)", await p.evaluate(() => !window.__pwn && !document.querySelector(".hs-tbl img") && !document.querySelector(".hs-card h3 b")));
  ok("أزرار اتصال وواتساب للهاتف", await p.evaluate(() => !!document.querySelector('a[href="tel:0551234567"]') && !!document.querySelector('a[href="https://wa.me/213551234567"]')));
  ok("«إلى طلباتي» للجديد/المؤكَّد فقط (لا للملغى)", await p.evaluate(() => document.querySelectorAll('[data-a="imp"]').length === 2));
  await p.click('.hs-seg [data-w="d30"]'); ok("تبديل النافذة الزمنية 30 يوماً", await p.evaluate(() => /30 يوماً/.test(document.querySelector(".hs-card.all").textContent) && /5\s*طلب/.test(document.querySelector(".hs-card.all").textContent)));
  await p.selectOption("#hs-src", "2"); await p.waitForFunction(() => document.querySelectorAll(".hs-tbl tbody tr").length === 1);
  ok("مرشّح المتجر يرسل source ويصفّي", DB.calls.filter((c) => c.path === "/v1/sources/orders").pop().query.source === "2");
  await p.selectOption("#hs-src", ""); await p.waitForFunction(() => document.querySelectorAll(".hs-tbl tbody tr").length === 3);
  await p.selectOption("#hs-st", "annulee"); await p.waitForFunction(() => document.querySelectorAll(".hs-tbl tbody tr").length === 1); await p.selectOption("#hs-st", "");
  await p.waitForFunction(() => document.querySelectorAll(".hs-tbl tbody tr").length === 3);
  await p.fill("#hs-q", "karim"); await p.waitForFunction(() => document.querySelectorAll(".hs-tbl tbody tr").length === 1, null, { timeout: 4000 });
  ok("البحث النصي مؤخَّر ويرسل q", DB.calls.filter((c) => c.path === "/v1/sources/orders").pop().query.q === "karim"); await p.fill("#hs-q", ""); await p.waitForFunction(() => document.querySelectorAll(".hs-tbl tbody tr").length === 3);

  /* ربط متجر جديد */
  await p.click('[data-a="add"]'); await p.waitForSelector("#hs-modal");
  ok("نموذج الربط: ثلاثة أنواع وشرح الخطوات", await p.evaluate(() => document.querySelectorAll("#hs-modal .hs-kinds button").length === 3 && /read_orders/.test(document.querySelector("#hs-modal .h").textContent)));
  await p.fill("#hf-name", "متجري الجديد"); await p.fill("#hf-shop", "bad"); await p.fill("#hf-token", "shpat_" + "a".repeat(30)); await p.click('#hs-modal [data-a="save"]');
  await p.waitForFunction(() => /نطاق المتجر/.test((document.getElementById("hf-msg") || {}).textContent || ""));
  ok("خطأ الخادم يظهر داخل النموذج ولا يُغلق", await p.evaluate(() => !!document.getElementById("hs-modal")));
  await p.fill("#hf-shop", "https://New-Shop.myshopify.com/admin"); await p.click('#hs-modal [data-a="save"]'); await p.waitForFunction(() => !document.getElementById("hs-modal"));
  const put = DB.calls.filter((c) => c.method === "PUT").pop();
  ok("الحمولة: النوع والاسم والنطاق والرمز والفاصل", put.body.kind === "shopify" && put.body.name === "متجري الجديد" && put.body.secrets.token.startsWith("shpat_") && put.body.config.interval_min === 5);
  ok("الرمز لا يُحفظ في المتصفح", await p.evaluate(() => !JSON.stringify(localStorage).includes("shpat_") && !JSON.stringify(sessionStorage).includes("shpat_")));
  ok("بعد الحفظ تُجرى مزامنة فورية", DB.calls.some((c) => c.method === "POST" && /\/sync$/.test(c.path)) && await p.evaluate(() => window.__toasts.some((t) => /سُحب 5/.test(t))));
  await p.waitForFunction(() => document.querySelectorAll(".hs-card[data-sid]").length === 3);

  /* تعديل بلا إعادة إدخال السرّ */
  await p.click('[data-sid="1"] [data-a="edit"]'); await p.waitForSelector("#hs-modal");
  ok("التعديل: الحقول معبّأة وحقل السرّ فارغ بتلميح الإبقاء", await p.evaluate(() => document.getElementById("hf-shop").value === "honey.myshopify.com" && document.getElementById("hf-token").value === "" && /إبقاء/.test(document.getElementById("hf-token").placeholder)));
  await p.fill("#hf-name", "العسل 2"); await p.click('#hs-modal [data-a="save"]'); await p.waitForFunction(() => !document.getElementById("hs-modal"));
  const put2 = DB.calls.filter((c) => c.method === "PUT").pop(); ok("التعديل بلا secrets ويحمل id", put2.body.id === 1 && Object.keys(put2.body.secrets).length === 0 && put2.body.name === "العسل 2");

  /* إيقاف وحذف */
  await p.click('[data-sid="2"] [data-a="pause"]'); await p.waitForFunction(() => /متوقف/.test(document.querySelector('[data-sid="2"]').textContent)); ok("إيقاف المزامنة", true);
  await p.click('[data-sid="9"] [data-a="del"]'); await p.waitForFunction(() => document.querySelectorAll(".hs-card[data-sid]").length === 2);
  ok("حذف المصدر يزيل بطاقته", DB.calls.some((c) => c.method === "DELETE" && c.path === "/v1/sources/9"));

  /* نقل إلى «طلباتي» */
  await p.click('tr[data-oid="11"] [data-a="imp"]'); await p.waitForSelector("#mo-bg");
  const f = await p.evaluate(() => ({ name: document.getElementById("mo-name").value, phone: document.getElementById("mo-phone").value, wil: document.getElementById("mo-wil").value, com: document.getElementById("mo-com").value, fee: document.getElementById("mo-fee").value, lines: document.querySelectorAll("#mo-lines tr[data-i]").length, hint: document.querySelector("#mo-bg .hint").textContent }));
  ok("نافذة الطلب معبّأة: الاسم والهاتف والولاية (Alger) والبلدية والرسم", /Amine/.test(f.name) && f.phone === "0551234567" && f.wil === "Alger" && f.com === "Kouba" && f.fee === "600" && f.lines === 1 && /متجر/.test(f.hint) && /#1001/.test(f.hint), f);
  ok("الاسم الخبيث داخل الحقل نصاً لا HTML", await p.evaluate(() => !window.__pwn && /<img/.test(document.getElementById("mo-name").value)));
  await p.fill("#mo-name", "Amine Benali"); await p.click("#mo-save"); await p.waitForFunction(() => window.__saved.length === 1);
  const sv = await p.evaluate(() => window.__saved[0]);
  ok("الطلب المحفوظ يحمل مرجع المصدر ولا يحمل «نسخة من»", sv.extra["🔗 مصدر"].includes("#1001") && !sv.extra["📄 نسخة من"] && sv.name === "Amine Benali" && sv.items.length === 1 && sv.items[0].qty === 2 && sv.wilaya === "Alger", sv);
  await p.waitForFunction(() => /في طلباتي/.test(document.querySelector('tr[data-oid="11"]').textContent), null, { timeout: 4000 });
  ok("تُعلَّم «مستورد» في الخادم وتتبدل الخانة", DB.calls.some((c) => c.method === "POST" && c.path === "/v1/sources/orders/11/imported") && await p.evaluate(() => !document.querySelector('tr[data-oid="11"] [data-a="imp"]')));
  ok("تطابق أسماء الولايات من نص حرّ", await p.evaluate(() => { const w = AdminSources._t.wilayaOf; return w("DZ-16") === "Alger" && w("Wilaya de Blida") === "Blida" && w("alger") === "Alger" && w("16") === "Alger" && w("Mars") === "Mars" && w("") === ""; }));

  /* الخدمة غير مفعّلة */
  DB.off = true; await p.evaluate(() => AdminSources.refresh()); await p.waitForFunction(() => /غير مفعّلة/.test(document.getElementById("hs-app").textContent));
  ok("تعطّل الوسيط ← رسالة إرشادية بدل كسر", true);
  await p.setViewportSize({ width: 390, height: 800 }); DB.off = false; await p.evaluate(() => { AdminSources.S.off = false; return AdminSources.refresh(); }); await p.waitForSelector(".hs-tbl");
  ok("جوال: لا تمرير أفقي للصفحة (الجدول داخل حاوية)", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await browser.close(); srv.close();
  console.log(fails ? `\nفشل ${fails} من ${total}` : `\nنجح ${total}/${total}`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
