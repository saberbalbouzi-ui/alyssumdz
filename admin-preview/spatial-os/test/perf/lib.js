/* أدوات قياس الأداء الكاملة للمشهد (المرحلة 12): إطارات rAF الحقيقية (متوسط/1% الأدنى/p50/p95)، CPU وJS heap عبر CDP، معلومات GPU.
   تحذير: البيئة الحالية رسم برمجي (SwiftShader) — تشخيصية فقط، لا تمثل أجهزة حقيقية. */
const { chromium } = require("playwright");
async function launch(args) { return chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"].concat(args || []) }); }
async function newPage(b, url, o = {}) {
  const ctx = await b.newContext(Object.assign({ viewport: o.vp || { width: 1440, height: 900 }, permissions: ["microphone"] }, o.ctx || {})), p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send("Performance.enable");
  await p.goto(url); return { ctx, p, cdp };
}
const metrics = async cdp => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
/* يقيس ms من الإطارات الفعلية. بدأ بإحماء warm */
async function measure(h, ms = 8000, warm = 1500) {
  await h.p.waitForTimeout(warm); const m0 = await metrics(h.cdp), t0 = Date.now();
  const fr = await h.p.evaluate(async d => new Promise(res => { const a = []; let last = performance.now(), end = last + d; const tick = t => { a.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else res(a.slice(1)); }; requestAnimationFrame(tick); }), ms);
  const m1 = await metrics(h.cdp), wall = (Date.now() - t0) / 1000, s = fr.slice().sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))], sum = fr.reduce((x, y) => x + y, 0);
  const d = k => (m1[k] - m0[k]) / wall * 100;
  return { frames: fr.length, avg_fps: +(fr.length / (sum / 1000)).toFixed(1), low1_fps: +(1000 / q(.99)).toFixed(1), p50_ms: +q(.5).toFixed(1), p95_ms: +q(.95).toFixed(1), max_ms: +s[s.length - 1].toFixed(0), cpu_pct: +d("TaskDuration").toFixed(0), script_pct: +d("ScriptDuration").toFixed(0), layout_pct: +d("LayoutDuration").toFixed(1), style_pct: +d("RecalcStyleDuration").toFixed(1), heap_mb: +(m1.JSHeapUsedSize / 1048576).toFixed(1), nodes: m1.Nodes, layouts_per_s: +((m1.LayoutCount - m0.LayoutCount) / wall).toFixed(1), restyle_per_s: +((m1.RecalcStyleCount - m0.RecalcStyleCount) / wall).toFixed(1) };
}
const gpuInfo = p => p.evaluate(() => { try { const c = document.createElement("canvas"), g = c.getContext("webgl"), e = g && g.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "n/a"; } catch (_) { return "n/a"; } });
module.exports = { launch, newPage, measure, metrics, gpuInfo };
