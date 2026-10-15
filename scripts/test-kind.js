/* نوع المتجر (مادي/رقمي): اختيار أول دخول، رئيسية رقمية، إخفاء أقسام التوصيل، إنشاء موقع من النوع الآخر.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-kind.js */
const http = require("http"), fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
let STORE = { name: "عميل", kindAsk: true };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0];
  if (u === "/__blank") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><meta charset=utf-8><body></body>"); }
  if (u === "/assets/data/store.json") { r.writeHead(200, { "Content-Type": "application/json" }); return r.end(JSON.stringify(STORE)); }
  const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); });
const load = (p, src) => p.evaluate((s) => new Promise((r) => { const e = document.createElement("script"); e.src = s; e.onload = r; document.body.appendChild(e); }), src);
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
  await p.goto(base + "/__blank");
  await p.evaluate(() => {
    document.body.innerHTML = '<div id="app"><nav class="side-nav">' +
      ["home", "orders", "shipped", "callcenter", "digital", "delivery", "fees", "returns", "inventory", "store"].map((t) => `<button class="nav-btn" onclick="Admin.tab('${t}',this)">${t}</button>`).join("") +
      '</nav><div id="tab-digital"><div id="digital-content"></div></div><div id="tab-store"><div id="stores-app"></div></div></div>';
    window.__tabs = []; window.toast = () => { };
    window.Admin = { orders: [], products: [], tab(t) { window.__tabs.push(t); }, isDigital: () => false };
    window.AdminDigital = { S: { orders: [{ state: "awaiting" }, { state: "ready" }], proofs: [{ id: 1 }] } };
  });
  await load(p, "/assets/js/admin-stores.js"); await load(p, "/assets/js/admin-kind.js");
  await p.waitForSelector("#kd-bg", { timeout: 8000 });
  ok("اختيار أول دخول يظهر لمتجر kindAsk", true);
  ok("خياران مادي ورقمي", (await p.$$("#kd-bg .kd-card")).length === 2);
  await p.evaluate(() => { window.__saved = null; });
  await p.click('#kd-bg .kd-card[data-k="digital"]');
  await p.waitForSelector("#kd-bg", { state: "detached" });
  ok("النوع رقمي في الحالة", await p.evaluate(() => AdminStores.kind() === "digital" && AdminStores.data().kindAsk === false));
  ok("صنف kind-digital على الصفحة", await p.evaluate(() => document.documentElement.classList.contains("kind-digital")));
  ok("أقسام التوصيل مخفية", await p.evaluate(() => ["shipped", "callcenter", "delivery", "fees", "returns", "inventory"].every((t) => { const b = [...document.querySelectorAll(".nav-btn")].find((x) => x.textContent === t); return getComputedStyle(b).display === "none"; })));
  ok("الطلبات والرقمي والرئيسية ظاهرة", await p.evaluate(() => ["home", "orders", "digital", "store"].every((t) => { const b = [...document.querySelectorAll(".nav-btn")].find((x) => x.textContent === t); return getComputedStyle(b).display !== "none"; })));
  ok("يهبط على تبويب الرقمي", await p.evaluate(() => window.__tabs.includes("digital")));
  ok("بطاقة الرئيسية الرقمية", await p.evaluate(() => { const h = document.getElementById("kd-hero"); return !!h && /الرئيسية الرقمية/.test(h.textContent) && /إثباتات دفع/.test(h.textContent); }));
  ok("الحفظ المحلي يحمل النوع", await p.evaluate(() => JSON.parse(localStorage.getItem("alyssum_store_cfg")).kind === "digital"));
  /* إنشاء موقع مادي آخر من بطاقة الرئيسية الرقمية */
  await p.evaluate(() => { document.getElementById("stores-app").innerHTML = ""; });
  await p.click('#kd-hero [data-kd="new"][data-k="physical"]');
  await p.waitForSelector("#stp-nw-n"); await p.fill("#stp-nw-n", "boutique-x");
  ok("نوع «مادي» محدد افتراضياً في بطاقة الإضافة", await p.evaluate(() => document.querySelector('input[name="stp-nw-k"][value="physical"]').checked));
  await p.evaluate(() => { localStorage.removeItem("alyssum_stores"); window.SaasClient = new Proxy({ on: () => true, send: async (o) => { window.__ticket = o; return { ok: true, num: 1 }; }, list: async () => ({ ok: true, tickets: [] }) }, { get: (t, k) => (k in t ? t[k] : () => ({ ok: false })) }); });
  await p.click('input[name="stp-nw-k"][value="digital"]'); await p.waitForTimeout(100);
  await p.evaluate(() => { document.querySelector('input[name="stp-nw-k"][value="physical"]').click(); });
  await p.evaluate(() => AdminStores.createSite("request", { id: "r1", at: new Date().toISOString(), items: [{ d: "x.com", s: "manual" }], status: "pending" }));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem("alyssum_stores") || "[]"));
  ok("الموقع الجديد يحمل kind=physical", st.length === 1 && st[0].kind === "physical", st);
  ok("شارة النوع في «مواقعي»", await p.evaluate(() => /مادي/.test(document.getElementById("stores-app").textContent)));
  await p.waitForTimeout(300);
  ok("التذكرة تحمل النوع", await p.evaluate(() => window.__ticket && window.__ticket.payload.new.kind === "physical" && /نوع المتجر: مادي/.test(window.__ticket.body)), await p.evaluate(() => window.__ticket));
  ok("بطاقة «نوع المتجر» للحالي", await p.evaluate(() => { AdminStores.tog("cur"); return !!document.getElementById("stp-kind") && document.getElementById("stp-kind").value === "digital"; }));
  /* متجر kind مسبق: لا سؤال */
  STORE = { name: "رقمي جاهز", kind: "digital", kindAsk: false };
  const p2 = await ctx.newPage(); p2.on("pageerror", (e) => errs.push(e.message)); await p2.goto(base + "/__blank");
  await p2.evaluate(() => { document.body.innerHTML = '<div id="app"><button class="nav-btn" onclick="Admin.tab(\'shipped\',this)">s</button><div id="tab-digital"></div></div>'; window.Admin = { orders: [], tab() { }, isDigital: () => false }; });
  await load(p2, "/assets/js/admin-stores.js"); await load(p2, "/assets/js/admin-kind.js"); await p2.waitForTimeout(1500);
  ok("kind مسبق: لا نافذة اختيار", !(await p2.$("#kd-bg")));
  ok("kind مسبق: التوصيل مخفي", await p2.evaluate(() => getComputedStyle(document.querySelector(".nav-btn")).display === "none"));
  /* رابط #kind=digital يتخطى السؤال */
  STORE = { name: "جديد", kindAsk: true };
  const p3 = await ctx.newPage(); p3.on("pageerror", (e) => errs.push(e.message)); await p3.goto(base + "/__blank#kind=digital");
  await p3.evaluate(() => { document.body.innerHTML = '<div id="app"><div id="tab-digital"></div></div>'; window.Admin = { orders: [], tab() { }, isDigital: () => false }; });
  await load(p3, "/assets/js/admin-stores.js"); await load(p3, "/assets/js/admin-kind.js"); await p3.waitForTimeout(1500);
  ok("#kind=digital: بلا سؤال والنوع رقمي", !(await p3.$("#kd-bg")) && await p3.evaluate(() => AdminStores.kind() === "digital"));
  ok("لا أخطاء صفحة", errs.length === 0, errs);
  await browser.close(); srv.close(); console.log(fails ? "FAILED " + fails : "ALL OK"); process.exit(fails ? 1 : 0);
})();
