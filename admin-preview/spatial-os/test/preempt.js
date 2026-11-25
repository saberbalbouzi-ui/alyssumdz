/* V4: اختيار نافذة منتظرة أثناء تحميل نافذة خلفية يرفع أولويتها فوراً: تُلغى الحمولة الخلفية الجارية (إن كانت في بدايتها) وتعود لدورها، وتُحمَّل المُختارة قبلها؛
   لا إطارات متسرّبة ولا أخطاء، وكل النوافذ تكتمل وتتزامن في الهَب. تحت تخنيق 4×. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/preempt.js */
const PW = require("playwright"), { startStore } = require("./harness");
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 320) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errs = []; p.setDefaultTimeout(90000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&noextra=1&nospare=1&norestore=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 90000 }); await wait(1500);
    await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(800);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await p.evaluate(() => { window.__order = []; window.__w = setInterval(() => { SpatialOS.panels.forEach(q => { if (q.frDone && window.__order.indexOf(q.id) < 0) window.__order.push(q.id); }); }, 50); ["ord", "prod", "inv", "ana"].forEach(id => SpatialOS.open(id)); });
    /* ننتظر حمولة خلفية جارية (غير المُركَّزة الأولى ana) */
    let cur = null; const t0 = Date.now(); while (Date.now() - t0 < 90000) { cur = await p.evaluate(() => { const l = [...SpatialOS.panels.values()].filter(q => q._lq === "loading" && q.id !== "ana"); return l.length ? l[0].id : null; }); if (cur) break; await wait(100); }
    ok("رُصدت حمولة خلفية جارية بعد النافذة المُركَّزة (" + cur + ")", !!cur);
    const waiting = await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => q._lq === "queued").map(q => q.id)); const pick = waiting[0];
    ok("يوجد لوح منتظر نختاره", !!pick, waiting);
    await p.evaluate(id => SpatialOS.panels.get(id).el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })), pick);
    await p.waitForFunction(() => ["ord", "prod", "inv", "ana"].every(i => { const q = SpatialOS.panels.get(i); return q && q.frDone; }), null, { timeout: 150000 }); await wait(3000);
    const R = await p.evaluate(() => ({ order: window.__order.slice(), ab: Object.fromEntries([...SpatialOS.panels.values()].map(q => [q.id, q._lqAborts || 0])), fr: document.querySelectorAll(".panel iframe").length, n: SpatialOS.panels.size, hub: ["ord", "prod", "inv", "ana"].map(i => SpatialHub.state(i) && SpatialHub.state(i).sync) }));
    ok("المُختارة حُمِّلت قبل الحمولة الخلفية الملغاة", R.order.indexOf(pick) >= 0 && R.order.indexOf(pick) < R.order.indexOf(cur), R);
    ok("الحمولة الخلفية أُلغيت مرة وأعيدت جدولتها (ثم اكتملت)", R.ab[cur] === 1 && R.order.indexOf(cur) >= 0, R.ab);
    ok("لا إطارات متسرّبة (إطار لكل لوح)", R.fr === R.n && R.n === 4, R);
    ok("كل الألواح متزامنة في الهَب بعد الإلغاء وإعادة التحميل", R.hub.every(x => x === "synced"), R.hub);
    ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "FAILS: " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
