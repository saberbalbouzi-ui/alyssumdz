/* اختبار واجهة «التقاط العناصر»: الكشف ثم القصّ ثم اختيار بالماوس: تلوين عند المرور وفصل العنصر المنقور وحده (أو الكل). الخدمة مُحاكاة.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-capture-ui.js */
const { chromium } = require("playwright"); let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x ? " " + JSON.stringify(x) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    window.alert = () => { }; window.confirm = () => true; const out = {}; const W = 800, H = 600, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    g.fillStyle = "#d9c7a3"; g.fillRect(0, 0, W, H); g.fillStyle = "#cc1f1f"; g.beginPath(); g.arc(250, 300, 110, 0, 7); g.fill(); g.fillStyle = "#1f3fcc"; g.fillRect(500, 200, 180, 220);
    const oc = document.createElement("canvas"); oc.width = W; oc.height = H; const og = oc.getContext("2d"); og.fillStyle = "#cc1f1f"; og.beginPath(); og.ellipse(W / 2, H / 2, W * .45, H * .45, 0, 0, 7); og.fill(); const pb64 = oc.toDataURL("image/png").split(",")[1];
    API.sb.url = p => "https://x.test" + p; API.sb.token = async () => "tok"; API.sb.headers = t => ({ Authorization: "Bearer " + t }); if (typeof BgEditor !== "undefined") BgEditor._t.extReset(); const f0 = window.fetch; window.fetch = async (u, init) => /bg-remove/.test(String(u)) ? new Response(JSON.stringify({ ok: true, type: "image/png", b64: pb64 }), { status: 200 }) : f0(u, init);
    const blob = await new Promise(r => cv.toBlob(r, "image/png")); const objs = [{ label: "كرة حمراء", r: 1, box: [190, 140, 410, 360] }, { label: "علبة زرقاء", box: [200, 500, 420, 680] }];
    const mkMask = q => { const m = document.createElement("canvas"); m.width = 256; m.height = 256; const x = m.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#fff"; if (q.r) { x.beginPath(); x.ellipse(128, 128, 126, 126, 0, 0, 7); x.fill(); } else x.fillRect(2, 2, 252, 252); return m.toDataURL("image/png"); };
    if (window.AIVision) AIVision.supported = () => false; const calls = []; Object.assign(ImgGen, { ready: () => ({ ok: true }), text: async o => { calls.push("text"); return JSON.stringify(objs.map(q => ({ label: q.label, box_2d: [q.box[0] / .6, q.box[1] / .8, q.box[2] / .6, q.box[3] / .8], mask: mkMask(q) }))); },
      edit: async o => { calls.push("edit"); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const x = c.getContext("2d"); x.fillStyle = "#d9c7a3"; x.fillRect(0, 0, o.W, o.H); return { canvas: c, blob: null }; } });
    await PBApp.toolSession([blob], "mk", "t"); const E = PBApp.E, sec = E.page.sections[0], base = (sec.free || []).find(w => w.type === "image"); out.before = (sec.free || []).filter(w => w.type === "image").length;
    PBSmart.captureElements();
    const wait = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise(z => setTimeout(z, 150)); } return false; };
    const st = document.getElementById("pbs-stage"); out.seg = await wait(() => { const sg = document.getElementById("pbs-seg"); return sg && sg.style.display === "none"; }, 8000); out.noBoxes = !!st && [...st.querySelectorAll("canvas")].length === 1;
    const cnt = () => (sec.free || []).filter(w => w.type === "image").length;
    /* بعد المسح لا يُفصل شيء تلقائياً: ننتظر مرحلة الاختيار */
    out.sel = await wait(() => { const g = document.getElementById("pbs-go"); return g && /التقاط الكل/.test(g.textContent) && !g.disabled; }, 25000); await new Promise(z => setTimeout(z, 400)); out.noAuto = cnt() === out.before + 0 + 0 || cnt() === out.before; out.noPreview = !document.getElementById("pbs-ok"); out.calls = calls.join(",");
    { const ov = [...st.querySelectorAll("canvas")].pop(), r0 = ov.getBoundingClientRect(); const pts = []; for (let yy = 1; yy < 20; yy++) for (let xx = 1; xx < 20; xx++) pts.push([r0.left + r0.width * xx / 20, r0.top + r0.height * yy / 20]);
      const send = (t, q) => ov.dispatchEvent(new MouseEvent(t, { clientX: q[0], clientY: q[1], bubbles: true })); const lit = () => { const d = ov.getContext("2d").getImageData(0, 0, ov.width, ov.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) return true; return false; };
      out.msgSel = (document.getElementById("pbs-msg")||{}).textContent; send("mousemove", [r0.left + 2, r0.top + 2]); out.hov0 = lit(); let hit = null; for (const q of pts) { send("mousemove", q); if (lit()) { hit = q; break; } } out.hov1 = !!hit; out.noAuto2 = cnt() === out.before;
      out.hit = hit; if (hit) { send("click", hit); out.one = await wait(() => cnt() === out.before + 1, 25000); await new Promise(z => setTimeout(z, 1500)); out.oneOnly = cnt() === out.before + 1; out.msgOne = (document.getElementById("pbs-msg")||{}).textContent; out.stillOpen = !!document.getElementById("pbs-modal"); }
      const g2 = document.getElementById("pbs-go"); out.allLbl = g2 && g2.textContent; if (g2) g2.click(); }
    out.applied = await wait(() => cnt() >= 3, 25000); await wait(() => !document.getElementById("pbs-modal"), 8000); out.closed = !document.getElementById("pbs-modal");
    out.after = cnt();
    { const fr = document.getElementById("pbx-frame"), d = fr.contentDocument, im = d.querySelector(".pb-cap img"); if (im) { const r = im.getBoundingClientRect(), fo = fr.getBoundingClientRect(); const sc = fo.width / (d.documentElement.clientWidth || fo.width); out.hp = { x: fo.left + (r.left + r.width / 2) * sc, y: fo.top + (r.top + r.height / 2) * sc, cx: fo.left + (r.left + 2) * sc, cy: fo.top + (r.top + 2) * sc, sc }; } else out.hp = null; }
    { const cc = document.createElement("canvas"); cc.width = 100; cc.height = 100; cc.getContext("2d").fillRect(0, 0, 100, 100); const r2 = AICapture.clipBox({ canvas: cc, x0: 0, y0: 0, w: 100, h: 100 }, { x0: 20, y0: 20, x1: 60, y1: 60 }, .04); out.clip = [r2.x0, r2.y0, r2.w, r2.h, r2.canvas.width]; }
    /* نزع الخلفية: تُطبَّق النتيجة مباشرة */
    const m = document.createElement("canvas"); m.width = 64; m.height = 64; const mg = m.getContext("2d"); mg.fillStyle = "#000"; mg.fillRect(0, 0, 64, 64); mg.fillStyle = "#fff"; mg.fillRect(6, 6, 52, 52); const murl = m.toDataURL("image/png");
    const src0 = base.set.src;
    const _s = AIVision.supported, _d = AICapture.detect, _p = AICapture.samPrep, _c = AICapture.samCuts; AIVision.supported = () => true; AICapture.samPrep = () => ({}); AICapture.detect = async c => [{ label: "منتج", box: { x0: 0, y0: 0, x1: c.width, y1: c.height } }]; AICapture.samCuts = async (c) => { const k = document.createElement("canvas"); k.width = c.width; k.height = c.height; const g = k.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(k.width * .25, k.height * .25, k.width * .5, k.height * .5); return [{ label: "منتج", canvas: k, x0: 0, y0: 0, w: c.width, h: c.height }]; }; await PBBgRemove.live({ node: base }); AIVision.supported = _s; AICapture.detect = _d; AICapture.samPrep = _p; AICapture.samCuts = _c;      /* مسار SAM2 (بلا فوتوروم) */ out.bg = { changed: base.set.src !== src0, noBar: !document.getElementById("pbx-epf"), chip: (document.getElementById("pbbg-chip") || {}).textContent || "" };
    /* مفتاح فوتوروم تجريبي: يعيد الصورة كاملة معتمة ← يُكتشف ويُكمل الالتقاط بالاحتياط */
    { const full = document.createElement("canvas"); full.width = W; full.height = H; const fg = full.getContext("2d"); fg.fillStyle = "#d9c7a3"; fg.fillRect(0, 0, W, H); const fb64 = full.toDataURL("image/png").split(",")[1];
      window.fetch = async (u, init) => /bg-remove/.test(String(u)) ? new Response(JSON.stringify({ ok: true, type: "image/png", b64: fb64 }), { status: 200 }) : f0(u, init);
      ImgGen.text = async o => JSON.stringify(objs.map(q => ({ label: q.label, box_2d: [q.box[0] / .6, q.box[1] / .8, q.box[2] / .6, q.box[3] / .8], mask: mkMask(q) })));
      const b4 = (sec.free || []).filter(w => w.type === "image").length; PBApp.E.sel = base.id; PBSmart.captureElements();
      await wait(() => { const g = document.getElementById("pbs-go"); return g && /التقاط الكل/.test(g.textContent) && !g.disabled; }, 25000); if (!document.getElementById("pbs-go")) out.dbg = "no modal"; else document.getElementById("pbs-go").click();
      out.sbx = await wait(() => (sec.free || []).filter(w => w.type === "image").length >= b4 + 2, 25000); out.msg = (document.getElementById("pbs-msg")||{}).textContent; out.sbxN = (sec.free || []).filter(w => w.type === "image").length - b4; }
    window.fetch = f0; ImgGen.text = async () => "[]";
    /* فشل الكشف: رسالة بسبب + زر نسخ تقرير الفشل (آخر طلب وردّه وأعداد العناصر/الأقنعة) */
    PBApp.E.sel = base.id; ImgGen.text = async () => "[]"; PBSmart.captureElements(); out.rep = await wait(() => document.querySelector(".pbs-rep"), 12000); out.report = AICapture.report(); const x = document.getElementById("pbs-x"); if (x) x.click();
    return out;
  }).catch(e => ({ err: String(e && e.stack || e) }));
  if (r.hp) { const st = () => p.evaluate(() => { const d = document.getElementById("pbx-frame").contentDocument; return { on: d.querySelectorAll(".pb-caph").length, f: (d.querySelector(".pb-caph img") ? getComputedStyle(d.querySelector(".pb-caph img")).filter : "").slice(0, 40) }; });
    await p.mouse.move(r.hp.x, r.hp.y); await p.waitForTimeout(250); r.h1 = await st(); await p.mouse.move(r.hp.cx, r.hp.cy); await p.waitForTimeout(250); r.h2 = await st(); }
  console.log(JSON.stringify(r));
  ok(!r.err, "لا أخطاء تنفيذ", r.err); if (r.err) { await b.close(); process.exit(1); }
  ok(r.sel && r.noAuto && r.noAuto2, "بعد المسح لا يُفصل شيء تلقائياً (مرحلة اختيار بالماوس)", r);
  ok(r.hov0 === false && r.hov1, "المرور على عنصر يلوّنه (وخارج العناصر لا تلوين)", r);
  ok(r.one && r.oneOnly && r.stillOpen, "النقر على عنصر يفصله وحده كطبقة والنافذة تبقى مفتوحة", r);
  ok(r.applied && r.closed && /التقاط الكل \(1\)/.test(r.allLbl), "«التقاط الكل» يفصل الباقي ويُغلق النافذة", r);
  ok(r.noPreview, "لا معاينة حفظ/إلغاء", r);
  ok(r.seg, "لا مربعات حول العناصر ولا أزرار عنصر/كل العناصر", r);
  ok(r.rep && /"counts"/.test(r.report) && /"raw"/.test(r.report), "فشل الكشف: زر نسخ التقرير يظهر والتقرير يحمل الأعداد وردّ الخدمة", r.report);
  ok(r.bg && r.bg.changed && r.bg.noBar && /نُفِّذ/.test(r.bg.chip), "نزع الخلفية يُطبَّق مباشرة بعد المسحة الأولى", r.bg);
  ok(r.hp && r.h1 && r.h1.on === 1 && /drop-shadow/.test(r.h1.f) && r.h2 && r.h2.on === 0, "المرور على العنصر الملتقط يوهّجه بخط أخضر يتبع ألفاه (وخارج ألفاه بلا توهج)", [r.hp, r.h1, r.h2]);
  ok(r.clip && r.clip[0] === 18 && r.clip[2] === 44 && r.clip[4] === 44, "القصّ يُقيَّد بمربع العنصر (لا يتسرّب وجه/يد خارجه)", r.clip);
  ok(r.sbx, "مفتاح فوتوروم التجريبي (صورة كاملة) لا يُنتج عناصر مستطيلة: يكمل بالاحتياط", r);
  ok(r.after === r.before + 2, "العنصران صارا صورتين حرتين", r);
  ok(!errs.length, "لا أخطاء صفحة", errs); console.log(fails.length ? "\n✗ " + fails.length + " فشل" : "\n✓ " + n + " فحصاً ناجحاً"); await b.close(); process.exit(fails.length ? 1 : 0);
})();
