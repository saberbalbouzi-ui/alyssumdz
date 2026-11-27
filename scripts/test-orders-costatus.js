/* جدول الطلبات يعرض حالة الطرد عند الشركة تحت حالة الطلب. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); window.toast = () => { };
    const mk = (id, st, note) => ({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000" + id.slice(-3), wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note });
    Admin.orders = [mk("A1", "expediee", "🚚wecan:WC1"), mk("A2", "expediee", "🚚wecan:WC2"), mk("A3", "nouvelle", ""), mk("A4", "livree", "🚚wecan:WC4")];
    Admin.shipRaw = { A1: { raw: "En préparation" }, A4: { raw: "Livré" } }; Admin.tab("orders"); Admin.resetOrderFilters(); Admin.orderFilters.showShipped = true; const cs = document.getElementById("order-show-shipped"); if (cs) cs.checked = true; Admin.applyOrderFilters(); await new Promise(r => setTimeout(r, 400));
    const rows = [...document.querySelectorAll("#orders-table tr")].slice(1).map(r => r.innerText.replace(/\s+/g, " ")); return rows; });
  t("حالة الشركة تظهر للطلب المرسَل (En préparation وLivré)", R.some(x => /En préparation/.test(x)) && R.some(x => /Livré/.test(x)), R);
  t("طلب مرسَل بلا حالة بعد: «بانتظار حالة الشركة»، والطلب الجديد بلا سطر", R.some(x => /بانتظار حالة الشركة/.test(x)) && R.filter(x => /En préparation|بانتظار حالة الشركة|Livré/.test(x)).length === 3 && !/En préparation|بانتظار حالة الشركة|Livré/.test(R[0]), R);
  /* «عرض الكل» في الرئيسية يفتح الجدول بإظهار المرسَلة مع حالة الشركة */
  const H = await p.evaluate(async () => {
    const c = document.getElementById("order-show-shipped"); if (c) c.checked = false; Admin.orderFilters.showShipped = false; Admin.tab("home"); await new Promise(r => setTimeout(r, 1200));
    const btn = document.querySelector('#ahome [data-all="1"]'); if (!btn) return { nobtn: true }; btn.click(); await new Promise(r => setTimeout(r, 700));
    return { checked: !!(document.getElementById("order-show-shipped") || {}).checked, rows: [...document.querySelectorAll("#orders-table tr")].slice(1).map(r => r.innerText.replace(/\s+/g, " ")) }; });
  t("«عرض الكل»: تُظهر الطلبات المرسَلة وحالة الشركة تحت كل منها", H.checked && H.rows.length >= 4 && H.rows.some(x => /En préparation/.test(x)), H);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
