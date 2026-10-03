/* قراءة النصوص (مرحلة التفكيك فقط — ليست جزءاً من التحرير). Gemini إن وُجد مفتاح (الأدق بالعربية)، وإلا Tesseract من CDN.
   المفتاح يبقى في متصفحك (localStorage) ويُرسل مباشرة إلى Google؛ في نسخة PHP يُفضَّل تمريره عبر /api/ لاحقاً. */
(function () {
  const Ed = window.Ed;
  const KEYNAME = "alyssum_gp_gkey";                 // نفس مفتاح لوحة التحكم (المخزَّن في هذا المتصفح)
  Ed.ocr = {
    key() { try { return (localStorage.getItem(KEYNAME) || "").replace(/[\s"']/g, ""); } catch (e) { return ""; } },
    setKey(k) { try { localStorage.setItem(KEYNAME, k); } catch (e) { } },
    /* يعيد [{text, box:{x0,y0,x1,y1}}] بإحداثيات القماش المُعطى، أو يرمي خطأ */
    async read(canvas, o) {
      o = o || {}; const k = this.key(); if (k) return this.gemini(canvas, k, o); return this.tesseract(canvas, o);
    },
    async gemini(canvas, key, o) {
      const W = canvas.width, H = canvas.height, sc = Math.min(1, 1600 / W), c2 = document.createElement("canvas"); c2.width = Math.round(W * sc); c2.height = Math.round(H * sc); c2.getContext("2d").drawImage(canvas, 0, 0, c2.width, c2.height);
      const b64 = c2.toDataURL("image/jpeg", .9).split(",")[1];
      const prompt = "You are a precise OCR engine. Read EVERY visible line of text in this image exactly as written (keep the original script, digits, emojis and punctuation; never translate or correct). Return ONLY JSON: {\"lines\":[{\"text\":\"...\",\"box_2d\":[ymin,xmin,ymax,xmax]}]} with box_2d normalized to 0-1000 and tightly around the text of ONE visual line. Reading order top to bottom. Do not invent text.";
      const models = o.models || ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]; let last = "";
      for (const m of models) for (let t = 0; t < 2; t++) {
        let r; try { r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) }); } catch (e) { throw new Error("تعذّر الاتصال بـ Google (الإنترنت؟)"); }
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          const txt = (((j.candidates || [])[0] || {}).content || {}).parts; const raw = (txt || []).map(x => x.text || "").join(""); let p; try { p = JSON.parse(raw.replace(/^```json|```$/g, "").trim()); } catch (e) { last = "رد غير مفهوم من Gemini"; continue; }
          return (p.lines || []).filter(l => l && l.text && Array.isArray(l.box_2d) && l.box_2d.length === 4).map(l => { const [y0, x0, y1, x1] = l.box_2d.map(Number); return { text: String(l.text).replace(/\s+/g, " ").trim(), box: { x0: x0 / 1000 * W, x1: x1 / 1000 * W, y0: y0 / 1000 * H, y1: y1 / 1000 * H } }; });
        }
        const msg = (j.error && j.error.message) || ("HTTP " + r.status); last = r.status + ": " + msg;
        if (r.status === 400 && /API key/i.test(msg) || r.status === 403) throw new Error("مفتاح Gemini غير صالح أو غير مسموح: " + msg.slice(0, 120));
        if (r.status === 404) break;                                               // النموذج غير متاح: جرّب التالي
        if ([429, 500, 503].includes(r.status)) await new Promise(res => setTimeout(res, 1500 * (t + 1)));
      }
      throw new Error("فشلت قراءة Gemini — " + last.slice(0, 160));
    },
    async tesseract(canvas, o) {
      if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; s.onload = res; s.onerror = () => rej(new Error("تعذّر تحميل Tesseract (الإنترنت؟)")); document.head.appendChild(s); });
      const r = await Tesseract.recognize(canvas, "ara+eng"), lines = r.data.lines || ((r.data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || [])));
      return lines.map(l => ({ text: String(l.text || "").replace(/\s+/g, " ").trim(), conf: l.confidence, box: { x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1 } })).filter(l => l.text.length >= 2 && l.conf >= 40);
    }
  };
})();
