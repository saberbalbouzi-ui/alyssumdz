/* قوالب القص: معاينة 3D لا تمنع تمرير الصفحة باللمس العمودي (touch-action:pan-y). NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1280, height: 800 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const ta = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 800)); Studio3D.open({ tab: "cut" }); for (let i = 0; i < 40 && !document.getElementById("bp-3d"); i++) await new Promise(r => setTimeout(r, 300)); return getComputedStyle(document.getElementById("bp-3d")).touchAction; });
  t("touch-action: pan-y", ta === "pan-y", ta);
  await b.close(); process.exit(bad ? 1 : 0);
})();
