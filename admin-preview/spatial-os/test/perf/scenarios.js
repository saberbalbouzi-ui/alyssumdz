/* مرحلة 12 — سيناريوهات الأداء (وضع العرض بلا خادم أعمال). كل سيناريو يُقاس بمستوى ثابت q=3 (= سلوك المرحلة 11) ثم بالمتحكم التكيّفي بعد الاستقرار.
   تنبيه: كل الأرقام في Chromium برمجي (SwiftShader) = تشخيصية فقط؛ لا تُقارن بأهداف الأجهزة الحقيقية. */
const { launch, newPage, measure, gpuInfo } = require("./lib"); const fs = require("fs");
const URL = process.env.URL || "http://localhost:8765/admin-preview/spatial-os/index.html", REP = +process.env.REP || 2, DUR = +process.env.DUR || 5000;
const HIDE = s => `${s}{display:none!important}`;
const SC = [
  { n: "01-empty-env", css: HIDE("#stage,#fx,#dock,#hud,#yawchip"), desc: "بلا مشهد" },
  { n: "02-cylinder-only", css: HIDE(".room,#orbit,#fx"), desc: "الاسطوانة فقط" },
  { n: "03-full-idle", desc: "اسطوانة+قاعة+بطاقات مدارية" },
  { n: "04-1-panel", run: p => p.evaluate(() => { SpatialOS.open("ord"); }), desc: "لوح واحد" },
  { n: "05-2-panels", run: p => p.evaluate(() => { SpatialOS.open("ord"); SpatialOS.open("prod"); }), desc: "لوحان" },
  { n: "06-4-panels", run: p => p.evaluate(() => { ["ord", "prod", "ana", "inv"].forEach(i => SpatialOS.open(i)); SpatialOS.tileAll(); }), desc: "4 ألواح مُرتَّبة" },
  { n: "07-ai-core-active", q: "&core3d_dev=1", run: p => p.evaluate(() => { SpatialOS.open("ai"); Core3D_dev.set("thinking"); }), desc: "نواة الذكاء نشطة (تفكير)" },
  { n: "08-voice-listening", q: "&core3d_dev=1", run: p => p.evaluate(() => { SpatialOS.open("ai"); Core3D_dev.set("listening"); }), desc: "استماع صوتي" },
  { n: "09-expanded-conv", q: "&core3d_dev=1", run: p => p.evaluate(() => { SpatialOS.open("ai"); Core3D_dev.expand(true); Core3D_dev.set("speaking"); }), desc: "محادثة موسّعة+كلام" },
  { n: "10-mobile-390", vp: { width: 390, height: 844 }, ctx: { deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desc: "جوّال 390×844" },
  { n: "11-reduced-motion", ctx: { reducedMotion: "reduce" }, desc: "تقليل الحركة" },
];
(async () => {
  const b = await launch(), out = []; const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const gpu = await (async () => { const h = await newPage(b, URL); const g = await gpuInfo(h.p); await h.ctx.close(); return g; })();
  for (const sc of SC) { if (only && !only.some(o => sc.n.includes(o))) continue;
    for (const mode of ["q3", "auto"]) { const runs = [];
      for (let i = 0; i < REP; i++) {
        const h = await newPage(b, URL + "?tier=high&q=" + (mode === "q3" ? "3" : "auto") + (sc.q || ""), { vp: sc.vp, ctx: sc.ctx });
        await h.p.waitForTimeout(1200); if (sc.css) await h.p.addStyleTag({ content: sc.css }); if (sc.run) { await sc.run(h.p).catch(e => console.log("run err", sc.n, String(e).slice(0, 80))); }
        await h.p.waitForTimeout(mode === "auto" ? 14000 : 2500); /* اتاحة وقت للمتحكم كي يستقر */
        const m = await measure(h, DUR, 800); m.q = await h.p.evaluate(() => SceneQuality.level); m.panels = await h.p.evaluate(() => SpatialOS.panels.size).catch(() => null); runs.push(m); await h.ctx.close();
      }
      const avg = k => +(runs.reduce((s, r) => s + (r[k] || 0), 0) / runs.length).toFixed(1);
      const o = { scenario: sc.n, desc: sc.desc, mode, reps: REP, fps_runs: runs.map(r => r.avg_fps), avg_fps: avg("avg_fps"), low1_fps: avg("low1_fps"), p50_ms: avg("p50_ms"), p95_ms: avg("p95_ms"), cpu_pct: avg("cpu_pct"), heap_mb: avg("heap_mb"), nodes: avg("nodes"), panels: runs[0].panels, quality_tier: runs.map(r => r.q).join("/") };
      out.push(o); console.log(JSON.stringify(o)); }
  }
  fs.writeFileSync(__dirname + "/scenarios-result.json", JSON.stringify({ date: new Date().toISOString().slice(0, 10), gpu, renderer: "SwiftShader (software) — diagnostic only", duration_ms: DUR, results: out }, null, 1)); await b.close();
})();
