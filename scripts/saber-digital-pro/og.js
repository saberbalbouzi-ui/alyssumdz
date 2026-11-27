// Generates the 1200x630 Open Graph images (one per language) with the same fonts as the page.
// Run: NODE_PATH=/opt/node-tools/node_modules node scripts/saber-digital-pro/og.js   (writes lp/saber-digital-pro/assets/og-{en,fr,ar}.jpg)
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const OUT = path.resolve(__dirname, "../../lp/saber-digital-pro/assets"); const b64 = f => "data:font/woff2;base64," + fs.readFileSync(path.join(OUT, "fonts", f)).toString("base64"); // data: URLs (setContent runs on about:blank, which may not read file://)
const FONT_LATIN = b64("cairo-latin-wght-normal.woff2"), FONT_AR = b64("cairo-arabic-wght-normal.woff2");
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const lang of ["en", "fr", "ar"]) {
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, "content", lang + ".json"), "utf8")); const rtl = c.dir === "rtl";
    const title = c.hero.title.replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/&/g, "&amp;");
    const html = `<!doctype html><html lang="${lang}" dir="${c.dir}"><meta charset="utf-8"><style>
@font-face{font-family:Cairo;font-weight:200 1000;src:url(${FONT_LATIN})}
@font-face{font-family:Cairo;font-weight:200 1000;src:url(${FONT_AR});unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC}
*{box-sizing:border-box;margin:0}html{overflow:hidden}body{width:1200px;height:630px;background:#090b0a;color:#f2f5ef;font-family:Cairo,sans-serif;position:relative;overflow:hidden}
.glow{position:absolute;inset-inline-end:-120px;top:-160px;width:760px;height:760px;border-radius:50%;background:radial-gradient(closest-side,rgba(201,255,47,.28),transparent 70%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse at 70% 20%,#000,transparent 70%)}
.in{position:absolute;inset:0;padding:64px 76px;display:flex;flex-direction:column;justify-content:space-between}
.logo{display:flex;align-items:center;gap:16px;font-weight:700;letter-spacing:.16em;font-size:26px;text-transform:uppercase}.logo i{font-style:normal;color:#c9ff2f;letter-spacing:.3em;font-size:15px;display:block;margin-top:6px}
h1{font-family:Cairo,sans-serif;font-weight:800;font-size:${rtl ? 76 : lang === "fr" ? 70 : 84}px;line-height:${rtl ? 1.3 : 1.12};letter-spacing:${rtl ? 0 : "-.025em"};max-width:980px}
h1 em{color:#c9ff2f;font-style:normal}
.tags{display:flex;gap:12px;flex-wrap:wrap}.tags span{padding:8px 16px;border:1px solid rgba(255,255,255,.2);border-radius:999px;font-size:20px;color:#a7aea5}
</style><div class="glow"></div><div class="grid"></div><div class="in">
<div class="logo"><svg width="46" height="46" viewBox="0 0 34 34"><rect x="1" y="1" width="32" height="32" rx="10" fill="none" stroke="rgba(255,255,255,.25)"/><path d="M23.2 11.2c-1.9-2.1-7.7-2.2-9.4.9-1.5 2.8 1 4.3 4 5 3.2.8 5.8 2.2 4.4 5.2-1.8 3.3-7.8 3-10 .6" fill="none" stroke="#c9ff2f" stroke-width="2.6" stroke-linecap="round"/><circle cx="26" cy="8" r="2" fill="#c9ff2f"/></svg><span>SABER <i>DIGITAL PRO</i></span></div>
<h1>${title}</h1><div class="tags">${[...c.hero.journey.items.map(x => x.k), "EN · FR · AR"].map(t => "<span>" + t + "</span>").join("")}</div></div></html>`;
    const p = await ctx.newPage(); await p.setContent(html, { waitUntil: "load" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
    if (process.env.OGDBG) console.log(lang, JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, in: document.querySelector('.in').getBoundingClientRect().toJSON(), h1: document.querySelector('h1').getBoundingClientRect().toJSON(), logo: document.querySelector('.logo').getBoundingClientRect().toJSON() }))));
    await p.screenshot({ path: path.join(OUT, `og-${lang}.jpg`), type: "jpeg", quality: 84 }); await p.close();
  }
  await br.close(); console.log("og images written");
})();
