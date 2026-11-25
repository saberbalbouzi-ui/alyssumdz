/* شارة SD في قائمة الطلبات للطلب المُسلَّم إلى مكتب (Stop Desk) فقط. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(() => {
    document.getElementById("app").classList.remove("hidden"); const A = Admin, mk = (id, dtype, desk) => ({ id, date: new Date().toISOString(), name: "اصيل", phone: "0550000001", wilaya: "Mila", commune: "Mila", dtype, desk, items: "عسل ×1 = 1 DA", total: 1000, status: "nouvelle", note: "" });
    const stop = A.srcBadge(mk("S1", "stop", "مكتب ميلة")), home = A.srcBadge(mk("S2", "home", "")), tbl = A.srcBadge(mk("S3", "stop", ""), true);
    A.orders = [mk("S1", "stop", "مكتب ميلة"), mk("S2", "home", "")]; A.renderOrders && A.renderOrders();
    return { stop, home, tbl, rows: [...document.querySelectorAll("#tab-orders tbody tr")].map(r => /class="o-src sd"|o-src sd/.test(r.innerHTML) ? "SD" : "-").join(",") };
  });
  t("طلب المكتب يحمل شارة SD مع اسم المكتب في التلميح", /o-src sd/.test(R.stop) && />SD</.test(R.stop) && /مكتب ميلة/.test(R.stop), R.stop);
  t("طلب المنزل بلا شارة SD، وجدول المرسَلة (له عمود SD) لا يكرّرها", !/o-src sd/.test(R.home) && !/o-src sd/.test(R.tbl), R);
  t("قائمة الطلبات: صف المكتب وحده يحمل SD", R.rows.split(",").filter(x => x === "SD").length === 1 && R.rows.split(",").length >= 2, R.rows);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
