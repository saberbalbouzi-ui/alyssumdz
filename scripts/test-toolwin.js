/* اختبار «ستوديو ديزاين»: لكل أداة أيقونة وصفحة، ونافذة تحميل الصورة تفتح الأداة على الصورة في المطوّر، وبلا ذكر للذكاء ولا خيار مجاني في أدوات الاستهلاك.
   تشغيل: python3 -m http.server 8765 & ثم NODE_PATH=/opt/node-tools/node_modules node scripts/test-toolwin.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log("✓", n); } else { bad++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } };
const root = path.join(__dirname, "..");
(async () => {
  /* ١) الكتالوج: أيقونة لكل أداة وملفها موجود، وبلا كلمات الذكاء في الاسم والوصف */
  const cat = JSON.parse(fs.readFileSync(path.join(root, "assets/data/tools-catalog.json"), "utf8")).tools;
  t("كل أداة لها أيقونة وملفها موجود", cat.every(x => x.ic && fs.existsSync(path.join(root, "assets/img/tools/ic", x.ic + ".webp"))), cat.filter(x => !x.ic || !fs.existsSync(path.join(root, "assets/img/tools/ic", x.ic + ".webp"))).map(x => x.id));
  const AIW = /ذكاء|ذكي|ذكية|الاصطناعي/;
  t("لا ذكر للذكاء في أسماء الأدوات ووصفها وخطواتها", !cat.some(x => AIW.test([x.name, x.tag, x.what, ...(x.steps || []), ...(x.tips || [])].join(" "))), cat.filter(x => AIW.test([x.name, x.tag, x.what, ...(x.steps || []), ...(x.tips || [])].join(" "))).map(x => x.id));
  const tools = JSON.parse(fs.readFileSync(path.join(root, "saas/guide/tools.json"), "utf8")).tools;
  t("أدوات الاستهلاك (Alyssum API) بلا خيار مجاني في اسمها ووصفها", !tools.filter(x => x.needs === "ai").some(x => /مجان/.test([x.name, x.tag, x.what, ...(x.steps || []), ...(x.tips || []), x.needsText].join(" "))), tools.filter(x => x.needs === "ai" && /مجان/.test([x.name, x.tag, x.what, ...(x.steps || []), ...(x.tips || []), x.needsText].join(" "))).map(x => x.id));
  const land = fs.readdirSync(path.join(root, "saas/landing")).filter(d => fs.existsSync(path.join(root, "saas/landing", d, "index.html")));
  t("صفحات التعريف بلا ذكر للذكاء ولا «ابدأ مجاناً»", !land.some(d => { const h = fs.readFileSync(path.join(root, "saas/landing", d, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""); return AIW.test(h) || /ابدأ مجاناً/.test(h); }), land.filter(d => { const h = fs.readFileSync(path.join(root, "saas/landing", d, "index.html"), "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""); return AIW.test(h) || /ابدأ مجاناً/.test(h); }));
  /* ٢) الواجهة */
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  t("الوحدة محمّلة وتميّز الأدوات", await p.evaluate(() => typeof ToolWin === "object" && ToolWin.has("mk") && ToolWin.has("up") && ToolWin.has("bg") && !ToolWin.has("barcode") && !ToolWin.has("studio3d") && !ToolWin.has("gen") && typeof PBApp.toolSession === "function"));
  /* ستوديو ديزاين: كل أداة بطاقة بأيقونة */
  await p.evaluate(() => { try { Admin.tab("studio"); } catch (e) { document.getElementById("tab-studio").classList.remove("hidden"); } });
  await p.waitForFunction(() => document.querySelectorAll("#studio-content .sd-card").length >= 43, null, { timeout: 8000 }).catch(() => { });
  const st = await p.evaluate(() => { const cs = [...document.querySelectorAll("#studio-content .sd-card")]; return { n: cs.length, noIcon: cs.filter(c => !c.querySelector(".sd-h img")).length, ai: /ذكاء|ذكي|ذكية/.test(document.getElementById("studio-content").innerText) }; });
  t("ستوديو ديزاين: 44 أداة كلها بأيقونة وبلا ذكر للذكاء", st.n === 44 && st.noIcon === 0 && !st.ai, st);
  /* صفحة أداة بلا صفحة تعريف: زر «ابدأ الآن» */
  await p.evaluate(() => AdminStudio.open("mk")); await p.waitForTimeout(300);
  t("صفحة الأداة فيها «ابدأ الآن»", await p.evaluate(() => { const b = document.querySelector('#studio-content [data-sdgo="mk"]'); return !!b && /ابدأ الآن/.test(b.textContent); }));
  /* نافذة الأداة: رفع صورة ثم تُفتح الأداة على الصورة في المطوّر */
  const png = path.join(require("os").tmpdir(), "tw-test.png");
  require("child_process").execFileSync("python3", ["-c", "from PIL import Image; im=Image.new('RGB',(150,100),(200,60,60)); im.paste((30,160,90),(40,20,110,80)); im.save('" + png + "')"]);
  await p.evaluate(() => ToolWin.open("mk")); await p.waitForSelector("#tw-box"); 
  t("النافذة: منطقة تحميل وزر البدء معطّل قبل الصورة", await p.evaluate(() => !!document.getElementById("tw-dz") && document.querySelector('#tw-box [data-tw="go"]').disabled));
  await p.setInputFiles("#tw-file", png); await p.waitForTimeout(300);
  t("بعد اختيار الصورة تظهر معاينتها ويتفعّل الزر", await p.evaluate(() => document.querySelectorAll("#tw-box .tw-pv img").length === 1 && !document.querySelector('#tw-box [data-tw="go"]').disabled));
  await p.evaluate(() => document.querySelector('#tw-box [data-tw="go"]').click());
  await p.waitForFunction(() => !document.getElementById("tw-bg") && PBApp.E && PBApp.E.page && PBApp.E.page.ad && document.getElementById("pbx-ep"), null, { timeout: 25000 }).catch(() => { });
  const ss = await p.evaluate(() => { const E = PBApp.E, sec = E && E.page && E.page.sections[0], im = sec && (sec.free || []).find(w => w.type === "image"), ep = document.getElementById("pbx-ep"); return { ad: !!(E.page && E.page.ad), hasImg: !!im, sel: !!(im && E.sel === im.id), size: E.page && E.page.ad && E.page.ad.w + "x" + E.page.ad.h, panel: !!ep, ept: E.ept, closed: !document.getElementById("tw-bg") }; });
  t("الجلسة: لوحة بمقاس الصورة (150×100) والصورة محدّدة ولوحة «ماسك» مفتوحة", ss.ad && ss.hasImg && ss.sel && ss.size === "150x100" && ss.panel && ss.ept === "mk" && ss.closed, ss);
  const sc = await p.evaluate(() => { const E = PBApp.E, id = E.sel; const stop = PBApp.scanOver(id), b = document.getElementById("pbx-scan"), r = b && b.getBoundingClientRect(), ok = !!(b && r.width > 50 && r.height > 50 && b.querySelector(".pbs-tint-x") && b.querySelector(".pbs-scanline-x")), anim = b && getComputedStyle(b.querySelector(".pbs-scanline-x")).animationName; stop(); return { ok, anim, gone: !document.getElementById("pbx-scan") }; });
  t("غشاء ومسح نزع الخلفية: نفس مؤثر التقاط العناصر فوق الصورة ويزول عند الانتهاء", sc.ok && /pbsScan/.test(sc.anim) && sc.gone, sc);
  /* وضع نافذة الأداة: شريط النتيجة (فتح في المحرر/تحميل/حفظ في المكتبة) وإخفاء أشرطة المحرر، ثم «فتح في المحرر» يعيدها */
  const tm = await p.evaluate(async () => { const v = id => { const e = document.getElementById(id); return !!(e && e.offsetParent !== null); }, app = document.getElementById("pb-app"), B = () => [...document.querySelectorAll("#pbx-tbar [data-tb]")].map(b => b.dataset.tb);
    const r = { on: app.classList.contains("pbx-tool"), bar: v("pbx-tbar"), btns: B().join(","), left: v("pbx-lside"), pub: [...document.querySelectorAll(".pbx-top .pub")].some(b => b.offsetParent !== null), panel: (() => { const e = document.getElementById("pbx-ep"); const r = e && e.getBoundingClientRect(); return !!(r && r.width > 150 && r.height > 150); })(), name: document.getElementById("pbx-tname").textContent };
    const calls = []; const ex = ImgGen.exportAd; ImgGen.exportAd = o => { calls.push(o && o.act + ":" + o.fmt); return Promise.resolve("assets/img/x.webp"); };
    document.querySelector('#pbx-tbar [data-tb="dl"]').click(); r.fmtPop = !!document.getElementById("pbx-tfp"); r.noSel = !document.getElementById("pbx-tfmt"); const fb = document.querySelector('#pbx-tfp [data-f="webp"]'); if (fb) fb.click(); document.querySelector('#pbx-tbar [data-tb="lib"]').click(); await new Promise(z => setTimeout(z, 100)); r.libBtn = document.querySelector('#pbx-tbar [data-tb="lib"]').textContent; ImgGen.exportAd = ex; r.calls = calls.join(",");
    document.querySelector('#pbx-tbar [data-tb="editor"]').click(); await new Promise(z => setTimeout(z, 200)); r.off = !app.classList.contains("pbx-tool") && !PBApp.toolMode(); r.leftBack = v("pbx-lside"); return r; });
  t("وضع نافذة الأداة: شريط النتيجة ظاهر وأشرطة المحرر مخفية وإعدادات الأداة مفتوحة", tm.on && tm.bar && !tm.left && !tm.pub && tm.panel && /editor,dl,lib,x/.test(tm.btns) && !/reopen/.test(tm.btns) && !!tm.name, tm);
  t("تحميل/حفظ في المكتبة يستدعيان التصدير المباشر، و«فتح في المحرر» يعيد المحرر الكامل", tm.calls === "download:webp,library:undefined" && tm.fmtPop && tm.noSel && /جارٍ|تم/.test(tm.libBtn) && tm.off && tm.leftBack, tm);
  /* إعدادات تظهر قبل البدء: لا تبدأ الأداة عند فتح النافذة، والخيارات تُحفظ وتُقرأ عند «ابدأ» */
  const pre = await p.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 120; c.height = 80; c.getContext("2d").fillRect(10, 10, 60, 40); const blob = await new Promise(r => c.toBlob(r, "image/png")), out = {};
    try { localStorage.removeItem("alyssum_toolopts"); } catch (e) { }
    await PBApp.toolSession([blob], "bg", "bg"); await new Promise(z => setTimeout(z, 300));
    const ep = () => document.getElementById("pbx-ep"); out.bgOpts = !!(ep() && ep().querySelector('[data-bgm="transp"]') && ep().querySelector('[data-topt="bg.edit"]')); out.bgStart = !!(ep() && ep().querySelector('[data-bgr="open"]') && /ابدأ/.test(ep().querySelector('[data-bgr="open"]').textContent));
    out.noAuto = !document.getElementById("pbbg-chip") && !document.getElementById("pbx-scan");
    const sel = ep().querySelector('[data-topt="bg.color"]'); sel.value = "#336699"; sel.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(z => setTimeout(z, 100));
    out.edgeOpts = !!(ep().querySelector('[data-topt="bg.shift"]') && ep().querySelector('[data-topt="bg.contrast"]') && ep().querySelector('[data-topt="bg.trim"]')); out.blurOpt = !!ep().querySelector('[data-bgm="blur"]') && !!ep().querySelector('[data-bgm="image"]'); out.colorShown = !!ep().querySelector('[data-topt="bg.color"]'); out.saved = ToolOpts.get("bg").mode === "color";
    await PBApp.toolSession([blob], "cap", "cap"); await new Promise(z => setTimeout(z, 300));
    const ck = ep().querySelector('[data-topt="cap.fill"]'); out.capOpt = !!ck; out.capNoAuto = !document.getElementById("pbs-modal"); out.capStart = !!ep().querySelector('[data-q="smart-magic"]');
    ck.checked = true; ck.dispatchEvent(new Event("change", { bubbles: true })); out.capSaved = ToolOpts.get("cap").fill === true;
    return out;
  });
  t("إعدادات نزع الخلفية والالتقاط تظهر قبل البدء ولا يبدأ شيء تلقائياً وتُحفظ", pre.bgOpts && pre.edgeOpts && pre.blurOpt && pre.bgStart && pre.noAuto && pre.colorShown && pre.saved && pre.capOpt && pre.capNoAuto && pre.capStart && pre.capSaved, pre);
  /* كل أدوات الصور تفتح لوحتها على الصورة (بلا مفتاح: لا شبكة) */
  const all = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { }; try { ImgGen.edit = async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }; ImgGen.ready = () => ({ ok: false, nokey: true }); } catch (e) { }
    const KEY = { bg: "bg", st: "st", vd: "vd", v360: "v3", fashion: "fa", tryon: "to", pshoot: "ps", bgen: "bgn", mk: "mk", pz: "pz", cap: "cap", rt: "rt", ff: "ff", fr: "fr", bl: "bl", cl: "cl", xp: "xp", resize: "xp", sl: "sl", ai: "ai", up: "up", brand: "br", recolor: "rc", relight: "rl", textrm: "tr", uncrop: "uc", beautify: "bf", vgen: "vg", vad: "vad" }, bad = [], c = document.createElement("canvas"); c.width = 120; c.height = 90; const g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 120, 90); g.fillStyle = "#3a6"; g.fillRect(30, 20, 60, 50);
    const blob = await new Promise(r => c.toBlob(r, "image/png")); let n = 0;
    for (const id of Object.keys(KEY).concat(["erase", "scene", "blur", "af"])) {
      try { const r = await PBApp.toolSession([blob], id, id); const E = PBApp.E; if (r === false || !(E.page && E.page.ad)) bad.push(id + ":session"); else if (KEY[id] && E.ept !== KEY[id]) bad.push(id + ":ept=" + E.ept); n++; } catch (e) { bad.push(id + ":" + String(e.message || e).slice(0, 60)); }
      document.querySelectorAll("#pbs-modal,#pbs-bg").forEach(x => x.remove());
    }
    return { n, bad };
  });
  t("كل أدوات الصور (33) تفتح الأداة على صورتك: لوحتها أو نافذتها", all.n === 33 && all.bad.length === 0, all);
  t("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(bad ? `\n✗ ${bad} من ${ok + bad} فشل` : `\n✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
})();
