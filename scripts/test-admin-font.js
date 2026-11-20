/* خط اللوحة Cairo محلي: يبقى حتى لو حُجبت خطوط Google. NODE_PATH=/opt/node-tools/node_modules node scripts/test-admin-font.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const local = []; p.on("response", r => { if (/assets\/fonts\/cairo-(arabic|latin)\.woff2/.test(r.url())) local.push(r.status()); });
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); const d = document.createElement("div"); d.textContent = "اختبار Cairo 123"; d.style.cssText = "font-family:Cairo,sans-serif;position:fixed;top:0"; document.body.appendChild(d); await document.fonts.load("16px Cairo", "اختبار Cairo"); await document.fonts.ready; return { check: document.fonts.check("16px Cairo", "اختبار"), loaded: [...document.fonts].filter(f => f.status === "loaded" && f.family.replace(/["']/g, "") === "Cairo").length }; });
  t("Cairo يُحمَّل من الملف المحلي رغم حجب خطوط Google", R.check && R.loaded >= 1 && local.some(s => s === 200), [R, local]);
  await b.close(); process.exit(bad ? 1 : 0);
})();
