/* التسلسل: المستند = JSON (width/height/bg/objects). الصور تُحفظ كمعرّف أصل `asset:ID` ويُضمَّن جدول الأصول عند الحفظ لملف. */
(function () {
  const Ed = window.Ed;
  function walk(o, f) { f(o); (o.objects || []).forEach(x => walk(x, f)); }
  Ed.serialize = function (opt) {
    opt = opt || {}; const j = Ed.c.toJSON(Ed.PROPS), used = new Set();
    j.objects.forEach(o => walk(o, x => { if (x.type === "image") { if (x.assetId) { x.src = "asset:" + x.assetId; used.add(x.assetId); } } }));
    const doc = { format: "alyssum-editor", version: 1, width: Ed.doc.width, height: Ed.doc.height, bg: Ed.doc.bg, objects: j.objects };
    if (opt.embed !== false) { doc.assets = {}; used.forEach(id => { const a = Ed.assets.get(id); if (a) doc.assets[id] = a; }); }
    return doc;
  };
  /* تحميل مستند: يحلّ asset:ID من الجدول ثم يعيد بناء الطبقات في Fabric */
  Ed.deserialize = function (doc, opt) {
    opt = opt || {};
    return new Promise((resolve, reject) => {
      if (!doc || doc.format !== "alyssum-editor" || !Array.isArray(doc.objects)) return reject(new Error("ملف تصميم غير صالح"));
      if (doc.assets) Object.keys(doc.assets).forEach(id => Ed.assets.set(id, doc.assets[id]));
      const objs = JSON.parse(JSON.stringify(doc.objects)), missing = [];
      objs.forEach(o => walk(o, x => { if (x.type === "image" && /^asset:/.test(x.src || "")) { const a = Ed.assets.get(x.src.slice(6)); if (a) { x.src = a.src; if (/^https?:/.test(a.src)) x.crossOrigin = "anonymous"; } else missing.push(x.src); } }));
      if (missing.length) return reject(new Error("أصول مفقودة: " + missing.length));
      Ed.doc = { width: doc.width, height: doc.height, bg: doc.bg || "#ffffff" };
      Ed.c.discardActiveObject();
      Ed.c.loadFromJSON({ objects: objs }, () => {
        Ed.c.getObjects().forEach(o => { if (o.locked) Ed.applyLock(o, true); });
        if (!opt.keepZoom) Ed.setZoom(Ed.fitZoom()); else Ed.setZoom(Ed.zoom);
        Ed.c.renderAll(); Ed.emit("doc"); Ed.emit("layers"); resolve(doc);
      });
    });
  };
})();
