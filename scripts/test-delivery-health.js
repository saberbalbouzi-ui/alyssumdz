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
    const e1 = H.explain(8, "home", ""); out.e1 = { final: e1.final, txt: e1.lines.map(l => l.t + ":" + l.v).join(" || ") };
    const e2 = H.explain(8, "home", "zones"); out.e2 = { final: e2.final };
    /* 4) تجاهل الفرق ثم الاعتماد */
    H.ignore("wecan"); out.afterIgnore = H.rows().find(r => r.key === "wecan").issues.some(i => i.act === "approve");
    A.deliveryCfg.wecan.driftIgnore = ""; H.approve("wecan"); const c2 = A.deliveryCfg.wecan; out.approved = { src: c2.priceSrc, p8: c2.prices[8], p16: c2.prices[16], drift: c2.drift.n };
    const e3 = H.explain(8, "stop", ""); out.e3 = { final: e3.final, txt: e3.lines.map(l => l.t + ":" + l.v).join(" || ") };
    out.r3 = H.rows().find(r => r.key === "wecan").level;
    /* 5) الفحص التلقائي: لا يجلب إن كان الفحص حديثاً، ويجلب إن مرّ أكثر من 7 أيام */
    A.deliveryCfg.wecan.optProbeAt = Date.now(); A.deliveryCfg.wecan.optProbeV = 2; calls = 0; const n1 = await H.autoCheck(); out.autoRecent = { ran: n1, calls };
    A.deliveryCfg.wecan.checkedAt = Date.now() - 9 * 86400000; calls = 0; const n2 = await H.autoCheck(); out.autoOld = { ran: n2, calls: calls > 0 };
    /* 6) فشل الجلب يظهر أحمر ويُحتسب في تنبيه الرئيسية */
    A.courierFetch = async () => ({ ok: false, status: 401, text: "" }); A.deliveryCfg.wecan.checkedAt = 0; await H.check("wecan");
    const r4 = H.rows().find(r => r.key === "wecan"); out.r4 = { level: r4.level, txt: r4.issues.map(i => i.t).join(" | ") }; out.att4 = H.attention();
    return out; });
  ok("قبل الفحص: فشل الجلب القديم يظهر أحمر بسببه الحقيقي والمصدر «جدولك المحفوظ»", S.r1.level === "bad" && /محجوب من المتصفح/.test(S.r1.txt) && S.r1.src === "جدولك المحفوظ", S.r1);
  ok("تُحتسب الشركة في تنبيه «يحتاج انتباهك»", S.att1 === 1, S.att1);
  ok("الفحص يجلب 58 ولاية ويحفظ أسعار الحساب الخام (بشار 900/650) دون تغيير المعروض (1000/800)", S.calls === 58 && S.api8.home === 900 && S.api8.stop === 650 && S.applied8.home === 1000 && S.applied8.stop === 800 && S.err === "", S);
  ok("الفرق مرصود ويُسمّي بشار بقيمتَيه، والإجراء «اعتماد»", S.drift >= 1 && S.first && S.first.id === 8 && S.first.cur[0] === 1000 && S.first.api[0] === 900 && S.r2.level === "warn" && /بشار|Béchar/.test(S.r2.txt) && /900/.test(S.r2.txt) && S.r2.acts.includes("approve"), [S.r2, S.first]);
  ok("«لماذا هذا السعر؟»: بشار منزل 1000 من جدولك المحفوظ مع ذكر سعر حسابك الخام 900؛ والمناطق 800", S.e1.final === 1000 && /جدولك المحفوظ/.test(S.e1.txt) && /900/.test(S.e1.txt) && S.e2.final === 800, [S.e1, S.e2]);
  ok("تجاهل الفرق يخفي إجراء الاعتماد", S.afterIgnore === false, S.afterIgnore);
  ok("الاعتماد: مصدر الأسعار api وبشار 900/650 والفرق صفر والصف سليم", S.approved.src === "api" && S.approved.p8.home === 900 && S.approved.p8.stop === 650 && S.approved.drift === 0 && S.r3 === "ok", [S.approved, S.r3]);
  ok("الشرح بعد الاعتماد: مكتب بشار 650 من حسابك", S.e3.final === 650 && /حسابك/.test(S.e3.txt), S.e3);
  ok("الفحص التلقائي: لا يجلب إن كان الفحص حديثاً", S.autoRecent.ran === 0 && S.autoRecent.calls === 0, S.autoRecent);
  ok("الفحص التلقائي: يجلب إن مرّ أكثر من 7 أيام", S.autoOld.ran === 1 && S.autoOld.calls === true, S.autoOld);
  ok("فشل جديد (401): الصف أحمر ويظهر سبب الفشل ويُنبَّه عليه", S.r4.level === "bad" && /فشل/.test(S.r4.txt) && S.att4 === 1, S.r4);
  const ui = await p.evaluate(() => { Admin.tab("delivery"); Admin.renderDelivery(); const box = document.getElementById("dlv-health"); return { has: !!box, txt: box ? box.innerText.slice(0, 400) : "", rows: box ? box.querySelectorAll(".dh-r").length : 0, why: !!(box && box.querySelector("#dh-w")) }; });
  ok("البطاقة تُرسم في قسم شركات التوصيل مع صف الشركة وأداة الشرح", ui.has && ui.rows === 1 && ui.why && /صحة التوصيل/.test(ui.txt), ui);
  const home = await p.evaluate(() => { try { AdminHome.render(); } catch (e) { } const h = document.getElementById("ahome"); return h ? /شركة توصيل تحتاج انتباهك/.test(h.innerText) : null; });
  ok("الرئيسية: بند «شركة توصيل تحتاج انتباهك» يظهر", home === true, home);
  const G = await p.evaluate(async () => {
    const A = Admin, H = AdminDelHealth, out = {}; A.DELIVERY_COMPANIES.wecan.feesGeneric = true;
    A.deliveryCfg.wecan = { enabled: true, isDefault: true, apiKey: "k", apiSecret: "s", prices: { 21: { home: 850, stop: 600 } }, priceBase: "21=850/600", drift: { n: 5, list: [{ id: 8, cur: [1000, 800], api: [900, 650] }] }, checkedAt: 0 };
    const r = H.rows().find(x => x.key === "wecan"); out.row = { level: r.level, generic: r.generic, canCheck: r.canCheck, acts: r.issues.map(i => i.act), kinds: r.issues.map(i => i.k) };
    let calls = 0; A.courierFetch = async () => { calls++; return { ok: true, status: 200, text: "{}" }; }; out.auto = await H.autoCheck(); out.autoCalls = calls;
    out.parse = H.parseGrid("21 650 450\nOuargla 900 650\nBéchar 1300/1100\nxx 5 9");
    A.publishShipCo = () => { }; A.saveDeliveryCfgToStorage = () => { }; A.renderDelivery = () => { };
    const im = H.importGrid("wecan", "21 650 450\n30 900 650"); const c = A.deliveryCfg.wecan; out.im = { n: im.n, fix: c.priceFix, p21: c.prices[21], p30: c.prices[30] };
    A.DELIVERY_COMPANIES.wecan.feesGeneric = true; Admin.tab("delivery"); document.getElementById("dlv-health") && 0; H.render(); out.ta = !!document.getElementById("dh-g-wecan");
    return out; });
  ok("WeCan (تعريفة عامة): الصف سليم رغم وجود «فرق» قديم، مع تنبيه معلوماتي وإجراء الاستيراد", G.row.level === "ok" && G.row.generic && !G.row.canCheck && G.row.acts.includes("grid") && G.row.kinds.every(k => k === "info"), G.row);
  ok("الفحص التلقائي لا يجلب أسعار شركة تعريفتها عامة", G.auto === 0 && G.autoCalls === 0, [G.auto, G.autoCalls]);
  ok("تحليل الجدول الملصوق: رقم الولاية أو اسمها، وصيغة 1300/1100، ويتجاهل المرفوض", G.parse[21] && G.parse[21].h === 650 && G.parse[21].s === 450 && G.parse[30] && G.parse[30].h === 900 && G.parse[30].s === 650 && G.parse[8] && G.parse[8].h === 1300 && G.parse[8].s === 1100 && !G.parse[0], G.parse);
  ok("الاستيراد: يحفظ ولايتين في priceFix ويصيران سعر المتجر (21 ⟵ 650/450)", G.im.n === 2 && G.im.p21.home === 650 && G.im.p21.stop === 450 && G.im.p30.stop === 650 && /21=650\/450/.test(G.im.fix), G.im);
  ok("خانة لصق الجدول تظهر لشركة تعريفتها عامة", G.ta, G.ta);
  const I = await p.evaluate(async () => {
    const A = Admin, H = AdminDelHealth, out = {}; A.DELIVERY_COMPANIES.wecan.feesGeneric = true; A.publishShipCo = () => { }; A.saveDeliveryCfgToStorage = () => { }; A.renderDelivery = () => { }; window.toast = () => { };
    A.deliveryCfg.wecan = { enabled: true, isDefault: true, apiKey: "k", apiSecret: "s", prices: { 21: { home: 850, stop: 600 }, 8: { home: 1000, stop: 800 } }, priceBase: "21=850/600, 8=1000/800" };
    const mk = (id, wil, dt) => ({ id, date: new Date().toISOString(), name: "x", phone: "0550000000", wilaya: wil, commune: "c", dtype: dt, items: "p", subtotal: 3000, fee: 0, total: 3000, extra: {}, status: "livree", note: "" });
    A.orders = [mk("A1", "Skikda", "home"), mk("A2", "Skikda", "home"), mk("A3", "Skikda", "home"), mk("B1", "Béchar", "home"), mk("B2", "Béchar", "home"), mk("C1", "Skikda", "stop"), mk("D1", "Skikda", "home")];
    A.orderCoKey = () => "wecan"; A.shipRaw = {};
    const fin = (fee, free) => ({ fee, price: 3000, tp: 0, tr: 0, free: !!free });
    A.shipRaw.A1 = { raw: "delivered", fin: fin(650) }; A.shipRaw.A2 = { raw: "Livré", fin: fin(650) }; A.shipRaw.A3 = { raw: "delivered", fin: fin(650) };
    A.shipRaw.B1 = { raw: "delivered", fin: fin(1000) }; A.shipRaw.B2 = { raw: "delivered", fin: fin(1000) };   /* مطابقان */
    A.shipRaw.C1 = { raw: "delivered", fin: fin(450) };      /* طرد واحد فقط */
    A.shipRaw.D1 = { raw: "partially_returned", fin: fin(970) };
    const iv = H.invoice("wecan"); out.iv = iv;
    const r = H.rows().find(x => x.key === "wecan"); out.row = { level: r.level, acts: r.issues.map(i => i.act), txt: r.issues.map(i => i.t).join(" | ") };
    const n = H.applyInvoice("wecan"), c = A.deliveryCfg.wecan; out.ap = { n, fix: c.priceFix, p21: c.prices[21], p8: c.prices[8] };
    out.after = H.invoice("wecan").length; out.rowAfter = H.rows().find(x => x.key === "wecan").level;
    A.shipRaw.A1.fin = fin(700); A.shipRaw.A2.fin = fin(700); A.shipRaw.A3.fin = fin(700); const iv2 = H.invoice("wecan").length; H.ignoreInvoice("wecan"); out.ign = { iv2, acts: H.rows().find(x => x.key === "wecan").issues.map(i => i.act) };
    return out; });
  ok("فواتير WeCan: سكيكدة منزل 650 مقابل جدولك 850 في 3 طرود تُرصد فقط (بشار مطابقة، طرد مكتب واحد وجزئي مستبعدان)", I.iv.length === 1 && I.iv[0].id === 21 && I.iv[0].type === "home" && I.iv[0].exp === 850 && I.iv[0].real === 650 && I.iv[0].n === 3, I.iv);
  ok("الصف ينبّه «يحتاج انتباهاً» بنص الفرق وإجراء الفاتورة، والرسالة بلا ذكر API", I.row.level === "warn" && I.row.acts.includes("invoice") && /سكيكدة|Skikda/.test(I.row.txt) && /850/.test(I.row.txt) && /650/.test(I.row.txt) && !/API/.test(I.row.txt), I.row);
  ok("اعتماد أسعار الفواتير: سكيكدة منزل 650 ويبقى المكتب 600، وبقية الجدول كما هي، ولا فروق بعدها", I.ap.n === 1 && I.ap.p21.home === 650 && I.ap.p21.stop === 600 && I.ap.p8.home === 1000 && I.after === 0 && I.rowAfter === "ok", I.ap);
  ok("تجاهل الفرق يخفي التنبيه ويعود إن تغيّر الرسم", I.ign.iv2 === 1 && !I.ign.acts.includes("invoice"), I.ign);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
