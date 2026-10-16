/* اختبار بوابة المورّد الخارجي (saas/supplier.html + supplier.js) بوسيط supplier-proxy مُحاكى + قائمة سماح الوسيط.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-supplier-ui.js */
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const ts = fs.readFileSync(path.join(root, "platform/supabase/functions/supplier-proxy/index.ts"), "utf8");
const AL = [...ts.matchAll(/\["(GET|POST|PUT|PATCH|DELETE)", (\/\^.*?\/)\]/g)].map(m => [m[1], eval(m[2])]), al = (m, p) => AL.some(([x, re]) => x === m && re.test(p));
ok("الوسيط يسمح بمسارات المورّد", /path === "\/v1\/marketplace\/apply"/.test(ts) && al("GET", "/v1/marketplace/profile") && al("POST", "/v1/marketplace/products") && al("PATCH", "/v1/marketplace/products/4") && al("POST", "/v1/marketplace/images") && al("POST", "/v1/marketplace/orders/4/status") && al("POST", "/v1/wallet/deposits"));
ok("الوسيط يمنع الإدارة والمحافظ الأخرى", !al("POST", "/admin/marketplace/sellers/1/approve") && !al("PUT", "/admin/marketplace/tenants/1/kind") && !al("POST", "/v1/wallet/chargily-webhook") && !al("POST", "/v1/marketplace/imports") && !al("DELETE", "/v1/marketplace/products/4") && !al("POST", "/v1/events"));
const KEY = "pk_live_" + "b".repeat(40), PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
(async () => {
  const br = await chromium.launch(), calls = [], ctx = await br.newContext({ viewport: { width: 390, height: 800 } }), page = await ctx.newPage();
  let PRODS = [{ id: 1, slug: "a", title: "<b>سيروم</b>", status: "pending", supplier_price: 2000, commission: 400, rrp: 2800, stock: 5, image: "" }];
  let ORD = [{ id: 7, mko: "MKO-7", title: "سيروم", qty: 1, state: "pending", ship: "new", commission: 400, customer: { name: "<img src=x onerror=window.__z=1>", phone: "0661112233", wilaya: "الجزائر", commune: "بابا", dtype: "home" }, collect: 2800 }];
  await page.route("**/functions/v1/supplier-proxy", async route => {
    const h = route.request().headers(), b = JSON.parse(route.request().postData() || "{}"); calls.push({ ...b, key: h["x-supplier-key"] || "" }); let data = {}, status = 200;
    const needKey = !(b.method === "POST" && b.path === "/v1/marketplace/apply");
    if (needKey && h["x-supplier-key"] !== KEY) { data = { error: { code: "unauthorized", message: "x" } }; status = 401; }
    else if (b.path === "/v1/marketplace/apply") data = { ok: true };
    else if (b.path === "/v1/marketplace/profile") data = { name: "مخزن النور", kind: "wholesale", status: "approved" };
    else if (b.path === "/v1/marketplace/stats") data = { orders: 3, delivered: 2, returned: 1, delivery_rate: 67, sales: 8400, commissions_paid: 800, commissions_held: 400, top: [] };
    else if (b.path === "/v1/marketplace/wallet") data = { available: 3000, supplier_escrow: 400, supplier: { to_ship: 1, rejected_for_funds: 0 }, affiliate: { available: 0 } };
    else if (b.path === "/v1/marketplace/products" && b.method === "GET") data = { products: PRODS };
    else if (b.path === "/v1/marketplace/products" && b.method === "POST") { PRODS.push({ id: 2, title: b.body.title, status: "pending", supplier_price: b.body.supplier_price, commission: b.body.commission, rrp: b.body.rrp, stock: b.body.stock }); data = { id: 2, status: "pending" }; }
    else if (b.path === "/v1/marketplace/images") data = { url: "https://api.example/v1/marketplace/img/9" };
    else if (b.path === "/v1/marketplace/orders" && b.method === "GET") data = { orders: ORD };
    else if (/orders\/7\/status/.test(b.path)) { ORD[0].state = b.body.status === "delivered" ? "available" : "pending"; data = { ok: true }; }
    else if (b.path === "/v1/wallet/deposits" && b.method === "GET") data = { deposits: [], min: 500, chargily: false };
    else if (b.path === "/v1/wallet/deposits" && b.method === "POST") data = { id: 1, status: "pending" };
    else { data = { error: { code: "not_found", message: "x" } }; status = 404; }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, status, data }) });
  });
  await page.addInitScript(() => { window.confirm = () => true; window.alert = () => { }; });
  await page.goto("file://" + root + "/saas/supplier.html");
  await page.waitForSelector("#a-name");
  ok("الزائر: نموذج الانضمام يظهر مع حقل السجل التجاري للجملة", await page.isVisible("#a-reg"));
  await page.selectOption("#a-kind", "retail"); ok("التجزئة تخفي السجل التجاري", !(await page.isVisible("#a-reg")));
  await page.click('[data-a="apply"]'); await page.waitForTimeout(150);
  ok("لا إرسال بلا موافقة", !calls.some(c => c.path === "/v1/marketplace/apply"));
  ok("ما كُتب لا يضيع بعد رسالة الخطأ (النوع محفوظ)", (await page.inputValue("#a-kind")) === "retail");
  await page.fill("#a-name", "متجر الأمل"); await page.fill("#a-contact", "علي"); await page.fill("#a-phone", "0661234567"); await page.check("#a-ok");
  await page.click('[data-a="apply"]'); await page.waitForSelector("text=استلمنا طلبك");
  const ap = calls.find(c => c.path === "/v1/marketplace/apply");
  ok("طلب الانضمام يُرسل بلا مفتاح وبالنوع والهاتف", ap && !ap.key && ap.body.kind === "retail" && ap.body.phone === "0661234567" && ap.body.name === "متجر الأمل", ap);
  await page.goto("file://" + root + "/saas/supplier.html"); await page.waitForSelector("#k-in");
  await page.fill("#k-in", "bad"); await page.click('[data-a="login"]'); await page.waitForTimeout(150);
  ok("مفتاح بشكل خاطئ يُرفض محلياً", !calls.some(c => c.key === "bad") && /غير صالح/.test(await page.innerText("#exw")));
  await page.fill("#k-in", "pk_live_" + "c".repeat(40)); await page.click('[data-a="login"]'); await page.waitForSelector("#k-in");
  ok("مفتاح خاطئ عند الخادم يعيد لشاشة الدخول ولا يُحفظ", (await page.evaluate(() => localStorage.getItem("alyssum_sup_key"))) === null);
  await page.fill("#k-in", KEY); await page.click('[data-a="login"]'); await page.waitForSelector("text=أهلاً مخزن النور");
  let txt = await page.innerText("#exw");
  ok("لوحة المورّد: نوع جملة ورصيد وإحصاء", /مورّد جملة/.test(txt) && /3\D?000/.test(txt) && /67%/.test(txt));
  ok("المفتاح يُرسل في كل نداء ويُحفظ", calls.filter(c => c.path === "/v1/marketplace/profile").slice(-1)[0].key === KEY && (await page.evaluate(() => localStorage.getItem("alyssum_sup_key"))) === KEY);
  ok("الجوال: لا فيض أفقي", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.click('[data-a="v"][data-v="prods"]'); await page.waitForSelector('[data-a="pform"]');
  ok("لا XSS في اسم المنتج", !(await page.$("#exw b b")) && (await page.innerText("#exw")).includes("<b>سيروم</b>"));
  await page.click('[data-a="pform"]'); await page.click('[data-a="padd"]'); await page.waitForTimeout(150);
  ok("إدراج بلا بيانات يُرفض محلياً", !calls.some(c => c.method === "POST" && c.path === "/v1/marketplace/products"));
  await page.fill("#p-title", "كريم الليل"); await page.fill("#p-sp", "1500"); await page.fill("#p-cm", "300"); await page.fill("#p-st", "20"); await page.setInputFiles("#p-img", { name: "x.png", mimeType: "image/png", buffer: PNG });
  await page.click('[data-a="padd"]'); await page.waitForSelector("text=أُرسل للمراجعة");
  const im = calls.find(c => c.path === "/v1/marketplace/images"), pr = calls.find(c => c.method === "POST" && c.path === "/v1/marketplace/products");
  ok("الصورة تُضغط وتُرفع ثم يُدرج المنتج بروابطها", im && /^data:image\/(jpeg|webp|png)/.test(im.body.image) && pr && pr.body.images[0].includes("/img/9") && pr.body.supplier_price === 1500 && pr.body.commission === 300 && pr.body.rrp === 1800 && pr.body.stock === 20, pr && pr.body);
  await page.click('[data-a="v"][data-v="ord"]'); await page.waitForSelector("text=MKO-7");
  ok("الطلب: بيانات الزبون وزر واتساب بلا XSS", (await page.evaluate(() => window.__z)) === undefined && !!(await page.$('#exw a[href^="https://wa.me/2136611"]')));
  await page.click('[data-a="ost"][data-s="delivered"]'); await page.waitForTimeout(250);
  ok("تأكيد التسليم يستدعي الحالة", calls.some(c => c.path === "/v1/marketplace/orders/7/status" && c.body.status === "delivered"));
  await page.click('[data-a="v"][data-v="pay"]'); await page.fill("#d-am", "100"); await page.click('[data-a="dep"]'); await page.waitForTimeout(150);
  ok("شحن أقل من الحد الأدنى يُرفض محلياً", !calls.some(c => c.method === "POST" && c.path === "/v1/wallet/deposits"));
  await page.fill("#d-am", "2000"); await page.selectOption("#d-me", "ccp"); await page.setInputFiles("#d-pf", { name: "r.png", mimeType: "image/png", buffer: PNG }); await page.click('[data-a="dep"]'); await page.waitForSelector("text=أُرسل الوصل");
  const dp = calls.find(c => c.method === "POST" && c.path === "/v1/wallet/deposits");
  ok("إيداع CCP بوصل ومفتاح idempotency", dp && dp.body.method === "ccp" && dp.body.amount === 2000 && /^data:image/.test(dp.body.proof) && dp.idempotencyKey, dp && Object.keys(dp));
  await page.click('[data-a="out"]'); await page.waitForSelector("#k-in");
  ok("الخروج يمسح المفتاح", (await page.evaluate(() => localStorage.getItem("alyssum_sup_key"))) === null);
  await br.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
