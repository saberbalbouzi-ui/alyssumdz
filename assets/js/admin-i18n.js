/* لغتا اللوحة: العربية (الأصل) والفرنسية — زرّ «FR / ع» في الشريط العلوي للتنقّل بينهما، ويُحفظ الاختيار.
   الآلية: قاموس assets/data/i18n-fr.json (نص عربي بالضبط ← فرنسي + أنماط للأرقام) يُطبَّق على نصوص الواجهة وplaceholder/title/aria-label،
   وMutationObserver يترجم ما يُرسم لاحقاً؛ وما ليس في القاموس يبقى بالعربية. العودة للعربية تستعيد الأصل بلا إعادة تحميل.
   التوسعة: scripts/gen-i18n-fr.py (أضف أزواجاً ثم شغّله). لا شيء خاص بمتجر.
   اللغة الافتراضية = «لغة الموقع» (store.json lang) ما لم يضغط المستخدم زرّ FR/ع؛ واختياره يُحفظ ويتقدّم على لغة الموقع. */
const AdminI18n = (() => {
  const KEY = "alyssum_lang", AR = /[؀-ۿ]/;
  let lang = "ar", dict = null, loading = null, busy = false, obs = null, tm = 0;
  const orig = new WeakMap(), origAttr = new WeakMap();      // عقدة نصية ← نصها العربي؛ عنصر ← {attr: الأصل}
  const ATTRS = ["placeholder", "title", "aria-label"];
  const SKIP = "script,style,textarea,code,pre,[data-i18n-skip],.notranslate,#pb-app,#pbx-frame,.pbx-ep";
  const get = () => { try { return localStorage.getItem(KEY) === "fr" ? "fr" : "ar"; } catch (e) { return "ar"; } };
  const chosen = () => { try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; } };      /* اختيار المستخدم الصريح (زرّ FR/ع) */
  const rx = () => (dict.rx || (dict.rx = (dict.patterns || []).map(p => [new RegExp(p[0]), String(p[1]).replace(/\\(\d)/g, "$$$1")])));

  const siteName = () => { try { return (typeof SITE_CFG !== "undefined" && SITE_CFG.name) || ""; } catch (e) { return ""; } }, panelName = () => { try { return (typeof SITE_CFG !== "undefined" && SITE_CFG.panelName) || ""; } catch (e) { return ""; } };
  const post = x => { const pn = panelName(), sn = siteName(); return x != null && pn && sn && x.indexOf(pn) >= 0 ? x.split(pn).join(sn) : x; };      /* الاسم العربي للوحة ← اسم المتجر اللاتيني بالفرنسية */
  function tr(text) { return post(tr0(text)); }
  /* ترجمة العبارات داخل النص (نصوص تُركَّب من أجزاء ومتغيّرات): أطول عبارة معروفة تبدأ عند كل كلمة عربية؛ الكلمة المفردة لا تُستبدَل داخل نص أطول إلا بجوار رقم (لئلا تُشوَّه بيانات الزبائن) */
  const AW = /[\u0600-\u06ff]+/g;
  function buildIdx() {
    if (dict.idx) return dict.idx; const idx = new Map();
    for (const k in dict.exact) { const m = /[\u0600-\u06ff]+/.exec(k); if (!m || k.length < 2) continue; let a = idx.get(m[0]); if (!a) idx.set(m[0], a = []); a.push({ k, off: m.index, multi: (k.match(/[\u0600-\u06ff]+/g) || []).length > 1 }); }
    idx.forEach(a => a.sort((x, y) => y.k.length - x.k.length)); return (dict.idx = idx);
  }
  function phrase(text) {
    const idx = buildIdx(); let out = "", last = 0, hit = false, m; AW.lastIndex = 0;
    while ((m = AW.exec(text))) {
      const c = idx.get(m[0]); if (!c) continue;
      for (const e of c) {
        const st = m.index - e.off; if (st < last || !text.startsWith(e.k, st)) continue;
        const en = st + e.k.length, nx = text.charAt(en); if (nx && /[\u0600-\u06ff]/.test(nx) && /[\u0600-\u06ff]$/.test(e.k)) continue;
        if (!e.multi) { const bef = text.slice(0, st).trim().slice(-1), aft = text.slice(en).trim().charAt(0); if (!(/\d/.test(bef) || /\d/.test(aft))) continue; }
        out += text.slice(last, st) + dict.exact[e.k]; last = en; hit = true; AW.lastIndex = en; break;
      }
    }
    if (!hit) return null;
    const res = out + text.slice(last), left = (res.match(/[\u0600-\u06ff]/g) || []).length, tot = (text.match(/[\u0600-\u06ff]/g) || []).length;
    return left > tot * 0.35 ? null : res;      /* ترجمة جزئية مشوَّهة: تبقى العربية كاملة أفضل من خليط */
  }
  function tr0(text) {
    if (!dict || !text || !AR.test(text)) return null;
    const m = /^([^؀-ۿA-Za-z0-9]*)([\s\S]*?)([^؀-ۿA-Za-z0-9]*)$/.exec(text.replace(/\s+/g, " ")); if (!m) return null;
    const pre = m[1], core = m[2].trim(), suf = m[3]; if (!core) return null;
    const whole0 = text.replace(/\s+/g, " ").trim(); if (dict.exact[whole0] != null) return dict.exact[whole0];
    let out = dict.exact[core];
    if (out == null) { for (const [re, t] of rx()) { if (re.test(core)) { out = core.replace(re, t); break; } } }
    if (out == null) { const full = text.replace(/\s+/g, " ").trim(); for (const [re, t] of rx()) { if (re.test(full)) return full.replace(re, t); } const ph = phrase(text.replace(/\s+/g, " ")); return ph; }
    return pre + out + suf;
  }
  function doText(n) {
    if (n.nodeType !== 3) return; const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    const cur = n.textContent, o = orig.get(n);
    if (o !== undefined && cur === o.fr) return;          // ترجمتنا الحالية
    const t = tr(cur); if (t == null || t === cur) return;
    orig.set(n, { ar: cur, fr: t }); n.textContent = t;
  }
  function doAttrs(el) {
    if (el.nodeType !== 1 || el.closest(SKIP)) return; let m = origAttr.get(el);
    for (const a of ATTRS) { const v = el.getAttribute(a); if (!v) continue; if (m && m[a] && m[a].fr === v) continue; const t = tr(v); if (t == null || t === v) continue; if (!m) { m = {}; origAttr.set(el, m); } m[a] = { ar: v, fr: t }; el.setAttribute(a, t); }
  }
  function walk(root) {
    if (!root) return; busy = true;
    try {
      if (root.nodeType === 3) doText(root);
      else if (root.nodeType === 1) {
        if (root.closest && root.closest(SKIP)) return; doAttrs(root);
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
  const queue = new Set();
  function flush() { tm = 0; const L = [...queue]; queue.clear(); L.forEach(n => { if (n.isConnected !== false) walk(n); }); }
  function observe() {
    if (obs) return;
    obs = new MutationObserver(ms => { if (busy || lang !== "fr") return; ms.forEach(m => { if (m.type === "childList") m.addedNodes.forEach(n => queue.add(n)); else if (m.type === "characterData") queue.add(m.target); else if (m.type === "attributes") queue.add(m.target); }); if (!tm) tm = setTimeout(flush, 80); });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  async function load() {
    if (dict) return dict; if (loading) return loading;
    loading = fetch("assets/data/i18n-fr.json", { cache: "no-cache" }).then(r => r.json()).then(j => { dict = j; return j; }).catch(() => { dict = { exact: {}, patterns: [] }; return dict; });
    return loading;
  }
  function paint() {
    const h = document.documentElement; h.setAttribute("lang", lang); h.setAttribute("dir", lang === "fr" ? "ltr" : "rtl"); h.classList.toggle("lang-fr", lang === "fr");
    try { const h1 = document.querySelector("#app .top>h1"); if (h1) h1.setAttribute("data-brand", lang === "fr" ? (siteName() || h1.getAttribute("data-brand") || "") : (window.AdminPanelName ? window.AdminPanelName() : (h1.getAttribute("data-brand") || ""))); } catch (e) { }
    const b = document.getElementById("top-lang"); if (b) { b.textContent = lang === "fr" ? "ع" : "FR"; b.title = lang === "fr" ? "العربية" : "Français"; b.setAttribute("aria-label", b.title); b.dataset.i18nSkip = "1"; }
  }
  async function set(l, auto) {
    lang = l === "fr" ? "fr" : "ar"; if (!auto) { try { localStorage.setItem(KEY, lang); } catch (e) { } }      /* auto = لغة الموقع الافتراضية: لا تُحفظ كاختيار فيبقى للمستخدم أن يختار */
    if (lang === "fr") { await load(); paint(); observe(); walk(document.body); }
    else { restore(); paint(); }
    try { document.dispatchEvent(new CustomEvent("alyssum:lang", { detail: lang })); } catch (e) { }
  }
  function mount() {
    const top = document.querySelector("#app .top"); if (!top) return false; if (document.getElementById("top-lang")) return true;
    const b = document.createElement("button"); b.type = "button"; b.id = "top-lang"; b.className = "small gray"; b.setAttribute("data-noco", ""); b.dataset.i18nSkip = "1"; b.textContent = lang === "fr" ? "ع" : "FR"; b.title = lang === "fr" ? "العربية" : "Français"; b.setAttribute("aria-label", b.title);
    b.onclick = () => set(lang === "fr" ? "ar" : "fr");
    const anchor = document.getElementById("top-search") || document.getElementById("top-menu"); if (anchor && anchor.parentNode === top) anchor.after(b); else top.insertBefore(b, top.firstChild);
    return true;
  }
  function init() {
    lang = get(); paint();
    let k = 0; const t = setInterval(() => { if (mount() || ++k > 60) clearInterval(t); }, 500);
    new MutationObserver(() => { if (!document.getElementById("top-lang")) mount(); }).observe(document.body, { childList: true, subtree: true });
    if (lang === "fr") set("fr");
    else if (!chosen()) fetch("assets/data/store.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.lang === "fr" && !chosen() && lang !== "fr") set("fr", true); }).catch(() => { });      /* لم يختر المستخدم لغة: تتبع اللوحة «لغة الموقع» (store.json) */
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { set, key: KEY, get lang() { return lang; }, helpUrl: () => lang === "fr" ? "assets/data/admin-help.fr.json" : "assets/data/admin-help.json", t: s => { const x = tr(String(s || "")); return lang === "fr" && x != null ? x : s; }, walk };
})();
window.AdminI18n = AdminI18n;
