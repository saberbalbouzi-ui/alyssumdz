/* WeCan: قائمة الطرود الكاملة (كل «Expéditions») تُستورد طروداً خارجية بحالتها الفعلية (المسودات والملغاة مستثناة)، والطلبات النهائية المخالفة تُراجَع قبل المتّسقة ولا تُجوَّع بالحصة. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); localStorage.removeItem("alyssum_ext_parcels"); localStorage.removeItem("alyssum_fin_ref"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(async () => {
    document.getElementById("app").classList.remove("hidden"); window.toast = () => { }; const A = Admin; A.deliveryCfg = Object.assign({}, A.deliveryCfg, { wecan: { enabled: true, apiKey: "k", apiSecret: "s" } });
    const co = A.allDeliveryCompanies().wecan; const o = {};
    /* 1) القائمة: صفحة كلها مسودات ثم صفحة فيها طرد في الطريق ومسلَّم وملغى */
    const draft = i => ({ tracking: "WC-DR" + i, order_id: "D" + i, last_status: "En préparation", date_expedition: null });
    A.courierFetch = async req => { const u = String(req.url);
      if (/\/orders\/track\//.test(u)) { const k = decodeURIComponent(u.split("/orders/track/")[1]); return { ok: true, status: 200, text: JSON.stringify({ data: { attributes: { timeline: k === "WS-ALY-ext1" ? [{ status: "order_created", timestamp: "2026-11-20T10:00:00+01:00" }, { status: "en-attente-du-client", timestamp: "2026-11-23T10:00:00+01:00" }] : [] } } }) }; }
      if (/\/parcels\?/.test(u)) { const pg = Number((u.match(/page=(\d+)/) || [])[1] || 1); if (pg === 1) return { ok: true, status: 200, text: JSON.stringify({ has_more: true, data: Array.from({ length: 100 }, (_, i) => draft(i)) }) };
        return { ok: true, status: 200, text: JSON.stringify({ has_more: false, data: [{ tracking: "WS-ALY-ext1", order_id: "EXT1", firstname: "ع", familyname: "ب", contact_phone: "0550000001", price: 2500, last_status: "Expédié", date_expedition: "2026-11-20" }, { tracking: "WS-ALY-ext2", order_id: "EXT2", last_status: "Livré", date_expedition: "2026-11-20" }, { tracking: "WS-ALY-ext3", order_id: "EXT3", last_status: "Annulé" }] }) }; }
      return { ok: true, status: 200, text: "[]" }; };
    const rows = await A.companyListRows("wecan"); o.n = rows.length; o.ext1 = (rows.find(x => x.tracking === "WS-ALY-ext1") || {}).status; o.trks = rows.map(x => x.tracking).sort().join(",");
    A.orders = []; A.importCompanyRows("wecan", rows, { create: true }); const cr = A.coRows("wecan"); o.coRows = cr.map(r => r.tracking + ":" + r.status).sort().join(",");
    /* 2) الأولوية: 60 مسلَّماً متّسقاً حديثاً + مسلَّم أقدم حالته المحفوظة «returned» (مخالفة) ← تُراجَع المخالفة ولا تُجوَّع */
    localStorage.removeItem("alyssum_fin_ref"); A._finRef = {}; A.shipRaw = {};
    const mk = (id, trk, days) => ({ id, date: new Date(Date.now() - days * 864e5).toISOString(), name: "ز" + id, phone: "0550000" + id.slice(-3), wilaya: "Alger", commune: "x", dtype: "home", items: "x ×1 = 1 DA", total: 1000, status: "livree", note: "🚚wecan:" + trk });
    A.orders = Array.from({ length: 60 }, (_, i) => mk("L" + i, "WSOK" + i, 1 + (i % 10))); A.orders.push(mk("LMIS", "WSMIS1", 8)); A.deliveryCfg = Object.assign({}, A.deliveryCfg, { yalidine: { enabled: true, apiId: "i", apiToken: "t" } }); A.orders.push(Object.assign(mk("LYAL", "YALX1", 8), { note: "🚚yalidine:YALX1" })); A.orders.forEach(x => { A.shipRaw[x.id] = { raw: x.id === "LMIS" ? "En préparation" : (x.id === "LYAL" ? "Retourné au vendeur" : "Livré") }; });
    const asked = []; A.courierFetch = async req => { const u = String(req.url); asked.push(u); const m = u.match(/parcels\/([^/?]+)$/); if (m) return { ok: true, status: 200, text: JSON.stringify([{ tracking: m[1], last_status: m[1] === "WSMIS1" ? "returned" : "Livré" }]) }; if (/\/parcels\?/.test(u)) return { ok: true, status: 200, text: JSON.stringify({ has_more: false, data: [] }) }; return { ok: true, status: 200, text: "{}" }; };
    A._shipSync = null; await A.syncShipping({ silent: true }); await new Promise(r => setTimeout(r, 400));
    o.mis = (A.orders.find(x => x.id === "LMIS") || {}).status; o.yal = (A.orders.find(x => x.id === "LYAL") || {}).status; o.yalAsked = asked.some(u => /YALX1/.test(u)); o.calls = asked.filter(u => /parcels\/WS/.test(u)).length; return o; });
  t("قائمة الطرود: تُتجاوز صفحة المسودات، وتُستثنى المسودة والملغى، ويبقى طرد الطريق والمسلَّم", R.n === 2 && R.trks === "WS-ALY-ext1,WS-ALY-ext2", R);
  t("الطرد الخارجي في الطريق يأخذ حالته الفعلية من السجلّ الزمني «En attente du client»", R.ext1 === "En attente du client", R);
  t("شرائح بطاقة الشركة تضمّ الطرود الخارجية بحالاتها", /WS-ALY-ext1:En attente du client/.test(R.coRows) && /WS-ALY-ext2:Livré/.test(R.coRows), R);
  t("الأولوية: المسلَّم المخالف (returned) يُراجَع ويصير فشل/مرتجع رغم 60 طلباً متّسقاً حديثاً", R.mis === "echec", R);
  /* طرد سُجّل مباشرة عندهم بنفس الزبون والمبلغ لطلب تتبعه مسودة ميتة: اقتراح ربط بلا ربط تلقائي ولا طلب مكرَّر */
  const RL = await p.evaluate(async () => {
    const A = Admin; window.toast = () => { }; const shown = []; const sn = A.showNotice; A.showNotice = (ti, h) => { shown.push(ti + "|" + h); }; localStorage.removeItem("alyssum_relink_seen"); localStorage.removeItem("alyssum_ext_parcels"); A._relinkCand = {};
    A.deliveryCfg = Object.assign({}, A.deliveryCfg, { wecan: { enabled: true, apiKey: "k", apiSecret: "s" } });
    A.orders = [{ id: "S261116-0BADD", date: new Date(Date.now() - 3 * 864e5).toISOString(), name: "حموني امحمد", phone: "0660013162", wilaya: "Tindouf", commune: "Tindouf", dtype: "home", items: "x ×1 = 1 DA", total: 4600, status: "confirmee", note: "🚚wecan:WS-ALY-jHIsDYJ6" }]; A.shipRaw = { "S261116-0BADD": { raw: "En préparation" } };
    const rows = [{ tracking: "WS-ALY-pKUvMUc3", reference: "WS-ALY-pKUvMUc3", client: "حموني امحمد", phone: "0660013162", amount: 4600, status: "En attente du client", date: "2026-11-17 17:40:56", wilaya: "Tindouf", commune: "Tindouf", product: "x" }]; rows.complete = true;
    A.importCompanyRows("wecan", rows, {}); const cand = Object.assign({}, A._relinkCand); const before = A.orders.length; await A.coAutoCreate("wecan"); const after = A.orders.length;
    A.notifyRelink(); const n1 = shown.length, html = shown[0] || ""; A.notifyRelink(); const n2 = shown.length;
    const k = Object.keys(cand)[0]; A.relinkDraft("S261116-0BADD", k); A.showNotice = sn;
    return { cand: Object.keys(cand), noDup: before === after, n1, n2, hasBtn: /relinkDraft/.test(html), note: A.orders[0].note, ext: (A.extAll().wecan || []).length };
  });
  t("اقتراح ربط للطرد الجديد بالطلب العالق (الهاتف والمبلغ) بلا طلب مكرَّر", RL.cand.length === 1 && RL.noDup, RL);
  t("يُعرض الاقتراح مرة واحدة بزرّ ربط، والربط بنقرة يستبدل التتبع القديم ويُزيل الطرد الخارجي", RL.n1 === 1 && RL.n2 === 1 && RL.hasBtn && /WS-ALY-pKUvMUc3/.test(RL.note) && !/jHIsDYJ6/.test(RL.note) && RL.ext === 0, RL);
  /* استمرار المطابقة: عند العودة للتبويب بعد أكثر من 5 دقائق تُجرى مزامنة فورية، وقبلها لا */
  const CU = await p.evaluate(async () => {
    const A = Admin; let n = 0; A.key = A.key || "k"; A.activeCompanyKey = () => "wecan"; A.syncShipping = async () => { n++; }; A.reconcileShipping = async () => { }; A.checkCompanyKeys = () => { }; A.returnsSweep = () => { };
    clearInterval(A._shipTimer); A._shipTimer = null; A.startShipAutoSync();
    A._lastShipSync = Date.now() - 10 * 60000; document.dispatchEvent(new Event("visibilitychange")); await new Promise(r => setTimeout(r, 2200)); const old = n;
    A._lastShipSync = Date.now() - 60000; document.dispatchEvent(new Event("visibilitychange")); await new Promise(r => setTimeout(r, 2200)); clearInterval(A._shipTimer); return { old, fresh: n - old }; });
  t("عودة التبويب بعد أكثر من 5 دقائق تُشغّل مزامنة فورية، وقبلها لا", CU.old >= 1 && CU.fresh === 0, CU);
  t("المراجعة تشمل ياليدين أيضاً: مسلَّم محفوظ له حالة «مرتجع» قديمة يُراجَع ويبقى مسلَّماً (الشركة تقول Livré)", R.yal === "livree" && R.yalAsked, R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
