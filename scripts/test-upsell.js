/* اختبار العروض الإضافية (Order Bump + Upsell بعد الشراء): الدوال النقية ثم متجر حقيقي في متصفح.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-upsell.js */
const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm"), { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
/* ── (1) الدوال النقية ── */
const ctx0 = { window: {}, document: undefined, globalThis: {} }; ctx0.globalThis = ctx0.window;
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/upsell.js"), "utf8"), Object.assign(ctx0, { location: { pathname: "/admin.html" } }));
const U = ctx0.window.Upsell;
const P = [{ slug: "a", title: "A", price: 1000, cat: "x" }, { slug: "b", title: "B", price: 500, cat: "y", stock: 5 }, { slug: "c", title: "C", price: 800, cat: "x", stock: 0 }, { slug: "v", title: "V", price: 300, type: "variable" }, { slug: "h", title: "H", price: 100, active: false }];
const R = (o) => Object.assign({ id: "r", on: true, type: "bump", offer: "b", mode: "pct", value: 20, trigger: {} }, o);
ok("خصم نسبة", U.priceOf(R({}), P[1]) === 400);
ok("سعر ثابت لا يتجاوز السعر العادي", U.priceOf(R({ mode: "price", value: 900 }), P[1]) === 500 && U.priceOf(R({ mode: "price", value: 250 }), P[1]) === 250);
ok("نسبة 100% = مجاني ولا سالب", U.priceOf(R({ value: 150 }), P[1]) === 0);
ok("يلتقط القاعدة ويحسب السعر القديم", (() => { const c = U.pick("bump", { slugs: ["a"], cats: ["x"], total: 1000 }, P, [R({})]); return c && c.price === 400 && c.old === 500; })());
ok("النوع الآخر لا يُلتقط", !U.pick("post", { slugs: ["a"], cats: [], total: 1 }, P, [R({})]));
ok("المنتج موجود في الطلب أصلاً ← لا عرض", !U.pick("bump", { slugs: ["b"], cats: [], total: 1 }, P, [R({})]));
ok("نافد المخزون ← لا عرض", !U.pick("bump", { slugs: ["a"], cats: [], total: 1 }, P, [R({ offer: "c" })]));
ok("المتغيّر والمعطَّل ← لا عرض", !U.pick("bump", { slugs: ["a"], cats: [], total: 1 }, P, [R({ offer: "v" })]) && !U.pick("bump", { slugs: ["a"], cats: [], total: 1 }, P, [R({ offer: "h" })]));
ok("المحفّز بالمنتج/الفئة/الحد الأدنى", U.matches(R({ trigger: { slugs: ["a"] } }), { slugs: ["a"], cats: [], total: 0 }) && !U.matches(R({ trigger: { slugs: ["z"] } }), { slugs: ["a"], cats: ["x"], total: 0 }) && U.matches(R({ trigger: { cats: ["x"] } }), { slugs: ["q"], cats: ["x"], total: 0 }) && !U.matches(R({ trigger: { min: 2000 } }), { slugs: ["a"], cats: [], total: 1000 }));
ok("نافذة التاريخ", !U.isActive(R({ to: "2000-01-01" })) && !U.isActive(R({ from: "2999-01-01" })) && U.isActive(R({ from: "2000-01-01", to: "2999-01-01" })) && !U.isActive(R({ on: false })));
ok("أول قاعدة صالحة تسبق (ترتيب الأولوية)", U.pick("bump", { slugs: ["a"], cats: [], total: 1 }, P, [R({ id: "x1", offer: "c" }), R({ id: "x2" })]).rule.id === "x2");

