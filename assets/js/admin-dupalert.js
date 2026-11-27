/* تنبيه الطلب المكرَّر: زبون واحد (نفس الهاتف أو نفس الاسم والولاية) له طلبان خلال 3 أيام:
   وسم ⚠️ في جدول الطلبات، تنبيه فوري عند وصول طلب كهذا، بند «يحتاج انتباهك» في الرئيسية مع قائمة التفاصيل، وتأكيد قبل إرسال الطلب لشركة التوصيل
   إن كان للزبون طلب آخر سبق تأكيده/إرساله (لئلا يُشحن طرداه). الإرسال التلقائي يتوقف عند المكرَّر ويُترك لك القرار. */
const AdminDup = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : {}), DAY = 864e5, WIN = 3 * DAY, SEEN = "alyssum_dup_seen";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tr = s => { try { return typeof AdminI18n !== "undefined" ? AdminI18n.t(s) : s; } catch (_) { return s; } };
  const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]/g, "");
  const phoneK = o => { try { const p = A().normalizePhone ? A().normalizePhone(o.phone) : String(o.phone || "").replace(/\D/g, ""); return p && p.length >= 8 ? p : ""; } catch (_) { return ""; } };
  const nameK = o => { const n = String(o.name || "").trim(); return n.split(/\s+/).length >= 2 && o.wilaya ? norm(n) + "|" + norm(o.wilaya) : ""; };
  const ST = { nouvelle: "جديد", confirmee: "مؤكَّد", expediee: "في الطريق", livree: "مسلَّم", annulee: "ملغى", echec: "فشل/مرتجع" };
  const real = o => { try { return typeof AdminPayments !== "undefined" && AdminPayments.effStatus ? AdminPayments.effStatus(o) : o.status; } catch (_) { return o.status; } };
  /* الطلبات الأخرى لنفس الزبون خلال 3 أيام (غير الملغاة) */
  function others(o) {
    if (!o || !o.date) return []; const t = Date.parse(o.date); if (!isFinite(t)) return []; const pk = phoneK(o), nk = nameK(o); if (!pk && !nk) return [];
    return (A().orders || []).filter(x => x && x !== o && x.id !== o.id && x.status !== "annulee" && x.date && Math.abs(Date.parse(x.date) - t) <= WIN && ((pk && phoneK(x) === pk) || (nk && nameK(x) === nk)));
  }
  const line = x => "#" + String(x.id).slice(-6) + " · " + String(x.date).slice(0, 10) + " · " + tr(ST[real(x)] || real(x)) + " · " + (Number(x.total) || 0).toLocaleString("fr-DZ") + " " + tr("دج");
  function badge(o) {
    if (!o || o.status === "annulee") return ""; const d = others(o); if (!d.length) return "";
    return ' <span class="dupb" title="' + esc(tr("طلب آخر لنفس الزبون خلال 3 أيام") + ":\n" + d.map(line).join("\n")) + '" style="display:inline-block;background:#fff3cd;color:#8a5a00;border:1px solid #f0b429;border-radius:999px;padding:0 .45rem;font-size:.72rem;font-weight:800">⚠️ ' + tr("مكرّر") + " (" + d.length + ")</span>";
  }
  /* طلبات لها مكرّر وما زالت قيد المتابعة (حديثة، غير مسلَّمة ولا ملغاة) */
  function active(days) {
    const lim = Date.now() - (days || 7) * DAY; return (A().orders || []).filter(o => o && o.date && Date.parse(o.date) >= lim && !["annulee", "livree", "echec"].includes(real(o)) && others(o).length);
  }
  /* مجموعات للعرض: كل مجموعة = زبون وطلباته المتقاربة */
  function groups() {
    const seen = new Set(), out = [];
    active(14).forEach(o => { if (seen.has(o.id)) return; const g = [o].concat(others(o)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)); g.forEach(x => seen.add(x.id)); out.push(g); });
    return out;
  }
  function open() {
    const G = groups(), old = document.getElementById("dup-bg"); if (old) old.remove();
    const bg = document.createElement("div"); bg.id = "dup-bg"; bg.className = "modal-bg open";
    bg.innerHTML = '<div class="modal" style="max-width:720px"><h3>⚠️ ' + tr("طلبات مكرّرة خلال 3 أيام") + '</h3>' + (G.length ? G.map(g => '<div class="card" style="margin:.5rem 0"><b>' + esc(g[0].name || "") + '</b> <small>· ' + esc(g[0].wilaya || "") + ' · <span dir="ltr">' + esc(g[0].phone || "") + '</span></small>' + g.map(x => '<div style="margin:.25rem 0">' + esc(line(x)) + '</div>').join("") + "</div>").join("") : '<p class="hint">' + tr("لا طلبات مكرّرة حالياً") + "</p>") + '<div class="action-bar"><button class="small" type="button" id="dup-x">' + tr("إغلاق") + "</button></div></div>";
    document.body.appendChild(bg); bg.querySelector("#dup-x").onclick = () => bg.remove(); bg.onclick = e => { if (e.target === bg) bg.remove(); };
  }
  /* تنبيه فوري مرة واحدة لكل طلب جديد له مكرّر */
  function notifyNew() {
    try {
      let seen = {}; try { seen = JSON.parse(localStorage.getItem(SEEN) || "{}") || {}; } catch (_) { }
      const first = !Object.keys(seen).length && !localStorage.getItem(SEEN + "_init"); let fresh = [];
      (A().orders || []).forEach(o => { if (!o || !o.id || seen[o.id] || o.status === "annulee") return; if (others(o).length) { if (Date.now() - Date.parse(o.date) < DAY) fresh.push(o); seen[o.id] = 1; } });
      try { localStorage.setItem(SEEN + "_init", "1"); localStorage.setItem(SEEN, JSON.stringify(seen)); } catch (_) { }
      if (first) fresh = []; /* أول تشغيل: لا نغرق المستخدم بتنبيهات للقديم */
      fresh.slice(0, 3).forEach(o => { if (typeof toast === "function") toast("⚠️ " + tr("طلب مكرّر") + ": " + (o.name || "") + " — " + tr("لديه طلب آخر خلال 3 أيام")); });
    } catch (e) { console.warn("AdminDup", e); }
  }
  function install() {
    const a = A(); if (!a || a.__dupWrapped) return; a.__dupWrapped = true;
    const send = a.sendOrderToDelivery;
    if (typeof send === "function") a.sendOrderToDelivery = async function (i, k) {
      const o = this.orders && this.orders[i];
      if (o && !(this._dupAck || {})[o.id]) {
        const d = others(o).filter(x => ["confirmee", "expediee", "livree"].includes(real(x)) || (A().trackingOf && A().trackingOf(x)));
        if (d.length) {
          if (this._autoReg) { this._autoFail = tr("طلب مكرّر — راجعه يدوياً"); if (typeof toast === "function") toast("⚠️ " + tr("طلب مكرّر") + " " + (o.name || "") + " — " + tr("لم يُرسل تلقائياً")); return false; }
          const msg = tr("لهذا الزبون طلب آخر خلال 3 أيام:") + "\n" + d.map(line).join("\n") + "\n\n" + tr("هل تريد إرسال هذا الطلب أيضاً؟ (قد يُشحن طردان لنفس الشخص)");
          if (!confirm(msg)) return false; this._dupAck = this._dupAck || {}; this._dupAck[o.id] = 1;
        }
      }
      return send.call(this, i, k);
    };
    const ro = a.renderOrders; if (typeof ro === "function") a.renderOrders = function () { const r = ro.apply(this, arguments); setTimeout(notifyNew, 300); return r; };
  }
  if (typeof document !== "undefined") { if (document.readyState === "complete") install(); else window.addEventListener("load", () => setTimeout(install, 0)); }
  return { others, badge, active, groups, open, notifyNew, install };
})();
