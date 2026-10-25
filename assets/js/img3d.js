/* صور 2D ← مجسّم 3D (Img3D) — يجمع صورتين أو ثلاثاً (أمامي + جانبي + خلفي/علوي) في مجسّم ثلاثي الأبعاد حقيقي بلا «إكستريود».
   الطريقة المحلية (بلا مفتاح): لكل صفّ من الارتفاع نستخرج عرض الواجهة من الصورة الأمامية وعمق الجانب من الصورة الجانبية (أو المقطع الكامل من الصورة العلوية)
   ونبني حلقة مقطع بيضاوية/مستطيلة/من الصورة العلوية ← شبكة ملتفّة (loft) بنسيجين: نصف أمامي من الصورة الأمامية ونصف خلفي من الصورة الخلفية.
   إن لم تكفِ النتيجة: زر «بناء عبر Alyssum API» (ImgGen.model3d) ويعرض ملف GLB الناتج بقارئ GLB مصغّر هنا. بلا مكتبات خارجية عدا three المحلية. */
const Img3D = (() => {
  "use strict";
  const $ = id => document.getElementById(id), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const canv = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  let T = null, opened = false, R = null, scene = null, cam = null, pivot = null, blob = null, raf = 0, dirty = true, escH = null, onCloseCb = null;
  const view = { yaw: -0.5, pitch: 0.16, zoom: 1 };
  const S = { f: null, s: null, b: null, t: null, third: "back", sec: "auto", depthR: 0.6, bg: "light", auto: true, model: null, conf: 0 };
  async function loadThree() { if (T) return T; T = await import(new URL("assets/js/vendor/three.module.min.js", document.baseURI).href); return T; }
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };

  /* ═══ معالجة الصور ═══ */
  async function fileToCanvas(file, max) {
    max = max || 1100; let bm;
    try { bm = await createImageBitmap(file); } catch (e) { bm = await new Promise((res, rej) => { const im = new Image(), u = URL.createObjectURL(file); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; }); }
    const w = bm.width || bm.naturalWidth, h = bm.height || bm.naturalHeight, k = Math.min(1, max / Math.max(w, h)), c = canv(w * k, h * k); c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height); return c;
  }
  /* فصل خلفية متجانسة من الحواف (احتياط عند غياب أداة نزع الخلفية): لون الحواف الوسيط + فيض من الحدود + أكبر مكوّن */
  function localCut(cv) {
    const w = cv.width, h = cv.height, x = cv.getContext("2d"), im = x.getImageData(0, 0, w, h), d = im.data, N = w * h;
    const ed = []; for (let i = 0; i < w; i++) { ed.push(i, (h - 1) * w + i); } for (let j = 0; j < h; j++) { ed.push(j * w, j * w + w - 1); }
    const med = ch => { const a = ed.map(p => d[p * 4 + ch]).sort((p, q) => p - q); return a[a.length >> 1]; }, br = med(0), bg = med(1), bb = med(2);
    let dev = 0; ed.forEach(p => { dev += Math.abs(d[p * 4] - br) + Math.abs(d[p * 4 + 1] - bg) + Math.abs(d[p * 4 + 2] - bb); }); dev /= ed.length * 3;
    const tol = clamp(36 + dev * 2, 34, 90), isBg = p => (Math.abs(d[p * 4] - br) + Math.abs(d[p * 4 + 1] - bg) + Math.abs(d[p * 4 + 2] - bb)) / 3 < tol || d[p * 4 + 3] < 20;
    const back = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
    const seed = p => { if (!back[p] && isBg(p)) { back[p] = 1; q[qt++] = p; } }; ed.forEach(seed);
    while (qh < qt) { const p = q[qh++], px = p % w, py = (p / w) | 0; if (px > 0) seed(p - 1); if (px < w - 1) seed(p + 1); if (py > 0) seed(p - w); if (py < h - 1) seed(p + w); }
    /* أكبر مكوّن أمامي */
    const lab = new Int32Array(N), sizes = [0]; let nl = 0;
    for (let s = 0; s < N; s++) {
      if (back[s] || lab[s]) continue; nl++; sizes[nl] = 0; qh = qt = 0; q[qt++] = s; lab[s] = nl;
      while (qh < qt) { const p = q[qh++]; sizes[nl]++; const px = p % w, py = (p / w) | 0; const nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]; for (const m of nb) if (m >= 0 && !back[m] && !lab[m]) { lab[m] = nl; q[qt++] = m; } }
    }
    let best = 0; for (let i = 1; i <= nl; i++) if (sizes[i] > sizes[best] || !best) best = i;
    const out = canv(w, h), ox = out.getContext("2d"), oi = ox.createImageData(w, h);
    for (let p = 0; p < N; p++) { const keep = best && lab[p] === best; oi.data[p * 4] = d[p * 4]; oi.data[p * 4 + 1] = d[p * 4 + 1]; oi.data[p * 4 + 2] = d[p * 4 + 2]; oi.data[p * 4 + 3] = keep ? 255 : 0; }
    ox.putImageData(oi, 0, 0); return out;
  }
  async function cutFor(cv) {
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let tr = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) tr++;
    if (tr / (d.length / 4) > 0.03) return { canvas: cv, how: "alpha" };
    if (typeof PBBgRemove !== "undefined" && PBBgRemove.autoCut) { try { const r = await PBBgRemove.autoCut(cv, { methods: ["classic"] }); if (r && r.canvas) return { canvas: r.canvas, how: "classic" }; } catch (e) { } }
    return { canvas: localCut(cv), how: "local" };
  }
  /* معلومات القناع: صندوق + أطراف كل صف */
  function analyze(cut) {
    const w = cut.width, h = cut.height, d = cut.getContext("2d").getImageData(0, 0, w, h).data, L = new Float32Array(h).fill(NaN), Rr = new Float32Array(h).fill(NaN);
    let x0 = w, x1 = -1, y0 = h, y1 = -1, cnt = 0;
    for (let y = 0; y < h; y++) { let l = -1, r = -1; for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; cnt++; } if (l >= 0) { L[y] = l; Rr[y] = r + 1; if (l < x0) x0 = l; if (r + 1 > x1) x1 = r + 1; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (y1 < y0) return { empty: true, w, h, cov: 0 };
    return { cut, w, h, x0, x1, y0, y1, bw: x1 - x0, bh: y1 - y0 + 1, L, Rr, cov: cnt / (w * h), fill: cnt / ((x1 - x0) * (y1 - y0 + 1)), alpha: d };
  }
  /* سلسلة (يسار، يمين) في n نقطة موزّعة على ارتفاع القناع، مع ملء الفجوات وتنعيم */
  function series(info, n) {
    const a = new Float64Array(n), b = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const y = info.y0 + (i / (n - 1)) * (info.y1 - info.y0); let l = NaN, r = NaN;
      for (let dd = 0; dd <= 3 && isNaN(l); dd++) for (const sg of dd ? [1, -1] : [0]) { const yy = Math.round(y) + sg * dd; if (yy >= 0 && yy < info.h && !isNaN(info.L[yy])) { l = info.L[yy]; r = info.Rr[yy]; break; } }
      a[i] = l; b[i] = r;
    }
    const fill = z => { let last = -1; for (let i = 0; i < n; i++) { if (!isNaN(z[i])) { if (last >= 0 && i - last > 1) for (let k = last + 1; k < i; k++) z[k] = z[last] + (z[i] - z[last]) * (k - last) / (i - last); else if (last < 0) for (let k = 0; k < i; k++) z[k] = z[i]; last = i; } } for (let k = last + 1; k < n; k++) z[k] = z[last]; };
    fill(a); fill(b);
    const sm = z => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < n) { s += z[j]; c++; } } o[i] = s / c; } return o; };
    return [sm(a), sm(b)];
  }
  /* جدول المقطع من الصورة العلوية: نصف قطر لكل زاوية φ (x=cos، z=sin، و+z نحو المشاهد = أسفل الصورة) */
  function outline(info, K) {
    const cx = (info.x0 + info.x1) / 2, cy = (info.y0 + info.y1 + 1) / 2, hw = info.bw / 2, hd = info.bh / 2, out = [];
    for (let j = 0; j < K; j++) {
      const ph = j / K * 2 * Math.PI, c = Math.cos(ph), s = Math.sin(ph); let r = 0;
      for (let t = 0; t < Math.max(info.w, info.h); t += 0.5) { const px = Math.round(cx + c * t), py = Math.round(cy + s * t); if (px < 0 || py < 0 || px >= info.w || py >= info.h) break; if (info.alpha[(py * info.w + px) * 4 + 3] > 128) r = t; }
      out.push([c * r / hw, s * r / hd]);
    }
    const sm = out.map((_, j) => { let sx = 0, sz = 0; for (let k = -2; k <= 2; k++) { const o = out[(j + k + K) % K]; sx += o[0]; sz += o[1]; } return [clamp(sx / 5, -1, 1), clamp(sz / 5, -1, 1)]; });
    return sm;
  }
  /* تمديد ألوان النسيج إلى الأطراف الشفافة ثم تعتيم الألفا (يمنع هالة الخلفية عند أطراف المجسّم) */
  function bleed(cut) {
    const w = cut.width, h = cut.height, x = cut.getContext("2d"), im = x.getImageData(0, 0, w, h), d = im.data, have = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) have[p] = d[p * 4 + 3] > 128 ? 1 : 0;
    for (let pass = 0; pass < 6; pass++) {
      const nh = have.slice();
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const p = y * w + xx; if (have[p]) continue; let r = 0, g = 0, b = 0, c = 0; for (const q of [xx > 0 ? p - 1 : -1, xx < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && have[q]) { r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; c++; } if (c) { d[p * 4] = r / c; d[p * 4 + 1] = g / c; d[p * 4 + 2] = b / c; nh[p] = 1; } }
      have.set(nh);
    }
    for (let p = 0; p < w * h; p++) d[p * 4 + 3] = 255; const o = canv(w, h); o.getContext("2d").putImageData(im, 0, 0); return o;
  }
  function avgColor(info, y0f, y1f) {
    const d = info.alpha, w = info.w; let r = 0, g = 0, b = 0, c = 0, ya = Math.round(info.y0 + y0f * (info.y1 - info.y0)), yb = Math.round(info.y0 + y1f * (info.y1 - info.y0));
    for (let y = ya; y <= yb; y++) for (let x = info.x0; x < info.x1; x++) { const p = (y * w + x) * 4; if (d[p + 3] > 128) { r += d[p]; g += d[p + 1]; b += d[p + 2]; c++; } }
    return c ? [r / c, g / c, b / c] : [180, 180, 180];
  }

  /* ═══ بناء المجسّم (loft) ═══ */
  function plan(F, Sd, Tp, opt) {
    const n = opt.rows, H = F.bh; const [fl, fr] = series(F, n); const wx = [], cx = [];
    for (let i = 0; i < n; i++) { wx.push(Math.max(0.004, (fr[i] - fl[i]) / H)); cx.push(((fl[i] + fr[i]) / 2 - F.x0) / H); }
    const wz = [], cz = []; let how = "ratio";
    if (Sd) { const k = F.bh / Sd.bh, [sl, sr] = series(Sd, n), mid = (Sd.x0 + Sd.x1) / 2; for (let i = 0; i < n; i++) { wz.push(Math.max(0.004, (sr[i] - sl[i]) * k / H)); cz.push(((sl[i] + sr[i]) / 2 - mid) * k / H); } how = "side"; }
    else if (Tp) { const k = F.bw / Tp.bw, rat = (Tp.bh * k) / F.bw; for (let i = 0; i < n; i++) { wz.push(Math.max(0.004, wx[i] * rat)); cz.push(0); } how = "top"; }
    else for (let i = 0; i < n; i++) { wz.push(Math.max(0.004, wx[i] * opt.depthR)); cz.push(0); }
    return { wx, cx, wz, cz, how, Wf: F.bw / H };
  }
  function secFn(kind, Tp, K) {
    if (kind === "top" && Tp) { const tb = outline(Tp, K); return j => tb[((j % K) + K) % K]; }
    const nExp = kind === "box" ? 10 : kind === "rrect" ? 4.6 : 2, pw = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), 2 / e);
    return j => { const ph = j / K * 2 * Math.PI; return [pw(Math.cos(ph), nExp), pw(Math.sin(ph), nExp)]; };
  }
  function correlation(a, b) { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : 1; }

  /* views = {f,s,b,t} كل منها {src,cut,info}؛ opt = {sec, depthR, rows, cols} ← {group, stats} */
  function buildModel(Tm, views, opt) {
    opt = Object.assign({ sec: "auto", depthR: 0.6, rows: 150, cols: 120 }, opt || {});
    const F = views.f && views.f.info; if (!F || F.empty) throw new Error("الصورة الأمامية بلا منتج واضح");
    const Sd = views.s && views.s.info && !views.s.info.empty ? views.s.info : null, Tp = views.t && views.t.info && !views.t.info.empty ? views.t.info : null;
    const Bk = views.b && views.b.info && !views.b.info.empty ? views.b : null;
    const P = plan(F, Sd, Tp, opt), n = opt.rows, Kh = Math.round(opt.cols / 2), K = Kh * 2;
    let kind = opt.sec;
    if (kind === "auto") kind = Tp ? "top" : (F.fill > 0.9 && (!Sd || Sd.fill > 0.9)) ? "rrect" : "ellipse";
    if (kind === "top" && !Tp) kind = "ellipse";
    const sec = secFn(kind, Tp, K);
    /* شبكة الحلقات الكاملة (للنِّسَب)، i = صف، jj = زاوية */
    const pos = new Float32Array(n * K * 3);
    for (let i = 0; i < n; i++) for (let jj = 0; jj < K; jj++) { const [sx, sz] = sec(jj), o = (i * K + jj) * 3; pos[o] = P.cx[i] + P.wx[i] / 2 * sx; pos[o + 1] = 1 - i / (n - 1); pos[o + 2] = P.cz[i] + P.wz[i] / 2 * sz; }
    const at = (i, jj) => { const o = (clamp(i, 0, n - 1) * K + ((jj % K) + K) % K) * 3; return [pos[o], pos[o + 1], pos[o + 2]]; };
    const nrm = new Float32Array(n * K * 3);
    for (let i = 0; i < n; i++) for (let jj = 0; jj < K; jj++) {
      const a = at(i, jj + 1), b = at(i, jj - 1), c = at(i + 1, jj), d = at(i - 1, jj), u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [d[0] - c[0], d[1] - c[1], d[2] - c[2]];
      let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]; const o = (i * K + jj) * 3, p = at(i, jj), axis = [P.cx[i], p[1], P.cz[i]];
      if (nx * (p[0] - axis[0]) + nz * (p[2] - axis[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; nrm[o] = nx / l; nrm[o + 1] = ny / l; nrm[o + 2] = nz / l;
    }
    /* نسيجان: أمامي من الصورة الأمامية، خلفي من الصورة الخلفية (أو الأمامية مظلّلة) */
    const frontTex = bleed(F.cut), backSrc = Bk ? Bk.info : F, backCv = bleed(backSrc.cut);
    if (!Bk) { const x = backCv.getContext("2d"); x.fillStyle = "rgba(0,0,0,.34)"; x.fillRect(0, 0, backCv.width, backCv.height); }
    const Hh = F.bh, W = F.bw / Hh;
    const half = (back) => {
      const m = Kh + 1, p = new Float32Array(n * m * 3), nn = new Float32Array(n * m * 3), uv = new Float32Array(n * m * 2), idx = [];
      for (let i = 0; i < n; i++) for (let j = 0; j <= Kh; j++) {
        const jj = back ? (Kh + j) % K : j, o = (i * K + jj) * 3, q = (i * m + j) * 3, x = pos[o], y = pos[o + 1];
        p[q] = x; p[q + 1] = y; p[q + 2] = pos[o + 2]; nn[q] = nrm[o]; nn[q + 1] = nrm[o + 1]; nn[q + 2] = nrm[o + 2];
        const t = 1 - y; let u, v;
        if (!back) { const px = x * Hh + F.x0, py = F.y0 + t * (F.bh - 1); u = px / F.w; v = 1 - py / F.h; }
        else { const nx = clamp(x / W, 0, 1), px = backSrc.x0 + (1 - nx) * (backSrc.bw - 1), py = backSrc.y0 + t * (backSrc.bh - 1); u = px / backSrc.w; v = 1 - py / backSrc.h; }
        uv[(i * m + j) * 2] = u; uv[(i * m + j) * 2 + 1] = v;
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < Kh; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; if (!back) idx.push(a, c, b, b, c, d); else idx.push(a, c, b, b, c, d); }
      return { p, nn, uv, idx };
    };
    const g = new Tm.Group(), mk = (h, tex) => {
      const geo = new Tm.BufferGeometry(); geo.setAttribute("position", new Tm.BufferAttribute(h.p, 3)); geo.setAttribute("normal", new Tm.BufferAttribute(h.nn, 3)); geo.setAttribute("uv", new Tm.BufferAttribute(h.uv, 2)); geo.setIndex(h.idx);
      const t = new Tm.CanvasTexture(tex); t.colorSpace = Tm.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
      const mt = new Tm.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.02, side: Tm.DoubleSide }); const m = new Tm.Mesh(geo, mt); m.castShadow = true; return m;
    };
    const mf = mk(half(false), frontTex), mb = mk(half(true), backCv); mf.name = "front"; mb.name = "back"; g.add(mf, mb);
    /* أغطية */
    const cap = (i, up) => {
      const ring = []; for (let jj = 0; jj < K; jj++) ring.push(at(i, jj)); const c = [P.cx[i], 1 - i / (n - 1), P.cz[i]], pp = [c[0], c[1], c[2]]; ring.forEach(r => pp.push(r[0], r[1], r[2]));
      const idx = []; for (let jj = 0; jj < K; jj++) { const a = 1 + jj, b = 1 + (jj + 1) % K; if (up) idx.push(0, b, a); else idx.push(0, a, b); }
      const nm = []; for (let k = 0; k < K + 1; k++) nm.push(0, up ? 1 : -1, 0);
      const geo = new Tm.BufferGeometry(); geo.setAttribute("position", new Tm.BufferAttribute(new Float32Array(pp), 3)); geo.setAttribute("normal", new Tm.BufferAttribute(new Float32Array(nm), 3)); geo.setIndex(idx);
      const col = avgColor(F, up ? 0 : 0.94, up ? 0.06 : 1), mt = new Tm.MeshStandardMaterial({ color: new Tm.Color(col[0] / 255, col[1] / 255, col[2] / 255).convertSRGBToLinear(), roughness: 0.6, side: Tm.DoubleSide }); const m = new Tm.Mesh(geo, mt); m.name = up ? "cap-top" : "cap-bottom"; return m;
    };
    const maxW = Math.max(...P.wx);
    if (P.wx[0] > maxW * 0.05) g.add(cap(0, true)); if (P.wx[n - 1] > maxW * 0.05) g.add(cap(n - 1, false));
    g.position.x = -W / 2;
    /* مؤشرات الثقة */
    const issues = []; let score = 100;
    if (F.cov < 0.04 || F.cov > 0.97) { issues.push("فصل الخلفية عن الصورة الأمامية غير مقنع"); score -= 45; }
    if (Sd) {
      const corr = correlation(P.wx, P.wz); if (corr < 0.3) { issues.push("الصورتان تبدوان من منتجين/زاويتين مختلفتين"); score -= 30; } else if (corr < 0.6) { issues.push("تباين كبير بين مقطع الواجهة والجانب"); score -= 12; }
      const ar = (F.bw / F.bh) / (Sd.bw / Sd.bh); if (ar > 6 || ar < 1 / 6) { issues.push("نسب الصورتين متباعدة جداً"); score -= 15; }
    } else if (!Tp) { issues.push("لا صورة جانبية: العمق تقديري"); score -= 18; }
    if (!Bk) { issues.push("لا صورة خلفية: الخلف مظلّل من الواجهة"); score -= 8; }
    return { group: g, stats: { kind, how: P.how, rows: n, cols: K, score: clamp(score, 0, 100), issues, vertices: (n * (Kh + 1)) * 2, textures: { front: frontTex, back: backCv }, height: 1, width: W, depth: Math.max(...P.wz) } };
  }

  /* ═══ قارئ GLB مصغّر (للنتيجة القادمة من الخدمة) ═══ */
  const CT = { 5120: [Int8Array, 1, 127], 5121: [Uint8Array, 1, 255], 5122: [Int16Array, 2, 32767], 5123: [Uint16Array, 2, 65535], 5125: [Uint32Array, 4, 0], 5126: [Float32Array, 4, 0] }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  async function loadGLB(Tm, ab) {
    const dv = new DataView(ab); if (dv.byteLength < 20 || dv.getUint32(0, true) !== 0x46546C67) throw new Error("ملف المجسّم غير صالح");
    let off = 12, json = null, bin = null;
    while (off + 8 <= ab.byteLength) { const len = dv.getUint32(off, true), ty = dv.getUint32(off + 4, true), data = ab.slice(off + 8, off + 8 + len); if (ty === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data)); else if (ty === 0x004E4942) bin = data; off += 8 + len; }
    if (!json) throw new Error("ملف المجسّم بلا بنية");
    const req = json.extensionsRequired || []; if (req.some(e => /draco|meshopt/i.test(e))) throw new Error("المجسّم مضغوط بصيغة لا يدعمها العارض هنا");
    const viewBytes = i => { const bv = json.bufferViews[i]; return new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength); };
    const acc = (i, forceF32) => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView], [Arr, sz, nmax] = CT[a.componentType], nc = NC[a.type], stride = bv.byteStride || sz * nc, base = (bv.byteOffset || 0) + (a.byteOffset || 0), cnt = a.count;
      const out = new (forceF32 ? Float32Array : Arr)(cnt * nc), dvb = new DataView(bin);
      const rd = (o) => { switch (a.componentType) { case 5120: return dvb.getInt8(o); case 5121: return dvb.getUint8(o); case 5122: return dvb.getInt16(o, true); case 5123: return dvb.getUint16(o, true); case 5125: return dvb.getUint32(o, true); default: return dvb.getFloat32(o, true); } };
      for (let e = 0; e < cnt; e++) for (let c = 0; c < nc; c++) { let v = rd(base + e * stride + c * sz); if (forceF32 && a.normalized && nmax) v = Math.max(v / nmax, -1); out[e * nc + c] = v; }
      return { arr: out, nc, count: cnt };
    };
    const texCache = {}, tex = async ti => {
      if (ti == null) return null; if (texCache[ti]) return texCache[ti]; const t = json.textures[ti], im = json.images[t.source]; let blobI;
      if (im.bufferView != null) blobI = new Blob([viewBytes(im.bufferView)], { type: im.mimeType || "image/png" }); else if (im.uri && /^data:/.test(im.uri)) blobI = await (await fetch(im.uri)).blob(); else return null;
      const bm = await createImageBitmap(blobI), tt = new Tm.Texture(bm); tt.flipY = false; tt.colorSpace = Tm.SRGBColorSpace; tt.wrapS = tt.wrapT = Tm.RepeatWrapping; tt.needsUpdate = true; return (texCache[ti] = tt);
    };
    const mats = []; for (const m of json.materials || [{}]) {
      const pb = m.pbrMetallicRoughness || {}, bc = pb.baseColorFactor || [1, 1, 1, 1], map = await tex(pb.baseColorTexture && pb.baseColorTexture.index);
      const mt = new Tm.MeshStandardMaterial({ map: map || null, color: new Tm.Color(bc[0], bc[1], bc[2]), roughness: pb.roughnessFactor == null ? 0.7 : pb.roughnessFactor, metalness: pb.metallicFactor == null ? 0 : pb.metallicFactor, side: Tm.DoubleSide });
      if (bc[3] < 1 || m.alphaMode === "BLEND") { mt.transparent = true; mt.opacity = bc[3]; } mats.push(mt);
    }
    const meshes = (json.meshes || []).map(me => me.primitives.filter(p => p.mode == null || p.mode === 4).map(p => {
      const geo = new Tm.BufferGeometry(), at = p.attributes; if (at.POSITION == null) return null;
      const pa = acc(at.POSITION, true); geo.setAttribute("position", new Tm.BufferAttribute(pa.arr, 3));
      if (at.NORMAL != null) geo.setAttribute("normal", new Tm.BufferAttribute(acc(at.NORMAL, true).arr, 3));
      if (at.TEXCOORD_0 != null) geo.setAttribute("uv", new Tm.BufferAttribute(acc(at.TEXCOORD_0, true).arr, 2));
      let vc = false; if (at.COLOR_0 != null) { const c = acc(at.COLOR_0, true); geo.setAttribute("color", new Tm.BufferAttribute(c.arr, c.nc)); vc = true; }
      if (p.indices != null) { const ia = acc(p.indices); geo.setIndex(new Tm.BufferAttribute(ia.arr instanceof Uint32Array ? ia.arr : Uint32Array.from(ia.arr), 1)); }
      if (!at.NORMAL) geo.computeVertexNormals();
      const mt = (mats[p.material == null ? 0 : p.material] || mats[0]); if (vc) { mt.vertexColors = true; }
      const m = new Tm.Mesh(geo, mt); m.castShadow = true; return m;
    }).filter(Boolean));
    const root = new Tm.Group(), node = (ni) => {
      const nd = json.nodes[ni], o = new Tm.Group(); if (nd.matrix) o.applyMatrix4(new Tm.Matrix4().fromArray(nd.matrix)); else { if (nd.translation) o.position.fromArray(nd.translation); if (nd.rotation) o.quaternion.fromArray(nd.rotation); if (nd.scale) o.scale.fromArray(nd.scale); }
      if (nd.mesh != null) (meshes[nd.mesh] || []).forEach(m => o.add(m.clone())); (nd.children || []).forEach(c => o.add(node(c))); return o;
    };
    const sc = (json.scenes || [{ nodes: json.nodes ? json.nodes.map((_, i) => i) : [] }])[json.scene || 0]; (sc.nodes || []).forEach(ni => root.add(node(ni)));
    if (!root.children.length && meshes.length) meshes.flat().forEach(m => root.add(m));
    return root;
  }
  /* تصدير مجسّم محلي إلى GLB (الإحداثيات تُخبَّز بمصفوفة العالم) */
  async function toGLB(Tm, group) {
    group.updateWorldMatrix(true, true); const pinv = group.parent ? group.parent.matrixWorld.clone().invert() : new Tm.Matrix4(), metas = []; group.traverse(o => { if (o.isMesh) metas.push(o); });
    const chunks = [], views = [], accessors = [], images = [], textures = [], materials = [], gm = [], nodes = []; let off = 0;
    const addBytes = (u8) => { const pad = (4 - (u8.length % 4)) % 4, c = new Uint8Array(u8.length + pad); c.set(u8); chunks.push(c); const o = off; off += c.length; views.push({ buffer: 0, byteOffset: o, byteLength: u8.length }); return views.length - 1; };
    const addAcc = (arr, comp, type, target, withMinMax) => {
      const bv = addBytes(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)); if (target) views[bv].target = target; const nc = NC[type], count = arr.length / nc, a = { bufferView: bv, componentType: comp, count, type };
      if (withMinMax) { const mn = new Array(nc).fill(Infinity), mx = new Array(nc).fill(-Infinity); for (let i = 0; i < count; i++) for (let c = 0; c < nc; c++) { const v = arr[i * nc + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; } a.min = mn; a.max = mx; }
      accessors.push(a); return accessors.length - 1;
    };
    const v3 = new Tm.Vector3(), nm = new Tm.Matrix3();
    for (const m of metas) {
      const g = m.geometry, P = g.getAttribute("position"), N = g.getAttribute("normal"), U = g.getAttribute("uv"), I = g.index; const rel = pinv.clone().multiply(m.matrixWorld); nm.getNormalMatrix(rel);
      const pw = new Float32Array(P.count * 3), nw = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { v3.fromBufferAttribute(P, i).applyMatrix4(rel); pw.set([v3.x, v3.y, v3.z], i * 3); if (N) { v3.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nw.set([v3.x, v3.y, v3.z], i * 3); } }
      const attrs = { POSITION: addAcc(pw, 5126, "VEC3", 34962, true) }; if (N) attrs.NORMAL = addAcc(nw, 5126, "VEC3", 34962);
      if (U) { const uw = new Float32Array(U.count * 2); for (let i = 0; i < U.count; i++) { uw[i * 2] = U.getX(i); uw[i * 2 + 1] = 1 - U.getY(i); } attrs.TEXCOORD_0 = addAcc(uw, 5126, "VEC2", 34962); }
      const prim = { attributes: attrs, mode: 4 }; if (I) prim.indices = addAcc(Uint32Array.from(I.array), 5125, "SCALAR", 34963);
      const mat = m.material, pbr = { metallicFactor: 0, roughnessFactor: mat.roughness == null ? 0.6 : mat.roughness };
      if (mat.map && mat.map.image) { const cv = mat.map.image, bl = await new Promise(r => cv.toBlob(r, "image/png")), bytes = new Uint8Array(await bl.arrayBuffer()), bv = addBytes(bytes); images.push({ bufferView: bv, mimeType: "image/png" }); textures.push({ source: images.length - 1 }); pbr.baseColorTexture = { index: textures.length - 1 }; }
      else { const c = mat.color ? mat.color.clone().convertLinearToSRGB() : { r: 1, g: 1, b: 1 }; pbr.baseColorFactor = [mat.color ? mat.color.r : 1, mat.color ? mat.color.g : 1, mat.color ? mat.color.b : 1, 1]; }
      materials.push({ pbrMetallicRoughness: pbr, doubleSided: true }); prim.material = materials.length - 1; gm.push({ name: m.name || "mesh", primitives: [prim] }); nodes.push({ mesh: gm.length - 1, name: m.name || "mesh" });
    }
    const json = { asset: { version: "2.0", generator: "Alyssum Studio 3D" }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gm, materials, accessors, bufferViews: views, buffers: [{ byteLength: off }] };
    if (images.length) { json.images = images; json.textures = textures; }
    let js = new TextEncoder().encode(JSON.stringify(json)); const jp = (4 - (js.length % 4)) % 4; if (jp) { const t = new Uint8Array(js.length + jp).fill(32); t.set(js); js = t; }
    const total = 12 + 8 + js.length + 8 + off, head = new DataView(new ArrayBuffer(20)); head.setUint32(0, 0x46546C67, true); head.setUint32(4, 2, true); head.setUint32(8, total, true); head.setUint32(12, js.length, true); head.setUint32(16, 0x4E4F534A, true);
    const bh = new DataView(new ArrayBuffer(8)); bh.setUint32(0, off, true); bh.setUint32(4, 0x004E4942, true);
    return new Blob([head.buffer, js, bh.buffer, ...chunks], { type: "model/gltf-binary" });
  }

  /* ═══ العرض ═══ */
  const bgCss = () => S.bg === "none" ? "repeating-conic-gradient(#d8d8d8 0 25%,#fff 0 50%) 0 0/20px 20px" : S.bg === "white" ? "#fff" : S.bg === "dark" ? "radial-gradient(circle at 50% 38%,#2a303a,#0e1014)" : S.bg === "warm" ? "radial-gradient(circle at 50% 40%,#f6efe3,#e6dccb)" : "radial-gradient(circle at 50% 40%,#fbfbfc,#e2e5eb)";
  const bgPaint = (x, w, h) => { if (S.bg === "none") return; let a, b; if (S.bg === "white") a = b = "#fff"; else if (S.bg === "dark") { a = "#2a303a"; b = "#0e1014"; } else if (S.bg === "warm") { a = "#f6efe3"; b = "#e6dccb"; } else { a = "#fbfbfc"; b = "#e2e5eb"; } const g = x.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.hypot(w, h) * 0.62); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); };
  function blobTex() { const c = canv(128, 128), x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); return t; }
  async function initRenderer(stage) {
    await loadThree(); R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.outputColorSpace = T.SRGBColorSpace; R.setClearColor(0x000000, 0); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new T.Scene(); cam = new T.PerspectiveCamera(26, 1, 0.01, 100); pivot = new T.Group(); scene.add(pivot);
    scene.add(new T.AmbientLight(0xffffff, 1.15), new T.HemisphereLight(0xffffff, 0xb8bfcc, 0.9)); const k = new T.DirectionalLight(0xffffff, 1.5); k.position.set(-2.2, 3.2, 3.4); scene.add(k); const f = new T.DirectionalLight(0xdfe8ff, 0.7); f.position.set(3, 1.2, 1.5); scene.add(f);
    blob = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.001; scene.add(blob);
    stage.appendChild(R.domElement); R.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab";
    const cv = R.domElement; let down = null;
    cv.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", e => { if (!down) return; view.yaw = down.yaw + (e.clientX - down.x) * 0.011; view.pitch = clamp(down.pitch + (e.clientY - down.y) * 0.006, -0.1, 1.25); place(); dirty = true; });
    const up = () => { down = null; cv.style.cursor = "grab"; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", e => { e.preventDefault(); view.zoom = clamp(view.zoom * (e.deltaY < 0 ? 1.08 : 0.92), 0.5, 3); place(); dirty = true; }, { passive: false });
    cv.addEventListener("dblclick", () => { view.yaw = -0.5; view.pitch = 0.16; view.zoom = 1; place(); dirty = true; });
    new ResizeObserver(() => resize()).observe(stage); resize();
  }
  let fit = { r: 0.6, h: 1 };
  function place() { if (!R || !cam) return; const w = R.domElement.clientWidth || 600, h = R.domElement.clientHeight || 500, asp = w / Math.max(1, h), th = Math.tan(cam.fov * Math.PI / 360), need = Math.max((fit.h / 2 * 1.2) / th, (fit.r * 1.2) / (th * asp)) + fit.r, d = need / view.zoom, tg = new T.Vector3(0, fit.h * 0.5, 0); cam.aspect = asp; cam.position.set(0, tg.y + Math.sin(view.pitch) * d, Math.cos(view.pitch) * d); cam.near = d / 40; cam.far = d * 12; cam.lookAt(tg); cam.updateProjectionMatrix(); pivot.rotation.y = view.yaw; }
  function resize() { if (!R) return; const st = R.domElement.parentNode, w = st.clientWidth || 600, h = st.clientHeight || 500; R.setSize(w, h, false); place(); dirty = true; }
  function show(obj, kind, stats) {
    if (S.model && S.model.obj) { pivot.remove(S.model.obj); S.model.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    /* توسيط وتطبيع الارتفاع إلى 1 للعرض فقط (النماذج الخارجية قد تأتي بمقاييس أخرى) */
    const holder = new T.Group(); holder.add(obj); pivot.add(holder); holder.updateMatrixWorld(true); let b = new T.Box3().setFromObject(holder), sz = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
    if (kind === "api") { const k = 1 / (Math.max(sz.x, sz.y, sz.z) || 1); holder.scale.setScalar(k); holder.updateMatrixWorld(true); b = new T.Box3().setFromObject(holder); sz = b.getSize(new T.Vector3()); c = b.getCenter(new T.Vector3()); holder.position.set(-c.x, -b.min.y, -c.z); }
    else holder.position.set(0, 0, -c.z);
    holder.updateMatrixWorld(true); b = new T.Box3().setFromObject(holder); sz = b.getSize(new T.Vector3());
    fit = { r: Math.max(0.3, Math.hypot(sz.x, sz.z) / 2), h: Math.max(0.3, b.max.y) }; blob.scale.set(fit.r * 3, fit.r * 3, 1);
    S.model = { obj: holder, kind, stats: stats || null }; place(); dirty = true;
  }
  function loop() { raf = requestAnimationFrame(loop); if (!opened || !R) return; if (S.auto && S.model) { view.yaw += 0.008; place(); dirty = true; } if (dirty && R.domElement.isConnected) { R.render(scene, cam); dirty = false; } }
  function snap(w, h, transparent, yawOff) {
    const cw = R.domElement.clientWidth, ch = R.domElement.clientHeight, pr = R.getPixelRatio(), y0 = view.yaw; R.setPixelRatio(1); R.setSize(w, h, false); if (yawOff) view.yaw += yawOff; place(); R.render(scene, cam);
    const out = canv(w, h), x = out.getContext("2d"); if (!transparent) bgPaint(x, w, h); x.drawImage(R.domElement, 0, 0, w, h);
    R.setPixelRatio(pr); R.setSize(cw, ch, false); view.yaw = y0; place(); dirty = true; return out;
  }
  const toBlob = (cv, type, q) => new Promise(r => cv.toBlob(r, type || "image/png", q));
  const dl = (b, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

  /* ═══ الواجهة ═══ */
  const CSS = "#i3-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:.8rem}" +
    "#i3{background:rgba(9,24,18,.99);border:1px solid rgba(var(--g-mint-rgb,226,254,23),.35);border-radius:18px;width:min(1440px,100%);height:min(94vh,920px);display:flex;flex-direction:column;color:#fff;direction:rtl;overflow:hidden;font-family:inherit}" +
    "#i3 .i3-h{display:flex;align-items:center;gap:.8rem;padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,.12)}#i3 .i3-h b{font-size:1.05rem}#i3 .i3-h small{color:rgba(255,255,255,.7);flex:1}" +
    "#i3 button,#i3 select{font:inherit;color:#fff;border-radius:12px;border:1px solid rgba(255,255,255,.22);padding:.4rem .9rem;cursor:pointer}#i3 button{background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04));box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -3px 6px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s,background .15s}" +
    "#i3 button:hover{transform:translateY(-2px);background:rgba(var(--g-mint-rgb,226,254,23),.28)}#i3 button.go{background:rgba(var(--g-mint-rgb,226,254,23),.34);border-color:rgba(var(--g-mint-rgb,226,254,23),.7);font-weight:800;padding:.6rem 1rem;width:100%}#i3 button.warn{background:rgba(255,160,40,.34);border-color:rgba(255,160,40,.8)}#i3 button:disabled{opacity:.5;cursor:default;transform:none}" +
    "#i3 select{background:rgba(255,255,255,.08)}#i3 select option{color:#111}#i3 .i3-m{display:flex;flex:1;min-height:0}#i3 .i3-side{width:360px;max-width:42%;overflow:auto;padding:.8rem;display:flex;flex-direction:column;gap:.55rem;border-inline-end:1px solid rgba(255,255,255,.12)}" +
    "#i3 h5{margin:.5rem 0 .1rem;color:rgb(var(--g-mint-rgb,226,254,23));font-size:.9rem}#i3 .i3-slot{display:flex;gap:.6rem;align-items:center;border:1px dashed rgba(255,255,255,.28);border-radius:12px;padding:.45rem;background:rgba(255,255,255,.04)}#i3 .i3-slot.drag{border-color:rgb(var(--g-mint-rgb,226,254,23));background:rgba(var(--g-mint-rgb,226,254,23),.1)}" +
    "#i3 .i3-th{width:74px;height:74px;border-radius:10px;background:repeating-conic-gradient(#3a3f47 0 25%,#2b2f36 0 50%) 0 0/12px 12px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;cursor:pointer}#i3 .i3-th canvas,#i3 .i3-th img{max-width:100%;max-height:100%}" +
    "#i3 .i3-slot .t{flex:1;font-size:.88rem}#i3 .i3-slot .t small{display:block;color:rgba(255,255,255,.65)}#i3 .i3-row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}#i3 .i3-row label{font-size:.85rem;color:rgba(255,255,255,.8)}#i3 input[type=range]{flex:1}" +
    "#i3 .i3-conf{height:8px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}#i3 .i3-conf i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f87171,#fbbf24,#86efac)}#i3 .i3-msg{font-size:.85rem;min-height:1.4em;color:rgba(255,255,255,.85);white-space:pre-line}" +
    "#i3 .i3-api{border:1px solid rgba(255,160,40,.4);border-radius:12px;padding:.55rem;background:rgba(255,160,40,.07);display:flex;flex-direction:column;gap:.4rem;font-size:.85rem}#i3 .i3-api input{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:.35rem .6rem;color:#fff;font:inherit;direction:ltr}" +
    "#i3 .i3-stage{flex:1;min-width:0;position:relative;background:#e2e5eb}#i3 .i3-hint{position:absolute;top:.6rem;left:.8rem;right:.8rem;text-align:center;font-size:.8rem;color:#445;pointer-events:none;text-shadow:0 1px 0 rgba(255,255,255,.6)}" +
    "@media(max-width:820px){#i3 .i3-m{flex-direction:column}#i3 .i3-side{width:auto;max-width:none;max-height:48%}#i3 .i3-stage{min-height:300px}}";
  const SLOTS = [["f", "① أمامي", "إجباري — المنتج من الأمام"], ["s", "② جانبي", "يعطي العمق الحقيقي"], ["x", "③ إضافي", "خلفي (يحسّن الخلف) أو علوي (يعطي شكل المقطع)"]];
  const msg = (t, bad) => { const e = $("i3-msg"); if (e) { e.textContent = t || ""; e.style.color = bad ? "#ffb4b4" : ""; } };
  const slotKey = k => k === "x" ? (S.third === "top" ? "t" : "b") : k;
  function drawSlot(k) {
    const el = $("i3-th-" + k); if (!el) return; el.innerHTML = ""; const v = S[slotKey(k)];
    if (v && v.cut) { const c = canv(70, 70), x = c.getContext("2d"), s = Math.min(70 / v.cut.width, 70 / v.cut.height); x.drawImage(v.cut, (70 - v.cut.width * s) / 2, (70 - v.cut.height * s) / 2, v.cut.width * s, v.cut.height * s); el.appendChild(c); } else el.textContent = "＋";
    const rm = $("i3-rm-" + k); if (rm) rm.style.display = v ? "" : "none";
  }
  async function setImage(k, file) {
    const key = slotKey(k); msg("جارٍ فصل الخلفية…");
    try {
      const src = file instanceof HTMLCanvasElement ? file : await fileToCanvas(file), cut = await cutFor(src), info = analyze(cut.canvas);
      if (info.empty) throw new Error("لم أجد منتجاً في الصورة"); S[key] = { src, cut: cut.canvas, info, how: cut.how };
      if (k === "x") { S[S.third === "top" ? "b" : "t"] = null; }
      drawSlot(k); msg("تمت إضافة الصورة (" + ({ alpha: "خلفية شفافة أصلاً", classic: "فصل تلقائي", local: "فصل محلي" }[cut.how] || "") + ")" + (info.cov < 0.04 || info.cov > 0.97 ? "\n⚠️ فصل الخلفية غير مقنع — جرّب صورة بخلفية متجانسة أو PNG شفاف" : ""), info.cov < 0.04 || info.cov > 0.97);
    } catch (e) { msg("⚠️ " + (e.message || e), true); }
  }
  function slotsHtml() {
    return SLOTS.map(([k, n, h]) => '<div class="i3-slot" data-k="' + k + '"><div class="i3-th" id="i3-th-' + k + '" title="اضغط لاختيار صورة أو أفلتها هنا">＋</div><div class="t"><b>' + n + '</b><small>' + h + '</small>' +
      (k === "x" ? '<select id="i3-third"><option value="back">صورة خلفية</option><option value="top">صورة علوية</option></select>' : '') + '</div><input type="file" accept="image/*" hidden id="i3-f-' + k + '"><button type="button" id="i3-rm-' + k + '" style="display:none" title="إزالة">✕</button></div>').join("");
  }
  function productOptions() {
    if (typeof Admin === "undefined" || !Admin.products) return ""; let o = "";
    try { (Admin.products || []).filter(p => p && p.active !== false).slice(0, 80).forEach(p => { const imgs = [p.cover].concat(p.images || []).filter(Boolean); if (imgs.length) o += '<optgroup label="' + String(p.title || p.slug || "").replace(/[<>&"]/g, "") + '">' + imgs.slice(0, 6).map((u, i) => '<option value="' + String(u).replace(/"/g, "&quot;") + '">' + (i ? "صورة " + (i + 1) : "الغلاف") + '</option>').join("") + '</optgroup>'; }); } catch (e) { }
    return o ? '<div class="i3-row"><label>أو من صور منتجاتك</label><select id="i3-prod" style="flex:1;min-width:0"><option value="">— اختر —</option>' + o + '</select></div>' : "";
  }
  function setConf(sc, issues) {
    S.conf = sc; const b = document.querySelector("#i3 .i3-conf i"); if (b) b.style.width = sc + "%";
    const api = $("i3-api"); if (api) { api.classList.toggle("warn", sc < 60); }
  }
  async function go() {
    if (!S.f) { msg("أضف الصورة الأمامية أولاً", true); return; }
    $("i3-go").disabled = true; msg("جارٍ بناء المجسّم…");
    try {
      await new Promise(r => setTimeout(r, 30)); await loadThree();
      const r = buildModel(T, { f: S.f, s: S.s, b: S.b, t: S.t }, { sec: S.sec, depthR: S.depthR });
      show(r.group, "local", r.stats); setConf(r.stats.score, r.stats.issues);
      msg("✅ بُني المجسّم محلياً (" + ({ ellipse: "مقطع بيضاوي", rrect: "مقطع مستطيل مدوّر", box: "مقطع مستطيل", top: "مقطع من الصورة العلوية" }[r.stats.kind]) + ") · الثقة " + r.stats.score + "%" + (r.stats.issues.length ? "\n• " + r.stats.issues.join("\n• ") : "") + (r.stats.score < 60 ? "\n\nالنتيجة ضعيفة — جرّب «البناء عبر Alyssum API» أدناه." : ""), r.stats.score < 40);
      enableExports(true);
    } catch (e) { setConf(0); msg("⚠️ تعذّر البناء المحلي: " + (e.message || e) + "\nاستعمل «البناء عبر Alyssum API» أو غيّر الصور.", true); }
    $("i3-go").disabled = false;
  }
  async function viaApi() {
    if (!S.f && !S.s && !S.b) { msg("أضف صورة واحدة على الأقل", true); return; }
    if (typeof ImgGen === "undefined" || !ImgGen.model3d) { msg("⚠️ خدمة المجسّمات غير متاحة في هذه النسخة", true); return; }
    const kEl = $("i3-key"); if (kEl && kEl.value.trim()) LS.set("alyssum_fal_key", kEl.value.trim());
    const white = async v => { if (!v) return null; const c = canv(v.cut.width, v.cut.height), x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(v.cut, 0, 0); return toBlob(c, "image/jpeg", 0.92); };
    $("i3-api").disabled = true; msg("جارٍ الاتصال بـ Alyssum API…");
    try {
      const r = await ImgGen.model3d({ front: await white(S.f), side: await white(S.s), back: await white(S.b), onStatus: t => msg(t), title: "تحويل الصور إلى مجسّم 3D" });
      if (!r) { msg("أُلغيت العملية"); } else {
        await loadThree(); const root = await loadGLB(T, await r.blob.arrayBuffer()); show(root, "api", { glb: r.blob }); setConf(90); msg("✅ وصل المجسّم من Alyssum API وعُرض هنا"); enableExports(true);
      }
    } catch (e) {
      if (e && e.code === "NOKEY") { msg("أدخل مفتاح الاتصال في الخانة أدناه ثم أعد الضغط.", true); const w = $("i3-keyrow"); if (w) w.style.display = ""; }
      else if (e && e.code === "OFF") msg("خدمة المجسّمات معطّلة من الإعدادات.", true); else msg("⚠️ " + (e.message || e), true);
    }
    $("i3-api").disabled = false;
  }
  function enableExports(on) { document.querySelectorAll("#i3 [data-ex]").forEach(b => { b.disabled = !on; }); }
  async function exportAs(kind) {
    if (!S.model) return; const nm = "alyssum-3d";
    try {
      if (kind === "studio") {
        const tx = S.model.stats && S.model.stats.textures, custom = { obj: S.model.obj, kind: S.model.kind, name: "مجسّم من صور 2D", faces: tx ? { front: tx.front, back: tx.back } : null };
        if (typeof Studio3D !== "undefined") await Studio3D.open({ tab: "box", custom }); else if (typeof BoxStudio !== "undefined") await BoxStudio.open({ custom });
      }
      else if (kind === "png") dl(await toBlob(snap(1600, 1600, S.bg === "none"), "image/png"), nm + ".png");
      else if (kind === "webp") dl(await toBlob(snap(1600, 1600, S.bg === "none"), "image/webp", 0.92), nm + ".webp");
      else if (kind === "glb") { const b = S.model.kind === "api" && S.model.stats && S.model.stats.glb ? S.model.stats.glb : await toGLB(T, S.model.obj); dl(b, nm + ".glb"); }
      else if (kind === "zip") {
        if (typeof AdminImgBatch === "undefined" || !AdminImgBatch.zip) { msg("⚠️ التنزيل المضغوط غير متاح", true); return; }
        const was = S.auto; S.auto = false; msg("جارٍ تجهيز 24 زاوية…"); const files = []; for (let i = 0; i < 24; i++) { const c = snap(1000, 1000, S.bg === "none", i * Math.PI / 12); files.push({ name: "angle-" + String(i + 1).padStart(2, "0") + ".png", blob: await toBlob(c, "image/png") }); }
        S.auto = was; dl(await AdminImgBatch.zip(files), nm + "-360.zip"); msg("✅ نُزّل");
      }
    } catch (e) { msg("⚠️ " + (e.message || e), true); }
  }
  function wire(root) {
    const pick = k => $("i3-f-" + k).click();
    root.addEventListener("click", e => {
      const th = e.target.closest(".i3-th"); if (th) { pick(th.parentNode.dataset.k); return; }
      const rm = e.target.closest('[id^="i3-rm-"]'); if (rm) { const k = rm.id.slice(6); S[slotKey(k)] = null; drawSlot(k); return; }
      const ex = e.target.closest("[data-ex]"); if (ex) exportAs(ex.dataset.ex);
    });
    root.querySelectorAll('input[type=file]').forEach(inp => inp.addEventListener("change", () => { const k = inp.id.slice(5); if (inp.files[0]) setImage(k, inp.files[0]); inp.value = ""; }));
    root.querySelectorAll(".i3-slot").forEach(s => { s.addEventListener("dragover", e => { e.preventDefault(); s.classList.add("drag"); }); s.addEventListener("dragleave", () => s.classList.remove("drag")); s.addEventListener("drop", e => { e.preventDefault(); s.classList.remove("drag"); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) setImage(s.dataset.k, f); }); });
    $("i3-third").onchange = e => { const old = S.third === "top" ? S.t : S.b; S.third = e.target.value; S.t = S.b = null; if (old) { S[S.third === "top" ? "t" : "b"] = old; } drawSlot("x"); };
    $("i3-sec").onchange = e => { S.sec = e.target.value; }; $("i3-depth").oninput = e => { S.depthR = Number(e.target.value); $("i3-dv").textContent = S.depthR.toFixed(2); };
    $("i3-go").onclick = go; $("i3-api").onclick = viaApi;
    $("i3-bgm").onchange = e => { S.bg = e.target.value; $("i3-stage").style.background = bgCss(); }; $("i3-auto").onchange = e => { S.auto = e.target.checked; };
    const pr = $("i3-prod"); if (pr) pr.onchange = async () => { const u = pr.value; if (!u) return; try { const b = await (await fetch(u)).blob(); const slot = !S.f ? "f" : !S.s ? "s" : "x"; await setImage(slot, b); } catch (e) { msg("⚠️ تعذّر قراءة صورة المنتج", true); } pr.value = ""; };
    const key = LS.get("alyssum_fal_key", ""); $("i3-keyrow").style.display = key ? "none" : "";
  }
  function close() {
    if (!opened && !$("i3-bg")) return; opened = false; if (escH) { document.removeEventListener("keydown", escH); escH = null; } cancelAnimationFrame(raf); raf = 0;
    if (S.model && S.model.obj) { S.model.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); } S.model = null;
    if (R) { try { R.dispose(); R.forceContextLoss(); } catch (e) { } R = null; } scene = cam = pivot = null; const b = $("i3-bg"); if (b) b.remove();
    S.f = S.s = S.b = S.t = null; const cb = onCloseCb; onCloseCb = null; if (cb) { try { cb(); } catch (e) { } }
  }
  async function open(o) {
    close(); o = o || {}; onCloseCb = o.onClose || null; if (!$("i3-css")) { const st = document.createElement("style"); st.id = "i3-css"; st.textContent = CSS; document.head.appendChild(st); }
    const bg = document.createElement("div"); bg.id = "i3-bg";
    bg.innerHTML = '<div id="i3" role="dialog" aria-label="صور 2D إلى 3D"><div class="i3-h"><b>🖼️ صور 2D إلى 3D</b><small>أضف صورتين أو ثلاثاً للمنتج من زوايا مختلفة ← مجسّم ثلاثي الأبعاد حقيقي بلا إكستريود</small><button type="button" id="i3-x">إغلاق</button></div>' +
      '<div class="i3-m"><div class="i3-side"><h5>① صور المنتج (خلفية متجانسة أو PNG شفاف)</h5>' + slotsHtml() + productOptions() +
      '<h5>② الإعدادات</h5><div class="i3-row"><label>شكل المقطع</label><select id="i3-sec" style="flex:1"><option value="auto">تلقائي</option><option value="ellipse">بيضاوي (قوارير، برطمانات)</option><option value="rrect">مستطيل مدوّر</option><option value="box">مستطيل حاد (علب)</option><option value="top">من الصورة العلوية</option></select></div>' +
      '<div class="i3-row"><label>العمق (بلا جانبية)</label><input type="range" id="i3-depth" min="0.2" max="1.5" step="0.05" value="0.6"><span id="i3-dv">0.60</span></div>' +
      '<button type="button" class="go" id="i3-go">ابنِ المجسّم</button><div class="i3-conf" title="ثقة التجميع المحلي"><i></i></div><div class="i3-msg" id="i3-msg">أضف الصورة الأمامية ثم اضغط «ابنِ المجسّم».</div>' +
      '<div class="i3-api"><b>إن لم تنجح النتيجة</b><span>يبني Alyssum API المجسّم من صورك مباشرة (يحتاج رصيداً ومفتاح اتصال).</span><div id="i3-keyrow" style="display:none"><input id="i3-key" type="password" placeholder="مفتاح الاتصال" autocomplete="off"></div><button type="button" id="i3-api">🌐 بناء عبر Alyssum API</button></div>' +
      '<h5>③ العرض والتنزيل</h5><div class="i3-row"><label>الخلفية</label><select id="i3-bgm" style="flex:1"><option value="light">فاتحة</option><option value="white">بيضاء</option><option value="warm">دافئة</option><option value="dark">داكنة</option><option value="none">شفافة (للتنزيل)</option></select></div>' +
      '<div class="i3-row"><label><input type="checkbox" id="i3-auto" checked> دوران تلقائي</label></div><div class="i3-row"><button type="button" data-ex="png" disabled>صورة PNG</button><button type="button" data-ex="webp" disabled>WebP</button><button type="button" data-ex="zip" disabled>360° ZIP</button><button type="button" data-ex="glb" disabled>GLB</button></div><div class="i3-row"><button type="button" data-ex="studio" disabled style="flex:1 1 100%">🧊 افتح المجسّم في المحرّر لإضافة الملصقات والنصوص</button></div></div>' +
      '<div class="i3-stage" id="i3-stage"><div class="i3-hint">اسحب للتدوير · العجلة للتقريب · نقرتان لإعادة الضبط</div></div></div></div>';
    document.body.appendChild(bg); opened = true; $("i3-x").onclick = close; bg.addEventListener("mousedown", e => { if (e.target === bg) close(); }); $("i3-stage").style.background = bgCss();
    wire($("i3")); escH = e => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", escH);
    try {
      const hasGL = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })(); if (!hasGL) throw new Error("متصفحك أو جهازك لا يدعم WebGL المطلوب للعرض ثلاثي الأبعاد");
      await initRenderer($("i3-stage")); if (!opened) return; if (!raf) loop();
      if (o.front) await setImage("f", o.front); if (o.side) await setImage("s", o.side);
    } catch (e) { msg("⚠️ " + (e.message || e), true); }
  }
  return { open, close, S, get opened() { return opened; }, _t: { buildModel, analyze, series, localCut, cutFor, toGLB, loadGLB, loadThree, setImage, go, viaApi, snap, show, plan, correlation, outline, bleed, fileToCanvas } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Img3D;
