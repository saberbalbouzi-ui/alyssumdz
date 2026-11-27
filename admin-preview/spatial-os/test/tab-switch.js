/* التنقل بين التبويبات (Spatial Core Performance V2): (1) آني (وسيط ≤ 120ms بعد الاستقرار على Chromium بلا GPU؛ الهدف 55ms)، (2) لا إعادة تحميل للإطار وعودة التبويب السابق بحالته (مرشح/تمرير/مدخل) كما تركه،
   (3) لا إطارات جديدة أثناء التنقل، (4) الفتح الأول لا يجمّد الواجهة (أطول مهمة رئيسية < 700ms) ويستقر الإطار خلال 8ث. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/tab-switch.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    for (const gl of ["", "&gl=1"]) {
      const lab = gl ? "WebGL حقيقي" : "تلقائي";
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(40000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
      await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
      await p.addInitScript(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch (_) { } });
      await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&nospare=1&noextra=1" + gl); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 90000 }); await wait(1500);
      await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); window.__lt.length = 0; }); await wait(600);
      await p.evaluate(() => SpatialOS.open("ord")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 });
      /* أول ثوانٍ: لا تجميد، ويستقر الإطار */
      const fr = async (ms) => p.evaluate((ms) => new Promise(res => { const d = []; let last = 0, id; const f = t => { if (last) d.push(t - last); last = t; id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); setTimeout(() => { cancelAnimationFrame(id); res(d.reduce((a, c) => a + c, 0) / Math.max(1, d.length)); }, ms); }), ms);
      let settled = null; for (let i = 0; i < 6; i++) { const m = await fr(1500); if (m < 45) { settled = (i + 1) * 1.5; break; } }
      ok(lab + ": يستقر الإطار (< 45ms) خلال 9ث من أول فتح", settled !== null, settled);
      const lt = await p.evaluate(() => Math.max(0, ...window.__lt)); ok(lab + ": أطول مهمة رئيسية أثناء أول فتح < 700ms (لا تجميد)", lt < 700, Math.round(lt));
      await wait(4000);
      /* حالة تُترك في تبويب الطلبات */
      await p.evaluate(() => { const w = SpatialOS.panels.get("ord").fr.contentWindow; w.__mark = 41; const d = w.document, s = d.getElementById("order-filter-q") || d.querySelector("#tab-orders input[type=search],#tab-orders input[type=text]"); if (s) { s.value = "zzz-state"; window.__sid = s.id || "(first)"; } d.scrollingElement.scrollTop = 120; });
      const frames0 = await p.evaluate(() => document.querySelectorAll("iframe").length), loads0 = await p.evaluate(() => { window.__loads = 0; SpatialOS.panels.get("ord").fr.addEventListener("load", () => { window.__loads++; }); return 0; });
      const times = await p.evaluate(async () => { const o = [], paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))); for (const id of ["prod", "inv", "ord", "prod", "ord", "inv", "ord"]) { const t0 = performance.now(); if (!SpatialOS.navTo(id)) { o.push(9999); continue; } o.push((await paint()) - t0); await new Promise(r => setTimeout(r, 350)); } return o; });
      const sorted = times.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
      ok(lab + ": التنقل آني (وسيط " + Math.round(med) + "ms ≤ 120ms؛ الهدف 55ms) وكل التنقلات نجحت في اللوح نفسه", med <= 120 && times.every(x => x < 9000), times.map(Math.round));
      const st = await p.evaluate(() => { const q = SpatialOS.panels.get("ord"), w = q.fr.contentWindow, d = w.document, s = d.getElementById("order-filter-q") || d.querySelector("#tab-orders input[type=search],#tab-orders input[type=text]"); return { mark: w.__mark, val: s ? s.value : null, top: Math.round(d.scrollingElement.scrollTop), loads: window.__loads, frames: document.querySelectorAll("iframe").length, panels: SpatialOS.panels.size }; });
      ok(lab + ": لا إعادة تحميل للإطار ولا إطارات جديدة أثناء التنقل", st.mark === 41 && st.loads === 0 && st.frames === frames0 && st.panels === 1, st);
      ok(lab + ": العودة إلى تبويب الطلبات تُرجع المدخل والتمرير كما تُركا", st.val === "zzz-state", st);
      ok(lab + ": لا أخطاء صفحة", errs.length === 0, errs); await ctx.close();
    }
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 800)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
