// اختبار «المتجر الحقيقي» لمكتبة القوالب: يبني حزمة عميل نظيفة (make-template) ويثبّتها على خادم PHP محلي (بلا متجر/بيانات إنتاج)،
// يزرعها بمنتجات وفئات وطلبين حقيقيين عبر نموذج الطلب، ثم لكل قالب: تثبيته على الرئيسية ← فتح Page Builder ← تعديل نص ولون وصورة عبر لوحة الخصائص ومكتبة الصور
// ← الحفظ (مسودة تلقائية ثم «حفظ ونشر») ← إعادة تحميل اللوحة والمحرّر ← التحقق من بقاء التعديلات في المحرّر وظهورها في واجهة المتجر،
// وأن المنتجات والطلبات وإعدادات المتجر لم يُفقد منها شيء.
// التشغيل: NODE_PATH=/opt/node-tools/node_modules node tests/library-real-store.js    (LRS_TPLS=s-nexus,s-tech لتحديد قوالب، LRS_BROWSER=chromium|firefox|webkit للواجهة الأمامية)
const { chromium, firefox, webkit } = require("playwright");
const declareProtect = require("./_declared-protect");
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const { spawnSync, spawn } = require("child_process");
const PW = process.env.EQA_PASS || "TestPass12345", OUT = process.env.LRS_OUT || "/tmp/lrsout"; fs.mkdirSync(OUT, { recursive: true });
const TPLS = (process.env.LRS_TPLS || "s-nexus,s-nexus-food,s-tech").split(",");
const FRONT = { chromium, firefox, webkit }[process.env.LRS_BROWSER || "chromium"];
let BASE = process.env.EQA_BASE, STORE = process.env.EQA_STORE, phpProc = null;
if (!BASE) {      // حزمة عميل نظيفة + خادم php محلي (كما يفعل nexus-commerce.js)
  const root = path.join(__dirname, ".."), work = fs.mkdtempSync(path.join(os.tmpdir(), "lrs-")), pkg = path.join(root, "dist", "lrs-store-" + process.pid), upd = path.join(root, "dist", "lrs-update-" + process.pid);
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", path.relative(root, pkg), "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: root, encoding: "utf8" });
  const code = ((b.stdout || "").match(/[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/) || [])[0]; if (!code) { console.log("تعذّر بناء الحزمة", (b.stdout || "").slice(-300)); process.exit(2); }
  spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--update", "--out", path.relative(root, upd), "--name", "Mystore", "--wa", "213000000000"], { cwd: root, encoding: "utf8" });
  STORE = path.join(work, "www"); fs.cpSync(pkg, STORE, { recursive: true }); fs.cpSync(upd, STORE, { recursive: true, force: true }); fs.rmSync(pkg, { recursive: true, force: true }); fs.rmSync(upd, { recursive: true, force: true });
  const port = 18000 + Math.floor(Math.random() * 1500); BASE = "http://127.0.0.1:" + port;
  phpProc = spawn("php", ["-S", "127.0.0.1:" + port, "-t", STORE], { stdio: "ignore" }); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
  const r = spawnSync("curl", ["-s", "-X", "POST", BASE + "/install.php", "-d", `code=${code}&pw=${PW}&pw2=${PW}&name=Mystore&wa=213000000000`], { encoding: "utf8" }); if (!/تم التثبيت/.test(r.stdout || "")) { console.log("فشل تثبيت المتجر التجريبي"); phpProc.kill(); process.exit(2); }
  process.on("exit", () => { try { phpProc.kill(); fs.rmSync(work, { recursive: true, force: true }); } catch (e) { } });
}
STORE = STORE || "/tmp/nxdrv/www";
const DB = path.join(STORE, "api/_data/store.db"), sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const failures = [];
const ck = (g, n, c, x) => { if (c) pass++; else { fail++; failures.push(g + ": " + n); } console.log((c ? "PASS " : "FAIL ") + `[${g}] ${n}` + (x !== undefined && x !== "" ? "  — " + (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 300) : "")); };
const sha = b => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);
const dbq = sql => { const r = spawnSync("python3", ["-c", "import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);print(json.dumps(c.execute(sys.argv[2]).fetchall()))", DB, sql], { encoding: "utf8" }); try { return JSON.parse(r.stdout); } catch (e) { return null; } };
const resetRate = () => { try { spawnSync("python3", ["-c", "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute(\"UPDATE orders SET ip_hash='x'||ip_hash WHERE ip_hash NOT LIKE 'x%'\");c.execute('DELETE FROM rl');c.commit()", DB]); } catch (e) { } };
const uniqPhone = () => "055" + String(Math.floor(1000000 + Math.random() * 8999999));
const walk = fn => { const f = x => { fn(x); (x.cols || []).forEach(f); (x.widgets || []).forEach(f); (x.free || []).forEach(f); }; return s => s.forEach(f); };

