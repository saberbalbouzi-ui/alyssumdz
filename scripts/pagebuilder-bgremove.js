/* ═══ نزع الخلفية بزر واحد — بلا API ولا اشتراك ولا إعدادات ═══
   يعمل داخل المتصفح: SAM2 + كشف الأجسام إن توفّرا (نفس نماذج «التقاط العناصر»)، وإلا تحليل لوني كلاسيكي؛ ثم ماتينغ للشعر والحواف:
   ألفا من ألوان المقدّمة/الخلفية القريبة + Guided Filter + إزالة هالة الخلفية. يخرج PNG شفافاً يُحفظ استبدالاً للصورة أو نسخةً بجانبها. */
const PBBgRemove = (function () {
  const A = () => PBApp, LO = 360, PRE = 1100, OUTMAX = 2000;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, sig = x => 1 / (1 + Math.exp(-x)), tick = () => new Promise(r => setTimeout(r, 0));
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ───────── صور وقنوات ───────── */
  function scaledCanvas(src, w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d", { willReadFrequently: true }); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, w, h); return c; }
  function rgbOf(c) { const w = c.width, h = c.height, d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data, n = w * h, o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { o[i * 3] = d[i * 4] / 255; o[i * 3 + 1] = d[i * 4 + 1] / 255; o[i * 3 + 2] = d[i * 4 + 2] / 255; } return { w, h, rgb: o }; }
  function down2(rgb, w, h, ch) {      // تصغير بنصف بالمتوسط (ch = عدد القنوات)
    const nw = (w + 1) >> 1, nh = (h + 1) >> 1, o = new Float32Array(nw * nh * ch);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { const x0 = x * 2, y0 = y * 2, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1); for (let c = 0; c < ch; c++) o[(y * nw + x) * ch + c] = (rgb[(y0 * w + x0) * ch + c] + rgb[(y0 * w + x1) * ch + c] + rgb[(y1 * w + x0) * ch + c] + rgb[(y1 * w + x1) * ch + c]) / 4; }
    return { w: nw, h: nh, a: o };
  }
  function resizeF(u, w, h, nw, nh) {      // تكبير/تصغير ثنائي الخطية لقناة واحدة
    const o = new Float32Array(nw * nh), sx = w / nw, sy = h / nh;
    for (let y = 0; y < nh; y++) { const fy = clamp((y + .5) * sy - .5, 0, h - 1), y0 = fy | 0, y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < nw; x++) { const fx = clamp((x + .5) * sx - .5, 0, w - 1), x0 = fx | 0, x1 = Math.min(w - 1, x0 + 1), tx = fx - x0; o[y * nw + x] = (u[y0 * w + x0] * (1 - tx) + u[y0 * w + x1] * tx) * (1 - ty) + (u[y1 * w + x0] * (1 - tx) + u[y1 * w + x1] * tx) * ty; } }
    return o;
  }

  /* ───────── نموذج لوني GMM ───────── */
  function fitGMM(S, K, rnd) {
    const m = S.length / 3; if (m < 12) return null; K = Math.max(1, Math.min(K, (m / 12) | 0));
    const C = new Float32Array(K * 3), d2 = new Float32Array(m).fill(1e9), f0 = (rnd() * m) | 0; C[0] = S[f0 * 3]; C[1] = S[f0 * 3 + 1]; C[2] = S[f0 * 3 + 2];
    for (let k = 1; k < K; k++) { let tot = 0; for (let i = 0; i < m; i++) { const dx = S[i * 3] - C[(k - 1) * 3], dy = S[i * 3 + 1] - C[(k - 1) * 3 + 1], dz = S[i * 3 + 2] - C[(k - 1) * 3 + 2], d = dx * dx + dy * dy + dz * dz; if (d < d2[i]) d2[i] = d; tot += d2[i]; } let r = rnd() * tot, idx = m - 1; for (let i = 0; i < m; i++) { r -= d2[i]; if (r <= 0) { idx = i; break; } } C[k * 3] = S[idx * 3]; C[k * 3 + 1] = S[idx * 3 + 1]; C[k * 3 + 2] = S[idx * 3 + 2]; }
    const lab = new Int32Array(m);
    for (let it = 0; it < 10; it++) {
      for (let i = 0; i < m; i++) { let b = 0, bd = 1e9; for (let k = 0; k < K; k++) { const dx = S[i * 3] - C[k * 3], dy = S[i * 3 + 1] - C[k * 3 + 1], dz = S[i * 3 + 2] - C[k * 3 + 2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; b = k; } } lab[i] = b; }
      const sm = new Float32Array(K * 3), ct = new Float32Array(K); for (let i = 0; i < m; i++) { const k = lab[i]; sm[k * 3] += S[i * 3]; sm[k * 3 + 1] += S[i * 3 + 1]; sm[k * 3 + 2] += S[i * 3 + 2]; ct[k]++; }
      for (let k = 0; k < K; k++) if (ct[k]) { C[k * 3] = sm[k * 3] / ct[k]; C[k * 3 + 1] = sm[k * 3 + 1] / ct[k]; C[k * 3 + 2] = sm[k * 3 + 2] / ct[k]; }
    }
    const comps = [], reg = 1.6e-3;
    for (let k = 0; k < K; k++) { let ct = 0, mx = 0, my = 0, mz = 0; for (let i = 0; i < m; i++) if (lab[i] === k) { ct++; mx += S[i * 3]; my += S[i * 3 + 1]; mz += S[i * 3 + 2]; } if (ct < 6) continue; mx /= ct; my /= ct; mz /= ct;
      let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0; for (let i = 0; i < m; i++) if (lab[i] === k) { const x = S[i * 3] - mx, y = S[i * 3 + 1] - my, z = S[i * 3 + 2] - mz; a += x * x; b += x * y; c += x * z; d += y * y; e += y * z; f += z * z; }
      a = a / ct + reg; b /= ct; c /= ct; d = d / ct + reg; e /= ct; f = f / ct + reg; const det = a * (d * f - e * e) - b * (b * f - c * e) + c * (b * e - c * d); if (!(det > 1e-12)) continue;
      comps.push({ lw: Math.log(ct / m), mu: [mx, my, mz], i00: (d * f - e * e) / det, i01: (c * e - b * f) / det, i02: (b * e - c * d) / det, i11: (a * f - c * c) / det, i12: (b * c - a * e) / det, i22: (a * d - b * b) / det, ld: -.5 * Math.log(det) - 1.5 * Math.log(2 * Math.PI) }); }
    return comps.length ? comps : null;
  }
  function llOf(g, r, gg, b) { let mx = -1e9; const v = new Array(g.length); for (let k = 0; k < g.length; k++) { const c = g[k], x = r - c.mu[0], y = gg - c.mu[1], z = b - c.mu[2], q = c.i00 * x * x + c.i11 * y * y + c.i22 * z * z + 2 * (c.i01 * x * y + c.i02 * x * z + c.i12 * y * z); v[k] = c.lw + c.ld - .5 * q; if (v[k] > mx) mx = v[k]; } let s = 0; for (let k = 0; k < g.length; k++) s += Math.exp(v[k] - mx); return mx + Math.log(s); }
  let TEMP = .3;
  function posterior(F, B, rgb, n, out) { for (let i = 0; i < n; i++) { const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]; out[i] = sig(TEMP * clamp(llOf(F, r, g, b) - llOf(B, r, g, b), -14, 14)); } return out; }

  /* ───────── حلّال التنعيم على شبكة تراعي الحواف (تعدّد المستويات) ───────── */
  function level(rgb, w, h, P, seed, lam) {
    const n = w * h, wR = new Float32Array(n), wD = new Float32Array(n), wDR = new Float32Array(n), wDL = new Float32Array(n), dd = (i, j) => { const a = rgb[i * 3] - rgb[j * 3], b = rgb[i * 3 + 1] - rgb[j * 3 + 1], c = rgb[i * 3 + 2] - rgb[j * 3 + 2]; return a * a + b * b + c * c; };
    let sum = 0, cnt = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x < w - 1) { sum += dd(i, i + 1); cnt++; } if (y < h - 1) { sum += dd(i, i + w); cnt++; } }
    const beta = 1.5 / (2 * (sum / Math.max(1, cnt)) + 1e-6);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x < w - 1) wR[i] = Math.exp(-beta * dd(i, i + 1)); if (y < h - 1) { wD[i] = Math.exp(-beta * dd(i, i + w)); if (x < w - 1) wDR[i] = .7071 * Math.exp(-beta * dd(i, i + w + 1)); if (x > 0) wDL[i] = .7071 * Math.exp(-beta * dd(i, i + w - 1)); } }
    return { w, h, rgb, P, seed, wR, wD, wDR, wDL, lam };
  }
  function sweep(L, u, back) {
    const { w, h, wR, wD, wDR, wDL, P, seed, lam } = L;
    for (let yy = 0; yy < h; yy++) { const y = back ? h - 1 - yy : yy; for (let xx = 0; xx < w; xx++) { const x = back ? w - 1 - xx : xx, i = y * w + x, s = seed[i]; if (s === 1) { u[i] = 1; continue; } if (s === 2) { u[i] = 0; continue; }
      let ws = 0, sm = 0, v; if (x < w - 1) { v = wR[i]; ws += v; sm += v * u[i + 1]; } if (x > 0) { v = wR[i - 1]; ws += v; sm += v * u[i - 1]; }
      if (y < h - 1) { v = wD[i]; ws += v; sm += v * u[i + w]; if (x < w - 1) { v = wDR[i]; ws += v; sm += v * u[i + w + 1]; } if (x > 0) { v = wDL[i]; ws += v; sm += v * u[i + w - 1]; } }
      if (y > 0) { v = wD[i - w]; ws += v; sm += v * u[i - w]; if (x > 0) { v = wDR[i - w - 1]; ws += v; sm += v * u[i - w - 1]; } if (x < w - 1) { v = wDL[i - w + 1]; ws += v; sm += v * u[i - w + 1]; } }
      u[i] = (sm + lam * P[i]) / (ws + lam); } }
  }
  function seedDown(seed, w, h) { const nw = (w + 1) >> 1, nh = (h + 1) >> 1, o = new Uint8Array(nw * nh); for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { let f = 0, b = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const yy = Math.min(h - 1, y * 2 + dy), xx = Math.min(w - 1, x * 2 + dx), s = seed[yy * w + xx]; if (s === 1) f++; else if (s === 2) b++; } o[y * nw + x] = f > b ? 1 : b > f ? 2 : (f ? 2 : 0); } return o; }
  function solve(rgb, w, h, P, seed, lam) {
    const levels = []; let cur = { w, h, rgb, P, seed };
    while (true) { levels.push(level(cur.rgb, cur.w, cur.h, cur.P, cur.seed, lam)); if (Math.max(cur.w, cur.h) <= 44 || levels.length >= 6) break; const r = down2(cur.rgb, cur.w, cur.h, 3), p = down2(cur.P, cur.w, cur.h, 1); cur = { w: r.w, h: r.h, rgb: r.a, P: p.a, seed: seedDown(cur.seed, cur.w, cur.h) }; }
    let u = null;
    for (let li = levels.length - 1; li >= 0; li--) { const L = levels[li]; u = u ? resizeF(u, levels[li + 1].w, levels[li + 1].h, L.w, L.h) : Float32Array.from(L.P); const iters = li === levels.length - 1 ? 220 : li === 0 ? 40 : 60; for (let k = 0; k < iters; k++) sweep(L, u, k & 1); }
    return u;
  }

  /* ───────── التحليل الكامل (مصغّر) ───────── */
  function samplesOf(rgb, mask, n, cap, rnd) { const idx = []; for (let i = 0; i < n; i++) if (mask[i]) idx.push(i); const step = Math.max(1, idx.length / cap), out = new Float32Array(Math.min(idx.length, cap) * 3); let k = 0; for (let t = 0; t < idx.length && k < cap; t += step) { const i = idx[t | 0]; out[k * 3] = rgb[i * 3]; out[k * 3 + 1] = rgb[i * 3 + 1]; out[k * 3 + 2] = rgb[i * 3 + 2]; k++; } return out.subarray(0, k * 3); }
  async function segment(lo, seedsIn, opt) {
    const { w, h, rgb } = lo, n = w * h, rnd = rng(7), seeds = Uint8Array.from(seedsIn), rect = opt && opt.rect;
    let hasF = false, hasB = false; for (let i = 0; i < n; i++) { if (seeds[i] === 1) hasF = true; else if (seeds[i] === 2) hasB = true; }
    const ringW = Math.max(2, Math.round(Math.min(w, h) * .03)), inRect = (x, y) => !rect || (x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3]);
    const ring = new Uint8Array(n), core = new Uint8Array(n), bgS = new Uint8Array(n), fgS = new Uint8Array(n);
    const cx = rect ? (rect[0] + rect[2]) / 2 : w / 2, cy = rect ? (rect[1] + rect[3]) / 2 : h * .5, crx = rect ? (rect[2] - rect[0]) * .22 : w * .13, cry = rect ? (rect[3] - rect[1]) * .22 : h * .15;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, onRing = rect ? !inRect(x, y) : (x < ringW || y < ringW || x >= w - ringW || y >= h - ringW); ring[i] = onRing ? 1 : 0; const ex = (x - cx) / crx, ey = (y - cy) / cry; core[i] = ex * ex + ey * ey <= 1 ? 1 : 0; }
    // عيّنات الخلفية: الإطار (ما لم تُرسَم بذور خلفية) + بذور المستخدم
    for (let i = 0; i < n; i++) { if (seeds[i] === 2 || ring[i]) bgS[i] = 1; if (seeds[i] === 1) fgS[i] = 1; }
    let B = fitGMM(samplesOf(rgb, bgS, n, 5000, rnd), 5, rnd); if (!B) B = fitGMM(samplesOf(rgb, new Uint8Array(n).fill(1), n, 3000, rnd), 3, rnd);
    let F = hasF ? fitGMM(samplesOf(rgb, fgS, n, 5000, rnd), 5, rnd) : null; if (!B) return null;
    const P = new Float32Array(n), hard = new Uint8Array(n);
    // بذور صلبة تلقائية: إطار الصورة (الأقل غرابة عن نموذج الخلفية) خلفية، ونواة المركز مقدّمة
    const hasAuto = !hasF || !hasB; let ringTh = 1e9;
    { const v = []; for (let i = 0; i < n; i++) if (ring[i]) v.push(-llOf(B, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2])); v.sort((a, b) => a - b); ringTh = v.length ? v[Math.floor(v.length * .9)] : 1e9; }
    for (let it = 0; it < 3; it++) {
      hard.set(seeds);
      for (let i = 0; i < n; i++) if (!hard[i]) { if (rect && ring[i]) hard[i] = 2; else if (ring[i] && -llOf(B, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) <= ringTh) hard[i] = 2; else if (!hasF && core[i]) hard[i] = 1; }
      if (F) posterior(F, B, rgb, n, P); else P.fill(.5);
      const lamU = opt && opt.lam != null ? opt.lam : .01, u = solve(rgb, w, h, P, hard, lamU); await tick(); if (opt && opt.dbg) opt.dbg({ it, P: P.slice(), hard: hard.slice(), u: u.slice() });
      if (it === 2) return u;
      let th = .5; if (!hasF || it === 0) { const hist = new Float64Array(64); for (let i = 0; i < n; i++) hist[Math.min(63, (u[i] * 64) | 0)]++; let tot = n, sum = 0; for (let k = 0; k < 64; k++) sum += k * hist[k]; let wB = 0, sB = 0, best = -1; for (let k = 0; k < 64; k++) { wB += hist[k]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += k * hist[k]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = (k + 1) / 64; } } th = clamp(th, .3, .7); }
      const fm = new Uint8Array(n), bm = new Uint8Array(n); for (let i = 0; i < n; i++) { const v = u[i]; if (seeds[i] === 1 || (v > th + .08 && seeds[i] !== 2)) fm[i] = 1; if (seeds[i] === 2 || (v < th - .08 && seeds[i] !== 1) || (ring[i] && hard[i] === 2)) bm[i] = 1; }
      const F2 = fitGMM(samplesOf(rgb, fm, n, 6000, rnd), 5, rnd), B2 = fitGMM(samplesOf(rgb, bm, n, 6000, rnd), 5, rnd); if (F2) F = F2; if (B2) B = B2;
    }
  }
  /* تنظيف القناع: إزالة جزر صغيرة وسدّ ثقوب صغيرة (ما لم تحتوِ بذور) */
  function cleanMask(u, w, h, seeds) {
    const n = w * h, B = new Uint8Array(n); for (let i = 0; i < n; i++) B[i] = u[i] > .5 ? 1 : 0;
    const lab = new Int32Array(n).fill(-1), q = new Int32Array(n), comp = []; const flood = (val) => { for (let s = 0; s < n; s++) { if (B[s] !== val || lab[s] >= 0) continue; let hd = 0, tl = 0, a = 0, seedHit = false, border = false; q[tl++] = s; lab[s] = comp.length;
        while (hd < tl) { const p = q[hd++], x = p % w, y = (p / w) | 0; a++; if (seeds[p] === (val ? 1 : 2)) seedHit = true; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
          if (x > 0 && B[p - 1] === val && lab[p - 1] < 0) { lab[p - 1] = comp.length; q[tl++] = p - 1; } if (x < w - 1 && B[p + 1] === val && lab[p + 1] < 0) { lab[p + 1] = comp.length; q[tl++] = p + 1; } if (y > 0 && B[p - w] === val && lab[p - w] < 0) { lab[p - w] = comp.length; q[tl++] = p - w; } if (y < h - 1 && B[p + w] === val && lab[p + w] < 0) { lab[p + w] = comp.length; q[tl++] = p + w; } }
        comp.push({ val, a, seedHit, border }); } };
    flood(1); flood(0); const big = Math.max(0, ...comp.filter(c => c.val).map(c => c.a)), out = Float32Array.from(u);
    for (let i = 0; i < n; i++) { const c = comp[lab[i]]; if (!c) continue; if (c.val && !c.seedHit && c.a < Math.max(n * .0012, big * .02)) out[i] = 0; else if (!c.val && !c.seedHit && !c.border && c.a < n * .0025) out[i] = 1; }
    return out;
  }

  /* ───────── مرشّحات حواف ───────── */
  function boxMean(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), cs = new Float64Array(Math.max(w, h) + 1);
    for (let y = 0; y < h; y++) { cs[0] = 0; for (let x = 0; x < w; x++) cs[x + 1] = cs[x] + src[y * w + x]; for (let x = 0; x < w; x++) { const a = Math.max(0, x - r), b = Math.min(w - 1, x + r); tmp[y * w + x] = (cs[b + 1] - cs[a]) / (b - a + 1); } }
    for (let x = 0; x < w; x++) { cs[0] = 0; for (let y = 0; y < h; y++) cs[y + 1] = cs[y] + tmp[y * w + x]; for (let y = 0; y < h; y++) { const a = Math.max(0, y - r), b = Math.min(h - 1, y + r); out[y * w + x] = (cs[b + 1] - cs[a]) / (b - a + 1); } }
    return out;
  }
  function morph(B, w, h, r, erode) {      // تآكل/تمدّد بنافذة مربّعة (O(n))
    if (r <= 0) return B; const n = w * h, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = B[i]; const m = boxMean(f, w, h, r), out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = erode ? (m[i] > .9999 ? 1 : 0) : (m[i] > 1e-6 ? 1 : 0); return out;
  }
  /* Guided Filter سريع بدليل ملوّن: يعمل على نسخة مصغّرة بعامل s ثم يكبّر المعاملات */
  function guidedFast(I, w, h, p, r, eps, s) {
    s = Math.max(1, s | 0); const sw = Math.ceil(w / s), sh = Math.ceil(h / s), n = sw * sh, R = new Float32Array(n), G = new Float32Array(n), Bc = new Float32Array(n), Ps = new Float32Array(n);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let r0 = 0, g0 = 0, b0 = 0, p0 = 0, c = 0; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const yy = y * s + dy, xx = x * s + dx; if (yy >= h || xx >= w) continue; const i = yy * w + xx; r0 += I[i * 3]; g0 += I[i * 3 + 1]; b0 += I[i * 3 + 2]; p0 += p[i]; c++; } const j = y * sw + x; R[j] = r0 / c; G[j] = g0 / c; Bc[j] = b0 / c; Ps[j] = p0 / c; }
    const rr = Math.max(1, Math.round(r / s)), mr = boxMean(R, sw, sh, rr), mg = boxMean(G, sw, sh, rr), mb = boxMean(Bc, sw, sh, rr), mp = boxMean(Ps, sw, sh, rr), mult = (a, b) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = a[i] * b[i]; return o; };
    const cRp = boxMean(mult(R, Ps), sw, sh, rr), cGp = boxMean(mult(G, Ps), sw, sh, rr), cBp = boxMean(mult(Bc, Ps), sw, sh, rr), vRR = boxMean(mult(R, R), sw, sh, rr), vRG = boxMean(mult(R, G), sw, sh, rr), vRB = boxMean(mult(R, Bc), sw, sh, rr), vGG = boxMean(mult(G, G), sw, sh, rr), vGB = boxMean(mult(G, Bc), sw, sh, rr), vBB = boxMean(mult(Bc, Bc), sw, sh, rr);
    const a0 = new Float32Array(n), a1 = new Float32Array(n), a2 = new Float32Array(n), bb = new Float32Array(n);
    for (let i = 0; i < n; i++) { const rr_ = vRR[i] - mr[i] * mr[i] + eps, rg = vRG[i] - mr[i] * mg[i], rb = vRB[i] - mr[i] * mb[i], gg = vGG[i] - mg[i] * mg[i] + eps, gb = vGB[i] - mg[i] * mb[i], bb_ = vBB[i] - mb[i] * mb[i] + eps;
      const cr = cRp[i] - mr[i] * mp[i], cg = cGp[i] - mg[i] * mp[i], cb = cBp[i] - mb[i] * mp[i], det = rr_ * (gg * bb_ - gb * gb) - rg * (rg * bb_ - gb * rb) + rb * (rg * gb - gg * rb) || 1e-9;
      const i00 = (gg * bb_ - gb * gb) / det, i01 = (rb * gb - rg * bb_) / det, i02 = (rg * gb - rb * gg) / det, i11 = (rr_ * bb_ - rb * rb) / det, i12 = (rb * rg - rr_ * gb) / det, i22 = (rr_ * gg - rg * rg) / det;
      a0[i] = i00 * cr + i01 * cg + i02 * cb; a1[i] = i01 * cr + i11 * cg + i12 * cb; a2[i] = i02 * cr + i12 * cg + i22 * cb; bb[i] = mp[i] - a0[i] * mr[i] - a1[i] * mg[i] - a2[i] * mb[i]; }
    const m0 = boxMean(a0, sw, sh, rr), m1 = boxMean(a1, sw, sh, rr), m2 = boxMean(a2, sw, sh, rr), mB = boxMean(bb, sw, sh, rr), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { const fy = clamp((y + .5) / s - .5, 0, sh - 1), y0 = fy | 0, y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0; for (let x = 0; x < w; x++) { const fx = clamp((x + .5) / s - .5, 0, sw - 1), x0 = fx | 0, x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0, k00 = y0 * sw + x0, k01 = y0 * sw + x1, k10 = y1 * sw + x0, k11 = y1 * sw + x1, wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, wd = tx * ty, i = y * w + x;
      const A0 = m0[k00] * wa + m0[k01] * wb + m0[k10] * wc + m0[k11] * wd, A1 = m1[k00] * wa + m1[k01] * wb + m1[k10] * wc + m1[k11] * wd, A2 = m2[k00] * wa + m2[k01] * wb + m2[k10] * wc + m2[k11] * wd, Bq = mB[k00] * wa + mB[k01] * wb + mB[k10] * wc + mB[k11] * wd;
      out[i] = A0 * I[i * 3] + A1 * I[i * 3 + 1] + A2 * I[i * 3 + 2] + Bq; } }
    return out;
  }
  /* يملأ بكسلات «مسموحة» بلون أقرب مصدر (BFS) — لتقدير لون المقدّمة/الخلفية القريب من الحافة */
  function fillNearest(rgb, w, h, src, allow, maxD) {
    const n = w * h, col = new Float32Array(n * 3), dist = new Uint8Array(n).fill(255), q = new Int32Array(n); let hd = 0, tl = 0;
    for (let i = 0; i < n; i++) if (src[i]) { const x = i % w, y = (i / w) | 0; if ((x > 0 && allow[i - 1]) || (x < w - 1 && allow[i + 1]) || (y > 0 && allow[i - w]) || (y < h - 1 && allow[i + w])) { dist[i] = 0; col[i * 3] = rgb[i * 3]; col[i * 3 + 1] = rgb[i * 3 + 1]; col[i * 3 + 2] = rgb[i * 3 + 2]; q[tl++] = i; } }
    while (hd < tl) { const p = q[hd++], d = dist[p]; if (d >= maxD) continue; const x = p % w, y = (p / w) | 0, nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (let k = 0; k < 4; k++) { const j = nb[k]; if (j < 0 || !allow[j] || dist[j] !== 255) continue; dist[j] = d + 1; col[j * 3] = col[p * 3]; col[j * 3 + 1] = col[p * 3 + 1]; col[j * 3 + 2] = col[p * 3 + 2]; q[tl++] = j; } }
    return { col, dist };
  }

  /* ───────── الألفا النهائي بدقّة الصورة ───────── */
  /* u: قناع التحليل المصغّر (0..1). opt: shift (px)، detail (0.5..3)، feather، decon */
  function matte(rgbObj, u, uw, uh, opt) { return matteCore(rgbObj, resizeF(u, uw, uh, rgbObj.w, rgbObj.h), opt); }
  /* النواة: M = قناع ناعم بدقّة الصورة نفسها (0..1؛ 0.5 = الحدّ). تُستعمل أيضاً في «التقاط العناصر» لحواف الشعر والعناصر */
  function matteCore(rgbObj, M, opt) {
    const { w, h, rgb } = rgbObj, n = w * h, K = Math.max(w, h) / 1000;
    let B = new Uint8Array(n); for (let i = 0; i < n; i++) B[i] = M[i] > .5 ? 1 : 0;
    const sh = Math.round((opt.shift || 0) * K); if (sh > 0) B = morph(B, w, h, sh, true); else if (sh < 0) B = morph(B, w, h, -sh, false);
    const e = opt.band ? Math.max(2, Math.round(opt.band)) : Math.max(2, Math.round(2.6 * K * (opt.detail || 1))), inner = morph(B, w, h, e, true), outer = morph(B, w, h, e, false), band = new Uint8Array(n), bgSure = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (inner[i]) { band[i] = 0; } else if (outer[i]) band[i] = 1; else bgSure[i] = 1; }
    const alpha = new Float32Array(n), Bf = new Float32Array(n); for (let i = 0; i < n; i++) Bf[i] = B[i];
    const gf = guidedFast(rgb, w, h, Bf, Math.max(3, Math.round(e * 1.4)), 4e-4, Math.max(1, Math.round(Math.max(w, h) / 650)));
    const smoothFill = fc => {      // تنعيم حقل اللون بتطبيع الأوزان (الملء بأقرب مصدر يعطي كتلاً مربّعة عند الشريط العريض)
      const w1 = new Float32Array(n), ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)]; for (let i = 0; i < n; i++) if (fc.dist[i] !== 255) { w1[i] = 1; ch[0][i] = fc.col[i * 3]; ch[1][i] = fc.col[i * 3 + 1]; ch[2][i] = fc.col[i * 3 + 2]; }
      const r = Math.max(2, Math.round(e * .8)), bw = boxMean(w1, w, h, r), bc = ch.map(c => boxMean(c, w, h, r)); for (let i = 0; i < n; i++) if (fc.dist[i] !== 255 && bw[i] > 1e-4) { fc.col[i * 3] = bc[0][i] / bw[i]; fc.col[i * 3 + 1] = bc[1][i] / bw[i]; fc.col[i * 3 + 2] = bc[2][i] / bw[i]; } return fc; };
    const Fc = smoothFill(fillNearest(rgb, w, h, inner, band, e * 3 + 4)), Bc = smoothFill(fillNearest(rgb, w, h, bgSure, band, e * 3 + 4));
    for (let i = 0; i < n; i++) {
      if (inner[i]) { alpha[i] = 1; continue; } if (bgSure[i]) { alpha[i] = 0; continue; }
      const ag = clamp((gf[i] - .5) * 1.8 + .5, 0, 1); let a = ag;
      if (Fc.dist[i] !== 255 && Bc.dist[i] !== 255) { const vx = Fc.col[i * 3] - Bc.col[i * 3], vy = Fc.col[i * 3 + 1] - Bc.col[i * 3 + 1], vz = Fc.col[i * 3 + 2] - Bc.col[i * 3 + 2], dd = vx * vx + vy * vy + vz * vz;
        if (dd > 1e-4) { const ap = clamp(((rgb[i * 3] - Bc.col[i * 3]) * vx + (rgb[i * 3 + 1] - Bc.col[i * 3 + 1]) * vy + (rgb[i * 3 + 2] - Bc.col[i * 3 + 2]) * vz) / dd, 0, 1), conf = clamp((Math.sqrt(dd) - .12) / .28, 0, 1) * .85; a = conf * ap + (1 - conf) * ag; } }
      alpha[i] = a; }
    let al = alpha;
    if ((opt.detail || 1) > 0) { const sm = guidedFast(rgb, w, h, alpha, Math.max(2, Math.round(e * .6)), 2.5e-4, Math.max(1, Math.round(Math.max(w, h) / 900))); al = new Float32Array(n); for (let i = 0; i < n; i++) al[i] = (inner[i] || bgSure[i]) ? alpha[i] : clamp(sm[i] * .7 + alpha[i] * .3, 0, 1); }
    const fe = Math.round((opt.feather || 0) * K); if (fe > 0) { const f2 = boxMean(boxMean(al, w, h, fe), w, h, Math.max(1, fe >> 1)); al = f2; }
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) { const a = al[i]; let r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
      if (opt.decon !== false && a < .985 && !inner[i] && Fc.dist[i] !== 255) { r = Fc.col[i * 3]; g = Fc.col[i * 3 + 1]; b = Fc.col[i * 3 + 2]; }
      out[i * 4] = r * 255; out[i * 4 + 1] = g * 255; out[i * 4 + 2] = b * 255; out[i * 4 + 3] = a < .004 ? 0 : a * 255; }
    return { w, h, data: out, alpha: al, inner };
  }

  /* ───────── نزع الخلفية بزر واحد (بلا إعدادات) ─────────
     الطريقة ١ «ai»: SAM2 + كشف الأجسام (نفس نماذج «التقاط العناصر» داخل المتصفح، بلا API) ← اختيار الموضوع الرئيسي تلقائياً ← ماتينغ للشعر والحواف.
     الطريقة ٢ «pts»: نقطة في مركز الصورة (موجبة) ونقاط على أطرافها (سالبة) لقناع SAM حين لا يجد الكشف شيئاً.
     الطريقة ٣ «classic»: تحليل لوني كلاسيكي (GMM من حواف الصورة) — تعمل دائماً حتى بلا نماذج.
     يُتحقَّق من النتيجة (نسبة التغطية)، وإن فشلت طريقة تُجرَّب التي بعدها؛ وزرّ «طريقة أخرى» يبدّل يدوياً. */
  const LITE = () => { try { return matchMedia("(pointer: coarse)").matches || innerWidth <= 820 || (navigator.deviceMemory || 8) <= 4; } catch (e) { return false; } };
  const capC = (c, max) => { const m = Math.max(c.width, c.height); if (m <= max) return c; const r = max / m, o = document.createElement("canvas"); o.width = Math.round(c.width * r); o.height = Math.round(c.height * r); o.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0, o.width, o.height); return o; };
  const aiOK = () => { try { return typeof AIVision !== "undefined" && AIVision.supported(); } catch (e) { return false; } };
  const coverage = c => { const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++; return n / (c.width * c.height); };
  /* خلفية الاستوديو (بيضاء/متدرّجة/متوهّجة): الخلفية = المنطقة المتصلة بحافة الصورة بتدرّج لوني ناعم؛ تتوقف عند حافة المنتج.
     تُرجع {u, ring} (u=1 مقدّمة) أو null إن لم تكن الصورة بخلفية متجانسة من الحافة. */
  function floodBg(rgb, w, h) {
    const n = w * h, ringW = Math.max(2, Math.round(Math.min(w, h) * .02)), isRing = (x, y) => x < ringW || y < ringW || x >= w - ringW || y >= h - ringW, med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
    const ch = [[], [], []], st = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isRing(x, y)) { const i = y * w + x; for (let c = 0; c < 3; c++) ch[c].push(rgb[i * 3 + c]); if (x + 1 < w) { const j = i + 1; st.push(Math.abs(rgb[i * 3] - rgb[j * 3]) + Math.abs(rgb[i * 3 + 1] - rgb[j * 3 + 1]) + Math.abs(rgb[i * 3 + 2] - rgb[j * 3 + 2])); } }
    const mu = ch.map(c => med(c.slice())), tStep = clamp(3.2 * med(st) + .022, .024, .09), dist = i => Math.abs(rgb[i * 3] - mu[0]) + Math.abs(rgb[i * 3 + 1] - mu[1]) + Math.abs(rgb[i * 3 + 2] - mu[2]);
    const bg = new Uint8Array(n), q = new Int32Array(n); let hd = 0, tl = 0, seeded = 0, ringN = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isRing(x, y)) { ringN++; const i = y * w + x; if (dist(i) < .6) { bg[i] = 1; q[tl++] = i; seeded++; } }
    { let uni = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isRing(x, y) && dist(y * w + x) < .35) uni++; if (uni < ringN * .58) return null; }      // يُشترط تجانس الحافة (استوديو)؛ الصور المزدحمة تذهب للتحليل اللوني
    if (seeded < ringN * .45) return null;      // الحافة ليست خلفية متجانسة (الجسم يلامسها أو صورة مزدحمة)
    const grow = (i, j) => { if (bg[j]) return; const d = Math.abs(rgb[i * 3] - rgb[j * 3]) + Math.abs(rgb[i * 3 + 1] - rgb[j * 3 + 1]) + Math.abs(rgb[i * 3 + 2] - rgb[j * 3 + 2]); if (d < tStep && dist(j) < 1.05) { bg[j] = 1; q[tl++] = j; } };
    while (hd < tl) { const p = q[hd++], x = p % w, y = (p / w) | 0; if (x > 0) grow(p, p - 1); if (x < w - 1) grow(p, p + 1); if (y > 0) grow(p, p - w); if (y < h - 1) grow(p, p + w); }
    const u = new Float32Array(n); let fg = 0; for (let i = 0; i < n; i++) if (!bg[i]) { u[i] = 1; fg++; } const f = fg / n; if (f < .02 || f > .93) return null; return u;
  }
  async function classicCut(srcC, o) {
    const lite = LITE(), k = Math.min(1, (lite ? 1400 : OUTMAX) / Math.max(srcC.width, srcC.height)), FW = Math.round(srcC.width * k), FH = Math.round(srcC.height * k), kl = Math.min(1, LO / Math.max(FW, FH)), LW = Math.max(8, Math.round(FW * kl)), LH = Math.max(8, Math.round(FH * kl));
    const fullC = scaledCanvas(srcC, FW, FH), loC = scaledCanvas(fullC, LW, LH), loO = rgbOf(loC), seeds = new Uint8Array(LW * LH);
    { const d = loC.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, LW, LH).data; let t = 0; for (let i = 0; i < LW * LH; i++) { const al = d[i * 4 + 3]; if (al < 40) { seeds[i] = 2; t++; } else if (al > 215) seeds[i] = 1; } if (t < LW * LH * .01) seeds.fill(0); }      // صورة شفافة أصلاً: الشفاف خلفية والمعتم مقدّمة
    o.onStep && o.onStep("⏳ تحليل الألوان…"); await tick();
    let u = seeds.some(v => v) || o.noFlood ? null : floodBg(loO.rgb, LW, LH); if (u) o.onStep && o.onStep("⏳ خلفية استوديو: فصلها عن الحواف…");
    if (!u) u = await segment(loO, seeds, {}); if (!u) throw new Error("تعذّر تحليل ألوان الصورة"); const U = cleanMask(u, LW, LH, seeds);
    o.onStep && o.onStep("⏳ حواف دقيقة…"); await tick();
    const r = matte(rgbOf(fullC), U, LW, LH, { shift: 0, detail: 1, feather: 0, decon: true }), c = document.createElement("canvas"); c.width = FW; c.height = FH;
    for (let i = 0; i < FW * FH; i++) { const a = clamp(r.alpha[i], 0, 1) * 255; r.data[i * 4 + 3] = a < 2 ? 0 : a; } c.getContext("2d").putImageData(new ImageData(r.data, FW, FH), 0, 0); return c;
  }
  /* الموضوع الرئيسي بين العناصر المكتشفة: الأكبر والأقرب للمركز، وما يحتويه مركز الصورة له أفضلية */
  function pickMain(S, items) {
    const W = S.W, H = S.H, cx = W / 2, cy = H / 2, dg = Math.hypot(W, H) / 2; let best = null, bs = 0;
    items.forEach(it => { if (!it.lo || it.holder) return; const ic = (it.x0 + it.x1) / 2, jc = (it.y0 + it.y1) / 2, cen = 1 - Math.min(1, Math.hypot(ic - cx, jc - cy) / dg), lx = Math.max(0, Math.min(it.lw - 1, Math.floor(cx * S.fx))), ly = Math.max(0, Math.min(it.lh - 1, Math.floor(cy * S.fy))), hit = it.lo[ly * it.lw + lx] > 0 ? 1.6 : 1;
      const s = (it.area || 0) * (.3 + .7 * cen) * hit * (it.det || 1); if (s > bs) { bs = s; best = it; } });
    if (!best) return null; const bb = (best.x1 - best.x0) * (best.y1 - best.y0) / (W * H), lx = Math.max(0, Math.min(best.lw - 1, Math.floor(cx * S.fx))), ly = Math.max(0, Math.min(best.lh - 1, Math.floor(cy * S.fy)));
    return bb >= .12 || best.lo[ly * best.lw + lx] > 0 ? best : null;      // عنصر صغير بعيد عن المركز ليس الموضوع
  }
  /* مجموعة الموضوع: الأشخاص كلهم (أو الموضوع الرئيسي) + ما يحملونه + الأشياء الملاصقة لهم؛ أثاث الغرفة/ديكورها لا يدخل */
  const BGLBL = /^(إبريق|مزهرية|ساعة|لوحة|نافذة|ستارة|وسادة|أريكة|كرسي|طاولة|مصباح|نبتة|تلفاز|مرآة)/, PERS = /^(شخص|رجل|امرأة|إمرأة|سيدة|طفل|طفلة|ولد|بنت|فتاة|شاب|أم|أب)/;
  function pickGroup(S, items, tbl) {
    const main = pickMain(S, items); if (!main) return null; const px = S.W * S.H, bA = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]), bI = (a, c) => bA([Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.min(a[2], c[2]), Math.min(a[3], c[3])]);
    const bx = i => [i.x0, i.y0, i.x1, i.y1], persons = items.filter(i => PERS.test(i.label) && !i.holder); let seeds;
    if (PERS.test(main.label)) { const mx = Math.max(...persons.map(p => p.area)); seeds = persons.filter(p => p.area >= .12 * mx); } else { seeds = [main]; if (main.holder && !seeds.includes(main.holder)) seeds.push(main.holder); }
    if (tbl) seeds.push(tbl); const grp = new Set(seeds); let grew = true;      // الطاولة بذرة أيضاً: كل ما عليها (كتب، صحن، ملعقة) يلتحق بها

    while (grew) { grew = false; items.forEach(i => { if (grp.has(i) || BGLBL.test(i.label)) return; const held = i.holder && grp.has(i.holder) && !(/^(كتب|كتاب)/.test(i.label) && PERS.test(i.holder.label) && (i.y0 + i.y1) / 2 < i.holder.y0 + .7 * (i.holder.y1 - i.holder.y0));      // ما يحمله الموضوع يدخل دائماً (ولو ثقة كشفه منخفضة)
      if (!held && ((i.det || 1) < .3 || bA(bx(i)) < .004 * px || ![...grp].some(g => bI(bx(i), bx(g)) >= (g === tbl ? .25 : .5) * bA(bx(i)) && (g === tbl || !PERS.test(g.label) || (i.y0 + i.y1) / 2 >= g.y0 + .6 * (g.y1 - g.y0))))) return; grp.add(i); grew = true; }); }      // ما خلف الشخص في الجدار (رفّ كتب جانب رأسه) لا يلتحق به؛ يلتحق ما كان في النصف السفلي منه أو على الطاولة
    return [...grp];
  }
  /* سطح الطاولة/المكتب أسفل المشهد: نقاط موجبة في أسفل الصورة وسالبة في أعلاها؛ يُقبل إن كان أسفل الصورة وبحجم معقول */
  async function tableItem(S, items, cv) {
    const W = cv.width, H = cv.height, P = (x, y, l) => [W * x, H * y, l], t = await AIVision.addItem(S, { pts: [P(.5, .95, 1), P(.08, .96, 1), P(.28, .95, 1), P(.72, .95, 1), P(.92, .96, 1), P(.5, .03, 0), P(.1, .15, 0), P(.9, .15, 0)], label: "طاولة" }, items);
    if (!t) return null; const fr = (t.x1 - t.x0) * (t.y1 - t.y0) / (W * H); return t.y0 > H * .3 && t.y1 > H * .9 && fr > .05 && fr < .7 && t.area > 0 ? t : null;
  }
  /* ثقوب صغيرة مغلقة داخل الموضوع (عبوة في يد لم يكشفها الكشف الخفيف…) تُملأ من الصورة الأصلية؛ الفراغات الكبيرة أو المتصلة بالحافة تبقى شفافة */
  function fillHolesC(out, cv, maxFrac) {
    const w = out.width, h = out.height, n = w * h, g = out.getContext("2d", { willReadFrequently: true }), im = g.getImageData(0, 0, w, h), d = im.data, o = cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const lab = new Int32Array(n).fill(-1), q = new Int32Array(n), comps = []; let filled = 0;
    for (let s0 = 0; s0 < n; s0++) { if (lab[s0] >= 0 || d[s0 * 4 + 3] > 40) continue; let hd = 0, tl = 0, border = false; const id = comps.length; q[tl++] = s0; lab[s0] = id;
      while (hd < tl) { const p = q[hd++], x = p % w, y = (p / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true; for (const t of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (t >= 0 && lab[t] < 0 && d[t * 4 + 3] <= 40) { lab[t] = id; q[tl++] = t; } }
      comps.push({ a: tl, border }); }
    for (let i = 0; i < n; i++) { const c = comps[lab[i]]; if (c && !c.border && c.a < maxFrac * n) { d[i * 4] = o[i * 4]; d[i * 4 + 1] = o[i * 4 + 1]; d[i * 4 + 2] = o[i * 4 + 2]; d[i * 4 + 3] = 255; filled++; } }
    if (filled) g.putImageData(im, 0, 0); return out;
  }
  /* سطح الطاولة يبدأ من تحت أخفض شخص: يُمدَّد قناع الطاولة (الذي قد يلتقط واجهتها الداكنة فقط) صعوداً إلى أسفل الأشخاص بعرض الصورة كلها؛ فيدخل سطحها وما عليه */
  function extendTable(S, t, items) {
    const per = items.filter(i => PERS.test(i.label) && !i.holder); if (!per.length) return; const yB = Math.max(...per.map(i => i.y1)); if (yB >= t.y0 || yB < .35 * S.H) return;
    const r0 = Math.max(0, Math.floor(yB * S.fy)), r1 = Math.min(t.lh, Math.ceil(t.y0 * S.fy) + 1); for (let y = r0; y < r1; y++) for (let x = 0; x < t.lw; x++) t.lo[y * t.lw + x] = Math.max(t.lo[y * t.lw + x], 6);
    t.x0 = 0; t.x1 = S.W; t.y0 = yB; let a = 0; for (let i = 0; i < t.lo.length; i++) if (t.lo[i] > 0) a++; t.area = a;
  }
  async function aiCut(srcC, o) {
    const lite = LITE(), cv = capC(srcC, lite ? 1280 : 2200), step = o.onStep || (() => { }); step("⏳ تجهيز أداة القص داخل متصفحك (أول مرة أطول)…");
    const res = await AIVision.analyze(cv, { lite, onStep: step }), S = res.S, items = res.items; let best = null, tbl = null; if (o.variant !== "all") { const pre = pickMain(S, items); if (pre && PERS.test(pre.label)) { try { tbl = await tableItem(S, items, cv); if (tbl) extendTable(S, tbl, items); } catch (e) { console.warn("table", e); } } }      // مشهد بأشخاص: الطاولة أمامهم تبقى (يُحذف ما وراءهم فقط)
    let grp = o.variant === "all" ? items.filter(i => !BGLBL.test(i.label) && ((i.det || 1) >= .3 || i.holder)) : pickGroup(S, items, tbl); if (grp && !grp.length) grp = null;
    if (!grp) { step("⏳ تحديد الموضوع من مركز الصورة…"); const W = cv.width, H = cv.height, e = [[.03, .03], [.5, .02], [.97, .03], [.02, .5], [.98, .5], [.03, .97], [.5, .98], [.97, .97]];
      best = await AIVision.addItem(S, { pts: [[W / 2, H / 2, 1]].concat(e.map(p => [W * p[0], H * p[1], 0])), label: "الموضوع" }, items); }
    else {
      best = grp.length > 1 ? AIVision.joinItems(S, items, grp) : grp[0]; }
    if (!best) return null; o.diag = "v2.4 · " + (S.dev || "") + (lite ? " · خفيف" : "") + " · " + cv.width + "×" + cv.height + " · مكتشف: " + (items.map(i => i.label).join("، ") || "لا شيء") + " · الطاولة: " + (tbl ? "نعم" : "لا") + " · مجموعة: " + (grp ? grp.length : 0);
    step("⏳ قصّ الحواف بدقة (شعر وتفاصيل)…"); await tick();
    const cuts = AIVision.cutouts(S, cv, [best], { shadow: false, matteMax: lite ? 1.2e6 : 3.2e6 }); if (!cuts.length) return null;
    const out = document.createElement("canvas"); out.width = cv.width; out.height = cv.height; out.getContext("2d").drawImage(cuts[0].canvas, cuts[0].x0, cuts[0].y0); return fillHolesC(out, cv, .03);
  }
  const METHODS = { ai: aiCut, all: (c, o) => aiCut(c, Object.assign({}, o, { variant: "all" })), classic: classicCut, gmm: (c, o) => classicCut(c, Object.assign({}, o, { noFlood: true })) };
  /* يجرّب الطرق بالترتيب حتى تنجح إحداها (نتيجة بتغطية معقولة) ← { canvas, method } */
  async function autoCut(srcC, o) {
    o = o || {}; const order = o.methods || (aiOK() ? ["ai", "classic"] : ["classic"]); let err = null, last = null;
    for (const m of order) {
      try { const c = await METHODS[m](srcC, o); if (!c) continue; const cov = coverage(c); last = { canvas: c, method: m, cov }; if (cov > .02 && cov < .985) return last; if (o.onStep) o.onStep("⚠️ نتيجة غير معقولة (" + Math.round(cov * 100) + "%) — أجرّب طريقة أخرى…"); }
      catch (e) { err = e; console.warn("PBBgRemove", m, e); if (o.onStep) o.onStep("⚠️ " + (e && e.message || e) + " — أجرّب طريقة أخرى…"); }
    }
    if (last) return last; throw err || new Error("تعذّر نزع الخلفية من هذه الصورة");
  }
  async function open(inf) {
    if (!inf || inf.node.type !== "image" || !inf.node.set.src) { alert("حدّد صورة أولاً"); return; }
    const id = inf.node.id; let srcC; try { srcC = await load(inf.node.set.src); } catch (e) { alert("⚠️ " + e.message); return; }
    if (!document.getElementById("pbbg-css")) { const st = document.createElement("style"); st.id = "pbbg-css"; st.textContent = "@keyframes pbbgScan{0%{top:0}100%{top:100%}}#pbbg .ln{position:absolute;left:0;right:0;height:2px;background:#60a5fa;box-shadow:0 0 8px #3b82f6;animation:pbbgScan 1.4s linear infinite;pointer-events:none}#pbbg button{font-family:inherit}"; document.head.appendChild(st); }
    const ov = document.createElement("div"); ov.id = "pbbg"; ov.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(10,15,12,.82);display:flex;align-items:center;justify-content:center;font-family:inherit;direction:rtl;padding:10px";
    ov.innerHTML = `<div style="background:#fff;border-radius:16px;padding:.8rem;width:min(760px,98vw);max-height:96vh;display:flex;flex-direction:column;gap:.6rem;box-shadow:0 20px 60px rgba(0,0,0,.5)">
  <div style="display:flex;align-items:center;gap:.5rem"><b style="flex:1">✂️ نزع الخلفية</b></div>
  <div id="bg-vw" style="position:relative;background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/18px 18px;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:200px;max-height:68vh"><canvas id="bg-cv" style="max-width:100%;max-height:68vh;display:block"></canvas><div class="ln" id="bg-ln"></div></div>
  <div id="bg-msg" style="font-size:.84rem;line-height:1.7;color:#173f35;min-height:1.7em"></div>
  <div id="bg-dg" style="font-size:.66rem;color:#8a8472;line-height:1.5;direction:ltr;text-align:left;word-break:break-word"></div>
  <div id="bg-bar" style="display:flex;gap:.45rem"><button id="bg-save" type="button" disabled style="flex:2;background:#173f35;color:#fff;border:0;border-radius:10px;padding:.7rem;font-weight:800;cursor:pointer">💾 حفظ</button><button id="bg-again" type="button" disabled style="flex:1;background:#fff;color:#173f35;border:1.5px solid #d6d3cb;border-radius:10px;padding:.7rem;font-weight:700;cursor:pointer">🔁 إعادة</button><button id="bg-x" type="button" style="flex:1;background:#fff;color:#b83232;border:1.5px solid #e6c4c4;border-radius:10px;padding:.7rem;font-weight:700;cursor:pointer">✕ إلغاء</button></div>
</div>`;
    document.body.appendChild(ov); const $ = i => ov.querySelector("#" + i), cv = $("bg-cv"), cg = cv.getContext("2d"), msg = t => { $("bg-msg").textContent = t; };
    const S = { busy: false, res: null, tried: [], closed: false };
    const close = () => { S.closed = true; ov.remove(); }; $("bg-x").onclick = close;
    const show = (c, bgOnly) => { cv.width = c ? c.width : srcC.width; cv.height = c ? c.height : srcC.height; cg.clearRect(0, 0, cv.width, cv.height); cg.drawImage(c || srcC, 0, 0, cv.width, cv.height); };
    const run = async methods => {
      if (S.busy) return; S.busy = true; $("bg-save").disabled = $("bg-again").disabled = true; $("bg-ln").style.display = ""; show(null); msg("⏳ جارٍ نزع الخلفية…"); await tick();
      try { const oo = { methods, onStep: m => { if (!S.closed) msg(m); } }, r = await autoCut(srcC, oo); r.diag = oo.diag || ""; if (S.closed) return; S.res = r; S.tried.push(r.method); show(r.canvas); $("bg-ln").style.display = "none";
        msg("✅ تمّ. إن لم تعجبك النتيجة اضغط «إعادة» لتجربة طريقة أخرى."); $("bg-dg").textContent = r.method + (r.diag ? " · " + r.diag : "");
        $("bg-save").disabled = $("bg-again").disabled = false; }
      catch (e) { if (!S.closed) { $("bg-ln").style.display = "none"; const er = e && e.message || e; if (S.res) { show(S.res.canvas); msg("⚠️ فشلت هذه الطريقة (" + er + ") — عدتُ للنتيجة السابقة."); } else { msg("⚠️ " + er); S.res = null; }
        $("bg-again").disabled = false; $("bg-save").disabled = !S.res; } console.error(e); } S.busy = false;
    };
    $("bg-again").onclick = () => { const all = aiOK() ? ["ai", "all", "classic", "gmm"] : ["classic", "gmm"], i = all.indexOf(S.res ? S.res.method : "classic"); run([all[(i + 1) % all.length]]); };
    const save = async asCopy => {
      if (S.busy || !S.res) return; S.busy = true; $("bg-save").disabled = $("bg-again").disabled = true;
      try { const blob = await new Promise(r => S.res.canvas.toBlob(r, "image/png")); msg("⏳ رفع الصورة…"); const path = await A().uploadBlob(blob, "nobg-" + Date.now().toString(36), { max: 3200, q: .95 }), q = A().find(id); if (!q) throw new Error("لم يعد العنصر موجوداً");
        if (asCopy) { const c = PB.mkFree("image", 0, 0, (Number(q.node.set.zi) || 1) + 1); Object.assign(c.set, JSON.parse(JSON.stringify(q.node.set)), { src: path, crop: q.node.set.crop ? JSON.parse(JSON.stringify(q.node.set.crop)) : undefined, clip: undefined, clipEO: undefined, clipMode: undefined, pz: undefined, pzh: undefined, pzo: undefined, zi: (Number(q.node.set.zi) || 1) + 1 });
          ["d", "m"].forEach(dev => { const fx = Number(PB.eff(q.node.set, "fx", dev)), fy = Number(PB.eff(q.node.set, "fy", dev)), fw = Number(PB.eff(q.node.set, "fwd", dev)), fh = Number(PB.eff(q.node.set, "fh", dev)); if (![fx, fy, fw, fh].every(Number.isFinite)) return; const right = fx + fw + 2 + fw <= 100; PB.setR(c.set, "fx", dev, right ? +(fx + fw + 2).toFixed(2) : fx); PB.setR(c.set, "fy", dev, right ? fy : +(fy + fh + 16).toFixed(2)); PB.setR(c.set, "fwd", dev, fw); PB.setR(c.set, "fh", dev, fh); });
          q.list.splice(q.idx + 1, 0, c); A().E.nextLabel = "نزع الخلفية (نسخة)"; A().E.sel = c.id; A().renderCanvas(); A().commitAfter(c.id); }
        else { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "نزع الخلفية"; A().E.sel = id; A().renderCanvas(); A().commitAfter(id); }
        close(); } catch (e) { msg("⚠️ " + e.message); $("bg-save").disabled = $("bg-again").disabled = false; console.error(e); } S.busy = false;
    };
    $("bg-save").onclick = () => save(false);
    run(null);
  }
  function load(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); }); }
  return { open, autoCut, _t: { matteCore, setTemp: v => { TEMP = v; }, segment, matte, cleanMask, rgbOf, scaledCanvas, fitGMM, solve, guidedFast, boxMean, morph } };
})();
