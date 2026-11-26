/* الهاتف (390–430px، لمس حقيقي عبر CDP): (1) القاعدة (أرضية القاعة) ظاهرة ومرسومة بلا اعتماد على مستوى الجودة؛ (2) اللوح الحقيقي العادي والمكبَّر لا يحملان تحويلاً ثلاثي الأبعاد (translateZ/rotateX) — مصدر عطل تمرير الإصبع داخل iframe في iOS؛
   (3) السحب بالإصبع داخل اللوح يمرّر محتواه في الحالتين (Chromium بمحاكاة لمس؛ لا يغني عن جهاز iOS حقيقي). التشغيل: NODE_PATH=/opt/node-tools/node_modules node admin-preview/spatial-os/test/phone-scroll.js */
const PW = require("playwright"), { startStore } = require("./harness");
const R = []; let fails = 0; const ok = (n, c, x) => { if (!c) fails++; R.push((c ? "PASS " : "FAIL ") + n + (!c && x !== undefined ? "  " + JSON.stringify(x).slice(0, 300) : "")); console.log(R[R.length - 1]); }; const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await PW.chromium.launch(); const store = await startStore();
  try {
    const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), p = await ctx.newPage(), errs = []; p.setDefaultTimeout(30000); p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    await p.goto(store.base + "/admin.html"); await wait(800); await p.evaluate(async () => (await fetch("api/index.php?r=login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ password: "TestPass12345" }) })).json());
    await p.goto(store.base + "/admin-preview/spatial-os/index.html?real=1&autoopen=1"); await p.waitForFunction(() => typeof SpatialOS !== "undefined" && SpatialOS.two && [...SpatialOS.panels.values()].some(q => q.frDone), null, { timeout: 60000 }); await wait(2500);
    /* القاعدة */
    const fl = await p.evaluate(() => { const c = document.getElementById("floorcv"), g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data; let nz = 0; for (let i = 3; i < d.length; i += 388) if (d[i]) nz++; return { disp: getComputedStyle(c).display, w: c.width, nz, q: document.documentElement.dataset.q, cls: document.body.className }; });
    ok("القاعدة ظاهرة على الهاتف ومرسومة (لوحة 1536² على الهاتف) مهما كان مستوى الجودة", fl.disp !== "none" && fl.w === 1536 && fl.nz > 1000, fl);
    await p.evaluate(() => { document.documentElement.dataset.q = "0"; }); ok("حتى عند الجودة 0 تبقى القاعدة ظاهرة على الهاتف", await p.evaluate(() => getComputedStyle(document.getElementById("floorcv")).display !== "none"));
    const info = () => p.evaluate(() => { const q = [...SpatialOS.panels.values()][0], t = getComputedStyle(q.el).transform, d = q.fr.contentDocument; return { big: q.big, t, threeD: /^matrix3d/.test(t), top: d.scrollingElement.scrollTop, h: d.documentElement.scrollHeight, ch: d.documentElement.clientHeight, fr: (() => { const r = q.fr.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.height]; })() }; });
    const swipe = async () => { const i0 = await info(), cdp = await ctx.newCDPSession(p), T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], k) => ({ x, y, id: k })) }), y0 = i0.fr[1] + 120; await T("touchStart", [[i0.fr[0], y0]]); for (let k = 1; k <= 12; k++) { await T("touchMove", [[i0.fr[0], y0 - k * 22]]); await wait(16); } await T("touchEnd", []); await wait(400); return [i0.top, (await info()).top]; };
    let i = await info(); ok("اللوح العادي على الهاتف: تحويل ثنائي الأبعاد فقط (لا matrix3d)", !i.threeD && i.h > i.ch, i);
    let s = await swipe(); ok("سحب الإصبع يمرّر محتوى اللوح العادي", s[1] > s[0] + 50, s);
    await p.evaluate(() => [...SpatialOS.panels.values()][0].el.querySelector(".pn-max").click()); await wait(1500); i = await info();
    ok("اللوح المكبَّر على الهاتف: تحويل ثنائي الأبعاد فقط (لا translateZ)", i.big === true && !i.threeD, i);
    s = await swipe(); ok("سحب الإصبع يمرّر محتوى اللوح المكبَّر", s[1] > s[0] + 50, s);
    await p.evaluate(() => [...SpatialOS.panels.values()][0].el.querySelector(".pn-max").click()); await wait(900); i = await info(); ok("العودة من التكبير: لا يزال ثنائي الأبعاد", i.big === false && !i.threeD, i);
    /* أندرويد/كروم: لو منع المتصفح التمرير الأصلي (touch-action موروث) يمرّره جسر اللمس يدوياً — صفحة اللوح ونافذة «طلب يدوي» المنبثقة */
    await p.evaluate(() => { const d = [...SpatialOS.panels.values()][0].fr.contentDocument, st = d.createElement("style"); st.id = "__noNative"; st.textContent = "*{touch-action:none!important}"; d.head.appendChild(st); [...SpatialOS.panels.values()][0].fr.contentDocument.scrollingElement.scrollTop = 0; }); await wait(300);
    s = await swipe(); ok("لو عُطّل التمرير الأصلي (touch-action:none) يمرّر جسر اللمس صفحة اللوح", s[1] > s[0] + 50, s);
    await p.evaluate(() => { const q = [...SpatialOS.panels.values()][0]; q.fr.contentWindow.ManualOrder.open({ mode: "new" }); }); await wait(800);
    const mo = () => p.evaluate(() => { const q = [...SpatialOS.panels.values()][0], m = q.fr.contentDocument.querySelector("#mo-bg .modal"), r = q.fr.getBoundingClientRect(); return { st: m ? m.scrollTop : -1, mx: m ? m.scrollHeight - m.clientHeight : 0, fr: [r.left, r.top, r.width, r.height] }; });
    let m0 = await mo(); const cdp2 = await ctx.newCDPSession(p), T2 = (type, pts) => cdp2.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], k) => ({ x, y, id: k })) });
    await T2("touchStart", [[m0.fr[0] + m0.fr[2] / 2, m0.fr[1] + m0.fr[3] * .8]]); for (let k = 1; k <= 12; k++) { await T2("touchMove", [[m0.fr[0] + m0.fr[2] / 2, m0.fr[1] + m0.fr[3] * (.8 - .5 * k / 12)]]); await wait(16); } await T2("touchEnd", []); await wait(500); const m1 = await mo();
    ok("نافذة «طلب يدوي» المنبثقة تتمرّر بالإصبع (التمرير الأصلي معطّل هنا: الجسر)", m0.mx > 100 && m1.st > m0.st + 50, [m0, m1]);
        ok("لا أخطاء صفحة", errs.length === 0, errs);
  } catch (e) { fails++; console.log("FAIL [crash]", String(e && e.stack || e).slice(0, 700)); }
  finally { try { await b.close(); } catch { } try { store.stop(); } catch { } }
  console.log(fails ? "\nFAILED: " + fails : "\nALL PASS (" + R.filter(x => x.startsWith("PASS")).length + ")"); process.exit(fails ? 1 : 0);
})();
