/* الطبقات: ترتيب العناصر في Fabric هو ترتيب الطبقات (الفهرس 0 = الأسفل). كل العمليات محلية. */
(function () {
  const Ed = window.Ed;
  Ed.layers = {
    list() { return Ed.c.getObjects(); },
    /* وصف الطبقة بالشكل المطلوب في المواصفة (للتصدير/التفكيك/الاختبار) */
    describe(o, i) {
      const w = o.getScaledWidth(), h = o.getScaledHeight(), d = { id: o.id, type: o.layerType || o.type, name: o.name, x: Math.round(o.left - w / 2), y: Math.round(o.top - h / 2), width: Math.round(w), height: Math.round(h), scaleX: o.scaleX, scaleY: o.scaleY, rotation: o.angle || 0, opacity: o.opacity, visible: o.visible !== false, locked: !!o.locked, zIndex: i == null ? Ed.c.getObjects().indexOf(o) : i };
      if (o.type === "textbox") Object.assign(d, { text: o.text, fontFamily: o.fontFamily, fontSize: o.fontSize, fontWeight: o.fontWeight, fontStyle: o.fontStyle, fill: o.fill, textAlign: o.textAlign, lineHeight: o.lineHeight, letterSpacing: o.charSpacing });
      if (o.type === "image") Object.assign(d, { src: o.assetId ? "asset:" + o.assetId : "", originalWidth: o.width, originalHeight: o.height, crop: { x: o.cropX || 0, y: o.cropY || 0, width: o.width, height: o.height }, filters: (o.filters || []).length });
      return d;
    },
    describeAll() { return Ed.c.getObjects().map((o, i) => Ed.layers.describe(o, i)); },
    rename(o, n) { o.name = String(n || "").trim().slice(0, 60) || Ed.defaultName(o); Ed.emit("layers"); Ed.emit("changed", "rename"); },
    toggleVisible(o) { o.visible = o.visible === false; if (!o.visible && Ed.c.getActiveObject() === o) Ed.c.discardActiveObject(); Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "visible"); },
    toggleLock(o) { Ed.applyLock(o, !o.locked); if (o.locked && Ed.c.getActiveObject() === o) Ed.c.discardActiveObject(); Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "lock"); },
    /* نقل إلى فهرس (الخلفية تبقى في الأسفل) */
    moveTo(o, idx) {
      const n = Ed.c.getObjects().length; idx = Math.max(1, Math.min(n - 1, idx)); if (o.layerType === "background") return;
      Ed.c.moveTo(o, idx); Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "order");
    },
    front(o) { Ed.layers.moveTo(o, 1e9); }, back(o) { Ed.layers.moveTo(o, 1); },
    forward(o) { Ed.layers.moveTo(o, Ed.c.getObjects().indexOf(o) + 1); }, backward(o) { Ed.layers.moveTo(o, Ed.c.getObjects().indexOf(o) - 1); },
    remove(os) {
      os = (Array.isArray(os) ? os : [os]).filter(o => o && o.layerType !== "background"); if (!os.length) return; Ed.c.discardActiveObject();
      os.forEach(o => Ed.c.remove(o)); Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "remove");
    },
    duplicate(o) {
      if (!o || o.layerType === "background") return Promise.resolve(null);
      return new Promise(res => o.clone(cl => {
        cl.set({ left: o.left + 30, top: o.top + 30, id: Ed.uid("l"), name: (o.name || "") + " نسخة" }); if (o.assetId) cl.assetId = o.assetId; cl.layerType = o.layerType;
        if (cl.type === "activeSelection") { cl.canvas = Ed.c; cl.forEachObject(x => { x.id = Ed.uid("l"); Ed.c.add(x); }); cl.setCoords(); Ed.c.setActiveObject(cl); } else { Ed.c.add(cl); Ed.c.setActiveObject(cl); }
        Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "duplicate"); res(cl);
      }, Ed.PROPS));
    },
    group() {
      const a = Ed.c.getActiveObject(); if (!a || a.type !== "activeSelection") return null; const g = a.toGroup(); g.set({ id: Ed.uid("g"), layerType: "group", name: "مجموعة" });
      Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "group"); return g;
    },
    ungroup() {
      const g = Ed.c.getActiveObject(); if (!g || g.type !== "group" || g.layerType === "button") return; const sel = g.toActiveSelection();
      sel.forEachObject(o => { if (!o.id) o.id = Ed.uid("l"); if (!o.layerType) o.layerType = o.type === "textbox" ? "text" : (o.type === "image" ? "image" : "shape"); if (!o.name) o.name = Ed.defaultName(o); });
      Ed.c.requestRenderAll(); Ed.emit("layers"); Ed.emit("changed", "ungroup");
    },
    /* محاذاة إلى حدود الصفحة */
    align(o, how) {
      const W = Ed.doc.width, H = Ed.doc.height, w = o.getScaledWidth(), h = o.getScaledHeight();
      if (how === "left") o.set("left", w / 2); if (how === "center") o.set("left", W / 2); if (how === "right") o.set("left", W - w / 2);
      if (how === "top") o.set("top", h / 2); if (how === "middle") o.set("top", H / 2); if (how === "bottom") o.set("top", H - h / 2);
      o.setCoords(); Ed.c.requestRenderAll(); Ed.emit("changed", "align");
    }
  };
})();
