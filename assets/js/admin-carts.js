/* السلال المتروكة: زبائن كتبوا رقمهم ولم يُكملوا الطلب. زر أعلى صفحة الطلبات يفتح قائمة بأرقامهم ومنتجاتهم
   مع اتصال/واتساب وتعليم الحالة. تصير «مستردّة» تلقائياً حين يكتمل طلب بنفس الرقم. */
const AdminCarts = (() => {
  const $ = id => document.getElementById(id), S = { list: [], st: "open", n: 0, off: false, busy: false };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => (typeof Admin !== "undefined" && Admin.fmt ? Admin.fmt(n) : Math.round(n).toLocaleString("ar") + " دج");
  async function call(method, path, body, query) {
    try {
      if (typeof API === "undefined" || !API.sb || !API.sb.token) return { ok: false, st: 0 };
      const t = await API.sb.token(); if (!t) return { ok: false, st: 401 };
      const r = await fetch(API.sb.url("/functions/v1/platform-proxy"), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify({ method, path, body, query }) });
      if (r.status === 404) { S.off = true; return { ok: false, st: 404 }; }
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) return { ok: false, st: r.status, j };
      return { ok: j.status >= 200 && j.status < 300, st: j.status, j: j.data || {} };
    } catch (e) { return { ok: false, st: 0 }; }
  }
  const css = () => {
    if ($("acr-css")) return; const st = document.createElement("style"); st.id = "acr-css";
    st.textContent = `.acr-bg{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:12px}
.acr-mod{width:min(760px,100%);max-height:90vh;overflow:auto;padding:1.1rem;border-radius:16px;background:rgba(9,24,18,.985);border:1px solid rgba(255,255,255,.14);color:#fff}
.acr-mod h3{margin:0 0 .4rem}.acr-tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin:.5rem 0}.acr-tabs button{padding:.35rem .8rem;border-radius:10px;font:inherit;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);cursor:pointer}
.acr-tabs button.on{background:linear-gradient(180deg,rgba(34,197,94,.4),rgba(34,197,94,.16));border-color:rgba(34,197,94,.6)}
.acr-row{display:grid;gap:.3rem;padding:.7rem;border:1px solid rgba(255,255,255,.12);border-radius:12px;margin:.45rem 0;background:rgba(255,255,255,.04)}
.acr-row .t{display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;font-weight:800}.acr-row .m{font-size:.85rem;opacity:.8}.acr-act{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.3rem}
.acr-act a,.acr-act button{padding:.4rem .8rem;border-radius:10px;font:inherit;font-size:.85rem;font-weight:700;color:#fff;text-decoration:none;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);transition:transform .15s}
.acr-act a:hover,.acr-act button:hover{transform:translateY(-2px)}.acr-act .g{background:linear-gradient(180deg,rgba(34,197,94,.4),rgba(34,197,94,.16));border-color:rgba(34,197,94,.6)}
.acr-act .r{background:linear-gradient(180deg,rgba(239,68,68,.38),rgba(239,68,68,.14));border-color:rgba(239,68,68,.55)}
html.white .acr-mod{background:#fff;color:#0f172a;border-color:#d2d9e3}html.white .acr-row{background:#f3f5f9;border-color:#d2d9e3}html.white .acr-tabs button,html.white .acr-act a,html.white .acr-act button{color:#0f172a}`;
    document.head.appendChild(st);
  };
  const ST = { open: "جديدة", contacted: "تم الاتصال", recovered: "مستردّة", dismissed: "مهملة" };
  const wa = c => { const ph = String(c.phone || "").replace(/^0/, "213"); const it = (c.items || [])[0]; const nm = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.name) || ""; return `https://wa.me/${ph}?text=${encodeURIComponent(`السلام عليكم ${c.name || ""}، معك ${nm}. لاحظنا أنك اخترت ${it ? "«" + it.title + "»" : "منتجاً"} ولم تُكمل طلبك. هل نساعدك في إتمامه؟`)}`; };
  function rows() {
    if (!S.list.length) return '<p style="opacity:.7">لا توجد سلال في هذه الحالة.</p>';
    return S.list.map(c => `<div class="acr-row" data-id="${c.id}"><div class="t"><span>${esc(c.name || "بدون اسم")} · <bdi dir="ltr">${esc(c.phone)}</bdi></span><span>${fmt(c.total)}</span></div>
<div class="m">${(c.items || []).map(i => esc(i.title) + (i.qty > 1 ? " ×" + i.qty : "")).join("، ")} · ${c.wilaya ? "ولاية " + esc(c.wilaya) + " · " : ""}منذ ${c.age_min < 90 ? c.age_min + " د" : Math.round(c.age_min / 60) + " س"}</div>
<div class="acr-act"><a class="g" href="tel:+213${esc(String(c.phone).replace(/^0/, ""))}">📞 اتصل</a><a href="${wa(c)}" target="_blank" rel="noopener">💬 واتساب</a>
${c.status === "open" ? '<button data-s="contacted">تم الاتصال</button>' : ""}<button data-s="recovered">اكتمل الطلب</button>${c.status !== "dismissed" ? '<button class="r" data-s="dismissed">إهمال</button>' : '<button data-s="open">إعادة فتح</button>'}</div></div>`).join("");
  }
  const FL = { price_mismatch: "سعر لا يطابق الكتالوج", subtotal_mismatch: "مجموع المنتجات لا يطابق", total_mismatch: "الإجمالي لا يطابق", discount_unverified: "تخفيض بلا كود معروف", coupon_mismatch: "تخفيض أكبر من الكود", fee_out_of_range: "رسم توصيل غير معتاد", stock_short: "كمية أكبر من المخزون", unknown_product: "منتج غير معروف", inactive: "منتج غير نشط", qty_invalid: "كمية غير صالحة" };
  const flagTxt = f => { const [k, v] = String(f).split(":"); return (FL[k] || k) + (v ? " (" + esc(v) + ")" : ""); };
  function flagRows() {
    if (!S.flag.length) return '<p style="opacity:.7">لا طلبات مخالفة. كل الطلبات المرصودة تطابق الأسعار والمخزون.</p>';
    return S.flag.map(o => `<div class="acr-row"><div class="t"><span>${esc(o.name || "—")} · <bdi dir="ltr">${esc(o.phone)}</bdi></span><span>${fmt(o.total)}</span></div><div class="m">${(o.items || []).map(i => esc(i.title || i.id) + " ×" + i.qty + " @" + Math.round(i.price)).join("، ")}</div><div class="m" style="color:#fca5a5">⚠️ ${o.flags.map(flagTxt).join(" · ")}</div></div>`).join("");
  }
  async function load() {
    if (S.st === "__flag") { const r = await call("GET", "/v1/orders", null, { flagged: 1, limit: 50 }); S.flag = r.ok ? (r.j.orders || []) : []; S.err = r.ok ? "" : S.off ? "الخدمة غير مفعّلة على هذا الموقع" : "تعذّر الاتصال بالخدمة"; return draw(); }
    const [l, s] = await Promise.all([call("GET", "/v1/carts", null, { status: S.st, limit: 100 }), call("GET", "/v1/carts/stats")]);
    if (l.ok) S.list = l.j.carts || []; S.stats = s.ok ? s.j : null; S.err = l.ok ? "" : S.off ? "الخدمة غير مفعّلة على هذا الموقع" : l.st === 401 ? "سجّل الدخول من جديد" : "تعذّر الاتصال بالخدمة";
    draw(); badge();
  }
  function draw() {
    const m = $("acr-mod"); if (!m) return; const by = (S.stats && S.stats.by) || {};
    m.innerHTML = `<h3>📞 السلال المتروكة</h3><p style="opacity:.75;margin:0">زبائن أدخلوا رقمهم (بموافقتهم) ولم يُكملوا الطلب. تظهر السلة بعد 15 دقيقة من آخر نشاط.</p>
${S.stats ? `<p style="margin:.4rem 0">نسبة الاسترداد: <b>${Math.round((S.stats.recovery_rate || 0) * 100)}%</b> · قيمة المعلّق: <b>${fmt(((by.open || {}).value || 0))}</b></p>` : ""}
<div class="acr-tabs">${Object.keys(ST).map(k => `<button data-st="${k}" class="${S.st === k ? "on" : ""}">${ST[k]}${by[k] ? " (" + by[k].n + ")" : ""}</button>`).join("")}<button data-st="__flag" class="${S.st === "__flag" ? "on" : ""}" title="طلبات سعرها أو مخزونها لا يطابق الكتالوج">🛡 طلبات مخالفة</button><button id="acr-x" style="margin-inline-start:auto">إغلاق</button></div>
${S.err ? `<p style="color:#fca5a5">${esc(S.err)}</p>` : S.st === "__flag" ? flagRows() : rows()}`;
  }
  async function open() {
    css(); if ($("acr-bg")) return; const d = document.createElement("div"); d.className = "acr-bg"; d.id = "acr-bg"; d.innerHTML = '<div class="acr-mod" id="acr-mod"></div>'; document.body.appendChild(d);
    d.addEventListener("mousedown", e => { if (e.target === d) close(); });
    d.addEventListener("click", async e => {
      const t = e.target.closest("button"); if (!t) return; if (t.id === "acr-x") return close();
      if (t.dataset.st) { S.st = t.dataset.st; return load(); }
      if (t.dataset.s) { const id = t.closest(".acr-row").dataset.id; t.disabled = true; await call("PATCH", "/v1/carts/" + id, { status: t.dataset.s }); load(); }
    });
    draw(); load();
  }
  function close() { const d = $("acr-bg"); if (d) d.remove(); }
  async function badge() {
    const b = $("acr-btn"); if (!b) return; const r = await call("GET", "/v1/carts", null, { status: "open", limit: 100 }); if (!r.ok) { if (S.off) b.remove(); return; }
    S.n = (r.j.carts || []).length; const c = $("acr-count"); if (c) c.textContent = S.n ? "(" + S.n + ")" : "";
  }
  function inject() {
    if ($("acr-btn")) return; const t = $("trash-btn"); if (!t || S.off) return;
    const b = document.createElement("button"); b.type = "button"; b.id = "acr-btn"; b.className = "small gray"; b.title = "زبائن تركوا رقمهم ولم يُكملوا الطلب"; b.innerHTML = '📞 السلال المتروكة <b id="acr-count"></b>'; b.onclick = open;
    t.parentNode.insertBefore(b, t); badge();
  }
  function init() { setInterval(inject, 2500); setInterval(() => { if ($("acr-btn") && !document.hidden) badge(); }, 5 * 60 * 1000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { open, close, call, _s: S };
})();
