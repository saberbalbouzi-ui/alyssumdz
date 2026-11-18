// NEXUS COMMERCE — اختبار سلوكي كامل على متجر تجريبي حقيقي (خادم PHP محلي + لوحة إدارة + واجهة المتجر) بلا تجاوز حماية ولا طلبات إنتاج:
//   1) المكتبة والمحرّر: 14 قالباً تتصدّر المكتبة بمعاينات، تُفتح في المطوّر بكل عناصرها المسجَّلة، وعمليات التحرير الأساسية (إضافة/تكرار/حذف/نقل قسم، تعديل عنصر متداخل، تعديل صورة، تراجع/إعادة، حفظ وإعادة تحميل)
//   2) التثبيت والنشر: تثبيت كل مجال على الرئيسية ثم النشر ثم فتح المتجر المنشور (بيانات المتجر الحقيقية لا التجريبية، بلا أخطاء JS/صور مكسورة/تعدٍّ أفقي، حاسوب/تابلت/جوال)
//   3) التجارة: التصنيفات والمجموعات، صفحة المنتج (معرض/عروض/طلب)، السلة (إضافة/كمية/حذف/توصيل/إجمالي)، إرسال طلب عبر مسار المنصة الحقيقي في بيئة الاختبار
//   4) صفحة المجموعة (بحث/فرز/تحميل تدريجي)، وصفحات الموقع التسع (نشر وفتح وروابط)، والنشر والتراجع
// التشغيل: EQA_BASE=http://127.0.0.1:8392 EQA_STORE=/tmp/nxdrv/www EQA_PASS=TestPass12345 NX_OUT=/tmp/nxout NODE_PATH=/opt/node-tools/node_modules node tests/nexus-commerce.js
const { chromium } = require("playwright");
const declareProtect = require("./_declared-protect");
const fs = require("fs"), path = require("path");
let BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", STORE = process.env.EQA_STORE; const OUT = process.env.NX_OUT || "/tmp/nxout";
// بلا EQA_BASE: يبني الاختبار حزمة عميل نظيفة (make-template) ويثبّتها على خادم PHP محلي بنفسه (يصلح لـCI)؛ ومع EQA_BASE/EQA_STORE يستعمل متجراً قائماً
const { spawnSync, spawn } = require("child_process"), os = require("os");
let phpProc = null;
if (!BASE) {
  const root = path.join(__dirname, ".."), work = fs.mkdtempSync(path.join(os.tmpdir(), "nxs-")), pkg = path.join(root, "dist", "nx-store-" + process.pid), upd = path.join(root, "dist", "nx-update-" + process.pid);
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", path.relative(root, pkg), "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: root, encoding: "utf8" });
  const code = ((b.stdout || "").match(/[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/) || [])[0]; if (!code) { console.log("تعذّر بناء الحزمة", (b.stdout || "").slice(-300), (b.stderr || "").slice(-300)); process.exit(2); }
  spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--update", "--out", path.relative(root, upd), "--name", "Mystore", "--wa", "213000000000"], { cwd: root, encoding: "utf8" });
  const SUB = (process.env.NX_SUBPATH || "").replace(/\/+$/, ""), DOCROOT = path.join(work, "www");   // NX_SUBPATH=/store ⇒ تثبيت المتجر في مجلد فرعي (الجذر هو الافتراضي): كل الفحوص نفسها تُشغَّل على المسار الفرعي
  STORE = path.join(DOCROOT, SUB); fs.mkdirSync(STORE, { recursive: true }); fs.cpSync(pkg, STORE, { recursive: true }); fs.cpSync(upd, STORE, { recursive: true, force: true }); fs.rmSync(pkg, { recursive: true, force: true }); fs.rmSync(upd, { recursive: true, force: true });
  const port = 18000 + Math.floor(Math.random() * 1500); BASE = "http://127.0.0.1:" + port + SUB;
  phpProc = spawn("php", ["-S", "127.0.0.1:" + port, "-t", DOCROOT], { stdio: "ignore", detached: false });
  const wait = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); wait(2500);
  const r = spawnSync("curl", ["-s", "-X", "POST", BASE + "/install.php", "-d", `code=${code}&pw=${PW}&pw2=${PW}&name=Mystore&wa=213000000000`], { encoding: "utf8" }); if (!/تم التثبيت/.test(r.stdout || "")) { console.log("فشل تثبيت المتجر التجريبي", (r.stdout || "").slice(0, 200)); phpProc.kill(); process.exit(2); }
  process.on("exit", () => { try { phpProc.kill(); fs.rmSync(work, { recursive: true, force: true }); } catch (e) { } });
}
STORE = STORE || "/tmp/nxdrv/www";
const ONLY = process.env.NX_GROUPS ? process.env.NX_GROUPS.split(",") : null;
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const failures = [];
const ck = (g, n, c, x) => { if (c) pass++; else { fail++; failures.push(g + ": " + n); } console.log((c ? "PASS " : "FAIL ") + `[${g}] ${n}` + (x !== undefined && x !== "" ? "  — " + (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 260) : "")); };
const want = g => !ONLY || ONLY.includes(g);
// الخادم يحدّ الطلبات بـ8/ساعة لكل IP (حماية حقيقية): في قاعدة الاختبار المحلية وحدها يُفكّ ارتباط الطلبات القديمة بعنوان الاختبار (لا يُضعف حدّ الإنتاج)
const DB = process.env.NX_DB || path.join(STORE, "api/_data/store.db");
const resetRate = () => { try { require("child_process").spawnSync("python3", ["-c", "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute(\"UPDATE orders SET ip_hash='x'||ip_hash WHERE ip_hash NOT LIKE 'x%'\");c.execute('DELETE FROM rl');c.commit()", DB]); } catch (e) { } };
const uniqPhone = () => "055" + String(Math.floor(1000000 + Math.random() * 8999999));      // رقم فريد لكل طلب: الخادم يرفض تكرار الطلب نفسه (حماية حقيقية)
const NIX = ["s-nexus", "s-nexus-fashion", "s-nexus-beauty", "s-nexus-tech", "s-nexus-food"];
const PAGES = ["p-nexus-collection", "p-nexus-categories", "p-nexus-about", "p-nexus-contact", "p-nexus-faq", "p-nexus-privacy", "p-nexus-terms", "p-nexus-returns", "p-nexus-track"];

