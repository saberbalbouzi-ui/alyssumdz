/* «لمسات وتصحيح» (المرحلة 3 من docs/photoroom-tools-report.md): أدوات تحسين وتصحيح للصورة داخل المتصفح وبلا API ولا ذكاء اصطناعي:
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
    const lo = [0, 0, 0], hi = [255, 255, 255], cut = cnt * .005;
    for (let k = 0; k < 3; k++) { let a = 0; for (let v = 0; v < 256; v++) { a += H[k][v]; if (a > cut) { lo[k] = v; break; } } a = 0; for (let v = 255; v >= 0; v--) { a += H[k][v]; if (a > cut) { hi[k] = v; break; } } if (hi[k] - lo[k] < 40) { lo[k] = 0; hi[k] = 255; } }
    const avg = (sr + sg + sb) / (3 * cnt), wb = [clamp(avg / (sr / cnt || 1), .88, 1.12), clamp(avg / (sg / cnt || 1), .88, 1.12), clamp(avg / (sb / cnt || 1), .88, 1.12)];
    for (let i = 0; i < n; i++) {
      if (d[i * 4 + 3] < 1) continue; let r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
      r = (r - lo[0]) * 255 / (hi[0] - lo[0]) * wb[0]; gg = (gg - lo[1]) * 255 / (hi[1] - lo[1]) * wb[1]; b = (b - lo[2]) * 255 / (hi[2] - lo[2]) * wb[2];
      const [h, s, l] = rgb2hsl(clamp(r, 0, 255), clamp(gg, 0, 255), clamp(b, 0, 255)), o = hsl2rgb(h, clamp(s * 1.08, 0, 1), l); d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2];
    }
    g.putImageData(im, 0, 0); return c;
  }
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

  /* ── اللوحة ── */
  const S = { id: "", src: "", base: null, work: null, hist: [], pickMode: false, from: null, busy: false, msg: "" };
  const $ = id => document.getElementById(id);
  function panel() {
    return `<div class="pbx-pz" id="pbrt"><p>لمسات وتصحيح بلا ذكاء اصطناعي: تُطبَّق على نسخة عمل ويمكن التراجع، ثم «تطبيق على الصورة».</p>
<div id="pbrt-pvw" style="background:repeating-conic-gradient(#d8d4c8 0 25%,#fff 0 50%) 50%/14px 14px;border-radius:8px;overflow:hidden;text-align:center;min-height:90px"><canvas id="pbrt-pv" style="max-width:100%;cursor:default"></canvas></div>
<div id="pbrt-msg" class="ep-n" style="min-height:1.3em"></div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-rt="auto">✨ تحسين تلقائي</button><select id="pbrt-dn" class="pbx-small"><option value="1">ضوضاء خفيفة</option><option value="2">متوسطة</option><option value="3">قوية</option></select><button type="button" class="pbx-small" data-rt="denoise">🧼 تقليل الضوضاء</button></div>
<div class="rt-g"><label>انحراف رأسي <input type="range" id="pbrt-kv" min="-30" max="30" value="0"></label><label>انحراف أفقي <input type="range" id="pbrt-kh" min="-30" max="30" value="0"></label><button type="button" class="pbx-small" data-rt="keystone">📐 تصحيح المنظور</button></div>
<div class="rt-g"><b>🎨 تغيير لون جزء من المنتج</b><div class="pbrt-row"><button type="button" class="pbx-small" data-rt="pick" id="pbrt-pk">① انقر على اللون في الصورة</button><span id="pbrt-sw" style="display:inline-block;width:22px;height:22px;border-radius:50%;border:1px solid #888;background:#ccc"></span><input type="color" id="pbrt-to" value="#2f7d4f" title="اللون الجديد"></div>
<label>التسامح <input type="range" id="pbrt-tol" min="6" max="70" value="26"></label><button type="button" class="pbx-small" data-rt="recolor">② غيّر اللون</button></div>
<div class="rt-g"><label>هامش القص % <input type="range" id="pbrt-pad" min="0" max="20" value="4"></label><button type="button" class="pbx-small" data-rt="trim">✂️ قص الحواف الفارغة</button></div>
<div class="rt-g"><label>تعتيم الأطراف <input type="range" id="pbrt-vg" min="0" max="100" value="35"></label><button type="button" class="pbx-small" data-rt="vig">تعتيم الأطراف</button><label>حبيبات <input type="range" id="pbrt-gr" min="0" max="100" value="25"></label><button type="button" class="pbx-small" data-rt="grain">إضافة حبيبات</button></div>
<div class="pbrt-row"><button type="button" class="pbx-small" data-rt="undo" id="pbrt-undo" disabled>↶ تراجع</button><button type="button" class="pbx-small" data-rt="reset">إعادة الأصل</button><button type="button" class="pbx-small pz-go" data-rt="apply" id="pbrt-apply" disabled>✔ تطبيق على الصورة</button></div></div>`;
  }
  const msg = t => { S.msg = t; const e = $("pbrt-msg"); if (e) e.textContent = t; };
  function draw() {
    const cv = $("pbrt-pv"); if (!cv || !S.work) return; const k = Math.min(1, 300 / Math.max(S.work.width, S.work.height)); cv.width = Math.max(1, Math.round(S.work.width * k)); cv.height = Math.max(1, Math.round(S.work.height * k)); const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(S.work, 0, 0, cv.width, cv.height);
    const u = $("pbrt-undo"), a = $("pbrt-apply"); if (u) u.disabled = !S.hist.length; if (a) a.disabled = !S.hist.length;
  }
  function loadImg(src) {
    return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const c = mk(im.naturalWidth, im.naturalHeight); ctx2(c).drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); });
  }
  async function mount(host, inf) {
    const id = inf.node.id, src = inf.set.src; if (S.id !== id || S.src !== src || !S.work) { S.id = id; S.src = src; S.hist = []; S.from = null; S.pickMode = false; S.work = null; try { S.base = cap(await loadImg(src), 3600); S.work = clone(S.base); } catch (e) { msg("⚠️ " + e.message); return; } }
    draw(); msg(S.msg || "");
    const cv = $("pbrt-pv"); if (cv && !cv._rt) { cv._rt = 1; cv.addEventListener("click", e => { if (!S.pickMode || !S.work) return; const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * S.work.width, y = (e.clientY - r.top) / r.height * S.work.height, c = pick(S.work, x, y); if (!c) return msg("اختر نقطة على المنتج لا على الخلفية الشفافة"); S.from = c; S.pickMode = false; cv.style.cursor = "default"; const sw = $("pbrt-sw"); if (sw) sw.style.background = "rgb(" + c.join(",") + ")"; msg("اختر اللون الجديد ثم «غيّر اللون»"); }); }
  }
  const push = c => { S.hist.push(S.work); if (S.hist.length > 8) S.hist.shift(); S.work = c; draw(); };
  async function click(t) {
    const k = t.dataset.rt, v = id => ($(id) || {}).value; if (!S.work && k !== "apply") return;
    if (S.busy) return;
    const run = async (label, fn) => { S.busy = true; msg("⏳ " + label + "…"); await new Promise(r => setTimeout(r, 30)); try { push(fn()); msg("✅ تم — يمكنك المتابعة أو «تطبيق على الصورة»"); } catch (e) { msg("⚠️ " + (e.message || e)); } S.busy = false; };
    if (k === "auto") return run("تحسين تلقائي", () => autoEnhance(S.work));
    if (k === "denoise") return run("تقليل الضوضاء", () => denoise(S.work, +v("pbrt-dn")));
    if (k === "keystone") { const a = +v("pbrt-kv"), b = +v("pbrt-kh"); if (!a && !b) return msg("حرّك أحد المنزلقين أولاً"); return run("تصحيح المنظور", () => keystone(S.work, a, b)); }
    if (k === "pick") { S.pickMode = true; const cv = $("pbrt-pv"); if (cv) cv.style.cursor = "crosshair"; return msg("انقر على اللون المراد تغييره داخل المعاينة"); }
    if (k === "recolor") { if (!S.from) return msg("انقر أولاً على اللون المراد تغييره (①)"); return run("تغيير اللون", () => recolor(S.work, { from: S.from, to: hexRgb(v("pbrt-to")), tol: +v("pbrt-tol") })); }
    if (k === "trim") return run("قص الحواف", () => trim(S.work, +v("pbrt-pad")));
    if (k === "vig") return run("تعتيم الأطراف", () => vignette(S.work, +v("pbrt-vg")));
    if (k === "grain") return run("إضافة الحبيبات", () => grain(S.work, +v("pbrt-gr")));
    if (k === "undo") { if (S.hist.length) { S.work = S.hist.pop(); draw(); msg("↶ تُرِك آخر تعديل"); } return; }
    if (k === "reset") { S.work = clone(S.base); S.hist = []; S.from = null; draw(); return msg("أُعيدت الصورة الأصلية"); }
    if (k === "apply") {
      if (!S.hist.length) return; S.busy = true; msg("⏳ جارٍ الرفع…");
      try {
        const png = hasAlpha(S.work), blob = await new Promise(r => S.work.toBlob(r, png ? "image/png" : "image/webp", .93)), path = await A().uploadBlob(blob, "rt-" + Date.now().toString(36), { max: 4096, q: .93 }), q = A().find(S.id);
        if (q && path) { q.node.set.src = path; delete q.node.set.crop; A().E.nextLabel = "لمسات وتصحيح الصورة"; S.src = path; S.base = clone(S.work); S.hist = []; A().commitAfter(S.id); msg("✅ طُبّق على الصورة"); }
      } catch (e) { msg("⚠️ " + (e.message || e)); } S.busy = false;
    }
  }
  (() => { if (document.getElementById("pbrt-css")) return; const st = document.createElement("style"); st.id = "pbrt-css"; st.textContent = `.rt-g{display:flex;flex-direction:column;gap:.35rem;border:1px solid rgba(128,128,128,.28);border-radius:10px;padding:.5rem;margin:.4rem 0}.rt-g label{font-size:.76rem;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.rt-g input[type=range]{flex:1;min-width:90px}.pbrt-row{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;margin:.35rem 0}#pbai textarea{border:1px solid rgba(128,128,128,.35);border-radius:8px;padding:.4rem;font:inherit;background:transparent;color:inherit}#pbrt-pv,#pbai-res img{border-radius:6px}`; document.head.appendChild(st); })();
  document.addEventListener("click", e => { const t = e.target.closest && e.target.closest("[data-rt]"); if (t && t.closest("#pbrt")) click(t); });
  const reset = () => { S.id = ""; S.src = ""; S.work = null; S.base = null; S.hist = []; S.from = null; S.pickMode = false; S.msg = ""; };
  return { panel, mount, reset, state: S, _t: { autoEnhance, denoise, keystone, recolor, trim, vignette, grain, pick, hasAlpha, rgb2hsl, hsl2rgb } };
})();
