/* المحفظة: أرصدتك على المنصة (المتاح · المحجوز كضمان · قيد السحب · رصيد الإعلانات بالدولار)، الأموال المحجوزة لكل طلب، طلب سحب، شراء رصيد إعلانات، ودفتر الحركات.
   الأموال تُقيَّد في الخادم وحده (دفتر قيد مزدوج)؛ هنا عرض وطلبات فقط عبر وسيط مدير مسجَّل الدخول. وجهة السحب تُرسل مرة واحدة ولا تُخزَّن في المتصفح. */
const AdminWallet = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { deps: [], depMin: 500, chg: false, bal: null, set: {}, escrow: [], wds: [], led: [], next: null, off: false, err: "", busy: false, quote: null, timer: null };
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  const usd = c => ((+c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = ts => { try { return new Date(ts * 1000).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const ERR = { insufficient_funds: "الرصيد المتاح غير كافٍ", rate_not_set: "سعر الدولار لم تحدّده الإدارة بعد — تواصل مع الدعم", validation_error: "تحقق من الحقول المُدخلة", unavailable: "هذه الطريقة غير متاحة الآن", rate_limited: "طلبات كثيرة، أعد المحاولة بعد قليل", not_cancellable: "لا يمكن إلغاء الطلب بعد مراجعته", module_disabled: "المحفظة غير مفعّلة لحسابك", vault_unavailable: "الخدمة غير جاهزة، تواصل مع الدعم" };
  const KIND = { deposit: "إيداع", escrow_hold: "حجز ضمان", escrow_release: "تحرير ضمان", escrow_refund: "استرداد ضمان", withdrawal_request: "طلب سحب", withdrawal_paid: "صرف سحب", withdrawal_rejected: "رفض سحب", withdrawal_cancel: "إلغاء سحب", ads_topup: "شراء رصيد إعلانات", ads_spend: "إنفاق إعلاني", subscription: "اشتراك", platform_fee: "رسم المنصة", service_hold: "حجز خدمة تسويق (ضمان)", service_sale: "تسليم خدمة تسويق", service_refund: "استرداد خدمة تسويق" };
  const WST = { requested: ["قيد المراجعة", "var(--g-amber-rgb)"], approved: ["معتمد — بانتظار الصرف", "var(--g-blue-rgb)"], paid: ["تم الصرف", "var(--g-mint-rgb)"], rejected: ["مرفوض", "var(--g-rose-rgb)"], cancelled: ["ملغى", "var(--g-rose-rgb)"] };
  const DST = { pending: ["قيد المراجعة/الدفع", "var(--g-amber-rgb)"], approved: ["أُضيف لرصيدك", "var(--g-mint-rgb)"], rejected: ["مرفوض", "var(--g-rose-rgb)"], failed: ["لم يكتمل الدفع", "var(--g-rose-rgb)"] };
  const ccpInfo = () => { try { const c = typeof CONFIG !== "undefined" && CONFIG.PLATFORM_CCP; return c ? String(c) : ""; } catch (e) { return ""; } };
  /* ضغط صورة الإثبات في المتصفح (JPEG ≤ ~230KB) */
  function shrink(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = () => rej(new Error("read")); fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error("img")); im.onload = () => { let w = im.width, h = im.height, sc = Math.min(1, 1400 / Math.max(w, h)), q = .82; for (let i = 0; i < 8; i++) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc)); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); const u = c.toDataURL("image/jpeg", q); if (u.length <= 230000) return res(u); q = Math.max(.4, q - .1); sc *= .8; } rej(new Error("big")); }; im.src = fr.result; }; fr.readAsDataURL(file); }); }
  const METHODS = { ccp: "بريد الجزائر CCP", baridimob: "BaridiMob", bank: "تحويل بنكي", redotpay: "RedotPay", paypal: "PayPal" };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

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
    const [a, e, w, l, dp] = await Promise.all([call("GET", "/v1/wallet"), call("GET", "/v1/wallet/escrow"), call("GET", "/v1/wallet/withdrawals"), call("GET", "/v1/wallet/ledger", null, { limit: 20, ...(more && S.next ? { after: S.next } : {}) }), call("GET", "/v1/wallet/deposits")]);
    if (dp.ok) { S.deps = dp.j.deposits || []; S.depMin = dp.j.min || 500; S.chg = !!dp.j.chargily; }
    if (a.off) { S.off = true; return; } S.off = false;
    if (!a.ok) { S.err = errOf(a); return; } S.err = "";
    S.bal = a.j.balances; S.set = a.j.settings || {}; S.escrow = e.ok ? e.j.escrow || [] : []; S.wds = w.ok ? w.j.withdrawals || [] : [];
    if (l.ok) { S.led = more ? S.led.concat(l.j.entries || []) : l.j.entries || []; S.next = l.j.next || null; }
  }
  const b = (c, k) => ((S.bal || {})[c] || {})[k] || 0;

  function css() {
    if ($("wl-css")) return; const s = document.createElement("style"); s.id = "wl-css";
    s.textContent = `#wl-app{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;max-width:1100px}#wl-app>*{min-width:0}.wl-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:.8rem}.wl-card{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05)}
.wl-card small{display:block;opacity:.75}.wl-card b{display:block;font-size:1.5rem;margin-top:.2rem}.wl-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04)}.wl-box h3{margin:0 0 .6rem;font-size:1.05rem}
.wl-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:end}.wl-row label{display:grid;gap:.2rem;font-size:.82rem;opacity:.95}.wl-row input,.wl-row select{padding:.5rem .65rem;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:inherit;font:inherit;min-width:0}
.wl-btn{padding:.55rem 1.1rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(var(--g-mint-d-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-mint-d-rgb),.45),rgba(var(--g-mint-d-rgb),.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -3px 6px rgba(0,0,0,.22),0 3px 10px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s}
.wl-btn:hover{transform:translateY(-2px);filter:saturate(1.2)}.wl-btn.r{border-color:rgba(var(--g-rose-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-rose-rgb),.45),rgba(var(--g-rose-rgb),.16))}.wl-btn.o{border-color:rgba(var(--g-amber-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-amber-rgb),.45),rgba(var(--g-amber-rgb),.16))}.wl-btn[disabled]{opacity:.5;pointer-events:none}
.wl-tbl{width:100%;border-collapse:collapse;font-size:.85rem}.wl-tbl th,.wl-tbl td{padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:right}.wl-chip{display:inline-block;padding:.1rem .6rem;border-radius:99px;font-size:.75rem;border:1px solid rgba(var(--c),.6);background:rgba(var(--c),.18)}
.wl-pos{color:var(--g-ok,#e2fe17)}.wl-neg{color:var(--g-err,#f87171)}.wl-off{padding:1.2rem;text-align:center;opacity:.85}.wl-hint{font-size:.8rem;opacity:.8;margin:.4rem 0 0}.wl-sc{overflow:auto}`;
    document.head.appendChild(s);
  }
  const legTxt = e => (e.legs || []).filter(l => ["available", "escrow", "ads_credit", "withdraw_hold"].includes(l.account)).map(l => `<span class="${l.amount > 0 ? "wl-pos" : "wl-neg"}">${l.amount > 0 ? "+" : "−"}${l.currency === "USD" ? usd(Math.abs(l.amount)) + " $" : nf(Math.abs(l.amount)) + " دج"}</span> <small>${esc({ available: "متاح", escrow: "ضمان", ads_credit: "إعلانات", withdraw_hold: "محجوز للسحب" }[l.account])}</small>`).join(" · ");

  function draw() {
    const host = $("wl-app"); if (!host) return;
    if (S.off) { host.innerHTML = '<div class="wl-box wl-off">المحفظة غير مفعّلة بعد على حسابك — تواصل مع الدعم لتفعيلها.</div>'; return; }
    if (S.err) { host.innerHTML = `<div class="wl-box wl-off">${esc(S.err)} <button class="wl-btn" data-wl="reload">إعادة المحاولة</button></div>`; return; }
    if (!S.bal) { host.innerHTML = '<div class="wl-box wl-off">جارِ التحميل…</div>'; return; }
    const min = S.set.min_withdrawal || 1000, rate = S.set.usd_rate;
    host.innerHTML = `
<div class="wl-cards">
 <div class="wl-card"><small>المتاح للسحب أو الشراء</small><b>${nf(b("available", "DZD"))} دج</b></div>
 <div class="wl-card"><small>محجوز كضمان (طلبات لم تُسلَّم)</small><b>${nf(b("escrow", "DZD"))} دج</b></div>
 <div class="wl-card"><small>قيد السحب</small><b>${nf(b("withdraw_hold", "DZD"))} دج</b></div>
 <div class="wl-card"><small>رصيد الإعلانات</small><b>${usd(b("ads_credit", "USD"))} $</b></div>
</div>
<div class="wl-box"><h3>شحن الرصيد</h3>
 <div class="wl-row"><label>المبلغ (دج)<input id="wl-dam" type="number" min="${S.depMin}" step="100" placeholder="5000"></label>
 <label>طريقة الدفع<select id="wl-dme"><option value="ccp">حوالة CCP / بريدي موب (إثبات)</option>${S.chg ? '<option value="edahabia">بطاقة الذهبية (فوري)</option><option value="cib">بطاقة CIB (فوري)</option>' : ""}</select></label>
 <label id="wl-dpf-l">صورة الوصل<input id="wl-dpf" type="file" accept="image/*"></label><label>اسم المحوِّل (اختياري)<input id="wl-dpy" maxlength="60"></label>
 <button class="wl-btn" data-wl="dep" ${S.busy ? "disabled" : ""}>اشحن</button></div>
 <p class="wl-hint">${ccpInfo() ? "حوّل المبلغ إلى: <b dir=ltr>" + esc(ccpInfo()) + "</b> ثم ارفع صورة الوصل — يُضاف الرصيد بعد تحقق الإدارة. " : "للحوالة اطلب بيانات الحساب من الدعم ثم ارفع صورة الوصل — يُضاف الرصيد بعد تحقق الإدارة. "}${S.chg ? "الدفع بالبطاقة يُضاف فوراً بعد نجاحه." : ""} الرصيد يغطي عمولات الأفلييت وشراء الخدمات.</p>
 ${S.deps.length ? `<div class="wl-sc"><table class="wl-tbl"><thead><tr><th>#</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>${S.deps.slice(0, 8).map(d => { const t = DST[d.status] || [d.status, "var(--g-blue-rgb)"]; return `<tr><td>${d.id}</td><td>${nf(d.amount)} دج</td><td>${d.method === "ccp" ? "حوالة" : "بطاقة"}</td><td><span class="wl-chip" style="--c:${t[1]}">${esc(t[0])}</span>${d.note ? ` <small>${esc(d.note)}</small>` : ""}</td><td>${dt(d.created_at)}</td><td>${d.status === "pending" && d.checkout_url ? `<a class="wl-btn o" href="${esc(d.checkout_url)}" target="_blank" rel="noopener">أكمل الدفع</a>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : ""}</div>
<div class="wl-box"><h3>طلب سحب</h3>
 <div class="wl-row"><label>المبلغ (دج)<input id="wl-amt" type="number" min="${min}" step="100" placeholder="${min}"></label>
 <label>وسيلة الاستلام<select id="wl-met">${Object.entries(METHODS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
 <label style="flex:1;min-width:200px">رقم الحساب / المحفظة<input id="wl-dst" autocomplete="off" placeholder="مثال: 0012345678 مفتاح 12"></label>
 <button class="wl-btn" data-wl="wd" ${S.busy ? "disabled" : ""}>اطلب السحب</button></div>
 <p class="wl-hint">الحد الأدنى ${nf(min)} دج. يُحجز المبلغ فور الطلب ويُصرف بعد مراجعة الإدارة، ويمكنك إلغاء الطلب قبل المراجعة.</p></div>
<div class="wl-box"><h3>رصيد الإعلانات بالدولار</h3>
 ${rate ? `<div class="wl-row"><label>المبلغ بالدولار<input id="wl-usd" type="number" min="1" max="5000" step="1" placeholder="50"></label><span id="wl-q" class="wl-hint">${S.quote ? `${S.quote.usd} $ = <b>${nf(S.quote.dzd)} دج</b> (السعر ${esc(S.quote.rate)})` : `السعر الحالي ${esc(rate)} دج للدولار`}</span>
 <button class="wl-btn" data-wl="quote">احسب</button><button class="wl-btn o" data-wl="topup" ${S.busy ? "disabled" : ""}>اشترِ الرصيد من المتاح</button></div>` : '<p class="wl-hint">شراء الدولار غير مفعّل حتى تحدّد الإدارة سعر الصرف — تواصل مع الدعم.</p>'}</div>
${S.escrow.length ? `<div class="wl-box"><h3>أموال محجوزة لطلبات قيد التسليم (${S.escrow.length})</h3><div class="wl-sc"><table class="wl-tbl"><thead><tr><th>الطلب</th><th>المبلغ</th><th>التاريخ</th></tr></thead><tbody>${S.escrow.map(x => `<tr><td>${esc(x.order_id)}</td><td>${nf(x.amount)} دج</td><td>${dt(x.created_at)}</td></tr>`).join("")}</tbody></table></div><p class="wl-hint">تُحرَّر للمتاح عند تسليم الطلب، ويُخصم رسم المنصة${S.set.fee_pct || S.set.fee_fixed ? ` (${esc(S.set.fee_pct || 0)}%${S.set.fee_fixed ? " + " + nf(S.set.fee_fixed) + " دج" : ""})` : ""} إن وُجد.</p></div>` : ""}
${S.wds.length ? `<div class="wl-box"><h3>طلبات السحب</h3><div class="wl-sc"><table class="wl-tbl"><thead><tr><th>#</th><th>المبلغ</th><th>الوسيلة</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>${S.wds.map(w => { const s = WST[w.status] || [w.status, "var(--g-blue-rgb)"]; return `<tr><td>${w.id}</td><td>${nf(w.amount)} دج</td><td>${esc(METHODS[w.method] || w.method)}</td><td><span class="wl-chip" style="--c:${s[1]}">${esc(s[0])}</span>${w.note ? ` <small>${esc(w.note)}</small>` : ""}</td><td>${dt(w.created_at)}</td><td>${w.status === "requested" ? `<button class="wl-btn r" data-wl="cancel" data-id="${w.id}">إلغاء</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div></div>` : ""}
<div class="wl-box"><h3>دفتر الحركات</h3>${S.led.length ? `<div class="wl-sc"><table class="wl-tbl"><thead><tr><th>التاريخ</th><th>العملية</th><th>الأثر</th><th>ملاحظة</th></tr></thead><tbody>${S.led.map(e => `<tr><td>${dt(e.created_at)}</td><td>${esc(KIND[e.kind] || e.kind)}${e.order_id ? ` <small>#${esc(e.order_id)}</small>` : ""}</td><td>${legTxt(e)}</td><td><small>${esc(e.memo)}</small></td></tr>`).join("")}</tbody></table></div>${S.next ? '<p><button class="wl-btn" data-wl="more">عرض المزيد</button></p>' : ""}` : '<p class="wl-hint">لا حركات بعد.</p>'}</div>`;
  }

  async function onClick(e) {
    const el = e.target.closest("[data-wl]"); if (!el) return; const a = el.dataset.wl;
    if (a === "reload") { S.err = ""; await refresh(); }
    else if (a === "more") { await load(true); draw(); }
    else if (a === "quote") { const v = +($("wl-usd") || {}).value; if (!(v >= 1)) { toast("اكتب المبلغ بالدولار (1 فأكثر)"); return; } const r = await call("GET", "/v1/wallet/ads-quote", null, { usd: v }); if (r.ok) { S.quote = r.j; draw(); const i = $("wl-usd"); if (i) i.value = v; } else toast(errOf(r)); }
    else if (a === "topup") {
      const v = +($("wl-usd") || {}).value; if (!(v >= 1)) { toast("اكتب المبلغ بالدولار (1 فأكثر)"); return; }
      const q = await call("GET", "/v1/wallet/ads-quote", null, { usd: v }); if (!q.ok) { toast(errOf(q)); return; }
      if (!confirm(`شراء ${q.j.usd} $ مقابل ${nf(q.j.dzd)} دج تُخصم من رصيدك المتاح؟`)) return;
      S.busy = true; draw(); const r = await call("POST", "/v1/wallet/ads-topup", { usd: v }, null, uid()); S.busy = false;
      if (r.ok) { toast("✅ أُضيف رصيد الإعلانات"); S.quote = null; } else toast(errOf(r)); await refresh();
    }
    else if (a === "dep") {
      const amount = Math.round(+($("wl-dam") || {}).value), me = ($("wl-dme") || {}).value, f = ($("wl-dpf") || {}).files && $("wl-dpf").files[0], payer = (($("wl-dpy") || {}).value || "").trim();
      if (!(amount >= S.depMin)) { toast("الحد الأدنى للشحن " + nf(S.depMin) + " دج"); return; }
      let body = { amount };
      if (me === "ccp") { if (!f) { toast("ارفع صورة الوصل"); return; } try { body.proof = await shrink(f); } catch (x) { toast("تعذّر قراءة الصورة، جرّب صورة أخرى"); return; } body.method = "ccp"; if (payer) body.payer = payer; }
      else { body.method = "chargily"; body.payment_method = me; body.return_url = location.origin + location.pathname; }
      S.busy = true; draw(); const r = await call("POST", "/v1/wallet/deposits", body, null, uid()); S.busy = false;
      if (!r.ok) { toast(errOf(r)); await refresh(); return; }
      if (r.j.checkout_url) { toast("جارٍ تحويلك لصفحة الدفع…"); location.href = r.j.checkout_url; return; }
      toast("✅ أُرسل الوصل — يُضاف الرصيد بعد تحقق الإدارة"); await refresh();
    }
    else if (a === "wd") {
      const amount = Math.round(+($("wl-amt") || {}).value), method = ($("wl-met") || {}).value, destination = (($("wl-dst") || {}).value || "").trim(), min = S.set.min_withdrawal || 1000;
      if (!(amount >= min)) { toast("الحد الأدنى للسحب " + nf(min) + " دج"); return; } if (destination.length < 4) { toast("اكتب رقم الحساب أو المحفظة"); return; }
      if (amount > b("available", "DZD")) { toast("المبلغ أكبر من رصيدك المتاح"); return; }
      if (!confirm(`طلب سحب ${nf(amount)} دج عبر ${METHODS[method]} إلى:\n${destination}\nهل البيانات صحيحة؟`)) return;
      S.busy = true; draw(); const r = await call("POST", "/v1/wallet/withdrawals", { amount, method, destination }, null, uid()); S.busy = false;
      if (r.ok) toast("✅ أُرسل طلب السحب للمراجعة"); else toast(errOf(r)); await refresh();
    }
    else if (a === "cancel") { if (!confirm("إلغاء طلب السحب وإعادة المبلغ للمتاح؟")) return; const r = await call("DELETE", "/v1/wallet/withdrawals/" + el.dataset.id); toast(r.ok ? "تم الإلغاء" : errOf(r)); await refresh(); }
  }
  async function refresh() { await load(false); draw(); }
  function bind() { const root = $("wl-app"); if (!root || root._b) return; root._b = 1; root.addEventListener("click", onClick); root.addEventListener("change", e => { if (e.target && e.target.id === "wl-dme") { const l = $("wl-dpf-l"), y = e.target.value === "ccp"; if (l) l.style.display = y ? "" : "none"; } }); }
  async function render() {
    css(); const host = $("wallet-content"); if (!host) return; if (!$("wl-app")) host.innerHTML = '<div id="wl-app"></div>'; bind(); draw();
    clearInterval(S.timer); S.timer = setInterval(() => { const t = $("tab-wallet"); if (t && !t.classList.contains("hidden") && !document.hidden && !S.busy && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#wl-app"))) refresh(); }, 60000);
    await refresh();
  }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._wlWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-wallet"); if (el) el.classList.toggle("hidden", t !== "wallet"); if (t === "wallet") render(); else clearInterval(S.timer); return r; };
      Admin._wlWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, refresh, S, _t: { nf, usd } };
})();
