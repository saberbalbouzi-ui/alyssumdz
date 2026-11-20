/* E-com Delivery (ecom-dz.com API v2): بناء الطلب (منزل/مكتب)، تحليل الردود، التعريفة، الحالات. NODE_PATH=/opt/node-tools/node_modules node scripts/test-ecom-delivery.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    const A = Admin, co = A.DELIVERY_COMPANIES.ecomdelivery, cfg = { apiKey: "K E Y", apiToken: "TOK" }, out = {};
    out.hdr = co.hdr(cfg);
    const home = { id: "M261119-3NYO0", name: "فاطمة بالخير", phone: "+213 555 12 34 56", wilaya: "Alger", commune: "Bab Ezzouar", dtype: "home", items: "عسل التركيز ×2 = 3600 DA\nزيت ×1 = 1000 DA", total: 4600, note: "📦 🚚wecan:X ملاحظة", extra: { "📞 هاتف 2": "0661234567" } };
    const r1 = co.buildRequest(cfg, home), b1 = JSON.parse(r1.body)[0]; out.home = { url: r1.url, method: r1.method, b1 };
    const orig = A.wCo; const sd = Object.assign({}, home, { dtype: "stop", desk: "Bab Ezzouar", commune: "Bab Ezzouar" });
    const f = async req => ({ ok: true, status: 200, text: JSON.stringify([{ id: 1, code_stopdesk: "16B", nom_bureau: "Bab Ezzouar", commune: "Bab Ezzouar" }, { id: 2, code_stopdesk: "16E", nom_bureau: "Centre", commune: "Alger Centre" }]) });
    const o2 = await co.prepare(cfg, sd, f), b2 = JSON.parse(co.buildRequest(cfg, o2).body)[0]; out.stop = { code: o2.__ecStop, b2 };
    out.sentOk = co.parseSent({ total: 1, crees: 1, resultats: [{ index: 0, ok: true, tracking: "ECBGB031" }] }); out.sentFail = co.parseSent({ total: 1, crees: 0, resultats: [{ index: 0, ok: false, erreur: "commune introuvable" }] });
    out.err1 = co.parseError({ resultats: [{ ok: false, erreur: "total minimum 400 DA", details: { total_minimum: 400 } }] }); out.err2 = co.parseError({ error: { code: "validation", message: "Données invalides", details: [{ champ: "0.id_wilaya", raison: "Input should be less than or equal to 58" }] } });
    out.fees = co.parseFees({ service: 35, emballage: 65, wilayas: [{ wilaya: 16, domicile: 450, stopdesk: 200 }, { wilaya: 1, domicile: 1100, stopdesk: 0 }] }).prices;
    out.wil = co.parseWilayas([{ id: 16, libelle: "Alger", domicile: true, stopdesk: true }])[16]; out.com = co.parseCommunes([{ commune: "Bab Ezzouar", livrable: true }, { commune: "X", livrable: false }]);
    out.st = ["Livrée", "Annuler x3", "Sortir en livraison", "En Préparation · En Préparation", "Ne Réponde pas #1", "Retourné"].map(x => co.mapStatus(x));
    out.ps = co.parseStatus({ situation: "EnCours", etat_logistique: "Au Bureau" }); out.lbl = co.labelRequest(cfg, "EC1").url; out.del = co.cancelRequest(cfg, "EC1").method;
    out.listed = Object.keys(A.allDeliveryCompanies()).includes("ecomdelivery");
    return out; });
  t("الترويسات: X-API-Key وX-API-Token بلا فراغات", R.hdr["X-API-Key"] === "KEY" && R.hdr["X-API-Token"] === "TOK", R.hdr);
  const h = R.home.b1;
  t("منزل: POST /colis بمصفوفة، هاتف مُطبَّع، هاتف 2، بلدية، كمية 3، مجموع 4600، id_externe، ولا وسوم في الملاحظة", /\/colis$/.test(R.home.url) && R.home.method === "POST" && h.mobile_1 === "0555123456" && h.mobile_2 === "0661234567" && h.commune === "Bab Ezzouar" && h.quantite === 3 && h.total === 4600 && h.stopdesk === 0 && h.confirmee === 0 && h.id_externe === "M261119-3NYO0" && !/🚚|📦/.test(h.note_fournisseur || "") && !("code_stopdesk" in h) && /عسل/.test(h.article) && !/DA/.test(h.article), R.home);
  t("مكتب: رمز المكتب من اسمه (16B) وstopdesk=1 بلا commune", R.stop.code === "16B" && R.stop.b2.stopdesk === 1 && R.stop.b2.code_stopdesk === "16B" && !("commune" in R.stop.b2), R.stop);
  t("الردّ: التتبع من resultats[0].ok؛ الفاشل بلا تتبع", R.sentOk === "ECBGB031" && R.sentFail === "", [R.sentOk, R.sentFail]);
  t("رسائل الخطأ: الحد الأدنى وحقول التحقق", /400/.test(R.err1) && /id_wilaya/.test(R.err2), [R.err1, R.err2]);
  t("التعريفة والولايات والبلديات", R.fees[16].home === 450 && R.fees[16].stop === 200 && R.fees[1].home === 1100 && R.wil.ok && R.com.names.length === 2 && R.com.nd.join() === "X", [R.fees, R.wil, R.com]);
  t("الحالات: مسلَّم/تعثّر/مُرسَل/مؤكَّد/تنبيه/مرتجع", R.st.join() === "livree,echec,expediee,confirmee,__alert,echec", R.st);
  const M2 = await p.evaluate(() => { const co = Admin.DELIVERY_COMPANIES.ecomdelivery, W = Admin._W && Admin._W(); const m = ["En Préparation", "Colis prêt à expédier", "Mes Colis · En livraison", "Retour prêt à récupérer", "Mes Retours", "Supprimée", "Colis Supprimés"].map(x => co.mapStatus(x)); return { m, ph: W ? [W.returnPhase("Retour prêt à récupérer"), W.returnPhase("Mes Retours")] : null }; });
  t("قائمة حالات E-com: En Préparation/prêt à expédier→مؤكَّد، في الطريق→مُرسَل، الرجوع→تعثّر، المحذوف→تنبيه؛ ومرحلة الإرجاع جاهز/في الطريق", M2.m.join() === "confirmee,confirmee,expediee,echec,echec,__alert,__alert" && (!M2.ph || M2.ph.join() === "ready,transit"), M2);
  const M3 = await p.evaluate(() => { const co = Admin.DELIVERY_COMPANIES.ecomdelivery; return { m: ["Attend Confirmation", "Commande Confirmée", "Commande Annuler", "Commande Reporté", "Commande a Relancé"].map(x => co.mapStatus(x)), ps: [co.parseStatus({ situation: "Commande Confirmée", etat_logistique: "En Préparation" }), co.parseStatus({ situation: "EnCours", etat_logistique: "En livraison" }), co.parseStatus({ situation: "Livrée" })] }; });
  t("وضعيات التأكيد (مرشّحهم): تُعرض كما هي في الحالة وتُترجم: انتظار/مؤكَّدة→مؤكَّد، ملغاة/مؤجّلة/إعادة اتصال→تنبيه", M3.m.join() === "confirmee,confirmee,__alert,__alert,__alert" && M3.ps.join() === "Commande Confirmée,En livraison,Livrée", M3);
  const LS = await p.evaluate(() => { const co = Admin.DELIVERY_COMPANIES.ecomdelivery, r = co.recentRequest({ apiKey: "k", apiToken: "t" }, 2), rows = co.parseOrdersList({ total: 2, items: [{ tracking: "EC309IAD", id_externe: "M261120-5LH2K", nom_complet: "نوال", mobile: "0556325698", commune: "Adrar", id_wilaya: 1, article: "التركيز", total: 3100, situation: "EnCours", etat_logistique: "En Préparation", date_creation: "2026-11-20 19:37:42+00:00" }, { tracking: "EC111AAA", id_externe: null, nom_complet: "علي", mobile: "0770000000", commune: "X", id_wilaya: 16, article: "a", total: 1000, situation: "Commande Confirmée" }] }); const A = Admin; A.orders = []; const im = A.importCompanyRows("ecomdelivery", rows); return { url: r.url, n: rows.length, ref: rows[0].reference, st: rows.map(x => x.status).join("|"), w: rows[0].wilaya, im }; });
  t("قائمة الحساب: GET /colis?page=2&limit=100، تحليل الصفوف (المرجع، الحالة، الولاية) وإضافة الطرود الخارجية", /\/colis\?page=2&limit=100$/.test(LS.url) && LS.n === 2 && LS.ref === "M261120-5LH2K" && LS.st === "En Préparation|Commande Confirmée" && LS.w === "Adrar" && LS.im.ext === 2, LS);
  const AL = await p.evaluate(() => { const A = Admin; localStorage.removeItem("alyssum_ext_parcels"); A.saveTracking = (o, k, t) => { o.note = (o.note || "") + " 🚚" + k + ":" + t; }; A.setShipRaw = () => {}; A.setShipRaw = () => {};
    A.orders = [{ id: "O1", phone: "0556 32 56 98", total: 3000, commune: "Adrar", status: "nouvelle" }, { id: "O2", phone: "0770000001", total: 1000, commune: "Alger", status: "confirmee" }, { id: "O3", phone: "0770000002", total: 900, commune: "Oran", status: "nouvelle" }, { id: "O4", phone: "0770000002", total: 900, commune: "Blida", status: "nouvelle" }, { id: "O5", phone: "0661000005", total: 500, commune: "Setif", status: "annulee" }];
    A.extSave("ecomdelivery", { tracking: "EC-OLD", phone: "0770000001", amount: 1200, commune: "X", raw: "Commande Confirmée", at: 1 });
    const im = A.importCompanyRows("ecomdelivery", [{ tracking: "EC-A", phone: "+213556325698", amount: 3100, commune: "Adrar", status: "En Préparation" }, { tracking: "EC-B", phone: "0770000002", amount: 5, commune: "Oran", status: "x" }, { tracking: "EC-C", phone: "0770000002", amount: 5, commune: "Autre", status: "x" }, { tracking: "EC-D", phone: "0661000005", amount: 500, commune: "Setif", status: "x" }, { tracking: "EC-E", phone: "0999999999", amount: 1, commune: "Y", status: "x" }]);
    return { im, notes: A.orders.map(o => o.id + ":" + (o.note || "")).join("|"), ext: (A.extAll().ecomdelivery || []).map(x => x.tracking).sort().join(",") }; });
  t("ربط تلقائي: هاتف مع فرق مبلغ التوصيل (O1)، وطرد خارجي قديم بهاتف وحيد (O2)، وهاتف متكرر يُفرَّق بالبلدية (O3) ثم يأخذ الباقي طلبه الوحيد (O4)، والملغى لا يُربط؛ والباقي يبقى «خارجياً»", /O1: 🚚ecomdelivery:EC-A/.test(AL.notes) && /O2: 🚚ecomdelivery:EC-OLD/.test(AL.notes) && /O3: 🚚ecomdelivery:EC-B/.test(AL.notes) && /O4: 🚚ecomdelivery:EC-C/.test(AL.notes) && !/O5: 🚚/.test(AL.notes) && AL.ext === "EC-D,EC-E" && AL.im.linked === 4, AL);
  const IM = await p.evaluate(async () => {
    const A = Admin, wait = ms => new Promise(r => setTimeout(r, ms)), toasts = []; window.toast = m => toasts.push(m); A.renderShipped = () => { };
    A.deliveryCfg = { ecomdelivery: { enabled: true, apiKey: "k", apiToken: "t" } }; A.orders = []; try { localStorage.removeItem("alyssum_ext_parcels"); } catch (e) { }
    let calls = 0; A.courierFetch = async req => { calls++; if (/page=1&/.test(req.url)) return { ok: true, status: 200, text: JSON.stringify({ items: [{ tracking: "EC777XYZ", id_externe: "", nom_complet: "كريم", mobile: "0661112233", commune: "Bab Ezzouar", id_wilaya: 16, article: "عسل", total: 2500, situation: "Commande Confirmée" }] }) }; return { ok: true, status: 200, text: JSON.stringify({ items: [] }) }; };
    const im = await A.coImport("ecomdelivery", true); const ext = (A.extAll().ecomdelivery || []).map(x => x.tracking + ":" + x.raw).join(); const again = await A.coImport("ecomdelivery", false);
    A.courierFetch = async () => ({ ok: false, status: 401, text: "{}" }); A._impAt = {}; await A.coImport("ecomdelivery", true);
    return { im, ext, again, calls, warn: toasts.some(x => /تعذّر جلب طرود/.test(x)), added: toasts.some(x => /وإضافة 1/.test(x)) };
  });
  t("طرد أُنشئ في لوحة E-com مباشرة: يُجلب ويُضاف خارجياً بحالته، ولا يتكرر الجلب خلال 5 دقائق، والخطأ (401) يظهر بتنبيه", IM.im && IM.im.ext === 1 && /EC777XYZ:Commande Confirmée/.test(IM.ext) && IM.again === null && IM.warn && IM.added, IM);
  const WH = await p.evaluate(async () => {
    const A = Admin, calls = []; A.deliveryCfg = { ecomdelivery: { enabled: true, apiKey: "k", apiToken: "t" } };
    A.courierFetch = async req => { calls.push(req.method + " " + req.url.replace(/^.*api_v2/, "") + (req.body ? " " + req.body : "")); return /webhook\/test/.test(req.url) ? { ok: true, status: 200, text: JSON.stringify({ ok: true, detail: "HTTP 200" }) } : { ok: true, status: 200, text: JSON.stringify({ actif: true }) }; };
    const okMsg = await A.ecomRegisterWebhook("https://x.supabase.co/functions/v1/ecom-webhook?s=SEC", "SEC");
    A.courierFetch = async () => ({ ok: false, status: 422, text: JSON.stringify({ error: { code: "validation", message: "URL invalide" } }) }); const badMsg = await A.ecomRegisterWebhook("u", "s");
    A.deliveryCfg = { ecomdelivery: { enabled: true } }; const noKeys = await A.ecomRegisterWebhook("u", "s");
    return { calls, okMsg, badMsg, noKeys };
  });
  t("تسجيل الـwebhook عند E-com: PUT /webhook بالرابط والسرّ وكل الأحداث ثم POST /webhook/test؛ وأخطاؤه واضحة", WH.calls.length === 2 && /^PUT \/webhook .*"secret":"SEC".*"events":\["\*"\]/.test(WH.calls[0]) && /^POST \/webhook\/test/.test(WH.calls[1]) && /✅/.test(WH.okMsg) && /422/.test(WH.badMsg) && /URL invalide/.test(WH.badMsg) && /أدخل مفتاحَي/.test(WH.noKeys), WH);
  const CO = await p.evaluate(async () => {
    const A = Admin, toasts = []; window.toast = m => toasts.push(m); window.confirm = () => true; A.renderStats = () => { }; A.renderOrders = () => { }; A.renderShipped = () => { };
    A.deliveryCfg = { ecomdelivery: { enabled: true, apiKey: "k", apiToken: "t" } }; A.orders = []; try { localStorage.removeItem("alyssum_ext_parcels"); } catch (e) { }
    const added = []; API.addOrder = async o => { added.push(o); return { ok: true, id: "M-NEW1" }; }; API.updateOrder = () => Promise.resolve(); A.saveTracking = function (o, co, trk) { o.note = (o.note || "") + " 🚚" + co + ":" + trk; };
    A.extSave("ecomdelivery", { tracking: "EC777XYZ", client: "كريم", phone: "+213 661 11 22 33", commune: "Bab Ezzouar", amount: 2500, product: "عسل", raw: "Commande Confirmée", at: Date.now() });
    await A.coCreateOrder("ecomdelivery", "EC777XYZ");
    return { n: added.length, o: added[0], loc: A.orders[0] && { id: A.orders[0].id, st: A.orders[0].status, note: A.orders[0].note, total: A.orders[0].total }, ext: ((A.extAll().ecomdelivery) || []).length, ok: toasts.some(x => /أُنشئ الطلب/.test(x)) };
  });
  t("📥 إنشاء طلب من طرد خارجي: يُنشأ بالبيانات، يُربط بالتتبع بحالة «مؤكَّد»، ويُزال من الخارجية", CO.n === 1 && CO.o.name === "كريم" && CO.o.total === 2500 && CO.o.items[0].title === "عسل" && CO.loc && CO.loc.id === "M-NEW1" && CO.loc.st === "confirmee" && /ecomdelivery:EC777XYZ/.test(CO.loc.note) && CO.ext === 0 && CO.ok, CO);
  t("parseStatus والبوردرو والإلغاء ومدرجة بين الشركات", R.ps === "Au Bureau" && /bordereau\?format=10x13/.test(R.lbl) && R.del === "DELETE" && R.listed, [R.ps, R.lbl, R.del, R.listed]);
  const F = await p.evaluate(async () => {
    const A = Admin, out = {}; window.toast = () => { }; const wait = ms => new Promise(r => setTimeout(r, ms)); const saved = []; API.addOrder = async o => { saved.push(o); return { ok: true, id: "M-EC1" }; };
    A.enabledCompanyKeys = () => ["ecomdelivery", "wecan"]; A.deliveryCfg = { ecomdelivery: { enabled: true, apiKey: "k", apiToken: "t", prices: { 16: { home: 450, stop: 200 } }, cancelFees: { 16: 0 } }, wecan: { enabled: true, apiKey: "k", apiSecret: "s", prices: {} } };
    const open = async key => { A.activeCompanyKey = () => key; const old = document.getElementById("mo-bg"); if (old) old.remove(); ManualOrder.open({ mode: "new" }); await wait(500); return document.getElementById("mo-bg"); };
    let bg = await open("ecomdelivery"), q = s => bg.querySelector(s);
    const w = q("#mo-wil"); w.value = "Alger"; w.dispatchEvent(new Event("change", { bubbles: true })); await wait(500);
    out.ec = { tar: !q("#mo-tar").classList.contains("hidden"), txt: q("#mo-tar").innerText.replace(/\s+/g, " "), ech: !!q("#mo-ech"), addr: !!q("#mo-addr") };
    q("#mo-fee").value = 100; q("#mo-fee").dispatchEvent(new Event("input", { bubbles: true })); await wait(200); out.warn = /أقل من رسم التوصيل/.test(q("#mo-tar").innerText); out.warnTxt = q("#mo-tar").innerText.slice(0, 200) + "|" + q("#mo-tot").textContent; q("#mo-fee").value = 450; q("#mo-fee").dispatchEvent(new Event("input", { bubbles: true })); await wait(100);
    q("#mo-ech").checked = true; q("#mo-name").value = "زبون تجريبي"; q("#mo-phone").value = "0550123456"; const pr = q('[data-f="title"], #mo-lines input'); 
    bg = await open("wecan"); out.wc = { tar: !!bg.querySelector("#mo-tar"), ech: !!bg.querySelector("#mo-ech") };
    return out; });
  t("نموذج E-com: صندوق التعريفة (منزل 450 / إن أُلغي 0)، خانة الاستبدال، حقل العنوان", F.ec.tar && /450/.test(F.ec.txt) && /إن أُلغي/.test(F.ec.txt) && F.ec.ech && F.ec.addr, F.ec);
  t("تنبيه الحد الأدنى حين يقلّ المبلغ عن رسم التوصيل", F.warn === true, [F.warn, F.warnTxt]);
  t("نموذج WeCan (شركة أخرى افتراضية) بلا صندوق تعريفة ولا خانة استبدال: النموذج يتبع الشركة الافتراضية", F.wc.tar === false && F.wc.ech === false, F.wc);
  const E2 = await p.evaluate(() => { const co = Admin.DELIVERY_COMPANIES.ecomdelivery; const b = JSON.parse(co.buildRequest({ apiKey: "k", apiToken: "t" }, { id: "X1", name: "ن", phone: "0550123456", wilaya: "Alger", commune: "Bab Ezzouar", dtype: "home", items: "x ×1 = 100 DA", total: 100, extra: { "🔄 تبديل": "نعم" } }).body)[0]; const f = co.parseFees({ wilayas: [{ wilaya: 16, domicile: 450, stopdesk: 200, annuler: 100 }] }); return { ech: b.echange, cancel: f.cancel }; });
  t("echange=1 يصل الشركة، وparseFees يعيد رسم الإلغاء", E2.ech === 1 && E2.cancel && E2.cancel[16] === 100, E2);
  t("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  await b.close(); process.exit(bad ? 1 : 0);
})();
