/* اختبار تبويب «سوق التوريد» في لوحة المزوّد (saas/marketplace.js) بوسيط مُحاكى + قوائم السماح (platform-admin و platform-proxy).
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-saas-market.js */
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const ts = fs.readFileSync(path.join(root, "supabase/functions/platform-admin/index.ts"), "utf8");
const ALLOW = [...ts.matchAll(/\["(GET|POST|PUT|PATCH)", (\/\^.*?\/)\]/g)].map(m => [m[1], eval(m[2])]), allowed = (m, p) => ALLOW.some(([x, re]) => x === m && re.test(p));
ok("المزوّد: إيداعات CCP وصورتها واعتمادها", allowed("GET", "/admin/wallet/deposits/list?status=pending") && allowed("GET", "/admin/wallet/deposits/5/proof") && allowed("POST", "/admin/wallet/deposits/5/approve") && allowed("POST", "/admin/wallet/deposits/5/reject"));
ok("المزوّد: منتجات السوق ونزاعاته وإعداداته", allowed("GET", "/admin/marketplace/products?status=pending") && allowed("POST", "/admin/marketplace/products/3/suspend") && allowed("GET", "/admin/marketplace/orders?state=return_claimed") && allowed("POST", "/admin/marketplace/orders/9/resolve") && allowed("PUT", "/admin/marketplace/settings"));
ok("المزوّد: يرفض الخبيث", !allowed("POST", "/admin/wallet/deposits/x/approve") && !allowed("GET", "/admin/marketplace/products?status=a;drop") && !allowed("DELETE", "/admin/marketplace/products/3") && !allowed("POST", "/admin/marketplace/orders/9/delete"));
ok("المزوّد: مراجعة البائعين", allowed("GET", "/admin/marketplace/sellers?status=pending") && allowed("POST", "/admin/marketplace/sellers/4/approve") && allowed("POST", "/admin/marketplace/sellers/4/rekey") && allowed("PUT", "/admin/marketplace/tenants/7/kind") && !allowed("POST", "/admin/marketplace/sellers/4/delete") && !allowed("PUT", "/admin/marketplace/tenants/x/kind"));
const px = fs.readFileSync(path.join(root, "supabase/functions/platform-proxy/index.ts"), "utf8");
const PA = [...px.matchAll(/\["(GET|POST|PUT|PATCH|DELETE)", (\/\^.*?\/)\]/g)].map(m => [m[1], eval(m[2])]), pal = (m, p) => PA.some(([x, re]) => x === m && re.test(p));
ok("وسيط التاجر: السوق والإيداع فقط", pal("GET", "/v1/marketplace/catalog") && pal("POST", "/v1/marketplace/imports") && pal("PATCH", "/v1/marketplace/products/4") && pal("POST", "/v1/marketplace/orders/4/status") && pal("GET", "/v1/marketplace/wallet") && pal("POST", "/v1/wallet/deposits") && pal("GET", "/v1/wallet/deposits"));
ok("وسيط التاجر: يمنع الإدارة وإشعار Chargily", !pal("POST", "/admin/marketplace/orders/4/resolve") && !pal("POST", "/admin/wallet/deposits/1/approve") && !pal("POST", "/v1/wallet/chargily-webhook") && !pal("DELETE", "/v1/marketplace/products/4") && !pal("PATCH", "/v1/marketplace/orders/4/status"));

