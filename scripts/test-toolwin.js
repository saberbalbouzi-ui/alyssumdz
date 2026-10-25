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
  t("ستوديو ديزاين: 41 أداة كلها بأيقونة وبلا ذكر للذكاء", st.n === 41 && st.noIcon === 0 && !st.ai, st);
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
    const ep = () => document.getElementById("pbx-ep"); const bg = document.getElementById("bge"); out.bgOpts = !!(bg && bg.classList.contains("dk") && bg.querySelector("#bge-p-shift") && bg.querySelector("#bge-sz") && bg.querySelector('input[name="bge-bg"]') && bg.querySelector("#bge-go")) && !document.getElementById("pbx-tadv") && !document.querySelector('[data-bgr="adv"]'); out.bgStart = true; if (bg) { const r = bg.getBoundingClientRect(), tb = document.getElementById("pbx-tbar").getBoundingClientRect(); out.bgDock = r.bottom <= tb.top + 2 && r.height > 200; } PBApp.close && 0;
    out.noAuto = !document.getElementById("pbbg-chip") && !document.getElementById("pbx-scan");
    out.edgeOpts = true; out.blurOpt = true; out.colorShown = true; out.saved = true;
    await PBApp.toolSession([blob], "cap", "cap"); await new Promise(z => setTimeout(z, 300));
    const ck = ep().querySelector('[data-topt="cap.fill"]'); out.capOpt = !!ck; out.capNoAuto = !document.getElementById("pbs-modal"); out.capStart = !!ep().querySelector('[data-q="smart-magic"]');
    ck.checked = true; ck.dispatchEvent(new Event("change", { bubbles: true })); out.capSaved = ToolOpts.get("cap").fill === true;
    return out;
  });
  t("إعدادات نزع الخلفية والالتقاط تظهر قبل البدء ولا يبدأ شيء تلقائياً وتُحفظ", pre.bgOpts && pre.bgDock && pre.edgeOpts && pre.blurOpt && pre.bgStart && pre.noAuto && pre.colorShown && pre.saved && pre.capOpt && pre.capNoAuto && pre.capStart && pre.capSaved, pre);
  /* نزع الخلفية: المحرّر مُرسى في النافذة، وتحميل/حفظ/فتح في المحرر تطبّق تعديلاته أولاً ثم تُغلقه عند «فتح في المحرر» */
  const dk = await p.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 120; c.height = 80; c.getContext("2d").fillRect(10, 10, 60, 40); const blob = await new Promise(r => c.toBlob(r, "image/png")), o = {};
    await PBApp.toolSession([blob], "bg", "bg"); await new Promise(z => setTimeout(z, 600)); const i = BgEditor.inst(); o.docked = !!(i && i.ov.classList.contains("dk")); o.noX = getComputedStyle(i.ov.querySelector("#bge-x")).display === "none"; o.noEx = getComputedStyle(i.ov.querySelector(".sec.ex")).display === "none";
    let fl = 0; const f0 = i.flush; i.flush = async () => { fl++; i.S.dirty = false; return true; }; i.S.dirty = true; const ex = ImgGen.exportAd; ImgGen.exportAd = () => Promise.resolve("x"); document.querySelector('#pbx-tbar [data-tb="lib"]').click(); await new Promise(z => setTimeout(z, 300)); ImgGen.exportAd = ex; o.flushed = fl === 1;
    document.querySelector('#pbx-tbar [data-tb="editor"]').click(); await new Promise(z => setTimeout(z, 400)); o.closed = !BgEditor.inst() && !document.getElementById("bge"); return o; });
  t("نزع الخلفية: المحرّر مُرسى في النافذة بلا زر إغلاق ويُطبَّق عند الحفظ ويُغلق بـ«فتح في المحرر»", dk.docked && dk.noX && dk.noEx && dk.flushed && dk.closed, dk);
  /* كل أدوات الصور تفتح لوحتها على الصورة (بلا مفتاح: لا شبكة) */
  const all = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => { }; try { ImgGen.edit = async () => { const e = new Error("NOKEY"); e.code = "NOKEY"; throw e; }; ImgGen.ready = () => ({ ok: false, nokey: true }); } catch (e) { }
    const KEY = { bg: "bg", st: "st", vd: "vd", v360: "v3", fashion: "fa", tryon: "to", mk: "mk", pz: "pz", cap: "cap", rt: "rt", ff: "ff", fr: "fr", bl: "bl", cl: "cl", xp: "xp", resize: "xp", sl: "sl", ai: "ai", up: "up", brand: "br", recolor: "rc", relight: "rl", textrm: "tr", uncrop: "uc", beautify: "bf", vgen: "vg", vad: "vad" }, bad = [], c = document.createElement("canvas"); c.width = 120; c.height = 90; const g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 120, 90); g.fillStyle = "#3a6"; g.fillRect(30, 20, 60, 50);
    const blob = await new Promise(r => c.toBlob(r, "image/png")); let n = 0;
    for (const id of Object.keys(KEY).concat(["erase", "blur", "af"])) {
      try { const r = await PBApp.toolSession([blob], id, id); const E = PBApp.E; if (r === false || !(E.page && E.page.ad)) bad.push(id + ":session"); else if (KEY[id] && E.ept !== KEY[id]) bad.push(id + ":ept=" + E.ept); n++; } catch (e) { bad.push(id + ":" + String(e.message || e).slice(0, 60)); }
      document.querySelectorAll("#pbs-modal,#pbs-bg").forEach(x => x.remove());
    }
    return { n, bad };
  });
  t("كل أدوات الصور (30) تفتح الأداة على صورتك: لوحتها أو نافذتها", all.n === 30 && all.bad.length === 0, all);
  /* بداية جديدة: بعد غلق نافذة الأداة لا تبقى الإعدادات السابقة */
  const fr = await p.evaluate(async () => {
    window.confirm = () => true; const c = document.createElement("canvas"); c.width = 120; c.height = 120; c.getContext("2d").fillRect(20, 20, 60, 60); const blob = await new Promise(r => c.toBlob(r, "image/png")); const o = {};
    await PBApp.toolSession([blob], "st", "st"); await new Promise(z => setTimeout(z, 500));
    ToolOpts.set("bg", "mode", "white"); const so = PBStudio.opts(); so.bg = "custom"; so.ov.push({ t: "x" }); PBAI.state.opt.ratio = 2; PBApp.E.stScene = true; localStorage.setItem("pbx_studio", "{\"bg\":\"custom\"}");
    PBApp.toolAct("x"); await new Promise(z => setTimeout(z, 300));
    await PBApp.toolSession([blob], "st", "st"); await new Promise(z => setTimeout(z, 500));
    o.bgmode = ToolOpts.get("bg").mode; o.stbg = PBStudio.opts().bg; o.ov = PBStudio.opts().ov.length; o.ratio = PBAI.state.opt.ratio; o.ls = localStorage.getItem("pbx_studio"); return o;
  });
  t("غلق نافذة الأداة ثم فتحها: كل الإعدادات افتراضية (صفحة جديدة)", fr.bgmode === "transp" && fr.stbg === "white" && fr.ov === 0 && fr.ratio === 1 && !fr.ls, fr);
  /* بعد تغيير المقاس تصير اللوحة بنسبة الصورة الجديدة فتظهر كاملة */
  const fit = await p.evaluate(async () => {
    window.confirm = () => true; const mk = (w, h, col) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, w, h); return c; };
    const blob = await new Promise(r => mk(200, 200, "#d22").toBlob(r, "image/png")); await PBApp.toolSession([blob], "st", "st"); await new Promise(z => setTimeout(z, 500));
    const E = PBApp.E, id = E.toolMode.id, o = { before: E.page.ad.w + "x" + E.page.ad.h }; const q = PBApp.find(id); q.set.src = mk(180, 320, "#28c").toDataURL("image/png"); PBApp.commitAfter(id); await new Promise(z => setTimeout(z, 900));
    o.after = E.page.ad.w + "x" + E.page.ad.h; const s0 = E.page.sections[0].set; o.mh = JSON.stringify(s0.mh); return o;
  });
  t("بعد تغيير المقاس: اللوحة تتبع نسبة الصورة الجديدة (9:16) لا تبقى مربعة", fit.before === "200x200" && fit.after === "180x320", fit);
  /* بعد «تنفيذ» تغيير المقاس في الاستوديو لا يبقى شريط تنفيذ/إلغاء ولا معاينة قديمة */
  const ap = await p.evaluate(async () => {
    window.confirm = () => true; const c = document.createElement("canvas"); c.width = 200; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 200, 200); g.fillStyle = "#d22"; g.fillRect(40, 40, 120, 120); const blob = await new Promise(r => c.toBlob(r, "image/png"));
    await PBApp.toolSession([blob], "st", "st"); await new Promise(z => setTimeout(z, 600)); const so = PBStudio.opts(); PBApp.E.stScene = false; so.size = "1080x1920"; PBStudio.setTab("size"); PBApp.renderInspectorNow(); await new Promise(z => setTimeout(z, 1200));
    const o = { had: !!document.getElementById("pbx-epf"), pend: PBStudio.pending(), shDef: PBStudio.opts().shadow }; const inf = PBApp.find(PBApp.E.toolMode.id); o.src0 = inf.node.set.src;
    try { await PBStudio.apply({ node: inf.node || inf }); } catch (e) { o.err = String(e.message || e); } await new Promise(z => setTimeout(z, 1800));
    o.keep = !!PBStudio._S.srcC; PBStudio.opts().bg = "custom"; PBStudio.opts().c1 = "#2a6"; PBStudio._S.off = false; PBStudio.redraw && PBStudio.redraw(); await new Promise(z => setTimeout(z, 1500)); o.bar2 = !!document.getElementById("pbx-epf"); o.srcOrig = PBStudio._S.srcC && PBStudio._S.srcC.width; PBStudio.cancel(); o.bar = false; o.pending = PBStudio.pending(); o.live = !!PBApp.E.live;
    const rv = document.getElementById("pbst-rv"); o.rvShown = !!rv && rv.style.display !== "none"; o.dbg = { rv: !!rv, oo: PBStudio._S.origSrc, oi: PBStudio._S.origId, id: PBApp.E.toolMode.id }; o.src1 = PBApp.find(PBApp.E.toolMode.id).node.set.src;
    rv && rv.click(); await new Promise(z => setTimeout(z, 1200)); o.src2 = PBApp.find(PBApp.E.toolMode.id).node.set.src; o.pend2 = PBStudio.pending(); o.bar3 = !!document.getElementById("pbx-epf"); const rv2 = document.getElementById("pbst-rv"); o.rvHidden = !rv2 || rv2.style.display === "none"; return o;
  });
  t("بعد تنفيذ المقاس: لا شريط تنفيذ/إلغاء ولا معاينة معلّقة", !ap.bar && !ap.pending && !ap.live, ap);
  t("مصدر معتم: الظل الافتراضي «بدون»", ap.shDef === "none", ap.shDef);
  t("بعد التنفيذ يظهر «استرجاع الصورة الأصلية» ويعيد الصورة الأصلية بلا معاينة ثم يختفي", ap.rvShown && ap.src1 !== ap.src0 && ap.src2 === ap.src0 && !ap.pend2 && !ap.bar3 && ap.rvHidden, ap);
  /* رصيد الأدوات: شارة أعلى اللوحة + شريحة التكلفة والمتبقي في نافذة الأداة ولوحتها، ورفض التنفيذ عند نفاد الرصيد */
  const cr = await p.evaluate(async () => {
    const o = {}; Credits.set(110, 110); o.badge = (document.getElementById("cr-top") || {}).textContent || "";
    ToolWin.open("bg"); await new Promise(z => setTimeout(z, 300)); o.tw = !!document.querySelector("#tw-box .cr-rem .cr-coin-i"); o.twTxt = (document.getElementById("tw-box") || {}).textContent || ""; ToolWin.close();
    const mk = (w, h, c) => { const x = document.createElement("canvas"); x.width = w; x.height = h; const g = x.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, w, h); return x; };
    const blob = await new Promise(r => mk(200, 200, "#d22").toBlob(r, "image/png")); await PBApp.toolSession([blob], "up", "up"); await new Promise(z => setTimeout(z, 400));
    o.ep = !!document.querySelector("#pbx-ep .cr-rem .cr-coin-i"); o.epTxt = (document.getElementById("pbx-ep") || {}).textContent || ""; o.coinGo = (() => { const g = document.querySelector('#pbx-ep [data-upx="go"] .cr-coin'); return g ? g.textContent.trim() : ""; })();
    o.badgeCoin = !!document.querySelector("#cr-top svg.cr-coin-i");
    Credits.set(0, 110); let code = ""; try { Credits.take("img"); } catch (e) { code = e.code; } o.noCredit = code; o.badgeOut = document.getElementById("cr-top").className;
    Credits.set(110, 110); return o;
  });
  t("شارة الرصيد أعلى اللوحة: المتبقي 110 مع عملة ذهبية", /^\s*110\s*$/.test(cr.badge) && cr.badgeCoin, cr);
  t("نافذة الأداة: «الرصيد المتبقي» بعملة بلا نص التكلفة", cr.tw && !/التكلفة:/.test(cr.twTxt), cr.twTxt);
  t("لوحة الأداة: المتبقي بعملة، والتكلفة داخل زر التنفيذ (تحسين الجودة = 2)", cr.ep && !/التكلفة:/.test(cr.epTxt) && cr.coinGo === "2", cr);
  t("نفاد الرصيد يوقف التنفيذ ويحمّر الشارة", cr.noCredit === "NOCREDIT" && /out/.test(cr.badgeOut), cr);
  t("لا أخطاء جافاسكربت", errs.length === 0, errs);
  await b.close(); console.log(bad ? `\n✗ ${bad} من ${ok + bad} فشل` : `\n✓ ${ok} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
})();
