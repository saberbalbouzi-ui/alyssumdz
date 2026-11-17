/* «صحة التوصيل»: الفحص والفرق والاعتماد والتجاهل والشرح والفحص التلقائي وتنبيه الرئيسية: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-delivery-health.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const S = await p.evaluate(async () => {
    const A = Admin, out = {}, H = AdminDelHealth;
    window.toast = () => { }; A.publishShipCo = () => { }; A.saveDeliveryCfgToStorage = () => { };
    A.fees = [{ id: 8, name: "Béchar", home: 800, stop: 600 }, { id: 16, name: "Alger", home: 400, stop: 300 }];
    A.DELIVERY_COMPANIES.wecan.feesGeneric = false; /* الاختبار يحاكي شركة أسعارها من الـAPI معتمدة */
    A.deliveryCfg = { wecan: { enabled: true, isDefault: true, apiKey: "k", apiSecret: "s", prices: { 8: { home: 1000, stop: 800 }, 16: { home: 540, stop: 400 } }, priceBase: "8=1000/800, 16=540/400", pricesSrc: "api", pricesErr: "CORS_BLOCKED", checkedAt: Date.now() - 20 * 86400000 } };
    /* 1) صف الصحة قبل الفحص: فشل جلب + قِدَم */
    const r1 = H.rows().find(r => r.key === "wecan"); out.r1 = { level: r1.level, n: r1.issues.length, txt: r1.issues.map(i => i.t).join(" | "), src: r1.src };
    out.att1 = H.attention();
    /* 2) فحص ناجح بأسعار حساب مختلفة (بشار 900/650، الجزائر 540/400) عبر وسيط مُحاكى */
    let calls = 0; A.courierFetch = async (req) => { calls++; const m = /to_wilaya_id=(\d+)/.exec(req.url), id = m ? +m[1] : 1; const h = id === 8 ? 900 : id === 16 ? 540 : 700, d = id === 8 ? 650 : id === 16 ? 400 : 500; return { ok: true, status: 200, text: JSON.stringify({ to_wilaya_id: id, per_commune: { 1: { commune_name: "x", express_home: h, express_desk: d } } }) }; };
    await H.check("wecan"); const c = A.deliveryCfg.wecan;
    out.calls = calls; out.api8 = c.apiPrices && c.apiPrices[8]; out.applied8 = c.prices[8]; out.drift = c.drift && c.drift.n; out.err = c.pricesErr; out.first = c.drift && c.drift.list[0];
    const r2 = H.rows().find(r => r.key === "wecan"); out.r2 = { level: r2.level, txt: r2.issues.map(i => i.t).join(" | "), acts: r2.issues.map(i => i.act) };
    /* 3) الشرح قبل الاعتماد: بشار منزل = جدولك المحفوظ 1000، والخام 900 */
    /* 4) تجاهل الفرق ثم الاعتماد */
    H.ignore("wecan"); out.afterIgnore = H.rows().find(r => r.key === "wecan").issues.some(i => i.act === "approve");
    A.deliveryCfg.wecan.driftIgnore = ""; H.approve("wecan"); const c2 = A.deliveryCfg.wecan; out.approved = { src: c2.priceSrc, p8: c2.prices[8], p16: c2.prices[16], drift: c2.drift.n };
    out.r3 = H.rows().find(r => r.key === "wecan").level;
    /* 5) الفحص التلقائي: لا يجلب إن كان الفحص حديثاً، ويجلب إن مرّ أكثر من 7 أيام */
    A.deliveryCfg.wecan.optProbeAt = Date.now(); A.deliveryCfg.wecan.optProbeV = 2; A.deliveryCfg.wecan.soProbeAt = Date.now(); calls = 0; const n1 = await H.autoCheck(); out.autoRecent = { ran: n1, calls };
    A.deliveryCfg.wecan.checkedAt = Date.now() - 9 * 86400000; calls = 0; const n2 = await H.autoCheck(); out.autoOld = { ran: n2, calls: calls > 0 };
    /* 6) فشل الجلب يظهر أحمر ويُحتسب في تنبيه الرئيسية */
    A.courierFetch = async () => ({ ok: false, status: 401, text: "" }); A.deliveryCfg.wecan.checkedAt = 0; await H.check("wecan");
    const r4 = H.rows().find(r => r.key === "wecan"); out.r4 = { level: r4.level, txt: r4.issues.map(i => i.t).join(" | ") }; out.att4 = H.attention();
    return out; });
  ok("قبل الفحص: فشل الجلب القديم يظهر أحمر بسببه الحقيقي والمصدر «جدولك المحفوظ»", S.r1.level === "bad" && /محجوب من المتصفح/.test(S.r1.txt) && S.r1.src === "جدولك المحفوظ", S.r1);
  ok("تُحتسب الشركة في تنبيه «يحتاج انتباهك»", S.att1 === 1, S.att1);
  ok("الفحص يجلب 58 ولاية ويحفظ أسعار الحساب الخام (بشار 900/650) دون تغيير المعروض (1000/800)", S.calls === 58 && S.api8.home === 900 && S.api8.stop === 650 && S.applied8.home === 1000 && S.applied8.stop === 800 && S.err === "", S);
  ok("الفرق مرصود ويُسمّي بشار بقيمتَيه، والإجراء «اعتماد»", S.drift >= 1 && S.first && S.first.id === 8 && S.first.cur[0] === 1000 && S.first.api[0] === 900 && S.r2.level === "warn" && /بشار|Béchar/.test(S.r2.txt) && /900/.test(S.r2.txt) && S.r2.acts.includes("approve"), [S.r2, S.first]);
  ok("تجاهل الفرق يخفي إجراء الاعتماد", S.afterIgnore === false, S.afterIgnore);
  ok("الاعتماد: مصدر الأسعار api وبشار 900/650 والفرق صفر والصف سليم", S.approved.src === "api" && S.approved.p8.home === 900 && S.approved.p8.stop === 650 && S.approved.drift === 0 && S.r3 === "ok", [S.approved, S.r3]);
  ok("الفحص التلقائي: لا يجلب إن كان الفحص حديثاً", S.autoRecent.ran === 0 && S.autoRecent.calls === 0, S.autoRecent);
  ok("الفحص التلقائي: يجلب إن مرّ أكثر من 7 أيام", S.autoOld.ran === 1 && S.autoOld.calls === true, S.autoOld);
  ok("فشل جديد (401): الصف أحمر ويظهر سبب الفشل ويُنبَّه عليه", S.r4.level === "bad" && /فشل/.test(S.r4.txt) && S.att4 === 1, S.r4);
  const ui = await p.evaluate(() => { Admin.tab("delivery"); Admin.renderDelivery(); const box = document.getElementById("dlv-health"); return { has: !!box, txt: box ? box.innerText.slice(0, 400) : "", rows: box ? box.querySelectorAll(".dh-r").length : 0 }; });
  ok("البطاقة تُرسم في قسم شركات التوصيل مع صف الشركة", ui.has && ui.rows === 1 && /صحة التوصيل/.test(ui.txt), ui);
  const home = await p.evaluate(() => { try { AdminHome.render(); } catch (e) { } const h = document.getElementById("ahome"); return h ? /شركة توصيل تحتاج انتباهك/.test(h.innerText) : null; });
  ok("الرئيسية: بند «شركة توصيل تحتاج انتباهك» يظهر", home === true, home);
  const G = await p.evaluate(async () => {
    const A = Admin, H = AdminDelHealth, out = {}; A.DELIVERY_COMPANIES.wecan.feesGeneric = true;
    A.deliveryCfg.wecan = { enabled: true, isDefault: true, apiKey: "k", apiSecret: "s", prices: { 21: { home: 850, stop: 600 } }, soProbeAt: Date.now(), priceBase: "21=850/600", drift: { n: 5, list: [{ id: 8, cur: [1000, 800], api: [900, 650] }] }, checkedAt: 0 };
    const r = H.rows().find(x => x.key === "wecan"); out.row = { level: r.level, generic: r.generic, canCheck: r.canCheck, acts: r.issues.map(i => i.act), kinds: r.issues.map(i => i.k) };
    let calls = 0; A.courierFetch = async () => { calls++; return { ok: true, status: 200, text: "{}" }; }; out.auto = await H.autoCheck(); out.autoCalls = calls;
    A.publishShipCo = () => { }; A.saveDeliveryCfgToStorage = () => { }; A.renderDelivery = () => { };
    return out; });
  ok("WeCan (تعريفة عامة): الصف سليم رغم وجود «فرق» قديم ولا تنبيه ولا فحص", G.row.level === "ok" && G.row.generic && !G.row.canCheck && G.row.acts.length === 0, G.row);
  ok("الفحص التلقائي لا يجلب أسعار شركة تعريفتها عامة", G.auto === 0 && G.autoCalls === 0, [G.auto, G.autoCalls]);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
