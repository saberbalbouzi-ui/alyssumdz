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
/* زرّ «نسخ» بجانب رقم التتبع: AdminCopyBtn(نص) يُرجع HTML الزرّ (أيقونة SVG)، والنقر مفوَّض عالمياً (data-copy) فيعمل في كل الجداول */
window.AdminCopyBtn = txt => '<button type="button" class="cp-btn" data-copy="' + String(txt == null ? "" : txt).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])) + '" title="نسخ رقم التتبع" aria-label="نسخ رقم التتبع" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;min-height:26px;padding:0;margin:0 .3rem;border-radius:8px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;cursor:pointer;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>';
document.addEventListener("click", e => {
  const b = e.target && e.target.closest && e.target.closest("[data-copy]"); if (!b) return; e.preventDefault(); e.stopPropagation();
  const txt = b.getAttribute("data-copy") || "", ok = () => { try { if (typeof toast === "function") toast("✅ " + (typeof AdminI18n !== "undefined" ? AdminI18n.t("تم نسخ رقم التتبع") : "تم نسخ رقم التتبع") + ": " + txt); } catch (_) { } b.style.opacity = ".5"; setTimeout(() => { b.style.opacity = ""; }, 700); };
  const fb = () => { const t = document.createElement("textarea"); t.value = txt; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); ok(); } catch (_) { } t.remove(); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fb); else fb(); } catch (_) { fb(); }
}, true);
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
  let nFit = 0;
  function fitVV() {
    const vv = window.visualViewport; if (!vv) return; const cw = document.documentElement.clientWidth, kb = window.innerHeight - vv.height - vv.offsetTop > 120, mism = Math.abs(cw - vv.width) > 2 || vv.offsetLeft > 2 || vv.offsetTop > 2 || kb;
    if (!mism && !nFit) return;   /* لا انحراف ولا طبقة مثبَّتة: لا مسح DOM ولا getComputedStyle (كان يعمل كل 250ms في كل إطار) */
    const els = document.querySelectorAll(OV);
    els.forEach(el => {
      const cs = getComputedStyle(el); if (cs.position !== "fixed" || cs.display === "none") { if (el.__vv) { unfit(el); } return; }
      if (!mism) { if (el.__vv) unfit(el); return; }
      if (!el.__vv) { const o = el.style; el.__vv = { inset: o.inset, left: o.left, top: o.top, width: o.width, height: o.height, right: o.right, bottom: o.bottom }; }
      el.style.inset = "auto"; el.style.left = vv.offsetLeft + "px"; el.style.top = vv.offsetTop + "px"; el.style.width = vv.width + "px"; el.style.height = vv.height + "px";
      /* لوحة المفاتيح مفتوحة: تُقصَّر النافذة على المساحة المرئية فوقها ويتمرّر داخلها، فلا تغطّي الكلافيي الحقل الذي تكتب فيه (خانة السعر وغيرها) */
      const kid = el.__stbl ? el.__stbl.kid : el.firstElementChild;
      if (kid) { if (el.__vv.mh === undefined) { el.__vv.kid = kid; el.__vv.mh = kid.style.maxHeight; el.__vv.oy = kid.style.overflowY; } if (kb) { kid.style.maxHeight = Math.max(160, vv.height - 12) + "px"; kid.style.overflowY = "auto"; } else { kid.style.maxHeight = el.__vv.mh; kid.style.overflowY = el.__vv.oy; } }
    });
    nFit = 0; els.forEach(el => { if (el.__vv) nFit++; });
  }
  function unfit(el) { const o = el.__vv; if (!o) return; if (o.kid) { o.kid.style.maxHeight = o.mh; o.kid.style.overflowY = o.oy; } el.style.inset = o.inset; el.style.left = o.left; el.style.top = o.top; el.style.width = o.width; el.style.height = o.height; el.style.right = o.right; el.style.bottom = o.bottom; el.__vv = null; }
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
  /* حقل يأخذ التركيز داخل نافذة مفتوحة: بعد ظهور الكلافيي يُمرَّر إلى وسط المساحة المرئية */
  document.addEventListener("focusin", e => { const t = e.target; if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !t.closest || !t.closest(OV)) return; [250, 700].forEach(ms => setTimeout(() => { try { if (document.activeElement === t) t.scrollIntoView({ block: "center", inline: "nearest" }); } catch (_) { } }, ms)); });
  const start = () => { try { if (window.visualViewport) { visualViewport.addEventListener("resize", fitVV); visualViewport.addEventListener("scroll", fitVV); } } catch (_) { } setInterval(tick, 250); document.addEventListener("click", () => requestAnimationFrame(tick), true); tick(); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
/* النوافذ لا تُغلق بالنقر خارجها ولا بـEsc: بزرّ الإغلاق (×) أو «إلغاء» فقط (طلب صاحب المتجر: لا تضيع بيانات نافذة مفتوحة بنقرة عرَضية).
   عامّ لكل النوافذ بلا تعديل كل نافذة: نعترض نقر الخلفية (الطبقة الثابتة المعتمة التي تغطي الشاشة) في طور الالتقاط فلا تصل لمعالج إغلاقها.
   الاستثناء: طبقة بلا أي زر إغلاق/إلغاء (معاينة صورة مثلاً) تبقى تُغلق بالنقر خارجها كي لا تعلق الشاشة، والقوائم المنسدلة وشفّافات النقر الخارجي لا تتأثر. */
(() => {
  if (window.__modalNoOutside) return; window.__modalNoOutside = 1;
  const SKIP = /^(au-boot|au-cover|au-bar|app|wrap|pb-app|pbx-ovl)$/, CLOSE = /^\s*[×✕✖xX]\s*$|إغلاق|إلغاء|إلغـاء|fermer|annuler|^\s*(close|cancel)\s*$/i;
  const dim = cs => { const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || ""), a = m ? (m[1].split(",")[3] === undefined ? 1 : parseFloat(m[1].split(",")[3])) : 0; return a > 0.02 || (cs.backdropFilter && cs.backdropFilter !== "none") || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== "none"); };
  const hasClose = el => { try { return [...el.querySelectorAll("button,[role=button],a,[data-x],[data-close],.x,.close")].some(b => b.offsetParent !== null && CLOSE.test(((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "") + " " + (b.textContent || "")).trim())); } catch (_) { return false; } };
  const overlayOf = el => {
    if (!el || el.nodeType !== 1 || SKIP.test(el.id || "") || el === document.body || el === document.documentElement) return null;
    const cs = getComputedStyle(el); if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") return null;
    if (el.offsetWidth < innerWidth - 2 || el.offsetHeight < innerHeight - 2 || !dim(cs)) return null;
    if (el.querySelector("#pbx-stage,#pbx-frame")) return null;      /* محرر الصفحات نفسه ليس نافذة */
    return hasClose(el) ? el : null;
  };
  const block = e => { if (overlayOf(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); } };
  ["pointerdown", "mousedown", "mouseup", "touchstart", "touchend", "click"].forEach(ev => document.addEventListener(ev, block, true));
  document.addEventListener("keydown", e => {
    if (String(e.key || "") !== "Escape") return;
    const top = [...document.body.children].reverse().find(el => overlayOf(el));
    if (top) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
})();
