/* V3: تحميل متدرج لعدة نوافذ — إطار واحد يُحمَّل في الوقت نفسه، المُركَّز أولاً، الباقي بشاشة «بانتظار دورها»، رفع أولوية عند التركيز،
   المصغَّرة لا تُحمَّل والمغلقة تُسقَط من الطابور، بلا إطارات متسرّبة ولا أخطاء. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/multi-load.js */
const PW = require("playwright"), { startStore } = require("./harness");
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 320) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errs = []; p.setDefaultTimeout(60000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&noextra=1&nospare=1&norestore=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 90000 }); await wait(1500);
    await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(800);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 2 });   /* تخنيق خفيف ليتّسع زمن الطابور للمراقبة */
    const st = () => p.evaluate(() => [...SpatialOS.panels.values()].map(q => ({ id: q.id, lq: q._lq || null, done: !!q.frDone, fd: q.el.dataset.frame || "" })));
    /* 1) فتح 4 نوافذ دفعة واحدة */
    await p.evaluate(() => ["ord", "prod", "inv", "ana"].forEach(id => SpatialOS.open(id)));
    let maxLoading = 0, sawQueued = 0, order = [], seen = new Set(), t0 = Date.now();
    while (Date.now() - t0 < 90000) { const s = await st(); maxLoading = Math.max(maxLoading, s.filter(q => q.lq === "loading").length); sawQueued = Math.max(sawQueued, s.filter(q => q.lq === "queued").length); s.forEach(q => { if (q.done && !seen.has(q.id)) { seen.add(q.id); order.push(q.id); } }); if (s.length === 4 && s.every(q => q.done)) break; await wait(120); }
    ok("لا يُحمَّل أكثر من إطار واحد في اللحظة الواحدة", maxLoading <= 1, { maxLoading });
    ok("النوافذ غير المُركَّزة تنتظر دورها في الطابور (شوهدت منتظرة)", sawQueued >= 2, { sawQueued });
    ok("النافذة المُركَّزة (الأحدث) تُحمَّل أولاً", order[0] === "ana", order);
    ok("كل النوافذ الأربع اكتمل تحميلها", order.length === 4, order);
    await wait(4000); const hs = await p.evaluate(() => ["ord", "prod", "inv", "ana"].map(i => { const q = window.SpatialHub && SpatialHub.state(i); return q ? q.sync : null; }));
    ok("المركز (Hub) يرى كل ألواح الطابور متزامنة (الحماية من سباق load الفارغ الأولي في phase9 S0)", hs.every(x => x === "synced"), hs);
    ok("لا إطارات متسرّبة: إطار واحد لكل لوح", await p.evaluate(() => document.querySelectorAll(".panel iframe, .pn-frame").length) <= 4, null);
    /* 2) شاشة الانتظار */
    await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(800);
    await p.evaluate(() => ["ord", "prod", "inv", "ana"].forEach(id => SpatialOS.open(id))); await wait(300);
    const mid = await st(); const waiting = mid.filter(q => q.lq === "queued").map(q => q.id);
    ok("بعد فتح 4 نوافذ تظهر شاشة الانتظار على المنتظرة (data-frame=queued)", waiting.length >= 2 && mid.filter(q => q.lq === "queued").every(q => q.fd === "queued"), mid);
    const pick = waiting[waiting.length - 1];
    /* 3) تصغير منتظرة: لا تُحمَّل؛ ثم إغلاق منتظرة: تُسقَط */
    const others = waiting.filter(x => x !== pick); const minId = others[0], closeId = others[1];
    if (minId) await p.evaluate(id => SpatialOS.dismiss(id, "min"), minId); if (closeId) await p.evaluate(id => SpatialOS.dismiss(id, "close"), closeId);
    t0 = Date.now(); while (Date.now() - t0 < 90000) { const s = await st(); if (s.filter(q => q.id !== minId).every(q => q.done)) break; await wait(150); }
    const fin = await st(), m = fin.find(q => q.id === minId);
    ok("المصغَّرة وهي منتظرة لا تُحمَّل (held)", !m || (!m.done && m.lq === "held"), m);
    ok("المغلقة وهي منتظرة تُسقَط من الطابور ولا يبقى لها لوح", !closeId || !fin.some(q => q.id === closeId), fin);
    ok("الباقية اكتمل تحميلها بعد الإسقاط (الطابور لم يتجمّد)", fin.filter(q => q.id !== minId).every(q => q.done), fin);
    /* 4) استعادة المصغَّرة تُحمِّلها */
    if (minId) { await p.evaluate(id => SpatialOS.open(id), minId); await p.waitForFunction(id => { const q = SpatialOS.panels.get(id); return q && q.frDone; }, minId, { timeout: 90000 }); ok("استعادة المصغَّرة تُحمِّلها فعلاً", true); }
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "FAILS: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
