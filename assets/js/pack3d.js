/* Alyssum 3D Pack Studio — تركيب الملصق على عبوة ثلاثية الأبعاد وتدويرها وتصدير صور احترافية.
   • أنواع العبوات: قارورة (بخّاخ/مضخّة)، علبة كريم، صندوق، زجاجة. الملصق: ارفع تصميمك أو أنشئ ملصقاً سريعاً.
   • الألوان والخامات (لامع/مطفي/زجاج/معدن)، لون الغطاء والسائل، الخلفية (لون/تدرّج/شفافة)، الميل والتدوير بالسحب.
   • التصدير: PNG أو WebP بمقاسات المتجر والإعلانات، 4 زوايا ZIP، أو 12/24 إطاراً لعرض 360°.
   • العرض بمكتبة three.js (MIT) محلية في assets/js/vendor، تُحمَّل عند فتح الأداة فقط. بلا خادم ولا مفتاح.
   • تُفتح من «ستوديو ديزاين ← Alyssum 3D Pack Studio». الوظائف النقية والبناء متاحة لاختبار الواجهة عبر Pack3D._t */
const Pack3D = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);
  const TYPES = [["bottle", "قارورة"], ["jar", "علبة كريم"], ["box", "صندوق"], ["glass", "زجاجة"], ["photo", "من صورة 2D"]];
  const FIN = [["gloss", "بلاستيك لامع"], ["matte", "مطفي"], ["glass", "زجاج شفاف"], ["metal", "معدن"]];
  const CAPFIN = [["gloss", "لامع"], ["matte", "مطفي"], ["metal", "معدن"]];
  const SIZES = [["1080×1080 — منشور مربع", 1080, 1080], ["1080×1350 — منشور 4:5", 1080, 1350], ["1080×1920 — ستوري/ريلز", 1080, 1920], ["1600×900 — بانر عريض", 1600, 900], ["2000×2000 — صورة المتجر عالية", 2000, 2000], ["1200×628 — إعلان رابط", 1200, 628]];
  const K = "alyssum_p3_cfg";
  const DEF = { type: "bottle", body: "#f3f5f1", cap: "#ffffff", bodyFin: "gloss", capFin: "gloss", liquid: "#d89b2b", fill: 0.78, bgMode: "linear", bg1: "#e8eeff", bg2: "#c9d6f6", yaw: -0.55, pitch: 0.1, tilt: 0, zoom: 1, auto: false, shadow: true, wrap: "fit", lsize: 1, lpos: 0, lrot: 0, both: true, size: 0, fmt: "png", q: 92, transparent: false, fold: 1, boxFin: "gloss", useQuick: true, ql: { name: "ALYSSUM", sub: "Natural care", vol: "50 ml", c1: "#2f8f4e", c2: "#f3f9f1", ink: "#173f35" } };
  const S = JSON.parse(JSON.stringify(DEF)); try { const o = JSON.parse(localStorage.getItem(K) || "{}"); Object.assign(S, o); S.ql = Object.assign({}, DEF.ql, o.ql || {}); } catch (e) { }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { } };
  let escH = null, photo = null, BOX = null, foldNodes = null, T = null, R = null, scene = null, cam = null, root = null, packG = null, shadowM = null, envTex = null, raf = 0, dirty = true, opened = false, stage = null, art = null, orig = null, sizeInfo = { r: 3, c: null };
  const mats = {};
  async function loadThree() { if (T) return T; const url = new URL("assets/js/vendor/three.module.min.js", document.baseURI).href; T = await import(url); return T; }
  const hex = c => new T.Color(c);

  /* ═══ الخامات ═══ */
  function finMat(fin, color, o) {
    o = o || {}; const c = hex(color);
    if (fin === "matte") return new T.MeshPhysicalMaterial({ color: c, roughness: 0.72, metalness: 0, envMapIntensity: 0.55 });
    if (fin === "metal") return new T.MeshPhysicalMaterial({ color: c, roughness: 0.26, metalness: 1, envMapIntensity: 1.25 });
    if (fin === "glass") return new T.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.36, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.7, specularIntensity: 1, side: T.DoubleSide, depthWrite: false });
    return new T.MeshPhysicalMaterial({ color: c, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1 });
  }
  /* ═══ البيئة (إضاءة استوديو معكوسة على السطوح اللامعة) ═══ */
  function makeEnv() {
    const e = new T.Scene(); e.background = new T.Color(0.06, 0.065, 0.075);
    const panel = (w, h, x, y, z, rx, ry, i, col) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col[0] * i, col[1] * i, col[2] * i), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); e.add(m); };
    panel(14, 6, 0, 9, 0, Math.PI / 2, 0, 5.5, [1, 1, 1]);
    panel(3, 12, -9, 2, 3, 0, Math.PI / 2.4, 6, [1, 0.98, 0.95]);
    panel(2.2, 12, 9, 1, 1, 0, -Math.PI / 2.2, 4, [0.95, 0.97, 1]);
    panel(12, 3, 0, 2, -9, 0, 0, 2.5, [1, 1, 1]);
    panel(18, 18, 0, -7, 0, Math.PI / 2, 0, 0.9, [0.85, 0.85, 0.85]);
    const pm = new T.PMREMGenerator(R); const t = pm.fromScene(e, 0.035).texture; pm.dispose(); return t;
  }
  function blobTex() { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 6, 128, 128, 126); g.addColorStop(0, "rgba(0,0,0,.62)"); g.addColorStop(0.55, "rgba(0,0,0,.22)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }

  /* ═══ الهندسة ═══ */
  const bez = (p0, p1, p2, n) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; o.push(new T.Vector2(a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1])); } return o; };
  const V = (x, y) => new T.Vector2(x, y);
  const lathe = pts => new T.LatheGeometry(pts, 120);
  /* مواصفات كل عبوة: القطاع الأسطواني المستقيم للملصق {r,y0,y1} والأبعاد */
  function spec(type) {
    if (type === "jar") { const R_ = 1.7; return { r: R_, y0: 0.22, y1: 1.46, body: [V(0, 0), V(R_ - 0.16, 0), ...bez([R_ - 0.16, 0], [R_, 0], [R_, 0.16], 6), V(R_, 1.5), ...bez([R_, 1.5], [R_, 1.64], [R_ - 0.1, 1.66], 5), V(R_ - 0.1, 1.72), V(0, 1.72)], cap: [V(0, 1.6), V(R_ + 0.05, 1.6), V(R_ + 0.05, 2.18), ...bez([R_ + 0.05, 2.18], [R_ + 0.05, 2.32], [R_ - 0.12, 2.32], 6), V(0, 2.32)], h: 2.32, liquidTop: 1.45 }; }
    if (type === "glass") { const R_ = 0.95; return { r: R_, y0: 0.3, y1: 2.72, body: [V(0, 0), V(R_ - 0.14, 0), ...bez([R_ - 0.14, 0], [R_, 0], [R_, 0.14], 6), V(R_, 2.9), ...bez([R_, 2.9], [R_, 3.75], [0.28, 3.85], 14), V(0.28, 4.95), V(0.34, 4.95), V(0.34, 5.05), V(0.3, 5.05), V(0, 5.05)], cap: [V(0, 4.9), V(0.37, 4.9), V(0.37, 5.55), ...bez([0.37, 5.55], [0.37, 5.7], [0.25, 5.7], 5), V(0, 5.7)], h: 5.7, liquidTop: 3.6 }; }
    if (type === "box") return { box: true, W: 2.4, H: 3.9, D: 1.35, h: 3.9 };
    const R_ = 1; return { r: R_, y0: 0.25, y1: 3.3, body: [V(0, 0), V(R_ - 0.14, 0), ...bez([R_ - 0.14, 0], [R_, 0], [R_, 0.14], 6), V(R_, 3.4), ...bez([R_, 3.4], [R_, 4.05], [0.36, 4.12], 12), V(0.36, 4.45), V(0, 4.45)], cap: [V(0, 4.38), V(0.5, 4.38), V(0.5, 4.52), V(0.43, 4.52), V(0.43, 5.2), ...bez([0.43, 5.2], [0.43, 5.36], [0.3, 5.36], 5), V(0, 5.36)], h: 5.36, liquidTop: 3.9 };
  }
  function clipProfile(pts, yMax, k) { const o = []; let prev = null; for (const p of pts) { if (p.y > yMax) { if (prev && p.y > prev.y) { const t = (yMax - prev.y) / (p.y - prev.y); o.push(V((prev.x + (p.x - prev.x) * t) * k, yMax)); } break; } o.push(V(p.x * k, p.y)); prev = p; } if (o.length) { const l = o[o.length - 1]; o.push(V(0, l.y)); } return o; }
  function artTexture(canvas) { const t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; t.anisotropy = R ? R.capabilities.getMaxAnisotropy() : 4; t.needsUpdate = true; return t; }
  const aspectOf = type => type === "jar" ? 3.2 : type === "box" ? 0.62 : type === "glass" ? 0.78 : 0.72;
  /* ملصق سريع: اسم + شعار ورقي + نمط هندسي (يُرسم على Canvas) */
  function quickLabel(aspect) {
    const q = S.ql, W = 1024, H = Math.max(160, Math.round(W / aspect)), cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
    x.fillStyle = q.c2; x.fillRect(0, 0, W, H);
    const wide = aspect > 1.6, pad = W * 0.07;
    const rtl = s => /[؀-ۿ]/.test(s); const font = (w, px) => w + " " + px + "px Cairo,'Segoe UI',Tahoma,Arial,sans-serif";
    const fit = (txt, w, px, wt) => { let s = px; x.font = font(wt, s); while (x.measureText(txt).width > w && s > 12) { s -= 2; x.font = font(wt, s); } return s; };
    const tile = (gx, gy, s, col) => { x.fillStyle = col; x.beginPath(); x.rect(gx, gy, s, s); x.fill(); };
    if (wide) {
      const cx = W / 2; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = q.ink;
      x.direction = rtl(q.name) ? "rtl" : "ltr"; fit(q.name, W * 0.86, H * 0.36, "800"); x.fillText(q.name, cx, H * 0.36);
      x.direction = rtl(q.sub) ? "rtl" : "ltr"; fit(q.sub, W * 0.8, H * 0.15, "600"); x.fillText(q.sub, cx, H * 0.62); x.fillStyle = q.c1; x.fillRect(W * 0.3, H * 0.76, W * 0.4, 5);
      x.fillStyle = q.ink; x.direction = "ltr"; fit(q.vol, W * 0.5, H * 0.1, "700"); x.fillText(q.vol, cx, H * 0.88); return cv;
    }
    const bandH = H * 0.2, by = H - bandH, s = bandH / 2;
    for (let i = 0; i * s < W + s; i++) for (let j = 0; j < 2; j++) { const gx = i * s, gy = by + j * s; x.fillStyle = (i + j) % 2 === 0 ? q.c1 : (q.c1 + "66"); x.beginPath(); if ((i + j) % 3 === 0) { x.moveTo(gx, gy + s); x.arc(gx, gy + s, s, -Math.PI / 2, 0); x.closePath(); } else x.rect(gx, gy, s, s); x.fill(); }
    const lw = W * 0.14, lx = W - pad - lw, ly = pad * 0.9; x.fillStyle = q.c1; x.beginPath(); x.roundRect ? x.roundRect(lx, ly, lw, lw, lw * 0.22) : x.rect(lx, ly, lw, lw); x.fill();
    x.fillStyle = q.c2; const pc = (ox, oy) => { x.beginPath(); x.ellipse(lx + lw / 2 + ox * lw * 0.16, ly + lw / 2 + oy * lw * 0.16, lw * 0.15, lw * 0.15, 0, 0, Math.PI * 2); x.fill(); }; pc(-1, -1); pc(1, -1); pc(-1, 1); pc(1, 1);
    x.textBaseline = "top"; x.fillStyle = q.ink; const rt = rtl(q.name); x.textAlign = rt ? "right" : "left"; x.direction = rt ? "rtl" : "ltr"; const tx = rt ? W - pad : pad;
    const s1 = fit(q.name, W - pad * 2, H * 0.1, "800"); const lines = String(q.name).split(/\s+/); let y = H * 0.34;
    if (x.measureText(q.name).width > W - pad * 2 - 20 && lines.length > 1) { const half = Math.ceil(lines.length / 2); lines.splice(0, lines.length, lines.slice(0, half).join(" "), lines.slice(half).join(" ")); }
    lines.forEach(l => { fit(l, W - pad * 2, H * 0.095, "800"); x.fillText(l, tx, y); y += H * 0.105; });
    x.fillStyle = q.c1; x.fillRect(rt ? W - pad - W * 0.22 : pad, y + 4, W * 0.22, 6); y += H * 0.04;
    x.fillStyle = q.ink; x.direction = rtl(q.sub) ? "rtl" : "ltr"; fit(q.sub, W - pad * 2, H * 0.048, "600"); x.fillText(q.sub, tx, y);
    x.direction = "ltr"; x.textAlign = rt ? "right" : "left"; fit(q.vol, W * 0.4, H * 0.04, "700"); x.fillText(q.vol, tx, by - H * 0.09); return cv;
  }
  function labelCanvas() { if (art && !S.useQuick) return art; const c = quickLabel(aspectOf(S.type)); return c; }
  /* ═══ بناء العبوة ═══ */
  function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
  function build() {
    if (packG) { root.remove(packG); disposeGroup(packG); }
    packG = new T.Group(); if (S.type === "dbox" && BOX) { buildFold(); return; } const sp = spec(S.type), bodyFinal = S.type === "box" && S.bodyFin === "glass" ? "gloss" : S.bodyFin;
    const bodyM = finMat(bodyFinal, S.body), capM = finMat(S.capFin, S.cap); mats.body = bodyM; mats.cap = capM;
    const cv = labelCanvas(), aspect = cv.width / cv.height;
    if (sp.box) {
      const { W, H, D } = sp, rr = 0.1, sh = new T.Shape(); const x0 = -W / 2, y0 = -H / 2;
      sh.moveTo(x0 + rr, y0); sh.lineTo(x0 + W - rr, y0); sh.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + rr); sh.lineTo(x0 + W, y0 + H - rr); sh.quadraticCurveTo(x0 + W, y0 + H, x0 + W - rr, y0 + H); sh.lineTo(x0 + rr, y0 + H); sh.quadraticCurveTo(x0, y0 + H, x0, y0 + H - rr); sh.lineTo(x0, y0 + rr); sh.quadraticCurveTo(x0, y0, x0 + rr, y0);
      const eg = new T.ExtrudeGeometry(sh, { depth: D - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 5, curveSegments: 10 }); eg.translate(0, 0, -(D - 0.12) / 2);
      const bm = new T.Mesh(eg, bodyM); packG.add(bm);
      const fw = W + 0.02, fh = H + 0.02, fc = document.createElement("canvas"); fc.width = 1024; fc.height = Math.round(1024 * fh / fw); const fx = fc.getContext("2d"); fx.fillStyle = S.useQuick || !art ? S.ql.c2 : S.body; fx.fillRect(0, 0, fc.width, fc.height);
      const sc = Math.max(fc.width / cv.width, fc.height / cv.height) * (S.wrap === "full" ? 1 : Math.min(1, 0.92 * S.lsize)); const dw = cv.width * sc, dh = cv.height * sc; fx.drawImage(cv, (fc.width - dw) / 2, (fc.height - dh) / 2 + S.lpos * fc.height * 0.1, dw, dh);
      const lm = () => new T.MeshPhysicalMaterial({ map: artTexture(fc), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 0.8 });
      const z = (D - 0.12) / 2 + 0.06 + 0.004; const f = new T.Mesh(new T.PlaneGeometry(fw - 0.2, fh - 0.2), lm()); f.position.z = z; packG.add(f);
      if (S.both) { const b = new T.Mesh(new T.PlaneGeometry(fw - 0.2, fh - 0.2), lm()); b.position.z = -z; b.rotation.y = Math.PI; packG.add(b); }
      sizeInfo = { r: Math.hypot(W, H, D) / 2, c: new T.Vector3(0, 0, 0), bottom: -H / 2 }; packG.rotation.y = 0;
    } else if (S.type === "photo") { photoParts(cv, aspect);
    } else {
      packG.add(new T.Mesh(lathe(sp.body), bodyM)); packG.add(new T.Mesh(lathe(sp.cap), capM));
      if (S.bodyFin === "glass") { const lm2 = new T.MeshPhysicalMaterial({ color: hex(S.liquid), roughness: 0.12, metalness: 0, clearcoat: 1, envMapIntensity: 0.9 }); const top = 0.1 + S.fill * (sp.liquidTop - 0.1); const lg = lathe(clipProfile(sp.body.filter(p => p.y >= 0.0), top, 0.935)); const lq = new T.Mesh(lg, lm2); lq.position.y = 0.06; packG.add(lq); }
      /* الملصق الأسطواني: نسبة طبيعية بلا تشويه (fit) أو لفّ كامل (full) */
      const range = sp.y1 - sp.y0, r = sp.r + 0.008; let h = range * 0.72 * S.lsize, th;
      if (S.wrap === "full") { th = Math.PI * 2 * 0.999; } else { h = Math.min(range, h); th = (h * aspect) / r; if (th > Math.PI * 2 * 0.999) { th = Math.PI * 2 * 0.999; h = th * r / aspect; } }
      h = Math.min(h, range); const cy = (sp.y0 + sp.y1) / 2 + S.lpos * Math.max(0, (range - h) / 2);
      const tex = artTexture(cv); const lm = new T.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.18, envMapIntensity: 0.85, transparent: true, alphaTest: 0.02 });
      const lg = new T.CylinderGeometry(r, r, h, 160, 1, true, -th / 2 + S.lrot, th); const lab = new T.Mesh(lg, lm); lab.position.y = cy; packG.add(lab);
      sizeInfo = { r: Math.hypot(sp.r, sp.h / 2) * 1.0, bottom: 0 };
    }
    const bb = new T.Box3().setFromObject(packG), c = new T.Vector3(); bb.getCenter(c); packG.position.sub(c); sizeInfo.c = c; sizeInfo.r = bb.getBoundingSphere(new T.Sphere()).radius; sizeInfo.bottom = bb.min.y - c.y;
    root.add(packG); view(); dirty = true;
  }

  /* ═══ علبة Box Designer: ألواح مفصّلة تُطوى من القالب المسطّح إلى العلبة المغلقة ═══ */
  function boxMat(cv, flap) {
    const gl = S.boxFin === "gloss" ? 0.55 : S.boxFin === "soft" ? 0.05 : 0.2, rg = S.boxFin === "gloss" ? 0.32 : S.boxFin === "soft" ? 0.85 : 0.6;
    return flap ? new T.MeshPhysicalMaterial({ color: hex(flap), roughness: rg, clearcoat: gl, clearcoatRoughness: 0.25, envMapIntensity: 0.8, side: T.DoubleSide })
      : new T.MeshPhysicalMaterial({ map: artTexture(cv), roughness: rg, clearcoat: gl, clearcoatRoughness: 0.2, envMapIntensity: 0.85 });
  }
  const rotCv = (cv, rot) => { if (!rot) return cv; const sw = rot % 180, o = document.createElement("canvas"); o.width = sw ? cv.height : cv.width; o.height = sw ? cv.width : cv.height; const x = o.getContext("2d"); x.translate(o.width / 2, o.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(cv, -cv.width / 2, -cv.height / 2); return o; };
  /* علبة هدية بقطعة واحدة: الأرضية جذر، الخلفي يطوى منها ثم الغطاء ثم اللسان، والأمامي بفتحة إبهام، والجانبان بأجنحة لصق */
  function buildGift() {
    const B = BOX, k = 3.4 / Math.max(B.W, B.H, B.D), W = B.W * k, H = B.H * k, D = B.D * k, Tk = B.T * k, Gk = B.G * k, th = Math.max(0.012, 0.5 * k), r = (B.dia || 0) * k / 2;
    const paper = new T.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.9, side: T.DoubleSide }), edge = new T.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 });
    const panel = (w, h, cv, flap) => new T.Mesh(new T.BoxGeometry(w, h, th), [edge, edge, edge, edge, boxMat(cv, flap), paper]);
    const hold = (parent, x, y) => { const g = new T.Group(); g.position.set(x, y, 0); parent.add(g); return g; };
    const F = {}; Object.keys(B.faces).forEach(id => { F[id] = rotCv(B.faces[id], (B.rots || {})[id] || 0); });
    const fm = (() => { /* الأمامي: لوح بفتحة إبهام (قطع نصف دائري من حافته الحرة y=-H/2) */
      const g = new T.Group(), sh = new T.Shape(); sh.moveTo(-W / 2, -H / 2 + 0); sh.lineTo(-r, -H / 2); if (r > 0) for (let i = 0; i <= 24; i++) { const a = Math.PI - Math.PI * i / 24; sh.lineTo(r * Math.cos(a), -H / 2 + r * Math.sin(a)); } sh.lineTo(r, -H / 2); sh.lineTo(W / 2, -H / 2); sh.lineTo(W / 2, H / 2); sh.lineTo(-W / 2, H / 2); sh.closePath();
      const body = new T.Mesh((() => { const e = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); e.translate(0, 0, -th / 2); return e; })(), [paper, edge]); g.add(body);
      const tx = artTexture(F.front); tx.repeat.set(1 / W, 1 / H); tx.offset.set(0.5, 0.5); tx.wrapS = tx.wrapT = T.ClampToEdgeWrapping;
      const art = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshPhysicalMaterial({ map: tx, roughness: S.boxFin === "gloss" ? 0.32 : S.boxFin === "soft" ? 0.85 : 0.6, clearcoat: S.boxFin === "gloss" ? 0.55 : S.boxFin === "soft" ? 0.05 : 0.2, clearcoatRoughness: 0.25, envMapIntensity: 0.85 })); art.position.z = th / 2 + 0.0008; g.add(art); return g;
    })();
    const bt = new T.Group(); bt.add(panel(W, D, F.bottom));
    const pBack = hold(bt, 0, D / 2), mBack = panel(W, H, F.back); mBack.position.y = H / 2; pBack.add(mBack);
    const pLid = hold(pBack, 0, H), mLid = panel(W, D, F.top); mLid.position.y = D / 2; pLid.add(mLid);
    const pTuck = hold(pLid, 0, D - th * 1.6), mTk = panel(W * 0.96, Tk, null, B.flap); mTk.position.y = Tk / 2; pTuck.add(mTk);
    const pFront = hold(bt, 0, -D / 2); fm.position.y = -H / 2; pFront.add(fm);
    const pSR = hold(bt, -W / 2, 0), mSR = panel(H, D, F.right); mSR.position.x = -H / 2; pSR.add(mSR);
    const pSL = hold(bt, W / 2, 0), mSL = panel(H, D, F.left); mSL.position.x = H / 2; pSL.add(mSL);
    const gf = (par, sx, up) => { const g = hold(par, sx * H / 2, up * (D / 2 - th * 1.6)), m = panel(H * 0.94, Gk, null, B.flap); m.position.y = up * Gk / 2; g.add(m); return g; };
    const gTR = gf(pSR, -1, 1), gBR = gf(pSR, -1, -1), gTL = gf(pSL, 1, 1), gBL = gf(pSL, 1, -1);
    packG.add(bt); foldNodes = { gift: true, bt, pBack, pLid, pTuck, pFront, pSR, pSL, gTR, gBR, gTL, gBL };
    root.add(packG); applyFold(S.fold);
  }
  function buildFold() {
    if (BOX && BOX.n) return BOX.n.mode === "net" ? buildNet() : buildSolid();
    if (BOX && BOX.style === "gift") return buildGift();
    const B = BOX, k = 3.4 / Math.max(B.W, B.H, B.D), W = B.W * k, H = B.H * k, D = B.D * k, Tk = B.T * k, Gk = B.G * k, th = Math.max(0.012, 0.5 * k), dd = D * 0.8, cc = Math.min(dd * 0.45, D * 0.4);
    const paper = new T.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.9 }), edge = new T.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 });
    const panel = (w, h, cv, flap) => { const g = new T.BoxGeometry(w, h, th), top = boxMat(cv, flap); return new T.Mesh(g, [edge, edge, edge, edge, top, paper]); };
    const dust = () => { const sh = new T.Shape(); sh.moveTo(-D * 0.49, 0); sh.lineTo(-D * 0.49, dd - cc); sh.lineTo(-D * 0.49 + cc, dd); sh.lineTo(D * 0.49, dd); sh.lineTo(D * 0.49, 0); sh.closePath(); const g = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); g.translate(0, 0, -th / 2); return new T.Mesh(g, [boxMat(null, B.flap), edge]); };
    const F = B.faces, N = {};
    const hold = (parent, x, y) => { const g = new T.Group(); g.position.set(x, y, 0); parent.add(g); return g; };
    const fr = new T.Group(); const mF = panel(W, H, F.front); fr.add(mF);
    const pL = hold(fr, -W / 2, 0), mL = panel(D, H, F.left); mL.position.x = -D / 2; pL.add(mL);
    const pB = hold(pL, -D, 0), mB = panel(W, H, F.back); mB.position.x = -W / 2; pB.add(mB);
    const pG = hold(pB, -W, 0), mG = new T.Mesh(new T.BoxGeometry(Gk, H * 0.94, th), [edge, edge, edge, edge, paper, paper]); mG.position.x = -Gk / 2; pG.add(mG);
    const pR = hold(fr, W / 2, 0), mR = panel(D, H, F.right); mR.position.x = D / 2; pR.add(mR);
    const pT = hold(fr, 0, H / 2), mT = panel(W, D, F.top); mT.position.y = D / 2; pT.add(mT);
    const pTk = hold(pT, 0, D), mTk = panel(W * 0.98, Tk, null, B.flap); mTk.position.y = Tk / 2; pTk.add(mTk);
    const pBt = hold(fr, 0, -H / 2), mBt = panel(W, D, F.bottom); mBt.position.y = -D / 2; pBt.add(mBt);
    const pBk = hold(pBt, 0, -D), mBk = panel(W * 0.98, Tk, null, B.flap); mBk.position.y = -Tk / 2; pBk.add(mBk);
    const dTL = hold(pL, -D / 2, H / 2), dBL = hold(pL, -D / 2, -H / 2), dTR = hold(pR, D / 2, H / 2), dBR = hold(pR, D / 2, -H / 2);
    [dTL, dTR].forEach(g => g.add(dust())); [dBL, dBR].forEach(g => { const m = dust(); m.scale.y = -1; g.add(m); });
    packG.add(fr); foldNodes = { pL, pB, pG, pR, pT, pTk, pBt, pBk, dTL, dTR, dBL, dBR, H, D };
    root.add(packG); applyFold(S.fold);
  }

  /* ═══ قالب عام (مكتبة قوالب العلب): وجوه مفصّلة تُطوى حول حواف الثني، أو مجسّم صلب للأشكال الدائرية ═══ */
  function netTex(B, bw, bh) {
    const W = 2048, cv = document.createElement("canvas"); cv.width = W; cv.height = Math.max(64, Math.min(4096, Math.round(W * bh / bw))); const x = cv.getContext("2d");
    x.fillStyle = B.color || "#f1ece0"; x.fillRect(0, 0, cv.width, cv.height);
    if (B.art) { const a = B.art, sc = Math.max(cv.width / a.width, cv.height / a.height), dw = a.width * sc, dh = a.height * sc; x.drawImage(a, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh); }
    return cv;
  }
  /* مجموعة three لعلبة من نتيجة BoxProfiles.net3d: قالب مطويّ (وجوه مفصّلة) أو مجسّم صلب؛ يستعملها الستوديو والمعاينة الحيّة داخل نافذة القوالب */
  function boxGroup(TT, B, o) {
    o = o || {}; const fin = o.fin || "gloss", gl = fin === "gloss" ? 0.55 : fin === "soft" ? 0.05 : 0.2, rg = fin === "gloss" ? 0.32 : fin === "soft" ? 0.85 : 0.6, net = B.n, G = new TT.Group();
    const tex = o.tex || (c => { const t = new TT.CanvasTexture(c); t.colorSpace = TT.SRGBColorSpace; t.anisotropy = 4; return t; });
    if (net.mode === "net") {
      const bb = net.bb, bw = bb.maxx - bb.minx, bh = bb.maxy - bb.miny, size = Math.max(bw, bh), th = Math.max(0.5, size / 260);
      const tx = tex(netTex(B, bw, bh)); tx.repeat.set(1 / bw, 1 / bh); tx.offset.set(-bb.minx / bw, -bb.miny / bh); tx.wrapS = tx.wrapT = TT.ClampToEdgeWrapping;
      const print = new TT.MeshPhysicalMaterial({ map: tx, roughness: rg, clearcoat: gl, clearcoatRoughness: 0.25, envMapIntensity: 0.85 }), paper = new TT.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.9 }), edge = new TT.MeshStandardMaterial({ color: 0xe2dccc, roughness: 0.9 });
      const line = new TT.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.32 }), groups = [];
      net.faces.forEach(f => {
        const g = new TT.Group(), pts = f.poly.filter((q, i, a) => { const w = a[(i + a.length - 1) % a.length]; return Math.hypot(q[0] - w[0], q[1] - w[1]) > 1e-3; }), sh = new TT.Shape(pts.map(q => new TT.Vector2(q[0], q[1])));
        const eg = new TT.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); eg.translate(0, 0, -th); g.add(new TT.Mesh(eg, [paper, edge]));
        const pm = new TT.Mesh(new TT.ShapeGeometry(sh), print); pm.position.z = size * 0.0006; g.add(pm);
        g.add(new TT.LineLoop(new TT.BufferGeometry().setFromPoints(pts.map(q => new TT.Vector3(q[0], q[1], size * 0.0012))), line));
        g.matrixAutoUpdate = false; groups.push(g); G.add(g);
      });
      const cb = B.bounds(net, 1); G.scale.setScalar(3.4 / Math.max(cb.size[0], cb.size[1], cb.size[2], 1)); if (net.stand) G.rotation.x = Math.PI / 2; /* هرم/صينية: القاعدة على الأرض */
      /* الألسنة والأجنحة (غير الرئيسية) تستقر تحت الوجوه الرئيسية: إزاحة للداخل عكس ناظمها بسماكة الورق × عمق تداخلها */
      return { g: G, apply: t => { const mats = B.fold(net, t), k = Math.max(0, Math.min(1, t)), kk = k * k * (3 - 2 * k); groups.forEach((g, i) => { const m = mats[i].slice(), f = net.faces[i]; if (f.main === false && kk > 0) { const d = (th * 1.08 + size * 0.0013) * Math.max(1, f.rank || 1) * kk; m[12] -= m[8] * d; m[13] -= m[9] * d; m[14] -= m[10] * d; } g.matrix.fromArray(m); g.matrixWorldNeedsUpdate = true; }); } };
    }
    const so = net.solid, mat = new TT.MeshPhysicalMaterial({ color: new TT.Color(B.color || "#f1ece0"), roughness: rg, clearcoat: gl, clearcoatRoughness: 0.25, envMapIntensity: 0.85, side: TT.DoubleSide }), grp = new TT.Group(); let lid = null;
    if (so.kind === "frustum") grp.add(new TT.Mesh(new TT.CylinderGeometry(so.rt, so.rb, so.H, 96, 1, true), mat));
    else {
      const v2 = pts => pts.map(q => new TT.Vector2(q[0], q[1])), cup = (out, inn, h, plateAt) => {
        const sh = new TT.Shape(v2(out)); sh.holes.push(new TT.Path(v2(inn))); const g = new TT.Group(), w = new TT.Mesh(new TT.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }), mat), pl = new TT.Mesh(new TT.ExtrudeGeometry(new TT.Shape(v2(out)), { depth: so.T, bevelEnabled: false }), mat); pl.position.z = plateAt; g.add(w); g.add(pl); return g; };
      grp.add(cup(so.outline, so.inner, so.H, 0)); lid = cup(so.lo, so.loInner, so.LID, so.LID - so.T); grp.add(lid); grp.rotation.x = -Math.PI / 2;
    }
    G.add(grp); const bb0 = new TT.Box3().setFromObject(G), sz = new TT.Vector3(); bb0.getSize(sz); G.scale.setScalar(3.4 / Math.max(sz.x, sz.y, sz.z, 1));
    const base = so.H - (so.LID || 0), lift = (so.H || 1) * 1.15;
    return { g: G, apply: t => { if (lid) lid.position.z = base + (1 - ease(t)) * lift; } };
  }
  function buildNet() { const bg = boxGroup(T, BOX, { fin: S.boxFin, tex: artTexture }); packG.add(bg.g); foldNodes = { net: true, bg }; root.add(packG); applyFold(S.fold); }
  const buildSolid = buildNet;
  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function applyFold(t) {
    if (!foldNodes || !packG) return; const n = foldNodes, q = Math.PI / 2, s = ease(t / 0.5), tb = ease((t - 0.3) / 0.45), fl = ease((t - 0.7) / 0.3);
    if (n.net) n.bg.apply(t);
    else if (n.gift) {
      const gl = ease((t - 0.3) / 0.25), ld = ease((t - 0.5) / 0.3), tk = ease((t - 0.78) / 0.22); n.pBack.rotation.x = -q * s; n.pFront.rotation.x = q * s; n.pSR.rotation.y = -q * s; n.pSL.rotation.y = q * s;
      n.gTR.rotation.x = -q * gl; n.gTL.rotation.x = -q * gl; n.gBR.rotation.x = q * gl; n.gBL.rotation.x = q * gl; n.pLid.rotation.x = -q * ld; n.pTuck.rotation.x = -q * tk; packG.quaternion.setFromAxisAngle(new T.Vector3(0, 1, -1).normalize(), Math.PI * s);
    } else {
    n.pL.rotation.y = -q * s; n.pB.rotation.y = -q * s; n.pG.rotation.y = -q * s; n.pR.rotation.y = q * s;
    n.pT.rotation.x = -q * tb; n.pBt.rotation.x = q * tb; n.pTk.rotation.x = -q * fl; n.pBk.rotation.x = q * fl;
    n.dTL.rotation.x = -q * fl; n.dTR.rotation.x = -q * fl; n.dBL.rotation.x = q * fl; n.dBR.rotation.x = q * fl; }
    root.rotation.set(0, 0, 0); root.updateMatrixWorld(true); packG.position.set(0, 0, 0); packG.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(packG), c = new T.Vector3(); bb.getCenter(c); packG.position.sub(c);
    sizeInfo = { r: bb.getBoundingSphere(new T.Sphere()).radius, c, bottom: bb.min.y - c.y, shY: bb.min.y - c.y - 0.01 }; view(); dirty = true;
  }
  let foldRaf = 0;
  function foldTo(to) { cancelAnimationFrame(foldRaf); const from = S.fold, t0 = performance.now(), dur = 1700 * Math.abs(to - from) + 200; const step = now => { const u = Math.min(1, (now - t0) / dur); S.fold = from + (to - from) * u; applyFold(S.fold); sync("fold"); if (u < 1) foldRaf = requestAnimationFrame(step); else save(); }; foldRaf = requestAnimationFrame(step); }

  /* ═══ قارورة من صورة 2D: استخراج الصورة الظلّية ثم تدويرها حول المحور الرأسي (القوارير متناظرة دورانياً) ═══ */
  function silhouette(im) {
    const k = Math.min(1, 720 / Math.max(im.width, im.height)), w = Math.max(8, Math.round(im.width * k)), h = Math.max(8, Math.round(im.height * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, N = w * h, m = new Uint8Array(N); let tr = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 200) tr++;
    if (tr > N * 0.06) { for (let i = 0; i < N; i++) m[i] = d[i * 4 + 3] > 128 ? 1 : 0; }
    else {
      const bs = [[], [], []], add = i => { for (let q = 0; q < 3; q++) bs[q].push(d[i * 4 + q]); }; for (let xx = 0; xx < w; xx++) { add(xx); add(w + xx); add((h - 1) * w + xx); add((h - 2) * w + xx); } for (let yy = 0; yy < h; yy++) { add(yy * w); add(yy * w + 1); add(yy * w + w - 1); add(yy * w + w - 2); }
      const med = a => { a.sort((u, v) => u - v); return a[a.length >> 1]; }, bg = bs.map(med), dist = new Float32Array(N), hist = new Float64Array(256);
      for (let i = 0; i < N; i++) { const dr = d[i * 4] - bg[0], dg = d[i * 4 + 1] - bg[1], db = d[i * 4 + 2] - bg[2], v = Math.sqrt(dr * dr + dg * dg + db * db); dist[i] = v; hist[Math.min(255, Math.round(v / 1.73))]++; }
      let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let wB = 0, sB = 0, best = 0, thr = 16; for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, vv = wB * wF * (mB - mF) * (mB - mF); if (vv > best) { best = vv; thr = i; } }
      const T0 = Math.max(26, thr * 1.73 * 0.75); for (let i = 0; i < N; i++) m[i] = dist[i] > T0 ? 1 : 0;
    }
    /* أكبر مكوّن متصل */
    const lab = new Int32Array(N), q = new Int32Array(N); let bestL = 0, bestN = 0, L = 0;
    for (let s0 = 0; s0 < N; s0++) { if (!m[s0] || lab[s0]) continue; L++; let qh = 0, qt = 0, cnt = 0; q[qt++] = s0; lab[s0] = L; while (qh < qt) { const i = q[qh++]; cnt++; const xx = i % w, yy = (i / w) | 0; if (xx > 0 && m[i - 1] && !lab[i - 1]) { lab[i - 1] = L; q[qt++] = i - 1; } if (xx < w - 1 && m[i + 1] && !lab[i + 1]) { lab[i + 1] = L; q[qt++] = i + 1; } if (yy > 0 && m[i - w] && !lab[i - w]) { lab[i - w] = L; q[qt++] = i - w; } if (yy < h - 1 && m[i + w] && !lab[i + w]) { lab[i + w] = L; q[qt++] = i + w; } } if (cnt > bestN) { bestN = cnt; bestL = L; } }
    if (bestN < N * 0.01) throw new Error("تعذّر استخراج شكل القارورة — استعمل صورة بخلفية بيضاء أو شفافة");
    const rows = []; for (let y = 0; y < h; y++) { let lo = -1, hi = -1; for (let xx = 0; xx < w; xx++) if (lab[y * w + xx] === bestL) { if (lo < 0) lo = xx; hi = xx; } rows.push(lo < 0 ? null : { l: lo, r: hi }); }
    let t0 = rows.findIndex(r => r && r.r - r.l >= 3), t1 = rows.length - 1; while (t1 > t0 && !(rows[t1] && rows[t1].r - rows[t1].l >= 3)) t1--;
    if (t0 < 0 || t1 - t0 < 20) throw new Error("تعذّر استخراج شكل القارورة — استعمل صورة بخلفية أنظف");
    const R0 = []; for (let y = t0; y <= t1; y++) { const r = rows[y] || R0[R0.length - 1] || { l: 0, r: 0 }; R0.push({ y, hw: (r.r - r.l + 1) / 2, mid: (r.l + r.r) / 2 }); }
    const midAxis = (a => { const b = a.map(r => r.mid).sort((u, v) => u - v); return b[b.length >> 1]; })(R0);
    const med = (a, i, k) => { const b = []; for (let j = Math.max(0, i - k); j <= Math.min(a.length - 1, i + k); j++) b.push(a[j]); b.sort((u, v) => u - v); return b[b.length >> 1]; };
    let hw = R0.map(r => r.hw); hw = hw.map((_, i) => med(hw, i, 2)); hw = hw.map((_, i) => { let s2 = 0, n = 0; for (let j = Math.max(0, i - 3); j <= Math.min(hw.length - 1, i + 3); j++) { s2 += hw[j]; n++; } return s2 / n; });
    /* لون كل صف من شريطي الحافة (بعيداً عن ملصق الصورة الأصلية) */
    const cols = R0.map((r, i) => { let rr = 0, gg = 0, bb = 0, n = 0; for (let side = -1; side <= 1; side += 2) for (let o = 0.6; o <= 0.95; o += 0.05) { const xx = Math.round(midAxis + side * o * hw[i]), idx = (r.y * w + Math.max(0, Math.min(w - 1, xx))) * 4; if (d[idx + 3] > 40) { rr += d[idx]; gg += d[idx + 1]; bb += d[idx + 2]; n++; } } if (!n) { const idx = (r.y * w + Math.round(midAxis)) * 4; return [d[idx], d[idx + 1], d[idx + 2]]; } return [rr / n, gg / n, bb / n]; });
    return { hw, cols, n: R0.length, w, h };
  }
  function setPhotoFromImage(im) {
    const sil = silhouette(im), H = 4.6, M = 120, u = H / sil.n, lerp = (a, i) => { const f = Math.max(0, Math.min(a.length - 1, i)), i0 = Math.floor(f), i1 = Math.min(a.length - 1, i0 + 1); return a[i0] + (a[i1] - a[i0]) * (f - i0); };
    const smp = [], colr = []; for (let i = 0; i < M; i++) { const t = i / (M - 1), row = (sil.n - 1) * (1 - t); smp.push({ y: t * H, r: lerp(sil.hw, row) * u }); colr.push([0, 1, 2].map(ch => lerp(sil.cols.map(c => c[ch]), row))); }
    const pts = [new T.Vector2(0, 0)].concat(smp.map(q => new T.Vector2(Math.max(0.001, q.r), q.y)), [new T.Vector2(0, H)]), cl = [colr[0]].concat(colr, [colr[M - 1]]);
    const g = document.createElement("canvas"); g.width = 4; g.height = pts.length; const gx = g.getContext("2d"); cl.forEach((c, i) => { gx.fillStyle = "rgb(" + c.map(v => Math.round(v)).join(",") + ")"; gx.fillRect(0, pts.length - 1 - i, 4, 1); });
    const rmax = Math.max(...smp.map(q => q.r)); let bi = 0, bl = 0, st = -1; for (let i = 0; i <= M; i++) { const ok = i < M && smp[i].r >= rmax * 0.9; if (ok && st < 0) st = i; if ((!ok || i === M) && st >= 0) { if (i - st > bl) { bl = i - st; bi = st; } st = -1; } }
    let i0 = bi, i1 = bi + bl - 1; if (bl < M * 0.14) { i0 = Math.round(M * 0.25); i1 = Math.round(M * 0.65); }
    const zr = smp.slice(i0, i1 + 1).reduce((a, q) => a + q.r, 0) / (i1 - i0 + 1);
    photo = { pts, grad: g, smp, zone: { y0: smp[i0].y, y1: smp[i1].y, r: zr }, H, rAt: y => { const f = Math.max(0, Math.min(M - 1, y / H * (M - 1))); return lerp(smp.map(q => q.r), f); } };
  }
  function photoParts(cv, aspect) {
    if (!photo) { sizeInfo = { r: 3, c: new T.Vector3(), bottom: -2.5 }; return; }
    const sp = photo, tex = new T.CanvasTexture(sp.grad); tex.colorSpace = T.SRGBColorSpace; tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter; tex.needsUpdate = true;
    const mat = new T.MeshPhysicalMaterial({ map: tex, roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 1 }); packG.add(new T.Mesh(new T.LatheGeometry(sp.pts, 160), mat));
    const z = sp.zone, range = z.y1 - z.y0, r = z.r + 0.008; let h = range * 0.8 * S.lsize, th;
    if (S.wrap === "full") th = Math.PI * 2 * 0.999; else { h = Math.min(range, h); th = (h * aspect) / r; if (th > Math.PI * 2 * 0.999) { th = Math.PI * 2 * 0.999; h = th * r / aspect; } }
    h = Math.min(h, range); const cy = (z.y0 + z.y1) / 2 + S.lpos * Math.max(0, (range - h) / 2), lp = []; for (let j = 0; j <= 28; j++) { const y = cy - h / 2 + h * j / 28; lp.push(new T.Vector2(sp.rAt(y) + 0.008, y)); }
    const lm = new T.MeshPhysicalMaterial({ map: artTexture(cv), roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.18, envMapIntensity: 0.85, transparent: true, alphaTest: 0.02 });
    packG.add(new T.Mesh(new T.LatheGeometry(lp, 160, -th / 2 + S.lrot, th), lm));
  }
  async function setPhoto(file) {
    try { msg("جارٍ استخراج شكل القارورة وتحويلها إلى 3D…"); const url = URL.createObjectURL(file), im = await loadImg(url); URL.revokeObjectURL(url); setPhotoFromImage(im); S.type = "photo"; save(); ui(); build(); msg("✅ تحوّلت الصورة إلى مجسّم ثلاثي الأبعاد — ارفع الملصق وركّبه عليه"); }
    catch (e) { msg("⚠️ " + e.message, true); }
  }
  /* ═══ إرسال الزوايا إلى ستوديو ديزاين (مكتبة صور الصفحة) ═══ */
  async function sendToStudio() {
    try {
      if (typeof ImgGen === "undefined" || !ImgGen.openSized || typeof PBApp === "undefined") throw new Error("ستوديو ديزاين غير متاح هنا");
      msg("جارٍ تجهيز الزوايا…"); const names = ["front", "three-quarter", "side", "back"], tg = [0, -0.6, -Math.PI / 2, Math.PI], blobs = [];
      for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 20)); blobs.push(await blobOf(renderTo(1400, 1750, true, tg[i] - S.yaw), "png")); }
      const nm = stamp(); close(); await ImgGen.openSized({ W: 1080, H: 1350, id: "p3", label: "3D Pack Studio", name: nm });
      if (!(PBApp.E && PBApp.E.page)) throw new Error("تعذّر فتح ستوديو ديزاين"); const paths = [];
      for (let i = 0; i < 4; i++) paths.push(await PBApp.uploadBlob(blobs[i], "p3-" + names[i] + "-" + Date.now().toString(36), { max: 4096, q: 0.92 }));
      if (paths[0] && PBApp.addPageImage) PBApp.addPageImage(paths[0]); if (typeof toast === "function") toast("🎨 أُضيفت 4 زوايا إلى مكتبة صور الصفحة في ستوديو ديزاين");
    } catch (e) { msg("⚠️ " + e.message, true); if (typeof toast === "function") toast("⚠️ " + e.message); }
  }
  function recolor() { if (!mats.body) return; build(); }
  /* الكاميرا والعرض */
  function view() {
    if (!R || !root) return; root.rotation.set(S.pitch, S.yaw, S.tilt, "ZXY");
    const asp = R.domElement.clientWidth / Math.max(1, R.domElement.clientHeight) || 1, vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp), need = sizeInfo.r * 1.14 / Math.sin(Math.min(vf, hf) / 2);
    cam.aspect = asp; cam.position.set(0, 0, need / S.zoom); cam.near = need / 20; cam.far = need * 6; cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    if (shadowM) { shadowM.visible = !!S.shadow && !(S.type === "dbox" && S.fold < 0.6); const s = sizeInfo.r * 2.3; shadowM.scale.set(s, s, 1); shadowM.position.set(0, sizeInfo.bottom * 1.0 - 0.02, 0); shadowM.rotation.set(-Math.PI / 2, 0, 0); shadowM.position.y = sizeInfo.shY != null ? sizeInfo.shY : -sizeInfo.r * 0.98; }
    paintBg(); dirty = true;
  }
  function bgCss() { if (S.bgMode === "none") return "transparent"; if (S.bgMode === "solid") return S.bg1; if (S.bgMode === "radial") return "radial-gradient(circle at 50% 42%," + S.bg1 + "," + S.bg2 + ")"; return "linear-gradient(180deg," + S.bg1 + "," + S.bg2 + ")"; }
  function paintBg() { if (stage) { stage.style.background = S.bgMode === "none" ? "repeating-conic-gradient(#e6e6e6 0 25%,#fff 0 50%) 0 0/20px 20px" : bgCss(); } }
  function loop() { raf = requestAnimationFrame(loop); if (!opened) return; if (S.auto) { S.yaw += 0.008; view(); } if (dirty && R) { R.render(scene, cam); dirty = false; } }
  async function init(host) {
    await loadThree();
    R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.NoToneMapping; R.setClearColor(0x000000, 0); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(R.domElement); R.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab";
    scene = new T.Scene(); cam = new T.PerspectiveCamera(28, 1, 0.1, 100); root = new T.Group(); scene.add(root);
    envTex = makeEnv(); scene.environment = envTex; scene.add(new T.HemisphereLight(0xffffff, 0x8899aa, 0.35));
    shadowM = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.85 })); scene.add(shadowM);
    resize(); build(); if (!raf) loop();
  }
  function resize() { if (!R || !stage) return; const w = stage.clientWidth || 600, h = stage.clientHeight || 500; R.setSize(w, h, false); view(); }
  /* السحب للتدوير، العجلة للتكبير، النقر المزدوج لإعادة الضبط */
  function bindStage(el) {
    let down = null; const cv = R.domElement;
    cv.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", e => { if (!down) return; S.yaw = down.yaw + (e.clientX - down.x) * 0.011; S.pitch = Math.max(-0.9, Math.min(0.9, down.pitch + (e.clientY - down.y) * 0.008)); sync("yaw", "pitch"); view(); });
    const up = () => { down = null; cv.style.cursor = "grab"; save(); }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", e => { e.preventDefault(); S.zoom = Math.max(0.5, Math.min(2.6, S.zoom * (e.deltaY < 0 ? 1.07 : 0.93))); sync("zoom"); view(); }, { passive: false });
    cv.addEventListener("dblclick", () => { S.yaw = DEF.yaw; S.pitch = DEF.pitch; S.zoom = 1; sync("yaw", "pitch", "zoom"); view(); });
    new ResizeObserver(resize).observe(el);
  }
  const sync = (...ks) => ks.forEach(k => { const e = document.querySelector('#p3 [data-k="' + k + '"]'); if (e) e.value = k === "yaw" ? Math.round(((S.yaw * 180 / Math.PI) % 360 + 360) % 360) : k === "pitch" ? Math.round(S.pitch * 180 / Math.PI) : k === "tilt" ? Math.round(S.tilt * 180 / Math.PI) : S[k]; });

  /* ═══ التصدير ═══ */
  function renderTo(w, h, transparent, yawOffset) {
    const keep = { yaw: S.yaw, zoom: S.zoom }; const cw = R.domElement.clientWidth, ch = R.domElement.clientHeight, pr = R.getPixelRatio();
    w = Math.max(64, Math.min(4096, Math.round(w))); h = Math.max(64, Math.min(4096, Math.round(h)));
    R.setPixelRatio(1); R.setSize(w, h, false); if (yawOffset) S.yaw += yawOffset;
    const asp = w / h, vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp), need = sizeInfo.r * 1.14 / Math.sin(Math.min(vf, hf) / 2); root.rotation.set(S.pitch, S.yaw, S.tilt, "ZXY"); cam.aspect = asp; cam.position.set(0, 0, need / S.zoom); cam.near = need / 20; cam.far = need * 6; cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    R.render(scene, cam); const out = document.createElement("canvas"); out.width = w; out.height = h; const x = out.getContext("2d");
    if (!transparent && S.bgMode !== "none") { if (S.bgMode === "solid") { x.fillStyle = S.bg1; x.fillRect(0, 0, w, h); } else { const g = S.bgMode === "radial" ? x.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.hypot(w, h) * 0.6) : x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, S.bg1); g.addColorStop(1, S.bg2); x.fillStyle = g; x.fillRect(0, 0, w, h); } }
    x.drawImage(R.domElement, 0, 0, w, h); S.yaw = keep.yaw; R.setPixelRatio(pr); R.setSize(cw, ch, false); view(); return out;
  }
  const blobOf = (cv, fmt, q) => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("تعذّر إنشاء الصورة"))), fmt === "webp" ? "image/webp" : "image/png", fmt === "webp" ? q / 100 : undefined));
  const dims = () => { const s = SIZES[Math.max(0, Math.min(SIZES.length - 1, +S.size || 0))]; return [s[1], s[2]]; };
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const msg = (t, bad) => { const e = $("p3-msg"); if (e) { e.textContent = t || ""; e.style.color = bad ? "#ffb4b4" : "#c6fe17"; } };
  const stamp = () => S.type === "dbox" ? "custom-box-3d" : S.type + "-3d";
  async function exportOne() { try { msg("جارٍ التصدير…"); const [w, h] = dims(), cv = renderTo(w, h, S.transparent); const b = await blobOf(cv, S.fmt, S.q); if (S.fmt === "webp" && b.type !== "image/webp") throw new Error("متصفحك لا يدعم WebP — اختر PNG"); dl(b, stamp() + "." + S.fmt); msg("✅ تم التنزيل"); } catch (e) { msg("⚠️ " + e.message, true); } }
  async function exportSet(frames, names) {
    try {
      if (typeof AdminImgBatch === "undefined" || !AdminImgBatch.zip) throw new Error("تعذّر إنشاء ملف ZIP"); const [w, h] = dims(), files = [], step = Math.PI * 2 / frames.length;
      for (let i = 0; i < frames.length; i++) { msg("جارٍ التصدير " + (i + 1) + " / " + frames.length); await new Promise(r => setTimeout(r, 20)); const cv = renderTo(w, h, S.transparent, frames[i]); files.push({ name: names(i), blob: await blobOf(cv, S.fmt, S.q) }); }
      dl(await AdminImgBatch.zip(files), stamp() + "-" + frames.length + ".zip"); msg("✅ تم تنزيل ZIP (" + files.length + " صورة)");
    } catch (e) { msg("⚠️ " + e.message, true); }
  }
  const exportAngles = () => exportSet([0, Math.PI / 2, Math.PI, -Math.PI / 2], i => stamp() + "-" + ["front", "side-right", "back", "side-left"][i] + "." + S.fmt);
  const export360 = n => exportSet(Array.from({ length: n }, (_, i) => i * Math.PI * 2 / n), i => stamp() + "-360-" + String(i + 1).padStart(2, "0") + "." + S.fmt);

  /* ═══ الصور المرفوعة ═══ */
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("تعذّر قراءة الصورة")); im.src = src; });
  async function setArt(file) {
    try { const url = typeof file === "string" ? file : URL.createObjectURL(file), im = await loadImg(url); const mx = 2048, k = Math.min(1, mx / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); art = cv; S.useQuick = false; if (typeof file !== "string") URL.revokeObjectURL(url); ui(); build(); msg("✅ طُبّق الملصق على العبوة"); } catch (e) { msg("⚠️ " + e.message, true); }
  }
  /* لونا العبوة والغطاء من صورة العبوة الأصلية (متوسط البكسلات غير الشفافة وغير البيضاء) */
  function pickColors(im) {
    const c = document.createElement("canvas"), W = 120, H = Math.max(40, Math.round(W * im.height / im.width)); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
    const avg = (x0, y0, x1, y1) => { const d = x.getImageData(x0, y0, x1 - x0, y1 - y0).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mn > 238 && mx - mn < 14) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return n > 20 ? "#" + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, "0")).join("") : null; };
    return { body: avg(Math.round(W * 0.3), Math.round(H * 0.35), Math.round(W * 0.7), Math.round(H * 0.8)), cap: avg(Math.round(W * 0.3), 0, Math.round(W * 0.7), Math.round(H * 0.12)) };
  }
  async function setOrig(file) {
    try { const url = URL.createObjectURL(file), im = await loadImg(url); orig = im; const c = pickColors(im); if (c.body) S.body = c.body; if (c.cap) S.cap = c.cap; URL.revokeObjectURL(url); ui(); build(); msg(c.body ? "✅ التُقط لون العبوة من الصورة" : "لم يُعثر على لون مميّز — اختر اللون يدوياً"); } catch (e) { msg("⚠️ " + e.message, true); }
  }
  function useOrigAsLabel() { if (!orig) return; const cv = document.createElement("canvas"); cv.width = orig.width; cv.height = orig.height; cv.getContext("2d").drawImage(orig, 0, 0); art = cv; S.useQuick = false; ui(); build(); }

  /* ═══ الواجهة ═══ */
  const CSS = '#p3-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:.8rem}#p3{background:rgba(9,24,18,.99);border:1px solid rgba(var(--g-mint-rgb,198,254,23),.35);border-radius:18px;width:min(1320px,100%);height:min(92vh,860px);display:flex;flex-direction:column;color:#fff;direction:rtl;overflow:hidden}#p3 .p3-h{display:flex;align-items:center;gap:.7rem;padding:.7rem 1rem;border-bottom:1px solid rgba(255,255,255,.12)}#p3 .p3-h b{font-size:1.05rem}#p3 .p3-h small{opacity:.7}#p3 .p3-x{margin-inline-start:auto}#p3 .p3-m{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 380px;min-height:0}@media(max-width:900px){#p3 .p3-m{grid-template-columns:1fr;grid-template-rows:minmax(300px,45%) 1fr}}#p3 .p3-st{position:relative;min-height:300px;overflow:hidden}#p3 .p3-3d{position:absolute;top:.7rem;left:.9rem;font-weight:800;font-size:1.6rem;opacity:.5;color:#6b7a9c;pointer-events:none}#p3 .p3-hint{position:absolute;bottom:.6rem;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.55);padding:.25rem .8rem;border-radius:999px;font-size:.74rem;pointer-events:none;white-space:nowrap}#p3 .p3-side{overflow:auto;padding:.8rem 1rem;border-inline-start:1px solid rgba(255,255,255,.12)}#p3 h4{margin:.9rem 0 .4rem;font-size:.9rem;color:var(--g-mint,#c6fe17)}#p3 h4:first-child{margin-top:0}#p3 label.f{display:block;font-weight:700;font-size:.76rem;margin:.45rem 0 .15rem;color:rgba(255,255,255,.85)}#p3 input,#p3 select{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.22);border-radius:10px;color:#fff;padding:.4rem .5rem;font:inherit;font-size:.85rem}#p3 select option{color:#111}#p3 input[type=color]{padding:.1rem;height:2rem}#p3 input[type=range]{padding:0;accent-color:#c6fe17}#p3 input[type=checkbox]{width:auto}#p3 .r2{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}#p3 .types{display:grid;grid-template-columns:repeat(5,1fr);gap:.3rem}#p3 .types button{padding:.5rem .1rem;font-size:.72rem}#p3 button{cursor:pointer;border-radius:12px;padding:.5rem .8rem;font-weight:800;color:#fff;font-size:.82rem;border:1px solid rgba(var(--g-mint-rgb,198,254,23),.45);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,198,254,23),.3),rgba(var(--g-mint-rgb,198,254,23),.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 4px rgba(0,0,0,.25),0 3px 8px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s}#p3 button:hover{transform:translateY(-2px)}#p3 button.o{border-color:rgba(255,255,255,.28);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04))}#p3 button.on{border-color:#c6fe17;background:linear-gradient(180deg,rgba(var(--g-mint-rgb,198,254,23),.55),rgba(var(--g-mint-rgb,198,254,23),.2))}#p3 .p3-b{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem}#p3 .p3-f{padding:.55rem 1rem;border-top:1px solid rgba(255,255,255,.12);min-height:2.2rem;font-weight:700;font-size:.85rem}#p3 .m{font-size:.74rem;color:rgba(255,255,255,.65);line-height:1.6}#p3 .p3-up{border:1.5px dashed rgba(255,255,255,.3);border-radius:12px;padding:.7rem;text-align:center;cursor:pointer;font-size:.8rem}#p3 .p3-up:hover{border-color:#c6fe17}';
  const ctl = (k, label, type, extra) => '<label class="f">' + label + '</label><input data-k="' + k + '" type="' + type + '" ' + (extra || "") + ' value="' + (type === "color" || type === "range" || type === "number" ? esc(S[k]) : "") + '">';
  const sel = (k, label, opts, cur) => '<label class="f">' + label + '</label><select data-k="' + k + '">' + opts.map(o => '<option value="' + o[0] + '"' + (String(cur == null ? S[k] : cur) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
  const rng = (k, label, mn, mx, st, val) => '<label class="f">' + label + '</label><input data-k="' + k + '" type="range" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + val + '">';
  const deg = v => Math.round(v * 180 / Math.PI);
  function tail() {
    return '<h4>③ العرض والخلفية</h4>' + sel("bgMode", "الخلفية", [["linear", "تدرّج عمودي"], ["radial", "تدرّج دائري"], ["solid", "لون واحد"], ["none", "شفافة"]]) + '<div class="r2"><div>' + ctl("bg1", "اللون الأول", "color") + "</div><div>" + ctl("bg2", "اللون الثاني", "color") + "</div></div>" +
      rng("yaw", "التدوير (°)", 0, 360, 1, ((deg(S.yaw) % 360) + 360) % 360) + rng("pitch", "الإمالة الأمامية (°)", -50, 50, 1, deg(S.pitch)) + rng("tilt", "ميل جانبي (°)", -60, 60, 1, deg(S.tilt)) + rng("zoom", "التقريب", 0.5, 2.4, 0.01, S.zoom) +
      '<div class="r2"><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-k="auto"' + (S.auto ? " checked" : "") + '> دوران تلقائي</label><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-k="shadow"' + (S.shadow ? " checked" : "") + '> ظل تحت العبوة</label></div>' +
      '<div class="p3-b"><button type="button" class="o" data-view="front">أمامي</button><button type="button" class="o" data-view="q">¾</button><button type="button" class="o" data-view="side">جانبي</button><button type="button" class="o" data-view="back">خلفي</button><button type="button" class="o" data-view="tilt">مائل</button></div>' +
      '<h4>④ التصدير</h4>' + sel("size", "المقاس", SIZES.map((s, i) => [i, s[0]])) + '<div class="r2"><div>' + sel("fmt", "الصيغة", [["png", "PNG"], ["webp", "WebP"]]) + "</div><div>" + ctl("q", "جودة WebP", "number", 'min="40" max="100"') + '</div></div><label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-k="transparent"' + (S.transparent ? " checked" : "") + '> خلفية شفافة في الصورة المصدَّرة</label>' +
      '<div class="p3-b"><button type="button" data-ex="one">⬇ تصدير الصورة</button><button type="button" class="o" data-ex="angles">4 زوايا (ZIP)</button><button type="button" class="o" data-ex="r12">360° — 12 إطاراً</button><button type="button" class="o" data-ex="r24">360° — 24 إطاراً</button><button type="button" data-ex="studio" style="flex:1 1 100%">🎨 إرسال الزوايا إلى ستوديو ديزاين</button></div><p class="m">اسحب على المجسّم لتدويره، وبالعجلة للتقريب، ونقرتان لإعادة الضبط. جرّب الخلفية الشفافة للصق الصورة فوق تصاميمك.</p>';
  }
  function netPanel() {
    const N = BOX.n, solid = N.mode === "solid", prism = solid && N.solid.kind === "prism", cb = !solid ? BOX.bounds(N, 1) : null;
    const dim = solid ? (prism ? Math.round(Math.max(...N.solid.outline.map(q => q[0])) - Math.min(...N.solid.outline.map(q => q[0]))) + "×" + Math.round(Math.max(...N.solid.outline.map(q => q[1])) - Math.min(...N.solid.outline.map(q => q[1]))) + "×" + Math.round(N.solid.H) : Math.round(N.solid.rb * 2) + "×" + Math.round(N.solid.H)) : cb.size.map(v => Math.round(v)).join("×");
    return '<h4>① ' + esc(N.name) + '</h4><p class="m">' + (solid ? "مجسّم يمثّل العلبة المغلقة (الجسم والغطاء)؛ القالب المسطّح يُقصّ ويُطوى بالشكل نفسه." : "تُطوى وجوه القالب المسطّح تلقائياً حول خطوط الثني لتشكّل العلبة المغلقة.") + ' الأبعاد التقريبية ' + dim + ' مم.' + (N.dropped ? " (أجنحة اللصق المنفصلة لا تظهر في العرض.)" : "") + (N.rule === "milk" || N.key === "bag" ? " ⚠️ هذا القالب تقريبي في العرض ثلاثي الأبعاد: جوانبه المطوية تُطوى بزاوية قائمة فقط." : "") + "</p>" +
      (!solid || prism ? rng("fold", solid ? "فتح / إغلاق الغطاء" : "طيّ / فتح القالب", 0, 1, 0.01, S.fold) + '<div class="p3-b"><button type="button" data-act="foldplay">▶ ' + (solid ? "حركة الإغلاق" : "حركة الطيّ") + '</button><button type="button" class="o" data-act="unfold">' + (solid ? "رفع الغطاء" : "فتح القالب") + '</button><button type="button" class="o" data-act="foldclose">إغلاق العلبة</button></div>' : "") +
      '<h4>② اللون والتصميم</h4><div class="r2"><div><label class="f">لون الورق</label><input type="color" data-bc value="' + esc(BOX.color || "#f1ece0") + '"></div><div></div></div>' +
      (!solid ? '<label class="f">تصميم يُطبع على القالب المسطّح (يُمدّ على كامل الورقة)</label><label class="p3-up" for="p3-bart">' + (BOX.art ? "✔ تم رفع التصميم — استبدله" : "⬆ ارفع صورة التصميم") + '<input id="p3-bart" type="file" accept="image/*" hidden></label>' + (BOX.art ? '<div class="p3-b"><button type="button" class="o" data-act="bartclear">إزالة التصميم</button></div>' : "") : "") +
      '<div class="p3-b"><button type="button" class="o" data-act="backbd">↩ العودة إلى قوالب العلب</button></div>' + sel("boxFin", "طلاء الورق", [["gloss", "لامع"], ["matte", "مطفي"], ["soft", "ورق ناعم"]]) + tail();
  }
  function boxPanel() {
    if (BOX.n) return netPanel();
    return '<h4>① العلبة المصمَّمة (Box Designer)</h4><p class="m">الأبعاد ' + Math.round(BOX.W) + '×' + Math.round(BOX.H) + '×' + Math.round(BOX.D) + ' مم. تُطوى وجوه القالب تلقائياً لتشكّل العلبة بتصميمك ونصوصك ومواضعها.</p>' + rng("fold", "طيّ / فتح القالب", 0, 1, 0.01, S.fold) +
      '<div class="p3-b"><button type="button" data-act="foldplay">▶ حركة الطيّ</button><button type="button" class="o" data-act="unfold">فتح القالب</button><button type="button" class="o" data-act="foldclose">إغلاق العلبة</button><button type="button" class="o" data-act="backbd">↩ Box Designer</button></div>' +
      sel("boxFin", "طلاء الورق", [["gloss", "لامع"], ["matte", "مطفي"], ["soft", "ورق ناعم"]]) + tail();
  }
  function panel() {
    if (S.type === "dbox" && BOX) return boxPanel();
    const q = S.ql, glass = S.bodyFin === "glass";
    return '<h4>① العبوة والملصق</h4><div class="types">' + TYPES.map(t => '<button type="button" data-type="' + t[0] + '" class="' + (S.type === t[0] ? "on" : "o") + '">' + t[1] + "</button>").join("") + '</div>' +
      (S.type === "photo" ? '<label class="f">① ارفع صورة القارورة (2D) لتحويلها إلى 3D</label><label class="p3-up" for="p3-photo">' + (photo ? "✔ تحوّلت الصورة — استبدلها بصورة أخرى" : "⬆ صورة القارورة PNG/JPG — يُفضَّل بخلفية بيضاء أو شفافة وبلا ظل") + '<input id="p3-photo" type="file" accept="image/*" hidden></label><p class="m">تُستخرج الصورة الظلّية للقارورة وتُدوَّر حول محورها لتكوين المجسّم بلونها وشكلها، ثم يُركَّب ملصقك عليها.</p>' : "") +
      '<label class="f">صورة الملصق / تصميم العبوة</label><label class="p3-up" for="p3-art">⬆ ارفع تصميمك (PNG/WebP/JPG — يُفضَّل بخلفية شفافة أو بنسبة الملصق)<input id="p3-art" type="file" accept="image/*" hidden></label>' +
      '<div class="p3-b"><button type="button" class="' + (S.useQuick ? "on" : "o") + '" data-act="quick">ملصق سريع</button>' + (art ? '<button type="button" class="' + (!S.useQuick ? "on" : "o") + '" data-act="art">ملصقي المرفوع</button>' : "") + (typeof Admin !== "undefined" && Admin.products && Admin.products.length ? '<button type="button" class="o" data-act="prod">من صور منتج</button>' : "") + "</div><div id=\"p3-prod\"></div>" +
      (S.useQuick ? '<label class="f">اسم العلامة</label><input data-q="name" value="' + esc(q.name) + '"><label class="f">وصف قصير</label><input data-q="sub" value="' + esc(q.sub) + '"><div class="r2"><div><label class="f">الحجم</label><input data-q="vol" value="' + esc(q.vol) + '"></div><div><label class="f">لون الحبر</label><input data-q="ink" type="color" value="' + q.ink + '"></div><div><label class="f">لون العلامة</label><input data-q="c1" type="color" value="' + q.c1 + '"></div><div><label class="f">خلفية الملصق</label><input data-q="c2" type="color" value="' + q.c2 + '"></div></div>' : "") +
      '<label class="f">صورة العبوة الأصلية (اختياري: تلتقط ألوانها)</label><label class="p3-up" for="p3-orig">⬆ ارفع صورة عبوتك لالتقاط لون العبوة والغطاء<input id="p3-orig" type="file" accept="image/*" hidden></label>' + (orig ? '<div class="p3-b"><button type="button" class="o" data-act="origlabel">استعمل هذه الصورة كملصق</button></div>' : "") +
      sel("wrap", "تركيب الملصق", [["fit", "بنسبته الطبيعية بلا تشويه"], ["full", "يغطي المحيط كاملاً"]]) + rng("lsize", "حجم الملصق", 0.3, 1.4, 0.01, S.lsize) + rng("lpos", "الموضع الرأسي", -1, 1, 0.01, S.lpos) + rng("lrot", "الدوران حول العبوة", -3.14, 3.14, 0.01, S.lrot) +
      (S.type === "box" ? '<label style="display:flex;gap:.4rem;align-items:center;margin-top:.4rem"><input type="checkbox" data-k="both"' + (S.both ? " checked" : "") + '> نفس التصميم على الوجه الخلفي</label>' : "") +
      (S.type === "photo" ? "" : '<h4>② الألوان والخامة</h4><div class="r2"><div>' + ctl("body", "لون العبوة", "color") + '</div><div>' + ctl("cap", "لون الغطاء", "color") + "</div><div>" + sel("bodyFin", "خامة العبوة", FIN) + "</div><div>" + sel("capFin", "خامة الغطاء", CAPFIN) + "</div></div>" +
      (glass && S.type !== "box" ? '<div class="r2"><div>' + ctl("liquid", "لون السائل", "color") + "</div><div>" + rng("fill", "مستوى السائل", 0.1, 1, 0.01, S.fill) + "</div></div>" : "")) +
      tail();
  }
  const GEO_KEYS = ["wrap", "lsize", "lpos", "lrot", "both"], MAT_KEYS = ["body", "cap", "bodyFin", "capFin", "liquid", "fill"];
  function ui() { const side = $("p3-side"); if (!side) return; side.innerHTML = panel(); wire(); }
  function wire() {
    const side = $("p3-side");
    side.querySelectorAll("[data-k]").forEach(e => { const h = () => { const k = e.dataset.k; let v = e.type === "checkbox" ? e.checked : e.type === "range" || e.type === "number" ? +e.value : e.value; if (k === "yaw" || k === "pitch" || k === "tilt") v = v * Math.PI / 180; S[k] = v; save(); if (k === "fold") { applyFold(S.fold); } else if (k === "boxFin") { build(); } else if (GEO_KEYS.includes(k) || MAT_KEYS.includes(k)) { build(); if (k === "bodyFin") ui(); } else if (k === "bgMode") { paintBg(); dirty = true; } else view(); }; e.oninput = h; e.onchange = h; });
    side.querySelectorAll("[data-q]").forEach(e => { e.oninput = () => { S.ql[e.dataset.q] = e.value; save(); clearTimeout(wire.t); wire.t = setTimeout(() => { if (S.useQuick) build(); }, 120); }; });
    side.querySelectorAll("[data-type]").forEach(b => b.onclick = () => { S.type = b.dataset.type; if (S.type === "glass" && S.bodyFin === "gloss") S.bodyFin = "glass"; if (S.type !== "glass" && S.bodyFin === "glass" && S.type !== "jar" && S.type !== "bottle") S.bodyFin = "gloss"; save(); ui(); build(); });
    side.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { const v = b.dataset.view; const P = { front: [0, 0.06, 0], q: [-0.6, 0.12, 0], side: [-Math.PI / 2, 0.06, 0], back: [Math.PI, 0.06, 0], tilt: [-0.55, 0.1, -0.5] }[v]; S.yaw = P[0]; S.pitch = P[1]; S.tilt = P[2]; save(); ui(); view(); });
    side.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { const v = b.dataset.ex; if (v === "studio") sendToStudio(); else if (v === "one") exportOne(); else if (v === "angles") exportAngles(); else export360(v === "r12" ? 12 : 24); });
    side.querySelectorAll("[data-act]").forEach(b => b.onclick = () => { const a = b.dataset.act; if (a === "quick") { S.useQuick = true; ui(); build(); } else if (a === "art") { S.useQuick = false; ui(); build(); } else if (a === "origlabel") useOrigAsLabel(); else if (a === "prod") prodList(); else if (a === "foldplay") { S.fold = 0; applyFold(0); foldTo(1); } else if (a === "unfold") foldTo(0); else if (a === "foldclose") foldTo(1); else if (a === "backbd") close(); else if (a === "bartclear") { BOX.art = null; ui(); build(); } });
    const bc = side.querySelector("[data-bc]"); if (bc) bc.oninput = () => { BOX.color = bc.value; build(); };
    const ba = $("p3-bart"); if (ba) ba.onchange = () => { const f = ba.files[0]; if (!f) return; const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); BOX.art = cv; ui(); build(); }; im.onerror = () => msg("تعذّر قراءة الصورة", true); im.src = u; };
    const fph = $("p3-photo"); if (fph) fph.onchange = () => fph.files[0] && setPhoto(fph.files[0]); const fa = $("p3-art"); if (fa) fa.onchange = () => fa.files[0] && setArt(fa.files[0]); const fo = $("p3-orig"); if (fo) fo.onchange = () => fo.files[0] && setOrig(fo.files[0]);
  }
  function prodList() {
    const box = $("p3-prod"); const ps = (typeof Admin !== "undefined" && Admin.products) || []; box.innerHTML = '<select id="p3-ps"><option value="">— اختر منتجاً —</option>' + ps.filter(p => p.cover).map(p => '<option value="' + esc(p.cover) + '">' + esc(p.title || p.slug) + "</option>").join("") + "</select>";
    $("p3-ps").onchange = e => { if (e.target.value) setArt(new URL(e.target.value, document.baseURI).href); };
  }
  function close() { opened = false; if (escH) { document.removeEventListener("keydown", escH); escH = null; } cancelAnimationFrame(foldRaf); foldNodes = null; if (S.type === "dbox") { S.type = S.prevType || "bottle"; save(); } cancelAnimationFrame(raf); raf = 0; if (R) { try { R.dispose(); R.forceContextLoss(); } catch (e) { } R = null; } if (packG) { disposeGroup(packG); packG = null; } scene = null; const b = $("p3-bg"); if (b) b.remove(); stage = null; }
  async function open() { BOX = null; if (S.type === "dbox") S.type = S.prevType || "bottle"; return openDlg(); }
  async function openBox(m) { BOX = m; if (S.type !== "dbox") S.prevType = S.type; S.type = "dbox"; S.fold = 1; S.auto = false; const r = await openDlg(); if (m && m.n && m.n.mode === "net" && R && packG) { S.fold = 0; applyFold(0); sync("fold"); setTimeout(() => { if (opened) foldTo(1); }, 500); } return r; }
  async function openDlg() {
    close(); if (BOX && S.type !== "dbox") { S.prevType = S.type; S.type = "dbox"; } const bg = document.createElement("div"); bg.id = "p3-bg"; if (!$("p3-css")) { const st = document.createElement("style"); st.id = "p3-css"; st.textContent = CSS; document.head.appendChild(st); }
    bg.innerHTML = '<div id="p3" role="dialog" aria-label="Alyssum 3D Pack Studio"><div class="p3-h"><b>🧊 Alyssum 3D Pack Studio</b><small>ركّب ملصقك على عبوة ثلاثية الأبعاد وصدّر صوراً احترافية</small><button type="button" class="o p3-x" id="p3-x">إغلاق</button></div><div class="p3-m"><div class="p3-st" id="p3-st"><span class="p3-3d">3D</span><span class="p3-hint">اسحب للتدوير • العجلة للتقريب • نقرتان لإعادة الضبط</span></div><div class="p3-side" id="p3-side"></div></div><div class="p3-f" id="p3-msg">جارٍ تحميل المحرّك ثلاثي الأبعاد…</div></div>';
    document.body.appendChild(bg); opened = true; stage = $("p3-st"); $("p3-x").onclick = close; bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
    escH = e => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", escH);
    try { const hasGL = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })(); if (!hasGL) throw new Error("متصفحك أو جهازك لا يدعم WebGL المطلوب للعرض ثلاثي الأبعاد"); await init(stage); if (!opened) return; bindStage(stage); ui(); msg("جاهز — ارفع ملصقك أو عدّل الملصق السريع"); } catch (e) { msg("⚠️ " + e.message, true); }
  }
  return { open, openBox, close, TYPES, FIN, SIZES, S, _t: { boxGroup, setPhotoFromImage, hasPhoto: () => !!photo, sendToStudio, artCanvas: () => art, applyFold, foldTo, spec: type => { return spec(type); }, build, renderTo, get ready() { return !!R; }, setArt, quickLabel, pickColors, view, loadThree, blobOf } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Pack3D;
