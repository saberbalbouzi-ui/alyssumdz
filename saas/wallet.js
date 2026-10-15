/* «المحفظة» داخل لوحة مزوّد المنصة: أرصدة المستأجرين، طلبات السحب (اعتماد/صرف/رفض)، تأكيد الإيداعات، الرسوم والاشتراكات، قيد إنفاق الإعلانات، وإعدادات المحفظة لكل مستأجر.
   كل الطلبات تمرّ بدالة platform-admin (تتحقق أنك مدير منصة وتحمل رمز الإدارة في الخادم)؛ لا أسرار هنا. كل إجراء مالي يطلب تأكيداً ويُسجَّل في سجلّ التدقيق باسمك. */
window.SaasWallet = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MINOR = { DZD: 1, USD: 100, EUR: 100 };
  const S = { sum: null, tenants: [], wd: [], st: "requested", sel: null, det: null, err: "", busy: false };
  let getToken = async () => null, root = null;
  const say = t => { const b = $("toasts"); if (!b) return alert(t); const d = document.createElement("div"); d.className = "toast"; d.textContent = t; b.appendChild(d); setTimeout(() => d.remove(), 7000); };
  const C = () => window.SAAS_CFG || {};
  async function api(method, path, body) {
    const t = await getToken(); if (!t) return { ok: false, j: { error: "unauthorized" } };
    try {
      const r = await fetch(C().URL + "/functions/v1/platform-admin", { method: "POST", headers: { Authorization: "Bearer " + t, apikey: C().KEY, "Content-Type": "application/json" }, body: JSON.stringify({ method, path, body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return { ok: false, j: { error: j.error || "http_" + r.status } };
      const d = j.data && j.data.error && typeof j.data.error === "object" ? { error: j.data.error.code, message: j.data.error.message } : (j.data || {});
      return { ok: j.status >= 200 && j.status < 300, j: d };
    } catch (e) { return { ok: false, j: { error: "network" } }; }
  }
  const ERR = { not_configured: "الخدمة غير مضبوطة بعد", unauthorized: "سجّل الدخول من جديد", network: "تعذّر الاتصال", path_not_allowed: "إجراء غير مسموح", upstream_failed: "تعذّر الوصول إلى المنصة" };
  const why = r => ERR[r.j.error] || r.j.message || r.j.error || "فشل";
  const money = (n, ccy) => { const m = MINOR[ccy] || 1; return (n / m).toLocaleString("en-US", { minimumFractionDigits: m > 1 ? 2 : 0, maximumFractionDigits: m > 1 ? 2 : 0 }) + " " + (ccy === "DZD" ? "دج" : ccy === "USD" ? "$" : ccy); };
  const bal = (b, code, ccy) => (b && b[code] && b[code][ccy]) || 0;
  const STL = { requested: "بانتظار المراجعة", approved: "معتمد", paid: "مصروف", rejected: "مرفوض", cancelled: "ملغى" };
  const MTH = { ccp: "بريد الجزائر CCP", baridimob: "بريدي موب", bank: "حوالة بنكية", redotpay: "RedotPay", paypal: "PayPal" };
  async function load() {
    S.busy = true; draw();
    const [a, b, c] = await Promise.all([api("GET", "/admin/wallet/summary"), api("GET", "/admin/wallet/tenants"), api("GET", "/admin/wallet/withdrawals/list?status=" + S.st)]);
    S.busy = false;
    if (!a.ok) { S.err = why(a); S.sum = null; } else { S.err = ""; S.sum = a.j; S.tenants = (b.ok && b.j.tenants) || []; S.wd = (c.ok && c.j.withdrawals) || []; }
    if (S.sel != null) { const d = await api("GET", "/admin/wallet/" + S.sel); S.det = d.ok ? d.j : null; }
    draw();
  }
  const nameOf = id => { const t = S.tenants.find(x => x.id === id); return t ? t.name : "#" + id; };
  function draw() {
    if (!root) return;
    if (S.busy && !S.sum) { root.innerHTML = '<div class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { root.innerHTML = '<div class="card"><b>المحفظة</b><p class="hint" style="color:#f87171">' + esc(S.err) + '</p><button class="btn" data-wl="reload">إعادة المحاولة</button></div>'; return; }
    const s = S.sum || {}, fees = (s.platform_fees || []).map(f => money(Math.abs(f.balance), f.currency)).join(" · ") || "—", owed = (s.owed_to_tenants || []).map(f => money(f.s, f.currency)).join(" · ") || "—";
    const head = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><b>💰 المحفظة — الدفتر والسحوبات</b><button class="btn" data-wl="reload">تحديث</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.6rem;margin-top:.6rem">' +
      '<div class="card" style="margin:0"><div class="hint">توازن الدفتر</div><b style="color:' + (s.balanced ? "#d4ff4d" : "#f87171") + '">' + (s.balanced ? "✓ متوازن" : "✗ غير متوازن — راجع فوراً") + '</b></div>' +
      '<div class="card" style="margin:0"><div class="hint">مستحق للتجار (متاح + ضمان + محجوز + إعلانات)</div><b>' + esc(owed) + '</b></div>' +
      '<div class="card" style="margin:0"><div class="hint">رسوم واشتراكات المنصة</div><b>' + esc(fees) + '</b></div>' +
      '<div class="card" style="margin:0"><div class="hint">سحوبات معلّقة</div><b>' + (+s.pending_withdrawals || 0) + '</b></div></div></div>';
    const trs = S.tenants.map(t => '<tr><td><b>' + esc(t.name) + '</b><div class="hint">#' + t.id + (t.site_ref ? " · " + esc(t.site_ref) : "") + '</div></td><td>' + money(bal(t.balances, "available", "DZD"), "DZD") + '</td><td>' + money(bal(t.balances, "escrow", "DZD"), "DZD") + '</td><td>' + money(bal(t.balances, "withdraw_hold", "DZD"), "DZD") + '</td><td>' + money(bal(t.balances, "ads_credit", "USD"), "USD") + '</td><td>' + (t.pending_withdrawals ? '<span class="pill requested">' + t.pending_withdrawals + '</span>' : "—") + '</td><td><button class="btn g" data-wl="open" data-id="' + t.id + '">إدارة</button></td></tr>').join("");
    const tenants = '<div class="card"><b>المستأجرون وأرصدتهم</b><div style="overflow:auto"><table><thead><tr><th>المستأجر</th><th>المتاح</th><th>الضمان</th><th>محجوز للسحب</th><th>إعلانات</th><th>سحوبات</th><th></th></tr></thead><tbody>' + (trs || '<tr><td colspan="7" class="hint">لا مستأجرين</td></tr>') + '</tbody></table></div></div>';
    const tabs = Object.keys(STL).filter(k => k !== "cancelled").map(k => '<button class="btn ' + (S.st === k ? "" : "g") + '" data-wl="st" data-st="' + k + '">' + STL[k] + '</button>').join(" ");
    const wrs = S.wd.map(w => '<tr><td>#' + w.id + '<div class="hint" dir="ltr">' + esc(new Date(w.created_at * 1000).toISOString().slice(0, 16).replace("T", " ")) + '</div></td><td><b>' + esc(nameOf(w.tenant_id)) + '</b></td><td>' + money(w.amount, w.currency) + '</td><td>' + esc(MTH[w.method] || w.method) + '</td><td dir="ltr" style="user-select:all">' + esc(w.destination || "—") + '</td><td><span class="pill ' + esc(w.status) + '">' + esc(STL[w.status] || w.status) + '</span>' + (w.note ? '<div class="hint">' + esc(w.note) + '</div>' : "") + '</td><td style="white-space:nowrap">' +
      (w.status === "requested" ? '<button class="btn g" data-wl="wd" data-act="approve" data-id="' + w.id + '">اعتماد</button> ' : "") +
      (w.status === "requested" || w.status === "approved" ? '<button class="btn" data-wl="wd" data-act="pay" data-id="' + w.id + '">تم الصرف</button> <button class="btn r" data-wl="wd" data-act="reject" data-id="' + w.id + '">رفض</button>' : "") + '</td></tr>').join("");
    const wd = '<div class="card"><b>طلبات السحب</b><div style="margin:.5rem 0">' + tabs + '</div><div style="overflow:auto"><table><thead><tr><th>الطلب</th><th>المستأجر</th><th>المبلغ</th><th>الوسيلة</th><th>الوجهة</th><th>الحالة</th><th></th></tr></thead><tbody>' + (wrs || '<tr><td colspan="7" class="hint">لا طلبات في هذه الحالة</td></tr>') + '</tbody></table></div><p class="hint">«تم الصرف» لا تضغطه إلا بعد أن تحوّل المبلغ فعلاً إلى الوجهة؛ يخرج المبلغ حينها من المحجوز نهائياً. الرفض يعيد المبلغ إلى متاح التاجر.</p></div>';
    root.innerHTML = head + tenants + wd + managePanel();
  }
  function managePanel() {
    if (S.sel == null) return "";
    const t = S.tenants.find(x => x.id === S.sel) || { name: "#" + S.sel }, w = (S.det && S.det.settings) || {};
    const f = (k, label, ph, extra) => '<label class="f">' + label + '<input data-wf="' + k + '" ' + (extra || "") + ' placeholder="' + ph + '"></label>';
    const set = (k, label) => '<label class="f">' + label + '<input type="number" step="any" data-ws="' + k + '" value="' + esc(w[k] == null ? "" : w[k]) + '"></label>';
    return '<div class="card" id="wl-manage"><div style="display:flex;justify-content:space-between;align-items:center"><b>إدارة محفظة: ' + esc(t.name) + '</b><button class="btn g" data-wl="close">إغلاق</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.8rem;margin-top:.6rem">' +
      '<div class="card" style="margin:0"><b>✅ تأكيد إيداع وصل فعلاً</b><p class="hint">بعد أن يصلك المبلغ (حوالة/RedotPay/PayPal). المرجع فريد: إعادة إدخال نفس المرجع لا تُقيَّد مرتين.</p>' + f("dep-amount", "المبلغ (دج)", "مثال 50000", 'type="number" min="1"') + f("dep-ref", "مرجع الحوالة", "BANK-001", 'dir="ltr"') + f("dep-memo", "ملاحظة", "اختياري") + '<button class="btn" data-wl="deposit">قيد الإيداع</button></div>' +
      '<div class="card" style="margin:0"><b>🧾 رسم أو اشتراك</b><p class="hint">يُخصم من متاح التاجر لصالح المنصة.</p>' + f("fee-amount", "المبلغ (دج)", "مثال 2000", 'type="number" min="1"') + f("fee-ref", "المرجع / رقم الفاتورة", "SUB-2026-10", 'dir="ltr"') + '<label class="f">النوع<select data-wf="fee-kind"><option value="subscription">اشتراك</option><option value="fee">رسم</option></select></label><button class="btn o" data-wl="fee">قيد الرسم</button></div>' +
      '<div class="card" style="margin:0"><b>📣 إنفاق إعلاني فعلي</b><p class="hint">بعد أن تنفق على Business Manager الرئيسي من رصيد التاجر بالدولار.</p>' + f("ad-usd", "المبلغ ($)", "مثال 25.50", 'type="number" step="0.01" min="0.01"') + f("ad-ref", "المرجع", "ADS-2026-10-01", 'dir="ltr"') + f("ad-memo", "ملاحظة", "اختياري") + '<button class="btn o" data-wl="adspend">قيد الإنفاق</button></div>' +
      '<div class="card" style="margin:0"><b>⚙ إعدادات المحفظة</b>' + set("fee_pct", "رسم المنصة عند تحرير الضمان (%)") + set("fee_fixed", "رسم ثابت لكل طلب (دج)") + set("usd_rate", "سعر الدولار للتاجر (دج، شامل هامشك)") + set("min_withdrawal", "أدنى مبلغ سحب (دج)") +
      '<label class="f" style="flex-direction:row;gap:.5rem;align-items:center"><input type="checkbox" data-ws="require_carrier"' + (w.require_carrier ? " checked" : "") + '> لا يُحرَّر الضمان إلا بتسليم مؤكَّد من بوابة الشحن</label><p class="hint">فعّل الخيار الأخير فقط للتاجر الذي تمرّ كل طلباته ببوابة الشحن؛ غير ذلك سيبقى الضمان محجوزاً.</p><button class="btn" data-wl="settings">حفظ الإعدادات</button></div></div></div>';
  }
  const val = k => { const e = root.querySelector('[data-wf="' + k + '"]'); return e ? e.value.trim() : ""; };
  const refOk = r => /^[A-Za-z0-9._:-]{3,80}$/.test(r);
  async function send(method, path, body, okMsg) { const r = await api(method, path, body); say(r.ok ? (r.j.duplicate ? "هذا المرجع مُسجَّل سابقاً — لم يتكرر القيد" : okMsg) : "فشل: " + why(r)); await load(); return r; }
  async function onClick(e) {
    const b = e.target.closest("[data-wl]"); if (!b) return; const k = b.dataset.wl;
    if (k === "reload") return load();
    if (k === "st") { S.st = b.dataset.st; return load(); }
    if (k === "open") { S.sel = +b.dataset.id; S.det = null; await load(); const m = $("wl-manage"); if (m) m.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (k === "close") { S.sel = null; S.det = null; return draw(); }
    if (k === "wd") {
      const id = b.dataset.id, act = b.dataset.act, w = S.wd.find(x => String(x.id) === id); if (!w) return;
      let note = ""; const lbl = { approve: "اعتماد", pay: "تأكيد الصرف", reject: "رفض" }[act];
      if (act === "reject") { note = prompt("سبب الرفض (يراه التاجر):", ""); if (note === null) return; }
      else if (!confirm(lbl + " — " + money(w.amount, w.currency) + " إلى " + (MTH[w.method] || w.method) + " (" + (w.destination || "") + ") للمستأجر «" + nameOf(w.tenant_id) + "»؟" + (act === "pay" ? "\nتأكد أنك حوّلت المبلغ فعلاً." : ""))) return;
      return send("POST", "/admin/wallet/withdrawals/" + id + "/" + act, { note }, "تم: " + lbl);
    }
    if (S.sel == null) return; const tid = S.sel;
    if (k === "deposit") {
      const amount = Math.round(+val("dep-amount")), ref = val("dep-ref"); if (!(amount >= 1)) return say("أدخل مبلغاً صحيحاً"); if (!refOk(ref)) return say("المرجع: 3–80 حرفاً لاتينياً/أرقاماً/. _ : -");
      if (!confirm("قيد إيداع " + money(amount, "DZD") + " في متاح «" + nameOf(tid) + "» بمرجع " + ref + "؟\nتأكد أن المبلغ وصلك فعلاً.")) return;
      return send("POST", "/admin/wallet/" + tid + "/deposit", { amount, ref, memo: val("dep-memo") }, "قُيّد الإيداع");
    }
    if (k === "fee") {
      const amount = Math.round(+val("fee-amount")), ref = val("fee-ref"), kind = val("fee-kind"); if (!(amount >= 1)) return say("أدخل مبلغاً صحيحاً"); if (!refOk(ref)) return say("المرجع: 3–80 حرفاً لاتينياً/أرقاماً/. _ : -");
      if (!confirm("خصم " + money(amount, "DZD") + " من متاح «" + nameOf(tid) + "» (" + (kind === "subscription" ? "اشتراك" : "رسم") + ")؟")) return;
      return send("POST", "/admin/wallet/" + tid + "/fee", { amount, ref, kind }, "قُيّد الرسم");
    }
    if (k === "adspend") {
      const usd = +val("ad-usd"), ref = val("ad-ref"); if (!(usd > 0)) return say("أدخل مبلغاً بالدولار"); if (!refOk(ref)) return say("المرجع: 3–80 حرفاً لاتينياً/أرقاماً/. _ : -");
      if (!confirm("قيد إنفاق " + usd.toFixed(2) + "$ من رصيد إعلانات «" + nameOf(tid) + "»؟")) return;
      return send("POST", "/admin/wallet/" + tid + "/ads-spend", { usd, ref, memo: val("ad-memo") }, "قُيّد الإنفاق");
    }
    if (k === "settings") {
      const body = {}; root.querySelectorAll("[data-ws]").forEach(i => { if (i.type === "checkbox") body[i.dataset.ws] = i.checked; else if (i.value !== "") body[i.dataset.ws] = +i.value; });
      if (!confirm("حفظ إعدادات محفظة «" + nameOf(tid) + "»؟ تسري على الطلبات القادمة.")) return;
      return send("PUT", "/admin/wallet/" + tid + "/settings", body, "حُفظت الإعدادات");
    }
  }
  return { mount(el, tokenFn) { root = el; getToken = tokenFn; el.onclick = onClick; load(); }, S, _t: { money } };
})();
