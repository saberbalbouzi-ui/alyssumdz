/* واجهة «بوابة المطوّر» في لوحة التاجر على متصفح حقيقي بوسيط مُحاكى (الخادم مختبَر في platform/api/test/appstore.test.mjs):
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-appstore-dev-ui.js */
const http = require("http"), fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); } const f = path.join(root, decodeURIComponent(u)); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });

const DB = { off: false, notDev: false, calls: [], n: 1,
  apps: [{ id: 1, slug: "sms", name: "تطبيق <b>x</b>", status: "rejected", review_note: "اشرح الصلاحيات", price: 1000, billing: "once", webhook_url: "https://dev.example/hook", domain_verified: false, rating: null, rating_count: 0, scopes: [{ id: "read_orders" }], events: ["order.created"], redirect_uris: ["https://dev.example/cb"] }],
  dels: [{ id: 5, app: "تطبيق", app_id: 1, type: "order.created", state: "failed", attempts: 5, error: "HTTP 500 <i>", created_at: 1790000000 }, { id: 6, app: "تطبيق", app_id: 1, type: "order.shipped", state: "sent", attempts: 1, error: null, created_at: 1790000100 }] };
function handle(b) {
  DB.calls.push(b); if (DB.off) return null; const m = b.method, p = b.path;
  if (DB.notDev) return { __err: { status: 403, error: { code: "not_a_developer", message: "x" } } };
  if (m === "GET" && p === "/v1/appstore/dev/apps") return { apps: DB.apps };
  if (m === "GET" && p === "/v1/appstore/dev/deliveries") return { deliveries: b.query && b.query.state ? DB.dels.filter((d) => d.state === b.query.state) : DB.dels };
  if (m === "GET" && p === "/v1/appstore/dev/earnings") return { totals: { gross: 3000, fee: 600, net: 2400 }, revenues: [{ id: 1, app: "تطبيق", period: "once", gross: 3000, fee: 600, net: 2400, state: "settled" }] };
  if (m === "POST" && p === "/v1/appstore/dev/apps") { if (!/^[a-z0-9-]{3,}$/.test(b.body.slug || "")) return { __err: { status: 400, error: { code: "validation_error", message: "x", fields: { slug: "المعرّف غير صالح" } } } }; DB.apps.unshift({ id: 2, slug: b.body.slug, name: b.body.name, status: "draft", price: b.body.price, billing: b.body.billing, scopes: b.body.scopes.map((id) => ({ id })), events: b.body.events, redirect_uris: b.body.redirect_uris }); return { id: 2, status: "draft", client_id: "ci_abc", client_secret: "cs_SECRET1", webhook_secret: "whsec_app_SECRET2" }; }
  let x = /^\/v1\/appstore\/dev\/apps\/(\d+)\/(submit|rotate-secrets|verify-domain)$/.exec(p);
  if (m === "POST" && x) { if (x[2] === "submit") { DB.apps.find((a) => a.id === +x[1]).status = "pending"; return { ok: true }; } if (x[2] === "rotate-secrets") return { client_secret: "cs_NEW", webhook_secret: "whsec_app_NEW" }; return { __err: { status: 422, error: { code: "verification_failed", message: "x" } } }; }
  x = /^\/v1\/appstore\/dev\/apps\/(\d+)$/.exec(p); if (m === "PUT" && x) return { ok: true, status: "pending", resubmitted: true };
  x = /^\/v1\/appstore\/dev\/deliveries\/(\d+)\/retry$/.exec(p); if (m === "POST" && x) { DB.dels.find((d) => d.id === +x[1]).state = "pending"; return { ok: true }; }
  return { __err: { status: 404, error: { code: "not_found" } } };
}
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route("**/sb/functions/v1/platform-proxy", async (route) => { const b = JSON.parse(route.request().postData() || "{}"), r = handle(b); if (r === null) return route.fulfill({ status: 404, body: "{}" }); if (r.__err) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: r.__err.status, data: { error: r.__err.error } }) }); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: 200, data: r }) }); });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept(d.defaultValue())); await p.goto(base + "/__blank");
  await p.evaluate(async () => {
    document.body.innerHTML = '<div id="tab-appdev" class="hidden"><div id="appdev-content"></div></div>'; window.__toasts = [];
    window.API = { sb: { token: async () => "tok", url: (q) => "/sb" + q, headers: () => ({ "Content-Type": "application/json" }) } }; window.Admin = { tab() { }, toast: (t) => window.__toasts.push(t) };
    await new Promise((r) => { const e = document.createElement("script"); e.src = "/assets/js/admin-appdev.js"; e.onload = r; document.body.appendChild(e); }); Admin.tab("appdev");
  });
  await p.waitForSelector(".ad-gd", { timeout: 8000 });
  { const g = await p.evaluate(() => document.getElementById("ad-app").textContent); ok("الدليل هو الصفحة الافتراضية بمراحله وخطواته", /دليل المطوّر/.test(g) && /تفعيل حساب مطوّر/.test(g) && /أرسلها للمراجعة/.test(g) && /OAuth/.test(g) && /webhook/.test(g) && /قائمة تحقق قبل الإرسال/.test(g)); }
  await p.click("[data-ad=tab][data-k=apps]"); await p.waitForSelector(".ad-tbl", { timeout: 8000 });
  const txt = () => p.evaluate(() => document.getElementById("ad-app").textContent.replace(/[\u00a0\u202f]/g, " ")), toasts = () => p.evaluate(() => window.__toasts);
  let t = await txt();
  ok("قائمة التطبيقات بالحالة وسبب الرفض", /مرفوض/.test(t) && /اشرح الصلاحيات/.test(t) && /1 000 دج/.test(t));
  ok("لا XSS من اسم التطبيق", !(await p.$("#ad-app b b")) && /تطبيق <b>x<\/b>/.test(t));
  ok("الجوال: لا فيض أفقي", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  /* إنشاء تطبيق: خطأ تحقق ثم نجاح مع أسرار مرة واحدة */
  await p.click("[data-ad=new]"); await p.waitForSelector("#ad-form"); await p.fill("#adf-name", "تطبيقي"); await p.fill("#adf-slug", "X"); await p.check('[data-adsc="read_orders"]'); await p.fill("#adf-redir", "https://dev.example/cb");
  await p.click("[data-ad=save]"); await p.waitForFunction(() => window.__toasts.length > 0); ok("خطأ التحقق يُعرض برسالته", (await toasts()).some((x) => /المعرّف غير صالح/.test(x)));
  await p.fill("#adf-slug", "my-app"); await p.check('[data-adev="order.created"]'); await p.click("[data-ad=save]"); await p.waitForSelector(".ad-sec");
  t = await txt(); ok("الأسرار تظهر مرة واحدة مع تنبيه", /cs_SECRET1/.test(t) && /whsec_app_SECRET2/.test(t) && /ci_abc/.test(t) && /لن تظهر مرة أخرى/.test(t));
  const body = DB.calls.filter((c) => c.method === "POST" && c.path === "/v1/appstore/dev/apps").pop().body; ok("الجسم المرسل صحيح", body.slug === "my-app" && body.scopes[0] === "read_orders" && body.events[0] === "order.created" && body.redirect_uris[0] === "https://dev.example/cb", body);
  ok("الأسرار لا تُخزَّن في المتصفح", await p.evaluate(() => !Object.keys(localStorage).concat(Object.keys(sessionStorage)).some((k) => /secret|SECRET/.test(localStorage.getItem(k) || sessionStorage.getItem(k) || ""))));
  await p.click("[data-ad=hide]"); ok("إخفاء الأسرار", !(await p.$(".ad-sec")) && !/cs_SECRET1/.test(await txt()));
  /* إرسال للمراجعة */
  await p.click('[data-ad=submit][data-id="1"]'); await p.waitForFunction(() => /قيد المراجعة/.test(document.getElementById("ad-app").textContent)); ok("إرسال للمراجعة", DB.calls.some((c) => c.path === "/v1/appstore/dev/apps/1/submit"));
  /* تدوير الأسرار */
  await p.click('[data-ad=rotate][data-id="1"]'); await p.waitForSelector(".ad-sec"); ok("تدوير الأسرار يعرض الجديدة", /cs_NEW/.test(await txt()));
  await p.click("[data-ad=hide]");
  /* توثيق النطاق يفشل برسالة */
  await p.click('[data-ad=verify][data-id="1"]'); await p.waitForFunction(() => window.__toasts.some((x) => /لم نجد الملف/.test(x))); ok("فشل التوثيق برسالة واضحة", true);
  /* تعديل تطبيق */
  await p.click('[data-ad=edit][data-id="1"]'); await p.waitForSelector("#ad-form"); await p.fill("#adf-price", "1500"); await p.click("[data-ad=save]"); await p.waitForFunction(() => window.__toasts.some((x) => /عاد التطبيق إلى المراجعة/.test(x))); ok("تعديل حقل حسّاس يُنبَّه للمراجعة", DB.calls.some((c) => c.method === "PUT" && c.body.price === 1500));
  /* التسليمات */
  await p.click("[data-ad=tab][data-k=dels]"); await p.waitForSelector("[data-ad=retry]"); t = await txt(); ok("سجلّ التسليمات بحالاتها", /فشل/.test(t) && /تم/.test(t) && /HTTP 500 <i>/.test(t) && !(await p.$("#ad-app i")));
  await p.click('[data-ad=dstate][data-k="sent"]'); await p.waitForFunction(() => !document.querySelector("[data-ad=retry]")); ok("تصفية بالحالة", DB.calls.some((c) => c.path === "/v1/appstore/dev/deliveries" && c.query && c.query.state === "sent"));
  await p.click('[data-ad=dstate][data-k=""]'); await p.waitForSelector("[data-ad=retry]"); await p.click('[data-ad=retry][data-id="5"]'); await p.waitForFunction(() => !document.querySelector("[data-ad=retry]")); ok("إعادة الإرسال", DB.calls.some((c) => c.path === "/v1/appstore/dev/deliveries/5/retry"));
  /* الإيرادات */
  await p.click("[data-ad=tab][data-k=earn]"); await p.waitForSelector(".ad-kpi"); t = await txt(); ok("الإيرادات", /3 000/.test(t) && /600/.test(t) && /2 400/.test(t));
  /* غير مطوّر */
  DB.notDev = true; await p.evaluate(() => AdminAppDev.refresh()); ok("غير مفعّل كمطوّر ← رسالة واضحة", /غير مفعّل كمطوّر/.test(await txt()));
  DB.notDev = false; DB.off = true; await p.evaluate(() => AdminAppDev.refresh()); ok("وسيط غير منشور ← رسالة دعم", /غير مفعّلة/.test(await txt()));
  ok("بلا أخطاء جافاسكربت", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
