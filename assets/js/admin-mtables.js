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
  /* شريط سحب أفقي علوي (≈6مم) لجدول الطلبات يتزامن مع تمرير الجدول (v1.89.703) */
  function hscroll() {
    const t = document.getElementById("orders-table"); if (!t) return;
    const w = t.closest(".rtw"); if (!w || !w.parentNode) return;
    let bar = document.getElementById("ord-hs");
    if (!bar) {
      bar = document.createElement("div"); bar.id = "ord-hs"; bar.setAttribute("aria-hidden", "true"); bar.innerHTML = "<div></div>";
      const sync = (a, b) => () => { if (Math.abs(b.scrollLeft - a.scrollLeft) < 1) return; try { b.scrollTo({ left: a.scrollLeft, behavior: "instant" }); } catch (e) { b.scrollLeft = a.scrollLeft; } };
      bar.addEventListener("scroll", sync(bar, w)); w.addEventListener("scroll", sync(w, bar));
    }
    if (bar.nextElementSibling !== w) w.parentNode.insertBefore(bar, w);
    const need = !!t.querySelector("th") && w.scrollWidth > w.clientWidth + 2;
    bar.classList.toggle("on", need); if (need) bar.firstChild.style.width = w.scrollWidth + "px";
  }
  /* شريط سحب علوي (≈6مم) لجدول يمرّر نفسه أفقياً (display:block;overflow-x:auto) ويتزامن معه */
  function tbar(t) {
    let bar = t.previousElementSibling;
    if (!bar || !bar.classList.contains("hs-bar")) {
      bar = document.createElement("div"); bar.className = "hs-bar"; bar.setAttribute("aria-hidden", "true"); bar.innerHTML = "<div></div>";
      const sync = (a, b) => () => { if (Math.abs(b.scrollLeft - a.scrollLeft) < 1) return; try { b.scrollTo({ left: a.scrollLeft, behavior: "instant" }); } catch (e) { b.scrollLeft = a.scrollLeft; } };
      bar.addEventListener("scroll", sync(bar, t)); t.addEventListener("scroll", sync(t, bar));
      t.parentNode.insertBefore(bar, t);
    }
    const need = MQ.matches && t.scrollWidth > t.clientWidth + 2;
    bar.classList.toggle("on", need); if (need) bar.firstChild.style.width = t.scrollWidth + "px";
  }
  /* على الهاتف (≤700px) كل جدول بعناوين وأربعة أعمدة فأكثر يبقى جدولاً بصف واحد لكل سجلّ ويُسحب أفقياً بشريط علوي (v1.89.706؛ كانت بطاقات عمودية طويلة) */
  function pass(root) {
    try { hscroll(); } catch (e) {}
    if (!MQ.matches) { document.querySelectorAll("table.m-scroll").forEach(t => { t.classList.remove("m-scroll"); const b = t.previousElementSibling; if (b && b.classList.contains("hs-bar")) b.classList.remove("on"); }); return; }
    (root || document).querySelectorAll("#app table, .modal table").forEach(t => {
      if (t.matches(SKIP) || t.closest("#pb-app,#pbx-frame,.pbx-ep")) return;
      const H = headersOf(t); if (!H || H.length < 4 || !H.some(Boolean)) return;
      t.classList.add("m-scroll"); try { tbar(t); } catch (e) {}
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