// ── بيانات المتجر المزروعة: فئات ومنتجات (كما تكتبها اللوحة: data.js وp/<slug>/index.html) ──
const IM = n => "assets/img/tpl/" + n + ".webp", CATS = { fashion: "فئة اختبار أولى", tech: "فئة اختبار ثانية", beauty: "فئة اختبار ثالثة" };
const mkProd = i => ({ slug: "rs-p" + i, title: "منتج اختبار " + i, price: 2000 + i * 150, old: i % 3 === 0 ? 2600 + i * 150 : 0, cover: IM("acc_pink"), images: [IM("acc_pink"), IM("acc_round")], desc: "وصف منتج الاختبار رقم " + i + ".", cat: Object.keys(CATS)[i % 3], active: true, stock: 25, tags: [["best"], ["hot"], ["new"]][i % 3], offers: [{ qty: 1, price: 2000 + i * 150 }, { qty: 2, price: 3600 + i * 280 }] });
function seedStore() {
  const P = [1, 2, 3, 4, 5, 6, 7, 8].map(mkProd), df = path.join(STORE, "assets/js/data.js"); let t = fs.readFileSync(df, "utf8");
  t = t.replace(/var CATEGORIES = .*;\n/, "var CATEGORIES = " + JSON.stringify(CATS) + ";\n").replace(/var PRODUCTS = .*;\n?/, "var PRODUCTS = " + JSON.stringify(P) + ";\n"); fs.writeFileSync(df, t);
  const tpl = fs.readFileSync(path.join(STORE, "p/_template/index.html"), "utf8");
  for (const p of P) { for (const im of new Set([p.cover].concat(p.images))) for (const w of ["w480", "w720"]) { const s = path.join(STORE, im), d = path.join(STORE, im.replace(/\.webp$/, "." + w + ".webp")); try { if (fs.existsSync(s) && !fs.existsSync(d)) fs.copyFileSync(s, d); } catch (e) { } } const d = path.join(STORE, "p", p.slug); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "index.html"), tpl.replace(/\{\{SLUG\}\}/g, p.slug)); }
  fs.writeFileSync(path.join(STORE, "assets/data/checkout.json"), JSON.stringify({ steps: false, guard: { dup: false } }));
}
// ── بصمة «ما يجب ألا يُفقد»: المنتجات والفئات، الطلبات، إعدادات المتجر (ملفات البيانات والإعدادات + جدول admin_kv)، صفحات المنتجات ──
function fp() {
  const df = fs.readFileSync(path.join(STORE, "assets/js/data.js"), "utf8"), prods = (df.match(/var PRODUCTS = (.*);\n?/) || [])[1] || "", cats = (df.match(/var CATEGORIES = (.*);\n/) || [])[1] || "";
  const files = {}; const dd = path.join(STORE, "assets/data"); for (const f of fs.readdirSync(dd).filter(f => f.endsWith(".json")).sort()) files["data/" + f] = sha(fs.readFileSync(path.join(dd, f)));
  for (const f of ["assets/js/config.js", "assets/js/wilayas.js"]) { try { files[f] = sha(fs.readFileSync(path.join(STORE, f))); } catch (e) { } }
  const pp = {}; for (const d of fs.readdirSync(path.join(STORE, "p"))) { const f = path.join(STORE, "p", d, "index.html"); if (fs.existsSync(f)) pp[d] = sha(fs.readFileSync(f)); }
  return { prods: sha(prods), nProds: (JSON.parse(prods || "[]")).length, cats: sha(cats), orders: dbq("SELECT id,name,phone,wilaya,total,status,items FROM orders ORDER BY id"), kv: dbq("SELECT k,v FROM admin_kv ORDER BY k"), files, pp };
}
const diff = (a, b) => Object.keys(Object.assign({}, a, b)).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

