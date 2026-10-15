/* «استوديو التطبيقات» (بوابة المطوّر): لمن فُعِّل حسابه كمطوّر تطبيقات — أنشئ تطبيقك وأرسله للمراجعة، دوّر أسراره، وثّق نطاقه، تابع سجلّ تسليمات الأحداث وإيراداتك.
   الأسرار (client_secret وwebhook_secret) تظهر مرة واحدة فقط عند الإنشاء/التدوير ولا تُخزَّن في المتصفح. كل شيء يمرّ عبر وسيط مدير مسجَّل الدخول. */
const AdminAppDev = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { apps: [], dels: [], earn: null, notDev: false, off: false, err: "", busy: false, form: null, secrets: null, tab: "apps", dstate: "", timer: null };
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const SCOPES = [["read_orders", "قراءة الطلبات (بلا بيانات الزبائن)"], ["read_customers", "⚠️ أسماء الزبائن وهواتفهم"], ["read_products", "قراءة المنتجات"], ["write_products", "تعديل المنتجات والأكواد"], ["read_carts", "قراءة السلال المتروكة"]];
  const EVENTS = ["order.created", "order.confirmed", "order.shipped", "order.delivered", "order.cancelled", "order.returned", "payment.confirmed"];
  const ST = { draft: ["مسودة", "var(--g-blue-rgb)"], pending: ["قيد المراجعة", "var(--g-amber-rgb)"], approved: ["معتمد", "var(--g-mint-rgb)"], rejected: ["مرفوض", "var(--g-rose-rgb)"], suspended: ["موقوف", "var(--g-rose-rgb)"] };
  const DS = { pending: ["بانتظار الإرسال", "var(--g-amber-rgb)"], sent: ["تم", "var(--g-mint-rgb)"], failed: ["فشل", "var(--g-rose-rgb)"] };
  const ERR = { not_a_developer: "حسابك غير مفعّل كمطوّر — تواصل مع الدعم لتفعيله", slug_taken: "المعرّف مستعمل، اختر غيره", plan_limit: "بلغت حدّ 20 تطبيقاً", verification_failed: "لم نجد الملف المطلوب في نطاقك بعد", rate_limited: "طلبات كثيرة، حاول بعد قليل", bad_transition: "الحالة الحالية لا تسمح بهذا الإجراء", module_disabled: "الخدمة غير مفعّلة على حسابك — تواصل مع الدعم" };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const dt = s => { const n = +s; return n ? new Date(n * 1000).toISOString().slice(0, 16).replace("T", " ") : ""; };
  async function call(method, path, body, query) {
    try {
      if (typeof API === "undefined" || !API.sb || !API.sb.token) return { ok: false, off: true };
      const t = await API.sb.token(); if (!t) return { ok: false, st: 401 };
      const r = await fetch(API.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method, path, body, query, idempotencyKey: method === "POST" ? uid() : undefined }) });
      if (r.status === 404) return { ok: false, off: true };
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) return { ok: false, st: r.status, j };
      return { ok: j.status >= 200 && j.status < 300, st: j.status, j: j.data || {} };
    } catch (e) { return { ok: false, st: 0 }; }
  }
  const errOf = r => (r && r.j && r.j.error && (r.j.error.fields ? Object.values(r.j.error.fields)[0] : (ERR[r.j.error.code] || r.j.error.message))) || (r && r.st === 401 ? "انتهت الجلسة، أعد تسجيل الدخول" : "تعذّر تنفيذ الطلب، حاول لاحقاً");
  const isNotDev = r => r && r.j && r.j.error && r.j.error.code === "not_a_developer";
  async function load() {
    const a = await call("GET", "/v1/appstore/dev/apps");
    if (a.off) { S.off = true; return; } S.off = false;
    if (isNotDev(a)) { S.notDev = true; S.err = ""; return; } S.notDev = false;
    if (!a.ok) { S.err = errOf(a); return; } S.err = ""; S.apps = a.j.apps || [];
    const [d, e] = await Promise.all([call("GET", "/v1/appstore/dev/deliveries", null, { limit: 50, ...(S.dstate ? { state: S.dstate } : {}) }), call("GET", "/v1/appstore/dev/earnings")]);
    if (d.ok) S.dels = d.j.deliveries || []; if (e.ok) S.earn = e.j;
  }
  function css() {
    if ($("ad-css")) return; const s = document.createElement("style"); s.id = "ad-css";
    s.textContent = `#ad-app{display:grid;gap:1rem;max-width:1100px;grid-template-columns:minmax(0,1fr)}#ad-app>*{min-width:0}.ad-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04)}.ad-box h3{margin:0 0 .6rem;font-size:1.05rem}
.ad-tabs{display:flex;gap:.5rem;flex-wrap:wrap}.ad-btn{padding:.55rem 1.1rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(var(--g-mint-d-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-mint-d-rgb),.45),rgba(var(--g-mint-d-rgb),.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.18);backdrop-filter:blur(6px);transition:transform .15s,filter .15s}
.ad-btn:hover{transform:translateY(-2px);filter:saturate(1.2)}.ad-btn.g{border-color:rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06))}.ad-btn.o{border-color:rgba(var(--g-amber-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-amber-rgb),.45),rgba(var(--g-amber-rgb),.16))}.ad-btn.on{outline:2px solid rgba(var(--g-mint-rgb),.8)}.ad-btn[disabled]{opacity:.5;pointer-events:none}.ad-btn.sm{padding:.3rem .7rem;font-size:.8rem}
.ad-tbl{width:100%;border-collapse:collapse;font-size:.85rem}.ad-tbl th,.ad-tbl td{padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;vertical-align:top}.ad-chip{display:inline-block;padding:.1rem .6rem;border-radius:99px;font-size:.75rem;font-weight:800;border:1px solid currentColor}
.ad-wrap{overflow:auto}.ad-hint{font-size:.8rem;opacity:.8;margin:.4rem 0 0}.ad-off{padding:1.2rem;text-align:center;opacity:.85}.ad-sec{padding:.8rem;border-radius:12px;background:rgba(var(--g-amber-rgb),.14);border:1px solid rgba(var(--g-amber-rgb),.55);font-size:.85rem;display:grid;gap:.4rem}.ad-sec code{display:block;direction:ltr;text-align:left;padding:.3rem .5rem;border-radius:8px;background:rgba(0,0,0,.35);word-break:break-all;user-select:all}
.ad-fm{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:.7rem}.ad-fm label.fl{display:grid;gap:.25rem;font-size:.82rem}.ad-fm input,.ad-fm textarea,.ad-fm select{padding:.5rem;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font:inherit;width:100%;box-sizing:border-box}.ad-ck{display:flex;gap:.4rem;align-items:center;font-size:.85rem}
.ad-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem}.ad-kpi div{padding:.8rem;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.ad-kpi b{display:block;font-size:1.3rem}`;
    document.head.appendChild(s);
  }
  const chip = (m, k) => { const x = m[k] || [k, "inherit"]; return `<span class="ad-chip" style="color:rgb(${x[1]})">${esc(x[0])}</span>`; };
  const sec = () => { const x = S.secrets; if (!x) return ""; return `<div class="ad-sec"><b>🔐 احفظ هذه الأسرار الآن — لن تظهر مرة أخرى</b>${x.client_id ? `<div>client_id</div><code>${esc(x.client_id)}</code>` : ""}<div>client_secret</div><code>${esc(x.client_secret)}</code><div>webhook_secret</div><code>${esc(x.webhook_secret)}</code><div><button class="ad-btn g sm" data-ad="hide">أنهيت الحفظ — إخفاء</button></div></div>`; };
  function formHtml() {
    const f = S.form, a = f.draft ? { ...(f.app || {}), ...f.draft } : (f.app || {}), sc = new Set((a.scopes || []).map(x => x.id || x)), ev = new Set(a.events || []);
    return `<div class="ad-box" id="ad-form"><h3>${a.id ? `تعديل «${esc(a.name)}»` : "تطبيق جديد"}</h3>
<div class="ad-fm">${a.id ? "" : `<label class="fl">المعرّف (لاتيني)<input id="adf-slug" maxlength="40" placeholder="my-app" value="${esc(a.slug || "")}"></label>`}
<label class="fl">الاسم<input id="adf-name" maxlength="80" value="${esc(a.name || "")}"></label>
<label class="fl">السعر (دج، 0 = مجاني)<input id="adf-price" type="number" min="0" value="${esc(a.price || 0)}"></label>
<label class="fl">الفوترة<select id="adf-billing"><option value="once"${a.billing !== "monthly" ? " selected" : ""}>دفعة واحدة</option><option value="monthly"${a.billing === "monthly" ? " selected" : ""}>شهرياً</option></select></label>
<label class="fl">رابط الأيقونة (https، اختياري)<input id="adf-icon" dir="ltr" value="${esc(a.icon_url || "")}"></label>
<label class="fl">رابط استقبال الأحداث webhook (https)<input id="adf-hook" dir="ltr" value="${esc(a.webhook_url || "")}"></label>
<label class="fl">روابط إعادة التوجيه OAuth (https، سطر لكل رابط، حتى 3)<textarea id="adf-redir" dir="ltr" rows="3">${esc((a.redirect_uris || []).join("\n"))}</textarea></label>
<label class="fl">الوصف<textarea id="adf-desc" rows="3" maxlength="600">${esc(a.description || "")}</textarea></label></div>
<div class="ad-hint" style="margin-top:.6rem"><b>الصلاحيات المطلوبة</b> (اطلب الأقل الممكن؛ التاجر يوافق على كل واحدة):</div><div class="ad-fm">${SCOPES.map(([k, l]) => `<label class="ad-ck"><input type="checkbox" data-adsc="${k}" ${sc.has(k) ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div>
<div class="ad-hint" style="margin-top:.6rem"><b>الأحداث المطلوب استقبالها</b> (تتطلب «قراءة الطلبات» ورابط webhook):</div><div class="ad-fm">${EVENTS.map(k => `<label class="ad-ck"><input type="checkbox" data-adev="${k}" ${ev.has(k) ? "checked" : ""}> ${k}</label>`).join("")}</div>
${a.id && a.status === "approved" ? '<p class="ad-hint">⚠️ تعديل السعر أو الصلاحيات أو الأحداث أو الروابط على تطبيق معتمد يعيده إلى المراجعة.</p>' : ""}
<div style="margin-top:.7rem"><button class="ad-btn" data-ad="save" ${S.busy ? "disabled" : ""}>${a.id ? "حفظ التعديلات" : "إنشاء التطبيق"}</button> <button class="ad-btn g" data-ad="cancel">إلغاء</button></div></div>`;
  }
  function appsHtml() {
    const rows = S.apps.map(a => `<tr><td><b>${esc(a.name)}</b><div class="ad-hint">${esc(a.slug)}${a.domain_verified ? ' · <span style="color:rgb(var(--g-mint-rgb))">✔ نطاق موثّق</span>' : ""}</div>${a.status === "rejected" || a.status === "suspended" ? `<div class="ad-hint" style="color:rgb(var(--g-rose-rgb))">${esc(a.review_note || "")}</div>` : ""}</td>
<td>${chip(ST, a.status)}<div class="ad-hint">${a.price > 0 ? nf(a.price) + " دج" + (a.billing === "monthly" ? " / شهر" : "") : "مجاني"}</div></td>
<td><div class="ad-hint">${a.rating ? "★ " + esc(a.rating) + " (" + esc(a.rating_count) + ")" : "بلا تقييم"}</div></td>
<td><button class="ad-btn g sm" data-ad="edit" data-id="${a.id}">تعديل</button> ${["draft", "rejected"].includes(a.status) ? `<button class="ad-btn sm" data-ad="submit" data-id="${a.id}" data-n="${esc(a.name)}">إرسال للمراجعة</button> ` : ""}${a.webhook_url && !a.domain_verified ? `<button class="ad-btn o sm" data-ad="verify" data-id="${a.id}">توثيق النطاق</button> ` : ""}<button class="ad-btn o sm" data-ad="rotate" data-id="${a.id}" data-n="${esc(a.name)}">تدوير الأسرار</button></td></tr>`).join("");
    return `${sec()}${S.form ? formHtml() : ""}<div class="ad-box"><h3>تطبيقاتي</h3>${rows ? `<div class="ad-wrap"><table class="ad-tbl"><thead><tr><th>التطبيق</th><th>الحالة والسعر</th><th>التقييم</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="ad-hint">لا تطبيقات بعد.</p>'}<div style="margin-top:.7rem"><button class="ad-btn" data-ad="new">＋ تطبيق جديد</button></div>
<p class="ad-hint">لتوثيق النطاق: انشر الملف <code style="direction:ltr">https://نطاق-webhook/.well-known/alyssum-app.json</code> بمحتوى <code style="direction:ltr;display:inline">{"client_id":"ci_…"}</code> ثم اضغط «توثيق النطاق».</p></div>`;
  }
  function delsHtml() {
    const rows = S.dels.map(d => `<tr><td>${esc(d.app)}</td><td dir="ltr">${esc(d.type)}</td><td>${chip(DS, d.state)}</td><td>${esc(d.attempts)}</td><td>${esc(d.error || "")}</td><td>${esc(dt(d.created_at))}</td><td>${d.state === "failed" ? `<button class="ad-btn o sm" data-ad="retry" data-id="${d.id}">إعادة إرسال</button>` : ""}</td></tr>`).join("");
    return `<div class="ad-box"><h3>سجلّ تسليمات الأحداث</h3><div class="ad-tabs" style="margin-bottom:.6rem">${[["", "الكل"], ["failed", "الفاشلة"], ["pending", "المعلّقة"], ["sent", "الناجحة"]].map(([k, l]) => `<button class="ad-btn g sm ${S.dstate === k ? "on" : ""}" data-ad="dstate" data-k="${k}">${l}</button>`).join("")}</div>
${rows ? `<div class="ad-wrap"><table class="ad-tbl"><thead><tr><th>التطبيق</th><th>الحدث</th><th>الحالة</th><th>المحاولات</th><th>الخطأ</th><th>التاريخ</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="ad-hint">لا تسليمات.</p>'}</div>`;
  }
  function earnHtml() {
    const e = S.earn; if (!e) return '<div class="ad-box ad-off">لا بيانات.</div>';
    const t = e.totals || {}, rows = (e.revenues || []).map(x => `<tr><td>${esc(x.app)}</td><td>${esc(x.period)}</td><td>${nf(x.gross)}</td><td>${nf(x.fee)}</td><td><b>${nf(x.net)}</b></td><td>${esc(x.state)}</td></tr>`).join("");
    return `<div class="ad-box"><h3>إيراداتي</h3><div class="ad-kpi"><div>الإجمالي<b>${nf(t.gross)} دج</b></div><div>عمولة المنصة<b>${nf(t.fee)} دج</b></div><div>صافيك<b>${nf(t.net)} دج</b></div></div><p class="ad-hint">الصافي يُقيَّد في متاح محفظتك.</p>
${rows ? `<div class="ad-wrap"><table class="ad-tbl"><thead><tr><th>التطبيق</th><th>الفترة</th><th>الإجمالي</th><th>العمولة</th><th>الصافي</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}</div>`;
  }
  function draw() {
    const host = $("ad-app"); if (!host) return;
    if (S.off) { host.innerHTML = '<div class="ad-box ad-off">بوابة المطوّر غير مفعّلة على حسابك — تواصل مع الدعم.</div>'; return; }
    if (S.notDev) { host.innerHTML = '<div class="ad-box ad-off">حسابك غير مفعّل كمطوّر تطبيقات. تواصل مع الدعم لتفعيله ثم عُد إلى هنا.</div>'; return; }
    if (S.err) { host.innerHTML = `<div class="ad-box ad-off">${esc(S.err)} <button class="ad-btn" data-ad="reload">إعادة المحاولة</button></div>`; return; }
    const tabs = `<div class="ad-tabs">${[["apps", "تطبيقاتي"], ["dels", "سجلّ التسليمات"], ["earn", "إيراداتي"]].map(([k, l]) => `<button class="ad-btn g ${S.tab === k ? "on" : ""}" data-ad="tab" data-k="${k}">${l}</button>`).join("")}</div>`;
    host.innerHTML = tabs + (S.tab === "apps" ? appsHtml() : S.tab === "dels" ? delsHtml() : earnHtml());
  }
  const readForm = () => {
    const v = id => ($(id) || {}).value || "", f = S.form.app || {};
    const b = { name: v("adf-name").trim(), description: v("adf-desc"), price: +v("adf-price") || 0, billing: v("adf-billing"), icon_url: v("adf-icon").trim(), webhook_url: v("adf-hook").trim(),
      redirect_uris: v("adf-redir").split("\n").map(x => x.trim()).filter(Boolean), scopes: [...document.querySelectorAll("[data-adsc]:checked")].map(x => x.dataset.adsc), events: [...document.querySelectorAll("[data-adev]:checked")].map(x => x.dataset.adev) };
    if (!f.id) b.slug = v("adf-slug").trim().toLowerCase();
    return b;
  };
  async function save() {
    const f = S.form, b = readForm(); if (f.app && f.app.id && b.scopes.some(s => s === "read_customers") && !(f.app.scopes || []).some(s => (s.id || s) === "read_customers") && !confirm("طلب بيانات الزبائن (أسماء وهواتف) يجعل المراجعة أشدّ ويطلب موافقة صريحة من كل تاجر. متابعة؟")) return;
    f.draft = b; S.busy = true; draw(); const r = f.app && f.app.id ? await call("PUT", `/v1/appstore/dev/apps/${f.app.id}`, b) : await call("POST", "/v1/appstore/dev/apps", b); S.busy = false;
    if (!r.ok) { draw(); return toast(errOf(r)); }
    S.form = null; if (r.j.client_secret) S.secrets = { client_id: r.j.client_id, client_secret: r.j.client_secret, webhook_secret: r.j.webhook_secret }; else if (r.j.resubmitted) toast("عاد التطبيق إلى المراجعة بسبب تعديل حقل حسّاس"); else toast("✅ تم الحفظ");
    await refresh();
  }
  async function onClick(e) {
    const el = e.target.closest("[data-ad]"); if (!el) return; const a = el.dataset.ad, id = +el.dataset.id;
    if (a === "reload") { S.err = ""; await refresh(); }
    else if (a === "tab") { S.tab = el.dataset.k; S.form = null; draw(); }
    else if (a === "new") { S.form = { app: null }; draw(); const x = $("ad-form"); if (x && x.scrollIntoView) x.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (a === "edit") { S.form = { app: S.apps.find(x => x.id === id) }; draw(); const x = $("ad-form"); if (x && x.scrollIntoView) x.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (a === "cancel") { S.form = null; draw(); }
    else if (a === "hide") { S.secrets = null; draw(); }
    else if (a === "save") await save();
    else if (a === "submit") { if (!confirm(`إرسال «${el.dataset.n}» للمراجعة؟`)) return; const r = await call("POST", `/v1/appstore/dev/apps/${id}/submit`, {}); toast(r.ok ? "✅ أُرسل للمراجعة" : errOf(r)); await refresh(); }
    else if (a === "rotate") { if (!confirm(`تدوير أسرار «${el.dataset.n}»؟ ستبطل الأسرار القديمة فوراً وعليك تحديثها في خادمك.`)) return; const r = await call("POST", `/v1/appstore/dev/apps/${id}/rotate-secrets`, {}); if (r.ok) { S.secrets = { client_secret: r.j.client_secret, webhook_secret: r.j.webhook_secret }; S.tab = "apps"; draw(); const x = document.querySelector(".ad-sec"); if (x && x.scrollIntoView) x.scrollIntoView({ block: "center" }); } else toast(errOf(r)); }
    else if (a === "verify") { const r = await call("POST", `/v1/appstore/dev/apps/${id}/verify-domain`, {}); toast(r.ok ? "✅ تم توثيق النطاق" : errOf(r)); await refresh(); }
    else if (a === "dstate") { S.dstate = el.dataset.k; await refresh(); }
    else if (a === "retry") { const r = await call("POST", `/v1/appstore/dev/deliveries/${id}/retry`, {}); toast(r.ok ? "سيُعاد الإرسال خلال دقيقة" : errOf(r)); await refresh(); }
  }
  async function refresh() { await load(); draw(); }
  function bind() { const root = $("ad-app"); if (!root || root._b) return; root._b = 1; root.addEventListener("click", onClick); }
  async function render() {
    css(); const host = $("appdev-content"); if (!host) return; if (!$("ad-app")) host.innerHTML = '<div id="ad-app"></div>'; bind(); draw();
    clearInterval(S.timer); S.timer = setInterval(() => { const t = $("tab-appdev"); if (t && !t.classList.contains("hidden") && !document.hidden && !S.busy && !S.form) refresh(); }, 90000);
    await refresh();
  }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._adWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-appdev"); if (el) el.classList.toggle("hidden", t !== "appdev"); if (t === "appdev") render(); else clearInterval(S.timer); return r; };
      Admin._adWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, refresh, S };
})();
