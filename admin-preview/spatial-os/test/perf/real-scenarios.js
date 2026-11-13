/* مرحلة 12 / WS3 — سيناريوهات الألواح الحقيقية (iframes من admin.html) على متجر PHP محلي: 1/2/4 ألواح، 4 ألواح + تحديثات Hub متزامنة، ومحادثة موسّعة مع الوكيل.
   كل سيناريو: q=3 ثابت (= سلوك المرحلة 11) ثم المتحكم التكيّفي بعد الاستقرار. SwiftShader برمجي = تشخيصي فقط. */
const fs = require("fs"), path = require("path"); const { startStore } = require("../harness"); const { boot, launch } = require("../lib-boot"); const { measure, gpuInfo } = require("./lib");
const REP = +process.env.REP || 1, DUR = +process.env.DUR || 5000;
const SC = [
  { n: "R1-one-real-panel", open: ["ord"] }, { n: "R2-two-real-panels", open: ["ord", "prod"] }, { n: "R4-four-real-panels", open: ["ord", "prod", "ana", "inv"], tile: true },
  { n: "R5-four-panels+hub-updates", open: ["ord", "prod", "ana", "inv"], tile: true, hub: true },
  { n: "R6-agent-expanded-conversation", open: ["ord"], agent: true },
];
(async () => {
  const store = await startStore({ stock: true }), b = await launch(), out = [];
  try {
    for (const sc of SC) for (const mode of ["q3", "auto"]) { const runs = [];
      for (let i = 0; i < REP; i++) {
        const X = await boot(b, store, { tier: "high", noOrd: true, query: "q=" + (mode === "q3" ? "3" : "auto") }); const p = X.p;
        await p.evaluate(ids => { ids.forEach(i => SpatialOS.open(i)); }, sc.open); await p.waitForFunction(ids => ids.every(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }), sc.open, { timeout: 120000 }).catch(() => { });
        if (sc.tile) await p.evaluate(() => { SpatialOS.panels.forEach(q => { if (q.frame) { q.st.w = 520; q.st.h = 420; } }); SpatialOS.tileAll(); });
        if (sc.agent) { await X.openAgent(); await p.evaluate(() => { window.__ex = 1; try { Core3D.state(); } catch (_) { } }); await X.say("شحال خدمنا اليوم؟").catch(() => { }); }
        let timer = null; if (sc.hub) { timer = setInterval(() => { p.evaluate(() => { try { ["ord", "ana", "inv", "prod"].forEach(i => SpatialHub.refreshNow(i)); } catch (_) { } }).catch(() => { }); }, 1500); }
        await p.waitForTimeout(mode === "auto" ? 14000 : 3000); const cdp = await X.c.newCDPSession(p); await cdp.send("Performance.enable"); const m = await measure({ p, cdp }, DUR, 800).catch(e => ({ err: String(e).slice(0, 80) }));
        if (timer) clearInterval(timer); m.q = await p.evaluate(() => SceneQuality.level); m.panels = await p.evaluate(() => SpatialOS.panels.size); runs.push(m); await X.c.close();
      }
      const ok = runs.filter(r => !r.err), avg = k => ok.length ? +(ok.reduce((s, r) => s + (r[k] || 0), 0) / ok.length).toFixed(1) : null;
      const o = { scenario: sc.n, mode, reps: REP, fps_runs: runs.map(r => r.avg_fps), avg_fps: avg("avg_fps"), low1_fps: avg("low1_fps"), p50_ms: avg("p50_ms"), p95_ms: avg("p95_ms"), cpu_pct: avg("cpu_pct"), script_pct: avg("script_pct"), heap_mb: avg("heap_mb"), nodes: avg("nodes"), panels: runs[0].panels, quality_tier: runs.map(r => r.q).join("/") };
      out.push(o); console.log(JSON.stringify(o)); }
  } finally { store.stop(); }
  fs.writeFileSync(path.join(__dirname, "real-scenarios-result.json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), renderer: "SwiftShader (software) — diagnostic only", results: out }, null, 1)); await b.close();
})();
