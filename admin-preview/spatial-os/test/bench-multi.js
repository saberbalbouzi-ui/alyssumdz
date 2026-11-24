/* قياس تعدد النوافذ (Spatial Core V3): حالات 1 و3 و6 نوافذ تُفتح دفعة واحدة (الأسوأ: استعادة ترتيب/فتح سريع) تحت تخنيق 1× و4× (Chromium بلا GPU؛ ليس جهازاً حقيقياً).
   يقيس لكل حالة: زمن ظهور كل نافذة (حتى تهيئة إطارها)، زمن التبديل داخل النافذة النشطة **أثناء** تحميل الباقي (وسيط/أقصى)، أطول مهمة رئيسية، مدة استقرار الإطار، ذاكرة JS/عقد DOM بعد GC، وعدد طلبات الشبكة (admin.html وAPI) لكشف التكرار.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules BENCH_OUT=out.json node admin-preview/spatial-os/test/bench-multi.js [rates=1,4] [counts=1,3,6] */
const fs = require("fs"), PW = require("playwright"), { startStore } = require("./harness"); const wait = ms => new Promise(r => setTimeout(r, ms));
const RATES = (process.argv[2] || "1,4").split(",").map(Number), COUNTS = (process.argv[3] || "1,3,6").split(",").map(Number), IDS = ["ord", "prod", "inv", "ana", "returns", "delivery", "finance", "cus"];
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true }), out = { when: new Date().toISOString(), rates: {} };
  try {
    for (const rate of RATES) for (const N of COUNTS) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), reqs = { html: 0, api: 0, all: 0 };
      await p.goto(store.base + "/admin.html"); await wait(400); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
      await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&nospare=1&noextra=1&norestore=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 120000 }); await wait(1500);
      await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(600);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate }); await cdp.send("Performance.enable");
      p.on("request", r => { const u = r.url(); reqs.all++; if (/admin\.html/.test(u)) reqs.html++; else if (/api\/index\.php/.test(u)) reqs.api++; });
      const ids = IDS.slice(0, N), R = await p.evaluate(async (ids) => {
        window.__lt = []; window.__gaps = []; window.__stop = false; { let last = 0; const f = t => { if (last) window.__gaps.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); } try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch (_) { }
        const t0 = performance.now(), appear = {}, sw = [], paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now()))));
        ids.forEach(id => SpatialOS.open(id)); const active = ids[ids.length - 1];
        const track = setInterval(() => { ids.forEach(id => { const q = SpatialOS.panels.get(id); if (q && q.frDone && appear[id] == null) appear[id] = Math.round(performance.now() - t0); }); }, 50);
        /* التبديل داخل النافذة النشطة: 6 تبديلات بعد جاهزيتها (بعضها أثناء تحميل الباقي busy)، ثم ننتظر اكتمال الباقي */
        const alt = ["finance", "cus", "fees", "coupons", "shipped", "pack"], T0 = performance.now(), allDone = () => ids.every(id => appear[id] != null);
        for (let i = 0; i < alt.length && performance.now() - T0 < 70000;) { await new Promise(r => setTimeout(r, 900)); const q = SpatialOS.panels.get(active) || SpatialOS.panels.get(SpatialOS.activeId()); if (!q || !q.frDone) continue; const busy = !allDone(), a0 = performance.now(); const ok = SpatialOS.navTo(alt[i]); i++; if (!ok) { sw.push(null); continue; } sw.push({ ms: (await paint()) - a0, busy }); }
        while (!allDone() && performance.now() - T0 < 90000) await new Promise(r => setTimeout(r, 200));
        await new Promise(r => setTimeout(r, 300)); clearInterval(track); window.__stop = true; return { appear, sw, lt: Math.max(0, ...window.__lt), ltN: window.__lt.filter(x => x > 100).length, gaps: window.__gaps };
      }, ids);
      /* استقرار الإطار */
      let settle = null, series = []; for (let i = 0; i < 15; i++) { const m = await p.evaluate(() => new Promise(res => { const d = []; let last = 0, id; const f = t => { if (last) d.push(t - last); last = t; id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); setTimeout(() => { cancelAnimationFrame(id); res(d.reduce((a, c) => a + c, 0) / Math.max(1, d.length)); }, 2000); })); series.push(Math.round(m)); if (m < 45 && settle == null) settle = (i + 1) * 2; }
      await cdp.send("HeapProfiler.collectGarbage"); const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value])); const frames = await p.evaluate(() => document.querySelectorAll(".panel iframe").length);
      const row = { appear_ms: R.appear, appear_active_ms: R.appear[ids[ids.length - 1]] == null ? null : R.appear[ids[ids.length - 1]], appear_max_ms: Math.max(0, ...Object.values(R.appear)), appear_missing: ids.filter(id => R.appear[id] == null).length, sw_busy_med: Math.round(med(R.sw.filter(x => x && x.busy).map(x => x.ms)) || 0), sw_busy_max: Math.round(Math.max(0, ...R.sw.filter(x => x && x.busy).map(x => x.ms))), sw_busy_n: R.sw.filter(x => x && x.busy).length, sw_idle_med: Math.round(med(R.sw.filter(x => x && !x.busy).map(x => x.ms)) || 0), sw_idle_max: Math.round(Math.max(0, ...R.sw.filter(x => x && !x.busy).map(x => x.ms))), sw_fail: R.sw.filter(x => x == null).length, frame_gap_max_ms: Math.round(Math.max(0, ...R.gaps)), gaps_over100: R.gaps.filter(x => x > 100).length, gaps_over200: R.gaps.filter(x => x > 200).length, longtask_max_ms: Math.round(R.lt), longtasks_over100: R.ltN, settle_s: settle, frame_series: series.slice(0, 10), heap_mb: +(m.JSHeapUsedSize / 1048576).toFixed(1), dom_nodes: m.Nodes, frames, req_html: reqs.html, req_api: reqs.api, req_all: reqs.all };
      (out.rates[rate] = out.rates[rate] || {})[N] = row; console.log("rate", rate, "N", N, JSON.stringify(row)); await ctx.close();
    }
  } catch (e) { console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  if (process.env.BENCH_OUT) fs.writeFileSync(process.env.BENCH_OUT, JSON.stringify(out, null, 1));
})();
