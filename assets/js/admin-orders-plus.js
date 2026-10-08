/* أدوات الطلبات المتقدمة: «عروض» محفوظة (فلاتر جاهزة + عروضك الخاصة)، تحديد متعدد، وإجراءات جماعية (تغيير الحالة، نسخ الأرقام،
   تصدير المحدد CSV). تعمل فوق جدول الطلبات الموجود بلا تعديل في الخلفية، فهي متوافقة مع GitHub/Supabase/PHP. العروض في localStorage هذا المتصفح. */
const AdminOrdersPlus = (() => {
  const $ = id => document.getElementById(id), A = () => (typeof Admin !== "undefined" ? Admin : {});
  const KEY = "admin_order_views", sel = new Set();
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const BUILT = [
    { n: "اليوم", f: { rel: "today" } }, { n: "آخر 7 أيام", f: { rel: "7d" } },
    { n: "تنتظر التأكيد", f: { status: "nouvelle" } }, { n: "في الطريق", f: { status: "expediee" } }, { n: "فشل التوصيل", f: { status: "echec" } },
  ];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (e) { return []; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } };
  const cur = () => ({ q: ($("order-filter-q") || {}).value || "", status: ($("order-filter-status") || {}).value || "", wilaya: ($("order-filter-wilaya") || {}).value || "", dateFrom: ($("order-filter-from") || {}).value || "", dateTo: ($("order-filter-to") || {}).value || "", showShipped: !!($("order-show-shipped") || {}).checked });
  function resolve(f) {
    const o = Object.assign({ q: "", status: "", wilaya: "", dateFrom: "", dateTo: "", showShipped: false }, f || {});
    if (o.rel === "today") o.dateFrom = iso(Date.now()); if (o.rel === "7d") o.dateFrom = iso(Date.now() - 6 * 864e5); delete o.rel; return o;
  }
  function apply(f) {
    const o = resolve(f), set = (id, v) => { const e = $(id); if (e) e.value = v; };
    set("order-filter-q", o.q); set("order-filter-status", o.status); set("order-filter-wilaya", o.wilaya); set("order-filter-from", o.dateFrom); set("order-filter-to", o.dateTo);
    const c = $("order-show-shipped"); if (c) c.checked = !!o.showShipped; sel.clear(); try { A().applyOrderFilters(); } catch (e) { }
  }
  const same = (a, b) => ["q", "status", "wilaya", "dateFrom", "dateTo"].every(k => String(a[k] || "") === String(b[k] || ""));
  function css() {
    if ($("op-css")) return; const st = document.createElement("style"); st.id = "op-css";
    st.textContent = `#op-bar{display:grid;gap:8px;margin:0 0 10px}#op-views{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#op-bar .opv{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;font:inherit;font-size:.86rem;font-weight:800;color:#fff;cursor:pointer;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.14);transition:transform .2s,background .2s}#op-bar .opv:hover{transform:translateY(-2px);background:rgba(255,255,255,.14)}#op-bar .opv.on{background:rgba(74,222,128,.24);border-color:rgba(134,239,172,.6)}#op-bar .opv i{font-style:normal;opacity:.7;margin-inline-start:2px}#op-bar .opv i:hover{opacity:1;color:#ff9aa2}
#op-bar .opb{padding:7px 14px;border-radius:12px;font:inherit;font-size:.86rem;font-weight:800;color:#fff;cursor:pointer;background:rgba(74,222,128,.2);border:1px solid rgba(134,239,172,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 -6px 10px rgba(0,0,0,.2),0 6px 14px rgba(0,0,0,.22);backdrop-filter:blur(8px);transition:transform .2s,background .2s}#op-bar .opb:hover{transform:translateY(-2px);background:rgba(74,222,128,.32)}#op-bar .opb.gh{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.22)}#op-bar .opb.al{background:rgba(251,146,60,.2);border-color:rgba(251,146,60,.5)}
#op-bulk{display:none;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border-radius:16px;background:rgba(9,24,18,.985);border:1px solid rgba(134,239,172,.35);box-shadow:0 10px 26px rgba(0,0,0,.4)}#op-bulk.on{display:flex}#op-bulk b{color:#d9f99d}#op-bulk select{padding:7px 10px;border-radius:10px;font:inherit}
#orders-table .op-c{width:34px;text-align:center}#orders-table input.op-ck{width:17px;height:17px;accent-color:#4ade80;cursor:pointer}#orders-table tr.op-sel td{background:rgba(74,222,128,.1)}`;
    document.head.appendChild(st);
  }
  function bar() {
    const host = $("orders-table") && $("orders-table").closest(".card"); if (!host) return null;
    let b = $("op-bar"); if (!b) { b = document.createElement("div"); b.id = "op-bar"; host.parentNode.insertBefore(b, host); }
    return b;
  }
  function drawBar() {
    const b = bar(); if (!b) return; css(); const c = cur(), custom = load();
    const chip = (v, i, own) => `<button type="button" class="opv${same(resolve(v.f), c) && (c.q || c.status || c.wilaya || c.dateFrom || c.dateTo) ? " on" : ""}" data-v="${own ? "c" : "b"}${i}">${esc(v.n)}${own ? '<i data-del="' + i + '" title="حذف العرض">×</i>' : ""}</button>`;
    b.innerHTML = `<div id="op-views"><button type="button" class="opv${!(c.q || c.status || c.wilaya || c.dateFrom || c.dateTo) ? " on" : ""}" data-v="all">كل الطلبات</button>${BUILT.map((v, i) => chip(v, i, false)).join("")}${custom.map((v, i) => chip(v, i, true)).join("")}<button type="button" class="opb gh" data-sv="1" title="يحفظ البحث والفلاتر الحالية كعرض باسم تختاره">+ حفظ العرض الحالي</button></div>
<div id="op-bulk" class="${sel.size ? "on" : ""}"><span>محدَّد: <b>${sel.size}</b></span><select id="op-st"><option value="">تغيير الحالة إلى…</option>${["confirmee", "expediee", "livree", "annulee", "echec"].map(s => `<option value="${s}">${esc((A().ST_AR || {})[s] || s)}</option>`).join("")}</select><button type="button" class="opb" data-b="apply">تطبيق</button><button type="button" class="opb gh" data-b="phones">نسخ الأرقام</button><button type="button" class="opb gh" data-b="csv">تصدير المحدد CSV</button><button type="button" class="opb al" data-b="clear">إلغاء التحديد</button></div>`;
    b.onclick = e => {
      const t = e.target.closest("button,i"); if (!t) return;
      if (t.dataset.del !== undefined) { e.stopPropagation(); const v = load(); if (confirm("حذف العرض «" + v[+t.dataset.del].n + "»؟")) { v.splice(+t.dataset.del, 1); save(v); drawBar(); } return; }
      if (t.dataset.v) { const k = t.dataset.v; if (k === "all") apply({}); else apply((k[0] === "b" ? BUILT : load())[+k.slice(1)].f); return; }
      if (t.dataset.sv) { const n = (prompt("اسم العرض:") || "").trim(); if (!n) return; const v = load(); v.push({ n, f: cur() }); save(v); drawBar(); toast("✅ حُفظ العرض «" + n + "»"); return; }
      if (t.dataset.b) bulk(t.dataset.b);
    };
  }
  const chosen = () => (A().orders || []).filter(o => sel.has(String(o.id)));
  function bulk(a) {
    const L = chosen(); if (!L.length) return;
    if (a === "clear") { sel.clear(); A().renderOrders(); return; }
    if (a === "phones") { const t = [...new Set(L.map(o => o.phone).filter(Boolean))].join("\n"); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("✅ نُسخ " + t.split("\n").length + " رقماً"), () => prompt("انسخ الأرقام:", t)); return; }
    if (a === "csv") {
      const rows = [["الرقم", "التاريخ", "الاسم", "الهاتف", "الولاية", "البلدية", "المنتجات", "الإجمالي", "الحالة"]].concat(L.map(o => [o.id, new Date(o.date).toLocaleString("ar-DZ"), o.name, o.phone, o.wilaya || "", o.commune || "", String(o.items || "").replace(/\n/g, " "), Number(o.total) || 0, o.status]));
      const csv = "﻿" + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\r\n"), x = document.createElement("a");
      x.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); x.download = "orders-selected-" + iso(Date.now()) + ".csv"; document.body.appendChild(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(x.href), 2000); toast("✅ جارِ تنزيل " + L.length + " طلباً"); return;
    }
    if (a === "apply") {
      const st = $("op-st").value; if (!st) return toast("اختر الحالة أولاً");
      if (!confirm("تغيير حالة " + L.length + " طلب إلى «" + ((A().ST_AR || {})[st] || st) + "»؟\nلن يُرسَل شيء لشركة التوصيل؛ هذا تغيير حالة فقط.")) return;
      const ad = A(); L.forEach(o => { const i = ad.orders.indexOf(o); if (i >= 0 && o.status !== st) { try { API.updateOrder(ad.key, o.id, st); ad.onStatusChange && ad.onStatusChange(i, st); o.status = st; } catch (e) { console.warn(e); } } });
      sel.clear(); ad.renderOrders(); try { ad.renderStats(); } catch (e) { } toast("✅ حُدِّثت الحالات");
    }
  }
  function decorate() {
    const t = $("orders-table"), ad = A(); if (!t || !ad.getFilteredOrders) return;
    const rows = [...t.querySelectorAll("tr")]; if (rows.length < 2 || !rows[0].querySelector("th")) return;
    const f = ad.getFilteredOrders(), st = (ad.orderPage - 1) * ad.ORDER_PAGE_SIZE, page = f.slice(st, st + ad.ORDER_PAGE_SIZE).map(x => x.o);
    const allOn = page.length && page.every(o => sel.has(String(o.id)));
    const th = document.createElement("th"); th.className = "op-c"; th.innerHTML = `<input type="checkbox" class="op-ck" data-all="1" ${allOn ? "checked" : ""} title="تحديد كل طلبات هذه الصفحة">`; rows[0].insertBefore(th, rows[0].firstChild);
    rows.slice(1).forEach((tr, k) => { const o = page[k]; if (!o) return; const td = document.createElement("td"); td.className = "op-c"; td.innerHTML = `<input type="checkbox" class="op-ck" data-id="${esc(o.id)}" ${sel.has(String(o.id)) ? "checked" : ""}>`; tr.insertBefore(td, tr.firstChild); if (sel.has(String(o.id))) tr.classList.add("op-sel"); });
    t.onchange = e => {
      const c = e.target; if (!c.classList || !c.classList.contains("op-ck")) return;
      if (c.dataset.all) page.forEach(o => c.checked ? sel.add(String(o.id)) : sel.delete(String(o.id))); else c.checked ? sel.add(c.dataset.id) : sel.delete(c.dataset.id);
      decorateRefresh();
    };
  }
  function decorateRefresh() { drawBar(); const t = $("orders-table"); if (!t) return; t.querySelectorAll("tr").forEach(tr => { const c = tr.querySelector("input.op-ck[data-id]"); if (c) tr.classList.toggle("op-sel", c.checked); }); const all = t.querySelector("input[data-all]"); if (all) { const ids = [...t.querySelectorAll("input.op-ck[data-id]")]; all.checked = ids.length && ids.every(c => c.checked); } }
  function init() {
    const a = A(); if (!a || a.__opWrap || typeof a.renderOrders !== "function") return setTimeout(init, 400);
    a.__opWrap = 1; const o = a.renderOrders;
    a.renderOrders = function () { const r = o.apply(this, arguments); try { decorate(); drawBar(); } catch (e) { console.warn("AdminOrdersPlus", e); } return r; };
    const f = a.applyOrderFilters; if (f) a.applyOrderFilters = function () { sel.clear(); return f.apply(this, arguments); };
    try { drawBar(); } catch (e) { }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { apply, views: load, sel };
})();
