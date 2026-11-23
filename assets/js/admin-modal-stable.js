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
    const r = fn();
    const restore = () => {
      const now = [...host.querySelectorAll("*")];
      saved.forEach(o => { const e = (o.id && document.getElementById(o.id)) || (now[o.i] && now[o.i].className === o.cls ? now[o.i] : null); if (e) { e.scrollTop = o.t; e.scrollLeft = o.l; } });
      anc.forEach(o => { if (o.e.isConnected && (Math.abs(o.e.scrollTop - o.t) > 2 || Math.abs(o.e.scrollLeft - o.l) > 2)) { o.e.scrollTop = o.t; o.e.scrollLeft = o.l; } });
      if (Math.abs(window.scrollY - y) > 2 || Math.abs(window.scrollX - x) > 2) window.scrollTo(x, y);
      if (ak && (!document.activeElement || document.activeElement === document.body)) { const e = (ak.id && document.getElementById(ak.id)) || (ak.pk && ak.i >= 0 && now[ak.i] && now[ak.i].getAttribute("data-pk") === ak.pk ? now[ak.i] : null); if (e && e.focus) { try { e.focus({ preventScroll: true }); } catch (_) { } } }
    };
    restore(); requestAnimationFrame(restore);
    return r;
  }
};
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
  const locked = new Set();
  /* النافذة المفتوحة = أعلى عنصر عند زاوية الشاشة يكون overlay ثابتاً يغطّيها؛ فحص خفيف كل 250ms وعند كل نقرة (لا مراقبة لكل التغييرات) */
  function tick() {
    try {
      let e = document.elementFromPoint(innerWidth - 3, 3), found = null;
      while (e && e !== document.body && e !== document.documentElement) { if (isOpen(e)) { found = e; break; } e = e.parentElement; }
      if (found && !found.__stbl) { lock(found); if (found.__stbl) locked.add(found); }
      locked.forEach(el => { if (!el.isConnected || !isOpen(el) || !el.contains(el.__stbl && el.__stbl.kid)) { unlock(el); locked.delete(el); } });
    } catch (_) { }
  }
  const start = () => { setInterval(tick, 250); document.addEventListener("click", () => requestAnimationFrame(tick), true); tick(); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
