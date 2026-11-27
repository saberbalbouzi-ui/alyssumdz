/* «Tentative échouée» محاولة فاشلة لا فشل توصيل: الطلب المسجَّل echec وحالة شركته الآن تentative يعود «في الطريق» فيدخل التنبيهات؛ والمرتجع الحقيقي والمرفوض والمسلَّم لا يُمسّ. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } }); let bad = 0; const t = (n, ok, x) => { console.log((ok ? "✓ " : "✗ ") + n + (ok ? "" : " " + JSON.stringify(x))); if (!ok) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:" + (process.env.PORT || 8765) + "/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(8000);
  const r = await p.evaluate(() => { document.getElementById("app").classList.remove("hidden"); const calls = [];
    API.updateOrder = (k, id, st, note) => { calls.push([id, st]); }; Admin.syncStockForOrder = () => { }; Admin.renderOrders = () => { }; Admin.renderStats = () => { };
    const mk = (id, st, note) => ({ id, status: st, note, phone: "0550000000", name: "x", date: new Date().toISOString() });
    Admin.orders = [mk("A", "echec", "🚚wecan:WS-1 🔁received"), mk("B", "echec", "🚚wecan:WS-2"), mk("C", "echec", "🚚wecan:WS-3 📲ref"), mk("D", "livree", "🚚wecan:WS-4"), mk("E", "echec", ""), mk("F", "echec", "🚚wecan:WS-6")];
    Admin.shipRaw = { A: { raw: "Tentative échouée" }, B: { raw: "Retour reçu" }, C: { raw: "Tentative échouée" }, D: { raw: "Tentative échouée" }, E: { raw: "Tentative échouée" }, F: { raw: "Echec livraison" } };
    const n = Admin.reviveFailedAttempt(); return { n, st: Object.fromEntries(Admin.orders.map(o => [o.id, o.status])), noteA: Admin.orders[0].note, calls }; });
  t("محاولة فاشلة مسجَّلة فشلاً تعود «في الطريق» وحدها", r.n === 1 && r.st.A === "expediee", r);
  t("وسم مرحلة المرتجع (🔁) يُزال عنها", !/🔁/.test(r.noteA), r.noteA);
  t("المرتجع الحقيقي/رفض الاستلام/المسلَّم/بلا تتبع/فشل نهائي لا تُمسّ", r.st.B === "echec" && r.st.C === "echec" && r.st.D === "livree" && r.st.E === "echec" && r.st.F === "echec", r.st);
  const r2 = await p.evaluate(() => { Admin.orders[0].status = "echec"; return { n: Admin.reviveFailedAttempt(), st: Admin.orders[0].status }; });
  t("إن أعاده التاجر فاشلاً يدوياً بعدها لا يُعاد تلقائياً ثانية", r2.n === 0 && r2.st === "echec", r2);
  t("كُتب التحديث لطلب واحد فقط", r.calls.length === 1 && r.calls[0][0] === "A", r.calls);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
