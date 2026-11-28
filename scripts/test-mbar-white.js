/* شريط إجراءات العنصر على الهاتف: نصوصه بيضاء في المظهرين الفاتح والداكن. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const c = await b.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 800 } }), p = await c.newPage();
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|generativelanguage/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; PBApp.open({ v: 1, title: "t", slug: "t-mb", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 300, t: 300, m: 300 } }, free: [], cols: [{ id: "c1", widgets: [] }] }] }, "", true); await new Promise(r => setTimeout(r, 1200)); });
  for (const th of ["glass", "white"]) {
    await p.evaluate(th => { const h = document.documentElement; h.classList.remove("glass", "white"); h.classList.add("glass"); if (th === "white") h.classList.add("white"); const bar = document.querySelector(".pbx-mbar"); bar.style.display = "flex"; }, th);
    const r = await p.evaluate(() => [...document.querySelectorAll(".pbx-mbar button, .pbx-mbar small")].map(e => getComputedStyle(e).color));
    t(th + ": كل نصوص الشريط بيضاء", r.length > 5 && r.every(x => x === "rgb(255, 255, 255)"), [...new Set(r)]);
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
