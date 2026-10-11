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
