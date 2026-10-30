/* الأدوار والمصادقة الثنائية وسجلّ النشاط للوحة (v1.89.155).
   النموذج نقي وقابل للاختبار (PERMS/ROLES/tabAllowed/summarize)؛ الفرض الحقيقي في الخادم (سياسات الطلبات + محفّز + سجلّ) —
   هذه الوحدة تُخفي ما لا يحقّ للموظف رؤيته وتدير شاشة «الفريق والأمان». أي قسم غير مذكور في TAB_PERM يبقى للمالك فقط (رفض افتراضي). */
(function (root) {
  "use strict";
  /* READ_ONLY: صلاحيات تفتح أقساماً للقراءة فقط (الخادم يرفض الكتابة). soon: صلاحية مسجَّلة لكن بياناتها (منتجات/ملفات النشر) لا تصل الموظف بعد، فلا تُمنح من الواجهة ولا تفتح قسماً. تُنقل من SOON حين تُفرض في الخادم. */
  const PERMS = [
    { id: "orders", label: "عرض الطلبات" },
    { id: "orders.write", label: "تأكيد/إلغاء الطلبات وتسجيل نتيجة الاتصال" },
    { id: "orders.edit", label: "تعديل بيانات الطلب (الاسم، العنوان، السعر)" },
    { id: "orders.create", label: "إنشاء طلب يدوي" },
    { id: "orders.delete", label: "حذف الطلبات" },
    { id: "callcenter", label: "مركز الاتصال" },
    { id: "analytics", label: "لوحة المبيعات والتقارير (من الطلبات)" },
    { id: "customers", label: "العملاء (عرض)" },
    { id: "finance", label: "المالية والمدفوعات والتكاليف (عرض)" },
    { id: "ship", label: "الشحن وشركات التوصيل", soon: true },
    { id: "products", label: "المنتجات والمخزون", soon: true },
    { id: "marketing", label: "التسويق (الأكواد، الولاء، السوشيال، البكسلات)", soon: true },
    { id: "site", label: "تصميم الموقع وصفحاته", soon: true },
    { id: "pack", label: "تجهيز الطلبات وطباعة وصل التجهيز (بلا أرقام الهاتف ولا الأسعار ولا المالية)" },
  ];
  const SOON = PERMS.filter(p => p.soon).map(p => p.id);
  const RO_TABS = { finance: 1, payments: 1, costs: 1, customers: 1 };      // أقسام تُفتح للموظف قراءةً فقط
  const ROLES = {
    owner: { label: "المالك", perms: ["*"] },
    manager: { label: "مدير مساعد", perms: ["orders", "orders.write", "orders.edit", "orders.create", "orders.delete", "callcenter", "analytics", "customers"] },
    agent: { label: "موظف اتصال", perms: ["orders", "orders.write", "callcenter"] },
    support: { label: "دعم الزبائن", perms: ["orders", "orders.write", "orders.edit", "callcenter", "customers"] },
    accountant: { label: "محاسب", perms: ["orders", "analytics", "finance", "customers"] },
    warehouse: { label: "أمين المخزن", perms: ["pack"] },
  };
  const TAB_PERM = {
    home: "analytics", orders: "orders", callcenter: "callcenter",
    shipped: "ship", delivery: "ship", fees: "ship",
    finance: "finance", payments: "finance", costs: "finance",
    customers: "customers", repeat: "marketing", coupons: "marketing", upsell: "marketing", loyalty: "marketing", social: "marketing", pixels: "marketing",
    reports: "analytics", pack: "pack",
    products: "products", bulkp: "products", inventory: "products", categories: "products", attributes: "products", audit: "products",
    seo: "site", blog: "site", builder: "site", pbgen: "site", imgtools: "site", imggen: "site", theme: "site", chromeh: "site", chromef: "site", checkout: "site", tpl: "site",
  };
  const APP_PERM = { builder: "site", smart: "site", imggen: "site", cloner: "site", floaters: "site" };
  const SELF = ["team", "admtheme"];        // متاحة لكل من سجّل الدخول (أمان حسابه ومظهر لوحته)
  const SELF_APPS = ["ask", "voice"];

  const has = (me, p) => !!me && (me.owner === true || (SOON.indexOf(p) < 0 && Array.isArray(me.perms) && (me.perms.indexOf("*") >= 0 || me.perms.indexOf(p) >= 0)));
  function tabAllowed(me, tab) {
    if (!me) return false; if (me.owner === true) return true; if (SELF.indexOf(tab) >= 0) return true;
    const p = TAB_PERM[tab]; return p ? has(me, p) : false;
  }
  function appAllowed(me, app) { if (!me) return false; if (me.owner === true || SELF_APPS.indexOf(app) >= 0) return true; const p = APP_PERM[app]; return p ? has(me, p) : false; }
  const LAND = ["callcenter", "orders", "pack", "home", "finance", "customers", "products", "reports", "team"];
  function firstTab(me) { for (const t of LAND) if (tabAllowed(me, t)) return t; return "team"; }
  /* نتيجة الاتصال المسجَّلة في الملاحظة (to_status لأحداث order.call = وسوم الملاحظة): 📞1..3 غير متاح، ⏰ لاحقاً، 📅 غداً/مؤجَّل، 📵 رقم خاطئ، 🏠 عنوان معدَّل */
  function callKinds(a, marks, n) {
    const m = String(marks || ""); if (!m) return;
    if (/📞1/.test(m)) a.try1 += n; if (/📞2/.test(m)) a.try2 += n; if (/📞3/.test(m)) a.try3 += n;
    if (/📅/.test(m)) a.tomorrow += n; else if (/⏰/.test(m)) a.later += n;
    if (/📵/.test(m)) a.wrong += n; if (/🏠/.test(m)) a.addr += n;
  }
  function summarize(rows) {
    const by = {};
    (rows || []).forEach(r => {
      const a = by[r.actor] || (by[r.actor] = { actor: r.actor, role: r.role, confirmed: 0, cancelled: 0, otherStatus: 0, calls: 0, edits: 0, created: 0, deleted: 0, logins: 0, try1: 0, try2: 0, try3: 0, later: 0, tomorrow: 0, wrong: 0, addr: 0, last: "" });
      const n = +r.n || 0;
      if (r.action === "order.status") { if (r.to_status === "confirmee") a.confirmed += n; else if (r.to_status === "annulee") a.cancelled += n; else a.otherStatus += n; }
      else if (r.action === "order.call") { a.calls += n; callKinds(a, r.to_status, n); } else if (r.action === "order.edit") a.edits += n; else if (r.action === "order.create") a.created += n;
      else if (r.action === "order.delete") a.deleted += n; else if (r.action === "login") a.logins += n;
      if (r.last_at && r.last_at > a.last) a.last = r.last_at;
    });
    return Object.values(by).map(a => Object.assign(a, { rate: a.confirmed + a.cancelled ? Math.round(a.confirmed / (a.confirmed + a.cancelled) * 100) : null }))
      .sort((x, y) => y.confirmed - x.confirmed || y.calls - x.calls);
  }
  /* أسباب الإلغاء (وسم ❌سبب:<مفتاح> في ملاحظة الطلب ← حقل reason في سجلّ التدقيق) */
  const CANCEL_REASONS = { expensive: "السعر غالٍ", changed: "غيّر رأيه", duplicate: "طلب مكرّر", notordered: "لم يطلب", later: "سيشتري لاحقاً", far: "التوصيل بعيد/بطيء", other: "سبب آخر" };
  /* تلوين زمن أول استجابة: ≤15 د أخضر، ≤60 د أصفر، أكثر أحمر */
  const respTone = m => (m == null ? "" : m <= 15 ? "#d4ff4d" : m <= 60 ? "#fcd34d" : "#fca5a5");
  const fmtMin = m => (m == null ? "—" : m < 90 ? Math.round(m) + " د" : (m / 60).toFixed(1) + " س");
  /* هدف كل موظفة (callgoal.per[actor] يغلب الافتراضي)، وتوزيع الطلبات المسبق: وزن كل موظفة (0 = خارج التوزيع) وإسناد ثابت بتجزئة معرّف الطلب
     (نفس الطلب ← نفس الموظفة دائماً دون تخزين، فلا يتبدّل المسند إليه حين تتغيّر القائمة) */
  const goalFor = (g, actor) => { g = g || {}; const p = (g.per && actor && g.per[actor]) || {}; return { daily: +p.daily || +g.daily || 0, rate: +p.rate || +g.rate || 0 }; };
  const fnv = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  /* المسند إليها: وسم يدوي 👥 في ملاحظة الطلب (يسبق كل شيء)، ثم بحسب وضع التوزيع: company (شركة التوصيل ← مندوبات)، wilaya (الولاية ← مندوبات)،
     manual (حر: لا إسناد إلا يدوياً)، وإلا الحصص weights. الاختيار داخل القائمة بتجزئة ثابتة لمعرّف الطلب. يقبل معرّفاً نصياً أو كائن الطلب {id,note,company,wid,wpar}. */
  function assigneeOf(o, assign) {
    const ord = o && typeof o === "object" ? o : { id: o }; if (!assign || !assign.on) return "";
    const m = String(ord.note || "").match(/👥(\S+)/); if (m) return m[1].toLowerCase();
    const pick = list => { const l = [...new Set((list || []).map(x => String(x).toLowerCase()).filter(Boolean))].sort(); return l.length ? l[fnv(String(ord.id)) % l.length] : ""; };
    const mode = assign.mode || "weights";
    if (mode === "manual") return "";
    if (mode === "company") { const r = pick((assign.byCo || {})[ord.company || ""]); if (r) return r; }
    else if (mode === "wilaya") { const bw = assign.byWil || {}, r = pick(bw[String(ord.wid || "")]) || pick(bw[String(ord.wpar || "")]); if (r) return r; }
    const w = assign.weights || {}, ks = Object.keys(w).filter(k => Math.round(+w[k]) > 0).sort();
    if (!ks.length) return ""; const tot = ks.reduce((t, k) => t + Math.round(+w[k]), 0); let r = fnv(String(ord.id)) % tot;
    for (const k of ks) { const x = Math.round(+w[k]); if (r < x) return k; r -= x; } return "";
  }
  /* هل هذه الموظفة ضمن خطة التوزيع (فترى طلباتها أولاً وتُخفى عنها طلبات غيرها)؟ */
  function inPlan(assign, who) {
    if (!assign || !assign.on || !who) return false; who = String(who).toLowerCase();
    if (Math.round(+((assign.weights || {})[who]) || 0) > 0) return true;
    const lists = [].concat(Object.values(assign.byCo || {}), Object.values(assign.byWil || {}));
    return lists.some(l => (l || []).some(x => String(x).toLowerCase() === who));
  }
  /* ترتيب الفريق: أكثر تأكيدات، ثم أعلى نسبة، ثم أسرع استجابة */
  function leaderboard(rows, perfRows) {
    return (rows || []).filter(r => r.confirmed + r.cancelled > 0).map(r => { const pf = (perfRows || []).find(x => x.actor === r.actor); return { actor: r.actor, confirmed: r.confirmed, rate: r.rate, med: pf ? pf.med_min : null }; })
      .sort((a, b) => b.confirmed - a.confirmed || (b.rate || 0) - (a.rate || 0) || (a.med == null ? 1e9 : a.med) - (b.med == null ? 1e9 : b.med)).map((x, i) => Object.assign(x, { rank: i + 1 }));
  }
  const ACTION_LBL = { "order.status": "تغيير حالة طلب", "order.call": "نتيجة اتصال", "order.edit": "تعديل طلب", "order.create": "إنشاء طلب", "order.delete": "حذف طلب", "order.packed": "تجهيز طلب", login: "دخول", logout: "خروج", "mfa.enroll": "تفعيل المصادقة الثنائية", "mfa.disable": "إيقاف المصادقة الثنائية", "mfa.verify_fail": "رمز مصادقة خاطئ", "staff.create": "إضافة موظف", "staff.update": "تعديل موظف", "staff.disable": "إيقاف موظف", "staff.password": "كلمة مرور موظف", "staff.reset_mfa": "إعادة ضبط مصادقة موظف", "staff.delete": "حذف موظف" };
  const STATUS_LBL = { nouvelle: "جديد", confirmee: "مؤكد", annulee: "ملغى", expediee: "مرسل", livree: "مسلَّم", echec: "فشل" };

  const model = { PERMS, SOON, RO_TABS, ROLES, TAB_PERM, APP_PERM, has, tabAllowed, appAllowed, firstTab, summarize, ACTION_LBL, CANCEL_REASONS, respTone, fmtMin, goalFor, assigneeOf, inPlan, leaderboard };
  if (typeof module !== "undefined" && module.exports) { module.exports = model; }
  if (typeof document === "undefined") return;

  /* ═══════════════ الواجهة ═══════════════ */
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { me: null, days: 7, team: null, stats: null, perf: null, audit: null, enroll: null, mfa: null, busy: false };
  const backend = () => (typeof PHPAPI !== "undefined" && PHPAPI.on()) ? "php" : (typeof API !== "undefined" && API.sb && API.sb.enabled() && API.sb.session()) ? "sb" : null;
  const ERR = { unauthorized: "غير مصرّح", invalid_email: "بريد غير صالح", invalid_role: "دور غير صالح", weak_password: "كلمة المرور ضعيفة (10 أحرف على الأقل)", is_owner: "هذا الحساب هو المالك", not_found: "غير موجود", create_failed: "تعذّر إنشاء الحساب" };

  /* ── هوية صاحب الجلسة ── */
  async function boot() {
    const b = backend();
    if (!b) { S.me = { owner: true, role: "owner", perms: ["*"], email: "" }; return S.me; }
    let me = null;
    if (b === "sb") { me = await API.sb.me(); for (let n = 0; n < 3 && !me && API.sb._meErr && API.sb.session(); n++) { await new Promise(r => setTimeout(r, 1200)); me = await API.sb.me(); } }       // عطل مؤقت (شبكة/تجديد الجلسة) لا يعني فقدان الصلاحية
    else { const r = await PHPAPI.call("me", { method: "GET" }).catch(() => ({ ok: false, j: {} })); const j = r.j || {}; me = j.admin ? { owner: true, role: "owner", perms: ["*"], email: "", mfa: !!j.mfa } : (j.role ? { owner: false, role: j.role, perms: j.perms || [], email: j.user || "", name: j.name || "", mfa: !!j.mfa } : null); }
    S.me = me && me.role ? me : null; return S.me;
  }
  const can = p => has(S.me, p);
  const isRO = () => !!S.me && !S.me.owner;                  // غير المالك لا يكتب في التخزين الخاص ولا ملفات النشر
  let roMsgAt = 0;
  function denyWrite() { if (!isRO()) return false; if (Date.now() - roMsgAt > 8000) { roMsgAt = Date.now(); if (typeof toast === "function") toast("⛔ عرض فقط — التعديل للمالك"); } return true; }
  const allowed = t => !S.me || tabAllowed(S.me, t);        // بلا هوية معروفة (وضع قديم) لا قيود

  /* ── إخفاء ما لا يحق للموظف (الخادم يفرض الأصل) ── */
  function css() {
    if ($("rl-css")) return; const st = document.createElement("style"); st.id = "rl-css";
    st.textContent = `html.rl-staff .rl-hid,html.rl-staff [data-owner]{display:none!important}
.rl-robar{margin:0 0 .8rem;padding:.55rem .8rem;border-radius:12px;font-weight:800;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.5)}
#rl{max-width:980px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:1rem}#rl .card{padding:1.1rem;min-width:0;max-width:100%;overflow-x:auto}#rl input,#rl select,#rl textarea{max-width:100%;box-sizing:border-box}@media(max-width:700px){#rl .card{padding:.8rem}#rl .rl-row>*{flex:1 1 100%;min-width:0}#rl .rl-row>.rl-b,#rl .rl-row>.rl-chip{flex:1 1 auto}#rl table{font-size:.8rem}#rl .rl-perms{grid-template-columns:1fr}#rl .rl-qr img,#rl .rl-qr svg{width:150px;height:150px}}#rl h3{margin:.1rem 0 .6rem}#rl .rl-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
#rl .rl-chip{padding:.25rem .65rem;border-radius:999px;font-weight:800;font-size:.8rem;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07)}
#rl .rl-ok{background:rgba(170,220,10,.22);border-color:rgba(170,220,10,.55)}#rl .rl-no{background:rgba(245,158,11,.2);border-color:rgba(245,158,11,.55)}
#rl table{width:100%;border-collapse:collapse;font-size:.88rem}#rl th,#rl td{padding:.5rem .45rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;vertical-align:middle}
#rl .rl-b{padding:.5rem .9rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 -2px 4px rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.2);backdrop-filter:blur(6px);transition:transform .15s,background .15s}
#rl .rl-b:hover{transform:translateY(-2px)}#rl .rl-b.g{background:linear-gradient(180deg,rgba(170,220,10,.45),rgba(170,220,10,.16));border-color:rgba(170,220,10,.6)}#rl .rl-b.r{background:linear-gradient(180deg,rgba(239,68,68,.4),rgba(239,68,68,.14));border-color:rgba(239,68,68,.55)}#rl .rl-b.o{background:linear-gradient(180deg,rgba(245,158,11,.42),rgba(245,158,11,.15));border-color:rgba(245,158,11,.6)}
#rl .rl-b.s{padding:.3rem .6rem;font-size:.8rem}#rl input,#rl select{padding:.5rem .6rem;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:inherit;font:inherit}
#rl .rl-perms{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.3rem .8rem;margin:.6rem 0}#rl .rl-perms label{display:flex;gap:.4rem;align-items:center;font-size:.86rem}
#rl .rl-qr{display:flex;gap:1rem;flex-wrap:wrap;align-items:center}#rl .rl-qr img,#rl .rl-qr svg{width:190px;height:190px;background:#fff;padding:8px;border-radius:12px}#rl code{direction:ltr;display:inline-block;padding:.2rem .5rem;border-radius:8px;background:rgba(255,255,255,.1);word-break:break-all}
#rl .rl-m{opacity:.75;font-size:.85rem;line-height:1.7}#rl .rl-warn{padding:.6rem .8rem;border-radius:12px;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.5)}
#login-otp{letter-spacing:.3em;text-align:center}
html.white #rl .rl-chip,html.white #rl input,html.white #rl select,html.white #rl code{background:#f3f5f9;border-color:#d2d9e3;color:#0f172a}html.white #rl th,html.white #rl td{border-color:#e3e7ed}
html.white #rl .rl-b{color:#fff;background:linear-gradient(180deg,#64748b,#475569)}html.white #rl .rl-b.g{background:linear-gradient(180deg,#22c55e,#15803d)}html.white #rl .rl-b.r{background:linear-gradient(180deg,#ef4444,#b91c1c)}html.white #rl .rl-b.o{background:linear-gradient(180deg,#f59e0b,#b45309)}`;
    document.head.appendChild(st);
  }
  function hideNav() {
    const me = S.me; document.documentElement.classList.toggle("rl-staff", !!me && !me.owner);
    document.querySelectorAll(".nav-btn").forEach(b => {
      const oc = b.getAttribute("onclick") || "", m = /Admin\.tab\('(\w+)'/.exec(oc), a = b.dataset.app;
      let ok = true;
      if (m) ok = tabAllowed(me, m[1]);
      else if (a) ok = appAllowed(me, a);
      else if (/AdminNav\.tpl/.test(oc)) ok = tabAllowed(me, "tpl");
      b.classList.toggle("rl-hid", !ok);
    });
    document.querySelectorAll("#nav-groups .ng").forEach(g => {
      const k = g.dataset.g || g.dataset.grp; if (!k) return;
      const vis = [...document.querySelectorAll('.nav-btn[data-grp="' + k + '"]')].filter(b => !b.classList.contains("rl-hid") && !b.classList.contains("nav-hid") && !b.classList.contains("nav-work")).length;
      g.classList.toggle("rl-hid", vis === 0);
    });
  }
  function roBar(t) {
    const el = $("tab-" + t); if (!el || el.querySelector(":scope > .rl-robar")) return;
    const b = document.createElement("div"); b.className = "rl-robar"; b.textContent = "👁️ عرض فقط — حفظ التعديلات للمالك"; el.prepend(b);
  }
  function guardWrites() {
    if (typeof Priv !== "undefined" && Priv.set && !Priv.set._rl) { const o = Priv.set; Priv.set = async function () { if (denyWrite()) return; return o.apply(this, arguments); }; Priv.set._rl = true; }
    if (typeof GH !== "undefined" && GH.putFile && !GH.putFile._rl) { const o = GH.putFile; GH.putFile = function () { if (isRO()) { denyWrite(); return Promise.reject(new Error("عرض فقط — التعديل للمالك")); } return o.apply(this, arguments); }; GH.putFile._rl = true; }
  }
  function wrapTab() {
    guardWrites();
    if (typeof Admin === "undefined" || !Admin.tab || Admin.tab._rl) return;
    const orig = Admin.tab;
    const fn = function (t, btn) {
      if (S.me && !tabAllowed(S.me, t)) { if (typeof toast === "function") toast("⛔ ليست لديك صلاحية لهذا القسم"); return; }
      const r = orig.call(this, t, btn);
      if (isRO() && RO_TABS[t]) roBar(t);
      return r;
    };
    fn._rl = true; Admin.tab = fn;
    if (!Admin._rlAuto && Admin.autoOpt) { const ao = Admin.autoOpt; Admin._rlAuto = true; Admin.autoOpt = function (k) { if (S.me && !S.me.owner && !can("ship")) return false; return ao.apply(this, arguments); }; }
  }
  function apply() {
    css(); mountTab(); hideNav(); wrapTab();
    // الغلاف الداخلي لبعض الأقسام يُركَّب بعد الدخول بقليل فنعيد التغليف ونعيد الإخفاء
    [700, 2200, 6000].forEach(ms => setTimeout(() => { wrapTab(); hideNav(); }, ms));
    const h = document.querySelector(".top h1"); if (h && S.me && !S.me.owner) h.title = (ROLES[S.me.role] || {}).label || "";
    if (b2() === "sb" && S.me && !S.me.legacy && !sessionStorage.getItem("rl_login_logged")) { try { sessionStorage.setItem("rl_login_logged", "1"); } catch (e) { } API.sb.rpc("audit_event", { p_action: "login", p_ref: "", p_detail: {} }); }
  }
  const b2 = backend;
  /* الصفحة الأولى للموظف بعد اكتمال تحميل الطلبات (يستدعيها Admin.load في آخره) */
  function land() { if (S.me && !S.me.owner && typeof Admin !== "undefined") { try { Admin.tab(firstTab(S.me)); } catch (e) { } } }

  /* ── واجهة «الفريق والأمان» ── */
  function mountTab() {
    if (!$("tab-team")) {
      const d = document.createElement("div"); d.id = "tab-team"; d.className = "hidden admin-extra-tab"; d.innerHTML = '<div id="rl"></div>';
      const anchor = $("tab-callcenter") || document.querySelector(".admin-extra-tab"); (anchor ? anchor.parentNode : document.body).appendChild(d);
    }
    if (!document.querySelector('.nav-btn[onclick*="\'team\'"]')) {
      const first = document.querySelector('.nav-btn[data-grp="gen"]');
      if (first) {
        const b = document.createElement("button"); b.className = "nav-btn"; b.dataset.grp = "gen"; b.setAttribute("onclick", "Admin.tab('team',this)");
        b.innerHTML = '<span class="nav-ic">🛡️</span><span class="nav-txt"><b>الفريق والأمان</b><small>أمان حسابك والمصادقة الثنائية، وحسابات الموظفين وصلاحياتهم وسجلّ نشاطهم</small></span>';
        const last = [...document.querySelectorAll('.nav-btn[data-grp="gen"]')].pop(); last.after(b);
      }
    }
    const w = () => {
      if (typeof Admin === "undefined" || !Admin.tab || Admin._rlTeam) return; const orig = Admin.tab; Admin._rlTeam = true;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn); const el = $("tab-team"); if (el) el.classList.toggle("hidden", t !== "team"); if (t === "team") render(); return r; };
    };
    w();
  }
  async function api(action, data) {
    const b = backend();
    if (b === "php") {
      const r = await PHPAPI.call("team", { method: "POST", body: JSON.stringify(Object.assign({ action }, data || {})) }); const j = r.j || {};
      if (!r.ok || j.error) throw new Error(j.detail || ERR[j.error] || j.error || "خطأ " + r.status); return j;
    }
    const t = await API.sb.token(); if (!t) throw new Error("انتهت الجلسة");
    const r = await fetch(API.sb.url("/functions/v1/staff-admin"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify(Object.assign({ action }, data || {})) });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.detail || ERR[j.error] || j.error || "خطأ " + r.status); return j;
  }
  const when = s => { if (!s) return "—"; const d = new Date(s); return isNaN(d) ? "—" : d.toLocaleString("fr-DZ", { dateStyle: "short", timeStyle: "short" }); };
  const label = r => (ROLES[r] || {}).label || r;
  function genPw() { const a = new Uint32Array(14); crypto.getRandomValues(a); const cs = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; return [...a].map(x => cs[x % cs.length]).join("") + "7"; }

  const MFA = {
    async status() {
      if (backend() === "php") { const r = await PHPAPI.call("mfa", { method: "POST", body: JSON.stringify({ action: "status" }) }); return { enabled: !!(r.j && r.j.enabled), factors: [], recovery: r.j && r.j.recovery }; }
      const f = await API.sb.factors(); const v = f.filter(x => x.status === "verified");
      return { enabled: v.length > 0, factors: v, stale: f.filter(x => x.status !== "verified") };
    },
    async begin() {
      if (backend() === "php") { const r = await PHPAPI.call("mfa", { method: "POST", body: JSON.stringify({ action: "setup" }) }); if (!r.ok) throw new Error((r.j && r.j.error) || "تعذّر البدء"); return { id: "php", secret: r.j.secret, uri: r.j.uri }; }
      const st = await MFA.status(); for (const f of st.stale || []) await API.sb.mfaRemove(f.id).catch(() => { });
      const j = await API.sb.mfaEnroll("Alyssum " + new Date().toISOString().slice(0, 16)); const q = String(j.totp.qr_code || "");          // الخدمة تعيد SVG نصاً (أو data URI): نحوّله إلى صورة آمنة لا تنفّذ سكربتاً
      return { id: j.id, secret: j.totp.secret, uri: j.totp.uri, qr: /^data:/.test(q) ? q : q ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(q) : "" };
    },
    async confirm(id, code) {
      if (backend() === "php") { const r = await PHPAPI.call("mfa", { method: "POST", body: JSON.stringify({ action: "enable", code }) }); if (!r.ok) throw new Error(r.j && r.j.error === "bad_code" ? "الرمز غير صحيح" : "تعذّر التفعيل"); return { recovery: r.j.recovery || [] }; }
      await API.sb.mfaVerify(id, code); API.sb.rpc("audit_event", { p_action: "mfa.enroll", p_ref: "", p_detail: {} }); return {};
    },
    async remove(id, code) {
      if (backend() === "php") { const r = await PHPAPI.call("mfa", { method: "POST", body: JSON.stringify({ action: "disable", code }) }); if (!r.ok) throw new Error("الرمز غير صحيح"); return; }
      await API.sb.mfaRemove(id); API.sb.rpc("audit_event", { p_action: "mfa.disable", p_ref: "", p_detail: {} });
    },
  };
  async function loadQr(uri) {
    try {
      if (!window.qrcode) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
      const q = qrcode(0, "M"); q.addData(uri); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) { return ""; }
  }

  function secHtml() {
    const m = S.me || {}, st = S.mfa || { enabled: false, factors: [] }, e = S.enroll;
    let h = '<div class="card"><h3>🛡️ حسابي وأمانه</h3><div class="rl-row"><span class="rl-chip">' + esc(label(m.role)) + '</span>' + (m.email ? '<span class="rl-chip" dir="ltr">' + esc(m.email) + '</span>' : "") +
      '<span class="rl-chip ' + (st.enabled ? "rl-ok" : "rl-no") + '">' + (st.enabled ? "✅ المصادقة الثنائية مفعّلة" : "⚠️ المصادقة الثنائية غير مفعّلة") + '</span></div>' +
      '<p class="rl-m">المصادقة الثنائية تطلب رمزاً من هاتفك (تطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator أو Authy) بعد كلمة المرور، فلا يكفي سرقة كلمة المرور للدخول إلى لوحتك.</p>';
    if (e) {
      h += '<div class="rl-qr">' + (e.qr ? '<img alt="QR" src="' + esc(e.qr) + '">' : e.qrSvg ? e.qrSvg : "") + '<div style="flex:1;min-width:240px"><ol class="rl-m" style="margin:0 1rem 0 0"><li>افتح تطبيق المصادقة واختر «إضافة حساب» ثم امسح الرمز' + (e.uri && backend() === "php" ? ' (أو <a href="' + esc(e.uri) + '">اضغط هنا من الهاتف</a>)' : "") + '.</li><li>إن تعذّر المسح أدخل هذا المفتاح يدوياً: <code>' + esc(e.secret) + '</code></li><li>اكتب الرمز المكوّن من 6 أرقام ثم «تأكيد».</li></ol>' +
        '<div class="rl-row" style="margin-top:.6rem"><input id="rl-code" inputmode="numeric" maxlength="6" dir="ltr" placeholder="000000" style="width:8rem;text-align:center;letter-spacing:.3em"><button class="rl-b g" data-rl="mfa-confirm">تأكيد</button><button class="rl-b" data-rl="mfa-cancel">إلغاء</button></div>' +
        '<p class="rl-m">احتفظ بالمفتاح النصي في مكان آمن: به تستعيد الحساب إن ضاع هاتفك.</p></div></div>';
    } else if (S.recovery && S.recovery.length) {
      h += '<div class="rl-warn"><b>رموز الطوارئ (تظهر مرة واحدة فقط):</b><br>' + S.recovery.map(c => '<code>' + esc(c) + '</code>').join(" ") + '<br>كل رمز يُستعمل مرة واحدة بدل رمز التطبيق إن ضاع هاتفك. احفظها الآن.</div><div class="rl-row" style="margin-top:.5rem"><button class="rl-b" data-rl="rec-done">حفظتها</button></div>';
    } else if (st.enabled) {
      h += '<div class="rl-row">' + (backend() === "sb" ? '<button class="rl-b" data-rl="mfa-begin">＋ إضافة جهاز آخر</button>' : "") + '<button class="rl-b r" data-rl="mfa-off">إيقاف المصادقة الثنائية</button></div>';
    } else h += '<div class="rl-row"><button class="rl-b g" data-rl="mfa-begin">تفعيل المصادقة الثنائية</button></div>';
    return h + '</div>';
  }
  /* قواعد التوزيع: حصص / حسب شركة التوصيل / حسب الولاية / يدوي حر */
  const MODES = [["weights", "حسب الحصص (تلقائي بالتساوي النسبي)"], ["company", "حسب شركة التوصيل"], ["wilaya", "حسب الولايات"], ["manual", "يدوي حر (أنت تسند الطلبات)"]];
  const wilNames = ids => (ids || []).map(id => { const w = (typeof WILAYAS !== "undefined" ? WILAYAS : []).find(x => String(x.id) === String(id)); return w ? w.name : id; });
  function distHtml(st, as) {
    const mode = as.mode || "weights", A = typeof Admin !== "undefined" ? Admin : null, byCo = as.byCo || {}, byWil = as.byWil || {};
    let h = '<div class="rl-row" style="margin-top:.6rem"><label>طريقة التوزيع: <select id="rl-g-mode">' + MODES.map(m => '<option value="' + m[0] + '"' + (m[0] === mode ? " selected" : "") + '>' + m[1] + '</option>').join("") + '</select></label></div>';
    h += '<div id="rl-d-company" style="display:' + (mode === "company" ? "block" : "none") + '"><p class="rl-m">اختر المندوبات اللواتي يعالجن طلبات كل شركة توصيل (إن اخترتَ أكثر من واحدة توزّع بينهن بالتساوي). الطلب بلا قاعدة تنطبق عليه يُوزَّع بالحصص.</p>';
    let cos = []; try { cos = (A && A.enabledCompanyKeys ? A.enabledCompanyKeys() : []).map(k => [k, ((A.allDeliveryCompanies() || {})[k] || {}).name || k]); } catch (e) { }
    h += cos.length ? '<div style="overflow-x:auto"><table><thead><tr><th>شركة التوصيل</th><th>المندوبات</th></tr></thead><tbody>' + cos.map(([k, n]) => '<tr data-co="' + esc(k) + '"><td>' + esc(n) + '</td><td>' + st.map(x => { const em = String(x.email).toLowerCase(); return '<label style="margin-inline-end:.8rem;white-space:nowrap"><input type="checkbox" data-coem="' + esc(em) + '"' + ((byCo[k] || []).map(String).map(y => y.toLowerCase()).includes(em) ? " checked" : "") + '> ' + esc(x.name || em) + '</label>'; }).join("") + '</td></tr>').join("") + '</tbody></table></div>' : '<p class="rl-m">لا توجد شركة توصيل مفعّلة بعد.</p>';
    h += '</div><div id="rl-d-wilaya" style="display:' + (mode === "wilaya" ? "block" : "none") + '"><p class="rl-m">اكتب لكل مندوبة الولايات التي تعالجها مفصولة بفاصلة (أرقاماً أو أسماء، مثال: 16, 31, 9). الولايات الجديدة 59–69 تتبع ولايتها الأم إن لم تُذكر.</p><div style="overflow-x:auto"><table><thead><tr><th>المندوبة</th><th>ولاياتها</th></tr></thead><tbody>';
    h += st.map(x => { const em = String(x.email).toLowerCase(), ids = Object.keys(byWil).filter(id => (byWil[id] || []).map(y => String(y).toLowerCase()).includes(em)); return '<tr data-wem="' + esc(em) + '"><td>' + esc(x.name || em) + '</td><td><input data-wil type="text" style="min-width:16rem" placeholder="مثال: 16, 31, 9" value="' + esc(ids.join(", ")) + '"></td></tr>'; }).join("");
    h += '</tbody></table></div></div><p class="rl-m" id="rl-d-manual" style="display:' + (mode === "manual" ? "block" : "none") + '">في الوضع الحر لا تُسنَد الطلبات تلقائياً: حدّد طلبات في صفحة «الطلبات» واضغط «👥 إسناد لمندوبة»، أو افتح الطلب واختر المندوبة. الطلب غير المسنَد يراه الجميع.</p>';
    return h;
  }
  function parseWilaya(txt) {
    const W = typeof WILAYAS !== "undefined" ? WILAYAS : [], out = [];
    String(txt || "").split(/[,،;\n]+/).map(t => t.trim()).filter(Boolean).forEach(t => { let w = /^\d+$/.test(t) ? W.find(x => String(x.id) === String(+t)) : W.find(x => String(x.name).toLowerCase() === t.toLowerCase()) || W.find(x => String(x.name).toLowerCase().startsWith(t.toLowerCase())); if (w) out.push(String(w.id)); });
    return [...new Set(out)];
  }
  function goalHtml(own) {
    const g = (S.perf && S.perf.goal) || {};
    if (own) { const me = S.me && S.me.email ? String(S.me.email).toLowerCase() : "", e = goalFor(g, me); return e.daily || e.rate ? '<p class="rl-m">🎯 هدفك: ' + (e.daily ? e.daily + " تأكيد يومياً" : "") + (e.daily && e.rate ? " · " : "") + (e.rate ? "نسبة تأكيد ≥ " + e.rate + "%" : "") + '</p>' : ""; }
    const st = ((S.team && S.team.staff) || []).filter(x => x.active), per = g.per || {}, as = g.assign || {}, w = as.weights || {};
    let h = '<h4 style="margin:.9rem 0 .3rem">🎯 الأهداف وتوزيع الطلبات</h4><div class="rl-row"><input id="rl-g-daily" type="number" min="0" max="500" placeholder="هدف تأكيدات يومي افتراضي" value="' + esc(g.daily || "") + '" style="width:11rem"><input id="rl-g-rate" type="number" min="0" max="100" placeholder="نسبة التأكيد % افتراضية" value="' + esc(g.rate || "") + '" style="width:11rem"><input id="rl-g-alert" type="number" min="5" max="600" placeholder="تنبيه بلا استجابة (د)" title="تنبيه حين يبقى طلب جديد بلا أي نتيجة اتصال أكثر من هذه الدقائق (الافتراضي 30)" value="' + esc(g.alertMin || "") + '" style="width:11rem"></div>';
    if (st.length) {
      h += '<div style="overflow-x:auto"><table><thead><tr><th>الموظفة</th><th>هدفها اليومي</th><th>نسبتها المستهدفة %</th><th>حصتها من الطلبات</th></tr></thead><tbody>';
      st.forEach((x, i) => { const em = String(x.email).toLowerCase(), p = per[em] || {}; h += '<tr data-gem="' + esc(em) + '"><td dir="ltr">' + esc(x.name || em) + '<br><small class="rl-m">' + esc(em) + '</small></td><td><input type="number" min="0" max="500" data-gd placeholder="افتراضي" value="' + esc(p.daily || "") + '" style="width:6rem"></td><td><input type="number" min="0" max="100" data-gr placeholder="افتراضي" value="' + esc(p.rate || "") + '" style="width:6rem"></td><td><input type="number" min="0" max="10" data-gw placeholder="0" value="' + esc(w[em] != null ? w[em] : "") + '" style="width:5rem"></td></tr>'; });
      h += '</tbody></table></div>' + distHtml(st, as);
      h += '<div class="rl-row" style="margin-top:.4rem"><label><input type="checkbox" id="rl-g-on"' + (as.on ? " checked" : "") + '> فعّل التوزيع المسبق (كل طلب جديد يُسند لموظفة بحسب الحصة؛ الحصة 0 = خارج التوزيع)</label><input id="rl-g-over" type="number" min="5" max="240" placeholder="مساندة بعد (د)" title="الطلب الذي لم يُجب عنه صاحبه بعد هذه الدقائق يظهر لبقية الموظفات (الافتراضي 20)" value="' + esc(as.overflow || "") + '" style="width:9rem"></div>';
    }
    return h + '<div class="rl-row" style="margin-top:.5rem"><button class="rl-b g" data-rl="goal-save">حفظ الأهداف والتوزيع</button></div>';
  }
  function boardHtml() {
    if (!S.me || !S.me.owner) return ""; const lb = leaderboard(summarize(S.stats || []), S.perf && S.perf.rows); if (!lb.length) return "";
    const nm = a => { const t = ((S.team && S.team.staff) || []).find(x => String(x.email).toLowerCase() === a); return (t && t.name) || a; }, med = ["🥇", "🥈", "🥉"];
    return '<h4 style="margin:.9rem 0 .3rem">🏆 ترتيب الفريق <small class="rl-m">(الفترة المختارة)</small></h4><div style="overflow-x:auto"><table><thead><tr><th>#</th><th>الموظفة</th><th>تأكيدات</th><th>النسبة</th><th>أول استجابة</th></tr></thead><tbody>' +
      lb.map(x => '<tr><td>' + (med[x.rank - 1] || x.rank) + '</td><td dir="ltr">' + esc(nm(x.actor)) + '</td><td><b>' + x.confirmed + '</b></td><td>' + (x.rate == null ? "—" : x.rate + "%") + '</td><td>' + fmtMin(x.med) + '</td></tr>').join("") + '</tbody></table></div><div class="rl-row" style="margin-top:.4rem"><button class="rl-b s" data-rl="lb-copy">📋 نسخ الترتيب للفريق (واتساب)</button></div>';
  }
  function reasonsHtml() {
    const rs = (S.perf && S.perf.reasons) || []; if (!rs.length) return "";
    const by = {}; rs.forEach(r => { by[r.reason] = (by[r.reason] || 0) + (+r.n || 0); });
    const tot = Object.values(by).reduce((a, b) => a + b, 0);
    return '<h4 style="margin:.8rem 0 .3rem">❌ أسباب الإلغاء</h4><div class="rl-row">' + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => '<span class="rl-chip">' + esc(CANCEL_REASONS[k] || k) + ': <b>' + n + '</b> (' + Math.round(n / tot * 100) + '%)</span>').join("") + '</div>';
  }
  function statsHtml(own) {
    const rows = summarize(S.stats || []);
    let h = '<div class="card"><h3>📊 ' + (own ? "حصيلتي" : "نشاط الفريق") + '</h3><div class="rl-row"><select id="rl-days">' + [[1, "اليوم"], [7, "7 أيام"], [30, "30 يوماً"]].map(x => '<option value="' + x[0] + '"' + (S.days === x[0] ? " selected" : "") + '>' + x[1] + '</option>').join("") + '</select></div>';
    if (!rows.length) return h + '<p class="rl-m">لا نشاط مسجَّل في هذه الفترة.</p>' + (own ? "" : goalHtml(false)) + '</div>';
    const tot = rows.reduce((t, r) => { t.c += r.confirmed; t.x += r.cancelled; return t; }, { c: 0, x: 0 }), avg = tot.c + tot.x ? Math.round(tot.c / (tot.c + tot.x) * 100) : null;
    const tone = r => (r.rate == null ? "" : r.rate >= 70 ? "#d4ff4d" : r.rate >= 50 ? "#fcd34d" : "#fca5a5");
    h += '<div class="rl-row" style="margin:.4rem 0">' + (avg == null ? "" : '<span class="rl-chip">متوسط الفريق: <b>' + avg + '%</b></span>') + '<button class="rl-b s" data-rl="stats-csv">⬇ CSV</button></div>';
    h += '<div style="overflow-x:auto"><table><thead><tr><th>الحساب</th><th>اليوم / الهدف</th><th>تأكيد</th><th>منها بتعديل عنوان</th><th>إلغاء</th><th>نسبة التأكيد</th><th>أول استجابة (وسيط)</th><th>≤15 د</th><th>غير متاح 1 / 2 / 3</th><th>لاحقاً</th><th>مؤجَّل لغد</th><th>رقم خاطئ</th><th>تعديلات</th><th>طلبات يدوية</th><th>آخر نشاط</th></tr></thead><tbody>';
    rows.forEach(r => { const pf = ((S.perf && S.perf.rows) || []).find(x => x.actor === r.actor), td = ((S.perf && S.perf.today) || []).find(x => x.actor === r.actor), gl = goalFor(S.perf && S.perf.goal, r.actor), tc = td ? td.conf : 0;
      h += '<tr><td dir="ltr">' + esc(r.actor) + '<br><small class="rl-m">' + esc(label(r.role)) + '</small></td><td style="font-weight:900;color:' + (gl.daily ? (tc >= gl.daily ? "#d4ff4d" : "#fcd34d") : "inherit") + '">' + tc + (gl.daily ? " / " + gl.daily : "") + '</td><td><b>' + r.confirmed + '</b></td><td>' + r.addr + '</td><td>' + r.cancelled + '</td><td style="color:' + tone(r) + ';font-weight:900">' + (r.rate == null ? "—" : r.rate + "%") + (gl.rate && r.rate != null ? '<br><small class="rl-m">الهدف ' + gl.rate + '%</small>' : "") + '</td><td style="color:' + respTone(pf && pf.med_min) + ';font-weight:800">' + fmtMin(pf && pf.med_min) + '</td><td>' + (pf ? pf.fast_pct + "%" : "—") + '</td><td>' + r.try1 + ' / ' + r.try2 + ' / ' + r.try3 + '</td><td>' + r.later + '</td><td>' + r.tomorrow + '</td><td>' + r.wrong + '</td><td>' + r.edits + '</td><td>' + r.created + '</td><td>' + when(r.last) + '</td></tr>'; });
    return h + '</tbody></table></div><p class="rl-m" style="margin-top:.4rem">نسبة التأكيد = المؤكَّد ÷ (المؤكَّد + الملغى). أول استجابة = الزمن من وصول الطلب إلى أول نتيجة اتصال/حالة تسجّلها الموظفة. أعمدة الاتصال تعدّ كل مرة سُجّلت فيها النتيجة.</p>' + reasonsHtml() + boardHtml() + goalHtml(own) + '</div>';
  }
  function teamHtml() {
    const T = S.team; if (!T) return '<div class="card"><h3>👥 فريق العمل</h3><p class="rl-m">جارٍ التحميل…</p></div>';
    let h = '<div class="card"><h3>👥 فريق العمل</h3>';
    if (!T.staff.length) h += '<p class="rl-m">لا موظفين بعد. أضف موظف اتصال ليعمل على تأكيد الطلبات دون أن يرى المالية أو الإعدادات.</p>';
    else {
      h += '<div style="overflow-x:auto"><table><thead><tr><th>الموظف</th><th>الدور</th><th>الحالة</th><th>المصادقة الثنائية</th><th>آخر دخول</th><th></th></tr></thead><tbody>';
      T.staff.forEach(s => {
        h += '<tr data-em="' + esc(s.email) + '"><td dir="ltr">' + esc(s.name || "") + '<br><small class="rl-m">' + esc(s.email) + '</small></td><td>' + esc(label(s.role)) + '<br><small class="rl-m">' + (s.perms || []).length + ' صلاحية</small></td><td><span class="rl-chip ' + (s.active ? "rl-ok" : "rl-no") + '">' + (s.active ? "نشط" : "موقوف") + '</span></td><td>' + (s.mfa ? "✅" : "—") + '</td><td>' + when(s.last_sign_in) + '</td>' +
          '<td><div class="rl-row"><button class="rl-b s" data-rl="edit">صلاحيات</button><button class="rl-b s o" data-rl="pw">كلمة مرور</button>' + (s.mfa ? '<button class="rl-b s o" data-rl="resetmfa">إعادة ضبط 2FA</button>' : "") + '<button class="rl-b s ' + (s.active ? "" : "g") + '" data-rl="toggle">' + (s.active ? "إيقاف" : "تفعيل") + '</button><button class="rl-b s r" data-rl="del">حذف</button></div></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    const ed = S.edit;
    h += '<h3 style="margin-top:1rem">' + (ed ? "تعديل صلاحيات " + esc(ed.email) : "＋ إضافة موظف") + '</h3><div class="rl-row">' +
      (ed ? "" : '<input id="rl-email" type="email" dir="ltr" placeholder="البريد أو اسم المستخدم" style="min-width:220px">') + '<input id="rl-name" placeholder="الاسم" value="' + esc(ed ? ed.name : "") + '">' +
      '<select id="rl-role">' + Object.keys(ROLES).filter(k => k !== "owner").map(k => '<option value="' + k + '"' + (ed && ed.role === k ? " selected" : "") + '>' + esc(ROLES[k].label) + '</option>').join("") + '</select>' +
      (ed ? "" : '<input id="rl-pw" dir="ltr" placeholder="كلمة مرور مؤقتة" value="' + esc(genPw()) + '" style="min-width:180px">') + '</div>' +
      '<div class="rl-perms">' + PERMS.map(p => '<label' + (p.soon ? ' style="opacity:.5"' : "") + '><input type="checkbox" data-perm="' + p.id + '"' + (p.soon ? " disabled" : "") + (((ed ? ed.perms : ROLES.agent.perms) || []).indexOf(p.id) >= 0 && !p.soon ? " checked" : "") + '>' + esc(p.label) + (p.soon ? " <small>(قريباً)</small>" : "") + '</label>').join("") + '</div>' +
      '<div class="rl-row"><button class="rl-b g" data-rl="' + (ed ? "save" : "add") + '">' + (ed ? "حفظ" : "إضافة الموظف") + '</button>' + (ed ? '<button class="rl-b" data-rl="cancel">إلغاء</button>' : "") + '</div>' +
      '<p class="rl-m">سلّم الموظف بريده/اسمه وكلمة المرور المؤقتة، وأوصه بتفعيل المصادقة الثنائية من هذه الصفحة بعد أول دخول. الموظف لا يرى المالية ولا الإعدادات ولا مفاتيح شركات التوصيل إلا إن منحته ذلك.</p></div>';
    return h;
  }
  function auditHtml() {
    const A = S.audit; if (!A) return "";
    let h = '<div class="card"><h3>🧾 سجلّ النشاط</h3>';
    if (!A.length) return h + '<p class="rl-m">لا أحداث بعد.</p></div>';
    h += '<div style="overflow-x:auto"><table><thead><tr><th>الوقت</th><th>الحساب</th><th>الحدث</th><th>المرجع</th></tr></thead><tbody>';
    A.slice(0, 80).forEach(r => { const d = r.detail || {}; const x = r.action === "order.status" ? " → " + (STATUS_LBL[d.to] || d.to || "") : ""; h += '<tr><td>' + when(r.at) + '</td><td dir="ltr">' + esc(r.actor) + '</td><td>' + esc(ACTION_LBL[r.action] || r.action) + esc(x) + '</td><td dir="ltr">' + esc(r.ref || "") + '</td></tr>'; });
    return h + '</tbody></table></div></div>';
  }
  function draw() {
    const host = $("rl"); if (!host) return; css();
    const owner = S.me && S.me.owner, b = backend();
    if (!b || (S.me && S.me.legacy)) { host.innerHTML = '<div class="card"><h3>🛡️ الفريق والأمان</h3><p class="rl-m">هذه الميزة غير مفعّلة في إعداد موقعك بعد. تواصل مع الدعم لتفعيل حسابات الفريق والمصادقة الثنائية.</p></div>'; return; }
    const keep = {}; host.querySelectorAll("input[id^=rl-],select[id^=rl-]").forEach(x => { keep[x.id] = x.value; });                     // إعادة الرسم بعد التحميل لا تمسح ما بدأ المستخدم بكتابته
    const perms = host.querySelector("[data-perm]") ? [...host.querySelectorAll("[data-perm]")].map(x => [x.dataset.perm, x.checked]) : null;
    /* نسخة «إنفوغراف ديزاين»: لا طلبات ولا اتصال ولا توزيع ولا إحصاء متجر — الأمان (المصادقة الثنائية) فقط */
    if (typeof AdminEdition !== "undefined" && AdminEdition.edition() === "design") { host.innerHTML = secHtml(); return; }
    host.innerHTML = secHtml() + (owner ? teamHtml() + statsHtml(false) + auditHtml() : statsHtml(true));
    Object.keys(keep).forEach(id => { const e = $(id); if (e && keep[id] !== "" && id !== "rl-days" && (id !== "rl-pw" || !e.value || true)) e.value = keep[id]; });
    if (perms && !S.edit) perms.forEach(([k, c]) => { const e = host.querySelector('[data-perm="' + k + '"]:not(:disabled)'); if (e) e.checked = c; });
  }
  /* أداء الاتصال (زمن أول استجابة، حصيلة اليوم، أسباب الإلغاء، الأهداف): المالك للجميع والموظف لنفسه */
  async function perf(days) {
    const b = backend(); if (!b) return null;
    try { const j = b === "sb" ? await API.sb.adminFetch("/rest/v1/rpc/audit_perf", { method: "POST", body: JSON.stringify({ p_days: days || 7 }) }) : await api("perf", { days: days || 7 }); return j && typeof j === "object" ? j : null; } catch (e) { return null; }
  }
  async function refresh() {
    const b = backend(); if (!b || !S.me) return;
    try { S.mfa = await MFA.status(); } catch (e) { S.mfa = { enabled: !!S.me.mfa, factors: [] }; }
    try { S.stats = b === "sb" ? await API.sb.adminFetch("/rest/v1/rpc/audit_stats", { method: "POST", body: JSON.stringify({ p_days: S.days }) }) : (await api("stats", { days: S.days })).rows; } catch (e) { S.stats = []; }
    S.perf = await perf(S.days);
    if (S.me.owner) {
      try { S.team = await api("list"); } catch (e) { S.team = { staff: [] }; if (typeof toast === "function") toast("❌ " + e.message); }
      try { S.audit = b === "sb" ? await API.sb.adminFetch("/rest/v1/audit_log?order=at.desc&limit=80") : (await api("audit")).rows; } catch (e) { S.audit = []; }
    }
    draw();
  }
  function render() { draw(); refresh(); }
  const read = () => ({ perms: [...document.querySelectorAll("#rl [data-perm]:checked")].map(x => x.dataset.perm), role: ($("rl-role") || {}).value, name: (($("rl-name") || {}).value || "").trim() });
  async function onClick(e) {
    const el = e.target.closest && e.target.closest("#rl [data-rl]"); if (!el || S.busy) return;
    const a = el.dataset.rl, tr = el.closest("tr"), em = tr && tr.dataset.em, toastf = t => { if (typeof toast === "function") toast(t); };
    S.busy = true;
    try {
      if (a === "mfa-begin") { const j = await MFA.begin(); S.enroll = j; if (!j.qr) j.qrSvg = await loadQr(j.uri); draw(); }
      else if (a === "mfa-cancel") { const id = S.enroll && S.enroll.id; S.enroll = null; if (id && id !== "php") await API.sb.mfaRemove(id).catch(() => { }); draw(); }
      else if (a === "mfa-confirm") {
        const code = (($("rl-code") || {}).value || "").trim(); if (!/^\d{6}$/.test(code)) { toastf("أدخل الرمز المكوّن من 6 أرقام"); return; }
        const r = await MFA.confirm(S.enroll.id, code); S.enroll = null; S.recovery = r.recovery || null; toastf("✅ فُعّلت المصادقة الثنائية"); await refresh();
      }
      else if (a === "rec-done") { S.recovery = null; draw(); }
      else if (a === "goal-save") {
        const n = (id, mx) => Math.max(0, Math.min(mx, Math.round(+($(id) || {}).value || 0))), per = {}, weights = {};
        document.querySelectorAll("#rl tr[data-gem]").forEach(r => { const em = r.dataset.gem, d = Math.max(0, Math.min(500, Math.round(+r.querySelector("[data-gd]").value || 0))), rt = Math.max(0, Math.min(100, Math.round(+r.querySelector("[data-gr]").value || 0))), w = Math.max(0, Math.min(10, Math.round(+r.querySelector("[data-gw]").value || 0)));
          if (d || rt) per[em] = Object.assign(d ? { daily: d } : {}, rt ? { rate: rt } : {}); if (w) weights[em] = w; });
        const mode = ($("rl-g-mode") || {}).value || "weights", byCo = {}, byWil = {};
        document.querySelectorAll("#rl tr[data-co]").forEach(r => { const l = [...r.querySelectorAll("[data-coem]:checked")].map(c => c.dataset.coem); if (l.length) byCo[r.dataset.co] = l; });
        document.querySelectorAll("#rl tr[data-wem]").forEach(r => { parseWilaya((r.querySelector("[data-wil]") || {}).value).forEach(id => { (byWil[id] = byWil[id] || []).push(r.dataset.wem); }); });
        const hasRule = mode === "weights" ? Object.keys(weights).length > 0 : mode === "company" ? Object.keys(byCo).length > 0 : mode === "wilaya" ? Object.keys(byWil).length > 0 : true;
        const g = { daily: n("rl-g-daily", 500), rate: n("rl-g-rate", 100), alertMin: n("rl-g-alert", 600), per, assign: { on: !!($("rl-g-on") || {}).checked && hasRule, mode, weights, byCo, byWil, overflow: n("rl-g-over", 240) } };
        await Priv.set("callgoal", g); toastf("🎯 حُفظت الأهداف والتوزيع"); await refresh();
      }
      else if (a === "lb-copy") {
        const lb = leaderboard(summarize(S.stats || []), S.perf && S.perf.rows), nm = x => { const t = ((S.team && S.team.staff) || []).find(y => String(y.email).toLowerCase() === x); return (t && t.name) || x; }, med = ["🥇", "🥈", "🥉"];
        const txt = "🏆 ترتيب الفريق (" + (S.days === 1 ? "اليوم" : S.days + " أيام") + ")\n" + lb.map(x => (med[x.rank - 1] || x.rank + ".") + " " + nm(x.actor) + " — " + x.confirmed + " تأكيد · " + (x.rate == null ? "—" : x.rate + "%") + " · ⏱ " + fmtMin(x.med)).join("\n");
        try { await navigator.clipboard.writeText(txt); toastf("📋 نُسخ الترتيب"); } catch (e) { window.prompt("انسخ النص:", txt); }
      }
      else if (a === "stats-csv") {
        const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"', rows = [["الحساب", "الدور", "تأكيد", "تأكيد بتعديل عنوان", "إلغاء", "نسبة التأكيد %", "غير متاح 1", "غير متاح 2", "غير متاح 3", "لاحقاً", "مؤجَّل لغد", "رقم خاطئ", "تعديلات", "طلبات يدوية", "أول استجابة وسيط (د)", "استجابة ≤15 د %", "تأكيدات اليوم"]]
          .concat(summarize(S.stats || []).map(r => [r.actor, label(r.role), r.confirmed, r.addr, r.cancelled, r.rate == null ? "" : r.rate, r.try1, r.try2, r.try3, r.later, r.tomorrow, r.wrong, r.edits, r.created].concat((() => { const pf = ((S.perf && S.perf.rows) || []).find(x => x.actor === r.actor), td = ((S.perf && S.perf.today) || []).find(x => x.actor === r.actor); return [pf ? pf.med_min : "", pf ? pf.fast_pct : "", td ? td.conf : 0]; })())));
        const blob = new Blob(["\ufeff" + rows.map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), l = document.createElement("a");
        l.href = URL.createObjectURL(blob); l.download = "team-performance-" + new Date().toISOString().slice(0, 10) + ".csv"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 2000);
      }
      else if (a === "mfa-off") {
        if (!confirm("إيقاف المصادقة الثنائية يضعف حماية حسابك. متابعة؟")) return;
        let code = ""; if (backend() === "php") { code = prompt("أدخل رمز التطبيق الحالي (أو رمز طوارئ):") || ""; if (!code) return; }
        const st = await MFA.status(); for (const f of (st.factors.length ? st.factors : [{ id: "php" }])) await MFA.remove(f.id, code);
        toastf("تم إيقاف المصادقة الثنائية"); await refresh();
      }
      else if (a === "add") {
        const v = read(), email = (($("rl-email") || {}).value || "").trim().toLowerCase(), pw = (($("rl-pw") || {}).value || "");
        if (!email) { toastf("أدخل بريد الموظف أو اسم المستخدم"); return; }
        await api("create", { email, name: v.name, role: v.role, perms: v.perms, password: pw }); toastf("✅ أُضيف الموظف — كلمة المرور المؤقتة: " + pw); S.edit = null; await refresh();
      }
      else if (a === "edit") { S.edit = (S.team.staff || []).find(s => s.email === em) || null; draw(); document.getElementById("rl").scrollIntoView({ behavior: "smooth", block: "end" }); }
      else if (a === "cancel") { S.edit = null; draw(); }
      else if (a === "save") { const v = read(); await api("update", { email: S.edit.email, name: v.name, role: v.role, perms: v.perms }); toastf("✅ حُفظت الصلاحيات"); S.edit = null; await refresh(); }
      else if (a === "toggle") { const s = S.team.staff.find(x => x.email === em); await api("update", { email: em, active: !s.active }); toastf(s.active ? "أُوقف الحساب" : "فُعّل الحساب"); await refresh(); }
      else if (a === "pw") { const pw = prompt("كلمة مرور جديدة (10 أحرف على الأقل):", genPw()); if (!pw) return; await api("password", { email: em, password: pw }); toastf("✅ غُيّرت كلمة المرور: " + pw); }
      else if (a === "resetmfa") { if (!confirm("حذف المصادقة الثنائية لهذا الموظف؟ سيضطر لتفعيلها من جديد.")) return; await api("reset_mfa", { email: em }); toastf("تمت إعادة الضبط"); await refresh(); }
      else if (a === "del") { if (!confirm("حذف حساب الموظف نهائياً؟ سجلّ نشاطه يبقى محفوظاً.")) return; await api("delete", { email: em }); toastf("حُذف الحساب"); await refresh(); }
    } catch (err) { if (typeof toast === "function") toast("❌ " + err.message); }
    finally { S.busy = false; }
  }
  document.addEventListener("click", onClick);
  document.addEventListener("change", e => {
    if (e.target && e.target.id === "rl-days") { S.days = +e.target.value || 7; refresh(); }
    if (e.target && e.target.id === "rl-g-mode") { const v = e.target.value; [["company", "rl-d-company"], ["wilaya", "rl-d-wilaya"], ["manual", "rl-d-manual"]].forEach(([m, id]) => { const el = document.getElementById(id); if (el) el.style.display = v === m ? "block" : "none"; }); }
    if (e.target && e.target.id === "rl-role") { const r = ROLES[e.target.value]; if (r) document.querySelectorAll("#rl [data-perm]").forEach(c => { c.checked = r.perms.indexOf(c.dataset.perm) >= 0; }); }
  });

  root.AdminRoles = Object.assign({ perf, boot, apply, land, can, isReadOnly: isRO, denyWrite, allowed, render, state: S, backend, _MFA: MFA, mfaStatus: () => MFA.status() }, model);
})(typeof window !== "undefined" ? window : globalThis);
