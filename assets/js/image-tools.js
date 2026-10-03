/* أدوات الصور المشتركة (لوحة التحكم + محرر /editor/): كشف النصوص بالصورة، الممحاة (ترميم push-pull)، الفرشاة، لون الحبر.
   بلا شبكة وبلا مفتاح. تعتمد على canvas فقط. */
window.ImageTools = (function () {
  /* ───── ممحاة النصوص (مثل «Magic Eraser» في Canva) ─────
     ① تقدير سطح الخلفية حول الصندوق بمستوى لوني (يلتقط التدرّجات) ② قناع الحبر = بكسلات تبعُد عن السطح ثم توسيعه لتغطية الحواف والظلال
     ③ ترميم push-pull (هرم صور) + انتشار ناعم + حبيبات تماثل ضجيج الخلفية. للخلفيات المعقدة (صور/ملمس) يمكن تمرير gemini لإعادة رسم المنطقة. */
  function fitPlane(S, ch) {                                      // S: [[x,y,r,g,b]…] ⟵ معاملات a+bx+cy لكل قناة
    const solve = (pts) => { let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, sv = 0, sxv = 0, syv = 0, n = pts.length;
      for (const p of pts) { const x = p[0], y = p[1], v = p[2 + ch]; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; sv += v; sxv += x * v; syv += y * v; }
      const A = [[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]], B = [sv, sxv, syv], det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]), D = det(A);
      if (Math.abs(D) < 1e-6) return [sv / (n || 1), 0, 0];
      const col = k => A.map((r, i) => r.map((v, j) => j === k ? B[i] : v)); return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D]; };
    let pts = S, c = solve(pts);
    for (let it = 0; it < 2; it++) { const res = pts.map(p => Math.abs(p[2 + ch] - (c[0] + c[1] * p[0] + c[2] * p[1]))), sd = Math.sqrt(res.reduce((a, v) => a + v * v, 0) / (res.length || 1)); const keep = pts.filter((p, i) => res[i] <= 2.5 * sd + 6); if (keep.length < 12) break; pts = keep; c = solve(pts); }
    return c;
  }
  function pushPull(v, known, w, h) {                              // v: Float32Array(3*w*h) ⟵ يملأ غير المعروف
    const lv = [{ w, h, s: new Float32Array(w * h * 3), n: new Float32Array(w * h) }];
    for (let i = 0; i < w * h; i++) if (known[i]) { lv[0].n[i] = 1; for (let k = 0; k < 3; k++) lv[0].s[i * 3 + k] = v[i * 3 + k]; }
    while (lv[lv.length - 1].w > 1 || lv[lv.length - 1].h > 1) {
      const a = lv[lv.length - 1], nw = Math.max(1, (a.w + 1) >> 1), nh = Math.max(1, (a.h + 1) >> 1), b = { w: nw, h: nh, s: new Float32Array(nw * nh * 3), n: new Float32Array(nw * nh) };
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const i = y * a.w + x, j = (y >> 1) * nw + (x >> 1); b.n[j] += a.n[i]; for (let k = 0; k < 3; k++) b.s[j * 3 + k] += a.s[i * 3 + k]; }
      lv.push(b);
    }
    let C = null;                                                  // لون كل بكسل في المستوى الحالي (3 قيم)
    for (let l = lv.length - 1; l >= 0; l--) {
      const a = lv[l], cur = new Float32Array(a.w * a.h * 3);
      let gm = [128, 128, 128]; if (!C) { const t = lv[lv.length - 1]; if (t.n[0] > 0) gm = [t.s[0] / t.n[0], t.s[1] / t.n[0], t.s[2] / t.n[0]]; }
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
        const i = y * a.w + x;
        if (a.n[i] > 0) { for (let k = 0; k < 3; k++) cur[i * 3 + k] = a.s[i * 3 + k] / a.n[i]; continue; }
        if (!C) { for (let k = 0; k < 3; k++) cur[i * 3 + k] = gm[k]; continue; }
        const cw = lv[l + 1].w, ch = lv[l + 1].h, fx = Math.max(0, Math.min(cw - 1, (x + .5) / 2 - .5)), fy = Math.max(0, Math.min(ch - 1, (y + .5) / 2 - .5)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(cw - 1, x0 + 1), y1 = Math.min(ch - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
        for (let k = 0; k < 3; k++) cur[i * 3 + k] = (C[(y0 * cw + x0) * 3 + k] * (1 - tx) + C[(y0 * cw + x1) * 3 + k] * tx) * (1 - ty) + (C[(y1 * cw + x0) * 3 + k] * (1 - tx) + C[(y1 * cw + x1) * 3 + k] * tx) * ty;
      }
      C = cur;
    }
    for (let it = 0; it < (w * h > 400000 ? 6 : 16); it++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {      // انتشار ناعم للمجهول فقط
      const i = y * w + x; if (known[i]) continue;
      for (let k = 0; k < 3; k++) { let s = 0, c = 0; if (x > 0) { s += C[(i - 1) * 3 + k]; c++; } if (x < w - 1) { s += C[(i + 1) * 3 + k]; c++; } if (y > 0) { s += C[(i - w) * 3 + k]; c++; } if (y < h - 1) { s += C[(i + w) * 3 + k]; c++; } C[i * 3 + k] = s / c; }
    }
    for (let i = 0; i < w * h; i++) if (!known[i]) for (let k = 0; k < 3; k++) v[i * 3 + k] = C[i * 3 + k];
  }
  /* يمسح الحبر داخل كل مستطيل؛ يعيد [{rect, masked, complex}]. opt.gemini: async (ctx, P, mask) لإعادة رسم المناطق المعقدة */
  async function eraseRects(ctx, rects, opt) {
    opt = opt || {}; const CW = ctx.canvas.width, CH = ctx.canvas.height, out = [];
    for (const r0 of rects) {
      const rx0 = Math.max(0, Math.floor(r0.x0)), ry0 = Math.max(0, Math.floor(r0.y0)), rx1 = Math.min(CW, Math.ceil(r0.x1)), ry1 = Math.min(CH, Math.ceil(r0.y1)); if (rx1 - rx0 < 4 || ry1 - ry0 < 4) continue;
      const hh = ry1 - ry0, pad = Math.max(8, Math.min(40, Math.round(hh * .5))), px0 = Math.max(0, rx0 - pad), py0 = Math.max(0, ry0 - pad), px1 = Math.min(CW, rx1 + pad), py1 = Math.min(CH, ry1 + pad), pw = px1 - px0, ph = py1 - py0;
      const img = ctx.getImageData(px0, py0, pw, ph), D = img.data, inR = (x, y) => x >= rx0 - px0 - 1 && x < rx1 - px0 + 1 && y >= ry0 - py0 - 1 && y < ry1 - py0 + 1;
      const ring = [], step = Math.max(1, Math.floor(Math.sqrt(pw * ph / 2500)));
      for (let y = 0; y < ph; y += step) for (let x = 0; x < pw; x += step) if (!inR(x, y)) { const i = (y * pw + x) * 4; ring.push([x, y, D[i], D[i + 1], D[i + 2]]); }
      if (ring.length < 12) continue;
      const pl = [0, 1, 2].map(ch => fitPlane(ring, ch)), at = (x, y, ch) => pl[ch][0] + pl[ch][1] * x + pl[ch][2] * y;
      let rs = 0; for (const p of ring) rs += Math.abs(p[2] - at(p[0], p[1], 0)) + Math.abs(p[3] - at(p[0], p[1], 1)) + Math.abs(p[4] - at(p[0], p[1], 2)); const cx = rs / ring.length / 3;
      const T = Math.max(opt.thresh || 42, 5 * cx * 3), T2 = Math.max(7, 2.4 * cx * 3), mask = new Uint8Array(pw * ph), weak = new Uint8Array(pw * ph), rad2 = Math.max(6, Math.round(hh * .24)); let cnt = 0;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const i = (y * pw + x) * 4, d = Math.abs(D[i] - at(x, y, 0)) + Math.abs(D[i + 1] - at(x, y, 1)) + Math.abs(D[i + 2] - at(x, y, 2)); if (inR(x, y) && d > T) { mask[y * pw + x] = 1; cnt++; } else if (d > T2) weak[y * pw + x] = 1; }
      if (opt.skipComplex && cx > (opt.skipComplex === true ? 16 : opt.skipComplex)) { out.push({ rect: r0, masked: 0, complex: true, skipped: true }); continue; }      // نص على صورة/ملمس: نتركه (مثل كتابة عبوة المنتج)
      if (cnt < 6) { out.push({ rect: r0, masked: 0, complex: cx > 22, cx }); continue; }
      const dil = (src, r, round) => { const t = new Uint8Array(pw * ph), o = new Uint8Array(pw * ph);          // توسيع مربع قابل للفصل (سريع)
        for (let y = 0; y < ph; y++) { let last = -1e9; for (let x = 0; x < pw; x++) { if (src[y * pw + x]) last = x; if (x - last <= r) t[y * pw + x] = 1; } last = 1e9; for (let x = pw - 1; x >= 0; x--) { if (src[y * pw + x]) last = x; if (last - x <= r) t[y * pw + x] = 1; } }
        for (let x = 0; x < pw; x++) { let last = -1e9; for (let y = 0; y < ph; y++) { if (t[y * pw + x]) last = y; if (y - last <= r) o[y * pw + x] = 1; } last = 1e9; for (let y = ph - 1; y >= 0; y--) { if (t[y * pw + x]) last = y; if (last - y <= r) o[y * pw + x] = 1; } } return o; };
      const rad = Math.max(2, Math.min(7, Math.round(hh * .07))), core = dil(mask, rad), near = dil(mask, rad2), m2 = new Uint8Array(pw * ph);    // نواة الحروف + ظلال/توهّج ضعيفة قريبة منها
      for (let i = 0; i < pw * ph; i++) if (core[i] || (weak[i] && near[i])) m2[i] = 1;
      const known = new Uint8Array(pw * ph), v = new Float32Array(pw * ph * 3); let unk = 0;
      for (let i = 0; i < pw * ph; i++) { known[i] = m2[i] ? 0 : 1; if (m2[i]) unk++; const x = i % pw, y = (i / pw) | 0; for (let k = 0; k < 3; k++) v[i * 3 + k] = D[i * 4 + k] - at(x, y, k); }      // نرمّم «المتبقي» عن سطح الخلفية فيبقى التدرّج دقيقاً
      let usedG = false;
      if (opt.gemini && cx > 20) { try { usedG = await opt.gemini(ctx, { x: px0, y: py0, w: pw, h: ph }, m2, v); } catch (e) { usedG = false; } }
      if (!usedG) {
        pushPull(v, known, pw, ph);
        const gr = Math.min(7, cx * .8); if (gr > .6) for (let i = 0; i < pw * ph; i++) if (m2[i]) { const n = (Math.random() + Math.random() + Math.random() - 1.5) * gr * 1.6; v[i * 3] += n; v[i * 3 + 1] += n; v[i * 3 + 2] += n; }
      }
      for (let i = 0; i < pw * ph; i++) if (m2[i]) { const x = i % pw, y = (i / pw) | 0; for (let k = 0; k < 3; k++) D[i * 4 + k] = Math.max(0, Math.min(255, Math.round(usedG ? v[i * 3 + k] : v[i * 3 + k] + at(x, y, k)))); D[i * 4 + 3] = 255; }
      ctx.putImageData(img, px0, py0); out.push({ rect: r0, masked: unk, complex: cx > 22, gemini: usedG, cx });
    }
    return out;
  }
  /* ───── كشف النصوص بالصورة فقط (بلا OCR وبلا مفتاح) ─────
     الحبر = بكسلات تبعُد عن خلفيتها المحلية (تمويه واسع)؛ نجمعها في مكوّنات متصلة (حروف/كلمات) ثم نربط ما تقاطع رأسياً وتقارب أفقياً في أسطر.
     نرفض الصناديق الشبيهة بالصور (كبيرة جداً أو كثيفة التفاصيل). لا نحتاج قراءة الحروف لأن المسح لا يحتاج معرفة المكتوب. */
  function detectText(cv, opt) {
    opt = opt || {}; const W0 = cv.width, H0 = cv.height, sc = Math.min(1, 800 / W0), w = Math.max(8, Math.round(W0 * sc)), h = Math.max(8, Math.round(H0 * sc));
    const c2 = document.createElement("canvas"); c2.width = w; c2.height = h; const g2 = c2.getContext("2d", { willReadFrequently: true }); g2.drawImage(cv, 0, 0, w, h); const D = g2.getImageData(0, 0, w, h).data;
    const R = Math.max(5, Math.round(10 * Math.max(.6, Math.min(1.4, w / 800)))), N = w * h, S = new Float64Array((w + 1) * (h + 1) * 3);
    for (let y = 0; y < h; y++) { let r = 0, g = 0, b = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; r += D[i]; g += D[i + 1]; b += D[i + 2]; const j = ((y + 1) * (w + 1) + x + 1) * 3, k = (y * (w + 1) + x + 1) * 3; S[j] = S[k] + r; S[j + 1] = S[k + 1] + g; S[j + 2] = S[k + 2] + b; } }
    const res = new Float32Array(N); let sum = 0;
    for (let y = 0; y < h; y++) { const ya = Math.max(0, y - R), yb = Math.min(h, y + R + 1); for (let x = 0; x < w; x++) { const xa = Math.max(0, x - R), xb = Math.min(w, x + R + 1), cnt = (xb - xa) * (yb - ya), i = (y * w + x) * 4; let d = 0;
      for (let k = 0; k < 3; k++) { const m = (S[(yb * (w + 1) + xb) * 3 + k] - S[(ya * (w + 1) + xb) * 3 + k] - S[(yb * (w + 1) + xa) * 3 + k] + S[(ya * (w + 1) + xa) * 3 + k]) / cnt; d += Math.abs(D[i + k] - m); } res[y * w + x] = d; sum += d; } }
    const TS = 48, tw = Math.ceil(w / TS), th = Math.ceil(h / TS), Tt = new Float32Array(tw * th), ink = new Uint8Array(N), T = opt.thresh || 34;      // عتبة لكل بلاط: تتشدد في المناطق المليئة بالتفاصيل (صور) وتبقى حساسة على الخلفيات الناعمة
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) { const v = []; for (let y = ty * TS; y < Math.min(h, (ty + 1) * TS); y += 2) for (let x = tx * TS; x < Math.min(w, (tx + 1) * TS); x += 2) v.push(res[y * w + x]); v.sort((p, q) => p - q); Tt[ty * tw + tx] = Math.max(T, Math.min(110, 2.6 * (v[v.length >> 1] || 0) + 26)); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ink[y * w + x] = res[y * w + x] > Tt[((y / TS) | 0) * tw + ((x / TS) | 0)] ? 1 : 0;
    /* مكوّنات متصلة (اتصال 8) بـ union-find */
    const lab = new Int32Array(N), par = [0]; const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }; let nl = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!ink[i]) continue; const nb = []; if (x > 0 && lab[i - 1]) nb.push(lab[i - 1]); if (y > 0) { if (lab[i - w]) nb.push(lab[i - w]); if (x > 0 && lab[i - w - 1]) nb.push(lab[i - w - 1]); if (x < w - 1 && lab[i - w + 1]) nb.push(lab[i - w + 1]); }
      if (!nb.length) { par.push(++nl); lab[i] = nl; } else { let m = nb[0]; for (const q of nb) if (q < m) m = q; lab[i] = m; for (const q of nb) { const a = find(q), b = find(m); if (a !== b) par[Math.max(a, b)] = Math.min(a, b); } } }
    const comp = new Map(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!lab[i]) continue; const id = find(lab[i]); let c = comp.get(id); if (!c) { c = { x0: x, x1: x, y0: y, y1: y, n: 0 }; comp.set(id, c); } if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; c.n++; }
    const letters = [], dots = []; for (const c of comp.values()) { c.w = c.x1 - c.x0 + 1; c.h = c.y1 - c.y0 + 1; if (c.n < 3) continue; if (c.h > Math.min(0.28 * h, 0.16 * w) || c.w > 0.9 * w) continue; if (c.w > 30 * c.h && c.h < 4) continue; if (c.h >= 6 && c.n / (c.w * c.h) > .03) letters.push(c); else dots.push(c); }
    letters.sort((a, b) => a.y0 - b.y0); const lp = letters.map((_, i) => i), lf = a => { while (lp[a] !== a) { lp[a] = lp[lp[a]]; a = lp[a]; } return a; };
    for (let i = 0; i < letters.length; i++) { const a = letters[i]; for (let j = i + 1; j < letters.length; j++) { const b = letters[j]; if (b.y0 > a.y1) break;
      const ov = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1, mh = Math.min(a.h, b.h), Mh = Math.max(a.h, b.h), gap = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
      if (ov >= .5 * mh && gap <= .9 * mh + 6 && Mh <= 2.4 * mh + 6) lp[lf(j)] = lf(i); } }
    const groups = new Map(); letters.forEach((c, i) => { const id = lf(i); let g = groups.get(id); if (!g) { g = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0, ink: 0, mh: 0, hs: [] }; groups.set(id, g); } g.mh = Math.max(g.mh, c.h); g.hs.push(c.h); g.x0 = Math.min(g.x0, c.x0); g.x1 = Math.max(g.x1, c.x1); g.y0 = Math.min(g.y0, c.y0); g.y1 = Math.max(g.y1, c.y1); g.n++; g.ink += c.n; });
    const out = []; for (const g of groups.values()) {
      let gh = g.y1 - g.y0 + 1; const gw = g.x1 - g.x0 + 1;
      if (g.n < 3 && gw < 3 * gh) continue; if (gw < 1.8 * gh) continue; if (gh > 0.22 * h || gh < 6) continue; if (gh > 1.4 * g.mh + 8) continue;      // سطر واحد: ارتفاعه قريب من أطول حرف فيه (يرفض دمج سطرين أو كتلة صورة)
      const my = gh * .38; for (const d of dots) { const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2; if (cx >= g.x0 - 2 && cx <= g.x1 + 2 && cy >= g.y0 - my && cy <= g.y1 + my) { g.y0 = Math.min(g.y0, d.y0); g.y1 = Math.max(g.y1, d.y1); } }      // نقاط وحركات الحروف
      gh = g.y1 - g.y0 + 1; const dens = g.ink / (gw * gh); if (dens < .04 || dens > .92 || g.n > 160) continue;
      const k = 1 / sc, p = 3; out.push({ x0: Math.max(0, Math.floor(g.x0 * k) - p), y0: Math.max(0, Math.floor(g.y0 * k) - p), x1: Math.min(W0, Math.ceil((g.x1 + 1) * k) + p), y1: Math.min(H0, Math.ceil((g.y1 + 1) * k) + p), n: g.n });
    }
    out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0); return out;
  }
  /* فرشاة (مثل Magic Eraser): تمسح كل ما تحت الضربات بترميم «المتبقي عن سطح الخلفية» المقدَّر من محيطها */
  function eraseBrush(ctx, pts, rad) {
    const CW = ctx.canvas.width, CH = ctx.canvas.height; let mnx = 1e9, mny = 1e9, mxx = -1, mxy = -1; pts.forEach(p => { mnx = Math.min(mnx, p[0]); mny = Math.min(mny, p[1]); mxx = Math.max(mxx, p[0]); mxy = Math.max(mxy, p[1]); });
    const pad = Math.max(12, Math.round(rad * 2)), px0 = Math.max(0, Math.floor(mnx - rad - pad)), py0 = Math.max(0, Math.floor(mny - rad - pad)), px1 = Math.min(CW, Math.ceil(mxx + rad + pad)), py1 = Math.min(CH, Math.ceil(mxy + rad + pad)), pw = px1 - px0, ph = py1 - py0; if (pw < 4 || ph < 4) return 0;
    const mc = document.createElement("canvas"); mc.width = pw; mc.height = ph; const mg = mc.getContext("2d"); mg.strokeStyle = mg.fillStyle = "#000"; mg.lineWidth = rad * 2; mg.lineCap = mg.lineJoin = "round"; mg.beginPath(); pts.forEach((p, i) => { i ? mg.lineTo(p[0] - px0, p[1] - py0) : mg.moveTo(p[0] - px0, p[1] - py0); }); if (pts.length === 1) { mg.arc(pts[0][0] - px0, pts[0][1] - py0, rad, 0, 7); mg.fill(); } else mg.stroke();
    const ma = mg.getImageData(0, 0, pw, ph).data, m2 = new Uint8Array(pw * ph); let cnt = 0; for (let i = 0; i < pw * ph; i++) if (ma[i * 4 + 3] > 70) { m2[i] = 1; cnt++; } if (!cnt) return 0;
    const img = ctx.getImageData(px0, py0, pw, ph), D = img.data, ring = [], step = Math.max(1, Math.floor(Math.sqrt(pw * ph / 2500)));
    for (let y = 0; y < ph; y += step) for (let x = 0; x < pw; x += step) if (!m2[y * pw + x]) { const i = (y * pw + x) * 4; ring.push([x, y, D[i], D[i + 1], D[i + 2]]); }
    if (ring.length < 12) return 0; const pl = [0, 1, 2].map(ch => fitPlane(ring, ch)), at = (x, y, ch) => pl[ch][0] + pl[ch][1] * x + pl[ch][2] * y;
    const known = new Uint8Array(pw * ph), v = new Float32Array(pw * ph * 3); for (let i = 0; i < pw * ph; i++) { known[i] = m2[i] ? 0 : 1; const x = i % pw, y = (i / pw) | 0; for (let k = 0; k < 3; k++) v[i * 3 + k] = D[i * 4 + k] - at(x, y, k); }
    pushPull(v, known, pw, ph);
    for (let i = 0; i < pw * ph; i++) if (m2[i]) { const x = i % pw, y = (i / pw) | 0; for (let k = 0; k < 3; k++) D[i * 4 + k] = Math.max(0, Math.min(255, Math.round(v[i * 3 + k] + at(x, y, k)))); D[i * 4 + 3] = 255; }
    ctx.putImageData(img, px0, py0); return cnt;
  }

  /* لون الحبر وخلفيته لصندوق: الخلفية = وسيط حلقة محيطة، الحبر = متوسط أبعد 6% بكسلاً عنها (يُحسب قبل المسح) */
  function inkColor(ctx, b) {
    const W = ctx.canvas.width, H = ctx.canvas.height, pad = Math.max(8, Math.round((b.y1 - b.y0) * .3)), x0 = Math.max(0, Math.floor(b.x0 - pad)), y0 = Math.max(0, Math.floor(b.y0 - pad)), x1 = Math.min(W, Math.ceil(b.x1 + pad)), y1 = Math.min(H, Math.ceil(b.y1 + pad)), bw = x1 - x0, bh = y1 - y0;
    if (bw < 4 || bh < 4) return { ink: "#111827", bg: "#ffffff" };
    const d = ctx.getImageData(x0, y0, bw, bh).data, at = (x, y) => { const i = (y * bw + x) * 4; return [d[i], d[i + 1], d[i + 2]]; }, ring = [];
    for (let x = 0; x < bw; x++) { ring.push(at(x, 0), at(x, bh - 1)); } for (let y = 0; y < bh; y++) { ring.push(at(0, y), at(bw - 1, y)); }
    const med = i => { const a = ring.map(p => p[i]).sort((p, q) => p - q); return a[a.length >> 1]; }, bg = [med(0), med(1), med(2)], dist = p => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);
    const inner = []; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) inner.push(at(x, y)); inner.sort((p, q) => dist(q) - dist(p));
    const top = inner.slice(0, Math.max(1, Math.round(inner.length * .06))), ink = [0, 1, 2].map(i => Math.round(top.reduce((a, p) => a + p[i], 0) / top.length)), hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
    return { ink: hex(ink), bg: hex(bg) };
  }
  /* صندوق «قلب» الحروف: بكسلات أقرب للحبر من الخلفية (يستبعد الظل/التوهّج) — لتقدير حجم الخط بدقة */
  function coreBox(ctx, b, ink, bg) {
    const x0 = Math.max(0, Math.floor(b.x0)), y0 = Math.max(0, Math.floor(b.y0)), x1 = Math.min(ctx.canvas.width, Math.ceil(b.x1)), y1 = Math.min(ctx.canvas.height, Math.ceil(b.y1)), w = x1 - x0, h = y1 - y0; if (w < 4 || h < 4) return b;
    const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), I = hx(ink), B = hx(bg), full = Math.abs(I[0] - B[0]) + Math.abs(I[1] - B[1]) + Math.abs(I[2] - B[2]); if (full < 60) return b;
    const d = ctx.getImageData(x0, y0, w, h).data; let mnx = w, mxx = -1, mny = h, mxy = -1, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, di = Math.abs(d[i] - I[0]) + Math.abs(d[i + 1] - I[1]) + Math.abs(d[i + 2] - I[2]); if (di < full * .38) { n++; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; } }
    return n < 8 ? b : { x0: x0 + mnx, x1: x0 + mxx + 1, y0: y0 + mny, y1: y0 + mxy + 1 };
  }

  /* ───── الالتقاط السحري: كشف العناصر (صور/منتجات/أيقونات/زخارف) وقصّها بشفافية ─────
     نكشف «الحواف الحادة» (التوهّج والتدرّج والظلال الناعمة لا حواف لها) ← نغلق الخطوط بتوسيع طفيف ← ما لا يصله الخارج من حدود الصورة = داخل عنصر
     (فيُملأ حتى لو شابه لون الخلفية) ← مكوّنات متصلة = عناصر. ثم نقصّ كل عنصر RGBA بحافة ناعمة ونزيل تلوّث لون الخلفية عن الحواف. */
  function bandModels(cv, bandH) {
    const W = cv.width, H = cv.height, g = cv.getContext("2d", { willReadFrequently: true }), models = [];
    for (let y0 = 0; y0 < H; y0 += bandH) {
      const h = Math.min(bandH, H - y0), d = g.getImageData(0, y0, W, h).data, S = [], st = Math.max(1, Math.floor(Math.sqrt(W * h / 3500)));
      for (let y = 0; y < h; y += st) for (let x = 0; x < W; x += st) { const i = (y * W + x) * 4; S.push([x, y, d[i], d[i + 1], d[i + 2]]); }
      models.push({ y0, h, pl: [0, 1, 2].map(ch => fitPlane(S, ch)) });
    }
    return models;
  }
  function sqDilate(src, w, h, r) {                                // توسيع مربع قابل للفصل
    const t = new Uint8Array(w * h), o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { let last = -1e9; for (let x = 0; x < w; x++) { if (src[y * w + x]) last = x; if (x - last <= r) t[y * w + x] = 1; } last = 1e9; for (let x = w - 1; x >= 0; x--) { if (src[y * w + x]) last = x; if (last - x <= r) t[y * w + x] = 1; } }
    for (let x = 0; x < w; x++) { let last = -1e9; for (let y = 0; y < h; y++) { if (t[y * w + x]) last = y; if (y - last <= r) o[y * w + x] = 1; } last = 1e9; for (let y = h - 1; y >= 0; y--) { if (t[y * w + x]) last = y; if (last - y <= r) o[y * w + x] = 1; } }
    return o;
  }
  function findObjects(cv, opt) {
    opt = opt || {}; const W = cv.width, H = cv.height, N = W * H, g = cv.getContext("2d", { willReadFrequently: true }), D = g.getImageData(0, 0, W, H).data, Te = opt.edge || 10;
    const models = bandModels(cv, 160), bgc = new Uint8ClampedArray(N * 3);
    for (const m of models) for (let y = 0; y < m.h; y++) for (let x = 0; x < W; x++) { const i = (m.y0 + y) * W + x; for (let k = 0; k < 3; k++) bgc[i * 3 + k] = m.pl[k][0] + m.pl[k][1] * x + m.pl[k][2] * y; }
    const edge = new Uint8Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; let gx = 0, gy = 0; for (let k = 0; k < 3; k++) { const a = Math.abs(D[(i + 1) * 4 + k] - D[(i - 1) * 4 + k]), b = Math.abs(D[(i + W) * 4 + k] - D[(i - W) * 4 + k]); if (a > gx) gx = a; if (b > gy) gy = b; } if ((gx + gy) / 2 > Te) edge[i] = 1; }
    const E2 = sqDilate(edge, W, H, opt.close || 2), vis = new Uint8Array(N), stack = new Int32Array(N); let sp = 0;      // الخارج = ما يصله حدّ الصورة عبر غير الحواف
    const push = i => { if (!vis[i] && !E2[i]) { vis[i] = 1; stack[sp++] = i; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (sp) { const i = stack[--sp], x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < N - W) push(i + W); }
    const inside = new Uint8Array(N); for (let i = 0; i < N; i++) inside[i] = vis[i] ? 0 : 1;
    const k = Math.max(1, Math.ceil(W / 540)), sw = Math.ceil(W / k), sh = Math.ceil(H / k), sm = new Uint8Array(sw * sh);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside[y * W + x]) sm[((y / k) | 0) * sw + ((x / k) | 0)] = 1;
    const dil = sqDilate(sm, sw, sh, opt.gap || 4), lab = new Int32Array(sw * sh), par = [0]; const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }; let nl = 0;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const i = y * sw + x; if (!dil[i]) continue; const nb = []; if (x > 0 && lab[i - 1]) nb.push(lab[i - 1]); if (y > 0) { if (lab[i - sw]) nb.push(lab[i - sw]); if (x > 0 && lab[i - sw - 1]) nb.push(lab[i - sw - 1]); if (x < sw - 1 && lab[i - sw + 1]) nb.push(lab[i - sw + 1]); }
      if (!nb.length) { par.push(++nl); lab[i] = nl; } else { let m = nb[0]; for (const q of nb) if (q < m) m = q; lab[i] = m; for (const q of nb) { const a = find(q), b = find(m); if (a !== b) par[Math.max(a, b)] = Math.min(a, b); } } }
    const comps = new Map(); for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const i = y * sw + x; if (!lab[i]) continue; const id = find(lab[i]); lab[i] = id; let c = comps.get(id); if (!c) { c = { id, x0: x, x1: x, y0: y, y1: y, n: 0 }; comps.set(id, c); } c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y); if (sm[i]) c.n++; }
    const minA = (opt.minArea || .0008) * sw * sh, out = [];
    for (const c of comps.values()) {
      const bw = (c.x1 - c.x0 + 1) * k, bh = (c.y1 - c.y0 + 1) * k; if (c.n < minA || bw < 24 || bh < 24) continue; if (bw > W * .97 && bh > H * .6) continue;
      out.push({ id: c.id, x0: Math.max(0, c.x0 * k), y0: Math.max(0, c.y0 * k), x1: Math.min(W, (c.x1 + 1) * k), y1: Math.min(H, (c.y1 + 1) * k), area: c.n });
    }
    out.sort((a, b) => b.area - a.area); return { objects: out.slice(0, opt.max || 40), W, H, k, sw, lab, inside, bgc, D };
  }
  /* يقصّ عنصراً RGBA: ألفا = داخل العنصر مع تنعيم 3×3 للحافة + إزالة تلوّث الخلفية؛ يعيد {canvas, mask} */
  function cutObject(F, o) {
    const W = F.W, w = o.x1 - o.x0, h = o.y1 - o.y0, a0 = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = o.x0 + x, gy = o.y0 + y; if (F.inside[gy * W + gx] && F.lab[((gy / F.k) | 0) * F.sw + ((gx / F.k) | 0)] === o.id) a0[y * w + x] = 1; }
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const cg = cv.getContext("2d"), img = cg.createImageData(w, h), m = new Uint8Array(w * h); let cnt = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) { n++; continue; } s += a0[yy * w + xx]; n++; }
      const al = a0[y * w + x] ? Math.max(.5, s / n) : s / n * .5; if (al < .08) continue; const li = y * w + x, gi = (o.y0 + y) * W + (o.x0 + x); m[li] = 1; cnt++;
      for (let c = 0; c < 3; c++) { const p = F.D[gi * 4 + c], b = F.bgc[gi * 3 + c]; img.data[li * 4 + c] = al < .98 ? Math.max(0, Math.min(255, b + (p - b) / al)) : p; } img.data[li * 4 + 3] = Math.round(Math.min(1, al) * 255);
    }
    cg.putImageData(img, 0, 0); return { canvas: cv, mask: m, w, h, filled: cnt };
  }
  /* يملأ منطقة مقنّعة بترميم «المتبقي عن سطح الخلفية» (نفس منطق الفرشاة) */
  function fillMask(ctx, px0, py0, pw, ph, m2) {
    const img = ctx.getImageData(px0, py0, pw, ph), D = img.data, ring = [], step = Math.max(1, Math.floor(Math.sqrt(pw * ph / 3000)));
    for (let y = 0; y < ph; y += step) for (let x = 0; x < pw; x += step) if (!m2[y * pw + x]) { const i = (y * pw + x) * 4; ring.push([x, y, D[i], D[i + 1], D[i + 2]]); }
    if (ring.length < 12) return false; const pl = [0, 1, 2].map(ch => fitPlane(ring, ch)), at = (x, y, ch) => pl[ch][0] + pl[ch][1] * x + pl[ch][2] * y;
    const known = new Uint8Array(pw * ph), v = new Float32Array(pw * ph * 3); for (let i = 0; i < pw * ph; i++) { known[i] = m2[i] ? 0 : 1; const x = i % pw, y = (i / pw) | 0; for (let k = 0; k < 3; k++) v[i * 3 + k] = D[i * 4 + k] - at(x, y, k); }
    pushPull(v, known, pw, ph);
    for (let i = 0; i < pw * ph; i++) if (m2[i]) { const x = i % pw, y = (i / pw) | 0; for (let k = 0; k < 3; k++) D[i * 4 + k] = Math.max(0, Math.min(255, Math.round(v[i * 3 + k] + at(x, y, k)))); D[i * 4 + 3] = 255; }
    ctx.putImageData(img, px0, py0); return true;
  }
  /* يمسح عنصراً مقتطعاً من الخلفية: قناعه موسَّع قليلاً (هالة/ظل) داخل نافذة بهامش كافٍ */
  function eraseObject(ctx, o, cut, grow, F) {
    grow = grow == null ? 5 : grow; const reach = 44, CW = ctx.canvas.width, CH = ctx.canvas.height, pad = Math.max(reach + 8, Math.round(Math.max(cut.w, cut.h) * .12)), px0 = Math.max(0, o.x0 - pad), py0 = Math.max(0, o.y0 - pad), px1 = Math.min(CW, o.x1 + pad), py1 = Math.min(CH, o.y1 + pad), pw = px1 - px0, ph = py1 - py0;
    const base = new Uint8Array(pw * ph); for (let y = 0; y < cut.h; y++) for (let x = 0; x < cut.w; x++) if (cut.mask[y * cut.w + x]) base[(o.y0 - py0 + y) * pw + (o.x0 - px0 + x)] = 1;
    const m2 = sqDilate(base, pw, ph, grow);
    if (F) {                                                       // الظل/التوهّج الملاصق: ما يبعد عن سطح الخلفية ويقع قرب العنصر يُمسح معه
      const near = sqDilate(base, pw, ph, reach), W = F.W;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const i = y * pw + x; if (m2[i] || !near[i]) continue; const gi = (py0 + y) * W + (px0 + x); if (Math.abs(F.D[gi * 4] - F.bgc[gi * 3]) + Math.abs(F.D[gi * 4 + 1] - F.bgc[gi * 3 + 1]) + Math.abs(F.D[gi * 4 + 2] - F.bgc[gi * 3 + 2]) > 9) m2[i] = 1; }
    }
    return fillMask(ctx, px0, py0, pw, ph, m2);
  }
  return { fitPlane, pushPull, eraseRects, detectText, eraseBrush, inkColor, coreBox, findObjects, cutObject, eraseObject, fillMask };
})();
