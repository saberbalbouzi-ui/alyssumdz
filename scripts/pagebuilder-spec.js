/* ════════════════════════════════════════════════════════════════════════
   PBSpec — «تصميم بطبقات» يولّده الذكاء الاصطناعي (أو ChatGPT/Claude يدوياً) ويستقبله المطوّر عناصر منفصلة:
   ١) prompt(): يبني تعليمات تُطلب من أي نموذج ذكاء ليُخرج JSON بصيغة alyssum-design/1 (طبقات: نص/عنوان/صورة/شكل/زر/أيقونة/سعر/عروض + مواضع وأحجام + ظلال + تأثيرات).
   ٢) validate(): ينظّف ناتج النموذج (غير موثوق): يقصّ الأرقام، يمنع الوسوم والروابط الخطرة، يسقط الأنواع المجهولة، ويفحص الجودة (تداخل/خروج/خط صغير/تباين).
   ٣) toSections(): يحوّل كل قسم إلى قسم قماش «متناسب» (scaled) فيه عناصر حرة بمواضعها بالبكسل المرجعي → تبقى قابلة للتحريك والتعديل والتأثيرات في المطوّر.
   ٣ب) autofix(): إصلاح هندسي آلي (خروج عن الحدود، خط صغير، تداخل، ارتفاع القسم) قبل الفتح؛ plan: مرحلة خطة تصميم قبل المخطط؛ كاش أصول + إلغاء + إعادة محاولة محدودة لتوليد الصور.
   ٤) open(): نافذة (نسخ البرومبت ← لصق/رفع JSON أو توليد بـAlyssum API ← فحص ← فتح كصفحة جديدة أو إدراج).
   ════════════════════════════════════════════════════════════════════════ */
