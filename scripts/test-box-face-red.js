/* استوديو العلب: الوجه المنقور لرفع صورة يُظلَّل بغشاء أحمر شفاف ما دامت القائمة مفتوحة ويزول بإغلاقها. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1280, height: 800 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 800)); Studio3D.open({ tab: "box" }); for (let i = 0; i < 40 && !document.getElementById("overlay"); i++) await new Promise(r => setTimeout(r, 300)); await new Promise(r => setTimeout(r, 3500)); });
  await p.evaluate(() => { const r = document.getElementById('openR'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => { const r = document.getElementById("gl").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.5 }; });
  const px = async () => { const buf = await p.screenshot({ clip: { x: st.x + 130, y: st.y + 35, width: 8, height: 8 } }); return p.evaluate(async b64 => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); const d = g.getImageData(2, 2, 1, 1).data; return [d[0], d[1], d[2]]; }, buf.toString("base64")); };
  const before = await px();
  await p.mouse.click(st.x, st.y + 10); await p.waitForTimeout(1500);
  const menu = await p.evaluate(() => !!document.querySelector(".ctxm"));
  t("القائمة تظهر عند النقر على الوجه", menu, menu);
  const during = await px(); await p.screenshot({ path: '/tmp/red.png', clip: { x: st.x - 300, y: st.y - 250, width: 600, height: 500 } });
  t("الوجه مظلَّل بالأحمر أثناء القائمة", before[1] > 225 && during[1] < before[1] - 20 && during[0] - during[1] > 25, { before, during });
  await p.mouse.click(st.x - 500, st.y - 300); await p.waitForTimeout(1200); const after = await px();
  t("يزول الغشاء بإغلاق القائمة", after[1] > 225, after);
  t("بلا أخطاء JS", !errs.length, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
