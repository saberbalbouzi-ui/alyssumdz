/* Magic Layers — تفكيك أي صورة إلى طبقات مستقلة قابلة للتحريك والتصدير (في «ستوديو ديزاين»).
   مبنية على ملف Magic Layers المرجعي (واجهة المحرّر والتصدير) مع توسيع الاستخراج ليشمل كل العناصر لا 20 فقط ولو كانت الخلفية معقّدة:
   • مرور شامل للصورة كاملة، ثم تجزئتها إلى مربعات متداخلة (2×2 أو 3×3) تُرسل كل واحدة بدقة أعلى فتظهر العناصر الصغيرة والنصوص،
     ثم مرورات «متبقٍّ» تُعطى فيها القائمة الموجودة ويُطلب ما فاتها فقط، ثم دمج التكرار (تقاطع الصناديق + النص نفسه).
   • أقنعة العناصر: نموذج SAM المحلي إن توفّر (AIVision: كل صندوق يعطي قناعاً دقيقاً)، وإلا مضلّع Alyssum API، وإلا مفتاح اللون للنصوص، وإلا مستطيل.
   • الخلفية: الصورة الأصلية، أو ترميم محلي (MI-GAN) بعد إزالة العناصر، أو ترميم Alyssum API.
   • التصدير: ZIP (PNG لكل طبقة بحجم الصفحة + manifest.json)، الصورة المركّبة، أو «إرسال إلى المطوّر» كعناصر صور حرة في لوحة بمقاس الصورة.
   الدوال النقية في MagicLayers._t (تُختبر بلا واجهة). */
