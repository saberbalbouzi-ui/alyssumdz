/* تمييز الطلبات اليدوية عن طلبات الموقع (وسم + فلتر): python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-order-source.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const mk = (id, extra) => ({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000000", wilaya: "الجزائر", commune: "x", dtype: "home", items: "منتج ×1 = 1000 DA", subtotal: 1000, fee: 0, total: 1000, extra: extra || {}, status: "nouvelle", note: "" });
    const out = {}; const A = Admin;
    out.cls = { site: A.isManualOrder(mk("S261114-AAAAA")), man: A.isManualOrder(mk("M261114-PYTD5")), flag: A.isManualOrder(mk("X1", { "✍️ طلب يدوي": "نعم" })), src: A.isManualOrder(Object.assign(mk("X2"), { source: "manual" })), str: A.isManualOrder(mk("X3", JSON.stringify({ "✍️ طلب يدوي": "نعم" }))), nul: A.isManualOrder(null) };
    A.orders = [mk("S261114-AAAAA"), mk("M261114-PYTD5", { "✍️ طلب يدوي": "نعم" }), mk("S261114-BBBBB")];
    A.orderFilters = {}; A.orderPage = 1; A.renderOrders();
    const rows = [...document.querySelectorAll("#orders-table tr")].slice(1);
    out.badges = rows.map(r => (r.querySelector(".o-src") || {}).textContent || "");
    const sel = document.getElementById("order-filter-src"); out.hasSel = !!sel;
    sel.value = "manual"; A.applyOrderFilters(); out.man = [...document.querySelectorAll("#orders-table .o-src")].map(e => e.textContent);
    sel.value = "site"; A.applyOrderFilters(); out.site = [...document.querySelectorAll("#orders-table .o-src")].map(e => e.textContent);
    A.resetOrderFilters(); out.reset = sel.value + "|" + [...document.querySelectorAll("#orders-table .o-src")].length;
    const c = getComputedStyle(document.querySelector("#orders-table .o-src.man")); out.color = c.color + "|" + c.backgroundColor;
    return out; });
  ok("تصنيف: S موقع، M يدوي، وسم/مصدر/نص JSON يدوي، null ⇒ لا", !r.cls.site && r.cls.man && r.cls.flag && r.cls.src && r.cls.str && !r.cls.nul, r.cls);
  ok("وسم كل صف: موقع / يدوي / موقع", JSON.stringify(r.badges) === JSON.stringify(["الموقع", "يدوي", "الموقع"]), r.badges);
  ok("الفلتر موجود", r.hasSel, r);
  ok("فلتر «يدوية» يُبقي اليدوي فقط", JSON.stringify(r.man) === JSON.stringify(["يدوي"]), r.man);
  ok("فلتر «من الموقع» يُبقي طلبات الموقع فقط", JSON.stringify(r.site) === JSON.stringify(["الموقع", "الموقع"]), r.site);
  ok("إعادة الضبط تمسح الفلتر وتعيد الكل", r.reset === "|3", r.reset);
  ok("الوسم ملوّن (غير شفاف)", /rgb/.test(r.color) && !/rgba\(0, 0, 0, 0\)/.test(r.color.split("|")[1] || ""), r.color);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
