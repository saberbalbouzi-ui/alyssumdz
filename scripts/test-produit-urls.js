/* روابط المنتجات النظيفة تحت /produit/: الصفحة تعمل بلا أصول مفقودة، والرابط القديم /<slug>/ يحوّل إليها، والرابط المعتمد canonical جديد. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const base = "http://localhost:" + (process.env.PORT || 8765);
  for (const slug of ["tarkiz", "miel-sidr"]) {
    const p = await b.newPage({ viewport: { width: 412, height: 840 } }); const miss = [], errs = [];
    p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(base) && !/favicon|supabase|\.map$/.test(r.url())) miss.push(r.status() + " " + r.url().replace(base, "")); }); p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co|api\.alyssumhub/, r => r.abort());
    await p.goto(base + "/produit/" + slug + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
    const info = await p.evaluate(() => ({ path: location.pathname, canon: (document.querySelector("link[rel=canonical]") || {}).href || "", h: document.body.innerText.length }));
    t(slug + ": /produit/" + slug + "/ تفتح ولها نص", info.path === "/produit/" + slug + "/" && info.h > 200, info);
    t(slug + ": canonical جديد", /\/produit\/[a-z0-9-]+\/$/.test(info.canon), info.canon);
    t(slug + ": بلا أصول مفقودة", miss.length === 0, miss.slice(0, 5));
    await p.goto(base + "/" + slug + "/", { waitUntil: "load" }); await p.waitForTimeout(1500);
    t(slug + ": الرابط القديم /" + slug + "/ يحوّل إلى /produit/" + slug + "/", await p.evaluate(() => location.pathname) === "/produit/" + slug + "/", await p.evaluate(() => location.pathname));
    await p.close();
  }
  const sm = await (await fetch(base + "/sitemap.xml")).text();
  t("خريطة الموقع بروابط /produit/ ولا روابط جذرية للمنتجات", /\/produit\/tarkiz\//.test(sm) && !/alyssumdz\.com\/tarkiz\//.test(sm), sm.slice(0, 200));
  await b.close(); process.exit(bad ? 1 : 0);
})();
