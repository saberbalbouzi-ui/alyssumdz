/* معاينات مصغّرة حقيقية لمكتبة القوالب: node scripts/gen-template-thumbs.js [id…]
   يتطلب خادماً محلياً على 8765 (python3 -m http.server 8765) وPlaywright (NODE_PATH). المخرجات: assets/pages/templates/thumbs/<id>.jpg و<id>-full.jpg */
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "assets/pages/templates/thumbs"), BASE = "http://localhost:8765/";
const only = process.argv.slice(2);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(BASE + "admin.html"); await p.waitForTimeout(1500);
  const prods = await p.evaluate(() => (typeof PRODUCTS !== "undefined" ? PRODUCTS : []));
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/templates/index.json"), "utf8"));
  const jobs = idx.map(x => ({ id: x.id, file: x.id })).concat([{ id: "p-focus-honey", file: "focus-honey" }]);
  const legacy = await p.evaluate(() => AdminNav.libItems().filter(x => x.b).map(x => x.id));
  legacy.forEach(id => jobs.push({ id, legacy: true }));
  for (const j of jobs) {
    if (only.length && !only.includes(j.id)) continue;
    const html = await p.evaluate(([j, pr]) => {
      let pg;
      if (j.legacy) { const it = AdminNav.libItems().find(x => x.id === j.id); let s = it.b(); if (!Array.isArray(s)) s = [s]; pg = PB.newPage("t", ""); pg.sections = s; pg.header = false; pg.footer = false; }
      else return null;
      pg = PB.migrate(pg); return PB.fullHtml(pg, { base: "", edit: false, path: "", products: pr, pageProduct: pr[0] && pr[0].slug, site: { name: "متجرك", wa: "213555000000" } });
    }, [j, prods]);
    let H = html;
    if (!H) {
      const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/templates/" + j.file + ".json"), "utf8"));
      H = await p.evaluate(([t, pr]) => {
        const fill = n => { (n.cols || []).forEach(fill); (n.widgets || []).forEach(w => { if (w.type === "orderorig" && !w.set.prod && pr[0]) w.set.prod = pr[0].slug; fill(w); }); (n.free || []).forEach(fill); };
        t.sections.forEach(fill); const pg = PB.migrate(t); pg.product = pr[0] && pr[0].slug;
        return PB.fullHtml(pg, { base: "", edit: false, path: "", products: pr, pageProduct: pr[0] && pr[0].slug, site: { name: "متجرك", wa: "213555000000" } });
      }, [tpl, prods]);
    }
    const tmp = path.join(ROOT, "_th_" + j.id + ".html"); fs.writeFileSync(tmp, H);
    const q = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 0.6 });
    await q.goto(BASE + "_th_" + j.id + ".html"); await q.waitForTimeout(2200);
    await q.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 300)); } window.scrollTo(0, 0); });
    await q.waitForTimeout(1500);
    const h = await q.evaluate(() => document.documentElement.scrollHeight);
    await q.screenshot({ path: path.join(OUT, j.id + ".jpg"), type: "jpeg", quality: 72, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(860, h) } });
    await q.screenshot({ path: path.join(OUT, j.id + "-full.jpg"), type: "jpeg", quality: 55, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: Math.min(5200, h) } });
    console.log(j.id, h); await q.close(); fs.unlinkSync(tmp);
  }
  await b.close();
})();
