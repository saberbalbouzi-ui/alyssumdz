/* التفكيك: صورة مسطحة ← (تحليل + OCR + مسح النص من الخلفية) ← JSON وصفي ← طبقات قابلة للتحرير.
   هذه المرحلة الوحيدة التي قد تستعمل خدمة خارجية (قراءة النص)؛ بعدها يعمل المحرر محلياً بالكامل.
   لا تُمسّ الصورة الأصلية قبل نجاح كل الخطوات: عند أي فشل يبقى التصميم كما هو ويمكن إعادة المحاولة. */
(function () {
  const Ed = window.Ed; const STEPS = ["تحليل الصورة…", "كشف النصوص…", "قراءة النصوص…", "تنظيف الخلفية…", "إنشاء الطبقات…"];
  const FSK = { ar: 1.15, lat: .74 };      // نسبة ارتفاع حبر السطر إلى حجم الخط (تقريب لخط Cairo)
  const ARABIC = /[؀-ۿ]/, esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function srcCanvas(img) { const w = img.width, h = img.height, c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d", { willReadFrequently: true }).drawImage(img.getElement(), img.cropX || 0, img.cropY || 0, w, h, 0, 0, w, h); return c; }
  /* شرائح للقراءة: تُقطع في فراغات بين الأسطر حتى لا يُشطر سطر */
  function strips(H, boxes, target) {
    const out = []; let y = 0;
    while (y < H) {
      let end = Math.min(H, y + target); if (end < H) {
        let best = null; const ys = boxes.map(b => [b.y0, b.y1]).sort((p, q) => p[0] - q[0]); let prev = y;
        for (const [a, b] of ys) { if (a > prev && prev > y + target * .5 && prev < y + target * 1.25) { if (!best || a - prev > best.gap) best = { gap: a - prev, at: (a + prev) / 2 }; } prev = Math.max(prev, b); }
        if (best) end = Math.min(H, Math.round(best.at));
      }
      out.push([y, end]); y = end;
    }
    return out;
  }
  const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = a => Math.max(1, (a.x1 - a.x0) * (a.y1 - a.y0));

  Ed.decomp = {
    /* التحليل: يعيد JSON وصفياً + قماش الخلفية النظيفة (لا يغيّر المستند) */
    async analyze(img, log) {
      const ready = n => log && log(n); ready(0);
      if (Math.abs(img.angle || 0) > .01 || img.flipX || img.flipY) throw new Error("أعد ضبط الصورة بدون تدوير/قلب قبل التفكيك");
      const src = srcCanvas(img), W = src.width, H = src.height, sx = src.getContext("2d", { willReadFrequently: true }); await new Promise(r => setTimeout(r, 30));
      ready(1); const boxes = Ed.detect.texts(src); await new Promise(r => setTimeout(r, 30));
      boxes.forEach(b => { Object.assign(b, ImageTools.inkColor(sx, b)); b.core = ImageTools.coreBox(sx, b, b.ink, b.bg); });                                  // ألوان الحبر قبل أي مسح
      ready(2); let lines = null, ocrNote = "";
      try {
        lines = []; for (const [a, b] of strips(H, boxes, 1500)) {
          const part = document.createElement("canvas"); part.width = W; part.height = b - a; part.getContext("2d").drawImage(src, 0, a, W, b - a, 0, 0, W, b - a);
          (await Ed.ocr.read(part)).forEach(l => lines.push({ text: l.text, box: { x0: l.box.x0, x1: l.box.x1, y0: l.box.y0 + a, y1: l.box.y1 + a } }));
        }
      } catch (e) { console.warn("ocr", e); lines = null; ocrNote = e.message; }
      /* مطابقة أسطر القراءة بصناديق الكشف */
      let items = [], unmatched = 0; const extra = [];
      if (lines && lines.length) {
        boxes.forEach(b => b.lines = []); lines.forEach(l => { let best = null, bi = 0; boxes.forEach(b => { const i = inter(l.box, b); if (i > bi) { bi = i; best = b; } }); if (best && bi / area(l.box) >= .25) best.lines.push(l); else extra.push(l); });
        boxes.forEach(b => { if (b.lines.length) { b.lines.sort((p, q) => p.box.y0 - q.box.y0 || q.box.x1 - p.box.x1); b.text = b.lines.map(l => l.text).join("\n"); items.push(b); } });
        extra.forEach(l => { const bx = { x0: Math.max(0, l.box.x0 - 4), y0: Math.max(0, l.box.y0 - 4), x1: Math.min(W, l.box.x1 + 4), y1: Math.min(H, l.box.y1 + 4) }, c = ImageTools.inkColor(sx, bx); Object.assign(bx, c, { text: l.text, core: ImageTools.coreBox(sx, bx, c.ink, c.bg) }); items.push(bx); });      // أسطر قصيرة فاتت الكشف: نأخذ صندوق القراءة
      } else items = boxes.map(b => Object.assign(b, { text: "نص", placeholder: true }));
      ready(3); await new Promise(r => setTimeout(r, 30));
      const clean = document.createElement("canvas"); clean.width = W; clean.height = H; const cg = clean.getContext("2d", { willReadFrequently: true }); cg.drawImage(src, 0, 0);
      await ImageTools.eraseRects(cg, items.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })), { skipComplex: true });
      /* فقرات + أحجام + أدوار */
      const paras = Ed.detect.paragraphs(items, W).map((g, i) => {
        const L = g.lines, C = l => l.core || l, x0 = Math.min(...L.map(l => C(l).x0)), x1 = Math.max(...L.map(l => C(l).x1)), y0 = Math.min(...L.map(l => C(l).y0)), y1 = Math.max(...L.map(l => C(l).y1)), text = L.map(l => l.text).join("\n"), rtl = ARABIC.test(text);
        const lh = L.reduce((a, l) => a + (C(l).y1 - C(l).y0), 0) / L.length, fs = lh / (rtl ? FSK.ar : FSK.lat), pitch = L.length > 1 ? (C(L[L.length - 1]).y0 - C(L[0]).y0) / (L.length - 1) : fs * 1.3;
        return { id: "text_" + String(i + 1).padStart(3, "0"), type: "text", text, rtl, fontSize: fs, lineHeight: Math.max(.9, Math.min(2, pitch / fs)), color: L[0].ink, placeholder: !!L[0].placeholder, bbox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } };
      });
      const sizes = paras.map(p => p.fontSize).sort((a, b) => a - b), med = sizes[sizes.length >> 1] || 1;
      paras.forEach(p => { p.role = /اطلب|order|commander|buy/i.test(p.text) ? "cta" : /\d+\s*(دج|DA|DZD|دينار)/i.test(p.text) ? "price" : p.fontSize >= 1.35 * med ? "headline" : p.fontSize >= 1.1 * med ? "subtitle" : /^[✔✓✅❌•]/.test(p.text.trim()) ? "list" : "body"; });
      return { json: { canvas: { width: W, height: H }, elements: paras, stats: { detected: boxes.length, read: items.length, unmatchedOcr: unmatched, ocrNote } }, clean, ocrNote };
    },
    /* التطبيق على المستند: خلفية نظيفة + طبقات نص، ويُخفى الأصل ويُقفل (للأمان) */
    apply(img, res) {
      const j = res.json, kx = img.getScaledWidth() / j.canvas.width, ky = img.getScaledHeight() / j.canvas.height, L0 = img.left - img.getScaledWidth() / 2, T0 = img.top - img.getScaledHeight() / 2, W = j.canvas.width;
      const url = res.clean.toDataURL("image/webp", .95), id = Ed.registerAsset(url, res.clean.width, res.clean.height, "خلفية-نظيفة");
      const bg = new fabric.Image(res.clean, { left: img.left, top: img.top, scaleX: img.scaleX, scaleY: img.scaleY, assetId: id, layerType: "image", role: "background", name: "خلفية نظيفة (بدون نصوص)" });
      const idx = Ed.c.getObjects().indexOf(img); Ed.c.add(bg); bg.moveTo(idx + 1); img.name = "الأصل (مخفي)"; img.visible = false; Ed.applyLock(img, true);
      const sel = []; j.elements.forEach(e => {
        const w = (e.bbox.width * 1.06 + 12) * kx, cxm = e.bbox.x + e.bbox.width / 2, centered = Math.abs(cxm - W / 2) < W * .08, align = centered ? "center" : (cxm > W / 2 ? "right" : "left");
        const cx = centered ? L0 + cxm * kx : (align === "right" ? L0 + (e.bbox.x + e.bbox.width) * kx - w / 2 + 6 * kx : L0 + e.bbox.x * kx + w / 2 - 6 * kx), cy = T0 + (e.bbox.y + e.bbox.height / 2) * ky;
        let fs = Math.max(8, e.fontSize * ky); { const target = e.bbox.width * kx, wide = Math.max(...e.text.split("\n").map(ln => new fabric.Text(ln, { fontFamily: "Cairo", fontSize: fs, fontWeight: e.fontSize > 40 ? "800" : "700" }).width)); if (wide > 0 && target > 0) fs = Math.max(fs * .75, Math.min(fs * 1.25, fs * target / wide)); }      // يطابق عرض النص الأصلي (الخط يختلف) فلا يلتف السطر
        const t = new fabric.Textbox(e.text, { left: cx, top: cy, width: w, fontFamily: "Cairo", fontSize: fs, fontWeight: e.fontSize > 40 ? "800" : "700", fill: e.color, textAlign: align, direction: e.rtl ? "rtl" : "ltr", lineHeight: e.lineHeight, layerType: "text", role: e.role, id: e.id });
        t.name = ({ headline: "عنوان", subtitle: "عنوان فرعي", body: "نص", cta: "زر/دعوة", price: "السعر", list: "نقطة" })[e.role] + ": " + e.text.replace(/\s+/g, " ").slice(0, 18) + (e.placeholder ? " (اكتب النص)" : ""); Ed.c.add(t); sel.push(t);
      });
      Ed.c.discardActiveObject(); Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "decompose"); return { texts: sel.length };
    },
    /* واجهة: نافذة تقدّم + معالجة أخطاء + إعادة محاولة */
    async runUI() {
      const img = (() => { const a = Ed.selected(); if (a && a.type === "image") return a; const imgs = Ed.c.getObjects().filter(o => o.type === "image" && o.visible !== false); return imgs.sort((p, q) => q.getScaledWidth() * q.getScaledHeight() - p.getScaledWidth() * p.getScaledHeight())[0]; })();
      if (!img) return Ed.toast("أضف صورة التصميم أولاً ثم اضغط تفكيك");
      if (!Ed.ocr.key()) {
        const a = await Ed.promptDialog("قراءة النصوص بدقة", "مفتاح Gemini (اختياري)", "", { password: true, note: "بدون مفتاح تُستعمل قراءة Tesseract المجانية وهي ضعيفة بالعربية، وإن تعذّرت تُوضع نصوص بديلة تكتبها أنت. المفتاح يبقى في هذا المتصفح فقط." });
        if (a === null) return; if (a.value.trim()) Ed.ocr.setKey(a.value.trim());
      }
      const m = Ed.modal("<h3>✨ تفكيك التصميم</h3><div id='dc-steps'>" + STEPS.map((s, i) => "<div class='dcs' data-i='" + i + "' style='padding:.25rem 0;color:#9ca3af'>○ " + s + "</div>").join("") + "</div><div id='dc-msg' class='muted' style='margin-top:.5rem'></div><div class='acts' id='dc-acts' style='display:none'></div>");
      const mark = i => m.querySelectorAll(".dcs").forEach(e => { const k = +e.dataset.i; e.style.color = k < i ? "#16a34a" : k === i ? "#111827" : "#9ca3af"; e.textContent = (k < i ? "✓ " : k === i ? "⏳ " : "○ ") + STEPS[k]; });
      const acts = m.querySelector("#dc-acts"), say = t => { m.querySelector("#dc-msg").innerHTML = t; };
      try {
        await Ed.loadFont("Cairo"); const res = await this.analyze(img, mark); mark(4); const r = this.apply(img, res); mark(5);
        const st = res.json.stats; say("تم: <b>" + r.texts + "</b> نصاً صار طبقة قابلة للتعديل" + (res.json.elements.some(e => e.placeholder) ? "<br>⚠️ لم تُقرأ النصوص (" + esc(res.ocrNote || "بلا قراءة") + ") فوُضع نص بديل «نص» فوق كل سطر: انقر مرتين واكتب النص الصحيح." : "") + (st.unmatchedOcr ? "<br>ℹ️ " + st.unmatchedOcr + " سطراً مقروءاً لم يُطابق نصاً مكتشفاً (بقي في الخلفية)." : "") + "<br><span class='muted'>الأصل محفوظ مخفياً في الطبقات. للتراجع: Ctrl+Z.</span>");
        acts.style.display = "flex"; acts.innerHTML = "<button class='pri'>تمام</button>"; acts.firstChild.onclick = () => m.remove();
      } catch (e) {
        console.error(e); say("<span style='color:#b91c1c'>⚠️ تعذّر التفكيك: " + esc(e.message) + "</span><br>لم يتغير تصميمك.");
        acts.style.display = "flex"; acts.innerHTML = "<button data-x>إغلاق</button><button class='pri' data-r>إعادة المحاولة</button>";
        acts.querySelector("[data-x]").onclick = () => m.remove(); acts.querySelector("[data-r]").onclick = () => { m.remove(); Ed.decomp.runUI(); };
      }
    }
  };
})();