/* ── (2) متجر حقيقي ── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html"; const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(8792, r));
  const br0 = await chromium.launch(), br = await br0.newContext({ serviceWorkers: "block" }), page = await br.newPage({ viewport: { width: 420, height: 900 } }), errs = []; page.on("pageerror", e => errs.push(String(e)));
  const rules = { rules: [
    { id: "b1", on: true, type: "bump", title: "أضف مضاد التساقط", text: "بـ {price} بدل {old} ({pct})", offer: "anti-chute", mode: "pct", value: 50, trigger: {} },
    { id: "p1", on: true, type: "post", title: "عرض خاص بعد طلبك", offer: "anti-colon", mode: "pct", value: 40, trigger: {} }] };
  await page.route("**/assets/data/upsell.json*", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(rules) }));
  await page.route(/script\.google|supabase\.co|alyssumhub|wa\.me|api\.whatsapp/, r => r.fulfill({ status: 200, body: "{}" }));
  await page.addInitScript(() => { window.__orders = []; window.open = () => null; });
  await page.goto("http://localhost:8792/p/anti-acne/index.html", { waitUntil: "load" });
  await page.evaluate(() => { API.submitOrder = o => window.__orders.push(JSON.parse(JSON.stringify(o))); });
  await page.waitForSelector(".ups-bump:not([hidden])", { timeout: 10000 });
  const base = await page.evaluate(() => document.getElementById("grand").textContent);
  ok("خانة Order Bump تظهر مع السعر الخاص", /anti|مضاد|التساقط/.test(await page.innerText(".ups-bump")) && /دج/.test(await page.innerText(".ups-bump")));
  await page.fill("#name", "سارة"); await page.fill("#phone", "0555123456"); await page.selectOption("#wilaya", { index: 16 }); await page.waitForTimeout(300);
  const comm = await page.$$eval("#commune option", o => o.length); if (comm > 1) await page.selectOption("#commune", { index: 1 }); else await page.fill("#commune", "الجزائر").catch(() => { });
  await page.waitForTimeout(300);
  const t0 = await page.evaluate(() => document.getElementById("grand").textContent);
  await page.check(".ups-bump input"); await page.waitForTimeout(200);
  const t1 = await page.evaluate(() => document.getElementById("grand").textContent), num = s => +String(s).replace(/[^\d]/g, "");
  const bumpPrice = await page.evaluate(() => Math.round(PRODUCTS.find(p => p.slug === "anti-chute").price * .5));
  ok("الإجمالي يزيد بسعر الإضافة بالضبط", num(t1) - num(t0) === bumpPrice, { t0, t1, bumpPrice });
  await page.uncheck(".ups-bump input"); await page.waitForTimeout(150);
  ok("إلغاء التحديد يعيد الإجمالي", (await page.evaluate(() => document.getElementById("grand").textContent)) === t0);
  await page.check(".ups-bump input"); await page.waitForTimeout(150);
  await page.click("#order-form button[type=submit]"); await page.waitForSelector("#thx", { timeout: 8000 });
  const o1 = await page.evaluate(() => window.__orders[0]);
  ok("الطلب يحمل بند الإضافة والإجمالي ووسم المجموعة", o1 && o1.items.length === 2 && o1.items[1].slug === "anti-chute" && o1.items[1].price === bumpPrice && o1.total === num(t1) && o1.subtotal === o1.items.reduce((s, i) => s + i.price * i.qty, 0), o1);
  ok("وسم «إضافة سريعة» و«مجموعة»", o1.extra["➕ إضافة سريعة"] && /^G/.test(o1.extra["🧺 مجموعة"]), o1.extra);
  await page.waitForSelector(".ups-post");
  ok("بطاقة Upsell بعد الشراء في صفحة الشكر", /anti|قولون|عرض خاص/.test(await page.innerText(".ups-post")));
  await page.click(".ups-post .yes"); await page.waitForSelector(".ups-post .ok", { timeout: 5000 });
  const o2 = await page.evaluate(() => window.__orders[1]);
  const postPrice = await page.evaluate(() => Math.round(PRODUCTS.find(p => p.slug === "anti-colon").price * .6));
  ok("الطلب الثاني: نفس الزبون، بلا توصيل، بالسعر الخاص", o2 && o2.phone === o1.phone && o2.name === o1.name && o2.wilaya === o1.wilaya && o2.fee === 0 && o2.total === postPrice && o2.items[0].slug === "anti-colon", o2);
  ok("نفس مجموعة الطلب الأول ووسم العرض", o2.extra["🧺 مجموعة"] === o1.extra["🧺 مجموعة"] && o2.extra["🔼 عرض بعد الشراء"], o2.extra);
  ok("لا طلب ثالث (لا تكرار)", (await page.evaluate(() => window.__orders.length)) === 2);
  /* بلا قواعد ← لا شيء يظهر */
  rules.rules = []; const p2 = await br.newPage({ viewport: { width: 420, height: 900 } }); await p2.route("**/assets/data/upsell.json*", r => r.fulfill({ contentType: "application/json", body: "{\"rules\":[]}" })); await p2.route(/script\.google|supabase\.co|alyssumhub|wa\.me/, r => r.fulfill({ status: 200, body: "{}" }));
  await p2.goto("http://localhost:8792/p/anti-acne/index.html"); await p2.waitForTimeout(1500);
  ok("بلا قواعد: لا خانة", !(await p2.$(".ups-bump:not([hidden])")));
  /* السلة */
  const p3 = await br.newPage({ viewport: { width: 420, height: 900 } }); await p3.route("**/assets/data/upsell.json*", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ rules: [{ id: "b1", on: true, type: "bump", offer: "anti-chute", mode: "price", value: 300, trigger: {} }] }) })); await p3.route(/script\.google|supabase\.co|alyssumhub|wa\.me/, r => r.fulfill({ status: 200, body: "{}" }));
  await p3.addInitScript(() => { window.__orders = []; window.open = () => null; });
  await p3.goto("http://localhost:8792/index.html"); await p3.waitForTimeout(800);
  await p3.evaluate(() => { API.submitOrder = o => window.__orders.push(JSON.parse(JSON.stringify(o))); Cart.add("anti-acne", 1, 2400); });
  await p3.waitForSelector("#ups-cartbump:not([hidden])", { timeout: 6000 });
  await p3.evaluate(() => document.querySelector("#ups-cartbump input").click()); await p3.waitForTimeout(300);
  const cart = await p3.evaluate(() => Cart.all());
  ok("السلة: الإضافة تصير بنداً بالسعر الخاص", cart.length === 2 && cart[1].slug === "anti-chute" && cart[1].price === 300 && cart[1].up === "b1", cart);
  ok("السلة: الخانة تبقى محدّدة بعد إعادة الرسم", await p3.evaluate(() => document.querySelector("#ups-cartbump input").checked));
  await p3.evaluate(() => document.querySelector("#ups-cartbump input").click()); await p3.waitForTimeout(300);
  ok("السلة: إلغاء التحديد يزيل البند", (await p3.evaluate(() => Cart.all())).length === 1);
  await p3.evaluate(() => Cart.add("anti-chute", 1, 900)); await p3.waitForTimeout(300);
  ok("السلة: وجود المنتج أصلاً يُخفي العرض", await p3.evaluate(() => document.getElementById("ups-cartbump").hidden));
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await br0.close(); srv.close(); console.log(fails ? "\n" + fails + " إخفاق" : "\n✓ كل الفحوص نجحت"); process.exit(fails ? 1 : 0);
})();
