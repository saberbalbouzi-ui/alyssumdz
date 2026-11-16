// اختبار «المحتوى النموذجي»: بقاء الآراء/الأرقام/العبارات التسويقية، تنبيه المطوّر غير المانع، تعطيل العدّ التنازلي والكود ومؤشرات الكمية بلا إعداد، وبيانات التواصل المربوطة بالمتجر.
// التشغيل: NODE_PATH=/opt/node-tools/node_modules node tests/template-sample-content.js
const { spawn, spawnSync } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const { chromium } = require("playwright");
const declareProtect = require("./_declared-protect");
const root = path.join(__dirname, ".."), PORT = 8600 + Math.floor(Math.random() * 300), PW = "TestPass12345";
const OUT = process.env.EXR_OUT || "/tmp/exr", ONLY = process.env.EXR_IDS ? process.env.EXR_IDS.split(",") : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dist = path.join(root, "dist", "exr-store"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "exr-"));
  fs.rmSync(dist, { recursive: true, force: true });
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/exr-store", "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: root, encoding: "utf8" });
  const code = (/([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/.exec(b.stdout) || [])[1]; if (!code) { console.log("تعذّر بناء الحزمة", b.stdout.slice(-300)); process.exit(2); }
  // حزمة التثبيت النظيفة لا تحوي القوالب (تُسلَّم بحزمة التحديث): تُنسخ من المصدر كما تفعل حزمة التحديث (باستثناء owner_only)
  fs.cpSync(dist, tmp, { recursive: true });
  const sf = JSON.parse(fs.readFileSync(path.join(root, "shared-files.json"), "utf8")), own = new Set((sf.owner_only && sf.owner_only.files) || []);
  const upd = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--update", "--out", "dist/exr-update", "--name", "Mystore", "--wa", "213000000000"], { cwd: root, encoding: "utf8" });
  const updDir = path.join(root, "dist", "exr-update");
  if (fs.existsSync(updDir)) fs.cpSync(updDir, tmp, { recursive: true, force: true }); else console.log("تنبيه: لا حزمة تحديث", upd.stdout.slice(-200), upd.stderr.slice(-200));
  const php = spawn("php", ["-S", "127.0.0.1:" + PORT, "-t", tmp], { stdio: "ignore" });
  const kill = () => { try { php.kill(); } catch (e) { } fs.rmSync(dist, { recursive: true, force: true }); fs.rmSync(updDir, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); };
  process.on("exit", kill); await sleep(1500);
  const base = "http://127.0.0.1:" + PORT;
  const inst = await (await fetch(base + "/install.php", { method: "POST", body: new URLSearchParams({ code, pw: PW, pw2: PW, name: "Mystore", wa: "213000000000" }) })).text();
  if (!/تم التثبيت/.test(inst)) { console.log("فشل التثبيت"); process.exit(2); }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } }), admin = await ctx.newPage(); admin.on("dialog", d => d.accept());
  await admin.goto(base + "/admin.html"); await sleep(1200);
  await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW);
  await admin.waitForFunction(() => typeof Admin !== "undefined" && Admin.products && document.querySelector("#app .top"), null, { timeout: 25000 }); await sleep(1500);
  await admin.evaluate(async () => { await AdminNav.libOpen(); }); await sleep(800); await admin.evaluate(() => AdminNav.libClose());   // يحمّل فهرس القوالب (LIBX) كما تفعل واجهة المكتبة

  let pass = 0, fail = 0; const ck = (n, c, x) => { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
  // ───── 1) تنبيه «المحتوى النموذجي» في المطوّر: يظهر، غير مانع، يُغلق، ويعود عند إعادة فتح القالب ─────
  const open = async id => admin.evaluate(async id => { await AdminNav.tplEdit(id); for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page); i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 600)); const n = document.getElementById("pbx-sample"); return { has: !!n, sample: PBApp.E.page.sample, txt: n ? n.textContent.slice(0, 120) : "", vis: !!(n && n.getBoundingClientRect().width > 0 && getComputedStyle(n).visibility !== "hidden") }; }, id);
  await admin.evaluate(async () => { await AdminNav.libOpen(); }); await sleep(800); await admin.evaluate(() => AdminNav.libClose());
  let r = await open("s-honey");
  ck("يظهر تنبيه المحتوى النموذجي عند فتح قالب متجر", r.has && r.vis && r.sample === 1 && /للتوضيح فقط/.test(r.txt), r);
  const clickable = await admin.evaluate(() => { const n = document.getElementById("pbx-sample"), b = n.getBoundingClientRect(), a = document.getElementById("pb-app").getBoundingClientRect(); const top = document.elementFromPoint(a.left + a.width / 2, a.top + 120); return { h: Math.round(b.height), w: Math.round(b.width), bottom: Math.round(innerHeight - b.bottom), overTop: !!(top && top.closest("#pbx-sample")) }; });
  ck("التنبيه شريط سفلي صغير لا يغطي منطقة العمل", clickable.h < 130 && !clickable.overTop, clickable);
  await admin.evaluate(() => document.querySelector("#pbx-sample button").click()); await sleep(200);
  ck("زر «فهمت» يغلق التنبيه ويعلّم الصفحة", await admin.evaluate(() => !document.getElementById("pbx-sample") && PBApp.E.page.sample === 0));
  await admin.evaluate(() => PBApp.close(true)); await sleep(500);
  r = await open("s-honey"); ck("يعود التنبيه عند فتح القالب من جديد", r.has, r);
  await admin.evaluate(() => PBApp.close(true)); await sleep(500);
  r = await open("c-gold"); ck("يظهر أيضاً لأقسام الاتصال/الطلب النموذجية", r.has, r);
  await admin.evaluate(() => PBApp.close(true)); await sleep(500);
  ck("التنبيه يُزال عند إغلاق المحرّر", await admin.evaluate(() => !document.getElementById("pbx-sample")));

  // ───── 2) العناصر التي تتطلب إعداداً: معطّلة في الصفحة المنشورة، ظاهرة باهتة في المحرّر، وتعمل بعد التفعيل ─────
  const render = (id, tweak) => admin.evaluate(async ([id, tw]) => { await AdminNav.tplEdit(id); for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page); i++) await new Promise(r => setTimeout(r, 250)); const pg = JSON.parse(JSON.stringify(PBApp.E.page)); PBApp.close(true); const walk = (n, f) => { (n.cols || []).forEach(c => walk(c, f)); (n.widgets || []).forEach(f); (n.free || []).forEach(f); }; if (tw) pg.sections.forEach(s => walk(s, w => { try { new Function("w", tw)(w); } catch (e) { } })); const P = PB.migrate(pg); P.slug = "t"; const prods = Admin.products || []; return PB.fullHtml(P, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: prods, pageProduct: (prods[0] || {}).slug || "", site: { name: "متجرك", wa: "213661112233" } }); }, [id, tweak || ""]);
  const view = async (html, ev) => { const c = await browser.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(c); const p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 100))); await p.route(base + "/__t.html", rr => rr.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); await p.goto(base + "/__t.html", { waitUntil: "load" }); await sleep(1500); const out = await p.evaluate(ev); await c.close(); return Object.assign({ errs }, out); };
  const probe = () => { const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0; }; return { cd: [...document.querySelectorAll(".pb-cd")].map(vis), cdOffAttr: [...document.querySelectorAll(".pb-cd")].map(e => e.hasAttribute("data-off")), cp: document.querySelectorAll(".pb-cp").length, sold: [...document.querySelectorAll(".pb-pg")].filter(e => /بيع/.test(e.textContent)).length, soldVis: [...document.querySelectorAll(".pb-pg")].filter(e => /بيع/.test(e.textContent) && vis(e)).length, stock: document.querySelectorAll(".pb-stk, [class*=pb-st]").length, text: document.body.innerText }; };
  for (const id of ["s-aurora", "s-pop", "s-marketplace"]) {
    const h = await render(id), o = await view(h, probe);
    ck(`${id}: العدّ التنازلي غير ظاهر في الصفحة المنشورة`, o.cd.length > 0 && o.cd.every(v => !v), o.cd);
    ck(`${id}: كود الخصم (YOURCODE/SAVE15) غير مُصيَّر في الصفحة المنشورة`, o.cp === 0 && !/SAVE15|YOURCODE|FLASH20|PACK15/.test(o.text), { cp: o.cp });
    ck(`${id}: لا نص يوحي بعرض ينتهي الليلة/منتصف الليل`, !/تنتهي منتصف الليل|ينتهي الليلة|الليلة فقط|قبل منتصف الليل|ينتهي قريباً|ينتهي العرض خلال/.test(o.text));
    ck(`${id}: لا أخطاء JS`, o.errs.length === 0, o.errs);
    if (id === "s-marketplace") ck("s-marketplace: أشرطة «تم بيع %» غير ظاهرة بلا إعداد", o.soldVis === 0 && !/تم بيع \d+%/.test(o.text), o);
  }
  { const h = await render("s-aurora"), t = await view(h, () => ({ stat: document.body.innerText.match(/12\s?000/) ? 1 : 0, testi: document.querySelectorAll(".pb-ts").length, rate: /98/.test(document.body.innerText) ? 1 : 0, ib: document.querySelectorAll(".pb-ib").length }));
    ck("s-aurora: الآراء والإحصائيات والعبارات التسويقية النموذجية باقية في الصفحة", t.testi === 3 && t.stat === 1 && t.rate === 1 && t.ib > 3, t); }
  // التفعيل: عدّاد بتاريخ مستقبلي + كود حقيقي ⟵ يظهران؛ وبلا تاريخ يبقى مخفياً (لا رجوع للتجدد اليومي)
  { const fut = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16);
    const h = await render("s-aurora", `if (w.type === "countdown") { w.set.on = true; w.set.mode = "date"; w.set.end = "${fut}"; } if (w.type === "coupon") { w.set.on = true; w.set.cpcode = "ETE25"; }`), o = await view(h, probe);
    ck("بعد التفعيل بتاريخ حقيقي: العدّاد ظاهر والكود المضبوط ظاهر", o.cd.some(v => v) && o.cp >= 1 && /ETE25/.test(o.text), o);
    const v = await view(h, () => { const e = document.querySelector(".pb-cd"); return { d: +e.querySelector("[data-u=d]").textContent }; }); ck("العدّاد يحسب حتى التاريخ المحدد (≈3 أيام)", v.d >= 2 && v.d <= 3, v);
    const h2 = await render("s-aurora", `if (w.type === "countdown") { w.set.on = true; w.set.mode = "date"; w.set.end = ""; }`), o2 = await view(h2, probe);
    ck("عدّاد مفعّل بنمط «تاريخ» بلا تاريخ يبقى مخفياً (لا تجدّد يومياً مضلّل)", o2.cd.every(x => !x), o2.cd); }
  // مؤشر المخزون: بلا مخزون فعلي مخفي، ومعه يظهر
  { const h = await render("s-pop"), o = await view(h, () => ({ n: [...document.querySelectorAll("div,p,span")].filter(e => e.children.length === 0 && /بقيت \d+ قطع فقط/.test(e.textContent)).length }));
    ck("s-pop: مؤشر «بقيت N قطع» غير مُصيَّر بلا مخزون فعلي مرتبط", o.n === 0, o); }
  // ───── 3) بيانات التواصل ─────
  { const h = await render("c-gold"), o = await view(h, () => { const a = [...document.querySelectorAll("a.pb-btn")].map(x => x.getAttribute("href")); return { a, txt: document.body.innerText }; });
    ck("زر واتساب يستعمل رقم المتجر (لا رقماً وهمياً)", o.a.some(x => /wa\.me\/213661112233/.test(x)) && !o.a.some(x => /213555000000/.test(x)), o.a);
    ck("لا 0555 00 00 00 ولا example.com في القسم", !/0555 ?00 ?00|example\.com/.test(o.txt) && !o.a.some(x => /example\.com/.test(x)), o.a);
    const ph = await admin.evaluate(async () => { await AdminNav.tplEdit("c-gold"); for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page); i++) await new Promise(r => setTimeout(r, 250)); const j = JSON.stringify(PBApp.E.page); PBApp.close(true); const m = j.match(/"kind":"call"[^}]*?"phone":"([^"]*)"/); return { call: !!m, phone: m ? m[1] : "" }; });
    ck("رقم الهاتف مؤشَّر بوضوح كنموذجي (05XX) وقابل للتعديل من حقل «رقم الهاتف» في الزر", /05XX/.test(o.txt) && o.a.some(x => /^tel:/.test(x)) && ph.call && /05XX/.test(ph.phone), { a: o.a, ph }); }
  // ───── 4) النشر: تنبيه غير مانع عند بقاء بيانات تواصل/محتوى نموذجي ─────
  { const msg = await admin.evaluate(async () => { await AdminNav.tplEdit("c-gold"); for (let i = 0; i < 40 && !(PBApp.E && PBApp.E.page); i++) await new Promise(r => setTimeout(r, 250)); const pg = PBApp.E.page; pg.title = "اختبار تنبيه"; pg.slug = "sample-warn-test"; window.confirm = () => true; try { await PBApp.publish(); } catch (e) { return "ERR " + e.message; } await new Promise(r => setTimeout(r, 6000)); const m = document.getElementById("pbx-msg"); return { toast: m ? m.textContent : "", bar: (document.getElementById("pbx-pub") || {}).textContent || "" }; });
    ck("النشر ينجح ويُلحق تنبيهاً غير مانع بالبيانات النموذجية", typeof msg === "object" && /نُشرت/.test(msg.toast + msg.bar) && /تنبيه/.test(msg.toast + msg.bar), msg); }
  console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`);
  await browser.close(); process.exit(fail ? 1 : 0);
})();
