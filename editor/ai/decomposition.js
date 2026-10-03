/* التفكيك: صورة مسطحة ← (تحليل + OCR + مسح النص من الخلفية) ← JSON وصفي ← طبقات قابلة للتحرير.
   هذه المرحلة الوحيدة التي قد تستعمل خدمة خارجية (قراءة النص)؛ بعدها يعمل المحرر محلياً بالكامل.
   لا تُمسّ الصورة الأصلية قبل نجاح كل الخطوات: عند أي فشل يبقى التصميم كما هو ويمكن إعادة المحاولة. */
(function () {
  const Ed = window.Ed; const STEPS = ["تحليل الصورة…", "كشف النصوص…", "قراءة النصوص…", "مسح النصوص من الخلفية…", "كشف العناصر (منتجات، صور، أيقونات، زخارف)…", "استخراج العناصر بشفافية…", "إنشاء الطبقات…"];
  const FSK = { ar: 1.15, lat: .74 };      // نسبة ارتفاع حبر السطر إلى حجم الخط (تقريب لخط Cairo)
  const ARABIC = /[؀-ۿ]/, esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function srcCanvas(img) { const w = img.width, h = img.height, c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d", { willReadFrequently: true }).drawImage(img.getElement(), img.cropX || 0, img.cropY || 0, w, h, 0, 0, w, h); return c; }
  Ed.decomp = {
    /* التحليل: يعيد JSON وصفياً + قماش الخلفية النظيفة (لا يغيّر المستند) */
    async analyze(img, log) {
      const ready = n => log && log(n); ready(0);
      if (Math.abs(img.angle || 0) > .01 || img.flipX || img.flipY) throw new Error("أعد ضبط الصورة بدون تدوير/قلب قبل التفكيك");
      const src = srcCanvas(img), W = src.width, H = src.height, sx = src.getContext("2d", { willReadFrequently: true }); await new Promise(r => setTimeout(r, 30));
      const sc = await TextCapture.scan(src, { onStep: st => ready(st === "detect" ? 1 : 2) }), items = sc.items, unmatched = sc.unmatched, ocrNote = sc.note, boxes = items;
      ready(3); await new Promise(r => setTimeout(r, 30));
      const clean = document.createElement("canvas"); clean.width = W; clean.height = H; const cg = clean.getContext("2d", { willReadFrequently: true }); cg.drawImage(src, 0, 0);
      await ImageTools.eraseRects(cg, items.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })), { skipComplex: true });
      /* العناصر: تُكشف على الخلفية الخالية من النص، تُقصّ بشفافية، ثم تُمسح من الخلفية */
      ready(4); await new Promise(r => setTimeout(r, 30)); let objects = [], objNote = "";
      try {
        const F = ImageTools.findObjects(clean); ready(5); await new Promise(r => setTimeout(r, 30));
        const cuts = F.objects.map(o => ({ o, cut: ImageTools.cutObject(F, o) }));
        for (const { o, cut } of cuts) ImageTools.eraseObject(cg, o, cut, 5, F);
        objects = cuts.map(({ o, cut }, i) => {
          const w = o.x1 - o.x0, h = o.y1 - o.y0, fill = cut.filled / (w * h), icon = Math.max(w, h) < W * .12;
          return { id: "image_" + String(i + 1).padStart(3, "0"), type: "image", role: icon ? "icon" : (fill > .85 ? "photo" : "object"), bbox: { x: cut.x0, y: cut.y0, width: cut.w, height: cut.h }, canvas: cut.canvas };
        }).sort((p, q) => q.bbox.width * q.bbox.height - p.bbox.width * p.bbox.height);
      } catch (e) { console.warn("objects", e); objNote = e.message; }
      /* فقرات + أحجام + أدوار */
      const paras = Ed.detect.paragraphs(items, W).map((g, i) => {
        const L = g.lines, C = l => l.core || l, x0 = Math.min(...L.map(l => C(l).x0)), x1 = Math.max(...L.map(l => C(l).x1)), y0 = Math.min(...L.map(l => C(l).y0)), y1 = Math.max(...L.map(l => C(l).y1)), text = L.map(l => l.text).join("\n"), rtl = ARABIC.test(text);
        const lh = L.reduce((a, l) => a + (C(l).y1 - C(l).y0), 0) / L.length, fs = lh / (rtl ? FSK.ar : FSK.lat), pitch = L.length > 1 ? (C(L[L.length - 1]).y0 - C(L[0]).y0) / (L.length - 1) : fs * 1.3;
        return { id: "text_" + String(i + 1).padStart(3, "0"), type: "text", text, rtl, fontSize: fs, lineHeight: Math.max(.9, Math.min(2, pitch / fs)), color: L[0].ink, placeholder: !!L[0].placeholder, bbox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } };
      });
      const sizes = paras.map(p => p.fontSize).sort((a, b) => a - b), med = sizes[sizes.length >> 1] || 1;
      paras.forEach(p => { p.role = /اطلب|order|commander|buy/i.test(p.text) ? "cta" : /\d+\s*(دج|DA|DZD|دينار)/i.test(p.text) ? "price" : p.fontSize >= 1.35 * med ? "headline" : p.fontSize >= 1.1 * med ? "subtitle" : /^[✔✓✅❌•]/.test(p.text.trim()) ? "list" : "body"; });
      return { json: { canvas: { width: W, height: H }, elements: objects.map(o => ({ id: o.id, type: o.type, role: o.role, bbox: o.bbox })).concat(paras), stats: { detected: boxes.length, read: items.length, unmatchedOcr: unmatched, ocrNote, objects: objects.length, objNote } }, clean, ocrNote, objects };
    },
    /* التطبيق على المستند: خلفية نظيفة + طبقات نص، ويُخفى الأصل ويُقفل (للأمان) */
    apply(img, res) {
      const j = res.json, kx = img.getScaledWidth() / j.canvas.width, ky = img.getScaledHeight() / j.canvas.height, L0 = img.left - img.getScaledWidth() / 2, T0 = img.top - img.getScaledHeight() / 2, W = j.canvas.width;
      const url = res.clean.toDataURL("image/webp", .95), id = Ed.registerAsset(url, res.clean.width, res.clean.height, "خلفية-نظيفة");
      const bg = new fabric.Image(res.clean, { left: img.left, top: img.top, scaleX: img.scaleX, scaleY: img.scaleY, assetId: id, layerType: "image", role: "background", name: "خلفية نظيفة (بدون نصوص)" });
      const idx = Ed.c.getObjects().indexOf(img); Ed.c.add(bg); bg.moveTo(idx + 1); img.name = "الأصل (مخفي)"; img.visible = false; Ed.applyLock(img, true);
      let z = idx + 2; const names = { icon: "أيقونة", photo: "صورة", object: "عنصر" }; let ni = 0;
      (res.objects || []).forEach(o => {
        const oid = Ed.registerAsset(o.canvas.toDataURL("image/webp", .92), o.canvas.width, o.canvas.height, o.id), kx2 = img.scaleX, ky2 = img.scaleY;
        const im = new fabric.Image(o.canvas, { left: L0 + (o.bbox.x + o.bbox.width / 2) * kx, top: T0 + (o.bbox.y + o.bbox.height / 2) * ky, scaleX: kx2, scaleY: ky2, assetId: oid, layerType: o.role === "icon" ? "icon" : "image", role: o.role, id: o.id, name: names[o.role] + " " + (++ni) });
        Ed.c.add(im); im.moveTo(z++);
      });
      const sel = []; j.elements.filter(e => e.type === "text").forEach(e => {
        const w = (e.bbox.width * 1.06 + 12) * kx, cxm = e.bbox.x + e.bbox.width / 2, centered = Math.abs(cxm - W / 2) < W * .08, align = centered ? "center" : (cxm > W / 2 ? "right" : "left");
        const cx = centered ? L0 + cxm * kx : (align === "right" ? L0 + (e.bbox.x + e.bbox.width) * kx - w / 2 + 6 * kx : L0 + e.bbox.x * kx + w / 2 - 6 * kx), cy = T0 + (e.bbox.y + e.bbox.height / 2) * ky;
        let fs = Math.max(8, e.fontSize * ky); { const target = e.bbox.width * kx, wide = Math.max(...e.text.split("\n").map(ln => new fabric.Text(ln, { fontFamily: "Cairo", fontSize: fs, fontWeight: e.fontSize > 40 ? "800" : "700" }).width)); if (wide > 0 && target > 0) fs = Math.max(fs * .75, Math.min(fs * 1.25, fs * target / wide)); }      // يطابق عرض النص الأصلي (الخط يختلف) فلا يلتف السطر
        const t = new fabric.Textbox(e.text, { left: cx, top: cy, width: w, fontFamily: "Cairo", fontSize: fs, fontWeight: e.fontSize > 40 ? "800" : "700", fill: e.color, textAlign: align, direction: e.rtl ? "rtl" : "ltr", lineHeight: e.lineHeight, layerType: "text", role: e.role, id: e.id });
        t.name = ({ headline: "عنوان", subtitle: "عنوان فرعي", body: "نص", cta: "زر/دعوة", price: "السعر", list: "نقطة" })[e.role] + ": " + e.text.replace(/\s+/g, " ").slice(0, 18) + (e.placeholder ? " (اكتب النص)" : ""); Ed.c.add(t); sel.push(t);
      });
      Ed.c.discardActiveObject(); Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "decompose"); return { texts: sel.length, objects: (res.objects || []).length };
    },
    /* واجهة: نافذة تقدّم + معالجة أخطاء + إعادة محاولة */
    /* واجهة: نافذة تقدّم + معالجة أخطاء + إعادة محاولة. تعالج الصورة المحدّدة، أو كل أقسام الصور غير المفكَّكة (صور الاستيراد من المولّد) */
    async runUI() {
      const sel = Ed.selected(); let targets = sel && sel.type === "image" ? [sel] : Ed.c.getObjects().filter(o => o.type === "image" && o.visible !== false && !o.role);
      targets = targets.filter(o => o.visible !== false); if (!targets.length) return Ed.toast("أضف صورة التصميم أولاً ثم اضغط المسح الذكي");
      targets.sort((p, q) => p.top - q.top);
      if (!Ed.ocr.key()) {
        const a = await Ed.promptDialog("المسح الذكي — قراءة النصوص", "مفتاح Gemini (اختياري)", "", { password: true, note: "بدون مفتاح تُستعمل قراءة Tesseract المجانية وهي ضعيفة بالعربية، وإن تعذّرت تُوضع نصوص بديلة تكتبها أنت. المفتاح يبقى في هذا المتصفح فقط." });
        if (a === null) return; if (a.value.trim()) Ed.ocr.setKey(a.value.trim());
      }
      const m = Ed.modal("<h3>🪄 المسح الذكي</h3><div id='dc-sec' class='muted'></div><div id='dc-steps'>" + STEPS.map((s, i) => "<div class='dcs' data-i='" + i + "' style='padding:.25rem 0;color:#9ca3af'>○ " + s + "</div>").join("") + "</div><div id='dc-msg' class='muted' style='margin-top:.5rem'></div><div class='acts' id='dc-acts' style='display:none'></div>");
      const mark = i => m.querySelectorAll(".dcs").forEach(e => { const k = +e.dataset.i; e.style.color = k < i ? "#16a34a" : k === i ? "#111827" : "#9ca3af"; e.textContent = (k < i ? "✓ " : k === i ? "⏳ " : "○ ") + STEPS[k]; });
      const acts = m.querySelector("#dc-acts"), say = t => { m.querySelector("#dc-msg").innerHTML = t; };
      await Ed.loadFont("Cairo"); let tot = { texts: 0, objects: 0 }, fails = [], placeholders = false, notes = [];
      for (let i = 0; i < targets.length; i++) {
        m.querySelector("#dc-sec").textContent = targets.length > 1 ? "القسم " + (i + 1) + " من " + targets.length : ""; mark(0);
        try { const res = await this.analyze(targets[i], mark); mark(6); const r = this.apply(targets[i], res); tot.texts += r.texts; tot.objects += r.objects; if (res.json.elements.some(e => e.placeholder)) { placeholders = true; if (res.ocrNote) notes.push(res.ocrNote); } if (res.json.stats.objNote) notes.push(res.json.stats.objNote); }
        catch (e) { console.error(e); fails.push((targets.length > 1 ? "القسم " + (i + 1) + ": " : "") + e.message); }
      }
      mark(7);
      if (fails.length === targets.length) {
        say("<span style='color:#b91c1c'>⚠️ تعذّر المسح الذكي: " + esc(fails[0]) + "</span><br>لم يتغير تصميمك.");
        acts.style.display = "flex"; acts.innerHTML = "<button data-x>إغلاق</button><button class='pri' data-r>إعادة المحاولة</button>";
        acts.querySelector("[data-x]").onclick = () => m.remove(); acts.querySelector("[data-r]").onclick = () => { m.remove(); Ed.decomp.runUI(); }; return;
      }
      say("تم: <b>" + tot.objects + "</b> عنصراً مستقلاً (منتجات/أعشاب/أشكال بظلالها) و<b>" + tot.texts + "</b> نصاً قابلاً للتعديل، والخلفية باقية." + (placeholders ? "<br>⚠️ لم تُقرأ بعض النصوص (" + esc([...new Set(notes)].join("؛ ") || "بلا قراءة") + ") فوُضع نص بديل «نص»: انقر مرتين واكتب الصحيح." : "") + (fails.length ? "<br>⚠️ تعذّر: " + esc(fails.join(" · ")) : "") + "<br><span class='muted'>الأصل محفوظ مخفياً في الطبقات. Ctrl+Z للتراجع. ما فاتك: استعمل أدوات التحديد اليدوي (فرشاة/لاسو).</span>");
      acts.style.display = "flex"; acts.innerHTML = "<button class='pri'>تمام</button>"; acts.firstChild.onclick = () => m.remove();
    }
  };
})();
