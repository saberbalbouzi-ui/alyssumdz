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
  t("parseStatus والبوردرو والإلغاء ومدرجة بين الشركات", R.ps === "EnCours · Au Bureau" && /bordereau\?format=10x13/.test(R.lbl) && R.del === "DELETE" && R.listed, [R.ps, R.lbl, R.del, R.listed]);
  t("بلا أخطاء JS", errs.length === 0, errs.slice(0, 3));
  await b.close(); process.exit(bad ? 1 : 0);
})();
