/* استئصال تجريبي لتحديد الاختناق: يقيس متوسط الإطارات للمشهد الكامل (وضع العرض بلا خادم) مع تعطيل عنصر/ميزة كل مرة */
const { launch, newPage, measure, gpuInfo } = require("./lib"); const fs = require("fs");
const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html";
const CASES = [
  ["baseline", ""], ["no-tiles", ".tiles{display:none!important}"], ["no-hall", ".hall{display:none!important}"], ["no-walls", ".wall{display:none!important}"], ["no-wcard-backdrop", ".wcard{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}"],
  ["no-plat+pd+glow", ".plat,.pd,.baseglow{display:none!important}"], ["no-pillar+strip", ".pillar,.strip{display:none!important}"], ["no-glyphs+tabs", ".glyphs,.tab{display:none!important}"], ["no-floorcv", "#floorcv{display:none!important}"],
  ["no-animations", "*,*::before,*::after{animation:none!important}"], ["no-orbit-nodes-and-room", ".room,.node,#orbit{display:none!important}"], ["only-cylinder", ".room,.node,#orbit,#fx,.core3d{display:none!important}"],
];
(async () => {
  const b = await launch(); const out = []; const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  for (const [name, css] of CASES) { if (only && !only.includes(name)) continue; const h = await newPage(b, URL + "?tier=high"); await h.p.waitForTimeout(1500); if (css) await h.p.addStyleTag({ content: css }); const m = await measure(h, 5000, 1200); out.push({ name, ...m }); console.log(name.padEnd(22), JSON.stringify(m)); await h.ctx.close(); }
  console.log("GPU:", await (async () => { const h = await newPage(b, URL); const g = await gpuInfo(h.p); await h.ctx.close(); return g; })());
  fs.writeFileSync(__dirname + "/ablate2-result.json", JSON.stringify(out, null, 1)); await b.close();
})();
