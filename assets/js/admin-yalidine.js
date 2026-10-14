/* طرود حساب ياليدين (على شاكلة «Mes colis ← Statistiques par statut»): عدّاد الإجمالي، شرائح الحالات بأعدادها (النقر = تصفية)،
   لوحة «فلتر» (ولاية، بحث، تاريخ، مرتبط/غير مرتبط بطلب)، جدول مرقَّم وتصدير CSV.
   البيانات تأتي من Admin.ydFetchParcels (تستدعي AdminYd.set) وتُخزَّن محلياً في localStorage ‎alyssum_yd_parcels‎ للعرض الفوري.
   الاسم والهاتف مقنَّعان من ياليدين نفسها (تقنيع ثابت من جهتهم). تُرسم البطاقة قبل جدول «الطلبات المسجلة» في تبويب shipped. */
const AdminYd = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "alyssum_yd_parcels", DKEY = "alyssum_yd_det", PER = 50;
  /* سجلّ ما أرسلناه (تتبع ← الطلب والاسم والهاتف الحقيقيان): يبقى الطرد مرتبطاً بطلبه حتى لو ضاع وسم التتبع من ملاحظة الطلب */
  let REG = {}; try { REG = JSON.parse(localStorage.getItem("alyssum_yd_sent") || "{}") || {}; } catch (e) { }
  function noteSent(o, co, tr) { if (!o || !tr) return; REG[tr] = { id: o.id, name: o.name || "", phone: o.phone || "", co: co || "", at: Date.now() }; const ks = Object.keys(REG); if (ks.length > 400) ks.sort((a, b) => REG[a].at - REG[b].at).slice(0, ks.length - 400).forEach(k => delete REG[k]); try { localStorage.setItem("alyssum_yd_sent", JSON.stringify(REG)); } catch (e) { } }
  function forget(tr) { if (REG[tr]) { delete REG[tr]; try { localStorage.setItem("alyssum_yd_sent", JSON.stringify(REG)); } catch (e) { } } }
  let DET = {}; try { DET = JSON.parse(localStorage.getItem(DKEY) || "{}") || {}; } catch (e) { }
  const saveDet = () => { try { localStorage.setItem(DKEY, JSON.stringify(DET)); } catch (e) { } };
  const masked = v => /\*/.test(String(v || ""));
  const S = { rows: [], total: 0, partial: false, at: 0, st: "", q: "", wil: "", from: "", to: "", link: "", fopen: false, page: 1, busy: false, prog: "" };
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "").toLowerCase().replace(/[\u0623\u0625\u0622]/g, "\u0627").replace(/\u0629/g, "\u0647").replace(/\u0649/g, "\u064a").trim();
  /* لون الحالة: أخضر للتسليم، عنبري للمرتجع الذي ينتظر، أحمر للمرتجع/الفشل، داكن لغيرها */
  function tone(st) {
    const s = norm(st);
    if (/^livre/.test(s)) return "g";
    if (/preparation|prepar|pret a expedier/.test(s)) return "p";
    if (/tentative|echouee/.test(s)) return "y";
    if (/retour a retirer|a retirer/.test(s)) return "a";
    if (/retourn|echec|annul|refus/.test(s)) return "r";
    if (/retour/.test(s)) return "a";
    return "d";
  }
  /* الاسم/الهاتف الحقيقيان: من الطلب المرتبط (لوحتك)، وإلا من تفاصيل الطرد الفردي المحفوظة، وإلا المقنَّع كما ترجعه ياليدين */
  function real(r, o) { const d = DET[r.tracking], g = REG[r.tracking]; if (o && (o.name || o.phone)) return { name: o.name || r.name, phone: o.phone || r.phone, src: "o" }; if (g && (g.name || g.phone)) return { name: g.name || r.name, phone: g.phone || r.phone, src: "g" }; if (d && !masked(d.name) && !masked(d.phone)) return { name: d.name, phone: d.phone, src: "d" }; return { name: r.name, phone: r.phone, src: "m" }; }
  /* أزرار اتصال/واتساب للرقم الحقيقي فقط (غير المقنَّع): 0XXXXXXXXX ← 213XXXXXXXXX */
  function contact(ph) {
    const d = String(ph || "").replace(/\D/g, ""); if (masked(ph) || d.length < 9) return "";
    const w = d.startsWith("213") ? d : "213" + d.replace(/^0/, "");
    return ' <a href="tel:+' + w + '" title="اتصال" style="text-decoration:none">📞</a> <a href="https://wa.me/' + w + '" target="_blank" rel="noopener" title="واتساب" style="text-decoration:none">💬</a>';
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ rows: S.rows, total: S.total, partial: S.partial, at: S.at })); } catch (e) { } }
  function restore() { try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && Array.isArray(j.rows)) { S.rows = j.rows; S.total = j.total || j.rows.length; S.partial = !!j.partial; S.at = j.at || 0; } } catch (e) { } }
  function set(rows, total, partial) { S.rows = rows || []; S.total = total || S.rows.length; S.partial = !!partial; S.at = Date.now(); S.page = 1; save(); draw(); try { window.AdminHome && AdminHome.refreshSoft && AdminHome.refreshSoft(); } catch (e) { } }
  function trackMap() { const a = A(), m = {}; if (a && a.orders) { a.orders.forEach(o => { const t = a.trackingOf(o); if (t) m[t.tracking || t] = o; }); Object.keys(REG).forEach(tr => { if (!m[tr]) { const o = a.orders.find(x => x.id === REG[tr].id); if (o) m[tr] = o; } }); } return m; }
  function counts() { const c = {}; S.rows.forEach(r => { const k = r.status || "—"; c[k] = (c[k] || 0) + 1; }); return c; }
  /* طرود مكرّرة: الاسم والهاتف والوجهة والسعر نفسها خلال 3 أيام (نتيجة إرسال الطلب مرتين) ← {تتبع: عدد المجموعة} */
  function dupMap() {
    const g = {}, out = {};
    S.rows.forEach(r => { const k = [norm(r.name), String(r.phone || "").replace(/\s/g, ""), norm(r.wilaya), norm(r.commune), r.price || 0].join("|"); (g[k] = g[k] || []).push(r); });
    Object.keys(g).forEach(k => { const L = g[k].filter(r => !/(retourn|annul)/i.test(r.status || "")).sort((a, b) => String(a.date).localeCompare(String(b.date))); for (let i = 0; i < L.length; i++) { const near = L.filter((x, j) => j !== i && Math.abs(new Date(x.date) - new Date(L[i].date)) < 3 * 864e5); if (near.length) out[L[i].tracking] = near.length + 1; } });
    return out;
  }
  function filtered() {
    const tm = trackMap(), q = norm(S.q), dm = S.dup ? dupMap() : null;
    return S.rows.filter(r => {
      if (S.st && (r.status || "—") !== S.st) return false;
      if (S.wil && norm(r.wilaya) !== norm(S.wil)) return false;
      if (S.from && String(r.date).slice(0, 10) < S.from) return false;
      if (S.to && String(r.date).slice(0, 10) > S.to) return false;
      if (dm && !dm[r.tracking]) return false;
      if (S.link === "yes" && !tm[r.tracking]) return false;
      if (S.link === "no" && tm[r.tracking]) return false;
      if (q && !norm([r.tracking, real(r, tm[r.tracking]).name, real(r, tm[r.tracking]).phone, r.name, r.phone, r.wilaya, r.commune, r.orderId].join(" ")).includes(q)) return false;
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
#yd-card .yd-chip.g{background:rgba(170,220,10,.28);border-color:rgba(170,220,10,.6)}
#yd-card .yd-chip.p{color:#d4ff4d;background:rgba(170,220,10,.16);border-color:#22c55e}#yd-card .yd-chip.p b{background:rgba(170,220,10,.3);color:#bbf7d0}
#yd-card .yd-chip.y{color:#fde047;background:rgba(234,179,8,.16);border-color:#eab308}#yd-card .yd-chip.y b{background:rgba(234,179,8,.3);color:#fef08a}
#yd-card .yd-chip.a{background:rgba(245,158,11,.28);border-color:rgba(245,158,11,.6)}
#yd-card .yd-chip.r{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.55)}
#yd-card .yd-chip.on{outline:2px solid #fff}
#yd-card .yd-f{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;padding:10px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
#yd-card .yd-f input,#yd-card .yd-f select{flex:1 1 140px;min-width:120px}
#yd-card .yd-b{padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);white-space:nowrap}
#yd-card .yd-b.y{color:#fde047;background:rgba(234,179,8,.16);border:1px solid #eab308}#yd-card .yd-b.p{color:#d4ff4d;background:rgba(170,220,10,.16);border:1px solid #22c55e}#yd-card .yd-b.g{background:rgba(170,220,10,.3)}#yd-card .yd-b.a{background:rgba(245,158,11,.3)}#yd-card .yd-b.r{background:rgba(239,68,68,.28)}
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
    const tm = trackMap(), dmp = dupMap(), ndup = Object.keys(dmp).length, wils = [...new Set(S.rows.map(r => r.wilaya).filter(Boolean))].sort();
    const dupChip = ndup ? '<span class="yd-chip r' + (S.dup ? " on" : "") + '" data-yd-dup="1" title="طرود بالاسم والهاتف والوجهة والسعر نفسها خلال 3 أيام — غالباً إرسال مكرر">⚠️ مكرّر <b>' + ndup + '</b></span>' : "";
    const chips = dupChip + keys.map(k => '<span class="yd-chip ' + tone(k) + (S.st === k ? " on" : "") + '" data-yd-st="' + esc(k) + '">' + esc(k) + ' <b>' + cn[k] + '</b></span>').join("");
    const rows = list.slice((S.page - 1) * PER, S.page * PER).map(r => {
      const o = tm[r.tracking];
      return '<tr data-trk="' + esc(r.tracking) + '"><td class="m">' + esc(r.tracking) + (dmp[r.tracking] ? ' <span class="yd-b r" title="يوجد طرد آخر مطابق له — احذف الزائد من المعاينة">⚠️ مكرّر</span>' : "") + '</td><td>' + esc(String(r.date).slice(0, 10)) + '</td><td dir="auto" style="unicode-bidi:plaintext">' + esc(real(r, o).name) + '</td><td class="m">' + esc(real(r, o).phone) + contact(real(r, o).phone) + '</td><td>' + esc(r.wilaya) + (r.commune ? " / " + esc(r.commune) : "") + '</td><td>' + (r.price || "") + '</td><td><span class="yd-b ' + tone(r.status) + (/^[yar]$/.test(tone(r.status)) ? ' ydc" data-ydd="' + esc(r.tracking) + '" title="اضغط لعرض سبب الحالة وهاتف الموزّع' : '') + '">' + esc(r.status || "—") + '</span></td><td>' + (o ? "#" + esc(String(o.id).slice(-6)) : "—") + '</td><td><button class="small blue" type="button" data-ydp="' + esc(r.tracking) + '">👁️ معاينة</button></td></tr>';
    }).join("") || '<tr><td colspan="9" style="text-align:center;opacity:.7">لا توجد طرود مطابقة</td></tr>';
    c.innerHTML = '<div class="yd-top"><b>📦 طرود حسابك في ياليدين</b><span class="hint" style="margin:0">' + stamp() + (S.partial ? " — جزء من الطرود فقط" : "") + '</span><span style="flex:1"></span>' +
      '<button class="small" type="button" data-yd="load"' + (S.busy ? " disabled" : "") + '>' + (S.busy ? "⏳ " + esc(S.prog || "جارِ التحميل…") : "🔄 تحميل / تحديث الطرود") + '</button>' +
      '<button class="small" type="button" data-yd="csv"' + (S.rows.length ? "" : " disabled") + '>⬇ CSV</button><button class="small" type="button" data-yd="gs"' + (S.rows.length ? "" : " disabled") + ' title="ينسخ الجدول ويفتح Google Sheets جديداً — ألصقه في الخلية A1">📊 Google Sheets</button></div>' +
      (S.rows.length ? '<div class="yd-top"><span class="yd-total">Total ' + (S.total || S.rows.length) + '</span><span class="hint" style="margin:0">par statut:</span><div class="yd-chips">' + chips + '</div>' +
        '<button class="small" type="button" data-yd="fl">⚙ Filtre' + (S.q || S.wil || S.from || S.to || S.link ? " •" : "") + '</button>' + (S.st || S.q || S.wil || S.from || S.to || S.link || S.dup ? '<button class="small" type="button" data-yd="clr">✖ مسح التصفية</button>' : "") + '</div>' : '<div class="hint">اضغط «تحميل / تحديث الطرود» لعرض إحصاءات حسابك في ياليدين حسب الحالة.</div>') +
      (S.fopen && S.rows.length ? '<div class="yd-f"><input data-yd-in="q" placeholder="🔍 تتبع / اسم / هاتف…" value="' + esc(S.q) + '"><select data-yd-in="wil"><option value="">كل الولايات</option>' + wils.map(w => '<option' + (norm(S.wil) === norm(w) ? " selected" : "") + '>' + esc(w) + '</option>').join("") + '</select>' +
        '<input type="date" data-yd-in="from" value="' + esc(S.from) + '" title="من تاريخ"><input type="date" data-yd-in="to" value="' + esc(S.to) + '" title="إلى تاريخ">' +
        '<select data-yd-in="link"><option value="">مرتبط وغير مرتبط</option><option value="yes"' + (S.link === "yes" ? " selected" : "") + '>مرتبط بطلب في اللوحة</option><option value="no"' + (S.link === "no" ? " selected" : "") + '>بلا طلب في اللوحة</option></select></div>' : "") +
      (S.rows.length ? '<div class="hint">' + list.length + ' من أصل ' + (S.total || S.rows.length) + ' طرد' + (S.rows.length < S.total ? " (حُمِّل منها " + S.rows.length + ")" : "") + ' — الاسم والهاتف الحقيقيان يظهران للطرود المرتبطة بطلب في لوحتك، وغيرها تُقنِّعه ياليدين في القائمة.</div>' +
        '<div class="rtw" style="overflow:auto"><table class="rt"><thead><tr><th>التتبع</th><th>التاريخ</th><th>الاسم</th><th>الهاتف</th><th>الوجهة</th><th>السعر</th><th>الحالة</th><th>الطلب</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
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
    try { const k = (a.listCompanyKey?a.listCompanyKey():a.activeCompanyKey()), co = k && a.allDeliveryCompanies()[k]; if (!co || !co.listRequest) return; } catch (e) { return; }
    load(true).then(() => { if (S.err) S.errAt = Date.now(); });
  }
  function csv() {
    const list = filtered(), q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"', tm = trackMap();
    const out = ["tracking,date,name,phone,wilaya,commune,price,status,order"].concat(list.map(r => [r.tracking, String(r.date).slice(0, 10), real(r, tm[r.tracking]).name, real(r, tm[r.tracking]).phone, r.wilaya, r.commune, r.price, r.status, tm[r.tracking] ? tm[r.tracking].id : ""].map(q).join(",")));
    const b = new Blob(["﻿" + out.join("\n")], { type: "text/csv" }), u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = "yalidine-parcels.csv"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 3000);
  }
  /* Google Sheets: ينسخ الجدول (بحسب التصفية) كنص مفصول بتبويب ويفتح جدولاً جديداً — اللصق في A1 يملأ الخلايا مباشرة */
  function sheets() {
    const list = filtered(), tm = trackMap(), cell = v => String(v == null ? "" : v).replace(/[\t\r\n]+/g, " ").trim();
    const rows = [["tracking", "date", "name", "phone", "wilaya", "commune", "price", "status", "order"]].concat(list.map(r => { const x = real(r, tm[r.tracking]); return [r.tracking, String(r.date).slice(0, 10), x.name, x.phone, r.wilaya, r.commune, r.price, r.status, tm[r.tracking] ? tm[r.tracking].id : ""]; }));
    const tsv = rows.map(r => r.map(cell).join("\t")).join("\n"), n = list.length;
    try { window.open("https://sheets.new", "_blank", "noopener"); } catch (e) { }
    const done = () => { if (typeof toast === "function") toast("📊 نُسخ " + n + " طرداً — ألصقه (Ctrl+V) في الخلية A1 من Google Sheets"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(done, () => { csv(); if (typeof toast === "function") toast("تعذّر النسخ — نُزّل ملف CSV يمكنك استيراده في Google Sheets"); });
    else { csv(); if (typeof toast === "function") toast("نُزّل ملف CSV — استورده في Google Sheets"); }
  }
  /* تفاصيل حالة متعثرة (محاولة فاشلة/مرتجع): السبب وهاتف الموزّع من سجلّ الطرد عند الشركة */
  const PH = /(livreur|deliver|driver|courier|agent|rider|coursier|distribut)[a-z_ ]*(phone|tel|contact|mobile)|(phone|tel|contact|mobile)[a-z_ ]*(livreur|deliver|driver|courier|agent|rider|coursier)/i;
  function phones(o, out, d) { d = d || 0; if (!o || typeof o !== "object" || d > 4) return out; Object.keys(o).forEach(k => { const v = o[k]; if (v && typeof v === "object") phones(v, out, d + 1); else if (PH.test(k) && /\d{8,}/.test(String(v))) out.push(String(v)); }); return out; }
  async function detail(tr) {
    const a = A(); if (!a || !a.showNotice) return; const title = "📦 " + tr;
    a.showNotice(title, "⏳ جارِ جلب التفاصيل من شركة التوصيل…");
    try {
      const k = a.listCompanyKey ? a.listCompanyKey() : a.activeCompanyKey(), co = k && a.allDeliveryCompanies()[k], cfg = (a.deliveryCfg || {})[k] || {};
      if (!co || !co.historyRequest) throw new Error("لا تدعم هذه الشركة عرض التفاصيل");
      const [h, p] = await Promise.all([a.courierFetch(co.historyRequest(cfg, tr)).catch(() => null), a.courierFetch(co.trackRequest(cfg, tr)).catch(() => null)]);
      const js = r => { try { return r && r.ok ? JSON.parse(r.text) : null; } catch (e) { return null; } };
      const hj = js(h), pj = js(p), arr = hj && (Array.isArray(hj) ? hj : (hj.data || [])), list = (Array.isArray(arr) ? arr : []).slice().sort((x, y) => String(y.date_status || y.date || "").localeCompare(String(x.date_status || x.date || "")));
      const bad = list.find(x => /tentative|echou|retour|echec|refus|annul/.test(norm(x.status || x.status_name || ""))) || list[0];
      const reason = bad && (bad.reason || bad.motif || bad.comment || ""), ph = [...new Set(phones(hj, phones(pj, [])))];
      const row = x => '<tr><td>' + esc(String(x.date_status || x.date || "").replace("T", " ").slice(0, 16)) + '</td><td>' + esc(x.status || x.status_name || "") + '</td><td>' + esc(x.reason || x.motif || "") + '</td><td>' + esc(x.center_name || "") + '</td></tr>';
      a.showNotice(title, '<div style="line-height:1.9"><b>الحالة:</b> ' + esc((bad && (bad.status || bad.status_name)) || "—") + '<br><b>السبب:</b> ' + (reason ? esc(reason) : '<span style="opacity:.7">لم تذكر الشركة سبباً لهذه الحالة</span>') + '<br><b>هاتف الموزّع:</b> ' + (ph.length ? ph.map(n => '<a dir="ltr" href="tel:' + esc(n.replace(/[^\d+]/g, "")) + '">' + esc(n) + '</a>').join("، ") : '<span style="opacity:.7">لا يوجد هاتف مسجَّل للموزّع عند الشركة</span>') + '</div>' +
        (list.length ? '<div style="overflow:auto;max-height:240px;margin-top:.6rem"><table style="width:100%;border-collapse:collapse;font-size:.82rem"><tr><th>التاريخ</th><th>الحالة</th><th>السبب</th><th>المركز</th></tr>' + list.slice(0, 8).map(row).join("") + '</table></div>' : ''));
    } catch (e) { a.showNotice(title, "❌ تعذّر جلب التفاصيل: " + esc(e.message || e)); }
  }

  /* ═ معاينة طرد: بياناته + تعديل + حذف. التعديل والحذف مقبولان من الشركة غالباً ما دام الطرد في مرحلة التحضير (En préparation) ═ */
  const prep = st => /prepar|en attente|pret a expedier/.test(norm(st || ""));
  const comp = () => { const a = A(), k = a && (a.listCompanyKey ? a.listCompanyKey() : a.activeCompanyKey()), co = k && a.allDeliveryCompanies()[k]; return { a, k, co, cfg: (k && (a.deliveryCfg || {})[k]) || {} }; };
  function pvClose() { const b = $("ydp-bg"); if (b) b.remove(); }
  function pvOpen(tr, edit) {
    const r = S.rows.find(x => x.tracking === tr); if (!r) return; const o = trackMap()[tr], rl = real(r, o), a = A(), idx = o && a ? a.orders.indexOf(o) : -1, can = prep(r.status);
    pvClose(); const bg = document.createElement("div"); bg.id = "ydp-bg"; bg.className = "modal-bg open"; bg.dir = "rtl";
    const row = (k, v) => '<tr><td style="color:#8a8f8c;width:110px;vertical-align:top">' + k + '</td><td>' + v + '</td></tr>', inp = (id, ph, v) => '<input id="ydp-' + id + '" placeholder="' + esc(ph) + '" value="' + esc(v == null ? "" : v) + '" style="width:100%;margin:.15rem 0 .5rem">';
    const info = '<table style="width:100%;border-collapse:collapse">' + row("التتبع", '<b dir="ltr">' + esc(r.tracking) + '</b>') + row("التاريخ", esc(String(r.date).slice(0, 10))) + row("الاسم", esc(rl.name)) + row("الهاتف", '<span dir="ltr">' + esc(rl.phone) + '</span>' + contact(rl.phone)) + row("الوجهة", esc(r.wilaya) + (r.commune ? " / " + esc(r.commune) : "")) + row("السعر", esc(r.price || "—")) + row("الحالة", '<span class="yd-b ' + tone(r.status) + '">' + esc(r.status || "—") + '</span>') + row("الطلب", o ? "#" + esc(String(o.id).slice(-6)) + " — " + esc(o.name || "") : "غير مرتبط بطلب في لوحتك") + '</table>';
    let body;
    if (edit && can) {
      const W = typeof WILAYAS !== "undefined" ? WILAYAS : [], nn = a && a.normName ? t => a.normName(t) : t => String(t || "").toLowerCase(), cw = W.find(w => nn(w.name) === nn(r.wilaya)) || null;
      const sel = (id, opts, cur) => '<select id="ydp-' + id + '" style="width:100%;margin:.15rem 0 .5rem">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select>', lbl = t => '<label style="display:block;font-size:.8rem;opacity:.8">' + t + '</label>';
      const comOpts = (w, cur) => { const l = ((w && w.communes) || []).map(c => [c, c]); if (cur && !l.some(x => nn(x[0]) === nn(cur))) l.unshift([cur, cur + " (الحالية)"]); return l; };
      const deskOpts = (w, cur) => { const w2 = w && a && a.wCo ? a.wCo(w.name) : w; return ((w2 && w2.desks) || []).map(d => [d.id, d.name + (d.commune ? " — " + d.commune : "")]); };
      body = info + '<h3 style="margin:.8rem 0 .4rem">✏️ تعديل الطرد</h3><div class="hint" style="margin:0 0 .6rem">القيم الحالية محدَّدة مسبقاً — غيّر ما تريد فقط، ولا يُرسَل للشركة إلا ما تغيّر.</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 .6rem"><div>' + lbl("الاسم الأول (اختياري)") + inp("fn", "اتركه فارغاً بلا تغيير", "") + '</div><div>' + lbl("اللقب (اختياري)") + inp("ln", "اتركه فارغاً بلا تغيير", "") + '</div></div>' +
        lbl("الولاية") + sel("w", W.map(w => [w.name, w.id + " — " + w.name]), cw ? cw.name : "") +
        lbl("البلدية") + sel("c", comOpts(cw, r.commune), r.commune) +
        lbl("نوع التوصيل") + sel("t", [["home", "🏠 إلى المنزل"], ["stop", "🏢 مكتب Stop Desk"]], r.stop ? "stop" : "home") +
        '<div id="ydp-dw"' + (r.stop ? "" : ' style="display:none"') + '>' + lbl("المكتب") + sel("d", deskOpts(cw), r.deskId) + '</div>' +
        lbl("السعر عند الاستلام دج (اختياري)") + inp("p", "اتركه فارغاً بلا تغيير", "") +
        '<p id="ydp-msg" style="min-height:1.3em;margin:.2rem 0 .6rem;font-size:.85rem"></p><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="small green" type="button" data-ydp-do="save">💾 حفظ</button><button class="small gray" type="button" data-ydp-do="back">رجوع</button></div>';
      bg._lists = { W, comOpts, deskOpts, nn };
    } else {
      body = info + '<p id="ydp-msg" style="min-height:1.3em;margin:.4rem 0;font-size:.85rem"></p><div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
        (can ? '<button class="small gold" type="button" data-ydp-do="edit">✏️ تعديل</button><button class="small" type="button" style="background:var(--red)" data-ydp-do="del">🗑 حذف الطرد</button>' : '<span class="hint" style="margin:0">التعديل والحذف متاحان فقط للطرد في مرحلة التحضير (En préparation) — بعدها لا تقبلهما الشركة.</span>') +
        (idx >= 0 ? '<button class="small blue" type="button" data-ydp-do="order">📋 فتح الطلب</button>' : '') + '<button class="small gold" type="button" data-ydp-do="copy" title="ينسخ الزبون (وطلبه إن كان مرتبطاً) إلى طلب جديد تعدّله وتحفظه">📄 نسخ الزبون كطلب جديد</button></div>';
    }
    bg.innerHTML = '<div class="modal" style="max-width:520px;position:relative"><button type="button" class="ord-x" data-ydp-do="close" title="إغلاق" aria-label="إغلاق">✕</button><h3 style="margin:0 0 .6rem;padding-inline-end:2.4rem">📦 معاينة الطرد</h3>' + body + '</div>';
    bg.addEventListener("click", ev => { if (ev.target === bg) pvClose(); });
    bg.addEventListener("click", ev => {
      const b = ev.target.closest("[data-ydp-do]"); if (!b) return; const k = b.dataset.ydpDo, msg = t => { const m = $("ydp-msg"); if (m) m.textContent = t; };
      if (k === "close") pvClose(); else if (k === "back") pvOpen(tr); else if (k === "edit") pvOpen(tr, true);
      else if (k === "order") { pvClose(); a.openOrderPreview(idx); }
      else if (k === "copy") pvCopy(r, o);
      else if (k === "del") pvDel(r, o, idx, msg); else if (k === "save") pvSave(r, msg);
    });
    bg.addEventListener("change", ev => {
      const L = bg._lists; if (!L) return; const id = ev.target.id, fill = (el, opts) => { el.innerHTML = opts.map(o => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>').join(""); };
      if (id === "ydp-w") { const w = L.W.find(x => x.name === ev.target.value); fill($("ydp-c"), L.comOpts(w)); fill($("ydp-d"), L.deskOpts(w)); }
      if (id === "ydp-t") { const dw = $("ydp-dw"); if (dw) dw.style.display = ev.target.value === "stop" ? "" : "none"; }
    });
    document.body.appendChild(bg);
  }
  /* نسخ الزبون إلى طلب جديد: الطرد المرتبط بطلب ينسخ الطلب كله، وغيره ينسخ الزبون (الاسم والهاتف والوجهة) إن لم يكن مقنَّعاً */
  function pvCopy(r, o) {
    const M = window.ManualOrder, a = A(); if (!M || !a) return; const rl = real(r, o);
    if (masked(rl.name) || masked(rl.phone)) { if (typeof toast === "function") toast("⚠️ اسم وهاتف هذا الزبون مقنَّعان عند الشركة — النسخ متاح للطرد المرتبط بطلب في لوحتك"); return; }
    let src = o;
    if (!src) { const W = typeof WILAYAS !== "undefined" ? WILAYAS : [], w = W.find(x => norm(x.name) === norm(r.wilaya)); src = { id: r.tracking, name: rl.name, phone: rl.phone, wilaya: w ? w.name : r.wilaya, commune: r.commune, dtype: r.stop ? "stop" : "home", desk: "", items: "", fee: w ? (Number(r.stop ? w.stop : w.home) || 0) : 0, discount: 0, subtotal: 0, total: 0, status: "nouvelle" }; }
    pvClose(); M.open({ mode: "copy", order: src });
  }
  async function pvDel(r, o, idx, msg) {
    if (!confirm("حذف الطرد " + r.tracking + " من شركة التوصيل؟" + (o ? "\nسيعود الطلب المرتبط إلى قائمة الطلبات." : ""))) return;
    const { a, co, cfg } = comp(); if (!co || !co.cancelRequest) { msg("هذه الشركة لا تدعم الحذف آلياً"); return; }
    msg("⏳ جارِ الحذف…");
    try {
      const res = await a.courierFetch(co.cancelRequest(cfg, r.tracking));
      if (!res.ok) { msg("لم تقبل الشركة حذف الطرد (رمز " + res.status + ") — غالباً خرج من مرحلة التحضير"); return; }
      if (o && idx >= 0 && a.setNoteTag) { a.setNoteTag(o, /🚚[a-z0-9_]+:[A-Za-z0-9._-]+\s*/g, ""); a.renderOrders(); a.renderShipped && a.renderShipped(); }
      S.rows = S.rows.filter(x => x.tracking !== r.tracking); S.total = Math.max(0, (S.total || 1) - 1); save(); draw(); pvClose(); if (typeof toast === "function") toast("🗑 حُذف الطرد " + r.tracking);
    } catch (e) { msg("تعذّر الحذف: " + (e.message || e)); }
  }
  async function pvSave(r, msg) {
    const g = id => { const e = $("ydp-" + id); return e ? (e.value || "").trim() : ""; }, f = {}; if (g("fn")) f.firstname = g("fn"); if (g("ln")) f.familyname = g("ln");
    if (g("p")) { const n = Number(g("p")); if (!(n >= 0)) { msg("السعر غير صحيح"); return; } f.price = n; f.declared_value = n; }
    const { a, co, cfg } = comp(); if (!co || !co.patchRequest) { msg("هذه الشركة لا تدعم التعديل آلياً"); return; }
    const nn = t => a.normName(t), W = typeof WILAYAS !== "undefined" ? WILAYAS : [], cw = W.find(w => nn(w.name) === nn(r.wilaya)), stop = g("t") === "stop";
    const chg = g("w") !== (cw ? cw.name : "") || nn(g("c")) !== nn(r.commune) || stop !== !!r.stop || (stop && Number(g("d")) !== Number(r.deskId || 0));
    let nz = null;
    if (chg) {
      const w = W.find(x => x.name === g("w")), d = stop && w ? (a.wCo(w.name).desks || []).find(x => String(x.id) === g("d")) : null;
      if (stop && !d) { msg("اختر مكتب Stop Desk لهذه الولاية"); return; }
      msg("⏳ جارِ مطابقة الولاية والبلدية مع قوائم الشركة…");
      try { nz = await a.normForCompany(co, cfg, a.coOrder({ id: r.tracking, name: "", wilaya: g("w"), commune: g("c"), dtype: stop ? "stop" : "home", desk: d ? d.name : "" })); } catch (e) { msg("تعذّر التحقق من القوائم: " + (e.message || e)); return; }
      if (!nz.ok) { msg("❌ " + nz.msg); return; }
      f.to_wilaya_name = nz.ord.wilaya; f.to_commune_name = nz.ord.commune; f.is_stopdesk = stop; if (stop) f.stopdesk_id = nz.ord.__deskId;
    }
    if (!Object.keys(f).length) { msg("لم تغيّر شيئاً"); return; }
    msg("⏳ جارِ الحفظ…");
    try {
      const res = await a.courierFetch(co.patchRequest(cfg, r.tracking, f));
      if (!res.ok) { let why = ""; try { const j = JSON.parse(res.text); why = j.message || j.error || ""; } catch (e) { } msg("رفضت الشركة التعديل (رمز " + res.status + ")" + (why ? ": " + why : "") + " — غالباً خرج الطرد من مرحلة التحضير"); return; }
      if (f.to_wilaya_name) { r.wilaya = f.to_wilaya_name; r.commune = f.to_commune_name; r.stop = stop; r.deskId = stop ? f.stopdesk_id : 0; } if (f.price != null) r.price = f.price;
      if (f.firstname || f.familyname) r.name = [f.firstname, f.familyname].filter(Boolean).join(" ");
      save(); draw(); pvOpen(r.tracking); const m = $("ydp-msg"); if (m) m.textContent = "✅ تم الحفظ"; if (typeof toast === "function") toast("✅ تعديل الطرد " + r.tracking);
    } catch (e) { msg("تعذّر الحفظ: " + (e.message || e)); }
  }
  document.addEventListener("click", e => {
    const pv = e.target.closest("#yd-card [data-ydp]"); if (pv) { pvOpen(pv.dataset.ydp); return; }
    const dd = e.target.closest("#yd-card [data-ydd]"); if (dd) { detail(dd.dataset.ydd); return; }
    const chip = e.target.closest("#yd-card [data-yd-st]"), btn = e.target.closest("#yd-card [data-yd]");
    const dchip = e.target.closest("#yd-card [data-yd-dup]"); if (dchip) { S.dup = !S.dup; S.page = 1; draw(); return; }
    if (chip) { const k = chip.dataset.ydSt; S.st = S.st === k ? "" : k; S.page = 1; draw(); return; }
    if (!btn) return; const k = btn.dataset.yd;
    if (k === "load") load(); else if (k === "csv") csv(); else if (k === "gs") sheets(); else if (k === "fl") { S.fopen = !S.fopen; draw(); }
    else if (k === "clr") { S.st = S.q = S.wil = S.from = S.to = S.link = ""; S.dup = false; S.page = 1; draw(); }
    else if (k === "prev") { S.page--; draw(); } else if (k === "next") { S.page++; draw(); }
  });
  document.addEventListener("input", e => {
    const f = e.target.closest("#yd-card [data-yd-in]"); if (!f) return; S[f.dataset.ydIn] = f.value; S.page = 1;
    if (f.dataset.ydIn === "q") { const sq = $("ship-q"); if (sq && sq.value !== f.value) { sq.value = f.value; try { A().renderShipped(); } catch (x) { } } }
    const pos = f.selectionStart; draw(); const n = document.querySelector('#yd-card [data-yd-in="' + f.dataset.ydIn + '"]'); if (n && f.tagName === "INPUT" && f.type !== "date") { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } }
  });
  function init() {
    restore(); const a = A(); if (!a || !a.tab || a.__ydWrapped) return; a.__ydWrapped = true;
    const old = a.tab.bind(a); a.tab = function (t) { const r = old.apply(a, arguments); if (t === "shipped") { draw(); auto(); } return r; };
    if (!$("tab-shipped").classList.contains("hidden")) { draw(); auto(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); else setTimeout(init, 0);
  /* البحث العلوي في «الطلبات المسجلة» يصفّي هذه البطاقة أيضاً (تلقائياً أثناء الكتابة) */
  function setQuery(q) { if (S.q === q) return; S.q = q; S.page = 1; draw(); }
  return { set, draw, load, S, setQuery, noteSent, forget };
})();
