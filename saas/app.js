/* لوحة مزوّد منصة أليسوم: طلبات الدعم والإنشاء، المواقع، الزبائن، التحليلات، وإشعارات مباشرة.
   الأمان: الدخول بحساب Auth، والقراءة/الكتابة محكومة بـRLS لمدير المنصة فقط (saas/schema.sql). */
(() => {
  "use strict";
  const C = window.SAAS_CFG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const KIND = { site_create: "طلب إنشاء موقع", site_delete: "طلب حذف موقع", site_delete_cancel: "إلغاء حذف موقع", domain_request: "طلب دومين جديد", domain_link: "ربط دومين خاص", domain_dns: "DNS جاهز", support: "دعم فني", billing: "الاشتراك والفوترة", other: "أخرى" };
  const ST = { new: "جديد", open: "قيد المعالجة", waiting: "بانتظار الزبون", resolved: "تم الحل", rejected: "مرفوض" };
  const PR = { low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" };
  const SST = { requested: "مطلوب", provisioning: "قيد التجهيز", active: "نشط", suspended: "موقوف", deleting: "جارٍ الحذف", deleted: "محذوف" };
  const CST = { lead: "محتمل", active: "نشط", suspended: "موقوف", churned: "مفقود" };
  const DST = { none: "—", requested: "مطلوب", dns_ready: "DNS جاهز", connected: "مربوط", rejected: "مرفوض" };
  const DMODE = { platform: "دومين المنصة", own: "دومين خاص", request: "دومين جديد مطلوب" };
  const TABS = { home: "نظرة عامة", inbox: "الطلبات", sites: "المواقع", customers: "الزبائن", stats: "التحليلات", settings: "الإعدادات" };
  const CANNED = [
    ["تم الاستلام", "مرحباً، استلمنا طلبك وسنعالجه في أقرب وقت. شكراً لثقتك."],
    ["نحتاج معلومات", "لنتابع طلبك نحتاج منك بعض المعلومات الإضافية. هل يمكنك تزويدنا بالتفاصيل؟"],
    ["تم الحل", "تمت معالجة طلبك. إن واجهتك أي مشكلة أخرى فنحن بخدمتك."],
    ["الاسم غير متاح", "عذراً، هذا الاسم غير متوفر. يرجى اختيار اسم آخر من الإعدادات وإعادة إرسال الطلب."],
    ["DNS غير صحيح", "راجعنا إعدادات DNS لدومينك ولم تكتمل بعد. تأكد من إضافة السجلات المعروضة في صفحة الدومين ثم اضغط «تحقق من الدومين»، وقد يستغرق الانتشار حتى 24 ساعة."]
  ];

  const S = { tab: "home", tk: [], si: [], cu: [], stats: null, days: 30, sel: null, msgs: {}, f: { q: "", st: "active", kind: "", pr: "" }, sv: "board", known: null, live: false, user: "", loading: false };
  let sb = null;
  const pref = () => { try { return Object.assign({ sound: true, desktop: false }, JSON.parse(localStorage.getItem("saas_prefs") || "{}")); } catch (e) { return { sound: true, desktop: false }; } };
  const setPref = p => { try { localStorage.setItem("saas_prefs", JSON.stringify(Object.assign(pref(), p))); } catch (e) { } };

  /* ── أدوات ── */
  const fmt = iso => { if (!iso) return "—"; try { return new Date(iso).toLocaleString("ar-DZ", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return String(iso); } };
  const ago = iso => { if (!iso) return ""; const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return "الآن"; if (s < 3600) return "قبل " + Math.floor(s / 60) + " د"; if (s < 86400) return "قبل " + Math.floor(s / 3600) + " س"; return "قبل " + Math.floor(s / 86400) + " يوم"; };
  const pill = (cls, txt) => '<span class="pill ' + esc(cls) + '">' + esc(txt) + '</span>';
  const byId = (a, id) => a.find(x => x.id === id);
  const host = o => String(o || "").replace(/^https?:\/\//, "");

  function toast(title, body, warn, fn) {
    const t = document.createElement("div"); t.className = "toast" + (warn ? " w" : ""); t.innerHTML = "<b>" + esc(title) + "</b>" + (body ? "<span>" + esc(body) + "</span>" : "");
    t.onclick = () => { t.remove(); if (fn) fn(); }; $("toasts").appendChild(t); setTimeout(() => t.remove(), 9000);
  }
  let _ac = null;
  function beep() {
    if (!pref().sound) return;
    try {
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)(); const t0 = _ac.currentTime;
      [[880, 0], [1175, 0.14]].forEach(([f, d]) => { const o = _ac.createOscillator(), g = _ac.createGain(); o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.22, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28); o.connect(g); g.connect(_ac.destination); o.start(t0 + d); o.stop(t0 + d + 0.3); });
    } catch (e) { }
  }
  function ping(title, body, warn, fn) {
    toast(title, body, warn, fn); beep();
    try { if (pref().desktop && "Notification" in window && Notification.permission === "granted" && document.hidden) { const n = new Notification(title, { body: body || "", tag: "saas" }); n.onclick = () => { window.focus(); if (fn) fn(); n.close(); }; } } catch (e) { }
  }
  function badges() {
    const un = S.tk.filter(t => !t.admin_read && t.status !== "resolved" && t.status !== "rejected").length;
    const b = $("bd-inbox"); b.hidden = !un; b.textContent = un;
    const rq = S.si.filter(s => s.status === "requested").length, bs = $("bd-sites"); bs.hidden = !rq; bs.textContent = rq;
    document.title = (un ? "(" + un + ") " : "") + "لوحة منصة أليسوم";
  }
  const setLive = on => { S.live = on; const e = $("live"); e.classList.toggle("on", on); e.lastElementChild.textContent = on ? "مباشر" : "تحديث دوري"; };

  /* ── الدخول ── */
  async function boot() {
    if (!window.supabase || !window.supabase.createClient) { $("login").hidden = false; $("lerr").textContent = "تعذّر تحميل مكتبة الاتصال — تحقق من الإنترنت ثم أعد تحميل الصفحة."; return; }
    sb = window.supabase.createClient(C.URL, C.KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const { data } = await sb.auth.getSession();
    if (data && data.session) await enter(data.session); else $("login").hidden = false;
  }
  async function enter(session) {
    const r = await sb.rpc("saas_stats", { p_days: 1 });
    if (r.error) {
      await sb.auth.signOut(); $("app").hidden = true; $("login").hidden = false;
      $("lerr").textContent = /unauthorized|42501/.test(JSON.stringify(r.error)) ? "هذا الحساب ليس مدير منصة." : "تعذّر الاتصال بالخادم: " + (r.error.message || ""); return;
    }
    S.user = (session.user && session.user.email) || ""; $("who").textContent = S.user; $("login").hidden = true; $("app").hidden = false;
    S.tab = (location.hash || "").replace("#", "") in TABS ? location.hash.slice(1) : "home";
    await load(true); go(S.tab); live(); setInterval(() => { if (!S.loading) load(); }, C.POLL_MS || 25000);
  }
  $("lf").addEventListener("submit", async e => {
    e.preventDefault(); const b = $("lbtn"); b.disabled = true; $("lerr").textContent = "";
    if (!sb) { $("lerr").textContent = "المكتبة غير محمّلة."; b.disabled = false; return; }
    const { data, error } = await sb.auth.signInWithPassword({ email: $("le").value.trim(), password: $("lp").value });
    b.disabled = false; if (error) { $("lerr").textContent = /Invalid login/i.test(error.message) ? "البريد أو كلمة المرور غير صحيحة." : error.message; return; }
    await enter(data.session);
  });
  $("logout").onclick = async () => { await sb.auth.signOut(); location.reload(); };

  /* ── التحميل والبث المباشر ── */
  let _soon = 0; const soon = () => { clearTimeout(_soon); _soon = setTimeout(() => load(), 350); };
  function live() {
    try {
      S.ch = sb.channel("saas-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "saas_tickets" }, soon)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "saas_messages" }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "saas_sites" }, soon)
        .subscribe(s => setLive(s === "SUBSCRIBED"));
    } catch (e) { setLive(false); }
  }
  async function load(first) {
    if (S.loading) return; S.loading = true;
    try {
      const [t, s, c] = await Promise.all([
        sb.from("saas_tickets").select("*").order("created_at", { ascending: false }).limit(1000),
        sb.from("saas_sites").select("*").order("created_at", { ascending: false }),
        sb.from("saas_customers").select("*").order("created_at", { ascending: false })]);
      if (t.error || s.error || c.error) { const er = t.error || s.error || c.error; if (/JWT|expired|401/i.test(er.message || "")) { toast("انتهت الجلسة", "سجّل الدخول من جديد", true); } throw er; }
      const old = S.known; S.tk = t.data || []; S.si = s.data || []; S.cu = c.data || [];
      const nk = {}; S.tk.forEach(x => { nk[x.id] = x.last_customer_at + "|" + x.status; });
      if (old && !first) {
        S.tk.forEach(x => {
          if (!(x.id in old)) ping("طلب جديد #" + x.num, (KIND[x.kind] || x.kind) + " — " + x.subject, x.priority === "high" || x.priority === "urgent", () => openTicket(x.id));
          else if (old[x.id].split("|")[0] !== String(x.last_customer_at) && !x.admin_read) ping("رد جديد من الزبون #" + x.num, x.subject, false, () => openTicket(x.id));
        });
      }
      S.known = nk; badges();
      if (S.tab === "home" || S.tab === "stats") await loadStats();
      render(true);
    } catch (e) { setLive(false); } finally { S.loading = false; }
  }
  async function loadStats() { const r = await sb.rpc("saas_stats", { p_days: S.tab === "stats" ? S.days : 30 }); if (!r.error) S.stats = r.data; }

  /* ── التنقل والرسم ── */
  document.querySelectorAll(".nv").forEach(b => b.onclick = () => go(b.dataset.tab));
  $("refresh").onclick = () => load();
  async function go(tab) {
    S.tab = tab; try { history.replaceState(null, "", "#" + tab); } catch (e) { }
    document.querySelectorAll(".nv").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    $("ttl").textContent = TABS[tab]; if (tab === "home" || tab === "stats") await loadStats(); render();
  }
  function render(soft) {
    if (!$("view")) return;
    if (S.tab === "inbox") return inbox(soft);
    const v = $("view"), keep = v.scrollTop; v.innerHTML = ({ home, sites, customers, stats: statsView, settings })[S.tab](); v.scrollTop = keep; wire();
  }

  /* ── النظرة العامة ── */
  const kpi = (n, l, c, tab, extra) => '<div class="card kpi' + (tab ? " clk" : "") + '" style="--c:' + c + '"' + (tab ? ' data-a="go" data-v="' + tab + '"' : "") + '><div class="n">' + esc(n) + '</div><div class="l">' + esc(l) + '</div>' + (extra ? '<div class="sm mut">' + esc(extra) + '</div>' : "") + '</div>';
  function home() {
    const st = S.stats || {}, t = st.tickets || {}, r = st.response || {}, s = st.sites || {};
    const recent = S.tk.slice(0, 6);
    const due = (s.deletions_due || []);
    return '<div class="grid kpis">' + kpi(t.unread || 0, "طلبات غير مقروءة", "var(--blu)", "inbox") + kpi((t.new || 0) + (t.open || 0), "طلبات مفتوحة", "var(--amb)", "inbox", "جديد " + (t.new || 0) + " · قيد المعالجة " + (t.open || 0)) +
      kpi(S.si.filter(x => x.status === "requested").length, "مواقع بانتظار التجهيز", "var(--vio)", "sites") + kpi(s.total || 0, "مواقع على المنصة", "var(--grn)", "sites", "نشطة منذ 7 أيام: " + (s.seen_7d || 0)) +
      kpi((st.customers || {}).total || 0, "زبائن", "var(--mint)", "customers") + kpi(r.sla_breached || 0, "تأخر الرد أكثر من 24 س", (r.sla_breached ? "var(--red)" : "var(--grn)"), "inbox") + '</div>' +
      '<div class="grid two" style="margin-top:12px"><div class="card"><h3>آخر الطلبات</h3>' + (recent.length ? recent.map(x => '<div class="tk' + (!x.admin_read && x.status !== "resolved" && x.status !== "rejected" ? " unr" : "") + '" data-a="open" data-v="' + x.id + '" style="margin-bottom:6px"><div class="s">#' + x.num + " " + esc(x.subject) + '</div><div class="m">' + pill(x.status, ST[x.status]) + pill("none", KIND[x.kind] || x.kind) + '<span>' + esc(siteName(x.site_id) || host(x.origin)) + '</span><span>' + ago(x.created_at) + '</span></div></div>').join("") : '<div class="empty">لا طلبات بعد</div>') + '</div>' +
      '<div class="card"><h3>يحتاج إجراء</h3>' + actionsList(due) + '</div></div>';
  }
  function actionsList(due) {
    const out = [];
    S.tk.filter(t => t.status === "new" && (t.priority === "high" || t.priority === "urgent")).slice(0, 5).forEach(t => out.push('<div class="tk" data-a="open" data-v="' + t.id + '" style="margin-bottom:6px"><div class="s">' + esc(t.subject) + '</div><div class="m">' + pill(t.priority, "أولوية " + PR[t.priority]) + '<span>' + ago(t.created_at) + '</span></div></div>'));
    S.si.filter(x => x.status === "requested").slice(0, 5).forEach(x => out.push('<div class="tk" data-a="site" data-v="' + x.id + '" style="margin-bottom:6px"><div class="s">تجهيز موقع: ' + esc(x.name) + '</div><div class="m">' + pill("requested", "مطلوب") + '<span class="ltr">' + esc(x.sub ? x.sub : host(x.origin)) + '</span><span>' + ago(x.created_at) + '</span></div></div>'));
    due.forEach(x => out.push('<div class="tk" data-a="site" data-v="' + x.id + '" style="margin-bottom:6px"><div class="s">موعد حذف مستحق: ' + esc(x.name) + '</div><div class="m">' + pill("deleting", "حذف") + '<span>' + fmt(x.at) + '</span></div></div>'));
    return out.length ? out.join("") : '<div class="empty">لا شيء عاجل الآن</div>';
  }
  const siteName = id => { const s = byId(S.si, id); return s ? s.name : ""; };
  const custName = id => { const c = byId(S.cu, id); return c ? c.name : ""; };

  /* ── الوارد ── */
  function filtered() {
    const f = S.f, q = f.q.trim().toLowerCase();
    return S.tk.filter(t => {
      if (f.st === "active" ? (t.status === "resolved" || t.status === "rejected") : f.st !== "all" && t.status !== f.st) return false;
      if (f.kind && t.kind !== f.kind) return false; if (f.pr && t.priority !== f.pr) return false;
      if (q) { const hay = (t.subject + " " + t.body + " " + t.num + " " + siteName(t.site_id) + " " + custName(t.customer_id) + " " + (t.origin || "")).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
      return true;
    }).sort((a, b) => (a.admin_read - b.admin_read) || (prio(b) - prio(a)) || (new Date(b.updated_at) - new Date(a.updated_at)));
  }
  const prio = t => ({ urgent: 3, high: 2, normal: 1, low: 0 }[t.priority] || 0);
  const opts = (map, cur, all) => (all ? '<option value="">' + all + '</option>' : "") + Object.keys(map).map(k => '<option value="' + k + '"' + (k === cur ? " selected" : "") + '>' + esc(map[k]) + '</option>').join("");
  function listHtml() {
    const L = filtered();
    return L.length ? L.map(t => '<div class="tk' + (S.sel === t.id ? " sel" : "") + (!t.admin_read && t.status !== "resolved" && t.status !== "rejected" ? " unr" : "") + '" data-a="open" data-v="' + t.id + '"><div class="s">#' + t.num + " " + esc(t.subject) + '</div><div class="m">' + pill(t.status, ST[t.status]) + (t.priority === "high" || t.priority === "urgent" ? pill(t.priority, PR[t.priority]) : "") + pill("none", KIND[t.kind] || t.kind) + '<span>' + esc(siteName(t.site_id) || host(t.origin)) + '</span><span>' + ago(t.updated_at) + '</span></div></div>').join("") : '<div class="empty">لا طلبات مطابقة</div>';
  }
  function inbox(soft) {
    const v = $("view");
    if (!$("tl")) {
      v.innerHTML = '<div class="inbox"><div><div class="flt"><input id="fq" placeholder="بحث…" value="' + esc(S.f.q) + '"><select id="fst">' + '<option value="active"' + (S.f.st === "active" ? " selected" : "") + '>المفتوحة</option>' + opts(ST, S.f.st) + '<option value="all"' + (S.f.st === "all" ? " selected" : "") + '>الكل</option></select><select id="fkind">' + opts(KIND, S.f.kind, "كل الأنواع") + '</select><select id="fpr">' + opts(PR, S.f.pr, "كل الأولويات") + '</select></div><div class="tl" id="tl"></div></div><div id="det"></div></div>';
      $("fq").oninput = e => { S.f.q = e.target.value; $("tl").innerHTML = listHtml(); };
      ["fst:st", "fkind:kind", "fpr:pr"].forEach(p => { const [id, k] = p.split(":"); $(id).onchange = e => { S.f[k] = e.target.value; $("tl").innerHTML = listHtml(); }; });
      v.onclick = onClick;
    }
    const sc = $("tl").scrollTop; $("tl").innerHTML = listHtml(); $("tl").scrollTop = sc; detail(soft);
  }
  async function openTicket(id) {
    S.tab !== "inbox" && (await go("inbox")); S.sel = id; const t = byId(S.tk, id);
    if (t && !t.admin_read) { t.admin_read = true; sb.from("saas_tickets").update({ admin_read: true }).eq("id", id).then(() => { }); badges(); }
    await fetchMsgs(id); inbox();
  }
  async function fetchMsgs(id) {
    const r = await sb.from("saas_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }).order("id", { ascending: true });
    if (!r.error) S.msgs[id] = r.data || [];
  }
  async function detail(soft) {
    const box = $("det"); if (!box) return; const t = byId(S.tk, S.sel);
    if (!t) { box.innerHTML = '<div class="card empty">اختر طلباً من القائمة</div>'; return; }
    if (soft) { const cnt = (S.msgs[t.id] || []).length; await fetchMsgs(t.id); if ((S.msgs[t.id] || []).length === cnt && box.dataset.t === t.id + "|" + t.updated_at + "|" + t.admin_read) return; }
    const draft = ($("rtxt") || {}).value || "", intr = ($("rint") || {}).checked;
    const s = byId(S.si, t.site_id), c = byId(S.cu, t.customer_id), ct = t.contact || {};
    box.dataset.t = t.id + "|" + t.updated_at + "|" + t.admin_read;
    box.innerHTML = '<div class="card det"><div class="dh"><div><h3>#' + t.num + " " + esc(t.subject) + '</h3><div class="sm mut">' + esc(KIND[t.kind] || t.kind) + " · " + fmt(t.created_at) + '</div></div><div class="row" style="display:flex;gap:.4rem;flex-wrap:wrap"><select data-c="st" style="width:auto">' + opts(ST, t.status) + '</select><select data-c="pr" style="width:auto">' + opts(PR, t.priority) + '</select></div></div>' +
      '<div class="mg"><div><b>الموقع</b>' + (s ? '<a href="#" data-a="site" data-v="' + s.id + '">' + esc(s.name) + '</a> ' + pill(s.status, SST[s.status]) : "—") + '</div><div><b>الزبون</b>' + (c ? '<a href="#" data-a="cust" data-v="' + c.id + '">' + esc(c.name) + '</a>' : "—") + '</div><div><b>العنوان</b><span class="ltr">' + esc(host(t.origin) || "—") + '</span></div><div><b>التواصل</b><span class="ltr">' + esc([ct.phone || ct.wa, ct.email].filter(Boolean).join(" · ") || "—") + '</span></div><div><b>أول رد</b>' + (t.first_response_at ? fmt(t.first_response_at) : "لم يُرد بعد") + '</div><div><b>المسؤول</b><input data-c="as" value="' + esc(t.assignee || "") + '" placeholder="اسم المسؤول" style="padding:.2rem .5rem"></div></div>' +
      payHtml(t) + actHtml(t, s) +
      '<div class="th" id="th">' + (S.msgs[t.id] || []).map(m => '<div class="ms ' + m.author + (m.internal ? " int" : "") + '">' + esc(m.body) + '<small>' + ({ customer: "الزبون", admin: "الدعم", system: "النظام" }[m.author]) + (m.internal ? " · ملاحظة داخلية" : "") + " · " + fmt(m.created_at) + '</small></div>').join("") + '</div>' +
      '<div class="rb"><div class="row"><select id="rcan" style="width:auto;flex:1"><option value="">ردود جاهزة…</option>' + CANNED.map((x, i) => '<option value="' + i + '">' + esc(x[0]) + '</option>').join("") + '</select></div><textarea id="rtxt" placeholder="اكتب رداً للزبون…">' + esc(draft) + '</textarea>' +
      '<div class="row"><label style="display:flex;gap:.3rem;align-items:center"><input type="checkbox" id="rint"' + (intr ? " checked" : "") + '> ملاحظة داخلية</label><select id="rst" style="width:auto"><option value="">إبقاء الحالة</option><option value="waiting">بانتظار الزبون</option><option value="resolved">تم الحل</option><option value="open">قيد المعالجة</option></select><span class="spacer" style="flex:1"></span><button class="btn" data-a="send">إرسال</button></div></div></div>';
    $("rcan").onchange = e => { const i = e.target.value; if (i !== "") { $("rtxt").value = CANNED[i][1]; e.target.value = ""; } };
    box.querySelectorAll("[data-c]").forEach(el => el.onchange = () => ticketField(t.id, el.dataset.c, el.value));
    const th = $("th"); if (th) th.scrollTop = th.scrollHeight; 
  }
  function payHtml(t) {
    const p = t.payload || {}, rows = [], L = { name: "الاسم", sub: "الاسم على المنصة", url: "العنوان", mode: "نوع الدومين", domain: "الدومين", site: "الموقع", target_name: "الموقع المستهدف", target_origin: "عنوان الموقع", at: "موعد الحذف", store: "اسم المتجر", names: "الأسماء المطلوبة" };
    const val = (k, v) => k === "mode" ? (DMODE[v] || v) : k === "at" ? fmt(v) : (typeof v === "object" ? JSON.stringify(v) : v);
    const walk = (o, pre) => Object.keys(o || {}).forEach(k => { const v = o[k]; if (v == null || v === "") return; if (k === "items" && Array.isArray(v)) { rows.push('<div><b>الأسماء المطلوبة:</b> ' + v.map(i => '<span class="ltr">' + esc(i.d) + '</span> ' + pill(i.s === "free" ? "active" : i.s === "taken" ? "rejected" : "waiting", { free: "متاح", taken: "محجوز", manual: "يتحقق منه الدعم", unknown: "غير معروف", pending: "قيد الفحص" }[i.s] || i.s)).join(" · ") + '</div>'); return; } if (k === "dns" && typeof v === "object") { rows.push('<div><b>نتيجة فحص DNS:</b> ' + esc(JSON.stringify(v)) + '</div>'); return; } if (v && typeof v === "object" && !Array.isArray(v)) return walk(v, k); rows.push('<div><b>' + esc(L[k] || k) + ':</b> <span class="' + (/url|domain|origin|sub/.test(k) ? "ltr" : "") + '">' + esc(val(k, v)) + '</span></div>'); });
    walk(p); return rows.length ? '<div class="pay">' + rows.join("") + '</div>' : "";
  }
  function actHtml(t, s) {
    const a = [], b = (act, label, cls) => a.push('<button class="btn s ' + (cls || "") + '" data-a="qa" data-v="' + act + '">' + label + '</button>');
    const done = t.status === "resolved" || t.status === "rejected";
    if (t.kind === "site_create") { b("prov", "بدء التجهيز", "o"); b("activate", "تفعيل الموقع وإبلاغ الزبون"); b("reject", "رفض الطلب", "r"); }
    else if (t.kind === "domain_request") { b("domdone", "تم تسجيل الدومين وتفعيله"); b("domtaken", "الأسماء غير متاحة", "o"); }
    else if (t.kind === "domain_link" || t.kind === "domain_dns") { b("domon", "تفعيل الدومين"); b("domdns", "DNS غير صحيح", "o"); }
    else if (t.kind === "site_delete") { b("delsched", "اعتماد الحذف بعد 14 يوماً", "o"); b("delnow", "تنفيذ الحذف الآن", "r"); }
    else if (t.kind === "site_delete_cancel") { b("delcancel", "اعتماد إلغاء الحذف"); }
    if (!done) b("resolve", "إغلاق كمحلول", "g"); else b("reopen", "إعادة فتح", "g");
    return '<div class="act">' + a.join("") + '</div>';
  }
  async function ticketField(id, k, v) {
    const patch = k === "st" ? { status: v } : k === "pr" ? { priority: v } : { assignee: v.trim() || null };
    const r = await sb.from("saas_tickets").update(patch).eq("id", id); if (r.error) return toast("تعذّر الحفظ", r.error.message, true);
    await load(); const t = byId(S.tk, id); if (t) await fetchMsgs(id); detail();
  }
  async function sendReply(t, body, internal, status) {
    const r = await sb.rpc("saas_reply", { p_ticket: t.id, p_body: body, p_internal: !!internal, p_status: status || "" });
    if (r.error) { toast("تعذّر الإرسال", r.error.message, true); return false; } return true;
  }
  async function updSite(id, patch) { const r = await sb.from("saas_sites").update(patch).eq("id", id); if (r.error) { toast("تعذّر تحديث الموقع", r.error.message, true); return false; } return true; }
  async function quick(act) {
    const t = byId(S.tk, S.sel); if (!t) return; const s = byId(S.si, t.site_id), p = t.payload || {}, nw = p.new || {};
    const R = async (msg, status, sitePatch) => { if (sitePatch && s && !(await updSite(s.id, sitePatch))) return; if (msg !== null && !(await sendReply(t, msg, false, status))) return; if (msg === null && status) await sb.from("saas_tickets").update({ status }).eq("id", t.id); await load(); await fetchMsgs(t.id); detail(); toast("تم", "نُفّذ الإجراء وأُبلغ الزبون"); };
    if (act === "prov") return R("بدأنا تجهيز موقعك وسنُعلمك فور جاهزيته.", "open", { status: "provisioning" });
    if (act === "activate") { if (!s) return toast("لا يوجد سجل موقع", "اربط الطلب بموقع أولاً", true); const url = nw.url || s.origin || ""; return R("تم تفعيل موقعك" + (url ? ": " + url : "") + ". يمكنك الدخول إلى لوحة التحكم وإكمال الإعدادات.", "resolved", { status: "active" }); }
    if (act === "reject") { const why = prompt("سبب الرفض (يصل للزبون):", "العنوان المطلوب غير متاح."); if (why === null) return; return R("نعتذر، تعذّر إنشاء الموقع. " + why, "rejected", s ? { status: "deleted" } : null); }
    if (act === "domtaken") return R(CANNED[3][1], "waiting");
    if (act === "domdone") { const d = prompt("الدومين الذي تم تفعيله:", ((p.items || []).find(i => i.s === "free") || {}).d || ""); if (!d) return; return R("تم تسجيل الدومين " + d + " وربطه بموقعك. ستجده فعّالاً خلال وقت قصير.", "resolved", s ? { domain: d.toLowerCase(), domain_mode: "request", domain_status: "connected" } : null); }
    if (act === "domon") { const d = prompt("الدومين المراد تفعيله:", p.domain || (s && s.domain) || ""); if (!d) return; return R("تم تفعيل الدومين " + d + " لموقعك وإصدار شهادة الأمان. قد يستغرق الظهور دقائق.", "resolved", s ? { domain: d.toLowerCase(), domain_mode: "own", domain_status: "connected" } : null); }
    if (act === "domdns") return R(CANNED[4][1], "waiting", s ? { domain_status: "requested" } : null);
    if (act === "delsched") { if (!s) return toast("لا يوجد سجل موقع", "", true); const at = p.at || new Date(Date.now() + 14 * 864e5).toISOString(); return R("تم اعتماد حذف موقعك وسيُحذف نهائياً بتاريخ " + fmt(at) + ". يمكنك إلغاء الحذف قبلها من لوحة التحكم.", "open", { status: "deleting", deletion_at: at }); }
    if (act === "delnow") { if (!s || !confirm("حذف موقع «" + s.name + "» نهائياً الآن؟")) return; return R("تم حذف موقعك نهائياً من المنصة.", "resolved", { status: "deleted" }); }
    if (act === "delcancel") return R("تم إلغاء حذف موقعك وأعيد إلى العمل.", "resolved", s ? { status: "active", deletion_at: null } : null);
    if (act === "resolve") return R(null, "resolved");
    if (act === "reopen") return R(null, "open");
  }

  /* ── المواقع ── */
  const SORD = ["requested", "provisioning", "active", "suspended", "deleting", "deleted"];
  function sites() {
    const sc = s => { const c = byId(S.cu, s.customer_id), n = S.tk.filter(t => t.site_id === s.id && t.status !== "resolved" && t.status !== "rejected").length; return '<div class="sc" data-a="site" data-v="' + s.id + '"><div class="s">' + esc(s.name) + '</div><div class="m ltr">' + esc(s.sub ? s.sub : host(s.origin)) + '</div><div class="m">' + esc(c ? c.name : "—") + ' · ' + esc(DMODE[s.domain_mode] || "") + (s.domain_status !== "none" ? " · " + esc(DST[s.domain_status]) : "") + '</div><div class="m">' + (n ? pill("open", n + " طلب مفتوح") + " " : "") + (s.status === "deleting" && s.deletion_at ? pill("deleting", "حذف " + fmt(s.deletion_at)) : "") + (s.last_seen ? '<span>آخر نشاط ' + ago(s.last_seen) + '</span>' : "") + '</div></div>'; };
    const head = '<div class="top" style="margin-bottom:.7rem"><div class="seg"><button class="' + (S.sv === "board" ? "on" : "") + '" data-a="sv" data-v="board">خط السير</button><button class="' + (S.sv === "table" ? "on" : "") + '" data-a="sv" data-v="table">جدول</button></div><span style="flex:1"></span><button class="btn" data-a="newsite">إضافة موقع</button></div>';
    if (S.sv === "table") return head + '<div class="card tw"><table><tr><th>الموقع</th><th>العنوان</th><th>الزبون</th><th>الدومين</th><th>الحالة</th><th>الخطة</th><th>آخر نشاط</th><th>أُنشئ</th></tr>' + S.si.map(s => '<tr class="clk" data-a="site" data-v="' + s.id + '"><td class="b">' + esc(s.name) + '</td><td class="ltr">' + esc(s.sub ? s.sub : host(s.origin)) + '</td><td>' + esc(custName(s.customer_id) || "—") + '</td><td class="ltr">' + esc(s.domain || "—") + ' ' + (s.domain_status !== "none" ? pill(s.domain_status, DST[s.domain_status]) : "") + '</td><td>' + pill(s.status, SST[s.status]) + '</td><td>' + esc(s.plan || "—") + '</td><td>' + (s.last_seen ? ago(s.last_seen) : "—") + '</td><td>' + fmt(s.created_at) + '</td></tr>').join("") + '</table></div>';
    return head + '<div class="board">' + SORD.filter(k => k !== "deleted" || S.si.some(s => s.status === "deleted")).map(k => { const L = S.si.filter(s => s.status === k); return '<div class="col"><h4><span>' + SST[k] + '</span>' + pill(k, L.length) + '</h4>' + (L.map(sc).join("") || '<div class="empty sm">—</div>') + '</div>'; }).join("") + '</div>';
  }
  function siteModal(id) {
    const s = id ? byId(S.si, id) : { name: "", sub: "", origin: "", domain: "", domain_mode: "platform", domain_status: "none", status: "requested", plan: "", notes: "", customer_id: "" };
    if (!s) return; const tks = S.tk.filter(t => t.site_id === s.id).slice(0, 8);
    modal('<h3>' + (id ? "الموقع: " + esc(s.name) : "موقع جديد") + '</h3><div class="fr"><div><label class="f">اسم الموقع</label><input data-f="name" value="' + esc(s.name) + '"></div><div><label class="f">الاسم على المنصة (sub)</label><input data-f="sub" dir="ltr" value="' + esc(s.sub || "") + '"></div><div><label class="f">عنوان اللوحة (origin)</label><input data-f="origin" dir="ltr" placeholder="https://name.alyssumdz.com" value="' + esc(s.origin || "") + '"></div><div><label class="f">الزبون</label><select data-f="customer_id"><option value="">—</option>' + S.cu.map(c => '<option value="' + c.id + '"' + (c.id === s.customer_id ? " selected" : "") + '>' + esc(c.name) + '</option>').join("") + '</select></div><div><label class="f">الحالة</label><select data-f="status">' + opts(SST, s.status) + '</select></div><div><label class="f">الخطة</label><input data-f="plan" value="' + esc(s.plan || "") + '" list="plans"></div><div><label class="f">نوع الدومين</label><select data-f="domain_mode">' + opts(DMODE, s.domain_mode) + '</select></div><div><label class="f">الدومين</label><input data-f="domain" dir="ltr" value="' + esc(s.domain || "") + '"></div><div><label class="f">حالة الدومين</label><select data-f="domain_status">' + opts(DST, s.domain_status) + '</select></div></div><label class="f">ملاحظات</label><textarea data-f="notes">' + esc(s.notes || "") + '</textarea>' +
      (id ? '<div class="sm mut" style="margin-top:.5rem">أُنشئ ' + fmt(s.created_at) + (s.activated_at ? " · فُعّل " + fmt(s.activated_at) : "") + (s.last_seen ? " · آخر نشاط " + fmt(s.last_seen) : "") + (s.version ? " · نسخة " + esc(s.version) : "") + '</div>' + (tks.length ? '<h3 style="margin-top:.8rem">طلبات الموقع</h3>' + tks.map(t => '<div class="tk" data-a="open" data-v="' + t.id + '" style="margin-bottom:5px"><div class="s">#' + t.num + " " + esc(t.subject) + '</div><div class="m">' + pill(t.status, ST[t.status]) + '<span>' + ago(t.created_at) + '</span></div></div>').join("") : "") : "") +
      '<div class="act" style="margin-top:1rem"><button class="btn" data-a="savesite" data-v="' + (id || "") + '">حفظ</button>' + (s.origin ? '<a class="btn g" target="_blank" rel="noopener" href="' + esc(s.origin) + '/admin.html">فتح لوحة الموقع</a>' : "") + '<button class="btn g" data-a="close">إغلاق</button></div>');
  }
  async function saveSite(id) {
    const m = $("mod"), g = {}; m.querySelectorAll("[data-f]").forEach(e => g[e.dataset.f] = e.value.trim());
    if (!g.name) return toast("اسم الموقع مطلوب", "", true);
    const row = { name: g.name, sub: g.sub ? g.sub.toLowerCase() : null, origin: g.origin ? g.origin.replace(/\/+$/, "").replace(/\/admin\.html$/, "").toLowerCase() : null, customer_id: g.customer_id || null, status: g.status, plan: g.plan || null, domain_mode: g.domain_mode, domain: g.domain || null, domain_status: g.domain_status, notes: g.notes };
    const r = id ? await sb.from("saas_sites").update(row).eq("id", id) : await sb.from("saas_sites").insert(row);
    if (r.error) return toast("تعذّر الحفظ", /duplicate|unique/i.test(r.error.message) ? "الاسم أو العنوان مستعمل لموقع آخر" : r.error.message, true);
    closeModal(); toast("تم الحفظ", ""); load();
  }

  /* ── الزبائن ── */
  function customers() {
    return '<div class="top" style="margin-bottom:.7rem"><input id="cq" placeholder="بحث عن زبون…" value="' + esc(S.cq || "") + '" style="max-width:280px"><span style="flex:1"></span><button class="btn" data-a="newcust">إضافة زبون</button></div><div class="card tw"><table><tr><th>الزبون</th><th>التواصل</th><th>الخطة</th><th>الحالة</th><th>المواقع</th><th>الطلبات</th><th>منذ</th></tr>' + S.cu.map(c => '<tr class="clk" data-a="cust" data-v="' + c.id + '" data-n="' + esc((c.name + " " + (c.email || "") + " " + (c.phone || "")).toLowerCase()) + '"><td class="b">' + esc(c.name) + '</td><td class="ltr">' + esc([c.phone, c.email].filter(Boolean).join(" · ") || "—") + '</td><td>' + esc(c.plan) + '</td><td>' + pill(c.status, CST[c.status]) + '</td><td>' + S.si.filter(s => s.customer_id === c.id && s.status !== "deleted").length + '</td><td>' + S.tk.filter(t => t.customer_id === c.id).length + '</td><td>' + ago(c.created_at) + '</td></tr>').join("") + '</table></div>';
  }
  function custModal(id) {
    const c = id ? byId(S.cu, id) : { name: "", email: "", phone: "", plan: "free", status: "active", notes: "" }; if (!c) return;
    const ss = S.si.filter(s => s.customer_id === c.id), tks = S.tk.filter(t => t.customer_id === c.id).slice(0, 8);
    modal('<h3>' + (id ? "الزبون: " + esc(c.name) : "زبون جديد") + '</h3><div class="fr"><div><label class="f">الاسم</label><input data-f="name" value="' + esc(c.name) + '"></div><div><label class="f">البريد</label><input data-f="email" dir="ltr" value="' + esc(c.email || "") + '"></div><div><label class="f">الهاتف</label><input data-f="phone" dir="ltr" value="' + esc(c.phone || "") + '"></div><div><label class="f">الخطة</label><input data-f="plan" list="plans" value="' + esc(c.plan) + '"></div><div><label class="f">الحالة</label><select data-f="status">' + opts(CST, c.status) + '</select></div></div><label class="f">ملاحظات</label><textarea data-f="notes">' + esc(c.notes || "") + '</textarea>' +
      (id ? '<h3 style="margin-top:.8rem">المواقع</h3>' + (ss.map(s => '<div class="tk" data-a="site" data-v="' + s.id + '" style="margin-bottom:5px"><div class="s">' + esc(s.name) + '</div><div class="m">' + pill(s.status, SST[s.status]) + '<span class="ltr">' + esc(s.domain || host(s.origin)) + '</span></div></div>').join("") || '<div class="mut sm">لا مواقع</div>') + '<h3 style="margin-top:.8rem">آخر الطلبات</h3>' + (tks.map(t => '<div class="tk" data-a="open" data-v="' + t.id + '" style="margin-bottom:5px"><div class="s">#' + t.num + " " + esc(t.subject) + '</div><div class="m">' + pill(t.status, ST[t.status]) + '<span>' + ago(t.created_at) + '</span></div></div>').join("") || '<div class="mut sm">لا طلبات</div>') : "") +
      '<div class="act" style="margin-top:1rem"><button class="btn" data-a="savecust" data-v="' + (id || "") + '">حفظ</button><button class="btn g" data-a="close">إغلاق</button></div>');
  }
  async function saveCust(id) {
    const g = {}; $("mod").querySelectorAll("[data-f]").forEach(e => g[e.dataset.f] = e.value.trim()); if (!g.name) return toast("الاسم مطلوب", "", true);
    const row = { name: g.name, email: g.email || null, phone: g.phone || null, plan: g.plan || "free", status: g.status, notes: g.notes };
    const r = id ? await sb.from("saas_customers").update(row).eq("id", id) : await sb.from("saas_customers").insert(row);
    if (r.error) return toast("تعذّر الحفظ", r.error.message, true); closeModal(); toast("تم الحفظ", ""); load();
  }

  /* ── التحليلات ── */
  function hbars(obj, labels, color) {
    const k = Object.keys(obj || {}), max = Math.max(1, ...k.map(x => obj[x]));
    return k.length ? '<div class="bars">' + k.sort((a, b) => obj[b] - obj[a]).map(x => '<div class="br"><span>' + esc(labels[x] || x) + '</span><span class="t"><i style="width:' + Math.round(100 * obj[x] / max) + '%;' + (color ? "background:" + color : "") + '"></i></span><b>' + obj[x] + '</b></div>').join("") + '</div>' : '<div class="empty sm">لا بيانات</div>';
  }
  function dayChart(rows) {
    if (!rows || !rows.length) return '<div class="empty sm">لا بيانات</div>';
    const W = 640, H = 190, pl = 28, pb = 24, pt = 8, n = rows.length, max = Math.max(1, ...rows.map(r => Math.max(r.created, r.resolved))), bw = (W - pl) / n, y = v => pt + (H - pt - pb) * (1 - v / max);
    let g = ""; for (let i = 0; i <= 4; i++) { const v = Math.round(max * i / 4); g += '<line x1="' + pl + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="rgba(255,255,255,.08)"/><text x="' + (pl - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>'; }
    const bars = rows.map((r, i) => '<rect x="' + (pl + i * bw + bw * 0.15) + '" y="' + y(r.created) + '" width="' + (bw * 0.7) + '" height="' + (H - pb - y(r.created)) + '" rx="2" fill="#38bdf8"><title>' + r.d + ": " + r.created + ' طلب</title></rect>').join("");
    const pts = rows.map((r, i) => (pl + i * bw + bw / 2) + "," + y(r.resolved)).join(" ");
    const step = Math.ceil(n / 8), lab = rows.map((r, i) => i % step === 0 ? '<text x="' + (pl + i * bw + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + r.d.slice(5) + '</text>' : "").join("");
    return '<svg class="ch" viewBox="0 0 ' + W + " " + H + '" direction="ltr">' + g + bars + '<polyline points="' + pts + '" fill="none" stroke="#86f06a" stroke-width="2.2"/>' + lab + '</svg><div class="lg"><span><i style="background:#38bdf8"></i>طلبات جديدة</span><span><i style="background:#86f06a"></i>طلبات محلولة</span></div>';
  }
  function weekChart(rows) {
    if (!rows || !rows.length) return ""; const W = 640, H = 130, n = rows.length, max = Math.max(1, ...rows.map(r => r.n)), bw = W / n;
    return '<svg class="ch" viewBox="0 0 ' + W + " " + H + '" direction="ltr">' + rows.map((r, i) => { const h = (H - 36) * r.n / max; return '<rect x="' + (i * bw + bw * 0.2) + '" y="' + (H - 22 - h) + '" width="' + (bw * 0.6) + '" height="' + h + '" rx="3" fill="#a78bfa"><title>' + r.w + ": " + r.n + '</title></rect><text x="' + (i * bw + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + r.w.slice(5) + '</text><text x="' + (i * bw + bw / 2) + '" y="' + (H - 26 - h) + '" text-anchor="middle">' + (r.n || "") + '</text>'; }).join("") + '</svg>';
  }
  function statsView() {
    const st = S.stats; if (!st) return '<div class="card empty">جارٍ التحميل…</div>';
    const t = st.tickets, r = st.response, s = st.sites, c = st.customers, nz = v => v == null ? "—" : v;
    const mins = v => v == null ? "—" : v < 60 ? v + " د" : (v / 60).toFixed(1) + " س";
    return '<div class="top" style="margin-bottom:.7rem"><div class="seg">' + [7, 30, 90].map(d => '<button class="' + (S.days === d ? "on" : "") + '" data-a="days" data-v="' + d + '">' + d + ' يوماً</button>').join("") + '</div></div>' +
      '<div class="grid kpis">' + kpi(t.window, "طلبات في الفترة", "var(--blu)") + kpi(nz(r.resolved_rate) === "—" ? "—" : r.resolved_rate + "%", "نسبة المعالجة", "var(--grn)") + kpi(mins(r.avg_first_min), "متوسط زمن أول رد", "var(--amb)") + kpi(r.avg_resolve_hours == null ? "—" : r.avg_resolve_hours + " س", "متوسط زمن الحل", "var(--vio)") + kpi(s.new_window, "مواقع جديدة", "var(--mint)") + kpi(c.new_window, "زبائن جدد", "var(--mint)") + kpi(s.avg_activation_hours == null ? "—" : s.avg_activation_hours + " س", "متوسط زمن تفعيل موقع", "var(--amb)") + kpi(r.sla_breached, "تجاوز الرد 24 س", r.sla_breached ? "var(--red)" : "var(--grn)") + '</div>' +
      '<div class="card" style="margin-top:12px"><h3>الطلبات يومياً</h3>' + dayChart(st.per_day) + '</div>' +
      '<div class="grid two" style="margin-top:12px"><div class="card"><h3>الطلبات حسب النوع</h3>' + hbars(st.by_kind, KIND) + '</div><div class="card"><h3>حالة الطلبات الآن</h3>' + hbars({ new: t.new, open: t.open, waiting: t.waiting, resolved: t.resolved, rejected: t.rejected }, ST) + '</div>' +
      '<div class="card"><h3>المواقع حسب الحالة</h3>' + hbars(s.by_status, SST, "linear-gradient(90deg,#7c3aed,#a78bfa)") + '</div><div class="card"><h3>الزبائن حسب الخطة</h3>' + hbars(c.by_plan, {}, "linear-gradient(90deg,#0ea5e9,#38bdf8)") + '</div>' +
      '<div class="card"><h3>مواقع جديدة أسبوعياً</h3>' + weekChart(s.per_week) + '</div><div class="card"><h3>أكثر الزبائن طلباً للدعم</h3>' + ((st.top_customers || []).length ? '<table>' + st.top_customers.map(x => '<tr class="clk" data-a="cust" data-v="' + x.id + '"><td>' + esc(x.name) + '</td><td><b>' + x.n + '</b></td></tr>').join("") + '</table>' : '<div class="empty sm">لا بيانات</div>') + '</div></div>';
  }

  /* ── الإعدادات ── */
  function settings() {
    const p = pref(), perm = "Notification" in window ? Notification.permission : "unsupported";
    return '<div class="grid two"><div class="card"><h3>الإشعارات المباشرة</h3><p class="mut sm">تصلك الإشعارات فور وصول طلب جديد أو رد من زبون، داخل الصفحة وبصوت تنبيه، وعلى سطح المكتب إن فعّلته (والصفحة مفتوحة في أي نافذة).</p>' +
      '<label style="display:flex;gap:.5rem;align-items:center;margin:.5rem 0"><input type="checkbox" id="psound"' + (p.sound ? " checked" : "") + '> صوت التنبيه</label>' +
      '<label style="display:flex;gap:.5rem;align-items:center;margin:.5rem 0"><input type="checkbox" id="pdesk"' + (p.desktop && perm === "granted" ? " checked" : "") + (perm === "unsupported" || perm === "denied" ? " disabled" : "") + '> إشعارات سطح المكتب' + (perm === "denied" ? ' <span class="mut sm">(محظورة من المتصفح)</span>' : "") + '</label>' +
      '<div class="act"><button class="btn g s" data-a="testnotif">اختبار الإشعار</button></div><div class="sm mut">حالة الاتصال المباشر: ' + (S.live ? "متصل" : "تحديث دوري كل " + Math.round((C.POLL_MS || 25000) / 1000) + " ثانية") + '</div></div>' +
      '<div class="card"><h3>الحساب</h3><div class="mg"><div><b>البريد</b><span class="ltr">' + esc(S.user) + '</span></div></div><label class="f">كلمة مرور جديدة (8 أحرف على الأقل)</label><input type="password" id="npw" dir="ltr" autocomplete="new-password"><div class="act"><button class="btn" data-a="chpw">تغيير كلمة المرور</button></div></div>' +
      '<div class="card"><h3>كيف تصلك الطلبات؟</h3><p class="mut sm">لوحات الزبائن (ومنها لوحة أليسوم) ترسل طلباتها هنا مباشرة بدل واتساب: إنشاء موقع، حذف/إلغاء حذف، طلب دومين، ربط دومين خاص، والدعم الفني. كل طلب يُنشئ سجلاً ويصلك بإشعار فوري، وتردّ عليه من هنا فيصل الرد إلى لوحة الزبون.</p></div></div>';
  }

  /* ── النوافذ والأحداث ── */
  function modal(html) { closeModal(); const d = document.createElement("div"); d.className = "mbg"; d.id = "mbg"; d.innerHTML = '<div class="mod" id="mod">' + html + '</div><datalist id="plans"><option>free</option><option>basic</option><option>pro</option><option>owner</option></datalist>'; d.addEventListener("mousedown", e => { if (e.target === d) closeModal(); }); d.onclick = onClick; document.body.appendChild(d); }
  function closeModal() { const m = $("mbg"); if (m) m.remove(); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  function wire() {
    const v = $("view"); v.onclick = onClick;
    const cq = $("cq"); if (cq) { const ap = () => { S.cq = cq.value; const q = cq.value.trim().toLowerCase(); v.querySelectorAll("tr[data-n]").forEach(r => r.hidden = !!q && r.dataset.n.indexOf(q) < 0); }; cq.oninput = ap; ap(); }
    const ps = $("psound"); if (ps) ps.onchange = () => setPref({ sound: ps.checked });
    const pd = $("pdesk"); if (pd) pd.onchange = async () => { if (pd.checked) { const r = await Notification.requestPermission(); if (r !== "granted") { pd.checked = false; setPref({ desktop: false }); return; } } setPref({ desktop: pd.checked }); };
  }
  async function onClick(e) {
    const el = e.target.closest("[data-a]"); if (!el) return; const a = el.dataset.a, v = el.dataset.v; if (el.tagName === "A" && el.getAttribute("href") === "#") e.preventDefault();
    if (a === "go") return go(v);
    if (a === "open") { closeModal(); return openTicket(v); }
    if (a === "site") { return siteModal(v); }
    if (a === "cust") { return custModal(v); }
    if (a === "newsite") return siteModal("");
    if (a === "newcust") return custModal("");
    if (a === "savesite") return saveSite(v);
    if (a === "savecust") return saveCust(v);
    if (a === "close") return closeModal();
    if (a === "sv") { S.sv = v; return render(); }
    if (a === "days") { S.days = +v; await loadStats(); return render(); }
    if (a === "qa") { if (el.disabled) return; el.disabled = true; try { await quick(v); } finally { el.disabled = false; } return; }
    if (a === "send") {
      const t = byId(S.tk, S.sel), txt = ($("rtxt") || {}).value.trim(); if (!t || !txt) return toast("اكتب نص الرد", "", true);
      el.disabled = true; const ok = await sendReply(t, txt, $("rint").checked, $("rst").value); el.disabled = false;
      if (ok) { $("rtxt").value = ""; await load(); await fetchMsgs(t.id); detail(); } return;
    }
    if (a === "testnotif") return ping("إشعار تجريبي", "هكذا تصلك الطلبات الجديدة.");
    if (a === "chpw") { const pw = $("npw").value; if (pw.length < 8) return toast("كلمة المرور قصيرة", "8 أحرف على الأقل", true); const r = await sb.auth.updateUser({ password: pw }); if (r.error) return toast("تعذّر التغيير", r.error.message, true); $("npw").value = ""; return toast("تم تغيير كلمة المرور", ""); }
  }
  boot();
})();
