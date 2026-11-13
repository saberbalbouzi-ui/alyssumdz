/* استئصال تجريبي لتحديد الاختناق: يقيس متوسط الإطارات للمشهد الكامل (وضع العرض بلا خادم) مع تعطيل عنصر/ميزة كل مرة */
const { launch, newPage, measure, gpuInfo } = require("./lib"); const fs = require("fs");
const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html";
const Q2 = ".wcard{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.scr::after,.wcard::after{animation:none!important}.hall,.pillar,.strip,.beam{display:none!important}";
const Q1 = Q2 + ".wall,.glyphs,.tab,#floorcv,#fx{display:none!important}";
const Q0 = Q1 + ".tiles,.plat,.pd,.baseglow,.disc{display:none!important}";
const CASES = [["baseline", ""], ["Q2", Q2], ["Q1", Q1], ["Q0", Q0]];
(async () => {
  const b = await launch(); const out = []; const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  for (const [name, css] of CASES) { if (only && !only.includes(name)) continue; const h = await newPage(b, URL + "?tier=high"); await h.p.waitForTimeout(1500); if (css) await h.p.addStyleTag({ content: css }); const m = await measure(h, 5000, 1200); out.push({ name, ...m }); console.log(name.padEnd(22), JSON.stringify(m)); await h.ctx.close(); }
  console.log("GPU:", await (async () => { const h = await newPage(b, URL); const g = await gpuInfo(h.p); await h.ctx.close(); return g; })());
  fs.writeFileSync(__dirname + "/ablate3-result.json", JSON.stringify(out, null, 1)); await b.close();
})();
