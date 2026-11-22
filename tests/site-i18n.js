// لغة الموقع الفرنسية: كل قالب منشور (PB.fullHtml) يُحمَّل بـ?lang=fr فيجب أن يصير LTR وبلا نصوص عربية ظاهرة من القاموس،
// وبالعربية (الافتراضي) لا يتغيّر شيء. التشغيل: EQA_BASE=… NODE_PATH=… node tests/site-i18n.js  (SI_IDS لتحديد قوالب، SI_OUT لملف النصوص المتبقية)
const pw = require("playwright"), chromium = pw[process.env.SI_BROWSER || "chromium"]; const declareProtect = require("./_declared-protect"); const fs = require("fs");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", IDS = process.env.SI_IDS ? process.env.SI_IDS.split(",") : null; const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const failures = [], left = {}; const ck = (t, n, ok, d) => { if (ok) pass++; else { fail++; failures.push(t + ": " + n); } console.log(`${ok ? "PASS" : "FAIL"} [${t}] ${n}${!ok && d !== undefined ? "  — " + JSON.stringify(d).slice(0, 300) : ""}`); };
const LEFT = () => { const AR = /[؀-ۿ]/, SK = "script,style,textarea,code,pre,noscript,[data-i18n-skip],.notranslate,.pb-edit"; const out = []; const tw = document.createTreeWalker(document.body, 5, { acceptNode: n => n.nodeType === 1 ? (n.matches(SK) ? 2 : 3) : 1 }); let n; while ((n = tw.nextNode())) { if (n.nodeType === 3 && AR.test(n.nodeValue)) { const e = n.parentElement; if (e && e.getClientRects().length && getComputedStyle(e).visibility !== "hidden") out.push(n.nodeValue.replace(/\s+/g, " ").trim()); } else if (n.nodeType === 1) { for (const a of ["placeholder", "title", "aria-label", "alt"]) { const v = n.getAttribute(a); if (v && AR.test(v)) out.push("[" + a + "] " + v); } } } return out; };
(async () => {
  const br = await chromium.launch(), actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage();
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const idx = (await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, file: x.file || x.id })))).filter(x => !IDS || IDS.includes(x.id));
  for (const t of idx) {
    const html = await admin.evaluate(async file => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); pg.slug = "si"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: [], pageProduct: "", site: { name: "Mystore", wa: "213000000000" } }); }, t.file);
    for (const lang of ["ar", "fr"]) {
      const c = await br.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
      await p.route("**/__si.html*", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
      try { await p.goto(BASE + "/__si.html?lang=" + lang, { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(1800);
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); }); await sleep(900);
      const r = await p.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, hidden: document.documentElement.getAttribute("data-site-i18n") }));
      const L = await p.evaluate(LEFT), tag = t.id + "@" + lang;
      if (lang === "fr") {
        ck(tag, "الصفحة LTR وlang=fr", r.dir === "ltr" && r.lang === "fr" && !r.hidden, r);
        const rate = L.length; ck(tag, "نصوص عربية متبقية ≤ 3", rate <= 3, L.slice(0, 6)); for (const s of L) left[s] = (left[s] || 0) + 1;
      } else { ck(tag, "العربية بلا تغيير (RTL، لا قاموس)", r.dir !== "ltr" && L.length > 5, { dir: r.dir, n: L.length }); }
      ck(tag, "بلا أخطاء JS", !errs.length, errs); await c.close();
      if (lang === "fr") { const m = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: process.env.SI_BROWSER !== "firefox", hasTouch: process.env.SI_BROWSER !== "firefox", serviceWorkers: "block" }); await declareProtect(m); const q = await m.newPage(); await q.route("**/__si.html*", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
        try { await q.goto(BASE + "/__si.html?lang=fr", { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(1500);
        const ov = await q.evaluate(() => { window.scrollTo(200, 0); return window.scrollX; }); ck(t.id + "@fr-390", "لا تمرير أفقي على الهاتف", ov <= 1, ov); await m.close(); }
    }
  }
  if (process.env.SI_OUT) fs.writeFileSync(process.env.SI_OUT, JSON.stringify(Object.entries(left).sort((a, b) => b[1] - a[1]), null, 0));
  console.log(`\n${fail ? fail + " إخفاق: " + failures.slice(0, 20).join(" | ") : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
