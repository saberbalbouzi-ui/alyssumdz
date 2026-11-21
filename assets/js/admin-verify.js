/* «🔎 تحقق من زبون»: بحث بالهاتف أو الاسم أو الولاية أو البلدية (يكفي واحد؛ وإن أُدخل أكثر فكلها معاً)
   في كل طلبات اللوحة (الحديثة والمؤرشفة القديمة، كل الشركات) + قائمة طرود ياليدين المحمَّلة (اسمها وهاتفها مقنَّعان عندهم فيُطابَقان نمطياً)
   + الطرود الخارجية المحفوظة + (اختيارياً) بحث مباشر في طلبات WeCan. النتائج بالتاريخ والمنتج والحالة مع تصفية، وملخّص يُظهر موثوقية الزبون.
   لا يحوي شيئاً خاصاً بمتجر معيّن. */
const AdminVerify = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : null), $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nz = x => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ً-ْـ]/g, "").toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, "");
  const S = { rows: [], q: {}, f: { from: "", to: "", prod: "", st: "" }, live: false, loose: false, busy: false, note: "", did: false };
  const ST = { nouvelle: "في انتظار التأكيد", confirmee: "مؤكَّد", expediee: "في الطريق", livree: "تم التسليم", annulee: "ملغاة", echec: "فشل/مرتجع" };
  const mm = (mask, plain) => { mask = String(mask || ""); plain = String(plain || ""); if (mask.length !== plain.length) return false; for (let k = 0; k < mask.length; k++) { if (mask[k] !== "*" && mask[k].toLowerCase() !== plain[k].toLowerCase()) return false; } return true; };
  const phoneOf = v => { const a = A(); return a && a.normalizePhone ? a.normalizePhone(v) : String(v || "").replace(/\D/g, ""); };
  const tms = d => { const t = new Date(String(d || "").replace(" ", "T")).getTime(); return isFinite(t) ? t : 0; };
  const prodOf = o => { const a = A(); const raw = a && a.itemsDisplay ? a.itemsDisplay(o) : String(o.items || ""); return String(raw).split(/\n/).map(l => l.replace(/\s*×\s*\d+\s*=\s*[\d\s.,]+\s*DA\s*$/i, "").trim()).filter(Boolean).join("، "); };
  const coName = k => { const a = A(); try { return (a.coLabel ? a.coLabel(k) : "") || k; } catch (e) { return k; } };

  /* ── مطابقة سجلّ عادي (اسم وهاتف حقيقيان) ── */
  function plainMatch(r, q) {
    if (q.phone && phoneOf(r.phone) !== q.phone) return false;
    if (q.name) { const hay = nz(r.name); if (!q.nameTok.every(t => hay.includes(t))) return false; }
    if (q.wil && nz(r.wilaya) !== q.wil) return false;
    if (q.com && !nz(r.commune).includes(q.com)) return false;
    return true;
  }
  /* ── مطابقة سجلّ ياليدين المقنَّع (أول/آخر حرف فقط): الهاتف والاسم نمطياً (احتمالي)، والولاية والبلدية صريحة ── */
  const nameMask = (mask, names) => { const words = String(mask || "").split(/[\s.]+/).filter(w => /[^*]/.test(w)); if (!words.length) return false; return names.some(n => { const toks = String(n || "").split(/\s+/).filter(Boolean); return toks.length && words.every(w => toks.some(t => /\*/.test(w) ? mm(w, t) : nz(w) === nz(t))); }); };
  /* الهاتف المقنَّع (05******33) يطابق آلاف الأرقام، فلا يُعرض طرد ياليدين مقنَّع بالهاتف وحده: يلزم أن يوافق اسمه المقنَّع اسماً معروفاً لهذا الرقم (من طلباته في اللوحة أو ما كتبتَه)
     وأن توافق ولايته ولايات طلباته إن وُجدت؛ ويُظهر خيار «توسيع» الاحتمالات الأوسع (4 أرقام ظاهرة على الأقل). */
  function maskMatch(r, q, ctx) {
    if (q.wil && nz(r.wilaya) !== q.wil) return false;
    if (q.com && !nz(r.commune).includes(q.com)) return false;
    if (q.phone) {
      const m = String(r.phone || "").replace(/\s/g, ""); if (!m) return false;
      if (!/\*/.test(m)) { if (phoneOf(m) !== q.phone) return false; }
      else {
        if (!mm(m, q.phone) || (m.match(/\d/g) || []).length < 4) return false;
        if (!ctx.loose) { if (!ctx.names.length || !nameMask(r.name, ctx.names)) return false; if (ctx.wils.size && !ctx.wils.has(nz(r.wilaya))) return false; }
      }
    }
    if (q.name) { const words = String(r.name || "").split(/[\s.]+/).filter(w => /[^*]/.test(w)); if (!words.length) return false; if (!words.every(w => /\*/.test(w) ? q.nameWords.some(t => mm(w, t)) : q.nameTok.some(t => nz(w).includes(t) || t.includes(nz(w))))) return false; }
    return !!(q.phone || q.name || q.wil || q.com);
  }

  function collect(q) {
    const a = A(); const rows = []; if (!a) return rows; const seen = new Set();
    const all = (typeof AdminArchive !== "undefined" && AdminArchive.allOrders) ? AdminArchive.allOrders() : (a.orders || []);
    all.forEach(o => {
      if (!plainMatch(o, q)) return; const t = a.trackingOf ? a.trackingOf(o) : null; if (t) seen.add(t.tracking);
      let raw = ""; try { raw = ((a.shipRaw || {})[o.id] || {}).raw || ""; } catch (e) { }
      rows.push({ src: "order", date: o.date, name: o.name, phone: o.phone, wilaya: o.wilaya, commune: o.commune, product: prodOf(o), st: o.status, raw, co: t ? coName(t.company) : "", tracking: t ? t.tracking : "", amount: Number(o.total) || 0, id: o.id, ext: !!(a.isExtOrder && a.isExtOrder(o)) });
    });
    /* طرود ياليدين المحمَّلة غير المربوطة بطلب هنا */
    try {
      const yd = (typeof AdminYd !== "undefined" && AdminYd.S && AdminYd.S.raw) || [];
      const ctx = { loose: !!S.loose, names: [...new Set([q.rawName].concat(rows.filter(x => x.src === "order").map(x => x.name)).map(x => String(x || "").trim()).filter(Boolean))], wils: new Set(rows.filter(x => x.src === "order").map(x => nz(x.wilaya)).filter(Boolean)) };
      yd.forEach(r => { if (!r || seen.has(r.tracking)) return; if (!maskMatch(r, q, ctx)) return; seen.add(r.tracking); let st = ""; try { st = a.allDeliveryCompanies().yalidine.mapStatus(r.status) || ""; } catch (e) { } rows.push({ src: "yd", date: r.date, name: r.name, phone: r.phone, wilaya: r.wilaya, commune: r.commune, product: String(r.product || ""), st: st === "__alert" ? "" : st, raw: r.status, co: coName("yalidine"), tracking: r.tracking, amount: Number(r.price) || 0, masked: /\*/.test(String(r.name || "") + String(r.phone || "")) }); });
    } catch (e) { }
    /* الطرود الخارجية المحفوظة (سُجّلت عند الشركة مباشرة) */
    try {
      const ex = a.extAll ? a.extAll() : {};
      Object.keys(ex).forEach(k => (ex[k] || []).forEach(r => { if (seen.has(r.tracking)) return; if (!plainMatch({ name: r.client, phone: r.phone, wilaya: r.wilaya, commune: r.commune }, q)) return; seen.add(r.tracking); let st = ""; try { st = a.allDeliveryCompanies()[k].mapStatus(r.raw) || ""; } catch (e) { } rows.push({ src: "ext", date: r.date || (r.at ? new Date(r.at).toISOString() : ""), name: r.client, phone: r.phone, wilaya: r.wilaya, commune: r.commune, product: String(r.product || ""), st: st === "__alert" ? "" : st, raw: r.raw, co: coName(k), tracking: r.tracking, amount: Number(r.amount) || 0 }); }));
    } catch (e) { }
    return rows;
  }

  async function liveWecan(q, rows) {
    const a = A(); const co = a.allDeliveryCompanies().wecan, cfg = a.deliveryCfg && a.deliveryCfg.wecan; if (!co || !cfg || cfg.enabled === false || !co.baseOf) return "WeCan غير مفعّلة";
    const term = q.phone || q.rawName || q.com || ""; if (!term) return "بحث WeCan المباشر يلزمه هاتف أو اسم";
    const seen = new Set(rows.map(r => r.tracking).filter(Boolean)); let n = 0;
    try {
      const r = await a.courierFetch({ url: co.baseOf(cfg) + "/orders?filter%5Bsearch%5D=" + encodeURIComponent(term) + "&page%5Bsize%5D=50", method: "GET", headers: co.hdr(cfg) });
      if (!r.ok) return "تعذّر البحث في WeCan (" + r.status + ")"; let j = null; try { j = JSON.parse(r.text); } catch (e) { return "ردّ WeCan غير مفهوم"; }
      (Array.isArray(j.data) ? j.data : []).forEach(x => {
        const t = (x && x.attributes) || x || {}, trk = String(t.tracking_number || t.tracking || ""); if (trk && seen.has(trk)) return;
        const cand = { name: t.client_name, phone: t.client_phone, wilaya: "", commune: "" }; if (q.phone && phoneOf(cand.phone) !== q.phone) return; if (q.name && !q.nameTok.every(w => nz(cand.name).includes(w))) return;
        const raw = [t.fulfillment_status, t.status, t.confirmation_status].filter(Boolean).join(" · "); let st = ""; try { st = co.mapStatus(raw) || ""; } catch (e) { }
        seen.add(trk); n++; rows.push({ src: "live", date: t.created_at, name: cand.name, phone: cand.phone, wilaya: "", commune: "", product: "", st: st === "__alert" ? "" : st, raw, co: coName("wecan"), tracking: trk, amount: Number(t.total_amount) || 0 });
      });
    } catch (e) { return "تعذّر الاتصال بـ WeCan"; }
    return n ? "" : "لا نتائج إضافية عند WeCan";
  }

  async function run() {
    const a = A(); if (!a || S.busy) return; const g = id => ($(id) || {}).value || "";
    const q = { phone: phoneOf((typeof AdminPhoneFix !== "undefined" ? AdminPhoneFix.clean(g("cv-phone")) : g("cv-phone"))), rawName: g("cv-name").trim(), wil: nz(g("cv-wil")), com: nz(g("cv-com")) };
    q.name = q.rawName; q.nameTok = q.rawName.split(/\s+/).map(nz).filter(Boolean); q.nameWords = q.rawName.split(/\s+/).filter(Boolean);
    if (q.phone && q.phone.replace(/\D/g, "").length < 6) { S.note = "الهاتف قصير جداً"; draw(); return; }
    if (!q.phone && !q.name && !q.wil && !q.com) { S.note = "أدخل هاتفاً أو اسماً أو ولاية أو بلدية"; draw(); return; }
    S.q = q; S.live = !!($("cv-live") || {}).checked; S.loose = !!($("cv-loose") || {}).checked; S.did = true; S.busy = true; S.note = ""; S.f = { from: "", to: "", prod: "", st: "" }; draw();
    const rows = collect(q);
    if (S.live) S.note = await liveWecan(q, rows);
    S.rows = rows.sort((x, y) => tms(y.date) - tms(x.date)); S.busy = false; draw();
  }

  function filtered() {
    const f = S.f, from = f.from ? tms(f.from) : 0, to = f.to ? tms(f.to) + 864e5 - 1 : 0;
    return S.rows.filter(r => { const t = tms(r.date); if (from && (!t || t < from)) return false; if (to && (!t || t > to)) return false; if (f.prod && !String(r.product).includes(f.prod)) return false; if (f.st && r.st !== f.st) return false; return true; });
  }
  function summary(rows) {
    const c = { n: rows.length, livree: 0, echec: 0, annulee: 0, wait: 0 }; rows.forEach(r => { if (r.st === "livree") c.livree++; else if (r.st === "echec") c.echec++; else if (r.st === "annulee") c.annulee++; else c.wait++; });
    const done = c.livree + c.echec, rate = done ? Math.round(c.livree * 100 / done) : null;
    const a = A(); let bl = null, fails = 0; try { if (S.q.phone && a.isBlacklisted) bl = a.isBlacklisted(S.q.phone); if (S.q.phone && a.blFailOrders) fails = a.blFailOrders(S.q.phone).length; } catch (e) { }
    let verdict = "", cls = "";
    if (!c.n) { verdict = "لا سجلّ لهذا الزبون في طلباتك ولا طرود شركاتك المحمَّلة"; cls = "cv-neutral"; }
    else if (bl || c.echec >= 2 || (rate !== null && rate < 50 && done >= 2)) { verdict = "⚠️ احذر: " + (bl ? "رقم في القائمة السوداء" : c.echec + " طلب فاشل/مرتجع") + (rate !== null ? " — نجاح التسليم " + rate + "٪" : ""); cls = "cv-bad"; }
    else if (c.livree >= 1 && !c.echec) { verdict = "✅ زبون سابق موثوق: " + c.livree + " طلب مُسلَّم بلا فشل"; cls = "cv-good"; }
    else { verdict = "ℹ️ سجلّ قليل/مختلط — راجع النتائج"; cls = "cv-neutral"; }
    return { c, rate, verdict, cls, bl };
  }

  function css() {
    if ($("cv-css")) return; const st = document.createElement("style"); st.id = "cv-css";
    st.textContent = '#cv-bg .modal{width:min(1100px,96vw);max-height:92vh;overflow:auto}#cv-bg .cv-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin:.6rem 0}#cv-bg .cv-f label{display:flex;flex-direction:column;gap:.2rem;font-size:.85rem;font-weight:700}#cv-bg .cv-f input,#cv-bg .cv-f select{min-height:40px}#cv-bg .cv-row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:.5rem 0}#cv-bg .cv-sum{display:flex;gap:.4rem;flex-wrap:wrap;margin:.6rem 0}#cv-bg .cv-chip{border:1px solid rgba(128,128,128,.35);border-radius:999px;padding:.2rem .7rem;font-weight:800;font-size:.85rem}#cv-bg .cv-v{margin:.5rem 0;padding:.6rem .8rem;border-radius:12px;font-weight:800;border:1px solid rgba(128,128,128,.35)}#cv-bg .cv-good{background:rgba(34,197,94,.16)}#cv-bg .cv-bad{background:rgba(239,68,68,.16)}#cv-bg .cv-neutral{background:rgba(128,128,128,.12)}#cv-bg .cv-w{overflow:auto}#cv-bg table{border-collapse:collapse;width:100%;min-width:860px}#cv-bg th,#cv-bg td{padding:.4rem .5rem;border-bottom:1px solid rgba(128,128,128,.28);text-align:right;vertical-align:top;font-size:.86rem}#cv-bg td.cv-p{max-width:240px}#cv-bg .cv-tag{display:inline-block;border:1px solid rgba(128,128,128,.4);border-radius:8px;padding:0 .4rem;font-size:.72rem;margin-inline-start:.25rem}';
    document.head.appendChild(st);
  }

  function opts() {
    const wl = (typeof WILAYAS !== "undefined" ? WILAYAS : []).slice().sort((x, y) => x.id - y.id);
    return '<option value="">كل الولايات</option>' + wl.map(w => '<option value="' + esc(w.name) + '"' + (nz(w.name) === S.q.wil && S.q.wil ? " selected" : "") + ">" + w.id + " — " + esc(w.name) + "</option>").join("");
  }

  function draw() {
    const bg = $("cv-bg"); if (!bg) return; const keep = {}; ["cv-phone", "cv-name", "cv-com", "cv-wil"].forEach(id => { if ($(id)) keep[id] = $(id).value; });
    const rows = S.did ? filtered() : [], sm = S.did ? summary(rows) : null;
    const prods = [...new Set(S.rows.flatMap(r => String(r.product).split("،").map(x => x.trim()).filter(Boolean)))].sort(), sts = [...new Set(S.rows.map(r => r.st).filter(Boolean))];
    const tag = r => (r.src === "yd" ? '<span class="cv-tag" title="طرد عند ياليدين غير مربوط بطلب هنا' + (r.masked ? ": الاسم والهاتف مقنَّعان عندهم فالمطابقة احتمالية" : "") + '">طرد ياليدين' + (r.masked ? " · احتمالي" : "") + "</span>" : r.src === "ext" ? '<span class="cv-tag">طرد خارجي</span>' : r.src === "live" ? '<span class="cv-tag">من WeCan مباشرة</span>' : r.ext ? '<span class="cv-tag">خارجي</span>' : "");
    const body = rows.map(r => '<tr><td dir="ltr">' + esc(String(r.date || "").slice(0, 10)) + "</td><td>" + esc(r.name || "—") + tag(r) + '</td><td dir="ltr">' + esc(r.phone || "—") + "</td><td>" + esc([r.wilaya, r.commune].filter(Boolean).join(" / ") || "—") + '</td><td class="cv-p">' + esc(r.product || "—") + '</td><td><span class="pill st-' + esc(r.st || "nouvelle") + '">' + esc(ST[r.st] || r.raw || "—") + "</span>" + (r.raw && ST[r.st] && r.src !== "order" ? "<br><small>" + esc(r.raw) + "</small>" : "") + "</td><td>" + esc(r.co || "—") + (r.tracking ? '<br><small dir="ltr">' + esc(r.tracking) + "</small>" : "") + "</td><td>" + (r.amount ? esc(r.amount.toLocaleString("fr-DZ")) + " دج" : "—") + "</td></tr>").join("");
    bg.innerHTML = '<div class="modal"><h3>🔎 تحقق من زبون</h3><div class="hint">ابحث بأيٍّ من الأربعة (أو أكثر معاً). يشمل كل طلبات اللوحة (الحديثة والمؤرشفة) لكل الشركات، وطرود ياليدين المحمَّلة والطرود الخارجية.</div>'
      + '<div class="cv-f"><label>الهاتف<input id="cv-phone" type="tel" inputmode="tel" dir="ltr" data-phone="1" placeholder="05XX XX XX XX أو الصق نصاً فيه الرقم"></label><label>الاسم<input id="cv-name" placeholder="الاسم الكامل أو جزء منه"></label><label>الولاية<select id="cv-wil">' + opts() + '</select></label><label>البلدية<input id="cv-com" placeholder="البلدية"></label></div>'
      + '<div class="cv-row"><button class="small" type="button" data-cv="go"' + (S.busy ? " disabled" : "") + '>' + (S.busy ? "⏳ جارِ البحث…" : "🔎 تحقق") + '</button><label style="display:inline-flex;gap:.3rem;align-items:center;font-weight:700"><input type="checkbox" id="cv-live"' + (S.live ? " checked" : "") + '> بحث مباشر في WeCan أيضاً</label><label style="display:inline-flex;gap:.3rem;align-items:center;font-weight:700" title="الهاتف عند ياليدين مقنَّع (أول رقمين وآخر رقمين فقط) فقد يطابق أرقاماً أخرى"><input type="checkbox" id="cv-loose"' + (S.loose ? " checked" : "") + '> توسيع: طرود ياليدين المقنَّعة المحتملة</label><button class="small gray" type="button" data-cv="close">إغلاق</button></div>'
      + (S.note ? '<div class="hint" style="color:var(--g-amber,#b45309);font-weight:700">' + esc(S.note) + "</div>" : "")
      + (S.did ? '<div class="cv-v ' + sm.cls + '">' + esc(sm.verdict) + '</div><div class="cv-sum"><span class="cv-chip">النتائج ' + sm.c.n + '</span><span class="cv-chip">تم التسليم ' + sm.c.livree + '</span><span class="cv-chip">فشل/مرتجع ' + sm.c.echec + '</span><span class="cv-chip">ملغاة ' + sm.c.annulee + '</span><span class="cv-chip">قيد المعالجة ' + sm.c.wait + "</span></div>"
        + '<div class="cv-f"><label>من تاريخ<input id="cv-from" type="date" value="' + esc(S.f.from) + '"></label><label>إلى تاريخ<input id="cv-to" type="date" value="' + esc(S.f.to) + '"></label><label>المنتج<select id="cv-prod"><option value="">كل المنتجات</option>' + prods.map(p => "<option" + (S.f.prod === p ? " selected" : "") + ">" + esc(p) + "</option>").join("") + '</select></label><label>حالة الطلب<select id="cv-st"><option value="">كل الحالات</option>' + sts.map(s => '<option value="' + esc(s) + '"' + (S.f.st === s ? " selected" : "") + ">" + esc(ST[s] || s) + "</option>").join("") + "</select></label></div>"
        + (rows.length ? '<div class="cv-w"><table><thead><tr><th>التاريخ</th><th>الزبون</th><th>الهاتف</th><th>الولاية / البلدية</th><th>المنتج</th><th>الحالة</th><th>الشركة / التتبع</th><th>المبلغ</th></tr></thead><tbody>' + body + "</tbody></table></div>" : '<div class="hint">لا نتائج بهذه المرشّحات.</div>') : "")
      + "</div>";
    Object.keys(keep).forEach(id => { if ($(id)) $(id).value = keep[id]; });
    bg.classList.add("open");
  }

  function open(pre) {
    css(); let bg = $("cv-bg"); if (!bg) { bg = document.createElement("div"); bg.id = "cv-bg"; bg.className = "modal-bg"; bg.dir = "rtl"; document.body.appendChild(bg);
      bg.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-cv]"); if (b) { if (b.dataset.cv === "go") run(); else if (b.dataset.cv === "close") bg.classList.remove("open"); return; } if (e.target === bg) bg.classList.remove("open"); });
      bg.addEventListener("change", e => { const m = { "cv-from": "from", "cv-to": "to", "cv-prod": "prod", "cv-st": "st" }[e.target.id]; if (m) { S.f[m] = e.target.value; draw(); } });
      bg.addEventListener("keydown", e => { if (String(e.key || "") === "Enter" && /^cv-(phone|name|com)$/.test(e.target.id || "")) { e.preventDefault(); run(); } }); }
    S.did = false; S.rows = []; S.note = ""; S.q = {}; draw();
    if (pre) { ["phone", "name", "com", "wil"].forEach(k => { if (pre[k] != null && $("cv-" + k)) $("cv-" + k).value = pre[k]; }); if (pre.phone || pre.name) run(); }
  }
  return { open, run, S, _t: { collect, summary, maskMatch, plainMatch } };
})();
window.AdminVerify = AdminVerify;
