/* «لمسات وتصحيح» (المرحلة 3 من platform/docs/photoroom-tools-report.md): أدوات تحسين وتصحيح للصورة داخل المتصفح وبلا API ولا ذكاء اصطناعي:
   تحسين تلقائي (توازن مستويات + ألوان) · تقليل الضوضاء · تصحيح انحراف المنظور · تغيير لون جزء من المنتج (بالنقر عليه) · قص الحواف الفارغة · تعتيم الأطراف (vignette) · حبيبات.
   كل عملية دالة نقية على Canvas (قابلة للاختبار عبر PBRetouch._t) تُطبَّق على نسخة عمل داخل اللوحة ثم «تطبيق على الصورة» يرفعها ويستبدل مصدر العنصر. */
const PBRetouch = (() => {
  const A = () => PBApp;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const ctx2 = c => c.getContext("2d", { willReadFrequently: true });
  const clone = c => { const o = mk(c.width, c.height); ctx2(o).drawImage(c, 0, 0); return o; };
  const cap = (c, max) => { const k = Math.min(1, max / Math.max(c.width, c.height)); if (k >= 1) return c; const o = mk(c.width * k, c.height * k); ctx2(o).drawImage(c, 0, 0, o.width, o.height); return o; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ── RGB ⇄ HSL ── */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }
  const hexRgb = hex => { let x = String(hex || "#000").replace("#", ""); if (x.length === 3) x = x.replace(/./g, "$&$&"); const n = parseInt(x, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  /* ── العمليات النقية (تُرجع قماشاً جديداً) ── */
  /* تحسين تلقائي: مدّ المستويات لكل قناة (قصّ 0.5% من الطرفين) + توازن رمادي محدود + تشبّع خفيف؛ يتجاهل البكسلات الشفافة */
  function autoEnhance(src) {
    const c = clone(src), g = ctx2(c), im = g.getImageData(0, 0, c.width, c.height), d = im.data, n = d.length / 4, H = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]; let cnt = 0, sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < n; i++) { if (d[i * 4 + 3] < 20) continue; cnt++; H[0][d[i * 4]]++; H[1][d[i * 4 + 1]]++; H[2][d[i * 4 + 2]]++; sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; }
    if (!cnt) return c;
    const lo = [0, 0, 0], hi = [255, 255, 255], cut = cnt * .006;
    for (let k = 0; k < 3; k++) { let a = 0; for (let v = 0; v < 256; v++) { a += H[k][v]; if (a > cut) { lo[k] = v; break; } } a = 0; for (let v = 255; v >= 0; v--) { a += H[k][v]; if (a > cut) { hi[k] = v; break; } } if (hi[k] - lo[k] < 40) { lo[k] = 0; hi[k] = 255; } }
    const avg = (sr + sg + sb) / (3 * cnt), wb = [clamp(avg / (sr / cnt || 1), .86, 1.14), clamp(avg / (sg / cnt || 1), .86, 1.14), clamp(avg / (sb / cnt || 1), .86, 1.14)];
    /* متوسط الإضاءة بعد مدّ المستويات ← جاما تقرّبه من 0.5 (تفتيح الصور الداكنة وتخفيف الساطعة) */
    let ml = 0, mn = 0; const st = Math.max(1, Math.floor(n / 40000));
    for (let i = 0; i < n; i += st) { if (d[i * 4 + 3] < 20) continue; const r = clamp((d[i * 4] - lo[0]) / (hi[0] - lo[0]), 0, 1), gg = clamp((d[i * 4 + 1] - lo[1]) / (hi[1] - lo[1]), 0, 1), b = clamp((d[i * 4 + 2] - lo[2]) / (hi[2] - lo[2]), 0, 1); ml += .299 * r + .587 * gg + .114 * b; mn++; }
    const gam = mn ? clamp(Math.log(.5) / Math.log(clamp(ml / mn, .06, .94)), .72, 1.45) : 1, ig = 1 / gam;
    for (let i = 0; i < n; i++) {
      if (d[i * 4 + 3] < 1) continue; let r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
      r = clamp((r - lo[0]) / (hi[0] - lo[0]) * wb[0], 0, 1); gg = clamp((gg - lo[1]) / (hi[1] - lo[1]) * wb[1], 0, 1); b = clamp((b - lo[2]) / (hi[2] - lo[2]) * wb[2], 0, 1);
      r = Math.pow(r, ig); gg = Math.pow(gg, ig); b = Math.pow(b, ig);
      const sc = v => v + .16 * (v * v * (3 - 2 * v) - v);      /* منحنى S خفيف لتباين أفضل */
      const [h, s, l] = rgb2hsl(sc(r) * 255, sc(gg) * 255, sc(b) * 255), o = hsl2rgb(h, clamp(s * 1.14, 0, 1), l); d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2];
    }
    g.putImageData(im, 0, 0); return c;
  }
  /* ضبط سطوع/تباين/تشبّع/حرارة (-100..100) بالبكسل — لا يعتمد على ctx.filter */
  function adjust(src, o) {
    const c = clone(src), g = ctx2(c), im = g.getImageData(0, 0, c.width, c.height), d = im.data, br = (o.br || 0) / 100, ct = 1 + (o.ct || 0) / 100, sa = 1 + (o.sa || 0) / 100, wm = (o.wm || 0) * .7;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 2) continue; let r = d[i], gg = d[i + 1], b = d[i + 2];
      r = (r - 128) * ct + 128 + br * 128; gg = (gg - 128) * ct + 128 + br * 128; b = (b - 128) * ct + 128 + br * 128;
      const l = .299 * r + .587 * gg + .114 * b; r = l + (r - l) * sa + wm; gg = l + (gg - l) * sa + wm * .25; b = l + (b - l) * sa - wm;
      d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(b, 0, 255);
    }
    g.putImageData(im, 0, 0); return c;
  }
  /* حدّة (Unsharp Mask 3×3): amt 0..100 */
  function sharpen(src, amt) {
    const k = clamp(amt, 0, 100) / 100 * 1.6, c = clone(src), w = c.width, h = c.height, g = ctx2(c), im = g.getImageData(0, 0, w, h), d = im.data, o = new Uint8ClampedArray(d); if (!k) return c;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4; if (d[i + 3] < 8) continue;
      for (let ch = 0; ch < 3; ch++) { const a = (d[i + ch - 4] + d[i + ch + 4] + d[i + ch - w * 4] + d[i + ch + w * 4] + d[i + ch - 4 - w * 4] + d[i + ch + 4 - w * 4] + d[i + ch - 4 + w * 4] + d[i + ch + 4 + w * 4] + d[i + ch]) / 9; o[i + ch] = d[i + ch] + (d[i + ch] - a) * k; }
    }
    im.data.set(o); g.putImageData(im, 0, 0); return c;
  }
  const mix = (a, b, t) => { const o = clone(a), g = ctx2(o); g.globalAlpha = clamp(t, 0, 1); g.drawImage(b, 0, 0); return o; };
  /* تقليل الضوضاء: متوسط ثنائي الجانب 3×3 (يحفظ الحواف)؛ strength 1..3 يرفع عتبة التشابه */
  function denoise(src, strength) {
    const s = clamp(Math.round(strength) || 1, 1, 3), T = [0, 18, 32, 52][s], c0 = cap(src, 3000), c = c0 === src ? clone(src) : c0, w = c.width, h = c.height, g = ctx2(c), im = g.getImageData(0, 0, w, h), d = im.data, o = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4; if (d[i + 3] < 8) continue; let sr = 0, sg = 0, sb = 0, sw = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = ((y + dy) * w + x + dx) * 4, df = Math.abs(d[j] - d[i]) + Math.abs(d[j + 1] - d[i + 1]) + Math.abs(d[j + 2] - d[i + 2]); if (df > T * 3) continue;
        const wt = (dx || dy ? 1 : 2) * (1 - df / (T * 3 + 1)); sr += d[j] * wt; sg += d[j + 1] * wt; sb += d[j + 2] * wt; sw += wt;
      }
      if (sw) { o[i] = sr / sw; o[i + 1] = sg / sw; o[i + 2] = sb / sw; }
    }
    im.data.set(o); g.putImageData(im, 0, 0); return c;
  }
  /* تصحيح انحراف المنظور (تقريبي): v = انحراف رأسي (موجب = الأعلى أضيق فيُعاد فتحه)، h = أفقي؛ بالنسبة المئوية (-40..40). الزوايا الفارغة تبقى شفافة */
  function keystone(src, v, hh) {
    const W = src.width, H = src.height; let cur = src;
    if (v) { const o = mk(W, H), g = ctx2(o), k = clamp(v, -40, 40) / 100; for (let y = 0; y < H; y++) { const s = 1 - k * (1 - y / H) * 2 + k; const sc = clamp(s, .3, 3); g.drawImage(cur, 0, y, W, 1, (W - W * sc) / 2, y, W * sc, 1); } cur = o; }
    if (hh) { const o = mk(W, H), g = ctx2(o), k = clamp(hh, -40, 40) / 100; for (let x = 0; x < W; x++) { const s = 1 - k * (1 - x / W) * 2 + k; const sc = clamp(s, .3, 3); g.drawImage(cur, x, 0, 1, H, x, (H - H * sc) / 2, 1, H * sc); } cur = o; }
    return cur === src ? clone(src) : cur;
  }
  /* لون نقطة (متوسط 5×5) من قماش */
  function pick(c, x, y) {
    const g = ctx2(c), r = 2, x0 = clamp(Math.round(x) - r, 0, c.width - 1), y0 = clamp(Math.round(y) - r, 0, c.height - 1), w = Math.min(2 * r + 1, c.width - x0), h = Math.min(2 * r + 1, c.height - y0), d = g.getImageData(x0, y0, w, h).data; let R = 0, G = 0, B = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
    return n ? [Math.round(R / n), Math.round(G / n), Math.round(B / n)] : null;
  }
  /* تغيير لون جزء: البكسلات القريبة من اللون المنقور (فرق درجة اللون ≤ tol، أو فرق الإضاءة للألوان المحايدة) تُحوَّل إلى اللون الهدف بحفظ الإضاءة */
  function recolor(src, o) {
    const c = clone(src), g = ctx2(c), im = g.getImageData(0, 0, c.width, c.height), d = im.data, p = o.from, [ph, ps, pl] = rgb2hsl(p[0], p[1], p[2]), [th, ts] = rgb2hsl(o.to[0], o.to[1], o.to[2]), tol = clamp(o.tol || 24, 4, 90), neutral = ps < .14;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue; const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]); let w;
      if (neutral) { if (s > .24) continue; w = 1 - Math.abs(l - pl) / (tol / 100 + .06); }
      else { if (s < .1) continue; let dh = Math.abs(h - ph); dh = dh > 180 ? 360 - dh : dh; w = 1 - dh / tol; }
      if (w <= 0) continue; w = Math.min(1, w * 1.4);
      const ns = neutral ? clamp(ts, 0, 1) : clamp(s * (ts / (ps || 1)), 0, 1), nl = o.keepL === false ? rgb2hsl(o.to[0], o.to[1], o.to[2])[2] : l, r = hsl2rgb(th, neutral ? ts : ns, nl);
      d[i] = d[i] + (r[0] - d[i]) * w; d[i + 1] = d[i + 1] + (r[1] - d[i + 1]) * w; d[i + 2] = d[i + 2] + (r[2] - d[i + 2]) * w;
    }
    g.putImageData(im, 0, 0); return c;
  }
  /* قص الحواف الفارغة: الشفافة، وإلا المتجانسة بلون الزوايا؛ pad = هامش % من الأبعاد */
  function trim(src, pad) {
    const w = src.width, h = src.height, g = ctx2(src), d = g.getImageData(0, 0, w, h).data; let hasA = false;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) { hasA = true; break; }
    const c0 = [d[0], d[1], d[2]], tol = 14, empty = i => hasA ? d[i + 3] < 12 : (Math.abs(d[i] - c0[0]) + Math.abs(d[i + 1] - c0[1]) + Math.abs(d[i + 2] - c0[2]) < tol * 3);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!empty((y * w + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return clone(src);
    const px = Math.round((x1 - x0 + 1) * clamp(pad || 0, 0, 40) / 100), py = Math.round((y1 - y0 + 1) * clamp(pad || 0, 0, 40) / 100);
    const X0 = Math.max(0, x0 - px), Y0 = Math.max(0, y0 - py), X1 = Math.min(w, x1 + 1 + px), Y1 = Math.min(h, y1 + 1 + py), o = mk(X1 - X0, Y1 - Y0); ctx2(o).drawImage(src, X0, Y0, X1 - X0, Y1 - Y0, 0, 0, X1 - X0, Y1 - Y0); return o;
  }
  function vignette(src, k) {
    const c = clone(src), g = ctx2(c), a = clamp(k, 0, 100) / 100; if (!a) return c; g.globalCompositeOperation = "source-atop";
    const gr = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * .28, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) / 2); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0," + (a * .75).toFixed(3) + ")");
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = "source-over"; return c;
  }
  function grain(src, k, seed) {
    const c = clone(src), g = ctx2(c), a = clamp(k, 0, 100) * .6, im = g.getImageData(0, 0, c.width, c.height), d = im.data; let s = (seed || 7) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; const n = (rnd() - .5) * a; d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255); }
    g.putImageData(im, 0, 0); return c;
  }
  const hasAlpha = c => { const t = cap(c, 64), d = ctx2(t).getImageData(0, 0, t.width, t.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 240) return true; return false; };

  /* ── المعاينة المباشرة على الصفحة ── */
  const P0 = () => ({ auto: 0, dn: 0, kv: 0, kh: 0, br: 0, ct: 0, sa: 0, wm: 0, sh: 0, vg: 0, gr: 0, trim: false, pad: 4, recol: [] });
  const S = { id: "", src: "", base: null, prev: null, P: P0(), pickMode: false, from: null, busy: false, msg: "", tok: 0, t: 0 };
  const $ = id => document.getElementById(id);
  const dirty = P => P.auto || P.dn || P.kv || P.kh || P.br || P.ct || P.sa || P.wm || P.sh || P.vg || P.gr || P.trim || P.recol.length;
  /* خط المعالجة: الأعمال تُحسب دائماً من الأصل بالمعاملات الحالية فلا تتراكم ولا تحتاج «تراجع» */
  function run(base, P) {
    let c = base;
    if (P.auto > 0) { const e = autoEnhance(c); c = P.auto >= 100 ? e : mix(c, e, P.auto / 100); }
    if (P.dn) c = denoise(c, P.dn);
    if (P.kv || P.kh) c = keystone(c, P.kv, P.kh);
    P.recol.forEach(r => { c = recolor(c, r); });
    if (P.br || P.ct || P.sa || P.wm) c = adjust(c, P);
    if (P.sh) c = sharpen(c, P.sh);
    if (P.vg) c = vignette(c, P.vg);
    if (P.gr) c = grain(c, P.gr, 7);
    if (P.trim) c = trim(c, P.pad);
    return c;
  }
  const sl = (k, t, min, max) => `<label>${t} <b id="pbrt-v-${k}">${S.P[k]}</b><input type="range" data-rtk="${k}" min="${min}" max="${max}" value="${S.P[k]}"></label>`;
  function panel() {
    const P = S.P;
    return `<div class="pbx-pz" id="pbrt"><p>كل تعديل يظهر مباشرة على الصورة في الصفحة (لا يتراكم: يُحسب من الأصل). عند الرضا اضغط «تنفيذ» تحت الصورة، أو «إلغاء».</p>
<div class="rt-g"><b>✨ تلقائي</b>${sl("auto", "تحسين تلقائي %", 0, 100)}<label>تقليل الضوضاء <select data-rtk="dn" class="pbx-small">${["بلا", "خفيف", "متوسط", "قوي"].map((t, i) => `<option value="${i}"${P.dn === i ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>
<div class="rt-g"><b>🎚 ضبط الضوء واللون</b>${sl("br", "السطوع", -60, 60)}${sl("ct", "التباين", -60, 60)}${sl("sa", "التشبّع", -100, 100)}${sl("wm", "الحرارة (دافئ/بارد)", -50, 50)}${sl("sh", "الحدّة", 0, 100)}</div>
<div class="rt-g"><b>📐 تصحيح المنظور</b>${sl("kv", "انحراف رأسي", -30, 30)}${sl("kh", "انحراف أفقي", -30, 30)}</div>
<div class="rt-g"><b>🎨 تغيير لون جزء من المنتج</b><div class="pbrt-row"><button type="button" class="pbx-small" data-rt="pick" id="pbrt-pk">① انقر على اللون في المصغّرة</button><span id="pbrt-sw" style="display:inline-block;width:22px;height:22px;border-radius:50%;border:1px solid #888;background:${S.from ? "rgb(" + S.from.join(",") + ")" : "#ccc"}"></span><input type="color" id="pbrt-to" value="#2f7d4f" title="اللون الجديد"></div>
<div id="pbrt-pvw" style="background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/14px 14px;border-radius:8px;overflow:hidden;text-align:center"><canvas id="pbrt-pv" style="max-width:100%;cursor:default"></canvas></div>
<label>التسامح <input type="range" id="pbrt-tol" min="6" max="70" value="26"></label><button type="button" class="pbx-small" data-rt="recolor">② غيّر اللون (يظهر على الصورة)</button>
<div>${P.recol.map((r, i) => `<span class="pbx-small" style="display:inline-flex;gap:.3rem;align-items:center;margin:.15rem"><i style="width:14px;height:14px;border-radius:50%;background:rgb(${r.from.join(",")})"></i>←<i style="width:14px;height:14px;border-radius:50%;background:rgb(${r.to.join(",")})"></i><button type="button" data-rt="rm" data-i="${i}" style="border:0;background:none;cursor:pointer">✕</button></span>`).join("")}</div></div>
<div class="rt-g"><b>🖼 لمسات أخيرة</b>${sl("vg", "تعتيم الأطراف", 0, 100)}${sl("gr", "حبيبات", 0, 100)}<label><input type="checkbox" data-rtk="trim" ${P.trim ? "checked" : ""}> قص الحواف الفارغة</label>${sl("pad", "هامش القص %", 0, 20)}</div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-rt="reset">↺ إعادة الضبط</button></div><div id="pbrt-msg" class="ep-n" style="min-height:1.3em">${esc(S.msg)}</div></div>`;
  }
  const msg = t => { S.msg = t; const e = $("pbrt-msg"); if (e) e.textContent = t; };
  function loadImg(src) {
    return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = mk(im.naturalWidth, im.naturalHeight); ctx2(c).drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  }
  function drawMini() { const cv = $("pbrt-pv"); if (!cv || !S.prev) return; const k = Math.min(1, 240 / Math.max(S.prev.width, S.prev.height)); cv.width = Math.max(1, Math.round(S.prev.width * k)); cv.height = Math.max(1, Math.round(S.prev.height * k)); cv.getContext("2d").drawImage(S.prev, 0, 0, cv.width, cv.height); }
  async function preview() {
    if (!S.prev) return; const tok = ++S.tok;
    if (!dirty(S.P)) { A().liveClear(true); return; }
    await new Promise(r => setTimeout(r, 0)); if (tok !== S.tok) return;
    let out; try { out = run(S.prev, S.P); } catch (e) { return msg("⚠️ " + (e.message || e)); }
    if (tok !== S.tok) return; await A().liveCanvas(S.id, out, { tab: "rt", apply, cancel });
  }
  const later = () => { clearTimeout(S.t); S.t = setTimeout(preview, 70); };
  function cancel() { S.tok++; clearTimeout(S.t); S.P = P0(); S.from = null; S.pickMode = false; msg(""); }
  async function apply() {
    if (S.busy || !S.base || !dirty(S.P)) return; S.busy = true; msg("⏳ جارٍ التنفيذ…");
    try {
      const out = run(S.base, S.P), png = hasAlpha(out), blob = await new Promise(r => out.toBlob(r, png ? "image/png" : "image/webp", .93)), path = await A().uploadBlob(blob, "rt-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id);
      if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "لمسات وتصحيح الصورة"; S.src = path; S.base = cap(out, 3600); S.prev = cap(out, 1100); S.P = P0(); S.from = null; A().liveClear(false); A().commitAfter(S.id); msg("✅ نُفِّذ على الصورة"); }
    } catch (e) { msg("⚠️ " + (e.message || e)); } S.busy = false;
  }
  async function mount(host, inf) {
    const id = inf.node.id, src = inf.set.src;
    if (S.id !== id || S.src !== src || !S.base) { S.id = id; S.src = src; S.P = P0(); S.from = null; S.pickMode = false; S.base = null; try { S.base = cap(await loadImg(src), 3600); S.prev = cap(S.base, 1100); } catch (e) { msg("⚠️ " + e.message); return; } }
    drawMini(); const root = host.querySelector("#pbrt"); if (!root) return;
    const cv = $("pbrt-pv"); if (cv) cv.addEventListener("click", e => { if (!S.pickMode || !S.prev) return; const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * S.prev.width, y = (e.clientY - r.top) / r.height * S.prev.height, c = pick(S.prev, x, y); if (!c) return msg("اختر نقطة على المنتج لا على الخلفية الشفافة"); S.from = c; S.pickMode = false; cv.style.cursor = "default"; const sw = $("pbrt-sw"); if (sw) sw.style.background = "rgb(" + c.join(",") + ")"; msg("اضغط ② لتغيير هذا اللون"); });
    const upd = e => { const t = e.target, k = t.dataset && t.dataset.rtk; if (!k) return; const v = t.type === "checkbox" ? t.checked : +t.value; S.P[k] = v; const lab = $("pbrt-v-" + k); if (lab) lab.textContent = v; later(); };
    root.addEventListener("input", upd); root.addEventListener("change", upd);
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-rt]"); if (!t) return; const k = t.dataset.rt, hexRgb2 = hexRgb;
      if (k === "pick") { S.pickMode = true; if (cv) cv.style.cursor = "crosshair"; msg("انقر على اللون المراد تغييره داخل المصغّرة"); }
      else if (k === "recolor") { if (!S.from) return msg("انقر أولاً على اللون المراد تغييره (①)"); S.P.recol.push({ from: S.from, to: hexRgb2(($("pbrt-to") || {}).value), tol: +($("pbrt-tol") || {}).value || 26 }); S.from = null; host.querySelector(".ep-b") ? (root.outerHTML = panel(), mount(host, inf)) : 0; later(); }
      else if (k === "rm") { S.P.recol.splice(+t.dataset.i, 1); root.outerHTML = panel(); mount(host, inf); later(); }
      else if (k === "reset") { A().liveCancel(); }
    });
    if (dirty(S.P)) later();
  }
  (() => { if (document.getElementById("pbrt-css")) return; const st = document.createElement("style"); st.id = "pbrt-css"; st.textContent = `.rt-g{display:flex;flex-direction:column;gap:.35rem;border:1px solid rgba(128,128,128,.28);border-radius:10px;padding:.5rem;margin:.4rem 0}.rt-g label{font-size:.76rem;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.rt-g input[type=range]{flex:1;min-width:90px}.pbrt-row{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;margin:.35rem 0}#pbai textarea{border:1px solid rgba(128,128,128,.35);border-radius:8px;padding:.4rem;font:inherit;background:transparent;color:inherit}#pbrt-pv,#pbai-res img{border-radius:6px}`; document.head.appendChild(st); })();
  const reset = () => { S.tok++; clearTimeout(S.t); S.id = ""; S.src = ""; S.base = null; S.prev = null; S.P = P0(); S.from = null; S.pickMode = false; S.msg = ""; };
  return { panel, mount, reset, cancel, state: S, _t: { autoEnhance, adjust, sharpen, run, denoise, keystone, recolor, trim, vignette, grain, pick, hasAlpha, rgb2hsl, hsl2rgb } };
})();

/* «حواف ناعمة» (Contour fondu): تذويب أطراف الصورة تدريجياً حتى الشفافية بشكل مربع أو دائرة بدرجة تمويه غاوسي يضبطها المستخدم؛ معاينة حيّة على الصورة نفسها في الصفحة ثم «تطبيق». */
const PBFade = (() => {
  const A = () => PBApp, $ = id => document.getElementById(id);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const S = { id: "", src: "", base: null, shape: "rect", blur: 40, url: "", t: 0, busy: false, msg: "", tok: 0 };
  /* نقية: يُرجع قماشاً جديداً بحواف مُذوَّبة. blur 0..100 = نسبة من 25% من أصغر بُعد (تمويه غاوسي)؛ الشكل يُصغَّر للداخل فتكتمل الشفافية قبل الحافة */
  function feather(src, o) {
    const w = src.width, h = src.height, m = Math.min(w, h), b = Math.max(0, Math.min(100, +o.blur || 0)) / 100 * m * .25, inset = Math.min(m / 2 - 1, b * 1.8), mask = mk(w, h), g = mask.getContext("2d");
    const hasF = "filter" in g; if (hasF && b > .5) g.filter = "blur(" + b.toFixed(2) + "px)";
    g.fillStyle = "#fff"; g.beginPath();
    if (o.shape === "circle") g.ellipse(w / 2, h / 2, Math.max(1, w / 2 - inset), Math.max(1, h / 2 - inset), 0, 0, Math.PI * 2); else g.rect(inset, inset, Math.max(1, w - 2 * inset), Math.max(1, h - 2 * inset));
    g.fill(); g.filter = "none";
    let mk2 = mask; if (!hasF && b > .5) { const k = Math.max(.02, 1 / (1 + b / 3)), s = mk(w * k, h * k); s.getContext("2d").drawImage(mask, 0, 0, s.width, s.height); mk2 = mk(w, h); const q = mk2.getContext("2d"); q.imageSmoothingQuality = "high"; q.drawImage(s, 0, 0, w, h); }
    const out = mk(w, h), og = out.getContext("2d"); og.drawImage(src, 0, 0); og.globalCompositeOperation = "destination-in"; og.drawImage(mk2, 0, 0); return out;
  }
  const hasAlpha = c => PBRetouch._t.hasAlpha(c);
  function panel() {
    const sh = (k, t) => `<button type="button" class="pbx-small pz-pat${S.shape === k ? " on" : ""}" data-ff="shape" data-v="${k}">${t}</button>`;
    return `<div class="pbx-pz" id="pbff"><p>تذويب أطراف الصورة تدريجياً (Contour fondu): تظهر المعاينة مباشرة على الصورة في الصفحة، ثم «تنفيذ» أو «إلغاء» تحتها.</p>
<div class="pbrt-row"><b>الشكل</b>${sh("rect", "▢ مربع")}${sh("circle", "◯ دائرة")}</div>
<div class="rt-g"><label>درجة التمويه (غاوسي) <b id="pbff-v">${S.blur}</b><input type="range" id="pbff-b" min="0" max="100" value="${S.blur}"></label></div>
<div id="pbff-msg" class="ep-n" style="min-height:1.3em">${S.msg}</div></div>`;
  }
  const say = t => { S.msg = t; const e = $("pbff-msg"); if (e) e.textContent = t; };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, 4096 / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * k, im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  async function preview() {
    if (!S.base) return; const tok = ++S.tok, k = Math.min(1, 1200 / Math.max(S.base.width, S.base.height)), c = k < 1 ? mk(S.base.width * k, S.base.height * k) : S.base; if (k < 1) c.getContext("2d").drawImage(S.base, 0, 0, c.width, c.height);
    const out = feather(c, { shape: S.shape, blur: S.blur }), blob = await new Promise(r => out.toBlob(r, "image/png")); if (tok !== S.tok) return;
    if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(blob); try { A().liveShow(S.id, S.url, { tab: "ff", apply, cancel: () => { S.tok++; clearTimeout(S.t); S.url = ""; } }); } catch (e) { }
  }
  const later = () => { clearTimeout(S.t); S.t = setTimeout(preview, 90); };
  async function mount(host, inf) {
    const id = inf.node.id, src = inf.set.src; if (S.id !== id || S.src !== src || !S.base) { S.id = id; S.src = src; S.base = null; try { S.base = await loadImg(src); } catch (e) { say("⚠️ " + e.message); return; } }
    const root = host.querySelector("#pbff"); if (!root || root._ff) { preview(); return; } root._ff = 1;
    root.addEventListener("input", e => { if (e.target.id === "pbff-b") { S.blur = +e.target.value; const v = $("pbff-v"); if (v) v.textContent = S.blur; later(); } });
    root.addEventListener("click", async e => {
      const t = e.target.closest("[data-ff]"); if (!t) return; const k = t.dataset.ff;
      if (k === "shape") { S.shape = t.dataset.v; root.querySelectorAll('[data-ff="shape"]').forEach(b => b.classList.toggle("on", b.dataset.v === S.shape)); later(); }
      else if (k === "cancel") { cancel(); say("أُلغيت المعاينة"); }
      else if (k === "apply") await apply();
    }); preview();
  }
  async function apply() {
    if (!S.base || S.busy) return; S.busy = true; say("⏳ جارٍ التطبيق…");
    try { const out = feather(S.base, { shape: S.shape, blur: S.blur }), blob = await new Promise(r => out.toBlob(r, "image/png")), path = await A().uploadBlob(blob, "ff-" + Date.now().toString(36), { max: 4096, q: .95 }), q = A().find(S.id); if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "حواف ناعمة"; S.src = path; S.base = out; if (S.url) { URL.revokeObjectURL(S.url); S.url = ""; } A().liveClear(false); A().commitAfter(S.id); say("✅ طُبِّقت الحواف الناعمة"); } }
    catch (e) { say("⚠️ " + (e.message || e)); } S.busy = false;
  }
  function cancel() { S.tok++; clearTimeout(S.t); if (S.url) { URL.revokeObjectURL(S.url); S.url = ""; try { A().stRestore(); } catch (e) { } } }
  const reset = () => { cancel(); S.id = ""; S.src = ""; S.base = null; S.msg = ""; };
  return { panel, mount, cancel, reset, state: S, _t: { feather } };
})();
