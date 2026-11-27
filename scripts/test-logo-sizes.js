/* منشئ الشعار: مقاسات معروفة وصغيرة (512×512 افتراضي) وشعارات النص مُصغَّرة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.setItem("alyssum_gp_gkey", "AIzaTEST"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  await p.evaluate(async () => { document.getElementById("app").classList.remove("hidden"); PBApp.open({ v: 1, title: "t", slug: "t-lg", ff: "Cairo", css: "", sections: [] }); await new Promise(r => setTimeout(r, 800)); PBBrand.openLogo(); await new Promise(r => setTimeout(r, 400)); });
  const opts = await p.evaluate(() => [...document.querySelectorAll("#pblg-sz option")].map(o => o.value));
  t("خيارات مقاس معروفة وأصغرها 256", opts.join() === "512x512,600x400,256x256", opts);
  await p.fill("#pblg-n", "Test Shop");
  for (const [k, w] of [["mono", 512], ["badge", 600]]) {
    await p.click('[data-lg="' + k + '"]'); await p.waitForTimeout(1200);
    const wd = await p.evaluate(() => { const i = document.querySelector("#pblg-o img"); return i ? i.naturalWidth : 0; });
    t("شعار " + k + " عرضه " + w + " لا أكبر", wd === w, wd);
  }
  let msg = ""; p.on("dialog", d => { msg = d.message(); d.dismiss(); });
  await p.selectOption("#pblg-sz", "600x400"); await p.click('[data-lg="ai"]'); await p.waitForTimeout(800);
  t("نافذة التأكيد تذكر المقاس المختار 600×400", /600×400/.test(msg), msg);
  await p.selectOption("#pblg-sz", "512x512"); await p.click('[data-lg="ai"]'); await p.waitForTimeout(800);
  t("والافتراضي 512×512 لا 1024", /512×512/.test(msg) && !/1024/.test(msg), msg);
  t("بلا أخطاء JS", !errs.length, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
