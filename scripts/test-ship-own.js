/* إضافات بلديات ياليدين لا تُضاف على شركة تعريفتها كاملة (own): python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-ship-own.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const run = async own => {
    const c = await b.newContext(), p = await c.newPage();
    await p.route(/assets\/data\/ship-co\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ def: "dhd", companies: { dhd: { name: "DHD", adj: 0, prices: { "1": { home: 1100, stop: 600 } }, ...(own ? { own: 1 } : {}) } }, sup: { "1": { tit: [200, 0] } }, cp: {}, nd: {} }) }));
    await p.goto("http://localhost:8765/", { waitUntil: "load" }); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const w = WILAYAS.find(x => x.id === 1); return { tit: shipQuote(w, "Tit", "home", 0, "").fee, adrar: shipQuote(w, "Adrar", "home", 0, "").fee }; });
    await c.close(); return r;
  };
  const a = await run(true), n = await run(false);
  ok("شركة own: بلدية بإضافة ياليدين (Tit +200) تبقى بسعر تعريفة الشركة 1100", a.tit === 1100 && a.adrar === 1100, a);
  ok("شركة بلا own: الإضافة تُطبَّق كما كان (1300) — لا انحدار للشركات الأخرى", n.tit === 1300 && n.adrar === 1100, n);
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
