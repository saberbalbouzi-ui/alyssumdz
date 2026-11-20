/* التطبيق الذي جاء منه الطلب (ماسنجر/فيسبوك…) يُسجَّل في extra ويظهر شارة ومرشّحاً. NODE_PATH=/opt/node-tools/node_modules node scripts/test-order-app.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const UA = { m: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0;FBBV/1;FBDV/iPhone14,2]", f: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0;]", i: "Mozilla/5.0 (iPhone) Instagram 300.0", n: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1" };
  const got = {};
  for (const k of Object.keys(UA)) { const ctx = await b.newContext({ userAgent: UA[k] }), p = await ctx.newPage(); await p.goto("http://localhost:8765/order-embed.html?p=honey-focus&embed=1&utm_source=facebook&utm_campaign=c1", { waitUntil: "load" }); await p.waitForTimeout(600); got[k] = await p.evaluate(() => (typeof Attrib !== "undefined" ? Attrib : {})); await ctx.close(); }
  t("ماسنجر/فيسبوك/إنستغرام/عادي: «📲 التطبيق» صحيح وحملة محفوظة", got.m["📲 التطبيق"] === "ماسنجر" && got.f["📲 التطبيق"] === "فيسبوك" && got.i["📲 التطبيق"] === "إنستغرام" && !("📲 التطبيق" in got.n) && got.m["📣 الحملة"] === "facebook/c1", got);
  const p = await b.newPage(); await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(() => { const A = Admin, mk = (id, ex) => ({ id, date: new Date().toISOString(), name: "ز", phone: "0550000000", wilaya: "Alger", commune: "X", dtype: "home", items: "x ×1 = 1 DA", total: 1, status: "nouvelle", note: "", source: "web", extra: ex });
    A.orders = [mk("A", { "📣 الحملة": "facebook/c1", "📲 التطبيق": "ماسنجر" }), mk("B", { "📲 التطبيق": "ماسنجر" }), mk("C", {}), mk("D", { "📲 التطبيق": "فيسبوك" })];
    const bd = o => { const d = document.createElement("div"); d.innerHTML = A.srcBadge(o); return [...d.querySelectorAll(".o-src")].map(x => x.textContent).join("+"); };
    A.orderFilters = Object.assign({}, A.orderFilters, { src: "messenger", showShipped: true }); return { b: A.orders.map(bd), m: A.getFilteredOrders().map(x => x.o.id).join() }; });
  t("الشارات تجمع المنشأ والتطبيق، ومرشّح «من ماسنجر» يختار A وB", R.b.join("|") === "الموقع+حملة+ماسنجر|الموقع+رابط+ماسنجر|الموقع+رابط|الموقع+رابط+فيسبوك" && R.m === "A,B", R);
  await b.close(); process.exit(bad ? 1 : 0);
})();
