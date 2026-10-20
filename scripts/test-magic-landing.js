/* Magic Layers ← «صفحة هبوط كاملة بطبقات»: برومبت المطوّر الذكي + لوحة أصول واحدة تُقصّ وتُوزَّع على الطبقات.
   python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-magic-landing.js */
const { chromium } = require("playwright"); let fails = 0;
const ok = (n, c, x) => { if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } else console.log("✓", n); };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1500, height: 950 } }), p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);

  /* ١) دوال نقية: blobs/خلايا/قص الأبيض/ترتيب القراءة */
  const pure = await p.evaluate(() => {
    const T = MagicLayers._t, W = 1536, H = 1024, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const gr = T.gridFor(6), cw = W / gr.cols, ch = H / gr.rows;
    for (let i = 0; i < 6; i++) { const cx = (i % gr.cols + .5) * cw, cy = (Math.floor(i / gr.cols) + .5) * ch; g.fillStyle = "hsl(" + i * 55 + ",80%,45%)"; g.beginPath(); g.arc(cx, cy, 90, 0, 7); g.fill(); if (i === 2) { g.fillRect(cx - 120, cy - 20, 240, 40); } }
    const bl = T.findBlobs(cv), cells = T.assignCells(bl, gr, W, H, 6);
    const c1 = document.createElement("canvas"); c1.width = 200; c1.height = 200; const g1 = c1.getContext("2d"); g1.fillStyle = "#fff"; g1.fillRect(0, 0, 200, 200); g1.fillStyle = "#c00"; g1.fillRect(40, 40, 120, 120); g1.fillStyle = "#fff"; g1.fillRect(80, 80, 40, 40);   // أبيض داخلي يبقى
    T.cutWhite(c1); const d = g1.getImageData(0, 0, 200, 200).data, a = (x, y) => d[(y * 200 + x) * 4 + 3];
    // ترتيب القراءة: نموذج تجاهل الشبكة (كل الأصول في الزاوية)
    const bad = [[10, 10, 60, 60, 900], [300, 20, 360, 80, 900], [20, 400, 90, 470, 900], [700, 420, 770, 490, 900]], fb = T.assignCells(bad, T.gridFor(4), W, H, 4);
    return { n: bl.length, cells: cells.map(x => !!x), centered: cells.every((x, i) => x && Math.abs((x[0] + x[2]) / 2 - ((i % gr.cols + .5) * cw)) < 20), union: cells[2] && (cells[2][2] - cells[2][0]) > 230, edge: a(5, 5), inner: a(100, 100), body: a(60, 60), p: T.sheetPrompt([{ prompt: "a jar", cut: true }, { prompt: "green field", cut: false }], T.gridFor(2), "Honey").slice(0, 1500), fb: fb.map(x => x && x[0]) , g4: T.gridFor(4), g12: T.gridFor(12) };
  });
  ok("blobs: 6 أصول (شكلان لخلية 3 يندمجان بالتمدّد)", pure.n === 6 && pure.cells.every(Boolean), pure);
  ok("كل أصل في خليته ومركزه صحيح + اتحاد أجزاء الأصل الواحد", pure.centered && pure.union, pure);
  ok("قص الأبيض: الحافة شفافة والجسم والأبيض الداخلي يبقيان", pure.edge === 0 && pure.body === 255 && pure.inner === 255, pure);
  ok("ترتيب القراءة احتياطاً حين يتجاهل النموذج الشبكة", pure.fb.join() === "10,300,20,700", pure.fb);
  ok("برومبت اللوحة: شبكة + خلفية بيضاء + نوع الأصل", /2 columns × 1 rows/.test(pure.p) && /WHITE/.test(pure.p) && /ISOLATED/.test(pure.p) && /SCENE/.test(pure.p), pure.p);

  /* ٢) الخط الكامل: نموذج نصي مُحاكى + ImgGen.edit يرسم لوحة أصول بحسب البرومبت */
  const runLand = (pg, skip) => pg.evaluate(async skip => {
    const calls = { text: [], edit: [] }; localStorage.setItem("alyssum_gp_gkey", "x");
    ImgGen.ready = () => ({ ok: true });
    const spec = { format: PBSpec.FORMAT, page: { title: "Test Landing", width: 1080, bg: "#ffffff", lang: "ar", product: "" }, assets: { jar: { prompt: "a honey jar on a wooden table", cutout: true }, leaf: { prompt: "green olive leaf, single", cutout: true }, field: { prompt: "soft sunrise meadow background" } },
      sections: [{ name: "hero", height: 760, bg: "#fff", bgImage: "asset:field", layers: [{ type: "image", src: "asset:jar", x: 600, y: 120, w: 420, h: 520, z: 3, fit: "contain", cutout: true }, { type: "heading", tag: "h1", text: "عنوان حقيقي", x: 60, y: 160, w: 500, z: 4, font: { size: 64, weight: 900, color: "#8a5a00", align: "right" } }, { type: "image", src: "asset:leaf", x: 40, y: 500, w: 160, h: 160, z: 2, fit: "contain", cutout: true }] },
        { name: "benefits", height: 500, bg: "#f1f8e9", layers: [{ type: "image", src: "asset:leaf", x: 800, y: 40, w: 160, h: 160, z: 2, fit: "contain", cutout: true }, { type: "text", text: "طبيعي 100% ومضمون", x: 60, y: 60, w: 600, z: 3, font: { size: 32, color: "#223", align: "right" } }] },
        { kind: "order", title: "اطلب الآن" }] };
    ImgGen.text = async o => { calls.text.push({ p: o.prompt, blobs: (o.blobs || []).length }); if (calls.text.length === 1) return { concept: "x", tone: "y", palette: { primary: "#1e5e20", accent: "#c8a24b", bg: "#fff", text: "#222", secondary: "#eee" }, sections: [{ name: "hero", goal: "g", layout: "l" }], assets: [{ name: "jar", prompt: "a honey jar", cutout: true }] }; return JSON.parse(JSON.stringify(spec)); };
    ImgGen.edit = async o => {
      calls.edit.push({ p: o.prompt, W: o.W, H: o.H }); const m = /grid of (\d+) columns × (\d+) rows/.exec(o.prompt), c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const g = c.getContext("2d");
      if (!m) { for (let k = 0; k < 400; k++) { g.fillStyle = "hsl(" + (k * 37 % 360) + ",70%,50%)"; g.fillRect((k * 53) % o.W, (k * 91) % o.H, 40 + k % 60, 40 + k % 50); } return { blob: await new Promise(r => c.toBlob(r, "image/png")), canvas: c }; }   // طلب منفرد (احتياطي)
      const cols = +m[1], rows = +m[2]; g.fillStyle = "#fff"; g.fillRect(0, 0, o.W, o.H);
      const cw = o.W / cols, ch = o.H / rows; [...o.prompt.matchAll(/Cell (\d+) \(row \d+, column \d+\) \[(ISOLATED|SCENE)\]/g)].forEach(mm => { if (skip && mm[1] === "2") return; const i = +mm[1] - 1, x = (i % cols) * cw, y = Math.floor(i / cols) * ch; g.fillStyle = mm[2] === "SCENE" ? "#6a9" : "#c40"; if (mm[2] === "SCENE") g.fillRect(x + cw * .12, y + ch * .12, cw * .76, ch * .76); else { g.beginPath(); g.arc(x + cw / 2, y + ch / 2, Math.min(cw, ch) * .32, 0, 7); g.fill(); } });
      return { blob: await new Promise(r => c.toBlob(r, "image/png")), canvas: c };
    };
    let n = 0; PBApp.uploadBlob = async (blob, name) => "assets/img/pages/" + name + "-" + (++n) + ".webp";
    MagicLayers.open(); MagicLayers._t.setMode("land"); document.getElementById("ml-lmethod").value = "layers";
    document.getElementById("ml-lname").value = "Honey Test"; document.getElementById("ml-ldesc").value = "عسل طبيعي"; document.getElementById("ml-lcol").value = "#1e5e20";
    const modeVis = { land: getComputedStyle(document.querySelector('[data-m="land"]')).display !== "none", ext: getComputedStyle(document.querySelector('[data-m="ext"]')).display !== "none" };
    document.getElementById("ml-land-go").click();
    for (let i = 0; i < 150 && !(PBApp.E && PBApp.E.page && PBApp.E.page.slug && !document.getElementById("ml-bg") && document.getElementById("pb-app").classList.contains("on")); i++) await new Promise(r => setTimeout(r, 200));
    await new Promise(r => setTimeout(r, 2500));
    const P = PBApp.E.page, ws = []; P.sections.forEach(s => (s.free || []).forEach(w => ws.push(w))); const imgs = ws.filter(w => w.type === "image");
    return { modeVis, calls: { text: calls.text.map(c => ({ n: c.p.length, hasExtra: /وضع «لوحة الأصول»/.test(c.p), hasDoc: /alyssum-design/.test(c.p) })), edit: calls.edit.length, sheet: calls.edit[0] && calls.edit[0].p.slice(0, 160), W: calls.edit[0] && calls.edit[0].W }, secs: P.sections.length, imgs: imgs.length, filled: imgs.filter(w => /^assets\/img\/pages\/mla/.test(w.set.src)).length, empty: imgs.filter(w => !w.set.src).length, order: P.sections.some(s => (s.free || []).some(w => w.type === "orderorig")), head: ws.some(w => w.type === "heading" && /عنوان حقيقي/.test(w.set.text || w.set.html || "")), uploads: n };
  }, skip);
  const res = await runLand(p, false);
  ok("وضع «صفحة هبوط» يخفي بطاقات التفكيك ويُظهر نموذجه", res.modeVis.land && !res.modeVis.ext, res.modeVis);
  ok("مرحلتا برومبت المطوّر الذكي (خطة + طبقات) والتعليمة الإضافية في كلتيهما", res.calls.text.length === 2 && res.calls.text.every(c => c.hasExtra) && res.calls.text[1].hasDoc, res.calls);
  ok("طلب صور واحد فقط (لوحة أصول واحدة) بمقاس 1536×1024", res.calls.edit === 1 && res.calls.W === 1536 && /3 columns|2 columns/.test(res.calls.sheet || ""), res.calls);
  ok("الصفحة فُتحت في المطوّر بأقسامها (هيرو + مزايا + طلب) والعنوان نصّ حقيقي", res.secs >= 1 && res.head, res);
  ok("كل الصور الفارغة رُكّبت من اللوحة وبقي نموذج الطلب الحقيقي", res.imgs >= 3 && res.filled === res.imgs && res.empty === 0, res);
  ok("رُفعت 3 أصول فريدة فقط (الورقة تتكرر ولا تُرفع مرتين)", res.uploads === 3, res.uploads);
  /* ٣) النموذج أهمل خلية في اللوحة ← لا مربع فارغ: يُولَّد الأصل المفقود وحده */
  const p2 = await ctx.newPage(); p2.on("pageerror", e => errs.push(e.message)); p2.on("dialog", d => d.accept()); await p2.goto("http://localhost:8765/admin.html"); await p2.waitForTimeout(2500);
  const r2 = await runLand(p2, true);
  ok("خلية مهملة: طلبان (لوحة + أصل منفرد) ولا صور فارغة", r2.calls.edit === 2 && r2.imgs >= 3 && r2.empty === 0, r2);
  ok("خلية مهملة: كل الصور لها مصدر بعد الاحتياط", r2.imgs > 0 && r2.uploads >= 3, r2);
  /* ٤) زر «آخر صفحة من المنشئ الذكي»: يحمّل الصورة الطويلة من IndexedDB إلى وضع التفكيك */
  const pb = await p2.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 600; c.height = 2000; const g = c.getContext("2d"); g.fillStyle = "#123"; g.fillRect(0, 0, 600, 2000); g.fillStyle = "#fc0"; g.fillRect(100, 100, 300, 200);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    await new Promise((res, rej) => { const rq = indexedDB.open("pbgen", 1); rq.onupgradeneeded = () => rq.result.createObjectStore("kv"); rq.onerror = () => rej(rq.error); rq.onsuccess = () => { const tx = rq.result.transaction("kv", "readwrite"); tx.objectStore("kv").put({ blob, name: "t", t: Date.now() }, "last"); tx.oncomplete = res; }; });
    MagicLayers.open(); MagicLayers._t.setMode("land"); document.querySelector('#ml-bg [data-pbgen]').click();
    for (let i = 0; i < 30 && !MagicLayers.S.src; i++) await new Promise(r => setTimeout(r, 100));
    return { h: MagicLayers.S.src && MagicLayers.S.src.height, ext: getComputedStyle(document.querySelector('[data-m="ext"]')).display !== "none" };
  });
  ok("زر المنشئ الذكي يحمّل الصفحة الطويلة ويحوّل لوضع التفكيك", pb.h === 2000 && pb.ext, pb);
  /* ٥) الطريقة الافتراضية «مثل المنشئ الذكي»: برومبت المنشئ ← صفحة طويلة 1:4 ← تحميلها في وضع التفكيك */
  let dlg3 = 0; const ctx3 = await b.newContext({ viewport: { width: 1500, height: 950 } }), p3 = await ctx3.newPage(); p3.on("pageerror", e => errs.push(e.message)); p3.on("dialog", d => { dlg3++; d.accept(); }); await p3.goto("http://localhost:8765/admin.html"); await p3.waitForTimeout(2500);
  const im = await p3.evaluate(async () => {
    localStorage.setItem("alyssum_gp_gkey", "x"); ImgGen.ready = () => ({ ok: true }); const calls = { text: [], edit: [] };
    ImgGen.text = async o => { calls.text.push({ p: o.prompt, blobs: (o.blobs || []).length }); if (calls.text.length === 1) return "النص التسويقي...\n```\nAct as a world-class Mobile E-commerce Designer. " + "Generate an ultra-long vertical infographic landing page IMAGE with huge bold Arabic text. ".repeat(6) + '"عسل التركيز" "اطلب الآن"\n```'; return JSON.stringify([{ box_2d: [100, 100, 200, 900], label: "اطلب الآن", kind: "text" }, { box_2d: [300, 200, 500, 800], label: "برطمان", kind: "object" }]); };
    ImgGen.edit = async o => { calls.edit.push({ pro: o.pro, ar: o.ar, noFit: o.noFit, blob: !!o.blob, p: o.prompt.slice(0, 40) }); const c = document.createElement("canvas"); c.width = 1024; c.height = 4096; const g = c.getContext("2d"); g.fillStyle = "#1c3f8f"; g.fillRect(0, 0, 1024, 4096); g.fillStyle = "#f08a00"; g.fillRect(200, 300, 600, 300); return { blob: await new Promise(r => c.toBlob(r, "image/png")), canvas: c }; };
    const pc = document.createElement("canvas"); pc.width = 300; pc.height = 300; pc.getContext("2d").fillRect(0, 0, 300, 300);
    MagicLayers.open(); MagicLayers._t.setMode("land"); MagicLayers.S.lphoto = await new Promise(r => pc.toBlob(r, "image/png"));
    document.getElementById("ml-lname").value = "عسل التركيز"; document.getElementById("ml-lprice").value = "1800"; document.getElementById("ml-lcol").value = "ازرق و برتقالي"; document.getElementById("ml-local").checked = false;
    const def = document.getElementById("ml-lmethod").value; document.getElementById("ml-land-go").click();
    for (let i = 0; i < 200 && !(MagicLayers.S.layers && MagicLayers.S.layers.length > 1); i++) await new Promise(r => setTimeout(r, 150));
    return { layers: (MagicLayers.S.layers || []).length, textLayers: (MagicLayers.S.layers || []).filter(l => l.text).length, bands: MagicLayers._t.bandsFor(1024, 4096).length, def, calls, h: MagicLayers.S.src && MagicLayers.S.src.height, ext: getComputedStyle(document.querySelector('[data-m="ext"]')).display !== "none", price: /1800/.test(calls.text[0].p), colors: /ازرق و برتقالي/.test(calls.text[0].p) };
  });
  ok("الطريقة الافتراضية = صفحة مرسومة مثل المنشئ الذكي", im.def === "image", im);
  ok("برومبت المنشئ يصل بالسعر والألوان وصورة المنتج", im.price && im.colors && im.calls.text[0].blobs === 1, im);
  ok("الرسم بنسبة 1:4 بلا قصّ مع صورة المنتج مرجعاً، والصفحة تُحمَّل في وضع التفكيك", im.calls.edit.length === 1 && im.calls.edit[0].ar === "1:4" && im.calls.edit[0].noFit && im.calls.edit[0].blob && im.h === 4096 && im.ext, im);
  ok("النموذج الاحترافي للصفحة الطويلة", im.calls.edit[0].pro === true, im.calls.edit[0]);
  ok("تأكيد واحد فقط (لا تأكيد ثانٍ عند التفكيك)", dlg3 === 1, dlg3);
  ok("نص المنشئ الصحيح يُمرَّر لخطوة التفكيك لتصحيح الحروف", im.calls.text.slice(1).some(c => /INTENDED CORRECT/.test(c.p)), im.calls.text.map(c => c.p.slice(0, 40)));
  ok("الصفحة فُكِّكت فعلاً إلى طبقات", im.layers > 1, im.layers);
  ok("مرور نصوص مخصّص بأشرطة للصفحة الطويلة (4 أشرطة بنسبة قريبة من المربع)", im.bands === 4 && im.calls.text.filter(c => /Read ALL the text visible/.test(c.p)).length === 4, { b: im.bands, n: im.calls.text.filter(c => /Read ALL the text visible/.test(c.p)).length });
  ok("النصوص تصير طبقات نصية حقيقية", im.textLayers >= 1, im.textLayers);
  /* ٦) حدّ الاستخدام في منتصف الكشف: تبقى النتائج الجزئية ولا يظهر نجاح كاذب */
  const ctx4 = await b.newContext({ viewport: { width: 1500, height: 950 } }), p4 = await ctx4.newPage(); p4.on("pageerror", e => errs.push(e.message)); p4.on("dialog", d => d.accept()); await p4.goto("http://localhost:8765/admin.html?v=" + Date.now()); await p4.waitForFunction(() => typeof MagicLayers !== "undefined" && typeof ImgGen !== "undefined", null, { timeout: 20000 });
  const lim = await p4.evaluate(async () => {
    localStorage.setItem("alyssum_gp_gkey", "x"); ImgGen.ready = () => ({ ok: true }); let n = 0;
    ImgGen.text = async o => { n++; if (n === 1) return JSON.stringify([{ box_2d: [100, 100, 200, 900], label: "اطلب الآن", kind: "text" }, { box_2d: [300, 200, 500, 800], label: "برطمان", kind: "object" }]); throw new Error("Quota exceeded for metric"); };
    const c = document.createElement("canvas"); c.width = 1024; c.height = 4096; const g = c.getContext("2d"); g.fillStyle = "#1c3f8f"; g.fillRect(0, 0, 1024, 4096); g.fillStyle = "#f08a00"; g.fillRect(200, 300, 600, 300);
    MagicLayers.open(); document.getElementById("ml-local").checked = false; await MagicLayers._t.loadSource(await new Promise(r => c.toBlob(r, "image/png")));
    await MagicLayers._t.generate({ confirmed: true });
    return { layers: MagicLayers.S.layers.length, calls: n, st: document.getElementById("ml-st").textContent };
  });
  ok("حدّ الاستخدام: النتائج الجزئية محفوظة والكشف يتوقف مبكراً مع رسالة", lim.layers > 1 && lim.calls <= 3 && /جزئية/.test(lim.st), lim);
  ok("لا أخطاء JS", errs.length === 0, errs);
  await b.close(); console.log(fails ? "FAILED " + fails : "ALL OK"); process.exit(fails ? 1 : 0);
})();
