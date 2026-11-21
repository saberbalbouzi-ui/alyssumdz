/* السحب داخل البطاقات: (1) سحب فأرة على ستارة لوح غير مُركَّز يحرّكه؛ (2) نقرة بلا سحب تفعّله ولا تحرّكه؛ (3) لمس: تمرير داخل اللوح الحقيقي يحرّك محتواه (touch-action)؛ (4) لقطة بلا هالة.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/drag-inside.js */
const PW = require("playwright"), { startStore } = require("./harness"); const SHOTS = process.env.SHOTS || "";
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  " + JSON.stringify(x).slice(0, 260) : "")); }; const wait = ms => new Promise(r => setTimeout(r, ms));
async function open(b, vp, mobile) {
  const store = await startStore(); const c = await b.newContext({ viewport: vp, ...(mobile ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) }), p = await c.newPage(); p.setDefaultTimeout(20000); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.goto(store.base + "/admin.html"); await wait(800);
  await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
  await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.panels, null, { timeout: 30000 }); await wait(1500);
  return { store, c, p, errs };
}
(async () => {
  const b = await PW.chromium.launch();
  try {
    { const { p, errs } = await open(b, { width: 1440, height: 900 }, false);
      await p.evaluate(() => { SpatialOS.open("prod"); }); await p.waitForFunction(() => { const q = SpatialOS.panels.get("prod"); return q && q.frDone; }, null, { timeout: 60000 });
      await p.evaluate(() => { SpatialOS.open("ord"); }); await p.waitForFunction(() => { const q = SpatialOS.panels.get("ord"); return q && q.frDone; }, null, { timeout: 60000 }); await wait(1500);
      const info = await p.evaluate(() => { const q = SpatialOS.panels.get("prod"), r = q.el.querySelector(".pn-shield").getBoundingClientRect(), f = SpatialOS.focused; return { x: r.x + r.width / 2, y: r.y + r.height / 2, focus: f, shield: getComputedStyle(q.el.querySelector(".pn-shield")).display, x0: q.st.x, y0: q.st.y, hit: (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) || {}).className }; });
      ok("الستارة ظاهرة على لوح غير مُركَّز", info.shield !== "none" && info.focus !== "prod", info);
      await p.mouse.move(info.x, info.y); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(info.x + i * 12, info.y + i * 8); await wait(30); } await p.mouse.up(); await wait(900);
      const mv = await p.evaluate(() => { const q = SpatialOS.panels.get("prod"); return { x: q.st.x, y: q.st.y }; });
      ok("سحب الفأرة على لوح غير مُركَّز يحرّكه", Math.abs(mv.x - info.x0) > 40 || Math.abs(mv.y - info.y0) > 25, { from: [info.x0, info.y0], to: [mv.x, mv.y] });
      /* نقرة بلا سحب: تفعّل ولا تحرّك */
      const i2 = await p.evaluate(() => { SpatialOS.open("ord"); const q = SpatialOS.panels.get("ord"); const r = q.el.querySelector(".pn-shield").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, sx: q.st.x, sy: q.st.y, f: SpatialOS.focused }; }); await wait(800);
      const i3 = await p.evaluate(() => { const o = SpatialOS.panels.get("prod"), r = o.el.querySelector(".pn-shield").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, sx: o.st.x, sy: o.st.y, f: SpatialOS.focused }; });
      await p.mouse.click(i3.x, i3.y); await wait(700);
      const a3 = await p.evaluate(() => { const o = SpatialOS.panels.get("prod"); return { sx: o.st.x, sy: o.st.y, f: SpatialOS.focused }; });
      ok("نقرة على الستارة تفعّل اللوح ولا تحرّكه", a3.f === "prod" && Math.abs(a3.sx - i3.sx) < 6 && Math.abs(a3.sy - i3.sy) < 6, { i3, a3 });
      if (SHOTS) await p.screenshot({ path: SHOTS + "/crisp-desktop.png" });
      ok("لا أخطاء صفحة (مكتب)", errs.length === 0, errs); await p.context().close(); }
    { const { p, errs } = await open(b, { width: 390, height: 844 }, true);
      await p.evaluate(() => SpatialOS.open("prod")); await p.waitForFunction(() => { const q = SpatialOS.panels.get("prod"); return q && q.frDone; }, null, { timeout: 60000 }); await wait(2500);
      const cdp = await p.context().newCDPSession(p); const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
      const ta = await p.evaluate(() => { const q = SpatialOS.panels.get("prod"), d = q.fr.contentDocument, sc = d.scrollingElement || d.documentElement, r = q.fr.getBoundingClientRect(); return { ta: getComputedStyle(q.el.querySelector(".pn-b")).touchAction, h: sc.scrollHeight, ch: sc.clientHeight, top: sc.scrollTop, cx: r.x + r.width / 2, cy: r.y + r.height * .7, fr: q.frame }; });
      ok("touch-action لجسم اللوح الحقيقي يسمح بالتمرير (pan-x pan-y لا none)", /pan-x/.test(ta.ta) && /pan-y/.test(ta.ta), ta);
      if (ta.h > ta.ch + 40) { const s0 = ta.top; await T("touchStart", [[ta.cx, ta.cy]]); for (let i = 1; i <= 12; i++) { await T("touchMove", [[ta.cx, ta.cy - i * 18]]); await wait(30); } await T("touchEnd", []); await wait(500);
        const s1 = await p.evaluate(() => { const d = SpatialOS.panels.get("prod").fr.contentDocument; return (d.scrollingElement || d.documentElement).scrollTop; });
        ok("سحب باللمس داخل اللوح الحقيقي يمرّر محتواه", s1 > s0 + 30, { s0, s1 }); } else R.push("SKIP لا محتوى أطول من اللوح لاختبار التمرير باللمس (NOT TESTED)  " + JSON.stringify(ta));
      ok("لا أخطاء صفحة (هاتف)", errs.length === 0, errs); await p.context().close(); }
  } catch (e) { fails++; R.push("FAIL [crash] " + String(e).slice(0, 400)); }
  await b.close(); console.log(R.join("\n")); console.log(fails ? "\nFAILED: " + fails : "\nALL PASS"); process.exit(fails ? 1 : 0);
})();
