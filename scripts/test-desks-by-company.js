/* مكاتب Stop Desk في نموذج الطلب: مكاتب شركة التوصيل الافتراضية فقط: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-desks-by-company.js */
const { chromium, devices } = require("playwright");
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  const errs = [];
  const run = async (dk, extra, other) => {
    const c = await b.newContext({ ...devices["iPhone 13"] }), p = await c.newPage(); p.on("pageerror", e => errs.push(String(e)));
    await p.route(/assets\/data\/checkout\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ steps: false, showOffers: true, phoneDz: true, guard: {} }) }));
    await p.route(/assets\/data\/ship-co\.json/, r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ def: "", dk, noStop: false, companies: { x: { name: "x", prices: {}, adj: 0 } }, sup: {}, cp: {}, nd: {} }) }));
    await p.route(/supabase\.co|script\.google\.com|\/functions\/v1\//, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.goto("http://localhost:8765/p/anti-acne/", { waitUntil: "load" }); await p.waitForTimeout(3000);
    await p.evaluate(() => { document.getElementById("acg-ov")?.remove(); });
    const r = await p.evaluate(async ([extra, other]) => {
      const w = WILAYAS.find(x => x.id === 8); if (extra) w.desks = w.desks.concat(extra); if (other) { const o = WILAYAS.find(x => x.id === 16); o.desks = (o.desks || []).concat([{ id: 7, name: "Wecan Alger", address: "x", commune: o.name, co: "wecan" }]); }
      const sel = document.getElementById("wilaya"); sel.value = "8"; sel.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 400));
      const st = document.querySelector('input[name="dtype"][value="stop"]'); const dis = st ? st.disabled : null; if (st && !st.disabled) { st.checked = true; st.dispatchEvent(new Event("change", { bubbles: true })); } await new Promise(r => setTimeout(r, 400));
      const ds = document.getElementById("desk"); return { dis, opts: ds ? [...ds.options].map(o => o.textContent).filter(t => !/اختر/.test(t)) : null }; }, [extra, !!other]);
    await c.close(); return r;
  };
  const W = [{ id: 1, name: "Agence Wecan Béchar", address: "x", commune: "Béchar", co: "wecan" }];
  const a = await run("", null), y = await run("yalidine", null), w0 = await run("wecan", null), w1 = await run("wecan", W), w2 = await run("yalidine", W), w3 = await run("wecan", null, true);
  ok("بلا شركة افتراضية معلنة (ship-co قديم): تبقى كل المكاتب كما كانت", a.opts && a.opts.length === 2, a);
  ok("الافتراضية ياليدين: مكتبا ياليدين فقط", y.opts && y.opts.length === 2 && y.opts.every(t => /\[(Yalidine|EasyAndSpeed)\]/.test(t)), y);
  ok("الافتراضية WeCan لم تُحمَّل مراكزها بعد في أي ولاية: احتياطاً تبقى كل المكاتب فلا يتعطّل الخيار", w0.opts && w0.opts.length === 2 && w0.dis === false, w0);
  ok("مراكز WeCan محمَّلة لولاية أخرى فقط: لا تُعرض مكاتب ياليدين في بشار (الخيار معطَّل)", w3.dis === true || (w3.opts && w3.opts.length === 0), w3);
  ok("الافتراضية WeCan مع مكتب WeCan موسوم: يظهر مكتبها فقط", w1.opts && w1.opts.length === 1 && /Wecan/.test(w1.opts[0]), w1);
  ok("الافتراضية ياليدين مع مكتب WeCan موسوم: لا يظهر مكتب WeCan", w2.opts && w2.opts.length === 2 && !w2.opts.some(t => /Wecan/.test(t)), w2);
  { const c = await b.newContext(), p = await c.newPage(); p.on("pageerror", e => errs.push(String(e)));
    await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
    await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
    await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
    const m = await p.evaluate(async () => { const A = Admin; A.fees = [{ id: 8, name: "Béchar", desks: [{ id: 1, name: "Agence A [Yalidine]", commune: "Béchar" }, { id: 2, name: "قديم مجهول", commune: "Béchar" }] }];
      A.deliveryCfg.wecan = Object.assign({}, A.deliveryCfg.wecan || {}, { enabled: true }); const co = A.allDeliveryCompanies().wecan; const c0 = A.companyCenters, r0 = A.renderFees, t0 = window.toast; A.renderFees = () => { }; window.toast = () => { };
      A.companyCenters = async () => [{ id: 9, wilaya_id: 8, name: "Wecan Béchar", address: "x", commune: "Béchar" }];
      await A.syncDesksFromCompany("wecan"); const d1 = A.fees[0].desks.map(d => d.name + "|" + (A.deskCoOf(d) || "-"));
      A.companyCenters = async () => [{ id: 10, wilaya_id: 8, name: "Wecan Béchar 2", address: "x", commune: "Béchar" }]; await A.syncDesksFromCompany("wecan"); const d2 = A.fees[0].desks.map(d => d.name);
      const ds = A.desksIn(A.fees[0], "Béchar", "wecan").map(d => d.name); A.companyCenters = c0; A.renderFees = r0; window.toast = t0; return { d1, d2, ds }; });
    ok("المزامنة: ياليدين الموسوم بالنمط يبقى، والمجهول القديم يُستبدل، ومراكز WeCan موسومة", JSON.stringify(m.d1) === JSON.stringify(["Agence A [Yalidine]|yalidine", "Wecan Béchar|wecan"]), m.d1);
    ok("إعادة مزامنة WeCan تستبدل مراكزها فقط ولا تتكرر", JSON.stringify(m.d2) === JSON.stringify(["Agence A [Yalidine]", "Wecan Béchar 2"]), m.d2);
    ok("قوائم اللوحة (desksIn) تفضّل مكاتب الشركة المطلوبة", JSON.stringify(m.ds) === JSON.stringify(["Wecan Béchar 2"]), m.ds); await c.close(); }
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
