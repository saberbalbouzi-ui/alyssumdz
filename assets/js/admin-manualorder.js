/* طلب يدوي (v1.89.99): إضافة طلب جديد من اللوحة، أو نسخ طلب موجود كطلب جديد (من معاينة الطلب)، أو تعديل كامل لطلب جديد غير مسجَّل لدى الشركة (المنتجات والهاتف أيضاً).
   الإنشاء: API.addOrder (supabase: إدراج بجلسة المدير، php: نقطة order بعلم manual، sheets: إرسال عادي). الطلب الجديد يظهر «في انتظار التأكيد» كأي طلب فيمرّ بنفس مسار التأكيد والإرسال.
   التعديل: API.updateOrderFields (حقول الطلب + المنتجات + الهاتف) وإلا احتياط محلي OrderEdit.stash يُطبَّق عند كل تحميل. دوال parseLines/calc نقية للاختبار. */
window.ManualOrder = (function () {
  const A = () => (typeof Admin !== "undefined" ? Admin : null), W = () => (typeof WILAYAS !== "undefined" ? WILAYAS : []);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = v => Math.max(0, Math.round(Number(v) || 0)), wOf = n => W().find(x => x.name === n) || null;
  /* «عنوان ×كمية = مبلغ DA» ← [{title,qty,price(للوحدة)}] */
  function parseLines(text) {
    return String(text || "").split(/\n/).map(l => { const m = l.match(/^(.+?)\s*×\s*(\d+)\s*=\s*(\d+)/); if (!m) return null; const q = Math.max(1, Number(m[2]) || 1); return { title: m[1].trim(), qty: q, price: Math.round((Number(m[3]) || 0) / q) }; }).filter(Boolean);
  }
  const amtOf = l => l.amt != null ? num(l.amt) : num(l.qty) * num(l.price);
  function calc(lines, fee, disc) { const sub = (lines || []).reduce((a, l) => a + amtOf(l), 0), d = Math.min(num(disc), sub); return { sub, disc: d, fee: num(fee), total: Math.max(0, sub - d) + num(fee) }; }
  const textOf = lines => lines.map(l => l.title + " ×" + l.qty + " = " + amtOf(l) + " DA").join("\n");
  /* خيارات المنتجات: بسيط، وكل تنويعة فعّالة لمتغيّر */
  function prodOpts() {
    const ad = A(), out = []; ((ad && ad.products) || []).filter(p => p.slug !== "test" && p.active !== false).forEach(p => {
      const t = p.type;
      if (t === "variable") (p.variations || []).filter(v => v && v.active !== false).forEach(v => { const lb = ((p.attributes || []).filter(a => a.variation && v.attrs && v.attrs[a.name] != null).map(a => a.name + ": " + v.attrs[a.name]).join(" / ")); out.push({ slug: p.slug, title: (p.bord || p.title) + (lb ? " — " + lb : ""), name: p.title + (lb ? " — " + lb : ""), price: num(v.price) }); });
      else if (t !== "grouped") out.push({ slug: p.slug, title: p.bord || p.title, name: p.title, price: num(p.price), offers: (p.offers || []).filter(o => o && num(o.qty) > 0 && num(o.price) > 0) });
    });
    return out;
  }
  /* ولاية الانطلاق: الافتراضية من إعدادات الشركة المفعّلة (وإلا الجزائر)، ويمكن تغييرها لهذا الطلب وحده */
  function fromDef(ad) {
    try { const k = ad.activeCompanyKey && ad.activeCompanyKey(), cfg = (k && ad.deliveryCfg && ad.deliveryCfg[k]) || {}, want = ad.normName ? ad.normName(cfg.fromWilayaName || "Alger") : String(cfg.fromWilayaName || "alger").toLowerCase(); const w = W().find(x => !x.par && (ad.normName ? ad.normName(x.name) : String(x.name).toLowerCase()) === want); return w ? w.name : ""; } catch (e) { return ""; }
  }
  /* مصدر سعر التوصيل: أسعار الشركة المفعّلة (الافتراضية في الإعدادات) أو أسعار المناطق؛ يظهر فقط إن كان تسعير الشركة فعّالاً */
  function psHtml(ad, fld) { let st = null; try { st = ad.pricingState && ad.pricingState(); } catch (e) {} if (!st || !st.company) return ""; return fld("مصدر سعر التوصيل", `<select id="mo-ps"><option value="co" selected>أسعار ${esc(st.name || "الشركة")} المفعّلة (الافتراضية)</option><option value="zones">أسعار المناطق (من إعدادات الموقع)</option></select>`); }
  function fromOpts(ad) { const d = fromDef(ad); return W().filter(x => !x.par).slice().sort((a, b) => a.id - b.id).map(w => `<option value="${esc(w.name)}"${w.name === d ? " selected" : ""}>${w.id} — ${esc(w.name)}${w.name === d ? " (الافتراضية)" : ""}</option>`).join(""); }
  const offLabel = o => (num(o.free) > 0 ? (num(o.qty) - num(o.free)) + " + " + num(o.free) + " مجاناً" : num(o.qty) + (num(o.qty) === 1 ? " قطعة" : " قطع")) + " — " + num(o.price).toLocaleString("fr-DZ") + " دج";
  function offerIdx(l, ofs) {
    if (l.offer != null && ofs[l.offer]) return l.offer;
    let i = ofs.findIndex(o => num(o.qty) === num(l.qty) && Math.abs(amtOf(l) - num(o.price)) <= 1); if (i >= 0) return i;
    return ofs.findIndex(o => { const m = num(l.qty) / num(o.qty); return m > 1 && m === Math.round(m) && Math.abs(amtOf(l) - num(o.price) * m) <= 1; });   /* مضاعفات العرض (عدد العروض) */
  }
  function open(opt) {
    const ad = A(); if (!ad) return; opt = opt || {}; const mode = opt.mode || "new", src = opt.order || null;
    if (mode === "edit" && (!src || !(ad.canFullEdit ? ad.canFullEdit(src) : (src.status === "nouvelle" && !(ad.trackingOf && ad.trackingOf(src)))))) { toast("التعديل الكامل متاح للطلب غير المرسَل، أو المرسَل ما دام الطرد في مرحلة التحضير عند الشركة — غير ذلك استعمل «✏️ تعديل»"); return; }
    let bg = document.getElementById("mo-bg"); if (bg) bg.remove(); bg = document.createElement("div"); bg.id = "mo-bg"; bg.className = "modal-bg open"; bg.dir = "rtl";
    const P = prodOpts(), wil = W().slice().sort((a, b) => a.id - b.id).filter(x => !(A() && A().wilHidden && A().wilHidden(x)) || (src && x.name === src.wilaya)), fld = (l, h, s) => `<div class="field" style="margin-bottom:.5rem;${s || ""}"><label style="font-weight:800;font-size:.82rem">${l}</label>${h}</div>`;
    let lines = src ? parseLines(ad.itemsDisplay ? ad.itemsDisplay(src) : src.items).map(l => Object.assign({ slug: ((P.find(p => p.title === l.title) || (ad.products || []).find(p => p.title === l.title || l.title.startsWith(p.title + " — "))) || {}).slug || "" }, l)) : [];
    if (!lines.length) lines = [{ slug: "", title: "", qty: 1, price: 0 }];
    const ttl = mode === "edit" ? "✏️ تعديل الطلب " + esc(src.id) : mode === "copy" ? "📄 نسخ كطلب جديد" : "➕ طلب يدوي جديد";
    bg.innerHTML = `<div class="modal" style="width:min(1020px,96vw);max-width:min(1020px,96vw);position:relative"><button type="button" class="ord-x" id="mo-x" title="إغلاق" aria-label="إغلاق">✕</button><h3 style="margin:0 0 .4rem;padding-inline-end:2.4rem">${ttl}</h3>
<style>@media(max-width:700px){#mo-bg .mo-g{grid-template-columns:1fr!important}#mo-bg .mo-g>div:empty{display:none}#mo-bg .mo-g>div,#mo-bg .mo-g>.field{grid-column:1/-1!important}#mo-bg #mo-ph2 button{width:100%}}</style><p class="hint" style="margin:.1rem 0 .7rem">${mode === "copy" ? "نُسخت بيانات الطلب <b dir=\"ltr\">" + esc(src.id) + "</b> إلى طلب جديد غير مسجَّل لدى الشركة؛ عدّل ما تريد ثم احفظ. يظهر «في انتظار التأكيد» ويمرّ بنفس مسار الطلبات." : mode === "edit" ? (ad.trackingOf && ad.trackingOf(src) ? "الطرد عند الشركة ما زال في التحضير: يمكن تعديل كل البيانات بما فيها المنتجات والهاتف، ويُصحَّح المخزون ويُحدَّث الطرد عند الحفظ." : "هذا الطلب غير مرسَل إلى الشركة، فيمكن تعديل كل بياناته بما فيها المنتجات والهاتف.") : "يُسجَّل الطلب «في انتظار التأكيد» ويمرّ بنفس مسار أي طلب (اتصال، تأكيد، إرسال لشركة التوصيل…)."}</p>
${mode === "edit" ? "" : '<div style="margin:.1rem 0 .7rem"><label class="small gray" style="display:inline-flex;gap:.4rem;align-items:center;cursor:pointer;padding:.5rem .9rem;border-radius:12px;border:1px dashed rgba(255,255,255,.4);font-weight:800">📷 املأ البيانات من لقطة شاشة محادثة الزبون<input type="file" accept="image/*" multiple id="mo-ocr-f" style="display:none"></label><div class="hint" id="mo-ocr-m" style="margin-top:.3rem">ارفع لقطة (أو لقطتين) من محادثة الزبون فيُلتقط الاسم والهاتف والولاية والبلدية والمنتج ويُدخَل في الحقول لتراجعه قبل الحفظ. تُرسَل اللقطة لخدمة الذكاء وتستهلك رصيداً صغيراً.</div></div>'}
<div class="mo-g" style="display:grid;grid-template-columns:1fr 1fr;gap:0 .7rem">${fld("الاسم واللقب", `<input id="mo-name" value="${esc(src ? src.name : "")}" placeholder="مثال: محمد بن علي">`)}${fld("الهاتف", `<input id="mo-phone" dir="ltr" inputmode="tel" value="${esc(src ? src.phone : "")}" placeholder="05XXXXXXXX">`)}
<div></div><div id="mo-ph2" style="margin-bottom:.5rem">${(src && src.extra && src.extra["📞 هاتف 2"]) ? ph2Row(src.extra["📞 هاتف 2"]) : ph2Add()}</div>
<div id="mo-blw" class="hidden" style="grid-column:1/-1;margin:.2rem 0 .6rem;padding:.55rem .7rem;border-radius:12px;border:1.5px solid #dc3545;background:rgba(220,53,69,.12);font-weight:800;color:#ff8a94"></div>${fld("الولاية", `<select id="mo-wil">${wil.map(w => `<option value="${esc(w.name)}"${src && w.name === src.wilaya ? " selected" : ""}>${w.id} — ${esc(w.name)}</option>`).join("")}${src && src.wilaya && !wOf(src.wilaya) ? `<option value="${esc(src.wilaya)}" selected>${esc(src.wilaya)}</option>` : ""}</select>`)}${fld("البلدية", `<select id="mo-com"></select>`)}
<div id="mo-cow" class="hidden" role="alert" style="grid-column:1/-1;margin:.2rem 0 .4rem;padding:.5rem .7rem;border-radius:12px;border:1.5px solid #ffc107;background:rgba(255,193,7,.12);font-weight:800;color:#ffd45e"></div>${fld("طريقة التوصيل", `<div style="display:flex;gap:1rem;flex-wrap:wrap"><label><input type="radio" name="mo-dt" value="home"${!src || src.dtype !== "stop" ? " checked" : ""}> إلى المنزل</label><label><input type="radio" name="mo-dt" value="stop"${src && src.dtype === "stop" ? " checked" : ""}> مكتب Stop Desk</label></div>`)}<div id="mo-deskw">${fld("المكتب", `<select id="mo-desk"></select>`)}</div>${mode === "edit" ? "" : psHtml(ad, fld)}${mode === "edit" ? "" : fld("ولاية الانطلاق", `<select id="mo-from">${fromOpts(ad)}</select><small class="hint">الافتراضية من إعدادات شركة التوصيل — غيّرها إن كانت البضاعة ستُرسل من مخزن في ولاية أخرى</small>`)}</div>
<div style="font-weight:800;margin:.4rem 0 .3rem">المنتجات</div><div id="mo-lines" style="overflow:auto"></div><div style="margin:.3rem 0 .6rem"><button type="button" class="small gray" id="mo-add">➕ إضافة منتج</button></div>
<div class="mo-g" style="display:grid;grid-template-columns:1fr 1fr;gap:0 .7rem">${fld("رسم التوصيل (دج)", `<input id="mo-fee" type="number" min="0" step="50" value="${src ? num(src.fee) : 0}"><small id="mo-fh" style="white-space:pre-line" class="hint"></small>`)}${fld("الخصم (دج)", `<input id="mo-disc" type="number" min="0" step="50" value="${src ? num(src.discount) : 0}">`)}</div>
${fld("ملاحظة (اختياري)", `<input id="mo-note" value="" placeholder="تظهر في ملاحظات الطلب">`)}${xchHtml(ad, mode, fld)}${optHtml(ad, mode)}
<div style="display:flex;justify-content:space-between;align-items:center;margin:.3rem 0 .8rem;font-weight:900"><span>سعر المنتجات <span id="mo-sub"></span></span><span style="display:flex;align-items:center;gap:.4rem">الإجمالي (دج) <input id="mo-tot-in" type="number" min="0" step="50" inputmode="numeric" style="width:8.5rem!important;font-weight:900;color:var(--green)" title="عدّل الإجمالي: يتغيّر سعر المنتجات ويبقى رسم التوصيل ثابتاً"><span id="mo-tot" hidden></span></span></div>
<div class="hint" style="margin:-.5rem 0 .7rem">تعديل الإجمالي يغيّر سعر المنتجات، ويبقى رسم التوصيل ثابتاً.</div>
<div id="mo-err" role="alert" hidden style="margin:.4rem 0;padding:.5rem .7rem;border-radius:12px;font-weight:800;background:rgba(127,29,29,.88);color:#fecaca;border:1px solid rgba(252,165,165,.7)"></div>
<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="small green" id="mo-save">${mode === "edit" ? "💾 حفظ التعديل" : "💾 حفظ الطلب"}</button><button type="button" class="small warn" id="mo-no">إلغاء</button></div></div>`;
    document.body.appendChild(bg);
    if (opt.hint) { const h = bg.querySelector(".hint"); if (h) h.textContent = String(opt.hint).slice(0, 300); }       // نص إرشادي مخصّص (مثلاً عند النقل من مركز المتاجر)
    const $ = id => bg.querySelector("#" + id), dt = () => (bg.querySelector('input[name="mo-dt"]:checked') || {}).value || "home";
    function fillCom(keep) { const w = wOf($("mo-wil").value), cur = keep == null ? (src && src.commune) : keep; $("mo-com").innerHTML = WilKids.html(w, cur); }
    function coWarn() {      /* احتياجات شركة التوصيل الافتراضية: ولاية/بلدية لا توصّل إليها (تمنع الحفظ) */
      const cf = ad.coForm ? ad.coForm() : null, box = $("mo-cow"); if (!box) return ""; let m = "";
      if (cf) { const w = ad.wCo ? ad.wCo($("mo-wil").value) : wOf($("mo-wil").value); if (w && cf.wilayaOff(w)) m = "شركة التوصيل الافتراضية (" + cf.name + ") لا تخدم ولاية " + w.name + " — اختر شركة أخرى لهذا الطلب أو غيّر الولاية"; else if (w && cf.communeOff(w, $("mo-com").value)) m = "شركة التوصيل الافتراضية (" + cf.name + ") لا توصّل إلى بلدية " + $("mo-com").value + " — اختر بلدية قريبة أو شركة أخرى"; }
      box.textContent = m ? "⚠️ " + m : ""; box.classList.toggle("hidden", !m); return m;
    }
    function fillDesk(keep) {
      const w = ad.wCo ? ad.wCo($("mo-wil").value) : wOf($("mo-wil").value), com = $("mo-com").value, cf = ad.coForm ? ad.coForm() : null;
      let ds = ad.desksIn ? ad.desksIn(w, com) : ((w && w.desks) || []);
      if (cf && cf.centers && w) { const nzc = x => String(ad.normName ? ad.normName(x) : x), cs = cf.centers.filter(c => c.wilaya_id === w.id && (!com || nzc(c.commune) === nzc(com))); ds = cs.map(c => ({ name: c.name, commune: c.commune })); }      // مكاتب الشركة الافتراضية نفسها
      const cur = keep == null ? (src && src.desk) : keep, has = ds.length > 0 && !(cf && cf.noStop);
      $("mo-desk").innerHTML = (has ? "" : `<option value="">${cf && cf.noStop ? "شركة التوصيل " + esc(cf.name) + " لا تدعم Stop Desk" : com ? "لا يوجد مكتب Stop Desk في بلدية " + esc(com) : "لا توجد مكاتب معروفة لهذه الولاية"}</option>`) + (has && cur && !ds.some(d => d.name === cur) ? "" : "") + (has ? ds : []).map(d => `<option value="${esc(d.name)}"${d.name === cur ? " selected" : ""}>${esc(d.name)}${d.commune ? " — " + esc(d.commune) : ""}</option>`).join("");
      const sr = bg.querySelector('input[name="mo-dt"][value="stop"]'); if (sr) { sr.disabled = !has; sr.parentElement.style.opacity = has ? "" : ".45"; sr.parentElement.title = has ? "" : (cf && cf.noStop ? "شركة التوصيل الافتراضية (" + cf.name + ") لا تتيح مكاتب Stop Desk — التوصيل للمنزل فقط" : "لا يوجد مكتب Stop Desk في هذه البلدية — التوصيل للمنزل فقط"); if (!has && sr.checked) { bg.querySelector('input[name="mo-dt"][value="home"]').checked = true; } }
      $("mo-deskw").style.display = dt() === "stop" ? "" : "none"; coWarn();
    }
    const total = () => { const c = calc(lines, $("mo-fee").value, $("mo-disc").value); $("mo-sub").textContent = c.sub.toLocaleString("fr-DZ") + " دج"; $("mo-tot").textContent = c.total.toLocaleString("fr-DZ") + " دج"; const ti = $("mo-tot-in"); if (ti && document.activeElement !== ti) ti.value = c.total; };
    const ffFail = {};
    function autoFee() {
      const w = wOf($("mo-wil").value), zn = $("mo-ps") && $("mo-ps").value === "zones", q = w && ad.shipFeeFor ? ad.shipFeeFor(w, $("mo-com").value, dt(), zn) : { fee: w ? num(dt() === "stop" ? w.stop : w.home) : 0, base: 0, sup: 0 }; let base = q.fee, note = zn ? " (أسعار المناطق من الإعدادات)" : (ad.feeNote ? ad.feeNote(q, $("mo-com").value) : "");
      /* ولاية انطلاق غير الافتراضية ← تعريفة ياليدين لذلك الزوج (انطلاق، وجهة) بدل سعر الولاية الافتراضي */
      const fe = $("mo-from"), fw = fe && fe.value && fe.value !== fromDef(ad) ? wOf(fe.value) : null;
      if (w && fw && $("mo-com").value && ad.fromFeeFor) {
        const v = ad.fromFeeFor(fw.id, w, $("mo-com").value, dt()), key = fw.id + "-" + (w.par || w.id);
        if (v != null) { base = v; note = " (تعريفة ياليدين من " + fw.name + ")"; }
        else if (!ffFail[key] && ad.ensureFromFees) { ad.ensureFromFees(fw.id, w).then(okk => { if (!okk) ffFail[key] = true; if (document.body.contains(bg)) autoFee(); }); note = " ⏳ جارِ جلب تعريفة الانطلاق من " + fw.name + "…"; }
        else note = " — تعذّر جلب تعريفة الانطلاق من " + fw.name + " فحُسب الرسم من الولاية الافتراضية";
      }
      if (!src || $("mo-wil").value !== src.wilaya || $("mo-com").value !== src.commune || dt() !== (src.dtype === "stop" ? "stop" : "home")) { $("mo-fee").value = base; $("mo-fh").textContent = w ? "رسم التوصيل: " + base.toLocaleString("fr-DZ") + " دج" + note : ""; } total();
    }
    function drawLines() {
      const th = 'style="text-align:right;padding:.2rem;white-space:nowrap"';
      $("mo-lines").innerHTML = `<style>#mo-lines .mo-cap,#mo-lines .mo-di{display:none}@media(max-width:640px){#mo-lines table{min-width:0!important}#mo-lines tr:first-child{display:none}#mo-lines tr[data-i]{display:grid;grid-template-columns:1fr;gap:.25rem .5rem;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:.5rem;margin-bottom:.5rem}#mo-lines tr[data-i]>td{display:block;padding:.1rem!important}#mo-lines tr[data-i]>td:first-child{grid-column:1/-1}#mo-lines input,#mo-lines select{max-width:none!important;width:100%}#mo-lines .mo-cap{display:block;font-size:.76rem;font-weight:800;margin:.1rem 0 .15rem;opacity:.9}#mo-lines .mo-di{display:inline}#mo-lines tr[data-i]>td:last-child{grid-column:1/-1}#mo-lines [data-f=del]{width:100%}}</style><table style="width:100%;border-collapse:collapse;min-width:820px"><tr><th ${th}>المنتج</th><th ${th}>الكمية</th><th ${th}>سعر العلبة (دج)</th><th ${th}>المجموع</th><th></th></tr>` + lines.map((l, i) => {
        const known = P.some(p => p.title === l.title && p.slug === l.slug), po = known ? P.find(p => p.title === l.title && p.slug === l.slug) : null, ofs = (po && po.offers) || [], oi = offerIdx(l, ofs); if (oi >= 0 && l.oc == null) { const m = Math.round(num(l.qty) / num(ofs[oi].qty)); l.oc = m >= 1 && Math.abs(amtOf(l) - num(ofs[oi].price) * m) <= 1 ? m : 1; }
        const offSel = ofs.length ? `<span class="mo-cap">العرض</span><select data-f="offer" style="margin-top:.2rem"><option value=""${oi < 0 ? " selected" : ""}>بدون عرض — سعر عادي</option>${ofs.map((o, k) => `<option value="${k}"${k === oi ? " selected" : ""}>${esc(offLabel(o))}</option>`).join("")}</select>${oi >= 0 ? `<label style="display:flex;align-items:center;gap:.4rem;margin-top:.2rem;font-size:.82rem;font-weight:800">عدد العروض <input data-f="oc" type="number" min="1" step="1" value="${l.oc || 1}" style="max-width:80px"></label>` : ""}` : "";
        return `<tr data-i="${i}"><td style="padding:.2rem"><span class="mo-cap">المنتج</span><select data-f="sel"><option value="">اختر المنتج…</option>${P.map((p, k) => `<option value="${k}"${known && p.title === l.title ? " selected" : ""}>${esc(p.name || p.title)}${p.name && p.name !== p.title ? " ← " + esc(p.title) : ""}</option>`).join("")}<option value="x"${!known && l.title ? " selected" : ""}>✎ منتج آخر…</option></select>${!known && l.title !== "" || l.__x ? `<span class="mo-cap">اسم المنتج</span><input data-f="title" value="${esc(l.title)}" placeholder="اسم المنتج" style="margin-top:.2rem">` : ""}${offSel}</td><td style="padding:.2rem"><span class="mo-cap">الكمية</span><input data-f="qty" type="number" min="1" step="1" value="${l.qty}" style="min-width:76px;max-width:96px"${oi >= 0 ? " readonly title=\"الكمية = عدد قطع العرض × عدد العروض\"" : ""}></td><td style="padding:.2rem"><span class="mo-cap">سعر العلبة (دج)</span><input data-f="price" type="number" min="0" step="50" value="${l.price}" style="min-width:128px;max-width:160px"></td><td style="padding:.2rem"><span class="mo-cap">المجموع النهائي (دج)</span><input data-f="amt" type="number" min="0" step="50" value="${amtOf(l)}" title="السعر النهائي للسطر — يمكن تعديله مباشرة" style="min-width:136px;max-width:170px;font-weight:800"></td><td style="padding:.2rem"><button type="button" class="small warn" data-f="del" title="حذف المنتج">🗑<span class="mo-di"> حذف المنتج</span></button></td></tr>`;
      }).join("") + "</table>";
    }
    fillCom(); fillDesk(); drawLines(); total(); if (!src) autoFee();
    /* خانة الهاتف (v1.89.704): عند اللصق/الخروج يُستخرج الرقم وحده من أي نص، وتُنزع النقاط والشرطات والمسافات بين الأرقام */
    { const bw = () => { const w = $("mo-blw"), a = A(); if (!w || !a || !a.blockHit) return; const h = mode === "edit" ? null : a.blockHit($("mo-phone").value, $("mo-name").value); if (!h) { w.classList.add("hidden"); w.textContent = ""; return; } const e = h.entry; w.classList.remove("hidden"); w.textContent = (e.state === "pending" ? "⚠️ هذا " : "⛔ هذا ") + (h.by === "name" ? "الاسم" : "الهاتف") + (e.state === "pending" ? " في القائمة السوداء بانتظار المراجعة" : " محظور — في القائمة السوداء") + (e.reason ? " (" + e.reason + ")" : "") + (e.state === "pending" ? "" : ": لا يستطيع الطلب من الموقع"); };
      ["mo-phone", "mo-name"].forEach(id => { const el = $(id); if (el) { el.addEventListener("input", bw); el.addEventListener("change", bw); } }); setTimeout(bw, 0); }
    { const xc = $("mo-xch"); if (xc) xc.onchange = () => { const w = $("mo-xchw"); if (w) w.classList.toggle("hidden", !xc.checked); if (xc.checked && $("mo-xcht")) $("mo-xcht").focus(); }; }
    { const w2 = $("mo-ph2"), wire = () => { const add = $("mo-ph2add"), del = $("mo-ph2del"), i2 = $("mo-phone2"); if (add) add.onclick = () => { w2.innerHTML = ph2Row(""); wire(); $("mo-phone2").focus(); }; if (del) del.onclick = e => { e.preventDefault(); w2.innerHTML = ph2Add(); wire(); };
        if (i2) { i2.addEventListener("input", () => { const c = i2.value.replace(/[^0-9+]/g, ""); if (c !== i2.value) i2.value = c; }); i2.addEventListener("paste", e => { const t = (e.clipboardData || window.clipboardData).getData("text"); if (!t) return; e.preventDefault(); i2.value = ManualOrder.cleanPhone(t); }); i2.addEventListener("change", () => { i2.value = ManualOrder.cleanPhone(i2.value); }); } };
      if (w2) wire(); }
    { const ph = $("mo-phone"); if (ph) {
      const fix = t => ManualOrder.cleanPhone(t);
      ph.addEventListener("paste", e => { const t = (e.clipboardData || window.clipboardData).getData("text"); if (!t) return; e.preventDefault(); ph.value = fix(t); ph.dispatchEvent(new Event("input", { bubbles: true })); });
      ph.addEventListener("change", () => { ph.value = fix(ph.value); });
      ph.addEventListener("input", () => { const c = ph.value.replace(/[^0-9+]/g, ""); if (c !== ph.value) ph.value = c; });      // الهاتف أرقام فقط
    } }
    $("mo-wil").onchange = () => { fillCom(""); fillDesk(""); autoFee(); };
    if (ad.shipSupLoad) ad.shipSupLoad().then(() => { if (!src && document.body.contains(bg)) autoFee(); });
    bg.querySelectorAll('input[name="mo-dt"]').forEach(r => r.onchange = () => { fillDesk($("mo-desk").value); autoFee(); });
    $("mo-com").onchange = () => { WilKids.pick($("mo-wil"), $("mo-com")); fillDesk(""); autoFee(); }; if ($("mo-from")) $("mo-from").onchange = () => autoFee(); if ($("mo-ps")) $("mo-ps").onchange = () => autoFee(); $("mo-fee").oninput = total; $("mo-disc").oninput = total;

    /* الإجمالي قابل للتعديل: يُعاد توزيعه على أسعار المنتجات (بالنسبة)، ورسم التوصيل والخصم ثابتان */
    function applyTotal() {
      const inp = $("mo-tot-in"), back = () => { total(); if (inp) inp.value = calc(lines, $("mo-fee").value, $("mo-disc").value).total; }; if (!inp || inp.value === "") { back(); return; }
      const T = num(inp.value), fee = num($("mo-fee").value), disc = num($("mo-disc").value), its = lines.filter(l => String(l.title).trim() && num(l.qty) > 0);
      if (!its.length) { toast("⚠️ أضف منتجاً أولاً ثم عدّل الإجمالي"); back(); return; }
      if (T < fee) { toast("⚠️ الإجمالي أقل من رسم التوصيل (" + fee + " دج)"); back(); return; }
      const need = T - fee + disc, cur = its.reduce((a, l) => a + amtOf(l), 0); let left = need;
      its.forEach((l, i) => { const a = i === its.length - 1 ? Math.max(0, left) : Math.max(0, cur > 0 ? Math.round(amtOf(l) * need / cur) : (i === 0 ? need : 0)); l.amt = a; l.price = Math.round(a / Math.max(1, num(l.qty))); left -= a; });
      drawLines(); total();
    }
    { const ti = $("mo-tot-in"); if (ti) { ti.addEventListener("change", applyTotal); ti.addEventListener("keydown", e => { if (String(e.key || "") === "Enter") { e.preventDefault(); applyTotal(); ti.blur(); } }); } }
    /* التقاط بيانات الزبون من لقطة محادثة (رؤية الذكاء) وملء الحقول */
    const nz = t => String(t || "").normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
    const lat = t => String(t == null ? "" : t).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
    function pickProduct(q) { const qt = nz(q).split(" ").filter(w => w.length >= 2); if (!qt.length) return null; let best = null, bs = 0, tie = false; P.forEach(p => { const tt = nz((p.title || "") + " " + (p.name || "")); const sc = qt.filter(w => tt.includes(w)).length; if (sc > bs) { bs = sc; best = p; tie = false; } else if (sc === bs && sc > 0 && best && best.slug !== p.slug) tie = true; }); return bs >= 1 && !tie ? best : null; }
    const ocrF = $("mo-ocr-f");
    if (ocrF) ocrF.onchange = async () => {
      const msg = $("mo-ocr-m"), fl = Array.from(ocrF.files || []).filter(f => /^image\//.test(f.type)).slice(0, 3); ocrF.value = ""; if (!fl.length) return;
      if (typeof ImgGen === "undefined" || !ImgGen.text) { msg.textContent = "⚠️ أداة الذكاء غير متاحة"; return; }
      let cr = null; try { cr = (typeof Credits !== "undefined" && Credits.take) ? Credits.take("text", { n: 1, label: "التقاط بيانات الطلب من لقطة", pending: true }) : null; } catch (e) { msg.textContent = "⚠️ " + (e.message || e); return; }
      msg.textContent = "⏳ نقرأ اللقطة…"; let ok = false;
      try {
        const prompt = "You read screenshot(s) of a chat between an online store and a customer in Algeria (WhatsApp, Messenger, Instagram or SMS). Extract what the CUSTOMER wrote for an order. Never invent: use an empty string or null when something is not visible. Convert Arabic-Indic digits to Latin digits. If several people appear, use the customer, not the store. Answer in JSON only: {\"name\": customer full name, \"phone\": Algerian phone digits only (e.g. 0550123456), \"phone2\": second phone or empty, \"wilaya_id\": official Algerian wilaya number 1-58 as integer or null, \"wilaya\": wilaya name in French/Latin spelling as in the official list, \"commune\": commune in French/Latin spelling, \"delivery\": \"home\" or \"stop\" (office) or \"\", \"product\": what the customer wants to buy, as written, \"qty\": integer or null, \"note\": any other useful detail for delivery (short, Arabic), \"confidence\": 0-1}.";
        const j = await ImgGen.text({ blobs: fl, json: true, temp: .1, noThink: true, maxTokens: 1500, timeoutMs: 60000, maxModels: 4, edge: 1600, prompt });
        const got = []; const setv = (el, v) => { if (!el || v == null || v === "") return false; el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.style.outline = "2px solid #e2fe17"; setTimeout(() => { el.style.outline = ""; }, 4000); return true; };
        const nm = String(j.name || "").trim(); if (nm.length >= 2 && setv($("mo-name"), nm)) got.push("الاسم");
        const ph = ManualOrder.cleanPhone(lat(j.phone)); if (ph && setv($("mo-phone"), ph)) got.push("الهاتف");
        const p2 = ManualOrder.cleanPhone(lat(j.phone2)); if (p2 && p2 !== ph) { const add = $("mo-ph2add"); if (add) add.click(); if (setv($("mo-phone2"), p2)) got.push("هاتف ثانٍ"); }
        let w = null; const wid = Number(lat(j.wilaya_id)); if (wid) w = W().find(x => Number(x.id) === wid) || null; if (!w && j.wilaya) { const q = nz(j.wilaya); w = W().find(x => nz(x.name) === q) || W().find(x => q && nz(x.name).includes(q)) || null; }
        if (w) { const so = Array.from($("mo-wil").options).find(o => o.value === w.name); if (so) { setv($("mo-wil"), w.name); got.push("الولاية"); } }
        if (j.commune) { await new Promise(r => setTimeout(r, 120)); const q = nz(j.commune), co = Array.from($("mo-com").options).find(o => nz(o.value) === q) || Array.from($("mo-com").options).find(o => q && nz(o.value) && (nz(o.value).includes(q) || q.includes(nz(o.value)))); if (co && co.value) { setv($("mo-com"), co.value); got.push("البلدية"); } }
        if (j.delivery === "stop" || j.delivery === "home") { const r = bg.querySelector('input[name="mo-dt"][value="' + j.delivery + '"]'); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); got.push("طريقة التوصيل"); } }
        const pr = j.product ? pickProduct(j.product) : null; let extra = "";
        if (pr) { const q = Math.max(1, Math.round(Number(lat(j.qty)) || 1)), i0 = lines.findIndex(l => !String(l.title).trim()); const L = { slug: pr.slug, title: pr.title, qty: q, price: pr.price }; if (i0 >= 0) lines[i0] = L; else lines.push(L); drawLines(); total(); got.push("المنتج"); } else if (j.product) extra = "المنتج المطلوب: " + String(j.product).trim();
        const nt = [extra, String(j.note || "").trim()].filter(Boolean).join(" · "); if (nt) { const ne = $("mo-note"); ne.value = ((ne.value ? ne.value + " · " : "") + nt).slice(0, 300); got.push("ملاحظة"); }
        if (!got.length) msg.textContent = "⚠️ لم نجد بيانات واضحة في اللقطة — جرّب لقطة أوضح أو أدخلها يدوياً."; else { msg.textContent = "✅ التُقط: " + got.join("، ") + " — راجع الحقول المُلوَّنة قبل الحفظ." + (pr ? "" : (j.product ? " (لم نتعرّف على المنتج، أُضيف للملاحظة)" : "")); ok = true; }
      } catch (e) { msg.textContent = "⚠️ " + (e && e.code === "OFF" ? "أدوات الذكاء معطّلة من الشريط العلوي" : (e.message || e)); }
      try { if (cr) { if (ok) { if (cr.commit) cr.commit(); } else cr.refund(); } } catch (e) { }
    };
    $("mo-add").onclick = () => { lines.push({ slug: "", title: "", qty: 1, price: 0 }); drawLines(); total(); };
    $("mo-lines").addEventListener("input", e => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; const l = lines[+tr.dataset.i], f = e.target.dataset.f; if (f === "qty") { l.qty = Math.max(1, num(e.target.value)); if (l.offer != null || l.amt != null) { const pr = P.find(p => p.title === l.title && p.slug === l.slug); delete l.amt; delete l.offer; delete l.free; if (pr) { l.price = pr.price; tr.querySelector('input[data-f="price"]').value = pr.price; } const os = tr.querySelector('select[data-f="offer"]'); if (os) os.value = ""; } }   /* تعديل الكمية يدوياً يلغي العرض ويعيد سعر العلبة العادي (لا 1067 المقرَّب من العرض) */ else if (f === "price") { l.price = num(e.target.value); delete l.amt; delete l.offer; } else if (f === "amt") { l.amt = Math.max(0, num(e.target.value)); l.price = Math.round(l.amt / Math.max(1, num(l.qty))); tr.querySelector('input[data-f="price"]').value = l.price; } else if (f === "title") l.title = e.target.value; else if (f === "oc") { const pr = P.find(p => p.title === l.title && p.slug === l.slug), o = pr && pr.offers[l.offer]; if (!o) return; l.oc = Math.max(1, Math.round(num(e.target.value))); l.qty = num(o.qty) * l.oc; l.amt = num(o.price) * l.oc; l.free = num(o.free) * l.oc; tr.querySelector('input[data-f="qty"]').value = l.qty; } else return; if (f !== "amt") tr.querySelector('input[data-f="amt"]').value = amtOf(l); total(); });
    $("mo-lines").addEventListener("change", e => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; const l = lines[+tr.dataset.i], v = e.target.value;
      if (e.target.dataset.f === "offer") { const pr = P.find(p => p.title === l.title && p.slug === l.slug), o = pr && pr.offers[+v]; if (v === "" || !o) { l.qty = 1; l.price = pr ? pr.price : l.price; delete l.amt; delete l.offer; delete l.oc; delete l.free; } else { l.oc = 1; l.qty = num(o.qty); l.amt = num(o.price); l.price = Math.round(num(o.price) / num(o.qty)); l.offer = +v; l.free = num(o.free); } drawLines(); total(); return; }
      if (e.target.dataset.f !== "sel") return; delete l.amt; delete l.offer; delete l.free; l.qty = 1; if (v === "x") { l.slug = ""; l.__x = true; l.title = l.title || ""; } else if (v === "") { l.slug = ""; l.title = ""; l.price = 0; delete l.__x; } else { const p = P[+v]; l.slug = p.slug; l.title = p.title; l.price = p.price; delete l.__x; } drawLines(); total(); });
    $("mo-lines").addEventListener("click", e => { const b = e.target.closest('[data-f="del"]'); if (!b) return; const i = +b.closest("tr").dataset.i; lines.splice(i, 1); if (!lines.length) lines.push({ slug: "", title: "", qty: 1, price: 0 }); drawLines(); total(); });
    const close = () => bg.remove(); $("mo-x").onclick = close; $("mo-no").onclick = close; bg.addEventListener("click", e => { if (e.target === bg) close(); });
    $("mo-save").onclick = async () => {
      const say = m => { const e = $("mo-err"); if (e) { e.textContent = String(m).replace(/^[⚠️❌✅\s]+/u, ""); e.hidden = false; e.scrollIntoView && e.scrollIntoView({ block: "nearest" }); } toast(m); }; { const e0 = $("mo-err"); if (e0) e0.hidden = true; }
      const name = $("mo-name").value.trim(), phone = normDz($("mo-phone").value), items = lines.filter(l => String(l.title).trim() && num(l.qty) > 0);
      if (name.length < 2) { say("⚠️ أدخل اسم الزبون"); return; } if (!validPhone(phone)) { say("⚠️ رقم الهاتف غير صحيح: 10 أرقام تبدأ بـ 05 أو 06 أو 07 (أو رقم ثابت بـ 9 أرقام)"); const pe = document.getElementById("mo-phone"); if (pe) pe.focus(); return; } if (!items.length) { say("⚠️ أضف منتجاً واحداً على الأقل"); return; }
      const dtp = dt(), desk = dtp === "stop" ? $("mo-desk").value : ""; if (dtp === "stop" && !desk) { say("⚠️ اختر مكتب Stop Desk"); return; }
      { const cw = coWarn(); if (cw && mode !== "edit") { say("⚠️ " + cw); return; } }
      const c = calc(items, $("mo-fee").value, $("mo-disc").value), b = $("mo-save"); b.disabled = true; const lab = b.textContent; b.textContent = "جارٍ الحفظ…";
      const clean = items.map(l => ({ slug: l.slug || "", title: String(l.title).trim().slice(0, 160), qty: num(l.qty), price: num(l.price) })), txt = textOf(items.map(l => ({ title: String(l.title).trim().slice(0, 160), qty: num(l.qty), price: num(l.price), amt: amtOf(l) }))), offTxt = items.filter(l => l.offer != null || num(l.free) > 0).map(l => { const oc = Math.max(1, num(l.oc) || 1), q1 = l.qty / oc, f1 = num(l.free) / oc; return "عرض " + q1 + " قطع" + (f1 > 0 ? " (" + (q1 - f1) + " + " + f1 + " مجاناً)" : "") + (oc > 1 ? " × " + oc + " (المجموع " + l.qty + " قطع)" : "") + " بسعر " + amtOf(l); }).join(" ؛ ");
      try {
        if (mode === "edit") {
          const fdb = { name, phone, wilaya: $("mo-wil").value, commune: $("mo-com").value, dtype: dtp, desk, subtotal: c.sub, discount: c.disc, fee: c.fee, total: c.total, items: clean, items_text: txt };
          const note = $("mo-note").value.trim(); if (note) { src.note = (String(src.note || "") + " " + note).trim(); API.updateOrder(ad.key, src.id, undefined, src.note); }
          /* مخزون: إن كانت علب الطلب مخصومة (وسم 📦) تُعاد بالقديم ثم تُخصم بالجديد حتى يبقى الفرق وحده */
          let restock = null, stockMsg = "";
          try { const W = ad._W && ad._W(), tg = W ? W.tagOf(src.note) : { has: /📦(?!livree)/.test(src.note || ""), wh: "main" }; if (tg.has && ad.moveStock) { if (!ad.stockReturnWanted || ad.stockReturnWanted(src)) { ad.moveStock(src, +1, tg.wh, "تعديل الطلب — إرجاع القديم"); restock = tg.wh; } else stockMsg = " (المخزون لم يُعدَّل: جرد يدوي سبق التأكيد)"; } } catch (e) { }
          const local = Object.assign({}, fdb, { items: txt }); delete local.items_text; Object.assign(src, local);
          if (restock !== null) { try { ad.moveStock(src, -1, restock, ""); stockMsg = " وصُحّح المخزون"; } catch (e) { } }
          if (window.OrderEdit && OrderEdit.stash) OrderEdit.stash(src.id, local);
          let saved = false; try { saved = await API.updateOrderFields(ad.key, src.id, fdb); } catch (e) { }
          if (saved && window.OrderEdit && OrderEdit.unstash) OrderEdit.unstash(src.id);
          let coMsg = ""; const tr = ad.trackingOf && ad.trackingOf(src);
          if (tr && ad.updateAtCompany) { b.textContent = "تحديث الطرد عند الشركة…"; const r = await ad.updateAtCompany(ad.orders.indexOf(src), { full: true }); coMsg = r.ok ? (r.partial ? " — " + r.msg : " وتحدّث الطرد عند الشركة") : (r.skipped ? "" : " ⚠️ تعذّر تحديث الطرد عند الشركة: " + r.msg + " — عدّله يدوياً (التتبع " + tr.tracking + ")"); if (!r.ok && !r.skipped) { try { ad.showNotice("تعذّر تحديث الطرد لدى الشركة", esc(r.msg) + "<br><small>حُفظ التعديل في اللوحة؛ عدّل الطرد " + esc(tr.tracking) + " يدوياً من حساب الشركة.</small>"); } catch (e) { } } }
          close(); ad.renderStats(); ad.renderOrders(); try { ad.openOrderPreview(ad.orders.indexOf(src)); } catch (e) { }
          toast((saved ? "✅ حُفظ تعديل الطلب" : "✅ حُفظ التعديل في اللوحة") + stockMsg + coMsg); return;
        }
        { const bh = mode === "edit" ? null : ad.blockHit(phone, name); if (bh && !window.confirm("⛔ تحذير: " + (bh.by === "name" ? "هذا الاسم" : "هذا الهاتف") + " في القائمة السوداء" + (bh.entry.reason ? " (" + bh.entry.reason + ")" : "") + ".\nهل تسجّل الطلب رغم ذلك؟")) { b.disabled = false; b.textContent = lab; return; } }
        const xchOn = !!($("mo-xch") && $("mo-xch").checked), xchTxt = xchOn ? $("mo-xcht").value.trim() : ""; if (xchOn && !xchTxt) { b.disabled = false; b.textContent = lab; say("⚠️ اكتب القطعة التي ستُسترجع من الزبون (الاستبدال)"); $("mo-xcht").focus(); return; }
        const extra = { "✍️ طلب يدوي": "نعم" }; { const p2 = $("mo-phone2") ? normDz($("mo-phone2").value) : ""; if (p2) { if (!validPhone(normDz(p2))) { b.disabled = false; b.textContent = lab; say("⚠️ الهاتف الثاني غير صحيح: 10 أرقام تبدأ بـ 05 أو 06 أو 07"); return; } if (p2 !== phone) extra["📞 هاتف 2"] = p2; } } if (xchOn) extra["🔄 استبدال"] = xchTxt; if ($("mo-frag") && $("mo-frag").checked) extra["📦 قابل للكسر"] = "نعم"; if ($("mo-open") && !$("mo-open").checked) extra["🚫 منع فتح الطرد"] = "نعم"; if (offTxt) extra["🎁 العرض"] = offTxt; { const fe = $("mo-from"); if (fe && fe.value && fe.value !== fromDef(ad)) extra["📍 ولاية الانطلاق"] = fe.value; } if (mode === "copy" && src && !opt.extra) extra["📄 نسخة من"] = String(src.id).slice(-6); if (opt.extra) Object.assign(extra, opt.extra);
        const order = { name, phone, wilaya: $("mo-wil").value, commune: $("mo-com").value, dtype: dtp, desk, items: clean, subtotal: c.sub, fee: c.fee, total: c.total, coupon: "", discount: c.disc, extra, note: $("mo-note").value.trim() };
        const r = await API.addOrder(order);
        if (!r || !r.ok) { b.disabled = false; b.textContent = lab; say("❌ تعذّر حفظ الطلب — تحقق من الاتصال وصلاحية الدخول"); return; }
        const o = { id: r.id || ("M" + Date.now().toString(36).toUpperCase()), date: new Date().toISOString(), name, phone, wilaya: order.wilaya, commune: order.commune, dtype: dtp, desk, items: txt, subtotal: c.sub, fee: c.fee, total: c.total, coupon: "", discount: c.disc, extra, status: "nouvelle", note: order.note };
        ad.orders.unshift(o); close(); if (typeof opt.onSaved === "function") { try { opt.onSaved(o); } catch (e) { } } ad.renderStats(); ad.renderOrders(); setTimeout(() => { try { ad.refreshAlerts(); } catch (e) { } }, 2500);
        toast("✅ أُضيف الطلب " + String(o.id).slice(-6) + " — في انتظار التأكيد"); return;
      } catch (e) { b.disabled = false; b.textContent = lab; say("❌ " + (e && e.message || e)); }
    };
  }
  /* يستخرج رقم الهاتف من نص مُلصَق (اسم + عنوان + رقم…): أرقام عربية ← لاتينية، يُنزع ما بين الأرقام من نقاط/شرطات/مسافات/أقواس، ويُفضَّل الرقم الجزائري (05/06/07 أو +213)؛ بلا رقم واضح يُرجع النص كما هو بلا فواصل بين الأرقام */
  /* استبدال بعد التسليم (خاصية ياليدين has_exchange/product_to_collect): يُنشئ بوردرو ثانياً لاسترجاع قطعة الزبون؛ يظهر الخيار فقط حين تكون ياليدين مفعّلة وفي الطلب الجديد */
  /* هاتف ثان اختياري: خانة إضافية بزر حذف؛ يُحفظ في extra["📞 هاتف 2"] ويُرسل لياليدين contact_phone_2 */
  function ph2Add() { return `<div style="height:100%;display:flex;align-items:flex-end"><button type="button" class="small gray" id="mo-ph2add" style="width:100%;margin:0;min-height:44px">＋ إضافة هاتف آخر</button></div>`; }
  function ph2Row(v) { return `<div class="field" style="margin:0"><label style="font-weight:800;font-size:.82rem;display:flex;justify-content:space-between;align-items:center">الهاتف 2 <a href="#" id="mo-ph2del" style="font-weight:700;color:#e5484d;text-decoration:none">حذف ✕</a></label><input id="mo-phone2" dir="ltr" inputmode="tel" value="${esc(v || "")}" placeholder="05XXXXXXXX"></div>`; }
  /* خيارات الطرد عند WeCan (أعمدة FRAGILE وAUTORISER L'OUVERTURE في لوحتهم): قابل للكسر، والسماح بفتح الطرد (الافتراضي مسموح)؛ تظهر حين تكون WeCan مفعّلة وفي الطلب الجديد */
  /* صف خيار موحَّد (مربع + نص + شرح اختياري) ليستقيم الاستبدال والكسر والفتح في عمود واحد بالمحاذاة نفسها */
  const optRow = (id, checked, text, hint) => `<label style="display:flex;gap:.6rem;align-items:${hint ? "flex-start" : "center"};margin:.4rem 0;font-weight:800;cursor:pointer"><input type="checkbox" id="${id}"${checked ? " checked" : ""} style="width:20px;height:20px;flex:none;margin:${hint ? ".1rem" : "0"} 0 0"><span style="flex:1;min-width:0">${text}${hint ? `<small class="hint" style="display:block;font-weight:400;margin-top:.1rem">${hint}</small>` : ""}</span></label>`;
  function optHtml(ad, mode) {
    if (mode === "edit" || !ad.enabledCompanyKeys || ad.enabledCompanyKeys().indexOf("wecan") < 0) return "";
    return `<div style="margin:.2rem 0 .5rem">${optRow("mo-frag", false, "📦 قابل للكسر (Fragile)")}${optRow("mo-open", true, "🔓 السماح بفتح الطرد")}</div>`;
  }
  function xchHtml(ad, mode, fld) {
    if (mode === "edit" || !ad.enabledCompanyKeys || !["yalidine", "wecan"].some(k => ad.enabledCompanyKeys().indexOf(k) >= 0)) return "";
    return `<div style="margin:.2rem 0 0">${optRow("mo-xch", false, "🔄 طلب استبدال بعد التسليم", "يُنشئ بوردرو ثانياً لاسترجاع القطعة من الزبون مع بوردرو هذا الطلب")}</div><div id="mo-xchw" class="hidden">${fld("القطعة المراد استرجاعها", `<input id="mo-xcht" maxlength="200" placeholder="مثال: كريم قديم عبوة 50 مل">`)}</div>`;
  }
  /* رقم جزائري صحيح فقط: جوال 10 أرقام (05/06/07) أو ثابت 9 أرقام (02/03/04)؛ أي طول آخر يُرفض (كان يُقبل أي نص بين 6 و20 رقماً) */
  const normDz = v => { let d = String(v == null ? "" : v).replace(/[٠-٩]/g, c => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/\D/g, ""); if (/^00213/.test(d)) d = "0" + d.slice(5); else if (/^213/.test(d) && d.length >= 12) d = "0" + d.slice(3); else if (d.length === 9 && /^[567]/.test(d)) d = "0" + d; return d; };
  const validPhone = d => /^0[567]\d{8}$/.test(d) || /^0[2-4]\d{7}$/.test(d);
  function cleanPhone(raw) {
    let t = String(raw == null ? "" : raw).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
    const seqs = (t.match(/\+?\d(?:[\d\s.\-_()·•]*\d)?/g) || []).map(x => ({ raw: x, d: x.replace(/\D/g, ""), plus: x.charAt(0) === "+" })).filter(x => x.d.length >= 9);
    const norm = x => { let d = x.d; if (/^00213/.test(d)) d = d.slice(5); else if (/^213/.test(d) && d.length >= 12) d = d.slice(3); else if (x.plus && /^213/.test(d)) d = d.slice(3); if (d.length === 9 && /^[567]/.test(d)) d = "0" + d; return d; };
    const good = seqs.map(norm).filter(d => /^0[567]\d{8}$/.test(d));
    if (good.length) return good[0];
    if (seqs.length) return norm(seqs[0]);
    return t.replace(/(\d)[\s.\-_/()·•](?=\d)/g, "$1").replace(/[^0-9+]/g, "");
  }
  return { open, parseLines, calc, textOf, fromDef, cleanPhone, validPhone, normDz };
})();
