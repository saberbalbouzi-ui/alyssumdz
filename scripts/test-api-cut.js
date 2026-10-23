/* اختبار «التقاط العناصر» عبر Alyssum API (وحدة AICapture) بمحاكاة الخدمة:
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
    const REALTEXT = ImgGen.text;
    Object.assign(ImgGen, { ready: () => ({ ok: true }), edit: async o => { calls.push("edit"); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const x = c.getContext("2d"); x.fillStyle = "#777"; x.fillRect(0, 0, o.W, o.H); return { canvas: c, blob: null }; },
      text: async o => {
        calls.push("text"); const P = o.prompt;
        const fullBox = q => [q.box[0] / .6, q.box[1] / .8, q.box[2] / .6, q.box[3] / .8], mkMask = q => { const m = document.createElement("canvas"); m.width = 256; m.height = 256; const x = m.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#fff"; x.filter = "blur(2px)"; if (q.r) { x.beginPath(); x.ellipse(128 + 3, 128 + 3, 125, 125, 0, 0, 7); x.fill(); } else x.fillRect(4 + 3, 4 + 3, 248, 248); return m.toDataURL("image/png"); };
        if (/Segment every distinct/.test(P)) return JSON.stringify(objs.map(q => ({ label: q.label, box_2d: fullBox(q), mask: mkMask(q) })));
        if (/one-click background removal|Remove the background of this photo: segment/i.test(P)) return "```json\n" + JSON.stringify([{ label: "كرة حمراء", box_2d: fullBox(objs[0]), mask: mkMask(objs[0]) }]) + "\n```";
        const q = objs.find(z => P.includes(z.label)) || objs[0];    // طلب قناع على محيط العنصر: نحتاج إحداثيات الصورة المقصوصة التي لا نراها هنا ← نُعيد قناعاً دائرياً/مربعاً مزاحاً بحسب مربع كامل 0..1000 داخل القطع
        const cw = 1000, ch = 1000, m = document.createElement("canvas"); m.width = 256; m.height = 256; const x = m.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#fff"; x.filter = "blur(2px)";
        // المربع المُعاد = ما يحيط العنصر ضمن القطعة (هامش 10% من أكبر ضلع): نحسبه من الإعداد نفسه
        const bw = q.box[3] - q.box[1], bh = q.box[2] - q.box[0], mg = Math.max(10, Math.round(Math.max(bw, bh) * .1)), rw = bw + 2 * mg, rh = bh + 2 * mg;
        const bx0 = mg / rw * 1000, bx1 = (mg + bw) / rw * 1000, by0 = mg / rh * 1000, by1 = (mg + bh) / rh * 1000;
        if (q.r) { x.beginPath(); x.ellipse(128 + 3, 128 + 3, 125, 125, 0, 0, 7); x.fill(); } else x.fillRect(4 + 3, 4 + 3, 248, 248);      // مزاح ~3px عمداً
        return JSON.stringify([{ box_2d: [by0, bx0, by1, bx1], label: q.label, mask: m.toDataURL("image/png") }]);
      } });
    out.ready = AICapture.ready();
    const t0 = calls.length; const items = await AICapture.detectAll(cv, {}); out.detCalls = calls.length - t0; out.det = items.map(i => i.label + ":" + Math.round(i.box.x0) + "," + Math.round(i.box.y0) + "," + Math.round(i.box.x1) + "," + Math.round(i.box.y1));
    const proReal = PBBgRemove.proCut; PBBgRemove.proCut = undefined;      // المسار القديم (قناع الكشف) أولاً؛ مسار Photoroom يُختبر بعده
    const c1 = await AICapture.cutout(cv, items[0], {}), a = c1.canvas.getContext("2d").getImageData(0, 0, c1.canvas.width, c1.canvas.height).data;
    let inside = 0, bad = 0; for (let y = 0; y < c1.canvas.height; y++) for (let x = 0; x < c1.canvas.width; x++) { const i = (y * c1.canvas.width + x) * 4, al = a[i + 3]; if (al > 200) { inside++; if (!(a[i] > 150 && a[i + 1] < 90)) bad++; } }
    out.c1 = { x0: Math.round(c1.x0), y0: Math.round(c1.y0), w: Math.round(c1.w), h: Math.round(c1.h), method: c1.method, inside, bad };
    const c2 = await AICapture.cutout(cv, items[1], {}); out.c2 = { x0: Math.round(c2.x0), y0: Math.round(c2.y0), w: Math.round(c2.w), h: Math.round(c2.h), method: c2.method };
    PBBgRemove.proCut = async src => { const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.beginPath(); g.arc(src.width / 2, src.height / 2, Math.min(src.width, src.height) * .36, 0, 7); g.fill(); return c; };
    { const pc = await AICapture.cutout(cv, items[0], {}); out.pro = { method: pc.method, w: Math.round(pc.w), h: Math.round(pc.h), x0: Math.round(pc.x0) }; }
    PBBgRemove.proCut = undefined;
    const part = document.createElement("canvas"); part.width = W; part.height = H; part.getContext("2d").drawImage(cv, 0, 0); const fb = await AICapture.fillBg(part, [c1, c2], {});
    const pd = part.getContext("2d").getImageData(250, 300, 1, 1).data, qd = part.getContext("2d").getImageData(20, 20, 1, 1).data, od = cv.getContext("2d").getImageData(20, 20, 1, 1).data;
    out.fill = { ok: fb, holeGray: pd[0] > 100 && pd[0] < 140 && Math.abs(pd[0] - pd[2]) < 12, outsideSame: qd[0] === od[0] && qd[2] === od[2] };
    { const p2 = document.createElement("canvas"); p2.width = W; p2.height = H; p2.getContext("2d").drawImage(cv, 0, 0); const ok2 = await AICapture.localFill(p2, [c1, c2]); const a = p2.getContext("2d").getImageData(250, 300, 1, 1).data, b = cv.getContext("2d").getImageData(250, 300, 1, 1).data, q = p2.getContext("2d").getImageData(20, 20, 1, 1).data, o0 = cv.getContext("2d").getImageData(20, 20, 1, 1).data;
      out.localFill = { ok: ok2, holeGray: a[0] > 90 && a[0] < 150 && Math.abs(a[0] - a[2]) < 25, outsideSame: q[0] === o0[0] && q[2] === o0[2] }; }
    { const mkc = (w, h, f) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#c00"; f(g, w, h); return c; };
      const big = { canvas: mkc(400, 400, (g, w, h) => g.fillRect(0, 0, w, h)), x0: 100, y0: 100, w: 400, h: 400 }, sm = { canvas: mkc(100, 100, (g, w, h) => g.fillRect(0, 0, w, h)), x0: 250, y0: 250, w: 100, h: 100 }, far = { canvas: mkc(50, 50, (g, w, h) => g.fillRect(0, 0, w, h)), x0: 700, y0: 700, w: 50, h: 50 };
      const n = AICapture.separate([big, sm, far]); const gi = big.canvas.getContext("2d").getImageData(0, 0, 400, 400).data, at = (x, y) => gi[(y * 400 + x) * 4 + 3];
      out.sep = { n, holeCleared: at(200, 200) === 0, restKept: at(20, 20) === 255 && at(380, 380) === 255, smallKept: sm.canvas.getContext("2d").getImageData(50, 50, 1, 1).data[3] === 255 }; }
    const orig = ImgGen.text;
    /* الالتقاط: فشل بطلب واحد وسبب واضح بلا إعادة */
    { let cnt = 0, msg = ""; ImgGen.text = async o => { cnt++; return "[]"; }; await AICapture.detectAll(cv, {}).catch(e => { msg = String(e.message); }); out.capFail = { cnt, msg }; ImgGen.text = orig; }
    /* ImgGen.text للتقاط/النزع: بلا تفكير (thinkingBudget 0)، نموذجان فقط، ومهلة بخطأ واضح */
    { const bodies = []; ImgGen.text = REALTEXT; let mode = "empty"; localStorage.setItem("alyssum_gp_gkey", "k-test"); const f0 = window.fetch;
      window.fetch = async (u, init) => { u = String(u); if (/generateContent/.test(u)) { bodies.push(JSON.parse(init.body)); if (mode === "hang") return new Promise((_, rej) => init.signal && init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "" }] } }] }), { status: 200 }); } return new Response(JSON.stringify({ models: [{ name: "models/gemini-flash-latest", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 }); };
      const blob = await new Promise(r => cv.toBlob(r, "image/png")); let e1 = ""; await ImgGen.text({ prompt: "x", blobs: [blob], noThink: true, maxModels: 2, mime: true }).catch(e => { e1 = String(e.message); });
      out.think = { n: bodies.length, budget0: bodies.every(b => b.generationConfig.thinkingConfig && b.generationConfig.thinkingConfig.thinkingBudget === 0), e1 };
      mode = "hang"; bodies.length = 0; let e2 = ""; const t0 = Date.now(); await ImgGen.text({ prompt: "x", blobs: [blob], noThink: true, maxModels: 1, timeoutMs: 400 }).catch(e => { e2 = String(e.message) + "|" + e.name; }); out.timeout = { e2, ms: Date.now() - t0 };
      /* خيار models: يُقدَّم على القائمة بلا خطأ (كان يرمي «Assignment to constant variable» حين queue const) */
      mode = "empty"; bodies.length = 0; let e3 = ""; await ImgGen.text({ prompt: "x", blobs: [blob], models: ["gemini-2.5-flash"], maxModels: 3, mime: true }).catch(e => { e3 = String(e.message); }); out.pref = { e3, first: bodies[0] ? bodies[0].generationConfig && true : false, n: bodies.length };
      window.fetch = f0; ImgGen.text = orig; }
    /* مضلّع بدل قناع PNG (v1.89.462): الدائرة كمضلّع بـ72 نقطة مزاح 3px، ثم ردّ مقطوع/متدهور */
    { const circ = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [Math.round((cy + 3 + Math.sin(a) * r) / .6), Math.round((cx + 3 + Math.cos(a) * r) / .8)]; });
      const bx = [190 / .6, 140 / .8, 410 / .6, 360 / .8]; let reply = "";
      ImgGen.text = async o => { out.polyMax = o.maxTokens; return reply; };
      reply = JSON.stringify([{ label: "كرة", box_2d: bx, polygon: circ(250, 300, 110, 72) }]);
      const cit = await AICapture.detectAll(cv, {}); out.polyCap = cit.length;
      reply = JSON.stringify(objs.map(q => ({ label: q.label, polygon: q.r ? circ(q.cx, q.cy, q.r, 72) : [[200 / .6, 500 / .8], [200 / .6, 680 / .8], [420 / .6, 680 / .8], [420 / .6, 500 / .8], [310 / .6, 500 / .8], [250 / .6, 500 / .8], [200 / .6, 590 / .8], [300 / .6, 680 / .8]] })));
      const cit2 = await AICapture.detectAll(cv, {}); out.polyNoBox = cit2.length; const c3 = await AICapture.cutout(cv, cit2[0], {}); out.polyCut = { method: c3.method, w: Math.round(c3.w) };
      ImgGen.text = orig; }
    /* تقرير صاحب المتجر (v1.89.464): مربع دقيق + قناع PNG وهمي بحجم 10×10 ← يُرفض القناع ويُستعمل المربع مرجعاً للفصل (لا فشل) */
    { const fake = document.createElement("canvas"); fake.width = 10; fake.height = 10; const fx = fake.getContext("2d"); fx.fillStyle = "#fff"; fx.fillRect(0, 0, 10, 10); const tiny = fake.toDataURL("image/png").split(",")[1];
      ImgGen.text = async () => JSON.stringify([{ label: "كرة", box_2d: [190 / .6, 140 / .8, 410 / .6, 360 / .8], mask: tiny }]);
      const bci = await AICapture.detectAll(cv, {}); const bcu = await AICapture.cutout(cv, bci[0], {}); out.boxCap = { n: bci.length, boxOnly: !!bci[0].boxOnly, method: bcu.method, w: Math.round(bcu.w), h: Math.round(bcu.h) };
      /* تقرير صاحب المتجر (v1.89.470): ردّ مقطوع في منتصف قناع base64 مختلَق (لا كائن مكتمل) والمربع صحيح ← يُنقذ المربع ويُفصل الموضوع */
      ImgGen.text = async () => '[\n  {"box_2d": [' + [190 / .6, 140 / .8, 410 / .6, 360 / .8].join(", ") + '], "label": "كرة", "mask": "iVBORw0KGgoAAAANSUhEUgAAAlgAAAJYCAYAAAC+ZArnAAAAB' + "/v0/+3u/84//zHf/1f/2X/sv".repeat(60);
      const tci = await AICapture.detectAll(cv, {}).catch(e => []); out.truncCap = { n: tci.length, boxOnly: tci[0] && !!tci[0].boxOnly };
      ImgGen.text = orig; }
    out.calls = calls.join(","); return out;
  }).catch(e => ({ err: String(e && e.stack || e) }));
  console.log(JSON.stringify(r));
  ok(!r.err, "لا أخطاء تنفيذ", r.err); if (r.err) { await b.close(); process.exit(1); }
  ok(r.ready, "الوحدتان جاهزتان عند وجود المفتاح"); ok(r.det.length === 2 && r.detCalls === 1, "الكشف وجد عنصرين وأقنعتهما بطلب واحد", [r.det, r.detCalls]);
  ok(Math.abs(r.c1.x0 - 140) <= 8 && Math.abs(r.c1.y0 - 190) <= 8 && Math.abs(r.c1.w - 220) <= 12 && r.c1.method === "api", "قصّ الكرة: موضع/حجم صحيحان بقناع الخدمة", r.c1);
  ok(r.c1.inside > 30000 && r.c1.bad / r.c1.inside < .02, "حواف الكرة نظيفة: بكسلات معتمة حمراء فقط رغم إزاحة قناع الخدمة", r.c1);
  ok(r.pro.method === "photoroom" && r.pro.w > 100 && r.pro.w < 260, "قصّ العنصر بـPhotoroom على مقطعه (ألفا الخدمة)", r.pro);
  ok(r.c2.method === "api" && Math.abs(r.c2.w - 180) <= 12, "قصّ العلبة الزرقاء", r.c2);
  ok(r.sep.n === 1 && r.sep.holeCleared && r.sep.restKept && r.sep.smallKept, "العنصر الأصغر يُفصل من الأكبر المتداخل ولا يمسّ البعيد", r.sep);
  ok(r.localFill.ok && r.localFill.holeGray && r.localFill.outsideSame, "الملء المحلي الاحتياطي يمحو العنصر من الخلفية دون المساس بما خارجه", r.localFill);
  ok(r.fill.ok && r.fill.holeGray && r.fill.outsideSame, "الخلفية تُرمَّم داخل منطقة العنصر فقط والبقية بلا تغيير", r.fill);
  ok(r.think.n === 2 && r.think.budget0, "طلب التقاط/نزع: بلا تفكير (thinkingBudget=0) وبنموذجين على الأكثر", r.think);
  ok(/انتهت مهلة/.test(r.timeout.e2) && r.timeout.ms < 3000, "المهلة تُنتج رسالة واضحة لا «signal is aborted»", r.timeout);
  ok(r.capFail.cnt === 1 && /لم تُرجِع الخدمة/.test(r.capFail.msg), "عند الفشل: طلب واحد فقط وسبب واضح (نزع الخلفية والالتقاط) بلا إعادة", [r.oneFail, r.capFail]);
  ok(r.polyMax <= 8192, "طلب المضلّع: سقف توكن أصغر (يفشل سريعاً عند التدهور)", r.polyMax);
  ok(!/constant/i.test(r.pref.e3) && r.pref.n >= 1, "ImgGen.text الحقيقي مع models المفضّلة لا يرمي خطأ إسناد", r.pref);
  ok(r.boxCap.n === 1 && r.boxCap.boxOnly && r.boxCap.method === "box" && Math.abs(r.boxCap.w - 220) <= 24, "الالتقاط: عنصر بقناع وهمي لا يُسقط بل يُقصّ من مربعه", r.boxCap);
  ok(r.polyCap === 1 && r.polyNoBox === 2 && r.polyCut.method === "api" && Math.abs(r.polyCut.w - 220) <= 14, "الالتقاط بمضلّع (ومربع مشتق من المضلّع إن غاب)", [r.polyCap, r.polyNoBox, r.polyCut]);
  ok(!errs.length, "لا أخطاء صفحة", errs);
  console.log(n + " نجاح، " + fails.length + " فشل"); await b.close(); process.exit(fails.length ? 1 : 0);
})();
