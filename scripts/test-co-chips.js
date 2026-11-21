/* أعداد شرائح الشركات في «الطلبات» تتبع المرشّحات الأخرى (الحالة…) لا كل الطلبات. NODE_PATH=/opt/node-tools/node_modules node scripts/test-co-chips.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); const A = Admin;
    const mk = (i, st, co) => ({ id: "M26112" + i + "-AB" + i, date: new Date().toISOString(), name: "ز" + i, phone: "05500000" + i, wilaya: "Alger", commune: "x", dtype: "home", items: "a ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, status: st, note: co ? " 🏢" + co : "", extra: {} });
    A.orders = [mk(1, "nouvelle", "yalidine"), mk(2, "nouvelle", ""), mk(3, "confirmee", "yalidine"), mk(4, "confirmee", ""), mk(5, "livree", ""), mk(6, "annulee", ""), mk(7, "echec", "yalidine"), mk(8, "livree", "")];
    A.enabledCompanyKeys = () => ["wecan", "yalidine"]; A.orderCompanyKey = o => (/🏢yalidine/.test(o.note || "") ? "yalidine" : "wecan"); A.orderCoKey = A.orderCompanyKey; A.coLabel = k => k;
    const box = document.getElementById("order-co-chips");
    A.orderFilters = { q: "", status: "", wilaya: "", company: "", src: "", dateFrom: "", dateTo: "", showShipped: false };
    A.renderOrderCoChips(); const all = box.textContent.replace(/\s+/g, " ");
    A.orderFilters.status = "confirmee"; A.renderOrderCoChips(); const conf = box.textContent.replace(/\s+/g, " ");
    A.orderFilters.status = "confirmee"; A.orderFilters.company = "yalidine"; A.renderOrderCoChips(); const withCo = box.textContent.replace(/\s+/g, " "); const list = A.getFilteredOrders().length;
    return { all, conf, withCo, list };
  });
  t("بلا مرشّح: الكل 8 (ياليدين 3 + wecan 5)", /الكل 8/.test(R.all) && /yalidine 3/.test(R.all) && /wecan 5/.test(R.all), R.all);
  t("مرشّح الحالة «مؤكَّد»: الكل 2 وياليدين 1 وwecan 1", /الكل 2/.test(R.conf) && /yalidine 1/.test(R.conf) && /wecan 1/.test(R.conf), R.conf);
  t("اختيار شركة لا يغيّر أعداد الشرائح، والقائمة تطابق عدّ الشريحة", /الكل 2/.test(R.withCo) && /yalidine 1/.test(R.withCo) && R.list === 1, R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
