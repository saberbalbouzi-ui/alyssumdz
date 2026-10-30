/* «التسويق بالعمولة» داخل لوحة المزوّد: (1) مراجعة حوالات CCP (عرض الإثبات ثم اعتماد يقيّد المبلغ في متاح التاجر، أو رفض)،
   (2) اعتماد/رفض/إيقاف منتجات الموردين، (3) حسم نزاعات المرتجع (طلب ادّعى المورّد إرجاعه بلا ناقل موثوق)، (4) رسم المنصة من العمولة والاعتماد التلقائي.
   كل الطلبات عبر دالة platform-admin (تتحقق أنك مدير منصة)؛ لا أسرار هنا. كل نص قادم من الخادم يُهرَّب. */
window.SaasMarket = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { dep: [], prod: [], disp: [], sel: [], ss: "pending", cfg: {}, ps: "pending", err: "", busy: false, proof: null, issued: null };
  let getToken = async () => null, root = null;
  const say = t => { const b = $("toasts"); if (!b) return alert(t); const d = document.createElement("div"); d.className = "toast"; d.textContent = t; b.appendChild(d); setTimeout(() => d.remove(), 7000); };
  const C = () => window.SAAS_CFG || {};
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  const dt = s => new Date(s * 1000).toISOString().slice(0, 16).replace("T", " ");
  async function api(method, path, body) {
    const t = await getToken(); if (!t) return { ok: false, j: { error: "unauthorized" } };
    try {
      const r = await fetch(C().URL + "/functions/v1/platform-admin", { method: "POST", headers: { Authorization: "Bearer " + t, apikey: C().KEY, "Content-Type": "application/json" }, body: JSON.stringify({ method, path, body }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) return { ok: false, j: { error: j.error || "http_" + r.status } };
      const d = j.data && j.data.error && typeof j.data.error === "object" ? { error: j.data.error.code, message: j.data.error.message } : (j.data || {});
      return { ok: j.status >= 200 && j.status < 300, j: d };
    } catch (e) { return { ok: false, j: { error: "network" } }; }
  }
  const why = r => ({ unauthorized: "سجّل الدخول من جديد", network: "تعذّر الاتصال", path_not_allowed: "إجراء غير مسموح", bad_state: "الحالة الحالية لا تسمح بذلك" }[r.j.error] || r.j.message || r.j.error || "فشل");
  const PS = { pending: "بانتظار المراجعة", active: "معروض", paused: "موقوف من المورّد", rejected: "مرفوض", suspended: "موقوف من الإدارة" };
  async function load() {
    S.busy = true; draw();
    const [d, p, o, c, sl] = await Promise.all([api("GET", "/admin/wallet/deposits/list?status=pending"), api("GET", "/admin/marketplace/products?status=" + S.ps), api("GET", "/admin/marketplace/orders?state=return_claimed"), api("GET", "/admin/marketplace/settings"), api("GET", "/admin/marketplace/sellers?status=" + S.ss)]);
    S.busy = false; if (!d.ok && !p.ok) { S.err = why(d); draw(); return; } S.err = "";
    S.dep = (d.ok && d.j.deposits) || []; S.prod = (p.ok && p.j.products) || []; S.disp = (o.ok && o.j.orders) || []; S.cfg = (c.ok && c.j) || {}; S.sel = (sl.ok && sl.j.sellers) || []; draw();
  }
  function draw() {
    if (!root) return;
    if (S.busy && !S.dep.length && !S.prod.length) { root.innerHTML = '<div class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { root.innerHTML = '<div class="card"><b>التسويق بالعمولة</b><p class="hint" style="color:#f87171">' + esc(S.err) + '</p><button class="btn" data-mk="reload">إعادة المحاولة</button></div>'; return; }
    const ccp = S.dep.filter(d => d.method === "ccp");
    const dep = '<div class="card"><b>🏦 حوالات CCP بانتظار التحقق (' + ccp.length + ')</b><p class="hint">تحقّق من وصول المبلغ فعلاً إلى حسابك ثم اعتمد؛ الاعتماد يقيّد المبلغ في متاح التاجر ولا يتكرر.</p>' + (ccp.length ? '<div style="overflow:auto"><table><thead><tr><th>#</th><th>التاجر</th><th>المبلغ</th><th>المحوِّل</th><th>التاريخ</th><th></th></tr></thead><tbody>' + ccp.map(d => '<tr><td>' + d.id + '</td><td>#' + d.tenant_id + '</td><td><b>' + nf(d.amount) + ' دج</b></td><td>' + esc(d.payer) + '</td><td dir="ltr">' + esc(dt(d.created_at)) + '</td><td><button class="btn g" data-mk="proof" data-id="' + d.id + '">عرض الوصل</button> <button class="btn" data-mk="dap" data-id="' + d.id + '" data-a="' + d.amount + '">اعتماد</button> <button class="btn r" data-mk="drj" data-id="' + d.id + '">رفض</button></td></tr>').join("") + '</tbody></table></div>' : '<p class="hint">لا حوالات معلّقة.</p>') + (S.proof ? '<div style="margin-top:.6rem"><img alt="" src="' + esc(S.proof) + '" style="max-width:100%;max-height:420px;border-radius:12px;border:1px solid rgba(255,255,255,.2)"></div>' : '') + '</div>';
    const tabs = Object.keys(PS).map(k => '<button class="btn ' + (S.ps === k ? "" : "g") + '" data-mk="ps" data-s="' + k + '">' + PS[k] + '</button>').join(" ");
    const prods = '<div class="card"><b>📦 منتجات الموردين</b><div style="margin:.5rem 0">' + tabs + '</div>' + (S.prod.length ? '<div style="overflow:auto"><table><thead><tr><th>المنتج</th><th>المورّد</th><th>سعره</th><th>العمولة</th><th>المقترح</th><th>المخزون</th><th></th></tr></thead><tbody>' + S.prod.map(p => '<tr><td>' + (p.image ? '<img alt="" src="' + esc(p.image) + '" style="width:38px;height:38px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-inline-end:.4rem">' : '') + '<b>' + esc(p.title) + '</b><div class="hint">' + esc(p.slug) + (p.note ? ' · ' + esc(p.note) : '') + '</div></td><td>' + esc(p.supplier) + ' <small>#' + p.tenant_id + '</small></td><td>' + nf(p.supplier_price) + '</td><td>' + nf(p.commission) + '</td><td>' + nf(p.rrp) + '</td><td>' + (p.stock == null ? '∞' : nf(p.stock)) + '</td><td>' + (["pending", "rejected", "suspended"].includes(p.status) ? '<button class="btn" data-mk="pm" data-a="approve" data-id="' + p.id + '">اعتماد</button> ' : '') + (["pending", "active", "paused"].includes(p.status) ? '<button class="btn r" data-mk="pm" data-a="reject" data-id="' + p.id + '">رفض</button> ' : '') + (["active", "paused"].includes(p.status) ? '<button class="btn o" data-mk="pm" data-a="suspend" data-id="' + p.id + '">إيقاف</button>' : '') + '</td></tr>').join("") + '</tbody></table></div>' : '<p class="hint">لا منتجات في هذه الحالة.</p>') + '</div>';
    const disp = '<div class="card"><b>⚖️ نزاعات المرتجع (' + S.disp.length + ')</b><p class="hint">المورّد ادّعى أن الطرد رجع إليه بلا تأكيد ناقل موثوق: العمولة محجوزة. «مرتجع» تعيدها للمورّد، «سُلِّم» تحرّرها للأفلييت (بعد رسم المنصة). تحقّق من حالة الطرد عند شركة الشحن أولاً.</p>' + (S.disp.length ? '<div style="overflow:auto"><table><thead><tr><th>الطلب</th><th>المنتج</th><th>المورّد</th><th>الأفلييت</th><th>العمولة</th><th></th></tr></thead><tbody>' + S.disp.map(o => '<tr><td>' + esc(o.mko) + '<div class="hint">' + esc(o.ref) + ' · ' + esc(dt(o.updated_at)) + '</div></td><td>' + esc(o.title) + ' ×' + nf(o.qty) + '</td><td>#' + o.supplier_id + '</td><td>#' + o.affiliate_id + '</td><td>' + nf(o.commission) + ' دج</td><td><button class="btn" data-mk="rs" data-o="returned" data-id="' + o.id + '">مرتجع</button> <button class="btn g" data-mk="rs" data-o="delivered" data-id="' + o.id + '">سُلِّم</button></td></tr>').join("") + '</tbody></table></div>' : '<p class="hint">لا نزاعات.</p>') + '</div>';

    const SS = { pending: "بانتظار المراجعة", approved: "معتمدون", suspended: "موقوفون", rejected: "مرفوضون" }, KD = { wholesale: "جملة", retail: "تجزئة" };
    const stabs = Object.keys(SS).map(k => '<button class="btn ' + (S.ss === k ? "" : "g") + '" data-mk="ss" data-s="' + k + '">' + SS[k] + '</button>').join(" ");
    const issued = S.issued ? '<div class="card" style="border:1px solid #fbbf24"><b>🔑 مفتاح المورّد «' + esc(S.issued.name) + '» — يظهر مرة واحدة فقط</b><p dir="ltr" style="user-select:all;font-family:monospace;word-break:break-all">' + esc(S.issued.key) + '</p><button class="btn" data-mk="cpkey">نسخ</button> ' + (S.issued.wa ? '<a class="btn g" target="_blank" rel="noopener" href="' + esc(S.issued.wa) + '">إرسال بواتساب</a> ' : '') + '<button class="btn o" data-mk="hidekey">أخفِ (لن يظهر ثانية)</button></div>' : '';
    const sel = issued + '<div class="card"><b>🧾 المورّدون والبائعون</b><p class="hint">كل طلب انضمام يُراجع يدوياً. الاعتماد ينشئ للمورّد حساباً ومفتاحاً يُعرض مرة واحدة فترسله له بواتساب. «جملة» تتطلب سجلاً تجارياً.</p><div style="margin:.5rem 0">' + stabs + '</div>' + (S.sel.length ? '<div style="overflow:auto"><table><thead><tr><th>البائع</th><th>النوع</th><th>التواصل</th><th>الولاية</th><th>سجل تجاري</th><th>أداء</th><th></th></tr></thead><tbody>' + S.sel.map(x => '<tr><td><b>' + esc(x.name) + '</b>' + (x.tenant_id ? ' <small>#' + x.tenant_id + '</small>' : '') + '<div class="hint">' + esc(x.about) + (x.note ? ' · ' + esc(x.note) : '') + '</div></td><td>' + (KD[x.kind] || esc(x.kind)) + '</td><td dir="ltr">' + esc(x.phone) + '<div class="hint">' + esc(x.contact) + '</div></td><td>' + esc(x.wilaya) + '</td><td dir="ltr">' + esc(x.reg_no || "—") + '</td><td>' + nf(x.products) + ' منتج · ' + nf(x.delivered) + ' سُلِّم · ' + nf(x.returned) + ' مرتجع</td><td>' + (x.status === "pending" || x.status === "suspended" || x.status === "rejected" ? '<button class="btn" data-mk="sa" data-a="approve" data-id="' + x.id + '">' + (x.status === "suspended" ? "إعادة تفعيل" : "اعتماد") + '</button> ' : '') + (x.status === "pending" ? '<button class="btn r" data-mk="sa" data-a="reject" data-id="' + x.id + '">رفض</button> ' : '') + (x.status === "approved" ? '<button class="btn g" data-mk="sa" data-a="rekey" data-id="' + x.id + '">مفتاح جديد</button> <button class="btn o" data-mk="sa" data-a="suspend" data-id="' + x.id + '">إيقاف</button> ' : '') + (x.tenant_id ? '<button class="btn g" data-mk="sk" data-t="' + x.tenant_id + '" data-k="' + (x.kind === "wholesale" ? "retail" : "wholesale") + '">→ ' + (x.kind === "wholesale" ? "تجزئة" : "جملة") + '</button>' : '') + '</td></tr>').join("") + '</tbody></table></div>' : '<p class="hint">لا طلبات في هذه الحالة.</p>') + '</div>';
    const cfg = '<div class="card"><b>⚙ إعدادات السوق</b><div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin-top:.5rem"><label class="f">رسم المنصة من العمولة المحرَّرة (%)<input id="mk-fee" type="number" min="0" max="50" step="0.5" value="' + esc(S.cfg.fee_pct == null ? "" : S.cfg.fee_pct) + '"></label><label class="f" style="flex-direction:row;gap:.5rem;align-items:center"><input id="mk-auto" type="checkbox"' + (S.cfg.auto_approve ? " checked" : "") + '> اعتماد المنتجات تلقائياً بلا مراجعة</label><button class="btn" data-mk="cfg">حفظ</button></div></div>';
    root.innerHTML = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>🤝 التسويق بالعمولة (دروبشيبينغ بالعمولة)</b><button class="btn" data-mk="reload">تحديث</button></div></div>' + sel + dep + disp + prods + cfg;
  }
  async function act(method, path, body, ok) { const r = await api(method, path, body); say(r.ok ? ok : "فشل: " + why(r)); await load(); }
  async function onClick(e) {
    const b = e.target.closest("[data-mk]"); if (!b) return; const k = b.dataset.mk, id = b.dataset.id;
    if (k === "reload") return load();
    if (k === "ss") { S.ss = b.dataset.s; return load(); }
    if (k === "cpkey") { try { await navigator.clipboard.writeText(S.issued.key); say("نُسخ المفتاح"); } catch { say("انسخه يدوياً"); } return; }
    if (k === "hidekey") { S.issued = null; return draw(); }
    if (k === "sk") { if (!confirm("تغيير نوع البائع؟")) return; return act("PUT", "/admin/marketplace/tenants/" + b.dataset.t + "/kind", { kind: b.dataset.k }, "تم تغيير النوع"); }
    if (k === "sa") {
      const a = b.dataset.a, x = S.sel.find(z => String(z.id) === String(id)) || {};
      if (a === "reject" || a === "suspend") { const note = prompt("السبب (يُحفظ في السجل):", ""); if (note === null) return; return act("POST", "/admin/marketplace/sellers/" + id + "/" + a, { note }, "تم"); }
      if (a === "rekey" && !confirm("سيُبطل المفتاح القديم فوراً. متابعة؟")) return;
      if (a === "approve" && !confirm("اعتماد «" + (x.name || "") + "» (" + (x.kind === "wholesale" ? "جملة" : "تجزئة") + ")؟" + (x.kind === "wholesale" ? "\nتأكد من السجل التجاري: " + (x.reg_no || "—") : ""))) return;
      const r = await api("POST", "/admin/marketplace/sellers/" + id + "/" + a, a === "approve" && /^https:/.test(location.origin) ? { origin: location.origin } : {});
      if (!r.ok) { say("فشل: " + why(r)); return load(); }
      if (r.j.key) { const ph = String(x.phone || "").replace(/\D/g, "").replace(/^0/, "213"); S.issued = { name: x.name, key: r.j.key, wa: ph ? "https://wa.me/" + ph + "?text=" + encodeURIComponent("مرحباً " + x.name + "، تم اعتماد حسابك كمورّد. بوابتك: " + location.origin + "/saas/supplier.html\nمفتاح الدخول (لا تشاركه): " + r.j.key) : "" }; }
      say(r.j.key ? "اعتُمد — انسخ المفتاح الآن" : "تم"); return load();
    }
    if (k === "ps") { S.ps = b.dataset.s; return load(); }
    if (k === "proof") { const r = await api("GET", "/admin/wallet/deposits/" + id + "/proof"); if (!r.ok || !/^data:image\//.test(r.j.proof || "")) return say("تعذّر عرض الصورة"); S.proof = r.j.proof; return draw(); }
    if (k === "dap") { if (!confirm("اعتماد إيداع " + nf(b.dataset.a) + " دج؟\nتأكد أن المبلغ وصل إلى حسابك فعلاً؛ سيُقيَّد في متاح التاجر.")) return; S.proof = null; return act("POST", "/admin/wallet/deposits/" + id + "/approve", {}, "قُيّد الإيداع في رصيد التاجر"); }
    if (k === "drj") { const note = prompt("سبب الرفض (يراه التاجر):", ""); if (note === null) return; S.proof = null; return act("POST", "/admin/wallet/deposits/" + id + "/reject", { note }, "رُفض الإيداع"); }
    if (k === "pm") { const a = b.dataset.a; let note = ""; if (a !== "approve") { note = prompt("السبب (يراه المورّد):", ""); if (note === null) return; } return act("POST", "/admin/marketplace/products/" + id + "/" + a, { note }, "تم"); }
    if (k === "rs") { const o = b.dataset.o; if (!confirm(o === "returned" ? "تأكيد أن الطرد رجع إلى المورّد؟ تعود العمولة إليه." : "تأكيد أن الطلب سُلِّم؟ تُحرَّر العمولة للأفلييت.")) return; return act("POST", "/admin/marketplace/orders/" + id + "/resolve", { outcome: o }, "حُسم النزاع"); }
    if (k === "cfg") { const fee = +($("mk-fee") || {}).value; if (!(fee >= 0 && fee <= 50)) return say("الرسم بين 0 و50"); return act("PUT", "/admin/marketplace/settings", { fee_pct: fee, auto_approve: !!($("mk-auto") || {}).checked }, "حُفظت الإعدادات"); }
  }
  return { mount(el, tokenFn) { root = el; getToken = tokenFn; el.onclick = onClick; load(); }, S };
})();
