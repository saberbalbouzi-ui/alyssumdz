/* ═════════════════════════════════════════════════════════════════
   PBLayers — محوّل صيغة «alyssum-design-layers» (طبقات مسطّحة بإحداثيات بكسل المصدر، مثل ما يعطيه ChatGPT لملصق/بوستر)
   إلى صيغة المطوّر الأصلية «alyssum-design/1» التي يفهمها PBSpec (ثم تصير عناصر حرة مستقلة: نص/صورة/شكل/أيقونة).
   لا يغيّر المحرّر ولا صيغة الصفحات؛ يُستعمل تلقائياً من PBSpec.validate عند لصق/رفع ملف بهذه الصيغة، ويعمل في Node أيضاً.
   convert(doc, opts) → spec  |  opts: {assets:{مفتاح:{src,prompt}}, product, lang, z:{معرّف:ترتيب} لتعديل ترتيب طبقات بعينها}
   ═════════════════════════════════════════════════════════════════ */
const PBLayers = (() => {
  const SCHEMA = "alyssum-design-layers";
  const FONT = { "cairo": "", "montserrat": "Montserrat", "cormorant garamond": "Playfair Display", "playfair display": "Playfair Display", "poppins": "Poppins", "tajawal": "Tajawal", "almarai": "Almarai", "amiri": "Amiri", "roboto": "Roboto", "open sans": "Open Sans", "lora": "Lora" };   // الخط غير المتاح في المحرّر يُستبدل بأقرب خط متاح
  const ICON = { "brain": "brain", "leaf": "leaf", "shield-check": "shield-check", "truck": "truck", "book-open": "img:assets/img/icons/mf-book-open.svg", "book": "img:assets/img/icons/mf-book-open.svg", "heart": "heart", "star": "star", "gift": "gift", "clock": "clock", "phone": "phone", "mail": "mail", "check": "check-circle", "check-circle": "check-circle", "sun": "sun", "flame": "flame", "droplet": "droplet", "drop": "droplet", "zap": "zap", "award": "award", "box": "box", "cart": "cart" };
  const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? v : d; };
  const colorOk = c => typeof c === "string" && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(c.trim());

  /* مجموعات الاختيار: «benefit-01..12» ثلاثيات (دائرة+أيقونة+نص)، وبقية المعرّفات حسب بادئتها (offer-01/02 لافتة، offer-03..06 اللوحة) */
  function groupOf(id) {
    let m = /^benefit-(\d+)$/.exec(id); if (m) return "benefit" + Math.ceil(Number(m[1]) / 3);
    m = /^offer-(\d+)$/.exec(id); if (m) return Number(m[1]) <= 2 ? "offerhead" : "offerbox";
    m = /^([a-z]+)-\d+$/.exec(id); if (!m) return "";
    return ["age", "note", "gift", "single", "shipping", "messenger", "brand"].includes(m[1]) ? m[1] : "";
  }

  function shapeOf(L) {
    const w = num(L.width, 0), h = num(L.height, 0), s = L.shape, o = { shape: "rect" };
    if (s === "ellipse") o.shape = "ellipse";
    else if (s === "roundedRect") { o.shape = "rect"; o.radius = Math.round(num(L.radius, 16)); }
    else if (s === "roughPaper") { o.shape = "rect"; o.radius = 8; o.shadow = { x: 0, y: 6, blur: 14, color: "rgba(0,0,0,.18)" }; }
    else if (s === "ribbon") { o.shape = "rect"; o.radius = 10; }
    else if (s === "brushStroke") { o.shape = "rect"; o.radius = Math.round(Math.min(w, h) / 2); }
    else if (["triangle", "diamond", "hexagon", "star5", "ring", "semicircle"].includes(s)) o.shape = s;
    return o;
  }

  function convert(doc, opts) {
    opts = opts || {};
    if (!doc || typeof doc !== "object" || !Array.isArray(doc.layers)) throw new Error("ملف الطبقات غير صالح (لا توجد layers)");
    const cv = doc.canvas || {}, W = Math.round(num(cv.width, 1080)), H = Math.round(num(cv.height, 1600)), bg = colorOk(cv.background) ? cv.background : "#ffffff";
    const need = {}; (Array.isArray(doc.assetsNeeded) ? doc.assetsNeeded : []).forEach(a => { if (a && a.id) need[a.id] = a; });
    const given = opts.assets || {}, assets = {}, used = new Set(), notes = [];
    doc.layers.forEach(L => { if (L.type === "image" && L.assetKey) used.add(L.assetKey); });
    used.forEach(k => {
      const g = given[k] || {}, n = need[k] || {};
      assets[k.replace(/[^\w-]/g, "")] = { src: g.src || "", prompt: g.src ? "" : String(g.prompt || n.description || k).slice(0, 480) };
      if (!g.src) notes.push("الأصل «" + k + "» بلا ملف فعلي: يبقى مكان صورة بوصفه (يُولَّد بزر «توليد الصور الفارغة» أو يُستبدل بصورة من المكتبة)");
    });
    const layers = doc.layers.slice().sort((a, b) => num(a.zIndex, 0) - num(b.zIndex, 0)).map(L => {
      const o = { id: String(L.id || "").replace(/[^\w-]/g, ""), name: String(L.name || "").slice(0, 60), x: num(L.x, 0), y: num(L.y, 0), w: Math.max(1, num(L.width, 100)), h: Math.max(0, num(L.height, 0)), z: Math.min(200, Math.max(0, Math.round(num(L.zIndex, 1)))) };
      if (opts.z && opts.z[o.id] != null) o.z = Math.min(200, Math.max(0, Math.round(opts.z[o.id])));
      const g = opts.geo && opts.geo[o.id]; if (g) ["x", "y", "w", "h"].forEach(k => { if (g[k] != null) o[k] = num(g[k], o[k]); });
      if (opts.fade && opts.fade[o.id]) o.fade = opts.fade[o.id];
      if (opts.crop && opts.crop[o.id]) o.crop = opts.crop[o.id];
      const grp = groupOf(o.id); if (grp) o.group = grp;
      if (L.rotation) o.rot = num(L.rotation, 0);
      if (L.opacity != null && L.opacity < 1) o.opacity = L.opacity;
      if (L.locked) o.locked = true;
      if (L.type === "text") {
        let size = Math.round(num(L.fontSize, 24)); const lines = String(L.text || "").split("\n").length, ff = FONT[String(L.fontFamily || "").toLowerCase()];
        const main = /title-03|title-01/.test(o.id);
        const fs2 = opts.fs && opts.fs[o.id]; if (fs2) size = fs2;
        o.type = main ? "heading" : "text"; if (main) o.tag = o.id === "title-03" ? "h1" : "h2";
        o.text = String(L.text || ""); o.font = { size, weight: String(L.fontWeight || 600), color: colorOk(L.color) ? L.color : "#111111", align: ["right", "left", "center"].includes(L.align) ? L.align : "center", lineHeight: lines > 1 ? 1.25 : 1.15 };
        if (ff) o.font.family = ff;
        if (L.fitText) { o.h = 0; o.autoH = true; notes.push("«" + o.name + "»: fitText يُنقل كحجم ثابت " + size + "px بارتفاع تلقائي (لا قصّ عند التعديل)"); }
      } else if (L.type === "shape") {
        Object.assign(o, { type: "shape" }, shapeOf(L)); o.fill = colorOk(L.fill) ? L.fill : "#cccccc";
        if (L.stroke) { o.stroke = L.stroke; o.strokeW = num(L.strokeWidth, 2); }
        if (L.blur && L.shape === "ellipse") { o.gradient = { type: "radial", stops: [{ c: o.fill, p: 0 }, { c: o.fill + "00", p: 100 }] }; }   // توهّج ناعم بتدرّج شعاعي بدل تمويه الخلفية
        if (["ribbon", "roughPaper", "brushStroke"].includes(L.shape)) notes.push("«" + o.name + "»: الشكل «" + L.shape + "» غير مدعوم أصلاً فمُثِّل بمستطيل مدوّر" + (L.shape === "ribbon" ? " (وأُخفي لأنه يغطي المنتج؛ أظهره من لوحة الطبقات)" : ""));
        if (L.shape === "ribbon") o.hidden = true;
      } else if (L.type === "icon") {
        const ic = (opts.icons && opts.icons[L.iconName]) || ICON[L.iconName]; if (!ic) notes.push("«" + o.name + "»: الأيقونة «" + L.iconName + "» غير متوفرة فاستُبدلت");
        Object.assign(o, { type: "icon", icon: ic || "sparkle", color: colorOk(L.color) ? L.color : "#2e7d32", size: Math.round(Math.min(o.w, o.h || o.w)) });
        if (/^img:/.test(ic || "")) notes.push("«" + o.name + "»: «" + L.iconName + "» ليست ضمن أيقونات المحرّر فرُسمت من ملف SVG مرفوع (" + ic.slice(4) + ")");
      } else if (L.type === "image") {
        const k = String(L.assetKey || "").replace(/[^\w-]/g, ""), a = assets[k], desc = (need[L.assetKey] || {}).description || "";
        Object.assign(o, { type: "image", src: k ? "asset:" + k : "", fit: ["cover", "contain", "fill"].includes(L.fit) ? L.fit : "cover", alt: o.name });
        if (a && !a.src) { o.prompt = a.prompt; o.cutout = /transparent|cutout/i.test(desc); }
        if (L.mask) notes.push("«" + o.name + "»: القناع «" + L.mask + "» لا يُنقل (استعمل أداة الماسك على العنصر)");
      } else return null;
      return o;
    }).filter(Boolean);
    const spec = { format: "alyssum-design/1", page: { title: String(doc.title || "تصميم").slice(0, 120), width: Math.max(600, Math.min(1920, W)), bg, lang: opts.lang || "ar", product: opts.product || "" }, assets,
      sections: [{ name: "poster", height: H, bg, gradient: opts.gradient || { type: "linear", angle: 180, stops: [{ c: "#E9F3DD", p: 0 }, { c: bg, p: 55 }, { c: bg, p: 100 }] }, layers }] };
    Object.defineProperty(spec, "notes", { value: notes, enumerable: false });
    return spec;
  }
  const is = d => !!d && typeof d === "object" && d.schema === SCHEMA;
  return { SCHEMA, is, convert };
})();
if (typeof module !== "undefined" && module.exports) module.exports = PBLayers;
