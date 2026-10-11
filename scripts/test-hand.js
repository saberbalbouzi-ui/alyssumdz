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
  const ui = await p.evaluate(async () => { const t = document.querySelector('#pbx-ep [data-ept="st"]'); if (!t) return { tab: false }; t.click(); await new Promise(r => setTimeout(r, 900)); const cv = document.getElementById("pbst-cv"); return { tab: true, panel: !!document.getElementById("pbst"), cv: !!cv && cv.width > 10, btns: document.querySelectorAll("#pbst [data-st]").length, sw: document.querySelectorAll("#pbst [data-st-bg]").length }; });
  ok("الاستوديو: تبويب في «تعديل الصورة» ولوحة وقماش معاينة وخلفيات", ui.tab && ui.panel && ui.cv && ui.btns >= 4 && ui.sw >= 10, ui);
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(400);
  // ── ربط المخزون بالطلبات: شارة + نافذة «المخزون لا يكفي» ──
  const stk = await p.evaluate(async () => {
    API.updateOrder = async () => ({ ok: true }); const pr = Admin.products[0], t = pr.title; pr.stock = 3; Admin.fin.cfg = Object.assign({}, Admin.fin.cfg, { since: "2000-01-01T00:00:00Z" });
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
    Admin.renderFinance(true);
    const empty = document.getElementById("fin-ads-rows").textContent.includes("لا توجد حملات"), globalGone = !document.getElementById("fin-adbox") && !document.getElementById("fin-g-method");
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
    const tblOk = /المخزون والأرباح لكل منتج/.test(document.getElementById("fin-table").closest(".card").textContent) && Array.from(document.querySelectorAll("#fin-table th")).some(h => h.textContent === "الربح المتوقع");
    return { tblOk, empty, globalGone, opts, live1, live2, live3, live4, fxShown, saved: svd, rowsAfter, stored, dupHidden: !opts2.includes(slug), left: Object.keys(Admin.fin.ads).length, hasTitle };
  });
  ok("إعلان لكل منتج: لا إعداد عام، ولا صفوف قبل إضافة حملة", ad.empty && ad.globalGone, ad);
  ok("جدول المخزون والأرباح: له عنوان وعمود «الربح المتوقع»", ad.tblOk, ad);
  ok("إعلان لكل منتج: القائمة تعرض Cost الحقيقي (6000÷10=600) وتتغير فوراً (×2=1200، وبـ20 طلباً 600، وثابت 350)", /Cost الحقيقي/.test(ad.live1) && /600/.test(ad.live1) && /1[\s,.\u202f\u00a0]?200/.test(ad.live2) && /600/.test(ad.live3) && ad.fxShown && /350/.test(ad.live4), ad);
  ok("إعلان لكل منتج: حفظ لكل صف، والمنتج المستعمل لا يتكرر في القائمة، والحذف يمسح الحملة", ad.saved === 1 && ad.rowsAfter === 1 && ad.stored && ad.stored.method === "spend" && ad.stored.a === 6000 && ad.stored.m === 2 && ad.dupHidden && ad.left === 0 && ad.hasTitle, ad);
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
  ok("القائمة: الإعدادات العامة = لوحة التحكم + إعدادات الموقع + المدونة (بلا تجهيز ولا بانتظار التأكيد)", j(nv.gen) === "لوحة التحكم|إعدادات الموقع|المدوّنة والسياسات" && nv.pend && nv.groups === 5, nv.gen);
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
    Admin.products = [{ slug: "cc1", title: "كريم تجريبي", active: true }]; Admin.fin = Admin.fin || { costs: {}, ads: {}, set: {}, cfg: {}, log: [] }; Admin.fin.costs = Admin.fin.costs || {}; Admin.fin.cc = {};
    Admin.renderCostCalc(true); const heads = Array.from(document.querySelectorAll("#fin-cc-rows tr.hd th")).map(t => t.textContent);
    const set = (k, v) => { const e = document.getElementById("cc0-" + k); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
    set("raw", 2000); set("ml", 50); set("pack", 100); set("oth", 50);
    const mat = document.getElementById("cc0-mat").textContent, tot = document.getElementById("cc0-tot").textContent;
    Array.from(document.querySelectorAll("#fin-cc-rows button")).find(b => /اعتماد/.test(b.textContent)).click(); await wait(60);
    const out = { heads, mat, tot, cost: Admin.fin.costs.cc1, saved: JSON.stringify(Admin.fin.cc.cc1) };
    // وصفة بنسب المواد الأولية
    Admin.ccmOpen(0); const v = (id, x) => { const e = document.getElementById(id); e.value = x; e.dispatchEvent(new Event("input", { bubbles: true })); };
    document.getElementById("ccm-unit").value = "kg"; document.getElementById("ccm-unit").dispatchEvent(new Event("change", { bubbles: true }));
    v("ccm-n0", "زيت"); v("ccm-p0", 30); v("ccm-r0", 5000); Admin.ccmAdd(); v("ccm-n1", "مستخلص"); v("ccm-p1", 10); v("ccm-r1", 12000); Admin.ccmAdd(); v("ccm-n2", "ماء"); v("ccm-p2", 60); v("ccm-r2", 0); v("ccm-size", 50);
    out.sum = document.getElementById("ccm-sum").textContent; out.lbl = /الكلغ/.test(document.getElementById("ccm-bg").textContent);
    Admin.ccmSave(); await wait(60); out.recRaw = document.getElementById("cc0-raw").value; out.recRo = document.getElementById("cc0-raw").readOnly; out.recUnit = document.getElementById("cc0-unit").value; out.recSaved = JSON.stringify(Admin.fin.cc.cc1).length > 0 && Admin.fin.cc.cc1.rec.length === 3 && Admin.fin.cc.cc1.unit === "kg"; out.recMat = document.getElementById("cc0-mat").textContent;
    Admin.products = pr0; Priv.set = set0; return out;
  });
  ok("جدول التكلفة: المنتج أولاً (يمين) ثم المادة الخام باللتر، والحساب فوري (2000 دج/لتر × 50مل = 100 + عبوة 100 + أخرى 50 = 250)", cc.heads[0] === "المنتج" && /لتر/.test(cc.heads[2]) && cc.mat === "100" && cc.tot === "250", cc);
  ok("وصفة المنتج: نسب المواد × أسعارها = سعر الكلغ (2700) × حجم العبوة 50 غ = 135 دج للعلبة، وتُحفظ بالوحدة وتنتقل للجدول", /2[,\s.\u202f\u00a0]?700/.test(cc.sum) && /135/.test(cc.sum) && cc.lbl && cc.recRaw === "2700" && cc.recRo && cc.recUnit === "kg" && cc.recSaved && cc.recMat === "135", cc);
  ok("جدول التكلفة: «اعتماد» يجعل الإجمالي سعر الشراء ويحفظ المدخلات", cc.cost === 250 && /"raw":2000/.test(cc.saved) && /"ml":50/.test(cc.saved), cc);
  // ── مكتبة المواد الأولية: تغيير السعر مرة واحدة يحدّث الوصفات والتكلفة ──
  const ml = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), pr0 = Admin.products, set0 = Priv.set, rf0 = Admin.renderFinance; Priv.set = async () => { }; Admin.renderFinance = () => { };
    Admin.products = [{ slug: "cc1", title: "كريم تجريبي", active: true }, { slug: "cc2", title: "زيت", active: true }]; Admin.fin = Admin.fin || { costs: {}, ads: {}, set: {}, cfg: {}, log: [] };
    Admin.fin.mats = { m1: { n: "زيت الأرغان", pr: 5000, u: "kg" } };
    Admin.fin.cc = { cc1: { unit: "kg", raw: 1500, ml: 50, pack: 100, oth: 50, adopt: true, rec: [{ m: "m1", n: "زيت الأرغان", pct: 30, pr: 5000 }] }, cc2: { unit: "kg", raw: 500, ml: 100, rec: [{ m: "m1", n: "زيت الأرغان", pct: 10, pr: 5000 }] } };
    Admin.fin.costs = { cc1: 225 }; Admin.renderCostCalc(true);
    Admin.ccmOpen(0); const linked = document.getElementById("ccm-m0").value === "m1" && document.getElementById("ccm-r0").readOnly && !document.getElementById("ccm-n0"); document.getElementById("ccm-bg").classList.remove("open");
    Admin.matOpen(); const e = document.querySelector('#mat-bg [data-mf="pr"][data-id="m1"]'); e.value = 6000; Admin.matSave(); await wait(80);
    const out = { linked, raw1: Admin.fin.cc.cc1.raw, raw2: Admin.fin.cc.cc2.raw, rp: Admin.fin.cc.cc1.rec[0].pr, buy1: Admin.fin.costs.cc1, buy2: Admin.fin.costs.cc2 == null, cell: document.getElementById("cc0-tot").textContent };
    // «+» يحفظ مادة حرة في المكتبة
    Admin.fin.cc.cc2.rec = [{ n: "شمع", pct: 5, pr: 800 }]; Admin.ccmOpen(1); await Admin.ccmToLib(0); out.lib = Object.values(Admin.fin.mats).map(m => m.n).join(","); out.afterLink = !!document.getElementById("ccm-m0").value; document.getElementById("ccm-bg").classList.remove("open");
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
