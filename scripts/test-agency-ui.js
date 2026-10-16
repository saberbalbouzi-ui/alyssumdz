/* واجهة «خدمات التسويق» في لوحة التاجر على متصفح حقيقي بوسيط مُحاكى (الخادم والدفتر مختبَران في platform/api/test/agency.test.mjs):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-agency-ui.js */
const http = require("http"), fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const DB = { off: false, calls: [], avail: 20000, orders: [
  { id: 2, ref: "AG-2", service: "حساب Meta", price: 20000, currency: "DZD", store_name: "<b>x</b>", client_email: "a@b.dz", status: "delivered", late: false, invite_link: "https://business.facebook.com/invite/<i>z</i>", note: "تم", created_at: "2026-10-14 09:00:00" },
  { id: 1, ref: "AG-1", service: "حساب TikTok Ads", price: 15000, currency: "DZD", store_name: "متجر", client_email: "c@d.dz", status: "rejected", invite_link: null, note: "الصفحة <script>window.__x=1</script> مرفوضة", created_at: "2026-10-13 09:00:00" }],
  svc: [{ id: 1, code: "tiktok-ads", name: "حساب TikTok Ads", description: "حساب جاهز", kind: "tiktok", price: 15000, needs_page: false, currency: "DZD" }, { id: 2, code: "meta-ads", name: "حساب Meta Ads", description: "", kind: "meta", price: 25000, needs_page: true, currency: "DZD" }] };
