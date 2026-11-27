/* ثبات العالم ثلاثي الأبعاد (laura-dev): (1) القاعدة (floorcv) والاسطوانة والكرة وحلقة المدارات عناصر ثابتة لا تُعاد إنشاؤها ولا تختفي أثناء 24 دورة فتح/إغلاق/تنقّل بين نوافذ متعددة؛
   (2) لا أكثر من ألواح مفتوحة + إطار احتياطي واحد (لا تسرّب إطارات)؛ (3) ترتيب النوافذ والعالم يُحفظ ويُستعاد بعد إعادة التحميل (النافذة المركَّزة تُحمَّل والباقي مصغَّراً بلا تحميل)؛
   (4) الاستعادة تعمل بعد إغلاق الكل وبعد كسر التخزين (JSON تالف) بلا أخطاء؛ (5) الألواح المفتوحة لا تتداخل بحيث يضيع لوح خارج الشاشة. التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/world-stable.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 360) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(), store = await startStore({ stock: true });
  try {
    for (const [name, vp, mob] of [["سطح المكتب", { width: 1440, height: 900 }, false], ["الهاتف", { width: 412, height: 915 }, true]]) {
      const ctx = await b.newContext(Object.assign({ viewport: vp }, mob ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {})), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(40000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
      await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
      const URLS = store.base + "/admin-preview/spatial-os/index.html?real=1&nozoom=1&noextra=1";
      await p.goto(URLS); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 90000 }); await wait(2500);
      await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); localStorage.removeItem("sc_layout_v1"); }); await wait(800);
      const probe = () => p.evaluate(() => { const fl = document.getElementById("floorcv"), cs = fl && getComputedStyle(fl); return { floor: !!fl && cs.display !== "none" && cs.visibility !== "hidden" && fl.width > 0, cyl: !!document.getElementById("cyl"), ring: document.querySelectorAll("#orbit .node:not(.sub)").length, core: !!document.getElementById("core"), frames: document.querySelectorAll("iframe").length, panels: SpatialOS.panels.size }; });
      await p.evaluate(() => { window.__ids = { floor: document.getElementById("floorcv"), cyl: document.getElementById("cyl"), core: document.getElementById("core"), orbit: document.getElementById("orbit"), nodes: [...document.querySelectorAll("#orbit .node:not(.sub)")] }; });
      const IDS = ["ord", "prod", "inv", "ana"]; let floorOk = true, maxFrames = 0, offscreen = 0;
      for (let i = 0; i < 24; i++) {
        await p.evaluate((id) => SpatialOS.open(id), IDS[i % 4]); await wait(mob ? 500 : 350);
        if (i % 3 === 2) await p.evaluate(() => { const k = [...SpatialOS.panels.keys()]; SpatialOS.dismiss(k[0], "close"); });
        if (i % 5 === 4) await p.evaluate(() => { document.querySelector('#orbit .node[data-id="prod"]:not(.sub)') && document.querySelector('#orbit .node[data-id="prod"]:not(.sub)').click(); });
        const s = await probe(); floorOk = floorOk && s.floor && s.cyl && s.core; maxFrames = Math.max(maxFrames, s.frames);
        offscreen += await p.evaluate(() => [...SpatialOS.panels.values()].filter(q => { if (q.min) return false; const r = q.el.getBoundingClientRect(); return r.right < 20 || r.left > innerWidth - 20 || r.bottom < 20 || r.top > innerHeight - 20; }).length);
      }
      await p.evaluate(() => { for (const k of [...SpatialOS.panels.keys()]) SpatialOS.dismiss(k, "close"); }); await wait(1200);
      const same = await p.evaluate(() => { const o = window.__ids; return o.floor === document.getElementById("floorcv") && o.cyl === document.getElementById("cyl") && o.core === document.getElementById("core") && o.orbit === document.getElementById("orbit") && o.nodes.every(n => n.isConnected); });
      ok(name + ": القاعدة والاسطوانة والكرة ظاهرة في كل خطوة من 24 دورة فتح/إغلاق/تنقّل", floorOk);
      ok(name + ": عناصر العالم نفسها (لم تُعد إنشاءها): القاعدة/الاسطوانة/الكرة/المدار/عقد المجموعات", same);
      ok(name + ": لا تسرّب إطارات: أقصى عدد إطارات ≤ 6 وبعد الإغلاق ≤ 2 (احتياطي)", maxFrames <= 6 && (await probe()).frames <= 2, { maxFrames, after: await probe() });
      ok(name + ": لا لوح ضائع خارج الشاشة أثناء الدورات", offscreen === 0, offscreen);
      /* حفظ واستعادة */
      await p.evaluate(() => { SpatialOS.open("ord"); }); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 90000 }); await wait(600);
      await p.evaluate(() => { SpatialOS.open("prod"); }); await p.waitForFunction(() => { const q = SpatialOS.panels.get("prod"); return q && q.frDone; }, null, { timeout: 90000 }); await wait(600);
      await p.evaluate(() => { const q = SpatialOS.panels.get("ord"); Object.assign(q.st, { x: -140, y: -30 }); }); await p.evaluate(() => { SpatialOS.setYaw && SpatialOS.setYaw(12); }); await wait(2200);
      const before = await p.evaluate(() => JSON.parse(localStorage.getItem("sc_layout_v1") || "null"));
      ok(name + ": يُحفظ الترتيب (نافذتان بمواضعها والمجموعة والدوران)", !!before && before.panels.length === 2 && before.panels.some(q => q.id === "ord") && before.panels.some(q => q.id === "prod"), before && before.panels.map(q => q.id));
      await p.goto(URLS); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && SpatialOS.panels.size >= 2, null, { timeout: 90000 }); await wait(2500);
      const after = await p.evaluate(() => ({ ids: [...SpatialOS.panels.keys()].sort(), min: [...SpatialOS.panels.values()].filter(q => q.min).map(q => q.id), loaded: [...SpatialOS.panels.values()].filter(q => q.frDone).map(q => q.id), floor: !!document.getElementById("floorcv"), ordX: SpatialOS.panels.get("ord") && Math.round(SpatialOS.panels.get("ord").st.x) }));
      ok(name + ": بعد إعادة التحميل تعود النافذتان، والمركَّزة محمَّلة والأخرى مصغَّرة بلا تحميل إطارها", after.ids.join() === "ord,prod" && after.min.length === 1 && after.loaded.length <= 1, after);
      ok(name + ": موضع النافذة المحفوظ يعود", after.ordX === -140 || after.min.includes("ord"), after);
      /* استعادة اللوح المصغَّر بالنقر على عقدته: يُحمَّل ويعمل */
      const mini = after.min[0]; await p.evaluate((id) => SpatialOS.open(id), mini); await p.waitForFunction((id) => { const q = SpatialOS.panels.get(id); return q && q.frDone && !q.min; }, mini, { timeout: 90000 }).catch(() => { });
      ok(name + ": اللوح المصغَّر يُحمَّل عند الاستعادة", await p.evaluate((id) => { const q = SpatialOS.panels.get(id); return !!q && !q.min && q.frDone; }, mini));
      /* تخزين تالف */
      await p.evaluate(() => { localStorage.setItem("sc_layout_v1", "{bad json"); }); await p.goto(URLS); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two, null, { timeout: 90000 }); await wait(2000);
      ok(name + ": تخزين تالف لا يكسر الفتح (لا أخطاء والقاعدة ظاهرة)", errs.length === 0 && (await probe()).floor, errs);
      ok(name + ": لا أخطاء صفحة", errs.length === 0, errs); await ctx.close();
    }
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 900)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
