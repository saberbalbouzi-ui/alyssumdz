/* «الشحن» داخل لوحة مزوّد المنصة: مستأجرو بوابة الشحن، خطة كل موقع واستهلاكه اليوم/30 يوماً مقابل حدّ الخطة، الخطط، وسجلّ التدقيق.
   كل الطلبات تمرّ بدالة ship-admin (تتحقق أنك مدير منصة وتحمل رمز الإدارة في الخادم)؛ لا أسرار هنا. */
window.SaasShipping = (() => {
  const $ = id => document.getElementById(id), C = () => window.SAAS_CFG || {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { sum: null, plans: [], audit: [], err: "", busy: false };
  let getToken = async () => null, root = null;
  const say = t => { const b = $("toasts"); if (!b) return alert(t); const d = document.createElement("div"); d.className = "toast"; d.textContent = t; b.appendChild(d); setTimeout(() => d.remove(), 7000); };
  async function api(method, path, body) {
    const t = await getToken(); if (!t) return { ok: false, j: { error: "unauthorized" } };
    try {
      const r = await fetch(C().URL + "/functions/v1/ship-admin", { method: "POST", headers: { Authorization: "Bearer " + t, apikey: C().KEY, "Content-Type": "application/json" }, body: JSON.stringify({ method, path, body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return { ok: false, j: { error: j.error || "http_" + r.status } };
      const d = j.data && j.data.error && typeof j.data.error === "object" ? { error: j.data.error.code, message: j.data.error.message } : (j.data || {});
      return { ok: j.status >= 200 && j.status < 300, j: d };
    } catch (e) { return { ok: false, j: { error: "network" } }; }
  }
  const ERR = { not_configured: "الخدمة غير مضبوطة بعد", unauthorized: "سجّل الدخول من جديد", network: "تعذّر الاتصال", path_not_allowed: "إجراء غير مسموح" };
  const bar = (n, max) => { const p = max > 0 ? Math.min(100, Math.round(n * 100 / max)) : 0; return '<div style="height:6px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:4px"><div style="height:100%;width:' + p + '%;background:' + (p >= 90 ? "#f87171" : p >= 70 ? "#fbbf24" : "#e2fe17") + '"></div></div>'; };
  async function load() {
    S.busy = true; draw();
    const [a, b, c] = await Promise.all([api("GET", "/admin/summary"), api("GET", "/admin/plans"), api("GET", "/admin/audit")]);
    S.busy = false;
    if (!a.ok) { S.err = ERR[a.j.error] || a.j.message || a.j.error || "تعذّر التحميل"; S.sum = null; } else { S.err = ""; S.sum = a.j.tenants || []; S.plans = (b.ok && b.j.plans) || []; S.audit = (c.ok && c.j.audit) || []; }
    draw();
  }
  function draw() {
    if (!root) return;
    if (S.busy && !S.sum) { root.innerHTML = '<div class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { root.innerHTML = '<div class="card"><b>الشحن</b><p class="hint" style="color:#f87171">' + esc(S.err) + '</p><button class="btn" data-sh="reload">إعادة المحاولة</button></div>'; return; }
    const pl = S.plans.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join("");
    const rows = (S.sum || []).map(t => '<tr><td><b>' + esc(t.name) + '</b><div class="hint">' + esc(t.email || "") + (t.site_ref ? " · موقع: " + esc(t.site_ref) : "") + '</div></td>' +
      '<td><select data-sh="plan" data-id="' + t.id + '">' + S.plans.map(p => '<option value="' + esc(p.id) + '"' + (p.id === t.plan ? " selected" : "") + '>' + esc(p.name) + '</option>').join("") + '</select></td>' +
      '<td>' + t.today + ' / ' + t.orders_day + bar(t.today, t.orders_day) + '</td><td>' + t.last30 + '</td><td>' + t.orders + '</td><td>' + t.connections + ' / ' + t.vault_max + '</td><td>' + t.keys + '</td>' +
      '<td>' + (t.status === "active" ? '<span class="pill active">نشط</span>' : '<span class="pill suspended">موقوف</span>') + '</td>' +
      '<td style="white-space:nowrap"><button class="btn" data-sh="toggle" data-id="' + t.id + '" data-to="' + (t.status === "active" ? "suspended" : "active") + '">' + (t.status === "active" ? "إيقاف" : "تفعيل") + '</button> <button class="btn" data-sh="key" data-id="' + t.id + '">مفتاح جديد</button></td></tr>').join("");
    const plans = S.plans.map(p => '<tr><td><b>' + esc(p.name) + '</b> <span class="hint">(' + esc(p.id) + ')</span></td>' +
      ["orders_hour", "orders_day", "track_min", "vault_max"].map(k => '<td><input type="number" min="0" style="width:90px" data-pl="' + esc(p.id) + '" data-k="' + k + '" value="' + (+p[k]) + '"></td>').join("") +
      '<td><input type="checkbox" data-pl="' + esc(p.id) + '" data-k="webhooks"' + (p.webhooks ? " checked" : "") + '></td><td><input type="number" min="0" style="width:90px" placeholder="دج/شهر" data-pl="' + esc(p.id) + '" data-k="price_dzd" value="' + (p.price_dzd == null ? "" : +p.price_dzd) + '"></td>' +
      '<td><button class="btn" data-sh="saveplan" data-id="' + esc(p.id) + '">حفظ</button></td></tr>').join("");
    const audit = S.audit.slice(0, 40).map(a => '<tr><td dir="ltr">' + esc(a.at) + '</td><td>' + esc(a.actor) + '</td><td>' + esc(a.action) + '</td><td>' + esc(a.target || "") + '</td><td class="hint" dir="ltr">' + esc(a.detail || "") + '</td></tr>').join("");
    root.innerHTML = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><b>🚚 بوابة الشحن — المستأجرون والاستهلاك</b><span><button class="btn" data-sh="reload">تحديث</button> <button class="btn" data-sh="new">＋ مستأجر</button></span></div>' +
      '<p class="hint">يظهر هنا كل موقع مرتبط بالبوابة، وخطته، وطلباته اليوم مقابل حدّ الخطة. الحدّ يوقف الطلبات الجديدة فقط بردّ 429 ولا يمسّ الطرود القائمة.</p>' +
      '<div style="overflow:auto"><table><thead><tr><th>الموقع</th><th>الخطة</th><th>اليوم / الحدّ</th><th>30 يوماً</th><th>الإجمالي</th><th>شركات محفوظة</th><th>مفاتيح</th><th>الحالة</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="hint">لا مستأجرين بعد</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><b>الخطط وحدودها</b><div style="overflow:auto"><table><thead><tr><th>الخطة</th><th>طلب/ساعة</th><th>طلب/يوم</th><th>تتبع/دقيقة</th><th>شركات محفوظة</th><th>Webhook</th><th>السعر</th><th></th></tr></thead><tbody>' + plans + '</tbody></table></div><p class="hint">تغيير الحدّ يسري فوراً على كل مستأجر في الخطة. السعر للعرض فقط (لا فوترة آلية بعد).</p></div>' +
      '<div class="card"><b>سجلّ التدقيق (آخر 40 إجراء إداري)</b><div style="overflow:auto"><table><thead><tr><th>الوقت (UTC)</th><th>الفاعل</th><th>الإجراء</th><th>الهدف</th><th>تفاصيل</th></tr></thead><tbody>' + (audit || '<tr><td colspan="5" class="hint">لا إجراءات</td></tr>') + '</tbody></table></div></div>';
  }
  async function onClick(e) {
    const b = e.target.closest("[data-sh]"); if (!b) return; const k = b.dataset.sh, id = b.dataset.id;
    if (k === "reload") return load();
    if (k === "toggle") { if (b.dataset.to === "suspended" && !confirm("إيقاف هذا المستأجر؟ ستفشل طلباته ومفاتيحه فوراً.")) return; const r = await api("PATCH", "/admin/tenants/" + id, { status: b.dataset.to }); say(r.ok ? "تم" : "فشل: " + (r.j.message || ERR[r.j.error] || r.j.error)); return load(); }
    if (k === "key") { if (!confirm("إصدار مفتاح جديد؟ يظهر مرة واحدة فقط.")) return; const r = await api("POST", "/admin/tenants/" + id + "/keys", { mode: "live", label: "provider" }); if (r.ok && r.j.key) { prompt("انسخ المفتاح الآن (لن يظهر ثانية):", r.j.key); } else say("فشل: " + (r.j.message || ERR[r.j.error] || r.j.error)); return load(); }
    if (k === "new") {
      const name = prompt("اسم المستأجر/الموقع:"); if (!name) return; const site = prompt("معرّف الموقع في المنصة (اختياري):", "") || null, plan = prompt("الخطة (" + S.plans.map(p => p.id).join(" | ") + "):", "free") || "free";
      const r = await api("POST", "/admin/tenants", { name, email: "", plan, site_ref: site }); say(r.ok ? "أُنشئ المستأجر" : "فشل: " + (r.j.message || ERR[r.j.error] || r.j.error)); return load();
    }
    if (k === "saveplan") {
      const g = key => root.querySelector('[data-pl="' + id + '"][data-k="' + key + '"]'), body = {};
      ["orders_hour", "orders_day", "track_min", "vault_max"].forEach(x => { body[x] = Math.max(0, Math.floor(+g(x).value) || 0); });
      body.webhooks = g("webhooks").checked; body.price_dzd = g("price_dzd").value === "" ? null : Math.max(0, Math.floor(+g("price_dzd").value) || 0);
      const r = await api("PUT", "/admin/plans/" + id, body); say(r.ok ? "حُفظت الخطة" : "فشل: " + (r.j.message || ERR[r.j.error] || r.j.error)); return load();
    }
  }
  async function onChange(e) {
    const s = e.target.closest('select[data-sh="plan"]'); if (!s) return;
    if (!confirm("تغيير خطة هذا المستأجر؟")) { return load(); }
    const r = await api("PATCH", "/admin/tenants/" + s.dataset.id, { plan: s.value }); say(r.ok ? "تم تغيير الخطة" : "فشل: " + (r.j.message || ERR[r.j.error] || r.j.error)); load();
  }
  return { mount(el, tokenFn) { root = el; getToken = tokenFn; el.onclick = onClick; el.onchange = onChange; load(); }, S };
})();
