/* «🔀 تحويل» إلى الشركة الافتراضية يثبت بوسم إن كان التوجيه الذكي يختار غيرها (لم يكن يتحوّل). NODE_PATH=/opt/node-tools/node_modules node scripts/test-move-order.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin; window.toast = () => { }; A.renderOrders = () => { }; API.updateOrder = () => Promise.resolve();
    A.enabledCompanyKeys = () => ["wecan", "yalidine"]; A.activeCompanyKey = () => "wecan";
    const wid = (WILAYAS.find(w => /In Salah/i.test(w.name || w.n || "")) || {}).id || 52;
    AdminDispatch._S.cfg = { on: true, regions: {}, wil: { [wid]: "yalidine" } };
    const o = { id: "M1", name: "فاطمة", phone: "0550123456", wilaya: "In Salah", commune: "In Salah", dtype: "home", items: "x ×1 = 100 DA", status: "nouvelle", note: "" }; A.orders = [o];
    const before = A.orderCompanyKey(o); A.moveOrderTo(0, "wecan"); const toW = { note: o.note, key: A.orderCompanyKey(o) };
    A.moveOrderTo(0, "yalidine"); const toY = { note: o.note, key: A.orderCompanyKey(o) };
    A.moveOrderTo(0, "wecan"); const back = { note: o.note, key: A.orderCompanyKey(o) };
    return { before, toW, toY, back };
  });
  t("قبل التحويل يوجّه الذكي الطلب إلى ياليدين", R.before === "yalidine", R);
  t("التحويل إلى WeCan (الافتراضية) يثبت بوسم ويصير WeCan فعلاً", R.toW.key === "wecan" && /🏢wecan/.test(R.toW.note), R.toW);
  t("التحويل إلى ياليدين (الطبيعية) لا يحتاج وسماً", R.toY.key === "yalidine" && !/🏢/.test(R.toY.note), R.toY);
  t("والعودة إلى WeCan تثبّتها من جديد", R.back.key === "wecan", R.back);
  await b.close(); process.exit(bad ? 1 : 0);
})();
