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
  const Y = await p.evaluate(() => {
    const P = AdminPayments, mk = (id, st, tot, tk) => ({ id, date: new Date().toISOString(), name: "n" + id, phone: "0550000000", status: st, total: tot, items: "x", note: "🚚yalidine:" + tk });
    Admin.orders = [mk("Y1", "livree", 4000, "yal-A1"), mk("Y2", "livree", 6000, "yal-A2"), mk("Y3", "livree", 1000, "yal-A3")];
    P.S.byOrder = { Y1: { status: "paid", amount: 4000, method: "cod", date: "2026-11-01", manual: true } };      /* Y1 معلَّم يدوياً وموجود في الكشف: لا عدّ مزدوج */
    Admin.ydActual = { "yal-A1": { price: 4000, net: 3300, ts: 1 }, "yal-A2": { price: 6000, net: 5200, ts: 1 }, "yal-ZZ": { price: 3000, net: 2500, ts: 1 }, "yal-A3": { pend: "next", price: 1000, net: 800, ts: 1 } };
    const t = P.totals("all"); return { rec: t.received, due: t.due, nDue: t.nDue };
  });
  t("المستلم من ياليدين = صافي الكشوف المدفوعة (3300+5200+2500=11000) بلا عدّ مزدوج لـY1", Y.rec === 11000, Y);
  t("الداخل في كشف مدفوع لا يُعدّ «بانتظار القبض»؛ يبقى A3 (في كشف قادم) فقط", Y.due === 1000 && Y.nDue === 1, Y);
  const TP = await p.evaluate(() => {
    const P = AdminPayments, mk = (id, tk) => ({ id, date: new Date().toISOString(), name: "n" + id, phone: "0550000000", status: "livree", total: 1000, items: "x", note: "🚚yalidine:" + tk });
    Admin.orders = [mk("M1", "yal-M1"), mk("M2", "yal-M2")];
    P.S.byOrder = { M1: { status: "paid", amount: 1000, method: "cod", date: "2026-11-01", manual: true }, M2: { status: "paid", amount: 1000, method: "cod", date: "2026-11-01", manual: true } };
    Admin.ydActual = { "yal-M2": { price: 1000, net: 700, ts: 1 } };      /* M2 في كشف مدفوع: الكشف يلغي التعليم اليدوي؛ M1 مؤقت */
    const t = P.totals("all"); return { rec: t.received, temp: t.temp, nTemp: t.nTemp };
  });
  t("المعلَّم يدوياً وليس في كشف = مؤقت (1000)، والكشف يحلّ محلّ M2 (700): المستلم 1700", TP.temp === 1000 && TP.nTemp === 1 && TP.rec === 1700, TP);
  const S2 = await p.evaluate(() => {
    Admin.ydActual = { a1: { price: 2000, del: 600, cod: 15, ret: 0, ins: 0, net: 1385, ts: Date.parse("2026-11-18T10:00:00Z") }, a2: { price: 0, del: 0, cod: 0, ret: 250, ins: 0, net: -250, ts: Date.parse("2026-11-18T10:00:00Z") }, a3: { pend: "next", price: 1000, del: 500, cod: 7, ret: 0, ins: 0, net: 493, ts: Date.parse("2026-11-10T10:00:00Z") } };
    const d = document.createElement("div"); d.innerHTML = AdminPayments.stmtCard(); const tx = d.innerText || d.textContent; return { rows: d.querySelectorAll("tbody tr").length, paid: /مدفوع/.test(tx) && /2\s?000/.test(tx), next: /قادم/.test(tx), tot: /1\s?628/.test(tx) };
  });
  t("كشوف ياليدين المستوردة تظهر: صفّان + مجموع، والمدفوع والقادم، والصافي 1628", S2.rows === 3 && S2.paid && S2.next && S2.tot, S2);
  const TB = await p.evaluate(async () => {
    document.querySelectorAll("#payments-content").forEach(e => e.id = "old-pc"); const h = document.createElement("div"); h.id = "payments-content"; document.getElementById("app").appendChild(h);
    Admin.orders = [{ id: "T1", date: new Date().toISOString(), name: "n", phone: "0550000000", status: "livree", total: 1000, items: "x", note: "🚚yalidine:yal-T1" }]; await AdminPayments.render(); await new Promise(r => setTimeout(r, 300));
    const vis = () => [...h.querySelectorAll("[data-pmt]")].filter(d => !d.hidden).map(d => d.dataset.pmt).join(",");
    const o = { labels: [...h.querySelectorAll("[data-pmtab]")].map(b => b.dataset.pmtab).join(","), v0: vis() };
    h.querySelector('[data-pmtab="im"]').click(); o.v1 = vis(); h.querySelector('[data-pmtab="rec"]').click(); o.v2 = vis(); o.search = !!h.querySelector("#pm-search"); return o;
  });
  t("المدفوعات تبويبات: نظرة عامة/تسوية/كشوف/سجلات، تظهر واحدة في كل مرة", TB.labels === "ov,st,im,rec" && TB.v0 === "ov" && TB.v1 === "im" && TB.v2 === "rec" && TB.search, TB);
  const H = await p.evaluate(async () => {
    Admin.enabledCompanyKeys = () => ["yalidine", "wecan"]; Admin.allDeliveryCompanies = () => ({ yalidine: { name: "Yalidine" }, wecan: { name: "WeCan" } });
    AdminPayments.S.loaded = true; AdminPayments.coNets = () => [{ k: "wecan", net: 1000, got: 1200, nDone: 2, nRet: 0, nExp: 0, netExp: 0 }];
    document.getElementById("app").classList.remove("hidden"); AdminHome.render(); await new Promise(r => setTimeout(r, 300));
    const c = [...document.querySelectorAll("#ahome .ah-pc")].map(x => x.innerText.replace(/\s+/g, " ")); return c;
  });
  t("صافي الشركات يعرض الشركتين المفعّلتين: WeCan بمبلغ وياليدين «لا مستحقات»", H.length === 2 && H.some(x => /WeCan/.test(x) && /1\s?000/.test(x)) && H.some(x => /Yalidine/.test(x) && /لا مستحقات/.test(x)), H);
  await b.close(); process.exit(bad ? 1 : 0);
})();
