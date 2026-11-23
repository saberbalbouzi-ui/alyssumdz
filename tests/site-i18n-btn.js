// زر لغة الزائر «ع | FR»: (أ) صفحات المتجر: الظهور، التبديل إلى الفرنسية والعودة، الحفظ بين الصفحات، تقدّم اختيار الزائر على إعداد الموقع (lang=fr في store.json)،
// langSwitch:false يخفيه، لا يظهر داخل إطار ولا مع ?embed=1، وخانة الإعداد في اللوحة تُحفظ؛ (ب) كل القوالب (حاسوب 1360 / هاتف 390): زر واحد غير مغطّى ولا يتقاطع مع عنصر عائم آخر،
// والنقر على FR يحوّل الصفحة (LTR + fr) ثم ع يعيدها. التشغيل: EQA_BASE=… NODE_PATH=… node tests/site-i18n-btn.js  (SI_BROWSER، SI_IDS)
const pw = require("playwright"), chromium = pw[process.env.SI_BROWSER || "chromium"]; const declareProtect = require("./_declared-protect");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", IDS = process.env.SI_IDS ? process.env.SI_IDS.split(",") : null; const sleep = ms => new Promise(r => setTimeout(r, ms));
const FF = process.env.SI_BROWSER === "firefox"; let pass = 0, fail = 0; const ck = (t, n, ok, d) => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"} [${t}] ${n}${!ok && d !== undefined ? "  — " + JSON.stringify(d).slice(0, 400) : ""}`); };
const ST = () => { const b = document.getElementById("site-lang-btn"); const bs = b ? [...b.querySelectorAll("button")] : []; const r = b ? b.getBoundingClientRect() : null; let cover = null, hit = false;
  if (r) { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); hit = !!(e && b.contains(e)); const fixed = [...document.querySelectorAll("body *")].filter(x => !b.contains(x) && x !== b && getComputedStyle(x).position === "fixed" && getComputedStyle(x).display !== "none" && getComputedStyle(x).visibility !== "hidden" && +getComputedStyle(x).opacity > 0.05 && x.getClientRects().length).map(x => x.getBoundingClientRect()).filter(q => q.width > 8 && q.height > 8 && q.width < innerWidth * 0.9 && !(q.width >= innerWidth * 0.9 && q.height >= innerHeight * 0.9));
    cover = fixed.filter(q => Math.min(q.right, r.right) - Math.max(q.left, r.left) > 2 && Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top) > 2).length; }
  let txt = 0; if (r) { const tw = document.createTreeWalker(document.body, 4), rg = document.createRange(); let n; while ((n = tw.nextNode())) { if (!/\S/.test(n.nodeValue)) continue; const pe = n.parentElement; if (!pe || b.contains(pe) || pe.closest("script,style,noscript,textarea")) continue; const cs = getComputedStyle(pe); if (cs.visibility === "hidden" || +cs.opacity < 0.05) continue; rg.selectNodeContents(n); for (const q of rg.getClientRects()) { const ox = Math.min(q.right, r.right) - Math.max(q.left, r.left), oy = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top); if (ox > 1 && oy > 1) txt = Math.max(txt, Math.round(ox)); } } }
  return { txt, n: document.querySelectorAll("#site-lang-btn").length, labels: bs.map(x => x.textContent), pressed: bs.map(x => x.getAttribute("aria-pressed")), hit, cover, dir: document.documentElement.dir, lang: document.documentElement.lang, ls: (() => { try { return localStorage.getItem("site_lang_user"); } catch (e) { return "x"; } })(), ar: /[؀-ۿ]/.test(document.body.innerText.replace(/ع\s*FR/, ""))   /* بلا حرف زر اللغة نفسه */ };
};
const click = async (p, l) => { await Promise.all([p.waitForEvent("load", { timeout: 20000 }).catch(() => { }), p.evaluate(x => { const b = [...document.querySelectorAll("#site-lang-btn button")].find(y => y.textContent === x); b && b.click(); }, l)]); await sleep(3800); };
(async () => {
  const br = await chromium.launch(); const ctx = async (o = {}) => { const c = await br.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", ...o }); await declareProtect(c); return c; };
  // أ.1 الافتراضي عربي ← فرنسية ← حفظ ← عربية
  { const c = await ctx(), p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 100)));
    await p.goto(BASE + "/", { waitUntil: "load" }).catch(() => { }); await sleep(3000); let s = await p.evaluate(ST);
    ck("متجر/عربي", "زر واحد: ع نشط، RTL", s.n === 1 && s.labels.join() === "ع,FR" && s.pressed.join() === "true,false" && s.dir !== "ltr" && s.hit, s);
    await click(p, "FR"); s = await p.evaluate(ST); ck("متجر/→FR", "الصفحة فرنسية LTR، FR نشط، الاختيار محفوظ، بلا عربي", s.dir === "ltr" && s.lang === "fr" && s.pressed.join() === "false,true" && s.ls === "fr" && !s.ar && s.hit, s);
    await p.goto(BASE + "/shop.html", { waitUntil: "load" }).catch(() => { }); await sleep(3000); s = await p.evaluate(ST); ck("متجر/حفظ", "الاختيار يستمر في صفحة أخرى", s.dir === "ltr" && s.lang === "fr" && s.pressed.join() === "false,true" && !s.ar, s);
    await click(p, "ع"); s = await p.evaluate(ST); ck("متجر/→ع", "العودة إلى العربية (RTL، lang=ar، نص عربي)", s.dir !== "ltr" && s.lang === "ar" && s.pressed.join() === "true,false" && s.ls === "ar" && s.ar, s);
    ck("متجر", "بلا أخطاء JS", !errs.length, errs); await c.close(); }
  // أ.2 إعداد الموقع فرنسي: الزائر يختار العربية فتتقدّم
  { const c = await ctx(), p = await c.newPage(); await p.route("**/assets/data/store.json*", async r => { const j = await (await r.fetch()).json(); j.lang = "fr"; await r.fulfill({ json: j }); });
    await p.goto(BASE + "/", { waitUntil: "load" }).catch(() => { }); await sleep(3000); let s = await p.evaluate(ST); ck("إعداد fr", "يبدأ فرنسياً وFR نشط", s.dir === "ltr" && s.lang === "fr" && s.pressed.join() === "false,true" && !s.ar, s);
    await click(p, "ع"); s = await p.evaluate(ST); ck("إعداد fr", "اختيار الزائر للعربية يتقدّم (lang=ar، RTL، نص عربي)", s.dir !== "ltr" && s.lang === "ar" && s.pressed.join() === "true,false" && s.ar, s);
    await p.goto(BASE + "/shop.html", { waitUntil: "load" }).catch(() => { }); await sleep(3000); s = await p.evaluate(ST); ck("إعداد fr", "ويستمر في صفحة أخرى", s.dir !== "ltr" && s.lang === "ar" && s.ar, s); await c.close(); }
  // أ.3 langSwitch:false
  { const c = await ctx(), p = await c.newPage(); await p.route("**/assets/data/store.json*", async r => { const j = await (await r.fetch()).json(); j.langSwitch = false; await r.fulfill({ json: j }); });
    await p.goto(BASE + "/", { waitUntil: "load" }).catch(() => { }); await sleep(3000); const s = await p.evaluate(ST); ck("langSwitch:false", "لا زر", s.n === 0, s); await c.close(); }
  // أ.4 داخل إطار و?embed=1
  { const c = await ctx(), p = await c.newPage(); await p.route("**/__frame.html", r => r.fulfill({ contentType: "text/html", body: `<iframe src="${BASE}/" style="width:900px;height:700px"></iframe>` }));
    await p.goto(BASE + "/__frame.html").catch(() => { }); await sleep(4000); const f = p.frames().find(x => x !== p.mainFrame() && x.url().startsWith(BASE)); const n = f ? await f.evaluate(() => document.querySelectorAll("#site-lang-btn").length) : -1; ck("إطار", "لا زر داخل iframe", n === 0, n);
    await p.goto(BASE + "/?embed=1", { waitUntil: "load" }).catch(() => { }); await sleep(2500); const s = await p.evaluate(ST); ck("embed=1", "لا زر", s.n === 0, s); await c.close(); }
  // أ.5 خانة الإعداد في اللوحة
  { const c = await ctx(), a = await c.newPage();
    await a.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await a.waitForFunction(() => typeof Admin !== "undefined" && document.getElementById("login-pass"), null, { timeout: 120000 }); await a.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
    await a.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await a.waitForFunction(() => typeof Admin !== "undefined" && typeof AdminStores !== "undefined", null, { timeout: 60000 }); await sleep(2500);
    const r = await a.evaluate(async () => { Admin.tab("store"); await new Promise(r => setTimeout(r, 1500)); AdminStores.tog("cur"); await new Promise(r => setTimeout(r, 800)); const cb = document.getElementById("stp-langSwitch"); const def = !!cb && cb.checked; if (!cb) return { def }; cb.checked = false; try { await AdminStores.save(); } catch (e) { } const off = AdminStores.data().langSwitch; AdminStores.tog("cur"); AdminStores.tog("cur"); await new Promise(r => setTimeout(r, 500)); const cb2 = document.getElementById("stp-langSwitch"); const keep = !!cb2 && !cb2.checked; cb2.checked = true; try { await AdminStores.save(); } catch (e) { } return { def, off, keep, on: AdminStores.data().langSwitch }; });
    ck("اللوحة", "الخانة موجودة ومفعّلة افتراضياً، وتُحفظ عند الإلغاء والتفعيل", r.def === true && r.off === false && r.keep === true && r.on === true, r); await c.close(); }
  // ب. كل القوالب
  const ac = await ctx(); await declareProtect(ac); const admin = await ac.newPage();
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && document.getElementById("login-pass"), null, { timeout: 120000 }); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const idx = (await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, file: x.file || x.id })))).filter(x => !IDS || IDS.includes(x.id));
  for (const t of idx) {
    const html = await admin.evaluate(async file => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); pg.slug = "si"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: [], pageProduct: "", site: { name: "Mystore", wa: "213000000000" } }); }, t.file);
    for (const w of [1360, 390]) {
      const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob && !FF, hasTouch: mob && !FF, serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 100)));
      await p.route("**/__si.html*", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); const tag = t.id + "@" + w;
      try { await p.goto(BASE + "/__si.html", { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(3600);
      let s = await p.evaluate(ST); ck(tag, "زر واحد (ع،FR) ظاهر وغير مغطّى ولا يتقاطع مع عنصر عائم ولا يغطّي نصاً", s.n === 1 && s.labels.join() === "ع,FR" && s.hit && s.cover === 0 && s.txt <= 8 && s.pressed.join() === "true,false", s);
      await click(p, "FR"); s = await p.evaluate(ST); ck(tag, "FR: الصفحة فرنسية LTR والزر نشط وغير مغطّى", s.dir === "ltr" && s.lang === "fr" && s.pressed.join() === "false,true" && s.n === 1 && s.hit && s.cover === 0 && s.txt <= 8, s);
      await click(p, "ع"); s = await p.evaluate(ST); ck(tag, "ع: عودة إلى العربية", s.dir !== "ltr" && s.lang !== "fr" && s.pressed.join() === "true,false" && s.ar, s);
      ck(tag, "بلا أخطاء JS", !errs.length, errs); await c.close();
    }
  }
  console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
