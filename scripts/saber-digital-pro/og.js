// Generates the 1200x630 Open Graph images (one per language) with the same fonts as the page.
// Run: NODE_PATH=/opt/node-tools/node_modules node scripts/saber-digital-pro/og.js   (writes lp/saber-digital-pro/assets/og-{en,fr,ar}.jpg)
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const OUT = path.resolve(__dirname, "../../lp/saber-digital-pro/assets"); const FONTS = "file://" + OUT + "/fonts/";
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const lang of ["en", "fr", "ar"]) {
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, "content", lang + ".json"), "utf8")); const rtl = c.dir === "rtl";
    const title = c.hero.title.replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/&/g, "&amp;");
    const html = `<!doctype html><html lang="${lang}" dir="${c.dir}"><meta charset="utf-8"><style>
@font-face{font-family:"Instrument Serif";src:url(${FONTS}instrument-serif-latin-400-normal.woff2)}
@font-face{font-family:"Instrument Serif";font-style:italic;src:url(${FONTS}instrument-serif-latin-400-italic.woff2)}
@font-face{font-family:Geist;font-weight:100 900;src:url(${FONTS}geist-latin-wght-normal.woff2)}
@font-face{font-family:"Plex Arabic";font-weight:400;src:url(${FONTS}ibm-plex-sans-arabic-arabic-400-normal.woff2)}
@font-face{font-family:"Plex Arabic";font-weight:700;src:url(${FONTS}ibm-plex-sans-arabic-arabic-700-normal.woff2)}
*{box-sizing:border-box;margin:0}html{overflow:hidden}body{width:1200px;height:630px;background:#090b0a;color:#f2f5ef;font-family:${rtl ? '"Plex Arabic",Geist' : "Geist"},sans-serif;position:relative;overflow:hidden}
.glow{position:absolute;inset-inline-end:-120px;top:-160px;width:760px;height:760px;border-radius:50%;background:radial-gradient(closest-side,rgba(201,255,47,.28),transparent 70%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse at 70% 20%,#000,transparent 70%)}
.in{position:absolute;inset:0;padding:64px 76px;display:flex;flex-direction:column;justify-content:space-between}
.logo{display:flex;align-items:center;gap:16px;font-weight:700;letter-spacing:.16em;font-size:26px;text-transform:uppercase}.logo i{font-style:normal;color:#c9ff2f;letter-spacing:.3em;font-size:15px;display:block;margin-top:6px}
h1{font-family:${rtl ? '"Plex Arabic"' : '"Instrument Serif",serif'};font-weight:${rtl ? 700 : 400};font-size:${rtl ? 80 : 96}px;line-height:${rtl ? 1.28 : 1};letter-spacing:${rtl ? 0 : "-.02em"};max-width:960px}
h1 em{color:#c9ff2f;font-style:${rtl ? "normal" : "italic"}}
.tags{display:flex;gap:12px;flex-wrap:wrap}.tags span{padding:8px 16px;border:1px solid rgba(255,255,255,.2);border-radius:999px;font-size:20px;color:#a7aea5}
</style><div class="glow"></div><div class="grid"></div><div class="in">
<div class="logo"><svg width="46" height="46" viewBox="0 0 34 34"><rect x="1" y="1" width="32" height="32" rx="10" fill="none" stroke="rgba(255,255,255,.25)"/><path d="M23.2 11.2c-1.9-2.1-7.7-2.2-9.4.9-1.5 2.8 1 4.3 4 5 3.2.8 5.8 2.2 4.4 5.2-1.8 3.3-7.8 3-10 .6" fill="none" stroke="#c9ff2f" stroke-width="2.6" stroke-linecap="round"/><circle cx="26" cy="8" r="2" fill="#c9ff2f"/></svg><span>SABER <i>DIGITAL PRO</i></span></div>
<h1>${title}</h1><div class="tags">${c.hero.tags.slice(0, 5).map(t => "<span>" + t + "</span>").join("")}</div></div></html>`;
    const p = await ctx.newPage(); await p.setContent(html, { waitUntil: "load" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
    if (process.env.OGDBG) console.log(lang, JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, in: document.querySelector('.in').getBoundingClientRect().toJSON(), h1: document.querySelector('h1').getBoundingClientRect().toJSON(), logo: document.querySelector('.logo').getBoundingClientRect().toJSON() }))));
    await p.screenshot({ path: path.join(OUT, `og-${lang}.jpg`), type: "jpeg", quality: 84 }); await p.close();
  }
  await br.close(); console.log("og images written");
})();
