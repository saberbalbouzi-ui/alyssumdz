/* غطاء «جارٍ التحديث…» يبقى في وسط الشاشة (المؤشر والنص) حتى بعد أن يمرّ عليه قفل النوافذ (admin-modal-stable) — كان يحوّل align-items إلى flex-start فيدفعهما للجانب. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const [name, ctxo] of [["هاتف", { ...devices["Pixel 7"] }], ["مكتب", { viewport: { width: 1280, height: 800 } }]]) {
    const c = await b.newContext(ctxo), p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
    const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); AdminUpdate.showCover("جارٍ التحديث… سيُعاد فتح عملك تلقائياً"); await new Promise(r => setTimeout(r, 1400));
      const d = document.getElementById("au-cover"), k = [...d.children].filter(x => x.tagName === "SPAN").map(x => { const r = x.getBoundingClientRect(); return { cx: Math.round(r.left + r.width / 2), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
      return { vw: innerWidth, vh: innerHeight, k, ai: getComputedStyle(d).alignItems }; });
    const mid = (r.k[0].top + r.k[1].bottom) / 2;
    t(name + ": المؤشر والنص متوسّطان أفقياً", r.k.every(x => Math.abs(x.cx - r.vw / 2) <= 3), r);
    t(name + ": المجموعة في وسط الشاشة رأسياً", Math.abs(mid - r.vh / 2) <= 12, { mid, r });
    t(name + ": بلا أخطاء", errs.length === 0, errs); await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
