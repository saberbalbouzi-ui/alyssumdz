/* «حماية الموقع»: رادع من نسخ الصور والكود والصفحات (لا قفل مطلق: أي صفحة تصل المتصفح يمكن لمحترف قراءتها).
   الإعدادات من assets/data/protect.json (تحرَّر من إضافة «حماية الموقع»)؛ بلا ملف = الافتراضيات الموصى بها.
   لا تعمل في لوحة التحكم ولا عند دخول المالك ولا داخل الإطارات؛ والمتصفحات الآلية لا تُحجب إلا بخيار «bots» (ويُستثنى جوجل وبينج وأدوات قياس الأداء). */
(function () {
  try {
    if (window.__acg) return; window.__acg = 1;
    var DEF = { on: true, rc: true, img: true, keys: true, dev: true, frame: true, note: true, sel: false, copy: false, print: false, bots: false };
    var cfg = {}; for (var k in DEF) cfg[k] = DEF[k];
    var me = document.currentScript, rel = typeof REL !== "undefined" ? REL : (me && me.src ? me.src.replace(/assets\/js\/anti-copy\.js.*$/, "") : ""), P = location.pathname, ls = null; try { ls = window.localStorage; } catch (e) { }
    if (/(^|\/)admin(\.html)?$/.test(P) || /[?&](embed|preview)=1/.test(location.search)) return;
    if (ls && (ls.getItem("alyssum_admin_on") || ls.getItem("alyssum_guard_off"))) return;
    var UA = navigator.userAgent || "", SAFE = /Googlebot|bingbot|Lighthouse|Chrome-Lighthouse|PageSpeed|facebookexternalhit|WhatsApp|Twitterbot|Slurp|DuckDuckBot/i.test(UA);
    var auto = !!navigator.webdriver || /HeadlessChrome/i.test(UA);
    var embedded = window.top !== window, st = document.createElement("style"); st.id = "acg-css";
    (document.head || document.documentElement).appendChild(st);
    var css = function () {
      if (!cfg.on) { st.textContent = ""; return; }
      st.textContent = (cfg.img ? "img,video,canvas,svg{-webkit-user-drag:none;user-drag:none;-webkit-touch-callout:none}img{-webkit-user-select:none;user-select:none}" : "")
        + (cfg.sel ? "body{-webkit-user-select:none;user-select:none}input,textarea,select,[contenteditable=true]{-webkit-user-select:text;user-select:text}" : "")
        + (cfg.print ? "@media print{html,body{display:none!important}}" : "");
    };
    var block = function (msg) { if (document.getElementById("acg-ov")) return; var o = document.createElement("div"); o.id = "acg-ov"; o.setAttribute("style", "position:fixed;inset:0;z-index:2147483647;background:#07130d;color:#e2fe17;display:grid;place-items:center;font:700 1.1rem/1.8 Cairo,Tahoma,sans-serif;text-align:center;padding:24px"); o.textContent = msg; document.documentElement.appendChild(o); };
    var editable = function (t) { return t && t.closest && t.closest("input,textarea,select,[contenteditable=true]"); };
    var imgT = function (t) { return t && /^(IMG|VIDEO|CANVAS|SVG|PICTURE)$/i.test(t.tagName || ""); };
    var run = function () {
      css();
      if (!cfg.on) return;
      /* منع تضمين الموقع في مواقع أخرى (إطار من أصل مختلف) */
      if (cfg.frame && embedded) { var same = true; try { void window.top.location.href; } catch (e) { same = false; } if (!same) { try { window.top.location.replace(location.href); } catch (e) { } block("هذا الموقع لا يُعرض داخل مواقع أخرى — افتحه من رابطه الأصلي"); } }
      if (cfg.bots && auto && !SAFE) { block("الوصول الآلي غير مسموح"); return; }
      if (cfg.note && !window.__acgn) { window.__acgn = 1; try { console.log("%cتنبيه", "color:#e2fe17;background:#07130d;font:700 22px Cairo,sans-serif;padding:4px 10px", "\nنسخ هذا الموقع أو تصميمه أو صوره أو برمجياته أو استعمالها دون إذن مكتوب مخالف للقانون ويُلاحَق قضائياً."); } catch (e) { } }
    };
    /* الأحداث تقرأ الإعدادات لحظة وقوعها فيسري أي تغيير فور تحميل ملف الإعدادات */
    var live = function () { return cfg.on && !embedded && !(auto && SAFE); };
    document.addEventListener("contextmenu", function (e) { if (live() && cfg.rc && !editable(e.target)) e.preventDefault(); else if (live() && cfg.img && imgT(e.target)) e.preventDefault(); }, true);
    document.addEventListener("dragstart", function (e) { if (live() && cfg.img && imgT(e.target)) e.preventDefault(); }, true);
    document.addEventListener("copy", function (e) { if (live() && cfg.copy && !editable(e.target)) { e.preventDefault(); try { e.clipboardData.setData("text/plain", ""); } catch (x) { } } }, true);
    document.addEventListener("cut", function (e) { if (live() && cfg.copy && !editable(e.target)) e.preventDefault(); }, true);
    document.addEventListener("selectstart", function (e) { if (live() && cfg.sel && !editable(e.target)) e.preventDefault(); }, true);
    document.addEventListener("keydown", function (e) {
      if (!live()) return; var k = String(e.key || "").toLowerCase(), c = e.ctrlKey || e.metaKey;
      if (cfg.keys && (k === "f12" || (c && e.shiftKey && /^(i|j|c|k)$/.test(k)) || (c && e.altKey && /^(i|j|u|c)$/.test(k)) || (c && /^(u|s)$/.test(k) && !e.shiftKey))) { e.preventDefault(); e.stopPropagation(); }
      if (cfg.print && c && k === "p") { e.preventDefault(); e.stopPropagation(); }
      if (cfg.copy && c && /^(c|x|a)$/.test(k) && !editable(e.target)) { e.preventDefault(); }
    }, true);
    /* أدوات المطوّر (حاسوب فقط): ستار فوق الصفحة ما دامت مفتوحة، ويزول بإغلاقها */
    if (!embedded && !auto && !("ontouchstart" in window) && window.matchMedia && matchMedia("(hover:hover)").matches) {
      var open = false, probe = new Image();
      Object.defineProperty(probe, "id", { get: function () { open = true; return "x"; } });
      setInterval(function () {
        var ov = document.getElementById("acg-dv");
        if (!(cfg.on && cfg.dev)) { if (ov) ov.remove(); return; }
        open = false; try { console.log(probe); } catch (e) { } try { console.clear(); } catch (e) { }
        var w = (window.outerWidth - window.innerWidth) > 350;
        if (open || w) { if (!ov) { ov = document.createElement("div"); ov.id = "acg-dv"; ov.setAttribute("style", "position:fixed;inset:0;z-index:2147483647;background:#07130d;color:#e2fe17;display:grid;place-items:center;font:700 1.1rem/1.8 Cairo,Tahoma,sans-serif;text-align:center;padding:24px"); ov.textContent = "هذه الصفحة محميّة — أغلق أدوات المطوّر لمتابعة التصفح"; document.documentElement.appendChild(ov); } }
        else if (ov) ov.remove();
      }, 1000);
    }
    run();
    /* الإعدادات المنشورة + تعطيل الإضافة من قائمة الإضافات */
    var j = function (u) { return fetch(rel + u + (u.indexOf("?") < 0 ? "?t=" + Math.floor(Date.now() / 60000) : ""), { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    Promise.all([j("assets/data/protect.json"), j("assets/data/apps.json")]).then(function (a) {
      var c = a[0], apps = a[1];
      if (c && typeof c === "object") for (var k in DEF) if (typeof c[k] === "boolean") cfg[k] = c[k];
      if (apps && (apps.off || []).indexOf("protect") >= 0) cfg.on = false;
      run();
    });
    window.__acgCfg = cfg;
  } catch (e) { }
})();