function handle(b) {
  DB.calls.push(b); if (DB.off) return null; const m = b.method, p = b.path;
  if (m === "GET" && p === "/v1/agency/services") return { services: DB.svc };
  if (m === "GET" && p === "/v1/agency/orders") return { orders: DB.orders, next: null };
  if (m === "GET" && p === "/v1/wallet") return { balances: { available: { DZD: DB.avail } } };
  if (m === "POST" && p === "/v1/agency/orders") { const s = DB.svc.find((x) => x.id === b.body.service_id); if (s.price > DB.avail) return { __err: { status: 409, error: { code: "insufficient_funds", message: "x" } } }; DB.avail -= s.price; DB.orders.unshift({ id: 3, ref: "AG-3", service: s.name, price: s.price, currency: "DZD", store_name: b.body.store_name, client_email: b.body.client_email, status: "processing", invite_link: null, note: null, created_at: "2026-10-15 10:00:00" }); return { order: DB.orders[0] }; }
  return { __err: { status: 404, error: { code: "not_found" } } };
}
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route("**/sb/functions/v1/platform-proxy", async (route) => { const b = JSON.parse(route.request().postData() || "{}"), r = handle(b); if (r === null) return route.fulfill({ status: 404, body: "{}" }); if (r.__err) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: r.__err.status, data: { error: r.__err.error } }) }); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: 200, data: r }) }); });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept()); await p.goto(base + "/__blank");
  await p.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-agency" class="hidden"><div id="agency-content"></div></div>'; window.__toasts = [];
    window.API = { sb: { token: async () => "tok", url: (q) => "/sb" + q, headers: () => ({ "Content-Type": "application/json" }) } }; window.Admin = { tab() { }, toast: (t) => window.__toasts.push(t) };
    await new Promise((r) => { const e = document.createElement("script"); e.src = "/assets/js/admin-agency.js"; e.onload = r; document.body.appendChild(e); }); Admin.tab("agency");
  });
  await p.waitForSelector(".ag-svc", { timeout: 8000 });
  const txt = () => p.evaluate(() => document.getElementById("ag-app").textContent.replace(/[  ]/g, " ")), toasts = () => p.evaluate(() => window.__toasts);
  let t = await txt();
  ok("الخدمات بأسعارها بالدينار والمتاح ظاهر", /حساب TikTok Ads/.test(t) && /15 000 دج/.test(t) && /25 000 دج/.test(t) && /20 000 دج/.test(t), t.slice(0, 300));
  ok("الطلبات: مُسلَّم برابط الدعوة، ومرفوض بسببه", /تم التسليم/.test(t) && /مرفوض — رُدّ المبلغ/.test(t) && /business\.facebook\.com/.test(t));
  ok("لا XSS من اسم المتجر/السبب/الرابط", (await p.evaluate(() => window.__x)) === undefined && !(await p.$("#ag-app script")) && !(await p.$("#ag-app td b:not([dir])")) && !(await p.$("#ag-app .ag-inv i")));
  ok("رابط الدعوة يفتح بـnoopener", await p.evaluate(() => { const a = document.querySelector(".ag-inv a"); return a && a.rel.includes("noopener") && a.target === "_blank" && a.href.startsWith("https://"); }));
  ok("الجوال: لا فيض أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  /* شراء ناجح */
  await p.click('[data-ag=buy][data-id="1"]'); await p.waitForSelector("#ag-form");
  await p.fill("#ag-store", "م"); await p.click("[data-ag=submit]"); ok("اسم قصير يُرفض محلياً ولا نداء شراء", (await toasts()).some((x) => /اسم المتجر/.test(x)) && !DB.calls.some((c) => c.method === "POST"));
  await p.fill("#ag-store", "متجر الورد"); await p.fill("#ag-mail", "bad"); await p.click("[data-ag=submit]"); ok("بريد خاطئ يُرفض محلياً", (await toasts()).some((x) => /بريداً صحيحاً/.test(x)));
  await p.fill("#ag-mail", "owner@rose.dz"); await p.click("[data-ag=submit]"); await p.waitForFunction(() => !document.getElementById("ag-form"));
  const post = DB.calls.find((c) => c.method === "POST");
  ok("طلب الشراء بالحقول ومفتاح تكرار", post && post.body.service_id === 1 && post.body.store_name === "متجر الورد" && post.body.client_email === "owner@rose.dz" && !("facebook_page_url" in post.body) && post.idempotencyKey, post);
  t = await txt(); ok("الطلب الجديد في القائمة والمتاح نزل", /AG-3/.test(t) && /قيد التنفيذ/.test(t) && /5 000 دج/.test(t));
  /* خدمة تتطلب رابط الصفحة + رصيد غير كافٍ */
  await p.click('[data-ag=buy][data-id="2"]'); await p.waitForSelector("#ag-form"); await p.fill("#ag-store", "متجر"); await p.fill("#ag-mail", "x@y.dz"); await p.click("[data-ag=submit]");
  ok("رابط الصفحة مطلوب لـMeta", (await toasts()).some((x) => /صفحة فيسبوك مطلوب/.test(x)));
  await p.fill("#ag-page", "http://insecure.example"); await p.click("[data-ag=submit]"); ok("رابط http مرفوض", (await toasts()).some((x) => /https/.test(x)));
  const before = DB.calls.filter((c) => c.method === "POST").length;
  await p.fill("#ag-page", "https://facebook.com/shop"); await p.click("[data-ag=submit]"); ok("رصيد غير كافٍ يُمنع قبل الإرسال برسالة واضحة", (await toasts()).some((x) => /غير كافٍ/.test(x)) && DB.calls.filter((c) => c.method === "POST").length === before);
  /* تنبيهات الرئيسية */
  await p.evaluate(() => { localStorage.removeItem("alyssum_ag_seen"); AdminAgency.S.orders = [{ id: 2, status: "delivered", late: false }, { id: 3, status: "processing", late: true }]; AdminAgency.S.at = Date.now(); });
  ok("تنبيه: حساب جاهز + طلب متأخر", JSON.stringify(await p.evaluate(() => AdminAgency.alerts())) === '{"ready":1,"late":1}');
  await p.evaluate(() => AdminAgency.render()); await p.waitForSelector(".ag-svc");
  ok("بعد فتح التبويب لا يبقى «جاهز» غير مقروء", (await p.evaluate(() => AdminAgency.alerts())).ready === 0);
  /* الوحدة غير مفعّلة */
  DB.off = true; await p.evaluate(() => AdminAgency.refresh()); ok("وحدة غير مفعّلة ← رسالة تواصل مع الدعم", /غير مفعّلة بعد/.test(await txt()));
  ok("بلا أخطاء جافاسكربت", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
