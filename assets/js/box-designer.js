/* Alyssum Box Designer — قالب علبة طباعة (خطوط قص وثني وألسنة لصق ونزف) من هوية الملصق، تصدير SVG/PDF/PNG/WebP بأبعاد حقيقية، وإرسال إلى 3D Pack Studio.
   العلب المدعومة: علبة بغطاء إدخال (Tuck End) وعلبة هدية قطعة واحدة (Gift Box: غطاء بلسان وفتحة إبهام وأجنحة لصق) بأبعاد W×H×D مم. التصميم يُوزَّع على ستة وجوه ويمكن تعديل كل وجه على حدة. */
const BoxDesigner = (() => {
  "use strict";
  const K = "alyssum_bx_cfg";
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PRESETS = [["rect", "علبة مستطيلة", 60, 110, 35], ["square", "علبة مربعة", 80, 80, 80], ["cream", "علبة كريم", 65, 55, 65], ["perfume", "علبة عطر", 45, 125, 45], ["custom", "شكل مخصص", 60, 100, 40]];
  const FACES = [["front", "الأمامي"], ["back", "الخلفي"], ["left", "الأيسر"], ["right", "الأيمن"], ["top", "العلوي"], ["bottom", "السفلي"]];
  const FONTS = { sans: "'Segoe UI','Helvetica Neue',Arial,Tahoma,sans-serif", serif: "Georgia,'Times New Roman','Traditional Arabic',serif", bold: "'Arial Black',Impact,Tahoma,sans-serif" };
  const PATTERNS = [["none", "بلا نمط"], ["dots", "نقاط"], ["stripes", "خطوط"], ["waves", "موجات"], ["leaves", "أوراق"], ["flowers", "زهور"], ["geo", "هندسي"]];
  const FLAGS = [["brand", "اسم العلامة"], ["sub", "الوصف القصير"], ["vol", "الحجم"], ["logo", "الشعار"], ["pattern", "النمط"], ["art", "صورة الملصق"], ["desc", "نص تفصيلي"], ["barcode", "باركود"]];
  const SH = (brand, sub, vol, logo, pattern, art, desc, barcode) => ({ brand, sub, vol, logo, pattern, art, desc, barcode });
  const DEFSHOW = { front: SH(1, 1, 1, 1, 1, 0, 0, 0), back: SH(1, 0, 1, 1, 0, 0, 1, 1), left: SH(1, 1, 1, 0, 1, 0, 0, 0), right: SH(1, 1, 1, 0, 1, 0, 0, 0), top: SH(1, 0, 0, 1, 1, 0, 0, 0), bottom: SH(1, 0, 1, 0, 0, 0, 1, 0) };
  const DEF = { style: "tuck", thumb: 0, type: "rect", W: 60, H: 110, D: 35, tuck: 0, glue: 12, bleed: 3, dpi: 300, guides: true, fmt: "png", q: 92, face: "front", id: { name: "ALYSSUM", sub: "Natural care", vol: "50 ml", bg: "#173f35", fg: "#f6f1e4", accent: "#e2fe17", font: "sans", pattern: "leaves", desc: "منتج طبيعي مختار بعناية.\nالمكوّنات: أضف مكوّنات المنتج هنا.\nيُحفظ بعيداً عن أشعة الشمس والحرارة.", code: "613000000001" }, faces: {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const S = clone(DEF);
  let logo = null, art = null, opened = false, pvT = 0, pvMeta = null;
  const fresh = () => { const f = {}; FACES.forEach(([k]) => { f[k] = { bg: "", fg: "", text: "", show: clone(DEFSHOW[k]) }; }); return f; };
  S.faces = fresh();
  try { const o = JSON.parse(localStorage.getItem(K) || "{}"); Object.keys(o).forEach(k => { if (k !== "id" && k !== "faces") S[k] = o[k]; }); Object.assign(S.id, o.id || {}); FACES.forEach(([k]) => { const fo = (o.faces || {})[k]; if (fo) { S.faces[k].bg = fo.bg || ""; S.faces[k].fg = fo.fg || ""; S.faces[k].text = fo.text || ""; Object.assign(S.faces[k].show, fo.show || {}); } }); } catch (e) { }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { } };
  const num = (v, a, b, d) => { v = parseFloat(v); return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

  /* ═══ الهندسة (مم) — دالة نقية تُستعمل في المعاينة والتصدير والاختبار ═══ */
  function geom(s) {
    s = s || S; if (s.style === "gift") return giftGeom(s);
    const W = num(s.W, 10, 400, 60), H = num(s.H, 10, 400, 110), D = num(s.D, 8, 300, 35), G = num(s.glue, 6, 30, 12), B = num(s.bleed, 0, 10, 3);
    const T = s.tuck > 0 ? num(s.tuck, 6, 80, 20) : Math.min(28, Math.max(12, D * 0.85)), dd = D * 0.8, cc = Math.min(dd * 0.45, D * 0.4), gc = Math.min(G * 0.9, H * 0.15), M = B + 5;
    const xg1 = G, xb1 = G + W, xf0 = xb1 + D, xf1 = xf0 + W, xr1 = xf1 + D, yTp = T, yF0 = T + D, yF1 = yF0 + H, yB1 = yF1 + D, yK1 = yB1 + T;
    const ext = (l, t, r, b) => ({ l: l ? B : 0, t: t ? B : 0, r: r ? B : 0, b: b ? B : 0 });
    const faces = [
      { id: "front", x: xf0, y: yF0, w: W, h: H, ext: ext(0, 0, 0, 0) }, { id: "back", x: xg1, y: yF0, w: W, h: H, ext: ext(0, 1, 0, 1) },
      { id: "left", x: xb1, y: yF0, w: D, h: H, ext: ext(0, 0, 0, 0) }, { id: "right", x: xf1, y: yF0, w: D, h: H, ext: ext(0, 0, 1, 0) },
      { id: "top", x: xf0, y: yTp, w: W, h: D, ext: ext(1, 0, 1, 0) }, { id: "bottom", x: xf0, y: yF1, w: W, h: D, ext: ext(1, 0, 1, 0) }];
    const flaps = [
      { id: "tuckTop", pts: [[xf0, yTp, 0], [xf0, 0, 2.5], [xf1, 0, 2.5], [xf1, yTp, 0]] }, { id: "tuckBottom", pts: [[xf0, yB1, 0], [xf0, yK1, 2.5], [xf1, yK1, 2.5], [xf1, yB1, 0]] },
      { id: "dustTL", pts: [[xb1, yF0], [xb1, yF0 - dd + cc], [xb1 + cc, yF0 - dd], [xf0, yF0 - dd], [xf0, yF0]] }, { id: "dustTR", pts: [[xf1, yF0], [xf1, yF0 - dd], [xr1 - cc, yF0 - dd], [xr1, yF0 - dd + cc], [xr1, yF0]] },
      { id: "dustBL", pts: [[xb1, yF1], [xb1, yF1 + dd - cc], [xb1 + cc, yF1 + dd], [xf0, yF1 + dd], [xf0, yF1]] }, { id: "dustBR", pts: [[xf1, yF1], [xf1, yF1 + dd], [xr1 - cc, yF1 + dd], [xr1, yF1 + dd - cc], [xr1, yF1]] }];
    const glue = [[xg1, yF0], [0, yF0 + gc], [0, yF1 - gc], [xg1, yF1]];
    const cut = [[xf0, 0, 2.5], [xf1, 0, 2.5], [xf1, yTp], [xf1, yF0 - dd], [xr1 - cc, yF0 - dd], [xr1, yF0 - dd + cc], [xr1, yF1 + dd - cc], [xr1 - cc, yF1 + dd], [xf1, yF1 + dd], [xf1, yB1], [xf1, yK1, 2.5], [xf0, yK1, 2.5], [xf0, yB1], [xf0, yF1 + dd],
      [xb1 + cc, yF1 + dd], [xb1, yF1 + dd - cc], [xb1, yF1], [xg1, yF1], [0, yF1 - gc], [0, yF0 + gc], [xg1, yF0], [xb1, yF0], [xb1, yF0 - dd + cc], [xb1 + cc, yF0 - dd], [xf0, yF0 - dd]];
    const creases = [[xg1, yF0, xg1, yF1], [xb1, yF0, xb1, yF1], [xf0, yF0, xf0, yF1], [xf1, yF0, xf1, yF1], [xb1, yF0, xr1, yF0], [xb1, yF1, xr1, yF1], [xf0, yTp, xf1, yTp], [xf0, yB1, xf1, yB1]];
    return { style: "tuck", W, H, D, T, G, B, M, dd, tw: xr1 + 2 * M, th: yK1 + 2 * M, faces, flaps, glue, glues: [glue], cut, creases, xr1, yK1 };
  }
  /* علبة هدية بقطعة واحدة: الأرضية في الوسط، الخلفي فوقها ثم الغطاء ثم لسان الإدخال، والأمامي (بفتحة الإبهام) تحتها، والجانبان بأجنحة لصق.
     rot = دوران صورة الوجه (° مع عقارب الساعة) لوضعه على القالب؛ lw/lh أبعاد الوجه الفعلية قبل الدوران. */
  function giftGeom(s) {
    const W = num(s.W, 10, 400, 60), H = num(s.H, 10, 400, 110), D = num(s.D, 8, 300, 35), B = num(s.bleed, 0, 10, 3), M = B + 5;
    const T = s.tuck > 0 ? num(s.tuck, 6, 80, 20) : Math.min(28, Math.max(12, D * 0.7)), Gf = Math.min(num(s.glue, 6, 30, 12), D * 0.8, H * 0.4);
    const dia = Math.min(s.thumb > 0 ? num(s.thumb, 8, 120, 24) : Math.min(W * 0.4, 28), W * 0.7, H * 0.8), r = dia / 2;
    const yb0 = T + D + H, yb1 = yb0 + D, yf1 = yb1 + H, tw = 2 * H + W, xR = H + W, cx = H + W / 2, g8 = 0.8 * Gf;
    const ext = (l, t, rr, b) => ({ l: l ? B : 0, t: t ? B : 0, r: rr ? B : 0, b: b ? B : 0 });
    const fc = (id, x, y, w, h, rot, e) => ({ id, x, y, w, h, rot, lw: rot % 180 ? h : w, lh: rot % 180 ? w : h, ext: e });
    const faces = [fc("back", H, T + D, W, H, 0, ext(1, 0, 1, 0)), fc("top", H, T, W, D, 180, ext(1, 0, 1, 0)), fc("bottom", H, yb0, W, D, 180, ext(0, 0, 0, 0)), fc("front", H, yb1, W, H, 180, ext(1, 0, 1, 1)),
      fc("right", 0, yb0, H, D, 270, ext(1, 0, 0, 0)), fc("left", xR, yb0, H, D, 90, ext(0, 0, 1, 0))];
    const flaps = [{ id: "tuck", pts: [[H, T, 0], [H, 0, 2.5], [xR, 0, 2.5], [xR, T, 0]] }];
    const glues = [[[H, yb0], [H - 1.5, yb0 - Gf], [g8, yb0 - Gf], [0, yb0]], [[H, yb1], [H - 1.5, yb1 + Gf], [g8, yb1 + Gf], [0, yb1]], [[xR, yb0], [xR + 1.5, yb0 - Gf], [tw - g8, yb0 - Gf], [tw, yb0]], [[xR, yb1], [xR + 1.5, yb1 + Gf], [tw - g8, yb1 + Gf], [tw, yb1]]];
    const arc = []; for (let i = 0; i <= 18; i++) { const a = Math.PI * i / 18; arc.push([cx + r * Math.cos(a), yf1 - r * Math.sin(a)]); }
    const cut = [[H, T], [H, 0, 2.5], [xR, 0, 2.5], [xR, T], [xR, yb0], [xR + 1.5, yb0 - Gf], [tw - g8, yb0 - Gf], [tw, yb0], [tw, yb1], [tw - g8, yb1 + Gf], [xR + 1.5, yb1 + Gf], [xR, yb1], [xR, yf1]].concat(arc, [[H, yf1], [H, yb1], [H - 1.5, yb1 + Gf], [g8, yb1 + Gf], [0, yb1], [0, yb0], [g8, yb0 - Gf], [H - 1.5, yb0 - Gf], [H, yb0]]);
    const creases = [[H, T, xR, T], [H, T + D, xR, T + D], [0, yb0, tw, yb0], [0, yb1, tw, yb1], [H, yb0, H, yb1], [xR, yb0, xR, yb1]];
    return { style: "gift", W, H, D, T, G: Gf, B, M, dia, tw: tw + 2 * M, th: yf1 + 2 * M, faces, flaps, glue: glues[0], glues, cut, creases };
  }
  /* تحويل هوامش النزف من إطار القالب إلى إطار صورة الوجه الأصلية حسب دورانه */
  const logExt = (e, rot) => rot === 180 ? { l: e.r, r: e.l, t: e.b, b: e.t } : rot === 90 ? { t: e.r, r: e.b, b: e.l, l: e.t } : rot === 270 ? { t: e.l, l: e.b, b: e.r, r: e.t } : e;
  /* وجه مرسوم جاهز للوضع على القالب: الصورة الأصلية + مركزها وأبعادها (مم) في إطار القالب */
  function faceDraw(f, ppm, G) {
    const rot = f.rot || 0, e = f.ext, cv = faceCanvas(f.id, ppm, logExt(e, rot), G), nw = f.w + e.l + e.r, nh = f.h + e.t + e.b;
    return { cv, rot, cx: f.x - e.l + nw / 2, cy: f.y - e.t + nh / 2, lw: rot % 180 ? nh : nw, lh: rot % 180 ? nw : nh };
  }
  /* مسار مغلق بزوايا مدوّرة اختيارية (النقطة الثالثة = نصف القطر) */
  function pathOf(ctx, pts, fx) {
    const n = pts.length; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = p[2] || 0;
      if (!r) { i ? ctx.lineTo(fx(p[0]), fx(p[1], 1)) : ctx.moveTo(fx(p[0]), fx(p[1], 1)); continue; }
      const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2), k = Math.min(r, l1 / 2, l2 / 2);
      const s = [p[0] + v1[0] / l1 * k, p[1] + v1[1] / l1 * k], e = [p[0] + v2[0] / l2 * k, p[1] + v2[1] / l2 * k];
      i ? ctx.lineTo(fx(s[0]), fx(s[1], 1)) : ctx.moveTo(fx(s[0]), fx(s[1], 1)); ctx.quadraticCurveTo(fx(p[0]), fx(p[1], 1), fx(e[0]), fx(e[1], 1));
    }
    ctx.closePath();
  }
  const svgPath = (pts, fx) => { const n = pts.length; let d = ""; for (let i = 0; i < n; i++) { const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = p[2] || 0; const f = v => (+v).toFixed(3); if (!r) { d += (i ? "L" : "M") + f(fx(p[0])) + " " + f(fx(p[1], 1)); continue; } const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2), k = Math.min(r, l1 / 2, l2 / 2); const s = [p[0] + v1[0] / l1 * k, p[1] + v1[1] / l1 * k], e = [p[0] + v2[0] / l2 * k, p[1] + v2[1] / l2 * k]; d += (i ? "L" : "M") + f(fx(s[0])) + " " + f(fx(s[1], 1)) + "Q" + f(fx(p[0])) + " " + f(fx(p[1], 1)) + " " + f(fx(e[0])) + " " + f(fx(e[1], 1)); } return d + "Z"; };

  /* ═══ رسم الوجوه ═══ */
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; };
  const isAr = t => /[؀-ۿ]/.test(t || "");
  const faceDims = (G, k) => { const f = G.faces.find(x => x.id === k); return [f.lw || f.w, f.lh || f.h]; };
  function fitPx(c, str, maxW, size, wt, font) { c.font = wt + " " + size + "px " + font; const w = c.measureText(str).width; return w > maxW ? size * maxW / w : size; }
  function wrap(c, str, maxW) { const out = []; String(str || "").split("\n").forEach(par => { const words = par.split(/\s+/).filter(Boolean); let line = ""; words.forEach(w => { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); out.push(line); }); return out; }
  function cover(c, im, x, y, w, h) { const k = Math.max(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); c.restore(); }
  function contain(c, im, x, y, w, h) { const k = Math.min(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k; c.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };
  function pattern(c, W, H, ppm, kind, col) {
    c.save(); c.globalAlpha = 0.2; c.fillStyle = col; c.strokeStyle = col; const u = 9 * ppm;
    for (let gy = -1; gy < H / u + 1; gy++) for (let gx = -1; gx < W / u + 1; gx++) {
      const x = gx * u + (gy % 2 ? u / 2 : 0), y = gy * u, r1 = hash(gx, gy), r2 = hash(gy + 7, gx + 3);
      if (kind === "dots") { c.beginPath(); c.arc(x + u / 2, y + u / 2, 0.9 * ppm * (0.7 + r1 * 0.6), 0, 7); c.fill(); }
      else if (kind === "leaves") { c.save(); c.translate(x + u / 2, y + u / 2); c.rotate(r1 * 6.28); c.beginPath(); c.ellipse(0, 0, 3.4 * ppm, 1.3 * ppm, 0, 0, 7); c.fill(); c.lineWidth = 0.25 * ppm; c.globalAlpha = 0.12; c.beginPath(); c.moveTo(-3.4 * ppm, 0); c.lineTo(3.4 * ppm, 0); c.stroke(); c.restore(); }
      else if (kind === "flowers") { if (r1 > 0.42) continue; c.save(); c.translate(x + u / 2, y + u / 2); c.rotate(r2 * 6.28); for (let p = 0; p < 5; p++) { c.rotate(1.2566); c.beginPath(); c.ellipse(0, -1.5 * ppm, 0.9 * ppm, 1.5 * ppm, 0, 0, 7); c.fill(); } c.globalAlpha = 0.35; c.beginPath(); c.arc(0, 0, 0.6 * ppm, 0, 7); c.fill(); c.restore(); }
      else if (kind === "geo") { c.save(); c.translate(x + u / 2, y + u / 2); c.rotate(Math.PI / 4); c.globalAlpha = 0.08 + r1 * 0.16; c.fillRect(-2 * ppm, -2 * ppm, 4 * ppm, 4 * ppm); c.restore(); }
    }
    if (kind === "stripes") { c.lineWidth = 0.7 * ppm; c.globalAlpha = 0.14; for (let i = -H; i < W + H; i += 4 * ppm) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); } }
    if (kind === "waves") { c.lineWidth = 0.5 * ppm; c.globalAlpha = 0.18; for (let y = 0; y < H + 6 * ppm; y += 5 * ppm) { c.beginPath(); for (let x = 0; x <= W; x += ppm) { const yy = y + Math.sin(x / (3.2 * ppm)) * 1.3 * ppm; x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); } }
    c.restore();
  }
  function drawBarcode(c, x, y, w, h) {
    c.save(); c.fillStyle = "#fff"; c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, 0.8) : c.rect(x, y, w, h); c.fill();
    try { if (typeof BarcodeTool !== "undefined") { const t = String(S.id.code || "").replace(/\s+/g, ""), cv = mk(10, 10); let tp = /^\d{12,13}$/.test(t) ? "ean13" : "code128"; const sp = tp => ({ type: tp, text: t, scale: 4, margin: 6, fg: "#000", bg: "#fff", height: 90, label: true }); try { BarcodeTool.draw(cv, sp(tp)); } catch (e1) { BarcodeTool.draw(cv, sp("code128")); } const k = Math.min((w - 1.6) / cv.width, (h - 1.2) / cv.height); c.drawImage(cv, x + (w - cv.width * k) / 2, y + (h - cv.height * k) / 2, cv.width * k, cv.height * k); } } catch (e) { }
    c.restore();
  }
  /* وجه واحد: كل القياسات بالمليمتر (المحوّل = ppm بكسل/مم) ويُوزَّع المحتوى حسب مساحة الوجه */
  function faceCanvas(kind, ppm, ext, G) {
    G = G || geom(); ext = ext || { l: 0, t: 0, r: 0, b: 0 }; const [w, h] = faceDims(G, kind), cv = mk((w + ext.l + ext.r) * ppm, (h + ext.t + ext.b) * ppm), c = cv.getContext("2d"), F = S.faces[kind], id = S.id;
    const bg = F.bg || id.bg, fg = F.fg || id.fg, ac = id.accent, font = FONTS[id.font] || FONTS.sans, show = F.show, wt = id.font === "bold" ? "900" : "700";
    c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
    if (show.pattern && id.pattern !== "none") pattern(c, cv.width, cv.height, ppm, id.pattern, ac);
    c.save(); c.translate(ext.l * ppm, ext.t * ppm); c.scale(ppm, ppm); c.textBaseline = "middle"; c.textAlign = "center";
    const mn = Math.min(w, h), T = (str, x, y, maxW, size, weight, col, al) => { if (!str) return 0; c.direction = isAr(str) ? "rtl" : "ltr"; const s = fitPx(c, str, maxW, size, weight || wt, font); c.font = (weight || wt) + " " + s + "px " + font; c.fillStyle = col || fg; c.textAlign = al || "center"; c.fillText(str, x, y); return s; };
    const bar = (x, y, bw) => { c.fillStyle = ac; c.fillRect(x - bw / 2, y, bw, Math.max(0.5, mn * 0.012)); };
    const lg = (x, y, bw, bh) => { if (show.logo && logo) { contain(c, logo, x - bw / 2, y, bw, bh); return true; } return false; };
    if (show.art && art) cover(c, art, 0, 0, w, h);
    if (kind === "front") {
      const hasLogo = lg(w / 2, h * 0.07, w * 0.42, h * 0.14), cy = h * (hasLogo ? 0.5 : 0.44);
      if (show.brand) { const s = T(id.name, w / 2, cy, w * 0.84, w * 0.22, wt); if (show.sub) { bar(w / 2, cy + s * 0.62, w * 0.16); T(id.sub, w / 2, cy + s * 0.62 + Math.max(4, w * 0.075), w * 0.8, w * 0.085, "600", fg); } }
      else if (show.sub) T(id.sub, w / 2, cy, w * 0.8, w * 0.1, "600");
      if (show.vol) { c.fillStyle = ac; c.fillRect(w * 0.3, h * 0.9, w * 0.4, mn * 0.01); T(id.vol, w / 2, h * 0.945, w * 0.6, w * 0.075, "600", fg); }
    } else if (kind === "back") {
      const lw = lg(w * 0.5, h * 0.05, w * 0.3, h * 0.08) ? 0.14 : 0; if (show.brand) T(id.name, w / 2, h * (0.07 + lw), w * 0.7, w * 0.11, wt);
      if (show.desc) { const txt = F.text || id.desc, fs = Math.max(2.4, w * 0.052); c.font = "500 " + fs + "px " + font; c.fillStyle = fg; c.globalAlpha = 0.92; const ar = isAr(txt); c.direction = ar ? "rtl" : "ltr"; c.textAlign = ar ? "right" : "left"; const lines = wrap(c, txt, w * 0.82), lh = fs * 1.55, y0 = h * (0.2 + lw), maxL = Math.max(1, Math.floor((h * (show.barcode ? 0.62 : 0.8) - y0) / lh)); lines.slice(0, maxL).forEach((ln, i) => c.fillText(ln, ar ? w * 0.91 : w * 0.09, y0 + i * lh)); c.globalAlpha = 1; }
      if (show.barcode) { const bw = Math.min(w * 0.62, 42), bh = bw * 0.55; drawBarcode(c, (w - bw) / 2, h - bh - h * 0.05, bw, bh); }
      if (show.vol) T(id.vol, w / 2, h * (show.barcode ? 0.8 : 0.93) - (show.barcode ? Math.min(w * 0.62, 42) * 0.2 : 0), w * 0.6, w * 0.07, "600");
    } else if (kind === "left" || kind === "right") {
      c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2); const L = h * 0.86;
      const bs = show.brand ? T(id.name, 0, show.sub ? -w * 0.08 : 0, L * 0.6, w * 0.42, wt) : 0;
      if (show.sub) T(id.sub, 0, (show.brand ? bs * 0.5 : 0) + w * 0.16, L * 0.56, w * 0.17, "600");
      if (show.vol) T(id.vol, L * 0.42, 0, L * 0.15, w * 0.14, "600");
      if (show.logo && logo) contain(c, logo, -L * 0.5, -w * 0.18, w * 0.36, w * 0.36);
    } else if (kind === "top") {
      const lw = show.logo && logo ? Math.min(w * 0.3, h * 0.7) : 0; if (lw) contain(c, logo, w * 0.08, (h - lw) / 2, lw, lw);
      if (show.brand) T(id.name, w / 2 + lw * 0.55, h / 2, w * 0.72 - lw, h * 0.5, wt);
    } else if (kind === "bottom") {
      if (show.brand) T(id.name, w / 2, h * 0.2, w * 0.5, h * 0.2, wt);
      if (show.desc) { const txt = F.text || id.desc, fs = Math.max(2, Math.min(w * 0.04, h * 0.1)); c.font = "500 " + fs + "px " + font; c.fillStyle = fg; const ar = isAr(txt); c.direction = ar ? "rtl" : "ltr"; c.textAlign = "center"; wrap(c, txt, w * 0.84).slice(0, Math.floor(h * 0.62 / (fs * 1.5))).forEach((ln, i) => c.fillText(ln, w / 2, h * 0.42 + i * fs * 1.5)); }
      if (show.vol) T(id.vol, w / 2, h * 0.9, w * 0.4, h * 0.14, "600");
    }
    c.restore(); return cv;
  }
  /* ═══ تجميع القالب كاملاً ═══ */
  function sheetCanvas(ppm, o) {
    o = o || {}; const G = geom(), cv = mk(G.tw * ppm, G.th * ppm), c = cv.getContext("2d"), fx = (v, isY) => (v + G.M) * ppm, bgc = S.faces.front.bg || S.id.bg;
    c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
    G.flaps.forEach(f => { pathOf(c, f.pts, fx); c.fillStyle = bgc; c.strokeStyle = bgc; c.lineJoin = "round"; c.lineWidth = 2 * G.B * ppm; c.fill(); if (G.B) c.stroke(); });
    G.glues.forEach(g => { pathOf(c, g, fx); c.fillStyle = "#f4f0e6"; c.fill(); });
    G.faces.forEach(f => { const d = faceDraw(f, ppm, G); c.save(); c.translate(fx(d.cx), fx(d.cy)); c.rotate(d.rot * Math.PI / 180); c.drawImage(d.cv, -d.cv.width / 2, -d.cv.height / 2); c.restore(); });
    if (o.guides) {
      if (G.B) { const t = mk(cv.width, cv.height), tc = t.getContext("2d"); pathOf(tc, G.cut, fx); tc.lineJoin = "round"; tc.lineWidth = 2 * G.B * ppm; tc.strokeStyle = "#16a34a"; tc.stroke(); tc.globalCompositeOperation = "destination-out"; pathOf(tc, G.cut, fx); tc.fillStyle = "#000"; tc.fill(); c.save(); c.globalAlpha = 0.25; c.drawImage(t, 0, 0); c.restore(); }
      G.glues.forEach(g => { c.save(); pathOf(c, g, fx); c.clip(); c.strokeStyle = "rgba(60,50,30,.55)"; c.lineWidth = Math.max(1, 0.12 * ppm); c.beginPath(); for (let i = -G.th; i < G.tw; i += 1.8) { c.moveTo(fx(i), fx(0)); c.lineTo(fx(i + G.th), fx(G.th)); } c.stroke(); c.restore(); });
      c.save(); c.setLineDash([3 * ppm, 2 * ppm]); c.strokeStyle = "#0ea5e9"; c.lineWidth = Math.max(1.2, 0.22 * ppm); G.creases.forEach(l => { c.beginPath(); c.moveTo(fx(l[0]), fx(l[1])); c.lineTo(fx(l[2]), fx(l[3])); c.stroke(); }); c.restore();
      pathOf(c, G.cut, fx); c.strokeStyle = "#e11d48"; c.lineWidth = Math.max(1.4, 0.28 * ppm); c.lineJoin = "round"; c.stroke();
      if (o.labels) { c.save(); c.font = "700 " + Math.max(9, 2.2 * ppm) + "px Arial"; c.textAlign = "left"; c.textBaseline = "top"; c.fillStyle = "rgba(255,255,255,.9)"; c.strokeStyle = "rgba(0,0,0,.65)"; c.lineWidth = 3; const lab = { front: "الأمامي", back: "الخلفي", left: "الأيسر", right: "الأيمن", top: "العلوي", bottom: "السفلي" }; G.faces.forEach(f => { const t = lab[f.id] + " " + Math.round(f.w) + "×" + Math.round(f.h); c.strokeText(t, fx(f.x) + 4, fx(f.y) + 4); c.fillText(t, fx(f.x) + 4, fx(f.y) + 4); }); c.restore(); }
    }
    return cv;
  }
  /* ═══ التصدير ═══ */
  const blobOf = (cv, type, q) => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("تعذّر إنشاء الملف")), type, q));
  const dlBlob = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
  const stamp = () => (S.style === "gift" ? "giftbox-" : "box-") + Math.round(S.W) + "x" + Math.round(S.H) + "x" + Math.round(S.D) + "mm";
  const capPpm = (G, dpi) => { let ppm = num(dpi, 72, 600, 300) / 25.4; const mp = G.tw * G.th * ppm * ppm; if (mp > 60e6) ppm *= Math.sqrt(60e6 / mp); return ppm; };
  async function svgString(guides) {
    const G = geom(), ppm = capPpm(G, Math.min(S.dpi, 300)), bgc = S.faces.front.bg || S.id.bg, f3 = v => (+v).toFixed(3), fx = v => v + G.M;
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + f3(G.tw) + 'mm" height="' + f3(G.th) + 'mm" viewBox="0 0 ' + f3(G.tw) + " " + f3(G.th) + '">\n<title>Alyssum Box Designer — ' + esc(S.id.name) + " " + Math.round(G.W) + "×" + Math.round(G.H) + "×" + Math.round(G.D) + ' mm</title>\n<rect width="100%" height="100%" fill="#fff"/>\n';
    s += '<defs><pattern id="glue-hatch" width="1.8" height="1.8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.8" stroke="#6b5d3a" stroke-width="0.12"/></pattern><mask id="outside" maskUnits="userSpaceOnUse" x="0" y="0" width="' + f3(G.tw) + '" height="' + f3(G.th) + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + svgPath(G.cut, fx) + '" fill="#000"/></mask></defs>\n';
    s += '<g id="artwork-flaps">' + G.flaps.map(f => '<path d="' + svgPath(f.pts, fx) + '" fill="' + bgc + '" stroke="' + bgc + '" stroke-width="' + f3(2 * G.B) + '" stroke-linejoin="round"/>').join("") + "</g>\n";
    s += '<g id="glue-tab">' + G.glues.map(g => '<path d="' + svgPath(g, fx) + '" fill="#f4f0e6"/>').join("") + '</g>\n<g id="artwork-faces">';
    for (const f of G.faces) { const d = faceDraw(f, ppm, G); s += '<image id="face-' + f.id + '" x="' + f3(fx(d.cx - d.lw / 2)) + '" y="' + f3(fx(d.cy - d.lh / 2)) + '" width="' + f3(d.lw) + '" height="' + f3(d.lh) + '"' + (d.rot ? ' transform="rotate(' + d.rot + " " + f3(fx(d.cx)) + " " + f3(fx(d.cy)) + ')"' : "") + ' preserveAspectRatio="none" xlink:href="' + d.cv.toDataURL("image/png") + '"/>'; await new Promise(r => setTimeout(r, 0)); }
    s += "</g>\n";
    if (guides) {
      if (G.B) s += '<g id="bleed-guide"><path d="' + svgPath(G.cut, fx) + '" fill="none" stroke="#16a34a" stroke-opacity="0.45" stroke-width="' + f3(2 * G.B) + '" stroke-linejoin="round" mask="url(#outside)"/></g>\n';
      s += '<g id="glue-area">' + G.glues.map(g => '<path d="' + svgPath(g, fx) + '" fill="url(#glue-hatch)"/>').join("") + "</g>\n";
      s += '<g id="crease-line" fill="none" stroke="#0ea5e9" stroke-width="0.25" stroke-dasharray="3 2">' + G.creases.map(l => '<line x1="' + f3(fx(l[0])) + '" y1="' + f3(fx(l[1])) + '" x2="' + f3(fx(l[2])) + '" y2="' + f3(fx(l[3])) + '"/>').join("") + "</g>\n";
      s += '<g id="cut-line"><path d="' + svgPath(G.cut, fx) + '" fill="none" stroke="#e11d48" stroke-width="0.3" stroke-linejoin="round"/></g>\n';
    }
    return s + "</svg>\n";
  }
  async function pdfBlob(guides) {
    const G = geom(), ppm = capPpm(G, S.dpi), art = sheetCanvas(ppm, { guides: false }), jb = new Uint8Array(await (await blobOf(art, "image/jpeg", Math.min(0.98, S.q / 100))).arrayBuffer());
    const k = 72 / 25.4, pw = G.tw * k, ph = G.th * k, X = x => ((x + G.M) * k).toFixed(3), Y = y => ((G.th - (y + G.M)) * k).toFixed(3), f2 = v => (+v).toFixed(3);
    const poly = pts => { const n = pts.length; let d = ""; for (let i = 0; i < n; i++) { const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = p[2] || 0; if (!r) { d += X(p[0]) + " " + Y(p[1]) + (i ? " l\n" : " m\n"); continue; } const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2), kk = Math.min(r, l1 / 2, l2 / 2), s = [p[0] + v1[0] / l1 * kk, p[1] + v1[1] / l1 * kk], e = [p[0] + v2[0] / l2 * kk, p[1] + v2[1] / l2 * kk]; d += X(s[0]) + " " + Y(s[1]) + (i ? " l\n" : " m\n"); const c1 = [s[0] + (p[0] - s[0]) * 2 / 3, s[1] + (p[1] - s[1]) * 2 / 3], c2 = [e[0] + (p[0] - e[0]) * 2 / 3, e[1] + (p[1] - e[1]) * 2 / 3]; d += X(c1[0]) + " " + Y(c1[1]) + " " + X(c2[0]) + " " + Y(c2[1]) + " " + X(e[0]) + " " + Y(e[1]) + " c\n"; } return d + "h\n"; };
    let ct = "q\n" + f2(pw) + " 0 0 " + f2(ph) + " 0 0 cm\n/Im0 Do\nQ\n";
    if (guides) {
      G.glues.forEach(g => { ct += "q\n" + poly(g) + "W n\n0.24 0.2 0.12 RG 0.12 w\n"; for (let i = -G.th; i < G.tw; i += 1.8) ct += X(i) + " " + Y(0) + " m " + X(i + G.th) + " " + Y(G.th) + " l S\n"; ct += "Q\n"; });
      ct += "q\n0.055 0.647 0.914 RG 0.7 w [8.5 5.7] 0 d\n" + G.creases.map(l => X(l[0]) + " " + Y(l[1]) + " m " + X(l[2]) + " " + Y(l[3]) + " l S\n").join("") + "Q\n";
      ct += "q\n0.882 0.114 0.282 RG 0.85 w 1 j\n" + poly(G.cut) + "S\nQ\n";
    }
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0; const push = u => { parts.push(u); len += u.length; }, pushS = s => push(enc.encode(s));
    pushS("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"); const obj = (n, body, stream) => { offs[n] = len; pushS(n + " 0 obj\n" + body); if (stream) { pushS("\nstream\n"); push(stream); pushS("\nendstream"); } pushS("\nendobj\n"); };
    const cts = enc.encode(ct);
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>"); obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + f2(pw) + " " + f2(ph) + "] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>");
    obj(4, "<< /Length " + cts.length + " >>", cts);
    obj(5, "<< /Type /XObject /Subtype /Image /Width " + art.width + " /Height " + art.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jb.length + " >>", jb);
    const xr = len; pushS("xref\n0 6\n0000000000 65535 f \n"); for (let i = 1; i <= 5; i++) pushS(String(offs[i]).padStart(10, "0") + " 00000 n \n");
    pushS("trailer\n<< /Size 6 /Root 1 0 R /Info << /Title (Alyssum Box Designer) /Producer (Alyssum) >> >>\nstartxref\n" + xr + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
  }
  const msg = (t, bad) => { const e = $("bx-msg"); if (e) { e.textContent = t || ""; e.style.color = bad ? "#ffb4b4" : "#e2fe17"; } };
  async function doExport(kind) {
    try {
      msg("جارٍ التجهيز…"); await new Promise(r => setTimeout(r, 30)); const G = geom();
      if (kind === "svg") dlBlob(new Blob([await svgString(S.guides)], { type: "image/svg+xml" }), stamp() + ".svg");
      else if (kind === "pdf") dlBlob(await pdfBlob(S.guides), stamp() + ".pdf");
      else { const ppm = capPpm(G, S.dpi), cv = sheetCanvas(ppm, { guides: S.guides }), webp = S.fmt === "webp", b = await blobOf(cv, webp ? "image/webp" : "image/png", S.q / 100); if (webp && b.type !== "image/webp") throw new Error("متصفحك لا يدعم WebP — اختر PNG"); dlBlob(b, stamp() + "." + (webp ? "webp" : "png")); }
      msg("✅ تم التنزيل — الأبعاد الحقيقية " + Math.round(G.tw - 2 * G.M) + "×" + Math.round(G.th - 2 * G.M) + " مم (بدون هامش العرض)");
    } catch (e) { msg("⚠️ " + e.message, true); }
  }
  /* ═══ إرسال إلى 3D Pack Studio ═══ */
  function model3d() {
    const G = geom(), ppm = Math.min(14, 1600 / Math.max(G.W, G.H, G.D)), faces = {}; FACES.forEach(([k]) => { faces[k] = faceCanvas(k, ppm, null, G); });
    return { style: G.style, rots: Object.fromEntries(G.faces.map(f => [f.id, f.rot || 0])), dia: G.dia || 0, W: G.W, H: G.H, D: G.D, T: G.T, G: G.G, flap: S.faces.front.bg || S.id.bg, faces };
  }
  async function to3d() {
    if (typeof Pack3D === "undefined" || !Pack3D.openBox) { msg("⚠️ 3D Pack Studio غير متاح", true); return; }
    msg("جارٍ إرسال التصميم…"); try { await Pack3D.openBox(model3d()); msg(""); } catch (e) { msg("⚠️ " + e.message, true); }
  }
  /* ═══ الواجهة ═══ */
  const CSS = '#bx-bg{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:.8rem}#bx{background:rgba(9,24,18,.99);border:1px solid rgba(var(--g-mint-rgb,226,254,23),.35);border-radius:18px;width:min(1400px,100%);height:min(94vh,900px);display:flex;flex-direction:column;color:#fff;direction:rtl;overflow:hidden}#bx .bx-h{display:flex;align-items:center;gap:.7rem;padding:.7rem 1rem;border-bottom:1px solid rgba(255,255,255,.12)}#bx .bx-h b{font-size:1.05rem}#bx .bx-h small{opacity:.7}#bx .bx-x{margin-inline-start:auto}#bx .bx-m{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;min-height:0}@media(max-width:900px){#bx .bx-m{grid-template-columns:1fr;grid-template-rows:minmax(280px,42%) 1fr}}#bx .bx-st{position:relative;overflow:auto;background:#e9ecf1;padding:.8rem;text-align:center}#bx .bx-st canvas{max-width:100%;height:auto;box-shadow:0 6px 24px rgba(0,0,0,.25);background:#fff;cursor:pointer;border-radius:4px}#bx .bx-side{overflow:auto;padding:.8rem 1rem;border-inline-start:1px solid rgba(255,255,255,.12)}#bx h4{margin:.9rem 0 .4rem;font-size:.9rem;color:var(--g-mint,#e2fe17)}#bx h4:first-child{margin-top:0}#bx label.f{display:block;font-weight:700;font-size:.76rem;margin:.45rem 0 .15rem;color:rgba(255,255,255,.85)}#bx input,#bx select,#bx textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.22);border-radius:10px;color:#fff;padding:.4rem .5rem;font:inherit;font-size:.85rem}#bx textarea{min-height:4.4rem;resize:vertical}#bx select option{color:#111}#bx input[type=color]{padding:.1rem;height:2rem}#bx input[type=checkbox]{width:auto}#bx .r2{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}#bx .r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem}#bx .chips{display:flex;gap:.35rem;flex-wrap:wrap}#bx .chips button{padding:.4rem .6rem;font-size:.76rem}#bx button{cursor:pointer;border-radius:12px;padding:.5rem .8rem;font-weight:800;color:#fff;font-size:.82rem;border:1px solid rgba(var(--g-mint-rgb,226,254,23),.45);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,226,254,23),.3),rgba(var(--g-mint-rgb,226,254,23),.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 4px rgba(0,0,0,.25),0 3px 8px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s}#bx button:hover{transform:translateY(-2px)}#bx button.o{border-color:rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04))}#bx button.on{border-color:#e2fe17;background:linear-gradient(180deg,rgba(var(--g-mint-rgb,226,254,23),.55),rgba(var(--g-mint-rgb,226,254,23),.2))}#bx .bx-b{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem}#bx .bx-f{padding:.55rem 1rem;border-top:1px solid rgba(255,255,255,.12);min-height:2.2rem;font-weight:700;font-size:.85rem}#bx .m{font-size:.74rem;color:rgba(255,255,255,.65);line-height:1.6}#bx .bx-up{border:1.5px dashed rgba(255,255,255,.3);border-radius:12px;padding:.6rem;text-align:center;cursor:pointer;font-size:.8rem}#bx .bx-up:hover{border-color:#e2fe17}#bx .fl{display:grid;grid-template-columns:1fr 1fr;gap:.25rem .6rem;margin-top:.4rem}#bx .fl label{display:flex;gap:.4rem;align-items:center;font-size:.78rem}';
  const field = (a, b, label, type, extra) => '<div><label class="f">' + label + '</label><input ' + a + '="' + b + '" type="' + type + '" ' + (extra || "") + "></div>";
  function panel() {
    const id = S.id, F = S.faces[S.face], opt = (arr, cur) => arr.map(o => '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>").join("");
    return '<h4>① شكل العلبة والأبعاد</h4><div class="chips">' + [["tuck", "علبة بغطاء إدخال"], ["gift", "علبة هدية (قطعة واحدة)"]].map(p => '<button type="button" data-style="' + p[0] + '" class="' + (S.style === p[0] ? "on" : "o") + '">' + p[1] + "</button>").join("") + '</div><div class="chips">' + PRESETS.map(p => '<button type="button" data-pre="' + p[0] + '" class="' + (S.type === p[0] ? "on" : "o") + '">' + p[1] + "</button>").join("") + '</div>' +
      '<div class="r3"><div><label class="f">العرض مم</label><input data-k="W" type="number" min="10" max="400" step="1"></div><div><label class="f">الارتفاع مم</label><input data-k="H" type="number" min="10" max="400" step="1"></div><div><label class="f">العمق مم</label><input data-k="D" type="number" min="8" max="300" step="1"></div></div>' +
      '<div class="r3"><div><label class="f">لسان الإدخال</label><input data-k="tuck" type="number" min="0" max="80" step="1" placeholder="تلقائي"></div><div><label class="f">' + (S.style === "gift" ? "جناح اللصق" : "لسان اللصق") + '</label><input data-k="glue" type="number" min="6" max="30" step="1"></div><div><label class="f">النزف مم</label><input data-k="bleed" type="number" min="0" max="10" step="0.5"></div></div>' + (S.style === "gift" ? '<div class="r2"><div><label class="f">قطر فتحة الإبهام مم</label><input data-k="thumb" type="number" min="0" max="120" step="1" placeholder="تلقائي"></div><div></div></div>' : "") +
      '<h4>② هوية العلبة (من الملصق)</h4><div class="bx-b" style="margin-top:0"><button type="button" class="o" data-act="fromPack">هوية ملصق 3D Pack Studio</button><button type="button" class="o" data-act="fromBrand">الهوية البصرية للعلامة</button></div>' +
      '<div class="r2">' + field("data-id", "name", "اسم العلامة", "text") + field("data-id", "sub", "الوصف القصير", "text") + field("data-id", "vol", "الحجم", "text") + field("data-id", "code", "رقم الباركود", "text") + "</div>" +
      '<div class="r3">' + field("data-id", "bg", "الخلفية", "color") + field("data-id", "fg", "لون النص", "color") + field("data-id", "accent", "لون مميّز", "color") + "</div>" +
      '<div class="r2"><div><label class="f">الخط</label><select data-id="font">' + opt([["sans", "عصري"], ["serif", "كلاسيكي"], ["bold", "ثقيل"]], id.font) + '</select></div><div><label class="f">النمط الزخرفي</label><select data-id="pattern">' + opt(PATTERNS, id.pattern) + "</select></div></div>" +
      '<label class="f">نص تفصيلي (وصف / مكوّنات / طريقة الاستعمال)</label><textarea data-id="desc"></textarea>' +
      '<div class="r2"><div><label class="f">الشعار</label><label class="bx-up" for="bx-logo">' + (logo ? "✔ تم رفع الشعار — استبدله" : "⬆ ارفع شعاراً") + '<input id="bx-logo" type="file" accept="image/*" hidden></label></div><div><label class="f">تصميم الملصق</label><label class="bx-up" for="bx-art">' + (art ? "✔ تم رفع التصميم — استبدله" : "⬆ ارفع تصميم الملصق") + '<input id="bx-art" type="file" accept="image/*" hidden></label></div></div>' +
      '<h4>③ تعديل كل وجه على حدة</h4><div class="chips">' + FACES.map(f => '<button type="button" data-face="' + f[0] + '" class="' + (S.face === f[0] ? "on" : "o") + '">' + f[1] + "</button>").join("") + "</div>" +
      '<div class="fl">' + FLAGS.map(f => '<label><input type="checkbox" data-fs="' + f[0] + '"' + (F.show[f[0]] ? " checked" : "") + "> " + f[1] + "</label>").join("") + "</div>" +
      '<div class="r2"><div><label class="f">لون خلفية هذا الوجه</label><input data-fk="bg" type="color" value="' + esc(F.bg || id.bg) + '"></div><div><label class="f">لون نصه</label><input data-fk="fg" type="color" value="' + esc(F.fg || id.fg) + '"></div></div>' +
      '<label class="f">نص خاص بهذا الوجه (يستبدل النص التفصيلي)</label><textarea data-fk="text" placeholder="اتركه فارغاً لاستعمال النص العام"></textarea>' +
      '<div class="bx-b"><button type="button" class="o" data-act="resetFace">إعادة التوزيع التلقائي لهذا الوجه</button><button type="button" class="o" data-act="useArt">استعمل ملصقي على الأمامي</button></div>' +
      '<h4>④ التصدير</h4><div class="r3"><div><label class="f">الدقة</label><select data-k="dpi">' + opt([["150", "150 dpi"], ["300", "300 dpi (طباعة)"], ["600", "600 dpi"]], String(S.dpi)) + '</select></div><div><label class="f">صيغة الصورة</label><select data-k="fmt">' + opt([["png", "PNG"], ["webp", "WebP"]], S.fmt) + '</select></div><div><label class="f">جودة</label><input data-k="q" type="number" min="40" max="100"></div></div>' +
      '<label class="fl" style="display:flex;gap:.4rem;align-items:center;margin:.5rem 0 0;font-size:.78rem"><input type="checkbox" data-k="guides"' + (S.guides ? " checked" : "") + '> تضمين خطوط القص والثني والنزف (طبقات منفصلة في SVG/PDF)</label>' +
      '<div class="bx-b"><button type="button" data-ex="svg">⬇ SVG</button><button type="button" data-ex="pdf">⬇ PDF</button><button type="button" class="o" data-ex="img">⬇ صورة</button><button type="button" data-act="to3d" style="flex:1 1 100%">🧊 إرسال إلى 3D Pack Studio (طيّ العلبة)</button><button type="button" class="o" data-act="profiles" style="flex:1 1 100%">📐 قوالب قص جاهزة (23 شكلاً: أهرام، مخاريط، دائرية، قلب، ظرف…)</button></div>' +
      '<p class="m">الخط الأحمر = القص، الأزرق المتقطع = الثني، الأخضر = منطقة النزف، المائل = منطقة اللصق. اضغط على أي وجه في المعاينة لاختياره.</p>';
  }
  function fillValues() {
    const side = $("bx-side"); if (!side) return;
    side.querySelectorAll("[data-k]").forEach(e => { if (e.type === "checkbox") e.checked = !!S[e.dataset.k]; else if (e.tagName !== "SELECT") e.value = S[e.dataset.k] || (e.dataset.k === "tuck" || e.dataset.k === "thumb" ? "" : S[e.dataset.k]); });
    side.querySelectorAll("[data-id]").forEach(e => { if (e.tagName !== "SELECT") e.value = S.id[e.dataset.id]; });
    const ta = side.querySelector('[data-fk="text"]'); if (ta) ta.value = S.faces[S.face].text || "";
  }
  function schedule() { clearTimeout(pvT); pvT = setTimeout(preview, 70); }
  function preview() {
    const st = $("bx-st"); if (!st) return; const G = geom(), ppm = Math.min(7, Math.max(1.5, Math.min((st.clientWidth - 30) / G.tw, (st.clientHeight - 30) / G.th))), cv = sheetCanvas(ppm, { guides: true, labels: true }), c = cv.getContext("2d"), f = G.faces.find(x => x.id === S.face);
    if (f) { c.save(); c.strokeStyle = "#e2fe17"; c.lineWidth = Math.max(2, 0.5 * ppm); c.setLineDash([2 * ppm, 1.2 * ppm]); c.strokeRect((f.x + G.M) * ppm + 1, (f.y + G.M) * ppm + 1, f.w * ppm - 2, f.h * ppm - 2); c.restore(); }
    pvMeta = { G, ppm }; st.innerHTML = ""; st.appendChild(cv);
    cv.onclick = e => { const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * G.tw - G.M, my = (e.clientY - r.top) / r.height * G.th - G.M, hit = G.faces.find(q => mx >= q.x && mx <= q.x + q.w && my >= q.y && my <= q.y + q.h); if (hit) { S.face = hit.id; save(); ui(); schedule(); } };
    const info = $("bx-info"); if (info) info.textContent = "القالب المفتوح: " + Math.round(G.tw - 2 * G.M) + "×" + Math.round(G.th - 2 * G.M) + " مم • العلبة المغلقة: " + Math.round(G.W) + "×" + Math.round(G.H) + "×" + Math.round(G.D) + " مم";
  }
  const readFile = file => new Promise((res, rej) => { const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.width, im.height)), cv = mk(im.width * k, im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv); }; im.onerror = () => rej(new Error("تعذّر قراءة الصورة")); im.src = url; });
  function setPreset(k) { const p = PRESETS.find(x => x[0] === k); if (!p) return; S.type = k; if (k !== "custom") { S.W = p[2]; S.H = p[3]; S.D = p[4]; } save(); ui(); schedule(); }
  function wire() {
    const side = $("bx-side"); fillValues();
    side.querySelectorAll("[data-pre]").forEach(b => b.onclick = () => setPreset(b.dataset.pre));
    side.querySelectorAll("[data-style]").forEach(b => b.onclick = () => { S.style = b.dataset.style; save(); ui(); schedule(); });
    side.querySelectorAll("[data-k]").forEach(e => { const h = () => { const k = e.dataset.k; let v = e.type === "checkbox" ? e.checked : e.value; if (["W", "H", "D", "tuck", "thumb", "glue", "bleed", "dpi", "q"].includes(k)) { v = (k === "tuck" || k === "thumb") && v === "" ? 0 : parseFloat(v); if (!isFinite(v)) return; } S[k] = v; if (["W", "H", "D"].includes(k)) S.type = "custom"; save(); if (["W", "H", "D"].includes(k)) side.querySelectorAll("[data-pre]").forEach(b => b.className = b.dataset.pre === "custom" ? "on" : "o"); schedule(); }; e.oninput = h; e.onchange = h; });
    side.querySelectorAll("[data-id]").forEach(e => { const h = () => { S.id[e.dataset.id] = e.value; save(); schedule(); }; e.oninput = h; e.onchange = h; });
    side.querySelectorAll("[data-face]").forEach(b => b.onclick = () => { S.face = b.dataset.face; save(); ui(); schedule(); });
    side.querySelectorAll("[data-fs]").forEach(e => e.onchange = () => { S.faces[S.face].show[e.dataset.fs] = e.checked ? 1 : 0; save(); schedule(); });
    side.querySelectorAll("[data-fk]").forEach(e => { const h = () => { S.faces[S.face][e.dataset.fk] = e.value; save(); schedule(); }; e.oninput = h; e.onchange = h; });
    side.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => doExport(b.dataset.ex));
    side.querySelectorAll("[data-act]").forEach(b => b.onclick = () => act(b.dataset.act));
    const fl = $("bx-logo"); if (fl) fl.onchange = async () => { if (fl.files[0]) { try { logo = await readFile(fl.files[0]); ui(); schedule(); } catch (e) { msg("⚠️ " + e.message, true); } } };
    const fa = $("bx-art"); if (fa) fa.onchange = async () => { if (fa.files[0]) { try { art = await readFile(fa.files[0]); S.faces.front.show.art = 1; S.faces.front.show.brand = 0; S.faces.front.show.sub = 0; S.faces.front.show.vol = 0; save(); ui(); schedule(); msg("✅ طُبّق التصميم على الواجهة الأمامية"); } catch (e) { msg("⚠️ " + e.message, true); } } };
  }
  function act(a) {
    if (a === "resetFace") { S.faces[S.face] = { bg: "", fg: "", text: "", show: clone(DEFSHOW[S.face]) }; save(); ui(); schedule(); }
    else if (a === "useArt") { if (!art) { msg("ارفع تصميم الملصق أولاً", true); return; } const s = S.faces.front.show; s.art = 1; s.brand = 0; s.sub = 0; s.vol = 0; save(); ui(); schedule(); }
    else if (a === "fromPack") fromPack(); else if (a === "fromBrand") fromBrand(); else if (a === "to3d") to3d();
    else if (a === "profiles") { if (typeof BoxProfiles === "undefined") msg("مكتبة القوالب غير محمّلة في هذه النسخة", true); else { close(); BoxProfiles.open(); } }
  }
  function fromPack() {
    if (typeof Pack3D === "undefined") { msg("3D Pack Studio غير متاح", true); return; } const q = Pack3D.S.ql || {}; S.id.name = q.name || S.id.name; S.id.sub = q.sub || S.id.sub; S.id.vol = q.vol || S.id.vol; if (q.c2) S.id.bg = q.c2; if (q.ink) S.id.fg = q.ink; if (q.c1) S.id.accent = q.c1;
    let a = null; try { a = Pack3D._t.artCanvas && Pack3D._t.artCanvas(); } catch (e) { } if (a && !Pack3D.S.useQuick) { art = a; const s = S.faces.front.show; s.art = 1; s.brand = 0; s.sub = 0; s.vol = 0; }
    save(); ui(); schedule(); msg("✅ أُخذت هوية الملصق من 3D Pack Studio" + (a && !Pack3D.S.useQuick ? " مع التصميم المرفوع" : ""));
  }
  function fromBrand() {
    let k = null; try { k = JSON.parse(localStorage.getItem("alyssum_brand_kit") || "null"); } catch (e) { } if (!k || !Array.isArray(k.colors)) { msg("لا توجد هوية بصرية محفوظة بعد — أنشئها من أداة «الهوية البصرية» في المطوّر", true); return; }
    const ok = c => /^#[0-9a-f]{6}$/i.test(c || ""); if (ok(k.colors[0])) S.id.bg = k.colors[0]; if (ok(k.colors[2])) S.id.fg = k.colors[2]; if (ok(k.colors[4])) S.id.accent = k.colors[4]; if (k.name) S.id.name = k.name;
    try { const d = localStorage.getItem("alyssum_brand_logo"); if (d) { const im = new Image(); im.onload = () => { const cv = mk(im.width, im.height); cv.getContext("2d").drawImage(im, 0, 0); logo = cv; ui(); schedule(); }; im.src = d; } } catch (e) { }
    save(); ui(); schedule(); msg("✅ طُبّقت الهوية البصرية للعلامة");
  }
  function ui() { const side = $("bx-side"); if (!side) return; const sc = side.scrollTop; side.innerHTML = panel(); wire(); side.scrollTop = sc; }
  function close() { opened = false; const b = $("bx-bg"); if (b) b.remove(); }
  function open() {
    close(); if (!$("bx-css")) { const st = document.createElement("style"); st.id = "bx-css"; st.textContent = CSS; document.head.appendChild(st); }
    const bg = document.createElement("div"); bg.id = "bx-bg"; bg.innerHTML = '<div id="bx" role="dialog" aria-label="Alyssum Box Designer"><div class="bx-h"><b>📦 Alyssum Box Designer</b><small>قالب طباعة العلبة من هوية الملصق — قص وثني ولصق ونزف</small><small id="bx-info"></small><button type="button" class="o bx-x" id="bx-x">إغلاق</button></div><div class="bx-m"><div class="bx-st" id="bx-st"></div><div class="bx-side" id="bx-side"></div></div><div class="bx-f" id="bx-msg"></div></div>';
    document.body.appendChild(bg); opened = true; $("bx-x").onclick = close; bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" && $("bx-bg") && !$("p3-bg") && !$("bp-bg")) { close(); document.removeEventListener("keydown", k); } });
    ui(); preview(); window.addEventListener("resize", schedule);
  }
  /* الواجهة الرئيسية لأداة «Box Designer» صارت مكتبة القوالب (BoxProfiles)؛ محرّر التصميم على الوجوه (إدخال/هدية) يبقى عبر openArt */
  function openArt(st) { if (st === "tuck" || st === "gift") { S.style = st; save(); } open(); }
  function openMain() { if (typeof Studio3D !== "undefined") { Studio3D.open({ tab: "cut" }); return; } if (typeof BoxProfiles !== "undefined" && BoxProfiles.open) BoxProfiles.open(); else open(); }
  return { open: openMain, openArt, openLegacy: open, close, S, PRESETS, FACES, geom, _t: { logExt, faceCanvas, sheetCanvas, svgString, pdfBlob, model3d, setArt: c => { art = c; }, setLogo: c => { logo = c; }, preview } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BoxDesigner;
