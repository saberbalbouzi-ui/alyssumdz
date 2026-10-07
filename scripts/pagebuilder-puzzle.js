/* ═══ بازل الصورة في منشئ الصفحات ═══
   يقسّم الصورة إلى قطع منفصلة (كل قطعة عنصر صورة حر بشكل مقصوص clip-path) تتجاذب عند اقترابها من موضعها الصحيح.
   الأنماط: شبكة، بازل كلاسيكي (بروزات)، شبكة متموّجة، مثلثات، طوب، خلايا سداسية، وحر (ارسم مستقيمات أو منحنيات على الصورة).
   كل قطعة تحمل: pz (معرّف المجموعة)، pzh (موضعها الأصلي لكل جهاز)، pzs (التجاذب)، crop (جزء الصورة)، clip (مسار القص نسبياً 0..1). */
const PBPuzzle = (function () {
  const A = () => PBApp, esc = s => PB.esc(s);
  const S = { pat: "jigsaw", cols: 4, rows: 3, knob: 100, pv: null, pvId: "" };
  /* مصغّرات حقيقية لأنماط التقسيم بجانب أسمائها */
  const PTH = { grid: "M33 6V94M66 6V94M6 33H94M6 66H94", jigsaw: "M6 50H38a11 11 0 1 1 24 0H94M50 6V38a11 11 0 1 0 0 24V94", wave: "M6 33Q28 15 50 33T94 33M6 66Q28 48 50 66T94 66M33 6Q15 28 33 50T33 94M66 6Q48 28 66 50T66 94", tri: "M6 6L94 94M94 6L6 94M50 6V94M6 50H94", brick: "M6 33H94M6 66H94M50 6V33M28 33V66M72 33V66M50 66V94", hex: "M50 8L86 29V71L50 92L14 71V29ZM50 50V8M50 50L86 71M50 50L14 71", free: "M10 82C30 8 70 92 90 18" };
  const patThumb = k => `<svg class="pbx-thumb" viewBox="0 0 100 100" aria-hidden="true"><rect x="3" y="3" width="94" height="94" rx="12" fill="#faf6ec" stroke="#cfc6b0" stroke-width="3"/><path d="${PTH[k] || PTH.grid}" fill="none" stroke="#7c3aed" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"${k === "free" ? ' stroke-dasharray="1 9"' : ""}/></svg>`;
  const PATS = [["grid", "شبكة مستطيلات"], ["jigsaw", "بازل كلاسيكي (بروزات)"], ["wave", "شبكة متموّجة"], ["tri", "مثلثات"], ["brick", "طوب (صفوف متداخلة)"], ["hex", "خلايا سداسية"], ["free", "حر — ارسم مستقيمات أو منحنيات"]];
  const MAXP = 120, SNAP_PX = 16;
  let D = null;      // حالة وضع الرسم

  /* ───────── أدوات هندسية ───────── */
  const rnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const cub = (p0, p1, p2, p3, n) => { const o = []; for (let i = 1; i <= n; i++) { const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; o.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]); } return o; };
  /* حافة بروز كلاسيكي بإحداثيات محلية (u طول الحافة 0..1، v ارتفاع بنفس وحدة الطول) */
  function knobEdge(kn, shift) {
    const X = u => .5 + (u - .5) * kn + shift, V = v => v * kn, hc = .165, r = .105, a = 244.9 * Math.PI / 180, sw = 309.8 * Math.PI / 180, nn = 22;
    const p = [[0, 0], [Math.max(.08, X(.36) - .14), 0], [X(.36), 0]];
    p.push(...cub([X(.36), 0], [X(.43), 0], [X(.452), V(.035)], [X(.454), V(.07)], 5));
    for (let i = 1; i <= nn; i++) { const f = a - sw * i / nn; p.push([X(.5 + r * Math.cos(f)), V(hc + r * Math.sin(f))]); }
    p.push(...cub([X(.546), V(.07)], [X(.548), V(.035)], [X(.57), 0], [X(.64), 0], 5));
    p.push([Math.min(.92, X(.64) + .14), 0], [1, 0]); return p;
  }
  function waveEdge(amp, ph) { const p = [], n = 26; for (let i = 0; i <= n; i++) { const u = i / n; p.push([u, amp * Math.sin(2 * Math.PI * 2 * u + ph)]); } return p; }
  /* مضلعات الأنماط القائمة على الحواف المشتركة: شبكة / بازل / تموّج؛ الإحداثيات في وحدات (x∈[0,fa]، y∈[0,1]) */
  function edgePolys(kind, C, R, fa, kn, seed) {
    const rd = rnd(seed), cw = fa / C, ch = 1 / R, vert = {}, hor = {}, local = kind === "jigsaw" ? () => knobEdge(kn, (rd() - .5) * .08) : null;
    const place = (A0, d, nv, L, s, loc) => loc.map(q => [A0[0] + d[0] * L * q[0] + nv[0] * s * L * q[1], A0[1] + d[1] * L * q[0] + nv[1] * s * L * q[1]]);
    const mk = (r, c, isV) => {
      if (isV) { const x = (c + 1) * cw, A0 = [x, r * ch], s = rd() < .5 ? -1 : 1; return place(A0, [0, 1], [1, 0], ch, s, kind === "jigsaw" ? local() : waveEdge(.07 * kn, rd() * 6.28)); }
      const y = (r + 1) * ch, A0 = [c * cw, y], s = rd() < .5 ? -1 : 1; return place(A0, [1, 0], [0, 1], cw, s, kind === "jigsaw" ? local() : waveEdge(.07 * kn, rd() * 6.28));
    };
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) vert[r + "," + c] = kind === "grid" ? null : mk(r, c, true);
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) hor[r + "," + c] = kind === "grid" ? null : mk(r, c, false);
    const out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const x0 = c * cw, x1 = (c + 1) * cw, y0 = r * ch, y1 = (r + 1) * ch, poly = [[x0, y0]];
      if (r > 0) { const e = hor[(r - 1) + "," + c]; if (e) poly.push(...e); }                       // الحافة العليا (يسار ← يمين)
      poly.push([x1, y0]);
      if (c < C - 1) { const e = vert[r + "," + c]; if (e) poly.push(...e); }                          // اليمنى (أعلى ← أسفل)
      poly.push([x1, y1]);
      if (r < R - 1) { const e = hor[r + "," + c]; if (e) poly.push(...e.slice().reverse()); }         // السفلى (يمين ← يسار)
      poly.push([x0, y1]);
      if (c > 0) { const e = vert[r + "," + (c - 1)]; if (e) poly.push(...e.slice().reverse()); }      // اليسرى (أسفل ← أعلى)
      out.push(poly);
    }
    return out;
  }
  function triPolys(C, R, fa) {
    const cw = fa / C, ch = 1 / R, out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const a = [c * cw, r * ch], b = [(c + 1) * cw, r * ch], d = [(c + 1) * cw, (r + 1) * ch], e = [c * cw, (r + 1) * ch];
      if ((r + c) % 2 === 0) out.push([a, b, d], [a, d, e]); else out.push([a, b, e], [b, d, e]); }
    return out;
  }
  function brickPolys(C, R, fa) {
    const cw = fa / C, ch = 1 / R, out = [];
    for (let r = 0; r < R; r++) { const xs = [0]; if (r % 2) xs.push(cw / 2); for (let x = (r % 2 ? 1.5 : 1) * cw; x < fa - 1e-6; x += cw) xs.push(x); xs.push(fa);
      for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] - xs[i] > cw * .12) out.push([[xs[i], r * ch], [xs[i + 1], r * ch], [xs[i + 1], (r + 1) * ch], [xs[i], (r + 1) * ch]]); }
    return out;
  }
  function clipRect(poly, W, H) {      // Sutherland–Hodgman
    const edges = [[p => p[0] >= 0, (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + t * (b[1] - a[1])]; }], [p => p[0] <= W, (a, b) => { const t = (W - a[0]) / (b[0] - a[0]); return [W, a[1] + t * (b[1] - a[1])]; }],
      [p => p[1] >= 0, (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), 0]; }], [p => p[1] <= H, (a, b) => { const t = (H - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), H]; }]];
    let out = poly; for (const [inside, cut] of edges) { const inp = out; out = []; if (!inp.length) break; for (let i = 0; i < inp.length; i++) { const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length], ci = inside(cur), pi = inside(prev); if (ci) { if (!pi) out.push(cut(prev, cur)); out.push(cur); } else if (pi) out.push(cut(prev, cur)); } }
    return out;
  }
  const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a / 2); };
  function hexPolys(C, fa) {
    const R = fa / (C * Math.sqrt(3)), w = Math.sqrt(3) * R, out = [], full = 1.5 * Math.sqrt(3) * R * R;
    for (let r = -1; r * 1.5 * R < 1 + R; r++) for (let c = -1; c * w < fa + w; c++) { const cx = c * w + (((r % 2) + 2) % 2 ? w / 2 : 0), cy = r * 1.5 * R, hx = [];
      for (let k = 0; k < 6; k++) { const a = (-90 + 60 * k) * Math.PI / 180; hx.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      const p = clipRect(hx, fa, 1); if (p.length >= 3 && area(p) > full * .12) out.push(p); }
    return out;
  }
  /* تقسيم حر: ترسم الخطوط على قماش منخفض الدقة ثم تُستخرج المناطق (تلوين الفيضان) وتُتتبَّع حدودها */
  function rdp(pts, eps, closed) {
    const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; if (!L) return Math.hypot(p[0] - a[0], p[1] - a[1]); const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    const run = P => { if (P.length < 3) return P.slice(); const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]];
      while (st.length) { const [i, j] = st.pop(); let m = -1, md = eps; for (let k = i + 1; k < j; k++) { const d = dist(P[k], P[i], P[j]); if (d > md) { md = d; m = k; } } if (m > 0) { keep[m] = 1; st.push([i, m], [m, j]); } }
      return P.filter((_, i) => keep[i]); };
    if (!closed) return run(pts);
    let f = 0, fd = 0; pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > fd) { fd = d; f = i; } });
    const a = run(pts.slice(0, f + 1)), b = run(pts.slice(f).concat([pts[0]])); return a.concat(b.slice(1, -1));
  }
  function regionsFromStrokes(strokes, fa) {
    const W = fa >= 1 ? 760 : Math.round(760 * fa), H = fa >= 1 ? Math.round(760 / fa) : 760, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.strokeStyle = "#000"; cx.lineWidth = 3.4; cx.lineCap = "round"; cx.lineJoin = "round";
    strokes.forEach(s => { cx.beginPath(); s.forEach((p, i) => { i ? cx.lineTo(p[0] * W, p[1] * H) : cx.moveTo(p[0] * W, p[1] * H); }); cx.stroke(); });
    const im = cx.getImageData(0, 0, W, H).data, N = W * H, mask = new Uint8Array(N); for (let i = 0; i < N; i++) mask[i] = im[i * 4 + 3] > 40 ? 1 : 0;
    const lab = new Int32Array(N).fill(-1), q = new Int32Array(N), areas = []; let n = 0;
    for (let s = 0; s < N; s++) { if (mask[s] || lab[s] !== -1) continue; let h = 0, t = 0, a = 0; q[t++] = s; lab[s] = n;
      while (h < t) { const p = q[h++], x = p % W, y = (p / W) | 0; a++;
        if (x > 0 && !mask[p - 1] && lab[p - 1] === -1) { lab[p - 1] = n; q[t++] = p - 1; } if (x < W - 1 && !mask[p + 1] && lab[p + 1] === -1) { lab[p + 1] = n; q[t++] = p + 1; }
        if (y > 0 && !mask[p - W] && lab[p - W] === -1) { lab[p - W] = n; q[t++] = p - W; } if (y < H - 1 && !mask[p + W] && lab[p + W] === -1) { lab[p + W] = n; q[t++] = p + W; } }
      areas.push(a); n++; }
    const minA = N * .0015, map = new Int32Array(n).fill(-1); let K = 0; areas.forEach((a, i) => { if (a >= minA) map[i] = K++; });
    if (K < 2) return [];
    let h = 0, t = 0; for (let i = 0; i < N; i++) { const l = lab[i] >= 0 ? map[lab[i]] : -1; lab[i] = l; if (l >= 0) q[t++] = i; }
    while (h < t) { const p = q[h++], l = lab[p], x = p % W, y = (p / W) | 0;      // نمو متعدد المصادر: البكسلات الفارغة (الخطوط والبقع الصغيرة) تنضم لأقرب منطقة
      if (x > 0 && lab[p - 1] < 0) { lab[p - 1] = l; q[t++] = p - 1; } if (x < W - 1 && lab[p + 1] < 0) { lab[p + 1] = l; q[t++] = p + 1; }
      if (y > 0 && lab[p - W] < 0) { lab[p - W] = l; q[t++] = p - W; } if (y < H - 1 && lab[p + W] < 0) { lab[p + W] = l; q[t++] = p + W; } }
    const edges = Array.from({ length: K }, () => new Map()), V = W + 1, add = (l, x0, y0, x1, y1) => { const m = edges[l], k = y0 * V + x0; (m.get(k) || m.set(k, []).get(k)).push(y1 * V + x1); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const l = lab[y * W + x]; if (l < 0) continue;
      if (y === 0 || lab[(y - 1) * W + x] !== l) add(l, x, y, x + 1, y); if (x === W - 1 || lab[y * W + x + 1] !== l) add(l, x + 1, y, x + 1, y + 1);
      if (y === H - 1 || lab[(y + 1) * W + x] !== l) add(l, x + 1, y + 1, x, y + 1); if (x === 0 || lab[y * W + x - 1] !== l) add(l, x, y + 1, x, y); }
    const polys = [];
    edges.forEach(m => { let best = null, ba = 0;
      while (m.size) { const start = m.keys().next().value, ring = []; let cur = start, guard = 0;
        do { const arr = m.get(cur); if (!arr) break; const nx = arr.pop(); if (!arr.length) m.delete(cur); ring.push([cur % V, (cur / V) | 0]); cur = nx; } while (cur !== start && ++guard < 400000);
        if (ring.length > 3) { const a = area(ring); if (a > ba) { ba = a; best = ring; } } }
      if (best) { const s = rdp(best, 1.15, true); if (s.length >= 3) polys.push(s.map(p => [p[0] / W, p[1] / H])); } });
    return polys;
  }

  /* ───────── بناء القطع ───────── */
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = A().localize(String(src)); });
  const fin = v => Number.isFinite(v);
  const geom = (set, dev) => { const g = { fx: Number(PB.eff(set, "fx", dev)), fy: Number(PB.eff(set, "fy", dev)), fwd: Number(PB.eff(set, "fwd", dev)), fh: Number(PB.eff(set, "fh", dev)) }; return fin(g.fx) && fin(g.fy) && g.fwd > 0 && g.fh > 0 ? g : null; };
  const r2 = v => Math.round(v * 100) / 100;
  function patternPolys(fa) {      // مضلعات بنسب الإطار (x,y ∈ [0,1])
    const C = Math.max(1, Math.min(12, Math.round(Number(S.cols)) || 1)), R = Math.max(1, Math.min(12, Math.round(Number(S.rows)) || 1)), kn = Math.max(.5, Math.min(1.6, (Number(S.knob) || 100) / 100)), seed = (Math.random() * 1e9) | 0;
    let P; switch (S.pat) {
      case "grid": case "jigsaw": case "wave": P = edgePolys(S.pat, C, R, fa, kn, seed); break;
      case "tri": P = triPolys(C, R, fa); break; case "brick": P = brickPolys(C, R, fa); break; case "hex": P = hexPolys(C, fa); break; default: P = [];
    }
    return P.map(p => p.map(q => [q[0] / fa, q[1]]));
  }
  async function build(inf, polys) {
    const E = A().E, set0 = inf.set;
    if (!set0.src) { toast("ارفع صورة أولاً"); return; } if (set0.clip) { toast("ألغِ قناع الصورة قبل تقسيمها إلى بازل"); return; } if (E.dev !== "d") { toast("قسّم الصورة من عرض الحاسوب (المكتب)"); return; }
    if (!polys.length) { toast("تعذّر إنشاء القطع"); return; } if (polys.length > MAXP) { toast("عدد القطع كبير (" + polys.length + ") — الحد الأقصى " + MAXP); return; }
    A().prepMobile(inf.sec);
    const L = A().layoutOf(inf.node.id); if (!L || !L.width || !L.height) return; const Wf = L.width, Hf = L.height, fa = Wf / Hf, im = await loadImg(set0.src);
    // مكان الصورة المعروضة داخل الإطار الأصلي (نسب من الإطار): قصّ مخصّص، أو ملاءمة cover/contain/fill
    let ix = 0, iy = 0, iw = 1, ih = 1; const na = im && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0, cp = set0.crop && set0.crop.w ? set0.crop : null;
    if (na) { if (cp) { iw = cp.w / 100; ih = iw * fa / na; ix = cp.x / 100; iy = cp.y / 100; } else { const fit = set0.fit || "cover";
      if (fit === "fill") { iw = 1; ih = 1; } else { const wide = fa > na, cover = fit !== "contain"; if (wide === cover) { iw = 1; ih = fa / na; } else { ih = 1; iw = na / fa; } ix = (1 - iw) / 2; iy = (1 - ih) / 2; } } }
    const gid = PB.uid(), G = { d: geom(set0, "d"), m: geom(set0, "m") }; if (!G.d) { toast("تعذّر قراءة موضع الصورة"); return; }
    const ORIG = { src: set0.src, alt: set0.alt || "", link: set0.link || "", fit: set0.fit || "cover", crop: set0.crop ? JSON.parse(JSON.stringify(set0.crop)) : null, zi: Number(set0.zi) || 1, g: {} };
    ["d", "m"].forEach(dev => { const g = G[dev]; if (g) ORIG.g[dev] = [g.fx, g.fy, g.fwd, g.fh]; });      // الأصل لإعادة التقسيم أو إرجاع الصورة كاملة
    const pieces = polys.map(poly => {
      const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by; if (bw < .004 || bh < .004) return null;
      const w = PB.mkFree("image", 0, 0, Number(set0.zi) || 1), st = w.set;
      st.src = set0.src; st.alt = set0.alt || ""; if (set0.link) st.link = set0.link; st.fit = "fill";
      st.crop = { x: r2((ix - bx) / bw * 100), y: r2((iy - by) / bh * 100), w: r2(iw / bw * 100), h: r2(ih / bh * 100) };
      st.clip = "M" + poly.map(p => (+((p[0] - bx) / bw).toFixed(4)) + " " + (+((p[1] - by) / bh).toFixed(4))).join("L") + "Z";
      st.pz = gid; st.pzh = {}; st.pzs = true; st.zi = Number(set0.zi) || 1; st.pzo = ORIG;
      ["d", "m"].forEach(dev => { const g = G[dev]; if (!g) return; const fx = g.fx + bx * g.fwd, fy = g.fy + by * g.fh; PB.setR(st, "fx", dev, r2(fx)); PB.setR(st, "fy", dev, r2(fy)); PB.setR(st, "fwd", dev, r2(bw * g.fwd)); PB.setR(st, "fh", dev, r2(bh * g.fh)); st.pzh[dev] = [r2(fx), r2(fy)]; });
      return w; }).filter(Boolean);
    if (pieces.length < 2) { toast("لم تتكوّن قطع كافية"); return; }
    inf.list.splice(inf.idx, 1, ...pieces); E.nextLabel = "تقسيم بازل (" + pieces.length + " قطعة)"; A().commitAfter(pieces[0].id);
    toast("🧩 صارت الصورة " + pieces.length + " قطعة — اسحبها لتفصلها، وتتجاذب عند اقترابها");
  }

  /* ───────── اللوحة في الإعدادات ───────── */
  const group = inf => (inf.sec.free || []).filter(w => w.set.pz && w.set.pz === inf.set.pz);
  const home = (st, dev) => st.pzh && (st.pzh[dev] || st.pzh.d);
  function shapeUi(resplit) {
    const free = S.pat === "free", num = (k, mx) => `<input type="number" data-pzk="${k}" min="1" max="${mx}" value="${esc(S[k])}">`;
    return `<div class="pz-pats">${PATS.map(([k, n]) => `<button type="button" class="pz-pat${S.pat === k ? " on" : ""}" data-pzpat="${k}" title="${n}">${patThumb(k)}<span>${n}</span></button>`).join("")}</div>
${free ? `<p class="pz-h">ارسم على الصورة خطوطاً مستقيمة أو منحنية تقطعها من حافة إلى حافة؛ تتحوّل المناطق الناتجة إلى قطع.</p><button type="button" class="pbx-small pz-go" data-pz="${resplit ? "resplit" : "draw"}">✏️ ${resplit ? "أعد التقسيم: ارسم خطوطاً جديدة" : "ارسم خطوط التقسيم"}</button>`
      : `<div class="pz-g"><label>الأعمدة (أفقياً)${num("cols", 12)}</label>${S.pat === "hex" ? "" : `<label>الصفوف (عمودياً)${num("rows", 12)}</label>`}</div>
${S.pat === "jigsaw" || S.pat === "wave" ? `<label class="pz-r">${S.pat === "jigsaw" ? "حجم البروزات" : "عمق التموّج"} <input type="range" data-pzk="knob" min="60" max="150" value="${esc(S.knob)}"></label>` : ""}
${S.pv ? `<div class="pz-pend">👁 معاينة حيّة لخطوط التقسيم على الصفحة — غيّر النمط أو الأعمدة أو الصفوف وسترى النتيجة مباشرة<div class="pz-pb"><button type="button" class="pbx-small pz-yes" data-pz="${resplit ? "resplit" : "split"}">✓ تأكيد التقسيم</button><button type="button" class="pbx-small pz-no" data-pz="pvcancel">✕ إلغاء</button></div></div>` : `<button type="button" class="pbx-small pz-go" data-pz="pvshow">👁 معاينة التقسيم على الصفحة</button>`}`}`;
  }
  function panel(inf) {
    if (!inf || inf.kind !== "widget") return "";
    const st = inf.set; if (S.pvId !== inf.node.id) { S.pv = null; S.pvId = inf.node.id; }
    if (st.pz) { const n = group(inf).length;
      return `<div class="pbx-pz"><p>🧩 قطعة من بازل (${n} قطعة). اسحبها لتفصلها عن البقية؛ وعند اقترابها من موضعها الصحيح بجوار قطعة أخرى تنجذب إليه.</p>
<label class="pz-sw"><input type="checkbox" data-pzk="snap" ${st.pzs !== false ? "checked" : ""}> 🧲 التجاذب بين القطع</label>
<div class="pz-btns"><button type="button" class="pbx-small" data-pz="gather">↺ تجميع كل القطع</button><button type="button" class="pbx-small" data-pz="scatter">🎲 بعثرة كل القطع</button></div>
<div class="pz-sep">نوع البازل (يستبدل القطع الحالية)</div>${shapeUi(true)}<button type="button" class="pbx-small" data-pz="merge">↩ إرجاع الصورة كاملة</button></div>`; }
    if (!st.src) return `<div class="pbx-pz"><p>ارفع صورة أولاً ثم قسّمها إلى بازل.</p></div>`;
    return `<div class="pbx-pz"><p>قسّم الصورة إلى قطع منفصلة تتجاذب عند اقترابها. اختر الشكل:</p>${shapeUi(false)}
<p class="pz-h">يمكن التراجع بـ Ctrl+Z. القطع عناصر حرة يمكن تحريك كل واحدة وإعادة ترتيبها.</p></div>`;
  }
  /* خيارات اللوحة؛ تعيد true إن لزم إعادة رسم اللوحة */
  function opt(k, v) {
    if (k === "snap") { const inf = A().find(A().E.sel); if (inf && inf.set.pz) { group(inf).forEach(w => { w.set.pzs = !!v; }); A().E.nextLabel = "تجاذب البازل"; A().commitAfter(); } return false; }
    if (k === "pat") { S.pat = v; if (S.pv) showPrev(); return true; } S[k] = Number(v) || S[k]; if (S.pv) showPrev(); return false;
  }
  /* معاينة حيّة: مضلعات التقسيم فوق الصورة داخل الصفحة (لا تُحفظ حتى «تأكيد التقسيم») */
  function clearPrev() { try { const d = document.getElementById("pbx-frame").contentDocument; d.querySelectorAll(".pbx-pzprev").forEach(e => e.remove()); } catch (e) { } }
  function showPrev() {
    const inf = A().find(A().E.sel); if (!inf || inf.node.type !== "image" || !inf.set.src || inf.set.pz) return; const L = A().layoutOf(inf.node.id); if (!L) return;
    if (S.pat === "free") { S.pv = null; clearPrev(); return; }
    const polys = patternPolys(L.width / L.height); S.pv = polys; S.pvId = inf.node.id; clearPrev();
    try { const d = document.getElementById("pbx-frame").contentDocument, el = d.querySelector(`[data-pb="${inf.node.id}"]`); if (!el) return;
      el.insertAdjacentHTML("beforeend", `<svg class="pbx-pzprev" viewBox="0 0 1 1" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:7"><g fill="rgba(124,58,237,.10)" stroke="#7c3aed" stroke-width="2.2" vector-effect="non-scaling-stroke">${polys.map(p => `<polygon points="${p.map(q => q[0].toFixed(4) + "," + q[1].toFixed(4)).join(" ")}" vector-effect="non-scaling-stroke"/>`).join("")}</g></svg>`); } catch (e) { }
  }
  /* قطع قديمة بلا أصل محفوظ: يُشتقّ الأصل (إطار الصورة وقصّها) من مواضع القطع الأصلية وأقصاصها */
  function ensureOrig(inf) {
    if (inf.set.pzo) return true; const g = group(inf); if (!g.length) return false; const have = g.find(w => w.set.pzo); if (have) { g.forEach(w => { w.set.pzo = have.set.pzo; }); return true; }
    const f = g[0].set, cp = f.crop; if (!cp || !cp.w || !f.src) return false; const o = { src: f.src, alt: f.alt || "", link: f.link || "", fit: "fill", crop: null, zi: Number(f.zi) || 1, g: {} }, cr = {};
    for (const dev of ["d", "m"]) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, ok = true;
      g.forEach(w => { const h = w.set.pzh && w.set.pzh[dev], fw = Number(PB.eff(w.set, "fwd", dev)), fh = Number(PB.eff(w.set, "fh", dev)); if (!h || !(fw > 0) || !(fh > 0)) { ok = false; return; } x0 = Math.min(x0, h[0]); y0 = Math.min(y0, h[1]); x1 = Math.max(x1, h[0] + fw); y1 = Math.max(y1, h[1] + fh); });
      if (!ok) { if (dev === "d") return false; continue; }
      o.g[dev] = [r2(x0), r2(y0), r2(x1 - x0), r2(y1 - y0)]; const h0 = f.pzh[dev], fw0 = Number(PB.eff(f, "fwd", dev)), fh0 = Number(PB.eff(f, "fh", dev));
      if (dev === "d") { cr.x = (h0[0] + cp.x / 100 * fw0 - x0) / (x1 - x0) * 100; cr.y = (h0[1] + cp.y / 100 * fh0 - y0) / (y1 - y0) * 100; cr.w = cp.w / 100 * fw0 / (x1 - x0) * 100; } }
    o.crop = { x: r2(cr.x), y: r2(cr.y), w: r2(cr.w) }; g.forEach(w => { w.set.pzo = o; }); return true;
  }
  /* يدمج قطع المجموعة في عنصر الصورة الأصلي (بأصله المحفوظ) ويعيده */
  function restore(inf) {
    const o = inf.set.pzo; if (!o || !o.src) return null; const g = group(inf), L = inf.sec.free; if (!g.length) return null;
    const w = PB.mkFree("image", 0, 0, o.zi || 1), st = w.set; st.src = o.src; st.alt = o.alt || ""; if (o.link) st.link = o.link; st.fit = o.fit || "cover"; if (o.crop) st.crop = JSON.parse(JSON.stringify(o.crop)); st.zi = o.zi || 1;
    ["d", "m"].forEach(dev => { const q = o.g && o.g[dev]; if (q) { PB.setR(st, "fx", dev, q[0]); PB.setR(st, "fy", dev, q[1]); PB.setR(st, "fwd", dev, q[2]); PB.setR(st, "fh", dev, q[3]); } });
    const pos = L.slice(0, L.indexOf(g[0])).filter(x => !g.includes(x)).length, rest = L.filter(x => !g.includes(x)); rest.splice(pos, 0, w); L.length = 0; L.push(...rest);
    A().E.sel = w.id; return w;
  }
  function act(name, inf) {
    const E = A().E;
    if (name === "pvshow") { showPrev(); if (S.pv) A().renderInspectorNow && A().renderInspectorNow(); return; }
    if (name === "pvcancel") { S.pv = null; clearPrev(); return; }
    if (name === "split") { const L = A().layoutOf(inf.node.id); if (!L) return; const pv = S.pv; S.pv = null; clearPrev(); build(inf, pv && pv.length ? pv : patternPolys(L.width / L.height)); return; }
    if (name === "draw") return startDraw(inf);
    if (name === "merge" || name === "resplit") {
      if (E.dev !== "d") { toast("غيّر البازل من عرض الحاسوب (المكتب)"); return; } ensureOrig(inf); const w = restore(inf); if (!w) { toast("لا يوجد أصل محفوظ لهذه القطع"); return; }
      if (name === "merge") { E.nextLabel = "إرجاع الصورة كاملة"; A().commitAfter(w.id); toast("↩ عادت الصورة كاملة"); return; }
      A().renderCanvas(); const i2 = A().find(w.id); if (!i2) return;
      if (S.pat === "free") { E.nextLabel = "إرجاع الصورة للتقسيم"; A().commitAfter(w.id); setTimeout(() => startDraw(A().find(w.id)), 60); return; }
      const L = A().layoutOf(w.id); if (!L) return; const pv = S.pv; S.pv = null; clearPrev(); build(i2, pv && pv.length ? pv : patternPolys(L.width / L.height)); return;
    }
    if (!inf.set.pz) return; const g = group(inf), sec = inf.sec;
    if (name === "gather") { g.forEach(w => ["d", "m"].forEach(dev => { const h = w.set.pzh && w.set.pzh[dev]; if (h) { PB.setR(w.set, "fx", dev, h[0]); PB.setR(w.set, "fy", dev, h[1]); } })); E.nextLabel = "تجميع البازل"; A().commitAfter(); toast("↺ جُمعت " + g.length + " قطعة في مواضعها"); return; }
    if (name === "scatter") {      // بعثرة كل القطع حول منطقة الصورة (لا تبقى أي قطعة في مكانها)
      const dev = E.dev, mh = Number(PB.eff(sec.set, "mh", dev)) || 600, rr = rnd((Math.random() * 1e9) | 0), hy = g.map(w => Number(PB.eff(w.set, "fy", dev)) || 0), hh = g.map(w => Number(PB.eff(w.set, "fh", dev)) || 100);
      const y0 = Math.max(0, Math.min(...hy) - 60), y1 = Math.min(mh, Math.max(...hy.map((v, i) => v + hh[i])) + 240);
      g.forEach((w, i) => { const wd = Number(PB.eff(w.set, "fwd", dev)) || 20, ox = Number(PB.eff(w.set, "fx", dev)) || 0, oy = hy[i], H = hh[i]; let nx = ox, ny = oy;
        for (let k = 0; k < 14; k++) { nx = r2(rr() * Math.max(0, 100 - wd)); ny = r2(y0 + rr() * Math.max(0, y1 - y0 - H)); if (Math.abs(nx - ox) > 8 || Math.abs(ny - oy) > 40) break; }
        PB.setR(w.set, "fx", dev, nx); PB.setR(w.set, "fy", dev, ny); if (dev !== "d" && PB.own(w.set, "fx", "d") === undefined) { const h = home(w.set, "d"); if (h) { PB.setR(w.set, "fx", "d", h[0]); PB.setR(w.set, "fy", "d", h[1]); } } });
      E.nextLabel = "بعثرة البازل"; A().commitAfter(); toast("🎲 بُعثرت " + g.length + " قطعة"); }
  }
  /* تجاذب أثناء السحب: يعيد الموضع الصحيح إن قرُبت القطعة من موضعها الصحيح نسبةً إلى قطعة أخرى من المجموعة */
  function snap(inf, X, Y, cw, u, dev) {
    const me = inf.node.set; if (!me.pz || me.pzs === false) return null; const hm = home(me, dev); if (!hm) return null; let best = null, bd = SNAP_PX / (A().E.scale || 1);      // العتبة بالبكسل على الشاشة (لا بوحدات الصفحة)
    (inf.sec.free || []).forEach(q => { if (q === inf.node || q.set.pz !== me.pz) return; const hq = home(q.set, dev); if (!hq) return;
      const qx = Number(PB.eff(q.set, "fx", dev)), qy = Number(PB.eff(q.set, "fy", dev)); if (!fin(qx) || !fin(qy)) return;
      const ex = qx + (hm[0] - hq[0]), ey = qy + (hm[1] - hq[1]), d = Math.hypot(X - ex / 100 * cw, Y - ey * u); if (d < bd) { bd = d; best = { x: ex / 100 * cw, y: ey * u, fx: ex, fy: ey }; } });
    return best;
  }

  /* ───────── وضع الرسم الحر ───────── */
  function css() {
    if (document.getElementById("pz-css")) return; const st = document.createElement("style"); st.id = "pz-css";
    st.textContent = `.pbx-pz .pz-pats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.3rem}.pbx-pz .pz-pat{display:flex;align-items:center;gap:.4rem;border:1.5px solid #e6e0d0;background:#fff;border-radius:9px;padding:.25rem .4rem;cursor:pointer;font-family:inherit;font-size:.72rem;font-weight:700;color:#173f35;text-align:start}.pbx-pz .pz-pat.on{border-color:#7c3aed;background:#ede9fe;color:#5b21b6}.pbx-pz .pz-pat .pbx-thumb{width:30px;height:30px;flex:none}.pbx-pz .pz-pend{background:#ecfdf5;border:1.5px solid #86d4b0;border-radius:10px;padding:.5rem;font-size:.76rem;font-weight:700;color:#14573b;line-height:1.7}.pbx-pz .pz-pb{display:flex;gap:.4rem;margin-top:.4rem}.pbx-pz .pz-yes{background:#0d9488;color:#fff;border:0;flex:1;padding:.5rem}.pbx-pz .pz-no{background:#fff;color:#b91c1c;border:1.5px solid #fca5a5;flex:1;padding:.5rem}.pbx-pz{display:flex;flex-direction:column;gap:.45rem;font-size:.8rem}.pbx-pz p{margin:0;color:#6b6556;line-height:1.7}.pbx-pz .pz-h{font-size:.72rem}.pbx-pz select,.pbx-pz input[type=number]{width:100%;border:1px solid #d9dbe3;border-radius:8px;padding:.35rem;font-family:inherit}
.pz-sep{font-weight:800;font-size:.76rem;color:#6d28d9;border-top:1px solid #e3e0f0;padding-top:.5rem;margin-top:.15rem}.pz-g{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}.pz-g label,.pz-r{display:flex;flex-direction:column;gap:.2rem;font-weight:700;font-size:.74rem}.pz-sw{display:flex;gap:.4rem;align-items:center;font-weight:700;cursor:pointer}.pz-btns{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}
.pbx-pz .pz-go{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;border:0;padding:.55rem;font-size:.85rem}
.pz-layer{position:fixed;z-index:10050;cursor:crosshair;touch-action:none;outline:2px dashed #7c3aed;background:rgba(124,58,237,.06)}.pz-layer svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.pz-bar{position:fixed;z-index:10051;display:flex;gap:4px;align-items:center;background:#fff;border-radius:12px;padding:5px 8px;box-shadow:0 4px 16px rgba(124,58,237,.35),0 0 0 2px #a855f7;direction:rtl;font-family:inherit}.pz-bar button{border:0;border-radius:9px;padding:.4rem .6rem;font-family:inherit;font-weight:800;font-size:.8rem;cursor:pointer;background:#f1f2f6;color:#1f2430}.pz-bar button.on{background:#ede9fe;color:#6d28d9;box-shadow:inset 0 0 0 1.5px #7c3aed}.pz-bar button.ok{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff}.pz-bar button.no{color:#b83232}.pz-bar button:disabled{opacity:.45}.pz-bar span{font-size:.74rem;color:#6d28d9;font-weight:800;padding:0 .3rem}`;
    document.head.appendChild(st);
  }
  const toast = m => { const t = document.getElementById("pbx-msg"); if (!t) return; t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 4200); };
  function stopDraw() { if (!D) return; window.removeEventListener("scroll", D.pos, true); window.removeEventListener("resize", D.pos); document.removeEventListener("keydown", D.key, true); D.layer.remove(); D.bar.remove(); D = null; }
  function startDraw(inf) {
    css(); stopDraw(); const id = inf.node.id;
    if (!inf.set.src) { toast("ارفع صورة أولاً"); return; } if (A().E.dev !== "d") { toast("قسّم الصورة من عرض الحاسوب (المكتب)"); return; }
    const layer = document.createElement("div"), bar = document.createElement("div"); layer.className = "pz-layer"; bar.className = "pz-bar";
    layer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`; document.body.append(layer, bar);
    D = { id, layer, bar, svg: layer.firstChild, tool: "line", strokes: [], cur: null };
    const draw = () => { const w = layer.clientWidth, h = layer.clientHeight, P = s => s.map((p, i) => (i ? "L" : "M") + (p[0] * w).toFixed(1) + " " + (p[1] * h).toFixed(1)).join("");
      D.svg.innerHTML = D.strokes.concat(D.cur ? [D.cur] : []).map(s => `<path d="${P(s)}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="${P(s)}" fill="none" stroke="#7c3aed" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
      bar.querySelector("[data-d=ok]").disabled = !D.strokes.length; bar.querySelector("[data-d=undo]").disabled = !D.strokes.length; };
    D.pos = () => { if (!D) return; const L = A().layoutOf(id), fw = document.getElementById("pbx-fw"); if (!L || !fw) return stopDraw(); const f = fw.getBoundingClientRect(), s = A().E.scale;
      layer.style.cssText = `left:${f.left + L.left * s}px;top:${f.top + L.top * s}px;width:${L.width * s}px;height:${L.height * s}px`;
      const bh = bar.offsetHeight || 40; let ty = f.top + L.top * s - bh - 10; if (ty < 8) ty = Math.min(innerHeight - bh - 8, f.top + (L.top + L.height) * s + 10);
      bar.style.top = ty + "px"; bar.style.left = Math.max(6, Math.min(innerWidth - bar.offsetWidth - 6, f.left + (L.left + L.width / 2) * s - bar.offsetWidth / 2)) + "px"; draw(); };
    bar.innerHTML = `<span>✏️ ارسم خطوط التقسيم</span><button type="button" data-d="line" class="on">— مستقيم</button><button type="button" data-d="curve">〰 منحنى</button><button type="button" data-d="undo">↶ تراجع</button><button type="button" data-d="clear">🗑 مسح</button><button type="button" data-d="ok" class="ok">✓ قسّم</button><button type="button" data-d="no" class="no">✕ إلغاء</button>`;
    bar.onclick = async ev => { const b = ev.target.closest("[data-d]"); if (!b || b.disabled) return; const k = b.dataset.d;
      if (k === "line" || k === "curve") { D.tool = k; bar.querySelectorAll("[data-d=line],[data-d=curve]").forEach(x => x.classList.toggle("on", x === b)); }
      else if (k === "undo") { D.strokes.pop(); draw(); } else if (k === "clear") { D.strokes = []; draw(); } else if (k === "no") stopDraw();
      else if (k === "ok") { const L = A().layoutOf(id), inf2 = A().find(id); if (!L || !inf2) return stopDraw(); const polys = regionsFromStrokes(D.strokes, L.width / L.height); stopDraw(); if (polys.length < 2) { toast("ارسم خطاً (أو أكثر) يقطع الصورة من حافة إلى حافة ليقسمها"); return; } await build(inf2, polys); } };
    D.key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stopDraw(); } };
    const pt = e => { const r = layer.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
    const ext = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; if (Math.hypot(dx, dy) < 1e-6) return [a, b]; const lim = (p, sx, sy) => { let t = 1e9; if (sx > 1e-9) t = Math.min(t, (1 - p[0]) / sx); else if (sx < -1e-9) t = Math.min(t, (0 - p[0]) / sx); if (sy > 1e-9) t = Math.min(t, (1 - p[1]) / sy); else if (sy < -1e-9) t = Math.min(t, (0 - p[1]) / sy); return [p[0] + sx * t, p[1] + sy * t]; };
      return [lim(a, -dx, -dy), lim(b, dx, dy)]; };
    const edge = p => { const T = .07, o = p.slice(); if (o[0] < T) o[0] = 0; else if (o[0] > 1 - T) o[0] = 1; if (o[1] < T) o[1] = 0; else if (o[1] > 1 - T) o[1] = 1; return o; };
    const chaikin = (P, n) => { for (let k = 0; k < n; k++) { const o = [P[0]]; for (let i = 0; i < P.length - 1; i++) { o.push([.75 * P[i][0] + .25 * P[i + 1][0], .75 * P[i][1] + .25 * P[i + 1][1]], [.25 * P[i][0] + .75 * P[i + 1][0], .25 * P[i][1] + .75 * P[i + 1][1]]); } o.push(P[P.length - 1]); P = o; } return P; };
    layer.addEventListener("pointerdown", e => { if (e.button) return; e.preventDefault(); layer.setPointerCapture(e.pointerId); const p = pt(e); D.start = p; D.cur = [p, p]; D.raw = [p]; draw(); });
    layer.addEventListener("pointermove", e => { if (!D || !D.cur) return; const p = pt(e); if (D.tool === "line") D.cur = [D.start, p]; else { const l = D.raw[D.raw.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > .004) D.raw.push(p); D.cur = D.raw.slice(); } draw(); });
    layer.addEventListener("pointerup", e => { if (!D || !D.cur) return; const p = pt(e); let s;
      if (D.tool === "line") { if (Math.hypot(p[0] - D.start[0], p[1] - D.start[1]) < .02) { D.cur = null; draw(); return; } s = ext(D.start, p); }
      else { let R = D.raw.concat([p]); if (R.length < 4) { D.cur = null; draw(); return; } R = rdp(R, .004, false); R = chaikin(R, 3); R[0] = edge(R[0]); R[R.length - 1] = edge(R[R.length - 1]); s = R; }
      D.strokes.push(s); D.cur = null; draw(); });
    window.addEventListener("scroll", D.pos, true); window.addEventListener("resize", D.pos); document.addEventListener("keydown", D.key, true); D.pos();
    toast("ارسم خطاً مستقيماً (يمتد تلقائياً حتى الحواف) أو منحنياً من حافة إلى حافة، ثم اضغط «قسّم»");
  }
  return { panel, opt, act, snap, S, stopDraw, _t: { edgePolys, regionsFromStrokes, hexPolys, triPolys, brickPolys, knobEdge } };
})();
