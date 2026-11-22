/* لغة Spatial Core: العربية (الأصل) والفرنسية — تتبع لغة اللوحة نفسها (مفتاح alyssum_lang، وإلا «لغة الموقع» من store.json) وتتزامن معها في الاتجاهين:
   • زر «FR / ع» في شريط الأدوات هنا يبدّل لغة Spatial Core وكل الألواح المفتوحة (صفحات اللوحة الحقيقية داخل الإطارات) في اللحظة نفسها.
   • وإن بدّل المستخدم اللغة من زر الشريط العلوي داخل أي لوح، تتبعه Spatial Core وبقية الألواح فوراً.
   الآلية كآلية اللوحة (قاموس نص عربي بالضبط ← فرنسي + أنماط + عبارات داخل النص): القاموس المشترك assets/data/i18n-fr.json ثم spatial-fr.json (خاص بعناصر Spatial وله الأولوية)،
   ويُطبَّق على نصوص الصفحة وtitle/aria-label/placeholder مع مراقب لما يُرسم لاحقاً؛ والعودة للعربية تستعيد الأصل بلا إعادة تحميل. ما ليس في القاموس يبقى بالعربية.
   لا يُحمَّل أي قاموس والمستخدم بالعربية (السرعة). واجهة LAURA تترجم نفسها (مستثناة هنا). الحدث العام document «alyssum:lang» (detail = "fr"|"ar") يطلقه كل من اللوحة وهذا الملف. */
