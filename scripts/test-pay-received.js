/* «المبالغ المستلمة» لا تشمل المسلَّم تلقائياً من الشركة: يظهر «سُلِّمت ولم تُقبض بعد». NODE_PATH=/opt/node-tools/node_modules node scripts/test-pay-received.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 900, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(() => {
    const P = AdminPayments, mk = (id, st, tot, note) => ({ id, date: new Date().toISOString(), name: "n" + id, phone: "0550000000", status: st, total: tot, items: "x", note: note || "🚚yalidine:yal-" + id });
    Admin.orders = [mk("D1", "livree", 1000), mk("D2", "livree", 2000), mk("D3", "livree", 500)];
    P.S.byOrder = { D3: { status: "paid", amount: 500, method: "cash", date: "2026-11-01" } };
    const t = P.totals("all"); return { rec: t.received, due: t.due, n: t.nDue };
  });
  t("المستلم = ما سجّلتَه فقط (500)", R.rec === 500, R);
  t("المسلَّم تلقائياً بانتظار القبض (3000، طلبان)", R.due === 3000 && R.n === 2, R);
  await b.close(); process.exit(bad ? 1 : 0);
})();
