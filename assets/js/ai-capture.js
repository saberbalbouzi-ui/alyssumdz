/* AICapture — «التقاط العناصر» بدقة عالية عبر Alyssum API (وحدة مستقلة؛ نزع الخلفية له وحدته AIBgCut).
   المبدأ: الخدمة تُحدّد الموضع والقناع التقريبي فقط، أما البكسلات والحواف فمن صورتك الأصلية بلا إعادة توليد:
   (1) detect: مربعات العناصر (box_2d بإحداثيات 0..1000) بأسمائها.
   (2) cutout: يُقصّ محيط العنصر بدقة الصورة ويُطلب قناع تجزئة له وحده (دقة أعلى لأن العنصر يملأ الإطار)، ثم يُنظَّف القناع من الجزر
       ويُصقل بماتينغ محلي (PBBgRemove._t.matteCore) فتلتصق الحافة بحدود العنصر الحقيقية بدقة البكسل (شعر/حواف ناعمة).
   (3) fillBg: إعادة رسم الخلفية مكان العناصر المقصوصة داخل منطقتها فقط (بقية الصورة تبقى بكسلاً بكسل).
   الاحتياط: إن لم يعطِ الخدمة قناعاً صالحاً يُستعمل مربع العنصر مع فصل لوني محلي. لم يُجرَّب بمفتاح حقيقي (اختُبر بمحاكاة الخدمة). */