(() => {
  "use strict";
  if (window.SpatialI18n) return;
  const KEYS = ["alyssum_lang", "store_lang"], AR = /[؀-ۿ]/, AW = /[؀-ۿ]+/g;
  const SKIP = "script,style,textarea,iframe,code,pre,[data-i18n-skip],.notranslate,#laura,.pn-frame";
  const ATTRS = ["placeholder", "title", "aria-label"];
  const BASE = (() => { try { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, "") : ""; } catch (_) { return ""; } })();
  let KEY = KEYS[0], lang = "ar", dict = null, loading = null, obs = null, busy = false, tm = 0, auto = false; const orig = new WeakMap(), origAttr = new WeakMap(), subs = new Set(), queue = new Set();
  /* مفتاح التخزين: تُبدّله حزمة العميل (alyssum_ ← store_)؛ نعتمد ما تعلنه صفحة اللوحة نفسها (AdminI18n.key) وإلا ما هو موجود في التخزين */
  try { const ex = KEYS.find(k => localStorage.getItem(k) !== null); if (ex) KEY = ex; } catch (_) { }
  const syncKey = A => { if (A && A.key && A.key !== KEY) KEY = A.key; };
  const stored = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const chosen = () => stored() !== null;
  const rx = () => (dict.rx || (dict.rx = (dict.patterns || []).map(p => [new RegExp(p[0]), String(p[1])])));
  /* قالب النمط: \\N = المجموعة كما هي، {N} = المجموعة مترجَمة بالقاموس (أسماء الأقسام/الأدوات داخل الرسائل المركّبة) */
  const ap = (re, tpl, s) => s.replace(re, (...a) => tpl.replace(/\{(\d)\}|\\(\d)/g, (_, x, y) => x ? (tr0(a[+x]) ?? a[+x]) : a[+y]));
  function buildIdx() {
    if (dict.idx) return dict.idx; const idx = new Map();
    for (const k in dict.exact) { const m = AW.exec(k) || null; AW.lastIndex = 0; if (!m || k.length < 2) continue; let a = idx.get(m[0]); if (!a) idx.set(m[0], a = []); a.push({ k, off: m.index, multi: (k.match(AW) || []).length > 1 }); }
    idx.forEach(a => a.sort((x, y) => y.k.length - x.k.length)); return (dict.idx = idx);
  }
  function phrase(text) {
    const idx = buildIdx(); let out = "", last = 0, hit = false, m; AW.lastIndex = 0;
    while ((m = AW.exec(text))) {
      const c = idx.get(m[0]); if (!c) continue;
      for (const e of c) {
        const st = m.index - e.off; if (st < last || !text.startsWith(e.k, st)) continue;
        const en = st + e.k.length, nx = text.charAt(en); if (nx && AR.test(nx) && AR.test(e.k.slice(-1))) continue;
        if (!e.multi) { const bef = text.slice(0, st).trim().slice(-1), aft = text.slice(en).trim().charAt(0); if (!(/\d/.test(bef) || /\d/.test(aft))) continue; }
        out += text.slice(last, st) + dict.exact[e.k]; last = en; hit = true; AW.lastIndex = en; break;
      }
    }
    if (!hit) return null;
    const res = out + text.slice(last), left = (res.match(/[؀-ۿ]/g) || []).length, tot = (text.match(/[؀-ۿ]/g) || []).length;
    return left > tot * 0.35 ? null : res;
  }
  function tr0(text) {
    if (!dict || !text || !AR.test(text)) return null; const norm = text.replace(/\s+/g, " ");
    const m = /^([^؀-ۿA-Za-z0-9]*)([\s\S]*?)([^؀-ۿA-Za-z0-9]*)$/.exec(norm); if (!m) return null;
    const pre = m[1], core = m[2].trim(), suf = m[3]; if (!core) return null; const whole = norm.trim(); if (dict.exact[whole] != null) return dict.exact[whole];
    let out = dict.exact[core]; if (out == null) { for (const [re, t] of rx()) { if (re.test(core)) { out = ap(re, t, core); break; } } }
    if (out == null) { for (const [re, t] of rx()) { if (re.test(whole)) return ap(re, t, whole); } return phrase(norm); }
    return pre + out + suf;
  }
  /* ترجمة نص وقت التشغيل (رسائل تُركَّب في الشيفرة): بالعربية تعود كما هي */
  const t = s => { s = String(s == null ? "" : s); if (lang !== "fr") return s; const x = tr0(s); return x == null ? s : x; };
  function doText(n) {
    const p = n.parentElement; if (!p || p.closest(SKIP)) return; const cur = n.textContent, o = orig.get(n); if (o !== undefined && cur === o.fr) return;
    const x = tr0(cur); if (x == null || x === cur) return; orig.set(n, { ar: cur, fr: x }); n.textContent = x;
  }
  function doAttrs(el) {
    if (el.closest(SKIP)) return; let m = origAttr.get(el);
    for (const a of ATTRS) { const v = el.getAttribute(a); if (!v) continue; if (m && m[a] && m[a].fr === v) continue; const x = tr0(v); if (x == null || x === v) continue; if (!m) { m = {}; origAttr.set(el, m); } m[a] = { ar: v, fr: x }; el.setAttribute(a, x); }
  }
  function walk(root) {
    if (!root) return; busy = true;
    try {
      if (root.nodeType === 3) doText(root);
      else if (root.nodeType === 1) {
        if (root.closest(SKIP)) return; doAttrs(root);
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => (n.nodeType === 1 && n.matches(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
      }
    } finally { busy = false; }
  }
  function restore() {
    busy = true;
    try {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) { const o = orig.get(n); if (o && n.textContent === o.fr) n.textContent = o.ar; orig.delete(n); }
        else { const m = origAttr.get(n); if (m) { for (const a in m) if (n.getAttribute(a) === m[a].fr) n.setAttribute(a, m[a].ar); origAttr.delete(n); } }
      }
    } finally { busy = false; }
  }
  function flush() { tm = 0; const L = [...queue]; queue.clear(); L.forEach(n => { if (n.isConnected !== false) walk(n); }); }
  function observe() {
    if (obs) return;
    obs = new MutationObserver(ms => { if (busy || lang !== "fr") return; ms.forEach(m => { if (m.type === "childList") m.addedNodes.forEach(n => queue.add(n)); else queue.add(m.target); }); if (!tm) tm = setTimeout(flush, 60); });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function load() {
    if (dict) return Promise.resolve(dict); if (loading) return loading; const j = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
    loading = Promise.all([j(BASE + "../../assets/data/i18n-fr.json"), j(BASE + "spatial-fr.json")]).then(([a, b]) => {
      a = a || { exact: {}, patterns: [] }; b = b || { exact: {}, patterns: [] };
      dict = { exact: Object.assign({}, a.exact, b.exact), patterns: (b.patterns || []).concat(a.patterns || []) };      /* أنماط Spatial أولاً */
      return dict;
    }); return loading;
  }
  /* ───── الإطارات (الألواح الحقيقية) ───── */
  const frames = () => [...document.querySelectorAll("iframe")];
  const frameLang = f => { try { const A = f.contentWindow.AdminI18n; return A ? A.lang : null; } catch (_) { return null; } };
  function pushTo(f) { try { const A = f.contentWindow.AdminI18n; syncKey(A); if (A && A.lang !== lang) A.set(lang, !chosen()); } catch (_) { } }
  function hook(f) {
    try {
      const d = f.contentDocument; if (!d || d.__spI18n) return; d.__spI18n = 1; try { syncKey(f.contentWindow.AdminI18n); } catch (_) { }
      d.addEventListener("alyssum:lang", e => { const l = e && e.detail === "fr" ? "fr" : "ar"; if (l !== lang) set(l, { fromFrame: true }); });
      pushTo(f);
    } catch (_) { }
  }
  /* load لا يتصاعد: التقاطه في طور الالتقاط يصل إلى كل إطار جديد (لوح مفتوح/لوح احتياطي/استعادة) */
  window.addEventListener("load", e => { const f = e.target; if (f && f.tagName === "IFRAME") setTimeout(() => hook(f), 0); }, true);
  setInterval(() => { if (document.hidden) return; frames().forEach(f => { try { if (f.contentDocument && f.contentDocument.readyState !== "loading") hook(f); } catch (_) { } }); }, 2500);   /* إطارات حُمّلت قبل تركيب المستمع أو أُعيد إسنادها */
  function paint() {
    const h = document.documentElement; h.setAttribute("lang", lang); h.classList.toggle("lang-fr", lang === "fr");
    ["hud", "modebar", "dock", "mread", "active", "yawchip"].forEach(id => { const e = document.getElementById(id); if (e) e.setAttribute("dir", lang === "fr" ? "ltr" : "rtl"); });
    const b = document.getElementById("hud-lang"); if (b) { b.textContent = lang === "fr" ? "ع" : "FR"; b.title = lang === "fr" ? "العربية" : "Français"; b.setAttribute("aria-label", b.title); b.dataset.i18nSkip = "1"; }
  }
  async function set(l, o) {
    o = o || {}; const next = l === "fr" ? "fr" : "ar"; if (!o.fromFrame && !o.auto) { try { localStorage.setItem(KEY, next); } catch (_) { } }
    if (next === lang && !o.force) { paint(); return; } lang = next;
    if (lang === "fr") { await load(); if (lang !== "fr") return; paint(); observe(); walk(document.body); }
    else { restore(); paint(); }
    frames().forEach(pushTo);
    try { document.dispatchEvent(new CustomEvent("alyssum:lang", { detail: lang })); } catch (_) { }
    subs.forEach(fn => { try { fn(lang); } catch (_) { } });
  }
  function init() {
    lang = stored() === "fr" ? "fr" : "ar"; paint();
    const b = document.getElementById("hud-lang"); if (b) b.addEventListener("click", () => set(lang === "fr" ? "ar" : "fr"));
    window.addEventListener("storage", e => { if (KEYS.includes(e.key)) { KEY = e.key; const l = e.newValue === "fr" ? "fr" : "ar"; if (l !== lang) set(l, { fromFrame: true }); } });
    if (lang === "fr") { lang = "ar"; set("fr", { force: true, auto: true }); }
    else if (!chosen()) fetch(BASE + "../../assets/data/store.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.lang === "fr" && !chosen() && lang !== "fr") set("fr", { auto: true }); }).catch(() => { });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.SpatialI18n = { set: l => set(l), get lang() { return lang; }, t, onChange(fn) { subs.add(fn); return () => subs.delete(fn); }, walk: () => { if (lang === "fr") walk(document.body); }, get ready() { return lang !== "fr" || !!dict; } };
})();
