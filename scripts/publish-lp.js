/* يبني lp/<slug>/index.html من assets/pages/<slug>.json بنفس مسار «نشر» المطوّر (PB.fullHtml + PBBind.bakePage) دون لوحة تحكم.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/publish-lp.js <slug> */
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), slug = process.argv[2]; if (!slug) { console.error("slug مطلوب"); process.exit(1); }
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const page = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/pages/" + slug + ".json"), "utf8"));
  const html = await p.evaluate(pg => {
    if (typeof Admin !== "undefined" && (!Admin.products || !Admin.products.length) && typeof PRODUCTS !== "undefined") Admin.products = PRODUCTS;
    pg = PB.migrate(pg); pg.demo = false;
    return PB.fullHtml(typeof PBBind !== "undefined" && PBBind.bakePage ? PBBind.bakePage(pg) : pg, Object.assign({ base: "../../" }, PBApp.siteCtx()));
  }, page);
  fs.mkdirSync(path.join(ROOT, "lp", slug), { recursive: true }); fs.writeFileSync(path.join(ROOT, "lp", slug, "index.html"), html);
  console.log("lp/" + slug + "/index.html", html.length, errs.length ? errs : "");
  await b.close();
})();
