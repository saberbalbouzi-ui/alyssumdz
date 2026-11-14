/* بطاقة «طرود الشركة» العامة (v1.89.850): نفس تجربة بطاقة طرود ياليدين لأي شركة توصيل أخرى (ZR، Noest، WeCan…):
   شرائح الحالات بالعدد، بحث، تصفية بالولاية والتاريخ والارتباط بطلب، ترقيم صفحات، تصدير CSV، وعمود Action لكل طرد.
   الإعدادات واحدة لكل الشركات (لا إعداد خاص بياليدين). تُغذّيها admin.html بصفوف موحّدة عبر AdminCoP.draw(host, opts). */
(function () {
  const PER = 25, S = {};
  const e = v => String(v == null ? "" : v).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const n = v => (Number(v) || 0).toLocaleString("fr-DZ");
  const norm = t => String(t == null ? "" : t).normalize("NFD").replace(/[̀-ًͯ-ٰٟ]/g, "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  /* نغمة الحالة من نصها (فرنسي/إنجليزي/عربي): l مسلَّم، f مرتجع/ملغى، e في الطريق، w بانتظار */
  function tone(s) {
    const t = norm(s);
    if (/livre|livred|deliver|delivered|مسلم|تم التسليم/.test(t) && !/non liv|echou|retour/.test(t)) return "l";
    if (/retour|return|echec|echou|annul|cancel|refus|rejet|مرتجع|ملغ|فشل/.test(t)) return "f";
    if (/expedi|shipp|transit|livraison|en route|ramass|collect|enleve|dispatch|prepar|sorti|reception|في الطريق|مشحون/.test(t)) return "e";
    return "w";
  }
  const TN = { l: "ys-liv", f: "ys-ret", e: "ys-exp", w: "ys-go" };
  function st(key) { return S[key] || (S[key] = { st: "", q: "", wil: "", from: "", to: "", link: "", page: 1 }); }
  function filtered(key, rows) {
    const s = st(key), gq = norm((document.getElementById("ship-q") || {}).value || ""), q = norm(s.q || gq);
    const f = s.from ? Date.parse(s.from) : 0, t = s.to ? Date.parse(s.to) + 86400000 : 0;
    return rows.filter(r => {
      if (s.st && (r.status || "—") !== s.st) return false;
      if (s.wil && r.wilaya !== s.wil) return false;
      if (s.link === "yes" && !r.orderId) return false;
      if (s.link === "no" && r.orderId) return false;
      if (f || t) { const d = Date.parse(String(r.date || "").replace(" ", "T")); if (!d) return false; if (f && d < f) return false; if (t && d >= t) return false; }
      return !q || norm([r.tracking, r.client, r.phone, r.wilaya, r.commune, r.orderId, r.status].join(" ")).includes(q);
    });
  }
  function csv(key, rows, title) {
    const H = ["Tracking", "الحالة", "الزبون", "الهاتف", "الولاية", "البلدية", "المبلغ", "التاريخ", "الطلب"];
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const out = [H.map(q).join(",")].concat(rows.map(r => [r.tracking, r.status, r.client, r.phone, r.wilaya, r.commune, r.amount, r.date, r.orderId].map(q).join(",")));
    const u = URL.createObjectURL(new Blob(["﻿" + out.join("\n")], { type: "text/csv" })), a = document.createElement("a");
    a.href = u; a.download = String(title || key).replace(/[^\w؀-ۿ.-]+/g, "_") + "-" + new Date().toISOString().slice(0, 10) + ".csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 15000);
  }
  /* opts: { key, title, rows, at, busy, reload(), actions(row)->html, head (html إضافي في الرأس), note } */
  function draw(host, opts) {
    if (!host) return; const key = opts.key, s = st(key), rows = opts.rows || []; host._cop = opts; LAST[key] = opts;
    const cn = {}; rows.forEach(r => { const k = r.status || "—"; cn[k] = (cn[k] || 0) + 1; });
    const keys = Object.keys(cn).sort((a, b) => cn[b] - cn[a]), list = filtered(key, rows), pages = Math.max(1, Math.ceil(list.length / PER));
    if (s.page > pages) s.page = pages;
    const wils = [...new Set(rows.map(r => r.wilaya).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")), slice = list.slice((s.page - 1) * PER, s.page * PER);
    const chips = keys.map(k => '<span class="cop-chip ' + TN[tone(k)] + (s.st === k ? " on" : "") + '" data-cop-st="' + e(k) + '">' + e(k) + ' <b>' + cn[k] + '</b></span>').join("");
    const inp = 'style="min-width:0;max-width:100%"';
    host.innerHTML =
      '<div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><b>' + e(opts.title || "") + '</b><span class="hint" style="margin:0">' + (opts.at ? "آخر تحديث " + new Date(opts.at).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) + " · " : "") + rows.length + ' طرد</span><span style="flex:1"></span>' + (opts.busy ? '<span class="hint" style="margin:0">… جارٍ التحميل</span>' : "") + '</div>' +
      (opts.note ? '<div class="hint" style="margin:.3rem 0">' + opts.note + '</div>' : "") +
      (rows.length ? '<div class="cop-chips">' + (keys.length > 1 ? '<span class="cop-chip' + (!s.st ? " on" : "") + '" data-cop-st="">الكل <b>' + rows.length + '</b></span>' : "") + chips + '</div>' +
        '<div class="cop-f"><input type="search" data-cop-f="q" placeholder="🔍 بحث" value="' + e(s.q) + '" ' + inp + '>' +
        '<select data-cop-f="wil" ' + inp + '><option value="">كل الولايات</option>' + wils.map(w => '<option' + (s.wil === w ? " selected" : "") + '>' + e(w) + '</option>').join("") + '</select>' +
        '<select data-cop-f="link" ' + inp + '><option value="">كل الطرود</option><option value="yes"' + (s.link === "yes" ? " selected" : "") + '>مرتبط بطلب</option><option value="no"' + (s.link === "no" ? " selected" : "") + '>بلا طلب</option></select>' +
        '<label>من <input type="date" data-cop-f="from" value="' + e(s.from) + '" ' + inp + '></label><label>إلى <input type="date" data-cop-f="to" value="' + e(s.to) + '" ' + inp + '></label>' +
        (s.st || s.q || s.wil || s.link || s.from || s.to ? '<button class="small gray" type="button" data-cop="clear">✕ مسح التصفية</button>' : "") + '</div>' +
        '<div class="hint" style="margin:.2rem 0">' + list.length + ' من ' + rows.length + '</div>' +
        '<div class="rtw hs-wrap" style="overflow-x:auto"><table class="rt m-scroll" style="width:100%;border-collapse:collapse;font-size:.88rem"><tr><th>التتبع</th><th>التاريخ</th><th>الاسم</th><th>الهاتف</th><th>الوجهة</th><th>المنتج</th><th>السعر</th><th>الحالة</th><th>الطلب</th><th>Action</th></tr>' +
        (slice.length ? slice.map((r, i) => '<tr data-trk="' + e(r.tracking) + '" data-co="' + e(key) + '" data-cop-i="' + ((s.page - 1) * PER + i) + '"><td data-l="التتبع" dir="ltr"><b>' + e(r.tracking) + '</b></td><td data-l="التاريخ">' + e(String(r.date || "").slice(0, 10)) + '</td><td data-l="الاسم">' + e(r.client || "—") + '</td><td data-l="الهاتف" dir="ltr">' + e(r.phone || "—") + '</td><td data-l="الوجهة">' + e([r.wilaya, r.commune].filter(Boolean).join(" / ") || "—") + '</td><td data-l="المنتج" dir="auto">' + e(r.product || "—") + '</td><td data-l="السعر">' + (r.amount ? n(r.amount) + " دج" : "—") + '</td><td data-l="الحالة"><span class="cop-chip sm ' + TN[tone(r.status)] + '">' + e(r.status || "—") + '</span>' + (r.note ? '<br><small>' + e(r.note) + '</small>' : "") + '</td><td data-l="الطلب" dir="ltr" style="white-space:nowrap">' + (r.orderId ? "✓ " + e(r.orderId) : '<button class="small gray" type="button" data-cop-act="link" title="هذا الطرد بلا طلب في اللوحة: اربطه بطلب أو احفظه كطرد خارجي">ربط</button>') + '</td><td class="act">' + (opts.actions ? opts.actions(r) : "") + '</td></tr>').join("")
          : '<tr><td colspan="10" style="text-align:center;padding:1.2rem;color:#999">لا نتائج مطابقة</td></tr>') + '</table></div>' +
        (pages > 1 ? '<div class="cop-pg"><button class="small gray" type="button" data-cop="prev"' + (s.page <= 1 ? " disabled" : "") + '>›</button><span>' + s.page + ' / ' + pages + '</span><button class="small gray" type="button" data-cop="next"' + (s.page >= pages ? " disabled" : "") + '>‹</button></div>' : "")
        : '<div class="hint" style="margin:.6rem 0">لا طرود بعد — اضغط «تحديث من الشركة».</div>');
    if (!host._copBound) {
      host._copBound = true;
      host.addEventListener("click", ev => {
        const o = host._cop; if (!o) return; const s2 = st(o.key), t = ev.target.closest("[data-cop-st],[data-cop],[data-cop-act]"); if (!t) return;
        if (t.hasAttribute("data-cop-st")) { s2.st = t.getAttribute("data-cop-st"); s2.page = 1; draw(host, o); return; }
        if (t.hasAttribute("data-cop-act")) { const tr = t.closest("tr[data-cop-i]"), r = tr && filtered(o.key, o.rows)[+tr.getAttribute("data-cop-i")]; if (r && o.onAct) o.onAct(t.getAttribute("data-cop-act"), r); return; }
        const a = t.getAttribute("data-cop");
        if (a === "reload") { if (o.reload) o.reload(); }
        else if (a === "csv") csv(o.key, filtered(o.key, o.rows), o.title);
        else if (a === "clear") { Object.assign(s2, { st: "", q: "", wil: "", from: "", to: "", link: "", page: 1 }); draw(host, o); }
        else if (a === "prev") { s2.page = Math.max(1, s2.page - 1); draw(host, o); }
        else if (a === "next") { s2.page++; draw(host, o); }
      });
      host.addEventListener("change", ev => { const o = host._cop, f = ev.target.getAttribute && ev.target.getAttribute("data-cop-f"); if (!o || !f || f === "q") return; const s2 = st(o.key); s2[f] = ev.target.value; s2.page = 1; draw(host, o); });
      host.addEventListener("input", ev => { const o = host._cop; if (!o || ev.target.getAttribute("data-cop-f") !== "q") return; const s2 = st(o.key), v = ev.target.value; s2.q = v; s2.page = 1; clearTimeout(host._copT); host._copT = setTimeout(() => { draw(host, o); const i = host.querySelector('[data-cop-f="q"]'); if (i) { i.focus(); try { i.setSelectionRange(v.length, v.length); } catch (x) {} } }, 250); });
    }
  }
  const css = document.createElement("style");
  css.textContent = '.cop-chips{display:flex;gap:6px;flex-wrap:wrap;margin:.6rem 0}.cop-chip{cursor:pointer;display:inline-flex;gap:6px;align-items:center;padding:5px 12px;border-radius:999px;font-weight:700;font-size:.82rem;border:1.5px solid rgba(255,255,255,.25);color:inherit;white-space:nowrap}.cop-chip.sm{cursor:default;padding:2px 9px;font-size:.75rem}.cop-chip b{background:rgba(255,255,255,.16);border-radius:999px;padding:0 8px}' +
    '.cop-chip.on{outline:2px solid var(--g-tx,#fff)}.cop-chip.ys-liv{background:var(--g-ok,#28a745);color:#1f2123;border-color:transparent}.cop-chip.ys-exp{background:var(--g-info,#007bff);color:#071a2e;border-color:transparent}.cop-chip.ys-ret{background:var(--g-err,#dc3545);color:#fff;border-color:transparent}.cop-chip.ys-go{background:transparent;color:var(--g-warn,#ffc107);border-color:var(--g-warn,#ffc107)}' +
    '.cop-f{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:.3rem 0}.cop-f input[data-cop-f=q]{grid-column:1/-1}.cop-f input,.cop-f select{width:100%!important;min-width:0;padding:.45rem .6rem;min-height:0}.cop-f label{display:flex;gap:.3rem;align-items:center;font-size:.8rem;min-width:0}.cop-f label input{flex:1 1 auto}.cop-f .small{grid-column:1/-1;justify-self:start}.cop-pg{display:flex;gap:.6rem;align-items:center;justify-content:center;margin:.6rem 0}' +
    '.act .small{margin:.1rem}' +
    /* المظهر الفاتح: شرائح الحالات بتباين واضح (كانت نصّاً داكناً على أزرق/أخضر غامق) */
    'html.white .cop-chip{border-color:rgba(15,23,42,.22)}html.white .cop-chip b{background:rgba(15,23,42,.08)}html.white .cop-chip.on{outline-color:#0f172a}' +
    'html.white .cop-chip.ys-liv{background:#ecfccb;color:#365314;border-color:#a3c40a}html.white .cop-chip.ys-exp{background:#e0f2fe;color:#075985;border-color:#7dd3fc}html.white .cop-chip.ys-ret{background:#fee2e2;color:#991b1b;border-color:#fca5a5}html.white .cop-chip.ys-go{background:#fef3c7;color:#92400e;border-color:#f59e0b}';
  document.head.appendChild(css);
  const LAST = {};
  function csvAll(key) { const o = LAST[key]; if (o) csv(key, filtered(key, o.rows || []), o.title); }
  function visible(key) { const o = LAST[key]; return o ? filtered(key, o.rows || []) : []; }
  window.AdminCoP = { draw, tone, state: st, visible, csvAll };
})();
