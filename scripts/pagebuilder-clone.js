/* ═══ نسخ قالب: يفتح موقعاً (برابطه) أو صورة (لقطة شاشة) في نافذة بحدّ سفلي قابل للتحجيم، ثم يحوّل ما فيها إلى عناصر المطوّر القابلة للتعديل ═══
   الرابط: يُجلب HTML (مباشرة أو عبر وسيط CORS) ويُعرض في إطار معزول بلا سكربتات، ثم يُقرأ تخطيطه الحقيقي (المواضع والأحجام والألوان والخطوط)
   فيُبنى قسم حرّ «بتحجيم تلقائي» عناصره: شكل/صورة/نص/عنوان/زر بنفس أماكنها.
   الصورة: التعرّف على النصوص (Tesseract.js من jsDelivr، بلا مفتاح) ← نصوص قابلة للتعديل فوق صورة خلفية نُزعت منها النصوص.
   لا يُنفَّذ أي سكربت من الموقع المنسوخ. */
const PBClone = (function () {
  const A = () => PBApp, esc = s => PB.esc(s);
  const S = { tab: "url", W: 1280, limit: 1200, docH: 0, k: 1, url: "", html: "", frame: null, img: null, busy: false };
  const toast = m => { const t = document.getElementById("pbx-msg"); if (!t) return; t.textContent = m; t.style.display = "block"; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 5200); };
  const $ = id => document.getElementById(id), sleep = ms => new Promise(r => setTimeout(r, ms));
  const prog = p => { const e = $("cl-ring"); if (!e) return; if (p == null) { e.hidden = true; return; } p = Math.max(0, Math.min(100, Math.round(p))); e.hidden = false; e.style.setProperty("--p", p); const i = e.firstChild; if (i) i.textContent = p + "%"; };      // دائرة خضراء تمتلئ تدريجياً حتى يكتمل النسخ
  /* اكتمال النسخ: علامة صح داخل الدائرة + نغمة قصيرة هادئة + اهتزاز خفيف على الجوال (مرة واحدة لكل عملية) */
  const CHECK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  let doneShown = false;
  function finishFx() {
    if (doneShown) return; doneShown = true; prog(100); const e = $("cl-ring"), i = e && e.firstChild; if (i) i.innerHTML = CHECK; const t = $("cl-st"); if (t) t.textContent = "تم النسخ";
    try { if (navigator.vibrate) navigator.vibrate([25, 45, 55]); } catch (x) { }
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { const c = new AC(), t0 = c.currentTime; [[784, 0], [1175, .11]].forEach(([f, d]) => { const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(.07, t0 + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + d + .22); o.connect(g); g.connect(c.destination); o.start(t0 + d); o.stop(t0 + d + .25); }); setTimeout(() => { try { c.close(); } catch (x) { } }, 700); } } catch (x) { }
  }
  const st = m => { const e = $("cl-st"); if (e) e.textContent = m || ""; };

  /* ───────── ألوان ───────── */
  let cv0 = null, cx0 = null; const cc = new Map();
  function col(c) {      // أي لون CSS ← {r,g,b,a} (عبر canvas ليشمل oklch وغيره)
    if (!c || c === "transparent" || c === "none") return null; if (cc.has(c)) return cc.get(c);
    if (!cx0) { cv0 = document.createElement("canvas"); cv0.width = cv0.height = 1; cx0 = cv0.getContext("2d", { willReadFrequently: true }); }
    cx0.clearRect(0, 0, 1, 1); cx0.fillStyle = "#010203"; cx0.fillStyle = c; if (cx0.fillStyle === "#010203" && !/^#010203$/i.test(c)) { cc.set(c, null); return null; }      // لون غير مفهوم: لا يُعدّ أسود
    cx0.fillRect(0, 0, 1, 1); const d = cx0.getImageData(0, 0, 1, 1).data, o = d[3] ? { r: d[0], g: d[1], b: d[2], a: d[3] / 255 } : { r: 0, g: 0, b: 0, a: 0 }; cc.set(c, o); return o;
  }
  /* لون النص الفعلي: النص المقصوص بالخلفية (تدرّج) يأخذ لون منتصف التدرّج، والتعبئة الشفافة بلا تدرّج تعود لـcolor */
  function textFill(cs) {
    const f = cs.webkitTextFillColor, bc = cs.webkitBackgroundClip || cs.backgroundClip || "";
    if (/text/.test(bc) && cs.backgroundImage && cs.backgroundImage !== "none") { const m = cs.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi); if (m) { const cc = col(m[Math.floor((m.length - 1) / 2)]); if (cc && cc.a > .3) return cc; } }
    const fc = f && f !== "currentcolor" ? col(f) : null; if (fc && fc.a >= .35) return fc; return col(cs.color);
  }
  const hex = c => "#" + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const px = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

  /* ───────── جلب الصفحة ───────── */
  const PROXIES = [u => "https://corsproxy.io/?url=" + encodeURIComponent(u), u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u), u => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u)];
  async function fget(url, as, ms) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 15000);
    try { const r = await fetch(url, { signal: ac.signal, redirect: "follow" }); if (!r.ok) throw new Error("HTTP " + r.status); return as === "blob" ? await r.blob() : await r.arrayBuffer(); } finally { clearTimeout(t); }
  }
  function decode(buf) {
    let enc = "utf-8"; const head = new TextDecoder("latin1").decode(buf.slice(0, 3000)), m = /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(head); if (m) enc = m[1];
    try { return new TextDecoder(enc).decode(buf); } catch (e) { return new TextDecoder("utf-8").decode(buf); }
  }
  /* صفحة تحدٍّ من جدار حماية (Cloudflare وأمثاله) بدل محتوى الموقع */
  const isChallenge = h => { const t = String(h || ""), head = t.slice(0, 120000); return /Enable JavaScript and cookies to continue|<title>\s*(Just a moment\.\.\.|Attention Required! \| Cloudflare|Access denied|Please Wait\.\.\.|DDoS-Guard)/i.test(head) || (/_cf_chl_opt|cf-browser-verification|challenge-platform|cf-turnstile/i.test(head) && t.length < 90000 && !/<h1|<h2|<img/i.test(head.replace(/<script[\s\S]*?<\/script>/gi, "")) ); };
  async function fetchHtml(url) {
    const tries = [url].concat(PROXIES.map(p => p(url))); let last = null, blocked = false;
    for (let i = 0; i < tries.length; i++) { try { st(i ? "جارٍ المحاولة عبر وسيط (" + i + "/" + PROXIES.length + ")…" : "جارٍ جلب الصفحة…"); const buf = await fget(tries[i], "buf"); const html = decode(buf); if (isChallenge(html)) { blocked = true; last = new Error("صفحة تحقّق"); continue; } if (/<html|<body|<!doctype/i.test(html.slice(0, 4000)) && html.length > 300) return html; last = new Error("استجابة ليست صفحة HTML"); } catch (e) { last = e; } }
    if (blocked) { const e = new Error("الموقع محمي بجدار حماية (مثل Cloudflare) ويطلب «تفعيل JavaScript والكوكيز» فلا يسمح بالجلب الآلي."); e.blocked = true; throw e; }
    throw new Error("تعذّر جلب الصفحة (" + (last && last.message || "؟") + "). جرّب موقعاً آخر أو استعمل تبويب «صورة» بلقطة شاشة للصفحة.");
  }
  /* جلب بمتصفح كامل على خادم: يشغّل workflow «clone-page» في مستودعك (GitHub Actions + Chromium) فيعرض الصفحة بجافاسكربتها ويحفظ نسخة جامدة في assets/clone ثم تُقرأ هنا */
  async function fetchFull(url, W, token) {
    const c = typeof GH !== "undefined" ? GH.cfg() : null; if (!c || !c.token || c.token === "php" || !c.owner) throw new Error("الجلب بمتصفح كامل يحتاج ربط GitHub في الإعدادات (غير متاح في نسخة الاستضافة PHP)");
    const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), api = "https://api.github.com/repos/" + c.owner + "/" + c.repo, H = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" };
    st("تشغيل المتصفح الكامل على خادم GitHub…");
    const r = await fetch(api + "/actions/workflows/clone-page.yml/dispatches", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ ref: c.branch || "main", inputs: { url, width: String(W), id } }) });
    if (r.status !== 204) { const t = await r.text().catch(() => ""); throw new Error(r.status === 404 ? "لم يُعثر على الـworkflow «clone-page» في المستودع — انشر آخر تحديث للوحة أولاً" : r.status === 403 || r.status === 401 ? "التوكن بلا صلاحية تشغيل Actions (يلزم صلاحية «workflow» أو Actions: write)" : "فشل تشغيل الخادم (" + r.status + ") " + t.slice(0, 100)); }
    const t0 = Date.now(), path = "assets/clone/" + id + ".html"; S.runId = id;
    while (Date.now() - t0 < 300000) { await sleep(6000); if (S.runId !== id || !$("pbx-clone")) throw new Error("أُلغي الجلب"); st("المتصفح الكامل يعرض الصفحة على خادم GitHub… " + Math.round((Date.now() - t0) / 1000) + " ثانية (يستغرق عادة 1–2 دقيقة)");
      const g = await fetch(api + "/contents/" + path + "?ref=" + encodeURIComponent(c.branch || "main") + "&t=" + Date.now(), { headers: Object.assign({}, H, { Accept: "application/vnd.github.raw+json" }) }).catch(() => null); if (!g || g.status === 404) continue; if (!g.ok) throw new Error("تعذّر قراءة النتيجة (" + g.status + ")");
      const html = await g.text(); fetch(api + "/contents/" + path + "?ref=" + encodeURIComponent(c.branch || "main"), { headers: H }).then(m => m.ok ? m.json() : null).then(m => m && fetch(api + "/contents/" + path, { method: "DELETE", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ message: "clone: تنظيف", sha: m.sha, branch: c.branch || "main" }) })).catch(() => { });      // تنظيف الملف المؤقت
      return html; }
    throw new Error("انتهت المهلة قبل اكتمال العرض على الخادم — راجع تبويب Actions في GitHub");
  }
  async function fetchBlob(url) { const tries = [url].concat(PROXIES.map(p => p(url))); for (const t of tries) { try { const b = await fget(t, "blob", 12000); if (b && b.size > 200 && /^image\//.test(b.type)) return b; } catch (e) { } } return null; }
  /* يجهّز HTML للعرض الآمن: بلا سكربتات، مع <base>، وكشف الصور الكسولة، وإيقاف الحركات */
  function prep(html, url) {
    const d = new DOMParser().parseFromString(html, "text/html");
    d.querySelectorAll("script,iframe,object,embed,link[rel=preload],link[rel=modulepreload],link[rel=prefetch],meta[http-equiv=refresh]").forEach(n => n.remove());
    d.querySelectorAll("[onload],[onclick],[onerror]").forEach(n => ["onload", "onclick", "onerror"].forEach(a => n.removeAttribute(a)));
    d.querySelectorAll("img").forEach(i => { const ds = i.getAttribute("data-src") || i.getAttribute("data-lazy-src") || i.getAttribute("data-original") || i.getAttribute("data-lazy"); if (ds && (!i.getAttribute("src") || /^data:/.test(i.getAttribute("src")))) i.setAttribute("src", ds); const dss = i.getAttribute("data-srcset"); if (dss && !i.getAttribute("srcset")) i.setAttribute("srcset", dss); i.removeAttribute("loading"); });
    d.querySelectorAll("source[data-srcset]").forEach(s => s.setAttribute("srcset", s.getAttribute("data-srcset")));
    d.querySelectorAll("[data-bg],[data-background-image]").forEach(n => { const b = n.getAttribute("data-bg") || n.getAttribute("data-background-image"); if (b && !/gradient/.test(n.style.backgroundImage || "")) n.style.backgroundImage = "url('" + b.replace(/'/g, "%27") + "')"; });
    d.querySelectorAll("base").forEach(b => b.remove()); const base = d.createElement("base"); base.href = url; (d.head || d.documentElement).prepend(base);
    const css = d.createElement("style"); css.id = "pbx-freeze"; css.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}[data-aos],.aos-init,.aos-animate,.reveal,.wow,.fade-in,.animate__animated,.scroll-reveal,.sr{opacity:1!important;transform:none!important;visibility:visible!important}html{scroll-behavior:auto}";
    (d.head || d.documentElement).appendChild(css);
    return "<!doctype html>" + d.documentElement.outerHTML;
  }

  /* ───────── استخراج العناصر من إطار معروض ───────── */
  const SKIP = new Set(["script", "style", "link", "meta", "head", "title", "noscript", "template", "base", "defs", "symbol", "source", "track", "param", "map", "area", "datalist", "option", "optgroup"]);
  const INL = new Set(["a", "b", "strong", "i", "em", "u", "small", "span", "br", "sup", "sub", "mark", "code", "font", "abbr", "cite", "q", "s", "del", "ins", "label", "time", "bdi", "big", "kbd", "wbr", "bdo", "var", "samp"]);
  const inter = (a, b) => { if (!b) return a; const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h); return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; };
  function fontOf(cs) {
    const fam = (cs.fontFamily || "").split(",").map(s => s.trim().replace(/^["']|["']$/g, "")); for (const f of fam) { const k = PB.FONT_FAMS.find(x => x[0].toLowerCase() === f.toLowerCase()); if (k) return "'" + k[0] + "','Cairo',sans-serif"; if (/^(georgia|times|times new roman|serif)$/i.test(f)) return "Georgia,'Times New Roman',serif"; if (/^(courier new|monospace|consolas|menlo)$/i.test(f)) return "'Courier New',monospace"; if (/^cairo$/i.test(f)) return ""; }
    return "";
  }
  function splitTop(str) { const o = []; let d = 0, cur = ""; for (const ch of String(str || "")) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) { o.push(cur.trim()); cur = ""; } else cur += ch; } if (cur.trim()) o.push(cur.trim()); return o; }
  function cssGrad(bg, r0, vr0) {      // r0 = مستطيل العنصر الأصلي، vr0 = الجزء المرسوم منه (بعد القصّ بالحد السفلي/overflow)      // linear/radial-gradient(...) ← تدرّج المطوّر {t,a,s:[{c,p,o}]}
    const m = /(repeating-)?(linear|radial)-gradient\((.*)\)\s*$/i.exec(bg || ""); if (!m) return null; const body = m[3], parts = []; let depth = 0, cur = "";
    for (const ch of body) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { parts.push(cur.trim()); cur = ""; } else cur += ch; } parts.push(cur.trim());
    let a = 180, first = parts[0]; if (m[2].toLowerCase() === "linear") { const am = /^(-?[\d.]+)deg$/.exec(first); if (am) { a = Number(am[1]); parts.shift(); } else if (/^to\s/.test(first)) { const to = first.replace(/^to\s+/, ""); a = { "top": 0, "right": 90, "bottom": 180, "left": 270, "top right": 45, "right top": 45, "bottom right": 135, "right bottom": 135, "bottom left": 225, "left bottom": 225, "top left": 315, "left top": 315 }[to] ?? 180; parts.shift(); } }
    let gx = 50, gy = 50, shp = "ellipse"; const isCfg = !/^(rgb|hsl|#|color|oklch|oklab|lab|lch)/i.test(first) && (/\bat\b|^(circle|ellipse|closest|farthest)/.test(first) || /^-?[\d.]+(px|%|em|rem)\s/.test(first)); if (m[2].toLowerCase() === "radial" && isCfg) { if (/circle/.test(first)) shp = "circle"; const at = /at\s+(.+)$/.exec(first); if (at) { const kw = { left: 0, top: 0, center: 50, right: 100, bottom: 100 }, t = at[1].trim().split(/\s+/), cv = (v, i) => /%$/.test(v) ? parseFloat(v) : v in kw ? kw[v] : 50; const a0 = t[0], a1 = t[1] || (a0 === "top" || a0 === "bottom" ? "center" : "center"); if (a0 === "top" || a0 === "bottom") { gy = cv(a0); gx = cv(a1); } else { gx = cv(a0); gy = cv(a1); } } parts.shift(); }
    const R0 = r0 || { x: 0, y: 0, w: 0, h: 0 }, VR = vr0 || R0, ang = a * Math.PI / 180, rad0 = m[2].toLowerCase() === "radial", circ = shp === "circle";
    const lenOf = (W, H, cx, cy) => rad0 ? (circ ? Math.hypot(Math.max(cx, 100 - cx) / 100 * W, Math.max(cy, 100 - cy) / 100 * H) : Math.max(cx, 100 - cx) / 100 * W * Math.SQRT2) : Math.abs(W * Math.sin(ang)) + Math.abs(H * Math.cos(ang));
    const lenO = lenOf(R0.w, R0.h, gx, gy);
    let bad = false; const raw = parts.map(p => { const mm = /^(.*?)(?:\s+(-?[\d.]+)(%|px|em|rem)?)?$/.exec(p), c = col(mm && mm[1] ? mm[1].trim() : ""); if (!c) { bad = true; return null; } let pos = mm[2] != null ? Number(mm[2]) : null; if (pos != null && mm[3] && mm[3] !== "%") pos = lenO > 0 ? pos * (mm[3] === "px" ? 1 : 16) / lenO * 100 : null; return { col: c, p: pos }; });
    if (bad || raw.length < 2) return null;
    raw.forEach((q, i) => { if (q.p == null) q.p = i / (raw.length - 1) * 100; });
    /* إعادة التعبير عن المواضع على المستطيل المرسوم فعلاً (مثلاً body طوله 8000px مقصوص عند 1500px) */
    let nx = gx, ny = gy, lenN = lenO, off = 0;
    if (VR !== R0 && (VR.w !== R0.w || VR.h !== R0.h || VR.x !== R0.x || VR.y !== R0.y) && R0.w > 0 && R0.h > 0) {
      if (rad0) { nx = ((R0.x + gx / 100 * R0.w) - VR.x) / VR.w * 100; ny = ((R0.y + gy / 100 * R0.h) - VR.y) / VR.h * 100; lenN = lenOf(VR.w, VR.h, Math.max(0, Math.min(100, nx)), Math.max(0, Math.min(100, ny))); }
      else { lenN = lenOf(VR.w, VR.h, 0, 0); if (Math.abs(Math.cos(ang)) > .999) off = Math.cos(ang) < 0 ? VR.y - R0.y : (R0.y + R0.h) - (VR.y + VR.h); }
    }
    const stops = raw.map((q, i) => { let c = q.col; if (c.a === 0) { const nb = raw.slice(0, i).reverse().concat(raw.slice(i + 1)).find(z => z.col.a > 0); c = nb ? { r: nb.col.r, g: nb.col.g, b: nb.col.b, a: 0 } : c; } const pp = lenN > 0 ? (q.p / 100 * lenO - off) / lenN * 100 : q.p; return { r: c.r, g: c.g, b: c.b, a: c.a, p: pp }; });      // الشفاف يأخذ لون أقرب نقطة مرئية (التدرّج في CSS مسبق الضرب)
    gx = r1(nx); gy = r1(ny);
    /* قصّ التدرّج على المجال المرئي 0..100 مع استيفاء ألوان الأطراف (مواضع خارج الصندوق تُحذف دون تغيير ألوان الحافة) */
    stops.sort((x, y) => x.p - y.p); if (stops[0].p > 0) stops.unshift(Object.assign({}, stops[0], { p: 0 })); if (stops[stops.length - 1].p < 100) stops.push(Object.assign({}, stops[stops.length - 1], { p: 100 }));
    const at = t => { for (let i = 0; i < stops.length - 1; i++) { const A = stops[i], B = stops[i + 1]; if (t >= A.p && t <= B.p) { const f = B.p === A.p ? 0 : (t - A.p) / (B.p - A.p); return { r: A.r + (B.r - A.r) * f, g: A.g + (B.g - A.g) * f, b: A.b + (B.b - A.b) * f, a: A.a + (B.a - A.a) * f }; } } return t < stops[0].p ? stops[0] : stops[stops.length - 1]; };
    const keep = [{ p: 0, ...at(0) }].concat(stops.filter(q => q.p > 0.05 && q.p < 99.95), [{ p: 100, ...at(100) }]).map(q => ({ c: hex(q), o: q.a < .995 ? r2(q.a) : undefined, p: r1(q.p) })); keep.forEach(q => { if (q.o === undefined) delete q.o; }); stops.length = 0; stops.push(...keep);
    return m[2].toLowerCase() === "radial" ? { t: "radial", a: 0, sh: shp, x: gx, y: gy, s: stops } : { t: "linear", a, s: stops };
  }
  function extract(doc, win, W, limit, opt) {
    opt = opt || {}; const out = [], base = doc.baseURI; let z = 0, count = 0, bodyBg = null, stop = false;
    const abs = u => { try { return u ? new URL(u, base).href : ""; } catch (e) { return ""; } };
    const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const geom = (w, r) => { w.set.fx = { d: r2(r.x / W * 100) }; w.set.fy = { d: Math.round(r.y) }; w.set.fwd = { d: r2(r.w / W * 100) }; w.set.fh = { d: Math.max(2, Math.round(r.h)) }; return w; };
    const radCtx = [];
    const clipCorners = (w, r) => {
      if (!radCtx.length || (w.type !== "shape" && w.type !== "image")) return; const T = 2, base = (w.set.rad && w.set.rad.d) || 0, c = [base, base, base, base];
      for (const k of radCtx) { const R = k.r, q = k.crad, L = Math.abs(r.x - R.x) < T, Rt = Math.abs(r.x + r.w - (R.x + R.w)) < T, Tp = Math.abs(r.y - R.y) < T, B = Math.abs(r.y + r.h - (R.y + R.h)) < T; if (L && Tp) c[0] = Math.max(c[0], q[0]); if (Rt && Tp) c[1] = Math.max(c[1], q[1]); if (Rt && B) c[2] = Math.max(c[2], q[2]); if (L && B) c[3] = Math.max(c[3], q[3]); }
      const half = Math.min(r.w, r.h) / 2; if (c.some(v => v > base + .5)) w.set.radc = c.map(v => Math.round(Math.min(v, half)));
    };
    const add = (type, r, props) => { if (out.length > 800) { stop = true; return null; } const w = PB.mkFree(type, 0, 0, ++z); Object.assign(w.set, props || {}); delete w.set.mh; geom(w, r); clipCorners(w, r); out.push(w); return w; };
    const clipY = r => r.y + r.h > limit ? { x: r.x, y: r.y, w: r.w, h: Math.max(1, limit - r.y) } : r;
    const cornerPx = (v, r) => { const t = String(v || "0").trim().split(/\s+/); const f = (tok, base) => /%$/.test(tok) ? parseFloat(tok) / 100 * base : px(tok); return Math.min(f(t[0], r.w), f(t[1] || t[0], r.h)); };
    const radiusOf = (cs, r) => { const half = Math.min(r.w, r.h) / 2, v = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map(k => Math.min(Math.max(0, cornerPx(cs["border" + k + "Radius"], r)), half)).sort((a, b) => a - b); return (v[1] + v[2]) / 2; };      // وسيط الزوايا الأربع (نسبة % وقيم بيضاوية مدعومة)
    function textBlock(el) { let has = false, bad = false; (function w(n) { for (const c of n.childNodes) { if (bad) return; if (c.nodeType === 3) { if (c.nodeValue.trim()) has = true; } else if (c.nodeType === 1) { const t = c.tagName.toLowerCase(); if (!INL.has(t)) { bad = true; return; } const d = win.getComputedStyle(c).display; if (t !== "br" && t !== "wbr" && !/^inline/.test(d) && d !== "contents") { bad = true; return; } if (win.getComputedStyle(c).position === "absolute") { bad = true; return; } w(c); } } })(el); return has && !bad; }
    function inlineHtml(el, cs) {      // محتوى مضمَّن نظيف: نص + <br> + روابط + عريض/مائل + ألوان مختلفة
      const base0 = { c: cs.color, w: cs.fontWeight, s: cs.fontStyle, f: cs.fontSize };
      function w(n, parent) { let o = "";
        for (const c of n.childNodes) { if (c.nodeType === 3) o += esc(c.nodeValue.replace(/\s+/g, " ")); else if (c.nodeType === 1) { const t = c.tagName.toLowerCase(); if (t === "br") { o += "<br>"; continue; } if (t === "wbr") continue; const s = win.getComputedStyle(c), inner = w(c, s); if (!inner.trim() && !/img/.test(t)) continue; const sty = []; const cl = col(s.color), pc = col(parent.color); if (cl && (t === "a" || (pc && hex(cl) !== hex(pc)))) sty.push("color:" + hex(cl)); if (s.fontWeight !== parent.fontWeight) sty.push("font-weight:" + s.fontWeight); if (s.fontStyle !== parent.fontStyle) sty.push("font-style:" + s.fontStyle); if (s.fontSize !== parent.fontSize) { const q = px(s.fontSize) / (px(parent.fontSize) || 16); if (isFinite(q) && Math.abs(q - 1) > .01) sty.push("font-size:" + r2(q) + "em"); } if (t === "a") sty.push("text-decoration:" + (s.textDecorationLine === "none" ? "none" : s.textDecorationLine)); else if (s.textDecorationLine !== parent.textDecorationLine && s.textDecorationLine !== "none") sty.push("text-decoration:" + s.textDecorationLine);
          if (t === "a" && c.getAttribute("href") && !/^javascript:/i.test(c.getAttribute("href"))) o += `<a href="${esc(abs(c.getAttribute("href")))}"${sty.length ? ` style="${sty.join(";")}"` : ""}>${inner}</a>`; else o += sty.length ? `<span style="${sty.join(";")}">${inner}</span>` : inner; } }
        return o; }
      return w(el, cs).replace(/^(\s|<br>)+|(\s|<br>)+$/g, "").trim();
    }
    function textProps(cs, lineH) {
      const fs = px(cs.fontSize) || 16, lh = cs.lineHeight === "normal" ? 1.3 : lineH / fs, c = textFill(cs), p = { fs: { d: Math.round(fs * 10) / 10 }, fw: String(cs.fontWeight), lh: { d: r2(Math.max(.8, Math.min(3, lh))) }, ta: { d: /^(left|right|center|justify)$/.test(cs.textAlign) ? cs.textAlign : cs.direction === "rtl" ? "right" : "left" } };
      if (c) p.color = hex(c); if (c && c.a < 1) p.op = r2(Math.max(.05, c.a)); const ff = fontOf(cs); if (ff) p.ff = ff; const ls = px(cs.letterSpacing); if (ls) p.ls = { d: r1(ls) }; if (cs.textTransform && cs.textTransform !== "none") p.tt = cs.textTransform; if (cs.fontStyle === "italic") p.fst = "italic"; if (/underline/.test(cs.textDecorationLine)) p.td = "underline"; else if (/line-through/.test(cs.textDecorationLine)) p.td = "line-through"; if (cs.direction === "rtl") p.tdir = "rtl";
      return p;
    }
    function emitText(el, cs, r, clip, anchor) {
      const rg = doc.createRange(); rg.selectNodeContents(el); const clipsSelf = cs.overflowX !== "visible" || cs.overflowY !== "visible", rects = [...rg.getClientRects()].filter(q => q.width > 0.5 && q.height > 0.5 && (!clipsSelf || (q.right > r.x && q.left < r.x + r.w && q.bottom > r.y && q.top < r.y + r.h))); if (!rects.length) return;      // نص خارج صندوق يقصّ محتواه (text-indent:-9999px لأرقام النقاط) لا يُنسخ

      const tops = [...new Set(rects.map(q => Math.round(q.top / 3)))].length, first = rects.reduce((m, q) => q.top < m.top ? q : m, rects[0]), fs = px(cs.fontSize) || 16, lhPx = cs.lineHeight === "normal" ? fs * 1.3 : px(cs.lineHeight) || fs * 1.3;
      const padL = px(cs.paddingLeft) + px(cs.borderLeftWidth), padR = px(cs.paddingRight) + px(cs.borderRightWidth); let bx = r.x + padL, bw = Math.max(rects.reduce((m, q) => Math.max(m, q.right), 0) - rects.reduce((m, q) => Math.min(m, q.left), 1e9), r.w - padL - padR);
      const y = first.top - Math.max(0, (lhPx - first.height) / 2), h = Math.max(lhPx, tops * lhPx), slack = Math.max(4, bw * (tops === 1 ? .08 : .03));
      let rr = { x: Math.max(0, bx - (cs.textAlign === "center" ? slack / 2 : cs.textAlign === "right" || (cs.direction === "rtl" && cs.textAlign !== "left") ? slack : 0)), y, w: Math.min(W, bw + slack), h }; if (rr.y >= limit) return;
      const tag = el.tagName.toLowerCase(), isH = /^h[1-6]$/.test(tag), props = textProps(cs, lhPx), link = anchor && anchor.getAttribute("href") && !/^(javascript:|#$)/i.test(anchor.getAttribute("href")) ? abs(anchor.getAttribute("href")) : "";
      let html = inlineHtml(el, cs); if (!html) return;
      if (cs.display === "list-item" && cs.listStyleType !== "none" && !clipsSelf) { const par = el.parentElement, idx = par ? [...par.children].filter(c => win.getComputedStyle(c).display === "list-item").indexOf(el) + 1 : 1; html = (par && par.tagName === "OL" ? idx + ". " : "• ") + html; }
      if (isH && !/<(a|span|b|i|em|strong)\b/.test(html) && !/<br>/.test(html)) return add("heading", rr, Object.assign(props, { text: el.textContent.replace(/\s+/g, " ").trim(), tag, link: link || undefined }));
      if (link && !/<a\b/.test(html)) html = `<a href="${esc(link)}" style="color:inherit;text-decoration:inherit">${html}</a>`;
      add("text", rr, Object.assign(props, { html: tops === 1 ? '<p style="white-space:nowrap">' + html + "</p>" : "<p>" + html + "</p>" }));
    }
    function boxPaint(el, cs, r, vr, tag) {
      const fill = col(cs.backgroundColor), lay = splitTop(cs.backgroundImage).filter(l => l && l !== "none");
      const bw = ["Top", "Right", "Bottom", "Left"].map(s => px(cs["border" + s + "Width"]) * (cs["border" + s + "Style"] !== "none" && cs["border" + s + "Style"] !== "hidden" ? 1 : 0)), bc = col(cs.borderTopColor), brd = bw[0] >= 1 && bw.every(v => Math.abs(v - bw[0]) < .5) && bc && bc.a > .05 ? { w: bw[0], c: bc } : null;
      const hasFill = fill && fill.a > .03; if (!hasFill && !lay.length && !brd) return;
      if (tag === "html") return; if (tag === "body") { if (hasFill) bodyBg = hex(fill); if (!lay.length) return; }
      if (vr.w < 3 || vr.h < 3) return; const rad = radiusOf(cs, r), mn = Math.min(r.w, r.h), ell = rad >= mn / 2 * .98 && Math.abs(r.w - r.h) < 3, shp = { shape: ell ? "ellipse" : "rect", keep: false, outline: false, rx: 0 }; if (!ell && rad >= 1) shp.rad = { d: Math.round(Math.min(rad, mn / 2)) };
      if (tag !== "body" && (hasFill || brd)) { const p = Object.assign({}, shp); if (hasFill) { p.fill = hex(fill); if (fill.a < 1) p.op = r2(fill.a); } else { p.fill = ""; p.outline = true; } if (brd) { p.stroke = hex(brd.c); p.sw = Math.max(1, Math.round(brd.w)); } else p.sw = 0; add("shape", clipY(vr), p); }
      const par = /fixed/.test(cs.backgroundAttachment || "") || /parallax|jarallax/i.test(String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className || "")) || el.hasAttribute("data-parallax") || el.hasAttribute("data-stellar-background-ratio");      // خلفية ثابتة/Parallax
      lay.slice().reverse().forEach(L => {      // طبقات الخلفية من الأسفل للأعلى
        if (/gradient\(/.test(L)) { const g = cssGrad(L, r, vr); if (g) add("shape", clipY(vr), Object.assign({}, shp, { fgr: g, fill: "", sw: 0 })); return; }
        const um = /url\((["']?)(.*?)\1\)/.exec(L); if (!um || !um[2] || /^data:image\/(gif|svg)/.test(um[2]) || vr.w < 20 || vr.h < 20) return; const sz = (cs.backgroundSize || "").toLowerCase(), rp = cs.backgroundRepeat || "";
        if (!/^repeat/.test(rp) || /cover|contain/.test(sz) || vr.w > 140) add("image", clipY(vr), Object.assign({ src: abs(um[2]), alt: "", fit: /contain/.test(sz) ? "contain" : "cover", rad: rad ? { d: Math.round(rad) } : undefined }, par ? { cls: "pb-par", fxs: [PBCloneFx.mkItem("خلفية Parallax / ثابتة", "selector{--par:[[k]]}", { k: { l: "قوة الحركة (0.1 خفيفة — 0.8 قوية)", t: "num", v: 0.35 } })] } : {})); });
    }
    function svgData(el, cs) {
      try { const c = el.cloneNode(true), r = rectOf(el); c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); if (!c.getAttribute("width")) c.setAttribute("width", r.w); if (!c.getAttribute("height")) c.setAttribute("height", r.h); if (!c.getAttribute("viewBox") && px(c.getAttribute("width")) && px(c.getAttribute("height"))) c.setAttribute("viewBox", "0 0 " + px(c.getAttribute("width")) + " " + px(c.getAttribute("height")));
        c.querySelectorAll("script,foreignObject").forEach(n => n.remove()); c.querySelectorAll("use").forEach(u => { const id = (u.getAttribute("href") || u.getAttribute("xlink:href") || "").replace(/^#/, ""); const ref = id && doc.getElementById(id); if (ref) { let dd = c.querySelector("defs"); if (!dd) { dd = doc.createElementNS("http://www.w3.org/2000/svg", "defs"); c.prepend(dd); } if (!dd.querySelector("#" + CSS.escape(id))) dd.appendChild(ref.cloneNode(true)); } });
        const cl = col(cs.color); let s = new XMLSerializer().serializeToString(c).replace(/currentColor/gi, cl ? hex(cl) : "#000"); if (s.length > 90000) return ""; return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); } catch (e) { return ""; }
    }
    function visit0(el, clip, anchor) {
      if (slSkip.has(el)) { const ow = skipOwner.get(el); if (ow && ow.z0 == null) ow.z0 = z; return; }
      if (mq.has(el)) { emitMarquee(el); return; }
      if (el.tagName === "FORM" && emitForm(el)) return;
      if (stop || ++count > 5000) return; const tag = el.tagName.toLowerCase(); if (SKIP.has(tag)) return;
      const cs = win.getComputedStyle(el); if (cs.display === "none") return; if (cs.opacity === "0" && tag !== "body" && tag !== "html") return;
      const a = tag === "a" ? el : anchor, r = rectOf(el), contents = cs.display === "contents";
      if (!contents && tag !== "html" && tag !== "body" && r.y >= limit) return; if (!contents && (r.w < 0.5 && r.h < 0.5)) { for (const c of el.children) visit(c, clip, a); return; }
      let vr = contents ? r : inter(r, clip); const hidden = cs.visibility === "hidden" || cs.visibility === "collapse";
      if (!contents && !hidden && vr) {
        const type = (el.getAttribute("type") || "").toLowerCase(), pad = px(cs.paddingTop) + px(cs.paddingLeft), fill = col(cs.backgroundColor);
        const isBtn = tag === "button" || (tag === "input" && /^(submit|button|reset)$/.test(type)) || el.getAttribute("role") === "button" || (tag === "a" && fill && fill.a > .3 && textBlock(el) && pad >= 6 && r.h <= 140);
        if (isBtn && r.h <= 160) { const txt = (tag === "input" ? el.value : el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); if (txt) { const tc = col(cs.color), bc = col(cs.borderTopColor), bwid = px(cs.borderTopWidth), href = a && a.getAttribute("href") && !/^(javascript:)/i.test(a.getAttribute("href")) ? abs(a.getAttribute("href")) : "#";
          const p = { text: txt, kind: "link", link: href, bgc: fill && fill.a > .03 ? hex(fill) : "transparent", color: tc ? hex(tc) : "#000000", fs: { d: r1(px(cs.fontSize) || 16) }, fw: String(cs.fontWeight), brad: { d: Math.round(Math.min(px(cs.borderTopLeftRadius), r.h / 2)) }, bpad: { d: [Math.round(px(cs.paddingTop)), Math.round(px(cs.paddingRight)), Math.round(px(cs.paddingBottom)), Math.round(px(cs.paddingLeft))] }, full: { d: true }, al: { d: "center" } };
          const gr = cssGrad(cs.backgroundImage, r, vr); if (gr) p.bgr = gr; if (bwid >= 1 && bc && bc.a > .05 && cs.borderTopStyle !== "none") { p.bw = Math.round(bwid); p.bc = hex(bc); p.bs = cs.borderTopStyle; } const ff = fontOf(cs); if (ff) p.ff = ff; if (cs.textTransform !== "none") p.tt = cs.textTransform;
          add("button", clipY(vr), p); return; } }
        if (tag === "img") { const src = abs(el.currentSrc || el.getAttribute("src") || ""); if (src && !/^data:image\/gif;base64,R0lGODlhAQAB/.test(src)) { const of = cs.objectFit, rad = radiusOf(cs, r), p = { src, alt: el.getAttribute("alt") || "", fit: of === "cover" ? "cover" : of === "contain" ? "contain" : "fill", rad: rad ? { d: Math.round(rad) } : undefined }; if (a && a.getAttribute("href") && !/^(javascript:|#$)/i.test(a.getAttribute("href"))) p.link = abs(a.getAttribute("href")); add("image", clipY(vr), p); } return; }
        if (tag === "svg") { const d = svgData(el, cs); if (d) add("image", clipY(vr), { src: d, alt: "", fit: "contain" }); return; }
        if (tag === "video") { const po = el.getAttribute("poster"); if (po) add("image", clipY(vr), { src: abs(po), alt: "", fit: "cover" }); return; }
        if (tag === "canvas" || tag === "picture" && false) return;
        if (tag === "input" || tag === "textarea" || tag === "select") { boxPaint(el, cs, r, vr, tag); const ph = tag === "select" ? (el.selectedOptions[0] && el.selectedOptions[0].textContent) || "" : (el.value || el.getAttribute("placeholder") || ""); if (/^(checkbox|radio|hidden|file|image|range|color)$/.test(type)) return; if (ph.trim()) { const props = textProps(cs, px(cs.lineHeight) || (px(cs.fontSize) || 16) * 1.3), tc = col(cs.color); if (!el.value && tc) props.color = hex({ r: tc.r * .6 + 120, g: tc.g * .6 + 120, b: tc.b * .6 + 120 }); const lhp = (props.lh.d || 1.3) * props.fs.d; add("text", { x: r.x + px(cs.paddingLeft) + px(cs.borderLeftWidth), y: r.y + (r.h - lhp) / 2, w: Math.max(20, r.w - px(cs.paddingLeft) - px(cs.paddingRight)), h: lhp }, Object.assign(props, { html: "<p>" + esc(ph.trim()) + "</p>" })); } return; }
        boxPaint(el, cs, r, vr, tag);
        if (tag !== "body" && tag !== "html" && textBlock(el)) { emitText(el, cs, r, clip, a); return; }
      }
      // أبناء العنصر (نص مباشر بين عناصر كتلية: يُلفّ بمدى)
      ownEnd.set(el, out.length);
      const ownClip = tag === "html" || tag === "body" ? clip : (cs.overflowX !== "visible" || cs.overflowY !== "visible") ? (inter(r, clip) || { x: 0, y: 0, w: 0, h: 0 }) : clip;
      if (ownClip.w <= 0 || ownClip.h <= 0) return;
      const crad = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map(k => Math.max(0, cornerPx(cs["border" + k + "Radius"], r))), clips = tag !== "html" && tag !== "body" && (cs.overflowX !== "visible" || cs.overflowY !== "visible") && crad.some(v => v >= 1); if (clips) radCtx.push({ r, crad });      // حاوية تقصّ بأركان مدوّرة: أبناؤها الملاصقون لأركانها يرثون التدوير
      for (const c of el.childNodes) { if (c.nodeType === 1) visit(c, ownClip, a); else if (c.nodeType === 3 && c.nodeValue.trim() && !hidden && !contents) { const rg = doc.createRange(); rg.selectNodeContents(c); const rc = [...rg.getClientRects()]; if (!rc.length || rc[0].top >= limit) continue; if (ownClip && (rc[0].right <= ownClip.x || rc[0].left >= ownClip.x + ownClip.w || rc[0].bottom <= ownClip.y || rc[0].top >= ownClip.y + ownClip.h)) continue; const wrap = doc.createElement("span"); wrap.textContent = c.nodeValue; const tops = [...new Set(rc.map(q => Math.round(q.top / 3)))].length, f = rc.reduce((m, q) => q.top < m.top ? q : m, rc[0]), fs = px(cs.fontSize) || 16, lhPx = cs.lineHeight === "normal" ? fs * 1.3 : px(cs.lineHeight) || fs * 1.3, x0 = Math.min(...rc.map(q => q.left)), x1 = Math.max(...rc.map(q => q.right)), props = textProps(cs, lhPx);
          add("text", { x: Math.max(0, x0 - 1), y: f.top - Math.max(0, (lhPx - f.height) / 2), w: Math.min(W, x1 - x0 + Math.max(6, (x1 - x0) * .03)), h: tops * lhPx }, Object.assign(props, { html: "<p>" + esc(c.nodeValue.replace(/\s+/g, " ").trim()) + "</p>" })); } }
      if (clips) radCtx.pop();
    }
    const IDP = opt.idp || "";      // بادئة معرّفات السلايدر/الأكورديون/المناطق لنسخة الجوال كي لا تتصادم مع معرّفات نسخة سطح المكتب في الصفحة نفسها
    const FXON = !opt.noFx && typeof PBCloneFx !== "undefined", ownEnd = new Map(), fx = FXON ? PBCloneFx.create({ idp: IDP, doc, win, W, out, add, col, px, r1, r2 }) : null;
    /* ───── السلايدرات: كل «صفحة» شرائح مجموعة عناصر تُظهر بالتناوب (أسهم/نقاط/سحب/تشغيل تلقائي في الصفحة المنشورة) ───── */
    const SLD = [
      { root: ".swiper,.swiper-container", slide: ".swiper-slide:not(.swiper-slide-duplicate)", prev: ".swiper-button-prev,.elementor-swiper-button-prev", next: ".swiper-button-next,.elementor-swiper-button-next", dot: ".swiper-pagination-bullet", out: 1 },
      { root: ".slick-slider", slide: ".slick-slide:not(.slick-cloned)", prev: ".slick-prev", next: ".slick-next", dot: ".slick-dots li,.jet-slick-dots li" },
      { root: ".owl-carousel", slide: ".owl-item:not(.cloned)", prev: ".owl-prev", next: ".owl-next", dot: ".owl-dot" },
      { root: ".splide", slide: ".splide__slide:not(.splide__slide--clone)", prev: ".splide__arrow--prev", next: ".splide__arrow--next", dot: ".splide__pagination__page" },
      { root: ".carousel", slide: ".carousel-item", prev: ".carousel-control-prev", next: ".carousel-control-next", dot: ".carousel-indicators [data-bs-target],.carousel-indicators li", bs: 1 },
      { root: ".glide", slide: ".glide__slide:not(.glide__slide--clone)", prev: ".glide__arrow--left", next: ".glide__arrow--right", dot: ".glide__bullet" },
      { root: ".flickity-enabled", slide: ".flickity-slider > *", prev: ".flickity-prev-next-button.previous", next: ".flickity-prev-next-button.next", dot: ".flickity-page-dots .dot" }
    ];
    const slSkip = new Set(), skipOwner = new Map(), elCls = new Map(), elRange = new Map(), slRoot = new Map(), sliders = []; let slN = 0;
    const tagW = (ws, cl) => ws.forEach(w => cl.forEach(c => { if (!(" " + (w.set.cls || "") + " ").includes(" " + c + " ")) w.set.cls = ((w.set.cls || "") + " " + c).trim(); }));
    const inBox = (r, B) => r.w > 1 && r.x + r.w / 2 > B.x && r.x + r.w / 2 < B.x + B.w && r.y + r.h / 2 > B.y && r.y + r.h / 2 < B.y + B.h;
    function findSliders() {
      const claimed = [];
      for (const def of SLD) {
        let roots; try { roots = doc.querySelectorAll(def.root); } catch (e) { continue; }
        for (const root of roots) {
          if (claimed.some(c => c === root || c.contains(root))) continue; let all = [...root.querySelectorAll(def.slide)].filter(x => x.closest(def.root) === root); if (all.length < 2) continue;
          const rr = rectOf(root); if (rr.w < 50 || rr.h < 30 || rr.y >= limit) continue; const sr0 = all.map(rectOf);
          const stacked = !!def.bs || sr0.slice(1).every(r => r.w < 1 || (Math.abs(r.x - sr0[0].x) < 3 && Math.abs(r.y - sr0[0].y) < 3));      // بوتستراب: شرائح متراكمة دائماً (اللقطة قد تكون في منتصف الانتقال فتظهر متجاورة)
          let act = 0; if (stacked) { const k = all.findIndex(x => /(^|\s|-)active(\s|$|-)/.test(x.className)); act = k < 0 ? 0 : k; } else { const k = sr0.findIndex(r => inBox(r, rr)); act = k < 0 ? 0 : k; }
          const slides = all.slice(act).concat(all.slice(0, act)), sr = slides.map(rectOf), sel = q => { try { return [...root.querySelectorAll(q)]; } catch (e) { return []; } }, dots = sel(def.dot);
          // سلايدر دوّار (Slick infinite…): عدد النقاط = عدد الشرائح الحقيقية وفي الواجهة أكثر من شريحة (مع نسخ مكرّرة) ← كل نقطة صفحة تُزاح شريحة واحدة (نافذة دورية)
          let pv = stacked ? 1 : Math.max(1, sr.filter(r => inBox(r, rr)).length); const clones = [...root.querySelectorAll(".slick-slide")].filter(x => x.closest(def.root) === root && x.classList.contains("slick-cloned")); if (!stacked) { const nAct = [...root.querySelectorAll(".slick-slide.slick-active,.swiper-slide-visible,.owl-item.active")].filter(x => x.closest(def.root) === root).length; if (nAct > pv && (clones.length || dots.length === all.length)) pv = Math.min(nAct, all.length - 1); }
          const circ = !stacked && pv > 1 && dots.length === all.length && all.length > pv, pages = circ ? all.length : Math.ceil(slides.length / pv); if (pages < 2) continue;
          const id = IDP + "s" + (++slN); let ms = def.bs && !root.hasAttribute("data-bs-ride") && !root.hasAttribute("data-ride") && !root.hasAttribute("data-bs-interval") ? 0 : 5000;
          try { const so = root.closest("[data-slider_options]"); if (so) { const o = JSON.parse(so.getAttribute("data-slider_options")); ms = o.autoplay ? Math.max(2500, (o.autoplaySpeed || 0) + (o.speed || 0)) : 0; } } catch (e) { }
          try { const a = root.getAttribute("data-bs-interval") || root.getAttribute("data-interval"); if (a) ms = +a || ms; const sk = root.getAttribute("data-slick"); if (sk) { const o = JSON.parse(sk); ms = o.autoplay ? (o.autoplaySpeed || 3000) : 0; } const sp = root.getAttribute("data-splide"); if (sp) { const o = JSON.parse(sp); ms = o.autoplay ? (o.interval || 5000) : 0; } const sa = slides[0].getAttribute("data-swiper-autoplay"); if (sa) ms = +sa || ms; } catch (e) { }
          if (def.bs) { slides[0].style.setProperty("transform", "none", "important"); slides[0].style.setProperty("transition", "none", "important"); }
          const pitch = !stacked && sr0.length > 1 ? sr0[1].x - sr0[0].x : 0, stepD = Math.abs(pitch) > 8 && Math.abs(sr0[1].y - sr0[0].y) < Math.abs(pitch) * .5 ? Math.round(circ ? pitch : pitch * pv) : 0, swc = stepD ? ["pbsw-" + id + "-" + (stepD < 0 ? "m" : "") + Math.abs(stepD)] : [];      // خطوة الانزلاق بين الصفحات (وحدات التصميم): تحرّك المنتجات معاً وتُقصّ عند الحافة
          slides.slice(0, pv).forEach((x, k) => elCls.set(x, ["pbsl-" + id + "-0"].concat(k === 0 ? ["pbsi-" + id + "-" + ms].concat(swc) : [])));
          slides.slice(pv).forEach(x => slSkip.add(x));
          const outer = (q, own) => {      // أسهم/نقاط تقع خارج حاوية السلايدر نفسها (مثل .swiper-arrows بجانب .swiper في ثيمات Elementor): نبحث في الأجداد القريبة بشرط ألا تضم سلايدراً آخر
            let r = sel(q); if (r.length || !def.out) return r; let a = root.parentElement;
            for (let k = 0; k < 3 && a && a !== doc.body; k++, a = a.parentElement) { if (a.querySelectorAll(def.root).length > 1) break; try { r = [...a.querySelectorAll(q)].filter(x => !root.contains(x)); } catch (e) { r = []; } if (r.length) return r; }
            return r;
          }, pr = outer(def.prev), nx = outer(def.next), actP = circ ? 0 : Math.floor(act / pv);
          dots.forEach((d, j) => { const pg = circ ? (j - act + pages) % pages : dots.length === pages ? (j - actP + pages) % pages : dots.length === all.length ? Math.floor(((j - act + all.length) % all.length) / pv) : Math.min(pages - 1, Math.floor(j * pages / dots.length)); elCls.set(d, ["pbsd-" + id + "-" + pg]); });
          pr.forEach(x => elCls.set(x, ["pbsp-" + id])); nx.forEach(x => elCls.set(x, ["pbsn-" + id]));
          const sl = { id, def, root, slides, pv, pages, stacked, circ, track: slides[0].parentElement, ms, dots, pr, nx, act, pitch: sr0.length > 1 ? sr0[1].x - sr0[0].x : 0, tag0: ["pbsi-" + id + "-" + ms].concat(swc) };
          if (circ) [...all, ...clones].forEach(x => { slSkip.add(x); skipOwner.set(x, sl); });      // السلايدر الدوّار: كل الصفحات (حتى الأولى) تُبنى بنوافذ دورية، والنسخ المكرّرة (clones) لا تُنسخ كمحتوى ثابت
          sliders.push(sl); slRoot.set(root, sl); claimed.push(root);
        }
      }
      try { findGenericSliders(claimed); } catch (e) { console.warn("generic sliders", e); }
    }
    /* سلايدر بلا مكتبة معروفة (قوالب Wix/Shopify/كود مخصص): حاوية تقصّ/تمرّر فيها صف شرائح متساوية الحجم أعرض من الحاوية؛ الأسهم والنقاط تُستنتج من الأصناف/العناوين */
    function findGenericSliders(claimed) {
      let cands = []; try { cands = [...doc.querySelectorAll("div,section,ul,ol,article")]; } catch (e) { return; }
      const small = r => r.w >= 10 && r.w <= 140 && r.h >= 10 && r.h <= 140;
      for (const root of cands) {
        if (sliders.length >= 12) break;
        if (claimed.some(c => c === root || c.contains(root) || root.contains(c)) || [...mq.keys()].some(k => k === root || k.contains(root) || root.contains(k))) continue;
        const rr = rectOf(root); if (rr.w < 200 || rr.h < 60 || rr.y >= limit) continue; if (!/(hidden|auto|scroll|clip)/.test(win.getComputedStyle(root).overflowX)) continue;
        let track = null, slides = null, t = root;
        for (let d = 0; d < 3 && t; d++) { const ch = [...t.children].filter(x => { const r = rectOf(x); return r.w > 20 && r.h > 20 && win.getComputedStyle(x).position !== "absolute"; }); if (ch.length >= 2) { track = t; slides = ch; break; } if (ch.length === 1) t = ch[0]; else break; }
        if (!track || slides.length > 30) continue;
        const sr = slides.map(rectOf), w0 = sr[0]; if (sr.some(r => Math.abs(r.y - w0.y) > w0.h * .3 || r.w / w0.w > 1.25 || r.w / w0.w < .8 || r.h / w0.h > 1.3 || r.h / w0.h < .75)) continue;
        if (!sr.some(r => r.x + r.w > rr.x + rr.w + 6 || r.x < rr.x - 6)) continue; if (w0.w < rr.w * .2) continue;
        const pv = Math.max(1, sr.filter(r => inBox(r, rr)).length), act0 = sr.findIndex(r => inBox(r, rr)), act = act0 < 0 ? 0 : act0, ordered = slides.slice(act).concat(slides.slice(0, act));
        const pages = Math.ceil(ordered.length / pv); if (pages < 2) continue;
        const A = (() => { let a = root.parentElement; for (let i = 0; i < 2 && a && a !== doc.body && rectOf(a).h < rr.h * 1.6; i++) a = a.parentElement || a; return a || root; })(), inSl = x => slides.some(s => s.contains(x));
        const lab = x => (typeof x.className === "string" ? x.className : "") + " " + (x.getAttribute("aria-label") || "") + " " + (x.getAttribute("title") || "") + " " + (x.id || "");
        const pick = re => { let r = []; try { r = [...A.querySelectorAll("button,a,div,span,i,svg")].filter(x => !inSl(x) && re.test(lab(x)) && small(rectOf(x)) && !x.querySelector("button,a") && rectOf(x).y < limit); } catch (e) { } return r.filter(x => !r.some(y => y !== x && y.contains(x))).slice(0, 2); };
        const pr = pick(/(^|[\s_-])(prev|previous|back|left|arrow-left)([\s_-]|$)/i), nx = pick(/(^|[\s_-])(next|forward|right|arrow-right)([\s_-]|$)/i).filter(x => !pr.includes(x));
        let dots = []; try { for (const c of A.querySelectorAll("div,ul,ol,nav,span")) { if (inSl(c) || !/dot|bullet|indicator|pagina|pager|nav/i.test(lab(c))) continue; const k = [...c.children].filter(x => small(rectOf(x))); if (k.length >= 2 && (k.length === pages || k.length === slides.length)) { dots = k; break; } } } catch (e) { }
        const id = IDP + "s" + (++slN), ms = 5000;
        const gp = sr.length > 1 ? sr[1].x - sr[0].x : 0, gStep = Math.abs(gp) > 8 && Math.abs(sr[1].y - sr[0].y) < Math.abs(gp) * .5 ? Math.round(gp * pv) : 0;
        ordered.slice(0, pv).forEach((x, k) => elCls.set(x, ["pbsl-" + id + "-0"].concat(k === 0 ? ["pbsi-" + id + "-" + ms].concat(gStep ? ["pbsw-" + id + "-" + (gStep < 0 ? "m" : "") + Math.abs(gStep)] : []) : []))); ordered.slice(pv).forEach(x => slSkip.add(x));
        const actP = Math.floor(act / pv); dots.forEach((d, j) => { const pg = dots.length === pages ? (j - actP + pages) % pages : Math.min(pages - 1, Math.floor(j * pages / dots.length)); elCls.set(d, ["pbsd-" + id + "-" + pg]); });
        pr.forEach(x => elCls.set(x, ["pbsp-" + id])); nx.forEach(x => elCls.set(x, ["pbsn-" + id]));
        const sl = { id, def: {}, root, slides: ordered, pv, pages, stacked: false, track, ms, dots, pr, nx, act, generic: 1 }; sliders.push(sl); slRoot.set(root, sl); claimed.push(root);
      }
    }

    function findTabs() {      // التبويبات: كل تبويب «صفحة» مثل الشريحة؛ الأزرار = نقاط، واللوحات متراكمة في المكان نفسه
      let lists = []; try { lists = [...doc.querySelectorAll('[role="tablist"],.nav-tabs,.nav-pills,.elementor-tabs-wrapper,ul.tabs,.tabs-nav,.tab-list')] } catch (e) { }
      for (const lst of lists) {
        if (sliders.some(x => x.root.contains(lst))) continue; let tabs = [...lst.querySelectorAll('[role="tab"],[data-bs-toggle="tab"],[data-toggle="tab"],[data-bs-toggle="pill"],.elementor-tab-title')]; if (!tabs.length) tabs = [...lst.querySelectorAll("a[href^='#'],button[aria-controls]")];
        if (tabs.length < 2) continue; const panels = tabs.map(targetOf); if (panels.some(x => !x) || new Set(panels).size !== panels.length) continue; if (panels.some(pn => pn.contains(lst) || lst.contains(pn))) continue;
        const rr0 = rectOf(lst); if (rr0.y >= limit) continue;
        let root = panels[0].parentElement; while (root && !panels.every(pn => root.contains(pn))) root = root.parentElement; if (!root || root === doc.body || root === doc.documentElement) continue;
        let act = tabs.findIndex(t => t.getAttribute("aria-selected") === "true" || /(^|\s)(active|current|selected|elementor-active)(\s|$)/.test(t.className)); if (act < 0) act = Math.max(0, panels.findIndex(isShown));
        const rot = a => a.slice(act).concat(a.slice(0, act)), pn = rot(panels), tb = rot(tabs), id = IDP + "s" + (++slN);
        elCls.set(pn[0], ["pbsl-" + id + "-0", "pbsi-" + id + "-0"]); pn.slice(1).forEach(x => slSkip.add(x)); tb.forEach((t, j) => elCls.set(t, ["pbsd-" + id + "-" + j]));
        const sl = { id, def: {}, root, slides: pn, pv: 1, pages: pn.length, stacked: true, track: null, ms: 0, dots: tb, pr: [], nx: [], act, tabs: 1 }; sliders.push(sl); slRoot.set(root, sl);
      }
    }
    function sliderPages(sl, clip) {
      const rr = rectOf(sl.root), cl = inter(rr, clip); if (!cl) return; const s0 = rectOf(sl.slides[0]), r0 = elRange.get(sl.slides[0]), z0 = sl.circ ? (sl.z0 != null ? sl.z0 : z) : (r0 && out[r0[0]] ? out[r0[0]].set.zi : null);
      for (let p = sl.circ ? 0 : 1; p < sl.pages; p++) {
        const N = sl.slides.length, win = sl.circ ? Array.from({ length: sl.pv }, (_, k) => sl.slides[(p + k) % N]) : sl.slides.slice(p * sl.pv, (p + 1) * sl.pv); if (!win.length) break; const saved = [], keep = (n, props) => { saved.push([n, n.getAttribute("style")]); props.forEach(([k, v]) => n.style.setProperty(k, v, "important")); };
        if (sl.stacked) { sl.slides.forEach(x => { if (!win.includes(x)) keep(x, [["display", "none"]]); }); win.forEach(x => keep(x, [["display", "block"], ["opacity", "1"], ["visibility", "visible"], ["transform", "none"]])); }
        else if (!sl.circ) { const w0 = rectOf(win[0]); keep(sl.track, [["translate", (s0.x - w0.x) + "px " + (s0.y - w0.y) + "px"]]); win.forEach(x => keep(x, [["opacity", "1"], ["visibility", "visible"]])); const w1 = rectOf(win[0]); if (Math.abs(w1.x - s0.x) > 6 || Math.abs(w1.y - s0.y) > 6) { saved.reverse().forEach(([n, st]) => st == null ? n.removeAttribute("style") : n.setAttribute("style", st)); continue; } }
        const i0 = out.length;
        if (sl.circ) {      // نافذة دورية: كل شريحة تُزاح وحدها إلى موضعها في النافذة (الشرائح الملتفّة حول النهاية تبعد في الـDOM)
          saved.reverse().forEach(([n, st]) => st == null ? n.removeAttribute("style") : n.setAttribute("style", st)); saved.length = 0;
          const pitch = sl.pitch;
          win.forEach((x, k) => { const sv = [], kp = (n, props) => { sv.push([n, n.getAttribute("style")]); props.forEach(([a, v]) => n.style.setProperty(a, v, "important")); }; const rx = rectOf(x); kp(sl.track, [["translate", (s0.x + k * pitch - rx.x) + "px " + (s0.y - rx.y) + "px"]]); kp(x, [["opacity", "1"], ["visibility", "visible"]]); slSkip.delete(x); elCls.set(x, ["pbsl-" + sl.id + "-" + p].concat(p ? ["pb-sl-off"] : (k === 0 ? sl.tag0 : []))); visit(x, cl, null); sv.reverse().forEach(([n, st]) => st == null ? n.removeAttribute("style") : n.setAttribute("style", st)); });
        } else win.forEach(x => { slSkip.delete(x); elCls.set(x, ["pbsl-" + sl.id + "-" + p, "pb-sl-off"]); visit(x, cl, null); });
        saved.reverse().forEach(([n, st]) => st == null ? n.removeAttribute("style") : n.setAttribute("style", st));
        const ws = out.slice(i0); if (ws.length && z0 != null) { const zmin = Math.min(...ws.map(w => w.set.zi)); ws.forEach(w => { w.set.zi = w.set.zi - zmin + z0; }); }
      }
      if (fx) fx.stats.slides = (fx.stats.slides || 0) + sl.slides.length;
    }
    function sliderControls(sl) {      // الأسهم الخالية من محتوى (أيقونة ::after) نرسم لها رمزاً، ونُكسب النقاط مظهر «نشط/غير نشط»
      for (const [list, ch, cls] of [[sl.pr, "‹", "pbsp-" + sl.id], [sl.nx, "›", "pbsn-" + sl.id]]) for (const a of list) {
        const r = rectOf(a); if (r.w < 4 || r.h < 4 || r.y >= limit || a.textContent.trim() || a.querySelector("img,svg")) continue; const ps = win.getComputedStyle(a, "::after"), c = col(ps.content && ps.content !== "none" ? ps.color : win.getComputedStyle(a).color) || { r: 255, g: 255, b: 255, a: 1 };
        add("text", r, { html: '<p dir="ltr" style="text-align:center;margin:0;unicode-bidi:isolate">' + ch + "</p>", fs: { d: Math.round(Math.min(44, r.h * .9)) }, fw: "700", lh: { d: 1 }, ta: { d: "center" }, color: hex(c), cls });
      }
      const rg = d => elRange.get(d), paintOf = d => { const q = rg(d); return q ? out.slice(q[0], q[1]).find(w => w.type === "shape" || w.type === "button" || w.type === "image") : null; };
      const on = sl.dots.find(d => /active|current|selected/.test(d.className)) || sl.dots[0], off = sl.dots.find(d => d !== on); if (!on || !off) return; const pa = paintOf(on), pi = paintOf(off); if (!pa || !pi) return;
      const rule = (cl, p) => `selector.${cl}{opacity:${p.set.op != null ? p.set.op : 1}!important}` + (p.type === "shape" && p.set.fill ? `\nselector.${cl} .pb-svg *{fill:${p.set.fill}!important}` : "");
      const txtOf = d => { const q = rg(d); return q ? out.slice(q[0], q[1]).filter(w => w.type === "text" || w.type === "heading" || w.type === "button") : []; }, ta = txtOf(on), ti = txtOf(off);
      for (const d of sl.dots) { const q = rg(d); if (!q) continue; out.slice(q[0], q[1]).filter(w => w.type === "text" || w.type === "heading").forEach((w, k) => { const a = ta[k], b = ti[k]; if (!a || !b || a.set.color === b.set.color) return; PBCloneFx.pushItem(w, PBCloneFx.mkItem("مظهر نص التبويب/النقطة (نشط · غير نشط)", "selector.pb-dot-on .pb-t,selector.pb-dot-on .pb-t *{color:[[on]]!important}\nselector.pb-dot-off .pb-t,selector.pb-dot-off .pb-t *{color:[[off]]!important}", { on: { l: "لون النص عند النشاط", t: "text", v: a.set.color }, off: { l: "لون النص عند عدم النشاط", t: "text", v: b.set.color } })); }); }
      for (const d of sl.dots) { const q = rg(d); if (!q) continue; out.slice(q[0], q[1]).filter(w => w.type === "shape" || w.type === "button").forEach(w => { PBCloneFx.pushItem(w, PBCloneFx.mkItem("مظهر النقطة/التبويب (نشط · غير نشط)", "[[code]]", PBCloneFx.rawP("selector{transition:all .3s}\n" + rule("pb-dot-on", pa) + "\n" + rule("pb-dot-off", pi)))); }); }
    }

    /* ───── مجموعات الإظهار/الإخفاء: أكورديون، <details>، القوائم المنسدلة، قائمة الجوال ☰ ─────
       الرأس يحمل pbdh-<id> والمحتوى pbdb-<id> (مخفي pb-gx-off إن كان مغلقاً) وبياناته pbdm-<id>-<الارتفاع>-<عتبة التحريك>-<مفتوح؟>-<تحويم؟>-<العرض> على أول عنصر منه */
    const discs = []; let dN = 0;
    const FORCE = [["display", "block"], ["visibility", "visible"], ["opacity", "1"], ["height", "auto"], ["max-height", "none"], ["overflow", "visible"], ["transform", "none"], ["pointer-events", "auto"], ["clip", "auto"], ["clip-path", "none"]];
    const isShown = e => { const r = e.getBoundingClientRect(), c = win.getComputedStyle(e); return r.height > 2 && r.width > 2 && c.display !== "none" && c.visibility !== "hidden" && Number(c.opacity) > .05; };
    const targetOf = h => {
      const raw = h.getAttribute("aria-controls") || h.getAttribute("data-bs-target") || h.getAttribute("data-target") || (/^#./.test(h.getAttribute("href") || "") ? h.getAttribute("href") : "") || ""; if (!raw) return null;
      try { return doc.getElementById(raw.replace(/^#/, "")) || doc.querySelector(raw); } catch (e) { return null; }
    };
    function findDisclosures() {
      const used = new Set(), items = [], add1 = it => { if (!it.head || (!it.bodies.length && !it.make) || used.has(it.head) || it.bodies.some(b => b === it.head || b.contains(it.head) || it.head.contains(b))) return; used.add(it.head); items.push(it); };
      const byBody = new Map(), bySrc = new Map(); let mh = []; try { mh = [...doc.querySelectorAll('[data-toggle="modal"],[data-bs-toggle="modal"],[data-fancybox],[data-lightbox],a.glightbox,a.fancybox')]; } catch (e) { }
      for (const h of mh) {
        const r = rectOf(h); if (r.w < 4 || r.h < 4 || r.y >= limit) continue; const lbx = h.hasAttribute("data-fancybox") || h.hasAttribute("data-lightbox") || /glightbox|fancybox/.test(String(h.className));
        if (!lbx) { const b = targetOf(h); if (!b) continue; if (byBody.has(b)) { byBody.get(b).heads.push(h); used.add(h); continue; } const it = { head: h, heads: [h], bodies: [b], o0: false, hov: false, modal: true }; add1(it); if (used.has(h)) byBody.set(b, it); }
        else { const im = h.querySelector("img"), href = h.getAttribute("href") || h.getAttribute("data-src") || ""; const src = abs(/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(href) ? href : (im && (im.currentSrc || im.getAttribute("src")) || "")); if (!src) continue; if (bySrc.has(src)) { bySrc.get(src).heads.push(h); used.add(h); continue; } if (bySrc.size >= 30) continue; const it = { head: h, heads: [h], bodies: [], o0: false, hov: false, modal: true, lb: src }; it.make = (id, vh) => makeLightbox(src, id, vh); add1(it); if (used.has(h)) bySrc.set(src, it); }
      }
      for (const d of doc.querySelectorAll("details")) { const sm = d.querySelector(":scope > summary"); if (sm) add1({ head: sm, bodies: [...d.children].filter(c => c !== sm && c.tagName !== "SCRIPT"), det: d, o0: d.open, hov: false }); }
      let heads = []; try { heads = [...doc.querySelectorAll('[aria-expanded][aria-controls],[data-bs-toggle="collapse"],[data-toggle="collapse"],.navbar-toggler,.menu-toggle,.hamburger,[class*="burger"],[class*="menu-toggle"],[class*="nav-toggle"],button[aria-label*="menu" i],button[aria-label*="القائمة"]')]; } catch (e) { }
      for (const h of heads) {
        if (h.getAttribute("role") === "tab" || h.closest("details,[role=tablist]")) continue; const r = rectOf(h); if (r.w < 4 || r.h < 4 || r.y >= limit) continue;
        let b = targetOf(h); if (!b) { const n = h.nextElementSibling; if (n && /^(nav|ul|div)$/i.test(n.tagName)) b = n; else if (h.parentElement) b = h.parentElement.querySelector(":scope > nav, :scope > .collapse, :scope > ul"); }
        if (b) add1({ head: h, bodies: [b], o0: isShown(b), hov: h.hasAttribute("aria-haspopup") });
      }
      let subs = []; try { subs = [...doc.querySelectorAll('li > ul, li > .sub-menu, li > .dropdown-menu, .dropdown > .dropdown-menu, .menu-item-has-children > ul, li > div[class*="mega"], li > div[class*="dropdown"]')]; } catch (e) { }
      for (const b of subs) { if (isShown(b) || b.closest("details")) continue; const li = b.parentElement, h = (b.previousElementSibling && /^(a|button|span)$/i.test(b.previousElementSibling.tagName) ? b.previousElementSibling : li && li.querySelector(":scope > a, :scope > button")); if (h && rectOf(h).w > 4) add1({ head: h, bodies: [b], o0: false, hov: true }); }
      for (const it of items) { it.id = IDP + "d" + (++dN); (it.heads || [it.head]).forEach(hh => elCls.set(hh, ["pbdh-" + it.id])); if (it.o0) it.bodies.forEach(b => elCls.set(b, ["pbdb-" + it.id])); discs.push(it); }
    }

    function makeLightbox(src, id, vh) {
      vh = vh || 900; const bw = Math.min(Math.round(W * .7), W - 40), bh = Math.round(vh * .78), x = Math.round((W - bw) / 2), y = Math.round((vh - bh) / 2);
      add("shape", { x: 0, y: 0, w: W, h: vh }, { shape: "rect", fill: "#000000", op: .72, outline: false, sw: 0, keep: false, cls: "pbdx-" + id });
      add("image", { x, y, w: bw, h: bh }, { src, alt: "", fit: "contain" });
      add("text", { x: W - 76, y: 18, w: 52, h: 52 }, { html: '<p dir="ltr" style="margin:0;text-align:center;color:#ffffff;cursor:pointer">×</p>', fs: { d: 38 }, fw: "700", lh: { d: 1.2 }, ta: { d: "center" }, color: "#ffffff", cls: "pbdx-" + id });
    }
    function discPass() {
      const full = { x: 0, y: 0, w: W, h: limit }; let n = 0; const fe = win.frameElement, vh = W < 600 ? 780 : 900;
      for (const it of discs) {
        const saved = [], keep = (e, props) => { saved.push([e, e.getAttribute("style")]); props.forEach(([k, v]) => e.style.setProperty(k, v, "important")); }; let i0 = out.length, bodies = it.bodies, h0 = null;
        const undo = () => { saved.reverse().forEach(([e, st]) => st == null ? e.removeAttribute("style") : e.setAttribute("style", st)); if (it.det) it.det.removeAttribute("open"); if (fe && h0 != null) fe.style.height = h0; };
        if (it.modal && fe) { h0 = fe.style.height; fe.style.height = vh + "px"; }      // الإطار يُقاس بارتفاع شاشة حقيقي: النوافذ المنبثقة تتمركز بالنسبة له لا لارتفاع الصفحة كلها
        if (!it.o0 && !it.make) {
          if (it.det) it.det.setAttribute("open", "");
          for (const b of bodies) { let a = b.parentElement, k = 0; while (a && a !== doc.body && k++ < 4) { if (win.getComputedStyle(a).display === "none") keep(a, [["display", "block"]]); a = a.parentElement; } keep(b, FORCE); if (it.modal) b.querySelectorAll(".modal-dialog,.modal-content,[class*='dialog']").forEach(c => keep(c, [["transform", "none"], ["opacity", "1"]])); }
          if (!bodies.some(b => rectOf(b).h > 2)) { undo(); continue; }
        }
        const rs = bodies.map(rectOf).filter(r => r.h > 1), y0 = rs.length ? Math.min(...rs.map(r => r.y)) : 0, y1 = rs.length ? Math.max(...rs.map(r => r.y + r.h)) : 0, overlay = !!(it.modal || bodies.some(b => /absolute|fixed/.test(win.getComputedStyle(b).position)));
        if (!it.o0 || it.make) {
          i0 = out.length;
          if (it.make) it.make(it.id, vh);
          else {
            if (it.modal) add("shape", { x: 0, y: 0, w: W, h: vh }, { shape: "rect", fill: "#000000", op: .55, outline: false, sw: 0, keep: false, cls: "pbdx-" + it.id });      // خلفية معتمة: النقر عليها يغلق النافذة
            bodies.forEach(b => { const cl = ["pbdb-" + it.id, "pb-gx-off"]; elCls.set(b, cl); if (it.modal) b.querySelectorAll('[data-dismiss="modal"],[data-bs-dismiss="modal"],.close,.btn-close,.modal-close,button[class*="close"],a[class*="close"],[aria-label="Close"],[aria-label="إغلاق"]').forEach(x => elCls.set(x, ["pbdx-" + it.id])); visit(b, full, null); });
          }
          undo();
        }
        let ws = []; if (it.o0) bodies.forEach(b => { const q = elRange.get(b); if (q) ws = ws.concat(out.slice(q[0], q[1])); }); else ws = out.slice(i0); if (!ws.length) continue;
        if (it.make || it.modal) tagW(ws, ["pbdb-" + it.id, "pb-gx-off"]);
        if (overlay) { const zmax = out.reduce((m, w) => Math.max(m, w.set.zi || 0), 0), zmin = Math.min(...ws.map(w => w.set.zi || 0)); ws.forEach(w => { w.set.zi = w.set.zi - zmin + zmax + 5; }); }
        if (it.modal) { tagW(ws, ["pb-pin"]); ws.forEach(w => { PBCloneFx.pushItem(w, PBCloneFx.mkItem("تثبيت في منتصف الشاشة (نافذة منبثقة)", "selector{--pin:calc(var(--u)*[[top]]);--pino:calc(var(--u)*[[off]]);z-index:[[z]]}", { top: { l: "المسافة من أعلى الشاشة (px)", t: "num", v: 0 }, off: { l: "الموضع داخل الشاشة (px)", t: "num", v: Math.round(w.set.fy.d || 0) }, z: { l: "الترتيب z-index", t: "num", v: 90 } })); }); }      // تظهر في منتصف الشاشة الحالية أينما كان التمرير
        const H = overlay ? 0 : Math.round(y1 - y0), thr = Math.round(y0 + (it.o0 ? H : 0)); if (!overlay && fx) { let a = bodies[0].parentElement, k = 0; while (a && a !== doc.body && a !== doc.documentElement && k++ < 8) { const q = fx._S.own.get(a); if (q) tagW(out.slice(q[0], q[1]).filter(w => w.type === "shape" || w.type === "image"), ["pbds-" + it.id]); a = a.parentElement; } }      // خلفيات الحاويات تتمدّد مع فتح العنصر
        tagW([ws[0]], ["pbdm-" + it.id + "-" + H + "-" + thr + "-" + (it.o0 ? 1 : 0) + "-" + (it.hov ? 1 : 0) + "-" + W]); n++; if (it.modal && fx) fx.stats.modals = (fx.stats.modals || 0) + 1;
      }
      if (fx && n) fx.stats.disc = (fx.stats.disc || 0) + n;
    }

    /* ───── الأشرطة المتحركة النصية (إعلانات): تتحول لعنصر «شريط متحرّك» الجاهز في المطوّر بدل نسخ عناصرها مبعثرة ─────
       المسار الأول: عنصر بحركة CSS لا نهائية بإزاحة أفقية داخل حاوية تقصّ؛ الثاني: وسم <marquee> أو أصناف marquee/ticker */
    const mq = new Map(); const mqSkip = new Set();
    const bgOf = e => { for (let a = e; a && a !== doc.documentElement; a = a.parentElement) { const c = col(win.getComputedStyle(a).backgroundColor); if (c && c.a > .5) return c; } return null; };
    function mqItems(T) {
      let c = [...T.children]; if (c.length === 1) c = [...c[0].children];
      if (c.length === 2 && c[0].textContent.trim() && c[0].textContent.trim() === c[1].textContent.trim() && c[0].children.length > 1) c = [...c[0].children];
      else if (c.length >= 4 && c.length % 2 === 0) { const h = c.length / 2; if (c.slice(0, h).every((x, i) => x.textContent.trim() === c[h + i].textContent.trim())) c = c.slice(0, h); }
      if (!c.length) c = [T]; if (c.some(x => x.querySelector && x.querySelector("img,video,canvas,picture"))) return null;
      const t = c.map(x => x.textContent.replace(/\s+/g, " ").trim()).filter(Boolean); return t.length ? { els: c, texts: t } : null;
    }
    function addMarquee(C, T, dur, dir, mv) {      // mv: {travel:px مسافة دورة الحركة الأصلية} أو {speed:px/ث} — لمطابقة السرعة الفعلية لا مدة الدورة فقط
      const cr = rectOf(C); if (cr.w < 200 || cr.h < 14 || cr.y >= limit || mq.has(C) || [...mq.keys()].some(k => k.contains(C) || C.contains(k))) return;
      const it = mqItems(T); if (!it) return; const el0 = it.els[0], bg = bgOf(C) || { r: 23, g: 63, b: 53, a: 1 };
      /* لون النص الحقيقي: أعمق عنصر يحمل أول نص مرئي (لون المغلّف قد يكون شفافاً/موروثاً)؛ الشفاف أو النص المقصوص بالخلفية يُستبدل بلون مقابل لخلفية الشريط */
      let tEl = el0; try { const tw = doc.createTreeWalker(el0, 4); let n; while ((n = tw.nextNode())) { if (n.nodeValue.trim()) { tEl = n.parentElement || el0; break; } } } catch (e) { }
      const cs = win.getComputedStyle(el0), ts = win.getComputedStyle(tEl); let c = textFill(ts);
      if (!c || c.a < .35) { const lum = (.299 * bg.r + .587 * bg.g + .114 * bg.b); c = lum < 140 ? { r: 255, g: 255, b: 255, a: 1 } : { r: 20, g: 20, b: 20, a: 1 }; }
      let gap = 48; if (it.els.length >= 2) { const a = rectOf(it.els[0]), b = rectOf(it.els[1]); const g = b.x > a.x ? b.x - (a.x + a.w) : a.x - (b.x + b.w); if (isFinite(g) && g >= 4 && g < 400) gap = Math.round(g); }
      const ff = fontOf(cs);
      /* السرعة: عنصر المطوّر يحرّك «مجموعة نصوص واحدة» خلال mqs ثانية؛ نحسب mqs لتكون السرعة (px/ث) كالأصلية: مدة المجموعة = عرضها ÷ السرعة الأصلية */
      let gw = 0; try { gw = it.els.reduce((a, x) => a + rectOf(x).w, 0) + it.els.length * gap; } catch (e) { }
      let d2 = dur || 20; if (gw > 40 && mv) { const sp = mv.speed || (mv.travel > 20 && dur ? mv.travel / dur : 0); if (sp > 1) d2 = gw / sp; }
      mq.set(C, { cr, texts: it.texts, dur: Math.max(4, Math.min(300, Math.round(d2))), dir, gap, fs: Math.round(px(cs.fontSize) || 16), fw: String(cs.fontWeight), c: hex(c), bg: hex(bg), ff });
    }
    function findMarquees() {
      const S0 = fx && fx._S;
      if (S0) for (const [T, a] of S0.anims) {
        const i = a.names.findIndex((n, k) => a.iter[k % a.iter.length] === "infinite" && S0.kf.get(n) && /translate(X|3d)?\(/i.test(S0.kf.get(n).cssText)); if (i < 0) continue;
        let C = T.parentElement; while (C && C !== doc.body && win.getComputedStyle(C).overflowX === "visible") C = C.parentElement; if (!C || C === doc.body) continue; if (rectOf(T).w < rectOf(C).w * 1.05 && !/translate(X|3d)?\(\s*-?(9\d|1\d\d)(\.\d+)?%/i.test(S0.kf.get(a.names[i]).cssText)) continue;      // الشريط الأضيق من الحاوية مقبول إن كانت إزاحته ±100% (يدخل من الخارج)
        const kf = S0.kf.get(a.names[i]).cssText, to = /(?:to|100%)\s*\{[^}]*translate(?:X|3d)?\(\s*(-?[\d.]+)/i.exec(kf); let neg = to ? parseFloat(to[1]) < 0 : true; if (/reverse/.test(a.dir[i % a.dir.length])) neg = !neg;
        const d = parseFloat(a.dur[i % a.dur.length]) || 20, wT = rectOf(T).w, tx = (blk) => { const m = /translate(?:X|3d)?\(\s*(-?[\d.]+)(%|px)?/i.exec(blk || ""); return m ? (m[2] === "%" ? parseFloat(m[1]) * wT / 100 : parseFloat(m[1])) : 0; };
        const fb = /(?:from|0%)\s*\{([^}]*)\}/i.exec(kf), tb = /(?:to|100%)\s*\{([^}]*)\}/i.exec(kf), travel = Math.abs(tx(tb && tb[1]) - tx(fb && fb[1]));
        addMarquee(C, T, /ms$/.test(a.dur[i % a.dur.length]) ? d / 1000 : d, neg ? "ltr" : "rtl", { travel });      // عنصر المطوّر: الافتراضي (rtl) يتحرك لليمين، و ltr (animation-direction:reverse) لليسار
      }
      let cand = []; try { cand = [...doc.querySelectorAll("marquee,[class*='marquee'],[class*='ticker']")]; } catch (e) { }
      for (const e of cand) { if (mq.has(e)) continue; const isTag = e.tagName.toLowerCase() === "marquee"; let C = e; if (!isTag && win.getComputedStyle(C).overflowX === "visible") { C = e.parentElement; while (C && C !== doc.body && win.getComputedStyle(C).overflowX === "visible") C = C.parentElement; } if (!C || C === doc.body) continue; const T = isTag ? e : ([...C.children].find(x => x.scrollWidth > C.clientWidth * 1.05 || rectOf(x).w > rectOf(C).w * 1.05) || C.firstElementChild); if (!T) continue; if (!isTag && !([...C.querySelectorAll("*")].length)) continue; addMarquee(C, T, isTag ? Math.max(8, 400 / (+e.getAttribute("scrollamount") || 6)) : 20, e.getAttribute && e.getAttribute("direction") === "right" ? "rtl" : "ltr", isTag ? { speed: (+e.getAttribute("scrollamount") || 6) * 1000 / Math.max(10, +e.getAttribute("scrolldelay") || 85) } : undefined); }
    }

    /* ───── النماذج: تتحول لعنصر «نموذج اتصال» الجاهز (يعمل: واتساب/بريد/رابط استقبال) بحقولها وألوانها؛ نماذج البحث تبقى شكلاً ───── */
    function emitForm(f) {
      if (typeof PBCloneFx === "undefined" || PBCloneFx.isSearchForm(f)) return false; const r = rectOf(f); if (r.w < 160 || r.h < 40 || r.y >= limit) return false;
      const ctl = [...f.querySelectorAll("input,textarea,select")].filter(c => { const t = (c.getAttribute("type") || "text").toLowerCase(); if (/^(hidden|submit|button|image|reset|file|range|color|password)$/.test(t)) return false; const q = rectOf(c); return q.w > 20 && q.h > 10; }); if (!ctl.length) return false;
      const lab = c => { let l = c.id ? f.querySelector('label[for="' + String(c.id).replace(/"/g, "") + '"]') : null; if (!l) l = c.closest("label"); const t = l ? l.textContent.replace(/\s+/g, " ").trim() : ""; return (t || c.getAttribute("aria-label") || c.getAttribute("placeholder") || c.getAttribute("name") || "حقل").slice(0, 60); };
      const fields = ctl.slice(0, 12).map(c => { const tg = c.tagName.toLowerCase(), t0 = (c.getAttribute("type") || "text").toLowerCase(); const type = tg === "textarea" ? "textarea" : tg === "select" ? "select" : /^(checkbox|radio)$/.test(t0) ? "checkbox" : /^(tel|email|number|date)$/.test(t0) ? t0 : "text"; const o = { label: lab(c), type, ph: c.getAttribute("placeholder") || "", req: !!c.required || c.getAttribute("aria-required") === "true", w: "full" }; if (tg === "select") o.opts = [...c.options].map(x => x.textContent.trim()).filter(Boolean).join(","); return o; });
      ctl.slice(0, 12).forEach((c, i) => { const q = rectOf(c); if (q.w < r.w * .62 && ctl.some((d, j) => j !== i && Math.abs(rectOf(d).y - q.y) < 12 && Math.abs(rectOf(d).x - q.x) > 20)) fields[i].w = "half"; });
      const sb = f.querySelector('button[type="submit"],input[type="submit"],button:not([type])') || f.querySelector("button"), btn = sb ? (sb.tagName === "INPUT" ? sb.value : sb.textContent).replace(/\s+/g, " ").trim() : "", c0 = ctl.find(c => !/checkbox|radio/.test(c.getAttribute("type") || "")) || ctl[0];
      const ics = win.getComputedStyle(c0), fcs = win.getComputedStyle(f), sbc = sb ? win.getComputedStyle(sb) : null, ib = col(ics.backgroundColor), ibd = col(ics.borderTopColor), fb = col(fcs.backgroundColor), fbd = col(fcs.borderTopColor), bb = sbc ? col(sbc.backgroundColor) : null, bc = sbc ? col(sbc.color) : null, tc = col(fcs.color);
      const lb = f.querySelector("label"), lc = lb ? col(win.getComputedStyle(lb).color) : tc, pad = ["Top", "Right", "Bottom", "Left"].map(k => Math.round(px(fcs["padding" + k])));
      const rr = radiusOf(fcs, r), props = { title: "", desc: "", fields, btn: btn || "إرسال", dest: "whatsapp", dzPhone: fields.some(x => x.type === "tel"), ok: "تم إرسال رسالتك بنجاح، شكراً لك!", subject: "نموذج من الموقع", fbg: fb && fb.a > .3 ? hex(fb) : "#ffffff", fbc: fbd && fbd.a > .1 && px(fcs.borderTopWidth) >= 1 ? hex(fbd) : "#e6dfcf", frad: { d: Math.round(rr) }, fpad: { d: pad.some(v => v > 0) ? pad : [20, 20, 20, 20] }, tcol: tc ? hex(tc) : "#173f35", lcol: lc ? hex(lc) : "#444444", ibg: ib && ib.a > .2 ? hex(ib) : "#ffffff", ibc: ibd && ibd.a > .1 ? hex(ibd) : "#e0d9c8", irad: { d: Math.round(radiusOf(ics, rectOf(c0))) }, ifs: { d: Math.round(px(ics.fontSize) || 16) }, bbg: bb && bb.a > .2 ? hex(bb) : "#157a55", bcol: bc ? hex(bc) : "#ffffff", brad: { d: sbc ? Math.round(radiusOf(sbc, rectOf(sb))) : 12 }, bfull: sb ? rectOf(sb).w >= r.w * .8 : true, cd: 20 };
      const w = add("contact", clipY(r), props); if (w && fx) fx.stats.forms = (fx.stats.forms || 0) + 1; return !!w;
    }
    function emitMarquee(C) {
      const m = mq.get(C), w = add("marquee", m.cr, { mqt: m.texts.join("\n"), mqs: m.dur, mqd: m.dir, mqg: { d: m.gap }, mqp: true, mqbg: m.bg, mqc: m.c, fs: { d: m.fs }, fw: m.fw, ff: m.ff || undefined }); if (w && fx) fx.stats.marquee = (fx.stats.marquee || 0) + 1;
    }
    function visit(el, clip, anchor) {
      const i0 = out.length; visit0(el, clip, anchor); const sl = slRoot.get(el); if (sl) sliderPages(sl, clip); const i1 = out.length;
      const tg = elCls.get(el); if (tg && i1 > i0) tagW(out.slice(i0, i1), tg); if (tg || slRoot.has(el)) elRange.set(el, [i0, i1]);
      if (fx && i1 > i0) { try { fx.el(el, i0, ownEnd.has(el) && !sl ? ownEnd.get(el) : i1, i1); } catch (e) { console.warn("fx", e); } }
    }
    if (fx) { try { fx.pre(); } catch (e) { console.warn("fx.pre", e); } }
    try { findMarquees(); } catch (e) { console.warn("marquee", e); }
    if (!opt.noSlides) { try { findSliders(); findTabs(); } catch (e) { console.warn("sliders", e); } }
    if (!opt.noDisc) { try { findDisclosures(); } catch (e) { console.warn("disc", e); } }
    visit(doc.documentElement, { x: 0, y: 0, w: W, h: limit }, null);
    sliders.forEach(sl => { try { sliderControls(sl); } catch (e) { console.warn("slctl", e); } });
    try { discPass(); } catch (e) { console.warn("discpass", e); }
    if (fx) { try { fx.post(); } catch (e) { console.warn("fx.post", e); } }
    return { widgets: out, bg: bodyBg, truncated: stop || count > 5000, fx: fx ? fx.stats : null };
  }

  /* ───────── بناء الصفحة وفتحها في المحرّر ───────── */
  function buildPage(widgets, title, bg, W, limit, mob) {
    const sec = PB.mkCanvas(); Object.assign(sec.set, { layout: "full", scaled: true, dw: W, mh: { d: Math.round(limit) }, pad: { d: [0, 0, 0, 0] } }); sec.free = widgets;
    const page = PB.newPage(title || "قالب منسوخ", ""); page.header = false; page.footer = false; if (bg) page.bg = bg; page.sections = [sec];
    if (mob && mob.widgets.length) {      // نسخة الجوال: قسم مستقل بعرض تصميم 390 يظهر على الجوال فقط، والقسم الأول يُخفى على الجوال
      const sm = PB.mkCanvas(); Object.assign(sm.set, { layout: "full", scaled: true, dw: mob.W, mh: { d: Math.round(mob.limit) }, pad: { d: [0, 0, 0, 0] }, hd: true, ht: true, cm: true }); sm.free = mob.widgets; sec.set.hm = true; sec.set.cm = true; page.sections.push(sm);
      // cm: قسما سطح المكتب/الجوال المنسوختان لا يظهران باهتَين فوق بعضهما في المحرّر؛ يظهر كل منهما في عرض جهازه فقط
    }
    return page;
  }
  /* يستخرج تصميم الجوال: نفس الصفحة في إطار بعرض 390؛ الحد السفلي يُقابَل بكتلة الصفحة نفسها (بالموضع في شجرة الجسم) */
  async function extractMobile(docD) {
    const MW = 390, f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-same-origin"); f.style.cssText = `position:fixed;left:-9999px;top:0;width:${MW}px;height:1200px;border:0;visibility:hidden`; document.body.appendChild(f);
    try {
      await new Promise((res, rej) => { f.onload = res; f.onerror = rej; f.srcdoc = S.html; setTimeout(res, 20000); }); const d = f.contentDocument; if (!d || !d.body) throw new Error("لا إطار");
      try { await Promise.race([Promise.all([...d.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))), sleep(5000)]); await Promise.race([d.fonts ? d.fonts.ready : Promise.resolve(), sleep(2500)]); } catch (e) { } await sleep(300);
      const hM = Math.min(16000, Math.max(d.documentElement.scrollHeight, d.body.scrollHeight, 300)); f.style.height = hM + "px"; await sleep(80);
      const wr = (dd, rootEl) => { let r = rootEl; for (let k = 0; k < 3; k++) { const kids = [...r.children].filter(c => !SKIP.has(c.tagName.toLowerCase())); if (kids.length === 1) r = kids[0]; else break; } return r; };
      let limM = hM; try {
        const rD = wr(docD, docD.body), rM = wr(d, d.body), kD = [...rD.children], kM = [...rM.children]; let idx = -1;
        kD.forEach((c, i) => { const q = c.getBoundingClientRect(); if (q.height > 2 && q.top < S.limit - 6) idx = i; });
        if (idx >= 0 && kM.length === kD.length) { for (let i = idx; i >= 0; i--) { const q = kM[i].getBoundingClientRect(); if (q.height > 2) { limM = Math.max(200, Math.round(q.bottom)); break; } } }
      } catch (e) { }
      limM = Math.min(limM, 9000); const res = extract(d, f.contentWindow, MW, limM, { idp: "m" }); return { widgets: res.widgets, W: MW, limit: limM, fx: res.fx };
    } finally { f.remove(); }
  }
  async function deliver(page) {      // الوجهة: قسم داخل الصفحة الحالية (الافتراضي) أو صفحة جديدة
    const dest = (document.querySelector('input[name="cl-dest"]:checked') || {}).value || "sec";
    if (dest === "sec") { finishFx(); await sleep(900); const sec = page.sections[0]; if (page.bg && !/^#f{6}$/i.test(page.bg)) page.sections.forEach(x => { x.set.bg = page.bg; }); close(); A().insertSections(page.sections, "نسخ قالب"); return true; }
    return openInEditor(page);
  }
  async function openInEditor(page) {
    const E = A().E; if (E && E.page && E.dirty && !confirm("سيُفتح القالب المنسوخ في صفحة جديدة، وتُحفظ مسودة صفحتك الحالية تلقائياً. هل تريد المتابعة؟")) return false;
    { const up = S.upl || [], E2 = A().E; if (E2 && E2.page && E2.page.media) E2.page.media = E2.page.media.filter(x => !up.includes(x)); page.media = up.slice(); }      // صور النسخ تُسجَّل في مكتبة الصفحة الجديدة لا السابقة
    try { A().saveDraftNow(); } catch (e) { } finishFx(); await sleep(900); close(); A().open(page, "", true); return true;
  }
  async function saveImages(widgets, doSave) {      // يحفظ الصور في موقعك (يتفادى الروابط الخارجية التي قد تتعطّل): كل رابط فريد مرة واحدة (نسخة الجوال والشرائح تتشارك الصور) بأقصى 80 رابطاً فريداً
    const by = new Map(); widgets.forEach(w => { if (w.type === "image" && /^https?:/.test(w.set.src) && !/\.(gif|svg)(\?|$)/i.test(w.set.src)) { const k = w.set.src; if (!by.has(k)) by.set(k, []); by.get(k).push(w); } });
    const urls = [...by.keys()].slice(0, 80); if (!doSave || !urls.length) return 0;
    let done = 0, i = 0;
    async function work() { while (i < urls.length) { const u = urls[i++]; prog(S.p0 + (S.p1 - S.p0) * done / urls.length); try { const bl = await fetchBlob(u), p = bl ? await A().uploadBlob(bl, "clone", { max: 1920 }) : null; if (p) { by.get(u).forEach(w => { w.set.src = p; }); (S.upl = S.upl || []).push(p); } } catch (e) { } done++; prog(S.p0 + (S.p1 - S.p0) * done / urls.length); } }
    await Promise.all(Array.from({ length: 8 }, work)); return done;
  }
  function fxSummary(f) { if (!f) return ""; const a = []; if (f.shadow || f.tshadow) a.push((f.shadow + f.tshadow) + " ظل"); if (f.anim) a.push(f.anim + " حركة"); if (f.entr) a.push(f.entr + " حركة ظهور"); if (f.hover) a.push(f.hover + " تأثير تحويم"); if (f.pin) a.push(f.pin + " عنصر ثابت عند التمرير"); if (f.slides) a.push(f.slides + " شريحة"); if (f.disc) a.push(f.disc + " قائمة/أكورديون قابل للفتح"); if (f.marquee) a.push(f.marquee + " شريط متحرك"); if (f.forms) a.push(f.forms + " نموذج يعمل"); if (f.modals) a.push(f.modals + " نافذة منبثقة"); return a.length ? " — مع التأثيرات: " + a.join("، ") : ""; }
  /* روابط الموقع الأصلي تتحول إلى # (روابط المراسي الداخلية #xxx وواتساب/اتصل/بريد تبقى) كي لا يُخرج الزائر من صفحتك */
  function neutralizeLinks(ws) {
    let n = 0; const keep = u => /^(#|tel:|mailto:|sms:|https?:\/\/(wa\.me|api\.whatsapp\.com|wa\.link)\b)/i.test(String(u || "").trim());
    for (const w of ws) {
      const st = w.set; if (!st) continue;
      for (const k of ["link", "llink", "href"]) if (typeof st[k] === "string" && st[k] && !keep(st[k])) { st[k] = "#"; n++; }
      for (const k of ["html", "text"]) if (typeof st[k] === "string" && /href=/.test(st[k])) st[k] = st[k].replace(/href="([^"]*)"/g, (m, u) => { const v = u.replace(/&amp;/g, "&"); if (!v || keep(v)) return m; n++; return 'href="#"'; });
    }
    return n;
  }
  async function doCopyUrl() {
    const f = S.frame; if (!f || !f.contentDocument) return; const doc = f.contentDocument, win = f.contentWindow;
    prog(3); st(""); await sleep(30); const res = extract(doc, win, S.W, Math.round(S.limit)); if (!res.widgets.length) throw new Error("لم يُعثر على محتوى قابل للنسخ في هذه المنطقة");
    prog(25); S.upl = []; let mob = null; { await sleep(30); try { mob = await extractMobile(doc); } catch (e) { console.warn("mobile", e); } }
    prog(45); { const n = neutralizeLinks(res.widgets) + (mob ? neutralizeLinks(mob.widgets) : 0); if (n) console.info("روابط عُطّلت:", n); }
    S.p0 = 45; S.p1 = 92; await saveImages(res.widgets.concat(mob ? mob.widgets : []), true); prog(94);
    const title = (doc.title || "").trim() || (S.url ? new URL(S.url).hostname : "قالب منسوخ");
    prog(96); const page = buildPage(res.widgets, title, res.bg, S.W, S.limit, mob); const ok = await deliver(page); if (ok) toast("تم النسخ: " + res.widgets.length + " عنصراً قابلاً للتعديل" + (mob ? " + " + mob.widgets.length + " لنسخة الجوال" : "") + fxSummary(res.fx) + (res.truncated ? " (اقتُصر على أول العناصر لكثرتها)" : ""));
  }

  /* ───────── وضع الصورة: OCR ───────── */
  async function loadTess() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"; s.onload = res; s.onerror = () => rej(new Error("تعذّر تحميل محرّك التعرّف على النصوص (يلزم اتصال بالإنترنت)")); document.head.appendChild(s); });
    return window.Tesseract;
  }
  const lum = (r, g, b) => .299 * r + .587 * g + .114 * b;
  function median(a) { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] || 0; }
  function ringBg(data, w, h, b) {      // لون الخلفية حول سطر نصّي: وسيط عيّنات فوقه وتحته
    const px0 = []; const get = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
    for (let x = b.x0; x <= b.x1; x += 2) { px0.push(get(x, b.y0 - 3)); px0.push(get(x, b.y1 + 3)); } for (let y = b.y0; y <= b.y1; y += 3) { px0.push(get(b.x0 - 3, y)); px0.push(get(b.x1 + 3, y)); }
    return [0, 1, 2].map(k => Math.round(median(px0.map(p => p[k]))));
  }
  function inkColor(data, w, bg, b) {
    let best = [], mx = 0; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const i = (y * w + x) * 4, d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]); if (d > mx) mx = d; best.push([d, data[i], data[i + 1], data[i + 2]]); }
    if (mx < 60) return null; const sel = best.filter(p => p[0] >= mx * .75); const n = sel.length || 1; return [1, 2, 3].map(k => Math.round(sel.reduce((s, p) => s + p[k], 0) / n));
  }
  function wipe(ctx, data, w, h, b) {      // يمسح السطر بتدرّج عمودي من لوني الأعلى والأسفل عمودَ عموداً
    const get = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
    const pad = Math.max(3, Math.round((b.y1 - b.y0) * .12)), x0 = Math.max(0, b.x0 - pad), x1 = Math.min(w - 1, b.x1 + pad), y0 = Math.max(0, b.y0 - pad), y1 = Math.min(h - 1, b.y1 + pad);
    for (let x = x0; x <= x1; x++) { const t = get(x, y0 - 2), bt = get(x, y1 + 2), g = ctx.createLinearGradient(0, y0, 0, y1 + 1); g.addColorStop(0, `rgb(${t})`); g.addColorStop(1, `rgb(${bt})`); ctx.fillStyle = g; ctx.fillRect(x, y0, 1, y1 - y0 + 1); }
  }
  function groupLines(lines) {      // أسطر ← فقرات (تتقارب رأسياً وتتحاذى)
    lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0); const blocks = [];
    for (const l of lines) { const h = l.y1 - l.y0; let hit = null; for (const b of blocks) { const last = b.lines[b.lines.length - 1], lh = last.y1 - last.y0, gap = l.y0 - last.y1, ov = Math.min(b.x1, l.x1) - Math.max(b.x0, l.x0), wmin = Math.min(b.x1 - b.x0, l.x1 - l.x0);
        const sizeOk = h / lh > .72 && h / lh < 1.38, al = Math.abs(l.x0 - last.x0) < lh * .9 || Math.abs(l.x1 - last.x1) < lh * .9 || Math.abs((l.x0 + l.x1) / 2 - (last.x0 + last.x1) / 2) < lh * .9;
        if (gap < lh * .85 && gap > -lh * .3 && ov > wmin * .35 && sizeOk && al) { hit = b; break; } }
      if (hit) { hit.lines.push(l); hit.x0 = Math.min(hit.x0, l.x0); hit.x1 = Math.max(hit.x1, l.x1); hit.y1 = Math.max(hit.y1, l.y1); } else blocks.push({ lines: [l], x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 }); }
    return blocks;
  }
  const AR = /[؀-ۿ]/;
  /* ───────── تحويل اللقطة إلى عناصر: مناطق مسطّحة ← أشكال، مناطق بملمس ← صور، نصوص ← OCR ───────── */
  const cd = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
  function grid(data, w, h, C) {
    const gw = Math.ceil(w / C), gh = Math.ceil(h / C), mean = new Float32Array(gw * gh * 3), sd = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, n = 0; const x1 = Math.min(w, (gx + 1) * C), y1 = Math.min(h, (gy + 1) * C);
      for (let y = gy * C; y < y1; y++) for (let x = gx * C; x < x1; x++) { const i = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], l = .299 * r + .587 * g + .114 * b; sr += r; sg += g; sb += b; sl += l; sl2 += l * l; n++; }
      const k = gy * gw + gx; mean[k * 3] = sr / n; mean[k * 3 + 1] = sg / n; mean[k * 3 + 2] = sb / n; sd[k] = Math.sqrt(Math.max(0, sl2 / n - (sl / n) * (sl / n))); }
    return { gw, gh, mean, sd };
  }
  function spanArea(cells, gw) {      // مساحة الشكل بتجاهل الثقوب: مجموع امتداد كل صف
    const rows = new Map(); let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (const k of cells) { const y = (k / gw) | 0, x = k % gw, r = rows.get(y); if (!r) rows.set(y, [x, x]); else { if (x < r[0]) r[0] = x; if (x > r[1]) r[1] = x; } if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    let a = 0; rows.forEach(r => { a += r[1] - r[0] + 1; }); return { span: a, x0, x1, y0, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
  }
  function refine(data, w, h, s0) {      // يمدّ كل حافة بالبكسل حتى لا يطابق الصف/العمود التالي لون الشكل
    const c = s0.color, ok = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return false; const i = (y * w + x) * 4; return (Math.abs(data[i] - c[0]) + Math.abs(data[i + 1] - c[1]) + Math.abs(data[i + 2] - c[2])) / 3 < 13; };
    const frac = (fn, n) => { let m = 0, t = 0; for (let i = 0; i < n; i += 2) { t++; if (fn(i)) m++; } return t ? m / t : 0; };
    for (let it = 0; it < 8; it++) { if (frac(i => ok(s0.x + Math.round(i / s0.w * s0.w), s0.y - 1), s0.w) > .8) { s0.y -= 1; s0.h += 1; } else break; }
    for (let it = 0; it < 8; it++) { if (frac(i => ok(s0.x + i, s0.y + s0.h), s0.w) > .8) s0.h += 1; else break; }
    for (let it = 0; it < 8; it++) { if (frac(i => ok(s0.x - 1, s0.y + i), s0.h) > .8) { s0.x -= 1; s0.w += 1; } else break; }
    for (let it = 0; it < 8; it++) { if (frac(i => ok(s0.x + s0.w, s0.y + i), s0.h) > .8) s0.w += 1; else break; }
  }
  function cornerRadius(data, w, h, s0) {      // نصف قطر الزاوية: أول حافة لونية على القطر من الزاوية (t = 0.293·r)؛ بلا حافة واضحة في ثلاث زوايا على الأقل ← 0 (لا نشوّه الشكل)
    const m = Math.floor(Math.min(s0.w, s0.h) / 2), L = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; }, rs = [];
    for (const [cx, cy, dx, dy] of [[s0.x, s0.y, 1, 1], [s0.x + s0.w - 1, s0.y, -1, 1], [s0.x, s0.y + s0.h - 1, 1, -1], [s0.x + s0.w - 1, s0.y + s0.h - 1, -1, -1]]) {
      const c0 = L(cx, cy), inn = L(cx + dx * Math.min(m, 4 + Math.floor(m * .6)), cy + dy * Math.min(m, 4 + Math.floor(m * .6))); let k = 0, found = -1;
      if (cd(c0, inn) < 22) { rs.push(0); continue; }      // الزاوية بلون الداخل نفسه: زاوية حادة
      for (; k < m; k++) { if (cd(L(cx + dx * k, cy + dy * k), L(cx + dx * (k + 1), cy + dy * (k + 1))) > 26 && cd(L(cx + dx * (k + 2), cy + dy * (k + 2)), c0) > 20) { found = k + 1; break; } }
      rs.push(found > 0 ? found / .293 : -1); }
    const ok = rs.filter(v => v >= 0); if (ok.length < 3) return 0; const r = median(ok); return r < 4 ? 0 : Math.round(Math.min(r, Math.min(s0.w, s0.h) / 2));
  }
  function detect(data, w, h) {
    const C = 4, G = grid(data, w, h, C), { gw, gh, mean, sd } = G, N = gw * gh, flat = new Uint8Array(N), tex = new Uint8Array(N);
    for (let k = 0; k < N; k++) { flat[k] = sd[k] < 5.5 ? 1 : 0; tex[k] = sd[k] >= 6.5 ? 1 : 0; }
    const par = new Int32Array(N).map((_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
    const m3 = k => [mean[k * 3], mean[k * 3 + 1], mean[k * 3 + 2]];
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const k = y * gw + x; if (!flat[k]) continue; if (x + 1 < gw && flat[k + 1] && cd(m3(k), m3(k + 1)) < 14) uni(k, k + 1); if (y + 1 < gh && flat[k + gw] && cd(m3(k), m3(k + gw)) < 14) uni(k, k + gw); }
    const comps = new Map(); for (let k = 0; k < N; k++) if (flat[k]) { const r = find(k); (comps.get(r) || comps.set(r, []).get(r)).push(k); }
    const shapes = [], area = w * h;
    comps.forEach(cells => { const n = cells.length; if (n * C * C < 26 * 26) return; const sa = spanArea(cells, gw), bw = sa.bw * C, bh = sa.bh * C; if (bw < 22 || bh < 14) return;
      const touches = (sa.x0 === 0 ? 1 : 0) + (sa.y0 === 0 ? 1 : 0) + (sa.x1 === gw - 1 ? 1 : 0) + (sa.y1 === gh - 1 ? 1 : 0); if (touches >= 3 || (bw * bh > area * .85)) return;      // خلفية الصفحة
      const ratio = sa.span / (sa.bw * sa.bh), aspect = bw / bh; let kind = ""; if (ratio >= .86) kind = "rect"; else if (ratio > .72 && ratio < .83 && aspect > .75 && aspect < 1.33) kind = "ellipse"; if (!kind) return;
      let r = 0, g = 0, b = 0; cells.forEach(k => { r += mean[k * 3]; g += mean[k * 3 + 1]; b += mean[k * 3 + 2]; }); const col0 = [r / n, g / n, b / n].map(Math.round), rad = kind === "rect" && ratio < .995 ? Math.min(Math.min(bw, bh) / 2, Math.sqrt((sa.bw * sa.bh * C * C - sa.span * C * C) / (4 - Math.PI))) : 0;
      const sh = { kind, x: sa.x0 * C, y: sa.y0 * C, w: bw, h: bh, color: col0, rad: Math.round(rad), area: bw * bh }; refine(data, w, h, sh); sh.rad = kind === "rect" ? cornerRadius(data, w, h, sh) : 0; sh.area = sh.w * sh.h; shapes.push(sh); });
    /* صور: خلايا ذات ملمس كثيف */
    const dens = new Uint8Array(N); for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let c = 0, t = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue; t++; c += tex[yy * gw + xx]; } dens[y * gw + x] = c / t > .5 ? 1 : 0; }
    const p2 = new Int32Array(N).map((_, i) => i), f2 = x => { while (p2[x] !== x) { p2[x] = p2[p2[x]]; x = p2[x]; } return x; };
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const k = y * gw + x; if (!dens[k]) continue; for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue; const k2 = yy * gw + xx; if (dens[k2]) { const a = f2(k), b = f2(k2); if (a !== b) p2[a] = b; } } }
    const pc = new Map(); for (let k = 0; k < N; k++) if (dens[k]) { const r = f2(k); (pc.get(r) || pc.set(r, []).get(r)).push(k); }
    let photos = []; pc.forEach(cells => { const sa = spanArea(cells, gw), bw = sa.bw * C, bh = sa.bh * C; if (bw < 44 || bh < 44 || sa.span / (sa.bw * sa.bh) < .6) return; photos.push({ x: Math.max(0, sa.x0 * C - C), y: Math.max(0, sa.y0 * C - C), w: Math.min(w, bw + 2 * C), h: Math.min(h, bh + 2 * C), area: bw * bh }); });
    const touchB = (a, b) => !(a.x > b.x + b.w + 12 || b.x > a.x + a.w + 12 || a.y > b.y + b.h + 12 || b.y > a.y + a.h + 12); let merged = true;      // دمج صناديق الصور المتجاورة
    while (merged) { merged = false; for (let i = 0; i < photos.length && !merged; i++) for (let j = i + 1; j < photos.length && !merged; j++) if (touchB(photos[i], photos[j])) { const a = photos[i], b = photos[j], x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x + a.w, b.x + b.w), y1 = Math.max(a.y + a.h, b.y + b.h); photos.splice(j, 1); photos[i] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, area: (x1 - x0) * (y1 - y0) }; merged = true; } }
    photos = photos.filter(p => p.area < area * .9).slice(0, 14);
    const inP = s0 => photos.some(p => s0.x >= p.x - 4 && s0.y >= p.y - 4 && s0.x + s0.w <= p.x + p.w + 4 && s0.y + s0.h <= p.y + p.h + 4);      // أشكال داخل الصور ليست أشكالاً
    return { shapes: shapes.filter(s0 => !inP(s0)).sort((a, b) => b.area - a.area).slice(0, 120), photos };
  }
  function fillRing(ctx, data, w, h, b, rgb) {      // يملأ المستطيل بلون الإطار المحيط (وسيط) أو لون معطى
    let c = rgb; if (!c) { const g = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; }, pts = []; for (let x = b.x; x < b.x + b.w; x += 3) { pts.push(g(x, b.y - 3)); pts.push(g(x, b.y + b.h + 3)); } for (let y = b.y; y < b.y + b.h; y += 3) { pts.push(g(b.x - 3, y)); pts.push(g(b.x + b.w + 3, y)); } c = [0, 1, 2].map(k => Math.round(median(pts.map(p => p[k])))); }
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2); return c;
  }
  const toBlob = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));
  async function doCopyImage() {
    const im = S.img; if (!im) return; const dw = im.dw, k = im.k, H = Math.round(S.limit), srcH = Math.max(8, Math.round(H / k));
    const cv = document.createElement("canvas"); cv.width = dw; cv.height = H; const ctx = cv.getContext("2d", { willReadFrequently: true }); ctx.drawImage(im.el, 0, 0, im.el.naturalWidth, Math.min(im.el.naturalHeight, srcH), 0, 0, dw, H);
    const ocr = $("cl-ocr") && $("cl-ocr").checked, vec = !$("cl-vec") || $("cl-vec").checked, keep = $("cl-keep") && $("cl-keep").checked, lang = ($("cl-lang") && $("cl-lang").value) || "ara+eng"; let blocks = [], note = "";
    if (ocr) { try { const T = await loadTess();  const { data } = await T.recognize(cv, lang, { logger: m => { if (m && m.status && m.progress != null) st("التعرّف على النصوص: " + Math.round(m.progress * 100) + "% — " + m.status); } });
        const raw = data.lines || (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || [])); const lines = raw.filter(l => l.text && l.text.replace(/\s+/g, "").length >= 2 && (l.confidence == null || l.confidence >= 45) && /[\p{L}\p{N}]/u.test(l.text)).map(l => ({ x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1, text: l.text.replace(/\s+/g, " ").trim() }));
        blocks = groupLines(lines); } catch (e) { note = " (تعذّر التعرّف على النصوص: " + e.message + ")"; } }
    let id0 = ctx.getImageData(0, 0, dw, H), data0 = id0.data; const orig = document.createElement("canvas"); orig.width = dw; orig.height = H; orig.getContext("2d").drawImage(cv, 0, 0);
    const texts = [];
    for (const b of blocks) { const ls = b.lines, lhs = ls.map(l => l.y1 - l.y0), fsEst = Math.max(8, Math.round(median(lhs) * .8)), pitch = ls.length > 1 ? (ls[ls.length - 1].y0 - ls[0].y0) / (ls.length - 1) : fsEst * 1.35, bgc = ringBg(data0, dw, H, { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }), ink = inkColor(data0, dw, bgc, { x0: Math.max(0, b.x0), y0: Math.max(0, b.y0), x1: Math.min(dw - 1, b.x1), y1: Math.min(H - 1, b.y1) });
      texts.push({ b, fsEst, pitch, ink: ink || (lum(bgc[0], bgc[1], bgc[2]) > 140 ? [20, 20, 20] : [245, 245, 245]) }); }
    for (const t of texts) for (const l of t.b.lines) wipe(ctx, data0, dw, H, { x0: Math.max(0, l.x0), y0: Math.max(0, l.y0), x1: Math.min(dw - 1, l.x1), y1: Math.min(H - 1, l.y1) });
    let shapes = [], photos = []; if (vec) {  await sleep(20); const d1 = ctx.getImageData(0, 0, dw, H); const r = detect(d1.data, dw, H); shapes = r.shapes; photos = r.photos; }
    const widgets = []; let z = 1; const mk = (type, x, y, w, h, p) => { const w0 = PB.mkFree(type, 0, 0, ++z); Object.assign(w0.set, p); delete w0.set.mh; w0.set.fx = { d: r2(x / dw * 100) }; w0.set.fy = { d: Math.round(y) }; w0.set.fwd = { d: r2(w / dw * 100) }; w0.set.fh = { d: Math.max(2, Math.round(h)) }; widgets.push(w0); return w0; };
    /* صور مقتطعة (من لقطة بلا نصوص) */
    const photoW = []; let pi = 0; for (const p of photos) { prog(20 + 60 * (pi++) / Math.max(1, photos.length));  const c2 = document.createElement("canvas"); c2.width = Math.round(p.w); c2.height = Math.round(p.h); c2.getContext("2d").drawImage(cv, Math.round(p.x), Math.round(p.y), c2.width, c2.height, 0, 0, c2.width, c2.height); let src = ""; try { src = await A().uploadBlob(await toBlob(c2, "image/webp", .9), "clone-img", { max: 1600 }); } catch (e) { src = c2.toDataURL("image/jpeg", .85); } photoW.push({ p, src }); }
    /* تنظيف الخلفية: الصور ثم الأشكال من الأصغر للأكبر ليُملأ كل منها بلون ما حوله */
    const d2 = ctx.getImageData(0, 0, dw, H).data, wipeList = photos.map(p => ({ b: p, col: null })).concat(shapes.slice().sort((a, b) => a.area - b.area).map(s0 => ({ b: s0, col: null })));
    if (!keep) for (const wl of wipeList) { const b = { x: Math.round(wl.b.x), y: Math.round(wl.b.y), w: Math.round(wl.b.w), h: Math.round(wl.b.h) }; fillRing(ctx, ctx.getImageData(0, 0, dw, H).data, dw, H, b, null); }
     const blob = await toBlob(cv, "image/webp", .92); let src = ""; try { src = await A().uploadBlob(blob, "clone-bg", { max: 2000 }); } catch (e) { src = cv.toDataURL("image/jpeg", .85); }
    mk("image", 0, 0, dw, H, { src: keep ? await (async () => { try { return await A().uploadBlob(await toBlob(orig, "image/webp", .92), "clone-bg", { max: 2000 }); } catch (e) { return orig.toDataURL("image/jpeg", .85); } })() : src, alt: "", fit: "fill" });
    for (const s0 of shapes) { const isBtn = false; mk("shape", s0.x, s0.y, s0.w, s0.h, { shape: s0.kind, keep: false, outline: false, fill: "#" + s0.color.map(v => v.toString(16).padStart(2, "0")).join(""), sw: 0, rx: 0, rad: s0.kind === "rect" && s0.rad >= 1 ? { d: Math.round(Math.min(s0.rad, Math.min(s0.w, s0.h) / 2)) } : undefined }); }
    for (const ph of photoW) mk("image", ph.p.x, ph.p.y, ph.p.w, ph.p.h, { src: ph.src, alt: "", fit: "fill" });
    /* أزرار: شكل دائري/مستدير صغير يحوي سطر نص واحد ← عنصر زر */
    const used = new Set(), btnShapes = new Set();
    for (const s0 of shapes) { if (s0.kind !== "rect" || s0.h < 24 || s0.h > 96 || s0.w < 60 || s0.w > 460 || s0.w / s0.h < 1.6 || s0.w / s0.h > 9) continue; const inside = texts.filter(t => { const cx = (t.b.x0 + t.b.x1) / 2, cy = (t.b.y0 + t.b.y1) / 2; return cx > s0.x && cx < s0.x + s0.w && cy > s0.y && cy < s0.y + s0.h; }); if (inside.length !== 1 || inside[0].b.lines.length !== 1 || used.has(inside[0])) continue; const t = inside[0]; used.add(t); btnShapes.add(s0);
      const tw = t.b.x1 - t.b.x0, ph = Math.max(6, Math.round((s0.w - tw) / 2)), pv = Math.max(4, Math.round((s0.h - t.pitch) / 2)), tc = t.ink;
      mk("button", s0.x, s0.y, s0.w, s0.h, { text: t.b.lines[0].text, kind: "link", link: "#", bgc: "#" + s0.color.map(v => v.toString(16).padStart(2, "0")).join(""), color: "#" + tc.map(v => v.toString(16).padStart(2, "0")).join(""), fs: { d: t.fsEst }, fw: "700", brad: { d: Math.round(Math.min(s0.rad, s0.h / 2)) }, bpad: { d: [pv, ph, pv, ph] }, full: { d: true }, al: { d: "center" } }); }
    if (btnShapes.size) { for (let q = widgets.length - 1; q >= 0; q--) { const w0 = widgets[q]; if (w0.type === "shape") { const m = [...btnShapes].find(s0 => Math.abs(w0.set.fy.d - Math.round(s0.y)) < 1 && Math.abs(w0.set.fx.d - r2(s0.x / dw * 100)) < .05 && Math.abs(w0.set.fwd.d - r2(s0.w / dw * 100)) < .05); if (m) widgets.splice(q, 1); } } }
    for (const t of texts) { if (used.has(t)) continue; const b = t.b, ar = AR.test(b.lines.map(l => l.text).join(" ")), single = b.lines.length === 1, w0 = b.x1 - b.x0, slack = Math.max(8, w0 * .08), cx = b.lines.map(l => (l.x0 + l.x1) / 2), cspread = Math.max(...cx) - Math.min(...cx), l0 = b.lines.map(l => l.x0), lsp = Math.max(...l0) - Math.min(...l0), r0 = b.lines.map(l => l.x1), rsp = Math.max(...r0) - Math.min(...r0);
      let ta = ar ? "right" : "left"; if (!single) { const lh = t.fsEst; ta = cspread < lh * .6 && lsp > lh * .8 ? "center" : (ar ? (rsp <= lsp ? "right" : "left") : (lsp <= rsp ? "left" : "right")); }
      const x = ta === "center" ? b.x0 - slack / 2 : ta === "right" ? b.x0 - slack : b.x0, html = "<p" + (single ? ' style="white-space:nowrap"' : "") + ">" + b.lines.map(l => esc(l.text)).join("<br>") + "</p>";
      mk("text", Math.max(0, x), b.y0 - Math.max(0, (t.pitch - (b.lines[0].y1 - b.lines[0].y0)) / 2), Math.min(dw, w0 + slack), t.pitch * b.lines.length, { html, fs: { d: t.fsEst }, lh: { d: r2(Math.max(1, Math.min(2.2, t.pitch / t.fsEst))) }, fw: t.fsEst >= 26 ? "700" : "400", color: "#" + t.ink.map(v => v.toString(16).padStart(2, "0")).join(""), ta: { d: ta }, tdir: ar ? "rtl" : undefined }); }
    const bgc = "#" + [0, 1, 2].map(kk => d2[kk].toString(16).padStart(2, "0")).join("");
    const page = buildPage(widgets, "قالب من صورة", bgc, dw, H); const ok = await deliver(page); if (ok) toast("تم النسخ: صورة خلفية + " + shapes.length + " شكلاً + " + photos.length + " صورة + " + texts.length + " نصاً" + (btnShapes.size ? " (منها " + btnShapes.size + " أزرار)" : "") + note);
  }

  /* ───────── الواجهة ───────── */
  function css() {
    if ($("cl-css")) return; const s = document.createElement("style"); s.id = "cl-css";
    s.textContent = `#pbx-clone{position:fixed;inset:0;background:rgba(10,20,17,.62);z-index:10020;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:inherit}
#pbx-clone .cl-box{position:relative;background:#fff;border-radius:18px;width:min(1180px,96vw);height:min(94vh,880px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45)}
#pbx-clone .cl-h{display:flex;align-items:center;gap:.6rem;padding:.8rem 1rem;border-bottom:1px solid #eee;background:#173f35;color:#fff}#pbx-clone .cl-h b{font-size:1rem;display:flex;align-items:center;gap:.4rem}#pbx-clone .cl-h small{opacity:.75;flex:1;font-weight:600}#pbx-clone .cl-h button{border:0;background:rgba(255,255,255,.15);color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer}
#pbx-clone .cl-tabs{display:flex;gap:.3rem;padding:.6rem 1rem 0}#pbx-clone .cl-tabs button{border:1.5px solid #e0d9c8;background:#fff;border-radius:10px 10px 0 0;padding:.45rem 1rem;cursor:pointer;font-family:inherit;font-weight:800;font-size:.85rem;color:#173f35}#pbx-clone .cl-tabs button.on{background:#173f35;color:#fff;border-color:#173f35}
#pbx-clone .cl-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;padding:.7rem 1rem;border-bottom:1px solid #eee;background:#faf6ec}#pbx-clone .cl-ctl input[type=text],#pbx-clone .cl-ctl input[type=url]{flex:1 1 280px;min-width:180px;border:1.5px solid #d9d2c2;border-radius:10px;padding:.5rem .7rem;font-family:inherit;direction:ltr;text-align:left}#pbx-clone .cl-ctl select{border:1.5px solid #d9d2c2;border-radius:10px;padding:.45rem;font-family:inherit}#pbx-clone .cl-ctl label{display:flex;align-items:center;gap:.3rem;font-size:.8rem;font-weight:700;color:#173f35}#pbx-clone .cl-ctl button,#pbx-clone .cl-f button{border:1.5px solid #173f35;background:#fff;color:#173f35;border-radius:10px;padding:.5rem 1rem;cursor:pointer;font-family:inherit;font-weight:800}#pbx-clone .cl-ctl button.pri,#pbx-clone .cl-f .cl-go{min-height:48px;padding:.65rem 1.3rem;background:rgba(34,197,94,.3);color:#fff;border-color:rgba(34,197,94,.6);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:none;transition:transform .15s,background .15s}#pbx-clone .cl-ctl button.pri:hover,#pbx-clone .cl-f .cl-go:hover:not(:disabled){background:rgba(34,197,94,.5);transform:translateY(-2px)}#pbx-clone #cl-ring{--p:0;flex:0 0 auto;width:44px;height:44px;border-radius:50%;background:conic-gradient(#16a34a calc(var(--p)*1%),#d6ecdc 0);display:inline-grid;place-items:center;box-shadow:0 0 0 2px rgba(22,163,74,.18)}#pbx-clone #cl-ring[hidden]{display:none}#pbx-clone #cl-ring i{font-style:normal;width:34px;height:34px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:.72rem;font-weight:900;color:#15803d;font-variant-numeric:tabular-nums}#pbx-clone .cl-f .cl-go:disabled{opacity:.45;cursor:not-allowed}
#pbx-clone .cl-ctl[hidden]{display:none!important}#pbx-clone .cl-h,#pbx-clone .cl-tabs,#pbx-clone .cl-ctl,#pbx-clone .cl-note,#pbx-clone .cl-f{flex:none}#pbx-clone .cl-stage{flex:1 1 0;overflow:auto;background:#d8d2c4;padding:14px;min-height:90px;position:relative}#pbx-clone .cl-empty{color:#6b6556;text-align:center;padding:3rem 1rem;line-height:2;font-weight:700}
#pbx-clone .cl-win{position:relative;margin:0 auto;overflow:hidden;background:#fff;box-shadow:0 6px 30px rgba(0,0,0,.35);direction:ltr}#pbx-clone .cl-in{position:absolute;left:0;top:0;transform-origin:0 0}#pbx-clone .cl-in iframe,#pbx-clone .cl-in img{display:block;border:0;background:#fff}
#pbx-clone .cl-lim{position:absolute;left:0;right:0;bottom:0;height:22px;cursor:ns-resize;touch-action:none;background:linear-gradient(to top,rgba(124,58,237,.35),rgba(124,58,237,0));border-bottom:3px solid #7c3aed;display:flex;align-items:flex-end;justify-content:center}#pbx-clone .cl-lim span{background:#7c3aed;color:#fff;font:800 .72rem system-ui,sans-serif;padding:.1rem .7rem;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:.4rem}
#pbx-clone .cl-f{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .8rem;padding:.6rem 1rem;border-top:1px solid #eee;background:#fff}#pbx-clone .cl-lr{display:flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:800;color:#6d28d9;white-space:nowrap}#pbx-clone .cl-lr input{width:150px;accent-color:#7c3aed}#pbx-clone .cl-lr b{min-width:56px;color:#173f35;font-variant-numeric:tabular-nums}#pbx-clone .cl-dest{display:flex;align-items:center;gap:.25rem;font-size:.78rem;font-weight:700;color:#173f35;white-space:nowrap}#pbx-clone .cl-f #cl-st{flex:1 1 200px;font-size:.8rem;color:#6b6556;font-weight:700}#pbx-clone .cl-extw{display:inline-flex;align-items:center}#pbx-clone .cl-extok{color:#0d9488;font-size:.78rem;white-space:nowrap}#pbx-clone .cl-help{background:#fff;border-radius:14px;padding:1.2rem 1.4rem;max-width:760px;margin:0 auto;line-height:2;color:#173f35}#pbx-clone .cl-help h3{margin:0 0 .4rem}#pbx-clone .cl-help li{margin:.3rem 0}#pbx-clone .cl-help code{background:#f4efe6;border-radius:6px;padding:.1rem .4rem}#pbx-clone .cl-sm{font-size:.76rem;color:#6b6556}#pbx-clone #cl-rep{position:absolute;bottom:84px;right:14px;width:min(400px,92%);max-height:min(62%,520px);overflow:auto;background:#fff;border:1.5px solid #d9d2c2;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.28);z-index:6;padding:.85rem .95rem;direction:rtl;font-size:.82rem;color:#173f35}#pbx-clone #cl-rep[hidden]{display:none}#pbx-clone #cl-rep h4{margin:0 0 .5rem;font-size:.95rem}#pbx-clone #cl-rep .rw{display:flex;gap:.5rem;align-items:flex-start;padding:.38rem 0;border-top:1px solid #f0ebe0;line-height:1.5}#pbx-clone #cl-rep .rw:first-of-type{border-top:0}#pbx-clone #cl-rep input[type=checkbox]{width:18px!important;height:18px;flex:none;margin:.15rem 0 0;accent-color:#0d9488}#pbx-clone #cl-rep .rw>div{flex:1 1 0;min-width:0}#pbx-clone #cl-rep .ch{flex:none;border-radius:999px;padding:.05rem .55rem;font-size:.7rem;font-weight:800;white-space:nowrap}#pbx-clone #cl-rep .ch.ok{background:#d1fae5;color:#065f46}#pbx-clone #cl-rep .ch.partial{background:#fef3c7;color:#92400e}#pbx-clone #cl-rep .ch.none{background:#fee2e2;color:#991b1b}#pbx-clone #cl-rep .rw small{display:block;color:#6b6556}#pbx-clone #cl-rep .bt{display:flex;gap:.5rem;margin-top:.7rem;flex-wrap:wrap}#pbx-clone #cl-rep .bt button{border:1.5px solid #173f35;background:#fff;color:#173f35;border-radius:10px;padding:.4rem .9rem;cursor:pointer;font-family:inherit;font-weight:800}#pbx-clone #cl-rep .bt .pri{background:linear-gradient(135deg,#173f35,#0d9488);color:#fff;border-color:transparent}#pbx-clone .cl-sm.warn{border-color:#d97706;color:#92400e;background:#fffbeb}
#pbx-clone .cl-note{padding:.4rem 1rem;font-size:.72rem;color:#8a8268;background:#fffbea;border-bottom:1px solid #f1e6b8}`;
    document.head.appendChild(s);
  }
  const ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>';
  function close() { const m = $("pbx-clone"); if (m) m.remove(); S.frame = null; S.img = null; S.runId = ""; clearInterval(EXT.t); }
  function open() {
    css(); if ($("pbx-clone")) return; S.tab = "url"; S.frame = null; S.img = null; S.url = ""; const m = document.createElement("div"); m.id = "pbx-clone";
    m.innerHTML = `<div class="cl-box"><div class="cl-h"><b>${ICON} نسخ قالب</b><small>افتح موقعاً برابطه أو صورة، حدّد الحد السفلي بسحب الحافة، ثم «انسخ»: يتحوّل المحتوى إلى عناصر قابلة للتعديل</small><button type="button" data-cl="x" title="إغلاق">✕</button></div>
<div class="cl-tabs"><button type="button" class="on" data-cltab="url">رابط موقع</button><button type="button" data-cltab="img">صورة (لقطة شاشة)</button></div>
<div class="cl-ctl" data-pane="url"><input type="text" id="cl-url" placeholder="https://example.com" spellcheck="false"><button type="button" class="pri" data-cl="load">فتح</button><span id="cl-ext" class="cl-extw"></span><button type="button" data-cl="loadfull" title="يشغّل متصفحاً كاملاً (Chromium) على خادم GitHub Actions فيعرض الصفحة بجافاسكربتها، لنسخ المواقع المبنية بالجافاسكربت بدقة أعلى (1–2 دقيقة)">فتح بمتصفح كامل</button><label>عرض الصفحة <select id="cl-w"><option value="1440">1440</option><option value="1280" selected>1280</option><option value="1024">1024</option></select></label></div>
<div class="cl-ctl" data-pane="img" hidden><button type="button" class="pri" data-cl="pick">اختر صورة</button><span style="font-size:.78rem;color:#6b6556">أو اسحبها إلى النافذة أو الصقها (Ctrl+V)</span><label><input type="checkbox" id="cl-ocr" checked> تحويل النصوص إلى نص قابل للتعديل (OCR)</label><label><input type="checkbox" id="cl-vec" checked> رسم عناصر الصورة (مربعات وأزرار وصور) كعناصر</label><label><input type="checkbox" id="cl-keep"> إبقاء الصورة الأصلية كاملة خلف العناصر</label><label>اللغة <select id="cl-lang"><option value="ara+eng">عربي + إنجليزي</option><option value="eng">إنجليزي</option><option value="fra+eng">فرنسي + إنجليزي</option><option value="ara+fra+eng">عربي + فرنسي + إنجليزي</option></select></label></div>
<div class="cl-note">انسخ فقط ما لك حقّ استعماله: النصوص والصور والشعارات تعود لأصحابها. لا تُنفَّذ أي سكربتات من الموقع، والصفحات التي تُبنى بالجافاسكربت قد تظهر ناقصة (استعمل لقطة شاشة).</div>
<div class="cl-stage" id="cl-stage"><div class="cl-empty">اكتب رابط الموقع ثم اضغط «فتح»<br>وبعد ظهور الصفحة اسحب الحافة البنفسجية السفلية لتحديد آخر نقطة تُنسخ.</div></div>
<div id="cl-rep" hidden></div><div class="cl-f"><span id="cl-ring" hidden><i>0</i></span><span id="cl-st"></span><button type="button" class="cl-sm" id="cl-fxb" data-cl="fxrep" hidden title="تحليل التأثيرات والعناصر الموجودة في الصفحة وما هو متوفر منها في المطوّر">التأثيرات</button><button type="button" class="cl-sm" data-cl="diag" title="ينسخ تقريراً تقنياً عن آخر صفحة لإرساله للدعم عند ظهور معاينة فارغة">نسخ التقرير</button><label class="cl-lr" title="الحد السفلي للنسخ: كل ما فوقه يُنسخ">الحد السفلي <input type="range" id="cl-lr" min="120" max="2000" step="10" value="1200" disabled><b id="cl-lv">—</b></label><label class="cl-dest"><input type="radio" name="cl-dest" value="sec" checked> قسم في الصفحة الحالية</label><label class="cl-dest"><input type="radio" name="cl-dest" value="new"> صفحة جديدة</label><button type="button" class="cl-go" data-cl="copy" disabled>انسخ</button><button type="button" data-cl="x">إلغاء</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => { const b = e.target.closest("[data-cl],[data-cltab]"); if (!b) { if (e.target === m) close(); return; }
      if (b.dataset.cltab) { S.tab = b.dataset.cltab; m.querySelectorAll("[data-cltab]").forEach(x => x.classList.toggle("on", x === b)); m.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== S.tab); resetStage(); return; }
      const a = b.dataset.cl; if (a === "x") close(); else if (a === "extinfo") extHelp(); else if (a === "diag") copyDiag(); else if (a === "fxrep") fxPanel(); else if (a === "fxsend") { const un = (S.fxRep || []).filter((x, i) => x.status !== "ok" && (document.querySelector(`#cl-rep [data-fxi="${i}"]`) || {}).checked); sendFxRequests(un.length ? un : []); } else if (a === "fxclose") fxPanel(false); else if (a === "fxstat") fxStatus(); else if (a === "load") loadUrl(false); else if (a === "loadfull") loadUrl(true); else if (a === "pick") pickImg(); else if (a === "copy") run(); });
    $("cl-url").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); loadUrl(false); } });
    $("cl-w").addEventListener("change", () => { S.W = Number($("cl-w").value) || 1280; if (S.frame) mountFrame(S.html); });
    m.addEventListener("dragover", e => { if (S.tab === "img" && e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files")) e.preventDefault(); });
    m.addEventListener("drop", e => { if (S.tab !== "img") return; const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); loadImg(f); } });
    m.addEventListener("paste", e => { if (S.tab !== "img") return; const it = [...(e.clipboardData && e.clipboardData.items || [])].find(x => /^image\//.test(x.type)); if (it) loadImg(it.getAsFile()); });
    document.addEventListener("paste", pasteDoc); setTimeout(() => $("cl-url") && $("cl-url").focus(), 50);
    extUi(); extPing(); clearInterval(EXT.t); EXT.t = setInterval(() => { if (!$("pbx-clone")) { clearInterval(EXT.t); return; } if (!EXT.ok) extPing(); }, 3500);
  }
  function pasteDoc(e) { if (!$("pbx-clone")) { document.removeEventListener("paste", pasteDoc); return; } if (S.tab !== "img") return; const it = [...(e.clipboardData && e.clipboardData.items || [])].find(x => /^image\//.test(x.type)); if (it) { e.preventDefault(); loadImg(it.getAsFile()); } }
  function resetStage() { const stg = $("cl-stage"); if (!stg) return; S.frame = null; S.img = null; stg.innerHTML = `<div class="cl-empty">${S.tab === "url" ? "اكتب رابط الموقع ثم اضغط «فتح»<br>وبعد ظهور الصفحة اسحب الحافة البنفسجية السفلية لتحديد آخر نقطة تُنسخ." : "اختر لقطة شاشة للصفحة (أو اسحبها/الصقها)<br>ثم اسحب الحافة البنفسجية السفلية لتحديد آخر نقطة تُنسخ."}</div>`; const g = document.querySelector("#pbx-clone .cl-go"); if (g) g.disabled = true; st(""); }
  /* نافذة المعاينة: عرضها مصغَّر ليلائم، وحافتها السفلية تُسحب فيتغيّر الحد السفلي للنسخ */
  function mountWin(innerEl, W, docH, limit, wait) {
    const stg = $("cl-stage"); stg.innerHTML = ""; const avail = Math.max(300, stg.clientWidth - 28), k = Math.min(1, avail / W); S.k = k; S.docH = docH; S.limit = Math.max(120, Math.min(limit, docH));
    const win = document.createElement("div"); win.className = "cl-win"; win.style.width = Math.round(W * k) + "px"; const inn = document.createElement("div"); inn.className = "cl-in"; inn.style.cssText = `width:${W}px;transform:scale(${k})`; inn.appendChild(innerEl); win.appendChild(inn);
    const lim = document.createElement("div"); lim.className = "cl-lim"; lim.innerHTML = `<span id="cl-lt"></span>`; win.appendChild(lim); stg.appendChild(win);
    const set = v => { S.limit = Math.max(120, Math.min(S.docH, Math.round(v))); win.style.height = Math.round(S.limit * k) + "px"; const lt = $("cl-lt"); if (lt) lt.textContent = "الحد السفلي: " + S.limit + "px — اسحب لتكبير/تصغير النافذة"; const lr = $("cl-lr"); if (lr) { lr.max = Math.max(130, S.docH); lr.value = S.limit; lr.disabled = false; } const lv = $("cl-lv"); if (lv) lv.textContent = S.limit + "px"; }; set(S.limit);
    const lrEl = $("cl-lr"); if (lrEl) lrEl.oninput = () => { set(Number(lrEl.value)); stg.scrollTop = Math.max(0, win.offsetTop + S.limit * k - stg.clientHeight + 50); };      // شريط الحد: يضبط الحد ويُظهر خطه
    lim.addEventListener("pointerdown", e => { e.preventDefault(); lim.setPointerCapture(e.pointerId); const mv = ev => { const sr = stg.getBoundingClientRect(); if (ev.clientY > sr.bottom - 28) stg.scrollTop += 16; else if (ev.clientY < sr.top + 28) stg.scrollTop -= 16; set((ev.clientY - win.getBoundingClientRect().top + 11) / k); }, up = () => { lim.removeEventListener("pointermove", mv); lim.removeEventListener("pointerup", up); }; lim.addEventListener("pointermove", mv); lim.addEventListener("pointerup", up); });
    const g = document.querySelector("#pbx-clone .cl-go"); if (g) g.disabled = !!wait; S.setLimit = set;
  }
  /* قياس المعاينة: إن كانت شبه فارغة مع أن الصفحة المقروءة فيها نص، نُظهر العناصر المخفية بـopacity:0/visibility:hidden (بقايا أنيميشن الظهور عند التمرير) ثم نعيد القياس */
  function measureDoc(d) {
    const v = n => { const r = n.getBoundingClientRect(), c = d.defaultView.getComputedStyle(n); if (n.checkVisibility && !n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; return r.width > 2 && r.height > 2 && c.visibility !== "hidden" && c.display !== "none" && Number(c.opacity) > 0.05; };
    let vis = 0, hid = 0, txt = 0; const all = [...d.body.querySelectorAll("*")].slice(0, 6000);
    for (const n of all) { if (v(n)) { vis++; if (n.children.length === 0 && (n.textContent || "").trim().length) txt += n.textContent.trim().length; } else hid++; }
    const imgs = [...d.images], ok = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
    return { visEls: vis, hidEls: hid, visText: txt, imgs: imgs.length, imgsOk: ok };
  }

  /* ───── تحليل التأثيرات قبل النسخ + طلب إضافة غير المتوفر ─────
     التأثيرات والعناصر غير المتوفرة (none/partial) تُرسل كطلب إلى assets/data/fx-requests.json (يدمج الطلبات المتشابهة ويجمع المواقع والأمثلة)؛
     يقرؤه المطوّر في بداية كل مهمة فيُنفَّذ ما يُطلب، فيتغذّى المطوّر بإضافات جديدة مع كل موقع. */
  const FXREQ = "assets/data/fx-requests.json";
  const CHIP = { ok: "مدعوم", partial: "جزئي", none: "غير متوفر" };
  function fxPanel(show) {
    const el = $("cl-rep"), b = $("cl-fxb"); if (!el) return; const rep = S.fxRep || [], un = rep.filter(x => x.status !== "ok");
    if (b) { b.hidden = !rep.length; b.textContent = "التأثيرات (" + rep.length + ")" + (un.length ? " — " + un.length + " غير متوفر/جزئي" : ""); b.classList.toggle("warn", !!un.length); }
    const open = show === undefined ? el.hidden : !!show; if (show === undefined && !rep.length) return; el.hidden = !open; if (!open) return;
    const sent = S.fxSent || {}, host = (() => { try { return new URL(S.url).hostname; } catch (e) { return ""; } })();
    el.innerHTML = `<h4>تحليل التأثيرات في هذه الصفحة</h4>` + (un.length ? `<div style="margin-bottom:.4rem">وُجدت <b>${un.length}</b> تأثيرات/عناصر غير متوفرة بالكامل في المطوّر. حدّد ما تريد طلب إضافته ثم أرسل الطلب ليُحدَّث المطوّر ويقرأ هذه المواقع بدقة:</div>` : `<div style="margin-bottom:.4rem">كل ما في الصفحة مدعوم في المطوّر.</div>`) +
      rep.map((x, i) => `<div class="rw"><span class="ch ${x.status}">${CHIP[x.status]}</span><div style="flex:1"><b>${esc(x.label)}</b> <span class="cl-sm">× ${x.n}</span><small>${esc(x.note || "")}</small></div>${x.status !== "ok" ? (sent[host + "|" + x.id] ? '<span class="cl-sm">أُرسل ✓</span>' : `<input type="checkbox" data-fxi="${i}" checked title="اطلب إضافته">`) : ""}</div>`).join("") +
      `<div class="bt">${un.length ? '<button type="button" class="pri" data-cl="fxsend">إرسال طلب إضافة المحدَّد</button>' : ""}<button type="button" data-cl="fxstat">حالة طلباتي</button><button type="button" data-cl="fxclose">إغلاق</button></div><div id="cl-rep-st"></div>`;
  }

  /* «حالة طلباتي»: يقرأ assets/data/fx-requests.json ويعرض كل طلب وهل نُفِّذ وفي أي إصدار (state: new/done، doneIn) */
  async function fxStatus() {
    const box = $("cl-rep-st"); if (!box) return; box.innerHTML = '<div class="cl-sm" style="margin-top:.6rem">جارٍ قراءة الطلبات…</div>';
    try {
      if (typeof GH === "undefined" || !GH.cfg()) throw new Error("GitHub غير مضبوط"); const f = await GH.getFile(FXREQ), cur = JSON.parse(decodeURIComponent(escape(atob(String(f.content || "").replace(/\s/g, ""))))), rs = cur.requests || [];
      box.innerHTML = '<h4 style="margin:.7rem 0 .3rem">طلباتك المُرسلة</h4>' + (rs.length ? rs.map(r => `<div class="rw"><span class="ch ${r.state === "done" ? "ok" : "partial"}">${r.state === "done" ? "تمت الإضافة" : "قيد الانتظار"}</span><div style="flex:1"><b>${esc(r.label)}</b> <span class="cl-sm">× ${r.count || 1}</span><small>${r.state === "done" ? "نُفّذ في الإصدار " + esc(r.doneIn || "") + (r.doneNote ? " — " + esc(r.doneNote) : "") : "طُلب " + esc(String(r.last || r.first || "").slice(0, 10)) + " من: " + esc((r.sites || []).join("، "))}</small></div></div>`).join("") : '<div class="cl-sm">لا توجد طلبات مُرسلة بعد.</div>');
    } catch (e) { box.innerHTML = '<div class="cl-sm" style="margin-top:.6rem;color:#991b1b">تعذّرت القراءة: ' + esc(e.message) + "</div>"; }
  }
  async function sendFxRequests(items) {
    items = (items || []).filter(x => x.status !== "ok"); const host = (() => { try { return new URL(S.url).hostname; } catch (e) { return ""; } })();
    S.fxSent = S.fxSent || {}; items = items.filter(x => !S.fxSent[host + "|" + x.id]); if (!items.length) { toast("لا طلبات جديدة لإرسالها"); return false; }
    const now = new Date().toISOString(), mk = x => ({ id: x.id, label: x.label, status: x.status, note: x.note, n: x.n, host, url: S.url, snippet: x.snippet });
    const mergeInto = cur => { items.map(mk).forEach(e => { let r = cur.requests.find(q => q.id === e.id); if (!r) { r = { id: e.id, label: e.label, status: e.status, note: e.note, state: "new", first: now, sites: [], samples: [] }; cur.requests.push(r); } r.last = now; r.count = (r.count || 0) + 1; if (!r.sites.includes(e.host)) r.sites.push(e.host); if (r.samples.length < 5 && !r.samples.some(z => z.host === e.host)) r.samples.push({ host: e.host, url: e.url, n: e.n, snippet: e.snippet }); }); return cur; };
    try {
      if (typeof GH === "undefined" || !GH.cfg()) throw new Error("GitHub غير مضبوط"); let cur = { v: 1, requests: [] }, sha = null;
      try { const f = await GH.getFile(FXREQ); sha = f.sha; cur = JSON.parse(decodeURIComponent(escape(atob(String(f.content || "").replace(/\s/g, ""))))); if (!cur.requests) cur.requests = []; } catch (e) { if (!/404|لم يُعثر/.test(String(e.message))) throw e; }
      mergeInto(cur); await GH.putFile(FXREQ, btoa(unescape(encodeURIComponent(JSON.stringify(cur, null, 1)))), sha, "طلب إضافة تأثيرات للمطوّر: " + items.map(x => x.id).join(", "));
      items.forEach(x => { S.fxSent[host + "|" + x.id] = 1; }); toast("أُرسل طلب إضافة " + items.length + " تأثير/عنصر للمطوّر — تابعه من «حالة طلباتي»"); fxPanel(true); return true;
    } catch (e) {
      const cur = mergeInto({ v: 1, requests: [] }), blob = new Blob([JSON.stringify(cur, null, 1)], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fx-request-" + (host || "site") + ".json"; document.body.appendChild(a); a.click(); a.remove();
      items.forEach(x => { S.fxSent[host + "|" + x.id] = 1; }); toast("تعذّر الإرسال المباشر (" + e.message + ") — نُزّل ملف الطلب؛ أرسله لمطوّر الموقع"); fxPanel(true); return false;
    }
  }
  function diagPage(d, h2) {
    try {
      let m = measureDoc(d), fixed = 0; const total = (d.body.textContent || "").replace(/\s+/g, " ").trim().length;
      if (total > 100 && m.visText < Math.min(60, total * .2)) {
        const W = d.defaultView; d.querySelectorAll("body *").forEach(n => { const c = W.getComputedStyle(n); if ((Number(c.opacity) === 0 || c.visibility === "hidden") && ((n.textContent || "").trim().length > 3 || n.querySelector("img"))) { n.style.setProperty("opacity", "1", "important"); n.style.setProperty("visibility", "visible", "important"); fixed++; } });
        m = measureDoc(d);
      }
      const b = d.body, c = d.defaultView.getComputedStyle(b);
      S.diag = Object.assign({ ver: typeof CONFIG !== "undefined" && CONFIG.VERSION || "", src: S.src, url: S.url, ext: EXT.ok ? EXT.v : "off", extInfo: S.extInfo, extErr: S.extErr, htmlLen: (S.html || "").length, totalText: total, docH: h2, fixedHidden: fixed, body: { display: c.display, vis: c.visibility, op: c.opacity, ov: c.overflow, h: c.height, cls: (b.className || "").slice(0, 80), kids: b.children.length }, head: (b.innerText || "").replace(/\s+/g, " ").slice(0, 160), ua: navigator.userAgent.slice(0, 90), scr: screen.width + "x" + screen.height }, m);
      if (m.visText < 30 && total > 100) S.warn = "⚠ المعاينة تبدو فارغة رغم وجود نص في الصفحة المقروءة — اضغط «نسخ التقرير» وأرسله لي.";
      else S.warn = fixed ? "(أُظهرت " + fixed + " عنصراً كان مخفياً بالأنيميشن)" : "";
    } catch (e) { S.diag = { err: String(e && e.message || e) }; }
  }
  async function copyDiag() {
    const t = JSON.stringify(S.diag || { note: "لا تقرير بعد — افتح رابطاً أولاً" });
    try { await navigator.clipboard.writeText(t); toast("نُسخ التقرير — الصقه في المحادثة"); } catch (e) { window.prompt("انسخ هذا التقرير (Ctrl+C) وأرسله:", t); }
  }
  function mountFrame(html) {
    const W = S.W, f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-same-origin"); f.setAttribute("scrolling", "no"); f.style.cssText = `width:${W}px;height:900px`; S.frame = f;
    mountWin(f, W, 900, 900, true); st("جارٍ عرض الصفحة…");
    f.onload = async () => { st("تحميل الصور والخطوط…"); const d = f.contentDocument; if (!d) return; try { d.addEventListener("click", e => { const a = e.target && e.target.closest && e.target.closest("a,area"); if (a) e.preventDefault(); }, true); d.addEventListener("submit", e => e.preventDefault(), true); } catch (e) { } try { await Promise.race([Promise.all([...d.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))), sleep(5000)]); await Promise.race([d.fonts ? d.fonts.ready : Promise.resolve(), sleep(2500)]); } catch (e) { }
      const h = Math.min(16000, Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0, 300)); f.style.height = h + "px"; await sleep(80); const h2 = Math.min(16000, Math.max(d.documentElement.scrollHeight, h)); f.style.height = h2 + "px";
      diagPage(d, h2); try { S.fxRep = typeof PBCloneFx !== "undefined" ? PBCloneFx.analyze(d, f.contentWindow) : []; S.fxAsked = false; fxPanel(S.fxRep.some(x => x.status !== "ok")); } catch (e) { console.warn("analyze", e); } S.docH = h2; if (S.setLimit) S.setLimit(Math.min(h2, 1800)); const g = document.querySelector("#pbx-clone .cl-go"); if (g) g.disabled = false; st("جاهز — حجم الصفحة " + h2 + "px" + (S.src ? " [المصدر: " + ({ chrome: "إضافة كروم", proxy: "جلب عادي", github: "متصفح GitHub" }[S.src] || S.src) + "]" : "") + (S.extInfo ? " (قرأ كروم " + S.extInfo.text + " حرفاً و" + S.extInfo.imgs + " عنصراً مرئياً، ارتفاع " + S.extInfo.h + "px)" : "") + ". اسحب الحافة البنفسجية لتحديد الحد السفلي ثم «انسخ»." + (S.warn ? " " + S.warn : "")); };
    f.srcdoc = html;
  }
  async function loadUrl(full) {
    if (S.busy) return; let u = ($("cl-url").value || "").trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { new URL(u); } catch (e) { toast("الرابط غير صحيح"); return; }
    S.extInfo = null; S.extErr = ""; S.src = ""; S.warn = ""; S.diag = null; S.busy = true; S.url = u; S.W = Number($("cl-w").value) || 1280; S.limit = 0; S.docH = 0;
    try { const r = await getPage(u, !!full, 0); S.src = r.src; const bi = bodyInfo(r.html), real = bi.doc.querySelectorAll("img[src],video,picture").length; if ((bi.text < 60 && bi.imgs < 3) || (r.src === "proxy" && bi.text < 150 && real < 3)) throw new Error("وصلت الصفحة فارغة (الجلب العادي يرى قشرة بيضاء لأن الموقع يبني محتواه بالجافاسكربت أو داخل إطار). " + (!EXT.ok ? "الحل: ثبّت إضافة كروم (زر «تثبيت إضافة كروم») ثم أعد تحميل اللوحة F5." : extOld() ? "نسخة إضافة كروم عندك قديمة (v" + EXT.v + ") فتُتجاهل — احذفها وحمّل أحدث نسخة من «أحدث نسخة» ثم F5." : "إضافة كروم متصلة لكن فشلت القراءة" + (S.extErr ? ": " + S.extErr : "") + ".")); S.url = r.url; S.html = prep(r.html, r.url); mountFrame(S.html); }
    catch (e) { const m = e.blocked ? e.message + " جرّب «فتح بمتصفح كامل» (يلزم ربط GitHub)، أو التقط لقطة شاشة للصفحة واستعمل تبويب «صورة (لقطة شاشة)»." : e.message; resetStage(); st(m); toast(m); } finally { S.busy = false; }
  }
  const canFull = () => { try { const c = typeof GH !== "undefined" ? GH.cfg() : null; return !!(c && c.token && c.token !== "php" && c.owner); } catch (e) { return false; } };
  function bodyInfo(html) { const d = new DOMParser().parseFromString(html, "text/html"); d.querySelectorAll("script,style,noscript,template").forEach(n => n.remove()); return { text: (d.body ? d.body.textContent : "").replace(/\s+/g, " ").trim().length, imgs: d.querySelectorAll("img,svg,video,picture").length, doc: d }; }
  function mainIframe(html, base) {      // صفحة «غلاف» محتواها الحقيقي داخل إطار (مثل معاينة قوالب Wix): نتّبع رابط الإطار
    const b = bodyInfo(html); if (b.text > 600) return ""; const BAD = /recaptcha|googletagmanager|facebook\.com|doubleclick|youtube\.com\/embed|google\.com\/maps|twitter\.com|about:blank/i, fr = [...b.doc.querySelectorAll("iframe[src]")].map(f => { let u = ""; try { u = new URL(f.getAttribute("src"), base).href; } catch (e) { } return { u, pri: f.getAttribute("data-hook") === "desktop-iframe" ? 2 : 1 }; }).filter(x => /^https?:/.test(x.u) && !BAD.test(x.u)).sort((a, c) => c.pri - a.pri);
    return fr.length ? fr[0].u : "";
  }
  /* ───── إضافة كروم «مساعد نسخ القوالب»: تفتح الموقع في متصفحك الحقيقي (بجلستك وكوكيزك) فتقرأ كل المواقع ───── */
  const EXT = { ok: false, v: "", allowed: false, id: 0, pend: new Map(), t: 0 };
  window.addEventListener("message", e => { const d = e.data; if (e.source !== window || !d || !d.aly) return; const p = EXT.pend.get(d.id); if (p) { EXT.pend.delete(d.id); p(d); } });
  const extCall = (type, extra, ms) => new Promise((res, rej) => { const id = ++EXT.id, t = setTimeout(() => { EXT.pend.delete(id); rej(new Error("لا استجابة من الإضافة")); }, ms || 1500); EXT.pend.set(id, d => { clearTimeout(t); res(d); }); window.postMessage(Object.assign({ alyReq: 1, type, id }, extra || {}), location.origin); });
  const extOld = () => EXT.ok && String(EXT.v || "0").localeCompare("1.1.4", undefined, { numeric: true }) < 0;
  function extUi() { const el = $("cl-ext"); if (!el) return; if (extOld()) { el.innerHTML = `<button type="button" data-cl="extinfo" title="نسخة الإضافة المثبّتة قديمة (v${esc(EXT.v)}) وقد تُظهر بعض المواقع فارغة">حدّث الإضافة إلى 1.1.4</button>`; return; } el.innerHTML = EXT.ok ? `<b class="cl-extok" title="الإضافة v${esc(EXT.v)}">● كروم متصل (v${esc(EXT.v)})</b> <a class="cl-sm" href="assets/ext/alyssum-clone-helper.zip" download title="حمّل أحدث نسخة من الإضافة">أحدث نسخة ⭳</a> <button type="button" class="cl-sm" data-cl="extinfo" title="خطوات التثبيت والتحديث">؟</button>` : `<button type="button" data-cl="extinfo" title="إضافة كروم تفتح المواقع في متصفحك الحقيقي فتتجاوز الحماية وتقرأ كل المواقع">تثبيت إضافة كروم</button>`; }
  async function extPing() { try { const r = await extCall("ping", {}, 900); EXT.ok = true; EXT.v = r.v; EXT.allowed = !!r.ok; } catch (e) { EXT.ok = false; } extUi(); }
  async function fetchViaExt(url, W) { st("جارٍ فتح الموقع في متصفح كروم عندك (نافذة صغيرة مؤقتة)…"); const r = await extCall("fetch", { url, width: W }, 150000); if (r.error) throw new Error(r.error); S.extInfo = r.stats || null; return { html: r.html, url: r.url || url }; }
  function extHelp() {
    const stg = $("cl-stage"); if (!stg) return; S.frame = null; S.img = null; const g = document.querySelector("#pbx-clone .cl-go"); if (g) g.disabled = true;
    stg.innerHTML = `<div class="cl-help"><h3>إضافة كروم «مساعد نسخ القوالب»</h3><p>تفتح الموقع في <b>متصفح كروم الذي عندك</b> بجلستك وكوكيزك فتتجاوز صفحات الحماية (Cloudflare…) وتقرأ المواقع المبنية بالجافاسكربت، ثم تعيد نسخته لهذه النافذة. تُثبَّت مرة واحدة:</p><ol><li><a href="assets/ext/alyssum-clone-helper.zip" download>حمّل ملف الإضافة (zip)</a> وفُكّ ضغطه في أي مكان.</li><li>افتح في كروم العنوان <code dir="ltr">chrome://extensions</code> وفعّل <b>وضع المطوّر (Developer mode)</b> أعلى اليمين.</li><li>اضغط <b>«تحميل إضافة غير مضغوطة» (Load unpacked)</b> واختر المجلد <code dir="ltr">alyssum-clone-helper</code>.</li><li>أعد تحميل لوحة التحكم (F5) ثم افتح «نسخ قالب»: سيظهر «● كروم متصل». عند أول استعمال تُسأل مرة واحدة السماح للوحة.</li></ol><p class="cl-sm">للأمان: الإضافة لا تعمل إلا من صفحة لوحة التحكم التي توافق عليها، وتفتح نافذة صغيرة مؤقتة لكل طلب ثم تغلقها، ولا ترسل شيئاً إلى أي خادم.</p></div>`;
  }
  async function getPage(u, full, hop, via) {
    let html = null, src = full ? "github" : "proxy";
    if (full) html = await fetchFull(u, S.W);
    else {
      if (EXT.ok && extOld()) st("إضافة كروم عندك قديمة (v" + EXT.v + ") فتُتجاهل — حدّثها لتقرأ كل المواقع.");
      if (EXT.ok && !extOld()) { try { const x = await fetchViaExt(u, S.W); html = x.html; u = x.url; via = true; src = "chrome"; } catch (e) { S.extErr = e.message; st(e.message + " — جارٍ تجربة الجلب العادي…"); html = null; } }
      if (html == null) { try { html = await fetchHtml(u); } catch (e) { if (canFull()) { st(e.message + " — جارٍ المحاولة تلقائياً بالمتصفح الكامل…"); full = true; src = "github"; html = await fetchFull(u, S.W); } else throw e; } }
    }
    if (isChallenge(html)) { const e = new Error("الموقع يعرض صفحة تحقّق من الجدار الحماية (Enable JavaScript and cookies to continue) حتى للمتصفح الكامل. لا يمكن نسخه آلياً — افتحه في متصفحك والتقط لقطة شاشة للصفحة ثم استعمل تبويب «صورة (لقطة شاشة)»."); throw e; }
    const fr = hop < 2 ? mainIframe(html, u) : ""; if (fr) { st("المحتوى الحقيقي داخل إطار مضمّن — جارٍ فتح رابطه…"); return getPage(fr, full, hop + 1, via); }
    if (!full && !via && canFull()) { const b = bodyInfo(html); if (b.text < 150 && b.imgs < 3) { st("الصفحة تُبنى بالجافاسكربت — جارٍ استعمال المتصفح الكامل…"); html = await fetchFull(u, S.W); src = "github"; if (hop < 2) { const f2 = mainIframe(html, u); if (f2) return getPage(f2, true, hop + 1); } } }
    return { html, url: u, src };
  }
  function pickImg() { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => { if (i.files[0]) loadImg(i.files[0]); }; i.click(); }
  function loadImg(file) {
    const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { const dw = Math.min(1600, im.naturalWidth), k = dw / im.naturalWidth, H = Math.round(im.naturalHeight * k); im.style.cssText = `width:${dw}px;height:${H}px`; S.img = { el: im, dw, k, H, file }; S.W = dw; mountWin(im, dw, H, Math.min(H, 1800)); st("جاهز — الصورة " + im.naturalWidth + "×" + im.naturalHeight + ". اسحب الحافة البنفسجية لتحديد الحد السفلي ثم «انسخ»."); };
    im.onerror = () => toast("تعذّر قراءة الصورة"); im.src = url;
  }
  async function run() {
    if (S.busy) return; const g = document.querySelector("#pbx-clone .cl-go"); S.busy = true; if (g) g.disabled = true; prog(1); doneShown = false;
    try {      // اختيار التأثيرات المطلوب إضافتها يتم من نافذة «التأثيرات» الأولى فقط؛ لا نافذة تأكيد ثانية عند «انسخ»
      if (S.tab === "url") await doCopyUrl(); else { prog(10); await doCopyImage(); finishFx(); } setTimeout(() => prog(null), 1800); } catch (e) { prog(null); st(e.message); toast("تعذّر النسخ: " + e.message); if (g) g.disabled = false; console.warn(e); } finally { S.busy = false; }
  }
  return { open, close, _t: { extractMobile, neutralizeLinks, extract, prep, buildPage, groupLines, cssGrad, col, wipe, ringBg, inkColor, detect, S } };
})();
