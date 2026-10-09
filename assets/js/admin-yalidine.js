/* طرود حساب ياليدين (على شاكلة «Mes colis ← Statistiques par statut»): عدّاد الإجمالي، شرائح الحالات بأعدادها (النقر = تصفية)،
   لوحة «فلتر» (ولاية، بحث، تاريخ، مرتبط/غير مرتبط بطلب)، جدول مرقَّم وتصدير CSV.
   البيانات تأتي من Admin.ydFetchParcels (تستدعي AdminYd.set) وتُخزَّن محلياً في localStorage ‎alyssum_yd_parcels‎ للعرض الفوري.
   الاسم والهاتف مقنَّعان من ياليدين نفسها (تقنيع ثابت من جهتهم). تُرسم البطاقة قبل جدول «الطلبات المسجلة» في تبويب shipped. */
const AdminYd = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "alyssum_yd_parcels", PER = 50;
  const S = { rows: [], total: 0, partial: false, at: 0, st: "", q: "", wil: "", from: "", to: "", link: "", fopen: false, page: 1, busy: false, prog: "" };
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  /* لون الحالة: أخضر للتسليم، عنبري للمرتجع الذي ينتظر، أحمر للمرتجع/الفشل، داكن لغيرها */
  function tone(st) {
    const s = norm(st);
    if (/^livre/.test(s)) return "g";
    if (/retour a retirer|a retirer/.test(s)) return "a";
    if (/retourn|echec|annul|refus/.test(s)) return "r";
    if (/retour/.test(s)) return "a";
    return "d";
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ rows: S.rows, total: S.total, partial: S.partial, at: S.at })); } catch (e) { } }
  function restore() { try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && Array.isArray(j.rows)) { S.rows = j.rows; S.total = j.total || j.rows.length; S.partial = !!j.partial; S.at = j.at || 0; } } catch (e) { } }
  function set(rows, total, partial) { S.rows = rows || []; S.total = total || S.rows.length; S.partial = !!partial; S.at = Date.now(); S.page = 1; save(); draw(); }
  function trackMap() { const a = A(), m = {}; if (a && a.orders) a.orders.forEach(o => { const t = a.trackingOf(o); if (t) m[t.tracking || t] = o; }); return m; }
  function counts() { const c = {}; S.rows.forEach(r => { const k = r.status || "—"; c[k] = (c[k] || 0) + 1; }); return c; }
  function filtered() {
    const tm = trackMap(), q = norm(S.q);
    return S.rows.filter(r => {
      if (S.st && (r.status || "—") !== S.st) return false;
      if (S.wil && norm(r.wilaya) !== norm(S.wil)) return false;
      if (S.from && String(r.date).slice(0, 10) < S.from) return false;
      if (S.to && String(r.date).slice(0, 10) > S.to) return false;
      if (S.link === "yes" && !tm[r.tracking]) return false;
      if (S.link === "no" && tm[r.tracking]) return false;
      if (q && !norm([r.tracking, r.name, r.phone, r.wilaya, r.commune, r.orderId].join(" ")).includes(q)) return false;
      return true;
    });
  }
  function css() {
    if ($("yd-css")) return; const st = document.createElement("style"); st.id = "yd-css";
    st.textContent = `#yd-card .yd-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
#yd-card .yd-total{font-weight:800;padding:8px 16px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff}
#yd-card .yd-chips{display:flex;gap:8px;flex-wrap:wrap}
#yd-card .yd-chip{cursor:pointer;display:inline-flex;gap:8px;align-items:center;padding:7px 14px;border-radius:999px;font-weight:700;font-size:.85rem;color:#fff;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 -2px 4px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.18);backdrop-filter:blur(6px);transition:.15s}
#yd-card .yd-chip:hover{transform:translateY(-2px)}
#yd-card .yd-chip b{background:rgba(255,255,255,.18);border-radius:999px;padding:1px 9px;font-size:.8rem}
#yd-card .yd-chip.g{background:rgba(34,197,94,.28);border-color:rgba(34,197,94,.6)}
#yd-card .yd-chip.a{background:rgba(245,158,11,.28);border-color:rgba(245,158,11,.6)}
#yd-card .yd-chip.r{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.55)}
#yd-card .yd-chip.on{outline:2px solid #fff}
#yd-card .yd-f{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;padding:10px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
#yd-card .yd-f input,#yd-card .yd-f select{flex:1 1 140px;min-width:120px}
#yd-card .yd-b{padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);white-space:nowrap}
#yd-card .yd-b.g{background:rgba(34,197,94,.3)}#yd-card .yd-b.a{background:rgba(245,158,11,.3)}#yd-card .yd-b.r{background:rgba(239,68,68,.28)}
#yd-card td.m{direction:ltr;text-align:right;font-family:monospace}`;
    document.head.appendChild(st);
  }
  function ensure() {
    const t = $("tab-shipped"), tbl = $("ship-table"); if (!t || !tbl) return null; let c = $("yd-card");
    if (!c) { c = document.createElement("div"); c.id = "yd-card"; c.className = "card"; const anchor = tbl.closest(".card"); anchor.parentNode.insertBefore(c, anchor); }
    return c;
  }
  function stamp() { if (!S.at) return "لم تُحمَّل بعد"; const d = new Date(S.at); return "آخر تحميل " + d.toLocaleDateString("ar-DZ") + " " + d.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }); }
  function draw() {
    const c = ensure(); if (!c) return; css();
    const cn = counts(), keys = Object.keys(cn).sort((a, b) => cn[b] - cn[a]), list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
    if (S.page > pages) S.page = pages;
    const tm = trackMap(), wils = [...new Set(S.rows.map(r => r.wilaya).filter(Boolean))].sort();
    const chips = keys.map(k => '<span class="yd-chip ' + tone(k) + (S.st === k ? " on" : "") + '" data-yd-st="' + esc(k) + '">' + esc(k) + ' <b>' + cn[k] + '</b></span>').join("");
    const rows = list.slice((S.page - 1) * PER, S.page * PER).map(r => {
      const o = tm[r.tracking];
      return '<tr><td class="m">' + esc(r.tracking) + '</td><td>' + esc(String(r.date).slice(0, 10)) + '</td><td>' + esc(r.name) + '</td><td class="m">' + esc(r.phone) + '</td><td>' + esc(r.wilaya) + (r.commune ? " / " + esc(r.commune) : "") + '</td><td>' + (r.price || "") + '</td><td><span class="yd-b ' + tone(r.status) + '">' + esc(r.status || "—") + '</span></td><td>' + (o ? "#" + esc(String(o.id).slice(-6)) : "—") + '</td></tr>';
    }).join("") || '<tr><td colspan="8" style="text-align:center;opacity:.7">لا توجد طرود مطابقة</td></tr>';
    c.innerHTML = '<div class="yd-top"><b>📦 طرود حسابك في ياليدين</b><span class="hint" style="margin:0">' + stamp() + (S.partial ? " — جزء من الطرود فقط" : "") + '</span><span style="flex:1"></span>' +
      '<button class="small" type="button" data-yd="load"' + (S.busy ? " disabled" : "") + '>' + (S.busy ? "⏳ " + esc(S.prog || "جارِ التحميل…") : "🔄 تحميل / تحديث الطرود") + '</button>' +
      '<button class="small" type="button" data-yd="csv"' + (S.rows.length ? "" : " disabled") + '>⬇ CSV</button></div>' +
      (S.rows.length ? '<div class="yd-top"><span class="yd-total">Total ' + (S.total || S.rows.length) + '</span><span class="hint" style="margin:0">par statut:</span><div class="yd-chips">' + chips + '</div>' +
        '<button class="small" type="button" data-yd="fl">⚙ Filtre' + (S.q || S.wil || S.from || S.to || S.link ? " •" : "") + '</button>' + (S.st || S.q || S.wil || S.from || S.to || S.link ? '<button class="small" type="button" data-yd="clr">✖ مسح التصفية</button>' : "") + '</div>' : '<div class="hint">اضغط «تحميل / تحديث الطرود» لعرض إحصاءات حسابك في ياليدين حسب الحالة.</div>') +
      (S.fopen && S.rows.length ? '<div class="yd-f"><input data-yd-in="q" placeholder="🔍 تتبع / اسم / هاتف…" value="' + esc(S.q) + '"><select data-yd-in="wil"><option value="">كل الولايات</option>' + wils.map(w => '<option' + (norm(S.wil) === norm(w) ? " selected" : "") + '>' + esc(w) + '</option>').join("") + '</select>' +
        '<input type="date" data-yd-in="from" value="' + esc(S.from) + '" title="من تاريخ"><input type="date" data-yd-in="to" value="' + esc(S.to) + '" title="إلى تاريخ">' +
        '<select data-yd-in="link"><option value="">مرتبط وغير مرتبط</option><option value="yes"' + (S.link === "yes" ? " selected" : "") + '>مرتبط بطلب في اللوحة</option><option value="no"' + (S.link === "no" ? " selected" : "") + '>بلا طلب في اللوحة</option></select></div>' : "") +
      (S.rows.length ? '<div class="hint">' + list.length + ' من أصل ' + (S.total || S.rows.length) + ' طرد' + (S.rows.length < S.total ? " (حُمِّل منها " + S.rows.length + ")" : "") + ' — الاسم والهاتف مُقنَّعان من ياليدين نفسها.</div>' +
        '<div class="rtw" style="overflow:auto"><table class="rt"><thead><tr><th>التتبع</th><th>التاريخ</th><th>الاسم</th><th>الهاتف</th><th>الوجهة</th><th>السعر</th><th>الحالة</th><th>الطلب</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (pages > 1 ? '<div style="text-align:center;margin-top:8px"><button class="small" data-yd="prev"' + (S.page <= 1 ? " disabled" : "") + '>›</button> <span class="hint">' + S.page + ' / ' + pages + '</span> <button class="small" data-yd="next"' + (S.page >= pages ? " disabled" : "") + '>‹</button></div>' : "") : "");
  }
  async function load(auto) {
    const a = A(); if (!a || S.busy) return; S.busy = true; S.err = ""; S.prog = "جارِ التحميل…"; draw();
    try { await a.ydFetchParcels(60, (pg, n, tot) => { S.prog = n + (tot ? " / " + tot : ""); const b = document.querySelector('#yd-card [data-yd=load]'); if (b) b.textContent = "⏳ " + S.prog; }); }
    catch (e) { S.err = e.message || String(e); if (!auto && typeof toast === "function") toast("⚠️ " + (e.message || e)); }
    S.busy = false; draw();
  }
  /* تحميل تلقائي عند فتح التبويب إن كانت النسخة المحلية أقدم من 10 دقائق (وبعدها المطابقة الدورية كل 15 دقيقة تحدّثها) */
  function auto() {
    const a = A(); if (!a || S.busy || (S.at && Date.now() - S.at < 10 * 60e3) || (S.err && Date.now() - (S.errAt || 0) < 5 * 60e3)) return;
    try { const k = a.activeCompanyKey(), co = k && a.allDeliveryCompanies()[k]; if (!co || !co.listRequest) return; } catch (e) { return; }
    load(true).then(() => { if (S.err) S.errAt = Date.now(); });
  }
  function csv() {
    const list = filtered(), q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"', tm = trackMap();
    const out = ["tracking,date,name,phone,wilaya,commune,price,status,order"].concat(list.map(r => [r.tracking, String(r.date).slice(0, 10), r.name, r.phone, r.wilaya, r.commune, r.price, r.status, tm[r.tracking] ? tm[r.tracking].id : ""].map(q).join(",")));
    const b = new Blob(["﻿" + out.join("\n")], { type: "text/csv" }), u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = "yalidine-parcels.csv"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 3000);
  }
  document.addEventListener("click", e => {
    const chip = e.target.closest("#yd-card [data-yd-st]"), btn = e.target.closest("#yd-card [data-yd]");
    if (chip) { const k = chip.dataset.ydSt; S.st = S.st === k ? "" : k; S.page = 1; draw(); return; }
    if (!btn) return; const k = btn.dataset.yd;
    if (k === "load") load(); else if (k === "csv") csv(); else if (k === "fl") { S.fopen = !S.fopen; draw(); }
    else if (k === "clr") { S.st = S.q = S.wil = S.from = S.to = S.link = ""; S.page = 1; draw(); }
    else if (k === "prev") { S.page--; draw(); } else if (k === "next") { S.page++; draw(); }
  });
  document.addEventListener("input", e => {
    const f = e.target.closest("#yd-card [data-yd-in]"); if (!f) return; S[f.dataset.ydIn] = f.value; S.page = 1;
    const pos = f.selectionStart; draw(); const n = document.querySelector('#yd-card [data-yd-in="' + f.dataset.ydIn + '"]'); if (n && f.tagName === "INPUT" && f.type !== "date") { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } }
  });
  function init() {
    restore(); const a = A(); if (!a || !a.tab || a.__ydWrapped) return; a.__ydWrapped = true;
    const old = a.tab.bind(a); a.tab = function (t) { const r = old.apply(a, arguments); if (t === "shipped") { draw(); auto(); } return r; };
    if (!$("tab-shipped").classList.contains("hidden")) { draw(); auto(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); else setTimeout(init, 0);
  return { set, draw, load, S };
})();
