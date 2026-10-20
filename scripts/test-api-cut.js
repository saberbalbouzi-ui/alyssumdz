/* اختبار «التقاط العناصر» و«نزع الخلفية» عبر Alyssum API (وحدتان مستقلتان AICapture وAIBgCut) بمحاكاة الخدمة:
   مشهد اصطناعي (خلفية متدرّجة مموّهة + دائرة حمراء + مربع أزرق)، الكشف يعيد مربعات، وقناع «الخدمة» مزاح 4px ومموَّه عمداً ← يجب أن يلتصق الناتج بحدود العنصر الحقيقية.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-api-cut.js */
const { chromium } = require("playwright"); let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x ? " " + JSON.stringify(x) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const out = {}; const W = 800, H = 600, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#d9c7a3"); gr.addColorStop(1, "#8aa6c1"); g.fillStyle = gr; g.fillRect(0, 0, W, H); let sd0 = 7; const rnd = () => (sd0 = (sd0 * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 700; i++) { g.fillStyle = "hsl(" + Math.round(rnd() * 360) + ",45%," + Math.round(30 + rnd() * 45) + "%)"; g.fillRect(rnd() * W, rnd() * H, 12 + rnd() * 60, 12 + rnd() * 60); }      // خلفية مزدحمة (ليست استوديو متجانساً)
    g.fillStyle = "#cc1f1f"; g.beginPath(); g.arc(250, 300, 110, 0, 7); g.fill(); g.fillStyle = "#1f3fcc"; g.fillRect(500, 200, 180, 220);
    const objs = [{ label: "كرة حمراء", cx: 250, cy: 300, r: 110, box: [190, 140, 410, 360] }, { label: "علبة زرقاء", box: [200, 500, 420, 680] }];   // ymin,xmin,ymax,xmax بالبكسل
    const calls = []; const maskPng = (o) => { const bw = 1000 * (o.box[3] - o.box[1]) / 800, bh = 1000 * (o.box[2] - o.box[0]) / 600; return null; };
    Object.assign(ImgGen, { ready: () => ({ ok: true }), edit: async o => { calls.push("edit"); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const x = c.getContext("2d"); x.fillStyle = "#777"; x.fillRect(0, 0, o.W, o.H); return { canvas: c, blob: null }; },
      text: async o => {
        calls.push("text"); const P = o.prompt;
        if (/Detect every/.test(P)) return JSON.stringify(objs.map(q => ({ label: q.label, box_2d: [q.box[0] / .6, q.box[1] / .8, q.box[2] / .6, q.box[3] / .8] })));
        if (/main subject/.test(P)) return "```json\n" + JSON.stringify([{ label: "كرة حمراء", box_2d: [objs[0].box[0] / .6, objs[0].box[1] / .8, objs[0].box[2] / .6, objs[0].box[3] / .8] }]) + "\n```";
        const q = objs.find(z => P.includes(z.label)) || objs[0];    // طلب قناع على محيط العنصر: نحتاج إحداثيات الصورة المقصوصة التي لا نراها هنا ← نُعيد قناعاً دائرياً/مربعاً مزاحاً بحسب مربع كامل 0..1000 داخل القطع
        const cw = 1000, ch = 1000, m = document.createElement("canvas"); m.width = 256; m.height = 256; const x = m.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#fff"; x.filter = "blur(2px)";
        // المربع المُعاد = ما يحيط العنصر ضمن القطعة (هامش 10% من أكبر ضلع): نحسبه من الإعداد نفسه
        const bw = q.box[3] - q.box[1], bh = q.box[2] - q.box[0], mg = Math.max(10, Math.round(Math.max(bw, bh) * .1)), rw = bw + 2 * mg, rh = bh + 2 * mg;
        const bx0 = mg / rw * 1000, bx1 = (mg + bw) / rw * 1000, by0 = mg / rh * 1000, by1 = (mg + bh) / rh * 1000;
        if (q.r) { x.beginPath(); x.ellipse(128 + 3, 128 + 3, 125, 125, 0, 0, 7); x.fill(); } else x.fillRect(4 + 3, 4 + 3, 248, 248);      // مزاح ~3px عمداً
        return JSON.stringify([{ box_2d: [by0, bx0, by1, bx1], label: q.label, mask: m.toDataURL("image/png") }]);
      } });
    out.ready = AICapture.ready() && AIBgCut.ready();
    const items = await AICapture.detect(cv, {}); out.det = items.map(i => i.label + ":" + Math.round(i.box.x0) + "," + Math.round(i.box.y0) + "," + Math.round(i.box.x1) + "," + Math.round(i.box.y1));
    const c1 = await AICapture.cutout(cv, items[0], {}), a = c1.canvas.getContext("2d").getImageData(0, 0, c1.canvas.width, c1.canvas.height).data;
    let inside = 0, bad = 0; for (let y = 0; y < c1.canvas.height; y++) for (let x = 0; x < c1.canvas.width; x++) { const i = (y * c1.canvas.width + x) * 4, al = a[i + 3]; if (al > 200) { inside++; if (!(a[i] > 150 && a[i + 1] < 90)) bad++; } }
    out.c1 = { x0: Math.round(c1.x0), y0: Math.round(c1.y0), w: Math.round(c1.w), h: Math.round(c1.h), method: c1.method, inside, bad };
    const c2 = await AICapture.cutout(cv, items[1], {}); out.c2 = { x0: Math.round(c2.x0), y0: Math.round(c2.y0), w: Math.round(c2.w), h: Math.round(c2.h), method: c2.method };
    const part = document.createElement("canvas"); part.width = W; part.height = H; part.getContext("2d").drawImage(cv, 0, 0); const fb = await AICapture.fillBg(part, [c1, c2], {});
    const pd = part.getContext("2d").getImageData(250, 300, 1, 1).data, qd = part.getContext("2d").getImageData(20, 20, 1, 1).data, od = cv.getContext("2d").getImageData(20, 20, 1, 1).data;
    out.fill = { ok: fb, holeGray: pd[0] > 100 && pd[0] < 140 && Math.abs(pd[0] - pd[2]) < 12, outsideSame: qd[0] === od[0] && qd[2] === od[2] };
    const sj = await AIBgCut.subject(cv, {}); const sd = sj.getContext("2d").getImageData(0, 0, W, H).data; const at = (x, y) => sd[(y * W + x) * 4 + 3];
    out.subj = { size: sj.width + "x" + sj.height, center: at(250, 300), corner: at(20, 20), blue: at(580, 300), via: sj._via };
    const rr = await PBBgRemove.autoCut(cv, { allowKey: true, noConfirm: true }); out.auto = { method: rr.method, cov: Math.round(rr.cov * 100) };
    out.calls = calls.join(","); return out;
  }).catch(e => ({ err: String(e && e.stack || e) }));
  console.log(JSON.stringify(r));
  ok(!r.err, "لا أخطاء تنفيذ", r.err); if (r.err) { await b.close(); process.exit(1); }
  ok(r.ready, "الوحدتان جاهزتان عند وجود المفتاح"); ok(r.det.length === 2, "الكشف وجد عنصرين", r.det);
  ok(Math.abs(r.c1.x0 - 140) <= 8 && Math.abs(r.c1.y0 - 190) <= 8 && Math.abs(r.c1.w - 220) <= 12 && r.c1.method === "api", "قصّ الكرة: موضع/حجم صحيحان بقناع الخدمة", r.c1);
  ok(r.c1.inside > 30000 && r.c1.bad / r.c1.inside < .02, "حواف الكرة نظيفة: بكسلات معتمة حمراء فقط رغم إزاحة قناع الخدمة", r.c1);
  ok(r.c2.method === "api" && Math.abs(r.c2.w - 180) <= 12, "قصّ العلبة الزرقاء", r.c2);
  ok(r.fill.ok && r.fill.holeGray && r.fill.outsideSame, "الخلفية تُرمَّم داخل منطقة العنصر فقط والبقية بلا تغيير", r.fill);
  ok(r.subj.size === "800x600" && r.subj.center > 240 && r.subj.corner === 0 && r.subj.blue === 0, "نزع الخلفية: الموضوع فقط بحجم الأصل", r.subj);
  ok(r.auto.method === "seg" && r.auto.cov > 3 && r.auto.cov < 25, "autoCut يختار طريقة الـAPI للخلفية المعقدة", r.auto);
  ok(!errs.length, "لا أخطاء صفحة", errs);
  console.log(n + " نجاح، " + fails.length + " فشل"); await b.close(); process.exit(fails.length ? 1 : 0);
})();
