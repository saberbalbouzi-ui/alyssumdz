/* مكاتب Stop Desk لـ Ecotrack/DHD من get/communes: python3 -m http.server 8765 & NODE_PATH=/opt/node-tools/node_modules node scripts/test-ecotrack-desks.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let pass = 0, fail = 0; const ok = (n, v, x) => { if (v) pass++; else fail++; console.log((v ? "✓ " : "✗ ") + n + (v ? "" : " " + JSON.stringify(x || ""))); };
  await p.route(/supabase\.co|generativelanguage/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem("alyssum_admin_on", "1"); localStorage.setItem("au_dismiss", "99"); } catch (e) { } });
  await p.goto("http://localhost:8765/admin.html", { waitUntil: "commit" }); await p.waitForTimeout(6000);
  const r = await p.evaluate(async () => {
    const A = Admin, co = A.allDeliveryCompanies().dhd, cfg = { baseUrl: "https://platform.dhd-dz.com/", token: "T" }; const out = {};
    out.hasCenters = typeof co.centersRequest === "function"; out.url5 = co.centersRequest(cfg, 33).url; out.auth = co.centersRequest(cfg, 1).headers.Authorization;
    /* ردّ يحاكي شكل get/communes: كائن بلديات {nom, has_stop_desk, code_postal} */
    const resp = w => ({ "1": { nom: "Alpha" + w, has_stop_desk: 1, code_postal: (w < 10 ? "0" : "") + w + "001" }, "2": { nom: "Beta" + w, has_stop_desk: 0, code_postal: "99999" }, "3": { nom: "Gamma" + w, has_stop_desk: "1", code_postal: "" } });
    out.parsed = co.parseCenters(resp(33), 33); const calls = []; localStorage.removeItem(A.centersKey(co)); A._centersMap = {};
    A.courierFetch = async req => { const w = Number(new URL(req.url).searchParams.get("wilaya_id")); calls.push(w); if (w === 20) return { ok: false, status: 500, text: "" }; return { ok: true, status: 200, text: JSON.stringify(resp(w)) }; };
    const rows = await A.companyCenters(co, cfg); out.n = rows.length; out.calls = calls.length; out.first = rows[0]; out.w9 = rows.find(x => x.wilaya_id === 9); out.noW20 = !rows.some(x => x.wilaya_id === 20);
    const w = A.wCo("Oran") || { id: 31 }; out.req = co.buildRequest(cfg, { id: "T1", name: "x", phone: "0551234567", wilaya: "Oran", commune: "Oran", dtype: "stop", __deskId: "31001", total: 3000, items: "x" }).body;
    out.reqHome = co.buildRequest(cfg, { id: "T2", name: "x", phone: "0551234567", wilaya: "Oran", commune: "Oran", dtype: "home", __deskId: "31001", total: 3000, items: "x" }).body;
    return out; });
  ok("الشركة تدعم جلب المراكز (get/communes?wilaya_id=33) بتوكن Bearer", r.hasCenters && /\/api\/v1\/get\/communes\?wilaya_id=33$/.test(r.url5) && r.auth === "Bearer T", r);
  ok("البلدية ذات has_stop_desk فقط ولها code_postal تصبح مكتباً (رمزه code_postal)", r.parsed.rows.length === 1 && r.parsed.rows[0].id === "33001" && r.parsed.rows[0].wilaya_id === 33, r.parsed);
  ok("يُجلب 58 ولاية وفشل ولاية واحدة (20) لا يُسقط الباقي", r.calls === 58 && r.n === 57 && r.noW20, { calls: r.calls, n: r.n });
  ok("الرمز بصفر في أوله يبقى نصاً (09001)", r.w9 && r.w9.id === "09001", r.w9);
  ok("طلب Stop Desk يرسل code_postal = رمز المكتب و stop_desk=1", /"stop_desk":1/.test(r.req) && /"code_postal":"31001"/.test(r.req), r.req);
  ok("طلب المنزل لا يرسل رمز مكتب", /"stop_desk":0/.test(r.reqHome) && /"code_postal":""/.test(r.reqHome), r.reqHome);
  /* بلديات الشركة الحقيقية + خيارات نموذج الطلب اليدوي بحسب الشركة الفعّالة */
  const r2 = await p.evaluate(async () => {
    const A = Admin, co = A.allDeliveryCompanies().dhd, cfg = { baseUrl: "https://platform.dhd-dz.com", token: "T" }; const out = {};
    out.cReq = co.communesRequest(cfg, 16).url; out.parsed = co.parseCommunes({ "1": { nom: "Bab Ezzouar", has_stop_desk: 1, code_postal: "16001" }, "2": { nom: "Alger Centre" }, "x": 5 }).names;
    A.courierFetch = async req => ({ ok: true, status: 200, text: JSON.stringify({ "1": { nom: "Bab Ezzouar" }, "2": { nom: "Alger Centre" } }) });
    try { Object.keys(localStorage).filter(k => /^alyssum_communes_/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { } A._communesCache = {}; A._communesNeg = {};
    const fix = await A.resolveCommune(co, cfg, { id: "Z1", wilaya: "Alger", commune: "bab ezzouar" }); out.fix = fix;
    const bad = await A.resolveCommune(co, cfg, { id: "Z2", wilaya: "Alger", commune: "Xyzxyz" }); out.bad = { ok: bad.ok, n: (bad.list || []).length };
    /* خيارات اليدوي: DHD فعّالة وWeCan وياليدين مفعّلتان فقط */
    const en = ["dhd", "wecan", "yalidine"]; A.enabledCompanyKeys = () => en; let act = "dhd"; A.activeCompanyKey = () => act; const open = () => { ManualOrder.open({ mode: "new" }); const e = { frag: !!document.getElementById("mo-frag"), open: !!document.getElementById("mo-open"), xch: !!document.getElementById("mo-xch") }; document.querySelectorAll('[id^="mo-"]').forEach(x => { }); const bg = document.querySelector(".mo-bg, #mo-bg"); try { (bg || document.getElementById("mo-name").closest('[class*="bg"],[id*="bg"]')).remove(); } catch (x) { } return e; };
    out.dhd = open(); act = "wecan"; out.wecan = open(); act = "yalidine"; out.yal = open(); return out; });
  ok("بلديات DHD الحقيقية: طلب get/communes?wilaya_id=16 وقراءة الأسماء", /\/api\/v1\/get\/communes\?wilaya_id=16$/.test(r2.cReq) && r2.parsed.length === 2 && r2.parsed[0] === "Bab Ezzouar", r2);
  ok("اسم البلدية يُطبَّع على اسم الشركة (bab ezzouar ← Bab Ezzouar)، وغير الموجودة تُعرض قائمة الشركة لاختيارها", r2.fix.ok && r2.fix.name === "Bab Ezzouar" && r2.bad.ok === false && r2.bad.n === 2, r2);
  ok("DHD فعّالة: لا «السماح بفتح الطرد» ولا استبدال (حتى لو WeCan وياليدين مفعّلتان)؛ و«قابل للكسر» خاص بها", !r2.dhd.open && !r2.dhd.xch, r2.dhd);
  ok("WeCan فعّالة: كسر وفتح واستبدال", r2.wecan.frag && r2.wecan.open && r2.wecan.xch, r2.wecan);
  ok("ياليدين فعّالة: استبدال فقط", !r2.yal.frag && r2.yal.xch, r2.yal);
  const r3 = await p.evaluate(() => { const co = Admin.allDeliveryCompanies().dhd, cfg = { baseUrl: "https://platform.dhd-dz.com", token: "T" }; const o = { id: "T3", name: "x", phone: "0551234567", wilaya: "Alger", commune: "Alger Centre", dtype: "home", total: 2200, items: "x", note: "  اتصل  قبل الوصول ", extra: { "📞 هاتف 2": "0661234567" } };
    return { a: JSON.parse(co.buildRequest(cfg, o).body), b: JSON.parse(co.buildRequest(cfg, Object.assign({}, o, { note: "", extra: {} })).body) }; });
  ok("ملاحظة الطلب تُرسل في remarque والهاتف الثاني في telephone_2", r3.a.remarque === "اتصل قبل الوصول" && r3.a.telephone_2 === "0661234567" && r3.b.remarque === "" && r3.b.telephone_2 === undefined, r3);
  const r4 = await p.evaluate(() => { const A = Admin, co = A.allDeliveryCompanies().dhd, cfg = { baseUrl: "https://platform.dhd-dz.com", token: "T" };
    const o = { id: "T4", name: "x", phone: "0551234567", wilaya: "Alger", commune: "Alger Centre", dtype: "home", total: 2200, items: "x", extra: { "🏠 العنوان": "حي النصر 12", "📍 الموقع": "https://maps.google.com/?q=36.7,3.0", "⚖️ الوزن (كغ)": "1.5", "📦 قابل للكسر": "نعم" } };
    const full = JSON.parse(co.buildRequest(cfg, o).body), bare = JSON.parse(co.buildRequest(cfg, Object.assign({}, o, { extra: {} })).body);
    A.enabledCompanyKeys = () => ["dhd", "wecan"]; let act = "dhd"; A.activeCompanyKey = () => act; const has = () => { ManualOrder.open({ mode: "new" }); const e = { addr: !!document.getElementById("mo-addr"), gps: !!document.getElementById("mo-gps"), wt: !!document.getElementById("mo-wt"), frag: !!document.getElementById("mo-frag"), open: !!document.getElementById("mo-open") }; try { document.getElementById("mo-bg").remove(); } catch (x) { } return e; };
    return { full, bare, dhd: has(), wecan: (act = "wecan", has()) }; });
  ok("طلب DHD يحمل العنوان ورابط الموقع والوزن وقابل للكسر", r4.full.adresse === "حي النصر 12" && r4.full.gps_link === "https://maps.google.com/?q=36.7,3.0" && r4.full.weight === 1.5 && r4.full.fragile === 1, r4.full);
  ok("بلا قيم: لا gps_link/fragile، والوزن الافتراضي 1، والعنوان الافتراضي بلدية، ولاية", r4.bare.gps_link === undefined && r4.bare.weight === 1 && r4.bare.fragile === undefined && /Alger Centre/.test(r4.bare.adresse), r4.bare);
  ok("نموذج الطلب اليدوي مع DHD: العنوان ورابط الموقع والوزن وقابل للكسر (بلا خيار فتح الطرد)", r4.dhd.addr && r4.dhd.gps && r4.dhd.wt && r4.dhd.frag && !r4.dhd.open, r4.dhd);
  ok("مع WeCan: لا حقول DHD (عنوان/موقع/وزن)", !r4.wecan.addr && !r4.wecan.gps && !r4.wecan.wt && r4.wecan.frag && r4.wecan.open, r4.wecan);
  ok("بلا أخطاء JS", errs.length === 0, errs.slice(0, 2));
  console.log(fail ? "فشل " + fail : "نجح " + pass + " من " + pass); await b.close(); process.exit(fail ? 1 : 0);
})();
