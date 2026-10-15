/* «متجر التطبيقات» داخل لوحة مزوّد المنصة: مراجعة تطبيقات المطوّرين (اعتماد/رفض/تعليق مع إبطال رموزهم فوراً)، تفعيل حسابات المطوّرين، ضبط عمولة المنصة، وملخص الإيرادات.
   كل الطلبات تمرّ بدالة platform-admin (تتحقق أنك مدير منصة وتحمل رمز الإدارة في الخادم). الأسرار لا تظهر هنا أبداً. */
window.SaasAppStore = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { apps: [], st: "pending", pct: 20, rev: null, inst: [], open: null, err: "", busy: false };
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
  const ERR = { unauthorized: "سجّل الدخول من جديد", network: "تعذّر الاتصال", path_not_allowed: "إجراء غير مسموح", bad_transition: "لا يمكن هذا الانتقال من الحالة الحالية", not_found: "غير موجود", validation_error: "قيمة غير صالحة" };
  const why = r => (r.j.fields && Object.values(r.j.fields)[0]) || ERR[r.j.error] || r.j.message || r.j.error || "فشل";
  const ST = { pending: ["بانتظار المراجعة", "var(--amb)"], approved: ["معتمد", "var(--grn)"], rejected: ["مرفوض", "var(--red)"], suspended: ["موقوف", "var(--red)"], draft: ["مسودة", "var(--blu)"] };
  const TL = { pending: "بانتظار المراجعة", approved: "معتمدة", suspended: "موقوفة", rejected: "مرفوضة", draft: "مسودات" };
  async function load() {
    S.busy = true; draw();
    const [a, s, r, i] = await Promise.all([api("GET", "/admin/appstore/apps?status=" + S.st), api("GET", "/admin/appstore/settings"), api("GET", "/admin/appstore/revenues"), api("GET", "/admin/appstore/installations")]);
    S.busy = false; if (!a.ok) { S.err = why(a); draw(); return; } S.err = "";
    S.apps = a.j.apps || []; S.pct = s.ok ? s.j.commission_pct : S.pct; S.rev = r.ok ? r.j : null; S.inst = i.ok ? i.j.installations || [] : []; draw();
  }
  function draw() {
    if (!root) return;
    if (S.busy && !S.rev) { root.innerHTML = '<div class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { root.innerHTML = '<div class="card"><b>متجر التطبيقات</b><p class="hint" style="color:#f87171">' + esc(S.err) + '</p><button class="btn" data-as="reload">إعادة المحاولة</button></div>'; return; }
    const cnt = id => S.inst.filter(i => i.app_id === id && ["active", "past_due"].includes(i.status)).length;
    const tabs = Object.keys(TL).map(k => '<button class="btn ' + (S.st === k ? "" : "g") + '" data-as="st" data-st="' + k + '">' + TL[k] + '</button>').join(" ");
    const rows = S.apps.map(a => {
      const sens = a.scopes.some(s => s.sensitive), open = S.open === a.id;
      const acts = (a.status === "pending" ? '<button class="btn" data-as="rev" data-to="approved" data-id="' + a.id + '">اعتماد</button> <button class="btn r" data-as="rev" data-to="rejected" data-id="' + a.id + '">رفض</button> ' : "") +
        (a.status === "approved" ? '<button class="btn g" data-as="feat" data-on="' + (a.featured ? 0 : 1) + '" data-id="' + a.id + '">' + (a.featured ? "إلغاء التمييز" : "⭐ تمييز") + '</button> <button class="btn r" data-as="rev" data-to="suspended" data-id="' + a.id + '">تعليق فوري</button> ' : "") + (a.status === "suspended" ? '<button class="btn" data-as="rev" data-to="approved" data-id="' + a.id + '">إعادة الاعتماد</button> ' : "") + '<button class="btn g" data-as="open" data-id="' + a.id + '">' + (open ? "إخفاء" : "تفاصيل") + '</button>';
      const det = open ? '<tr><td colspan="6"><div class="card" style="margin:0">' +
        '<div class="hint">النطاقات: ' + a.scopes.map(s => (s.sensitive ? '<b style="color:var(--red)">⚠ ' : "<b>") + esc(s.id) + "</b> — " + esc(s.label)).join("<br>") + '</div>' +
        '<div class="hint" dir="ltr">Webhook: ' + esc(a.webhook_url || "—") + '</div><div class="hint" dir="ltr">Redirect: ' + esc((a.redirect_uris || []).join(" , ")) + '</div><div class="hint" dir="ltr">Events: ' + esc((a.events || []).join(" , ") || "—") + '</div>' +
        (a.review_note ? '<div class="hint">ملاحظة المراجعة: ' + esc(a.review_note) + '</div>' : "") + '<p class="hint">راجع: أن الرابط يخصّ المطوّر فعلاً، وأن النطاقات الحسّاسة (بيانات الزبائن) مبرَّرة بوظيفة التطبيق، وأن السعر واضح.</p></div></td></tr>' : "";
      return '<tr><td><b>' + esc(a.name) + '</b><div class="hint" dir="ltr">' + esc(a.slug) + '</div></td><td>' + esc(a.developer || "#" + a.developer_id) + '<div class="hint">مطوّر #' + a.developer_id + '</div></td><td>' + (a.price > 0 ? nf(a.price) + " دج" + (a.billing === "monthly" ? " / شهر" : "") : "مجاني") + '</td><td>' + (sens ? '<span class="pill" style="color:var(--red);border-color:currentColor">بيانات الزبائن</span> ' : "") + a.scopes.length + ' نطاق</td><td><span class="pill" style="color:' + ST[a.status][1] + ';border-color:currentColor">' + ST[a.status][0] + '</span>' + (a.featured ? ' ⭐' : '') + (a.domain_verified ? ' <span class="hint">✔ نطاق موثّق</span>' : '') + (a.rating ? ' <span class="hint">★ ' + esc(a.rating) + ' (' + esc(a.rating_count) + ')</span>' : '') + (a.status === "approved" ? '<div class="hint">' + cnt(a.id) + ' تثبيت</div>' : "") + '</td><td>' + acts + '</td></tr>' + det;
    }).join("");
    const t = (S.rev && S.rev.totals) || {};
    const head = '<div class="card"><b>🧩 مراجعة تطبيقات المطوّرين</b><div style="margin:.5rem 0">' + tabs + ' <button class="btn" data-as="reload">تحديث</button></div><div style="overflow:auto"><table><thead><tr><th>التطبيق</th><th>المطوّر</th><th>السعر</th><th>الصلاحيات</th><th>الحالة</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="hint">لا تطبيقات في هذه الحالة.</td></tr>') + '</tbody></table></div>' +
      '<p class="hint">«تعليق فوري» يُبطل رموز التطبيق في كل المتاجر لحظياً ويخفيه من السوق. تعديل مطوّر لحقل حسّاس (السعر/النطاقات/الروابط/الأحداث) يعيد تطبيقه المعتمد إلى «بانتظار المراجعة».</p></div>';
    const money = '<div class="card"><b>💰 العمولة والإيرادات</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.6rem;margin:.5rem 0"><div class="card" style="margin:0"><div class="hint">إجمالي المبيعات</div><b>' + nf(t.gross) + ' دج</b></div><div class="card" style="margin:0"><div class="hint">عمولة المنصة</div><b>' + nf(t.fee) + ' دج</b></div><div class="card" style="margin:0"><div class="hint">حصة المطوّرين</div><b>' + nf(t.net) + ' دج</b></div><div class="card" style="margin:0"><div class="hint">قيود غير مسوّاة</div><b>' + nf(t.unsettled) + '</b></div></div>' +
      '<label class="f">عمولة المنصة % (تسري على الاشتراءات القادمة، 0–50)<input id="as-pct" type="number" min="0" max="50" value="' + esc(S.pct) + '"></label><button class="btn" data-as="pct">حفظ العمولة</button></div>';
    const dev = '<div class="card"><b>👩‍💻 حسابات المطوّرين</b><p class="hint">المطوّر هو مستأجر في المنصة (له محفظة تستقبل حصته). أدخل رقم المستأجر لتفعيله كمطوّر ليتمكن من إنشاء تطبيقات بمفتاحه؛ الإيقاف يمنع إنشاء تطبيقات جديدة.</p><label class="f">رقم المستأجر<input id="as-dev" type="number" min="1" dir="ltr"></label><button class="btn" data-as="dev" data-to="active">تفعيل كمطوّر</button> <button class="btn r" data-as="dev" data-to="suspended">إيقاف</button></div>';
    root.innerHTML = head + money + dev;
  }
  async function onClick(e) {
    const b = e.target.closest("[data-as]"); if (!b) return; const k = b.dataset.as, id = +b.dataset.id;
    if (k === "reload") return load(); if (k === "st") { S.st = b.dataset.st; S.open = null; return load(); } if (k === "open") { S.open = S.open === id ? null : id; return draw(); }
    if (k === "rev") {
      const a = S.apps.find(x => x.id === id), to = b.dataset.to, L = { approved: "اعتماد", rejected: "رفض", suspended: "تعليق" }[to];
      let note = ""; if (to !== "approved") { note = prompt("سبب " + L + " (يراه المطوّر):", ""); if (note === null) return; }
      if (!confirm(L + " «" + (a ? a.name : id) + "»؟" + (to === "suspended" ? "\nستُبطل رموزه في كل المتاجر فوراً." : ""))) return;
      const r = await api("POST", "/admin/appstore/apps/" + id + "/review", { status: to, note }); say(r.ok ? "✓ تم" : "فشل: " + why(r)); return load();
    }
    if (k === "feat") { const r = await api("POST", "/admin/appstore/apps/" + id + "/feature", { featured: b.dataset.on === "1" }); say(r.ok ? "✓ تم" : "فشل: " + why(r)); return load(); }
    if (k === "pct") { const v = Math.round(+$("as-pct").value); if (!(v >= 0 && v <= 50)) return say("العمولة بين 0 و50"); const r = await api("PUT", "/admin/appstore/settings", { commission_pct: v }); say(r.ok ? "✓ حُفظت العمولة " + v + "%" : "فشل: " + why(r)); return load(); }
    if (k === "dev") { const tid = Math.floor(+$("as-dev").value); if (!(tid > 0)) return say("اكتب رقم المستأجر"); if (!confirm((b.dataset.to === "active" ? "تفعيل" : "إيقاف") + " المستأجر #" + tid + " كمطوّر؟")) return; const r = await api("POST", "/admin/appstore/developers", { tenant_id: tid, status: b.dataset.to }); say(r.ok ? "✓ تم" : "فشل: " + why(r)); }
  }
  return { mount(el, tokenFn) { root = el; getToken = tokenFn; el.onclick = onClick; load(); }, S };
})();
