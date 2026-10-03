/* عمليات البكسل على طبقة صورة (محلية، بلا شبكة): استخراج منطقة محدّدة بشفافية، أو إزالتها وترميم ما تحتها.
   القناع بإحداثيات مصدر الصورة (width×height للطبقة). */
(function () {
  const Ed = window.Ed;
  const px = Ed.px = {
    source(img) { const w = img.width, h = img.height, c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d", { willReadFrequently: true }).drawImage(img.getElement(), img.cropX || 0, img.cropY || 0, w, h, 0, 0, w, h); return c; },
    /* يستبدل بكسلات الطبقة (بعد ترميم) مع بقاء موضعها وحجمها؛ أصل جديد لتعمل «تراجع» */
    commit(img, canvas) {
      const id = Ed.registerAsset(canvas.toDataURL("image/png"), canvas.width, canvas.height, "edit"); img.setElement(canvas); img.set({ cropX: 0, cropY: 0, width: canvas.width, height: canvas.height, assetId: id }); img.setCoords(); img.dirty = true; Ed.c.requestRenderAll();
    },
    toDoc(img, x, y) { return fabric.util.transformPoint({ x: x - img.width / 2, y: y - img.height / 2 }, img.calcTransformMatrix()); },
    fromDoc(img, X, Y) { const p = fabric.util.transformPoint({ x: X, y: Y }, fabric.util.invertTransform(img.calcTransformMatrix())); return { x: p.x + img.width / 2, y: p.y + img.height / 2 }; },
    bbox(mask, thr) { const w = mask.width, h = mask.height, d = mask.getContext("2d").getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > (thr || 100)) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return n ? { x0, y0, x1: x1 + 1, y1: y1 + 1, n, data: d } : null; },
    /* إزالة: ترميم المنطقة المحدّدة (موسَّعة قليلاً) من الخلفية المحيطة */
    remove(img, mask) {
      const b = px.bbox(mask); if (!b) return false; const src = px.source(img), g = src.getContext("2d", { willReadFrequently: true }), pad = Math.max(24, Math.round(Math.max(b.x1 - b.x0, b.y1 - b.y0) * .15));
      const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(src.width, b.x1 + pad), y1 = Math.min(src.height, b.y1 + pad), w = x1 - x0, h = y1 - y0, m = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (b.data[((y0 + y) * mask.width + (x0 + x)) * 4 + 3] > 100) m[y * w + x] = 1;
      const grow = 3, t = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) t[yy * w + xx] = 1; }
      if (!ImageTools.fillMask(g, x0, y0, w, h, t)) return false; px.commit(img, src); return true;
    },
    /* استخراج: الألفا = ما تحت القناع وليس خلفية (بقايا عن مستوى الخلفية المحيطة) مع ملء الثقوب وظل ملاصق؛ ثم ترميم الأصل. يعيد طبقة جديدة */
    extract(img, mask) {
      const b = px.bbox(mask); if (!b) return null; const src = px.source(img), g = src.getContext("2d", { willReadFrequently: true }), bw = b.x1 - b.x0, bh = b.y1 - b.y0, pad = Math.max(24, Math.round(Math.max(bw, bh) * .15)), reach = 44;
      const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(src.width, b.x1 + pad), y1 = Math.min(src.height, b.y1 + pad), w = x1 - x0, h = y1 - y0, D = g.getImageData(x0, y0, w, h).data, m = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (b.data[((y0 + y) * mask.width + (x0 + x)) * 4 + 3] > 100) m[y * w + x] = 1;
      const dil = (a, r) => { const t = new Uint8Array(w * h), o = new Uint8Array(w * h); for (let y = 0; y < h; y++) { let l = -1e9; for (let x = 0; x < w; x++) { if (a[y * w + x]) l = x; if (x - l <= r) t[y * w + x] = 1; } l = 1e9; for (let x = w - 1; x >= 0; x--) { if (a[y * w + x]) l = x; if (l - x <= r) t[y * w + x] = 1; } } for (let x = 0; x < w; x++) { let l = -1e9; for (let y = 0; y < h; y++) { if (t[y * w + x]) l = y; if (y - l <= r) o[y * w + x] = 1; } l = 1e9; for (let y = h - 1; y >= 0; y--) { if (t[y * w + x]) l = y; if (l - y <= r) o[y * w + x] = 1; } } return o; };
      const far = dil(m, 10), ring = [], st = Math.max(1, Math.floor(Math.sqrt(w * h / 3000)));
      for (let y = 0; y < h; y += st) for (let x = 0; x < w; x += st) if (!far[y * w + x]) { const i = (y * w + x) * 4; ring.push([x, y, D[i], D[i + 1], D[i + 2]]); }
      let pl = null; if (ring.length >= 12) pl = [0, 1, 2].map(ch => ImageTools.fitPlane(ring, ch)); const bg = (x, y, c) => pl ? pl[c][0] + pl[c][1] * x + pl[c][2] * y : 128;
      const cand = new Uint8Array(w * h); let cn = 0, mn = 0;
      for (let i = 0; i < w * h; i++) if (m[i]) { mn++; const x = i % w, y = (i / w) | 0; let r = 0; for (let c = 0; c < 3; c++) r += Math.abs(D[i * 4 + c] - bg(x, y, c)); if (!pl || r > 18) { cand[i] = 1; cn++; } }
      let obj = m;
      if (pl && cn > .04 * mn) {                                        // ملء الثقوب: ما لا يصله الخارج عبر غير الحواف
        const E = dil(cand, 2), vis = new Uint8Array(w * h), stack = new Int32Array(w * h); let sp = 0; const push = i => { if (!vis[i] && !E[i]) { vis[i] = 1; stack[sp++] = i; } };
        for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
        while (sp) { const i = stack[--sp], x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * h - w) push(i + w); }
        obj = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (m[i] && (cand[i] || !vis[i])) obj[i] = 1;
      }
      const near = dil(obj, reach), out = document.createElement("canvas"); out.width = w; out.height = h; const og = out.getContext("2d"), img2 = og.createImageData(w, h), full = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += obj[yy * w + xx]; n++; } }
        const al = obj[i] ? Math.max(.5, s / n) : s / n * .5;
        if (al >= .08) { full[i] = 1; for (let c = 0; c < 3; c++) { const p = D[i * 4 + c], bb = bg(x, y, c); img2.data[i * 4 + c] = al < .98 && pl ? Math.max(0, Math.min(255, bb + (p - bb) / al)) : p; } img2.data[i * 4 + 3] = Math.round(Math.min(1, al) * 255); continue; }
        if (pl && near[i]) { let q = 0; for (let c = 0; c < 3; c++) q += D[i * 4 + c] / Math.max(1, bg(x, y, c)); const sa = Math.min(.85, 1 - q / 3); if (sa > .035) { img2.data[i * 4 + 3] = Math.round(sa * 255); full[i] = 1; } }
      }
      og.putImageData(img2, 0, 0);
      const fill = dil(full, 3); if (!ImageTools.fillMask(g, x0, y0, w, h, fill)) return null; px.commit(img, src);
      const c = px.toDoc(img, x0 + w / 2, y0 + h / 2), L = new fabric.Image(out, { left: c.x, top: c.y, scaleX: img.scaleX, scaleY: img.scaleY, angle: img.angle, flipX: img.flipX, flipY: img.flipY, layerType: "image", role: "object" });
      L.assetId = Ed.registerAsset(out.toDataURL("image/webp", .92), w, h, "extract"); L.name = "عنصر مستخرج"; return L;
    }
  };
})();
