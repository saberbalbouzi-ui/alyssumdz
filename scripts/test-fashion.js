/* اختبار استوديو الأزياء الموسَّع (هيئة العارض، العارضون المحفوظون، الإطلالة بعدة قطع) و«المشهد الذكي بخيارين» — بمحاكاة ImgGen:
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-fashion.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await p.route("https://t.test/**", r => /\.png$/.test(r.request().url()) ? r.fulfill({ contentType: "image/png", body: PNG }) : r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><div id=host></div></body></html>" }));
  await p.goto("https://t.test/");
  await p.evaluate(() => {
    window.__calls = []; window.confirm = () => true; window.prompt = () => "عارض الاختبار";
    const cv = () => { const c = document.createElement("canvas"); c.width = 200; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 200, 300); return c; };
    window.__node = { id: "n1", set: { src: "assets/main.png" } };
    window.PBApp = { localize: s => s, find: id => id === "n1" ? { node: window.__node } : null, E: {}, liveCanvas: async () => true, liveClear: () => { }, liveCancel: () => { }, uploadBlob: async () => "x.png", commitAfter: () => { } };
    window.PBCollage = { poolOf: () => ["assets/g1.png", "assets/g2.png", "assets/g3.png"] };
    window.ImgGen = { ready: () => ({ ok: true }), estimate: () => ({ cost: .04, left: 99, fmt: n => "$" + n }), edit: async o => { __calls.push({ prompt: o.prompt, extra: (o.extra || []).length, title: o.title }); return { canvas: cv(), blob: new Blob(["x"]), model: "t", cost: .04 }; } };
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const real = window.fetch.bind(window); window.fetch = u => /\.png$/.test(String(u)) ? real(png) : real(u);
  });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "pagebuilder-ai.js"), "utf8") });
  const T = fn => p.evaluate(fn);
  /* نقية */
  ok("العارض الافتراضي: مانيكان بلا وصف مظهر", await T(() => !/Model appearance/.test(PBAI._t.fashionPrompt("model", { who: "mannequin", age: "young", body: "plus", tone: "dark", pose: "stand", bg: "white" }))));
  ok("رجل شاب رياضي أسمر: يظهر الوصف", await T(() => { const t = PBAI._t.fashionPrompt("model", { who: "man", age: "young", body: "athletic", tone: "brown", pose: "stand", bg: "white" }); return /twenties/.test(t) && /athletic/.test(t) && /brown skin/.test(t); }));
  ok("امرأة ممتلئة: تبقى بخمار ولباس محتشم", await T(() => { const t = PBAI._t.fashionPrompt("model", { who: "woman", age: "adult", body: "plus", tone: "olive", pose: "stand", bg: "white" }); return /plus-size/.test(t) && /hijab/.test(t) && /NO bare arms/.test(t); }));
  ok("أي/أي: لا وصف إضافي", await T(() => !/Model appearance/.test(PBAI._t.fashionPrompt("model", { who: "man", age: "any", body: "any", tone: "any", pose: "stand", bg: "white" }))));
  ok("عارض مرجعي وإطلالة: تعليمات المرجع والقطع", await T(() => { const t = PBAI._t.fashionPrompt("model", { who: "man", ref: true, outfit: 2, pose: "stand", bg: "white" }); return /REFERENCE MODEL/.test(t) && /OUTFIT/.test(t) && /ALL the pieces/.test(t); }));
  ok("الأوضاع الأخرى (ghost) لا تتأثر بالمرجع", await T(() => !/REFERENCE MODEL/.test(PBAI._t.fashionPrompt("ghost", { ref: true, who: "man", bg: "white" }))));
  /* اللوحة */
  const ui = await T(async () => {
    const host = document.getElementById("host"), inf = { node: window.__node, set: window.__node.set }; const out = {};
    host.innerHTML = PBAI.panel("fa"); PBAI.mount(host, inf, "fa");
    const q = s => host.querySelector(s), go = () => new Promise(r => setTimeout(r, 120));
    out.sel = ["#pbai-fage", "#pbai-fbody", "#pbai-ftone"].every(s => !!q(s)); out.pool = host.querySelectorAll('[data-ai="outfit"]').length;
    q("#pbai-fw").value = "woman"; q("#pbai-fage").value = "adult"; q("#pbai-fbody").value = "plus"; q("#pbai-ftone").value = "tan"; q("#pbai-fw").dispatchEvent(new Event("input", { bubbles: true }));
    for (const i of [0, 1, 2]) q('[data-ai="outfit"][data-i="' + i + '"]').click(); out.outfitN = PBAI.state.fa.outfit.length;
    q('[data-ai="fashion"][data-m="model"]').click(); for (let i = 0; i < 40 && !__calls.length; i++) await go(); await go();
    out.c1 = __calls[0]; await go(); await go(); out.msg = (document.getElementById("pbai-msg") || {}).textContent; out.resHtml = (document.getElementById("pbai-res") || {}).innerHTML; out.saveBtn = !!host.querySelector('[data-ai="savemodel"]'); if (!out.saveBtn) return out;
    host.querySelector('[data-ai="savemodel"]').click(); await go(); out.models = PBAI._t.loadModels(); out.modelsUi = host.querySelectorAll('[data-ai="usemodel"]').length;
    host.querySelector('[data-ai="usemodel"]').click(); await go(); out.fModel = PBAI.state.fa.model; out.outfitCap = PBAI.state.fa.outfit.length;
    __calls.length = 0; PBAI.state.busy = false; q('[data-ai="fashion"][data-m="model"]').click(); for (let i = 0; i < 40 && !__calls.length; i++) await go(); await go();
    out.c2 = __calls[0];
    host.querySelector('[data-ai="delmodel"]').click(); await go(); out.after = PBAI._t.loadModels().length;
    return out;
  });
  ok("اللوحة: قوائم العمر والبنية والبشرة وصور الإطلالة", ui.sel && ui.pool === 3, ui);
  ok("الإطلالة بلا عارض محفوظ: حتى قطعتين إضافيتين", ui.outfitN === 2 && ui.c1 && ui.c1.extra === 2 && /OUTFIT/.test(ui.c1.prompt) && /plus-size/.test(ui.c1.prompt) && /tan skin/.test(ui.c1.prompt), ui.c1);
  ok("حفظ العارض ثم ظهوره في القائمة", ui.saveBtn && ui.models.length === 1 && ui.models[0].name === "عارض الاختبار" && /^data:image\/jpeg/.test(ui.models[0].img) && ui.modelsUi === 1, ui.models.length);
  ok("اختيار العارض المحفوظ: يقلّص القطع الإضافية إلى واحدة ويُرسل المرجع", ui.fModel === ui.models[0].id && ui.outfitCap === 1 && ui.c2 && ui.c2.extra === 2 && /REFERENCE MODEL/.test(ui.c2.prompt), [ui.outfitCap, ui.c2 && ui.c2.extra]);
  ok("حذف العارض المحفوظ", ui.after === 0);
  /* المشهد الذكي بخيارين */
  ok("PBAI.stage: يضبط مشهداً واحداً (نتيجة واحدة بمسحة واحدة)", await T(() => { const ids = PBAI.stage(); return ids.length === 1 && PBAI.state.ps.length === 1; }));
  /* أيقونة بالذكاء */
  const p2 = await b.newPage(); await p2.route("https://t.test/**", r => r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" })); await p2.goto("https://t.test/"); await p2.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "pagebuilder-more.js"), "utf8") });
  const T2 = fn => p2.evaluate(fn);
  ok("الأيقونة: تعليمات بلا نص وبألوان الهوية ونمط", await T2(() => { const t = PBBrand._t.iconPrompt("عبوة عسل", "line", { colors: ["#111111", "#c8a24b", "#fbf8f2"] }); return /SINGLE APP\/WEB ICON/.test(t) && /monoline/.test(t) && /#111111, #c8a24b/.test(t) && /No text/.test(t) && /عبوة عسل/.test(t); }));
  ok("الأيقونة: 4 أنماط وافتراضي مسطح", await T2(() => PBBrand._t.ICON_STYLES.length === 4 && /flat vector/.test(PBBrand._t.iconPrompt("x", "؟", null))));
  ok("بلا أخطاء JS", errs.length === 0, errs);
  console.log(fails ? "فشل " + fails + " من " + total : "نجح " + total + " من " + total);
  await b.close(); process.exit(fails ? 1 : 0);
})();
