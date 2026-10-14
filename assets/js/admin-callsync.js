/* تناسق المدير والمندوبات في الاتصال: (1) بصمة «من اتصل وما النتيجة» 👤<اسم>@<دقيقة> تُكتب في ملاحظة الطلب مع كل نتيجة اتصال/تأكيد/إلغاء فتظهر
   للجميع فوراً؛ (2) الضغط على «اتصل» في معاينة الطلب يقفل الطلب باسم المتصل (🔒) فيخرج من طابور المندوبات لحظتها؛ (3) الإسناد اليدوي 👥<بريد>
   لطلب أو عدة طلبات (يحترمه توزيع مركز الاتصال في كل الأوضاع). كله وسوم في ملاحظة الطلب نفسها، فيصل للجميع بالمزامنة القائمة بلا خادم جديد. */
const CallSync = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const meObj = () => { const R = window.AdminRoles; return (R && R.state && R.state.me) || {}; };
  const nowMin = () => Math.floor(Date.now() / 60000);
  /* اسم المتصل المعروض: المالك «المدير»، وغيره اسمه أو بداية بريده */
  function who() { const m = meObj(); if (m.owner || (!m.email && !m.name)) return "المدير"; return String(m.name || String(m.email).split("@")[0]).replace(/[\s@#👤👥🔒]/g, "_").slice(0, 24); }
  const meId = () => String(meObj().email || (meObj().owner ? "owner" : meObj().name) || "me").replace(/[\s#]/g, "").toLowerCase();
  function stamp(o) { const a = A(); if (!a || !o) return; a.setNoteTag(o, /👤\S+\s*/g, "👤" + who() + "@" + nowMin()); }
  /* آخر إجراء اتصال: {who, ago(د), res} ؛ النتيجة تُشتق من حالة الطلب ووسومه */
  function lastCall(o) {
    const m = String((o && o.note) || "").match(/👤(\S+?)@(\d+)/); if (!m) return null; const a = A() || {};
    const at = a.attemptsOf ? a.attemptsOf(o) : 0, cm = a.callMark ? a.callMark(o) : "", due = a.callDue ? a.callDue(o) : "";
    const res = o.status === "annulee" ? "❌ ألغى الطلب" : o.status === "confirmee" || o.status === "expediee" || o.status === "livree" ? "✅ أكّد الطلب" : at ? "📞 لم يُجب — محاولة " + at : cm === "later" ? (due ? "📅 مؤجَّل إلى " + due : "⏰ أعد الاتصال لاحقاً") : cm === "wrong" ? "📵 رقم خاطئ" : "نتيجة مسجَّلة";
    return { who: m[1].replace(/_/g, " "), ago: Math.max(0, nowMin() - (+m[2])), res };
  }
  const agoTxt = n => (n < 1 ? "الآن" : n < 90 ? "قبل " + n + " د" : n < 2880 ? "قبل " + Math.round(n / 60) + " س" : "قبل " + Math.round(n / 1440) + " يوماً");
  function lastCallText(o) { const l = lastCall(o); return l ? l.res + " — بواسطة " + l.who + " (" + agoTxt(l.ago) + ")" : ""; }
  function assigneeOfNote(o) { const m = String((o && o.note) || "").match(/👥(\S+)/); return m ? m[1].toLowerCase() : ""; }
  /* اسم الموظفة من قائمة الفريق (للمالك) وإلا البريد */
  function nameOf(email) { const st = (window.AdminRoles && AdminRoles.state && AdminRoles.state.team && AdminRoles.state.team.staff) || []; const t = st.find(x => String(x.email).toLowerCase() === String(email).toLowerCase()); return (t && t.name) || email; }
  function canAssign() { const R = window.AdminRoles, m = meObj(); return !R || !m || m.owner === true || (R.has && R.has(m, "orders.edit")); }
  function staff() { return ((window.AdminRoles && AdminRoles.state && AdminRoles.state.team && AdminRoles.state.team.staff) || []).filter(x => x.active && x.email); }
  function assign(orders, email) { const a = A(); (orders || []).forEach(o => a.setNoteTag(o, /👥\S+\s*/g, email ? "👥" + String(email).toLowerCase() : "")); try { a.renderOrders(); } catch (e) { } }
  function assignDialog(orders) {
    const st = staff(); if (!orders || !orders.length) return;
    if (!st.length) { try { toast("لا توجد موظفات مضافات — أضفهن من «الفريق والأمان» أولاً"); } catch (e) { } return; }
    const old = document.getElementById("cs-asg"); if (old) old.remove(); const bg = document.createElement("div"); bg.id = "cs-asg"; bg.className = "modal-bg open";
    bg.innerHTML = '<div class="modal" style="max-width:420px"><h3>👥 إسناد ' + orders.length + ' طلب إلى مندوبة</h3><p class="hint" style="margin-top:0">تراه المندوبة أولاً في مركز الاتصال، وتبقى طلبات الباقيات مخفية عنها (وتساندها بعد المهلة).</p><select id="cs-who" style="width:100%"><option value="">— إزالة الإسناد —</option>' + st.map(x => '<option value="' + esc(String(x.email).toLowerCase()) + '">' + esc(x.name || x.email) + '</option>').join("") + '</select><div class="action-bar" style="margin-top:.8rem"><button class="small gold" id="cs-ok" type="button">✅ تطبيق</button><button class="small gray" id="cs-no" type="button">إلغاء</button></div></div>';
    document.body.appendChild(bg); const close = () => bg.remove();
    bg.querySelector("#cs-no").onclick = close; bg.addEventListener("click", e => { if (e.target === bg) close(); });
    bg.querySelector("#cs-ok").onclick = () => { const v = bg.querySelector("#cs-who").value; assign(orders, v); close(); try { toast(v ? "👥 أُسنِد " + orders.length + " طلب إلى " + nameOf(v) : "↩️ أُزيل الإسناد"); } catch (e) { } };
  }
  /* المتصل يقفل الطلب لحظة الضغط على «اتصل» في المعاينة (لا يقفل المؤكَّد ولا المرسَل) */
  function onCall(e) {
    const l = e.target.closest && e.target.closest("a.call-lnk[data-oid]"); if (!l) return; const a = A(); if (!a) return;
    const o = (a.orders || []).find(x => String(x.id) === l.dataset.oid); if (!o || o.status !== "nouvelle" || a.trackingOf(o)) return;
    a.setNoteTag(o, /🔒\S+\s*/g, "🔒" + meId() + "#" + nowMin());
  }
  function wrap() {
    const a = A(); if (!a || a._csWrapped) return; a._csWrapped = true;
    ["setAttempt", "setCallMark", "postponeOrder"].forEach(k => { const f = a[k]; if (typeof f !== "function") return; a[k] = function (i) { const r = f.apply(this, arguments); try { stamp(this.orders[i]); } catch (e) { } return r; }; });
    const am = a.afterManualStatus; if (typeof am === "function") a.afterManualStatus = function (o, status) { try { if (status === "confirmee" || status === "annulee") stamp(o); } catch (e) { } return am.apply(this, arguments); };
  }
  function init() { document.addEventListener("click", onCall, true); wrap(); setTimeout(wrap, 600); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { stamp, lastCall, lastCallText, assign, assignDialog, canAssign, assigneeOfNote, nameOf, who, meId, wrap };
})();
