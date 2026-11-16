/* خيارات الناقلين داخل شركة واحدة (ZR/WeCanServices): التحليل، الأرخص، الاكتشاف، بطاقات الطلب اليدوي: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-carrier-options.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 430, height: 1100 } }); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, H = AdminDelHealth, out = {}; window.toast = () => { }; A.publishShipCo = () => { }; A.saveDeliveryCfgToStorage = () => { };
    /* 1) تحليل النص اليدوي */
    const T = "30=ZR:900/650، WeCanServices:900/750 ؛ 8=ZR:900/650, WeCanServices:1300/1100 ؛ 99=x:1/2 ؛ 16=ZR:540";
    const po = A.parseOptions(T); out.po = { k: Object.keys(po).join(","), o30: po[30], o16: po[16] };
    out.min30 = A.cheapestOf(po[30]); out.min8 = A.cheapestOf(po[8]);
    /* 2) الأرخص يصير سعر المتجر؛ تعديلك اليدوي priceFix يفوز */
    const base = { 30: { home: 1000, stop: 800 }, 8: { home: 1000, stop: 800 }, 5: { home: 700, stop: 500 } }, cfg = { optionsFix: T, priceBase: "5=111/222" };
    const ap = A.applyPriceFix(base, cfg, "wecan"); out.ap = { p30: ap[30], p8: ap[8], p5: ap[5], p16: ap[16] };
    const ap2 = A.applyPriceFix(base, Object.assign({ priceFix: "30=777/555" }, cfg), "wecan"); out.apFix = ap2[30];
    /* 3) المستخرِج على بنى مختلفة */
    const ex = H.extractOptions;
    out.exA = ex({ to_wilaya_id: 30, per_commune: { 1: { commune_name: "a", express_home: 1300, express_desk: 1100, zr_home: 900, zr_desk: 650 }, 2: { commune_name: "b", express_home: 1300, express_desk: 1100, zr_home: 900, zr_desk: 650 } } });
    out.exB = ex({ data: [{ carrier: { name: "ZR" }, home_price: 900, desk_price: 650 }, { carrier_name: "WeCanServices", price_home: 900, price_desk: 750 }] });
    out.exC = ex({ options: { ZR: { home: 900, desk: 650 }, WeCanServices: { home: 900, desk: 750 } } });
    out.exD = ex({ rates: [{ name: "ZR", type: "home", price: 900 }, { name: "ZR", type: "stopdesk", price: 650 }] });
    out.exE = ex({ message: "route not found" });
    /* 4) الاكتشاف بوسيط مُحاكى: أول مسارين 404 ثم /shipping-options يرجع قائمة ناقلين؛ يملأ 58 ولاية ويحفظ تشخيصاً */
    A.deliveryCfg = { wecan: { enabled: true, isDefault: true, apiKey: "k", apiSecret: "s", prices: { 30: { home: 1000, stop: 800 } }, priceBase: "30=1000/800" } };
    const wc = A.allDeliveryCompanies().wecan; const calls = []; let saved = null; window.Priv = Object.assign({}, window.Priv || {}); const P0 = typeof Priv !== "undefined" ? Priv.set : null; try { Priv.set = async (k, v) => { saved = { k, v }; }; } catch (e) { }
    A.courierFetch = async (req) => { calls.push(req.url.replace(/^https?:\/\/[^/]+/, "")); const m = /to_wilaya_id=(\d+)/.exec(req.url), id = m ? +m[1] : 1;
      if (/\/shipping-options\?/.test(req.url)) return { ok: true, status: 200, text: JSON.stringify({ data: [{ carrier: "ZR", home: 900, desk: id === 30 ? 650 : 600 }, { carrier: "WeCanServices", home: id === 30 ? 900 : 1100, desk: id === 30 ? 750 : 800 }] }) };
      return { ok: false, status: 404, text: JSON.stringify({ message: "route not found" }) }; };
    const doc = await H.discover("wecan"); const c = A.deliveryCfg.wecan;
    out.disc = { first: calls[0], tried: doc && doc.results.length, found: doc && doc.found && doc.found.path, nOpt: Object.keys(c.options || {}).length, o30: c.options && c.options[30], p30: c.prices[30], p8: c.prices[8], savedKey: saved && saved.k, savedHasSample: !!(saved && saved.v && saved.v.results && saved.v.results[0].sample), noSecret: !JSON.stringify(saved || {}).includes("apiSecret") };
    out.row = (H.rows().find(r => r.key === "wecan") || {}).nO;
    out.expl = H.explain(30, "stop", "").lines.map(l => l.t + ":" + l.v).join(" || ");
    return out; });
  ok("تحليل نص الخيارات: ولايات 8 و16 و30 فقط (99 مرفوضة)، 30 فيها ناقلان", R.po.k.split(",").sort().join(",") === "16,30,8" && R.po.o30.length === 2 && R.po.o30[0].b === "ZR" && R.po.o30[0].h === 900 && R.po.o30[0].s === 650 && R.po.o16.length === 1, R.po);
  ok("الأرخص: الولاية 30 ⟵ منزل 900 ومكتب 650، وبشار ⟵ 900/650", R.min30.home === 900 && R.min30.stop === 650 && R.min8.home === 900 && R.min8.stop === 650, [R.min30, R.min8]);
  ok("سعر المتجر = الأرخص (30 ⟵ 900/650) ولا يمسّ ولايات بلا خيارات (5 ⟵ جدولك 111/222)", R.ap.p30.home === 900 && R.ap.p30.stop === 650 && R.ap.p8.stop === 650 && R.ap.p5.home === 111, R.ap);
  ok("تعديلك اليدوي priceFix يفوز على الأرخص (30 ⟵ 777/555)", R.apFix.home === 777 && R.apFix.stop === 555, R.apFix);
  ok("مستخرج: حقول <ناقل>_home/_desk داخل per_commune (express وzr)", R.exA.length === 2 && R.exA.some(o => o.b === "zr" && o.h === 900 && o.s === 650) && R.exA.some(o => o.b === "Express" && o.h === 1300 && o.s === 1100), R.exA);
  ok("مستخرج: مصفوفة ناقلين (carrier كائناً أو نصاً)", R.exB.length === 2 && R.exB.some(o => o.b === "ZR" && o.h === 900 && o.s === 650) && R.exB.some(o => o.b === "WeCanServices" && o.s === 750), R.exB);
  ok("مستخرج: خريطة ناقل ⟵ {home,desk}", R.exC.length === 2 && R.exC.some(o => o.b === "ZR" && o.s === 650), R.exC);
  ok("مستخرج: صفوف (name/type/price) تُجمَّع لكل ناقل", R.exD.length === 1 && R.exD[0].b === "ZR" && R.exD[0].h === 900 && R.exD[0].s === 650, R.exD);
  ok("ردّ بلا خيارات ⟵ لا شيء", R.exE.length === 0, R.exE);
  ok("الاكتشاف: يجرّب المسارات حتى يجد /shipping-options (404 قبلها) ويملأ 58 ولاية", R.disc.found === "/shipping-options" && R.disc.nOpt === 58 && R.disc.o30.length === 2, R.disc);
  ok("الاكتشاف: يعتمد الأرخص (30 ⟵ 900/650) في أسعار المتجر", R.disc.p30.home === 900 && R.disc.p30.stop === 650 && R.disc.p8.stop === 600, R.disc);
  ok("الاكتشاف: يحفظ تشخيصاً (عيّنات الردود) في التخزين الخاص بلا أي مفتاح", R.disc.savedKey === "delprobe" && R.disc.savedHasSample && R.disc.noSecret, R.disc);
  ok("صحة التوصيل تذكر عدد ولايات الخيارات، والشرح يعرض خيارات الناقلين والأرخص", R.row === 58 && /خيارات الناقلين/.test(R.expl) && /ZR 900\/650/.test(R.expl), [R.row, R.expl]);
  /* 5) الطلب اليدوي: بطاقات الخيارات */
  const M = await p.evaluate(async () => {
    const A = Admin; window.toast = () => { };
    const w30 = WILAYAS.find(x => x.id === 30); w30.desks = [{ id: 1, name: "Hub Ouargla 30", commune: w30.communes ? w30.communes[0] : "Ouargla", co: "wecan" }];
    A.deliveryCfg.wecan.options = { 30: [{ b: "ZR", h: 900, s: 650 }, { b: "WeCanServices", h: 900, s: 750 }] };
    const saved = []; API.addOrder = async o => { saved.push(o); return { ok: true, id: "M-OPT1" }; };
    ManualOrder.open({ mode: "new" }); await new Promise(r => setTimeout(r, 600));
    const bg = document.querySelector(".modal-bg.open") || document.body, q = s => bg.querySelector(s);
    const sel = q("#mo-wil"); sel.value = w30.name; sel.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 500));
    const cards = [...bg.querySelectorAll("#mo-opts [data-ob]")].map(x => x.innerText.replace(/\s+/g, " ").trim());
    const stopZR = bg.querySelector('#mo-opts [data-ob="ZR"][data-ok="stop"]'); if (stopZR) stopZR.click(); await new Promise(r => setTimeout(r, 300));
    const fee = q("#mo-fee").value, dtv = (bg.querySelector('input[name="mo-dt"]:checked') || {}).value;
    const home750 = bg.querySelector('#mo-opts [data-ob="WeCanServices"][data-ok="stop"]'); const brandBefore = bg._brand;
    return { n: cards.length, cards, fee, dtv, brandBefore, hasStop: !!stopZR, cheapTags: cards.filter(c => /الأرخص/.test(c)).length }; });
  ok("الطلب اليدوي: أربع بطاقات (منزل ومكتب لكل ناقل) والأرخص موسوم لكل نوع (3 وسوم: منزل لكلا الناقلين 900 + مكتب ZR)", M.n === 4 && M.cheapTags === 3, M);
  ok("النقر على «مكتب · ZR» يضبط نوع التوصيل مكتباً والرسم 650 ويسجّل الناقل", M.dtv === "stop" && Number(M.fee) === 650 && M.brandBefore === "ZR", M);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
