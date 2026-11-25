/* إشعارا التحديث («يتوفر تحديث جديد» و«سيُحدَّث تلقائياً بعد N ثوانٍ») يظهران في وسط الشاشة لا في الزاوية بجانب النافذة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  for (const [w, h] of [[1200, 800], [400, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.removeItem("au_dismiss"); } catch (e) { } });
    await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
    const R = await p.evaluate(async () => {
      document.getElementById("app").classList.remove("hidden"); const f0 = window.fetch; window.fetch = async (u, o) => /VERSION/.test(String(u)) ? { ok: true, text: async () => "99.0.0" } : { ok: true, text: async () => "", json: async () => ({}) };
      const old = document.getElementById("au-banner"); if (old) old.remove(); await AdminUpdate.check(false); await new Promise(r => setTimeout(r, 100));
      const c = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
      const bn = document.getElementById("au-banner"); return { vw: innerWidth, vh: innerHeight, banner: bn ? c(bn) : null };
    });
    t("إشعار «يتوفر تحديث» في الوسط عند عرض " + w, R.banner && Math.abs(R.banner.x - R.vw / 2) <= 3 && Math.abs(R.banner.y - R.vh / 2) <= 3, R);
    await p.close();
  }
  const src = require("fs").readFileSync("assets/js/admin-update.js", "utf8");
  t("عدّاد «سيُحدَّث تلقائياً» (au-auto) معرَّف في الوسط", /id = "au-auto"; d\.style\.cssText = "position:fixed;top:50%;left:50%;transform:translate\(-50%,-50%\)/.test(src), "src");
  await b.close(); process.exit(bad ? 1 : 0);
})();
