/* محرر التصميم — النواة: لوحة Fabric.js، المستند، التكبير، إنشاء العناصر.
   مبدأ معماري: كل التحرير هنا محلي 100% (لا شبكة ولا ذكاء اصطناعي). التفكيك بالذكاء الاصطناعي مرحلة منفصلة لاحقة. */
(function () {
  const Ed = window.Ed = window.Ed || {};
  Ed.PROPS = ["id", "name", "layerType", "role", "assetId", "locked", "direction", "selectable", "evented", "hasControls", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "btn"];
  Ed.FONTS = ["Cairo", "Tajawal", "Almarai", "Inter", "Montserrat", "Poppins", "Roboto", "Arial", "Tahoma"];
  Ed.doc = { width: 1080, height: 3000, bg: "#ffffff" };
  Ed.zoom = 1; Ed.assets = new Map();                       // assetId → {src, w, h, name}
  const L = {}; Ed.on = (e, f) => { (L[e] = L[e] || []).push(f); }; Ed.emit = (e, a) => { (L[e] || []).forEach(f => { try { f(a); } catch (x) { console.error(e, x); } }); };
  Ed.uid = p => (p || "l") + "_" + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);
  const ARABIC = /[؀-ۿ]/;

  Ed.init = function (el) {
    const P = fabric.Object.prototype;
    P.originX = P.originY = "center"; P.transparentCorners = false; P.cornerStyle = "circle"; P.cornerColor = "#fff"; P.cornerStrokeColor = "#7c3aed"; P.borderColor = "#7c3aed"; P.cornerSize = 12; P.touchCornerSize = 26; P.borderScaleFactor = 2; P.padding = 0;
    Ed.c = new fabric.Canvas(el, { preserveObjectStacking: true, selection: true, stopContextMenu: true, fireRightClick: false, enableRetinaScaling: true });
    ["object:added", "object:removed", "object:modified", "selection:created", "selection:updated", "selection:cleared"].forEach(ev => Ed.c.on(ev, e => Ed.emit(ev, e)));
    Ed.c.on("text:changed", e => Ed.emit("text:changed", e)); Ed.c.on("text:editing:exited", e => Ed.emit("text:exited", e));
    ["object:moving", "object:scaling", "object:rotating"].forEach(ev => Ed.c.on(ev, e => Ed.emit("live", e)));
    return Ed.c;
  };
  Ed.makeBackground = function () {
    return new fabric.Rect({ left: Ed.doc.width / 2, top: Ed.doc.height / 2, width: Ed.doc.width, height: Ed.doc.height, fill: Ed.doc.bg, id: Ed.uid("bg"), name: "الخلفية", layerType: "background", locked: true, objectCaching: false, strokeWidth: 0 });
  };
  Ed.applyLock = function (o, on) {
    o.locked = !!on; o.set({ lockMovementX: !!on, lockMovementY: !!on, lockScalingX: !!on, lockScalingY: !!on, lockRotation: !!on, hasControls: !on, selectable: !on, evented: !on });
  };
  /* مستند جديد (يفرغ اللوحة) */
  Ed.newDoc = function (w, h, bg) {
    Ed.doc = { width: Math.max(100, Math.min(12000, Math.round(w) || 1080)), height: Math.max(100, Math.min(24000, Math.round(h) || 3000)), bg: bg || "#ffffff" };
    Ed.c.clear(); const b = Ed.makeBackground(); Ed.applyLock(b, true); Ed.c.add(b);
    Ed.setZoom(Ed.fitZoom()); Ed.emit("doc"); Ed.emit("layers");
  };
  Ed.setBackgroundColor = function (col) { Ed.doc.bg = col; const b = Ed.c.getObjects().find(o => o.layerType === "background"); if (b) { b.set("fill", col); Ed.c.requestRenderAll(); } };
  Ed.resizeDoc = function (w, h) {
    w = Math.max(100, Math.min(12000, Math.round(w) || Ed.doc.width)); h = Math.max(100, Math.min(24000, Math.round(h) || Ed.doc.height)); Ed.doc.width = w; Ed.doc.height = h;
    const b = Ed.c.getObjects().find(o => o.layerType === "background"); if (b) { b.set({ left: w / 2, top: h / 2, width: w, height: h }); b.setCoords(); }
    Ed.setZoom(Ed.zoom); Ed.emit("doc"); Ed.emit("changed", "resize");
  };
  Ed.fitZoom = function () { const w = document.getElementById("stage"); return Math.max(.05, Math.min(1, ((w ? w.clientWidth : 800) - 56) / Ed.doc.width)); };
  Ed.setZoom = function (z, keepCenter) {
    z = Math.max(.05, Math.min(4, z)); const st = document.getElementById("stage"); let cx = 0, cy = 0;
    if (st && keepCenter) { cx = (st.scrollLeft + st.clientWidth / 2) / Ed.zoom; cy = (st.scrollTop + st.clientHeight / 2) / Ed.zoom; }
    Ed.zoom = z; Ed.c.setZoom(z); Ed.c.setDimensions({ width: Math.round(Ed.doc.width * z), height: Math.round(Ed.doc.height * z) });
    if (st && keepCenter) { st.scrollLeft = cx * z - st.clientWidth / 2; st.scrollTop = cy * z - st.clientHeight / 2; }
    Ed.emit("zoom", z);
  };
  /* مركز النافذة المرئية بإحداثيات المستند (حيث نضع العناصر الجديدة) */
  Ed.viewCenter = function () {
    const st = document.getElementById("stage"), cv = Ed.c.getElement().parentNode; if (!st) return { x: Ed.doc.width / 2, y: Ed.doc.height / 2 };
    const x = (st.scrollLeft + st.clientWidth / 2 - cv.offsetLeft) / Ed.zoom, y = (st.scrollTop + st.clientHeight / 2 - cv.offsetTop) / Ed.zoom;
    return { x: Math.max(0, Math.min(Ed.doc.width, x)), y: Math.max(0, Math.min(Ed.doc.height, y)) };
  };
  Ed.defaultName = function (o) {
    const t = o.layerType || o.type;
    if (t === "text") return "نص: " + String(o.text || "").replace(/\s+/g, " ").slice(0, 22);
    return ({ image: "صورة", shape: "شكل", svg: "SVG", group: "مجموعة", button: "زر", icon: "أيقونة", background: "الخلفية" })[t] || t;
  };
  /* تسجيل العنصر كطبقة وإضافته */
  Ed.add = function (o, opt) {
    opt = opt || {}; if (!o.id) o.id = Ed.uid("l"); if (!o.layerType) o.layerType = o.type === "textbox" ? "text" : (o.type === "image" ? "image" : "shape");
    if (!o.name) o.name = Ed.defaultName(o); Ed.c.add(o); if (opt.select !== false) { Ed.c.setActiveObject(o); } Ed.c.requestRenderAll(); Ed.emit("changed", "add"); return o;
  };
  Ed.addText = function (text, o) {
    const c = Ed.viewCenter(), rtl = ARABIC.test(text || "اكتب نصك هنا");
    const t = new fabric.Textbox(text || "اكتب نصك هنا", Object.assign({ left: c.x, top: c.y, width: Math.min(760, Ed.doc.width - 120), fontFamily: "Cairo", fontSize: 64, fontWeight: "700", fill: "#111827", textAlign: rtl ? "right" : "left", direction: rtl ? "rtl" : "ltr", lineHeight: 1.3, charSpacing: 0, layerType: "text" }, o || {}));
    return Ed.add(t);
  };
  Ed.addShape = function (kind, o) {
    const c = Ed.viewCenter(), base = { left: c.x, top: c.y, fill: "#7c3aed", stroke: "#000000", strokeWidth: 0, layerType: "shape" }; let s;
    if (kind === "rect") s = new fabric.Rect(Object.assign(base, { width: 420, height: 260, name: "مستطيل" }));
    else if (kind === "rounded") s = new fabric.Rect(Object.assign(base, { width: 420, height: 260, rx: 40, ry: 40, name: "مستطيل مدوّر" }));
    else if (kind === "circle") s = new fabric.Circle(Object.assign(base, { radius: 150, name: "دائرة" }));
    else if (kind === "triangle") s = new fabric.Triangle(Object.assign(base, { width: 300, height: 260, name: "مثلث" }));
    else if (kind === "line") { s = new fabric.Line([0, 0, 500, 0], Object.assign(base, { left: c.x, top: c.y, stroke: "#111827", strokeWidth: 6, fill: "", name: "خط", strokeLineCap: "round" })); }
    else if (kind === "star") { const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 60 : 140, a = Math.PI / 5 * i - Math.PI / 2; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } s = new fabric.Polygon(pts, Object.assign(base, { fill: "#f59e0b", name: "نجمة" })); }
    else return null;
    if (o) s.set(o); return Ed.add(s);
  };
  /* أيقونات جاهزة (مسارات SVG بسيطة 24×24) */
  Ed.ICONS = { check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z", star: "m12 17.3 6.2 3.7-1.6-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2l5.5 4.8-1.6 7z", heart: "M12 21.4 10.6 20C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5z", phone: "M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z", truck: "M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.7 1.3 3 3 3s3-1.3 3-3h6c0 1.7 1.3 3 3 3s3-1.3 3-3h2v-5zM6 18.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5zM18 18.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z", shield: "M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5z" };
  Ed.addIcon = function (name) {
    const d = Ed.ICONS[name]; if (!d) return null; const c = Ed.viewCenter();
    const p = new fabric.Path(d, { left: c.x, top: c.y, fill: "#7c3aed", scaleX: 6, scaleY: 6, layerType: "icon", name: "أيقونة " + name }); return Ed.add(p);
  };
  /* زر = مجموعة (مستطيل مدوّر + نص)؛ تُعدَّل خصائصه من لوحة الخصائص */
  Ed.addButton = function (label) {
    const c = Ed.viewCenter(), W = 620, H = 120;
    const r = new fabric.Rect({ width: W, height: H, rx: 60, ry: 60, fill: "#facc15", originX: "center", originY: "center" });
    const t = new fabric.Textbox(label || "اطلب الآن", { width: W - 60, fontFamily: "Cairo", fontSize: 52, fontWeight: "800", fill: "#111827", textAlign: "center", direction: "rtl", originX: "center", originY: "center" });
    const g = new fabric.Group([r, t], { left: c.x, top: c.y, layerType: "button", name: "زر: " + (label || "اطلب الآن"), subTargetCheck: false });
    return Ed.add(g);
  };
  /* ───── صور ───── */
  Ed.OK_IMG = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]; Ed.MAX_BYTES = 20 * 1024 * 1024;
  Ed.safeName = n => String(n || "image").replace(/[^\w.\-؀-ۿ ]+/g, "_").slice(0, 80);
  Ed.readFile = function (file) {
    return new Promise((res, rej) => {
      if (!file) return rej(new Error("لا ملف"));
      if (!Ed.OK_IMG.includes(file.type)) return rej(new Error("نوع غير مدعوم: " + (file.type || "?") + " (المسموح PNG/JPEG/WebP/GIF/SVG)"));
      if (file.size > Ed.MAX_BYTES) return rej(new Error("الملف أكبر من 20MB"));
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error("تعذّرت قراءة الملف")); fr.readAsDataURL(file);
    });
  };
  Ed.loadEl = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("صورة غير صالحة")); im.src = src; });
  Ed.registerAsset = function (src, w, h, name) { const id = Ed.uid("a"); Ed.assets.set(id, { src, w, h, name: Ed.safeName(name) }); Ed.emit("asset", id); return id; };
  Ed.addImageFile = async function (file, o) {
    if (file.type === "image/svg+xml") return Ed.addSvgFile(file);
    const src = await Ed.readFile(file), el = await Ed.loadEl(src), id = Ed.registerAsset(src, el.naturalWidth, el.naturalHeight, file.name);
    const c = Ed.viewCenter(), k = Math.min(1, (Ed.doc.width * .9) / el.naturalWidth);
    const im = new fabric.Image(el, Object.assign({ left: c.x, top: c.y, scaleX: k, scaleY: k, assetId: id, layerType: "image", name: "صورة: " + Ed.safeName(file.name).replace(/\.[^.]+$/, "") }, o || {}));
    return Ed.add(im);
  };
  Ed.addSvgFile = function (file) {
    return new Promise((res, rej) => {
      const fr = new FileReader(); fr.onerror = () => rej(new Error("تعذّرت قراءة الملف")); fr.onload = () => {
        fabric.loadSVGFromString(String(fr.result), (objs, opts) => {
          if (!objs || !objs.length) return rej(new Error("SVG غير صالح")); const g = fabric.util.groupSVGElements(objs, opts), c = Ed.viewCenter(), k = Math.min(1, 500 / Math.max(g.width, g.height));
          g.set({ left: c.x, top: c.y, scaleX: k, scaleY: k, layerType: "svg", name: "SVG: " + Ed.safeName(file.name).replace(/\.[^.]+$/, "") }); res(Ed.add(g));
        });
      }; fr.readAsText(file);
    });
  };
  /* استبدال الصورة مع الحفاظ على الموضع والحجم المعروض والتدوير والترتيب */
  Ed.replaceImage = async function (obj, file) {
    const src = await Ed.readFile(file), el = await Ed.loadEl(src), id = Ed.registerAsset(src, el.naturalWidth, el.naturalHeight, file.name);
    const w = obj.getScaledWidth(), h = obj.getScaledHeight(); obj.setElement(el); obj.set({ cropX: 0, cropY: 0, width: el.naturalWidth, height: el.naturalHeight, scaleX: w / el.naturalWidth, scaleY: h / el.naturalHeight, assetId: id });
    obj.setCoords(); Ed.c.requestRenderAll(); Ed.emit("changed", "replace"); return obj;
  };
  /* قص الصورة بمستطيل له نفس زاوية الصورة (إحداثيات المستند)؛ يُحسب في الإحداثيات المحلية للصورة */
  Ed.cropImage = function (img, rect) {
    const inv = fabric.util.invertTransform(img.calcTransformMatrix()), lc = fabric.util.transformPoint(rect.getCenterPoint(), inv);
    const lw = rect.width * Math.abs(rect.scaleX) / Math.abs(img.scaleX), lh = rect.height * Math.abs(rect.scaleY) / Math.abs(img.scaleY), hw = img.width / 2, hh = img.height / 2;
    const x0 = Math.max(-hw, lc.x - lw / 2), x1 = Math.min(hw, lc.x + lw / 2), y0 = Math.max(-hh, lc.y - lh / 2), y1 = Math.min(hh, lc.y + lh / 2);
    if (x1 - x0 < 4 || y1 - y0 < 4) return false;
    const center = fabric.util.transformPoint({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, img.calcTransformMatrix());
    img.set({ cropX: (img.cropX || 0) + (x0 + hw), cropY: (img.cropY || 0) + (y0 + hh), width: x1 - x0, height: y1 - y0, left: center.x, top: center.y }); img.setCoords(); Ed.c.requestRenderAll(); Ed.emit("changed", "crop"); return true;
  };
})();
