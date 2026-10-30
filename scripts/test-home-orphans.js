/* تنبيه الرئيسية: طرود بلا طلب. NODE_PATH=/opt/node-tools/node_modules node scripts/test-home-orphans.js */
const { chromium } = require("playwright"); let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const d = new Date().toISOString().slice(0, 10) + " 10:00:00", old = "2020-01-01 10:00:00", save = AdminYd.S.rows, so = Admin.orders;
    Admin.orders = [{ id: "o1", status: "confirmee", note: "🚚yalidine:yal-A", name: "x", phone: "0555000000" }];
    AdminYd.S.rows = []; const empty = AdminYd.orphans().length;
    AdminYd.S.rows = [{ tracking: "yal-A", status: "En préparation", date: d }, { tracking: "yal-B", status: "En préparation", date: d }, { tracking: "yal-C", status: "Retourné au vendeur", date: d }, { tracking: "yal-D", status: "Livré", date: old }];
    const o = AdminYd.orphans().map(x => x.tracking); AdminYd.showOrphans(); const f = AdminYd.S.link;
    AdminYd.S.link = ""; AdminYd.S.rows = save; Admin.orders = so; return { empty, o, f };
  });
  t("بلا قائمة: صفر", r.empty === 0, r);
  t("يظهر الطرد اليتيم فقط", JSON.stringify(r.o) === '["yal-B"]', r);
  t("الزر يصفّي على غير المرتبط", r.f === "no", r);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
