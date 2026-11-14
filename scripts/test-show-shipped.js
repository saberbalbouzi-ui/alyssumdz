/* «إظهار المسجلة» في الطلبات يُحفظ بين الزيارات: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-show-shipped.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  const seed = () => { const mk = (id, note) => ({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000000", wilaya: "الجزائر", commune: "x", dtype: "home", items: "م ×1 = 1 DA", subtotal: 1, fee: 0, total: 1, extra: {}, status: "confirmee", note }); Admin.orders = [mk("S1-AAA", ""), mk("S2-BBB", "🚚yalidine:yal-1")]; };
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r1 = await p.evaluate((sd) => { eval("(" + sd + ")()"); Admin.orderFilters = {}; Admin.renderOrders(); const n0 = document.querySelectorAll("#orders-table tr").length - 1; const c = document.getElementById("order-show-shipped"); c.checked = true; Admin.applyOrderFilters(); return { n0, n1: document.querySelectorAll("#orders-table tr").length - 1, ls: localStorage.getItem("alyssum_show_shipped") }; }, seed.toString());
  ok("افتراضياً المسجل مخفي، وبعد التفعيل يظهر ويُحفظ الخيار", r1.n0 === 1 && r1.n1 === 2 && r1.ls === "1", r1);
  await p.reload({ waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r2 = await p.evaluate((sd) => { eval("(" + sd + ")()"); Admin._shipPrefInit = 0; Admin.orderFilters = {}; Admin.renderOrders(); return { n: document.querySelectorAll("#orders-table tr").length - 1, chk: document.getElementById("order-show-shipped").checked }; }, seed.toString());
  ok("بعد إعادة التحميل يبقى الخيار مفعّلاً ويُعرض الطلبان", r2.n === 2 && r2.chk === true, r2);
  const r3 = await p.evaluate(() => { Admin.resetOrderFilters(); return { ls: localStorage.getItem("alyssum_show_shipped"), n: document.querySelectorAll("#orders-table tr").length - 1 }; });
  ok("«مسح الفلاتر» يعيد إخفاء المسجلة ويحفظ ذلك", r3.ls === "0" && r3.n === 1, r3);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
