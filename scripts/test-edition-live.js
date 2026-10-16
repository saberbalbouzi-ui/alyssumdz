/* لوحات الإدارة الثلاث (برو/بازيك/ديزاين) مع admin-stores الحقيقي.
   NODE_PATH=/opt/node-tools/node_modules node scripts/test-edition-live.js */
const http = require("http"), fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const root = path.join(__dirname, ".."); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("✓", n); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
let STORE = { name: "عميل", edition: "design" };
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
      ["home", "orders", "builder", "studio", "store", "digital"].map((t) => `<button class="nav-btn" onclick="Admin.tab('${t}',this)">${t}</button>`).join("") +
      '</nav><div id="tab-store"><div id="stores-app"></div></div></div>';
    window.__tabs = []; window.toast = () => { };
    window.Admin = { orders: [], products: [], tab(t) { window.__tabs.push(t); }, isDigital: () => false };
  });
  await load(p, "/assets/js/admin-stores.js"); await load(p, "/assets/js/admin-edition.js"); await load(p, "/assets/js/admin-kind.js");
  await p.waitForFunction(() => document.documentElement.classList.contains("ed-design"), null, { timeout: 8000 });
  ok("صنف ed-design من store.json", true);
  ok("الحالة design", await p.evaluate(() => AdminEdition.edition() === "design"));
  ok("بطاقة الإعدادات: 3 خيارات", await p.evaluate(() => { AdminStores.tog("cur"); return document.querySelectorAll('input[name="stp-edition"]').length === 3 && document.querySelector('input[name="stp-edition"][value="design"]').checked; }));
  ok("الحفظ يضع edition", await p.evaluate(() => { document.querySelector('input[name="stp-edition"][value="basic"]').click(); return AdminEdition.picked() === "basic"; }));
  await browser.close(); srv.close(); console.log(errs.length ? "errs " + JSON.stringify(errs) : "", fails ? "FAILED " + fails : "ALL OK"); process.exit(fails || errs.length ? 1 : 0);
})();
