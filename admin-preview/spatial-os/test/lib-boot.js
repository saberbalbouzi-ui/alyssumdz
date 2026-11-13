/* مساعدات إقلاع مشتركة للمرحلة 12 (منسوخة بلا تغيير من phase11.js كي لا يُمَس اختبار قائم): متصفح حقيقي + متجر PHP معزول + تسجيل دخول + فتح الوكيل. */
const { chromium } = require("playwright"); const path = require("path");
const FIX = path.join(__dirname, "fixtures"), sleep = ms => new Promise(r => setTimeout(r, ms));
const MIC = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
const launch = (wav, extra) => chromium.launch({ args: (wav === null ? [] : wav === undefined ? MIC.concat(["--use-file-for-fake-audio-capture=" + path.join(FIX, "fake-mic.wav")]) : MIC.concat(["--use-file-for-fake-audio-capture=" + path.join(FIX, wav)])).concat(extra || []) });
const NAME = { ord: "الطلبات", prod: "المنتجات", ana: "التحليلات", inv: "المخزون", ai: "مساعد ALYSSUM" };

async function boot(b, store, o = {}) {
  const ctxOpts = { viewport: o.vp || { width: 1440, height: 900 } }; if (o.mic !== false && o.permissions !== null) ctxOpts.permissions = ["microphone"]; if (o.rm) ctxOpts.reducedMotion = "reduce"; if (o.video) { ctxOpts.viewport = { width: 1280, height: 720 }; ctxOpts.recordVideo = { dir: o.video, size: { width: 1280, height: 720 } }; }
  const c = await b.newContext(ctxOpts), p = await c.newPage(), errs = [], reqs = [];
  p.setDefaultTimeout(15000); p.on("pageerror", e => errs.push(String(e.stack || e).split("\n").slice(0, 2).join(" <- ").slice(0, 220))); p.on("dialog", d => d.accept().catch(() => { }));
  p.on("request", r => { if (/\/api\/index\.php|server\/llm\.php/.test(r.url())) reqs.push({ t: Date.now(), m: r.method(), u: r.url(), b: r.postData() || "" }); });
  await p.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { if (window !== window.top) { const s = document.createElement("style"); s.textContent = "#toast,#toast2,.toast{pointer-events:none!important}"; document.head.appendChild(s); } }); if (window === window.top) { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch (_) { } } });
  const q = (o.query || "") + (o.tier ? "&tier=" + o.tier : "") + (o.gl0 ? "&gl=0" : ""), url = store.spatial + (q ? "?" + q.replace(/^&/, "") : "");
  if (o.init) await p.addInitScript(o.init);
  await p.goto(url); await p.waitForTimeout(500);
  if (!o.noLogin) { const body = o.user ? { user: o.user, password: o.pw } : { password: store.pw }; const st = await p.evaluate(async b2 => (await fetch("../../api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify(b2) })).status, body); if (st !== 200) throw new Error("login " + st); }
  await p.reload(); await p.waitForFunction(() => window.AlyssumAgent && window.Core3D && window.AgentVoice && AgentVoice.state().server.probed && (!window.AgentLLM || AgentLLM.state().probed), null, { timeout: 40000 });
  if (o.noOrd !== true) await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 }).catch(() => { });
  const X = {
    c, p, errs, reqs, store, base: store.base,
    openAgent: async () => { await p.evaluate(() => { SpatialOS.open("ai"); if (!window.__runHook) { window.__runHook = 1; window.__runN = 0; AlyssumAgent.on(e => { if (e.type === "run" && e.phase === "end") window.__runN++; }); } }); await p.waitForSelector(".ag .ag-in", { state: "visible" }); },
    runs: () => p.evaluate(() => window.__runN || 0),
    realClick: async sel => { const L = p.locator(sel).last(); await L.scrollIntoViewIfNeeded().catch(() => { }); await p.waitForTimeout(150); const bb = await L.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); },
    say: async (text, to = 90000) => { const n = await X.runs(); const inp = p.locator(".ag .ag-in"); await inp.click({ timeout: 2500 }).catch(async () => { await X.select("ai"); await inp.click(); }); await inp.fill(text); await inp.press("Enter"); await p.waitForFunction(n0 => (window.__runN || 0) > n0, n, { timeout: to }); return X.last(); },
    waitRun: async (n, to = 60000) => { await p.waitForFunction(n0 => (window.__runN || 0) > n0, n, { timeout: to }); return X.last(); },
    last: () => p.evaluate(() => { const b = [...document.querySelectorAll(".ag-run[data-status]")].pop(); const q = s => b.querySelector(s); return { status: b.dataset.status, text: b.querySelector(".ag-res").innerText, und: q(".ag-und").innerText, steps: [...b.querySelectorAll(".ag-step")].map(s => ({ tool: s.dataset.tool, status: s.dataset.status, txt: s.innerText.replace(/\s+/g, " ") })), confirm: !!b.querySelector(".ag-confirm"), verified: b.classList.contains("verified"), blocks: [...b.querySelectorAll(".ag-b")].map(x => ({ k: x.className.replace("ag-b ", ""), t: x.innerText })) }; }),
    api: () => p.evaluate(async () => (await (await fetch("../../api/index.php?r=orders", { credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest" } })).json()).orders),
    hdr: async id => (await p.$(`.panel[aria-label="${NAME[id]}"] .pn-h h3`)).boundingBox(),
    select: async id => { const h = await X.hdr(id), hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest(".panel") && e.closest(".panel").getAttribute("aria-label"); }, [h.x + h.width / 2, h.y + h.height / 2]); if (hit === NAME[id]) await p.mouse.click(h.x + h.width / 2, h.y + h.height / 2); else await p.evaluate(i => SpatialOS.open(i), id); await p.waitForFunction(i => SpatialOS.focused === i, id, { timeout: 5000 }).catch(async () => { await p.evaluate(i => SpatialOS.open(i), id); }); await p.waitForTimeout(450); },
    core: () => p.evaluate(() => Core3D.state()), sample: () => p.evaluate(() => Core3D.sample()),
    /* مراقب انتقالات: يسجّل (زمن، مصدر، حالة) لكل تغيّر في حالة الوكيل/الحالة البصرية/الصوت؛ يُقرأ لاحقاً لقياس تأخر التزامن */
    watch: () => p.evaluate(() => { window.__tl = []; const t0 = performance.now(); window.__tlOrigin = Date.now() - (performance.now() - t0); const push = (src, v) => window.__tl.push({ t: Math.round(performance.now() - t0), src, v }); let lv = null, sh = 0, ep = 0; AlyssumAgent.on(e => { if (e.type === "state") push("agent", e.state); }); AgentVoice.on(e => { if (e.type === "state") push("voice", e.mode); }); setInterval(() => { const s = Core3D.state(); if (s.visual !== lv) { lv = s.visual; push("visual", s.visual); } if (s.shocks !== sh) { sh = s.shocks; push("shock", s.shocks); } if (s.errPulses !== ep) { ep = s.errPulses; push("errpulse", s.errPulses); } }, 8); }),
    tl: () => p.evaluate(() => window.__tl.slice()),
    quiet: async (ms = 1200, max = 30000) => { const t0 = Date.now(); let since = 0; while (Date.now() - t0 < max) { const bad = await p.evaluate(() => SpatialHub.ids().map(i => SpatialHub.state(i)).filter(s => s && s.vis && (s.refreshing || s.stale)).length); if (!bad) { if (!since) since = Date.now(); if (Date.now() - since >= ms) return true; } else since = 0; await sleep(150); } return false; },
  };
  return X;
}
module.exports = { boot, launch, NAME, MIC, FIX, sleep };
