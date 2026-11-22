/* لغة الموقع (واجهة الزبون): عند ضبط «لغة الموقع» = الفرنسية في إعدادات الموقع (assets/data/store.json: lang="fr") تتحوّل كل صفحات المتجر
   وصفحات القوالب المنشورة إلى الفرنسية فوراً: اتجاه الصفحة LTR، وقاموس assets/data/site-i18n-fr.json (نص عربي بالضبط ← فرنسي + أنماط للأرقام والمبالغ)
   يُطبَّق على النصوص وplaceholder/title/aria-label/alt وعنوان الصفحة، وMutationObserver يترجم ما يُرسَم لاحقاً (السلة، النماذج، بطاقات المنتجات).
   ما ليس في القاموس (أسماء منتجاتك ووصفها وما كتبته بنفسك) يبقى كما كتبتَه. العودة إلى العربية = تغيير الإعداد (بلا شيء محفوظ في الصفحات).
   مشترك لكل المواقع؛ لا شيء خاص بمتجر. التوسعة: scripts/gen-site-i18n-fr.py */
(function () {
  if (window.__siteI18n) return; window.__siteI18n = true;
  var KEY = "alyssum_site_lang", AR = /[؀-ۿ]/, H = document.documentElement;
  var me = document.currentScript, SRC = (me && me.src) || "", BASE = SRC ? SRC.replace(/assets\/js\/site-i18n\.js[^]*$/, "") : "";
  var cached = ""; try { cached = localStorage.getItem(KEY) || ""; } catch (e) { }
  var q = /[?&]lang=(fr|ar)\b/.exec(location.search); if (q) cached = q[1];
  var dict = null, obs = null, busy = false, on = false, orig = new WeakMap(), origAttr = new WeakMap(), tm = 0;
  var SKIP = "script,style,textarea,code,pre,noscript,[data-i18n-skip],.notranslate,.pb-edit,#pb-app,#pbx-frame";
  var ATTRS = ["placeholder", "title", "aria-label", "alt"];
  function hideUntil() { if (cached === "fr") { H.setAttribute("data-site-i18n", "wait"); var st = document.createElement("style"); st.id = "site-i18n-wait"; st.textContent = "html[data-site-i18n=wait] body{visibility:hidden!important}"; (document.head || H).appendChild(st); setTimeout(show, 2500); } }
  function show() { H.removeAttribute("data-site-i18n"); var s = document.getElementById("site-i18n-wait"); if (s && s.parentNode) s.parentNode.removeChild(s); }
  hideUntil();
  function rx() { return dict.rx || (dict.rx = (dict.patterns || []).map(function (p) { return [new RegExp(p[0]), String(p[1]).replace(/\\(\d)/g, "$$$1")]; })); }
  var CORE = null; try { CORE = new RegExp("^([^\\p{L}\\p{N}]*)([\\s\\S]*?)([^\\p{L}\\p{N}.!؟?)»]*)$", "u"); } catch (e) { }
  var SEP = /(\s*[✦|]\s*|\s+·\s+|,|\s+—\s+)/;
  function tr0(t) {
    var k = t.replace(/\s+/g, " ").trim(); if (!k || !AR.test(k)) return t;
    var lead = /^\s*/.exec(t)[0], tail = /\s*$/.exec(t)[0], out = dict.exact[k];
    if (out == null) { var rs = rx(), i, m; for (i = 0; i < rs.length; i++) { if (rs[i][0].test(k)) { out = k.replace(rs[i][0], rs[i][1]); break; } } }
    if (out == null && CORE) {          /* رموز/إيموجي في البداية أو النهاية: تُترجَم النواة وتبقى الرموز */
      var cm = CORE.exec(k); if (cm && cm[2] && (cm[1] || cm[3])) { var ce = dict.exact[cm[2]]; if (ce != null) out = cm[1] + ce + cm[3]; }
    }
    if (out == null && SEP.test(k)) {      /* سطر مركَّب من أجزاء: تُترجَم أجزاؤه وتبقى الفواصل */
      var parts = k.split(SEP), hit = 0, res = parts.map(function (p) { if (!AR.test(p)) return p; var e = dict.exact[p.trim()]; if (e == null) { var pk = p.trim(), ri, rr = rx(); for (ri = 0; ri < rr.length; ri++) { if (rr[ri][0].test(pk)) { e = pk.replace(rr[ri][0], rr[ri][1]); break; } } } if (e != null) { hit++; return e; } return p; });
      if (hit) { var out2 = res.join(""); if (!AR.test(out2) || hit >= parts.filter(function (p) { return AR.test(p); }).length * .6) out = out2; }
    }
    if (out == null) { var cur = k.replace(/(\d[\d\s.,]*)\s*دج\b/g, "$1 DA").replace(/\bدج\b/g, "DA"); if (cur !== k) out = cur; }
    return out == null ? t : lead + out + tail;
  }
  function trNode(n) {
    var t = n.nodeValue; if (!t || !AR.test(t)) { if (orig.has(n) && t === orig.get(n)[1]) return; return; }
    var o = orig.get(n); if (o && o[1] === t) return;      /* نصّ سبقت ترجمته */
    var r = tr0(t); if (r !== t) { orig.set(n, [t, r]); n.nodeValue = r; }
  }
  function trAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute && el.getAttribute(a); if (!v || !AR.test(v)) continue;
      var r = tr0(v); if (r !== v) { var m = origAttr.get(el) || {}; m[a] = v; origAttr.set(el, m); el.setAttribute(a, r); }
    }
    if (el.tagName === "INPUT" && /^(submit|button)$/i.test(el.type) && AR.test(el.value || "")) { var rv = tr0(el.value); if (rv !== el.value) el.value = rv; }
  }
  function walk(root) {
    if (!root) return; if (root.nodeType === 3) { trNode(root); return; } if (root.nodeType !== 1) return;
    if (root.matches && root.matches(SKIP)) return;
    var tw = document.createTreeWalker(root, 5, { acceptNode: function (n) { if (n.nodeType === 1) { if (n.matches && n.matches(SKIP)) return 2; return 3; } return 1; } }), n;
    trAttrs(root); while ((n = tw.nextNode())) { if (n.nodeType === 3) trNode(n); else trAttrs(n); }
  }
  function apply() {
    if (!dict) return; on = true; busy = true;
    H.setAttribute("lang", "fr"); H.setAttribute("dir", "ltr"); H.classList.add("site-fr");
    if (!document.getElementById("site-i18n-css")) { var cs = document.createElement("style"); cs.id = "site-i18n-css"; cs.textContent = "html.site-fr{overflow-x:clip}"; (document.head || H).appendChild(cs); }   /* ما كان يفيض يساراً بلا شريط في RTL يصير يميناً في LTR */
    try { walk(document.body || H); if (AR.test(document.title)) { var r = tr0(document.title); if (r !== document.title) document.title = r; }
      var md = document.querySelector('meta[name="description"]'); if (md && AR.test(md.content)) md.content = tr0(md.content); } catch (e) { }
    busy = false; show();
  }
  function watch() {
    if (obs || !document.body) return;
    obs = new MutationObserver(function (ms) {
      if (busy || !on) return; clearTimeout(tm);
      tm = setTimeout(function () { busy = true; try { ms.forEach(function (m) { if (m.type === "characterData") trNode(m.target); else if (m.type === "attributes") trAttrs(m.target); else m.addedNodes.forEach(function (x) { walk(x); }); }); } catch (e) { } busy = false; }, 30);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function load() {
    if (dict) return Promise.resolve(dict);
    return fetch(BASE + "assets/data/site-i18n-fr.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { dict = d; return d; }).catch(function () { return null; });
  }
  function start(lang) {
    if (lang !== "fr") { show(); return; }
    load().then(function (d) { if (!d) { show(); return; } var go = function () { apply(); watch(); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); setTimeout(apply, 600); setTimeout(apply, 2000); });
  }
  function init() {
    if (q) { start(q[1]); return; }
    fetch(BASE + "assets/data/store.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (c) {
      var lang = (c && c.lang) || (cached || "ar"); try { localStorage.setItem(KEY, lang === "fr" ? "fr" : "ar"); } catch (e) { }
      if (lang === "fr" && cached !== "fr") { cached = "fr"; hideUntil(); }
      start(lang);
    });
  }
  window.SiteI18n = { apply: apply, tr: function (t) { return dict ? tr0(t) : t; }, ready: function () { return !!dict; } };
  if (cached === "fr") load();      /* ابدأ تحميل القاموس مبكراً */
  init();
})();
