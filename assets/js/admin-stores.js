/* إعدادات الموقع + التنقل بين المواقع (لوحات التحكم).
   - assets/data/store.json (عام): الاسم، الاتصال، الدومين، اللغة والتوقيت، العملة، وضع الصيانة — يطبّقه الموقع عبر applyStore في app.js.
   - قائمة «مواقعي» تُحفظ في هذا المتصفح (alyssum_stores) وتتزامن بين أجهزتك: كل موقع له لوحة تحكم على عنوانه نفسه. */
const AdminStores = (() => {
  const PATH = "assets/data/store.json", LOCAL = "alyssum_store_cfg", LSK = "alyssum_stores", $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SITE = () => (typeof CONFIG !== "undefined" && CONFIG.SITE) || {};
  const PLATFORM = () => (typeof CONFIG !== "undefined" && CONFIG.PLATFORM_DOMAIN) || "alyssumdz.com";
  const TZ = ["Africa/Algiers", "Africa/Tunis", "Africa/Casablanca", "Africa/Tripoli", "Africa/Cairo", "Africa/Nouakchott", "Asia/Riyadh", "Asia/Dubai", "Asia/Qatar", "Asia/Kuwait", "Asia/Baghdad", "Asia/Amman", "Asia/Beirut", "Europe/Paris", "Europe/Madrid", "Europe/London", "Europe/Istanbul", "America/Montreal", "UTC"];
  const defaults = () => ({ name: SITE().name || "", tagline: "", email: "", phone: "", wa: SITE().waNumber || "", instagram: SITE().instagram || "", address: "", lang: "ar", tz: "Africa/Algiers", dateFmt: "DD/MM/YYYY", timeFmt: "24", weekStart: "sat", currency: "دج", maintenance: false, maintMsg: "", domain: { mode: "own", value: SITE().domain || "", status: "", at: "" } });
  const S = { d: defaults(), sha: null, loaded: false, localOnly: false, err: "", clock: 0 };
  const dec = raw => JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\s/g, "")))));
  const enc = v => btoa(unescape(encodeURIComponent(JSON.stringify(v, null, 2))));
  const norm = x => { const d = defaults(), o = x && typeof x === "object" ? x : {}; const r = Object.assign(d, o); r.domain = Object.assign(defaults().domain, o.domain || {}); return r; };
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
  function delStore(id) { if (!confirm("حذف هذا الموقع من قائمتك؟ (لا يحذف الموقع نفسه)")) return; saveStores(stores().filter(s => s.id !== id)); renderAll(); }
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
    const g = id => { const e = $(id); return e ? e.value.trim() : null; }, d = S.d, set = (k, id) => { const v = g(id); if (v !== null) d[k] = v; };
    if (!$("stp-name")) return;
    ["name", "tagline", "email", "address", "currency", "maintMsg"].forEach(k => set(k, "stp-" + k));
    const ph = g("stp-phone"), wa = g("stp-wa"); d.phone = ph.replace(/[^\d+]/g, ""); d.wa = wa.replace(/[^\d]/g, ""); d.instagram = g("stp-instagram").replace(/^@/, "");
    ["lang", "tz", "dateFmt", "timeFmt", "weekStart"].forEach(k => set(k, "stp-" + k));
    d.maintenance = !!$("stp-maintenance").checked;
    const m = (document.querySelector('input[name="stp-dm"]:checked') || {}).value || "own";
    d.domain.mode = m; d.domain.value = g("stp-dv-" + m) || "";
  }
  /* ── طلبات للدعم (دومين/موقع جديد) ── */
  function request(kind) {
    collect(); const d = S.d, m = d.domain.mode; let txt;
    if (kind === "site") txt = "طلب موقع جديد\nاسم المتجر: " + ((($("stp-new-n") || {}).value || "").trim() || "—") + "\nالدومين المطلوب: " + ((($("stp-new-d") || {}).value || "").trim() || "دومين المنصة") + "\nمن موقع: " + curName();
    else txt = (m === "own" ? "طلب ربط دومين موجود" : m === "request" ? "طلب تسجيل دومين جديد" : "طلب عنوان على دومين المنصة") + "\nالدومين: " + (m === "platform" ? d.domain.value + "." + PLATFORM() : d.domain.value || "—") + "\nالموقع: " + curName();
    if (kind !== "site") { d.domain.status = "requested"; d.domain.at = new Date().toISOString(); }
    const wa = (typeof CONFIG !== "undefined" && CONFIG.SUPPORT_WA) || "";
    if (wa) window.open("https://wa.me/" + String(wa).replace(/\D/g, "") + "?text=" + encodeURIComponent(txt), "_blank", "noopener");
    else { try { navigator.clipboard.writeText(txt); } catch (e) { } toast("📋 نُسخ نص الطلب — أرسله إلى الدعم"); }
    if (kind !== "site") save();
  }

  /* ── الواجهة ── */
  function tzNow(tz) { try { return new Intl.DateTimeFormat("ar-DZ", { timeZone: tz, dateStyle: "full", timeStyle: "medium" }).format(new Date()); } catch (e) { return ""; } }
  function tick() { const e = $("stp-clock"), t = $("stp-tz"); if (e && t) e.textContent = tzNow(t.value); }
  function sel(id, opts, cur) { return '<select id="' + id + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select>'; }
  function renderAll() {
    mountSwitch();
    const box = $("stores-app"); if (!box) return; const d = S.d, dm = d.domain, list = stores();
    const dmo = (v, t, body) => '<label class="stp-r"><input type="radio" name="stp-dm" value="' + v + '"' + (dm.mode === v ? " checked" : "") + ' onchange="AdminStores.dm()"><b>' + t + '</b></label><div class="stp-dv" id="stp-dvb-' + v + '"' + (dm.mode === v ? "" : " hidden") + '>' + body + '</div>';
    box.innerHTML = '<style>.stp{display:grid;gap:14px}.stp h3{margin:0 0 .3rem}.stp .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.7rem}.stp label.f{display:block;font-size:.8rem;font-weight:800;margin-bottom:.15rem}.stp input,.stp select,.stp textarea{margin-bottom:.3rem}.stp-r{display:flex;gap:.5rem;align-items:center;margin:.5rem 0 .2rem;cursor:pointer}.stp-r input{width:auto;margin:0}.stp-dv{padding:.4rem 1.6rem}.stp-sit{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;padding:.6rem .8rem;border:1px solid rgba(128,140,150,.35);border-radius:12px;margin:.4rem 0}.stp-sit small{opacity:.7}.stp-st{font-size:.78rem;font-weight:800}</style><div class="stp">' +
      '<div class="card"><h3>مواقعي ولوحات التحكم</h3><div class="hint">لكل موقع لوحة تحكم خاصة به على عنوانه. أضف مواقعك هنا وتنقّل بينها من أعلى اللوحة (لوحة تحكم ' + esc(curName()) + ' / لوحة تحكم موقع آخر).</div>' +
      '<div class="stp-sit"><div><b>' + esc(curName()) + '</b> <small>(الحالي)</small><br><small dir="ltr">' + esc(here().replace(/^https?:\/\//, "")) + '</small></div></div>' +
      list.map(s => '<div class="stp-sit"><div><b>' + esc(s.name) + '</b><br><small dir="ltr">' + esc(s.url.replace(/^https?:\/\//, "")) + '</small></div><div><button class="small" type="button" onclick="AdminStores.open(\'' + s.id + '\')">فتح لوحة التحكم</button><button class="small gray" type="button" onclick="AdminStores.rename(\'' + s.id + '\')">تسمية</button><button class="small warn" type="button" onclick="AdminStores.del(\'' + s.id + '\')">حذف</button></div></div>').join("") +
      '<div class="row" style="margin-top:.6rem"><div><label class="f">اسم الموقع</label><input id="stp-add-n" placeholder="مثال: أليسوم 2"></div><div><label class="f">عنوان الموقع</label><input id="stp-add-u" dir="ltr" placeholder="example.com"></div></div><button class="small" type="button" onclick="AdminStores.add()">＋ إضافة موقع إلى قائمتي</button>' +
      '<details style="margin-top:.8rem"><summary style="cursor:pointer;font-weight:800">طلب موقع جديد (متجر آخر بلوحة تحكم خاصة)</summary><div class="row" style="margin-top:.5rem"><div><label class="f">اسم المتجر الجديد</label><input id="stp-new-n"></div><div><label class="f">الدومين المطلوب (اختياري)</label><input id="stp-new-d" dir="ltr" placeholder="يُستعمل دومين المنصة إن تُرك فارغاً"></div></div><button class="small gold" type="button" onclick="AdminStores.request(\'site\')">إرسال الطلب إلى الدعم</button></details></div>' +
      '<div class="card"><h3>هوية المتجر</h3><div class="row"><div><label class="f">اسم المتجر</label><input id="stp-name" value="' + esc(d.name) + '"></div><div><label class="f">وصف مختصر (شعار المتجر)</label><input id="stp-tagline" value="' + esc(d.tagline) + '" placeholder="جملة قصيرة تعرّف متجرك"></div></div></div>' +
      '<div class="card"><h3>عنوان الموقع (الدومين)</h3><div class="hint">الحالي: <b dir="ltr">' + esc(SITE().domain || location.hostname) + '</b>' + (dm.status === "requested" ? ' — <span class="stp-st">طلبك قيد المعالجة لدى الدعم</span>' : '') + '</div>' +
      dmo("own", "لدي دومين خاص بي", '<input id="stp-dv-own" dir="ltr" placeholder="example.com" value="' + esc(dm.mode === "own" ? dm.value : "") + '"><button class="small gold" type="button" onclick="AdminStores.request(\'domain\')">طلب ربط الدومين بموقعي</button>') +
      dmo("request", "أريد طلب دومين جديد", '<input id="stp-dv-request" dir="ltr" placeholder="الاسم المطلوب مثل: mystore.com" value="' + esc(dm.mode === "request" ? dm.value : "") + '"><button class="small gold" type="button" onclick="AdminStores.request(\'domain\')">طلب تسجيل الدومين</button>') +
      dmo("platform", "استعمال دومين المنصة", '<div style="display:flex;gap:.4rem;align-items:center"><input id="stp-dv-platform" dir="ltr" placeholder="mystore" value="' + esc(dm.mode === "platform" ? dm.value : "") + '" style="max-width:220px"><b dir="ltr">.' + esc(PLATFORM()) + '</b></div><button class="small gold" type="button" onclick="AdminStores.request(\'domain\')">طلب هذا العنوان</button>') + '</div>' +
      '<div class="card"><h3>الاتصال بالمتجر</h3><div class="row"><div><label class="f">البريد الإلكتروني للمتجر</label><input id="stp-email" type="email" dir="ltr" value="' + esc(d.email) + '"></div><div><label class="f">رقم الهاتف</label><input id="stp-phone" dir="ltr" value="' + esc(d.phone) + '" placeholder="0550000000"></div><div><label class="f">رقم واتساب (بالصيغة الدولية)</label><input id="stp-wa" dir="ltr" value="' + esc(d.wa) + '" placeholder="213550000000"></div><div><label class="f">حساب انستغرام</label><input id="stp-instagram" dir="ltr" value="' + esc(d.instagram) + '" placeholder="username"></div></div><label class="f">العنوان</label><input id="stp-address" value="' + esc(d.address) + '" placeholder="الولاية، البلدية، الشارع"></div>' +
      '<div class="card"><h3>اللغة والتوقيت</h3><div class="row"><div><label class="f">لغة الموقع</label>' + sel("stp-lang", [["ar", "العربية"], ["fr", "Français"], ["en", "English"]], d.lang) + '</div><div><label class="f">المنطقة الزمنية</label>' + sel("stp-tz", TZ.map(z => [z, z]), d.tz) + '<div class="hint" id="stp-clock"></div></div><div><label class="f">صيغة التاريخ</label>' + sel("stp-dateFmt", [["DD/MM/YYYY", "31/12/2026"], ["YYYY-MM-DD", "2026-12-31"], ["D MMMM YYYY", "31 ديسمبر 2026"]], d.dateFmt) + '</div><div><label class="f">صيغة الوقت</label>' + sel("stp-timeFmt", [["24", "24 ساعة"], ["12", "12 ساعة"]], d.timeFmt) + '</div><div><label class="f">بداية الأسبوع</label>' + sel("stp-weekStart", [["sat", "السبت"], ["sun", "الأحد"], ["mon", "الاثنين"]], d.weekStart) + '</div><div><label class="f">رمز العملة</label><input id="stp-currency" value="' + esc(d.currency) + '"></div></div></div>' +
      '<div class="card"><h3>حالة الموقع</h3><label style="display:flex;gap:.5rem;align-items:center;font-weight:800"><input type="checkbox" id="stp-maintenance" style="width:auto;margin:0"' + (d.maintenance ? " checked" : "") + '> وضع الصيانة (يرى الزبائن رسالة بدل الموقع، وتبقى لوحة التحكم تعمل)</label><label class="f" style="margin-top:.5rem">رسالة الصيانة</label><input id="stp-maintMsg" value="' + esc(d.maintMsg) + '" placeholder="الموقع تحت الصيانة حالياً، نعود إليكم قريباً."></div>' +
      '<div class="card" style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><button class="small" type="button" onclick="AdminStores.save()">💾 حفظ إعدادات الموقع</button>' + (S.localOnly ? '<span class="stp-st" style="color:#f5b04a">محفوظة في هذا المتصفح فقط — اربط النشر لتصل إلى موقعك</span>' : "") + (S.err ? '<span class="stp-st" style="color:#f87171">' + esc(S.err) + '</span>' : "") + '</div></div>';
    const t = $("stp-tz"); if (t) t.onchange = tick; tick(); clearInterval(S.clock); S.clock = setInterval(() => { if (!$("stp-clock")) return clearInterval(S.clock); tick(); }, 1000);
  }
  function dm() { document.querySelectorAll('input[name="stp-dm"]').forEach(r => { const b = $("stp-dvb-" + r.value); if (b) b.hidden = !r.checked; }); }

  function boot() { mountSwitch(); load(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  return { save, add: addStore, del: delStore, rename: renameStore, open, menu, go, request, dm, render: renderAll, data: () => S.d, stores };
})();