const PBSpec = (() => {
  const FORMAT = "alyssum-design/1";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[0-9.\s,%\/]+\)|hsla?\(\s*[0-9.\s,%deg\/]+\)|transparent)$/i;
  const col = (v, d) => (typeof v === "string" && COLOR.test(v.trim()) ? v.trim() : d);
  const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n || 400);
  const TYPES = ["text", "heading", "image", "shape", "button", "icon", "price", "offers", "video"];
  const ENTR = ["fadeIn", "fadeUp", "fadeDown", "zoomIn", "slideStart"];
  const CONT = ["float", "pulse", "sweep", "glow", "kenburns", "spin", "sway", "hoverLift", "hoverZoom", "hoverTilt", "shine"];
  const BLENDS = ["multiply", "screen", "overlay", "soft-light", "hard-light", "color-dodge", "color-burn", "darken", "lighten", "difference", "luminosity"];
  const SHAPES = ["rect", "ellipse", "triangle", "diamond", "pentagon", "hexagon", "octagon", "star4", "star5", "star6", "burst", "seal", "sparkle", "arrowR", "arrowL", "arrowU", "arrowD", "semicircle", "ring"];
  const ICONS = ["leaf", "brain", "zap", "sprout", "sparkle", "shield-check", "truck", "cash", "headset", "cart", "check-circle", "pin", "box", "star", "heart", "gift", "clock", "phone", "mail", "award", "drop", "sun", "flame"];
  const SEC_KIND = ["canvas", "order"];
  const LIMITS = { sections: 40, layers: 400 };

  /* ───────────── أدوات ───────────── */
  const hex2rgb = c => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || ""); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const lum = rgb => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(rgb[0]) + .7152 * f(rgb[1]) + .0722 * f(rgb[2]); };
  const contrast = (a, b) => { const A = hex2rgb(a), B = hex2rgb(b); if (!A || !B) return null; const x = lum(A), y = lum(B); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const url = v => { v = str(v, 600).trim(); if (!v) return ""; if (/^(#[\w-]*|https:\/\/[^\s"'<>]+|tel:[+0-9]+|mailto:[^\s"'<>]+)$/i.test(v)) return v; return ""; };
  const vidSrc = v => { v = str(v, 600).trim(); if (/^(assets\/[\w\-./%]+\.(mp4|webm)|https:\/\/[^\s"'<>]+)$/i.test(v)) return v; return ""; };
  const imgRef = v => (/^(product:(cover|img(:\d+)?)|asset:[\w-]+)$/.test(v) ? v : imgSrc(v));
  const imgSrc = v => { v = str(v, 600).trim(); if (/^(assets\/[\w\-./%]+|https:\/\/[^\s"'<>]+|data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+)$/i.test(v)) return v; return ""; };

  /* ───────────── التنظيف (ناتج النموذج غير موثوق) ───────────── */
  function cleanShadow(s) {
    if (!s || typeof s !== "object") return null;
    return { x: num(s.x, -200, 200, 0), y: num(s.y, -200, 200, 8), blur: num(s.blur, 0, 200, 16), spread: num(s.spread, -100, 100, 0), color: col(s.color, "rgba(0,0,0,.25)"), inset: !!s.inset, follow: !!s.follow };
  }
  function cleanEffects(list) {
    const out = []; (Array.isArray(list) ? list : []).slice(0, 8).forEach(e => {
      const t = typeof e === "string" ? e : e && e.type; if (!ENTR.includes(t) && !CONT.includes(t)) return;
      const o = typeof e === "object" ? e : {};
      out.push({ type: t, delay: num(o.delay, 0, 5, 0), duration: num(o.duration, .1, 60, ENTR.includes(t) ? .75 : 4), amount: num(o.amount, 1, 100, 10), color: col(o.color, "") });
    }); return out;
  }
  function cleanLayer(L, dw, secH, warn, where) {
    if (!L || typeof L !== "object" || !TYPES.includes(L.type)) { warn.push(where + ": نوع طبقة غير مدعوم (" + str(L && L.type, 20) + ") — تُجوهلت"); return null; }
    const o = { id: str(L.id, 40).replace(/[^\w-]/g, ""), type: L.type, x: num(L.x, -dw, dw * 2, 0), y: num(L.y, -500, 20000, 0), w: num(L.w, 1, dw * 2, 200), h: num(L.h, 0, 6000, 0), z: Math.round(num(L.z, -20, 200, 1)), rot: num(L.rot, -360, 360, 0),
      opacity: num(L.opacity, 0, 1, 1), radius: num(L.radius, 0, 2000, 0), blur: num(L.blur, 0, 80, 0), blend: BLENDS.includes(L.blend) ? L.blend : "", shadow: cleanShadow(L.shadow), effects: cleanEffects(L.effects), name: str(L.name, 60), group: str(L.group, 30).replace(/[^\w-]/g, ""), locked: !!L.locked, hidden: !!L.hidden };
    if (L.border && typeof L.border === "object") o.border = { w: num(L.border.w, 0, 40, 0), color: col(L.border.color, "#000000"), style: ["solid", "dashed", "dotted", "double"].includes(L.border.style) ? L.border.style : "solid" };
    if (L.gradient && typeof L.gradient === "object") o.gradient = cleanGrad(L.gradient);
    if (o.type === "text" || o.type === "heading") {
      const f = L.font && typeof L.font === "object" ? L.font : {};
      o.text = str(L.text, 3000); o.font = { size: num(f.size, 8, 300, o.type === "heading" ? 48 : 22), weight: ["300", "400", "500", "600", "700", "800", "900"].includes(String(f.weight)) ? String(f.weight) : (o.type === "heading" ? "900" : "600"), color: col(f.color, "#1a1a1a"), align: ["right", "left", "center", "justify"].includes(f.align) ? f.align : "center", lineHeight: num(f.lineHeight, .8, 3, o.type === "heading" ? 1.3 : 1.8), letterSpacing: num(f.letterSpacing, -5, 30, 0), family: str(f.family, 40).replace(/[^\w \-]/g, "") };
      o.tag = ["h1", "h2", "h3", "h4", "p", "div"].includes(L.tag) ? L.tag : "h2"; if (L.autoH) o.autoH = true;
      if (!o.text.trim()) { warn.push(where + ": نص فارغ — تُجوهلت"); return null; }
    } else if (o.type === "image") {
      o.src = imgRef(str(L.src, 600).trim()); o.alt = str(L.alt || L.prompt, 200); o.prompt = str(L.prompt, 500); o.fit = ["cover", "contain", "fill"].includes(L.fit) ? L.fit : "cover";
      if (L.crop && typeof L.crop === "object") o.crop = { x: num(L.crop.x, -500, 500, 0), y: num(L.crop.y, -500, 500, 0), w: num(L.crop.w, 10, 1000, 100), h: num(L.crop.h, 10, 1000, 100) };
      if (L.fade && typeof L.fade === "object") o.fade = { t: num(L.fade.t, 0, 60, 0), b: num(L.fade.b, 0, 60, 0), l: num(L.fade.l, 0, 60, 0), r: num(L.fade.r, 0, 60, 0) };
      o.cutout = !!L.cutout; o.brightness = num(L.brightness, 40, 180, 100); o.contrast = num(L.contrast, 40, 200, 100); o.saturate = num(L.saturate, 0, 250, 100);
    } else if (o.type === "shape") {
      o.shape = SHAPES.includes(L.shape) ? L.shape : "rect"; o.fill = col(L.fill, "#c8a24b"); o.stroke = col(L.stroke, ""); o.strokeW = num(L.strokeW, 0, 40, 0);
    } else if (o.type === "button") {
      const f = L.font && typeof L.font === "object" ? L.font : {};
      o.text = str(L.text, 80) || "اطلب الآن"; o.link = url(L.link) || "#order"; o.bg = col(L.bg, "#2e7d32"); o.color = col(L.color || f.color, "#ffffff"); o.size = num(f.size || L.size, 10, 80, 24); o.weight = "900";
    } else if (o.type === "video") {
      o.src = vidSrc(L.src); o.poster = imgRef(str(L.poster, 600).trim()); o.autoplay = !!L.autoplay; o.alt = str(L.alt, 200);
      if (!o.src) { warn.push(where + ": فيديو بلا رابط صالح (https أو mp4/webm) — تُجوهلت"); return null; }
    } else if (o.type === "icon") {
      if (L.icon === "droplet") L.icon = "drop";
      o.icon = ICONS.includes(L.icon) || /^img:assets\/img\/icons\/[\w.-]+\.svg$/.test(String(L.icon || "")) ? L.icon : "sparkle"; o.color = col(L.color, "#2e7d32"); o.size = num(L.size, 12, 400, 56); o.title = str(L.title, 80); o.text = str(L.text, 200);
    }
    if (o.x + o.w < 0 || o.x > dw || o.y > secH + 200) warn.push(where + ": الطبقة خارج حدود القسم");
    return o;
  }
  function cleanGrad(g) {
    const st = (Array.isArray(g.stops) ? g.stops : Array.isArray(g.s) ? g.s : []).slice(0, 6).map((x, i, a) => ({ c: col(x.c || x.color, "#ffffff"), p: num(x.p != null ? x.p : x.pos, 0, 100, Math.round(i * 100 / Math.max(1, a.length - 1))) }));
    if (st.length < 2) return null; return { t: ["linear", "radial", "conic"].includes(g.type || g.t) ? (g.type || g.t) : "linear", a: num(g.angle != null ? g.angle : g.a, 0, 360, 180), s: st };
  }
  function validate(raw, opts) {
    opts = opts || {};
    const warn = []; let spec = raw;
    if (typeof spec === "string") { try { spec = JSON.parse(spec.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")); } catch (e) { return { ok: false, error: "ليس JSON صالحاً: " + e.message, warn }; } }
    if (typeof PBLayers !== "undefined" && PBLayers.is(spec)) { try { const cv = PBLayers.convert(spec, { assets: opts.layerAssets, product: opts.product, z: opts.layerZ, geo: opts.layerGeo, fs: opts.layerFs, fade: opts.layerFade, crop: opts.layerCrop }); (cv.notes || []).forEach(n => warn.push("استيراد الطبقات: " + n)); spec = cv; } catch (e) { return { ok: false, error: e.message, warn }; } }   // صيغة alyssum-design-layers (ChatGPT) ← تُحوَّل إلى الصيغة الأصلية
    if (!spec || typeof spec !== "object" || !Array.isArray(spec.sections) || !spec.sections.length) return { ok: false, error: "لا توجد أقسام (sections) في التصميم", warn };
    const pg = spec.page && typeof spec.page === "object" ? spec.page : {}; const dw = Math.round(num(pg.width, 600, 1920, 1080));
    const out = { format: FORMAT, page: { title: str(pg.title, 120) || "صفحة جديدة", width: dw, bg: col(pg.bg, "#ffffff"), lang: ["ar", "fr", "en"].includes(pg.lang) ? pg.lang : "ar", product: str(pg.product, 80).replace(/[^\w-]/g, "") }, assets: {}, sections: [] };
    if (spec.assets && typeof spec.assets === "object") Object.keys(spec.assets).slice(0, 80).forEach(k => { const a = spec.assets[k] || {}; out.assets[str(k, 40).replace(/[^\w-]/g, "")] = { src: imgSrc(a.src), prompt: str(a.prompt, 500) }; });
    let nl = 0;
    spec.sections.slice(0, LIMITS.sections).forEach((S, si) => {
      if (!S || typeof S !== "object") return; const w = "قسم " + (si + 1), kind = SEC_KIND.includes(S.kind) ? S.kind : "canvas";
      const H = Math.round(num(S.height, 60, 8000, 700)), sec = { kind, name: str(S.name, 60), height: H, bg: col(S.bg, ""), gradient: S.gradient ? cleanGrad(S.gradient) : null, bgImage: str(S.bgImage, 200), bgDark: num(S.bgDark, 0, .9, 0), title: str(S.title, 200), note: str(S.note, 500), layers: [] };
      (Array.isArray(S.layers) ? S.layers : []).forEach((L, li) => { if (nl >= LIMITS.layers) return; const c = cleanLayer(L, dw, H, warn, w + " / طبقة " + (li + 1)); if (c) { sec.layers.push(c); nl++; } });
      out.sections.push(sec);
    });
    if (nl >= LIMITS.layers) warn.push("تجاوز حدّ الطبقات (" + LIMITS.layers + ") — قُصّ الباقي");
    if (spec.plan && typeof spec.plan === "object") out.plan = cleanPlan(spec.plan);
    out.fixes = opts.fix === false ? [] : autofix(out);
    out.warn = warn.concat(lint(out)); out.ok = true; out.count = { sections: out.sections.length, layers: nl }; return out;
  }

  /* ───────────── خطة التصميم (المرحلة الأولى) ───────────── */
  function cleanPlan(p) {
    const pal = p.palette && typeof p.palette === "object" ? p.palette : {}, out = { concept: str(p.concept, 300), tone: str(p.tone, 120), palette: {}, sections: [], assets: [] };
    ["primary", "secondary", "accent", "bg", "text"].forEach(k => { const c = col(pal[k], ""); if (c) out.palette[k] = c; });
    (Array.isArray(p.sections) ? p.sections : []).slice(0, 16).forEach(x => { if (x && typeof x === "object") out.sections.push({ name: str(x.name, 40).replace(/[^\w-]/g, ""), goal: str(x.goal, 160), layout: str(x.layout, 200) }); });
    (Array.isArray(p.assets) ? p.assets : []).slice(0, 30).forEach(x => { if (x && typeof x === "object") out.assets.push({ name: str(x.name, 40).replace(/[^\w-]/g, ""), prompt: str(x.prompt, 400), cutout: !!x.cutout }); });
    return out;
  }

  /* ───────────── إصلاح آلي بقواعد هندسية (لا يعتمد على إحداثيات النموذج وحدها) ───────────── */
  const BOXED = ["text", "heading", "button", "icon", "price", "offers"];
  /* قياس حقيقي في المتصفح: النموذج يخمّن ارتفاع/عرض النص فيتداخل العنوان الملتفّ مع الفقرة؛ نقيس بالخط نفسه ونصحّح h وw */
  let _mz = null;
  function measure(l) {
    if (typeof document === "undefined" || !document.body || (!l.font && l.type !== "button")) return null;
    try {
      if (!_mz) { _mz = document.createElement("div"); _mz.setAttribute("aria-hidden", "true"); _mz.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;direction:rtl;white-space:normal;word-break:normal;overflow-wrap:break-word"; document.body.appendChild(_mz); }
      const fo = l.font || {}, ff = "'" + (fo.family || "Cairo") + "','Cairo',sans-serif", plain = l.text.replace(/\*\*/g, "");
      if (l.type === "button") {
        _mz.style.cssText += ";width:auto;white-space:nowrap;font:" + (fo.weight || 800) + " " + l.size + "px " + ff + ";line-height:1.2"; _mz.textContent = plain; return { tw: Math.ceil(_mz.getBoundingClientRect().width), th: Math.ceil(_mz.getBoundingClientRect().height) };
      }
      _mz.style.cssText += ";white-space:normal;width:" + l.w + "px;font:" + (l.font.weight || 400) + " " + l.font.size + "px " + ff + ";line-height:" + l.font.lineHeight + ";letter-spacing:" + (l.font.letterSpacing || 0) + "px"; _mz.innerText = plain;
      return { th: Math.ceil(_mz.getBoundingClientRect().height) };
    } catch (e) { return null; }
  }
  function estH(l) {
    if (l.type === "heading" || l.type === "text") { const m = l._m || (l._m = measure(l)); if (m && m.th) { const h = m.th + 10; if (!l.h || l.h < h) l.h = h; return l.h; } }
    if (l.h) return l.h; if (l.type === "button") return 64; if (l.type === "icon") return l.size + 60; if (l.type === "price") return 80; if (l.type === "offers") return 200;
    const per = Math.max(1, l.w / (l.font.size * .45)); let n = 0; l.text.replace(/\*\*/g, "").split("\n").forEach(t => { n += Math.max(1, Math.ceil(t.length / per)); });
    return Math.ceil(n * l.font.size * l.font.lineHeight) + 8;
  }
  function autofix(spec) {
    const fx = [], dw = spec.page.width, minPx = Math.ceil(11 * dw / 390);   // أصغر خط يبقى مقروءاً (11px) على الجوال
    spec.sections.forEach((S, si) => {
      const tag = "قسم " + (si + 1) + (S.name ? " (" + S.name + ")" : ""), L = S.layers.filter(l => BOXED.includes(l.type) && !l.rot);
      L.forEach(l => {
        const nm = l.text ? "«" + l.text.slice(0, 14) + "…»" : l.type;
        if (l.w > dw) { l.w = dw; fx.push(tag + ": عُدّل عرض " + nm + " ليتّسع للصفحة"); }
        if (l.x < 0) { l.x = 0; fx.push(tag + ": أُرجع " + nm + " داخل الحدّ الأيسر"); }
        if (l.x + l.w > dw) { l.x = Math.max(0, dw - l.w); fx.push(tag + ": أُرجع " + nm + " داخل الحدّ الأيمن"); }
        if (l.y < 0) { l.y = 0; fx.push(tag + ": أُنزل " + nm + " داخل أعلى القسم"); }
        if (l.font && l.font.size < minPx) { fx.push(tag + ": رُفع خط " + nm + " من " + l.font.size + " إلى " + minPx + " ليُقرأ على الجوال"); l.font.size = minPx; }
        if (l.type === "button") { const m = measure(l); if (m && m.tw) { const need = m.tw + Math.round(l.size * 1.4); if (l.w < need) { fx.push(tag + ": وُسِّع الزر «" + l.text.slice(0, 14) + "» من " + l.w + " إلى " + need + " كي لا يلتفّ النص"); l.w = Math.min(dw, need); if (l.x + l.w > dw) l.x = Math.max(0, dw - l.w); } if (!l.h || l.h < m.th + 16) l.h = m.th + 16; } }
        if (l.type === "button" && l.size < minPx) { fx.push(tag + ": رُفع خط الزر «" + l.text.slice(0, 14) + "» إلى " + minPx); l.size = minPx; }
      });
      /* تداخل: الأدنى يُنزَل تحت الأعلى */
      const ord = L.filter(l => l.type !== "price" && l.type !== "offers").sort((a, b) => a.y - b.y);
      for (let i = 1; i < ord.length; i++) for (let j = 0; j < i; j++) {
        const a = ord[j], b = ord[i], ah = estH(a), bh = estH(b);
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + ah, b.y + bh) - Math.max(a.y, b.y);
        if (ox > 12 && oy > 12 && b.y >= a.y) { const d = Math.ceil(oy + 12); b.y += d; fx.push(tag + ": أُنزل «" + (b.text || b.type).toString().slice(0, 14) + "» " + d + "px لإزالة التداخل"); }
      }
      /* ارتفاع القسم يتّسع لكل ما فيه */
      const need = Math.ceil(L.reduce((m, l) => Math.max(m, l.y + estH(l)), 0) + 40);
      if (need > S.height) { fx.push(tag + ": كُبّر ارتفاع القسم من " + S.height + " إلى " + need + " ليتّسع للمحتوى"); S.height = Math.min(8000, need); }
    });
    spec.sections.forEach(S => S.layers.forEach(l => { delete l._m; }));
    return fx.slice(0, 60);
  }

  /* ───────────── فحص الجودة (تداخل، تباين، خط صغير) ───────────── */
  function lint(spec) {
    const w = [], dw = spec.page.width, mobScale = 390 / dw;
    spec.sections.forEach((S, si) => {
      const tag = "قسم " + (si + 1) + (S.name ? " (" + S.name + ")" : ""), texts = S.layers.filter(l => l.type === "text" || l.type === "heading");
      texts.forEach(l => {
        if (l.font.size * mobScale < 11) w.push(tag + ": خط «" + l.text.slice(0, 18) + "…» سيظهر صغيراً على الجوال (" + Math.round(l.font.size * mobScale) + "px)");
        const bg = S.bg || spec.page.bg, c = contrast(l.font.color, bg); if (c != null && c < 3 && !S.bgImage && !S.gradient) w.push(tag + ": تباين ضعيف لنص «" + l.text.slice(0, 18) + "…» (" + c.toFixed(1) + ":1)");
      });
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j], ah = a.h || Math.ceil(a.text.split("\n").length * a.font.size * a.font.lineHeight), bh = b.h || Math.ceil(b.text.split("\n").length * b.font.size * b.font.lineHeight);
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + ah, b.y + bh) - Math.max(a.y, b.y);
        if (ox > 12 && oy > 12) w.push(tag + ": تداخل بين نصين («" + a.text.slice(0, 14) + "…» و«" + b.text.slice(0, 14) + "…»)");
      }
      /* بيانات مخترعة: الأسعار والخصومات والادّعاءات العلاجية يجب أن تأتي من المنتج لا من النص */
      S.layers.filter(l => l.text || l.title).forEach(l => {
        const tx = [l.text, l.title].filter(Boolean).join(" ");
        if (/\d[\d\s.,]*\s*(دج|دينار|د\.ج|DA|DZD|€|\$)/i.test(tx) || /(خصم|تخفيض|تخفيضات|promo|remise|-)\s*\d+\s*%|\d+\s*%\s*(خصم|تخفيض|off)/i.test(tx)) w.push(tag + ": نص «" + tx.slice(0, 22) + "…» يكتب سعراً/خصماً يدوياً — استعمل طبقة price/offers من بيانات المنتج");
        if (/(يعالج|يشفي|يُشفي|علاج|دواء|شفاء|guérit|guerison|traite la|cures?\b|treats?\b)/i.test(tx)) w.push(tag + ": ادّعاء علاجي محتمل في «" + tx.slice(0, 22) + "…» — راجعه قبل النشر");
      });
      if (S.layers.some(l => (l.type === "price" || l.type === "offers")) && !spec.page.product) w.push(tag + ": طبقة سعر/عروض بلا منتج مرتبط — اختر منتجاً وإلا تظهر فارغة");
      /* تسلسل بصري: العنوان أكبر من النص، وفراغات كبيرة */
      const hd = S.layers.filter(l => l.type === "heading"), body = S.layers.filter(l => l.type === "text");
      if (hd.length && body.length && Math.max.apply(null, hd.map(l => l.font.size)) <= Math.max.apply(null, body.map(l => l.font.size))) w.push(tag + ": العنوان ليس أكبر من النص — التسلسل البصري ضعيف");
      const bx = S.layers.filter(l => BOXED.includes(l.type) && !l.rot).sort((a, b) => a.y - b.y); let maxB = 0;
      bx.forEach(l => { if (l.y - maxB > 260 && maxB > 0) w.push(tag + ": فراغ رأسي كبير (" + Math.round(l.y - maxB) + "px) قبل «" + (l.text || l.type).toString().slice(0, 14) + "»"); maxB = Math.max(maxB, l.y + estH(l)); });
      if (bx.length && S.height - maxB > 320) w.push(tag + ": مساحة فارغة كبيرة أسفل القسم (" + Math.round(S.height - maxB) + "px)");
      S.layers.forEach(l => { if (l.type === "image" && !l.src) w.push(tag + ": صورة بلا مصدر" + (l.prompt ? " — وصفها: " + l.prompt.slice(0, 40) : "")); });
    });
    /* اتساق الخطوط على مستوى الصفحة */
    const T = spec.sections.reduce((a, S) => a.concat(S.layers.filter(l => l.font)), []), sizes = new Set(T.map(l => Math.round(l.font.size / 4) * 4)), fams = new Set(T.map(l => l.font.family).filter(Boolean));
    if (sizes.size > 8) w.push("أحجام خطوط كثيرة (" + sizes.size + ") — وحّدها في سلّم من 4–6 أحجام");
    if (fams.size > 2) w.push("أكثر من خطّين مختلفين (" + fams.size + ") — الأفضل خط للعناوين وآخر للنص");
    return w.slice(0, 40);
  }

  /* ───────────── التحويل إلى عناصر المطوّر ───────────── */
  const pb = () => (typeof PB !== "undefined" ? PB : null);
  const fxItem = (name, tpl, p) => ({ id: pb().uid(), n: name, on: true, tpl, p: Object.keys(p || {}).reduce((r, k) => { const v = p[k]; r[k] = { l: v[0], t: v[1], v: v[2] }; return r; }, {}) });
  const U = "var(--u,1px)";
  const inner = { text: ".pb-t", heading: ".pb-t", image: ".pb-im", shape: ".pb-svg", button: ".pb-btn", icon: ".pb-ibi" };
  function shadowFx(L) {
    const s = L.shadow; if (!s) return null; const t = L.type;
    const P = { x: ["إزاحة أفقية", "num", s.x], y: ["إزاحة رأسية", "num", s.y], b: ["التمويه", "num", s.blur], c: ["اللون", "text", s.color] };
    if (t === "text" || t === "heading") return fxItem("ظل النص", "selector .pb-t{text-shadow:calc(" + U + "*[[x]]) calc(" + U + "*[[y]]) calc(" + U + "*[[b]]) [[c]]}", P);
    if (t === "image" && s.follow) return fxItem("ظل يتبع الشكل", "selector .pb-im{filter:drop-shadow(calc(" + U + "*[[x]]) calc(" + U + "*[[y]]) calc(" + U + "*[[b]]) [[c]])}", P);
    if (t === "shape") return fxItem("ظل الشكل", "selector .pb-svg{filter:drop-shadow(calc(" + U + "*[[x]]) calc(" + U + "*[[y]]) calc(" + U + "*[[b]]) [[c]])}", P);
    P.s = ["الانتشار", "num", s.spread];
    return fxItem("ظل", "selector" + (t === "button" ? " .pb-btn" : "") + "{box-shadow:" + (s.inset ? "inset " : "") + "calc(" + U + "*[[x]]) calc(" + U + "*[[y]]) calc(" + U + "*[[b]]) calc(" + U + "*[[s]]) [[c]]}", P);
  }
  function effectFx(L, e, kid) {
    const sel = "selector " + (inner[L.type] || ""), K = "k" + kid + e.type, d = e.duration, a = e.amount;
    switch (e.type) {
      case "float": return fxItem("طفو", sel + "{animation:" + K + " [[d]]s ease-in-out infinite}@keyframes " + K + "{50%{transform:translateY(calc(" + U + "*-[[a]]))}}", { a: ["المسافة", "num", a], d: ["الدورة ثانية", "num", d] });
      case "pulse": return fxItem("نبض", sel + "{animation:" + K + " [[d]]s ease-in-out infinite}@keyframes " + K + "{50%{transform:scale(1.06)}}", { d: ["الدورة ثانية", "num", Math.min(d, 3)] });
      case "sway": return fxItem("تأرجح", sel + "{animation:" + K + " [[d]]s ease-in-out infinite}@keyframes " + K + "{50%{transform:rotate(3deg)}}", { d: ["الدورة ثانية", "num", d] });
      case "spin": return fxItem("دوران", sel + "{animation:" + K + " [[d]]s linear infinite}@keyframes " + K + "{to{transform:rotate(360deg)}}", { d: ["الدورة ثانية", "num", Math.max(d, 4)] });
      case "glow": return fxItem("توهج", sel + "{animation:" + K + " [[d]]s ease-in-out infinite}@keyframes " + K + "{50%{filter:" + (L.type === "text" || L.type === "heading" ? "drop-shadow(0 0 [[r]]px [[c]])" : "drop-shadow(0 0 [[r]]px [[c]])") + "}}", { r: ["نصف التوهج", "num", Math.max(8, a)], c: ["اللون", "text", e.color || "rgba(255,210,80,.9)"], d: ["الدورة ثانية", "num", Math.min(d, 4)] });
      case "kenburns": return L.type === "image" ? fxItem("تكبير سينمائي", sel + "{animation:" + K + " [[d]]s ease-in-out infinite alternate}@keyframes " + K + "{from{transform:scale(1)}to{transform:scale([[z]])}}", { z: ["نسبة التكبير", "num", 1 + a / 100], d: ["الدورة ثانية", "num", d] }) : null;
      case "sweep": return (L.type === "image" || L.type === "button" || L.type === "shape") ? fxItem("لمعة تعبر", "selector{position:relative;overflow:hidden}selector::after{content:\"\";position:absolute;top:0;left:-80%;width:45%;height:100%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-22deg);animation:" + K + " [[d]]s ease-in-out infinite}@keyframes " + K + "{0%,60%{left:-80%}100%{left:150%}}", { d: ["الدورة ثانية", "num", Math.max(d, 3)] }) : null;
      case "hoverLift": return fxItem("رفع بالمرور", sel + "{transition:transform .45s cubic-bezier(.2,.8,.2,1)}" + sel.replace(/\s+$/, "") + ":hover{transform:translateY(calc(" + U + "*-8))}", {});
      case "hoverZoom": return fxItem("تكبير بالمرور", sel + "{transition:transform .5s cubic-bezier(.2,.8,.2,1)}" + sel.replace(/\s+$/, "") + ":hover{transform:scale([[z]])}", { z: ["نسبة التكبير", "num", 1.06] });
      case "hoverTilt": return fxItem("ميلان بالمرور", sel + "{transition:transform .4s cubic-bezier(.2,.8,.2,1)}" + sel.replace(/\s+$/, "") + ":hover{transform:scale(1.08) rotate(-3deg)}", {});
    }
    return null;
  }
  const IMG_ANIM = { float: "float", kenburns: "kb", pulse: "pulse", sway: "sway", spin: "spin" };

  function gradObj(g) { return g ? { t: g.t, a: g.a, s: g.s.map(x => ({ c: x.c, p: x.p })) } : null; }
  function layerToWidget(L, dw, ctx) {
    const P = pb(), x = Math.round(L.x / dw * 1000) / 10, wp = Math.round(L.w / dw * 1000) / 10; let w;
    const free = (type, h) => { w = P.mkFree(type, x, L.y, L.z); w.set.fx = { d: x }; w.set.fy = { d: Math.round(L.y) }; w.set.fwd = { d: wp }; w.set.fh = { d: Math.round(h || L.h || P.FREE_SIZE[type][1]) }; return w; };
    if (L.type === "text" || L.type === "heading") {
      const html = esc(L.text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
      free(L.type, L.h || Math.ceil(L.text.split("\n").length * L.font.size * L.font.lineHeight) + 8);
      const t = { fs: { d: L.font.size }, fw: L.font.weight, color: L.font.color, ta: { d: L.font.align }, lh: { d: L.font.lineHeight } };
      if (L.font.letterSpacing) t.ls = { d: L.font.letterSpacing };
      if (L.font.family) { const f = (P.FONT_FAMS || []).find(x => x[0].toLowerCase() === L.font.family.toLowerCase()); if (f) t.ff = "'" + f[0] + "','Cairo',sans-serif"; }
      if (L.type === "heading") Object.assign(w.set, t, { text: L.text.replace(/\*\*/g, ""), tag: L.tag === "p" || L.tag === "div" ? L.tag : L.tag });
      else Object.assign(w.set, t, { html: "<p>" + html + "</p>" });
      if (L.h && !L.autoH) w.set.hauto = false;
    } else if (L.type === "image") {
      free("image", L.h || Math.round(L.w * .75)); w.set.hauto = false; Object.assign(w.set, { src: resolveImg(L, ctx), alt: L.alt, fit: L.fit }); if (L.cutout && !w.set.src) w.set.__cutout = true; if (L.crop) w.set.crop = L.crop; const am = /^asset:([\w-]+)$/.exec(L.src || ""), ap = am && (ctx.assets || {})[am[1]]; let pr = L.prompt || (ap && ap.prompt) || "";
      if (!w.set.src && !pr) pr = L.alt || ((ctx.title || "") + " — صورة تسويقية للمنتج").trim();   /* صورة بلا مصدر ولا وصف: نُنشئ وصفاً من النص البديل ليولَّدها الزر */
      if (pr && !w.set.src) w.set.aiPrompt = pr; if (L.cutout) w.set.aiCut = true;
      if (L.brightness !== 100) w.set.ibri = L.brightness; if (L.contrast !== 100) w.set.icon = L.contrast; if (L.saturate !== 100) w.set.isat = L.saturate;
    } else if (L.type === "shape") {
      free("shape", L.h || L.w); w.set.keep = false; Object.assign(w.set, { shape: L.shape, fill: L.fill });
      if (L.gradient) { w.set.fgr = gradObj(L.gradient); }
      if (L.stroke && L.strokeW) { w.set.stroke = L.stroke; w.set.sw = L.strokeW; }
      if (L.shape === "rect" && L.radius) { w.set.rx = Math.min(50, Math.round(L.radius / Math.max(1, Math.min(L.w, L.h || L.w)) * 100)); }
    } else if (L.type === "button") {
      free("button", L.h || 64); Object.assign(w.set, { text: L.text, link: L.link, bgc: L.bg, color: L.color, fs: { d: L.size }, fw: L.weight, brad: { d: L.radius || 40 }, al: { d: "center" } });
      if (L.gradient) w.set.bgr = gradObj(L.gradient); if (L.effects.some(e => e.type === "shine")) w.set.fxShine = true;
    } else if (L.type === "icon") {
      free("iconbox", L.h || L.size + 40); Object.assign(w.set, { icon: /^img:/.test(L.icon) ? L.icon : "ic:" + L.icon, title: L.title, text: L.text, isz: { d: L.size } });
      w.set.fxs = [fxItem("لون الأيقونة", "selector .pb-ibi{color:[[c]]}", { c: ["اللون", "text", L.color] }), fxItem("محاذاة", "selector{text-align:center}" + (L.title || L.text ? "" : "selector .pb-ib{padding:0}selector .pb-ibi{margin:0;line-height:1}"), {})];
    } else if (L.type === "video") {
      const h = L.h || Math.round(L.w * 9 / 16), r = L.w / Math.max(1, h), ratio = [["16/9", 16 / 9], ["4/3", 4 / 3], ["1/1", 1], ["9/16", 9 / 16]].sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
      free("video", h); Object.assign(w.set, { url: L.src, poster: resolveImg({ src: L.poster }, ctx), vauto: !!L.autoplay, ratio });
    } else if (L.type === "price") {
      free("pprice", L.h || 80); w.set.prod = ctx.product || "";
    } else if (L.type === "offers") {
      free("poffers", L.h || 200); w.set.prod = ctx.product || "";
    }
    /* خصائص مشتركة */
    if (L.rot) w.set.rot = { d: L.rot };
    if (L.locked) w.set.locked = true; if (L.hidden) w.set.hd = w.set.ht = w.set.hm = true;
    if (L.opacity < 1) w.set.op = L.opacity;
    if (L.radius && L.type !== "shape" && L.type !== "button") w.set.rad = { d: L.radius };
    if (L.border && L.border.w) { w.set.bw = L.border.w; w.set.bs = L.border.style; w.set.bc = L.border.color; }
    if (L.gradient && L.type !== "shape" && L.type !== "button") { w.set.gr = gradObj(L.gradient); }
    if (L.type === "shape" && L.blur) { (w.set.fxs = w.set.fxs || []).push(fxItem("زجاج (تمويه الخلفية)", "selector{backdrop-filter:blur(calc(" + U + "*[[b]]));-webkit-backdrop-filter:blur(calc(" + U + "*[[b]]))}", { b: ["التمويه", "num", L.blur] })); }
    else if (L.blur) { (w.set.fxs = w.set.fxs || []).push(fxItem("تمويه", "selector{filter:blur(calc(" + U + "*[[b]]))}", { b: ["التمويه", "num", L.blur] })); }
    if (L.blend) (w.set.fxs = w.set.fxs || []).push(fxItem("نمط المزج", "selector{mix-blend-mode:" + L.blend + "}", {}));
    const fx = w.set.fxs = w.set.fxs || []; const sh = shadowFx(L); if (sh) fx.push(sh);
    if (L.type === "image" && L.fade && (L.fade.t || L.fade.b || L.fade.l || L.fade.r)) { const m = "linear-gradient(to bottom,transparent 0,#000 [[t]]%,#000 calc(100% - [[b]]%),transparent 100%),linear-gradient(to right,transparent 0,#000 [[l]]%,#000 calc(100% - [[r]]%),transparent 100%)"; fx.push(fxItem("تلاشي حواف الصورة", "selector " + (L.crop ? ".pb-cropbox" : ".pb-im") + "{-webkit-mask-image:" + m + ";mask-image:" + m + ";-webkit-mask-composite:source-in;mask-composite:intersect}", { t: ["أعلى %", "num", L.fade.t], b: ["أسفل %", "num", L.fade.b], l: ["يسار %", "num", L.fade.l], r: ["يمين %", "num", L.fade.r] })); }
    if ((sh || L.effects.some(e => CONT.includes(e.type))) && !(L.type === "image" && L.radius)) fx.push(fxItem("السماح بالظل والحركة خارج الإطار", "selector{overflow:visible!important}", {}));
    let ent = false; L.effects.forEach(e => {
      if (ENTR.includes(e.type)) { if (!ent) { w.set.anim = e.type; w.set.animDur = e.duration; w.set.animDelay = e.delay; ent = true; } return; }
      if (L.type === "image" && IMG_ANIM[e.type]) { w.set.ianim = IMG_ANIM[e.type]; w.set.ianimDur = Math.max(.2, e.duration); w.set.ianimAmt = Math.min(100, e.amount); return; }
      if (e.type === "shine" && L.type === "button") return;
      const f = effectFx(L, e, w.id.replace(/[^\w]/g, "")); if (f) fx.push(f);
    });
    if (!fx.length) delete w.set.fxs; if (L.name) w.set.cls = ""; return w;
  }
  function resolveImg(L, ctx) {
    const s = L.src; if (!s) return "";
    let m = /^product:(cover|img(?::(\d+))?)$/.exec(s), p = (ctx.products || []).find(x => x.slug === ctx.product);
    if (m && p) return m[1] === "cover" ? (p.cover || (p.images || [])[0] || "") : ((p.images || [])[Number(m[2] || 0)] || "");
    m = /^asset:([\w-]+)$/.exec(s); if (m) { const a = (ctx.assets || {})[m[1]]; return a && a.src ? a.src : ""; }
    return imgSrc(s);
  }
  /* دمج الأقسام المتتالية في «صفحة طويلة» واحدة: خلفية كل قسم تصير طبقة شكل/صورة بعرض الصفحة، وتُزاح طبقاته بارتفاع ما قبله؛
     فلا تبقى فواصل أقسام ويُقصّ طول الصفحة من حافتها السفلية. قسم «الطلب» يبقى مستقلاً (نموذج حقيقي). */
  function mergeRuns(spec) {
    const dw = spec.page.width, out = []; let run = [];
    const flush = () => {
      if (run.length <= 1) { run.forEach(S => out.push(S)); run = []; return; }
      const M = { kind: "canvas", name: "page", height: 0, bg: "", gradient: null, bgImage: "", bgDark: 0, title: "", note: "", layers: [] };
      run.forEach((S, si) => {
        const off = M.height, H = S.height, add = (L, z, id) => { const c = cleanLayer(L, dw, H, [], ""); if (!c) return; c.y += off; c.z = z; if (id) c.name = id; M.layers.push(c); };
        if (S.bg || S.gradient) add({ type: "shape", shape: "rect", x: 0, y: 0, w: dw, h: H, fill: S.bg || "#ffffff", gradient: S.gradient || undefined, locked: true }, 1, "خلفية " + (S.name || (si + 1)));
        if (S.bgImage) add({ type: "image", src: S.bgImage, x: 0, y: 0, w: dw, h: H, fit: "cover", locked: true }, 1, "صورة خلفية");
        if (S.bgDark) add({ type: "shape", shape: "rect", x: 0, y: 0, w: dw, h: H, fill: "#000000", opacity: S.bgDark, locked: true }, 2);
        S.layers.forEach(L => { const c = Object.assign({}, L, { y: L.y + off, z: (L.z || 0) + 30 }); if (c.group) c.group = "s" + si + "_" + c.group; M.layers.push(c); });
        M.height += H;
      });
      out.push(M); run = [];
    };
    spec.sections.forEach(S => { if (S.kind === "order") { flush(); out.push(S); } else run.push(S); });
    flush(); return out;
  }
  function toSections(spec, ctx) {
    const P = pb(); ctx = Object.assign({ products: (typeof Admin !== "undefined" && Admin.products) || (typeof PRODUCTS !== "undefined" ? PRODUCTS : []) }, ctx || {});
    ctx.product = ctx.product || spec.page.product || ""; ctx.assets = spec.assets; ctx.title = ctx.title || spec.page.title || ""; const dw = spec.page.width, out = [], pending = [];
    (ctx.merge === false ? spec.sections : mergeRuns(spec)).forEach(S => {
      const bgImg = (() => { const m = /^asset:([\w-]+)$/.exec(S.bgImage || ""); const a = m && spec.assets[m[1]]; return a ? a.src : imgSrc(S.bgImage); })();
      const base = { bg: S.bg || undefined, bgImg: bgImg || undefined, bgDark: S.bgDark || undefined, gr: gradObj(S.gradient) || undefined, cls: "" };
      Object.keys(base).forEach(k => base[k] === undefined && delete base[k]);
      if (S.kind === "order") {
        const cols = [];
        if (S.title) cols.push(P.mkW("heading", { text: S.title, tag: "h2", fs: { d: 38, m: 26 }, fw: "900", ta: { d: "center" }, color: "#ffffff" }));
        if (S.note) cols.push(P.mkW("text", { html: "<p>" + esc(S.note) + "</p>", fs: { d: 16 }, ta: { d: "center" }, color: "#fef3c7" }));
        const ow = P.mkW("orderorig", { prod: ctx.product }); cols.push(ow);
        const sec = P.mkS([P.mkC(cols)], Object.assign({ layout: "boxed", cw: { d: 1000 }, pad: { d: [50, 20, 50, 20], m: [30, 12, 30, 12] } }, base, S.bg || S.gradient ? {} : { bg: "#1e5e20" })); sec.set.cid = "order"; out.push(sec); return;
      }
      const sec = P.mkCanvas(); Object.assign(sec.set, base, { scaled: true, dw, cw: { d: dw }, mh: { d: S.height }, layout: "boxed" }); sec.set.pad = { d: [0, 0, 0, 0] };
      if (S.name) sec.set.cid = S.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || undefined; if (!sec.set.cid) delete sec.set.cid;
      const gm = {}; sec.free = S.layers.slice().sort((a, b) => a.z - b.z).map(L => { const w = layerToWidget(L, dw, ctx); if (L.group) w.set.grp = gm[L.group] = gm[L.group] || "g" + P.uid(); if (L.type === "image" && !w.set.src && L.prompt) pending.push({ id: w.id, prompt: L.prompt }); return w; });
      out.push(sec);
    });
    out.pending = pending; return out;
  }
  function toPage(spec, ctx) {
    const P = pb(), pg = P.newPage(spec.page.title, ""), secs = toSections(spec, ctx); pg.sections = secs; pg.bg = spec.page.bg; if (spec.page.product) pg.product = spec.page.product; pg.header = false; pg.footer = false; pg.pending = secs.pending;
    pg.specMeta = { format: FORMAT, v: 1, at: Date.now(), plan: spec.plan || null, assets: spec.assets || {}, fixes: (spec.fixes || []).slice(0, 30), product: spec.page.product || "" }; return pg;
  }

  /* ───────────── البرومبت (يُعطى لأي نموذج ذكاء) ───────────── */
  const SAMPLE = {
    format: FORMAT, page: { title: "عسل طبيعي", width: 1080, bg: "#ffffff", lang: "ar", product: "" },
    assets: { hero: { src: "assets/img/tpl/generic-honey.webp", prompt: "" } },
    sections: [{
      name: "hero", height: 760, gradient: { type: "linear", angle: 180, stops: [{ c: "#fff8e1", p: 0 }, { c: "#ffffff", p: 100 }] }, layers: [
        { type: "shape", shape: "ellipse", x: 560, y: 90, w: 520, h: 520, z: 1, fill: "#ffe082", opacity: .55, blur: 30, effects: [{ type: "pulse", duration: 6 }] },
        { type: "image", src: "asset:hero", x: 600, y: 120, w: 420, h: 520, z: 3, fit: "contain", shadow: { x: 0, y: 24, blur: 36, color: "rgba(120,70,0,.35)", follow: true }, effects: [{ type: "zoomIn", delay: .1 }, { type: "float", amount: 12, duration: 5 }] },
        { type: "heading", tag: "h1", text: "عسل طبيعي\nبنكهة أصيلة", x: 60, y: 160, w: 500, z: 4, font: { size: 64, weight: 900, color: "#8a5a00", align: "right", lineHeight: 1.25 }, shadow: { x: 0, y: 3, blur: 8, color: "rgba(0,0,0,.18)" }, effects: [{ type: "fadeUp" }] },
        { type: "text", text: "مصدر طبيعي للطاقة اليومية. اطلب الآن والدفع عند الاستلام.", x: 60, y: 400, w: 500, z: 4, font: { size: 28, weight: 600, color: "#4e342e", align: "right", lineHeight: 1.7 }, effects: [{ type: "fadeUp", delay: .15 }] },
        { type: "button", text: "اطلب الآن", link: "#order", x: 60, y: 560, w: 320, h: 78, z: 5, bg: "#2e7d32", color: "#ffffff", radius: 40, font: { size: 28 }, shadow: { x: 0, y: 10, blur: 24, color: "rgba(46,125,50,.45)" }, effects: [{ type: "fadeUp", delay: .3 }, { type: "pulse" }, { type: "shine" }] }]
    }, {
      name: "benefits", height: 360, bg: "#f1f8e9", layers: [
        { type: "icon", icon: "leaf", x: 60, y: 70, w: 280, size: 64, color: "#2e7d32", title: "طبيعي 100%", text: "بمكوّنات مختارة", z: 2, effects: [{ type: "fadeUp" }] },
        { type: "icon", icon: "truck", x: 400, y: 70, w: 280, size: 64, color: "#2e7d32", title: "توصيل سريع", text: "لكل الولايات", z: 2, effects: [{ type: "fadeUp", delay: .1 }] },
        { type: "icon", icon: "cash", x: 740, y: 70, w: 280, size: 64, color: "#2e7d32", title: "الدفع عند الاستلام", text: "بلا مخاطرة", z: 2, effects: [{ type: "fadeUp", delay: .2 }] }]
    }, { kind: "order", title: "اطلب الآن", note: "منتج غذائي ولا يغني عن استشارة الطبيب." }]
  };
  const DOC = `صيغة المخرجات: JSON واحد فقط (بلا شرح ولا Markdown) بالشكل:
{"format":"${FORMAT}","page":{"title":"","width":1080,"bg":"#ffffff","lang":"ar","product":"<slug>"},
 "assets":{"اسم":{"prompt":"وصف صورة بلا أي كتابة"}},
 "sections":[{"name":"hero","height":760,"bg":"#fff","gradient":{"type":"linear","angle":180,"stops":[{"c":"#fff8e1","p":0},{"c":"#ffffff","p":100}]},"bgImage":"asset:اسم","bgDark":0,
   "layers":[ ...طبقات... ]},
  {"kind":"order","title":"اطلب الآن","note":"تنبيه قصير"}]}
أنواع الطبقات (type) وحقولها — كل الإحداثيات بالبكسل على عرض الصفحة المرجعي (width)، x من اليسار وy من أعلى القسم، z الأكبر أمام:
- heading/text: text (\\n لسطر جديد، **غامق**)، x,y,w (و h اختياري)، font:{size,weight,color,align:right|center|left,lineHeight,letterSpacing,family}، tag للعنوان (h1|h2|h3)
- image: src ("product:cover" أو "product:img:N" أو "asset:اسم") — أو بلا src مع prompt (وصف بالإنجليزية بلا أي كتابة) فتُولَّد الصورة تلقائياً؛ cutout:true لعنصر معزول على خلفية شفافة (منتج/مكوّن)؛ x,y,w,h، fit:cover|contain، radius، brightness/contrast/saturate
- shape: shape (${SHAPES.join("|")})، x,y,w,h، fill أو gradient، stroke,strokeW، radius (للمستطيل)، blur (زجاج)
- button: text, link ("#order")، x,y,w,h، bg، color، radius، font:{size}
- icon: icon (${ICONS.join("|")})، color، size، title، text، x,y,w
- price / offers: يعرضان سعر وعروض المنتج الحقيقية (لا تكتب أرقاماً بنفسك)
- video: src (https mp4/webm)، poster، autoplay (صامت متكرر)، x,y,w,h
خصائص مشتركة لأي طبقة: rot (درجة)، opacity (0..1)، radius، border:{w,color,style}، blur، blend (${BLENDS.join("|")})،
 shadow:{x,y,blur,spread,color,inset,follow} (follow=true لظل يتبع شكل صورة شفافة)،
 effects:[{type,delay,duration,amount}] حيث type من: دخول (${ENTR.join("|")}) أو مستمر (${CONT.join("|")}).`;
  const RULES = `قواعد التصميم:
1) كل نص طبقة text/heading مستقلة — ممنوع أي كتابة داخل الصور (الصور المطلوبة بلا نصوص ولا شعارات ولا علامات مائية).
2) لا تخترع أسعاراً ولا خصومات ولا آراء زبائن ولا ادّعاءات علاجية؛ استعمل price/offers والبيانات المعطاة فقط.
3) لا نساء بلا خمار ولا أجزاء مكشوفة من الجسم غير الوجه واليدين في أوصاف الصور.
4) العربية: النص من اليمين (align:"right" أو "center")، هوامش جانبية ≥ 48px، لا تداخل بين النصوص، حجم الخط ≥ 28 لعرض 1080 (ليبقى مقروءاً على الجوال).
5) تباين ألوان واضح (نص داكن على خلفية فاتحة أو العكس)، ولون أو اثنان للتمييز فقط.
6) أضف عمقاً بالظلال (shadow) وحركات ظهور متدرّجة (delay)، وحركة مستمرة واحدة على الأكثر للعنصر.
7) أنهِ الصفحة بقسم {"kind":"order"} (نموذج الطلب الحقيقي).
8) كل قسم ارتفاعه (height) يتّسع لكل طبقاته. أقسام الصفحة بأسماء (name) إنجليزية مستقلة قابلة للتعديل كلٌّ على حدة: header (شعار نصي + زر)، hero، problem، solution، benefits، ingredients، offers (price/offers الحقيقيان)، reviews (فقط إن أُعطيت آراء حقيقية وإلا احذفه كلياً)، faq، ثم {"kind":"order"}، ثم footer (اسم المتجر وتنبيه بسيط بلا روابط مخترعة).
9) فيديو اختياري: طبقة {"type":"video","src":"https://… mp4/webm","poster":"asset:اسم أو product:cover","autoplay":false,"x":…,"y":…,"w":…,"h":…} — لا تخترع رابط فيديو؛ استعمل فيديو فقط إن أُعطيت رابطه.
10) لتحريك أو حذف مجموعة معاً أعطِ طبقاتها المترابطة نفس "group" (نص قصير)؛ وللطبقة قفل locked:true وإخفاء hidden:true عند الحاجة.`;
  function planPrompt(o) {
    o = o || {}; const L = { ar: "العربية (RTL)", fr: "الفرنسية", en: "الإنجليزية" }[o.lang] || "العربية (RTL)";
    return `أنت مدير فني لصفحات الهبوط. قبل الرسم ضع «خطة تصميم» موجزة لصفحة منتج التجارة الإلكترونية التالي، ثم سنحوّلها إلى طبقات.
المنتج: ${o.name || "—"}
الوصف: ${o.desc || "—"}
الجمهور/الهدف: ${o.goal || "—"}
${o.colors ? "ألوان العلامة المطلوبة: " + o.colors + "\n" : ""}${o.style ? "الأسلوب البصري: " + o.style + "\n" : ""}اللغة: ${L}
${o.type === "banner" ? "النوع: بنر/إعلان بقسم واحد" : "النوع: صفحة هبوط كاملة (header, hero, problem, solution, benefits, ingredients, offers, reviews إن توفرت آراء حقيقية فقط, faq, order, footer)"}

أخرج JSON واحداً فقط بلا شرح بالشكل:
{"concept":"فكرة التصميم في جملتين","tone":"نبرة الكلام","palette":{"primary":"#hex","secondary":"#hex","accent":"#hex","bg":"#hex","text":"#hex"},
 "sections":[{"name":"hero","goal":"هدف القسم","layout":"وصف التخطيط والعناصر"}],
 "assets":[{"name":"اسم_قصير","prompt":"وصف إنجليزي لصورة بلا أي كتابة أو شعارات","cutout":true}]}
قواعد: الصور المطلوبة منفصلة وبلا نصوص ولا أسعار ولا أزرار؛ منتج العميل الحقيقي يُستعمل كما هو (لا يُولَّد)؛ لا آراء ولا ادّعاءات علاجية مخترعة؛ لا نساء بلا خمار.${o.extra ? "\n" + o.extra : ""}`;
  }
  function prompt(o, plan) {
    o = o || {}; const L = { ar: "العربية (RTL)", fr: "الفرنسية", en: "الإنجليزية" }[o.lang] || "العربية (RTL)";
    return `أنت مصمّم صفحات هبوط محترف. صمّم صفحة هبوط لمنتج التجارة الإلكترونية التالي بنفس جودة التصاميم المرسومة، لكن على شكل طبقات منفصلة قابلة للتحرير (وليس صورة).
المنتج: ${o.name || "—"}
الوصف: ${o.desc || "—"}
الجمهور/الهدف: ${o.goal || "—"}
اللغة: ${L} — عرض الصفحة المرجعي: ${o.width || 1080}px — عدد الأقسام المطلوب: ${o.sections || "8 إلى 12"}
${o.style ? "الأسلوب البصري: " + o.style + "\n" : ""}${o.colors ? "ألوان العلامة: " + o.colors + "\n" : ""}${o.type === "banner" ? "النوع: بنر/إعلان بقسم واحد فقط (بلا قسم order) بارتفاع " + (o.height || 1080) + "px\n" : ""}العروض الفعلية (للمعلومة فقط، لا تكتب أرقامها): ${o.offers || "تُجلب من المنتج"}

${DOC}

${RULES}
${plan ? "\nخطة التصميم المعتمدة (التزم بألوانها وأقسامها وأصولها، وضع صورها في assets بنفس الأسماء):\n" + JSON.stringify(plan) + "\n" : ""}
مثال مصغّر على الصيغة (مثال فقط — لا تنسخ محتواه):
${JSON.stringify(SAMPLE)}

${o.extra ? o.extra + "\n" : ""}
أخرج الآن JSON واحداً فقط.`;
  }

  /* ───────────── التوليد المباشر (Alyssum API) ───────────── */
  let RUN = null;
  const cancel = () => { if (RUN) RUN.cancelled = true; };
  const aborted = () => { const e = new Error("أُلغيت العملية"); e.code = "CANCEL"; return e; };
  const race = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(Object.assign(new Error("انتهت مهلة الطلب"), { code: "TIMEOUT" })), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
  async function generate(o) {
    o = o || {}; if (typeof ImgGen === "undefined" || !ImgGen.text) throw new Error("أداة التوليد غير متاحة");
    const say = o.say || (() => { }); RUN = { cancelled: false }; const run = RUN; let plan = null;
    try {
      if (o.plan !== false) {
        say("⏳ ١/٢ خطة التصميم (ألوان، أقسام، أصول)…");
        try { const pr = await race(ImgGen.text({ prompt: planPrompt(o), json: true, temp: .7, blobs: o.blobs }), 120000); if (pr && typeof pr === "object") plan = cleanPlan(pr); }
        catch (e) { if (e.code === "NOKEY" || e.code === "OFF") throw e; }
      }
      if (run.cancelled) throw aborted();
      say(plan ? "⏳ ٢/٢ تحويل الخطة إلى طبقات…" : "⏳ جارٍ توليد التصميم…");
      const r = await race(ImgGen.text({ prompt: prompt(o, plan), json: true, temp: .8, blobs: o.blobs }), 180000);
      if (run.cancelled) throw aborted();
      if (plan && r && typeof r === "object" && !r.plan) r.plan = plan; return r;
    } finally { if (RUN === run) RUN = null; }
  }

  /* ───────────── توليد صور الطبقات الفارغة (Alyssum API) في الصفحة المفتوحة ───────────── */
  const IMG_RULES = "Photorealistic professional e-commerce marketing image. ABSOLUTELY no text, letters, numbers, logos, watermarks, labels or UI elements anywhere. No people; if hands are needed show only hands; never an uncovered woman. Clean composition, soft studio lighting, high detail. Subject: ";
  function emptyImages() {
    const P = typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page; if (!P) return []; const out = [];
    (P.sections || []).forEach(sec => (sec.free || []).forEach(w => { if (w.type === "image" && !w.set.src && String(w.set.aiPrompt || w.set.alt || "").trim().length > 8) { w.__dw = Number(sec.set && sec.set.dw) || 1080; out.push(w); } }));
    return out;
  }
  /* كاش الأصول (نفس الوصف والمقاس لا يُولَّد ثانية عند تعديل النص/السعر) + سجلّ التوليد (بلا أي مبالغ تُعرض في الواجهة) */
  const CK = "alyssum_spec_assets", LK = "alyssum_spec_costlog";
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (_) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { } };
  const hash = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  const assetKey = (pr, W, H, cut) => hash([String(pr).trim().toLowerCase(), Math.round(W / 50), Math.round(H / 50), cut ? 1 : 0].join("|"));
  const cache = {
    get: k => { const e = lsGet(CK, {})[k]; return e && e.p || ""; },
    put: (k, path) => { const m = lsGet(CK, {}); m[k] = { p: path, t: Date.now() }; const ks = Object.keys(m); if (ks.length > 150) ks.sort((a, b) => m[a].t - m[b].t).slice(0, ks.length - 150).forEach(x => delete m[x]); lsSet(CK, m); },
    drop: k => { const m = lsGet(CK, {}); delete m[k]; lsSet(CK, m); }
  };
  const costLog = e => { const l = lsGet(LK, []); l.push(Object.assign({ t: Date.now() }, e)); lsSet(LK, l.slice(-200)); };
  const headOk = async path => { try { const r = await fetch(path, { method: "HEAD", cache: "no-store" }); return r.ok; } catch (_) { return true; } };
  /* المنتج المرجعي للصفحة المفتوحة: المنتج المربوط بها (غلافه) وإلا أول صورة حقيقية فيها — فلا تُولَّد صور عامة لا علاقة لها بالمنتج */
  const fetchBlob = async src => { try { const r = await fetch(/^(https?:|data:|blob:)/.test(src) ? src : String(src).replace(/^\/+/, ""), { cache: "force-cache" }); return r.ok ? await r.blob() : null; } catch (_) { return null; } };
  async function productRef(P) {
    const ps = (typeof Admin !== "undefined" && Admin.products) || (typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
    let slug = P.product || (P.specMeta && P.specMeta.product) || ""; const widgets = []; (P.sections || []).forEach(sec => (sec.free || []).forEach(w => widgets.push(w)));
    if (!slug) { const wp = widgets.find(w => w.set && w.set.prod && w.set.prod !== "__page"); slug = wp ? wp.set.prod : ""; }
    const p = ps.find(x => x.slug === slug) || null; let src = p ? (p.cover || (p.images || [])[0] || "") : "";
    if (!src) { const w = widgets.find(x => x.type === "image" && x.set && x.set.src && !/\/icons\//.test(x.set.src)); src = w ? w.set.src : ""; }
    const blob = src ? await fetchBlob(src) : null;
    const title = (p && p.title) || P.title || P.name || "", desc = String((p && (p.desc || p.description || p.short)) || (P.specMeta && P.specMeta.plan && P.specMeta.plan.concept) || "").replace(/\s+/g, " ").slice(0, 320);
    return { blob, title, desc, slug, key: (slug || "") + ":" + (blob ? blob.size : 0) };
  }
  const NOREF = /ingredient|texture|pattern|background|backdrop|leaf|leaves|flower|pollen|honeycomb|herb|abstract|gradient|spice|seed|مكوّن|مكون|خلفية|ملمس|نمط|عشب|أوراق/i;
  async function fillImages(o) {
    o = o || {}; const list = emptyImages(), say = o.say || (() => { }); if (!list.length) return { done: 0, failed: 0, total: 0, cached: 0 };
    if (typeof ImgGen === "undefined" || !ImgGen.edit) throw new Error("أداة التوليد غير متاحة");
    const rd = ImgGen.ready(); if (!rd.ok) { const e = new Error(rd.off ? "OFF" : "NOKEY"); e.code = rd.off ? "OFF" : "NOKEY"; throw e; }
    const exists = o.exists || headOk, run = RUN = { cancelled: false }; const plan = [];
    const PR = o.ref === false ? { blob: null, title: "", desc: "", key: "" } : await productRef((typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page) || {});
    try {
      for (const w of list) {
        const fw = w.set.fwd && w.set.fwd.d, fh = w.set.fh && w.set.fh.d, dw = w.__dw || o.dw || 1080, W0 = Math.max(200, (Number(fw) || 40) / 100 * dw), H0 = Math.max(200, Number(fh) || W0), k = Math.min(1, 1400 / Math.max(W0, H0));
        const desc = String(w.set.aiPrompt || w.set.alt).slice(0, 400), cut = !!(w.set.__cutout || w.set.aiCut), W = Math.round(W0 * k), H = Math.round(H0 * k), useRef = !!PR.blob && !NOREF.test(desc), key = assetKey(desc + "|" + PR.key + (useRef ? "|R" : ""), W, H, cut);
        const hit = cache.get(key); plan.push({ w, desc, cut, W, H, key, useRef, hit: hit && (await exists(hit)) ? hit : "" });
      }
      const need = plan.filter(x => !x.hit).length;
      if (need && o.confirm !== false && !confirm("سيُولَّد " + need + " صورة بتقنية Alyssum API وتُستهلك من رصيدك (بلا أي كتابة داخل الصور)" + (plan.length > need ? " — و" + (plan.length - need) + " أخرى جاهزة من الكاش بلا استهلاك" : "") + ". المتابعة؟")) return { done: 0, failed: 0, total: list.length, cancelled: true, cached: 0 };
      let done = 0, failed = 0, cached = 0, lastErr = "";
      for (let i = 0; i < plan.length; i++) {
        if (run.cancelled) return { done, failed, total: list.length, cached, cancelled: true, error: lastErr };
        const it = plan[i], w = it.w, t0 = Date.now();
        if (it.hit) { w.set.src = it.hit; delete w.set.__cutout; delete w.__dw; done++; cached++; costLog({ title: it.desc.slice(0, 40), ok: true, cached: true }); if (PBApp.renderCanvas) PBApp.renderCanvas(); continue; }
        say("⏳ توليد الصورة " + (i + 1) + " من " + plan.length + "…");
        let ok = false, tries = 0;
        while (!ok && tries < 2 && !run.cancelled) {
          tries++;
          try {
            const ctxTxt = PR.title ? " The marketing page is for this specific product: \"" + PR.title + "\"" + (PR.desc ? " — " + PR.desc : "") + ". Everything in the image must clearly relate to this product; do not draw unrelated generic objects (wallets, offices, laptops, stock-photo scenes)." : "";
            const cutTxt = it.cut ? " Isolated on a plain flat light-gray (#e6e6e6) background, no cast shadow on the background." : "";
            const prompt = it.useRef
              ? "The attached image is the REAL product photo. Create a professional marketing image that features exactly this product: keep its shape, packaging, colors, label and proportions unchanged and never replace it with another object." + ctxTxt + " Scene to create: " + it.desc + ". Photorealistic, soft studio lighting, high detail. ABSOLUTELY no added text, letters, numbers, logos or watermarks; no people (hands only if needed; never an uncovered woman)." + cutTxt
              : IMG_RULES + it.desc + "." + ctxTxt + cutTxt;
            const r = await race(ImgGen.edit(it.useRef ? { blob: PR.blob, prompt, W: it.W, H: it.H, confirm: false, title: "صورة للتصميم" } : { textOnly: true, prompt, W: it.W, H: it.H, confirm: false, title: "صورة للتصميم" }), o.timeout || 150000);
            if (run.cancelled) break;
            if (!r || !r.blob || r.blob.size < 1500) throw new Error("صورة غير صالحة من الخدمة");
            let blob = r.blob;
            if (it.cut && typeof PBBgRemove !== "undefined" && r.canvas) { try { const c = await PBBgRemove.autoCut(r.canvas, { methods: ["classic"] }); if (c && c.canvas) blob = await new Promise(res => c.canvas.toBlob(res, "image/png")); } catch (_) { } }
            const path = await PBApp.uploadBlob(blob, "spec-" + Date.now().toString(36) + i); w.set.src = path; delete w.set.__cutout; delete w.__dw; cache.put(it.key, path); done++; ok = true;
            costLog({ title: it.desc.slice(0, 40), ok: true, tries, ms: Date.now() - t0, est: (ImgGen.estimate && ImgGen.estimate().cost) || null });
            if (PBApp.renderCanvas) PBApp.renderCanvas();
          } catch (e) {
            lastErr = e.message || String(e); if (e.code === "NOKEY" || e.code === "OFF" || /رصيد|credit|quota|limit/i.test(lastErr)) { costLog({ title: it.desc.slice(0, 40), ok: false, fatal: true }); failed += plan.length - i; return { done, failed, total: list.length, cached, error: lastErr }; }
          }
        }
        if (run.cancelled && !ok) return { done, failed, total: list.length, cached, cancelled: true, error: lastErr };
        if (!ok) { failed++; costLog({ title: it.desc.slice(0, 40), ok: false, tries, error: lastErr.slice(0, 80) }); }   // الباقي يكمل: الفشل محصور في هذه الصورة فقط
      }
      return { done, failed, total: list.length, cached, error: lastErr };
    } finally { if (RUN === run) RUN = null; }
  }

  const emptyImages_ = pg => (pg.sections || []).some(sec => (sec.free || []).some(w => w.type === "image" && !w.set.src && (w.set.alt || w.set.aiPrompt)));
  function cancelBar(on, label) {
    let b = document.getElementById("pbx-spec-cancel");
    if (!on) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("button"); b.id = "pbx-spec-cancel"; b.type = "button"; b.style.cssText = "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100001;padding:.65rem 1.3rem;border-radius:14px;border:1px solid rgba(255,255,255,.3);background:rgba(220,60,60,.38);color:#fff;font:800 14px inherit;font-family:inherit;cursor:pointer;backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.2),0 6px 16px rgba(0,0,0,.35)"; b.onclick = () => { cancel(); b.textContent = "… جارٍ الإلغاء"; }; document.body.appendChild(b); }
    b.textContent = label || "⛔ إلغاء التوليد";
  }
  function downloadProject() {
    const P = typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page; if (!P) return false;
    const data = JSON.stringify({ format: FORMAT + "-project", v: 1, saved: new Date().toISOString(), page: JSON.parse(JSON.stringify(P)) }, null, 1);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = (P.slug || "design") + ".project.json"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true;
  }

  /* ───────────── تحويل عكسي: صفحة المطوّر ← JSON بطبقات (alyssum-design/1) دون المساس بالصفحة ─────────────
     يعمل على عناصر الأقسام الحرّة (قماش `scaled`: ناتج «صفحة هبوط ذكية» وتصميم الطبقات والنسخ)؛ ما سواها يُسجَّل في skipped. */
  function fromPage(P) {
    P = P || (typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page); if (!P) return null;
    const num2 = (v, d) => { const n = Number(v && typeof v === "object" ? v.d : v); return isFinite(n) ? n : d; }, skipped = {};
    const strip = h => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li)>/gi, "\n").replace(/<(b|strong)>(.*?)<\/\1>/gi, "**$2**").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{2,}/g, "\n").trim();
    const fam = ff => { const m = /^\s*['"]?([^'",]+)/.exec(String(ff || "")); return m ? m[1].trim() : ""; };
    const spec = { format: FORMAT, page: { title: P.title || P.name || "تصميم", width: 0, bg: P.bg || "#ffffff", lang: "ar", product: "" }, assets: {}, sections: [] };
    (P.sections || []).forEach((sec, si) => {
      const st = sec.set || {}, free = sec.free || [], dw = num2(st.dw, 0) || num2(st.cw, 0) || 1100, H = Math.max(60, Math.round(num2(st.mh, 600)));
      if (!spec.page.width) spec.page.width = dw;
      const S = { name: "s" + (si + 1), height: H, bg: st.bg || "", layers: [] }; if (st.bgImg) S.bgImage = st.bgImg;
      if (free.concat((sec.cols || []).reduce((a, c) => a.concat((c && c.widgets) || []), [])).some(w => w.type === "orderorig")) { spec.sections.push({ kind: "order", name: "order", height: 700, title: "", note: "" }); return; }
      const nonFree = (sec.cols || []).reduce((n, c) => n + ((c && c.widgets) || []).length, 0); if (nonFree) skipped["قسم " + (si + 1) + ": " + nonFree + " عنصراً غير حرّ"] = 1;
      free.forEach(w => {
        const e = w.set || {}, L = { x: Math.round(num2(e.fx, 0) / 100 * dw), y: Math.round(num2(e.fy, 0)), w: Math.round(num2(e.fwd, 30) / 100 * dw), h: Math.round(num2(e.fh, 0)) || undefined, z: Math.round(num2(e.zi, 1)) || 1 };
        if (num2(e.rot, 0)) L.rot = num2(e.rot, 0); if (e.op != null && e.op !== "" && Number(e.op) < 1) L.opacity = Number(e.op); if (e.hd && e.ht && e.hm) L.hidden = true; if (e.locked) L.locked = true;
        const font = () => ({ size: Math.round(num2(e.fs, 28)), weight: Number(e.fw) || 400, color: e.color || "#222222", align: num2(e.ta, "right"), lineHeight: num2(e.lh, 1.4), family: fam(e.ff) || undefined });
        if (w.type === "heading" || w.type === "text") { Object.assign(L, { type: w.type, text: strip(w.type === "heading" ? e.text : e.html), font: font() }); if (w.type === "heading") L.tag = e.tag || "h2"; if (!L.text) return; }
        else if (w.type === "image") { Object.assign(L, { type: "image", src: e.src || "", alt: e.alt || "", fit: e.fit || "cover" }); if (e.aiPrompt) L.prompt = e.aiPrompt; if (e.aiCut) L.cutout = true; }
        else if (w.type === "button") Object.assign(L, { type: "button", text: e.text || "", link: e.link || "#order", bg: e.bgc || "#2e7d32", color: e.color || "#ffffff", size: Math.round(num2(e.fs, 28)), radius: Math.round(num2(e.brad, 40)) });
        else if (w.type === "shape") Object.assign(L, { type: "shape", shape: e.shape || "rect", fill: e.fill || "#cccccc" });
        else if (w.type === "pprice") L.type = "price"; else if (w.type === "poffers") L.type = "offers";
        else if (w.type === "iconbox") Object.assign(L, { type: "icon", icon: String(e.icon || "ic:star").replace(/^ic:/, ""), size: Math.round(num2(e.isz, 48)), title: e.title || "", text: e.text || "" });
        else if (w.type === "video") Object.assign(L, { type: "video", src: e.url || "" });
        else { skipped["عنصر «" + w.type + "» (قسم " + (si + 1) + ")"] = 1; return; }
        if (e.anim) L.effects = [{ type: e.anim, delay: Number(e.animDelay) || 0, duration: Number(e.animDur) || .6 }];
        if (L.h === undefined) delete L.h; S.layers.push(L);
      });
      if (S.layers.length || !nonFree) spec.sections.push(S);
    });
    if (!spec.page.width) spec.page.width = 1100;
    const v = validate(spec); return { spec, skipped: Object.keys(skipped), ok: !!v.ok, count: v.count, error: v.ok ? "" : v.error };
  }
  function exportLayered(P) {
    const r = fromPage(P); if (!r) return null; if (!r.ok) return r;
    const data = JSON.stringify(r.spec, null, 1), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = ((P && P.slug) || (typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && PBApp.E.page.slug) || "design") + ".layers.json"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); r.json = data; return r;
  }

  /* ───────────── الواجهة ───────────── */
  /* ───────────── استيراد منتج من رابط (عنوان، وصف، سعر، صور) ───────────── */
  const PROXIES = [u => "https://corsproxy.io/?url=" + encodeURIComponent(u), u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u), u => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u)];
  const fetchTimed = async (u, kind, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 15000); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return kind === "blob" ? await r.blob() : await r.text(); } catch (e) { throw (e && e.name === "AbortError") ? new Error("انتهت المهلة") : e; } finally { clearTimeout(t); } };
  /* الرابط المباشر ثم الوسطاء بالتوازي: أول صفحة صالحة تُقبل؛ وإن فشلت كلها يُشرح السبب بالعربية */
  async function fetchPageHtml(url) {
    const cands = [url].concat(PROXIES.map(p => p(url))), errs = [];
    const one = async u => { const h = await fetchTimed(u, "text", 12000); if (/<html|<body|<head|<!doctype/i.test(h.slice(0, 4000)) && h.length > 300) return h; throw new Error("استجابة ليست صفحة"); };
    const first = await new Promise(res => { let n = cands.length; cands.forEach(u => one(u).then(h => res(h), e => { errs.push(String((e && e.message) || e)); if (--n === 0) res(null); })); });
    if (first) return first;
    const timeouts = errs.filter(e => /المهلة/.test(e)).length;
    throw new Error("تعذّر جلب صفحة المنتج (" + (timeouts >= errs.length - 1 ? "انتهت المهلة؛ الموقع بطيء أو يمنع الجلب الآلي" : "الموقع يمنع الجلب الآلي أو الرابط غير صحيح") + ")");
  }
  async function fetchImgBlob(url) { for (const u of [url].concat(PROXIES.map(p => p(url)))) { try { const b = await fetchTimed(u, "blob", 12000); if (b && b.size > 1500 && /^image\//.test(b.type)) return b; } catch (_) { } } return null; }
  /* نقية: HTML + رابط الأساس ← {title,desc,price,currency,images[],bullets[]} */
  function parseProduct(html, base) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html"), out = { title: "", desc: "", price: "", currency: "", images: [], bullets: [] };
    const abs = u => { try { return new URL(String(u).trim(), base || "http://x/").href; } catch (_) { return ""; } };
    const meta = n => { const e = doc.querySelector(`meta[property="${n}"],meta[name="${n}"]`); return e ? (e.getAttribute("content") || "").trim() : ""; };
    const clean = (s, n) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 1200);
    const imgs = []; const addImg = u => { u = Array.isArray(u) ? u : [u]; u.forEach(x => { if (x && typeof x === "object") x = x.url || x.contentUrl; x = x && abs(x); if (x && /^https?:/.test(x) && !imgs.includes(x)) imgs.push(x); }); };
    const nodes = []; doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => { try { const j = JSON.parse(s.textContent); (function walk(v) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") { nodes.push(v); if (v["@graph"]) walk(v["@graph"]); } })(j); } catch (_) { } });
    const prod = nodes.find(n => /Product/i.test([].concat(n["@type"] || []).join(",")));
    if (prod) {
      out.title = clean(prod.name, 200); out.desc = clean(prod.description, 1500); addImg(prod.image || []);
      const of = [].concat(prod.offers || [])[0]; if (of) { const o2 = of.offers ? [].concat(of.offers)[0] : of; out.price = String((o2 && (o2.price || o2.lowPrice)) || "").replace(/[^\d.,]/g, ""); out.currency = (o2 && o2.priceCurrency) || ""; }
    }
    if (!out.title) out.title = clean(meta("og:title") || meta("twitter:title") || (doc.querySelector("h1") || {}).textContent || doc.title, 200);
    if (!out.desc) out.desc = clean(meta("og:description") || meta("description") || meta("twitter:description"), 1500);
    if (!out.price) { out.price = (meta("product:price:amount") || meta("og:price:amount") || "").replace(/[^\d.,]/g, ""); out.currency = out.currency || meta("product:price:currency") || meta("og:price:currency"); }
    addImg(meta("og:image")); addImg(meta("twitter:image"));
    const bad = /logo|icon|sprite|avatar|banner|flag|payment|badge|placeholder|pixel|tracking|1x1|favicon/i;
    Array.from(doc.querySelectorAll("img")).forEach(im => {
      const ss = im.getAttribute("srcset"); let src = im.getAttribute("data-src") || im.getAttribute("data-lazy-src") || im.getAttribute("data-original") || im.getAttribute("src") || "";
      if (ss) { const best = ss.split(",").map(x => x.trim().split(/\s+/)).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0))[0]; if (best && best[0]) src = best[0]; }
      const w = parseInt(im.getAttribute("width") || "0", 10), h = parseInt(im.getAttribute("height") || "0", 10);
      if (!src || /^data:/.test(src) || bad.test(src) || bad.test(im.className || "") || (w && w < 120) || (h && h < 120)) return; addImg(src);
    });
    out.images = imgs.slice(0, 8);
    const lis = Array.from(doc.querySelectorAll("li")).map(l => clean(l.textContent, 160)).filter(t => t.length > 12 && t.length < 160); out.bullets = Array.from(new Set(lis)).slice(0, 8);
    return out;
  }
  async function toJpegData(blob, max) {
    const url = URL.createObjectURL(blob); try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("صورة غير صالحة")); i.src = url; });
      const k = Math.min(1, (max || 1000) / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      return { data: c.toDataURL("image/jpeg", .86), blob: await new Promise(r => c.toBlob(r, "image/jpeg", .86)) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function importProduct(url, say, pasted) {
    url = String(url || "").trim(); pasted = String(pasted || "").trim(); const hasPaste = pasted.length > 300;
    if (!hasPaste && !/^https?:\/\/\S+$/i.test(url)) throw new Error("الصق رابطاً صحيحاً يبدأ بـhttp");
    say && say(hasPaste ? "⏳ جارٍ قراءة الكود الملصوق…" : "⏳ جارٍ جلب صفحة المنتج…"); const html = hasPaste ? pasted : await fetchPageHtml(url), p = parseProduct(html, /^https?:/i.test(url) ? url : "");
    if (!p.title && !p.desc && !p.images.length) throw new Error("لم أجد بيانات منتج في هذا الرابط (قد تُبنى الصفحة بالسكربت) — اكتب الاسم والوصف يدوياً");
    p.url = url; return p;
  }
  async function pickImage(imp, i, say) {
    const u = imp.images[i]; if (!u) return; say && say("⏳ جارٍ تحميل الصورة…"); const b = await fetchImgBlob(u); if (!b) throw new Error("تعذّر تحميل هذه الصورة (الموقع يمنعها) — جرّب صورة أخرى");
    const j = await toJpegData(b, 1000); imp.pick = i; imp.data = j.data; imp.blob = j.blob;
  }
  /* يحقن صورة المنتج المستوردة أصلاً باسم product_photo في تصميم مولَّد، ويرفعها لمكتبة الموقع بدل data: داخل الصفحة */
  async function attachImported(spec, imp) {
    if (!spec || typeof spec !== "object" || !imp || !imp.data) return spec;
    spec.assets = spec.assets && typeof spec.assets === "object" && !Array.isArray(spec.assets) ? spec.assets : {}; spec.assets.product_photo = { src: imp.data }; return spec;
  }
  async function uploadDataImages(pg) {
    if (typeof PBApp === "undefined" || !PBApp.uploadBlob) return 0; const seen = {}; let n = 0;
    const jobs = []; (pg.sections || []).forEach(sec => (sec.free || []).forEach(w => { const s = w.set && w.set.src; if (typeof s === "string" && /^data:image\//.test(s)) jobs.push(w); }));
    for (const w of jobs) { const k = w.set.src; try { if (!seen[k]) { const b = await (await fetch(k)).blob(); seen[k] = await PBApp.uploadBlob(b, "imp-" + Date.now().toString(36)); } w.set.src = seen[k]; n++; } catch (_) { } }
    const first = Object.values(seen)[0]; if (first) { pg.media = (pg.media || []).concat(first); } return n;
  }
  const impInfo = imp => imp ? `\nالمنتج مستورد من رابط خارجي (ليس في متجر العميل) — صورته الحقيقية مرفقة كمرجع. ضعها في assets باسم product_photo (بلا prompt) واستعمل src:"asset:product_photo" لصورة المنتج الرئيسية والبقية بـprompt بلا نص. ${imp.price ? "السعر المرجعي في الصفحة المصدر: " + imp.price + " " + (imp.currency || "") + " — اكتبه نصاً عادياً قابلاً للتعديل في طبقة واحدة فقط (لا طبقة price لأنه لا منتج مربوط)." : "لا تخترع سعراً."}${imp.bullets && imp.bullets.length ? "\nنقاط من صفحة المصدر (للمعلومة فقط، لا تنسخها حرفياً ولا تخترع ادعاءات غيرها): " + imp.bullets.slice(0, 6).join(" | ") : ""}` : "";

  const S = { raw: "", res: null, imp: null };
  function prods() { return (typeof Admin !== "undefined" && Admin.products) || (typeof PRODUCTS !== "undefined" ? PRODUCTS : []) || []; }
  function open() {
    const old = document.getElementById("pbx-spec"); if (old) old.remove(); S.imp = null;
    const ps = prods(), bg = document.createElement("div"); bg.id = "pbx-spec";
    bg.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(3px)";
    const btn = "border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:12px;padding:.6rem 1rem;font-weight:800;cursor:pointer;font-family:inherit;backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.25)";
    bg.innerHTML = `<div style="width:min(900px,100%);max-height:94vh;overflow:auto;background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(198,254,23,.3);border-radius:18px;padding:18px;direction:rtl;font-family:inherit">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">🧩 تصميم بطبقات (يولّده الذكاء الاصطناعي)</h3><button data-sp="x" style="${btn};background:rgba(255,255,255,.1)">✕</button></div>
<p style="margin:.2rem 0 .8rem;opacity:.85;line-height:1.8;font-size:.9rem">الذكاء الاصطناعي لا يرسم صورة، بل يخرج <b>طبقات</b> (نصوص، صور، أشكال، أزرار، ظلال، تأثيرات) بمواضعها وأحجامها، فيفتحها المطوّر عناصر منفصلة قابلة للتحريك والتعديل.</p>
<div id="sp-keybox" style="margin:0 0 .8rem;padding:.6rem .8rem;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05)"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><b style="font-size:.85rem">🔑 مفتاح Alyssum API</b><span id="sp-keyst" style="font-size:.8rem;opacity:.85"></span></div><div style="display:flex;gap:6px;margin-top:6px"><input id="sp-key" type="password" autocomplete="off" dir="ltr" placeholder="الصق المفتاح هنا" style="flex:1;min-width:0;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)"><button data-sp="key" style="${btn};background:rgba(198,254,23,.22)">حفظ</button></div><div style="font-size:.75rem;opacity:.7;margin-top:4px">يُحفظ في هذا المتصفح فقط ولا يُرسل لأي موقع آخر.</div></div>
<div id="sp-impbox" style="margin:0 0 .8rem;padding:.6rem .8rem;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05)"><b style="font-size:.85rem">🔗 من رابط منتج (اختياري)</b><div style="display:flex;gap:6px;margin-top:6px"><input id="sp-url" dir="ltr" placeholder="https://… رابط صفحة المنتج" style="flex:1;min-width:0;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)"><button data-sp="imp" style="${btn};background:rgba(198,254,23,.22)">جلب</button></div><div id="sp-impres" style="margin-top:6px;font-size:.82rem;line-height:1.7"></div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<label style="font-size:.8rem">المنتج<select id="sp-prod" style="width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)"><option value="">— بلا ربط بمنتج —</option>${ps.map(p => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join("")}</select></label>
<label style="font-size:.8rem">اللغة<select id="sp-lang" style="width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)"><option value="ar">العربية</option><option value="fr">الفرنسية</option><option value="en">الإنجليزية</option></select></label>
<label style="font-size:.8rem">نوع التصميم<select id="sp-type" style="width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)"><option value="landing">صفحة هبوط كاملة</option><option value="banner">بنر / إعلان (قسم واحد)</option></select></label>
<label style="font-size:.8rem">ألوان العلامة (اختياري)<input id="sp-colors" style="width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)" placeholder="مثال: #1e5e20 و #c8a24b"></label>
<label style="font-size:.8rem;grid-column:1/-1">الهدف/الجمهور والأسلوب البصري (اختياري)<input id="sp-goal" style="width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)" placeholder="مثال: أمهات الأطفال — ألوان خضراء وذهبية، أسلوب فاخر"></label>
<label style="font-size:.8rem;grid-column:1/-1">وصف المنتج بكلماتك (اختياري — يتقدّم على الوصف المجلوب)<textarea id="sp-desc" rows="2" style="width:100%;padding:.5rem;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2);font-family:inherit" placeholder="ما هو المنتج؟ مكوّناته؟ لمن؟ ما الذي يميّزه؟"></textarea></label></div>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin:.8rem 0">
<button data-sp="copy" style="${btn};background:rgba(198,254,23,.18)">① نسخ البرومبت (ألصقه في ChatGPT/Claude)</button>
<button data-sp="gen" style="${btn};background:rgba(198,254,23,.18)">✨ توليد مباشر (Alyssum API)</button>
<button data-sp="full" style="${btn};background:rgba(198,254,23,.28)" title="يولّد التصميم ثم الصور ويفتحه جاهزاً">🚀 توليد كامل (التصميم + الصور)</button>
<button data-sp="imgs" style="${btn};background:rgba(255,255,255,.1)" title="يولّد الصور الفارغة في الصفحة المفتوحة (ما سبق توليده بنفس الوصف يُؤخذ من الكاش بلا استهلاك)">🖼️ توليد الصور الفارغة</button>
<button data-sp="stop" id="sp-stop" style="${btn};background:rgba(220,60,60,.3);display:none">⛔ إلغاء</button>
<button data-sp="dl" style="${btn};background:rgba(255,255,255,.1)" title="ينزّل الصفحة المفتوحة في المطوّر كملف مشروع JSON كامل (عناصر وطبقات وتأثيرات)">⬇ تنزيل المشروع (JSON)</button>
<button data-sp="tolayers" style="${btn};background:rgba(255,255,255,.1)" title="يحوّل الصفحة المفتوحة في المطوّر (مثلاً ناتج «صفحة هبوط ذكية») إلى JSON بطبقات دون تغيير الصفحة نفسها">📤 تحويل الصفحة المفتوحة إلى JSON بطبقات</button>
<button data-sp="sample" style="${btn};background:rgba(255,255,255,.1)">تجربة بنموذج جاهز</button>
<label style="${btn};background:rgba(255,255,255,.1)">📁 رفع ملف JSON<input id="sp-file" type="file" accept=".json,application/json,text/plain" hidden></label></div>
<label style="font-size:.8rem">② ألصق ناتج الذكاء الاصطناعي (JSON) هنا</label>
<textarea id="sp-json" style="width:100%;height:170px;direction:ltr;font-family:monospace;font-size:12px;padding:.6rem;border-radius:12px;background:rgba(255,255,255,.07);color:#e5ffd0;border:1px solid rgba(255,255,255,.2)" placeholder='{"format":"${FORMAT}", ...}'></textarea>
<div style="display:flex;gap:8px;margin:.6rem 0"><button data-sp="check" style="${btn};background:rgba(255,255,255,.12)">③ فحص التصميم</button>
<button data-sp="new" style="${btn};background:rgba(198,254,23,.22)" disabled id="sp-new">فتح كصفحة جديدة في المطوّر</button>
<button data-sp="ins" style="${btn};background:rgba(255,255,255,.12)" disabled id="sp-ins">إدراج في الصفحة المفتوحة</button></div>
<div id="sp-rep" style="font-size:.85rem;line-height:1.8"></div></div>`;
    document.body.appendChild(bg);
    const $q = id => bg.querySelector("#" + id), rep = $q("sp-rep"), say = (h, bad) => { rep.innerHTML = `<div style="padding:.6rem .8rem;border-radius:10px;border:1px solid ${bad ? "rgba(255,120,120,.5)" : "rgba(198,254,23,.35)"};background:${bad ? "rgba(255,80,80,.1)" : "rgba(198,254,23,.07)"}">${h}</div>`; };
    const opts = () => { const p = ps.find(x => x.slug === $q("sp-prod").value), imp = !p && S.imp ? S.imp : null, own = $q("sp-desc").value.trim(); return { name: p ? p.title : imp ? imp.title : "", desc: own || (p ? p.desc : imp ? imp.desc : ""), imp, extra: impInfo(imp), blobs: imp && imp.blob ? [imp.blob] : undefined, goal: $q("sp-goal").value.trim(), lang: $q("sp-lang").value, type: $q("sp-type").value, colors: $q("sp-colors").value.trim(), height: 1080, say, offers: p && p.offers ? p.offers.map(x => x.qty + " قطع = " + x.price + " دج" + (x.free ? " (منها " + x.free + " هدية)" : "")).join("، ") : "", width: 1080 }; };
    const check = () => {
      const t = $q("sp-json").value.trim(); if (!t) { say("ألصق JSON أولاً.", true); return null; }
      const r = validate(t); if (!r.ok) { say("❌ " + esc(r.error), true); $q("sp-new").disabled = $q("sp-ins").disabled = true; return null; }
      r.page.product = $q("sp-prod").value || r.page.product; S.res = r;
      say(`✅ صالح: <b>${r.count.sections}</b> قسماً و<b>${r.count.layers}</b> طبقة.` + (r.fixes && r.fixes.length ? `<div style="margin-top:6px;color:#bbf7d0">🔧 أُصلح تلقائياً (${r.fixes.length}):<ul style="margin:.3rem 1rem">${r.fixes.slice(0, 8).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "") + (r.warn.length ? `<div style="margin-top:6px;color:#fde68a">ملاحظات الجودة (${r.warn.length}):<ul style="margin:.3rem 1rem">${r.warn.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : " لا ملاحظات جودة."));
      $q("sp-new").disabled = false; $q("sp-ins").disabled = !(typeof PBApp !== "undefined" && PBApp.E && PBApp.E.page && PBApp.insertSections); return r;
    };
    const keySt = () => { let ok = false, px = false; try { const v = (localStorage.getItem("alyssum_gp_gkey") || "").trim(); ok = !!v; px = v === "via-proxy"; } catch (_) {} $q("sp-keyst").textContent = ok ? (px ? "✅ يعمل عبر رمز الموقع" : "✅ مضبوط") : "⚠ غير مضبوط"; };
    keySt();
    bg.addEventListener("click", async e => {
      const pi = e.target.closest("[data-spi]"); if (pi && S.imp) { const box = $q("sp-impres"); try { await pickImage(S.imp, +pi.dataset.spi, m => say(m)); box._draw && box._draw(); say("✅ اختيرت الصورة."); } catch (er) { say("❌ " + esc(er.message), true); } return; }
      const b = e.target.closest("[data-sp]"); if (!b) { if (e.target === bg) bg.remove(); return; } const a = b.dataset.sp;
      if (a === "x") bg.remove();
      else if (a === "key") { const k = ($q("sp-key").value || "").replace(/[\s"']/g, ""); if (!k) { say("الصق المفتاح أولاً.", true); return; } try { localStorage.setItem("alyssum_gp_gkey", k); } catch (_) { say("تعذّر الحفظ في هذا المتصفح.", true); return; } $q("sp-key").value = ""; try { ImgGen.credit && ImgGen.credit.renew && ImgGen.credit.renew(); } catch (_) {} keySt(); say("✅ حُفظ المفتاح في هذا المتصفح. يمكنك الآن «توليد كامل»."); }
      else if (a === "imp") {
        b.disabled = true; const box = $q("sp-impres"); box.textContent = "";
        try {
          const p = await importProduct($q("sp-url").value, m => say(m)); S.imp = p;
          if (p.images.length) { try { await pickImage(p, 0, m => say(m)); } catch (er) { say("⚠ " + esc(er.message), true); } }
          const drawImp = () => { box.innerHTML = `<div><b>${esc(p.title || "—")}</b>${p.price ? " — " + esc(p.price) + " " + esc(p.currency || "") : ""}</div><div style="opacity:.85">${esc((p.desc || "").slice(0, 180))}${(p.desc || "").length > 180 ? "…" : ""}</div>` + (p.images.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${p.images.map((u, i) => `<img data-spi="${i}" src="${esc(u)}" referrerpolicy="no-referrer" style="width:64px;height:64px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid ${i === p.pick ? "#c6fe17" : "rgba(255,255,255,.2)"}">`).join("")}</div><div style="opacity:.7;font-size:.75rem;margin-top:3px">اضغط صورة لاختيارها كصورة المنتج الرئيسية.</div>` : `<div style="color:#fde68a">لم أجد صوراً — يمكنك الاستمرار بالوصف فقط.</div>`); };
          box._draw = drawImp; drawImp(); say(`✅ جُلب المنتج: <b>${esc(p.title || "بلا عنوان")}</b>. راجع الوصف ثم اضغط «توليد كامل».`);
          if (!$q("sp-desc").value.trim() && p.desc) $q("sp-desc").value = p.desc;
        } catch (er) { S.imp = null; say("❌ " + esc(er.message), true); }
        b.disabled = false;
      }
      else if (a === "copy") { const p = prompt(opts()); try { await navigator.clipboard.writeText(p); say("✅ نُسخ البرومبت. ألصقه في ChatGPT أو Claude ثم انسخ الـJSON الناتج هنا."); } catch (_) { $q("sp-json").value = p; say("تعذّر النسخ التلقائي؛ وُضع البرومبت في الخانة — انسخه منها."); } }
      else if (a === "sample") { $q("sp-json").value = JSON.stringify(SAMPLE, null, 2); check(); }
      else if (a === "check") check();
      else if (a === "stop") { cancel(); say("… جارٍ الإلغاء"); }
      else if (a === "tolayers") { const r = exportLayered(); if (!r) say("افتح صفحة في المطوّر أولاً.", true); else if (!r.ok) say("❌ " + esc(r.error || "تعذّر التحويل"), true); else { $q("sp-json").value = r.json; check(); say(`✅ حُوّلت الصفحة إلى <b>${r.count.sections}</b> قسماً و<b>${r.count.layers}</b> طبقة ونُزّل الملف؛ الصفحة نفسها لم تتغيّر.` + (r.skipped.length ? `<div style="margin-top:6px;opacity:.85">ما لم يُحوَّل (${r.skipped.length}): ${r.skipped.slice(0, 6).map(esc).join("، ")}</div>` : "")); } }
      else if (a === "dl") { say(downloadProject() ? "✅ نُزّل ملف المشروع." : "افتح صفحة في المطوّر أولاً.", !PBApp.E.page); }
      else if (a === "gen") { b.disabled = true; $q("sp-stop").style.display = ""; say("⏳ جارٍ توليد التصميم…"); try { const o0 = opts(), j = await attachImported(await generate(o0), o0.imp); $q("sp-json").value = JSON.stringify(j, null, 2); check(); } catch (er) { say(er.code === "CANCEL" ? "أُلغي." : "❌ " + esc(er.code === "NOKEY" ? "لم يُضبط مفتاح Alyssum API بعد — استعمل «نسخ البرومبت» يدوياً" : er.code === "OFF" ? "التوليد الذكي معطّل في الإعدادات" : er.message + " — لم يضِع شيء، يمكنك إعادة المحاولة"), er.code !== "CANCEL"); } b.disabled = false; $q("sp-stop").style.display = "none"; }
      else if (a === "imgs") { b.disabled = true; $q("sp-stop").style.display = ""; try { const r = await fillImages({ say: m => say(m), dw: (S.res && S.res.page.width) || 1080 }); say(r.cancelled ? `أُلغي (اكتمل ${r.done} من ${r.total}).` : r.total ? `✅ جاهزة ${r.done} من ${r.total} صورة` + (r.cached ? ` (منها ${r.cached} من الكاش)` : "") + (r.failed ? ` — تعذّرت ${r.failed}${r.error ? ": " + esc(r.error) : ""}` : "") : "لا توجد صور فارغة في الصفحة المفتوحة.", !!r.failed && !r.done); } catch (er) { say("❌ " + esc(er.code === "NOKEY" ? "لم يُضبط مفتاح Alyssum API بعد" : er.code === "OFF" ? "التوليد الذكي معطّل في الإعدادات" : er.message), true); } b.disabled = false; $q("sp-stop").style.display = "none"; }
      else if (a === "full") {
        b.disabled = true; $q("sp-stop").style.display = ""; say("⏳ جارٍ توليد التصميم…");
        try {
          const o0 = opts(), j = await attachImported(await generate(o0), o0.imp); $q("sp-json").value = JSON.stringify(j, null, 2); const r = check(); if (!r) { b.disabled = false; return; }
          const pg = toPage(r, { product: r.page.product }); pg.slug = (r.page.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4);
          const dw = r.page.width; say("⏳ جارٍ رفع صورة المنتج…"); await uploadDataImages(pg); bg.remove(); PBApp.open(pg, "", true);
          if (emptyImages_(pg)) { await new Promise(rs => setTimeout(rs, 700)); cancelBar(true); try { const f = await fillImages({ dw, say: m => PBApp.toast && PBApp.toast(m), confirm: true }); PBApp.toast && PBApp.toast(f.cancelled ? `أُلغي التوليد — اكتملت ${f.done} وبقيت الباقية فارغة (يمكن إكمالها من «توليد الصور الفارغة»)` : `🖼️ جاهزة ${f.done} من ${f.total} صورة` + (f.cached ? ` (${f.cached} من الكاش)` : "") + (f.failed ? ` — تعذّرت ${f.failed} فتبقى فارغة وتصلح بزر «توليد الصور الفارغة»` : "")); } catch (er) { PBApp.toast && PBApp.toast("⚠ " + (er.code === "NOKEY" ? "لا مفتاح للصور" : er.message) + " — التصميم محفوظ بلا ضياع"); } cancelBar(false); }
        } catch (er) { say(er.code === "CANCEL" ? "أُلغي." : "❌ " + esc(er.code === "NOKEY" ? "لم يُضبط مفتاح Alyssum API بعد — استعمل «نسخ البرومبت» يدوياً" : er.code === "OFF" ? "التوليد الذكي معطّل في الإعدادات" : er.message + " — لم يضِع شيء، يمكنك إعادة المحاولة"), er.code !== "CANCEL"); b.disabled = false; $q("sp-stop").style.display = "none"; }
      }
      else if (a === "new" || a === "ins") {
        const r = S.res || check(); if (!r) return; const ctx = { product: r.page.product };
        if (a === "new") { const pg = toPage(r, ctx); pg.slug = (r.page.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4); await uploadDataImages(pg); bg.remove(); PBApp.open(pg, "", true); if (pg.pending && pg.pending.length) setTimeout(() => { try { PBApp.toast && PBApp.toast(pg.pending.length + " صورة فارغة — زر «🧩 تصميم بطبقات» ← «🖼️ توليد الصور الفارغة» يولّدها تلقائياً"); } catch (_) { } }, 400); }
        else { const secs = toSections(r, ctx); bg.remove(); PBApp.insertSections(secs, "تصميم بطبقات"); }
      }
    });
    $q("sp-file").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; $q("sp-json").value = await f.text(); check(); });
  }
  return { FORMAT, SAMPLE, DOC, RULES, prompt, validate, lint, toSections, toPage, fromPage, exportLayered, generate, fillImages, emptyImages, open, _t_upload: uploadDataImages, parseProduct, importProduct, pickImage, attachImported, impInfo, autofix, planPrompt, cleanPlan, cancel, NOREF, assetKey, costLog: () => lsGet(LK, []), cacheState: cache,  TYPES, ENTR, CONT, SHAPES, ICONS };
})();
