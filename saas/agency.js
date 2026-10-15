/* «خدمات التسويق» داخل لوحة مزوّد المنصة (وكالة بعلامة بيضاء): طلبات التجار (تحديث الحالة، رابط دعوة الحساب، إعادة إبلاغ الوكالة)، كتالوج الخدمات بأسعار الدينار، وإعدادات الشريك.
   كل الطلبات تمرّ بدالة platform-admin (تتحقق أنك مدير منصة وتحمل رمز الإدارة في الخادم)؛ لا أسرار هنا — أسرار الشريك تُرسل مرة واحدة وتُشفَّر في الخادم ولا تُعرض بعدها. */
window.SaasAgency = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { orders: [], next: null, st: "pending", services: [], partner: null, edit: null, err: "", busy: false };
  let getToken = async () => null, root = null;
  const say = t => { const b = $("toasts"); if (!b) return alert(t); const d = document.createElement("div"); d.className = "toast"; d.textContent = t; b.appendChild(d); setTimeout(() => d.remove(), 7000); };
  const C = () => window.SAAS_CFG || {};
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  async function api(method, path, body) {
    const t = await getToken(); if (!t) return { ok: false, j: { error: "unauthorized" } };
    try {
      const r = await fetch(C().URL + "/functions/v1/platform-admin", { method: "POST", headers: { Authorization: "Bearer " + t, apikey: C().KEY, "Content-Type": "application/json" }, body: JSON.stringify({ method, path, body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return { ok: false, j: { error: j.error || "http_" + r.status } };
      const d = j.data && j.data.error && typeof j.data.error === "object" ? { error: j.data.error.code, message: j.data.error.message, fields: j.data.error.fields } : (j.data || {});
      return { ok: j.status >= 200 && j.status < 300, j: d };
    } catch (e) { return { ok: false, j: { error: "network" } }; }
  }
  const ERR = { not_configured: "الخدمة غير مضبوطة بعد", unauthorized: "سجّل الدخول من جديد", network: "تعذّر الاتصال", path_not_allowed: "إجراء غير مسموح", bad_transition: "لا يمكن هذا الانتقال من الحالة الحالية", insufficient_funds: "رصيد غير كافٍ", code_taken: "الكود مستعمل", wallet_unavailable: "المحفظة غير مفعّلة", vault_unavailable: "تخزين الأسرار غير مضبوط" };
  const why = r => (r.j.fields && Object.values(r.j.fields)[0]) || ERR[r.j.error] || r.j.message || r.j.error || "فشل";
  const ST = { pending: ["بانتظار الإبلاغ/التنفيذ", "var(--amb)"], processing: ["قيد التنفيذ عند الوكالة", "var(--blu)"], delivered: ["مُسلَّم", "var(--grn)"], rejected: ["مرفوض (رُدّ المبلغ)", "var(--red)"] };
  const TL = { pending: "بانتظار", processing: "قيد التنفيذ", delivered: "مُسلَّمة", rejected: "مرفوضة" };
  const PS = { queued: "في الانتظار", sending: "جارٍ الإرسال", sent: "أُرسل للوكالة ✓", failed: "فشل الإرسال", unconfigured: "الشريك غير مضبوط" };
  const KINDS = { tiktok: "TikTok", meta: "Meta", google: "Google", snapchat: "Snapchat", other: "أخرى" };

  async function load(more) {
    S.busy = true; draw();
    const [o, s, p] = await Promise.all([api("GET", "/admin/agency/orders?status=" + S.st + (more && S.next ? "&after=" + S.next : "")), api("GET", "/admin/agency/services"), api("GET", "/admin/agency/partner")]);
    S.busy = false;
    if (!o.ok) { S.err = why(o); draw(); return; } S.err = "";
    S.orders = more ? S.orders.concat(o.j.orders || []) : o.j.orders || []; S.next = o.j.next || null; S.sla = o.j.sla_hours || 24; S.services = (s.ok && s.j.services) || []; S.partner = p.ok ? p.j : null; draw();
  }
  function draw() {
    if (!root) return;
    if (S.busy && !S.partner) { root.innerHTML = '<div class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { root.innerHTML = '<div class="card"><b>خدمات التسويق</b><p class="hint" style="color:#f87171">' + esc(S.err) + '</p><button class="btn" data-ag="reload">إعادة المحاولة</button></div>'; return; }
    const tabs = Object.keys(ST).map(k => '<button class="btn ' + (S.st === k ? "" : "g") + '" data-ag="st" data-st="' + k + '">' + TL[k] + '</button>').join(" ");
    const rows = S.orders.map(o => {
      const acts = o.status === "pending" || o.status === "processing" ? ((o.status === "pending" && (o.partner_state === "failed" || o.partner_state === "unconfigured") ? '<button class="btn g" data-ag="resend" data-id="' + o.id + '">إعادة الإرسال للوكالة</button> ' : "") +
        (o.status === "pending" ? '<button class="btn g" data-ag="proc" data-id="' + o.id + '">تعليم «قيد التنفيذ»</button> ' : "") +
        '<button class="btn" data-ag="deliver" data-id="' + o.id + '">تسليم + رابط الدعوة</button> <button class="btn r" data-ag="reject" data-id="' + o.id + '">رفض واسترداد</button>') : (o.invite_link ? '<span class="hint" dir="ltr">' + esc(o.invite_link) + '</span>' : esc(o.note || ""));
      return '<tr' + (o.late ? ' style="background:rgba(248,113,113,.08)"' : '') + '><td><b dir="ltr">AG-' + o.id + '</b><div class="hint" dir="ltr">' + esc(String(o.created_at).slice(0, 16)) + '</div></td><td>' + esc(o.tenant_name || "#" + o.tenant_id) + '</td><td>' + esc(o.service_name) + '<div class="hint">' + nf(o.price) + ' دج</div></td>' +
        '<td><b>' + esc(o.store_name) + '</b><div class="hint" dir="ltr">' + esc(o.client_email) + '</div>' + (o.facebook_page_url ? '<div class="hint" dir="ltr">' + esc(o.facebook_page_url) + '</div>' : "") + '</td>' +
        '<td><span class="pill" style="color:' + ST[o.status][1] + ';border-color:currentColor">' + ST[o.status][0] + '</span>' + (o.late ? ' <span class="pill" style="color:var(--red);border-color:currentColor">⏰ متأخر</span>' : '') + '<div class="hint">' + esc(PS[o.partner_state] || o.partner_state) + (o.last_error ? ' — <span style="color:#f87171">' + esc(o.last_error) + '</span>' : "") + '</div></td><td>' + acts + '</td></tr>';
    }).join("");
    const orders = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><b>🧾 طلبات الحسابات الإعلانية</b>' + (S.orders.some(o => o.late) ? ' <span class="pill" style="color:var(--red);border-color:currentColor">⏰ ' + S.orders.filter(o => o.late).length + ' متأخر (مهلة ' + S.sla + ' ساعة)</span>' : '') + '<button class="btn" data-ag="reload">تحديث</button></div><div style="margin:.5rem 0">' + tabs + '</div>' +
      '<div style="overflow:auto"><table><thead><tr><th>الطلب</th><th>التاجر</th><th>الخدمة</th><th>المتجر والزبون</th><th>الحالة</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="hint">لا طلبات في هذه الحالة.</td></tr>') + '</tbody></table></div>' + (S.next ? '<button class="btn g" data-ag="more">عرض المزيد</button>' : "") +
      '<p class="hint">«تسليم» يحرّر مبلغ التاجر المحجوز كإيراد للمنصة ويُظهر له رابط الدعوة؛ «رفض» يردّ المبلغ لمتاحه فوراً.</p></div>';
    const svcRows = S.services.map(s => '<tr><td dir="ltr">' + esc(s.code) + '</td><td>' + esc(s.name) + '<div class="hint">' + esc(KINDS[s.kind] || s.kind) + (s.needs_page ? " · يتطلب رابط صفحة" : "") + '</div></td><td>' + nf(s.price) + ' دج</td><td>' + (s.active ? "✓ نشطة" : "معطّلة") + '</td><td><button class="btn g" data-ag="edit" data-id="' + s.id + '">تعديل</button></td></tr>').join("");
    const e = S.edit, f = (k, label, v, extra) => '<label class="f">' + label + '<input data-sf="' + k + '" value="' + esc(v == null ? "" : v) + '" ' + (extra || "") + '></label>';
    const form = e ? '<div class="card" style="margin:.6rem 0"><b>' + (e.id ? "تعديل خدمة" : "خدمة جديدة") + '</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem">' + f("code", "الكود (لاتيني)", e.code, 'dir="ltr" placeholder="tiktok-ads"') + f("name", "الاسم الظاهر للتاجر", e.name) + f("price", "السعر (دج)", e.price, 'type="number" min="1"') +
      '<label class="f">النوع<select data-sf="kind">' + Object.keys(KINDS).map(k => '<option value="' + k + '"' + (e.kind === k ? " selected" : "") + '>' + KINDS[k] + '</option>').join("") + '</select></label>' + f("sort", "الترتيب", e.sort == null ? 100 : e.sort, 'type="number"') + '</div>' +
      f("description", "وصف قصير", e.description) + '<label class="f" style="flex-direction:row;gap:.5rem;align-items:center"><input type="checkbox" data-sf="needs_page"' + (e.needs_page ? " checked" : "") + '> تتطلب رابط صفحة فيسبوك</label><label class="f" style="flex-direction:row;gap:.5rem;align-items:center"><input type="checkbox" data-sf="active"' + (e.active !== 0 && e.active !== false ? " checked" : "") + '> نشطة (تظهر للتجار)</label>' +
      '<button class="btn" data-ag="save-svc">حفظ</button> <button class="btn g" data-ag="cancel-svc">إلغاء</button></div>' : "";
    const svc = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>🛍 كتالوج الخدمات</b><button class="btn" data-ag="new-svc">＋ خدمة</button></div>' + form +
      '<div style="overflow:auto"><table><thead><tr><th>الكود</th><th>الخدمة</th><th>السعر</th><th>الحالة</th><th></th></tr></thead><tbody>' + (svcRows || '<tr><td colspan="5" class="hint">لا خدمات بعد.</td></tr>') + '</tbody></table></div><p class="hint">تغيير السعر لا يمسّ الطلبات السابقة (السعر لقطة وقت الشراء).</p></div>';
    const p = S.partner || {}, c = p.config || {}, pf = (k, label, v, extra) => '<label class="f">' + label + '<input data-pf="' + k + '" value="' + esc(v == null ? "" : v) + '" ' + (extra || "") + '></label>';
    const partner = '<div class="card"><b>🤝 الوكالة الشريكة</b><p class="hint">كل طلب مدفوع يُرسل تلقائياً إلى الوكالة: webhook موقَّع (HMAC-SHA256 في X-Agency-Signature) و/أو بريد منظَّم. الوكالة تردّ بالتسليم على <span dir="ltr">/v1/agency/partner/callback</span> بنفس التوقيع، أو تحدّث الحالة أنت من هنا. بيانات الشريك لا تظهر للتجار أبداً.</p>' +
      '<label class="f">طريقة الإبلاغ<select data-pf="notify">' + [["webhook", "Webhook فقط"], ["email", "بريد فقط"], ["both", "الاثنان"]].map(([k, l]) => '<option value="' + k + '"' + ((c.notify || "webhook") === k ? " selected" : "") + '>' + l + '</option>').join("") + '</select></label>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.6rem">' + pf("webhook_url", "رابط webhook الوكالة (https)", c.webhook_url, 'dir="ltr" placeholder="https://agency.example/hook"') + pf("webhook_secret", "سرّ التوقيع " + (p.has_webhook_secret ? "(محفوظ — اتركه فارغاً للإبقاء)" : "(مطلوب)"), "", 'type="password" autocomplete="new-password" dir="ltr"') +
      pf("sla_hours", "مهلة التسليم (ساعات) قبل وسم «متأخر»", c.sla_hours || 24, 'type="number" min="1" max="720"') + pf("email_to", "بريد الوكالة", c.email_to, 'dir="ltr" placeholder="ops@agency.example"') + pf("email_from", "المرسل", c.email_from, 'dir="ltr" placeholder="Alyssum <noreply@yourdomain>"') + pf("resend_key", "مفتاح خدمة البريد " + (p.has_resend_key ? "(محفوظ)" : ""), "", 'type="password" autocomplete="new-password" dir="ltr"') + '</div>' +
      '<label class="f" style="flex-direction:row;gap:.5rem;align-items:center"><input type="checkbox" data-pc="notify_client"' + (c.notify_client !== false ? " checked" : "") + '> أرسل بريداً للزبون برابط الدعوة عند التسليم (يتطلب مفتاح البريد والمرسل)</label><button class="btn" data-ag="save-partner">حفظ إعدادات الشريك</button></div>';
    root.innerHTML = orders + svc + partner;
  }
  const newSvc = () => ({ code: "", name: "", price: "", kind: "tiktok", description: "", needs_page: false, active: 1, sort: 100 });
  function readSvc() { const o = {}; root.querySelectorAll("[data-sf]").forEach(i => { const k = i.dataset.sf; o[k] = i.type === "checkbox" ? i.checked : i.value.trim(); }); o.price = Math.round(+o.price); o.sort = Math.floor(+o.sort) || 0; return o; }
  async function onClick(e) {
    const b = e.target.closest("[data-ag]"); if (!b) return; const k = b.dataset.ag, id = +b.dataset.id, o = S.orders.find(x => x.id === id);
    if (k === "reload") return load(); if (k === "st") { S.st = b.dataset.st; return load(); } if (k === "more") return load(true);
    if (k === "new-svc") { S.edit = newSvc(); return draw(); } if (k === "cancel-svc") { S.edit = null; return draw(); }
    if (k === "edit") { const s = S.services.find(x => x.id === id); S.edit = s ? { ...s } : null; return draw(); }
    if (k === "save-svc") { const v = readSvc(), r = S.edit && S.edit.id ? await api("PUT", "/admin/agency/services/" + S.edit.id, v) : await api("POST", "/admin/agency/services", v); say(r.ok ? "✓ حُفظت الخدمة" : "فشل: " + why(r)); if (r.ok) S.edit = null; return load(); }
    if (k === "save-partner") {
      const body = {}; root.querySelectorAll("[data-pf]").forEach(i => { if (i.value.trim() !== "" || !/secret|key/.test(i.dataset.pf)) body[i.dataset.pf] = i.dataset.pf === "sla_hours" ? Math.floor(+i.value) || 24 : i.value.trim(); }); const nc = root.querySelector("[data-pc=notify_client]"); if (nc) body.notify_client = nc.checked;
      const r = await api("PUT", "/admin/agency/partner", body); say(r.ok ? "✓ حُفظت إعدادات الشريك" + (r.j.requeued ? " — وأُعيد إرسال " + r.j.requeued + " طلب منتظر" : "") : "فشل: " + why(r)); return load();
    }
    if (!o) return;
    if (k === "resend") { const r = await api("POST", "/admin/agency/orders/" + id + "/resend", {}); say(r.ok && r.j.sent ? "✓ أُرسل للوكالة" : "لم يُرسل: " + (r.j.error || why(r))); return load(); }
    if (k === "proc") { if (!confirm("تعليم AG-" + id + " «قيد التنفيذ» دون إبلاغ الوكالة تلقائياً؟ (استعمله إن أبلغتها يدوياً)")) return; const r = await api("PATCH", "/admin/agency/orders/" + id, { status: "processing" }); say(r.ok ? "✓ تم" : "فشل: " + why(r)); return load(); }
    if (k === "deliver") {
      const link = prompt("رابط دعوة الحساب الإعلاني (https) — يراه التاجر في لوحته:", ""); if (link === null) return;
      if (!/^https:\/\//i.test(link.trim())) return say("الرابط يجب أن يبدأ بـ https://");
      if (!confirm("تسليم AG-" + id + " إلى «" + (o.tenant_name || o.tenant_id) + "»؟\nسيُحرَّر مبلغ " + nf(o.price) + " دج كإيراد للمنصة.")) return;
      const r = await api("PATCH", "/admin/agency/orders/" + id, { status: "delivered", invite_link: link.trim() }); say(r.ok ? "✓ سُلِّم الطلب" : "فشل: " + why(r)); return load();
    }
    if (k === "reject") {
      const note = prompt("سبب الرفض (يراه التاجر):", ""); if (note === null) return;
      if (!confirm("رفض AG-" + id + " وردّ " + nf(o.price) + " دج إلى متاح «" + (o.tenant_name || o.tenant_id) + "»؟")) return;
      const r = await api("PATCH", "/admin/agency/orders/" + id, { status: "rejected", note }); say(r.ok ? "✓ رُفض واستُرد المبلغ" : "فشل: " + why(r)); return load();
    }
  }
  return { mount(el, tokenFn) { root = el; getToken = tokenFn; el.onclick = onClick; load(); }, S };
})();
