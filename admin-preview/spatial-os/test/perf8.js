/* قياسات الأداء للمرحلة 8 (Chromium): معدل الإطارات وزمن أطول إطار وذاكرة JS وعدد عقد DOM لعدة سيناريوهات، مع وبدون خنق المعالج (CPU 4×) كمحاكاة لعتاد متوسط.
   تحذير منهجي: البيئة هنا بلا GPU حقيقي (رسم برمجي SwiftShader) وبمعالج السحابة؛ الأرقام «أسوأ حالة نسبية» وليست قياساً على جهاز المستخدم ولا تُغني عن اختبار GPU حقيقي.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/perf8.js [out.json] */
const { chromium } = require("playwright"); const { startStore } = require("./harness"); const fs = require("fs");
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const store = await startStore(), b = await chromium.launch(), c = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await c.newPage(), cdp = await c.newCDPSession(p), out = { env: {}, runs: [] };
  await p.goto(store.spatial); await p.waitForTimeout(1000);
  await p.evaluate(async () => (await fetch("../../api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).status);
  const t0 = Date.now(); await p.reload(); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 }); out.env.firstRealPanelReadyMs = Date.now() - t0;
  out.env.cores = await p.evaluate(() => navigator.hardwareConcurrency); out.env.ua = await p.evaluate(() => navigator.userAgent);
  out.env.gpu = await p.evaluate(() => { try { const g = document.createElement("canvas").getContext("webgl"), e = g.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "n/a"; } catch (_) { return "n/a"; } });
  await cdp.send("Performance.enable"); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const frames = (ms, act) => p.evaluate(async ([ms, hasAct]) => { const d = []; let last = performance.now(), run = true; const loop = t => { d.push(t - last); last = t; if (run) requestAnimationFrame(loop); }; requestAnimationFrame(loop); await new Promise(r => setTimeout(r, ms)); run = false; d.shift(); const s = d.slice().sort((a, b) => a - b), sum = d.reduce((a, x) => a + x, 0); return { frames: d.length, fps: +(d.length / (sum / 1000)).toFixed(1), medMs: +s[Math.floor(s.length / 2)].toFixed(1), p95Ms: +s[Math.floor(s.length * .95)].toFixed(1), maxMs: +s[s.length - 1].toFixed(1), over50: d.filter(x => x > 50).length }; }, [ms]);
  const mem = async () => { const m = await cdp.send("Performance.getMetrics"), g = n => (m.metrics.find(x => x.name === n) || {}).value; return { jsHeapMB: +(g("JSHeapUsedSize") / 1048576).toFixed(1), nodes: g("Nodes"), documents: g("Documents"), listeners: g("JSEventListeners") }; };
  const hdr = async id => (await p.$(`.panel[aria-label="${id}"] .pn-h h3`)).boundingBox();
  const record = async (name, rate, fn) => { await cdp.send("Emulation.setCPUThrottlingRate", { rate }); const m = await fn(); out.runs.push({ name, cpuThrottle: rate + "x", ...m, ...(await mem()) }); console.log(JSON.stringify(out.runs[out.runs.length - 1])); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); };
  const dragLoop = async (ms, id) => { const h = await hdr(id), x = h.x + h.width / 2, y = h.y + h.height / 2; await p.mouse.move(x, y); await p.mouse.down(); const t = Date.now(); let i = 0; const fp = frames(ms + 200); while (Date.now() - t < ms) { i++; await p.mouse.move(x - 70 + 70 * Math.sin(i / 6), y + 40 * Math.cos(i / 6)); await sleep(16); } await p.mouse.up(); return fp; };
  const worldLoop = async ms => { const fp = frames(ms + 200); await p.mouse.move(300, 820); await p.mouse.down(); const t = Date.now(); let i = 0; while (Date.now() - t < ms) { i++; await p.mouse.move(300 + (i * 9) % 600, 820); await sleep(16); } await p.mouse.up(); return fp; };

  await p.evaluate(() => SpatialOS.dismiss("ord", "close")); await p.waitForTimeout(1500); await p.evaluate(() => SpatialOS.clearSel());
  for (const rate of [1, 4]) await record("عالم فارغ (بلا ألواح) — خمول", rate, () => frames(4000));
  await p.evaluate(() => SpatialOS.open("ord")); await p.waitForFunction(() => SpatialOS.panels.get("ord").frDone, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  for (const rate of [1, 4]) await record("لوح حقيقي واحد (طلبات) — خمول", rate, () => frames(4000));
  await record("لوح حقيقي واحد — سحب بالفأرة", 1, () => dragLoop(3500, "الطلبات")); await record("لوح حقيقي واحد — سحب بالفأرة", 4, () => dragLoop(3500, "الطلبات"));
  const t1 = Date.now(); for (const id of ["prod", "inv", "ana"]) { await p.evaluate(i => SpatialOS.open(i), id); await p.waitForFunction(i => SpatialOS.panels.get(i).frDone, id, { timeout: 90000 }); } out.env.threeMoreRealPanelsReadyMs = Date.now() - t1; await p.click('#modebar [data-w="tile"]'); await p.waitForTimeout(3000);
  for (const rate of [1, 4]) await record("4 ألواح حقيقية — خمول", rate, () => frames(4000));
  await record("4 ألواح حقيقية — سحب لوح", 1, () => dragLoop(3500, "الطلبات")); await record("4 ألواح حقيقية — سحب لوح", 4, () => dragLoop(3500, "الطلبات"));
  await record("4 ألواح حقيقية — تدوير الاسطوانة (سحب الخلفية)", 1, () => worldLoop(3500));
  await p.click('#modebar [data-w="cyl"]'); await p.waitForTimeout(2500); await record("4 ألواح مصغَّرة (أحياء) — خمول", 1, () => frames(4000));
  fs.writeFileSync(process.argv[2] || "perf8.json", JSON.stringify(out, null, 1)); await b.close(); store.stop();
})().catch(e => { console.error(e); process.exit(1); });
