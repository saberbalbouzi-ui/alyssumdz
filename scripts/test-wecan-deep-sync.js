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
    A.orders = [mk("O1", "WCNEW1"), mk("O2", "WCOLD1"), mk("O3", "WCSTM1"), mk("O5", "WCFINE"), Object.assign(mk("O6", "WS-ALY-wAobkUUh"), { date: new Date(Date.now() - 6 * 864e5).toISOString() }), Object.assign(mk("O4", "WCGHOST"), { date: new Date(Date.now() - 3 * 864e5).toISOString() })]; A.shipRaw = {}; A._stDeep = {};
    const pages = []; A.courierFetch = async req => {
      const u = String(req.url);
      if (/filter%5Bsearch%5D=/.test(u)) { const k = decodeURIComponent((u.match(/search%5D=([^&]+)/) || [])[1] || ""); return { ok: true, status: 200, text: JSON.stringify({ data: k === "WS-ALY-wAobkUUh" ? [{ attributes: { tracking_number: k, fulfillment_status: "delivered", status: "delivered", confirmation_status: "confirmed" } }] : [] }) }; }
      if (/\/orders\?/.test(u)) { const pg = Number((u.match(/number%5D=(\d+)/) || [])[1] || 1); pages.push(pg); const arr = Array.from({ length: pg >= 6 ? 40 : 100 }, (_, i) => ({ attributes: { tracking_number: "FILL" + pg + "_" + i, status: "Livré" } }));
        if (pg === 1) arr[0] = { attributes: { tracking_number: "WCNEW1", status: "Sorti en livraison" } }; if (pg === 5) arr[3] = { attributes: { tracking_number: "WCOLD1", status: "Livré" } }; return { ok: true, status: 200, text: JSON.stringify({ data: arr }) }; }
      const trk = (u.match(/parcels\/([^/?]+)/) || [])[1] || ""; if (trk === "WCFINE") return { ok: true, status: 200, text: JSON.stringify([{ tracking: trk, last_status: "Expédié", history: [{ status: "Expédié", date: "2026-11-20 10:00" }, { status: "Sorti en livraison", date: "2026-11-22 09:00" }, { status: "Centre", date: "2026-11-21 08:00" }] }]) };
      return { ok: true, status: 200, text: JSON.stringify([{ tracking: trk, last_status: "En préparation", status: "En préparation" }]) }; };
    A.ydActual = { WCSTM1: { st: "Livré", price: 1000, net: 800, co: "wecan", sid: "x" } };
    await A.syncShipping({ silent: true }); await new Promise(r => setTimeout(r, 500));
    return { gone: (A._shipSync && A._shipSync.gone) || [], pages: [...new Set(pages)].sort((a, b) => a - b), raw: { O6: (A.shipRaw.O6 || {}).raw, O5: (A.shipRaw.O5 || {}).raw, O1: (A.shipRaw.O1 || {}).raw, O2: (A.shipRaw.O2 || {}).raw, O3: (A.shipRaw.O3 || {}).raw } }; });
  t("الصفحات تُكمَّل بعد الثالثة حتى يوجد الطرد القديم (5 صفحات)", R.pages.length >= 5 && R.pages[R.pages.length - 1] <= 6, R);
  t("الطرد الأقدم من 300 طلب يأخذ حالة القائمة «Livré» لا «En préparation»", /Livr/i.test(R.raw.O2 || ""), R);
  t("الطرد الحديث «Sorti en livraison» من قائمة الشركة", /Sorti/i.test(R.raw.O1 || ""), R);
  t("طرد غير موجود في القائمة لكنه في الكشف المستورد (Livré) يأخذ حالة الكشف", /Livr/i.test(R.raw.O3 || ""), R);
  t("طرد قديم «En préparation» غير موجود في قائمة WeCan كاملة ولا في كشف: يُعلَّم «غير موجود عند الشركة» (O4 فقط)", R.gone.includes("O4") && !R.gone.includes("O1") && !R.gone.includes("O2") && !R.gone.includes("O3"), R);
  t("الحالة التفصيلية كما عند الشركة: آخر حدث في سجلّ الطرد (Sorti en livraison) لا «Expédié» العامة", /Sorti en livraison/.test(R.raw.O5 || ""), R);
  const CH = await p.evaluate(() => { const h = document.createElement("div"); document.body.appendChild(h); const co = Admin.allDeliveryCompanies().wecan; AdminCoP.draw(h, { key: "wecan_test", title: "x", rows: ["Livré", "Livré", "Sorti en livraison", "Centre", "Retourné au vendeur", "Centre"].map((s, i) => ({ tracking: "T" + i, status: s })), order: co.FINE }); return [...h.querySelectorAll(".cop-chips .cop-chip")].map(x => x.innerText.replace(/\s+/g, " ").trim()); });
  t("شرائح الحالات بترتيب WeCan (Centre قبل Sorti en livraison قبل Livré قبل Retourné au vendeur) وبعدّها", JSON.stringify(CH.slice(1)) === JSON.stringify(["Centre 2", "Sorti en livraison 1", "Livré 2", "Retourné au vendeur 1"]), CH);
  const CP = await p.evaluate(async () => { const msgs = []; window.toast = m => msgs.push(String(m)); const h = document.createElement("div"); document.body.appendChild(h); AdminCoP.draw(h, { key: "wecan_cp", title: "x", rows: [{ tracking: "WS-ALY-bCIZpR0c", status: "Livré", client: "ز" }] });
    const b = h.querySelector("td[data-l='التتبع'] .cp-btn"); if (!b) return { nobtn: true }; b.click(); await new Promise(r => setTimeout(r, 400)); const co = Admin.allDeliveryCompanies().wecan; return { copy: b.getAttribute("data-copy"), msg: msgs.join("|"), re: co.mapStatus("Retour entrepôt"), fine: co.FINE.includes("Retour entrepôt") }; });
  t("زرّ نسخ بجانب رقم التتبع في جدول الطرود ويُظهر تأكيد النسخ", CP.copy === "WS-ALY-bCIZpR0c" && /WS-ALY-bCIZpR0c/.test(CP.msg || ""), CP);
  t("«Retour entrepôt» حالة معروفة عند WeCan وتُعدّ مرتجعاً", CP.fine && CP.re === "echec", CP);
  t("WS-ALY-wAobkUUh موجود عند الشركة ومسلَّم: يصير Livré ولا يُعلَّم غير موجود، وغيره غير الموجود يُعلَّم", /Livr/.test(R.raw.O6 || "") && !R.gone.includes("O6") && R.gone.includes("O4"), R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
