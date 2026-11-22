// توحيد بطاقات المنتجات وتبويباتها في كل القوالب (حاسوب 1360 / هاتف 390): التبويبات في سطر أفقي واحد (قابلة للتمرير)،
// وبطاقات كل عنصر منتجات بعرض وارتفاع متساويين ونسبة صورة 4/5، ولا تعدٍّ أفقي. التشغيل: EQA_BASE=… NODE_PATH=… node tests/product-cards.js  (PC_IDS لتحديد قوالب)
const { chromium } = require("playwright"); const declareProtect = require("./_declared-protect");
const BASE = process.env.EQA_BASE, PW = process.env.EQA_PASS || "TestPass12345", IDS = process.env.PC_IDS ? process.env.PC_IDS.split(",") : null; const sleep = ms => new Promise(r => setTimeout(r, ms));
const SKIP_RATIO = new Set(["s-perfume", "s-skincare", "s-makeup", "s-women", "s-men", "s-kids", "s-alyssum"]); let pass = 0, fail = 0; const failures = [];
const ck = (t, n, ok, d) => { if (ok) pass++; else { fail++; failures.push(t + ": " + n); } console.log(`${ok ? "PASS" : "FAIL"} [${t}] ${n}${!ok && d !== undefined ? "  — " + JSON.stringify(d).slice(0, 300) : ""}`); };
(async () => {
  const br = await chromium.launch(), actx = await br.newContext({ viewport: { width: 1360, height: 900 } }); await declareProtect(actx); const admin = await actx.newPage();
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await sleep(4000); await admin.evaluate(pw => { const e = document.getElementById("login-pass"); e.classList.remove("hidden"); e.value = pw; Admin.login(); }, PW); await sleep(3500);
  await admin.goto(BASE + "/admin.html", { waitUntil: "commit", timeout: 90000 }); await admin.waitForFunction(() => typeof Admin !== "undefined" && typeof PB !== "undefined" && Admin.products && Admin.products.length, null, { timeout: 60000 }); await sleep(2500);
  const idx = (await admin.evaluate(async () => (await (await fetch("assets/pages/templates/index.json", { cache: "no-store" })).json()).map(x => ({ id: x.id, file: x.file || x.id })))).filter(x => !IDS || IDS.includes(x.id));
  for (const t of idx) {
    const html = await admin.evaluate(async file => { const r = await fetch("assets/pages/templates/" + file + ".json", { cache: "no-store" }); const pg = PB.migrate(await r.json()); pg.slug = "pc"; return PB.fullHtml(pg, { base: "", baseHref: location.origin + "/", edit: false, path: "", demo: true, products: [], pageProduct: "", site: { name: "Mystore", wa: "213000000000" } }); }, t.file);
    if (!/pb-pgrid/.test(html)) continue;
    for (const w of [1360, 390]) {
      const mob = w < 600, c = await br.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob, serviceWorkers: "block" }); await declareProtect(c); const p = await c.newPage(); const route = BASE + "/__pc.html";
      await p.route(route, r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })); try { await p.goto(route, { waitUntil: "load", timeout: 60000 }); } catch (e) { } await sleep(1200);
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); } window.scrollTo(0, 0); }); await sleep(900);
      const r = await p.evaluate(() => {
        const tabs = [...document.querySelectorAll(".pb-ptabs")].map(b => { const bs = [...b.querySelectorAll("button")]; const tops = new Set(bs.map(x => Math.round(x.getBoundingClientRect().top))); return { n: bs.length, rows: tops.size, wrap: getComputedStyle(b).flexWrap }; });
        const boxes = [...document.querySelectorAll(".pb-prod")].map(bx => { const cs = [...bx.querySelectorAll(".pb-pc")].filter(c => c.getBoundingClientRect().width > 20 && getComputedStyle(c).display !== "none"); const ws = cs.map(c => c.offsetWidth), hs = cs.map(c => c.offsetHeight); /* offset* لا تتأثر بدوران زخرفي */ const im = cs.map(c => { const i = c.querySelector(".pb-pci"); if (!i) return 0; const q = i.getBoundingClientRect(); return +(q.width / q.height).toFixed(3); }); return { n: cs.length, wd: Math.max(0, ...ws) - Math.min(...(ws.length ? ws : [0])), hd: Math.max(0, ...hs) - Math.min(...(hs.length ? hs : [0])), ratio: im.length ? [Math.min(...im), Math.max(...im)] : [0, 0] }; });
        return { tabs, boxes, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
      });
      const tag = t.id + "@" + w;
      ck(tag, "التبويبات في سطر أفقي واحد (لا التفاف)", r.tabs.every(x => x.rows <= 1 && x.wrap === "nowrap"), r.tabs);
      ck(tag, "بطاقات كل عنصر منتجات: عرض وارتفاع متساويان", r.boxes.every(b => b.n < 2 || (b.wd <= 2 && b.hd <= 2)), r.boxes);
      if (!SKIP_RATIO.has(t.id)) ck(tag, "نسبة صورة البطاقة 4/5 موحَّدة", r.boxes.every(b => !b.n || (Math.abs(b.ratio[0] - 0.8) < 0.02 && Math.abs(b.ratio[1] - 0.8) < 0.02)), r.boxes.map(b => b.ratio));
      if (mob) ck(tag, "لا تمرير أفقي في الصفحة", !r.over, r.over);
      await c.close();
    }
  }
  console.log(`\n${fail ? fail + " إخفاق: " + failures.slice(0, 20).join(" | ") : "✓ كل الفحوص نجحت"} (${pass} نجاح)`); await br.close(); process.exit(fail ? 1 : 0);
})();
