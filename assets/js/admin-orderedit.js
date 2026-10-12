/* تعديل بيانات الطلب بعد التأكيد (v1.89.79): من معاينة الطلب (الاسم، الولاية، البلدية، طريقة التوصيل + المكتب، ورسم التوصيل) ثم يُحفظ ويُحدَّث الطرد لدى شركة التوصيل تلقائياً إن كان قد أُرسل.
   الحفظ: قاعدة الطلبات إن سمحت بتعديل هذه الحقول، وإلا يُحفظ التعديل في اللوحة (alyssum_order_edits، يتزامن بين أجهزتك) ويُطبَّق فوق الطلب عند كل تحميل (OrderEdit.apply).
   تحديث الشركة: Admin.updateAtCompany(i) (للشركات التي تدعم updateRequest؛ غيرها يُنبَّه لتعديل الطرد يدوياً). */
window.OrderEdit = (function () {
  const LSK = "alyssum_order_edits", A = () => (typeof Admin !== "undefined" ? Admin : null);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = () => { try { const v = JSON.parse(localStorage.getItem(LSK) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
  const save = v => { try { localStorage.setItem(LSK, JSON.stringify(v)); } catch (e) { } };
  const FIELDS = ["name", "wilaya", "commune", "dtype", "desk", "fee", "total"];
  /* يطبّق التعديلات المحفوظة فوق الطلبات (يُستدعى من Admin.liveOrders) */
  function apply(list) { const ed = load(); return (list || []).map(o => { const e = o && ed[o.id]; return e ? Object.assign(o, e) : o; }); }
  const canEdit = o => !!o && ["confirmee", "expediee"].includes(o.status);
  const W = () => (typeof WILAYAS !== "undefined" ? WILAYAS : []);
  const wOf = n => W().find(x => x.name === n) || null;
  const num = v => Math.max(0, Math.round(Number(v) || 0));

  function open(i) {
    const ad = A(), o = ad && ad.orders[i]; if (!o) return; if (!canEdit(o)) { toast("التعديل متاح للطلبات المؤكَّدة أو في الطريق فقط"); return; }
    let bg = document.getElementById("oe-bg"); if (bg) bg.remove();
    bg = document.createElement("div"); bg.id = "oe-bg"; bg.className = "modal-bg open"; bg.dir = "rtl";
    const t = ad.trackingOf ? ad.trackingOf(o) : null, sub = num(o.subtotal), disc = num(o.discount);
    const wil = W().slice().sort((a, b) => a.id - b.id), fld = (l, h) => `<div class="field" style="margin-bottom:.55rem"><label style="font-weight:800;font-size:.82rem">${l}</label>${h}</div>`;
    bg.innerHTML = `<div class="modal" style="max-width:520px;position:relative"><button type="button" class="ord-x" id="oe-x" title="إغلاق" aria-label="إغلاق">✕</button><h3>✏️ تعديل الطلب <span dir="ltr">${esc(o.id)}</span></h3>
<p class="hint" style="margin:.2rem 0 .7rem">${t ? "هذا الطلب مسجَّل لدى شركة التوصيل (التتبع <b dir=\"ltr\">" + esc(t.tracking) + "</b>): تُحدَّث بياناته عندها تلقائياً بعد الحفظ." : "الطلب لم يُرسل لشركة التوصيل بعد؛ تُحفظ التعديلات وتُستعمل عند الإرسال."}</p>
${fld("الاسم", `<input id="oe-name" value="${esc(o.name)}">`)}
${fld("الولاية", `<select id="oe-wil">${wil.map(w => `<option value="${esc(w.name)}"${w.name === o.wilaya ? " selected" : ""}>${w.id} — ${esc(w.name)}</option>`).join("")}${wOf(o.wilaya) ? "" : `<option value="${esc(o.wilaya)}" selected>${esc(o.wilaya)}</option>`}</select>`)}
${fld("البلدية", `<select id="oe-com"></select>`)}
${fld("طريقة التوصيل", `<div style="display:flex;gap:1rem;flex-wrap:wrap"><label><input type="radio" name="oe-dt" value="home"${o.dtype !== "stop" ? " checked" : ""}> إلى المنزل</label><label><input type="radio" name="oe-dt" value="stop"${o.dtype === "stop" ? " checked" : ""}> مكتب Stop Desk</label></div>`)}
<div id="oe-deskw">${fld("المكتب", `<select id="oe-desk"></select>`)}</div>
${fld("رسم التوصيل (دج)", `<input id="oe-fee" type="number" min="0" step="50" value="${num(o.fee)}"><small id="oe-fh" class="hint"></small>`)}
<div style="display:flex;justify-content:space-between;align-items:center;margin:.3rem 0 .8rem;font-weight:900">الإجمالي الجديد <span id="oe-tot" style="color:var(--green)"></span></div>
<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="small green" id="oe-save">حفظ</button><button type="button" class="small warn" id="oe-no">إلغاء</button></div></div>`;
    document.body.appendChild(bg);
    const $ = id => bg.querySelector("#" + id), dt = () => (bg.querySelector('input[name="oe-dt"]:checked') || {}).value || "home";
    const free0 = num(o.fee) === 0;
    function fillCom(keep) {
      const w = wOf($("oe-wil").value), list = (w && w.communes) || [], cur = keep == null ? o.commune : keep;
      $("oe-com").innerHTML = (list.includes(cur) || !cur ? "" : `<option value="${esc(cur)}">${esc(cur)}</option>`) + list.map(c => `<option value="${esc(c)}"${c === cur ? " selected" : ""}>${esc(c)}</option>`).join("");
    }
    function fillDesk(keep) {
      const w = ad.wCo ? ad.wCo($("oe-wil").value) : wOf($("oe-wil").value), ds = (w && w.desks) || [], cur = keep == null ? o.desk : keep;
      $("oe-desk").innerHTML = (ds.length ? "" : `<option value="">لا توجد مكاتب معروفة لهذه الولاية</option>`) + (cur && !ds.some(d => d.name === cur) ? `<option value="${esc(cur)}">${esc(cur)}</option>` : "") + ds.map(d => `<option value="${esc(d.name)}"${d.name === cur ? " selected" : ""}>${esc(d.name)}</option>`).join("");
      $("oe-deskw").style.display = dt() === "stop" ? "" : "none";
    }
    function autoFee() {
      const w = wOf($("oe-wil").value), q = w && ad.shipFeeFor ? ad.shipFeeFor(w, $("oe-com").value, dt()) : { fee: w ? num(dt() === "stop" ? w.stop : w.home) : num(o.fee), base: 0, sup: 0 }, base = q.fee, same = $("oe-wil").value === o.wilaya && $("oe-com").value === o.commune && dt() === (o.dtype === "stop" ? "stop" : "home");
      $("oe-fee").value = same ? num(o.fee) : (free0 ? 0 : base);
      $("oe-fh").textContent = same ? "" : "رسم التوصيل الجديد: " + base.toLocaleString("fr-DZ") + " دج" + (q.sup ? " (الولاية " + q.base.toLocaleString("fr-DZ") + " + البلدية " + q.sup.toLocaleString("fr-DZ") + ")" : "") + (free0 ? " (الطلب الأصلي بتوصيل مجاني فبقي مجانياً — عدّل الرسم إن لزم)" : "");
      total();
    }
    const total = () => { $("oe-tot").textContent = Math.max(0, sub - disc + num($("oe-fee").value)).toLocaleString("fr-DZ") + " دج"; };
    fillCom(); fillDesk(); total();
    $("oe-wil").onchange = () => { fillCom(""); fillDesk(""); autoFee(); }; $("oe-com").onchange = autoFee;
    bg.querySelectorAll('input[name="oe-dt"]').forEach(r => r.onchange = () => { fillDesk($("oe-desk").value); autoFee(); });
    $("oe-fee").oninput = total;
    const close = () => bg.remove(); $("oe-x").onclick = close; $("oe-no").onclick = close; bg.addEventListener("click", e => { if (e.target === bg) close(); });
    $("oe-save").onclick = async () => {
      const name = $("oe-name").value.trim(); if (name.length < 2) { toast("أدخل الاسم"); return; }
      const f = { name, wilaya: $("oe-wil").value, commune: $("oe-com").value, dtype: dt(), desk: dt() === "stop" ? $("oe-desk").value : "", fee: num($("oe-fee").value) };
      if (f.dtype === "stop" && !f.desk) { toast("اختر مكتب Stop Desk"); return; }
      f.total = Math.max(0, sub - disc + f.fee);
      const b = $("oe-save"); b.disabled = true; b.textContent = "جارٍ الحفظ…";
      const changed = FIELDS.some(k => String(o[k] == null ? "" : o[k]) !== String(f[k]));
      if (!changed) { close(); toast("لا يوجد تغيير"); return; }
      Object.assign(o, f);
      const ed = load(); ed[o.id] = f; save(ed);                                    // احتياط محلي (يتزامن بين الأجهزة)
      let saved = false; try { saved = await API.updateOrderFields(ad.key, o.id, f); } catch (e) { }
      if (saved) { const e2 = load(); delete e2[o.id]; save(e2); }                  // حُفظ في القاعدة: لا حاجة للاحتياط
      let msg = saved ? "تم الحفظ." : "تم الحفظ في اللوحة.";
      if (t) {
        b.textContent = "تحديث شركة التوصيل…";
        const r = await ad.updateAtCompany(ad.orders.indexOf(o));
        msg += r.ok ? " وتحدّث الطرد لدى شركة التوصيل." : (r.skipped ? "" : " لكن تعذّر تحديث الشركة: " + r.msg);
        if (!r.ok && !r.skipped) ad.showNotice("تعذّر تحديث الطرد لدى شركة التوصيل", esc(r.msg) + "<br><small>تم حفظ التعديل في اللوحة؛ عدّل الطرد " + esc(t.tracking) + " يدوياً من حساب الشركة.</small>");
      }
      close(); try { ad.renderOrders(); ad.openOrderPreview(ad.orders.indexOf(o)); } catch (e) { } toast("✅ " + msg);
    };
  }
  const stash = (id, f) => { const ed = load(); ed[id] = f; save(ed); }, unstash = id => { const ed = load(); delete ed[id]; save(ed); };
  return { open, apply, canEdit, load, stash, unstash };
})();
