/* رسالة الوكيل الترحيبية العائمة في صفحة المنتج: لا تظهر إن عُطِّل تطبيق الوكيل من اللوحة، وخطها أسود حين تظهر. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const base = "http://localhost:" + (process.env.PORT || 8765);
  const run = async off => {
    const cx = await b.newContext({ viewport: { width: 412, height: 800 }, serviceWorkers: "block" }), p = await cx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co|api\.alyssumhub/, r => r.abort());
    await p.route("**/assets/data/apps.json*", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ off }) }));
    await p.route("**/assets/data/agent-training.json*", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ scopes: { home: { enabled: true }, "miel-sidr": { enabled: true, nudge: { enabled: true, delaySec: 5 } } } }) }));
    await p.addInitScript(() => { try { sessionStorage.clear(); } catch (e) { } });
    await p.goto(base + "/produit/miel-sidr/", { waitUntil: "load" }); await p.waitForTimeout(8500);
    const r = await p.evaluate(() => { const t = document.getElementById("agent-teaser"); return t ? { color: getComputedStyle(t.querySelector(".tt")).color, bold: getComputedStyle(t.querySelector(".tt b") || t.querySelector(".tt")).color } : null; });
    await cx.close(); return r; };
  const off = await run(["agent"]), on = await run([]);
  t("التطبيق معطَّل من اللوحة: لا رسالة ترحيب عائمة", off === null, off);
  t("التطبيق مفعَّل: تظهر وخطها أسود", on && on.color === "rgb(17, 17, 17)" && on.bold === "rgb(17, 17, 17)", on);
  await b.close(); process.exit(bad ? 1 : 0);
})();
