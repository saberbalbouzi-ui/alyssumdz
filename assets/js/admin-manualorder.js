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
  function calc(lines, fee, disc) { const sub = (lines || []).reduce((a, l) => a + num(l.qty) * num(l.price), 0), d = Math.min(num(disc), sub); return { sub, disc: d, fee: num(fee), total: Math.max(0, sub - d) + num(fee) }; }
  const textOf = lines => lines.map(l => l.title + " ×" + l.qty + " = " + num(l.qty) * num(l.price) + " DA").join("\n");
  /* خيارات المنتجات: بسيط، وكل تنويعة فعّالة لمتغيّر */
  function prodOpts() {
    const ad = A(), out = []; ((ad && ad.products) || []).filter(p => p.slug !== "test" && p.active !== false).forEach(p => {
      const t = p.type;
      if (t === "variable") (p.variations || []).filter(v => v && v.active !== false).forEach(v => { const lb = ((p.attributes || []).filter(a => a.variation && v.attrs && v.attrs[a.name] != null).map(a => a.name + ": " + v.attrs[a.name]).join(" / ")); out.push({ slug: p.slug, title: (p.bord || p.title) + (lb ? " — " + lb : ""), name: p.title + (lb ? " — " + lb : ""), price: num(v.price) }); });
      else if (t !== "grouped") out.push({ slug: p.slug, title: p.bord || p.title, name: p.title, price: num(p.price) });
    });
    return out;
  }
  /* ولاية الانطلاق: الافتراضية من إعدادات الشركة المفعّلة (وإلا الجزائر)، ويمكن تغييرها لهذا الطلب وحده */
  function fromDef(ad) {
    try { const k = ad.activeCompanyKey && ad.activeCompanyKey(), cfg = (k && ad.deliveryCfg && ad.deliveryCfg[k]) || {}, want = ad.normName ? ad.normName(cfg.fromWilayaName || "Alger") : String(cfg.fromWilayaName || "alger").toLowerCase(); const w = W().find(x => !x.par && (ad.normName ? ad.normName(x.name) : String(x.name).toLowerCase()) === want); return w ? w.name : ""; } catch (e) { return ""; }
  }
  function fromOpts(ad) { const d = fromDef(ad); return W().filter(x => !x.par).slice().sort((a, b) => a.id - b.id).map(w => `<option value="${esc(w.name)}"${w.name === d ? " selected" : ""}>${w.id} — ${esc(w.name)}${w.name === d ? " (الافتراضية)" : ""}</option>`).join(""); }
  function open(opt) {
    const ad = A(); if (!ad) return; opt = opt || {}; const mode = opt.mode || "new", src = opt.order || null;
    if (mode === "edit" && (!src || src.status !== "nouvelle" || (ad.trackingOf && ad.trackingOf(src)))) { toast("التعديل الكامل متاح للطلب الجديد غير المسجَّل لدى الشركة فقط — للمؤكَّد استعمل «✏️ تعديل»"); return; }
    let bg = document.getElementById("mo-bg"); if (bg) bg.remove(); bg = document.createElement("div"); bg.id = "mo-bg"; bg.className = "modal-bg open"; bg.dir = "rtl";
    const P = prodOpts(), wil = W().slice().sort((a, b) => a.id - b.id), fld = (l, h, s) => `<div class="field" style="margin-bottom:.5rem;${s || ""}"><label style="font-weight:800;font-size:.82rem">${l}</label>${h}</div>`;
    let lines = src ? parseLines(ad.itemsDisplay ? ad.itemsDisplay(src) : src.items).map(l => Object.assign({ slug: ((P.find(p => p.title === l.title) || (ad.products || []).find(p => p.title === l.title || l.title.startsWith(p.title + " — "))) || {}).slug || "" }, l)) : [];
    if (!lines.length) lines = [{ slug: "", title: "", qty: 1, price: 0 }];
    const ttl = mode === "edit" ? "✏️ تعديل الطلب " + esc(src.id) : mode === "copy" ? "📄 نسخ كطلب جديد" : "➕ طلب يدوي جديد";
    bg.innerHTML = `<div class="modal" style="max-width:720px;position:relative"><button type="button" class="ord-x" id="mo-x" title="إغلاق" aria-label="إغلاق">✕</button><h3 style="margin:0 0 .4rem;padding-inline-end:2.4rem">${ttl}</h3>
<p class="hint" style="margin:.1rem 0 .7rem">${mode === "copy" ? "نُسخت بيانات الطلب <b dir=\"ltr\">" + esc(src.id) + "</b> إلى طلب جديد غير مسجَّل لدى الشركة؛ عدّل ما تريد ثم احفظ. يظهر «في انتظار التأكيد» ويمرّ بنفس مسار الطلبات." : mode === "edit" ? "هذا الطلب جديد وغير مسجَّل لدى الشركة، فيمكن تعديل كل بياناته بما فيها المنتجات والهاتف." : "يُسجَّل الطلب «في انتظار التأكيد» ويمرّ بنفس مسار أي طلب (اتصال، تأكيد، إرسال لشركة التوصيل…)."}</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 .7rem">${fld("الاسم واللقب", `<input id="mo-name" value="${esc(src ? src.name : "")}" placeholder="مثال: محمد بن علي">`)}${fld("الهاتف", `<input id="mo-phone" dir="ltr" inputmode="tel" value="${esc(src ? src.phone : "")}" placeholder="05XXXXXXXX">`)}
${fld("الولاية", `<select id="mo-wil">${wil.map(w => `<option value="${esc(w.name)}"${src && w.name === src.wilaya ? " selected" : ""}>${w.id} — ${esc(w.name)}</option>`).join("")}${src && src.wilaya && !wOf(src.wilaya) ? `<option value="${esc(src.wilaya)}" selected>${esc(src.wilaya)}</option>` : ""}</select>`)}${fld("البلدية", `<select id="mo-com"></select>`)}
${fld("طريقة التوصيل", `<div style="display:flex;gap:1rem;flex-wrap:wrap"><label><input type="radio" name="mo-dt" value="home"${!src || src.dtype !== "stop" ? " checked" : ""}> إلى المنزل</label><label><input type="radio" name="mo-dt" value="stop"${src && src.dtype === "stop" ? " checked" : ""}> مكتب Stop Desk</label></div>`)}<div id="mo-deskw">${fld("المكتب", `<select id="mo-desk"></select>`)}</div>${mode === "edit" ? "" : fld("ولاية الانطلاق", `<select id="mo-from">${fromOpts(ad)}</select><small class="hint">الافتراضية من إعدادات شركة التوصيل — غيّرها إن كانت البضاعة ستُرسل من مخزن في ولاية أخرى</small>`)}</div>
<div style="font-weight:800;margin:.4rem 0 .3rem">المنتجات</div><div id="mo-lines" style="overflow:auto"></div><div style="margin:.3rem 0 .6rem"><button type="button" class="small gray" id="mo-add">➕ إضافة منتج</button></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 .7rem">${fld("رسم التوصيل (دج)", `<input id="mo-fee" type="number" min="0" step="50" value="${src ? num(src.fee) : 0}"><small id="mo-fh" class="hint"></small>`)}${fld("الخصم (دج)", `<input id="mo-disc" type="number" min="0" step="50" value="${src ? num(src.discount) : 0}">`)}</div>
${fld("ملاحظة (اختياري)", `<input id="mo-note" value="" placeholder="تظهر في ملاحظات الطلب">`)}
<div style="display:flex;justify-content:space-between;align-items:center;margin:.3rem 0 .8rem;font-weight:900"><span>سعر المنتجات <span id="mo-sub"></span></span><span>الإجمالي <span id="mo-tot" style="color:var(--green)"></span></span></div>
<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="small green" id="mo-save">${mode === "edit" ? "💾 حفظ التعديل" : "💾 حفظ الطلب"}</button><button type="button" class="small warn" id="mo-no">إلغاء</button></div></div>`;
    document.body.appendChild(bg);
    if (opt.hint) { const h = bg.querySelector(".hint"); if (h) h.textContent = String(opt.hint).slice(0, 300); }       // نص إرشادي مخصّص (مثلاً عند النقل من مركز المتاجر)
    const $ = id => bg.querySelector("#" + id), dt = () => (bg.querySelector('input[name="mo-dt"]:checked') || {}).value || "home";
    function fillCom(keep) { const w = wOf($("mo-wil").value), cur = keep == null ? (src && src.commune) : keep; $("mo-com").innerHTML = WilKids.html(w, cur); }
    function fillDesk(keep) {
      const w = ad.wCo ? ad.wCo($("mo-wil").value) : wOf($("mo-wil").value), com = $("mo-com").value, ds = ad.desksIn ? ad.desksIn(w, com) : ((w && w.desks) || []), cur = keep == null ? (src && src.desk) : keep, has = ds.length > 0;
      $("mo-desk").innerHTML = (has ? "" : `<option value="">${com ? "لا يوجد مكتب Stop Desk في بلدية " + esc(com) : "لا توجد مكاتب معروفة لهذه الولاية"}</option>`) + (has && cur && !ds.some(d => d.name === cur) ? "" : "") + ds.map(d => `<option value="${esc(d.name)}"${d.name === cur ? " selected" : ""}>${esc(d.name)}${d.commune ? " — " + esc(d.commune) : ""}</option>`).join("");
      const sr = bg.querySelector('input[name="mo-dt"][value="stop"]'); if (sr) { sr.disabled = !has; sr.parentElement.style.opacity = has ? "" : ".45"; sr.parentElement.title = has ? "" : "لا يوجد مكتب Stop Desk في هذه البلدية — التوصيل للمنزل فقط"; if (!has && sr.checked) { bg.querySelector('input[name="mo-dt"][value="home"]').checked = true; } }
      $("mo-deskw").style.display = dt() === "stop" ? "" : "none";
    }
    const total = () => { const c = calc(lines, $("mo-fee").value, $("mo-disc").value); $("mo-sub").textContent = c.sub.toLocaleString("fr-DZ") + " دج"; $("mo-tot").textContent = c.total.toLocaleString("fr-DZ") + " دج"; };
    const ffFail = {};
    function autoFee() {
      const w = wOf($("mo-wil").value), q = w && ad.shipFeeFor ? ad.shipFeeFor(w, $("mo-com").value, dt()) : { fee: w ? num(dt() === "stop" ? w.stop : w.home) : 0, base: 0, sup: 0 }; let base = q.fee, note = ad.feeNote ? ad.feeNote(q, $("mo-com").value) : "";
      /* ولاية انطلاق غير الافتراضية ← تعريفة ياليدين لذلك الزوج (انطلاق، وجهة) بدل سعر الولاية الافتراضي */
      const fe = $("mo-from"), fw = fe && fe.value && fe.value !== fromDef(ad) ? wOf(fe.value) : null;
      if (w && fw && $("mo-com").value && ad.fromFeeFor) {
        const v = ad.fromFeeFor(fw.id, w, $("mo-com").value, dt()), key = fw.id + "-" + (w.par || w.id);
        if (v != null) { base = v; note = " (تعريفة ياليدين من " + fw.name + ")"; }
        else if (!ffFail[key] && ad.ensureFromFees) { ad.ensureFromFees(fw.id, w).then(okk => { if (!okk) ffFail[key] = true; if (document.body.contains(bg)) autoFee(); }); note = " ⏳ جارِ جلب تعريفة الانطلاق من " + fw.name + "…"; }
        else note = " — تعذّر جلب تعريفة الانطلاق من " + fw.name + " فحُسب الرسم من الولاية الافتراضية";
      }
      if (!src || $("mo-wil").value !== src.wilaya || $("mo-com").value !== src.commune || dt() !== (src.dtype === "stop" ? "stop" : "home")) { $("mo-fee").value = base; $("mo-fh").textContent = w ? "رسم التوصيل: " + base.toLocaleString("fr-DZ") + " دج" + note + " — عدّله إن لزم" : ""; } total();
    }
    function drawLines() {
      const th = 'style="text-align:right;padding:.2rem"';
      $("mo-lines").innerHTML = `<table style="width:100%;border-collapse:collapse;min-width:520px"><tr><th ${th}>المنتج</th><th ${th}>الكمية</th><th ${th}>سعر العلبة (دج)</th><th ${th}>المجموع</th><th></th></tr>` + lines.map((l, i) => {
        const known = P.some(p => p.title === l.title && p.slug === l.slug);
        return `<tr data-i="${i}"><td style="padding:.2rem"><select data-f="sel"><option value="">اختر المنتج…</option>${P.map((p, k) => `<option value="${k}"${known && p.title === l.title ? " selected" : ""}>${esc(p.name || p.title)}${p.name && p.name !== p.title ? " ← " + esc(p.title) : ""}</option>`).join("")}<option value="x"${!known && l.title ? " selected" : ""}>✎ منتج آخر…</option></select>${!known && l.title !== "" || l.__x ? `<input data-f="title" value="${esc(l.title)}" placeholder="اسم المنتج" style="margin-top:.2rem">` : ""}</td><td style="padding:.2rem"><input data-f="qty" type="number" min="1" step="1" value="${l.qty}" style="max-width:80px"></td><td style="padding:.2rem"><input data-f="price" type="number" min="0" step="50" value="${l.price}" style="max-width:110px"></td><td style="padding:.2rem"><b>${(num(l.qty) * num(l.price)).toLocaleString("fr-DZ")}</b></td><td style="padding:.2rem"><button type="button" class="small warn" data-f="del">🗑</button></td></tr>`;
      }).join("") + "</table>";
    }
    fillCom(); fillDesk(); drawLines(); total(); if (!src) autoFee();
    $("mo-wil").onchange = () => { fillCom(""); fillDesk(""); autoFee(); };
    if (ad.shipSupLoad) ad.shipSupLoad().then(() => { if (!src && document.body.contains(bg)) autoFee(); });
    bg.querySelectorAll('input[name="mo-dt"]').forEach(r => r.onchange = () => { fillDesk($("mo-desk").value); autoFee(); });
    $("mo-com").onchange = () => { WilKids.pick($("mo-wil"), $("mo-com")); fillDesk(""); autoFee(); }; if ($("mo-from")) $("mo-from").onchange = () => autoFee(); $("mo-fee").oninput = total; $("mo-disc").oninput = total;
    $("mo-add").onclick = () => { lines.push({ slug: "", title: "", qty: 1, price: 0 }); drawLines(); total(); };
    $("mo-lines").addEventListener("input", e => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; const l = lines[+tr.dataset.i], f = e.target.dataset.f; if (f === "qty") l.qty = Math.max(1, num(e.target.value)); else if (f === "price") l.price = num(e.target.value); else if (f === "title") l.title = e.target.value; else return; tr.querySelector("b").textContent = (num(l.qty) * num(l.price)).toLocaleString("fr-DZ"); total(); });
    $("mo-lines").addEventListener("change", e => { const tr = e.target.closest("tr[data-i]"); if (!tr || e.target.dataset.f !== "sel") return; const l = lines[+tr.dataset.i], v = e.target.value; if (v === "x") { l.slug = ""; l.__x = true; l.title = l.title || ""; } else if (v === "") { l.slug = ""; l.title = ""; l.price = 0; delete l.__x; } else { const p = P[+v]; l.slug = p.slug; l.title = p.title; l.price = p.price; delete l.__x; } drawLines(); total(); });
    $("mo-lines").addEventListener("click", e => { const b = e.target.closest('[data-f="del"]'); if (!b) return; const i = +b.closest("tr").dataset.i; lines.splice(i, 1); if (!lines.length) lines.push({ slug: "", title: "", qty: 1, price: 0 }); drawLines(); total(); });
    const close = () => bg.remove(); $("mo-x").onclick = close; $("mo-no").onclick = close; bg.addEventListener("click", e => { if (e.target === bg) close(); });
    $("mo-save").onclick = async () => {
      const name = $("mo-name").value.trim(), phone = $("mo-phone").value.replace(/[^0-9+]/g, ""), items = lines.filter(l => String(l.title).trim() && num(l.qty) > 0);
      if (name.length < 2) { toast("⚠️ أدخل اسم الزبون"); return; } if (phone.length < 6 || phone.length > 20) { toast("⚠️ رقم الهاتف غير صحيح"); return; } if (!items.length) { toast("⚠️ أضف منتجاً واحداً على الأقل"); return; }
      const dtp = dt(), desk = dtp === "stop" ? $("mo-desk").value : ""; if (dtp === "stop" && !desk) { toast("⚠️ اختر مكتب Stop Desk"); return; }
      const c = calc(items, $("mo-fee").value, $("mo-disc").value), b = $("mo-save"); b.disabled = true; const lab = b.textContent; b.textContent = "جارٍ الحفظ…";
      const clean = items.map(l => ({ slug: l.slug || "", title: String(l.title).trim().slice(0, 160), qty: num(l.qty), price: num(l.price) })), txt = textOf(clean);
      try {
        if (mode === "edit") {
          const fdb = { name, phone, wilaya: $("mo-wil").value, commune: $("mo-com").value, dtype: dtp, desk, subtotal: c.sub, discount: c.disc, fee: c.fee, total: c.total, items: clean, items_text: txt };
          const note = $("mo-note").value.trim(); if (note) { src.note = (String(src.note || "") + " " + note).trim(); API.updateOrder(ad.key, src.id, undefined, src.note); }
          const local = Object.assign({}, fdb, { items: txt }); delete local.items_text; Object.assign(src, local);
          if (window.OrderEdit && OrderEdit.stash) OrderEdit.stash(src.id, local);
          let saved = false; try { saved = await API.updateOrderFields(ad.key, src.id, fdb); } catch (e) { }
          if (saved && window.OrderEdit && OrderEdit.unstash) OrderEdit.unstash(src.id);
          close(); ad.renderStats(); ad.renderOrders(); try { ad.openOrderPreview(ad.orders.indexOf(src)); } catch (e) { }
          toast(saved ? "✅ حُفظ تعديل الطلب" : "✅ حُفظ التعديل في اللوحة"); return;
        }
        const extra = { "✍️ طلب يدوي": "نعم" }; { const fe = $("mo-from"); if (fe && fe.value && fe.value !== fromDef(ad)) extra["📍 ولاية الانطلاق"] = fe.value; } if (mode === "copy" && src && !opt.extra) extra["📄 نسخة من"] = String(src.id).slice(-6); if (opt.extra) Object.assign(extra, opt.extra);
        const order = { name, phone, wilaya: $("mo-wil").value, commune: $("mo-com").value, dtype: dtp, desk, items: clean, subtotal: c.sub, fee: c.fee, total: c.total, coupon: "", discount: c.disc, extra, note: $("mo-note").value.trim() };
        const r = await API.addOrder(order);
        if (!r || !r.ok) { b.disabled = false; b.textContent = lab; toast("❌ تعذّر حفظ الطلب — تحقق من الاتصال وصلاحية الدخول"); return; }
        const o = { id: r.id || ("M" + Date.now().toString(36).toUpperCase()), date: new Date().toISOString(), name, phone, wilaya: order.wilaya, commune: order.commune, dtype: dtp, desk, items: txt, subtotal: c.sub, fee: c.fee, total: c.total, coupon: "", discount: c.disc, extra, status: "nouvelle", note: order.note };
        ad.orders.unshift(o); close(); if (typeof opt.onSaved === "function") { try { opt.onSaved(o); } catch (e) { } } ad.renderStats(); ad.renderOrders(); setTimeout(() => { try { ad.refreshAlerts(); } catch (e) { } }, 2500);
        toast("✅ أُضيف الطلب " + String(o.id).slice(-6) + " — في انتظار التأكيد"); return;
      } catch (e) { b.disabled = false; b.textContent = lab; toast("❌ " + (e && e.message || e)); }
    };
  }
  return { open, parseLines, calc, textOf, fromDef };
})();
