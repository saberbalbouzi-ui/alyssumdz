/* بكسلات صفحة الهبوط: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-lp-pixels.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const run = async (pixels, lpHtmlExtra) => {
    const c = await b.newContext(), p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
    await p.route(/assets\/data\/pixels\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pixels) }));
    await p.route(/connect\.facebook\.net|analytics\.tiktok\.com|googletagmanager\.com/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
    await p.route(/supabase\.co|generativelanguage|script\.google\.com/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.route("http://localhost:8765/lp/_pxtest/index.html", r => r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>LP</h1><script src="../../assets/js/data.js"></script><script src="../../assets/js/lp-pixels.js" data-prod="anti-acne" data-page="_pxtest" defer></script><iframe id="f" src="../../order-embed.html?p=anti-acne&embed=1&src=lp%2F_pxtest" style="width:420px;height:700px"></iframe>${lpHtmlExtra || ""}</body></html>` }));
    await p.goto("http://localhost:8765/lp/_pxtest/index.html", { waitUntil: "load" }); await p.waitForTimeout(4500);
    return { p, c, errs, fr: p.frames().find(f => /order-embed/.test(f.url())) };
  };
  /* 1) بكسل فيسبوك بنطاق المنتج: الصفحة الأم تتولاه والإطار لا يحمّله */
  let { p, c, errs, fr } = await run([{ id: "px1", platform: "facebook", pixelId: "111222333", scope: ["anti-acne"], active: true }]);
  const q1 = await p.evaluate(() => (window.fbq && window.fbq.queue ? [...window.fbq.queue].map(a => Array.from(a).map(x => typeof x === "object" ? "{}" : x).join(":")) : null));
  ok("الصفحة الأم تحمّل البكسل: init + PageView + ViewContent مرة واحدة (من الإطار)", q1 && q1.includes("init:111222333") && q1.includes("track:PageView") && q1.filter(z => /^track:ViewContent/.test(z)).length === 1, q1);
  ok("الإطار لا يحمّل البكسل (لا تكرار)", (await fr.evaluate(() => typeof window.fbq)) === "undefined");
  await fr.evaluate(() => { trackEvent("Lead", { slug: "anti-acne", value: 1800 }); firePixelPurchase({ slug: "anti-acne", title: "x" }, 1800, 1, "ORD1"); }); await p.waitForTimeout(500);
  const q2 = await p.evaluate(() => [...window.fbq.queue].map(a => Array.from(a)[0] + ":" + Array.from(a)[1]));
  ok("حدثا Lead وPurchase من الإطار يصلان إلى بكسل الصفحة الأم", q2.includes("track:Lead") && q2.includes("track:Purchase"), q2);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2)); await c.close();
  /* قيمة الشراء: الافتراضي إجمالي الطلب، و valueMode=products بدون التوصيل (الصفحة الأم) */
  for (const [mode, want] of [[undefined, 2200], ["products", 1800]]) {
    ({ p, c, errs, fr } = await run([{ id: "pv", platform: "facebook", pixelId: "555", scope: "all", active: true, currency: "DZD", ...(mode ? { valueMode: mode } : {}) }]));
    await fr.evaluate(() => firePixelPurchase({ slug: "anti-acne", title: "x" }, 2200, 1, undefined, 400)); await p.waitForTimeout(400);
    const pv = await p.evaluate(() => { const a = [...window.fbq.queue].find(z => Array.from(z)[1] === "Purchase"); return a ? Array.from(a)[2] : null; });
    ok("قيمة Purchase في صفحة الهبوط (" + (mode || "total") + ") = " + want + " DZD", pv && pv.value === want && pv.currency === "DZD", pv); await c.close();
  }
  /* صفحة المنتج نفسها (بلا إطار) */
  { const c3 = await b.newContext(), p3 = await c3.newPage();
    await p3.route(/assets\/data\/pixels\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "pp", platform: "facebook", pixelId: "777", scope: "all", active: true, valueMode: "products" }]) }));
    await p3.route(/connect\.facebook\.net/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: "" })); await p3.route(/supabase\.co|script\.google\.com/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p3.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await p3.waitForTimeout(3500);
    await p3.evaluate(() => firePixelPurchase({ slug: "anti-acne", title: "x" }, 2200, 1, undefined, 400));
    const pv2 = await p3.evaluate(() => { const a = [...window.fbq.queue].find(z => Array.from(z)[1] === "Purchase"); return a ? Array.from(a)[2] : null; });
    ok("صفحة المنتج: valueMode=products ← 1800 بدون التوصيل", pv2 && pv2.value === 1800, pv2); await c3.close(); }
  /* 2) نطاق منتج آخر: لا يُطبَّق */
  ({ p, c, errs, fr } = await run([{ id: "px2", platform: "facebook", pixelId: "999", scope: ["other-product"], active: true }]));
  ok("بكسل لمنتج آخر لا يُطبَّق على الصفحة", (await p.evaluate(() => typeof window.fbq)) === "undefined"); await c.close();
  /* 3) كل الصفحات + تيك توك */
  ({ p, c, errs, fr } = await run([{ id: "px3", platform: "tiktok", pixelId: "TT123", scope: "all", active: true }]));
  ok("بكسل «كل الصفحات» (تيك توك) يُطبَّق على الصفحة", (await p.evaluate(() => typeof window.ttq)) === "object" && (await fr.evaluate(() => typeof window.ttq)) === "undefined"); await c.close();
  /* 4) صفحة أم بلا lp-pixels (قديمة): الإطار يحمّل البكسل بنفسه كما كان */
  const c2 = await b.newContext(), p2 = await c2.newPage();
  await p2.route(/assets\/data\/pixels\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "px4", platform: "facebook", pixelId: "444", scope: "all", active: true }]) }));
  await p2.route(/connect\.facebook\.net/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: "" })); await p2.route(/supabase\.co|script\.google\.com/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p2.route("http://localhost:8765/lp/_pxold/index.html", r => r.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><body><iframe id="f" src="../../order-embed.html?p=anti-acne&embed=1" style="width:420px;height:700px"></iframe></body></html>` }));
  await p2.goto("http://localhost:8765/lp/_pxold/index.html", { waitUntil: "load" }); await p2.waitForTimeout(4500);
  const fr2 = p2.frames().find(f => /order-embed/.test(f.url())); ok("صفحة قديمة بلا lp-pixels: الإطار يحمّل البكسل بنفسه (لا فقدان للأحداث)", (await fr2.evaluate(() => typeof window.fbq)) === "function"); await c2.close();
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
