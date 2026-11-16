/* مرتجع جزئي عند WeCan (partially_returned): يُحسب مسلَّماً ويطابق المدفوعات أرقام الشركة الفعلية: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-partial-return.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; A.renderOrders = () => { }; A.renderShipped = () => { }; A.renderStats = () => { }; A.onStatusChange = (i, m) => { A.orders[i].status = m; }; API.updateOrder = () => { }; A.deliveryCfg = { wecan: { enabled: true, apiKey: "k", apiSecret: "s" } };
    const mk = (id, st, trk) => ({ id, date: new Date().toISOString(), name: "ز", phone: "0550000000", wilaya: "Béchar", commune: "Béchar", dtype: "stop", items: "م ×1 = 2200 DA", subtotal: 2200, fee: 800, total: 3000, extra: {}, status: st, note: "🚚wecan:" + trk });
    const co = A.allDeliveryCompanies().wecan;
    out.map = { partial: co.mapStatus("partially_returned"), partial2: co.mapStatus("Partially Returned"), ret: co.mapStatus("returned_to_sender"), liv: co.mapStatus("delivered") };
    A.orders = [mk("P1", "echec", "WC-P1"), mk("R1", "expediee", "WC-R1"), mk("D1", "livree", "WC-D1")];
    A.shipRaw = { P1: { raw: "partially_returned", ts: Date.now() } };
    const parcels = { "WC-P1": { tracking: "WC-P1", last_status: "partially_returned", price: 1700, delivery_fee: 970, freeshipping: false, taxe_retour: 0 }, "WC-R1": { tracking: "WC-R1", last_status: "returned_to_sender", price: 2200, delivery_fee: 800 }, "WC-D1": { tracking: "WC-D1", last_status: "delivered", price: 1850, delivery_fee: 745 } };
    const asked = []; A.courierFetch = async (req) => { const m = /parcels\/([A-Z0-9-]+)/.exec(req.url); const k = m && m[1]; asked.push(k); return { ok: !!parcels[k], status: parcels[k] ? 200 : 404, text: JSON.stringify(parcels[k] || {}) }; };
    await A.syncShipping({ bg: true });
    out.asked = asked; out.p1 = { st: A.orders[0].status, fin: (A.shipRaw.P1 || {}).fin }; out.r1 = { st: A.orders[1].status }; out.d1 = { st: A.orders[2].status, fin: (A.shipRaw.D1 || {}).fin }; out.shipRawKeys = Object.keys(A.shipRaw);
    return out; });
  ok("تحويل الحالات: partially_returned (بأي شكل) ⟵ مسلَّم، وreturned_to_sender ⟵ فشل، وdelivered ⟵ مسلَّم", R.map.partial === "livree" && R.map.partial2 === "livree" && R.map.ret === "echec" && R.map.liv === "livree", R.map);
  ok("المزامنة تعيد فحص طلب «فشل» رقمه مرتجع جزئي وتحوّله إلى مسلَّم", R.asked.includes("WC-P1") && R.p1.st === "livree", [R.asked, R.p1]);
  ok("تُحفظ أرقام الطرد الفعلية (رسم التوصيل 970 وسعر المنتج المحصَّل 1700)", R.p1.fin && R.p1.fin.fee === 970 && R.p1.fin.price === 1700, R.p1);
  ok("المرتجع الكامل يبقى فشلاً", R.r1.st === "echec", R.r1);
  /* المدفوعات: المحصَّل = سعر المنتج + رسم التوصيل الفعلي (1700+970) والصافي بعد الرسم */
  const P = await p.evaluate(async () => { const A = Admin; if (typeof AdminPayments === "undefined") return null; try { await AdminPayments.load(); } catch (e) { } const L = AdminPayments.coNets ? AdminPayments.coNets() : null; return L ? L.find(g => g.k === "wecan") || null : null; });
  ok("المدفوعات: الطلب الجزئي محسوب مسلَّماً بمحصَّل 2670 (1700+970) وصافٍ 1700 مع المسلَّم القديم 2595/1850 ⟵ مجموع 5265 وصافٍ 3550 (بلا عمولة COD)", !!P && P.nDone === 2 && Math.round(P.got) === 5265 && Math.round(P.net) === 3550, P);
  ok("المسلَّم القديم بلا أرقام فعلية: تُعبَّأ (رسم 745 وسعر 1850) دون تغيير حالته", R.d1.st === "livree" && R.d1.fin && R.d1.fin.fee === 745 && R.d1.fin.price === 1850, R.d1);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
