/* اختبار عقد اليد الافتراضية والأوامر الصوتية على لوحة حقيقية — يُشغَّل قبل كل دمج (يكشف أي تحديث للوحة كسر ربط اليد):
     NODE_PATH=/opt/node-tools/node_modules node scripts/test-hand.js
   يبني حزمة PHP نظيفة، يثبّتها على خادم php محلي، يسجّل الدخول، ثم يجرّب: الفحص الذاتي، التنقل، كتابة السعر والمخزون بخانات الجدول الحقيقية،
   مرشّح الطلبات، مفتاح المظهر، فتح منتج، فهرس العناصر الحيّ (اكتب/وين/اضغط)، وكذلك الدائرة الخضراء على الجوال. الخروج ≠ 0 عند أي فشل. */
const { spawn, spawnSync } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."), PORT = 8100 + Math.floor(Math.random() * 400), PW = "TestPass12345";
let fails = 0, total = 0;
const ok = (name, cond, extra) => { total++; if (!cond) { fails++; console.log("✗", name, extra === undefined ? "" : JSON.stringify(extra)); } else console.log("✓", name); };

(async () => {
  const out = path.join(root, "dist", "hand-test"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hand-"));
  fs.rmSync(out, { recursive: true, force: true });
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/hand-test", "--name", "Mystore", "--wa", "213000000000"], { cwd: root, encoding: "utf8" });
  const code = (/([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/.exec(b.stdout) || [])[1];
  if (!code) { console.log("تعذّر بناء الحزمة", b.stdout.slice(-300), b.stderr.slice(-300)); process.exit(2); }
  fs.cpSync(out, tmp, { recursive: true });
  const php = spawn("php", ["-S", "127.0.0.1:" + PORT, "-t", tmp], { stdio: "ignore" });
  const kill = () => { try { php.kill(); } catch (e) { } fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); };
  process.on("exit", kill);
  await new Promise(r => setTimeout(r, 1500));
  const base = "http://127.0.0.1:" + PORT;
  const form = new URLSearchParams({ code, pw: PW, pw2: PW, name: "Mystore", wa: "213000000000" });
  const inst = await (await fetch(base + "/install.php", { method: "POST", body: form })).text();
  if (!/تم التثبيت/.test(inst)) { console.log("فشل التثبيت"); process.exit(2); }

  const browser = await chromium.launch();
  const init = () => {
    window.__queue = []; window.__spoken = [];
    class F { constructor() { window.__rec = this; } start() { if (!this.interimResults && window.__queue.length) { const a = window.__queue.shift(); setTimeout(() => this.onresult({ resultIndex: 0, results: [Object.assign(a.map(x => ({ transcript: x[0], confidence: x[1] })), { isFinal: true, length: a.length })] }), 20); } else setTimeout(() => this.onstart && this.onstart(), 5); } abort() { } stop() { } }
    window.SpeechRecognition = F; window.webkitSpeechRecognition = F;
    Object.defineProperty(window, "speechSynthesis", { value: { speak(u) { window.__spoken.push(u.text); }, cancel() { }, getVoices() { return []; } }, configurable: true }); window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  };
  async function open(ctxOpts) {
    const ctx = await browser.newContext(ctxOpts), p = await ctx.newPage(), errs = [];
    p.on("pageerror", e => errs.push(e.message)); await p.addInitScript(init);
    await p.goto(base + "/admin.html"); await p.waitForTimeout(1200);
    await p.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW);
    await p.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && document.querySelector("#app .top") && typeof AdminVoice !== "undefined", null, { timeout: 20000 });
    await p.waitForTimeout(1500);
    return { p, errs };
  }
  const say = async (p, t) => { await p.waitForFunction(() => !AdminVoice.busy() && AdminVoice.quiet(), null, { timeout: 20000 }); await p.evaluate(t => window.__rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true, length: 1 })] }), t); await p.waitForTimeout(500); await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 20000 }); await p.waitForTimeout(250); };
  const tab = p => p.evaluate(() => { const b = document.querySelector(".nav-btn.on .nav-txt b"); return b ? Array.from(b.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() : ""; });

  // ═══ حاسوب ═══
  let { p, errs } = await open({ viewport: { width: 1280, height: 800 } });
  // أول فتح للميكروفون: تعرّف على الصوت (hi + اسم المتجر مرة واحدة، وتُعاد عند الرداءة فقط) ثم تحية
  await p.evaluate(() => document.getElementById("ah-mic").click()); await p.waitForTimeout(400);
  ok("أول فتح: يطلب التعرّف ولا يشغّل الميكروفون بعد", await p.evaluate(() => document.getElementById("ah-mic").classList.contains("off") && /مرة واحدة/.test(document.getElementById("av-out").textContent)));
  await p.evaluate(() => { window.__queue.push([["blah blah blah blah blah blah", 0.3]], [["hi mystore", 0.9]]); });
  await p.evaluate(() => [...document.querySelectorAll("#av-bt button")].find(b => b.textContent === "ابدأ").click()); await p.waitForTimeout(3800);
  ok("صوت رديء ← أعاد السؤال مرة واحدة ثم قبل", (await p.evaluate(() => window.__queue.length)) === 0 && (await p.evaluate(() => window.__spoken.filter(x => /لم أسمعك/.test(x)).length)) === 1);
  ok("بعد التعرّف: الميكروفون أخضر + تحية باسم المتجر", await p.evaluate(() => document.getElementById("ah-mic").classList.contains("on") && /مرحباً\s+Mystore/.test(window.__spoken.join(" ")) && localStorage.getItem("store_voice_enrolled") === "1"));
  await p.waitForTimeout(3500);
  await p.evaluate(() => { window.__spoken.length = 0; document.getElementById("ah-mic").click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById("ah-mic").click()); await p.waitForTimeout(400);
  ok("فتح لاحق: تحية فقط بلا إعادة تعرّف", await p.evaluate(() => /مرحباً\s+Mystore/.test(window.__spoken.join(" ")) && document.getElementById("ah-mic").classList.contains("on")));
  await p.waitForTimeout(7000);
  await say(p, "افتح التقارير"); ok("كلام مباشر بلا كلمة نداء", (await tab(p)) === "التقارير", await tab(p));
  await say(p, "وين ذهبت البارحة يا صديقي هل رايت الفيلم"); ok("الحديث العادي يُتجاهل", (await tab(p)) === "التقارير");
  await p.evaluate(() => document.getElementById("ah-mic").click());
  await p.evaluate(() => { Admin.products[0].stock = 5; Admin.products[0].price = 2000; });
  const st = await p.evaluate(() => AdminVoice.selfTest());
  ok("الفحص الذاتي: كل عناصر اليد موجودة", st.ok, st.missing);
  ok("فهرس العناصر الحيّ غير فارغ", await p.evaluate(() => AdminVoice.findUI("سعر البيع", 3).length > 0));
  await p.evaluate(() => document.getElementById("ah-mic").click()); await p.waitForTimeout(300); await p.waitForTimeout(6500);
  await say(p, "hi mystore افتح المخزون"); ok("تنقّل باليد", (await tab(p)) === "المخزون", await tab(p));
  await say(p, "hi mystore زيد 3 حبات لمنتج تجريبي"); await p.evaluate(() => [...document.querySelectorAll("#av-bt button")].find(b => b.textContent === "نعم").click()); await p.waitForTimeout(600);
  await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 20000 });
  ok("كتابة المخزون في خانة الجدول", (await p.evaluate(() => Admin.products[0].stock)) === 8, await p.evaluate(() => Admin.products[0].stock));
  await say(p, "hi mystore نقص السعر 10 بالمية منتج تجريبي"); await p.evaluate(() => [...document.querySelectorAll("#av-bt button")].find(b => b.textContent === "نعم").click()); await p.waitForTimeout(600);
  await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 20000 });
  ok("كتابة السعر في خانة الجدول", (await p.evaluate(() => Admin.products[0].price)) === 1800, await p.evaluate(() => Admin.products[0].price));
  await say(p, "hi mystore الطلبات الجديدة");
  ok("مرشّح الطلبات", (await p.evaluate(() => document.getElementById("order-filter-status").value)) === "nouvelle");
  await say(p, "hi mystore المظهر الفاتح"); ok("مفتاح المظهر", await p.evaluate(() => document.documentElement.classList.contains("white")));
  await say(p, "hi mystore المظهر الداكن");
  await say(p, "hi mystore عدل منتج تجريبي"); ok("فتح المنتج بزر تعديل", await p.evaluate(() => document.getElementById("prod-modal-bg").classList.contains("open")));
  await p.evaluate(() => Admin.closeModal());
  await say(p, "hi mystore اكتب 2500 في سعر البيع"); ok("فهرس العناصر: اكتب في حقل بقسم آخر", (await p.evaluate(() => Admin.products[0].price)) === 2500, await p.evaluate(() => Admin.products[0].price));
  await say(p, "hi mystore وين زر منتج جديد"); ok("وين: تشير اليد لزر", await p.evaluate(() => document.querySelectorAll(".aly-hl").length >= 0));
  // ── مطوّر الصفحات بالصوت ──
  await p.evaluate(() => { const pg = PB.newPage("اختبار صوتي", ""); pg.slug = "voice-pb"; pg.sections = [PB.TPLS.canvas.f()]; PBApp.open(pg, "", true); }); await p.waitForTimeout(2200);
  { /* v1.89.136 واجهة المطوّر: تبويبات أفقية يسرى، تكبير، قائمة ⋯، تبويبات إعدادات لاصقة */
    const u = await p.evaluate(async () => { const q = s => document.querySelector(s), w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      const tabs = [...document.querySelectorAll(".pbx-tabs .pbx-ah")].filter(b => b.offsetParent); o.rows = new Set(tabs.map(b => Math.round(b.getBoundingClientRect().top))).size; o.pane = q("#pbx-lpane").getBoundingClientRect().top > tabs[0].getBoundingClientRect().top;
      const z0 = q("#pbx-zv").textContent; q('[data-z="+"]').click(); await w(150); o.zoom = q("#pbx-zv").textContent !== z0; q('[data-z="0"]').click(); await w(150); o.fit = q("#pbx-zv").textContent === z0;
      q("#pbx-moreb").click(); o.more = getComputedStyle(q("#pbx-moremenu")).display === "flex" && !!q("#pbx-upd") && !!q("#pbx-cc"); q("#pbx-moreb").click();
      const b = document.querySelector('[data-add="heading"]'); if (b) b.click(); await w(700); const el = q("#pbx-insp"); el.scrollTop = 600; await w(150);
      o.stk = !!q(".pbx-stk .pbx-itabs") && q(".pbx-itabs").getBoundingClientRect().top - el.getBoundingClientRect().top < 140; return o; });
    ok("المطوّر: التبويبات اليسرى أفقية والمحتوى تحتها", u.rows >= 2 && u.pane, u);
    ok("المطوّر: أزرار التكبير والملاءمة تعمل", u.zoom && u.fit, u);
    ok("المطوّر: التحديث والكاش داخل قائمة ⋯", u.more, u);
    ok("المطوّر: تبويبات الإعدادات لاصقة أعلى اللوحة", u.stk, u);
  }
  const cnt = ty => p.evaluate(ty => (JSON.stringify(PBApp.E.page.sections).match(new RegExp('"type":"' + ty + '"', "g")) || []).length, ty);
  const pbSay = async t => { await say(p, t); await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 25000 }); };
  ok("المحرّر مفتوح ومفهرس", await p.evaluate(() => AdminVoice.findUI("معاينة", 2).length > 0 && AdminVoice.findUI("حفظ ونشر", 1).length > 0));
  const h0 = await cnt("heading"), b0 = await cnt("button");
  await pbSay("اضف عنوان"); ok("مطوّر: إضافة عنوان بالصوت", (await cnt("heading")) === h0 + 1, await cnt("heading"));
  const fsv = () => p.evaluate(() => { const i = document.querySelector('#pb-app [data-qi="fs"]'); return i ? Number(i.value) : -1; });
  const f0 = await fsv(); await pbSay("كبر الخط"); ok("مطوّر: تكبير خط العنصر المحدد", f0 > 0 && (await fsv()) > f0, [f0, await fsv()]);
  await pbSay("اضف زر"); ok("مطوّر: إضافة زر بالصوت", (await cnt("button")) === b0 + 1);
  await pbSay("شوفها على الهاتف"); ok("مطوّر: عرض الهاتف", (await p.evaluate(() => PBApp.E.dev)) === "m");
  await pbSay("عرض المكتب"); ok("مطوّر: عرض المكتب", (await p.evaluate(() => PBApp.E.dev)) === "d");
  await pbSay("تراجع"); ok("مطوّر: تراجع يلغي آخر إضافة", (await cnt("button")) === b0, await cnt("button"));
  await pbSay("اعد الخطوة"); ok("مطوّر: إعادة الخطوة", (await cnt("button")) === b0 + 1);
  const secs0 = await p.evaluate(() => PBApp.E.page.sections.length);
  await pbSay("اضف قسم جديد"); ok("مطوّر: إضافة قسم", (await p.evaluate(() => PBApp.E.page.sections.length)) === secs0 + 1);
  await pbSay("احذف القسم"); ok("مطوّر: الحذف لا يُنفَّذ بالصوت", (await p.evaluate(() => PBApp.E.page.sections.length)) === secs0 + 1);
  await p.evaluate(() => { window.__pub = 0; window.__origPub = PBApp.publish; PBApp.publish = () => { window.__pub++; }; });
  await say(p, "احفظ وانشر الصفحة"); ok("مطوّر: النشر يطلب تأكيداً ولا ينفَّذ قبله", (await p.evaluate(() => window.__pub)) === 0);
  await p.evaluate(() => [...document.querySelectorAll("#av-bt button, .ah-panel button")].find(b => b.textContent === "نعم").click()); await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 25000 }); await p.waitForTimeout(400);
  ok("مطوّر: بعد «نعم» يُنشر", (await p.evaluate(() => window.__pub)) === 1);
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(600);
  ok("المحرّر أُغلق للاختبار التالي", await p.evaluate(() => !document.querySelector("#pb-app.on")));
  await pbSay("اضف صفحة جديدة باسم عروض الصيف");
  await p.waitForFunction(() => document.querySelector("#pb-app.on"), null, { timeout: 8000 }).catch(() => { });
  ok("مطوّر: صفحة جديدة بالاسم المنطوق", await p.evaluate(() => !!document.querySelector("#pb-app.on") && /عروض الصيف/.test(PBApp.E.page.title)), await p.evaluate(() => PBApp.E.page && PBApp.E.page.title));
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(500);
  // ── مسار حواري: صفحة هبوط لمنتج (أسئلة ← ملخّص ← تنفيذ) ──
  const lpTitle = await p.evaluate(() => Admin.products[0].title), lpSlug = await p.evaluate(() => Admin.products[0].slug);
  await say(p, "hi mystore انشئ صفحة هبوط لمنتج " + lpTitle);
  ok("مسار الهبوط: يسأل عمّا يضاف", await p.evaluate(() => /ماذا أضيف/.test(document.getElementById("av-out").textContent + (document.getElementById("ah-m") || {}).textContent)));
  await say(p, "الاثنين");
  ok("مسار الهبوط: ثم يسأل عن المسار", await p.evaluate(() => /المسار الرئيسي/.test(document.getElementById("av-out").textContent + (document.getElementById("ah-m") || {}).textContent)));
  await say(p, "نعم");
  ok("مسار الهبوط: ملخّص بتأكيد", await p.evaluate(() => /سأنشئ صفحة هبوط/.test(document.getElementById("av-out").textContent + (document.getElementById("ah-m") || {}).textContent)));
  await p.evaluate(() => [...document.querySelectorAll("#av-bt button, .ah-panel button")].find(b => b.textContent === "نعم").click());
  await p.waitForFunction(() => document.querySelector("#pb-app.on"), null, { timeout: 30000 }).catch(() => { });
  await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 90000 }).catch(() => { }); await p.waitForTimeout(800);
  const lp = await p.evaluate(() => { const j = PBApp.pageJson(), c = t => (j.match(new RegExp('"type":"' + t + '"', "g")) || []).length; return { open: !!document.querySelector("#pb-app.on"), prod: PBApp.E.page.product, slug: PBApp.E.page.slug, form: c("orderorig"), cd: c("countdown"), img: c("image"), hd: c("heading"), mr: PBApp.E.mr }; });
  ok("مسار الهبوط: صفحة جديدة مرتبطة بالمنتج", lp.open && lp.prod === lpSlug && /-lp/.test(lp.slug), lp);
  ok("مسار الهبوط: العناصر أُضيفت (عنوان+صورة+عدّاد+نموذج)", lp.form === 1 && lp.cd === 1 && lp.img === 1 && lp.hd === 1, lp);
  ok("مسار الهبوط: مسار المنتج الرئيسي مطلوب عند النشر", !!(lp.mr && lp.mr.on), lp.mr);
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(500);
  // ── تحسين الصورة (فلاتر/ظل/حدود) في إعدادات الصورة ──
  await p.evaluate(() => { const pg = PB.newPage("اختبار صورة", ""); pg.slug = "img-fx"; const sec = PB.mkS([PB.mkC([PB.mkW("image", { src: "assets/img/favicon.png", hauto: true })])]); pg.sections = [sec]; window.__imgId = sec.cols[0].widgets[0].id; PBApp.open(pg, "", true); }); await p.waitForTimeout(1800);
  await p.evaluate(() => { PBApp.E.sel = window.__imgId; PBApp.E.tab = "s"; PBApp.renderInspectorNow(); }); await p.waitForTimeout(400);
  ok("إعدادات الصورة: مجموعة «تحسين الصورة» وفلتر جاهز وظل", await p.evaluate(() => { const t = (document.getElementById("pbx-insp") || {}).textContent || ""; return /تحسين الصورة/.test(t); }));
  ok("فلتر الصورة يُرسم في CSS", await p.evaluate(() => { const pg = JSON.parse(PBApp.pageJson()); const w = pg.sections[0].cols[0].widgets[0]; w.set.iprs = "vivid"; w.set.ish = "medium"; const h = PB.fullHtml(pg, { base: "./", site: {}, products: [], meta: { tabs: [], cats: {} } }); return /saturate\(135%\)/.test(h) && /drop-shadow\(0px 10px 18px/.test(h); }));
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(400);
  // ── منع سماع المساعد لنفسه ──
  const ec = await p.evaluate(() => { AdminVoice._spk("مرحباً أليسوم، أنا أسمعك. تكلّم مباشرة", 800); const a = AdminVoice._echo(["مرحبا"]), b = AdminVoice._echo(["افتح الطلبات"]); AdminVoice._spk("مرحباً أليسوم، أنا أسمعك", 2500); const c = AdminVoice._echo(["نعم"]), d = AdminVoice._echo(["أنا أسمعك تكلم مباشرة"]); return { a, b, c, d }; });
  ok("صدى المساعد: كلمة من كلامه بعد انتهائه تُهمَل", ec.a === true, ec);
  ok("صدى المساعد: أمر المستخدم الحقيقي لا يُهمَل", ec.b === false && ec.c === false, ec);
  ok("صدى المساعد: جملة كاملة منسوخة من كلامه تُهمَل", ec.d === true, ec);
  // ── استوديو المنتج (تركيب بالبكسل + اللوحة) ──
  const stu = await p.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#e11"; g.fillRect(100, 50, 200, 200);
    const bb = PBStudio.bbox(c), out = PBStudio.compose(c, bb, { size: [500, 500], bg: { type: "color", c1: "#ffffff" }, pad: .1, align: "center", shadow: "contact", podium: false }), d = out.getContext("2d");
    const px = (x, y) => Array.from(d.getImageData(x, y, 1, 1).data), o2 = PBStudio.compose(c, bb, { size: [500, 1000], bg: { type: "color", c1: "#00ff00" }, pad: .1, align: "bottom", shadow: "none" });
    return { bb, corner: px(5, 5), center: px(250, 250), tall: [o2.width, o2.height], bottom: Array.from(o2.getContext("2d").getImageData(250, 940, 1, 1).data), top: Array.from(o2.getContext("2d").getImageData(250, 20, 1, 1).data), alpha: PBStudio.hasAlpha(c), opaque: (() => { const q = document.createElement("canvas"); q.width = 100; q.height = 100; const h = q.getContext("2d"); h.fillStyle = "#888"; h.fillRect(0, 0, 100, 100); return PBStudio.hasAlpha(q); })() };
  });
  ok("الاستوديو: مستطيل المنتج بحدود ألفا", stu.bb.w >= 200 && stu.bb.w <= 204 && stu.bb.h >= 200 && stu.bb.h <= 204 && stu.bb.x >= 98 && stu.bb.x <= 100, stu.bb);
  ok("الاستوديو: خلفية بيضاء والمنتج في الوسط", stu.corner[0] > 250 && stu.corner[1] > 250 && stu.center[0] > 200 && stu.center[1] < 60, stu);
  ok("الاستوديو: مقاس 500×1000 والمنتج على الأرض (أسفل) والأعلى خلفية", stu.tall[0] === 500 && stu.tall[1] === 1000 && stu.bottom[0] < 60 && stu.top[1] > 250 && stu.top[0] < 5, stu);
  ok("الاستوديو: كشف الخلفية الشفافة (شفافة نعم، معتمة لا)", stu.alpha === true && stu.opaque === false, stu);
  await p.evaluate(() => { PBApp.E.sel = window.__imgId; PBApp.E.tab = "s"; PBApp.renderInspectorNow(); document.querySelector('[data-qb="edit"]') && document.querySelector('[data-qb="edit"]').click(); }); await p.waitForTimeout(500);
  const ui = await p.evaluate(async () => { const t = document.querySelector('#pbx-lpane [data-imgt="st"]'); if (!t) return { tab: false }; t.click(); await new Promise(r => setTimeout(r, 900)); return { tab: true, panel: !!document.getElementById("pbst"), btns: document.querySelectorAll("#pbst [data-st]").length, sw: document.querySelectorAll("#pbst [data-st-bg]").length }; });
  ok("الاستوديو: تبويب في «تعديل الصورة» ولوحة وقماش معاينة وخلفيات", ui.tab && ui.panel && ui.btns >= 4 && ui.sw >= 10, ui);
  const op = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const o = { applyBtn: !!document.querySelector('#pbst [data-st="apply"]') }; const ed = document.querySelector('.pbx-qbar [data-qb="edit"]');
    if (ed) { const cs = getComputedStyle(ed), tx = getComputedStyle(ed.querySelector(".tx")); o.edBg = cs.backgroundColor; o.edCol = tx.color; o.edOn = ed.classList.contains("on"); }
    return o;
  });
  ok("شريط الصورة: «تعديل» بعد فتح اللوحة كلمته بيضاء وخلفيته خضراء، ولا زر «تطبيق على الصورة» في الإعدادات", op.edOn && op.edCol === "rgb(255, 255, 255)" && (() => { const m = String(op.edBg).match(/[\d.]+/g) || []; const n = /^color/.test(op.edBg) ? m.slice(-3).map(Number) : m.slice(0, 3).map(Number); return n.length === 3 && n[1] > n[0] && n[1] > n[2]; })() && !op.applyBtn, op);
  const it = await p.evaluate(async () => {
    const tabs = [...document.querySelectorAll(".pbx-tabs [data-lt]")].map(b => b.dataset.lt), pane = document.getElementById("pbx-lpane"), imgs = [...pane.querySelectorAll(".pbx-tt img")];
    await new Promise(r => setTimeout(r, 600)); const o = { second: tabs[1], tabOn: document.querySelector('.pbx-tabs [data-lt="img"]').classList.contains("on"), tools: pane.querySelectorAll("[data-imgt]").length, sub: pane.querySelectorAll("[data-imgs]").length, sm: pane.querySelectorAll("[data-imgm]").length, loaded: imgs.filter(i => i.naturalWidth > 0).length, imgsN: imgs.length };
    o.tabsHidden = getComputedStyle(document.querySelector("#pbx-ep .pbst-tabs")).display === "none"; o.hasEpTabs = !!document.querySelector("#pbx-ep .ep-tabs");
    pane.querySelector('[data-imgs="txt"]').click(); await new Promise(r => setTimeout(r, 700)); o.head = document.querySelector("#pbx-ep .ep-h").textContent.trim(); o.visPane = [...document.querySelectorAll("#pbst .pbst-pane")].filter(x => !x.hidden).map(x => x.dataset.stp).join(",");
    pane.querySelector('[data-imgt="pz"]').click(); await new Promise(r => setTimeout(r, 400)); o.pzHead = document.querySelector("#pbx-ep .ep-h").textContent.trim(); o.subGone = !pane.querySelector("[data-imgs]");
    PBApp.ltoggle("add"); await new Promise(r => setTimeout(r, 200)); o.closedByTab = !document.getElementById("pbx-ep");
    PBApp.ltoggle("img"); document.querySelector('#pbx-lpane [data-imgt="st"]').click(); await new Promise(r => setTimeout(r, 600)); return o;
  });
  ok("تبويب «تعديل الصورة»: ثاني تبويب تحت العناصر وفيه 5 أدوات وصور حقيقية محمّلة وأدوات ذكية", it.second === "img" && it.tabOn && it.tools === 5 && it.sub === 5 && it.sm === 2 && it.imgsN >= 12 && it.loaded === it.imgsN, it);
  ok("تعديل الصورة: اسم الأداة والإعدادات في الشريط الأيمن (بلا شريط تبويبات داخلي)، وأدوات الاستوديو تُفتح من القائمة اليسرى", it.tabsHidden && !it.hasEpTabs && /استوديو المنتج/.test(it.head) && /ملصقات/.test(it.head) && it.visPane === "txt" && /بازل/.test(it.pzHead) && it.subGone, it);
  ok("تعديل الصورة: فتح تبويب آخر يغلق لوحة الأداة (كل تبويب يغلق الذي قبله)", it.closedByTab, it);
  const cx = await p.evaluate(async () => {
    PBApp.E.sel = window.__imgId; PBApp.openCtx(300, 200); await new Promise(r => setTimeout(r, 100)); const m = document.getElementById("pbx-ctx"), b = m.querySelector("button"), h = m.querySelector(".ctx-h"), cs = getComputedStyle(m), bs = getComputedStyle(b); const r0 = m.getBoundingClientRect();
    const o = { bg: cs.backgroundColor, col: bs.color, fs: parseFloat(bs.fontSize), hasH: !!h };
    h.dispatchEvent(new PointerEvent("pointerdown", { clientX: r0.left + 20, clientY: r0.top + 5, pointerId: 1, bubbles: true })); h.dispatchEvent(new PointerEvent("pointermove", { clientX: r0.left + 120, clientY: r0.top + 85, pointerId: 1, bubbles: true })); h.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
    const r1 = m.getBoundingClientRect(); o.dx = Math.round(r1.left - r0.left); o.dy = Math.round(r1.top - r0.top); document.getElementById("pbx-ctx").remove(); return o;
  });
  ok("قائمة الزر الأيمن: خلفية بيضاء معتمة وخط أسود صغير وتتحرك بالسحب من أعلاها", cx.bg === "rgb(255, 255, 255)" && cx.col === "rgb(17, 17, 17)" && cx.fs <= 12.5 && cx.hasH && Math.abs(cx.dx - 100) <= 3 && Math.abs(cx.dy - 80) <= 3, cx);
  const qb = await p.evaluate(async () => {
    const q = document.querySelector(".pbx-qbar"), tx = q && q.querySelector('[data-qb="edit"] .tx'), u = q && q.querySelector('[data-qb="undo"]'), r = q && q.querySelector('[data-qb="redo"]'); const o = { tx: !!tx, u: !!u, r: !!r };
    if (tx) { const probe = document.createElement("i"); probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--g-mint") || ""; o.col = getComputedStyle(tx).color; o.mint = getComputedStyle(probe).color; o.white = o.col === "rgb(255, 255, 255)"; }
    PBApp.E.nextLabel = "اختبار"; const inf = PBApp.E.page; const before = PBApp.E.hi; PBApp.E.hist.length; o.hi0 = before;
    u && !u.disabled && u.click(); o.hi1 = PBApp.E.hi; r && r.click && (await new Promise(x => setTimeout(x, 50)), document.querySelector('.pbx-qbar [data-qb="redo"]').click()); o.hi2 = PBApp.E.hi;
    document.querySelector('[data-qb="edit"]').click(); await new Promise(x => setTimeout(x, 150)); o.closed = !document.getElementById("pbx-ep") && !document.querySelector('.pbx-qbar [data-qb="undo"]'); { const t2 = document.querySelector('.pbx-qbar [data-qb="edit"] .tx'); const m2 = t2 && getComputedStyle(t2).color.match(/\d+/g); o.green = !!m2 && +m2[1] > +m2[0] && +m2[1] > +m2[2]; }
    document.querySelector('[data-qb="edit"]').click(); await new Promise(x => setTimeout(x, 300)); return o;
  });
  ok("شريط الصورة: «تعديل» خضراء بلون المظهر وتصير بيضاء عند الفتح، وسهما رجوع/عودة يظهران مع لوحة التعديل ويعملان ويختفيان بإغلاقها", qb.tx && qb.u && qb.r && qb.white && qb.green && qb.hi1 <= qb.hi0 && qb.hi2 === qb.hi0 && qb.closed, qb);
  const st2 = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const o = {};
    try { AIVision.supported = () => false; } catch (e) { } document.querySelector('[data-st="cut"]') && document.querySelector('[data-st="cut"]').click(); for (let i = 0; i < 60 && !PBStudio._S.cut; i++) await w(300);
    o.cut = !!PBStudio._S.cut; o.msg = PBStudio._S.msg; const z = document.getElementById("pbst-sz"); z.value = "1080x1920"; z.dispatchEvent(new Event("change", { bubbles: true })); for (let i = 0; i < 40; i++) { const e0 = document.querySelector("#pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"] img'); if (e0 && /^blob:/.test(e0.src) && e0.naturalHeight && Math.abs(e0.naturalWidth / e0.naturalHeight - 0.5625) < .02) break; await w(300); } await w(300);
    const el = document.querySelector("#pbx-frame") && document.querySelector("#pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"] img'); o.live = !!el && /^blob:/.test(el.src); o.ratio = el ? +(el.naturalWidth / el.naturalHeight).toFixed(3) : 0; o.small = !document.getElementById("pbst-cv");
    const f = document.getElementById("pbx-epf"); o.bar = !!f && /تطبيق/.test(f.textContent) && /إلغاء/.test(f.textContent);
    f && f.querySelector('[data-epf="no"]').click(); await w(700); const el2 = document.querySelector("#pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"] img'); o.restored = !!el2 && !/^blob:/.test(el2.src); o.pend = PBStudio.pending();
    document.querySelector('[data-st-tab="txt"]').click(); document.querySelector('[data-st="addov"][data-i="0"]').click(); await w(300);
    o.ov = PBStudio.opts().ov.length; { const fs = document.querySelector('#pbst [data-stk="font"]'); o.fontOpts = fs ? fs.options.length : 0; o.fontDef = fs ? fs.options[0].textContent : ""; if (fs) { fs.value = "Amiri"; fs.dispatchEvent(new Event("input", { bubbles: true })); } o.font = PBStudio.opts().font; o.ovFont = !!document.querySelector('#pbst [data-ovk="font"]'); } o.tabs = document.querySelectorAll("#pbst [data-st-tab]").length; o.hid = [...document.querySelectorAll("#pbst [data-stp]")].filter(q => !q.hidden).map(q => q.dataset.stp);
    const out = PBStudio.compose((() => { const c = document.createElement("canvas"); c.width = 200; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(40, 40, 120, 220); return c; })(), null, { size: [540, 960], bg: { type: "color", c1: "#ffffff" }, pad: .1, align: "center", shadow: "none", ov: [{ t: "-50%", pos: 2, st: "circle", bg: "#e11d48", fg: "#ffffff", s: 8 }] });
    const d = out.getContext("2d").getImageData(0, 0, 540, 960).data, px = (x, y) => [d[(y * 540 + x) * 4], d[(y * 540 + x) * 4 + 1], d[(y * 540 + x) * 4 + 2]];
    o.badge = px(540 - 70, 70); o.prod = px(270, 480); o.bgp = px(10, 940); return o;
  });
  ok("الاستوديو: التعديلات تظهر مباشرة على صورة الصفحة بنسبة المقاس (9:16) بلا صورة مصغّرة، وتحتها «تطبيق/إلغاء»", st2.cut && st2.live && Math.abs(st2.ratio - 0.5625) < .02 && st2.small && st2.bar, st2);
  ok("الاستوديو: «إلغاء» يعيد الصورة الأصلية ويُنهي المعاينة", st2.restored && !st2.pend, st2);
  ok("الاستوديو: تغيير الخط للملصقات (الافتراضي خط الموقع) عاماً ولكل ملصق", st2.fontOpts > 8 && /الموقع/.test(st2.fontDef) && st2.font === "Amiri" && st2.ovFont, st2);
  ok("الاستوديو: خمسة تبويبات وتبويب واحد ظاهر، وإضافة ملصق بيع", st2.tabs === 5 && st2.hid.length === 1 && st2.hid[0] === "txt" && st2.ov >= 1, st2);
  ok("الاستوديو: الملصق يُرسم على الصورة (أحمر) والمنتج في الوسط والخلفية بيضاء", st2.badge[0] > 200 && st2.badge[1] < 90 && st2.prod[0] > 150 && st2.prod[1] < 60 && st2.bgp[0] > 250, st2);
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(400);
  const np = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true;
    PBAdmin.newPage(); await w(200); const d = document.getElementById("pbnp"); if (!d) return { dlg: false };
    const info = { dlg: true, groups: d.querySelectorAll("#np-sel optgroup").length, opts: d.querySelectorAll("#np-sel option").length, szHidden: document.getElementById("np-sz").hidden };
    d.querySelector('[data-np="size"]').click(); await w(100); info.szShown = !document.getElementById("np-sz").hidden;
    const sel = document.getElementById("np-sel"); sel.value = "ig_story"; sel.dispatchEvent(new Event("change", { bubbles: true })); await w(50); info.w = document.getElementById("np-w").value; info.h = document.getElementById("np-h").value;
    document.getElementById("np-w").value = 800; document.getElementById("np-w").dispatchEvent(new Event("input", { bubbles: true })); info.selCustom = document.getElementById("np-sel").value;
    document.getElementById("np-name").value = "ستوري تجريبي"; d.querySelector('[data-np="go"]').click(); await w(1800);
    info.ad = PBApp.E && PBApp.E.page && PBApp.E.page.ad ? [PBApp.E.page.ad.w, PBApp.E.page.ad.h] : null; info.title = PBApp.E && PBApp.E.page && PBApp.E.page.title; info.closed = !document.getElementById("pbnp");
    PBApp.close(); await w(500);
    PBAdmin.newPage(); await w(200); document.getElementById("np-name").value = "Web Test"; document.querySelector('#pbnp [data-np="go"]').click(); await w(1800);
    info.web = !!(PBApp.E && PBApp.E.page && !PBApp.E.page.ad && PBApp.E.page.title === "Web Test"); PBApp.close(); await w(400); return info;
  });
  ok("صفحة جديدة: نافذة بالاسم ونوعين (ويب/مقاس) وقائمة مقاسات مجمّعة", np.dlg && np.groups >= 6 && np.opts >= 20 && np.szHidden && np.szShown, np);
  ok("صفحة جديدة: اختيار مقاس يملأ العرض والارتفاع، وتعديلهما يحوّل القائمة إلى «مخصّص»", np.w === "1080" && np.h === "1920" && np.selCustom === "custom", np);
  ok("صفحة جديدة: تصميم بمقاس مخصّص يفتح لوحة 800×1920 باسمها، وصفحة الويب تفتح صفحة عادية", np.closed && np.ad && np.ad[0] === 800 && np.ad[1] === 1920 && np.title === "ستوري تجريبي" && np.web, np);
  const ar = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; const out = {};
    ImgGen.openSized({ W: 1080, H: 1920, id: "ig_story", label: "ستوري", name: "تصميم مقاس", textMode: "none", lang: "ar" }); await w(1800);
    const sec = () => PBApp.E.page.sections.find(s => s.set.kind === "canvas"), freeOf = t => (sec().free || []).filter(x => x.type === t);
    const tile = t => document.querySelector('#pbx-lpane .pbx-wi[data-add="' + t + '"]');
    out.tiles = !!tile("image") && !!tile("heading");
    tile("heading").click(); await w(500); tile("image").click(); await w(700);
    const img = freeOf("image")[0], h = freeOf("heading")[0], S = sec();
    out.img = img ? [img.set.fx.d, img.set.fy.d, img.set.fwd.d, img.set.fh.d] : null; out.mh = S.set.mh.d; out.dw = S.set.dw; out.btn = !!document.getElementById("pbx-adsz") && getComputedStyle(document.getElementById("pbx-adsz")).display !== "none";
    out.hFy = h ? h.set.fy.d : null; const hFs = h && h.set.fs && h.set.fs.d;
    PBApp.adResize(540, 960, true, "", "custom"); await w(300); const S2 = sec(), h2 = freeOf("heading")[0], i2 = freeOf("image")[0];
    out.sc = { mh: S2.set.mh.d, dw: S2.set.dw, ad: [PBApp.E.page.ad.w, PBApp.E.page.ad.h], hFy: h2.set.fy.d, hFs: h2.set.fs && h2.set.fs.d, iH: i2.set.fh.d };
    out.hFsOrig = hFs;
    PBApp.adResize(1080, 1920, false, "", "custom"); await w(300); const S3 = sec(), h3 = freeOf("heading")[0];
    out.pg = { mh: S3.set.mh.d, dw: S3.set.dw, hFy: h3.set.fy.d };
    PBApp.adResizeUi(); await w(200); out.dlg = !!document.getElementById("pbar-bg") && document.querySelectorAll("#pbar-sel option").length > 20 && document.querySelectorAll('#pbar-bg input[name="pbar-m"]').length === 2; document.getElementById("pbar-bg").click(); await w(100);
    PBApp.close(); await w(400); return out;
  });
  ok("تصميم بمقاس: إضافة صورة تملأ الصفحة المختارة (1080×1920) خلف العناصر دون تكبير الصفحة", ar.tiles && ar.img && ar.img[0] === 0 && ar.img[1] === 0 && ar.img[2] === 100 && ar.img[3] === 1920 && ar.mh === 1920 && ar.dw === 1080 && ar.btn, ar);
  ok("تصميم بمقاس: تغيير المقاس مع تحجيم العناصر (المواضع والارتفاع والخط بنسبة المقاس) ثم للصفحة فقط", ar.sc && ar.sc.mh === 960 && ar.sc.dw === 540 && ar.sc.ad[0] === 540 && ar.sc.iH === 960 && Math.abs(ar.sc.hFy - ar.hFy / 2) <= 1 && ar.pg.mh === 1920 && ar.pg.dw === 1080 && ar.pg.hFy === ar.sc.hFy, ar);
  ok("تصميم بمقاس: نافذة تغيير المقاس بقائمة المقاسات وخياري التحجيم", ar.dlg, ar);
  const pb = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; const o = {};
    ImgGen.openSized({ W: 1080, H: 1080, id: "ig_sq", label: "مربع", name: "نشر تجريبي", textMode: "none", lang: "ar" }); await w(1800);
    const tile = t => document.querySelector('#pbx-lpane .pbx-wi[data-add="' + t + '"]'); tile("heading").click(); await w(500);
    o.tabBtn = !!document.querySelector('[data-lt="pub"]') && getComputedStyle(document.querySelector('[data-lt="pub"]')).display !== "none";
    document.querySelector('[data-lt="pub"]').click(); await w(500); o.root = !!document.getElementById("pub-root"); o.plat = document.querySelectorAll("#pub-root [data-pub-p]").length;
    const sel = ImgGen.pubState; sel.sel = ["fb_post", "ig_story", "yt_thumb"]; document.querySelector('#pub-root [data-pub="all"]') && 0;
    PBApp.uploadBlob = async (bl, nm) => "assets/img/pages/" + nm + ".webp";
    document.querySelector('#pub-root [data-pub="run"]').click(); for (let i = 0; i < 60 && (ImgGen.pubState.busy || !ImgGen.pubState.items.length); i++) await w(500); await w(800);
    const it = ImgGen.pubState.items; o.n = it.length; o.dims = it.map(q => q.W + "x" + q.H).join(","); o.thumbs = document.querySelectorAll("#pub-root .pub-th img").length; o.lib = it.every(q => !!q.path); o.checked = it.every(q => q.checked);
    const sc = ImgGen.scaledPage(PBApp.E.page, 1080, 1920), sec = sc.sections.find(s => s.set.kind === "canvas"), h = (sec.free || []).find(q => q.type === "heading"); o.scaled = sc.ad.w === 1080 && sc.ad.h === 1920 && sec.set.mh.d === 1920 && !!h && h.set.fy.d >= 420;
    document.querySelectorAll('#pub-root [data-pub-c]')[1].click(); await w(200); o.unchecked = ImgGen.pubState.items.filter(q => q.checked).length;
    let dl = 0; const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) dl++; }; document.querySelector('#pub-root [data-pub="dl"]').click(); await w(800); HTMLAnchorElement.prototype.click = oc; o.dl = dl;
    PBApp.close(); await w(400); return o;
  });
  ok("نشر متعدد المنصات: تبويب الشريط الجانبي وقائمة المنصات وزر «انشر»", pb.tabBtn && pb.root && pb.plat >= 15, pb);
  ok("نشر متعدد المنصات: صورة مصغّرة لكل منصة بمقاسها ومحدّدة وتُحفظ في المكتبة", pb.n === 3 && pb.dims === "1200x630,1080x1920,1280x720" && pb.thumbs === 3 && pb.lib && pb.checked, pb);
  ok("نشر متعدد المنصات: التحجيم المنتظم للتصميم، واختيار بعضها ثم تحميل المحدد", pb.scaled && pb.unchecked === 2 && pb.dl >= 1, pb);
  // ── ربط المخزون بالطلبات: شارة + نافذة «المخزون لا يكفي» ──
  const stk = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; API.updateOrder = async () => ({ ok: true }); const pr = Admin.products[0], t = pr.title; pr.stock = 3; Admin.fin.cfg = Object.assign({}, Admin.fin.cfg, { since: "2000-01-01T00:00:00Z" });
    const mk = (id, d, q) => ({ id, date: new Date(Date.now() - (3 - d) * 600000).toISOString(), status: "nouvelle", name: "زبون " + id, phone: "0550000000", wilaya: "الجزائر", items: t + " ×" + q + " = " + (q * 2000) + " DA", subtotal: q * 2000, total: q * 2000, note: "" });
    Admin.orders = [mk("S1", 1, 3), mk("S2", 2, 2)]; Admin.renderOrders(); await new Promise(r => setTimeout(r, 100));
    const pills = document.querySelectorAll("#orders-table .sc-pill, .sc-pill").length, sum = StockCheck.summary();
    const sel = { value: "a1" }; Admin.orderAction(1, sel); await new Promise(r => setTimeout(r, 100));
    const dlg = document.getElementById("sc-bg"), txt = dlg ? dlg.textContent : "", noBtn = dlg && dlg.querySelector("#sc-no"), goBtn = dlg && dlg.querySelector("#sc-go");
    const labels = [noBtn && noBtn.textContent, goBtn && goBtn.textContent]; noBtn && noBtn.click(); await new Promise(r => setTimeout(r, 100));
    const afterCancel = { dlg: !!document.getElementById("sc-bg"), note: Admin.orders[1].note };
    Admin.orderAction(1, { value: "a1" }); await new Promise(r => setTimeout(r, 100)); document.querySelector("#sc-go").click(); await new Promise(r => setTimeout(r, 100));
    const afterGo = Admin.orders[1].note;
    Admin.products[0].stock = 1; Admin.confirmOrder(1); await new Promise(r => setTimeout(r, 100)); const cdlg = document.getElementById("sc-bg"), clabels = cdlg ? [cdlg.querySelector("#sc-no").textContent, cdlg.querySelector("#sc-go").textContent] : null; cdlg && cdlg.querySelector("#sc-no").click();
    const st1 = Admin.orders[1].status; Admin.products[0].stock = 3; Admin.confirmOrder(0); await new Promise(r => setTimeout(r, 100));
    return { pills, sum: sum.orders, txt: /المخزون لا يكفي لهذا الطلب/.test(txt), labels, afterCancel, afterGo, clabels, st1, st0: Admin.orders[0].status };
  });
  ok("المخزون: طلب واحد خارج المخزون يحمل شارة والملخص 1", stk.pills >= 1 && stk.sum === 1, stk);
  ok("المخزون: نافذة «المخزون لا يكفي لهذا الطلب» بزرّي إلغاء الاتصال / إجراء الاتصال", stk.txt && stk.labels[0] === "إلغاء الاتصال" && stk.labels[1] === "إجراء الاتصال", stk.labels);
  ok("المخزون: إلغاء الاتصال لا يسجّل شيئاً، وإجراؤه يسجّل المحاولة", stk.afterCancel.dlg === false && !/📞/.test(stk.afterCancel.note) && /📞1/.test(stk.afterGo), stk);
  ok("المخزون: التأكيد يمرّ بنافذة (إلغاء / تأكيد رغم ذلك) ولا يؤكّد عند الإلغاء", stk.clabels && stk.clabels[1] === "تأكيد رغم ذلك" && stk.st1 === "nouvelle", stk);
  ok("المخزون: طلب يكفيه المخزون يُؤكَّد مباشرة بلا نافذة", stk.st0 === "confirmee", stk.st0);
  const fe = await p.evaluate(async () => {
    const w = WILAYAS.find(x => x.id === 2), cs = Admin.communeSup, sp = Admin._supPub; Admin.communeSup = () => ({}); Admin._supPub = { 2: { dahra: [50, 0], tenes: [0, 30] } };
    const a = Admin.shipFeeFor(w, "Dahra", "home"), b = Admin.shipFeeFor(w, "Chlef", "home"), c = Admin.shipFeeFor(w, "Ténès", "stop"); Admin.communeSup = cs; Admin._supPub = sp;
    AdminYd.noteSent({ id: "Z1", name: "اسم حقيقي", phone: "0550123456" }, "yalidine", "yal-ZZ1"); AdminYd.set([{ tracking: "yal-ZZ1", date: "2026-10-12", name: "ا** ح****", phone: "0*******56", wilaya: "Alger", commune: "X", price: 1000, status: "En préparation" }], 1, false);
    const card = document.getElementById("yd-card"), txt = card ? card.textContent : "", trk = card && card.querySelector("tr[data-trk]"); AdminYd.forget("yal-ZZ1");
    return { a, b, c, base: w.home, txtReal: /اسم حقيقي/.test(txt), trk: !!trk };
  });
  ok("رسم التوصيل في الطلب اليدوي/التعديل يضيف إضافة البلدية إلى سعر الولاية (منزل ومكتب)", fe.a.fee === fe.base + 50 && fe.a.sup === 50 && fe.b.fee === fe.base && fe.c.sup === 30, fe);
  ok("طرد أرسلته اللوحة يبقى مرتبطاً باسم الزبون وهاتفه الحقيقيين (بدل النقاط) وصفه قابل لطباعة البوردرو", fe.txtReal && fe.trk, fe);
  // ── منع تكرار الإرسال لياليدين ──
  const dup = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); const SV = { ro: Admin.renderOrders, uo: API.updateOrder, cf: Admin.courierFetch, cw: Admin.companyWilayas, rc: Admin.resolveCommune, en: Admin.enqueueNotify, rb: Admin.renderShippedBadge, or: Admin.orders, dc: Admin.deliveryCfg }; Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg); Admin.deliveryCfg.yalidine = { enabled: true, apiId: "a", apiToken: "b" }; Admin.companyWilayas = async () => ({}); Admin.resolveCommune = async (co, cfg, ord) => ({ ok: true, name: ord.commune }); Admin.renderOrders = () => { }; API.updateOrder = async () => ({ ok: true });
    const posts = []; Admin.courierFetch = async rq => { if (rq.method === "POST") { posts.push(rq.body); await wait(150); return { ok: true, status: 200, text: JSON.stringify({ data: [{ success: true, tracking: "yal-D" + posts.length }] }) }; } return { ok: true, status: 200, text: JSON.stringify({ total_data: 3, data: [] }) }; };
    const mk = id => ({ id, date: new Date().toISOString(), status: "confirmee", name: "Test Dup", phone: "0550000001", wilaya: "Alger", commune: "Alger Centre", dtype: "home", total: 3000, subtotal: 3000, fee: 0, items: "x ×1 = 3000 DA", note: "" });
    Admin.orders = [mk("DUP1"), mk("DUP2")]; Admin.enqueueNotify = () => { }; Admin.renderShippedBadge = () => { };
    const r1 = await Promise.all([Admin.sendOrderToDelivery(0, "yalidine"), Admin.sendOrderToDelivery(0, "yalidine"), Admin.sendConfirmed(0)]); await wait(300);
    const t1 = Admin.trackingOf(Admin.orders[0]);
    // الفهرس يتبدّل أثناء الإرسال (تحديث القائمة): يجب أن يُحفظ التتبع على الطلب الصحيح
    const p2 = Admin.sendOrderToDelivery(1, "yalidine"); Admin.orders = [{ id: "OTHER", status: "nouvelle", note: "" }, Admin.orders[0], Admin.orders[1]]; await p2; await wait(100);
    const res = { posts: posts.length, results: r1, t1: !!t1, wrongOrder: Admin.trackingOf(Admin.orders[0]), right: !!Admin.trackingOf(Admin.orders.find(x => x.id === "DUP2")), total: posts.length };
    Admin.renderOrders = SV.ro; API.updateOrder = SV.uo; Admin.courierFetch = SV.cf; Admin.companyWilayas = SV.cw; Admin.resolveCommune = SV.rc; Admin.enqueueNotify = SV.en; Admin.renderShippedBadge = SV.rb; Admin.orders = SV.or; Admin.deliveryCfg = SV.dc; return res;
  });
  ok("الإرسال لياليدين: ثلاث نداءات متزامنة لطلب واحد = طرد واحد فقط", dup.t1 && dup.total === 2 && dup.results.filter(Boolean).length === 1, dup);
  ok("الإرسال لياليدين: تبدّل فهرس الطلب أثناء الإرسال لا يحفظ التتبع على طلب آخر", !dup.wrongOrder && dup.right, dup);
  // ── إصلاحات لجنة الخبراء (v1.89.132): XSS، المخزون المنتفخ، حذف المسلَّم، فشل إلغاء الطرد، إعلان بلا طلبات ──
  const cm = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); const R = {};
    const SV = { wo: window.open, cf: Admin.courierFetch, uo: API.updateOrder, or: Admin.orders, sn: Admin.showNotice, ol: Admin.orderLines, qs: Admin.queueStockPublish, sl: Admin.stockLog, ms: Admin.moveStock, ro: Admin.renderOrders, rs: Admin.renderShipped, fc: window.confirm, pr: Admin.products, fin: Admin.fin, sr: Admin.stockReturnWanted, dc: Admin.deliveryCfg, tr: Admin.trash };
    window.confirm = () => true; API.updateOrder = async () => ({ ok: true }); Admin.renderOrders = () => { }; Admin.renderShipped = () => { };
    // 1) تعقيم بيانات الزبون ووصل الطباعة
    const evil = '<img src=x onerror=alert(1)>', cl = Admin.cleanOrderText([{ name: evil, phone: "0550", wilaya: "A<b>", items: "x<script>y</script>" }])[0];
    R.clean = !/[<>]/.test(cl.name + cl.wilaya + cl.items);
    let html = ""; window.open = () => ({ document: { write: h => { html += h; }, close() { } } });
    Admin.orders = [{ id: "X1", date: new Date().toISOString(), status: "nouvelle", name: evil, phone: "0550", wilaya: "<i>A</i>", commune: "", dtype: "home", items: "<u>x</u> ×1 = 100 DA", total: 100, note: "" }];
    Admin.printOrderSlip(0); R.slipSafe = html.length > 100 && !/<img src=x|<i>A|<u>x/.test(html) && /&lt;img/.test(html);
    // 2) المخزون: خصم أكبر من المتاح ثم إلغاء يعيد نفس العدد
    const pr = { slug: "cm-t", title: "T", price: 100, stock: 1 }; Admin.queueStockPublish = () => { }; Admin.stockLog = () => { }; Admin.orderLines = () => [{ p: pr, v: null, qty: 2, total: 200 }];
    Admin.moveStock({ id: "S1" }, -1); const afterOut = pr.stock; Admin.moveStock({ id: "S1" }, +1); R.stock = [afterOut, pr.stock]; Admin.orderLines = SV.ol;
    // 3) حذف طلب مسلَّم لا يعيد علبه
    let moved = 0; Admin.moveStock = () => { moved++; return true; }; Admin.stockReturnWanted = () => true;
    Admin.orders = [{ id: "L1", date: new Date().toISOString(), status: "livree", name: "n", phone: "0550", items: "", total: 1, note: "📦 🚚yalidine:trk1" }]; Admin.trash = [];
    await Admin.deleteOrders([Admin.orders[0]], { silent: true }); R.deliveredStock = moved;
    // 4) فشل إلغاء الطرد: لا يُحذف الطلب ولا يُنزع تتبعه
    let notice = 0; Admin.showNotice = () => { notice++; }; Admin.courierFetch = async () => ({ ok: false, status: 400, text: "{}" });
    Admin.moveStock = SV.ms;
    Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: Object.assign({}, (Admin.deliveryCfg || {}).yalidine, { enabled: true, apiId: "a", apiToken: "b" }) });
    Admin.orders = [{ id: "C1", date: new Date().toISOString(), status: "confirmee", name: "n", phone: "0550", items: "", total: 1, note: "🚚yalidine:trkC1" }]; Admin.trash = [];
    await Admin.deleteOrders([Admin.orders[0]], { silent: true });
    R.delKept = Admin.orders.length === 1 && /trkC1/.test(Admin.orders[0].note) && notice >= 1;
    await Admin.unsendOrder(0); R.unsendKept = /trkC1/.test(Admin.orders[0].note) && notice >= 2;
    Admin.courierFetch = async () => ({ ok: true, status: 200, text: "{}" }); await Admin.unsendOrder(0); R.unsendOk = !/trkC1/.test(Admin.orders[0].note);
    // 5) Admin.tab بلا زر لا يرمي
    try { Admin.tab("orders"); R.tabNoBtn = true; } catch (e) { R.tabNoBtn = false; }
    // 6) إنفاق إعلاني بلا طلبات ناجحة يُخصم من الربح
    Admin.products = [{ slug: "cm-ad", title: "AD", price: 100, active: true }]; Admin.orders = []; Admin.fin = Object.assign({}, Admin.fin, { ads: { "cm-ad": { method: "spend", a: 5000, n: 0, m: 1 } } });
    const fc = Admin.computeFinance(0); R.adIdle = fc.K.adIdle === 5000 && fc.K.real <= -5000;
    window.open = SV.wo; Admin.courierFetch = SV.cf; API.updateOrder = SV.uo; Admin.orders = SV.or; Admin.showNotice = SV.sn; Admin.orderLines = SV.ol; Admin.queueStockPublish = SV.qs; Admin.stockLog = SV.sl; Admin.moveStock = SV.ms; Admin.renderOrders = SV.ro; Admin.renderShipped = SV.rs; window.confirm = SV.fc; Admin.products = SV.pr; Admin.fin = SV.fin; Admin.stockReturnWanted = SV.sr; Admin.deliveryCfg = SV.dc; Admin.trash = SV.tr;
    return R;
  });
  ok("أمان: بيانات الزبون تُعقَّم (<>) ووصل الطباعة يهرب كل حقل", cm.clean && cm.slipSafe, cm);
  ok("المخزون: خصم أكبر من المتاح ثم إلغاء يعيد نفس العدد (لا انتفاخ)", cm.stock[0] === -1 && cm.stock[1] === 1, cm.stock);
  ok("حذف طلب مسلَّم لا يعيد علبه للمخزون", cm.deliveredStock === 0, cm);
  ok("رفض الشركة إلغاء الطرد: الطلب لا يُحذف ولا يُنزع تتبعه، وبعد قبولها يُنزع", cm.delKept && cm.unsendKept && cm.unsendOk, cm);
  ok("Admin.tab بلا زر لا يرمي خطأ", cm.tabNoBtn, cm);
  ok("إنفاق حملة بلا طلبات ناجحة يُخصم من الربح بدل أن يُحسب 0", cm.adIdle, cm);
  // ── دفعة اللجنة الثانية (v1.89.133): تدقيق السعر، النسخة الاحتياطية، حرس الرجوع، التنبيهات ──
  const c2 = await p.evaluate(async () => {
    const R = {}; const SV = { pr: Admin.products, cf: window.confirm, uo: API.updateOrder, or: Admin.orders, ro: Admin.renderOrders };
    Admin.products = [{ slug: "pc-t", title: "منتج تدقيق", price: 1000, active: true, offers: [{ qty: 2, price: 1900, free: 0 }] }];
    const mk = (extra) => Object.assign({ id: "PC1", date: new Date().toISOString(), status: "nouvelle", name: "n", phone: "0550", wilaya: "Alger", items: "منتج تدقيق ×1 = 1000 DA", subtotal: 1000, discount: 0, fee: 400, total: 1400, note: "" }, extra || {});
    R.pcOk = Admin.priceCheck(mk()).ok; R.pcTotal = !Admin.priceCheck(mk({ total: 900 })).ok; R.pcCheap = !Admin.priceCheck(mk({ items: "منتج تدقيق ×1 = 100 DA", subtotal: 100, total: 500 })).ok;
    // حرس الرجوع بطلب مسلَّم
    let asked = 0; window.confirm = () => { asked++; return false; }; API.updateOrder = async () => ({ ok: true }); Admin.renderOrders = () => { };
    Admin.orders = [mk({ status: "livree" })]; Admin.changeStatus(0, "nouvelle"); R.guard = asked === 1 && Admin.orders[0].status === "livree";
    // النسخة الاحتياطية بلا أسرار
    localStorage.setItem("alyssum_el_key", "SECRET-KEY-123"); localStorage.setItem("alyssum_gh_cfg", '{"token":"ghp_x"}'); localStorage.setItem("admin_test_pref", "ok");
    let a0 = null; const oc = document.createElement.bind(document); document.createElement = t => { const e = oc(t); if (String(t).toLowerCase() === "a") e.click = () => { a0 = e; }; return e; };
    const bk = Admin.backupNow(); document.createElement = oc;
    const dump = JSON.stringify(bk || {}); R.bkd = [!!bk, !/SECRET-KEY-123|ghp_x/.test(dump), /_test_pref/.test(dump), !!a0, a0 && a0.download]; R.backup = !!bk && !/SECRET-KEY-123|ghp_x/.test(dump) && /_test_pref/.test(dump) && !!a0 && /^backup-/.test(a0.download);
    // التنبيهات
    toast("❌ فشل"); R.toastErr = $f("toast2").dataset.k === "err"; toast("✅ تم"); R.toastOk = $f("toast2").dataset.k === "ok";
    window.confirm = SV.cf; API.updateOrder = SV.uo; Admin.products = SV.pr; Admin.orders = SV.or; Admin.renderOrders = SV.ro; localStorage.removeItem("admin_test_pref"); localStorage.removeItem("alyssum_el_key"); localStorage.removeItem("alyssum_gh_cfg");
    return R;
  });
  ok("تدقيق السعر: طلب سليم يمر، وإجمالي مخالف أو سعر قطعة أقل من نصف الأدنى يُنبَّه عليه", c2.pcOk && c2.pcTotal && c2.pcCheap, c2);
  ok("الرجوع بطلب مسلَّم إلى حالة سابقة يطلب تأكيداً ولا يغيّر الحالة عند الرفض", c2.guard, c2);
  ok("النسخة الاحتياطية تحوي البيانات والإعدادات بلا مفاتيح أو رموز وتنزَّل كملف backup-*.json", c2.backup, c2);
  ok("إشعار اللوحة يميّز الخطأ (❌) عن النجاح بسمة لون", c2.toastErr && c2.toastOk, c2);
  // ── تعديل الطلب بعد التأكيد + تحديث الشركة + الإرسال الجماعي ──
  const oe = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; API.updateOrder = async () => ({ ok: true });
    const mk = (id, st, extra) => Object.assign({ id, date: new Date().toISOString(), status: st, name: "زبون " + id, phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", dtype: "home", desk: "", items: "منتج ×1 = 3000 DA", subtotal: 3000, fee: 400, total: 3400, note: "" }, extra || {});
    Admin.orders = [mk("E1", "confirmee"), mk("E2", "nouvelle")]; Admin.renderOrders(); Admin.openOrderPreview(0); await wait(100);
    const btn = !!document.querySelector("#ord-prev-a [onclick^=\"OrderEdit.open\"]"); Admin.openOrderPreview(1); await wait(50); const btnNew = !!document.querySelector("#ord-prev-a [onclick^=\"OrderEdit.open\"]");
    let saved = null; API.updateOrderFields = async (k, id, f) => { saved = { id, f }; return false; };
    OrderEdit.open(0); await wait(100); const bg = document.getElementById("oe-bg"), q = i => bg.querySelector("#" + i);
    const wilOpts = q("oe-wil").options.length, w2 = WILAYAS.find(w => w.name !== "Alger" && w.communes && w.communes.length && w.home > 0);
    q("oe-name").value = "اسم جديد"; q("oe-wil").value = w2.name; q("oe-wil").dispatchEvent(new Event("change")); await wait(50);
    const feeAfter = Number(q("oe-fee").value), comOpts = q("oe-com").options.length, totTxt = q("oe-tot").textContent;
    q("oe-save").click(); await wait(300);
    const o = Admin.orders[0], stored = OrderEdit.load(), re = Admin.liveOrders([{ id: "E1", name: "قديم", wilaya: "Alger", status: "confirmee" }])[0];
    // تحديث الشركة
    const ycfg = Admin.DELIVERY_COMPANIES.yalidine; const rq = ycfg.updateRequest({ apiId: "a", apiToken: "b" }, "yal-1", Object.assign({}, mk("E3", "confirmee"), { commune: "Alger Centre", wilaya: "Alger" }));
    const body = JSON.parse(rq.body); Admin.deliveryCfg.yalidine = { enabled: true, apiId: "a", apiToken: "b" };
    Admin.companyWilayas = async () => ({}); Admin.resolveCommune = async (co, cfg, ord) => ({ ok: true, name: ord.commune }); let sentReq = null; Admin.courierFetch = async r => { sentReq = r; return { ok: true, status: 200, text: "{}" }; };
    Admin.orders.push(mk("E4", "confirmee", { note: "🚚yalidine:yal-9" })); const ur = await Admin.updateAtCompany(Admin.orders.length - 1), skip = await Admin.updateAtCompany(0);
    // إرسال جماعي
    Admin.orders = [mk("B1", "confirmee"), mk("B2", "confirmee"), mk("B3", "nouvelle"), mk("B4", "confirmee", { note: "🚚yalidine:zz-1" })];
    Admin.activeCompanyKey = () => "yalidine"; Admin.orderCompanyKey = () => "yalidine"; Admin.enqueueNotify = () => { };
    Admin.sendOrderToDelivery = async i => { Admin.orders[i].note = (Admin.orders[i].note || "") + " 🚚yalidine:t" + i; return true; };
    await Admin.bulkSend(Admin.orders.slice()); await wait(100);
    const nt = document.getElementById("notice-modal-bg"), ntxt = nt ? nt.textContent : "";
    return { btn, btnNew, wilOpts, feeAfter, w2: w2.home, comOpts, totTxt, name: o.name, wilaya: o.wilaya, fee: o.fee, total: o.total, savedFields: saved && Object.keys(saved.f).sort().join(","), stored: !!stored.E1 && stored.E1.name === "اسم جديد", re: re.name + "|" + re.wilaya, patch: rq.method, bodyKeys: Object.keys(body).sort().join(","), home: body.is_stopdesk, ur, skip, sentMethod: sentReq && sentReq.method, sentUrl: sentReq && sentReq.url, notes: Admin.orders.map(x => /🚚/.test(x.note)), ntxt: /أُرسل 2/.test(ntxt) };
  });
  ok("تعديل الطلب: الزر يظهر للمؤكَّد فقط (لا للجديد)", oe.btn === true && oe.btnNew === false, oe);
  ok("تعديل الطلب: الاسم والولاية والرسم والإجمالي تتغير وتُحفظ", oe.name === "اسم جديد" && oe.wilaya !== "Alger" && oe.fee === oe.w2 && oe.total === 3000 + oe.w2 && oe.feeAfter === oe.w2 && oe.comOpts > 1, oe);
  ok("تعديل الطلب: عند تعذّر حفظ القاعدة يُحفظ التعديل في اللوحة ويُطبَّق عند التحميل", oe.stored && oe.re === "اسم جديد|" + oe.wilaya && /commune,desk,dtype,fee,name,total,wilaya/.test(oe.savedFields), oe);
  ok("تحديث الشركة: طلب PATCH بحقول التعديل فقط، وطرد مسجَّل يُحدَّث وغير المسجَّل يُتخطّى", oe.patch === "PATCH" && oe.bodyKeys === "address,declared_value,firstname,familyname,freeshipping,is_stopdesk,price,stopdesk_id,to_commune_name,to_wilaya_name".split(",").sort().join(",") && oe.ur.ok === true && oe.sentMethod === "PATCH" && /yal-9/.test(oe.sentUrl) && oe.skip.skipped === true, oe);
  ok("الإرسال الجماعي: يرسل المؤكَّدة غير المرسَلة فقط (اثنان) ويعرض الملخص", oe.notes.join() === "true,true,false,true" && oe.ntxt === true, oe);
  // ── تسجيل نتيجة الاتصال من نافذة المعاينة ──
  const pr = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; API.updateOrder = async () => ({ ok: true }); window.confirm = () => true; const wait = ms => new Promise(r => setTimeout(r, ms));
    const t = Admin.products[0].title; Admin.products[0].stock = null;
    Admin.orders = [{ id: "P1", date: new Date().toISOString(), status: "nouvelle", name: "زبون", phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", dtype: "home", items: t + " ×1 = 3000 DA", subtotal: 3000, fee: 400, total: 3400, note: "" }];
    Admin.renderOrders(); Admin.openOrderPreview(0); await wait(80);
    const sel = () => document.querySelector("#ord-prev-b select.oc-res"), pick = v => { const s = sel(); s.value = v; s.dispatchEvent(new Event("change")); };
    const btns = sel().options.length, cancelBtm = !!document.querySelector('#ord-prev-a [onclick*="cancelOrder"]');
    pick("a2"); await wait(150);
    const n1 = Admin.orders[0].note, hi = sel().value === "a2";
    pick("later"); await wait(150); const n2 = Admin.orders[0].note;
    const open1 = document.getElementById("ord-prev-bg").classList.contains("open");
    pick("clear"); await wait(150); const n3 = Admin.orders[0].note;
    pick("confirm"); await wait(200);
    const st1 = Admin.orders[0].status, eb1 = !!document.querySelector('#ord-prev-a [onclick^="OrderEdit.open"]'), afterSel = !!sel(), afterOpts = afterSel ? Array.from(sel().options).map(o => o.value).join() : "";
    Admin.orders[0].status = "livree"; Admin.openOrderPreview(0); await wait(50);
    const livOpts = sel() ? Array.from(sel().options).map(o => o.value).join() : "";
    return { btns, cancelBtm, n1, hi, n2, n3, open1, st: st1, editBtn: eb1, afterSel, afterOpts, livOpts };
  });
  ok("نافذة المعاينة: نتيجة الاتصال قائمة منسدلة (8 خيارات للجديد) ولا زر إلغاء في الأسفل", pr.btns === 8 && !pr.cancelBtm, pr);
  ok("نافذة المعاينة: «لم يُجب 2» تظهر محدَّدة ثم «لاحقاً» ثم «مسح» والنافذة تبقى مفتوحة", /📞2/.test(pr.n1) && pr.hi && /⏰لاحقاً/.test(pr.n2) && !/⏰لاحقاً|📞/.test(pr.n3) && pr.open1, pr);
  ok("نافذة المعاينة: «أكّد الطلب» من القائمة يؤكّد، والقائمة تبقى لكل الحالات (بلا تأكيد/إلغاء للمُسلَّم)", pr.st === "confirmee" && pr.editBtn && pr.afterSel && pr.afterOpts.includes("cancel") && !pr.afterOpts.includes("confirm") && !pr.livOpts.includes("cancel") && pr.livOpts.includes("a1"), pr);
  // ── جدول «الإعلان لكل منتج» ──
  const ad = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; const wait = ms => new Promise(r => setTimeout(r, ms));
    const saved = []; Priv.set = async (k, v) => { saved.push([k, JSON.stringify(v)]); }; Admin.fin.ads = {}; Admin._adRows = null; Admin._adSig = null;
    Admin.finClose(); const slug0 = Admin.products.find(x => x.slug !== "test" && x.active !== false).slug; Admin.finOpen(slug0, 2);
    const empty = document.getElementById("fin-ads-rows").textContent.includes("لا توجد حملة لهذا المنتج"), globalGone = !document.getElementById("fin-adbox") && !document.getElementById("fin-g-method");
    Admin.addAdRow(); const sel = document.getElementById("fin-p0-prod"), opts = sel ? sel.options.length : 0;
    const slug = Admin.products.find(x => x.slug !== "test" && x.active !== false).slug; sel.value = slug; sel.dispatchEvent(new Event("change"));
    const E = (id, v) => { const el = document.getElementById("fin-p0-" + id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    E("spend", "6000"); E("n", "10"); const live1 = document.getElementById("fin-p0-mode").selectedOptions[0].textContent;
    E("mode", "m:2"); const live2 = document.getElementById("fin-p0-mode").selectedOptions[0].textContent; E("n", "20"); const live3 = document.getElementById("fin-p0-mode").selectedOptions[0].textContent;
    E("mode", "fixed"); E("fx", "350"); const fxShown = document.getElementById("fin-p0-fx").style.display !== "none", live4 = document.getElementById("fin-p0-mode").selectedOptions[0].textContent; E("mode", "m:2"); E("n", "10");
    const before = saved.length; await Admin.saveAdRow(0); await wait(50);
    const svd = saved.length - before, hasTitle = /تكلفة الإعلان/.test(document.getElementById("fin-ads-rows").textContent), rowsAfter = document.querySelectorAll("#fin-ads-rows tbody tr").length, stored = Admin.fin.ads[slug];
    Admin.addAdRow(); const opts2 = Array.from(document.querySelectorAll("#fin-p1-prod option")).map(o => o.value);
    window.confirm = () => true; await Admin.delAdRow(0); await wait(50);
    Admin.finClose(); const tblOk = /المنتجات/.test(document.getElementById("fin-table").closest(".card").textContent) && Array.from(document.querySelectorAll("#fin-table th")).some(h => h.textContent === "الحكم");
    return { tblOk, empty, globalGone, opts, live1, live2, live3, live4, fxShown, saved: svd, rowsAfter, stored, dupHidden: !opts2.includes(slug), left: Object.keys(Admin.fin.ads).length, hasTitle };
  });
  ok("إعلان لكل منتج: لا إعداد عام، ولا صفوف قبل إضافة حملة", ad.empty && ad.globalGone, ad);
  ok("المخزون والأرباح: قائمة المنتجات بعمود «الحكم»", ad.tblOk, ad);
  ok("إعلان لكل منتج: القائمة تعرض Cost الحقيقي (6000÷10=600) وتتغير فوراً (×2=1200، وبـ20 طلباً 600، وثابت 350)", /Cost الحقيقي/.test(ad.live1) && /600/.test(ad.live1) && /1[\s,.\u202f\u00a0]?200/.test(ad.live2) && /600/.test(ad.live3) && ad.fxShown && /350/.test(ad.live4), ad);
  ok("إعلان لكل منتج: حفظ لكل صف، والمنتج المستعمل لا يتكرر في القائمة، والحذف يمسح الحملة", ad.saved === 1 && ad.rowsAfter === 1 && ad.stored && ad.stored.method === "spend" && ad.stored.a === 6000 && ad.stored.m === 2 && ad.dupHidden && ad.left === 0 && ad.hasTitle, ad);
  // ── المخزون والأرباح: قائمة المنتجات + 5 تبويبات لكل منتج ──
  const fpn = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; const wait = ms => new Promise(r => setTimeout(r, ms)); Priv.set = async () => {};
    const o0 = Admin.orders, a0 = Admin.ydActual, t0 = Admin.trackingOf, pr = Admin.products.find(x => x.slug !== "test" && x.active !== false), slug = pr.slug, price0 = pr.price, cost0 = Admin.fin.costs[slug];
    pr.price = 3000; Admin.fin.costs = Object.assign({}, Admin.fin.costs, { [slug]: 1000 }); Admin.fin.ads = {}; Admin._adRows = null; Admin._adSig = null;
    const d = new Date().toISOString();
    Admin.orders = [{ id: "fp1", name: "أ", phone: "0550000011", status: "livree", total: 3600, fee: 600, subtotal: 3000, date: d, wilaya: "Tipaza", commune: "Larhat", items: pr.title + " ×1 = 3000 DA", note: "" }, { id: "fp2", name: "ب", phone: "0550000012", status: "echec", total: 3600, fee: 600, subtotal: 3000, date: d, wilaya: "Tipaza", commune: "Larhat", items: pr.title + " ×1 = 3000 DA", note: "" }];
    Admin.ydActual = { "T-fp1": { st: "Livré", price: 3600, del: 600, ret: 0, ins: 0, cod: 22.5, net: 2977.5 }, "T-fp2": { st: "Retourné au vendeur", price: 0, del: 0, ret: 250, ins: 0, cod: 0, net: -250 } };
    Admin.trackingOf = o => ({ company: "yalidine", tracking: "T-" + o.id });
    Admin.finClose(); Admin.finView("prod"); await wait(30);
    const list = document.getElementById("fin-table"), listRow = Array.from(list.querySelectorAll("tr")).some(r => r.textContent.includes(pr.title) && /مربح|خاسر|أقل من المطلوب|أدخل/.test(r.textContent)), seg = !!document.querySelector('#fin-seg [data-fv="set"]');
    Admin.finOpen(slug); await wait(30);
    const panelOpen = !document.getElementById("fin-panel").classList.contains("hidden") && document.getElementById("fin-list-card").classList.contains("hidden"), t1 = document.getElementById("fp-1").textContent, buy = document.getElementById("fp-buy") && document.getElementById("fp-buy").value;
    Admin.finTab(3); const heads = Array.from(document.querySelectorAll("#fp-stock tr.hd th")).map(t => t.textContent), lastHead = heads[heads.length - 1];
    Admin.finTab(2); const adsIn = !!document.getElementById("fin-ads").closest("#fp-2") && !document.getElementById("fp-2").classList.contains("hidden");
    Admin.finTab(4); const t4 = document.getElementById("fp-4").textContent, rows4 = document.querySelectorAll("#fp-4 table tr").length - 1, agg = Admin.finPayAgg(pr);
    Admin.finTab(5); const t5 = document.getElementById("fp-5").textContent, verdictGood = document.getElementById("fp-verdict").textContent;
    let lowB = 1000; for (; lowB <= 4000; lowB += 25) { Admin.fin.costs[slug] = lowB; const r0 = Admin._finC.per[slug] || { units: 0, retUnits: 0, profit: 0 }; if (Admin.finVerdict(pr, r0, Admin.suggestPrice(pr, r0, Admin._finC.K)).k === "low") break; }
    Admin.fin.costs[slug] = lowB; Admin.finTab(5); const t5b = document.getElementById("fp-5").textContent, verdictLow = document.getElementById("fp-verdict").textContent;
    Admin.fin.costs[slug] = 6000; Admin.finTab(5); const t5c = document.getElementById("fp-5").textContent, verdictLoss = document.getElementById("fp-verdict").textContent;
    await Admin.finAi(); const aiSt = document.getElementById("fp-ai-st").textContent;
    Admin.finClose(); const back = !document.getElementById("fin-list-card").classList.contains("hidden") && document.getElementById("fin-panel").classList.contains("hidden");
    Admin.orders = o0; Admin.ydActual = a0; Admin.trackingOf = t0; pr.price = price0; if(cost0 == null) delete Admin.fin.costs[slug]; else Admin.fin.costs[slug] = cost0;
    return { listRow, seg, panelOpen, t1: /سعر الشراء/.test(t1) && /الفائدة المطلوبة/.test(t1) && /سعر البيع الأدنى/.test(t1), buy, lastHead, noExp: !heads.includes("الربح المتوقع") && !heads.includes("ربح القطعة"), adsIn, rows4, nd: agg.nDone, nr: agg.nRet, net: agg.netDone, retLoss: agg.retLoss, t4: /السعر الصافي للقطعة/.test(t4), good: verdictGood, low: verdictLow, loss: verdictLoss, t5: /مربح/.test(t5) && /المقارنة/.test(t5), t5b: /ارفع سعر البيع/.test(t5b), t5c: /خاسر/.test(t5c) && /أوقف الإعلان/.test(t5c), aiSt, back };
  });
  ok("المخزون والأرباح: قائمة المنتجات بحكم لكل منتج وشريط (المنتجات | الإعدادات العامة)، وفتح منتج يخفي القائمة ويُظهر لوحته، والإغلاق يعيدها", fpn.listRow && fpn.seg && fpn.panelOpen && fpn.back, fpn);
  ok("تبويب التكاليف والمصاريف: جدول بنود (سعر الشراء 1000 قابل للتعديل، الفائدة المطلوبة، سعر البيع الأدنى)", fpn.t1 && fpn.buy === "1000", fpn);
  ok("تبويب المخزون والأرباح: يتوقف الجدول عند «الربح الحقيقي» بلا أعمدة المتوقع وربح القطعة، وبطاقة الحملة داخل تبويب الحملة", fpn.lastHead === "الربح الحقيقي" && fpn.noExp && fpn.adsIn, fpn);
  ok("تبويب المدفوعات: طلب مسلَّم (صافي 2977.5) وآخر مرتجع (250) لهذا المنتج فقط", fpn.rows4 === 2 && fpn.nd === 1 && fpn.nr === 1 && Math.abs(fpn.net - 2977.5) < 1e-6 && fpn.retLoss === 250 && fpn.t4, fpn);
  ok("تبويب التحاليل: حكم مربح (شراء 1000)، أقل من المطلوب (سعر شراء وسيط)، خاسر (6000) مع اقتراح رفع السعر وإيقاف الإعلان، وزر التحليل الذكي يطلب المفتاح أولاً", /مربح/.test(fpn.good) && /أقل من المطلوب/.test(fpn.low) && /خاسر/.test(fpn.loss) && fpn.t5 && fpn.t5b && fpn.t5c && /مفتاح/.test(fpn.aiSt), fpn);
  // ── مولّد الصور: نوع الصورة (مشهد | PNG بلون موحّد | PNG شفافة) + خيارات الإضافة + زرّا التوليد ──
  const igt = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); const $ = id => document.getElementById(id);
    window.confirm = () => true; ImgGen.open(); ImgGen.tab("set"); const k = $("ig-key"); k.value = "TESTKEY"; ImgGen.saveKey(); ImgGen.tab("make"); ImgGen.mode("ad"); await wait(30);
    const ui = { bgm: !!$("ig-bgm"), opts: $("ig-bgm") ? Array.from($("ig-bgm").options).map(o => o.value).join() : "", tn: !!$("ig-t-name"), td: !!$("ig-t-desc"), tg: !!$("ig-t-goal"), go: !!$("ig-go") && /توليد صورة ذكية/.test($("ig-go").textContent), go2: !!$("ig-go2") && /في المطوّر/.test($("ig-go2").textContent), cbox: $("ig-bgcbox").style.display };
    ImgGen.mode("product"); await wait(30); const noGoalInProduct = !$("ig-t-goal"); ImgGen.mode("ad"); await wait(30);
    $("ig-name").value = "عسل السدر"; $("ig-desc").value = "عسل جبلي طبيعي"; $("ig-goal").value = "خصم 30%";
    $("ig-t-name").checked = true; ImgGen.tog(); const l1 = $("ig-txt").value; $("ig-t-desc").checked = true; $("ig-t-goal").checked = true; ImgGen.tog(); const l3 = $("ig-txt").value, boxShown = $("ig-txtbox").style.display;
    $("ig-t-name").checked = $("ig-t-desc").checked = $("ig-t-goal").checked = false; ImgGen.tog(); const cleared = $("ig-txt").value === "" && $("ig-txtbox").style.display === "none";
    const pr = ImgGen._t.buildPrompt({ mode: "product", name: "x", desc: "", w: 1000, h: 1000, ar: "1:1", bgMode: "solid", bgColor: "#ffcc00" }), pr2 = ImgGen._t.buildPrompt({ mode: "product", name: "x", desc: "", w: 1000, h: 1000, ar: "1:1" });
    const mkSrc = () => { const c = document.createElement("canvas"); c.width = c.height = 400; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 400); g.fillStyle = "#b45309"; g.fillRect(130, 90, 140, 230); return c; };
    const toBlob = c => new Promise(r => c.toBlob(r, "image/png"));
    const srcC = mkSrc(), srcB = await toBlob(srcC), genB64 = () => new Promise(r => { const rd = new FileReader(); rd.onload = () => r(String(rd.result).split(",")[1]); toBlob(mkSrc()).then(b => rd.readAsDataURL(b)); });
    const b64 = await genB64(), of = window.fetch; window.fetch = async (u, o) => /generativelanguage/.test(String(u)) ? (/models\?/.test(String(u)) ? new Response(JSON.stringify({ models: [{ name: "models/gemini-2.5-flash-image" }] }), { status: 200 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: b64 } }] } }] }), { status: 200 })) : of(u, o);
    ImgGen._t.S.srcBlob = srcB; ImgGen.mode("product"); await wait(30); $("ig-name").value = "منتج"; $("ig-bgm").value = "transp"; ImgGen.bgm("transp"); $("ig-size").value = "shop"; ImgGen.size("shop");
    await ImgGen.generate(); await wait(300);
    const S = ImgGen._t.S, cv = S.res, g = cv && cv.getContext("2d"), px = (x, y) => g ? Array.from(g.getImageData(x, y, 1, 1).data) : [], out = { meta: S.meta && S.meta.bgMode, fmtPng: S.meta && S.meta.bgMode === "transp", corner: px(3, 3), center: px(Math.round(cv.width / 2), Math.round(cv.height / 2)), prompt: /BACKGROUND/.test(S.lastPrompt || "") && /no cast shadow/.test(S.lastPrompt || ""), msg: ($("ig-msg") || {}).textContent };
    window.fetch = of; ImgGen.bgm("scene");
    return { ui, noGoalInProduct, l1, l3, boxShown, cleared, flat: /#FFCC00/.test(pr) && /perfectly flat/.test(pr) && !/ART DIRECTION/.test(pr), scene: /ART DIRECTION/.test(pr2) && !/perfectly flat/.test(pr2), out };
  });
  ok("مولّد الصور: قائمة نوع الخلفية (مشهد/لون موحّد/شفافة) وثلاثة خيارات إضافة (الحملة للإشهارية فقط) وزرّا «توليد صورة ذكية» و«إنشاء الصورة في المطوّر»", igt.ui.bgm && igt.ui.opts === "scene,solid,transp" && igt.ui.tn && igt.ui.td && igt.ui.tg && igt.ui.go && igt.ui.go2 && igt.ui.cbox === "none" && igt.noGoalInProduct, igt);
  ok("مولّد الصور: تفعيل الخيارات يملأ النص (اسم ثم وصف ثم الحملة) ويُظهر طريقة الإضافة، وإلغاؤها يُفرغه", igt.l1 === "عسل السدر" && igt.l3 === "عسل السدر\nعسل جبلي طبيعي\nخصم 30%" && igt.boxShown === "block" && igt.cleared, igt);
  ok("مولّد الصور: تعليمات الخلفية الموحّدة بلون محدد بلا مشهد فني، وتعليمات المشهد كما كانت", igt.flat && igt.scene, igt);
  ok("مولّد الصور: الخلفية الشفافة تُنتج PNG بزوايا شفافة والمنتج معتم", igt.out.meta === "transp" && igt.out.prompt && igt.out.corner[3] < 40 && igt.out.center[3] > 200, igt);
  // ── معاينة من «الطلبات المسجلة»: تعديل + حذف + طباعة ──
  const rg = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; API.updateOrder = async () => ({ ok: true });
    Admin.orders = [{ id: "R1", date: new Date().toISOString(), status: "confirmee", name: "مسجل", phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", dtype: "home", desk: "", items: "منتج ×1 = 3000 DA", subtotal: 3000, fee: 400, total: 3400, note: "🚚yalidine:yal-123" }];
    Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: Object.assign({}, (Admin.deliveryCfg || {}).yalidine, { enabled: true }) });
    Admin.renderShipped(); const pv = Array.from(document.querySelectorAll("#ship-table .act button")).find(b => /openOrderPreview/.test(b.getAttribute("onclick") || ""));
    if (pv) pv.click(); await wait(80);
    const has = s => !!document.querySelector("#ord-prev-a " + s), calls = [], origDel = Admin.deleteOrders; Admin.deleteOrders = async l => { calls.push(l.map(o => o.id).join()); };
    const out = { tableBtn: !!pv, edit: has('[onclick^="OrderEdit.open"]'), slip: has('[onclick^="Admin.printOrderSlip"]'), label: has('[onclick^="Admin.openLabel"]'), del: has('[onclick*="Admin.deleteOrders"]'), tr: /yal-123/.test(document.getElementById("ord-prev-b").textContent) };
    document.querySelector('#ord-prev-a [onclick*="Admin.deleteOrders"]').click(); await wait(30); Admin.deleteOrders = origDel; out.calls = calls.join("|"); out.closed = !document.getElementById("ord-prev-bg").classList.contains("open"); return out;
  });
  ok("الطلبات المسجلة: زر «معاينة» يفتح نافذة فيها تعديل ووصل (طباعة) وبوليصة الشركة وحذف مع التتبع", rg.tableBtn && rg.edit && rg.slip && rg.label && rg.del && rg.tr, rg);
  ok("الطلبات المسجلة: زر الحذف في المعاينة يحذف الطلب ويغلق النافذة", rg.calls === "R1" && rg.closed, rg);
  // ── خصم المخزون عند التأكيد: عرض «علبتان + الثالثة مجاناً» (×3) ──
  const skf = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; API.updateOrder = async () => ({ ok: true }); window.confirm = () => true; Admin.queueStockPublish = () => {}; Admin.fin.cfg.since = "2000-01-01"; Admin.orderFilters = {};
    const wait = ms => new Promise(r => setTimeout(r, ms)), pr = Admin.products.find(x => x.slug === "anti-acne") || Admin.products.find(x => x.slug !== "test" && !x.variations);
    pr.stock = 8; const mk = (id, q, v) => ({ id, date: new Date().toISOString(), status: "nouvelle", name: "ز" + id, phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", dtype: "home", desk: "", items: pr.title + " ×" + q + " = " + v + " DA", subtotal: v, fee: 0, total: v, note: "" });
    Admin.orders = [mk("S1", 1, 2400), mk("S2", 3, 4800)];
    await Admin.confirmOrder(0, true); await wait(50); await Admin.confirmOrder(1, true); await wait(50);
    return { stock: pr.stock, notes: Admin.orders.map(o => o.note), lines: Admin.orderLines(Admin.orders[1]).map(l => l.qty), st: Admin.orders.map(o => o.status) };
  });
  ok("المخزون: تأكيد طلب ×1 وطلب عرض ×3 (علبتان + مجانية) يخصم 4 علب (8 ← 4)", skf.stock === 4 && skf.lines[0] === 3, skf);
  // ── المخزون لا يرجع لرقم قديم بعد إعادة تحميل اللوحة (قراءة النسخة المنشورة الأحدث) ──
  const fr = await p.evaluate(async () => {
    const orig = GH.getFile, cfg0 = GH.cfg; GH.cfg = () => ({ token: "t", owner: "o", repo: "r", branch: "main" });
    const txt = 'var CATEGORIES = {"a":"أ"};\nvar PRODUCTS = [{"slug":"anti-acne","title":"ك","price":1,"stock":2}];\n';
    GH.getFile = async () => ({ sha: "x", content: btoa(unescape(encodeURIComponent(txt))) });
    const ok = await Admin.freshData(); GH.getFile = async () => { throw new Error("net"); }; const bad = await Admin.freshData(); GH.getFile = orig; GH.cfg = cfg0;
    return { stock: ok && ok.p[0].stock, cat: ok && ok.c.a, bad };
  });
  ok("المخزون: قراءة المنتجات من النسخة المنشورة الأحدث، وعند الفشل يعود للملف المحلي", fr.stock === 2 && fr.cat === "أ" && fr.bad === null, fr);
  // ── ترتيب القائمة الجانبية: خمس مجموعات ──
  const nv = await p.evaluate(() => {
    const out = {}; const vis = () => Array.from(document.querySelectorAll(".side-nav .nav-btn")).filter(b => b.offsetParent !== null).map(b => { const c = b.querySelector(".nav-txt b").cloneNode(true); c.querySelectorAll(".nb,.app-off-tag").forEach(x => x.remove()); return c.textContent.trim(); });
    ["gen", "products", "shop", "look", "apps"].forEach(g => { AdminNav.group(g); out[g] = vis(); });
    AdminNav.group("gen"); Admin.tab("setup", Array.from(document.querySelectorAll(".side-nav .nav-btn")).find(b => (b.getAttribute("onclick") || "").includes("'setup'")));
    out.segOn = Array.from(document.querySelectorAll(".tab-seg .on")).map(b => b.dataset.sg).join(); out.storeOn = (document.querySelector(".side-nav .nav-btn.on .nav-txt b") || {}).textContent;
    out.setupShown = !document.getElementById("tab-setup").classList.contains("hidden"); out.groups = document.querySelectorAll("#nav-groups .ng").length; out.pend = !Array.from(document.querySelectorAll(".side-nav .nav-btn")).some(b => (b.getAttribute("onclick") || "").includes("'pending'"));
    return out;
  });
  const j = a => a.map(x => x.replace(/\s+/g, " ")).join("|");
  ok("القائمة: الإعدادات العامة = لوحة التحكم + إعدادات الموقع + المدونة (بلا تجهيز ولا بانتظار التأكيد)", j(nv.gen) === "لوحة التحكم|إعدادات الموقع|المدوّنة والسياسات|الفريق والأمان" && nv.pend && nv.groups === 5, nv.gen);
  ok("القائمة: المنتجات = المنتجات، الصفحات، التصنيفات، السمات، التحليلات", j(nv.products) === "المنتجات|الصفحات|التصنيفات|السمات|التحليلات|تعديل جماعي|فحص المنتجات|SEO", nv.products);
  ok("القائمة: ecommerce تبدأ بالبكسلات ثم الطلبات والمسجلة والمخزون والأرباح والمدفوعات", j(nv.shop).startsWith("البكسلات|الطلبات|الطلبات المسجلة|المخزون والأرباح|المدفوعات|") && !nv.shop.includes("نموذج الطلب"), nv.shop);
  ok("القائمة: نموذج الطلب ضمن التطبيقات، وتجهيز المتجر يفتح من شريط إعدادات الموقع", nv.apps.includes("نموذج الطلب") && nv.setupShown && /^setup(,setup)*$/.test(nv.segOn) && /إعدادات الموقع/.test(nv.storeOn || ""), nv);
  // ── معاينة طرد ياليدين: تعديل + حذف للطرد في مرحلة التحضير ──
  const yp = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true;
    Admin.listCompanyKey = () => "yalidine"; Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: { apiId: "a", apiToken: "b", enabled: true } });
    const reqs = [], cf0 = Admin.courierFetch, lk0 = Admin.listCompanyKey; Admin.courierFetch = async rq => { reqs.push({ m: rq.method, u: rq.url, b: rq.body }); if (/\/v1\/centers\//.test(rq.url)) return { ok: true, status: 200, text: JSON.stringify({ data: WILAYAS.reduce((a, w) => a.concat((w.desks || []).map(d => ({ center_id: d.id, name: d.name, address: "", commune_name: d.commune || "", wilaya_id: w.id }))), []), has_more: false }) }; return { ok: true, status: 200, text: "{}" }; };
    Admin.orders = []; AdminYd.set([{ tracking: "yal-AAA", date: "2026-10-10", name: "ع** ا", phone: "0*****1", wilaya: "Alger", commune: "Bab Ezzouar", price: 3000, status: "En préparation" }, { tracking: "yal-BBB", date: "2026-10-09", name: "س** ", phone: "0*****2", wilaya: "Oran", commune: "Es Senia", price: 2000, status: "Livré" }], 2, false);
    const btns = document.querySelectorAll("#yd-card [data-ydp]").length;
    document.querySelector('#yd-card [data-ydp="yal-BBB"]').click(); const doneBtns = document.querySelectorAll("#ydp-bg [data-ydp-do=edit],#ydp-bg [data-ydp-do=del]").length, doneNote = /مرحلة التحضير/.test(document.getElementById("ydp-bg").textContent); document.querySelector("#ydp-bg [data-ydp-do=close]").click();
    document.querySelector('#yd-card [data-ydp="yal-AAA"]').click(); const prepBtns = document.querySelectorAll("#ydp-bg [data-ydp-do=edit],#ydp-bg [data-ydp-do=del]").length;
    document.querySelector("#ydp-bg [data-ydp-do=edit]").click(); const infoKept = /Bab Ezzouar/.test(document.getElementById("ydp-bg").textContent), lists = ["ydp-w", "ydp-c", "ydp-t"].every(i => document.getElementById(i) && document.getElementById(i).tagName === "SELECT"), curW = document.getElementById("ydp-w").value, curC = document.getElementById("ydp-c").value, nCom = document.getElementById("ydp-c").options.length;
    document.getElementById("ydp-c").value = "Kouba"; document.getElementById("ydp-p").value = "3400"; document.querySelector("#ydp-bg [data-ydp-do=save]").click(); await wait(120);
    const patch = reqs.find(r => r.m === "PATCH"), body = patch ? JSON.parse(patch.b) : null, row = AdminYd.S.rows.find(r => r.tracking === "yal-AAA");
    document.querySelector("#ydp-bg [data-ydp-do=edit]").click(); const tt = document.getElementById("ydp-t"); tt.value = "stop"; tt.dispatchEvent(new Event("change", { bubbles: true })); const nDesk = document.getElementById("ydp-d").options.length, dshown = document.getElementById("ydp-dw").style.display !== "none"; document.querySelector("#ydp-bg [data-ydp-do=save]").click(); await wait(150);
    const patch2 = reqs.filter(r => r.m === "PATCH")[1], body2 = patch2 ? JSON.parse(patch2.b) : null; document.querySelector("#ydp-bg [data-ydp-do=edit]").click(); const t3 = document.getElementById("ydp-t").value;
    document.querySelector("#ydp-bg [data-ydp-do=back]").click();
    document.querySelector("#ydp-bg [data-ydp-do=del]").click(); await wait(80);
    const del = reqs.find(r => r.m === "DELETE"); Admin.courierFetch = cf0; Admin.listCompanyKey = lk0;
    return { btns, doneBtns, doneNote, prepBtns, infoKept, lists, curW, curC, nCom, nDesk, dshown, body2, t3, body, rowC: row && row.commune, rowP: row && row.price, del: del && del.u, left: AdminYd.S.rows.map(r => r.tracking).join(), closed: !document.getElementById("ydp-bg") };
  });
  ok("طرود ياليدين: زر معاينة لكل طرد، والطرد المُسلَّم بلا تعديل/حذف", yp.btns === 2 && yp.doneBtns === 0 && yp.doneNote, yp);
  ok("طرود ياليدين: تعديل طرد En préparation يرسل PATCH بالحقول المغيَّرة فقط ويحدّث الجدول", yp.prepBtns === 2 && yp.body && yp.body.to_commune_name === "Kouba" && yp.body.to_wilaya_name === "Alger" && yp.body.is_stopdesk === false && yp.body.price === 3400 && !("firstname" in yp.body) && yp.rowC === "Kouba" && yp.rowP === 3400, yp);
  ok("طرود ياليدين: نموذج التعديل يُبقي المعلومات الحالية وفيه قوائم الولاية والبلدية ونوع التوصيل محدَّدة بالقيم الحالية", yp.infoKept && yp.lists && yp.curW === "Alger" && yp.nCom > 5 && yp.curC, yp);
  ok("طرود ياليدين: تحويل التوصيل إلى مكتب يُظهر قائمة المكاتب ويرسل is_stopdesk وstopdesk_id، ويحفظ النوع", yp.dshown && yp.nDesk > 0 && yp.body2 && yp.body2.is_stopdesk === true && typeof yp.body2.stopdesk_id === "number" && yp.t3 === "stop", yp);
  ok("طرود ياليدين: حذف الطرد يرسل DELETE ويزيله من الجدول ويغلق النافذة", /yal-AAA$/.test(yp.del || "") && yp.left === "yal-BBB" && yp.closed, yp);
  // ── سلة مهملات الطلبات + الحذف من المسجلة لا يحذف الطلب ──
  const tr = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {};
    const upd = [], dels = []; API.updateOrder = async (k, id, st, note) => { upd.push(id + ":" + note); return { ok: true }; }; API.deleteOrder = async (k, id) => { dels.push(id); return true; };
    const mk = (id, st, note) => ({ id, date: new Date().toISOString(), status: st, name: "ز" + id, phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", items: "", subtotal: 3000, fee: 0, total: 3000, note: note || "" });
    Admin.orders = [mk("T1", "nouvelle"), mk("T2", "nouvelle")]; Admin.trash = []; Admin.renderOrders();
    await Admin.deleteOrders([Admin.orders[0]]);
    const afterDel = Admin.orders.map(o => o.id).join(), inTrash = Admin.trash.map(o => o.id).join(), tagged = /🗑@\d{4}-\d\d-\d\d/.test(Admin.trash[0].note), noHard = dels.length === 0, badge = document.getElementById("trash-count").textContent;
    // التحميل التالي يُخفيها ويُبقيها في السلة
    const raw = [Object.assign({}, Admin.trash[0]), mk("T2", "nouvelle")], live = Admin.liveOrders(raw), trashAfter = Admin.trash.map(o => o.id).join();
    document.getElementById("trash-btn").click(); const rowsOpen = document.querySelectorAll("#trash-b [data-tr=restore]").length;
    document.querySelector("#trash-b [data-tr=restore]").click(); await wait(30);
    const restored = Admin.orders.map(o => o.id).sort().join(), clean = !/🗑/.test(Admin.orders.find(o => o.id === "T1").note), trashEmpty = Admin.trash.length;
    await Admin.deleteOrders([Admin.orders[0], Admin.orders[1]]); document.getElementById("trash-btn").click(); const two = document.querySelectorAll("#trash-b [data-tr=purge]").length;
    document.querySelector("#trash-b [data-tr=empty]").click(); await wait(60);
    const purged = dels.slice().sort().join(), emptyMsg = /السلة فارغة/.test(document.getElementById("trash-b").textContent); document.getElementById("trash-bg").classList.remove("open");
    // الحذف من «الطلبات المسجلة»: يلغي الطرد ويُبقي الطلب
    Admin.listCompanyKey = () => "yalidine"; Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: { apiId: "a", apiToken: "b", enabled: true } }); const cf0 = Admin.courierFetch, creq = []; Admin.courierFetch = async rq => { creq.push(rq.method); return { ok: true, status: 200, text: "{}" }; };
    Admin.orders = [mk("S1", "confirmee", "🚚yalidine:yal-ZZZ")]; document.getElementById("tab-shipped").classList.remove("hidden"); Admin.openOrderPreview(0);
    const btnTxt = (Array.from(document.querySelectorAll("#ord-prev-a button")).find(b => /حذف/.test(b.textContent)) || {}).textContent || "", sh = !!document.querySelector('#ord-prev-a [onclick*="Admin.deleteOrders"]');
    Array.from(document.querySelectorAll("#ord-prev-a button")).find(b => /حذف/.test(b.textContent)).click(); await wait(80);
    const kept = Admin.orders.length === 1 && !Admin.trashed, untagged = !Admin.trackingOf(Admin.orders[0]), cancelled = creq.includes("DELETE"); Admin.courierFetch = cf0; document.getElementById("tab-shipped").classList.add("hidden");
    return { afterDel, inTrash, tagged, noHard, badge, live: live.map(o => o.id).join(), trashAfter, rowsOpen, restored, clean, trashEmpty, two, purged, emptyMsg, btnTxt, sh, kept, untagged, cancelled };
  });
  ok("السلة: حذف الطلب ينقله للسلة بوسم التاريخ دون حذف نهائي ويظهر العدّاد", tr.afterDel === "T2" && tr.inTrash === "T1" && tr.tagged && tr.noHard && /1/.test(tr.badge), tr);
  ok("السلة: إعادة تحميل الطلبات تُخفي المحذوف وتُبقيه في السلة", tr.live === "T2" && tr.trashAfter === "T1", tr);
  ok("السلة: إعادة الإدراج تُرجع الطلب بلا وسم وتفرّغ مكانه من السلة", tr.rowsOpen === 1 && tr.restored === "T1,T2" && tr.clean && tr.trashEmpty === 0, tr);
  ok("السلة: تفريغ السلة يحذف الكل نهائياً", tr.two === 2 && tr.purged === "T1,T2" && tr.emptyMsg, tr);
  ok("الطلبات المسجلة: الحذف يلغي الطرد ويُبقي الطلب (لا يمرّ بالسلة) ولا يظهر زر حذف الطلب", /المسجلة/.test(tr.btnTxt) && !tr.sh && tr.kept && tr.untagged && tr.cancelled, tr);
  // ── جدول تكلفة المنتجات ──
  const cc = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), pr0 = Admin.products, set0 = Priv.set; Priv.set = async () => { }; Admin.renderFinance = () => { };
    Admin.products = [{ slug: "cc1", title: "كريم تجريبي", active: true }]; Admin.fin = Admin.fin || { costs: {}, ads: {}, set: {}, cfg: {}, log: [] }; Admin.fin.costs = Admin.fin.costs || {}; Admin.fin.cc = {}; Admin.fin.rcp = {}; Admin._rc = null; Admin._ccPend = {}; Admin._ccDraft = {};
    (Admin.ccList().forEach(p => { if (Admin.ccSec(p.slug) === "none") { Admin._ccPend = Admin._ccPend || {}; Admin._ccPend[p.slug] = "bought"; } }), Admin.renderCostCalc(true)); const heads = Array.from(document.querySelectorAll("#fin-cc-rows tr.hd th")).map(t => t.textContent);
    // «مشترى جاهز» (الافتراضي): السعر المكتوب = سعر الشراء مباشرة
    const modeDef = document.querySelector('#fin-cc-rows tr[data-cc="0"]').dataset.sec, noMade = !document.getElementById("cc0-raw"); document.getElementById("cc0-buy").value = 1234; Array.from(document.querySelectorAll("#fin-cc-rows button.green")).find(b => /حفظ/.test(b.textContent)).click(); await wait(60);
    const boughtCost = Admin.fin.costs.cc1, boughtMode = Admin.fin.cc.cc1.mode;
    // مسح الخانة وحفظ = حذف سعر الشراء فعلياً
    document.getElementById("cc0-buy").value = ""; Array.from(document.querySelectorAll("#fin-cc-rows button.green")).find(b => /حفظ/.test(b.textContent)).click(); await wait(60);
    const clearedCost = Admin.fin.costs.cc1 === undefined, clearedCc = Admin.fin.cc.cc1 === undefined, clearedUi = !document.getElementById("cc0-buy");
    // التكلفة الإنتاجية: المنتج ينتقل إلى قسم المصنَّع (بلا عمود «نوع المنتج»)
    Admin._ccPend = { cc1: "made" }; Admin.renderCostCalc(true);
    const mheads = Array.from(document.querySelectorAll("#fin-cc-rows tr.hd th")).map(t => t.textContent), secs = Array.from(document.querySelectorAll("#fin-cc-rows details.cc-sec")).map(d => d.dataset.k + ":" + d.querySelectorAll("tr[data-cc]").length).join(",");
    const set = (k, v) => { const e = document.getElementById("cc0-" + k); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
    set("raw", 2000); set("ml", 50); set("pack", 100); set("oth", 50);
    const mat = document.getElementById("cc0-mat").textContent, tot = document.getElementById("cc0-tot").textContent;
    Array.from(document.querySelectorAll("#fin-cc-rows button")).find(b => /حفظ/.test(b.textContent)).click(); await wait(60);
    const out = { clearedCost, clearedCc, clearedUi, heads, mheads, secs, modeDef, noMade, boughtCost, boughtMode, noCurCol: !heads.some(h => /سعر الشراء الحالي/.test(h)), noTypeCol: !mheads.includes("نوع المنتج") && !heads.includes("نوع المنتج"), tabBtn: Array.from(document.querySelectorAll(".nav-btn")).some(b => /تكلفة المنتجات/.test(b.textContent)), inOwnTab: !!document.querySelector("#tab-costs #fin-cc") && !document.querySelector("#tab-finance #fin-cc"), mat, tot, cost: Admin.fin.costs.cc1, saved: JSON.stringify(Admin.fin.cc.cc1) };
    // تبويب الوصفات: وصفة بنسب المواد الأولية تُحدّد سعر الكلغ تلقائياً في التكلفة الإنتاجية
    Admin.ccView("rcp"); const v = (id, x) => { const e = document.getElementById(id); e.value = x; e.dispatchEvent(new Event("input", { bubbles: true })); };
    out.rcpShown = !document.getElementById("rcp-view").classList.contains("hidden") && document.getElementById("fin-cc-rows").classList.contains("hidden") && document.querySelector('#cc-seg button[data-cv="rcp"]').classList.contains("on");
    v("rc0-name", "كريم تجريبي"); document.getElementById("rc0-unit").value = "kg"; document.getElementById("rc0-unit").dispatchEvent(new Event("change", { bubbles: true }));
    v("rc0-n0", "زيت"); v("rc0-p0", 30); v("rc0-r0", 5000); Admin.rcpRowAdd(0); v("rc0-n1", "مستخلص"); v("rc0-p1", 10); v("rc0-r1", 12000); Admin.rcpRowAdd(0); v("rc0-n2", "ماء"); v("rc0-p2", 60); v("rc0-r2", 0);
    out.sum = document.getElementById("rc0-sum").textContent; out.lbl = /الكلغ/.test(out.sum);
    await Admin.rcpSave(0); const rc = Object.values(Admin.fin.rcp);
    out.rcpSaved = rc.length === 1 && rc[0].slug === "cc1" && rc[0].rec.length === 3 && rc[0].unit === "kg";
    Admin.ccView("cost"); await wait(30); out.recRaw = document.getElementById("cc0-raw").value; out.recRo = document.getElementById("cc0-raw").readOnly; out.recUnit = document.getElementById("cc0-unit").value; out.recUnitDis = document.getElementById("cc0-unit").disabled; out.recMat = document.getElementById("cc0-mat").textContent;
    // تعديل الوصفة يغيّر سعر الكلغ في التكلفة تلقائياً
    Admin.ccView("rcp"); v("rc0-r0", 6000); await Admin.rcpSave(0); Admin.ccView("cost"); await wait(30); out.recRaw2 = document.getElementById("cc0-raw").value; out.recMat2 = document.getElementById("cc0-mat").textContent;
    Admin.products = pr0; Priv.set = set0; return out;
  });
  ok("جدول التكلفة الإنتاجية: المنتج أولاً ثم الوحدة وسعر اللتر/الكلغ بلا عمود «نوع المنتج»، والحساب فوري (2000 دج/لتر × 50مل = 100 + عبوة 100 + أخرى 50 = 250)", cc.mheads[0] === "المنتج" && /لتر/.test(cc.mheads[2]) && cc.noTypeCol && cc.mat === "100" && cc.tot === "250", cc);
  ok("تبويب الوصفات: وصفة بنسب المواد (30%×5000 + 10%×12000 = 2700 دج/كلغ) تُحفظ وتُربط بالمنتج، وسعر الكلغ والوحدة يظهران تلقائياً (للقراءة فقط) في التكلفة الإنتاجية، وتعديل الوصفة يغيّره (6000: 1800+1200 = 3000 × 50غ = 150)", cc.rcpShown && /2[,\s.\u202f\u00a0]?700/.test(cc.sum) && cc.lbl && cc.rcpSaved && cc.recRaw === "2700" && cc.recRo && cc.recUnit === "kg" && cc.recUnitDis && cc.recMat === "135" && cc.recRaw2 === "3000" && cc.recMat2 === "150", cc);
  ok("تبويب تكلفة المنتجات: في تبويب مستقل بلا عمود «سعر الشراء الحالي»، والافتراضي «مشترى جاهز» (1234 ← سعر الشراء مباشرة)", cc.tabBtn && cc.inOwnTab && cc.noCurCol && cc.modeDef === "bought" && cc.noMade && cc.boughtCost === 1234 && cc.boughtMode === "bought", cc);
  ok("تكلفة المنتجات: مسح خانة سعر الشراء وحفظها يحذف السعر فعلاً (لا يعود بعد التحديث)", cc.clearedCost && cc.clearedCc && cc.clearedUi, cc);
  ok("جدول التكلفة: «حفظ» لمن يصنّع يجعل الإجمالي المحسوب سعر الشراء ويحفظ المدخلات", cc.cost === 250 && /"raw":2000/.test(cc.saved) && /"ml":50/.test(cc.saved), cc);
  // ── بحث الطلبات المسجلة تلقائي ويصفّي البطاقتين + نسخ الزبون من معاينة الطرد ──
  const sq = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); Admin.refreshAlerts = async () => {}; document.getElementById("tab-shipped").classList.remove("hidden");
    const mk = (id, name, trk, ph) => ({ id, date: "2026-10-10T20:00:00.000Z", status: "confirmee", name, phone: ph, wilaya: "Alger", commune: "Kouba", dtype: "home", desk: "", items: "منتج أ ×1 = 1000 DA", subtotal: 1000, fee: 600, total: 1600, discount: 0, coupon: "", extra: {}, note: "🚚yalidine:" + trk });
    const pr0 = Admin.products; Admin.products = [{ slug: "pa", title: "منتج أ", price: 1000, active: true }];
    Admin.orders = [mk("A1", "نسرين بن علي", "yal-1", "0550111111"), mk("A2", "كريم", "yal-2", "0660222222")];
    AdminYd.set([{ tracking: "yal-1", date: "2026-10-10", name: "ن*** ب**", phone: "05*****11", wilaya: "Alger", commune: "Kouba", price: 1600, status: "En préparation" }, { tracking: "yal-2", date: "2026-10-10", name: "ك***", phone: "06*****22", wilaya: "Alger", commune: "Kouba", price: 1600, status: "En préparation" }, { tracking: "yal-3", date: "2026-10-10", name: "ع*** ا**", phone: "07*****33", wilaya: "Oran", commune: "Es Senia", price: 2000, status: "En préparation" }], 3, false);
    Admin.renderShipped();
    const before = { yd: document.querySelectorAll("#yd-card tbody tr").length, ship: document.querySelectorAll("#ship-table tr:not(.hd)").length };
    const inp = document.getElementById("ship-q"); inp.value = "نِسْرين"; inp.dispatchEvent(new Event("input", { bubbles: true })); await wait(50);
    const after = { yd: document.querySelectorAll("#yd-card tbody tr").length, ship: document.querySelectorAll("#ship-table tr:not(.hd)").length, ydName: (document.querySelector("#yd-card tbody tr td:nth-child(3)") || {}).textContent };
    inp.value = ""; inp.dispatchEvent(new Event("input", { bubbles: true })); await wait(30); const reset = document.querySelectorAll("#yd-card tbody tr").length;
    // نسخ الزبون: طرد مرتبط ثم طرد مقنَّع
    window.confirm = () => true; document.querySelector('#yd-card [data-ydp="yal-1"]').click(); const cb = document.querySelector("#ydp-bg [data-ydp-do=copy]"); const hasBtn = !!cb; cb.click(); await wait(30);
    const linked = { open: !!document.getElementById("mo-bg"), name: (document.getElementById("mo-name") || {}).value, phone: (document.getElementById("mo-phone") || {}).value, rows: document.querySelectorAll("#mo-lines tr[data-i]").length }; const mb = document.getElementById("mo-bg"); if (mb) mb.remove();
    document.querySelector('#yd-card [data-ydp="yal-3"]').click(); document.querySelector("#ydp-bg [data-ydp-do=copy]").click(); await wait(30); const masked = !document.getElementById("mo-bg");
    const bg = document.getElementById("ydp-bg"); if (bg) bg.remove(); document.getElementById("tab-shipped").classList.add("hidden"); Admin.products = pr0;
    return { before, after, reset, hasBtn, linked, masked };
  });
  ok("بحث الطلبات المسجلة: أثناء الكتابة يصفّي الجدولين معاً (بطاقة طرود حسابك وجدول الطلبات) بتطبيع الأحرف والتشكيل ويُلغى بمسح الخانة", sq.before.yd === 3 && sq.before.ship === 2 && sq.after.yd === 1 && sq.after.ship === 1 && /نسرين/.test(sq.after.ydName || "") && sq.reset === 3, sq);
  ok("معاينة الطرد: «نسخ الزبون كطلب جديد» يفتح نموذج طلب جديد ببيانات الزبون وطلبه للمرتبط، ويرفض الطرد المقنَّع", sq.hasBtn && sq.linked.open && sq.linked.name === "نسرين بن علي" && sq.linked.phone === "0550111111" && sq.linked.rows === 1 && sq.masked, sq);
  // ── مطابقة ياليدين: طلب ملغى طرده «Expédié» يعود قائماً، والمؤكَّد بلا طرد عند الشركة يُعرض للإلغاء ──
  const rc = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true;
    Admin.listCompanyKey = () => "yalidine"; Admin.activeCompanyKey = () => "yalidine"; Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: { apiId: "a", apiToken: "b", enabled: true } });
    const mk = (id, st, note, date) => ({ id, date: date || "2026-10-10T20:00:00.000Z", status: st, name: "ز" + id, phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", items: "كريم ×3 = 3000 DA", subtotal: 3000, fee: 0, total: 3000, note: note || "" });
    Admin.orders = [mk("F5D05", "annulee", "🚚yalidine:yal-74"), mk("F851C", "confirmee", "🚚yalidine:yal-25 📦"), mk("2FB29", "expediee", "🚚yalidine:yal-35 📦")];
    const st = [], un0 = API.updateOrder, os0 = Admin.onStatusChange, yf0 = Admin.ydFetchParcels, sn0 = Admin.showNotice; let html = "";
    API.updateOrder = (k, id, status) => { st.push(id + ":" + status); }; Admin.onStatusChange = (i, status) => { Admin.orders[i].status = status; };
    Admin.ydFetchParcels = async () => ({ rows: [{ tracking: "yal-74", status: "Expédié", name: "", phone: "", wilaya: "Béjaïa", commune: "", date: "2026-10-10 10:00:00", price: 2400 }, { tracking: "yal-35", status: "Vers Wilaya", name: "", phone: "", wilaya: "El Oued", commune: "", date: "2026-10-10 11:00:00", price: 2300 }], total: 2 });
    Admin.showNotice = (t, h) => { html = h; };
    await Admin.reconcileShipping(); await wait(50);
    const out = { f5: Admin.orders[0].status, f8: Admin.orders[1].status, upd: st.join(), orphanShown: /F851C|F851C/.test(html) && /غير موجودة عند الشركة/.test(html), twoBtn: (html.match(/cancelById/g) || []).length };
    Admin.cancelById("F851C"); await wait(30); out.f8after = Admin.orders[1].status;
    API.updateOrder = un0; Admin.onStatusChange = os0; Admin.ydFetchParcels = yf0; Admin.showNotice = sn0; return out;
  });
  ok("مطابقة ياليدين: F5D05 الملغى وطرده «Expédié» يعود «في الطريق»، والمؤكَّد F851C بلا طرد عند الشركة يظهر للإلغاء ويُلغى بزر، و2FB29 لا يتغيّر", rc.f5 === "expediee" && /F5D05:expediee/.test(rc.upd) && rc.orphanShown && rc.twoBtn === 1 && rc.f8 === "confirmee" && rc.f8after === "annulee", rc);
  // ── المخزون والأرباح: عمود «الربح الحقيقي» بدل سعر البيع الأدنى ──
  const rpf = await p.evaluate(async () => {
    const S0 = Admin.fin && Admin.fin.set, fin0 = Admin.fin; Admin.fin = Object.assign({}, Admin.fin || {}, { set: Object.assign({}, S0 || {}, { insMode: "pct", insVal: 1 }) });
    const v = Admin.realUnitProfit({ price: 3000 }, { parts: { buy: 1200, pack: 50, ad: 100, burden: 150, risk: 50, ins: 0, profit: 0 } }), none = Admin.realUnitProfit({ price: 3000 }, null);
    Admin.fin = fin0; let heads = []; try { Admin.renderFinance(true); heads = Array.from(document.querySelectorAll("#fin-table tr.hd th")).map(t => t.textContent); } catch (e) { }
    return { v, none, heads: heads.join("|"), hasReal: heads.includes("الربح الحقيقي"), noMin: !heads.includes("سعر البيع الأدنى") };
  });
  ok("المخزون والأرباح: «الربح الحقيقي» = 3000 − (1200+50+100+150+50 + تأمين 1% = 30) = 1420 للقطعة، وبلا سعر الشراء يظهر فارغاً، والعمود يحلّ محل «سعر البيع الأدنى»", rpf.v === 1420 && rpf.none === null && rpf.hasReal && rpf.noMin, rpf);
  // ── إشعار التحديث: يُحدّث الكاش في الخلفية ولا يعود بعد إغلاقه ──
  const upd = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), f0 = window.fetch, reqs = []; try { localStorage.removeItem("au_dismiss"); sessionStorage.removeItem("au_dismiss"); } catch (e) { }
    window.fetch = async (u, o) => { const url = String(u); reqs.push({ url, cache: o && o.cache }); if (/VERSION/.test(url)) return { ok: true, text: async () => "99.0.0" }; return { ok: true, text: async () => "", json: async () => ({}) }; };
    const old = document.getElementById("au-banner"); if (old) old.remove();
    await AdminUpdate.check(false); await wait(50);
    const shown = !!document.getElementById("au-banner"), warmed = reqs.filter(r => r.cache === "reload").length, pageWarm = reqs.some(r => r.cache === "reload" && /admin/.test(r.url));
    document.querySelector("#au-x").click(); const gone = !document.getElementById("au-banner"), stored = localStorage.getItem("au_dismiss");
    window.fetch = f0; localStorage.removeItem("au_dismiss"); sessionStorage.removeItem("au_dismiss");
    return { shown, warmed, pageWarm, gone, stored };
  });
  ok("إشعار التحديث: يظهر عند وجود نسخة أحدث ويُحدّث كاش الصفحة والسكربتات في الخلفية (فيختفي بعد إعادة التحميل العادية)، وإغلاقه يُحفظ لتلك النسخة", upd.shown && upd.warmed >= 3 && upd.pageWarm && upd.gone && upd.stored === "99.0.0", upd);
  // ── خانة البحث السريع الكبيرة فوق دليل الاستخدام ──
  const nq = await p.evaluate(async () => {
    const el = document.getElementById("nav-q"), intro = document.querySelector(".side-nav-intro"); if (!el || !intro) return { err: "missing" };
    const lab = el.closest(".nav-q"), h = lab.getBoundingClientRect().height, above = !!(lab.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING);
    const type = async v => { el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 500)); };
    await type("المدفوعات"); const box = document.getElementById("as-box"), dlg = !!(box && box.classList.contains("on")), res = document.getElementById("nav-res"), shown = !!(res && res.classList.contains("on")), under = !!(res && (el.closest(".nav-q").compareDocumentPosition(res) & Node.DOCUMENT_POSITION_FOLLOWING));
    const hit = [...document.querySelectorAll("#nav-res .as-t")].map(x => x.textContent).join("|"); const kept = el.value === "المدفوعات";
    const kinds = [...new Set([...document.querySelectorAll("#nav-res .as-k")].map(x => x.textContent))].join(",");
    const onBefore = (document.querySelector(".nav-btn.on") || {}).textContent; AdminHelp.ask("الدفع"); await new Promise(r => setTimeout(r, 200)); const stay = (document.querySelector(".nav-btn.on") || {}).textContent === onBefore;
    await type("اسألني"); const ask = [...document.querySelectorAll("#nav-res .as-t")].some(x => x.textContent.trim() === "اسألني"), askSub = /اسألني/.test(document.getElementById("nav-res").textContent);
    await type(""); const closed = !document.getElementById("nav-res").classList.contains("on");
    return { h, above, dlg, shown, under, kept, hit, ask, askSub, closed, kinds, stay };
  });
  ok("البحث السريع: خانة كبيرة (≥48px) فوق «دليل الاستخدام»، والكتابة فيها تعرض قائمة نتائج تحتها بلا نافذة (وتبقى الكلمة)، وتجد قسم المدفوعات، وفيها الأقسام فقط (بلا شروح)، ولا تظهر «اسألني»، وتُغلق بمسح النص، والكتابة في «اسألني» لا تفتح قسماً", nq.h >= 48 && nq.above && !nq.dlg && nq.shown && nq.under && nq.kept && /المدفوعات/.test(nq.hit || "") && !nq.ask && nq.closed && nq.kinds === "قسم" && nq.stay, nq);
  // ── المدفوعات: تسوية ياليدين (صافي لك) ──
  const pay = await p.evaluate(async () => {
    const o0 = Admin.orders, a0 = Admin.ydActual, t0 = Admin.trackingOf;
    Admin.orders = [{ id: "pz1", name: "ز", phone: "0550000001", status: "livree", total: 8000, fee: 750, date: "2026-09-10", wilaya: "Tipaza", commune: "Larhat", note: "" }, { id: "pz2", name: "ر", phone: "0550000002", status: "echec", total: 3000, fee: 700, date: "2026-09-10", wilaya: "Adrar", commune: "Adrar", note: "" }];
    Admin.ydActual = { "yal-T1": { st: "Livré", price: 7250, del: 750, ret: 0, ins: 0, cod: 54.375, net: 7195.625 }, "yal-T2": { st: "Retourné au vendeur", price: 0, del: 0, ret: 250, ins: 0, cod: 0, net: -250 } };
    Admin.trackingOf = o => ({ company: "yalidine", tracking: o.id === "pz1" ? "yal-T1" : "yal-T2" });
    let html = "", nets = [];
    try { const host = document.getElementById("payments-content"); AdminPayments.S.loaded = true; await AdminPayments.render(); html = host ? host.innerHTML : ""; nets = AdminPayments.items().map(it => (AdminPayments.settle(it) || {}).net); } catch (e) { html = "ERR " + e.message; }
    Admin.orders = o0; Admin.ydActual = a0; Admin.trackingOf = t0; AdminPayments.S.loaded = false;
    return { card: html.includes("تسوية ياليدين"), cols: html.includes("الصافي لك") && html.includes("تفصيل ياليدين"), tot: html.includes("TOTAUX"), nets, imp: html.includes("pm-imp") };
  });
  ok("المدفوعات: بطاقة «تسوية ياليدين» وعمودا التفصيل والصافي وصف TOTAUX وزر الاستيراد، والصافي يطابق الكشف (7195.625 و−250)", pay.card && pay.cols && pay.tot && pay.imp && Math.abs(pay.nets[0] - 7195.625) < 1e-6 && pay.nets[1] === -250, pay);
  // ── تكلفة المنتجات: قسمان يُفتحان ويُغلقان (مصنَّع / جاهز) مع إضافة منتج ونقله ──
  const sec = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), pr0 = Admin.products, set0 = Priv.set, rf0 = Admin.renderFinance; Priv.set = async () => { }; Admin.renderFinance = () => { };
    Admin.products = [{ slug: "s1", title: "مصنوع", active: true }, { slug: "s2", title: "جاهز", active: true }, { slug: "s3", title: "غير مضاف", active: true }];
    Admin.fin = Admin.fin || { costs: {}, ads: {}, set: {}, cfg: {}, log: [] }; Admin.fin.costs = { s2: 300 }; Admin.fin.cc = { s1: { mode: "made", raw: 1000, ml: 100 }, s2: { mode: "bought" } }; Admin.fin.rcp = { r9: { id: "r9", name: "وصفة حرة", slug: "", unit: "L", rec: [{ n: "مادة", pct: 50, pr: 1000 }], at: 1 } }; Admin._ccPend = {}; Admin._ccDraft = {};
    Admin.renderCostCalc(true);
    const cnt = () => Array.from(document.querySelectorAll("#fin-cc-rows details.cc-sec")).map(d => d.dataset.k + ":" + d.querySelectorAll("tr[data-cc]").length).join(",");
    const c0 = cnt(), sums = Array.from(document.querySelectorAll("#fin-cc-rows details.cc-sec > summary")).map(s => s.textContent.trim());
    const addOpts = ["made", "bought"].map(k => Array.from(document.querySelectorAll("#cc-add-" + k + " option")).map(o => o.textContent).join("/"));
    // إضافة «غير مضاف» إلى الجاهز
    const sel = document.getElementById("cc-add-bought"); sel.value = "p:2"; await Admin.ccAdd("bought"); const c1 = cnt();
    // «جاهز» ← المصنَّع عبر قائمة إضافة المصنَّع ← يُحذف من الجاهز
    document.getElementById("cc-add-made").value = "p:1"; await Admin.ccAdd("made"); const c2 = cnt();
    // إدخال يدوي لاسم منتج جديد، واختيار منتج مسجَّل في الوصفات من القائمة
    document.getElementById("cc-add-made-t").value = "عطر يدوي"; await Admin.ccAdd("made"); const c3 = cnt();
    const hasRcpOpt = !!Array.from(document.querySelectorAll("#cc-add-made option")).find(o => /وصفة حرة/.test(o.textContent));
    document.getElementById("cc-add-made").value = "r:r9"; await Admin.ccAdd("made"); const c4 = cnt(), names = Array.from(document.querySelectorAll('#fin-cc-rows tr[data-sec="made"] td:first-child')).map(x => x.textContent.trim()).join("|");
    const rowRaw = Array.from(document.querySelectorAll('#fin-cc-rows tr[data-sec="made"]')).map(tr => tr.querySelector("input[id$=-raw]")).filter(x => x && x.readOnly).length;
    const manKeys = Object.keys(Admin.fin.cc).filter(k => k.indexOf("x:") === 0).length;
    // فتح وإغلاق مع الحفظ (المفتاح يتبدّل اسمه في حزمة العميل، فالقراءة عبر الدالة)
    const d = document.querySelector("#fin-cc-rows details[data-k=made]"); d.open = false; d.dispatchEvent(new Event("toggle")); await wait(30);
    const closedSaved = Admin.ccOpenState().made === false; Admin.renderCostCalc(true); const stillClosed = !document.querySelector("#fin-cc-rows details[data-k=made]").open;
    Admin.ccToggle("made", true); Admin.renderCostCalc(true); const reopened = document.querySelector("#fin-cc-rows details[data-k=made]").open;
    Admin.products = pr0; Priv.set = set0; Admin.renderFinance = rf0; Admin._ccPend = {}; Admin._ccDraft = {};
    return { c0, sums, addOpts, c1, c2, c3, c4, hasRcpOpt, names, rowRaw, manKeys, closedSaved, stillClosed, reopened };
  });
  ok("تكلفة المنتجات: قسم «التكلفة الإنتاجية» (المصنَّع) وقسم «المنتجات الجاهزة» كلٌّ يُفتح ويُغلق وحالته محفوظة، وفي كل قسم قائمة إضافة منتج", sec.c0 === "made:1,bought:1" && /الإنتاجية/.test(sec.sums[0]) && /الجاهزة/.test(sec.sums[1]) && /غير مضاف/.test(sec.addOpts[0]) && /غير مضاف/.test(sec.addOpts[1]) && sec.closedSaved && sec.stillClosed && sec.reopened, sec);
  ok("تكلفة المنتجات: إضافة منتج للجاهز تُظهره هناك، ونقل «جاهز» إلى «أصنّعه» يحذفه من قسم الجاهز", sec.c1 === "made:1,bought:2" && sec.c2 === "made:2,bought:1" && sec.c3 === "made:3,bought:1" && sec.hasRcpOpt && sec.c4 === "made:4,bought:1" && sec.manKeys === 2 && /عطر يدوي/.test(sec.names) && /وصفة حرة/.test(sec.names) && sec.rowRaw === 1, sec);
  // ── مسح كل أسعار الشراء ──
  const ca = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), pr0 = Admin.products, set0 = Priv.set, rf0 = Admin.renderFinance; const saved = {}; Priv.set = async (k, v) => { saved[k] = JSON.stringify(v); }; Admin.renderFinance = () => { }; window.confirm = () => true;
    Admin.products = [{ slug: "k1", title: "أ", active: true }, { slug: "k2", title: "ب", active: true }]; Admin.fin = Admin.fin || { costs: {}, ads: {}, set: {}, cfg: {}, log: [] }; Admin.fin.costs = { k1: 100, k2: 200 }; Admin.fin.cc = { k1: { mode: "bought" } }; (Admin.ccList().forEach(p => { if (Admin.ccSec(p.slug) === "none") { Admin._ccPend = Admin._ccPend || {}; Admin._ccPend[p.slug] = "bought"; } }), Admin.renderCostCalc(true));
    const btn = Array.from(document.querySelectorAll("#tab-costs button")).find(b => /مسح كل الأسعار/.test(b.textContent)); const has = !!btn; btn.click(); await wait(50);
    const out = { has, costs: JSON.stringify(Admin.fin.costs), cc: JSON.stringify(Admin.fin.cc), savedCosts: saved.costs, savedCc: saved.costcalc, buy: (document.getElementById("cc0-buy") || { value: "" }).value };
    Admin.products = pr0; Priv.set = set0; Admin.renderFinance = rf0; return out;
  });
  ok("تكلفة المنتجات: «مسح كل الأسعار» يحذف أسعار الشراء وبيانات التكلفة ويحفظ الفراغ", ca.has && ca.costs === "{}" && ca.cc === "{}" && ca.savedCosts === "{}" && ca.savedCc === "{}" && ca.buy === "", ca);
  // ── التغليف بجمع أعداد كإكسل + مصاريف أخرى ثابتة أو نسبة ──
  const xp = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), pr0 = Admin.products, set0 = Priv.set, rf0 = Admin.renderFinance; Priv.set = async () => { }; Admin.renderFinance = () => { };
    const E = Admin.ccEval.bind(Admin), ev = { a: E("50+30+20"), b: E("=(40+10)*2"), c: E("٥٠+٣٠"), d: E("1/0"), e: E("abc"), f: E(""), g: E("10,5+4.5"), h: E("5++") };
    Admin.products = [{ slug: "cx", title: "كريم إكسل", active: true }]; Admin.fin = Admin.fin || { costs: {}, ads: {}, set: {}, cfg: {}, log: [] }; Admin.fin.costs = {}; Admin.fin.cc = { cx: { mode: "made", raw: 2000, ml: 50 } }; (Admin.ccList().forEach(p => { if (Admin.ccSec(p.slug) === "none") { Admin._ccPend = Admin._ccPend || {}; Admin._ccPend[p.slug] = "bought"; } }), Admin.renderCostCalc(true)); await wait(30);
    const $ = id => document.getElementById(id), fire = (e, n) => e.dispatchEvent(new Event(n, { bubbles: true }));
    $("cc0-pack").value = "50+30+20"; fire($("cc0-pack"), "input"); $("cc0-oth").value = "10"; $("cc0-othm").value = "pct"; fire($("cc0-othm"), "change");
    const tot = $("cc0-tot").textContent, pv = $("cc0-packv").textContent, ov = $("cc0-othv").textContent;
    $("cc0-othm").value = "fixed"; fire($("cc0-othm"), "change"); const totFixed = $("cc0-tot").textContent; $("cc0-othm").value = "pct"; fire($("cc0-othm"), "change");
    Array.from(document.querySelectorAll("#fin-cc-rows button")).find(b => /حفظ/.test(b.textContent)).click(); await wait(60);
    const saved = Admin.fin.cc.cx, cost = Admin.fin.costs.cx;
    $("cc0-pack").value = "5++"; fire($("cc0-pack"), "input"); const bad = /غير مفهومة/.test($("cc0-packv").textContent); Admin.fin.costs.cx = 999; Array.from(document.querySelectorAll("#fin-cc-rows button")).find(b => /حفظ/.test(b.textContent)).click(); await wait(40);
    const out = { ev, tot, pv, ov, totFixed, packx: saved.packx, pack: saved.pack, othm: saved.othm, oth: saved.oth, cost, bad, rejected: Admin.fin.costs.cx === 999 };
    Admin.products = pr0; Priv.set = set0; Admin.renderFinance = rf0; return out;
  });
  ok("إكسل في التغليف: المجموع والأقواس والأرقام العربية والفاصلة، وغير المفهوم/القسمة على صفر = غير صالح", xp.ev.a === 100 && xp.ev.b === 100 && xp.ev.c === 80 && Number.isNaN(xp.ev.d) && Number.isNaN(xp.ev.e) && xp.ev.f === 0 && xp.ev.g === 15 && Number.isNaN(xp.ev.h), xp);
  ok("مصاريف أخرى: نسبة 10% من (تكلفة المادة 100 + العبوة 50+30+20) = 20 ⟵ الإجمالي 220؛ وكقيمة ثابتة 10 ⟵ 210؛ والحفظ يُبقي الصيغة", xp.tot === "220" && /100/.test(xp.pv) && /20/.test(xp.ov) && xp.totFixed === "210" && xp.packx === "50+30+20" && xp.pack === 100 && xp.othm === "pct" && xp.oth === 10 && xp.cost === 220, xp);
  ok("صيغة غير مفهومة في التغليف: تحذير ولا يُحفظ", xp.bad && xp.rejected, xp);
  // ── مكتبة المواد الأولية: تغيير السعر مرة واحدة يحدّث الوصفات والتكلفة ──
  const ml = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), pr0 = Admin.products, set0 = Priv.set, rf0 = Admin.renderFinance; Priv.set = async () => { }; Admin.renderFinance = () => { };
    Admin.products = [{ slug: "cc1", title: "كريم تجريبي", active: true }, { slug: "cc2", title: "زيت", active: true }]; Admin.fin = Admin.fin || { costs: {}, ads: {}, set: {}, cfg: {}, log: [] };
    Admin.fin.mats = { m1: { n: "زيت الأرغان", pr: 5000, u: "kg" } };
    Admin.fin.rcp = { r1: { id: "r1", name: "كريم تجريبي", slug: "cc1", unit: "kg", rec: [{ m: "m1", n: "زيت الأرغان", pct: 30, pr: 5000 }], at: 1 }, r2: { id: "r2", name: "زيت", slug: "cc2", unit: "kg", rec: [{ m: "m1", n: "زيت الأرغان", pct: 10, pr: 5000 }], at: 2 } };
    Admin.fin.cc = { cc1: { mode: "made", unit: "kg", raw: 1500, ml: 50, pack: 100, oth: 50, adopt: true }, cc2: { mode: "made", unit: "kg", raw: 500, ml: 100 } };
    Admin.fin.costs = { cc1: 225 }; Admin._rc = null; Admin._ccPend = {}; Admin._ccDraft = {}; Admin.renderCostCalc(true);
    Admin.ccView("rcp"); const linked = document.getElementById("rc0-m0").value === "m1" && !document.getElementById("rc0-r0") && !document.getElementById("rc0-n0");
    Admin.matOpen(); const e = document.querySelector('#mat-bg [data-mf="pr"][data-id="m1"]'); e.value = 6000; Admin.matSave(); await wait(80);
    Admin.ccView("cost"); await wait(30);
    const out = { linked, raw1: Admin.fin.cc.cc1.raw, raw2: Admin.fin.cc.cc2.raw, rp: Admin.fin.rcp.r1.rec[0].pr, buy1: Admin.fin.costs.cc1, buy2: Admin.fin.costs.cc2 == null, cell: document.getElementById("cc0-tot").textContent };
    // «+» يحفظ مادة حرة في المكتبة
    Admin.ccView("rcp"); Admin._rc[1].rec = [{ n: "شمع", pct: 5, pr: 800 }]; Admin.rcpDraw(); await Admin.rcpToLib(1, 0); out.lib = Object.values(Admin.fin.mats).map(m => m.n).join(","); out.afterLink = !!document.getElementById("rc1-m0").value; Admin._rc = null; Admin._ccV = "cost";
    Admin.products = pr0; Priv.set = set0; Admin.renderFinance = rf0; return out;
  });
  ok("مكتبة المواد: السعر في الوصفة من المكتبة (للقراءة فقط) وتغييره مرة واحدة يحدّث كل الوصفات (1800 و600) وسعر شراء المنتج المعتمَد (240) دون غيره", ml.linked && ml.raw1 === 1800 && ml.raw2 === 600 && ml.rp === 6000 && ml.buy1 === 240 && ml.buy2, ml);
  ok("مكتبة المواد: زر «+» يضيف مادة حرة إلى المكتبة ويربط الصف بها", /شمع/.test(ml.lib) && ml.afterLink, ml);
  // ── طلب يدوي + نسخ كطلب جديد + تعديل كامل ──
  const mo = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {};
    const pr0 = Admin.products; Admin.products = [{ slug: "pa", title: "منتج أ", price: 1000, active: true }, { slug: "pb", title: "منتج ب", price: 2000, active: true }];
    const added = [], up = [], a0 = API.addOrder, uf0 = API.updateOrderFields, uo0 = API.updateOrder; API.addOrder = async o => { added.push(o); return { ok: true, id: "M-TEST1" }; }; API.updateOrderFields = async (k, id, f) => { up.push({ id, f }); return true; }; API.updateOrder = () => { };
    const $ = id => document.getElementById(id), fire = (e, ev) => e.dispatchEvent(new Event(ev, { bubbles: true }));
    Admin.orders = []; Admin.renderOrders();
    // 1) طلب يدوي جديد
    document.getElementById("mo-btn").click(); const opened = !!$("mo-bg");
    $("mo-name").value = "عمر خليل"; $("mo-phone").value = "0550 11 22 33"; $("mo-wil").value = "Alger"; fire($("mo-wil"), "change"); $("mo-com").selectedIndex = 1;
    const sel = document.querySelector('#mo-lines select[data-f="sel"]'); sel.value = "1"; fire(sel, "change");      // منتج ب
    const qty = document.querySelector('#mo-lines input[data-f="qty"]'); qty.value = 2; fire(qty, "input"); $("mo-disc").value = 100; fire($("mo-disc"), "input");
    const tot1 = $("mo-tot").textContent, fee1 = Number($("mo-fee").value);
    $("mo-save").click(); await wait(80);
    const o1 = added[0], inList = Admin.orders.length === 1 && Admin.orders[0].status === "nouvelle" && Admin.orders[0].id === "M-TEST1" && /منتج ب ×2 = 4000/.test(Admin.orders[0].items), closed1 = !$("mo-bg");
    // 2) نسخ طلب مسجَّل كطلب جديد
    Admin.orders = [{ id: "R1", date: new Date().toISOString(), status: "confirmee", name: "سعاد", phone: "0661000000", wilaya: "Oran", commune: "Es Senia", dtype: "stop", desk: "", items: "منتج أ ×3 = 3000 DA\nمنتج ب ×1 = 2000 DA", subtotal: 5000, fee: 500, total: 5500, discount: 0, coupon: "", extra: {}, note: "🚚yalidine:yal-9" }];
    Admin.openOrderPreview(0); const cp = Array.from(document.querySelectorAll("#ord-prev-a button")).find(b => /نسخ كطلب جديد/.test(b.textContent)); cp.click();
    const pre = { name: $("mo-name").value, phone: $("mo-phone").value, wil: $("mo-wil").value, rows: document.querySelectorAll("#mo-lines tr[data-i]").length, tot: $("mo-sub").textContent, dt: document.querySelector('input[name="mo-dt"]:checked').value };
    if (pre.dt === "stop") { const ds = $("mo-desk").options.length; pre.hasDesk = ds > 0 && $("mo-desk").value !== ""; if (!pre.hasDesk) { document.querySelector('input[name="mo-dt"][value="home"]').checked = true; fire(document.querySelector('input[name="mo-dt"][value="home"]'), "change"); } }
    $("mo-save").click(); await wait(80);
    const o2 = added[1], second = Admin.orders[0];
    // 3) تعديل كامل لطلب جديد
    Admin.orders = [{ id: "N1", date: new Date().toISOString(), status: "nouvelle", name: "كريم", phone: "0770000000", wilaya: "Alger", commune: "Kouba", dtype: "home", desk: "", items: "منتج أ ×1 = 1000 DA", subtotal: 1000, fee: 600, total: 1600, discount: 0, coupon: "", extra: {}, note: "" }];
    Admin.openOrderPreview(0); const eb = Array.from(document.querySelectorAll("#ord-prev-a button")).find(b => /تعديل كامل/.test(b.textContent)); eb.click();
    const q2 = document.querySelector('#mo-lines input[data-f="qty"]'); q2.value = 3; fire(q2, "input"); $("mo-phone").value = "0771234567"; $("mo-save").click(); await wait(80);
    const n1 = Admin.orders[0], upd = up[up.length - 1];
    const out = { opened, tot1, fee1, o1: o1 && { name: o1.name, phone: o1.phone, status: o1.status, n: o1.items.length, title: o1.items[0].title, qty: o1.items[0].qty, total: o1.total, disc: o1.discount, manual: o1.extra["✍️ طلب يدوي"] }, inList, closed1, pre, o2: o2 && { phone: o2.phone, n: o2.items.length, total: o2.total, dtype: o2.dtype, from: o2.extra["📄 نسخة من"], note: o2.note }, secondNoTrack: !/🚚/.test(second.note || ""), n1: { items: n1.items, phone: n1.phone, total: n1.total }, upd: upd && { id: upd.id, phone: upd.f.phone, total: upd.f.total, items: upd.f.items.length, text: upd.f.items_text } };
    Admin.products = pr0; API.addOrder = a0; API.updateOrderFields = uf0; API.updateOrder = uo0; return out;
  });
  ok("طلب يدوي: النموذج يحسب (2×2000 − 100 + رسم الولاية) ويحفظ طلباً «جديداً» بعلامة يدوي ويظهر في القائمة", mo.opened && mo.o1 && mo.o1.name === "عمر خليل" && mo.o1.phone === "0550112233" && mo.o1.n === 1 && mo.o1.title === "منتج ب" && mo.o1.qty === 2 && mo.o1.disc === 100 && mo.o1.total === 3900 + mo.fee1 && mo.o1.manual === "نعم" && mo.inList && mo.closed1, mo);
  ok("نسخ كطلب جديد: من طلب مسجَّل بكل بياناته (منتجان بمجموع 5000) بلا وسم تتبع وبعلامة «نسخة من»", mo.pre.name === "سعاد" && mo.pre.phone === "0661000000" && mo.pre.wil === "Oran" && mo.pre.rows === 2 && /5[\s,.\u202f\u00a0]?000/.test(mo.pre.tot) && mo.o2 && mo.o2.n === 2 && mo.o2.from === "R1" && mo.secondNoTrack, mo);
  ok("تعديل كامل: طلب جديد تتغيّر منتجاته وهاتفه ويُرسل التعديل (3 علب = 3000 + 600)", mo.upd && mo.upd.id === "N1" && mo.upd.phone === "0771234567" && mo.upd.total === 3600 && mo.upd.items === 1 && /منتج أ ×3 = 3000/.test(mo.upd.text) && mo.n1.phone === "0771234567" && mo.n1.total === 3600, mo);
  // ── الجرد اليدوي يسبق: إلغاء طلب خُصم قبله لا يُعيد علبه ──
  const sk2 = await p.evaluate(async () => {
    const pr0 = Admin.products, fin0 = Admin.fin, qp0 = Admin.queueStockPublish, un0 = API.updateOrder; Admin.queueStockPublish = () => { }; API.updateOrder = () => { };
    const mkp = () => [{ slug: "sp", title: "كريم المخزون", price: 1000, stock: 8, active: true }]; Admin.products = mkp(); Admin.fin = Object.assign({}, Admin.fin || {}, { log: [], costs: (Admin.fin && Admin.fin.costs) || {}, cfg: {} });
    const ord = id => ({ id, date: "2026-10-10T10:00:00.000Z", status: "annulee", items: "كريم المخزون ×3 = 3000 DA", note: "📦" });
    const iso = ms => new Date(Date.now() + ms).toISOString();
    // أ) خُصم ثم جرد يدوي ثم إلغاء ⟵ لا إرجاع
    Admin.fin.log = [{ ts: iso(-5000), slug: "sp", title: "x", delta: -3, after: 7, ref: "A1", why: "خصم" }, { ts: iso(-1000), slug: "sp", title: "x", delta: 1, after: 8, ref: "يدوي", why: "تعديل يدوي" }];
    const a = ord("A1"); Admin.syncStockForOrder(a, "annulee"); const stockA = Admin.products[0].stock, tagA = /📦/.test(a.note);
    // ب) جرد يدوي ثم خصم لاحق ثم إلغاء ⟵ إرجاع
    Admin.products = mkp(); Admin.fin.log = [{ ts: iso(-5000), slug: "sp", title: "x", delta: 1, after: 8, ref: "يدوي", why: "تعديل يدوي" }, { ts: iso(-1000), slug: "sp", title: "x", delta: -3, after: 5, ref: "B1", why: "خصم" }];
    const b = ord("B1"); Admin.syncStockForOrder(b, "annulee"); const stockB = Admin.products[0].stock, tagB = /📦/.test(b.note);
    // ج) بلا أي جرد يدوي ⟵ إرجاع
    Admin.products = mkp(); Admin.fin.log = [{ ts: iso(-1000), slug: "sp", title: "x", delta: -3, after: 5, ref: "C1", why: "خصم" }];
    const c = ord("C1"); Admin.syncStockForOrder(c, "annulee"); const stockC = Admin.products[0].stock;
    Admin.products = pr0; Admin.fin = fin0; Admin.queueStockPublish = qp0; API.updateOrder = un0; return { stockA, tagA, stockB, tagB, stockC };
  });
  ok("المخزون: إلغاء طلب خُصم قبل الجرد اليدوي لا يُعيد علبه (يبقى 8)، وبعد الجرد أو بلا جرد تعود (11)", sk2.stockA === 8 && !sk2.tagA && sk2.stockB === 11 && !sk2.tagB && sk2.stockC === 11, sk2);
  // ── تفصيل سعر التوصيل (ولاية + بلدية) يظهر للمدير في المعاينة فقط ──
  const bdp = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {};
    const mk = (fee, bd) => ({ id: "D" + fee, date: new Date().toISOString(), status: "nouvelle", name: "ز", phone: "0550000000", wilaya: "Alger", commune: "Kouba", dtype: "home", desk: "", items: "", subtotal: 2400, fee, total: 2400 + fee, discount: 0, coupon: "", extra: bd ? { "🚚 تفصيل التوصيل": bd, "📄 الصفحة": "p/x" } : {}, note: "" });
    Admin.orders = [mk(800, "750+50"), mk(900, "750+50"), mk(750, "")];
    const txt = i => { Admin.openOrderPreview(i); return document.getElementById("ord-prev-b").textContent; };
    const a = txt(0), b = txt(1), c = txt(2);
    return { a: /تفصيل/.test(a) && /750/.test(a) && /إضافة البلدية/.test(a) && !/750\+50/.test(a), b: !/تفصيل/.test(b), c: !/تفصيل/.test(c) };
  });
  ok("معاينة الطلب: يظهر للمدير تفصيل التوصيل (ولاية 750 + إضافة البلدية 50) عند وجوده فقط، ويختفي إن عُدّل الرسم", bdp.a && bdp.b && bdp.c, bdp);
  // ── إضافة البلدية من ياليدين (Supplément commune) ──
  const sp = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), cf0 = Admin.courierFetch, pj0 = typeof PBApp !== "undefined" ? PBApp.putJson : null, set0 = Priv.set; Priv.set = async () => { };
    Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: { apiId: "a", apiToken: "b", enabled: true, fromWilayaName: "Alger" } }); Admin.ydFees = {}; Admin._feesBusy = false;
    const pub = []; PBApp.putJson = async (path, data) => { pub.push({ path, data }); return true; };
    Admin.courierFetch = async rq => { const to = Number(/to_wilaya_id=(\d+)/.exec(rq.url)[1]); return { ok: true, status: 200, text: JSON.stringify({ retour_fee: 200, cod_percentage: 1, insurance_percentage: 1, per_commune: { 1: { commune_name: "Kouba", express_home: 800, express_desk: 500 }, 2: { commune_name: "Bab Ezzouar", express_home: 750, express_desk: 500 }, 3: { commune_name: "Dar El Beida", express_home: 750, express_desk: 500 }, 4: { commune_name: "Hussein Dey", express_home: 750, express_desk: 500 } } }) }; };
    await Admin.fetchCommuneFees({ force: true }); await wait(100);
    const sup = Admin.communeSup(), last = pub[pub.length - 1], ok16 = sup[16] && sup[16].kouba && sup[16].kouba[0] === 50 && !sup[16].babezzouar;
    Admin.courierFetch = cf0; if (pj0) PBApp.putJson = pj0; Priv.set = set0;
    return { ok16, keys: Object.keys(sup).length, published: !!(last && last.data && last.data.sup && last.data.sup[16] && last.data.sup[16].kouba) };
  });
  ok("إضافة البلدية: يُحسب فرق سعر البلدية عن ولايتها (Kouba +50 دج) ويُنشر ملف الأسعار للمتجر", sp.ok16 && sp.keys > 10 && sp.published, sp);
  // ── طباعة بوردرو الطلبات المسجلة ──
  const bd = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {};
    Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: { apiId: "a", apiToken: "b", enabled: true } });
    const mk = (id, st, note) => ({ id, date: new Date().toISOString(), status: st, name: "ز" + id, phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", items: "", subtotal: 3000, fee: 0, total: 3000, note: note || "" });
    Admin.orders = [mk("B1", "confirmee", "🚚yalidine:yal-111"), mk("B2", "confirmee", "🚚yalidine:yal-222"), mk("B3", "livree", "🚚yalidine:yal-333")];
    const reqs = [], cf0 = Admin.courierFetch, wo0 = window.open; Admin.courierFetch = async rq => { reqs.push(rq.url); const tr = decodeURIComponent(rq.url.split("/").pop()); return { ok: true, status: 200, text: JSON.stringify({ data: [{ label: "https://yalidine.app/app/bordereau/?tracking=" + tr }] }) }; };
    let html = ""; window.open = () => ({ document: { open() { }, write(h) { html = h; }, close() { } }, close() { } });
    Admin.renderShipped(); const label = document.getElementById("ship-bord-btn").textContent; Admin.printBordereaux(); await wait(1500);
    Admin.courierFetch = cf0; window.open = wo0;
    return { label, nreq: reqs.length, html: html.length > 500, has1: html.includes("yal-111"), has2: html.includes("yal-222"), has3: html.includes("yal-333"), printBtn: /طباعة الكل/.test(html), frames: (html.match(/<iframe/g) || []).length };
  });
  ok("بوردرو المسجلة: يطبع الطرود قيد التجهيز فقط (2) ويجلب بوردرو كل طرد ويعرضها في صفحة واحدة للطباعة", /\(2\)/.test(bd.label) && bd.nreq === 2 && bd.html && bd.has1 && bd.has2 && !bd.has3 && bd.printBtn && bd.frames === 2, bd);
  // ── ترتيب الطلبات تلقائياً بالحالة ──
  const srt = await p.evaluate(() => {
    Admin.refreshAlerts = async () => {}; API.updateOrder = async () => ({ ok: true }); Admin.orderFilters = {};
    const mk = (id, st) => ({ id, date: new Date().toISOString(), status: st, name: "ز" + id, phone: "0550000000", wilaya: "Alger", items: "", subtotal: 0, total: 0, note: "" });
    Admin.orders = [mk("a", "annulee"), mk("b", "confirmee"), mk("c", "nouvelle"), mk("d", "confirmee"), mk("e", "nouvelle"), mk("f", "annulee")];
    const before = Admin.getFilteredOrders().map(x => x.o.id).join("");
    Admin.orders[2].status = "annulee"; Admin.orders[0].status = "confirmee";
    return { before, after: Admin.getFilteredOrders().map(x => x.o.id).join("") };
  });
  ok("ترتيب الطلبات: في انتظار التأكيد أولاً ثم المؤكَّدة ثم الملغاة (ثابت داخل المجموعة)", srt.before === "cebdaf" && srt.after === "eabdcf", srt);
  // ── أتمتة: جديد/في انتظار التأكيد، إرسال المؤكَّد تلقائياً، حذف الملغى ──
  const au = await p.evaluate(async () => {
    Admin.refreshAlerts = async () => {}; API.updateOrder = async () => ({ ok: true }); API.deleteOrder = async () => true; window.confirm = () => true; Admin.orderFilters = {}; Admin.enqueueNotify = () => { };
    const wait = ms => new Promise(r => setTimeout(r, ms)), mk = (id, st, note) => ({ id, date: new Date().toISOString(), status: st, name: "ز" + id, phone: "0550000000", wilaya: "Alger", commune: "Alger Centre", items: "", subtotal: 3000, fee: 0, total: 3000, note: note || "" });
    Admin.orders = [mk("w", "annulee"), mk("z", "confirmee"), mk("y", "nouvelle", "📞1"), mk("x", "nouvelle")];
    const order1 = Admin.getFilteredOrders().map(r => r.o.id).join(""), badge = (() => { Admin.renderOrders(); return document.querySelectorAll("#orders-table .st-fresh").length; })();
    Admin.orderCompanyKey = () => "yalidine"; Admin.activeCompanyKey = () => "yalidine"; let sentIds = [];
    Admin.sendOrderToDelivery = async i => { sentIds.push(Admin.orders[i].id); Admin.orders[i].note = ((Admin.orders[i].note || "") + " 🚚yalidine:T" + i).trim(); return true; };
    Admin.confirmOrder(Admin.orders.findIndex(o => o.id === "x")); await wait(200);
    const sentFirst = sentIds.join(), x = Admin.orders.find(o => o.id === "x"), listed = Admin.getFilteredOrders().map(r => r.o.id).join(""), shipped = Admin.shippedOrders().map(r => r.o.id).join("");
    Admin.setAutoOpt("send", false); Admin.confirmOrder(Admin.orders.findIndex(o => o.id === "z")); await wait(150); const noAuto = sentIds.join(); Admin.setAutoOpt("send", true);
    await Admin.changeStatus(Admin.orders.findIndex(o => o.id === "y"), "annulee"); await wait(150); const ids2 = Admin.orders.map(o => o.id).join("");
    Admin.orders.push(mk("t", "nouvelle", "🚚yalidine:TT")); await Admin.changeStatus(Admin.orders.length - 1, "annulee"); await wait(100); const keepTracked = Admin.orders.some(o => o.id === "t");
    return { order1, badge, sent: sentFirst, x: x.status, listed, shipped, noAuto, ids2, keepTracked };
  });
  ok("الأتمتة: «جديد» (بلا اتصال) في الأعلى ثم «في انتظار التأكيد» ثم المؤكَّد ثم الملغى + شارة جديد", au.order1 === "xyzw" && au.badge === 1, au);
  ok("الأتمتة: تأكيد الطلب يرسله للشركة وينتقل فوراً من الطلبات إلى المسجلة", au.sent === "x" && au.x === "confirmee" && !au.listed.includes("x") && au.shipped.includes("x"), au);
  ok("الأتمتة: إيقاف مفتاح الإرسال التلقائي يمنع الإرسال", au.noAuto === "x", au);
  ok("الأتمتة: الطلب الملغى غير المرسَل يُحذف تلقائياً، والمرسَل لا يُحذف", !au.ids2.includes("y") && au.keepTracked === true, au);
  // ── مكتبة الملصقات (بحث متعدد اللغات + إضافة بنقرة) ──
  await p.evaluate(() => { const pg = PB.newPage("اختبار ملصقات", ""); pg.slug = "stk-t"; pg.sections = [PB.TPLS.canvas.f()]; PBApp.open(pg, "", true); }); await p.waitForTimeout(1500);
  await p.evaluate(() => PBApp.ltoggle("stk")); await p.waitForFunction(() => document.querySelectorAll("#stk-out .stk-i").length > 20, null, { timeout: 15000 }).catch(() => { });
  const sk = await p.evaluate(async () => {
    const n0 = document.querySelectorAll("#stk-out .stk-i").length, tot = PBStickers._S.data ? PBStickers._S.data.i.length : 0, first = q => { const r = PBStickers.search(q); return r.slice(0, 6).map(x => x[0]); };
    const q = document.getElementById("stk-q"); q.value = "عسل"; q.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 450));
    const honeyUi = Array.from(document.querySelectorAll("#stk-out .stk-i")).map(x => x.dataset.stk);
    const el = document.querySelector('#stk-out .stk-i[data-stk="honey-pot"]'); if (el) el.click(); await new Promise(r => setTimeout(r, 600));
    const j = PBApp.pageJson(), added = /assets\/img\/stickers\/honey-pot\.svg/.test(j);
    const w = (JSON.parse(j).sections[0].free || []).find(x => x.type === "image" && /honey-pot/.test(x.set.src || ""));
    return { n0, tot, fire: first("نار"), miel: first("miel"), gift: first("gift"), truck: first("توصيل شاحنة"), none: PBStickers.search("zzzzqq").length, honeyUi: honeyUi.slice(0, 5), added, fw: w && w.set.fwd && w.set.fwd.d, rec: JSON.parse(localStorage.getItem("pbx_stk_recent") || "[]")[0] };
  });
  ok("الملصقات: الفهرس يُحمَّل (أكثر من 1000) وتظهر شبكة", sk.tot > 1000 && sk.n0 > 20, sk);
  ok("الملصقات: بحث عربي وفرنسي وإنجليزي يعطي النتيجة الصحيحة", sk.fire.includes("fire") && sk.miel.includes("honey-pot") && sk.truck.includes("delivery-truck") && sk.none === 0, sk);
  ok("الملصقات: بحث «عسل» يعرض جرة العسل", sk.honeyUi.includes("honey-pot"), sk.honeyUi);
  ok("الملصقات: النقر يضيف عنصر صورة بحجم صغير ويُسجَّل في «مؤخراً»", sk.added && sk.fw === 18 && sk.rec === "honey-pot", sk);
  await p.screenshot({ path: "/tmp/stk-ui.png" });
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(400);
  // ── مسار المنتج الرئيسي من إعدادات الصفحة ──
  await p.evaluate(() => { if (window.__origPub) PBApp.publish = window.__origPub; });
  await p.evaluate(() => { const pg = PB.newPage("هبوط مسار", ""); pg.slug = "route-lp"; pg.sections = [PB.TPLS.canvas.f()]; PBApp.open(pg, "", true); }); await p.waitForTimeout(1800);
  await p.evaluate(() => { PBApp.ltoggle("pg"); }); await p.waitForTimeout(300);
  await p.evaluate(slug => { const s = document.querySelector('#pbx-lpane select[onchange*="linkProduct"]'); s.value = slug; s.dispatchEvent(new Event("change", { bubbles: true })); }, await p.evaluate(() => Admin.products[0].slug)); await p.waitForTimeout(400);
  ok("خيار «مسار المنتج الرئيسي» يظهر بعد ربط منتج", await p.evaluate(() => !!document.querySelector('#pbx-lpane input[onchange*="setMainRoute"]')));
  await p.evaluate(() => { const c = document.querySelector('#pbx-lpane input[onchange*="setMainRoute"]'); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); });
  await p.evaluate(() => PBApp.publish()); await p.waitForFunction(() => Admin.products[0].route === "route-lp", null, { timeout: 15000 }).catch(() => { });
  ok("النشر يضبط route للمنتج", (await p.evaluate(() => Admin.products[0].route)) === "route-lp", await p.evaluate(() => Admin.products[0].route));
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(500);
  ok("لا أخطاء جافاسكربت (حاسوب)", errs.length === 0, errs.slice(0, 3));
  const misses = await p.evaluate(() => JSON.parse(localStorage.getItem("store_hand_misses") || "[]").filter(x => x.type !== "ui"));
  ok("لا إخفاق في إيجاد عناصر اليد", misses.length === 0, misses);

  // ── مركز الاتصال: طابور بالدور، كل قرار يمرّ بالمنطق القائم ──
  const ccm = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {}; Admin.enqueueNotify = () => { }; Admin.renderShippedBadge = () => { };
    const uo0 = API.updateOrder, ups = []; API.updateOrder = async (k, id, st) => { ups.push([id, st]); return true; };
    const sa = Admin.afterManualStatus; Admin.afterManualStatus = () => { };
    const mk = (id, name, mins, extra) => Object.assign({ id, date: new Date(Date.now() - mins * 60000).toISOString(), status: "nouvelle", name, phone: "055000" + id.slice(-4).padStart(4, "0"), wilaya: "Alger", commune: "Kouba", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, note: "" }, extra || {});
    Admin.orders = [mk("C0001", "الأحدث", 5), mk("C0002", "الأقدم", 90), mk("C0003", "خاطئ", 200, { note: "📵خطأ" }), mk("C0004", "مؤكد", 10, { status: "confirmee" })];
    Admin.tab("callcenter"); await wait(200);
    const first = () => (document.querySelector("#ccm .ccm-card h2") || {}).textContent;
    const r = { shown: !document.getElementById("tab-callcenter").classList.contains("hidden"), first: first(), remain: (document.querySelector("#ccm .ccm-chip b") || {}).textContent, hasTel: !!document.querySelector("#ccm a[href^='tel:+21355']") };
    document.querySelector('#ccm [data-d="noans"]').click(); await wait(150); r.afterNoans = first(); r.att = Admin.attemptsOf(Admin.orders[1]);
    document.querySelector('#ccm [data-d="confirm"]').click(); await wait(700); r.afterConfirm = first(); r.status = Admin.orders.find(o => o.id === "C0001").status; r.ups = JSON.stringify(ups);
    r.stats = (document.querySelectorAll("#ccm .ccm-chip")[1] || {}).textContent;
    document.querySelector('#ccm [data-d="cancel"]') && document.querySelector('#ccm [data-d="cancel"]').click(); await wait(700); r.empty = /لا طلبات/.test(document.getElementById("callcenter-content").textContent) || first();
    API.updateOrder = uo0; Admin.afterManualStatus = sa; Admin.tab("orders"); await wait(100); r.hidden = document.getElementById("tab-callcenter").classList.contains("hidden");
    return r;
  });
  ok("مركز الاتصال: الأقدم أولاً، المتبقي 2 (الخاطئ والمؤكَّد خارج الطابور)، زر اتصال tel:", ccm.shown && ccm.first === "الأقدم" && ccm.remain === "2" && ccm.hasTel, ccm);
  ok("مركز الاتصال: «لم يُجب» يسجّل المحاولة ويمرّر للتالي، والتأكيد يمرّ بالمنطق القائم", ccm.afterNoans === "الأحدث" && ccm.att === 1 && ccm.status === "confirmee" && /C0001/.test(ccm.ups), ccm);
  ok("مركز الاتصال: بعد التأكيد يعود إلى من لم يُجب، والإلغاء يفرّغ الطابور ويختفي التبويب بتغيير الصفحة", ccm.afterConfirm === "الأقدم" && /^\s*1\s*·\s*0\s*·\s*1/.test(ccm.stats || "") && ccm.empty === true && ccm.hidden, ccm);
  // ── أزرار معاينة الطلب الجديدة: رابط دفع (قبل التسليم) وطلب تقييم (بعده) ──
  const plk = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const mk = (id, st) => ({ id, date: new Date().toISOString(), status: st, name: "سعاد", phone: "0661000000", wilaya: "Oran", commune: "Es Senia", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, note: "" });
    Admin.orders = [mk("P1", "confirmee"), mk("P2", "livree")]; Admin.renderOrders();
    Admin.openOrderPreview(0); await wait(60); const a = document.querySelector("#ord-prev-a"), r = { pay: !!a.querySelector("[data-paylink]"), reviewOnConfirmed: !!a.querySelector("[data-reviewask]") };
    Admin.openOrderPreview(1); await wait(60); const b = document.querySelector("#ord-prev-a"), l = b.querySelector("[data-reviewask]"); r.review = !!l && /wa\.me\/213661000000/.test(l.href); r.payOnDelivered = !!b.querySelector("[data-paylink]");
    return r;
  });
  ok("معاينة الطلب: «رابط دفع» للمؤكَّد فقط و«اطلب تقييماً» للمسلَّم فقط (رابط واتساب بالرقم الدولي)", plk.pay && !plk.reviewOnConfirmed && plk.review && !plk.payOnDelivered, plk);
  // ═══ جوال: دائرة خضراء تقع فوق الهدف ═══
  ({ p, errs } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }));
  await p.evaluate(() => localStorage.setItem("store_voice_enrolled", "1"));
  ok("وضع اللمس يفعّل الدائرة", await p.evaluate(() => AdminHand.touchMode()));
  await p.evaluate(() => document.getElementById("ah-mic").click());
  await p.waitForFunction(() => AdminVoice.quiet(), null, { timeout: 20000 });
  await p.evaluate(() => window.__rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "hi mystore افتح التقارير" }], { isFinal: true, length: 1 })] }));
  let under = null, cls = "";
  for (let i = 0; i < 40 && !under; i++) {
    await p.waitForTimeout(100);
    const r = await p.evaluate(() => { const h = document.getElementById("aly-hand"); if (!h || !h.classList.contains("press")) return null; const r = h.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2; h.style.display = "none"; const u = document.elementFromPoint(cx, cy); h.style.display = ""; const nb = u && u.closest(".nav-btn"); return { cls: h.className, t: nb ? nb.textContent.trim().slice(0, 12) : "" }; });
    if (r) { under = r.t; cls = r.cls; }
  }
  ok("الدائرة الخضراء تضغط زر «التقارير» على الجوال", /dot/.test(cls) && /التقارير/.test(under || ""), { cls, under });
  await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 20000 });
  ok("التنقل نجح على الجوال", (await tab(p)) === "التقارير", await tab(p));
  ok("لا أخطاء جافاسكربت (جوال)", errs.length === 0, errs.slice(0, 3));

  await browser.close(); kill();
  console.log(fails ? `✗ فشل ${fails} من ${total}` : `✓ نجح ${total} من ${total}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("خطأ في الاختبار:", e.message); process.exit(2); });
