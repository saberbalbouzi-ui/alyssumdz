/* «المنتجات الرقمية»: حسابات/مفاتيح/ملفات/اشتراكات تُسلَّم تلقائياً بعد تأكيد الدفع، بلا توصيل.
   (1) طرق الدفع المسبق: BaridiMob / CCP / بطاقة. (2) مخزن المفاتيح لكل منتج رقمي. (3) إثباتات الدفع بانتظار موافقتك. (4) الطلبات الرقمية وتسليمها.
   يعمل عبر وسيط مدير مسجَّل الدخول؛ المفاتيح مشفّرة عند المنصة ولا تظهر في أي قائمة. المنتج يُعدّ رقمياً بخانة «منتج رقمي» في نافذة تعديله. */
const AdminDigital = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAYP = "assets/data/pay-methods.json", PAYL = "alyssum_pay_methods";
  const S = { keys: [], assets: [], proofs: [], orders: [], pay: null, sha: null, err: "", off: false, busy: false, open: null, shown: {}, timer: null, lowAt: 3 };
  const nf = n => Math.round(+n || 0).toLocaleString("fr-DZ");
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const dt = s => { const n = +s; return n ? new Date(n * 1000).toISOString().slice(0, 16).replace("T", " ") : ""; };
  const ERR = { not_paid: "الطلب غير مدفوع بعد", already_paid: "هذا الطلب مدفوع سابقاً", bad_transition: "الحالة الحالية لا تسمح بهذا الإجراء", order_not_found: "الطلب غير معروف للمنصة", module_disabled: "الخدمة غير مفعّلة على حسابك — تواصل مع الدعم", vault_unavailable: "تخزين الأسرار غير مفعّل — تواصل مع الدعم", rate_limited: "طلبات كثيرة، حاول بعد قليل", plan_limit: "بلغت الحدّ الأقصى للمفاتيح" };
  const ST = { awaiting: ["بانتظار الدفع", "var(--g-amber-rgb)"], short: ["نفد المخزون", "var(--g-rose-rgb)"], ready: ["جاهز للإرسال", "var(--g-blue-rgb)"], delivered: ["مُسلَّم", "var(--g-mint-rgb)"] };
  const MT = { baridimob: "BaridiMob", ccp: "CCP" };
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
  /* ───── طرق الدفع (ملف عام يقرؤه المتجر) ───── */
  const dec = raw => JSON.parse(decodeURIComponent(escape(atob(String(raw || "").replace(/\s/g, "")))));
  const enc = v => btoa(unescape(encodeURIComponent(JSON.stringify(v, null, 2))));
  const canRemote = () => (typeof PHPAPI !== "undefined" && PHPAPI.on && PHPAPI.on()) || (typeof GH !== "undefined" && GH.cfg && GH.cfg() && GH.cfg().token);
  const normPay = p => { p = p && typeof p === "object" ? p : {}; const b = p.baridimob || {}, c = p.ccp || {}, g = p.chargily || {};
    return { baridimob: { on: !!b.on, rip: String(b.rip || "").replace(/[^0-9\s]/g, "").trim().slice(0, 30), name: String(b.name || "").slice(0, 60) }, ccp: { on: !!c.on, account: String(c.account || "").replace(/[^0-9\s]/g, "").trim().slice(0, 20), key: String(c.key || "").replace(/[^0-9]/g, "").slice(0, 4), name: String(c.name || "").slice(0, 60) }, chargily: { on: !!g.on } }; };
  async function loadPay() {
    let remote = null; try { const r = await fetch(PAYP + "?t=" + Date.now(), { cache: "no-store" }); if (r.ok) remote = await r.json(); } catch (e) { }
    if (canRemote() && typeof GH !== "undefined") { try { const f = await GH.getFile(PAYP); S.sha = f.sha; remote = dec(f.content); } catch (e) { } }
    let loc = null; try { loc = JSON.parse(localStorage.getItem(PAYL) || "null"); } catch (e) { }
    S.pay = normPay(loc && (!remote || String(loc.updatedAt || "") > String(remote.updatedAt || "")) ? loc : remote); S.pay.updatedAt = (loc || remote || {}).updatedAt;
  }
  async function savePay() {
    const g = id => ($(id) || {}), b = { baridimob: { on: g("dg-b-on").checked, rip: g("dg-b-rip").value, name: g("dg-b-name").value }, ccp: { on: g("dg-c-on").checked, account: g("dg-c-acc").value, key: g("dg-c-key").value, name: g("dg-c-name").value }, chargily: { on: g("dg-g-on").checked } };
    const c = normPay(b); if (c.baridimob.on && !c.baridimob.rip) return toast("أدخل الـRIP الخاص بـBaridiMob"); if (c.ccp.on && !c.ccp.account) return toast("أدخل رقم حساب CCP");
    c.updatedAt = new Date().toISOString(); S.pay = c; try { localStorage.setItem(PAYL, JSON.stringify(c)); } catch (e) { }
    if (!canRemote()) { toast("💾 حُفظت محلياً — اربط النشر لتظهر لزبائنك"); return draw(); }
    try { if (!S.sha) { try { S.sha = (await GH.getFile(PAYP)).sha; } catch (e) { S.sha = undefined; } }
      const r = await GH.putFile(PAYP, enc(c), S.sha, "طرق الدفع الرقمي"); S.sha = (r && r.content && r.content.sha) || S.sha; toast("✅ حُفظت طرق الدفع ونُشرت"); }
    catch (e) { toast("⚠️ تعذّر النشر: " + (e.message || "")); }
    draw();
  }
  /* ───── البيانات ───── */
  const digitalProducts = () => ((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && p.digital);
  const panelOrder = ref => ((typeof Admin !== "undefined" && Admin.orders) || []).find(o => o && String((o.extra && o.extra["🔗 مرجع"]) || o.id) === String(ref));
  async function load() {
    const [k, a, pr, o] = await Promise.all([call("GET", "/v1/digital/keys"), call("GET", "/v1/digital/assets"), call("GET", "/v1/payments/manual", null, { state: "pending" }), call("GET", "/v1/digital/orders", null, { limit: 100 })]);
    if (k.off) { S.off = true; return; } S.off = false; if (!k.ok) { S.err = errOf(k); return; } S.err = "";
    S.keys = k.j.skus || []; if (a.ok) S.assets = a.j.assets || []; if (pr.ok) S.proofs = pr.j.proofs || []; if (o.ok) S.orders = o.j.orders || [];
    if (!S.pay) await loadPay();
  }
  function css() {
    if ($("dg-css")) return; const s = document.createElement("style"); s.id = "dg-css";
    s.textContent = `#dg-app{display:grid;gap:1rem;max-width:1100px;grid-template-columns:minmax(0,1fr)}#dg-app>*{min-width:0}.dgx-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04)}.dgx-box h3{margin:0 0 .6rem;font-size:1.05rem}
.dgx-btn{padding:.5rem 1rem;border-radius:12px;font:inherit;font-weight:800;color:#fff;cursor:pointer;border:1px solid rgba(var(--g-mint-d-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-mint-d-rgb),.45),rgba(var(--g-mint-d-rgb),.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.18);backdrop-filter:blur(6px);transition:transform .15s,filter .15s}.dgx-btn:hover{transform:translateY(-2px);filter:saturate(1.2)}
.dgx-btn.g{border-color:rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06))}.dgx-btn.r{border-color:rgba(var(--g-rose-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-rose-rgb),.45),rgba(var(--g-rose-rgb),.16))}.dgx-btn.o{border-color:rgba(var(--g-amber-rgb),.6);background:linear-gradient(180deg,rgba(var(--g-amber-rgb),.45),rgba(var(--g-amber-rgb),.16))}.dgx-btn.sm{padding:.3rem .7rem;font-size:.8rem}.dgx-btn[disabled]{opacity:.5;pointer-events:none}
.dgx-tbl{width:100%;border-collapse:collapse;font-size:.85rem}.dgx-tbl th,.dgx-tbl td{padding:.45rem .5rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:right;vertical-align:top}.dgx-chip{display:inline-block;padding:.1rem .6rem;border-radius:99px;font-size:.75rem;font-weight:800;border:1px solid currentColor}.dgx-wrap{overflow:auto}.dgx-hint{font-size:.8rem;opacity:.8;margin:.4rem 0 0}
.dgx-fm{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:.7rem}.dgx-fm label.fl{display:grid;gap:.25rem;font-size:.82rem}.dgx-fm input,.dgx-fm textarea{padding:.5rem;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font:inherit;width:100%;box-sizing:border-box}.dgx-ck{display:flex;gap:.5rem;align-items:center;font-size:.9rem;font-weight:700}
.dgx-pf{display:grid;gap:.4rem;padding:.8rem;border:1px solid rgba(255,255,255,.14);border-radius:14px;margin:.5rem 0}.dgx-pf img{max-width:min(320px,100%);border-radius:10px;border:1px solid rgba(255,255,255,.2)}.dgx-off{padding:1.2rem;text-align:center;opacity:.85}.dgx-low{color:rgb(var(--g-rose-rgb));font-weight:800}`;
    document.head.appendChild(s);
  }
  const chip = (m, k) => { const x = m[k] || [k, "inherit"]; return `<span class="dgx-chip" style="color:rgb(${x[1]})">${esc(x[0])}</span>`; };
  /* ───── الرسم ───── */
  function payHtml() {
    const p = S.pay || normPay(null);
    return `<div class="dgx-box"><h3>1) طرق الدفع التي يراها زبونك</h3><div class="dgx-fm">
<div><label class="dgx-ck"><input type="checkbox" id="dg-b-on" ${p.baridimob.on ? "checked" : ""}> BaridiMob</label><label class="fl">رقم RIP<input id="dg-b-rip" dir="ltr" inputmode="numeric" value="${esc(p.baridimob.rip)}" placeholder="00799999…"></label><label class="fl">اسم صاحب الحساب<input id="dg-b-name" value="${esc(p.baridimob.name)}"></label></div>
<div><label class="dgx-ck"><input type="checkbox" id="dg-c-on" ${p.ccp.on ? "checked" : ""}> CCP (بريد الجزائر)</label><label class="fl">رقم الحساب<input id="dg-c-acc" dir="ltr" inputmode="numeric" value="${esc(p.ccp.account)}"></label><label class="fl">المفتاح (clé)<input id="dg-c-key" dir="ltr" inputmode="numeric" value="${esc(p.ccp.key)}" maxlength="4"></label><label class="fl">اسم صاحب الحساب<input id="dg-c-name" value="${esc(p.ccp.name)}"></label></div>
<div><label class="dgx-ck"><input type="checkbox" id="dg-g-on" ${p.chargily.on ? "checked" : ""}> بطاقة الذهبية / CIB</label><p class="dgx-hint">يتطلب تفعيل الدفع الإلكتروني لحسابك عند الدعم؛ يصل المنتج تلقائياً فور الدفع، بلا مراجعة منك، ويمرّ المبلغ بمحفظتك.</p></div></div>
<div style="margin-top:.7rem"><button class="dgx-btn" data-dg="paysave">حفظ طرق الدفع</button></div></div>`;
  }
  function stockHtml() {
    const kmap = new Map(S.keys.map(x => [x.sku, x])), amap = new Map(S.assets.map(x => [x.sku, x])), prods = digitalProducts();
    const known = new Set(prods.map(p => p.slug)), extra = S.keys.filter(x => !known.has(x.sku)).map(x => ({ slug: x.sku, title: x.sku }));
    const rows = prods.concat(extra).map(p => { const k = kmap.get(p.slug) || { available: 0, sold: 0 }, a = amap.get(p.slug), low = k.available <= S.lowAt && (k.available + k.sold) > 0;
      return `<tr><td><b>${esc(p.title)}</b><div class="dgx-hint" dir="ltr">${esc(p.slug)}</div></td><td class="${low ? "dgx-low" : ""}">${k.available}${low ? " ⚠️" : ""}</td><td>${k.sold}</td><td>${a ? '<span class="dgx-chip" style="color:rgb(var(--g-mint-rgb))">ملف مربوط</span>' : '<span class="dgx-hint">—</span>'}</td>
<td><button class="dgx-btn sm" data-dg="addkeys" data-sku="${esc(p.slug)}">＋ مفاتيح</button> <button class="dgx-btn g sm" data-dg="file" data-sku="${esc(p.slug)}" data-n="${esc(p.title)}">رابط ملف</button> ${k.available ? `<button class="dgx-btn r sm" data-dg="delkeys" data-sku="${esc(p.slug)}">حذف المتاح</button>` : ""}</td></tr>`; }).join("");
    const form = S.open ? `<div class="dgx-box" id="dg-keyform" style="margin-top:.8rem"><b>إضافة مفاتيح/حسابات إلى «${esc(S.open)}»</b><p class="dgx-hint">سطر لكل مفتاح (مثل <span dir="ltr">user:pass</span> أو <span dir="ltr">XXXX-YYYY-ZZZZ</span>). المكرر يُتجاهل، والمخزون مشفّر ولا يظهر بعد الحفظ.</p><textarea id="dg-keys" rows="6" dir="ltr" style="width:100%;box-sizing:border-box;padding:.5rem;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit"></textarea><div style="margin-top:.5rem"><button class="dgx-btn" data-dg="keysave">حفظ المفاتيح</button> <button class="dgx-btn g" data-dg="cancel">إلغاء</button></div></div>` : "";
    return `<div class="dgx-box"><h3>2) مخزون المنتجات الرقمية</h3>${rows ? `<div class="dgx-wrap"><table class="dgx-tbl"><thead><tr><th>المنتج</th><th>متاح</th><th>مباع</th><th>ملف</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="dgx-hint">لا منتجات رقمية بعد. افتح تعديل أي منتج وفعّل خانة «منتج رقمي».</p>'}${form}</div>`;
  }
  function proofsHtml() {
    const aw = S.orders.filter(o => o.state === "awaiting");
    const pf = S.proofs.map(x => `<div class="dgx-pf" data-id="${x.id}"><div><b dir="ltr">${esc(x.order_id)}</b> — ${esc(MT[x.method] || x.method)} — <b>${nf(x.amount)} دج</b> ${x.payer ? "· " + esc(x.payer) : ""} <span class="dgx-hint">${esc(dt(x.created_at))}</span></div>
${S.shown[x.id] ? `<img alt="إثبات الدفع" src="${esc(S.shown[x.id])}">` : (x.has_proof ? `<div><button class="dgx-btn g sm" data-dg="showproof" data-id="${x.id}">عرض لقطة التحويل</button></div>` : "")}
<div><button class="dgx-btn sm" data-dg="approve" data-id="${x.id}" data-a="${x.amount}">✅ وصلني المبلغ — أرسل المنتج</button> <button class="dgx-btn r sm" data-dg="reject" data-id="${x.id}">رفض</button></div></div>`).join("");
    const aws = aw.filter(o => !S.proofs.some(x => x.order_id === o.order_ref)).map(o => `<tr><td dir="ltr">${esc(o.order_ref)}</td><td>${esc(o.name)}</td><td>${esc(o.items.map(i => i.title || i.sku).join("، "))}</td><td>${esc(dt(o.created_at))}</td><td><button class="dgx-btn o sm" data-dg="approveorder" data-ref="${esc(o.order_ref)}">استلمت المبلغ (بلا صورة)</button></td></tr>`).join("");
    return `<div class="dgx-box"><h3>3) دفعات بانتظار موافقتك ${S.proofs.length ? `<span class="dgx-chip" style="color:rgb(var(--g-amber-rgb))">${S.proofs.length}</span>` : ""}</h3><p class="dgx-hint">تحقق من وصول المبلغ في تطبيق BaridiMob أو حساب CCP قبل الموافقة؛ الموافقة تُسلّم المنتج فوراً ولا رجعة فيها.</p>${pf || '<p class="dgx-hint">لا إثباتات معلّقة.</p>'}
${aws ? `<h4 style="margin:.8rem 0 .3rem">طلبات رقمية لم يصلها إثبات</h4><div class="dgx-wrap"><table class="dgx-tbl"><thead><tr><th>الطلب</th><th>الزبون</th><th>المنتج</th><th>التاريخ</th><th></th></tr></thead><tbody>${aws}</tbody></table></div>` : ""}</div>`;
  }
  function ordersHtml() {
    const rows = S.orders.filter(o => o.state !== "awaiting").slice(0, 60).map(o => { const act = o.state === "ready" ? `<button class="dgx-btn sm" data-dg="wa" data-ref="${esc(o.order_ref)}">📲 إرسال عبر واتساب</button> <button class="dgx-btn g sm" data-dg="sent" data-ref="${esc(o.order_ref)}">تم الإرسال</button>` : o.state === "short" ? `<button class="dgx-btn o sm" data-dg="redeliver" data-ref="${esc(o.order_ref)}">إعادة المحاولة</button>` : "";
      return `<tr><td dir="ltr">${esc(o.order_ref)}</td><td>${esc(o.name)}</td><td>${esc(o.items.map(i => (i.title || i.sku) + (i.qty > 1 ? " ×" + i.qty : "")).join("، "))}</td><td>${chip(ST, o.state)}${o.state === "short" ? `<div class="dgx-hint dgx-low">نفد: ${esc(o.detail || "")}</div>` : ""}${o.state === "ready" && !o.has_email ? '<div class="dgx-hint">لا بريد للزبون</div>' : ""}</td><td>${esc(dt(o.delivered_at || o.created_at))}</td><td>${act}</td></tr>`; }).join("");
    return `<div class="dgx-box"><h3>4) الطلبات الرقمية</h3>${rows ? `<div class="dgx-wrap"><table class="dgx-tbl"><thead><tr><th>الطلب</th><th>الزبون</th><th>المنتج</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="dgx-hint">لا طلبات مدفوعة بعد.</p>'}</div>`;
  }
  function draw() {
    const host = $("dg-app"); if (!host) return;
    if (S.off) { host.innerHTML = '<div class="dgx-box dgx-off">المنتجات الرقمية غير مفعّلة بعد على حسابك — تواصل مع الدعم لتفعيلها.</div>'; return; }
    if (S.err) { host.innerHTML = `<div class="dgx-box dgx-off">${esc(S.err)} <button class="dgx-btn" data-dg="reload">إعادة المحاولة</button></div>`; return; }
    host.innerHTML = proofsHtml() + stockHtml() + ordersHtml() + payHtml();
  }
  /* ───── الإجراءات ───── */
  function markPanelDelivered(ref) { try { const o = panelOrder(ref); if (o && typeof Admin !== "undefined" && (o.status === "nouvelle" || o.status === "confirmee")) { const i = Admin.orders.indexOf(o); if (i >= 0) Admin.changeStatus(i, "livree"); } } catch (e) { } }
  async function waSend(ref) {
    const r = await call("GET", "/v1/digital/orders/" + encodeURIComponent(ref)); if (!r.ok) return toast(errOf(r));
    const po = panelOrder(ref), ph = String((po && po.phone) || "").replace(/\D/g, "").replace(/^0/, "213"), keys = (r.j.keys || []).map(k => k.values.join("\n")).join("\n\n");
    const msg = "مرحباً " + ((po && po.name) || "") + "،\nشكراً لشرائك ✅\nهذه بيانات طلبك:\n\n" + keys + "\n\nاحتفظ بها في مكان آمن.";
    if (!ph) { try { await navigator.clipboard.writeText(msg); toast("نُسخ نص الرسالة — لصقه في واتساب (لم يُعثر على هاتف الزبون)"); } catch (e) { prompt("انسخ الرسالة:", msg); } return; }
    window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    toast("بعد إرسالها اضغط «تم الإرسال» ليُعدّ الطلب مُسلَّماً");
  }
  async function onClick(e) {
    const el = e.target.closest("[data-dg]"); if (!el) return; const a = el.dataset.dg, id = el.dataset.id, ref = el.dataset.ref, sku = el.dataset.sku; let r;
    if (a === "reload") { S.err = ""; return refresh(); }
    if (a === "paysave") return savePay();
    if (a === "addkeys") { S.open = sku; draw(); const x = $("dg-keys"); if (x) { x.focus(); x.scrollIntoView({ block: "center" }); } return; }
    if (a === "cancel") { S.open = null; return draw(); }
    if (a === "keysave") { const t = ($("dg-keys") || {}).value || ""; if (!t.trim()) return toast("ألصق المفاتيح أولاً"); el.disabled = true; r = await call("POST", "/v1/digital/keys", { sku: S.open, text: t });
      if (r.ok) { toast(`✅ أُضيف ${r.j.added} مفتاح${r.j.duplicates ? " (تجاهلنا " + r.j.duplicates + " مكرراً)" : ""}${r.j.delivered_waiting ? " · سُلّم " + r.j.delivered_waiting + " طلب كان ينتظر" : ""}`); S.open = null; await refresh(); } else { el.disabled = false; toast(errOf(r)); } return; }
    if (a === "delkeys") { if (!confirm("حذف كل المفاتيح المتاحة (غير المباعة) لهذا المنتج؟ لا يمكن التراجع.")) return; r = await call("DELETE", "/v1/digital/keys/" + encodeURIComponent(sku)); toast(r.ok ? "حُذف " + r.j.removed + " مفتاح" : errOf(r)); return refresh(); }
    if (a === "file") { const u = prompt("رابط ملف التنزيل لـ«" + el.dataset.n + "» (https). سيصل الزبون رابطاً مؤقتاً محدود المرات:", ""); if (!u) return; r = await call("POST", "/v1/digital/assets", { sku, name: el.dataset.n, location: u.trim() }); toast(r.ok ? "✅ رُبط الملف" : errOf(r)); return refresh(); }
    if (a === "showproof") { r = await call("GET", `/v1/payments/manual/${id}/proof`); if (r.ok && r.j.proof) { S.shown[id] = r.j.proof; draw(); } else toast(errOf(r)); return; }
    if (a === "approve") { if (!confirm(`تأكد أن ${nf(el.dataset.a)} دج وصلتك فعلاً. الموافقة تسلّم المنتج فوراً.`)) return; el.disabled = true; r = await call("POST", `/v1/payments/manual/${id}/approve`, {}); if (r.ok) { toast("✅ تمت الموافقة — يُسلَّم المنتج الآن"); markPanelDelivered(S.proofs.find(x => String(x.id) === id)?.order_id); } else { el.disabled = false; toast(errOf(r)); } return refresh(); }
    if (a === "reject") { const n = prompt("سبب الرفض (لك فقط):", "لم يصل المبلغ"); if (n === null) return; r = await call("POST", `/v1/payments/manual/${id}/reject`, { note: n }); toast(r.ok ? "رُفض الإثبات" : errOf(r)); return refresh(); }
    if (a === "approveorder") { if (!confirm("هل وصلك مبلغ هذا الطلب فعلاً؟ الموافقة تسلّم المنتج فوراً.")) return; r = await call("POST", `/v1/payments/manual/orders/${encodeURIComponent(ref)}/approve`, {}); if (r.ok) { toast("✅ تمت الموافقة"); markPanelDelivered(ref); } else toast(errOf(r)); return refresh(); }
    if (a === "wa") return waSend(ref);
    if (a === "sent") { r = await call("POST", `/v1/digital/orders/${encodeURIComponent(ref)}/sent`, {}); if (r.ok) { toast("✅ عُدّ الطلب مُسلَّماً"); markPanelDelivered(ref); } else toast(errOf(r)); return refresh(); }
    if (a === "redeliver") { r = await call("POST", `/v1/digital/orders/${encodeURIComponent(ref)}/deliver`, {}); toast(r.ok ? (r.j.state === "short" ? "المخزون ما زال لا يكفي — أضف مفاتيح" : "✅ سُلِّم الطلب") : errOf(r)); return refresh(); }
  }
  async function refresh() { await load(); draw(); }
  function bind() { const root = $("dg-app"); if (!root || root._b) return; root._b = 1; root.addEventListener("click", onClick); }
  async function render() {
    css(); const host = $("digital-content"); if (!host) return; if (!$("dg-app")) host.innerHTML = '<div id="dg-app"></div>'; bind(); draw();
    clearInterval(S.timer); S.timer = setInterval(() => { const t = $("tab-digital"); if (t && !t.classList.contains("hidden") && !document.hidden && !S.open) refresh(); }, 45000);
    await refresh();
  }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._dgWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-digital"); if (el) el.classList.toggle("hidden", t !== "digital"); if (t === "digital") render(); else clearInterval(S.timer); return r; };
      Admin._dgWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, refresh, S, _t: { normPay } };
})();
