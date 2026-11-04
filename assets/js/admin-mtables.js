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

  /* ───── المظهر الفاتح: أقسام لها CSS داكن مضمَّن (نصوص بيضاء/ليمونية/رمادية فاتحة) تصير مقروءة (v1.89.761) ─────
     يُفحص نصّ كل عنصر فيها فإن تساوى لونه مع خلفيته الفعلية (تباين ضعيف) يُعطى لوناً داكناً؛ والأزرار الملوّنة (نصّ أبيض على خلفية داكنة) لا تُمسّ. */
  const LT_ROOTS = "[id^=\"tab-\"],#ahome,#aa,#pf-app,#pm,#rt,#ar,#sm,#customers-app,#hs-app,#ad-app,#wl-app,#mk-app,#ag-app,#dg-app,#sd-list,#studio-content,#bulk-products-app,#stores-app,#dp,#pk,#adm-theme,#sp-app,#sm-body,#ca-body-header,#ca-body-footer,#rp-toks";
  const rgbOf = c => { const str = String(c), v = (str.match(/[\d.]+/g) || [0, 0, 0, 1]).map(Number); return /^color\(srgb/.test(str) ? [v[0] * 255, v[1] * 255, v[2] * 255, v.length > 3 ? v[3] : 1] : v; }, lumOf = a => (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) / 255;
  function effBg(n, dark) { let p = n; const layers = []; while (p && p.nodeType === 1) { const cs = getComputedStyle(p); let c = rgbOf(cs.backgroundColor), al = c.length > 3 ? c[3] : 1; const gi = cs.backgroundImage.match(/(?:rgba?|color)\([^)]+\)/); if (gi) { c = rgbOf(gi[0]); al = c.length > 3 ? c[3] : 1; } if (al > 0) layers.push([c, al]); if (al >= 0.99) break; p = p.parentElement; } let col = dark ? [10, 14, 12] : [255, 255, 255]; for (let i = layers.length - 1; i >= 0; i--) { const [c, al] = layers[i]; col = [0, 1, 2].map(k => c[k] * al + col[k] * (1 - al)); } return col; }
  let ltT = 0, ltBusy = false;
  function ltPass() {
    if (ltBusy) return; const LIGHT = document.documentElement.classList.contains("white"); ltBusy = true; document.querySelectorAll(LIGHT ? ".lt-dk" : ".lt-fg,.lt-mut,.lt-lime,.lt-red").forEach(x => x.classList.remove("lt-dk", "lt-fg", "lt-mut", "lt-lime", "lt-red"));
    try { document.querySelectorAll(LT_ROOTS).forEach(root => { if (!root.getClientRects().length) return; let n = 0; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let t;
        while ((t = w.nextNode()) && n++ < 2500) { if (!t.textContent.trim()) continue; const p = t.parentElement; if (!p || p.classList.contains("lt-dk") || p.classList.contains("lt-fg") || p.classList.contains("lt-mut") || p.classList.contains("lt-lime") || p.classList.contains("lt-red") || p.closest("script,style,svg,option")) continue; if (/background/.test(p.getAttribute("style") || "")) continue;
          const cs = getComputedStyle(p); if (cs.display === "none") continue; const fg = rgbOf(cs.color), bg = effBg(p, !LIGHT); if (Math.abs(lumOf(fg) - lumOf(bg)) >= 0.3) continue; if (!LIGHT) { if (lumOf(bg) > 0.55) p.classList.add("lt-dk"); continue; }
          const lime = fg[1] > 180 && fg[2] < 130 && fg[0] > 130 && fg[1] > fg[0]; const red = fg[0] > 200 && fg[1] < 190 && fg[2] < 190 && fg[0] - fg[1] > 40; p.classList.add(lime ? "lt-lime" : red ? "lt-red" : (lumOf(fg) > 0.9 ? "lt-fg" : "lt-mut")); } }); } catch (e) { }
    ltBusy = false;
  }
  function ltInit() {
    if (!document.getElementById("lt-css")) { const st = document.createElement("style"); st.id = "lt-css"; st.textContent = "html.white body #app .lt-fg:not(#_){color:#0f172a!important;-webkit-text-fill-color:#0f172a!important}html.white body #app .lt-mut:not(#_){color:#475569!important}html.white body #app .lt-lime:not(#_){color:#3f6212!important}html.white body #app .lt-red:not(#_){color:#b91c1c!important}html.glass body #app .lt-dk:not(#_){color:#1f2123!important;-webkit-text-fill-color:#1f2123!important}"; document.head.appendChild(st); }
    const go = () => { clearTimeout(ltT); ltT = setTimeout(ltPass, 350); };
    new MutationObserver(go).observe(document.body, { childList: true, subtree: true, characterData: true });
    new MutationObserver(go).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); go();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ltInit); else ltInit();
  window.AdminMTables = { pass };
})();
