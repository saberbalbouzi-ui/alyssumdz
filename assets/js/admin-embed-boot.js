/* إقلاع اللوحة داخل Spatial (V4) — لا أثر إطلاقاً خارج Spatial (يخرج فوراً إن لم تكن الصفحة إطاراً داخل صفحة تحمل window.SpatialShare).
   1) مشاركة قراءات الخادم بين الألواح: يمرّر fetch إلى SpatialShare (قواعد العزل في admin-preview/spatial-os/share.js).
   2) تقطيع الإقلاع: مستمعو DOMContentLoaded/load كانوا يُنفَّذون كلهم في مهمة رئيسية واحدة (≈800ms تحت تخنيق 4×) فتجمّد الواجهة كلها؛
      نُجدولها كل واحد في مهمة مستقلة (MessageChannel) بالترتيب نفسه فيجد إدخال المستخدم والرسم فرصة بينها. الترتيب محفوظ وكل مستمع يُشغَّل مرة واحدة بالحدث نفسه.
   التعطيل للمقارنة: ‎?noslice=1‎ / ‎?noshare=1‎ في عنوان صفحة Spatial. */
(function () {
  "use strict";
  var S, P;
  try { P = window.parent; if (!P || P === window) return; S = P.SpatialShare; if (!S || S.v !== 1) return; } catch (_) { return; }
  var PQ = ""; try { PQ = P.location.search || ""; } catch (_) { }

  /* 1) مشاركة القراءات */
  try {
    var of = window.fetch;
    if (typeof of === "function" && typeof S.fetch === "function" && !/[?&]noshare=1/.test(PQ)) {
      window.fetch = function (input, init) {
        try { var r = S.fetch(function (i, n) { return of.call(window, i, n); }, input, init, window.Response, window.location.href); if (r) return r; } catch (_) { }
        return of.call(window, input, init);
      };
    }
  } catch (_) { }

  /* 2) تقطيع مستمعي DOMContentLoaded/load */
  if (/[?&]noslice=1/.test(PQ)) return;
  var info = window.__spBoot = { n: 0, maxMs: 0, totalMs: 0, done: false };
  var q = [], busy = false, ch;
  try { ch = new MessageChannel(); } catch (_) { return; }
  var wraps = new WeakMap();   /* مستمع أصلي ← غلافه (لإزالته لاحقاً) */
  function pump() {
    var t0 = performance.now();
    while (q.length) {
      var it = q.shift(), a = performance.now();
      try { it.fn.call(it.ctx, it.ev); } catch (e) { (function (er) { setTimeout(function () { throw er; }, 0); })(e); }
      var d = performance.now() - a; info.n++; info.totalMs += d; if (d > info.maxMs) info.maxMs = d;
      if (performance.now() - t0 > 12) break;   /* دفعة صغيرة تتّسع لمستمعين خفيفين؛ الثقيل يأخذ مهمته وحده */
    }
    if (q.length) ch.port2.postMessage(0); else { busy = false; if (document.readyState !== "loading") info.done = true; /* انتهت مستمعات DOMContentLoaded المُجدولة: المضيف ينتظر هذا قبل إعلان جاهزية اللوح */ }
  }
  ch.port1.onmessage = pump;
  function enqueue(fn, ctx, ev) { q.push({ fn: fn, ctx: ctx, ev: ev }); if (!busy) { busy = true; ch.port2.postMessage(0); } }
  function patch(target, type) {
    var add = target.addEventListener, rem = target.removeEventListener;
    target.addEventListener = function (t, fn, o) {
      if (t === type && typeof fn === "function" && document.readyState !== "complete") {
        var cap = (o === true || (o && o.capture)) ? "c" : "b", key = t + cap;
        if (t === "load" && cap === "c") return add.apply(this, arguments);   /* التقاط load لموارد الصفحة ليس حدث النافذة */
        var m = wraps.get(fn); if (!m) { m = {}; wraps.set(fn, m); }
        if (m[key]) return;   /* تكرار التسجيل بالمستمع نفسه يُتجاهل كما يفعل المتصفح */
        var w = function (ev) { enqueue(fn, this, ev); }; m[key] = w;
        return add.call(this, t, w, o);
      }
      return add.apply(this, arguments);
    };
    target.removeEventListener = function (t, fn, o) {
      if (t === type && typeof fn === "function") { var m = wraps.get(fn), cap = (o === true || (o && o.capture)) ? "c" : "b", w = m && m[t + cap]; if (w) { delete m[t + cap]; return rem.call(this, t, w, o); } }
      return rem.apply(this, arguments);
    };
  }
  try { patch(document, "DOMContentLoaded"); patch(window, "load"); } catch (_) { }
})();
