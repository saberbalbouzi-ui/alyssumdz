/* «خدمات التسويق»: اشترِ حساباً إعلانياً جاهزاً (TikTok Ads / Meta Ads…) بالدينار من رصيد محفظتك. يُحجز المبلغ كضمان فور الشراء، ويُرسل الطلب تلقائياً إلى فريق التنفيذ،
   وعند التسليم يظهر هنا رابط دعوة الحساب؛ وإن رُفض الطلب يعود المبلغ إلى متاحك فوراً. الأموال تُقيَّد في الخادم وحده؛ هنا عرض وطلبات عبر وسيط مدير مسجَّل الدخول. */
const AdminAgency = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { svc: [], orders: [], next: null, avail: null, off: false, err: "", busy: false, form: null, timer: null };
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ERR = { insufficient_funds: "رصيدك المتاح غير كافٍ — اشحن محفظتك أولاً", validation_error: "تحقق من الحقول المُدخلة", rate_limited: "طلبات كثيرة، حاول بعد قليل", wallet_unavailable: "المحفظة غير مفعّلة على حسابك — تواصل مع الدعم", not_found: "الخدمة لم تعد متاحة", module_disabled: "الخدمة غير مفعّلة على حسابك — تواصل مع الدعم" };
  const ST = { pending: ["قيد التجهيز", "var(--g-amber-rgb)"], processing: ["قيد التنفيذ", "var(--g-blue-rgb)"], delivered: ["تم التسليم", "var(--g-mint-rgb)"], rejected: ["مرفوض — رُدّ المبلغ", "var(--g-rose-rgb)"] };
  const KI = { tiktok: "🎵", meta: "📘", google: "🔎", snapchat: "👻", other: "📣" };
  const dt = s => String(s || "").slice(0, 16).replace("T", " ");

  async function call(method, path, body, query, idem) {
    try {
      if (typeof API === "undefined" || !API.sb || !API.sb.token) return { ok: false, off: true };
      const t = await API.sb.token(); if (!t) return { ok: false, st: 401 };
      const r = await fetch(API.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method, path, body, query, idempotencyKey: idem }) });
      if (r.status === 404) return { ok: false, off: true };
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) return { ok: false, st: r.status, j };
      return { ok: j.status >= 200 && j.status < 300, st: j.status, j: j.data || {} };
    } catch (e) { return { ok: false, st: 0 }; }
  }
  const errOf = r => (r && r.j && r.j.error && (r.j.error.fields ? Object.values(r.j.error.fields)[0] : (ERR[r.j.error.code] || r.j.error.message))) || (r && r.st === 401 ? "انتهت الجلسة، أعد تسجيل الدخول" : "تعذّر تنفيذ الطلب، حاول لاحقاً");

  async function load(more) {
    const [s, o, w] = await Promise.all([call("GET", "/v1/agency/services"), call("GET", "/v1/agency/orders", null, { limit: 20, ...(more && S.next ? { after: S.next } : {}) }), call("GET", "/v1/wallet")]);
    if (s.off) { S.off = true; return; } S.off = false;
    if (!s.ok) { S.err = errOf(s); return; } S.err = "";
    S.svc = s.j.services || []; if (o.ok) { S.orders = more ? S.orders.concat(o.j.orders || []) : o.j.orders || []; S.next = o.j.next || null; }
    S.avail = w.ok && w.j.balances && w.j.balances.available ? (w.j.balances.available.DZD || 0) : null;
  }
  function css() {
    if ($("ag-css")) return; const s = document.createElement("style"); s.id = "ag-css";
    s.textContent = `#ag-app{display:grid;gap:1rem;max-width:1100px;grid-template-columns:minmax(0,1fr)}#ag-app>*{min-width:0}.ag-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04)}.ag-box h3{margin:0 0 .6rem;font-size:1.05rem}
.ag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:.8rem}.ag-svc{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));display:grid;gap:.4rem;align-content:start}.ag-svc b{font-size:1.05rem}.ag-svc .pr{font-size:1.4rem;font-weight:900}.ag-svc small{opacity:.8}
.ag-f{display:grid;gap:.5rem;margin-top:.6rem}.ag-f label{display:grid;gap:.2rem;font-size:.82rem}.ag-f input{padding:.55rem .65rem;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:inherit;font:inherit}
.ag-btn{padding:.55rem 1.1rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(var(--g-mint-d-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-mint-d-rgb),.45),rgba(var(--g-mint-d-rgb),.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.18);backdrop-filter:blur(6px);transition:transform .15s,filter .15s}
.ag-btn:hover{transform:translateY(-2px);filter:saturate(1.2)}.ag-btn.g{border-color:rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06))}.ag-btn[disabled]{opacity:.5;pointer-events:none}
.ag-tbl{width:100%;border-collapse:collapse;font-size:.85rem}.ag-tbl th,.ag-tbl td{padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;vertical-align:top}.ag-chip{display:inline-block;padding:.1rem .6rem;border-radius:99px;font-size:.75rem;font-weight:800;border:1px solid currentColor}
.ag-sc{overflow:auto}.ag-hint{font-size:.8rem;opacity:.8;margin:.4rem 0 0}.ag-off{padding:1.2rem;text-align:center;opacity:.85}.ag-inv{word-break:break-all}`;
    document.head.appendChild(s);
  }
  function draw() {
    const host = $("ag-app"); if (!host) return;
    if (S.off) { host.innerHTML = '<div class="ag-box ag-off">خدمات التسويق غير مفعّلة بعد على حسابك — تواصل مع الدعم لتفعيلها.</div>'; return; }
    if (S.err) { host.innerHTML = `<div class="ag-box ag-off">${esc(S.err)} <button class="ag-btn" data-ag="reload">إعادة المحاولة</button></div>`; return; }
    const f = S.form, sv = f && S.svc.find(x => x.id === f.id);
    const cards = S.svc.map(s => `<div class="ag-svc"><b>${KI[s.kind] || "📣"} ${esc(s.name)}</b>${s.description ? `<small>${esc(s.description)}</small>` : ""}<span class="pr">${nf(s.price)} دج</span><button class="ag-btn" data-ag="buy" data-id="${s.id}" ${S.busy ? "disabled" : ""}>اطلب الآن</button></div>`).join("");
    const form = sv ? `<div class="ag-box" id="ag-form"><h3>طلب: ${esc(sv.name)} — ${nf(sv.price)} دج</h3>
 <div class="ag-f"><label>اسم المتجر / العلامة<input id="ag-store" maxlength="120" value="${esc(f.store)}"></label>
 <label>بريد صاحب الحساب الإعلاني (يصله الدعوة)<input id="ag-mail" type="email" dir="ltr" value="${esc(f.mail)}" placeholder="name@example.com"></label>
 <label>رابط صفحة فيسبوك ${sv.needs_page ? "(مطلوب)" : "(اختياري)"}<input id="ag-page" dir="ltr" value="${esc(f.page)}" placeholder="https://facebook.com/your-page"></label>
 <div><button class="ag-btn" data-ag="submit" ${S.busy ? "disabled" : ""}>ادفع ${nf(sv.price)} دج من محفظتي</button> <button class="ag-btn g" data-ag="cancel">إلغاء</button></div></div>
 <p class="ag-hint">يُحجز المبلغ من رصيدك المتاح كضمان${S.avail != null ? ` (متاحك الآن ${nf(S.avail)} دج)` : ""}، ولا يُحرَّر إلا عند تسليم الحساب؛ وإن رُفض الطلب يعود إليك كاملاً.</p></div>` : "";
    const rows = S.orders.map(o => { const st = ST[o.status] || [o.status, "inherit"];
      const tail = o.status === "delivered" && o.invite_link ? `<div class="ag-inv"><a href="${esc(o.invite_link)}" target="_blank" rel="noopener noreferrer" dir="ltr">${esc(o.invite_link)}</a></div><button class="ag-btn g" data-ag="copy" data-l="${esc(o.invite_link)}">نسخ رابط الدعوة</button>` : o.status === "rejected" && o.note ? `<small>${esc(o.note)}</small>` : "";
      return `<tr><td><b dir="ltr">${esc(o.ref)}</b><div class="ag-hint" dir="ltr">${esc(dt(o.created_at))}</div></td><td>${esc(o.service)}<div class="ag-hint">${nf(o.price)} دج</div></td><td>${esc(o.store_name)}<div class="ag-hint" dir="ltr">${esc(o.client_email)}</div></td><td><span class="ag-chip" style="color:rgb(${st[1]})">${esc(st[0])}</span></td><td>${tail}</td></tr>`; }).join("");
    host.innerHTML = `<div class="ag-box"><h3>خدمات التسويق الجاهزة</h3>${S.avail != null ? `<p class="ag-hint" style="margin:0 0 .6rem">متاحك في المحفظة: <b>${nf(S.avail)} دج</b></p>` : ""}${cards ? `<div class="ag-grid">${cards}</div>` : '<p class="ag-hint">لا توجد خدمات متاحة حالياً.</p>'}</div>${form}
<div class="ag-box"><h3>طلباتي</h3>${rows ? `<div class="ag-sc"><table class="ag-tbl"><thead><tr><th>الطلب</th><th>الخدمة</th><th>المتجر</th><th>الحالة</th><th>رابط الدعوة</th></tr></thead><tbody>${rows}</tbody></table></div>${S.next ? '<button class="ag-btn g" data-ag="more">عرض المزيد</button>' : ""}` : '<p class="ag-hint">لا طلبات بعد.</p>'}<p class="ag-hint">بعد الدفع يُرسل طلبك تلقائياً إلى فريق التنفيذ، وتظهر الحالة هنا وفي «يحتاج انتباهك» فور التسليم.</p></div>`;
  }
  async function submit() {
    const f = S.form, sv = f && S.svc.find(x => x.id === f.id); if (!sv) return;
    f.store = ($("ag-store") || {}).value.trim(); f.mail = ($("ag-mail") || {}).value.trim(); f.page = ($("ag-page") || {}).value.trim();
    if (f.store.length < 2) return toast("اكتب اسم المتجر"); if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(f.mail)) return toast("اكتب بريداً صحيحاً"); if (sv.needs_page && !f.page) return toast("رابط صفحة فيسبوك مطلوب لهذه الخدمة");
    if (f.page && !/^https:\/\//i.test(f.page)) return toast("رابط الصفحة يجب أن يبدأ بـ https://");
    if (S.avail != null && S.avail < sv.price) return toast(ERR.insufficient_funds);
    if (!confirm(`شراء «${sv.name}» مقابل ${nf(sv.price)} دج تُخصم من محفظتك (ضمان حتى التسليم)؟\nالمتجر: ${f.store}\nالبريد: ${f.mail}`)) return;
    S.busy = true; draw(); const r = await call("POST", "/v1/agency/orders", { service_id: sv.id, store_name: f.store, client_email: f.mail, ...(f.page ? { facebook_page_url: f.page } : {}) }, null, f.key); S.busy = false;
    if (r.ok) { toast("✅ تم الدفع وأُرسل طلبك لفريق التنفيذ"); S.form = null; } else toast(errOf(r));
    await refresh();
  }
  async function onClick(e) {
    const el = e.target.closest("[data-ag]"); if (!el) return; const a = el.dataset.ag;
    if (a === "reload") { S.err = ""; await refresh(); }
    else if (a === "more") { await load(true); draw(); }
    else if (a === "buy") { S.form = { id: +el.dataset.id, store: "", mail: "", page: "", key: uid() }; draw(); const x = $("ag-form"); if (x && x.scrollIntoView) x.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (a === "cancel") { S.form = null; draw(); }
    else if (a === "submit") await submit();
    else if (a === "copy") { try { await navigator.clipboard.writeText(el.dataset.l); toast("✓ نُسخ الرابط"); } catch (x) { toast(el.dataset.l); } }
  }
  async function refresh() { await load(false); draw(); }
  function bind() { const root = $("ag-app"); if (!root || root._b) return; root._b = 1; root.addEventListener("click", onClick); }
  async function render() {
    css(); const host = $("agency-content"); if (!host) return; if (!$("ag-app")) host.innerHTML = '<div id="ag-app"></div>'; bind(); draw();
    clearInterval(S.timer); S.timer = setInterval(() => { const t = $("tab-agency"); if (t && !t.classList.contains("hidden") && !document.hidden && !S.busy && !S.form) refresh(); }, 60000);
    await refresh();
  }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._agWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-agency"); if (el) el.classList.toggle("hidden", t !== "agency"); if (t === "agency") render(); else clearInterval(S.timer); return r; };
      Admin._agWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, refresh, S };
})();
