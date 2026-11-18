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
  const S2 = await p.evaluate(() => {
    Admin.ydActual = { a1: { price: 2000, del: 600, cod: 15, ret: 0, ins: 0, net: 1385, ts: Date.parse("2026-11-18T10:00:00Z") }, a2: { price: 0, del: 0, cod: 0, ret: 250, ins: 0, net: -250, ts: Date.parse("2026-11-18T10:00:00Z") }, a3: { pend: "next", price: 1000, del: 500, cod: 7, ret: 0, ins: 0, net: 493, ts: Date.parse("2026-11-10T10:00:00Z") } };
    const d = document.createElement("div"); d.innerHTML = AdminPayments.stmtCard(); const tx = d.innerText || d.textContent; return { rows: d.querySelectorAll("tbody tr").length, paid: /مدفوع/.test(tx) && /2\s?000/.test(tx), next: /قادم/.test(tx), tot: /1\s?628/.test(tx) };
  });
  t("كشوف ياليدين المستوردة تظهر: صفّان + مجموع، والمدفوع والقادم، والصافي 1628", S2.rows === 3 && S2.paid && S2.next && S2.tot, S2);
  await b.close(); process.exit(bad ? 1 : 0);
})();
