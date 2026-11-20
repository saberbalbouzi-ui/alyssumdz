// تحقق مستهدف للتباين في الحالة الحقيقية (حركات الدخول تعمل فعلاً، التمرير حتى ظهور العنصر): لكل عنصر نصي مُحدَّد يُخفى نصه وحده ويُلتقط محيطه ثم يحسب scripts/contrast-calc.py النسبة.
// CV_ITEMS='[["s-nexus",390,"— عن المتجر"],...]' CV_OUT=/tmp/cv EQA_BASE=… NODE_PATH=… node tests/contrast-verify.js
const { chromium } = require("playwright"); const declareProtect = require("./_declared-protect"); const fs = require("fs");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", OUT = process.env.CV_OUT || "/tmp/cv", ITEMS = JSON.parse(process.env.CV_ITEMS || "[]"); const sleep = ms => new Promise(r => setTimeout(r, ms)); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const br = await chromium.launch(), actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage();
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const byId = {}; for (const [id, w, t] of ITEMS) (byId[id + "@" + w] = byId[id + "@" + w] || { id, w, ts: [] }).ts.push(t);
  let n = 0;
  for (const key of Object.keys(byId)) {
    const { id, w, ts } = byId[key];
    const html = await admin.evaluate(async file => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); const slug = ((Admin.products || [])[0] || {}).slug || ""; pg.product = slug; pg.slug = "cv"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: (Admin.products || []), pageProduct: slug, site: { name: "متجرك", wa: "213555000000" } }); }, id);
    const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, deviceScaleFactor: 1, serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage(); const route = BASE + "/__cv.html";
    await p.route(route, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); try { await p.goto(route, { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(1500);
    for (const t of ts) {
      const idx = await p.evaluate(t => { const els = [...document.body.querySelectorAll("*")].filter(e => ![...e.childNodes].some(x => x.nodeType === 1) && (e.textContent || "").includes(t) && !/^(SCRIPT|STYLE)$/.test(e.tagName)); window.__cvEl = els[0] || null; if (!els[0]) return false; els[0].scrollIntoView({ block: "center" }); return true; }, t);
      if (!idx) { console.log("لا عنصر:", id, w, t); continue; } await sleep(1600);
      const info = await p.evaluate(() => { const el = window.__cvEl, cs = getComputedStyle(el), r = el.getBoundingClientRect(); const rgba = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); const a = m[1].split(",").map(parseFloat); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; }; let op = 1; for (let q = el; q && q.nodeType === 1; q = q.parentElement) op *= parseFloat(getComputedStyle(q).opacity); const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400; const col = rgba(cs.color); el.style.setProperty("color", "transparent", "important"); el.style.setProperty("-webkit-text-fill-color", "transparent", "important"); el.style.setProperty("text-shadow", "none", "important"); const hx = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); const vis = !!hx && (el.contains(hx) || hx.contains(el)); return { vis, hit: hx ? hx.tagName + "." + String(hx.className || "").slice(0, 30) : null, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), color: col, alpha: col[3] * op, fs, large: fs >= 24 || (fs >= 18.66 && fw >= 700), tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 40) }; });
      if (!info.vis) console.log("محجوب/غير ظاهر:", id, w, t, "←", info.hit);
      await sleep(250); const f = `${id}__${w}-${++n}`; const clip = { x: 0, y: 0, width: w, height: mob ? 844 : 900 }; await p.screenshot({ path: `${OUT}/${f}.png`, clip });
      fs.writeFileSync(`${OUT}/${f}.json`, JSON.stringify({ id, cat: "verify", w, boxes: [{ tag: info.tag, cls: info.cls, text: t, x: Math.max(0, info.x), y: Math.max(0, info.y), w: info.w, h: info.h, color: info.color, alpha: info.alpha, fs: info.fs, large: info.large, grad: false, stroke: 0 }] }));
    }
    await c.close();
  }
  await br.close();
})();
