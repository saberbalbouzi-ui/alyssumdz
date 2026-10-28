/* «إصلاح أخطاء السرعة تلقائياً»: يحوّل ما تكشفه أداة «سرعة الموقع» إلى تعديلات فعلية على كود الصفحة.
   نقيّ (بلا DOM ولا شبكة) فيعمل في المتصفح وفي اختبارات Node؛ ما يحتاج شبكة (قياس الصور، تحويلها، ملفات CSS) تجهّزه الواجهة وتمرّره في ctx.
   كل مصلِّح idempotent: تطبيقه مرتين لا يغيّر شيئاً في المرة الثانية. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.SpeedFix = api;
})(typeof self !== "undefined" ? self : this, function () {
  /* ───────── أدوات نصية: كل المسح على نسخة مقنَّعة بالطول نفسه فتتطابق المواضع مع الأصل ───────── */
  const blank = m => m.replace(/[^\n]/g, " ");
  const maskCS = h => h.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<noscript\b[\s\S]*?<\/noscript>|<template\b[\s\S]*?<\/template>/gi, blank);
  const maskC = h => h.replace(/<!--[\s\S]*?-->|<noscript\b[\s\S]*?<\/noscript>|<template\b[\s\S]*?<\/template>/gi, blank);
  function edit(h, rx, fn, mk) {
    const m = (mk || maskCS)(h); let out = "", last = 0, n = 0, x; rx.lastIndex = 0;
    while ((x = rx.exec(m))) {
      const orig = h.slice(x.index, x.index + x[0].length), r = fn(orig, x);
      if (r != null && r !== orig) { out += h.slice(last, x.index) + r; last = x.index + x[0].length; n++; }
      if (!x[0].length) rx.lastIndex++;
    }
    return { html: out + h.slice(last), n };
  }
  const body = t => t.replace(/^<[a-z0-9]+/i, " ");
  const hasA = (t, n) => new RegExp("[\\s\"']" + n + "(?=[\\s=/>])", "i").test(body(t));
  const getA = (t, n) => { const m = new RegExp("[\\s\"']" + n + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(body(t)); return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : null; };
  const q = v => String(v).replace(/"/g, "&quot;");
  const setA = (t, n, v) => hasA(t, n)
    ? t.replace(new RegExp("([\\s\"'])" + n + "\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s>]+)", "i"), (m, p) => p + n + '="' + q(v) + '"')
    : t.replace(/\s*\/?>$/, m => " " + n + '="' + q(v) + '"' + m);
  const delA = (t, n) => t.replace(new RegExp("\\s+" + n + "(?:\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s>]+))?(?=[\\s/>])", "i"), "");
  const plain = s => s.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#160);/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  const base = u => String(u || "").split(/[?#]/)[0].split("/").pop().toLowerCase();
  const insertHead = (h, s) => { const m = /<head\b[^>]*>/i.exec(maskC(h)); return m ? h.slice(0, m.index + m[0].length) + "\n" + s + h.slice(m.index + m[0].length) : h; };
  const pageOrigin = lhr => { try { return new URL(lhr.finalDisplayedUrl || lhr.finalUrl || lhr.requestedUrl).origin; } catch (e) { return ""; } };
  const A = lhr => (lhr && lhr.audits) || {};
  const walk = (o, fn, d) => { d = d || 0; if (!o || typeof o !== "object" || d > 7) return; fn(o); (Array.isArray(o) ? o : Object.values(o)).forEach(v => walk(v, fn, d + 1)); };

  /* ───────── 1) أسماء الأزرار والروابط (إمكانية الوصول) ───────── */
  const TOK = [
    ["close|dismiss|cancel|x", "إغلاق"], ["send|submit", "إرسال"], ["menu|burger|hamburger|drawer", "القائمة"], ["cart|basket|bag", "السلة"], ["search", "بحث"],
    ["prev|previous|back", "السابق"], ["next|forward", "التالي"], ["share", "مشاركة"], ["play", "تشغيل"], ["pause", "إيقاف مؤقت"], ["mute|volume|sound", "الصوت"],
    ["whatsapp|wa", "واتساب"], ["top", "العودة للأعلى"], ["minus|decrease|dec", "تقليل"], ["plus|increase|inc", "زيادة"], ["mic|microphone", "الميكروفون"], ["zoom", "تكبير"], ["favorite|wishlist|heart", "المفضلة"], ["account|user|login", "حسابي"],
  ].map(([r, l]) => [new RegExp("^(?:" + r + ")$", "i"), l]);
  const GLY = [[/[✕✖×✗]/, "إغلاق"], [/[☰≡]/, "القائمة"], [/[‹◀❮←]/, "السابق"], [/[›▶❯→]/, "التالي"], [/[➤➜►]/, "إرسال"], [/^\s*\+\s*$/, "زيادة"], [/^\s*[−–-]\s*$/, "تقليل"]];
  function btnLabel(t, txt) {
    const toks = ((getA(t, "id") || "") + " " + (getA(t, "class") || "") + " " + (getA(t, "data-action") || "") + " " + (getA(t, "data-role") || "")).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const w of toks) for (const [rx, l] of TOK) if (rx.test(w)) return l;
    for (const [rx, l] of GLY) if (rx.test(txt)) return l;
    return "";
  }
  const HOSTS = [[/wa\.me|whatsapp/i, "واتساب"], [/^tel:/i, "اتصال هاتفي"], [/^mailto:/i, "بريد إلكتروني"], [/instagram\./i, "إنستغرام"], [/facebook\.|fb\.com|fb\.me/i, "فيسبوك"], [/tiktok\./i, "تيك توك"], [/youtu/i, "يوتيوب"], [/twitter\.|(^|\/\/)x\.com/i, "X (تويتر)"], [/snapchat\./i, "سناب شات"], [/t\.me|telegram/i, "تيليغرام"], [/linkedin\./i, "لينكدإن"], [/m\.me|messenger/i, "ماسنجر"], [/maps\.|goo\.gl\/maps/i, "الخريطة"], [/pinterest\./i, "بنتريست"]];
  const named = (t, inner) => hasA(t, "aria-label") || hasA(t, "aria-labelledby") || hasA(t, "title") || /<img\b[^>]*\balt\s*=\s*["'][^"']+["']/i.test(inner) || /<title>[^<]+<\/title>/i.test(inner) || /[\p{L}\p{N}]/u.test(plain(inner).replace(/^[xX]$/, ""));
  function a11y(h) {
    let n = 0; const manual = [];
    let r = edit(h, /<button\b[^>]*>[\s\S]*?<\/button>/gi, t => {
      const open = /^<button\b[^>]*>/i.exec(t)[0], inner = t.slice(open.length, t.length - 9); if (named(open, inner)) return null;
      const l = btnLabel(open, plain(inner)); if (!l) { manual.push("زر بلا اسم: " + (getA(open, "id") || getA(open, "class") || plain(inner) || "؟")); return null; }
      let o2 = setA(open, "aria-label", l); if (!hasA(o2, "type")) o2 = setA(o2, "type", "button"); n++; return o2 + inner + "</button>";
    });
    let out = r.html;
    r = edit(out, /<a\b[^>]*>[\s\S]*?<\/a>/gi, t => {
      const open = /^<a\b[^>]*>/i.exec(t)[0], inner = t.slice(open.length, t.length - 4); if (!hasA(open, "href") || named(open, inner)) return null;
      const href = getA(open, "href") || "", hit = HOSTS.find(x => x[0].test(href)); if (!hit) { manual.push("رابط بلا اسم: " + href.slice(0, 60)); return null; }
      n++; return setA(open, "aria-label", hit[1]) + inner + "</a>";
    });
    return { html: r.html, n: n, manual };
  }

  /* ───────── 2) النص البديل للصور ───────── */
  function alt(h) {
    let n = 0; const manual = [];
    let r = edit(h, /<a\b[^>]*>[\s\S]*?<\/a>/gi, t => {         // صورة داخل رابط له نص ← زخرفية
      const open = /^<a\b[^>]*>/i.exec(t)[0], inner = t.slice(open.length, t.length - 4); if (!/[\p{L}\p{N}]/u.test(plain(inner.replace(/<img\b[^>]*>/gi, " ")))) return null;
      const x = edit(inner, /<img\b[^>]*>/gi, i => { if (hasA(i, "alt")) return null; return setA(i, "alt", ""); }, maskC); if (!x.n) return null; n += x.n; return open + x.html + "</a>";
    });
    r = edit(r.html, /<img\b[^>]*>/gi, t => {
      if (hasA(t, "alt")) return null; const ti = getA(t, "title"); if (ti) { n++; return setA(t, "alt", ti); }
      manual.push("صورة بلا وصف: " + base(getA(t, "src") || getA(t, "data-src") || "")); return null;
    });
    return { html: r.html, n: n, manual };
  }

  /* ───────── 3) تحميل كسول للصور خارج الشاشة الأولى + 4) نسبة أبعاد ثابتة (يمنع قفز التخطيط) ───────── */
  function lcpBase(lhr) { let s = ""; const a = A(lhr)["largest-contentful-paint-element"]; walk(a && a.details, o => { if (!s && o.node && o.node.snippet) s = o.node.snippet; }); const m = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)/i.exec(s); return m ? base(m[1]) : ""; }
  function lazy(h, lhr) {
    const keep = lcpBase(lhr); let i = 0;
    return edit(h, /<img\b[^>]*>/gi, t => {
      i++; if (i <= 2 || hasA(t, "loading") || hasA(t, "fetchpriority") || hasA(t, "data-src") || hasA(t, "data-lazy") || /\blazy|swiper-lazy|skip-lazy/i.test(getA(t, "class") || "")) return null;
      if (keep && base(getA(t, "src")) === keep) return null; if (!getA(t, "src")) return null;
      return setA(setA(t, "loading", "lazy"), "decoding", "async");
    });
  }
  function ratio(h, lhr, ctx) {
    const dims = (ctx && ctx.dims) || {}, need = [];
    const r = edit(h, /<img\b[^>]*>/gi, t => {
      if ((hasA(t, "width") && hasA(t, "height")) || /aspect-ratio/i.test(getA(t, "style") || "")) return null;
      const s = getA(t, "src"); if (!s || /^data:/i.test(s)) return null; const d = dims[s]; if (!d) { need.push(s); return null; }
      const st = getA(t, "style"); return setA(t, "style", (st ? st.replace(/;?\s*$/, ";") : "") + "aspect-ratio:" + d.w + "/" + d.h);
    });
    r.need = need; return r;
  }

  /* ───────── 5) عنصر LCP: أولوية عالية + تحميل مسبق ───────── */
  function lcp(h, lhr) {
    const keep = lcpBase(lhr); if (!keep) return { html: h, n: 0 }; let n = 0, href = "";
    const r = edit(h, /<img\b[^>]*>/gi, t => {
      if (base(getA(t, "src")) !== keep) return null; href = getA(t, "src"); let o = t;
      if (/lazy/i.test(getA(o, "loading") || "")) o = delA(o, "loading"); if (!hasA(o, "fetchpriority")) o = setA(o, "fetchpriority", "high"); if (!hasA(o, "decoding")) o = setA(o, "decoding", "async"); return o;
    });
    let out = r.html; n = r.n;
    if (href && !new RegExp("<link\\b[^>]*rel=[\"']?preload[\"']?[^>]*" + keep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(maskC(out))) { out = insertHead(out, '<link rel="preload" as="image" href="' + q(href) + '" fetchpriority="high">'); n++; }
    return { html: out, n: n };
  }

  /* ───────── 6) وسوم أساسية: lang / viewport / description ───────── */
  function meta(h, lhr, ctx) {
    let out = h, n = 0; const manual = [], M = maskC(h);
    const ht = /<html\b[^>]*>/i.exec(M); if (ht && !hasA(ht[0], "lang")) { out = out.slice(0, ht.index) + setA(ht[0], "lang", (ctx && ctx.lang) || "ar") + out.slice(ht.index + ht[0].length); n++; }
    if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(M)) { out = insertHead(out, '<meta name="viewport" content="width=device-width, initial-scale=1">'); n++; }
    if (!/<title\b[^>]*>\s*[^<\s][^<]*<\/title>/i.test(M)) manual.push("العنوان <title> مفقود أو فارغ");
    if (!/<meta\b[^>]*name\s*=\s*["']description["']/i.test(M)) {
      const og = /<meta\b[^>]*property\s*=\s*["']og:description["'][^>]*>/i.exec(M), c = og && getA(og[0], "content");
      if (c) { out = insertHead(out, '<meta name="description" content="' + q(c) + '">'); n++; } else manual.push("وصف الصفحة meta description مفقود");
    }
    return { html: out, n: n, manual };
  }

  /* ───────── 7) اتصال مسبق بالنطاقات الخارجية الحاجبة ───────── */
  function preconnect(h, lhr) {
    const po = pageOrigin(lhr), items = []; const nr = A(lhr)["network-requests"]; walk(nr && nr.details, o => { if (o.url && typeof o.url === "string" && /^https:/.test(o.url) && /Stylesheet|Script|Font/i.test(o.resourceType || "")) items.push(o); });
    const org = {}; items.forEach(o => { try { const u = new URL(o.url); if (u.origin === po) return; const e = org[u.origin] || (org[u.origin] = { t: o.networkRequestTime || 0, font: false, n: 0 }); e.t = Math.min(e.t, o.networkRequestTime || e.t); e.font = e.font || /Font/i.test(o.resourceType); e.n++; } catch (x) { } });
    const M = maskC(h), pick = Object.keys(org).filter(o => !new RegExp("<link\\b[^>]*rel=[\"']?(?:preconnect|dns-prefetch)[\"']?[^>]*" + o.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "i").test(M)).sort((a, b) => org[a].t - org[b].t).slice(0, 3);
    if (!pick.length) return { html: h, n: 0 };
    return { html: insertHead(h, pick.map(o => '<link rel="preconnect" href="' + o + '"' + (org[o].font ? " crossorigin" : "") + ">").join("\n")), n: pick.length };
  }

  /* ───────── 8) تأجيل السكربتات الحاجبة (يحتاج مراجعة: قد يعتمد كود آخر على ترتيب التنفيذ) ───────── */
  function defer(h, lhr) {
    const urls = []; ["render-blocking-insight", "render-blocking-resources"].forEach(id => { const a = A(lhr)[id]; walk(a && a.details, o => { if (typeof o.url === "string") urls.push(base(o.url)); }); });
    if (!urls.length) return { html: h, n: 0 };
    const headEnd = (() => { const m = /<\/head>/i.exec(maskC(h)); return m ? m.index : h.length; })();
    let pos = 0; return edit(h, /<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, (t, x) => {
      if (x.index > headEnd || hasA(t, "defer") || hasA(t, "async") || /type\s*=\s*["']module/i.test(t) || hasA(t, "nomodule")) return null;
      if (!urls.includes(base(getA(t, "src")))) return null; return t.replace(/^<script/i, "<script defer");
    }, maskC);
  }

  /* ───────── 9) font-display ───────── */
  function fixCss(css) {
    let n = 0; const out = String(css).replace(/@font-face\s*\{[^}]*\}/gi, b => /font-display\s*:/i.test(b) ? b : (n++, b.replace(/\}\s*$/, (/;\s*\}$/.test(b) || /\{\s*\}$/.test(b) ? "" : ";") + "font-display:swap}")));
    return { css: out, n };
  }
  function fontdisplay(h, lhr, ctx) {
    let n = 0, out = h; const css = (ctx && ctx.css) || {};
    const r1 = edit(out, /<style\b[^>]*>[\s\S]*?<\/style>/gi, t => { const o = /^<style\b[^>]*>/i.exec(t)[0], c = t.slice(o.length, t.length - 8), f = fixCss(c); return f.n ? o + f.css + "</style>" : null; }, maskC); out = r1.html; n += r1.n;
    const r2 = edit(out, /<link\b[^>]*fonts\.googleapis\.com[^>]*>/gi, t => { if (!/\brel\s*=\s*["']?stylesheet/i.test(t)) return null; const hr = getA(t, "href"); if (!hr || !/\/css2?\?/.test(hr) || /(?:[?&]|&amp;|&#38;)display=/i.test(hr)) return null; return setA(t, "href", hr + (hr.includes("?") ? "&amp;" : "?") + "display=swap"); }, maskC); out = r2.html; n += r2.n;
    return { html: out, n: n + Object.values(css).reduce((s, c) => s + fixCss(c).n, 0) };
  }

  /* ───────── 10) تحويل الصور الثقيلة إلى WebP (التحويل نفسه في المتصفح، هنا استبدال المراجع فقط) ───────── */
  const RASTER = /\.(?:png|jpe?g)(?:[?#].*)?$/i;
  function webp(h, lhr, ctx) {
    const map = (ctx && ctx.webp) || {}, need = []; let n = 0;
    const r = edit(h, /<(?:img|source|link)\b[^>]*>/gi, t => {
      let o = t;
      for (const a of ["src", "data-src", "srcset", "href", "imagesrcset"]) {
        const v = getA(o, a); if (!v) continue;
        if (a === "src" || a === "data-src" || a === "href") { if (!RASTER.test(v)) continue; if (map[v]) o = setA(o, a, map[v]); else if (!/^https?:\/\//i.test(v) || (ctx && ctx.origin && v.indexOf(ctx.origin) === 0)) need.push(v); }
        else { const nv = v.split(",").map(p => { const s = p.trim().split(/\s+/); return map[s[0]] ? [map[s[0]]].concat(s.slice(1)).join(" ") : p.trim(); }).join(", "); if (nv !== v) o = setA(o, a, nv); }
      }
      if (o !== t) n++; return o;
    }, maskC);
    r.need = [...new Set(need)]; return r;
  }

  /* ───────── السجلّ والتطبيق ───────── */
  const FIXERS = [
    { id: "meta", title: "الوسوم الأساسية للصفحة", desc: "لغة الصفحة وإطار العرض ووصف محركات البحث.", risk: "safe", run: meta, audits: ["html-has-lang", "html-lang-valid", "viewport", "meta-description", "document-title"] },
    { id: "a11y", title: "أسماء الأزرار والروابط", desc: "إضافة وصف نصي للأزرار والروابط التي تحتوي أيقونة فقط ليقرأها قارئ الشاشة.", risk: "safe", run: a11y, audits: ["button-name", "link-name"] },
    { id: "alt", title: "النص البديل للصور", desc: "الصور الزخرفية داخل الروابط تُعلَّم زخرفية، وما له عنوان يأخذه نصاً بديلاً.", risk: "safe", run: alt, audits: ["image-alt", "role-img-alt"] },
    { id: "lcp", title: "أولوية تحميل صورة الشاشة الأولى", desc: "رفع أولوية أكبر صورة ظاهرة وتحميلها مسبقاً لتظهر أسرع.", risk: "safe", run: lcp, audits: ["prioritize-lcp-image", "lcp-lazy-loaded", "lcp-discovery-insight", "largest-contentful-paint-element"] },
    { id: "lazy", title: "تحميل الصور الكسول", desc: "تأخير الصور التي تحت الشاشة الأولى لتخفيف الحمل الأول.", risk: "safe", run: lazy, audits: ["offscreen-images"] },
    { id: "ratio", title: "حجز مساحة الصور", desc: "إضافة نسبة أبعاد لكل صورة كي لا تقفز الصفحة أثناء التحميل (يحسّن CLS). قد تتعارض مع تنسيق الصور في بعض التصاميم فراجع النتيجة.", risk: "review", run: ratio, audits: ["unsized-images", "cls-culprits-insight", "layout-shifts"] },
    { id: "preconnect", title: "اتصال مسبق بالنطاقات الخارجية", desc: "فتح الاتصال بالخطوط والمكتبات الخارجية قبل طلبها.", risk: "safe", run: preconnect, audits: ["uses-rel-preconnect", "network-dependency-tree-insight"] },
    { id: "fontdisplay", title: "عرض النص أثناء تحميل الخط", desc: "إضافة font-display:swap كي يظهر النص فوراً بخط بديل.", risk: "safe", run: fontdisplay, audits: ["font-display", "font-display-insight"] },
    { id: "webp", title: "تحويل الصور الثقيلة إلى WebP", desc: "إنشاء نسخة WebP أخف لصور PNG/JPG الكبيرة واستبدالها في هذه الصفحة (الأصلية تبقى كما هي).", risk: "safe", run: webp, audits: ["modern-image-formats", "uses-optimized-images", "image-delivery-insight", "uses-responsive-images", "total-byte-weight"] },
    { id: "defer", title: "تأجيل السكربتات الحاجبة", desc: "إضافة defer للسكربتات الخارجية التي توقف عرض الصفحة. قد يتأثر كود يعتمد على ترتيب التنفيذ، فراجع الصفحة بعد التطبيق.", risk: "review", run: defer, audits: ["render-blocking-insight", "render-blocking-resources"] },
  ];
  const AUDIT_FIX = {}; FIXERS.forEach(f => f.audits.forEach(a => { AUDIT_FIX[a] = f.id; }));

  /** يفحص الصفحة ويعيد ما يمكن إصلاحه: [{id,title,desc,risk,count,manual[],need}] */
  function analyze(html, lhr, ctx) {
    return FIXERS.map(f => { let r; try { r = f.run(html, lhr, ctx || {}); } catch (e) { r = { html, n: 0, manual: ["تعذّر تحليل هذا البند: " + e.message] }; }
      return { id: f.id, title: f.title, desc: f.desc, risk: f.risk, count: r.n || 0, manual: r.manual || [], need: r.need || null }; });
  }
  /** يطبّق المصلِّحات المختارة بالتتابع ويعيد {html, report[{id,n}]} */
  function apply(html, ids, lhr, ctx) {
    let h = html; const report = [];
    for (const f of FIXERS) { if (!ids.includes(f.id)) continue; const r = f.run(h, lhr, ctx || {}); h = r.html; report.push({ id: f.id, n: r.n || 0, manual: r.manual || [] }); }
    return { html: h, report };
  }
  /** من رابط الفحص إلى ملف الصفحة في المستودع */
  function pagePath(url) {
    let u; try { u = new URL(url); } catch (e) { return ""; } let p = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (!p || p.endsWith("/")) p += "index.html"; else if (!/\.[a-z0-9]+$/i.test(p)) p += "/index.html"; return /\.\.|^\//.test(p) ? "" : p;
  }
  /** روابط ملفات CSS المحلية المرتبطة بالصفحة (لتصحيح font-display فيها) */
  function localCss(html, origin) {
    const out = []; edit(html, /<link\b[^>]*>/gi, t => { if (/stylesheet/i.test(getA(t, "rel") || "")) { let hr = getA(t, "href") || ""; if (origin && hr.indexOf(origin) === 0) hr = hr.slice(origin.length); if (hr && !/^(?:[a-z]+:)?\/\//i.test(hr) && !/^data:/i.test(hr)) out.push(hr.replace(/^\//, "").split(/[?#]/)[0]); } return null; }, maskC);
    return [...new Set(out)];
  }
  return { FIXERS, AUDIT_FIX, analyze, apply, fixCss, pagePath, localCss, _t: { a11y, alt, lazy, ratio, lcp, meta, preconnect, defer, fontdisplay, webp, getA, setA } };
});
