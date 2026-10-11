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
  ok("بعد التعرّف: الميكروفون أخضر + تحية باسم المتجر", await p.evaluate(() => document.getElementById("ah-mic").classList.contains("on") && window.__spoken.some(x => /مرحباً Mystore/.test(x)) && localStorage.getItem("store_voice_enrolled") === "1"));
  await p.waitForTimeout(3500);
  await p.evaluate(() => { window.__spoken.length = 0; document.getElementById("ah-mic").click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById("ah-mic").click()); await p.waitForTimeout(400);
  ok("فتح لاحق: تحية فقط بلا إعادة تعرّف", await p.evaluate(() => window.__spoken.some(x => /مرحباً Mystore/.test(x)) && document.getElementById("ah-mic").classList.contains("on")));
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
  await p.evaluate(() => { window.__pub = 0; PBApp.publish = () => { window.__pub++; }; });
  await say(p, "احفظ وانشر الصفحة"); ok("مطوّر: النشر يطلب تأكيداً ولا ينفَّذ قبله", (await p.evaluate(() => window.__pub)) === 0);
  await p.evaluate(() => [...document.querySelectorAll("#av-bt button, .ah-panel button")].find(b => b.textContent === "نعم").click()); await p.waitForFunction(() => !AdminVoice.busy(), null, { timeout: 25000 }); await p.waitForTimeout(400);
  ok("مطوّر: بعد «نعم» يُنشر", (await p.evaluate(() => window.__pub)) === 1);
  await p.evaluate(() => { window.confirm = () => true; PBApp.close(); }); await p.waitForTimeout(600);
  ok("المحرّر أُغلق للاختبار التالي", await p.evaluate(() => !document.querySelector("#pb-app.on")));
  await pbSay("اضف صفحة جديدة باسم عروض الصيف");
  await p.waitForFunction(() => document.querySelector("#pb-app.on"), null, { timeout: 8000 }).catch(() => { });
  ok("مطوّر: صفحة جديدة بالاسم المنطوق", await p.evaluate(() => !!document.querySelector("#pb-app.on") && /عروض الصيف/.test(PBApp.E.page.title)), await p.evaluate(() => PBApp.E.page && PBApp.E.page.title));
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
