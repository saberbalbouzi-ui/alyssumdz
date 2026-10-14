/* مركز الاتصال: بطاقة طلب واحدة بالدور وأزرار كبيرة لقرار الاتصال. كل قرار يمرّ بالمنطق القائم نفسه (Admin.previewResult ← فحص المخزون،
   التأكيد، المحاولات، الإلغاء) بلا منطق موازٍ. الطابور: الطلبات الجديدة الأقدم أولاً، ثم من لم يُجب، ثم «لاحقاً»؛ «رقم خاطئ» مخفي. */
const CallCenter = (() => {
  const $ = id => document.getElementById(id), S = { cur: null, skip: {}, st: { conf: 0, canc: 0, noans: 0, later: 0, tomo: 0, addr: 0, wrong: 0, t0: Date.now() }, timer: 0, perf: null, perfAt: 0, lockBusy: false, lastRef: 0 };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const fmt = n => (Math.round(+n || 0)).toLocaleString("fr-DZ") + " دج";
  /* قفل ناعم (توزيع الطلبات بين المؤكِّدات): وسم 🔒<هويتي>#<دقيقة> في الملاحظة يُكتب عند عرض الطلب عليّ ويُمسح مع أي قرار؛ ينتهي بعد 10 دقائق.
     الطلب المقفول لزميلة يخرج من طابوري، فيذهب كل طلب لمؤكِّدة واحدة. حدّه: نافذة سباق قصيرة (تحديث الطلبات قبل القفل) لا قفل ذرّي في الخادم. */
  const LOCK_MIN = 10, nowMin = () => Math.floor(Date.now() / 60000);
  const meObj = () => { const R = window.AdminRoles; return (R && R.state && R.state.me) || {}; };
  const meId = () => String(meObj().email || (meObj().owner ? "owner" : meObj().name) || "me").replace(/[\s#]/g, "").toLowerCase();
  const lockOf = o => { const m = String((o && o.note) || "").match(/🔒(\S+)#(\d+)/); return m ? { who: m[1], min: +m[2] } : null; };
  const foreign = o => { const l = lockOf(o); return !!l && l.who !== meId() && nowMin() - l.min < LOCK_MIN; };
  const today = () => (A() && A().isoDay ? A().isoDay() : new Date().toISOString().slice(0, 10));
  /* مؤجَّل إلى تاريخ لم يحلّ بعد ⟵ خارج الطابور؛ إذا حلّ التاريخ صار في المقدمة (قبل الجديد) كي لا يُنسى */
  const parked = o => { const a = A(), d = a && a.callDue ? a.callDue(o) : ""; return !!d && d > today(); };
  const dueNow = o => { const a = A(), d = a && a.callDue ? a.callDue(o) : ""; return !!d && d <= today(); };
  function base() {
    const a = A(); if (!a || !Array.isArray(a.orders)) return [];
    return a.orders.map((o, i) => ({ o, i })).filter(x => x.o.status === "nouvelle" && a.callMark(x.o) !== "wrong" && !(x.o.note && /🗑/.test(x.o.note)) && !a.trackingOf(x.o));
  }
  const parkedCount = () => base().filter(x => parked(x.o)).length;
  const lockedCount = () => base().filter(x => !parked(x.o) && foreign(x.o)).length;
  /* التوزيع المسبق (يضبطه المالك في «نشاط الفريق»): كل طلب مُسنَد بتجزئة معرّفه إلى موظفة بحسب حصتها؛ من هي في القائمة ترى طلباتها أولاً،
     ثم طلبات الزميلات التي بقيت بلا استجابة أكثر من «مساندة بعد» دقيقة (الافتراضي 20). المالك والموظفة خارج القائمة يريان الجميع. */
  const assignCfg = () => { const g = (S.perf && S.perf.goal) || {}; return g.assign && g.assign.on ? g.assign : null; };
  const meInPlan = as => !!as && (window.AdminRoles && AdminRoles.inPlan ? AdminRoles.inPlan(as, meId()) : Math.round(+((as.weights || {})[meId()]) || 0) > 0);
  const wilIds = o => { const W = typeof WILAYAS !== "undefined" ? WILAYAS : [], w = W.find(x => x.name === o.wilaya); return w ? { wid: String(w.id), wpar: w.par ? String(w.par) : "" } : { wid: "", wpar: "" }; };
  const ctxOf = o => { const a = A(); let company = ""; try { company = a.orderCompanyKey ? a.orderCompanyKey(o) : ""; } catch (e) { } return Object.assign({ id: o.id, note: o.note, company }, wilIds(o)); };
  const overMs = as => Math.max(5, +as.overflow || 20) * 60000;
  function mineOrHelp(o, as) {
    const who = window.AdminRoles && AdminRoles.assigneeOf ? AdminRoles.assigneeOf(ctxOf(o), as) : "";
    if (!who || who === meId()) return 0;
    return Date.now() - new Date(o.date) >= overMs(as) ? 1 : -1;      // 1 = مساندة، -1 = ليس لي الآن
  }
  function queue() {
    const a = A(); if (!a) return [];
    const rank = o => (dueNow(o) ? -1 : a.callMark(o) === "later" ? 4 : a.attemptsOf(o) ? a.attemptsOf(o) : 0), as = assignCfg(), plan = meInPlan(as);
    const fol = (a.orders || []).map((o, i) => ({ o, i, f: true })).filter(x => a.failedAttempt && a.failedAttempt(x.o)).sort((p, q) => new Date(p.o.date) - new Date(q.o.date));
    return fol.concat(base().filter(x => !parked(x.o) && !foreign(x.o) && (!plan || mineOrHelp(x.o, as) >= 0))
      .sort((p, q) => (plan ? mineOrHelp(p.o, as) - mineOrHelp(q.o, as) : 0) || rank(p.o) - rank(q.o) || new Date(p.o.date) - new Date(q.o.date)));
  }
  const helpCount = () => { const as = assignCfg(); return meInPlan(as) ? queue().filter(x => !x.f && mineOrHelp(x.o, as) === 1).length : 0; };
  const hiddenCount = () => { const as = assignCfg(); return meInPlan(as) ? base().filter(x => !parked(x.o) && !foreign(x.o) && mineOrHelp(x.o, as) < 0).length : 0; };
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
.ccm-quick a.t{background:linear-gradient(180deg,rgba(170,220,10,.4),rgba(170,220,10,.16));border-color:rgba(170,220,10,.6)}
.ccm-act{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem}.ccm-act button{padding:1rem .6rem;border-radius:14px;font:inherit;font-weight:900;font-size:1.05rem;color:#fff;cursor:pointer;min-height:56px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);transition:transform .15s}
.ccm-act button:hover{transform:translateY(-2px)}.ccm-act .ok{grid-column:1/-1;background:linear-gradient(180deg,rgba(170,220,10,.45),rgba(170,220,10,.18));border-color:rgba(170,220,10,.65);min-height:68px;font-size:1.25rem}
.ccm-act .ok2{grid-column:1/-1;background:linear-gradient(180deg,rgba(170,220,10,.3),rgba(170,220,10,.1));border-color:rgba(170,220,10,.5)}.ccm-act .wa{background:linear-gradient(180deg,rgba(245,158,11,.4),rgba(245,158,11,.16));border-color:rgba(245,158,11,.6)}.ccm-act .no{background:linear-gradient(180deg,rgba(239,68,68,.38),rgba(239,68,68,.14));border-color:rgba(239,68,68,.55)}
.ccm-warn{padding:.5rem .7rem;border-radius:10px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.5)}.ccm-k{opacity:.6;font-size:.75rem;font-weight:400}
html.white .ccm-card{background:#fff;color:#0f172a;border-color:#d2d9e3}html.white .ccm-it{background:#f3f5f9}html.white .ccm-quick a,html.white .ccm-act button{color:#0f172a}html.white .ccm-chip{background:#f3f5f9;border-color:#d2d9e3}`;
    document.head.appendChild(st);
  };
  /* مؤشرات الموظفة: هدف التأكيد اليومي وزمن أول استجابة (من الخادم؛ للمالك: حسابه إن عُرف وإلا مجموع الفريق) */
  async function loadPerf(force) {
    const R = window.AdminRoles; if (!R || !R.perf || (!force && Date.now() - S.perfAt < 45000)) return; S.perfAt = Date.now();
    const j = await R.perf(7); if (j) { S.perf = j; if ($("ccm") && !$("tab-callcenter").classList.contains("hidden")) { const k = $("ccm-kpi"); if (k) k.outerHTML = kpiHtml(); } }
  }
  function kpiHtml() {
    const P = S.perf, R = window.AdminRoles; if (!P) return '<div id="ccm-kpi"></div>';
    const me = meObj(), mine = l => (me.owner && me.email ? (l || []).filter(x => x.actor === String(me.email).toLowerCase()) : (l || []));
    const conf = mine(P.today).reduce((t, x) => t + (+x.conf || 0), 0), g = (R && R.goalFor ? R.goalFor(P.goal, me.owner ? "" : String(me.email || "").toLowerCase()) : (P.goal || {})), rs = mine(P.rows), med = rs.length ? rs.reduce((t, x) => t + (+x.med_min || 0), 0) / rs.length : null, fast = rs.length ? Math.round(rs.reduce((t, x) => t + (+x.fast_pct || 0), 0) / rs.length) : null;
    const pct = g.daily ? Math.min(100, Math.round(conf / g.daily * 100)) : 0;
    return '<div id="ccm-kpi" class="ccm-bar">' + (g.daily ? '<span class="ccm-chip" style="flex:1;min-width:210px">🎯 هدف اليوم: <b>' + conf + ' / ' + g.daily + '</b> تأكيد' + (conf >= g.daily ? ' ✅' : '') + '<span style="display:block;height:6px;border-radius:6px;background:rgba(255,255,255,.14);margin-top:.3rem"><i style="display:block;height:6px;border-radius:6px;width:' + pct + '%;background:' + (pct >= 100 ? '#22c55e' : '#fbbf24') + '"></i></span></span>' : '<span class="ccm-chip">✅ تأكيدات اليوم: <b>' + conf + '</b></span>') +
      '<span class="ccm-chip" style="color:' + (R ? R.respTone(med) : "") + '">⏱ أول استجابة: <b>' + (R ? R.fmtMin(med) : "—") + '</b>' + (fast == null ? "" : ' · ≤15 د: ' + fast + '%') + '</span>' + (g.rate ? '<span class="ccm-chip">هدف النسبة ≥ ' + g.rate + '%</span>' : "") + '</div>';
  }
  /* سبب الإلغاء: أزرار سريعة؛ يُكتب الوسم ويُنتظر حفظه قبل تغيير الحالة كي يلتقطه سجلّ التدقيق */
  function reasonDialog(o, done) {
    const old = $("ccr-bg"); if (old) old.remove(); const L = (window.AdminRoles && AdminRoles.CANCEL_REASONS) || { other: "سبب آخر" };
    const bg = document.createElement("div"); bg.id = "ccr-bg"; bg.className = "modal-bg open"; bg.dir = "rtl";
    bg.innerHTML = `<div class="modal" style="max-width:440px"><h3>❌ لماذا أُلغي الطلب؟</h3><p class="hint">يُسجَّل السبب لتعرف أكثر أسباب الإلغاء.</p><div class="ccm-act" style="grid-template-columns:repeat(2,1fr)">${Object.entries(L).map(([k, v]) => `<button type="button" data-r="${esc(k)}">${esc(v)}</button>`).join("")}<button type="button" data-r="" style="grid-column:1/-1;opacity:.75">بدون سبب</button></div><div style="margin-top:.6rem"><button type="button" class="small warn" id="ccr-no">تراجع</button></div></div>`;
    document.body.appendChild(bg); const close = () => bg.remove(); bg.querySelector("#ccr-no").onclick = close; bg.addEventListener("click", e => { if (e.target === bg) close(); });
    bg.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
      const k = b.dataset.r, a = A(); close();
      if (k) { const clean = String(o.note || "").replace(/❌سبب:\S+\s*/g, "").trim(); o.note = (clean ? clean + " " : "") + "❌سبب:" + k; try { await API.updateOrder(a.key, o.id, undefined, o.note); } catch (e) { } }
      done();
    });
  }
  /* يأخذ القفل على الطلب المعروض: يحدّث الطلبات أولاً، فإن سبقتني زميلة إليه انتقلتُ لغيره */
  async function ensureLock() {
    const a = A(), id = S.cur; if (!a || !id || S.lockBusy) return; let i = idxOf(id); if (i < 0) return;
    if (a.failedAttempt && a.failedAttempt(a.orders[i])) return;
    const l = lockOf(a.orders[i]); if (l && l.who === meId() && nowMin() - l.min < LOCK_MIN / 2) return;
    S.lockBusy = true; let redo = false;
    try {
      if (a.refreshAlerts && Date.now() - S.lastRef > 4000) { S.lastRef = Date.now(); await a.refreshAlerts(); }
      i = idxOf(id); const o2 = a.orders[i];
      if (!o2 || o2.status !== "nouvelle" || foreign(o2)) { if (S.cur === id) { S.skip[id] = 1; S.cur = null; } redo = true; }
      else a.setNoteTag(o2, /🔒\S+\s*/g, "🔒" + meId() + "#" + nowMin());
    } catch (e) { } finally { S.lockBusy = false; }
    if (redo) render();
  }
  const unlock = o => { const a = A(); if (a && o && lockOf(o)) a.setNoteTag(o, /🔒\S+\s*/g, ""); };
  function render() { render0(); if (S.cur) ensureLock(); loadPerf(); }
  function render0() {
    const host = $("callcenter-content"); if (!host) return; css(); const a = A(); if (!a) return;
    const q = queue(), cur = pick(q), st = S.st, done = st.conf + st.canc, mins = Math.max(1, Math.round((Date.now() - st.t0) / 60000));
    const bar = `<div class="ccm-bar"><span class="ccm-chip">المتبقي: <b>${q.length}</b></span>${q.some(x => x.f) ? `<span class="ccm-chip" style="background:rgba(245,158,11,.25)">📦 متابعة توصيل: <b>${q.filter(x => x.f).length}</b></span>` : ""}<span class="ccm-chip">✅ ${st.conf}${st.addr ? " (🏠" + st.addr + ")" : ""} · ❌ ${st.canc} · 📞 ${st.noans} · ⏰ ${st.later} · 📅 ${st.tomo}</span>${parkedCount() ? `<span class="ccm-chip">📅 مؤجَّل لاحقاً: <b>${parkedCount()}</b></span>` : ""}${lockedCount() ? `<span class="ccm-chip">🔒 عند زميلاتك: <b>${lockedCount()}</b></span>` : ""}${assignCfg() && meInPlan(assignCfg()) ? `<span class="ccm-chip">👤 للزميلات: <b>${hiddenCount()}</b> · 🤝 مساندة: <b>${helpCount()}</b></span>` : ""}${(a.overdueList && a.overdueList().length) ? `<span class="ccm-chip" style="color:#fca5a5;border-color:#fca5a5">⚠ بلا استجابة >${a.overdueMin()} د: <b>${a.overdueList().length}</b></span>` : ""}
<span class="ccm-chip">نسبة التأكيد: <b>${done ? Math.round(st.conf / done * 100) : 0}%</b> · ${(done / mins * 60).toFixed(0)} قرار/ساعة</span></div>`;
    const kp = kpiHtml();
    if (!cur) { host.innerHTML = `<div id="ccm">${bar}${kp}<div class="ccm-card"><h2>🎉 لا طلبات بانتظار الاتصال</h2><p class="ccm-m">سيظهر الطلب الجديد هنا تلقائياً.</p></div></div>`; return; }
    if (cur.f) { host.innerHTML = `<div id="ccm" data-i="${cur.i}" data-id="${esc(cur.o.id)}">${bar}${kp}${followCard(cur.o, cur.i)}</div>`; return; }
    const o = cur.o, i = cur.i, at = a.attemptsOf(o), cm = a.callMark(o), ph = String(o.phone || "").replace(/\D/g, ""), intl = ph.startsWith("0") ? "213" + ph.slice(1) : ph;
    let short = null; try { short = window.StockCheck && StockCheck.shortOf ? StockCheck.shortOf(o) : null; } catch (e) { }
    const age = Math.max(0, Math.round((Date.now() - new Date(o.date)) / 60000));
    host.innerHTML = `<div id="ccm" data-i="${i}" data-id="${esc(o.id)}">${bar}${kp}
<div class="ccm-card"><div class="ccm-bar"><h2>${esc(o.name || "بدون اسم")}</h2><span class="ccm-chip">${at ? "📞 غير متاح — محاولة " + at + "/3" : dueNow(o) ? "📅 موعد اليوم" : cm === "later" ? "⏰ لاحقاً" : "🆕 جديد"} · <span style="color:${age <= 15 ? "#d4ff4d" : age <= 60 ? "#fcd34d" : "#fca5a5"}">منذ ${age < 90 ? age + " د" : Math.round(age / 60) + " س"}</span></span></div>
<div class="ccm-ph" dir="ltr">${esc(o.phone)}</div>
<div class="ccm-quick"><a class="t" href="tel:${esc(ph.startsWith("0") ? "+213" + ph.slice(1) : "+" + ph)}">📞 اتصل</a><a href="https://wa.me/${intl}" target="_blank" rel="noopener">💬 واتساب</a></div>
<div class="ccm-m">${esc([o.wilaya, o.commune].filter(Boolean).join(" / ") || "—")} · ${o.dtype === "stop" ? "مكتب" : "للمنزل"} · <b>${fmt(o.total)}</b></div>
${csLine(o)}<div class="ccm-it">${esc(a.itemsDisplay(o))}</div>
${short ? '<div class="ccm-warn">⚠️ المخزون لا يكفي لهذا الطلب — سيُطلب منك تأكيد قبل أي اتصال أو تأكيد.</div>' : ""}
${o.note ? `<div class="ccm-m">📝 ${esc(String(o.note).replace(/📞[1-3]|⏰لاحقاً|📵خطأ|📅\d{4}-\d{2}-\d{2}|🏠[✔⏳](?: «[^»]*»)?|🔒\S+|❌سبب:\S+|📲\S+|👤\S+|👥\S+/g, "").trim())}</div>` : ""}
<div class="ccm-act"><button class="ok" data-d="confirm">✅ تأكيد الطلب <span class="ccm-k">C</span></button>
<button class="ok2" data-d="addr">🏠 تأكيد مع تعديل العنوان <span class="ccm-k">A</span></button>
<button data-d="noans">📞 غير متاح — محاولة ${Math.min(3, at + 1)} <span class="ccm-k">N</span></button><button class="wa" data-d="later">⏰ لاحقاً اليوم <span class="ccm-k">L</span></button>
<button class="wa" data-d="tomorrow">📅 مؤجَّل إلى الغد <span class="ccm-k">T</span></button><button data-d="wrong">📵 رقم خاطئ <span class="ccm-k">W</span></button>
<button class="no" data-d="cancel" style="grid-column:1/-1">❌ إلغاء <span class="ccm-k">X</span></button>
<button data-d="skip" style="grid-column:1/-1">⏭ تخطَّ إلى التالي <span class="ccm-k">→</span></button></div></div></div>`;
  }

  /* بطاقة متابعة توصيل فاشل: الزبون لم يستلم الطرد (Tentative échouée) فيُتصل به لمعرفة سبب الفشل واتخاذ الإجراء */
  /* من اتصل آخر مرة وما النتيجة + المسند إليها يدوياً (من CallSync) */
  function csLine(o) { const cs = window.CallSync; if (!cs) return ""; const t = cs.lastCallText(o), as = cs.assigneeOfNote(o); return (t ? `<div class="ccm-m">🕘 آخر إجراء: <b>${esc(t)}</b></div>` : "") + (as ? `<div class="ccm-m">👥 مسنَد إلى: <b>${esc(cs.nameOf(as))}</b></div>` : ""); }
  function followCard(o, i) {
    const a = A(), ph = String(o.phone || "").replace(/\D/g, ""), intl = ph.startsWith("0") ? "213" + ph.slice(1) : ph, t = a.trackingOf(o) || {}, raw = a.rawShip(o) || "Tentative échouée";
    const co = (a.allDeliveryCompanies && (a.allDeliveryCompanies()[t.company] || {}).name) || t.company || "";
    return `<div class="ccm-card"><div class="ccm-bar"><h2>${esc(o.name || "بدون اسم")}</h2><span class="ccm-chip" style="background:rgba(245,158,11,.25);border-color:rgba(245,158,11,.6)">📦 توصيل فاشل — يحتاج متابعة</span></div>
<div class="ccm-warn">⚠️ حالة الطرد عند الشركة: <b>${esc(raw)}</b> · التتبع <b dir="ltr">${esc(t.tracking || "—")}</b>${co ? " · " + esc(co) : ""} — اتصل بالزبون لمعرفة السبب (غائب؟ عنوان خاطئ؟ رفض؟) ثم سجّل النتيجة.</div>
<div class="ccm-ph" dir="ltr">${esc(o.phone)}</div>
<div class="ccm-quick"><a class="t" href="tel:${esc(ph.startsWith("0") ? "+213" + ph.slice(1) : "+" + ph)}">📞 اتصل</a><a href="https://wa.me/${intl}" target="_blank" rel="noopener">💬 واتساب</a></div>
<div class="ccm-m">${esc([o.wilaya, o.commune].filter(Boolean).join(" / ") || "—")} · ${o.dtype === "stop" ? "مكتب" : "للمنزل"} · <b>${fmt(o.total)}</b></div>
${csLine(o)}<div class="ccm-it">${esc(a.itemsDisplay(o))}</div>
<div class="ccm-act"><button class="ok" data-d="fok">✅ تواصلت — الزبون سيستلم</button>
<button class="wa" data-d="fno">📞 لم يرد — أعد المحاولة غداً</button><button class="no" data-d="fref">🚫 رفض الاستلام</button>
<button data-d="fopen" style="grid-column:1/-1">📋 فتح الطلب (تعديل العنوان أو غيره)</button>
<button data-d="skip" style="grid-column:1/-1">⏭ تخطَّ إلى التالي</button></div></div>`;
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
    if (d === "fok" || d === "fno" || d === "fref" || d === "fopen") {
      if (d === "fopen") { try { a.openOrderPreview(i); } catch (e) { } return; }
      a.setFollow(o, d === "fok" ? "ok" : d === "fno" ? "no" : "ref"); st.follow = (st.follow || 0) + 1; S.cur = null; toast(d === "fref" ? "🚫 سُجّل رفض الاستلام — يمكنك إلغاء الطلب أو إرجاعه من الطلبات" : d === "fok" ? "✅ سُجّلت المتابعة" : "📞 سيعود الطلب غداً إن بقي بلا استلام"); return render();
    }
    if (d === "skip") { unlock(o); S.skip[id] = 1; S.cur = null; return render(); }
    if (d === "confirm") { await a.previewResult(i, "confirm"); }
    else if (d === "cancel") { return reasonDialog(o, async () => { const j = idxOf(id); if (j < 0) return render(); await a.previewResult(j, "cancel"); afterDecision(id); }); }
    else if (d === "noans") { const n = Math.min(3, a.attemptsOf(o) + 1); a.previewResult(i, "a" + n); st.noans++; S.skip[id] = 1; S.cur = null; return render(); }
    else if (d === "tomorrow") { a.previewResult(i, "tomorrow"); st.tomo++; S.cur = null; return render(); }
    else if (d === "addr") { return addrDialog(i); }
    else if (d === "later") { if (a.callMark(o) !== "later") a.previewResult(i, "later"); st.later++; S.skip[id] = 1; S.cur = null; return render(); }
    else if (d === "wrong") { a.previewResult(i, "wrong"); st.wrong++; S.cur = null; return render(); }
    afterDecision(id);
  }
  function afterDecision(id, addr) {
    const a = A(), st = S.st; setTimeout(() => { const j = idxOf(id), o2 = a.orders[j]; if (o2 && o2.status === "confirmee") { st.conf++; if (addr) st.addr++; } else if (o2 && o2.status === "annulee") st.canc++; if (!o2 || o2.status !== "nouvelle") S.cur = null; render(); loadPerf(true); }, 450);
  }
  function key(e) {
    if (!$("ccm") || $("tab-callcenter").classList.contains("hidden") || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = { c: "confirm", a: "addr", t: "tomorrow", n: "noans", l: "later", w: "wrong", x: "cancel", ArrowLeft: "skip", ArrowRight: "skip" }[e.key.toLowerCase ? (e.key.length === 1 ? e.key.toLowerCase() : e.key) : e.key]; if (m) { e.preventDefault(); decide(m); }
  }
  function init() {
    document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("#ccm [data-d]"); if (b) decide(b.dataset.d); });
    document.addEventListener("keydown", key);
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._ccmWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-callcenter"); if (el) el.classList.toggle("hidden", t !== "callcenter"); if (t === "callcenter") { render(); clearInterval(S.timer); S.timer = setInterval(() => { if ($("tab-callcenter").classList.contains("hidden") || document.hidden) return; if (Admin.refreshAlerts && Date.now() - S.lastRef > 10000) { S.lastRef = Date.now(); Admin.refreshAlerts().then(render, render); } else render(); }, 6000); } else clearInterval(S.timer); return r; };
      Admin._ccmWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, queue, decide, ensureLock, lockOf, kpiHtml, loadPerf, _s: S };
})();
