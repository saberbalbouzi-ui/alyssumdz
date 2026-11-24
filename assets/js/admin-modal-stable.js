/* نوافذ اللوحة تبقى ثابتة: النافذة المتوسِّطة (overlay ثابت بـ flex وalign-items:center) كانت تعيد توسّطها كلما تغيّر ارتفاع محتواها
   (ضغط زر يضيف/يحذف سطراً، أو تحديث القائمة داخلها) فتقفز للأعلى والأسفل. هنا يُثبَّت موضعها العلوي كما ظهرت أول مرة
   فيتمدّد المحتوى للأسفل فقط، ولا تتحرك إلا إن لم تعد تتسع في الشاشة (تُرفع بالقدر اللازم فقط). عامّة لكل نوافذ اللوحة بلا تعديل كل نافذة. */
/* AdminKeep.run(host, fn): ينفّذ إعادة رسم الواجهة (innerHTML) مع حفظ موضع تمرير الصفحة وكل حاويات التمرير داخل host والعنصر المركَّز، فلا «تقفز» الشاشة بعد ضغط زر داخل قائمة */
window.AdminKeep = {
  run(host, fn) {
    if (!host) return fn();
    const y = window.scrollY, x = window.scrollX, all = [...host.querySelectorAll("*")], saved = [];
    all.forEach((e, i) => { if (e.scrollTop || e.scrollLeft) saved.push({ i, id: e.id || "", cls: e.className || "", t: e.scrollTop, l: e.scrollLeft }); });
    const anc = []; for (let e = host.parentElement; e && e !== document.documentElement; e = e.parentElement) if (e.scrollTop || e.scrollLeft) anc.push({ e, t: e.scrollTop, l: e.scrollLeft });      /* حاويات التمرير الأعلى (محتوى اللوحة نفسه) */
    const a = document.activeElement, ak = a && host.contains(a) ? { id: a.id || "", pk: a.getAttribute && a.getAttribute("data-pk"), i: all.indexOf(a) } : null;
    /* مرساة: الصف الذي ضغطتَ زرّه يبقى في مكانه على الشاشة؛ وإن اختفى بعد الرسم (فلتر «غير مجهَّز») يحلّ مكانه الصف التالي، فلا تتحرك القائمة تحت إصبعك. وإلا أول صفوف ظاهرة. */
    const rowsOf = () => [...host.querySelectorAll("[data-id]")], topOf = e => e.getBoundingClientRect().top;
    const lc = window.AdminKeep._last, clicked = lc && Date.now() - lc.at < 8000 && host.contains(lc.el) ? lc.el.closest("[data-id]") : null;
    const anchors = [];
    if (clicked) { const all = rowsOf(), k = all.indexOf(clicked), t0 = topOf(clicked), nx = all.slice(k + 1).find(e => e.tagName === clicked.tagName), pv = k > 0 ? all[k - 1] : null;
      anchors.push({ id: clicked.getAttribute("data-id"), top: t0 }); if (nx) anchors.push({ id: nx.getAttribute("data-id"), top: t0 }); if (pv) anchors.push({ id: pv.getAttribute("data-id"), top: topOf(pv) }); }
    for (const e of rowsOf()) { const b = e.getBoundingClientRect(); if (b.bottom > 0 && b.top < innerHeight) { anchors.push({ id: e.getAttribute("data-id"), top: b.top }); if (anchors.length >= 8) break; } }
    const scroller = () => { for (let e = host; e && e !== document.documentElement; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 2) return e; } return null; };
    const r = fn();
    const reanchor = () => {
      for (const an of anchors) { const el = host.querySelector('[data-id="' + (window.CSS && CSS.escape ? CSS.escape(an.id) : an.id) + '"]'); if (!el) continue; const d = el.getBoundingClientRect().top - an.top; if (Math.abs(d) > 1) { const sc = scroller(); if (sc) sc.scrollTop += d; else window.scrollBy(0, d); } return; }
    };
    const restore = () => {
      const now = [...host.querySelectorAll("*")];
      saved.forEach(o => { const e = (o.id && document.getElementById(o.id)) || (now[o.i] && now[o.i].className === o.cls ? now[o.i] : null); if (e) { e.scrollTop = o.t; e.scrollLeft = o.l; } });
      anc.forEach(o => { if (o.e.isConnected && (Math.abs(o.e.scrollTop - o.t) > 2 || Math.abs(o.e.scrollLeft - o.l) > 2)) { o.e.scrollTop = o.t; o.e.scrollLeft = o.l; } });
      if (Math.abs(window.scrollY - y) > 2 || Math.abs(window.scrollX - x) > 2) window.scrollTo(x, y);
      if (ak && (!document.activeElement || document.activeElement === document.body)) { const e = (ak.id && document.getElementById(ak.id)) || (ak.pk && ak.i >= 0 && now[ak.i] && now[ak.i].getAttribute("data-pk") === ak.pk ? now[ak.i] : null); if (e && e.focus) { try { e.focus({ preventScroll: true }); } catch (_) { } } }
    };
    restore(); reanchor(); requestAnimationFrame(() => { restore(); reanchor(); });
    return r;
  }
};
["pointerdown", "mousedown", "touchstart", "click"].forEach(ev => document.addEventListener(ev, e => { window.AdminKeep._last = { el: e.target, at: Date.now() }; }, true));
(() => {
  if (window.__modalStable) return; window.__modalStable = 1;
  const SKIP = /^(au-boot)$/;
  const isOpen = el => { const cs = getComputedStyle(el); return cs.position === "fixed" && cs.display === "flex" && el.offsetWidth >= innerWidth - 2 && el.offsetHeight >= innerHeight - 2 ? cs : null; };
  function lock(el) {
    if (el.__stbl || SKIP.test(el.id || "")) return; const cs = isOpen(el); if (!cs || cs.alignItems !== "center") return;
    const kid = [...el.children].find(k => k.offsetHeight > 20 && getComputedStyle(k).position !== "absolute" && getComputedStyle(k).position !== "fixed"); if (!kid) return;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0, top = Math.max(0, Math.round(kid.getBoundingClientRect().top - pt)); const st = { ai: el.style.alignItems, mt: kid.style.marginTop, ov: el.style.overflowY };
    el.__stbl = { kid, st, top }; el.style.alignItems = "flex-start"; kid.style.marginTop = top + "px";
    const fit = () => { const h = kid.offsetHeight, t = el.__stbl ? el.__stbl.top : top; const want = Math.max(0, Math.min(t, innerHeight - pt - pb - h)); kid.style.marginTop = want + "px"; };
    el.__stbl.ro = new ResizeObserver(fit); el.__stbl.ro.observe(kid); fit();
  }
  function unlock(el) { const s = el.__stbl; if (!s) return; try { s.ro.disconnect(); } catch (_) { } el.style.alignItems = s.st.ai; s.kid.style.marginTop = s.st.mt; el.__stbl = null; }
  /* جوال: حين تتّسع «نافذة التخطيط» عن الشاشة المرئية (صفحة فيها تمرير أفقي فيصغّرها المتصفح تلقائياً، أو تكبير بالأصابع) تتحرّك الطبقات الثابتة (inset:0) خارج المنظور فيُقصّ نصّها وتظهر دوّارة التحديث عند الحافة.
     نثبّت الطبقات الثابتة المفتوحة على المنظور المرئي (visualViewport) وتعود لوضعها حين يتطابقان. */
  const OV = ".modal-bg.open,#au-cover,#au-bar,.acr-bg,.hs-bg,.sa-mbg,.cs-mbg,.bp-overlay,.cc-overlay,.stp-modbg,#tl-inst,#tl-lib,#tl-view,.acc-bg";
  function fitVV() {
    const vv = window.visualViewport; if (!vv) return; const cw = document.documentElement.clientWidth, mism = Math.abs(cw - vv.width) > 2 || vv.offsetLeft > 2 || vv.offsetTop > 2;
    document.querySelectorAll(OV).forEach(el => {
      const cs = getComputedStyle(el); if (cs.position !== "fixed" || cs.display === "none") { if (el.__vv) { unfit(el); } return; }
      if (!mism) { if (el.__vv) unfit(el); return; }
      if (!el.__vv) { const o = el.style; el.__vv = { inset: o.inset, left: o.left, top: o.top, width: o.width, height: o.height, right: o.right, bottom: o.bottom }; }
      el.style.inset = "auto"; el.style.left = vv.offsetLeft + "px"; el.style.top = vv.offsetTop + "px"; el.style.width = vv.width + "px"; el.style.height = vv.height + "px";
    });
  }
  function unfit(el) { const o = el.__vv; if (!o) return; el.style.inset = o.inset; el.style.left = o.left; el.style.top = o.top; el.style.width = o.width; el.style.height = o.height; el.style.right = o.right; el.style.bottom = o.bottom; el.__vv = null; }
  const locked = new Set();
  /* النافذة المفتوحة = أعلى عنصر عند زاوية الشاشة يكون overlay ثابتاً يغطّيها؛ فحص خفيف كل 250ms وعند كل نقرة (لا مراقبة لكل التغييرات) */
  function tick() {
    try {
      let e = document.elementFromPoint(innerWidth - 3, 3), found = null;
      while (e && e !== document.body && e !== document.documentElement) { if (isOpen(e)) { found = e; break; } e = e.parentElement; }
      if (found && !found.__stbl) { lock(found); if (found.__stbl) locked.add(found); }
      fitVV();
      locked.forEach(el => { if (!el.isConnected || !isOpen(el) || !el.contains(el.__stbl && el.__stbl.kid)) { unlock(el); locked.delete(el); } });
    } catch (_) { }
  }
  const start = () => { try { if (window.visualViewport) { visualViewport.addEventListener("resize", fitVV); visualViewport.addEventListener("scroll", fitVV); } } catch (_) { } setInterval(tick, 250); document.addEventListener("click", () => requestAnimationFrame(tick), true); tick(); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
