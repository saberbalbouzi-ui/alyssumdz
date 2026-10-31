/* «تعديل كامل» للطلب المرسَل (الطرد في التحضير): المخزون يتصحّح والطرد يُحدَّث. NODE_PATH=/opt/node-tools/node_modules node scripts/test-fulledit-sent.js */
const { chromium } = require("playwright"); let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const out = {}; Admin.products = [{ slug: "tst", title: "منتج اختبار", price: 1800, stock: 10, active: true, offers: [] }]; const pr = Admin.products[0]; Admin.queueStockPublish = () => {};
    const mk = (id, status, note) => ({ id, status, date: new Date().toISOString(), name: "زبون اختبار", phone: "0550123456", wilaya: "Alger", commune: "Alger Centre", dtype: "home", desk: "", items: pr.title + " ×1 = 1800", subtotal: 1800, fee: 600, total: 2400, discount: 0, extra: {}, note });
    const sentO = mk("T1", "confirmee", "🚚yalidine:yal-TST 📦"), newO = mk("T2", "nouvelle", ""), shipped = mk("T3", "confirmee", "🚚yalidine:yal-OUT 📦");
    Admin.orders.unshift(sentO, newO, shipped); window.__sent = sentO;
    AdminYd.S.rows = [{ tracking: "yal-TST", status: "En préparation" }, { tracking: "yal-OUT", status: "Vers Wilaya" }];
    out.canSent = Admin.canFullEdit(sentO); out.canNew = Admin.canFullEdit(newO); out.canOut = Admin.canFullEdit(shipped);
    out.canLiv = Admin.canFullEdit(Object.assign({}, sentO, { status: "livree" }));
    const calls = []; Admin.courierFetch = async rq => { calls.push(rq); return { ok: true, status: 200, text: "{}" }; };
    Admin.deliveryCfg.yalidine = Object.assign({}, Admin.deliveryCfg.yalidine, { enabled: true, apiId: "a", apiToken: "b" });
    Admin.normForCompany = async (co, cfg, o) => ({ ok: true, ord: o }); Admin.coOrderFor = async (co, cfg, o) => o; API.updateOrderFields = async () => true; API.updateOrder = async () => true;
    ManualOrder.open({ mode: "edit", order: sentO }); await new Promise(r => setTimeout(r, 400));
    const q = document.querySelector('#mo-lines input[data-f="qty"]'); out.hasForm = !!q; q.value = 3; q.dispatchEvent(new Event("input", { bubbles: true }));
    const stock0 = pr.stock; document.getElementById("mo-save").click(); await new Promise(r => setTimeout(r, 900));
    out.stock0 = stock0; out.stock1 = pr.stock; out.items = sentO.items; out.tagKept = /📦/.test(sentO.note);
    out.patch = calls.filter(c => c.method === "PATCH").map(c => JSON.parse(c.body));
    return out;
  });
  t("مرسَل في التحضير ← مسموح", r.canSent === true, r); t("جديد ← مسموح", r.canNew === true, r); t("طرد خرج من التحضير ← ممنوع", r.canOut === false, r); t("مسلَّم ← ممنوع", r.canLiv === false, r);
  t("النموذج يفتح لطلب مرسَل", r.hasForm, r);
  t("المخزون: القديم أُعيد والجديد خُصم (فرق −2)", r.stock1 === r.stock0 - 2, r);
  t("الوسم 📦 باقٍ", r.tagKept, r); t("نص المنتجات تغيّر", /×3/.test(r.items), r);
  t("PATCH للشركة فيه المنتجات والهاتف", r.patch.length >= 1 && "product_list" in r.patch[0] && "contact_phone" in r.patch[0], r);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
