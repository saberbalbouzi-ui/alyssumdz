/* استوديو العلب (قوالب القص pf_): الفتح = الغطاء للأعلى والقاعدة ثابتة، تبدأ العلبة مغلقة، والمنزلق يطابق الوسمين. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1280, height: 800 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); await new Promise(r => setTimeout(r, 800)); });
  const rows = async () => { const buf = await p.screenshot({ clip: { x: 80, y: 90, width: 760, height: 560 } }); return p.evaluate(async b64 => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let top = 1e9, bot = -1; for (let y = 0; y < c.height; y++) { let n = 0; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] - d[i + 2] > 45 && d[i] > 120) n++; } if (n > 6) { top = Math.min(top, y); bot = Math.max(bot, y); } } return { top, bot }; }, buf.toString("base64")); };
  for (const key of ["cardbox", "giftbox", "cuboid"]) {
    await p.evaluate(async key => { Studio3D.open({ tab: "box", profile: { key } }); await new Promise(r => setTimeout(r, 5000)); }, key);
    const v0 = await p.evaluate(() => ({ v: document.getElementById("openR").value, dir: getComputedStyle(document.getElementById("openR")).direction }));
    t(key + ": تبدأ مغلقة (المنزلق 0) ومنزلق «مغلق» جهة الوسم", v0.v === "0" && v0.dir === "rtl", v0);
    await p.waitForTimeout(500); const r0 = await rows();
    await p.evaluate(() => { const r = document.getElementById("openR"); r.value = 70; r.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(700); const r1 = await rows();
    t(key + ": القاعدة ثابتة بالأسفل عند الفتح", Math.abs(r1.bot - r0.bot) <= 6, { r0, r1 });
    t(key + ": الغطاء يفتح إلى الأعلى (أعلى نقطة ترتفع)", r1.top < r0.top - 15, { r0, r1 });
  }
  t("بلا أخطاء JS", !errs.length, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