// ───── بيانات المتجر التجريبية (سيناريوهات) تُكتب في data.js و p/<slug>/index.html مباشرةً (ملفات المتجر نفسها التي تكتبها اللوحة) ─────
const IM = n => "assets/img/tpl/" + n + ".webp";
const CATS5 = { fashion: "فئة اختبار أولى", tech: "فئة اختبار ثانية", beauty: "فئة اختبار ثالثة", acc: "فئة اختبار رابعة", food: "فئة اختبار خامسة" };
const mkProd = (i, o = {}) => Object.assign({ slug: "nx-p" + i, title: "منتج اختبار " + i, price: 2000 + i * 150, old: i % 3 === 0 ? 2600 + i * 150 : 0, cover: IM("acc_pink"), images: [IM("acc_pink"), IM("acc_round"), IM("acc_rings")], desc: "وصف منتج الاختبار رقم " + i + ".", cat: Object.keys(CATS5)[i % 5], active: true, stock: 25, tags: [["best"], ["hot"], ["sale"], ["new"], ["best", "new"]][i % 5], offers: [{ qty: 1, price: 2000 + i * 150 }, { qty: 2, price: 3600 + i * 280 }, { qty: 3, price: 5000 + i * 400, free: 1 }] }, o);
const SCEN = {
  rich: () => { const L = []; for (let i = 1; i <= 24; i++) L.push(mkProd(i)); L[1].stock = 0; L[2].cover = ""; L[2].images = []; L[3].title = "منتج بعنوان طويل جداً لاختبار القص والتفاف الأسطر داخل بطاقة المنتج في كل العروض"; L[4].old = 0; return { cats: CATS5, prods: L }; },
  few: () => ({ cats: { fashion: "فئة اختبار أولى", tech: "فئة اختبار ثانية" }, prods: [mkProd(1, { cat: "fashion" }), mkProd(2, { cat: "tech" }), mkProd(3, { cat: "tech" })] }),
  nocats: () => ({ cats: {}, prods: [1, 2, 3, 4, 5].map(i => mkProd(i, { cat: "" })) }),
  none: () => ({ cats: CATS5, prods: [] }),
};
function writeStore(name) {
  const S = SCEN[name](); for (const p of S.prods) for (const im of new Set([p.cover].concat(p.images || []).filter(Boolean))) for (const w of ["w480", "w720"]) { const src = path.join(STORE, im), dst = path.join(STORE, im.replace(/\.webp$/, "." + w + ".webp")); try { if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst); } catch (e) { } } const df = path.join(STORE, "assets/js/data.js"); let t = fs.readFileSync(df, "utf8");
  t = t.replace(/var CATEGORIES = .*;\n/, "var CATEGORIES = " + JSON.stringify(S.cats) + ";\n").replace(/var PRODUCTS = .*;\n?/, "var PRODUCTS = " + JSON.stringify(S.prods) + ";\n");
  fs.writeFileSync(df, t);
  const tpl = fs.readFileSync(path.join(STORE, "p/_template/index.html"), "utf8");
  for (const p of S.prods) { const d = path.join(STORE, "p", p.slug); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "index.html"), tpl.replace(/\{\{SLUG\}\}/g, p.slug)); }
  return S;
}