const MagicLayers = (() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const S = { src: null, blob: null, W: 0, H: 0, layers: [], sel: null, scale: 1, nextId: 1, run: null, busy: false, log: "", open: false };
  const LSK = "alyssum_ml_opts", COVER = { fast: { grid: 0, rounds: 1 }, dense: { grid: 2, rounds: 2 }, max: { grid: 3, rounds: 3 } };
  const O = { max: 80, cover: "dense", local: true, api: true, bg: "auto", ctx: "", realText: true };
  try { Object.assign(O, JSON.parse(localStorage.getItem(LSK) || "{}")); } catch (e) { }
  const saveO = () => { try { localStorage.setItem(LSK, JSON.stringify(O)); } catch (e) { } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = m => { try { (typeof Admin !== "undefined" && Admin.toast ? Admin.toast : typeof toast2 === "function" ? toast2 : m2 => console.log(m2))(m); } catch (e) { } };
  const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || "image/png", q));
  const slug = s => (s || "calque").normalize("NFKD").replace(/[^\w؀-ۿ\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "calque";
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const abortErr = () => { const e = new Error("أُلغيت العملية"); e.name = "AbortError"; return e; };
  const chk = () => { if (S.run && S.run.cancelled) throw abortErr(); };

  /* ═══════════════ دوال نقية (تُختبر بلا واجهة) ═══════════════ */
  /* صناديق [x0,y0,x1,y1] بالبكسل */
  const bArea = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const bInter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const iou = (a, b) => { const i = bInter(a, b), u = bArea(a) + bArea(b) - i; return u > 0 ? i / u : 0; };
  /* مربعات التجزئة: شبكة g×g بتداخل 14%؛ الصور الصغيرة لا تستفيد فلا تُجزَّأ */
  function tilesFor(W, H, g) {
    if (!g || Math.max(W, H) < 640) return [];
    const ov = .14, tw = W / (g - (g - 1) * ov), th = H / (g - (g - 1) * ov), out = [];
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const x = Math.min(W - tw, i * tw * (1 - ov)), y = Math.min(H - th, j * th * (1 - ov));
      out.push({ x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), w: Math.min(W, Math.round(tw)), h: Math.min(H, Math.round(th)), i, j, g });
    }
    return out;
  }
  /* تحليل ردّ النموذج: JSON سليم، أو مقطوع (نلتقط الكائنات الكاملة)، أو متهالك (نلتقط box_2d وlabel) */
  function extractLoose(t) {
    const parts = t.split(/"box_2d"\s*:/).slice(1), out = [];
    parts.forEach((p, i) => {
      const m = p.match(/^\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/); if (!m) return;
      const it = { box_2d: [+m[1], +m[2], +m[3], +m[4]], label: "عنصر " + (i + 1) };
      const lab = p.match(/"label"\s*:\s*"((?:[^"\\]|\\.)*)"/); if (lab) it.label = lab[1];
      const kd = p.match(/"kind"\s*:\s*"(\w+)"/); if (kd) it.kind = kd[1];
      const mk2 = p.match(/"mask"\s*:\s*(\[\s*\[[\s\S]*?\]\s*\])/); if (mk2) { try { it.mask = JSON.parse(mk2[1]); } catch (e) { } }
      out.push(it);
    });
    return out;
  }
  function parseItems(text) {
    let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""), j;
    if (!t) return [];
    try { j = JSON.parse(t); } catch (e) {
      try { const m = t.match(/[\[{][\s\S]*[\]}]/); if (!m) throw e; j = JSON.parse(m[0]); } catch (e2) {
        const objs = [], stack = []; let inStr = false, esc2 = false;
        for (let i = 0; i < t.length; i++) {
          const ch = t[i];
          if (inStr) { if (esc2) esc2 = false; else if (ch === "\\") esc2 = true; else if (ch === '"') inStr = false; continue; }
          if (ch === '"') { inStr = true; continue; }
          if (ch === "{") stack.push(i);
          else if (ch === "}" && stack.length) { const s = stack.pop(); try { const o = JSON.parse(t.slice(s, i + 1)); if (o && o.box_2d) objs.push(o); } catch (e3) { } }
        }
        const lo = extractLoose(t); j = objs.length >= lo.length ? objs : lo;
      }
    }
    const objs = a => (Array.isArray(a) ? a : []).filter(x => x && typeof x === "object" && !Array.isArray(x));
    let arr = objs(j); if (!arr.length && j && typeof j === "object") arr = objs(j.boxes || j.items || j.segments || j.elements || j.masks || Object.values(j).find(v => objs(v).length));
    if (!arr.length) arr = extractLoose(t);
    return arr;
  }
  /* عنصر خام من النموذج ← عنصر بإحداثيات الصورة الكاملة (مربع التجزئة tile = {x,y,w,h} أو الصورة كلها) */
  function norm(it, tile, W, H) {
    const b = it && it.box_2d; if (!Array.isArray(b) || b.length < 4 || b.some(v => !isFinite(+v))) return null;
    const [ya, xa, yb, xb] = b.map(Number), tx = tile.x, ty = tile.y, tw = tile.w, th = tile.h;
    const x0 = Math.max(0, Math.floor(tx + Math.min(xa, xb) / 1000 * tw)), x1 = Math.min(W, Math.ceil(tx + Math.max(xa, xb) / 1000 * tw));
    const y0 = Math.max(0, Math.floor(ty + Math.min(ya, yb) / 1000 * th)), y1 = Math.min(H, Math.ceil(ty + Math.max(ya, yb) / 1000 * th));
    if (x1 - x0 < 4 || y1 - y0 < 4) return null;
    let poly = null;
    if (Array.isArray(it.mask) && it.mask.length >= 3) {
      const pts = it.mask.filter(p => Array.isArray(p) && p.length >= 2 && isFinite(+p[0]) && isFinite(+p[1])).map(p => [+p[0], +p[1]]);
      if (pts.length >= 3) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), bx0 = Math.min(xa, xb), bx1 = Math.max(xa, xb), by0 = Math.min(ya, yb), by1 = Math.max(ya, yb), bw = Math.max(1, bx1 - bx0), bh = Math.max(1, by1 - by0);
        /* إحداثيات الصورة كلها أم نسبة إلى الصندوق؟ نقارن امتداد المضلّع بالصندوق */
        const global = Math.min(...xs) >= bx0 - .2 * bw && Math.max(...xs) <= bx1 + .2 * bw && Math.min(...ys) >= by0 - .2 * bh && Math.max(...ys) <= by1 + .2 * bh;
        poly = pts.map(p => global ? [tx + p[0] / 1000 * tw, ty + p[1] / 1000 * th] : [x0 + p[0] / 1000 * (x1 - x0), y0 + p[1] / 1000 * (y1 - y0)]);
      }
    }
    const kind = /text|نص/i.test(it.kind || "") ? "text" : /person|people|شخص/i.test(it.kind || "") ? "person" : /graphic|shape|logo|icon/i.test(it.kind || "") ? "graphic" : "object";
    /* مقطوع بحافة مربع داخلية (لا بحافة الصورة): جزء من عنصر أكبر غالباً */
    const m = Math.max(3, .015 * Math.min(tw, th)), cut = (x0 <= tx + m && tx > 0) || (y0 <= ty + m && ty > 0) || (x1 >= tx + tw - m && tx + tw < W) || (y1 >= ty + th - m && ty + th < H);
    return { box: [x0, y0, x1, y1], label: String(it.label || "عنصر").trim().slice(0, 60) || "عنصر", kind, poly, cut: !!(cut && (tile.x > 0 || tile.y > 0 || tile.w < W || tile.h < H)) };
  }
  const normTxt = s => String(s || "").toLowerCase().replace(/[\sً-ٟ"'.,;:!?\-_]+/g, "");
  /* دمج التكرار بين المرورات: الأولى أولى (القائمة مرتّبة بالأولوية) */
  function dedupe(list) {
    const out = [];
    for (const it of list) {
      let dup = false;
      for (const k of out) {
        const i = iou(it.box, k.box), a = bArea(it.box), b = bArea(k.box), inter = bInter(it.box, k.box), small = Math.min(a, b), ratio = small / Math.max(a, b, 1);
        if (i > .55) { dup = true; break; }
        if (it.kind === "text" && k.kind === "text" && i > .15 && normTxt(it.label) && normTxt(it.label) === normTxt(k.label)) { dup = true; break; }
        if (inter / Math.max(small, 1) > .88 && (ratio >= .6 || (a < b && it.cut))) { dup = true; break; }
        if (it.kind === "text" && k.kind === "text" && inter / Math.max(small, 1) > .8) { dup = true; break; }
      }
      if (!dup) out.push(it);
    }
    return out;
  }
  /* قناع مضلّع داخل الصندوق */
  function polyMask(poly, box) {
    const w = box[2] - box[0], h = box[3] - box[1], c = mk(w, h), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.beginPath(); poly.forEach((p, i) => { const X = p[0] - box[0], Y = p[1] - box[1]; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill();
    return c;
  }
  /* تنعيم خفيف لحافة القناع (فلتر canvas إن وُجد) */
  function soften(c) {
    try { const o = mk(c.width, c.height), g = o.getContext("2d"); if (!("filter" in g)) return c; g.filter = "blur(" + Math.max(.6, Math.min(2, Math.max(c.width, c.height) / 400)) + "px)"; g.drawImage(c, 0, 0); return o; } catch (e) { return c; }
  }
  /* نصوص وعناصر على خلفية بسيطة: لون الخلفية من حافة الصندوق ثم شفافية بقدر البعد اللوني */
  function keyOut(c, tol) {
    const w = c.width, h = c.height, g = c.getContext("2d", { willReadFrequently: true }), d = g.getImageData(0, 0, w, h), px = d.data, hist = new Map();
    const take = (x, y) => { const i = (y * w + x) * 4, k = (px[i] >> 4) * 256 + (px[i + 1] >> 4) * 16 + (px[i + 2] >> 4); const v = hist.get(k) || [0, 0, 0, 0]; v[0]++; v[1] += px[i]; v[2] += px[i + 1]; v[3] += px[i + 2]; hist.set(k, v); };
    for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1); } for (let y = 1; y < h - 1; y++) { take(0, y); take(w - 1, y); }
    let best = null; hist.forEach(v => { if (!best || v[0] > best[0]) best = v; });
    const br = best[1] / best[0], bg = best[2] / best[0], bb = best[3] / best[0], t0 = tol == null ? 22 : tol; let clear = 0;
    for (let i = 0; i < px.length; i += 4) {
      const dist = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb), a = Math.max(0, Math.min(1, (dist - t0) / 42)); px[i + 3] = Math.round(px[i + 3] * a); if (a < .05) clear++;
    }
    g.putImageData(d, 0, 0); return { canvas: c, clear: clear / (w * h), bg: [Math.round(br), Math.round(bg), Math.round(bb)] };
  }
  /* تقدير خصائص النص الحقيقي من قصاصته: لون الحبر (متوسط البكسلات الكثيفة) وحجم الخط (يلائم عرض الصندوق وارتفاعه) واللغة */
  function textProps(text, canvas) {
    const lines = String(text || "").split(/\n/).filter(x => x.length), rtl = /[\u0590-\u08ff]/.test(text || ""), w = canvas.width, h = canvas.height;
    const g = canvas.getContext("2d", { willReadFrequently: true }), d = g.getImageData(0, 0, w, h).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    const hex = v => ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2), color = n ? "#" + hex(r / n) + hex(gg / n) + hex(b / n) : "#111111";
    const m = mk(1, 1).getContext("2d"), L = Math.max(1, lines.length); let fs = Math.max(8, Math.floor(h / L / (rtl ? 1.4 : 1.2)));
    m.font = "700 " + fs + "px Cairo, Arial, sans-serif"; const mw = Math.max(1, ...lines.map(l => m.measureText(l).width)); if (mw > w * 1.02) fs = Math.max(8, Math.floor(fs * w / mw));
    return { color, fs, rtl, lines: L };
  }
  const alphaMask = c => { const w = c.width, h = c.height, d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 12) m[i] = 1; return m; };

  /* ═══════════════ ZIP (بلا ضغط) ═══════════════ */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], central = [], d = new Date(); let offset = 0;
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const nb = enc.encode(f.name), crc = crc32(f.data), size = f.data.length, lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, nb.length, true);
      parts.push(lh.buffer, nb, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, nb); offset += 30 + nb.length + size;
    }
    const cd = central.reduce((a, b) => a + (b.byteLength != null ? b.byteLength : b.length), 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
  }
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  /* ═══════════════ الاستخراج ═══════════════ */
  const hasKey = () => { try { return !!(localStorage.getItem("alyssum_gp_gkey") || "").trim() && localStorage.getItem("alyssum_ai_text") !== "0"; } catch (e) { return false; } };
  const localOk = () => typeof AIVision !== "undefined" && AIVision.supported && AIVision.supported();
  const say = (m, kind, spin) => { S.status = m; const s = $("ml-st"); if (!s) return; s.className = kind || ""; s.textContent = ""; if (spin) { const d = document.createElement("i"); d.className = "ml-spin"; s.appendChild(d); } const t = document.createElement("span"); t.textContent = m || ""; s.appendChild(t); };

  const DETECT = (n, ctx, tile, listed) =>
    "Find EVERY distinct visual element in this image so that each one can become its own editable layer. Be exhaustive: people (the whole person), animals, products and packaging, objects, food, plants, furniture, vehicles, buildings or distinct parts of a scene, logos, icons, stickers, illustrations, decorative shapes, photos or screenshots placed inside the layout, interface components, and EVERY separate line or block of text (use the exact text as its label). " +
    "Small items, partly hidden items, and items on busy, textured or photographic backgrounds all count. When objects overlap, give each one its own entry covering its visible part. Do NOT output the plain backdrop itself (sky, wall, floor, solid color or gradient fill), and never output one entry that merely groups several others. " +
    (tile ? "This image is a zoomed crop of a larger picture: list only what is visible here, and skip an element that is cut by the crop edge unless at least half of it is visible. " : "") +
    "Return at most " + n + " entries, the most prominent first, as a compact JSON array with no commentary. Each entry: \"box_2d\": [ymin, xmin, ymax, xmax] normalized to 0-1000; \"label\": a short label; \"kind\": one of person, object, text, graphic; " +
    "\"mask\": the outline of the element as a polygon of at most 28 [x, y] points normalized to 0-1000 over this whole image (omit it for text)." +
    (ctx ? " Context about the image: " + ctx : "") +
    (listed && listed.length ? " ALREADY FOUND (do not repeat these; return ONLY elements that are still missing, and return [] if nothing is missing): " + listed.slice(0, 160).map(l => l.label + " " + JSON.stringify(l.b)).join("; ") : "");

  async function askModel(prompt, blob) {
    if (typeof ImgGen === "undefined" || !ImgGen.text) throw new Error("خدمة النص غير متاحة");
    const t = await ImgGen.text({ prompt, blobs: [blob], temp: .1, maxTokens: 16384 });
    return parseItems(t);
  }
  async function cropBlob(x, y, w, h, maxEdge) {
    const k = Math.min(1, maxEdge / Math.max(w, h)), c = mk(w * k, h * k), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(S.src, x, y, w, h, 0, 0, c.width, c.height);
    return toBlob(c, "image/jpeg", .9);
  }
  const listed = items => items.map(i => ({ label: i.label, b: [Math.round(i.box[1] / S.H * 1000), Math.round(i.box[0] / S.W * 1000), Math.round(i.box[3] / S.H * 1000), Math.round(i.box[2] / S.W * 1000)] }));
  /* الكشف الكامل بـ Alyssum API: صورة كاملة ← مربعات ← مرورات المتبقي. يُرجع { items, stats } */
  async function detectApi(opt) {
    const W = S.W, H = S.H, cfg = COVER[opt.cover] || COVER.dense, stats = { full: 0, tiles: 0, extra: [], errors: [], calls: 0 };
    let all = [], firstErr = null;
    const note = e => { stats.errors.push(e.message || String(e)); if (!firstErr) firstErr = e; if (e.code === "NOKEY" || e.code === "OFF" || /رصيد|credit|quota|حصة|Quota|\b429\b/i.test(e.message || "")) throw e; };
    const per = Math.max(20, Math.min(60, opt.max));
    /* 1) الصورة كاملة */
    say("Alyssum API تحلّل الصورة كاملة…", "", true);
    try { stats.calls++; const blob = await cropBlob(0, 0, W, H, 1600), r = await askModel(DETECT(per, opt.ctx, false, null), blob); chk(); const ns = r.map(i => norm(i, { x: 0, y: 0, w: W, h: H }, W, H)).filter(Boolean); all = dedupe(ns); stats.full = all.length; } catch (e) { if (e.name === "AbortError") throw e; note(e); }
    /* 2) مربعات متداخلة بدقة أعلى (اثنان معاً) */
    const tiles = tilesFor(W, H, cfg.grid);
    for (let i = 0; i < tiles.length; i += 2) {
      chk(); const grp = tiles.slice(i, i + 2); say("تجزئة الصورة (" + Math.min(i + grp.length, tiles.length) + "/" + tiles.length + ") لالتقاط الصغير والمتداخل…", "", true);
      const res = await Promise.all(grp.map(async t => {
        try { stats.calls++; const blob = await cropBlob(t.x, t.y, t.w, t.h, 1400), r = await askModel(DETECT(per, opt.ctx, true, null), blob); return r.map(it => norm(it, t, W, H)).filter(Boolean); } catch (e) { if (e.name === "AbortError") throw e; note(e); return []; }
      }));
      chk(); const before = all.length; all = dedupe(all.concat(res.flat())); stats.tiles += all.length - before;
    }
    /* 3) مرورات المتبقي: نعطيه ما وُجد ونطلب ما فات */
    for (let r = 0; r < cfg.rounds && all.length < opt.max; r++) {
      chk(); say("مرور المتبقي " + (r + 1) + "/" + cfg.rounds + " (وُجد " + all.length + ")…", "", true);
      let add = [];
      try { stats.calls++; const blob = await cropBlob(0, 0, W, H, 1600), rr = await askModel(DETECT(per, opt.ctx, false, listed(all)), blob); add = rr.map(it => norm(it, { x: 0, y: 0, w: W, h: H }, W, H)).filter(Boolean); } catch (e) { if (e.name === "AbortError") throw e; note(e); }
      const before = all.length; all = dedupe(all.concat(add)); const gain = all.length - before; stats.extra.push(gain); if (gain < 2) break;
    }
    if (!all.length && firstErr) throw firstErr;
    return { items: all.slice(0, opt.max), stats };
  }

  /* بناء طبقة من عنصر + قناعه */
  function layerFrom(it, mask, src) {
    const [x0, y0, x1, y1] = it.box, w = x1 - x0, h = y1 - y0, c = mk(w, h), g = c.getContext("2d");
    g.drawImage(S.src, x0, y0, w, h, 0, 0, w, h);
    if (mask) { g.globalCompositeOperation = "destination-in"; g.drawImage(mask, 0, 0); g.globalCompositeOperation = "source-over"; }
    return { canvas: c, x: x0, y: y0, w, h, name: it.label, kind: it.kind, how: src, area: w * h };
  }
  async function layerFromApi(it) {
    if (it.kind === "text") {
      const l = layerFrom(it, null, "text"), r = keyOut(l.canvas); if (r.clear > .97) { const l2 = layerFrom(it, null, "rect"); return l2; }
      if (it.label && !/^عنصر( \d+)?$/.test(it.label)) { l.text = it.label; l.tp = textProps(it.label, l.canvas); }
      return l;
    }
    if (it.poly) return layerFrom(it, soften(polyMask(it.poly, it.box)), "poly");
    const l = layerFrom(it, null, "rect");
    try { if (typeof PBBgRemove !== "undefined" && PBBgRemove.autoCut) { const r = await PBBgRemove.autoCut(l.canvas, { methods: ["classic"] }); if (r && r.canvas) { const a = alphaMask(r.canvas); let n = 0; for (let i = 0; i < a.length; i++) n += a[i]; if (n / a.length > .04 && n / a.length < .97) { l.canvas = r.canvas; l.how = "cut"; } } } } catch (e) { }
    return l;
  }
  /* الأقنعة بـ SAM المحلي: التحليل المحلي أولاً (يعطي عناصره)، ثم نضيف صناديق Alyssum API التي لم يلتقطها */
  async function buildWithLocal(apiItems, opt) {
    const cv = S.src && Object.assign(mk(S.W, S.H), {}); cv.getContext("2d").drawImage(S.src, 0, 0);
    say("الكشف المحلي (SAM) يحدّد العناصر ويرسم أقنعتها…", "", true);
    const res = await AIVision.analyze(cv, { onStep: m => say(m, "", true) }); chk();
    const S2 = res.S, items = res.items, meta = new Map(), extras = [];
    items.forEach(it => meta.set(it, { label: it.label, kind: "object" }));
    const bx = it => [it.x0, it.y0, it.x1 + 1, it.y1 + 1];
    let added = 0, textItems = [];
    for (const g of apiItems) {
      chk();
      if (g.kind === "text") { textItems.push(g); continue; }
      const dup = items.find(it => iou(bx(it), g.box) > .5 || (bInter(bx(it), g.box) / Math.max(1, Math.min(bArea(bx(it)), bArea(g.box))) > .9 && Math.min(bArea(bx(it)), bArea(g.box)) / Math.max(bArea(bx(it)), bArea(g.box)) > .6));
      if (dup) { const m = meta.get(dup); if (m && g.label && g.label.length > 1) { m.label = g.label; m.kind = g.kind; } continue; }
      say("SAM يقصّ عنصراً إضافياً: " + g.label + " (" + (++added) + ")…", "", true);
      try { const it = await AIVision.addItem(S2, { box: g.box.slice(), label: g.label }, items); if (it && it.area) { if (!meta.has(it)) meta.set(it, { label: g.label, kind: g.kind }); } else extras.push(g); } catch (e) { extras.push(g); }
    }
    const chosen = items.filter(it => it.area && (it.area >= 24));
    say("قصّ " + chosen.length + " عنصراً بأحرف ناعمة…", "", true);
    await sleep(30);
    const cuts = AIVision.cutouts(S2, cv, chosen, { shadow: false }), layers = [];
    cuts.forEach(c => { const m = meta.get(c.item) || {}; layers.push({ canvas: c.canvas, x: c.x0, y: c.y0, w: c.w, h: c.h, name: String(m.label || c.label || "عنصر").slice(0, 60), kind: m.kind || "object", how: "sam", area: c.w * c.h, erase: c.erase }); });
    const rest = textItems.concat(extras);
    return { layers, rest, localCount: items.length, added };
  }

  function addEraseMask(l) { if (l.erase) return; const w = l.canvas.width, h = l.canvas.height; l.erase = { m: alphaMask(l.canvas), x0: l.x, y0: l.y, w, h }; }

  async function makeBackground(mode, layers, cv) {
    const base = mk(S.W, S.H); base.getContext("2d").drawImage(S.src, 0, 0);
    if (mode === "orig") {
      const tl = O.realText ? layers.filter(l => l.text) : [];      // نصوص ستصير نصاً حقيقياً: نمسحها من الخلفية كي لا تتكرر
      if (tl.length && typeof ImageTools !== "undefined" && ImageTools.fillMask) {
        const g = base.getContext("2d", { willReadFrequently: true });
        tl.forEach(l => { try { addEraseMask(l); const e = l.erase, pad = 3, W2 = e.w + pad * 2, H2 = e.h + pad * 2, m = new Uint8Array(W2 * H2); for (let y = 0; y < e.h; y++) for (let x = 0; x < e.w; x++) if (e.m[y * e.w + x]) m[(y + pad) * W2 + x + pad] = 1; const dm = ImageTools.sqDilate ? ImageTools.sqDilate(m, W2, H2, 2) : m; ImageTools.fillMask(g, e.x0 - pad, e.y0 - pad, W2, H2, dm); } catch (err) { } });
        return { canvas: base, name: "الخلفية (بلا النصوص)", note: "مُسحت النصوص من الخلفية بملء بسيط — للتنظيف الأدق اختر ترميماً محلياً أو Alyssum API." };
      }
      return { canvas: base, name: "الصورة الأصلية", note: tl.length ? "النصوص ما زالت ظاهرة في الخلفية — اختر ترميم الخلفية." : "" };
    }
    layers.forEach(addEraseMask);
    if (mode === "local") {
      if (!localOk()) return { canvas: base, name: "الصورة الأصلية", note: "الترميم المحلي غير متاح هنا — بقيت الصورة الأصلية." };
      say("ترميم الخلفية محلياً بعد إزالة العناصر…", "", true);
      try { const how = await AIVision.eraseBg(base, layers, { onStep: m => say(m, "", true) }); return { canvas: base, name: "الخلفية", note: how === "none" ? "" : "" }; } catch (e) { const b2 = mk(S.W, S.H); b2.getContext("2d").drawImage(S.src, 0, 0); return { canvas: b2, name: "الصورة الأصلية", note: "تعذّر الترميم المحلي (" + e.message + ") — بقيت الصورة الأصلية." }; }
    }
    if (mode === "api") {
      say("Alyssum API ترمّم الخلفية…", "", true);
      try {
        const r = await ImgGen.edit({ blob: S.blob, prompt: "Remove every foreground element (people, objects, products, logos, icons, stickers and all text) from this image and reconstruct the empty background naturally, keeping the same composition, colors, lighting, perspective and aspect ratio. Return only the edited image.", W: S.W, H: S.H, confirm: false, title: "ترميم الخلفية" });
        if (!r || !r.blob) throw new Error("لم تُرجع الخدمة صورة");
        const bm = await createImageBitmap(r.blob), c = mk(S.W, S.H); c.getContext("2d").drawImage(bm, 0, 0, S.W, S.H); return { canvas: c, name: "الخلفية", note: "" };
      } catch (e) { return { canvas: base, name: "الصورة الأصلية", note: "تعذّر ترميم الخلفية (" + (e.message || e) + ") — بقيت الصورة الأصلية." }; }
    }
    return { canvas: base, name: "الصورة الأصلية", note: "" };
  }

  async function generate() {
    if (!S.src || S.busy) return;
    readOpts();
    const useApi = O.api && hasKey(), useLocal = O.local && localOk();
    if (!useApi && !useLocal) { say(O.api ? "لا مفتاح Alyssum API في هذا المتصفح، والكشف المحلي غير متاح — اضبط المفتاح من «إعدادات مولّد الصور» أو فعّل الكشف المحلي." : "فعّل الكشف المحلي أو Alyssum API.", "err"); return; }
    const cfg = COVER[O.cover] || COVER.dense, calls = useApi ? 1 + (tilesFor(S.W, S.H, cfg.grid).length) + cfg.rounds : 0, bgMode = O.bg === "auto" ? (useLocal ? "local" : "orig") : O.bg, bgCalls = bgMode === "api" ? 1 : 0;
    if (useApi && !confirm("سيُرسَل حتى " + (calls + bgCalls) + " طلباً إلى Alyssum API (تحليل الصورة كاملة + مربعات + المتبقي" + (bgCalls ? " + ترميم الخلفية" : "") + ") وتُحتسب من رصيدك. المتابعة؟")) return;
    S.busy = true; S.run = { cancelled: false }; ui(true); const t0 = Date.now();
    try {
      let items = [], st = null, layers = [], summary = [];
      if (useApi) { const r = await detectApi({ max: O.max, cover: O.cover, ctx: O.ctx }); items = r.items; st = r.stats; summary.push("الصورة كاملة " + st.full + (st.tiles ? " + التجزئة " + st.tiles : "") + (st.extra.length ? " + المتبقي " + st.extra.reduce((a, b) => a + b, 0) : "")); if (st.errors.length) summary.push(st.errors.length + " طلب فاشل"); }
      chk();
      let rest = items;
      if (useLocal) {
        try { const r = await buildWithLocal(items, O); layers = r.layers; rest = r.rest; summary.push("SAM المحلي " + r.localCount + (r.added ? " + أُضيف بصندوق " + r.added : "")); }
        catch (e) { if (e.name === "AbortError") throw e; summary.push("تعذّر الكشف المحلي (" + (e.message || e).toString().slice(0, 60) + ")"); layers = []; rest = items; }
      }
      /* ما لم يُقصّ بـSAM: مضلّع/مفتاح لوني/مستطيل */
      let n = 0; for (const it of rest) { chk(); say("قصّ العنصر " + (++n) + "/" + rest.length + ": " + it.label, "", true); try { layers.push(await layerFromApi(it)); } catch (e) { if (e.name === "AbortError") throw e; } if (n % 6 === 0) await sleep(0); }
      if (!layers.length) throw new Error("لم يُعثر على أي عنصر. جرّب تفعيل Alyssum API أو أضف وصفاً للصورة.");
      if (layers.length > O.max) { layers.sort((a, b) => b.area - a.area); layers = layers.slice(0, O.max); }
      layers.sort((a, b) => b.area - a.area);
      chk(); const bg = await makeBackground(bgMode, layers);
      clearLayers(); setStage(S.src.width, S.src.height);
      addLayer(bg.canvas, bg.name, { x: 0, y: 0, w: S.W, h: S.H, kind: "background", how: "bg" });
      layers.forEach(l => addLayer(l.canvas, l.name, l));
      layout(); renderList(); updateButtons();
      const how = {}; layers.forEach(l => how[l.how] = (how[l.how] || 0) + 1);
      const hw = Object.keys(how).map(k => ({ sam: "قناع SAM", poly: "مضلّع", cut: "إزالة خلفية", text: "نص", rect: "مستطيل" }[k] + " " + how[k])).join(" · ");
      S.log = summary.join(" — ") + " — " + hw + (bg.note ? " — " + bg.note : "");
      say(layers.length + " طبقة عنصر + الخلفية خلال " + Math.round((Date.now() - t0) / 1000) + " ث. " + S.log, "ok");
    } catch (e) {
      if (e.name === "AbortError") say("أُلغيت العملية.");
      else if (e.code === "NOKEY") say("لا مفتاح Alyssum API — اضبطه من «إعدادات مولّد الصور».", "err");
      else if (e.code === "OFF") say("توليد النص الذكي مُعطَّل في الإعدادات.", "err");
      else say((e instanceof TypeError ? "فشل الشبكة: " : "") + (e.message || e), "err");
    } finally { S.busy = false; S.run = null; ui(false); }
  }

  /* ═══════════════ المسرح والطبقات (من الملف المرجعي) ═══════════════ */
  function clearLayers() { S.layers.forEach(l => l.canvas.remove()); S.layers = []; S.sel = null; renderList(); updateSel(); updateButtons(); }
  function addLayer(canvas, name, o) {
    o = o || {}; const l = { id: S.nextId++, name: name || "طبقة", canvas, kind: o.kind || "object", how: o.how || "", x: o.x || 0, y: o.y || 0, w: o.w || canvas.width, h: o.h || canvas.height, visible: true, opacity: 1, locked: false, erase: o.erase || null, text: o.text || "", tp: o.tp || null };
    l.ctx = canvas.getContext("2d", { willReadFrequently: true }); canvas.className = "ml-layer"; const st = $("ml-stage"); if (st) st.insertBefore(canvas, $("ml-selbox")); S.layers.push(l); return l;
  }
  function styleLayer(l) { const c = l.canvas.style; c.left = l.x + "px"; c.top = l.y + "px"; c.width = l.w + "px"; c.height = l.h + "px"; c.opacity = l.opacity; c.display = l.visible ? "block" : "none"; }
  function layout() { S.layers.forEach((l, i) => { l.canvas.style.zIndex = i + 1; styleLayer(l); }); updateSel(); }
  function setStage(W, H) { S.W = W; S.H = H; const st = $("ml-stage"); if (st) { st.style.width = W + "px"; st.style.height = H + "px"; } fit(); }
  function fit() {
    if (!S.W || !$("ml-view")) return; const v = $("ml-view"), aw = v.clientWidth - 24, ah = v.clientHeight - 24;
    S.scale = Math.max(.05, Math.min(aw / S.W, ah / S.H, 2)); $("ml-stage").style.transform = "scale(" + S.scale + ")";
    const z = $("ml-sizer"); z.style.width = S.W * S.scale + "px"; z.style.height = S.H * S.scale + "px"; $("ml-selbox").style.setProperty("--u", 1 / S.scale);
  }
  function select(l) { S.sel = l || null; updateSel(); renderList(); }
  function updateSel() { const b = $("ml-selbox"), l = S.sel; if (!b) return; if (!l) { b.style.display = "none"; return; } b.style.display = "block"; b.style.left = l.x + "px"; b.style.top = l.y + "px"; b.style.width = l.w + "px"; b.style.height = l.h + "px"; }
  function updateButtons() { const has = S.layers.length > 0; ["ml-zip", "ml-png", "ml-send"].forEach(id => { const b = $(id); if (b) b.disabled = !has; }); }
  const toStage = e => { const r = $("ml-sizer").getBoundingClientRect(); return { x: (e.clientX - r.left) / S.scale, y: (e.clientY - r.top) / S.scale }; };
  function hitTest(p) {
    for (let i = S.layers.length - 1; i >= 0; i--) {
      const l = S.layers[i]; if (!l.visible || l.locked || l.opacity <= 0 || l.kind === "background") continue;
      if (p.x < l.x || p.y < l.y || p.x >= l.x + l.w || p.y >= l.y + l.h) continue;
      const cx = Math.floor((p.x - l.x) / l.w * l.canvas.width), cy = Math.floor((p.y - l.y) / l.h * l.canvas.height);
      try { if (l.ctx.getImageData(cx, cy, 1, 1).data[3] > 12) return l; } catch (e) { return l; }
    }
    const bgL = S.layers.find(l => l.kind === "background" && l.visible && !l.locked); return bgL || null;
  }
  let drag = null;
  function onDown(e) {
    if (e.button !== 0 || !S.layers.length) return; const p = toStage(e), h = e.target.dataset && e.target.dataset.h;
    if (h && S.sel) { const l = S.sel; drag = { mode: "resize", h, l, o: { x: l.x, y: l.y, w: l.w, h: l.h } }; }
    else { const hit = hitTest(p); select(hit); if (hit) drag = { mode: "move", l: hit, start: p, o: { x: hit.x, y: hit.y } }; }
    if (drag) $("ml-sizer").setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return; const p = toStage(e), l = drag.l, o = drag.o;
    if (drag.mode === "move") { l.x = Math.round(o.x + p.x - drag.start.x); l.y = Math.round(o.y + p.y - drag.start.y); }
    else {
      const east = drag.h.includes("e"), south = drag.h.includes("s"), ax = east ? o.x : o.x + o.w, ay = south ? o.y : o.y + o.h, rw = Math.abs(p.x - ax), rh = Math.abs(p.y - ay); let w, h;
      if (e.shiftKey) { w = Math.max(8, rw); h = Math.max(8, rh); } else { const k = Math.max(8 / o.w, 8 / o.h, rw / o.w, rh / o.h); w = o.w * k; h = o.h * k; }
      l.w = Math.round(w); l.h = Math.round(h); l.x = Math.round(east ? ax : ax - l.w); l.y = Math.round(south ? ay : ay - l.h);
    }
    styleLayer(l); updateSel();
  }
  const onUp = () => { drag = null; };
  function onKey(e) {
    if (!S.open) return; const t = e.target.tagName; if (e.key === "Escape" && t !== "INPUT" && t !== "TEXTAREA") { close(); return; }
    if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || !S.sel) return;
    const l = S.sel, d = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") l.x -= d; else if (e.key === "ArrowRight") l.x += d; else if (e.key === "ArrowUp") l.y -= d; else if (e.key === "ArrowDown") l.y += d;
    else if (e.key === "Delete" || e.key === "Backspace") { removeLayer(l); e.preventDefault(); return; } else return;
    e.preventDefault(); styleLayer(l); updateSel();
  }
  function removeLayer(l) { l.canvas.remove(); S.layers = S.layers.filter(x => x !== l); if (S.sel === l) S.sel = null; layout(); renderList(); updateButtons(); }
  function move(l, dir) { const i = S.layers.indexOf(l), j = i + dir; if (j < 0 || j >= S.layers.length) return; [S.layers[i], S.layers[j]] = [S.layers[j], S.layers[i]]; layout(); renderList(); }
  const ICON = {
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7-2.6"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', dl: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>'
  };
  function iconBtn(name, title, on, fn) { const b = document.createElement("button"); b.type = "button"; b.className = "ml-ib" + (on ? " on" : ""); b.title = title; b.setAttribute("aria-label", title); b.innerHTML = '<svg viewBox="0 0 24 24">' + ICON[name] + "</svg>"; b.addEventListener("click", e => { e.stopPropagation(); fn(); }); return b; }
  function thumb(l) { const c = document.createElement("canvas"); c.className = "ml-th"; c.width = 96; c.height = 96; const g = c.getContext("2d"), k = Math.min(96 / l.canvas.width, 96 / l.canvas.height), w = l.canvas.width * k, h = l.canvas.height * k; g.drawImage(l.canvas, (96 - w) / 2, (96 - h) / 2, w, h); return c; }
  const HOW = { sam: "SAM", poly: "مضلّع", cut: "قص", text: "نص حقيقي", rect: "مستطيل", bg: "خلفية" };
  function renderList() {
    const ul = $("ml-layers"); if (!ul) return; ul.innerHTML = ""; const cnt = $("ml-count"); if (cnt) cnt.textContent = S.layers.length ? "(" + S.layers.length + ")" : "";
    if (!S.layers.length) { const d = document.createElement("div"); d.className = "ml-none"; d.textContent = "لا طبقات بعد."; ul.appendChild(d); return; }
    for (let i = S.layers.length - 1; i >= 0; i--) {
      const l = S.layers[i], li = document.createElement("li"); li.className = "ml-row" + (l === S.sel ? " sel" : "") + (l.visible ? "" : " off"); li.addEventListener("click", () => select(l));
      const meta = document.createElement("div"); meta.className = "ml-meta"; const nm = document.createElement("input"); nm.className = "ml-nm"; nm.type = "text"; nm.value = l.name; nm.addEventListener("click", e => e.stopPropagation()); nm.addEventListener("input", () => { l.name = nm.value; });
      const btns = document.createElement("div"); btns.className = "ml-btns"; const op = document.createElement("input"); op.type = "range"; op.min = 0; op.max = 100; op.value = Math.round(l.opacity * 100); op.title = "الشفافية"; op.addEventListener("click", e => e.stopPropagation()); op.addEventListener("input", () => { l.opacity = op.value / 100; styleLayer(l); });
      btns.append(iconBtn(l.visible ? "eye" : "eyeoff", l.visible ? "إخفاء" : "إظهار", false, () => { l.visible = !l.visible; layout(); renderList(); }), iconBtn(l.locked ? "lock" : "unlock", l.locked ? "فتح القفل" : "قفل (يُتجاهل عند النقر)", l.locked, () => { l.locked = !l.locked; renderList(); }), op,
        iconBtn("up", "رفع", false, () => move(l, 1)), iconBtn("down", "خفض", false, () => move(l, -1)), iconBtn("dl", "تنزيل الطبقة PNG", false, async () => download(await toBlob(l.canvas), slug(l.name) + ".png")), iconBtn("trash", "حذف", false, () => removeLayer(l)));
      if (l.text) { const ti = document.createElement("input"); ti.type = "text"; ti.className = "ml-nm"; ti.value = l.text; ti.title = "النص الحقيقي (يُنشأ نصاً قابلاً للتعديل في المطوّر)"; ti.style.direction = "auto"; ti.addEventListener("click", e => e.stopPropagation()); ti.addEventListener("input", () => { l.text = ti.value; if (l.tp) l.tp = Object.assign({}, l.tp, { lines: Math.max(1, ti.value.split(/\n/).length) }); }); meta.append(ti); }
      const tag = document.createElement("small"); tag.className = "ml-tag"; tag.textContent = HOW[l.how] || ""; meta.append(nm, btns, tag); li.append(thumb(l), meta); ul.appendChild(li);
    }
  }
  /* ═══════════════ التصدير ═══════════════ */
  function composite() { const c = mk(S.W, S.H), g = c.getContext("2d"); for (const l of S.layers) { if (!l.visible) continue; g.globalAlpha = l.opacity; g.drawImage(l.canvas, l.x, l.y, l.w, l.h); } g.globalAlpha = 1; return c; }
  function fullSizeLayer(l) { const c = mk(S.W, S.H); c.getContext("2d").drawImage(l.canvas, l.x, l.y, l.w, l.h); return c; }
  async function exportZip() {
    say("تجهيز ملف ZIP…", "", true); const files = [], manifest = { width: S.W, height: S.H, layers: [] };
    for (let i = 0; i < S.layers.length; i++) {
      const l = S.layers[i], name = String(i + 1).padStart(3, "0") + "_" + slug(l.name) + ".png";
      files.push({ name, data: new Uint8Array(await (await toBlob(fullSizeLayer(l))).arrayBuffer()) });
      manifest.layers.push({ file: name, name: l.name, kind: l.kind, text: l.text || undefined, color: l.tp ? l.tp.color : undefined, fontSize: l.tp ? l.tp.fs : undefined, order: i + 1, visible: l.visible, opacity: l.opacity, x: l.x, y: l.y, width: l.w, height: l.h });
    }
    files.push({ name: "composition.png", data: new Uint8Array(await (await toBlob(composite())).arrayBuffer()) });
    files.push({ name: "manifest.json", data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
    download(makeZip(files), "magic-layers.zip"); say("نُزّل magic-layers.zip (" + S.layers.length + " طبقة).", "ok");
  }
  /* لوحة بمقاس الصورة في المطوّر، كل طبقة عنصر صورة حر بموضعها وحجمها */
  async function sendToBuilder() {
    if (!S.layers.length) return;
    if (typeof ImgGen === "undefined" || !ImgGen.openSized || typeof PBApp === "undefined" || typeof PB === "undefined") { say("المطوّر غير متاح.", "err"); return; }
    if (S.layers.length > 120 && !confirm("أكثر من 120 طبقة ستُرفع إلى موقعك كصور مستقلة. المتابعة؟")) return;
    const layers = S.layers.map(l => ({ l, vis: l.visible })).filter(x => x.vis).map(x => x.l), W = S.W, H = S.H;
    close(); ImgGen.openSized({ W, H, id: "custom", label: "Magic Layers " + W + "×" + H, name: "طبقات", textMode: "none", lang: "ar" });
    let t = 0; while (t++ < 40 && !(PBApp.E && PBApp.E.page && PBApp.E.page.ad && document.getElementById("pb-app") && document.getElementById("pb-app").classList.contains("on"))) await sleep(200);
    const page = PBApp.E && PBApp.E.page; if (!page || !page.ad) { toast("تعذّر فتح لوحة المطوّر"); return; }
    const sec = page.sections[0]; sec.free = sec.free || []; let z = 1, ok = 0, texts = 0;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      try {
        if (l.text && O.realText && l.tp) {            // نص حقيقي قابل للتعديل بدل صورة
          const tp = l.tp, one = tp.lines <= 1, w = PB.mkFree(one ? "heading" : "text", 0, 0, z++), pos = { fx: { d: Math.round(l.x / W * 1000) / 10 }, fy: { d: Math.round(l.y) }, fwd: { d: Math.round(l.w / W * 1000) / 10 }, fh: { d: Math.max(8, Math.round(l.h)) } };
          const base = { fs: { d: tp.fs }, fw: "700", color: tp.color, ta: { d: "center" }, lh: { d: 1.2 }, hauto: false };
          if (one) Object.assign(w.set, base, pos, { text: l.text, tag: "div" }); else Object.assign(w.set, base, pos, { html: "<p>" + l.text.split(/\n/).map(esc).join("<br>") + "</p>" });
          if (l.opacity < 1) w.set.op = Math.round(l.opacity * 100) / 100; sec.free.push(w); ok++; texts++; continue;
        }
        const path = await PBApp.uploadBlob(await toBlob(l.canvas), "ml" + (i + 1), { max: 4000, q: .9 }), w = PB.mkFree("image", 0, 0, z++);
        Object.assign(w.set, { src: path, alt: l.name, fit: "fill", hauto: false, fx: { d: Math.round(l.x / W * 1000) / 10 }, fy: { d: Math.round(l.y) }, fwd: { d: Math.round(l.w / W * 1000) / 10 }, fh: { d: Math.max(4, Math.round(l.h)) } });
        if (l.opacity < 1) w.set.op = Math.round(l.opacity * 100) / 100;
        sec.free.push(w); ok++; if (i % 4 === 3) PBApp.renderCanvas();
      } catch (e) { console.warn("ml upload", e); }
    }
    PBApp.renderCanvas(); try { PBApp.E.dirty = true; } catch (e) { }
    toast("✅ أُرسلت " + ok + " طبقة إلى المطوّر (" + texts + " نص حقيقي قابل للتعديل والباقي صور حرة) — عدّلها ثم «حفظ ونشر» أو «تصدير الصورة»");
  }

  /* ═══════════════ الواجهة ═══════════════ */
  /* ═══════════════ صفحة هبوط كاملة بطبقات ═══════════════
     نفس برومبت «تصميم بطبقات» (PBSpec: خطة ثم طبقات بنصوصها وأسعارها وقسم الطلب) لكن صور الصفحة كلها تُرسم في لوحة أصول واحدة
     على خلفية بيضاء (شبكة خلايا متساوية) ثم تُقصّ بمكوّنات متصلة وتُوزَّع على الطبقات الفارغة — بدل طلب توليد لكل صورة. */
  const SHEET_MAX = 12, SHEET_W = 1536, SHEET_H = 1024;
  function gridFor(n) { return n <= 2 ? { cols: 2, rows: 1 } : n <= 4 ? { cols: 2, rows: 2 } : n <= 6 ? { cols: 3, rows: 2 } : n <= 8 ? { cols: 4, rows: 2 } : { cols: 4, rows: 3 }; }
  function sheetPrompt(items, g, ctx) {
    const lines = items.map((a, i) => "Cell " + (i + 1) + " (row " + (Math.floor(i / g.cols) + 1) + ", column " + (i % g.cols + 1) + ") " + (a.cut ? "[ISOLATED]" : "[SCENE]") + ": " + a.prompt).join("\n");
    return "Create ONE image: an asset sheet — a perfectly regular grid of " + g.cols + " columns × " + g.rows + " rows of EQUAL cells, filled left-to-right, top row first, on a PURE FLAT WHITE background (#FFFFFF). Each cell holds exactly one separate asset, centered, occupying about 70-80% of the cell, with at least 12% empty white margin on every side so assets never touch each other or the cell borders. No grid lines, no borders, no frames, no labels, no numbers, no captions, no text or letters anywhere, no logos or watermarks, no people (hands only if required; never an uncovered woman). Photorealistic, professional e-commerce marketing quality, consistent soft studio lighting" + (ctx ? ", everything consistent with this product: " + ctx : "") + ". Unused cells stay empty white.\n" + lines + "\n[ISOLATED] = a single object with clean edges, NO background and NO ground shadow. [SCENE] = a full rectangular picture (texture / background / scene) that fills a clean rectangle inside its cell.";
  }
  /* مكوّنات متصلة لكل ما ليس أبيض (مع تمدّد صغير يلصق أجزاء العنصر الواحد) ← صناديق [x0,y0,x1,y1,area] بالبكسل */
  function findBlobs(cv, o) {
    o = o || {}; const k = Math.min(1, 480 / Math.max(cv.width, cv.height)), w = Math.max(1, Math.round(cv.width * k)), h = Math.max(1, Math.round(cv.height * k)), r = o.dil == null ? 2 : o.dil;
    const t = mk(w, h), g = t.getContext("2d", { willReadFrequently: true }); g.drawImage(cv, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h), dm = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { const q = i * 4; m[i] = d[q + 3] > 20 && (d[q] < 236 || d[q + 1] < 236 || d[q + 2] < 236) ? 1 : 0; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) dm[yy * w + xx] = 1; } }
    const seen = new Uint8Array(w * h), out = [], st = [];
    for (let i0 = 0; i0 < w * h; i0++) {
      if (!dm[i0] || seen[i0]) continue; let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0; st.length = 0; st.push(i0); seen[i0] = 1;
      while (st.length) {
        const i = st.pop(), x = i % w, y = (i / w) | 0;
        if (m[i]) { area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x > 0 && dm[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; st.push(i - 1); }
        if (x < w - 1 && dm[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; st.push(i + 1); }
        if (y > 0 && dm[i - w] && !seen[i - w]) { seen[i - w] = 1; st.push(i - w); }
        if (y < h - 1 && dm[i + w] && !seen[i + w]) { seen[i + w] = 1; st.push(i + w); }
      }
      if (x1 < 0 || area < 20 || (x1 - x0) < 5 || (y1 - y0) < 5) continue;
      out.push([Math.floor(x0 / k), Math.floor(y0 / k), Math.min(cv.width, Math.ceil((x1 + 1) / k)), Math.min(cv.height, Math.ceil((y1 + 1) / k)), area / (k * k)]);
    }
    return out;
  }
  /* توزيع الصناديق على الخلايا: الخلية = الموضع الهندسي (مركز الصندوق)؛ إن تجاهل النموذج الشبكة يُوزَّع بترتيب القراءة */
  function assignCells(blobs, g, W, H, n) {
    const cw = W / g.cols, ch = H / g.rows, out = Array(n).fill(null);
    blobs.forEach(b => {
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, i = Math.min(g.rows - 1, Math.floor(cy / ch)) * g.cols + Math.min(g.cols - 1, Math.floor(cx / cw));
      if (i >= n) return; out[i] = out[i] ? [Math.min(out[i][0], b[0]), Math.min(out[i][1], b[1]), Math.max(out[i][2], b[2]), Math.max(out[i][3], b[3])] : [b[0], b[1], b[2], b[3]];
    });
    if (out.filter(Boolean).length < Math.ceil(n / 2) && blobs.length >= n) {
      const big = blobs.slice().sort((a, b) => b[4] - a[4]).slice(0, n).sort((a, b) => (a[1] + a[3]) - (b[1] + b[3])), res = [];
      for (let i = 0; i < big.length; i += g.cols) big.slice(i, i + g.cols).sort((a, b) => (a[0] + a[2]) - (b[0] + b[2])).forEach(b => res.push([b[0], b[1], b[2], b[3]]));
      return Array.from({ length: n }, (_, i) => res[i] || null);
    }
    return out;
  }
  /* إزالة الأبيض المتصل بحواف القصاصة فقط (الأبيض داخل العنصر يبقى) + تنعيم حافة */
  function cutWhite(c) {
    const w = c.width, h = c.height, g = c.getContext("2d", { willReadFrequently: true }), im = g.getImageData(0, 0, w, h), px = im.data, bgm = new Uint8Array(w * h), st = [];
    const wh = i => px[i * 4 + 3] < 12 || (px[i * 4] >= 238 && px[i * 4 + 1] >= 238 && px[i * 4 + 2] >= 238);
    const push = i => { if (!bgm[i] && wh(i)) { bgm[i] = 1; st.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
    for (let i = 0; i < w * h; i++) {
      if (bgm[i]) { px[i * 4 + 3] = 0; continue; }
      const x = i % w, y = (i / w) | 0;
      if ((x > 0 && bgm[i - 1]) || (x < w - 1 && bgm[i + 1]) || (y > 0 && bgm[i - w]) || (y < h - 1 && bgm[i + w])) { const mn = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); if (mn > 205) px[i * 4 + 3] = Math.round(px[i * 4 + 3] * Math.max(.2, (255 - mn) / 50)); }
    }
    g.putImageData(im, 0, 0); return c;
  }
  function opaqueRatio(c) { const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n / (d.length / 4 || 1); }
  const normKey = (p, cut) => String(p || "").trim().toLowerCase().replace(/\s+/g, " ") + "|" + (cut ? 1 : 0);
  /* الصور الفارغة في صفحة: مجمَّعة بالوصف (نفس الوصف = أصل واحد) */
  function emptyAssets(pg) {
    const map = new Map();
    (pg.sections || []).forEach(sec => (sec.free || []).forEach(w => {
      if (w.type !== "image" || w.set.src) return; const pr = String(w.set.aiPrompt || w.set.alt || "").trim(); if (pr.length < 8) return;
      const cut = !!(w.set.__cutout || w.set.aiCut), key = normKey(pr, cut); let a = map.get(key); if (!a) { a = { key, prompt: pr.slice(0, 300), cut, ws: [] }; map.set(key, a); } a.ws.push(w);
    }));
    return [...map.values()];
  }
  async function toDataUrl(blob, max) {
    const bm = await createImageBitmap(blob), k = Math.min(1, max / Math.max(bm.width, bm.height)), c = mk(bm.width * k, bm.height * k); c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    let u = c.toDataURL("image/webp", .86); if (!/^data:image\/webp/.test(u)) u = c.toDataURL("image/jpeg", .88); return u;
  }
  const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(Object.assign(new Error("انتهت مهلة الطلب"), { code: "TIMEOUT" })), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
  const walkRepl = (o, from, to) => { if (!o || typeof o !== "object") return; for (const k in o) { const v = o[k]; if (v === from) o[k] = to; else if (v && typeof v === "object") walkRepl(v, from, to); } };
  function landExtra(o, hasPhoto) {
    const real = hasPhoto ? 'صورة المنتج الحقيقية (المرفقة معك) تُستعمل كما هي بـ src:"asset:product_photo" — لا تضع لها prompt ولا تُولّدها.' : (o.product ? 'صورة المنتج الحقيقية تُستعمل كما هي بـ src:"product:cover" — لا تولّدها.' : "");
    const noP = !o.product ? " لا يوجد منتج مربوط بالمتجر: لا تضع طبقات price ولا offers ولا قسم kind:order، واكتب أي سعر أو عرض في الوصف فقط إن وُجد في بيانات المنتج، وأنهِ الصفحة بزر دعوة للتواصل." : "";
    return "وضع «لوحة الأصول»: " + real + noP + " كل صورة أخرى تُعرَّف بـ prompt إنجليزي قصير ومحدد وبلا أي نص أو شعار، واستعمل أقل عدد ممكن من الصور المختلفة (حتى 12 في الصفحة كلها، وأعد استعمال نفس الأصل بدل تكرار الوصف)؛ وسترسمها كلها دفعة واحدة في لوحة أصول واحدة ثم تُقصّ. اجعل cutout:true للعنصر المعزول (مكوّن، عنصر، منتج مكمّل) وبدونه للخلفيات والمشاهد والنقوش.";
  }
  async function landing(o) {
    o = o || {}; const say = o.say || (() => { });
    if (typeof PBSpec === "undefined" || typeof PBApp === "undefined" || typeof ImgGen === "undefined" || !ImgGen.edit) throw new Error("المطوّر غير متاح");
    const rd = ImgGen.ready ? ImgGen.ready() : { ok: hasKey() }; if (!rd.ok) { const e = new Error(rd.off ? "OFF" : "NOKEY"); e.code = rd.off ? "OFF" : "NOKEY"; throw e; }
    S.run = { cancelled: false }; const run = S.run; let photoUrl = "";
    try {
      if (o.photoBlob) photoUrl = await toDataUrl(o.photoBlob, 1100);
      say("١/٤ تصميم الصفحة بنفس برومبت المطوّر الذكي (خطة ثم طبقات)…", "", true);
      const spec = await PBSpec.generate({ name: o.name, desc: o.desc, goal: o.goal, lang: o.lang || "ar", type: o.type || "landing", colors: o.colors, style: o.style, width: 1080, height: 1080, offers: o.offers, extra: landExtra(o, !!photoUrl), blobs: o.photoBlob ? [o.photoBlob] : [], say: m => say(m, "", true) });
      chk();
      if (photoUrl) { spec.assets = spec.assets || {}; spec.assets.product_photo = { src: photoUrl }; }
      const r = PBSpec.validate(spec); if (!r.ok) throw new Error(r.error);
      if (o.product) r.page.product = o.product;
      const pg = PBSpec.toPage(r, { product: r.page.product });
      pg.slug = (r.page.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "page-" + Date.now().toString(36).slice(-4);
      /* لوحات الأصول */
      const assets = emptyAssets(pg), ctx = ((o.name || "") + (o.desc ? " — " + String(o.desc).slice(0, 160) : "")).trim(), chunks = [];
      for (let i = 0; i < assets.length; i += SHEET_MAX) chunks.push(assets.slice(i, i + SHEET_MAX));
      let got = 0;
      for (let ci = 0; ci < chunks.length; ci++) {
        chk(); const items = chunks[ci], g = gridFor(items.length);
        say("٢/٤ رسم لوحة الأصول " + (ci + 1) + " من " + chunks.length + " (" + items.length + " أصل في طلب واحد)…", "", true);
        let sheet = null;
        for (let tr = 0; tr < 2 && !sheet; tr++) {
          try { const res = await withTimeout(ImgGen.edit({ textOnly: true, prompt: sheetPrompt(items, g, ctx), W: SHEET_W, H: SHEET_H, confirm: false, title: "لوحة أصول" }), o.timeout || 200000); chk(); if (res && res.blob && res.blob.size > 3000) sheet = res; }
          catch (e) { if (e.code === "NOKEY" || e.code === "OFF" || e.name === "AbortError" || /رصيد|credit|quota|limit/i.test(e.message || "")) throw e; }
        }
        if (!sheet) continue;
        say("٣/٤ قصّ الأصول من اللوحة…", "", true);
        let cv = sheet.canvas; if (!cv) { const bm = await createImageBitmap(sheet.blob); cv = mk(bm.width, bm.height); cv.getContext("2d").drawImage(bm, 0, 0); }
        const cells = assignCells(findBlobs(cv), g, cv.width, cv.height, items.length);
        for (let i = 0; i < items.length; i++) {
          const b = cells[i]; if (!b) continue; const pad = Math.round(Math.max(cv.width, cv.height) * .004), x0 = Math.max(0, b[0] - pad), y0 = Math.max(0, b[1] - pad), x1 = Math.min(cv.width, b[2] + pad), y1 = Math.min(cv.height, b[3] + pad);
          const cellA = (cv.width / g.cols) * (cv.height / g.rows), cropA = (x1 - x0) * (y1 - y0);
          if (cropA < cellA * .03 || cropA > cellA * 1.6) continue;   // قصّ صغير جداً (شظية) أو يلتهم عدة خلايا ← يُرفض ويُرسم هذا الأصل وحده لاحقاً
          const c = mk(x1 - x0, y1 - y0); c.getContext("2d").drawImage(cv, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
          const outC = items[i].cut ? cutWhite(c) : c;
          if (items[i].cut && opaqueRatio(outC) < .06) continue;   // القصّ مسح الأصل تقريباً
          items[i].blob = await toBlob(outC, "image/png"); got++;
        }
      }
      chk();
      return { page: pg, assets, spec: r, photoUrl, total: assets.length, got };
    } finally { if (S.run === run) S.run = null; }
  }
  /* فتح الصفحة في المطوّر ورفع الأصول المقصوصة وتركيبها على الطبقات الفارغة */
  async function landingOpen(res, o) {
    o = o || {}; const say = o.say || (() => { }), pg = res.page;
    PBApp.open(pg, "", true);
    let t = 0; while (t++ < 40 && !(PBApp.E && PBApp.E.page && document.getElementById("pb-app") && document.getElementById("pb-app").classList.contains("on"))) await sleep(200);
    await sleep(500); const P = PBApp.E && PBApp.E.page; if (!P) throw new Error("تعذّر فتح المطوّر");
    let ok = 0;
    if (res.photoUrl && o.photoBlob) { try { const path = await PBApp.uploadBlob(o.photoBlob, "mlphoto", { max: 2400, q: .9 }); walkRepl(P, res.photoUrl, path); } catch (e) { console.warn("ml photo", e); } }
    const byKey = new Map(emptyAssets(P).map(a => [a.key, a]));
    for (let i = 0; i < res.assets.length; i++) {
      const a = res.assets[i]; if (!a.blob) continue; const live = byKey.get(a.key); if (!live) continue;
      say("٤/٤ رفع الأصل " + (i + 1) + " من " + res.assets.length + "…");
      try { const path = await PBApp.uploadBlob(a.blob, "mla" + Date.now().toString(36) + i, { max: 2400, q: .9 }); live.ws.forEach(w => { w.set.src = path; delete w.set.__cutout; delete w.set.aiPrompt; delete w.set.aiCut; delete w.__dw; }); ok++; if (PBApp.renderCanvas) PBApp.renderCanvas(); } catch (e) { console.warn("ml asset", e); }
    }
    if (PBApp.renderCanvas) PBApp.renderCanvas(); try { P.dirty = true; PBApp.E.dirty = true; } catch (e) { }
    const cnt = () => emptyAssets(P).reduce((n, a) => n + a.ws.length, 0); let filled = 0;
    /* ما لم يُقصّ من اللوحة (النموذج تجاهل الشبكة أو فشل القصّ) يُولَّد كل أصل وحده بدل ترك مربع فارغ */
    if (cnt() && o.fallback !== false && typeof PBSpec !== "undefined" && PBSpec.fillImages) {
      const groups = emptyAssets(P).filter(a => a.ws.length > 1), stash = [];
      groups.forEach(a => a.ws.slice(1).forEach(w => { stash.push({ w, ap: w.set.aiPrompt, alt: w.set.alt }); delete w.set.aiPrompt; w.set.alt = ""; }));   // نفس الأصل يُولَّد مرة واحدة فقط ثم يُنسخ
      try { say("٤/٤ توليد الأصول التي لم تُقصّ من اللوحة (" + groups.length + "+)…"); const before = cnt(); await PBSpec.fillImages({ dw: 1080, confirm: false, say: m => say(m) }); filled = before - cnt(); } catch (e) { console.warn("ml fallback", e); }
      groups.forEach(a => { const lead = a.ws[0]; a.ws.slice(1).forEach(w => { const s = stash.find(x => x.w === w); if (lead.set.src) { w.set.src = lead.set.src; delete w.set.__cutout; delete w.set.aiCut; delete w.__dw; } if (s && !w.set.src) { w.set.aiPrompt = s.ap; w.set.alt = s.alt; } else if (s) { delete w.set.aiPrompt; } }); });
      if (PBApp.renderCanvas) PBApp.renderCanvas(); try { P.dirty = true; PBApp.E.dirty = true; } catch (e) { }
    }
    return { placed: ok, filled, total: res.assets.length, left: cnt() };
  }
  const prodsList = () => (typeof Admin !== "undefined" && Admin.products) || (typeof PRODUCTS !== "undefined" ? PRODUCTS : []) || [];
  function readLand() {
    const v = id => { const e = $(id); return e ? e.value : ""; }, ps = prodsList(), p = ps.find(x => x.slug === v("ml-lprod"));
    const L = { product: v("ml-lprod"), name: v("ml-lname").trim() || (p ? p.title : ""), desc: v("ml-ldesc").trim() || (p && (p.desc || p.description) || ""), goal: v("ml-lgoal").trim(), colors: v("ml-lcol").trim(), lang: v("ml-llang") || "ar", type: v("ml-ltype") || "landing", method: v("ml-lmethod") || "image", price: v("ml-lprice").trim() || (p && p.price ? String(p.price) : "") };
    L.offers = p && p.offers ? p.offers.map(x => x.qty + " قطع = " + x.price + " دج" + (x.free ? " (منها " + x.free + " هدية)" : "")).join("، ") : "";
    O.land = { product: L.product, name: v("ml-lname"), desc: v("ml-ldesc"), goal: L.goal, colors: L.colors, lang: L.lang, type: L.type, method: L.method, price: v("ml-lprice") }; saveO(); return L;
  }
  function uiL(busy) { const g = $("ml-land-go"), c = $("ml-lcancel"); if (g) g.disabled = !!busy; if (c) c.hidden = !busy; }
  async function fetchBlobL(src) { try { const r = await fetch(/^(https?:|data:|blob:)/.test(src) ? src : String(src).replace(/^\/+/, ""), { cache: "force-cache" }); return r.ok ? await r.blob() : null; } catch (e) { return null; } }
  /* الطريقة الأولى «مثل المنشئ الذكي»: برومبت المنشئ نفسه (نصوص تسويقية + برومبت تصميم) ← صفحة طويلة مرسومة بنصوصها ← تفكيك إلى طبقات */
  async function landingImage(L) {
    if (typeof PBGen === "undefined" || !PBGen.buildPrompt) throw new Error("المنشئ الذكي غير متاح");
    const rd = ImgGen.ready ? ImgGen.ready() : { ok: hasKey() }; if (!rd.ok) { const e = new Error(rd.off ? "OFF" : "NOKEY"); e.code = rd.off ? "OFF" : "NOKEY"; throw e; }
    let photo = S.lphoto || null; if (!photo) { const p = prodsList().find(x => x.slug === L.product), src = p && (p.cover || (p.images || [])[0]); if (src) photo = await fetchBlobL(src); }
    if (!photo) throw new Error("ارفع صورة المنتج أو اختر منتجاً له غلاف");
    const meta = PBGen.buildPrompt({ lang: L.lang, offer: "single", name: L.name, desc: L.desc, price: L.price ? L.price + (/[a-zA-Z\u0600-\u06FF]/.test(L.price) ? "" : " دج") : "", colors: L.colors, aud: L.goal, tpl: "11" });
    say("١/٣ كتابة النصوص التسويقية وبرومبت التصميم…", "", true);
    const t = await withTimeout(ImgGen.text({ prompt: meta, blobs: [photo], temp: .7 }), 150000); chk();
    const blocks = [...String(t).matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(m => m[1].trim()).sort((a, b) => b.length - a.length); let prompt = blocks[0];
    if (!prompt) { const i = String(t).indexOf("Act as a world-class"); prompt = i >= 0 ? String(t).slice(i) : String(t); }
    if (prompt.length < 300) throw new Error("لم يُنتج النموذج برومبت تصميم صالحاً — أعد المحاولة");
    say("٢/٣ رسم الصفحة الطويلة كاملة بنصوصها (قد يستغرق دقيقة أو أكثر)…", "", true);
    const r = await withTimeout(ImgGen.edit({ blob: photo, prompt, W: 1024, H: 4096, ar: "1:4", noFit: true, confirm: false, title: "صفحة هبوط كاملة" }), 360000); chk();
    if (!r || !r.blob) throw new Error("لم تُرجع الخدمة صورة");
    return { blob: r.blob, prompt };
  }
  async function runLandingImage(L) {
    if (!confirm("سيُكتب نص الصفحة وبرومبتها (طلب نصي) ثم تُرسم صفحة طويلة كاملة بتقنية Alyssum API وتُستهلك من رصيدك، ثم تُفكَّك إلى صور ونصوص حقيقية قابلة للتعديل (طلبات إضافية للتفكيك). المتابعة؟")) return;
    S.busy = true; uiL(true); S.run = { cancelled: false };
    let r;
    try { r = await landingImage(L); }
    catch (e) { S.busy = false; S.run = null; uiL(false); say(e.code === "NOKEY" ? "لم يُضبط مفتاح Alyssum API بعد." : e.code === "OFF" ? "التوليد الذكي معطّل في الإعدادات." : "تعذّر الإنشاء: " + (e.message || e) + " — لم يضِع شيء، يمكنك إعادة المحاولة.", "err"); return; }
    S.busy = false; S.run = null; uiL(false);
    setMode("ext"); await loadSource(r.blob); say("تم رسم الصفحة — جارٍ تفكيكها إلى طبقات…", "", true);
    await generate();
    toast("✅ الصفحة مفكَّكة — راجع الطبقات ثم اضغط «أرسل إلى المطوّر»");
  }
  async function runLanding() {
    if (S.busy) return; const L = readLand();
    if (!L.name) { say("اختر منتجاً أو اكتب اسمه أولاً.", "err"); return; }
    if (!hasKey()) { say("يلزم مفتاح Alyssum API لهذا الوضع (اضبطه من «تصميم بطبقات» أو إعدادات مولّد الصور).", "err"); return; }
    if (L.method !== "layers") return runLandingImage(L);
    const noProd = !L.product;
    if (!confirm((noProd ? "⚠ لم تختر منتجاً من المتجر: لن تظهر أسعار المتجر وعروضه ولن يعمل نموذج الطلب الحقيقي (تُترك أقسام السعر والطلب خارج التصميم). اختر منتجاً أولاً للحصول على صفحة كاملة.\n\n" : "") + "سيُنشأ تصميم الصفحة ثم تُرسم أصولها في لوحة (أو أكثر) بتقنية Alyssum API وتُستهلك من رصيدك، وما لم يُقصّ منها يُولَّد وحده (بلا أي كتابة داخل الصور). المتابعة؟")) return;
    S.busy = true; uiL(true);
    try {
      const photo = S.lphoto || null, res = await landing(Object.assign({}, L, { photoBlob: photo, say }));
      say("تم التصميم — جارٍ فتح الصفحة…", "", true);
      close(true); const f = await landingOpen(res, { photoBlob: photo, say: m => toast(m) });
      toast("✅ صفحة هبوط من " + res.page.sections.length + " قسماً: رُكّبت " + f.placed + " من " + f.total + " أصل من اللوحة" + (f.filled ? " + " + f.filled + " صورة وُلّدت منفردة" : "") + (f.left ?" — بقيت " + f.left + " صورة فارغة (زر «🧩 تصميم بطبقات» ← «🖼️ توليد الصور الفارغة» يكملها)" : ""));
    } catch (e) {
      S.busy = false; uiL(false); say(e.name === "AbortError" ? "أُلغيت العملية." : e.code === "NOKEY" ? "لم يُضبط مفتاح Alyssum API بعد." : e.code === "OFF" ? "التوليد الذكي معطّل في الإعدادات." : "تعذّر الإنشاء: " + (e.message || e) + " — لم يضِع شيء، يمكنك إعادة المحاولة.", "err"); return;
    }
    S.busy = false;
  }
  function landHtml() {
    const ps = prodsList(), L = O.land || {}, sel = (v, a) => v === a ? " selected" : "";
    return '<div class="ml-card" data-m="land"><h4>1. المنتج</h4><label class="f" for="ml-lprod">منتج المتجر</label><select id="ml-lprod"><option value="">— بلا ربط بمنتج —</option>' + ps.map(p => '<option value="' + esc(p.slug) + '"' + (L.product === p.slug ? " selected" : "") + ">" + esc(p.title) + "</option>").join("") + '</select>' +
      '<label class="f" for="ml-lname">اسم المنتج (إن لم تختر منتجاً)</label><input id="ml-lname" value="' + esc(L.name || "") + '"><label class="f" for="ml-ldesc">وصف المنتج</label><textarea id="ml-ldesc" placeholder="ما هو، لمن، أبرز فوائده">' + esc(L.desc || "") + '</textarea>' +
      '<label class="f" for="ml-lprice">السعر (يظهر في الصفحة كما هو)</label><input id="ml-lprice" value="' + esc(L.price || "") + '" placeholder="مثال: 1800"><label class="f" for="ml-lphoto">صورة المنتج الحقيقية (اختياري — تُستعمل كما هي ولا تُولَّد)</label><input type="file" id="ml-lphoto" accept="image/*"><div class="ml-hint" id="ml-lphotost">بلا صورة: يُستعمل غلاف المنتج المختار.</div></div>' +
      '<div class="ml-card" data-m="land"><h4>2. التصميم</h4><label class="f" for="ml-lmethod">الطريقة</label><select id="ml-lmethod"><option value="image"' + sel(L.method || "image", "image") + '>صفحة طويلة مرسومة كاملة مثل المنشئ الذكي ثم تفكيكها إلى طبقات (الأفضل شكلاً)</option><option value="layers"' + sel(L.method, "layers") + '>تخطيط بالكود (نصوص وأسعار حقيقية) + صور مرسومة</option></select><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label class="f" for="ml-llang">اللغة</label><select id="ml-llang"><option value="ar"' + sel(L.lang, "ar") + '>العربية</option><option value="fr"' + sel(L.lang, "fr") + '>الفرنسية</option><option value="en"' + sel(L.lang, "en") + '>الإنجليزية</option></select></div><div><label class="f" for="ml-ltype">النوع</label><select id="ml-ltype"><option value="landing"' + sel(L.type, "landing") + '>صفحة هبوط كاملة</option><option value="banner"' + sel(L.type, "banner") + '>بنر / إعلان</option></select></div></div>' +
      '<label class="f" for="ml-lcol">ألوان العلامة (اختياري)</label><input id="ml-lcol" value="' + esc(L.colors || "") + '" placeholder="مثال: #1e5e20 و #c8a24b"><label class="f" for="ml-lgoal">الجمهور والأسلوب (اختياري)</label><input id="ml-lgoal" value="' + esc(L.goal || "") + '" placeholder="مثال: أمهات الأطفال — أسلوب فاخر بألوان خضراء وذهبية">' +
      '<div style="margin-top:12px;display:grid;gap:8px"><button class="b g w" id="ml-land-go" type="button">🚀 أنشئ صفحة هبوط كاملة بطبقات</button><button class="b o w" id="ml-lcancel" type="button" hidden>إلغاء</button></div>' +
      '<button class="b w" type="button" data-pbgen="1" style="margin-top:8px">📄 أريدها مثل المنشئ الذكي: فكّك آخر صفحة منه إلى طبقات</button><div class="ml-hint">للحصول على نفس جودة صفحة «صفحة هبوط ذكية» (صورة طويلة مرسومة كاملة): ولّدها من هناك أولاً ثم اضغط الزر أعلاه — تُفكَّك إلى عناصر ونصوص حقيقية.</div><div class="ml-hint">يصمّم الذكاء الاصطناعي الصفحة بنفس برومبت المطوّر الذكي (أقسام ونصوص وأسعار حقيقية وقسم طلب)، ثم تُرسم كل صورها في لوحة أصول واحدة وتُقصّ وتُوزَّع على الطبقات. ما لم يُقصّ بدقة يبقى فارغاً ويُكمل بزر «توليد الصور الفارغة».</div></div>';
  }
  function setMode(m) {
    O.mode = m === "land" ? "land" : "ext"; saveO(); document.querySelectorAll("#ml-bg [data-m]").forEach(e => { e.style.display = e.dataset.m === O.mode ? "" : "none"; });
    document.querySelectorAll("#ml-bg [data-mt]").forEach(e => e.classList.toggle("on", e.dataset.mt === O.mode));
    const em = $("ml-empty"); if (em && !S.src) em.innerHTML = O.mode === "land" ? "املأ بيانات المنتج ثم اضغط «أنشئ صفحة هبوط كاملة بطبقات».<br>ستُفتح الصفحة في المطوّر." : "ارفع صورة ثم اضغط «استخرج كل العناصر».<br>ستظهر الطبقات هنا.";
  }
  const CSS = '#ml-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(3,10,7,.94);color:#fff;display:flex;flex-direction:column;direction:rtl;font:14px/1.5 Cairo,system-ui,sans-serif}#ml-bg *{box-sizing:border-box}' +
    '#ml-top{display:flex;align-items:center;gap:.7rem;padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,.12);background:rgba(9,24,18,.98)}#ml-top h3{margin:0;font-size:1.05rem}#ml-top small{color:rgba(255,255,255,.7)}#ml-top .sp{flex:1}' +
    '#ml-main{flex:1;min-height:0;display:grid;grid-template-columns:320px minmax(0,1fr) 340px;gap:12px;padding:12px}@media(max-width:1000px){#ml-main{grid-template-columns:1fr;overflow:auto}}' +
    '#ml-main section{min-height:0;overflow:auto}.ml-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px;margin-bottom:12px}.ml-card h4{margin:0 0 8px;font-size:.78rem;letter-spacing:.4px;color:rgba(255,255,255,.75)}' +
    '#ml-bg label.f{display:block;font-size:.78rem;color:rgba(255,255,255,.8);margin:9px 0 3px;font-weight:700}#ml-bg select,#ml-bg input[type=number],#ml-bg input[type=text],#ml-bg textarea{width:100%;padding:7px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#fff;font:inherit}#ml-bg select option{background:#0b1d15;color:#fff}#ml-bg textarea{resize:vertical;min-height:50px}' +
    '#ml-bg button.b{font:inherit;cursor:pointer;border-radius:12px;color:#fff;padding:8px 14px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -6px 10px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s,background .15s}#ml-bg button.b:hover:not(:disabled){transform:translateY(-2px);background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.08))}' +
    '#ml-bg button.b.g{border-color:rgba(var(--g-mint-rgb,198,254,23),.5);background:linear-gradient(180deg,rgba(var(--g-mint-rgb,198,254,23),.34),rgba(var(--g-mint-rgb,198,254,23),.12))}#ml-bg button.b.o{border-color:rgba(251,146,60,.55);background:linear-gradient(180deg,rgba(251,146,60,.34),rgba(251,146,60,.12))}#ml-bg button.b.w{width:100%}#ml-bg button.b:disabled{opacity:.45;cursor:not-allowed}' +
    '#ml-drop{border:2px dashed rgba(255,255,255,.25);border-radius:12px;padding:14px;text-align:center;color:rgba(255,255,255,.75);cursor:pointer}#ml-drop.over,#ml-drop:hover{border-color:rgba(var(--g-mint-rgb,198,254,23),.8);color:#fff}#ml-drop img{max-width:100%;max-height:130px;border-radius:8px;display:block;margin:0 auto 6px}' +
    '.ml-chk{display:flex;gap:7px;align-items:center;font-size:.8rem;color:rgba(255,255,255,.85);margin-top:7px}.ml-chk input{margin:0}.ml-hint{font-size:.75rem;color:rgba(255,255,255,.62);margin-top:5px}' +
    '#ml-st{margin-top:10px;font-size:.82rem;min-height:20px;display:flex;gap:7px;align-items:flex-start}#ml-st.err{color:#fca5a5}#ml-st.ok{color:var(--g-mint,#c6fe17)}.ml-spin{width:13px;height:13px;border:2px solid rgba(255,255,255,.25);border-top-color:var(--g-mint,#c6fe17);border-radius:50%;animation:mlsp .8s linear infinite;flex:none;margin-top:4px;display:inline-block}@keyframes mlsp{to{transform:rotate(360deg)}}' +
    '.ml-tb{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;align-items:center}.ml-tb .sp{flex:1}.ml-tb kbd{background:rgba(255,255,255,.1);border-radius:4px;padding:0 4px;font-size:.7rem}' +
    '#ml-view{height:calc(100% - 44px);min-height:300px;overflow:auto;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;padding:12px;direction:ltr}' +
    '#ml-sizer{position:relative;flex:none;touch-action:none;user-select:none;background:conic-gradient(#2a2f2c 25%,#383e3a 0 50%,#2a2f2c 0 75%,#383e3a 0) 0 0/16px 16px;box-shadow:0 2px 20px rgba(0,0,0,.5)}#ml-stage{position:absolute;left:0;top:0;transform-origin:0 0}#ml-stage canvas.ml-layer{position:absolute;pointer-events:none}' +
    '#ml-selbox{position:absolute;display:none;pointer-events:none;border:calc(2px*var(--u,1)) solid #5da0ff;z-index:100000}#ml-selbox .h{position:absolute;pointer-events:auto;background:#fff;border:calc(2px*var(--u,1)) solid #5da0ff;width:calc(12px*var(--u,1));height:calc(12px*var(--u,1));margin:calc(-6px*var(--u,1)) 0 0 calc(-6px*var(--u,1))}' +
    '#ml-selbox .h[data-h=nw]{left:0;top:0;cursor:nwse-resize}#ml-selbox .h[data-h=ne]{left:100%;top:0;cursor:nesw-resize}#ml-selbox .h[data-h=sw]{left:0;top:100%;cursor:nesw-resize}#ml-selbox .h[data-h=se]{left:100%;top:100%;cursor:nwse-resize}#ml-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.6);text-align:center;padding:30px}' +
    '#ml-layers{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;max-height:58vh;overflow:auto}.ml-row{display:grid;grid-template-columns:48px 1fr;gap:8px;padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.05);cursor:pointer}.ml-row.sel{border-color:#5da0ff;box-shadow:0 0 0 1px #5da0ff inset}.ml-row.off{opacity:.5}' +
    '.ml-th{width:48px;height:48px;border-radius:6px;background:conic-gradient(#2a2f2c 25%,#383e3a 0 50%,#2a2f2c 0 75%,#383e3a 0) 0 0/10px 10px}.ml-meta{min-width:0}.ml-nm{width:100%;padding:2px 6px!important;font-size:.82rem;background:transparent!important;border-color:transparent!important}.ml-nm:hover,.ml-nm:focus{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.2)!important}' +
    '.ml-btns{display:flex;gap:3px;align-items:center;margin-top:3px}.ml-btns input[type=range]{flex:1;min-width:36px;accent-color:var(--g-mint,#c6fe17)}.ml-ib{padding:3px;line-height:0;border-radius:6px;background:transparent;border:1px solid transparent;color:rgba(255,255,255,.65);cursor:pointer}.ml-ib:hover{color:#fff;border-color:rgba(255,255,255,.25)}.ml-ib.on{color:var(--g-mint,#c6fe17)}.ml-ib svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.ml-tag{color:rgba(255,255,255,.5);font-size:.68rem}.ml-none{color:rgba(255,255,255,.6);text-align:center;padding:14px;font-size:.82rem}.ml-exp{display:grid;gap:8px;margin-top:10px}.ml-modes{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}.ml-modes button{padding:.55rem .4rem;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font:800 .82rem inherit;font-family:inherit;cursor:pointer;backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -3px 6px rgba(0,0,0,.18)}.ml-modes button.on{background:rgba(198,254,23,.25);border-color:rgba(198,254,23,.55)}';
  const cssOnce = () => { if ($("ml-css")) return; const st = document.createElement("style"); st.id = "ml-css"; st.textContent = CSS; document.head.appendChild(st); };
  function readOpts() {
    const v = (id, d) => { const e = $(id); return e ? e.value : d; }, c = id => { const e = $(id); return e ? !!e.checked : true; };
    O.max = Math.max(10, Math.min(200, +v("ml-max", O.max) || 80)); O.cover = v("ml-cover", O.cover); O.local = c("ml-local"); O.api = c("ml-api"); O.bg = v("ml-bgm", O.bg); O.ctx = v("ml-ctx", O.ctx).trim(); O.realText = c("ml-rt"); saveO();
  }
  function ui(busy) { const g = $("ml-go"), c = $("ml-cancel"); if (g) g.disabled = !!busy || !S.src; if (c) c.hidden = !busy; }
  async function loadPbgenLast() {
    const r = await new Promise(res => { try { const rq = indexedDB.open("pbgen", 1); rq.onupgradeneeded = () => { try { rq.transaction.abort(); } catch (_) { } }; rq.onerror = () => res(null); rq.onsuccess = () => { try { const g = rq.result.transaction("kv", "readonly").objectStore("kv").get("last"); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); } catch (_) { res(null); } }; } catch (_) { res(null); } });
    const blob = (typeof PBGen !== "undefined" && PBGen.S && PBGen.S.blob) || (r && r.blob);
    if (!blob) { say("لا توجد صفحة مولّدة من «صفحة هبوط ذكية» بعد — ولّدها أولاً من تبويب الصفحات.", "err"); return; }
    setMode("ext"); await loadSource(blob); say("حُمّلت آخر صفحة من المنشئ الذكي — اضغط «استخرج كل العناصر».", "ok");
  }
  async function loadSource(blob) {
    if (!blob || !(blob.type || "").startsWith("image/")) return;
    let bm; try { bm = await createImageBitmap(blob); } catch (e) { say("الصورة غير مقروءة.", "err"); return; }
    /* تصغير الصور الضخمة (>4096) كي لا تُثقل الذاكرة */
    const k = Math.min(1, 4096 / Math.max(bm.width, bm.height)), c = mk(bm.width * k, bm.height * k); c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height); S.src = c; S.blob = k < 1 ? await toBlob(c, "image/png") : blob;
    const di = $("ml-dropin"); if (di) { di.innerHTML = ""; const im = new Image(); im.src = URL.createObjectURL(S.blob); di.appendChild(im); const t = document.createElement("div"); t.textContent = c.width + " × " + c.height + " px — اضغط للتغيير"; di.appendChild(t); }
    clearLayers(); setStage(c.width, c.height); const em = $("ml-empty"); if (em) em.style.display = "none";
    const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; o.getContext("2d").drawImage(c, 0, 0);
    const l = addLayer(o, "الصورة الأصلية", { kind: "background", how: "bg" }); layout(); renderList(); updateButtons(); ui(false);
    say("الصورة جاهزة (" + c.width + "×" + c.height + "). اضغط «استخرج كل العناصر».");
  }
  function optsHtml() {
    const sel = (v, a) => v === a ? " selected" : "";
    return '<div class="ml-modes"><button type="button" data-mt="ext">🪄 تفكيك صورة</button><button type="button" data-mt="land">🚀 صفحة هبوط كاملة</button></div>' + landHtml() + '<div class="ml-card" data-m="ext"><h4>1. الصورة</h4><div id="ml-drop" tabindex="0" role="button"><div id="ml-dropin">اسحب صورة هنا، أو اضغط للاختيار، أو الصقها (Ctrl+V)</div></div><input type="file" id="ml-file" accept="image/*" hidden><button class="b w" type="button" data-pbgen="1" style="margin-top:8px">📄 استعمل آخر صفحة من «صفحة هبوط ذكية»</button><div class="ml-hint">الصفحة الطويلة التي ولّدها المنشئ الذكي (بنصوصها المرسومة) تُفكَّك هنا إلى صور ونصوص حقيقية قابلة للتعديل.</div></div>' +
      '<div class="ml-card" data-m="ext"><h4>2. الاستخراج</h4>' +
      '<div class="ml-chk"><input type="checkbox" id="ml-api"' + (O.api ? " checked" : "") + '><label for="ml-api" style="margin:0">Alyssum API: يعدّد كل العناصر (يحتاج مفتاحاً)</label></div>' +
      '<div class="ml-chk"><input type="checkbox" id="ml-local"' + (O.local ? " checked" : "") + '><label for="ml-local" style="margin:0">كشف وأقنعة محلية (SAM) — مجاني، يُحمَّل نموذج مرة واحدة</label></div>' +
      '<div class="ml-chk"><input type="checkbox" id="ml-rt"' + (O.realText ? " checked" : "") + '><label for="ml-rt" style="margin:0">تحويل النصوص إلى نص حقيقي قابل للتعديل (ويُمسح النص من الخلفية)</label></div>\n      <label class="f" for="ml-cover">مستوى الشمول</label><select id="ml-cover"><option value="fast"' + sel(O.cover, "fast") + '>سريع — مرور واحد ومتبقٍ</option><option value="dense"' + sel(O.cover, "dense") + '>شامل — تجزئة 2×2 ومرورا متبقٍ</option><option value="max"' + sel(O.cover, "max") + '>أقصى — تجزئة 3×3 وثلاثة مرورات (للخلفيات المعقّدة)</option></select>' +
      '<div class="row2" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label class="f" for="ml-max">أقصى عدد للعناصر</label><input type="number" id="ml-max" min="10" max="200" value="' + O.max + '"></div><div><label class="f" for="ml-bgm">الخلفية</label><select id="ml-bgm"><option value="auto"' + sel(O.bg, "auto") + '>تلقائي</option><option value="orig"' + sel(O.bg, "orig") + '>الصورة الأصلية</option><option value="local"' + sel(O.bg, "local") + '>ترميم محلي</option><option value="api"' + sel(O.bg, "api") + '>ترميم Alyssum API</option></select></div></div>' +
      '<label class="f" for="ml-ctx">وصف الصورة (اختياري)</label><textarea id="ml-ctx" placeholder="مثال: إعلان بقارورة ونصوص وزخارف على خلفية مزدحمة">' + esc(O.ctx) + '</textarea>' +
      '<div style="margin-top:12px;display:grid;gap:8px"><button class="b g w" id="ml-go" type="button" disabled>🪄 استخرج كل العناصر</button><button class="b o w" id="ml-cancel" type="button" hidden>إلغاء</button></div>' +
      '<div class="ml-hint">الشامل والأقصى يرسلان عدة طلبات (الصورة كاملة + مربعات + المتبقي) ليلتقطا العناصر الصغيرة والنصوص حتى على خلفية مزدحمة. القص الدقيق بـSAM المحلي إن كان متاحاً، وإلا بمضلّع من Alyssum API.</div></div>' + '<div id="ml-st" role="status"></div>';
  }
  function open(init) {
    cssOnce(); close(true); S.open = true;
    const bg = document.createElement("div"); bg.id = "ml-bg"; bg.setAttribute("role", "dialog"); bg.setAttribute("aria-label", "Magic Layers");
    bg.innerHTML = '<div id="ml-top"><h3>🪄 Magic Layers</h3><small>فكّك أي صورة إلى طبقات مستقلة: حرّكها وغيّر حجمها وصدّرها</small><span class="sp"></span><button class="b" id="ml-x" type="button">إغلاق</button></div>' +
      '<div id="ml-main"><section>' + optsHtml() + '</section>' +
      '<section><div class="ml-tb"><button class="b" id="ml-fit" type="button">ملاءمة</button><button class="b" id="ml-rev" type="button" title="عكس ترتيب الطبقات">عكس الترتيب</button><button class="b" id="ml-desel" type="button">إلغاء التحديد</button><span class="sp"></span><span class="ml-hint" style="margin:0">الأسهم: تحريك (<kbd>Shift</kbd> = 10) · <kbd>Del</kbd> حذف · <kbd>Shift</kbd>+زاوية: تشويه</span></div>' +
      '<div id="ml-view"><div id="ml-sizer"><div id="ml-stage"><div id="ml-selbox"><i class="h" data-h="nw"></i><i class="h" data-h="ne"></i><i class="h" data-h="sw"></i><i class="h" data-h="se"></i></div></div><div id="ml-empty">ارفع صورة ثم اضغط «استخرج كل العناصر».<br>ستظهر الطبقات هنا.</div></div></div></section>' +
      '<section><div class="ml-card"><h4>الطبقات <span id="ml-count"></span></h4><ul id="ml-layers"></ul><div class="ml-exp"><button class="b o w" id="ml-send" type="button" disabled>🎨 أرسل إلى المطوّر (عناصر قابلة للتعديل)</button><button class="b g w" id="ml-zip" type="button" disabled>⬇ ZIP (PNG لكل طبقة + manifest)</button><button class="b w" id="ml-png" type="button" disabled>⬇ الصورة المركّبة PNG</button></div><div class="ml-hint">كل طبقة تُصدَّر بحجم الصفحة وفي موضعها الحالي فتنطبق تماماً في فوتوشوب وفيجما وCanva.</div></div></section></div>';
    document.body.appendChild(bg);
    const drop = $("ml-drop"), file = $("ml-file");
    drop.onclick = () => file.click(); drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } };
    file.onchange = () => loadSource(file.files[0]);
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => loadSource(e.dataTransfer.files[0]));
    document.querySelectorAll("#ml-bg [data-pbgen]").forEach(b => b.onclick = loadPbgenLast);
    $("ml-x").onclick = () => close(); $("ml-go").onclick = generate; $("ml-cancel").onclick = () => { if (S.run) S.run.cancelled = true; };
    $("ml-fit").onclick = fit; $("ml-desel").onclick = () => select(null); $("ml-rev").onclick = () => { S.layers.reverse(); layout(); renderList(); };
    $("ml-zip").onclick = exportZip; $("ml-png").onclick = async () => download(await toBlob(composite()), "magic-layers.png"); $("ml-send").onclick = sendToBuilder;
    const sz = $("ml-sizer"); sz.addEventListener("pointerdown", onDown); sz.addEventListener("pointermove", onMove); sz.addEventListener("pointerup", onUp); sz.addEventListener("pointercancel", onUp);
    ["ml-api", "ml-local", "ml-rt", "ml-cover", "ml-max", "ml-bgm", "ml-ctx"].forEach(id => { const e = $(id); if (e) e.addEventListener("change", readOpts); });
    document.querySelectorAll("#ml-bg [data-mt]").forEach(e => e.addEventListener("click", () => setMode(e.dataset.mt)));
    ["ml-lprod", "ml-lname", "ml-ldesc", "ml-llang", "ml-ltype", "ml-lcol", "ml-lgoal"].forEach(id => { const e = $(id); if (e) e.addEventListener("change", readLand); });
    $("ml-land-go").onclick = runLanding; $("ml-lcancel").onclick = () => { if (S.run) S.run.cancelled = true; };
    $("ml-lphoto").onchange = e => { const f = e.target.files[0]; S.lphoto = f && f.type.startsWith("image/") ? f : null; const t = $("ml-lphotost"); if (t) t.textContent = S.lphoto ? "ستُستعمل صورتك كما هي: " + S.lphoto.name : "بلا صورة: يُستعمل غلاف المنتج المختار."; };
    setMode(O.mode || "ext"); uiL(S.busy);
    window.addEventListener("keydown", onKey); window.addEventListener("resize", fit); window.addEventListener("paste", onPaste);
    /* إعادة بناء المسرح من الحالة المحفوظة (عند إعادة الفتح) */
    if (S.src) { setStage(S.W, S.H); $("ml-empty").style.display = "none"; const keep = S.layers; S.layers = []; keep.forEach(l => { const st = $("ml-stage"); l.canvas.className = "ml-layer"; st.insertBefore(l.canvas, $("ml-selbox")); S.layers.push(l); }); layout(); renderList(); updateButtons(); const di = $("ml-dropin"); if (di && S.blob) { di.innerHTML = ""; const im = new Image(); im.src = URL.createObjectURL(S.blob); di.appendChild(im); } ui(S.busy); }
    else { renderList(); ui(false); say("ارفع صورة للبدء." + (hasKey() ? "" : " (لا مفتاح Alyssum API: سيعمل الكشف المحلي فقط)")); }
    fit(); if (init && init.blob) loadSource(init.blob);
  }
  function onPaste(e) { if (!S.open) return; const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.type.startsWith("image/")); if (it) loadSource(it.getAsFile()); }
  function close(quiet) {
    const b = $("ml-bg"); if (b) b.remove(); window.removeEventListener("keydown", onKey); window.removeEventListener("resize", fit); window.removeEventListener("paste", onPaste);
    if (!quiet && S.run) S.run.cancelled = true; S.open = false;
  }
  return { open, close, S, O, _t: { textProps, tilesFor, parseItems, norm, dedupe, iou, polyMask, keyOut, makeZip, crc32, detectApi, layerFromApi, generate, loadSource, composite, DETECT, COVER, listed, loadPbgenLast, landing, landingOpen, gridFor, sheetPrompt, findBlobs, assignCells, cutWhite, emptyAssets, landExtra, setMode, runLanding } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MagicLayers;
