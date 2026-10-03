/* لوحة الخصائص: كل التعديلات محلية فورية على كائن Fabric (لا شبكة). */
(function () {
  const Ed = window.Ed; let el, crop = null;
  const O = () => (Ed.c ? Ed.c.getActiveObject() : null);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (l, k, v, a) => '<label class="fld">' + l + '<input type="number" data-k="' + k + '" value="' + v + '" ' + (a || "") + "></label>";
  const col = (l, k, v) => '<label class="fld">' + l + '<input type="color" data-k="' + k + '" value="' + hex(v) + '"></label>';
  function hex(c) { if (typeof c !== "string") return "#000000"; if (/^#[0-9a-f]{6}$/i.test(c)) return c; if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + c.slice(1).split("").map(x => x + x).join(""); const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? "#" + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, "0")).join("") : "#000000"; }
  const R = n => Math.round(n * 100) / 100;
  const geo = o => { const w = o.getScaledWidth(), h = o.getScaledHeight(); return { x: R(o.left - w / 2), y: R(o.top - h / 2), w: R(w), h: R(h), rot: R(o.angle || 0) }; };
  const btn = (a, t, cls) => '<button data-a="' + a + '" class="' + (cls || "") + '">' + t + "</button>";

  function build() {
    if (!el) return; const o = O();
    if (crop) { el.innerHTML = '<div class="ptitle">قص الصورة</div><p class="muted">حرّك المستطيل المنقّط وغيّر حجمه ثم اضغط تطبيق.</p><div class="row">' + btn("cropOk", "✔ تطبيق", "pri") + btn("cropNo", "إلغاء") + "</div>"; return; }
    if (!o) { el.innerHTML = '<div class="ptitle">المستند</div><div class="pgrid">' + num("العرض", "docW", Ed.doc.width, 'min="100" max="12000"') + num("الارتفاع", "docH", Ed.doc.height, 'min="100" max="24000"') + "</div>" + col("لون الخلفية", "docBg", Ed.doc.bg) + '<p class="muted">اختر عنصراً لتعديله، أو أضف من الأدوات اليمنى.</p>'; return; }
    if (o.type === "activeSelection") { el.innerHTML = '<div class="ptitle">' + o.size() + ' عناصر محدّدة</div><div class="row">' + btn("group", "تجميع") + btn("dup", "تكرار") + btn("del", "حذف") + "</div>"; return; }
    const g = geo(o), t = o.layerType, isTxt = o.type === "textbox", isImg = o.type === "image", isBtn = t === "button", isShape = t === "shape" || t === "icon";
    let h = '<div class="ptitle">' + esc(o.name) + "</div>";
    if (o.locked) { el.innerHTML = h + '<p class="muted">🔒 الطبقة مقفلة — افتح القفل من لوحة الطبقات.</p>'; return; }
    h += '<div class="pgrid c3">' + num("X", "x", g.x) + num("Y", "y", g.y) + num("تدوير°", "rot", g.rot) + num("العرض", "w", g.w, 'min="1"') + (isTxt ? '<label class="fld">الارتفاع<input disabled value="' + g.h + '"></label>' : num("الارتفاع", "h", g.h, 'min="1"')) + num("الشفافية%", "op", Math.round((o.opacity == null ? 1 : o.opacity) * 100), 'min="0" max="100"') + "</div>";
    if (isTxt) {
      h += '<div class="ptitle">النص</div><label class="fld">المحتوى<textarea data-k="text" rows="3">' + esc(o.text) + "</textarea></label>";
      h += '<div class="pgrid"><label class="fld">الخط<select data-k="font">' + Ed.FONTS.map(f => "<option" + (o.fontFamily === f ? " selected" : "") + ">" + f + "</option>").join("") + '</select></label>' + num("الحجم", "size", Math.round(o.fontSize), 'min="4" max="600"') +
        '<label class="fld">السماكة<select data-k="weight">' + ["400", "500", "700", "800", "900"].map(w => '<option value="' + w + '"' + (String(o.fontWeight) === w ? " selected" : "") + ">" + w + "</option>").join("") + "</select></label>" + col("اللون", "color", o.fill) +
        num("ارتفاع السطر", "lh", R(o.lineHeight), 'step="0.05" min="0.5" max="4"') + num("تباعد الأحرف", "ls", o.charSpacing || 0, 'step="10"') + "</div>";
      h += '<div class="row seg" style="margin:.3rem 0">' + ["right", "center", "left", "justify"].map(a => '<button data-a="align" data-v="' + a + '" class="' + (o.textAlign === a ? "on" : "") + '">' + ({ right: "يمين", center: "وسط", left: "يسار", justify: "ضبط" })[a] + "</button>").join("") + "</div>";
      h += '<div class="row seg">' + btn("italic", "<i>مائل</i>", o.fontStyle === "italic" ? "on" : "") + btn("underline", "<u>تسطير</u>", o.underline ? "on" : "") + btn("dir", o.direction === "rtl" ? "RTL ⇄" : "LTR ⇄") + "</div>";
    }
    if (isBtn) { const [r, tx] = o.getObjects(); h += '<div class="ptitle">الزر</div><label class="fld">النص<input data-k="bLabel" value="' + esc(tx.text) + '"></label><div class="pgrid">' + col("لون الزر", "bFill", r.fill) + col("لون النص", "bColor", tx.fill) + num("استدارة", "bRad", r.rx || 0, 'min="0"') + num("حجم الخط", "bSize", Math.round(tx.fontSize), 'min="6"') + "</div>"; }
    if (isImg) h += '<div class="ptitle">الصورة</div><div class="row">' + btn("replace", "استبدال") + btn("crop", "قص") + btn("uncrop", "إلغاء القص") + btn("flipX", "قلب أفقي") + btn("flipY", "قلب رأسي") + "</div>";
    if (isShape) { h += '<div class="ptitle">الشكل</div><div class="pgrid">' + col("التعبئة", "fill", o.fill || "#000000") + col("الحد", "stroke", o.stroke || "#000000") + num("سماكة الحد", "sw", o.strokeWidth || 0, 'min="0"') + (o.type === "rect" ? num("استدارة", "rad", o.rx || 0, 'min="0"') : "") + "</div>"; if (o.type !== "line") h += '<div class="row">' + btn("flipX", "قلب أفقي") + btn("flipY", "قلب رأسي") + "</div>"; }
    h += '<div class="ptitle">محاذاة للصفحة</div><div class="row">' + [["left", "⇤"], ["center", "↔"], ["right", "⇥"], ["top", "⤒"], ["middle", "↕"], ["bottom", "⤓"]].map(([k, i]) => '<button data-a="alignP" data-v="' + k + '" title="' + k + '">' + i + "</button>").join("") + "</div>";
    h += '<div class="ptitle">الترتيب</div><div class="row">' + btn("front", "للأمام ⤒") + btn("fwd", "أمام ↑") + btn("bwd", "خلف ↓") + btn("back", "للخلف ⤓") + "</div>";
    h += '<div class="row" style="margin-top:.5rem">' + btn("dup", "تكرار") + btn("del", "حذف") + (o.type === "group" && !isBtn ? btn("ungroup", "فك التجميع") : "") + "</div>";
    el.innerHTML = h;
  }
  function refreshNums() {
    const o = O(); if (!o || !el || crop || o.type === "activeSelection") return; const g = geo(o);
    ["x", "y", "w", "h", "rot"].forEach(k => { const i = el.querySelector('[data-k="' + k + '"]'); if (i && document.activeElement !== i) i.value = g[k]; });
  }
  function setK(o, k, v) {
    const num = parseFloat(v);
    switch (k) {
      case "x": o.set("left", num + o.getScaledWidth() / 2); break; case "y": o.set("top", num + o.getScaledHeight() / 2); break;
      case "rot": o.rotate(num || 0); break; case "op": o.set("opacity", Math.max(0, Math.min(1, num / 100))); break;
      case "w": if (num > 0) { if (o.type === "textbox") o.set("width", num / (o.scaleX || 1)); else o.set("scaleX", num / o.width * (o.scaleX < 0 ? -1 : 1)); } break;
      case "h": if (num > 0) o.set("scaleY", num / o.height * (o.scaleY < 0 ? -1 : 1)); break;
      case "text": o.set("text", v); if (/^نص:/.test(o.name)) o.name = Ed.defaultName(o); { const rtl = /[؀-ۿ]/.test(v); if (!o._dirSet) { o.set({ direction: rtl ? "rtl" : "ltr" }); } } Ed.emit("layers"); break;
      case "font": loadFont(v).then(() => { o.set("fontFamily", v); o.initDimensions(); Ed.c.requestRenderAll(); Ed.emit("changed", "font"); }); return;
      case "size": o.set("fontSize", num || 12); break; case "weight": o.set("fontWeight", v); break; case "color": o.set("fill", v); break;
      case "lh": o.set("lineHeight", num || 1); break; case "ls": o.set("charSpacing", num || 0); break;
      case "fill": o.set("fill", v); break; case "stroke": o.set("stroke", v); if (!(o.strokeWidth > 0)) o.set("strokeWidth", 4); break; case "sw": o.set("strokeWidth", Math.max(0, num || 0)); break;
      case "rad": o.set({ rx: num || 0, ry: num || 0 }); break;
      case "bLabel": { const [, tx] = o.getObjects(); tx.set("text", v); o.name = "زر: " + v.slice(0, 20); o.addWithUpdate(); Ed.emit("layers"); break; }
      case "bFill": o.getObjects()[0].set("fill", v); o.dirty = true; break; case "bColor": o.getObjects()[1].set("fill", v); o.dirty = true; break;
      case "bRad": o.getObjects()[0].set({ rx: num || 0, ry: num || 0 }); o.dirty = true; break; case "bSize": o.getObjects()[1].set("fontSize", num || 12); o.addWithUpdate(); break;
    }
    o.setCoords(); Ed.c.requestRenderAll();
  }
  const loaded = {};
  function loadFont(f) { if (loaded[f] || !document.fonts) return Promise.resolve(); loaded[f] = 1; return Promise.race([Promise.all(["400", "700", "800"].map(w => document.fonts.load(w + " 20px " + f))), new Promise(r => setTimeout(r, 1500))]).catch(() => { }); }
  Ed.loadFont = loadFont;

  function act(a, v) {
    const o = O(); if (!o) return;
    if (a === "dup") return Ed.layers.duplicate(o); if (a === "del") return Ed.layers.remove(o.type === "activeSelection" ? o.getObjects() : o); if (a === "group") { Ed.layers.group(); return build(); } if (a === "ungroup") return Ed.layers.ungroup();
    if (a === "front") return Ed.layers.front(o); if (a === "back") return Ed.layers.back(o); if (a === "fwd") return Ed.layers.forward(o); if (a === "bwd") return Ed.layers.backward(o);
    if (a === "alignP") { Ed.layers.align(o, v); return refreshNums(); }
    if (a === "align") { o.set("textAlign", v); build(); }
    if (a === "italic") { o.set("fontStyle", o.fontStyle === "italic" ? "normal" : "italic"); build(); }
    if (a === "underline") { o.set("underline", !o.underline); build(); }
    if (a === "dir") { o._dirSet = true; o.set({ direction: o.direction === "rtl" ? "ltr" : "rtl", textAlign: o.direction === "rtl" ? "left" : "right" }); build(); }
    if (a === "flipX") o.set("flipX", !o.flipX); if (a === "flipY") o.set("flipY", !o.flipY);
    if (a === "uncrop") { const el = o.getElement(), nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height, w = o.getScaledWidth(), h = o.getScaledHeight(), kx = Math.abs(o.scaleX), ky = Math.abs(o.scaleY); o.set({ cropX: 0, cropY: 0, width: nw, height: nh }); o.setCoords(); }
    if (a === "replace") { document.getElementById("f-rep").click(); return; }
    if (a === "crop") return startCrop(o);
    if (a === "cropOk") return endCrop(true); if (a === "cropNo") return endCrop(false);
    o.setCoords(); Ed.c.requestRenderAll(); Ed.emit("changed", a);
  }
  function startCrop(img) {
    const w = img.getScaledWidth(), h = img.getScaledHeight(), c = img.getCenterPoint();
    const r = new fabric.Rect({ left: c.x, top: c.y, width: w, height: h, angle: img.angle, fill: "rgba(124,58,237,.12)", stroke: "#7c3aed", strokeDashArray: [10, 8], strokeWidth: 3, strokeUniform: true, lockRotation: true, hasRotatingPoint: false, id: "__crop", excludeFromExport: true });
    r.setControlVisible("mtr", false); crop = { img, rect: r }; img.set({ selectable: false, evented: false }); Ed.c.add(r); Ed.c.setActiveObject(r); build();
  }
  function endCrop(ok) {
    if (!crop) return; const { img, rect } = crop; if (ok) { if (!Ed.cropImage(img, rect)) Ed.toast("المستطيل خارج الصورة"); } Ed.c.remove(rect); img.set({ selectable: true, evented: true }); crop = null; Ed.c.setActiveObject(img); build(); Ed.c.requestRenderAll();
  }
  Ed.cropping = () => !!crop;

  document.addEventListener("DOMContentLoaded", () => {
    el = document.getElementById("props"); build();
    el.addEventListener("input", e => {
      const k = e.target.dataset && e.target.dataset.k; if (!k) return;
      if (k === "docW" || k === "docH") { if (e.type === "input") return; }
      if (k === "docBg") { Ed.setBackgroundColor(e.target.value); Ed.emit("changed", "bg"); return; }
      const o = O(); if (!o) return; setK(o, k, e.target.value); if (k !== "font") Ed.emit("changed", k); if (/^[xywh]|rot/.test(k) === false) { } if (k === "w" || k === "h") refreshNumsSoon();
    });
    el.addEventListener("change", e => { const k = e.target.dataset && e.target.dataset.k; if (k === "docW" || k === "docH") { Ed.resizeDoc(+el.querySelector('[data-k="docW"]').value, +el.querySelector('[data-k="docH"]').value); build(); } });
    el.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b) act(b.dataset.a, b.dataset.v); });
  });
  let rt; function refreshNumsSoon() { clearTimeout(rt); rt = setTimeout(refreshNums, 300); }
  ["selection:created", "selection:updated", "selection:cleared", "doc"].forEach(ev => Ed.on(ev, () => { if (!crop || ev === "doc") build(); }));
  ["live", "object:modified"].forEach(ev => Ed.on(ev, refreshNums));
  Ed.on("history", () => { if (!crop) { const a = O(); if (!a || !el.querySelector("[data-k]")) build(); } });
  Ed.on("layers", () => { const a = O(); if (a && el && !crop) { const t = el.querySelector(".ptitle"); if (t && t.textContent !== a.name && a.type !== "activeSelection") t.textContent = a.name; } });
  Ed.endCrop = endCrop; Ed.rebuildProps = build;
})();
