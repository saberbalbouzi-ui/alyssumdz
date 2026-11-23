/* مطابقة مكتب الزبون بمركز الشركة (WeCan…): لا سؤال إن وُجد بالاسم في الولاية ولو اختلف المعرّف، ويُتذكَّر الاختيار. NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let bad = 0; const t = (n, c, x) => { console.log((c ? "✓ " : "✗ ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) bad++; };
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 140)));
  await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6500);
  const R = await p.evaluate(() => {
    const A = Admin, w = A.wCo("Khenchela"), wid = w.id, o = {}; localStorage.removeItem("alyssum_deskmap_wecan"); A._deskOverride = {};
    const centers = [{ id: "WC-501", name: "Agence Route de Meskiana [Yalidine]", wilaya_id: wid, commune: "Khenchela" }, { id: "WC-502", name: "Bureau Centre [ZR Express]", wilaya_id: wid, commune: "Khenchela" }, { id: "WC-900", name: "Autre", wilaya_id: wid + 1, commune: "x" }];
    w.desks = (w.desks || []).concat([{ name: "Agence Route de Meskiana [Yalidine]", id: 777777 }]);         /* مكتب المتجر بمعرّف مختلف عن معرّف مركز الشركة */
    const ord = { id: "M1", wilaya: "Khenchela", desk: "Agence Route de Meskiana [Yalidine]", dtype: "stop" };
    o.byName = A.resolveCenterId("wecan", ord, centers, w);
    o.noTag = A.resolveCenterId("wecan", { id: "M2", wilaya: "Khenchela", desk: "Bureau Centre", dtype: "stop" }, centers, w);
    o.unknown = A.resolveCenterId("wecan", { id: "M3", wilaya: "Khenchela", desk: "مكتب غير موجود", dtype: "stop" }, centers, w);
    A.orders = [{ id: "M4", wilaya: "Khenchela", desk: "مكتب غير موجود" }]; document.body.insertAdjacentHTML("beforeend", "<select id='pick-desk'><option value='WC-502'>x</option></select><div id='notice-modal-bg'></div>");
    A.sendOrderToDelivery = () => { }; A.pickDesk("M4", "wecan");
    o.remembered = A.resolveCenterId("wecan", { id: "M5", wilaya: "Khenchela", desk: "مكتب غير موجود", dtype: "stop" }, centers, w);
    o.otherWilaya = A.resolveCenterId("wecan", { id: "M6", wilaya: "Khenchela", desk: "Autre", dtype: "stop" }, centers, w);
    return o; });
  t("مكتب الزبون موجود بالاسم في مراكز الشركة ومعرّفه مختلف ← يُحدَّد المركز بلا سؤال", R.byName === "WC-501", R);
  t("الاسم بلا وسم [الشركة] ← يُطابق المركز الوحيد", R.noTag === "WC-502", R);
  t("مكتب غير موجود ← null (يُسأل المستخدم مرة)", R.unknown === null, R);
  t("بعد الاختيار يُتذكَّر لنفس المكتب فلا يُسأل ثانية", R.remembered === "WC-502", R);
  t("مركز من ولاية أخرى لا يُطابق", R.otherWilaya === null, R);
  t("بلا أخطاء JS", errs.length === 0, errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
