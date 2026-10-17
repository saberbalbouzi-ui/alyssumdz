/* Alyssum Mockup Studio — معرض نماذج ثلاثية الأبعاد واقعية (علب، قوارير، أكياس، ملابس) لتركيب شعارك وتصميمك وتصدير صور احترافية.
   • كل نموذج مبنيّ برمجياً (هندسة + خامات + إضاءة استوديو + ظل) بلا ملفات خارجية؛ العرض بمكتبة three.js (MIT) المحلية، تُحمَّل عند الفتح فقط.
   • لكل نموذج: ألوان جاهزة، مناطق طباعة (واجهة/غطاء/صدر/ظهر…)، تصميم سريع (اسم + شعار + نمط) أو صورتك مع التحكم بالحجم والموضع والدوران.
   • التصدير: PNG/WebP بمقاسات المتجر والإعلانات، 4 زوايا ZIP، أو 360° ؛ وإرسال للمطوّر (ستوديو ديزاين).
   • تُفتح من «ستوديو ديزاين ← استوديو الموكاب 3D». الواجهة البرمجية للاختبار عبر MockupStudio._t */
const MockupStudio = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);
  const KEY = "alyssum_mk_cfg";
  const CFG = { bg: "studio", bg1: "#f5f6f8", bg2: "#e3e6ec", shadow: true, size: 0, fmt: "png", q: 92, transparent: false, auto: false };
  try { Object.assign(CFG, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { }
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(CFG)); } catch (e) { } };
  let T = null, R = null, scene = null, cam = null, turn = null, ground = null, keyL = null, envTex = null, blob = null, raf = 0, dirty = true, opened = false, stage = null, escH = null;
  let CUR = null, AM = {}, TEXS = {}, view = { yaw: -0.55, pitch: 0.16, zoom: 1 }, fit = { r: 3, h: 3, cy: 1.5 };
  const MODELS = [];
  const SIZES = [["1080×1080 — منشور مربع", 1080, 1080], ["1080×1350 — منشور 4:5", 1080, 1350], ["1080×1920 — ستوري/ريلز", 1080, 1920], ["1600×900 — بانر عريض", 1600, 900], ["2000×2000 — صورة المتجر عالية", 2000, 2000], ["1200×628 — إعلان رابط", 1200, 628]];

  /* ═══ رياضيات وضجيج ═══ */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); }
  const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;
  const luma = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); if (!m) return 0.5; const n = parseInt(m[1], 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const shade = (c, k) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); if (!m) return c; const n = parseInt(m[1], 16), f = v => clamp(Math.round(v * k), 0, 255); return "#" + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, "0")).join(""); };
  const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), f = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t)); return "#" + [16, 8, 0].map(s => f(s).toString(16).padStart(2, "0")).join(""); };
  async function loadThree() { if (T) return T; T = await import(new URL("assets/js/vendor/three.module.min.js", document.baseURI).href); return T; }
  const canv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  /* ═══ خامات إجرائية (Canvas) ═══ */
  function toTex(c, o) { o = o || {}; const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (o.srgb !== false) t.colorSpace = T.SRGBColorSpace; t.anisotropy = R ? Math.min(8, R.capabilities.getMaxAnisotropy()) : 4; if (o.rep) t.repeat.set(o.rep[0], o.rep[1]); t.needsUpdate = true; return t; }
  function heightToNormal(h, k) {
    const w = h.width, hh = h.height, d = h.getContext("2d").getImageData(0, 0, w, hh).data, o = canv(w, hh), ox = o.getContext("2d"), im = ox.createImageData(w, hh), H = (x, y) => d[(((y + hh) % hh) * w + ((x + w) % w)) * 4] / 255;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4; im.data[i] = (-dx / l * 0.5 + 0.5) * 255; im.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; im.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255; }
    ox.putImageData(im, 0, 0); return o;
  }
  function texOnce(key, mk) { return TEXS[key] || (TEXS[key] = mk()); }
  /* نسيج قماش (حياكة جيرسي) — خريطة ارتفاع ← Normal */
  const fabricNormal = () => texOnce("fabN", () => { const S = 256, c = canv(S, S), x = c.getContext("2d"), im = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = (i % 8) / 8, v = (j % 10) / 10, st = Math.abs(Math.sin(Math.PI * (u + (Math.floor(j / 10) % 2) * 0.5))), h = 0.35 + 0.45 * st * (0.65 + 0.35 * Math.sin(Math.PI * v)) + (hash(i, j) - 0.5) * 0.18, k = (j * S + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = clamp(h, 0, 1) * 255; im.data[k + 3] = 255; } x.putImageData(im, 0, 0); return toTex(heightToNormal(c, 2.2), { srgb: false, rep: [34, 34] }); });
  const ribNormal = () => texOnce("ribN", () => { const S = 128, c = canv(S, S), x = c.getContext("2d"), im = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const h = 0.5 + 0.5 * Math.sin(i / S * Math.PI * 2 * 16), k = (j * S + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = h * 255; im.data[k + 3] = 255; } x.putImageData(im, 0, 0); return toTex(heightToNormal(c, 3), { srgb: false, rep: [6, 1] }); });
  /* كرتون كرافت: لون + ألياف + بروز طفيف */
  const kraftTex = col => { const S = 512, c = canv(S, S), x = c.getContext("2d"), im = x.createImageData(S, S), b = parseInt(col.slice(1), 16), br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const n = fbm(i / 18, j / 18) * 0.5 + fbm(i / 3, j / 40) * 0.5, f = 0.9 + (n - 0.5) * 0.28, k = (j * S + i) * 4; im.data[k] = clamp(br * f, 0, 255); im.data[k + 1] = clamp(bg * f, 0, 255); im.data[k + 2] = clamp(bb * f, 0, 255); im.data[k + 3] = 255; } x.putImageData(im, 0, 0); return toTex(c, { rep: [2, 2] }); };
  const kraftNormal = () => texOnce("krN", () => { const S = 256, c = canv(S, S), x = c.getContext("2d"), im = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const h = fbm(i / 5, j / 30) * 0.6 + fbm(i / 2, j / 2) * 0.4, k = (j * S + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = h * 255; im.data[k + 3] = 255; } x.putImageData(im, 0, 0); return toTex(heightToNormal(c, 1.4), { srgb: false, rep: [3, 3] }); });
  /* حافة الكرتون المضلّع (خطوط تموّج) */
  const fluteTex = col => { const c = canv(128, 64), x = c.getContext("2d"); x.fillStyle = shade(col, 0.92); x.fillRect(0, 0, 128, 64); x.fillStyle = shade(col, 0.78); x.fillRect(0, 0, 128, 8); x.fillRect(0, 56, 128, 8); x.strokeStyle = shade(col, 0.7); x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 128; i += 2) { const y = 32 + Math.sin(i / 128 * Math.PI * 8) * 12; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); return toTex(c); };
  const grainBump = () => texOnce("grB", () => { const S = 256, c = canv(S, S), x = c.getContext("2d"), im = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const h = hash(i, j) * 0.7 + fbm(i / 6, j / 6) * 0.3, k = (j * S + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = h * 255; im.data[k + 3] = 255; } x.putImageData(im, 0, 0); return toTex(heightToNormal(c, 0.8), { srgb: false, rep: [10, 10] }); });

  /* ═══ إضاءة وبيئة استوديو ═══ */
  function makeEnv() {
    const e = new T.Scene(); e.background = new T.Color(0.07, 0.075, 0.085);
    const panel = (w, h, x, y, z, rx, ry, i, col) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col[0] * i, col[1] * i, col[2] * i), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); e.add(m); };
    panel(16, 7, 0, 10, 0, Math.PI / 2, 0, 6, [1, 1, 1]);
    panel(3.5, 13, -10, 3, 4, 0, Math.PI / 2.3, 7, [1, 0.97, 0.93]);
    panel(2.6, 13, 10, 2, 1, 0, -Math.PI / 2.2, 4.2, [0.94, 0.97, 1]);
    panel(14, 3.5, 0, 3, -10, 0, 0, 3, [1, 1, 1]);
    panel(2.2, 10, 3, 3, 10, 0, Math.PI, 2.2, [1, 1, 1]);
    panel(20, 20, 0, -8, 0, Math.PI / 2, 0, 1.05, [0.88, 0.88, 0.88]);
    const pm = new T.PMREMGenerator(R), t = pm.fromScene(e, 0.03).texture; pm.dispose(); return t;
  }
  const blobTex = () => { const c = canv(256, 256), x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 4, 128, 128, 126); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(0.5, "rgba(0,0,0,.2)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };

  /* ═══ الخامات ═══ */
  const FIN = { gloss: { r: 0.2, cc: 0.95, ccr: 0.08 }, satin: { r: 0.42, cc: 0.35, ccr: 0.25 }, matte: { r: 0.82, cc: 0, ccr: 0.5 } };
  const FIN_LIST = [["gloss", "لامع"], ["satin", "ساتان"], ["matte", "مطفي"]];
  function solid(color, f, o) { o = o || {}; const F = FIN[f] || FIN.gloss; return new T.MeshPhysicalMaterial(Object.assign({ color: new T.Color(color), roughness: F.r, clearcoat: F.cc, clearcoatRoughness: F.ccr, envMapIntensity: 0.95 }, o)); }
  const metalM = (color, rough) => new T.MeshPhysicalMaterial({ color: new T.Color(color), metalness: 1, roughness: rough == null ? 0.22 : rough, envMapIntensity: 1.35, clearcoat: 0.2 });
  const rubberM = color => new T.MeshPhysicalMaterial({ color: new T.Color(color || "#1a1a1c"), roughness: 0.78, envMapIntensity: 0.5, clearcoat: 0.1 });
  /* زجاج/بلاستيك شفاف: شفافية تزداد عند الحواف (فريسنل) فتظهر الانعكاسات بوضوح */
  function glassM(tint, base, o) {
    o = o || {}; const m = new T.MeshPhysicalMaterial({ color: new T.Color(tint || "#ffffff"), roughness: o.rough == null ? 0.03 : o.rough, metalness: 0, transparent: true, opacity: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: o.env || 1.8, side: o.side || T.DoubleSide, depthWrite: false, ior: 1.5, specularIntensity: 1 });
    const b = base == null ? 0.12 : base, p = o.pow || 2.6;
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", "float mkFr = pow(1.0 - abs(dot(normalize(vViewPosition), normalize(normal))), " + p.toFixed(1) + ");\n diffuseColor.a = clamp(" + b.toFixed(3) + " + mkFr * " + (1 - b).toFixed(3) + ", 0.0, 1.0);\n #include <opaque_fragment>"); };
    m.customProgramCacheKey = () => "mkglass" + b + "_" + p; return m;
  }
  const liquidM = (color, op) => new T.MeshPhysicalMaterial({ color: new T.Color(color), roughness: 0.15, metalness: 0, clearcoat: 0.6, transparent: op != null && op < 1, opacity: op == null ? 1 : op, envMapIntensity: 0.9 });
  /* قماش: ألياف + sheen */
  function fabricM(color, o) { o = o || {}; return new T.MeshPhysicalMaterial({ color: new T.Color(color), roughness: o.rough == null ? 0.92 : o.rough, metalness: 0, sheen: 1, sheenRoughness: 0.55, sheenColor: new T.Color(color).lerp(new T.Color("#ffffff"), 0.45), normalMap: fabricNormal(), normalScale: new T.Vector2(o.ns || 0.55, o.ns || 0.55), envMapIntensity: o.env || 1.2, side: o.side || T.FrontSide }); }

  /* ═══ الهندسة المساعدة ═══ */
  const V2 = (x, y) => new T.Vector2(x, y);
  const bez = (p0, p1, p2, n) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; o.push(V2(a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1])); } return o; };
  const lathe = (pts, seg, a0, al) => new T.LatheGeometry(pts, seg || 120, a0 || 0, al || Math.PI * 2);
  /* صندوق بحواف وزوايا مدوّرة (قاعدته عند المركز) */
  function rbox(w, h, d, rc, bev) {
    bev = Math.min(bev == null ? 0.02 : bev, Math.min(w, h, d) / 2 - 0.001); rc = Math.min(rc == null ? 0.04 : rc, Math.min(w, h) / 2 - bev - 0.0005); const ww = w - 2 * bev, hh = h - 2 * bev, r = Math.max(0.0005, rc - bev), sh = new T.Shape(), x0 = -ww / 2, y0 = -hh / 2;
    sh.moveTo(x0 + r, y0); sh.lineTo(x0 + ww - r, y0); sh.quadraticCurveTo(x0 + ww, y0, x0 + ww, y0 + r); sh.lineTo(x0 + ww, y0 + hh - r); sh.quadraticCurveTo(x0 + ww, y0 + hh, x0 + ww - r, y0 + hh); sh.lineTo(x0 + r, y0 + hh); sh.quadraticCurveTo(x0, y0 + hh, x0, y0 + hh - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
    const g = new T.ExtrudeGeometry(sh, { depth: d - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 8 }); g.translate(0, 0, -(d - 2 * bev) / 2); return g;
  }
  const mesh = (g, m, x, y, z) => { const o = new T.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; if (x != null) o.position.set(x, y || 0, z || 0); return o; };
  const group = (...c) => { const g = new T.Group(); c.forEach(o => o && g.add(o)); return g; };
  /* لوح رقيق بست مواد: [+x,-x,+y,-y,+z,-z] */
  const slab = (w, h, d, ms) => mesh(new T.BoxGeometry(w, h, d), ms);
  /* مقطع منحنٍ مغلق ← Catmull-Rom، لأنابيب الأربطة والحواف */
  const tubeCurve = (pts, r, closed, seg, rs) => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])), closed, "catmullrom", 0.3), seg || 80, r, rs || 8, !!closed);

  /* ═══ مناطق الطباعة: خامة لكل منطقة تُحدَّث نسيجها عند تغيّر التصميم ═══ */
  function areaMat(aid, o) {
    o = o || {}; const ad = CUR.m.areas.find(a => a.id === aid), F = FIN[CUR.s.finish] || FIN.gloss, dec = !!ad.decal;
    const m = new T.MeshPhysicalMaterial({ roughness: o.rough != null ? o.rough : Math.max(0.3, F.r), clearcoat: o.cc != null ? o.cc : F.cc * 0.5, clearcoatRoughness: o.ccr != null ? o.ccr : 0.2, envMapIntensity: o.env || 0.9, transparent: dec, alphaTest: dec ? 0.01 : 0, depthWrite: !dec, side: o.side || T.FrontSide, polygonOffset: dec || !!o.off, polygonOffsetFactor: dec || o.off ? -4 : 0, polygonOffsetUnits: dec || o.off ? -4 : 0 });
    if (o.fabric) { m.roughness = 0.9; m.clearcoat = 0; m.sheen = 0.6; m.sheenRoughness = 0.6; const nm = fabricNormal().clone(); if (o.nrep) nm.repeat.set(o.nrep[0], o.nrep[1]); nm.needsUpdate = true; m.normalMap = nm; m.normalScale = new T.Vector2(0.35, 0.35); }
    (AM[aid] = AM[aid] || []).push(m); if (TEXS["a_" + aid]) m.map = TEXS["a_" + aid]; return m;
  }
  const baseOf = ad => ad.base === "color" ? CUR.s.color : ad.base === "color2" ? CUR.s.color2 : ad.base === "label" ? CUR.s.a[ad.id].q.c2 : (ad.base && ad.base[0] === "#" ? ad.base : null);
  /* ملصق/تصميم سريع: اسم + وصف + شعار + نمط */
  const FAM = "Poppins,Cairo,'Segoe UI',Tahoma,Arial,sans-serif";
  const isAr = s => /[؀-ۿ]/.test(s || "");
  function wrapLines(x, txt, maxW, px, wt, maxLines) {
    const words = String(txt || "").trim().split(/\s+/).filter(Boolean); let s = px;
    for (let it = 0; it < 40; it++) { x.font = wt + " " + s + "px " + FAM; const lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (x.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } } if (cur) lines.push(cur); if ((lines.length <= maxLines && lines.every(l => x.measureText(l).width <= maxW * 1.002)) || s < 10) return { lines, px: s }; s -= 2; }
    return { lines: [txt], px: s };
  }
  function logoMark(x, cx, cy, r, col) { x.save(); x.translate(cx, cy); x.fillStyle = col; for (let i = 0; i < 4; i++) { x.save(); x.rotate(i * Math.PI / 2 + Math.PI / 4); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(r * 0.2, -r * 0.5, r * 0.75, -r * 0.55, r * 0.95, 0); x.bezierCurveTo(r * 0.75, r * 0.55, r * 0.2, r * 0.5, 0, 0); x.fill(); x.restore(); } x.restore(); }
  function quickArt(x, W, H, q, decal, lum, safe) {
    const s = Math.min(W, H), port = H > W * 1.18, land = W > H * 1.7 || (safe && safe < 1), ink = q.ink === "auto" ? (lum > 0.55 ? "#15181c" : "#ffffff") : q.ink, c1 = q.c1, c2 = q.c2, st = q.style || "plain";
    x.save(); x.textBaseline = "alphabetic";
    if (!decal) {
      if (st === "gradient") { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c2); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, W, H); }
      else if (st === "wave") { x.fillStyle = c1; const y0 = H * 0.62; x.beginPath(); x.moveTo(0, y0 + s * 0.05); x.bezierCurveTo(W * 0.3, y0 - s * 0.14, W * 0.6, y0 + s * 0.2, W, y0 - s * 0.04); x.lineTo(W, H); x.lineTo(0, H); x.fill(); x.globalAlpha = 0.45; x.fillStyle = shade(c1, 1.25); x.beginPath(); x.moveTo(0, y0 - s * 0.03); x.bezierCurveTo(W * 0.35, y0 + s * 0.12, W * 0.65, y0 - s * 0.16, W, y0 + s * 0.06); x.lineTo(W, y0 + s * 0.12); x.bezierCurveTo(W * 0.65, y0 - s * 0.06, W * 0.35, y0 + s * 0.2, 0, y0 + s * 0.06); x.fill(); x.globalAlpha = 1; }
      else if (st === "split") { x.fillStyle = c1; x.fillRect(0, H * 0.64, W, H * 0.36); }
      else if (st === "circles" || st === "band") {
        const cell = st === "circles" ? s * 0.3 : s * 0.1, rows = st === "circles" ? 2 : 2, y0 = H - rows * cell; x.fillStyle = c1;
        for (let j = 0; j < rows; j++) for (let i = 0; i * cell < W + cell; i++) { const gx = i * cell, gy = y0 + j * cell, k = (i + j) % 3; x.beginPath(); if (st === "band") { if (k === 0) { x.moveTo(gx, gy + cell); x.arc(gx, gy + cell, cell, -Math.PI / 2, 0); x.closePath(); } else x.rect(gx, gy, cell, cell); x.globalAlpha = (i + j) % 2 ? 0.45 : 1; } else { if (k === 1) { x.rect(gx, gy, cell, cell); } else if (k === 2) { x.moveTo(gx, gy); x.arc(gx, gy, cell, 0, Math.PI / 2); x.closePath(); } else x.arc(gx + cell / 2, gy + cell / 2, cell / 2, 0, Math.PI * 2); } x.fill(); x.globalAlpha = 1; }
      }
      else if (st === "checker") { const cell = s / 8; for (let j = 0; j * cell < H; j++) for (let i = 0; i * cell < W; i++) { x.fillStyle = (i + j) % 2 ? c1 : c2; x.fillRect(i * cell, j * cell, cell + 1, cell + 1); } }
      else if (st === "stripes") { x.fillStyle = c1; const w = s / 9; x.save(); x.translate(W / 2, H / 2); x.rotate(-Math.PI / 4); for (let i = -30; i < 30; i += 2) x.fillRect(i * w, -Math.hypot(W, H), w, Math.hypot(W, H) * 2); x.restore(); }
      else if (st === "dots") { x.fillStyle = c1; const cell = s / 9; for (let j = 0; j * cell < H + cell; j++) for (let i = 0; i * cell < W + cell; i++) { x.beginPath(); x.arc(i * cell + (j % 2) * cell / 2, j * cell, cell * 0.2, 0, Math.PI * 2); x.fill(); } }
    }
    if (safe && safe < 1) { x.translate(W * (1 - safe) / 2, 0); W = W * safe; }
    const rtl = isAr(q.name);
    const badge = !decal && (st === "checker" || st === "stripes" || st === "dots") && !!(q.name || q.sub);
    if (badge) {
      const bw = W * (land ? 0.55 : 0.8), bh = Math.min(H * 0.5, bw * 0.55); x.fillStyle = c2; x.beginPath(); x.ellipse(W / 2, H / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = shade(c1, 0.85); x.lineWidth = s * 0.008; x.stroke();
      x.textAlign = "center"; x.fillStyle = q.ink === "auto" ? "#15181c" : ink; x.direction = rtl ? "rtl" : "ltr";
      const nm = wrapLines(x, String(q.name || "").toUpperCase(), bw * 0.7, bh * 0.3, "800", 2); x.font = "800 " + nm.px + "px " + FAM; let y = H / 2 - (nm.lines.length - 1) * nm.px * 0.55 + nm.px * 0.1; nm.lines.forEach(l => { x.fillText(l, W / 2, y); y += nm.px * 1.1; });
      if (q.sub) { x.font = "600 " + Math.round(nm.px * 0.4) + "px " + FAM; x.fillText(q.sub, W / 2, y + nm.px * 0.1); }
      if (q.logo !== false) logoMark(x, W / 2, H / 2 - bh * 0.5 - s * 0.02, s * 0.06, c1);
    } else if (decal || land || q.layout === "center" || q.layout === "low") {
      x.textAlign = "center"; x.fillStyle = ink; x.direction = rtl ? "rtl" : "ltr"; const lg = q.logo !== false, mw = W * (decal ? 0.82 : 0.84), base = s * (decal ? 0.15 : (W > H * 1.7 ? 0.3 : 0.18));
      const nm = wrapLines(x, String(q.name || "").toUpperCase(), mw, base, "800", decal ? 3 : 2), lh = nm.px * 1.08, tot = (lg ? s * 0.2 : 0) + nm.lines.length * lh + (q.sub ? nm.px * 0.55 : 0) + (q.vol ? nm.px * 0.45 : 0); let y = H / 2 - tot / 2;
      if (lg) { logoMark(x, W / 2, y + s * 0.09, s * (decal ? 0.1 : 0.085), decal ? ink : c1); y += s * 0.2; }
      x.font = "800 " + nm.px + "px " + FAM; y += nm.px * 0.85; nm.lines.forEach(l => { x.fillText(l, W / 2, y); y += lh; });
      if (q.sub) { x.font = "500 " + Math.round(nm.px * 0.38) + "px " + FAM; x.globalAlpha = 0.85; x.fillText(q.sub, W / 2, y - lh * 0.2 + nm.px * 0.35); x.globalAlpha = 1; y += nm.px * 0.5; }
      if (q.vol) { x.font = "700 " + Math.round(nm.px * 0.34) + "px " + FAM; x.fillText(q.vol, W / 2, y + nm.px * 0.3); }
    } else {
      const pad = s * 0.1, left = !rtl, tx = left ? pad : W - pad; x.textAlign = left ? "left" : "right"; x.fillStyle = ink; x.direction = rtl ? "rtl" : "ltr";
      const nm = wrapLines(x, String(q.name || "").toUpperCase(), W - pad * 2 - (q.logo !== false && port ? 0 : s * 0.05), (port ? s * 0.17 : s * 0.13), "800", 3), lh = nm.px * 1.08; let y = pad + nm.px * 0.8;
      if (q.logo !== false && !port) logoMark(x, left ? W - pad - s * 0.08 : pad + s * 0.08, pad + s * 0.1, s * 0.08, c1);
      x.font = "800 " + nm.px + "px " + FAM; nm.lines.forEach(l => { x.fillText(l, tx, y); y += lh; });
      if (q.sub) { x.font = "500 " + Math.round(nm.px * 0.36) + "px " + FAM; x.fillText(q.sub, tx, y - lh * 0.15 + nm.px * 0.2); y += nm.px * 0.5; }
      if (q.vol) { x.font = "700 " + Math.round(nm.px * 0.32) + "px " + FAM; x.fillText(q.vol, tx, y + nm.px * 0.2); }
      if (q.logo !== false && port) { const lr = s * 0.16, lx = left ? W - pad - lr : pad + lr, ly = (st === "plain" || st === "gradient" || st === "split") ? H - pad - lr - (st === "split" ? H * 0.36 : 0) : H * 0.55; x.fillStyle = c1; x.beginPath(); x.arc(lx, ly, lr, 0, Math.PI * 2); x.fill(); x.strokeStyle = c2; x.lineWidth = s * 0.012; x.beginPath(); x.arc(lx, ly, lr * 0.84, 0, Math.PI * 2); x.stroke(); logoMark(x, lx, ly, lr * 0.5, c2); }
    }
    x.restore();
  }
  function drawXf(x, W, H, src, st, cover) {
    const iw = src.width, ih = src.height, k = (cover === "contain" ? Math.min(W / iw, H / ih) : cover === "cover" ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih)) * (st.sc || 1);
    x.save(); x.translate(W / 2 + (st.x || 0) * W / 2, H / 2 - (st.y || 0) * H / 2); x.rotate((st.rot || 0) * Math.PI / 180); x.drawImage(src, -iw * k / 2, -ih * k / 2, iw * k, ih * k); x.restore();
  }
  function composeArea(aid) {
    const ad = CUR.m.areas.find(a => a.id === aid), st = CUR.s.a[aid], W = clamp(ad.px || 1024, 256, 2048), H = clamp(Math.round(W / ((CUR.ar && CUR.ar[aid]) || ad.ar || 1)), 128, 2048), c = canv(W, H), x = c.getContext("2d"), bs = baseOf(ad);
    if (bs && !ad.decal) { x.fillStyle = bs; x.fillRect(0, 0, W, H); }
    if (st.src === "img" && st.img) drawXf(x, W, H, st.img, st, ad.decal ? "contain" : (st.fit || "cover"));
    else if (st.src === "quick") { const q = Object.assign({}, st.q); if (q.c2 === "auto") q.c2 = bs || "#ffffff"; if (ad.decal) { const t = canv(W, H); quickArt(t.getContext("2d"), W, H, q, true, luma(CUR.s.color)); drawXf(x, W, H, t, st, "contain"); } else quickArt(x, W, H, q, false, luma(q.c2 || "#ffffff"), ad.safe); }
    return c;
  }
  function refreshArea(aid) {
    const old = TEXS["a_" + aid], t = toTex(composeArea(aid)); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.needsUpdate = true; TEXS["a_" + aid] = t;
    (AM[aid] || []).forEach(m => { m.map = t; m.needsUpdate = true; }); if (old && old.dispose) old.dispose(); dirty = true;
  }
  const refreshAreas = (onlyFaces) => { if (!CUR) return; CUR.m.areas.forEach(a => { if (!onlyFaces || !a.decal || CUR.m.inkAuto) refreshArea(a.id); }); };

  /* ═══ مجسّمات الملابس: لوحة منتفخة من مخطط ثنائي الأبعاد ═══ */
  function buildField(poly, step, blur) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9; poly.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    minx -= step * 2; miny -= step * 2; const nx = Math.ceil((maxx + step * 2 - minx) / step), ny = Math.ceil((maxy + step * 2 - miny) / step), n = (nx + 1) * (ny + 1), inside = new Uint8Array(n), dist = new Float32Array(n), px = new Float32Array(n), py = new Float32Array(n), N = poly.length;
    const ax = new Float32Array(N), ay = new Float32Array(N), dx = new Float32Array(N), dy = new Float32Array(N), il = new Float32Array(N); for (let k = 0; k < N; k++) { const a = poly[k], b = poly[(k + 1) % N]; ax[k] = a[0]; ay[k] = a[1]; dx[k] = b[0] - a[0]; dy[k] = b[1] - a[1]; il[k] = 1 / (dx[k] * dx[k] + dy[k] * dy[k] || 1); }
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = minx + i * step, y = miny + j * step; let best = 1e9, bx = 0, by = 0, cr = 0;
      for (let k = 0; k < N; k++) {
        const a0 = ay[k], a1 = a0 + dy[k]; if ((a0 > y) !== (a1 > y)) { const xi = ax[k] + (y - a0) / dy[k] * dx[k]; if (xi > x) cr ^= 1; }
        let t = ((x - ax[k]) * dx[k] + (y - a0) * dy[k]) * il[k]; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = ax[k] + t * dx[k], qy = a0 + t * dy[k], d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy); if (d2 < best) { best = d2; bx = qx; by = qy; }
      }
      const idx = j * (nx + 1) + i; inside[idx] = cr; dist[idx] = cr ? Math.sqrt(best) : 0; px[idx] = cr ? x : bx; py[idx] = cr ? y : by;
    }
    /* تنعيم حقل المسافة (يزيل خطوط الالتقاء/الحافة الوسطى فيصير الانتفاخ ناعماً) */
    const w1 = nx + 1, rad = Math.max(2, Math.round((blur || 0.04) / step)), tmp = new Float32Array(n), box = (src, dst, horiz) => { const L = horiz ? w1 : ny + 1, M = horiz ? ny + 1 : w1; for (let m = 0; m < M; m++) { let sum = 0; const at = k => horiz ? m * w1 + k : k * w1 + m; for (let k = -rad; k <= rad; k++) sum += src[at(clamp(k, 0, L - 1))]; for (let k = 0; k < L; k++) { dst[at(k)] = sum / (2 * rad + 1); sum += src[at(Math.min(L - 1, k + rad + 1))] - src[at(Math.max(0, k - rad))]; } } };
    if (blur !== 0) { const ex = dist.slice(); for (let it = 0; it < 3; it++) { box(dist, tmp, true); box(tmp, dist, false); } for (let k = 0; k < n; k++) dist[k] = lerp(ex[k], dist[k], sstep(0.025, 0.1, ex[k])); } for (let k = 0; k < n; k++) if (!inside[k]) dist[k] = 0;
    return { nx, ny, minx, miny, step, inside, dist, px, py, poly };
  }
  function dAt(F, x, y) { const fx = (x - F.minx) / F.step, fy = (y - F.miny) / F.step, i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i >= F.nx || j >= F.ny) return 0; const u = fx - i, v = fy - j, w = F.nx + 1, a = F.dist[j * w + i], b = F.dist[j * w + i + 1], c = F.dist[(j + 1) * w + i], d = F.dist[(j + 1) * w + i + 1]; return lerp(lerp(a, b, u), lerp(c, d, u), v); }
  /* لوحة منتفخة: الارتفاع z = zfn(x,y,d) (d = البعد عن الحافة)، والأمامية +z والخلفية -z */
  function panelGeo(F, zfn, sign, uvs, ao) {
    const w = F.nx + 1, n = w * (F.ny + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), us = uvs || [1, 1];
    for (let k = 0; k < n; k++) { const x = F.px[k], y = F.py[k]; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = sign * zfn(x, y, F.dist[k]); uv[k * 2] = sign * x * us[0] + 0.5; uv[k * 2 + 1] = y * us[1]; }
    const idx = []; for (let j = 0; j < F.ny; j++) for (let i = 0; i < F.nx; i++) { const a = j * w + i, b = a + 1, c = a + w, d = c + 1; if (!(F.inside[a] || F.inside[b] || F.inside[c] || F.inside[d])) continue; if (sign > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("uv", new T.BufferAttribute(uv, 2)); if (ao) { const col = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const v = 1 - ao[0] * (1 - sstep(0, ao[1], F.dist[k])); col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = v; } g.setAttribute("color", new T.BufferAttribute(col, 3)); } g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* شبكة طباعة تتبع سطح اللوحة داخل مستطيل (x0..x1, y0..y1) */
  function decalGeo(F, zfn, sign, r, nx, ny, eps) {
    const pos = new Float32Array((nx + 1) * (ny + 1) * 3), uv = new Float32Array((nx + 1) * (ny + 1) * 2); let k = 0;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++, k++) { const u = i / nx, v = j / ny, x = lerp(r[0], r[2], u), y = lerp(r[1], r[3], v), z = sign * (zfn(x, y, dAt(F, x, y)) + eps); pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = sign > 0 ? u : 1 - u; uv[k * 2 + 1] = v; }
    const idx = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; if (sign > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("uv", new T.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* أنبوب بيضاوي المقطع على محور مائل (الأكمام): rfn(t) → [نصف قطر في المستوى، نصف قطر في العمق] */
  function loftGeo(P0, dir, L, rfn, rings, seg, caps) {
    const d = new T.Vector3(dir[0], dir[1], dir[2]).normalize(), e2 = new T.Vector3(0, 0, 1), e1 = new T.Vector3().crossVectors(e2, d).normalize(), pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= rings; i++) { const t = i / rings, r0_ = rfn(t), r = [r0_[0], r0_[1]], r2 = rfn(Math.min(1, t + 0.02)), slope = (r2[0] - r[0]) / (L * 0.02 + 1e-6); for (let j = 0; j <= seg; j++) { const a = j / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), wob = 1 + 0.035 * Math.sin(3 * a + t * 5 + P0[0] * 9) * Math.min(1, t * 3), p = new T.Vector3().copy(d).multiplyScalar(t * L).add(new T.Vector3(P0[0], P0[1], P0[2])).addScaledVector(e1, ca * r[0] * wob).addScaledVector(e2, sa * r[1] * wob); pos.push(p.x, p.y, p.z); const n = new T.Vector3().addScaledVector(e1, ca / r[0]).addScaledVector(e2, sa / r[1]).normalize().addScaledVector(d, -slope * 0.8).normalize(); nor.push(n.x, n.y, n.z); uv.push(j / seg * Math.PI * (r[0] + r[1]), t * L); } }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, e = c + 1; idx.push(a, b, c, b, e, c); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  /* تنعيم مضلّع (Chaikin) مع نقاط حادّة تبقى كما هي */
  function smoothPoly(pts, iters, sharp) {
    let P = pts.map((p, i) => ({ x: p[0], y: p[1], s: !!(sharp && sharp.includes(i)) }));
    for (let it = 0; it < iters; it++) { const o = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (a.s) o.push(a); else o.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25, s: false }); if (!b.s && !a.s) o.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75, s: false }); else if (!b.s && a.s) o.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75, s: false }); } P = o; }
    return P.map(p => [p.x, p.y]);
  }

  /* ═══ تسجيل النماذج ═══ */
  const QD = { name: "BRAND NAME", sub: "Premium quality", vol: "", style: "plain", c1: "#2f8f4e", c2: "auto", ink: "auto", logo: true, layout: "" };
  function def(m) { MODELS.push(m); return m; }
  function newState(m) {
    const s = { color: m.colors[0], color2: m.c2 ? m.c2.def : "#ffffff", finish: m.fin || "gloss", open: m.open0 || 0, a: {} };
    if (m.roles) { s.roles = {}; Object.keys(m.roles).forEach(k => { s.roles[k] = { p: m.roles[k].p, c: m.roles[k].c, on: true }; }); s.P = {}; (m.params || []).forEach(p => { s.P[p.k] = p.v; }); s.color = m.colors[0]; }
    m.areas.forEach(a => { s.a[a.id] = Object.assign({ src: a.src0 || "none", img: null, fit: "cover", sc: 1, x: 0, y: 0, rot: 0 }, a.def || {}, { q: Object.assign({}, QD, a.q || {}) }); });
    return s;
  }
  const face = (aid, w, h, x, y, z, ry, rx, o) => { const m = mesh(new T.PlaneGeometry(w, h), areaMat(aid, Object.assign({ off: true }, o || {}))); m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rx) m.rotation.x = rx; m.castShadow = false; return m; };
  const cardM = (color, f) => solid(color, f === "gloss" ? "satin" : f, { roughness: f === "matte" ? 0.88 : 0.55, normalMap: kraftNormal(), normalScale: new T.Vector2(0.22, 0.22) });
  const edgeM = color => new T.MeshStandardMaterial({ color: new T.Color(shade(color, 0.93)), roughness: 0.92, map: fluteTex(color) });
  const KR = ["#b88a5b", "#f3efe7", "#ece3d3", "#e8a7b8", "#8fb6d8", "#2e3b4a", "#7aa874", "#e0a73a"];
  const INNER = ["#f3efe7", "#e8a7b8", "#b88a5b", "#2e3b4a", "#8fb6d8", "#f0d98a"];

  /* ═══ الصناديق ═══ */
  function buildMailer(o) {
    const S = CUR.s, f = S.finish, W = 2.4, D = 1.7, H = 0.62, t = 0.04, outer = cardM(S.color, f), inner = cardM(S.color2, f), edge = edgeM(S.color), g = group();
    const innerE = areaMat("inside", { rough: 0.85, cc: 0 });
    g.add(mesh(new T.BoxGeometry(W, t, D), [edge, edge, innerE, outer, outer, outer], 0, t / 2, 0));
    const fw = slab(W, H, t, [edge, edge, edge, edge, areaMat("front", { rough: 0.85, cc: 0.05 }), inner]); fw.position.set(0, H / 2, D / 2 - t / 2); g.add(fw);
    const back = slab(W, H, t, [edge, edge, edge, edge, inner, outer]); back.position.set(0, H / 2, -D / 2 + t / 2); g.add(back);
    const L = slab(t, H, D - 2 * t, [outer, inner, edge, edge, edge, edge]); L.position.set(W / 2 - t / 2, H / 2, 0); g.add(L);
    const Rr = slab(t, H, D - 2 * t, [inner, outer, edge, edge, edge, edge]); Rr.position.set(-W / 2 + t / 2, H / 2, 0); g.add(Rr);
    const hinge = group(); hinge.position.set(0, H, -D / 2 + 0.005); g.add(hinge);
    const lid = slab(W, t, D, [edge, edge, areaMat("lid", { rough: 0.85, cc: 0.08 }), areaMat("lidIn", { rough: 0.85, cc: 0 }), edge, edge]); lid.position.set(0, t / 2, D / 2); hinge.add(lid);
    const Fh = H * 0.78, fl = group(); fl.position.set(0, 0, D - 2.2 * t); hinge.add(fl); fl.rotation.x = Math.PI / 2;
    const flap = slab(W - 2 * t - 0.03, t, Fh, [edge, edge, inner, inner, edge, edge]); flap.position.set(0, 0, Fh / 2); fl.add(flap);
    return { g, pose: p => { hinge.rotation.x = -p * Math.PI * 0.64; } };
  }
  const MAILER_AREAS = [{ id: "lid", n: "الغطاء (خارج)", ar: 2.4 / 1.7, base: "color", src0: "quick", q: { name: "GIFT BOX MOCKUP", sub: "", style: "plain", layout: "center", logo: true, c1: "#2a2a2a" } }, { id: "lidIn", n: "الغطاء (داخل)", ar: 2.4 / 1.7, base: "color2" }, { id: "front", n: "الواجهة الأمامية", ar: 2.4 / 0.62, base: "color" }, { id: "inside", n: "داخل الصندوق", ar: 2.4 / 1.7, base: "color2" }];
  def({ id: "mailer", cat: "box", n: "صندوق شحن بغطاء مفصلي", tag: "كرافت", colors: KR, c2: { n: "لون الداخل", colors: INNER, def: "#e6dccb" }, fin: "matte", open0: 0.82, openLabel: "فتح الغطاء", areas: MAILER_AREAS, view: { yaw: -0.62, pitch: 0.34 }, build: buildMailer });
  def({ id: "sweet", cat: "box", n: "صندوق حلويات بغطاء مفصلي", tag: "هدايا", colors: ["#e8a7b8", "#f3efe7", "#b88a5b", "#8fb6d8", "#2e3b4a", "#e0a73a"], c2: { n: "لون الداخل", colors: ["#e8a7b8", "#f3efe7", "#b88a5b", "#2e3b4a"], def: "#e49bb0" }, fin: "satin", open0: 0.82, openLabel: "فتح الغطاء", areas: [{ id: "lid", n: "الغطاء (خارج)", ar: 2.4 / 1.7, base: "color", src0: "quick", q: { name: "SWEET BOX", sub: "MOCKUP", style: "checker", c1: "#e8a7b8", c2: "#f9d9e2", ink: "#c0567a", logo: true } }, { id: "lidIn", n: "الغطاء (داخل)", ar: 2.4 / 1.7, base: "color2", src0: "quick", q: { name: "SWEET BOX", sub: "MOCKUP", style: "plain", layout: "center", c1: "#c0567a", ink: "#ffffff", logo: true } }, { id: "front", n: "الواجهة الأمامية", ar: 2.4 / 0.62, base: "color", src0: "quick", q: { name: "", sub: "", style: "checker", c1: "#e8a7b8", c2: "#f9d9e2", logo: false } }, { id: "inside", n: "داخل الصندوق", ar: 2.4 / 1.7, base: "color2" }], view: { yaw: -0.6, pitch: 0.34 }, build: buildMailer });

  /* علبة مغلقة بحواف مدوّرة (برمجيات/مستحضرات) */
  function buildTuck() {
    const S = CUR.s, f = S.finish, W = 1.7, H = 2.3, D = 0.72, bev = 0.022, g = group(), base = solid(S.color, f, { envMapIntensity: 0.9 });
    g.add(mesh(rbox(W, H, D, 0.03, bev), base, 0, H / 2, 0));
    const iw = W - 2 * bev - 0.004, ih = H - 2 * bev - 0.004, id_ = D - 2 * bev - 0.004;
    g.add(face("front", iw, ih, 0, H / 2, D / 2 + 0.0012)); g.add(face("back", iw, ih, 0, H / 2, -D / 2 - 0.0012, Math.PI));
    g.add(face("side", id_, ih, -W / 2 - 0.0012, H / 2, 0, -Math.PI / 2)); g.add(face("side", id_, ih, W / 2 + 0.0012, H / 2, 0, Math.PI / 2));
    g.add(face("top", iw, id_, 0, H + 0.0012, 0, 0, -Math.PI / 2));
    const crease = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const cl = new T.Mesh(new T.PlaneGeometry(iw, 0.007), crease); cl.rotation.x = -Math.PI / 2; cl.position.set(0, H + 0.0024, D / 2 - 0.1); g.add(cl);
    const cl2 = new T.Mesh(new T.PlaneGeometry(iw, 0.006), crease); cl2.position.set(0, H - 0.13, D / 2 + 0.0024); g.add(cl2);
    return { g };
  }
  const TUCK_AREAS = (nm, st, c1, c2, ink) => [{ id: "front", n: "الواجهة", ar: 1.7 / 2.3, base: "color", src0: "quick", q: { name: nm, sub: "Make Packaging Simple", style: st, c1, c2: c2 || "auto", ink: ink || "auto", logo: true } }, { id: "back", n: "الخلف", ar: 1.7 / 2.3, base: "color", src0: "quick", q: { name: nm, sub: "", style: "plain", c1, logo: false } }, { id: "side", n: "الجانب (يمين ويسار)", ar: 0.72 / 2.3, base: "color" }, { id: "top", n: "الأعلى", ar: 1.7 / 0.72, base: "color" }];
  def({ id: "software", cat: "box", n: "علبة برمجيات / مستحضرات", tag: "علبة", colors: ["#f6f6f4", "#f2c94c", "#2a6fa8", "#e8a7b8", "#2a2d33", "#7aa874", "#c8553d"], fin: "satin", areas: TUCK_AREAS("SOFTWARE BOX MOCKUP", "circles", "#f2c94c", "#ffffff", "#17191c"), view: { yaw: -0.5, pitch: 0.16 }, build: buildTuck });
  def({ id: "boxpack", cat: "box", n: "علبة تغليف بنمط هندسي", tag: "علبة", colors: ["#f6f6f4", "#f2c94c", "#2a6fa8", "#e8a7b8", "#2a2d33", "#c8553d"], fin: "satin", areas: TUCK_AREAS("BOX PACKAGING MOCKUP", "band", "#f0c44a", "#ffffff", "#17191c"), view: { yaw: -0.55, pitch: 0.14 }, build: buildTuck });

  /* علبة أدوية بغطاء علوي مفتوح */
  function dustGeo(D, t, len) { const sh = new T.Shape(), a = D / 2 - t, c = len * 0.35; sh.moveTo(-a, 0); sh.lineTo(-a, len - c); sh.lineTo(-a + c, len); sh.lineTo(a - c, len); sh.lineTo(a, len - c); sh.lineTo(a, 0); sh.closePath(); const g = new T.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2); g.rotateY(Math.PI / 2); return g; }
  function buildCarton() {
    const S = CUR.s, f = S.finish, W = 1.25, H = 2.35, D = 0.7, t = 0.016, g = group(), outer = solid(S.color, f, { normalMap: kraftNormal(), normalScale: new T.Vector2(0.06, 0.06) }), inner = cardM(S.color2, "matte"), edge = new T.MeshStandardMaterial({ color: new T.Color("#e6e3da"), roughness: 0.9 });
    g.add(slab(W, H, t, [edge, edge, edge, edge, areaMat("front", { rough: 0.5, cc: 0.25 }), inner]).translateY(H / 2).translateZ(D / 2 - t / 2));
    const back = slab(W, H, t, [edge, edge, edge, edge, inner, areaMat("back", { rough: 0.5, cc: 0.25 })]); back.position.set(0, H / 2, -D / 2 + t / 2); g.add(back);
    const sl = slab(t, H, D - 2 * t, [areaMat("side", { rough: 0.5, cc: 0.25 }), inner, edge, edge, edge, edge]); sl.position.set(W / 2 - t / 2, H / 2, 0); g.add(sl);
    const sr = slab(t, H, D - 2 * t, [inner, areaMat("side", { rough: 0.5, cc: 0.25 }), edge, edge, edge, edge]); sr.position.set(-W / 2 + t / 2, H / 2, 0); g.add(sr);
    g.add(slab(W - 2 * t, t, D - 2 * t, [edge, edge, inner, inner, edge, edge]).translateY(t / 2));
    const hinge = group(); hinge.position.set(0, H, -D / 2 + t / 2); g.add(hinge);
    const lid = slab(W - 0.006, t, D - 0.004, [edge, edge, areaMat("top", { rough: 0.5, cc: 0.25 }), inner, edge, edge]); lid.position.set(0, t / 2, (D - 0.004) / 2); hinge.add(lid);
    const tkp = group(); tkp.position.set(0, 0, D - 0.004 - t); tkp.rotation.x = Math.PI / 2; hinge.add(tkp); const Ft = 0.42, tk = slab(W - 0.07, t, Ft, [edge, edge, inner, inner, edge, edge]); tk.position.set(0, 0, Ft / 2); tkp.add(tk);
    const dl = group(), dr = group(); dl.position.set(-W / 2 + t, H, 0); dr.position.set(W / 2 - t, H, 0); g.add(dl, dr);
    const dgeo = dustGeo(D, t, D * 0.78), dm = mesh(dgeo, inner); dm.castShadow = false; dl.add(dm); const dm2 = mesh(dgeo, inner); dm2.castShadow = false; dm2.rotation.y = Math.PI; dr.add(dm2);
    return { g, pose: p => { hinge.rotation.x = -p * Math.PI * 0.64; const fa = lerp(Math.PI * 0.5, Math.PI * 0.36, p); dl.rotation.z = -fa; dr.rotation.z = fa; } };
  }
  def({ id: "medicine", cat: "box", n: "علبة أدوية بغطاء مفتوح", tag: "علبة", colors: ["#f6f6f4", "#2a7fb8", "#7aa874", "#e8a7b8", "#2a2d33", "#f2c94c"], c2: { n: "لون الداخل", colors: ["#f3efe7", "#b88a5b", "#2a7fb8", "#ffffff"], def: "#f3efe7" }, fin: "satin", open0: 0.75, openLabel: "فتح الغطاء", areas: [{ id: "front", n: "الواجهة", ar: 1.25 / 2.35, base: "color", src0: "quick", q: { name: "MEDICINE BOX MOCKUP", sub: "www.yourbrand.com", style: "wave", c1: "#2a7fb8", c2: "auto", ink: "#17191c", logo: true } }, { id: "back", n: "الخلف", ar: 1.25 / 2.35, base: "color" }, { id: "side", n: "الجانب", ar: 0.7 / 2.35, base: "color", src0: "quick", q: { name: "MEDICINE", sub: "", style: "wave", c1: "#2a7fb8", logo: false } }, { id: "top", n: "الغطاء (خارج)", ar: 1.25 / 0.7, base: "color" }], view: { yaw: -0.5, pitch: 0.34 }, build: buildCarton });

  /* ═══ كيس قائم (Stand-up Pouch) ═══ */
  function roundRect(w, h, rb, rt, seg) {
    const hw = w / 2, o = [], arc = (cx, cy, r, a0, a1) => { for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    arc(-hw + rb, rb, rb, Math.PI, Math.PI * 1.5); arc(hw - rb, rb, rb, Math.PI * 1.5, Math.PI * 2); arc(hw - rt, h - rt, rt, 0, Math.PI / 2); arc(-hw + rt, h - rt, rt, Math.PI / 2, Math.PI); return o;
  }
  let POUCH_F = null;
  function buildPouch() {
    const S = CUR.s, W = 1.56, H = 2.7, hw = W / 2, step = CUR.q === "lo" ? 0.014 : 0.0075, key = "pouch" + step; CUR.m.cache = CUR.m.cache || {};
    const F = CUR.m.cache[key] || (CUR.m.cache[key] = buildField(roundRect(W, H, 0.34, 0.012, 14), step)), fz = (x, y, d) => {
      const yn = y / H, px = Math.abs(x) / hw, prof = Math.pow(Math.max(0, 1 - Math.pow(px, 2.3)), 0.5), A = 0.34 * (1 - sstep(0.6, 0.9, yn)) + 0.01, body = A * prof * (0.5 + 0.5 * sstep(0, 0.3, yn)), tp = sstep(0, 0.035, d);
      let z = body * tp; z += (fbm(x * 2.6 + 3, y * 2.6) - 0.5) * 0.07 * sstep(0.04, 0.3, d) * (1 - sstep(0.78, 0.9, yn)) * prof;
      const dz = (y - H * 0.8) / 0.015; z += 0.02 * Math.exp(-dz * dz) * (1 - px * px * px) * tp; if (yn > 0.915 && yn < 0.985) z += 0.0055 * (0.5 + 0.5 * Math.sin(y / 0.0072 * 2.2)) * tp; return z + 0.0015 * tp;
    };
    const g = group(), uvs = [1 / W, 1 / H], fm = areaMat("front", { rough: S.finish === "matte" ? 0.55 : 0.28, cc: S.finish === "matte" ? 0.05 : 0.5 }), bm = areaMat("back", { rough: S.finish === "matte" ? 0.55 : 0.28, cc: S.finish === "matte" ? 0.05 : 0.5 });
    g.add(mesh(panelGeo(F, fz, 1, uvs), fm)); g.add(mesh(panelGeo(F, fz, -1, uvs), bm)); return { g };
  }
  const POUCH_ART = (c, c2) => ({ name: "POUCH MOCKUP", sub: "HIGH-QUALITY MOCKUP", style: "wave", layout: "low", c1: c2, c2: c, ink: "#1c1f23", logo: true });
  def({ id: "pouch", cat: "pouch", n: "كيس قائم بسحّاب (Stand-up Pouch)", tag: "كيس", colors: ["#8cc63f", "#f5f5f2", "#c9a273", "#2a2d33", "#e8a7b8", "#2a7fb8", "#e0a73a"], fin: "satin", areas: [{ id: "front", n: "الواجهة", ar: 1.56 / 2.7, base: "color", src0: "quick", q: POUCH_ART("#8cc63f", "#ffffff") }, { id: "back", n: "الخلف", ar: 1.56 / 2.7, base: "color", src0: "quick", q: Object.assign(POUCH_ART("#8cc63f", "#ffffff"), { name: "", sub: "", logo: false }) }], view: { yaw: -0.38, pitch: 0.1 }, build: buildPouch });
  def({ id: "pouchk", cat: "pouch", n: "كيس كرافت قائم", tag: "كيس", colors: ["#c9a273", "#f5f5f2", "#2a2d33", "#7aa874", "#8c5a3c"], fin: "matte", areas: [{ id: "front", n: "الواجهة", ar: 1.56 / 2.7, base: "color", src0: "quick", q: { name: "NATURAL COFFEE", sub: "Roasted fresh", vol: "250 g", style: "split", layout: "low", c1: "#2a2d33", c2: "auto", ink: "#ffffff", logo: true } }, { id: "back", n: "الخلف", ar: 1.56 / 2.7, base: "color" }], view: { yaw: -0.38, pitch: 0.1 }, build: buildPouch });

  /* ═══ القوارير والعبوات (مقاطع دورانية) ═══ */
  const clipProfile = (pts, yMax, k) => { const o = []; let prev = null; for (const p of pts) { if (p.y > yMax) { if (prev && p.y > prev.y) { const t = (yMax - prev.y) / (p.y - prev.y); o.push(V2((prev.x + (p.x - prev.x) * t) * k, yMax)); } break; } o.push(V2(p.x * k, p.y)); prev = p; } if (o.length) { const l = o[o.length - 1]; o.push(V2(0, l.y)); } return o; };
  const innerOf = (pts, w, bt) => pts.map(p => V2(p.x <= 0.0001 ? 0 : Math.max(0.012, p.x - w), Math.max(p.y, bt)));
  const noShadow = o => { o.castShadow = false; return o; };
  /* جسم شفاف بطبقتين (سماكة) + سائل داخلي اختياري */
  function clearBody(outer, o) {
    o = o || {}; const g = group(), w = o.wall || 0.05, inner = innerOf(outer, w, o.base == null ? 0.07 : o.base), tint = o.tint || "#eef3f6", b = o.op == null ? 0.1 : o.op;
    g.add(noShadow(mesh(lathe(outer, 128), glassM(tint, b, { pow: 2.4 })))); g.add(noShadow(mesh(lathe(inner, 128), glassM(tint, b * 0.7, { env: 1.1, pow: 3 }))));
    if (o.liquid) { const top = o.liquid.level, lg = lathe(clipProfile(inner.filter(p => p.y >= 0), top, 0.99), 128), lq = mesh(lg, liquidM(o.liquid.color, o.liquid.op == null ? 0.85 : o.liquid.op)); lq.castShadow = true; g.add(lq); }
    return g;
  }
  /* ملصق ملفوف على قطاع أسطواني مستقيم */
  function wrap(aid, r, y0, y1, arcDeg, sq, o) { const arc = arcDeg * Math.PI / 180, m = mesh(new T.CylinderGeometry(r, r, y1 - y0, 140, 1, true, -arc / 2, arc), areaMat(aid, o || { rough: 0.45, cc: 0.35 })); m.position.y = (y0 + y1) / 2; m.castShadow = false; if (sq && sq !== 1) m.scale.z = sq; return m; }
  const solidLathe = (pts, mat, seg) => mesh(lathe(pts, seg || 96), mat);
  function ribRing(y, h, r, n, mat) { const g = group(), w = (2 * Math.PI * r / n) * 0.45; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, m = mesh(new T.BoxGeometry(w, h, 0.014), mat); m.position.set(Math.sin(a) * (r + 0.004), y, Math.cos(a) * (r + 0.004)); m.rotation.y = a; m.castShadow = false; g.add(m); } return g; }
  const BC = ["#ffffff", "#f3efe7", "#2a2d33", "#e8a7b8", "#8fb6d8", "#7aa874", "#c9a273", "#c8553d", "#e0a73a"];

  /* بخّاخ شفاف */
  function buildSpray() {
    const S = CUR.s, R0 = 0.55, P = [V2(0, 0), V2(R0 - 0.1, 0), ...bez([R0 - 0.1, 0], [R0, 0], [R0, 0.1], 6), V2(R0, 2.3), ...bez([R0, 2.3], [R0, 2.62], [0.24, 2.72], 12), V2(0.24, 2.9), V2(0.27, 2.92), V2(0.27, 2.96), V2(0.24, 2.96)];
    const g = group(), cap = solid(S.color2, S.finish), liq = S.color;
    g.add(clearBody(P, { wall: 0.045, tint: "#f1f5f8", liquid: { level: 2.0, color: liq, op: 0.55 } }));
    g.add(mesh(new T.CylinderGeometry(0.018, 0.018, 2.6, 8), new T.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.4, transparent: true, opacity: 0.8 }), 0.05, 1.35, 0));
    g.add(solidLathe([V2(0, 2.84), V2(0.29, 2.84), V2(0.29, 3.12), V2(0.26, 3.16), V2(0, 3.16)], cap)); g.add(ribRing(2.99, 0.2, 0.29, 36, cap));
    g.add(solidLathe([V2(0, 3.16), V2(0.13, 3.16), V2(0.13, 3.34), V2(0.2, 3.4), V2(0.2, 3.62), V2(0.17, 3.68), V2(0, 3.68)], cap));
    const nz = mesh(rbox(0.3, 0.12, 0.12, 0.04, 0.02), cap, 0.2, 3.52, 0); g.add(nz); g.add(wrap("label", R0 + 0.004, 0.16, 1.7, 360, 1));
    return { g };
  }
  def({ id: "spray", cat: "bottle", n: "قارورة بخّاخ بلاستيكية", tag: "بخّاخ", colors: ["#e9eef6", "#cfd6ff", "#ffe9a8", "#ffd1dc", "#c9f0d8"], c2: { n: "لون البخّاخ", colors: ["#ffffff", "#2a2d33", "#e8a7b8", "#8fb6d8"], def: "#ffffff" }, fin: "gloss", areas: [{ id: "label", n: "الملصق (يلفّ المحيط)", ar: 2 * Math.PI * 0.554 / 1.54, base: "label", safe: 0.34, src0: "quick", q: { name: "COSMETIC SPRAY BOTTLE MOCKUP", sub: "50 ml", style: "wave", c1: "#7a62e0", c2: "#ffffff", ink: "#17191c", layout: "low", logo: true } }], view: { yaw: -0.4, pitch: 0.06 }, build: buildSpray });

  /* وعاء كريم شفاف بغطاء أبيض */
  function buildJar() {
    const S = CUR.s, R0 = 1.55, H = 1.25, P = [V2(0, 0), V2(R0 - 0.16, 0), ...bez([R0 - 0.16, 0], [R0, 0], [R0, 0.16], 6), V2(R0, H - 0.1), ...bez([R0, H - 0.1], [R0, H], [R0 - 0.08, H], 4), V2(R0 - 0.1, H)];
    const g = group(), lid = solid(S.color2, S.finish);
    g.add(clearBody(P, { wall: 0.1, base: 0.3, tint: "#f4f7fa", op: 0.12, liquid: { level: H - 0.1, color: S.color, op: 1 } }));
    g.add(solidLathe([V2(0, H - 0.04), V2(R0 + 0.03, H - 0.04), V2(R0 + 0.03, H + 0.5), ...bez([R0 + 0.03, H + 0.5], [R0 + 0.03, H + 0.58], [R0 - 0.06, H + 0.58], 6), V2(0, H + 0.58)], lid, 128));
    g.add(wrap("label", R0 + 0.006, 0.28, 1.0, 150, 1)); const top = face("lid", 2 * R0 - 0.2, 2 * R0 - 0.2, 0, H + 0.584, 0, 0, -Math.PI / 2, { rough: 0.3, cc: 0.5 }); top.geometry = new T.CircleGeometry(R0 - 0.1, 64); g.add(top);
    return { g };
  }
  def({ id: "jar", cat: "bottle", n: "وعاء كريم بلاستيكي شفاف", tag: "وعاء", colors: ["#fbfaf6", "#f6e3e8", "#e6f2e8", "#fff3cf"], c2: { n: "لون الغطاء", colors: ["#ffffff", "#2a2d33", "#e8a7b8", "#d3a74a"], def: "#ffffff" }, fin: "gloss", areas: [{ id: "label", n: "الملصق الأمامي", ar: (150 * Math.PI / 180 * 1.556) / 0.75, base: "label", src0: "quick", q: { name: "COSMETIC JAR MOCKUP", sub: "", style: "plain", layout: "center", c1: "#d79a2b", c2: "#ffffff", ink: "#17191c", logo: true } }, { id: "lid", n: "سطح الغطاء", ar: 1, base: "color2", src0: "none", decal: false }], view: { yaw: -0.35, pitch: 0.22 }, build: buildJar });

  /* زجاجة مضخّة 450 مل */
  function pumpTop(y0, mat, long) {
    const g = group(); g.add(solidLathe([V2(0, y0), V2(0.3, y0), V2(0.3, y0 + 0.36), V2(0.26, y0 + 0.4), V2(0.2, y0 + 0.4), V2(0.11, y0 + 0.44), V2(0.11, y0 + 0.9)], mat));
    const hy = y0 + 0.9; g.add(solidLathe([V2(0, hy), V2(0.2, hy), V2(0.2, hy + 0.14), V2(0.15, hy + 0.2), V2(0, hy + 0.2)], mat));
    const nz = mesh(new T.CylinderGeometry(0.07, 0.1, long || 0.66, 24), mat); nz.rotation.z = Math.PI / 2; nz.position.set((long || 0.66) / 2 + 0.05, hy + 0.1, 0); g.add(nz); const tip = mesh(new T.CylinderGeometry(0.055, 0.055, 0.1, 20), mat); tip.rotation.z = Math.PI / 2; tip.position.set((long || 0.66) + 0.08, hy + 0.1, 0); g.add(tip); return g;
  }
  function buildPump() {
    const S = CUR.s, R0 = 0.72, H = 3.5, P = [V2(0, 0), V2(R0 - 0.12, 0), ...bez([R0 - 0.12, 0], [R0, 0], [R0, 0.12], 6), V2(R0, H - 0.2), ...bez([R0, H - 0.2], [R0, H + 0.3], [0.27, H + 0.42], 14), V2(0.27, H + 0.62)];
    const g = group(), pm = solid(S.color2, S.finish);
    g.add(clearBody(P, { wall: 0.05, tint: "#f1f4f7", op: 0.1, liquid: { level: 2.7, color: S.color, op: 0.6 } }));
    g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 3.5, 10), new T.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.4, transparent: true, opacity: 0.8 }), 0, 1.8, 0)); g.add(pumpTop(H + 0.56, pm));
    g.add(wrap("label", R0 + 0.005, 0.5, 2.7, 140, 1)); return { g };
  }
  def({ id: "pump", cat: "bottle", n: "زجاجة مضخّة 450 مل", tag: "مضخّة", colors: ["#f6f1ea", "#fbe6c8", "#e8d9ff", "#d9f0e4", "#ffe0e6"], c2: { n: "لون المضخّة", colors: ["#c9a89a", "#ffffff", "#2a2d33", "#d3a74a", "#8fb6d8"], def: "#c9a89a" }, fin: "gloss", areas: [{ id: "label", n: "الملصق", ar: (140 * Math.PI / 180 * 0.727) / 2.2, base: "label", src0: "quick", q: { name: "PUMP BOTTLE", sub: "Make Packaging Simple", vol: "450 ml", style: "plain", c1: "#b38b7d", c2: "#e2cdc3", ink: "#17191c", logo: false } }], view: { yaw: -0.5, pitch: 0.05 }, build: buildPump });

  /* علبة بروتين */
  function buildTub() {
    const S = CUR.s, R0 = 1.25, H = 2.3, g = group(), body = solid(S.color, S.finish), cap = solid(S.color2, S.finish);
    g.add(solidLathe([V2(0, 0), V2(R0 - 0.1, 0), ...bez([R0 - 0.1, 0], [R0, 0], [R0, 0.1], 6), V2(R0, H - 0.2), ...bez([R0, H - 0.2], [R0, H], [R0 - 0.1, H], 5), V2(R0 - 0.1, H - 0.04), V2(0, H - 0.04)], body, 128));
    g.add(solidLathe([V2(0, H - 0.1), V2(R0 + 0.02, H - 0.1), V2(R0 + 0.02, H + 0.5), ...bez([R0 + 0.02, H + 0.5], [R0 + 0.02, H + 0.58], [R0 - 0.08, H + 0.58], 6), V2(0, H + 0.58)], cap, 128));
    g.add(ribRing(H + 0.22, 0.4, R0 + 0.022, 72, cap)); g.add(wrap("label", R0 + 0.005, 0.12, H - 0.12, 360, 1));
    return { g };
  }
  def({ id: "tub", cat: "bottle", n: "علبة مسحوق بروتين", tag: "علبة", colors: ["#ffffff", "#7a62e0", "#2a2d33", "#2a7fb8", "#c8553d", "#7aa874"], c2: { n: "لون الغطاء", colors: ["#ffffff", "#2a2d33", "#7a62e0", "#d3a74a"], def: "#ffffff" }, fin: "satin", areas: [{ id: "label", n: "الملصق (يلفّ المحيط)", ar: 2 * Math.PI * 1.255 / 2.06, base: "label", safe: 0.34, src0: "quick", q: { name: "PROTEIN POWDER PROTOTYPE", sub: "", style: "band", layout: "center", c1: "#7a62e0", c2: "#ffffff", ink: "#17191c", logo: true } }], view: { yaw: -0.3, pitch: 0.16 }, build: buildTub });

  /* شامبو شفاف بمضخّة سوداء */
  function buildShampoo() {
    const S = CUR.s, R0 = 0.66, H = 3.1, P = [V2(0, 0), V2(R0 - 0.1, 0), ...bez([R0 - 0.1, 0], [R0, 0], [R0, 0.1], 6), V2(R0, H - 0.1), ...bez([R0, H - 0.1], [R0, H + 0.3], [0.3, H + 0.38], 12), V2(0.3, H + 0.55)], g = group(), pm = solid(S.color2, "satin");
    g.add(clearBody(P, { wall: 0.045, tint: "#f1f4f7", op: 0.1, liquid: { level: 2.5, color: S.color, op: 0.9 } })); g.add(pumpTop(H + 0.5, pm, 0.74)); g.add(wrap("label", R0 + 0.005, 0.7, 2.3, 200, 1)); return { g };
  }
  def({ id: "shampoo", cat: "bottle", n: "زجاجة شامبو بمضخّة", tag: "مضخّة", colors: ["#b8b36a", "#e8a7b8", "#8fb6d8", "#7aa874", "#d9a441", "#f4f4ef"], c2: { n: "لون المضخّة", colors: ["#1b1b1d", "#ffffff", "#c9a89a", "#d3a74a"], def: "#1b1b1d" }, fin: "gloss", areas: [{ id: "label", n: "الملصق", ar: (200 * Math.PI / 180 * 0.665) / 1.6, base: "label", src0: "quick", q: { name: "SHAMPOO BOTTLE", sub: "MOCKUP", style: "plain", layout: "center", c1: "#8a8a3a", c2: "#f0ead2", ink: "#17191c", logo: true } }], view: { yaw: -0.45, pitch: 0.05 }, build: buildShampoo });

  /* قارورة بغطاء قلاب (بيضوية) */
  function buildFlip() {
    const S = CUR.s, R0 = 0.8, H = 2.7, g = group(), sq = 0.58, body = solid(S.color, S.finish), cap = solid(S.color2, S.finish), inner = group();
    inner.add(solidLathe([V2(0, 0), V2(R0 - 0.2, 0), ...bez([R0 - 0.2, 0], [R0, 0], [R0, 0.2], 6), V2(R0, H - 0.5), ...bez([R0, H - 0.5], [R0, H - 0.05], [R0 - 0.35, H], 12), V2(R0 - 0.35, H + 0.04), V2(0, H + 0.04)], body, 128));
    inner.add(solidLathe([V2(0, H - 0.02), V2(R0 - 0.2, H - 0.02), V2(R0 - 0.2, H + 0.5), ...bez([R0 - 0.2, H + 0.5], [R0 - 0.2, H + 0.58], [R0 - 0.3, H + 0.58], 4), V2(0, H + 0.58)], cap, 96));
    inner.scale.z = sq; g.add(inner); g.add(wrap("label", R0 + 0.006, 0.45, 1.75, 120, sq)); return { g };
  }
  def({ id: "flip", cat: "bottle", n: "قارورة بغطاء قلاب", tag: "قارورة", colors: ["#ffffff", "#f3efe7", "#2a2d33", "#e8a7b8", "#8fb6d8", "#7aa874"], c2: { n: "لون الغطاء", colors: ["#ffffff", "#2a2d33", "#e8a7b8", "#d3a74a"], def: "#ffffff" }, fin: "gloss", areas: [{ id: "label", n: "الملصق الأمامي", ar: (120 * Math.PI / 180 * 0.8 * 0.9) / 1.3, base: "label", src0: "quick", q: { name: "COSMETIC BOTTLE MOCKUP", sub: "", style: "plain", layout: "center", c1: "#7a62e0", c2: "#8f7be8", ink: "#ffffff", logo: true } }], view: { yaw: -0.45, pitch: 0.06 }, build: buildFlip });

  /* قطّارة زجاج عنبري */
  function buildDropper() {
    const S = CUR.s, R0 = 0.62, H = 1.95, P = [V2(0, 0), V2(R0 - 0.1, 0), ...bez([R0 - 0.1, 0], [R0, 0], [R0, 0.1], 6), V2(R0, H - 0.3), ...bez([R0, H - 0.3], [R0, H + 0.12], [0.3, H + 0.22], 12), V2(0.3, H + 0.38)], g = group();
    g.add(clearBody(P, { wall: 0.06, tint: S.color, op: 0.55, liquid: { level: 1.55, color: shade(S.color, 0.7), op: 0.9 } }));
    const cm = solid(S.color2, "satin"), bulb = rubberM("#17171a"); g.add(solidLathe([V2(0, H + 0.3), V2(0.34, H + 0.3), V2(0.34, H + 0.72), V2(0.3, H + 0.76), V2(0, H + 0.76)], cm)); g.add(ribRing(H + 0.52, 0.34, 0.34, 40, cm));
    g.add(solidLathe([V2(0, H + 0.74), V2(0.19, H + 0.74), V2(0.21, H + 1.1), ...bez([0.21, H + 1.1], [0.23, H + 1.62], [0.0, H + 1.7], 10)], bulb)); g.add(mesh(new T.CylinderGeometry(0.035, 0.035, 1.6, 10), new T.MeshStandardMaterial({ color: 0xeaf0f3, roughness: 0.3, transparent: true, opacity: 0.8 }), 0, 0.9, 0)); g.add(wrap("label", R0 + 0.005, 0.28, 1.5, 170, 1)); return { g };
  }
  def({ id: "dropper", cat: "bottle", n: "قارورة قطّارة زجاجية", tag: "قطّارة", colors: ["#7a3f12", "#2a4a7a", "#1f5a3a", "#e8e2d4"], c2: { n: "لون الغطاء", colors: ["#1b1b1d", "#d3a74a", "#ffffff", "#c9c9cc"], def: "#d3a74a" }, fin: "gloss", areas: [{ id: "label", n: "الملصق", ar: (170 * Math.PI / 180 * 0.625) / 1.22, base: "label", src0: "quick", q: { name: "ESSENTIAL OIL", sub: "Dropper bottle", vol: "30 ml", style: "plain", layout: "center", c1: "#2f8f4e", c2: "#f3efe4", ink: "#17191c", logo: true } }], view: { yaw: -0.4, pitch: 0.1 }, build: buildDropper });

  /* علبة معدنية (مشروب) */
  function buildCan() {
    const S = CUR.s, R0 = 0.66, H = 2.55, g = group(), met = metalM("#d7dbe0", 0.18);
    g.add(solidLathe([V2(0, 0.06), V2(R0 - 0.2, 0.06), V2(R0 - 0.12, 0), V2(R0 - 0.02, 0.04), V2(R0 - 0.02, 0.18), V2(R0, 0.26), V2(R0, H - 0.3), ...bez([R0, H - 0.3], [R0, H - 0.18], [R0 - 0.12, H - 0.1], 6), V2(R0 - 0.2, H - 0.02), V2(R0 - 0.2, H - 0.06), V2(R0 - 0.26, H), V2(0, H)], met, 128));
    g.add(wrap("label", R0 + 0.003, 0.28, H - 0.34, 360, 1, { rough: 0.28, cc: 0.9, env: 1.15, metal: 0.55 })); g.children[g.children.length - 1].material.metalness = 0.6;
    const tab = mesh(new T.CylinderGeometry(0.2, 0.2, 0.02, 32), metalM("#cfd3d8", 0.25), 0, H + 0.01, 0.05); g.add(tab); return { g };
  }
  def({ id: "can", cat: "bottle", n: "علبة مشروب معدنية", tag: "علبة", colors: ["#e8f3ee", "#f2c94c", "#2a7fb8", "#c8553d", "#2a2d33", "#7aa874"], fin: "gloss", areas: [{ id: "label", n: "الطباعة (تلفّ العلبة)", ar: 2 * Math.PI * 0.663 / 1.93, base: "color", safe: 0.32, src0: "quick", q: { name: "FRESH DRINK", sub: "Sparkling water", vol: "330 ml", style: "wave", layout: "center", c1: "#2a7fb8", c2: "auto", ink: "#17191c", logo: true } }], view: { yaw: -0.45, pitch: 0.08 }, build: buildCan });

  /* برطمان عسل زجاجي بغطاء ذهبي */
  function buildHoney() {
    const S = CUR.s, R0 = 0.98, H = 1.62, P = [V2(0, 0), V2(R0 - 0.14, 0), ...bez([R0 - 0.14, 0], [R0, 0], [R0, 0.14], 6), V2(R0, H - 0.25), ...bez([R0, H - 0.25], [R0, H + 0.12], [0.78, H + 0.2], 10), V2(0.78, H + 0.34), V2(0.82, H + 0.36), V2(0.82, H + 0.4), V2(0.78, H + 0.4)], g = group();
    g.add(clearBody(P, { wall: 0.05, base: 0.12, tint: "#f6f8f8", op: 0.1, liquid: { level: H + 0.1, color: S.color, op: 0.92 } }));
    const gold = metalM(S.color2, 0.28); g.add(solidLathe([V2(0, H + 0.34), V2(0.86, H + 0.34), V2(0.86, H + 0.78), V2(0.82, H + 0.84), V2(0, H + 0.84)], gold, 128)); g.add(ribRing(H + 0.56, 0.36, 0.86, 64, gold)); g.add(wrap("label", R0 + 0.006, 0.34, 1.32, 175, 1));
    return { g };
  }
  def({ id: "honey", cat: "bottle", n: "برطمان عسل زجاجي", tag: "عسل", colors: ["#d9921c", "#e8b53a", "#a85f10", "#f0c96a"], c2: { n: "لون الغطاء", colors: ["#d3a74a", "#2a2d33", "#c9c9cc", "#8c5a3c"], def: "#d3a74a" }, fin: "gloss", areas: [{ id: "label", n: "الملصق", ar: (175 * Math.PI / 180 * 0.986) / 0.98, base: "label", src0: "quick", q: { name: "PURE HONEY", sub: "Natural & raw", vol: "500 g", style: "plain", layout: "center", c1: "#c47d12", c2: "#f7f0de", ink: "#3b2a10", logo: true } }], view: { yaw: -0.4, pitch: 0.1 }, build: buildHoney });

  /* أنبوب مستحضرات (قاعدته الغطاء) */
  function tubeBody(R0, H, base, top, sh) {
    const seg = 96, rings = 70, pos = [], idx = [], rx = y => y < base ? 0 : R0, thick = y => 1 - 0.95 * sstep(top - 1.1, top - 0.1, y);
    const prof = y => { if (y < sh[0]) return [0.4, 0.4]; if (y < sh[1]) { const t = sstep(sh[0], sh[1], y), r = lerp(0.4, R0, t); return [r, r]; } const z = Math.max(0.03, R0 * thick(y)); return [R0 + 0.1 * sstep(top - 1.1, top - 0.3, y), z]; };
    for (let i = 0; i <= rings; i++) { const y = lerp(base, H, i / rings), p = prof(y); for (let j = 0; j < seg; j++) { const a = j / seg * Math.PI * 2; pos.push(Math.sin(a) * p[0], y, Math.cos(a) * p[1]); } }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function buildTube() {
    const S = CUR.s, R0 = 0.62, H = 3.7, g = group(), body = solid(S.color, S.finish), cap = solid(S.color2, S.finish);
    g.add(mesh(tubeBody(R0, H, 0.55, H, [0.55, 1.05]), body)); g.add(solidLathe([V2(0, 0), V2(0.4, 0), V2(0.43, 0.04), V2(0.43, 0.5), V2(0.4, 0.58), V2(0.4, 0.6), V2(0, 0.6)], cap)); g.add(ribRing(0.3, 0.4, 0.43, 40, cap));
    const surf = (u, v) => { const a = (u - 0.5) * Math.PI * 0.8, y = lerp(1.15, 2.85, v), t = 1 - 0.95 * sstep(H - 1.1, H - 0.1, y), rr = R0 + 0.1 * sstep(H - 1.1, H - 0.3, y); return [Math.sin(a) * (rr + 0.006), y, Math.cos(a) * Math.max(0.03, R0 * t) + 0.006]; };
    const nu = 40, nv = 40, pos = [], uv = [], idx = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = surf(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, j / nv); } for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; idx.push(a, a + 1, a + nu + 2, a, a + nu + 2, a + nu + 1); }
    const lg = new T.BufferGeometry(); lg.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); lg.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); lg.setIndex(idx); lg.computeVertexNormals(); const lm = mesh(lg, areaMat("label", { rough: 0.4, cc: 0.4 })); lm.castShadow = false; g.add(lm);
    const crimp = mesh(new T.BoxGeometry(R0 * 2.2, 0.55, 0.06), body, 0, H - 0.28, 0); g.add(crimp); for (let i = 0; i < 9; i++) { const rg = mesh(new T.BoxGeometry(R0 * 2.2, 0.012, 0.075), body, 0, H - 0.5 + i * 0.05, 0); rg.castShadow = false; g.add(rg); }
    return { g };
  }
  def({ id: "tube", cat: "bottle", n: "أنبوب كريم", tag: "أنبوب", colors: ["#ffffff", "#e8a7b8", "#8fb6d8", "#7aa874", "#f2c94c", "#2a2d33"], c2: { n: "لون الغطاء", colors: ["#ffffff", "#2a2d33", "#e8a7b8", "#d3a74a"], def: "#ffffff" }, fin: "gloss", areas: [{ id: "label", n: "الطباعة الأمامية", ar: (Math.PI * 0.8 * 0.62) / 1.7, base: "color", src0: "quick", q: { name: "HAND CREAM", sub: "Nourishing care", vol: "75 ml", style: "wave", layout: "center", c1: "#7a62e0", c2: "auto", ink: "#17191c", logo: true } }], view: { yaw: -0.45, pitch: 0.06 }, build: buildTube });

  /* كوب سيراميك */
  function buildMug() {
    const S = CUR.s, R0 = 0.95, H = 1.85, g = group(), cer = solid(S.color, "gloss", { clearcoat: 1 }), outer = [V2(0, 0), V2(R0 - 0.1, 0), ...bez([R0 - 0.1, 0], [R0, 0], [R0, 0.1], 5), V2(R0, H - 0.04), V2(R0 - 0.02, H), V2(R0 - 0.09, H)], inn = [V2(R0 - 0.09, H), V2(R0 - 0.11, H - 0.04), V2(R0 - 0.11, 0.2), V2(0, 0.2)];
    g.add(solidLathe(outer, cer, 128)); const im = solidLathe(inn, solid(shade(S.color, 0.93), "gloss"), 128); im.material.side = T.DoubleSide; g.add(im);
    const hp = new T.CatmullRomCurve3([new T.Vector3(R0 - 0.04, 1.5, 0), new T.Vector3(R0 + 0.45, 1.55, 0), new T.Vector3(R0 + 0.62, 0.95, 0), new T.Vector3(R0 + 0.4, 0.4, 0), new T.Vector3(R0 - 0.04, 0.3, 0)]), hg = new T.TubeGeometry(hp, 40, 0.1, 14, false), hm = mesh(hg, cer); g.add(hm);
    const lab = wrap("label", R0 + 0.004, 0.3, 1.55, 150, 1, { rough: 0.25, cc: 0.9 }); g.add(lab); return { g };
  }
  def({ id: "mug", cat: "acc", n: "كوب سيراميك", tag: "كوب", colors: ["#ffffff", "#f3efe7", "#2a2d33", "#e8a7b8", "#8fb6d8", "#7aa874", "#f2c94c"], fin: "gloss", areas: [{ id: "label", n: "الطباعة (الجانب الأمامي)", ar: (150 * Math.PI / 180 * 0.954) / 1.25, base: "none", decal: true, src0: "quick", q: { name: "GOOD MORNING", sub: "Coffee lover", style: "plain", layout: "center", c1: "#2f8f4e", logo: true }, def: { sc: 0.9 } }], view: { yaw: -0.2, pitch: 0.16 }, build: buildMug });

  /* ═══ الملابس: لوحات منتفخة + أكمام مُجسَّمة + ياقات + طباعة تتبع القماش ═══ */
  const SHIRT = {
    tee: { hw: 0.322, A: 0.125, ny: 0.862, nyb: 0.975, nx: 0.105, sh: [0.288, 0.942], arm: [[0.293, 0.885], [0.304, 0.805], [0.316, 0.725]], ua: [0.326, 0.66], side: [[0.321, 0.42], [0.318, 0.2], [0.318, 0.05]], sl: { c: [0.31, 0.808], dir: [0.927, -0.375], L: 0.2, r0: 0.148, r1: 0.106, rz: 0.78, back: 0.075 } },
    oversize: { hw: 0.39, A: 0.15, ny: 0.87, nyb: 0.975, nx: 0.112, sh: [0.35, 0.935], arm: [[0.358, 0.855], [0.37, 0.775], [0.384, 0.695]], ua: [0.394, 0.62], side: [[0.394, 0.4], [0.39, 0.2], [0.386, 0.05]], sl: { c: [0.378, 0.778], dir: [0.9, -0.436], L: 0.235, r0: 0.172, r1: 0.138, rz: 0.82, back: 0.085 } },
    hoodie: { hw: 0.348, A: 0.165, ny: 0.915, nyb: 0.985, nx: 0.13, sh: [0.292, 0.955], arm: [[0.3, 0.875], [0.312, 0.79], [0.326, 0.7]], ua: [0.338, 0.63], side: [[0.34, 0.4], [0.346, 0.2], [0.344, 0.06]], sl: { c: [0.3, 0.79], dir: [0.16, -0.987], L: 0.62, r0: 0.13, r1: 0.088, rz: 0.84, back: 0.1 } }
  };
  function shirtPoly(P, yn) {
    const R = [], neck = bez([P.nx, 0.995], [P.nx * 0.95, yn + 0.012], [0, yn], 10).map(v => [v.x, v.y]).reverse(); neck.forEach((p, i) => R.push({ p, s: i === neck.length - 1 }));
    R.push({ p: P.sh, s: true }); P.arm.forEach(p => R.push({ p, s: false })); R.push({ p: P.ua, s: true }); P.side.forEach(p => R.push({ p, s: false })); R.push({ p: [P.hw - 0.014, 0.004], s: false }); R.push({ p: [P.hw * 0.5, 0.006], s: false }); R.push({ p: [0, 0.008], s: false });
    const L = R.slice(1, -1).reverse().map(o => ({ p: [-o.p[0], o.p[1]], s: o.s })), all = R.concat(L), sharp = []; all.forEach((o, i) => { if (o.s) sharp.push(i); });
    return smoothPoly(all.map(o => o.p), 2, sharp);
  }
  const ribM = (color, w) => { const m = fabricM(color, { ns: 0.9 }), t = ribNormal().clone(); t.repeat.set(w || 66, 1); t.needsUpdate = true; m.normalMap = t; return m; };
  const frameOf = (dir) => { const d = new T.Vector3(dir[0], dir[1], dir[2] || 0).normalize(), e2 = new T.Vector3(0, 0, 1), e1 = new T.Vector3().crossVectors(e2, d).normalize(); return { d, e1, e2 }; };
  function ringPts(P0, dir, len, r, n) { const f = frameOf(dir), o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, p = new T.Vector3(P0[0], P0[1], P0[2] || 0).addScaledVector(f.d, len).addScaledVector(f.e1, Math.cos(a) * r[0]).addScaledVector(f.e2, Math.sin(a) * r[1]); o.push([p.x, p.y, p.z]); } return o; }
  function buildShirt(kind) {
    const S = CUR.s, P = SHIRT[kind === "polo" || kind === "ringer" ? "tee" : kind], lo = CUR.q === "lo", step = lo ? 0.013 : 0.0066, key = (kind === "polo" || kind === "ringer" ? "tee" : kind) + step; CUR.m.cache = CUR.m.cache || {};
    const C = CUR.m.cache[key] || (CUR.m.cache[key] = { Ff: buildField(shirtPoly(P, P.ny), step, window.__BL), Fb: buildField(shirtPoly(P, P.nyb), step, window.__BL) }), Ff = C.Ff, Fb = C.Fb, hood = kind === "hoodie", R_ = P.hw * 1.05, A = P.A;
    const zf = (x, y, d) => { const t = Math.min(d / R_, 1), e = Math.sqrt(1 - (1 - t) * (1 - t)), hemF = 0.78 + 0.22 * sstep(0, 0.28, y); let z = A * e * hemF * (1 - 0.18 * sstep(0.8, 1, y)); z += (fbm(x * 3.1 + 1.7, y * 2.3) - 0.5) * 0.02 * sstep(0.02, 0.12, d); z += 0.012 * Math.sin(x * 11 + fbm(x * 4, y * 3) * 5) * sstep(0.05, 0.2, d) * (1 - sstep(0.55, 0.95, y)); return z; };
    const g = group(), body = fabricM(S.color), bodyIn = fabricM(shade(S.color, 0.76), { side: T.BackSide }), trim = (hood || kind === "polo" || kind === "ringer") ? ribM(S.color2, 70) : ribM(S.color, 70), flat = fabricM(S.color2);
    body.vertexColors = true; g.add(mesh(panelGeo(Ff, zf, 1, [1, 1], [0.38, 0.07]), body)); const gb = panelGeo(Fb, zf, -1, [1, 1], [0.38, 0.07]); g.add(mesh(gb, body)); const bi = mesh(gb, bodyIn); bi.castShadow = false; g.add(bi);
    /* الأكمام (يمين ثم مرآة اليسار) */
    const sl = P.sl, Lt = sl.L + sl.back, P0 = [sl.c[0] - sl.dir[0] * sl.back, sl.c[1] - sl.dir[1] * sl.back, 0], rfn = t => { const u = Math.max(0, (t * Lt - sl.back) / sl.L), r = lerp(sl.r0, sl.r1, Math.pow(u, 0.8)); return [r, r * sl.rz]; }, sg = loftGeo(P0, [sl.dir[0], sl.dir[1], 0], Lt, rfn, 36, 56), sMat = fabricM(S.color), sIn = fabricM(shade(S.color, 0.72), { side: T.BackSide });
    const cuffFrac = hood ? 0.17 : 0, mk = (sx) => { const gg = group(), a = mesh(cuffFrac ? loftGeo(P0, [sl.dir[0], sl.dir[1], 0], Lt, t => rfn(Math.min(t, 1 - cuffFrac * sl.L / Lt)), 36, 56) : sg, sMat), b = mesh(cuffFrac ? a.geometry : sg, sIn); b.castShadow = false; gg.add(a, b);
      if (cuffFrac) { const c0 = Lt - sl.L * cuffFrac, cg = loftGeo([P0[0] + sl.dir[0] * c0, P0[1] + sl.dir[1] * c0, 0], [sl.dir[0], sl.dir[1], 0], sl.L * cuffFrac, t => { const r = rfn(1 - cuffFrac * sl.L / Lt); return [r[0] * 0.93, r[1] * 0.93]; }, 8, 56); gg.add(mesh(cg, trim)); }
      else if (kind === "ringer" || kind === "polo") { const rp = ringPts(P0, [sl.dir[0], sl.dir[1], 0], Lt * 0.97, rfn(0.97), 56), ring = mesh(tubeCurve(rp, 0.011, true, 60, 8), flat); gg.add(ring); const rp2 = ringPts(P0, [sl.dir[0], sl.dir[1], 0], Lt, rfn(1), 56); gg.add(mesh(tubeCurve(rp2, 0.007, true, 60, 8), flat)); }
      else { const rp = ringPts(P0, [sl.dir[0], sl.dir[1], 0], Lt, rfn(1), 56); gg.add(mesh(tubeCurve(rp, 0.006, true, 60, 8), body)); }
      gg.scale.x = sx; return gg; };
    g.add(mk(1), mk(-1));
    /* الياقة */
    const nx = P.nx, fc = bez([-nx, 0.995], [-nx * 0.95, P.ny + 0.012], [0, P.ny], 12).map(v => [v.x, v.y - 0.006, 0.006]), fr = fc.slice(0, -1).concat(fc.slice().reverse().map(p => [-p[0], p[1], p[2]])), bc = bez([nx, 0.995], [nx * 0.95, P.nyb + 0.01], [0, P.nyb], 10).map(v => [v.x, v.y - 0.004, -0.006]);
    const ring = fr.slice(); for (let i = 0; i < bc.length; i++) ring.push(bc[i]); for (let i = bc.length - 2; i >= 0; i--) ring.push([-bc[i][0], bc[i][1], bc[i][2]]);
    const cm = (hood ? flat : trim), cr = hood ? 0.02 : (kind === "polo" ? 0.014 : 0.017); g.add(mesh(tubeCurve(ring, cr, true, 140, 10), kind === "polo" || kind === "ringer" || hood ? cm : ribM(S.color, 70)));
    /* مناطق الطباعة (تتبع سطح القماش) */
    const dm = o => areaMat(o, { rough: 0.9, cc: 0, ccr: 0.6, env: 0.6 }), ar = CUR.m.areas;
    const fr_ = ar.find(a => a.id === "front"), rr = fr_.rect, nxd = lo ? 36 : Math.round((rr[2] - rr[0]) / 0.006), nyd = lo ? 48 : Math.round((rr[3] - rr[1]) / 0.006);
    const dg = mesh(decalGeo(Ff, zf, 1, rr, nxd, nyd, 0.0025), dm("front")); dg.castShadow = false; g.add(dg); const br = ar.find(a => a.id === "back").rect, dgb = mesh(decalGeo(Fb, zf, -1, br, Math.round(nxd * (br[2] - br[0]) / (rr[2] - rr[0])), nyd, 0.0025), dm("back")); dgb.castShadow = false; g.add(dgb);
    if (kind === "polo") {
      const zfront = (x, y) => zf(x, y, dAt(Ff, x, y)), flapPoly = (s) => [[s * 0.108, 0.992], [s * 0.19, 0.95], [s * 0.1, 0.795], [s * 0.012, 0.862]], FM = fabricM(shade(S.color, 0.98));
      [1, -1].forEach(s => { const F2 = buildField(flapPoly(s), 0.006), gm = mesh(panelGeo(F2, (x, y, d) => zfront(x, y) + 0.008 + 0.006 * sstep(0, 0.02, d), 1, [1, 1]), FM); g.add(gm); });
      const PL = buildField([[-0.022, 0.86], [0.022, 0.86], [0.022, 0.69], [-0.022, 0.69]], 0.005); g.add(mesh(panelGeo(PL, (x, y, d) => zfront(x, y) + 0.005 + 0.004 * sstep(0, 0.01, d), 1, [1, 1]), fabricM(shade(S.color, 0.96))));
      [0.82, 0.745].forEach(y => { const bt = mesh(new T.CylinderGeometry(0.0125, 0.0125, 0.006, 20), new T.MeshPhysicalMaterial({ color: new T.Color(S.color2), roughness: 0.35, clearcoat: 0.6 }), 0, y, zfront(0, y) + 0.014); bt.rotation.x = Math.PI / 2; g.add(bt); });
    }
    if (hood) {
      const zfront = (x, y) => zf(x, y, dAt(Ff, x, y));
      const hg = new T.SphereGeometry(1, 56, 40, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.62), hm = fabricM(S.color, { side: T.FrontSide }), hin = fabricM(shade(S.color, 0.8), { side: T.BackSide });
      const h1 = mesh(hg, hm), h2 = mesh(hg, hin); [h1, h2].forEach(h => { h.scale.set(0.2, 0.225, 0.19); h.position.set(0, 1.0, -0.075); }); h2.castShadow = false; g.add(h2, h1);
      const PK = buildField([[-0.205, 0.335], [0.205, 0.335], [0.175, 0.1], [-0.175, 0.1]], 0.006); g.add(mesh(panelGeo(PK, (x, y, d) => zfront(x, y) + 0.004 + 0.016 * Math.sqrt(sstep(0, 0.03, d)), 1, [1, 1]), fabricM(S.color)));
      const HB = buildField([[-0.31, 0.088], [0.31, 0.088], [0.318, 0.0], [-0.318, 0.0]], 0.005); g.add(mesh(panelGeo(HB, (x, y, d) => zfront(x, y) + 0.004 + 0.008 * sstep(0, 0.012, d), 1, [1, 1]), trim));
      [-1, 1].forEach(s => { const pts = [[s * 0.045, 0.9, zfront(s * 0.045, 0.9) + 0.018], [s * 0.05, 0.8, zfront(s * 0.05, 0.8) + 0.02], [s * 0.047, 0.7, zfront(s * 0.047, 0.7) + 0.02], [s * 0.05, 0.6, zfront(s * 0.05, 0.6) + 0.02]]; g.add(mesh(tubeCurve(pts, 0.007, false, 40, 8), new T.MeshStandardMaterial({ color: 0xe9e4d9, roughness: 0.85 }))); const ag = mesh(new T.CylinderGeometry(0.0085, 0.0085, 0.04, 12), metalM("#c9c9cc", 0.3), s * 0.05, 0.588, pts[3][2]); g.add(ag); });
    }
    return { g };
  }
  const TEE_AREAS = (nm, extra) => [{ id: "front", n: "الصدر", ar: 0.56 / 0.74, rect: [-0.28, 0.1, 0.28, 0.84], decal: true, src0: "quick", def: { sc: 0.5, y: 0.5 }, q: Object.assign({ name: nm, sub: "Realistic 3D mockups", style: "plain", c1: "#2f8f4e", ink: "auto", logo: true }, extra || {}) }, { id: "back", n: "الظهر", ar: 0.56 / 0.8, rect: [-0.28, 0.08, 0.28, 0.88], decal: true, def: { sc: 0.7, y: 0.1 }, q: { name: "BRAND", sub: "", style: "plain", ink: "auto", logo: false } }];
  const TCOL = ["#f4f4f2", "#b9bcc2", "#2a2d33", "#b83a3a", "#2a62b8", "#c9b99a", "#bda7ee", "#f4b8c8", "#6a8f5a"];
  def({ id: "tee", cat: "apparel", n: "تيشيرت رجالي بعنق دائري", tag: "تيشيرت", colors: TCOL, fin: "matte", areas: TEE_AREAS("T-SHIRT MOCKUP"), view: { yaw: -0.18, pitch: 0.1 }, build: () => buildShirt("tee") });
  def({ id: "ringer", cat: "apparel", n: "تيشيرت بحواف ملوّنة", tag: "تيشيرت", colors: ["#f4f4f2", "#2a2d33", "#b9bcc2", "#c9b99a"], c2: { n: "لون الياقة والأطراف", colors: ["#6cc7c0", "#2a62b8", "#b83a3a", "#2a2d33", "#f2c94c", "#e8a7b8"], def: "#6cc7c0" }, fin: "matte", areas: TEE_AREAS("T-SHIRT", { c1: "#6cc7c0" }), view: { yaw: -0.22, pitch: 0.1 }, build: () => buildShirt("ringer") });
  def({ id: "oversize", cat: "apparel", n: "تيشيرت أوفر سايز", tag: "تيشيرت", colors: ["#f4f4f2", "#2a2d33", "#6a8f5a", "#c9b99a", "#bda7ee", "#6cc7c0"], fin: "matte", areas: TEE_AREAS("OVERSIZED T-SHIRT"), view: { yaw: -0.2, pitch: 0.1 }, build: () => buildShirt("oversize") });
  def({ id: "polo", cat: "apparel", n: "قميص بولو بأكمام قصيرة", tag: "بولو", colors: ["#f4f4f2", "#2a2d33", "#2a62b8", "#b83a3a", "#6a8f5a", "#c9b99a"], c2: { n: "لون الياقة والأزرار", colors: ["#8fb8e8", "#2a2d33", "#f4f4f2", "#b83a3a", "#6cc7c0", "#f2c94c"], def: "#8fb8e8" }, fin: "matte", areas: [{ id: "front", n: "الصدر", ar: 0.56 / 0.6, rect: [-0.28, 0.1, 0.28, 0.7], decal: true, src0: "quick", def: { sc: 0.34, x: -0.5, y: 0.1 }, q: { name: "POLO", sub: "", style: "plain", ink: "auto", logo: true } }, { id: "back", n: "الظهر", ar: 0.56 / 0.8, rect: [-0.28, 0.08, 0.28, 0.88], decal: true, def: { sc: 0.7, y: 0.1 }, q: { name: "BRAND", sub: "", style: "plain", ink: "auto", logo: false } }], view: { yaw: -0.2, pitch: 0.1 }, build: () => buildShirt("polo") });
  def({ id: "hoodie", cat: "apparel", n: "هودي أوفر سايز", tag: "هودي", colors: ["#f4f4f2", "#2a2d33", "#5f7f4f", "#b83a3a", "#2a62b8", "#bda7ee", "#c9b99a"], c2: { n: "لون الأطراف والحبال", colors: ["#f4f4f2", "#2a2d33", "#5f7f4f", "#b83a3a"], def: "#f4f4f2" }, fin: "matte", areas: [{ id: "front", n: "الصدر", ar: 0.5 / 0.46, rect: [-0.25, 0.36, 0.25, 0.82], decal: true, src0: "quick", def: { sc: 0.7, y: 0 }, q: { name: "OVERSIZED HOODIE MOCKUP", sub: "", style: "plain", ink: "auto", logo: true } }, { id: "back", n: "الظهر", ar: 0.56 / 0.8, rect: [-0.28, 0.08, 0.28, 0.88], decal: true, def: { sc: 0.7, y: 0.1 }, q: { name: "BRAND", sub: "", style: "plain", ink: "auto", logo: false } }], view: { yaw: -0.2, pitch: 0.1 }, build: () => buildShirt("hoodie") });

  /* ═══ قبعة بيسبول ═══ */
  function buildCap() {
    const S = CUR.s, lo = CUR.q === "lo", rx = 0.5, ry = 0.52, rz = 0.56, g = group(), body = fabricM(S.color, { ns: 0.5 }), bodyIn = fabricM(shade(S.color, 0.7), { side: T.BackSide }), vis = fabricM(S.color2, { ns: 0.5 });
    const dome = new T.SphereGeometry(1, lo ? 48 : 96, lo ? 28 : 56, 0, Math.PI * 2, 0, Math.PI * 0.5), pos = dome.attributes.position; for (let i = 0; i < pos.count; i++) { let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const th = Math.acos(clamp(y, -1, 1)); z *= (z > 0 ? 1 + 0.06 * Math.sin(th) : 1); pos.setXYZ(i, x * rx, y * ry, z * rz); } dome.computeVertexNormals();
    g.add(mesh(dome, body)); const di = mesh(dome, bodyIn); di.castShadow = false; g.add(di);
    const pt = (th, ph, off) => { const sx = Math.sin(th) * Math.sin(ph), sz = Math.sin(th) * Math.cos(ph), sy = Math.cos(th); const n = new T.Vector3(sx / (rx * rx), sy / (ry * ry), sz / (rz * rz)).normalize(); return [sx * rx + n.x * off, sy * ry + n.y * off, sz * (sz > 0 ? rz * (1 + 0.06 * Math.sin(th)) : rz) + n.z * off]; };
    const seamM = fabricM(shade(S.color, 0.86), { ns: 0.3 }); for (let k = 0; k < 6; k++) { const ph = k * Math.PI / 3, pts = []; for (let i = 0; i <= 24; i++) pts.push(pt(0.05 + (Math.PI * 0.5 - 0.06) * i / 24, ph, 0.002)); g.add(mesh(tubeCurve(pts, 0.0055, false, 40, 6), seamM)); }
    for (let k = 0; k < 6; k++) { const ph = k * Math.PI / 3 + Math.PI / 6, p = pt(0.62, ph, 0.004), e = mesh(new T.CylinderGeometry(0.014, 0.014, 0.006, 16), metalM("#c9c9cc", 0.3), p[0], p[1], p[2]); e.lookAt(p[0] * 3, p[1] * 3 + 1, p[2] * 3); e.rotateX(Math.PI / 2); e.castShadow = false; g.add(e); }
    g.add(mesh(new T.SphereGeometry(0.036, 24, 16), vis, 0, ry + 0.004, 0));
    const band = []; for (let i = 0; i < 80; i++) { const a = i / 80 * Math.PI * 2; band.push([Math.sin(a) * rx * 0.99, 0.012, Math.cos(a) * rz * 0.99]); } g.add(mesh(tubeCurve(band, 0.016, true, 90, 8), vis));
    /* القناع: سطح علوي وسفلي وحافة، منحنٍ للأسفل */
    const vis_ = (() => {
      const nu = lo ? 14 : 30, nv = lo ? 8 : 16, T0 = [], pos = [], idx = [], z0 = 0.38, ln = 0.56, th = 0.016, wv = v => 0.44 * Math.pow(Math.max(0, 1 - Math.pow(v, 2.8)), 1 / 2.8), hv = (x, z) => 0.025 - 0.12 * Math.pow(x / 0.45, 2) - 0.17 * (z - z0) / ln * (z - z0) / ln * 0.6 - 0.07 * (z - z0) / ln;
      const P = (x, z, up) => { const y = hv(x, z) + (up ? th / 2 : -th / 2); return [x, y, z]; };
      const grid = (up) => { const o = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const v = j / nv, x = (i / nu * 2 - 1) * wv(v), z = z0 + v * ln; o.push(P(x, z, up)); } return o; };
      const top = grid(true), bot = grid(false), at = (i, j) => j * (nu + 1) + i; const all = top.concat(bot), off = top.length;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1); idx.push(a, c, b, b, c, d); idx.push(off + a, off + b, off + c, off + b, off + d, off + c); }
      const edge = []; for (let i = 0; i <= nu; i++) edge.push(at(i, nv)); for (let j = nv; j >= 0; j--) edge.push(at(nu, j)); const edge2 = []; for (let j = 0; j <= nv; j++) edge2.push(at(0, j));
      const strip = (arr) => { for (let k = 0; k < arr.length - 1; k++) { const a = arr[k], b = arr[k + 1]; idx.push(a, off + a, b, b, off + a, off + b); } }; strip(edge.slice(0, nu + 1)); strip(edge.slice(nu)); strip(edge2);
      const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(all.flat(), 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
    })();
    const vm = mesh(vis_, vis); vm.material.side = T.DoubleSide; g.add(vm);
    /* الطباعة على اللوحة الأمامية */
    const nu = lo ? 20 : 48, nv = lo ? 16 : 36, P = [], U = [], I = [], th0 = 0.5, th1 = 1.3, ph0 = -0.56, ph1 = 0.56;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = pt(lerp(th1, th0, j / nv), lerp(ph0, ph1, i / nu), 0.005); P.push(...p); U.push(i / nu, j / nv); } for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; I.push(a, a + 1, a + nu + 2, a, a + nu + 2, a + nu + 1); }
    const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.Float32BufferAttribute(P, 3)); dg.setAttribute("uv", new T.Float32BufferAttribute(U, 2)); dg.setIndex(I); dg.computeVertexNormals(); const dm = mesh(dg, areaMat("front", { rough: 0.9, cc: 0, ccr: 0.6, env: 0.6 })); dm.castShadow = false; g.add(dm);
    return { g };
  }
  def({ id: "cap", cat: "apparel", n: "قبعة بيسبول", tag: "قبعة", colors: ["#9edbd2", "#f4f4f2", "#2a2d33", "#2a4a7a", "#c9b99a", "#b83a3a", "#6a8f5a", "#f2c94c"], c2: { n: "لون القناع والزرّ", colors: ["#9edbd2", "#f4f4f2", "#2a2d33", "#2a4a7a", "#c9b99a", "#b83a3a"], def: "#9edbd2" }, fin: "matte", areas: [{ id: "front", n: "الشعار الأمامي", ar: 1.5, decal: true, src0: "quick", def: { sc: 1, y: 0.05 }, q: { name: "BASEBALL CAP", sub: "MOCKUP", style: "plain", ink: "auto", logo: true, c1: "#f2c94c" } }], view: { yaw: -0.55, pitch: 0.2 }, build: buildCap });

  /* ═══ حقيبة قماشية (Tote) ═══ */
  function buildTote() {
    const S = CUR.s, lo = CUR.q === "lo", W = 0.86, H = 0.98, step = lo ? 0.016 : 0.0085, key = "tote" + step; CUR.m.cache = CUR.m.cache || {};
    const F = CUR.m.cache[key] || (CUR.m.cache[key] = buildField(roundRect(W, H, 0.012, 0.012, 4), step, 0.05)), g = group(), body = fabricM(S.color, { rough: 0.95, ns: 0.8 }), strap = fabricM(S.color2, { rough: 0.95, ns: 0.8 });
    const zf = (x, y, d) => { const t = Math.min(d / 0.34, 1), e = Math.sqrt(1 - (1 - t) * (1 - t)), up = 0.55 + 0.45 * sstep(0.05, 0.55, y / H); let z = 0.07 * e * up; z += (fbm(x * 3.4 + 5, y * 2.8) - 0.5) * 0.03 * sstep(0.02, 0.15, d); z += 0.006 * Math.sin(x * 22 + fbm(x * 3, y * 3) * 4) * (1 - y / H) * sstep(0.03, 0.12, d); return z + 0.002; };
    body.vertexColors = true; g.add(mesh(panelGeo(F, zf, 1, [1, 1], [0.3, 0.06]), body)); const gb = panelGeo(F, zf, -1, [1, 1], [0.3, 0.06]); g.add(mesh(gb, body)); const gi = mesh(gb, fabricM(shade(S.color, 0.75), { side: T.BackSide })); gi.castShadow = false; g.add(gi);
    [1, -1].forEach(s => { const z0 = s * (zf(0.2, H - 0.03, 0.03) + 0.006), pts = [[-0.22, H - 0.04, 0], [-0.24, H + 0.16, 0], [-0.17, H + 0.4, 0], [0, H + 0.5, 0], [0.17, H + 0.4, 0], [0.24, H + 0.16, 0], [0.22, H - 0.04, 0]], tg = tubeCurve(pts, 0.032, false, 60, 12), hm = mesh(tg, strap); hm.scale.z = 0.3; hm.position.z = z0; g.add(hm); [-0.22, 0.22].forEach(x => { const pm = mesh(new T.BoxGeometry(0.09, 0.07, 0.01), strap, x, H - 0.065, s * (zf(x, H - 0.065, 0.065) + 0.007)); g.add(pm); }); });
    const dm = o => areaMat(o, { rough: 0.95, cc: 0, ccr: 0.7, env: 0.5 }), rr = CUR.m.areas[0].rect, nxd = lo ? 30 : 72, nyd = lo ? 36 : 90;
    const d1 = mesh(decalGeo(F, zf, 1, rr, nxd, nyd, 0.0025), dm("front")); d1.castShadow = false; g.add(d1); const d2 = mesh(decalGeo(F, zf, -1, rr, nxd, nyd, 0.0025), dm("back")); d2.castShadow = false; g.add(d2);
    return { g };
  }
  def({ id: "tote", cat: "apparel", n: "حقيبة قماشية (Tote Bag)", tag: "حقيبة", colors: ["#efe6d3", "#f4f4f2", "#2a2d33", "#2a4a7a", "#6a8f5a", "#b83a3a", "#e8a7b8"], c2: { n: "لون المقابض", colors: ["#efe6d3", "#f4f4f2", "#2a2d33", "#2a4a7a", "#b8895a"], def: "#efe6d3" }, fin: "matte", areas: [{ id: "front", n: "الواجهة", ar: 0.62 / 0.66, rect: [-0.31, 0.12, 0.31, 0.78], decal: true, src0: "quick", def: { sc: 0.8, y: 0 }, q: { name: "TOTE BAG", sub: "Eco friendly", style: "plain", ink: "auto", logo: true } }, { id: "back", n: "الخلف", ar: 0.62 / 0.66, rect: [-0.31, 0.12, 0.31, 0.78], decal: true, def: { sc: 0.8, y: 0 }, q: { name: "BRAND", sub: "", style: "plain", ink: "auto", logo: false } }], view: { yaw: -0.3, pitch: 0.1 }, build: buildTote });

  /* ═══ الواجهة: معرض النماذج + المحرّر ═══ */
  const CATS = [["all", "الكل"], ["box", "علب وصناديق"], ["bottle", "قوارير وعبوات"], ["pouch", "أكياس"], ["apparel", "ملابس وحقائب"], ["acc", "إكسسوارات"], ["cup", "أكواب وعلب مشروبات"], ["misc", "كتب وبطاقات وأجهزة"]];
  const REV = "r1", TKEY = "alyssum_mk_thumbs_" + REV;
  let GF = false, PROJ = null, MINE = null, dirtyP = false, autoT = 0, saving = false, VIEW = "gallery", CATSEL = "all", QTXT = "", SEL = { area: null }, THUMBS = {}, PICK = {}, STATES = {}, thumbRun = false, thumbToken = 0, rebuildT = 0, areaT = 0;
  try { THUMBS = JSON.parse(localStorage.getItem(TKEY) || "{}"); } catch (e) { THUMBS = {}; }
  const saveThumbs = () => { try { localStorage.setItem(TKEY, JSON.stringify(THUMBS)); } catch (e) { THUMBS = {}; } };
  const tkey = (m, c) => m.id + "|" + (c || m.colors[0]);
  const STYLES = [["plain", "بسيط"], ["band", "شريط هندسي"], ["circles", "دوائر"], ["wave", "موجة"], ["split", "قسمان"], ["gradient", "تدرّج"], ["checker", "مربعات"], ["stripes", "خطوط مائلة"], ["dots", "نقاط"]];
  const LAYOUTS = [["", "تلقائي"], ["center", "وسط"], ["low", "أسفل"]];
  const CSS = '#mk-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:.8rem}#mk{background:rgba(9,24,18,.99);border:1px solid rgba(var(--g-mint-rgb,198,254,23),.35);border-radius:18px;width:min(1440px,100%);height:min(94vh,920px);display:flex;flex-direction:column;color:#fff;direction:rtl;overflow:hidden}#mk .mk-h{display:flex;align-items:center;gap:.7rem;padding:.65rem 1rem;border-bottom:1px solid rgba(255,255,255,.12);flex-wrap:wrap}#mk .mk-h b{font-size:1.05rem}#mk .mk-h small{opacity:.65}#mk .mk-h input{margin-inline-start:auto;width:min(260px,100%)}#mk .mk-cats{display:flex;gap:.4rem;padding:.55rem 1rem;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.08)}#mk .mk-body{flex:1;min-height:0;overflow:auto;position:relative}#mk .mk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:1rem;padding:1rem}#mk .mk-card{background:#fff;border-radius:18px;color:#222;cursor:pointer;overflow:hidden;position:relative;border:1px solid rgba(0,0,0,.14);transition:transform .15s,box-shadow .15s}#mk .mk-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(0,0,0,.35)}#mk .mk-th{aspect-ratio:1/1;background:radial-gradient(circle at 50% 40%,#fbfbfc,#e4e7ed);position:relative;display:flex;align-items:center;justify-content:center}#mk .mk-th img{width:100%;height:100%;object-fit:contain;display:block}#mk .mk-th .sk{width:46%;height:46%;border-radius:50%;background:linear-gradient(90deg,#e6e8ee,#f4f5f8,#e6e8ee);background-size:200% 100%;animation:mksk 1.2s linear infinite}@keyframes mksk{to{background-position:-200% 0}}#mk .mk-3d{position:absolute;top:.5rem;left:.6rem;font-weight:800;font-size:.95rem;color:#7a8499;opacity:.8;pointer-events:none}#mk .mk-ct{padding:.55rem .8rem .2rem;font-weight:700;font-size:.86rem;color:#4a5160}#mk .mk-sw{display:flex;gap:.35rem;padding:.2rem .8rem .7rem;flex-wrap:wrap}#mk .mk-sw i,#mk .sw i{width:20px;height:20px;border-radius:50%;border:1.5px solid rgba(0,0,0,.25);display:inline-block;cursor:pointer;box-shadow:inset 0 1px 2px rgba(255,255,255,.5)}#mk .mk-sw i.on,#mk .sw i.on{outline:2px solid #2f8f4e;outline-offset:2px}#mk .mk-ed{display:grid;grid-template-columns:minmax(0,1fr) 400px;height:100%}@media(max-width:960px){#mk .mk-ed{grid-template-columns:1fr;grid-template-rows:minmax(320px,46%) 1fr}}#mk .mk-st{position:relative;min-height:300px;overflow:hidden}#mk .mk-3d2{position:absolute;top:.7rem;left:.9rem;font-weight:800;font-size:1.5rem;color:#6b7a9c;opacity:.55;pointer-events:none}#mk .mk-hint{position:absolute;bottom:.6rem;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.55);padding:.25rem .8rem;border-radius:999px;font-size:.74rem;pointer-events:none;white-space:nowrap;color:#fff}#mk .mk-side{overflow:auto;padding:.8rem 1rem;border-inline-start:1px solid rgba(255,255,255,.12)}#mk h4{margin:.95rem 0 .4rem;font-size:.9rem;color:var(--g-mint,#c6fe17)}#mk h4:first-child{margin-top:0}#mk label.f{display:block;font-weight:700;font-size:.76rem;margin:.45rem 0 .15rem;color:rgba(255,255,255,.85)}#mk .mk-side input,#mk .mk-side select,#mk .mk-h input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.22);border-radius:10px;color:#fff;padding:.4rem .5rem;font:inherit;font-size:.85rem}#mk select option{color:#111}#mk input[type=color]{padding:.1rem;height:2rem}#mk input[type=range]{padding:0;accent-color:#c6fe17}#mk input[type=checkbox]{width:auto}#mk .r2{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}#mk .r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem}#mk button{cursor:pointer;border-radius:12px;padding:.5rem .8rem;font-weight:800;color:#fff;font-size:.82rem;border:1px solid rgba(var(--g-mint-rgb,198,254,23),.45);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,198,254,23),.3),rgba(var(--g-mint-rgb,198,254,23),.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 4px rgba(0,0,0,.25),0 3px 8px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s;font-family:inherit}#mk button:hover{transform:translateY(-2px)}#mk button.o{border-color:rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04))}#mk button.on{border-color:#c6fe17;background:linear-gradient(180deg,rgba(var(--g-mint-rgb,198,254,23),.55),rgba(var(--g-mint-rgb,198,254,23),.2))}#mk .mk-b{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem}#mk .mk-f{padding:.5rem 1rem;border-top:1px solid rgba(255,255,255,.12);min-height:2rem;font-weight:700;font-size:.85rem}#mk .m{font-size:.74rem;color:rgba(255,255,255,.65);line-height:1.6}#mk .mk-up{border:1.5px dashed rgba(255,255,255,.3);border-radius:12px;padding:.7rem;text-align:center;cursor:pointer;font-size:.8rem;display:block}#mk .mk-up:hover{border-color:#c6fe17}#mk .sw{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}#mk .sw i{border-color:rgba(255,255,255,.45)}#mk .sw input[type=color]{width:26px;height:26px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.5)}#mk .tabs{display:flex;gap:.3rem;flex-wrap:wrap}#mk .tabs button{padding:.35rem .6rem;font-size:.76rem}#mk .mk-h input{width:auto;flex:0 1 280px}#mk .mk-roles{display:grid;gap:.4rem;margin-top:.4rem}#mk .mk-role{display:grid;grid-template-columns:4.2rem 1fr 34px;gap:.4rem;align-items:center;font-size:.78rem}#mk .mk-role b{font-weight:700;font-size:.76rem}#mk .mk-role input[type=color]{width:34px;height:30px;padding:2px}#mk .mk-ron{grid-column:2/4;display:flex;gap:.3rem;align-items:center;font-size:.76rem}#mk .mk-pv{color:var(--g-mint,#c6fe17)}#mk .mk-pj{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:.5rem .7rem;margin-bottom:.4rem}';
  const cfgSave = () => saveCfg();
  const sel = (k, label, opts, cur, attr) => (label ? '<label class="f">' + label + "</label>" : "") + "<select " + (attr || 'data-k="' + k + '"') + ">" + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
  const rng = (attr, label, mn, mx, st, val) => '<label class="f">' + label + '</label><input ' + attr + ' type="range" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + val + '">';
  const swatches = (cols, cur, attr) => '<div class="sw">' + cols.map(c => '<i ' + attr + '="' + c + '" style="background:' + c + '" class="' + (c.toLowerCase() === String(cur).toLowerCase() ? "on" : "") + '" title="' + c + '"></i>').join("") + '<input type="color" ' + attr + '-pick value="' + (/^#[0-9a-f]{6}$/i.test(cur) ? cur : "#ffffff") + '" title="لون مخصص"></div>';

  /* ═══ المعرض ═══ */
  const listModels = () => MODELS.filter(m => (CATSEL === "all" || m.cat === CATSEL) && (!QTXT || (m.n + " " + m.tag + " " + m.id).toLowerCase().includes(QTXT.toLowerCase())));
  function renderGallery() {
    const body = $("mk-body"); if (!body) return; flushSave(); PROJ = null; dirtyP = false; clearTimeout(autoT); VIEW = "gallery"; detachStage();
    const cats = $("mk-cats"); cats.innerHTML = CATS.map(c => '<button type="button" class="' + (CATSEL === c[0] ? "on" : "o") + '" data-cat="' + c[0] + '">' + c[1] + "</button>").join(""); cats.style.display = "flex";
    body.innerHTML = '<div class="mk-grid">' + listModels().map(m => { const c = PICK[m.id] || m.colors[0], th = THUMBS[tkey(m, c)]; return '<div class="mk-card" data-m="' + m.id + '"><div class="mk-th"><span class="mk-3d">3D⟳</span>' + (th ? '<img alt="" src="' + th + '">' : '<span class="sk"></span>') + '</div><div class="mk-ct">' + esc(m.n) + '</div><div class="mk-sw">' + m.colors.slice(0, 7).map(k => '<i data-sw="' + k + '" style="background:' + k + '" class="' + (k.toLowerCase() === c.toLowerCase() ? "on" : "") + '"></i>').join("") + "</div></div>"; }).join("") + "</div>" + (listModels().length ? "" : '<p class="m" style="padding:2rem;text-align:center">لا نماذج مطابقة للبحث.</p>');
    body.querySelectorAll(".mk-card").forEach(card => { const id = card.dataset.m; card.onclick = e => { const sw = e.target.closest("[data-sw]"); if (sw) { e.stopPropagation(); PICK[id] = sw.dataset.sw; renderGallery(); return; } openEditor(id); }; });
    cats.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { CATSEL = b.dataset.cat; renderGallery(); });
    msg("اختر نموذجاً لتخصيصه — كل النماذج ثلاثية الأبعاد قابلة للتدوير");
    thumbLoop();
  }
  async function thumbLoop() {
    if (thumbRun || !opened) return; thumbRun = true; const tok = ++thumbToken;
    try {
      await new Promise(r => setTimeout(r, 30));
      for (const m of listModels()) {
        if (!opened || VIEW !== "gallery" || tok !== thumbToken) break; const c = PICK[m.id] || m.colors[0], k = tkey(m, c); if (THUMBS[k]) continue;
        try { GF = true; const st = newState(m); st.color = c; loadModel(m, st, { q: "lo" }); const cv = renderTo(360, 360, true), url = cv.toDataURL("image/webp", 0.82); THUMBS[k] = url.startsWith("data:image/webp") ? url : cv.toDataURL("image/png"); } catch (e) { THUMBS[k] = ""; } finally { GF = false; }
        const card = document.querySelector('#mk .mk-card[data-m="' + m.id + '"]'); if (card && THUMBS[k] && (PICK[m.id] || m.colors[0]) === c) { const th = card.querySelector(".mk-th"), sk = th.querySelector(".sk"); if (sk) sk.remove(); let im = th.querySelector("img"); if (!im) { im = document.createElement("img"); im.alt = ""; th.appendChild(im); } im.src = THUMBS[k]; }
        await new Promise(r => setTimeout(r, 16));
      }
      saveThumbs();
    } finally { thumbRun = false; }
  }

  /* ═══ حفظ المشاريع (حساب المدير: يتزامن بين الأجهزة) ═══ */
  const MAXP = 40;
  const store = {
    async get(k, d) { try { if (typeof Priv !== "undefined") { const v = await Priv.get(k, d); return v == null ? d : v; } const v = localStorage.getItem("alyssum_mkp_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    async set(k, v) { if (typeof Priv !== "undefined") return Priv.set(k, v); try { localStorage.setItem("alyssum_mkp_" + k, JSON.stringify(v)); } catch (e) { throw new Error("المساحة ممتلئة"); } }
  };
  const cvData = (cv, max) => { let c = cv; const k = Math.min(1, max / Math.max(cv.width, cv.height)); if (k < 1) { c = canv(Math.round(cv.width * k), Math.round(cv.height * k)); c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height); } const u = c.toDataURL("image/webp", 0.88); return u.startsWith("data:image/webp") ? u : c.toDataURL("image/png"); };
  function pack() {
    const m = CUR.m, s = CUR.s, a = {};
    m.areas.forEach(ad => { const x = s.a[ad.id]; a[ad.id] = { src: x.src, img: x.img ? cvData(x.img, 1400) : null, fit: x.fit, sc: x.sc, x: x.x, y: x.y, rot: x.rot, q: x.q }; });
    return { v: 1, model: m.id, color: s.color, color2: s.color2, finish: s.finish, open: s.open, roles: s.roles || null, P: s.P || null, a, cfg: { bg: CFG.bg, bg1: CFG.bg1, bg2: CFG.bg2 }, view: { yaw: view.yaw, pitch: view.pitch, zoom: view.zoom }, area: SEL.area };
  }
  async function mineList(force) { if (!MINE || force) { const l = await store.get("mockups", []); MINE = Array.isArray(l) ? l : []; } return MINE; }
  function mineBtn() { const b = $("mk-mine"); if (b) b.textContent = "📁 مشاريعي" + (MINE && MINE.length ? " (" + MINE.length + ")" : ""); }
  async function saveProject(asNew, quiet) {
    if (!CUR || saving) return null; saving = true; clearTimeout(autoT);
    try {
      const nm = (($("mk-pn") || {}).value || "").trim() || (PROJ && PROJ.name) || CUR.m.n, body = pack(), thumb = cvData(renderTo(320, 320, true), 320);
      const list = (await mineList()).slice(), old = !asNew && PROJ ? list.findIndex(x => x.id === PROJ.id) : -1;
      if (old < 0 && list.length >= MAXP) throw new Error("بلغت الحدّ الأقصى (" + MAXP + " مشروعاً) — احذف مشروعاً قديماً");
      const id = old >= 0 ? list[old].id : "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), meta = { id, name: nm, model: CUR.m.id, at: Date.now(), thumb };
      if (old >= 0) list.splice(old, 1); list.unshift(meta);
      await store.set("mkp_" + id, body); await store.set("mockups", list); MINE = list; PROJ = { id, name: nm }; dirtyP = false; mineBtn(); const pn = $("mk-pn"); if (pn) pn.value = nm; const st = $("mk-ps2"); if (st) st.textContent = "✔ محفوظ";
      msg(quiet ? "✔ حُفظ تلقائياً" : "✅ حُفظ المشروع «" + nm + "» في حسابك"); return id;
    } catch (e) { msg("⚠️ تعذّر الحفظ: " + e.message, true); return null; } finally { saving = false; }
  }
  function markDirty() { if (!CUR || VIEW !== "editor") return; dirtyP = true; const st = $("mk-ps2"); if (st) st.textContent = PROJ ? "● تعديلات غير محفوظة" : ""; if (PROJ) { clearTimeout(autoT); autoT = setTimeout(() => { if (dirtyP && opened && CUR) saveProject(false, true); }, 3000); } }
  function flushSave() { if (PROJ && dirtyP && CUR && R) return saveProject(false, true); }
  async function openProject(id) {
    try {
      const meta = (await mineList()).find(x => x.id === id), body = await store.get("mkp_" + id, null), m = meta && MODELS.find(x => x.id === meta.model);
      if (!meta || !body || !body.a || !m) throw new Error("تعذّر قراءة المشروع");
      const st = newState(m); st.color = body.color || st.color; st.color2 = body.color2 || st.color2; st.finish = body.finish || st.finish; st.open = body.open != null ? body.open : st.open; if (body.roles && st.roles) Object.keys(body.roles).forEach(k => { if (st.roles[k]) Object.assign(st.roles[k], body.roles[k]); }); if (body.P && st.P) Object.assign(st.P, body.P);
      for (const ad of m.areas) { const x = body.a[ad.id], t = st.a[ad.id]; if (!x) continue; Object.assign(t, { src: x.src, fit: x.fit || t.fit, sc: x.sc != null ? x.sc : t.sc, x: x.x || 0, y: x.y || 0, rot: x.rot || 0 }); t.q = Object.assign({}, t.q, x.q || {}); if (x.img) { try { const im = await loadImg(x.img), c = canv(im.width, im.height); c.getContext("2d").drawImage(im, 0, 0); t.img = c; } catch (e) { t.img = null; if (t.src === "img") t.src = "none"; } } }
      if (body.cfg) { CFG.bg = body.cfg.bg || CFG.bg; CFG.bg1 = body.cfg.bg1 || CFG.bg1; CFG.bg2 = body.cfg.bg2 || CFG.bg2; }
      STATES[m.id] = st; st._p = true; PROJ = { id, name: meta.name }; openEditor(m.id, { view: body.view, area: body.area }); dirtyP = false; const pn = $("mk-pn"); if (pn) pn.value = meta.name; const ps = $("mk-ps2"); if (ps) ps.textContent = "✔ محفوظ"; msg("✅ فُتح المشروع «" + meta.name + "»");
    } catch (e) { msg("⚠️ " + e.message, true); }
  }
  async function delProject(id) { const list = (await mineList()).filter(x => x.id !== id); try { await store.set("mkp_" + id, { del: 1 }); await store.set("mockups", list); MINE = list; if (PROJ && PROJ.id === id) PROJ = null; mineBtn(); } catch (e) { msg("⚠️ " + e.message, true); } }
  async function renderMine() {
    const body = $("mk-body"); if (!body) return; VIEW = "mine"; thumbToken++; detachStage(); $("mk-cats").style.display = "none"; body.innerHTML = '<p class="m" style="padding:2rem;text-align:center">جارٍ التحميل…</p>';
    const list = await mineList(true); if (!opened || VIEW !== "mine") return; mineBtn();
    if (!list.length) { body.innerHTML = '<p class="m" style="padding:3rem 1rem;text-align:center">لا مشاريع محفوظة بعد.<br>افتح أي نموذج، صمّمه، ثم اضغط «💾 حفظ المشروع» ليبقى في حسابك ويظهر هنا من أي جهاز.</p><div class="mk-b" style="justify-content:center"><button type="button" data-act="gal">↩ المعرض</button></div>'; body.querySelector("[data-act=gal]").onclick = () => renderGallery(); return; }
    body.innerHTML = '<div class="mk-b" style="padding:.8rem 1rem 0;margin:0"><button type="button" class="o" data-act="gal">↩ المعرض</button></div><div class="mk-grid">' + list.map(x => { const m = MODELS.find(k => k.id === x.model); return '<div class="mk-card" data-p="' + esc(x.id) + '"><div class="mk-th">' + (x.thumb ? '<img alt="" src="' + x.thumb + '">' : "") + '</div><div class="mk-ct">' + esc(x.name) + '</div><div class="m" style="padding:0 .8rem;color:#6b7280">' + esc(m ? m.n : x.model) + " • " + new Date(x.at).toLocaleDateString("ar-DZ") + '</div><div class="mk-b" style="padding:.4rem .8rem .8rem;margin:0"><button type="button" data-pa="open">فتح</button><button type="button" class="o" data-pa="dup">نسخ</button><button type="button" class="o" data-pa="del" style="background:linear-gradient(180deg,rgba(255,90,90,.35),rgba(255,90,90,.1));border-color:rgba(255,120,120,.6)">حذف</button></div></div>'; }).join("") + "</div>";
    body.querySelector("[data-act=gal]").onclick = () => renderGallery();
    body.querySelectorAll(".mk-card").forEach(card => { const id = card.dataset.p; card.onclick = async e => { const a = e.target.closest("[data-pa]"); if (!a) return openProject(id); e.stopPropagation(); if (a.dataset.pa === "open") openProject(id); else if (a.dataset.pa === "del") { if (confirm("حذف هذا المشروع نهائياً؟")) { await delProject(id); renderMine(); } } else if (a.dataset.pa === "dup") { const meta = (await mineList()).find(x => x.id === id), b = await store.get("mkp_" + id, null); if (!meta || !b) return; if ((await mineList()).length >= MAXP) return msg("⚠️ بلغت الحدّ الأقصى للمشاريع", true); const nid = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); await store.set("mkp_" + nid, b); const l = (await mineList()).slice(); l.unshift(Object.assign({}, meta, { id: nid, name: meta.name + " (نسخة)", at: Date.now() })); await store.set("mockups", l); MINE = l; renderMine(); } }; });
  }
  /* ═══ المحرّر ═══ */
  function detachStage() { if (R && R.domElement.parentNode) R.domElement.parentNode.removeChild(R.domElement); stage = null; }
  function openEditor(id, o) {
    const m = MODELS.find(x => x.id === id); if (!m) return; o = o || {}; thumbToken++; VIEW = "editor"; $("mk-cats").style.display = "none";
    const st = STATES[id] || (STATES[id] = newState(m)); if (PICK[id] && !STATES[id]._p) { st.color = PICK[id]; STATES[id]._p = true; }
    $("mk-body").innerHTML = '<div class="mk-ed"><div class="mk-st" id="mk-st"><span class="mk-3d2">3D</span><span class="mk-hint">اسحب للتدوير • العجلة للتقريب • نقرتان لإعادة الضبط</span></div><div class="mk-side" id="mk-side"></div></div>';
    stage = $("mk-st"); stage.style.background = bgCss(); R.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab"; stage.insertBefore(R.domElement, stage.firstChild); bindStage(stage);
    try { loadModel(m, st); SEL.area = (o.area && m.areas.some(a => a.id === o.area)) ? o.area : m.areas[0].id; if (o.view) { view.yaw = o.view.yaw; view.pitch = o.view.pitch; view.zoom = o.view.zoom || 1; } resize(); ui(); msg("جاهز — غيّر اللون والتصميم وصدّر الصورة"); } catch (e) { msg("⚠️ " + e.message, true); }
  }
  const deg = v => Math.round(v * 180 / Math.PI);
  function areaPanel() {
    const m = CUR.m, ad = m.areas.find(a => a.id === SEL.area) || m.areas[0], st = CUR.s.a[ad.id], q = st.q;
    let h = (m.areas.length > 1 ? '<div class="tabs">' + m.areas.map(a => '<button type="button" class="' + (a.id === ad.id ? "on" : "o") + '" data-area="' + a.id + '">' + esc(a.n) + "</button>").join("") + "</div>" : '<p class="m">' + esc(ad.n) + "</p>");
    h += '<div class="tabs" style="margin-top:.5rem"><button type="button" class="' + (st.src === "quick" ? "on" : "o") + '" data-src="quick">تصميم سريع</button><button type="button" class="' + (st.src === "img" ? "on" : "o") + '" data-src="img">صورتي / شعاري</button><button type="button" class="' + (st.src === "none" ? "on" : "o") + '" data-src="none">بدون</button></div>';
    if (st.src === "quick") {
      h += '<label class="f">الاسم / العنوان</label><input data-q="name" value="' + esc(q.name) + '"><label class="f">وصف قصير</label><input data-q="sub" value="' + esc(q.sub) + '">' + (ad.decal ? "" : '<label class="f">الحجم / ملاحظة</label><input data-q="vol" value="' + esc(q.vol) + '">');
      if (!ad.decal) h += sel("", "النمط", STYLES, q.style, 'data-q="style"') + sel("", "توزيع النص", LAYOUTS, q.layout || "", 'data-q="layout"');
      h += '<div class="r3"><div><label class="f">لون العلامة</label><input data-q="c1" type="color" value="' + esc(/^#/.test(q.c1) ? q.c1 : "#2f8f4e") + '"></div>' + (ad.decal ? "" : '<div><label class="f">الخلفية</label><input data-q="c2" type="color" value="' + esc(/^#/.test(q.c2) ? q.c2 : "#ffffff") + '"></div>') + '<div><label class="f">لون النص</label><input data-q="ink" type="color" value="' + esc(/^#/.test(q.ink) ? q.ink : "#17191c") + '"></div></div>';
      h += '<div class="r2"><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-qc="logo"' + (q.logo !== false ? " checked" : "") + '> شعار</label><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-qc="inkauto"' + (q.ink === "auto" ? " checked" : "") + '> لون نص تلقائي</label></div>';
      if (!ad.decal) h += '<label style="display:flex;gap:.4rem;align-items:center;margin-top:.3rem"><input type="checkbox" data-qc="bgauto"' + (q.c2 === "auto" ? " checked" : "") + '> الخلفية بلون المنتج</label>';
      if (ad.decal) h += rng('data-x="sc"', "الحجم", 0.15, 1.6, 0.01, st.sc) + rng('data-x="x"', "أفقي", -1, 1, 0.01, st.x) + rng('data-x="y"', "رأسي", -1, 1, 0.01, st.y) + rng('data-x="rot"', "دوران (°)", -180, 180, 1, st.rot);
    } else if (st.src === "img") {
      h += '<label class="f">صورة التصميم (PNG شفاف يُفضَّل)</label><label class="mk-up" for="mk-img">' + (st.img ? "✔ تم رفع الصورة — استبدلها" : "⬆ ارفع صورتك أو شعارك") + '<input id="mk-img" type="file" accept="image/*" hidden></label>';
      if (typeof Admin !== "undefined" && Admin.products && Admin.products.some(p => p.cover)) h += '<div class="mk-b"><button type="button" class="o" data-act="prod">من صور منتجاتك</button></div><div id="mk-prod"></div>';
      if (st.img) { if (!ad.decal) h += sel("", "الملاءمة", [["cover", "تملأ المنطقة"], ["contain", "كاملة بلا قصّ"]], st.fit, 'data-x="fit"'); h += rng('data-x="sc"', "الحجم", 0.15, 2.5, 0.01, st.sc) + rng('data-x="x"', "أفقي", -1, 1, 0.01, st.x) + rng('data-x="y"', "رأسي", -1, 1, 0.01, st.y) + rng('data-x="rot"', "دوران (°)", -180, 180, 1, st.rot); }
    }
    if (m.areas.length > 1) h += '<div class="mk-b"><button type="button" class="o" data-act="copyall">نسخ هذا التصميم إلى كل المناطق</button></div>';
    return h;
  }

  /* موادّ حسب الدور + أبعاد (للنماذج الواقعية الموسَّعة) */
  function roleUi(m, s) {
    const main = m.main || "body", ml = m.matList || [], names = { body: "الجسم", cap: "الغطاء", liquid: "المحتوى", accent: "التفاصيل", inside: "الداخل", pump: "المضخّة" };
    let h = '<h4>المواد والألوان</h4><p class="m">لون ' + esc(m.roles[main].n || names[main] || main) + ":</p>" + swatches(m.colors, s.color, "data-c") + '<div class="mk-roles">';
    Object.keys(m.roles).forEach(k => { const d = m.roles[k], r = s.roles[k], col = k === main ? s.color : r.c; h += '<div class="mk-role"><b>' + esc(d.n || names[k] || k) + '</b><select data-rp="' + k + '">' + ml.map(o => '<option value="' + o[0] + '"' + (o[0] === r.p ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + '</select><input type="color" data-rc="' + k + '" value="' + (/^#[0-9a-f]{6}$/i.test(col) ? col : "#ffffff") + '">' + (k === "liquid" ? '<label class="mk-ron"><input type="checkbox" data-ron="liquid"' + (r.on !== false ? " checked" : "") + "> إظهار</label>" : "") + "</div>"; });
    h += "</div>";
    if ((m.params || []).length) h += "<h4>الأبعاد (سم)</h4>" + m.params.map(p => rng('data-pa="' + p.k + '"', esc(p.l) + " — <span class=\"mk-pv\" data-pv=\"" + p.k + "\">" + (+s.P[p.k]).toFixed(1) + "</span>", p.min, p.max, p.step, s.P[p.k])).join("");
    return h;
  }
  function ui() {
    const side = $("mk-side"); if (!side || !CUR) return; const m = CUR.m, s = CUR.s;
    let h = '<div class="mk-b" style="margin:0 0 .5rem"><button type="button" class="o" data-act="back">↩ المعرض</button><button type="button" class="o" data-act="reset">إعادة الضبط</button></div><div class="mk-pj"><label class="f">اسم المشروع</label><input id="mk-pn" maxlength="60" placeholder="' + esc(m.n) + '" value="' + esc(PROJ ? PROJ.name : "") + '"><div class="mk-b"><button type="button" data-act="save">💾 ' + (PROJ ? "حفظ" : "حفظ المشروع") + '</button>' + (PROJ ? '<button type="button" class="o" data-act="savenew">حفظ كنسخة جديدة</button>' : "") + '<span id="mk-ps2" class="m" style="align-self:center">' + (PROJ ? (dirtyP ? "● تعديلات غير محفوظة" : "✔ محفوظ") : "") + '</span></div></div><h4>' + esc(m.n) + "</h4>" + (m.roles ? roleUi(m, s) : "<p class=\"m\">لون النموذج:</p>" + swatches(m.colors, s.color, "data-c"));
    if (m.c2 && !m.roles) h += '<p class="m" style="margin-top:.5rem">' + esc(m.c2.n) + ":</p>" + swatches(m.c2.colors, s.color2, "data-c2");
    if (m.cat !== "apparel" && !m.roles) h += sel("finish", "الطلاء / الخامة", FIN_LIST, s.finish);
    if (m.openLabel) h += rng('data-k="open"', m.openLabel, 0, 1, 0.01, s.open);
    if (!m.noArt) h += "<h4>التصميم والطباعة</h4>" + areaPanel();
    h += '<h4>العرض والخلفية</h4>' + sel("bg", "الخلفية", [["studio", "استوديو فاتح"], ["white", "أبيض"], ["warm", "دافئ"], ["dark", "داكن"], ["color", "لون مخصص"], ["none", "شفافة"]], CFG.bg) + (CFG.bg === "color" ? '<div class="r2"><input data-k="bg1" type="color" value="' + CFG.bg1 + '"><input data-k="bg2" type="color" value="' + CFG.bg2 + '"></div>' : "") +
      rng('data-v="yaw"', "التدوير (°)", 0, 360, 1, ((deg(view.yaw) % 360) + 360) % 360) + rng('data-v="pitch"', "زاوية الكاميرا (°)", -5, 60, 1, deg(view.pitch)) + rng('data-v="zoom"', "التقريب", 0.5, 2.5, 0.01, view.zoom) +
      '<div class="r2"><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-k="auto"' + (CFG.auto ? " checked" : "") + '> دوران تلقائي</label><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-k="shadow"' + (CFG.shadow ? " checked" : "") + '> ظلّ</label></div>' +
      '<div class="mk-b"><button type="button" class="o" data-view="front">أمامي</button><button type="button" class="o" data-view="q">¾</button><button type="button" class="o" data-view="side">جانبي</button><button type="button" class="o" data-view="back">خلفي</button><button type="button" class="o" data-view="top">من فوق</button></div>';
    h += "<h4>التصدير</h4>" + sel("size", "المقاس", SIZES.map((x, i) => [i, x[0]]), CFG.size) + '<div class="r2"><div>' + sel("fmt", "الصيغة", [["png", "PNG"], ["webp", "WebP"]], CFG.fmt) + '</div><div><label class="f">جودة WebP</label><input data-k="q" type="number" min="40" max="100" value="' + CFG.q + '"></div></div><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-k="transparent"' + (CFG.transparent ? " checked" : "") + '> خلفية شفافة في الصورة المصدَّرة</label>' +
      '<div class="mk-b"><button type="button" data-ex="one">⬇ تصدير الصورة</button><button type="button" class="o" data-ex="angles">4 زوايا (ZIP)</button><button type="button" class="o" data-ex="r12">360° — 12 إطاراً</button><button type="button" class="o" data-ex="r24">360° — 24 إطاراً</button><button type="button" data-ex="studio" style="flex:1 1 100%">🎨 إرسال الزوايا إلى ستوديو ديزاين</button></div><p class="m">النماذج تقريبية الشكل (ليست مسحاً لمنتجك الحقيقي): تصلح لعرض الهوية والتصميم قبل الطباعة والتصنيع.</p>';
    side.innerHTML = h; if (!side._mkd) { side._mkd = 1; ["input", "change", "click"].forEach(ev => side.addEventListener(ev, e => { if (e.target.id === "mk-pn") { if (PROJ) markDirty(); return; } if (e.target.closest("[data-ex],[data-act=save],[data-act=savenew],[data-act=back],[data-view]")) return; markDirty(); })); } wire();
  }
  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const rebuildSoon = debounce(() => { rebuild(); }, 90), areaSoon = debounce(aid => refreshArea(aid), 70);
  function setColor(k, v) { CUR.s[k] = v; rebuildSoon(); }
  function wire() {
    const side = $("mk-side"), m = CUR.m, s = CUR.s, aid = SEL.area, st = s.a[aid], ad = m.areas.find(a => a.id === aid);
    side.querySelectorAll("[data-c]").forEach(e => e.onclick = () => { setColor("color", e.dataset.c); ui(); }); const cp = side.querySelector("[data-c-pick]"); if (cp) cp.oninput = () => setColor("color", cp.value);
    side.querySelectorAll("[data-c2]").forEach(e => e.onclick = () => { setColor("color2", e.dataset.c2); ui(); }); const cp2 = side.querySelector("[data-c2-pick]"); if (cp2) cp2.oninput = () => setColor("color2", cp2.value);
    side.querySelectorAll("[data-k]").forEach(e => { const h = () => { const k = e.dataset.k; if (k === "finish") { s.finish = e.value; rebuild(); } else if (k === "open") { setPose(+e.value); } else { const v = e.type === "checkbox" ? e.checked : (e.type === "range" || e.type === "number" || k === "size") ? +e.value : e.value; CFG[k] = v; cfgSave(); if (k === "bg" || k === "bg1" || k === "bg2") { stage.style.background = bgCss(); if (k === "bg") { if (CUR.m.roles) rebuild(); ui(); } else applyBg(); } else if (k === "shadow") { layout(); dirty = true; } else if (k === "auto") { dirty = true; } } }; e.oninput = h; e.onchange = h; });
    side.querySelectorAll("[data-v]").forEach(e => e.oninput = () => { const k = e.dataset.v; view[k] = k === "zoom" ? +e.value : (+e.value) * Math.PI / 180; camPlace(R.domElement.clientWidth, R.domElement.clientHeight); dirty = true; });
    side.querySelectorAll("[data-rp]").forEach(e => e.onchange = () => { s.roles[e.dataset.rp].p = e.value; rebuildSoon(); });
    side.querySelectorAll("[data-rc]").forEach(e => e.oninput = () => { const k = e.dataset.rc; if (k === (m.main || "body")) { s.color = e.value; const sw = side.querySelectorAll("[data-c]"); sw.forEach(i => i.classList.remove("on")); } else s.roles[k].c = e.value; rebuildSoon(); });
    side.querySelectorAll("[data-ron]").forEach(e => e.onchange = () => { s.roles[e.dataset.ron].on = e.checked; rebuildSoon(); });
    side.querySelectorAll("[data-pa]").forEach(e => e.oninput = () => { s.P[e.dataset.pa] = +e.value; const v = side.querySelector('[data-pv="' + e.dataset.pa + '"]'); if (v) v.textContent = (+e.value).toFixed(1); rebuildSoon(); });
    side.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { const P = { front: [0, 0.08], q: [-0.6, 0.18], side: [-Math.PI / 2, 0.08], back: [Math.PI, 0.08], top: [-0.3, 1.0] }[b.dataset.view]; view.yaw = P[0]; view.pitch = P[1]; camPlace(R.domElement.clientWidth, R.domElement.clientHeight); dirty = true; ui(); });
    side.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { const v = b.dataset.ex; if (v === "studio") sendToStudio(); else if (v === "one") exportOne(); else if (v === "angles") exportAngles(); else export360(v === "r12" ? 12 : 24); });
    side.querySelectorAll("[data-area]").forEach(b => b.onclick = () => { SEL.area = b.dataset.area; ui(); });
    side.querySelectorAll("[data-src]").forEach(b => b.onclick = () => { st.src = b.dataset.src; refreshArea(aid); if (m.roles) rebuildSoon(); ui(); });
    side.querySelectorAll("[data-q]").forEach(e => { e.oninput = e.onchange = () => { st.q[e.dataset.q] = e.value; if (e.dataset.q === "ink") { const c = side.querySelector('[data-qc="inkauto"]'); if (c) c.checked = false; } if (e.dataset.q === "c2") { const c = side.querySelector('[data-qc="bgauto"]'); if (c) c.checked = false; } areaSoon(aid); }; });
    side.querySelectorAll("[data-qc]").forEach(e => e.onchange = () => { const k = e.dataset.qc; if (k === "logo") st.q.logo = e.checked; else if (k === "inkauto") st.q.ink = e.checked ? "auto" : "#17191c"; else if (k === "bgauto") st.q.c2 = e.checked ? "auto" : "#ffffff"; refreshArea(aid); ui(); });
    side.querySelectorAll("[data-x]").forEach(e => e.oninput = () => { const k = e.dataset.x; st[k] = k === "fit" ? e.value : +e.value; areaSoon(aid); });
    const fi = $("mk-img"); if (fi) fi.onchange = async () => { if (!fi.files[0]) return; try { await setAreaImage(aid, fi.files[0]); ui(); msg("✅ طُبّقت الصورة"); } catch (e) { msg("⚠️ " + e.message, true); } };
    side.querySelectorAll("[data-act]").forEach(b => b.onclick = () => { const a = b.dataset.act; if (a === "back") renderGallery(); else if (a === "save") saveProject(false); else if (a === "savenew") saveProject(true); else if (a === "reset") { STATES[m.id] = newState(m); loadModel(m, STATES[m.id]); SEL.area = m.areas[0].id; ui(); markDirty(); } else if (a === "prod") prodList(); else if (a === "copyall") copyAll(); });
  }
  function copyAll() { const m = CUR.m, src = CUR.s.a[SEL.area]; m.areas.forEach(a => { if (a.id === SEL.area) return; const d = CUR.s.a[a.id]; d.src = src.src; d.img = src.img; d.q = Object.assign({}, src.q); d.fit = src.fit; if (src.src === "img") { d.sc = src.sc; d.x = src.x; d.y = src.y; d.rot = src.rot; } refreshArea(a.id); }); msg("✅ نُسخ التصميم إلى كل المناطق"); }
  function prodList() {
    const box = $("mk-prod"), ps = (typeof Admin !== "undefined" && Admin.products) || []; box.innerHTML = '<select id="mk-ps"><option value="">— اختر منتجاً —</option>' + ps.filter(p => p.cover).map(p => '<option value="' + esc(p.cover) + '">' + esc(p.title || p.slug) + "</option>").join("") + "</select>";
    $("mk-ps").onchange = async e => { if (!e.target.value) return; try { await setAreaImage(SEL.area, new URL(e.target.value, document.baseURI).href); ui(); msg("✅ طُبّقت صورة المنتج"); } catch (er) { msg("⚠️ " + er.message, true); } };
  }
  /* السحب للتدوير، العجلة للتقريب، النقر المزدوج لإعادة الضبط */
  function bindStage(el) {
    let down = null; const cv = R.domElement; if (cv._mkb) return; cv._mkb = true;
    cv.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", e => { if (!down) return; view.yaw = down.yaw + (e.clientX - down.x) * 0.011; view.pitch = clamp(down.pitch + (e.clientY - down.y) * 0.006, -0.08, 1.2); camPlace(cv.clientWidth, cv.clientHeight); dirty = true; });
    const up = () => { if (down) { down = null; cv.style.cursor = "grab"; syncView(); } }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", e => { e.preventDefault(); view.zoom = clamp(view.zoom * (e.deltaY < 0 ? 1.07 : 0.93), 0.5, 2.5); camPlace(cv.clientWidth, cv.clientHeight); dirty = true; syncView(); }, { passive: false });
    cv.addEventListener("dblclick", () => { const v = CUR.m.view || {}; view.yaw = v.yaw != null ? v.yaw : -0.55; view.pitch = v.pitch != null ? v.pitch : 0.16; view.zoom = 1; camPlace(cv.clientWidth, cv.clientHeight); dirty = true; syncView(); });
    new ResizeObserver(() => { if (stage) resize(); }).observe(el);
  }
  function syncView() { const side = $("mk-side"); if (!side) return; [["yaw", ((deg(view.yaw) % 360) + 360) % 360], ["pitch", deg(view.pitch)], ["zoom", view.zoom]].forEach(([k, v]) => { const e = side.querySelector('[data-v="' + k + '"]'); if (e) e.value = v; }); }
  function close() {
    flushSave(); opened = false; thumbToken++; if (escH) { document.removeEventListener("keydown", escH); escH = null; } cancelAnimationFrame(raf); raf = 0; unload(); if (R) { try { R.dispose(); R.forceContextLoss(); } catch (e) { } R = null; } scene = null; CUR = null; stage = null; const b = $("mk-bg"); if (b) b.remove(); VIEW = "gallery"; PROJ = null; dirtyP = false; clearTimeout(autoT);
  }
  async function open(opts) {
    close(); opts = opts || {}; const bg = document.createElement("div"); bg.id = "mk-bg"; if (!$("mk-css")) { const st = document.createElement("style"); st.id = "mk-css"; st.textContent = CSS; document.head.appendChild(st); }
    bg.innerHTML = '<div id="mk" role="dialog" aria-label="Alyssum Mockup Studio"><div class="mk-h"><b>🧢 استوديو الموكاب 3D</b><small>نماذج واقعية: علب، قوارير، أكياس، ملابس — ركّب شعارك وصدّر صوراً احترافية</small><input id="mk-q" type="search" placeholder="ابحث عن نموذج…"><button type="button" class="o" id="mk-mine">📁 مشاريعي</button><button type="button" class="o" id="mk-x">إغلاق</button></div><div class="mk-cats" id="mk-cats"></div><div class="mk-body" id="mk-body"></div><div class="mk-f" id="mk-msg">جارٍ تحميل المحرّك ثلاثي الأبعاد…</div></div>';
    document.body.appendChild(bg); opened = true; $("mk-x").onclick = close; $("mk-mine").onclick = () => { flushSave(); renderMine(); }; mineList().then(mineBtn).catch(() => { }); bg.addEventListener("mousedown", e => { if (e.target === bg) close(); }); $("mk-q").oninput = debounce(e => { QTXT = $("mk-q").value.trim(); if (VIEW === "gallery") renderGallery(); }, 150);
    escH = e => { if (e.key === "Escape") { if (VIEW === "editor" || VIEW === "mine") renderGallery(); else close(); } }; document.addEventListener("keydown", escH);
    try { const hasGL = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })(); if (!hasGL) throw new Error("متصفحك أو جهازك لا يدعم WebGL المطلوب للعرض ثلاثي الأبعاد"); await initRenderer(); if (!opened) return; if (!raf) loop(); if (opts.model) openEditor(opts.model); else renderGallery(); } catch (e) { msg("⚠️ " + e.message, true); }
  }

  /* ═══ المشهد والعرض ═══ */
  let built = null, holder = null, fitInfo = { r: 1.5, h: 2, cx: 0, cz: 0 }, QUAL = "hi";
  async function initRenderer() {
    await loadThree();
    R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.NoToneMapping; R.setClearColor(0x000000, 0); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); cam = new T.PerspectiveCamera(24, 1, 0.1, 400); turn = new T.Group(); scene.add(turn);
    envTex = makeEnv(); scene.environment = envTex; scene.add(new T.HemisphereLight(0xffffff, 0xa3acba, 0.32));
    keyL = new T.DirectionalLight(0xffffff, 0.85); keyL.castShadow = true; keyL.shadow.mapSize.set(2048, 2048); keyL.shadow.bias = -0.0005; keyL.shadow.normalBias = 0.02; scene.add(keyL, keyL.target);
    ground = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    blob = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.8 })); blob.rotation.x = -Math.PI / 2; scene.add(blob);
  }
  function disposeObj(o) {
    const keep = new Set(Object.values(TEXS));
    o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { ["map", "normalMap", "roughnessMap"].forEach(k => { if (m[k] && !keep.has(m[k])) m[k].dispose(); }); m.dispose(); }); });
  }
  function unload() { if (holder) { turn.remove(holder); disposeObj(holder); } holder = null; built = null; Object.keys(TEXS).forEach(k => { if (k.startsWith("a_")) { TEXS[k].dispose(); delete TEXS[k]; } }); AM = {}; }
  const box3 = () => { holder.updateMatrixWorld(true); return new T.Box3().setFromObject(holder); };
  function placeModel() {
    holder.position.set(0, 0, 0); turn.rotation.y = 0; if (built.pose) built.pose(0); const b0 = box3(), c = new T.Vector3(); b0.getCenter(c);
    if (built.pose) built.pose(CUR.s.open); const b = box3(); holder.position.set(-c.x, -b.min.y, -c.z);
    const b2 = box3(); let r = 0; [b2.min.x, b2.max.x].forEach(x => [b2.min.z, b2.max.z].forEach(z => { r = Math.max(r, Math.hypot(x, z)); })); fitInfo = { r: Math.max(0.3, r), h: Math.max(0.3, b2.max.y), cx: 0, cz: 0 };
  }
  function loadModel(m, st, opts) {
    opts = opts || {}; if (!R) throw new Error("المحرّك غير جاهز"); unload(); CUR = { m, s: st || newState(m), q: opts.q || QUAL, ar: {}, glass: false }; AM = {};
    built = m.build(); holder = group(); holder.add(built.g); turn.add(holder); holder.traverse(o => { if (o.isMesh) { if (o.castShadow == null) o.castShadow = true; o.receiveShadow = true; } });
    m.areas.forEach(a => refreshArea(a.id)); placeModel(); view.yaw = opts.yaw != null ? opts.yaw : (m.view ? m.view.yaw : -0.55); view.pitch = opts.pitch != null ? opts.pitch : (m.view ? m.view.pitch : 0.16); view.zoom = opts.zoom || 1; layout(); applyBg(); dirty = true; return CUR;
  }
  /* خلفية المشهد كنسيج: تلزم ليرى الزجاج المنكسر خلفيةً حقيقية بدل الشفافية */
  const xmitOn = () => !GF && CFG.bg !== "none";
  function bgTex(w, h) { const c = canv(Math.max(64, Math.min(1024, Math.round(w))), Math.max(64, Math.min(1024, Math.round(h)))); bgPaint(c.getContext("2d"), c.width, c.height); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
  function applyBg() {
    if (!scene) return; const want = !!(CUR && CUR.m.roles && xmitOn() && CUR.glass); if (scene.background && scene.background.dispose) scene.background.dispose(); scene.background = want ? bgTex(R.domElement.clientWidth || 600, R.domElement.clientHeight || 500) : null; dirty = true;
  }
  function rebuild() { if (!CUR) return; const m = CUR.m, s = CUR.s, q = CUR.q, y = view.yaw, p = view.pitch, z = view.zoom; loadModel(m, s, { q, yaw: y, pitch: p, zoom: z }); }
  function setPose(p) { if (!CUR || !built) return; CUR.s.open = p; if (built.pose) built.pose(p); dirty = true; }
  function layout() {
    if (!R || !CUR) return; const r = fitInfo.r, h = fitInfo.h;
    keyL.position.set(-r * 2.3, h + r * 2.6, r * 2.2); keyL.target.position.set(0, h * 0.3, 0); const sr = Math.hypot(r, h) * 1.5, sc = keyL.shadow.camera; sc.left = -sr; sc.right = sr; sc.top = sr; sc.bottom = -sr; sc.near = 0.5; sc.far = (h + r * 6) * 2; sc.updateProjectionMatrix();
    const gs = Math.max(r, h) * 8; ground.scale.set(gs, gs, 1); ground.visible = !!CFG.shadow; blob.visible = !!CFG.shadow; const bs = r * 3.1; blob.scale.set(bs, bs, 1); blob.position.set(0, 0.002, 0);
    camPlace(R.domElement.clientWidth || 600, R.domElement.clientHeight || 500);
  }
  function camPlace(w, h) {
    const asp = w / Math.max(1, h), vf = cam.fov * Math.PI / 180, th = Math.tan(vf / 2), fh = fitInfo.h, r = fitInfo.r, need = Math.max((fh / 2 * 1.16) / th, (r * 1.12) / (th * asp)) + r * 0.9;
    const d = need / view.zoom, tgt = new T.Vector3(0, fh * 0.5, 0); cam.aspect = asp; cam.position.set(0, tgt.y + Math.sin(view.pitch) * d, Math.cos(view.pitch) * d); cam.near = Math.max(0.05, d / 30); cam.far = d * 12; cam.lookAt(tgt); cam.updateProjectionMatrix(); turn.rotation.y = view.yaw;
  }
  function resize() { if (!R || !stage) return; const w = stage.clientWidth || 600, h = stage.clientHeight || 500; R.setSize(w, h, false); camPlace(w, h); applyBg(); dirty = true; }
  function loop() { raf = requestAnimationFrame(loop); if (!opened) return; if (CFG.auto && CUR) { view.yaw += 0.007; camPlace(R.domElement.clientWidth, R.domElement.clientHeight); dirty = true; } if (dirty && R && CUR && R.domElement.isConnected) { R.render(scene, cam); dirty = false; } }
  const bgCss = () => CFG.bg === "none" ? "repeating-conic-gradient(#d8d8d8 0 25%,#fff 0 50%) 0 0/20px 20px" : CFG.bg === "white" ? "#ffffff" : CFG.bg === "warm" ? "radial-gradient(circle at 50% 40%,#f6efe3,#e6dccb)" : CFG.bg === "dark" ? "radial-gradient(circle at 50% 38%,#2a303a,#0e1014)" : CFG.bg === "color" ? "radial-gradient(circle at 50% 40%," + CFG.bg1 + "," + CFG.bg2 + ")" : "radial-gradient(circle at 50% 40%,#fbfbfc,#e2e5eb)";
  const bgPaint = (x, w, h) => { if (CFG.bg === "none") return; let a, b; if (CFG.bg === "white") a = b = "#ffffff"; else if (CFG.bg === "warm") { a = "#f6efe3"; b = "#e6dccb"; } else if (CFG.bg === "dark") { a = "#2a303a"; b = "#0e1014"; } else if (CFG.bg === "color") { a = CFG.bg1; b = CFG.bg2; } else { a = "#fbfbfc"; b = "#e2e5eb"; } const g = x.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.hypot(w, h) * 0.62); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); };

  /* ═══ التصدير ═══ */
  function renderTo(w, h, transparent, yawOff) {
    const needFr = transparent && CUR.glass && !GF; if (needFr) { GF = true; rebuild(); }
    try { return renderTo0(w, h, transparent, yawOff); } finally { if (needFr) { GF = false; rebuild(); } }
  }
  async function withFr(tr, fn) { const need = tr && CUR && CUR.glass && !GF; if (need) { GF = true; rebuild(); } try { return await fn(); } finally { if (need) { GF = false; rebuild(); } } }
  function renderTo0(w, h, transparent, yawOff) {
    const cw = R.domElement.clientWidth, ch = R.domElement.clientHeight, pr = R.getPixelRatio(), y0 = view.yaw; w = clamp(Math.round(w), 64, 4096); h = clamp(Math.round(h), 64, 4096);
    R.setPixelRatio(1); R.setSize(w, h, false); if (yawOff) view.yaw += yawOff; camPlace(w, h); const bgx = !transparent && scene.background; if (bgx) { scene.background.dispose(); scene.background = bgTex(w, h); } R.render(scene, cam);
    const out = canv(w, h), x = out.getContext("2d"); if (!transparent && !bgx) bgPaint(x, w, h); x.drawImage(R.domElement, 0, 0, w, h); if (bgx) applyBg();
    view.yaw = y0; R.setPixelRatio(pr); R.setSize(cw || 600, ch || 500, false); camPlace(cw || 600, ch || 500); dirty = true; return out;
  }
  const blobOf = (cv, fmt, q) => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("تعذّر إنشاء الصورة"))), fmt === "webp" ? "image/webp" : "image/png", fmt === "webp" ? q / 100 : undefined));
  const dims = () => { const s = SIZES[clamp(+CFG.size || 0, 0, SIZES.length - 1)]; return [s[1], s[2]]; };
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const stamp = () => (CUR ? CUR.m.id : "mockup") + "-3d";
  const msg = (t, bad) => { const e = $("mk-msg"); if (e) { e.textContent = t || ""; e.style.color = bad ? "#ffb4b4" : "#c6fe17"; } };
  async function exportOne() { try { msg("جارٍ التصدير…"); const [w, h] = dims(), b = await blobOf(renderTo(w, h, CFG.transparent), CFG.fmt, CFG.q); if (CFG.fmt === "webp" && b.type !== "image/webp") throw new Error("متصفحك لا يدعم WebP — اختر PNG"); dl(b, stamp() + "." + CFG.fmt); msg("✅ تم التنزيل"); } catch (e) { msg("⚠️ " + e.message, true); } }
  async function exportSet(frames, names) {
    try { if (typeof AdminImgBatch === "undefined" || !AdminImgBatch.zip) throw new Error("تعذّر إنشاء ملف ZIP"); const [w, h] = dims(), files = []; await withFr(CFG.transparent, async () => { for (let i = 0; i < frames.length; i++) { msg("جارٍ التصدير " + (i + 1) + " / " + frames.length); await new Promise(r => setTimeout(r, 20)); files.push({ name: names(i), blob: await blobOf(renderTo(w, h, CFG.transparent, frames[i]), CFG.fmt, CFG.q) }); } }); dl(await AdminImgBatch.zip(files), stamp() + "-" + frames.length + ".zip"); msg("✅ تم تنزيل ZIP (" + files.length + " صورة)"); } catch (e) { msg("⚠️ " + e.message, true); }
  }
  const exportAngles = () => exportSet([0, Math.PI / 2, Math.PI, -Math.PI / 2], i => stamp() + "-" + ["front", "side-right", "back", "side-left"][i] + "." + CFG.fmt);
  const export360 = n => exportSet(Array.from({ length: n }, (_, i) => i * Math.PI * 2 / n), i => stamp() + "-360-" + String(i + 1).padStart(2, "0") + "." + CFG.fmt);
  async function sendToStudio() {
    try {
      if (typeof ImgGen === "undefined" || !ImgGen.openSized || typeof PBApp === "undefined") throw new Error("ستوديو ديزاين غير متاح هنا"); msg("جارٍ تجهيز الزوايا…"); const names = ["front", "three-quarter", "side", "back"], offs = [-view.yaw, -0.6 - view.yaw, -Math.PI / 2 - view.yaw, Math.PI - view.yaw], blobs = [];
      await withFr(true, async () => { for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 20)); blobs.push(await blobOf(renderTo(1400, 1750, true, offs[i]), "png")); } });
      const nm = stamp(); close(); await ImgGen.openSized({ W: 1080, H: 1350, id: "mk", label: "Mockup Studio", name: nm }); if (!(PBApp.E && PBApp.E.page)) throw new Error("تعذّر فتح ستوديو ديزاين");
      const paths = []; for (let i = 0; i < 4; i++) paths.push(await PBApp.uploadBlob(blobs[i], "mk-" + names[i] + "-" + Date.now().toString(36), { max: 4096, q: 0.92 })); if (paths[0] && PBApp.addPageImage) PBApp.addPageImage(paths[0]); if (typeof toast === "function") toast("🎨 أُضيفت 4 زوايا إلى مكتبة صور الصفحة في ستوديو ديزاين");
    } catch (e) { msg("⚠️ " + e.message, true); if (typeof toast === "function") toast("⚠️ " + e.message); }
  }
  /* صور الصفحة والمنتجات */
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("تعذّر قراءة الصورة")); im.src = src; });
  async function setAreaImage(aid, src) {
    const url = typeof src === "string" ? src : URL.createObjectURL(src); try { const im = await loadImg(url), k = Math.min(1, 2400 / Math.max(im.width, im.height)), c = canv(Math.round(im.width * k), Math.round(im.height * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); const st = CUR.s.a[aid]; st.img = c; st.src = "img"; st.sc = 1; st.x = 0; st.y = 0; st.rot = 0; refreshArea(aid); markDirty(); } finally { if (typeof src !== "string") URL.revokeObjectURL(url); }
  }
  async function shot(id, w, h, o) { o = o || {}; if (!R) await initRenderer(); const m = MODELS.find(x => x.id === id); if (!m) throw new Error("no model " + id); const st = newState(m); if (o.color) st.color = o.color; if (o.color2) st.color2 = o.color2; if (o.finish) st.finish = o.finish; if (o.P && st.P) Object.assign(st.P, o.P); if (o.roles && st.roles) Object.keys(o.roles).forEach(k => Object.assign(st.roles[k], o.roles[k])); if (o.open != null) st.open = o.open; GF = !!o.transparent; try { loadModel(m, st, o); return renderTo(w || 700, h || 700, !!o.transparent, o.yawOff || 0).toDataURL("image/png"); } finally { GF = false; } }
  const X = { get T() { return T; }, get CUR() { return CUR; }, def, areaMat, glassM, kraftNormal, grainBump, fabricNormal, texOnce, canv, shade, mix, clamp, fbm, hash, xmit: xmitOn, QD };
  function extend(fn) { fn(X); }
  return { extend, open, close, MODELS, SIZES, CFG, CATS, _t: { saveProject, openProject, delProject, mineList, renderMine, get PROJ() { return PROJ; }, markDirty, store, openEditor, renderGallery, ui, thumbLoop, THUMBS, STATES, get VIEW() { return VIEW; }, exportOne, blobOf, initRenderer, loadModel, rebuild, renderTo, newState, setPose, shot, refreshArea, composeArea, quickArt, setAreaImage, get CUR() { return CUR; }, get R() { return R; }, view } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MockupStudio;
