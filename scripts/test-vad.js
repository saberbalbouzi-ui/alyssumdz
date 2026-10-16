/* اختبار صانع إعلانات الفيديو بالذكاء (PBVAd) بمحاكاة ImgGen: التعرّف، الخطة، التعديل، التوليد بلغات، الاستيراد — NODE_PATH=/opt/node-tools/node_modules node scripts/test-vad.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://t.test/**", r => /\.(png|jpg)$/.test(r.request().url()) ? r.fulfill({ contentType: "image/png", body: PNG }) : r.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><div id=host></div></body></html>" }));
  await p.goto("https://t.test/");
  await p.evaluate(() => {
    window.__vid = []; window.__txt = []; window.confirm = () => true; window.__added = [];
    window.Admin = { products: [{ slug: "dress", title: "فستان صيفي", cover: "assets/d1.png", images: ["assets/d2.png"], active: true }] };
    window.PBApp = { localize: s => s, uploadVideo: async f => { window.__up = [f.name, f.type]; return "assets/img/pages/pv-" + f.name; }, addVideoFile: p => window.__added.push(p) };
    window.PBCollage = { poolOf: () => ["assets/a1.png", "assets/a2.png", "assets/a3.png", "assets/a4.png"] };
    const plan = { title: "إعلان الفستان", shots: [{ seconds: 3, visual: "لقطة قريبة للقماش", camera: "تقريب" }, { seconds: 3, visual: "ممثلة ترتدي الفستان", camera: "ثابت" }, { seconds: 2, visual: "عرض المنتج", camera: "دوران" }], script: { dz: "فستان يجنن! اطلبو دروك", fr: "Une robe magnifique, commandez maintenant" } };
    window.ImgGen = { ready: () => ({ ok: true }), canVideo: () => true, credit: { note() { }, state: () => "ok" }, estimate: () => ({ can: () => true }),
      text: async o => { __txt.push(o); return o.json && /category/.test(o.prompt) ? { name: "فستان صيفي", category: "fashion", points: ["قماش خفيف", "ألوان زاهية"], type: "ugc", length: 8 } : plan; },
      video: async o => { __vid.push({ prompt: o.prompt, lang: o.lang, script: o.script, audio: o.audio, seed: o.seed, n: o.images.length, ratio: o.ratio, dur: o.dur }); return { blob: new Blob([new Uint8Array(100)], { type: "video/mp4" }), type: "video/mp4", cost: 0.5 }; } };
  });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "pagebuilder-vad.js"), "utf8") });
  const T = fn => p.evaluate(fn);
  /* نقية */
  ok("الفئة من العنوان", await T(() => PBVAd._t.guessCat("فستان صيفي") === "fashion" && PBVAd._t.guessCat("كريم مرطب") === "beauty" && PBVAd._t.guessCat("عسل سدر") === "food" && PBVAd._t.guessCat("شيء") === "other"));
  ok("اقتراح النوع والمدة حسب الفئة", await T(() => { const r = PBVAd._t.recommend("food"); const f = PBVAd._t.recommend("fashion"); return r.type === "product" && r.length === 5 && f.type === "ugc" && f.length === 8; }));
  ok("تحذير الادعاءات العلاجية", await T(() => PBVAd._t.claims("هذا الكريم يشفي الحبوب بشكل نهائي").length === 1 && PBVAd._t.claims("منتج طبيعي لطيف").length === 0));
  ok("روابط Drive وDropbox تتحول إلى تنزيل مباشر", await T(() => PBVAd._t.directUrl("https://drive.google.com/file/d/ABC_123-x/view?usp=sharing") === "https://drive.google.com/uc?export=download&id=ABC_123-x" && /\?dl=1$/.test(PBVAd._t.directUrl("https://www.dropbox.com/s/abc/p.jpg?dl=0")) && PBVAd._t.directUrl("https://x.com/a.jpg") === "https://x.com/a.jpg"));
  ok("parsePlan: يقصّ اللقطات ويملأ نص كل لغة ويتجاهل اللقطة الفارغة", await T(() => { const r = PBVAd._t.parsePlan({ title: "t", shots: [{ seconds: 3, visual: "a" }, { seconds: 99, visual: "" }, { seconds: 2, visual: "b" }], script: { ar: "نص" } }, { langs: ["ar", "fr"] }); return r.shots.length === 2 && r.shots[1].n === 2 && r.script.ar === "نص" && r.script.fr === ""; }));
  const pr = await T(() => { const o = { type: "ugc", length: 8, ratio: "9:16", actor: "woman", free: "" }, plan = { shots: [{ n: 1, s: 3, v: "close", c: "zoom" }], script: { dz: "سكريبت" } }; return { a: PBVAd._t.buildPrompt(o, plan, "dz"), b: PBVAd._t.buildPrompt(Object.assign({}, o, { type: "product", actor: "none" }), plan, "fr"), c: PBVAd._t.buildPrompt(Object.assign({}, o, { actor: "man", type: "trend", ratio: "16:9" }), plan, "en") }; });
  ok("التعليمات: UGC بممثلة محتشمة ولغة الدارجة والسكريبت وحفظ المنتج", /UGC-style/.test(pr.a) && /hijab/.test(pr.a) && /Darija/.test(pr.a) && /سكريبت/.test(pr.a) && /lip-sync/.test(pr.a) && /Keep the product exactly/.test(pr.a) && /No on-screen text/.test(pr.a), pr.a.slice(0, 200));
  ok("التعليمات: فيديو المنتج بلا ممثل", /No on-screen person/.test(pr.b) && !/lip-sync/.test(pr.b) && /French/.test(pr.b));
  ok("التعليمات: التنسيق الأفقي ورجل بملابس محتشمة", /horizontal/.test(pr.c) && /man in plain modest/.test(pr.c) && /trend/i.test(pr.c));
  /* واجهة */
  const ui = await T(async () => {
    const host = document.getElementById("host"), inf = { node: { id: "n1" }, set: { src: "assets/main.png" } }, out = {}; const w = ms => new Promise(r => setTimeout(r, ms));
    PBVAd.mount(host, inf); const q = s => host.querySelector(s), Q = s => host.querySelectorAll(s);
    out.types = Q('[data-vad="type"]').length; out.pool = Q('[data-vad="pick"]').length; out.sp = q("#pbvad-sp").options.length;
    q('[data-vad="rec"]').click(); await w(300); out.rec = !!host.textContent.match(/تعرّفنا على المنتج/); out.recSel = { type: PBVAd.state.type, len: PBVAd.state.length, actor: PBVAd.state.actor }; out.txtImgs = __txt[0] && __txt[0].blobs.length;
    for (const i of [0, 1, 2, 3]) { const im = host.querySelector('[data-vad="pick"][data-i="' + i + '"]'); if (im) im.click(); } out.nPics = PBVAd.state.picks.length;
    /* الاستيراد من المتجر لا يتجاوز 4 */
    const sp = q("#pbvad-sp"); sp.value = "dress"; sp.dispatchEvent(new Event("change", { bubbles: true })); out.afterStore = 1 + PBVAd.state.picks.length + PBVAd.state.extra.length;
    q('[data-vad="lang"][data-v="fr"]').click(); out.langs = PBVAd.state.langs.join();
    q('[data-vad="plan"]').click(); await w(400); out.shots = Q("[data-vadshot=v]").length; out.scripts = Q("[data-vadscript]").length; out.planSent = __txt[1] && /JSON only/.test(__txt[1].prompt) && /"dz"/.test(__txt[1].prompt) && /"fr"/.test(__txt[1].prompt);
    /* تعديل الخطة */
    const sc = q('[data-vadscript="dz"]'); sc.value = "نص معدّل يشفي كل شيء"; const sh = q('[data-vadshot="v"][data-i="0"]'); sh.value = "لقطة معدّلة";
    out.warn = false; q("#pbvad-r").value = "16:9"; q("#pbvad-r").dispatchEvent(new Event("change", { bubbles: true })); q("#pbvad-l").value = "10"; q("#pbvad-l").dispatchEvent(new Event("change", { bubbles: true }));
    q('[data-vad="go"]').click(); for (let i = 0; i < 40 && __vid.length < 2; i++) await w(150); await w(100);
    out.vids = __vid.slice(); out.videos = Q("video").length; out.warnShown = /ادعاءات|عبارات تحتاج/.test(host.textContent);
    q('[data-vad="add"][data-i="1"]').click(); await w(150); out.added = __added.slice(); out.up = window.__up;
    return out;
  });
  ok("اللوحة: 4 أنواع وصور الصفحة وقائمة المتجر", ui.types === 4 && ui.pool === 4 && ui.sp === 2, ui);
  ok("التعرّف: يرسل صور المنتج ويضبط النوع والمدة والممثل المقترحة", ui.rec && ui.recSel.type === "ugc" && ui.recSel.len === 8 && ui.recSel.actor === "woman" && ui.txtImgs >= 1, ui.recSel);
  ok("حدّ 4 صور مهما استوردت", ui.afterStore <= 4, ui.afterStore);
  ok("لغتان: دارجة + فرنسية، وخطة بلقطات ونصّين", ui.langs === "dz,fr" && ui.shots === 3 && ui.scripts === 2 && ui.planSent, ui);
  ok("التوليد: نسخة لكل لغة بالممثل نفسه (seed واحد) وصوت ونص كل لغة", ui.vids.length === 2 && ui.vids[0].lang === "dz" && ui.vids[1].lang === "fr" && ui.vids[0].seed === ui.vids[1].seed && ui.vids.every(v => v.audio === true) && ui.vids[0].script === "نص معدّل يشفي كل شيء", ui.vids.map(v => [v.lang, v.seed]));
  ok("تعديلات المستخدم تصل التعليمات: اللقطة المعدّلة والتنسيق والمدة", ui.vids[0].ratio === "16:9" && ui.vids[0].dur === 10 && /لقطة معدّلة/.test(ui.vids[0].prompt) && /horizontal/.test(ui.vids[0].prompt) && ui.vids[0].n === 4, [ui.vids[0].ratio, ui.vids[0].dur, ui.vids[0].n]);
  ok("فيديوهان ظاهران وإضافة الثاني للصفحة", ui.videos === 2 && ui.added.length === 1 && /fr/.test(ui.added[0]) && ui.up[1] === "video/mp4", [ui.videos, ui.added]);
  ok("بلا أخطاء JS", errs.length === 0, errs);
  console.log(fails ? "فشل " + fails + " من " + total : "نجح " + total + " من " + total);
  await b.close(); process.exit(fails ? 1 : 0);
})();
