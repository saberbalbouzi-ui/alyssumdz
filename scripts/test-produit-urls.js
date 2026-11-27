/* روابط المنتجات النظيفة تحت /produit/ (المنتج بلا مسار): تعمل بلا أصول مفقودة والرابط القديم /<slug>/ يحوّل إليها؛ والمنتج الذي مساره صفحة هبوط يبقى في الجذر alyssumdz.com/<slug>/ (كصفحة). NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const base = "http://localhost:" + (process.env.PORT || 8765);
  { const p = await b.newPage({ viewport: { width: 412, height: 840 } }); const miss = [];
    p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(base) && !/favicon|supabase|\.map$/.test(r.url())) miss.push(r.status() + " " + r.url().replace(base, "")); });
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co|api\.alyssumhub/, r => r.abort());
    await p.goto(base + "/produit/tarkiz/", { waitUntil: "load" }); await p.waitForTimeout(2500);
    const info = await p.evaluate(() => ({ path: location.pathname, canon: (document.querySelector("link[rel=canonical]") || {}).href || "", h: document.body.innerText.length }));
    t("منتج بمسار صفحة: /produit/tarkiz/ تفتح (نسخة صفحة مساره) وتبقى في شريط العنوان", info.path === "/produit/tarkiz/" && info.h > 200, info);
    t("canonical يشير إلى صفحة الهبوط (لا تكرار)", /alyssumdz\.com\/tarkiz\/$/.test(info.canon), info.canon);
    t("ولا أصول مفقودة", miss.length === 0, miss.slice(0, 5));
    await p.goto(base + "/tarkiz/", { waitUntil: "load" }); await p.waitForTimeout(1500);
    t("صفحة الهبوط tarkiz في جذرها /tarkiz/ (لا تحويل) بالرغم من وجود منتج بالاسم نفسه", await p.evaluate(() => location.pathname) === "/tarkiz/" && await p.evaluate(() => document.body.innerText.length) > 200, await p.evaluate(() => location.pathname));
    await p.close(); }
  for (const slug of ["miel-sidr"]) {
    const p = await b.newPage({ viewport: { width: 412, height: 840 } }); const miss = [], errs = [];
    p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(base) && !/favicon|supabase|\.map$/.test(r.url())) miss.push(r.status() + " " + r.url().replace(base, "")); }); p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
    await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co|api\.alyssumhub/, r => r.abort());
    await p.goto(base + "/produit/" + slug + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
    const info = await p.evaluate(() => ({ path: location.pathname, canon: (document.querySelector("link[rel=canonical]") || {}).href || "", h: document.body.innerText.length }));
    t(slug + ": /produit/" + slug + "/ تفتح ولها نص", info.path === "/produit/" + slug + "/" && info.h > 200, info);
    const det = await p.evaluate(() => typeof currentProductSlugFromUrl === "function" ? currentProductSlugFromUrl() : "(no fn)");
    t(slug + ": المتجر يتعرّف على المنتج الحالي من /produit/<slug>/ (السلة والطلب والبيكسل والوكيل)", det === slug, det);
    t(slug + ": canonical جديد", /\/produit\/[a-z0-9-]+\/$/.test(info.canon), info.canon);
    t(slug + ": بلا أصول مفقودة", miss.length === 0, miss.slice(0, 5));
    await p.goto(base + "/" + slug + "/", { waitUntil: "load" }); await p.waitForTimeout(1500);
    t(slug + ": الرابط القديم /" + slug + "/ يحوّل إلى /produit/" + slug + "/", await p.evaluate(() => location.pathname) === "/produit/" + slug + "/", await p.evaluate(() => location.pathname));
    await p.close();
  }
  const sm = await (await fetch(base + "/sitemap.xml")).text();
  t("خريطة الموقع: المنتج تحت /produit/ وصفحة الهبوط (مسار منتج) في جذرها مرة واحدة", /\/produit\/miel-sidr\//.test(sm) && /alyssumdz\.com\/tarkiz\//.test(sm) && !/alyssumdz\.com\/miel-sidr\//.test(sm) && !/\/produit\/tarkiz\//.test(sm), sm.slice(0, 200));
  await b.close(); process.exit(bad ? 1 : 0);
})();
