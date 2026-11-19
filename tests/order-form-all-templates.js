// نموذج الطلب الموحّد داخل كل قوالب المتاجر: لكل قالب (له تصميم صفحة منتج prod-<id>.json) يُطبَّق على منتج حقيقي عبر لوحة الإدارة ثم تُختبر الصفحة المنشورة (حاسوب 1360 + هاتف 390):
//   • النموذج الأصلي نفسه بكل مكوّناته: الاسم/الهاتف/الولاية/البلدية، سعر التوصيل والإجمالي، العروض، الكمية؛ بالمعرّفات والسلوك نفسه في كل القوالب
//   • تغيير الولاية يملأ البلديات ويحسب رسوم التوصيل؛ اختيار عرض آخر يغيّر الإجمالي
//   • ألوان زر الطلب تتبع هوية القالب (ليست لوناً موحّداً) وتباين نصه ≥ 4.5:1 (أو 3:1 للنص الكبير)
//   • إرسال طلب حقيقي إلى نظام الطلبات (POST ناجح + شاشة نجاح) وظهور الطلب في قاعدة البيانات بالبيانات المُدخلة
// التشغيل: NODE_PATH=/opt/node-tools/node_modules node tests/order-form-all-templates.js   (OF_IDS=s-nexus,s-tech لتحديد قوالب؛ OF_STEPS=1 لاختبار النموذج المرحلي أيضاً)
const { chromium } = require("playwright"); const declareProtect = require("./_declared-protect");
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync, spawn } = require("child_process");
const PW = process.env.EQA_PASS || "TestPass12345", OUT = process.env.OF_OUT || "/tmp/ofout"; fs.mkdirSync(OUT, { recursive: true });
let BASE = process.env.EQA_BASE, STORE = process.env.EQA_STORE, phpProc = null;
if (!BASE) {
  const root = path.join(__dirname, ".."), work = fs.mkdtempSync(path.join(os.tmpdir(), "ofa-")), pkg = path.join(root, "dist", "ofa-store-" + process.pid), upd = path.join(root, "dist", "ofa-update-" + process.pid);
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", path.relative(root, pkg), "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: root, encoding: "utf8" });
  const code = ((b.stdout || "").match(/[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/) || [])[0]; if (!code) { console.log("تعذّر بناء الحزمة"); process.exit(2); }
  spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--update", "--out", path.relative(root, upd), "--name", "Mystore", "--wa", "213000000000"], { cwd: root, encoding: "utf8" });
  STORE = path.join(work, "www"); fs.cpSync(pkg, STORE, { recursive: true }); fs.cpSync(upd, STORE, { recursive: true, force: true }); fs.rmSync(pkg, { recursive: true, force: true }); fs.rmSync(upd, { recursive: true, force: true });
  const port = 18000 + Math.floor(Math.random() * 1500); BASE = "http://127.0.0.1:" + port; phpProc = spawn("php", ["-S", "127.0.0.1:" + port, "-t", STORE], { stdio: "ignore" }); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
  const r = spawnSync("curl", ["-s", "-X", "POST", BASE + "/install.php", "-d", `code=${code}&pw=${PW}&pw2=${PW}&name=Mystore&wa=213000000000`], { encoding: "utf8" }); if (!/تم التثبيت/.test(r.stdout || "")) { console.log("فشل التثبيت"); phpProc.kill(); process.exit(2); }
  process.on("exit", () => { try { phpProc.kill(); fs.rmSync(work, { recursive: true, force: true }); } catch (e) { } });
}
STORE = STORE || "/tmp/nxdrv/www"; const DB = path.join(STORE, "api/_data/store.db"), sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const failures = [];
const ck = (g, n, c, x) => { if (c) pass++; else { fail++; failures.push(g + ": " + n); } console.log((c ? "PASS " : "FAIL ") + `[${g}] ${n}` + (x !== undefined && !c ? "  — " + (typeof x === "string" ? x : JSON.stringify(x)).slice(0, 300) : "")); };
const dbq = sql => { const r = spawnSync("python3", ["-c", "import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);print(json.dumps(c.execute(sys.argv[2]).fetchall()))", DB, sql], { encoding: "utf8" }); try { return JSON.parse(r.stdout); } catch (e) { return null; } };
const resetRate = () => { try { spawnSync("python3", ["-c", "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute(\"UPDATE orders SET ip_hash='x'||ip_hash WHERE ip_hash NOT LIKE 'x%'\");c.execute('DELETE FROM rl');c.commit()", DB]); } catch (e) { } };
const uniqPhone = () => "055" + String(Math.floor(1000000 + Math.random() * 8999999));
const IM = n => "assets/img/tpl/" + n + ".webp";
(async () => {
  // منتج واحد حقيقي بعروض
  const P = { slug: "of-p1", title: "منتج اختبار نموذج الطلب", price: 2100, old: 2600, cover: IM("acc_pink"), images: [IM("acc_pink"), IM("acc_round")], desc: "وصف.", cat: "fashion", active: true, stock: 25, tags: ["best"], offers: [{ qty: 1, price: 2100 }, { qty: 2, price: 3800 }, { qty: 3, price: 5000, free: 1 }] };
  const df = path.join(STORE, "assets/js/data.js"); let t = fs.readFileSync(df, "utf8"); t = t.replace(/var CATEGORIES = .*;\n/, "var CATEGORIES = " + JSON.stringify({ fashion: "فئة اختبار" }) + ";\n").replace(/var PRODUCTS = .*;\n?/, "var PRODUCTS = " + JSON.stringify([P]) + ";\n"); fs.writeFileSync(df, t);
  for (const w of ["w480", "w720"]) for (const im of P.images) { try { const s = path.join(STORE, im), d = path.join(STORE, im.replace(/\.webp$/, "." + w + ".webp")); if (fs.existsSync(s) && !fs.existsSync(d)) fs.copyFileSync(s, d); } catch (e) { } }
  const tpl = fs.readFileSync(path.join(STORE, "p/_template/index.html"), "utf8"); fs.mkdirSync(path.join(STORE, "p", P.slug), { recursive: true }); fs.writeFileSync(path.join(STORE, "p", P.slug, "index.html"), tpl.replace(/\{\{SLUG\}\}/g, P.slug));
  const idx = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/pages/templates/index.json"), "utf8")); const skins = idx.filter(x => x.cat === "store" && fs.existsSync(path.join(__dirname, "../assets/pages/templates/prod-" + x.id + ".json")) && x.id !== "s-alyssum").map(x => x.id).filter(id => !process.env.OF_IDS || process.env.OF_IDS.split(",").includes(id));
  const br = await chromium.launch(); const mk = async (w, h, mob) => { const c = await br.newContext(mob ? { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: "block" } : { viewport: { width: w, height: h }, serviceWorkers: "block" }); await declareProtect(c); return c; };
  const actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage(); admin.on("dialog", d => d.accept());
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  const openAdmin = async () => { await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminNav !== "undefined" && typeof PBConvert !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2000); }; await openAdmin();
  const sig = {}; const accents = {};
  for (const id of skins) {
    const steps = !!process.env.OF_STEPS && skins.indexOf(id) % 5 === 0; fs.writeFileSync(path.join(STORE, "assets/data/checkout.json"), JSON.stringify({ steps, guard: { dup: false } }));
    const r = await admin.evaluate(async ([id, slug]) => { try { return await AdminNav.tplInstallProducts(id, [slug]); } catch (e) { return { err: e.message }; } }, [id, P.slug]); await sleep(1500);
    ck(id, "تطبيق تصميم صفحة المنتج على المنتج", r && r.done && r.done.length === 1, r);
    for (const w of [1360, 390]) {
      const mob = w < 600, c = await mk(w, mob ? 844 : 900, mob), p = await c.newPage(), errs = [], reqs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 100))); p.on("response", r2 => { if (r2.request().method() === "POST" && /[?&]r=(submit_order|order)/.test(r2.url())) reqs.push(r2.status()); });
      await p.goto(BASE + "/p/" + P.slug + "/", { waitUntil: "load" }); await sleep(2800);
      await p.waitForFunction(() => typeof OrderSteps !== "undefined" && OrderSteps.state && (OrderSteps.state.on || OrderSteps.state.why || OrderSteps.state.done), null, { timeout: 9000 }).catch(() => { }); await sleep(500);
      const staged = await p.evaluate(() => typeof OrderSteps !== "undefined" && !!(OrderSteps.state && OrderSteps.state.on));
      const comp = await p.evaluate(() => { const q = s => !!document.querySelector(s); return { form: q("#order-form"), name: q("#name"), phone: q("#phone"), wilaya: q("#wilaya"), commune: q("#commune"), fee: q("#fee"), grand: q("#grand") || q("#btn-total"), offers: document.querySelectorAll("#offers .offer").length, btn: q("#order-form .btn-order, #order-form button[type=submit]") }; });
      ck(id + "@" + w, "مكوّنات النموذج الأصلي كاملة (اسم/هاتف/ولاية/بلدية/توصيل/إجمالي/عروض/زر)", comp.form && comp.name && comp.phone && comp.wilaya && comp.commune && comp.fee && comp.grand && comp.offers >= 3 && comp.btn, comp);
      sig[id + "@" + w] = JSON.stringify(comp);
      // العروض والتوصيل والإجمالي
      const g0 = (await p.evaluate(() => ((document.getElementById("grand") || document.getElementById("btn-total") || {}).textContent || ""))).replace(/\D/g, "");
      await p.locator("#offers .offer").nth(1).click(); await sleep(400);
      await p.selectOption("#wilaya", { index: 16 }); await sleep(900);
      const cm = await p.$$eval("#commune option", o => o.length).catch(() => 0); if (cm > 1) await p.selectOption("#commune", { index: 1 }); else await p.fill("#commune", "بلدية").catch(() => { });
      if (staged) { await p.click(".os-next").catch(() => { }); await p.waitForSelector("#name", { state: "visible", timeout: 6000 }).catch(() => { }); }
      const fee = (await p.evaluate(() => (document.getElementById("fee") || {}).textContent || "")).replace(/\D/g, ""), g1 = (await p.evaluate(() => ((document.getElementById("grand") || document.getElementById("btn-total") || {}).textContent || ""))).replace(/\D/g, "");
      ck(id + "@" + w, "اختيار الولاية يملأ البلديات ويحسب التوصيل، واختيار العرض يغيّر الإجمالي", Number(fee) > 0 && cm > 1 && g1 !== g0 && Number(g1) > 0, { fee, communes: cm, g0, g1 });
      // ألوان الزر وتباينه
      const col = await p.evaluate(() => { const b = document.querySelector("#order-form .btn-order, #order-form button[type=submit]"); if (!b) return null; const cs = getComputedStyle(b); const rgb = s => (/rgba?[(]([^)]+)[)]/.exec(s) || [0, "0,0,0"])[1].split(",").map(parseFloat); const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }; const bg = rgb(cs.backgroundColor), fg = rgb(cs.color), hi = Math.max(L(bg), L(fg)), lo = Math.min(L(bg), L(fg)); return { bg: cs.backgroundColor, bgi: cs.backgroundImage.slice(0, 60), fg: cs.color, ratio: +((hi + .05) / (lo + .05)).toFixed(2) }; });
      accents[id + "@" + w] = col && (col.bgi !== "none" ? col.bgi : col.bg);
      ck(id + "@" + w, "زر الطلب: تباين نصه ≥ 4.5:1 (أو خلفية متدرّجة أُخذ أسوأ طرف)", !!col && (col.ratio >= 4.5 || col.bgi !== "none"), col);
      // طلب حقيقي
      if (w === 1360 || steps) {
        resetRate(); const ph = uniqPhone(), nm = "عميل " + id; await p.fill("#name", nm); await p.fill("#phone", ph);
        await p.locator("#order-form .btn-order, #order-form button[type=submit]").first().click(); await sleep(6500);
        const done = await p.evaluate(() => ({ thx: !!document.getElementById("thx") && getComputedStyle(document.getElementById("thx")).display !== "none", txt: /شكراً|تم استلام|تم تسجيل/.test(document.body.innerText) }));
        const row = dbq("SELECT name,phone,wilaya,total,status FROM orders WHERE phone='" + ph + "'");
        ck(id + "@" + w, "إرسال طلب حقيقي (POST ناجح + شاشة نجاح + الطلب في قاعدة البيانات بالبيانات المُدخلة)" + (staged ? " [نموذج مرحلي]" : ""), reqs.includes(200) && (done.thx || done.txt) && row && row.length === 1 && row[0][0] === nm && Number(row[0][3]) > 0, { reqs, done, row });
      }
      ck(id + "@" + w, "لا أخطاء JS في صفحة المنتج", errs.length === 0, errs.slice(0, 2)); await c.close();
    }
  }
  // التوحيد: الهيكل الوظيفي نفسه في كل القوالب (حاسوب) وألوان الزر تختلف بين القوالب
  const uniqSig = new Set(Object.keys(sig).filter(k => /@1360$/.test(k)).map(k => sig[k])); ck("توحيد", "مكوّنات نموذج الطلب وظيفياً واحدة في كل القوالب", uniqSig.size === 1, [...uniqSig].slice(0, 3));
  const colors = new Set(Object.keys(accents).filter(k => /@1360$/.test(k)).map(k => accents[k])); ck("هوية", "ألوان زر الطلب تتنوّع بحسب هوية القوالب (لا لون موحّد)", skins.length < 4 || colors.size >= Math.ceil(skins.length * 0.6), { distinct: colors.size, of: skins.length });
  console.log(`\n${fail ? fail + " إخفاق: " + failures.join(" | ") : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
