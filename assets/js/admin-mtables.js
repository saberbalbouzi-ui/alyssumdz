/* جداول اللوحة على الهاتف (≤700px) تتحوّل إلى بطاقات تلقائياً (v1.89.701).
   لكل جدول بعناوين (th) وأربعة أعمدة فأكثر ولا يملك وضعه الخاص (.rt / .orders-compact / .m-cards / .kv):
   نضع الصنف m-cards ونكتب data-l (عنوان العمود) على كل خلية؛ والتنسيق في admin-theme.css.
   استثناء جدول: data-nomc="1" على <table>. */
(function () {
  "use strict";
  const MQ = window.matchMedia ? window.matchMedia("(max-width:700px)") : { matches: false };
  const SKIP = ".orders-compact,.m-cards,.kv,[data-nomc]";
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
      const H = headersOf(t); if (!H || H.length < (t.classList.contains("rt") ? 3 : 4) || !H.some(Boolean)) return;
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

  /* ───── الهاتف: كل قسم صفحة وحده تحت الشريط العلوي (v1.89.758) ─────
     بدل أن تبقى قائمة الأقسام كلها فوق المحتوى: عند فتح قسم تُخفى القائمة وتبقى صفحة القسم وحدها مع شريط «☰ القائمة»؛ والزرّ يفتح القائمة وحدها (بلا محتوى) لاختيار قسم آخر. */
  const MQP = window.matchMedia ? window.matchMedia("(max-width:900px)") : { matches: false };
  const PM = { menu: false, grp: false, on: false };
  function pmApply() {
    const h = document.documentElement, mob = MQP.matches && !!document.getElementById("app") && !document.getElementById("app").classList.contains("hidden");
    h.classList.toggle("m-page", mob && !PM.menu); h.classList.toggle("m-menu", mob && PM.menu);
    const bar = document.getElementById("m-menubar"); if (bar) { bar.style.display = mob ? "flex" : "none"; const t = document.getElementById("sec-title"), tt = bar.querySelector("b"); if (tt) tt.textContent = PM.menu ? "اختر القسم" : ((t && t.textContent.trim()) || ""); const bt = bar.querySelector("button"); if (bt) bt.textContent = PM.menu ? "✕ رجوع للصفحة" : "☰ القائمة"; }
  }
  function pmInit() {
    if (!document.getElementById("pm-css")) { const st = document.createElement("style"); st.id = "pm-css"; st.textContent = `
#m-menubar{display:none;align-items:center;gap:.6rem;position:sticky;top:0;z-index:60;margin:0 0 .6rem;padding:.5rem .7rem;border-radius:14px;background:#12161b;border:1px solid rgba(226,254,23,.35)}
#m-menubar button{flex:none;padding:.5rem .9rem;border:0;border-radius:12px;font:inherit;font-weight:900;color:#1f2123;background:linear-gradient(#effe17,#e2fe17);cursor:pointer}
#m-menubar b{flex:1;min-width:0;color:#fff;font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.white #m-menubar{background:#fff;border-color:#cdd5e0}html.white #m-menubar b{color:#0f172a}
@media(max-width:900px){html.m-page #nav-groups,html.m-page nav.side-nav,html.m-page #stats{display:none!important}
html.m-menu [id^="tab-"],html.m-menu #stats{display:none!important}}`; document.head.appendChild(st); }
    const top = document.querySelector("#app > .top"); if (top && !document.getElementById("m-menubar")) { const bar = document.createElement("div"); bar.id = "m-menubar"; bar.innerHTML = '<button type="button">☰ القائمة</button><b></b>'; top.after(bar);
      bar.querySelector("button").onclick = () => { PM.menu = !PM.menu; pmApply(); if (PM.menu) { window.scrollTo({ top: 0 }); const q = document.getElementById("nav-q"); if (q) q.blur(); } }; }
    const wrap = () => {
      let ok = true;
      if (typeof Admin !== "undefined" && Admin.tab && !Admin.__pmTab) { const o = Admin.tab; Admin.tab = function () { const r = o.apply(this, arguments); if (!PM.grp) { PM.menu = false; } setTimeout(pmApply, 0); setTimeout(pmApply, 400); if (MQP.matches && !PM.grp) { try { window.scrollTo({ top: 0 }); } catch (e) { } } return r; }; Admin.__pmTab = true; } else if (typeof Admin === "undefined") ok = false;
      if (typeof AdminNav !== "undefined" && AdminNav.group && !AdminNav.__pmG) { const g = AdminNav.group; AdminNav.group = function () { PM.grp = true; PM.menu = true; try { return g.apply(this, arguments); } finally { PM.grp = false; setTimeout(pmApply, 0); } }; AdminNav.__pmG = true; } else if (typeof AdminNav === "undefined") ok = false;
      return ok;
    };
    let n = 0; const iv = setInterval(() => { const ok = wrap(); pmApply(); if ((ok && n > 3) || ++n > 60) clearInterval(iv); }, 500);
    if (MQP.addEventListener) MQP.addEventListener("change", pmApply);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pmInit); else pmInit();
  window.AdminMTables = { pass };
})();
