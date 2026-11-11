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
    var L = 18, R = 76, T = 38, B = 46, pw = W - L - R, ph = H - T - B, base = T + ph, F = this.fc.length, S = n + F, g = ease(this.grow);
    var mx = Math.max.apply(null, this.cur.concat(this.prev, this.fc)) * 1.12 || 1, step = nice(mx / 4), top = step * 4;
    var DX = -12, DY = -10;                       /* متجه العمق */
    var xs = function (s) { return L + pw - (S === 1 ? pw / 2 : s / (S - 1) * pw); }, ys = function (v) { return base - v / top * ph * g; };
    cx.font = "700 14px Cairo, sans-serif"; cx.textBaseline = "middle"; cx.lineJoin = "round"; cx.lineCap = "round";
    /* أرضية بمنظور + شبكة */
    var fg = cx.createLinearGradient(0, base - 6, 0, base + 14); fg.addColorStop(0, "rgba(43,228,255,.16)"); fg.addColorStop(1, "rgba(43,228,255,0)");
    cx.fillStyle = fg; cx.beginPath(); cx.moveTo(L, base); cx.lineTo(L + pw, base); cx.lineTo(L + pw + DX * 2.2, base + DY * -1.4); cx.lineTo(L + DX * 2.2, base + DY * -1.4); cx.closePath(); cx.fill();
    for (var k = 0; k <= 4; k++) {
      var y = base - k * step / top * ph; cx.strokeStyle = "rgba(98,226,240," + (k ? .13 : .3) + ")"; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(L, y); cx.lineTo(L + pw, y); cx.stroke();
      cx.fillStyle = "rgba(236,248,245,.92)"; cx.textAlign = "start"; cx.direction = "ltr"; cx.fillText(this.fmtAxis(k * step), L + pw + 12, y);
    }
    cx.direction = "rtl"; cx.textAlign = "center";
    var self = this; this.labels.forEach(function (lb, i) { if (n > 9 && i % 2) return; cx.fillStyle = i === self.focus ? "#dcff1f" : "rgba(236,248,245,.88)"; cx.fillText(lb, xs(i), base + 24); });
    cx.direction = "ltr";
    /* السطح الخلفي: الفترة السابقة (بنفسجي) */
    if (this.prev.length) this.layer(this.prev, xs, ys, base, DX, DY, "165,139,255", .55, 2);
    /* السطح الأمامي: الفترة الحالية (ليموني/سماوي) مع عمق مبثوق */
    this.layer(this.cur, xs, ys, base, 0, 0, "220,255,31", 1, 16, true);
    /* التوقّع */
    if (F) {
      var p0 = [xs(n - 1), ys(this.cur[n - 1])], q = [p0].concat(this.fc.map(function (v, j) { return [xs(n + j), ys(v)]; }));
      cx.save(); cx.setLineDash([6, 6]); cx.lineDashOffset = -this.t * 18; cx.strokeStyle = "rgba(43,228,255,.95)"; cx.lineWidth = 2.2; cx.shadowColor = "rgba(43,228,255,.8)"; cx.shadowBlur = 8; cx.beginPath(); q.forEach(function (p, i) { i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }); cx.stroke(); cx.restore();
      var ag = cx.createLinearGradient(0, T, 0, base); ag.addColorStop(0, "rgba(43,228,255,.16)"); ag.addColorStop(1, "rgba(43,228,255,0)"); cx.fillStyle = ag; cx.beginPath(); q.forEach(function (p, i) { i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }); cx.lineTo(q[q.length - 1][0], base); cx.lineTo(q[0][0], base); cx.closePath(); cx.fill();
      q.slice(1).forEach(function (p) { cx.fillStyle = "rgba(43,228,255,.9)"; cx.beginPath(); cx.arc(p[0], p[1], 3.4, 0, TAU); cx.fill(); });
    }
    /* شرارة طاقة تسري على المنحنى */
    if (!this.reduced && n > 1) { var u = (this.t * .11) % 1, f2 = u * (n - 1), i0 = Math.min(n - 2, Math.floor(f2)), kk = f2 - i0, sx = xs(i0) + (xs(i0 + 1) - xs(i0)) * kk, sy = ys(this.cur[i0]) + (ys(this.cur[i0 + 1]) - ys(this.cur[i0])) * kk, sg = cx.createRadialGradient(sx, sy, 0, sx, sy, 13); sg.addColorStop(0, "rgba(255,255,255,.95)"); sg.addColorStop(1, "rgba(43,228,255,0)"); cx.fillStyle = sg; cx.beginPath(); cx.arc(sx, sy, 13, 0, TAU); cx.fill(); }
    /* عقد الفترة الحالية */
    this.pts = [];
    var pk = this.cur.indexOf(Math.max.apply(null, this.cur));
    for (var i = 0; i < n; i++) {
      var px = xs(i), py = ys(this.cur[i]), hot = i === this.hover, foc = i === this.focus; this.pts.push({ x: px, y: py });
      if (hot || foc) { var bg = cx.createLinearGradient(0, py, 0, base); bg.addColorStop(0, "rgba(220,255,31,.85)"); bg.addColorStop(1, "rgba(220,255,31,0)"); cx.strokeStyle = bg; cx.lineWidth = hot ? 2 : 1.4; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px, base); cx.stroke(); }
      var rad = hot ? 8 : foc ? 6.5 : 4.2, gg = cx.createRadialGradient(px, py, 0, px, py, rad * 2.6); gg.addColorStop(0, "rgba(255,255,255,1)"); gg.addColorStop(.3, "rgba(220,255,31,.95)"); gg.addColorStop(1, "rgba(220,255,31,0)");
      cx.fillStyle = gg; cx.beginPath(); cx.arc(px, py, rad * 2.6, 0, TAU); cx.fill();
      if (foc) { cx.strokeStyle = "#dcff1f"; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(px, py, 11, 0, TAU); cx.stroke(); }
      if (i === pk) { cx.font = "800 15px Cairo, sans-serif"; cx.textAlign = "center"; cx.direction = "ltr"; var tx = this.fmtAxis(this.cur[i]), tw = cx.measureText(tx).width + 20; cx.fillStyle = "rgba(2,14,18,.88)"; cx.beginPath(); (cx.roundRect ? cx.roundRect(px - tw / 2, py - 40, tw, 24, 12) : cx.rect(px - tw / 2, py - 40, tw, 24)); cx.fill(); cx.strokeStyle = "rgba(220,255,31,.7)"; cx.lineWidth = 1.2; cx.stroke(); cx.fillStyle = "#dcff1f"; cx.fillText(tx, px, py - 27); cx.font = "700 14px Cairo, sans-serif"; cx.textAlign = "center"; }
      if (!this.reduced && (i === n - 1 || hot || foc)) { var ph = ((this.t * .9 + i * .3) % 1), pr = 8 + ph * 16; cx.strokeStyle = "rgba(220,255,31," + (.7 * (1 - ph)).toFixed(2) + ")"; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(px, py, pr, 0, TAU); cx.stroke(); }
    }
  };
  /* رسم سطح: منطقة مبثوقة بعمق ثم الحافة العليا */
  SalesChart.prototype.layer = function (vals, xs, ys, base, ox, oy, rgb, alpha, depth, glow) {
    var cx = this.cx, n = vals.length, pts = vals.map(function (v, i) { return [xs(i) + ox, ys(v) + oy]; }), d, k;
    var path = function (dx, dy) { cx.beginPath(); pts.forEach(function (p, i) { var x = p[0] + dx, y = p[1] + dy; if (!i) cx.moveTo(x, y); else { var q = pts[i - 1], mx = (q[0] + dx + x) / 2; cx.bezierCurveTo(mx, q[1] + dy, mx, y, x, y); } }); };
    for (k = depth; k >= 1; k--) {
      d = k / depth; path(-k * 1.7, -k * 1.2); cx.lineTo(pts[n - 1][0] - k * 1.7, base + oy - k * 1.2); cx.lineTo(pts[0][0] - k * 1.7, base + oy - k * 1.2); cx.closePath();
      cx.fillStyle = "rgba(" + rgb + "," + (.035 * alpha * (1 - d * .5)).toFixed(3) + ")"; cx.fill();
      cx.strokeStyle = "rgba(" + rgb + "," + (.26 * alpha * (1 - d)).toFixed(3) + ")"; cx.lineWidth = 1; path(-k * 1.7, -k * 1.2); cx.stroke();
    }
    if (glow) { /* ستارة عمودية تحت المنحنى: تعطي الإحساس بحجم السطح */
      cx.strokeStyle = "rgba(" + rgb + ",.1)"; cx.lineWidth = 1; var xa = pts[n - 1][0], xb = pts[0][0], gx; for (gx = xa; gx <= xb; gx += 11) { var f = 0, ii = 0; for (ii = 0; ii < n - 1; ii++) if (gx >= pts[n - 1 - ii - 1][0] && gx <= pts[n - 1 - ii][0]) { f = (gx - pts[n - 1 - ii - 1][0]) / ((pts[n - 1 - ii][0] - pts[n - 1 - ii - 1][0]) || 1); var y0 = pts[n - 1 - ii - 1][1], y1 = pts[n - 1 - ii][1], yy = y0 + (y1 - y0) * (1 - Math.cos(f * Math.PI)) / 2; cx.beginPath(); cx.moveTo(gx, yy); cx.lineTo(gx, base + oy); cx.stroke(); break; } }
    }
    path(0, 0); cx.lineTo(pts[n - 1][0], base + oy); cx.lineTo(pts[0][0], base + oy); cx.closePath();
    var gr = cx.createLinearGradient(0, 0, 0, base); gr.addColorStop(0, "rgba(" + rgb + "," + (.42 * alpha).toFixed(2) + ")"); gr.addColorStop(.7, "rgba(" + (glow ? "25,224,138" : rgb) + "," + (.12 * alpha).toFixed(2) + ")"); gr.addColorStop(1, "rgba(" + rgb + ",0)"); cx.fillStyle = gr; cx.fill();
    path(0, 0); cx.strokeStyle = "rgba(" + rgb + "," + (.95 * alpha).toFixed(2) + ")"; cx.lineWidth = glow ? 2.8 : 1.8; if (glow) { cx.shadowColor = "rgba(" + rgb + ",.85)"; cx.shadowBlur = 10; } cx.stroke(); cx.shadowBlur = 0;
  };
  function nice(x) { var p = Math.pow(10, Math.floor(Math.log10(x || 1))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }

  /* ───────── ALYSSUM Intelligence: عنصر مدمج بصري مميّز (مجسّم 20 وجهاً + حلقة نشاط + مدارات + دفقات) ───────── */
  var PHI = (1 + Math.sqrt(5)) / 2;
  function ico() { var v = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(function (p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }), e = [], m = 9, i, j; for (i = 0; i < 12; i++) for (j = i + 1; j < 12; j++) m = Math.min(m, Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2])); for (i = 0; i < 12; i++) for (j = i + 1; j < 12; j++) if (Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) < m * 1.05) e.push([i, j]); return { v: v, e: e }; }
  var ICO = ico();
  function rY(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  function rX(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function AICore(cv, opt) {
    opt = opt || {};
    this.cv = cv; this.cx = cv.getContext("2d"); this.reduced = !!opt.reduced; this.mode = "idle"; this.load = .4; this.t = 0; this.running = false; this.size = opt.size || 220; this.warn = false; this.parts = []; this.resize();
    var self = this; document.addEventListener("visibilitychange", function () { document.hidden ? self.stop() : self.start(); });
  }
  AICore.prototype.resize = function () { var d = dprOf(), s = this.size; this.cv.width = s * d; this.cv.height = s * d; this.cx.setTransform(d, 0, 0, d, 0, 0); };
  AICore.prototype.setMode = function (m) { this.mode = m; };
  AICore.prototype.setLoad = function (v) { this.load = Math.max(.1, Math.min(1, v)); };
  AICore.prototype.setWarn = function (w) { this.warn = !!w; };
  AICore.prototype.burst = function (n) { var i; n = n || 16; for (i = 0; i < n; i++) this.parts.push({ a: Math.random() * TAU, r: .52 + Math.random() * .1, v: .5 + Math.random() * .6, l: 1 }); if (this.reduced) this.draw(); };
  AICore.prototype.start = function () { if (this.running || this.reduced) { if (this.reduced) this.draw(); return; } this.running = true; var self = this, last = 0; (function loop(t) { if (!self.running) return; self.raf = requestAnimationFrame(loop); if (t - last < 32) return; var dt = Math.min(.06, (t - last) / 1000 || .016); last = t; self.t += dt * (self.mode === "think" ? 2.4 : 1); self.step(dt); self.draw(); })(0); };
  AICore.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };
  AICore.prototype.step = function (dt) { this.parts.forEach(function (p) { p.r -= p.v * dt * .55; p.l = Math.max(0, (p.r - .06) / .5); }); this.parts = this.parts.filter(function (p) { return p.r > .06; }); };
  AICore.prototype.draw = function () {
    var cx = this.cx, s = this.size, c = s / 2, t = this.t, i, think = this.mode === "think", self = this, tint = this.warn ? "255,179,64" : "220,255,31";
    cx.clearRect(0, 0, s, s); cx.globalCompositeOperation = "lighter";
    var g = cx.createRadialGradient(c, c, 0, c, c, c * .95); g.addColorStop(0, "rgba(165,139,255,.3)"); g.addColorStop(.5, "rgba(43,228,255,.09)"); g.addColorStop(1, "rgba(0,0,0,0)"); cx.fillStyle = g; cx.fillRect(0, 0, s, s);
    /* حلقة النشاط الحي (موازن) */
    var N = 64; for (i = 0; i < N; i++) { var a = i / N * TAU - Math.PI / 2, amp = (.22 + .78 * Math.abs(Math.sin(i * .83 + t * (think ? 5 : 1.8) + Math.sin(i * .31) * 2))) * (.3 + this.load * .8), r0 = s * .375, r1 = r0 + s * .075 * amp; cx.strokeStyle = i % 8 === 0 ? "rgba(" + tint + ",.95)" : "rgba(43,228,255," + (.3 + amp * .55).toFixed(2) + ")"; cx.lineWidth = 1.7; cx.beginPath(); cx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); cx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); cx.stroke(); }
    /* مدارات مائلة + عقد بيانات */
    [[.33, .38, -.5, .55, "165,139,255"], [.26, .3, .6, -.8, "43,228,255"]].forEach(function (o, k) {
      cx.save(); cx.translate(c, c); cx.rotate(o[2]); cx.strokeStyle = "rgba(" + o[4] + ",.55)"; cx.lineWidth = 1.3; cx.beginPath(); cx.ellipse(0, 0, s * o[0], s * o[1] * .42, 0, 0, TAU); cx.stroke();
      for (var q = 0; q < 2 + k; q++) { var an = t * o[3] + q * TAU / (2 + k), x = Math.cos(an) * s * o[0], y = Math.sin(an) * s * o[1] * .42, dg = cx.createRadialGradient(x, y, 0, x, y, 9); dg.addColorStop(0, "rgba(255,255,255,.95)"); dg.addColorStop(.3, "rgba(" + o[4] + ",.9)"); dg.addColorStop(1, "rgba(" + o[4] + ",0)"); cx.fillStyle = dg; cx.beginPath(); cx.arc(x, y, 9, 0, TAU); cx.fill(); }
      cx.restore();
    });
    /* المجسّم الأساسي: عشروني وجوه سلكي يدور */
    var R = s * .17, pts = ICO.v.map(function (v) { var p = rX(rY([v[0] * R, v[1] * R, v[2] * R], t * .55), .5 + Math.sin(t * .3) * .18); return p; });
    ICO.e.forEach(function (e) { var p = pts[e[0]], q = pts[e[1]], d = (p[2] + q[2]) / 2, k = .35 + .65 * (1 - (d + R) / (2 * R)); cx.strokeStyle = "rgba(43,228,255," + k.toFixed(2) + ")"; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(c + p[0], c + p[1]); cx.lineTo(c + q[0], c + q[1]); cx.stroke(); });
    pts.forEach(function (p) { var k = .5 + .5 * (1 - (p[2] + R) / (2 * R)); cx.fillStyle = "rgba(" + tint + "," + k.toFixed(2) + ")"; cx.beginPath(); cx.arc(c + p[0], c + p[1], 2.2, 0, TAU); cx.fill(); });
    var pul = 1 + Math.sin(t * (think ? 7 : 2.4)) * (think ? .14 : .06), cg = cx.createRadialGradient(c, c, 0, c, c, s * .085 * pul); cg.addColorStop(0, "rgba(255,255,255,.95)"); cg.addColorStop(.45, "rgba(" + tint + ",.7)"); cg.addColorStop(1, "rgba(" + tint + ",0)"); cx.fillStyle = cg; cx.beginPath(); cx.arc(c, c, s * .085 * pul, 0, TAU); cx.fill();
    /* دفقات: كل طلب/إجراء جديد يرسل جسيمات نحو القلب */
    this.parts.forEach(function (p) { var x = c + Math.cos(p.a) * p.r * s, y = c + Math.sin(p.a) * p.r * s, x2 = c + Math.cos(p.a) * (p.r + .06) * s, y2 = c + Math.sin(p.a) * (p.r + .06) * s; cx.strokeStyle = "rgba(" + tint + "," + (.25 + p.l * .7).toFixed(2) + ")"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x2, y2); cx.lineTo(x, y); cx.stroke(); cx.fillStyle = "rgba(255,255,255," + (.4 + p.l * .5).toFixed(2) + ")"; cx.beginPath(); cx.arc(x, y, 2, 0, TAU); cx.fill(); });
    cx.globalCompositeOperation = "source-over";
  };

  root.OSCharts = { SalesChart: SalesChart, AICore: AICore };
})(window);
