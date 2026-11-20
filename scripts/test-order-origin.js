/* منشأ طلب الموقع: «حملة» (extra["📣 الحملة"]) أو «رابط» (بلا حملة) شارة ومرشّح في الطلبات. NODE_PATH=/opt/node-tools/node_modules node scripts/test-order-origin.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1100, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(() => {
    const A = Admin, mk = (id, ex, src) => ({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000000", wilaya: "Alger", commune: "X", dtype: "home", items: "x ×1 = 100 DA", total: 100, status: "nouvelle", note: "", source: src || "web", extra: ex });
    A.orders = [mk("C1", { "📣 الحملة": "facebook/honey-focus" }), mk("L1", { "📄 الصفحة": "tarkiz" }), mk("L2", {}), mk("M1", { "✍️ طلب يدوي": "نعم" }, "manual"), mk("C2", { "📣 الحملة": "tiktok/x", "🔗 معرّف النقر": "z" })];
    const bd = o => { const d = document.createElement("div"); d.innerHTML = A.srcBadge(o); return [...d.querySelectorAll(".o-src")].map(x => x.textContent).join("+"); };
    const flt = v => { A.orderFilters = Object.assign({}, A.orderFilters, { src: v, showShipped: true }); return A.getFilteredOrders().map(x => x.o.id).join(","); };
    return { b: A.orders.map(bd), all: flt(""), site: flt("site"), camp: flt("campaign"), link: flt("link"), man: flt("manual"), tt: A.orderOrigin(A.orders[0]) };
  });
  t("الشارات: حملة/رابط/يدوي", R.b.join("|") === "الموقع+حملة|الموقع+رابط|الموقع+رابط|يدوي|الموقع+حملة", R.b);
  t("المرشّح: الكل 5، الموقع 4، الحملة C1+C2، الرابط L1+L2، يدوي M1", R.all.split(",").length === 5 && R.site === "C1,L1,L2,C2" && R.camp === "C1,C2" && R.link === "L1,L2" && R.man === "M1", R);
  t("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  await b.close(); process.exit(bad ? 1 : 0);
})();
