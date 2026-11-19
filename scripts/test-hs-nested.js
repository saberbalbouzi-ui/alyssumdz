/* جدول داخل حاوية overflow:auto على الهاتف: لا مُمرِّران متداخلان، والشريط العلوي يبلغ آخر عمود. NODE_PATH=/opt/node-tools/node_modules node scripts/test-hs-nested.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden");
    const h = document.createElement("div"); h.innerHTML = '<div style="overflow:auto"><table style="border-collapse:collapse;min-width:520px"><thead><tr><th>الشركة</th><th>الطلبات</th><th>مدفوعة</th><th>المبالغ المستلمة</th><th>قيد التوصيل</th><th>المبالغ المستردة</th><th>مرتجعة</th></tr></thead><tbody><tr><td>WeCan Service</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td></tr></tbody></table></div>'; document.getElementById("app").appendChild(h);
    await new Promise(r => setTimeout(r, 1200)); const tb = h.querySelector("table"), w = tb.parentElement, bar = w.previousElementSibling;
    const out = { m: tb.classList.contains("m-scroll"), bar: !!(bar && bar.classList.contains("hs-bar") && bar.classList.contains("on")), range: w.scrollWidth - w.clientWidth };
    bar.scrollLeft = -(bar.scrollWidth - bar.clientWidth); await new Promise(r => setTimeout(r, 200)); out.end = Math.abs(w.scrollLeft) >= out.range - 2; return out;
  });
  const OT = await p.evaluate(async () => {
    const h = document.createElement("div"); h.innerHTML = '<div class="card rtw" style="overflow:auto"><table id="orders-table-x" style="min-width:600px"><thead><tr><th>أ</th><th>ب</th><th>ج</th><th>د</th><th>هـ</th></tr></thead><tbody><tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr></tbody></table></div>'; document.getElementById("app").appendChild(h);
    const tb = h.querySelector("table"); tb.id = "orders-table"; const prev = document.getElementById("orders-table"); if (prev && prev !== tb) prev.id = "orders-table-old";
    await new Promise(r => setTimeout(r, 1200)); const w = tb.parentElement, bar = w.previousElementSibling; return { dup: !!(bar && bar.classList.contains("hs-bar")), m: tb.classList.contains("m-scroll") };
  });
  t("جدول الطلبات داخل .rtw: لا شريط مكرَّر على الحاوية (يتولاه شريط الطلبات)", OT.dup === false, OT);
  t("الجدول داخل حاوية التمرير لا يصير m-scroll", R.m === false, R);
  t("الشريط العلوي على الحاوية ويبلغ آخر عمود", R.bar && R.range > 0 && R.end, R);
  await b.close(); process.exit(bad ? 1 : 0);
})();
