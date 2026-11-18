/* قائمة ما قبل الإرسال (v1.89.1249): كل طلب مؤكَّد لم يُرسَل بعد، مع الشركة التي سيذهب إليها بالضبط وما سيصلها (المنتجات باسم البوردرو، الولاية والبلدية والمكتب والمبلغ) وتحذيراته (شركة غير الافتراضية، تدقيق السعر، عنوان معدَّل، مكتب مفقود)،
   لتراجعه ثم تُرسل المحدَّد منه. وفيها مفتاح «إرسال الطلب تلقائياً عند تأكيده» (كان يُرسل فور التأكيد فلا تراه قبل الإرسال). مشتركة لكل العملاء: لا شيء خاص بمتجر. */
const AdminPreSend = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : null), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { sel: null, src: "", scope: "", q: "" };
  function pending() {
    const a = A(); if (!a) return [];
    return (a.orders || []).filter(o => o && o.status === "confirmee" && !a.trackingOf(o) && !/🗑/.test(o.note || "") && !(a.isBlacklisted && a.isBlacklisted(o.phone)) && !(a.isDigital && a.isDigital(o)) && !(a.isMarket && a.isMarket(o)));
  }
  function info(o) {
    const a = A(), cos = a.allDeliveryCompanies(), def = a.activeCompanyKey ? a.activeCompanyKey() : "", k = (a.orderCompanyKey && a.orderCompanyKey(o)) || def, w = [];
    if (k && def && k !== def) w.push("شركة غير الافتراضية");
    try { const pc = a.priceCheck ? a.priceCheck(o) : { ok: true }; if (!pc.ok) w.push("تدقيق السعر: " + (pc.msgs || []).join("، ")); } catch (e) { }
    try { const af = a.addrFix ? a.addrFix(o) : null; if (af && !af.applied) w.push("عنوان معدَّل لم يُطبَّق"); } catch (e) { }
    if (o.dtype === "stop" && !o.desk) w.push("لا مكتب Stop Desk محدَّد");
    let items = o.items; try { items = a.bordItems ? a.bordItems(o.items) : o.items; } catch (e) { }
    const lines = String(items || "").split(/\n/).map(x => x.replace(/\s*=\s*[\d\s.,]+\s*DA\s*$/i, "").trim()).filter(Boolean);
    return { k, coName: (cos[k] && cos[k].name) || k || "—", other: !!(k && def && k !== def), warn: w, lines, dest: [o.wilaya, o.commune].filter(Boolean).join(" / ") + (o.dtype === "stop" ? " — مكتب" + (o.desk ? ": " + o.desk : "") : " — منزل") };
  }
  const ST = { nouvelle: "جديدة", confirmee: "مؤكَّدة", expediee: "مُرسَلة", livree: "مُسلَّمة", annulee: "ملغاة", retour: "مرتجعة" };
  /* الأرشيف: «الطلبات» كلها، «التجهيز» (المؤكَّدة غير المرسَلة)، «المرسَلة» (كل ما له تتبع) — لا يختفي منها طلب */
  function allOrders() {
    const a = A(); if (!a) return [];
    return (a.orders || []).filter(o => o && !/🗑/.test(o.note || "")).slice().sort((x, y) => String(y.created_at || y.date || "").localeCompare(String(x.created_at || x.date || "")));
  }
  function sentAll() { return allOrders().filter(o => A().trackingOf(o) && !(A().isDigital && A().isDigital(o)) && !(A().isMarket && A().isMarket(o))); }
  function listFor(sc) { return sc === "all" ? allOrders() : sc === "sent" ? sentAll() : pending(); }
  function draw() {
    const bg = document.getElementById("presend-bg"); if (!bg) return; const a = A(), sc = S.scope || "prep", PREP = sc === "prep", RO = !PREP, man = o => !!(a.isManualOrder && a.isManualOrder(o)), BASE = listFor(sc), q = String(S.q || "").trim().toLowerCase(),
      nPrep = pending().length, nSent = sentAll().length, nAll = allOrders().length,
      Q = q ? BASE.filter(o => [o.id, o.name, o.phone, o.wilaya, o.commune].join(" ").toLowerCase().includes(q)) : BASE,
      nMan = Q.filter(man).length, nWeb = Q.length - nMan, L = S.src === "man" ? Q.filter(man) : S.src === "web" ? Q.filter(o => !man(o)) : Q, ids = new Set(L.map(o => String(o.id))), SHOWN = RO ? L.slice(0, 300) : L;
    if (!S.sel) S.sel = new Set(ids); else S.sel = new Set([...S.sel].filter(x => ids.has(x)));
    const by = {}; L.forEach(o => { const n = info(o).coName; by[n] = (by[n] || 0) + 1; }), sum = Object.keys(by).map(k => esc(k) + ": <b>" + by[k] + "</b>").join(" · ");
    const auto = a.autoOpt ? a.autoOpt("send") : false, tab = (k, t, n) => '<button type="button" class="small ' + (sc === k ? "gold" : "gray") + '" data-scope="' + k + '">' + t + " (" + n + ")</button>";
    bg.querySelector(".modal").innerHTML = '<button type="button" class="ord-x" id="ps-x" title="إغلاق" aria-label="إغلاق">✕</button><h3 style="margin:0 0 .5rem;padding-inline-end:2.4rem">أرشيف الطلبات</h3>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:0 0 .6rem">' + tab("all", "الطلبات", nAll) + tab("prep", "التجهيز", nPrep) + tab("sent", "المرسلة", nSent) + '</div>' +
      (PREP ? '<div style="padding:.5rem .7rem;margin:0 0 .6rem;border-radius:12px;border:1px solid rgba(128,128,128,.4);background:rgba(128,128,128,.08)"><label style="display:flex;gap:.5rem;align-items:flex-start;font-weight:800;cursor:pointer;margin:0"><input type="checkbox" id="ps-auto"' + (auto ? " checked" : "") + ' style="width:20px;height:20px;flex:none;margin:.1rem 0 0"><span>إرسال الطلب تلقائياً عند تأكيده<br><small style="font-weight:600;opacity:.85">' + (auto ? "مفعّل: يُرسَل الطلب إلى الشركة فور تأكيده فينتقل إلى «المرسلة». أوقفه لتراجع الطلبات هنا قبل إرسالها." : "متوقف: تبقى الطلبات المؤكَّدة هنا حتى ترسلها أنت.") + '</small></span></label></div>' : "") +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:0 0 .5rem;align-items:center"><button type="button" class="small ' + (S.src === "" ? "gold" : "gray") + '" data-src="">الكل (' + Q.length + ')</button><button type="button" class="small ' + (S.src === "web" ? "gold" : "gray") + '" data-src="web">دخلت من الموقع (' + nWeb + ')</button><button type="button" class="small ' + (S.src === "man" ? "gold" : "gray") + '" data-src="man">أدخلتُها يدوياً (' + nMan + ')</button><input id="ps-q" type="search" value="' + esc(S.q || "") + '" placeholder="بحث: اسم أو هاتف أو رقم" style="flex:1;min-width:150px;max-width:260px"></div>' +
      '<div class="hint" style="margin:0 0 .5rem"><b>' + L.length + '</b> ' + (PREP ? "طلب مؤكَّد لم يُرسَل" : sc === "sent" ? "طلب مُرسَل (محفوظ في الأرشيف)" : "طلب محفوظ في الأرشيف") + (sum ? " — " + sum : "") + (SHOWN.length < L.length ? " — يُعرض أحدث " + SHOWN.length + "، استعمل البحث" : "") + '</div>' +
      (L.length ? '<div style="overflow:auto;max-height:52vh"><table class="rt m-scroll" style="width:100%;border-collapse:collapse"><thead><tr>' + (PREP ? '<th><input type="checkbox" id="ps-all"' + (S.sel.size === L.length ? " checked" : "") + ' aria-label="تحديد الكل"></th>' : "") + '<th>الطلب</th><th>المصدر</th><th>الزبون</th><th>الوجهة</th><th>' + (PREP ? "ما سيصل الشركة" : "المنتجات") + '</th><th>المبلغ</th><th>الشركة</th>' + (RO ? "<th>الحالة</th><th>التتبع</th>" : "") + '</tr></thead><tbody>' +
        SHOWN.map((o, k) => { const x = info(o), tr = a.trackingOf(o) || {}; return '<tr data-k="' + k + '">' + (PREP ? '<td><input type="checkbox" data-id="' + esc(o.id) + '"' + (S.sel.has(String(o.id)) ? " checked" : "") + ' aria-label="تحديد"></td>' : "") + '<td data-l="الطلب" dir="ltr">' + esc(String(o.id).slice(-6)) + '<br><small>' + esc(String(o.created_at || o.date || "").slice(0, 10)) + '</small></td><td data-l="المصدر"><span class="o-src ' + (man(o) ? "man" : "web") + '">' + (man(o) ? "يدوي" : "الموقع") + '</span></td><td data-l="الزبون">' + esc(o.name) + '<br><small dir="ltr">' + esc(o.phone) + '</small></td><td data-l="الوجهة">' + esc(x.dest) + '</td><td data-l="المنتجات">' + x.lines.map(esc).join("<br>") + '</td><td data-l="المبلغ">' + (Number(o.total) || 0).toLocaleString("fr-DZ") + ' دج</td><td data-l="الشركة"><b>' + esc(tr.company ? ((a.allDeliveryCompanies()[tr.company] || {}).name || tr.company) : x.coName) + '</b>' + (PREP && x.warn.length ? '<br>' + x.warn.map(w => '<small style="color:#b45309;font-weight:800;display:block">' + esc(w) + '</small>').join("") : "") + '</td>' + (RO ? '<td data-l="الحالة">' + esc(ST[o.status] || o.status || "") + '</td><td data-l="التتبع" dir="ltr">' + esc(tr.tracking || "—") + '</td>' : "") + '</tr>'; }).join("") + '</tbody></table></div>' : '<div class="hint" style="padding:1rem 0;text-align:center">' + (PREP ? "لا طلبات بانتظار التجهيز. كل المؤكَّد أُرسل؛ تجدها في «المرسلة»." : "لا طلبات هنا.") + '</div>') +
      (PREP ? '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.7rem"><button type="button" class="small gold" id="ps-send"' + (S.sel.size ? "" : " disabled") + '>إرسال المحدَّد (' + S.sel.size + ')</button></div>' : "");
    bg.querySelector("#ps-x").onclick = () => bg.remove();
    bg.querySelectorAll("[data-scope]").forEach(b => b.onclick = () => { S.scope = b.getAttribute("data-scope"); S.sel = null; draw(); });
    bg.querySelectorAll("[data-src]").forEach(b => b.onclick = () => { S.src = b.getAttribute("data-src"); S.sel = null; draw(); });
    const qi = bg.querySelector("#ps-q"); if (qi) { qi.oninput = () => { S.q = qi.value; S.sel = null; const pos = qi.selectionStart; draw(); const n = bg.querySelector("#ps-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }; }
    const au = bg.querySelector("#ps-auto"); if (au) au.onchange = () => { try { a.setAutoOpt("send", au.checked); } catch (e) { } draw(); };
    const all = bg.querySelector("#ps-all"); if (all) all.onchange = () => { S.sel = all.checked ? new Set(ids) : new Set(); draw(); };
    bg.querySelectorAll("tbody input[data-id]").forEach(c => c.onchange = () => { const id = c.getAttribute("data-id"); if (c.checked) S.sel.add(id); else S.sel.delete(id); draw(); });
    const sb = bg.querySelector("#ps-send"); if (sb) sb.onclick = async () => { const list = L.filter(o => S.sel.has(String(o.id))); if (!list.length) return; sb.disabled = true; try { await a.bulkSend(list); } catch (e) { console.warn("presend", e); } draw(); try { a.renderOrders(); } catch (e) { } };
  }
  function open() {
    S.sel = null; S.src = ""; S.q = ""; S.scope = pending().length ? "prep" : sentAll().length ? "sent" : "all"; let bg = document.getElementById("presend-bg"); if (bg) bg.remove();
    bg = document.createElement("div"); bg.id = "presend-bg"; bg.className = "modal-bg open"; bg.dir = "rtl"; bg.innerHTML = '<div class="modal" style="width:min(1060px,96vw);max-width:min(1060px,96vw);position:relative"></div>';
    bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); }); document.body.appendChild(bg); draw();
  }
  return { open, pending, recentSent: sentAll, allOrders, info, _S: S };
})();
