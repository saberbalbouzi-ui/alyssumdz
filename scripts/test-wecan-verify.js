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
        if (mode === "parcelsOnly") return /\/parcels\//.test(req.url) ? { ok: true, status: 200, text: JSON.stringify({ last_status: "En préparation", tracking: "V1" }) } : { ok: true, status: 200, text: JSON.stringify({ data: [] }) };
        if (mode === "found") return { ok: true, status: 200, text: JSON.stringify({ data: [{ id: 5, attributes: { order_number: "V1" } }] }) };
        return { ok: false, status: 500, text: "err" }; };
      const r = await A._sendOrderToDelivery(0, "wecan"); return { r, saved, n: notices.length, nt: notices[0] || "" };
    };
    { A.orders = [mk("V1")]; A.orders[0].extra = { "🚚 الناقل": "WeCanServices" }; let posts = 0, saved = 0, toasts = []; window.toast = m => toasts.push(m); A.saveTracking = () => { saved++; }; notices = [];
      A.courierFetch = async req => { if (req.method === "POST") { posts++; return { ok: true, status: 200, text: JSON.stringify({ V1: { success: true, order_id: "V1" } }) }; } return { ok: true, status: 200, text: JSON.stringify({ data: [{ id: 5, attributes: { order_number: "V1" } }] }) }; };
      const rr = await A._sendOrderToDelivery(0, "wecan"); out.so = { rr, posts, saved, toast: toasts.join("|"), warn: AdminPreSend.info(A.orders[0]).warn.join("|") }; window.toast = () => { }; }
    out.empty = await run("empty"); out.parcelsOnly = await run("parcelsOnly"); out.found = await run("found"); out.err = await run("err");
    { notices = []; A.orders = [mk("V1")]; A.orders[0].note = "🚚wecan:WS-ALY-V1"; A.renderShipped = () => { }; A.courierFetch = async req => /\/parcels\//.test(req.url) ? { ok: true, status: 200, text: JSON.stringify({ last_status: "En préparation" }) } : { ok: true, status: 200, text: JSON.stringify({ data: [] }) }; await A.coOne("wecan", "WS-ALY-V1", "status"); out.coOne = notices[0] || ""; }
    return out; });
  ok("غير موجود عند WeCan: لا يُسجَّل التتبع ويظهر إشعار دائم", R.empty.saved === 0 && R.empty.r !== true && /لم يظهر الطلب/.test(R.empty.nt), R.empty);
  ok("في الطرود (En préparation) وغير ظاهر في قائمة الطلبات: لم يصل، لا يُسجَّل", R.parcelsOnly.saved === 0 && /لم يظهر الطلب/.test(R.parcelsOnly.nt), R.parcelsOnly);
  ok("موجود عندها: يُسجَّل", R.found.saved === 1 && R.found.r === true, R.found);
  ok("تعذّر الجزم (خطأ 500): لا نمنع ويُسجَّل", R.err.saved === 1, R.err);
  ok("قراءة الحالة: تُظهر En préparation لكن تنبّه أن الطلب لم يصل إن غاب عن قائمة الطلبات", /لم يصل/.test(R.coOne) && /غير ظاهر/.test(R.coOne), R.coOne);
  ok("ناقل WeCanServices: يُرسَل ويُسجَّل إن ظهر عندهم، مع تذكير بتحديد الناقل يدوياً وتحذير في القائمة", R.so.rr === true && R.so.posts === 1 && R.so.saved === 1 && /حدّد الناقل WeCanServices يدوياً/.test(R.so.toast) && /WeCanServices/.test(R.so.warn), R.so);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
