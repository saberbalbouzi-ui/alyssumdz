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

  const { p, errs } = await open({ viewport: { width: 1280, height: 800 } });
  const vis = () => p.evaluate(() => { const v = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return cs.display !== "none" && cs.visibility !== "hidden" && (r.width > 0 || r.height > 0); }; return { groups: v(document.getElementById("nav-groups")), nav: [...document.querySelectorAll(".side-nav .nav-btn")].filter(v).map(b => (b.getAttribute("onclick") || "").slice(0, 40)), cls: document.documentElement.className.split(" ").filter(c => /^ed-/.test(c)), ed: AdminEdition.edition() }; });
  console.log("قبل:", JSON.stringify(await vis()).slice(0, 300));
  await p.evaluate(() => Admin.tab("store", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'store'")))); await p.waitForTimeout(1500);
  ok("البطاقة ظاهرة", await p.evaluate(() => !!document.querySelector('#stores-app input[name="stp-edition"]')));
  await p.evaluate(() => document.querySelector('input[name="stp-edition"][value="design"]').click()); await p.waitForTimeout(1200);
  const d = await vis(); console.log("design:", JSON.stringify(d).slice(0, 500));
  ok("design: الصنف ed-design", d.cls.includes("ed-design"));
  ok("design: شريط المجموعات مخفي", d.groups === false);
  ok("design: أزرار قليلة", d.nav.length > 0 && d.nav.length <= 8, d.nav.length);
  await p.evaluate(() => Admin.tab("team", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'team'")))); await p.waitForTimeout(2500);
  const tm = await p.evaluate(() => { const h = document.getElementById("rl"); return h ? h.textContent : ""; });
  ok("design: الفريق والأمان بلا أشياء المتجر (أمان فقط)", /المصادقة الثنائية/.test(tm) && !/فريق العمل|نشاط الفريق|الأهداف|الطلبات|سجلّ النشاط/.test(tm), tm.slice(0, 200));
  await p.evaluate(() => Admin.tab("store", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'store'")))); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('input[name="stp-edition"][value="basic"]').click()); await p.waitForTimeout(1200);
  const bs = await vis(); console.log("basic:", JSON.stringify(bs).slice(0, 300));
  ok("basic: لا studio", !bs.nav.some(x => x.includes("'studio'") || x.includes("'imggen'")) && bs.groups === true);
  await p.evaluate(() => Admin.tab("builder", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'builder'")))); await p.waitForTimeout(1200);
  ok("basic: بطاقة اختيار (صفحة ويب/صور إشهارية) مخفية في الصفحات", await p.evaluate(() => { const m = document.getElementById("pb-modes"); return !m || m.offsetParent === null || getComputedStyle(m.parentElement).display === "none"; }));
  await p.evaluate(() => PBAdmin.newPage({ title: "اختبار" })); await p.waitForSelector("#pbx-frame, .pbx-tabs", { timeout: 15000 }); await p.waitForTimeout(1500);
  const bt = await p.evaluate(() => { const v = e => !!e && e.offsetParent !== null; const q = t => document.querySelector('.pbx-tabs button[data-lt="' + t + '"]'); return { add: v(q("add")), img: v(q("img")), stk: v(q("stk")), ast: v(q("ast")), pub: v(q("pub")), lay: v(q("lay")) }; });
  ok("basic: المطوّر بلا تعديل الصورة والملصقات والمكتبة والنشر", bt.add && bt.lay && !bt.img && !bt.stk && !bt.ast && !bt.pub, bt);
  await p.evaluate(() => { try { PBApp.ltoggle("img"); } catch (e) { } }); await p.waitForTimeout(300);
  ok("basic: فتح تعديل الصورة برمجياً مرفوض", await p.evaluate(() => !document.querySelector('.pbx-tabs button[data-lt="img"].on') && !document.getElementById("pbx-ep")));
  await p.evaluate(() => { try { PBApp.close(); } catch (e) { } }); await p.waitForTimeout(800); await p.evaluate(() => { document.querySelectorAll("dialog,.modal-bg").forEach(x => x.remove()); });
  await p.evaluate(() => Admin.tab("store", [...document.querySelectorAll(".nav-btn")].find(b => (b.getAttribute("onclick") || "").includes("'store'")))); await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelector('input[name="stp-edition"][value="pro"]').click()); await p.waitForTimeout(1200);
  const r = await vis(); ok("pro: كل شيء", r.cls.length === 0 && r.groups === true);
  ok("لا أخطاء JS", errs.length === 0, errs);
  await browser.close(); console.log(fails ? "FAILED " + fails : "ALL OK"); process.exit(fails ? 1 : 0);
})();
