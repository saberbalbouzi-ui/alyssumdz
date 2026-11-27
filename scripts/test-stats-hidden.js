/* شريط الإحصاءات العلوي المكرر (#stats) مخفي في الطلبات. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices["iPhone 13"] }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(7000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 2500)); Admin.tab("orders"); await new Promise(r => setTimeout(r, 800)); Admin.tab("orders"); await new Promise(r => setTimeout(r, 1000)); const s = document.getElementById("stats"); return { disp: s ? getComputedStyle(s).display : "none", vis: !!(s && s.offsetParent) }; });
  t("#stats لا يظهر", r.disp === "none" && !r.vis, r);
  await b.close(); process.exit(bad ? 1 : 0);
})();
