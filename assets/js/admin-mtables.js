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
  /* v1.89.924: ≤760px صار للتنقل درج جانبي يُفتح بـ☰ (admin-theme.js) فيُعطَّل وضع «صفحة القسم» هنا؛ يبقى 761–900px */
  const MQP = window.matchMedia ? window.matchMedia("(min-width:761px) and (max-width:900px)") : { matches: false };
  /* أول صفحة على الهاتف = قائمة الأقسام (الترويسة + المجموعات + الأقسام) لا صفحة «لوحة التحكم»؛ تبقى كذلك حتى أول لمسة من المستخدم (فتح الأقسام الآلي عند الإقلاع لا يُخفيها) ما لم يكن في الرابط وجهة مباشرة (#…) */
  const DEEP = () => /^#(?!$)/.test(location.hash || "");
  const PM = { menu: !!MQP.matches && !DEEP(), grp: false, on: false, touched: false };
  /* «لمسة المستخدم» = ضغطه على زر قسم/مجموعة فقط (لا أي لمسة: لمس الشاشة أثناء التحميل كان يفتح «لوحة التحكم» بدل القائمة) */
  document.addEventListener("click", e => { try { if (e.target && e.target.closest && e.target.closest(".nav-btn,.ng,#nav-groups,nav.side-nav,#sec-search,.sg-item")) PM.touched = true; } catch (x) { } }, true);
  function pmApply() {
    const h = document.documentElement, mob = MQP.matches && !!document.getElementById("app") && !document.getElementById("app").classList.contains("hidden");
    h.classList.toggle("m-page", mob && !PM.menu); h.classList.toggle("m-menu", mob && PM.menu);
    const old = document.getElementById("m-menubar"); if (old) old.remove();      // شريط «☰ القائمة» أُلغي: القوائم الأفقية للأقسام تكفي
    /* شريط مضغوط للقسم المفتوح على الهاتف: زر رجوع + «المجموعة › القسم»، والباقي (الترويسة الكبيرة وأزرار المجموعات) مخفي ليحتل القسم الشاشة كلها */
    try {
      const app = document.getElementById("app"); let bar = document.getElementById("m-bar");
      if (mob && !PM.menu && app) {
        if (!bar) { bar = document.createElement("div"); bar.id = "m-bar"; bar.setAttribute("data-noco", ""); bar.innerHTML = '<button type="button" class="small gray" id="m-back" aria-label="رجوع إلى القائمة">→ رجوع</button><span id="m-bt"></span>'; app.insertBefore(bar, app.firstChild);
          bar.querySelector("#m-back").onclick = () => { PM.menu = true; pmApply(); try { window.scrollTo({ top: 0 }); } catch (e) { } }; }
        const g = document.querySelector("#nav-groups .ng.on"), t = document.getElementById("sec-title");
        const txt = [g && g.textContent.trim(), t && t.textContent.replace(/^[•\s]+/, "").trim()].filter(Boolean).join(" › "), el = document.getElementById("m-bt"); if (el && el.textContent !== txt) el.textContent = txt;
      } else if (bar) bar.remove();
    } catch (e) { }
  }
  function pmInit() {
    if (!document.getElementById("pm-css")) { const st = document.createElement("style"); st.id = "pm-css"; st.textContent = `
@media(max-width:900px){html.m-page nav.side-nav,html.m-page #stats{display:none!important}html.m-page:not(:has(#aly-hand.on)) #app .top,html.m-page:not(:has(#aly-hand.on)) #nav-groups{display:none!important}/* أثناء «اليد الافتراضية» تبقى أزرار التنقل ظاهرة لتضغطها */html.m-page:has(#aly-hand.on) #m-bar{display:none!important}
html.m-page #m-bar{display:flex;position:sticky;top:0;z-index:60;align-items:center;gap:.6rem;margin:0 0 .5rem;padding:.5rem .6rem;background:var(--g-bg,#0b1f17);border-bottom:1px solid var(--g-line,rgba(255,255,255,.14))}
html.m-page #m-bar #m-bt{font-weight:800;font-size:.95rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.m-page #m-bar #m-back{flex:0 0 auto;margin:0}
html.m-menu [id^="tab-"],html.m-menu #stats{display:none!important}
.nav-groups{display:flex!important;flex-wrap:nowrap;overflow-x:auto;gap:.45rem;scrollbar-width:none;-webkit-overflow-scrolling:touch}.nav-groups::-webkit-scrollbar{display:none}.nav-groups .ng{flex:0 0 auto;min-width:92px}}`; document.head.appendChild(st); }
    const wrap = () => {
      let ok = true;
      if (typeof Admin !== "undefined" && Admin.tab && !Admin.__pmTab) { const o = Admin.tab; Admin.tab = function () { const r = o.apply(this, arguments); if (!PM.grp) { PM.menu = !PM.touched && MQP.matches && !DEEP(); } setTimeout(pmApply, 0); setTimeout(pmApply, 400); if (MQP.matches && !PM.grp) { try { window.scrollTo({ top: 0 }); } catch (e) { } } return r; }; Admin.__pmTab = true; } else if (typeof Admin === "undefined") ok = false;
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

/* سحب الجداول الأفقية باللمس (v1.89.845): بعض الهواتف لا تمرّر الجدول الأفقي داخل حاويات التمرير الرأسية فيعلق المستخدم.
   نعطّل التمرير الأصلي الأفقي لهذه الجداول (touch-action:pan-y في CSS) ونحوّل حركة الإصبع الأفقية إلى scrollLeft بأنفسنا؛ الرأسي يبقى للمتصفح. */
(function () {
  const SEL = ".hs-wrap,.pm-table,table.m-scroll,#ship-table", can = el => el && el.scrollWidth > el.clientWidth + 2;
  let el = null, x0 = 0, y0 = 0, s0 = 0, mode = "", lx = 0, lt = 0, vx = 0, raf = 0;
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  /* زخم بعد رفع الإصبع (سلاسة كالتمرير الأصلي): السرعة تتناقص بنسبة ثابتة لكل 16ms */
  function fling(t, v) {
    stop(); let last = performance.now();
    const step = now => { const dt = Math.min(48, now - last); last = now; const before = t.scrollLeft; t.scrollLeft = before - v * dt; v *= Math.pow(0.94, dt / 16); if (Math.abs(v) < 0.03 || t.scrollLeft === before) { raf = 0; return; } raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  document.addEventListener("touchstart", e => {
    stop(); el = null; mode = ""; vx = 0; if (e.touches.length !== 1) return;
    /* أقرب حاوية تمرير أفقية فعلاً (أياً كان نوعها: .rt-table، حاوية جدول، جدول m-scroll…) وفي الطريق إليها يمنع touch-action التمرير الأصلي الأفقي ← نتولاه نحن؛ وإلا يتولاه المتصفح */
    if (e.target && e.target.closest && e.target.closest("input[type=range],canvas,[contenteditable],#pb-app,#pbx-frame,.pbx-ep,.pbx,[data-nohs]")) return;
    let t = e.target, blocked = false;
    while (t && t.nodeType === 1 && t !== document.body) {
      const cs = getComputedStyle(t); if (!/pan-x|^auto|manipulation/.test(cs.touchAction)) blocked = true;
      if (/(auto|scroll)/.test(cs.overflowX) && can(t)) break; t = t.parentElement;
    }
    if (!t || t === document.body || !blocked) return; el = t; x0 = lx = e.touches[0].clientX; y0 = e.touches[0].clientY; s0 = el.scrollLeft; lt = e.timeStamp;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (!el || !e.touches.length) return; const x = e.touches[0].clientX, dx = x - x0, dy = e.touches[0].clientY - y0;
    if (!mode) { if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; mode = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v"; }
    if (mode === "h") { el.scrollLeft = s0 - dx; const dt = Math.max(1, e.timeStamp - lt); vx = 0.8 * vx + 0.2 * ((x - lx) / dt) * 1; lx = x; lt = e.timeStamp; if (e.cancelable) e.preventDefault(); }
  }, { passive: false });
  const end = e => { const t = el, v = vx, m = mode; el = null; mode = ""; if (t && m === "h" && Math.abs(v) > 0.08 && e && e.type === "touchend" && performance.now() - (lt || 0) < 120 + 0) fling(t, v); };
  document.addEventListener("touchend", end, { passive: true }); document.addEventListener("touchcancel", end, { passive: true });
})();

/* أزرار أسهم ◀ ▶ فوق كل جدول أفقي على الهاتف (v1.89.849): تمرير بالنقر إن تعذّر السحب على جهاز المستخدم */
(function () {
  const MQ = window.matchMedia("(max-width:700px)"), SEL = ".hs-wrap,.pm-table,table.m-scroll,#ship-table", M = new WeakMap();
  function nav() {
    if (!MQ.matches) { document.querySelectorAll(".hs-nav").forEach(n => n.remove()); return; }
    document.querySelectorAll(SEL).forEach(t => {
      let n = M.get(t); const ok = t.getClientRects().length && t.scrollWidth > t.clientWidth + 2;
      if (!ok) { if (n) n.style.display = "none"; return; }
      if (!n || !n.isConnected) {
        n = document.createElement("div"); n.className = "hs-nav"; n.setAttribute("data-noco", "");
        n.innerHTML = '<button type="button" class="small gray" data-d="-1" aria-label="يسار">◀</button><span>اسحب أو اضغط الأسهم</span><button type="button" class="small gray" data-d="1" aria-label="يمين">▶</button>';
        n.addEventListener("click", e => { const b = e.target.closest("button[data-d]"); if (b) t.scrollBy({ left: (+b.dataset.d) * Math.max(120, t.clientWidth * 0.6), behavior: "auto" }); });
        let at = t, pv = t.previousElementSibling; if (pv && pv.classList.contains("hs-bar")) at = pv;
        at.parentNode.insertBefore(n, at); M.set(t, n);
      }
      n.style.display = "";
    });
  }
  setInterval(nav, 1200); window.addEventListener("resize", nav); document.addEventListener("DOMContentLoaded", nav);
})();
