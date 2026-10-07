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
  const st = m => { const e = $("cl-st"); if (e) e.textContent = m || ""; };

  /* ───────── ألوان ───────── */
  let cv0 = null, cx0 = null; const cc = new Map();
  function col(c) {      // أي لون CSS ← {r,g,b,a} (عبر canvas ليشمل oklch وغيره)
    if (!c || c === "transparent" || c === "none") return null; if (cc.has(c)) return cc.get(c);
    if (!cx0) { cv0 = document.createElement("canvas"); cv0.width = cv0.height = 1; cx0 = cv0.getContext("2d", { willReadFrequently: true }); }
    cx0.clearRect(0, 0, 1, 1); cx0.fillStyle = "#000"; cx0.fillStyle = c; cx0.fillRect(0, 0, 1, 1); const d = cx0.getImageData(0, 0, 1, 1).data, o = d[3] ? { r: d[0], g: d[1], b: d[2], a: d[3] / 255 } : null; cc.set(c, o); return o;
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
  async function fetchHtml(url) {
    const tries = [url].concat(PROXIES.map(p => p(url))); let last = null;
    for (let i = 0; i < tries.length; i++) { try { st(i ? "جارٍ المحاولة عبر وسيط (" + i + "/" + PROXIES.length + ")…" : "جارٍ جلب الصفحة…"); const buf = await fget(tries[i], "buf"); const html = decode(buf); if (/<html|<body|<!doctype/i.test(html.slice(0, 4000)) && html.length > 300) return html; last = new Error("استجابة ليست صفحة HTML"); } catch (e) { last = e; } }
    throw new Error("تعذّر جلب الصفحة (" + (last && last.message || "؟") + "). جرّب موقعاً آخر أو استعمل تبويب «صورة» بلقطة شاشة للصفحة.");
  }
  async function fetchBlob(url) { const tries = [url].concat(PROXIES.map(p => p(url))); for (const t of tries) { try { const b = await fget(t, "blob", 20000); if (b && b.size > 200 && /^image\//.test(b.type)) return b; } catch (e) { } } return null; }
  /* يجهّز HTML للعرض الآمن: بلا سكربتات، مع <base>، وكشف الصور الكسولة، وإيقاف الحركات */
  function prep(html, url) {
    const d = new DOMParser().parseFromString(html, "text/html");
    d.querySelectorAll("script,iframe,object,embed,link[rel=preload],link[rel=modulepreload],link[rel=prefetch],meta[http-equiv=refresh]").forEach(n => n.remove());
    d.querySelectorAll("[onload],[onclick],[onerror]").forEach(n => ["onload", "onclick", "onerror"].forEach(a => n.removeAttribute(a)));
    d.querySelectorAll("img").forEach(i => { const ds = i.getAttribute("data-src") || i.getAttribute("data-lazy-src") || i.getAttribute("data-original") || i.getAttribute("data-lazy"); if (ds && (!i.getAttribute("src") || /^data:/.test(i.getAttribute("src")))) i.setAttribute("src", ds); const dss = i.getAttribute("data-srcset"); if (dss && !i.getAttribute("srcset")) i.setAttribute("srcset", dss); i.removeAttribute("loading"); });
    d.querySelectorAll("source[data-srcset]").forEach(s => s.setAttribute("srcset", s.getAttribute("data-srcset")));
    d.querySelectorAll("[data-bg],[data-background-image]").forEach(n => { const b = n.getAttribute("data-bg") || n.getAttribute("data-background-image"); if (b && !/gradient/.test(n.style.backgroundImage || "")) n.style.backgroundImage = "url('" + b.replace(/'/g, "%27") + "')"; });
    d.querySelectorAll("base").forEach(b => b.remove()); const base = d.createElement("base"); base.href = url; (d.head || d.documentElement).prepend(base);
    const css = d.createElement("style"); css.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}[data-aos],.aos-init,.aos-animate,.reveal,.wow,.fade-in,.animate__animated,.scroll-reveal,.sr{opacity:1!important;transform:none!important;visibility:visible!important}html{scroll-behavior:auto}";
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
  function cssGrad(bg) {      // linear/radial-gradient(...) ← تدرّج المطوّر {t,a,s:[{c,p,o}]}
    const m = /(repeating-)?(linear|radial)-gradient\((.*)\)\s*$/i.exec(bg || ""); if (!m) return null; const body = m[3], parts = []; let depth = 0, cur = "";
    for (const ch of body) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { parts.push(cur.trim()); cur = ""; } else cur += ch; } parts.push(cur.trim());
    let a = 180, first = parts[0]; if (m[2].toLowerCase() === "linear") { const am = /^(-?[\d.]+)deg$/.exec(first); if (am) { a = Number(am[1]); parts.shift(); } else if (/^to\s/.test(first)) { const to = first.replace(/^to\s+/, ""); a = { "top": 0, "right": 90, "bottom": 180, "left": 270, "top right": 45, "right top": 45, "bottom right": 135, "right bottom": 135, "bottom left": 225, "left bottom": 225, "top left": 315, "left top": 315 }[to] ?? 180; parts.shift(); } }
    let gx = 50, gy = 50, shp = "ellipse"; const isCfg = !/^(rgb|hsl|#|color|oklch|oklab|lab|lch)/i.test(first) && (/\bat\b|^(circle|ellipse|closest|farthest)/.test(first) || /^-?[\d.]+(px|%|em|rem)\s/.test(first)); if (m[2].toLowerCase() === "radial" && isCfg) { if (/circle/.test(first)) shp = "circle"; const at = /at\s+(.+)$/.exec(first); if (at) { const kw = { left: 0, top: 0, center: 50, right: 100, bottom: 100 }, t = at[1].trim().split(/\s+/), cv = (v, i) => /%$/.test(v) ? parseFloat(v) : v in kw ? kw[v] : 50; const a0 = t[0], a1 = t[1] || (a0 === "top" || a0 === "bottom" ? "center" : "center"); if (a0 === "top" || a0 === "bottom") { gy = cv(a0); gx = cv(a1); } else { gx = cv(a0); gy = cv(a1); } } parts.shift(); }
    const stops = parts.map(p => { const mm = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(p), c = col(mm && mm[1] ? mm[1].trim() : ""); return c ? { c: hex(c), o: c.a < 1 ? r2(c.a) : undefined, p: mm[2] != null ? Number(mm[2]) : null } : null; }).filter(Boolean); if (stops.length < 2) return null;
    stops.forEach((s, i) => { if (s.p == null) s.p = Math.round(i / (stops.length - 1) * 100); if (s.o === undefined) delete s.o; });
    return m[2].toLowerCase() === "radial" ? { t: "radial", a: 0, sh: shp, x: gx, y: gy, s: stops } : { t: "linear", a, s: stops };
  }
  function extract(doc, win, W, limit, opt) {
    opt = opt || {}; const out = [], base = doc.baseURI; let z = 0, count = 0, bodyBg = null, stop = false;
    const abs = u => { try { return u ? new URL(u, base).href : ""; } catch (e) { return ""; } };
    const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const geom = (w, r) => { w.set.fx = { d: r2(r.x / W * 100) }; w.set.fy = { d: Math.round(r.y) }; w.set.fwd = { d: r2(r.w / W * 100) }; w.set.fh = { d: Math.max(2, Math.round(r.h)) }; return w; };
    const add = (type, r, props) => { if (out.length > 800) { stop = true; return null; } const w = PB.mkFree(type, 0, 0, ++z); Object.assign(w.set, props || {}); delete w.set.mh; geom(w, r); out.push(w); return w; };
    const clipY = r => r.y + r.h > limit ? { x: r.x, y: r.y, w: r.w, h: Math.max(1, limit - r.y) } : r;
    const radiusOf = (cs, r) => { const v = px(cs.borderTopLeftRadius); return Math.min(v, Math.min(r.w, r.h) / 2); };
    function textBlock(el) { let has = false, bad = false; (function w(n) { for (const c of n.childNodes) { if (bad) return; if (c.nodeType === 3) { if (c.nodeValue.trim()) has = true; } else if (c.nodeType === 1) { const t = c.tagName.toLowerCase(); if (!INL.has(t)) { bad = true; return; } const d = win.getComputedStyle(c).display; if (t !== "br" && t !== "wbr" && !/^inline/.test(d) && d !== "contents") { bad = true; return; } if (win.getComputedStyle(c).position === "absolute") { bad = true; return; } w(c); } } })(el); return has && !bad; }
    function inlineHtml(el, cs) {      // محتوى مضمَّن نظيف: نص + <br> + روابط + عريض/مائل + ألوان مختلفة
      const base0 = { c: cs.color, w: cs.fontWeight, s: cs.fontStyle, f: cs.fontSize };
      function w(n, parent) { let o = "";
        for (const c of n.childNodes) { if (c.nodeType === 3) o += esc(c.nodeValue.replace(/\s+/g, " ")); else if (c.nodeType === 1) { const t = c.tagName.toLowerCase(); if (t === "br") { o += "<br>"; continue; } if (t === "wbr") continue; const s = win.getComputedStyle(c), inner = w(c, s); if (!inner.trim() && !/img/.test(t)) continue; const sty = []; const cl = col(s.color), pc = col(parent.color); if (cl && pc && hex(cl) !== hex(pc)) sty.push("color:" + hex(cl)); if (s.fontWeight !== parent.fontWeight) sty.push("font-weight:" + s.fontWeight); if (s.fontStyle !== parent.fontStyle) sty.push("font-style:" + s.fontStyle); if (s.fontSize !== parent.fontSize) sty.push("font-size:" + s.fontSize); if (s.textDecorationLine !== parent.textDecorationLine && s.textDecorationLine !== "none") sty.push("text-decoration:" + s.textDecorationLine);
          if (t === "a" && c.getAttribute("href") && !/^javascript:/i.test(c.getAttribute("href"))) o += `<a href="${esc(abs(c.getAttribute("href")))}"${sty.length ? ` style="${sty.join(";")}"` : ""}>${inner}</a>`; else o += sty.length ? `<span style="${sty.join(";")}">${inner}</span>` : inner; } }
        return o; }
      return w(el, cs).replace(/^(\s|<br>)+|(\s|<br>)+$/g, "").trim();
    }
    function textProps(cs, lineH) {
      const fs = px(cs.fontSize) || 16, lh = cs.lineHeight === "normal" ? 1.3 : lineH / fs, c = col(cs.color), p = { fs: { d: Math.round(fs * 10) / 10 }, fw: String(cs.fontWeight), lh: { d: r2(Math.max(.8, Math.min(3, lh))) }, ta: { d: /^(left|right|center|justify)$/.test(cs.textAlign) ? cs.textAlign : cs.direction === "rtl" ? "right" : "left" } };
      if (c) p.color = hex(c); if (c && c.a < 1) p.op = r2(Math.max(.05, c.a)); const ff = fontOf(cs); if (ff) p.ff = ff; const ls = px(cs.letterSpacing); if (ls) p.ls = { d: r1(ls) }; if (cs.textTransform && cs.textTransform !== "none") p.tt = cs.textTransform; if (cs.fontStyle === "italic") p.fst = "italic"; if (/underline/.test(cs.textDecorationLine)) p.td = "underline"; else if (/line-through/.test(cs.textDecorationLine)) p.td = "line-through"; if (cs.direction === "rtl") p.tdir = "rtl";
      return p;
    }
    function emitText(el, cs, r, clip, anchor) {
      const rg = doc.createRange(); rg.selectNodeContents(el); const rects = [...rg.getClientRects()].filter(q => q.width > 0.5 && q.height > 0.5); if (!rects.length) return;
      const tops = [...new Set(rects.map(q => Math.round(q.top / 3)))].length, first = rects.reduce((m, q) => q.top < m.top ? q : m, rects[0]), fs = px(cs.fontSize) || 16, lhPx = cs.lineHeight === "normal" ? fs * 1.3 : px(cs.lineHeight) || fs * 1.3;
      const padL = px(cs.paddingLeft) + px(cs.borderLeftWidth), padR = px(cs.paddingRight) + px(cs.borderRightWidth); let bx = r.x + padL, bw = Math.max(rects.reduce((m, q) => Math.max(m, q.right), 0) - rects.reduce((m, q) => Math.min(m, q.left), 1e9), r.w - padL - padR);
      const y = first.top - Math.max(0, (lhPx - first.height) / 2), h = Math.max(lhPx, tops * lhPx), slack = Math.max(4, bw * (tops === 1 ? .08 : .03));
      let rr = { x: Math.max(0, bx - (cs.textAlign === "center" ? slack / 2 : cs.textAlign === "right" || (cs.direction === "rtl" && cs.textAlign !== "left") ? slack : 0)), y, w: Math.min(W, bw + slack), h }; if (rr.y >= limit) return;
      const tag = el.tagName.toLowerCase(), isH = /^h[1-6]$/.test(tag), props = textProps(cs, lhPx), link = anchor && anchor.getAttribute("href") && !/^(javascript:|#$)/i.test(anchor.getAttribute("href")) ? abs(anchor.getAttribute("href")) : "";
      let html = inlineHtml(el, cs); if (!html) return;
      if (cs.display === "list-item" && cs.listStyleType !== "none") { const par = el.parentElement, idx = par ? [...par.children].filter(c => win.getComputedStyle(c).display === "list-item").indexOf(el) + 1 : 1; html = (par && par.tagName === "OL" ? idx + ". " : "• ") + html; }
      if (isH && !/<(a|span|b|i|em|strong)\b/.test(html) && !/<br>/.test(html)) return add("heading", rr, Object.assign(props, { text: el.textContent.replace(/\s+/g, " ").trim(), tag, link: link || undefined }));
      if (link && !/<a\b/.test(html)) html = `<a href="${esc(link)}" style="color:inherit;text-decoration:inherit">${html}</a>`;
      add("text", rr, Object.assign(props, { html: tops === 1 ? '<p style="white-space:nowrap">' + html + "</p>" : "<p>" + html + "</p>" }));
    }
    function boxPaint(el, cs, r, vr, tag) {
      const fill = col(cs.backgroundColor), lay = splitTop(cs.backgroundImage).filter(l => l && l !== "none");
      const bw = ["Top", "Right", "Bottom", "Left"].map(s => px(cs["border" + s + "Width"]) * (cs["border" + s + "Style"] !== "none" && cs["border" + s + "Style"] !== "hidden" ? 1 : 0)), bc = col(cs.borderTopColor), brd = bw[0] >= 1 && bw.every(v => Math.abs(v - bw[0]) < .5) && bc && bc.a > .05 ? { w: bw[0], c: bc } : null;
      const hasFill = fill && fill.a > .03; if (!hasFill && !lay.length && !brd) return;
      if (tag === "html") return; if (tag === "body") { if (hasFill) bodyBg = hex(fill); if (!lay.length) return; }
      if (vr.w < 3 || vr.h < 3) return; const rad = radiusOf(cs, r), mn = Math.min(r.w, r.h), ell = rad >= mn / 2 * .98 && Math.abs(r.w - r.h) < 3, shp = { shape: ell ? "ellipse" : "rect", keep: false, outline: false, rx: ell ? 0 : Math.min(50, r2(rad / (mn || 1) * 100)) };
      if (tag !== "body" && (hasFill || brd)) { const p = Object.assign({}, shp); if (hasFill) { p.fill = hex(fill); if (fill.a < 1) p.op = r2(fill.a); } else { p.fill = ""; p.outline = true; } if (brd) { p.stroke = hex(brd.c); p.sw = Math.max(1, Math.round(brd.w)); } else p.sw = 0; add("shape", clipY(vr), p); }
      lay.slice().reverse().forEach(L => {      // طبقات الخلفية من الأسفل للأعلى
        if (/gradient\(/.test(L)) { const g = cssGrad(L); if (g) add("shape", clipY(vr), Object.assign({}, shp, { fgr: g, fill: "", sw: 0 })); return; }
        const um = /url\((["']?)(.*?)\1\)/.exec(L); if (!um || !um[2] || /^data:image\/(gif|svg)/.test(um[2]) || vr.w < 20 || vr.h < 20) return; const sz = (cs.backgroundSize || "").toLowerCase(), rp = cs.backgroundRepeat || "";
        if (!/^repeat/.test(rp) || /cover|contain/.test(sz) || vr.w > 140) add("image", clipY(vr), { src: abs(um[2]), alt: "", fit: /contain/.test(sz) ? "contain" : "cover", rad: rad ? { d: Math.round(rad) } : undefined }); });
    }
    function svgData(el, cs) {
      try { const c = el.cloneNode(true), r = rectOf(el); c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); if (!c.getAttribute("width")) c.setAttribute("width", r.w); if (!c.getAttribute("height")) c.setAttribute("height", r.h); if (!c.getAttribute("viewBox") && px(c.getAttribute("width")) && px(c.getAttribute("height"))) c.setAttribute("viewBox", "0 0 " + px(c.getAttribute("width")) + " " + px(c.getAttribute("height")));
        c.querySelectorAll("script,foreignObject").forEach(n => n.remove()); c.querySelectorAll("use").forEach(u => { const id = (u.getAttribute("href") || u.getAttribute("xlink:href") || "").replace(/^#/, ""); const ref = id && doc.getElementById(id); if (ref) { let dd = c.querySelector("defs"); if (!dd) { dd = doc.createElementNS("http://www.w3.org/2000/svg", "defs"); c.prepend(dd); } if (!dd.querySelector("#" + CSS.escape(id))) dd.appendChild(ref.cloneNode(true)); } });
        const cl = col(cs.color); let s = new XMLSerializer().serializeToString(c).replace(/currentColor/gi, cl ? hex(cl) : "#000"); if (s.length > 90000) return ""; return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); } catch (e) { return ""; }
    }
    function visit(el, clip, anchor) {
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
          const gr = cssGrad(cs.backgroundImage); if (gr) p.bgr = gr; if (bwid >= 1 && bc && bc.a > .05 && cs.borderTopStyle !== "none") { p.bw = Math.round(bwid); p.bc = hex(bc); p.bs = cs.borderTopStyle; } const ff = fontOf(cs); if (ff) p.ff = ff; if (cs.textTransform !== "none") p.tt = cs.textTransform;
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
      const ownClip = tag === "html" || tag === "body" ? clip : (cs.overflowX !== "visible" || cs.overflowY !== "visible") ? (inter(r, clip) || { x: 0, y: 0, w: 0, h: 0 }) : clip;
      if (ownClip.w <= 0 || ownClip.h <= 0) return;
      for (const c of el.childNodes) { if (c.nodeType === 1) visit(c, ownClip, a); else if (c.nodeType === 3 && c.nodeValue.trim() && !hidden && !contents) { const rg = doc.createRange(); rg.selectNodeContents(c); const rc = [...rg.getClientRects()]; if (!rc.length || rc[0].top >= limit) continue; const wrap = doc.createElement("span"); wrap.textContent = c.nodeValue; const tops = [...new Set(rc.map(q => Math.round(q.top / 3)))].length, f = rc.reduce((m, q) => q.top < m.top ? q : m, rc[0]), fs = px(cs.fontSize) || 16, lhPx = cs.lineHeight === "normal" ? fs * 1.3 : px(cs.lineHeight) || fs * 1.3, x0 = Math.min(...rc.map(q => q.left)), x1 = Math.max(...rc.map(q => q.right)), props = textProps(cs, lhPx);
          add("text", { x: Math.max(0, x0 - 1), y: f.top - Math.max(0, (lhPx - f.height) / 2), w: Math.min(W, x1 - x0 + Math.max(6, (x1 - x0) * .03)), h: tops * lhPx }, Object.assign(props, { html: "<p>" + esc(c.nodeValue.replace(/\s+/g, " ").trim()) + "</p>" })); } }
    }
    visit(doc.documentElement, { x: 0, y: 0, w: W, h: limit }, null);
    return { widgets: out, bg: bodyBg, truncated: stop || count > 5000 };
  }

  /* ───────── بناء الصفحة وفتحها في المحرّر ───────── */
  function buildPage(widgets, title, bg, W, limit) {
    const sec = PB.mkCanvas(); Object.assign(sec.set, { layout: "full", scaled: true, dw: W, mh: { d: Math.round(limit) }, pad: { d: [0, 0, 0, 0] } }); sec.free = widgets;
    const page = PB.newPage(title || "قالب منسوخ", ""); page.header = false; page.footer = false; if (bg) page.bg = bg; page.sections = [sec]; return page;
  }
  async function openInEditor(page) {
    const E = A().E; if (E && E.page && E.dirty && !confirm("سيُفتح القالب المنسوخ في صفحة جديدة، وتُحفظ مسودة صفحتك الحالية تلقائياً. هل تريد المتابعة؟")) return false;
    try { A().saveDraftNow(); } catch (e) { } close(); A().open(page, "", true); return true;
  }
  async function saveImages(widgets, doSave) {      // يحفظ الصور في موقعك (يتفادى الروابط الخارجية التي قد تتعطّل) بأقصى 40 صورة
    const imgs = widgets.filter(w => w.type === "image" && /^https?:/.test(w.set.src) && !/\.(gif|svg)(\?|$)/i.test(w.set.src)).slice(0, 40); if (!doSave || !imgs.length) return 0;
    let done = 0, i = 0; const cache = new Map();
    async function work() { while (i < imgs.length) { const w = imgs[i++], u = w.set.src; st("حفظ الصور في موقعك… " + (done + 1) + "/" + imgs.length); try { if (!cache.has(u)) cache.set(u, (async () => { const b = await fetchBlob(u); return b ? await A().uploadBlob(b, "clone", { max: 1920 }) : null; })()); const p = await cache.get(u); if (p) w.set.src = p; } catch (e) { } done++; } }
    await Promise.all([work(), work(), work()]); return done;
  }
  async function doCopyUrl() {
    const f = S.frame; if (!f || !f.contentDocument) return; const doc = f.contentDocument, win = f.contentWindow;
    st("تحليل الصفحة…"); await sleep(30); const res = extract(doc, win, S.W, Math.round(S.limit)); if (!res.widgets.length) throw new Error("لم يُعثر على محتوى قابل للنسخ في هذه المنطقة");
    await saveImages(res.widgets, $("cl-save") && $("cl-save").checked);
    const title = (doc.title || "").trim() || (S.url ? new URL(S.url).hostname : "قالب منسوخ");
    const page = buildPage(res.widgets, title, res.bg, S.W, S.limit); const ok = await openInEditor(page); if (ok) toast("تم النسخ: " + res.widgets.length + " عنصراً قابلاً للتعديل" + (res.truncated ? " (اقتُصر على أول العناصر لكثرتها)" : ""));
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
  async function doCopyImage() {
    const im = S.img; if (!im) return; const dw = im.dw, k = im.k, H = Math.round(S.limit), srcH = Math.max(8, Math.round(H / k));
    const cv = document.createElement("canvas"); cv.width = dw; cv.height = H; const ctx = cv.getContext("2d", { willReadFrequently: true }); ctx.drawImage(im.el, 0, 0, im.el.naturalWidth, Math.min(im.el.naturalHeight, srcH), 0, 0, dw, H);
    const widgets = []; let z = 1; const ocr = $("cl-ocr") && $("cl-ocr").checked, lang = ($("cl-lang") && $("cl-lang").value) || "ara+eng"; let blocks = [], note = "";
    if (ocr) { try { const T = await loadTess(); st("جارٍ التعرّف على النصوص… (أول مرة تحمّل اللغات وقد تستغرق دقيقة)"); const { data } = await T.recognize(cv, lang, { logger: m => { if (m && m.status && m.progress != null) st("التعرّف على النصوص: " + Math.round(m.progress * 100) + "% — " + m.status); } });
        const raw = data.lines || (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || [])); const lines = raw.filter(l => l.text && l.text.replace(/\s+/g, "").length >= 2 && (l.confidence == null || l.confidence >= 45) && /[\p{L}\p{N}]/u.test(l.text)).map(l => ({ x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1, text: l.text.replace(/\s+/g, " ").trim() }));
        blocks = groupLines(lines); } catch (e) { note = " (تعذّر التعرّف على النصوص: " + e.message + " — نُسخت الصورة فقط)"; } }
    const id = ctx.getImageData(0, 0, dw, H), data = id.data, texts = [];
    for (const b of blocks) { const ls = b.lines, lhs = ls.map(l => l.y1 - l.y0), fsEst = Math.max(8, Math.round(median(lhs) * .8)), pitch = ls.length > 1 ? (ls[ls.length - 1].y0 - ls[0].y0) / (ls.length - 1) : fsEst * 1.35, bgc = ringBg(data, dw, H, { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }), ink = inkColor(data, dw, bgc, { x0: Math.max(0, b.x0), y0: Math.max(0, b.y0), x1: Math.min(dw - 1, b.x1), y1: Math.min(H - 1, b.y1) });
      texts.push({ b, fsEst, pitch, ink: ink || (lum(bgc[0], bgc[1], bgc[2]) > 140 ? [20, 20, 20] : [245, 245, 245]) }); }
    for (const t of texts) for (const l of t.b.lines) wipe(ctx, data, dw, H, { x0: Math.max(0, l.x0), y0: Math.max(0, l.y0), x1: Math.min(dw - 1, l.x1), y1: Math.min(H - 1, l.y1) });
    st("حفظ الصورة الخلفية…"); const blob = await new Promise(r => cv.toBlob(r, "image/webp", .92)); let src = ""; try { src = await A().uploadBlob(blob, "clone-bg", { max: 2000 }); } catch (e) { src = cv.toDataURL("image/jpeg", .85); }
    const mk = (type, x, y, w, h, p) => { const w0 = PB.mkFree(type, 0, 0, ++z); Object.assign(w0.set, p); delete w0.set.mh; w0.set.fx = { d: r2(x / dw * 100) }; w0.set.fy = { d: Math.round(y) }; w0.set.fwd = { d: r2(w / dw * 100) }; w0.set.fh = { d: Math.max(2, Math.round(h)) }; widgets.push(w0); return w0; };
    mk("image", 0, 0, dw, H, { src, alt: "", fit: "fill" });
    for (const t of texts) { const b = t.b, ar = AR.test(b.lines.map(l => l.text).join(" ")), single = b.lines.length === 1, w0 = b.x1 - b.x0, slack = Math.max(8, w0 * .08), cx = b.lines.map(l => (l.x0 + l.x1) / 2), cspread = Math.max(...cx) - Math.min(...cx), l0 = b.lines.map(l => l.x0), lsp = Math.max(...l0) - Math.min(...l0), r0 = b.lines.map(l => l.x1), rsp = Math.max(...r0) - Math.min(...r0);
      let ta = ar ? "right" : "left"; if (!single) { const lh = t.fsEst; ta = cspread < lh * .6 && lsp > lh * .8 ? "center" : (ar ? (rsp <= lsp ? "right" : "left") : (lsp <= rsp ? "left" : "right")); }
      const x = ta === "center" ? b.x0 - slack / 2 : ta === "right" ? b.x0 - slack : b.x0, html = "<p>" + b.lines.map(l => esc(l.text)).join("<br>") + "</p>";
      mk("text", Math.max(0, x), b.y0 - Math.max(0, (t.pitch - (b.lines[0].y1 - b.lines[0].y0)) / 2), Math.min(dw, w0 + slack), t.pitch * b.lines.length, { html, fs: { d: t.fsEst }, lh: { d: r2(Math.max(1, Math.min(2.2, t.pitch / t.fsEst))) }, fw: t.fsEst >= 26 ? "700" : "400", color: "#" + t.ink.map(v => v.toString(16).padStart(2, "0")).join(""), ta: { d: ta }, tdir: ar ? "rtl" : undefined }); }
    const bgc = (() => { const g = id.data; return "#" + [0, 1, 2].map(kk => g[kk].toString(16).padStart(2, "0")).join(""); })();
    const page = buildPage(widgets, "قالب من صورة", bgc, dw, H); const ok = await openInEditor(page); if (ok) toast("تم النسخ: صورة خلفية + " + texts.length + " نصاً قابلاً للتعديل" + note);
  }

  /* ───────── الواجهة ───────── */
  function css() {
    if ($("cl-css")) return; const s = document.createElement("style"); s.id = "cl-css";
    s.textContent = `#pbx-clone{position:fixed;inset:0;background:rgba(10,20,17,.62);z-index:10020;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:inherit}
#pbx-clone .cl-box{background:#fff;border-radius:18px;width:min(1180px,96vw);max-height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45)}
#pbx-clone .cl-h{display:flex;align-items:center;gap:.6rem;padding:.8rem 1rem;border-bottom:1px solid #eee;background:#173f35;color:#fff}#pbx-clone .cl-h b{font-size:1rem;display:flex;align-items:center;gap:.4rem}#pbx-clone .cl-h small{opacity:.75;flex:1;font-weight:600}#pbx-clone .cl-h button{border:0;background:rgba(255,255,255,.15);color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer}
#pbx-clone .cl-tabs{display:flex;gap:.3rem;padding:.6rem 1rem 0}#pbx-clone .cl-tabs button{border:1.5px solid #e0d9c8;background:#fff;border-radius:10px 10px 0 0;padding:.45rem 1rem;cursor:pointer;font-family:inherit;font-weight:800;font-size:.85rem;color:#173f35}#pbx-clone .cl-tabs button.on{background:#173f35;color:#fff;border-color:#173f35}
#pbx-clone .cl-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;padding:.7rem 1rem;border-bottom:1px solid #eee;background:#faf6ec}#pbx-clone .cl-ctl input[type=text],#pbx-clone .cl-ctl input[type=url]{flex:1 1 280px;min-width:180px;border:1.5px solid #d9d2c2;border-radius:10px;padding:.5rem .7rem;font-family:inherit;direction:ltr;text-align:left}#pbx-clone .cl-ctl select{border:1.5px solid #d9d2c2;border-radius:10px;padding:.45rem;font-family:inherit}#pbx-clone .cl-ctl label{display:flex;align-items:center;gap:.3rem;font-size:.8rem;font-weight:700;color:#173f35}#pbx-clone .cl-ctl button,#pbx-clone .cl-f button{border:1.5px solid #173f35;background:#fff;color:#173f35;border-radius:10px;padding:.5rem 1rem;cursor:pointer;font-family:inherit;font-weight:800}#pbx-clone .cl-ctl button.pri,#pbx-clone .cl-f .cl-go{background:linear-gradient(135deg,#173f35,#0d9488);color:#fff;border-color:transparent}#pbx-clone .cl-f .cl-go:disabled{opacity:.45;cursor:not-allowed}
#pbx-clone .cl-stage{flex:1;overflow:auto;background:#d8d2c4;padding:14px;min-height:260px;position:relative}#pbx-clone .cl-empty{color:#6b6556;text-align:center;padding:3rem 1rem;line-height:2;font-weight:700}
#pbx-clone .cl-win{position:relative;margin:0 auto;overflow:hidden;background:#fff;box-shadow:0 6px 30px rgba(0,0,0,.35);direction:ltr}#pbx-clone .cl-in{position:absolute;left:0;top:0;transform-origin:0 0}#pbx-clone .cl-in iframe,#pbx-clone .cl-in img{display:block;border:0;background:#fff}
#pbx-clone .cl-lim{position:absolute;left:0;right:0;bottom:0;height:22px;cursor:ns-resize;touch-action:none;background:linear-gradient(to top,rgba(124,58,237,.35),rgba(124,58,237,0));border-bottom:3px solid #7c3aed;display:flex;align-items:flex-end;justify-content:center}#pbx-clone .cl-lim span{background:#7c3aed;color:#fff;font:800 .72rem system-ui,sans-serif;padding:.1rem .7rem;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:.4rem}
#pbx-clone .cl-f{display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;border-top:1px solid #eee}#pbx-clone .cl-f #cl-st{flex:1;font-size:.8rem;color:#6b6556;font-weight:700}#pbx-clone .cl-note{padding:.4rem 1rem;font-size:.72rem;color:#8a8268;background:#fffbea;border-bottom:1px solid #f1e6b8}`;
    document.head.appendChild(s);
  }
  const ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>';
  function close() { const m = $("pbx-clone"); if (m) m.remove(); S.frame = null; S.img = null; }
  function open() {
    css(); if ($("pbx-clone")) return; S.tab = "url"; S.frame = null; S.img = null; S.url = ""; const m = document.createElement("div"); m.id = "pbx-clone";
    m.innerHTML = `<div class="cl-box"><div class="cl-h"><b>${ICON} نسخ قالب</b><small>افتح موقعاً برابطه أو صورة، حدّد الحد السفلي بسحب الحافة، ثم «انسخ»: يتحوّل المحتوى إلى عناصر قابلة للتعديل</small><button type="button" data-cl="x" title="إغلاق">✕</button></div>
<div class="cl-tabs"><button type="button" class="on" data-cltab="url">رابط موقع</button><button type="button" data-cltab="img">صورة (لقطة شاشة)</button></div>
<div class="cl-ctl" data-pane="url"><input type="text" id="cl-url" placeholder="https://example.com" spellcheck="false"><button type="button" class="pri" data-cl="load">فتح</button><label>عرض الصفحة <select id="cl-w"><option value="1440">1440</option><option value="1280" selected>1280</option><option value="1024">1024</option></select></label><label><input type="checkbox" id="cl-save" checked> حفظ الصور في موقعي (موصى به)</label></div>
<div class="cl-ctl" data-pane="img" hidden><button type="button" class="pri" data-cl="pick">اختر صورة</button><span style="font-size:.78rem;color:#6b6556">أو اسحبها إلى النافذة أو الصقها (Ctrl+V)</span><label><input type="checkbox" id="cl-ocr" checked> تحويل النصوص إلى نص قابل للتعديل (OCR)</label><label>اللغة <select id="cl-lang"><option value="ara+eng">عربي + إنجليزي</option><option value="eng">إنجليزي</option><option value="fra+eng">فرنسي + إنجليزي</option><option value="ara+fra+eng">عربي + فرنسي + إنجليزي</option></select></label></div>
<div class="cl-note">انسخ فقط ما لك حقّ استعماله: النصوص والصور والشعارات تعود لأصحابها. لا تُنفَّذ أي سكربتات من الموقع، والصفحات التي تُبنى بالجافاسكربت قد تظهر ناقصة (استعمل لقطة شاشة).</div>
<div class="cl-stage" id="cl-stage"><div class="cl-empty">اكتب رابط الموقع ثم اضغط «فتح»<br>وبعد ظهور الصفحة اسحب الحافة البنفسجية السفلية لتحديد آخر نقطة تُنسخ.</div></div>
<div class="cl-f"><span id="cl-st"></span><button type="button" class="cl-go" data-cl="copy" disabled>انسخ</button><button type="button" data-cl="x">إلغاء</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => { const b = e.target.closest("[data-cl],[data-cltab]"); if (!b) { if (e.target === m) close(); return; }
      if (b.dataset.cltab) { S.tab = b.dataset.cltab; m.querySelectorAll("[data-cltab]").forEach(x => x.classList.toggle("on", x === b)); m.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== S.tab); resetStage(); return; }
      const a = b.dataset.cl; if (a === "x") close(); else if (a === "load") loadUrl(); else if (a === "pick") pickImg(); else if (a === "copy") run(); });
    $("cl-url").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); loadUrl(); } });
    $("cl-w").addEventListener("change", () => { S.W = Number($("cl-w").value) || 1280; if (S.frame) mountFrame(S.html); });
    m.addEventListener("dragover", e => { if (S.tab === "img" && e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files")) e.preventDefault(); });
    m.addEventListener("drop", e => { if (S.tab !== "img") return; const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); loadImg(f); } });
    m.addEventListener("paste", e => { if (S.tab !== "img") return; const it = [...(e.clipboardData && e.clipboardData.items || [])].find(x => /^image\//.test(x.type)); if (it) loadImg(it.getAsFile()); });
    document.addEventListener("paste", pasteDoc); setTimeout(() => $("cl-url") && $("cl-url").focus(), 50);
  }
  function pasteDoc(e) { if (!$("pbx-clone")) { document.removeEventListener("paste", pasteDoc); return; } if (S.tab !== "img") return; const it = [...(e.clipboardData && e.clipboardData.items || [])].find(x => /^image\//.test(x.type)); if (it) { e.preventDefault(); loadImg(it.getAsFile()); } }
  function resetStage() { const stg = $("cl-stage"); if (!stg) return; S.frame = null; S.img = null; stg.innerHTML = `<div class="cl-empty">${S.tab === "url" ? "اكتب رابط الموقع ثم اضغط «فتح»<br>وبعد ظهور الصفحة اسحب الحافة البنفسجية السفلية لتحديد آخر نقطة تُنسخ." : "اختر لقطة شاشة للصفحة (أو اسحبها/الصقها)<br>ثم اسحب الحافة البنفسجية السفلية لتحديد آخر نقطة تُنسخ."}</div>`; const g = document.querySelector("#pbx-clone .cl-go"); if (g) g.disabled = true; st(""); }
  /* نافذة المعاينة: عرضها مصغَّر ليلائم، وحافتها السفلية تُسحب فيتغيّر الحد السفلي للنسخ */
  function mountWin(innerEl, W, docH, limit, wait) {
    const stg = $("cl-stage"); stg.innerHTML = ""; const avail = Math.max(300, stg.clientWidth - 28), k = Math.min(1, avail / W); S.k = k; S.docH = docH; S.limit = Math.max(120, Math.min(limit, docH));
    const win = document.createElement("div"); win.className = "cl-win"; win.style.width = Math.round(W * k) + "px"; const inn = document.createElement("div"); inn.className = "cl-in"; inn.style.cssText = `width:${W}px;transform:scale(${k})`; inn.appendChild(innerEl); win.appendChild(inn);
    const lim = document.createElement("div"); lim.className = "cl-lim"; lim.innerHTML = `<span id="cl-lt"></span>`; win.appendChild(lim); stg.appendChild(win);
    const set = v => { S.limit = Math.max(120, Math.min(S.docH, Math.round(v))); win.style.height = Math.round(S.limit * k) + "px"; $("cl-lt").textContent = "الحد السفلي: " + S.limit + "px — اسحب لتكبير/تصغير النافذة"; }; set(S.limit);
    lim.addEventListener("pointerdown", e => { e.preventDefault(); lim.setPointerCapture(e.pointerId); const top = win.getBoundingClientRect().top; const mv = ev => set((ev.clientY - top + 11) / k), up = () => { lim.removeEventListener("pointermove", mv); lim.removeEventListener("pointerup", up); }; lim.addEventListener("pointermove", mv); lim.addEventListener("pointerup", up); });
    const g = document.querySelector("#pbx-clone .cl-go"); if (g) g.disabled = !!wait; S.setLimit = set;
  }
  function mountFrame(html) {
    const W = S.W, f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-same-origin"); f.setAttribute("scrolling", "no"); f.style.cssText = `width:${W}px;height:900px`; S.frame = f;
    mountWin(f, W, 900, 900, true); st("جارٍ عرض الصفحة…");
    f.onload = async () => { st("تحميل الصور والخطوط…"); const d = f.contentDocument; if (!d) return; try { await Promise.race([Promise.all([...d.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))), sleep(5000)]); await Promise.race([d.fonts ? d.fonts.ready : Promise.resolve(), sleep(2500)]); } catch (e) { }
      const h = Math.min(16000, Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0, 300)); f.style.height = h + "px"; await sleep(80); const h2 = Math.min(16000, Math.max(d.documentElement.scrollHeight, h)); f.style.height = h2 + "px";
      S.docH = h2; if (S.setLimit) S.setLimit(Math.min(h2, 1800)); const g = document.querySelector("#pbx-clone .cl-go"); if (g) g.disabled = false; st("جاهز — حجم الصفحة " + h2 + "px. اسحب الحافة البنفسجية لتحديد الحد السفلي ثم «انسخ»."); };
    f.srcdoc = html;
  }
  async function loadUrl() {
    if (S.busy) return; let u = ($("cl-url").value || "").trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { new URL(u); } catch (e) { toast("الرابط غير صحيح"); return; }
    S.busy = true; S.url = u; S.W = Number($("cl-w").value) || 1280; S.limit = 0; S.docH = 0;
    try { const html = await fetchHtml(u); S.html = prep(html, u); mountFrame(S.html); } catch (e) { st(e.message); toast(e.message); } finally { S.busy = false; }
  }
  function pickImg() { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => { if (i.files[0]) loadImg(i.files[0]); }; i.click(); }
  function loadImg(file) {
    const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { const dw = Math.min(1600, im.naturalWidth), k = dw / im.naturalWidth, H = Math.round(im.naturalHeight * k); im.style.cssText = `width:${dw}px;height:${H}px`; S.img = { el: im, dw, k, H, file }; S.W = dw; mountWin(im, dw, H, Math.min(H, 1800)); st("جاهز — الصورة " + im.naturalWidth + "×" + im.naturalHeight + ". اسحب الحافة البنفسجية لتحديد الحد السفلي ثم «انسخ»."); };
    im.onerror = () => toast("تعذّر قراءة الصورة"); im.src = url;
  }
  async function run() {
    if (S.busy) return; const g = document.querySelector("#pbx-clone .cl-go"); S.busy = true; if (g) g.disabled = true;
    try { if (S.tab === "url") await doCopyUrl(); else await doCopyImage(); } catch (e) { st(e.message); toast("تعذّر النسخ: " + e.message); if (g) g.disabled = false; console.warn(e); } finally { S.busy = false; }
  }
  return { open, close, _t: { extract, prep, buildPage, groupLines, cssGrad, col, wipe, ringBg, inkColor, S } };
})();
