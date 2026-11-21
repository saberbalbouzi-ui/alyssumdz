/* اسم المنصة في اللوحة: الكلمة اللاتينية الواحدة تُحذف من «آليسوم ALYSSUM». NODE_PATH=/opt/node-tools/node_modules node scripts/test-brand-short.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 800 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const R = await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); const f = AdminShortName; return { a: f("آليسوم ALYSSUM"), b: f("ALYSSUM آليسوم"), c: f("ALYSSUM"), d: f("متجر Dz Shop"), e: f("متجري"), brand: (document.querySelector("#app .top>h1") || {}).dataset ? document.querySelector("#app .top>h1").dataset.brand : null, home: (SITE_CFG && SITE_CFG.name) || "", greet: (AdminHome.render(), (document.querySelector("#ahome .ah-hd h2") || {}).textContent || "") }; });
  t("الدالة: «آليسوم ALYSSUM» ← «آليسوم»، واللاتيني وحده وأكثر من كلمة يبقيان", R.a === "آليسوم" && R.b === "آليسوم" && R.c === "ALYSSUM" && R.d === "متجر Dz Shop" && R.e === "متجري", R);
  t("اسم المتجر صار «ALYSSUM» فقط في الإعدادات والشريط العلوي والتحية", R.home === "ALYSSUM" && R.brand === "ALYSSUM" && /ALYSSUM/.test(R.greet) && !/[\u0600-\u06ff]+\s*ALYSSUM|ALYSSUM\s*[\u0600-\u06ff]{3,}\s*$/.test(R.brand || ""), R);
  await b.close(); process.exit(bad ? 1 : 0);
})();
