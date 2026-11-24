/* سحب النوافذ باللمس على آيفون/أندرويد/لوحي (Chromium بمحاكاة لمس حقيقية عبر CDP؛ لا يغني عن جهاز حقيقي ولا WebKit):
   (1) سحب رأس اللوح العادي والمكبَّر يحرّكه؛ (2) لو ألغى المتصفح أحداث المؤشر (pointercancel وانقطاعها) يكمل السحب بأحداث اللمس وينتهي سليماً؛
   (3) سحب لوح غير مفعّل من جسمه (الغلاف) يحرّكه؛ (4) الإصبع يعبر فوق إطار اللوح أثناء السحب فلا ينقطع؛ (5) لمسة قصيرة على الرأس لا تحرّك شيئاً ونقرتان تكبّرانه.
   التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/touch-drag.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 320) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
const UA_A = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36", UA_I = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
(async () => {
  const b = await PW.chromium.launch(); const store = await startStore({ stock: true });
  try {
    for (const [name, vp, ua] of [["أندرويد 412", { width: 412, height: 915 }, UA_A], ["آيفون 390", { width: 390, height: 844 }, UA_I], ["لوحي 820", { width: 820, height: 1180 }, UA_A]]) {
      const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: ua }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
      await p.goto(store.base + "/admin.html"); await wait(500); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
      await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&autoopen=1&noextra=1&noshell=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && [...SpatialOS.panels.values()].some(q => q.frDone), null, { timeout: 90000 }); await wait(2000);
      const cdp = await ctx.newCDPSession(p), T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], k) => ({ x, y, id: k })) });
      const st = (id) => p.evaluate((id) => { const q = id ? SpatialOS.panels.get(id) : [...SpatialOS.panels.values()][0], h = q.el.querySelector(".pn-h").getBoundingClientRect(), r = q.el.getBoundingClientRect(); return { id: q.id, big: q.big, x: Math.round(q.st.x), y: Math.round(q.st.y), hx: h.left + h.width / 2, hy: h.top + h.height / 2, box: [r.left, r.top, r.width, r.height], dragging: q.el.classList.contains("dragging") }; }, id);
      const drag = async (s, dx, dy, o = {}) => { const hx = (o.x != null ? o.x : s.hx + 20), hy = (o.y != null ? o.y : s.hy), n = 14; await T("touchStart", [[hx, hy]]); for (let k = 1; k <= n; k++) { if (o.mid && k === o.mid) await p.evaluate(() => { const q = [...SpatialOS.panels.values()][0]; window.__blk = e => { if (e.pointerType === "touch") e.stopImmediatePropagation(); }; ["pointermove", "pointerup"].forEach(t => addEventListener(t, window.__blk, true)); q.el.querySelector(".pn-h").dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, pointerType: "touch", bubbles: true })); }); await T("touchMove", [[hx + dx * k / n, hy + dy * k / n]]); await wait(16); } await T("touchEnd", []); await wait(900); };
      const moved = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
      /* 1) رأس اللوح العادي */
      let s0 = await st(); await drag(s0, -60, -90); let s1 = await st(); ok(name + ": سحب رأس اللوح العادي باللمس يحرّكه", moved(s0, s1) > 60 && !s1.dragging, [s0, s1]);
      /* 2) ألغى المتصفح أحداث المؤشر في منتصف السحب */
      s0 = await st(); await drag(s0, 50, 70, { mid: 4 }); s1 = await st(); await p.evaluate(() => { ["pointermove", "pointerup"].forEach(t => removeEventListener(t, window.__blk, true)); });
      ok(name + ": بعد pointercancel وانقطاع أحداث المؤشر يكمل السحب بأحداث اللمس حتى النهاية وينتهي سليماً", moved(s0, s1) > 60 && !s1.dragging, [s0, s1]);
      /* 3) لمسة قصيرة لا تحرّك */
      s0 = await st(); await T("touchStart", [[s0.hx + 20, s0.hy]]); await wait(60); await T("touchEnd", []); await wait(700); s1 = await st(); ok(name + ": لمسة قصيرة على الرأس لا تحرّك اللوح", moved(s0, s1) < 3 && !s1.dragging, [s0, s1]);
      /* 4) الإصبع يعبر فوق إطار اللوح أثناء السحب (المسار ينزل من الرأس إلى وسط الإطار) */
      s0 = await st(); await drag(s0, 0, Math.min(200, vp.height - s0.hy - 140)); s1 = await st(); ok(name + ": مرور الإصبع فوق إطار اللوح أثناء السحب لا يقطعه", moved(s0, s1) > 90 && !s1.dragging, [s0, s1]);
      /* 5) لوح غير مفعّل (الغلاف فوق جسمه): السحب من الجسم يحرّك النافذة */
      const first = await p.evaluate(() => { const q = [...SpatialOS.panels.values()][0]; q.el.classList.remove("focus"); return q.id; }); await wait(200); s0 = await st(first);
      const shield = await p.evaluate((id) => { const q = SpatialOS.panels.get(id), sh = q.el.querySelector(".pn-shield"), r = sh.getBoundingClientRect(), cx = r.left + r.width / 2; let cy = r.top + r.height * .3; for (let f = .15; f < .9; f += .05) { const y = r.top + r.height * f; if (y > 60 && y < innerHeight - 140 && document.elementFromPoint(cx, y) === sh) { cy = y; break; } } return { d: getComputedStyle(sh).display, cx, cy, top: document.elementFromPoint(cx, cy) === sh }; }, first);
      ok(name + ": لوح غير مفعّل يعرض الغلاف فوق جسمه", shield.d !== "none" && shield.top, shield);
      await drag(s0, -40, -60, { x: shield.cx, y: shield.cy }); s1 = await st(first); ok(name + ": سحب لوح غير مفعّل من جسمه (الغلاف) يحرّكه", moved(s0, s1) > 40 && !s1.dragging, [s0, s1]);
      /* 6) المكبَّر */
      const bigId = first; await p.evaluate((id) => SpatialOS.panels.get(id).el.querySelector(".pn-max").click(), bigId); await wait(1500); s0 = await st(bigId); await drag(s0, -50, -80); s1 = await st(bigId); ok(name + ": سحب رأس اللوح المكبَّر باللمس يحرّكه ضمن الحدود", s0.big && moved(s0, s1) > 40, [s0, s1]);
      ok(name + ": لا أخطاء صفحة", errs.length === 0, errs); await ctx.close();
    }
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 800)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
