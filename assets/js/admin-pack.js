/* «تجهيز الطلبات» لأمين المخزن: الطلبات المؤكَّدة/المرسَلة فقط بلا هاتف ولا أسعار ولا مالية.
   المصدر دالة الخادم pack_orders (Supabase) أو مسار pack_orders (PHP) — لا يقرأ جدول الطلبات؛ علامة «جُهِّز» تُكتب عبر pack_mark وتُسجَّل في سجلّ النشاط.
   قائمة الجمع (مجموع كل منتج للطلبات غير المجهَّزة)، وصل تجهيز A6 بباركود رقم التتبع (من بيانات الطلب نفسها؛ بوليصة الشركة الأصلية PDF للمالك/المدير). */
const AdminPack = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { rows: [], q: "", f: "todo", sel: {}, err: "", busy: false, host: null };
  const CO = { yalidine: "ياليدين", zr: "ZR Express", maystro: "Maystro", noest: "NOEST", ecotrack: "Ecotrack" };
  const ST = { confirmee: "مؤكَّد", expediee: "مُرسَل" };

  /* ── نقية ── */
  function parseItems(text) {
    return String(text || "").split(/\n/).map(l => { const m = l.match(/^(.+?)\s*×\s*(\d+)/); return m ? { title: m[1].trim(), qty: Math.max(1, +m[2] || 1) } : null; }).filter(Boolean);
  }
  /** قائمة الجمع: مجموع كميات كل منتج في الطلبات غير المجهَّزة */
  function pickList(rows) {
    const m = new Map(); (rows || []).filter(r => !r.packed).forEach(r => parseItems(r.items).forEach(i => m.set(i.title, (m.get(i.title) || 0) + i.qty)));
    return [...m.entries()].map(([title, qty]) => ({ title, qty })).sort((a, b) => b.qty - a.qty || a.title.localeCompare(b.title));
  }
  function filter(rows, f, q) {
    q = String(q || "").trim().toLowerCase();
    return (rows || []).filter(r => (f === "all" || (f === "todo" ? !r.packed : r.packed)) && (!q || [r.id, r.name, r.tracking, r.wilaya, r.commune, r.items].join(" ").toLowerCase().includes(q)));
  }

  /* ── الخادم ── */
  const backend = () => (typeof PHPAPI !== "undefined" && PHPAPI.on()) ? "php" : (typeof API !== "undefined" && API.sb && API.sb.enabled() && API.sb.session()) ? "sb" : null;
  async function call(name, body) {
    const b = backend();
    if (b === "php") { const r = await PHPAPI.call(name, name === "pack_orders" ? { method: "GET" } : { method: "POST", body: JSON.stringify(body || {}) }); const j = r.j || {}; if (!r.ok || j.error) throw new Error(j.error || ("http_" + r.status)); return j.orders || j; }
    if (b === "sb") {
      const t = await API.sb.token(); if (!t) throw new Error("انتهت الجلسة");
      const r = await fetch(API.sb.url("/rest/v1/rpc/" + name), { method: "POST", headers: API.sb.headers(t), body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && (j.message || j.error)) || ("http_" + r.status)); return j;
    }
    throw new Error("no_backend");
  }
  async function load() {
    S.busy = true; draw();
    try { S.rows = (await call("pack_orders")) || []; S.err = ""; } catch (e) { S.err = /42501|forbidden|unauthorized|401|403/.test(String(e.message)) ? "ليس لديك صلاحية «تجهيز الطلبات»." : "تعذّر تحميل الطلبات: " + e.message; }
    S.busy = false; draw();
  }
  async function mark(ids, undo) {
    let n = 0; for (const id of ids) { try { await call("pack_mark", backend() === "sb" ? { p_id: id, p_undo: !!undo } : { id, undo: !!undo }); const r = S.rows.find(x => x.id === id); if (r) r.packed = !undo; n++; } catch (e) { if (typeof toast === "function") toast("تعذّر تعليم " + id + ": " + e.message); break; } }
    S.sel = {}; draw(); return n;
  }

  /* ── وصل التجهيز A6 ── */
  function slip(r) {
    const bc = (typeof AdminOrderDocs !== "undefined" && AdminOrderDocs.barcodeSvg) ? AdminOrderDocs.barcodeSvg(r.tracking || r.id) : "";
    const its = parseItems(r.items).map(i => '<tr><td>' + esc(i.title) + '</td><td style="text-align:center;font-weight:900;font-size:1.2em">×' + i.qty + '</td></tr>').join("");
    return '<section class="slip"><div class="h"><b>تجهيز الطلب ' + esc(r.id) + '</b><span>' + esc(CO[r.company] || r.company || "") + '</span></div><div>' + esc(r.name) + ' — ' + esc([r.wilaya, r.commune].filter(Boolean).join(" / ")) + ' · ' + (r.dtype === "stop" ? "مكتب" + (r.desk ? " " + esc(r.desk) : "") : "للمنزل") + '</div>' +
      '<table>' + its + '</table>' + (r.tracking ? '<div class="bc">' + bc + '<div dir="ltr">' + esc(r.tracking) + '</div></div>' : '<div class="nt">لم يُرسل إلى الشركة بعد</div>') + '</section>';
  }
  function printSlips(list) {
    if (!list.length) { if (typeof toast === "function") toast("حدّد طلباً واحداً على الأقل"); return; }
    const w = window.open("", "_blank"); if (!w) { if (typeof toast === "function") toast("اسمح بالنوافذ المنبثقة للطباعة"); return; }
    w.document.write('<!doctype html><html dir="rtl"><meta charset="utf-8"><title>وصل التجهيز</title><style>@page{size:A6;margin:6mm}body{font-family:Arial,"Noto Naskh Arabic",sans-serif;margin:0;color:#111}.slip{page-break-after:always;padding:2mm}.h{display:flex;justify-content:space-between;font-size:1.05em;border-bottom:2px solid #111;padding-bottom:3px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin:6px 0}td{border-bottom:1px solid #bbb;padding:5px 3px}.bc{text-align:center;margin-top:8px}.nt{margin-top:10px;padding:6px;border:2px dashed #999;text-align:center}</style><body>' + list.map(slip).join("") + '<script>onload=function(){setTimeout(function(){print()},300)}<\/script></body></html>');
    w.document.close();
  }

  /* ── الواجهة ── */
  function css() {
    if ($("pk-css")) return; const st = document.createElement("style"); st.id = "pk-css";
    st.textContent = "#pk .chip{display:inline-block;padding:.15rem .6rem;border-radius:999px;font-size:.78rem;font-weight:800;border:1px solid rgba(255,255,255,.25)}#pk .chip.ok{color:#d4ff4d;border-color:rgba(198,254,23,.5)}#pk .chip.td{color:#fcd34d;border-color:rgba(245,158,11,.5)}#pk td,#pk th{padding:.45rem .5rem;vertical-align:top;text-align:right}#pk .it{white-space:pre-line}#pk .tbw{overflow:auto}#pk .pl{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.4rem;margin:.5rem 0}#pk .pl div{display:flex;justify-content:space-between;gap:.5rem;padding:.4rem .6rem;border-radius:10px;background:rgba(255,255,255,.07)}#pk .pl b{font-size:1.1rem}";
    document.head.appendChild(st);
  }
  function draw() {
    const h = S.host; if (!h) return; css();
    if (S.busy && !S.rows.length) { h.innerHTML = '<div id="pk" class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { h.innerHTML = '<div id="pk" class="card"><b>تجهيز الطلبات</b><p class="hint" style="color:#fca5a5">' + esc(S.err) + '</p><button type="button" data-pk="reload">إعادة المحاولة</button></div>'; bind(); return; }
    const todo = S.rows.filter(r => !r.packed).length, list = filter(S.rows, S.f, S.q), pl = pickList(S.rows), ids = list.map(r => r.id), nSel = ids.filter(i => S.sel[i]).length;
    const tab = (k, l, n) => '<button type="button" class="small ' + (S.f === k ? "" : "gray") + '" data-pk="f" data-f="' + k + '">' + l + ' (' + n + ')</button>';
    h.innerHTML = '<div id="pk"><div class="card"><div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center"><h2 style="margin:0">📦 تجهيز الطلبات</h2><button type="button" class="small" data-pk="reload">تحديث</button></div>' +
      '<p class="hint">الطلبات المؤكَّدة والمرسَلة فقط. جهِّز الطرد ثم اضغط «جُهِّز ✓»؛ يظهر ذلك لفريقك فوراً. لا تظهر هنا أرقام الهواتف ولا الأسعار.</p>' +
      (pl.length ? '<b>قائمة الجمع (ما لم يُجهَّز بعد)</b><div class="pl">' + pl.map(p => '<div><span>' + esc(p.title) + '</span><b>×' + p.qty + '</b></div>').join("") + '</div>' : '<p class="hint">🎉 لا شيء بانتظار التجهيز.</p>') + '</div>' +
      '<div class="card"><div class="action-bar" style="flex-wrap:wrap">' + tab("todo", "بانتظار التجهيز", todo) + tab("done", "جُهِّزت", S.rows.length - todo) + tab("all", "الكل", S.rows.length) +
      '<input type="search" id="pk-q" placeholder="بحث: اسم، رقم الطلب، التتبع…" value="' + esc(S.q) + '" style="flex:1;min-width:160px"></div>' +
      '<div class="action-bar" style="flex-wrap:wrap;margin-top:.4rem"><button type="button" class="small" data-pk="all">' + (nSel === ids.length && ids.length ? "إلغاء التحديد" : "تحديد الكل") + '</button><button type="button" data-pk="markSel"' + (nSel ? "" : " disabled") + '>✓ تعليم المحدد كمجهَّز (' + nSel + ')</button><button type="button" class="small" data-pk="print"' + (nSel ? "" : " disabled") + '>🖨️ طباعة وصل التجهيز (' + nSel + ')</button></div>' +
      '<div class="tbw"><table style="width:100%;border-collapse:collapse"><thead><tr><th></th><th>الطلب</th><th>الوجهة</th><th>المنتجات</th><th>الشحن</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(r => '<tr data-id="' + esc(r.id) + '"><td><input type="checkbox" data-pk="sel"' + (S.sel[r.id] ? " checked" : "") + '></td><td><b dir="ltr">' + esc(r.id) + '</b><div class="hint">' + esc(r.name) + '</div></td><td>' + esc([r.wilaya, r.commune].filter(Boolean).join(" / ")) + '<div class="hint">' + (r.dtype === "stop" ? "مكتب" + (r.desk ? " " + esc(r.desk) : "") : "للمنزل") + '</div></td><td class="it">' + esc(r.items) + '</td><td>' +
        (r.tracking ? '<b dir="ltr">' + esc(r.tracking) + '</b><div class="hint">' + esc(CO[r.company] || r.company || "") + '</div>' : '<span class="chip td">لم يُرسل بعد</span>') + '<div class="hint">' + (ST[r.status] || r.status) + '</div></td><td>' +
        (r.packed ? '<span class="chip ok">جُهِّز ✓</span> <button type="button" class="small gray" data-pk="undo">تراجع</button>' : '<button type="button" class="small" data-pk="one">جُهِّز ✓</button>') + '</td></tr>').join("") : '<tr><td colspan="6" class="hint" style="text-align:center;padding:1.2rem">لا طلبات في هذا العرض</td></tr>') + '</tbody></table></div></div></div>';
    bind();
  }
  function bind() {
    const h = S.host; if (!h || h._pk) return; h._pk = 1;
    h.addEventListener("click", async e => {
      const b = e.target.closest("[data-pk]"); if (!b) return; const k = b.dataset.pk, tr = b.closest("tr[data-id]"), id = tr && tr.dataset.id, list = filter(S.rows, S.f, S.q);
      if (k === "reload") return load(); if (k === "f") { S.f = b.dataset.f; return draw(); }
      if (k === "sel") { if (b.checked) S.sel[id] = 1; else delete S.sel[id]; return draw(); }
      if (k === "all") { const all = list.length && list.every(r => S.sel[r.id]); S.sel = {}; if (!all) list.forEach(r => S.sel[r.id] = 1); return draw(); }
      if (k === "one") { b.disabled = true; return void await mark([id], false); }
      if (k === "undo") { b.disabled = true; return void await mark([id], true); }
      if (k === "markSel") { const ids = list.filter(r => S.sel[r.id] && !r.packed).map(r => r.id); if (!ids.length) { if (typeof toast === "function") toast("لا طلبات غير مجهَّزة في التحديد"); return; } b.disabled = true; const n = await mark(ids, false); if (typeof toast === "function") toast("✓ جُهِّز " + n + " طلب"); return; }
      if (k === "print") return printSlips(list.filter(r => S.sel[r.id]));
    });
    h.addEventListener("input", e => { if (e.target.id === "pk-q") { S.q = e.target.value; const pos = e.target.selectionStart; draw(); const q = $("pk-q"); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { } } } });
  }
  function init(hostId) { S.host = $(hostId || "tab-pack"); if (!S.host) return false; S.host._pk = S.host._pk || 0; load(); return true; }
  return { init, load, parseItems, pickList, filter, slip, _S: S };
})();
document.addEventListener("DOMContentLoaded", () => { if (typeof Admin === "undefined" || Admin._packTabWrapped) return; const original = Admin.tab; Admin.tab = function (t, btn) { const r = original.call(this, t, btn), el = document.getElementById("tab-pack"); if (el) el.classList.toggle("hidden", t !== "pack"); if (t === "pack") AdminPack.init("tab-pack"); return r; }; Admin._packTabWrapped = true; });
