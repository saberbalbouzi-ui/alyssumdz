/* استئصال تجريبي لتحديد الاختناق: يقيس متوسط الإطارات للمشهد الكامل (وضع العرض بلا خادم) مع تعطيل عنصر/ميزة كل مرة */
const { launch, newPage, measure, gpuInfo } = require("./lib"); const fs = require("fs");
const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html";
const CASES = [
  ["baseline", ""], ["no-fx-canvas", "#fx{display:none!important}"], ["no-core3d", ".core3d{display:none!important}"],
  ["no-backdrop-filter", "*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}"], ["no-filters", "*{filter:none!important}"], ["no-box-shadow", "*{box-shadow:none!important;text-shadow:none!important}"],
  ["no-slat-anim", ".slat i,.disc,.core i{animation:none!important}"], ["no-inner-cyl", "#cyl-in{display:none!important}"], ["no-outer-cyl", "#cyl{display:none!important}"], ["no-beams", ".beam{display:none!important}"], ["no-orbit-nodes", ".node,#orbit{display:none!important}"],
  ["no-room", ".room{display:none!important}"], ["no-floor-canvas", "#floorcv{display:none!important}"], ["no-hud", ".hud,.modebar,.dock,.note{display:none!important}"], ["no-3d-cam", ".cam,.cyl-wrap{display:none!important}"],
  ["all-off(bg only)", ".cam,.room,.core3d,#fx,.hud,.modebar{display:none!important}"],
];
(async () => {
  const b = await launch(); const out = []; const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  for (const [name, css] of CASES) { if (only && !only.includes(name)) continue; const h = await newPage(b, URL + "?tier=high"); await h.p.waitForTimeout(1500); if (css) await h.p.addStyleTag({ content: css }); const m = await measure(h, 5000, 1200); out.push({ name, ...m }); console.log(name.padEnd(22), JSON.stringify(m)); await h.ctx.close(); }
  console.log("GPU:", await (async () => { const h = await newPage(b, URL); const g = await gpuInfo(h.p); await h.ctx.close(); return g; })());
  fs.writeFileSync(__dirname + "/ablate-result.json", JSON.stringify(out, null, 1)); await b.close();
})();
