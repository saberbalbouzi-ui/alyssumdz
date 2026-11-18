/* «الاسم الظاهر على البوردرو» يصل الشركة عند الإرسال من المسار الرئيسي (طلب متجر/صفحة هبوط بعنوان المنتج الأصلي): python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-bord-send.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; A.showNotice = () => { }; A.saveTracking = () => { }; A.renderOrders = () => { }; A.setShipRaw = () => { };
    A.products = [{ slug: "tarkiz", title: "عسل التركيز و تنشيط الذاكرة", bord: "التركيز  و الذاكرة ألبسوم", bordNoQty: true, price: 1800 }, { slug: "other", title: "منتج آخر", bord: "اسم مخصص", price: 1000 }];
    A.deliveryCfg = { wecan: { enabled: true, isDefault: true, apiKey: "k", apiSecret: "s", prices: {}, legacy: "2" } };
    const mk = (id, items) => ({ id, date: new Date().toISOString(), name: "زبون", phone: "0550123456", wilaya: "Béjaïa", commune: "Béjaïa", dtype: "home", desk: "", items, subtotal: 3200, fee: 500, total: 3700, extra: {}, status: "confirmee", note: "" });
    A.orders = [mk("B1", "عسل التركيز و تنشيط الذاكرة ×3 = 3200 DA"), mk("B2", "منتج آخر ×2 = 2000 DA\nمنتج لا يملك اسماً ×1 = 500 DA")];
    const bodies = []; A.courierFetch = async req => { bodies.push(String(req.body || "")); return { ok: true, status: 200, text: JSON.stringify({ "B": { success: true, tracking: "WS-ALY-TEST1", order_id: "B", status: "En préparation" } }) }; };
    A.companyWilayas = async () => ({}); 
    await A._sendOrderToDelivery(0, "wecan"); await A._sendOrderToDelivery(1, "wecan");
    const get = b => { try { const j = JSON.parse(b); const o = Array.isArray(j) ? j[0] : j; return (o[Object.keys(o)[0]] && o[Object.keys(o)[0]].product_list !== undefined) ? o[Object.keys(o)[0]].product_list : (o.product_list || b); } catch (e) { return b; } };
    const pb = bodies.filter(x => /product_list/.test(x)); out.n = pb.length; out.p1 = pb[0] ? get(pb[0]) : ""; out.p2 = pb[1] ? get(pb[1]) : "";
    return out; });
  ok("طلب بعنوان المنتج الأصلي يصل WeCan بالاسم المخصص للبوردرو (بلا ×كمية لأن bordNoQty)", R.n >= 2 && /التركيز\s+و الذاكرة ألبسوم/.test(R.p1) && !/تنشيط/.test(R.p1), R);
  ok("منتج آخر: اسم البوردرو مع الكمية، والمنتج بلا اسم مخصص يبقى كما هو", /اسم مخصص ×2/.test(R.p2) && /منتج لا يملك اسماً ×1/.test(R.p2) && !/منتج آخر/.test(R.p2), R.p2);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
