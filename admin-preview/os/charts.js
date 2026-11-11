/* مكوّنات Canvas لـ ALYSSUM OS: منحنى المبيعات الحجمي + وحدة الذكاء الصغيرة (بلا مكتبات) */
(function (root) {
  "use strict";
  var TAU = Math.PI * 2;
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function dprOf() { return Math.min(2, window.devicePixelRatio || 1); }

  /* ───────── منحنى المبيعات: سطوح مبثوقة بعمق (الحالية أمام، السابقة خلف، توقّع متقطّع) ───────── */
  function SalesChart(cv, opt) {
    opt = opt || {};
    this.cv = cv; this.cx = cv.getContext("2d"); this.reduced = !!opt.reduced;
    this.onHover = opt.onHover || function () { }; this.onPick = opt.onPick || function () { }; this.fmtAxis = opt.fmtAxis || function (v) { return String(Math.round(v)); };
    this.cur = []; this.prev = []; this.fc = []; this.labels = []; this.grow = 1; this.t = 0; this.hover = -1; this.focus = -1; this.hl = null; this.pts = []; this.running = false;
    this.resize(); var self = this;
    cv.addEventListener("pointermove", function (e) { self.move(e); });
    cv.addEventListener("pointerleave", function () { self.setHover(-1, null); });
    cv.addEventListener("click", function () { if (self.hover >= 0) self.onPick(self.hover); });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(function () { self.resize(); self.draw(); }).observe(cv);
    document.addEventListener("visibilitychange", function () { document.hidden ? self.stop() : self.start(); });
  }
  SalesChart.prototype.resize = function () { var d = dprOf(), w = this.cv.clientWidth || 600, h = this.cv.clientHeight || 260; this.W = w; this.H = h; this.cv.width = Math.round(w * d); this.cv.height = Math.round(h * d); this.cx.setTransform(d, 0, 0, d, 0, 0); };
  SalesChart.prototype.setData = function (o) { this.cur = o.cur; this.prev = o.prev || []; this.fc = o.fc || []; this.labels = o.labels || []; this.focus = o.focus == null ? -1 : o.focus; this.grow = this.reduced ? 1 : 0; this.draw(); };
  SalesChart.prototype.setFocus = function (i) { this.focus = i; this.draw(); };
  SalesChart.prototype.setHover = function (i, pos) { if (i !== this.hover) { this.hover = i; this.draw(); } this.onHover(i, pos); };
  SalesChart.prototype.move = function (e) {
    var r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, best = -1, bd = 1e9;
    this.pts.forEach(function (p, i) { var d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
    if (bd > 40) best = -1;
    this.setHover(best, best >= 0 ? { x: this.pts[best].x + r.left, y: this.pts[best].y + r.top } : null);
  };
  SalesChart.prototype.start = function () { if (this.running || this.reduced) return; this.running = true; var self = this, last = 0; (function loop(t) { if (!self.running) return; self.raf = requestAnimationFrame(loop); if (t - last < 32) return; var dt = Math.min(.06, (t - last) / 1000 || .016); last = t; self.t += dt; if (self.grow < 1) self.grow = Math.min(1, self.grow + dt * 1.3); self.draw(); })(0); };
  SalesChart.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };

  SalesChart.prototype.draw = function () {
    var cx = this.cx, W = this.W, H = this.H, n = this.cur.length; cx.clearRect(0, 0, W, H); if (!n) return;
    var L = 14, R = 62, T = 18, B = 34, pw = W - L - R, ph = H - T - B, base = T + ph, F = this.fc.length, S = n + F, g = ease(this.grow);
    var mx = Math.max.apply(null, this.cur.concat(this.prev, this.fc)) * 1.12 || 1, step = nice(mx / 4), top = step * 4;
    var DX = -12, DY = -10;                       /* متجه العمق */
    var xs = function (s) { return L + pw - (S === 1 ? pw / 2 : s / (S - 1) * pw); }, ys = function (v) { return base - v / top * ph * g; };
    cx.font = "600 12.5px Cairo, sans-serif"; cx.textBaseline = "middle"; cx.lineJoin = "round"; cx.lineCap = "round";
    /* أرضية بمنظور + شبكة */
    var fg = cx.createLinearGradient(0, base - 6, 0, base + 14); fg.addColorStop(0, "rgba(43,228,255,.16)"); fg.addColorStop(1, "rgba(43,228,255,0)");
    cx.fillStyle = fg; cx.beginPath(); cx.moveTo(L, base); cx.lineTo(L + pw, base); cx.lineTo(L + pw + DX * 2.2, base + DY * -1.4); cx.lineTo(L + DX * 2.2, base + DY * -1.4); cx.closePath(); cx.fill();
    for (var k = 0; k <= 4; k++) {
      var y = base - k * step / top * ph; cx.strokeStyle = "rgba(98,226,240," + (k ? .13 : .3) + ")"; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(L, y); cx.lineTo(L + pw, y); cx.stroke();
      cx.fillStyle = "rgba(226,244,240,.72)"; cx.textAlign = "start"; cx.direction = "ltr"; cx.fillText(this.fmtAxis(k * step), L + pw + 10, y);
    }
    cx.direction = "rtl"; cx.textAlign = "center";
    var self = this; this.labels.forEach(function (lb, i) { if (n > 9 && i % 2) return; cx.fillStyle = i === self.focus ? "#dcff1f" : "rgba(226,244,240,.75)"; cx.fillText(lb, xs(i), base + 20); });
    cx.direction = "ltr";
    /* السطح الخلفي: الفترة السابقة (بنفسجي) */
    if (this.prev.length) this.layer(this.prev, xs, ys, base, DX, DY, "165,139,255", .55, 2);
    /* السطح الأمامي: الفترة الحالية (ليموني/سماوي) مع عمق مبثوق */
    this.layer(this.cur, xs, ys, base, 0, 0, "220,255,31", 1, 7, true);
    /* التوقّع */
    if (F) {
      var p0 = [xs(n - 1), ys(this.cur[n - 1])], q = [p0].concat(this.fc.map(function (v, j) { return [xs(n + j), ys(v)]; }));
      cx.save(); cx.setLineDash([6, 6]); cx.lineDashOffset = -this.t * 18; cx.strokeStyle = "rgba(43,228,255,.95)"; cx.lineWidth = 2.2; cx.shadowColor = "rgba(43,228,255,.8)"; cx.shadowBlur = 8; cx.beginPath(); q.forEach(function (p, i) { i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }); cx.stroke(); cx.restore();
      var ag = cx.createLinearGradient(0, T, 0, base); ag.addColorStop(0, "rgba(43,228,255,.16)"); ag.addColorStop(1, "rgba(43,228,255,0)"); cx.fillStyle = ag; cx.beginPath(); q.forEach(function (p, i) { i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }); cx.lineTo(q[q.length - 1][0], base); cx.lineTo(q[0][0], base); cx.closePath(); cx.fill();
      q.slice(1).forEach(function (p) { cx.fillStyle = "rgba(43,228,255,.9)"; cx.beginPath(); cx.arc(p[0], p[1], 3.4, 0, TAU); cx.fill(); });
    }
    /* عقد الفترة الحالية */
    this.pts = [];
    for (var i = 0; i < n; i++) {
      var px = xs(i), py = ys(this.cur[i]), hot = i === this.hover, foc = i === this.focus; this.pts.push({ x: px, y: py });
      if (hot || foc) { var bg = cx.createLinearGradient(0, py, 0, base); bg.addColorStop(0, "rgba(220,255,31,.85)"); bg.addColorStop(1, "rgba(220,255,31,0)"); cx.strokeStyle = bg; cx.lineWidth = hot ? 2 : 1.4; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px, base); cx.stroke(); }
      var rad = hot ? 8 : foc ? 6.5 : 4.2, gg = cx.createRadialGradient(px, py, 0, px, py, rad * 2.6); gg.addColorStop(0, "rgba(255,255,255,1)"); gg.addColorStop(.3, "rgba(220,255,31,.95)"); gg.addColorStop(1, "rgba(220,255,31,0)");
      cx.fillStyle = gg; cx.beginPath(); cx.arc(px, py, rad * 2.6, 0, TAU); cx.fill();
      if (foc) { cx.strokeStyle = "#dcff1f"; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(px, py, 11, 0, TAU); cx.stroke(); }
    }
  };
  /* رسم سطح: منطقة مبثوقة بعمق ثم الحافة العليا */
  SalesChart.prototype.layer = function (vals, xs, ys, base, ox, oy, rgb, alpha, depth, glow) {
    var cx = this.cx, n = vals.length, pts = vals.map(function (v, i) { return [xs(i) + ox, ys(v) + oy]; }), d, k;
    var path = function (dx, dy) { cx.beginPath(); pts.forEach(function (p, i) { var x = p[0] + dx, y = p[1] + dy; if (!i) cx.moveTo(x, y); else { var q = pts[i - 1], mx = (q[0] + dx + x) / 2; cx.bezierCurveTo(mx, q[1] + dy, mx, y, x, y); } }); };
    for (k = depth; k >= 1; k--) {
      d = k / depth; path(-k * 1.5, -k * 1.1); cx.lineTo(pts[n - 1][0] - k * 1.5, base + oy - k * 1.1); cx.lineTo(pts[0][0] - k * 1.5, base + oy - k * 1.1); cx.closePath();
      cx.fillStyle = "rgba(" + rgb + "," + (.035 * alpha * (1 - d * .5)).toFixed(3) + ")"; cx.fill();
      cx.strokeStyle = "rgba(" + rgb + "," + (.2 * alpha * (1 - d)).toFixed(3) + ")"; cx.lineWidth = 1; path(-k * 1.5, -k * 1.1); cx.stroke();
    }
    path(0, 0); cx.lineTo(pts[n - 1][0], base + oy); cx.lineTo(pts[0][0], base + oy); cx.closePath();
    var gr = cx.createLinearGradient(0, 0, 0, base); gr.addColorStop(0, "rgba(" + rgb + "," + (.42 * alpha).toFixed(2) + ")"); gr.addColorStop(.7, "rgba(" + (glow ? "25,224,138" : rgb) + "," + (.12 * alpha).toFixed(2) + ")"); gr.addColorStop(1, "rgba(" + rgb + ",0)"); cx.fillStyle = gr; cx.fill();
    path(0, 0); cx.strokeStyle = "rgba(" + rgb + "," + (.95 * alpha).toFixed(2) + ")"; cx.lineWidth = glow ? 2.8 : 1.8; if (glow) { cx.shadowColor = "rgba(" + rgb + ",.85)"; cx.shadowBlur = 10; } cx.stroke(); cx.shadowBlur = 0;
  };
  function nice(x) { var p = Math.pow(10, Math.floor(Math.log10(x || 1))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }

  /* ───────── وحدة الذكاء الصغيرة: شبكة سداسية + مدارات + حلقة نشاط (موازن) ───────── */
  function AICore(cv, opt) {
    opt = opt || {};
    this.cv = cv; this.cx = cv.getContext("2d"); this.reduced = !!opt.reduced; this.mode = "idle"; this.load = .4; this.t = 0; this.running = false; this.size = opt.size || 158; this.resize();
    var self = this; document.addEventListener("visibilitychange", function () { document.hidden ? self.stop() : self.start(); });
  }
  AICore.prototype.resize = function () { var d = dprOf(), s = this.size; this.cv.width = s * d; this.cv.height = s * d; this.cx.setTransform(d, 0, 0, d, 0, 0); };
  AICore.prototype.setMode = function (m) { this.mode = m; };
  AICore.prototype.setLoad = function (v) { this.load = Math.max(.1, Math.min(1, v)); };
  AICore.prototype.start = function () { if (this.running || this.reduced) { if (this.reduced) this.draw(); return; } this.running = true; var self = this, last = 0; (function loop(t) { if (!self.running) return; self.raf = requestAnimationFrame(loop); if (t - last < 32) return; var dt = Math.min(.06, (t - last) / 1000 || .016); last = t; self.t += dt * (self.mode === "think" ? 2.4 : 1); self.draw(); })(0); };
  AICore.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };
  AICore.prototype.draw = function () {
    var cx = this.cx, s = this.size, c = s / 2, t = this.t, i, think = this.mode === "think";
    cx.clearRect(0, 0, s, s); cx.globalCompositeOperation = "lighter";
    var g = cx.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, "rgba(165,139,255,.32)"); g.addColorStop(.55, "rgba(43,228,255,.1)"); g.addColorStop(1, "rgba(0,0,0,0)"); cx.fillStyle = g; cx.fillRect(0, 0, s, s);
    /* حلقة النشاط: أعمدة بارتفاع يتغيّر بحسب الحمل */
    var N = 56; for (i = 0; i < N; i++) { var a = i / N * TAU - Math.PI / 2, amp = (.25 + .75 * Math.abs(Math.sin(i * .9 + t * (think ? 5 : 2) + Math.sin(i * .3) * 2))) * (.35 + this.load * .75), r0 = s * .335, r1 = r0 + s * .1 * amp; cx.strokeStyle = i % 7 === 0 ? "rgba(220,255,31,.95)" : "rgba(43,228,255," + (.35 + amp * .5).toFixed(2) + ")"; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); cx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); cx.stroke(); }
    /* سداسيات متداخلة */
    [[.27, 1, "165,139,255"], [.19, -1.4, "220,255,31"], [.11, 2, "43,228,255"]].forEach(function (h, k) { cx.save(); cx.translate(c, c); cx.rotate(t * .25 * h[1]); cx.strokeStyle = "rgba(" + h[2] + "," + (.55 + k * .12) + ")"; cx.lineWidth = 1.4; cx.beginPath(); for (var j = 0; j < 6; j++) { var a2 = j / 6 * TAU, x = Math.cos(a2) * s * h[0], y = Math.sin(a2) * s * h[0]; j ? cx.lineTo(x, y) : cx.moveTo(x, y); } cx.closePath(); cx.stroke(); cx.restore(); });
    /* نقاط مدارية */
    for (i = 0; i < 5; i++) { var rr = s * (.2 + i * .035), an = t * (.9 + i * .22) * (i % 2 ? -1 : 1) + i * 1.3, px = c + Math.cos(an) * rr, py = c + Math.sin(an) * rr * .92; var dg = cx.createRadialGradient(px, py, 0, px, py, 7); dg.addColorStop(0, "rgba(255,255,255,.95)"); dg.addColorStop(1, "rgba(165,139,255,0)"); cx.fillStyle = dg; cx.beginPath(); cx.arc(px, py, 7, 0, TAU); cx.fill(); }
    /* القلب: رمز A هندسي نابض */
    var pul = 1 + Math.sin(t * (think ? 7 : 2.4)) * (think ? .12 : .05), cg = cx.createRadialGradient(c, c, 0, c, c, s * .1 * pul); cg.addColorStop(0, "rgba(255,255,255,.95)"); cg.addColorStop(.4, "rgba(220,255,31,.75)"); cg.addColorStop(1, "rgba(220,255,31,0)"); cx.fillStyle = cg; cx.beginPath(); cx.arc(c, c, s * .1 * pul, 0, TAU); cx.fill();
    cx.globalCompositeOperation = "source-over"; cx.strokeStyle = "rgba(4,24,22,.95)"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(c - s * .035, c + s * .035); cx.lineTo(c, c - s * .04); cx.lineTo(c + s * .035, c + s * .035); cx.moveTo(c - s * .017, c + s * .012); cx.lineTo(c + s * .017, c + s * .012); cx.stroke();
  };

  root.OSCharts = { SalesChart: SalesChart, AICore: AICore };
})(window);
