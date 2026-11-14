/* رسم الإرجاع المضبوط لشركة الطلب يسبق الثابت 250 في حساب الأرباح: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-ret-fee.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => { let co = "dhd"; const o = { id: "T1" }; Admin.orderCoKey = () => co; Admin.deliveryCfg = Object.assign({}, Admin.deliveryCfg, { dhd: { retFee: 50 }, wecan: {} });
    const out = { dhd: Admin.retCost(0, o) }; co = "yalidine"; out.yal = Admin.retCost(0, o); co = "wecan"; out.wecan = Admin.retCost(0, o); co = "none"; out.none = Admin.retCost(0, o); out.noOrder = Admin.retCost(0); Admin.deliveryCfg.dhd.retFee = 0; co = "dhd"; out.dhdZero = Admin.retCost(0, o); return out; });
  ok("DHD برسم إرجاع 50 في الإعداد ⇒ 50 (لا 250)", r.dhd === 50, r);
  ok("ياليدين يبقى 250", r.yal === 250, r);
  ok("شركة بلا رسم مضبوط تبقى على السلوك السابق (250)", r.wecan === 250 && r.none === 250 && r.noOrder === 250, r);
  ok("رسم إرجاع 0 مضبوط ⇒ 0 (شركة لا تأخذ رسم إرجاع)", r.dhdZero === 0, r);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
