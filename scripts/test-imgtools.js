/* اختبار أدوات الصور الجديدة (لمسات وتصحيح + توسيع الخلفية + تعديل بالوصف) على Canvas حقيقي في Chromium بلا خادم ولا API:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-imgtools.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setContent("<!doctype html><html><body><div id=host></div></body></html>");
  await p.evaluate(() => {
    window.__up = []; window.__commit = [];
    window.PBApp = { localize: s => s, uploadBlob: async (blob, name) => { window.__up.push([blob.type, blob.size, name]); return "assets/img/pages/" + name + ".png"; }, find: id => window.__node && window.__node.id === id ? { node: window.__node } : null, E: {}, commitAfter: id => window.__commit.push(id), liveShow: (id, url, h) => { window.__live = { id, url, h }; return PBApp.stPreview ? PBApp.stPreview(id, url) : true; }, liveCanvas: async (id, cv, h) => { window.__live = { id, cv, h }; window.__liveN = (window.__liveN || 0) + 1; return true; }, liveClear: r => { window.__live = null; if (r && PBApp.stRestore) PBApp.stRestore(); }, liveCancel: () => { const L = window.__live; window.__live = null; if (L && L.h && L.h.cancel) L.h.cancel(); } };
  });
  for (const f of ["pagebuilder-retouch.js", "pagebuilder-ai.js", "pagebuilder-studio.js", "pagebuilder-more.js"]) await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, f), "utf8") });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/admin-imgqa.js"), "utf8") });
  const T = fn => p.evaluate(fn);
  /* ── لمسات وتصحيح (دوال نقية) ── */
  ok("تحسين تلقائي: يمدّ مدى الإضاءة لصورة باهتة", await T(() => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d"); for (let x = 0; x < 64; x++) { const v = 90 + x; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 64); } const o = PBRetouch._t.autoEnhance(c), d = o.getContext("2d").getImageData(0, 0, 64, 1).data; return d[(63) * 4] - d[0] > 150; }));
  ok("تحسين تلقائي: يتجاهل البكسلات الشفافة", await T(() => { const c = document.createElement("canvas"); c.width = 8; c.height = 8; const o = PBRetouch._t.autoEnhance(c); return o.getContext("2d").getImageData(0, 0, 1, 1).data[3] === 0; }));
  ok("تقليل الضوضاء: يخفض التباين العشوائي", await T(() => { const c = document.createElement("canvas"); c.width = 48; c.height = 48; const g = c.getContext("2d"), im = g.createImageData(48, 48); let s = 5; for (let i = 0; i < im.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const v = 128 + ((s % 41) - 20); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); const vr = cv => { const d = cv.getContext("2d").getImageData(0, 0, 48, 48).data; let m = 0, q = 0; for (let i = 0; i < d.length; i += 4) { m += d[i]; q += d[i] * d[i]; } const n = d.length / 4; return q / n - (m / n) ** 2; }; return vr(PBRetouch._t.denoise(c, 3)) < vr(c) * .6; }));
  ok("تقليل الضوضاء: يحفظ الحواف الحادة", await T(() => { const c = document.createElement("canvas"); c.width = 40; c.height = 40; const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 20, 40); g.fillStyle = "#fff"; g.fillRect(20, 0, 20, 40); const d = PBRetouch._t.denoise(c, 2).getContext("2d").getImageData(0, 20, 40, 1).data; return d[19 * 4] < 10 && d[21 * 4] > 245; }));
  ok("تصحيح المنظور: الحجم ثابت والرأس يضيق", await T(() => { const c = document.createElement("canvas"); c.width = 100; c.height = 100; const g = c.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(0, 0, 100, 100); const o = PBRetouch._t.keystone(c, 20, 0), d = o.getContext("2d").getImageData(0, 0, 100, 100).data; return o.width === 100 && o.height === 100 && d[(2 * 100 + 1) * 4 + 3] === 0 && d[(98 * 100 + 50) * 4 + 3] > 200; }));
  ok("تغيير اللون: الأحمر يصير أخضر والأزرق لا يتغيّر", await T(() => { const c = document.createElement("canvas"); c.width = 20; c.height = 10; const g = c.getContext("2d"); g.fillStyle = "#cc2222"; g.fillRect(0, 0, 10, 10); g.fillStyle = "#2233cc"; g.fillRect(10, 0, 10, 10); const o = PBRetouch._t.recolor(c, { from: [204, 34, 34], to: [34, 170, 68], tol: 24 }), d = o.getContext("2d").getImageData(0, 0, 20, 1).data; return d[1 * 4 + 1] > d[1 * 4] && d[1 * 4 + 1] > 100 && Math.abs(d[15 * 4] - 34) < 4 && Math.abs(d[15 * 4 + 2] - 204) < 4; }));
  ok("تغيير اللون: الألوان المحايدة (أبيض) تُلوَّن بنقر عليها", await T(() => { const c = document.createElement("canvas"); c.width = 10; c.height = 10; const g = c.getContext("2d"); g.fillStyle = "#e8e8e8"; g.fillRect(0, 0, 10, 10); const o = PBRetouch._t.recolor(c, { from: [232, 232, 232], to: [30, 120, 220], tol: 30 }), d = o.getContext("2d").getImageData(5, 5, 1, 1).data; return d[2] > d[0] + 20; }));
  ok("pick: متوسط لون النقطة ويتجاهل الشفاف", await T(() => { const c = document.createElement("canvas"); c.width = 10; c.height = 10; const g = c.getContext("2d"); g.fillStyle = "rgb(10,20,30)"; g.fillRect(0, 0, 10, 10); const p = PBRetouch._t.pick(c, 5, 5), e = document.createElement("canvas"); e.width = 5; e.height = 5; return p[0] === 10 && p[1] === 20 && p[2] === 30 && PBRetouch._t.pick(e, 2, 2) === null; }));
  ok("قص الحواف: الشفافة", await T(() => { const c = document.createElement("canvas"); c.width = 100; c.height = 80; const g = c.getContext("2d"); g.fillStyle = "#333"; g.fillRect(30, 20, 40, 30); const o = PBRetouch._t.trim(c, 0); return o.width === 40 && o.height === 30; }));
  ok("قص الحواف: خلفية متجانسة معتمة + هامش 10%", await T(() => { const c = document.createElement("canvas"); c.width = 100; c.height = 100; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 100, 100); g.fillStyle = "#900"; g.fillRect(40, 40, 20, 20); const o = PBRetouch._t.trim(c, 10); return o.width === 24 && o.height === 24; }));
  ok("تعتيم الأطراف: الزوايا أغمق من الوسط", await T(() => { const c = document.createElement("canvas"); c.width = 100; c.height = 100; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 100, 100); const d = PBRetouch._t.vignette(c, 80).getContext("2d"); return d.getImageData(2, 2, 1, 1).data[0] < d.getImageData(50, 50, 1, 1).data[0] - 80; }));
  ok("حبيبات: تغيّر البكسلات وتحفظ الشفافية", await T(() => { const c = document.createElement("canvas"); c.width = 20; c.height = 10; const g = c.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, 10, 10); const o = PBRetouch._t.grain(c, 80, 3).getContext("2d").getImageData(0, 0, 20, 10).data; let diff = 0; for (let i = 0; i < 10 * 4 * 10; i += 4) if (o[i] !== 128) diff++; return diff > 20 && o[(15) * 4 + 3] === 0; }));
  ok("hasAlpha: يميّز الشفاف من المعتم", await T(() => { const a = document.createElement("canvas"); a.width = 10; a.height = 10; const b = document.createElement("canvas"); b.width = 10; b.height = 10; const g = b.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 10, 10); return PBRetouch._t.hasAlpha(a) && !PBRetouch._t.hasAlpha(b); }));
  /* ── توسيع الخلفية ── */
  const pl = await T(() => ({ sq: PBAI._t.plan(1000, 1000, { ratio: 9 / 16 }), wide: PBAI._t.plan(1000, 1000, { ratio: 16 / 9, anchor: "left" }), dirs: PBAI._t.plan(800, 600, { dirs: { l: 25, r: 25, t: 0, b: 10 } }), same: PBAI._t.plan(1000, 500, { ratio: 2 }), big: PBAI._t.plan(4000, 3000, { ratio: 1 }) }));
  ok("خطة: مربع ← طولي 9:16 (يزيد الارتفاع فقط والأصل بالوسط)", pl.sq.W === 1000 && pl.sq.H === 1778 && pl.sq.ox === 0 && pl.sq.oy === 389 && pl.sq.grow, pl.sq);
  ok("خطة: مربع ← 16:9 والأصل على اليسار", pl.wide.W === 1778 && pl.wide.H === 1000 && pl.wide.ox === 0 && pl.wide.oy === 0, pl.wide);
  ok("خطة: اتجاهات %", pl.dirs.W === 1200 && pl.dirs.H === 660 && pl.dirs.ox === 200 && pl.dirs.oy === 0, pl.dirs);
  ok("خطة: نسبة مطابقة ← لا توسيع", pl.same.grow === false);
  ok("خطة: يُقيَّد أكبر بُعد بـ2048 مع الحفاظ على النسبة", Math.max(pl.big.W, pl.big.H) === 2048 && pl.big.k < 1 && pl.big.W === pl.big.H && pl.big.h < pl.big.H, pl.big);
  ok("استعادة الأصل: بكسلات المنتج لا يمسّها الناتج", await T(() => { const src = document.createElement("canvas"); src.width = 60; src.height = 60; let g = src.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(0, 0, 60, 60); const p = PBAI._t.plan(60, 60, { dirs: { l: 50, r: 50, t: 0, b: 0 } }); const pad = PBAI._t.padded(src, p); const res = document.createElement("canvas"); res.width = p.W; res.height = p.H; g = res.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(0, 0, p.W, p.H); const out = PBAI._t.restore(res, src, p, 4), d = out.getContext("2d"), c = d.getImageData(p.ox + 30, p.oy + 30, 1, 1).data, e = d.getImageData(5, 30, 1, 1).data; return pad.width === p.W && c[0] === 255 && c[1] === 0 && e[1] === 255 && e[0] === 0; }));
  ok("تعليمات التوسيع: تمنع تغيير الأصل وتذكر التلميح", await T(() => { const t = PBAI._t.expandPrompt("طاولة خشبية"); return /do NOT change/i.test(t) && /طاولة خشبية/.test(t) && /OUTPAINT/.test(t); }));
  ok("تعليمات التعديل: تحفظ المنتج وتذكر الطلب", await T(() => { const t = PBAI._t.editPrompt("غيّر اللون إلى الذهبي"); return /unchanged/.test(t) && /الذهبي/.test(t); }));
  /* ── اللوحة (بمحاكاة ImgGen) ── */
  const flow = await T(async () => {
    const host = document.getElementById("host"); window.__node = { id: "w1", set: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC" } };
    const inf = { node: window.__node, set: window.__node.set }; const calls = []; window.ImgGen = { ready: () => ({ ok: true }), edit: async o => { calls.push(o); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const g = c.getContext("2d"); g.fillStyle = "#00aa00"; g.fillRect(0, 0, o.W, o.H); return { canvas: c, blob: null, model: "m" }; } };
    host.innerHTML = PBAI.panel("xp"); PBAI.mount(host, inf, "xp"); document.getElementById("pbai-r").value = String(9 / 16); document.getElementById("pbai-r").dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector('[data-ai="expand"]').click(); await new Promise(r => setTimeout(r, 900));
    const res1 = document.querySelectorAll("#pbai-res img").length >= 1 || !!window.__live, p1 = calls[0] && calls[0].W + "x" + calls[0].H;
    document.querySelector('[data-ai="apply"]').click(); await new Promise(r => setTimeout(r, 500));
    const out = { res1, p1, prompt: calls[0] && /OUTPAINT/.test(calls[0].prompt), src: window.__node.set.src, up: window.__up.length, commit: window.__commit.slice() };
    window.__node.set.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC"; host.innerHTML = PBAI.panel("ai"); PBAI.mount(host, inf, "ai"); document.querySelector('[data-ai="edit"]').click(); await new Promise(r => setTimeout(r, 200)); out.noText = document.getElementById("pbai-msg").textContent;
    document.querySelector('[data-ai="preset"][data-i="0"]').click(); out.preset = document.getElementById("pbai-text").value;
    document.getElementById("pbai-text").value = "غيّر اللون إلى الأحمر"; document.getElementById("pbai-text").dispatchEvent(new Event("input", { bubbles: true })); document.querySelector('[data-ai="edit"]').click(); await new Promise(r => setTimeout(r, 900));
    const lc = calls[calls.length - 1]; out.nExp = calls.filter(c => /OUTPAINT/.test(c.prompt)).length; out.varB = calls.filter(c => /VARIATION B/.test(c.prompt)).length; out.editCall = lc && /الأحمر/.test(lc.prompt); out.editSize = lc && lc.W + "x" + lc.H;
    window.ImgGen = { ready: () => ({ ok: false, nokey: true }), edit: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } };
    host.innerHTML = PBAI.panel("xp"); PBAI.mount(host, inf, "xp"); out.warn = /تحتاج تفعيل Alyssum API/.test(host.textContent); document.getElementById("pbai-a").value = "center"; document.querySelector('[data-ai="expand"]').click(); await new Promise(r => setTimeout(r, 700)); out.nokey = document.getElementById("pbai-msg").textContent;
    return out;
  });
  ok("توسيع: يرسل قماشاً بنسبة 9:16 وتعليمات outpaint ويعرض النتيجة", flow.res1 && flow.prompt && /^10x18$|^1[0-9]x[0-9]+$/.test(flow.p1), flow);
  ok("توسيع: أربعة خيارات للاختيار (كانفا)", flow.nExp === 4 && flow.varB === 1, flow);
  ok("توسيع: التطبيق يرفع الصورة ويضع المصدر الجديد ويثبّت التعديل", /^assets\/img\/pages\/ai-/.test(flow.src) && flow.up === 1 && flow.commit[0] === "w1", flow);
  ok("تعديل بالوصف: يرفض تعليمات فارغة", /اكتب التعليمات/.test(flow.noText), flow.noText);
  ok("تعديل بالوصف: الاقتراح يملأ النص ثم ينفّذ بحجم الأصل", /لون المنتج/.test(flow.preset) && flow.editCall === true && flow.editSize === "10x10", flow);
  ok("بلا مفتاح: تحذير واضح ورسالة تفعيل Alyssum API", flow.warn && /مفتاح Alyssum API/.test(flow.nokey) && !/Gemini|fal/i.test(flow.nokey), flow.nokey);
  /* ── جودة وتناسق الصور (AdminImgQA) ── */
  const qa = await T(() => {
    const mkc = (w, h, fn) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); fn(g, w, h); return c; };
    const sharp = mkc(900, 900, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#222"; for (let y = 0; y < h; y += 20) for (let x = (y / 20) % 2 ? 0 : 20; x < w; x += 40) g.fillRect(x, y, 20, 20); });
    const blur = mkc(900, 900, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#222"; g.fillRect(300, 300, 300, 300); g.filter = "blur(30px)"; g.drawImage(g.canvas, 0, 0); });
    const tiny = mkc(1000, 1000, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#a33"; g.fillRect(450, 450, 100, 100); });
    const good = mkc(1000, 1000, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#a33"; g.fillRect(200, 100, 600, 800); for (let i = 0; i < 60; i++) { g.fillStyle = i % 2 ? "#fcc" : "#600"; g.fillRect(210 + i * 9, 120, 5, 760); } });
    const dark = mkc(1000, 1000, (g, w, h) => { g.fillStyle = "#101010"; g.fillRect(0, 0, w, h); g.fillStyle = "#303030"; g.fillRect(300, 300, 400, 400); });
    const low = mkc(300, 300, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#a33"; g.fillRect(50, 50, 200, 200); });
    const wide = mkc(1600, 900, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#a33"; g.fillRect(500, 150, 600, 600); });
    const T_ = AdminImgQA._t, ms = { sharp: T_.metrics(sharp), blur: T_.metrics(blur), tiny: T_.metrics(tiny), good: T_.metrics(good), dark: T_.metrics(dark), low: T_.metrics(low), wide: T_.metrics(wide) }, std = T_.standard([ms.good, ms.tiny, ms.dark, ms.sharp, ms.blur]);
    return { lapS: ms.sharp.lap, lapB: ms.blur.lap, v: Object.fromEntries(Object.entries(ms).map(([k, m]) => [k, T_.verdict(m, std)])), fillTiny: ms.tiny.fill, fillGood: ms.good.fill, std, allSolved: Object.values(T_.ISSUES).every(i => i[1] && i[1].length > 10) };
  });
  ok("جودة: الوضوح — الحادّ أعلى بكثير من الضبابي", qa.lapS > 500 && qa.lapB < 35, qa);
  ok("جودة: صورة ضبابية تُرصد، والجيدة لا ملاحظات عليها", qa.v.blur.includes("blur") && qa.v.good.length === 0, qa.v);
  ok("جودة: منتج صغير في الإطار + داكنة + دقة منخفضة + نسبة مخالفة", qa.v.tiny.includes("tiny") && qa.v.dark.includes("dark") && qa.v.low.includes("lowres") && qa.v.wide.includes("ratio"), qa.v);
  ok("جودة: كل ملاحظة تحمل حلاً (لا تقرير بلا حل)", qa.allSolved);
  const rs = await T(async () => {
    const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#b33"; g.fillRect(150, 60, 100, 180);
    const real = PBStudio.hasAlpha; window.PBBgRemove = { autoCut: async src => ({ canvas: src }) }; const out = await AdminImgQA.restyle(c, { removeBg: false, enhance: false }); const d = out.getContext("2d").getImageData(2, 2, 1, 1).data, m = out.getContext("2d").getImageData(out.width / 2, out.height / 2, 1, 1).data;
    return { w: out.width, h: out.height, corner: [d[0], d[1], d[2]], mid: [m[0], m[1], m[2]] };
  });
  ok("توحيد النمط: المنتج يُركَّب بمقاس المتجر وخلفيته (مربع، زوايا بيضاء، المنتج بالوسط)", rs.w === rs.h && rs.w >= 800 && rs.corner.every(v => v > 235) && rs.mid[0] > rs.mid[2], rs);
  /* ── حواف ناعمة (Contour fondu) ── */
  const ff = await T(() => {
    const src = document.createElement("canvas"); src.width = 200; src.height = 120; const g = src.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 200, 120);
    const al = (c, x, y) => c.getContext("2d").getImageData(x, y, 1, 1).data[3], F = PBFade._t.feather;
    const sq0 = F(src, { shape: "rect", blur: 0 }), sq = F(src, { shape: "rect", blur: 60 }), ci = F(src, { shape: "circle", blur: 30 }), ci0 = F(src, { shape: "circle", blur: 0 });
    const row = [0, 5, 10, 15, 20, 30, 40, 60].map(x => al(sq, x, 60));
    return { sq0c: al(sq0, 0, 0), sq0m: al(sq0, 100, 60), sqEdge: al(sq, 0, 60), sqMid: al(sq, 100, 60), row, ciCorner: al(ci, 1, 1), ciMid: al(ci, 100, 60), ciSide: al(ci, 100, 0), ci0corner: al(ci0, 2, 2), ci0mid: al(ci0, 100, 60), w: sq.width, h: sq.height, color: Array.from(sq.getContext("2d").getImageData(100, 60, 1, 1).data) };
  });
  ok("حواف ناعمة: بلا تمويه المربع يبقى كاملاً", ff.sq0c === 255 && ff.sq0m === 255, ff);
  ok("حواف ناعمة: بتمويه، الحافة شفافة والوسط معتم وبينهما تدرّج متصاعد", ff.sqEdge < 10 && ff.sqMid > 200 && ff.row.every((v, i, a) => !i || v >= a[i - 1]) && ff.row[3] > 0 && ff.row[3] < 255, ff);
  ok("حواف ناعمة: الدائرة تقصّ الزوايا وتبقي الوسط", ff.ciCorner === 0 && ff.ciMid === 255 && ff.ci0corner === 0 && ff.ci0mid === 255, ff);
  ok("حواف ناعمة: الحجم واللون محفوظان", ff.w === 200 && ff.h === 120 && ff.color[0] === 204 && ff.color[1] === 51, ff);
  const ffp = await T(async () => {
    const host = document.getElementById("host"); const c = document.createElement("canvas"); c.width = 80; c.height = 60; c.getContext("2d").fillRect(0, 0, 80, 60); const url = c.toDataURL();
    window.__node = { id: "w9", set: { src: url } }; window.__prev = []; PBApp.stPreview = (id, u) => { window.__prev.push([id, u]); return true; }; PBApp.stRestore = () => { window.__restored = (window.__restored || 0) + 1; };
    host.innerHTML = PBFade.panel(); await PBFade.mount(host, { node: window.__node, set: window.__node.set }); await new Promise(r => setTimeout(r, 500));
    const first = window.__prev.length; document.querySelector('[data-ff="shape"][data-v="circle"]').click(); await new Promise(r => setTimeout(r, 500)); const b = document.getElementById("pbff-b"); b.value = "80"; b.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 500));
    const after = window.__prev.length; const L0 = window.__live; PBFade.cancel(); const restored = window.__restored; await L0.h.apply(); await new Promise(r => setTimeout(r, 700));
    return { first, after, restored, shape: PBFade.state.shape, blur: PBFade.state.blur, src: window.__node.set.src.slice(0, 22), up: window.__up.length };
  });
  ok("حواف ناعمة: معاينة حيّة على الصورة مع كل تغيير في الشكل والتمويه", ffp.first >= 1 && ffp.after > ffp.first && ffp.shape === "circle" && ffp.blur === 80, ffp);
  ok("حواف ناعمة: الإلغاء يعيد الصورة والتطبيق يرفع PNG بمصدر جديد", ffp.restored === 1 && /^assets\/img\/pages\/ff-/.test(ffp.src) && ffp.up >= 1, ffp);
  /* ── كولاج / إطار وهوية / فيديو من الصورة ── */
  const mo = await T(async () => {
    const col = c => { const k = document.createElement("canvas"); k.width = 100; k.height = 100; const g = k.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, 100, 100); return k; };
    const px = (cv, x, y) => Array.from(cv.getContext("2d").getImageData(x, y, 1, 1).data);
    const cl = PBCollage._t.render([col("#ff0000"), col("#00ff00"), col("#0000ff"), col("#ffff00")], { layout: "g4", W: 200, H: 200, gap: 10, radius: 0, bg: "#ffffff" }), cr = PBCollage._t.render([col("#ff0000")], { layout: "h2", W: 200, H: 100, gap: 0, radius: 40, bg: "#ffffff" });
    const src = document.createElement("canvas"); src.width = 100; src.height = 60; src.getContext("2d").fillStyle = "#336699"; src.getContext("2d").fillRect(0, 0, 100, 60);
    const logo = document.createElement("canvas"); logo.width = 20; logo.height = 20; logo.getContext("2d").fillStyle = "#ff00ff"; logo.getContext("2d").fillRect(0, 0, 20, 20);
    const f1 = PBFrame._t.frame(src, { border: 5, bcolor: "#ffffff", radius: 0, pad: 0, bg: "#fff", shadow: 0 }), f2 = PBFrame._t.frame(src, { border: 0, radius: 20, pad: 0, shadow: 6 }), f3 = PBFrame._t.frame(src, { border: 0, radius: 0, pad: 0, shadow: 0, logo: true, lpos: "br", lsize: 20, lop: 100 }, logo);
    const half = document.createElement("canvas"); half.width = 200; half.height = 100; const hg = half.getContext("2d"); hg.fillStyle = "#f00"; hg.fillRect(0, 0, 100, 100); hg.fillStyle = "#00f"; hg.fillRect(100, 0, 100, 100);
    const mkv = (fx, t) => { const c = document.createElement("canvas"); c.width = 100; c.height = 100; PBVideo._t.frameAt(c.getContext("2d"), half, 100, 100, t, fx, "#000"); return c; };
    const a0 = px(mkv("pl", 0), 50, 50), a1 = px(mkv("pl", 1), 50, 50), z0 = mkv("zin", 0), z1 = mkv("zin", 1);
    let vid = null; if (PBVideo.supported()) { window.__node = { id: "v1", set: { src: half.toDataURL() } }; PBVideo.state.dur = 2; const host = document.getElementById("host"); host.innerHTML = PBVideo.panel(); await PBVideo.mount(host, { node: window.__node, set: window.__node.set }); const b = await PBVideo.make(); vid = b ? [b.size, b.type] : null; }
    return { cl: [px(cl, 40, 40), px(cl, 160, 40), px(cl, 40, 160), px(cl, 160, 160), px(cl, 100, 100)], cr: [px(cr, 1, 1), px(cr, 50, 50)], clEmpty: px(PBCollage._t.render([], { layout: "h2", W: 100, H: 100, gap: 0, bg: "#fff" }), 20, 20),
      f1: [f1.width, f1.height, px(f1, 2, 2), px(f1, 50, 40)], f2: [f2.width > 100, px(f2, 0, 0)[3] === 0], f3: px(f3, 90, 55), pl: [a0[0] > a0[2], a1[2] > a1[0]], zin: [px(z0, 50, 50), px(z1, 95, 50)], vid, sup: PBVideo.supported(), lay: Object.keys(PBCollage._t.LAYOUTS).length };
  });
  ok("كولاج: كل خلية بلون صورتها والفاصل بلون الخلفية", mo.cl[0][0] === 255 && mo.cl[1][1] === 255 && mo.cl[2][2] === 255 && mo.cl[3][0] === 255 && mo.cl[3][1] === 255 && mo.cl[4].every(v => v === 255), mo.cl);
  ok("كولاج: الزوايا المدوّرة تكشف الخلفية، والخلية الناقصة رمادية فاتحة", mo.cr[0][1] === 255 && mo.cr[0][0] === 255 && mo.cr[1][1] < 80 && mo.clEmpty[0] > 200, mo);
  ok("كولاج: ثمانية قوالب جاهزة", mo.lay === 8);
  ok("إطار: الحدّ يوسّع الأبعاد ويلوّن الحافة", mo.f1[0] === 106 && mo.f1[1] === 66 && mo.f1[2][0] === 255 && mo.f1[3][2] > mo.f1[3][0], mo.f1);
  ok("إطار: الزوايا المدوّرة والظل (شفافية الزاوية وحجم أكبر)", mo.f2[0] && mo.f2[1], mo.f2);
  ok("إطار: ختم الشعار في الزاوية", mo.f3[0] === 255 && mo.f3[2] === 255, mo.f3);
  ok("فيديو: التحريك الأفقي يغيّر ما في المنتصف بين البداية والنهاية والتقريب يكبّر", mo.pl[0] && mo.pl[1], mo);
  ok("فيديو: التسجيل ينتج ملفاً حقيقياً (إن دعمه المتصفح)", !mo.sup || (mo.vid && mo.vid[0] > 1000 && /video/.test(mo.vid[1])), mo.vid);
  /* ── دمج صورة داخل صورة (حواف ناعمة) ── */
  const bl = await T(async () => {
    const mkc = (w, h, c) => { const k = document.createElement("canvas"); k.width = w; k.height = h; const g = k.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, w, h); return k; }, px = (c, x, y) => Array.from(c.getContext("2d").getImageData(x, y, 1, 1).data);
    const base = mkc(200, 200, "#0000ff"), over = mkc(100, 100, "#ff0000"), B = PBBlend._t.blend;
    const circ = B(base, over, { x: .5, y: .5, size: 50, shape: "circle", blur: 30, op: 100 }), hard = B(base, over, { x: .5, y: .5, size: 50, shape: "rect", blur: 0, op: 100 }), half = B(base, over, { x: .5, y: .5, size: 50, shape: "rect", blur: 0, op: 50 }), mul = B(base, over, { x: .5, y: .5, size: 50, shape: "rect", blur: 0, mode: "multiply" }), moved = B(base, over, { x: .25, y: .25, size: 30, shape: "rect", blur: 0 });
    const edge = []; for (let x = 52; x <= 100; x += 8) edge.push(px(circ, x, 100)[0]);
    window.__node = { id: "b1", set: { src: base.toDataURL() } }; const host = document.getElementById("host"); window.__up.length = 0; window.__commit.length = 0;
    const ob = await new Promise(r => over.toBlob(r, "image/png")); PBApp.E = { page: { media: [URL.createObjectURL(ob)], sections: [] } }; host.innerHTML = PBBlend.panel(); await PBBlend.mount(host, { node: window.__node, set: window.__node.set }); await new Promise(r => setTimeout(r, 300));
    const pool = document.querySelectorAll('#pbbl [data-bl="pick"]').length; document.querySelector('#pbbl [data-bl="pick"]').click(); await new Promise(r => setTimeout(r, 400)); await new Promise(r => setTimeout(r, 300)); const enabled = !!(window.__live && window.__live.h && window.__live.h.apply);
    document.getElementById("pbbl-z").value = "60"; document.getElementById("pbbl-z").dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 300)); await window.__live.h.apply(); await new Promise(r => setTimeout(r, 300));
    return { center: px(circ, 100, 100), corner: px(circ, 10, 10), edge, hard: px(hard, 100, 100), hardOut: px(hard, 20, 20), half: px(half, 100, 100), mul: px(mul, 100, 100), moved: [px(moved, 50, 50), px(moved, 150, 150)], pool, enabled, size: PBBlend.state.o.size, up: window.__up.length, commit: window.__commit.slice() };
  });
  ok("دمج: مركز الصورة الصغيرة بلونها والخارج بلون الكبيرة", bl.center[0] > 240 && bl.corner[2] === 255 && bl.corner[0] === 0, bl);
  ok("دمج: حواف ناعمة — التدرّج من الخارج للداخل متصاعد", bl.edge.every((v, i, a) => !i || v >= a[i - 1]) && bl.edge[0] < 60 && bl.edge[bl.edge.length - 1] > 200, bl.edge);
  ok("دمج: بلا تمويه تبقى الحافة حادّة، والشفافية 50% تمزج اللونين", bl.hard[0] === 255 && bl.hardOut[2] === 255 && bl.half[0] > 100 && bl.half[0] < 160 && bl.half[2] > 100, bl);
  ok("دمج: أسلوب Multiply يعتّم (أحمر × أزرق = أسود)", bl.mul[0] < 10 && bl.mul[2] < 10, bl.mul);
  ok("دمج: الموضع x,y يحرّك الصورة الصغيرة", bl.moved[0][0] > 240 && bl.moved[1][2] === 255, bl.moved);
  ok("دمج (اللوحة): تعرض صور الصفحة، تعرض النتيجة مباشرة بعد الاختيار، وتنفّذ فترفع وتثبّت التعديل", bl.pool === 1 && bl.enabled && bl.size === 60 && bl.up === 1 && bl.commit[0] === "b1", bl);
  /* ── نزع الخلفية: متجانسة ← محلي بلا ذكاء؛ معقدة + مفتاح ← بالذكاء (محاكاة الخدمة) ── */
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "pagebuilder-bgremove.js"), "utf8") });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../assets/js/ai-bgcut.js"), "utf8") });
  const bgk = await p.evaluate(async () => {
    const mkc = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const prod = (g, bgf) => { bgf(g); g.fillStyle = "#c0392b"; g.fillRect(70, 60, 60, 80); };
    const uni = mkc(200, 200); prod(uni.getContext("2d"), g => { g.fillStyle = "#e8e8e8"; g.fillRect(0, 0, 200, 200); });
    const cx = mkc(200, 200); prod(cx.getContext("2d"), g => { for (let y = 0; y < 200; y += 10) for (let x = 0; x < 200; x += 10) { g.fillStyle = "hsl(" + ((x * 7 + y * 13) % 360) + ",60%," + (30 + (x + y) % 40) + "%)"; g.fillRect(x, y, 10, 10); } });
    let calls = 0; const m = mkc(256, 256); { const g = m.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#fff"; g.fillRect(2, 2, 252, 252); }
    window.ImgGen = { ready: () => ({ ok: true }), estimate: () => ({ cost: .04, fmt: n => "$" + n }), text: async o => { calls++; return JSON.stringify([{ label: "منتج", box_2d: [300, 350, 700, 650], mask: m.toDataURL("image/png") }]); } };
    const r1 = await PBBgRemove.autoCut(uni, { methods: ["classic"] }), c1 = calls, r2 = await PBBgRemove.autoCut(cx, { allowKey: true }), c2 = calls;
    window.ImgGen.ready = () => ({ ok: false, why: "NOKEY" }); let nokey = ""; try { await PBBgRemove.autoCut(cx, {}); } catch (e) { nokey = e.code || e.message; }
    const a = (c, x, y) => c.getContext("2d").getImageData(x, y, 1, 1).data[3];
    return { m1: r1.method, c1, m2: r2.method, c2, bgA: a(r2.canvas, 5, 5), fgA: a(r2.canvas, 100, 100), nokey };
  });
  ok("نزع الخلفية: الاستعمال الداخلي بطرق صريحة (classic) يبقى محلياً بلا طلب", bgk.m1 === "classic" && bgk.c1 === 0, bgk);
  ok("نزع الخلفية: بالذكاء بنقرة واحدة (تحليل نصي + قناع) ونتيجة واحدة، الخلفية شفافة والمنتج معتم", bgk.m2 === "seg" && bgk.c2 === 2 && bgk.bgA === 0 && bgk.fgA === 255, bgk);
  ok("نزع الخلفية: بلا مفتاح يُرفض برسالة واضحة (لا بديل محلي)", bgk.nokey === "NOKEY", bgk);
  /* ── أدوات على نمط Photoroom: إضاءة، إزالة نص، استعادة، محسّن + درجة الجودة + ثقة نزع الخلفية ── */
  const fxp = await T(() => { const F = PBAI._t; return { rl: F.fxPrompt("rl", { light: "golden", str: "high" }, ""), tr1: F.fxPrompt("tr", { what: "wm", keep: "1" }, ""), tr0: F.fxPrompt("tr", { what: "all", keep: "0" }, ""), uc: F.fxPrompt("uc", { what: "top" }, "امتداد"), bf: F.fxPrompt("bf", { kind: "food", str: "low" }, "") }; });
  ok("إعادة الإضاءة: تعليمات الإضاءة والقوة مع حفظ المنتج", /RELIGHT/.test(fxp.rl) && /golden-hour/.test(fxp.rl) && /strong/.test(fxp.rl) && /EXACTLY the same/.test(fxp.rl), fxp.rl);
  ok("إزالة النص: تحفظ النص المطبوع على المنتج افتراضياً وتزيله عند الطلب", /Do NOT touch the text/.test(fxp.tr1) && /watermark/.test(fxp.tr1) && !/Do NOT touch/.test(fxp.tr0) && /printed on the product surface/.test(fxp.tr0), [fxp.tr1, fxp.tr0]);
  ok("استعادة المقطوع والمحسّن: تعليمات صحيحة وتحمل التوجيه الإضافي", /UNCROP/.test(fxp.uc) && /top edge/.test(fxp.uc) && /امتداد/.test(fxp.uc) && /food photo/.test(fxp.bf) && /subtle/.test(fxp.bf));
  const qs = await T(() => {
    const mkc = (w, h, f) => { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d"), w, h); return c; };
    const sharp = mkc(1200, 1200, (g, w, h) => { for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? "#505050" : "#b4b4b4"; g.fillRect(x, y, 4, 4); } });
    const soft = mkc(1200, 1200, g => { const gr = g.createLinearGradient(0, 0, 1200, 0); gr.addColorStop(0, "#777"); gr.addColorStop(1, "#999"); g.fillStyle = gr; g.fillRect(0, 0, 1200, 1200); });
    const dark = mkc(1200, 1200, (g, w, h) => { for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? "#020202" : "#101010"; g.fillRect(x, y, 4, 4); } });
    const small = mkc(200, 200, (g, w, h) => { for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? "#505050" : "#b4b4b4"; g.fillRect(x, y, 4, 4); } });
    const q = c => PBAI.qa(c); return { sharp: q(sharp), soft: q(soft), dark: q(dark), small: q(small), empty: q(mkc(50, 50, () => { })) };
  });
  ok("درجة الجودة: الحادة أعلى من الباهتة، وتُعلَّم المعتمة والمنخفضة الدقة", qs.sharp.score >= 85 && qs.sharp.score > qs.soft.score + 20 && qs.soft.notes.includes("الصورة غير حادة") && qs.dark.notes.includes("معتمة") && qs.small.notes.includes("دقة منخفضة") && qs.empty.score === 0, qs);
  const cf = await T(() => {
    const mkc = (w, h, f) => { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d")); return c; };
    const clean = mkc(300, 300, g => { g.fillStyle = "#c33"; g.beginPath(); g.arc(150, 150, 100, 0, 7); g.fill(); });
    const fuzzy = mkc(300, 300, g => { const gr = g.createRadialGradient(150, 150, 5, 150, 150, 110); gr.addColorStop(0, "rgba(200,50,50,1)"); gr.addColorStop(1, "rgba(200,50,50,0)"); g.fillStyle = gr; g.fillRect(0, 0, 300, 300); });
    const full = mkc(300, 300, g => { g.fillStyle = "#369"; g.fillRect(0, 0, 300, 300); });
    const blank = mkc(300, 300, () => { });
    const frag = mkc(300, 300, g => { g.fillStyle = "#333"; for (let i = 0; i < 8; i++) g.fillRect(10 + (i % 4) * 70, 20 + Math.floor(i / 4) * 120, 40, 60); });
    const c = x => PBBgRemove.confidence(x); return { clean: c(clean), fuzzy: c(fuzzy), full: c(full), blank: c(blank), frag: c(frag) };
  });
  ok("ثقة نزع الخلفية: القص النظيف عالٍ، والحواف الضبابية والصورة غير المقصوصة والقطع المتفرقة أقل، والفارغ صفر", cf.clean.score >= .85 && cf.fuzzy.score < cf.clean.score - .2 && cf.full.score < .6 && cf.frag.score < cf.clean.score && cf.blank.score === 0, cf);
  const fl = await T(async () => {
    const host = document.getElementById("host"); const node = { id: "w9", set: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC" } }; window.__node = node; window.__live = null;
    const inf = { node, set: node.set }; const calls = []; let mode = "flat";
    window.ImgGen = { ready: () => ({ ok: true }), edit: async o => { calls.push(o); const c = document.createElement("canvas"); c.width = o.W; c.height = o.H; const g = c.getContext("2d"); if (mode === "flat") { g.fillStyle = "#888"; g.fillRect(0, 0, o.W, o.H); } else { for (let y = 0; y < o.H; y += 2) for (let x = 0; x < o.W; x += 2) { g.fillStyle = ((x + y) / 2) % 2 ? "#505050" : "#b4b4b4"; g.fillRect(x, y, 2, 2); } } return { canvas: c, blob: null, model: "m" }; } };
    const out = {}; const wait = ms => new Promise(r => setTimeout(r, ms));
    host.innerHTML = PBAI.panel("rl"); PBAI.mount(host, inf, "rl"); out.hasSel = !!document.getElementById("pbai-fx-light") && !document.getElementById("pbai-fxr");
    document.getElementById("pbai-fx-light").value = "window";
    document.querySelector('[data-ai="fx"]').click(); await wait(900); out.flatCalls = calls.length; out.lightPrompt = /natural window daylight/.test(calls[0].prompt); out.live = !!(window.__live && window.__live.cv); out.note = document.getElementById("pbai-res").textContent;
    calls.length = 0; mode = "sharp"; window.__live = null; host.innerHTML = PBAI.panel("tr"); PBAI.mount(host, inf, "tr"); document.querySelector('[data-ai="fx"]').click(); await wait(900); out.sharpCalls = calls.length; out.trPrompt = /REMOVE TEXT AND MARKS/.test(calls[0].prompt);
    window.__live.h.apply(); await wait(500); out.applied = /^assets\/img\/pages\/ai-/.test(node.set.src);
    window.__node.set.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC"; window.__live = null; calls.length = 0; host.innerHTML = PBAI.panel("bf"); PBAI.mount(host, inf, "bf"); out.bflBtn = !!document.querySelector('[data-ai="bfl"]');
    window.ImgGen = { ready: () => ({ ok: false, nokey: true }), edit: async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; } }; host.innerHTML = PBAI.panel("uc"); PBAI.mount(host, inf, "uc"); out.warn = /تحتاج تفعيل Alyssum API/.test(host.textContent); document.querySelector('[data-ai="fx"]').click(); await wait(500); out.nokey = document.getElementById("pbai-msg").textContent;
    return out;
  });
  ok("أدوات الصور: اللوحة بلا إعادة محاولة تلقائية — طلب واحد ونتيجة واحدة", fl.hasSel && fl.lightPrompt && fl.flatCalls === 1 && fl.live && /جودة تقديرية/.test(fl.note), fl);
  ok("أدوات فوتوروم: نتيجة حادة تتوقف عند أول محاولة ويُطبَّق الناتج على الصورة", fl.sharpCalls === 1 && fl.trPrompt && fl.applied, fl);
  ok("محسّن المنتج: لا خيار مجاني (مسار واحد)", !fl.bflBtn, fl);
  ok("أدوات فوتوروم: غياب المفتاح يُنبَّه إليه بوضوح", fl.warn && /مفتاح Alyssum API/.test(fl.nokey), fl);
  ok("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `\n✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
})();
