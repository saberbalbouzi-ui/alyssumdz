// ملاءمة النص الفرنسي للتخطيط: لكل قالب (حاسوب 1360 / هاتف 390) تُقارَن العربية بالفرنسية ويُعدّ إخفاقاً ما ظهر في الفرنسية فقط:
// تداخل نصّين من عنصرين مختلفين، نص يخرج من إطاره المقصوص (overflow)، نص يخرج من الشاشة، زر نصه أكثر من 3 أسطر.
// التشغيل: EQA_BASE=… NODE_PATH=… node tests/site-i18n-fit.js  (SI_IDS لتحديد قوالب، SI_OUT لملف التفاصيل)
const pw = require("playwright"), chromium = pw[process.env.SI_BROWSER || "chromium"]; const declareProtect = require("./_declared-protect"); const fs = require("fs");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", IDS = process.env.SI_IDS ? process.env.SI_IDS.split(",") : null; const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const details = {}; const ck = (t, n, ok, d) => { if (ok) pass++; else { fail++; details[t + " | " + n] = d; } console.log(`${ok ? "PASS" : "FAIL"} [${t}] ${n}${!ok ? "  — " + JSON.stringify(d).slice(0, 400) : ""}`); };
const MEASURE = () => {
  const AR = /[؀-ۿ]/; const cw = document.documentElement.clientWidth; const out = { boxes: [], clip: [], off: [], btn: [] };
  const key = el => { const w = el.closest(".pb-w"); const m = w && /\bx-[a-z0-9]+/.exec(w.className); return m ? m[0] : null; };
  const kids = [...document.querySelectorAll(".pb-w")].filter(w => !w.closest("#pb-app,.pb-edit")); const seen = new Set();
  for (const w of kids) {
    const t = w.dataset.type; if (!/^(heading|text|button|list|quote|stat|badge|tabs|faq|accordion|icon-box|iconbox|feature|testimonial)$/.test(t || "") && !w.querySelector(".pb-tx,.pb-hd,.pb-btn")) continue;
    const m = /\bx-[a-z0-9]+/.exec(w.className); if (!m || seen.has(m[0])) continue;
    { const tt = w.querySelector(".pb-hd,.pb-tx") || w, cs0 = getComputedStyle(tt), am0 = /rgba\([^)]*,\s*([\d.]+)\)/.exec(cs0.color || ""); if (parseFloat(cs0.fontSize) > 140 || (am0 && +am0[1] < .35)) continue; }   /* نص زخرفي ضخم/باهت */
    const r = document.createRange(); let L = 1e9, T = 1e9, R = -1e9, B = -1e9, n = 0;
    const tw = document.createTreeWalker(w, 4); let nd; while ((nd = tw.nextNode())) { if (!nd.nodeValue.trim()) continue; const p = nd.parentElement; if (p.closest("script,style")) continue; const cs = getComputedStyle(p); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue; r.selectNodeContents(nd); for (const q of r.getClientRects()) { if (q.width < 1 || q.height < 1) continue; L = Math.min(L, q.left); T = Math.min(T, q.top + scrollY); R = Math.max(R, q.right); B = Math.max(B, q.bottom + scrollY); n++; } }
    if (!n) continue; seen.add(m[0]);
    const wr = w.getBoundingClientRect(); const mm = /matrix\(([^)]*)\)/.exec(getComputedStyle(w).transform || ""); out.boxes.push({ rot: !!(mm && Math.abs(parseFloat(mm[1].split(",")[1])) > .01) || /infinite/.test(getComputedStyle(w).animationIterationCount) || [...w.querySelectorAll("*")].some(e => /infinite/.test(getComputedStyle(e).animationIterationCount)), id: m[0], t, L, T, R, B, wL: wr.left, wR: wr.right, wT: wr.top + scrollY, wB: wr.bottom + scrollY, fz: !!w.closest(".pb-fz,.pb-free") || w.classList.contains("pb-free") });
    if (R > cw + 2 || L < -2) out.off.push({ id: m[0], L: Math.round(L), R: Math.round(R) });
    for (let e = w; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if ((/hidden|clip/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 3 && e.clientHeight > 0) || (/hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 3 && e.clientWidth > 0)) { const er = e.getBoundingClientRect(); if (B - scrollY > er.bottom + 2 || R > er.right + 2 || L < er.left - 2 || T - scrollY < er.top - 2) { if (!/marquee|pb-mq|pb-sl|pb-slide|pb-psl|pb-ptabs|pb-carousel/.test(e.className + " " + e.parentElement?.className)) out.clip.push({ id: m[0], el: (e.className || e.tagName).toString().slice(0, 30) }); } break; } }
    if (t === "button" || w.querySelector(".pb-btn")) { const b = w.querySelector(".pb-btn,a,button") || w; const lh = parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.3; const h = b.getBoundingClientRect().height; if (h / lh > 3.4) out.btn.push({ id: m[0], lines: +(h / lh).toFixed(1) }); }
  }
  return out;
};
const inter = (a, b) => { const x = Math.min(a.R, b.R) - Math.max(a.L, b.L), y = Math.min(a.B, b.B) - Math.max(a.T, b.T); return x > 3 && y > 10 ? x * y : 0;   /* Firefox يُرجع مستطيلات أسطر أعلى من الحروف: تسرّب ≤10px ليس تداخلاً */ };
(async () => {
  const br = await chromium.launch(), actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage();
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const idx = (await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, file: x.file || x.id })))).filter(x => !IDS || IDS.includes(x.id));
  for (const t of idx) {
    const html = await admin.evaluate(async file => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); pg.slug = "si"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: [], pageProduct: "", site: { name: "Mystore", wa: "213000000000" } }); }, t.file);
    for (const w of [1360, 390]) {
      const res = {};
      for (const lang of ["ar", "fr"]) {
        const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob && process.env.SI_BROWSER !== "firefox", hasTouch: mob && process.env.SI_BROWSER !== "firefox", serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage();
        if (process.env.SI_DBG) await p.addInitScript(() => { window.__siDebug = 1; }); await p.route("**/__si.html*", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
        try { await p.goto(BASE + "/__si.html?lang=" + lang, { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(1500);
        await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); } window.scrollTo(0, 0); }); await sleep(1800);
        res[lang] = await p.evaluate(MEASURE); if (process.env.SI_DBG && lang === "fr") console.log("   LOG", w, JSON.stringify(await p.evaluate(() => (window.__siLog || []).filter(x => /x-28x9pmu|x-r3vumpf/.test(x[0]))))); await c.close();
      }
      const tag = t.id + "@" + w, A = res.ar, F = res.fr, aById = Object.fromEntries(A.boxes.map(b => [b.id, b]));
      const ovl = []; for (let i = 0; i < F.boxes.length; i++) for (let j = i + 1; j < F.boxes.length; j++) { const a = F.boxes[i], b = F.boxes[j]; if (a.rot || b.rot || !a.fz || !b.fz) continue;   /* التخطيط المتدفّق يعيد ترتيب نفسه؛ التداخل الجديد يظهر في الحر فقط */
    /* صندوق عنصر مُدار لا يمثّل تداخلاً فعلياً (يُفحص بصرياً) */
 const s = inter(a, b); if (!s) continue; const aa = aById[a.id], ab = aById[b.id]; const was = aa && ab ? inter(aa, ab) : 0; if (s > was * 1.25 + 150 && !(a.L <= b.L && a.R >= b.R && a.T <= b.T && a.B >= b.B) && !(b.L <= a.L && b.R >= a.R && b.T <= a.T && b.B >= a.B)) ovl.push([a.id, b.id, Math.round(s)]); }
      ck(tag, "لا تداخل نصوص جديد في الفرنسية", !ovl.length, ovl.slice(0, 5)); if (ovl.length && process.env.SI_DBG) for (const [x, y] of ovl.slice(0, 2)) console.log("   FR", JSON.stringify(F.boxes.filter(b => b.id === x || b.id === y)), "\n   AR", JSON.stringify(A.boxes.filter(b => b.id === x || b.id === y)));
      const aOff = new Set(A.off.map(x => x.id)), aClip = new Set(A.clip.map(x => x.id + x.el)), aBtn = new Set(A.btn.map(x => x.id));
      const off = F.off.filter(x => !aOff.has(x.id)), clip = F.clip.filter(x => !aClip.has(x.id + x.el)), btn = F.btn.filter(x => !aBtn.has(x.id));
      ck(tag, "لا نص خارج الشاشة جديد", !off.length, off.slice(0, 4)); ck(tag, "لا نص مقصوص جديد", !clip.length, clip.slice(0, 4)); ck(tag, "لا زر بأكثر من 3 أسطر جديد", !btn.length, btn.slice(0, 4));
    }
  }
  if (process.env.SI_OUT) fs.writeFileSync(process.env.SI_OUT, JSON.stringify(details, null, 1));
  console.log(`\n${fail ? fail + " إخفاق" : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
