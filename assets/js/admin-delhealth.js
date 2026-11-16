/* «صحة التوصيل» (v1.89.1222): بطاقة أعلى قسم «شركات التوصيل» تُريك لكل شركة مفعّلة: عمر آخر فحص لأسعارها ومصدرها، فشل الجلب، فرق أسعار حسابك عمّا يعرضه متجرك، ومكاتب Stop Desk المحمَّلة؛
   مع فحص تلقائي كل 7 أيام عند فتح اللوحة، واعتماد أسعار الحساب بنقرة، وأداة «لماذا هذا السعر؟» تشرح سلسلة المصدر (صفحة/منتج ← شركة ← تعديل يدوي/حسابك/جدولك المحفوظ ← تعديل السعر المعروض).
   لا يخصّ متجراً بعينه: يقرأ إعدادات المتجر الحالي فقط. */
const AdminDelHealth = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const DAY = 86400000, STALE = 14 * DAY, EVERY = 7 * DAY;
  const esc = v => String(v == null ? "" : v).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const S = { running: {}, told: false, timer: 0 };
  const ageTxt = t => { if (!t) return "لم يُفحص بعد"; const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? "اليوم" : d === 1 ? "أمس" : "منذ " + d + " يوماً"; };
  const wname = id => { const a = A(), w = ((a && a.fees) || []).find(x => Number(x.id) === Number(id)) || (typeof WILAYAS !== "undefined" ? WILAYAS.find(x => Number(x.id) === Number(id)) : null); return w ? w.name : String(id); };
  const sig = d => { const t = JSON.stringify(((d && d.list) || []).map(x => [x.id, x.api[0], x.api[1]])); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return String(h); };
  const hasCreds = cfg => !!(cfg && (cfg.apiId || cfg.apiToken || cfg.apiKey));
  const desksOf = key => { const a = A(); let n = 0; try { (typeof WILAYAS !== "undefined" ? WILAYAS : (a.fees || [])).forEach(w => (w.desks || []).forEach(d => { if (a.deskCoOf && a.deskCoOf(d) === key) n++; })); } catch (e) { } return n; };

  /* صفوف الصحة: {key,name,level:ok|warn|bad,issues:[{t,k}],...} */
  function rows() {
    const a = A(); if (!a || !a.enabledCompanyKeys) return [];
    const all = a.allDeliveryCompanies(), def = a.activeCompanyKey ? a.activeCompanyKey() : "", out = [];
    a.enabledCompanyKeys().forEach(k => {
      const co = all[k] || {}, cfg = a.deliveryCfg[k] || {}, issues = [], nP = Object.keys(cfg.prices || {}).length, api = !!co.feesRequest && hasCreds(cfg), last = cfg.checkedAt || cfg.pricesAt || 0;
      const generic = !!co.feesGeneric, d = !generic && cfg.drift && cfg.drift.n ? cfg.drift : null, ign = d && cfg.driftIgnore === sig(d);
      if (cfg.pricesErr) issues.push({ k: "bad", t: "آخر جلب لأسعارها فشل: " + String(cfg.pricesErr).replace(/CORS_BLOCKED/g, "الاتصال بالشركة محجوب من المتصفح").slice(0, 140), act: "check" });
      if (d && !ign) { const x = d.list[0]; issues.push({ k: "warn", t: d.n + " ولاية تختلف أسعارها في حسابك عمّا يعرضه متجرك" + (x ? " (مثلاً " + wname(x.id) + ": متجرك " + x.cur[0] + "/" + x.cur[1] + " وحسابك " + x.api[0] + "/" + x.api[1] + ")" : ""), act: "approve" }); }
      if (generic) issues.push({ k: "info", t: "هذه الشركة لا تتيح قراءة أسعار عقدك من الخارج، فألصق جدولك مرة واحدة أدناه ويُحفظ ويُنشر لمتجرك (أو استعمل «تعديل أسعار ولايات»). ونراقب فواتيرها الفعلية على طرودك المسلَّمة وننبّهك إن خالفت أسعارك", act: "grid" });
      if (generic) { const iv = invoice(k), isg = JSON.stringify(iv.map(x => [x.id, x.type, x.real])); if (iv.length && cfg.invIgnore !== isg) { const x = iv[0]; issues.push({ k: "warn", t: "فواتير الشركة تخالف أسعارك في " + iv.length + " ولاية/نوع، مثلاً " + wname(x.id) + " (" + (x.type === "stop" ? "مكتب" : "منزل") + "): جدولك " + x.exp + " وفوترت " + x.real + " في " + x.n + " طرود", act: "invoice" }); } }
      if (api && !generic && !cfg.pricesErr && last && Date.now() - last > STALE) issues.push({ k: "warn", t: "لم تُفحص أسعارها " + ageTxt(last), act: "check" });
      if (api && !generic && !last) issues.push({ k: "warn", t: "لم تُفحص أسعارها بعد", act: "check" });
      if (co.feesRequest && !nP) issues.push({ k: "warn", t: "لا أسعار محفوظة لها" + (api ? "" : " — أدخل مفاتيح الحساب لجلبها"), act: api ? "check" : "" });
      const dn = co.centersRequest ? desksOf(k) : -1;
      if (k === def && co.centersRequest && dn === 0) issues.push({ k: "warn", t: "مكاتب Stop Desk لم تُحمَّل بعد", act: "desks" });
      const level = issues.some(i => i.k === "bad") ? "bad" : issues.some(i => i.k === "warn") ? "warn" : "ok";
      const nO = optCount(cfg), toStore = String(cfg.optionsToStore || "").trim() === "1"; out.push({ key: k, toStore, name: co.name || k, def: k === def, level, issues, nP, nO, canProbe: !!PROBE[k] && hasCreds(cfg), desks: dn, last, src: cfg.priceSrc === "api" ? "حسابك" : (cfg.priceBase || cfg.priceFix || co.tariff) ? "جدولك المحفوظ" : (nP ? "حسابك" : "—"), canCheck: api && !generic, generic });
    });
    return out;
  }
  const attention = () => { try { return rows().filter(r => r.level !== "ok").length; } catch (e) { return 0; } };

  /* فحص: يجلب أسعار الحساب الخام ويحسب الفرق (لا يغيّر ما يُعرض في المتجر ما لم يكن مصدر الأسعار api) */
  async function check(key, quiet) {
    const a = A(); if (!a || S.running[key]) return false; S.running[key] = 1;
    try { await a.fetchCompanyPrices(key, { auto: true, check: true }); } catch (e) { console.warn("delhealth", e); }
    S.running[key] = 0; render(); return true;
  }
  function approve(key) {
    const a = A(), cfg = a && a.deliveryCfg[key]; if (!cfg || !cfg.apiPrices) return false;
    const c2 = Object.assign({}, cfg, { priceSrc: "api" }), applied = a.applyPriceFix(cfg.apiPrices, c2, key);
    a.deliveryCfg[key] = Object.assign({}, c2, { prices: applied, drift: a.priceDrift(cfg.apiPrices, applied), driftIgnore: "" });
    a.saveDeliveryCfgToStorage(); try { a.publishShipCo(); } catch (e) { } try { a.renderDelivery(); } catch (e) { }
    if (typeof toast === "function") toast("✅ اعتُمدت أسعار حسابك لدى " + ((a.allDeliveryCompanies()[key] || {}).name || key));
    return true;
  }
  function ignore(key) {
    const a = A(), cfg = a && a.deliveryCfg[key]; if (!cfg || !cfg.drift) return false;
    a.deliveryCfg[key] = Object.assign({}, cfg, { driftIgnore: sig(cfg.drift) }); a.saveDeliveryCfgToStorage(); render(); return true;
  }

  /* لماذا هذا السعر؟ — over: "" (حسب الافتراضي) | zones | def | مفتاح شركة */
  function explain(wid, type, over) {
    const a = A(); if (!a) return null; type = type === "stop" ? "stop" : "home";
    const all = a.allDeliveryCompanies(), W = ((a.fees || []).find(x => Number(x.id) === Number(wid))) || (typeof WILAYAS !== "undefined" ? WILAYAS.find(x => Number(x.id) === Number(wid)) : null);
    if (!W) return null;
    const lines = [], zone = Number(W[type]) || 0, st = a.pricingState ? a.pricingState() : { key: "" };
    let key = "", why = "";
    if (over === "zones") why = "إعداد الصفحة أو المنتج: أسعار المناطق";
    else if (over && over !== "def" && over !== "free" && all[over]) { key = over; why = "إعداد الصفحة أو المنتج: شركة " + all[over].name; }
    else { key = st.key || ""; why = key ? "الشركة الافتراضية (" + (all[key] || {}).name + ")" : "الشركة الافتراضية بلا أسعار محفوظة ⟵ تُعتمد أسعار المناطق"; }
    lines.push({ t: "مصدر الحساب", v: why });
    if (!key) { lines.push({ t: "سعر المناطق للولاية", v: zone + " دج" }); return { final: zone, key: "", lines }; }
    const cfg = a.deliveryCfg[key] || {}, co = all[key] || {}, id = Number(W.id);
    const fx = a.parsePriceFix(cfg.priceFix || "")[id], bt = a.parsePriceFix(co.tariff || cfg.priceBase || "")[id], ap = (cfg.apiPrices || {})[id], cur = (cfg.prices || {})[id];
    const apiOnly = String(cfg.priceSrc || "").toLowerCase() === "api";
    const origin = fx ? "تعديل يدوي منك (تعديل أسعار ولايات)" : apiOnly ? (ap ? "حسابك لدى الشركة (جُلب " + ageTxt(cfg.apiAt) + ")" : bt ? "جدولك المحفوظ (لم يُجلب سعر هذه الولاية من حسابك)" : "الأسعار المخزَّنة") : bt ? "جدولك المحفوظ (مصدر الأسعار ليس api)" : ap ? "حسابك لدى الشركة (جُلب " + ageTxt(cfg.apiAt) + ")" : "الأسعار المخزَّنة";
    const base = cur ? Number(cur[type]) || 0 : 0;
    lines.push({ t: "سعر الولاية المعتمد", v: base ? base + " دج — المصدر: " + origin : "لا سعر لهذه الولاية ⟵ تُعتمد أسعار المناطق" });
    if (ap && Number(ap[type]) !== base) lines.push({ t: "سعر حسابك الخام", v: (Number(ap[type]) || 0) + " دج (يختلف عمّا يعرضه متجرك)" });
    if (bt && fx === undefined && bt[type] !== undefined && Number(bt[type]) !== base) lines.push({ t: "جدولك المحفوظ", v: bt[type] + " دج" });
    try { const ox = (a.optionsOf(cfg) || {})[id]; if (ox && ox.length) { const c = a.cheapestOf(ox); lines.push({ t: "خيارات الناقلين لهذه الولاية", v: ox.map(x => x.b + " " + x.h + "/" + x.s).join(" — ") + " ⟵ المعتمد الأرخص: منزل " + c.home + " ومكتب " + c.stop }); } } catch (e) { }
    const adj = Number(cfg.adj) || 0;
    if (adj) lines.push({ t: "تعديل السعر المعروض", v: "- " + adj + " دج (يُخصم من سعر الشركة؛ يتخطّاه إن كان تعديل البلدية فعّالاً)" });
    lines.push({ t: "سعر المناطق للمقارنة", v: zone + " دج" });
    const fin = base ? Math.max(0, base - adj) : zone;
    return { final: fin, key, lines };
  }

  /* ── خيارات الناقلين داخل شركة واحدة (WeCan: ZR وWeCanServices…) ── */
  /* لا مسارات خيارات معروفة: اكتشاف 1.89.1223/1225 على WeCan أعاد 404 لكل المسارات المخمَّنة؛ و/fees عامة لا تطابق العقد. يُترك الاكتشاف معطَّلاً (PROBE فارغ) ويُدخل المتجر جدوله يدوياً (خيارات الشحن/تعديل أسعار ولايات أو الاستيراد أدناه) */
  const PROBE = {};
  const num = v => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; };
  const NAMEK = ["carrier_name", "carrier", "provider_name", "provider", "company", "name", "label", "title"];
  const brandOf = o => { for (const k of NAMEK) { const v = o[k]; if (typeof v === "string" && v.trim() && v.length < 40) return v.trim(); if (v && typeof v === "object" && typeof v.name === "string") return v.name.trim(); } return ""; };
  const modeNum = a => { if (!a.length) return 0; const c = {}; a.forEach(x => { c[x] = (c[x] || 0) + 1; }); return Number(Object.keys(c).sort((x, y) => c[y] - c[x] || x - y)[0]); };
  /* يستخرج [{b,h,s}] من ردّ JSON مجهول البنية: (1) حقول <ناقل>_home/_desk داخل per_commune، (2) مصفوفة كائنات لكل ناقل، (3) خريطة ناقل ← {home,desk} */
  function extractOptions(json) {
    const by = {}, add = (b, kind, v) => { b = String(b || "").trim(); if (!b || !(v > 0)) return; const o = by[b] || (by[b] = { b, h: 0, s: 0 }); if (kind === "h") o.h = o.h || v; else o.s = o.s || v; };
    const kindOf = k => { k = String(k).toLowerCase(); if (/(^|_)(home|domicile)($|_)/.test(k)) return "h"; if (/(desk|stop|bureau|retrait|pickup|relay)/.test(k)) return "s"; return ""; };
    const comm = []; (function walk(o, d) { if (!o || typeof o !== "object" || d > 6) return; if (o.per_commune && typeof o.per_commune === "object") Object.values(o.per_commune).forEach(c => comm.push(c)); Object.values(o).forEach(v => walk(v, d + 1)); })(json, 0);
    if (comm.length) { const cols = {}; comm.forEach(c => Object.keys(c || {}).forEach(k => { const m = /^(.+?)_(home|domicile|desk|stopdesk|stop_desk|bureau)$/i.exec(k); if (m && typeof c[k] !== "object") { const b = m[1], kd = kindOf(m[2]); (cols[b] = cols[b] || { h: [], s: [] })[kd].push(num(c[k])); } })); Object.keys(cols).forEach(b => { add(b.replace(/^express$/i, "Express"), "h", modeNum(cols[b].h.filter(x => x > 0))); add(b.replace(/^express$/i, "Express"), "s", modeNum(cols[b].s.filter(x => x > 0))); }); }
    (function walk(o, d) {
      if (!o || typeof o !== "object" || d > 6) return;
      if (Array.isArray(o)) { o.forEach(e => { if (e && typeof e === "object" && !Array.isArray(e)) { const b = brandOf(e); if (b) { let any = false; Object.keys(e).forEach(k => { const kd = kindOf(k); if (kd && typeof e[k] !== "object" && num(e[k]) > 0 && !/^(has|is|allow)/i.test(k)) { add(b, kd, num(e[k])); any = true; } }); const t = String(e.type || e.shipping_type || e.mode || e.delivery_type || "").toLowerCase(), pv = num(e.price != null ? e.price : e.fee != null ? e.fee : e.amount != null ? e.amount : e.cost != null ? e.cost : e.tariff != null ? e.tariff : e.tarif); if (!any && t && pv > 0) add(b, /home|domicile/.test(t) ? "h" : "s", pv); } } walk(e, d + 1); }); return; }
      Object.keys(o).forEach(k => { const v = o[k]; if (v && typeof v === "object" && !Array.isArray(v)) { const hk = Object.keys(v).find(x => kindOf(x) === "h" && typeof v[x] !== "object" && num(v[x]) > 0), sk = Object.keys(v).find(x => kindOf(x) === "s" && typeof v[x] !== "object" && num(v[x]) > 0); if ((hk || sk) && !/^(per_commune|data|fees|tarifs?)$/i.test(k) && !/^\d+$/.test(k)) { add(k, "h", hk ? num(v[hk]) : 0); add(k, "s", sk ? num(v[sk]) : 0); } } walk(v, d + 1); });
    })(json, 0);
    return Object.keys(by).map(k => by[k]).filter(x => x.h > 0 || x.s > 0);
  }
  const fromId = (a, co, cfg) => { try { const nn = x => a.normName(x), fw = (typeof WILAYAS !== "undefined" ? WILAYAS : []).find(w => !w.par && nn(w.name) === nn(co.fromName ? co.fromName(cfg) : "Alger")); return fw ? fw.id : 16; } catch (e) { return 16; } };
  const pathReq = (a, co, cfg, path, from, to) => ({ url: co.baseOf(cfg) + path + (path === "/carriers" ? "" : "?from_wilaya_id=" + from + "&to_wilaya_id=" + to), method: "GET", headers: co.hdr(cfg) });
  /* اكتشاف: يجرّب مسارات محتملة لولاية عيّنة، يحفظ ما رجع (بلا مفاتيح) في إعدادات المتجر الخاصة للتشخيص، وإن وجد خيارات يملأ بقية الولايات */
  async function discover(key, opts) {
    const a = A(); if (!a || S.running["opt" + key]) return null; const co = (a.allDeliveryCompanies() || {})[key], cfg = a.deliveryCfg[key] || {}, paths = PROBE[key];
    if (!co || !paths || !co.baseOf || !co.hdr || !hasCreds(cfg)) return null; S.running["opt" + key] = 1;
    const from = fromId(a, co, cfg), sampleTo = (opts && opts.to) || 30, doc = { v: 2, at: Date.now(), key, from, cfgFrom: String(cfg.fromWilayaName || ""), to: sampleTo, results: [] }; let found = null;
    try {
      for (const path of paths) {
        let r; try { r = await a.courierFetch(pathReq(a, co, cfg, path, from, sampleTo)); } catch (e) { doc.results.push({ p: path, err: String(e.message || e).slice(0, 80) }); continue; }
        const row = { p: path, st: r.status, len: String(r.text || "").length }; let j = null; try { j = JSON.parse(r.text); } catch (e) { }
        if (j) { row.sample = String(r.text).replace(/\s+/g, " ").slice(0, 1400); const ex = extractOptions(j); row.opts = ex.length; if (ex.length > 1 && !found) found = { path, list: ex }; } else row.sample = String(r.text || "").slice(0, 120);
        doc.results.push(row); await new Promise(res => setTimeout(res, 200));
      }
      try { doc.matrix = await matrix(key); } catch (e) { doc.matrixErr = String(e.message || e).slice(0, 80); }
      const cur = Object.assign({}, a.deliveryCfg[key] || cfg, { optProbeAt: Date.now(), optProbeV: 2 });
      if (found) {
        doc.found = { path: found.path, sample: found.list };
        const options = Object.assign({}, cur.options || {}); options[sampleTo] = found.list;
        for (let to = 1; to <= 58; to++) { if (to === sampleTo) continue; try { const r = await a.courierFetch(pathReq(a, co, cfg, found.path, from, to)); const ex = extractOptions(JSON.parse(r.text)); if (ex.length) options[to] = ex; } catch (e) { } await new Promise(res => setTimeout(res, 220)); }
        cur.options = options; cur.optionsAt = Date.now();
      }
      a.deliveryCfg[key] = cur;
      const prices = a.applyPriceFix(cur.prices || {}, cur, key); a.deliveryCfg[key].prices = prices; a.saveDeliveryCfgToStorage();
      try { if (typeof Priv !== "undefined" && Priv.set) await Priv.set("delprobe", doc); } catch (e) { }
      try { a.publishShipCo(); } catch (e) { }
    } catch (e) { console.warn("delhealth discover", e); }
    S.running["opt" + key] = 0; render(); return doc;
  }
  /* مصفوفة تشخيص (v2): تعريفة /fees لعدة ولايات وجهة من عدة ولايات انطلاق شائعة، مضغوطة (كل حقل <ناقل>_home/_desk بنمط البلديات)، لمقارنتها بنموذج الشركة الفعلي ومعرفة أي ولاية انطلاق وأي حقل يطابق كل ناقل */
  const MATRIX_FROM = [16, 35, 9, 31, 19, 25], MATRIX_TO = [21, 30, 8, 16, 5, 31];
  async function matrix(key) {
    const a = A(), co = (a.allDeliveryCompanies() || {})[key], cfg = a.deliveryCfg[key] || {}, out = [];
    for (const f of MATRIX_FROM) for (const t of MATRIX_TO) {
      let r; try { r = await a.courierFetch(pathReq(a, co, cfg, "/fees", f, t)); } catch (e) { out.push({ f, t, err: String(e.message || e).slice(0, 60) }); continue; }
      let j = null; try { j = JSON.parse(r.text); } catch (e) { }
      if (!j) { out.push({ f, t, st: r.status }); continue; }
      const pc = j.per_commune && typeof j.per_commune === "object" ? Object.values(j.per_commune) : [], cols = {};
      pc.forEach(c => Object.keys(c || {}).forEach(k => { if (/_(home|desk)$/i.test(k)) (cols[k] = cols[k] || []).push(num(c[k])); }));
      const row = { f, t, from: j.from_wilaya_name, n: pc.length, zone: j.zone, ret: j.retour_fee };
      Object.keys(cols).forEach(k => { row[k] = modeNum(cols[k].filter(x => x > 0)) + (cols[k].some(x => x === 0) ? "*" : ""); });
      out.push(row); await new Promise(res => setTimeout(res, 200));
    }
    return out;
  }
  const optCount = cfg => Object.keys(((typeof Admin !== "undefined" && Admin.optionsOf) ? Admin.optionsOf(cfg) : {}) || {}).length;

  /* استيراد جدول أسعار ملصوق: أسطر «رقم الولاية منزل مكتب» (أو اسم الولاية بدل الرقم) بأي فواصل؛ يُدمج في «تعديل أسعار ولايات» فوق ما كان */
  function parseGrid(txt) {
    const a = A(), out = {}; const W = (typeof WILAYAS !== "undefined" ? WILAYAS : []).filter(w => !w.par), byName = {}; W.forEach(w => { byName[a.normName(w.name)] = w.id; });
    String(txt || "").split(/\n+/).forEach(line => {
      const nums = (line.match(/\d+/g) || []).map(Number); let id = 0, rest = nums.slice();
      const nm = a.normName(line.replace(/[0-9=:\/|,،;؛\-–—]+/g, " ")), hit = Object.keys(byName).find(k => k && nm.indexOf(k) >= 0);
      if (nums.length && nums[0] >= 1 && nums[0] <= 58 && (nums.length >= 3 || (nums.length === 2 && nums[1] >= 100))) { id = nums[0]; rest = nums.slice(1); } else if (hit) { id = byName[hit]; rest = nums.filter(n => n >= 100 || n === 0); }
      const pr = rest.filter(n => n >= 100 && n <= 9999); if (id && pr.length >= 1) out[id] = { h: pr[0], s: pr[1] || pr[0] };
    });
    return out;
  }
  const nrm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  /* الرسم الذي فوترته الشركة فعلاً على الطرود المسلَّمة (fin.fee) مقابل سعر الولاية المعتمد: ولاية+نوع يتكرر فيها الرسم نفسه في طردين فأكثر ويخالف الجدول */
  function invoice(key) {
    const a = A(); if (!a || !a.orderCoKey || !a.wCo) return []; const cfg = a.deliveryCfg[key] || {}, by = {};
    (a.orders || []).forEach(o => {
      try {
        const r = (a.shipRaw || {})[o.id], f = r && r.fin; if (!f || f.free || !(Number(f.fee) > 0)) return;
        const rw = nrm(r.raw); if (!/^(livr|delivered)/.test(rw) || /partial|partiel/.test(rw)) return;
        if (a.orderCoKey(o) !== key) return;
        const w = a.wCo(o.wilaya); if (!w) return; const type = o.dtype === "stop" ? "stop" : "home", p = (cfg.prices || {})[w.id]; if (!p) return;
        const exp = Number(type === "stop" && p.stop > 0 ? p.stop : p.home) || 0; if (!exp) return;
        const g = by[w.id + "|" + type] || (by[w.id + "|" + type] = { id: w.id, type, exp, fees: [] }); g.fees.push(Math.round(Number(f.fee)));
      } catch (e) { }
    });
    const out = []; Object.keys(by).forEach(k => { const g = by[k], real = modeNum(g.fees), n = g.fees.filter(x => x === real).length; if (n >= 2 && real !== g.exp) out.push({ id: g.id, type: g.type, exp: g.exp, real, n }); });
    return out.sort((x, y) => y.n - x.n || x.id - y.id);
  }
  function savePriceFix(key, merged) {
    const a = A(), cfg = a.deliveryCfg[key], fix = Object.keys(merged).sort((x, y) => x - y).map(k => k + "=" + merged[k].h + "/" + merged[k].s).join(", ");
    const c2 = Object.assign({}, cfg, { priceFix: fix }); a.deliveryCfg[key] = Object.assign({}, c2, { prices: a.applyPriceFix(c2.prices || {}, c2, key) });
    a.saveDeliveryCfgToStorage(); try { a.publishShipCo(); } catch (e) { } try { a.renderDelivery(); } catch (e) { }
    return fix;
  }
  const curFix = (a, cfg) => { const cur = a.parsePriceFix(cfg.priceFix || ""), m = {}; Object.keys(cur).forEach(k => { m[k] = { h: cur[k].home, s: cur[k].stop }; }); return m; };
  /* اعتماد أسعار الفواتير: يضيف الرسم الفعلي إلى «تعديل أسعار ولايات» (يبقى النوع الآخر كما هو) */
  function applyInvoice(key) {
    const a = A(), cfg = a && a.deliveryCfg[key]; if (!cfg) return 0; const d = invoice(key); if (!d.length) return 0; const m = curFix(a, cfg);
    d.forEach(x => { const p = (cfg.prices || {})[x.id] || {}, e = m[x.id] || { h: Number(p.home) || 0, s: Number(p.stop) || 0 }; if (x.type === "stop") e.s = x.real; else e.h = x.real; if (!e.s) e.s = e.h; if (!e.h) e.h = e.s; m[x.id] = e; });
    savePriceFix(key, m); return d.length;
  }
  function ignoreInvoice(key) { const a = A(), cfg = a && a.deliveryCfg[key]; if (!cfg) return false; a.deliveryCfg[key] = Object.assign({}, cfg, { invIgnore: JSON.stringify(invoice(key).map(x => [x.id, x.type, x.real])) }); a.saveDeliveryCfgToStorage(); render(); return true; }
  function importGrid(key, txt) {
    const a = A(), cfg = a && a.deliveryCfg[key]; if (!cfg) return { n: 0 };
    const g = parseGrid(txt), ids = Object.keys(g); if (!ids.length) return { n: 0 };
    const m = curFix(a, cfg); ids.forEach(k => { m[k] = { h: g[k].h, s: g[k].s }; });
    return { n: ids.length, fix: savePriceFix(key, m) };
  }
  const LV = { ok: ["ok", "سليم"], warn: ["w", "يحتاج انتباهاً"], bad: ["r", "مشكلة"] };
  function css() {
    if (document.getElementById("dh-css")) return; const st = document.createElement("style"); st.id = "dh-css";
    st.textContent = "#dlv-health .dh-r{display:flex;gap:.6rem;align-items:flex-start;flex-wrap:wrap;padding:.55rem 0;border-top:1px solid var(--line)}#dlv-health .dh-r:first-of-type{border-top:0}#dlv-health .dh-n{min-width:140px;font-weight:800}#dlv-health .dh-m{flex:1;min-width:220px;font-size:.86rem;line-height:1.7}#dlv-health .dh-c{display:inline-block;padding:.05rem .5rem;border-radius:99px;font-size:.72rem;font-weight:800;margin-inline-start:.3rem;border:1px solid transparent}#dlv-health .dh-c.ok{color:var(--blue);background:color-mix(in srgb,var(--blue) 14%,transparent);border-color:color-mix(in srgb,var(--blue) 35%,transparent)}#dlv-health .dh-c.w{color:var(--g-amber,#b45309);background:rgba(var(--g-amber-rgb,180,83,9),.16);border-color:rgba(var(--g-amber-rgb,180,83,9),.4)}#dlv-health .dh-c.r{color:var(--red);background:color-mix(in srgb,var(--red) 14%,transparent);border-color:color-mix(in srgb,var(--red) 38%,transparent)}#dlv-health .dh-i{color:var(--red)}#dlv-health .dh-i.w{color:var(--g-amber,#b45309)}#dlv-health .dh-i.n{color:inherit;opacity:.85}#dlv-health .dh-x{border-top:1px dashed var(--line);margin-top:.5rem;padding-top:.5rem}#dlv-health .dh-x select{max-width:100%;margin:.15rem}#dlv-health .dh-o{margin:.4rem 0;padding:.5rem .7rem;border-radius:12px;background:rgba(127,127,127,.1);font-size:.86rem;line-height:1.8}";
    document.head.appendChild(st);
  }
  function explainHtml() {
    const a = A(), W = (a.fees || []).slice().sort((x, y) => x.id - y.id), all = a.allDeliveryCompanies(), en = a.enabledCompanyKeys();
    return '<div class="dh-x"><b>لماذا هذا السعر؟</b> <small class="hint">اختر ولاية ونوع التوصيل ومصدر الحساب فيُريك من أين جاء السعر</small><br>' +
      '<select id="dh-w">' + W.filter(w => !w.par).map(w => '<option value="' + w.id + '">' + w.id + " — " + esc(w.name) + "</option>").join("") + "</select>" +
      '<select id="dh-t"><option value="home">توصيل للمنزل</option><option value="stop">مكتب Stop Desk</option></select>' +
      '<select id="dh-o"><option value="">الشركة الافتراضية للمتجر</option><option value="zones">أسعار المناطق (إعداد صفحة/منتج)</option>' + en.filter(k => all[k] && all[k].feesRequest).map(k => '<option value="' + k + '">شركة ' + esc(all[k].name) + "</option>").join("") + "</select>" +
      '<button class="small gray" type="button" data-dh="why">اشرح</button><div id="dh-out"></div></div>';
  }
  function render() {
    const a = A(), tab = document.getElementById("tab-delivery"); if (!a || !tab) return; css();
    let box = document.getElementById("dlv-health"); if (!box) { box = document.createElement("div"); box.id = "dlv-health"; box.className = "card"; const first = tab.querySelector(".card"); if (first && first.nextSibling) tab.insertBefore(box, first.nextSibling); else tab.appendChild(box); }
    const R = rows(), keepX = document.getElementById("dh-w") ? { w: document.getElementById("dh-w").value, t: document.getElementById("dh-t").value, o: document.getElementById("dh-o").value, out: document.getElementById("dh-out").innerHTML } : null;
    box.innerHTML = '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:center;flex-wrap:wrap"><b style="color:var(--green)">صحة التوصيل</b><span class="hint" style="margin:0">يفحص النظام أسعار شركاتك تلقائياً كل أسبوع عند فتح اللوحة وينبّهك إن اختلف حسابك عمّا يعرضه متجرك</span></div>' +
      (R.length ? R.map(r => '<div class="dh-r" data-k="' + esc(r.key) + '"><div class="dh-n">' + esc(r.name) + (r.def ? ' <small>(الافتراضية)</small>' : "") + '<span class="dh-c ' + LV[r.level][0] + '">' + LV[r.level][1] + '</span></div><div class="dh-m">' +
        "الأسعار: " + r.nP + " ولاية — المصدر: " + esc(r.src) + " — آخر فحص: " + esc(ageTxt(r.last)) + (r.desks >= 0 ? " — مكاتب Stop Desk المحمَّلة: " + r.desks : "") + (r.nO ? " — خيارات الناقلين: " + r.nO + " ولاية (" + (r.toStore ? "يُعتمد الأرخص في المتجر" : "تظهر في الطلب اليدوي فقط، والمتجر لا يتأثر") + ")" : "") +
        r.issues.map(i => '<br><span class="dh-i ' + (i.k === "warn" ? "w" : i.k === "info" ? "n" : "") + '">' + esc(i.t) + "</span>").join("") +
        '</div><div>' + (r.canCheck ? '<button class="small gray" type="button" data-dh="check" data-k="' + esc(r.key) + '">فحص الآن</button> ' : "") +
        (r.canProbe ? '<button class="small gray" type="button" data-dh="opts" data-k="' + esc(r.key) + '">اكتشاف خيارات الناقلين</button> ' : "") +
        (r.issues.some(i => i.act === "approve") ? '<button class="small gold" type="button" data-dh="approve" data-k="' + esc(r.key) + '">اعتمد أسعار حسابك</button> <button class="small gray" type="button" data-dh="ignore" data-k="' + esc(r.key) + '">تجاهل</button> ' : "") +
        (r.issues.some(i => i.act === "invoice") ? '<button class="small gold" type="button" data-dh="invoice" data-k="' + esc(r.key) + '">اعتمد أسعار الفواتير</button> <button class="small gray" type="button" data-dh="invignore" data-k="' + esc(r.key) + '">تجاهل</button> ' : "") +
        (r.issues.some(i => i.act === "desks") ? '<button class="small gray" type="button" data-dh="desks" data-k="' + esc(r.key) + '">حمّل المكاتب</button>' : "") + "</div>" + (r.generic ? '<div style="flex-basis:100%"><textarea id="dh-g-' + esc(r.key) + '" rows="3" placeholder="ألصق جدول الأسعار: سطر لكل ولاية «رقم الولاية  منزل  مكتب» مثل: 21 650 450" style="width:100%"></textarea><button class="small gold" type="button" data-dh="grid" data-k="' + esc(r.key) + '">استيراد الأسعار</button> <span class="hint" id="dh-gm-' + esc(r.key) + '" style="margin:0"></span></div>' : "") + "</div>").join("") : '<p class="hint">لا شركة توصيل مفعّلة بعد.</p>') + explainHtml();
    if (keepX) { document.getElementById("dh-w").value = keepX.w; document.getElementById("dh-t").value = keepX.t; document.getElementById("dh-o").value = keepX.o; document.getElementById("dh-out").innerHTML = keepX.out; }
    if (!box._bound) {
      box._bound = true;
      box.addEventListener("click", async ev => {
        const b = ev.target.closest("[data-dh]"); if (!b) return; const act = b.getAttribute("data-dh"), k = b.getAttribute("data-k");
        if (act === "check") { b.disabled = true; b.textContent = "جارٍ الفحص…"; await check(k); }
        else if (act === "approve") { if (window.confirm("اعتماد أسعار حسابك لهذه الشركة؟ ستُطبَّق على متجرك فوراً وتنتهي أولويّة جدولك المحفوظ لها.")) { approve(k); render(); } }
        else if (act === "ignore") ignore(k);
        else if (act === "invoice") { const n = applyInvoice(k); if (typeof toast === "function") toast(n ? "✅ اعتُمدت أسعار الفواتير لـ" + n + " ولاية/نوع" : "لا فروق"); render(); }
        else if (act === "invignore") ignoreInvoice(k);
        else if (act === "grid") { const ta = document.getElementById("dh-g-" + k), r = importGrid(k, ta ? ta.value : ""), m = document.getElementById("dh-gm-" + k); if (m) m.textContent = r.n ? "✅ استُوردت أسعار " + r.n + " ولاية" : "لم أجد أسطراً بصيغة «رقم الولاية منزل مكتب»"; if (r.n) { ta.value = ""; if (typeof toast === "function") toast("✅ استُوردت أسعار " + r.n + " ولاية"); } }
        else if (act === "opts") { b.disabled = true; b.textContent = "جارٍ الاكتشاف…"; await discover(k); }
        else if (act === "desks") { try { await a.syncDesksFromCompany(k); } catch (e) { } render(); }
        else if (act === "why") { const r = explain($("dh-w").value, $("dh-t").value, $("dh-o").value), out = $("dh-out"); out.innerHTML = r ? '<div class="dh-o"><b>السعر النهائي: ' + r.final + " دج</b><br>" + r.lines.map(l => esc(l.t) + ": " + esc(l.v)).join("<br>") + "</div>" : ""; }
      });
    }
    function $(id) { return document.getElementById(id); }
  }

  /* فحص تلقائي: كل 7 أيام لكل شركة بمفاتيح تجلب أسعارها، متتابعاً وفي الخلفية؛ ثم تنبيه واحد في الجلسة إن وُجدت مشكلة */
  async function autoCheck() {
    const a = A(); if (!a || !a.enabledCompanyKeys) return 0; let n = 0;
    try {
      const all = a.allDeliveryCompanies();
      for (const k of a.enabledCompanyKeys()) { const co = all[k], cfg = a.deliveryCfg[k] || {}; if (!co || !co.feesRequest || co.feesGeneric || !hasCreds(cfg)) continue; if (cfg.checkedAt && Date.now() - cfg.checkedAt < EVERY) continue; n++; await check(k, true); }
      for (const k of a.enabledCompanyKeys()) { const cfg = a.deliveryCfg[k] || {}; if (!PROBE[k] || !hasCreds(cfg) || cfg.optionsFix) continue; if (cfg.optProbeV === 2 && cfg.optProbeAt && Date.now() - cfg.optProbeAt < 14 * DAY) continue; n++; await discover(k); }      /* اكتشاف خيارات الناقلين مرة كل 14 يوماً (لا يعمل إن كتبتَ خياراتك يدوياً) */
    } catch (e) { console.warn("delhealth auto", e); }
    notify(); return n;
  }
  function notify() {
    if (S.told) return; const bad = rows().filter(r => r.level !== "ok"); if (!bad.length) return; S.told = true;
    if (typeof toast === "function") toast("⚠️ صحة التوصيل: " + bad.map(r => r.name).join("، ") + " تحتاج انتباهك — افتح «شركات التوصيل»");
  }
  function boot() {
    const a = A(); if (!a || a.__dh) return; a.__dh = 1;
    const o = a.renderDelivery; if (typeof o === "function") a.renderDelivery = function () { const r = o.apply(this, arguments); try { render(); } catch (e) { console.warn("delhealth", e); } return r; };
    S.timer = setTimeout(autoCheck, 30000);
  }
  const t0 = setInterval(() => { if (typeof Admin !== "undefined" && Admin.renderDelivery) { clearInterval(t0); boot(); } }, 400);
  return { rows, attention, check, approve, ignore, explain, render, autoCheck, notify, discover, extractOptions, parseGrid, importGrid, invoice, applyInvoice, ignoreInvoice, PROBE, _S: S };
})();
