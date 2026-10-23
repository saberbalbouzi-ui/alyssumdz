/* اختبار واجهة «التقاط العناصر»: بلا مربعات حول العناصر ولا اختيار — الكشف ثم القصّ تلقائياً ثم معاينة حفظ/إلغاء ثم العناصر صور حرة. الخدمة مُحاكاة.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-capture-ui.js */
const { chromium } = require("playwright"); let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x ? " " + JSON.stringify(x) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    window.alert = () => { }; window.confirm = () => true; const out = {}; const W = 800, H = 600, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    g.fillStyle = "#d9c7a3"; g.fillRect(0, 0, W, H); g.fillStyle = "#cc1f1f"; g.beginPath(); g.arc(250, 300, 110, 0, 7); g.fill(); g.fillStyle = "#1f3fcc"; g.fillRect(500, 200, 180, 220);
    const blob = await new Promise(r => cv.toBlob(r, "image/png")); const objs = [{ label: "كرة حمراء", r: 1, box: [190, 140, 410, 360] }, { label: "علبة زرقاء", box: [200, 500, 420, 680] }];
    const mkMask = q => { const m = document.createElement("canvas"); m.width = 256; m.height = 256; const x = m.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#fff"; if (q.r) { x.beginPath(); x.ellipse(128, 128, 126, 126, 0, 0, 7); x.fill(); } else x.fillRect(2, 2, 252, 252); return m.toDataURL("image/png"); };
    const calls = []; Object.assign(ImgGen, { ready: () => ({ ok: true }), text: async o => { calls.push("text"); return JSON.stringify(objs.map(q => ({ label: q.label, box_2d: [q.box[0] / .6, q.box[1] / .8, q.box[2] / .6, q.box[3] / .8], mask: mkMask(q) }))); },
      edit: async o => { calls.push("edit"); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const x = c.getContext("2d"); x.fillStyle = "#d9c7a3"; x.fillRect(0, 0, o.W, o.H); return { canvas: c, blob: null }; } });
    await PBApp.toolSession([blob], "mk", "t"); const E = PBApp.E, sec = E.page.sections[0], base = (sec.free || []).find(w => w.type === "image"); out.before = (sec.free || []).filter(w => w.type === "image").length;
    PBSmart.captureElements();
    const wait = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await new Promise(z => setTimeout(z, 150)); } return false; };
    const st = document.getElementById("pbs-stage"); out.seg = await wait(() => { const sg = document.getElementById("pbs-seg"); return sg && sg.style.display === "none"; }, 8000); out.noBoxes = !!st && [...st.querySelectorAll("canvas")].length === 1;
    out.applied = await wait(() => (sec.free || []).filter(w => w.type === "image").length >= 3, 25000); out.noPreview = !document.getElementById("pbs-ok"); out.calls = calls.join(",");
    out.after = (sec.free || []).filter(w => w.type === "image").length;
    /* نزع الخلفية: تُطبَّق النتيجة مباشرة */
    const m = document.createElement("canvas"); m.width = 64; m.height = 64; const mg = m.getContext("2d"); mg.fillStyle = "#000"; mg.fillRect(0, 0, 64, 64); mg.fillStyle = "#fff"; mg.fillRect(6, 6, 52, 52); const murl = m.toDataURL("image/png");
    ImgGen.text = async o => JSON.stringify([{ label: "منتج", box_2d: [200, 200, 800, 800], mask: murl }]); const src0 = base.set.src;
    await PBBgRemove.live({ node: base }); out.bg = { changed: base.set.src !== src0, noBar: !document.getElementById("pbx-epf"), chip: (document.getElementById("pbbg-chip") || {}).textContent || "" };
    /* فشل الكشف: رسالة بسبب + زر نسخ تقرير الفشل (آخر طلب وردّه وأعداد العناصر/الأقنعة) */
    PBApp.E.sel = base.id; ImgGen.text = async () => "[]"; PBSmart.captureElements(); out.rep = await wait(() => document.querySelector(".pbs-rep"), 12000); out.report = AICapture.report(); const x = document.getElementById("pbs-x"); if (x) x.click();
    return out;
  }).catch(e => ({ err: String(e && e.stack || e) }));
  console.log(JSON.stringify(r));
  ok(!r.err, "لا أخطاء تنفيذ", r.err); if (r.err) { await b.close(); process.exit(1); }
  ok(r.applied && r.noPreview, "الالتقاط يبدأ تلقائياً وتُطبَّق النتيجة مباشرة بلا معاينة ولا اختيار", r);
  ok(r.noBoxes && r.seg, "لا مربعات حول العناصر ولا أزرار عنصر/كل العناصر", r);
  ok(r.rep && /"counts"/.test(r.report) && /"raw"/.test(r.report), "فشل الكشف: زر نسخ التقرير يظهر والتقرير يحمل الأعداد وردّ الخدمة", r.report);
  ok(r.bg && r.bg.changed && r.bg.noBar && /نُفِّذ/.test(r.bg.chip), "نزع الخلفية يُطبَّق مباشرة بعد المسحة الأولى", r.bg);
  ok(r.after === r.before + 2, "العنصران صارا صورتين حرتين", r);
  ok(!errs.length, "لا أخطاء صفحة", errs); console.log(fails.length ? "\n✗ " + fails.length + " فشل" : "\n✓ " + n + " فحصاً ناجحاً"); await b.close(); process.exit(fails.length ? 1 : 0);
})();
