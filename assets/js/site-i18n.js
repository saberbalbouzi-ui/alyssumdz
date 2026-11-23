/* لغة الموقع (واجهة الزبون): عند ضبط «لغة الموقع» = الفرنسية في إعدادات الموقع (assets/data/store.json: lang="fr") تتحوّل كل صفحات المتجر
   وصفحات القوالب المنشورة إلى الفرنسية فوراً: اتجاه الصفحة LTR، وقاموس assets/data/site-i18n-fr.json (نص عربي بالضبط ← فرنسي + أنماط للأرقام والمبالغ)
   يُطبَّق على النصوص وplaceholder/title/aria-label/alt وعنوان الصفحة، وMutationObserver يترجم ما يُرسَم لاحقاً (السلة، النماذج، بطاقات المنتجات).
   ما ليس في القاموس (أسماء منتجاتك ووصفها وما كتبته بنفسك) يبقى كما كتبتَه. العودة إلى العربية = تغيير الإعداد (بلا شيء محفوظ في الصفحات).
   مشترك لكل المواقع؛ لا شيء خاص بمتجر. التوسعة: scripts/gen-site-i18n-fr.py */
(function () {
  if (window.__siteI18n) return; window.__siteI18n = true;
  var KEY = "site_lang", AR = /[؀-ۿ]/, H = document.documentElement;
  var me = document.currentScript, SRC = (me && me.src) || "", BASE = SRC ? SRC.replace(/assets\/js\/site-i18n\.js[^]*$/, "") : "";
  var cached = ""; try { cached = localStorage.getItem(KEY) || ""; } catch (e) { }
  var UKEY = "site_lang_user", user = ""; try { user = localStorage.getItem(UKEY) || ""; } catch (e) { } if (user !== "fr" && user !== "ar") user = ""; if (user) cached = user;   /* اختيار الزائر بزر اللغة يتقدّم على إعداد الموقع */
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
    if (out == null) { var qm = /^(.*?)(\s*[×x]\s*\d+)$/.exec(k); if (qm && AR.test(qm[1])) { var qr = tr0(qm[1]); if (qr !== qm[1]) out = qr + qm[2]; } }   /* «… ×3» */
    if (out != null && out.indexOf("‹") >= 0) out = out.replace(/‹([^›]*)›/g, function (m0, g1) { var e1 = dict.exact[g1.trim()]; return e1 != null ? e1 : g1; });   /* ‹…›: يُترجَم إن وُجد في القاموس (اسم منتج نموذجي) */
    if (out == null) { var cur = k.replace(/(\d[\d\s.,]*)\s*دج\b/g, "$1\u00a0DA").replace(/\bدج\b/g, "DA"); if (cur !== k) out = cur; }
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

  /* ملاءمة الفرنسية للتخطيط الحر: المواضع ثابتة والفرنسية أطول، فإن تداخل نص (عنوان/فقرة) مع نص تحته يُصغَّر هو وحده بالقدر اللازم (zoom ≥ .60) */
  var fitT = 0, baseP = null, uid = 0;
  function decor(w) { var t = w.querySelector(".pb-hd,.pb-tx") || w, cs = getComputedStyle(t), am = /rgba\([^)]*,\s*([\d.]+)\)/.exec(cs.color || "");   /* نص زخرفي ضخم أو شفاف اللون خلف المحتوى: لا يُقاس ولا يُصغَّر */
    return parseFloat(cs.fontSize) > 140 || (am && +am[1] < .35); }
  function hasTxt(w) { return /\S/.test(w.textContent || "") && getComputedStyle(w).display !== "none" && !decor(w); }
  function fit(base) {
    var fzs = document.querySelectorAll(".pb-fz"); if (!fzs.length) return; busy = true; if (base) baseP = {};
    try { fzs.forEach(function (fz) {
      var ws = [].slice.call(fz.children).filter(function (c) { return c.classList && c.classList.contains("pb-w"); }), sv = [];
      ws.forEach(function (w) { var mm = /matrix\(([^)]*)\)/.exec(getComputedStyle(w).transform || ""); w.__rot = !!(mm && Math.abs(parseFloat(mm[1].split(",")[1])) > .01); sv.push([w, w.style.getPropertyValue("transform"), w.style.getPropertyValue("translate")]); w.style.setProperty("transform", "none", "important"); w.style.setProperty("translate", "none", "important");
        var t = w.querySelector(".pb-hd,.pb-tx"); if (t) t.style.zoom = ""; });
      var ts = ws.filter(function (w) { return /^(heading|text)$/.test(w.getAttribute("data-type") || "") && w.querySelector(".pb-hd,.pb-tx") && hasTxt(w); })
        .sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
      var blockers = ws.filter(hasTxt);
      function tb(el) { var rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); }
      function lead(o) { var e = o.querySelector(".pb-hd,.pb-tx,.pb-btn,a,button") || o; return tb(e); }
      ts.forEach(function (w) { w.__id = w.__id || ++uid; }); blockers.forEach(function (o) { o.__id = o.__id || ++uid; });
      ts.forEach(function (w) {
        var t = w.querySelector(".pb-hd,.pb-tx"), z = 1;
        function area() { var r = tb(t), x = w.__rot && !base ? 18 : 0, s = 0; for (var i = 0; i < blockers.length; i++) { var o = blockers[i]; if (o === w) continue; var q = lead(o), m = x + (o.__rot && !base ? 18 : 0);
          if (q.width && q.left < r.right - 8 && q.right > r.left + 8 && r.bottom + m > q.top - 4 && r.top - m < q.bottom - 4) { var k = w.__id + "|" + o.__id, ar = Math.max(1, (Math.min(r.right, q.right) - Math.max(r.left, q.left)) * (Math.min(r.bottom + m, q.bottom) - Math.max(r.top - m, q.top))); if (base) { baseP[k] = ar; continue; } var ex = ar - (baseP && baseP[k] ? baseP[k] * 1.25 + 150 : 0); if (ex > 0) s += ex; } } return s; }
        if (base) { area(); return; }
        var a0 = area(), a = a0; while (a > 0 && z > .6) { z -= .04; t.style.zoom = z.toFixed(2); a = area(); }
        if (window.__siDebug) (window.__siLog = window.__siLog || []).push([w.className.match(/x-[a-z0-9]+/)[0], Math.round(a0), Math.round(a), +z.toFixed(2), Math.round(Date.now() % 100000)]);
        if (a > 0 && a > a0 * .7) t.style.zoom = "";      /* لا يحلّه التصغير (التداخل سببه العنصر الآخر): يُترك ويُعالَج هو */
      });
      sv.forEach(function (s) { if (s[1]) s[0].style.setProperty("transform", s[1]); else s[0].style.removeProperty("transform"); if (s[2]) s[0].style.setProperty("translate", s[2]); else s[0].style.removeProperty("translate"); });
    }); } catch (e) { }
    busy = false;
  }
  function fitSoon() { clearTimeout(fitT); fitT = setTimeout(function () { if (on) fit(); }, 120); }
  addEventListener("resize", fitSoon); addEventListener("load", function () { setTimeout(fitSoon, 300); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);
  function apply() {
    if (!dict) return; if (!baseP) { try { fit(true); } catch (e) { } } on = true; busy = true;
    H.setAttribute("lang", "fr"); H.setAttribute("dir", "ltr"); H.classList.add("site-fr");
    if (!document.getElementById("site-i18n-css")) { var cs = document.createElement("style"); cs.id = "site-i18n-css"; cs.textContent = "html.site-fr{overflow-x:clip}"; (document.head || H).appendChild(cs); }   /* ما كان يفيض يساراً بلا شريط في RTL يصير يميناً في LTR */
    try { walk(document.body || H); if (AR.test(document.title)) { var r = tr0(document.title); if (r !== document.title) document.title = r; }
      var md = document.querySelector('meta[name="description"]'); if (md && AR.test(md.content)) md.content = tr0(md.content); } catch (e) { }
    busy = false; fit(); show(); fitSoon();
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
    load().then(function (d) { if (!d) { show(); return; } var go = function () { var done = 0, run = function () { if (done) return; done = 1; apply(); watch(); };   /* انتظر الخطوط (حدّ 1.2ث) ليُقاس التخطيط العربي الأصلي بدقّة قبل الترجمة */
        if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); setTimeout(run, 1200); } else run(); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); setTimeout(apply, 600); setTimeout(apply, 2000); });
  }
  /* زر تبديل اللغة للزائر (عربي ⇄ Français): مقبض ثابت على حافة نهاية السطر (يسار في العربية، يمين في الفرنسية)؛ الاختيار يُحفظ في المتصفح ويتقدّم على إعداد الموقع.
     يُخفى داخل الإطارات (معاينة اللوحة/التضمين) وفي المطوّر والطباعة، ويُعطَّل من الإعدادات (store.json langSwitch:false). */
  function langBtn(cur) {
    if (document.getElementById("site-lang-btn")) return;
    if (window.top !== window || /[?&](embed|preview)=1/.test(location.search)) return;
    var mk = function () {
      if (document.getElementById("site-lang-btn") || !document.body || document.body.classList.contains("pb-edit") || document.getElementById("pb-app")) return;
      var st = document.createElement("style"); st.id = "site-lang-css";
      st.textContent = "#site-lang-btn{position:fixed;left:0;top:42%;z-index:900;display:flex;flex-direction:column;overflow:hidden;border-radius:0 12px 12px 0;background:rgba(24,24,27,.92);box-shadow:0 4px 16px rgba(0,0,0,.28);font:700 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;direction:ltr}" +
        "#site-lang-btn[data-side=r]{left:auto;right:0;border-radius:12px 0 0 12px}#site-lang-btn button{all:unset;box-sizing:border-box;cursor:pointer;padding:11px 9px;min-width:34px;text-align:center;color:rgba(255,255,255,.78);letter-spacing:.02em}" +
        "#site-lang-btn button[aria-pressed=true]{background:#fff;color:#111;cursor:default}#site-lang-btn button:focus-visible{outline:2px solid #fff;outline-offset:-3px}" +
        "@media(max-width:600px){#site-lang-btn{top:38%}#site-lang-btn button{padding:8px 5px;min-width:26px;font-size:11.5px}}@media print{#site-lang-btn{display:none!important}}";
      (document.head || H).appendChild(st);
      var b = document.createElement("div"); b.id = "site-lang-btn"; b.className = "notranslate"; b.setAttribute("data-i18n-skip", ""); b.setAttribute("translate", "no"); b.setAttribute("role", "group"); b.setAttribute("data-side", cur === "fr" ? "r" : "l");   /* على حافة نهاية السطر: يسار في العربية (RTL) ويمين في الفرنسية فلا يغطّي بداية النص */ b.setAttribute("aria-label", "Langue / اللغة");
      [["ar", "ع", "العربية"], ["fr", "FR", "Français"]].forEach(function (l) {
        var x = document.createElement("button"); x.type = "button"; x.textContent = l[1]; x.setAttribute("aria-label", l[2]); x.setAttribute("aria-pressed", l[0] === cur ? "true" : "false");
        x.addEventListener("click", function () {
          if (l[0] === cur) return; try { localStorage.setItem(UKEY, l[0]); localStorage.setItem(KEY, l[0]); } catch (e) { }
          var u = location.href.replace(/([?&])lang=(fr|ar)(&|$)/, function (m0, a, b0, c0) { return c0 ? a : ""; }).replace(/[?&]$/, ""); if (u !== location.href) location.replace(u); else location.reload();
        });
        b.appendChild(x);
      });
      document.body.appendChild(b);
      /* لا يغطّي نصاً: يختار الموضع الرأسي الأقلّ تقاطعاً مع النصوص الظاهرة عند حافته ويعيد الاختيار بعد التمرير/تغيير الحجم */
      var at = 0, place = function () {
        try {
          var side = b.getAttribute("data-side") === "r", bw = b.offsetWidth || 30, bh = b.offsetHeight || 64, vw = innerWidth, vh = innerHeight, bx0 = side ? vw - bw : 0, bx1 = side ? vw : bw, rects = [], tw = document.createTreeWalker(document.body, 4, null), n, rg = document.createRange();
          while ((n = tw.nextNode())) { if (!/\S/.test(n.nodeValue)) continue; var pe = n.parentElement; if (!pe || b.contains(pe) || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(pe.tagName)) continue;
            rg.selectNodeContents(n); var cl = rg.getClientRects(); for (var i = 0; i < cl.length; i++) { var q = cl[i]; if (q.width < 2 || q.bottom < 0 || q.top > vh || q.right < bx0 || q.left > bx1) continue; var cs = getComputedStyle(pe); if (cs.visibility === "hidden" || +cs.opacity < .05) continue; rects.push(q); } }
          var best = -1, bs = 1e12, cands = [.38, .5, .62, .26, .74, .14, .86, .08, .92];
          for (var k = 0; k < cands.length; k++) { var t0 = Math.round(vh * cands[k] - bh / 2), t1 = t0 + bh, s = 0; if (t0 < 4 || t1 > vh - 4) continue;
            for (var m = 0; m < rects.length; m++) { var r = rects[m], ox = Math.min(r.right, bx1) - Math.max(r.left, bx0), oy = Math.min(r.bottom, t1) - Math.max(r.top, t0); if (ox > 1 && oy > 1) s += ox * oy; }
            if (s < bs) { bs = s; best = t0; if (s === 0) break; } }
          if (best >= 0) { b.style.transition = "top .25s"; b.style.top = best + "px"; }
        } catch (e) { }
      }, again = function () { clearTimeout(at); at = setTimeout(place, 220); };
      setTimeout(place, 900); setTimeout(place, 2600); addEventListener("scroll", again, { passive: true }); addEventListener("resize", again); addEventListener("load", again);
    };
    if (document.body) mk(); else document.addEventListener("DOMContentLoaded", mk);
  }
  function init() {
    if (q) { start(q[1]); return; }
    fetch(BASE + "assets/data/store.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (c) {
      var lang = user || (c && c.lang) || (cached || "ar"); lang = lang === "fr" ? "fr" : "ar"; try { localStorage.setItem(KEY, lang); } catch (e) { }
      if (lang === "fr" && cached !== "fr") { cached = "fr"; hideUntil(); }
      start(lang);
      if (!(c && c.langSwitch === false)) langBtn(lang);
    });
  }
  window.SiteI18n = { user: function () { return user; }, lang: function () { return on ? "fr" : "ar"; }, apply: apply, tr: function (t) { return dict ? tr0(t) : t; }, ready: function () { return !!dict; } };
  if (cached === "fr") load();      /* ابدأ تحميل القاموس مبكراً */
  init();
})();
