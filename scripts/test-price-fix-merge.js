/* تعديل أسعار ولايات (priceFix) يُدمج فوق التعريفة المدمجة لا يستبدلها: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-price-fix-merge.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => { const A = Admin, base = { 8: { home: 1, stop: 1 } };
    const none = A.applyPriceFix(base, {}, "wecan"), fix = A.applyPriceFix(base, { priceFix: "8=900/650" }, "wecan"), two = A.applyPriceFix(base, { priceFix: "8=900/650, 16=500" }, "wecan"), noTar = A.applyPriceFix({ 8: { home: 7, stop: 7 } }, { priceFix: "8=900/650" }, "yalidine");
    return { none8: none[8], none16: none[16], fix8: fix[8], fix16: fix[16], fix42: fix[42], two16: two[16], noTar8: noTar[8], noTar16: noTar[16] }; });
  ok("بلا تعديل: التعريفة المدمجة كما هي (بشار 1000/800، الجزائر 540/400)", r.none8.home === 1000 && r.none8.stop === 800 && r.none16.home === 540, r);
  ok("«8=900/650» تغيّر بشار وحدها وتبقى بقية الولايات من التعريفة المدمجة", r.fix8.home === 900 && r.fix8.stop === 650 && r.fix16.home === 540 && r.fix16.stop === 400 && r.fix42 && r.fix42.home === 650, r);
  ok("عدة تعديلات معاً", r.two16.home === 500, r);
  ok("شركة بلا تعريفة مدمجة: التعديل يُطبَّق على أسعارها فقط ولا تُضاف ولايات", r.noTar8.home === 900 && r.noTar16 === undefined, r);
  const ap = await p.evaluate(() => { const A = Admin, api = { 8: { home: 900, stop: 650 }, 16: { home: 500, stop: 300 } }; const b = A.applyPriceFix(api, {}, "wecan"), a = A.applyPriceFix(api, { priceSrc: "API" }, "wecan"), af = A.applyPriceFix(api, { priceSrc: "api", priceFix: "16=555/444" }, "wecan"); return { b8: b[8], a8: a[8], a16: a[16], a42: a[42], af16: af[16], af8: af[8] }; });
  ok("الافتراضي: الجدول المدمج يطغى على أسعار API (بشار 1000/800)", ap.b8.home === 1000 && ap.b8.stop === 800, ap);
  ok("priceSrc=api: أسعار API كما جاءت (بشار 900/650، والجزائر 500/300) والمدمجة تملأ غير المجلوبة فقط (تيبازة 42)", ap.a8.home === 900 && ap.a8.stop === 650 && ap.a16.home === 500 && ap.a42 && ap.a42.home === 650, ap);
  ok("priceSrc=api مع تعديل ولاية: التعديل يُطبَّق عليها وحدها", ap.af16.home === 555 && ap.af16.stop === 444 && ap.af8.home === 900, ap);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
