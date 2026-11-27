/* قياس أداء Spatial Core مقابل اللوحة التقليدية (Chromium مع تخنيق معالج 1×/4×/6× لمحاكاة جهاز متوسط/ضعيف؛ ليس جهازاً حقيقياً).
   يقيس: (أ) الزمن حتى ظهور بيانات الطلبات: اللوحة التقليدية (تحميل بارد) مقابل Spatial (فتح لوح بارد/دافئ/بنقل لوح مفتوح)؛ (ب) زمن التنقل بين تبويبين في كل منهما؛
   (ج) كلفة الإطار وهي ساكنة ومع 3 ألواح (متوسط/p95 لفاصل rAF + المهام الطويلة)؛ (د) ثبات الذاكرة بعد 20 فتحاً/إغلاقاً.
   يطبع JSON ويكتبه إلى BENCH_OUT إن حُدد. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/bench-spatial.js [rates=1,4] */
const fs = require("fs"), PW = require("playwright"), { startStore } = require("./harness"); const wait = ms => new Promise(r => setTimeout(r, ms));
const RATES = (process.argv[2] || "1,4,6").split(",").map(Number), MOB = (process.argv[3] || "") === "phone";
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; }, p95 = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * .95))] : null; };
async function login(p, base) { await p.goto(base + "/admin.html"); await wait(400); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json()); }
/* فاصل الإطارات والمهام الطويلة خلال مدة */
async function frames(p, ms) { return p.evaluate((ms) => new Promise(res => { const d = [], lt = []; let last = 0, id; try { new PerformanceObserver(l => l.getEntries().forEach(e => lt.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch (_) { } const f = t => { if (last) d.push(t - last); last = t; id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); setTimeout(() => { cancelAnimationFrame(id); res({ d, lt }); }, ms); }), ms); }
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true }), out = { when: new Date().toISOString(), phone: MOB, rates: {} };
  try {
    for (const rate of RATES) {
      const R = out.rates[rate] = {}, mk = async () => { const ctx = await b.newContext(MOB ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p); await login(p, store.base); await cdp.send("Emulation.setCPUThrottlingRate", { rate }); return { ctx, p, cdp }; };
      /* اللوحة التقليدية */
      { const { ctx, p } = await mk(); const t0 = Date.now(); await p.goto(store.base + "/admin.html"); await p.evaluate(() => Admin.tab("orders")).catch(() => { });
        await p.waitForFunction(() => typeof Admin !== "undefined" && Admin.tab && document.querySelectorAll("#orders-table tr").length > 2, null, { timeout: 120000 }); R.trad_cold_orders_ms = Date.now() - t0;
        const sw = await p.evaluate(async () => { const o = [], paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))); for (const t of ["products", "orders", "inventory", "orders", "products", "orders"]) { const t0 = performance.now(); Admin.tab(t); o.push((await paint()) - t0); await new Promise(r => setTimeout(r, 300)); } return o; }); R.trad_switch_ms = Math.round(med(sw));
        const f = await frames(p, 3000); R.trad_idle_frame_ms = { mean: +(f.d.reduce((a, c) => a + c, 0) / Math.max(1, f.d.length)).toFixed(1), p95: +p95(f.d).toFixed(1), longtasks: f.lt.length }; await ctx.close(); }
      /* Spatial */
      for (const mode of [{ n: "cold", q: "nospare=1&noextra=1" }, { n: "warm", q: "" }]) {
        const { ctx, p } = await mk(); const t0 = Date.now(); await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&" + mode.q);
        await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 120000 }); R["sp_" + mode.n + "_world_ms"] = Date.now() - t0;
        await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(600);
        if (mode.n === "warm") { await p.waitForFunction(() => SpatialOS.spare.ready, null, { timeout: 120000 }).catch(() => { }); await wait(2500); }
        const s0 = Date.now(); await p.evaluate(() => SpatialOS.open("ord"));
        await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); if (!q || !q.fr) return false; try { return q.fr.contentDocument.querySelectorAll("#orders-table tr").length > 2; } catch (_) { return false; } }, null, { timeout: 120000 }); R["sp_" + mode.n + "_open_orders_ms"] = Date.now() - s0;
        if (mode.n === "cold") {
          const spSw = () => p.evaluate(async () => { const o = [], paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))); for (const id of ["prod", "ord", "inv", "ord", "prod", "ord"]) { const t0 = performance.now(); if (!SpatialOS.navTo(id)) { o.push(9999); continue; } o.push((await paint()) - t0); await new Promise(r => setTimeout(r, 400)); }  /* نفس تبويبات المقارنة التقليدية: المنتجات/الطلبات/المخزون */ return o; }); R.sp_switch_ms = Math.round(med(await spSw()));
          const series = async (n) => { const o = []; for (let i = 0; i < n; i++) { const q = await frames(p, 2000); o.push(+(q.d.reduce((a, c) => a + c, 0) / Math.max(1, q.d.length)).toFixed(0)); } return o; }, summ = (o) => ({ series: o, settle_s: (() => { const i = o.findIndex(x => x < 45); return i < 0 ? null : (i + 1) * 2; })(), steady_ms: +(o.slice(-3).reduce((a, c) => a + c, 0) / 3).toFixed(1) });
          R.sp_1panel = summ(await series(8)); R.sp_switch_settled_ms = Math.round(med(await spSw()));
          await p.evaluate(() => { SpatialOS.open("prod"); SpatialOS.open("inv"); }); R.sp_3panel = summ(await series(10));
          await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(1500);
          const cdp = await ctx.newCDPSession(p); await cdp.send("Performance.enable"); await cdp.send("HeapProfiler.collectGarbage"); const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
          for (let i = 0; i < 20; i++) { await p.evaluate((i) => { SpatialOS.open(["ord", "prod", "inv", "ana"][i % 4]); }, i); await wait(250); await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(250); }
          await wait(2500); await cdp.send("HeapProfiler.collectGarbage"); const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
          R.sp_after20_heap_mb = { before: +(m0.JSHeapUsedSize / 1048576).toFixed(1), after: +(m1.JSHeapUsedSize / 1048576).toFixed(1) }; R.sp_after20_nodes = { before: m0.Nodes, after: m1.Nodes }; R.sp_after20_frames = await p.evaluate(() => document.querySelectorAll("iframe").length);
        }
        await ctx.close();
      }
      console.log("rate", rate, JSON.stringify(R));
    }
  } catch (e) { console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  if (process.env.BENCH_OUT) fs.writeFileSync(process.env.BENCH_OUT, JSON.stringify(out, null, 1));
})();
