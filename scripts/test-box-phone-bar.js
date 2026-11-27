/* استوديو 3D على الهاتف: شريط التحكم السفلي صف واحد مضغوط ولا يغطي أكثر من ~15% من المشهد (كان صفين بـ105px من 265px). NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }), c = await b.newContext({ ...devices["Pixel 7"] }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const r = await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 800)); try { Studio3D.open({ tab: "box" }); } catch (e) { } for (let i = 0; i < 40 && !document.getElementById("bar"); i++) await new Promise(r => setTimeout(r, 300)); await new Promise(r => setTimeout(r, 2000));
    const h = id => document.getElementById(id).getBoundingClientRect().height, bar = document.getElementById("bar"), btns = [...bar.querySelectorAll(".ib")].map(e => Math.round(e.getBoundingClientRect().top)); return { stage: Math.round(h("stage")), bar: Math.round(h("bar")), rows: new Set(btns).size, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
  t("شريط التحكم صف واحد", r.rows === 1, r);
  t("الشريط لا يغطي أكثر من 15% من المشهد", r.bar / r.stage <= .15, r);
  t("المشهد أطول من 360px", r.stage >= 360, r);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
