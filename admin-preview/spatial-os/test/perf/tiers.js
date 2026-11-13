/* مقارنة مستويات الجودة (برمجي، SwiftShader): كل مستوى 3 تكرارات × 6s */
const { launch, newPage, measure } = require("./lib"); const fs = require("fs");
const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html", REP = +process.env.REP || 3;
(async () => {
  const b = await launch(), out = [];
  for (const q of ["3", "2", "1", "0"]) { const runs = []; for (let i = 0; i < REP; i++) { const h = await newPage(b, URL + "?tier=high&q=" + q); await h.p.waitForTimeout(1200); runs.push(await measure(h, 6000, 1200)); await h.ctx.close(); }
    const avg = k => +(runs.reduce((s, r) => s + r[k], 0) / runs.length).toFixed(1); const o = { q, reps: REP, fps: runs.map(r => r.avg_fps), avg_fps: avg("avg_fps"), low1: avg("low1_fps"), p50: avg("p50_ms"), p95: avg("p95_ms"), cpu: avg("cpu_pct"), heap: avg("heap_mb") }; out.push(o); console.log(JSON.stringify(o)); }
  fs.writeFileSync(__dirname + "/tiers-result.json", JSON.stringify(out, null, 1)); await b.close();
})();