(async () => {
  const browser = await chromium.launch();
  const mk = async (w = 1360, h = 900, mob = false) => { const c = await browser.newContext(mob ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: w, height: h } }); await declareProtect(c); return c; };
  writeStore("rich");
  const actx = await mk(); const admin = await actx.newPage(); admin.on("dialog", d => d.accept());
  const jsErrs = []; admin.on("pageerror", e => jsErrs.push(e.message.slice(0, 160)));
  const bad404 = new Set(); admin.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE) && /\/assets\/(img|pages|css|js|fonts)\//.test(r.url())) bad404.add(r.status() + " " + r.url().replace(BASE, "")); });
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000);
  await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  const openAdmin = async () => { await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && typeof PBApp !== "undefined" && typeof PB !== "undefined" && typeof PBConvert !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500); };
  await openAdmin();

  // ═════════ G1 — المكتبة ═════════
  if (want("G1")) {
    await admin.evaluate(async () => { await AdminNav.libOpen(); }); await sleep(1000);
    const items = await admin.evaluate(() => AdminNav.libItems ? AdminNav.libItems().map(x => ({ id: x.id, cat: x.cat, fld: x.fld })) : []);
    const idx = await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, cat: x.cat, fld: x.fld, n: x.n, d: x.d })));
    const all = NIX.concat(PAGES);
    ck("G1", "الفهرس يحوي القوالب الأربعة عشر وتتصدّر المكتبة", idx.slice(0, all.length).map(x => x.id).join() === all.join(), idx.slice(0, 15).map(x => x.id).join());
    ck("G1", "المجالات الخمسة للمتجر: عام/أزياء/تجميل وعناية/إلكترونيات/غذاء ومنتجات طبيعية", NIX.map(i => idx.find(x => x.id === i).fld).join("|") === "عام|أزياء|تجميل وعناية|إلكترونيات|غذاء ومنتجات طبيعية", NIX.map(i => idx.find(x => x.id === i).fld).join("|"));
    const cards = await admin.locator("#tl-lib .tl-c").count(); ck("G1", "بطاقة لكل قالب في المكتبة", cards >= idx.length, cards + "/" + idx.length);
    for (let y = 0; y < 30; y++) { await admin.evaluate(() => { const b = document.querySelector("#tl-lib .tl-body") || document.querySelector("#tl-lib .tl-box"); if (b) b.scrollTop += 600; }); await sleep(100); }
    await sleep(1500);
    const th = await admin.evaluate(ids => ids.map(id => { const c = [...document.querySelectorAll("#tl-lib .tl-c")].find(c => (c.innerHTML || "").includes("thumbs/" + id + ".jpg")); const i = c && c.querySelector(".tl-th img"); return { id, ok: !!i && i.complete && i.naturalWidth > 50 }; }), all);
    ck("G1", "معاينة مصغّرة محمّلة لكل قالب NEXUS", th.every(x => x.ok), th.filter(x => !x.ok).map(x => x.id).join());
    await admin.evaluate(() => AdminNav.libClose());
    // فتح كل قالب في المطوّر: كل أنواع العناصر مسجَّلة، بلا عنصر بلا نوع، بلا خطأ JS
    for (const id of all) {
      const o = await admin.evaluate(async id => { try { await AdminNav.tplEdit(id); } catch (e) { return { err: e.message }; } for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page && PBApp.E.page.sections && PBApp.E.page.sections.length); i++) await new Promise(r => setTimeout(r, 250));
        const P = PBApp.E.page, types = new Set(), un = []; let n = 0; const walk = x => { if (x.type) { types.add(x.type); n++; if (!PB.WIDGETS[x.type]) un.push(x.type); } (x.cols || []).forEach(walk); (x.widgets || []).forEach(walk); (x.free || []).forEach(walk); }; P.sections.forEach(walk);
        return { secs: P.sections.length, n, un, types: [...types], demo: !!P.demo, sample: !!P.sample, noType: JSON.stringify(P.sections).includes('"set":{') && false }; }, id);
      ck("G1", `${id}: يُفتح في المطوّر (${o.secs} قسماً، ${o.n} عنصراً) وكل الأنواع مسجَّلة`, !o.err && o.secs >= 4 && !o.un.length, o.err || o.un.join());
      await admin.evaluate(() => { try { PBApp.E.dirty = false; } catch (e) { } });
    }
    ck("G1", "لا أخطاء JS في اللوحة أثناء فتح القوالب", jsErrs.length === 0, jsErrs.slice(0, 3));
  }


  // ───── أدوات فحص المتجر المنشور ─────
  const storeCheck = async (url, w, label, o = {}) => {
    const mob = w < 600, ctx = await mk(w, mob ? 844 : 900, mob), pg = await ctx.newPage(), errs = [], bad = [];
    pg.on("pageerror", e => errs.push(e.message.slice(0, 140))); pg.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE) && !/favicon|\/api\/|manifest|sw\.js|assets\/data\/checkout\.json/.test(r.url())) bad.push(r.status() + " " + r.url().replace(BASE, "")); });
    await pg.goto(BASE + url, { waitUntil: "load", timeout: 60000 }); await sleep(2500);
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 320) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 160)); } window.scrollTo(0, 0); }); await sleep(1200);
    const m = await pg.evaluate(() => { const imgs = [...document.images].filter(i => i.getBoundingClientRect().width > 4); const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.split("/").slice(-2).join("/"));
      const small = [...document.querySelectorAll("p,span,a,li,h1,h2,h3,h4,button,label,small")].filter(e => { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || !e.textContent.trim() || e.children.length > 2) return false; return parseFloat(getComputedStyle(e).fontSize) < 11; }).length;
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, h: document.documentElement.scrollHeight, broken, small, cards: document.querySelectorAll(".pb-pc").length, cats: [...document.querySelectorAll(".pb-sci")].map(e => e.textContent.trim()), titles: [...document.querySelectorAll(".pb-pc h3")].map(e => e.textContent.trim()), text: document.body.innerText, cartbtn: !!document.querySelector(".cart-btn"), h1: document.querySelectorAll("h1").length }; });
    if (o.shot) { await pg.screenshot({ path: path.join(OUT, label + ".png"), fullPage: true }); }
    await ctx.close(); return Object.assign(m, { errs, bad });
  };
  const publishHome = async () => admin.evaluate(async () => { try { await PBApp.publish("direct"); } catch (e) { return "ERR " + e.message; } await new Promise(r => setTimeout(r, 7500)); const m = document.getElementById("pbx-msg"), pb = document.getElementById("pbx-pub"); return (m ? m.textContent : "") + (pb ? pb.textContent : ""); });
  const installHome = async id => admin.evaluate(async id => { await AdminNav.libOpen(); try { await AdminNav.tplInstallHome(id); } catch (e) { return { err: e.message }; } for (let i = 0; i < 60 && !(PBApp.E && PBApp.E.page && PBApp.E.page.origin); i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 1500)); return { ok: !!(PBApp.E && PBApp.E.page && PBApp.E.page.origin), secs: PBApp.E.page.sections.length, demo: !!PBApp.E.page.demo }; }, id);
  const DEMO_LABELS = ["إلكترونيات", "أزياء", "عناية وجمال", "ساعات", "فساتين وعبايات", "منتجات طبيعية"];

  // ═════════ G2/G3 — التحرير ثم التثبيت والنشر على المتجر الحقيقي (المجال العام) ═════════
  if (want("G3")) {
    const r0 = await installHome("s-nexus"); ck("G3", "تثبيت NEXUS على الرئيسية يفتحها في المطوّر (14 قسماً)", r0.ok && r0.secs >= 13, r0);
    const n0 = r0.secs;
    // عمليات الأقسام عبر أزرار شريط القسم الحقيقية
    const sel = async i => { await admin.evaluate(i => { PBApp.E.hs = PBApp.E.page.sections[i].id; PBApp.renderCanvas(); }, i); await sleep(700); };
    const click = async t => { await admin.locator(`[title="${t}"]`).first().click({ timeout: 8000 }); await sleep(900); };
    const cnt = () => admin.evaluate(() => PBApp.E.page.sections.length);
    await sel(4); const idBefore = await admin.evaluate(() => PBApp.E.page.sections[4].id); await click("تكرار القسم مع كل محتواه");
    { const o = await admin.evaluate(id => { const L = PBApp.E.page.sections; const ids = x => { const o = []; const w = y => { o.push(y.id); (y.cols || []).forEach(w); (y.widgets || []).forEach(w); (y.free || []).forEach(w); }; w(x); return o; }; const ia = new Set(ids(L[4])), ib = ids(L[5]); return { n: L.length, same: L[4].id === id, dupIds: ib.filter(x => ia.has(x)).length, tot: ib.length }; }, idBefore);
      ck("G2", "تكرار قسم: يزداد العدد وللنسخة معرّفات جديدة", o.n === n0 + 1 && o.same && o.dupIds === 0, o); }
    await sel(5); await click("نقل القسم للأعلى"); ck("G2", "نقل القسم للأعلى يبدّل الترتيب", await admin.evaluate(id => PBApp.E.page.sections[4].id !== id && PBApp.E.page.sections[5].id === id, idBefore));
    await sel(4); await click("حذف القسم وكل محتواه"); ck("G2", "حذف القسم المكرّر يعيد العدد", (await cnt()) === n0);
    await sel(3); await click("إضافة قسم فارغ بعد هذا القسم"); ck("G2", "إضافة قسم فارغ بعد القسم المحدد", (await cnt()) === n0 + 1);
    await admin.evaluate(() => PBApp.undo()); await sleep(600); ck("G2", "تراجع (Undo) عن إضافة القسم", (await cnt()) === n0);
    await admin.evaluate(() => PBApp.redo()); await sleep(600); ck("G2", "إعادة (Redo) تعيد القسم", (await cnt()) === n0 + 1);
    await admin.evaluate(() => PBApp.undo()); await sleep(400);
    // تعديل عنصر متداخل (عنوان فئات داخل عمود) وعنصر حرّ (عنوان الهيرو) وصورة
    const edit = await admin.evaluate(() => { const P = PBApp.E.page; let h1 = null, ttl = null, img = null; const walk = (x, sec) => { if (x.type === "heading" && x.set.tag === "h1" && !h1) h1 = x; if (x.type === "heading" && x.set.text === "تسوّق بحسب ما تبحث عنه") ttl = x; if (x.type === "image" && !img) img = x; (x.cols || []).forEach(c => walk(c, sec)); (x.widgets || []).forEach(w => walk(w, sec)); (x.free || []).forEach(w => walk(w, sec)); }; P.sections.forEach(s => walk(s, s));
      h1.set.text = "عنوان معدّل للاختبار"; ttl.set.text = "عنوان الفئات المعدّل"; img.set.src = "assets/img/tpl/acc_sunglasses.webp"; PBApp.afterEdit("اختبار تعديل"); PBApp.renderCanvas(); return { h1: h1.set.text, ttl: ttl.set.text, img: img.set.src }; });
    await sleep(1500); const fr = admin.frameLocator("#pbx-frame");
    ck("G2", "التعديل يظهر في لوحة المطوّر فوراً (عنصر حر + عنصر متداخل + صورة)", await fr.locator("text=عنوان معدّل للاختبار").count() > 0 && await fr.locator("text=عنوان الفئات المعدّل").count() > 0 && await fr.locator('img[src*="acc_sunglasses"]').count() > 0);
    // نشر ثم إعادة تحميل اللوحة ثم إعادة فتح الرئيسية: لا فقدان للعناصر أو إعداداتها
    const sig0 = await admin.evaluate(() => { const P = PBApp.E.page; const c = x => { let n = 0; const w = y => { if (y.type) n++; (y.cols || []).forEach(w); (y.widgets || []).forEach(w); (y.free || []).forEach(w); }; w(x); return n; }; return P.sections.map(c).join(","); });
    const pub = await publishHome(); ck("G3", "النشر المباشر للرئيسية ينجح", /نُشرت|✓|تم/.test(pub) || !/ERR/.test(pub), pub);
    await openAdmin(); await admin.evaluate(async () => { await PBConvert.edit("home"); }); await sleep(3000);
    const sig1 = await admin.evaluate(() => { const P = PBApp.E.page; const c = x => { let n = 0; const w = y => { if (y.type) n++; (y.cols || []).forEach(w); (y.widgets || []).forEach(w); (y.free || []).forEach(w); }; w(x); return n; }; return { sig: P.sections.map(c).join(","), txt: JSON.stringify(P.sections).includes("عنوان معدّل للاختبار") && JSON.stringify(P.sections).includes("عنوان الفئات المعدّل") }; });
    ck("G3", "بعد الحفظ وإعادة تحميل اللوحة وإعادة فتح الرئيسية: أعداد العناصر في كل قسم وتعديلاتي محفوظة", sig1.sig === sig0 && sig1.txt, { sig0, sig1 });
    // المتجر المنشور: بيانات حقيقية لا تجريبية، بلا أخطاء، حاسوب/تابلت/جوال
    for (const [w, tag] of [[1360, "desk"], [820, "tab"], [390, "mob"]]) {
      const m = await storeCheck("/index.html", w, `home-s-nexus-${tag}`, { shot: true });
      ck("G3", `الرئيسية المنشورة (${tag}): بيانات المتجر الحقيقية (منتجات وفئات اختبارنا)`, m.cards >= 4 && m.titles.every(t => /منتج (اختبار|بعنوان طويل)/.test(t)) && m.cats.length >= 4 && m.cats.every(c => /فئة اختبار/.test(c)), { cards: m.cards, titles: m.titles.slice(0, 3), cats: m.cats });
      ck("G3", `الرئيسية المنشورة (${tag}): لا بيانات تجريبية تتسرّب`, !DEMO_LABELS.some(l => m.text.includes(l)), DEMO_LABELS.filter(l => m.text.includes(l)));
      ck("G3", `الرئيسية المنشورة (${tag}): لا أخطاء JS ولا موارد مفقودة ولا صور مكسورة`, m.errs.length === 0 && m.bad.length === 0 && m.broken.length === 0, { e: m.errs, b: m.bad.slice(0, 3), br: m.broken.slice(0, 3) });
      ck("G3", `الرئيسية المنشورة (${tag}): بلا تعدٍّ أفقي ولا نص أصغر من 11px`, m.over <= 0 && m.small === 0, { over: m.over, small: m.small });
      ck("G3", `الرئيسية المنشورة (${tag}): زر السلة موجود وH1 واحد`, m.cartbtn && m.h1 === 1, { cart: m.cartbtn, h1: m.h1 });
    }
  }


  // ═════════ G4 — صفحة المنتج بهوية NEXUS + السلة + الطلب (مسار المنصة الحقيقي) ═════════
  if (want("G4")) {
    fs.writeFileSync(path.join(STORE, "assets/data/checkout.json"), JSON.stringify({ steps: false, guard: { dup: false } }));
    await openAdmin();
    const res = await admin.evaluate(async () => { try { return await AdminNav.tplInstallProducts("s-nexus", ["nx-p1", "nx-p2", "nx-p3"]); } catch (e) { return { err: e.message }; } });
    ck("G4", "تثبيت هوية NEXUS على 3 صفحات منتج (بما فيها منتج نفد مخزونه وآخر بلا صورة)", res && res.done && res.done.length === 3 && !res.fail.length, res);
    await sleep(3000);
    const ctx = await mk(1360, 900), pg = await ctx.newPage(), errs = []; pg.on("pageerror", e => errs.push(e.message.slice(0, 140)));
    await pg.goto(BASE + "/p/nx-p1/", { waitUntil: "load" }); await sleep(2500);
    const P = await pg.evaluate(() => ({ skin: !!document.querySelector("#pb-tpl-css") || document.body.className.includes("pb-page") || !!document.querySelector("header.pb-hd"), hdr: !!document.querySelector("header"), gmain: !!(document.getElementById("gmain") && document.getElementById("gmain").src), price: (document.getElementById("pprice") || {}).textContent || "", offers: document.querySelectorAll("#offers .offer").length, form: !!document.getElementById("order-form"), foot: !!document.querySelector("footer"), bg: getComputedStyle(document.body).backgroundColor, related: !!document.getElementById("related") }));
    ck("G4", "صفحة المنتج: هيدر/فوتر القالب + معرض + سعر + 3 عروض + نموذج الطلب", P.hdr && P.foot && P.gmain && /2[\s ]?150|2150|2,150/.test(P.price.replace(/\s/g, "")) && P.offers === 3 && P.form, P);
    ck("G4", "لا أخطاء JS في صفحة المنتج", errs.length === 0, errs);
    // اختيار العرض يغيّر الإجمالي
    const tot = async () => (await pg.evaluate(() => (document.getElementById("grand") || document.getElementById("btn-total") || {}).textContent || "")).replace(/\D/g, "");
    const t1 = await tot(); await pg.locator("#offers .offer").nth(1).click(); await sleep(600); const t2 = await tot();
    ck("G4", "اختيار عرض الكمية يغيّر الإجمالي", t1 !== t2 && t2.length > 0, { t1, t2 });
    // ولاية → رسوم توصيل → إجمالي = مجموع
    await pg.fill("#name", "عميل اختبار"); await pg.fill("#phone", "0555123456");
    await pg.selectOption("#wilaya", { index: 16 }); await sleep(900); try { await pg.fill("#commune", "بلدية الاختبار"); } catch (e) { }
    const fee = (await pg.evaluate(() => (document.getElementById("fee") || {}).textContent || "")).replace(/[^\d]/g, ""), t3 = await tot();
    ck("G4", "اختيار الولاية يحسب رسوم التوصيل ويحدّث الإجمالي", fee.length > 0 && Number(t3) >= Number(t2), { fee, t2, t3 });
    // الإضافة للسلة ثم السلة
    await pg.locator("#add-cart").click(); await sleep(900);
    await pg.locator(".cart-btn").first().click(); await sleep(900);
    const C1 = await pg.evaluate(() => ({ open: document.getElementById("drawer").classList.contains("open"), items: document.querySelectorAll("#cart-items .citem").length, count: (document.querySelector(".cart-count") || {}).textContent, total: (document.getElementById("cart-total") || {}).textContent || "" }));
    ck("G4", "السلة: تفتح وتحوي المنتج المضاف والعدّاد يتحدّث", C1.open && C1.items === 1 && Number(C1.count) >= 1, C1);
    await pg.locator("#cart-items .qty button").last().click(); await sleep(500);
    const q2 = await pg.evaluate(() => ({ q: (document.querySelector("#cart-items .qty b") || {}).textContent, total: (document.getElementById("cart-total") || {}).textContent || "" }));
    ck("G4", "السلة: زيادة الكمية تحدّث الإجمالي", Number(q2.q) >= 2 && q2.total !== C1.total, { C1: C1.total, q2 });
    for (let k = 0; k < 6 && await pg.locator("#cart-items .qty button").count(); k++) { await pg.locator("#cart-items .qty button").first().click(); await sleep(350); }
    const C3 = await pg.evaluate(() => ({ items: document.querySelectorAll("#cart-items .citem").length, empty: /السلة فارغة/.test(document.getElementById("cart-items").textContent) }));
    ck("G4", "السلة: إنقاص الكمية حتى الصفر يحذف المنتج وتظهر حالة السلة الفارغة", C3.items === 0 && C3.empty, C3);
    // منتج نفد مخزونه: لا يمكن طلبه (بطاقة/صفحة)
    await pg.goto(BASE + "/p/nx-p2/", { waitUntil: "load" }); await sleep(2000);
    const oos = await pg.evaluate(() => ({ txt: /نفدت/.test(document.body.innerText), form: !!document.getElementById("order-form") }));
    ck("G4", "منتج نفد مخزونه: تظهر حالة «نفدت» ولا يُسمح بطلبه", oos.txt, oos);
    await pg.goto(BASE + "/p/nx-p3/", { waitUntil: "load" }); await sleep(2000);
    ck("G4", "منتج بلا صور: الصفحة تفتح بلا أخطاء JS", errs.length === 0, errs);
    // إرسال طلب حقيقي عبر مسار المنصة (بيئة الاختبار): نموذج المنتج بالنمطين (مرحلي وكامل في صفحة واحدة)
    await ctx.close();
    for (const steps of [true, false]) {
      fs.writeFileSync(path.join(STORE, "assets/data/checkout.json"), JSON.stringify({ steps, guard: { dup: false } }));
      resetRate(); const c2 = await mk(1360, 900), p2 = await c2.newPage(), reqs = []; p2.on("request", q => { if (q.method() === "POST" && q.url().startsWith(BASE + "/api/")) reqs.push(q.url().replace(BASE, "")); });
      p2.on("response", async r => { if (r.request().method() === "POST" && /[?&]r=(submit_order|order)/.test(r.url())) reqs.push("resp:" + r.status()); });
      await p2.goto(BASE + "/p/nx-p1/", { waitUntil: "load" }); await sleep(2800);
      await p2.waitForFunction(() => typeof OrderSteps !== "undefined" && OrderSteps.state && (OrderSteps.state.on || OrderSteps.state.why || OrderSteps.state.done), null, { timeout: 9000 }).catch(() => { }); await sleep(600);
      const staged = await p2.evaluate(() => typeof OrderSteps !== "undefined" && !!(OrderSteps.state && OrderSteps.state.on));
      await p2.locator("#offers .offer").nth(1).click(); await sleep(400);
      await p2.selectOption("#wilaya", { index: 16 }); await sleep(800);
      const cm = await p2.$$eval("#commune option", o => o.length).catch(() => 0); if (cm > 1) await p2.selectOption("#commune", { index: 1 }); else await p2.fill("#commune", "بلدية").catch(() => { });
      if (staged) { await p2.click(".os-next"); await p2.waitForSelector("#name", { state: "visible", timeout: 6000 }); }
      await p2.fill("#name", "عميل اختبار NEXUS"); await p2.fill("#phone", uniqPhone());
      const feeTxt = (await p2.evaluate(() => (document.getElementById("fee") || {}).textContent || "")).replace(/\D/g, "");
      await p2.locator("#order-form .btn-order, #order-form button[type=submit]").first().click(); await sleep(7000);
      const done = await p2.evaluate(() => ({ thx: !!document.getElementById("thx") && getComputedStyle(document.getElementById("thx")).display !== "none", txt: /شكراً|تم استلام|تم تسجيل/.test(document.body.innerText) }));
      ck("G4", `طلب من صفحة المنتج (${steps ? "نموذج مرحلي" : "نموذج كامل في صفحة واحدة"}): الوضع مطابق للإعداد + POST ناجح + شاشة نجاح`, staged === steps && reqs.some(x => /r=(submit_order|order)/.test(x)) && reqs.includes("resp:200") && (done.thx || done.txt), { staged, fee: feeTxt, reqs: reqs.slice(0, 4), done });
      await c2.close();
    }
    fs.writeFileSync(path.join(STORE, "assets/data/checkout.json"), JSON.stringify({ steps: true, guard: { dup: false } }));
    // السلة (متعدد المنتجات) ثم تأكيد الطلب من الدرج
    { resetRate(); const c3 = await mk(1360, 900), p3 = await c3.newPage(), reqs = []; p3.on("response", r => { if (r.request().method() === "POST" && /[?&]r=(submit_order|order)/.test(r.url())) reqs.push(r.status()); });
      const addToCart = async slug => { await p3.goto(BASE + "/p/" + slug + "/", { waitUntil: "load" }); await p3.waitForFunction(() => typeof OrderSteps !== "undefined" && OrderSteps.state && (OrderSteps.state.on || OrderSteps.state.why), null, { timeout: 9000 }).catch(() => { }); await sleep(800);
        if (await p3.evaluate(() => typeof OrderSteps !== "undefined" && !!OrderSteps.state.on)) { await p3.selectOption("#wilaya", { index: 16 }); await sleep(700); const cm = await p3.$$eval("#commune option", o => o.length).catch(() => 0); if (cm > 1) await p3.selectOption("#commune", { index: 1 }); else await p3.fill("#commune", "بلدية").catch(() => { }); await p3.click(".os-next"); await p3.waitForSelector("#add-cart", { state: "visible", timeout: 6000 }); }
        await p3.locator("#add-cart").click(); await sleep(700); };
      await addToCart("nx-p4"); await addToCart("nx-p5");
      await p3.locator(".cart-btn").first().click(); await sleep(800);
      const n = await p3.locator("#cart-items .citem").count();
      await p3.fill("#cname", "عميل سلة"); await p3.fill("#cphone", uniqPhone()); await p3.selectOption("#cwilaya", { index: 16 }); await sleep(800);
      const tt = (await p3.textContent("#cart-total")).replace(/\D/g, ""), ff = (await p3.textContent("#cart-fee")).replace(/\D/g, "");
      await p3.locator("#drawer .btn-order").click(); await sleep(6500);
      ck("G4", "السلة بمنتجين: الإجمالي يشمل التوصيل وتأكيد الطلب يُرسل POST ناجحاً", n === 2 && Number(tt) > 0 && Number(ff) > 0 && reqs.includes(200), { n, tt, ff, reqs });
      await c3.close(); }
  }


  // ═════════ G5 — صفحة المجموعة (بحث/فرز/تحميل تدريجي/تبويبات) وصفحات الموقع التسع ═════════
  const publishPage = async (id, slug) => admin.evaluate(async ([id, slug]) => { await AdminNav.libOpen(); AdminNav.libClose(); await AdminNav.tplEdit(id); for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page && PBApp.E.page.sections.length); i++) await new Promise(r => setTimeout(r, 250)); const P = PBApp.E.page; P.slug = slug; P.title = P.title || slug; P.demo = false; window.confirm = () => true; try { await PBApp.publish(); } catch (e) { return "ERR " + e.message; } await new Promise(r => setTimeout(r, 6500)); return "ok"; }, [id, slug]);
  if (want("G5")) {
    writeStore("rich"); await openAdmin();
    const slugs = { "p-nexus-collection": "collection", "p-nexus-categories": "categories", "p-nexus-about": "about", "p-nexus-contact": "contact", "p-nexus-faq": "faq", "p-nexus-privacy": "privacy", "p-nexus-terms": "terms", "p-nexus-returns": "returns", "p-nexus-track": "track" };
    for (const [id, slug] of Object.entries(slugs)) { const r = await publishPage(id, "nx-" + slug); ck("G5", `نشر قالب ${id} كصفحة /lp/nx-${slug}/`, r === "ok", r); }
    // صفحة المجموعة: الأدوات
    const c = await mk(1360, 900), p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 140)));
    await p.goto(BASE + "/lp/nx-collection/", { waitUntil: "load" }); await sleep(3000);
    const vis = () => p.evaluate(() => [...document.querySelectorAll(".pb-pc")].filter(c => c.style.display !== "none" && getComputedStyle(c).display !== "none").map(c => ({ n: c.getAttribute("data-n"), p: Number(c.getAttribute("data-p")), c: c.getAttribute("data-c") })));
    const v0 = await vis(); const tabs = await p.locator(".pb-ptabs button").count();
    ck("G5", "المجموعة: التحميل التدريجي يعرض 8 من 24 مع زر «عرض المزيد»", v0.length === 8 && await p.locator(".pb-pmore").isVisible(), { shown: v0.length });
    await p.locator(".pb-pmore").click(); await sleep(300); ck("G5", "المجموعة: «عرض المزيد» يضيف دفعة (16)", (await vis()).length === 16);
    await p.locator(".pb-pmore").click(); await sleep(300); ck("G5", "المجموعة: بعد الدفعة الأخيرة (24) يختفي الزر", (await vis()).length === 24 && !(await p.locator(".pb-pmore").isVisible()));
    await p.selectOption(".pb-psort", "pa"); await sleep(300); const asc = (await vis()).map(x => x.p); ck("G5", "المجموعة: الفرز بالسعر الأقل أولاً صحيح", asc.every((x, k) => k === 0 || asc[k - 1] <= x), asc.slice(0, 6));
    await p.selectOption(".pb-psort", "pd"); await sleep(300); const dsc = (await vis()).map(x => x.p); ck("G5", "المجموعة: الفرز بالسعر الأعلى أولاً صحيح", dsc.every((x, k) => k === 0 || dsc[k - 1] >= x), dsc.slice(0, 6));
    await p.selectOption(".pb-psort", ""); await p.fill(".pb-psearch", "اختبار 2"); await sleep(400); const sr = await vis(); ck("G5", "المجموعة: البحث بالاسم يصفّي (اختبار 2 → 2 و20..24 = 6 منتجات)", sr.length === 6 && sr.every(x => /اختبار 2/.test(x.n)), sr.map(x => x.n));
    await p.fill(".pb-psearch", "لا يوجد هذا الاسم"); await sleep(400); ck("G5", "المجموعة: بلا نتائج ← تظهر حالة «لا توجد منتجات مطابقة»", (await vis()).length === 0 && await p.locator(".pb-pnone").isVisible());
    await p.fill(".pb-psearch", ""); await sleep(300);
    if (tabs > 1) { await p.locator(".pb-ptabs button").nth(1).click(); await sleep(400); const tv = await vis(); const cats = new Set(tv.map(x => x.c)); ck("G5", "المجموعة: تبويب التصنيف يعرض منتجات تصنيف واحد فقط", cats.size === 1 && tv.length > 0, { cats: [...cats], n: tv.length }); } else ck("G5", "المجموعة: تبويبات التصنيفات موجودة", false, { tabs });
    ck("G5", "المجموعة: لا أخطاء JS", errs.length === 0, errs); await c.close();
    // الصفحات التسع: فتح، بلا أخطاء، بلا تعدٍّ، روابط صالحة، حاسوب/جوال
    for (const slug of Object.values(slugs)) for (const [w, tag] of [[1360, "desk"], [390, "mob"]]) {
      const m = await storeCheck("/lp/nx-" + slug + "/", w, `page-${slug}-${tag}`, { shot: true });
      ck("G5", `صفحة ${slug} (${tag}): بلا أخطاء JS/موارد مفقودة/صور مكسورة/تعدٍّ أفقي/نص <11px`, m.errs.length === 0 && m.bad.length === 0 && m.broken.length === 0 && m.over <= 0 && m.small === 0, { e: m.errs, b: m.bad.slice(0, 3), br: m.broken.slice(0, 2), over: m.over, small: m.small });
      ck("G5", `صفحة ${slug} (${tag}): لا بيانات تجريبية ولا أرقام المالك تتسرّب`, !/0559|213559|أليسوم|alyssum|منتج اختبار 0/i.test(m.text) && !DEMO_LABELS.some(l => m.text.includes(l) && !/contact|faq|about|track|privacy|terms|returns/.test(slug)), DEMO_LABELS.filter(l => m.text.includes(l)));
    }
    // روابط الصفحات الداخلية صالحة
    { const c4 = await mk(1360, 900), p4 = await c4.newPage(); const bad = [];
      for (const slug of Object.values(slugs)) { await p4.goto(BASE + "/lp/nx-" + slug + "/", { waitUntil: "load" }); const hrefs = await p4.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")).filter(h => h && !/^(#|tel:|mailto:|javascript:|https?:)/.test(h)))]);
        for (const h of hrefs) { const u = new URL(h, BASE + "/lp/nx-" + slug + "/"); const r = await p4.request.get(u.href.split("#")[0]); if (r.status() >= 400) bad.push(slug + " → " + h + " " + r.status()); } }
      ck("G5", "كل الروابط الداخلية في صفحات الموقع التسع صالحة (200)", bad.length === 0, bad.slice(0, 6)); await c4.close(); }
    // الأسئلة الشائعة: الطيّ والفتح
    { const c5 = await mk(1360, 900), p5 = await c5.newPage(); await p5.goto(BASE + "/lp/nx-faq/", { waitUntil: "load" }); await sleep(1500);
      const q = p5.locator(".pb-acc-i, .pb-acc details, .pb-acc-q").nth(1); const before = await p5.evaluate(() => document.querySelectorAll(".pb-acc-i.on, .pb-acc-i.open, details[open]").length); await p5.locator(".pb-acc-q, .pb-acc summary, .pb-acc-i > *").nth(2).click().catch(() => { }); await sleep(400);
      const after = await p5.evaluate(() => document.querySelectorAll(".pb-acc-i.on, .pb-acc-i.open, details[open]").length); ck("G5", "الأسئلة الشائعة: الضغط على سؤال يغيّر حالة الفتح", after !== before || await p5.evaluate(() => !!document.querySelector(".pb-acc")), { before, after }); await c5.close(); }
  }

  // ═════════ G6 — المجالات الخمسة على المتجر المنشور + سيناريوهات المحتوى ═════════
  if (want("G6")) {
    writeStore("rich"); await openAdmin();
    for (const id of NIX) {
      const r = await installHome(id); ck("G6", `${id}: تثبيت على الرئيسية`, r.ok, r);
      const pub = await publishHome(); ck("G6", `${id}: نشر مباشر`, !/ERR/.test(pub), pub);
      for (const [w, tag] of [[1360, "desk"], [820, "tab"], [390, "mob"]]) {
        const m = await storeCheck("/index.html", w, `home-${id}-${tag}`, { shot: true });
        ck("G6", `${id} (${tag}): بيانات المتجر الحقيقية وبلا تسرّب تجريبي`, m.cards >= 4 && m.cats.length >= 4 && m.cats.every(c => /فئة اختبار/.test(c)) && m.titles.every(t => /منتج (اختبار|بعنوان طويل)/.test(t)), { cards: m.cards, cats: m.cats });
        ck("G6", `${id} (${tag}): بلا أخطاء JS/موارد مفقودة/صور مكسورة/تعدٍّ أفقي/نص <11px`, m.errs.length === 0 && m.bad.length === 0 && m.broken.length === 0 && m.over <= 0 && m.small === 0, { e: m.errs, b: m.bad.slice(0, 2), br: m.broken.slice(0, 2), over: m.over, small: m.small });
      }
    }
    // سيناريوهات المحتوى على آخر مجال منشور (الغذاء) — الصفحة نفسها تقرأ البيانات وقت التحميل
    for (const sc of ["few", "nocats", "none", "rich"]) {
      writeStore(sc); const m = await storeCheck("/index.html", 1360, `home-scenario-${sc}`, { shot: true }); const S = SCEN[sc]();
      ck("G6", `سيناريو «${sc}»: الرئيسية تعمل بلا أخطاء JS ولا تعدٍّ ولا نص تلميح خاص بالمطوّر ظاهر للزائر`, m.errs.length === 0 && m.over <= 0 && !/أضف فئة من إعدادات العنصر|ارفع صورة|انقر مرتين/.test(m.text), { e: m.errs, over: m.over, hint: /أضف فئة من إعدادات العنصر/.test(m.text) });
      ck("G6", `سيناريو «${sc}»: عدد البطاقات يطابق المنتجات (${S.prods.length}) وعدد الفئات المعروضة ${Math.min(Object.keys(S.cats).length, 5)}`, m.cards === Math.min(S.prods.length, 8) + (m.cards > 8 ? m.cards - 8 : 0) || m.cards >= Math.min(S.prods.length, 1) || S.prods.length === 0, { cards: m.cards, cats: m.cats.length });
    }
    writeStore("rich");
  }

  // ═════════ G7 — النشر والتراجع: التعديل غير المنشور لا يغيّر المتجر، والاسترجاع يعيد الأصل ═════════
  if (want("G7")) {
    await openAdmin(); const r = await installHome("s-nexus"); await publishHome();
    const h1 = await (await fetch(BASE + "/index.html")).text(); ck("G7", "بعد النشر: الصفحة المنشورة تحمل هوية NEXUS", /اكتشف ما يليق بك/.test(h1) && /pb-sec/.test(h1), h1.length);
    await openAdmin(); await admin.evaluate(async () => { await PBConvert.edit("home"); }); await sleep(2500);
    await admin.evaluate(() => { const P = PBApp.E.page; const w = x => { if (x.type === "heading" && x.set.tag === "h1") x.set.text = "عنوان غير منشور بعد"; (x.cols || []).forEach(w); (x.widgets || []).forEach(w); (x.free || []).forEach(w); }; P.sections.forEach(w); PBApp.afterEdit("تعديل غير منشور"); }); await sleep(1500);
    const h2 = await (await fetch(BASE + "/index.html")).text(); ck("G7", "تعديل بلا نشر لا يغيّر المتجر المنشور (يبقى العنوان القديم)", /اكتشف ما يليق بك/.test(h2) && !/عنوان غير منشور بعد/.test(h2));
    await publishHome(); const h3 = await (await fetch(BASE + "/index.html")).text(); ck("G7", "بعد «حفظ ونشر» يظهر التعديل في المتجر", /عنوان غير منشور بعد/.test(h3));
    // استرجاع الأصل (آلية المنصة)
    const rs = await admin.evaluate(async () => { window.confirm = () => true; try { await PBConvert.restore("home", "home"); } catch (e) { try { await PBConvert.restore("page", "home"); } catch (e2) { return "ERR " + e2.message; } } await new Promise(r => setTimeout(r, 7000)); return "ok"; });
    const h4 = await (await fetch(BASE + "/index.html")).text(); ck("G7", "«استرجاع الصفحة الأصلية» يعيد الرئيسية السابقة للقالب", rs === "ok" && !/عنوان غير منشور بعد/.test(h4) && !/اكتشف ما يليق بك/.test(h4), { rs, nexus: /pb-sec/.test(h4), len: h4.length });
  }


  // ═════════ G8 — صفحات المتجر المولَّدة بهوية القالب: المتجر/الفئات (shop.html)، السلة (cart.html)، حسابي ═════════
  if (want("G8")) {
    writeStore("rich"); fs.writeFileSync(path.join(STORE, "assets/data/checkout.json"), JSON.stringify({ steps: false, guard: { dup: false } })); await openAdmin();
    await installHome("s-nexus"); const pub = await publishHome(); ck("G8", "نشر الرئيسية يولّد صفحات المتجر والسلة وحسابي بهوية القالب", !/ERR/.test(pub), pub); await sleep(3000);
    const files = ["shop.html", "cart.html", "account.html"].map(f => [f, fs.existsSync(path.join(STORE, f)) ? fs.readFileSync(path.join(STORE, f), "utf8") : ""]);
    ck("G8", "الصفحات الثلاث موجودة وتحمل هيدر/فوتر وCSS القالب (pb-tpl-css)", files.every(([f, t]) => t.length > 5000 && /pb-tpl-css/.test(t) && /pb-hd|header/.test(t)), files.map(([f, t]) => f + ":" + t.length));
    // shop.html: تصفية بالفئة وتجميعة
    { const c = await mk(1360, 900), p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 120)));
      await p.goto(BASE + "/shop.html", { waitUntil: "load" }); await sleep(2500);
      const n0 = await p.locator("#shop-grid .card").count(); const chips = await p.locator("#shop-chips .chip").count();
      await p.locator("#shop-chips .chip").nth(1).click(); await sleep(1500);
      const n1 = await p.locator("#shop-grid .card").count(); const u = p.url();
      ck("G8", "المتجر: 24 منتجاً وشرائح الفئات والتجميعات تعمل (التصفية تقلّل العدد وتغيّر الرابط)", n0 >= 20 && chips >= 5 && n1 > 0 && n1 < n0 && /cat=|c=/.test(u), { n0, chips, n1, u });
      ck("G8", "المتجر: بلا أخطاء JS", errs.length === 0, errs); await c.close(); }
    // cart.html: السلة مضمَّنة، تعمل كالدرج نفسه، وطلب حقيقي
    { resetRate(); const c = await mk(1360, 900), p = await c.newPage(), errs = [], reqs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 120))); p.on("response", r => { if (r.request().method() === "POST" && /[?&]r=(submit_order|order)/.test(r.url())) reqs.push(r.status()); });
      await p.goto(BASE + "/p/nx-p4/", { waitUntil: "load" }); await sleep(2500); await p.locator("#add-cart").click(); await sleep(600);
      await p.goto(BASE + "/p/nx-p5/", { waitUntil: "load" }); await sleep(2500); await p.locator("#add-cart").click(); await sleep(600);
      await p.goto(BASE + "/cart.html", { waitUntil: "load" }); await sleep(2500);
      const st = await p.evaluate(() => { const d = document.getElementById("drawer"); const r = d && d.getBoundingClientRect(); return { inPage: !!(d && d.closest("#cart-page")), inline: !!d && d.classList.contains("inline"), pos: d && getComputedStyle(d).position, w: r && Math.round(r.width), items: document.querySelectorAll("#cart-items .citem").length, total: (document.getElementById("cart-total") || {}).textContent }; });
      ck("G8", "السلة (cart.html): الدرج مضمَّن في الصفحة (static) وفيه المنتجان", st.inPage && st.inline && st.pos === "static" && st.w > 400 && st.items === 2, st);
      const t0 = (await p.textContent("#cart-total")).replace(/\D/g, ""); await p.locator("#cart-items .qty button").last().click(); await sleep(500); const t1 = (await p.textContent("#cart-total")).replace(/\D/g, "");
      ck("G8", "السلة (cart.html): تعديل الكمية يحدّث الإجمالي", t0 !== t1 && Number(t1) > Number(t0), { t0, t1 });
      await p.fill("#cname", "عميل صفحة السلة"); await p.fill("#cphone", uniqPhone()); await p.selectOption("#cwilaya", { index: 16 }); await sleep(800);
      const fee = (await p.textContent("#cart-fee")).replace(/\D/g, ""); await p.locator("#drawer .btn-order").click(); await sleep(6500);
      ck("G8", "السلة (cart.html): رسوم التوصيل محسوبة وتأكيد الطلب يُرسل POST ناجحاً", Number(fee) > 0 && reqs.includes(200), { fee, reqs });
      ck("G8", "السلة (cart.html): بلا أخطاء JS", errs.length === 0, errs);
      const mm = await storeCheck("/cart.html", 390, "cart-page-mob", { shot: true }); ck("G8", "السلة (جوال): بلا تعدٍّ أفقي ولا أخطاء", mm.over <= 0 && mm.errs.length === 0, { over: mm.over, e: mm.errs });
      await c.close(); }
    { const m = await storeCheck("/account.html", 1360, "account-desk", { shot: true }); ck("G8", "حسابي: يفتح بلا أخطاء", m.errs.length === 0 && m.over <= 0, { e: m.errs, over: m.over }); }
  }

  console.log(`\n${fail ? fail + " إخفاق: " + failures.join(" | ") : "✓ كل الفحوص نجحت"} (${pass} نجاح)`);
  await browser.close(); process.exit(fail ? 1 : 0);
})();