(async () => {
  seedStore();
  const mkC = async (b, w = 1360, h = 900) => { const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" }); await declareProtect(c); return c; };
  const chr = await chromium.launch(), front = FRONT === chromium ? chr : await FRONT.launch();
  // 1) طلبان حقيقيان عبر نموذج الطلب في صفحة المنتج (مسار المنصة نفسه)
  for (let k = 1; k <= 2; k++) {
    resetRate(); const c = await mkC(front), p = await c.newPage(), reqs = []; p.on("response", r => { if (r.request().method() === "POST" && /[?&]r=(submit_order|order)/.test(r.url())) reqs.push(r.status()); });
    await p.goto(BASE + "/p/rs-p" + k + "/", { waitUntil: "load" }); await sleep(2800);
    await p.locator("#offers .offer").nth(1).click().catch(() => { }); await p.selectOption("#wilaya", { index: 16 }); await sleep(800);
    const cm = await p.$$eval("#commune option", o => o.length).catch(() => 0); if (cm > 1) await p.selectOption("#commune", { index: 1 }); else await p.fill("#commune", "بلدية").catch(() => { });
    await p.fill("#name", "عميل متجر حقيقي " + k); await p.fill("#phone", uniqPhone()); await p.locator("#order-form .btn-order, #order-form button[type=submit]").first().click(); await sleep(7000);
    ck("زرع", "طلب حقيقي رقم " + k + " من صفحة المنتج (POST 200)", reqs.includes(200), reqs); await c.close();
  }
  let F0 = fp(); ck("زرع", "المتجر المزروع: 8 منتجات وطلبان وإعدادات", F0.nProds === 8 && F0.orders && F0.orders.length === 2 && F0.kv, { n: F0.nProds, o: F0.orders && F0.orders.length });

  const actx = await chr.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage(); admin.on("dialog", d => d.accept());
  const jsErrs = []; admin.on("pageerror", e => jsErrs.push(e.message.slice(0, 160)));
  const openAdmin = async () => { await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && typeof PBApp !== "undefined" && typeof PBConvert !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500); };
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000);
  await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500); await openAdmin();
  await sleep(2500); F0 = fp();      // خط الأساس بعد أول دخول للوحة (تُنشئ اللوحة مفاتيح إعدادات أولية بنفسها s_auto_reg/stockcfg لا علاقة لها بالقوالب): المقارنة بعده تخصّ القوالب وحدها

  const ensureField = async sel => { for (const t of ["c", "s", "a"]) { const tab = admin.locator(`#pbx-insp [data-itab="${t}"]`); if (await tab.count()) { await tab.click().catch(() => { }); await sleep(250); } if (await admin.locator(sel).count()) return true; const accs = admin.locator("#pbx-insp [data-ac]"), n = await accs.count(); for (let i = 0; i < n; i++) { await accs.nth(i).click().catch(() => { }); await sleep(200); if (await admin.locator(sel).count()) return true; } } return !!(await admin.locator(sel).count()); };
  const setVal = async (sel, v) => { await admin.locator(sel).first().evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v); await sleep(500); };
  const find = type => admin.evaluate(t => { window.__h1only = true; let r = null; const F = [];  const f = (x) => { if (r) return; if (x.type === t && (t !== "heading" || (x.set && x.set.text && !x.set.tgr && (x.set.tag === "h1" || !window.__h1only))) && (t !== "image" || (x.set && x.set.src))) r = { id: x.id, set: JSON.parse(JSON.stringify(x.set || {})) }; (x.cols || []).forEach(f); (x.widgets || []).forEach(f); (x.free || []).forEach(f); }; PBApp.E.page.sections.forEach(f); if (!r && t === "heading") { window.__h1only = false; PBApp.E.page.sections.forEach(f); } return r; }, type);
  const visibleColor = id => admin.evaluate(wid => { const f = document.getElementById("pbx-frame"), el = f && f.contentDocument && f.contentDocument.querySelector(`[data-pb="${wid}"] .pb-t`); if (!el) return false; const c = getComputedStyle(el); return !/rgba\(0, 0, 0, 0\)|transparent/.test(c.webkitTextFillColor) && !/rgba\(0, 0, 0, 0\)|transparent/.test(c.color); }, id);
  const findHeading = async () => { const ids = await admin.evaluate(() => { const o = []; const f = x => { if (x.type === "heading" && x.set && x.set.text && !x.set.tgr) o.push({ id: x.id, h1: x.set.tag === "h1" }); (x.cols || []).forEach(f); (x.widgets || []).forEach(f); (x.free || []).forEach(f); }; PBApp.E.page.sections.forEach(f); return o.sort((a, b) => (b.h1 ? 1 : 0) - (a.h1 ? 1 : 0)); }); for (const c of ids) if (await visibleColor(c.id)) return admin.evaluate(id => { let r = null; const f = x => { if (x.id === id) r = { id: x.id, set: JSON.parse(JSON.stringify(x.set || {})) }; (x.cols || []).forEach(f); (x.widgets || []).forEach(f); (x.free || []).forEach(f); }; PBApp.E.page.sections.forEach(f); return r; }, c.id); return null; };
  const wset = id => admin.evaluate(id => { let r = null; const f = x => { if (x.id === id) r = JSON.parse(JSON.stringify(x.set || {})); (x.cols || []).forEach(f); (x.widgets || []).forEach(f); (x.free || []).forEach(f); }; PBApp.E.page.sections.forEach(f); return r; }, id);
  const selIs = id => admin.evaluate(x => PBApp.E.sel === x, id);
  const clearSel = async () => { for (let i = 0; i < 3; i++) { await admin.keyboard.press("Escape"); await sleep(100); } };
  const scrollToWidget = async id => { await admin.evaluate(wid => { const f = document.getElementById("pbx-frame"), el = f && f.contentDocument && f.contentDocument.querySelector(`[data-kind="widget"][data-pb="${wid}"]`); if (!el) return; const fr = f.getBoundingClientRect(), er = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + fr.top + er.top - window.innerHeight * 0.3)); }, id); await sleep(300); };
  const clickWidget = async id => {      // تحديد عنصر بنقرة فأرة حقيقية داخل القماش (محاولات من عدة نقاط كما يفعل pilot-editability)
    await clearSel(); const el = admin.frameLocator("#pbx-frame").locator(`[data-kind="widget"][data-pb="${id}"]`);
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75], [0.15, 0.3], [0.85, 0.7]]) { await scrollToWidget(id); await el.scrollIntoViewIfNeeded().catch(() => { }); await sleep(160); const bb = await el.boundingBox(); if (!bb || bb.width < 0.5 || bb.height < 0.5) continue; await admin.mouse.click(bb.x + bb.width * fx, bb.y + bb.height * fy); await sleep(350); if (await selIs(id)) return true; }
    return false;
  };
  const NEWTXT = "عنوان معدّل عبر لوحة الخصائص", NEWCOL = "#1a5f9e";

  for (const tid of TPLS) {
    console.log("\n════════ " + tid + " ════════"); const T = tid;
    const inst = await admin.evaluate(async id => { await AdminNav.libOpen(); try { await AdminNav.tplInstallHome(id); } catch (e) { return { err: e.message }; } for (let i = 0; i < 60 && !(PBApp.E && PBApp.E.page && PBApp.E.page.origin); i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 1800)); return { ok: !!(PBApp.E && PBApp.E.page && PBApp.E.page.origin), secs: PBApp.E.page.sections.length }; }, tid);
    ck(T, "تثبيت القالب على الرئيسية يفتح Page Builder", inst.ok && inst.secs >= 4, inst);
    if (await admin.locator("#pbx-ask [data-k=\"no\"]").count()) await admin.click("#pbx-ask [data-k=\"no\"]").catch(() => { }); await sleep(300);
    // ── تعديل: نص ولون (عنوان H1) وصورة (من مكتبة الصور) عبر لوحة الخصائص الحقيقية ──
    const h = await findHeading(), im = await find("image"); ck(T, "عنوان H1 وصورة موجودان في القالب", !!h && !!im, { h: h && h.set.text, im: im && im.set.src });
    const selH = await clickWidget(h.id); ck(T, "تحديد العنوان بنقرة فأرة حقيقية يفتح لوحة الخصائص", selH, selH); await sleep(500);
    const okTxt = await ensureField('#pbx-insp [data-k="text"]'); if (okTxt) await setVal('#pbx-insp [data-k="text"]', NEWTXT);
    const okCol = await ensureField('#pbx-insp input[data-k="color"][type="color"]'); if (okCol) await setVal('#pbx-insp input[data-k="color"][type="color"]', NEWCOL);
    let hs = await wset(h.id); ck(T, "تعديل النص واللون عبر لوحة الخصائص يصل النموذج", hs.text === NEWTXT && String(hs.color).toLowerCase() === NEWCOL, { text: hs.text, color: hs.color, okTxt, okCol });
    const selI = await clickWidget(im.id); ck(T, "تحديد الصورة بنقرة فأرة حقيقية", selI, selI); await sleep(500); let newImg = "";
    const libBtn = admin.locator('#pbx-insp [data-lib="src"]').first(); if (!(await libBtn.count())) await ensureField('#pbx-insp [data-lib="src"]');
    if (await admin.locator('#pbx-insp [data-lib="src"]').count()) { await admin.locator('#pbx-insp [data-lib="src"]').first().click(); await sleep(1200); await admin.locator('#pbx-lib [data-t="prod"]').first().click().catch(() => { }); await sleep(500); const pick = admin.locator("#pbx-lib [data-p]").nth(1); newImg = (await pick.getAttribute("data-p")) || ""; await pick.click(); await sleep(1200); }
    const is = await wset(im.id); ck(T, "تغيير الصورة من مكتبة الصور يصل النموذج", !!newImg && is.src === newImg && is.src !== im.set.src, { before: im.set.src, after: is.src });
    await sleep(1800);      // المسودة التلقائية (800ms)
    const draft = await admin.evaluate(() => { try { return Object.keys(localStorage).filter(k => /pbx|draft|pb_/i.test(k)).length; } catch (e) { return -1; } }); ck(T, "المسودة التلقائية محفوظة", draft !== 0, draft);
    // ── إعادة تحميل اللوحة والمحرّر قبل النشر: المسودة تُستعاد ──
    await openAdmin(); await admin.evaluate(async () => { await PBConvert.edit("home"); }); await sleep(3500);
    { const ok = admin.locator('#pbx-ask [data-k="ok"]').first(); try { await ok.waitFor({ state: "visible", timeout: 5000 }); await ok.click(); } catch (e) { } await sleep(1200); }      // نافذة «وُجدت مسودة… استرجاعها؟» (تظهر بعد 0.9ث) بنقرة حقيقية على «استرجاع المسودة»
    const back = await admin.evaluate(([a, b]) => { const s = JSON.stringify(PBApp.E.page.sections); return { txt: s.includes(a), img: s.includes(b), secs: PBApp.E.page.sections.length }; }, [NEWTXT, newImg]);
    ck(T, "بعد إعادة تحميل اللوحة وفتح المحرّر: التعديلات (نص/صورة) مستعادة من المسودة", back.txt && back.img, back);
    // ── «حفظ ونشر» عبر الزر الحقيقي ثم إعادة تحميل اللوحة والمحرّر ──
    await admin.click("#pbx-pubb"); await sleep(800); await admin.locator('#pbc-ask [data-m="direct"]').click(); await sleep(9000);
    const msg = await admin.evaluate(() => { const m = document.getElementById("pbx-msg"), pb = document.getElementById("pbx-pub"); return (m ? m.textContent : "") + (pb ? pb.textContent : ""); }); ck(T, "«حفظ ونشر» (حفظ مباشر) ينجح", !/ERR|تعذّر|فشل|❌/.test(msg), msg.slice(0, 120));
    await openAdmin(); await admin.evaluate(async () => { await PBConvert.edit("home"); }); await sleep(3500);
    const after = await admin.evaluate(([a, b, id]) => { const s = JSON.stringify(PBApp.E.page.sections); let col = null; const f = x => { if (x.id === id) col = x.set && x.set.color; (x.cols || []).forEach(f); (x.widgets || []).forEach(f); (x.free || []).forEach(f); }; PBApp.E.page.sections.forEach(f); return { txt: s.includes(a), img: s.includes(b), col }; }, [NEWTXT, newImg, h.id]);
    ck(T, "بعد النشر وإعادة تحميل اللوحة وإعادة فتح الرئيسية: النص واللون والصورة محفوظة في المحرّر", after.txt && after.img && String(after.col).toLowerCase() === NEWCOL, after);
    // ── واجهة المتجر الحقيقية بعد التعديل (زائر جديد) ──
    for (let round = 1; round <= 2; round++) {
      const c = await mkC(front), p = await c.newPage(), errs = [], bad = []; p.on("pageerror", e => errs.push(e.message.slice(0, 140))); p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE) && !/favicon|\/api\/|manifest|sw\.js|assets\/data\/checkout\.json/.test(r.url())) bad.push(r.status() + " " + r.url().replace(BASE, "")); });
      await p.goto(BASE + "/index.html", { waitUntil: "load", timeout: 60000 }); await sleep(2800); await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); }); await sleep(800);
      const sf = await p.evaluate(([txt, img]) => { const h1 = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,.pb-t")].find(e => e.textContent.includes(txt)); const im = [...document.images].find(i => (i.getAttribute("src") || "").includes(img.replace(/^.*\//, "").replace(/\.webp$/, "")) || (i.currentSrc || "").includes(img.replace(/^.*\//, "").replace(/\.webp$/, ""))); return { h1: !!h1, color: h1 ? getComputedStyle(h1.querySelector(".pb-t") || h1).color : null, img: !!im, imgOk: im ? im.naturalWidth > 0 : false, cards: document.querySelectorAll(".card, .pb-pc").length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }, [NEWTXT, newImg]);
      ck(T, `واجهة المتجر (زيارة ${round}، ${process.env.LRS_BROWSER || "chromium"}): العنوان المعدّل ولونه والصورة المختارة ظاهرة`, sf.h1 && sf.color === "rgb(26, 95, 158)" && sf.img && sf.imgOk, sf);
      ck(T, `واجهة المتجر (زيارة ${round}): منتجات المتجر الحقيقية ظاهرة بلا أخطاء JS ولا موارد مفقودة ولا تعدٍّ أفقي`, sf.cards >= 4 && !errs.length && !bad.length && sf.over <= 0, { cards: sf.cards, errs: errs.slice(0, 2), bad: bad.slice(0, 3), over: sf.over });
      if (round === 1) await p.screenshot({ path: path.join(OUT, T + "-store.png"), fullPage: true }); await c.close();
    }
    // ── سلامة البيانات: لا فقد للمنتجات ولا الطلبات ولا الإعدادات ولا صفحات المنتجات ──
    const F1 = fp();
    ck(T, "المنتجات والفئات لم تتغيّر (8 منتجات)", F1.prods === F0.prods && F1.cats === F0.cats && F1.nProds === 8, { before: F0.prods, after: F1.prods });
    ck(T, "الطلبات لم تُفقد ولم تتغيّر (الطلبان نفسهما)", JSON.stringify(F1.orders) === JSON.stringify(F0.orders), { n0: F0.orders.length, n1: F1.orders && F1.orders.length });
    const kvA = Object.fromEntries(F0.kv || []), kvB = Object.fromEntries(F1.kv || []), kvChanged = diff(kvA, kvB);
    ck(T, "إعدادات المتجر لم تتغيّر (ملفات البيانات + config.js + جدول الإعدادات)", diff(F0.files, F1.files).length === 0 && kvChanged.length === 0, { files: diff(F0.files, F1.files), kvChanged, sample: kvChanged.slice(0, 2).map(k => [k, String(kvA[k]).slice(0, 80), String(kvB[k]).slice(0, 80)]) });
    ck(T, "صفحات المنتجات لم تُمسّ", diff(F0.pp, F1.pp).length === 0, diff(F0.pp, F1.pp));
  }
  ck("عام", "لا أخطاء JS في لوحة الإدارة طوال الجلسة", jsErrs.length === 0, jsErrs.slice(0, 3));
  console.log(`\n${fail ? fail + " إخفاق: " + failures.join(" | ") : "✓ كل الفحوص نجحت"} (${pass} نجاح)`);
  await chr.close(); if (front !== chr) await front.close(); process.exit(fail ? 1 : 0);
})();
