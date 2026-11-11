/* فصل المدفوعات والإحصائيات حسب شركة التوصيل (ياليدين، WeCan، وأي شركة مفعّلة) مع خلاصة عامة:
   الشركة = شركة وسم التتبع 🚚 على الطلب (الشركة التي أُرسل إليها فعلاً)؛ الطلبات بلا تتبع تُجمع في «غير مرسلة».
   تُستعمل من تبويب الإحصائيات (بطاقة «حسب شركة التوصيل») ومن admin-payments.js (شرائح الشركات وخلاصة المدفوعات). */
const AdminCoStats = (() => {
  const NONE = "none", A = () => (typeof Admin !== "undefined" ? Admin : {});
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dz = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ");
  const S = { days: 30 };
  function keyOf(o) { try { const t = A().trackingOf ? A().trackingOf(o) : null; return t && t.company ? String(t.company) : NONE; } catch (_) { return NONE; } }
  function coMap() { try { return (A().allDeliveryCompanies && A().allDeliveryCompanies()) || {}; } catch (_) { return {}; } }
  function nameOf(k) { if (k === NONE) return "غير مرسلة لشركة"; if (k === "manual") return "مدفوعات يدوية"; const c = coMap()[k]; return (c && (c.name || c.label)) || k; }
  /* مفاتيح الشركات: المفعّلة أولاً ثم أي شركة ظهرت في الطلبات، ثم «غير مرسلة» */
  function keysFor(keys) {
    let en = []; try { en = (A().enabledCompanyKeys && A().enabledCompanyKeys()) || []; } catch (_) { }
    const out = en.slice(); let hasNone = false;
    keys.forEach(k => { if (k === NONE) hasNone = true; else if (!out.includes(k)) out.push(k); });
    if (hasNone) out.push(NONE); return out;
  }
  const blank = () => ({ n: 0, cancelled: 0, confirmed: 0, transit: 0, delivered: 0, returned: 0, fresh: 0, revenue: 0, transitAmt: 0, returnedAmt: 0, fees: 0 });
  function add(g, o) {
    const st = String(o.status || "").toLowerCase(), tot = Number(o.total) || 0; g.n++;
    if (st === "annulee") g.cancelled++;
    else if (st === "livree") { g.delivered++; g.revenue += tot; g.fees += Number(o.fee) || 0; }
    else if (st === "echec") { g.returned++; g.returnedAmt += tot; }
    else if (st === "expediee") { g.transit++; g.transitAmt += tot; }
    else if (st === "confirmee") g.confirmed++;
    else g.fresh++;
  }
  /* تجميع الطلبات (آخر days يوماً؛ 0 = الكل): { keys:[…], by:{key:{…}}, total:{…} } */
  function aggregate(orders, days) {
    const since = days > 0 ? Date.now() - days * 24 * 3600 * 1000 : 0, by = {}, total = blank(), seen = [];
    (orders || []).forEach(o => {
      if (!o) return; const t = new Date(o.date).getTime(); if (since && !(t >= since)) return;
      const k = keyOf(o); if (!by[k]) { by[k] = blank(); seen.push(k); } add(by[k], o); add(total, o);
    });
    const keys = keysFor(seen); keys.forEach(k => { if (!by[k]) by[k] = blank(); });
    return { keys, by, total };
  }
  const rate = (a, b) => (b > 0 ? Math.round(a * 1000 / b) / 10 + "%" : "—");
  function row(label, g, strong) {
    const done = g.delivered + g.returned, st = strong ? "font-weight:800;border-top:2px solid rgba(var(--g-mint-rgb,226,254,23),.4)" : "";
    return `<tr style="${st}"><td style="text-align:start"><b>${esc(label)}</b></td><td>${g.n}</td><td>${g.transit}</td><td>${g.delivered}</td><td>${g.returned}</td><td>${rate(g.delivered, done)}</td><td>${dz(g.revenue)} دج</td><td>${dz(g.transitAmt)} دج</td><td>${dz(g.fees)} دج</td></tr>`;
  }
  function tableHtml(agg) {
    const rows = agg.keys.map(k => { if (k === NONE) return ""; return row(nameOf(k), agg.by[k]); }).join("");
    const none = agg.by[NONE], noneRow = none && none.n ? `<tr><td style="text-align:start"><b>${esc(nameOf(NONE))}</b></td><td>${none.n}</td><td colspan="2" class="hint">جديدة ${none.fresh} · مؤكَّدة ${none.confirmed}</td><td colspan="5" class="hint">ملغاة ${none.cancelled}</td></tr>` : "";
    return `<div style="overflow:auto"><table><tr><th style="text-align:start">الشركة</th><th>الطلبات</th><th>في الطريق</th><th>مسلَّمة</th><th>مرتجعة</th><th>نسبة التسليم</th><th>مبيعات المسلَّم</th><th>قيد التوصيل</th><th>رسوم التوصيل المحصَّلة</th></tr>${rows}${noneRow}${row("الخلاصة العامة", agg.total, true)}</table></div>`;
  }
  /* بطاقة تبويب الإحصائيات */
  function statsCard() {
    const orders = (A().orders || []), agg = aggregate(orders, S.days);
    return `<div class="search-bar"><b style="color:var(--green)">🚚 إحصائيات حسب شركة التوصيل</b><select id="costats-days" aria-label="الفترة"><option value="7"${S.days === 7 ? " selected" : ""}>آخر 7 أيام</option><option value="30"${S.days === 30 ? " selected" : ""}>آخر 30 يوماً</option><option value="90"${S.days === 90 ? " selected" : ""}>آخر 90 يوماً</option><option value="0"${S.days === 0 ? " selected" : ""}>كل الفترات</option></select></div>
      <div class="hint">لكل شركة طلباتها المُرسَلة إليها فعلاً (من وسم التتبع) ونسبة التسليم = المسلَّم ÷ (المسلَّم + المرتجع)، وفي الأسفل الخلاصة العامة لكل الشركات.</div>${tableHtml(agg)}`;
  }
  function renderStats() {
    const tab = document.getElementById("tab-analytics"); if (!tab) return;
    let card = document.getElementById("analytics-co-card");
    if (!card) { card = document.createElement("div"); card.className = "card"; card.id = "analytics-co-card"; const sum = document.getElementById("analytics-summary"); if (sum && sum.parentNode) sum.parentNode.insertBefore(card, sum.nextSibling); else tab.insertBefore(card, tab.firstChild); }
    card.innerHTML = statsCard();
    const sel = document.getElementById("costats-days"); if (sel) sel.onchange = () => { S.days = Number(sel.value) || 0; renderStats(); };
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof Admin === "undefined" || Admin._coStatsWrapped) return;
    const orig = Admin.renderAnalytics;
    if (typeof orig === "function") { Admin.renderAnalytics = function () { const r = orig.apply(this, arguments); try { renderStats(); } catch (e) { console.warn(e); } return r; }; Admin._coStatsWrapped = true; }
  });
  return { keyOf, nameOf, keysFor, aggregate, tableHtml, statsCard, renderStats, NONE, S };
})();
