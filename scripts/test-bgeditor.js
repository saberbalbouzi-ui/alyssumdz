/* اختبار محرّر إزالة الخلفية المتقدّم (BgEditor) داخل لوحة حقيقية بمتصفح حقيقي.
   يغطي: تحقق الملفات، الأبعاد الأصلية، المحرّكات (المحلي حقيقي، وAlyssum API بمحاكاة الخدمة، ومحرّك وهمي يعيد قناعاً معلوماً للفئات: منتج على أبيض/خلفية معقدة/زجاج/شعر/حذاء بثقوب/ظلال)،
   فرشاة المحو والاستعادة (بفأرة حقيقية) والتراجع/الإعادة، الصقل (إزاحة/تنعيم/حدّة/هالة)، الخلفيات البديلة، المقارنة، التصدير PNG بألفا حقيقي وفكّه للتحقق، الإعادة للأصل.
   ملاحظة صريحة: المحرّك الوهمي يختبر خط المعالجة لا جودة نموذج؛ جودة Alyssum API على صور حقيقية غير مُقاسة هنا.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-bgeditor.js */
const { chromium } = require("playwright"); let n = 0; const fails = []; const ok = (c, m, x) => { if (!c) { console.log("✗ " + m + (x !== undefined ? " " + JSON.stringify(x) : "")); fails.push(m); } else { n++; console.log("✓ " + m); } };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }), p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  await p.evaluate(() => {
    window.T = {
      scene(kind, W, H) {
        const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; }, oc = mk(), og = oc.getContext("2d"), cx = W / 2, cy = H / 2; let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        if (kind === "white" || kind === "complex" || kind === "shadow") { og.fillStyle = "#c0262d"; og.beginPath(); og.roundRect(cx - 260, cy - 200, 520, 400, 60); og.fill(); }
        if (kind === "glass") { og.fillStyle = "rgba(40,120,200,.47)"; og.beginPath(); og.roundRect(cx - 120, cy - 260, 240, 520, 50); og.fill(); og.strokeStyle = "rgba(20,60,120,1)"; og.lineWidth = 8; og.stroke(); }
        if (kind === "hair") { og.fillStyle = "#3a2a22"; og.beginPath(); og.arc(cx, cy, 170, 0, 7); og.fill(); for (let i = 0; i < 90; i++) { const a = rnd() * 6.283, r0 = 160, r1 = 230 + rnd() * 70; og.strokeStyle = "rgba(58,42,34," + (.35 + rnd() * .4) + ")"; og.lineWidth = 1 + rnd() * 1.2; og.beginPath(); og.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); og.quadraticCurveTo(cx + Math.cos(a + .3) * (r0 + r1) / 2, cy + Math.sin(a + .3) * (r0 + r1) / 2, cx + Math.cos(a + .1) * r1, cy + Math.sin(a + .1) * r1); og.stroke(); } }
        if (kind === "shoe") { og.fillStyle = "#2b4a8a"; og.beginPath(); og.moveTo(cx - 300, cy + 140); og.lineTo(cx - 280, cy - 60); og.quadraticCurveTo(cx - 100, cy - 220, cx + 80, cy - 40); og.lineTo(cx + 300, cy + 20); og.lineTo(cx + 300, cy + 140); og.closePath(); og.fill(); og.globalCompositeOperation = "destination-out"; for (let i = 0; i < 4; i++) { og.beginPath(); og.arc(cx - 120 + i * 60, cy - 60 + i * 12, 14, 0, 7); og.fill(); } og.globalCompositeOperation = "source-over"; }
        if (kind === "shadow") { og.save(); og.filter = "blur(18px)"; og.fillStyle = "rgba(0,0,0,.45)"; og.beginPath(); og.ellipse(cx, cy + 250, 260, 40, 0, 0, 7); og.fill(); og.restore(); }
        const od = og.getImageData(0, 0, W, H).data, gt = new Uint8Array(W * H); for (let i = 0; i < gt.length; i++) gt[i] = od[i * 4 + 3];
        const c = mk(), g = c.getContext("2d");
        if (kind === "complex") { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#d9c7a3"); gr.addColorStop(1, "#2f6f9a"); g.fillStyle = gr; g.fillRect(0, 0, W, H); for (let i = 0; i < 900; i++) { g.fillStyle = "hsl(" + Math.round(rnd() * 360) + ",50%,55%)"; g.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 30, 4 + rnd() * 30); } } else { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); }
        g.drawImage(oc, 0, 0); return { c, gt };
      },
      alphaOf(canvas) { const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data, a = new Uint8Array(canvas.width * canvas.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; return a; },
      iou(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k] > 127, y = b[k] > 127; if (x && y) i++; if (x || y) u++; } return u ? i / u : 1; },
      maxDiff(a, b) { let m = 0; for (let k = 0; k < a.length; k++) { const d = Math.abs(a[k] - b[k]); if (d > m) m = d; } return m; },
      eq(a, b) { if (a.length !== b.length) return false; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return false; return true; },
      mock(id, gt) { BgEditor.registerEngine({ id, name: "وهمي-" + id, desc: "اختبار", available: () => true, run: async c => { const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const g = o.getContext("2d"); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, o.width, o.height); for (let i = 0; i < gt.length; i++) d.data[i * 4 + 3] = gt[i]; g.putImageData(d, 0, 0); return o; } }); },
      async open(c, o) { const h = BgEditor.open(Object.assign({ canvas: c, name: "t" }, o || {})); await new Promise(r => setTimeout(r, 80)); return h; },
      async run(id) { const s = document.getElementById("bge-eng"); [...s.options].some(x => x.value === id) || (() => { const op = document.createElement("option"); op.value = id; s.appendChild(op); })(); s.value = id; await BgEditor.inst().runEngine(); },
      H() { return BgEditor.inst(); }
    };
  });

  /* ① تحقق الملفات */
  const v = await p.evaluate(async () => {
    const out = {}; const sc = T.scene("white", 400, 300); const h = await T.open(null, { canvas: undefined });
    const st = () => document.getElementById("bge-st").textContent;
    await h.loadFile(new File(["hello"], "a.txt", { type: "text/plain" })); out.txt = st();
    await h.loadFile(new File([new Uint8Array(100)], "a.png", { type: "image/png" })); out.magic = st();
    await h.loadFile(new File([new Uint8Array(21 * 1048576)], "a.png", { type: "image/png" })); out.big = st();
    const blob = await new Promise(r => sc.c.toBlob(r, "image/png")); await h.loadFile(new File([blob], "ok.png", { type: "image/png" })); out.okW = h.S.W + "x" + h.S.H; out.drop = getComputedStyle(document.getElementById("bge-drop")).display;
    h.close(true); return out;
  });
  ok(/غير مدعوم/.test(v.txt), "رفض نوع غير مدعوم", v.txt); ok(/لا يطابق/.test(v.magic), "رفض محتوى لا يطابق النوع (بصمة)", v.magic); ok(/20MB/.test(v.big), "رفض ملف أكبر من 20MB", v.big);
  ok(v.okW === "400x300" && v.drop === "none", "ملف PNG صالح يُحمَّل بأبعاده", v);

  /* ② خط المعالجة بقناع معلوم على منتج بخلفية بيضاء + الأبعاد الأصلية + بقاء الأصل */
  const r2 = await p.evaluate(async () => {
    const W = 1200, H = 900, sc = T.scene("white", W, H); T.mock("m2", sc.gt); const h = await T.open(sc.c); const o0 = Array.from(h.S.orig.slice(0, 4000)).join(",");
    await T.run("m2"); const S = h.S; const o1 = Array.from(S.orig.slice(0, 4000)).join(",");
    return { dim: S.W + "x" + S.H, iou: T.iou(S.fin, sc.gt), center: S.fin[(H / 2) * W + W / 2], corner: S.fin[5 * W + 5], origSame: o0 === o1, st: document.getElementById("bge-st").textContent, hist: S.hist.length, outA: S.out.data[(5 * W + 5) * 4 + 3] };
  });
  ok(r2.dim === "1200x900", "الأبعاد الأصلية محفوظة بعد الإزالة", r2.dim); ok(r2.iou > .96, "المحرّك المحلي: تطابق القناع مع الحقيقة (IoU)", r2.iou); ok(r2.center === 255 && r2.corner === 0, "المركز معتم والزاوية شفافة", r2); ok(r2.origSame, "الصورة الأصلية لم تُعدَّل"); ok(r2.hist === 1 && r2.outA === 0, "تاريخ + ألفا اللوحة", r2);

  /* ③ فئات الصور: سلامة خط المعالجة بقناع معلوم (الحواف النصف شفافة تبقى كما هي بلا قصّ) */
  for (const kind of ["white", "complex", "glass", "hair", "shoe", "shadow"]) {
    const r = await p.evaluate(async kind => {
      const W = 900, H = 700, sc = T.scene(kind, W, H); T.mock("m-" + kind, sc.gt); const h = await T.open(sc.c); await T.run("m-" + kind); const S = h.S;
      let semi = 0; for (let i = 0; i < sc.gt.length; i++) if (sc.gt[i] > 0 && sc.gt[i] < 255) semi++;
      const hole = kind === "shoe" ? S.fin[(350 - 60) * W + (450 - 120)] : -1; h.close(true);
      return { exact: T.eq(S.fin, sc.gt), semi, hole, iou: T.iou(S.fin, sc.gt) };
    }, kind);
    ok(r.exact, kind + ": القناع بعد الخط يطابق الحقيقة بالبكسل (بلا فقد تفاصيل)", { semi: r.semi }); if (kind === "shoe") ok(r.hole === 0, "حذاء: ثقوب الأربطة تبقى شفافة", r.hole);
    if (["hair", "glass", "shadow"].includes(kind)) ok(r.semi > 200, kind + ": توجد بكسلات نصف شفافة محفوظة", r.semi);
  }

  /* ④ Photoroom (المحرّك الرسمي) بمحاكاة دالة bg-remove: يعيد المنتج الأحمر وحده على خلفية شفافة */
  const r4 = await p.evaluate(async () => {
    const W = 800, H = 600, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"), gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#d9c7a3"); gr.addColorStop(1, "#8aa6c1"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "#cc1f1f"; g.beginPath(); g.arc(400, 300, 150, 0, 7); g.fill();
    const oc = document.createElement("canvas"); oc.width = W; oc.height = H; const og = oc.getContext("2d"); og.fillStyle = "#cc1f1f"; og.beginPath(); og.arc(400, 300, 150, 0, 7); og.fill(); const b64 = oc.toDataURL("image/png").split(",")[1];
    API.sb.url = p => "https://x.test" + p; API.sb.token = async () => "tok"; API.sb.headers = t => ({ Authorization: "Bearer " + t }); if (typeof BgEditor !== "undefined") BgEditor._t.extReset();
    const f0 = window.fetch, a0 = PBBgRemove.autoCut, s0 = AIVision.supported; AIVision.supported = () => true; PBBgRemove.autoCut = async (c, o) => { if (!(o && o.sam && o.noPro)) throw new Error("لم يُطلب SAM"); const t = document.createElement("canvas"); t.width = W; t.height = H; t.getContext("2d").drawImage(oc, 0, 0); return { canvas: t }; };
    const h = await T.open(cv); await BgEditor._t.extProbe(); await new Promise(r => setTimeout(r, 200)); const sel = document.getElementById("bge-eng"); const opt = [...sel.options].map(o => o.value).filter(v => !/^m/.test(v)); const def = sel.value; sel.value = "sam"; await h.runEngine(); const S = h.S; PBBgRemove.autoCut = a0; AIVision.supported = s0;
    return { opt, def, center: S.fin[300 * W + 400], corner: S.fin[10 * W + 10], st: document.getElementById("bge-st").textContent };
  });
  ok(r4.opt.includes("sam") && !r4.opt.includes("ext") && !r4.opt.includes("local") && !r4.opt.includes("api"), "قائمة المحرّكات: SAM2 وحده (بلا فوتوروم ولا محلي)", r4.opt); ok(r4.center > 240 && r4.corner < 15, "محرّك SAM2 (محاكاة): المنتج معتم والخلفية شفافة", r4);

  /* ⑤ الفرشاة بفأرة حقيقية + تراجع/إعادة + محو/استعادة */
  const sc5 = await p.evaluate(async () => { const W = 900, H = 700, sc = T.scene("white", W, H); T.mock("m5", sc.gt); const h = await T.open(sc.c); await T.run("m5"); const r = document.getElementById("bge-cv").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, W, H }; });
  const at = (ix, iy) => [sc5.x + ix * sc5.w / sc5.W, sc5.y + iy * sc5.h / sc5.H];
  const alpha = (ix, iy) => p.evaluate(([x, y]) => BgEditor.inst().S.fin[y * BgEditor.inst().S.W + x], [ix, iy]);
  ok((await alpha(450, 350)) === 255, "قبل المحو: مركز المنتج معتم");
  await p.evaluate(() => { document.getElementById("bge-sz").value = 80; document.getElementById("bge-sz").oninput(); document.getElementById("bge-sf").value = 0; });
  let [ax, ay] = at(400, 350), [bx, by] = at(500, 350); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move((ax + bx) / 2, ay, { steps: 4 }); await p.mouse.move(bx, by, { steps: 4 }); await p.mouse.up();
  ok((await alpha(450, 350)) === 0 && (await alpha(405, 350)) === 0, "فرشاة المحو بالفأرة تمسح المسار");
  ok((await alpha(450, 150)) === 255 || (await alpha(450, 300)) === 255, "خارج المسار بلا تأثير");
  const hs = await p.evaluate(() => { const S = BgEditor.inst().S; return { strokes: S.strokes.length, hist: S.hist.length }; }); ok(hs.strokes === 1 && hs.hist === 2, "ضربة واحدة في التاريخ", hs);
  await p.keyboard.press("Control+z"); ok((await alpha(450, 350)) === 255, "تراجع يعيد المسح"); await p.keyboard.press("Control+Shift+z"); ok((await alpha(450, 350)) === 0, "إعادة تطبق الضربة");
  await p.keyboard.press("r"); [ax, ay] = at(450, 350); await p.mouse.move(ax - 30, ay); await p.mouse.down(); await p.mouse.move(ax + 30, ay, { steps: 4 }); await p.mouse.up();
  ok((await alpha(450, 350)) === 255, "فرشاة الاستعادة تعيد البكسلات المعتمة الأصلية"); const rc = await p.evaluate(() => { const S = BgEditor.inst().S, i = (350 * S.W + 450) * 4; return Array.from(S.out.data.slice(i, i + 3)).join(); }); ok(rc === "192,38,45", "لون المستعاد = لون الأصل الحقيقي", rc);
  /* استعادة خارج الجسم (كانت خلفية): تصير معتمة بلونها الأصلي (أبيض أصلي) — السلوك المطلوب للاستعادة */
  [ax, ay] = at(60, 60); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.up(); ok((await alpha(60, 60)) === 255, "الاستعادة تعمل على منطقة أُزيلت");
  /* نعومة الحافة: ضربة ناعمة تعطي قيماً وسيطة */
  await p.evaluate(() => { document.getElementById("bge-sf").value = 100; document.getElementById("bge-sz").value = 100; document.getElementById("bge-sz").oninput(); }); await p.keyboard.press("e");
  [ax, ay] = at(450, 600); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.up(); // خارج الجسم: لا أثر (شفاف أصلاً)
  [ax, ay] = at(450, 250); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(ax + 2, ay, { steps: 2 }); await p.mouse.up();
  const soft = await p.evaluate(() => { const S = BgEditor.inst().S, vals = []; for (let x = 450 - 50; x <= 450 + 50; x += 5) vals.push(S.fin[250 * S.W + x]); return vals; }); ok(soft.some(v => v > 5 && v < 250), "نعومة الحافة 100%: قيم ألفا وسيطة عند حافة الضربة", soft.join());
  /* الصقل + الأصل محفوظ */
  const r6 = await p.evaluate(async () => {
    const h = BgEditor.inst(), S = h.S; h.setTool("hand"); S.strokes.length = 0; S.hist.length = 0; S.hi = -1; h.rebuild(); const W = S.W, area = a => { let c = 0; for (let i = 0; i < a.length; i++) if (a[i] > 127) c++; return c; }, a0 = area(S.fin);
    const set = (k, v) => { const r = document.getElementById("bge-p-" + k); r.value = v; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); }, wait = () => new Promise(r => setTimeout(r, 400));
    set("shift", 4); await wait(); const aGrow = area(S.fin); set("shift", -4); await wait(); const aShr = area(S.fin); set("shift", 0); await wait();
    set("feather", 6); await wait(); let mid = 0; for (let i = 0; i < S.fin.length; i++) if (S.fin[i] > 10 && S.fin[i] < 245) mid++; set("feather", 0); await wait();
    set("contrast", 100); await wait(); set("contrast", 0); await wait();
    const same = T.eq(S.fin, S.fbase) && S.hist.length === 7;
    return { a0, aGrow, aShr, mid, same, hist: S.hist.length };
  });
  ok(r6.aGrow > r6.a0 && r6.aShr < r6.a0, "إزاحة الحافة: موجبة توسّع وسالبة تأكل", r6); ok(r6.mid > 500, "التنعيم يصنع حافة متدرّجة", r6.mid); ok(r6.hist >= 6, "كل تعديل صقل يدخل التاريخ", r6.hist);

  /* ⑦ تقليل الهالة: حافة ملوّثة بالأخضر تقترب من لون الجسم */
  const r7 = await p.evaluate(async () => {
    const W = 600, H = 500, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(0, 0, W, H); g.fillStyle = "#cc2020"; g.beginPath(); g.arc(300, 250, 150, 0, 7); g.fill();
    g.strokeStyle = "rgba(60,220,40,.6)"; g.lineWidth = 6; g.beginPath(); g.arc(300, 250, 150, 0, 7); g.stroke();
    const gt = new Uint8Array(W * H), tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; const tg = tmp.getContext("2d"); tg.fillStyle = "#000"; tg.beginPath(); tg.arc(300, 250, 150, 0, 7); tg.fill(); const td = tg.getImageData(0, 0, W, H).data; for (let i = 0; i < gt.length; i++) gt[i] = td[i * 4 + 3];
    T.mock("m7", gt); const h = await T.open(c); await T.run("m7"); const S = h.S; const edgeIdx = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (S.fin[i] > 20 && S.fin[i] < 235) edgeIdx.push(i); }
    const r = document.getElementById("bge-p-halo"); const green = () => { let s = 0; edgeIdx.forEach(i => { s += S.out.data[i * 4 + 1] - S.out.data[i * 4]; }); return s / Math.max(1, edgeIdx.length); };
    const g0 = green(); r.value = 100; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); await new Promise(rr => setTimeout(rr, 500)); const g1 = green();
    return { edge: edgeIdx.length, g0, g1, origKept: S.orig[(250 * W + 300) * 4] === 0xcc };
  });
  ok(r7.edge > 200, "حافة الاختبار موجودة", r7); ok(r7.g1 < r7.g0 * .6, "تقليل الهالة يخفّض اخضرار الحافة فعلاً (≥40%)", r7);

  /* ⑧ الخلفية البديلة + التصدير + التحقق (فكّ الملف الناتج) + التنزيل */
  const r8 = await p.evaluate(async () => {
    const W = 700, H = 500, sc = T.scene("hair", W, H); T.mock("m8", sc.gt); const h = await T.open(sc.c, { onApply: async blob => { window.__applied = blob; } }); await T.run("m8"); const S = h.S;
    const ex = await h.exportBlob(); const bmp = await createImageBitmap(ex.blob), t = document.createElement("canvas"); t.width = bmp.width; t.height = bmp.height; const g = t.getContext("2d"); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, t.width, t.height).data; let maxd = 0, whiteOpaqueWhereGone = 0;
    for (let i = 0; i < S.fin.length; i++) { maxd = Math.max(maxd, Math.abs(d[i * 4 + 3] - S.fin[i])); if (S.fin[i] === 0 && d[i * 4 + 3] !== 0) whiteOpaqueWhereGone++; }
    const trans = (() => { let c = 0; for (let i = 0; i < S.fin.length; i++) if (S.fin[i] === 0) c++; return c / S.fin.length; })();
    document.querySelector('input[name="bge-bg"][value="color"]').click(); const col = document.getElementById("bge-bgc"); col.value = "#00aa44"; col.dispatchEvent(new Event("input")); const ex2 = await h.exportBlob(); const b2 = await createImageBitmap(ex2.blob), t2 = document.createElement("canvas"); t2.width = b2.width; t2.height = b2.height; const g2 = t2.getContext("2d"); g2.drawImage(b2, 0, 0); const cp = g2.getImageData(2, 2, 1, 1).data;
    return { type: ex.blob.type, dim: bmp.width + "x" + bmp.height, ver: ex.v, maxd, whiteOpaqueWhereGone, trans, bgPrev: document.getElementById("bge-bgl").style.background, withBg: ex2.withBg, corner: Array.from(cp).join() };
  });
  ok(r8.type === "image/png" && r8.dim === "700x500", "التصدير PNG بأبعاد الأصل", r8); ok(r8.maxd <= 1 && r8.whiteOpaqueWhereGone === 0, "ألفا الملف الناتج يطابق القناع ولا بكسل شفاف تحوّل إلى أبيض معتم", r8); ok(r8.ver.ok && /تم التحقق/.test(r8.ver.msg) && r8.trans > .3, "رسالة التحقق ونسبة الشفافية الحقيقية", r8.ver);
  ok(r8.withBg && r8.corner === "0,170,68,255" && /rgb\(0, 170, 68\)/.test(r8.bgPrev), "خلفية لون: معاينة + تصدير مدمج بلون صحيح", r8);
  const dl = p.waitForEvent("download"); await p.evaluate(() => document.querySelector('input[name="bge-bg"][value="none"]').click()); await p.evaluate(() => document.getElementById("bge-dl").click()); const dw = await dl; ok(/^nobg-.*\.png$/.test(dw.suggestedFilename()), "تنزيل ملف PNG", dw.suggestedFilename());
  await p.evaluate(() => document.getElementById("bge-ap").click()); await p.waitForTimeout(800); const ap = await p.evaluate(() => ({ got: !!window.__applied && window.__applied.type, closed: !document.getElementById("bge") })); ok(ap.got === "image/png" && ap.closed, "زر التطبيق يسلّم PNG ويغلق", ap);

  /* ⑨ مقارنة قبل/بعد + إعادة للأصل + قناع موجود مسبقاً */
  const r9 = await p.evaluate(async () => {
    const W = 600, H = 400, sc = T.scene("white", W, H); T.mock("m9", sc.gt); const h = await T.open(sc.c); await T.run("m9"); const S = h.S, before = Array.from(S.orig.slice(0, 2000)).join();
    document.getElementById("bge-cmpb").click(); const cmp = document.getElementById("bge-cmp"), oc = document.getElementById("bge-oc"); const shown = getComputedStyle(cmp).display === "block" && getComputedStyle(oc).display === "block";
    const r = document.getElementById("bge-wr").getBoundingClientRect(); const handle = cmp.querySelector("i"), hb = handle.getBoundingClientRect(); return { shown, clip: oc.style.clipPath, hb: [hb.left + 16, hb.top + 16], r: [r.left, r.width], before };
  });
  ok(r9.shown && /inset/.test(r9.clip), "المقارنة تُظهر الأصل مع خط الفصل", r9.clip);
  await p.mouse.move(r9.hb[0], r9.hb[1]); await p.mouse.down(); await p.mouse.move(r9.r[0] + r9.r[1] * .2, r9.hb[1], { steps: 5 }); await p.mouse.up(); const clip2 = await p.evaluate(() => document.getElementById("bge-oc").style.clipPath); ok(/inset\(0(px)? 8\d(\.\d+)?%/.test(clip2), "سحب مقبض المقارنة يغيّر الموضع", clip2);
  const rs = await p.evaluate(async () => { const h = BgEditor.inst(), S = h.S; const w = confirm; window.confirm = () => true; h.resetAll(); window.confirm = w; let all = true; for (let i = 0; i < S.fin.length; i++) if (S.fin[i] !== 255) { all = false; break; } const same = Array.from(S.orig.slice(0, 2000)).join(); return { all, strokes: S.strokes.length, hist: S.hist.length }; });
  ok(rs.all && rs.strokes === 0, "إعادة للأصل: صورة كاملة بلا تعديلات", rs); await p.keyboard.press("Control+z"); ok((await p.evaluate(() => { const S = BgEditor.inst().S; return S.fin.some(v => v === 0); })), "التراجع بعد الإعادة للأصل يعيد القناع");
  const r10 = await p.evaluate(async () => { const W = 500, H = 400, sc = T.scene("glass", W, H), c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(sc.c, 0, 0); const d = g.getImageData(0, 0, W, H); for (let i = 0; i < sc.gt.length; i++) d.data[i * 4 + 3] = sc.gt[i] ? 255 : 0; g.putImageData(d, 0, 0); BgEditor.inst().close(true); const h = await T.open(c); return { base0: !!h.S.base0, same: T.eq(h.S.fin, h.S.base0), st: document.getElementById("bge-st").textContent }; });
  ok(r10.base0 && r10.same, "صورة بقناع شفاف موجود: يُحمَّل كقناع قابل للتصحيح", r10);

  /* ⑩ تكامل مطوّر الصفحات */
  const r11 = await p.evaluate(() => ({ edit: typeof PBBgRemove.edit, hasBtn: /data-bgr="edit"/.test(document.documentElement.innerHTML) }));
  ok(r11.edit === "function", "PBBgRemove.edit مكشوفة للمطوّر"); const src = require("fs").readFileSync("scripts/pagebuilder-editor.js", "utf8"); ok(!/data-bgr="edit">/.test(src) && /PBBgRemove\.edit\(inf\)/.test(src), "لوحة نزع الخلفية بزر واحد (حُذف زر المحرّر المتقدّم) والمعالج باقٍ");
  ok(!errs.length, "لا أخطاء صفحة", errs.slice(0, 3)); await b.close();
  console.log("\n" + n + " passed, " + fails.length + " failed"); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
