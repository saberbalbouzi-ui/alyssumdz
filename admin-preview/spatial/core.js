/* نواة ALYSSUM: مجسّم ثلاثي الأبعاد على Canvas 2D بإسقاط منظوري خفيف (بلا مكتبات)
   — بنية متداخلة (عشروني وجوه + ثماني وجوه) + حلقات مدارية بقطاعات حالات الطلبات + جسيمات تتدفق للنواة. */
(function (root) {
  "use strict";
  var TAU = Math.PI * 2, PHI = (1 + Math.sqrt(5)) / 2;

  function rotY(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  function rotX(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function rotZ(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }

  function icosa() {
    var v = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(function (p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }), e = [], m = 9, i, j;
    for (i = 0; i < v.length; i++) for (j = i + 1; j < v.length; j++) m = Math.min(m, Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]));
    for (i = 0; i < v.length; i++) for (j = i + 1; j < v.length; j++) if (Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) < m * 1.05) e.push([i, j]);
    return { v: v, e: e };
  }
  var OCT = { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], e: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]] };
  var ICO = icosa();

  function Core(canvas, opt) {
    opt = opt || {};
    this.cv = canvas; this.cx = canvas.getContext("2d");
    this.reduced = !!opt.reduced; this.onHover = opt.onHover || function () { }; this.onPick = opt.onPick || function () { };
    this.statuses = []; this.total = 0; this.t = 0; this.yaw = 0.6; this.pitch = -0.35; this.vyaw = 0; this.drag = null;
    this.tiltX = 0; this.tiltY = 0; this.tx = 0; this.ty = 0; this.shock = -1; this.hover = -1; this.nodes = []; this.running = false;
    this.parts = []; this.resize(); this.seedParts();
    var self = this;
    canvas.addEventListener("pointerdown", function (e) { self.drag = { x: e.clientX, y: e.clientY, yaw: self.yaw, pitch: self.pitch, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) { self.move(e); });
    canvas.addEventListener("pointerup", function (e) { if (self.drag && self.drag.moved < 5 && self.hover >= 0) self.onPick(self.hover); self.drag = null; });
    canvas.addEventListener("pointerleave", function () { self.drag = null; self.setHover(-1); });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(function () { self.resize(); self.frame(0); }).observe(canvas);
    document.addEventListener("visibilitychange", function () { document.hidden ? self.stop() : self.start(); });
  }
  Core.prototype.resize = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = this.cv.clientWidth || 600, h = this.cv.clientHeight || 600;
    this.W = w; this.H = h; this.dpr = dpr; this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  Core.prototype.seedParts = function () {
    var n = this.reduced ? 60 : 190, i, r = mulberry(9); this.parts = [];
    for (i = 0; i < n; i++) this.parts.push({ a: r() * TAU, rad: 0.3 + r() * 3.2, y: (r() - .5) * 1.6, sp: .25 + r() * .6, h: r() > .45 ? 0 : 1, px: 0, py: 0, ok: false });
  };
  function mulberry(seed) { var s = seed >>> 0; return function () { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  Core.prototype.setStatuses = function (list) { this.statuses = list; this.total = list.reduce(function (a, b) { return a + b.v; }, 0); };
  Core.prototype.pulse = function () { this.shock = 0; if (this.reduced) this.frame(0); };
  Core.prototype.setHover = function (i) { if (i === this.hover) return; this.hover = i; this.onHover(i); };
  Core.prototype.move = function (e) {
    var r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    this.tiltX = (x / r.width - .5) * 2; this.tiltY = (y / r.height - .5) * 2;
    if (this.drag) { var dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag.moved = Math.max(this.drag.moved, Math.abs(dx) + Math.abs(dy)); this.yaw = this.drag.yaw + dx * 0.006; this.pitch = Math.max(-1.2, Math.min(1.2, this.drag.pitch + dy * 0.005)); this.vyaw = 0; this.mouse = null; if (this.reduced) this.frame(0); return; }
    var best = -1, bd = 26 * 26, i, n;
    for (i = 0; i < this.nodes.length; i++) { n = this.nodes[i]; var d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y); if (d < bd) { bd = d; best = n.i; } }
    this.mouse = { x: x, y: y }; this.setHover(best);
    var tipPos = best >= 0 ? this.nodes.filter(function (q) { return q.i === best; })[0] : null; this.tipAt = tipPos ? { x: tipPos.x + r.left, y: tipPos.y + r.top } : null;
    if (this.onHover.move) this.onHover.move(best, this.tipAt);
  };

  Core.prototype.start = function () { if (this.running || this.reduced) return; this.running = true; var self = this, last = 0; (function loop(t) { if (!self.running) return; self.raf = requestAnimationFrame(loop); if (t - last < 28) return; var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t; self.frame(dt); })(0); };
  Core.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };

  /* إسقاط منظوري: وحدة العالم = نصف قطر النواة */
  Core.prototype.proj = function (p) {
    var q = rotX(rotY(p, this.yaw), this.pitch), cam = 6.2, f = cam / (cam + q[2] * 0.62), S = Math.min(this.W, this.H) * 0.158;
    return { x: this.W / 2 + q[0] * S * f, y: this.H / 2 * 1.02 + q[1] * S * f, z: q[2], f: f };
  };

  Core.prototype.frame = function (dt) {
    var cx = this.cx, W = this.W, H = this.H, self = this, i, j, p, a, b;
    if (!this.reduced) { this.t += dt; if (!this.drag) { this.yaw += (0.09 + this.vyaw) * dt; this.vyaw *= 0.96; } }
    var t = this.t;
    cx.clearRect(0, 0, W, H);
    cx.globalCompositeOperation = "lighter";
    var S = Math.min(W, H);
    /* حقل الطاقة: توهّج سماوي/ليموني خلف النواة + قاعدة ضوئية */
    var g = cx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, S * 0.48); g.addColorStop(0, "rgba(39,230,255,.34)"); g.addColorStop(.35, "rgba(25,180,170,.14)"); g.addColorStop(1, "rgba(0,0,0,0)"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    g = cx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, S * 0.17); g.addColorStop(0, "rgba(220,255,31,.55)"); g.addColorStop(1, "rgba(220,255,31,0)"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(W / 2, H * 0.9); cx.scale(1, .2); g = cx.createRadialGradient(0, 0, 0, 0, 0, S * .46); g.addColorStop(0, "rgba(220,255,31,.38)"); g.addColorStop(.5, "rgba(39,230,255,.16)"); g.addColorStop(1, "rgba(39,230,255,0)"); cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, S * .46, 0, TAU); cx.fill(); cx.restore();
    /* عمود ضوء رأسي (حجمي) */
    g = cx.createLinearGradient(0, H * .06, 0, H * .92); g.addColorStop(0, "rgba(39,230,255,0)"); g.addColorStop(.5, "rgba(39,230,255,.09)"); g.addColorStop(1, "rgba(220,255,31,.16)"); cx.fillStyle = g; cx.beginPath(); cx.moveTo(W / 2 - S * .035, H * .06); cx.lineTo(W / 2 + S * .035, H * .06); cx.lineTo(W / 2 + S * .13, H * .92); cx.lineTo(W / 2 - S * .13, H * .92); cx.fill();

    /* حلقات مدارية رفيعة */
    var rings = [{ r: 1.55, rx: 1.15, rz: .25, sp: .22, c: "39,230,255", a: .5 }, { r: 1.95, rx: .35, rz: -.5, sp: -.16, c: "220,255,31", a: .42 }, { r: 2.9, rx: 1.45, rz: .05, sp: .07, c: "165,139,255", a: .3 }];
    rings.forEach(function (R) { self.ring(R.r, R.rx, R.rz, t * R.sp, R.c, R.a); });

    /* جسيمات تتدفق نحو النواة */
    var dtp = this.reduced ? 0 : dt;
    for (i = 0; i < this.parts.length; i++) {
      p = this.parts[i];
      p.rad -= p.sp * dtp * 0.7; p.a += (0.9 / (p.rad + .4)) * dtp * .55; if (p.rad < .35) { p.rad = 3.1 + Math.random() * .4; p.y = (Math.random() - .5) * 1.6; p.a = Math.random() * TAU; }
      var wp = [Math.cos(p.a) * p.rad, p.y * Math.min(1, p.rad / 1.5), Math.sin(p.a) * p.rad], q = this.proj(wp), al = Math.max(0, Math.min(1, (p.rad - .3) / 1.2)) * (0.25 + .5 * (1 - (q.z + 3) / 6));
      cx.fillStyle = p.h ? "rgba(220,255,31," + al.toFixed(2) + ")" : "rgba(39,230,255," + al.toFixed(2) + ")";
      cx.beginPath(); cx.arc(q.x, q.y, (p.h ? 1.5 : 1.1) * q.f, 0, TAU); cx.fill();
      if (p.ok && Math.hypot(q.x - p.px, q.y - p.py) < 60) { cx.strokeStyle = cx.fillStyle; cx.lineWidth = .8; cx.beginPath(); cx.moveTo(p.px, p.py); cx.lineTo(q.x, q.y); cx.stroke(); }
      p.px = q.x; p.py = q.y; p.ok = true;
    }

    /* هيكل النواة: عشروني وجوه (خارجي) + ثماني وجوه (داخلي) يدوران بعكس بعضهما */
    this.mesh(ICO, 1.0, t * .35, t * .2, "39,230,255", .75, 1.1);
    this.mesh(ICO, 1.34, -t * .22, t * .12, "220,255,31", .32, .8);
    this.mesh(OCT, .52, -t * .6, t * .4, "220,255,31", .95, 1.2);

    /* الشعار: معيّن مضيء + ورقة (billboard) */
    this.emblem(t);

    /* الحلقة الخارجية: قطاعات حالات الطلبات */
    this.statusRing(t);

    /* موجة صدمة عند تغيير البيانات */
    if (this.shock >= 0) { this.shock += this.reduced ? 1 : dt * .9; var sk = this.shock, e = 1 - Math.pow(1 - Math.min(1, sk), 3); cx.strokeStyle = "rgba(220,255,31," + (.7 * (1 - sk)).toFixed(2) + ")"; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(W / 2, H / 2 * 1.02, S * .5 * e, S * .5 * e * Math.cos(this.pitch) * .9 + 4, 0, 0, TAU); cx.stroke(); if (sk >= 1) this.shock = -1; }
    cx.globalCompositeOperation = "source-over";
    /* أرقام العقد */
    this.nodeLabels();
  };

  Core.prototype.ring = function (r, rx, rz, ph, col, al) {
    var cx = this.cx, N = 120, i, pts = [], th, pt;
    for (i = 0; i <= N; i++) { th = i / N * TAU; pt = rotZ(rotX([r * Math.cos(th + ph), 0, r * Math.sin(th + ph)], rx), rz); pts.push(this.proj(pt)); }
    for (i = 0; i < N; i++) { var d = (pts[i].z + pts[i + 1].z) / 2, a = al * (0.25 + 0.75 * (1 - (d + r) / (2 * r))); cx.strokeStyle = "rgba(" + col + "," + a.toFixed(3) + ")"; cx.lineWidth = 1 + (d < 0 ? .8 : 0); cx.beginPath(); cx.moveTo(pts[i].x, pts[i].y); cx.lineTo(pts[i + 1].x, pts[i + 1].y); cx.stroke(); }
    /* علامات صغيرة على الحلقة */
    for (i = 0; i < 24; i++) { th = i / 24 * TAU; var q = this.proj(rotZ(rotX([r * Math.cos(th + ph), 0, r * Math.sin(th + ph)], rx), rz)); cx.fillStyle = "rgba(" + col + "," + (al * .9).toFixed(2) + ")"; cx.beginPath(); cx.arc(q.x, q.y, .9 * q.f, 0, TAU); cx.fill(); }
  };

  Core.prototype.mesh = function (m, s, ay, ax, col, al, lw) {
    var cx = this.cx, pts = m.v.map(function (v) { return rotX(rotY([v[0] * s, v[1] * s, v[2] * s], ay), ax); }), pr = [], i, self = this;
    for (i = 0; i < pts.length; i++) pr.push(this.proj(pts[i]));
    m.e.forEach(function (e) { var a = pr[e[0]], b = pr[e[1]], d = (pts[e[0]][2] + pts[e[1]][2]) / 2, k = al * (0.35 + 0.65 * (1 - (d + s) / (2 * s))); cx.strokeStyle = "rgba(" + col + "," + k.toFixed(3) + ")"; cx.lineWidth = lw; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); });
    for (i = 0; i < pr.length; i++) { var gk = al * (0.5 + 0.5 * (1 - (pts[i][2] + s) / (2 * s))); cx.fillStyle = "rgba(" + col + "," + gk.toFixed(2) + ")"; cx.beginPath(); cx.arc(pr[i].x, pr[i].y, 2.1 * pr[i].f, 0, TAU); cx.fill(); }
  };

  Core.prototype.emblem = function (t) {
    var cx = this.cx, W = this.W, H = this.H, S = Math.min(W, H), x = W / 2, y = H / 2 * 1.02, r = S * .058, pul = 1 + Math.sin(t * 2) * .04, i;
    var g = cx.createRadialGradient(x, y, 0, x, y, r * 2.6 * pul); g.addColorStop(0, "rgba(39,230,255,.42)"); g.addColorStop(.5, "rgba(39,230,255,.12)"); g.addColorStop(1, "rgba(39,230,255,0)");
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 2.6 * pul, 0, TAU); cx.fill();
    /* قرص زجاجي داكن يُبرز الشعار */
    cx.globalCompositeOperation = "source-over"; g = cx.createRadialGradient(x, y - r * .3, 0, x, y, r * 1.25); g.addColorStop(0, "rgba(10,70,66,.92)"); g.addColorStop(1, "rgba(2,16,22,.96)"); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 1.22, 0, TAU); cx.fill(); cx.globalCompositeOperation = "lighter";
    cx.strokeStyle = "rgba(220,255,31,.9)"; cx.lineWidth = 1.8; cx.beginPath(); cx.arc(x, y, r * 1.22, 0, TAU); cx.stroke();
    cx.save(); cx.translate(x, y); cx.rotate(t * .3); cx.strokeStyle = "rgba(39,230,255,.9)"; cx.lineWidth = 1.4; cx.beginPath(); for (i = 0; i < 6; i++) { var a = i / 6 * TAU, px = Math.cos(a) * r * 1.5, py = Math.sin(a) * r * 1.5; i ? cx.lineTo(px, py) : cx.moveTo(px, py); } cx.closePath(); cx.stroke();
    cx.rotate(-t * .55); cx.setLineDash([3, 7]); cx.strokeStyle = "rgba(220,255,31,.7)"; cx.beginPath(); cx.arc(0, 0, r * 1.75, 0, TAU); cx.stroke(); cx.setLineDash([]); cx.restore();
    /* الورقة: شعار ALYSSUM */
    cx.save(); cx.translate(x, y); cx.fillStyle = "rgba(220,255,31,.98)"; cx.shadowColor = "rgba(220,255,31,.95)"; cx.shadowBlur = 16;
    cx.beginPath(); cx.moveTo(0, r * .72); cx.bezierCurveTo(-r * .98, r * .2, -r * .62, -r * .78, 0, -r * .72); cx.bezierCurveTo(r * .62, -r * .78, r * .98, r * .2, 0, r * .72); cx.fill();
    cx.shadowBlur = 0; cx.strokeStyle = "rgba(2,26,22,.95)"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(0, r * .62); cx.lineTo(0, -r * .38); cx.moveTo(0, r * .1); cx.lineTo(r * .3, -r * .12); cx.moveTo(0, r * .24); cx.lineTo(-r * .3, 0); cx.stroke(); cx.restore();
  };

  /* قطاعات الحالات على حلقة مدارية كبيرة مائلة + عقد مضيئة تتفاعل مع المؤشر */
  Core.prototype.statusRing = function (t) {
    var cx = this.cx, R = 2.35, rx = 1.08, rz = -.12, ph = t * .06, tot = this.total || 1, a0 = 0, gap = .06, i, k, self = this;
    this.nodes = [];
    this.statuses.forEach(function (st, idx) {
      var span = st.v / tot * TAU, a1 = a0 + span, N = Math.max(2, Math.round(span / TAU * 90)), hot = self.hover === idx, pts = [];
      if (st.v > 0) {
        for (k = 0; k <= N; k++) { var th = a0 + gap / 2 + (span - gap) * k / N + ph; pts.push(self.proj(rotZ(rotX([R * Math.cos(th), 0, R * Math.sin(th)], rx), rz))); }
        for (k = 0; k < N; k++) { var d = (pts[k].z + pts[k + 1].z) / 2, al = (hot ? 1 : .8) * (0.45 + .55 * (1 - (d + R) / (2 * R))); cx.strokeStyle = "rgba(" + st.rgb + "," + al.toFixed(2) + ")"; cx.lineWidth = (hot ? 7 : 4.5) * (pts[k].f); cx.lineCap = "round"; cx.beginPath(); cx.moveTo(pts[k].x, pts[k].y); cx.lineTo(pts[k + 1].x, pts[k + 1].y); cx.stroke(); }
        var mid = a0 + span / 2 + ph, c = self.proj(rotZ(rotX([R * Math.cos(mid), 0, R * Math.sin(mid)], rx), rz)), rad = (hot ? 12 : 8) * c.f, gg = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rad * 2.4);
        gg.addColorStop(0, "rgba(255,255,255,.95)"); gg.addColorStop(.25, "rgba(" + st.rgb + ",.9)"); gg.addColorStop(1, "rgba(" + st.rgb + ",0)"); cx.fillStyle = gg; cx.beginPath(); cx.arc(c.x, c.y, rad * 2.4, 0, TAU); cx.fill();
        self.nodes.push({ i: idx, x: c.x, y: c.y, z: c.z, v: st.v, f: c.f });
      }
      a0 = a1;
    });
  };
  Core.prototype.nodeLabels = function () {
    var cx = this.cx, self = this; cx.font = "800 13px Cairo, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
    this.nodes.forEach(function (n) { cx.fillStyle = "rgba(3,16,20,.92)"; cx.fillText(String(n.v), n.x, n.y + .5); });
  };

  root.AlyCore = Core;
})(window);
