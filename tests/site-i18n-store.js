// واجهة المتجر بالفرنسية (حزمة عميل حقيقية): لكل صفحة (حاسوب 1280 / هاتف 390) تُقارَن ?lang=ar بـ?lang=fr: لا نص عربي ظاهر،
// لا تمرير أفقي، لا نص مقصوص جديد (عنصر overflow مخفيّ يقصّ نصه)، لا زر/وسم بأكثر من 3 أسطر جديد، LTR، بلا أخطاء JS.
// التشغيل: EQA_BASE=… NODE_PATH=… node tests/site-i18n-store.js  (SI_BROWSER=firefox|webkit)
const pw = require("playwright"), chromium = pw[process.env.SI_BROWSER || "chromium"]; const BASE = process.env.EQA_BASE; const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ["/", "/shop.html", "/p/demo/", "/cart.html", "/account.html", "/order-embed.html"]; let pass = 0, fail = 0; const ck = (t, n, ok, d) => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"} [${t}] ${n}${!ok && d !== undefined ? "  — " + JSON.stringify(d).slice(0, 400) : ""}`); };
const PROBE = () => {
  const AR = /[؀-ۿ]/, SK = "script,style,textarea,code,pre,noscript,[data-i18n-skip],.notranslate"; const left = [], clip = [], multi = [];
  const path = e => { const a = []; for (; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) { const i = [...e.parentElement.children].filter(x => x.tagName === e.tagName).indexOf(e); a.unshift(e.tagName + (e.id ? "#" + e.id : "") + ":" + i); if (a.length > 6) break; } return a.join(">"); };
  const tw = document.createTreeWalker(document.body, 5, { acceptNode: n => n.nodeType === 1 ? (n.matches(SK) ? 2 : 3) : 1 }); let n;
  while ((n = tw.nextNode())) { if (n.nodeType === 3 && AR.test(n.nodeValue)) { const e = n.parentElement; if (e && e.getClientRects().length) left.push(n.nodeValue.replace(/\s+/g, " ").trim()); } else if (n.nodeType === 1) { for (const a of ["placeholder", "title", "aria-label", "alt"]) { const v = n.getAttribute(a); if (v && AR.test(v)) left.push("[" + a + "] " + v); } } }
  for (const e of document.querySelectorAll("body *")) {
    if (!e.getClientRects().length || e.closest("script,style,svg,#pb-app")) continue; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "inline") continue;
    const txt = [...e.childNodes].some(c => c.nodeType === 3 && /\S/.test(c.nodeValue)); if (!txt) continue;
    if (/hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && !/auto|scroll/.test(cs.overflowX)) clip.push(path(e));
    if (/hidden|clip/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 3 && e.clientHeight > 0) clip.push(path(e));
    if (/^(BUTTON|A|LABEL|SPAN)$/.test(e.tagName) && (e.closest("button,.btn,.chip,.badge,label") === e || e.tagName === "BUTTON")) { const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; if (e.getBoundingClientRect().height / lh > 3.4) multi.push(path(e)); }
  }
  window.scrollTo(300, 0); const sx = window.scrollX; window.scrollTo(0, 0);
  return { left, clip, multi, sx, dir: document.documentElement.dir, lang: document.documentElement.lang };
};
(async () => {
  const br = await chromium.launch(); const errs = [];
  for (const w of [1280, 390]) for (const pg of PAGES) {
    const R = {};
    for (const lang of ["ar", "fr"]) {
      const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob && process.env.SI_BROWSER !== "firefox", hasTouch: mob && process.env.SI_BROWSER !== "firefox", serviceWorkers: "block" }); const p = await c.newPage(); p.on("pageerror", e => errs.push(pg + " " + lang + " " + String(e).slice(0, 100)));
      try { await p.goto(BASE + pg + "?lang=" + lang, { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(3200);
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); }); await sleep(600);
      R[lang] = await p.evaluate(PROBE); await c.close();
    }
    const tag = pg + "@" + w, A = R.ar, F = R.fr;
    ck(tag, "LTR وlang=fr", F.dir === "ltr" && F.lang === "fr", { dir: F.dir, lang: F.lang });
    ck(tag, "لا نص عربي ظاهر", F.left.length === 0, F.left.slice(0, 6));
    ck(tag, "لا تمرير أفقي جديد", F.sx <= A.sx + 1, { ar: A.sx, fr: F.sx });
    const ac = new Set(A.clip), am = new Set(A.multi), nc = [...new Set(F.clip)].filter(x => !ac.has(x)), nm = [...new Set(F.multi)].filter(x => !am.has(x));
    ck(tag, "لا نص مقصوص جديد", nc.length === 0, nc.slice(0, 5)); ck(tag, "لا زر/وسم بأكثر من 3 أسطر جديد", nm.length === 0, nm.slice(0, 5));
  }
  ck("all", "بلا أخطاء JS", errs.length === 0, errs.slice(0, 5));
  console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
