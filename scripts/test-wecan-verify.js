/* WeCan: لا يُسجَّل الطلب «مُرسَلاً» إلا إن ظهر فعلاً عندها بعد الإرسال (verifyCreated). NODE_PATH=/opt/node-tools/node_modules node scripts/test-wecan-verify.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; let notices = []; A.showNotice = (t, h) => { notices.push(t + " " + h); }; A.renderOrders = () => { }; A.setShipRaw = () => { }; A.companyWilayas = async () => ({});
    A.deliveryCfg = { wecan: { enabled: true, isDefault: true, apiKey: "k", apiSecret: "s", prices: {}, legacy: "2" } };
    const mk = id => ({ id, date: new Date().toISOString(), name: "زبون", phone: "0550123456", wilaya: "Adrar", commune: "Adrar", dtype: "home", desk: "", items: "منتج ×1 = 1800 DA", subtotal: 1800, fee: 1000, total: 2800, extra: {}, status: "confirmee", note: "" });
    const run = async (mode) => {
      A.orders = [mk("V1")]; let saved = 0; A.saveTracking = () => { saved++; }; notices = [];
      A.courierFetch = async req => { if (req.method === "POST") return { ok: true, status: 200, text: JSON.stringify({ V1: { success: true, order_id: "V1", status: "En attente" } }) };
        if (mode === "empty") return { ok: true, status: 200, text: JSON.stringify({ data: [] }) };
        if (mode === "found") return { ok: true, status: 200, text: JSON.stringify({ data: [{ id: 5, attributes: { order_number: "V1" } }] }) };
        return { ok: false, status: 500, text: "err" }; };
      const r = await A._sendOrderToDelivery(0, "wecan"); return { r, saved, n: notices.length, nt: notices[0] || "" };
    };
    out.empty = await run("empty"); out.found = await run("found"); out.err = await run("err");
    return out; });
  ok("غير موجود عند WeCan: لا يُسجَّل التتبع ويظهر إشعار دائم", R.empty.saved === 0 && R.empty.r !== true && /لم يظهر الطلب/.test(R.empty.nt), R.empty);
  ok("موجود عندها: يُسجَّل", R.found.saved === 1 && R.found.r === true, R.found);
  ok("تعذّر الجزم (خطأ 500): لا نمنع ويُسجَّل", R.err.saved === 1, R.err);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
