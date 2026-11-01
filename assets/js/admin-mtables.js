/* جداول اللوحة على الهاتف (≤700px) تتحوّل إلى بطاقات تلقائياً (v1.89.701).
   لكل جدول بعناوين (th) وأربعة أعمدة فأكثر ولا يملك وضعه الخاص (.rt / .orders-compact / .m-cards / .kv):
   نضع الصنف m-cards ونكتب data-l (عنوان العمود) على كل خلية؛ والتنسيق في admin-theme.css.
   استثناء جدول: data-nomc="1" على <table>. */
(function () {
  "use strict";
  const MQ = window.matchMedia ? window.matchMedia("(max-width:700px)") : { matches: false };
  const SKIP = ".rt,.orders-compact,.m-cards,.kv,[data-nomc]";
  const txt = el => (el.textContent || "").replace(/\s+/g, " ").trim();
  function headersOf(t) {
    const hr = t.querySelector("thead tr") || [...t.rows].find(r => r.cells.length && [...r.cells].every(c => c.tagName === "TH"));
    if (!hr) return null;
    const out = []; [...hr.cells].forEach(c => { const n = c.colSpan || 1; for (let i = 0; i < n; i++) out.push(txt(c)); });
    return out;
  }
  function pass(root) {
    if (!MQ.matches) return;
    (root || document).querySelectorAll("#app table, .modal table").forEach(t => {
      if (t.matches(SKIP) || t.closest("#pb-app,#pbx-frame,.pbx-ep")) return;
      const H = headersOf(t); if (!H || H.length < 4 || !H.some(Boolean)) return;
      let n = 0;
      [...t.rows].forEach(r => {
        if ([...r.cells].every(c => c.tagName === "TH")) return;
        if (r.cells.length !== H.length) return;
        [...r.cells].forEach((c, i) => { if (!c.hasAttribute("data-l") && H[i]) { c.setAttribute("data-l", H[i]); n++; } });
      });
      t.classList.add("m-cards");
    });
  }
  let tm = 0; const later = () => { clearTimeout(tm); tm = setTimeout(() => { try { pass(document); } catch (e) {} }, 250); };
  function init() {
    const app = document.getElementById("app") || document.body;
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
    if (MQ.addEventListener) MQ.addEventListener("change", later);
    later();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.AdminMTables = { pass };
})();
