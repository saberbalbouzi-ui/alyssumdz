/* صفحة الطلبات: بطاقات الإحصاء العلوية . تقرأ Admin.orders فقط ولا تعدّل الطلبات. */
(function () {
  const $ = id => document.getElementById(id), ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const list = () => (typeof Admin !== "undefined" && Array.isArray(Admin.orders)) ? Admin.orders : [];
  function stats() {
    const tab = $("tab-orders"); if (!tab || !tab.offsetParent) return;
    const L = list(), today = ymd(new Date());
    const set = (id, v) => { const e = $(id); if (e && e.textContent !== String(v)) e.textContent = v; };
    set("os-total", L.length);
    set("os-today", L.filter(o => { const d = new Date(o.date); return !isNaN(d) && ymd(d) === today; }).length);
    set("os-wait", L.filter(o => o.status === "nouvelle").length);
    set("os-way", L.filter(o => o.status === "expediee").length);
    }
  const go = () => stats();
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
  setInterval(go, 1200);
})();
