/* استوديو المنتج (المرحلة 2 من platform/docs/photoroom-tools-report.md): صورة منتج ← صورة متجر احترافية بنقرات، داخل المتصفح وبلا API.
   ① نزع الخلفية (PBBgRemove) ← ② خلفية (لون/تدرّج/شفاف/منصة/مشهد) ← ③ ظل (ملامسة/ناعم/قوي) ← ④ حجم المنتج وموضعه (حدود ألفا) ← ⑤ مقاس منصة ← تطبيق/تنزيل.
   الدوال compose/bbox/hasAlpha نقية على Canvas وقابلة للاختبار؛ الخيارات تُحفظ في localStorage pbx_studio (أساس «قوالب المعالجة» في محرر الدفعات). */
const PBStudio = (() => {
  const SIZES = [["1000x1000", "مربع 1:1 — متجر (1000×1000)"], ["1080x1350", "عمودي 4:5 — إنستغرام (1080×1350)"], ["1080x1920", "طولي 9:16 — ستوري/ريلز/تيك توك"], ["1000x1500", "طولي 2:3 — بنتريست"], ["1920x1080", "عريض 16:9 — يوتيوب"], ["1200x628", "إعلان فيسبوك/جوجل (1200×628)"], ["1200x630", "رابط/فيسبوك (1200×630)"], ["orig", "نفس نسبة الصورة"], ["custom", "مقاس مخصص…"]];
  const BGS = [["white", "أبيض متجر", { type: "color", c1: "#ffffff" }], ["gray", "رمادي فاتح", { type: "color", c1: "#f1f2f4" }], ["cream", "كريمي", { type: "color", c1: "#f6efe4" }], ["warm", "دافئ", { type: "grad", c1: "#fff3e6", c2: "#f3d3b3" }], ["mint", "أخضر هادئ", { type: "grad", c1: "#eaf6ee", c2: "#bfe3cc" }], ["sky", "سماوي", { type: "grad", c1: "#eef5ff", c2: "#c4dbf7" }], ["dark", "داكن", { type: "grad", c1: "#2b2f33", c2: "#0d0f11" }], ["forest", "غابة", { type: "grad", c1: "#1d5a47", c2: "#0b2a21" }], ["none", "شفاف", { type: "none" }]];
  const SCENES = [1, 2, 3, 4, 5, 6].map(i => ({ id: "sc" + i, src: "assets/img/tpl/alyssum-sc" + i + ".webp", floor: .76 }));
  const BADGES = [["-50%", "#e11d48", "#ffffff", "circle"], ["توصيل مجاني", "#16a34a", "#ffffff", "pill"], ["جديد", "#f59e0b", "#1f1300", "pill"], ["الأكثر مبيعاً", "#7c3aed", "#ffffff", "ribbon"], ["ضمان الجودة", "#0ea5e9", "#ffffff", "pill"], ["عرض خاص", "#111827", "#fde68a", "ribbon"], ["الدفع عند الاستلام", "#0f766e", "#ffffff", "pill"], ["100% طبيعي", "#15803d", "#ffffff", "circle"], ["كمية محدودة", "#dc2626", "#ffffff", "pill"], ["هدية مجانية", "#db2777", "#ffffff", "ribbon"], ["أصلي", "#1d4ed8", "#ffffff", "circle"], ["عرض اليوم", "#ea580c", "#ffffff", "ribbon"], ["سعر خاص", "#facc15", "#1f1300", "pill"], ["{price}", "#111827", "#ffffff", "circle"]];
  /* عناوين عريضة بعرض الصورة (الرمز {name} يُستبدل باسم كل منتج عند التطبيق على كل المنتجات، و{price} بسعره) */
  const TITLES = [["{name}", "#16352b", "#ffffff", "title"], ["عرض خاص لفترة محدودة", "#dc2626", "#ffffff", "title"], ["توصيل لكل الولايات", "#0f766e", "#ffffff", "title"], ["جودة مضمونة", "#111827", "#fde68a", "title"], ["{name} — {price}", "#1d4ed8", "#ffffff", "title"]];
  const POS = ["أعلى يسار", "أعلى وسط", "أعلى يمين", "وسط يسار", "الوسط", "وسط يمين", "أسفل يسار", "أسفل وسط", "أسفل يمين"];
  const DEF = { bg: "white", c1: "#ffffff", c2: "#cfe3ff", c3: "#8fb4ff", gm: "solid", ga: 135, blur: 18, shadow: "contact", shI: 100, shB: 100, shX: 0, shY: 100, shW: 100, shH: 100, pad: .1, align: "center", size: "1000x1000", cw: 1000, ch: 1000, podium: false, rot: 0, flip: false, font: "", refl: 0, outW: 0, outC: "#ffffff", bri: 0, con: 0, sat: 0, tmp: 0, ov: [], logoPos: 8, logoSize: 16, logoOp: 90, fmt: "png", q: 92 };
  const RSG = { bg: ["bg", "c1", "c2", "c3", "gm", "ga", "blur"], size: ["size", "cw", "ch"], shadow: ["shadow"] };
  const SITE_FF = "'Cairo','Segoe UI'", LSK = "pbx_studio";
  const S = { id: "", src: "", cut: null, bb: null, srcC: null, logo: null, opt: Object.assign({}, DEF), busy: false, msg: "", scenes: {}, tab: "bg", pv: "", pvUrl: "", off: false, dtok: 0, site: { ff: SITE_FF, url: "", loaded: false } };
  try { const o = JSON.parse(localStorage.getItem(LSK) || "null"); if (o && typeof o === "object") Object.assign(S.opt, o); } catch (e) { }
  if (!Array.isArray(S.opt.ov)) S.opt.ov = [];
  const save = () => { try { localStorage.setItem(LSK, JSON.stringify(S.opt, (k, v) => k === "_b" ? undefined : v)); } catch (e) { } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  /* ── دوال نقية ── */
  function hasAlpha(c) {
    const w = Math.min(c.width, 64), h = Math.min(c.height, 64), t = document.createElement("canvas"); t.width = w; t.height = h; const g = t.getContext("2d", { willReadFrequently: true }); g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data; let n = 0, edge = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = d[(y * w + x) * 4 + 3]; if (a < 250) { n++; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++; } }
    return n > w * h * 0.03 && edge > (2 * (w + h)) * 0.5;      /* شفافية ملحوظة وعلى الحواف: صورة بخلفية شفافة فعلاً */
  }
  /* مستطيل المنتج (ألفا > thr) على نسخة مصغّرة ثم يُكبَّر */
  function bbox(c, thr) {
    thr = thr == null ? 12 : thr; const k = Math.min(1, 600 / Math.max(c.width, c.height)), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k)), t = document.createElement("canvas"); t.width = w; t.height = h;
    const g = t.getContext("2d", { willReadFrequently: true }); g.drawImage(c, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { x: 0, y: 0, w: c.width, h: c.height };
    const X0 = Math.max(0, Math.floor(x0 / k) - 1), Y0 = Math.max(0, Math.floor(y0 / k) - 1), X1 = Math.min(c.width, Math.ceil((x1 + 1) / k) + 1), Y1 = Math.min(c.height, Math.ceil((y1 + 1) / k) + 1);
    return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
  }
  const rgba = (hex, a) => { let x = String(hex || "#000").replace("#", ""); if (x.length === 3) x = x.replace(/./g, "$&$&"); const n = parseInt(x, 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  function drawBg(g, W, H, bg, scene, o) {
    if (!bg || bg.type === "none") return;
    if (bg.type === "color") { g.fillStyle = bg.c1; g.fillRect(0, 0, W, H); return; }
    if (bg.type === "grad") { let gr; if (bg.ang != null) { const a = bg.ang * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), L = Math.abs(W * dx) + Math.abs(H * dy); gr = g.createLinearGradient(W / 2 - dx * L / 2, H / 2 - dy * L / 2, W / 2 + dx * L / 2, H / 2 + dy * L / 2); } else gr = g.createLinearGradient(0, 0, W * .35, H); gr.addColorStop(0, bg.c1); if (bg.c3) { gr.addColorStop(.5, bg.c2); gr.addColorStop(1, bg.c3); } else gr.addColorStop(1, bg.c2 || bg.c1); g.fillStyle = gr; g.fillRect(0, 0, W, H); return; }
    if (bg.type === "scene" && scene) { const r = Math.max(W / scene.width, H / scene.height), w = scene.width * r, h = scene.height * r; g.drawImage(scene, (W - w) / 2, (H - h) / 2, w, h); return; }
    if (bg.type === "blur" && o && o.blurSrc) { const s = o.blurSrc, r = Math.max(W / s.width, H / s.height) * 1.12, w = s.width * r, h = s.height * r; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.save(); try { g.filter = "blur(" + Math.max(1, W * (o.blur == null ? 18 : o.blur) / 1000) + "px)"; } catch (e) { } g.drawImage(s, (W - w) / 2, (H - h) / 2, w, h); g.restore(); }
  }
  function drawPodium(g, cx, floorY, rx, W, H, tint) {
    const ry = rx * .2, body = Math.max(H * .09, rx * .45), top = tint || "#f4f1ea", side = "#d9d4c8";
    const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0); gr.addColorStop(0, side); gr.addColorStop(.45, top); gr.addColorStop(1, "#bfb9ab");
    g.save(); g.fillStyle = gr; g.beginPath(); g.moveTo(cx - rx, floorY); g.lineTo(cx - rx, floorY + body); g.ellipse(cx, floorY + body, rx, ry, 0, Math.PI, 0, true); g.lineTo(cx + rx, floorY); g.closePath(); g.fill();
    g.fillStyle = top; g.beginPath(); g.ellipse(cx, floorY, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = Math.max(1, rx * .012); g.beginPath(); g.ellipse(cx, floorY, rx, ry, 0, Math.PI, 0, true); g.stroke(); g.restore();
  }
  /* موضع مستطيل داخل القماش: pos 0..8 (3×3) */
  const tok = (t, o) => { const v = (o && o.vars) || {}; return t.replace(/\{name\}/g, v.name || "اسم المنتج").replace(/\{price\}/g, v.price || "السعر"); };
  const anchor = (pos, W, H, w, h, m) => { const c = pos % 3, r = (pos / 3) | 0; return [c === 0 ? m : c === 1 ? (W - w) / 2 : W - w - m, r === 0 ? m : r === 1 ? (H - h) / 2 : H - h - m]; };
  const rrect = (g, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  /* الخط: فارغ = خط الموقع (theme) وإلا اسم عائلة من قائمة خطوط المطوّر */
  const fontCss = (v, site) => v ? "'" + String(v).replace(/'/g, "") + "'" : (site || SITE_FF);
  /* ملصق/شارة نصية: pill | circle | ribbon | plain */
  function drawBadge(g, W, H, ov, o) {
    ov._b = null; const t = tok(String(ov.t || ""), o).trim(); if (!t) return; const fs = Math.max(10, W * (ov.s || 8) / 100), pos = ov.pos == null ? 2 : ov.pos, m = W * .04;
    g.save(); g.font = "800 " + fs + "px " + fontCss(ov.font || (o && o.font), o && o.siteFf) + ",Tahoma,Arial,sans-serif"; g.textBaseline = "middle"; g.textAlign = "center"; try { g.direction = /[؀-ۿ]/.test(t) ? "rtl" : "ltr"; } catch (e) { }
    let tw = g.measureText(t).width; const st = ov.st || "pill", cl = (v, a, b) => Math.max(a, Math.min(b, v)), custom = ov.fx != null && ov.fy != null;
    /* موضع مخصّص بالسحب (مركز العنصر كنسبة من الصورة) وإلا أحد المواضع التسعة؛ ويُسجَّل صندوق العنصر ov._b لمقابض السحب */
    const place = (w, h, mm) => { const r = custom ? [cl(ov.fx * W - w / 2, 0, Math.max(0, W - w)), cl(ov.fy * H - h / 2, 0, Math.max(0, H - h))] : anchor(pos, W, H, w, h, mm); ov._b = [r[0] / W, r[1] / H, w / W, h / H]; return r; };
    if (st === "title") { let f2 = fs; while (tw > W * .92 && f2 > 10) { f2 -= 2; g.font = g.font.replace(/[0-9.]+px/, f2 + "px"); tw = g.measureText(t).width; } const h = f2 * 2.1, y = ov.fy != null ? cl(ov.fy * H - h / 2, 0, Math.max(0, H - h)) : anchor(pos, W, H, W, h, 0)[1]; ov._b = [0, y / H, 1, h / H]; g.fillStyle = ov.bg || "#16352b"; g.shadowColor = "rgba(0,0,0,.2)"; g.shadowBlur = f2 * .2; g.fillRect(0, y, W, h); g.shadowColor = "transparent"; g.fillStyle = ov.fg || "#ffffff"; g.fillText(t, W / 2, y + h / 2 + f2 * .04); g.restore(); return; }
    if (st === "circle") { const d = Math.max(tw + fs * .9, fs * 2.2), [x, y] = place(d, d, m); g.translate(x + d / 2, y + d / 2); g.rotate(-.1); g.fillStyle = ov.bg || "#e11d48"; g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = fs * .3; g.shadowOffsetY = fs * .1; g.beginPath(); g.arc(0, 0, d / 2, 0, Math.PI * 2); g.fill(); g.shadowColor = "transparent"; g.fillStyle = ov.fg || "#fff"; g.fillText(t, 0, fs * .04); }
    else if (st === "plain") { const [x, y] = place(tw, fs, m); g.fillStyle = ov.fg || "#111"; g.shadowColor = "rgba(0,0,0,.25)"; g.shadowBlur = fs * .15; g.fillText(t, x + tw / 2, y + fs / 2); }
    else { const w = tw + fs * 1.4, h = fs * 1.7, [x, y] = place(w, h, m); g.shadowColor = "rgba(0,0,0,.22)"; g.shadowBlur = fs * .25; g.shadowOffsetY = fs * .08; g.fillStyle = ov.bg || "#16a34a"; if (st === "ribbon") { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - fs * .45, y + h / 2); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.lineTo(x + fs * .45, y + h / 2); g.closePath(); } else rrect(g, x, y, w, h, h / 2); g.fill(); g.shadowColor = "transparent"; g.fillStyle = ov.fg || "#fff"; g.fillText(t, x + w / 2, y + h / 2 + fs * .04); }
    g.restore();
  }
  /* المنتج بالتعديلات (سطوع/تباين/تشبّع/حرارة) ثم التدوير/القلب ← Canvas بحجم المنتج المعروض */
  function productCanvas(cut, bb, sc, o) {
    const pw = Math.max(1, Math.round(bb.w * sc)), ph = Math.max(1, Math.round(bb.h * sc)), pc = mk(pw, ph), g = pc.getContext("2d", { willReadFrequently: true }); g.imageSmoothingQuality = "high";
    const f = []; if (o.bri) f.push("brightness(" + (1 + o.bri / 100) + ")"); if (o.con) f.push("contrast(" + (1 + o.con / 100) + ")"); if (o.sat) f.push("saturate(" + (1 + o.sat / 100) + ")");
    if (f.length) { try { g.filter = f.join(" "); } catch (e) { } }
    g.drawImage(cut, bb.x, bb.y, bb.w, bb.h, 0, 0, pw, ph); g.filter = "none";
    if (o.tmp) { const im = g.getImageData(0, 0, pw, ph), d = im.data, k = o.tmp / 100 * .22; for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; d[i] = Math.max(0, Math.min(255, d[i] * (1 + k))); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * (1 - k))); } g.putImageData(im, 0, 0); }
    const rot = (o.rot || 0) * Math.PI / 180;
    if (!rot && !o.flip) return pc;
    const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)), rw = pw * cs + ph * sn, rh = pw * sn + ph * cs, rc = mk(rw, rh), r = rc.getContext("2d"); r.imageSmoothingQuality = "high";
    r.translate(rc.width / 2, rc.height / 2); r.rotate(rot); if (o.flip) r.scale(-1, 1); r.drawImage(pc, -pw / 2, -ph / 2); return rc;
  }
  /* يرسم المنتج على قماش بمقاس o.size ← Canvas. o: {size:[W,H], bg:{type,..}, scene, pad, align, shadow, podium, rot, flip, refl, outW, outC, bri, con, sat, tmp, ov[], logo, blurSrc, blur} */
  function compose(cut, bb, o) {
    const [W, H] = o.size, cv = mk(W, H); const g = cv.getContext("2d"); g.imageSmoothingQuality = "high";
    bb = bb || bbox(cut); const pad = Math.min(.4, Math.max(.02, o.pad == null ? .1 : o.pad)), scene = o.bg && o.bg.type === "scene", floor = scene ? (o.sceneFloor || .76) : o.podium ? .78 : null;
    drawBg(g, W, H, o.bg, o.scene, o);
    const rot = (o.rot || 0) * Math.PI / 180, cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)), rbw = bb.w * cs + bb.h * sn, rbh = bb.w * sn + bb.h * cs;
    const availW = W * (1 - 2 * pad) * (scene ? .62 : o.podium ? .8 : 1), availH = (floor === null ? H * (1 - 2 * pad) : H * floor - H * pad), sc = Math.min(availW / rbw, availH / rbh), pcv = productCanvas(cut, bb, sc, o), dw = pcv.width, dh = pcv.height, cx = W / 2;
    let dy; if (floor !== null) dy = H * floor - dh; else dy = o.align === "bottom" ? H * (1 - pad) - dh : (H - dh) / 2; const dx = cx - dw / 2, foot = dy + dh;
    if (o.podium && !scene) drawPodium(g, cx, foot, Math.max(dw * .72, W * .22), W, H, o.podiumColor);
    if (o.shadow === "contact" || o.shadow === "contactStrong") {
      const sI = (o.shI == null ? 100 : o.shI) / 100, sB = (o.shB == null ? 100 : o.shB) / 100, sX = (o.shX || 0) / 100 * dw, sY = (o.shY == null ? 100 : o.shY) / 100;
      const op = Math.min(1, (o.shadow === "contact" ? .34 : .55) * sI), rx = dw * .5 * (.6 + .4 * sB) * (o.shW == null ? 100 : o.shW) / 100, ry = Math.max(5, dw * .07 * sB * (o.shH == null ? 100 : o.shH) / 100); g.save(); g.translate(cx + sX, foot - ry * .25 + (sY - 1) * ry * .8); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, "rgba(0,0,0," + op + ")"); gr.addColorStop(.6, "rgba(0,0,0," + op * .45 + ")"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    if (o.refl > 0) {      /* انعكاس على الأرضية: نسخة مقلوبة تتلاشى */
      const rf = mk(dw, dh), r = rf.getContext("2d"); r.translate(0, dh); r.scale(1, -1); r.drawImage(pcv, 0, 0); r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = "destination-in";
      const gr = r.createLinearGradient(0, 0, 0, dh * .6); gr.addColorStop(0, "rgba(0,0,0," + Math.min(.9, o.refl / 100 * .9) + ")"); gr.addColorStop(1, "rgba(0,0,0,0)"); r.fillStyle = gr; r.fillRect(0, 0, dw, dh); g.drawImage(rf, dx, foot - dh * .02);
    }
    if (o.outW > 0) {      /* حدّ حول المنتج */
      const sil = mk(dw, dh), s = sil.getContext("2d"); s.drawImage(pcv, 0, 0); s.globalCompositeOperation = "source-in"; s.fillStyle = o.outC || "#fff"; s.fillRect(0, 0, dw, dh); const rr = Math.max(1, W * o.outW / 1000);
      for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; g.drawImage(sil, dx + Math.cos(t) * rr, dy + Math.sin(t) * rr); }
    }
    g.save(); if (o.shadow === "soft" || o.shadow === "strong") { const k = o.shadow === "soft" ? 1 : 1.9, sI = (o.shI == null ? 100 : o.shI) / 100, sB = (o.shB == null ? 100 : o.shB) / 100, sX = (o.shX || 0) / 100, sY = (o.shY == null ? 100 : o.shY) / 100; g.shadowColor = "rgba(0,0,0," + Math.min(1, .26 * Math.min(1.5, k) * sI) + ")"; g.shadowBlur = dw * .05 * k * sB; g.shadowOffsetY = dw * .03 * k * sY; g.shadowOffsetX = dw * .03 * k * sX * 3; }
    g.drawImage(pcv, dx, dy); g.restore();
    (o.ov || []).forEach(ov => drawBadge(g, W, H, ov, o));
    if (o.logo && o.logo.width) { const lw = W * (o.logoSize || 16) / 100, lh = lw * o.logo.height / o.logo.width, [lx, ly] = anchor(o.logoPos == null ? 8 : o.logoPos, W, H, lw, lh, W * .04); g.save(); g.globalAlpha = Math.max(.05, Math.min(1, (o.logoOp == null ? 90 : o.logoOp) / 100)); g.drawImage(o.logo, lx, ly, lw, lh); g.restore(); }
    return cv;
  }
  const sizeOf = (opt, srcC) => { if (opt.size === "custom") return [Math.max(100, Math.min(4000, Math.round(+opt.cw || 1000))), Math.max(100, Math.min(4000, Math.round(+opt.ch || 1000)))]; if (opt.size === "orig" && srcC) { const k = Math.min(1, 2000 / Math.max(srcC.width, srcC.height)); return [Math.round(srcC.width * k), Math.round(srcC.height * k)]; } const m = /^(\d+)x(\d+)$/.exec(opt.size); return m ? [+m[1], +m[2]] : [1000, 1000]; };
  const bgOf = opt => { if (opt.bg === "custom") { const m = opt.gm || "solid"; if (m === "solid") return { type: "color", c1: opt.c1 || "#ffffff" }; return { type: "grad", c1: opt.c1 || "#ffffff", c2: opt.c2 || "#cfe3ff", c3: m === "grad3" ? (opt.c3 || "#8fb4ff") : null, ang: opt.ga == null ? 135 : opt.ga }; } if (opt.bg === "blur") return { type: "blur" }; if (/^sc\d$/.test(opt.bg)) return { type: "scene" }; const f = BGS.find(b => b[0] === opt.bg); return f ? f[2] : BGS[0][2]; };

  /* ── الواجهة (لوحة «استوديو المنتج» داخل «تعديل الصورة») ── */
  const A = () => PBApp;

  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext("2d", { willReadFrequently: true }).drawImage(im, 0, 0, c.width, c.height); res(c); }; im.onerror = () => rej(new Error("تعذّر تحميل الصورة")); im.src = A().localize(String(src)); }); }
  async function sceneImg(id) { if (S.scenes[id]) return S.scenes[id]; const sc = SCENES.find(x => x.id === id); if (!sc) return null; const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("تعذّر تحميل المشهد")); i.src = (A().siteCtx && A().siteCtx().base || "") + sc.src; }); S.scenes[id] = im; return im; }
  /* خط الموقع من إعدادات «مظهر الموقع»، وتحميل الخطوط قبل الرسم على Canvas */
  async function loadSite() {
    if (S.site.loaded) return; S.site.loaded = true;
    try { const r = await fetch((typeof REL !== "undefined" ? REL : "") + "assets/data/theme.json", { cache: "no-store" }); if (r.ok) { const t = await r.json(); if (t.fontFamily) S.site.ff = String(t.fontFamily).split(",").slice(0, 2).join(","); if (t.fontUrl && !document.getElementById("pbst-sitefont")) { const l = document.createElement("link"); l.id = "pbst-sitefont"; l.rel = "stylesheet"; l.href = t.fontUrl; document.head.appendChild(l); } } } catch (e) { }
  }
  async function loadFonts(o) {
    if (!document.getElementById("pbfonts-a") && typeof PB !== "undefined" && PB.fontsHref) { const l = document.createElement("link"); l.id = "pbfonts-a"; l.rel = "stylesheet"; l.href = PB.fontsHref(PB.FONT_FAMS.map(x => x[0])); document.head.appendChild(l); }
    if (!(o.ov || []).length || !document.fonts) return; const set = new Set([fontCss(o.font, o.siteFf)]); (o.ov || []).forEach(v => set.add(fontCss(v.font || o.font, o.siteFf)));
    await Promise.all([...set].map(f => Promise.race([document.fonts.load("800 24px " + f, "أبجد Abc"), new Promise(r => setTimeout(r, 1500))]).catch(() => { })));
  }
  const FONTS = () => (typeof PB !== "undefined" && PB.FONT_FAMS ? PB.FONT_FAMS.filter(x => !x[3]) : []).map(([n, w, l]) => [n, l === n ? n : l + " (" + n + ")"]);
  const fontSel = (attr, v, first) => `<select ${attr}><option value="">${first}</option>${FONTS().map(([n, l]) => `<option value="${esc(n)}" ${v === n ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const css = () => {
    if (document.getElementById("pbst-css")) return; const st = document.createElement("style"); st.id = "pbst-css";
    st.textContent = `#pbst{display:flex;flex-direction:column;gap:.55rem;font-size:.78rem}#pbst .pbst-n{margin:0;opacity:.85;line-height:1.7}
#pbst .pbst-ms{padding:.45rem .6rem;font-weight:700;border-radius:10px;background:rgba(74,222,128,.14);border:1px solid rgba(74,222,128,.35);font-size:.74rem;line-height:1.6;display:none}#pbst .pbst-ms.on{display:block}
#pbst label.pbst-l{font-weight:800;opacity:.9;display:block;margin-bottom:.2rem}#pbst .pbst-sw button.pbst-pal{background:conic-gradient(#ff3b30,#ffcc00,#34c759,#00c7be,#007aff,#af52de,#ff3b30)}#pbst .pbst-all{margin:.4rem 0;border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:.35rem .5rem}#pbst .pbst-all summary{cursor:pointer;font-weight:800}#pbst .pbst-allb{display:flex;flex-direction:column;gap:.35rem;margin-top:.4rem}#pbst .pbst-list{max-height:160px;overflow:auto;display:flex;flex-direction:column;gap:.2rem;font-size:.8rem}#pbst .pbst-list label{display:flex;gap:.35rem;align-items:center}#pbst .pbst-cols{display:flex;gap:.3rem;margin-top:.3rem}#pbst .pbst-cols input{flex:1;height:34px;padding:0;border-radius:8px}#pbst .pbst-pv0{height:22px;border-radius:8px;margin-top:.4rem;border:1px solid rgba(128,128,128,.4)}#pbst .pbst-sw{display:flex;flex-wrap:wrap;gap:.3rem}
#pbst .pbst-sw button{width:34px;height:34px;border-radius:9px;border:2px solid rgba(128,128,128,.4);cursor:pointer;padding:0;font-size:.6rem;font-weight:800;color:#222;overflow:hidden;background-size:cover;background-position:center}#pbst .pbst-sw button.on{border-color:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,.45)}
#pbst select,#pbst input[type=range]{width:100%}#pbst .pbst-row{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}#pbst .pbst-act{display:flex;flex-wrap:wrap;gap:.4rem}#pbst .pbst-act button{flex:1 1 auto}
#pbst .pbst-lh{display:flex;align-items:center;gap:.35rem;justify-content:space-between}#pbst .pbst-lh>select{flex:1;min-width:0}#pbst .pbst-lh label.pbst-l{margin:0}
#pbst .pbst-rs{flex:none;width:26px;height:26px;padding:0;line-height:1;font-size:.95rem;font-weight:800;cursor:pointer;color:#fff;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 3px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.2);backdrop-filter:blur(6px);transition:transform .15s,background .15s}#pbst .pbst-rs:hover{transform:translateY(-2px);background:linear-gradient(180deg,rgba(251,146,60,.5),rgba(251,146,60,.18))}
#pbst .pbst-ck{display:flex;align-items:center;gap:.4rem;font-weight:700}
#pbst .pbst-tabs{display:flex;flex-wrap:wrap;gap:.3rem}#pbst .pbst-tabs button{flex:1 1 auto;padding:.4rem .5rem;border-radius:9px;font-weight:800;cursor:pointer}#pbst .pbst-tabs button.on{outline:2px solid #4ade80}
#pbst .pbst-pane{display:flex;flex-direction:column;gap:.55rem}#pbst .pbst-pane[hidden]{display:none}
#pbst .pbst-chips{display:flex;flex-wrap:wrap;gap:.3rem}#pbst .pbst-chips button{padding:.3rem .55rem;border-radius:999px;cursor:pointer;font-weight:700}
#pbst .pbst-ov{border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:.4rem;display:flex;flex-direction:column;gap:.3rem}#pbst .pbst-ov input[type=text]{width:100%}
#pbst .pbst-rg{display:grid;grid-template-columns:70px 1fr 38px 26px;gap:.3rem;align-items:center}#pbst .pbst-rg b{text-align:end;opacity:.8}`;
    document.head.appendChild(st);
  };
  const rb = (k, ov) => `<button type="button" class="pbst-rs" data-rs="${k}"${ov ? ' data-rsov="1"' : ""} title="إعادة للافتراضي" aria-label="إعادة للافتراضي">↺</button>`;
  const lh = (label, key) => `<div class="pbst-lh"><label class="pbst-l">${label}</label>${rb(key)}</div>`;
  const rg = (k, label, min, max, step, v) => `<div class="pbst-rg"><span>${label}</span><input type="range" data-stk="${k}" min="${min}" max="${max}" step="${step}" value="${v}"><b data-stv="${k}">${v}</b>${rb(k)}</div>`;
  const posSel = (attr, v) => `<select ${attr}>${POS.map((n, i) => `<option value="${i}" ${+v === i ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  function ovHtml() {
    return S.opt.ov.map((v, i) => `<div class="pbst-ov" data-ovi="${i}"><input type="text" data-ovk="t" value="${esc(v.t)}" placeholder="نص الملصق">
<div class="pbst-row"><div class="pbst-lh"><select data-ovk="st">${[["pill", "حبّة"], ["circle", "دائرة"], ["ribbon", "شريط"], ["plain", "نص فقط"], ["title", "عنوان عريض"]].map(([k, n]) => `<option value="${k}" ${v.st === k ? "selected" : ""}>${n}</option>`).join("")}</select>${rb("st", 1)}</div></div>
<div class="pbst-lh">${fontSel('data-ovk="font"', v.font || "", "حسب الخط العام")}${rb("font", 1)}</div>
<div class="pbst-row"><label class="pbst-lh">الخلفية <input type="color" data-ovk="bg" value="${esc(v.bg || "#16a34a")}">${rb("bg", 1)}</label><label class="pbst-lh">النص <input type="color" data-ovk="fg" value="${esc(v.fg || "#ffffff")}">${rb("fg", 1)}</label></div>
<div class="pbst-n" style="margin:0">الموضع والحجم: اسحب العنصر على الصورة أو اسحب مقبضه الأخضر في الزاوية.</div>
<button type="button" class="pbx-small" data-st="ovdel" data-i="${i}" style="background:rgba(239,68,68,.28);color:#fff;border:1px solid rgba(248,113,113,.6)">🗑 حذف الملصق</button></div>`).join("");
  }
  function panel() {
    css(); const o = S.opt;
    const swc = c => /^#f{3,6}$/i.test(c) ? "#fdfdfd" : c;
    const sw = BGS.map(([k, n, b]) => `<button type="button" data-st-bg="${k}" class="${o.bg === k ? "on" : ""}" title="${esc(n)}" style="${b.type === "grad" ? `background:linear-gradient(135deg,${b.c1},${b.c2})` : b.type === "color" ? `background:${swc(b.c1)}` : "background:repeating-conic-gradient(#cfcfcf 0 25%,#fff 0 50%) 50%/10px 10px"}"></button>`).join("")
      + SCENES.map(sc => `<button type="button" data-st-bg="${sc.id}" class="${o.bg === sc.id ? "on" : ""}" title="مشهد طبيعي" style="background-image:url('${esc(sc.src)}')"></button>`).join("")
      + `<button type="button" data-st-bg="blur" class="${o.bg === "blur" ? "on" : ""}" title="طمس خلفية الصورة الأصلية" style="background:linear-gradient(135deg,#9ca3af,#e5e7eb);font-size:.55rem">طمس</button>`
      + `<button type="button" data-st-bg="custom" class="pbst-pal ${o.bg === "custom" ? "on" : ""}" title="ألوان مخصصة (لون أو تدرّج)" aria-label="ألوان مخصصة"></button>`;
    const tab = (k, n) => `<button type="button" data-st-tab="${k}" class="pbx-small ${S.tab === k ? "on" : ""}">${n}</button>`, pane = k => `class="pbst-pane" data-stp="${k}" ${S.tab === k ? "" : "hidden"}`;
    return `<div id="pbst"><p class="pbst-n">حوّل صورة منتجك إلى صورة متجر أو إعلان: تُنزع الخلفية داخل متصفحك ثم تختار الخلفية والظل والملصقات والمقاس. تظهر التعديلات مباشرة على الصورة في الصفحة، وتحتها «تطبيق» أو «إلغاء».</p>
<div class="pbst-ms" id="pbst-ms"></div>
<div class="pbst-act"><button type="button" class="pbx-small pz-go" data-st="cut" id="pbst-cut">① انزع الخلفية</button></div>
<div class="pbst-act"><button type="button" class="pbx-small" data-st="dl">تنزيل</button><button type="button" class="pbx-small" data-st="reset" title="يعيد خيارات الاستوديو (الخلفية والظل والمقاس…) إلى قيمها الأولى ولا يمسّ الصورة">إعادة ضبط الخيارات</button><button type="button" class="pbx-small pbst-rv" id="pbst-rv" data-st="revert" style="display:none">↩ استرجاع الصورة الأصلية</button></div>
${allBlock()}
<div class="pbst-tabs">${tab("bg", "🎨 الخلفية")}${tab("prod", "📦 المنتج")}${tab("fx", "✨ تأثيرات")}${tab("txt", "🏷️ ملصقات وشعار")}${tab("out", "📐 المقاس والإخراج")}</div>
<div ${pane("bg")}><div>${lh("الخلفية", "bg")}<div class="pbst-sw">${sw}</div><div id="pbst-cp" style="display:${o.bg === "custom" ? "block" : "none"}"><div class="pbst-row"><select id="pbst-gm"><option value="solid"${o.gm === "solid" ? " selected" : ""}>لون واحد</option><option value="grad2"${o.gm === "grad2" ? " selected" : ""}>تدرّج بلونين</option><option value="grad3"${o.gm === "grad3" ? " selected" : ""}>تدرّج بثلاثة ألوان</option></select>${typeof EyeDropper !== "undefined" ? '<button type="button" class="pbx-small" id="pbst-eye">💧 قطّارة</button>' : "<span></span>"}</div><div class="pbst-cols"><input type="color" id="pbst-c1" value="${esc(o.c1 || "#ffffff")}"><input type="color" id="pbst-c2" value="${esc(o.c2 || "#cfe3ff")}" style="display:${o.gm === "solid" ? "none" : ""}"><input type="color" id="pbst-c3" value="${esc(o.c3 || "#8fb4ff")}" style="display:${o.gm === "grad3" ? "" : "none"}"></div><div id="pbst-ga" style="display:${o.gm === "solid" ? "none" : ""}">${rg("ga", "اتجاه التدرّج (°)", 0, 360, 5, o.ga == null ? 135 : o.ga)}</div><div id="pbst-prev" class="pbst-pv0"></div></div></div></div>
<div ${pane("prod")}><div class="pbst-row"><div>${lh("نوع الظل", "shadow")}<select id="pbst-sh"><option value="contact">تحت المنتج — دائرة (بيضاوي) بإعداداتها</option><option value="soft">خلف المنتج</option><option value="none">بدون ظل</option></select></div>
<div>${lh("الموضع", "align")}<select id="pbst-al"><option value="center">في الوسط</option><option value="bottom">على الأرض</option></select></div></div>
<div class="pbst-sub" style="margin:.35rem 0 .1rem;font-size:.74rem;opacity:.8">ضبط الظل (شدة، نعومة، اتجاه)</div>${rg("shI", "شدة الظل %", 0, 200, 5, o.shI == null ? 100 : o.shI)}${rg("shB", "نعومة الظل %", 20, 300, 5, o.shB == null ? 100 : o.shB)}<div id="pbst-shc" style="display:${/^contact/.test(o.shadow) ? "block" : "none"}">${rg("shW", "عرض الدائرة %", 30, 200, 5, o.shW == null ? 100 : o.shW)}${rg("shH", "ارتفاع الدائرة %", 30, 300, 5, o.shH == null ? 100 : o.shH)}</div>${rg("shX", "إزاحة أفقية", -100, 100, 5, o.shX || 0)}${rg("shY", "إزاحة رأسية %", 0, 250, 5, o.shY == null ? 100 : o.shY)}<div class="pbst-sub" style="margin:.5rem 0 .1rem;font-size:.74rem;opacity:.8">انعكاس الأرضية (صفر = بلا انعكاس)</div>${rg("refl", "شفافية انعكاس المنتج %", 0, 100, 1, o.refl || 0)}
<div><div class="pbst-lh"><label class="pbst-l">حجم المنتج <span id="pbst-pv-n"></span></label>${rb("pad")}</div><input type="range" id="pbst-pad" min="2" max="35" step="1" value="${Math.round((1 - o.pad * 2) * 100) ? Math.round(o.pad * 100) : 10}"></div>
<div class="pbst-lh"><label class="pbst-ck"><input type="checkbox" id="pbst-pod" ${o.podium ? "checked" : ""}> منصة عرض تحت المنتج</label>${rb("podium")}</div>
${rg("rot", "تدوير", -180, 180, 1, o.rot)}<div class="pbst-lh"><label class="pbst-ck"><input type="checkbox" data-stk="flip" ${o.flip ? "checked" : ""}> قلب أفقي</label>${rb("flip")}</div></div>
<div ${pane("fx")}>${rg("bri", "السطوع", -50, 50, 1, o.bri)}${rg("con", "التباين", -50, 50, 1, o.con)}${rg("sat", "التشبّع", -80, 80, 1, o.sat)}${rg("tmp", "الحرارة", -50, 50, 1, o.tmp)}
${rg("outW", "حدّ المنتج", 0, 20, 1, o.outW)}<div class="pbst-lh"><label class="pbst-l">لون الحدّ <input type="color" data-stk="outC" value="${esc(o.outC || "#ffffff")}"></label>${rb("outC")}</div>
<div class="pbst-act"><button type="button" class="pbx-small" data-st="fxreset">إعادة ضبط التأثيرات</button></div></div>
<div ${pane("txt")}>${lh("خط الملصقات", "font")}${fontSel('data-stk="font"', o.font, "خط الموقع (الافتراضي)")}<label class="pbst-l">ملصقات البيع (اضغط للإضافة)</label><div class="pbst-chips">${BADGES.map((b, i) => `<button type="button" class="pbx-small" data-st="addov" data-i="${i}">${esc(b[0])}</button>`).join("")}<button type="button" class="pbx-small" data-st="addov" data-i="-1">＋ نص مخصص</button></div><label class="pbst-l">عناوين عريضة (اضغط للإضافة — {name} اسم المنتج و{price} سعره)</label><div class="pbst-chips">${TITLES.map((b, i) => `<button type="button" class="pbx-small" data-st="addttl" data-i="${i}">${esc(b[0])}</button>`).join("")}</div>
<div id="pbst-ovs">${ovHtml()}</div>
<label class="pbst-l">شعار (اختياري)</label><input type="file" id="pbst-logo" accept="image/*"><div class="pbst-row"><div class="pbst-lh">${posSel('data-stk="logoPos"', o.logoPos)}${rb("logoPos")}</div><button type="button" class="pbx-small" data-st="logodel">إزالة الشعار</button></div>${rg("logoSize", "حجم الشعار", 5, 50, 1, o.logoSize)}${rg("logoOp", "الشفافية", 10, 100, 1, o.logoOp)}</div>
<div ${pane("out")}><div>${lh("المقاس", "size")}<select id="pbst-sz">${SIZES.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("")}</select></div>
<div class="pbst-row" id="pbst-cs" style="display:${o.size === "custom" ? "grid" : "none"}"><label>العرض <input type="number" data-stk="cw" min="100" max="4000" value="${o.cw}" style="width:100%"></label><label>الارتفاع <input type="number" data-stk="ch" min="100" max="4000" value="${o.ch}" style="width:100%"></label></div>
<div class="pbst-row"><div>${lh("صيغة التنزيل", "fmt")}<select data-stk="fmt">${[["png", "PNG (شفافية)"], ["webp", "WebP (أخف)"], ["jpeg", "JPEG"]].map(([k, n]) => `<option value="${k}" ${o.fmt === k ? "selected" : ""}>${n}</option>`).join("")}</select></div><div>${rg("q", "الجودة", 50, 100, 1, o.q)}</div></div></div></div>`;
  }
  let drawT = 0;
  S.allOff = S.allOff || {};
  const allProds = () => ((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && p.cover);
  const selSlugs = () => allProds().map(p => p.slug).filter(x => !S.allOff[x]);
  const allBlock = () => { const L = allProds(), n = L.filter(p => !S.allOff[p.slug]).length; return `<details class="pbst-all" id="pbst-all"><summary>🗂 تطبيق على المنتجات (<span id="pbst-alln">${n}</span> من ${L.length})</summary><div class="pbst-allb"><div class="pbst-act"><button type="button" class="pbx-small" data-st="allon">تحديد الكل</button><button type="button" class="pbx-small" data-st="alloff">إلغاء الكل</button></div><div class="pbst-list">${L.map(p => `<label><input type="checkbox" data-allp="${esc(p.slug)}"${S.allOff[p.slug] ? "" : " checked"}> ${esc(p.title || p.slug)}</label>`).join("") || "<span class='ep-n'>لا منتجات بغلاف</span>"}</div><button type="button" class="pbx-small pz-go" data-st="applyall"${L.length ? "" : " disabled"}>تطبيق نمط الاستوديو على المحدّد</button><div id="pbst-allst" class="ep-n" style="min-height:1.2em">يُطبَّق نمط الاستوديو الحالي (الخلفية والظل والمقاس والملصقات والعناوين والشعار) على أغلفة المنتجات المحدّدة؛ الأصلية تبقى ضمن صور المنتج.</div></div></details>`; };
  const optsFor = (W, H) => Object.assign({}, S.opt, { bg: bgOf(S.opt), size: [W, H], scene: null, sceneFloor: SCENES[0].floor, logo: S.logo, blurSrc: S.srcC, siteFf: S.site.ff });
  /* معاينة مباشرة على الصورة في الصفحة (بعد نزع الخلفية): تُركَّب بالمقاس المختار وتُعرض مكان الصورة؛ «تطبيق/إلغاء» تحتها */
  /* تحريك العناوين والملصقات بالماوس مباشرة على صورة المنتج: مقابض شفافة فوق كل عنصر (من الصندوق ov._b) تُسحب فيتغيّر موضعه (fx/fy) وتُعاد المعاينة */
  let hitEl = null;
  function hitsOff() { if (hitEl) { hitEl.remove(); hitEl = null; } }
  function hits() {
    if (S.dragging) return; const ovs = (S.opt && S.opt.ov) || [], R = S.pv && A().imgRect ? A().imgRect(S.pv) : null; if (!R || !document.getElementById("pbst") || !ovs.some(v => v._b)) return hitsOff();
    if (!hitEl) { hitEl = document.createElement("div"); hitEl.id = "pbst-hits"; hitEl.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:10046;pointer-events:none"; document.body.appendChild(hitEl); }
    hitEl.innerHTML = ovs.map((v, i) => v._b ? `<div class="pbst-hit" data-hi="${i}" title="اسحب لتحريك ${v.st === "title" ? "العنوان" : "الملصق"}" style="position:fixed;left:${R.left + v._b[0] * R.width}px;top:${R.top + v._b[1] * R.height}px;width:${v._b[2] * R.width}px;height:${v._b[3] * R.height}px;pointer-events:auto;cursor:${v.st === "title" ? "ns-resize" : "move"};border:${S.selOv === i ? "2.5px solid" : "1.5px dashed"} rgba(198,254,23,${S.selOv === i ? 1 : .85});border-radius:6px;touch-action:none"><i class="pbst-rz" title="اسحب لتكبير أو تصغير ${v.st === "title" ? "العنوان" : "الملصق"}" style="position:absolute;right:-8px;bottom:-8px;width:16px;height:16px;border-radius:50%;background:rgba(198,254,23,.9);border:2px solid rgba(255,255,255,.9);box-shadow:0 1px 5px rgba(0,0,0,.45);cursor:nwse-resize;touch-action:none"></i></div>` : "").join("");
  }
  if (typeof document !== "undefined" && !document.__pbstHit) {
    document.__pbstHit = 1;
    /* حذف الملصق/العنوان المحدَّد على الصورة بمفتاح Delete أو Backspace (لا يعمل أثناء الكتابة في حقل) */
    document.addEventListener("keydown", e => {
      if ((e.key !== "Delete" && e.key !== "Backspace") || S.selOv == null || !S.opt || !S.opt.ov || !document.getElementById("pbst")) return;
      const t = e.target, tag = t && t.tagName; if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (!S.opt.ov[S.selOv]) { S.selOv = null; return; }
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); S.opt.ov.splice(S.selOv, 1); S.selOv = null; save(); A().renderInspectorNow(); redraw(); setTimeout(hits, 100);
    }, true);
    document.addEventListener("pointerdown", e => {
      const h = e.target.closest && e.target.closest(".pbst-hit"); if (!h) return; const i = +h.dataset.hi, ov = S.opt.ov[i], R = A().imgRect && A().imgRect(S.pv); if (!ov || !ov._b || !R) return; e.preventDefault(); e.stopPropagation(); S.dragging = true; try { h.setPointerCapture(e.pointerId); } catch (x) { }
      S.selOv = i; try { const ae = document.activeElement; if (ae && ae !== document.body && ae.blur && !(ae.isContentEditable)) ae.blur(); } catch (x) { }
      document.querySelectorAll(".pbst-hit").forEach(q => { const on = +q.dataset.hi === i; q.style.borderStyle = on ? "solid" : "dashed"; q.style.borderWidth = on ? "2.5px" : "1.5px"; });
      if (e.target.classList && e.target.classList.contains("pbst-rz")) {      /* تحجيم: نسبة بُعد المؤشر عن مركز العنصر إلى بُعده الأول؛ يُكتب في ov.s */
        const b0 = ov._b, ccx = R.left + (b0[0] + b0[2] / 2) * R.width, ccy = R.top + (b0[1] + b0[3] / 2) * R.height, d0 = Math.max(8, Math.hypot(e.clientX - ccx, e.clientY - ccy)), s0 = ov.s || 8, title0 = ov.st === "title"; let busy0 = false;
        const mv2 = ev => { const f = Math.max(.25, Math.min(5, Math.hypot(ev.clientX - ccx, ev.clientY - ccy) / d0)); ov.s = Math.round(Math.max(2, Math.min(40, s0 * f)) * 10) / 10; const k = ov.s / s0, nw = title0 ? b0[2] : b0[2] * k, nh = b0[3] * k;
          h.style.left = (R.left + (b0[0] + b0[2] / 2 - nw / 2) * R.width) + "px"; h.style.top = (R.top + (b0[1] + b0[3] / 2 - nh / 2) * R.height) + "px"; h.style.width = nw * R.width + "px"; h.style.height = nh * R.height + "px"; if (!busy0) { busy0 = true; setTimeout(() => { busy0 = false; redraw(); }, 60); } };
        const up2 = () => { S.dragging = false; h.removeEventListener("pointermove", mv2); h.removeEventListener("pointerup", up2); h.removeEventListener("pointercancel", up2); save(); redraw(); setTimeout(hits, 400); };
        h.addEventListener("pointermove", mv2); h.addEventListener("pointerup", up2); h.addEventListener("pointercancel", up2); return;
      }
      const b = ov._b, cx0 = b[0] + b[2] / 2, cy0 = b[1] + b[3] / 2, x0 = e.clientX, y0 = e.clientY, title = ov.st === "title"; let busy = false;
      const mv = ev => { const nx = Math.max(0, Math.min(1, cx0 + (ev.clientX - x0) / R.width)), ny = Math.max(0, Math.min(1, cy0 + (ev.clientY - y0) / R.height)); if (!title) ov.fx = Math.round(nx * 1000) / 1000; ov.fy = Math.round(ny * 1000) / 1000; if (ov.fx == null) ov.fx = .5;
        h.style.left = (R.left + (title ? b[0] : nx - b[2] / 2) * R.width) + "px"; h.style.top = (R.top + (ny - b[3] / 2) * R.height) + "px"; if (!busy) { busy = true; setTimeout(() => { busy = false; redraw(); }, 60); } };
      const up = () => { S.dragging = false; h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); save(); redraw(); setTimeout(hits, 400); };
      h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    }, true);
    window.addEventListener("resize", () => setTimeout(hits, 100));
  }
  async function draw() {
    if (!document.getElementById("pbst")) return; const tok = ++S.dtok;
    const base = S.cut || S.srcC; if (!base) { if (S.pv) { S.pv = ""; A().stRestore(); } hitsOff(); return; }      // قبل نزع الخلفية: تُعرض التعديلات على الصورة كما هي
    const bbx = S.cut ? S.bb : (S.bbSrc || (S.bbSrc = bbox(S.srcC)));
    const [W, H] = sizeOf(S.opt, S.srcC), k = Math.min(1, 900 / Math.max(W, H)), PW = Math.max(1, Math.round(W * k)), PH = Math.max(1, Math.round(H * k)), o = optsFor(PW, PH);
    if (/^sc\d$/.test(S.opt.bg)) { try { o.scene = await sceneImg(S.opt.bg); } catch (e) { } }
    await loadSite(); o.siteFf = S.site.ff; await loadFonts(o); if (tok !== S.dtok) return;
    const out = compose(base, bbx, o), bl = await toBlob(out, "image/png"); if (tok !== S.dtok || S.off || !document.getElementById("pbst")) return;
    const url = URL.createObjectURL(bl), prev = S.pvUrl; S.pvUrl = url;
    if (A().stPreview(S.id, url)) { S.pv = S.id; A().epFloatNow(); setTimeout(hits, 80); setTimeout(hits, 500); say("👁️ معاينة مباشرة على الصورة — " + W + "×" + H + (S.cut ? "" : " — اضغط «انزع الخلفية» لتظهر الخلفية الجديدة")); }
    if (prev) setTimeout(() => { try { URL.revokeObjectURL(prev); } catch (e) { } }, 2000);
  }
  function cancel() { S.dtok++; S.off = true; const had = S.pv; S.pv = ""; if (S.pvUrl) { const u = S.pvUrl; S.pvUrl = ""; setTimeout(() => { try { URL.revokeObjectURL(u); } catch (e) { } }, 2000); } say(""); if (had) A().stRestore(); }
  const redraw = () => { S.off = false; clearTimeout(drawT); drawT = setTimeout(draw, 120); };
  function say(t) { S.msg = t; const m = document.getElementById("pbst-ms"); if (m) { m.textContent = t; m.classList.toggle("on", !!t); } }
  /* مصدر معتم (بلا شفافية) ← الظل الافتراضي «بدون» ما لم يختر المستخدم غيره */
  function autoShadow() { if (!S.srcC || S.cut || S.shUser || S.opt.shadow !== DEF.shadow) return; S.opt.shadow = "none"; S.shAuto = true; const sh = document.getElementById("pbst-sh"), sc = document.getElementById("pbst-shc"); if (sh) sh.value = "none"; if (sc) sc.style.display = "none"; }
  async function ensureSrc(inf) { if (!S.srcC) { say("⏳ جارِ تحميل الصورة…"); S.srcC = await loadImg(inf.node.set.src); } if (!S.cut && hasAlpha(S.srcC)) { S.cut = S.srcC; S.bb = bbox(S.cut); } else autoShadow(); say(""); }      // بلا نزع خلفية: كما في المعاينة
  async function ensureCut(inf) {
    if (S.cut) return true;
    say("⏳ جارِ تحميل الصورة…"); S.srcC = S.srcC || await loadImg(inf.node.set.src);
    if (hasAlpha(S.srcC)) { S.cut = S.srcC; S.bb = bbox(S.cut); say(""); return true; }
    say("⏳ جارِ نزع الخلفية داخل متصفحك…");
    const r = await PBBgRemove.autoCut(S.srcC, { onStep: m => say(m) }); S.cut = r.canvas; S.bb = bbox(S.cut); if (S.shAuto && !S.shUser) { S.opt.shadow = DEF.shadow; S.shAuto = false; const sh = document.getElementById("pbst-sh"), sc = document.getElementById("pbst-shc"); if (sh) sh.value = "contact"; if (sc) sc.style.display = "block"; } say(""); return true;
  }
  async function render() {
    const [W, H] = sizeOf(S.opt, S.srcC), o = optsFor(W, H);
    if (/^sc\d$/.test(S.opt.bg)) o.scene = await sceneImg(S.opt.bg); await loadSite(); o.siteFf = S.site.ff; await loadFonts(o); return compose(S.cut || S.srcC, S.cut ? S.bb : (S.bbSrc || (S.bbSrc = bbox(S.srcC))), o);
  }
  const MIME = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" }, toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || "image/png", q));
  async function applyCore(inf) {
    const id = inf.node.id; await ensureSrc(inf); say("⏳ جارِ تجهيز الصورة…"); const c = await render(), bl = await toBlob(c); say("⏳ جارِ رفع الصورة…");
    const path = await A().uploadBlob(bl, "studio-" + Date.now().toString(36), { max: 2600, q: .92 }), q = A().find(id); if (!q) throw new Error("لم يعد العنصر موجوداً");
    if (S.origId !== id || !S.origSrc) { S.origId = id; S.origSrc = q.node.set.src; S.origCrop = q.node.set.crop; S.origHauto = q.node.set.hauto; }
    S.dtok++; S.pv = ""; S.off = true; S.id = id; S.src = path; clearTimeout(drawT); hitsOff(); if (S.pvUrl) { const u = S.pvUrl; S.pvUrl = ""; setTimeout(() => { try { URL.revokeObjectURL(u); } catch (e) { } }, 2000); }      // الأصل (S.srcC/S.cut) يبقى: أي تعديل لاحق يُركَّب من المنتج الأصلي لا من الصورة الناتجة
    q.node.set.src = path; delete q.node.set.crop; q.node.set.hauto = true; A().E.nextLabel = "استوديو المنتج"; A().E.sel = id; A().renderCanvas(); A().commitAfter(id); S.off = true; S.pv = ""; try { A().epFloatNow(); } catch (e) { } say("✅ طُبِّقت على الصورة (Ctrl+Z للتراجع)"); try { const rv = document.getElementById("pbst-rv"); if (rv) rv.style.display = ""; } catch (e) { }
  }
  async function revertOrig(inf) {
    const id = inf.node.id; if (!S.origSrc || S.origId !== id) return; const q = A().find(id); if (!q) return;
    q.node.set.src = S.origSrc; if (S.origCrop) q.node.set.crop = S.origCrop; else delete q.node.set.crop; if (S.origHauto === undefined) delete q.node.set.hauto; else q.node.set.hauto = S.origHauto;
    S.dtok++; S.pv = ""; clearTimeout(drawT); hitsOff(); try { cancel(); } catch (e) { }
    S.src = S.origSrc; S.srcC = null; S.cut = null; S.bb = null; S.bbSrc = null; S.origSrc = ""; S.origId = ""; S.off = true; S.msg = "↩ عادت الصورة الأصلية";
    A().E.nextLabel = "استوديو المنتج — العودة للأصل"; A().E.sel = id; A().renderCanvas(); A().commitAfter(id); try { A().epFloatNow(); } catch (e) { } try { A().renderInspectorNow(); } catch (e) { }
  }
  async function applyExt(inf) { if (S.busy) return; S.busy = true; try { await applyCore(inf); } catch (e) { say("⚠️ " + (e && e.message || e)); console.error(e); } S.busy = false; }
  function mount(root, inf) {
    if (!root) return; css(); const id = inf.node.id, src = inf.node.set.src;
    if (S.id !== id || S.src !== src) { S.id = id; S.src = src; S.cut = null; S.bb = null; S.bbSrc = null; S.srcC = null; S.msg = ""; S.off = false; S.pv = ""; S.shUser = false; if (S.shAuto) { S.opt.shadow = DEF.shadow; S.shAuto = false; } }
    const $ = i => root.querySelector("#" + i), o = S.opt;
    $("pbst-sh").value = /^contact/.test(o.shadow) ? "contact" : (o.shadow === "soft" || o.shadow === "strong") ? "soft" : "none"; $("pbst-al").value = o.align; $("pbst-sz").value = o.size; $("pbst-pv-n").textContent = Math.round((1 - o.pad * 2) * 100) + "%";
    const sync = () => { $("pbst-cut").style.display = S.cut ? "none" : ""; const rv = $("pbst-rv"); if (rv) rv.style.display = S.origSrc && S.origId === id ? "" : "none"; };
    sync(); say(S.msg);
    const run = async fn => { if (S.busy) return; S.busy = true; try { await fn(); } catch (e) { say("⚠️ " + (e && e.message || e)); console.error(e); } S.busy = false; sync(); };
    if (!S.srcC) run(async () => { say("⏳ جارِ تحميل الصورة…"); S.srcC = await loadImg(src); if (hasAlpha(S.srcC)) { S.cut = S.srcC; S.bb = bbox(S.cut); } else autoShadow(); say(""); }).then(() => { if (!S.off) redraw(); sync(); }); else if (!S.off) redraw();
    const redrawPanel = () => { const bx = $("pbst-ovs"); if (bx) bx.innerHTML = ovHtml(); };
    root.addEventListener("change", e => { const c = e.target.closest("[data-allp]"); if (!c) return; if (c.checked) delete S.allOff[c.dataset.allp]; else S.allOff[c.dataset.allp] = 1; const nn = $("pbst-alln"); if (nn) nn.textContent = selSlugs().length; });
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-st-tab]"); if (t) { S.tab = t.dataset.stTab; root.querySelectorAll("[data-st-tab]").forEach(x => x.classList.toggle("on", x === t)); root.querySelectorAll("[data-stp]").forEach(x => { x.hidden = x.dataset.stp !== S.tab; }); return; }
      const b = e.target.closest("[data-st-bg]"); if (b) { o.bg = b.dataset.stBg; $("pbst-cp").style.display = o.bg === "custom" ? "block" : "none"; palPrev(); $("pbst-blurbox").style.display = o.bg === "blur" ? "block" : "none"; root.querySelectorAll("[data-st-bg]").forEach(x => x.classList.toggle("on", x === b)); save(); redraw(); return; }
      const rs = e.target.closest("[data-rs]");
      if (rs) {
        const k = rs.dataset.rs;
        if (rs.dataset.rsov) { const box = rs.closest("[data-ovi]"), ov = box && o.ov[+box.dataset.ovi]; if (!ov) return; const d = ov.d || { bg: "#16a34a", fg: "#ffffff", st: "pill", font: "" }; ov[k] = d[k]; save(); redrawPanel(); redraw(); return; }
        (RSG[k] || [k]).forEach(x => { o[x] = DEF[x]; }); save();
        const keep = []; for (let n = root; n; n = n.parentNode) if (n.scrollTop > 0) keep.push([n, n.scrollTop]);
        A().renderInspectorNow(); const ap = () => { const r2 = document.getElementById("pbst"); for (let n = r2; n; n = n.parentNode) { const m = keep.find(x => x[0].id && n.id && x[0].id === n.id); if (m) n.scrollTop = m[1]; } keep.forEach(([n, t]) => { if (n.isConnected) n.scrollTop = t; }); }; ap(); setTimeout(ap, 60); S.off = false; redraw(); return;
      }
      const a = e.target.closest("[data-st]"); if (!a) return; const act = a.dataset.st;
      if (act === "cut") run(async () => { await ensureCut(inf); }).then(() => { S.off = false; redraw(); });
      else if (act === "allon" || act === "alloff") { S.allOff = {}; if (act === "alloff") allProds().forEach(p => { S.allOff[p.slug] = 1; }); root.querySelectorAll("[data-allp]").forEach(c => { c.checked = act === "allon"; }); const nn = $("pbst-alln"); if (nn) nn.textContent = selSlugs().length; }
      else if (act === "reset") { S.opt = Object.assign({}, DEF, { ov: [] }); S.logo = null; S.selOv = null; save(); A().renderInspectorNow(); }
      else if (act === "fxreset") { Object.assign(o, { bri: 0, con: 0, sat: 0, tmp: 0, refl: 0, outW: 0, rot: 0, flip: false }); save(); A().renderInspectorNow(); }
      else if (act === "addttl") { const bd = TITLES[+a.dataset.i]; if (!bd || o.ov.length >= 6) return; o.ov.push({ t: bd[0], bg: bd[1], fg: bd[2], st: "title", pos: o.ov.some(v => v.st === "title" && v.pos === 2) ? 8 : 2, s: 5, d: { bg: bd[1], fg: bd[2], st: "title", font: "" } }); save(); redrawPanel(); redraw(); }
      else if (act === "applyall") { if (typeof AdminImgQA === "undefined" || !AdminImgQA.applyAll) { alert("الأداة غير متاحة من هذه الصفحة"); return; } AdminImgQA.applyAll({ slugs: selSlugs(), onStep: m => { const e = document.getElementById("pbst-allst"); if (e) e.textContent = m; } }); }
      else if (act === "addov") { const i = +a.dataset.i, bd = BADGES[i] || ["نص", "#16a34a", "#ffffff", "pill"]; if (o.ov.length >= 6) return; o.ov.push({ t: bd[0], bg: bd[1], fg: bd[2], st: bd[3], pos: [2, 0, 8, 6][o.ov.length % 4], s: bd[3] === "circle" ? 7 : 6, d: { bg: bd[1], fg: bd[2], st: bd[3], font: "" } }); save(); redrawPanel(); redraw(); }
      else if (act === "ovdel") { o.ov.splice(+a.dataset.i, 1); S.selOv = null; save(); redrawPanel(); redraw(); }
      else if (act === "logodel") { S.logo = null; const f = $("pbst-logo"); if (f) f.value = ""; redraw(); }
      else if (act === "dl") run(async () => { await ensureSrc(inf); const c = await render(), fmt = o.fmt || "png", bl = await toBlob(c, MIME[fmt], fmt === "png" ? undefined : (o.q || 92) / 100); const u = URL.createObjectURL(bl), l = document.createElement("a"); l.href = u; l.download = "product-studio." + (fmt === "jpeg" ? "jpg" : fmt); document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); say("✅ نُزّلت الصورة"); setTimeout(() => say(""), 2500); });
      else if (act === "apply") run(() => applyCore(inf));
      else if (act === "revert") run(() => revertOrig(inf));
    });
    const palPrev = () => { const pv = $("pbst-prev"), b = bgOf(o); if (pv) pv.style.background = b.type === "grad" ? `linear-gradient(${b.ang == null ? 135 : b.ang}deg,${b.c1},${b.c3 ? b.c2 + "," + b.c3 : b.c2})` : (b.c1 || "#fff"); const pb = root.querySelector(".pbst-pal"); if (pb) pb.classList.toggle("on", o.bg === "custom"); };
    const palSet = () => { o.bg = "custom"; root.querySelectorAll("[data-st-bg]").forEach(x => x.classList.toggle("on", x.dataset.stBg === "custom")); palPrev(); save(); redraw(); };
    [["pbst-c1", "c1"], ["pbst-c2", "c2"], ["pbst-c3", "c3"]].forEach(([id, k]) => $(id).addEventListener("input", e => { o[k] = e.target.value; palSet(); }));
    $("pbst-gm").addEventListener("change", e => { o.gm = e.target.value; $("pbst-c2").style.display = o.gm === "solid" ? "none" : ""; $("pbst-c3").style.display = o.gm === "grad3" ? "" : "none"; $("pbst-ga").style.display = o.gm === "solid" ? "none" : ""; palSet(); });
    const eye = $("pbst-eye"); if (eye) eye.addEventListener("click", async () => { try { const r = await new EyeDropper().open(); o.c1 = r.sRGBHex; $("pbst-c1").value = o.c1; palSet(); } catch (e) { } });
    palPrev();
    $("pbst-sh").addEventListener("change", e => { o.shadow = e.target.value; S.shUser = true; const sc = $("pbst-shc"); if (sc) sc.style.display = o.shadow === "contact" ? "block" : "none"; save(); redraw(); });
    $("pbst-al").addEventListener("change", e => { o.align = e.target.value; save(); redraw(); });
    $("pbst-sz").addEventListener("change", e => { o.size = e.target.value; const cs = $("pbst-cs"); if (cs) cs.style.display = o.size === "custom" ? "grid" : "none"; save(); redraw(); });
    $("pbst-pod").addEventListener("change", e => { o.podium = e.target.checked; save(); redraw(); });
    $("pbst-pad").addEventListener("input", e => { o.pad = +(Number(e.target.value) / 100).toFixed(3); $("pbst-pv-n").textContent = Math.round((1 - o.pad * 2) * 100) + "%"; save(); redraw(); });
    /* حقول عامة: data-stk (خيارات المعاينة) و data-ovk (ملصق) */
    root.addEventListener("input", e => {
      const el = e.target; if (el.dataset.stk) { const k = el.dataset.stk; o[k] = el.type === "checkbox" ? el.checked : el.type === "range" || el.type === "number" || k === "logoPos" ? Number(el.value) : el.value; const v = root.querySelector('[data-stv="' + k + '"]'); if (v) v.textContent = o[k]; save(); redraw(); }
      else if (el.dataset.ovk) { const box = el.closest("[data-ovi]"), ov = box && o.ov[+box.dataset.ovi]; if (!ov) return; const k = el.dataset.ovk; ov[k] = el.type === "range" || k === "pos" ? Number(el.value) : el.value; if (k === "pos") { delete ov.fx; delete ov.fy; } if (el.type === "range") { const b = el.parentNode.querySelector("b"); if (b) b.textContent = ov[k]; } save(); redraw(); }
    });
    root.addEventListener("change", e => {
      const el = e.target; if (el.id === "pbst-logo" && el.files && el.files[0]) { const f = el.files[0], u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const c = mk(Math.min(800, im.naturalWidth), Math.min(800, im.naturalWidth) * im.naturalHeight / im.naturalWidth); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); S.logo = c; URL.revokeObjectURL(u); redraw(); }; im.onerror = () => say("⚠️ تعذّر قراءة الشعار"); im.src = u; }
    });
  }
  /* بداية جديدة: لا تبقى إعدادات الجلسة السابقة بعد إغلاق نافذة الأداة */
  const fresh = () => { try { cancel(); } catch (e) { } try { hitsOff(); } catch (e) { } S.opt = Object.assign({}, DEF, { ov: [] }); S.logo = null; S.selOv = null; S.cut = null; S.srcC = null; S.bb = null; S.src = ""; S.id = ""; S.pv = ""; S.pvUrl = ""; S.tab = "bg"; S.off = false; S.busy = false; S.msg = ""; S.origSrc = ""; S.origId = ""; S.shUser = false; S.shAuto = false; try { localStorage.removeItem(LSK); } catch (e) { } };
  return { fresh, redraw, logo: () => S.logo, TITLES, panel, mount, compose, bbox, hasAlpha, sizeOf, bgOf, BGS, SIZES, SCENES, BADGES, opts: () => S.opt, pending: () => S.pv || "", hits, hitsOff, cancel, apply: applyExt, tab: () => S.tab, setTab: t => { S.tab = t; }, _S: S };
})();
