/* شريط «فلتر مفعّل» فوق جدول الطلبات: يظهر مع الفلتر وينبّه إلى المؤكَّدة غير المرسَلة المخفية، وزرّ «عرض كل الطلبات» يمسحه. NODE_PATH=/opt/node-tools/node_modules node scripts/test-filter-note.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const o = {}; document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; const A = Admin;
    const mk = (id, st) => ({ id, date: new Date().toISOString(), name: "كريم" + id, phone: "0550000" + id.replace(/\D/g, "").padStart(3, "0"), wilaya: "Alger", commune: "x", dtype: "home", items: "عسل ×1 = 2000 DA", subtotal: 2000, fee: 0, total: 2000, status: st, note: "", extra: {} });
    A.orders = [mk("N1", "nouvelle"), mk("C1", "confirmee"), mk("C2", "confirmee"), mk("L1", "livree")]; A.tab("orders"); A.resetOrderFilters(); await new Promise(r => setTimeout(r, 300));
    o.none = !document.getElementById("of-active");
    const s = document.getElementById("order-filter-status"); s.value = "nouvelle"; A.applyOrderFilters(); await new Promise(r => setTimeout(r, 300));
    const d = document.getElementById("of-active"); o.txt = d ? d.textContent : ""; o.rows = document.querySelectorAll("#orders-table tr").length;
    d.querySelector("button").click(); await new Promise(r => setTimeout(r, 300));
    o.after = !document.getElementById("of-active"); o.rows2 = document.querySelectorAll("#orders-table tr").length; o.status2 = document.getElementById("order-filter-status").value;
    return o; });
  t("بلا فلتر: لا شريط", R.none, R);
  t("بفلتر «في انتظار التأكيد»: يظهر الشريط بعدد المعروض وينبّه إلى المؤكَّدتين غير المرسَلتين المخفيتين", /فلتر مفعّل/.test(R.txt) && /1 من 4/.test(R.txt) && /2 طلب مؤكَّد غير مُرسَل/.test(R.txt), R);
  t("زرّ «عرض كل الطلبات» يمسح الفلتر ويُظهر الكل", R.after && R.status2 === "" && R.rows2 >= 4, R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
