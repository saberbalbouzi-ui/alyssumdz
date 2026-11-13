/* المرحلة 12B / WS4 — كلفة الألواح المخفية/المصغّرة (متجر PHP محلي، ألواح iframe حقيقية من admin.html). يقيس 8ث خمولاً لكل سيناريو:
   S0 بلا ألواح، S2 لوحان ظاهران، S4 أربعة ظاهرة، S4m أربعة منها اثنان مصغّران، S4m+long نفس الحالة بعد 40ث (ليظهر أثر التجميد/المؤقتات).
   تصيير برمجي (SwiftShader): لا FPS هنا؛ نقيس CPU/Script/Style/Layout وheap وDOM والمهام الطويلة. LABEL=before|after لاسم ملف النتيجة. */
const fs = require("fs"), path = require("path"); const { startStore } = require("../harness"); const { boot, launch } = require("../lib-boot"); const { measure } = require("./lib");
const LABEL = process.env.LABEL || "before", REP = +process.env.REP || 2;
const SC = [{ n: "S0-no-panels", open: [] }, { n: "S2-two-visible", open: ["ord", "prod"] }, { n: "S4-four-visible", open: ["ord", "prod", "ana", "inv"], tile: 1 }, { n: "S4m-four-two-minimized", open: ["ord", "prod", "ana", "inv"], tile: 1, min: ["ana", "inv"] }, { n: "S4m-after-40s", open: ["ord", "prod", "ana", "inv"], tile: 1, min: ["ana", "inv"], wait: 40000 }];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const store = await startStore({ stock: true }), b = await launch(), out = [];
  try { for (const sc of SC) { if (ONLY && !ONLY.includes(sc.n)) continue; const runs = [];
    for (let i = 0; i < REP; i++) { const X = await boot(b, store, { tier: "high", noOrd: true, query: "q=3" + (process.env.DISCARD ? "&discard=" + process.env.DISCARD : "") }), p = X.p;
      if (sc.open.length) { await p.evaluate(ids => ids.forEach(i => SpatialOS.open(i)), sc.open); await p.waitForFunction(ids => ids.every(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }), sc.open, { timeout: 120000 }).catch(() => { }); }
      if (sc.tile) await p.evaluate(() => { SpatialOS.panels.forEach(q => { if (q.frame) { q.st.w = 520; q.st.h = 420; } }); SpatialOS.tileAll(); });
      if (sc.min) { for (const id of sc.min) await p.evaluate(i => { const q = SpatialOS.panels.get(i); q.el.querySelector(".pn-min").click(); }, id); }
      await X.quiet(1500, 40000); await p.waitForTimeout(sc.wait || 3000);
      const cdp = await X.c.newCDPSession(p); await cdp.send("Performance.enable"); const m = await measure({ p, cdp }, 8000, 500);
      m.minimized = await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => q.min).length); m.panels = await p.evaluate(() => SpatialOS.panels.size);
      m.susp = await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => q.frame && q.suspended).length).catch(() => null);
      m.discarded = await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => q.discarded).length).catch(() => 0); m.frame_nodes = await p.evaluate(() => { let n = 0; SpatialOS.panels.forEach(q => { try { if (q.fr) n += q.fr.contentWindow.document.getElementsByTagName('*').length; } catch (_) { } }); return n; }); runs.push(m); await X.c.close(); }
    const ok = runs, avg = k => +(ok.reduce((s, r) => s + (r[k] || 0), 0) / ok.length).toFixed(2);
    const o = { scenario: sc.n, label: LABEL, reps: REP, cpu_pct: avg("cpu_pct"), script_pct: avg("script_pct"), layout_pct: avg("layout_pct"), style_pct: avg("style_pct"), heap_mb: avg("heap_mb"), nodes: avg("nodes"), layouts_per_s: avg("layouts_per_s"), restyle_per_s: avg("restyle_per_s"), panels: runs[0].panels, minimized: runs[0].minimized, suspended: runs[0].susp, discarded: runs[0].discarded, frame_nodes: avg('frame_nodes') };
    out.push(o); console.log(JSON.stringify(o)); } } finally { store.stop(); }
  fs.writeFileSync(path.join(__dirname, "panels-suspend-" + LABEL + ".json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), renderer: "SwiftShader (software)", results: out }, null, 1)); await b.close();
})();
