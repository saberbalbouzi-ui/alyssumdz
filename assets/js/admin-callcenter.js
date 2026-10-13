/* مركز الاتصال: بطاقة طلب واحدة بالدور وأزرار كبيرة لقرار الاتصال. كل قرار يمرّ بالمنطق القائم نفسه (Admin.previewResult ← فحص المخزون،
   التأكيد، المحاولات، الإلغاء) بلا منطق موازٍ. الطابور: الطلبات الجديدة الأقدم أولاً، ثم من لم يُجب، ثم «لاحقاً»؛ «رقم خاطئ» مخفي. */
const CallCenter = (() => {
  const $ = id => document.getElementById(id), S = { cur: null, skip: {}, st: { conf: 0, canc: 0, noans: 0, later: 0, tomo: 0, addr: 0, wrong: 0, t0: Date.now() }, timer: 0 };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const fmt = n => (Math.round(+n || 0)).toLocaleString("fr-DZ") + " دج";
  const today = () => (A() && A().isoDay ? A().isoDay() : new Date().toISOString().slice(0, 10));
  /* مؤجَّل إلى تاريخ لم يحلّ بعد ⟵ خارج الطابور؛ إذا حلّ التاريخ صار في المقدمة (قبل الجديد) كي لا يُنسى */
  const parked = o => { const a = A(), d = a && a.callDue ? a.callDue(o) : ""; return !!d && d > today(); };
  const dueNow = o => { const a = A(), d = a && a.callDue ? a.callDue(o) : ""; return !!d && d <= today(); };
  function base() {
    const a = A(); if (!a || !Array.isArray(a.orders)) return [];
    return a.orders.map((o, i) => ({ o, i })).filter(x => x.o.status === "nouvelle" && a.callMark(x.o) !== "wrong" && !(x.o.note && /🗑/.test(x.o.note)) && !a.trackingOf(x.o));
  }
  const parkedCount = () => base().filter(x => parked(x.o)).length;
  function queue() {
    const a = A(); if (!a) return [];
    const rank = o => (dueNow(o) ? -1 : a.callMark(o) === "later" ? 4 : a.attemptsOf(o) ? a.attemptsOf(o) : 0);
    return base().filter(x => !parked(x.o)).sort((p, q) => rank(p.o) - rank(q.o) || new Date(p.o.date) - new Date(q.o.date));
  }
  function pick(q) {
    const f = q.filter(x => !S.skip[x.o.id]); const keep = S.cur && f.find(x => x.o.id === S.cur); if (keep) return keep;
    const n = f[0] || q[0] || null; S.cur = n ? n.o.id : null; return n;
  }
  const css = () => {
    if ($("ccm-css")) return; const st = document.createElement("style"); st.id = "ccm-css";
    st.textContent = `#ccm{max-width:760px;margin:0 auto;display:grid;gap:.8rem}.ccm-bar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;justify-content:space-between}
.ccm-chip{padding:.3rem .7rem;border-radius:10px;font-weight:800;font-size:.85rem;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16)}
.ccm-card{padding:1.1rem;border-radius:18px;background:rgba(9,24,18,.92);border:1px solid rgba(255,255,255,.14);display:grid;gap:.6rem;color:#fff}
.ccm-card h2{margin:0;font-size:1.5rem}.ccm-ph{font-size:1.7rem;font-weight:900;letter-spacing:.04em}.ccm-m{opacity:.8;font-size:.95rem}.ccm-it{padding:.6rem;border-radius:12px;background:rgba(255,255,255,.06);white-space:pre-line;line-height:1.7}
.ccm-quick{display:flex;gap:.5rem;flex-wrap:wrap}.ccm-quick a{flex:1;text-align:center;padding:.8rem;border-radius:14px;font-weight:900;text-decoration:none;color:#fff;font-size:1.05rem;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08)}
.ccm-quick a.t{background:linear-gradient(180deg,rgba(34,197,94,.4),rgba(34,197,94,.16));border-color:rgba(34,197,94,.6)}
.ccm-act{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem}.ccm-act button{padding:1rem .6rem;border-radius:14px;font:inherit;font-weight:900;font-size:1.05rem;color:#fff;cursor:pointer;min-height:56px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);transition:transform .15s}
.ccm-act button:hover{transform:translateY(-2px)}.ccm-act .ok{grid-column:1/-1;background:linear-gradient(180deg,rgba(34,197,94,.45),rgba(34,197,94,.18));border-color:rgba(34,197,94,.65);min-height:68px;font-size:1.25rem}
.ccm-act .ok2{grid-column:1/-1;background:linear-gradient(180deg,rgba(34,197,94,.3),rgba(34,197,94,.1));border-color:rgba(34,197,94,.5)}.ccm-act .wa{background:linear-gradient(180deg,rgba(245,158,11,.4),rgba(245,158,11,.16));border-color:rgba(245,158,11,.6)}.ccm-act .no{background:linear-gradient(180deg,rgba(239,68,68,.38),rgba(239,68,68,.14));border-color:rgba(239,68,68,.55)}
.ccm-warn{padding:.5rem .7rem;border-radius:10px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.5)}.ccm-k{opacity:.6;font-size:.75rem;font-weight:400}
html.white .ccm-card{background:#fff;color:#0f172a;border-color:#d2d9e3}html.white .ccm-it{background:#f3f5f9}html.white .ccm-quick a,html.white .ccm-act button{color:#0f172a}html.white .ccm-chip{background:#f3f5f9;border-color:#d2d9e3}`;
    document.head.appendChild(st);
  };
  function render() {
    const host = $("callcenter-content"); if (!host) return; css(); const a = A(); if (!a) return;
    const q = queue(), cur = pick(q), st = S.st, done = st.conf + st.canc, mins = Math.max(1, Math.round((Date.now() - st.t0) / 60000));
    const bar = `<div class="ccm-bar"><span class="ccm-chip">المتبقي: <b>${q.length}</b></span><span class="ccm-chip">✅ ${st.conf}${st.addr ? " (🏠" + st.addr + ")" : ""} · ❌ ${st.canc} · 📞 ${st.noans} · ⏰ ${st.later} · 📅 ${st.tomo}</span>${parkedCount() ? `<span class="ccm-chip">📅 مؤجَّل لاحقاً: <b>${parkedCount()}</b></span>` : ""}
<span class="ccm-chip">نسبة التأكيد: <b>${done ? Math.round(st.conf / done * 100) : 0}%</b> · ${(done / mins * 60).toFixed(0)} قرار/ساعة</span></div>`;
    if (!cur) { host.innerHTML = `<div id="ccm">${bar}<div class="ccm-card"><h2>🎉 لا طلبات بانتظار الاتصال</h2><p class="ccm-m">سيظهر الطلب الجديد هنا تلقائياً.</p></div></div>`; return; }
    const o = cur.o, i = cur.i, at = a.attemptsOf(o), cm = a.callMark(o), ph = String(o.phone || "").replace(/\D/g, ""), intl = ph.startsWith("0") ? "213" + ph.slice(1) : ph;
    let short = null; try { short = window.StockCheck && StockCheck.shortOf ? StockCheck.shortOf(o) : null; } catch (e) { }
    const age = Math.max(0, Math.round((Date.now() - new Date(o.date)) / 60000));
    host.innerHTML = `<div id="ccm" data-i="${i}" data-id="${esc(o.id)}">${bar}
<div class="ccm-card"><div class="ccm-bar"><h2>${esc(o.name || "بدون اسم")}</h2><span class="ccm-chip">${at ? "📞 غير متاح — محاولة " + at + "/3" : dueNow(o) ? "📅 موعد اليوم" : cm === "later" ? "⏰ لاحقاً" : "🆕 جديد"} · منذ ${age < 90 ? age + " د" : Math.round(age / 60) + " س"}</span></div>
<div class="ccm-ph" dir="ltr">${esc(o.phone)}</div>
<div class="ccm-quick"><a class="t" href="tel:${esc(ph.startsWith("0") ? "+213" + ph.slice(1) : "+" + ph)}">📞 اتصل</a><a href="https://wa.me/${intl}" target="_blank" rel="noopener">💬 واتساب</a></div>
<div class="ccm-m">${esc([o.wilaya, o.commune].filter(Boolean).join(" / ") || "—")} · ${o.dtype === "stop" ? "مكتب" : "للمنزل"} · <b>${fmt(o.total)}</b></div>
<div class="ccm-it">${esc(a.itemsDisplay(o))}</div>
${short ? '<div class="ccm-warn">⚠️ المخزون لا يكفي لهذا الطلب — سيُطلب منك تأكيد قبل أي اتصال أو تأكيد.</div>' : ""}
${o.note ? `<div class="ccm-m">📝 ${esc(String(o.note).replace(/📞[1-3]|⏰لاحقاً|📵خطأ|📅\d{4}-\d{2}-\d{2}|🏠[✔⏳](?: «[^»]*»)?/g, "").trim())}</div>` : ""}
<div class="ccm-act"><button class="ok" data-d="confirm">✅ تأكيد الطلب <span class="ccm-k">C</span></button>
<button class="ok2" data-d="addr">🏠 تأكيد مع تعديل العنوان <span class="ccm-k">A</span></button>
<button data-d="noans">📞 غير متاح — محاولة ${Math.min(3, at + 1)} <span class="ccm-k">N</span></button><button class="wa" data-d="later">⏰ لاحقاً اليوم <span class="ccm-k">L</span></button>
<button class="wa" data-d="tomorrow">📅 مؤجَّل إلى الغد <span class="ccm-k">T</span></button><button data-d="wrong">📵 رقم خاطئ <span class="ccm-k">W</span></button>
<button class="no" data-d="cancel" style="grid-column:1/-1">❌ إلغاء <span class="ccm-k">X</span></button>
<button data-d="skip" style="grid-column:1/-1">⏭ تخطَّ إلى التالي <span class="ccm-k">→</span></button></div></div></div>`;
  }

  /* «تأكيد مع تعديل العنوان» (Confirmé avec modification d'adresse): تُصحَّح الولاية/البلدية/طريقة التوصيل (ونص حرّ) ثم يُؤكَّد الطلب.
     من يملك تعديل الطلبات (المالك/المدير) يُطبَّق التعديل فعلاً مع رسم التوصيل الجديد؛ المؤكِّدة بلا هذه الصلاحية تدوّنه في الملاحظة (🏠⏳)
     ويمنع النظام الإرسال التلقائي حتى يراجعه من يملك التعديل. */
  const canEdit = () => { const R = window.AdminRoles, me = R && R.state && R.state.me; return !me || me.owner === true || (R.has && R.has(me, "orders.edit")); };
  function addrDialog(i) {
    const a = A(), o = a && a.orders[i]; if (!o) return; const old = $("cca-bg"); if (old) old.remove();
    const W = typeof WILAYAS !== "undefined" ? WILAYAS.slice().sort((x, y) => x.id - y.id) : [], wOf = n => W.find(x => x.name === n) || null;
    const bg = document.createElement("div"); bg.id = "cca-bg"; bg.className = "modal-bg open"; bg.dir = "rtl";
    bg.innerHTML = `<div class="modal" style="max-width:480px"><h3>🏠 تأكيد مع تعديل العنوان</h3><p class="hint">${canEdit() ? "سيُطبَّق التعديل على الطلب ثم يُؤكَّد." : "ستُدوَّن التصحيحات في الملاحظة ثم يُؤكَّد؛ يراجعها المدير قبل الإرسال."}</p>
<div class="field"><label>الولاية</label><select id="cca-w">${W.map(w => `<option value="${esc(w.name)}"${w.name === o.wilaya ? " selected" : ""}>${w.id} — ${esc(w.name)}</option>`).join("")}</select></div>
<div class="field"><label>البلدية</label><select id="cca-c"></select></div>
<div class="field"><label>طريقة التوصيل</label><label><input type="radio" name="cca-t" value="home"${o.dtype !== "stop" ? " checked" : ""}> للمنزل</label> <label><input type="radio" name="cca-t" value="stop"${o.dtype === "stop" ? " checked" : ""}> مكتب</label></div>
<div class="field"><label>ملاحظة العنوان (حيّ، معلم قريب…)</label><input id="cca-n" maxlength="120" placeholder="مثال: حي 5 جويلية، بجانب المسجد"></div>
<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="small green" id="cca-ok">✅ أكّد الطلب</button><button type="button" class="small warn" id="cca-no">إلغاء</button></div></div>`;
    document.body.appendChild(bg); const q = id => bg.querySelector("#" + id), dt = () => (bg.querySelector('input[name="cca-t"]:checked') || {}).value || "home";
    const fillC = keep => { const w = wOf(q("cca-w").value), l = (w && w.communes) || [], cur = keep == null ? o.commune : keep; q("cca-c").innerHTML = (cur && !l.includes(cur) ? `<option value="${esc(cur)}">${esc(cur)}</option>` : "") + l.map(c => `<option value="${esc(c)}"${c === cur ? " selected" : ""}>${esc(c)}</option>`).join(""); };
    fillC(); q("cca-w").onchange = () => fillC(""); const close = () => bg.remove(); q("cca-no").onclick = close; bg.addEventListener("click", e => { if (e.target === bg) close(); });
    q("cca-ok").onclick = async () => {
      const f = { wilaya: q("cca-w").value, commune: q("cca-c").value, dtype: dt() }, note = q("cca-n").value.trim(), txt = [f.wilaya, f.commune, f.dtype === "stop" ? "مكتب" : "منزل", note].filter(Boolean).join(" / ");
      const idx = a.orders.findIndex(x => x.id === o.id); if (idx < 0) { close(); return render(); }
      if (canEdit()) {
        const w = wOf(f.wilaya), q2 = w && a.shipFeeFor ? a.shipFeeFor(w, f.commune, f.dtype) : null, free0 = (Number(o.fee) || 0) === 0;
        f.fee = free0 ? 0 : (q2 ? q2.fee : Number(o.fee) || 0); f.desk = f.dtype === "stop" ? (o.desk || "") : ""; f.total = Math.max(0, (Number(o.subtotal) || 0) - (Number(o.discount) || 0) + f.fee);
        Object.assign(o, f); let saved = false; try { saved = await API.updateOrderFields(a.key, o.id, f); } catch (e) { }
        if (!saved && window.OrderEdit) OrderEdit.stash(o.id, Object.assign({ name: o.name }, f, { desk: f.desk }));
        a.setAddrFix(o, true, txt, true);
      } else a.setAddrFix(o, false, txt, true);
      close(); await a.previewResult(a.orders.findIndex(x => x.id === o.id), "confirm"); afterDecision(o.id, true);
    };
  }
  const idxOf = id => (A().orders || []).findIndex(x => x.id === id);
  async function decide(d) {
    const a = A(), id = S.cur; if (!a || !id) return; let i = idxOf(id); if (i < 0) return render(); const o = a.orders[i], st = S.st;
    if (d === "skip") { S.skip[id] = 1; S.cur = null; return render(); }
    if (d === "confirm") { await a.previewResult(i, "confirm"); }
    else if (d === "cancel") { await a.previewResult(i, "cancel"); }
    else if (d === "noans") { const n = Math.min(3, a.attemptsOf(o) + 1); a.previewResult(i, "a" + n); st.noans++; S.skip[id] = 1; S.cur = null; return render(); }
    else if (d === "tomorrow") { a.previewResult(i, "tomorrow"); st.tomo++; S.cur = null; return render(); }
    else if (d === "addr") { return addrDialog(i); }
    else if (d === "later") { if (a.callMark(o) !== "later") a.previewResult(i, "later"); st.later++; S.skip[id] = 1; S.cur = null; return render(); }
    else if (d === "wrong") { a.previewResult(i, "wrong"); st.wrong++; S.cur = null; return render(); }
    afterDecision(id);
  }
  function afterDecision(id, addr) {
    const a = A(), st = S.st; setTimeout(() => { const j = idxOf(id), o2 = a.orders[j]; if (o2 && o2.status === "confirmee") { st.conf++; if (addr) st.addr++; } else if (o2 && o2.status === "annulee") st.canc++; if (!o2 || o2.status !== "nouvelle") S.cur = null; render(); }, 450);
  }
  function key(e) {
    if (!$("ccm") || $("tab-callcenter").classList.contains("hidden") || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = { c: "confirm", a: "addr", t: "tomorrow", n: "noans", l: "later", w: "wrong", x: "cancel", ArrowLeft: "skip", ArrowRight: "skip" }[e.key.toLowerCase ? (e.key.length === 1 ? e.key.toLowerCase() : e.key) : e.key]; if (m) { e.preventDefault(); decide(m); }
  }
  function init() {
    document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("#ccm [data-d]"); if (b) decide(b.dataset.d); });
    document.addEventListener("keydown", key);
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._ccmWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-callcenter"); if (el) el.classList.toggle("hidden", t !== "callcenter"); if (t === "callcenter") { render(); clearInterval(S.timer); S.timer = setInterval(() => { if (!$("tab-callcenter").classList.contains("hidden") && !document.hidden) render(); }, 8000); } else clearInterval(S.timer); return r; };
      Admin._ccmWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, queue, decide, _s: S };
})();
