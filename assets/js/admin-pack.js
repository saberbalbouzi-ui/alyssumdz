/* «تجهيز الطلبات» لأمين المخزن: الطلبات المؤكَّدة/المرسَلة فقط بلا هاتف ولا أسعار ولا مالية.
   المصدر دالة الخادم pack_orders (Supabase) أو مسار pack_orders (PHP) — لا يقرأ جدول الطلبات؛ علامة «جُهِّز» تُكتب عبر pack_mark وتُسجَّل في سجلّ النشاط.
   قائمة الجمع (مجموع كل منتج للطلبات غير المجهَّزة)، وصل تجهيز A6 بباركود رقم التتبع (من بيانات الطلب نفسها؛ بوليصة الشركة الأصلية PDF للمالك/المدير). */
const AdminPack = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { rows: [], q: "", f: "todo", wil: "", fopen: false, sel: {}, err: "", busy: false, host: null };
  const CO = { yalidine: "ياليدين", zr: "ZR Express", maystro: "Maystro", noest: "NOEST", ecotrack: "Ecotrack" };
  const ST = { confirmee: "مؤكَّد", expediee: "مُرسَل" };

  /* ── نقية ── */
  /* الاسم المختصر (حقل «الاسم الظاهر على البوردرو» في المنتج) إن وُجد — الكمية تبقى لأن أمين المخزن يحتاجها */
  function shortName(title) {
    try {
      const ps = (typeof Admin !== "undefined" && Admin.products && Admin.products.length) ? Admin.products : (typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
      const p = (ps || []).find(x => x && x.bord && (x.title === title || String(title).indexOf(x.title + " — ") === 0));
      return p ? (p.title === title ? p.bord : p.bord + title.slice(p.title.length)) : title;
    } catch (e) { return title; }
  }
  function parseItems(text) {
    return String(text || "").split(/\n/).map(l => { const m = l.match(/^(.+?)\s*×\s*(\d+)/); return m ? { title: shortName(m[1].trim()), qty: Math.max(1, +m[2] || 1) } : null; }).filter(Boolean);
  }
  /* القائمة تتبع الطلب نفسه: أي تعديل على الطلب (الولاية/البلدية/الاسم/المنتجات) يظهر هنا فوراً من بيانات اللوحة بدل أن تبقى نسخة الخادم القديمة (طلب عُدِّل من المسيلة إلى العاصمة وبقي «المسيلة» في التجهيز) */
  function live(rows) {
    try { const os = (typeof Admin !== "undefined" && Admin.orders) || []; if (!os.length) return rows; const m = new Map(os.map(o => [String(o.id), o])); (rows || []).forEach(r => { const o = m.get(String(r.id)); if (!o) return; if (o.wilaya) r.wilaya = o.wilaya; if (o.commune) r.commune = o.commune; if (o.name) r.name = o.name; if (o.items) r.items = o.items; }); } catch (e) { }
    return rows;
  }
  /** قائمة الجمع: مجموع كميات كل منتج في الطلبات غير المجهَّزة */
  function pickList(rows) {
    const m = new Map(), nm = new Map(); (rows || []).filter(r => !r.packed).forEach(r => parseItems(r.items).forEach(i => { m.set(i.title, (m.get(i.title) || 0) + i.qty); if (r.name) { const a = nm.get(i.title) || []; a.push(String(r.name).trim()); nm.set(i.title, a); } }));
    return [...m.entries()].map(([title, qty]) => ({ title, qty, names: nm.get(title) || [] })).sort((a, b) => b.qty - a.qty || a.title.localeCompare(b.title));
  }

  /* ── ماسح الباركود: رقم التتبع أو رقم الطلب (جهاز ماسح بلوحة مفاتيح أو كاميرا BarcodeDetector) ── */
  const normScan = v => { let t = String(v == null ? "" : v).trim(); const m = t.match(/[A-Za-z0-9\-_]{5,}\s*$/); if (/[\/?=]/.test(t) && m) t = m[0]; return t.replace(/\s+/g, "").toUpperCase(); };
  /* طلب في التجهيز لا طرد له عند الشركة: بلا وسم تتبع، أو (لحساب المالك إن حُمّلت الطرود) تتبعه غير موجود في قائمة الشركة */
  function noParcel(r) {
    if (!r.tracking) return "لم يُرسل إلى الشركة";
    try { const Y = typeof AdminYd !== "undefined" ? AdminYd : null, rows = Y && Y.S && (Y.S.raw && Y.S.raw.length ? Y.S.raw : Y.S.rows); if (rows && rows.length > 20 && !rows.some(x => String(x.tracking) === String(r.tracking))) return "الطرد غير موجود عند الشركة"; } catch (e) { }
    return "";
  }
  function findRow(rows, code) { const k = normScan(code); if (!k) return null; return (rows || []).find(r => normScan(r.tracking) === k || normScan(r.id) === k) || null; }
  /* ترتيب التجهيز: الطلبات المتشابهة تحت بعض دائماً (نفس المنتجات أولاً ثم نفس الكميات)، والمجموعة الأكثر طلباً أولاً، ويبقى ترتيب الطلبات داخل المجموعة كما وصل */
  function groupSimilar(list) {
    const sigT = r => parseItems(r.items).map(i => i.title).sort().join("|"), sigQ = r => parseItems(r.items).map(i => i.title + "×" + i.qty).sort().join("|");
    const cnt = new Map(); list.forEach(r => { const k = sigT(r); cnt.set(k, (cnt.get(k) || 0) + 1); });
    return list.map((r, i) => ({ r, i, t: sigT(r), q: sigQ(r) })).sort((a, b) => (cnt.get(b.t) - cnt.get(a.t)) || a.t.localeCompare(b.t) || a.q.localeCompare(b.q) || a.i - b.i).map(x => x.r);
  }
  function filter(rows, f, q) {
    q = String(q || "").trim().toLowerCase(); live(rows);
    /* ترتيب المجموعات يُحسب من كل الطلبات لا من المعروض فقط: كان تجهيز طلب (أو بحث) يغيّر أعداد المجموعات فيُعاد ترتيب القائمة كلها وتقفز الصفوف تحت إصبعك */
    const rank = new Map(groupSimilar(rows || []).map((r, i) => [r.id, i]));
    return (rows || []).filter(r => (f === "all" || (f === "todo" ? !r.packed : r.packed)) && (!q || [r.id, r.name, r.tracking, r.wilaya, r.commune, r.items].join(" ").toLowerCase().includes(q))).sort((a, b) => rank.get(a.id) - rank.get(b.id));
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
  /* v1.89.696: قيد التجهيز عند الشركة فقط — للمالك (قائمة الطرود محمّلة) نستبعد ما خرج من حالة «En préparation» */
  function outOfPrep(r) {
    try { const Y = typeof AdminYd !== "undefined" ? AdminYd : null, rows = Y && Y.S && (Y.S.raw && Y.S.raw.length ? Y.S.raw : Y.S.rows); if (!rows || rows.length <= 20 || !r.tracking) return false;
      const p = rows.find(x => String(x.tracking) === String(r.tracking)); if (!p || !p.status) return false;
      return !/preparation|prepar|pret a expedier|en attente/.test(String(p.status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()); } catch (e) { return false; }
  }
  /* عدّاد «بانتظار التجهيز» للرئيسية بلا فتح القسم: من دالة الخادم نفسها (كاش دقيقة) كي يطابق القائمة تماماً */
  const CNT = { t: 0, n: null, busy: false };
  async function count(force) {
    if (CNT.busy || (!force && CNT.n !== null && Date.now() - CNT.t < 60000)) return CNT.n;
    CNT.busy = true; try { const rows = ((await call("pack_orders")) || []).filter(r => r.status !== "expediee" && !outOfPrep(r)); CNT.n = rows.filter(r => !r.packed).length; CNT.t = Date.now(); } catch (e) { } CNT.busy = false; return CNT.n;
  }
  async function load() {
    S.busy = true; draw();
    try { S.rows = ((await call("pack_orders")) || []).filter(r => r.status !== "expediee" && !outOfPrep(r)); /* v1.89.694: المرسَلة للزبون لا تُجهَّز ثانية (الخادم يستبعدها أيضاً) */ S.err = ""; CNT.n = S.rows.filter(r => !r.packed).length; CNT.t = Date.now(); } catch (e) { S.err = /42501|forbidden|unauthorized|401|403/.test(String(e.message)) ? "ليس لديك صلاحية «تجهيز الطلبات»." : "تعذّر تحميل الطلبات: " + e.message; }
    S.busy = false; draw();
  }
  async function mark(ids, undo) {
    let n = 0; for (const id of ids) { try { await call("pack_mark", backend() === "sb" ? { p_id: id, p_undo: !!undo } : { id, undo: !!undo }); const r = S.rows.find(x => x.id === id); if (r) r.packed = !undo; n++; } catch (e) { if (typeof toast === "function") toast("تعذّر تعليم " + id + ": " + e.message); break; } }
    S.sel = {}; CNT.t = 0; draw(); return n;
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


  /* جدول التجهيز في صفحة A4 واحدة: يُقاس الارتفاع ويُصغَّر تلقائياً ليتسع (المنطقة المطبوعة ≈ 277mm) */
  function printTable(list) {
    live(list);
    if (!list.length) { if (typeof toast === "function") toast("لا طلبات للطباعة"); return; }
    const w = window.open("", "_blank"); if (!w) { if (typeof toast === "function") toast("اسمح بالنوافذ المنبثقة للطباعة"); return; }
    const tot = new Map(); list.forEach(r => parseItems(r.items).forEach(i => tot.set(i.title, (tot.get(i.title) || 0) + i.qty)));
    const rows = list.map((r, n) => '<tr><td class="n">' + (n + 1) + '</td><td>' + esc(parseItems(r.items).map(i => i.title + " ×" + i.qty).join("، ")) + '</td><td>' + esc(r.name || "") + '</td><td>' + esc(r.wilaya || "") + '</td><td class="ck"><i></i></td></tr>').join("");
    const sum = [...tot.entries()].sort((a, b) => b[1] - a[1]).map(([t, q]) => esc(t) + " ×" + q).join(" · ");
    const css = '@page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Naskh Arabic",sans-serif;margin:0;color:#111}#pg{width:100%;transform-origin:top right}h1{font-size:15px;margin:0 0 4px;display:flex;justify-content:space-between}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #444;padding:3px 6px;text-align:right;line-height:1.35}th{background:#eee}td.n{width:28px;text-align:center}td.ck{width:34px;text-align:center}td.ck i{display:inline-block;width:13px;height:13px;border:1.5px solid #111}.sum{margin-top:6px;font-size:12px;font-weight:700}';
    const fit = 'var pg=document.getElementById("pg"),mm=document.createElement("div");mm.style.cssText="position:absolute;visibility:hidden;height:277mm;width:1px";document.body.appendChild(mm);var H=mm.offsetHeight,z=1;for(var k=0;k<8&&pg.getBoundingClientRect().height>H-6&&z>.25;k++){z=z*(H-8)/pg.getBoundingClientRect().height*.98;pg.style.zoom=z.toFixed(3)}mm.remove();setTimeout(function(){window.print()},200);';
    w.document.open(); w.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تجهيز الطلبات</title><style>' + css + '</style></head><body><div id="pg"><h1><span>📦 تجهيز الطلبات (' + list.length + ')</span><span>' + new Date().toLocaleDateString("fr-DZ") + '</span></h1><table><thead><tr><th>#</th><th>المنتج</th><th>الزبون</th><th>الولاية</th><th>✓</th></tr></thead><tbody>' + rows + '</tbody></table><div class="sum">المجموع: ' + sum + '</div></div><script>window.onload=function(){' + fit + '}<\/script></body></html>'); w.document.close();
  }

  function beep(ok) { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = ok ? 880 : 220; g.gain.value = .08; o.start(); setTimeout(() => { o.stop(); c.close(); }, ok ? 120 : 380); } catch (e) { } }
  async function onScan(code) {
    const k = normScan(code); if (!k) return; const r = findRow(S.rows, k); let st = "unknown";
    if (!r) st = "unknown"; else if (r.packed) st = "dup"; else { const n = await mark([r.id], false); st = n ? "ok" : "fail"; }
    S.last = { st, code: k, r, at: Date.now() }; beep(st === "ok"); draw(); const i = $("pk-scan"); if (i) i.focus();
  }
  const PI = {
    box: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
    bar: '<svg viewBox="0 0 24 24"><path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
    layers: '<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    flt: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    chk: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    prn: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/></svg>',
    chv: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    reload: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 10-2.3 5.7M20 5v5h-5"/></svg>'
  };
  const ILL_INFO = '<svg class="pk-ill" viewBox="0 0 160 120" aria-hidden="true"><path d="M18 62l34-16 34 16v34L52 112 18 96z" fill="#d9a766"/><path d="M18 62l34 16 34-16-34-16z" fill="#ecc489"/><path d="M52 78v34L18 96V62z" fill="#c8924f"/><rect x="82" y="14" width="62" height="86" rx="8" fill="#5b7fa6"/><rect x="88" y="22" width="50" height="70" rx="5" fill="#fff"/><rect x="104" y="9" width="18" height="10" rx="4" fill="#3d5f86"/><path d="M95 34l3 3 6-7M95 52l3 3 6-7M95 70l3 3 6-7" stroke="#22a05a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M110 35h22M110 53h22M110 71h22" stroke="#c9d3df" stroke-width="3" stroke-linecap="round"/><path d="M30 86h20M30 92h14" stroke="#7a5a2a" stroke-width="3" stroke-linecap="round"/></svg>';
  const ILL_EMPTY = '<svg class="pk-ill pk-ill2" viewBox="0 0 120 100" aria-hidden="true"><path d="M30 46l30-14 30 14v30L60 90 30 76z" fill="#fff" stroke="#c98a3d" stroke-width="3" stroke-linejoin="round"/><path d="M30 46l30 14 30-14M60 60v30" stroke="#c98a3d" stroke-width="3" fill="none" stroke-linejoin="round"/><path d="M30 46l-10-12 26-8M90 46l10-12-26-8" stroke="#c98a3d" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M60 8v12M40 14l6 10M80 14l-6 10" stroke="#e0a020" stroke-width="3" stroke-linecap="round"/></svg>';
  function scanCard() {
    const L = S.last, msg = !L ? "وجّه الماسح إلى باركود الوصل أو اكتب رقم التتبع/الطلب ثم Enter." :
      L.st === "ok" ? '<b style="color:#15803d">✓ جُهِّز</b> — ' + esc(L.r.id) + " · " + esc(L.r.name) + '<span class="hint" style="display:block">' + esc(parseItems(L.r.items).map(i => i.title + " ×" + i.qty).join("، ")) + '</span>' :
      L.st === "dup" ? '<b style="color:#b45309">سبق تجهيزه</b> — ' + esc(L.r.id) + " · " + esc(L.r.name) :
      L.st === "fail" ? '<b style="color:#b91c1c">تعذّر الحفظ</b> — أعد المحاولة' : '<b style="color:#b91c1c">غير موجود في الطلبات المؤكَّدة/المرسَلة:</b> <span dir="ltr">' + esc(L.code) + "</span>";
    return '<div class="card" id="pk-scan-card"><b>📷 ماسح التجهيز</b><div class="pk-scanrow"><label class="pk-inp"><i>' + PI.bar + '</i><input id="pk-scan" type="text" inputmode="none" autocomplete="off" placeholder="امسح الباركود أو اكتب رقم الطلب…" dir="auto"></label><button type="button" class="small pk-cam" data-pk="cam">' + PI.cam + "<span>" + (S.cam ? "إيقاف الكاميرا" : "الكاميرا") + "</span></button></div>" +
      (S.cam ? '<video id="pk-cam" autoplay playsinline muted style="width:100%;max-height:220px;border-radius:12px;margin-top:.4rem;background:#000"></video>' : "") + '</div><div class="pk-msg" id="pk-scan-msg"><i>' + PI.info + "</i><span>" + msg + "</span></div>";
  }
  async function camToggle() {
    if (S.cam) { clearInterval(S.cam.t); try { S.cam.stream.getTracks().forEach(t => t.stop()); } catch (e) { } S.cam = null; draw(); return; }
    if (!("BarcodeDetector" in window)) { if (typeof toast === "function") toast("المتصفح لا يدعم قراءة الباركود بالكاميرا — استعمل جهاز الماسح أو اكتب الرقم"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); S.cam = { stream, t: 0 }; draw();
      const v = $("pk-cam"); if (v) v.srcObject = stream; const det = new BarcodeDetector({ formats: ["code_128", "code_39", "ean_13", "qr_code", "itf"] }); let last = "", lastAt = 0;
      S.cam.t = setInterval(async () => { try { const r = await det.detect(v); if (r && r[0]) { const c = r[0].rawValue; if (c !== last || Date.now() - lastAt > 2500) { last = c; lastAt = Date.now(); onScan(c); } } } catch (e) { } }, 300);
    } catch (e) { S.cam = null; if (typeof toast === "function") toast("تعذّر تشغيل الكاميرا — تحقق من الإذن"); draw(); }
  }

  /* ── الواجهة ── */
  function css() {
    if ($("pk-css")) return; const st = document.createElement("style"); st.id = "pk-css";
    st.textContent = "#pk .chip{display:inline-block;padding:.15rem .6rem;border-radius:999px;font-size:.78rem;font-weight:800;border:1px solid rgba(255,255,255,.25)}#pk .chip.ok{color:#d4ff4d;border-color:rgba(226,254,23,.5)}#pk .chip.td{color:#fcd34d;border-color:rgba(245,158,11,.5)}html.white #pk .chip{border-color:rgba(0,0,0,.22)}html.white #pk .chip.ok{color:#15803d;border-color:#15803d;background:rgba(21,128,61,.09)}html.white #pk .chip.td{color:#b45309;border-color:#b45309;background:rgba(180,83,9,.09)}html.white #pk .pl div{background:rgba(0,0,0,.05)}#pk td,#pk th{padding:.45rem .5rem;vertical-align:top;text-align:right}#pk .pkt{width:100%;border-collapse:collapse;table-layout:fixed}#pk .pkt th:nth-child(1),#pk .pkt td:nth-child(1){width:2.4rem}#pk .pkt th:nth-child(3),#pk .pkt td:nth-child(3){width:20%}#pk .pkt th:nth-child(4),#pk .pkt td:nth-child(4){width:20%}#pk .pkt th:nth-child(5),#pk .pkt td:nth-child(5){width:9.5rem}#pk .pkt td{vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pk .pkt td.ac{overflow:visible}#pk .pkt button.small{padding:.3rem .55rem;font-size:.8rem}@media(max-width:640px){#pk td,#pk th{padding:.35rem .25rem}#pk .pkt th:nth-child(5),#pk .pkt td:nth-child(5){width:5.6rem}#pk .pkt th:nth-child(3),#pk .pkt td:nth-child(3),#pk .pkt th:nth-child(4),#pk .pkt td:nth-child(4){width:24%}#pk .pkt td.it{font-size:.88rem}}#pk .tbw{overflow:hidden}#pk .pl{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.4rem;margin:.5rem 0}#pk .pl div{display:flex;justify-content:space-between;gap:.5rem;padding:.4rem .6rem;border-radius:10px;background:rgba(255,255,255,.07)}#pk .pl b{font-size:1.1rem}#pk .pl .pn{display:block;font-size:.74rem;font-weight:600;opacity:.8;white-space:normal;line-height:1.35}html.white #pk .pl .pn{opacity:.85}";
    document.head.appendChild(st);
  }
  const visible = () => { const l = filter(S.rows, S.f, S.q); return S.wil ? l.filter(r => r.wilaya === S.wil) : l; };
  function draw() { return window.AdminKeep ? window.AdminKeep.run(S.host, draw0) : draw0(); }      /* لا تقفز الشاشة بعد «جُهِّز ✓» (إعادة رسم القائمة كلها) */
  function draw0() {
    const h = S.host; if (!h) return; css(); live(S.rows);
    if (S.busy && !S.rows.length) { h.innerHTML = '<div id="pk" class="card"><p class="hint">جارٍ التحميل…</p></div>'; return; }
    if (S.err) { h.innerHTML = '<div id="pk" class="card"><b>تجهيز الطلبات</b><p class="hint" style="color:#fca5a5">' + esc(S.err) + '</p><button type="button" data-pk="reload">إعادة المحاولة</button></div>'; bind(); return; }
    const todo = S.rows.filter(r => !r.packed).length, list = filter(S.rows, S.f, S.q), pl = pickList(S.rows), ids = list.map(r => r.id), nSel = ids.filter(i => S.sel[i]).length;
    const tab = (k, l, n) => '<button type="button" class="small ' + (S.f === k ? "" : "gray") + '" data-pk="f" data-f="' + k + '">' + l + ' (' + n + ')</button>';
    const wl = [...new Set(S.rows.map(r => r.wilaya).filter(Boolean))].sort(), list2 = S.wil ? list.filter(r => r.wilaya === S.wil) : list, ids2 = list2.map(r => r.id), nSel2 = ids2.filter(i => S.sel[i]).length;
    const seg = (k, ic, l, n) => '<button type="button" class="' + (S.f === k ? "on" : "") + '" data-pk="f" data-f="' + k + '">' + PI[ic] + "<span>" + l + " (" + n + ")</span></button>";
    const rowsHtml = list2.map(r => '<tr data-id="' + esc(r.id) + '" title="' + esc(r.id) + '"' + (noParcel(r) ? ' style="background:rgba(248,113,113,.14)"' : '') + '><td><input type="checkbox" data-pk="sel"' + (S.sel[r.id] ? " checked" : "") + '></td><td class="oid" dir="ltr">' + esc(r.id) + '</td><td class="nm">' + esc(r.name || "") + '</td><td class="wl">' + esc(r.wilaya || "") + '</td><td class="it">' + (noParcel(r) ? '<b style="color:#f87171" title="' + esc(noParcel(r)) + '">⚠️ </b>' : '') + esc(parseItems(r.items).map(i => i.title + " ×" + i.qty).join("، ")) + '</td><td class="ac">' +
      (r.packed ? '<span class="chip ok">✓</span> <button type="button" class="small gray" data-pk="undo">تراجع</button>' : '<button type="button" class="small" data-pk="one">جُهِّز ✓</button>') + '</td></tr>').join("");
    h.innerHTML = '<div id="pk"><div class="ord-head"><span class="ord-ic">' + PI.box + '</span><div><h2>تجهيز الطلبات</h2><p>اختيار الطلبات وتجهيزها للطباعة والإرسال</p></div><button type="button" class="pk-rl" data-pk="reload" aria-label="تحديث" title="تحديث">' + PI.reload + '</button></div>' + scanCard() +
      '<div class="card pk-about">' + ILL_INFO + '<div><h3>' + PI.box + 'تجهيز الطلبات</h3><p>اختر الطلبات المؤكدة والمرسلة فقط. جهّز الطرد ثم اطبع الوصل والملصقات للتسليم لشركة التوصيل.</p></div></div>' +
      (S.rows.some(noParcel) ? '<div class="card" style="border:1px solid #f87171"><b style="color:#f87171">⚠️ ' + S.rows.filter(noParcel).length + ' طلب في التجهيز بلا طرد عند الشركة</b><p class="hint" style="margin:.2rem 0 0">مُعلَّمة بالأحمر وعلامة ⚠️: لا تجهّزها قبل إرسالها (أو إعادة إرسالها) إلى الشركة من «الطلبات».</p></div>' : '') +
      '<div class="pk-seg">' + seg("all", "layers", "الكل", S.rows.length) + seg("todo", "box", "بانتظار التجهيز", todo) + seg("done", "truck", "جاهزة للإرسال", S.rows.length - todo) + '</div>' +
      '<div class="pk-srch"><label class="pk-inp"><i>' + PI.search + '</i><input type="search" id="pk-q" placeholder="بحث: اسم، رقم الطلب، التتبع…" value="' + esc(S.q) + '"></label><button type="button" class="pk-flt' + (S.wil ? " on" : "") + '" data-pk="flt">' + PI.flt + "<span>فلترة</span></button></div>" +
      (S.fopen ? '<div class="pk-fp"><label><span>الولاية</span><select id="pk-wil"><option value="">كل الولايات</option>' + wl.map(w => '<option value="' + esc(w) + '"' + (S.wil === w ? " selected" : "") + ">" + esc(w) + "</option>").join("") + "</select></label></div>" : "") +
      '<div class="card pk-acts"><div class="pk-ab"><button type="button" class="small pk-all" data-pk="all">' + PI.chk + "<span>" + (nSel2 === ids2.length && ids2.length ? "إلغاء التحديد" : "تحديد الكل") + '</span></button><button type="button" class="pk-prn2" data-pk="print"' + (nSel2 ? "" : " disabled") + ">" + PI.prn + "<span>طباعة الوصل والتجهيز (" + nSel2 + ')</span></button><button type="button" class="small pk-tbl" data-pk="ptable">' + PI.prn + "<span>طباعة الجدول (صفحة واحدة)</span></button><button type=\"button\" class=\"pk-mark\" data-pk=\"markSel\"" + (nSel2 ? "" : " disabled") + ">" + PI.tick + "<span>تعليم المحدد كمجهَّز (" + nSel2 + ")</span></button></div></div>" +
      '<div class="card pk-tbc"><div class="tbw"><table class="pkt"><thead><tr><th></th><th>رقم الطلب</th><th>الزبون</th><th>الولاية</th><th>المنتج</th><th></th></tr></thead><tbody>' + rowsHtml + "</tbody></table>" +
      (list2.length ? "" : '<div class="pk-empty">' + ILL_EMPTY + "<b>لا توجد طلبات في هذا العرض</b><span>اختر عرضاً آخر أو عد لاحقاً.</span></div>") + '</div></div>' +
      '<div class="card pk-pl"><b>قائمة الجمع (ما لم يُجهَّز بعد)</b>' + (pl.length ? '<div class="pl">' + pl.map(p => '<div><span>' + esc(p.title) + (p.names && p.names.length ? '<small class="pn">' + esc(p.names.slice(0, 8).join("، ") + (p.names.length > 8 ? " …+" + (p.names.length - 8) : "")) + '</small>' : '') + '</span><b>×' + p.qty + '</b></div>').join("") + '</div>' : '<p class="hint">🎉 لا شيء بانتظار التجهيز.</p>') + '</div></div>';
    bind(); if (S.cam) { const v = $("pk-cam"); if (v && v.srcObject !== S.cam.stream) { v.srcObject = S.cam.stream; v.play && v.play().catch(() => { }); } }
  }
  function bind() {
    const h = S.host; if (!h || h._pk) return; h._pk = 1;
    h.addEventListener("click", async e => {
      const b = e.target.closest("[data-pk]"); if (!b) return; const k = b.dataset.pk, tr = b.closest("tr[data-id]"), id = tr && tr.dataset.id, list = visible();
      if (k === "flt") { S.fopen = !S.fopen; return draw(); }
      if (k === "reload") return load(); if (k === "f") { S.f = b.dataset.f; return draw(); }
      if (k === "sel") { if (b.checked) S.sel[id] = 1; else delete S.sel[id]; return draw(); }
      if (k === "all") { const all = list.length && list.every(r => S.sel[r.id]); S.sel = {}; if (!all) list.forEach(r => S.sel[r.id] = 1); return draw(); }
      if (k === "one") { b.disabled = true; return void await mark([id], false); }
      if (k === "undo") { b.disabled = true; return void await mark([id], true); }
      if (k === "markSel") { const ids = list.filter(r => S.sel[r.id] && !r.packed).map(r => r.id); if (!ids.length) { if (typeof toast === "function") toast("لا طلبات غير مجهَّزة في التحديد"); return; } b.disabled = true; const n = await mark(ids, false); if (typeof toast === "function") toast("✓ جُهِّز " + n + " طلب"); return; }
      if (k === "cam") return camToggle();
      if (k === "ptable") { const sl = list.filter(r => S.sel[r.id]); return printTable(sl.length ? sl : list); }
      if (k === "print") return printSlips(list.filter(r => S.sel[r.id]));
    });
    h.addEventListener("change", e => { if (e.target && e.target.id === "pk-wil") { S.wil = e.target.value; draw(); } });
    h.addEventListener("keydown", e => { if (e.target && e.target.id === "pk-scan" && e.key === "Enter") { e.preventDefault(); const v = e.target.value; e.target.value = ""; onScan(v); } });
    h.addEventListener("input", e => { if (e.target.id === "pk-q") { S.q = e.target.value; const pos = e.target.selectionStart; draw(); const q = $("pk-q"); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { } } } });
  }
  function init(hostId) { S.host = $(hostId || "tab-pack"); if (!S.host) return false; S.host._pk = S.host._pk || 0; load(); return true; }
  return { init, load, count, parseItems, shortName, printTable, pickList, filter, slip, normScan, findRow, onScan, draw, noParcel, _S: S };
})();
document.addEventListener("DOMContentLoaded", () => { if (typeof Admin === "undefined" || Admin._packTabWrapped) return; const original = Admin.tab; Admin.tab = function (t, btn) { const r = original.call(this, t, btn), el = document.getElementById("tab-pack"); if (el) el.classList.toggle("hidden", t !== "pack"); if (t === "pack") AdminPack.init("tab-pack"); return r; }; Admin._packTabWrapped = true; });
