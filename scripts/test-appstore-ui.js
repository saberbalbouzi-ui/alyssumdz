/* واجهة «متجر التطبيقات» في لوحة التاجر على متصفح حقيقي بوسيط مُحاكى (الخادم والدفتر مختبَران في platform/api/test/appstore.test.mjs):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-appstore-ui.js */
const http = require("http"), fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const SC = (id, label, sensitive) => ({ id, label, sensitive: !!sensitive });
const DB = { off: false, calls: [], avail: 5000, inst: [],
  apps: [{ id: 1, slug: "sms", name: "أدوات <i>SMS</i>", featured: true, domain_verified: true, rating: 4.5, rating_count: 6, description: "رسائل", price: 2000, billing: "once", developer: "Dev", scopes: [SC("read_orders", "قراءة الطلبات")], events: [] },
         { id: 2, slug: "crm", name: "CRM", description: "", price: 0, billing: "once", developer: "Pro", scopes: [SC("read_orders", "قراءة الطلبات"), SC("read_customers", "أسماء الزبائن وهواتفهم", true)], events: [] },
         { id: 3, slug: "big", name: "كبير", description: "", price: 9000, billing: "monthly", developer: "Z", scopes: [SC("read_products", "قراءة المنتجات")], events: [] }] };
function handle(b) {
  DB.calls.push(b); if (DB.off) return null; const m = b.method, p = b.path;
  if (m === "GET" && p === "/v1/appstore/apps") return { apps: DB.apps, commission_pct: 20 };
  if (m === "GET" && p === "/v1/appstore/installations") return { installations: DB.inst };
  if (m === "GET" && p === "/v1/wallet") return { balances: { available: { DZD: DB.avail } } };
  let x = /^\/v1\/appstore\/apps\/(\d+)\/install$/.exec(p);
  if (m === "POST" && x) { const a = DB.apps.find((y) => y.id === +x[1]); if (JSON.stringify(b.body.scopes) !== JSON.stringify(a.scopes.map((s) => s.id))) return { __err: { status: 409, error: { code: "consent_mismatch" } } };
    if (a.price > DB.avail) return { __err: { status: 409, error: { code: "insufficient_funds" } } }; DB.avail -= a.price; DB.inst.unshift({ refundable: a.price > 0, reviewed: false, installed_at: 1790000000, id: 10 + a.id, app_id: a.id, name: a.name, status: "active", scopes: b.body.scopes, price: a.price, billing: a.billing, next_charge_at: a.billing === "monthly" ? 1800000000 : null });
    return { installation: DB.inst[0], redirect_to: "https://app.example/cb?code=ac_1&installation=" + DB.inst[0].id }; }
  x = /^\/v1\/appstore\/apps\/(\d+)\/review$/.exec(p); if (m === "POST" && x) { DB.inst.forEach((i) => { if (i.app_id === +x[1]) i.reviewed = true; }); return { ok: true }; }
  x = /^\/v1\/appstore\/installations\/(\d+)\/refund$/.exec(p); if (m === "POST" && x) { const i = DB.inst.find((y) => y.id === +x[1]); if (!i.refundable) return { __err: { status: 409, error: { code: "not_refundable" } } }; i.status = "uninstalled"; i.refundable = false; DB.avail += i.price; return { ok: true, refunded: i.price }; }
  x = /^\/v1\/appstore\/installations\/(\d+)\/authorize$/.exec(p); if (m === "POST" && x) return { redirect_to: "https://app.example/cb?code=ac_2" };
  x = /^\/v1\/appstore\/installations\/(\d+)$/.exec(p); if (m === "DELETE" && x) { const i = DB.inst.find((y) => y.id === +x[1]); i.status = "uninstalled"; return { ok: true }; }
  return { __err: { status: 404, error: { code: "not_found" } } };
}
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route("**/sb/functions/v1/platform-proxy", async (route) => { const b = JSON.parse(route.request().postData() || "{}"), r = handle(b); if (r === null) return route.fulfill({ status: 404, body: "{}" }); if (r.__err) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: r.__err.status, data: { error: r.__err.error } }) }); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: 200, data: r }) }); });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept(d.defaultValue())); await p.goto(base + "/__blank");
  await p.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-appstore" class="hidden"><div id="appstore-content"></div></div>'; window.__toasts = [];
    window.API = { sb: { token: async () => "tok", url: (q) => "/sb" + q, headers: () => ({ "Content-Type": "application/json" }) } }; window.Admin = { tab() { }, toast: (t) => window.__toasts.push(t) };
    await new Promise((r) => { const e = document.createElement("script"); e.src = "/assets/js/admin-appstore.js"; e.onload = r; document.body.appendChild(e); }); Admin.tab("appstore");
  });
  await p.waitForSelector(".as-app", { timeout: 8000 });
  const txt = () => p.evaluate(() => document.getElementById("as-app").textContent.replace(/[\u00a0\u202f]/g, " ")), toasts = () => p.evaluate(() => window.__toasts);
  let t = await txt();
  ok("التطبيقات بأسعارها وصلاحياتها بالعربية", /2 000 دج/.test(t) && /مجاني/.test(t) && /9 000 دج \/ شهر/.test(t) && /قراءة الطلبات/.test(t) && /5 000 دج/.test(t), t.slice(0, 300));
  ok("الصلاحية الحسّاسة بعلامة تحذير مميزة", await p.evaluate(() => document.querySelectorAll(".as-sc li.sens").length === 1));
  ok("لا XSS من اسم التطبيق", !(await p.$("#as-app .as-app i")) && /أدوات <i>SMS<\/i>/.test(t));
  ok("الجوال: لا فيض أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  /* رصيد غير كافٍ يُمنع قبل الإرسال */
  await p.click('[data-as=pick][data-id="3"]'); await p.waitForSelector("#as-form"); const n0 = DB.calls.filter((c) => c.method === "POST").length;
  await p.click("[data-as=install]"); ok("رصيد غير كافٍ يُمنع محلياً", (await toasts()).some((x) => /غير كافٍ/.test(x)) && DB.calls.filter((c) => c.method === "POST").length === n0);
  /* صلاحية حسّاسة تتطلب موافقة صريحة */
  await p.click("[data-as=cancel]"); await p.click('[data-as=pick][data-id="2"]'); await p.waitForSelector("#as-sens");
  ok("نص التحذير عن بيانات الزبائن", /أسماء زبائنك وأرقام هواتفهم/.test(await txt()));
  await p.click("[data-as=install]"); ok("بلا موافقة على البيانات الحسّاسة لا يُرسل", (await toasts()).some((x) => /وافق على مشاركة/.test(x)) && DB.calls.filter((c) => c.method === "POST").length === n0);
  await p.check("#as-sens"); await p.click("[data-as=install]"); await p.waitForSelector(".as-box a.as-btn");
  const post = DB.calls.find((c) => c.method === "POST" && /install/.test(c.path));
  ok("إرسال الموافقة بمعرّفات النطاقات الدقيقة ومفتاح تكرار", post && JSON.stringify(post.body.scopes) === '["read_orders","read_customers"]' && post.idempotencyKey, post);
  ok("رابط إكمال الربط https وبـnoopener", await p.evaluate(() => { const a = document.querySelector(".as-box a.as-btn"); return a && a.href.startsWith("https://app.example/cb") && a.rel.includes("noopener") && a.target === "_blank"; }));
  /* مدفوع */
  await p.click("[data-as=dismiss]"); await p.click('[data-as=pick][data-id="1"]'); await p.waitForSelector("#as-form"); ok("تفصيل العمولة قبل الدفع", /عمولة 20%/.test(await txt()));
  await p.click("[data-as=install]"); await p.waitForFunction(() => !document.getElementById("as-form")); t = await txt();
  ok("بعد التثبيت: مثبّت ورصيد نزل وصف في تطبيقاتي", /✓ مثبّت/.test(t) && /3 000 دج/.test(t) && /إلغاء التثبيت/.test(t));
  ok("لا يعاد عرض زر التثبيت لمثبّت", await p.evaluate(() => !document.querySelector('[data-as=pick][data-id="1"]')));
  /* تقييم واسترداد */
  ok("شارات: مميّز ونطاق موثّق وتقييم", /مميّز/.test(await txt()) && /نطاق موثّق/.test(await txt()) && /★ 4.5 \(6\)/.test(await txt()));
  await p.click('[data-as=rate][data-app="1"]'); await p.waitForFunction(() => /تعديل تقييمي/.test(document.getElementById("as-app").textContent)); ok("التقييم يُرسل ويتحوّل الزر", DB.calls.some((c) => c.method === "POST" && /apps\/1\/review$/.test(c.path) && c.body.stars === 5));
  ok("زر الاسترداد ظاهر للمدفوع داخل المهلة", await p.evaluate(() => !!document.querySelector('[data-as=refund][data-id="11"]')));
  await p.click('[data-as=refund][data-id="11"]'); await p.waitForFunction(() => !document.querySelector('[data-as=refund][data-id="11"]')); ok("الاسترداد يعيد الرصيد", DB.calls.some((c) => /installations\/11\/refund$/.test(c.path)) && /5 000 دج/.test(await txt()));
  DB.inst.unshift({ id: 11, app_id: 1, name: "x", status: "active", scopes: [], price: 2000, billing: "once", refundable: false, installed_at: 1790000000 }); DB.inst.splice(1, DB.inst.filter(i => i.id === 11).length - 1); DB.inst.find((i) => i.id === 11).status = "active";
  await p.evaluate(() => AdminAppStore.refresh());
  /* إعادة ربط وإلغاء */
  await p.click('[data-as=relink][data-id="11"]'); await p.waitForFunction(() => { const a = document.querySelector(".as-box a.as-btn"); return a && /code=ac_2/.test(a.href); }, null, { timeout: 8000 }).catch(() => { }); ok("إعادة الربط تعرض رابطاً جديداً", await p.evaluate(() => /code=ac_2/.test(document.querySelector(".as-box a.as-btn").href)));
  await p.click('[data-as=remove][data-id="11"]'); await p.waitForFunction(() => !document.querySelector('[data-as=remove][data-id="11"]')); ok("إلغاء التثبيت", DB.calls.some((c) => c.method === "DELETE") && (await toasts()).some((x) => /إلغاء التثبيت/.test(x)));
  DB.off = true; await p.evaluate(() => AdminAppStore.refresh()); ok("وحدة غير مفعّلة ← رسالة تواصل مع الدعم", /غير مفعّل بعد/.test(await txt()));
  ok("بلا أخطاء جافاسكربت", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
