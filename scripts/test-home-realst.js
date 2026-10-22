/* «آخر الطلبات» في الرئيسية: طرد محذوف عند الشركة لا يظهر بحالته القديمة المحفوظة. NODE_PATH=/opt/node-tools/node_modules node scripts/test-home-realst.js */
const { chromium } = require("playwright"); let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const mk = (id, status, trk, date) => ({ id, status, date, note: "🚚yalidine:" + trk, total: 3800 });
    const saveRows = AdminYd.S.rows; AdminYd.S.rows = [{ tracking: "yal-A", status: "Livré", date: "2026-10-12 10:00:00" }, { tracking: "yal-B", status: "En préparation", date: "2026-10-19 10:00:00" }];
    Admin.shipRaw = Admin.shipRaw || {}; Admin.shipRaw["gone"] = { raw: "En préparation" };
    const out = {
      live: AdminHome.realSt(mk("x1", "confirmee", "yal-B", "2026-10-19 12:00:00")).t,
      gone: AdminHome.realSt(mk("gone", "confirmee", "yal-GONE", "2026-10-19 12:00:00")),
      old: AdminHome.realSt(mk("x3", "confirmee", "yal-OLD", "2026-10-01 12:00:00")).t,
      done: AdminHome.realSt(mk("x4", "livree", "yal-GONE2", "2026-10-19 12:00:00")).t
    };
    AdminYd.S.rows = []; out.empty = AdminHome.realSt(mk("gone", "confirmee", "yal-GONE", "2026-10-19 12:00:00")).t; AdminYd.S.rows = saveRows; return out;
  });
  t("طرد موجود: حالة الشركة", r.live === "En préparation", r);
  t("طرد محذوف: تنبيه أحمر لا الحالة القديمة", /غير موجود عند الشركة/.test(r.gone.t) && /f87171/i.test(r.gone.c), r);
  t("طلب أقدم من أقدم طرد مقروء: لا حكم", !/غير موجود/.test(r.old), r);
  t("المسلَّم محلياً لا يُعلَّم", !/غير موجود/.test(r.done), r);
  t("قائمة الشركة غير محمّلة: لا حكم", !/غير موجود/.test(r.empty), r);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
