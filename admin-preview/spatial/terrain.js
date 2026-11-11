/* سطح الطاقة: تضاريس سلكية بمنظور وعمق، صفّها الأمامي هو البيانات الحقيقية (عقد مضيئة قابلة للتحويم)،
   والصفوف الخلفية امتداد ناعم يعطي الإحساس بالعمق، وتدفّق طاقة يمرّ على السطح. Canvas 2D بلا مكتبات. */
(function (root) {
  "use strict";
  var TAU = Math.PI * 2;
  function Terrain(cv, opt) {
    opt = opt || {};
    this.cv = cv; this.cx = cv.getContext("2d"); this.reduced = !!opt.reduced; this.onHover = opt.onHover || function () { };
    this.vals = []; this.cur = []; this.labels = []; this.unit = ""; this.t = 0; this.hover = -1; this.nodes = []; this.sway = 0; this.mx = 0; this.running = false; this.fmt = function (v) { return String(v); };
    this.R = 18; this.C = 64; this.resize();
    var self = this;
    cv.addEventListener("pointermove", function (e) { self.move(e); });
    cv.addEventListener("pointerleave", function () { self.setHover(-1, null); });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(function () { self.resize(); self.frame(0); }).observe(cv);
    document.addEventListener("visibilitychange", function () { document.hidden ? self.stop() : self.start(); });
  }
  Terrain.prototype.resize = function () { var d = Math.min(2, window.devicePixelRatio || 1), w = this.cv.clientWidth || 800, h = this.cv.clientHeight || 300; this.W = w; this.H = h; this.cv.width = Math.round(w * d); this.cv.height = Math.round(h * d); this.cx.setTransform(d, 0, 0, d, 0, 0); };
  Terrain.prototype.setData = function (vals, labels, fmt) { var oldMx = this.mx; this.vals = vals.slice(); this.labels = labels; if (fmt) this.fmt = fmt; this.mx = Math.max.apply(null, vals) * 1.12 || 1; if (oldMx && this.cur.length) { var kk = this.mx / oldMx; this.cur = this.cur.map(function (x) { return x * kk; }); } if (this.cur.length !== vals.length) this.cur = vals.map(function () { return 0; }); this.grow = 0; if (this.reduced) { this.cur = vals.slice(); this.frame(0); } };
  Terrain.prototype.setHover = function (i, pos) { if (i !== this.hover) { this.hover = i; } this.onHover(i, pos); };
  Terrain.prototype.start = function () { if (this.running || this.reduced) return; this.running = true; var self = this, last = 0; (function loop(t) { if (!self.running) return; self.raf = requestAnimationFrame(loop); if (t - last < 30) return; var dt = Math.min(.05, (t - last) / 1000 || .016); last = t; self.frame(dt); })(0); };
  Terrain.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };

  /* قيمة مستوية على الصف الأمامي عند x∈[0,1] (كاتمول-روم) */
  Terrain.prototype.sample = function (u) {
    var v = this.cur, n = v.length; if (!n) return 0; if (n === 1) return v[0]; var f = u * (n - 1), i = Math.min(n - 2, Math.floor(f)), k = f - i, p0 = v[Math.max(0, i - 1)], p1 = v[i], p2 = v[i + 1], p3 = v[Math.min(n - 1, i + 2)];
    return Math.max(0, 0.5 * ((2 * p1) + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k * k + (-p0 + 3 * p1 - 3 * p2 + p3) * k * k * k));
  };
  function hash(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, z) { var xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); return hash(xi, zi) * (1 - u) * (1 - v) + hash(xi + 1, zi) * u * (1 - v) + hash(xi, zi + 1) * (1 - u) * v + hash(xi + 1, zi + 1) * u * v; }

  /* x∈[-1,1] (يمين=أقدم في RTL)، h∈[0,1]، z∈[0,1] عمق */
  Terrain.prototype.P = function (x, h, z) {
    var W = this.W, H = this.H, d = 1 + z * 1.75, hor = H * .2, front = H * .82, gy = hor + (front - hor) / d, sx = W / 2 + (x * W * .47 + this.sway * z * W * .06) / d;
    return { x: sx, y: gy - h * H * .66 / d, d: d };
  };
  Terrain.prototype.heightAt = function (c, r) {
    var u = c / (this.C - 1), z = r / (this.R - 1), base = this.sample(1 - u) / this.mx, fall = 1 - z * .62, n = (noise(c * .22, r * .45 + 3) - .5) * .22 * z + (noise(c * .6, r) - .5) * .05 * z;
    var rip = this.reduced ? 0 : Math.sin(c * .38 - this.t * 1.6 + r * .5) * .012;
    return Math.min(1.1, Math.max(0, base * fall + n * base + rip * base + (z > 0 ? .03 * z * Math.max(0, base) : 0)));
  };
  Terrain.prototype.move = function (e) {
    var r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; this.sway = (x / r.width - .5) * 2;
    var best = -1, bd = 34 * 34, i, n;
    for (i = 0; i < this.nodes.length; i++) { n = this.nodes[i]; var d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y); if (d < bd) { bd = d; best = i; } }
    this.setHover(best, best >= 0 ? { x: this.nodes[best].x + r.left, y: this.nodes[best].y + r.top } : null);
    if (this.reduced) this.frame(0);
  };

  Terrain.prototype.frame = function (dt) {
    var cx = this.cx, W = this.W, H = this.H, R = this.R, C = this.C, self = this, r, c, i;
    if (!this.reduced) { this.t += dt; this.grow = Math.min(1, (this.grow || 0) + dt * .9); }
    for (i = 0; i < this.cur.length; i++) this.cur[i] += (this.vals[i] - this.cur[i]) * (this.reduced ? 1 : Math.min(1, dt * 4.2));
    cx.clearRect(0, 0, W, H); cx.globalCompositeOperation = "lighter"; cx.lineCap = "round"; cx.lineJoin = "round";
    var grid = []; for (r = 0; r < R; r++) { grid[r] = []; for (c = 0; c < C; c++) { var x = (c / (C - 1)) * 2 - 1, h = this.heightAt(c, r); grid[r][c] = this.P(x, h, r / (R - 1)); grid[r][c].h = h; } }
    /* سطح مظلّل: شرائح مملوءة من الخلف للأمام */
    for (r = R - 2; r >= 0; r--) {
      var depth = r / (R - 1), baseA = .12 + (1 - depth) * .16;
      cx.beginPath(); for (c = 0; c < C; c++) { c ? cx.lineTo(grid[r][c].x, grid[r][c].y) : cx.moveTo(grid[r][c].x, grid[r][c].y); }
      for (c = C - 1; c >= 0; c--) cx.lineTo(grid[r + 1][c].x, grid[r + 1][c].y); cx.closePath();
      var gr = cx.createLinearGradient(0, H * .15, 0, H * .85); gr.addColorStop(0, "rgba(220,255,31," + (baseA * 1.6).toFixed(3) + ")"); gr.addColorStop(1, "rgba(39,230,255," + (baseA * .5).toFixed(3) + ")"); cx.fillStyle = gr; cx.fill();
    }
    /* خطوط الصفوف (عمق) بتلوين حسب الارتفاع + حركة طاقة */
    for (r = R - 1; r >= 0; r--) {
      var dep = r / (R - 1), alpha = (1 - dep * .78) * .85;
      for (c = 0; c < C - 1; c++) {
        var a = grid[r][c], b = grid[r][c + 1], hh = Math.min(1, (a.h + b.h) / 2 * 1.5), flow = this.reduced ? 0 : Math.max(0, Math.sin(c * .22 - this.t * 2.4 - r * .45)) , g = Math.round(255 * hh), cyc = Math.round(230 - 80 * hh);
        cx.strokeStyle = "rgba(" + Math.round(39 + 181 * hh) + "," + (cyc + 25) + "," + Math.round(255 - 224 * hh) + "," + Math.min(1, alpha * (.45 + .45 * hh + flow * .5)).toFixed(3) + ")";
        cx.lineWidth = (r === 0 ? 2.6 : 1) * (1 + flow * .6) / Math.sqrt(a.d); cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
      }
    }
    /* خطوط الأعمدة (كل رابع عمود) */
    for (c = 0; c < C; c += 2) {
      cx.strokeStyle = "rgba(39,230,255,.2)"; cx.lineWidth = .8; cx.beginPath(); for (r = 0; r < R; r++) { r ? cx.lineTo(grid[r][c].x, grid[r][c].y) : cx.moveTo(grid[r][c].x, grid[r][c].y); } cx.stroke();
    }
    /* عقد البيانات على الصف الأمامي + أعمدة ضوء + قيم */
    var n = this.vals.length; this.nodes = [];
    for (i = 0; i < n; i++) {
      var u = n === 1 ? .5 : i / (n - 1), xx = (1 - u) * 2 - 1, hv = this.sample(u) / this.mx, p = this.P(xx, hv, 0), hot = this.hover === i, base = this.P(xx, 0, 0);
      this.nodes.push({ x: p.x, y: p.y, i: i });
      var lg = cx.createLinearGradient(p.x, p.y, p.x, base.y); lg.addColorStop(0, "rgba(220,255,31," + (hot ? .9 : .5) + ")"); lg.addColorStop(1, "rgba(39,230,255,0)"); cx.strokeStyle = lg; cx.lineWidth = hot ? 2.4 : 1.2; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x, base.y); cx.stroke();
      var rad = hot ? 16 : 10, gg = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 2.2); gg.addColorStop(0, "rgba(255,255,255,1)"); gg.addColorStop(.2, "rgba(220,255,31,.95)"); gg.addColorStop(1, "rgba(220,255,31,0)"); cx.fillStyle = gg; cx.beginPath(); cx.arc(p.x, p.y, rad * 2.2, 0, TAU); cx.fill();
      if (hot) { cx.strokeStyle = "rgba(220,255,31,.8)"; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(p.x, p.y, 17 + Math.sin(this.t * 6) * 2, 0, TAU); cx.stroke(); }
    }
    /* جسيمات طاقة تسري على حافة السطح الأمامية */
    if (!this.reduced) for (i = 0; i < 6; i++) { var uu = ((this.t * .08 * (1 + i * .13) + i / 6) % 1), cc = Math.round(uu * (C - 1)), q = grid[0][cc]; if (!q) continue; var gl = cx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 14); gl.addColorStop(0, "rgba(255,255,255,.95)"); gl.addColorStop(1, "rgba(39,230,255,0)"); cx.fillStyle = gl; cx.beginPath(); cx.arc(q.x, q.y, 14, 0, TAU); cx.fill(); }
    cx.globalCompositeOperation = "source-over";
  };
  root.AlyTerrain = Terrain;
})(window);
