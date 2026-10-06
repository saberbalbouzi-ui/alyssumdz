/* ═══ نزع الخلفية — بلا API وبلا نماذج خارجية: خوارزميات تشبه أدوات فوتوشوب تعمل كلها داخل المتصفح ═══
   ① تحليل لوني ذاتي: نماذج GMM للمقدّمة والخلفية من الحواف ومركز الصورة (أو من فرشاتك) + تنعيم على شبكة تراعي الحواف (مثل GrabCut).
   ② تصحيح تفاعلي: فرشاة «احتفظ» و«احذف»، عصا سحرية، مستطيل حول الموضوع، ممحاة/استرجاع مباشرين.
   ③ حواف دقيقة: شريط انتقالي (Trimap) + ألفا من ألوان المقدّمة والخلفية القريبتين + Guided Filter + إزالة هالة الخلفية (Decontaminate).
   يخرج PNG شفاف بدقّة الصورة (حتى 2000px)، ويُحفظ استبدالاً للصورة أو نسخةً بجانبها. */
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

  /* ───────── واجهة النافذة ───────── */
  const BG = { chk: "repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/18px 18px", wht: "#fff", blk: "#000", grn: "#00b140", red: "#e0245e" };
  async function open(inf) {
    if (!inf || inf.node.type !== "image" || !inf.node.set.src) { alert("حدّد صورة أولاً"); return; }
    const id = inf.node.id; let srcC; try { srcC = await load(inf.node.set.src); } catch (e) { alert("⚠️ " + e.message); return; }
    const k = Math.min(1, OUTMAX / Math.max(srcC.width, srcC.height)), FW = Math.round(srcC.width * k), FH = Math.round(srcC.height * k), kp = Math.min(1, PRE / Math.max(FW, FH)), PW = Math.max(2, Math.round(FW * kp)), PH = Math.max(2, Math.round(FH * kp)), kl = Math.min(1, LO / Math.max(PW, PH)), LW = Math.max(8, Math.round(PW * kl)), LH = Math.max(8, Math.round(PH * kl));
    const fullC = scaledCanvas(srcC, FW, FH), prevC = scaledCanvas(fullC, PW, PH), loC = scaledCanvas(prevC, LW, LH), prevO = rgbOf(prevC), loO = rgbOf(loC);
    const alphaSeed = (() => { const c = document.createElement("canvas"); c.width = PW; c.height = PH; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(srcC, 0, 0, PW, PH); const d = g.getImageData(0, 0, PW, PH).data, o = new Uint8Array(PW * PH); let t = 0; for (let i = 0; i < PW * PH; i++) { const al = d[i * 4 + 3]; if (al < 40) { o[i] = 2; t++; } else if (al > 215) o[i] = 1; } return t > PW * PH * .01 ? o : null; })();      // الصورة الشفافة أصلاً: الشفاف = خلفية والمعتم = مقدّمة (ثم عدّل بالفرشاة)
    const ov = document.createElement("div"); ov.id = "pbbg"; ov.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(10,15,12,.82);display:flex;align-items:center;justify-content:center;font-family:inherit;direction:rtl";
    const btn = (id, t, st) => `<button id="${id}" type="button" class="pbx-small" style="${st || ""}">${t}</button>`;
    ov.innerHTML = `<div style="background:#fff;border-radius:16px;padding:.7rem;width:min(1180px,98vw);max-height:97vh;display:flex;flex-direction:column;gap:.55rem;box-shadow:0 20px 60px rgba(0,0,0,.5)">
  <div style="display:flex;flex-wrap:wrap;gap:.45rem;align-items:center"><b style="font-size:1rem">✂️ نزع الخلفية</b><span style="flex:1"></span>
    <label style="font-size:.76rem">العرض <select id="bg-bg" style="border:1px solid #d9dbe3;border-radius:8px;padding:.25rem"><option value="chk">شفاف (شطرنج)</option><option value="wht">أبيض</option><option value="blk">أسود</option><option value="grn">أخضر</option><option value="red">وردي</option><option value="ov">الأصلي مع تظليل المحذوف</option><option value="orig">الصورة الأصلية</option></select></label>
    <label style="font-size:.76rem">التكبير <select id="bg-zm" style="border:1px solid #d9dbe3;border-radius:8px;padding:.25rem"><option value="1">ملاءمة</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option><option value="4">400%</option></select></label>
    ${btn("bg-undo", "↶ تراجع")}${btn("bg-redo", "🔄 من الصفر")}<button id="bg-save" type="button" style="background:#173f35;color:#fff;border:0;border-radius:8px;padding:.45rem .8rem;font-weight:800;cursor:pointer;font-family:inherit">💾 حفظ (استبدال الصورة)</button><button id="bg-copy" type="button" style="background:#c8a24b;color:#173f35;border:0;border-radius:8px;padding:.45rem .8rem;font-weight:800;cursor:pointer;font-family:inherit">➕ حفظ كنسخة بجانبها</button><button id="bg-x" type="button" class="pbx-small">✕</button></div>
  <div style="display:flex;gap:.7rem;min-height:0;flex:1;flex-wrap:wrap">
    <div id="bg-tools" style="width:230px;display:flex;flex-direction:column;gap:.45rem;font-size:.78rem">
      <b>الأداة</b>
      <div id="bg-tl" style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem">
        <button data-t="fg" class="pbx-small on">🔵 احتفظ</button><button data-t="bg" class="pbx-small">🔴 احذف</button><button data-t="wand" class="pbx-small">🪄 عصا سحرية</button><button data-t="rect" class="pbx-small">▭ حدّد الموضوع</button><button data-t="erase" class="pbx-small">🧽 ممحاة مباشرة</button><button data-t="restore" class="pbx-small">🖌 استرجاع مباشر</button></div>
      <label>حجم الفرشاة <b id="bg-szv">30</b><input id="bg-sz" type="range" min="4" max="160" value="30" style="width:100%"></label>
      <label>تسامح العصا السحرية <b id="bg-tov">28</b><input id="bg-to" type="range" min="4" max="90" value="28" style="width:100%"></label>
      <hr style="border:0;border-top:1px solid #eee;margin:.1rem 0"><b>الحواف</b>
      <label>إزاحة الحافة (+ تقليص / − توسيع) <b id="bg-shv">0</b><input id="bg-sh" type="range" min="-6" max="6" value="0" style="width:100%"></label>
      <label>دقّة التفاصيل (شعر/حواف دقيقة) <b id="bg-dtv">1</b><input id="bg-dt" type="range" min="0.5" max="3" step="0.1" value="1" style="width:100%"></label>
      <label>تنعيم الحافة <b id="bg-ftv">0</b><input id="bg-ft" type="range" min="0" max="8" value="0" style="width:100%"></label>
      <label style="display:flex;gap:.35rem;align-items:center;cursor:pointer"><input id="bg-dc" type="checkbox" checked> إزالة هالة لون الخلفية عن الحواف</label><label style="display:flex;gap:.35rem;align-items:center;cursor:pointer"><input id="bg-sv" type="checkbox" checked> إظهار خطوط الفرشاة</label>
      <div id="bg-msg" style="line-height:1.7;color:#173f35;min-height:3.4em;font-size:.76rem"></div>
      <div style="color:#8a8472;font-size:.72rem;line-height:1.7">يعمل داخل متصفحك بلا API ولا اشتراك. 🔵 ارسم على ما تريد إبقاءه و🔴 على ما تريد حذفه فيُعاد التحليل فوراً. «حدّد الموضوع» برسم مستطيل حوله. وللحسم الدقيق استعمل الممحاة/الاسترجاع المباشرين مع التكبير.</div></div>
    <div id="bg-vw" style="flex:1;min-width:300px;background:#2b2b31;border-radius:10px;overflow:auto;max-height:78vh;position:relative"><div id="bg-st" style="position:relative;margin:8px auto;touch-action:none;width:fit-content"><canvas id="bg-cv" width="${PW}" height="${PH}" style="display:block"></canvas><canvas id="bg-ol" width="${PW}" height="${PH}" style="position:absolute;inset:0;cursor:crosshair"></canvas></div></div>
  </div></div>`;
    document.body.appendChild(ov); const $ = i => ov.querySelector("#" + i), cv = $("bg-cv"), cg = cv.getContext("2d"), ol = $("bg-ol"), og = ol.getContext("2d"), msg = t => { $("bg-msg").textContent = t; };
    const S = { ops: [], tool: "fg", seeds: null, u: null, res: null, busy: false, dirty: false, rect: null, cur: null }; const st = $("bg-st");
    const fit = () => { const vw = $("bg-vw"), fz = Math.min(4, (vw.clientWidth - 24) / PW, (innerHeight * .74) / PH), z = fz * Number($("bg-zm").value); cv.style.width = ol.style.width = Math.round(PW * z) + "px"; cv.style.height = ol.style.height = Math.round(PH * z) + "px"; }; fit(); addEventListener("resize", fit); $("bg-zm").onchange = fit;
    const pos = e => { const r = ol.getBoundingClientRect(); return [(e.clientX - r.left) * PW / r.width, (e.clientY - r.top) * PH / r.height]; };
    /* بذور المعاينة من عمليات المستخدم */
    const rasterSeeds = () => {
      const seeds = alphaSeed ? Uint8Array.from(alphaSeed) : new Uint8Array(PW * PH), c = document.createElement("canvas"); c.width = PW; c.height = PH; const g = c.getContext("2d", { willReadFrequently: true });
      let i = 0; const ops = S.ops;
      while (i < ops.length) { const o = ops[i]; if (o.k === "stroke" && (o.t === "fg" || o.t === "bg")) { g.clearRect(0, 0, PW, PH); g.lineCap = g.lineJoin = "round"; g.strokeStyle = g.fillStyle = "#000"; let j = i; while (j < ops.length && ops[j].k === "stroke" && ops[j].t === o.t) { const s = ops[j]; g.lineWidth = s.r * 2; g.beginPath(); s.p.forEach((q, a) => a ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); if (s.p.length === 1) { g.arc(s.p[0][0], s.p[0][1], s.r, 0, 7); g.fill(); } else g.stroke(); j++; }
          const d = g.getImageData(0, 0, PW, PH).data, v = o.t === "fg" ? 1 : 2; for (let p = 0; p < PW * PH; p++) if (d[p * 4 + 3] > 110) seeds[p] = v; i = j; }
        else if (o.k === "wand") { const v = o.mode === "fg" ? 1 : 2; for (let p = 0; p < PW * PH; p++) if (o.m[p]) seeds[p] = v; i++; } else i++; }
      return seeds;
    };
    const lastRect = () => { for (let i = S.ops.length - 1; i >= 0; i--) if (S.ops[i].k === "rect") return S.ops[i].r; return null; };
    const toLo = (seeds) => { const o = new Uint8Array(LW * LH), sx = PW / LW, sy = PH / LH; for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { let f = 0, b = 0; const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy)); for (let yy = y0; yy < y1 && yy < PH; yy++) for (let xx = x0; xx < x1 && xx < PW; xx++) { const s = seeds[yy * PW + xx]; if (s === 1) f++; else if (s === 2) b++; } const tot = (x1 - x0) * (y1 - y0); if (f > tot * .4 && f >= b) o[y * LW + x] = 1; else if (b > tot * .4) o[y * LW + x] = 2; } return o; };
    const opts = () => ({ shift: Number($("bg-sh").value), detail: Number($("bg-dt").value), feather: Number($("bg-ft").value), decon: $("bg-dc").checked });
    /* التصحيح المباشر (ممحاة/استرجاع) على ألفا النتيجة، بحجم w×h */
    const applyDirect = (al, w, h, scale) => { const ops = S.ops.filter(o => o.k === "stroke" && (o.t === "erase" || o.t === "restore")); if (!ops.length) return; const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d", { willReadFrequently: true });
      for (const o of ops) { g.clearRect(0, 0, w, h); g.lineCap = g.lineJoin = "round"; g.strokeStyle = g.fillStyle = "#000"; g.filter = "blur(" + Math.max(.4, o.r * scale * .12) + "px)"; g.lineWidth = o.r * 2 * scale; g.beginPath(); o.p.forEach((q, a) => a ? g.lineTo(q[0] * scale, q[1] * scale) : g.moveTo(q[0] * scale, q[1] * scale)); if (o.p.length === 1) { g.arc(o.p[0][0] * scale, o.p[0][1] * scale, o.r * scale, 0, 7); g.fill(); } else g.stroke();
        const d = g.getImageData(0, 0, w, h).data; for (let p = 0; p < w * h; p++) { const s = d[p * 4 + 3] / 255; if (!s) continue; if (o.t === "erase") al[p] *= 1 - s; else al[p] = Math.max(al[p], s); } } };
    const render = () => {
      const m = $("bg-bg").value; cv.style.background = BG[m] || BG.chk; cg.clearRect(0, 0, PW, PH);
      if (m === "orig" || !S.res) { cg.drawImage(prevC, 0, 0); drawOv(); return; }
      if (m === "ov") { cg.drawImage(prevC, 0, 0); const im = cg.getImageData(0, 0, PW, PH), d = im.data, a = S.res.alpha; for (let i = 0; i < PW * PH; i++) { const k = 1 - a[i]; if (k > 0) { d[i * 4] = d[i * 4] * (1 - .62 * k) + 255 * .62 * k; d[i * 4 + 1] *= 1 - .62 * k; d[i * 4 + 2] = d[i * 4 + 2] * (1 - .62 * k) + 40 * .62 * k; } } cg.putImageData(im, 0, 0); drawOv(); return; }
      const t = document.createElement("canvas"); t.width = PW; t.height = PH; t.getContext("2d").putImageData(new ImageData(S.res.show, PW, PH), 0, 0); cg.drawImage(t, 0, 0); drawOv();
    };
    const drawOv = () => { og.clearRect(0, 0, PW, PH); og.lineCap = og.lineJoin = "round"; if (!$("bg-sv").checked && !S.cur) { if (S.hover && ["fg", "bg", "erase", "restore"].includes(S.tool)) { og.strokeStyle = "#fff"; og.lineWidth = 1.5; og.beginPath(); og.arc(S.hover[0], S.hover[1], Number($("bg-sz").value) / 2, 0, 7); og.stroke(); } return; }
      S.ops.forEach(o => { if (o.k === "stroke" && (o.t === "fg" || o.t === "bg")) { og.strokeStyle = og.fillStyle = o.t === "fg" ? "rgba(40,120,255,.5)" : "rgba(235,50,60,.55)"; og.lineWidth = o.r * 2; og.beginPath(); o.p.forEach((q, a) => a ? og.lineTo(q[0], q[1]) : og.moveTo(q[0], q[1])); if (o.p.length === 1) { og.beginPath(); og.arc(o.p[0][0], o.p[0][1], o.r, 0, 7); og.fill(); } else og.stroke(); } else if (o.k === "wand") { const col = o.mode === "fg" ? [40, 120, 255] : [235, 50, 60]; const im = og.getImageData(0, 0, PW, PH), d = im.data; for (let p = 0; p < PW * PH; p++) if (o.m[p]) { d[p * 4] = col[0]; d[p * 4 + 1] = col[1]; d[p * 4 + 2] = col[2]; d[p * 4 + 3] = Math.max(d[p * 4 + 3], 90); } og.putImageData(im, 0, 0); } });
      const r = S.cur && S.cur.k === "rect" ? S.cur.r : lastRect(); if (r) { og.strokeStyle = "#7c3aed"; og.lineWidth = 2; og.setLineDash([8, 6]); og.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); og.setLineDash([]); }
      if (S.hover && ["fg", "bg", "erase", "restore"].includes(S.tool)) { og.strokeStyle = "#fff"; og.lineWidth = 1.5; og.beginPath(); og.arc(S.hover[0], S.hover[1], Number($("bg-sz").value) / 2, 0, 7); og.stroke(); } };
    /* تشغيل المعالجة (تحليل ← حواف) */
    let timer = null, runId = 0;
    const analyze = async (full) => {
      const my = ++runId; S.busy = true; msg("⏳ تحليل الألوان…"); await tick();
      try {
        const seeds = rasterSeeds(), lo = toLo(seeds); let u = null;
        if (full || !S.u) { u = await segment(loO, lo, { rect: (() => { const r = lastRect(); return r ? [r[0] * LW / PW, r[1] * LH / PH, r[2] * LW / PW, r[3] * LH / PH] : null; })() }); if (my !== runId) return; if (!u) { msg("⚠️ تعذّر التحليل — ارسم بالفرشاة 🔵/🔴"); S.busy = false; return; } S.u = cleanMask(u, LW, LH, lo); }
        finish(); msg("✅ جاهز. صحّح بـ 🔵 و🔴 أو ممحاة/استرجاع مباشر، ثم احفظ.");
      } catch (e) { msg("⚠️ " + e.message); console.error(e); } S.busy = false;
    };
    const finish = () => { if (!S.u) return; const r = matte(prevO, S.u, LW, LH, opts()); applyDirect(r.alpha, PW, PH, 1); const show = new Uint8ClampedArray(PW * PH * 4); for (let i = 0; i < PW * PH; i++) { show[i * 4] = r.data[i * 4]; show[i * 4 + 1] = r.data[i * 4 + 1]; show[i * 4 + 2] = r.data[i * 4 + 2]; show[i * 4 + 3] = clamp(r.alpha[i], 0, 1) * 255; } S.res = { alpha: r.alpha, show }; render(); };
    const later = (full) => { clearTimeout(timer); timer = setTimeout(() => analyze(full), 140); };
    const refine = () => { clearTimeout(timer); timer = setTimeout(() => { if (!S.busy) { try { finish(); } catch (e) { msg("⚠️ " + e.message); } } }, 120); };
    /* إدخال المؤشر */
    ol.addEventListener("pointerdown", e => { if (S.busy && S.tool !== "erase" && S.tool !== "restore") return; e.preventDefault(); ol.setPointerCapture(e.pointerId); const p = pos(e), t = S.tool;
      if (t === "wand") { const m = wand(prevO, PW, PH, p[0] | 0, p[1] | 0, Number($("bg-to").value) / 255 * 1.2); const mode = e.altKey ? "fg" : "bg"; S.ops.push({ k: "wand", m, mode }); later(true); drawOv(); return; }
      if (t === "rect") { S.cur = { k: "rect", r: [p[0], p[1], p[0], p[1]], a: p }; return; }
      S.cur = { k: "stroke", t, r: Number($("bg-sz").value) / 2, p: [p] }; S.ops.push(S.cur); drawOv(); });
    ol.addEventListener("pointermove", e => { const p = pos(e); S.hover = p; if (!S.cur) { drawOv(); return; } if (S.cur.k === "rect") { const a = S.cur.a; S.cur.r = [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[0], p[0]), Math.max(a[1], p[1])]; } else S.cur.p.push(p); drawOv(); });
    ol.addEventListener("pointerleave", () => { S.hover = null; drawOv(); });
    ol.addEventListener("pointerup", () => { const c = S.cur; S.cur = null; if (!c) return; if (c.k === "rect") { const r = c.r; if (r[2] - r[0] > 10 && r[3] - r[1] > 10) { S.ops.push({ k: "rect", r }); later(true); } drawOv(); return; } if (c.t === "erase" || c.t === "restore") refine(); else later(true); });
    $("bg-tl").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; S.tool = b.dataset.t; $("bg-tl").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); ol.style.cursor = S.tool === "wand" ? "copy" : "crosshair"; });
    const bind = (id, vid, fnLater) => { $(id).oninput = () => { $(vid).textContent = $(id).value; }; $(id).onchange = fnLater; };
    bind("bg-sz", "bg-szv"); bind("bg-to", "bg-tov"); bind("bg-sh", "bg-shv", refine); bind("bg-dt", "bg-dtv", refine); bind("bg-ft", "bg-ftv", refine); $("bg-dc").onchange = refine; $("bg-sv").onchange = drawOv; $("bg-bg").onchange = render;
    $("bg-undo").onclick = () => { if (S.busy) return; S.ops.pop(); S.dirty = true; const last = S.ops[S.ops.length - 1]; later(!last || last.k !== "stroke" || (last.t !== "erase" && last.t !== "restore") ? true : false); if (!S.ops.length) { S.res = null; } };
    $("bg-redo").onclick = () => { if (S.busy) return; S.ops = []; S.u = null; S.res = null; analyze(true); };
    const close = () => { removeEventListener("resize", fit); ov.remove(); }; $("bg-x").onclick = () => { if (S.ops.length && !confirm("إغلاق دون حفظ؟")) return; close(); };
    /* التصدير */
    const exportBlob = async () => {
      msg("⏳ إخراج الصورة بدقّتها الكاملة…"); await tick(); const fo = rgbOf(fullC), r = matte(fo, S.u, LW, LH, opts()); applyDirect(r.alpha, FW, FH, FW / PW);
      for (let i = 0; i < FW * FH; i++) r.data[i * 4 + 3] = clamp(r.alpha[i], 0, 1) * 255 < 2 ? 0 : clamp(r.alpha[i], 0, 1) * 255;
      const c = document.createElement("canvas"); c.width = FW; c.height = FH; c.getContext("2d").putImageData(new ImageData(r.data, FW, FH), 0, 0); return await new Promise(res => c.toBlob(res, "image/png"));
    };
    const save = async (asCopy) => {
      if (S.busy || !S.u) { msg("انتظر انتهاء التحليل"); return; } S.busy = true; $("bg-save").disabled = $("bg-copy").disabled = true;
      try { const blob = await exportBlob(); msg("⏳ رفع الصورة…"); const path = await A().uploadBlob(blob, "nobg-" + Date.now().toString(36), { max: 3200, q: .95 }), q = A().find(id); if (!q) throw new Error("لم يعد العنصر موجوداً");
        if (asCopy) { const c = PB.mkFree("image", 0, 0, (Number(q.node.set.zi) || 1) + 1); Object.assign(c.set, JSON.parse(JSON.stringify(q.node.set)), { src: path, crop: q.node.set.crop ? JSON.parse(JSON.stringify(q.node.set.crop)) : undefined, clip: undefined, clipEO: undefined, clipMode: undefined, pz: undefined, pzh: undefined, pzo: undefined, zi: (Number(q.node.set.zi) || 1) + 1 });
          ["d", "m"].forEach(dev => { const fx = Number(PB.eff(q.node.set, "fx", dev)), fy = Number(PB.eff(q.node.set, "fy", dev)), fw = Number(PB.eff(q.node.set, "fwd", dev)), fh = Number(PB.eff(q.node.set, "fh", dev)); if (![fx, fy, fw, fh].every(Number.isFinite)) return; const right = fx + fw + 2 + fw <= 100; PB.setR(c.set, "fx", dev, right ? +(fx + fw + 2).toFixed(2) : fx); PB.setR(c.set, "fy", dev, right ? fy : +(fy + fh + 16).toFixed(2)); PB.setR(c.set, "fwd", dev, fw); PB.setR(c.set, "fh", dev, fh); });
          q.list.splice(q.idx + 1, 0, c); A().E.nextLabel = "نزع الخلفية (نسخة)"; A().E.sel = c.id; A().renderCanvas(); A().commitAfter(c.id); }
        else { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "نزع الخلفية"; A().E.sel = id; A().renderCanvas(); A().commitAfter(id); }
        close(); } catch (e) { msg("⚠️ " + e.message); $("bg-save").disabled = $("bg-copy").disabled = false; console.error(e); } S.busy = false;
    };
    $("bg-save").onclick = () => save(false); $("bg-copy").onclick = () => save(true);
    cg.drawImage(prevC, 0, 0); drawOv(); analyze(true);
  }
  /* العصا السحرية: ملء بالتشابه اللوني من النقرة (مع متوسط حول النقطة) */
  function wand(po, w, h, x, y, tol) {
    const rgb = po.rgb, m = new Uint8Array(w * h); x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); let r = 0, g = 0, b = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = clamp(x + dx, 0, w - 1), yy = clamp(y + dy, 0, h - 1), i = yy * w + xx; r += rgb[i * 3]; g += rgb[i * 3 + 1]; b += rgb[i * 3 + 2]; c++; } r /= c; g /= c; b /= c;
    const ok = i => { const a = rgb[i * 3] - r, bb = rgb[i * 3 + 1] - g, cc = rgb[i * 3 + 2] - b; return Math.sqrt(a * a + bb * bb + cc * cc) <= tol; }, q = new Int32Array(w * h); let hd = 0, tl = 0; const s = y * w + x; if (!ok(s)) { m[s] = 1; return m; } m[s] = 1; q[tl++] = s;
    while (hd < tl) { const p = q[hd++], px = p % w, py = (p / w) | 0, nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]; for (let k = 0; k < 4; k++) { const j = nb[k]; if (j < 0 || m[j] || !ok(j)) continue; m[j] = 1; q[tl++] = j; } }
    return m;
  }
  function load(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); }); }
  return { open, _t: { matteCore, setTemp: v => { TEMP = v; }, segment, matte, cleanMask, rgbOf, scaledCanvas, fitGMM, solve, guidedFast, boxMean, morph, wand } };
})();