const AICapture = (function () {
  "use strict";
  const MAXPX = 3.2e6, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const T = () => (typeof PBBgRemove !== "undefined" && PBBgRemove._t) || null;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || "image/png", q));
  function ready() { try { return typeof ImgGen !== "undefined" && !!ImgGen.text && !!ImgGen.ready && ImgGen.ready().ok; } catch (e) { return false; } }
  function cropOf(cv, x0, y0, w, h, s) { const c = mk(w * (s || 1), h * (s || 1)), g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(cv, x0, y0, w, h, 0, 0, c.width, c.height); return c; }
  /* ردّ JSON متسامح: أسوار ```، ردّ مقطوع في آخره، أو كائنات متفرقة */
  function parseLoose(t) {
    t = String(t || "").replace(/^```[a-z]*\s*|```\s*$/g, "").trim(); try { const j = JSON.parse(t); return Array.isArray(j) ? j : (j && (j.objects || j.items || j.results)) || [j]; } catch (e) { }
    const a = t.indexOf("["); if (a >= 0) { let s = t.slice(a); const z = s.lastIndexOf("}"); if (z > 0) { try { return JSON.parse(s.slice(0, z + 1) + "]"); } catch (e) { } } }
    const out = []; (t.match(/\{[^{}]*\}/g) || []).forEach(o => { try { out.push(JSON.parse(o)); } catch (e) { } }); if (out.some(e => e && e.box_2d)) return out;
    /* ردّ مقطوع في منتصف قناع base64 (لا كائن مكتمل): تُنقَذ المربعات والعناوين التي سبقته */
    const sal = []; const re = /"box_2d"\s*:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g; let m;
    while ((m = re.exec(t))) { const lb = /"label"\s*:\s*"([^"]{0,60})"/.exec(t.slice(Math.max(0, m.index - 90), m.index + m[0].length + 120)); sal.push({ box_2d: [+m[1], +m[2], +m[3], +m[4]], label: lb ? lb[1] : "" }); }
    return sal.length ? sal : out;
  }
  const boxOf = e => { const b = e && (e.box_2d || e.box || e.bbox); if (!Array.isArray(b) || b.length < 4) return null; const v = b.map(Number); if (v.some(x => !isFinite(x))) return null; let [y0, x0, y1, x1] = v; if (y1 < y0) [y0, y1] = [y1, y0]; if (x1 < x0) [x0, x1] = [x1, x0]; y0 = clamp(y0, 0, 1000); y1 = clamp(y1, 0, 1000); x0 = clamp(x0, 0, 1000); x1 = clamp(x1, 0, 1000); return x1 - x0 < 8 || y1 - y0 < 8 ? null : { x0, y0, x1, y1 }; };
  const iou = (a, b) => { const x0 = Math.max(a.x0, b.x0), y0 = Math.max(a.y0, b.y0), x1 = Math.min(a.x1, b.x1), y1 = Math.min(a.y1, b.y1), i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0), u = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i; return u > 0 ? i / u : 0; };

  /* مضلّع الخدمة [[y,x],…] بإحداثيات 0..1000 ← نقاط [x,y] نظيفة (حذف المكرّر المتتالي، ورفض الحلقات المتكرّرة التي ينتجها النموذج عند التدهور) */
  function polyPts(e) {
    const raw = e && (e.polygon || e.points || e.outline); if (!Array.isArray(raw)) return null; const pts = [];
    for (const q of raw) { if (!Array.isArray(q) || q.length < 2) continue; const y = Number(q[0]), x = Number(q[1]); if (!isFinite(x) || !isFinite(y)) continue; const p = [clamp(x, 0, 1000), clamp(y, 0, 1000)], l = pts[pts.length - 1]; if (l && l[0] === p[0] && l[1] === p[1]) continue; pts.push(p); }
    if (pts.length < 8 || new Set(pts.map(p => p[0] + "," + p[1])).size < pts.length * .6) return null; return pts;
  }

  const P_ALL = "Detect every distinct, COMPLETE, individually separable object in this image: people, products and packaging, tools, plants, food, furniture and decor items. " +
    "Treat things a person holds as separate objects from the person and ALWAYS include a held product even if fingers cover part of it. Ignore background surfaces taken as a whole (walls, floor, table top, sky, backdrop), shadows, reflections and tiny fragments; skip objects that are cut off by the image edge. " +
    "Return ONLY a JSON array (at most MAX items) of objects like {\"label\":\"short Arabic name\",\"box_2d\":[ymin,xmin,ymax,xmax]} with coordinates normalized to 0-1000 and boxes that tightly enclose the whole object.";
  const LAST = { req: null, raw: null, err: null, counts: null };      // تقرير آخر طلب لتشخيص الفشل (يُنسخ من الواجهة)
  async function ask(prompt, canvas, o) {
    const blob = await toBlob(canvas, "image/jpeg", .93);
    LAST.req = { prompt: String(prompt).slice(0, 60), w: canvas.width, h: canvas.height, kb: Math.round(blob.size / 1024), maxTokens: o && o.maxTokens || 4096 }; LAST.raw = null; LAST.err = null;
    try { const t = await ImgGen.text({ prompt, blobs: [blob], edge: 1600, mime: true, temp: o && o.temp != null ? o.temp : 0, noThink: true, models: ["gemini-2.5-flash"], maxModels: 3, timeoutMs: 70000, maxTokens: o && o.maxTokens || 4096, signal: o && o.signal }); LAST.raw = { len: String(t || "").length, head: String(t || "").slice(0, 260), tail: String(t || "").slice(-120) }; return t; }
    catch (e) { LAST.err = String(e && e.message || e).slice(0, 400); throw e; }
  }
  /* (1) كشف العناصر ← [{id,label,box:{x0,y0,x1,y1}}] بإحداثيات الصورة cv. o.zone = [x0,y0,x1,y1] لتحليل منطقة بدقة أعلى، o.mode = "subject" للموضوع الرئيسي فقط */
  async function detect(cv, o) {
    o = o || {}; if (o.onStep) o.onStep("⏳ كشف العناصر…"); const z = o.zone || [0, 0, cv.width, cv.height], zw = z[2] - z[0], zh = z[3] - z[1];
    const t = await ask(P_ALL.replace("MAX", String(o.max || 12)), cropOf(cv, z[0], z[1], zw, zh, 1), o), arr = parseLoose(t), items = [];
    arr.forEach(e => { const b = boxOf(e); if (!b) return; const box = { x0: z[0] + b.x0 / 1000 * zw, y0: z[1] + b.y0 / 1000 * zh, x1: z[0] + b.x1 / 1000 * zw, y1: z[1] + b.y1 / 1000 * zh }, bw = box.x1 - box.x0, bh = box.y1 - box.y0;
      if (bw < cv.width * .02 || bh < cv.height * .02) return; if (items.length && items.some(q => iou(q.box, box) > .85)) return; items.push({ label: String(e.label || "عنصر").slice(0, 40), box }); });
    if (items.length > 1) { const full = items.filter(i => (i.box.x1 - i.box.x0) * (i.box.y1 - i.box.y0) > cv.width * cv.height * .94); if (full.length) full.forEach(f => items.splice(items.indexOf(f), 1)); }      // «الخلفية كلها» ليست عنصراً
    items.forEach((it, i) => it.id = i); if (!items.length) throw new Error("لم تجد الأداة عناصر كاملة قابلة للفصل في هذه الصورة");
    return items;
  }

  const P_MASKS = "Segment every distinct, COMPLETE, individually separable object in this image: people, products and packaging, tools, plants, food, furniture and decor items. " +
    "Treat things a person holds as separate objects from the person, and ALWAYS include a held product even if fingers cover part of it: its mask must follow the exact visible edge of the object, leaving out the fingers, hands and anything in front of it (no overlap with the hand). " +
    "Ignore background surfaces taken as a whole (walls, floor, table top, sky, backdrop), shadows, reflections and tiny fragments; skip objects cut off by the image edge. " +
    "Return ONLY a short JSON array (at most MAX entries) of {\"label\":\"short Arabic name\",\"box_2d\":[ymin,xmin,ymax,xmax]} with coordinates normalized to 0-1000, tightly enclosing the WHOLE object including a held product's visible rim. Do not output masks or polygons.";
  /* (1) كشف العناصر مع أقنعتها في طلب واحد ← [{id,label,box,pre:{m,w,h,x0,y0}}] ؛ لا طلب إضافي لكل عنصر */
  async function detectAll(cv, o) {
    o = o || {}; if (o.onStep) o.onStep("⏳ كشف العناصر…");
    const ask1 = async (max) => parseLoose(await ask(P_MASKS.replace("MAX", String(max)), cv, { maxTokens: 2048, temp: .3, signal: o.signal })), build = async arr => {
      const items = [], W = cv.width, H = cv.height;
      for (const e of arr) { if (!e || typeof e !== "object") continue; const pts = polyPts(e); let b = boxOf(e);
        if (!b && pts) { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); if (x1 - x0 >= 8 && y1 - y0 >= 8) b = { x0, y0, x1, y1 }; }      // مربع مفقود: يُشتق من حدود المضلّع
        if (!b) continue; const box = { x0: b.x0 / 1000 * W, y0: b.y0 / 1000 * H, x1: b.x1 / 1000 * W, y1: b.y1 / 1000 * H }, bw = box.x1 - box.x0, bh = box.y1 - box.y0;
        if (bw < W * .02 || bh < H * .02 || (bw * bh > W * H * .94 && arr.length > 1)) continue; if (items.some(q => iou(q.box, box) > .85)) continue;
        const px0 = Math.round(box.x0), py0 = Math.round(box.y0), mw = Math.max(2, Math.round(bw)), mh = Math.max(2, Math.round(bh)); let pre = null;
        if (pts) { const c = mk(mw, mh), g = c.getContext("2d", { willReadFrequently: true }); g.fillStyle = "#fff"; g.beginPath(); pts.forEach((q, i) => { const x = q[0] / 1000 * W - px0, y = q[1] / 1000 * H - py0; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); const d = g.getImageData(0, 0, c.width, c.height).data, m = new Float32Array(c.width * c.height); let sum = 0; for (let i = 0; i < m.length; i++) { m[i] = d[i * 4 + 3] / 255; sum += m[i]; } const mean = sum / m.length; if (mean > .03 && mean < .995) pre = { m, w: c.width, h: c.height, x0: px0, y0: py0, poly: true }; }
        if (!pre && e.mask) { const dm = await decodeMask(e.mask, mw, mh); if (dm) pre = { m: dm.m, w: dm.w, h: dm.h, x0: px0, y0: py0 }; }
        items.push({ label: String(e.label || "عنصر").slice(0, 40), box, pre }); }      // عنصر بلا مضلّع/قناع صالح يُستبعد لاحقاً
      items.forEach((it, i) => it.id = i); LAST.counts = { entries: arr.length, withBox: arr.filter(e => boxOf(e)).length, withMask: arr.filter(e => e && (e.mask || e.polygon || e.points)).length, usable: items.filter(i => i.pre).length }; return items;
    };
    /* محاولة واحدة دقيقة بالذكاء: كشف العناصر وأقنعتها في طلب واحد، بلا إعادة ولا طلبات إضافية لكل عنصر */
    let items = [], err = null; try { items = await build(await ask1(o.max || 8)); } catch (e) { if (e && (e.name === "AbortError" || e.code === "NOKEY" || e.code === "OFF")) throw e; err = e; }
    /* عنصر مربعه دقيق وقناعه غير صالح لا يُسقط: يُفصل داخل المربع (مرجع الخدمة) ثم تُصقل حوافه من بكسلات الأصل */
    items = items.filter(it => it.pre || (it.box && T() && T().boxMask)); items.forEach(it => { if (!it.pre) it.boxOnly = true; });
    if (!items.length) throw new Error("لم تُرجِع الخدمة عناصر قابلة للفصل" + (err && err.message ? " (" + String(err.message).slice(0, 70) + ")" : "") + " — أعد المحاولة");
    return items;
  }
  /* قناع الخدمة (PNG base64 داخل مربع العنصر) ← Float32 0..1 بحجم العمل */
  async function decodeMask(str, bw, bh) {
    let s = String(str || "").replace(/^data:image\/[a-z]+;base64,/, ""); if (!s) return null; let bmp; try { const bin = atob(s), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); bmp = await createImageBitmap(new Blob([arr], { type: "image/png" })); } catch (e) { return null; }
    if (Math.min(bmp.width, bmp.height) < 24 && Math.min(bw, bh) > 60) return null;      // قناع وهمي بحجم أيقونة (4×4، 10×10)
    const c = mk(bw, bh), g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height; let amin = 255; for (let i = 0; i < n; i++) if (d[i * 4 + 3] < amin) amin = d[i * 4 + 3];
    const out = new Float32Array(n), useA = amin < 235; let sum = 0; for (let i = 0; i < n; i++) { const v = (useA ? d[i * 4 + 3] : d[i * 4]) / 255; out[i] = v; sum += v; }
    const mean = sum / n; if (mean < .02 || mean > .985) return null;
    const cx = (c.width >> 1), cy = (c.height >> 1), cen = out[cy * c.width + cx], cor = (out[0] + out[c.width - 1] + out[(c.height - 1) * c.width] + out[c.width * c.height - 1]) / 4;
    if (cen < .35 && cor > .65) for (let i = 0; i < n; i++) out[i] = 1 - out[i];      // قناع معكوس (الخلفية بيضاء)
    return { m: out, w: c.width, h: c.height };
  }
  /* تنظيف القناع الثنائي: حذف الجزر الصغيرة وسدّ الثقوب الصغيرة داخل العنصر */
  function clean(M, w, h) {
    const n = w * h, B = new Uint8Array(n); for (let i = 0; i < n; i++) B[i] = M[i] > .5 ? 1 : 0;
    const lab = new Int32Array(n), st = new Int32Array(n), sizes = [0]; let nl = 0;
    for (let i = 0; i < n; i++) { if (!B[i] || lab[i]) continue; nl++; let sp = 0, sz = 0; st[sp++] = i; lab[i] = nl; while (sp) { const q = st[--sp]; sz++; const x = q % w; if (x > 0 && B[q - 1] && !lab[q - 1]) { lab[q - 1] = nl; st[sp++] = q - 1; } if (x < w - 1 && B[q + 1] && !lab[q + 1]) { lab[q + 1] = nl; st[sp++] = q + 1; } if (q >= w && B[q - w] && !lab[q - w]) { lab[q - w] = nl; st[sp++] = q - w; } if (q < n - w && B[q + w] && !lab[q + w]) { lab[q + w] = nl; st[sp++] = q + w; } } sizes[nl] = sz; }
    const big = Math.max(0, ...sizes), keep = sizes.map(s => s >= big * .04);
    for (let i = 0; i < n; i++) if (B[i] && !keep[lab[i]]) M[i] = 0;
    const F = new Uint8Array(n); for (let i = 0; i < n; i++) F[i] = B[i] && keep[lab[i]] ? 1 : 0;
    const bgl = new Int32Array(n), bs = [0], touch = [false]; let nb = 0;      // ثقوب: مكوّنات «غير العنصر» الصغيرة التي لا تلمس الحافة
    for (let i = 0; i < n; i++) { if (F[i] || bgl[i]) continue; nb++; let sp = 0, sz = 0, t = false; st[sp++] = i; bgl[i] = nb;
      while (sp) { const q = st[--sp]; sz++; const x = q % w, y = (q / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) t = true;
        if (x > 0 && !F[q - 1] && !bgl[q - 1]) { bgl[q - 1] = nb; st[sp++] = q - 1; } if (x < w - 1 && !F[q + 1] && !bgl[q + 1]) { bgl[q + 1] = nb; st[sp++] = q + 1; }
        if (y > 0 && !F[q - w] && !bgl[q - w]) { bgl[q - w] = nb; st[sp++] = q - w; } if (y < h - 1 && !F[q + w] && !bgl[q + w]) { bgl[q + w] = nb; st[sp++] = q + w; } }
      bs[nb] = sz; touch[nb] = t; }
    for (let i = 0; i < n; i++) if (bgl[i] && !touch[bgl[i]] && bs[bgl[i]] < big * .004) M[i] = 1;
    return M;
  }
  /* (2) قصّ عنصر بدقة: ← { canvas (RGBA مقصوص), x0, y0, w, h (بإحداثيات cv), method, cov } */
  async function cutout(cv, item, o) {
    o = o || {}; const t = T(); if (!t || !t.matteCore) throw new Error("أداة الحواف غير محمّلة"); const step = o.onStep || (() => { }), b = item.box, bw = b.x1 - b.x0, bh = b.y1 - b.y0, m = Math.max(10, Math.round(Math.max(bw, bh) * .1));
    const rx0 = Math.max(0, Math.floor(b.x0 - m)), ry0 = Math.max(0, Math.floor(b.y0 - m)), rx1 = Math.min(cv.width, Math.ceil(b.x1 + m)), ry1 = Math.min(cv.height, Math.ceil(b.y1 + m)), rw = rx1 - rx0, rh = ry1 - ry0;
    const s = Math.min(1, Math.sqrt(MAXPX / (rw * rh))), work = cropOf(cv, rx0, ry0, rw, rh, s), ww = work.width, wh = work.height;
    const bx0 = (b.x0 - rx0) * s, by0 = (b.y0 - ry0) * s, bx1 = (b.x1 - rx0) * s, by1 = (b.y1 - ry0) * s;
    let M = null, method = "api";
    if (item.pre) {      // قناع جاهز من طلب الكشف: يُنقل إلى إحداثيات العمل بلا أي طلب إضافي
      const pr = item.pre; M = new Float32Array(ww * wh);
      for (let y = 0; y < wh; y++) { const sy = ry0 + y / s - pr.y0; if (sy < 0 || sy >= pr.h) continue; const iy = Math.min(pr.h - 1, sy | 0); for (let x = 0; x < ww; x++) { const sx = rx0 + x / s - pr.x0; if (sx < 0 || sx >= pr.w) continue; M[y * ww + x] = pr.m[iy * pr.w + Math.min(pr.w - 1, sx | 0)]; } }
    }      // لا طلب قناع ثانٍ لكل عنصر: القناع يأتي مع الكشف في المسحة الواحدة
    if (!M && !item.pre && t.boxMask) { step("⏳ فصل «" + item.label + "» داخل المربع…"); M = await t.boxMask(work, [bx0, by0, bx1, by1]); method = "box"; }
    if (M) { let sum = 0; const bn = Math.max(1, (bx1 - bx0) * (by1 - by0)); for (let i = 0; i < M.length; i++) if (M[i] > .5) sum++; const r = sum / bn; if (r < .06 || r > 1.4) M = null; }      // قناع غير معقول مقارنة بالمربع
    if (!M) throw new Error("لم يُعزل «" + item.label + "» — أعد المحاولة");
    clean(M, ww, wh); step("✂️ صقل الحواف بدقة البكسل…"); await new Promise(r => setTimeout(r, 0));
    const pl = !!(item.pre && item.pre.poly) || method === "box", band = clamp(Math.round(Math.max(ww, wh) * (pl ? .02 : .011)), 3, pl ? 36 : 14), res = t.matteCore(t.rgbOf(work), M, { band, detail: 1, decon: true, shift: 0, feather: 0 }), n = ww * wh;
    let x0 = ww, y0 = wh, x1 = -1, y1 = -1, solid = 0; for (let i = 0; i < n; i++) { const a = clamp(res.alpha[i], 0, 1) * 255; res.data[i * 4 + 3] = a < 3 ? 0 : a; if (a > 20) { solid++; const x = i % ww, y = (i / ww) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0 || solid < n * .004) throw new Error("لم يُعزل «" + item.label + "»");
    const full = mk(ww, wh); full.getContext("2d").putImageData(new ImageData(res.data, ww, wh), 0, 0); const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = mk(cw, ch); out.getContext("2d").drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch);
    return { canvas: out, x0: rx0 + x0 / s, y0: ry0 + y0 / s, w: cw / s, h: ch / s, label: item.label, method, cov: solid / n, item };
  }
  /* (3) إعادة رسم الخلفية مكان العناصر داخل منطقتها فقط. cuts: [{canvas,x0,y0,w,h}] بإحداثيات base. يُرجع true عند النجاح (وإلا يرمي ليُستعمل الترميم المحلي) */
  async function fillBg(base, cuts, o) {
    o = o || {}; const W = base.width, H = base.height, hole = mk(W, H), hg = hole.getContext("2d", { willReadFrequently: true }); cuts.forEach(c => hg.drawImage(c.canvas, c.x0, c.y0, c.w, c.h));
    const d = hg.getImageData(0, 0, W, H).data, U = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 12) U[i] = 1;
    const R = Math.max(3, Math.round(Math.max(W, H) / 400)), grown = ImageTools.sqDilate(U, W, H, R), s = Math.min(1, 1536 / Math.max(W, H)), w = Math.round(W * s), h = Math.round(H * s), c = mk(w, h), g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(base, 0, 0, w, h);
    const im = g.getImageData(0, 0, w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grown[Math.min(H - 1, Math.round((y + .5) / s)) * W + Math.min(W - 1, Math.round((x + .5) / s))]) { const i = (y * w + x) * 4; im.data[i] = 255; im.data[i + 1] = 0; im.data[i + 2] = 255; } g.putImageData(im, 0, 0);
    if (o.onStep) o.onStep("⏳ إعادة رسم الخلفية مكان العناصر…");
    const r = await ImgGen.edit({ blob: await toBlob(c), W: w, H: h, fmt: "png", confirm: false, title: "ترميم الخلفية", prompt: "Edit this image: the areas painted solid magenta (#FF00FF) are holes where objects were removed. Fill ONLY the magenta areas with a realistic continuation of the surrounding background (walls, table, fabric, gradient, lighting and perspective), as if those objects were never there. Do not add any new object, person, text or logo. Keep every non-magenta pixel exactly the same, with the same framing and size. Return only the edited image." });
    if (!r || !r.canvas) throw new Error("لم تُرجع الأداة صورة للملء");
    const gen = mk(W, H), gg = gen.getContext("2d", { willReadFrequently: true }); gg.imageSmoothingQuality = "high"; gg.drawImage(r.canvas, 0, 0, W, H); const G = gg.getImageData(0, 0, W, H).data; let mag = 0, tot = 0; for (let i = 0; i < W * H; i++) if (U[i]) { tot++; if (G[i * 4] > 200 && G[i * 4 + 1] < 60 && G[i * 4 + 2] > 200) mag++; }
    if (tot && mag / tot > .03) throw new Error("لم تملأ الأداة المنطقة");
    const msk = mk(W, H), mg = msk.getContext("2d"); mg.fillStyle = "#000"; mg.fillRect(0, 0, W, H); const gi = new ImageData(W, H); for (let i = 0; i < W * H; i++) { const v = grown[i] ? 255 : 0; gi.data[i * 4] = v; gi.data[i * 4 + 1] = v; gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = v; } mg.putImageData(gi, 0, 0);
    const soft = mk(W, H), sg = soft.getContext("2d"); try { sg.filter = "blur(" + Math.max(1, R / 2) + "px)"; } catch (e) { } sg.drawImage(msk, 0, 0); sg.filter = "none";
    gg.globalCompositeOperation = "destination-in"; gg.drawImage(soft, 0, 0); gg.globalCompositeOperation = "source-over"; base.getContext("2d").drawImage(gen, 0, 0); return true;      // الناتج داخل المنطقة فقط وحوافها ناعمة؛ خارجها الأصل كما هو
  }
  /* يحوّل نتائج cutout إلى صيغة AIVision.eraseBg (قناع المسح) للترميم المحلي الاحتياطي */
  function eraseCuts(cuts) { return cuts.map(c => { const w = Math.max(1, Math.round(c.w)), h = Math.max(1, Math.round(c.h)), cc = mk(w, h), g = cc.getContext("2d", { willReadFrequently: true }); g.drawImage(c.canvas, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 20) m[i] = 1; return { canvas: c.canvas, x0: Math.round(c.x0), y0: Math.round(c.y0), w, h, label: c.label, erase: { m, x0: Math.round(c.x0), y0: Math.round(c.y0), w, h } }; }); }
  return { ready, report: () => JSON.stringify(LAST, null, 1), detect, detectAll, cutout, fillBg, eraseCuts, _t: { parseLoose, polyPts, boxOf, decodeMask, clean, iou } };
})();
if (typeof window !== "undefined") window.AICapture = AICapture;
