/* إحصائيات اليوم على الهاتف: بطاقات قصيرة بعمودين (لا عمود واحد طويل)، بينما بطاقات «صافي الشركات» (نص أطول) تبقى بعرض أوسع. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 400, height: 860 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const R = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); for (let i = 0; i < 3 && document.getElementById("tab-home").classList.contains("hidden"); i++) { Admin.tab("home"); await new Promise(r => setTimeout(r, 500)); } await new Promise(r => setTimeout(r, 800));
    const g = [...document.querySelectorAll("#ahome .ah-card")].find(c => /إحصائيات اليوم/.test(c.textContent)); if (!g) return { none: true };
    const cs = [...g.querySelectorAll(".ah-pc")].map(x => Math.round(x.getBoundingClientRect().left)); return { n: cs.length, cols: new Set(cs).size, tpl: getComputedStyle(g.querySelector(".ah-pay")).gridTemplateColumns }; });
  t("إحصائيات اليوم: بطاقات بعمودين على عرض 400px", !R.none && R.n === 4 && R.cols === 2, R);
  await b.close(); process.exit(bad ? 1 : 0);
})();
