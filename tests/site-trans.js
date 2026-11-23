// الترجمة الفرنسية التلقائية لنصوص التاجر (SiteTrans) على حزمة عميل حقيقية: عند حفظ صفحة/منتج تُترجَم النصوص الجديدة وحدها (بمترجِم بديل حتمي) وتُكتب في
// assets/data/site-i18n-custom.json فيعرضها الموقع بالفرنسية؛ نصوص القوالب المعروفة لا تُرسَل؛ الفشل يُبقي النص في الانتظار ثم يُستدرك؛ التعطيل من الإعدادات؛ منع الحلقة.
// التشغيل: EQA_BASE=… NODE_PATH=… node tests/site-trans.js  (SI_BROWSER)
const pw = require("playwright"), chromium = pw[process.env.SI_BROWSER || "chromium"]; const declareProtect = require("./_declared-protect");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345"; const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ck = (n, ok, d) => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${!ok && d !== undefined ? "  — " + JSON.stringify(d).slice(0, 400) : ""}`); };
(async () => {
  const br = await chromium.launch(), c = await br.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" }); await declareProtect(c); const a = await c.newPage(), errs = []; a.on("pageerror", e => errs.push(String(e).slice(0, 120)));
  await a.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await a.waitForFunction(() => typeof Admin !== "undefined" && document.getElementById("login-pass"), null, { timeout: 120000 }); await a.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await a.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await a.waitForFunction(() => typeof Admin !== "undefined" && typeof SiteTrans !== "undefined" && typeof GH !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const setup = () => a.evaluate(() => { localStorage.setItem("store_gp_gkey", "test-key"); localStorage.setItem("alyssum_gp_gkey", "test-key"); localStorage.removeItem("site_trans_pending"); window.__tr = []; SiteTrans.translate = async list => { window.__tr.push(list.slice()); return Object.fromEntries(list.map(x => [x, "FR(" + x.length + ")"])); }; return SiteTrans.enabled(); });
  const custom = () => a.evaluate(async () => { const r = await fetch("assets/data/site-i18n-custom.json?t=" + Date.now(), { cache: "no-store" }); return r.ok ? (await r.json()).exact || {} : null; });
  const putPage = (slug, page) => a.evaluate(async ([slug, page]) => { let sha; try { sha = (await GH.getFile("assets/pages/" + slug + ".json")).sha; } catch (e) { } await GH.putFile("assets/pages/" + slug + ".json", btoa(unescape(encodeURIComponent(JSON.stringify(page)))), sha, "اختبار"); return true; }, [slug, page]);
  ck("الميزة مفعّلة افتراضياً (زر اللغة ظاهر)", await setup() === true);
  const NEW = "عرض خاص جديد لم يُترجَم من قبل: خصم كبير على كل القطع", EDIT = "جملة أضافها التاجر إلى فقرة موجودة في القالب بنفسه";
  const base = await a.evaluate(async () => (await (await fetch("assets/pages/templates/s-fashion.json?t=" + Date.now())).json()));
  const find = (pg, f) => { let r = null; const w = n => { if (r) return; if (n && typeof n === "object") { if (f(n)) { r = n; return; } Object.values(n).forEach(w); } }; w(pg.sections); return r; };
  const page = JSON.parse(JSON.stringify(base)); page.slug = "zz-trans";
  await putPage("zz-trans", page); await sleep(8000);
  let cs = await custom(), tr = await a.evaluate(() => window.__tr);
  ck("قالب غير معدَّل: لا يُرسَل شيء للترجمة ولا قاموس خاص", tr.length === 0 && (!cs || !Object.keys(cs).length), { tr, cs });
  const hd = find(page, n => n.type === "heading" && n.set && typeof n.set.text === "string"); hd.set.text = NEW;
  const tx = find(page, n => n.type === "text" && n.set && typeof n.set.html === "string" && /<p>/.test(n.set.html)); tx.set.html = tx.set.html + "<p>" + EDIT + "</p>";
  await putPage("zz-trans", page); await sleep(9000);
  cs = await custom(); tr = await a.evaluate(() => window.__tr);
  ck("النصان الجديدان وحدهما أُرسلا (لا نصوص القالب المعروفة)", tr.length === 1 && tr[0].length === 2 && tr[0].includes(NEW) && tr[0].includes(EDIT), tr);
  ck("كُتب قاموس الموقع الخاص بالترجمة", cs && cs[NEW] === "FR(" + NEW.length + ")" && cs[EDIT] === "FR(" + EDIT.length + ")", cs);
  const html = await a.evaluate(async pg => PB.fullHtml(PB.migrate(pg), { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: [], pageProduct: "", site: { name: "Mystore", wa: "213000000000" } }), page);
  const v = await c.newPage(); await v.route("**/__tr.html*", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); await v.goto(BASE + "/__tr.html?lang=fr", { waitUntil: "load" }).catch(() => { }); await sleep(3800);
  const vt = await v.evaluate(() => document.body.innerText); ck("الصفحة بالفرنسية: النصان الجديدان مترجمان وكل شيء آخر بالقاموس بلا عربي", vt.includes("FR(" + NEW.length + ")") && vt.includes("FR(" + EDIT.length + ")") && !/[؀-ۿ]/.test(vt.replace(/ع\s*FR/, "")), vt.slice(0, 200));
  // تكرار الحفظ بلا تغيير: لا إرسال جديد
  await a.evaluate(() => { window.__tr = []; }); await putPage("zz-trans", page); await sleep(8000); ck("إعادة حفظ بلا تغيير لا تُرسل شيئاً", (await a.evaluate(() => window.__tr)).length === 0);
  // تعديل جزئي: جملة معدّلة فقط
  const page2 = JSON.parse(JSON.stringify(page)); find(page2, n => n.type === "heading" && n.set && n.set.text === NEW).set.text = NEW + " — لأيام قليلة فقط"; await putPage("zz-trans", page2); await sleep(9000);
  tr = await a.evaluate(() => window.__tr); ck("تعديل جملة يُرسل الجملة المعدّلة وحدها", tr.length === 1 && tr[0].length === 1 && tr[0][0].includes("لأيام قليلة"), tr);
  // منتج
  await a.evaluate(() => { window.__tr = []; const p = Admin.products[0]; p.title = "منتج تجريبي جديد للترجمة التلقائية"; p.desc = "وصف تجريبي جديد يشرح المنتج بجملة واضحة."; });
  await a.evaluate(async () => { await Admin.publishDataJs(); }); await sleep(9000);
  cs = await custom(); ck("عنوان ووصف المنتج المعدَّلان يُترجَمان", cs && cs["منتج تجريبي جديد للترجمة التلقائية"] && cs["وصف تجريبي جديد يشرح المنتج بجملة واضحة."], Object.keys(cs || {}).slice(-4));
  // فشل الخدمة ثم الاستدراك
  await a.evaluate(() => { window.__tr = []; SiteTrans.translate = async () => { throw new Error("no credit"); }; });
  const FAILT = "نص جديد سيفشل ترجمته أول مرة ثم ينجح لاحقاً"; const page3 = JSON.parse(JSON.stringify(page)); find(page3, n => n.type === "heading" && n.set && n.set.text === NEW).set.text = FAILT; await putPage("zz-trans", page3); await sleep(9000);
  const pend = await a.evaluate(() => JSON.parse(localStorage.getItem("site_trans_pending") || "[]")); cs = await custom(); ck("فشل الخدمة: لا خطأ، والنص يبقى في الانتظار", pend.includes(FAILT) && !(cs && cs[FAILT]), { pend, has: cs && cs[FAILT] });
  await a.evaluate(() => { SiteTrans.translate = async list => Object.fromEntries(list.map(x => [x, "OK:" + x.length])); }); const rr = await a.evaluate(() => SiteTrans.run()); cs = await custom(); ck("الاستدراك لاحقاً يترجم ما بقي", cs && cs[FAILT] === "OK:" + FAILT.length && rr.translated >= 1, rr);
  // التعطيل: اللغة عربية وزر اللغة معطّل
  await a.evaluate(() => { const d = AdminStores.data(); d.langSwitch = false; d.lang = "ar"; window.__tr = []; });
  const OFF = "نص جديد أثناء تعطيل الميزة تماماً"; const page4 = JSON.parse(JSON.stringify(page)); find(page4, n => n.type === "heading" && n.set && n.set.text === NEW).set.text = OFF; await putPage("zz-trans", page4); await sleep(8000);
  ck("الميزة معطّلة (عربي بلا زر لغة): لا إرسال", (await a.evaluate(() => window.__tr)).length === 0 && !(await custom())[OFF]);
  // عدم التسرّب: القاموس الخاص لا يحوي نصاً بلا عربي ولا HTML، والعربية لا تتأثر بوجود الملف
  await a.evaluate(() => { const d = AdminStores.data(); d.langSwitch = true; });
  cs = await custom(); ck("كل قيم القاموس الخاص فرنسية بلا حروف عربية", Object.values(cs).every(x => typeof x === "string" && x && !/[؀-ۿ]/.test(x)));
  await v.goto(BASE + "/__tr.html?lang=ar", { waitUntil: "load" }).catch(() => { }); await sleep(2500); ck("العربية بلا تغيير مع وجود القاموس الخاص", (await v.evaluate(() => document.body.innerText)).includes(NEW));
  const realErrs = errs.filter(e => !/serviceWorker/.test(e)); ck("بلا أخطاء JS", realErrs.length === 0, realErrs);
  console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
