/* إعدادات الموقع + التنقل بين المواقع (لوحات التحكم).
   - assets/data/store.json (عام): الاسم، الاتصال، الدومين، اللغة والتوقيت، العملة، وضع الصيانة — يطبّقه الموقع عبر applyStore في app.js.
   - قائمة «مواقعي» تُحفظ في هذا المتصفح (alyssum_stores) وتتزامن بين أجهزتك: كل موقع له لوحة تحكم على عنوانه نفسه. */
const AdminStores = (() => {
  const PATH = "assets/data/store.json", LOCAL = "alyssum_store_cfg", LSK = "alyssum_stores", $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SITE = () => (typeof CONFIG !== "undefined" && CONFIG.SITE) || {};
  const PLATFORM = () => (typeof CONFIG !== "undefined" && CONFIG.PLATFORM_DOMAIN) || "alyssumdz.com";
  /* ── قوائم مرجعية (من ذاكرة المتصفح نفسها: كل الدول والعملات والمناطق الزمنية) ── */
  const CC = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");
  /* اقتراحات تلقائية عند اختيار الدولة: العملة والمنطقة الزمنية (يمكن تعديلهما بعدها) */
  const CSUG = { DZ: ["DZD", "Africa/Algiers", "دج"], MA: ["MAD", "Africa/Casablanca", "د.م."], TN: ["TND", "Africa/Tunis", "د.ت"], LY: ["LYD", "Africa/Tripoli", "د.ل"], EG: ["EGP", "Africa/Cairo", "ج.م"], MR: ["MRU", "Africa/Nouakchott", "أوقية"], SA: ["SAR", "Asia/Riyadh", "ر.س"], AE: ["AED", "Asia/Dubai", "د.إ"], QA: ["QAR", "Asia/Qatar", "ر.ق"], KW: ["KWD", "Asia/Kuwait", "د.ك"], BH: ["BHD", "Asia/Bahrain", "د.ب"], OM: ["OMR", "Asia/Muscat", "ر.ع"], IQ: ["IQD", "Asia/Baghdad", "د.ع"], JO: ["JOD", "Asia/Amman", "د.أ"], LB: ["LBP", "Asia/Beirut", "ل.ل"], SY: ["SYP", "Asia/Damascus", "ل.س"], PS: ["ILS", "Asia/Hebron", "₪"], YE: ["YER", "Asia/Aden", "ر.ي"], SD: ["SDG", "Africa/Khartoum", "ج.س"], FR: ["EUR", "Europe/Paris", "€"], ES: ["EUR", "Europe/Madrid", "€"], IT: ["EUR", "Europe/Rome", "€"], DE: ["EUR", "Europe/Berlin", "€"], BE: ["EUR", "Europe/Brussels", "€"], NL: ["EUR", "Europe/Amsterdam", "€"], PT: ["EUR", "Europe/Lisbon", "€"], GB: ["GBP", "Europe/London", "£"], CH: ["CHF", "Europe/Zurich", "CHF"], TR: ["TRY", "Europe/Istanbul", "₺"], CA: ["CAD", "America/Toronto", "$"], US: ["USD", "America/New_York", "$"], SN: ["XOF", "Africa/Dakar", "FCFA"], CI: ["XOF", "Africa/Abidjan", "FCFA"], ML: ["XOF", "Africa/Bamako", "FCFA"] };
  /* الأسماء العربية المألوفة للمناطق الشائعة */
  const TZAR = { "Africa/Algiers": "الجزائر", "Africa/Tunis": "تونس", "Africa/Casablanca": "الدار البيضاء (المغرب)", "Africa/Tripoli": "طرابلس (ليبيا)", "Africa/Cairo": "القاهرة", "Africa/Nouakchott": "نواكشوط", "Asia/Riyadh": "الرياض", "Asia/Dubai": "دبي", "Asia/Qatar": "الدوحة", "Asia/Kuwait": "الكويت", "Asia/Baghdad": "بغداد", "Asia/Amman": "عمّان", "Asia/Beirut": "بيروت", "Europe/Paris": "باريس", "Europe/Madrid": "مدريد", "Europe/London": "لندن", "Europe/Istanbul": "إسطنبول", "America/Montreal": "مونتريال", "America/New_York": "نيويورك", "UTC": "التوقيت العالمي" };
  const LANGS = [["ar", "العربية"], ["fr", "Français"], ["en", "English"], ["es", "Español"], ["de", "Deutsch"], ["tr", "Türkçe"]];
  const TLDS = ["com", "net", "org", "shop", "store", "online", "site", "info", "fr", "pro", "xyz", "app", "tech", "club", "dz", "com.dz", "ma", "tn", "co", "io"];
  const dn = (type, code) => { try { return new Intl.DisplayNames(["ar"], { type }).of(code) || code; } catch (e) { return code; } };
  let _tzl = null;
  function tzList() {
    if (_tzl) return _tzl;
    let ids = []; try { ids = Intl.supportedValuesOf("timeZone"); } catch (e) { ids = Object.keys(TZAR); }
    const off = z => { try { const p = new Intl.DateTimeFormat("en", { timeZone: z, timeZoneName: "longOffset" }).formatToParts(new Date()).find(x => x.type === "timeZoneName"); const v = (p && p.value) || "GMT"; return v === "GMT" ? "GMT+00:00" : v; } catch (e) { return "GMT"; } };
    const val = o => { const m = /GMT([+-])(\d\d):(\d\d)/.exec(o); return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0; };
    if (ids.indexOf("UTC") < 0) ids.push("UTC");
    _tzl = ids.map(z => { const o = off(z); return { id: z, o, v: val(o), l: "(" + o + ") " + (TZAR[z] ? TZAR[z] + " — " : "") + z.replace(/_/g, " ") }; }).sort((x, y) => x.v - y.v || x.id.localeCompare(y.id));
    return _tzl;
  }
  function tzOpts(cur) {
    const L = tzList(), common = Object.keys(TZAR).map(z => L.find(x => x.id === z)).filter(Boolean), one = x => '<option value="' + esc(x.id) + '"' + (x.id === cur ? " selected" : "") + '>' + esc(x.l) + '</option>';
    return '<optgroup label="الأكثر استعمالاً">' + common.map(one).join("") + '</optgroup><optgroup label="كل المناطق الزمنية">' + L.map(one).join("") + '</optgroup>';
  }
  let _cl = null;
  function curList() {
    if (_cl) return _cl;
    let codes = []; try { codes = Intl.supportedValuesOf("currency"); } catch (e) { codes = ["DZD", "EUR", "USD", "MAD", "TND", "SAR", "AED", "GBP"]; }
    _cl = codes.map(c => ({ c, n: dn("currency", c) })).sort((a, b) => a.n.localeCompare(b.n, "ar"));
    return _cl;
  }
  function curSym(code) { if (code === "DZD") return "دج"; for (const k in CSUG) if (CSUG[k][0] === code) return CSUG[k][2]; try { const p = new Intl.NumberFormat("ar", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(1).find(x => x.type === "currency"); return (p && p.value) || code; } catch (e) { return code; } }
  function curOpts(cur) { return curList().map(x => '<option value="' + x.c + '"' + (x.c === cur ? " selected" : "") + '>' + esc(x.c + " — " + x.n) + '</option>').join(""); }
  function countryOpts(cur) { const L = CC.map(c => ({ c, n: dn("region", c) })).sort((a, b) => a.n.localeCompare(b.n, "ar")); return '<option value="">— اختر الدولة —</option>' + L.map(x => '<option value="' + x.c + '"' + (x.c === cur ? " selected" : "") + '>' + esc(x.n) + '</option>').join(""); }
  /* حسابات التواصل المهمة: يكتب البائع اسم الحساب أو رابطه فيُحفظ رابطاً كاملاً */
  const ACCTS = [["instagram", "انستغرام", "username"], ["facebook", "فيسبوك", "اسم الصفحة"], ["tiktok", "تيك توك", "username"], ["youtube", "يوتيوب", "اسم القناة"], ["telegram", "تيليغرام", "username"], ["x", "إكس (تويتر)", "username"], ["snapchat", "سناب شات", "username"], ["linkedin", "لينكدإن", "اسم الصفحة"], ["pinterest", "بنترست", "username"], ["threads", "ثريدز", "username"]];
  const ABASE = { instagram: "https://instagram.com/", facebook: "https://facebook.com/", tiktok: "https://www.tiktok.com/@", youtube: "https://www.youtube.com/@", telegram: "https://t.me/", x: "https://x.com/", snapchat: "https://www.snapchat.com/add/", linkedin: "https://www.linkedin.com/company/", pinterest: "https://www.pinterest.com/", threads: "https://www.threads.net/@" };
  function acctUrl(id, v) { v = String(v || "").trim(); if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) return "https://" + v; return (ABASE[id] || "https://") + v.replace(/^@/, ""); }
  const handleOf = u => { try { return decodeURIComponent(new URL(u).pathname.split("/").filter(Boolean).pop() || "").replace(/^@/, ""); } catch (e) { return ""; } };
  const defaults = () => ({ name: SITE().name || "", tagline: "", email: "", phone: "", wa: SITE().waNumber || "", instagram: SITE().instagram || "", social: {}, address: "", country: "DZ", lang: "ar", tz: "Africa/Algiers", dateFmt: "DD/MM/YYYY", timeFmt: "24", weekStart: "sat", currency: "دج", currencyCode: "DZD", maintenance: false, maintMsg: "", deletion: null, domain: { mode: "own", value: SITE().domain || "", status: "", at: "", requests: [] } });
  const S = { d: defaults(), sha: null, loaded: false, localOnly: false, err: "", clock: 0 };
  const dec = raw => JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\s/g, "")))));
  const enc = v => btoa(unescape(encodeURIComponent(JSON.stringify(v, null, 2))));
  const norm = x => { const d = defaults(), o = x && typeof x === "object" ? x : {}; const r = Object.assign(d, o); r.social = Object.assign({}, o.social || {}); if (r.instagram && !r.social.instagram) r.social.instagram = acctUrl("instagram", r.instagram); r.domain = Object.assign(defaults().domain, o.domain || {}); if (!Array.isArray(r.domain.requests)) r.domain.requests = []; return r; };
  const canRemote = () => (typeof PHPAPI !== "undefined" && PHPAPI.on && PHPAPI.on()) || (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token);
  const toast = m => (typeof window.toast === "function" ? window.toast(m) : null);

  /* ── قائمة المواقع ── */
  function stores() { try { const a = JSON.parse(localStorage.getItem(LSK) || "[]"); return Array.isArray(a) ? a.filter(s => s && s.url) : []; } catch (e) { return []; } }
  function saveStores(a) { try { localStorage.setItem(LSK, JSON.stringify(a)); } catch (e) { } }
  function adminUrl(raw) {
    let u = String(raw || "").trim(); if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { const x = new URL(u); if (!/\/admin\.html$/i.test(x.pathname)) x.pathname = x.pathname.replace(/\/+$/, "") + "/admin.html"; x.search = ""; x.hash = ""; return x.href; } catch (e) { return ""; }
  }
  const here = () => location.origin + location.pathname.replace(/[^/]*$/, "");
  const curName = () => S.d.name || SITE().name || location.hostname;
  function addStore() {
    const n = ($("stp-add-n") || {}).value.trim(), u = adminUrl(($("stp-add-u") || {}).value);
    if (!n) return toast("⚠️ أدخل اسم الموقع");
    if (!u) return toast("⚠️ أدخل عنوان الموقع (مثل: example.com)");
    const a = stores(); if (a.some(s => s.url === u)) return toast("⚠️ هذا الموقع مضاف مسبقاً");
    a.push({ id: "s" + Date.now().toString(36), name: n, url: u }); saveStores(a); renderAll(); toast("✅ أُضيف الموقع إلى قائمتك");
  }
  /* الحذف الفعلي مجدول: المنصة تحذف بيانات الموقع بعد 14 يوماً ويمكن الإلغاء قبلها */
  const DEL_DAYS = 14, DAY = 864e5;
  const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY));
  function renameStore(id) { const a = stores(), s = a.find(x => x.id === id); if (!s) return; const n = prompt("اسم الموقع في قائمتك:", s.name); if (n && n.trim()) { s.name = n.trim(); saveStores(a); renderAll(); } }
  function open(id) { const s = stores().find(x => x.id === id); if (s) location.href = s.url; }

  /* مفتاح التنقل في الشريط العلوي */
  function mountSwitch() {
    let sw = $("store-sw");
    if (!sw) { const host = $("as-btn") || $("theme-sw"); if (!host) return; sw = document.createElement("div"); sw.id = "store-sw"; sw.className = "ssw"; host.parentNode.insertBefore(sw, host); }
    const list = stores();
    sw.innerHTML = '<button type="button" class="small ssw-b" onclick="AdminStores.menu()" title="التنقل بين مواقعك">' + esc("لوحة تحكم " + curName()) + (list.length ? " ▾" : "") + '</button>' +
      '<div class="ssw-m" id="ssw-m" hidden><div class="ssw-i on">' + esc("لوحة تحكم " + curName()) + '<small>الحالي</small></div>' +
      list.map(s => '<button type="button" class="ssw-i" onclick="AdminStores.open(\'' + s.id + '\')">' + esc("لوحة تحكم " + s.name) + '<small dir="ltr">' + esc(s.url.replace(/^https?:\/\//, "").replace(/\/admin\.html$/, "")) + '</small></button>').join("") +
      '<button type="button" class="ssw-i add" onclick="AdminStores.go()">＋ إضافة موقع / إدارة مواقعي</button></div>';
  }
  function menu() { const m = $("ssw-m"); if (!m) return; if (!stores().length) return go(); m.hidden = !m.hidden; }
  function go() { const m = $("ssw-m"); if (m) m.hidden = true; const b = document.querySelector('.nav-btn[onclick*="\'store\'"]'); if (typeof Admin !== "undefined") Admin.tab("store", b); }
  document.addEventListener("click", e => { const m = $("ssw-m"); if (m && !m.hidden && !e.target.closest("#store-sw")) m.hidden = true; });

  /* ── التحميل والحفظ ── */
  async function load() {
    let remote = null;
    try { const r = await fetch(PATH + "?t=" + Date.now(), { cache: "no-store" }); if (r.ok) remote = await r.json(); } catch (e) { }
    if (canRemote() && typeof GH !== "undefined") { try { const f = await GH.getFile(PATH); S.sha = f.sha; remote = dec(f.content); } catch (e) { } }
    let loc = null; try { loc = JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch (e) { }
    S.d = norm(loc && (!remote || String(loc.updatedAt || "") > String(remote.updatedAt || "")) ? loc : remote);
    S.localOnly = !remote && !!loc; S.loaded = true; window.STORE_ADMIN = S.d;
    syncTitle(); mountSwitch(); renderAll();
  }
  async function save() {
    collect(); const d = S.d; d.updatedAt = new Date().toISOString();
    try { localStorage.setItem(LOCAL, JSON.stringify(d)); } catch (e) { }
    if (!canRemote()) { S.localOnly = true; toast("💾 حُفظت محلياً — اربط النشر ليظهر على موقعك"); syncTitle(); return renderAll(); }
    try {
      if (typeof GH === "undefined") throw new Error("غير متاح");
      if (!S.sha) { try { S.sha = (await GH.getFile(PATH)).sha; } catch (e) { S.sha = undefined; } }
      const r = await GH.putFile(PATH, enc(d), S.sha, "إعدادات الموقع"); S.sha = (r && r.content && r.content.sha) || S.sha; S.localOnly = false; S.err = "";
      toast("✅ حُفظت إعدادات الموقع ونُشرت");
    } catch (e) { S.localOnly = true; S.err = "تعذّر النشر: " + (e.message || ""); toast("⚠️ " + S.err); }
    syncTitle(); mountSwitch(); renderAll();
  }
  function syncTitle() {
    const n = curName();
    document.querySelectorAll(".top h1,#login-box h1").forEach(h => { const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) if (/لوحة تحكم/.test(t.data)) { t.data = " لوحة تحكم " + n; break; } });
    document.title = "لوحة تحكم " + n;
  }
  function collect() {
    if (!$("stp-name")) return;
    const g = id => { const e = $(id); return e ? e.value.trim() : null; }, d = S.d, set = (k, id) => { const v = g(id); if (v !== null) d[k] = v; };
    ["name", "tagline", "email", "address", "currency", "maintMsg", "country", "lang", "tz", "dateFmt", "timeFmt", "weekStart", "currencyCode"].forEach(k => set(k, "stp-" + k));
    const ph = g("stp-phone"), wa = g("stp-wa"); d.phone = (ph || "").replace(/[^\d+]/g, ""); d.wa = (wa || "").replace(/[^\d]/g, ""); d.social = {}; ACCTS.forEach(a => { const u = acctUrl(a[0], g("stp-soc-" + a[0])); if (u) d.social[a[0]] = u; }); d.instagram = d.social.instagram ? handleOf(d.social.instagram) : "";
    d.maintenance = !!($("stp-maintenance") || {}).checked;
    const m = (document.querySelector('input[name="stp-dm"]:checked') || {}).value || "own";
    d.domain.mode = m; if (m !== "request") d.domain.value = g("stp-dv-" + m) || "";
  }
  /* ── إرسال طلب إلى الدعم (واتساب أو نسخ النص) ── */
  function notify(txt) {
    const wa = (typeof CONFIG !== "undefined" && CONFIG.SUPPORT_WA) || "";
    if (wa) window.open("https://wa.me/" + String(wa).replace(/\D/g, "") + "?text=" + encodeURIComponent(txt), "_blank", "noopener");
    else { try { navigator.clipboard.writeText(txt); } catch (e) { } toast("📋 نُسخ نص الطلب — أرسله إلى الدعم"); }
  }
  function request(kind) {
    collect(); const d = S.d, m = d.domain.mode; let txt;
    if (kind === "site") {
      const n = (($("stp-new-n") || {}).value || "").trim(); if (!n) return toast("⚠️ اكتب اسم المتجر الجديد");
      txt = "طلب موقع جديد\nاسم المتجر: " + n + "\nالدومين المطلوب: " + ((($("stp-new-d") || {}).value || "").trim() || "دومين المنصة") + "\nمن موقع: " + curName();
    } else {
      if (m === "own" && !d.domain.value) return toast("⚠️ اكتب الدومين الذي تملكه");
      if (m === "platform" && !d.domain.value) return toast("⚠️ اكتب العنوان المطلوب");
      txt = (m === "own" ? "طلب ربط دومين موجود" : "طلب عنوان على دومين المنصة") + "\nالدومين: " + (m === "platform" ? d.domain.value + "." + PLATFORM() : d.domain.value) + "\nالموقع: " + curName();
      d.domain.status = "requested"; d.domain.at = new Date().toISOString();
    }
    notify(txt); if (kind !== "site") save();
  }

  /* ── اسم الموقع على دومين المنصة: توفّر + اقتراحات ── */
  const RESERVED = ["www", "admin", "api", "app", "mail", "ftp", "shop", "store", "blog", "support", "help", "dashboard", "panel", "test", "demo", "cdn", "static", "assets", "login", "account", "alyssum", "alyssumdz", "platform"];
  let _wild = null;
  async function dohHas(host) { const r = await fetch("https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(host) + "&type=A", { headers: { accept: "application/dns-json" } }); const j = await r.json(); return j.Status === 0 && (j.Answer || []).length > 0; }
  async function subAvail(n) {
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(n)) return "bad";
    if (RESERVED.indexOf(n) >= 0) return "taken";
    if (stores().some(x => x.sub === n)) return "taken";
    try { const r = await fetch("assets/data/platform-sites.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) { const j = await r.json(); if ((j.taken || []).indexOf(n) >= 0) return "taken"; } } catch (e) { }
    try { if (_wild === null) _wild = await dohHas("zz-probe-" + Math.random().toString(36).slice(2, 8) + "." + PLATFORM()); if (!_wild && await dohHas(n + "." + PLATFORM())) return "taken"; } catch (e) { return "free?"; }
    return "free";
  }
  async function subSuggest(n) {
    const c = [n + "-dz", "my" + n, n + "-shop", "la" + n, n + "-store", n + "1", "bio-" + n, n + "-officiel"].filter(x => x.length <= 30), out = [];
    for (const x of c) { if (out.length >= 2) break; if ((await subAvail(x)) === "free") out.push(x); }
    return out;
  }
  const cleanSub = v => String(v || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]/g, "").replace(/^-+/, "").slice(0, 30);
  let _nwT = 0;
  function nwIn() {
    const e = $("stp-nw-n"); if (!e) return; const n = cleanSub(e.value); if (e.value !== n) e.value = n;
    S.nw = S.nw || {}; S.nw.n = n; const d = $("stp-nw-d"); if (d) d.textContent = (n || "name") + "." + PLATFORM();
    clearTimeout(_nwT); const r = $("stp-nw-res"); if (!n) { if (r) r.innerHTML = ""; S.nw.s = ""; return; } if (r) r.innerHTML = '<span class="stp-b mid">جارٍ التحقق…</span>';
    _nwT = setTimeout(() => nwCheck(n), 450);
  }
  async function nwCheck(n) {
    const st = await subAvail(n); if (!S.nw || S.nw.n !== n) return; S.nw.s = st; const r = $("stp-nw-res"); if (!r) return;
    if (st === "free" || st === "free?") { r.innerHTML = '<span class="stp-b ok">✔ العنوان متوفر</span>' + (st === "free?" ? ' <small>(سيؤكد الدعم توفّره عند الإنشاء)</small>' : ''); return; }
    if (st === "bad") { r.innerHTML = '<span class="stp-b mid">اكتب 3 أحرف على الأقل: حروف لاتينية وأرقام وشرطة</span>'; return; }
    r.innerHTML = '<span class="stp-b no">✖ هذا الاسم غير متوفر</span> <small>جارٍ اقتراح أسماء قريبة…</small>';
    const sug = await subSuggest(n); if (!S.nw || S.nw.n !== n) return;
    r.innerHTML = '<span class="stp-b no">✖ هذا الاسم غير متوفر</span> ' + (sug.length ? '<span style="margin-inline-start:.5rem">جرّب:</span> ' + sug.map(x => '<button type="button" class="small stp-chip" dir="ltr" onclick="AdminStores.nwPick(\'' + x + '\')">' + esc(x + "." + PLATFORM()) + '</button>').join("") : '<small>جرّب اسماً آخر</small>');
  }
  function nwPick(x) { const e = $("stp-nw-n"); if (e) { e.value = x; nwIn(); } }
  function nwOwn() { const b = $("stp-nw-own"); if (b) { b.hidden = !b.hidden; if (!b.hidden) { const i = $("stp-nw-ownv"); if (i) i.focus(); } } }
  function nwRequest() { if (!cleanSub(($("stp-nw-n") || {}).value)) return toast("⚠️ اكتب اسم الموقع أولاً"); S.nw = Object.assign(S.nw || {}, { n: cleanSub($("stp-nw-n").value), l: ($("stp-nw-l") || {}).value || "" }); domainDlg([S.nw.n], "new"); }
  /* إنشاء موقع في قائمتي: على دومين المنصة، أو بدومين خاص، أو بطلب دومين جديد؛ ويظهر مباشرة في القائمة وإعداداته */
  function createSite(mode, rq) {
    const n = cleanSub(($("stp-nw-n") || {}).value || (S.nw && S.nw.n)), lab = (($("stp-nw-l") || {}).value || (S.nw && S.nw.l) || "").trim();
    if (!n) return toast("⚠️ اكتب اسم الموقع");
    let url = "", dom;
    if (mode === "platform") {
      if (S.nw && S.nw.s && S.nw.s !== "free" && S.nw.s !== "free?") return toast("⚠️ هذا العنوان غير متاح — اختر اسماً آخر");
      if (!S.nw || !S.nw.s) return toast("⏳ انتظر نتيجة التحقق من العنوان");
      dom = { mode: "platform", value: n, status: "requested", requests: [] }; url = "https://" + n + "." + PLATFORM() + "/admin.html";
    } else if (mode === "own") {
      const own = String(($("stp-nw-ownv") || {}).value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(own)) return toast("⚠️ اكتب اسم دومين صحيحاً مثل example.com");
      dom = { mode: "own", value: own, status: "requested", requests: [] }; url = "https://" + own + "/admin.html";
    } else { dom = { mode: "request", value: "", status: "requested", requests: rq ? [rq] : [] }; url = "https://" + n + "." + PLATFORM() + "/admin.html"; }
    const a = stores(), e = { id: "s" + Date.now().toString(36), name: lab || n, sub: n, url, domain: dom, created: new Date().toISOString(), pending: true };
    a.push(e); saveStores(a); S.open = e.id; S.nw = null;
    notify("طلب موقع جديد\nاسم الموقع: " + n + (lab ? "\nاسم المتجر: " + lab : "") + "\n" + (mode === "platform" ? "العنوان: " + n + "." + PLATFORM() : mode === "own" ? "دومين خاص: " + dom.value : "طلب دومين جديد:\n" + (dom.requests[0] ? dom.requests[0].items.map(i => "• " + i.d + " — " + (ST[i.s] || ["؟"])[0]).join("\n") : "—")) + "\nمن موقع: " + curName());
    renderAll(); toast("✅ أُضيف الموقع إلى قائمتك — طلب الإنشاء وصل إلى الدعم");
  }
  /* ── حذف مجدول بعد 14 يوماً (قابل للإلغاء) ── */
  function delSite(id) {
    const cur = id === "cur", a = stores(), s = cur ? null : a.find(x => x.id === id), nm = cur ? curName() : (s && s.name); if (!cur && !s) return;
    const dl = cur ? S.d.deletion : s.del;
    if (dl && dl.at) {
      if (!confirm("إلغاء حذف «" + nm + "»؟ سيبقى الموقع وبياناته كما هي.")) return;
      if (cur) { S.d.deletion = null; collect(); save(); } else { delete s.del; saveStores(a); renderAll(); }
      notify("إلغاء طلب حذف الموقع: " + nm); toast("✅ أُلغي طلب الحذف"); return;
    }
    if (!confirm("حذف «" + nm + "»؟\n\nتنبيه: سيتم حذف جميع بيانات هذا الموقع من المنصة نهائياً (المنتجات، الطلبات، الصفحات، الإعدادات…) بعد " + DEL_DAYS + " يوماً من الآن.\nيمكنك إلغاء الحذف في أي وقت قبل انتهاء هذه المدة من الزر نفسه.\n\nهل تريد المتابعة؟")) return;
    const now = new Date(), obj = { req: now.toISOString(), at: new Date(now.getTime() + DEL_DAYS * DAY).toISOString() };
    if (cur) { collect(); S.d.deletion = obj; save(); } else { s.del = obj; saveStores(a); renderAll(); }
    notify("طلب حذف الموقع: " + nm + "\nيُحذف نهائياً بتاريخ: " + obj.at.slice(0, 10)); toast("🗑️ جُدول حذف الموقع بعد " + DEL_DAYS + " يوماً — يمكنك الإلغاء قبلها");
  }
  const delBtn = (id, dl) => dl && dl.at
    ? '<button class="small warn stp-deling" type="button" onclick="AdminStores.delSite(\'' + id + '\')" title="اضغط لإلغاء الحذف">جارٍ الحذف <span class="stp-cnt">' + (daysLeft(dl.at) > 0 ? daysLeft(dl.at) + ' يوم' : 'اليوم') + '</span> · إلغاء</button>'
    : '<button class="small warn" type="button" onclick="AdminStores.delSite(\'' + id + '\')">حذف</button>';

  /* ── البحث عن توفّر الدومين (استعلام حقيقي لدى سجلّ كل امتداد) ── */
  let RB = null;
  const rdapBase = async tld => {
    if (!RB) RB = fetch("https://data.iana.org/rdap/dns.json").then(r => r.json()).then(j => { const m = {}; (j.services || []).forEach(sv => sv[0].forEach(t => { m[t] = sv[1][0]; })); return m; }).catch(e => { RB = null; throw e; });
    return (await RB)[tld] || null;
  };
  async function checkDomain(name, tld) {
    try {
      const base = await rdapBase(tld); if (!base) return "manual";
      const r = await fetch(base.replace(/\/?$/, "/") + "domain/" + name + "." + tld, { headers: { Accept: "application/rdap+json" } });
      return r.status === 404 ? "free" : r.status === 200 ? "taken" : "unknown";
    } catch (e) { return "unknown"; }
  }
  const clean = v => String(v || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  const ST = { free: ["متوفر", "ok"], taken: ["غير متوفر", "no"], manual: ["يتحقق منه الدعم", "mid"], unknown: ["تعذّر التحقق الآن", "mid"] };
  function modal(html) {
    let m = $("stp-mod"); if (!m) { m = document.createElement("div"); m.id = "stp-mod"; m.className = "stp-modbg"; m.onclick = e => { if (e.target === m) closeModal(); }; document.body.appendChild(m); }
    m.innerHTML = '<div class="stp-mod">' + html + '</div>'; m.style.display = "flex";
  }
  const closeModal = () => { const m = $("stp-mod"); if (m) m.style.display = "none"; };
  function domainDlg(prefill, ctx) {
    S.dctx = ctx === "new" ? "new" : "cur"; const pf = Array.isArray(prefill) ? prefill : [];
    modal('<div class="stp-mh"><h3>طلب دومين جديد</h3><button type="button" class="small gray" onclick="AdminStores.closeDlg()">إغلاق</button></div>' +
      '<div class="hint">اكتب حتى ثلاثة أسماء (حروف لاتينية وأرقام وشرطة) واختر الامتدادات، ثم ابحث عن التوفّر. اختر ما تريده وأرسل الطلب.</div>' +
      '<div class="stp-nm">' + [0, 1, 2].map(i => '<input id="stp-dn' + i + '" dir="ltr" placeholder="الاسم ' + (i + 1) + (i ? " (اختياري)" : "") + '" value="' + esc(pf[i] || "") + '">').join("") + '</div>' +
      '<label class="f" style="margin-top:.5rem">الامتدادات</label><div class="stp-tl">' + TLDS.map((t, i) => '<label class="stp-tc"><input type="checkbox" class="stp-tld" value="' + t + '"' + (i < 3 ? " checked" : "") + '><span dir="ltr">.' + t + '</span></label>').join("") + '</div>' +
      '<div style="margin:.7rem 0"><button class="small" type="button" id="stp-srch" onclick="AdminStores.search()">🔍 ابحث عن التوفّر</button></div><div id="stp-res"></div>');
  }
  async function search() {
    const names = [0, 1, 2].map(i => clean(($("stp-dn" + i) || {}).value)).filter(Boolean), tlds = [...document.querySelectorAll(".stp-tld:checked")].map(x => x.value), res = $("stp-res");
    if (!names.length) return (res.innerHTML = '<div class="hint">اكتب اسماً واحداً على الأقل بحروف لاتينية.</div>');
    if (!tlds.length) return (res.innerHTML = '<div class="hint">اختر امتداداً واحداً على الأقل.</div>');
    const jobs = []; names.forEach(n => tlds.forEach(t => jobs.push({ n, t, s: "…" }))); S.jobs = jobs;
    const draw = () => { res.innerHTML = '<table class="stp-rt"><tbody>' + jobs.map((j, i) => { const st = ST[j.s] || ["جارٍ البحث…", "mid"]; return '<tr><td dir="ltr"><b>' + esc(j.n + "." + j.t) + '</b></td><td><span class="stp-b ' + st[1] + '">' + st[0] + '</span></td><td>' + (j.s === "free" || j.s === "manual" || j.s === "unknown" ? '<label class="stp-tc"><input type="checkbox" class="stp-pick" value="' + i + '"' + (j.s === "free" ? " checked" : "") + '> اختيار</label>' : "") + '</td></tr>'; }).join("") + '</tbody></table><div style="margin-top:.7rem"><button class="small gold" type="button" onclick="AdminStores.sendDomain()">إرسال الطلب</button></div>'; };
    draw(); const bt = $("stp-srch"); if (bt) bt.disabled = true;
    let k = 0; await Promise.all(Array.from({ length: 5 }, async () => { while (k < jobs.length) { const j = jobs[k++]; j.s = await checkDomain(j.n, j.t); if ($("stp-res")) { const keep = [...document.querySelectorAll(".stp-pick:checked")].map(x => x.value); draw(); keep.forEach(v => { const c = document.querySelector('.stp-pick[value="' + v + '"]'); if (c) c.checked = true; }); } } }));
    if (bt) bt.disabled = false; draw();
  }
  function sendDomain() {
    const picks = [...document.querySelectorAll(".stp-pick:checked")].map(x => S.jobs[+x.value]).filter(Boolean);
    if (!picks.length) return toast("⚠️ اختر اسماً من النتائج أولاً");
    const rq = { id: "d" + Date.now().toString(36), at: new Date().toISOString(), items: picks.map(j => ({ d: j.n + "." + j.t, s: j.s })), status: picks.some(j => j.s === "free") ? "available" : "pending" };
    if (S.dctx === "new") { closeModal(); return createSite("request", rq); }
    collect();
    S.d.domain.requests.unshift(rq); S.d.domain.status = "requested"; S.d.domain.at = rq.at;
    notify("طلب تسجيل دومين جديد\nالموقع: " + curName() + "\n" + rq.items.map(i => "• " + i.d + " — " + (ST[i.s] || ["؟"])[0]).join("\n"));
    closeModal(); S.open = "cur"; save();
  }
  async function recheck(id) {
    const rq = S.d.domain.requests.find(x => x.id === id); if (!rq) return; toast("⏳ جارٍ التحقق من التوفّر…");
    for (const it of rq.items) { const m = /^([^.]+)\.(.+)$/.exec(it.d); if (m) it.s = await checkDomain(m[1], m[2]); }
    rq.status = rq.items.some(i => i.s === "free") ? "available" : rq.items.every(i => i.s === "taken") ? "taken" : "pending"; collect(); save();
  }
  function rmReq(id) { S.d.domain.requests = S.d.domain.requests.filter(x => x.id !== id); collect(); save(); }
  function reqHtml(rq) {
    const msg = rq.status === "available" ? '<span class="stp-b ok">✔ الاسم متوفر — سنكمل إجراءات إنشاء الدومين ونُعلمك</span>' : rq.status === "taken" ? '<span class="stp-b no">✖ هذا الاسم غير متوفر، يرجى اختيار اسم آخر</span>' : '<span class="stp-b mid">قيد الدراسة لدى الدعم</span>';
    return '<div class="stp-rq"><div>' + rq.items.map(i => '<b dir="ltr" class="stp-dn">' + esc(i.d) + '</b> <span class="stp-b ' + (ST[i.s] || ["", "mid"])[1] + '">' + (ST[i.s] || ["؟"])[0] + '</span>').join("<br>") + '<br>' + msg + '</div><div><small>' + esc(String(rq.at).slice(0, 10)) + '</small> ' + (rq.status === "taken" ? '<button class="small" type="button" onclick="AdminStores.domainDlg()">اختيار اسم آخر</button>' : '<button class="small gray" type="button" onclick="AdminStores.recheck(\'' + rq.id + '\')">إعادة التحقق</button>') + '<button class="small warn" type="button" onclick="AdminStores.rmReq(\'' + rq.id + '\')">✕</button></div></div>';
  }

  /* ── الواجهة ── */
  function tzNow(tz) { try { return new Intl.DateTimeFormat("ar-DZ", { timeZone: tz, dateStyle: "full", timeStyle: "medium" }).format(new Date()); } catch (e) { return ""; } }
  function tick() { const e = $("stp-clock"), t = $("stp-tz"); if (e && t) e.textContent = tzNow(t.value); }
  function sel(id, opts, cur) { return '<select id="' + id + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select>'; }
  const CSS = '<style>.stp{display:grid;gap:14px}.stp h3{margin:0 0 .3rem}.stp .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.7rem}.stp label.f{display:block;font-size:.8rem;font-weight:800;margin-bottom:.15rem}.stp input,.stp select,.stp textarea{margin-bottom:.3rem}.stp-r{display:flex;gap:.5rem;align-items:center;margin:.5rem 0 .2rem;cursor:pointer}.stp-r input{width:auto;margin:0}.stp-dv{padding:.4rem 1.6rem}' +
    '.stp-site{border:1px solid rgba(128,140,150,.35);border-radius:14px;margin:.5rem 0;overflow:hidden}.stp-sh{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;padding:.7rem .9rem}.stp-sn{display:flex;gap:.7rem;align-items:center;min-width:0}.stp-sn small{opacity:.7}.stp-car{flex:none;width:34px;height:34px;border-radius:10px;border:1px solid rgba(128,140,150,.45);background:rgba(128,140,150,.12);color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}.stp-car svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s}.stp-site.on .stp-car svg{transform:rotate(180deg)}.stp-sb{padding:.2rem .9rem 1rem;border-top:1px solid rgba(128,140,150,.25);display:grid;gap:12px}.stp-sb[hidden]{display:none}' +
    '.stp-deling .stp-cnt{display:inline-block;margin:0 .25rem;padding:0 .45rem;border-radius:999px;background:rgba(255,255,255,.22);font-size:.72rem}.stp-badge{font-size:.7rem;font-weight:800;padding:.1rem .55rem;border-radius:999px;background:rgba(134,240,106,.18);color:var(--g-mint,#16a34a)}.stp-st{font-size:.78rem;font-weight:800}' +
    '.stp-b{display:inline-block;font-size:.75rem;font-weight:800;padding:.1rem .6rem;border-radius:999px;border:1px solid rgba(128,140,150,.4)}.stp-b.ok{background:rgba(34,197,94,.18);border-color:rgba(34,197,94,.6);color:#22c55e}.stp-b.no{background:rgba(239,68,68,.16);border-color:rgba(239,68,68,.6);color:#ef4444}.stp-b.mid{background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.6);color:#f59e0b}' +
    '.stp-rq{display:flex;gap:.8rem;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:.6rem .8rem;border:1px solid rgba(128,140,150,.35);border-radius:12px;margin:.4rem 0}.stp-dn{margin-inline-end:.3rem}' +
    '.stp-nwa{margin-top:.5rem}.stp-nwd{display:inline-block;padding:.45rem .8rem;border-radius:10px;border:1px dashed rgba(128,140,150,.5);font-size:1.05rem}.stp-nwr{margin-top:.4rem;min-height:1.6rem}.stp-nwb{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem}.stp-nwo{margin-top:.7rem;padding:.7rem;border:1px solid rgba(128,140,150,.35);border-radius:12px}.stp-chip{cursor:pointer;margin-inline-end:.4rem}.stp-modbg{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:14px}.stp-mod{width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:18px;padding:1.2rem;background:rgba(9,24,18,.985);color:#e8f5ee;border:1px solid rgba(255,255,255,.18);box-shadow:0 24px 70px rgba(0,0,0,.6)}html.white .stp-mod{background:#fff;color:#0f172a;border-color:#d2d9e3}.stp-mh{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.4rem}.stp-mh h3{margin:0}.stp-nm{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.5rem;margin-top:.6rem}.stp-tl{display:flex;flex-wrap:wrap;gap:.4rem}.stp-tc{display:inline-flex;gap:.35rem;align-items:center;padding:.25rem .65rem;border:1px solid rgba(128,140,150,.4);border-radius:999px;cursor:pointer;font-weight:700;font-size:.85rem}.stp-tc input{width:auto;margin:0}.stp-rt{width:100%;border-collapse:collapse}.stp-rt td{padding:.4rem .5rem;border-bottom:1px solid rgba(128,140,150,.25)}</style>';
  const acctIcon = id => { try { return window.SocialIcons ? '<span style="display:inline-flex;vertical-align:middle;margin-inline-end:.35rem">' + SocialIcons.icon(id, { size: 15, style: "brand", shape: "round" }) + '</span>' : ""; } catch (e) { return ""; } };
  function settingsHtml() {
    const d = S.d, dm = d.domain, reqs = dm.requests || [];
    const dmo = (v, t, body) => '<label class="stp-r"><input type="radio" name="stp-dm" value="' + v + '"' + (dm.mode === v ? " checked" : "") + ' onchange="AdminStores.dm()"><b>' + t + '</b></label><div class="stp-dv" id="stp-dvb-' + v + '"' + (dm.mode === v ? "" : " hidden") + '>' + body + '</div>';
    return '<div class="card"><h3>هوية الموقع</h3><div class="row"><div><label class="f">اسم المتجر</label><input id="stp-name" value="' + esc(d.name) + '"></div><div><label class="f">وصف مختصر (شعار المتجر)</label><input id="stp-tagline" value="' + esc(d.tagline) + '" placeholder="جملة قصيرة تعرّف متجرك"></div></div></div>' +
      '<div class="card"><h3>عنوان الموقع (الدومين)</h3><div class="hint">الحالي: <b dir="ltr">' + esc(SITE().domain || location.hostname) + '</b>' + (dm.status === "requested" ? ' — <span class="stp-st">لديك طلب قيد المعالجة</span>' : '') + '</div>' +
      dmo("own", "لدي دومين خاص بي", '<input id="stp-dv-own" dir="ltr" placeholder="example.com" value="' + esc(dm.mode === "own" ? dm.value : "") + '"><button class="small gold" type="button" onclick="AdminStores.request(\'domain\')">طلب ربط الدومين بموقعي</button>') +
      dmo("request", "أريد دومين جديداً", '<button class="small gold" type="button" onclick="AdminStores.domainDlg()">🔍 البحث عن اسم وطلب دومين جديد</button>' + (reqs.length ? '<div style="margin-top:.6rem">' + reqs.map(reqHtml).join("") + '</div>' : '')) +
      dmo("platform", "استعمال دومين المنصة", '<div style="display:flex;gap:.4rem;align-items:center"><input id="stp-dv-platform" dir="ltr" placeholder="mystore" value="' + esc(dm.mode === "platform" ? dm.value : "") + '" style="max-width:220px"><b dir="ltr">.' + esc(PLATFORM()) + '</b></div><button class="small gold" type="button" onclick="AdminStores.request(\'domain\')">طلب هذا العنوان</button>') + '</div>' +
      '<div class="card"><h3>الاتصال بالمتجر</h3><div class="row"><div><label class="f">البريد الإلكتروني للمتجر</label><input id="stp-email" type="email" dir="ltr" value="' + esc(d.email) + '"></div><div><label class="f">رقم الهاتف</label><input id="stp-phone" dir="ltr" value="' + esc(d.phone) + '" placeholder="0550000000"></div><div><label class="f">رقم واتساب (بالصيغة الدولية)</label><input id="stp-wa" dir="ltr" value="' + esc(d.wa) + '" placeholder="213550000000"></div></div><label class="f">العنوان</label><input id="stp-address" value="' + esc(d.address) + '" placeholder="الولاية، البلدية، الشارع"></div>' +
      '<div class="card"><h3>حسابات التواصل الاجتماعي</h3><div class="hint">اكتب اسم الحساب أو رابطه. يستعين بها <b>الوكيل الذكي</b> للإجابة عندما يسأل الزائر عن صفحاتك وحساباتك، وتصبح متاحة تلقائياً في إعدادات <b>الهيدر</b> و<b>الفوتر</b> لتختار أيّها يظهر في موقعك وأين.</div><div class="row" style="margin-top:.5rem">' + ACCTS.map(a => '<div><label class="f">' + acctIcon(a[0]) + esc(a[1]) + '</label><input id="stp-soc-' + a[0] + '" dir="ltr" value="' + esc((d.social || {})[a[0]] || "") + '" placeholder="' + esc(a[2]) + '"></div>').join("") + '</div></div>' +
      '<div class="card"><h3>الدولة واللغة والعملة والتوقيت</h3><div class="row"><div><label class="f">الدولة</label><select id="stp-country" onchange="AdminStores.country()">' + countryOpts(d.country) + '</select></div><div><label class="f">لغة الموقع</label>' + sel("stp-lang", LANGS, d.lang) + '<div class="hint">تُطبَّق اللغة المختارة على الموقع ولوحة التحكم معاً فور اكتمال ملفات الترجمة.</div></div>' +
      '<div><label class="f">العملة</label><select id="stp-currencyCode" onchange="AdminStores.cur()">' + curOpts(d.currencyCode) + '</select></div><div><label class="f">رمز العملة المعروض</label><input id="stp-currency" value="' + esc(d.currency) + '"></div>' +
      '<div><label class="f">المنطقة الزمنية</label><select id="stp-tz">' + tzOpts(d.tz) + '</select><div class="hint" id="stp-clock"></div></div></div>' +
      '<div class="row" style="margin-top:.4rem"><div><label class="f">صيغة التاريخ</label>' + sel("stp-dateFmt", [["DD/MM/YYYY", "31/12/2026"], ["YYYY-MM-DD", "2026-12-31"], ["D MMMM YYYY", "31 ديسمبر 2026"]], d.dateFmt) + '</div><div><label class="f">صيغة الوقت</label>' + sel("stp-timeFmt", [["24", "24 ساعة"], ["12", "12 ساعة"]], d.timeFmt) + '</div><div><label class="f">بداية الأسبوع</label>' + sel("stp-weekStart", [["sat", "السبت"], ["sun", "الأحد"], ["mon", "الاثنين"]], d.weekStart) + '</div></div></div>' +
      '<div class="card"><h3>حالة الموقع</h3><label style="display:flex;gap:.5rem;align-items:center;font-weight:800"><input type="checkbox" id="stp-maintenance" style="width:auto;margin:0"' + (d.maintenance ? " checked" : "") + '> وضع الصيانة (يرى الزبائن رسالة بدل الموقع، وتبقى لوحة التحكم تعمل)</label><label class="f" style="margin-top:.5rem">رسالة الصيانة</label><input id="stp-maintMsg" value="' + esc(d.maintMsg) + '" placeholder="الموقع تحت الصيانة حالياً، نعود إليكم قريباً."></div>' +
      '<div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><button class="small" type="button" onclick="AdminStores.save()">💾 حفظ إعدادات الموقع</button>' + (S.localOnly ? '<span class="stp-st" style="color:#f5b04a">محفوظة في هذا المتصفح فقط — اربط النشر لتصل إلى موقعك</span>' : "") + (S.err ? '<span class="stp-st" style="color:#f87171">' + esc(S.err) + '</span>' : "") + '</div>';
  }
  const CAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function renderAll() {
    mountSwitch();
    const box = $("stores-app"); if (!box) return; const d = S.d, list = stores(), open = S.open || "";
    const row = (id, nm, url, cur, dl, body) => '<div class="stp-site' + (open === id ? " on" : "") + '"><div class="stp-sh"><div class="stp-sn"><button type="button" class="stp-car" onclick="AdminStores.tog(\'' + id + '\')" title="إعدادات الموقع" aria-expanded="' + (open === id) + '">' + CAR + '</button><div><b>' + esc(nm) + '</b>' + (cur ? ' <span class="stp-badge">الحالي</span>' : '') + '<br><small dir="ltr">' + esc(url) + '</small></div></div><div>' + (cur ? '' : '<button class="small" type="button" onclick="AdminStores.open(\'' + id + '\')">فتح لوحة التحكم</button>') + delBtn(id, dl) + '</div></div>' + (open === id ? '<div class="stp-sb">' + body + '</div>' : '') + '</div>';
    const rqRO = rq => '<div class="stp-rq"><div>' + rq.items.map(i => '<b dir="ltr" class="stp-dn">' + esc(i.d) + '</b> <span class="stp-b ' + (ST[i.s] || ["", "mid"])[1] + '">' + (ST[i.s] || ["؟"])[0] + '</span>').join("<br>") + '</div><small>' + esc(String(rq.at).slice(0, 10)) + '</small></div>';
    const other = s => { const dm = s.domain || {}, addr = dm.mode === "own" ? dm.value : (s.sub ? s.sub + "." + PLATFORM() : s.url.replace(/^https?:\/\//, "").replace(/\/admin\.html$/, "")); return '<div class="row"><div><label class="f">اسم الموقع في قائمتي</label><div style="display:flex;gap:.4rem;align-items:center"><b>' + esc(s.name) + '</b><button class="small gray" type="button" onclick="AdminStores.rename(\'' + s.id + '\')">تغيير الاسم</button></div></div><div><label class="f">عنوان الموقع</label><b dir="ltr">' + esc(addr) + '</b>' + (s.pending ? ' <span class="stp-b mid">طلب الإنشاء قيد المعالجة لدى الدعم</span>' : '') + '</div></div>' + (dm.mode === "request" && (dm.requests || []).length ? '<label class="f">طلب الدومين</label>' + dm.requests.map(rqRO).join("") : '') + '<div class="hint">الهوية والاتصال والتوقيت وبقية الإعدادات لهذا الموقع تظهر في لوحة تحكمه عند جاهزيته.</div><button class="small" type="button" onclick="AdminStores.open(\'' + s.id + '\')">فتح لوحة تحكم ' + esc(s.name) + '</button>'; };
    box.innerHTML = CSS + '<div class="stp"><div class="card"><h3>مواقعي</h3><div class="hint">لكل موقع لوحة تحكم خاصة به. اضغط السهم لفتح إعدادات الموقع، ويمكنك التنقل بين مواقعك من أعلى اللوحة.</div>' +
      row("cur", curName(), here().replace(/^https?:\/\//, ""), true, d.deletion, settingsHtml()) +
      list.map(s => row(s.id, s.name, s.url.replace(/^https?:\/\//, "").replace(/\/admin\.html$/, ""), false, s.del, other(s))).join("") +
      ((d.deletion && d.deletion.at) || list.some(s => s.del) ? '<div class="hint" style="margin-top:.5rem">⏳ الموقع المحدّد للحذف يبقى كما هو حتى انتهاء المدة، ويمكنك إلغاء الحذف بالضغط على زر «جارٍ الحذف».</div>' : '') + '</div>' +
      '<div class="card"><h3>＋ إضافة موقع جديد</h3><div class="hint">اكتب اسم الموقع (حروف لاتينية) فيظهر عنوانه على دومين المنصة تلقائياً، ثم اختر: إنشاء الموقع بهذا العنوان، أو إضافة دومين تملكه، أو طلب دومين جديد.</div><div class="row" style="margin-top:.5rem"><div><label class="f">اسم الموقع</label><input id="stp-nw-n" dir="ltr" placeholder="boutique" value="' + esc((S.nw && S.nw.n) || "") + '" oninput="AdminStores.nwIn()"></div><div><label class="f">اسم المتجر (اختياري)</label><input id="stp-nw-l" placeholder="مثال: متجر بوتيك" value="' + esc((S.nw && S.nw.l) || "") + '"></div></div><div class="stp-nwa"><label class="f">عنوان الموقع</label><div class="stp-nwd" dir="ltr"><b id="stp-nw-d">' + esc(((S.nw && S.nw.n) || "name") + "." + PLATFORM()) + '</b></div><div id="stp-nw-res" class="stp-nwr"></div></div>' +
      '<div class="stp-nwb"><button class="small" type="button" onclick="AdminStores.createSite(\'platform\')">إنشاء الموقع على هذا العنوان</button><button class="small gold" type="button" onclick="AdminStores.nwOwn()">إضافة دومين خاص</button><button class="small gold" type="button" onclick="AdminStores.nwRequest()">طلب دومين خاص</button></div>' +
      '<div id="stp-nw-own" class="stp-nwo" hidden><label class="f">اسم الدومين الذي تملكه</label><div style="display:flex;gap:.5rem;flex-wrap:wrap"><input id="stp-nw-ownv" dir="ltr" placeholder="example.com" style="flex:1;min-width:200px"><button class="small" type="button" onclick="AdminStores.createSite(\'own\')">إضافة الدومين</button></div></div>' +
      '<details style="margin-top:.9rem"><summary style="cursor:pointer;font-weight:800">لدي موقع جاهز — أضفه إلى قائمتي</summary><div class="row" style="margin-top:.5rem"><div><label class="f">اسم الموقع</label><input id="stp-add-n" placeholder="مثال: أليسوم 2"></div><div><label class="f">عنوان الموقع</label><input id="stp-add-u" dir="ltr" placeholder="example.com"></div></div><button class="small" type="button" onclick="AdminStores.add()">إضافة إلى قائمتي</button></details></div></div>';
    if (S.nw && S.nw.n) nwCheck(S.nw.n);
    const t = $("stp-tz"); if (t) t.onchange = tick; tick(); clearInterval(S.clock); S.clock = setInterval(() => { if (!$("stp-clock")) return clearInterval(S.clock); tick(); }, 1000);
  }
  function tog(id) { if ($("stp-name")) collect(); S.open = S.open === id ? "" : id; renderAll(); }
  function dm() { document.querySelectorAll('input[name="stp-dm"]').forEach(r => { const b = $("stp-dvb-" + r.value); if (b) b.hidden = !r.checked; }); }
  /* اختيار الدولة يقترح العملة والمنطقة الزمنية (ويمكن تغييرهما) */
  function country() { const c = ($("stp-country") || {}).value, g = CSUG[c]; if (!g) return; const cc = $("stp-currencyCode"), t = $("stp-tz"), sy = $("stp-currency"); if (cc) cc.value = g[0]; if (sy) sy.value = g[2]; if (t && [...t.options].some(o => o.value === g[1])) { t.value = g[1]; tick(); } }
  function cur() { const c = ($("stp-currencyCode") || {}).value, sy = $("stp-currency"); if (c && sy) sy.value = curSym(c); }

  function boot() { mountSwitch(); load(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  return { save, add: addStore, delSite, rename: renameStore, open, menu, go, request, dm, tog, country, cur, domainDlg, closeDlg: closeModal, search, sendDomain, recheck, rmReq, nwIn, nwPick, nwOwn, nwRequest, createSite, accounts: () => Object.assign({}, (S.d && S.d.social) || {}), render: renderAll, data: () => S.d, stores };
})();
