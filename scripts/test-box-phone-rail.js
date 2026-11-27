/* استوديو العلب على الهاتف: شريط التبويبات (النماذج…) داخل الشاشة، وزر ☰ يفتح قائمة مرئية قابلة للنقر. NODE_PATH=/opt/node-tools/node_modules */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  for (const dev of ["iPhone 13", "Pixel 7", "iPhone SE"]) {
    const c = await b.newContext({ ...devices[dev] }), p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
    await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 600)); Studio3D.open({ tab: "box" }); for (let i = 0; i < 40 && !document.getElementById("exportBtn"); i++) await new Promise(r => setTimeout(r, 300)); await new Promise(r => setTimeout(r, 2500)); });
    const r = await p.evaluate(() => { const g = s => { const e = document.querySelector(s).getBoundingClientRect(); return { t: Math.round(e.top), b: Math.round(e.bottom), l: Math.round(e.left), r: Math.round(e.right) }; }; const tabs = [...document.querySelectorAll("#bs .tab")].map(e => e.dataset.tab + ":" + e.getBoundingClientRect().top.toFixed(0)); return { H: innerHeight, W: innerWidth, rail: g("#bs .rail"), stage: g("#bs .stage"), panel: g("#bs .panel"), tabs }; });
    t(dev + ": شريط التبويبات داخل الشاشة", r.rail.b <= r.H && r.rail.t >= 40, r);
    t(dev + ": المشهد بارتفاع مقبول (≥ 25% من الشاشة)", r.stage.b - r.stage.t >= 0.25 * r.H, r);
    t(dev + ": اللوحة السفلية داخل الشاشة", r.panel.b <= r.H + 1, r);
    await p.click('#bs .tab[data-tab="models"]').catch(() => p.click("#bs .rail .tab:nth-child(2)")); await p.waitForTimeout(600);
    await p.click("#menuBtn"); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const m = document.getElementById("menu"), r = m.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return { show: m.classList.contains("show"), hit: e && e.closest("#menu") ? "menu" : (e && (e.id || e.tagName)) }; });
    t(dev + ": قائمة ☰ ظاهرة وقابلة للنقر (غير مقصوصة)", m.show && m.hit === "menu", m);
    t(dev + ": بلا أخطاء JS", !errs.length, errs); await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
