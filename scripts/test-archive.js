/* الأرشيف + الفائدة المطلوبة لكل منتج. NODE_PATH=/opt/node-tools/node_modules node scripts/test-archive.js */
const { chromium } = require("playwright"); let ok = 0, bad = 0; const t = (n, c, x) => { if (c) ok++; else { bad++; console.log("✗", n, JSON.stringify(x)); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); await p.goto("http://localhost:8765/admin.html"); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const mk = (id, status, trk, date, note) => ({ id, status, date, total: 3000, name: "x", phone: "0555", note: (note || "") + (trk ? " 🚚yalidine:" + trk : "") });
    const L = [mk("1", "livree", "T1", "2026-09-01 10:00:00"), mk("2", "echec", "T2", "2026-09-02 10:00:00", "📦"), mk("3", "annulee", "", "2026-09-03 10:00:00"), mk("4", "confirmee", "T4", "2026-09-04 10:00:00"), mk("5", "echec", "T5", "2026-09-05 10:00:00")];
    const save = { o: Admin.orders, ay: AdminYd.S.rows };
    Admin.orders = L; const out = {};
    out.plan = AdminArchive.plan();
    AdminArchive.S.list.push({ id: "a1", name: "t", at: Date.now(), ids: ["1", "5"], trk: ["T1", "T5"], sum: {} }); AdminArchive.S.ids = new Set(["1", "5"]); AdminArchive.S.trk = new Set(["T1", "T5"]); AdminArchive.S.cut = Date.now();
    const live = AdminArchive.split(L); out.live = live.map(o => o.id); out.arch = Admin.archivedOrders.map(o => o.id);
    Admin.orders = live; out.all = AdminArchive.allOrders().length;
    out.h1 = AdminArchive.hiddenRow({ tracking: "T1", date: "2026-09-01" }); out.h2 = AdminArchive.hiddenRow({ tracking: "T4", date: "2026-09-04" }); out.h3 = AdminArchive.hiddenRow({ tracking: "ZZ", date: "2026-01-01" });
    AdminYd.set([{ tracking: "T1", status: "Livré", date: "2026-09-01" }, { tracking: "T4", status: "En préparation", date: "2026-09-04" }], 2, false); out.rows = AdminYd.S.rows.map(r => r.tracking);
    AdminArchive.S.list = []; AdminArchive.S.ids = new Set(); AdminArchive.S.trk = new Set(); AdminArchive.S.cut = 0; AdminYd.refilter(); out.rows2 = AdminYd.S.rows.length;
    Admin.fin = Admin.fin || {}; Admin.fin.set = Object.assign({}, Admin.fin.set || {}, { profMode: "pct", profVal: 30 }); Admin.fin.pw = {};
    out.w0 = Admin.profWant("a"); Admin.fin.pw.a = { mode: "val", val: 200 }; out.w1 = Admin.profWant("a"); out.w2 = Admin.profWant("b");
    Admin.orders = save.o; AdminYd.S.rows = save.ay; return out;
  });
  t("خطة الأرشفة: المسلَّم والملغى فقط، والمرتجع ذو المخزون المحسوم يبقى", r.plan.n === 3 && r.plan.livree === 1 && r.plan.annulee === 1 && r.plan.echec === 1, r.plan);
  t("الفصل بين الحيّ والمؤرشف", JSON.stringify(r.live) === '["2","3","4"]' && JSON.stringify(r.arch) === '["1","5"]' && r.all === 5, r);
  t("طرد مؤرشف مخفي والحيّ ظاهر", r.h1 === true && r.h2 === false && r.h3 === true, r);
  t("قائمة الطرود المرئية بلا المؤرشف", JSON.stringify(r.rows) === '["T4"]' && r.rows2 === 2, r);
  t("الفائدة لكل منتج: افتراضي ثم خاص", r.w0.own === false && r.w0.val === 30 && r.w1.mode === "val" && r.w1.val === 200 && r.w2.own === false, r);
  console.log(ok + " ✓ / " + bad + " ✗"); await b.close(); process.exit(bad ? 1 : 0);
})();
