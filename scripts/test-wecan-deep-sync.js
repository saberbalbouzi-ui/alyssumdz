/* مزامنة حالات WeCan: طرد أقدم من أول 300 طلب يُكمَّل جلبه من الصفحات التالية فلا يبقى «En préparation»، والكشف المستورد يسبق. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_lang"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; const A = Admin;
    A.deliveryCfg = Object.assign({}, A.deliveryCfg, { wecan: { enabled: true, apiKey: "k", apiSecret: "s" } });
    const mk = (id, trk) => ({ id, date: new Date().toISOString(), name: "ز" + id, phone: "0550000" + id.slice(-3), wilaya: "Alger", commune: "x", dtype: "home", items: "x ×1 = 1 DA", total: 1000, status: "expediee", note: "🚚wecan:" + trk });
    A.orders = [mk("O1", "WCNEW1"), mk("O2", "WCOLD1"), mk("O3", "WCSTM1")]; A.shipRaw = {}; A._stDeep = {};
    const pages = []; A.courierFetch = async req => {
      const u = String(req.url);
      if (/\/orders\?/.test(u)) { const pg = Number((u.match(/number%5D=(\d+)/) || [])[1] || 1); pages.push(pg); const arr = Array.from({ length: 100 }, (_, i) => ({ attributes: { tracking_number: "FILL" + pg + "_" + i, status: "Livré" } }));
        if (pg === 1) arr[0] = { attributes: { tracking_number: "WCNEW1", status: "Sorti en livraison" } }; if (pg === 5) arr[3] = { attributes: { tracking_number: "WCOLD1", status: "Livré" } }; return { ok: true, status: 200, text: JSON.stringify({ data: arr }) }; }
      return { ok: true, status: 200, text: JSON.stringify([{ tracking: (u.match(/parcels\/([^/?]+)/) || [])[1] || "", last_status: "En préparation", status: "En préparation" }]) }; };
    A.ydActual = { WCSTM1: { st: "Livré", price: 1000, net: 800, co: "wecan", sid: "x" } };
    await A.syncShipping({ silent: true }); await new Promise(r => setTimeout(r, 500));
    return { pages: [...new Set(pages)].sort((a, b) => a - b), raw: { O1: (A.shipRaw.O1 || {}).raw, O2: (A.shipRaw.O2 || {}).raw, O3: (A.shipRaw.O3 || {}).raw } }; });
  t("الصفحات تُكمَّل بعد الثالثة حتى يوجد الطرد القديم (5 صفحات)", R.pages.length >= 5 && R.pages[R.pages.length - 1] <= 6, R);
  t("الطرد الأقدم من 300 طلب يأخذ حالة القائمة «Livré» لا «En préparation»", /Livr/i.test(R.raw.O2 || ""), R);
  t("الطرد الحديث «Sorti en livraison» من قائمة الشركة", /Sorti/i.test(R.raw.O1 || ""), R);
  t("طرد غير موجود في القائمة لكنه في الكشف المستورد (Livré) يأخذ حالة الكشف", /Livr/i.test(R.raw.O3 || ""), R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
