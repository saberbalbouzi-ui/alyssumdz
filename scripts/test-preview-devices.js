/* معاينة الموقع/قبل النشر: الهاتف بلا أزرار أجهزة (وضع الهاتف)، التابلت هاتف+تابلت، المكتب الثلاثة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const [name, w, exp, def] of [["هاتف", 390, [], "phone"], ["تابلت", 900, ["tablet", "phone"], "tablet"], ["مكتب", 1366, ["desktop", "tablet", "phone"], "desktop"]]) {
    const c = await b.newContext({ serviceWorkers: "block", viewport: { width: w, height: 800 } }), p = await c.newPage();
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
    await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "load" }); await p.waitForTimeout(800);
    await p.evaluate(() => SitePreview.openHtml("<p>x</p>", { title: "معاينة قبل النشر" })); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ vis: [...document.querySelectorAll(".spv-bar [data-d]")].filter(x => getComputedStyle(x).display !== "none").map(x => x.dataset.d), cls: document.getElementById("spv-frame").className.trim() }));
    t(name + ": الأزرار " + JSON.stringify(exp) + " والوضع الافتراضي " + def, JSON.stringify(r.vis) === JSON.stringify(exp) && (def === "desktop" ? r.cls === "spv-frame" : r.cls === "spv-frame " + def), r);
    await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
