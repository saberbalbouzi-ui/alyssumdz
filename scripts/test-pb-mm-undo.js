/* قائمة ☰ في المحرر على الهاتف: تراجع/إعادة في الشريط العلوي فقط ولا تتكرران في القائمة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), c = await b.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 800 } }), p = await c.newPage(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; PBApp.open({ v: 1, title: "t", slug: "t-mm", ff: "Cairo", css: "", sections: [{ id: "s1", set: { kind: "canvas", mh: { d: 300, t: 300, m: 300 } }, free: [], cols: [{ id: "c1", widgets: [] }] }] }, "", true); await new Promise(r => setTimeout(r, 1500)); });
  const top = await p.evaluate(() => ["pbx-undo", "pbx-redo"].map(id => { const e = document.getElementById(id), r = e && e.getBoundingClientRect(); return !!(r && r.width > 20 && r.top >= 0 && r.top < 80); }));
  t("تراجع وإعادة ظاهران في الشريط العلوي على الهاتف", top[0] && top[1], top);
  await p.click("#pbx-mmb"); await p.waitForTimeout(400);
  const items = await p.evaluate(() => [...document.querySelectorAll("#pbx-mm .pbx-mi")].map(x => x.textContent.trim()));
  t("القائمة بلا تراجع/إعادة وفيها بقية الأوامر", items.length > 3 && !items.some(x => /^(تراجع|إعادة)$/.test(x)), items);
  t("بلا أخطاء JS", errs.filter(m => !/sandboxed/.test(m)).length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
