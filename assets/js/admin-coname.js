/* اسم شركة التوصيل في واجهة اللوحة: كل نص «ياليدين» (في الأزرار والشروحات والإشعارات والرسائل) يتبدّل تلقائياً
   باسم الشركة المفعّلة (الافتراضية)؛ وإن لم تُفعَّل شركة يصير «شركة التوصيل». لا يمسّ صفحة «شركات التوصيل» نفسها
   (فيها أسماء الشركات الحقيقية وإعداداتها). الأصل يُحفظ فيرجع النص عند تغيير الشركة. */
const CoName = (() => {
  const BASE = "ياليدين", SKIP = "#tab-delivery,[data-noco]", ATTR = ["title", "placeholder"];
  const T = new WeakMap(), A = new WeakMap();           // العقدة النصية ← {o: الأصل, r: المعروض} ، العنصر ← {سمة: {o,r}}
  let cur = BASE, busy = false;
  const short = n => { n = String(n || "").trim(); const s = n.replace(/\s*[A-Za-z][A-Za-z0-9\s.\-]*$/, "").trim(); return s || n; };
  function nameNow() {
    try {
      if (typeof Admin === "undefined" || typeof Admin.activeCompanyKey !== "function") return BASE;
      const all = Admin.allDeliveryCompanies(), k = Admin.activeCompanyKey();
      return k && all[k] ? short(all[k].name) : "شركة التوصيل";
    } catch (e) { return BASE; }
  }
  const rep = s => (s.indexOf(BASE) < 0 ? s : s.split(BASE).join(cur));
  const skipped = el => !!(el && el.closest && el.closest(SKIP));
  function text(node) {
    const p = node.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || skipped(p)) return;
    const m = T.get(node), d = node.data, src = m && m.r === d ? m.o : d;
    if (src.indexOf(BASE) < 0 && !m) return;
    const r = rep(src); if (r !== d) node.data = r; T.set(node, { o: src, r });
  }
  function attrs(el) {
    if (skipped(el)) return;
    ATTR.forEach(a => {
      const v = el.getAttribute(a); if (v == null) return; const m = (A.get(el) || {})[a], src = m && m.r === v ? m.o : v;
      if (src.indexOf(BASE) < 0 && !m) return; const r = rep(src); if (r !== v) el.setAttribute(a, r);
      const o = A.get(el) || {}; o[a] = { o: src, r }; A.set(el, o);
    });
  }
  function walk(root) {
    if (!root) return; busy = true;
    try {
      if (root.nodeType === 3) return text(root);
      if (root.nodeType !== 1) return;
      if (/^(SCRIPT|STYLE)$/.test(root.nodeName)) return;
      attrs(root);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n; while ((n = w.nextNode())) { if (n.nodeType === 3) text(n); else if (!/^(SCRIPT|STYLE)$/.test(n.nodeName)) attrs(n); }
    } finally { busy = false; }
  }
  function refresh() { const n = nameNow(); if (n !== cur) cur = n; walk(document.body); }
  function start() {
    cur = nameNow(); walk(document.body);
    new MutationObserver(ms => {
      if (busy) return; const n = nameNow(); if (n !== cur) { cur = n; walk(document.body); return; }
      busy = true; try { ms.forEach(m => { if (m.type === "childList") m.addedNodes.forEach(x => walk(x)); else if (m.type === "characterData") text(m.target); else if (m.type === "attributes") attrs(m.target); }); } finally { busy = false; }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    setInterval(() => { const n = nameNow(); if (n !== cur) { cur = n; walk(document.body); } }, 1500);
  }
  /* نوافذ المتصفح الأصلية (prompt/confirm/alert) */
  ["alert", "confirm", "prompt"].forEach(k => { const f = window[k]; window[k] = function (m) { const a = Array.prototype.slice.call(arguments); if (typeof m === "string") a[0] = rep(m); return f.apply(this, a); }; });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  return { refresh, name: () => cur, short };
})();
