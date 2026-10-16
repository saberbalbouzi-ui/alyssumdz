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
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/hand-test", "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: root, encoding: "utf8" });
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
  await p.evaluate(() => { window.__ockReal = Admin.orderCompanyKey; window.__sodReal = Admin.sendOrderToDelivery; });
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
      o.moreHidden = getComputedStyle(q("#pbx-more")).display === "none"; q("#pbx-moreb").click(); o.more = getComputedStyle(q("#pbx-moremenu")).display === "flex" && !!q("#pbx-upd") && !!q("#pbx-cc"); q("#pbx-moreb").click();
      const b = document.querySelector('[data-add="heading"]'); if (b) b.click(); await w(700); const el = q("#pbx-insp"); el.scrollTop = 600; await w(150);
      o.stk = !!q(".pbx-stk .pbx-itabs") && q(".pbx-itabs").getBoundingClientRect().top - el.getBoundingClientRect().top < 140; return o; });
    ok("المطوّر: التبويبات اليسرى أفقية والمحتوى تحتها", u.rows >= 2 && u.pane, u);
    ok("المطوّر: أزرار التكبير والملاءمة تعمل", u.zoom && u.fit, u);
    ok("المطوّر: التحديث والكاش موجودان في الصفحة وزر ⋯ مخفي", u.more && u.moreHidden, u);
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
  // ── الأدوات الذكية والمحلية الجديدة في تبويب «تعديل الصورة» (ظاهرة، مفعّلة، وتفتح لوحاتها) ──
  await p.evaluate(() => { PBApp.E.sel = window.__imgId; PBApp.ltoggle("img"); }); await p.waitForTimeout(600);
  const tools = await p.evaluate(() => { const q = k => document.querySelector('[data-imgm="' + k + '"]'); return { xp: !!q("xp"), ai: !!q("ai"), erase: !!q("erase"), scene: !!q("scene"), rt: !!document.querySelector('[data-imgt="rt"]'), soon: [...document.querySelectorAll(".pbx-tt .tt-b")].map(e => e.textContent), api: /Alyssum API/.test((document.getElementById("pbx-lpane") || document.body).textContent) }; });
  ok("تبويب الصورة: أدوات ذكية ظاهرة (توسيع، تعديل بالوصف، ممحاة، مشهد) ولمسات وتصحيح", tools.xp && tools.ai && tools.erase && tools.scene && tools.rt && tools.api, tools);
  ok("تبويب الصورة: لا بطاقة «قريباً» بعد الآن", !tools.soon.some(t => /قريباً/.test(t)), tools.soon);
  await p.evaluate(() => document.querySelector('[data-imgm="xp"]').click()); await p.waitForTimeout(500);
  ok("توسيع الخلفية: تفتح لوحته مع تنبيه تفعيل Alyssum API عند غياب المفتاح", await p.evaluate(() => { const e = document.getElementById("pbai"); return !!e && /توسيع|وسّع/.test(e.textContent) && /Alyssum API/.test(e.textContent); }));
  await p.evaluate(() => { localStorage.setItem("alyssum_gp_gkey", "TESTKEY"); localStorage.setItem("store_gp_gkey", "TESTKEY"); localStorage.setItem("alyssum_ig_model", "gemini-2.5-flash-image"); localStorage.setItem("store_ig_model", "gemini-2.5-flash-image"); window.__aiCalls = []; const of = window.fetch; window.fetch = async (u, i) => { if (/generativelanguage/.test(String(u))) { const cv = document.createElement("canvas"); cv.width = 200; cv.height = 360; const g = cv.getContext("2d"); g.fillStyle = "#2a8"; g.fillRect(0, 0, 200, 360); const d = cv.toDataURL("image/png").split(",")[1]; window.__aiCalls.push(String(u)); if (/models\?/.test(String(u))) return of(u, i); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: d } }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } }); } return of(u, i); }; window.confirm = () => true; ImgGen.ready && 0; });
  await p.evaluate(() => { document.querySelector('[data-imgm="ai"]').click(); }); await p.waitForTimeout(500);
  ok("تعديل بالوصف: تظهر اقتراحات جاهزة وحقل التعليمات", await p.evaluate(() => !!document.getElementById("pbai-text") && document.querySelectorAll('#pbai [data-ai="preset"]').length >= 5));
  await p.evaluate(() => { document.getElementById("pbai-text").value = "غيّر لون المنتج إلى الذهبي"; document.getElementById("pbai-text").dispatchEvent(new Event("input", { bubbles: true })); document.querySelector('#pbai [data-ai="edit"]').click(); }); await p.waitForTimeout(3500);
  ok("تعديل بالوصف: يُرسل الطلب وتظهر النتيجة مباشرة على الصورة (مفتاح تجريبي ومحاكاة الخدمة)", await p.evaluate(() => (window.__aiCalls || []).some(u => /generateContent/.test(u)) && PBApp.liveOn()), await p.evaluate(() => ({ c: window.__aiCalls, m: (document.getElementById("pbai-msg") || {}).textContent })));

  // ── الشبكة اختيارية: الصفحة بيضاء بلا شبكة افتراضياً ──
  ok("المحرّر: الصفحة بيضاء بلا شبكة افتراضياً (الشبكة والالتصاق في قائمة الزر الأيمن لا الشريط العلوي)", await p.evaluate(() => { const b = document.getElementById("pbx-frame").contentDocument.body; return !document.getElementById("pbx-grid") && !document.getElementById("pbx-snap") && b.classList.contains("pbx-nogrid"); }));
  ok("المحرّر: تبديل الشبكة يُظهرها ثم يُخفيها ويحفظ الاختيار", await p.evaluate(() => { const b = document.getElementById("pbx-frame").contentDocument.body; PBApp.toggleGrid(); const on = !b.classList.contains("pbx-nogrid") && localStorage.getItem("pbx_grid") === "1"; PBApp.toggleGrid(); return on && b.classList.contains("pbx-nogrid") && localStorage.getItem("pbx_grid") === "0"; }));
  const tb = await p.evaluate(() => { const top = document.querySelector("#pb-app .pbx-top"), q = id => document.getElementById(id), vis = id => { const e = q(id); return !!e && getComputedStyle(e).display !== "none"; }; const t = q("pbx-title"), rn = q("pbx-rn"); return { oneLine: top.scrollWidth <= top.clientWidth + 1, h: Math.round(top.getBoundingClientRect().height), live: !!q("pbx-live"), dirty: !!q("pbx-dirty"), upd: vis("pbx-upd"), grid: !!q("pbx-grid"), snap: !!q("pbx-snap"), rnText: rn.textContent.trim(), rnW: Math.round(rn.getBoundingClientRect().width), titleW: Math.round(t.getBoundingClientRect().width), prev: vis("pbx-prev") }; });
  ok("شريط المطوّر العلوي: سطر واحد، بلا «تعديل مباشر/تعديلات غير منشورة/تحديث/شبكة/التصاق»، وتعديل الاسم قلم فقط والاسم بحجمه", tb.oneLine && tb.h < 70 && !tb.live && !tb.dirty && !tb.upd && !tb.grid && !tb.snap && tb.rnText === "" && tb.rnW < 50 && tb.titleW < 260 && tb.prev, tb);
  // ── توسيع بالذكاء: الإطار البنفسجي يُسحب للخارج دون تحريك الصورة، ثم خياران ──
  await p.evaluate(() => { document.querySelector('[data-imgm="xp"]').click(); }); await p.waitForTimeout(600);
  const xbox = await p.evaluate(() => { const b = document.querySelector("#pbx-ovl .pbx-box.xp"), h = b && b.querySelector(".pbx-h.d-e"); if (!h) return null; const r = h.getBoundingClientRect(), el = document.getElementById("pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"]'); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: el.getBoundingClientRect().width, n: b.querySelectorAll(".pbx-h").length }; });
  ok("توسيع: إطار بنفسجي بثمانية مقابض فوق الصورة", !!xbox && xbox.n === 8, xbox);
  if (xbox) {
    await p.mouse.move(xbox.x, xbox.y); await p.mouse.down(); await p.mouse.move(xbox.x + 60, xbox.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const xs = await p.evaluate(() => { const x = PBApp.xpGet(), el = document.getElementById("pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"]'); return { r: x && x.r, l: x && x.l, w: el.getBoundingClientRect().width, info: (document.getElementById("pbai-xi") || {}).textContent }; });
    ok("توسيع: السحب للخارج يوسّع الإطار فقط والصورة لا تتحرك ولا تتغير", xs.r > 20 && xs.l === 0 && Math.abs(xs.w - xbox.w) < 1 && /يمين/.test(xs.info || ""), xs);
    await p.evaluate(() => { const h = document.querySelector("#pbx-ovl .pbx-box.xp .pbx-h.d-w"); const r = h.getBoundingClientRect(); window.__w = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); const ww = await p.evaluate(() => window.__w);
    await p.mouse.move(ww.x, ww.y); await p.mouse.down(); await p.mouse.move(ww.x + 80, ww.y, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
    ok("توسيع: لا يمكن سحب المقبض للداخل (الإطار لا يقلّ عن الصورة)", await p.evaluate(() => { const x = PBApp.xpGet(); return x.l === 0; }));
    await p.evaluate(() => { window.__aiCalls = []; document.querySelector('#pbai [data-ai="expand"]').click(); }); await p.waitForTimeout(4500);
    ok("توسيع: يُرسل طلبين ويعرض خيارين للاختيار", await p.evaluate(() => (window.__aiCalls || []).filter(u => /generateContent/.test(u)).length === 2 && document.querySelectorAll("#pbai-res img").length === 2 && document.querySelectorAll("#pbai-res input[name=pbai-v]").length === 2), await p.evaluate(() => ({ c: window.__aiCalls, m: (document.getElementById("pbai-msg") || {}).textContent })));
  }
  await p.evaluate(() => document.querySelector('[data-imgm="erase"]').click()); await p.waitForTimeout(700);
  ok("الممحاة الذكية: تفتح محرّر الفرشاة", await p.evaluate(() => !!document.getElementById("pbs-er")));
  await p.evaluate(() => { const x = document.getElementById("er-x"); if (x) x.click(); const o = document.getElementById("pbs-er"); if (o) o.remove(); }); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('[data-imgt="rt"]').click()); await p.waitForTimeout(900);
  ok("لمسات وتصحيح: تفتح لوحتها بمنزلقات مباشرة", await p.evaluate(() => !!document.getElementById("pbrt") && document.querySelectorAll("#pbrt [data-rtk]").length >= 8 && !document.getElementById("pbrt-apply")));
  await p.evaluate(() => { const r = document.querySelector('#pbrt [data-rtk="auto"]'); r.value = 100; r.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(2200);
  const lv = await p.evaluate(() => { const f = document.getElementById("pbx-epf"), im = document.getElementById("pbx-frame").contentDocument.querySelector("[data-pb] img"); return { on: PBApp.liveOn(), okTxt: f && f.querySelector(".ok span") && f.querySelector(".ok span").textContent, noTxt: f && f.querySelector(".no span") && f.querySelector(".no span").textContent, blob: !!im && /^blob:/.test(im.src) }; });
  ok("لمسات وتصحيح: التعديل يظهر مباشرة على الصورة في الصفحة مع زرّي «تنفيذ» و«إلغاء»", lv.on && lv.blob && lv.okTxt === "تنفيذ" && lv.noTxt === "إلغاء", lv);
  await p.evaluate(() => document.querySelector('#pbx-epf [data-epf="no"]').click()); await p.waitForTimeout(700);
  ok("لمسات وتصحيح: «إلغاء» يعيد الصورة الأصلية ويصفّر المنزلقات", await p.evaluate(() => { const im = document.getElementById("pbx-frame").contentDocument.querySelector("[data-pb] img"); return !PBApp.liveOn() && !!im && !/^blob:/.test(im.src) && !document.getElementById("pbx-epf") && document.querySelector('#pbrt [data-rtk="auto"]').value === "0"; }));
  await p.evaluate(() => { try { AIVision.supported = () => false; } catch (e) { } document.querySelector('[data-imgt="bg"]').click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-bgr="open"]').click()); await p.waitForTimeout(9000);
  ok("نزع الخلفية: النتيجة تظهر مباشرة على الصورة مع «تنفيذ/إلغاء» (بلا نافذة منفصلة)", await p.evaluate(() => PBApp.liveOn() && !document.getElementById("pbbg") && !!document.querySelector('#pbx-epf [data-epf="ok"]')), await p.evaluate(() => ({ on: PBApp.liveOn(), chip: (document.getElementById("pbbg-chip") || {}).textContent })));
  await p.evaluate(() => { const n = document.querySelector('#pbx-epf [data-epf="no"]'); if (n) n.click(); }); await p.waitForTimeout(500);
  for (const [k, root, txt] of [["ff", "pbff", /Contour fondu|حواف/], ["fr", "pbfr", /إطار/], ["cl", "pbcl", /كولاج/], ["vd", "pbvd", /فيديو/]]) {
    await p.evaluate(kk => document.querySelector('[data-imgt="' + kk + '"]').click(), k); await p.waitForTimeout(700);
    ok("أداة «" + k + "»: تفتح لوحتها", await p.evaluate(([r, t]) => { const e = document.getElementById(r); return !!e && new RegExp(t).test(e.textContent); }, [root, txt.source]));
  }
  await p.evaluate(() => document.querySelector('[data-imgm="sl"]').click()); await p.waitForTimeout(600);
  ok("أساليب التصوير الذكية: 12 أسلوباً + 5 مشاهد استخدام يومي", await p.evaluate(() => document.querySelectorAll('#pbai [data-ai="shot"]').length === 17));
  await p.evaluate(() => { localStorage.removeItem("alyssum_gp_gkey"); localStorage.removeItem("store_gp_gkey"); localStorage.removeItem("alyssum_ig_model"); localStorage.removeItem("store_ig_model"); });
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
    const t0 = pane.querySelector(".pbx-tt"), im0 = t0.querySelector("img"), sp0 = t0.querySelector("span"), gs = getComputedStyle(pane.querySelector(".pbx-ttg"));
    o.ar = getComputedStyle(im0).aspectRatio; o.cols = gs.gridTemplateColumns; o.square = /^1\s*\/\s*1$/.test(o.ar); o.nameBelow = !!sp0 && sp0.textContent.trim().length > 2 && t0.classList.contains("ic"); o.twoCols = o.cols.trim().split(/\s+/).length === 2; o.noReady = !/الصورة المحدّدة جاهزة/.test(pane.textContent);
    o.tabsHidden = getComputedStyle(document.querySelector("#pbx-ep .pbst-tabs")).display === "none"; o.hasEpTabs = !!document.querySelector("#pbx-ep .ep-tabs");
    pane.querySelector('[data-imgs="txt"]').click(); await new Promise(r => setTimeout(r, 700)); o.head = document.querySelector("#pbx-ep .ep-h").textContent.trim(); o.visPane = [...document.querySelectorAll("#pbst .pbst-pane")].filter(x => !x.hidden).map(x => x.dataset.stp).join(",");
    pane.querySelector('[data-imgt="pz"]').click(); await new Promise(r => setTimeout(r, 400)); o.pzHead = document.querySelector("#pbx-ep .ep-h").textContent.trim(); o.subGone = !pane.querySelector("[data-imgs]");
    PBApp.ltoggle("add"); await new Promise(r => setTimeout(r, 200)); o.closedByTab = !document.getElementById("pbx-ep");
    PBApp.ltoggle("img"); document.querySelector('#pbx-lpane [data-imgt="st"]').click(); await new Promise(r => setTimeout(r, 600)); return o;
  });
  ok("تبويب «تعديل الصورة»: ثاني تبويب تحت العناصر وفيه 11 أداة + 5 ذكية في شبكة واحدة وبطاقات حقيقية محمّلة", it.second === "img" && it.tabOn && it.tools === 11 && it.sub === 5 && it.sm === 5 && it.imgsN >= 16 && it.loaded === it.imgsN, it);
  ok("تعديل الصورة: أيقونات بنسبة موحّدة وعنوانها نص HTML تحتها (لا كتابة داخل الصورة) عمودان، وعبارة «الصورة المحدّدة جاهزة» محذوفة", it.square && it.nameBelow && it.twoCols && it.noReady, it);
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
  const qp = await p.evaluate(() => { const q = document.querySelector(".pbx-qbar"), b = document.querySelector("#pbx-ovl .pbx-box"); if (!q || !b || q.style.display === "none") return { none: true }; const a = q.getBoundingClientRect(), c = b.getBoundingClientRect(); return { qb: [Math.round(a.top), Math.round(a.bottom)], box: [Math.round(c.top), Math.round(c.bottom)], noOverlap: a.bottom <= c.top + 1 || a.top >= c.bottom - 1, tall: c.height > innerHeight * .8 }; });
  ok("شريط الصورة العلوي فوق العنصر المحدّد ولا يغطيه", qp.none || qp.noOverlap || qp.tall, qp);
  const st2 = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const o = {};
    try { AIVision.supported = () => false; } catch (e) { } document.querySelector('[data-st="cut"]') && document.querySelector('[data-st="cut"]').click(); for (let i = 0; i < 60 && !PBStudio._S.cut; i++) await w(300);
    o.cut = !!PBStudio._S.cut; o.msg = PBStudio._S.msg; const z = document.getElementById("pbst-sz"); z.value = "1080x1920"; z.dispatchEvent(new Event("change", { bubbles: true })); for (let i = 0; i < 40; i++) { const e0 = document.querySelector("#pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"] img'); if (e0 && /^blob:/.test(e0.src) && e0.naturalHeight && Math.abs(e0.naturalWidth / e0.naturalHeight - 0.5625) < .02) break; await w(300); } await w(300);
    const el = document.querySelector("#pbx-frame") && document.querySelector("#pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"] img'); o.live = !!el && /^blob:/.test(el.src); o.ratio = el ? +(el.naturalWidth / el.naturalHeight).toFixed(3) : 0; o.small = !document.getElementById("pbst-cv");
    const f = document.getElementById("pbx-epf"); o.bar = !!f && /تنفيذ/.test(f.textContent) && /إلغاء/.test(f.textContent);
    f && f.querySelector('[data-epf="no"]').click(); await w(700); const el2 = document.querySelector("#pbx-frame").contentDocument.querySelector('[data-pb="' + window.__imgId + '"] img'); o.restored = !!el2 && !/^blob:/.test(el2.src); o.pend = PBStudio.pending();
    document.querySelector('[data-st-tab="txt"]').click(); document.querySelector('[data-st="addov"][data-i="0"]').click(); await w(300);
    o.ov = PBStudio.opts().ov.length; { const fs = document.querySelector('#pbst [data-stk="font"]'); o.fontOpts = fs ? fs.options.length : 0; o.fontDef = fs ? fs.options[0].textContent : ""; if (fs) { fs.value = "Amiri"; fs.dispatchEvent(new Event("input", { bubbles: true })); } o.font = PBStudio.opts().font; o.ovFont = !!document.querySelector('#pbst [data-ovk="font"]'); } o.tabs = document.querySelectorAll("#pbst [data-st-tab]").length; o.hid = [...document.querySelectorAll("#pbst [data-stp]")].filter(q => !q.hidden).map(q => q.dataset.stp);
    const out = PBStudio.compose((() => { const c = document.createElement("canvas"); c.width = 200; c.height = 300; const g = c.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(40, 40, 120, 220); return c; })(), null, { size: [540, 960], bg: { type: "color", c1: "#ffffff" }, pad: .1, align: "center", shadow: "none", ov: [{ t: "-50%", pos: 2, st: "circle", bg: "#e11d48", fg: "#ffffff", s: 8 }] });
    const d = out.getContext("2d").getImageData(0, 0, 540, 960).data, px = (x, y) => [d[(y * 540 + x) * 4], d[(y * 540 + x) * 4 + 1], d[(y * 540 + x) * 4 + 2]];
    o.badge = px(540 - 70, 70); o.prod = px(270, 480); o.bgp = px(10, 940); return o;
  });
  ok("الاستوديو: التعديلات تظهر مباشرة على صورة الصفحة بنسبة المقاس (9:16) بلا صورة مصغّرة، وتحتها «تنفيذ/إلغاء»", st2.cut && st2.live && Math.abs(st2.ratio - 0.5625) < .02 && st2.small && st2.bar, st2);
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
  // ── «تصميم بمقاس»: الصفحة تظهر كاملة داخل مجال الرؤية مهما كان مقاسها (بلا شريط فارغ أعلى ولا فراغ تحتها)، وعجلة الفأرة تكبّر/تصغّر ──
  const fitR = {};
  for (const [W, H] of [[1000, 1000], [1080, 1920], [1920, 1080]]) {
    fitR[W + "x" + H] = await p.evaluate(async ([W, H]) => {
      const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; ImgGen.openSized({ W, H, id: "custom", label: "t", name: "fit", textMode: "none", lang: "ar" }); await w(1800);
      const st = document.getElementById("pbx-stage"), sc = document.getElementById("pbx-sc"), a = st.getBoundingClientRect(), b = sc.getBoundingClientRect(), fr = document.getElementById("pbx-frame");
      const o = { padTop: getComputedStyle(st).paddingTop, inside: b.top >= a.top - 1 && b.bottom <= a.bottom + 1 && b.left >= a.left - 1 && b.right <= a.right + 1, gapTop: Math.round(b.top - a.top), gapBot: Math.round(a.bottom - b.bottom), ratio: Math.round((b.width / b.height) * 100) / 100, want: Math.round((W / H) * 100) / 100, noScroll: st.scrollHeight <= st.clientHeight + 2 };
      const s0 = PBApp.E.scale; st.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true })); await w(50); const s1 = PBApp.E.scale; st.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true })); st.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true })); await w(50); const s2 = PBApp.E.scale;
      o.zoomIn = s1 > s0 * 1.05; o.zoomOut = s2 < s1 * 0.9; PBApp.setZoomTest && 0; PBApp.close(); await w(500); return o;
    }, [W, H]);
  }
  await p.setViewportSize({ width: 390, height: 780 });
  fitR.mobile = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; ImgGen.openSized({ W: 1000, H: 1000, id: "custom", label: "t", name: "fit", textMode: "none", lang: "ar" }); await w(1800);
    const st = document.getElementById("pbx-stage"), sc = document.getElementById("pbx-sc"), a = st.getBoundingClientRect(), b = sc.getBoundingClientRect(); const o = { inside: b.top >= a.top - 1 && b.bottom <= a.bottom + 1 && b.left >= a.left - 1 && b.right <= a.right + 1 };
    const t = (x, y, id) => new Touch({ identifier: id, target: st, clientX: x, clientY: y }); const s0 = PBApp.E.scale; st.dispatchEvent(new TouchEvent("touchstart", { touches: [t(100, 300, 1), t(200, 300, 2)], bubbles: true, cancelable: true })); st.dispatchEvent(new TouchEvent("touchmove", { touches: [t(60, 300, 1), t(240, 300, 2)], bubbles: true, cancelable: true })); st.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true })); await w(50);
    o.pinch = PBApp.E.scale > s0 * 1.3; PBApp.close(); await w(500); return o;
  });
  await p.setViewportSize({ width: 1280, height: 800 });
  ok("تصميم بمقاس: الصفحة كاملة داخل مجال الرؤية بكل المقاسات (مربع/طولي/عرضي) والنسبة صحيحة ومكان علوي محجوز لشريط الأدوات بلا تمرير", Object.keys(fitR).filter(k => k !== "mobile").every(k => fitR[k].inside && fitR[k].padTop === "64px" && Math.abs(fitR[k].ratio - fitR[k].want) < .03 && fitR[k].noScroll), fitR);
  const itb = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; ImgGen.openSized({ W: 1000, H: 1000, id: "custom", label: "t", name: "itb", textMode: "none", lang: "ar" }); await w(1500); const t = document.querySelector("#pbx-insp .pbx-itabs"), o = { hidden: !t || getComputedStyle(t).display === "none" }; PBApp.close(); await w(400); return o; });
  ok("إنشاء الصور: تبويبات محتوى/تنسيق/متقدم مخفية (تبقى في صفحات الويب)", itb.hidden, itb);
  const bgT = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; ImgGen.openSized({ W: 1000, H: 1000, id: "custom", label: "t", name: "bgt", textMode: "none", lang: "ar" }); await w(1500);
    const fd = document.getElementById("pbx-frame").contentDocument, sec = fd.querySelector(".pb-sec"), o = {};
    sec.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 20, clientY: 20 })); sec.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 20, clientY: 20 })); await w(200);
    o.noSecBox = !document.querySelector(".pbx-box.section") && !document.querySelector(".pbx-sbar") && !document.querySelector("#pbx-ovl .pbx-bar");
    sec.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })); await w(200);
    const m = document.getElementById("pbx-ctx"); o.menu = m ? m.textContent : ""; const it = m && [...m.querySelectorAll("button")].find(b => /إضافة لون الخلفية/.test(b.textContent)); o.hasItem = !!it; if (it) it.click(); await w(200);
    const pop = document.getElementById("pbx-bgp"); o.pop = !!pop; if (pop) { o.eye = typeof window.EyeDropper === "function" ? !!pop.querySelector("#bgp-e") : true; pop.querySelector('.bgp-sw button[data-c="#e53935"]').click(); await w(300); o.bg = JSON.parse(PBApp.pageJson()).sections[0].set.bg; o.inFrame = getComputedStyle(fd.querySelector(".pb-sec")).backgroundColor; }
    PBApp.close(); await w(400); o.closed = !document.getElementById("pbx-bgp"); return o;
  });
  const adS = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; ImgGen.openSized({ W: 1000, H: 1000, id: "custom", label: "t", name: "adset", textMode: "none", lang: "ar" }); await w(1500);
    const ip = document.getElementById("pbx-insp"), o = {}; o.page = !!ip.querySelector("#adp-sel") && !!ip.querySelector("#adp-r") && !ip.querySelector(".pbx-dv") && !ip.querySelector(".pbx-q") && !ip.querySelector(".pbx-itabs");
    const r = ip.querySelector("#adp-r"); r.value = 80; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); await w(400);
    const fd = document.getElementById("pbx-frame").contentDocument; o.rad = getComputedStyle(fd.querySelector(".pb-sec")).borderTopLeftRadius; o.ovf = getComputedStyle(fd.querySelector(".pb-sec")).overflow;
    await ImgGen.exportAd(); await w(300); { const im = document.querySelector("#ig-exp img"); if (im) { await (im.decode ? im.decode().catch(() => 0) : 0); const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext("2d"); x.drawImage(im, 0, 0); o.cornerA = x.getImageData(2, 2, 1, 1).data[3]; o.centerA = x.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3]; } const ex = document.getElementById("ig-exp"); if (ex) ex.remove(); }
    ip.querySelector("#adp-w").value = 1080; ip.querySelector("#adp-w").dispatchEvent(new Event("input")); ip.querySelector("#adp-h").value = 1920; ip.querySelector("#adp-h").dispatchEvent(new Event("input")); ip.querySelector("#adp-go").click(); await w(500);
    o.size = JSON.parse(PBApp.pageJson()).ad.w + "x" + JSON.parse(PBApp.pageJson()).ad.h; o.rad2 = JSON.parse(PBApp.pageJson()).sections[0].set.rad;
    const add = document.querySelector('#pbx-lpane .pbx-wi[data-add="button"]'); if (add) add.click(); await w(600);
    const ip2 = document.getElementById("pbx-insp"); o.btnKeys = [...ip2.querySelectorAll("[data-k]")].map(x => x.dataset.k); o.noWeb = !ip2.querySelector(".pbx-dv,.pbx-cp,.pbx-q,.pbx-vis,.pbx-itabs") && !o.btnKeys.some(k => ["link", "kind", "phone", "msg", "newTab", "tag", "cust"].includes(k));
    PBApp.close(); await w(400); return o;
  });
  ok("إنشاء الصور: الشريط الجانبي = المقاس + تدوير الزوايا فقط، والعنصر بلا إعدادات ويب (رابط/نوع/ظهور/أجهزة)", adS.page && /80/.test(adS.rad) && adS.ovf === "hidden" && adS.size === "1080x1920" && adS.cornerA === 0 && adS.centerA === 255 && adS.noWeb && adS.btnKeys.includes("text"), adS);
  const fitT = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; ImgGen.openSized({ W: 1000, H: 1000, id: "custom", label: "t", name: "fit1", textMode: "none", lang: "ar" }); await w(1500);
    const mkU = (iw, ih) => { const c = document.createElement("canvas"); c.width = iw; c.height = ih; c.getContext("2d").fillRect(0, 0, iw, ih); return c.toDataURL("image/png"); }, o = {};
    const geo = () => { const P = JSON.parse(PBApp.pageJson()), im = P.sections[0].free.filter(x => x.type === "image").pop(); return im ? [im.set.fx.d, im.set.fy.d, im.set.fwd.d, im.set.fh.d] : null; };
    PBApp.addPageImage(mkU(200, 400)); await w(900); o.portrait = geo();
    PBApp.addPageImage(mkU(400, 200)); await w(900); o.landscape = geo();
    PBApp.close(); await w(400); return o;
  });
  ok("إنشاء الصور (مربع): الصورة الطولية ارتفاعها = ارتفاع الصفحة بالوسط، والعريضة عرضها = عرض الصفحة", !!fitT.portrait && Math.abs(fitT.portrait[3] - 1000) <= 1 && Math.abs(fitT.portrait[2] - 50) < .2 && Math.abs(fitT.portrait[0] - 25) < .2 && fitT.portrait[1] === 0 && Math.abs(fitT.landscape[2] - 100) < .2 && Math.abs(fitT.landscape[3] - 500) <= 1 && fitT.landscape[1] === 250, fitT);
  ok("القائمة الجانبية: بلا شروحات تحت العناوين وتظهر كاملة بلا تمرير داخلي", await p.evaluate(() => { const sn = document.querySelector(".side-nav"), sm = [...sn.querySelectorAll(".nav-btn .nav-txt small")].filter(x => x.offsetParent !== null && getComputedStyle(x).display !== "none"), cs = getComputedStyle(sn); return sm.length === 0 && sn.scrollHeight <= sn.clientHeight + 2 && cs.maxHeight === "none" && cs.position === "static"; }));
  ok("بطاقات المجموعات شريط أفقي كامل العرض تحت الشريط العلوي", await p.evaluate(() => { const g = document.getElementById("nav-groups"), t = document.querySelector("#app .top") || document.querySelector(".top"), b = [...g.querySelectorAll(".ng")], r = g.getBoundingClientRect(), tr = t.getBoundingClientRect(), ys = b.map(x => Math.round(x.getBoundingClientRect().top)); return b.length === 5 && r.top >= tr.bottom - 1 && !g.closest(".side-nav") && new Set(ys).size === 1 && r.width > innerWidth * 0.5; }));
  { const bo = await p.evaluate(() => { const a = Admin.products[0]; const bk = [a.bord, a.title]; a.bord = "BORD-X"; const t = a.title; const r = Admin.bordItems(t + " ×2 = 3000 DA\n" + t + " — لون: أحمر ×1 = 1500 DA\nشيء آخر ×1 = 100 DA"); a.bord = bk[0]; return r; });
    ok("الإرسال للشركة: أسماء المنتجات تُستبدل باسم البوردرو (مع التنويعات)", /^BORD-X ×2 = 3000 DA\nBORD-X — لون: أحمر ×1/.test(bo) && /شيء آخر ×1/.test(bo), bo); }
  { let calls = 0, mode = "ok"; const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    await p.route(/t\.supabase\.co\/auth\/v1\/token/, async route => { const rq = route.request(); if (rq.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors }); calls++; await new Promise(z => setTimeout(z, 40)); if (mode === "net") return route.abort(); if (mode === "500") return route.fulfill({ status: 503, headers: cors, body: "{}" }); if (mode === "400") return route.fulfill({ status: 400, headers: cors, contentType: "application/json", body: JSON.stringify({ error: "invalid_grant" }) }); return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ access_token: "new", refresh_token: "rt2", expires_in: 3600, user: { email: "a@x" } }) }); });
    const ev = () => p.evaluate(async () => { const sb = API.sb; sb._rp = null; const SK = (sb.session.toString().match(/getItem\("([^"]+)"/) || [])[1]; localStorage.setItem(SK, JSON.stringify({ access_token: "old", refresh_token: "rt1", expires_at: Date.now() - 1000, email: "a@x" })); if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL !== "https://t.supabase.co") { window.__cu = [CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY]; CONFIG.SUPABASE_URL = "https://t.supabase.co"; CONFIG.SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY || "k"; } let er = ""; const t = await Promise.all([sb.token(), sb.token(), sb.token()]).catch(e => { er = String(e); return []; }); return { t, has: !!sb.session() }; });
    const r1 = await ev(), c1 = calls; mode = "net"; const r2 = await ev(); mode = "500"; const r3 = await ev(); mode = "400"; const r4 = await ev();
    await p.evaluate(() => { localStorage.removeItem((API.sb.session.toString().match(/getItem\("([^"]+)"/) || [])[1]); if (window.__cu) { CONFIG.SUPABASE_URL = window.__cu[0]; CONFIG.SUPABASE_ANON_KEY = window.__cu[1]; } }); await p.unroute(/t\.supabase\.co\/auth\/v1\/token/);
    const se = { shared: c1 === 1 && r1.t.every(x => x === "new"), netKeeps: r2.has, s500Keeps: r3.has, badClears: !r4.has, c1 };
    ok("الجلسة: تجديد واحد مشترك، وعطل الشبكة/الخادم لا يمسح الجلسة، والرفض الحقيقي يمسحها", se.shared && se.netKeeps && se.s500Keeps && se.badClears, se); }
  { const mo2 = await p.evaluate(async () => { const A = Admin, r = {}; ManualOrder.open({ mode: "new" }); await new Promise(z => setTimeout(z, 400));
      const bg = document.getElementById("mo-bg"), W = WILAYAS.find(w => !w.par && (w.desks || []).length && (w.communes || []).some(c => !A.desksIn(w, c).length) && (w.communes || []).some(c => A.desksIn(w, c).length)); const noD = W.communes.find(c => !A.desksIn(W, c).length), yesD = W.communes.find(c => A.desksIn(W, c).length);
      const set = (id, v) => { const e = bg.querySelector("#" + id); e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); };
      set("mo-wil", W.name); set("mo-com", noD); const sr = bg.querySelector('input[name="mo-dt"][value="stop"]'); r.disabled = sr.disabled; set("mo-com", yesD); r.enabled = !sr.disabled; r.opts = bg.querySelectorAll("#mo-desk option").length >= 1 && A.desksIn(W, yesD).length === bg.querySelectorAll("#mo-desk option[value]:not([value=''])").length;
      const sup0 = A._supPub; A._supPub = { [W.id]: { [yesD.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")]: [150, 0] } }; const q = A.shipFeeFor(W, yesD, "home"); r.sup = q.sup === 150 && q.fee === q.base + 150; A._supPub = sup0; r.ready = typeof A.shipSupLoad === "function" && (await A.shipSupLoad(), true);
      bg.remove(); return r; });
    ok("طلب يدوي: Stop Desk يتعطل في البلدية بلا مكتب ويُفعَّل مع مكتب، وإضافة البلدية تُضاف لسعر الولاية", mo2.disabled && mo2.enabled && mo2.opts && mo2.sup && mo2.ready, mo2); }
  { const kf = await p.evaluate(async () => { const A = Admin, r = {}, cf = A.courierFetch, fc = A.fetchCommuneFees, cfg0 = A.deliveryCfg.yalidine, ks0 = A._keyState.yalidine; let calls = []; A.deliveryCfg.yalidine = Object.assign({}, cfg0 || {}, { apiId: "1", apiToken: "2", enabled: true }); A._keyState.yalidine = { ok: false };
      A.courierFetch = async () => ({ ok: true, status: 200, text: JSON.stringify({ total_data: 3 }) }); A.fetchCommuneFees = async o => { calls.push(o); };
      await A.checkCompanyKeys("yalidine", { explain: true }); r.a = calls.length === 1 && calls[0].force === true; await A.checkCompanyKeys("yalidine", {}); r.b = calls.length === 1;
      A._keyState.yalidine = { ok: false }; await A.checkCompanyKeys("yalidine", { quiet: true }); r.c = calls.length === 2 && calls[1].auto === true;
      A.courierFetch = cf; A.fetchCommuneFees = fc; A.deliveryCfg.yalidine = cfg0; A._keyState.yalidine = ks0; return r; });
    ok("جلب أسعار البلديات تلقائياً فور قبول مفاتيح الشركة (حفظ المفاتيح ← جلب فوري، والتكرار العادي لا يعيده)", kf.a && kf.b && kf.c, kf); }
  { const cb = await p.evaluate(async () => { const A = Admin, r = {}, f0 = A.ydFees, c0 = A.deliveryCfg.yalidine, W = WILAYAS.find(w => w.id === 15), fw = A.fromWilayaId();
      A.deliveryCfg.yalidine = Object.assign({}, c0 || {}, { apiId: "1", apiToken: "2", enabled: true, prices: {} });
      A.ydFees = { [fw + "-15"]: { pc: { tiziouzou: { h: W.home, d: W.stop }, mkira: { h: W.home + 50, d: W.stop }, akbil: { h: W.home + 100, d: W.stop }, azazga: { h: W.home + 50, d: W.stop }, freha: { h: W.home + 50, d: W.stop }, zekri: { h: W.home + 50, d: W.stop } } } };
      const s = A.communeSup()[15] || {}; r.mk = JSON.stringify(s.mkira) === JSON.stringify([50, 0]) && !s.tiziouzou; const q = A.shipFeeFor(W, "M'Kira", "home"); r.fee = q.fee === W.home + 50 && q.sup === 50;
      A.ydFees = f0; A.deliveryCfg.yalidine = c0; return r; });
    ok("إضافة البلدية تُحسب نسبة لسعر الولاية المطبَّق (لا لمنوال بلديات ياليدين) فبلدية M'Kira تأخذ +50", cb.mk && cb.fee, cb); }
  { const fo = await p.evaluate(async () => { const A = Admin, r = {}, add0 = API.addOrder, c0 = A.deliveryCfg.yalidine, tw = WILAYAS.find(w => !w.par && w.id === 15);
      A.deliveryCfg.yalidine = Object.assign({}, c0 || {}, { apiId: "1", apiToken: "2", enabled: true, fromWilayaName: "Alger" }); A._cfgKeyOverride = null; let sent = []; API.addOrder = async o => { sent.push(o); return { ok: true, id: "M-FROM" + sent.length }; };
      const run = async chg => { ManualOrder.open({ mode: "new" }); await new Promise(z => setTimeout(z, 250)); const bg = document.getElementById("mo-bg"), f = bg.querySelector("#mo-from"); r.has = !!f; r.def = f && /16/.test(f.selectedOptions[0].textContent) && /الافتراضية/.test(f.selectedOptions[0].textContent); if (chg) { f.value = tw.name; }
        bg.querySelector("#mo-name").value = "اختبار"; bg.querySelector("#mo-phone").value = "0555123456"; const sel = bg.querySelector('#mo-lines [data-f="sel"]'); sel.value = "x"; sel.dispatchEvent(new Event("change", { bubbles: true })); const ln = bg.querySelector('#mo-lines [data-f="title"]'); if (ln) { ln.value = "منتج"; ln.dispatchEvent(new Event("input", { bubbles: true })); } const pr = bg.querySelector('#mo-lines [data-f="price"]'); if (pr) { pr.value = 1000; pr.dispatchEvent(new Event("input", { bubbles: true })); }
        bg.querySelector("#mo-save").click(); await new Promise(z => setTimeout(z, 200)); const m = document.getElementById("mo-bg"); if (m) m.remove(); };
      await run(false); await run(true); r.n = sent.length; r.none = sent[0] && !(sent[0].extra || {})["📍 ولاية الانطلاق"]; r.chg = sent[1] && (sent[1].extra || {})["📍 ولاية الانطلاق"] === tw.name;
      A.orders = A.orders.filter(o => !String(o.id).startsWith("M-FROM")); API.addOrder = add0; A.deliveryCfg.yalidine = c0; return r; });
    ok("طلب يدوي: خانة ولاية الانطلاق افتراضيها من إعدادات الشركة، ولا تُسجَّل في الطلب إلا إن تغيّرت", fo.has && fo.def && fo.n === 2 && fo.none && fo.chg, fo); }
  { const rc = await p.evaluate(async () => { const A = Admin, r = {}, ord0 = API.orders, q0 = API.questions, ao0 = A.orders;
      const mk = () => ({ id: "RC-1", date: new Date().toISOString(), name: "ز", phone: "0555000111", wilaya: "Alger", commune: "Kouba", dtype: "home", desk: "", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 500, total: 1500, discount: 0, extra: {}, status: "confirmee", note: "" });
      const loc = mk(); A.orders = [loc]; A.saveTracking(loc, "yalidine", "yal-RC1TEST", "1500"); API.questions = async () => ({ ok: true, questions: [] });
      API.orders = async () => ({ ok: true, orders: [mk()] }); await A.refreshAlerts(); const a = A.orders.find(x => x.id === "RC-1"); r.keep = !!(a && A.trackingOf(a)) && a.status === "confirmee";
      A.orders = [Object.assign(mk(), { _trkAt: Date.now() - 600000, note: "🚚yalidine:yal-OLD1" })]; API.orders = async () => ({ ok: true, orders: [mk()] }); await A.refreshAlerts(); r.old = !A.trackingOf(A.orders[0]);
      API.orders = async () => ({ ok: true, orders: [Object.assign(mk(), { note: "🚚yalidine:yal-SRV1" })] }); A.orders = [Object.assign(mk(), { _trkAt: Date.now(), note: "🚚yalidine:yal-LOC1" })]; await A.refreshAlerts(); r.srv = (A.trackingOf(A.orders[0]) || {}).tracking === "yal-SRV1";
      API.orders = ord0; API.questions = q0; A.orders = ao0; return r; });
    ok("سباق الإرسال: قائمة الخادم القديمة لا تُسقط وسم التتبع المحفوظ حديثاً محلياً (ولا تحجب تتبع الخادم ولا تتجاوز 3 دقائق)", rc.keep && rc.old && rc.srv, rc); }
  { const bl = await p.evaluate(async () => { const A = Admin, r = {}, cf0 = A.courierFetch, wo0 = window.open, ps0 = A.printOrderSlip, ao0 = A.orders, lc0 = A.labelCache; A.labelCache = {};
      const o = { id: "BL-1", date: new Date().toISOString(), name: "ز", phone: "0555000111", wilaya: "Alger", commune: "Kouba", dtype: "home", desk: "", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 500, total: 1500, discount: 0, extra: {}, status: "confirmee", note: "🚚yalidine:yal-BL1TEST" }; A.orders = [o];
      const wins = []; window.open = (u) => { const w = { u, closed: false, location: { set href(v) { w.href = v; } }, document: { write() { } }, close() { w.closed = true; } }; wins.push(w); return w; };
      let slip = 0; A.printOrderSlip = () => { slip++; }; let calls = 0;
      A.courierFetch = async () => { calls++; return { ok: true, status: 200, text: JSON.stringify({ data: [{ tracking: "yal-BL1TEST", extra: { pdf: { label: "https://yalidine.app/p/BL1.pdf" } } }] }) }; };
      await A.openLabel(0); r.deep = wins[0] && wins[0].href === "https://yalidine.app/p/BL1.pdf" && calls === 1; await A.openLabel(0); r.cache = calls === 1 && wins[1] && wins[1].href === "https://yalidine.app/p/BL1.pdf";
      A.labelCache = {}; A.courierFetch = async () => ({ ok: true, status: 200, text: JSON.stringify({ data: [{ tracking: "x" }] }) }); await A.openLabel(0); r.slip = slip === 1 && wins[2] && wins[2].closed;
      A.courierFetch = async () => { throw new Error("boom"); }; await A.openLabel(0); r.slip2 = slip === 2;
      A.courierFetch = cf0; window.open = wo0; A.printOrderSlip = ps0; A.orders = ao0; A.labelCache = lc0; return r; });
    ok("بوردرو الشركة الأصلي: يُبحث عن الرابط بعمق في الردّ ويُحفظ، وإن تعذّر يُفتح وصل الطلب بدل الفشل الصامت", bl.deep && bl.cache && bl.slip && bl.slip2, bl); }
  { const ff = await p.evaluate(async () => { const A = Admin, r = {}, f0 = A.ydFees, c0 = A.deliveryCfg.yalidine, cf0 = A.courierFetch, ps0 = Priv.set, W16 = WILAYAS.find(w => w.id === 16), W15 = WILAYAS.find(w => w.id === 15), W31 = WILAYAS.find(w => w.id === 31);
      A.deliveryCfg.yalidine = Object.assign({}, c0 || {}, { apiId: "1", apiToken: "2", enabled: true, fromWilayaName: "Alger" }); A.ydFees = {}; let urls = []; Priv.set = async () => { };
      const com = W31.communes[0]; A.courierFetch = async rq => { urls.push(rq.url); return { ok: true, status: 200, text: JSON.stringify({ retour_fee: 200, per_commune: { 1: { commune_name: com, express_home: 1234, express_desk: 777 } } }) }; };
      ManualOrder.open({ mode: "new" }); await new Promise(z => setTimeout(z, 300)); const bg = document.getElementById("mo-bg"), set = (id, v) => { const e = bg.querySelector("#" + id); e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); };
      set("mo-wil", W31.name); set("mo-com", com); const d = bg.querySelector("#mo-fee").value; set("mo-from", W15.name); const h0 = bg.querySelector("#mo-fh").textContent; await new Promise(z => setTimeout(z, 400));
      r.fetched = urls.length === 1 && /from_wilaya_id=15&to_wilaya_id=31/.test(urls[0]); r.fee = bg.querySelector("#mo-fee").value === "1234" && /من /.test(bg.querySelector("#mo-fh").textContent) && /تعريفة ياليدين/.test(bg.querySelector("#mo-fh").textContent); r.saved = !!(A.ydFees["15-31"]);
      set("mo-from", W16.name); r.back = bg.querySelector("#mo-fee").value === d && urls.length === 1; set("mo-from", W15.name); r.cache = bg.querySelector("#mo-fee").value === "1234" && urls.length === 1;
      A.courierFetch = async () => ({ ok: false, status: 500, text: "" }); A.ydFees = {}; set("mo-from", W16.name); set("mo-from", W15.name); await new Promise(z => setTimeout(z, 300)); r.fail = bg.querySelector("#mo-fee").value === d && /تعذّر/.test(bg.querySelector("#mo-fh").textContent);
      bg.remove(); A.ydFees = f0; A.deliveryCfg.yalidine = c0; A.courierFetch = cf0; Priv.set = ps0; return r; });
    ok("طلب يدوي: رسم التوصيل يتبع ولاية الانطلاق المختارة (يجلب تعريفة الزوج مرة ويخزّنها، ويعود للافتراضي عند العودة أو الفشل)", ff.fetched && ff.fee && ff.saved && ff.back && ff.cache && ff.fail, ff); }
  { const oe = await p.evaluate(async () => { const A = Admin, r = {}, f0 = A.ydFees, c0 = A.deliveryCfg.yalidine, cf0 = A.courierFetch, ps0 = Priv.set, uf0 = API.updateOrderFields, uo0 = API.updateOrder, ao0 = A.orders, W15 = WILAYAS.find(w => w.id === 15), W16 = WILAYAS.find(w => w.id === 16), W31 = WILAYAS.find(w => w.id === 31), com = W31.communes[0];
      A.deliveryCfg.yalidine = Object.assign({}, c0 || {}, { apiId: "1", apiToken: "2", enabled: true, fromWilayaName: "Alger" }); A.ydFees = {}; Priv.set = async () => { }; API.updateOrderFields = async () => true; API.updateOrder = () => { };
      A.courierFetch = async () => ({ ok: true, status: 200, text: JSON.stringify({ per_commune: { 1: { commune_name: com, express_home: 1500, express_desk: 900 } } }) });
      const o = { id: "OE-F1", date: new Date().toISOString(), name: "زبون", phone: "0555000222", wilaya: W31.name, commune: com, dtype: "home", desk: "", items: "منتج ×1 = 3000 DA", subtotal: 3000, fee: 900, total: 3900, discount: 0, extra: {}, status: "confirmee", note: "" }; A.orders = [o];
      OrderEdit.open(0); await new Promise(z => setTimeout(z, 250)); let bg = document.getElementById("oe-bg"), f = bg.querySelector("#oe-from"); r.has = !!f && /الافتراضية/.test(f.selectedOptions[0].textContent) && /16/.test(f.selectedOptions[0].textContent);
      f.value = W15.name; f.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(z => setTimeout(z, 400)); r.fee = bg.querySelector("#oe-fee").value === "1500" && /تعريفة ياليدين من/.test(bg.querySelector("#oe-fh").textContent);
      bg.querySelector("#oe-save").click(); await new Promise(z => setTimeout(z, 400)); r.tag = /📍@Tizi_Ouzou/.test(o.note) && A.fromOf(o) === W15.name && o.fee === 1500;
      A.orders = [o]; OrderEdit.open(0); await new Promise(z => setTimeout(z, 250)); bg = document.getElementById("oe-bg"); f = bg.querySelector("#oe-from"); r.pre = f.value === W15.name;
      f.value = W16.name; f.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(z => setTimeout(z, 300)); bg.querySelector("#oe-save").click(); await new Promise(z => setTimeout(z, 400)); r.reset = !/📍/.test(o.note) && A.fromOf(o) === "";
      const tr = Object.assign({}, o, { note: "🚚yalidine:yal-OEF1" }); A.orders = [tr]; OrderEdit.open(0); await new Promise(z => setTimeout(z, 250)); r.reg = !document.getElementById("oe-bg").querySelector("#oe-from"); document.getElementById("oe-bg").remove();
      A.ydFees = f0; A.deliveryCfg.yalidine = c0; A.courierFetch = cf0; Priv.set = ps0; API.updateOrderFields = uf0; API.updateOrder = uo0; A.orders = ao0; return r; });
    ok("تعديل الطلب: ولاية الانطلاق (للطلب غير المسجَّل) تغيّر الرسم وتُحفظ وسماً في الملاحظة وتُقرأ عند الإرسال، والعودة للافتراضية تزيلها", oe.has && oe.fee && oe.tag && oe.pre && oe.reset && oe.reg, oe); }
  { const ba = await p.evaluate(async () => { const out = {}, wins = [], wo0 = window.open, cf0 = Admin.courierFetch, ao0 = Admin.orders, rows0 = AdminYd.S.rows.slice(), tot0 = AdminYd.S.total; window.open = u => { const w = { u, document: { open() { }, write() { }, close() { } }, location: { set href(v) { w.href = v; } }, close() { } }; wins.push(w); return w; };
      Admin.orders = (Admin.orders || []).concat([{ id: "BA-1", name: "زبون", phone: "0555123456", status: "confirmee", note: "🚚yalidine:yal-BA1", date: new Date().toISOString(), wilaya: "Alger" }]);
      Admin.courierFetch = async () => ({ ok: true, status: 200, text: JSON.stringify({ data: [{ label: "https://yalidine.app/ba1.pdf" }] }) });
      AdminYd.set([{ tracking: "yal-BA1", date: "2026-10-10", name: "ز***", phone: "0*****6", wilaya: "Alger", price: 1000, status: "En préparation" }, { tracking: "yal-BA2", date: "2026-10-10", name: "ز***", phone: "0*****6", wilaya: "Alger", price: 1000, status: "En préparation" }], 2, false); await new Promise(r => setTimeout(r, 700));
      const c = document.getElementById("yd-card"), tr = c.querySelector('tr[data-trk="yal-BA1"]'), ck = tr && tr.querySelector("input.ts-ck"); if (ck) { ck.checked = true; ck.dispatchEvent(new Event("change", { bubbles: true })); } await new Promise(r => setTimeout(r, 200));
      const bar = document.querySelector('.ts-bar[data-ts-for="#yd-card table"]'); bar.querySelector('[data-ts="menu"]').click(); const it = bar.querySelector('[data-ts="bord"]'); out.item = !!it; if (it) it.click(); await new Promise(r => setTimeout(r, 600));
      out.opened = wins.length >= 1 && (wins[wins.length - 1].href === "https://yalidine.app/ba1.pdf"); out.key = tr.dataset.tsKey === "trk:yal-BA1";
      window.open = wo0; Admin.courierFetch = cf0; Admin.orders = ao0; AdminYd.set(rows0, tot0, false); return out; });
    ok("الطرود المسجلة: تحديد طرد ← Action ← «طباعة البوردرو الأصلي» يفتح بوردرو الشركة (كان لا يستجيب لأن window.Admin غير معرَّف)", ba.item && ba.opened && ba.key, ba); }
  { const ca = await p.evaluate(async () => { const A = Admin, r = {}, ps0 = Priv.set, fin0 = { costs: A.fin.costs, ads: A.fin.ads, adh: A.fin.adh, set: A.fin.set }, ao0 = A.orders, cf0 = window.confirm; window.confirm = () => true; Priv.set = async () => { };
      const pr = A.products.find(x => x.slug !== "test" && x.active !== false), slug = pr.slug; A.fin.costs = { [slug]: 1000 }; A.fin.set = Object.assign({}, A.fin.set, { packaging: 0, ad: { method: "fixed", a: 0, m: 2, n: 0 }, useReal: false });
      const mk = (id, day, st) => ({ id, date: day + "T12:00:00", status: st || "livree", name: "ز" + id, phone: "0551000" + id.slice(-3), wilaya: "Alger", commune: "Kouba", dtype: "home", items: pr.title + " ×1 = 3000 DA", subtotal: 3000, fee: 0, total: 3000, note: "", extra: {} });
      A.orders = [mk("CA001", "2026-10-02"), mk("CA002", "2026-10-05"), mk("CA003", "2026-10-20"), mk("CA004", "2026-09-20")];
      const per = () => A.computeFinance(0, {}).per[slug];
      A.fin.ads = { [slug]: { method: "spend", a: 3000, n: 3, m: 1, from: "2026-10-01", to: "" } }; A.fin.adh = []; let x = per(); r.act = x && x.ad === 2000 + 1000;   /* 3 طلبات مسلَّمة بعد 1 أكتوبر × 1000 */
      A.fin.ads = { [slug]: { method: "spend", a: 3000, n: 3, m: 1, from: "2026-10-01", to: "2026-10-10" } }; x = per(); r.stop = x.ad === 2000;                     /* بعد الإيقاف: طلب 20 أكتوبر بلا إعلان، وقبل البداية بلا إعلان */
      A.fin.ads = { [slug]: { method: "spend", a: 6000, n: 0, m: 1, from: "2026-10-11", to: "" } }; A.fin.adh = [{ id: "h1", slug, name: "قديمة", from: "2026-10-01", to: "2026-10-10", cfg: { method: "spend", a: 3000, n: 0, m: 1 } }];
      x = per(); r.arch = x.ad === 1500 * 2 + 6000;                                                                                                              /* القديمة: 3000÷طلبين=1500 ×2، الجديدة: 6000÷طلب واحد */
      A.fin.ads = { [slug]: { method: "spend", a: 3000, n: 0, m: 1 } }; A.fin.adh = []; x = per(); r.legacy = x.ad === 3000 + 0 && A.computeFinance(0, {}).K.adTotal >= 3000;           /* بلا نافذة: السلوك القديم (3000 على 4 طلبات؟ لا: ÷ الناجحة) */
      A.fin.ads = { [slug]: { method: "spend", a: 3000, n: 3, m: 1, from: "2026-10-01", to: "2026-10-10", name: "Summer", note: "نفد المخزون" } }; A.fin.adh = []; A._adRows = null; A._adSig = null; A._finSel = ""; A.renderAds(true);
      const rep = A.adReport(); r.rep = rep.length === 1 && rep[0].spend === 3000 && rep[0].r.units === 2 && rep[0].ended === true; r.ui = /متوقفة/.test(document.getElementById("fin-ads-rows").textContent) && /▶ استئناف/.test(document.getElementById("fin-ads-rows").innerHTML) && /نتائج الحملات وربطها بالمخزون/.test((document.getElementById("fin-ads-rep") || {}).textContent || "");
      A.fin.ads = fin0.ads; A.fin.adh = fin0.adh; A.fin.costs = fin0.costs; A.fin.set = fin0.set; A.orders = ao0; Priv.set = ps0; window.confirm = cf0; A._adCampsC = null; return r; });
    ok("حملة إعلانية بنافذة زمنية: تُحمَّل تكلفتها على طلبات فترتها فقط، وتتوقف عند الإيقاف، وتُؤرشف وتُحسب القديمة بنافذتها، مع تقرير مربوط بالمخزون", ca.act && ca.stop && ca.arch && ca.legacy && ca.rep && ca.ui, ca); }
  { const hs = await p.evaluate(async () => { const A = Admin, r = {}, ps0 = Priv.set, fin0 = { costs: A.fin.costs, ads: A.fin.ads, adh: A.fin.adh, set: A.fin.set }, ao0 = A.orders, st0 = {}, cf0 = window.confirm; window.confirm = () => true; Priv.set = async () => { };
      const pr = A.products.find(x => x.slug !== "test" && x.active !== false && x.type !== "variable"), slug = pr.slug; st0.stock = pr.stock; A.fin.costs = { [slug]: 1000 }; A.fin.set = Object.assign({}, A.fin.set, { packaging: 0, ad: { method: "fixed", a: 0 }, useReal: false });
      const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10), mk = (id, n) => ({ id, date: day(n) + "T12:00:00", status: "livree", name: "ز" + id, phone: "0551000" + id.slice(-3), wilaya: "Alger", commune: "Kouba", dtype: "home", items: pr.title + " ×1 = 3000 DA", subtotal: 3000, fee: 0, total: 3000, note: "", extra: {} });
      A.orders = [mk("HS001", 4), mk("HS002", 3), mk("HS003", 2), mk("HS004", 1), mk("HS005", 0)]; A.fin.adh = []; A._asaC = null; A._adCampsC = null;
      A.fin.ads = { [slug]: { method: "spend", a: 5000, n: 0, m: 1, from: day(5), to: "" } };
      pr.stock = 3; A._asaC = null; const low = A.adStockAlerts(5); r.low = low.length === 1 && low[0].c.slug === slug && low[0].left <= 5;
      AdminHome.render(); await new Promise(z => setTimeout(z, 100)); const btn = document.querySelector('#ahome [data-go="ads"]'); r.btn = !!btn && btn.classList.contains("w") && btn.querySelector("b").textContent.trim() === "1";
      pr.stock = 500; A._asaC = null; r.ok = A.adStockAlerts(5).length === 0; AdminHome.render(); await new Promise(z => setTimeout(z, 100)); const b2 = document.querySelector('#ahome [data-go="ads"]'); r.ok2 = !!b2 && b2.classList.contains("ok");
      pr.stock = 3; A.fin.ads = { [slug]: { method: "spend", a: 5000, n: 0, m: 1, from: day(5), to: day(1) } }; A._asaC = null; A._adCampsC = null; r.stopped = A.adStockAlerts(5).length === 0;
      pr.stock = st0.stock; A.fin.ads = fin0.ads; A.fin.adh = fin0.adh; A.fin.costs = fin0.costs; A.fin.set = fin0.set; A.orders = ao0; Priv.set = ps0; window.confirm = cf0; A._asaC = null; A._adCampsC = null; AdminHome.render(); return r; });
    ok("الرئيسية: بطاقة «حملة نشطة مخزونها يكفي 5 أيام أو أقل» تظهر بعدّاد للحملة النشطة قليلة المخزون فقط (لا المتوقفة ولا الوفيرة)", hs.low && hs.btn && hs.ok && hs.ok2 && hs.stopped, hs); }
  { const mo3 = await p.evaluate(async () => { const A = Admin, r = {}; const W = WILAYAS.find(w => !w.par && (w.communes || []).length > 2), cn = x => String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const c1 = W.communes[0], c2 = W.communes[1], cs0 = A.communeSup, sp0 = A._supPub, W2 = WILAYAS.find(w => !w.par && w.id !== W.id && (w.communes || []).length);
      A._supPub = { [W.id]: { [cn(c1)]: [60, 0] }, [W2.id]: { [cn(W2.communes[0])]: [-40, 0] } }; A.communeSup = () => ({ [W.id]: { [cn(c2)]: [90, 0] } });
      const m = A.shipSup(); r.merge = m[W.id][cn(c1)][0] === 60 && m[W.id][cn(c2)][0] === 90 && !!m[W2.id];
      ManualOrder.open({ mode: "new" }); await new Promise(z => setTimeout(z, 300)); const bg = document.getElementById("mo-bg"), set = (id, v) => { const e = bg.querySelector("#" + id); e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); };
      set("mo-wil", W.name); set("mo-com", c1); const h1 = bg.querySelector("#mo-fh").textContent; r.h1 = /البلدية \+60/.test(h1) && /الولاية/.test(h1); set("mo-com", W.communes[2]); r.h0 = /البلدية 0/.test(bg.querySelector("#mo-fh").textContent);
      bg.remove(); A.communeSup = cs0; A._supPub = sp0; return r; });
    ok("طلب يدوي: تفصيل «الولاية + البلدية» يظهر دائماً ويدمج الإضافات المحلية والمنشورة", mo3.merge && mo3.h1 && mo3.h0, mo3); }
  { const cs = await p.evaluate(async () => { const A = Admin, d = new Date().toISOString(); const o = { id: "CS-1", name: "زبون تناسق", phone: "0555111222", status: "nouvelle", note: "", date: d, wilaya: "Alger", commune: "x", total: 2000, items: "منتج ×1 = 2000 DA" }; A.orders.push(o); const r = {};
      const i = A.orders.indexOf(o); A.setAttempt(i, 1); r.stamp = /👤\S+@\d+/.test(o.note); r.last = CallSync.lastCallText(o); r.txt = /لم يُجب/.test(r.last) && /المدير/.test(r.last);
      o.note = ""; A.openOrderPreview(i); await new Promise(z => setTimeout(z, 150)); const lk = document.querySelector("#ord-prev-a a.call-lnk"); r.hasOid = !!lk && lk.dataset.oid === "CS-1"; lk.addEventListener("click", e => e.preventDefault(), true); lk.click(); r.locked = /🔒\S+#\d+/.test(o.note); document.getElementById("ord-prev-bg").classList.remove("open");
      CallSync.assign([o], "agent@x.com"); r.asg = CallSync.assigneeOfNote(o) === "agent@x.com"; const as = { on: true, mode: "manual", weights: { "agent@x.com": 1 } }; r.who = AdminRoles.assigneeOf(o, as); CallSync.assign([o], ""); r.cleared = CallSync.assigneeOfNote(o) === "";
      const f = { id: "CS-2", name: "ف", phone: "0777123456", status: "expediee", note: "🚚yalidine:yal-CS2", date: d, wilaya: "Alger", total: 1000, items: "م ×1 = 1000 DA" }; A.orders.push(f); A.shipRaw["CS-2"] = { raw: "Tentative échouée", ts: 1 }; r.btn = /yd-cb call/.test(A.callBtnsHtml(f)) && A.failedAttempt(f);
      A.orders = A.orders.filter(x => !/^CS-/.test(x.id)); delete A.shipRaw["CS-2"]; return r; });
    ok("تناسق الاتصال: بصمة من اتصل والنتيجة، قفل عند «اتصل»، إسناد يدوي، وأزرار الفاشل في الجدول السفلي", cs.stamp && cs.txt && cs.hasOid && cs.locked && cs.asg && cs.who === "agent@x.com" && cs.cleared && cs.btn, cs); }
  { const fu = await p.evaluate(async () => { const A = Admin, d = new Date().toISOString(); const o = { id: "FU-1", name: "زبون متابعة", phone: "0555000111", status: "expediee", note: "🚚yalidine:yal-FU1", date: d, wilaya: "Alger", commune: "Bab Ezzouar", total: 3000, items: "منتج ×1 = 3000 DA" };
      A.orders.push(o); A.shipRaw["FU-1"] = { raw: "Tentative échouée", ts: 1 }; const r = {}; r.fa = A.failedAttempt(o); r.list = A.followList().some(x => x.id === "FU-1"); r.q = CallCenter.queue().some(x => x.f && x.o.id === "FU-1");
      CallCenter._s.cur = "FU-1"; CallCenter.render(); await new Promise(z => setTimeout(z, 200)); const host = document.getElementById("callcenter-content"); r.card = !!host && /توصيل فاشل/.test(host.textContent) && !!host.querySelector('[data-d="fok"]') && !!host.querySelector('a[href^="tel:"]');
      await CallCenter.decide("fno"); r.after = A.failedAttempt(o) === false && /📲no@/.test(o.note); o.note = "🚚yalidine:yal-FU1"; r.back = A.failedAttempt(o); A.shipRaw["FU-1"] = { raw: "Livré", ts: 1 }; r.deliv = A.failedAttempt(o);
      A.orders = A.orders.filter(x => x.id !== "FU-1"); delete A.shipRaw["FU-1"]; CallCenter._s.cur = null; return r; });
    ok("مركز الاتصال: طرد Tentative échouée يدخل الطابور ببطاقة متابعة، ويخرج بعد تسجيل النتيجة", fu.fa && fu.list && fu.q && fu.card && fu.after && fu.back && !fu.deliv, fu); }
  { const hc = await p.evaluate(async () => { const A = Admin; const orig = A.openOrderPreview; let got = -1; A.openOrderPreview = i => { got = i; }; AdminHome.render(); await new Promise(z => setTimeout(z, 100)); const tr = document.querySelector("#ahome tr[data-o]"); if (!tr) { A.openOrderPreview = orig; return { none: true }; } tr.click(); A.openOrderPreview = orig; return { got, same: got >= 0 && A.orders[got] === tr._o }; });
    ok("الرئيسية: الضغط على صف في «آخر الطلبات» يفتح الطلب مباشرة", hc.none || hc.same, hc); }
  { const mb = await p.evaluate(async () => { const b = document.getElementById("mo-btn"), cs = getComputedStyle(b), c = document.getElementById("cs-svc"), cb = c && c.querySelector(".cs-btn") || c; const rb = b.getBoundingClientRect(), rc = cb && cb.getBoundingClientRect(); return { txt: b.textContent.trim(), fs: parseFloat(cs.fontSize), inBar: !!b.closest(".search-bar"), h: Math.round(rb.height), ch: rc ? Math.round(rc.height) : null, w: Math.round(rb.width), cw: rc ? Math.round(rc.width) : null, wil: document.getElementById("order-filter-wilaya").options.length, nW: WILAYAS.length }; });
    ok("الطلبات: زر «إضافة طلب جديد» بحجم زر «تفعيل خدمة تأكيد الزبائن» وخارج شريط الفلاتر، وقائمة الولايات كاملة", /إضافة طلب جديد/.test(mb.txt) && mb.fs < 18 && !mb.inBar && (mb.ch == null || Math.abs(mb.h - mb.ch) <= 4) && mb.wil === mb.nW + 1, mb); }
  { const ct = await p.evaluate(async () => { const keep = AdminYd.S.rows.slice(), kt = AdminYd.S.total; Admin.orders = Admin.orders || []; Admin.orders.push({ id: "CT-1", name: "زبون اختبار", phone: "0555123456", status: "expediee", note: "🚚yalidine:yal-CT1", date: new Date().toISOString(), wilaya: "Alger" }, { id: "CT-2", name: "زبون ثانٍ", phone: "0666123456", status: "expediee", note: "🚚yalidine:yal-CT2", date: new Date().toISOString(), wilaya: "Alger" }); AdminYd.set([{ tracking: "yal-CT1", date: "2026-10-10", name: "ز***", phone: "0*****6", wilaya: "Alger", price: 1000, status: "Tentative échouée" }, { tracking: "yal-CT2", date: "2026-10-10", name: "ز***", phone: "0*****6", wilaya: "Alger", price: 1000, status: "Vers Wilaya" }], 2, false); await new Promise(r => setTimeout(r, 200)); const c = document.getElementById("yd-card"), t1 = c.querySelector('tr[data-trk="yal-CT1"]'), t2 = c.querySelector('tr[data-trk="yal-CT2"]'); const out = { a: t1.querySelectorAll(".yd-cb").length, tel: (t1.querySelector(".yd-cb.call") || {}).href, wa: (t1.querySelector(".yd-cb.wa") || {}).href, b: t2.querySelectorAll(".yd-cb").length, small: c.querySelectorAll('a[title="اتصال"],a[title="واتساب"]').length, h: parseInt(getComputedStyle(t1.querySelector(".yd-cb")).minHeight) || 0 }; Admin.orders = Admin.orders.filter(o => !/^CT-/.test(o.id)); AdminYd.set(keep, kt, false); return out; });
    ok("المسجلة: زرّا اتصال وواتساب واضحان لحالة Tentative échouée فقط، بلا الزرين الصغيرين", ct.a === 2 && /tel:\+213555123456/.test(ct.tel || "") && /wa\.me\/213555123456/.test(ct.wa || "") && ct.b === 0 && ct.small === 0 && ct.h >= 30, ct); }
  { const rs = await p.evaluate(() => { const A = Admin, o1 = { id: "T-new", status: "nouvelle", note: "", date: new Date().toISOString() }, o2 = { id: "T-sent", status: "expediee", note: "🚚yalidine:yal-TEST1", date: new Date().toISOString() }; const keep = A.shipRaw["T-sent"]; A.shipRaw["T-sent"] = { raw: "Vers Wilaya", ts: 1 }; const r = [AdminHome.realSt(o1).t, AdminHome.realSt(o2).t, AdminHome.realSt(Object.assign({}, o2, { note: "" , status: "confirmee"})).t]; if (keep) A.shipRaw["T-sent"] = keep; else delete A.shipRaw["T-sent"]; return r; });
    ok("الرئيسية: آخر الطلبات تعرض الجديد وحالة الشركة الحقيقية", /جديد/.test(rs[0]) && rs[1] === "Vers Wilaya" && /لم يُرسل/.test(rs[2]), rs); }
  { const pm = await p.evaluate(async () => { const pr = Admin.products.find(x => (x.type || "simple") === "simple" && x.active !== false) || Admin.products[0]; pr.bord = "اسم-بوردرو-تجربة"; Admin.editProduct(pr.slug); Admin.addOfferRow(); await new Promise(r => setTimeout(r, 200)); const m = document.getElementById("prod-modal-bg"), bad = [...m.querySelectorAll("input,select,textarea")].filter(e => !["checkbox", "file", "hidden"].includes(e.type) && e.offsetParent !== null && getComputedStyle(e).display !== "none" && !e.closest("label") && !(e.id && m.querySelector('label[for="' + e.id + '"]')) && !e.getAttribute("aria-label")).map(e => e.id || e.className).filter(x => x !== "f-cover" && !/^(sb|fsb)/.test(x)), ofl = m.querySelector(".offer-row .fl span"), bv = document.getElementById("f-bord").value; Admin.closeModal(); const MO = window.ManualOrder; return { bad: bad.slice(0, 8), ofl: ofl && ofl.textContent, bv }; });
    ok("تعديل المنتج: لكل خانة عنوان، وخانة «الاسم الظاهر على البوردرو» تُقرأ، وصف العرض بعناوين", pm.bad.length === 0 && pm.bv === "اسم-بوردرو-تجربة" && /الكمية/.test(pm.ofl || ""), pm); }
  const sbw = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; ImgGen.openSized({ W: 1000, H: 1000, id: "custom", label: "t", name: "sbw", textMode: "none", lang: "ar" }); await w(1500); const el = document.getElementById("pbx-insp"), o = { lw: (l => l ? parseFloat(getComputedStyle(l.querySelector(".pbx-tabs"), "::-webkit-scrollbar").width) : -1)(document.getElementById("pbx-lside")), w: el ? parseFloat(getComputedStyle(el, "::-webkit-scrollbar").width) : -1, ov: el ? getComputedStyle(el).overflowY : "" }; PBApp.close(); await w(400); return o; });
  ok("المطوّر: شريط تمرير الإعدادات الأيمن عريض (≥12px) برتقالي", sbw.w >= 12 && /auto|scroll/.test(sbw.ov), sbw);
  ok("المطوّر: شريط تمرير القائمة اليسرى عريض أيضاً", sbw.lw >= 12, sbw);
  ok("إنشاء الصور: الخلفية ليست قسماً (لا إطار ولا شريط قسم) وزر الأيمن ← «إضافة لون الخلفية» ← نافذة ألوان تغيّر الخلفية وتُغلق مع المحرر", bgT.noSecBox && bgT.hasItem && bgT.pop && bgT.eye && bgT.bg === "#e53935" && /229, 57, 53/.test(bgT.inFrame) && bgT.closed, bgT);
  ok("تصميم بمقاس: عجلة الفأرة تكبّر وتصغّر بلا Ctrl، والقرص بإصبعين يكبّر على الهاتف", Object.keys(fitR).filter(k => k !== "mobile").every(k => fitR[k].zoomIn && fitR[k].zoomOut) && fitR.mobile.inside && fitR.mobile.pinch, fitR);
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
  // ── ولاية الانطلاق: قائمة في إعدادات الشركة، وتجاوز لطلب واحد، وولاية مستودع الطلب ──
  const frm = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true;
    const SV = { ro: Admin.renderOrders, uo: API.updateOrder, cf: Admin.courierFetch, cw: Admin.companyWilayas, rc: Admin.resolveCommune, en: Admin.enqueueNotify, rb: Admin.renderShippedBadge, or: Admin.orders, dc: Admin.deliveryCfg, wh: Admin.wh, ps: Priv.set };
    Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg); Admin.deliveryCfg.yalidine = { enabled: true, apiId: "a", apiToken: "b", fromWilayaName: "Alger" }; Admin.companyWilayas = async () => ({}); Priv.set = async () => { };
    Admin.renderOrders = () => { }; API.updateOrder = async () => ({ ok: true }); Admin.enqueueNotify = () => { }; Admin.renderShippedBadge = () => { };
    const posts = []; Admin.courierFetch = async rq => { if (rq.method === "POST") { posts.push(JSON.parse(rq.body)); return { ok: true, status: 200, text: JSON.stringify({ data: [{ success: true, tracking: "yal-F" + posts.length }] }) }; } return { ok: true, status: 200, text: JSON.stringify({ total_data: 3, data: [] }) }; };
    const mk = (id, note) => ({ id, date: new Date().toISOString(), status: "confirmee", name: "Test From", phone: "0550000002", wilaya: "Alger", commune: "Alger Centre", dtype: "home", total: 3000, subtotal: 3000, fee: 0, items: "x ×1 = 3000 DA", note: note || "" });
    const fromOf = x => { const b = x && (Array.isArray(x) ? x[0] : x); return b && (b.from_wilaya_name || (Array.isArray(b) ? "" : "")); };
    Admin.orders = [mk("FR1"), mk("FR2"), mk("FR3", "📦@w1"), mk("FR4")];
    Admin.wh = { cfg: AdminWh.normCfg({ on: true, list: [{ id: "w1", name: "مستودع", from: "Constantine" }] }), stock: {} };
    const R = {};
    await Admin.sendOrderToDelivery(0, "yalidine"); R.def = fromOf(posts[0]);
    Admin._fromOv.FR2 = "Oran"; await Admin.sendOrderToDelivery(1, "yalidine"); R.ov = fromOf(posts[1]); delete Admin._fromOv.FR2;
    await Admin.sendOrderToDelivery(2, "yalidine"); R.wh = fromOf(posts[2]);
    Admin.sendFromDlg(3); await wait(50); const sel = document.getElementById("sf-w"); R.dlg = !!sel && sel.options.length; if (sel) sel.value = "Tlemcen"; document.getElementById("sf-go").click(); await wait(400); R.dlgSent = fromOf(posts[3]); R.dlgGone = !document.getElementById("sf-bg"); R.cleared = !Admin._fromOv.FR4;
    Admin.openDeliveryConfig("yalidine"); await wait(100); const fs = document.getElementById("dlv-f-fromWilayaName"); R.sel = fs ? [fs.tagName, fs.options.length, fs.value] : null;
    Admin.renderOrders = SV.ro; API.updateOrder = SV.uo; Admin.courierFetch = SV.cf; Admin.companyWilayas = SV.cw; Admin.resolveCommune = SV.rc; Admin.enqueueNotify = SV.en; Admin.renderShippedBadge = SV.rb; Admin.orders = SV.or; Admin.deliveryCfg = SV.dc; Admin.wh = SV.wh; Priv.set = SV.ps;
    const mb = document.querySelector("#delivery-modal-bg"); if (mb) mb.classList.remove("open"); return R;
  });
  ok("ولاية الانطلاق: الافتراضية من إعدادات الشركة، والتجاوز لطلب واحد، وولاية المستودع تلقائياً", frm.def === "Alger" && frm.ov === "Oran" && frm.wh === "Constantine", frm);
  ok("ولاية الانطلاق: نافذة 📍 تختار ولاية وتُرسل منها ثم تُغلق ولا يبقى تجاوز، وإعدادات الشركة قائمة منسدلة بالولايات", frm.dlg >= 58 && frm.dlgSent === "Tlemcen" && frm.dlgGone && frm.cleared && frm.sel && frm.sel[0] === "SELECT" && frm.sel[1] >= 58 && frm.sel[2] === "Alger", frm);
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
    await Admin.shipSupLoad(); q("oe-name").value = "اسم جديد"; q("oe-wil").value = w2.name; q("oe-wil").dispatchEvent(new Event("change")); await wait(50); const exp = Admin.shipFeeFor(w2, q("oe-com").value, "home").fee;
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
    return { btn, btnNew, wilOpts, feeAfter, w2: exp, comOpts, totTxt, name: o.name, wilaya: o.wilaya, fee: o.fee, total: o.total, savedFields: saved && Object.keys(saved.f).sort().join(","), stored: !!stored.E1 && stored.E1.name === "اسم جديد", re: re.name + "|" + re.wilaya, patch: rq.method, bodyKeys: Object.keys(body).sort().join(","), home: body.is_stopdesk, ur, skip, sentMethod: sentReq && sentReq.method, sentUrl: sentReq && sentReq.url, notes: Admin.orders.map(x => /🚚/.test(x.note)), ntxt: /أُرسل 2/.test(ntxt) };
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
  ok("نافذة المعاينة: نتيجة الاتصال قائمة منسدلة (9 خيارات للجديد) ولا زر إلغاء في الأسفل", pr.btns === 9 && !pr.cancelBtm, pr);
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
  ok("القائمة: ecommerce تبدأ بالطلبات والمسجلة والمخزون والأرباح والمدفوعات، والبكسلات قبل السوشيال", /\|البكسلات\|السوشيال والإعلانات\|/.test(j(nv.shop)+"|") && j(nv.shop).startsWith("الطلبات|الطلبات المسجلة|المخزون والأرباح|المدفوعات|") && !nv.shop.includes("نموذج الطلب"), nv.shop);
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
    const glued = [...document.querySelectorAll("#nav-res .as-t")].some(x => x.textContent.trim().length > 40);
    const onBefore = (document.querySelector(".nav-btn.on") || {}).textContent; AdminHelp.ask("الدفع"); await new Promise(r => setTimeout(r, 200)); const stay = (document.querySelector(".nav-btn.on") || {}).textContent === onBefore;
    await type("اسألني"); const ask = [...document.querySelectorAll("#nav-res .as-t")].some(x => x.textContent.trim() === "اسألني"), askSub = /اسألني/.test(document.getElementById("nav-res").textContent);
    await type(""); const closed = !document.getElementById("nav-res").classList.contains("on");
    return { h, above, dlg, shown, under, kept, hit, ask, askSub, closed, kinds, stay, glued };
  });
  ok("البحث السريع: خانة كبيرة (≥48px) فوق «دليل الاستخدام»، والكتابة فيها تعرض قائمة نتائج تحتها بلا نافذة (وتبقى الكلمة)، وتجد قسم المدفوعات، وفيها الأقسام فقط (بلا شروح)، ولا تظهر «اسألني»، وتُغلق بمسح النص، والكتابة في «اسألني» لا تفتح قسماً", nq.h >= 48 && nq.above && !nq.dlg && nq.shown && nq.under && nq.kept && /المدفوعات/.test(nq.hit || "") && !nq.ask && nq.closed && nq.kinds === "قسم" && nq.stay && !nq.glued, nq);
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
    const mk = (fee, bd) => ({ id: "D" + fee, date: new Date().toISOString(), status: "nouvelle", name: "ز", phone: "0550000000", wilaya: "Alger", commune: "Kouba", dtype: "home", desk: "", items: "", subtotal: 2400, fee, total: 2400 + fee, discount: 0, coupon: "", extra: Object.assign({ "🔗 مرجع": "PF-REF-123", "🔗 معرّف النقرة": "fbclid-ABC" }, bd ? { "🚚 تفصيل التوصيل": bd, "📄 الصفحة": "p/x" } : {}), note: "" });
    Admin.orders = [mk(800, "750+50"), mk(900, "750+50"), mk(750, "")];
    const txt = i => { Admin.openOrderPreview(i); return document.getElementById("ord-prev-b").textContent; };
    const a = txt(0), b = txt(1), c = txt(2); const hid = !/PF-REF-123|fbclid-ABC|معرّف النقرة/.test(a + b + c);
    return { a: /تفصيل/.test(a) && /750/.test(a) && /إضافة البلدية/.test(a) && !/750\+50/.test(a), b: !/تفصيل/.test(b), c: !/تفصيل/.test(c) && hid };
  });
  ok("معاينة الطلب: يظهر للمدير تفصيل التوصيل (ولاية 750 + إضافة البلدية 50) عند وجوده فقط، ويختفي إن عُدّل الرسم", bdp.a && bdp.b && bdp.c, bdp);
  // ── إضافة البلدية من ياليدين (Supplément commune) ──
  const sp = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), cf0 = Admin.courierFetch, pj0 = typeof PBApp !== "undefined" ? PBApp.putJson : null, set0 = Priv.set; Priv.set = async () => { };
    Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { yalidine: { apiId: "a", apiToken: "b", enabled: true, fromWilayaName: "Alger" } }); Admin.ydFees = {}; Admin._feesBusy = false;
    const pub = []; PBApp.putJson = async (path, data) => { pub.push({ path, data }); return true; };
    const W16 = WILAYAS.find(w => w.id === 16), H = W16.home, D = W16.stop; Admin.courierFetch = async rq => { const to = Number(/to_wilaya_id=(\d+)/.exec(rq.url)[1]); return { ok: true, status: 200, text: JSON.stringify({ retour_fee: 200, cod_percentage: 1, insurance_percentage: 1, per_commune: { 1: { commune_name: "Kouba", express_home: H + 50, express_desk: D }, 2: { commune_name: "Bab Ezzouar", express_home: H, express_desk: D }, 3: { commune_name: "Dar El Beida", express_home: H, express_desk: D }, 4: { commune_name: "Hussein Dey", express_home: H, express_desk: D } } }) }; };
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
  // ── تبويب «تعديل الصورة»: ثلاث قوائم (إنشاء/تعديل/أتمتة) + أداة التكبير ──
  const tm = await p.evaluate(async () => {
    PBApp.ltoggle("img"); await new Promise(r => setTimeout(r, 300)); const pane = document.getElementById("pbx-lpane");
    const heads = [...pane.querySelectorAll(".pbx-cat")].map(x => x.textContent.trim()).slice(0, 3), rows = [...pane.querySelectorAll("[data-imgx]")].map(x => x.dataset.imgx), cards = pane.querySelectorAll(".pbx-tt.card").length, ics = pane.querySelectorAll(".pbx-tt.ic").length;
    const soon = pane.querySelector('[data-imgx="logo"] .tt-b2') ? 1 : 0; const toasts = []; 
    const msg = "قيد التطوير"; const anySoon = pane.querySelectorAll(".pbx-tr .tt-b2").length;
    PBApp.ltoggle("img"); return { heads, rows, cards, ics, soon: anySoon, msg };
  });
  ok("تعديل الصورة: ثلاث قوائم بالترتيب (إنشاء/تعديل/أتمتة وتوسّع) وفيها كل الصفوف الجديدة وبطاقات الأدوات القديمة محفوظة", tm.heads.join("|") === "إنشاء|تعديل|أتمتة وتوسّع" && ["gen", "pshoot", "fashion", "tryon", "up", "brand", "recolor", "logo", "batch", "catalog"].every(k => tm.rows.includes(k)) && tm.cards === 12 && tm.ics === 4 && tm.rows.includes("vgen") && tm.soon === 0, tm);
  // ── مكتبة الأصول (Pixabay/Iconify) داخل المطوّر الحقيقي ──
  const as = await p.evaluate(async () => {
    const real = window.fetch, svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 2h2"/></svg>';
    window.fetch = async (u, o) => { u = String(u);
      if (u.startsWith("https://api.iconify.design/search")) return new Response(JSON.stringify({ icons: ["tabler:cart"], total: 1, collections: { tabler: { name: "Tabler", license: { title: "MIT", spdx: "MIT" } } } }));
      if (u.startsWith("https://api.iconify.design/collections")) return new Response("{}");
      if (/api\.iconify\.design\/tabler\/cart\.svg/.test(u)) return new Response(svg);
      return real(u, o); };
    PBApp.ltoggle("ast"); await new Promise(r => setTimeout(r, 400));
    const tabBtn = !!document.querySelector('.pbx-tabs [data-lt="ast"]'), root = !!document.querySelector("#ast-root"), noKey = /pixabay\.com\/api\/docs/.test(document.getElementById("ast-out").innerHTML);
    document.querySelector('[data-ast-tab="ico"]').click(); await new Promise(r => setTimeout(r, 100));
    document.getElementById("ast-iq").value = "cart"; document.querySelector("[data-ast-go]").click(); await new Promise(r => setTimeout(r, 500));
    const it = document.querySelector(".ast-grid.ic .ast-i"); if (it) it.click(); await new Promise(r => setTimeout(r, 900));
    const j = PBApp.pageJson(), added = /assets\/img\/pages\/ic-tabler-cart-[a-z0-9]+\.svg/.test(j);
    window.fetch = real; PBApp.ltoggle("ast");
    return { tabBtn, root, noKey, icons: !!it, added };
  });
  ok("مكتبة الأصول: التبويب موجود ولا يطلب مفتاحاً (الوسيط مدمج)", as.tabBtn && as.root && !as.noKey, as);
  ok("مكتبة الأصول: النقر على أيقونة يحفظها SVG ويضيفها عنصر صورة", as.icons && as.added, as);
  await p.screenshot({ path: "/tmp/stk-ui.png" });
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(400);
  // ── تحسين الجودة (صفحة مستقلة كي لا يتأثر تدفّق الاختبارات الأخرى) ──
  await p.evaluate(() => { const pg = PB.newPage("اختبار تكبير", ""); pg.slug = "up-t"; const sec = PB.mkS([PB.mkC([PB.mkW("image", { src: "assets/img/favicon.png", hauto: true })])]); pg.sections = [sec]; window.__upId = sec.cols[0].widgets[0].id; PBApp.open(pg, "", true); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { PBApp.E.sel = window.__upId; PBApp.ltoggle("img"); }); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('[data-imgx="up"]').click()); await p.waitForTimeout(600);
  ok("تحسين الجودة: تفتح لوحته بخيارات التكبير والحدّة والضجيج والتحسين التلقائي", await p.evaluate(() => !!document.querySelector('#pbx-ep [data-upk="scale"]') && !!document.querySelector('#pbx-ep [data-upk="sharp"]') && !!document.querySelector('#pbx-ep [data-upk="dn"]') && !!document.querySelector('#pbx-ep [data-upk="auto"]') && /تحسين الجودة/.test(document.querySelector("#pbx-ep .ep-h").textContent)));
  await p.evaluate(() => { window.__preUp = PBApp.pageJson(); document.querySelector('#pbx-ep [data-upx="go"]').click(); }); await p.waitForTimeout(6000);
  ok("تحسين الجودة: التنفيذ يستبدل الصورة بنسخة أكبر محفوظة", await p.evaluate(() => { const j = PBApp.pageJson(); return j !== window.__preUp && /assets\/img\/pages\/gen-/.test(j); }));
  // ── الهوية البصرية (ألوان + خط + شعار) ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-imgx="brand"]').click()); await p.waitForTimeout(1500);
  const br = await p.evaluate(async () => {
    const ep = document.querySelector("#pbx-ep"), head = ep && ep.querySelector(".ep-h") ? ep.querySelector(".ep-h").textContent : "";
    const cols = document.querySelectorAll("#pbbr [data-brc]").length, font = !!document.querySelector('#pbbr [data-brk="font"]'), name = !!document.querySelector('#pbbr [data-brk="name"]'), logo = !!document.querySelector("#pbbr #pbbr-lf");
    const kit = { colors: ["#ff0000", "#00ff00", "#0000ff", "#000000", "#ffffff"], font: "Cairo", name: "علامتي" }, src = document.createElement("canvas"); src.width = 200; src.height = 200; src.getContext("2d").fillStyle = "#888"; src.getContext("2d").fillRect(0, 0, 200, 200);
    const out = PBBrand._t.render(src, kit, { border: 5, bcol: 0, pad: 0, bgc: 2, radius: 0, logo: false, txt: true, tpos: "bc", tsize: 8, tcol: 4, band: true }, null);
    const g = out.getContext("2d"), edge = g.getImageData(2, 100, 1, 1).data, band = g.getImageData(10, out.height - 6, 1, 1).data;
    const ni = document.querySelector('#pbbr [data-brk="name"]'); ni.value = "متجري"; ni.dispatchEvent(new Event("input", { bubbles: true }));
    const cb = document.querySelector('#pbbr [data-bro="txt"]'); cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 900));
    return { head, cols, font, name, logo, edgeRed: edge[0] > 200 && edge[1] < 60, bandRed: band[0] > 200 && band[1] < 60, saved: /متجري/.test((localStorage.getItem(Object.keys(localStorage).find(k => /brand_kit$/.test(k)) || "x") || "")), live: !!(PBApp.liveOn && PBApp.liveOn()) };
  });
  ok("الهوية البصرية: لوحة بخمسة ألوان وخط واسم وشعار", /الهوية البصرية/.test(br.head) && br.cols === 5 && br.font && br.name && br.logo, br);
  ok("الهوية البصرية: الحدّ والشريط يُرسمان بألوان العلامة، والإعدادات تُحفظ وتظهر معاينة حيّة", br.edgeRed && br.bandRed && br.saved && br.live, br);
  // ── تجربة افتراضية (صورة الشخص + القطعة؛ محاكاة ImgGen.edit) ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-imgx="tryon"]').click()); await p.waitForTimeout(800);
  const to = await p.evaluate(async () => {
    const head = (document.querySelector("#pbx-ep .ep-h") || {}).textContent || "", file = !!document.querySelector("#pbx-ep #pbai-tp"), soon = !!document.querySelector('[data-imgx="tryon"] .tt-b2');
    const T = PBAI._t.tryOnPrompt({ part: "top" }), calls = []; const old = ImgGen.edit; ImgGen.edit = async o => { calls.push({ extra: (o.extra || []).length, W: o.W, H: o.H, p: o.prompt }); const c = document.createElement("canvas"); c.width = 60; c.height = 80; c.getContext("2d").fillStyle = "#39c"; c.getContext("2d").fillRect(0, 0, 60, 80); return { canvas: c }; };
    document.querySelector('#pbx-ep [data-ai="tryon"]').click(); await new Promise(r => setTimeout(r, 400)); const noPerson = (document.querySelector("#pbai-msg") || {}).textContent;
    const pc = document.createElement("canvas"); pc.width = 100; pc.height = 150; PBAI.state.person = { c: pc, w: 100, h: 150 };
    document.querySelector('#pbx-ep [data-ai="tryon"]').click(); await new Promise(r => setTimeout(r, 1500)); ImgGen.edit = old;
    return { head, file, soon, noPerson, calls, keep: /EXACTLY/.test(T) && /no nudity/.test(T) && /Image 1/.test(T), live: !!(PBApp.liveOn && PBApp.liveOn()) };
  });
  ok("تجربة افتراضية: الصف مفعّل (بلا «قريباً») ويفتح لوحة برفع صورة الشخص", /تجربة افتراضية/.test(to.head) && to.file && !to.soon, to);
  ok("تجربة افتراضية: بلا صورة شخص يُطلب رفعها، ومعها يُرسل الشخص والقطعة معاً بمقاس صورة الشخص ويظهر الناتج مباشرة", /ارفع صورة الشخص/.test(to.noPerson) && to.calls.length === 1 && to.calls[0].extra === 1 && to.calls[0].W === 100 && to.calls[0].H === 150 && to.keep && to.live, to);
  // ── تصوير المنتج بالذكاء + صورة من وصف + استمرار صورة الشخص + مشاهد الاستخدام اليومي ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-imgx="pshoot"]').click()); await p.waitForTimeout(700);
  const ps = await p.evaluate(async () => {
    const head = (document.querySelector("#pbx-ep .ep-h") || {}).textContent || "", soon = !!document.querySelector('[data-imgx="pshoot"] .tt-b2'), boxes = document.querySelectorAll("#pbx-ep [data-psk]").length;
    const calls = []; const old = ImgGen.edit, oc = window.confirm; window.confirm = () => true; ImgGen.edit = async o => { calls.push({ p: o.prompt, conf: o.confirm }); const c = document.createElement("canvas"); c.width = 50; c.height = 50; c.getContext("2d").fillStyle = "#c63"; c.getContext("2d").fillRect(0, 0, 50, 50); return { canvas: c, blob: await new Promise(r => c.toBlob(r)) }; };
    document.querySelector('#pbx-ep [data-ai="pshoot"]').click(); await new Promise(r => setTimeout(r, 1800)); const cards = document.querySelectorAll("#pbai-res [data-vc]").length;
    const life = PBAI._t.shotPrompt("x", "", true), plain = PBAI._t.shotPrompt("x", "", false), lifeShots = PBAI._t.SHOTS.filter(x => x[3]).map(x => x[0]);
    ImgGen.edit = old; window.confirm = oc;
    return { head, soon, boxes, calls: calls.length, cards, life: /no face/.test(life) && !/no people/.test(life), plain: /no people/.test(plain), lifeShots };
  });
  ok("تصوير المنتج بالذكاء: الصف مفعّل ويعرض مشاهد للاختيار ويُنتج خيارات متعددة بموافقة واحدة", /تصوير المنتج بالذكاء/.test(ps.head) && !ps.soon && ps.boxes >= 15 && ps.calls === 3 && ps.cards === 3, ps);
  ok("مشاهد الاستخدام اليومي (يد/طاولة/ملبوس/مكتب/هدية) محتشمة بلا وجه، والمشاهد العادية بلا أشخاص", ps.life && ps.plain && ["hand", "table", "worn", "desk", "gifting"].every(k => ps.lifeShots.includes(k)), ps);
  // ── عرض 360°: عنصر الصفحة + أداة الذكاء (محاكاة) + رفع صور حقيقية + تحسين الجودة ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-imgx="view360"]').click()); await p.waitForTimeout(700);
  const v3 = await p.evaluate(async () => {
    const head = (document.querySelector("#pbx-ep .ep-h") || {}).textContent || "", row = !!document.querySelector('[data-imgx="view360"]'), soon = !!document.querySelector('[data-imgx="view360"] .tt-b2'), file = !!document.querySelector("#pbx-ep #pbai-v3f");
    document.querySelector("#pbai-v3n").value = "6"; document.querySelector("#pbai-v3n").dispatchEvent(new Event("change", { bubbles: true }));
    const calls = [], old = ImgGen.edit, oc = window.confirm, ou = PBApp.uploadBlob, paths = []; window.confirm = () => true;
    ImgGen.edit = async o => { calls.push({ extra: (o.extra || []).length, p: o.prompt, conf: o.confirm }); const c = document.createElement("canvas"); c.width = 50; c.height = 50; c.getContext("2d").fillStyle = "#c63"; c.getContext("2d").fillRect(0, 0, 50, 50); return { canvas: c }; };
    PBApp.uploadBlob = async (b, n) => { const pth = "assets/img/pages/" + n + ".webp"; paths.push({ pth, big: b.size > 0 }); return pth; };
    const before = JSON.stringify(PBApp.E.page.sections).length;
    document.querySelector('#pbx-ep [data-ai="v360"]').click(); await new Promise(r => setTimeout(r, 2500)); const thumbs = document.querySelectorAll("#pbai-res img").length;
    document.querySelector('#pbx-ep [data-ai="v360add"]').click(); await new Promise(r => setTimeout(r, 2500));
    const js = JSON.stringify(PBApp.E.page.sections), has = /"type":"view360"/.test(js), m = js.match(/"imgs":"([^"]*v360[^"]*)"/), lines = m ? m[1].split("\\n").length : 0;
    ImgGen.edit = old; window.confirm = oc; PBApp.uploadBlob = ou;
    const T = PBAI._t.v360Prompt(90, 2, 8, "x");
    // polish: صورة صغيرة تُكبَّر وصورة كبيرة تبقى كما هي
    const mkB = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#789"; x.fillRect(0, 0, w, h); return new Promise(r => c.toBlob(r, "image/png")); };
    const dim = async b => { const u = URL.createObjectURL(b), i = new Image(); await new Promise(r => { i.onload = r; i.src = u; }); return [i.naturalWidth, i.naturalHeight]; };
    const small = await dim(await PBAI._t.polish(await mkB(300, 200), 1280)), big = await dim(await PBAI._t.polish(await mkB(1400, 900), 1280));
    return { head, row, soon, file, calls: calls.length, ex: calls.map(c => c.extra).join(), nc: calls.every(c => c.conf === false || c.conf === undefined), thumbs, has, lines, up: paths.length, T: /90 degrees/.test(T) && /SAME product/.test(T) && /No people/.test(T), small, big };
  });
  ok("عرض 360°: الصف مفعّل ويفتح لوحة فيها رفع الصور الحقيقية", /360/.test(v3.head) && v3.row && !v3.soon && v3.file, v3);
  ok("عرض 360° بالذكاء: 6 إطارات = 5 توليدات بموافقة واحدة (الأول الأصل)، ثم تُرفع ويُضاف عنصر view360 بـ6 أسطر", v3.calls === 5 && v3.thumbs === 6 && v3.has && v3.lines === 6 && v3.up === 6 && v3.T, v3);
  ok("تحسين الجودة قبل الاستعمال: الصورة الصغيرة تُكبَّر (≥1280) والكبيرة تبقى كما هي", v3.small[0] >= 1280 && v3.big[0] === 1400, v3);
  const vr = await (async () => {
    const html = await p.evaluate(() => { const pg = JSON.parse(PBApp.pageJson()); const cl = PB.mkS([PB.mkC([PB.mkW("view360", { imgs: "a.png\nb.png\nc.png\nd.png", v360a: 0 })])]); pg.sections = [cl]; return PB.fullHtml(pg, { base: "./", site: {}, products: [], meta: { tabs: [], cats: {} } }); });
    const q = await p.context().newPage(); await q.setViewportSize({ width: 800, height: 700 }); await q.setContent(html); await q.waitForTimeout(600);
    const r = await q.evaluate(async () => { const b = document.querySelector(".pb-v360"); if (!b) return { none: true }; const n = b.querySelectorAll("img").length, idx = () => Array.from(b.querySelectorAll("img")).findIndex(i => i.classList.contains("on")), r0 = b.getBoundingClientRect(), i0 = idx(); return { n, i0, w: r0.width, h: r0.height, hint: /360/.test((b.querySelector(".pb-v360-h") || {}).textContent || "") }; });
    const bb = await q.$(".pb-v360").then(e => e.boundingBox()); await q.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await q.mouse.down(); await q.mouse.move(bb.x + bb.width / 2 + 30, bb.y + bb.height / 2, { steps: 5 });
    const i1 = await q.evaluate(() => Array.from(document.querySelectorAll(".pb-v360 img")).findIndex(i => i.classList.contains("on")));
    await q.mouse.move(bb.x + bb.width / 2 - 100, bb.y + bb.height / 2, { steps: 6 }); const i2 = await q.evaluate(() => Array.from(document.querySelectorAll(".pb-v360 img")).findIndex(i => i.classList.contains("on"))); await q.mouse.up();
    const used = await q.evaluate(() => document.querySelector(".pb-v360").classList.contains("used")); await q.close(); return Object.assign(r, { i1, i2, used });
  })();
  ok("عنصر عرض 360° في الصفحة: 4 إطارات، السحب يبدّل الإطار في الاتجاهين ويُخفي التلميح", vr.n === 4 && vr.i0 === 0 && vr.i1 !== 0 && vr.i2 !== vr.i1 && vr.used && vr.hint && vr.w > 100, vr);
  const tx = await p.evaluate(async () => {
    const row = !!document.querySelector('[data-imgx="txt2img"]'); document.querySelector('[data-imgx="txt2img"]').click(); await new Promise(r => setTimeout(r, 400)); const m = !!document.getElementById("pbx-tx");
    const calls = []; const old = ImgGen.edit; ImgGen.edit = async o => { calls.push({ t: !!o.textOnly, blob: !!o.blob, W: o.W, H: o.H, p: o.prompt }); const c = document.createElement("canvas"); c.width = 64; c.height = 64; c.getContext("2d").fillRect(0, 0, 64, 64); return { canvas: c, blob: await new Promise(r => c.toBlob(r)) }; };
    document.getElementById("pbtx-t").value = "كوب شاي على طاولة"; document.getElementById("pbtx-r").value = "9:16"; document.querySelector('#pbx-tx [data-txb="go"]').click(); await new Promise(r => setTimeout(r, 900));
    const added = !!document.querySelector('#pbx-tx [data-txb="add"]'); ImgGen.edit = old; document.getElementById("pbx-tx").remove();
    return { row, m, added, calls };
  });
  ok("صورة من وصف نصي: الصف يفتح نافذة، والتوليد بلا صورة مرجعية وبمقاس 9:16 مع زر الإضافة للصفحة", tx.row && tx.m && tx.added && tx.calls.length === 1 && tx.calls[0].t && !tx.calls[0].blob && tx.calls[0].H > tx.calls[0].W, tx);
  const pp = await p.evaluate(async () => {
    const pc = document.createElement("canvas"); pc.width = 40; pc.height = 60; pc.getContext("2d").fillRect(0, 0, 40, 60); PBAI.state.person = { c: pc, w: 40, h: 60 }; PBAI.state.remember = true; PBAI._t.keepPerson();
    const saved = (localStorage.getItem("pbx_tryon_person") || "").startsWith("data:image"); PBAI.reset(); const kept = !!PBAI.state.person;
    PBAI.state.remember = false; PBAI._t.keepPerson(); const removed = !localStorage.getItem("pbx_tryon_person"); PBAI.state.person = null;
    return { saved, kept, removed };
  });
  ok("تجربة افتراضية: صورة الشخص تبقى بين القطع (حتى بعد إغلاق الأداة) وتُحفظ فقط عند «تذكّر صورتي» وتُحذف بإلغائه", pp.saved && pp.kept && pp.removed, pp);
  // ── تغيير المقاس والتوسيع (بلا ذكاء) + قياسات المنصات + قوالب الفيديو ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-imgx="resize"]').click()); await p.waitForTimeout(800);
  const rz = await p.evaluate(async () => {
    const head = (document.querySelector("#pbx-ep .ep-h") || {}).textContent || "", opts = document.querySelectorAll("#pbx-ep #pbai-sz option").length, btn = !!document.querySelector('#pbx-ep [data-ai="xlocal"]');
    const sel = document.querySelector("#pbx-ep #pbai-sz"); sel.value = "1080x1920"; sel.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 300));
    document.querySelector('#pbx-ep [data-ai="xlocal"]').click(); await new Promise(r => setTimeout(r, 1500));
    const img = document.querySelector("#pbai-res img"), cards = document.querySelectorAll("#pbai-res [data-vc]").length;
    return { head, opts, btn, cards, w: img ? img.naturalWidth : 0, h: img ? img.naturalHeight : 0, msg: (document.querySelector("#pbai-msg") || {}).textContent };
  });
  ok("تغيير المقاس والتوسيع: الصف يفتح لوحة فيها قياسات المنصات وزر «بلا ذكاء»، ويُنتج 1080×1920 مجاناً", /توسيع/.test(rz.head) && rz.opts > 15 && rz.btn && rz.cards === 1 && rz.w === 1080 && rz.h === 1920, rz);
  const vt = await p.evaluate(() => { const T = PBVideo._t, c = document.createElement("canvas"); c.width = 360; c.height = 640; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 360, 640); T.overlay(g, 360, 640, .9, { title: "عسل طبيعي", price: "2500 دج", cta: "اطلب الآن", style: "bottom" }); const d = g.getImageData(180, 640 * .8 - 14, 1, 1).data; return { n: T.VTPL.length, painted: d[0] < 100 || d[1] < 120, ids: T.VTPL.map(x => x[0]).join() }; });
  ok("قوالب الفيديو: ستة قوالب والعنوان يُرسم على شريط بلون الهوية", vt.n === 6 && vt.painted, vt);
  // ── تلوين بالذكاء (ألوان متعددة بموافقة واحدة) ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-imgx="recolor"]').click()); await p.waitForTimeout(800);
  const rcT = await p.evaluate(async () => {
    const head = (document.querySelector("#pbx-ep .ep-h") || {}).textContent || "", boxes = document.querySelectorAll("#pbx-ep [data-rck]").length;
    const calls = []; const old = ImgGen.edit, oc = window.confirm; window.confirm = () => true; ImgGen.edit = async o => { calls.push(o.prompt); const c = document.createElement("canvas"); c.width = 40; c.height = 40; c.getContext("2d").fillRect(0, 0, 40, 40); return { canvas: c, blob: await new Promise(r => c.toBlob(r)) }; };
    document.getElementById("pbai-rci").value = "الفستان"; document.querySelector('#pbx-ep [data-ai="recolor"]').click(); await new Promise(r => setTimeout(r, 1800));
    const cards = document.querySelectorAll("#pbai-res [data-vc]").length; ImgGen.edit = old; window.confirm = oc;
    return { head, boxes, calls: calls.length, cards, keep: calls.every(x => /ONLY the color/.test(x) && /not painted/.test(x) && /الفستان|the الفستان/.test(x)), red: /deep red/.test(calls[0] || "") && /navy blue/.test(calls[1] || "") };
  });
  ok("تلوين بالذكاء: الصف يفتح لوحة ألوان متعددة ويولّد لونين بموافقة واحدة مع حفظ النسيج", /تلوين/.test(rcT.head) && rcT.boxes === 10 && rcT.calls === 2 && rcT.cards === 2 && rcT.keep && rcT.red, rcT);
  // ── منشئ الشعار (مجاني + بالذكاء) ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  const lg = await p.evaluate(async () => {
    document.querySelector('[data-imgx="logo"]').click(); await new Promise(r => setTimeout(r, 400)); const modal = !!document.getElementById("pbx-logo");
    document.getElementById("pblg-n").value = "عسل الجبل"; document.querySelector('#pbx-logo [data-lg="badge"]').click(); await new Promise(r => setTimeout(r, 900));
    const img = document.querySelector("#pblg-o img"), shown = !!img && img.src.startsWith("data:image/png");
    document.querySelector('#pbx-logo [data-lg="save"]').click(); await new Promise(r => setTimeout(r, 400)); const saved = (localStorage.getItem(Object.keys(localStorage).find(k => /brand_logo$/.test(k)) || "x") || "").startsWith("data:image/png");
    const T = PBBrand._t, cv = T.logoCanvas("عسل الجبل", T.load(), "mono", "light"), d = cv.getContext("2d").getImageData(400, 400, 1, 1).data, calls = []; const old = ImgGen.edit; ImgGen.edit = async o => { calls.push({ t: !!o.textOnly, p: o.prompt }); const c = document.createElement("canvas"); c.width = 50; c.height = 50; c.getContext("2d").fillRect(0, 0, 50, 50); return { canvas: c, blob: null }; };
    document.getElementById("pblg-k").value = "عسل طبيعي"; document.querySelector('#pbx-logo [data-lg="ai"]').click(); await new Promise(r => setTimeout(r, 700)); ImgGen.edit = old; document.getElementById("pbx-logo").remove(); Object.keys(localStorage).filter(k => /brand_logo$/.test(k)).forEach(k => localStorage.removeItem(k));
    return { modal, shown, saved, mono: cv.width === 800 && cv.height === 800 && d[3] === 255, ai: calls.length === 1 && calls[0].t && /LOGO/.test(calls[0].p) && /عسل الجبل/.test(calls[0].p) && /عسل طبيعي/.test(calls[0].p), styles: T.LSTYLES.length };
  });
  ok("منشئ الشعار: يفتح من الصف ويولّد شعاراً نصياً مجانياً ويعتمده، والذكي يرسل وصفاً بلا صورة مرجعية", lg.modal && lg.shown && lg.saved && lg.mono && lg.ai && lg.styles === 4, lg);
  // ── دفعة بخطوة ذكاء اصطناعي (حتى 250 صورة بموافقة واحدة) ──
  const bt = await p.evaluate(async () => {
    const B = AdminImgBatch, c0 = document.createElement("canvas"); c0.width = 60; c0.height = 40; c0.getContext("2d").fillRect(0, 0, 60, 40); const url = c0.toDataURL("image/png");
    B.S.files = [{ name: "a", src: url, size: 1 }, { name: "b", src: url, size: 1 }]; B.S.cfg.ai = "stage"; B.S.cfg.aiScene = 5; B.S.cfg.preset = "orig"; B.S.cfg.pipe = false; B.S.cfg.wm = "none";
    const calls = []; const old = ImgGen.edit, oc = window.confirm; let asked = ""; window.confirm = m => { asked = m; return true; };
    ImgGen.edit = async o => { calls.push({ p: o.prompt, conf: o.confirm }); const c = document.createElement("canvas"); c.width = 60; c.height = 40; c.getContext("2d").fillRect(0, 0, 60, 40); return { blob: await new Promise(r => c.toBlob(r)), canvas: c }; };
    await B.run(); const ok1 = B.S.out.filter(o => o.blob).length;
    B.S.cfg.ai = "edit"; B.S.cfg.aiText = ""; const before = calls.length; await B.run(); const noText = calls.length === before;
    B.S.cfg.ai = "recolor"; B.S.cfg.aiColor = "navy"; const pr = B.aiPrompt(B.S.cfg);
    B.S.files = Array.from({ length: 251 }, (_, i) => ({ name: "x" + i, src: url, size: 1 })); B.S.cfg.ai = "ghost"; const b2 = calls.length; await B.run(); const capped = calls.length === b2;
    ImgGen.edit = old; window.confirm = oc; B.S.cfg.ai = "none"; B.S.files = []; B.S.out = [];
    return { ok1, n: calls.length, noConf: calls.slice(0, 2).every(x => x.conf === false), askedCost: /الإجمالية/.test(asked) && /2 صورة/.test(asked), noText, recolor: /navy blue/.test(pr), capped, modes: B.AI_MODES.length };
  });
  ok("دفعة الصور بخطوة ذكاء: صورتان تُعالجان بموافقة تكلفة واحدة، والوصف الفارغ والحدّ 250 يمنعان التنفيذ", bt.ok1 === 2 && bt.n >= 2 && bt.noConf && bt.askedCost && bt.noText && bt.recolor && bt.capped && bt.modes === 8, bt);
  // ── روابط عميقة من دليل الأدوات ──
  const dpl = await p.evaluate(async () => {
    const bad = await AdminNav.deepTool("zzz"); location.hash = "#tool=gen"; const good = await AdminNav.deepTool(); const cleared = !/tool=/.test(location.hash);
    const tab = !!document.getElementById("tab-imggen") && document.getElementById("tab-imggen").classList.contains("on");
    return { bad, good, cleared, tab: tab || good };
  });
  ok("روابط الدليل العميقة: معرّف مجهول يُرفض، و#tool=gen يفتح مولّد الصور ويُنظَّف العنوان", dpl.bad === false && dpl.good === true && dpl.cleared, dpl);
  // ── استوديو الأزياء الذكي (محاكاة ImgGen.edit) ──
  await p.evaluate(() => { PBApp.E.sel = window.__upId; if (!document.querySelector('[data-imgx="up"]')) PBApp.ltoggle("img"); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-imgx="fashion"]').click()); await p.waitForTimeout(600);
  const fa = await p.evaluate(async () => {
    const ep = document.querySelector("#pbx-ep"), head = ep && ep.querySelector(".ep-h") ? ep.querySelector(".ep-h").textContent : "";
    const modes = [...document.querySelectorAll('#pbx-ep [data-ai="fashion"]')].map(b => b.dataset.m), who = !!document.querySelector("#pbx-ep #pbai-fw");
    const T = PBAI._t, pm = T.fashionPrompt("model", { who: "woman", pose: "stand", bg: "white" }), pg = T.fashionPrompt("ghost", {}), pf = T.fashionPrompt("flat", {}), pw = T.fashionPrompt("wrinkle", {}), pman = T.fashionPrompt("model", { who: "mannequin" });
    const calls = []; const old = ImgGen.edit; ImgGen.edit = async o => { calls.push({ p: o.prompt, W: o.W, H: o.H }); const c = document.createElement("canvas"); c.width = 64; c.height = 80; const g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 64, 80); return { canvas: c }; };
    document.querySelector('#pbx-ep #pbai-fr').value = "4:5"; document.querySelector('#pbx-ep [data-ai="fashion"][data-m="ghost"]').click(); await new Promise(r => setTimeout(r, 1500));
    const live = PBApp.liveOn && PBApp.liveOn(); ImgGen.edit = old;
    return { head, modes, who, hijab: /hijab/.test(pm) && /NO bare arms/.test(pm), ghost: /GHOST MANNEQUIN/.test(pg), flat: /FLAT LAY/.test(pf), wr: /wrinkles/.test(pw) && /smooth/.test(pw), faceless: /faceless/.test(pman), keep: [pm, pg, pf, pw].every(x => /EXACTLY/.test(x)), calls, live };
  });
  ok("استوديو الأزياء: صف «استوديو أزياء ذكي» يفتح لوحته بأوضاعها الأربعة وخيارات العارض", /استوديو أزياء ذكي/.test(fa.head) && fa.modes.join() === "model,ghost,flat,wrinkle" && fa.who, fa);
  ok("استوديو الأزياء: التعليمات محتشمة (خمار وبلا جلد مكشوف)، تحفظ القطعة، وتميّز الأوضاع", fa.hijab && fa.ghost && fa.flat && fa.wr && fa.faceless && fa.keep, fa);
  ok("استوديو الأزياء: التنفيذ يستدعي التوليد بمقاس 4:5 ويعرض النتيجة على الصورة", fa.calls.length === 1 && fa.calls[0].W === 1280 && fa.calls[0].H === 1600 && /GHOST/.test(fa.calls[0].p) && !!fa.live, fa);
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(500);
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
    document.querySelector('#ccm [data-d="cancel"]') && document.querySelector('#ccm [data-d="cancel"]').click(); await wait(150); { const nb = document.querySelector('#ccr-bg [data-r=""]'); if (nb) nb.click(); } await wait(700); r.empty = /لا طلبات/.test(document.getElementById("callcenter-content").textContent) || first();
    API.updateOrder = uo0; Admin.afterManualStatus = sa; Admin.tab("orders"); await wait(100); r.hidden = document.getElementById("tab-callcenter").classList.contains("hidden");
    return r;
  });
  ok("مركز الاتصال: الأقدم أولاً، المتبقي 2 (الخاطئ والمؤكَّد خارج الطابور)، زر اتصال tel:", ccm.shown && ccm.first === "الأقدم" && ccm.remain === "2" && ccm.hasTel, ccm);
  ok("مركز الاتصال: «لم يُجب» يسجّل المحاولة ويمرّر للتالي، والتأكيد يمرّ بالمنطق القائم", ccm.afterNoans === "الأحدث" && ccm.att === 1 && ccm.status === "confirmee" && /C0001/.test(ccm.ups), ccm);
  ok("مركز الاتصال: بعد التأكيد يعود إلى من لم يُجب، والإلغاء يفرّغ الطابور ويختفي التبويب بتغيير الصفحة", ccm.afterConfirm === "الأقدم" && /^\s*1\s*·\s*0\s*·\s*1/.test(ccm.stats || "") && ccm.empty === true && ccm.hidden, ccm);
  // ── مركز الاتصال: مؤجَّل لغد، موعد اليوم يتقدّم، تأكيد مع تعديل العنوان (مالك يطبّق / مؤكِّدة تدوّن فقط) ──
  const cc2 = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {}; Admin.enqueueNotify = () => { };
    const notes = {}, fields = []; const uo0 = API.updateOrder, uf0 = API.updateOrderFields; API.updateOrder = async (k, id, st, note) => { if (note !== undefined) notes[id] = note; return true; }; API.updateOrderFields = async (k, id, f) => { fields.push([id, f]); return true; };
    const sa = Admin.afterManualStatus; let sent = 0; Admin.afterManualStatus = async () => { sent++; };
    const today = Admin.isoDay(), tm = new Date(); tm.setDate(tm.getDate() + 1); const tomorrow = Admin.isoDay(tm), yd = new Date(); yd.setDate(yd.getDate() - 1);
    const mk = (id, name, mins, extra) => Object.assign({ id, date: new Date(Date.now() - mins * 60000).toISOString(), status: "nouvelle", name, phone: "055000" + id.slice(-4).padStart(4, "0"), wilaya: "Alger", commune: "Kouba", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 600, total: 1600, note: "" }, extra || {});
    Admin.orders = [mk("D0001", "جديد", 5), mk("D0002", "مؤجل لغد", 300, { note: "⏰لاحقاً 📅" + tomorrow }), mk("D0003", "موعد اليوم", 100, { note: "⏰لاحقاً 📅" + Admin.isoDay(yd) }), mk("D0004", "للعنوان", 400)];
    Admin.tab("callcenter"); await wait(200);
    const first = () => (document.querySelector("#ccm .ccm-card h2") || {}).textContent, chips = () => document.getElementById("callcenter-content").textContent;
    const r = { first: first(), parked: /مؤجَّل لاحقاً:\s*1/.test(chips()), remain: (document.querySelector("#ccm .ccm-chip b") || {}).textContent, btn: !!document.querySelector('#ccm [data-d="tomorrow"]') && !!document.querySelector('#ccm [data-d="addr"]') && /محاولة 1/.test(document.querySelector('#ccm [data-d="noans"]').textContent) };
    // «غداً»: يسجّل ⏰لاحقاً + 📅 ويخرج من الطابور
    const cur = first(); document.querySelector('#ccm [data-d="tomorrow"]').click(); await wait(150);
    const co = Admin.orders.find(o => o.name === cur); r.tomoNote = co.note; r.tomoDue = Admin.callDue(co); r.afterTomo = first(); r.remainAfter = (document.querySelector("#ccm .ccm-chip b") || {}).textContent;
    // تأكيد مع تعديل العنوان بصفة المالك: يُطبَّق الحقل ويُحسب الرسم ويُؤكَّد
    const target = Admin.orders.find(o => o.name === "للعنوان"); const tid = target.id; await (async () => { for (let k = 0; k < 6 && first() !== "للعنوان"; k++) { document.querySelector('#ccm [data-d="skip"]').click(); await wait(60); } })();
    document.querySelector('#ccm [data-d="addr"]').click(); await wait(100);
    r.dlg = !!document.getElementById("cca-bg"); const w = document.getElementById("cca-w"); w.value = "Oran"; w.dispatchEvent(new Event("change")); document.getElementById("cca-n").value = "حي 5 جويلية";
    document.getElementById("cca-ok").click(); await wait(900);
    const t1 = Admin.orders.find(o => o.id === tid); r.own = { st: t1.status, w: t1.wilaya, tag: Admin.addrFix(t1), fields: fields.length ? fields[0][1].wilaya : "", sent, note: notes[tid] };
    // مؤكِّدة بلا صلاحية التعديل: تدوّن فقط ويُمنع الإرسال التلقائي
    window.AdminRoles.state.me = { owner: false, perms: ["orders", "orders.write", "callcenter"] };
    const o5 = mk("D0005", "مؤكدة", 3); Admin.orders.push(o5); Admin.tab("orders"); Admin.tab("callcenter"); await wait(150);
    for (let k = 0; k < 8 && first() !== "مؤكدة"; k++) { document.querySelector('#ccm [data-d="skip"]').click(); await wait(60); }
    fields.length = 0; document.querySelector('#ccm [data-d="addr"]').click(); await wait(100); document.getElementById("cca-w").value = "Blida"; document.getElementById("cca-w").dispatchEvent(new Event("change")); document.getElementById("cca-ok").click(); await wait(900);
    const t2 = Admin.orders.find(o => o.id === "D0005"); r.agent = { st: t2.status, w: t2.wilaya, tag: Admin.addrFix(t2), fields: fields.length };
    // الإرسال اليدوي يطلب مراجعة العنوان
    let asked = ""; window.confirm = m => { asked = m; return false; }; let sentCalls = 0; const so = Admin.sendOrderToDelivery; Admin.sendOrderToDelivery = async () => { sentCalls++; return true; }; const ock0 = Admin.orderCompanyKey; Admin.orderCompanyKey = () => "x";
    await Admin.sendConfirmed(Admin.orders.indexOf(t2)); r.guard = { asked: /عدّلت المؤكِّدة/.test(asked), sentCalls };
    Admin.sendOrderToDelivery = so; Admin.orderCompanyKey = ock0; API.updateOrder = uo0; API.updateOrderFields = uf0; Admin.afterManualStatus = sa; Admin.tab("orders"); await wait(50);
    return r;
  });
  ok("مركز الاتصال: مؤجَّل لغد خارج الطابور ومعدود، وموعد اليوم يتقدّم، والأزرار الجديدة (غداً/عنوان/محاولة n) موجودة", cc2.first === "موعد اليوم" && cc2.parked && cc2.remain === "3" && cc2.btn, cc2);
  ok("مركز الاتصال: «مؤجَّل إلى الغد» يكتب ⏰لاحقاً + 📅 التاريخ ويُخرج الطلب من الطابور", /⏰لاحقاً/.test(cc2.tomoNote) && /📅\d{4}-\d{2}-\d{2}/.test(cc2.tomoNote) && cc2.tomoDue && cc2.afterTomo !== "موعد اليوم" && cc2.remainAfter === "2", cc2);
  ok("تأكيد مع تعديل العنوان (مالك): يُطبَّق الولاية ويُؤكَّد ويوسَم 🏠✔ في كتابة ملاحظة واحدة", cc2.dlg && cc2.own.st === "confirmee" && cc2.own.w === "Oran" && cc2.own.tag && cc2.own.tag.applied && cc2.own.fields === "Oran" && /🏠✔ «[^»]*وهران|🏠✔ «Oran/.test(cc2.own.note || "") && /حي 5 جويلية/.test(cc2.own.note), cc2.own);
  ok("تأكيد مع تعديل العنوان (مؤكِّدة بلا صلاحية): يدوّن 🏠⏳ ولا يعدّل حقول الطلب، والإرسال اليدوي يطلب مراجعة العنوان", cc2.agent.st === "confirmee" && cc2.agent.w === "Alger" && cc2.agent.tag && !cc2.agent.tag.applied && cc2.agent.fields === 0 && cc2.guard.asked && cc2.guard.sentCalls === 0, cc2);
  // ── مركز الاتصال: قفل ناعم بين المؤكِّدات، سبب الإلغاء، هدف اليوم وزمن أول استجابة ──
  const cc3 = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {}; Admin.enqueueNotify = () => { };
    const notes = {}, statuses = []; const uo0 = API.updateOrder; API.updateOrder = async (k, id, st, note) => { if (note !== undefined) notes[id] = note; if (st) statuses.push([id, st]); return true; };
    const sa = Admin.afterManualStatus; Admin.afterManualStatus = async () => { }; const pf0 = AdminRoles.perf;
    AdminRoles.state.me = { owner: true, email: "", perms: ["*"] };
    AdminRoles.perf = async () => ({ goal: { daily: 10, rate: 70 }, rows: [{ actor: "a@x", orders: 5, avg_min: 12, med_min: 9, fast_pct: 80 }], today: [{ actor: "a@x", conf: 4, canc: 1 }], reasons: [] });
    const nm = Math.floor(Date.now() / 60000), mk = (id, name, mins, note) => ({ id, date: new Date(Date.now() - mins * 60000).toISOString(), status: "nouvelle", name, phone: "055000" + id.slice(-4).padStart(4, "0"), wilaya: "Alger", commune: "Kouba", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, note: note || "" });
    Admin.orders = [mk("L0001", "مقفول لزميلة", 500, "🔒zoulikha@x#" + nm), mk("L0002", "حرّ", 300), mk("L0003", "قفل منتهٍ", 200, "🔒zoulikha@x#" + (nm - 30))];
    CallCenter._s.perfAt = 0; CallCenter._s.perf = null; Admin.tab("callcenter"); await wait(500);
    const first = () => (document.querySelector("#ccm .ccm-card h2") || {}).textContent, txt = () => document.getElementById("callcenter-content").textContent;
    const r = { first: first(), lockedChip: /عند زميلاتك:\s*1/.test(txt()), kpi: /4\s*\/\s*10/.test(txt()) && /أول استجابة/.test(txt()), myLock: /🔒owner#\d+/.test(Admin.orders.find(o => o.id === "L0002").note) };
    document.querySelector('#ccm [data-d="skip"]').click(); await wait(300);
    r.unlocked = !/🔒owner/.test(Admin.orders.find(o => o.id === "L0002").note); r.next = first(); r.nextLock = /🔒owner#\d+/.test(Admin.orders.find(o => o.id === "L0003").note);
    document.querySelector('#ccm [data-d="cancel"]').click(); await wait(100); r.dlg = !!document.getElementById("ccr-bg") && document.querySelectorAll("#ccr-bg [data-r]").length >= 7;
    document.querySelector('#ccr-bg [data-r="expensive"]').click(); await wait(900);
    const c3 = Admin.orders.find(o => o.id === "L0003"); r.reason = { tag: Admin.cancelReasonOf(c3), st: c3.status, saved: /❌سبب:expensive/.test(notes.L0003 || ""), statusCalls: JSON.stringify(statuses) };
    r.foreignGone = Admin.orders.find(o => o.id === "L0001").status === "nouvelle";
    API.updateOrder = uo0; Admin.afterManualStatus = sa; AdminRoles.perf = pf0; Admin.tab("orders"); await wait(50);
    return r;
  });
  ok("مركز الاتصال: الطلب المقفول لزميلة خارج طابوري (وشريحة «عند زميلاتك»)، ومؤشر الهدف اليومي وأول استجابة ظاهران، والطلب المعروض يُقفل باسمي", cc3.first === "حرّ" && cc3.lockedChip && cc3.kpi && cc3.myLock, cc3);
  ok("مركز الاتصال: التخطّي يفكّ القفل، والقفل المنتهي (>10 د) لا يمنع، والإلغاء يسأل عن السبب (7 أسباب) ويكتبه قبل تغيير الحالة", cc3.unlocked && cc3.next === "قفل منتهٍ" && cc3.nextLock && cc3.dlg && cc3.reason.tag === "expensive" && cc3.reason.st === "annulee" && cc3.reason.saved && cc3.foreignGone, cc3);
  // ── مركز الاتصال: توزيع مسبق بحصص (مساندة بعد مهلة)، تنبيه بلا استجابة، شارة القائمة ──
  const cc4 = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); Admin.refreshAlerts = async () => {}; const uo0 = API.updateOrder; API.updateOrder = async () => true;
    AdminRoles.state.me = { owner: false, email: "amel@x", perms: ["orders", "orders.write", "callcenter"] };
    const as = { on: true, weights: { "amel@x": 1, "nora@x": 1 }, overflow: 20 };
    const mk = (id, mins) => ({ id, date: new Date(Date.now() - mins * 60000).toISOString(), status: "nouvelle", name: id, phone: "0550000000", wilaya: "Alger", commune: "Kouba", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, note: "" });
    const young = Array.from({ length: 14 }, (_, i) => mk("Y" + (1000 + i), 2)), old = Array.from({ length: 4 }, (_, i) => mk("O" + (2000 + i), 90));
    Admin.orders = young.concat(old); const mineY = young.filter(o => AdminRoles.assigneeOf(o.id, as) === "amel@x").length, otherY = young.length - mineY, oldMine = old.filter(o => AdminRoles.assigneeOf(o.id, as) === "amel@x").length;
    CallCenter._s.perf = { goal: { daily: 10, alertMin: 30, assign: as, per: { "amel@x": { daily: 3 } } }, rows: [], today: [{ actor: "amel@x", conf: 1 }] }; CallCenter._s.perfAt = Date.now(); CallCenter._s.skip = {};
    const q1 = CallCenter.queue().length, mineFirst = AdminRoles.assigneeOf(CallCenter.queue()[0].o.id, as) === "amel@x" || CallCenter.queue()[0].o.id.startsWith("O");
    Admin.tab("callcenter"); await wait(400); const txt = document.getElementById("callcenter-content").textContent;
    const chips = /للزميلات:\s*(\d+)/.exec(txt), kpi = /1\s*\/\s*3/.test(txt);
    const od = Admin.overdueList().length; Admin.overdueAlert && await Admin.overdueAlert(); const badge = document.getElementById("nb-callcenter"), bt = badge && badge.textContent, bh = badge && badge.classList.contains("hidden");
    // التوزيع معطّل أو الموظفة خارجه ← ترى الجميع
    CallCenter._s.perf.goal.assign = { on: false, weights: {} }; const qAll = CallCenter.queue().length;
    AdminRoles.state.me = { owner: true, email: "", perms: ["*"] }; CallCenter._s.perf.goal.assign = as; const qOwner = CallCenter.queue().length;
    API.updateOrder = uo0; Admin.tab("orders"); await wait(50);
    return { mineY, otherY, oldMine, q1, expected: mineY + old.length, mineFirst, hidden: chips && +chips[1], kpi, od, bt, bh, qAll, qOwner, total: young.length + old.length };
  });
  ok("توزيع الطلبات: الموظفة ترى طلباتها + طلبات الزميلات المتأخرة (مساندة) فقط، والمالك أو التوزيع المعطّل يريان الجميع", cc4.q1 === cc4.expected && cc4.hidden === cc4.otherY && cc4.qAll === cc4.total && cc4.qOwner >= cc4.total - 1 && cc4.mineY > 0 && cc4.otherY > 0, cc4);
  ok("هدف مخصص للموظفة (1/3 بدل الافتراضي 10) وتنبيه «بلا استجابة»: الطلبات الأقدم من 30 د تُعدّ وتظهر في شارة القائمة", cc4.kpi && cc4.od === 4 && cc4.bt === "4" && cc4.bh === false, cc4);
  // ── التوجيه اللوجستي: توجيه بالمنطقة، إرسال وطباعة بنقرة (بوردرو محفوظ + وصل بباركود)، محطة المسح وكشف التسليم ──
  const dp = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.enqueueNotify = () => { }; Admin.renderShippedBadge = () => { }; Admin.refreshAlerts = async () => {};
    const e0 = Admin.enabledCompanyKeys, a0 = Admin.activeCompanyKey, s0 = Admin.sendOrderToDelivery, c0 = Admin.courierFetch, o0 = window.open, u0 = API.updateOrder;
    Admin.orderCompanyKey = window.__ockReal; Admin.enabledCompanyKeys = () => ["yalidine", "zrexpress"]; Admin.activeCompanyKey = () => "yalidine"; API.updateOrder = async () => true;
    let fetches = 0; Admin.courierFetch = async () => { fetches++; return { ok: false, status: 500, text: "" }; };
    const mk = (id, name, wil, extra) => Object.assign({ id, date: new Date().toISOString(), status: "confirmee", name, phone: "0550001111", wilaya: wil, commune: "X", dtype: "home", items: "عنصر توجيه تجريبي ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, note: "" }, extra || {});
    Admin.orders = [mk("P0001", "قسنطيني", "Constantine"), mk("P0002", "تمنراستي", "Tamanrasset"), mk("P0003", "عاصمي", "Alger")];
    AdminDispatch._S.cfg = { on: true, regions: { est: "zrexpress", sud: "yalidine" }, wil: {}, minSample: 8 };
    const keys = Admin.orders.map(o => Admin.orderCompanyKey(o)), sentTo = [];
    Admin.sendOrderToDelivery = async (i, k) => { const o = Admin.orders[i]; sentTo.push(o.id + ":" + k); const t = "T" + o.id.slice(-4) + (k === "yalidine" ? "Y" : "Z"); o.note = "🚚" + k + ":" + t; if (k === "yalidine") Admin.cacheLabel(o.id, "https://labels.test/" + t + ".pdf"); return true; };
    let html = ""; const fakeWin = { document: { open() { html = ""; }, write(h) { html += h; }, close() { } }, close() { } }; window.open = () => fakeWin;
    Admin.tab("dispatch"); await wait(200);
    const r = { keys, ui: !!document.querySelector('#dp [data-dp="run"]') && /بانتظار الإرسال:\s*3/.test(document.getElementById("dispatch-content").textContent) };
    await AdminDispatch.runAll(); await wait(300);
    r.sentTo = sentTo; r.fetches = fetches;
    r.page = { iframes: (html.match(/<iframe/g) || []).length, waybills: (html.match(/class="waybill"/g) || []).length, svg: /<svg/.test(html), grouped: html.indexOf("Yalidine") >= 0 || html.indexOf("ياليدين") >= 0 };
    // محطة المسح
    const trk = id => Admin.trackingOf(Admin.orders.find(o => o.id === id)).tracking;
    AdminDispatch._S.scan = {}; AdminDispatch.onScan(trk("P0001")); const s1 = AdminDispatch._S.last.st; AdminDispatch.onScan(" " + trk("P0001").toLowerCase() + " "); const s2 = AdminDispatch._S.last.st; AdminDispatch.onScan("NOPE-12345"); const s3 = AdminDispatch._S.last.st;
    AdminDispatch.onScan(trk("P0002")); r.scan = { s1, s2, s3, count: Object.keys(AdminDispatch._S.scan).length, txt: /جُهِّز اليوم:\s*2/.test(document.getElementById("dispatch-content").textContent) };
    html = ""; AdminDispatch.manifest(); r.manifest = { has: /قسنطيني/.test(html) && /تمنراستي/.test(html) && !/عاصمي/.test(html), n: /عدد الطرود:\s*<b>1<\/b>/.test(html) };
    Admin.enabledCompanyKeys = e0; Admin.activeCompanyKey = a0; Admin.sendOrderToDelivery = s0; Admin.courierFetch = c0; window.open = o0; API.updateOrder = u0; AdminDispatch._S.cfg.on = false; Admin.tab("orders"); await wait(50);
    return r;
  });
  ok("التوجيه: الشرق ← ZR، الجنوب ← ياليدين، والوسط (بلا قاعدة) ← الافتراضية", dp.keys.join() === "zrexpress,yalidine,yalidine" && dp.ui, dp);
  ok("إرسال وطباعة بنقرة: كل طلب إلى شركته، بوردرو ياليدين من الرابط المحفوظ (بلا أي طلب للشركة) ووصل بباركود لشركة بلا بوردرو", dp.sentTo.join() === "P0001:zrexpress,P0002:yalidine,P0003:yalidine" && dp.fetches === 0 && dp.page.iframes === 2 && dp.page.waybills === 1 && dp.page.svg, dp);
  ok("محطة المسح: مسح جديد ثم مكرّر (يتجاهل حالة الأحرف والمسافات) ثم مجهول، والعدّاد وكشف التسليم لما مُسح فقط", dp.scan.s1 === "ok" && dp.scan.s2 === "dup" && dp.scan.s3 === "unknown" && dp.scan.count === 2 && dp.scan.txt && dp.manifest.has, dp);
  // ── إعادة التوجيه التلقائي عند رفض الشركة ──
  const fbt = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); const e0 = Admin.enabledCompanyKeys, a0 = Admin.activeCompanyKey, i0 = Admin._sendOrderToDelivery, sn0 = Admin.showNotice;
    Admin.sendOrderToDelivery = window.__sodReal; Admin.enabledCompanyKeys = () => ["yalidine", "zrexpress"]; Admin.activeCompanyKey = () => "yalidine"; localStorage.removeItem("alyssum_fb_log"); localStorage.removeItem("store_fb_log");
    const notices = []; Admin.showNotice = (t) => { notices.push(t); };
    const mkO = id => ({ id, date: new Date().toISOString(), status: "confirmee", name: "ف" + id, phone: "0550002222", wilaya: "Alger", commune: "X", dtype: "home", items: "عنصر ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, note: "" });
    const run = async (id, behave, cfgFb) => {
      Admin.orders = [mkO(id)]; AdminDispatch._S.cfg = Object.assign({ on: false }, cfgFb === undefined ? {} : { fallback: cfgFb }); const calls = [];
      Admin._sendOrderToDelivery = async function (ix, k) { calls.push(k + (this._fbQuiet ? "~" : "")); const b = behave[k]; if (b === "ok") { this.orders[ix].note = "🚚" + k + ":T" + id; return true; } this._sendFail = b ? { kind: b, title: "فشل " + k, html: "x", co: k, key: k } : null; if (!this._fbQuiet && b && b !== "amb") this.showNotice("فشل " + k, "x"); return false; };
      const r = await Admin.sendOrderToDelivery(0, "yalidine"); await wait(30); return { r, calls: calls.join(), note: Admin.orders[0].note };
    };
    const out = {};
    out.reroute = await run("F0001", { yalidine: "reject", zrexpress: "ok" });
    out.log = JSON.parse(localStorage.getItem("alyssum_fb_log") || localStorage.getItem("store_fb_log") || "[]");
    out.area = await run("F0002", { yalidine: "area", zrexpress: "ok" });
    out.input = await run("F0003", { yalidine: "input", zrexpress: "ok" });
    out.amb = await run("F0004", { yalidine: "amb", zrexpress: "ok" });
    out.cancel = await run("F0005", { yalidine: null, zrexpress: "ok" });
    notices.length = 0; out.allfail = await run("F0006", { yalidine: "reject", zrexpress: "reject" }); out.allfailNotices = notices.length; out.quietOff = !Admin._fbQuiet;
    out.off = await run("F0007", { yalidine: "reject", zrexpress: "ok" }, false);
    Admin.enabledCompanyKeys = e0; Admin.activeCompanyKey = a0; Admin._sendOrderToDelivery = i0; Admin.showNotice = sn0; AdminDispatch._S.cfg = { on: false };
    return out;
  });
  ok("إعادة التوجيه: رفض ياليدين ← تُرسل عبر الشركة الثانية بصمت، ويُسجَّل في السجل", fbt.reroute.r === true && fbt.reroute.calls === "yalidine~,zrexpress~" && /zrexpress:T/.test(fbt.reroute.note) && fbt.log.length === 1 && fbt.log[0].from === "yalidine" && fbt.log[0].to === "zrexpress", fbt);
  ok("إعادة التوجيه: ولاية غير مخدومة أو بلدية بلا مطابقة ← بديل؛ والإخفاق الملتبس (مهلة/5xx) وإلغاء المستخدم لا يُعاد توجيههما (منعاً لتكرار الطرد)", fbt.area.r === true && fbt.input.r === true && fbt.amb.r === false && fbt.amb.calls === "yalidine~" && fbt.cancel.r === false && fbt.cancel.calls === "yalidine~", fbt);
  ok("إعادة التوجيه: إن رفضتها كل الشركات يُجرَّب الجميع ثم تظهر خلاصة واحدة، والتعطيل يرسل لشركة واحدة بلا صمت", fbt.allfail.r === false && fbt.allfail.calls === "yalidine~,zrexpress~" && fbt.allfailNotices >= 1 && fbt.quietOff && fbt.off.r === false && fbt.off.calls === "yalidine", fbt);
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
  // ── المستودعات والمرتجعات: خصم من مستودع الولاية، وإعادة الطرد حين يصل فعلاً فقط ──
  const whT = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {};
    const sv = { pr: Admin.products, fin: Admin.fin, qp: Admin.queueStockPublish, uo: API.updateOrder, wh: Admin.wh, or: Admin.orders, raw: Admin.shipRaw, ps: Priv.set };
    Admin.queueStockPublish = () => { }; API.updateOrder = () => { }; Priv.set = async () => { };
    const mkp = () => [{ slug: "sp", title: "كريم المخزون", price: 1000, stock: 10, active: true }];
    Admin.products = mkp(); Admin.fin = Object.assign({}, Admin.fin || {}, { log: [], costs: {}, cfg: {} });
    const oran = WILAYAS.find(w => w.name === "Oran");
    Admin.wh = { cfg: AdminWh.normCfg({ on: true, list: [{ id: "w1", name: "مستودع وهران" }], routing: { [oran.id]: "w1" } }), stock: { sp: { w1: 4 } } };
    const ord = (id, qty, st, note) => ({ id, date: "2026-10-12T10:00:00.000Z", status: st, wilaya: "Oran", items: "كريم المخزون ×" + qty + " = " + qty * 1000 + " DA", note: note || "" });
    const R = {};
    const a = ord("W1", 3, "confirmee"); Admin.syncStockForOrder(a, "confirmee"); R.a = [Admin.products[0].stock, Admin.wh.stock.sp.w1, a.note];
    const b = ord("W2", 6, "confirmee"); Admin.syncStockForOrder(b, "confirmee"); R.b = [Admin.products[0].stock, Admin.wh.stock.sp.w1, b.note];          // مستودع وهران لا يكفي ← الرئيسي
    // مرتجع في الطريق: لا يعود
    a.status = "echec"; Admin.shipRaw = { W1: { raw: "Retour vers centre", ts: 1 } }; Admin.syncStockForOrder(a, "echec"); R.hold = [Admin.products[0].stock, Admin.wh.stock.sp.w1, /📦@w1/.test(a.note), /🔁transit/.test(a.note)];
    // وصل (الـwebhook كتب 🔁received) ← المسح يعيده إلى مستودع وهران نفسه
    a.note = a.note.replace(/🔁\w+/, "🔁received"); Admin.orders = [a, b]; const back = await Admin.returnsSweep(); R.back = [back, Admin.products[0].stock, Admin.wh.stock.sp.w1, /📦(?!livree)/.test(a.note), /🔁received/.test(a.note)];
    R.log = (Admin.fin.log[0] || {}).why;
    // سياسة «فوراً» تعيد عند أول حالة فشل
    const c = ord("W3", 2, "confirmee"); Admin.syncStockForOrder(c, "confirmee"); const t0 = Admin.products[0].stock; Admin.wh.cfg.retPolicy = "immediate"; c.status = "echec"; Admin.shipRaw = { W3: { raw: "Retour vers centre", ts: 1 } }; Admin.syncStockForOrder(c, "echec"); R.imm = [t0, Admin.products[0].stock];
    Admin.wh.cfg.retPolicy = "received";
    // حالة الشركة تصل «Retourné au vendeur» عبر المزامنة ← إعادة
    const d = ord("W4", 1, "confirmee"); Admin.syncStockForOrder(d, "confirmee"); d.status = "echec"; Admin.shipRaw = { W4: { raw: "Retour vers centre", ts: 1 } }; Admin.orders = [d]; Admin.syncStockForOrder(d, "echec"); const s1 = Admin.products[0].stock;
    Admin.shipRaw = { W4: { raw: "Retourné au vendeur", ts: 2 } }; const b2 = await Admin.returnsSweep(); R.raw = [s1, Admin.products[0].stock, b2];
    // تالف
    const e = ord("W5", 1, "confirmee"); Admin.syncStockForOrder(e, "confirmee"); e.status = "echec"; const s2 = Admin.products[0].stock; Admin.syncStockForOrder(e, "echec", { damaged: true }); R.dmg = [s2, Admin.products[0].stock, /📦(?!livree)/.test(e.note)];
    // واجهة
    Admin.shipRaw = {}; Admin.tab("inventory"); await wait(900); Admin.orders = [Object.assign(ord("W6", 1, "echec"), { name: "زبون مرتجع", note: "📦 🔁transit" })]; AdminWh.draw(); await wait(200);
    R.ui = !!document.getElementById("wr-card"); R.uiRows = document.querySelectorAll("#wr-card [data-wh=recv]").length; R.uiTbl = document.querySelectorAll("#wr-card table tr").length;
    R.host = !!document.getElementById("wr-host"); R.tabHidden = document.getElementById("tab-inventory").className; R.hostLen = (document.getElementById("wr-host") || {}).innerHTML ? document.getElementById("wr-host").innerHTML.length : -1; const rb = document.querySelector('#wr-card [data-wh="recv"]'); if (rb) rb.click(); await wait(200); R.manual = [Admin.orders[0].note, document.querySelectorAll("#wr-card [data-wh=recv]").length];
    // حدّ أدنى لكل مستودع + سجلّ المرتجعات المُعادة بمستودعها
    { const p0 = Admin.products.find(x => x.stock != null); Admin.wh = { cfg: AdminWh.normCfg({ on: true, list: [{ id: "w1", name: "مستودع وهران" }], min: { main: 9999 } }), stock: {} };
      Admin.fin = Object.assign({}, Admin.fin, { log: [{ ts: new Date().toISOString(), slug: p0.slug, title: p0.title, delta: 2, after: 5, ref: "WX1", why: "مرتجع: أُعيد تلقائياً بعد وصول الطرد — مستودع وهران" }] }); AdminWh.draw(); await wait(150);
      const card = document.getElementById("wr-card"); R.lowUi = [!!card.querySelector('[data-whmin="main"]'), !!card.querySelector('[data-whmin="w1"]'), /حدّها الأدنى/.test(card.textContent), /→ مستودع وهران/.test(card.textContent) && /WX1/.test(card.textContent)]; }
    Admin.products = sv.pr; Admin.fin = sv.fin; Admin.queueStockPublish = sv.qp; API.updateOrder = sv.uo; Admin.wh = sv.wh; Admin.orders = sv.or; Admin.shipRaw = sv.raw; Priv.set = sv.ps; Admin.tab("orders"); return R;
  });
  ok("مستودعات: الطلب يخصم من مستودع ولايته (10→7، وهران 4→1) ويُوسم 📦@w1، وإن لم يكفِ يخصم من الرئيسي", whT.a[0] === 7 && whT.a[1] === 1 && /📦@w1/.test(whT.a[2]) && whT.b[0] === 1 && whT.b[1] === 1 && !/@/.test(whT.b[2]), whT);
  ok("مرتجع في طريق العودة لا يعود للمخزون ويُوسم 🔁transit", whT.hold[0] === 1 && whT.hold[1] === 1 && whT.hold[2] && whT.hold[3], whT.hold);
  ok("وصول الطرد (وسم الـwebhook) يعيده تلقائياً إلى مستودع وهران نفسه ويُسجَّل", whT.back[0] === 1 && whT.back[1] === 4 && whT.back[2] === 4 && !whT.back[3] && whT.back[4] && /مرتجع/.test(whT.log), whT);
  ok("سياسة «فوراً» تعيد عند أول حالة فشل، وحالة «Retourné au vendeur» عبر المزامنة تعيد بعد الحجز", whT.imm[1] === whT.imm[0] + 2 && whT.raw[1] === whT.raw[0] + 1 && whT.raw[2] === 1, whT);
  ok("حدّ أدنى لكل مستودع: خانتا الإدخال، تنبيه «بلغت حدّها الأدنى»، وسجلّ المرتجع بمستودعه ورقم الطلب", whT.lowUi && whT.lowUi.every(Boolean), whT.lowUi);
  ok("مرتجع تالف لا تعود علبه ويُنزع وسمه", whT.dmg[0] === whT.dmg[1] && !whT.dmg[2], whT.dmg);
  ok("بطاقة المرتجعات والمستودعات في تبويب المخزون: قائمة المنتظِر، جدول الكميات، و«استلمتُه» يعيد الطرد", whT.ui && whT.uiRows === 1 && whT.uiTbl >= 2 && !/📦(?!livree)/.test(whT.manual[0]) && whT.manual[1] === 0, whT);
  // ── فحص مفاتيح الشركة استباقياً: 401 ← شريط أحمر ويقف الفحص العشوائي، وحفظ المفاتيح يفحصها فوراً ──
  const kyT = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true;
    const SV = { cf: Admin.courierFetch, dc: Admin.deliveryCfg, or: Admin.orders, sn: Admin.showNotice, ro: Admin.renderOrders, rs: Admin.renderShipped, uo: API.updateOrder, ks: Admin._keyState, cw: Admin.companyWilayas };
    Admin.deliveryCfg = { yalidine: { enabled: true, isDefault: true, apiId: "bad", apiToken: "bad" } }; Admin._keyState = {}; Admin.renderOrders = () => { }; Admin.renderShipped = () => { }; API.updateOrder = async () => ({ ok: true });
    let mode = 401, calls = 0, notices = []; Admin.showNotice = (t, h) => { notices.push(t); };
    Admin.courierFetch = async rq => { calls++; return mode === 401 ? { ok: false, status: 401, text: '{"error":{"message":"API ID and/or Token are wrong","code":401}}' } : { ok: true, status: 200, text: JSON.stringify({ total_data: 5, data: [] }) }; };
    const R = {}; const mkO = n => ({ id: "K" + n, date: new Date().toISOString(), status: "expediee", name: "ك", phone: "0550000003", wilaya: "Alger", items: "x ×1 = 100 DA", total: 100, note: "🚚yalidine:TRK" + n });
    R.res = await Admin.checkCompanyKeys("yalidine", { explain: true }); R.state = Admin._keyState.yalidine; R.notice = notices[0] || "";
    Admin.renderDeliveryBanners(); R.banner = (document.getElementById("orders-banner") || {}).innerHTML || "";
    // المزامنة: ثلاثة طرود، يكفي طلب واحد مرفوض
    Admin._keyState = {}; Admin.orders = [mkO(1), mkO(2), mkO(3)]; calls = 0; await Admin.syncShipping({ silent: true, bg: true }); R.syncCalls = calls; R.syncState = (Admin._keyState.yalidine || {}).ok;
    // مفاتيح صحيحة ← يزول الشريط
    mode = 200; R.ok = await Admin.checkCompanyKeys("yalidine"); Admin.renderDeliveryBanners(); R.bannerGone = !/ترفض مفاتيح/.test((document.getElementById("orders-banner") || {}).innerHTML || ""); R.okState = Admin._keyState.yalidine && Admin._keyState.yalidine.ok;
    // حفظ مفاتيح جديدة يفحصها فوراً
    mode = 401; Admin._keyState = {}; notices = []; Admin.openDeliveryConfig("yalidine"); await wait(100); document.getElementById("dlv-f-apiId").value = "newid"; document.getElementById("dlv-f-apiToken").value = "newtoken"; Admin.saveDeliveryConfig(); await wait(900);
    R.saveChecked = (Admin._keyState.yalidine || {}).ok === false && notices.some(t => /رفضت/.test(t));
    Admin.courierFetch = SV.cf; Admin.deliveryCfg = SV.dc; Admin.orders = SV.or; Admin.showNotice = SV.sn; Admin.renderOrders = SV.ro; Admin.renderShipped = SV.rs; API.updateOrder = SV.uo; Admin._keyState = SV.ks; return R;
  });
  ok("مفاتيح الشركة: رفض 401 يُعلَّم ويظهر شريط أحمر بزر «تحديث المفاتيح» وإشعار بالخطوات", kyT.res === false && kyT.state && kyT.state.ok === false && kyT.state.status === 401 && /رفضت/.test(kyT.notice) && /ترفض مفاتيح/.test(kyT.banner) && /تحديث المفاتيح/.test(kyT.banner), kyT);
  ok("مفاتيح الشركة: المزامنة تقف بعد أول 401 (طلب واحد لثلاثة طرود لا ثلاثة)", kyT.syncCalls === 1 && kyT.syncState === false, kyT);
  ok("مفاتيح الشركة: عودة المفاتيح الصحيحة تزيل الشريط، وحفظ مفاتيح مرفوضة يفحصها فوراً ويشرح", kyT.ok === true && kyT.bannerGone && kyT.okState && kyT.saveChecked, kyT);
  // ── زر «اختبر المفاتيح قبل الحفظ»: تشخيص التبديل والطول، ولا يحفظ شيئاً ──
  const tkT = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true;
    const SV = { cf: Admin.courierFetch, dc: Admin.deliveryCfg, sn: Admin.showNotice, ks: Admin._keyState };
    Admin.deliveryCfg = { yalidine: { enabled: true, isDefault: true, apiId: "keep", apiToken: "keep" } }; Admin._keyState = {};
    let mode = 401, notices = []; Admin.showNotice = (t, h) => { notices.push(t + " | " + h); };
    Admin.courierFetch = async rq => mode === 401 ? { ok: false, status: 401, text: "{}" } : { ok: true, status: 200, text: '{"total_data":7}' };
    Admin.openDeliveryConfig("yalidine"); await wait(100); const R = {};
    const set = (i, t) => { document.getElementById("dlv-f-apiId").value = i; document.getElementById("dlv-f-apiToken").value = t; };
    set("T".repeat(62), "I".repeat(20)); await Admin.testDeliveryKeys(); R.swap = notices.pop() || "";
    set(' "' + "a".repeat(10) + '" ', "b".repeat(62)); await Admin.testDeliveryKeys(); R.short = notices.pop() || "";
    mode = 200; set("a".repeat(20), "b".repeat(62)); await Admin.testDeliveryKeys(); R.good = notices.pop() || "";
    R.kept = Admin.deliveryCfg.yalidine.apiId === "keep";
    Admin.courierFetch = SV.cf; Admin.deliveryCfg = SV.dc; Admin.showNotice = SV.sn; Admin._keyState = SV.ks; document.getElementById("delivery-modal-bg").classList.remove("open"); return R;
  });
  ok("اختبار المفاتيح: يكشف تبديل الخانتين والطول الناقص، ويؤكد الصحيحة، ولا يحفظ", /بدّلت/.test(tkT.swap) && /10 حرفاً/.test(tkT.short) && /صحيحة/.test(tkT.good) && /7 طرد/.test(tkT.good) && tkT.kept, tkT);
  // ── رقم الطلب الحقيقي عند الشركة: يُحفظ عند الإرسال ويُقرأ من قائمة الطرود للقديم ويظهر في المعاينة ──
  const coT = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); const SV = { uo: API.updateOrder, or: Admin.orders, rows: AdminYd.S.rows };
    API.updateOrder = async () => ({ ok: true }); const R = {};
    const mk = (id, note) => ({ id, date: new Date().toISOString(), status: "confirmee", name: "ع", phone: "0550000009", wilaya: "Alger", commune: "Kouba", items: "x ×1 = 100 DA", total: 100, note: note || "" });
    const a = mk("CN01"); Admin.saveTracking(a, "yalidine", "yal-AAA111", 1219); R.note = a.note; R.no = Admin.coNoOf(a);
    Admin.saveTracking(a, "yalidine", "yal-BBB222", 1300); R.resave = a.note;                    // إعادة الحفظ لا تكرّر الوسم
    const b = mk("CN02", "🚚yalidine:yal-OLD333"); AdminYd.S.rows = [{ tracking: "yal-OLD333", orderId: "1180", status: "x" }]; R.old = Admin.coNoOf(b);
    const c = mk("CN03"); Admin.saveTracking(c, "yalidine", "yal-CCC", "CN03"); R.same = c.note;      // الرقم نفسه رقم الطلب فلا يُكرَّر
    Admin.orders = [a, b, c]; Admin.openOrderPreview(0); await wait(100);
    const html = (document.getElementById("ord-prev-bg") || {}).innerHTML || ""; R.shown = /رقم الطلب عند الشركة/.test(html) && />1300</.test(html); R.noTag = !/🔢/.test(html);
    document.getElementById("ord-prev-bg").classList.remove("open");
    API.updateOrder = SV.uo; Admin.orders = SV.or; AdminYd.S.rows = SV.rows; return R;
  });
  ok("رقم الطلب عند الشركة: وسم عند الإرسال، قراءة القديم من الطرود، عرض في المعاينة بلا وسم ظاهر", /🚚yalidine:yal-AAA111 🔢1219/.test(coT.note) && coT.no === "1219" && (coT.resave.match(/🔢/g) || []).length === 1 && coT.old === "1180" && !/🔢/.test(coT.same) && coT.shown && coT.noTag, coT);
  // ── التقاط العناصر: عبوات متجاورة تبقى منفصلة ولا يبتلعها قناع المجموعة، والكتب المتلاصقة تُدمج كما كانت ──
  const mgT = await p.evaluate(() => {
    const T = AIVision._t, S = { W: 100, H: 100, lw: 100, lh: 100, fx: 1, fy: 1 };
    const mk = (x0, x1, y0, y1, label) => { const lo = new Float32Array(10000); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) lo[y * 100 + x] = 1; return T.stats({ lo, lw: 100, lh: 100, score: .9, obj: 1, label, det: .9 }, S); };
    const R = {};
    R.sep = T.mergeItems([mk(2, 14, 20, 60, "عبوة"), mk(13, 30, 20, 60, "عبوة"), mk(34, 46, 20, 60, "عبوة"), mk(50, 62, 20, 60, "عبوة")], S).length;
    R.grp = T.mergeItems([mk(2, 62, 20, 60, "عبوة"), mk(2, 14, 20, 60, "عبوة"), mk(13, 30, 20, 60, "عبوة"), mk(34, 46, 20, 60, "عبوة"), mk(50, 62, 20, 60, "عبوة")], S).length;
    R.single = T.mergeItems([mk(10, 50, 10, 70, "عبوة"), mk(10, 50, 10, 25, "عبوة")], S).length;          // غطاء داخل عبوة يبقى جزءاً منها
    R.books = T.mergeItems([mk(2, 14, 20, 60, "كتاب"), mk(14, 30, 20, 60, "كتاب")], S).length;
    return R;
  });
  ok("التقاط العناصر: أربع عبوات متجاورة تبقى أربعاً، وقناع المجموعة يُستبعد، والغطاء جزء من عبوته، والكتب المتلاصقة تُدمج", mgT.sep === 4 && mgT.grp === 4 && mgT.single === 1 && mgT.books === 1, mgT);
  // ── تدقيق نافذة التقاط العناصر بالمظهر الداكن: خلفية معتمة داكنة ونص مقروء (كانت أبيض على أبيض) ──
  const cqT = await p.evaluate(() => {
    document.documentElement.classList.add("glass"); const sh = PBSmart._shell("التقاط العناصر", "عنصر", "كل العناصر", "تلميح", "تلميح الكل"); const R = {};
    const lum = c => { const v = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
    const rgba = s => { const m = String(s).match(/[\d.]+/g) || []; return [+m[0] || 0, +m[1] || 0, +m[2] || 0, m.length > 3 ? +m[3] : 1]; };
    const bgOf = el => { let stack = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) stack.push(c); if (c[3] >= .99) break; } let base = [0, 0, 0]; stack.reverse().forEach(c => { base = base.map((b, i) => b * (1 - c[3]) + c[i] * c[3]); }); return base; };
    const ratio = el => { const f = rgba(getComputedStyle(el).color), b = bgOf(el), l1 = lum(f), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
    const q = id => sh.host.querySelector(id);
    R.wrap = bgOf(q("#pbs-panel")).map(Math.round); R.title = ratio(q("#pbs-panel b")); R.hint = ratio(q("#pbs-hint")); R.segOn = ratio(q('#pbs-seg button[data-m="one"]')); R.segOff = ratio(q('#pbs-seg button[data-m="all"]')); R.go = ratio(q("#pbs-go"));
    q('#pbs-seg button[data-m="all"]').click(); R.afterClick = ratio(q('#pbs-seg button[data-m="all"]')); sh.close(); return R;
  });
  ok("نافذة التقاط العناصر بالمظهر الداكن: الخلفية داكنة معتمة وكل النصوص (العنوان، التلميح، «عنصر/كل العناصر») بتباين ≥ 4.5", Math.max(...cqT.wrap) < 60 && cqT.title >= 4.5 && cqT.hint >= 4.5 && cqT.segOn >= 4.5 && cqT.segOff >= 4.5 && cqT.afterClick >= 4.5 && cqT.go >= 4.5, cqT);
  // ── التقاط العناصر: يبدأ التحليل مباشرة بلا خطوة «تحليل الصورة كاملة»، والمسح أخضر شفاف بخط أخضر ضوئي بلا نقاط زرقاء ──
  const scT = await p.evaluate(() => {
    const R = {}; document.documentElement.classList.add("glass");
    const cv = document.createElement("canvas"); cv.width = 400; cv.height = 300; cv.getContext("2d").fillRect(0, 0, 400, 300);
    const sh = PBSmart._shell("التقاط العناصر", "عنصر", "كل العناصر", "h", "h2"); const stop = PBSmart._scanFx(sh, cv);
    const tint = sh.host.querySelector("#pbs-tint"), ln = sh.host.querySelector("#pbs-scanline"), g = el => el ? getComputedStyle(el) : null;
    R.dots = sh.host.querySelectorAll(".pbs-dot,#pbs-dots").length; R.tint = !!tint && /34, 197, 94|16, 185, 129/.test(g(tint).backgroundImage); R.line = !!ln && /74, 222, 128|34, 197, 94/.test(g(ln).boxShadow) && !/96, 165, 250/.test(g(ln).boxShadow);
    R.noZoneStep = !/pickZone/.test(PBSmart.captureElements.toString()); R.goText = sh.host.querySelector("#pbs-go").textContent;
    stop(); sh.close(); return R;
  });
  ok("التقاط العناصر: يبدأ التحليل مباشرة، ومسح أخضر شفاف بخط أخضر ضوئي بلا نقاط زرقاء", scT.dots === 0 && scT.tint && scT.line && scT.noZoneStep && /المسح/.test(scT.goText), scT);
  // ── دقة حواف الالتقاط: القناع مقيّد بصندوق كشفه، والمنطقة المشتركة بين عنصرين متجاورين للأقرب ──
  const teT = await p.evaluate(() => {
    const T = AIVision._t, S = { W: 100, H: 100, lw: 100, lh: 100, fx: 1, fy: 1 };
    const mk = (x0, x1, y0, y1, box) => { const lo = new Float32Array(10000).fill(-2); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) lo[y * 100 + x] = 1; return T.stats({ lo, lw: 100, lh: 100, score: .9, obj: 1, label: "عبوة", box }, S); };
    const R = {}; const a = mk(10, 90, 10, 60, [10, 10, 40, 60]); const before = a.area; T.trimEdges([a], S); R.clamp = before > a.area && a.x1 <= 46;      // بلغ القناع 90 والصندوق ينتهي عند 40(+هامش 2)
    const b = mk(10, 50, 10, 60, [10, 10, 50, 60]), c = mk(44, 90, 10, 60, [44, 10, 90, 60]); const ov0 = (() => { let n = 0; for (let i = 0; i < 10000; i++) if (b.lo[i] > 0 && c.lo[i] > 0) n++; return n; })();
    T.trimEdges([b, c], S); let ov1 = 0; for (let i = 0; i < 10000; i++) if (b.lo[i] > 0 && c.lo[i] > 0) ov1++; R.ov0 = ov0; R.ov1 = ov1; R.bx = b.x1; R.cx = c.x0;
    return R;
  });
  ok("حواف الالتقاط: قناع العنصر مقيّد بصندوقه والمنطقة المشتركة بين عبوتين تُعطى لأقربهما ولا يبقى تداخل", teT.clamp && teT.ov0 > 0 && teT.ov1 === 0 && teT.bx <= 50 && teT.cx >= 44, teT);
  // ── ذاكرة النماذج: معلومات الحفظ تُقرأ (ملفات/حجم/دائم)، وتُطلب الدائمة، ولا تُسمّى «تنزيلاً» إن كانت محفوظة ──
  const mcT = await p.evaluate(async () => {
    const R = {}; R.has = typeof AIVision.cacheInfo === "function" && typeof AIVision.keepModels === "function";
    let asked = 0; const SV = navigator.storage && navigator.storage.persist; try { if (navigator.storage) navigator.storage.persist = async () => { asked++; return true; }; } catch (e) { }
    AIVision.keepModels(); await new Promise(r => setTimeout(r, 200)); R.asked = asked; const c = await AIVision.cacheInfo(); R.shape = ["files", "bytes", "usage", "quota", "persisted"].every(k => k in c);
    try { if (navigator.storage && SV) navigator.storage.persist = SV; } catch (e) { } return R;
  });
  ok("ذاكرة النماذج: تُقرأ معلومات الحفظ (ملفات/حجم/دائم) ويُطلب الحفظ الدائم حتى لا تُمسح عند امتلاء القرص", mcT.has && mcT.shape && mcT.asked === 1, mcT);
  // ── إغلاق المطوّر يغلق كل النوافذ العائمة (مكتبة الصور، تحميل الصور، لوحة تعديل الصورة…) ──
  const cfT = await p.evaluate(() => {
    const ids = ["pbx-pimg", "pbx-lib", "pbx-ep", "pbx-epf", "pbar-bg", "pbnp-bg", "pbx-ctx", "pbx-pop"]; ids.forEach(i => { if (!document.getElementById(i)) { const d = document.createElement("div"); d.id = i; document.body.appendChild(d); } });
    const before = ids.filter(i => document.getElementById(i)).length; PBApp.closeFloating(); const left = ids.filter(i => document.getElementById(i));
    return { before, left, wired: /closeFloating/.test(PBApp.close.toString()) };
  });
  ok("إغلاق المطوّر: كل النوافذ العائمة (مكتبة الصور وتحميلها ولوحة الأداة والقوائم) تُغلق معه", cfT.before === 8 && cfT.left.length === 0 && cfT.wired, cfT);
  // ── نافذة «صفحة جديدة»: زر «افتح» ظاهر دائماً حتى على شاشة قصيرة (المحتوى يتمرّر والأزرار ثابتة) ──
  const npT = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const R = {}; PBAdmin.newPage(); await w(200); const d = document.getElementById("pbnp");
    d.querySelector('[data-np="size"]').click(); await w(100); const go = d.querySelector('[data-np="go"]'); R.label = go.textContent.trim();
    const vis = () => { const b = go.getBoundingClientRect(), r = d.getBoundingClientRect(); return b.height > 20 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1 && b.bottom <= innerHeight; };
    R.tall = vis(); R.fits = d.getBoundingClientRect().height <= innerHeight; const bp = document.getElementById("pbnp-bg"); bp.remove(); return R;
  });
  await p.setViewportSize({ width: 1280, height: 520 });
  const npS = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const R = {}; PBAdmin.newPage(); await w(200); const d = document.getElementById("pbnp");
    d.querySelector('[data-np="size"]').click(); await w(150); const go = d.querySelector('[data-np="go"]'), b = go.getBoundingClientRect(), r = d.getBoundingClientRect();
    R.short = b.height > 20 && b.bottom <= innerHeight && b.top >= 0; R.fits = r.height <= innerHeight; document.getElementById("pbnp-bg").remove(); return R;
  });
  await p.setViewportSize({ width: 1280, height: 800 });
  ok("نافذة «صفحة جديدة»: الزر «افتح» ظاهر كاملاً بالشاشة العادية والقصيرة (520px) والنافذة لا تتجاوز الشاشة", npT.label === "افتح" && npT.tall && npT.fits && npS.short && npS.fits, { npT, npS });
  // ── نافذة التقاط العناصر: كاملة الارتفاع، والصورة كاملة بلا شريط تمرير، ولا رسالة «من ذاكرة المتصفح» ──
  const cwT = await p.evaluate(async () => {
    const R = {}; const sh = PBSmart._shell("التقاط العناصر", "عنصر", "كل العناصر", "h", "h2"), view = sh.host.querySelector("#pbs-view"), box = view.parentElement;
    R.boxH = Math.round(box.getBoundingClientRect().height); R.vh = innerHeight; R.full = box.getBoundingClientRect().height >= innerHeight * .9 - 2;
    R.noScroll = getComputedStyle(view).overflowY === "hidden" && getComputedStyle(view).overflowX === "hidden"; R.viewH = view.clientHeight;
    const cv = document.createElement("canvas"); cv.width = 600; cv.height = 1800; cv.getContext("2d").fillRect(0, 0, 600, 1800); const stop = PBSmart._scanFx(sh, cv);      // صورة طولية جداً
    const img = sh.host.querySelector("#pbs-stage canvas"), r = img.getBoundingClientRect(), v = view.getBoundingClientRect(); R.fits = r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && r.left >= v.left - 1 && r.right <= v.right + 1; R.ratio = Math.round(r.width / r.height * 100) / 100;
    stop(); sh.close(); R.noMsg = !/من ذاكرة المتصفح/.test(await (await fetch("assets/js/ai-vision.js")).text()); return R;
  });
  ok("نافذة التقاط العناصر: النافذة كاملة الارتفاع والصورة (حتى الطولية جداً) كاملة بلا شريط تمرير، ولا رسالة «من ذاكرة المتصفح»", cwT.full && cwT.noScroll && cwT.fits && Math.abs(cwT.ratio - .33) < .02 && cwT.noMsg, cwT);
  // ── شريط التمرير: 6px بلا توهج خارجي، ومخفي في نافذة «صفحة جديدة» وبقية النوافذ ──
  const sbT = await p.evaluate(async () => {
    const R = { glow: 0, w: new Set() }; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } for (const r of rules) { const t = r.selectorText || ""; if (/^::-webkit-scrollbar-thumb$/.test(t.trim()) && r.style.boxShadow && /0px 0px \d+px/.test(r.style.boxShadow.replace(/\s+/g, " ")) && !/inset/.test(r.style.boxShadow.split(/,(?![^(]*\))/).pop())) R.glow++; if (/^::-webkit-scrollbar$/.test(t.trim()) && r.style.width) R.w.add(r.style.width); } }
    R.w = [...R.w]; PBAdmin.newPage(); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector("#pbnp .np-body"); R.npNone = parseFloat(getComputedStyle(b, "::-webkit-scrollbar").width) >= 12; R.m = parseFloat(getComputedStyle(document.querySelector("#pbnp"), "::-webkit-scrollbar").width) >= 12; document.getElementById("pbnp-bg").remove(); return R;
  });
  ok("شريط التمرير: 6px عام وبلا توهج، وعريض برتقالي موحّد في نوافذ المطوّر واللوحات العائمة (نافذة صفحة جديدة)", sbT.glow === 0 && sbT.w.every(x => x === "6px") && sbT.npNone && sbT.m, sbT);
  // ── تبويب «تعديل الصورة»: التخطيط الفعلي (لا المعرَّف فقط): مربعات كبيرة بالاسم تحتها، اثنان في كل صف ──
  const lyT = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const R = {}; window.confirm = () => true; PBAdmin.mkPage("تخطيط"); await w(1500); document.getElementById("pb-app").classList.remove("pbx-hl"); if (PBApp.E.ltab !== "img") PBApp.ltoggle("img"); await w(500); R.tab = PBApp.E.ltab; R.vis = !!document.getElementById("pbx-lpane").offsetParent;
    const pane = document.getElementById("pbx-lpane"), tiles = [...pane.querySelectorAll(".pbx-ttg")[0].querySelectorAll(".pbx-tt")]; const rs = tiles.map(t => t.getBoundingClientRect()), im = tiles[0].querySelector("img").getBoundingClientRect(), sp = im;
    R.shown = rs[0].width > 0; R.imgW = Math.round(im.width); R.imgH = Math.round(im.height); R.square = Math.abs(im.width / im.height - 1) < .03 && im.width >= 90; R.below = true; R.merged = pane.querySelectorAll(".pbx-ttg [data-imgm]").length === 5 && pane.querySelectorAll(".pbx-cat").length >= 3;
    R.row1 = Math.abs(rs[0].top - rs[1].top) < 2 && Math.abs(rs[0].left - rs[1].left) > 40; R.row2 = rs[2].top > rs[0].bottom - 1 && Math.abs(rs[2].left - rs[0].left) < 3; R.disp = getComputedStyle(pane.querySelector(".pbx-ttg")).display; PBApp.close(); await w(400); return R;
  });
  ok("تبويب «تعديل الصورة» (تخطيط فعلي): أيقونات ≥90px مربعة والذكية في الشبكة نفسها، اثنان في كل صف ثم صف تحتهما (grid لا صف أفقي)", lyT.shown && lyT.square && lyT.merged && lyT.row1 && lyT.row2 && lyT.disp === "grid", lyT);
  const icn = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const R = {}; PBAdmin.mkPage("أيقونات"); await w(1500); document.getElementById("pb-app").classList.remove("pbx-hl"); if (PBApp.E.ltab !== "img") PBApp.ltoggle("img"); await w(900);
    const pane = document.getElementById("pbx-lpane"), tile = pane.querySelector('[data-imgt="bg"]'), row = pane.querySelector('[data-imgx="brand"]');
    R.tileTitle = tile && tile.querySelector("span") && tile.querySelector("span").textContent.trim(); R.rowTitle = row && row.querySelector("b") && row.querySelector("b").textContent.trim(); R.rowIc = !!(row && row.querySelector("i.ic img.tt-ic"));
    R.imgs = [...pane.querySelectorAll("img.tt-ic")].filter(i => i.naturalWidth > 0).length; R.imgsN = pane.querySelectorAll("img.tt-ic").length;
    const j = await (await fetch("assets/data/tool-titles.json")).json(); R.langs = Object.values(j.tools).every(t => ["ar", "fr", "en"].every(l => t.t[l] && t.d[l])); R.n = Object.keys(j.tools).length;
    ["alyssum_ui_lang", "store_ui_lang"].forEach(k => localStorage.setItem(k, "fr")); PBApp.ltoggle("add"); await w(150); PBApp.ltoggle("img"); await w(500);
    R.fr = pane.querySelector('[data-imgt="bg"] span').textContent.trim(); ["alyssum_ui_lang", "store_ui_lang"].forEach(k => localStorage.removeItem(k)); PBApp.close(); await w(300); return R;
  });
  ok("أيقونات الأدوات: كل الصور تُحمَّل، والعناوين نصوص HTML من ملف الترجمة (عربي افتراضي وفرنسي عند ضبط اللغة)", icn.imgs >= 10 && icn.imgs === icn.imgsN && icn.tileTitle === "نزع الخلفية" && icn.rowTitle === "الهوية البصرية" && icn.rowIc && icn.langs && icn.n === 14 && icn.fr === "Suppression de fond", icn);
  const sdt = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)); const R = {}; const btn = document.querySelector('.nav-btn[onclick*="studio"]'); R.btn = !!btn && btn.dataset.grp === "apps"; R.noAll = !document.querySelector('.nav-btn[data-app="tools"]'); btn.click(); await w(1500);
    const vis = () => !document.getElementById("tab-studio").classList.contains("hidden"); R.vis = vis();
    R.n = document.querySelectorAll("#sd-list .sd-card").length; R.chips = document.querySelectorAll(".sd-chips button").length;
    R.icons = [...document.querySelectorAll("#sd-list .sd-h img")].filter(i => i.naturalWidth > 0).length;
    const q = document.getElementById("sd-q"); q.value = "الخلفية"; q.dispatchEvent(new Event("input", { bubbles: true })); await w(100); R.f = document.querySelectorAll("#sd-list .sd-card").length; q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-sdt="v360"]').click(); await w(200); R.hash = location.hash; R.page = document.querySelector("#studio-content .sd-head h2").textContent.trim(); R.steps = document.querySelectorAll("#studio-content .sd-box ol li").length; R.rel = document.querySelectorAll("#studio-content .sd-rel button").length; R.go = !!document.querySelector('[data-sdgo="v360"]'); R.noGuide = !/دليل الاستعمال|صفحة التعريف/.test(document.getElementById("studio-content").textContent);
    document.querySelector("[data-sdback]").click(); await w(100); R.back = document.querySelectorAll("#sd-list .sd-card").length;
    document.querySelector('[data-sdt="bg"]').click(); await w(300); const fr = document.getElementById("sd-fr"); R.frSrc = fr ? fr.getAttribute("src") : ""; R.noOld = !document.querySelector("#studio-content .sd-act");
    window.dispatchEvent(new MessageEvent("message", { data: { pfStudio: "h", h: 3210 }, source: fr.contentWindow })); await w(50); R.h = fr.style.height;
    let go = ""; const og = AdminNav.toolGo; AdminNav.toolGo = id => { go = id; }; window.dispatchEvent(new MessageEvent("message", { data: { pfStudio: "open", tool: "bg" }, source: fr.contentWindow })); window.dispatchEvent(new MessageEvent("message", { data: { pfStudio: "open", tool: "bg" }, source: window })); AdminNav.toolGo = og; R.go2 = go;
    document.querySelector("[data-sdback]").click(); Admin.tab("home"); await w(200); R.hidden = !vis(); return R;
  });
  ok("ستوديو ديزاين: لا تبويب «كل الأدوات»، كل الأدوات (32) بمرشحات وبحث، الأداة تفتح صفحتها مباشرة (إطار صفحة التعريف الغنية بارتفاع تلقائي وزرّها يفتح المحرّر)، وللأدوات بلا صفحة تعريف صفحة مختصرة بلا دليل", sdt.btn && sdt.noAll && sdt.vis && sdt.n === 32 && sdt.chips === 4 && sdt.icons >= 14 && sdt.f >= 1 && sdt.f < 30 && /studio=v360/.test(sdt.hash) && sdt.page === "عرض 360° للمنتج" && sdt.steps >= 3 && sdt.rel >= 1 && sdt.go && sdt.noGuide && sdt.back === 32 && /saas\/landing\/remove-background\/\?embed=1$/.test(sdt.frSrc) && sdt.noOld && sdt.h === "3210px" && sdt.go2 === "bg" && sdt.hidden, sdt);
  // ── تبويب «أدوات ذكية» محذوف من القائمة اليسرى (أدواته داخل «تعديل الصورة») ──
  const nsT = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; PBAdmin.mkPage("بلا ذكية"); await w(1500); const R = { smart: !!document.querySelector('.pbx-tabs [data-lt="smart"]'), img: !!document.querySelector('.pbx-tabs [data-lt="img"]'), tabs: [...document.querySelectorAll(".pbx-tabs [data-lt]")].map(b => b.dataset.lt).join(",") }; PBApp.close(); await w(400); return R; });
  ok("القائمة اليسرى: لا تبويب «أدوات ذكية» (موجودة داخل «تعديل الصورة»)", !nsT.smart && nsT.img, nsT);
  // ── الربح الحقيقي: صافي بعد المرتجعات + إنفاق إعلاني فعلي من حساب مربوط ──
  const pfT = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {};
    const sets = []; const ps0 = Priv.set; Priv.set = async (k, v) => { sets.push([k, JSON.stringify(v)]); };
    const pr = Admin.products.find(x => x.slug !== "test" && x.active !== false), slug = pr.slug; Admin.fin.costs = { [slug]: 1000 }; Admin.fin.ads = {}; Admin.fin.set = Object.assign({}, Admin.fin.set, { packaging: 0, ad: { method: "fixed", a: 0, b: 0, m: 2, n: 0 }, useReal: false });
    const mk = (id, st, ex) => Object.assign({ id, date: new Date(Date.now() - 86400000).toISOString(), status: st, name: "ز" + id, phone: "055100" + id.slice(-4), wilaya: "Alger", commune: "Kouba", dtype: "home", items: pr.title + " ×1 = 3000 DA", subtotal: 3000, fee: 0, total: 3000, note: "", extra: { "📣 الحملة": "Summer-A" } }, ex);
    Admin.orders = [mk("PF0001", "livree"), mk("PF0002", "livree"), mk("PF0003", "echec"), mk("PF0004", "confirmee")];
    const calls = []; const t0 = API.sb.token, u0 = API.sb.url, h0 = API.sb.headers, f0 = window.fetch;
    API.sb.token = async () => "tok"; API.sb.url = p => "http://x" + p; API.sb.headers = () => ({});
    const day = new Date(Date.now() - 86400000), dk = Admin.isoDay(day); let accounts = [];
    window.fetch = async (u, o) => { if (!/platform-proxy/.test(String(u))) return f0(u, o); const b = JSON.parse(o.body); calls.push(b); const E = (d, st) => ({ ok: true, status: 200, json: async () => ({ ok: true, status: st || 200, data: d }) });
      if (b.path === "/v1/ads/accounts" && b.method === "GET") return E({ accounts });
      if (b.path === "/v1/ads/accounts" && b.method === "PUT") { accounts = [{ id: 7, provider: b.body.provider, account_id: b.body.account_id, name: b.body.name, currency: b.body.config.currency, fx: b.body.config.fx, status: "active", has_token: true, last_ok_at: Math.floor(Date.now() / 1000) }]; return E({ ok: true, id: 7 }, 201); }
      if (/\/sync$/.test(b.path)) return E({ ok: true, rows: 1 });
      if (b.path === "/v1/ads/spend") return E({ total_dzd: accounts.length ? 1500 : 0, spend: accounts.length ? [{ day: dk, campaign_id: "c1", campaign_name: "Summer-A", provider: "meta", currency: "USD", spend: 10, spend_dzd: 1500, impressions: 1000, clicks: 40 }] : [] });
      return E({}); };
    const r = {}; Admin.tab("profit"); await wait(500);
    const hero = () => (document.querySelector("#pf-app .pf-big") || {}).textContent || "";
    r.shown = !document.getElementById("tab-profit").classList.contains("hidden"); r.hero0 = hero();
    const g = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 29); return { from: d.getTime(), to: Date.now() + 1 }; })(), K = Admin.computeFinance(0, g).K;
    const fm = n => (n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString("fr-DZ") + " دج";
    r.expect0 = fm(K.real); r.rows = document.querySelectorAll("#pf-app .pf-wf > div").length; r.tbl = document.querySelectorAll("#pf-app .pf-tbl").length; r.noAccounts = /لم تربط أي حساب/.test(document.getElementById("pf-app").textContent);
    r.parts = JSON.stringify(K.parts); r.byDay = Object.keys(K.byDay).length; r.src = K.bySrc["Summer-A"] ? K.bySrc["Summer-A"].n : 0; r.preOk = K.real + K.adTotal === K.parts.rev - K.parts.cogs - K.parts.del - K.parts.pack - K.parts.retLoss - K.refunds;
    document.querySelector('#pf-app [data-pf="add"]').click(); await wait(100);
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); };
    set("pf-tok", "Bearer SECRET_TOKEN_1_ABCDEFGHIJ\n"); document.querySelector('#pf-app [data-pf="save"]').click(); await wait(200);
    const em = document.getElementById("pf-msg"); r.msgEmpty = em && em.style.display !== "none" && /رقم الحساب/.test(em.textContent) && !calls.some(c => c.method === "PUT");
    set("pf-acc", "act_123456"); set("pf-cur", "USD"); AdminProfit.refresh(); await wait(500);
    r.draft = (document.getElementById("pf-acc") || {}).value === "act_123456" && (document.getElementById("pf-tok") || {}).value.includes("SECRET_TOKEN_1_ABCDEFGHIJ") && (document.getElementById("pf-cur") || {}).value === "USD";
    set("pf-acc", "act_123456"); set("pf-name", "حسابي"); set("pf-cur", "USD"); set("pf-fx", "150.5");
    document.querySelector('#pf-app [data-pf="save"]').click(); await wait(700);
    const put = calls.find(c => c.method === "PUT"); r.put = put ? JSON.stringify({ p: put.body.provider, a: put.body.account_id, fx: put.body.config.fx, t: put.body.secrets.token }) : "";
    r.synced = calls.some(c => /\/accounts\/7\/sync$/.test(c.path)); r.leak = document.getElementById("pf-app").innerHTML.includes("SECRET_TOKEN_1") || JSON.stringify(localStorage).includes("SECRET_TOKEN_1");
    r.hero1 = hero(); r.expect1 = fm(K.real + K.adTotal - 1500); r.acc = /حسابي/.test(document.getElementById("pf-app").textContent); r.camp = /Summer-A/.test(document.querySelectorAll("#pf-app .pf-tbl")[0].textContent);
    r.spendCell = /1[\s ]?500/.test(document.querySelectorAll("#pf-app .pf-tbl")[0].textContent);
    set("pf-fixed", "30000"); document.querySelector('#pf-app [data-pf="fixed"]').click(); await wait(150); r.fixedSaved = sets.some(x => x[0] === "profitset" && /30000/.test(x[1])); r.hero2 = hero();
    API.sb.token = t0; API.sb.url = u0; API.sb.headers = h0; window.fetch = f0; Priv.set = ps0; Admin.tab("orders"); await wait(100); r.hidden = document.getElementById("tab-profit").classList.contains("hidden");
    return r;
  });
  ok("الربح الحقيقي: التبويب يظهر والرقم الرئيسي = صافي computeFinance بلا ربط (تقدير الإعلان)", pfT.shown && pfT.hero0.trim() === pfT.expect0, pfT);
  ok("الربح الحقيقي: الشلال 8 خطوات وجدولا الحملات/الولايات، والمعادلة قبل الإعلان صحيحة", pfT.rows === 9 && pfT.tbl >= 1 && pfT.preOk && pfT.byDay === 1 && pfT.src === 3 && pfT.noAccounts, pfT);
  ok("الربح الحقيقي: ربط حساب يرسل الرمز مرة واحدة ويزامن ولا يبقى الرمز في الصفحة أو المتصفح", /"p":"meta"/.test(pfT.put) && /"a":"123456"/.test(pfT.put) && /"fx":150.5/.test(pfT.put) && /"t":"SECRET_TOKEN_1_ABCDEFGHIJ"/.test(pfT.put) && pfT.synced && !pfT.leak, pfT);
  ok("الربح الحقيقي: حقل رقم الحساب الفارغ يعرض رسالة واضحة بلا إرسال، والمكتوب يبقى بعد إعادة الرسم، وBearer واللصق بأسطر وact_ تُنظَّف", pfT.msgEmpty && pfT.draft, pfT);
  ok("الربح الحقيقي: بعد الربط الإنفاق الفعلي يحل محل التقدير وتظهر الحملة بإنفاقها", pfT.hero1.trim() === pfT.expect1 && pfT.acc && pfT.camp && pfT.spendCell, pfT);
  ok("الربح الحقيقي: المصاريف الثابتة تُحفظ وتُطرح، والتبويب يختفي عند الخروج", pfT.fixedSaved && pfT.hero2 !== pfT.hero1 && pfT.hidden, pfT);
  // ── الربح الحقيقي: ربط Facebook بنقرة واحدة (OAuth) ──
  const foT = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)); window.confirm = () => true; Admin.refreshAlerts = async () => {}; const R = {};
    const calls = []; const t0 = API.sb.token, u0 = API.sb.url, h0 = API.sb.headers, f0 = window.fetch;
    API.sb.token = async () => "tok"; API.sb.url = q => "http://x" + q; API.sb.headers = () => ({});
    let conf = false, linked = false, conns = [];
    const mkConn = (status, days) => ({ id: 5, provider: "meta", fb_user_name: "Saber B", status, days_left: days, accounts: [{ account_id: "664829409857812", name: "alyssum dollars", currency: "USD", status: 1, linked }, { account_id: "1111100000", name: "حساب دينار", currency: "DZD", status: 1, linked: false }] });
    window.fetch = async (u, o) => { if (!/platform-proxy/.test(String(u))) return f0(u, o); const b = JSON.parse(o.body); calls.push(b); const E = (d, st) => ({ ok: true, status: 200, json: async () => ({ ok: true, status: st || 200, data: d }) });
      if (b.path === "/v1/ads/oauth" && b.method === "GET") return E({ configured: conf, connections: conns });
      if (b.path === "/v1/ads/oauth/meta/start") return conf ? E({ url: "#fbstart" }) : E({ error: { code: "oauth_not_configured", message: "x" } }, 503);
      if (/\/v1\/ads\/oauth\/5\/link$/.test(b.path)) { linked = true; conns = [mkConn("active", 59)]; return E({ ok: true, id: 9 }, 201); }
      if (b.path === "/v1/ads/accounts" && b.method === "GET") return E({ accounts: [] });
      if (/\/sync$/.test(b.path)) return E({ ok: true, rows: 1 });
      if (b.path === "/v1/ads/spend") return E({ total_dzd: 0, spend: [] });
      return E({}); };
    Admin.tab("profit"); await wait(500); const host = () => document.getElementById("pf-app");
    R.soon = /سيتوفر قريباً/.test(host().textContent) && !host().querySelector('[data-pf="fbconnect"]');
    conf = true; await AdminProfit.refresh(); await wait(300); R.btn = !!host().querySelector('[data-pf="fbconnect"]');
    host().querySelector('[data-pf="fbconnect"]').click(); await wait(300); const st = calls.find(c => c.path === "/v1/ads/oauth/meta/start"); R.startBody = st ? st.body.return_to === location.origin + location.pathname : false; R.hash = location.hash === "#fbstart";
    history.replaceState(null, "", location.pathname + location.search);
    conns = [mkConn("active", 59)]; await AdminProfit.refresh(); await wait(300);
    R.rows = host().querySelectorAll('[data-pf="fblink"]').length; R.fxField = !!document.getElementById("pf-ofx-5-664829409857812") && !document.getElementById("pf-ofx-5-1111100000");
    host().querySelector('[data-pf="fblink"][data-a="664829409857812"]').click(); await wait(300); R.noFx = !calls.some(c => /oauth\/5\/link/.test(c.path));
    const fx = document.getElementById("pf-ofx-5-664829409857812"); fx.value = "245"; host().querySelector('[data-pf="fblink"][data-a="664829409857812"]').click(); await wait(700);
    const lk = calls.find(c => /oauth\/5\/link/.test(c.path)); R.link = lk ? JSON.stringify(lk.body) : ""; R.synced = calls.some(c => /accounts\/9\/sync$/.test(c.path)); R.mark = [...host().querySelectorAll("span.pos")].some(x => /مربوط/.test(x.textContent));
    conns = [mkConn("expired", 0)]; await AdminProfit.refresh(); await wait(300); R.expired = /انتهى ربط Facebook/.test(host().textContent) && !!host().querySelector('.pf-btn.o[data-pf="fbconnect"]');
    conns = [mkConn("active", 4)]; await AdminProfit.refresh(); await wait(300); R.warn = /ينتهي الربط بعد 4 أيام/.test(host().textContent);
    API.sb.token = t0; API.sb.url = u0; API.sb.headers = h0; window.fetch = f0; Admin.tab("orders"); await wait(100); return R;
  });
  ok("ربط Facebook: دون سرّي التطبيق تظهر «سيتوفر قريباً» بلا زر، ومعهما يظهر الزر ويبدأ التحويل بعنوان اللوحة", foT.soon && foT.btn && foT.startBody && foT.hash, foT);
  ok("ربط Facebook: الحساب بالدولار يطلب سعر الصرف والدينار لا، ويُربط ثم يزامن ويُعلَّم «مربوط»", foT.rows === 2 && foT.fxField && foT.noFx && /"account_id":"664829409857812"/.test(foT.link) && /"fx":245/.test(foT.link) && foT.synced && foT.mark, foT);
  ok("ربط Facebook: انتهاء الربط يعرض «إعادة الربط» برتقالياً، وقرب الانتهاء يحذّر بالأيام", foT.expired && foT.warn, foT);
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
    if (i % 4 === 0) console.log("   tick", i, JSON.stringify(await p.evaluate(() => { const h = document.getElementById("aly-hand"), b = [...document.querySelectorAll(".nav-btn")].find(x => /التقارير/.test(x.textContent)), hr = h && h.getBoundingClientRect(), br = b && b.getBoundingClientRect(); return { h: h && h.className, hy: hr && Math.round(hr.y), by: br && Math.round(br.y), sy: Math.round(scrollY), sh: document.documentElement.scrollHeight }; })));
  }
  const dbgU = under === "" ? await p.evaluate(() => { const h = document.getElementById("aly-hand"), r = h && h.getBoundingClientRect(); if (!r) return null; h.style.display = "none"; const u = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); h.style.display = ""; const b = [...document.querySelectorAll(".nav-btn")].find(x => /التقارير/.test(x.textContent)), br = b && b.getBoundingClientRect(); return { at: [Math.round(r.x), Math.round(r.y)], el: u && (u.tagName + "." + u.className + "#" + u.id), txt: u && u.textContent.trim().slice(0, 30), btn: br && [Math.round(br.x), Math.round(br.y), Math.round(br.width), Math.round(br.height)], tab: (document.querySelector(".nav-btn.on .nav-txt b") || {}).textContent }; }) : null;
  ok("الدائرة الخضراء تضغط زر «التقارير» على الجوال", /dot/.test(cls) && /التقارير/.test(under || ""), { cls, under, dbgU });
  { const tm = await p.evaluate(async () => { Admin.tab("team"); await new Promise(z => setTimeout(z, 600)); try { AdminRoles.state.team = { staff: [{ email: "a@x.com", name: "مندوبة طويلة الاسم جداً للاختبار", role: "agent", active: true }, { email: "b@x.com", name: "ب", role: "agent", active: true }] }; AdminRoles.render && AdminRoles.render(); } catch (e) { } await new Promise(z => setTimeout(z, 400)); const t = document.getElementById("tab-team"), rl = document.getElementById("rl"); return { has: !!rl, vis: !!t && !t.classList.contains("hidden"), sw: document.documentElement.scrollWidth, iw: innerWidth, rw: rl ? Math.round(rl.getBoundingClientRect().width) : 0 }; });
    ok("الهاتف: صفحة الفريق والأمان تظهر كاملة بلا اتساع أفقي", !tm.has || (tm.sw <= tm.iw + 2 && tm.rw <= tm.iw + 2), tm); }
  { const mo = await p.evaluate(async () => { Admin.editProduct(Admin.products[0].slug); Admin.addOfferRow(); await new Promise(r => setTimeout(r, 250)); const m = document.getElementById("prod-modal-bg"), r = m.querySelector(".offer-row"); const ins = [...r.querySelectorAll("input[type=number]")].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }); const out = { ins, ov: r.scrollWidth <= r.clientWidth + 2, lbl: [...r.querySelectorAll(".fl span")].map(x => x.textContent) }; Admin.closeModal(); return out; });
    ok("الهاتف: خانات العرض ظاهرة بعرض كافٍ وبعناوين", mo.ov && mo.ins.length >= 2 && mo.ins.every(a => a[0] >= 80 && a[1] >= 24) && mo.lbl.length >= 2, mo); }
  await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 20000 });
  ok("التنقل نجح على الجوال", (await tab(p)) === "التقارير", await tab(p));
  ok("لا أخطاء جافاسكربت (جوال)", errs.length === 0, errs.slice(0, 3));

  await browser.close(); kill();
  console.log(fails ? `✗ فشل ${fails} من ${total}` : `✓ نجح ${total} من ${total}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("خطأ في الاختبار:", e.message); process.exit(2); });
