/* التقاط النص (مشترك بين منشئ الصفحات في لوحة التحكم ومحرر /editor/): كشف أسطر النص بتحليل الصورة بدقة ثم قراءتها (Gemini إن وُجد المفتاح وإلا Tesseract)
   ومطابقة القراءة بالصناديق، ثم مسح النص من الصورة وإعادة رسم الخلفية. لا يغيّر شيئاً قبل أن تطلب الدالة erase.
   المفتاح يبقى في متصفحك (localStorage) ويُرسل مباشرة إلى Google للقراءة فقط. */
window.TextCapture = (function () {
  const KEYNAME = "alyssum_gp_gkey", hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const colorDist = (a, b) => { const p = hx(a), q = hx(b); return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]); };
  const ocr = {
    key() { try { if (typeof CONFIG === "undefined" || CONFIG.AI_API !== true) return ""; return (localStorage.getItem(KEYNAME) || "").replace(/[\s"']/g, ""); } catch (e) { return ""; } },
    setKey(k) { try { localStorage.setItem(KEYNAME, k); } catch (e) { } },
    /* يعيد [{text, box:{x0,y0,x1,y1}}] بإحداثيات القماش المُعطى */
    async read(canvas, o) { o = o || {}; const k = this.key(); return k ? this.gemini(canvas, k, o) : this.tesseract(canvas, o); },
    async gemini(canvas, key, o) {
      const W = canvas.width, H = canvas.height, sc = Math.min(1, 1600 / W), c2 = document.createElement("canvas"); c2.width = Math.round(W * sc); c2.height = Math.round(H * sc); c2.getContext("2d").drawImage(canvas, 0, 0, c2.width, c2.height);
      const b64 = c2.toDataURL("image/jpeg", .9).split(",")[1];
      const prompt = "You are a precise OCR engine. Read EVERY visible line of text in this image exactly as written (keep the original script, digits, emojis and punctuation; never translate or correct). Return ONLY JSON: {\"lines\":[{\"text\":\"...\",\"box_2d\":[ymin,xmin,ymax,xmax]}]} with box_2d normalized to 0-1000 and tightly around the text of ONE visual line. Reading order top to bottom. Do not invent text.";
      const models = o.models || ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]; let last = "";
      for (const m of models) for (let t = 0; t < 2; t++) {
        let r; try { r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) }); } catch (e) { throw new Error("تعذّر الاتصال بـ Google (الإنترنت؟)"); }
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          const parts = (((j.candidates || [])[0] || {}).content || {}).parts, raw = (parts || []).map(x => x.text || "").join(""); let p; try { p = JSON.parse(raw.replace(/^```json|```$/g, "").trim()); } catch (e) { last = "رد غير مفهوم من Gemini"; continue; }
          return (p.lines || []).filter(l => l && l.text && Array.isArray(l.box_2d) && l.box_2d.length === 4).map(l => { const [y0, x0, y1, x1] = l.box_2d.map(Number); return { text: String(l.text).replace(/\s+/g, " ").trim(), box: { x0: x0 / 1000 * W, x1: x1 / 1000 * W, y0: y0 / 1000 * H, y1: y1 / 1000 * H } }; });
        }
        const msg = (j.error && j.error.message) || ("HTTP " + r.status); last = r.status + ": " + msg;
        if (r.status === 400 && /API key/i.test(msg) || r.status === 403) throw new Error("مفتاح Gemini غير صالح أو غير مسموح: " + msg.slice(0, 120));
        if (r.status === 404) break;
        if ([429, 500, 503].includes(r.status)) await new Promise(res => setTimeout(res, 1500 * (t + 1)));
      }
      throw new Error("فشلت قراءة Gemini — " + last.slice(0, 160));
    },
    async tesseract(canvas) {
      if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; s.onload = res; s.onerror = () => rej(new Error("تعذّر تحميل Tesseract (الإنترنت؟)")); document.head.appendChild(s); });
      const r = await Tesseract.recognize(canvas, "ara+eng"), lines = r.data.lines || ((r.data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || [])));
      return lines.map(l => ({ text: String(l.text || "").replace(/\s+/g, " ").trim(), conf: l.confidence, box: { x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1 } })).filter(l => l.text.length >= 2 && l.conf >= 40);
    }
  };
  const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = a => Math.max(1, (a.x1 - a.x0) * (a.y1 - a.y0));
  /* شرائح للقراءة: تُقطع في فراغات بين الأسطر حتى لا يُشطر سطر */
  function strips(H, boxes, target) {
    const out = []; let y = 0;
    while (y < H) {
      let end = Math.min(H, y + target);
      if (end < H) { let best = null; const ys = boxes.map(b => [b.y0, b.y1]).sort((p, q) => p[0] - q[0]); let prev = y; for (const [a, b] of ys) { if (a > prev && prev > y + target * .5 && prev < y + target * 1.25) { if (!best || a - prev > best.gap) best = { gap: a - prev, at: (a + prev) / 2 }; } prev = Math.max(prev, b); } if (best) end = Math.min(H, Math.round(best.at)); }
      out.push([y, end]); y = end;
    }
    return out;
  }
  /* كشف الأسطر بالصورة + لون الحبر + صندوق «القلب» (يستبعد الظل) — قبل أي مسح */
  function detect(canvas) {
    const g = canvas.getContext("2d", { willReadFrequently: true }), boxes = ImageTools.detectText(canvas);
    boxes.forEach(b => { Object.assign(b, ImageTools.inkColor(g, b)); b.core = ImageTools.coreBox(g, b, b.ink, b.bg); }); return boxes;
  }
  /* قراءة النصوص ومطابقتها بالصناديق؛ عند الفشل تُعاد الصناديق بنص بديل «نص». يعدّل boxes ويعيد {items, unmatched, note, hadOcr} */
  async function readInto(canvas, boxes) {
    const W = canvas.width, H = canvas.height, g = canvas.getContext("2d", { willReadFrequently: true }); let lines = null, note = "";
    try {
      lines = []; for (const [a, b] of strips(H, boxes, 1500)) {
        const part = document.createElement("canvas"); part.width = W; part.height = b - a; part.getContext("2d").drawImage(canvas, 0, a, W, b - a, 0, 0, W, b - a);
        (await ocr.read(part)).forEach(l => lines.push({ text: l.text, box: { x0: l.box.x0, x1: l.box.x1, y0: l.box.y0 + a, y1: l.box.y1 + a } }));
      }
    } catch (e) { console.warn("ocr", e); lines = null; note = e.message; }
    if (!lines || !lines.length) return { items: boxes.map(b => Object.assign(b, { text: "نص", placeholder: true })), unmatched: 0, note, hadOcr: false };
    /* القراءة هي المرجع: كل سطر مقروء صندوقه = حدود Gemini (± هامش) ممدودة أفقياً بما يغطيه الكشف بالصورة؛ الصناديق غير المقروءة تُهمل (ليست نصاً) */
    const items = [], used = new Set();
    lines.sort((p, q) => p.box.y0 - q.box.y0 || q.box.x1 - p.box.x1).forEach(l => {
      let x0 = l.box.x0, x1 = l.box.x1; const lh = l.box.y1 - l.box.y0;
      boxes.forEach((b, i) => { const ov = inter(l.box, b) / Math.min(area(l.box), area(b)); if (ov >= .25 && (b.y1 - b.y0) <= 1.7 * lh) { used.add(i); x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); } });
      const m = Math.max(3, Math.round(lh * .08)), bx = { x0: Math.max(0, x0 - m), x1: Math.min(W, x1 + m), y0: Math.max(0, l.box.y0 - m), y1: Math.min(H, l.box.y1 + m) }, c = ImageTools.inkColor(g, bx);
      Object.assign(bx, c, { text: l.text, core: ImageTools.coreBox(g, bx, c.ink, c.bg) }); items.push(bx);
    });
    return { items, unmatched: boxes.length - used.size, note, hadOcr: true };
  }
  async function scan(canvas, o) {
    o = o || {}; const step = o.onStep || (() => { }); step("detect"); const boxes = detect(canvas); await new Promise(r => setTimeout(r, 0));
    if (o.ocr === false) return { items: boxes, hadOcr: false, note: "", unmatched: 0 };
    step("ocr"); return readInto(canvas, boxes);
  }
  /* دمج الأسطر المتجاورة المتشابهة في فقرة واحدة */
  function paragraphs(items, W) {
    const out = []; items = items.slice().sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    for (const it of items) {
      const h = it.y1 - it.y0, cx = (it.x0 + it.x1) / 2; let hit = null;
      for (let i = out.length - 1; i >= 0 && i >= out.length - 6; i--) {
        const g = out[i], last = g.lines[g.lines.length - 1], lh = last.y1 - last.y0, gap = it.y0 - last.y1;
        const sameH = Math.abs(h - lh) <= .28 * Math.max(h, lh), near = gap >= -h * .2 && gap < .95 * Math.max(h, lh), lc = (last.x0 + last.x1) / 2;
        const aligned = Math.abs(cx - lc) < W * .06 || Math.abs(it.x0 - last.x0) < W * .03 || Math.abs(it.x1 - last.x1) < W * .03;
        if (sameH && near && aligned && colorDist(it.ink, last.ink) < 100) { hit = g; break; }
      }
      if (hit) hit.lines.push(it); else out.push({ lines: [it] });
    }
    return out;
  }
  /* مسح النصوص المحدّدة من القماش (تعديل في المكان)؛ يعيد نتيجة كل صندوق (skipped = بقي لأن خلفيته صورة معقدة) */
  function erase(canvas, items) {
    return ImageTools.eraseRects(canvas.getContext("2d", { willReadFrequently: true }), items.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })), { skipComplex: true });
  }
  return { ocr, detect, readInto, scan, paragraphs, erase, colorDist };
})();