(async () => {
  const br = await chromium.launch(), calls = [], page = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  const JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD";
  let DEP = [{ id: 5, tenant_id: 2, amount: 5000, method: "ccp", status: "pending", payer: "<img src=x onerror=window.__x=1>", created_at: 1760000000 }];
  let PR = [{ id: 3, tenant_id: 2, supplier: "مورّد <b>x</b>", title: "سيروم", slug: "serum", image: "", supplier_price: 2000, commission: 400, rrp: 2800, stock: 5, status: "pending", note: "" }];
  let SEL = [{ id: 11, tenant_id: null, kind: "wholesale", name: "مخزن <i>س</i>", contact: "a@b.dz", phone: "0661234567", wilaya: "16", reg_no: "RC-123", about: "<img src=x onerror=window.__y=1>", status: "pending", note: "", products: 0, delivered: 0, returned: 0 }];
  const OR = [{ id: 9, mko: "MKO-9", ref: "W1", supplier_id: 2, affiliate_id: 3, title: "سيروم", qty: 1, commission: 400, state: "return_claimed", updated_at: 1760000000 }];
  await page.route("**/functions/v1/platform-admin", async route => {
    const b = JSON.parse(route.request().postData() || "{}"); calls.push(b); let data = {}, status = 200;
    if (b.path.startsWith("/admin/wallet/deposits/list")) data = { deposits: DEP };
    else if (/deposits\/5\/proof/.test(b.path)) data = { proof: JPG };
    else if (/deposits\/5\/(approve|reject)/.test(b.path)) { DEP = []; data = { ok: true }; }
    else if (b.path.startsWith("/admin/marketplace/sellers?")) data = { sellers: SEL };
    else if (/sellers\/11\/approve/.test(b.path)) { SEL = []; data = { ok: true, tenant_id: 8, key: "pk_live_" + "a".repeat(40) }; }
    else if (/tenants\/8\/kind/.test(b.path)) data = { ok: true };
    else if (b.path.startsWith("/admin/marketplace/products?")) data = { products: PR.filter(p => b.path.endsWith(p.status)) };
    else if (/products\/3\/approve/.test(b.path)) { PR[0].status = "active"; data = { ok: true }; }
    else if (b.path.startsWith("/admin/marketplace/orders")) data = { orders: OR };
    else if (/orders\/9\/resolve/.test(b.path)) data = { ok: true };
    else if (b.path === "/admin/marketplace/settings") data = { fee_pct: 5, auto_approve: false };
    else { data = { error: { code: "not_found", message: "x" } }; status = 404; }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, status, data }) });
  });
  await page.setContent('<link rel="stylesheet" href="file://' + root + '/saas/app.css"><div id="toasts"></div><div id="r"></div>');
  await page.addScriptTag({ content: "window.SAAS_CFG={URL:'https://x.supabase.co',KEY:'k'};" });
  await page.addScriptTag({ path: path.join(root, "saas/marketplace.js") });
  await page.evaluate(() => { window.confirm = () => true; window.prompt = () => "السبب"; window.alert = () => { }; SaasMarket.mount(document.getElementById("r"), async () => "tok"); });
  await page.waitForSelector("table");
  let txt = await page.innerText("#r");
  ok("حوالة CCP بانتظار التحقق مع المبلغ", /5\D?000/.test(txt) && /بانتظار التحقق/.test(txt));
  ok("النزاع ورسم المنصة ظاهران", /MKO-9/.test(txt) && (await page.inputValue("#mk-fee")) === "5");
  ok("لا XSS (الوسوم تظهر نصاً)", (await page.evaluate(() => window.__x)) === undefined && !(await page.$("#r td > b b")));
  ok("الجوال: لا فيض أفقي للصفحة", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.click('[data-mk="proof"]'); await page.waitForSelector("#r img[src^='data:image/jpeg']"); ok("عرض صورة الوصل عند الطلب", true);
  await page.click('[data-mk="pm"][data-a="approve"]'); await page.waitForTimeout(200);
  ok("اعتماد منتج", calls.some(c => c.method === "POST" && c.path === "/admin/marketplace/products/3/approve"));
  await page.click('[data-mk="rs"][data-o="returned"]'); await page.waitForTimeout(200);
  ok("حسم النزاع «مرتجع»", calls.some(c => c.path === "/admin/marketplace/orders/9/resolve" && c.body.outcome === "returned"));
  await page.click('[data-mk="dap"]'); await page.waitForTimeout(200);
  ok("اعتماد الإيداع بعد التحقق", calls.some(c => c.method === "POST" && c.path === "/admin/wallet/deposits/5/approve"));
  await page.fill("#mk-fee", "8"); await page.click('[data-mk="cfg"]'); await page.waitForTimeout(200);
  ok("حفظ رسم المنصة", calls.some(c => c.method === "PUT" && c.path === "/admin/marketplace/settings" && c.body.fee_pct === 8));
  ok("البائعون: طلب انضمام بنوعه وهاتفه وسجله", /جملة/.test(txt) && /0661234567/.test(txt) && /RC-123/.test(txt));
  ok("البائعون: لا XSS", (await page.evaluate(() => window.__y)) === undefined);
  await page.click('[data-mk="sa"][data-a="approve"]'); await page.waitForSelector("text=يظهر مرة واحدة فقط");
  ok("اعتماد بائع (بلا origin على أصل غير https) ويعرض المفتاح مرة واحدة", calls.some(c => c.path === "/admin/marketplace/sellers/11/approve" && !c.body.origin) && /pk_live_a{40}/.test(await page.innerText("#r")) && !!(await page.$('#r a[href^="https://wa.me/2136612"]')));
  await page.click('[data-mk="hidekey"]'); ok("إخفاء المفتاح", !/pk_live_/.test(await page.innerText("#r")));
  await br.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
