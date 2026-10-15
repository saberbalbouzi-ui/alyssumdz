/* اختبار تبويب «خدمات التسويق» في لوحة المزوّد (saas/agency.js) بوسيط مُحاكى + قائمة السماح في platform-admin.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-saas-agency.js */
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const ts = fs.readFileSync(path.join(root, "supabase/functions/platform-admin/index.ts"), "utf8");
const ALLOW = [...ts.matchAll(/\["(GET|POST|PUT|PATCH)", (\/\^.*?\/)\]/g)].map(m => [m[1], eval(m[2])]);
const allowed = (m, p) => ALLOW.some(([x, re]) => x === m && re.test(p));
ok("السماح: كتالوج وطلبات وشريك", allowed("GET", "/admin/agency/services") && allowed("POST", "/admin/agency/services") && allowed("PUT", "/admin/agency/services/3") && allowed("GET", "/admin/agency/orders?status=pending") && allowed("GET", "/admin/agency/orders?status=pending&after=40") && allowed("PATCH", "/admin/agency/orders/9") && allowed("POST", "/admin/agency/orders/9/resend") && allowed("GET", "/admin/agency/partner") && allowed("PUT", "/admin/agency/partner"));
ok("السماح يرفض الخبيث", !allowed("DELETE", "/admin/agency/orders/9") && !allowed("GET", "/admin/agency/orders?status=a;drop") && !allowed("PATCH", "/admin/agency/orders/x") && !allowed("GET", "/admin/agency/../tenants") && !allowed("GET", "/admin/tenants"));
const px = fs.readFileSync(path.join(root, "supabase/functions/platform-proxy/index.ts"), "utf8");
const PA = [...px.matchAll(/\["(GET|POST|PUT|PATCH|DELETE)", (\/\^.*?\/)\]/g)].map(m => [m[1], eval(m[2])]), pal = (m, p) => PA.some(([x, re]) => x === m && re.test(p));
ok("وسيط التاجر: الخدمات والطلبات والشراء فقط", pal("GET", "/v1/agency/services") && pal("GET", "/v1/agency/orders") && pal("GET", "/v1/agency/orders/12") && pal("POST", "/v1/agency/orders") && !pal("POST", "/v1/agency/partner/callback") && !pal("GET", "/admin/agency/orders") && !pal("PATCH", "/v1/agency/orders/1"));

(async () => {
  const br = await chromium.launch(), calls = [], page = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  const SV = [{ id: 1, code: "tiktok-ads", name: "حساب TikTok Ads", kind: "tiktok", price: 15000, needs_page: 0, active: 1, sort: 100 }];
  let OR = [{ id: 7, tenant_id: 1, tenant_name: "Alyssum <img src=x onerror=window.__x=1>", service_name: "حساب TikTok Ads", price: 15000, store_name: "متجر <b>الورد</b>", client_email: "a@b.dz", facebook_page_url: null, status: "pending", partner_state: "failed", last_error: "webhook HTTP 500", created_at: "2026-10-15 10:00:00" }];
  await page.route("**/functions/v1/platform-admin", async route => {
    const b = JSON.parse(route.request().postData() || "{}"); calls.push(b); let data = {}, status = 200;
    if (b.path.startsWith("/admin/agency/orders?")) data = { orders: OR.filter(o => b.path.includes("status=" + o.status)), next: null };
    else if (b.path === "/admin/agency/services") data = { services: SV };
    else if (b.path === "/admin/agency/partner" && b.method === "GET") data = { config: { notify: "webhook", webhook_url: "https://ag.example/h" }, has_webhook_secret: true, has_resend_key: false };
    else if (b.path === "/admin/agency/partner") data = { ok: true, requeued: 2 };
    else if (/orders\/7$/.test(b.path)) { OR[0].status = b.body.status; data = { order: OR[0] }; }
    else if (/orders\/7\/resend$/.test(b.path)) data = { sent: true };
    else if (/services/.test(b.path)) data = { id: 2 };
    else { data = { error: { code: "not_found", message: "x" } }; status = 404; }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, status, data }) });
  });
  await page.setContent('<link rel="stylesheet" href="file://' + root + '/saas/app.css"><div id="toasts"></div><div id="r"></div>');
  await page.addScriptTag({ content: "window.SAAS_CFG={URL:'https://x.supabase.co',KEY:'k'};" });
  await page.addScriptTag({ path: path.join(root, "saas/agency.js") });
  await page.evaluate(() => { window.confirm = () => true; window.prompt = m => (/رابط/.test(m) ? "https://business.tiktok.com/i/abc" : "الصفحة غير مقبولة"); window.alert = m => (window.__al = (window.__al || []).concat(m)); SaasAgency.mount(document.getElementById("r"), async () => "tok"); });
  await page.waitForSelector("table");
  const txt = await page.innerText("#r");
  ok("الطلب يظهر بمتجره وتاجره وسعره وحالة الإبلاغ", /AG-7/.test(txt) && /15,?000|15 000|15000/.test(txt.replace(/ | /g, "")) && /فشل الإرسال/.test(txt) && /webhook HTTP 500/.test(txt));
  ok("لا XSS في اسم التاجر/المتجر", (await page.evaluate(() => window.__x)) === undefined && !(await page.$("#r img")) && !(await page.$("#r td b b")));
  ok("الجوال: لا فيض أفقي للصفحة", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.click("[data-ag=resend]"); await page.waitForTimeout(150);
  ok("إعادة الإرسال للوكالة", calls.some(c => c.method === "POST" && c.path === "/admin/agency/orders/7/resend"));
  await page.click("[data-ag=deliver]"); await page.waitForTimeout(150);
  const dc = calls.find(c => c.method === "PATCH" && c.path === "/admin/agency/orders/7");
  ok("التسليم يرسل رابط الدعوة", dc && dc.body.status === "delivered" && dc.body.invite_link === "https://business.tiktok.com/i/abc", dc);
  OR[0].status = "pending"; await page.evaluate(() => SaasAgency.S.st = "pending"); await page.click("[data-ag=reload]"); await page.waitForSelector("[data-ag=reject]");
  await page.click("[data-ag=reject]"); await page.waitForTimeout(150);
  ok("الرفض يرسل السبب", calls.some(c => c.method === "PATCH" && c.body.status === "rejected" && /الصفحة/.test(c.body.note)));
  await page.evaluate(() => { document.querySelector("[data-ag=new-svc]").click(); }); await page.waitForSelector("[data-sf=code]");
  await page.fill("[data-sf=code]", "meta-ads"); await page.fill("[data-sf=name]", "حساب Meta"); await page.fill("[data-sf=price]", "20000"); await page.selectOption("[data-sf=kind]", "meta"); await page.check("[data-sf=needs_page]"); await page.click("[data-ag=save-svc]"); await page.waitForTimeout(150);
  const sc = calls.find(c => c.method === "POST" && c.path === "/admin/agency/services");
  ok("حفظ خدمة بالسعر بالدينار", sc && sc.body.code === "meta-ads" && sc.body.price === 20000 && sc.body.kind === "meta" && sc.body.needs_page === true, sc);
  await page.fill("[data-pf=webhook_url]", "https://ag.example/new"); await page.click("[data-ag=save-partner]"); await page.waitForTimeout(150);
  const pc = calls.find(c => c.method === "PUT" && c.path === "/admin/agency/partner");
  ok("حفظ الشريك لا يرسل الأسرار الفارغة", pc && pc.body.webhook_url === "https://ag.example/new" && !("webhook_secret" in pc.body) && !("resend_key" in pc.body), pc);
  await br.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
