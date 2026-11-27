/* قوالب القص على الهاتف: نافذة المعاينة 3D وشريط «طيّ» يظهران معاً في شاشة واحدة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }), c = await b.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 600 } }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 600)); Studio3D.open({ tab: "cut" }); for (let i = 0; i < 40 && !document.getElementById("bp-3d"); i++) await new Promise(r => setTimeout(r, 300)); await new Promise(r => setTimeout(r, 1500));
    const v = document.getElementById("bp-3d"), s = document.getElementById("bp-fold"); s.scrollIntoView({ block: "end" }); await new Promise(r => setTimeout(r, 400)); const a = v.getBoundingClientRect(), b = s.getBoundingClientRect(); return { vTop: Math.round(a.top), vH: Math.round(a.height), sBot: Math.round(b.bottom), H: innerHeight }; });
  t("المعاينة وشريط «طيّ» معاً داخل الشاشة", r.vTop >= 46 && r.sBot <= r.H && r.vH >= 180 && r.vH <= 0.42 * r.H, r);
  await b.close(); process.exit(bad ? 1 : 0);
})();
