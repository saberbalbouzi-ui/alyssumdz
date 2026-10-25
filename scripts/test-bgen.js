/* اختبار «مشهد وخلفية»: كل المشاهد يرسمها النموذج من صورة المنتج المرجعية (تفاعل لا لصق)، لا خلفيات طبيعة مفروضة، ورفع خلفية من الجهاز بتركيب بكسلي ودمج واقعي اختياري (خادم محلي 8765) */
const { chromium } = require("playwright");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log("✓ " + n); } else { bad++; console.log("✗ " + n + (x ? " " + JSON.stringify(x) : "")); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  /* مساعد مشترك داخل الصفحة: منتج أحمر شفاف الخلفية، خدمة مُحاكاة ترسم "مشهداً" رمادياً وفي وسطه مستطيل أخضر (كأن النموذج رسم المنتج) */
  await p.evaluate(() => {
    window.confirm = () => true; window.alert = () => { };
    window.__t = { calls: [], up: [], blob: null };
    const c = document.createElement("canvas"); c.width = 200; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#d22"; g.fillRect(70, 60, 60, 100);
    window.__t.mk = () => new Promise(r => c.toBlob(r, "image/png"));
    ImgGen.ready = () => ({ ok: true }); ImgGen.estimate = () => ({ can: n => true });
    ImgGen.edit = async o => { __t.calls.push({ prompt: o.prompt, W: o.W, H: o.H, blob: !!o.blob }); const d = document.createElement("canvas"); d.width = o.W; d.height = o.H; const q = d.getContext("2d"); q.fillStyle = "#2255cc"; q.fillRect(0, 0, o.W, o.H); q.fillStyle = "#22aa44"; q.fillRect(o.W * .4, o.H * .4, o.W * .2, o.H * .3); return { canvas: d }; };
    PBApp.uploadBlob = async b => { __t.up.push(b.size); return "assets/img/pages/bgen.png"; };
  });
  const open = async () => p.evaluate(async () => { __t.calls.length = 0; await PBApp.toolSession([await __t.mk()], "st", "t"); await new Promise(r => setTimeout(r, 800)); return { ept: PBApp.E.ept, panel: !!document.getElementById("pbai-bgp") }; });
  const scene = async (txt, n) => p.evaluate(async ([txt, n]) => { document.getElementById("pbai-bgp").value = txt; const sc = document.getElementById("pbai-bgc"); sc.value = String(n); sc.dispatchEvent(new Event("input", { bubbles: true })); document.querySelector('#pbai [data-ai="bgen"]').click(); await new Promise(r => setTimeout(r, 2500)); return { calls: __t.calls.slice(), cards: document.querySelectorAll("#pbai-res [data-vc]").length, ctl: !!document.getElementById("pbai-bgnctl"), regen: !!document.querySelector('#pbai-res [data-ai="bgen"]'), held: !!PBAI.state.bgn && PBAI.state.bgn.held }; }, [txt, n]);

  const o1 = await open();
  t("اللوحة تُفتح على «استوديو المنتج ‹ مشهد وخلفية» وفيها خانة الوصف وزر رفع خلفية", o1.ept === "st" && o1.panel && await p.evaluate(() => !!document.getElementById("pbai-bgup")), o1);
  const chips = await p.evaluate(() => [...document.querySelectorAll('#pbai [data-ai="bgchip"]')].map(x => x.textContent).join("|"));
  t("لا خلفيات طبيعة مفروضة (أعشاب/شاطئ/حديقة) بين المشاهد الجاهزة", !/أعشاب|شاطئ|حديقة|طبيعة/.test(chips) && chips.length > 20, chips);

  /* مشهد سطح: 4 طلبات بصورة مرجعية 1024² وتعليمات التفاعل (لا لصق ولا مواضع فارغة) */
  const r = await scene("فوق طاولة خشبية وخلفها مكتبة كتب ضبابية", 4);
  const pr = r.calls[0] ? r.calls[0].prompt : "";
  t("4 طلبات للنموذج بصورة المنتج المرجعية 1024×1024", r.calls.length === 4 && r.calls.every(c => c.blob && c.W === 1024 && c.H === 1024), r.calls.map(c => [c.W, c.H, c.blob]));
  t("التعليمات: المنتج جزء من المشهد (ملامسة، ظل، انعكاس، عمق) ويحفظ تصميمه", /INTERACTION: the product is physically part of the scene, not a cut-out/.test(pr) && /contact shadow/.test(pr) && /PRODUCT FIDELITY/.test(pr) && /فوق طاولة خشبية/.test(pr) && !/NO PRODUCT|EMPTY SPOT/.test(pr) && !/HOLDING/.test(pr), pr.slice(0, 200));
  t("تنويع بين الخيارات الأربعة", new Set(r.calls.map(c => (c.prompt.match(/VARIATION ([A-D])/) || [])[1])).size >= 3);
  t("4 بطاقات وزر «توليد من جديد» وبلا أدوات تحريك (الناتج يُعرض كما رسمه النموذج)", r.cards === 4 && r.regen && !r.ctl && r.held, r);

  /* مشهد اليد: تعليمات الإمساك */
  await open(); const h = await scene("the product held naturally in one hand, only the hand and forearm visible with a long sleeve, window light", 1);
  const hp = h.calls[0] ? h.calls[0].prompt : "";
  t("مشهد اليد: HOLDING + مقياس اليد + بلا تعليمات سطح", h.calls.length === 1 && /HOLDING: a real adult hand genuinely grips/.test(hp) && /about 18 cm/.test(hp) && !/INTERACTION: the product is physically/.test(hp), hp.slice(0, 160));

  /* تطبيق الخيار المحدّد يرفع الصورة */
  const ap = await p.evaluate(async () => { const before = __t.up.length; document.querySelector('#pbai-res [data-ai="apply"]').click(); await new Promise(r => setTimeout(r, 1500)); return __t.up.length > before; });
  t("تطبيق الخيار المحدّد يرفع الصورة", ap);

  /* خلفية من جهازك: تركيب بكسلي بلا أي طلب توليد، تحريك المنتج، ثم دمج واقعي اختياري */
  await open();
  const bgPng = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#2255cc"; g.fillRect(0, 0, 400, 300); return c.toDataURL("image/png").split(",")[1]; });
  await p.setInputFiles("#pbai-bgup", { name: "bg.png", mimeType: "image/png", buffer: Buffer.from(bgPng, "base64") });
  await p.waitForTimeout(600);
  const u = await p.evaluate(async () => {
    const out = { note: (document.getElementById("pbai-bgupn") || {}).textContent, btn: document.querySelector('#pbai [data-ai="bgen"]').textContent, del: !!document.querySelector('#pbai [data-ai="bgupdel"]') };
    __t.calls.length = 0; document.querySelector('#pbai [data-ai="bgen"]').click(); await new Promise(r => setTimeout(r, 2000));
    out.calls = __t.calls.length; out.cards = document.querySelectorAll("#pbai-res [data-vc]").length; out.ctl = !!document.getElementById("pbai-bgnctl"); out.blend = !!document.querySelector('#pbai-res [data-ai="bgblend"]');
    const pix = im => new Promise(r => { const f = () => { const t = document.createElement("canvas"); t.width = im.naturalWidth; t.height = im.naturalHeight; const tg = t.getContext("2d"); tg.drawImage(im, 0, 0); r(tg); }; if (im.complete) f(); else im.onload = f; });
    let tg = await pix(document.querySelector("#pbai-res [data-vc] img")); const col = (x, y) => [...tg.getImageData(x, y, 1, 1).data]; const red = (x, y) => { const d = col(x, y); return d[0] > 150 && d[1] < 90 && d[2] < 90; };
    out.size = [tg.canvas.width, tg.canvas.height]; out.prod = red(200, 170); out.bg = col(20, 20)[2] > 150 && col(20, 20)[0] < 90;
    const sx = document.querySelector('[data-bgn="x"]'); sx.value = "30"; sx.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 500));
    tg = await pix(document.querySelector("#pbai-res [data-vc] img")); out.moved = red(320, 170) && !red(200, 170);
    sx.value = "0"; sx.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 400));
    document.querySelector('#pbai-res [data-ai="bgblend"]').click(); await new Promise(r => setTimeout(r, 2500));
    out.bcalls = __t.calls.length; out.bprompt = __t.calls[0] ? __t.calls[0].prompt : ""; out.bsize = __t.calls[0] ? [__t.calls[0].W, __t.calls[0].H] : null; out.after = { cards: document.querySelectorAll("#pbai-res [data-vc]").length, ctl: !!document.getElementById("pbai-bgnctl") };
    return out;
  });
  t("رفع الخلفية: الحالة جاهزة والزر يصير «ركّب المنتج على خلفيتي» وزر إزالة", /خلفيتك جاهزة \(400×300\)/.test(u.note) && /ركّب المنتج/.test(u.btn) && u.del, u);
  t("التركيب بلا أي طلب توليد، بخلفيتك ومقاسها، والمنتج الأصلي بلونه", u.calls === 0 && u.cards === 1 && u.size[0] === 400 && u.size[1] === 300 && u.prod && u.bg, u);
  t("أدوات تحريك المنتج وزر الدمج الواقعي ظاهران وتحريك أفقي يعمل", u.ctl && u.blend && u.moved, u);
  t("الدمج الواقعي: طلب واحد بمقاس خلفيتك يحافظ على المنتج ويضيف الظل والانعكاس", u.bcalls === 1 && /REALISM PASS/.test(u.bprompt) && /contact shadow/.test(u.bprompt) && /EXACTLY/.test(u.bprompt) && u.bsize && u.bsize[0] === 400 && u.bsize[1] === 300, u);
  t("بعد الدمج يُعرض الناتج كما رسمه النموذج بلا أدوات تحريك", u.after.cards === 1 && !u.after.ctl, u.after);

  /* إزالة الخلفية المرفوعة تعيد التوليد العادي */
  await open(); await p.setInputFiles("#pbai-bgup", { name: "bg.png", mimeType: "image/png", buffer: Buffer.from(bgPng, "base64") }); await p.waitForTimeout(500);
  const dl = await p.evaluate(async () => { document.querySelector('#pbai [data-ai="bgupdel"]').click(); await new Promise(r => setTimeout(r, 200)); return { btn: document.querySelector('#pbai [data-ai="bgen"]').textContent, del: !!document.querySelector('#pbai [data-ai="bgupdel"]'), has: !!PBAI.state.opt.bgImg }; });
  t("«أزل خلفيتي» يعيد الزر والحالة للتوليد العادي", /توليد/.test(dl.btn) && !dl.del && !dl.has, dl);
  t("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(bad ? `\n✗ ${bad} من ${ok + bad} فشل` : `\n✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
})();
