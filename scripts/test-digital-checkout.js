/* المنتج الرقمي في المتجر: نموذج بلا توصيل، بريد، طرق دفع، رفع إثبات، دفع بطاقة، ومنصة وهمية.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-digital-checkout.js */
const http = require("http"), fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html"; const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
(async () => {
  await new Promise(r => srv.listen(8794, r));
  const br0 = await chromium.launch(), br = await br0.newContext({ serviceWorkers: "block" }), page = await br.newPage({ viewport: { width: 420, height: 1000 } }), errs = [];
  page.on("pageerror", e => errs.push(String(e))); page.on("dialog", d => d.accept());
  const PF = { calls: [], order: { ok: true, verified: true }, proof: { status: 201, body: { ok: true, id: 9 } }, pay: { status: 201, body: { checkout_url: "https://pay.chargily.dz/test/checkouts/c1/pay" } } };
  await page.route("https://platform.test/**", async r => {
    const u = new URL(r.request().url()), b = r.request().postData() ? JSON.parse(r.request().postData()) : null; PF.calls.push({ p: u.pathname, b, auth: r.request().headers()["authorization"] });
    const J = (st, o) => r.fulfill({ status: st, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "POST" } });
    if (u.pathname === "/v1/orders") return J(PF.order.ok ? 201 : 500, PF.order);
    if (u.pathname === "/v1/payments/proof") return J(PF.proof.status, PF.proof.body);
    if (u.pathname === "/v1/payments/pay") return J(PF.pay.status, PF.pay.body);
    return J(404, {});
  });
  await page.route("**/assets/js/config.js*", async r => { const t = await (await r.fetch()).text(); r.fulfill({ contentType: "text/javascript", body: t + '\nCONFIG.PLATFORM_URL="https://platform.test";CONFIG.PLATFORM_ORDER_KEY="pk_pub_test";' }); });
  await page.route("**/assets/js/data.js*", async r => { const t = await (await r.fetch()).text(); r.fulfill({ contentType: "text/javascript", body: t + '\nPRODUCTS.forEach(function(p){ if(p.slug==="anti-acne") p.digital=true; });' }); });
  let PAY = { baridimob: { on: true, rip: "00799999001234567890", name: "علي بن" }, ccp: { on: true, account: "1234567", key: "89", name: "علي بن" }, chargily: { on: true } };
  await page.route("**/assets/data/pay-methods.json*", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(PAY) }));
  await page.route(/script\.google|supabase\.co|alyssumhub|wa\.me|api\.whatsapp/, r => r.fulfill({ status: 200, body: "{}" }));
  await page.addInitScript(() => { window.__orders = []; window.open = () => null; });
  await page.goto("http://localhost:8794/p/anti-acne/index.html", { waitUntil: "load" });
  await page.evaluate(() => { API.submitOrder = o => window.__orders.push(JSON.parse(JSON.stringify(o))); });
  await page.waitForSelector("#dg-box", { timeout: 10000 }); await page.waitForSelector('input[name="dg-method"]', { timeout: 5000 });
  const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); }, sel);
  ok("حقول الولاية والبلدية والتوصيل والمكتب مخفية", !(await vis("#wilaya")) && !(await vis("#commune")) && !(await vis(".dtype")) && !(await vis("#desk-wrap")));
  ok("حقل البريد وطرق الدفع الثلاث ظاهرة", (await vis("#dg-email")) && (await page.locator('input[name="dg-method"]').count()) === 3);
  ok("لا رسوم توصيل ولا زر سلة", !(await vis("#fee")) && !(await vis("#add-cart")));
  ok("الإجمالي بلا رسوم", /\d/.test(await page.innerText("#grand")));
  /* طريقة غير مهيّأة */
  const total = await page.evaluate(() => document.getElementById("btn-total").textContent);
  /* تحقق: البريد مطلوب للبطاقة */
  await page.fill("#name", "أحمد"); await page.fill("#phone", "0550123456");
  await page.check('input[name="dg-method"][value="chargily"]'); await page.click(".btn-order");
  await page.waitForTimeout(400); ok("البطاقة بلا بريد: لا يُرسل طلب", (await page.evaluate(() => window.__orders.length)) === 0 && !PF.calls.some(c => c.p === "/v1/orders"), PF.calls.map(c => c.p));
  /* بريد غير صالح */
  await page.fill("#dg-email", "not-an-email"); await page.click(".btn-order"); await page.waitForTimeout(300); ok("بريد غير صالح مرفوض", (await page.evaluate(() => window.__orders.length)) === 0);
  /* BaridiMob + إثبات */
  await page.fill("#dg-email", "buyer@example.com"); await page.check('input[name="dg-method"][value="baridimob"]'); await page.click(".btn-order");
  await page.waitForSelector("#dg-modal #dg-file", { timeout: 8000 });
  const ord = await page.evaluate(() => window.__orders[0]), po = PF.calls.find(c => c.p === "/v1/orders").b;
  ok("الطلب المحلي رقمي بلا ولاية وبوسم", ord.wilaya === "رقمي" && ord.fee === 0 && ord.extra["💾 منتج رقمي"] === "نعم" && /BaridiMob/.test(ord.extra["💳 طريقة الدفع"]) && ord.total > 0, ord);
  ok("طلب المنصة: بريد ووسيلة دفع ومرجع ومفتاح عام", po.customer.email === "buyer@example.com" && po.pay === "baridimob" && po.ref === ord.extra["🔗 مرجع"] && PF.calls.find(c => c.p === "/v1/orders").auth === "Bearer pk_pub_test", po);
  ok("سطر الطلب يحمل vid (فارغ لغير المتغيّر) ليُسلَّم مفتاح التنويع المختار", po.items.length >= 1 && "vid" in po.items[0], po.items);
  const mt = await page.innerText("#dg-modal");
  ok("تعليمات الدفع: RIP والمبلغ ورقم الطلب", mt.includes("00799999001234567890") && mt.includes(ord.extra["🔗 مرجع"]) && /دج|DA|DZD/.test(mt), mt.slice(0, 300));
  await page.click("#dg-send"); ok("بلا صورة: رسالة ولا إرسال", /اختر صورة/.test(await page.innerText("#dg-msg")) && !PF.calls.some(c => c.p === "/v1/payments/proof"));
  await page.setInputFiles("#dg-file", { name: "t.png", mimeType: "image/png", buffer: PNG }); await page.click("#dg-send");
  await page.waitForFunction(() => /استلمنا إثبات الدفع/.test(document.getElementById("dg-modal").textContent), null, { timeout: 8000 });
  const pf = PF.calls.find(c => c.p === "/v1/payments/proof").b;
  ok("الإثبات صورة JPEG مضغوطة ومعها الطلب والوسيلة", pf.order_id === ord.extra["🔗 مرجع"] && pf.method === "baridimob" && /^data:image\/jpeg;base64,/.test(pf.proof) && pf.proof.length < 240000);
  ok("بعد الإرسال يُمسح الطلب المعلّق", await page.evaluate(() => !localStorage.getItem("alyssum_dg_pending")));
  /* فشل الإرسال يُظهر الخطأ ويسمح بالمحاولة */
  await page.evaluate(() => document.getElementById("dg-x").click());
  PF.proof = { status: 404, body: { error: { code: "order_not_found", message: "x" } } };
  await page.reload({ waitUntil: "load" }); await page.waitForSelector('input[name="dg-method"]'); await page.evaluate(() => { API.submitOrder = o => window.__orders.push(JSON.parse(JSON.stringify(o))); });
  await page.fill("#name", "سعيد"); await page.fill("#phone", "0661234567"); await page.check('input[name="dg-method"][value="ccp"]'); await page.click(".btn-order"); await page.waitForSelector("#dg-file");
  ok("تعليمات CCP", /1234567/.test(await page.innerText("#dg-modal")) && /89/.test(await page.innerText("#dg-modal")));
  await page.setInputFiles("#dg-file", { name: "t.png", mimeType: "image/png", buffer: PNG }); await page.click("#dg-send"); await page.waitForFunction(() => /لم يُسجَّل طلبك/.test((document.getElementById("dg-msg") || {}).textContent || ""));
  ok("خطأ المنصة يظهر والزر يعود", !(await page.locator("#dg-send").isDisabled()));
  /* لاحقاً ← شريط الإكمال */
  await page.click("#dg-later"); await page.waitForSelector("#dg-bn"); ok("شريط «بانتظار إثبات الدفع» يظهر", /بانتظار إثبات الدفع/.test(await page.innerText("#dg-bn")));
  PF.proof = { status: 201, body: { ok: true, id: 10 } }; await page.click("#dg-bn button"); await page.waitForSelector("#dg-file"); await page.setInputFiles("#dg-file", { name: "t.png", mimeType: "image/png", buffer: PNG }); await page.click("#dg-send");
  await page.waitForFunction(() => /استلمنا/.test(document.getElementById("dg-modal").textContent)); ok("إكمال الإرسال من الشريط", true);
  await page.evaluate(() => document.getElementById("dg-x").click());
  /* بطاقة: يوجّه لصفحة الدفع بلا طلب إثبات */
  await page.reload({ waitUntil: "load" }); await page.waitForSelector('input[name="dg-method"]'); await page.evaluate(() => { API.submitOrder = o => window.__orders.push(JSON.parse(JSON.stringify(o))); });
  PF.calls.length = 0; await page.fill("#name", "كريم"); await page.fill("#phone", "0771234567"); await page.fill("#dg-email", "k@example.com"); await page.check('input[name="dg-method"][value="chargily"]');
  await page.route("https://pay.chargily.dz/**", r => r.fulfill({ status: 200, contentType: "text/html", body: "<title>pay</title>" }));
  await page.click(".btn-order"); await page.waitForURL(/pay\.chargily\.dz/, { timeout: 8000 });
  const pp = PF.calls.find(c => c.p === "/v1/payments/pay").b; ok("الدفع بالبطاقة: يطلب الدفع بمرجع الطلب وعنوان العودة من نفس الموقع (المبلغ لا يُرسل)", /^[A-Za-z0-9]/.test(pp.order_id) && pp.return_url.startsWith("http://localhost:8794/p/anti-acne") && pp.amount === undefined, pp);
  /* العودة من الدفع */
  await page.goto("http://localhost:8794/p/anti-acne/index.html?pay=ok&order=W123", { waitUntil: "load" }); await page.waitForSelector("#dg-modal"); ok("صفحة العودة: تم الدفع", /تم الدفع/.test(await page.innerText("#dg-modal")) && !/pay=ok/.test(page.url()));
  /* لا طرق دفع */
  PAY = {}; await page.reload({ waitUntil: "load" }); await page.waitForSelector("#dg-pm"); ok("بلا طرق دفع: رسالة بدل خيارات", /غير مفعّل/.test(await page.innerText("#dg-pm")));
  /* منتج عادي لا يتأثر */
  await page.goto("http://localhost:8794/p/anti-colon/index.html", { waitUntil: "load" }); await page.waitForTimeout(1200); ok("منتج غير رقمي: النموذج كما هو", !(await vis("#dg-box")) && (await vis("#wilaya")));
  ok("بلا أخطاء جافاسكربت", errs.length === 0, errs);
  await br0.close(); srv.close(); console.log(fails ? "فشل " + fails : "كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
