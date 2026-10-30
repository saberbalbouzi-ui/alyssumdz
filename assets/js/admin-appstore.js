/* «متجر الإضافات»: تطبيقات إضافية من مطوّرين مستقلين تُثبَّت على متجرك بموافقتك الصريحة على كل صلاحية تطلبها.
   لا يصل أي تطبيق إلى المحفظة أو المفاتيح أو إعداداتك أبداً؛ وبيانات الزبائن (الأسماء والهواتف) مخفية عنه ما لم توافق عليها صراحةً.
   المدفوع يُخصم من متاحك في المحفظة؛ وإلغاء التثبيت يقطع وصول التطبيق فوراً. كل شيء يمرّ عبر وسيط مدير مسجَّل الدخول. */
const AdminAppStore = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { refundDays: 7, at: 0, apps: [], inst: [], pct: 20, avail: null, off: false, err: "", busy: false, form: null, link: null, timer: null };
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ERR = { not_refundable: "الاسترداد متاح خلال 7 أيام من الدفع ولمرة واحدة", refund_unavailable: "تعذّر الاسترداد الآلي — تواصل مع الدعم", not_installed: "قيّم تطبيقاً ثبّتَّه فقط", insufficient_funds: "رصيدك المتاح غير كافٍ — اشحن محفظتك أولاً", consent_mismatch: "يجب الموافقة على كل الصلاحيات المطلوبة", already_installed: "التطبيق مثبّت بالفعل", wallet_unavailable: "المحفظة غير مفعّلة على حسابك — تواصل مع الدعم", not_found: "التطبيق لم يعد متاحاً", rate_limited: "طلبات كثيرة، حاول بعد قليل", module_disabled: "المتجر غير مفعّل على حسابك — تواصل مع الدعم" };
  const ST = { active: ["مفعّل", "var(--g-mint-rgb)"], past_due: ["متأخر السداد", "var(--g-amber-rgb)"], suspended: ["موقوف", "var(--g-rose-rgb)"], uninstalled: ["أُلغي", "var(--g-blue-rgb)"] };
  const BL = { once: "دفعة واحدة", monthly: "شهرياً" };
  const dt = s => { const n = +s; return n ? new Date(n * 1000).toISOString().slice(0, 10) : ""; };
  async function call(method, path, body, idem) {
    try {
      if (typeof API === "undefined" || !API.sb || !API.sb.token) return { ok: false, off: true };
      const t = await API.sb.token(); if (!t) return { ok: false, st: 401 };
      const r = await fetch(API.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method, path, body, idempotencyKey: idem }) });
      if (r.status === 404) return { ok: false, off: true };
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) return { ok: false, st: r.status, j };
      return { ok: j.status >= 200 && j.status < 300, st: j.status, j: j.data || {} };
    } catch (e) { return { ok: false, st: 0 }; }
  }
  const errOf = r => (r && r.j && r.j.error && (r.j.error.fields ? Object.values(r.j.error.fields)[0] : (ERR[r.j.error.code] || r.j.error.message))) || (r && r.st === 401 ? "انتهت الجلسة، أعد تسجيل الدخول" : "تعذّر تنفيذ الطلب، حاول لاحقاً");
  async function load() {
    const [a, i, w] = await Promise.all([call("GET", "/v1/appstore/apps"), call("GET", "/v1/appstore/installations"), call("GET", "/v1/wallet")]);
    if (a.off) { S.off = true; return; } S.off = false; if (!a.ok) { S.err = errOf(a); return; } S.err = "";
    S.at = Date.now(); S.apps = a.j.apps || []; S.pct = a.j.commission_pct == null ? 20 : a.j.commission_pct; S.refundDays = a.j.refund_days || 7; if (i.ok) S.inst = i.j.installations || [];
    S.avail = w.ok && w.j.balances && w.j.balances.available ? (w.j.balances.available.DZD || 0) : null;
  }
  function css() {
    if ($("as-css")) return; const s = document.createElement("style"); s.id = "as-css";
    s.textContent = `#as-app{display:grid;gap:1rem;max-width:1100px;grid-template-columns:minmax(0,1fr)}#as-app>*{min-width:0}.as-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04)}.as-box h3{margin:0 0 .6rem;font-size:1.05rem}
.as-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:.8rem}.as-app{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));display:grid;gap:.45rem;align-content:start}.as-app b{font-size:1.05rem}.as-app .pr{font-size:1.3rem;font-weight:900}.as-app small{opacity:.8}
.as-sc{margin:0;padding:0;list-style:none;display:grid;gap:.25rem;font-size:.82rem}.as-sc li{padding:.3rem .5rem;border-radius:8px;background:rgba(255,255,255,.06)}.as-sc li.sens{background:rgba(var(--g-rose-rgb),.16);border:1px solid rgba(var(--g-rose-rgb),.5)}
.as-btn{padding:.55rem 1.1rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(var(--g-mint-d-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-mint-d-rgb),.45),rgba(var(--g-mint-d-rgb),.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.18);backdrop-filter:blur(6px);transition:transform .15s,filter .15s;text-decoration:none;display:inline-block}
.as-btn:hover{transform:translateY(-2px);filter:saturate(1.2)}.as-btn.g{border-color:rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06))}.as-btn.r{border-color:rgba(var(--g-rose-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-rose-rgb),.45),rgba(var(--g-rose-rgb),.16))}.as-btn[disabled]{opacity:.5;pointer-events:none}
.as-tbl{width:100%;border-collapse:collapse;font-size:.85rem}.as-tbl th,.as-tbl td{padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;vertical-align:top}.as-chip{display:inline-block;padding:.1rem .6rem;border-radius:99px;font-size:.75rem;font-weight:800;border:1px solid currentColor}
.as-wrap{overflow:auto}.as-hint{font-size:.8rem;opacity:.8;margin:.4rem 0 0}.as-off{padding:1.2rem;text-align:center;opacity:.85}.as-warn{padding:.6rem .8rem;border-radius:12px;background:rgba(var(--g-rose-rgb),.14);border:1px solid rgba(var(--g-rose-rgb),.5);font-size:.85rem}.as-ck{display:flex;gap:.5rem;align-items:flex-start;font-size:.85rem;margin:.4rem 0}`;
    document.head.appendChild(s);
  }
  const scopeList = (sc) => `<ul class="as-sc">${(sc || []).map(s => `<li class="${s.sensitive ? "sens" : ""}">${s.sensitive ? "⚠️ " : "• "}${esc(s.label)}</li>`).join("")}</ul>`;
  const priceOf = a => a.price > 0 ? `${nf(a.price)} دج${a.billing === "monthly" ? " / شهر" : ""}` : "مجاني";
  function draw() {
    const host = $("as-app"); if (!host) return;
    if (S.off) { host.innerHTML = '<div class="as-box as-off">متجر الإضافات غير مفعّل بعد على حسابك — تواصل مع الدعم لتفعيله.</div>'; return; }
    if (S.err) { host.innerHTML = `<div class="as-box as-off">${esc(S.err)} <button class="as-btn" data-as="reload">إعادة المحاولة</button></div>`; return; }
    const mine = new Map(S.inst.filter(i => i.status !== "uninstalled").map(i => [i.app_id, i]));
    const cards = S.apps.map(a => { const m = mine.get(a.id);
      const badges = (a.featured ? '<span class="as-chip" style="color:rgb(var(--g-amber-rgb))">⭐ مميّز</span> ' : "") + (a.domain_verified ? '<span class="as-chip" style="color:rgb(var(--g-mint-rgb))">✔ نطاق موثّق</span> ' : "") + (a.rating ? `<span class="as-chip" style="color:rgb(var(--g-amber-rgb))">★ ${esc(a.rating)} (${esc(a.rating_count)})</span>` : '<small>بلا تقييم بعد</small>');
      return `<div class="as-app"><b>${esc(a.name)}</b><div>${badges}</div><small>بواسطة ${esc(a.developer || "مطوّر مستقل")}</small>${a.description ? `<small>${esc(a.description)}</small>` : ""}<span class="pr">${esc(priceOf(a))}</span>${scopeList(a.scopes)}
 ${m ? `<span class="as-chip" style="color:rgb(var(--g-mint-rgb))">✓ مثبّت</span>` : `<button class="as-btn" data-as="pick" data-id="${a.id}" ${S.busy ? "disabled" : ""}>تثبيت</button>`}</div>`; }).join("");
    const f = S.form, ap = f && S.apps.find(x => x.id === f.id);
    const sens = ap ? ap.scopes.filter(s => s.sensitive) : [];
    const form = ap ? `<div class="as-box" id="as-form"><h3>تثبيت «${esc(ap.name)}»</h3><p class="as-hint" style="margin:0 0 .4rem">سيحصل التطبيق على الصلاحيات التالية فقط، ولن يصل أبداً إلى محفظتك أو مفاتيحك أو إعداداتك:</p>${scopeList(ap.scopes)}
 ${sens.length ? `<div class="as-warn" style="margin-top:.6rem">⚠️ هذا التطبيق يطلب الاطلاع على <b>أسماء زبائنك وأرقام هواتفهم</b>. وافق فقط إن كنت تثق بمطوّره.</div><label class="as-ck"><input type="checkbox" id="as-sens"> أفهم وأوافق على مشاركة بيانات الزبائن مع هذا التطبيق</label>` : ""}
 <p class="as-hint">${ap.price > 0 ? `سيُخصم <b>${nf(ap.price)} دج</b>${ap.billing === "monthly" ? " الآن ثم كل شهر" : " مرة واحدة"} من متاحك${S.avail != null ? ` (متاحك الآن ${nf(S.avail)} دج)` : ""}. تحتفظ المنصة بعمولة ${S.pct}% ويصل الباقي لمطوّر التطبيق.` : "التطبيق مجاني."}</p>
 <div><button class="as-btn" data-as="install" ${S.busy ? "disabled" : ""}>وافق وثبّت</button> <button class="as-btn g" data-as="cancel">إلغاء</button></div></div>` : "";
    const link = S.link ? `<div class="as-box" style="border-color:rgba(var(--g-mint-rgb),.6)"><h3>✅ ثُبّت «${esc(S.link.name)}»</h3><p class="as-hint" style="margin:0 0 .6rem">أكمل ربط التطبيق بمتجرك من صفحته (الرابط صالح 10 دقائق):</p><a class="as-btn" href="${esc(S.link.url)}" target="_blank" rel="noopener noreferrer">فتح التطبيق وإكمال الربط</a> <button class="as-btn g" data-as="dismiss">إغلاق</button></div>` : "";
    const rows = S.inst.map(i => { const st = ST[i.status] || [i.status, "inherit"];
      return `<tr><td><b>${esc(i.name)}</b><div class="as-hint">${i.price > 0 ? esc(nf(i.price) + " دج — " + (BL[i.billing] || "")) : "مجاني"}</div></td><td><span class="as-chip" style="color:rgb(${st[1]})">${esc(st[0])}</span>${i.next_charge_at && i.status !== "uninstalled" ? `<div class="as-hint">التجديد: ${esc(dt(i.next_charge_at))}</div>` : ""}</td><td>${esc((i.scopes || []).join("، "))}</td><td>${i.installed_at && i.status !== "pending" ? `<button class="as-btn g" data-as="rate" data-app="${i.app_id}" data-n="${esc(i.name)}">${i.reviewed ? "تعديل تقييمي" : "قيّم التطبيق"}</button> ` : ""}${i.refundable ? `<button class="as-btn r" data-as="refund" data-id="${i.id}" data-n="${esc(i.name)}">استرداد المبلغ</button> ` : ""}${["active", "past_due"].includes(i.status) ? `<button class="as-btn g" data-as="relink" data-id="${i.id}" data-n="${esc(i.name)}">إعادة الربط</button> <button class="as-btn r" data-as="remove" data-id="${i.id}" data-n="${esc(i.name)}">إلغاء التثبيت</button>` : ""}</td></tr>`; }).join("");
    host.innerHTML = `${link}<div class="as-box"><h3>التطبيقات المتاحة</h3>${S.avail != null ? `<p class="as-hint" style="margin:0 0 .6rem">متاحك في المحفظة: <b>${nf(S.avail)} دج</b></p>` : ""}${cards ? `<div class="as-grid">${cards}</div>` : '<p class="as-hint">لا توجد تطبيقات متاحة حالياً.</p>'}</div>${form}
<div class="as-box"><h3>تطبيقاتي</h3>${rows ? `<div class="as-wrap"><table class="as-tbl"><thead><tr><th>التطبيق</th><th>الحالة</th><th>الصلاحيات</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="as-hint">لم تثبّت أي تطبيق بعد.</p>'}<p class="as-hint">إلغاء التثبيت يقطع وصول التطبيق إلى متجرك فوراً، ويمكنك استرداد ثمن التطبيق خلال ${S.refundDays} أيام من الدفع. تتحقق الإدارة من كل تطبيق قبل ظهوره هنا.</p></div>`;
  }
  async function install() {
    const f = S.form, ap = f && S.apps.find(x => x.id === f.id); if (!ap) return;
    if (ap.scopes.some(s => s.sensitive) && !($("as-sens") || {}).checked) return toast("وافق على مشاركة بيانات الزبائن أولاً");
    if (ap.price > 0 && S.avail != null && S.avail < ap.price) return toast(ERR.insufficient_funds);
    if (!confirm(`تثبيت «${ap.name}»${ap.price > 0 ? ` مقابل ${nf(ap.price)} دج تُخصم من محفظتك` : ""}؟`)) return;
    S.busy = true; draw(); const r = await call("POST", `/v1/appstore/apps/${ap.id}/install`, { scopes: ap.scopes.map(s => s.id) }, f.key); S.busy = false;
    if (r.ok) { toast("✅ تم التثبيت"); S.form = null; S.link = r.j.redirect_to ? { name: ap.name, url: r.j.redirect_to } : null; } else toast(errOf(r));
    await refresh();
  }
  async function onClick(e) {
    const el = e.target.closest("[data-as]"); if (!el) return; const a = el.dataset.as;
    if (a === "reload") { S.err = ""; await refresh(); }
    else if (a === "pick") { S.form = { id: +el.dataset.id, key: uid() }; S.link = null; draw(); const x = $("as-form"); if (x && x.scrollIntoView) x.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (a === "cancel") { S.form = null; draw(); }
    else if (a === "dismiss") { S.link = null; draw(); }
    else if (a === "install") await install();
    else if (a === "relink") { S.busy = true; const r = await call("POST", `/v1/appstore/installations/${+el.dataset.id}/authorize`, {}); S.busy = false; if (r.ok && r.j.redirect_to) { S.link = { name: el.dataset.n, url: r.j.redirect_to }; draw(); } else toast(errOf(r)); }
    else if (a === "rate") { const v = prompt(`قيّم «${el.dataset.n}» من 1 إلى 5:`, "5"); if (v === null) return; const st = Math.round(+v); if (!(st >= 1 && st <= 5)) return toast("اكتب رقماً من 1 إلى 5"); const cm = prompt("تعليق (اختياري):", "") || ""; const r = await call("POST", `/v1/appstore/apps/${+el.dataset.app}/review`, { stars: st, comment: cm }); toast(r.ok ? "✓ شكراً لتقييمك" : errOf(r)); await refresh(); }
    else if (a === "refund") { if (!confirm(`استرداد ثمن «${el.dataset.n}» كاملاً وإلغاء تثبيته؟ (متاح خلال ${S.refundDays} أيام من الدفع ولمرة واحدة)`)) return; const r = await call("POST", `/v1/appstore/installations/${+el.dataset.id}/refund`, {}, uid()); toast(r.ok ? "✓ رُدّ المبلغ إلى متاحك" : errOf(r)); await refresh(); }
    else if (a === "remove") { if (!confirm(`إلغاء تثبيت «${el.dataset.n}»؟ سيفقد التطبيق وصوله إلى متجرك فوراً.`)) return; const r = await call("DELETE", `/v1/appstore/installations/${+el.dataset.id}`); toast(r.ok ? "تم إلغاء التثبيت" : errOf(r)); await refresh(); }
  }
  async function refresh() { await load(); draw(); }
  function bind() { const root = $("as-app"); if (!root || root._b) return; root._b = 1; root.addEventListener("click", onClick); }
  async function render() {
    css(); const host = $("appstore-content"); if (!host) return; if (!$("as-app")) host.innerHTML = '<div id="as-app"></div>'; bind(); draw();
    clearInterval(S.timer); S.timer = setInterval(() => { const t = $("tab-appstore"); if (t && !t.classList.contains("hidden") && !document.hidden && !S.busy && !S.form) refresh(); }, 90000);
    await refresh();
  }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._asWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-appstore"); if (el) el.classList.toggle("hidden", t !== "appstore"); if (t === "appstore") render(); else clearInterval(S.timer); return r; };
      Admin._asWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, refresh, S };
})();
