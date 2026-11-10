/* ألوان الصفحة بضغطة واحدة (لوحات ألوان متناسقة حسب ألوان المنتج): تُستخرج ألوان المنتج الغالبة من صورته، وتُبنى منها لوحات (من المنتج، هادئ، نابض، متناظر، ثلاثي، أحادي، داكن…)،
   وعند اختيار لوحة تُعاد تلوين الصفحة كلها (خلفيات الأقسام والبطاقات والأشكال، النصوص، الأزرار، التدرّجات، CSS الصفحة، وألوان style المضمَّنة في النصوص) بتحويل التدرّج اللوني:
   الألوان المشبعة تُنقل إلى ألوان اللوحة بحسب مجموعات الألوان في الصفحة نفسها (الأكثر استعمالاً ← الأساسي، ثم الثانوي)، والمحايدة الفاتحة تأخذ مسحة اللوحة، والداكنة تُعكَس للّوحات الداكنة.
   التراجع: Ctrl+Z (تُسجَّل خطوة واحدة). لا تغيّر الصور. */
const PBPalette = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const h2r = h => { h = h.replace("#", ""); if (h.length === 3 || h.length === 4) h = h.split("").map(x => x + x).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? Math.round(parseInt(h.slice(6, 8), 16) / 255 * 1000) / 1000 : 1]; };
  const r2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, c = mx - mn; let h = 0, s = 0; if (c) { s = c / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h *= 60; if (h < 0) h += 360; } return { h, s, l, c }; };
  const hsl2r = (h, s, l) => { h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1); const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]; };
  const toHex = (r, g, b) => "#" + [r, g, b].map(x => ("0" + clamp(x, 0, 255).toString(16)).slice(-2)).join("");
  const hslHex = (h, s, l) => toHex(...hsl2r(h, s, l));
  const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g, RGB_RE = /rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/g;
  const parseColor = s => { s = String(s).trim(); let m; if ((m = /^#([0-9a-f]{3,8})$/i.exec(s)) && [3, 4, 6, 8].includes(m[1].length)) { const [r, g, b, a] = h2r(s); return { r, g, b, a }; } if ((m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(s))) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4])) }; return null; };
  const KEYSKIP = /^(html|code|text|alt|src|link|cls|id|title|href|css|desc|kw|seoTitle|slug|sname|stkt|msg|label|ph|tbl|items|ottl|obtn|cnow|cold|csave|pst)$/;      // مفاتيح نصية لا تُلوَّن مباشرة (النصوص المضمَّنة تُعالَج بخاصية style فقط)
  /* ───── تحليل: كل ألوان الصفحة (للمجموعات) ───── */
  function walkPage(page, fn) {
    const str = (s, key) => {
      if (typeof s !== "string") return s; if (KEYSKIP.test(key || "")) { if (key === "html" || key === "code") return inlineStyles(s, fn); return s; }
      let out = s; if (parseColor(s)) return fn(s); if (/gradient\(|rgba?\(|#[0-9a-f]{3,8}/i.test(s) && !/^(https?:|assets\/|data:|\/)/.test(s) && s.length < 800) { out = s.replace(RGB_RE, m => fn(m)).replace(HEX_RE, m => fn(m)); } return out; };
    const rec = (o, key) => { if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (v && typeof v === "object") rec(v, key); else if (typeof v === "string") o[i] = str(v, key); } } else if (o && typeof o === "object") { for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === "object") rec(v, k); else if (typeof v === "string") o[k] = str(v, k); } } };
    rec(page.sections, ""); rec(page.header, ""); rec(page.footer, ""); if (typeof page.bg === "string") page.bg = str(page.bg, "bg"); if (typeof page.css === "string") page.css = page.css.replace(RGB_RE, m => fn(m)).replace(HEX_RE, m => fn(m)); if (typeof page.ccss === "string") page.ccss = page.ccss.replace(RGB_RE, m => fn(m)).replace(HEX_RE, m => fn(m));
  }
  function inlineStyles(html, fn) { return String(html).replace(/(style|color|bgcolor)\s*=\s*("[^"]*"|'[^']*')/gi, (m0, a, q) => a + "=" + q.replace(RGB_RE, m => fn(m)).replace(HEX_RE, m => fn(m))); }
  function stats(page) {
    const hues = [], all = []; const fn = c => { const q = parseColor(c); if (q && q.a > 0.05) { const t = r2hsl(q.r, q.g, q.b); all.push(t); if (t.c > 0.12 * 1 && t.l > 0.12 && t.l < 0.9 && t.s > 0.2) hues.push({ h: t.h, w: 0.3 + t.s * (1 - Math.abs(t.l - 0.5) * 1.2) }); } return c; };
    walkPage(JSON.parse(JSON.stringify(page)), fn);
    // تجميع الألوان في مجموعات (ضمن 28°)
    const bins = []; hues.sort((a, b) => a.h - b.h).forEach(x => { const b = bins.find(q => Math.abs(q.h - x.h) < 28 || Math.abs(q.h - x.h) > 332); if (b) { b.h = (b.h * b.w + x.h * x.w) / (b.w + x.w); b.w += x.w; } else bins.push({ h: x.h, w: x.w }); });
    bins.sort((a, b) => b.w - a.w); return { clusters: bins.slice(0, 3), n: all.length };
  }
  /* ───── ألوان المنتج: غالب الألوان من صورة الغلاف ───── */
  function productImage(page) {
    try { const A = typeof Admin !== "undefined" ? Admin : null, slug = page.product || ""; const p = A && A.products && slug ? A.products.find(x => x.slug === slug) : null; return (p && (p.cover || (p.images || [])[0])) || page.cover || ((page.media || [])[0]) || ""; } catch (e) { return ""; }
  }
  function dominant(src) {
    return new Promise(res => {
      if (!src) return res([]); const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => {
        try {
          const W = 64, H = Math.max(8, Math.round(64 * im.naturalHeight / Math.max(1, im.naturalWidth))), cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d"); cx.drawImage(im, 0, 0, W, H); const d = cx.getImageData(0, 0, W, H).data, bins = Array.from({ length: 24 }, () => ({ w: 0, s: 0, l: 0, hs: 0, hc: 0, x: 0, y: 0 }));
          for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const t = r2hsl(d[i], d[i + 1], d[i + 2]); if (t.s < 0.25 || t.l < 0.14 || t.l > 0.9) continue; const w = t.s * (1 - Math.abs(t.l - 0.5) * 1.4), b = bins[Math.floor(t.h / 15) % 24]; b.w += w; b.s += t.s * w; b.l += t.l * w; const a = t.h * Math.PI / 180; b.x += Math.cos(a) * w; b.y += Math.sin(a) * w; }
          const out = []; bins.map((b, i) => ({ b, i })).sort((a, c) => c.b.w - a.b.w).forEach(({ b }) => { if (b.w < 0.5 || out.length >= 3) return; const h = (Math.atan2(b.y, b.x) * 180 / Math.PI + 360) % 360; if (out.every(o => Math.min(Math.abs(o.h - h), 360 - Math.abs(o.h - h)) >= 38)) out.push({ h, s: b.s / b.w, l: b.l / b.w, w: b.w }); });
          res(out);
        } catch (e) { res([]); }
      }; im.onerror = () => res([]); im.src = /^(https?:|data:|\/)/.test(src) ? src : new URL(src, location.href).href;
    });
  }
  /* ───── اللوحات ───── */
  function palettes(dom, clusters) {
    const H1 = dom[0] ? dom[0].h : (clusters[0] ? clusters[0].h : 150), H2 = dom[1] ? dom[1].h : ((H1 + 35) % 360), H3 = dom[2] ? dom[2].h : ((H1 + 320) % 360), S = dom[0] ? clamp(dom[0].s, 0.35, 0.9) : 0.6;
    const P = (id, name, hs, o) => Object.assign({ id, name, hs, sat: 1, dark: false, nh: hs[0], ns: 0.35 }, o || {});
    const list = [
      P("prod", "من ألوان المنتج", [H1, H2, H3], { sat: clamp(S / 0.6, 0.75, 1.15) }),
      P("soft", "هادئ", [H1, H1 + 22, H1 - 22], { sat: 0.62, ns: 0.3 }),
      P("vivid", "نابض", [H1, H2, H1 + 180], { sat: 1.18 }),
      P("comp", "متناظر", [H1, H1 + 180, H1 + 150]),
      P("tri", "ثلاثي", [H1, H1 + 120, H1 + 240]),
      P("mono", "أحادي", [H1, H1 + 8, H1 - 8], { sat: 0.82 }),
      P("dark", "داكن فاخر", [H1, H2, H3], { dark: true, sat: 0.95, ns: 0.45 }),
      P("dark2", "داكن هادئ", [H1 + 20, H1, H1 - 20], { dark: true, sat: 0.7, ns: 0.3 }),
      P("warm", "دافئ", [28, 8, 44], { sat: 1 }), P("nature", "طبيعي", [140, 92, 44], { sat: 0.95 }), P("sea", "بحري", [205, 182, 28], { sat: 0.95 }), P("rose", "وردي", [338, 12, 280], { sat: 0.9 })
    ];
    list.forEach(p => { const sw = swatches(p); p.sw = sw; });
    return list;
  }
  function swatches(p) {
    const s = clamp(0.62 * p.sat, 0.2, 0.95);
    return p.dark ? { bg: hslHex(p.nh, p.ns * 0.55, 0.09), surface: hslHex(p.nh, p.ns * 0.45, 0.15), text: hslHex(p.nh, 0.25, 0.93), primary: hslHex(p.hs[0], s, 0.62), accent: hslHex(p.hs[1], clamp(s + 0.1, 0, 1), 0.58), soft: hslHex(p.hs[0], s * 0.6, 0.24) }
      : { bg: hslHex(p.nh, p.ns, 0.965), surface: "#ffffff", text: hslHex(p.hs[0], clamp(s * 0.9, 0, 1), 0.2), primary: hslHex(p.hs[0], s, 0.36), accent: hslHex(p.hs[1], clamp(s + 0.15, 0, 1), 0.52), soft: hslHex(p.hs[0], s * 0.6, 0.9) };
  }
  /* ───── التحويل ───── */
  function mapper(pal, clusters) {
    const cl = clusters.length ? clusters : [{ h: 150 }]; const dist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    return str => {
      const q = parseColor(str); if (!q) return str; const t = r2hsl(q.r, q.g, q.b); let { h, s, l } = t, out;
      if (q.a <= 0.01) return str;
      if (t.c < 0.06 || (l > 0.935 && s > 0.0) || l < 0.05 || s < 0.1) {      // محايد: أبيض/كريمي فاتح/رمادي/أسود
        if (pal.dark) { const nl = l > 0.9 ? 0.07 + (1 - l) * 0.6 : l > 0.7 ? 0.14 + (0.9 - l) * 0.25 : l > 0.4 ? 0.3 + (0.7 - l) * 0.3 : 0.9 + (0.4 - l) * 0.15; out = hslHex(pal.nh, pal.ns * (l > 0.7 ? 0.5 : 0.3), clamp(nl, 0.04, 0.97)); }
        else if (l > 0.985 && t.c < 0.04) out = toHex(q.r, q.g, q.b);      // الأبيض النقي (البطاقات) يبقى أبيض
        else out = hslHex(pal.nh, l > 0.935 ? pal.ns : Math.min(pal.ns, 0.25) * (l > 0.5 ? 0.6 : 0.4), l);
      } else {
        const ci = cl.reduce((bi, c, i) => dist(c.h, h) < dist(cl[bi].h, h) ? i : bi, 0), ph = pal.hs[Math.min(ci, pal.hs.length - 1)], nh = ph + (h - cl[ci].h) * 0.35, ns = clamp(s * pal.sat, 0.05, 1);
        let nl = l; if (pal.dark) nl = l < 0.4 ? 0.82 + (0.4 - l) * 0.2 : l > 0.7 ? 0.16 + (0.9 - l) * 0.2 : Math.max(l, 0.5);
        out = hslHex(nh, ns, clamp(nl, 0.04, 0.97));
      }
      if (q.a < 1) { const r = h2r(out); return "rgba(" + r[0] + ", " + r[1] + ", " + r[2] + ", " + (Math.round(q.a * 100) / 100) + ")"; }
      return out;
    };
  }
  /* عكس اللوحة الداكنة: يعيد الألوان إلى فاتحة تقريباً (معكوس دالة mapper الداكنة) قبل تطبيق أي لوحة جديدة، وإلا بقيت الخلفيات الداكنة القديمة وتلوّنت فوقها اللوحة الجديدة */
  function undark() {
    return str => {
      const q = parseColor(str); if (!q || q.a <= 0.01) return str; const t = r2hsl(q.r, q.g, q.b); const { h, s, l } = t; let nl = l;
      if (t.c < 0.06 || l < 0.05 || l > 0.935 || s < 0.1) { nl = l >= 0.86 ? 0.4 - (l - 0.9) / 0.15 : l <= 0.135 ? 1 - (l - 0.07) / 0.6 : l <= 0.2 ? 0.9 - (l - 0.14) / 0.25 : l >= 0.3 && l <= 0.4 ? 0.7 - (l - 0.3) / 0.3 : l; nl = clamp(nl, 0.02, 0.985); }
      else nl = l >= 0.78 ? clamp(0.4 - (l - 0.82) / 0.2, 0.12, 0.42) : l < 0.25 ? clamp(0.9 - (l - 0.16) / 0.2, 0.62, 0.95) : l;
      const out = hslHex(h, s, nl); if (q.a < 1) { const r = h2r(out); return "rgba(" + r[0] + ", " + r[1] + ", " + r[2] + ", " + (Math.round(q.a * 100) / 100) + ")"; } return out;
    };
  }
  /* ───── تنسيق التباين بين الخلفية والنص ───── */
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const l1 = lum(a.r, a.g, a.b), l2 = lum(b.r, b.g, b.b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
  const blend = (top, bot) => ({ r: Math.round(top.r * top.a + bot.r * (1 - top.a)), g: Math.round(top.g * top.a + bot.g * (1 - top.a)), b: Math.round(top.b * top.a + bot.b * (1 - top.a)), a: 1 });
  const firstColor = s => { const m = String(s).match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i); return m ? parseColor(m[0]) : null; };
  /* لون الخلفية الفعلي خلف العنصر: يصعد في أجداده؛ وللعناصر الحرة يبحث عن شكل (بطاقة) تحتها؛ null إن كانت الخلفية صورة */
  function effBg(fd, el, shapes) {
    const win = fd.defaultView, r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let acc = null;
    const push = c => { acc = acc ? blend(acc, c) : c; };
    // أشكال حرة تحت العنصر (الأعلى ترتيباً أولاً)
    if (el.classList.contains("pb-free")) {
      const under = shapes.filter(s => s.z < (Number(el.style.zIndex) || Infinity) && cx >= s.l && cx <= s.l + s.w && cy >= s.t && cy <= s.t + s.h).sort((a, b) => b.z - a.z)[0];
      if (under && under.c) { const q = under.c; if (q.a >= 0.99) return q; push(q); }
    }
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = win.getComputedStyle(n);
      if (cs.backgroundImage && /url\(/.test(cs.backgroundImage)) return acc ? acc : null;
      if (cs.backgroundImage && /gradient/.test(cs.backgroundImage)) { const q = firstColor(cs.backgroundImage); if (q) { push(q); if (q.a >= 0.99) return acc.a >= 0.99 ? acc : acc; } }
      const q = parseColor(cs.backgroundColor); if (q && q.a > 0.02) { if (q.a >= 0.99) return acc ? blend(acc, q) : q; push(q); }
      if (n.tagName === "HTML") break;
    }
    return acc ? blend(acc, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
  }
  /* يعدّل لوناً (بحفظ الصبغة) حتى يبلغ نسبة التباين المطلوبة مع الخلفية */
  function fitColor(c, bg, need) {
    if (ratio(c, bg) >= need) return null; const t = r2hsl(c.r, c.g, c.b), goLight = lum(bg.r, bg.g, bg.b) < 0.4;
    let best = null; for (let i = 1; i <= 40; i++) { const l = goLight ? clamp(t.l + i * 0.02, 0, 0.98) : clamp(t.l - i * 0.02, 0.03, 1); const [r, g, b] = hsl2r(t.h, clamp(t.s, 0, 0.9), l); if (ratio({ r, g, b }, bg) >= need + 0.2) { best = toHex(r, g, b); break; } }
    if (!best) best = goLight ? "#f8fafc" : "#0f172a"; return best;
  }
  let LASTFAILS = [];
  function fixContrast(dry) {
    LASTFAILS = [];
    const E = PBApp.E, fd = document.getElementById("pbx-frame") && document.getElementById("pbx-frame").contentDocument; if (!fd) return 0; let fixed = 0;
    const win = fd.defaultView;
    (E.page.sections || []).forEach(sec => {
      const sEl = fd.querySelector('[data-pb="' + sec.id + '"]'); if (!sEl) return; const sr = sEl.getBoundingClientRect();
      const shapes = (sec.free || []).filter(w => w.type === "shape").map(w => { const el = fd.querySelector('[data-pb="' + w.id + '"]'); if (!el) return null; const r = el.getBoundingClientRect(), fg = w.set.fgr && w.set.fgr.s && w.set.fgr.s[0], c = fg ? parseColor(fg.c) : parseColor(w.set.fill || ""); if (!c) return null; const op = w.set.fillOp !== undefined ? w.set.fillOp : (w.set.fgr ? 1 : 1); return { l: r.left, t: r.top, w: r.width, h: r.height, z: Number(w.set.zi) || 0, c: Object.assign({}, c, { a: (c.a === undefined ? 1 : c.a) * op }) }; }).filter(Boolean);
      const all = [...(sec.cols || []).flatMap(c => c.widgets || []), ...(sec.free || [])];
      all.forEach(w => {
        const el = fd.querySelector('[data-pb="' + w.id + '"]'); if (!el) return; const cs0 = win.getComputedStyle(el); if (cs0.display === "none" || cs0.visibility === "hidden") return;
        const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
        const bg = effBg(fd, el, shapes); if (!bg) return;
        const big = fs => fs >= 24 || (fs >= 19 && true), need = fs => big(fs) ? 3.2 : 4.6;
        if (w.type === "text" || w.type === "heading") {
          const t = el.querySelector(".pb-t") || el, cs = win.getComputedStyle(t), fs = parseFloat(cs.fontSize) / (sec.set.scaled ? Math.max(0.2, r.width / Math.max(1, (parseFloat(w.set.fwd && (w.set.fwd.d || 0)) || 1) / 100 * 1280)) : 1) || parseFloat(cs.fontSize), c = parseColor(cs.color);
          if (c) { const nc = fitColor(c, bg, need(Math.max(fs, 14))); if (nc) { (fixed++, dry && LASTFAILS.push(w.id + ":" + w.type)); if (!dry) w.set.color = nc; } }
          if (typeof w.set.html === "string" && /color\s*:\s*#?[0-9a-f]{3,8}/i.test(w.set.html)) { const nh = w.set.html.replace(/color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g, (m0, col) => { const q = parseColor(col); if (!q) return m0; const nc2 = fitColor(q, bg, 3.2); if (nc2) { (fixed++, dry && LASTFAILS.push(w.id + ":" + w.type)); return dry ? m0 : "color:" + nc2; } return m0; }); if (nh !== w.set.html && !dry) w.set.html = nh; }
        } else if (w.type === "button") {
          const c = parseColor(w.set.color || "#ffffff"), b = parseColor(w.set.bgc || ""); if (c && b) { const nc = fitColor(c, b, 4.2); if (nc) { (fixed++, dry && LASTFAILS.push(w.id + ":" + w.type)); if (!dry) w.set.color = nc; } }
        } else if (w.type === "iconbox") {
          [["tc", "h3"], ["xc", "p"]].forEach(([k, sel]) => { const q = parseColor(w.set[k] || ""); if (!q) return; const nc = fitColor(q, bg, k === "tc" ? 4.2 : 4.6); if (nc) { (fixed++, dry && LASTFAILS.push(w.id + ":" + w.type)); if (!dry) w.set[k] = nc; } });
        } else if (w.type === "pprice") {
          const q = parseColor(w.set.pc || ""); if (q) { const nc = fitColor(q, bg, 3.2); if (nc) { (fixed++, dry && LASTFAILS.push(w.id + ":" + w.type)); if (!dry) w.set.pc = nc; } }
        }
      });
    });
    return fixed;
  }
  async function apply(pal, clusters) {
    const E = PBApp.E, mp0 = mapper(pal, clusters), ud = E.page.palDark ? undark() : null, mp = ud ? (c => mp0(ud(c))) : mp0; walkPage(E.page, c => mp(c));
    if (pal.dark && typeof E.page.bg === "string" && /^(#fff|#ffffff|transparent|)$/i.test(E.page.bg)) E.page.bg = pal.sw.bg;
    /* ألوان افتراضية لا تُخزَّن في بيانات العنصر (سعر المنتج الأخضر الافتراضي) تُثبَّت بلون اللوحة كي تتغيّر معها */
    (E.page.sections || []).forEach(s => [...(s.cols || []).flatMap(c => c.widgets || []), ...(s.free || [])].forEach(w => { if (w.type === "pprice" && !w.set.pc) w.set.pc = mp("#157a55"); }));
    E.page.pal = pal.id; if (pal.dark) E.page.palDark = true; else delete E.page.palDark;
    /* مرحلة التنسيق: بعد رسم الألوان الجديدة يُقاس تباين كل نص مع خلفيته الفعلية ويُعدَّل لون النص (بحفظ صبغته) إن قلّ التباين عن 4.5 (3 للكبير) */
    let fixed = 0; try { PBApp.render(); await new Promise(r => setTimeout(r, 900)); fixed = fixContrast(); if (fixed) { PBApp.render(); await new Promise(r => setTimeout(r, 300)); fixed += fixContrast(); } } catch (e) { console.warn(e); }
    PBApp.afterEdit("ألوان الصفحة: " + pal.name);
    try { PBApp.toast("طُبّقت لوحة «" + pal.name + "»" + (fixed ? " وضُبط تباين " + fixed + " لون نص مع خلفياتها" : "") + " — Ctrl+Z للتراجع"); } catch (e) { }
  }
  /* ───── الواجهة ───── */
  let st = null;
  function card(p) {
    const s = p.sw; return `<button type="button" class="pbpal-c" data-pid="${p.id}" title="تطبيق لوحة «${p.name}» على ألوان الصفحة كلها"><span class="pbpal-pv" style="background:${s.bg}"><i style="background:${s.surface};border-color:${s.soft}"><b style="background:${s.text}"></b><b style="background:${s.text};width:60%;opacity:.55"></b><em style="background:${s.primary}"></em></i><u style="background:${s.accent}"></u></span><span class="pbpal-sw">${["bg", "surface", "soft", "primary", "accent", "text"].map(k => `<s style="background:${s[k]}"></s>`).join("")}</span><span class="pbpal-n">${p.name}</span></button>`;
  }
  function css() {
    if (document.getElementById("pbpal-css")) return; const el = document.createElement("style"); el.id = "pbpal-css";
    el.textContent = `#pbx-pal{position:fixed;z-index:100040;top:58px;inset-inline-start:12px;width:min(372px,94vw);max-height:min(640px,calc(100vh - 80px));overflow:auto;background:#0f1d16;color:#f1f5f2;border:1px solid rgba(255,255,255,.2);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);padding:.8rem .8rem 1rem;direction:rtl;font-family:inherit}
#pbx-pal .pbpal-h{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-weight:800;margin-bottom:.3rem}#pbx-pal .pbpal-h button{background:transparent;border:0;color:inherit;font-size:1.2rem;cursor:pointer}
#pbx-pal .pbpal-s{font-size:.76rem;opacity:.78;line-height:1.7;margin-bottom:.5rem}#pbx-pal .pbpal-dom{display:flex;gap:.3rem;align-items:center;margin-bottom:.6rem;font-size:.76rem}#pbx-pal .pbpal-dom i{width:22px;height:22px;border-radius:50%;border:2px solid #fff6;display:inline-block}
#pbx-pal .pbpal-g{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
#pbx-pal .pbpal-c{display:block;text-align:center;background:#16291f;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:.45rem;cursor:pointer;color:inherit;font:inherit}#pbx-pal .pbpal-c:hover{border-color:#e2fe17;background:#1c3326}
#pbx-pal .pbpal-pv{display:block;height:64px;border-radius:9px;position:relative;overflow:hidden}#pbx-pal .pbpal-pv i{position:absolute;inset:9px 28px 9px 9px;border:1px solid;border-radius:8px;display:flex;flex-direction:column;gap:5px;padding:7px}#pbx-pal .pbpal-pv i b{display:block;height:5px;border-radius:3px;width:85%}#pbx-pal .pbpal-pv i em{display:block;height:10px;width:34px;border-radius:99px;margin-top:3px}#pbx-pal .pbpal-pv u{position:absolute;inset-inline-end:8px;top:12px;width:14px;height:14px;border-radius:50%}
#pbx-pal .pbpal-sw{display:flex;gap:0;margin-top:.4rem;border-radius:6px;overflow:hidden}#pbx-pal .pbpal-sw s{flex:1;height:10px;display:block}#pbx-pal .pbpal-n{display:block;font-size:.8rem;font-weight:800;margin-top:.35rem}`;
    document.head.appendChild(el);
  }
  async function open() {
    close(); css(); const E = PBApp.E; if (!E || !E.page) return;
    const cl = stats(E.page).clusters, dom = await dominant(productImage(E.page)), list = palettes(dom, cl); st = { list, clusters: cl };
    const box = document.createElement("div"); box.id = "pbx-pal"; box.setAttribute("role", "dialog");
    box.innerHTML = `<div class="pbpal-h"><span>ألوان الصفحة</span><button type="button" data-x="1" aria-label="إغلاق">×</button></div><div class="pbpal-s">اختر لوحة ألوان متناسقة فتتغيّر ألوان الخلفيات والنصوص والأزرار في الصفحة كلها بضغطة واحدة (Ctrl+Z للتراجع). الصور لا تتغيّر.</div>` +
      (dom.length ? `<div class="pbpal-dom"><span>ألوان المنتج:</span>${dom.map(d => `<i style="background:${hslHex(d.h, clamp(d.s, 0.4, 0.9), clamp(d.l, 0.35, 0.6))}"></i>`).join("")}</div>` : `<div class="pbpal-dom"><span>لم تُستخرج ألوان المنتج؛ اللوحات مبنية على ألوان الصفحة الحالية.</span></div>`) +
      `<div class="pbpal-g">${list.map(card).join("")}</div>`;
    document.body.appendChild(box);
    box.addEventListener("click", ev => { if (ev.target.closest("[data-x]")) return close(); const b = ev.target.closest("[data-pid]"); if (!b) return; const p = st.list.find(x => x.id === b.dataset.pid); if (p) { apply(p, st.clusters).then(() => { st.clusters = stats(PBApp.E.page).clusters; }); } });
    document.addEventListener("keydown", esc, true);
  }
  const esc = e => { if (String(e.key || "") === "Escape") close(); };
  function close() { const b = document.getElementById("pbx-pal"); if (b) b.remove(); document.removeEventListener("keydown", esc, true); }
  return { open, close, apply, fixContrast, fails: () => LASTFAILS.slice(), stats, palettes, mapper, dominant, productImage, _walk: walkPage };
})();
