/* AIBgCut — «نزع الخلفية» بدقة عالية عبر Alyssum API (وحدة مستقلة؛ التقاط العناصر له وحدته AICapture).
   المبدأ: الخدمة تُحدّد الموضع والقناع التقريبي فقط، أما البكسلات والحواف فمن صورتك الأصلية بلا إعادة توليد:
   (1) detect: مربعات العناصر (box_2d بإحداثيات 0..1000) بأسمائها.
   (2) cutout: يُقصّ محيط العنصر بدقة الصورة ويُطلب قناع تجزئة له وحده (دقة أعلى لأن العنصر يملأ الإطار)، ثم يُنظَّف القناع من الجزر
       ويُصقل بماتينغ محلي (PBBgRemove._t.matteCore) فتلتصق الحافة بحدود العنصر الحقيقية بدقة البكسل (شعر/حواف ناعمة).
      الاحتياط: إن لم يعطِ الخدمة قناعاً صالحاً يُستعمل مربع العنصر مع فصل لوني محلي. لم يُجرَّب بمفتاح حقيقي (اختُبر بمحاكاة الخدمة). */
const AIBgCut = (function () {
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
    const out = []; (t.match(/\{[^{}]*\}/g) || []).forEach(o => { try { out.push(JSON.parse(o)); } catch (e) { } }); return out;
  }
  const boxOf = e => { const b = e && (e.box_2d || e.box || e.bbox); if (!Array.isArray(b) || b.length < 4) return null; const v = b.map(Number); if (v.some(x => !isFinite(x))) return null; let [y0, x0, y1, x1] = v; if (y1 < y0) [y0, y1] = [y1, y0]; if (x1 < x0) [x0, x1] = [x1, x0]; y0 = clamp(y0, 0, 1000); y1 = clamp(y1, 0, 1000); x0 = clamp(x0, 0, 1000); x1 = clamp(x1, 0, 1000); return x1 - x0 < 8 || y1 - y0 < 8 ? null : { x0, y0, x1, y1 }; };
  const iou = (a, b) => { const x0 = Math.max(a.x0, b.x0), y0 = Math.max(a.y0, b.y0), x1 = Math.min(a.x1, b.x1), y1 = Math.min(a.y1, b.y1), i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0), u = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i; return u > 0 ? i / u : 0; };

  const P_SUBJ = "Find the main subject(s) of this image that a photographer would keep when removing the background: the main product, or the main person together with what they wear and hold. " +
    "Return ONLY a JSON array (at most 3 items) of {\"label\":\"short Arabic name\",\"box_2d\":[ymin,xmin,ymax,xmax]} with coordinates normalized to 0-1000, tightly enclosing the WHOLE subject.";
  async function ask(prompt, canvas, o) {
    const blob = await toBlob(canvas, "image/jpeg", .93);
    return ImgGen.text({ prompt, blobs: [blob], edge: 1600, mime: true, temp: 0, maxTokens: o && o.maxTokens || 4096, signal: o && o.signal });
  }
  /* (1) كشف الموضوع الرئيسي ← [{id,label,box:{x0,y0,x1,y1}}] بإحداثيات الصورة cv */
  async function detect(cv, o) {
    o = o || {}; if (o.onStep) o.onStep("⏳ كشف العناصر…"); const z = o.zone || [0, 0, cv.width, cv.height], zw = z[2] - z[0], zh = z[3] - z[1];
    const t = await ask(P_SUBJ, cropOf(cv, z[0], z[1], zw, zh, 1), o), arr = parseLoose(t), items = [];
    arr.forEach(e => { const b = boxOf(e); if (!b) return; const box = { x0: z[0] + b.x0 / 1000 * zw, y0: z[1] + b.y0 / 1000 * zh, x1: z[0] + b.x1 / 1000 * zw, y1: z[1] + b.y1 / 1000 * zh }, bw = box.x1 - box.x0, bh = box.y1 - box.y0;
      if (bw < cv.width * .02 || bh < cv.height * .02) return; if (items.length && items.some(q => iou(q.box, box) > .85)) return; items.push({ label: String(e.label || "عنصر").slice(0, 40), box }); });
    if (items.length > 1) { const full = items.filter(i => (i.box.x1 - i.box.x0) * (i.box.y1 - i.box.y0) > cv.width * cv.height * .94); if (full.length) full.forEach(f => items.splice(items.indexOf(f), 1)); }      // «الخلفية كلها» ليست عنصراً
    items.forEach((it, i) => it.id = i); if (!items.length) throw new Error("لم تجد الأداة عناصر كاملة قابلة للفصل في هذه الصورة");
    return items;
  }
  /* قناع الخدمة (PNG base64 داخل مربع العنصر) ← Float32 0..1 بحجم العمل */
  async function decodeMask(str, bw, bh) {
    let s = String(str || "").replace(/^data:image\/[a-z]+;base64,/, ""); if (!s) return null; let bmp; try { const bin = atob(s), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); bmp = await createImageBitmap(new Blob([arr], { type: "image/png" })); } catch (e) { return null; }
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
  const PCUT = lbl => "This is a cropped photo. Give the segmentation mask of ONLY this one object: \"" + lbl + "\" (the whole object, fully or mostly inside the frame, e.g. including its cap, handle, label and the parts that stick out). " +
    "Return ONLY a JSON list with a single entry {\"box_2d\":[ymin,xmin,ymax,xmax] normalized to 0-1000,\"mask\":\"<base64 PNG of the mask cropped to that box, white = the object>\",\"label\":\"" + lbl.replace(/"/g, "") + "\"}.";
  /* (2) قصّ عنصر بدقة: ← { canvas (RGBA مقصوص), x0, y0, w, h (بإحداثيات cv), method, cov } */
  async function cutout(cv, item, o) {
    o = o || {}; const t = T(); if (!t || !t.matteCore) throw new Error("أداة الحواف غير محمّلة"); const step = o.onStep || (() => { }), b = item.box, bw = b.x1 - b.x0, bh = b.y1 - b.y0, m = Math.max(10, Math.round(Math.max(bw, bh) * .1));
    const rx0 = Math.max(0, Math.floor(b.x0 - m)), ry0 = Math.max(0, Math.floor(b.y0 - m)), rx1 = Math.min(cv.width, Math.ceil(b.x1 + m)), ry1 = Math.min(cv.height, Math.ceil(b.y1 + m)), rw = rx1 - rx0, rh = ry1 - ry0;
    const s = Math.min(1, Math.sqrt(MAXPX / (rw * rh))), work = cropOf(cv, rx0, ry0, rw, rh, s), ww = work.width, wh = work.height;
    const bx0 = (b.x0 - rx0) * s, by0 = (b.y0 - ry0) * s, bx1 = (b.x1 - rx0) * s, by1 = (b.y1 - ry0) * s;
    let M = null, method = "api";
    try {
      step("⏳ قناع «" + item.label + "»…"); const arr = parseLoose(await ask(PCUT(item.label), work, { maxTokens: 8192, signal: o.signal })), cand = arr.map(e => ({ e, b: boxOf(e) })).filter(q => q.b && q.e.mask).sort((p, q) => (q.b.x1 - q.b.x0) * (q.b.y1 - q.b.y0) - (p.b.x1 - p.b.x0) * (p.b.y1 - p.b.y0))[0];
      if (cand) { const px0 = Math.round(cand.b.x0 / 1000 * ww), py0 = Math.round(cand.b.y0 / 1000 * wh), px1 = Math.round(cand.b.x1 / 1000 * ww), py1 = Math.round(cand.b.y1 / 1000 * wh), dm = await decodeMask(cand.e.mask, Math.max(2, px1 - px0), Math.max(2, py1 - py0));
        if (dm) { M = new Float32Array(ww * wh); for (let y = 0; y < dm.h; y++) { const yy = py0 + y; if (yy < 0 || yy >= wh) continue; for (let x = 0; x < dm.w; x++) { const xx = px0 + x; if (xx >= 0 && xx < ww) M[yy * ww + xx] = dm.m[y * dm.w + x]; } } } }
    } catch (e) { if (e && (e.code === "NOKEY" || e.code === "OFF")) throw e; console.warn("AISeg mask", e); }
    if (M) { let sum = 0; const bn = Math.max(1, (bx1 - bx0) * (by1 - by0)); for (let i = 0; i < M.length; i++) if (M[i] > .5) sum++; const r = sum / bn; if (r < .06 || r > 1.4) M = null; }      // قناع غير معقول مقارنة بالمربع
    if (!M) throw new Error("لم يُعزل «" + item.label + "» — أعد المحاولة");
    clean(M, ww, wh); step("✂️ صقل الحواف بدقة البكسل…"); await new Promise(r => setTimeout(r, 0));
    const band = clamp(Math.round(Math.max(ww, wh) * (poly ? .018 : .011)), 3, poly ? 32 : 14), res = t.matteCore(t.rgbOf(work), M, { band, detail: 1, decon: true, shift: 0, feather: 0 }), n = ww * wh;
    let x0 = ww, y0 = wh, x1 = -1, y1 = -1, solid = 0; for (let i = 0; i < n; i++) { const a = clamp(res.alpha[i], 0, 1) * 255; res.data[i * 4 + 3] = a < 3 ? 0 : a; if (a > 20) { solid++; const x = i % ww, y = (i / ww) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0 || solid < n * .004) throw new Error("لم يُعزل «" + item.label + "»");
    const full = mk(ww, wh); full.getContext("2d").putImageData(new ImageData(res.data, ww, wh), 0, 0); const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = mk(cw, ch); out.getContext("2d").drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch);
    return { canvas: out, x0: rx0 + x0 / s, y0: ry0 + y0 / s, w: cw / s, h: ch / s, label: item.label, method, cov: solid / n, item };
  }
  /* (3) نزع الخلفية بطلب واحد: تطلب الخدمة قناع الموضوع الرئيسي (حتى 3 عناصر) من الصورة كاملة في ردّ واحد، ثم تُصقل الحواف محلياً من بكسلات صورتك الأصلية
     (ماتينغ بدقة البكسل) فتخرج نتيجة واحدة بحجم الأصل — كنزع خلفية كانفا بنقرة واحدة. محاولة واحدة؛ إن جاء الردّ بلا قناع صالح يُرفض بوضوح بسببه (لا إعادة ولا بدائل محلية). */
  const MASKFMT = "Return ONLY a JSON list of {\"label\":\"short Arabic name\",\"box_2d\":[ymin,xmin,ymax,xmax] normalized to 0-1000 tightly enclosing the WHOLE object,\"mask\":\"<base64 PNG of the mask cropped to that box, white = the kept object, at most 128x128 pixels>\"}. ";
  /* محاولة واحدة دقيقة بالذكاء: برومبت واحد يحمل قاعدة القرار بنفسه (ما يبقى وما يُزال) فيصلح لكل صورة بلا طلب تحليل ولا بدائل */
  const ATTEMPTS = [
    { id: "one", maxTokens: 16384, prompt: "One-click background removal like Canva. Return the mask(s) of what must STAY: the main subject (person, animal or product) together with everything it wears, holds or touches. " +
      "A person holding a product is ONE entry that covers both, following the exact visible outline (hair, fingers, fabric edges, the product's rim). " +
      "Include furniture or objects ONLY when the subject is physically sitting at, leaning on or touching them (extra entries are allowed for those). " +
      "Everything else is background and must NOT appear in any mask: plants, leaves, branches, flowers, curtains, windows, walls, shelves, wall pictures, floor, sky, blurred areas and light effects. At most 4 entries, the main subject first. " + MASKFMT },
  ];
  async function subjectMask(work, o, at) {
    at = at || ATTEMPTS[0]; const ww = work.width, wh = work.height, why = t => ({ M: null, why: t });
    let arr; try { arr = parseLoose(await ask(at.prompt, work, { maxTokens: at.maxTokens, signal: o && o.signal })); } catch (e) { if (e && e.name === "AbortError") throw e; return why(String(e && e.message || e).slice(0, 90)); }
    arr = (arr || []).filter(e => e && typeof e === "object"); if (!arr.length) return why("ردّ بلا عناصر");
    const M = new Float32Array(ww * wh), area = q => (q.b.x1 - q.b.x0) * (q.b.y1 - q.b.y0); let used = 0;
    if (at.poly) {
      const c = document.createElement("canvas"); c.width = ww; c.height = wh; const g = c.getContext("2d"); g.fillStyle = "#fff"; let n = 0;
      arr.slice(0, 2).forEach(e => { const pts = (e.polygon || e.points || []).map(q => Array.isArray(q) ? [Number(q[1]), Number(q[0])] : null).filter(q => q && isFinite(q[0]) && isFinite(q[1])); if (pts.length < 6) return; g.beginPath(); pts.forEach((q, i) => { const x = clamp(q[0], 0, 1000) / 1000 * ww, y = clamp(q[1], 0, 1000) / 1000 * wh; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); n++; });
      if (!n) return why("مضلّع غير صالح"); const d = g.getImageData(0, 0, ww, wh).data; for (let i = 0; i < ww * wh; i++) M[i] = d[i * 4 + 3] > 127 ? 1 : 0; used = n;
    } else {
      let cand = arr.map(e => ({ e, b: boxOf(e) })).filter(q => q.b && q.e.mask); if (!cand.length) return why("ردّ بلا أقنعة (" + arr.length + " عنصراً)");
      cand.sort((p, q) => area(q) - area(p)); cand = cand.filter((q, i) => i === 0 || area(q) >= area(cand[0]) * .01).slice(0, 12);      // الموضوع + مشهده الأمامي
      for (const q of cand) { const px0 = Math.round(q.b.x0 / 1000 * ww), py0 = Math.round(q.b.y0 / 1000 * wh), px1 = Math.round(q.b.x1 / 1000 * ww), py1 = Math.round(q.b.y1 / 1000 * wh), dm = await decodeMask(q.e.mask, Math.max(2, px1 - px0), Math.max(2, py1 - py0)); if (!dm) continue;
        let sum = 0; for (let i = 0; i < dm.m.length; i++) if (dm.m[i] > .5) sum++; const r = sum / Math.max(1, dm.m.length); if (r < .04 || r > .995) continue;      // قناع غير معقول داخل مربعه
        for (let y = 0; y < dm.h; y++) { const yy = py0 + y; if (yy < 0 || yy >= wh) continue; for (let x = 0; x < dm.w; x++) { const xx = px0 + x; if (xx >= 0 && xx < ww) { const v = dm.m[y * dm.w + x]; if (v > M[yy * ww + xx]) M[yy * ww + xx] = v; } } } used++; }
      if (!used) return why("أقنعة غير صالحة أو غير معقولة");
    }
    let tot = 0; for (let i = 0; i < M.length; i++) if (M[i] > .5) tot++; const cov = tot / M.length; if (cov < .01 || cov > .985) return why("تغطية القناع " + Math.round(cov * 100) + "%"); return { M, why: "", poly: !!at.poly };
  }
  async function subject(cv, o) {
    o = o || {}; const t = T(); if (!t || !t.matteCore) throw new Error("أداة الحواف غير محمّلة"); const step = o.onStep || (() => { }), s = Math.min(1, Math.sqrt(MAXPX / (cv.width * cv.height))), work = cropOf(cv, 0, 0, cv.width, cv.height, s), ww = work.width, wh = work.height;
    let M = null, poly = false; const reasons = []; step("⏳ تحديد الموضوع…");      // محاولة واحدة دقيقة بالذكاء (بلا تحليل مسبق ولا بدائل)
    { const r = await subjectMask(work, o, ATTEMPTS[0]); if (r.M) { M = r.M; poly = r.poly; } else reasons.push(r.why); }
    if (!M) { console.warn("bgcut", reasons); throw new Error("لم تُعزل الصورة (" + reasons.map(r => r.replace(/^[a-z]+: /, "")).join(" · ") + ") — أعد المحاولة أو جرّب صورة أخرى"); }
    clean(M, ww, wh); step("✂️ صقل الحواف بدقة البكسل…"); await new Promise(r => setTimeout(r, 0));
    const band = clamp(Math.round(Math.max(ww, wh) * .011), 3, 14), res = t.matteCore(t.rgbOf(work), M, { band, detail: 1, decon: true, shift: 0, feather: 0 }), n = ww * wh; let solid = 0;
    for (let i = 0; i < n; i++) { const a = clamp(res.alpha[i], 0, 1) * 255; res.data[i * 4 + 3] = a < 3 ? 0 : a; if (a > 20) solid++; }
    if (solid < n * .004) throw new Error("لم يُعزل الموضوع — أعد المحاولة");
    const full = mk(ww, wh); full.getContext("2d").putImageData(new ImageData(res.data, ww, wh), 0, 0);
    const out = mk(cv.width, cv.height), g = out.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(full, 0, 0, cv.width, cv.height); out._via = "api"; return out;
  }
  return { ready, detect, cutout, subject, _t: { subjectMask, parseLoose, boxOf, decodeMask, clean, iou } };
})();
if (typeof window !== "undefined") window.AIBgCut = AIBgCut;
