/* شارة PRO في الإضافات المنصَّبة برتقالية (داكن وفاتح). NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const rgb = c => (/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c) || []).slice(1, 4).map(Number);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 800)); Admin.tab("addons", document.querySelector('.nav-btn[onclick*="Admin.tab(\'addons\'"]')); for (let i = 0; i < 40 && !document.querySelector(".ao-card"); i++) await new Promise(r => setTimeout(r, 300));
    try { await AdminAddons.refresh(); } catch (e) { } await new Promise(r => setTimeout(r, 1500)); const out = {}; const e = document.querySelector(".ao-pro"); out.dark = e && getComputedStyle(e).color; out.n = document.querySelectorAll(".ao-pro").length; document.documentElement.classList.add("white"); out.light = e && getComputedStyle(e).color; return out; });
  const d = rgb(r.dark || ""), l = rgb(r.light || "");
  t("شارة PRO موجودة في الإضافات", r.n > 0, r);
  t("لونها برتقالي في المظهر الداكن", d[0] > 230 && d[1] > 120 && d[1] < 190 && d[2] < 100, r.dark);
  t("وبرتقالي داكن مقروء في المظهر الفاتح", l[0] > 170 && l[1] > 60 && l[1] < 130 && l[2] < 40, r.light);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
