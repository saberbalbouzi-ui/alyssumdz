/* WeCan: حالة الطلب تُؤخذ من قائمة /orders (كما في لوحتهم) إن كانت أبعد من حالة /parcels القديمة. NODE_PATH=/opt/node-tools/node_modules node scripts/test-wecan-sync.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin; window.toast = () => { }; A.renderOrders = () => { }; A.renderShipped = () => { }; A.renderStats = () => { }; A.onStatusChange = (i, m) => { A.orders[i].status = m; }; API.updateOrder = () => { }; A.deliveryCfg = { wecan: { enabled: true, apiKey: "k", apiSecret: "s" } };
    const mk = (id, st, trk) => ({ id, date: new Date().toISOString(), name: "ز", phone: "0550000000", wilaya: "Béchar", commune: "Béchar", dtype: "home", items: "م ×1 = 2200 DA", subtotal: 2200, fee: 800, total: 3000, extra: {}, status: st, note: "🚚wecan:" + trk });
    A.orders = [mk("A1", "expediee", "WS-A1"), mk("A2", "expediee", "WS-A2"), mk("A3", "confirmee", "WS-A3"), mk("A4", "expediee", "WS-A4")];
    const parcels = { "WS-A1": "Expédié", "WS-A2": "Expédié", "WS-A3": "En préparation", "WS-A4": "Livré" };
    const list = [{ tracking_number: "WS-A1", fulfillment_status: "delivered", status: "completed", confirmation_status: "confirmed" }, { tracking_number: "WS-A2", fulfillment_status: "returned_to_sender", status: "returned", confirmation_status: "confirmed" }, { tracking_number: "WS-A3", fulfillment_status: "shipped", status: "processing", confirmation_status: "confirmed" }, { tracking_number: "WS-A4", fulfillment_status: "processing", status: "open", confirmation_status: "confirmed" }];
    const urls = []; A.courierFetch = async req => { urls.push(req.url); const m = /\/parcels\/([A-Z0-9-]+)/.exec(req.url); if(m) return { ok: true, status: 200, text: JSON.stringify({ tracking: m[1], last_status: parcels[m[1]] }) }; if(/\/orders\?/.test(req.url)) return { ok: true, status: 200, text: JSON.stringify({ data: list.map((a, i) => ({ id: "u" + i, attributes: a })) }) }; return { ok: false, status: 404, text: "{}" }; };
    await A.syncShipping({ bg: true });
    return { st: A.orders.map(o => o.id + ":" + o.status).join("|"), orders: urls.filter(u => /\/orders\?/.test(u)).length, raw: A.orders.map(o => (A.shipRaw[o.id] || {}).raw).join("|") };
  });
  t("حالة لوحتهم (/orders) تسبق /parcels القديمة: A1 مسلَّم بدل «Expédié»، A2 مرتجع، A3 مُرسَل بدل «En préparation»", /A1:livree/.test(R.st) && /A2:echec/.test(R.st) && /A3:expediee/.test(R.st), R);
  t("لا تُرجع حالة متقدّمة إلى الوراء: A4 «Livré» في الطرود يبقى مسلَّماً ولو قالت القائمة «processing»", /A4:livree/.test(R.st), R);
  t("قائمة الحالات تُجلب مرة واحدة لكل المزامنة لا لكل طلب", R.orders === 1, R);
  t("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  await b.close(); process.exit(bad ? 1 : 0);
})();
