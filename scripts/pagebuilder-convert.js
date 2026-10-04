/* ═════════════════════════════════════════════════════════════════
   فتح صفحة المنتج أو الصفحة الرئيسية في «مطوّر الصفحات» بشكلها الأصلي (PBConvert)
   • زر «تعديل» في شريط المعاينة وفي قائمة الصفحات ← تُفتح الصفحة كما هي: كل كتلة من الصفحة (الشريط العلوي، الهيدر، أقسام المحتوى، الفوتر)
     قسم في المطوّر يحمل HTML الأصل نفسه وأنماطه، فيطابق الشكل الأصلي، ويمكن تحريك الأقسام وحذفها وتعديل كودها وإضافة عناصر المطوّر بينها.
   • «حفظ ونشر» ← حفظ مباشر (يُعاد بناء الصفحة الأصلية نفسها بالأقسام المعدَّلة مع بقاء رأسها وسكربتاتها: السلة والمعرض وغيرها)
     أو نسخة جديدة /lp/… أو استرجاع الأصل.
   ═════════════════════════════════════════════════════════════════ */
const PBBind_after = (root, page) => { PBBind.after(root, page); PBEd.after(root, page); };
const PBConvert = (() => {
  const { mkW, mkC, mkS, newPage, esc } = PB;
  const toast = m => { try { window.toast(m); } catch (e) { } };
  const hex = c => { const m = String(c || "").match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (!m) return ""; if (m[4] !== undefined && +m[4] < .5) return ""; return "#" + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, "0")).join(""); };
  const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const SKIP = "script,style,noscript,template,link,meta,header.site,footer.site,.topbar,.drawer,.drawer-bg,#drawer,#drawer-bg,#agent,[id^=agent],.acc-btn,.cart-btn,.crumbs,.sr-only,.ch-share-btn,#ch-float,#ch-share,.sticky-order,.pbx-ov,.sticky-cta";
  const key = (kind, slug) => kind === "home" ? "home" : "p-" + slug;
  const path = (kind, slug) => kind === "home" ? "index.html" : "p/" + slug + "/index.html";

  const dec = f => decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))));
  const siteBase = () => location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  const absCss = (css, from) => css.replace(/url\(\s*(['"]?)(?!data:|https?:|\/\/|#)([^)'"]+?)\1\s*\)/g, (m, q, u) => { try { return "url(" + new URL(u, from).href + ")"; } catch (e) { return m; } });
  const GROUP = el => el.matches(".topbar,header") ? "top" : el.matches("footer") ? "bot" : "";
  async function render(url) {
    const fr = document.createElement("iframe"); fr.setAttribute("aria-hidden", "true"); fr.style.cssText = "position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0;visibility:hidden";
    document.body.appendChild(fr);
    try { await new Promise((res, rej) => { fr.onload = res; fr.onerror = rej; fr.src = url + (url.includes("?") ? "&" : "?") + "preview=" + Date.now(); setTimeout(res, 12000); }); await new Promise(r => setTimeout(r, 2200)); return fr; }
    catch (e) { fr.remove(); throw e; }
  }
  function convertMain(doc, o, fdoc) {
    const win = doc.defaultView, cs = el => win.getComputedStyle(el);
    const hidden = el => { const s = cs(el); return s.display === "none" || s.visibility === "hidden" || el.hidden || (+s.opacity === 0 && !el.querySelector("img")); };
    const skip = el => el.matches(SKIP) || hidden(el);
    const kids = el => [...el.children].filter(c => !skip(c));
    const dom = String((typeof SITE_CFG !== "undefined" && SITE_CFG.domain) || "").replace(/^www\./, ""), rel = u => { try { const x = new URL(u, doc.baseURI); if (x.origin !== new URL(doc.baseURI).origin && !(dom && x.hostname.replace(/^www\./, "") === dom)) return x.href; return decodeURIComponent(x.pathname.replace(/^\//, "")) + x.search; } catch (e) { return u; } };
    const ta = el => { const a = cs(el).textAlign; return a === "center" ? "center" : (a === "left" || a === "end") ? "end" : "start"; };
    const px = (el, d) => Math.round(parseFloat(cs(el).fontSize) || d);
    const inline = el => { const c = el.cloneNode(true); c.querySelectorAll("script,style,svg,img,button,input,select,textarea,iframe").forEach(x => x.remove()); c.querySelectorAll("*").forEach(x => { [...x.attributes].forEach(a => { if (!(x.tagName === "A" && a.name === "href")) x.removeAttribute(a.name); }); if (!/^(A|B|STRONG|EM|I|U|BR|P|UL|OL|LI|SPAN|SMALL|MARK|DEL|S)$/.test(x.tagName)) x.replaceWith(...x.childNodes); }); return c.innerHTML.trim(); };
    const txt = el => (el.textContent || "").replace(/\s+/g, " ").trim();
    const hasBlock = el => [...el.children].some(c => !skip(c) && /^(DIV|SECTION|ARTICLE|UL|OL|H[1-6]|FORM|TABLE|DETAILS|FIGURE|IMG|PICTURE|VIDEO|IFRAME|P|BLOCKQUOTE|ASIDE)$/.test(c.tagName));
    const colorOf = el => { const h = hex(cs(el).color); return h; };
    const isOrder = el => (el.matches("form,[id*=order i],[class*=order i]") && el.querySelector("input,select,textarea")) || (el.querySelector && el.querySelector("#name,#phone,#cname,input[type=tel]") && el.querySelector("button") && !el.querySelector("h1,h2") && el.querySelectorAll("input").length >= 2);
    let sawOrder = false; const seen = new Set();
    /* نموذج الطلب الأصلي كما هو في ملف الصفحة (يُستعمل عند الحفظ المباشر على صفحة المنتج نفسها فلا يتضمّن نفسه) */
    const rawOrder = (() => { if (o.kind !== "product" || !fdoc) return ""; const inp = fdoc.querySelector("#cname,#name,#phone,input[type=tel]"); const el = inp && (inp.closest("form,[id*=order i],[class*=order i]") || inp.parentElement); return el ? el.outerHTML : ""; })();
    /* عناصر وظيفية حسّاسة تبقى كتلة HTML أصلية محمية (لا تُفكَّك): المعرض التفاعلي، العناصر المرتبطة بالسلة/الطلب، وأقسام تملؤها سكربتات الصفحة */
    const dyn = new Set(); (fdoc ? fdoc.querySelectorAll("script:not([src])") : []).forEach(sc => (sc.textContent.match(/getElementById\(["']([\w-]+)["']\)/g) || []).forEach(m => dyn.add(m.replace(/^.*\(["']|["']\)$/g, ""))));
    const dynEmpty = [...dyn].filter(id => { const e = fdoc && fdoc.getElementById(id); return e && !e.children.length && !(e.textContent || "").trim() && !["offers", "pprice", "pold", "psave", "name", "phone", "commune", "wilaya", "gmain", "gthumbs"].includes(id) && !/^(input|select|textarea|button)$/i.test(e.tagName); });
    const homeRaw = o.kind === "home" ? ".shop-cats,#chips,#grid,#bestsellers-grid,[onclick]" : "";      // الرئيسية: ما تملؤه السكربتات (فئات/شرائح/شبكات المنتجات) وأي عنصر بحدث نقر يبقى كتلة أصلية
    const PROT = "[data-cart],.gallery,.order-form,.pbox,.gthumbs,#gmain" + (dynEmpty.length ? "," + dynEmpty.map(i => "#" + i).join(",") : "") + (homeRaw ? "," + homeRaw : "");
    const mainD = doc.querySelector("main") || doc.body, fmainD = fdoc && (fdoc.querySelector("main") || fdoc.body);
    const fileEl = el => { if (!fdoc) return null; if (el.id) { const e = fdoc.getElementById(el.id); if (e && e.tagName === el.tagName) return e; } const p = []; let x = el; while (x && x !== mainD) { const par = x.parentElement; if (!par) return null; p.unshift([...par.children].indexOf(x)); x = par; } let f = fmainD; for (const i of p) { f = f && f.children[i]; } return f && f.tagName === el.tagName ? f : null; };
    const rawKeep = c => !!(((dynEmpty.length ? dynEmpty.map(i => "#" + i).join(",") : "") + (homeRaw ? (dynEmpty.length ? "," : "") + homeRaw : "")) && c.querySelector((dynEmpty.length ? dynEmpty.map(i => "#" + i).join(",") : "") + (homeRaw ? (dynEmpty.length ? "," : "") + homeRaw : "")));
    const protect = el => !!(el.matches(PROT) && !el.matches("body,main"));
    const rawW = el => { const f = fileEl(el); return mkW("html", { code: (f || el).outerHTML, src: "orig" }); };

    /* ── نقل تنسيق الصفحة إلى إعدادات المطوّر نفسها: خلفية/تدرّج/حدّ/تدوير/ظل/حشو/هامش وخط (ارتفاع سطر، سماكة، تباعد، عائلة) ── */
    const bodyFont = cs(doc.body).fontFamily;
    /* المسافة الرأسية بين عناصر العمود = الفراغ الحقيقي بينها في الصفحة الأصلية */
    const spaced = ws => { ws.forEach((w, i) => { const nx = ws[i + 1]; const g = w._r && nx && nx._r ? Math.max(0, Math.round(nx._r.t - w._r.b)) : 0; w.set.mar = { d: [0, 0, g, 0] }; }); return ws; };
    const mkCol = (ws, set) => mkC(spaced(ws), set);
    const boxSet = (el, type) => {
      const q = cs(el), r = {}, n4 = pfx => ["Top", "Right", "Bottom", "Left"].map(d => Math.round(parseFloat(q[pfx + d]) || 0));
      const bgc = hex(q.backgroundColor); if (bgc && type !== "button") r.bg = bgc;
      if (type !== "button" && type !== "image" && /linear-gradient\(/.test(q.backgroundImage)) { const cols = [...q.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => hex(m[0])).filter(Boolean); if (cols.length >= 2) { r.grad1 = cols[0]; r.grad2 = cols[cols.length - 1]; const a = /(\d+)deg/.exec(q.backgroundImage); r.gradAng = a ? +a[1] : 180; } }
      const bw = parseFloat(q.borderTopWidth) || 0, bAll = ["Right", "Bottom", "Left"].every(d => (parseFloat(q["border" + d + "Width"]) || 0) === bw); if (bw > 0 && bAll && q.borderTopStyle !== "none" && type !== "button") { r.bw = bw; r.bs = /^(solid|dashed|dotted)$/.test(q.borderTopStyle) ? q.borderTopStyle : "solid"; r.bc = hex(q.borderTopColor) || "#ddd"; }
      const rad = parseFloat(q.borderTopLeftRadius) || 0; if (rad > 0 && type !== "button") r.rad = { d: Math.round(rad) };
      if (type !== "image" && type !== "button") { const pd = n4("padding"); if (pd.some(x => x > 0)) r.pad = { d: pd }; }
      if (q.boxShadow && q.boxShadow !== "none") { const nums = (q.boxShadow.replace(/rgba?\([^)]*\)/g, "").match(/-?[\d.]+px/g) || []).map(parseFloat); const blur = nums[2] || 0; r.shadow = blur >= 24 ? "lg" : blur >= 10 ? "md" : "sm"; }
      return r;
    };
    const hasVisual = el => { const q = cs(el); return !!(hex(q.backgroundColor) || (parseFloat(q.borderTopWidth) > 0 && q.borderTopStyle !== "none") || (q.boxShadow && q.boxShadow !== "none") || /gradient\(/.test(q.backgroundImage)); };
    const pseudoBefore = el => { try { let c = win.getComputedStyle(el, "::before").content; if (!c || c === "none" || c === "normal" || /^(url|counter|attr)/.test(c)) return ""; c = c.replace(/^["']|["']$/g, ""); return c.length && c.length < 6 ? c + " " : ""; } catch (e) { return ""; } };
    const BOUND = "#pprice,#pold,#psave,#offers,h1,#gmain,form,input,select,button,[data-cart],.order-form";
    function widgetsOf(el, out) {
      const n0 = out.length; widgetsOf0(el, out);
      if (out.length === n0 + 1) { const w = out[n0], ty = w.type; if (!w._r) { const rr = el.getBoundingClientRect(); w._r = { t: rr.top, b: rr.bottom }; }
        if (/^(heading|text|image)$/.test(ty)) { Object.assign(w.set, boxSet(el, ty)); }
        if (/^(heading|text)$/.test(ty) && (w.set.bg || w.set.bw || w.set.shadow) && el.parentElement) { const pr = el.parentElement.getBoundingClientRect().width, er = el.getBoundingClientRect().width; if (pr > 0 && er / pr < .94) w.set.w = { d: Math.max(8, Math.round(er / pr * 100)) }; }      // شارات/أزرار نصية بعرضها الأصلي لا بعرض العمود
        if (/^(heading|text)$/.test(ty)) { const q = cs(el), fs0 = parseFloat(q.fontSize) || 16, lh = parseFloat(q.lineHeight); if (lh) w.set.lh = { d: Math.round(lh / fs0 * 100) / 100 }; const ls = parseFloat(q.letterSpacing); if (ls) w.set.ls = { d: ls }; if (ty === "text") { const fw = q.fontWeight; if (fw && fw !== "400") w.set.fw = fw; } if (q.fontFamily && q.fontFamily !== bodyFont) w.set.ff = q.fontFamily; if (ty === "text") { const pb = pseudoBefore(el); if (pb && w.set.html) w.set.html = w.set.html.replace(/^<p([^>]*)>/, "<p$1>" + pb); } }
      }
    }
    function widgetsOf0(el, out) {
      if (skip(el)) return;
      const tag = el.tagName;
      if (protect(el) && !(o.kind === "product" && isOrder(el))) { out.push(rawW(el)); return; }
      if (!/^(H[1-6]|P|IMG|A|BUTTON|SPAN|LI|SMALL|B|STRONG|LABEL|DETAILS|UL|OL)$/.test(tag) && hasVisual(el) && hasBlock(el) && !el.querySelector(BOUND) && !isOrder(el)) { out.push(rawW(el)); return; }      // بطاقة مزخرفة متعددة العناصر: تبقى كما هي حرفياً (تنسيقها محفوظ) وتُعدَّل عناصرها بالنقر
      if (o.kind === "product" && isOrder(el)) { if (!sawOrder) { sawOrder = true; out.push(mkW("orderorig", { prod: o.slug, raw: rawOrder })); } return; }
      if (o.kind === "product") {
        if (el.id === "offers" || (el.querySelector("#offers") && !el.querySelector("h1,h2,form,#gmain,#pprice") && txt(el).length < 400)) { out.push(mkW("poffers", { prod: o.slug })); return; }
        if (el.id === "pprice" || (el.querySelector("#pprice") && !el.querySelector("h1,h2,img,#offers,form") && txt(el).length < 120)) { out.push(mkW("pprice", { prod: o.slug })); return; }
      }
      if (el.matches(".pd-tags") && kids(el).length && kids(el).every(c => c.matches(".tag"))) {      // صف شارات الثقة ← عنصر «شارات الثقة» (مع الشارة الحيّة)
        const ks = kids(el), live = ks.find(c => c.matches(".live-badge") || c.querySelector("#viewers")), plain = ks.filter(c => c !== live), q0 = cs(plain[0] || live);
        const set = { items: plain.map(txt).join("\n"), live: !!live, liveText: live ? txt(live).replace(/[\d٠-٩]+/g, "").replace(/\s+/g, " ").trim() : "", cbg: hex(q0.backgroundColor) || "#ffffff", cc: hex(q0.color) || "#566360", cbc: hex(q0.borderTopColor) || "#eadfc4", crad: { d: Math.round(parseFloat(q0.borderTopLeftRadius)) || 999 }, cfs: { d: Math.round(parseFloat(q0.fontSize)) || 13 }, gap: { d: Math.round(parseFloat(cs(el).columnGap) || 10) } };
        out.push(mkW("tbadges", set)); return;
      }
      if (/^H[1-6]$/.test(tag)) { const t = txt(el); if (!t) return; const w = mkW("heading", { text: t, tag: tag.toLowerCase(), bindTitle: o.kind === "product" && tag === "H1", prod: o.kind === "product" ? o.slug : "", fs: { d: px(el, 32), m: Math.max(18, Math.round(px(el, 32) * (px(el, 32) > 30 ? .72 : .9))) }, ta: { d: ta(el) } }); const c = colorOf(el); if (c) w.set.color = c; out.push(w); return; }
      if (tag === "IMG") { const r = el.getBoundingClientRect(); const src = el.currentSrc || el.src || ""; if (!src || r.width < 110 || el.closest("[class*=thumb]") || seen.has(src) || /placeholder|\.svg(\?|$)|data:image\/svg/i.test(src)) return; seen.add(src); out.push(mkW("image", { src: rel(src), alt: el.alt || "", fit: "cover" })); return; }
      if (tag === "PICTURE") { const i = el.querySelector("img"); if (i) widgetsOf(i, out); return; }
      if (tag === "VIDEO" || (tag === "IFRAME" && /youtube|vimeo/i.test(el.src))) { const u = el.src || (el.querySelector("source") || {}).src || ""; if (u) out.push(mkW("video", { url: u, ratio: "16/9" })); return; }
      if (tag === "UL" || tag === "OL") { const li = [...el.children].filter(c => c.tagName === "LI" && txt(c)); if (li.length && li.every(x => !hasBlock(x)) && !hasVisual(li[0])) { out.push(mkW("bullets", { items: li.map(txt).join("\n"), mk: tag === "OL" ? "dec" : "check", fs: { d: px(li[0], 17) } })); return; } }
      if (tag === "DETAILS" || tag === "TABLE") { if (tag === "DETAILS") { const q = txt(el.querySelector("summary") || {}), a = txt({ textContent: [...el.childNodes].filter(n => !(n.tagName === "SUMMARY")).map(n => n.textContent).join(" ") }); if (q) { const last = out[out.length - 1]; const it = { q, a }; if (last && last.type === "accordion" && last._auto) last.set.items.push(it); else { const w = mkW("accordion", { items: [it], first: false }); w._auto = true; out.push(w); } } return; } }
      if ((tag === "A" || tag === "BUTTON") && (el.matches("[class*=btn]") || tag === "BUTTON")) { const t = txt(el); if (!t || el.matches(".cart-btn,.btn-order,[onclick*=Cart]") || el.closest("[class*=tab],[class*=pill],[class*=chip],[id*=tab]") || t.length > 60) return; const s = cs(el); const w = mkW("button", { text: t, kind: "link", link: tag === "A" ? (el.getAttribute("href") || "#") : "#", fs: { d: px(el, 18) }, brad: { d: parseInt(s.borderTopLeftRadius) || 10 } }); const bg = hex(s.backgroundColor), c = hex(s.color); if (bg) w.set.bgc = bg; if (c) w.set.color = c; if (!bg) w.set.bgHide = true; out.push(w); return; }
      if (o.kind === "home" && (el.id === "grid" || el.matches(".grid") && el.querySelector("[data-slug],.card,.pcard"))) { out.push(mkW("products", { mode: "all" })); return; }
      if (tag === "P" || tag === "BLOCKQUOTE" || tag === "SPAN" || tag === "SMALL" || tag === "LI" || tag === "A" || tag === "B" || tag === "STRONG" || tag === "LABEL" || ((tag === "DIV" || tag === "FIGCAPTION" || tag === "TD") && !hasBlock(el) && !el.querySelector("a[class*=btn],button"))) {
        if (el.querySelector("img") && !txt(el)) { [...el.querySelectorAll("img")].forEach(i => widgetsOf(i, out)); return; }
        const h = inline(el), t = txt(el); if (!t) return;
        const w = mkW("text", { html: /^<p[ >]/.test(h) ? h : "<p>" + h + "</p>", fs: { d: px(el, 17) }, ta: { d: ta(el) } }); const c = colorOf(el); if (c) w.set.color = c; out.push(w); return;
      }
      kids(el).forEach(c => widgetsOf(c, out));
    }
    /* حاوية بأعمدة (grid / flex أفقي) ← أعمدة في القسم */
    function columnsOf(el) {
      const q = cs(el), k = kids(el);
      if (k.length < 2 || k.length > 4) return null;
      if (k.some(c => hasBlock(c) && [...c.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) return null;      // خلية فيها نص مباشر بجانب عناصر: تفكيكها يُضيع النص فتبقى البطاقة كما هي
      const row = (q.display === "grid" && q.gridTemplateColumns.split(" ").length >= 2) || (q.display === "flex" && !/column/.test(q.flexDirection));
      if (!row) return null;
      const cols = k.map(c => { const w = [], leaf = /^(IMG|PICTURE|H[1-6]|P|UL|OL|A|BUTTON|DETAILS|FORM|VIDEO|IFRAME)$/.test(c.tagName) || !hasBlock(c); if (leaf) widgetsOf(c, w); else kids(c).forEach(x => widgetsOf(x, w)); return { w, set: leaf ? {} : Object.assign(boxSet(c, "col"), { ta: { d: ta(c) } }) }; }).filter(x => x.w.length);
      return cols.length >= 2 ? cols : null;
    }
    function sectionOf(el, hint) {
      let inner = el, safe = 0;
      while (safe++ < 4) { const k = kids(inner); if (k.length === 1 && !/^(IMG|H[1-6]|P|UL|OL|FORM)$/.test(k[0].tagName) && !isOrder(k[0])) inner = k[0]; else break; }
      let cols = columnsOf(inner); let cs_;
      if (!cols) { let found = null; const ks = kids(inner), gi = ks.findIndex(k => (found = columnsOf(k))); if (gi >= 0 && ks.length > 1) {      // قسم يضم كتلة أعمدة بين عناصر أخرى ← أقسام متتالية: ما قبلها، الأعمدة، ما بعدها
        const mk = (list) => { const w = []; list.forEach(c => widgetsOf(c, w)); return w.length ? mkS([mkCol(w)], {}) : null; };
        const secsOut = [mk(ks.slice(0, gi)), mkS(found.map(x => mkCol(x.w, x.set)), {}), mk(ks.slice(gi + 1))].filter(Boolean);
        const bg0 = hex(cs(el).backgroundColor); if (bg0) secsOut.forEach(x => { x.set.bg = bg0; }); return secsOut; } }
      if (cols) cs_ = cols.map(x => mkCol(x.w, x.set)); else { const w = []; if (hasBlock(inner)) kids(inner).forEach(x => widgetsOf(x, w)); else widgetsOf(inner, w); if (!w.length) return null; cs_ = [mkCol(w, inner !== el ? boxSet(inner, "col") : {})]; }
      const s = cs(el), set = {}, bg = hex(s.backgroundColor) || (hint && hint.bg) || ""; const gi = /gradient\(/.test(s.backgroundImage) ? ([...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => m[0]).filter(c => hex(c)).pop() || "") : ""; const b2 = bg || hex(gi);
      if (b2) set.bg = b2;
      const pt = Math.round(parseFloat(s.paddingTop) || 0), pb = Math.round(parseFloat(s.paddingBottom) || 0); set.pad = { d: [Math.max(16, pt), 20, Math.max(16, pb), 20], m: [Math.max(14, Math.round(pt * .6)), 16, Math.max(14, Math.round(pb * .6)), 16] };
      { const iw = Math.round(inner.getBoundingClientRect().width); if (iw > 300 && iw < 1500 && iw < (doc.documentElement.clientWidth || 1280) - 8) set.cw = { d: iw }; }
      { const bx = boxSet(el, "section"); ["bw", "bs", "bc", "rad", "shadow", "grad1", "grad2", "gradAng"].forEach(k => { if (bx[k] != null) set[k] = bx[k]; }); }
      return mkS(cs_, set);
    }
    const root = doc.querySelector("main") || doc.body, secs = [];
    const rawSec = (c, idx) => { let el = c.id ? fdoc.getElementById(c.id) : null; if (!el) { const m = fdoc.querySelector("main"); el = m && m.children[idx]; } if (!el) return null; const sec = mkS([mkC([mkW("html", { code: el.outerHTML, src: "orig" })])], { layout: "full", pad: { d: [0, 0, 0, 0], m: [0, 0, 0, 0] }, gap: { d: 0 } }); sec.grp = "main"; return sec; };
    let loose = [];
    const flush = () => { if (!loose.length) return; const w = []; loose.forEach(c => widgetsOf(c, w)); if (w.length) secs.push(mkS([mkCol(w)], {})); loose = []; };
    const all = [...root.children], top = all.flatMap(c => (c.matches(".container,#main,div") && kids(c).length > 1 && kids(c).every(x => x.matches("section,.hero,div[class*=sec],.container"))) ? kids(c) : [c]);
    top.forEach(c => {
      if (skip(c)) return;
      if (rawKeep(c) || (o.kind === "home" && c.matches(".hero,[class*=hero]"))) { flush(); const r = rawSec(c, all.indexOf(c)); if (r) secs.push(r); return; }
      if (c.matches("section,.container") || hex(cs(c).backgroundColor) || /gradient/.test(cs(c).backgroundImage) || c.matches(".hero,[class*=hero]")) { flush(); const s = sectionOf(c); if (s) secs.push(...[].concat(s)); } else loose.push(c);
    });
    flush();
    if (o.kind === "product" && !sawOrder) secs.push(mkS([mkC([mkW("orderorig", { prod: o.slug, raw: rawOrder })])], {}));
    secs.forEach(s => (s.cols || []).forEach(c => (c.widgets || []).forEach(w => { delete w._auto; delete w._r; })));
    return secs;
  }
  /* يقرأ الصفحة الأصلية (ملفها كما هو) ويحوّلها إلى صفحة مطوّر: قسم لكل كتلة بنفس HTML الأصل + أنماطها */
  /* يقرأ الصفحة الأصلية (ملفها كما هو) ويحافظ على هيكلها كاملاً: كل كتلة (الشريط العلوي، الهيدر، أقسام المحتوى، الفوتر) قسم في المطوّر بنفس HTML الأصل وأنماطه؛
     تُعدَّل عناصرها (نصوص، صور، روابط، ألوان، أحجام…) مباشرة بالنقر عليها (PBEd) دون أن يتغيّر الهيكل */
  async function build(kind, slug, title, srcText) {
    const pth = path(kind, slug), text = srcText || dec(await GH.getFile(pth)), doc = new DOMParser().parseFromString(text, "text/html"), from = siteBase() + pth;
    let css = "";
    doc.head.querySelectorAll("style").forEach(st => { css += absCss(st.textContent, from) + "\n"; });
    for (const l of doc.head.querySelectorAll('link[rel="stylesheet"]')) {
      const h = l.getAttribute("href") || ""; if (!h || /^(https?:)?\/\//.test(h)) continue;
      try { const u = new URL(h, from).href, r = await fetch(u); if (r.ok) css += absCss(await r.text(), u) + "\n"; } catch (e) { }
    }
    const AG = "#agent,[id^=agent],[class*=agent],#avatar,.avatar-bubble";      // الوكيل الذكي يُستثنى من المطوّر
    const raw = (grp, el) => { const sec = mkS([mkC([mkW("html", { code: el.outerHTML, src: "orig" })])], { layout: "full", pad: { d: [0, 0, 0, 0], m: [0, 0, 0, 0] }, gap: { d: 0 } }); sec.grp = grp; return sec; };
    const secs = [], top = [], bot = [], native = true;
    [...doc.body.children].forEach(el => {
      if (el.matches("script,style,link,noscript,template")) return;
      if (el.matches("main")) { if (!native) [...el.children].forEach(c => { if (!c.matches("script,style,link,noscript,template," + AG)) secs.push(raw("main", c)); }); return; }
      if (el.matches(AG)) return;
      const g = GROUP(el); if (g === "top") top.push(raw("top", el)); else if (g === "bot") bot.push(raw("bot", el));
    });
    if (native) {      // صفحة المنتج: تُفكَّك إلى عناصر المطوّر الحقيقية (عنوان/نص/صورة/زر/أعمدة…) وتبقى الأجزاء الوظيفية كتلاً أصلية محمية
      const fr = await render(kind === "home" ? "index.html" : "p/" + slug + "/");
      let main = []; try { const st = fr.contentDocument.createElement("style"); st.textContent = ".reveal{opacity:1!important;transform:none!important;transition:none!important}"; fr.contentDocument.head.appendChild(st); main = convertMain(fr.contentDocument, { kind, slug }, doc); } finally { fr.remove(); }
      main.forEach(x => { x.grp = x.grp || "main"; });
      secs.push(...top, ...main, ...bot);
    } else { const m = secs.splice(0); secs.push(...top, ...m, ...bot); }
    const page = newPage(title || "الصفحة الرئيسية", kind === "home" ? "home" : slug);
    page.sections = secs.length ? secs : [mkS([mkC([mkW("heading", { text: title || "صفحة" })])], {})];
    page.header = false; page.footer = false; page.css = css; page.bg = "transparent";
    const t = doc.title || ""; if (t) page.seoTitle = t.replace(/\s+—.*$/, "");
    const md = doc.querySelector('meta[name="description"]'); if (md) page.desc = md.content || "";
    if (kind === "product") page.product = slug;
    page.shell = text; page.origin = { kind, slug: kind === "home" ? "" : slug, direct: false, raw: !native, native };
    return page;
  }
  /* زر «تعديل» ← يفتح الصفحة في المطوّر */
  async function edit(kind, slug) {
    if (kind === "home") slug = "";
    try { SitePreview.close(); } catch (e) { }
    toast("⏳ جارِ فتح الصفحة في المطوّر…");
    try {
      PBBind.reset(); PBEd.hide(); const k = key(kind, slug); let page = null;
      try { const f = await GH.getFile("assets/pages/_conv/" + k + ".json"); const p = JSON.parse(dec(f)); if (p && p.origin && p.origin.direct && p.shell && p.origin.native) page = p; } catch (e) { }      // نسخة محفوظة سابقاً (تُستعمل ما دامت هي المنشورة)
      if (!page) {
        const pr = kind === "product" ? (Admin.products || []).find(x => x.slug === slug) : null;
        if (kind === "product" && !pr) throw new Error("المنتج غير موجود");
        let src = ""; try { src = dec(await GH.getFile("assets/pages/_conv/" + k + ".orig.html")); } catch (e) { }      // إن وُجد الأصل المحفوظ نبني منه (تفادي بناء من نسخة سبق استبدالها)
        page = await build(kind, slug, pr ? pr.title : "الصفحة الرئيسية", src);
      }
      PBApp.open(page, page.slug, true); PBApp.E.dirty = true;
      toast("✅ فُتحت بشكلها الأصلي في المطوّر — عدّل ما تشاء ثم «حفظ ونشر»");
    } catch (e) { console.error(e); toast("❌ تعذّر فتح الصفحة: " + e.message); }
  }
  /* ── نافذة «حفظ ونشر» لصفحة قادمة من المنتج/الرئيسية ── */
  function ask() {
    const P = PBApp.E.page, o = P.origin, name = o.kind === "home" ? "الصفحة الرئيسية" : "صفحة المنتج";
    const bg = document.createElement("div"); bg.id = "pbc-ask";
    bg.style.cssText = "position:fixed;inset:0;z-index:2147483200;background:rgba(10,20,16,.6);display:grid;place-items:center;padding:16px;font-family:inherit;direction:rtl";
    const btn = "border:0;border-radius:12px;padding:.8rem 1rem;font:inherit;font-weight:800;cursor:pointer;width:100%;text-align:right;";
    bg.innerHTML = `<div style="background:#fff;border-radius:18px;padding:1.3rem;width:min(480px,100%);box-shadow:0 30px 80px rgba(0,0,0,.4)"><h3 style="margin:0 0 .3rem;color:#173f35">حفظ ونشر — ${name}</h3><p style="margin:0 0 1rem;color:#666;font-size:.88rem">اختر كيف تحفظ تعديلاتك:</p>
<button data-m="direct" style="${btn}background:#173f35;color:#fff;margin-bottom:.6rem">💾 حفظ مباشر<br><small style="font-weight:600;opacity:.85">يستبدل ${name} الحالية بالتصميم الجديد${o.direct ? "" : " (تُحفظ نسخة من الأصلية للاسترجاع)"}</small></button>
<div style="border:1.5px solid #e6dfcf;border-radius:12px;padding:.7rem;margin-bottom:.6rem"><b style="color:#173f35">📄 حفظ نسخة جديدة</b><small style="display:block;color:#666;margin:.15rem 0 .5rem">تُنشر كصفحة مستقلة ولا تمسّ الأصلية</small><div style="display:flex;gap:.4rem;align-items:center;direction:ltr"><span style="color:#888;font-size:.8rem">/lp/</span><input id="pbc-slug" value="${esc((o.slug || "home") + "-new")}" style="flex:1;border:1.5px solid #d9d2c2;border-radius:8px;padding:.45rem;font:inherit;direction:ltr"><span style="color:#888;font-size:.8rem">/</span></div><button data-m="copy" style="${btn}background:#C8A24B;color:#173f35;margin-top:.5rem;text-align:center">نشر كنسخة جديدة</button></div>
${o.direct ? `<button data-m="restore" style="${btn}background:#fbe9e7;color:#b3261e;margin-bottom:.6rem">↩️ استرجاع ${name} الأصلية</button>` : ""}
<button data-m="x" style="${btn}background:#f1efe9;color:#333;text-align:center">إلغاء</button></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", async e => {
      const m = e.target.closest("button") && e.target.closest("button").dataset.m; if (!m && e.target !== bg) return;
      if (e.target === bg || m === "x") return bg.remove();
      if (m === "copy") {
        const s = document.getElementById("pbc-slug").value.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(s)) return toast("الرابط: حروف لاتينية صغيرة وأرقام وشرطات (حرفان على الأقل)");
        bg.remove(); P.slug = s; delete P.origin; PBApp.E.isNew = true; return PBApp.publish("lp");
      }
      bg.remove();
      if (m === "direct") return PBApp.publish("direct");
      if (m === "restore") return restore(o.kind, o.slug);
    });
  }
  /* ── حفظ مباشر: يُعاد بناء الصفحة الأصلية نفسها بأقسام المطوّر (بعد نسخها احتياطياً أول مرة) ── */
  async function saveDirect(P, ctx) {
    const o = P.origin, k = key(o.kind, o.slug), pth = path(o.kind, o.slug), put = PBApp.putJson;
    let cur = null; try { cur = await GH.getFile(pth); } catch (e) { }
    if (!o.direct && cur) {
      let has = false; try { await GH.getFile("assets/pages/_conv/" + k + ".orig.html"); has = true; } catch (e) { }
      if (!has) await GH.putFile("assets/pages/_conv/" + k + ".orig.html", cur.content.replace(/\n/g, ""), undefined, "نسخة احتياطية من الأصل قبل التحرير بالمطوّر: " + pth);
    }
    P.origin = Object.assign({}, o, { direct: true });
    const doc = new DOMParser().parseFromString(P.shell, "text/html"), out = { top: [], main: [], bot: [] };
    let last = "main", native = false;
    (P.sections || []).forEach(sec => {
      const g = sec.grp || last; last = g;
      const ws = (sec.cols || []).flatMap(c => c.widgets || []), isRaw = sec.grp && (sec.cols || []).length === 1 && ws.length === 1 && ws[0].type === "html" && !(sec.free || []).length;
      if (isRaw) { out[g].push(PBBind.bake(ws[0].set.code || "", o)); return; }
      native = true; const r = PB.renderSections({ sections: [sec], product: o.kind === "product" ? o.slug : (P.product || "") }, Object.assign({ base: o.kind === "home" ? "" : "../../", edit: false, inlineOrder: o.kind === "product" }, ctx));
      out[g].push("<style>" + r.css + "</style>" + r.html);
    });
    const place = (grp, sel) => {
      const els = [...doc.body.children].filter(el => sel(el)); const html = out[grp].join("\n");
      if (!els.length) { if (html) (grp === "bot" ? doc.body.insertAdjacentHTML("beforeend", html) : doc.body.insertAdjacentHTML("afterbegin", html)); return; }
      els[0].insertAdjacentHTML("beforebegin", html); els.forEach(el => el.remove());
    };
    place("top", el => GROUP(el) === "top");
    const main = doc.querySelector("main"); if (main) main.innerHTML = out.main.join("\n"); else doc.body.insertAdjacentHTML("afterbegin", "<main>" + out.main.join("\n") + "</main>");
    place("bot", el => GROUP(el) === "bot");
    if (o.kind === "product") {      // عناصر لا غنى عنها لسكربت صفحة المنتج: تُضاف مخفية إن حذفها المستخدم كي لا يتعطّل نموذج الطلب
      const mm = doc.querySelector("main");
      if (mm) { if (!doc.getElementById("offers")) mm.insertAdjacentHTML("beforeend", '<div id="offers" class="offers" style="display:none"></div>'); if (!doc.getElementById("gmain")) mm.insertAdjacentHTML("beforeend", '<img id="gmain" alt="" style="display:none">'); if (!doc.querySelector(".gthumbs")) mm.insertAdjacentHTML("beforeend", '<div class="gthumbs" data-static="1" style="display:none"></div>'); }
    }
    if (native) {
      const st = doc.createElement("style"); st.id = "pb-native"; st.textContent = PB.BASE_CSS; doc.head.appendChild(st);
      const sc = doc.createElement("script"); sc.textContent = "var __pbBase=" + JSON.stringify(o.kind === "home" ? "" : "../../") + ";var __pbSlug=\"\";var __pbMeta={};" + PB.RUNTIME_JS; doc.body.appendChild(sc);
    }
    const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    await GH.putFile(pth, btoa(unescape(encodeURIComponent(html))), cur && cur.sha, "نشر " + (o.kind === "home" ? "الصفحة الرئيسية" : "صفحة المنتج " + o.slug) + " من المطوّر");
    await put("assets/pages/_conv/" + k + ".json", P, "مصدر تحرير المطوّر: " + k);
  }
  async function restore(kind, slug) {
    if (!confirm("استرجاع الصفحة الأصلية؟ سيُستبدل تصميم المطوّر الحالي (يبقى مصدره محفوظاً).")) return;
    try {
      const k = key(kind, slug), pth = path(kind, slug), orig = await GH.getFile("assets/pages/_conv/" + k + ".orig.html");
      let cur; try { cur = await GH.getFile(pth); } catch (e) { }
      await GH.putFile(pth, orig.content.replace(/\n/g, ""), cur && cur.sha, "استرجاع الصفحة الأصلية: " + pth);
      try { const f = await GH.getFile("assets/pages/_conv/" + k + ".json"), p = JSON.parse(dec(f)); p.origin = Object.assign({}, p.origin, { direct: false }); await PBApp.putJson("assets/pages/_conv/" + k + ".json", p, "تعطيل تصميم المطوّر: " + k); } catch (e) { }
      if (PBApp.E.page && PBApp.E.page.origin) PBApp.E.page.origin.direct = false;
      toast("✅ استُرجعت الصفحة الأصلية (قد يستغرق ظهورها دقيقة)");
    } catch (e) { toast("❌ " + e.message); }
  }
  return { build, edit, ask, saveDirect, restore, after: PBBind_after };
})();

/* ═════════════════════════════════════════════════════════════════
   الربط بالمنتج (PBBind): عناصر الصفحة التي تملؤها الصفحة من بيانات المنتج (العنوان، السعر، السعر القديم، العروض، صور المعرض، بطاقات المنتجات)
   تُعرض في المطوّر من بيانات المنتج الحقيقية وتُعدَّل من نافذة «بيانات المنتج»؛ وعند «حفظ ونشر» يتغيّر المنتج نفسه (data.js) فيتغيّر في كل مكان.
   ═════════════════════════════════════════════════════════════════ */
const PBBind = (() => {
  const fmt = n => Number(n || 0).toLocaleString("fr-DZ") + " دج", esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let cache = {}, orig = {};
  const prods = () => (typeof Admin !== "undefined" && Admin.products) || [];
  const get = slug => cache[slug] || prods().find(x => x.slug === slug);
  const draft = slug => { if (!cache[slug]) { const p = prods().find(x => x.slug === slug); if (!p) return null; orig[slug] = JSON.stringify(p); cache[slug] = JSON.parse(orig[slug]); } return cache[slug]; };
  /* هل هذه الصفحة هي الصفحة الرسمية للمنتج؟ (وحدها تُغيّر المنتج وتتغيّر به؛ غيرها تعرض بياناته للقراءة) */
  const official = (slug, page) => { const p = get(slug); if (!p || !page) return true; if (page.origin) return page.origin.kind === "home" ? true : !p.officialPage; return p.officialPage === page.slug; };
  const simple = p => !p.type || p.type === "simple" || (!(p.variations || []).length && !(p.attributes || []).some(a => a.variation));
  const img = (p, rel) => { const s = p.cover || (p.images || [])[0] || ""; return s ? rel + encodeURI(s) : ""; };
  const card = (p, rel) => { const d = simple(p) && p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
    return `<div class="thumb">${d ? `<span class="badge-off">-${d}%</span>` : ""}<img loading="lazy" width="500" height="500" src="${esc(img(p, rel))}" alt="${esc(p.title)}"></div><div class="body"><h3>${esc(p.title)}</h3><div class="stars">★★★★★</div><div class="price-row"><span class="price">${fmt(p.price)}</span>${simple(p) && p.old ? `<span class="old">${fmt(p.old)}</span>` : ""}</div><div class="cta">اطلب الآن — الدفع عند الاستلام</div></div>`; };
  const offerCards = (p) => (p.offers || []).map((o, i) => { const paid = o.qty - (o.free || 0), unit = Math.round(o.price / Math.max(1, paid)), disc = Math.round((1 - o.price / (p.price * Math.max(1, paid))) * 100), label = o.free ? "قطعتان + الثالثة 🎁" : (o.qty === 1 ? "قطعة واحدة" : o.qty === 2 ? "قطعتان" : o.qty + " قطع");
    return `<div class="offer${i === 2 ? " on" : ""}">${i === 2 ? '<span class="best">الأكثر طلباً 🔥</span>' : ""}<div class="q">${label}</div><div class="p">${fmt(o.price)}</div><div class="u">${fmt(unit)} للقطعة ${disc > 0 ? "· وفر " + disc + "%" : ""}${o.free ? '<br><b style="color:var(--ok)">مجاناً داخل العرض</b>' : ""}</div></div>`; }).join("");
  /* يملأ العناصر المرتبطة داخل root (مرسوم في المطوّر mark=true، أو DOM مؤقت للتثبيت في الملف mark=false) */
  function applyTo(root, o) {
    const mk = (el, slug) => { if (el && o.mark) { el.setAttribute("data-pbbind", slug); el.classList.add("pbbind"); if (o.ro) el.classList.add("pbbind-ro"); } };
    const dirty = slug => !!(cache[slug] && JSON.stringify(cache[slug]) !== orig[slug]);
    if (o.kind === "product") {
      const p = get(o.slug); if (!p) return; const fill = dirty(o.slug);      // الصفحة تُعرض كما هي في ملفها؛ لا يُستبدل محتوى العناصر المرتبطة إلا بعد تعديل بيانات المنتج
      const h1 = o.noTitle ? null : root.querySelector("h1"); if (h1) { if (fill && p.title) h1.textContent = p.title; mk(h1, o.slug); }
      if (simple(p)) {
        const pp = root.querySelector("#pprice"), po = root.querySelector("#pold"), ps = root.querySelector("#psave"), has = p.old && p.old > p.price;
        if (pp) { if (fill) pp.textContent = fmt(p.price); mk(pp, o.slug); }
        if (po) { if (fill) { po.textContent = has ? fmt(p.old) : ""; po.style.display = has ? "" : "none"; } mk(po, o.slug); }
        if (ps) { if (fill) { ps.textContent = has ? "وفّر " + Math.round((1 - p.price / p.old) * 100) + "%" : ""; ps.style.display = has ? "" : "none"; } mk(ps, o.slug); }
      }
      const of = root.querySelector("#offers"); if (of) { if (fill && (p.offers || []).length) of.innerHTML = offerCards(p); mk(of, o.slug); }
      /* صور المنتج لا تُربط هنا: تُختار من إعدادات المنتج فقط؛ صور الصفحة مستقلة عنها */
    } else {
      if (!o.mark && !Object.keys(cache).some(dirty)) return;      // عند الحفظ: لا تُثبَّت البطاقات إلا إن تغيّرت بيانات منتج
      const ids = [["#bestsellers-grid", ps => ps.filter(p => (p.tags || []).includes("best")).slice(0, 8)], ["#grid", ps => ps]];
      ids.forEach(([sel, f]) => { const g = root.querySelector(sel); if (!g) return; const list = f(prods().map(x => get(x.slug)).filter(x => x && x.active !== false)); g.innerHTML = ""; list.forEach(p => { const a = document.createElement("div"); a.className = "card"; a.innerHTML = card(p, o.rel); if (o.mark) { a.setAttribute("data-pbbind", p.slug); a.classList.add("pbbind"); if (o.ro) a.classList.add("pbbind-ro"); } g.appendChild(a); }); });
    }
  }
  /* أي صفحة مرتبطة بمنتج (أصلية مفتوحة من المنتج/الرئيسية، أو صفحة هبوط «مرتبطة بمنتج») تُربط عناصرها ببيانات ذلك المنتج */
  const bindOf = page => { if (!page) return null; if (page.origin && (page.origin.raw || page.origin.native)) return page.origin; if (page.product) return { kind: "product", slug: page.product, raw: true, noTitle: true }; return null; };
  /* صفحة المنتج المفكَّكة: المعرض المحمي يملؤه سكربت الصفحة وقت التشغيل، فيُعرض هنا (للمعاينة فقط، ولا يُكتب في الملف) بصور المنتج من إعداداته */
  function fillGallery(root, page) {
    const og = page && page.origin; if (!og || !og.native || og.kind !== "product") return; const p = get(og.slug); if (!p || !(p.images || []).length) return;
    const m = root.querySelector("#gmain"); if (m && (!m.getAttribute("src") || /placeholder/.test(m.getAttribute("src")))) m.setAttribute("src", p.images[0]);
    const t = root.querySelector(".gthumbs:not([data-fixed])"); if (t && !t.children.length) { t.innerHTML = p.images.map((x, i) => `<img src="${esc(x)}" alt=""${i === 0 ? ' class="on"' : ""}>`).join(""); t.setAttribute("data-fixed", "1"); }
  }
  /* بعد كل رسم للقماش */
  function after(root, page) {
    const og = bindOf(page); if (!og) return;
    fillGallery(root, page);
    if (og.raw !== false) applyTo(root, { kind: og.kind, slug: og.slug, rel: "", mark: true, noTitle: og.noTitle, ro: og.kind === "product" && !official(og.slug, page) });
    const d = root.ownerDocument;
    if (!d.getElementById("pbbind-css")) { const st = d.createElement("style"); st.id = "pbbind-css"; st.textContent = ".pbbind{outline:2px dashed #0e9f8e!important;outline-offset:3px;cursor:pointer!important;position:relative}.pbbind-ro{outline-color:#9ca3af!important}.pbbind:hover{outline-color:#f59e0b!important;background-image:linear-gradient(rgba(14,159,142,.07),rgba(14,159,142,.07))}"; d.head.appendChild(st); }
    if (!root._pbb) { root._pbb = true; root.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-pbbind]"); if (!b) return; e.preventDefault(); e.stopPropagation(); openModal(b.getAttribute("data-pbbind")); }, true); }
  }
  /* تثبيت القيم الحالية داخل كود قسم (عند الحفظ) كي يطابق الملف بيانات المنتج */
  function bake(code, og) {
    if (!og || !og.raw) return code;
    if (/^(?:(?!id="(?:pprice|pold|psave|offers|gmain|grid|bestsellers-grid)").)*$/s.test(code) && !/<h1/.test(code)) return code;
    const d = new DOMParser().parseFromString("<body>" + code + "</body>", "text/html");
    applyTo(d.body, { kind: og.kind, slug: og.slug, rel: og.kind === "home" ? "" : "../../", mark: false, noTitle: og.noTitle });
    return d.body.innerHTML;
  }
  /* نافذة بيانات المنتج */
  function openModal(slug) {
    const p = draft(slug); if (!p) return toast("المنتج غير موجود في اللوحة");
    document.getElementById("pbb-m") && document.getElementById("pbb-m").remove();
    const m = document.createElement("div"); m.id = "pbb-m"; m.style.cssText = "position:fixed;inset:0;z-index:2147483100;background:rgba(10,20,16,.55);display:grid;place-items:center;padding:14px;direction:rtl;font-family:inherit";
    const inp = "width:100%;border:1.5px solid #d9d2c2;border-radius:8px;padding:.5rem;font:inherit;box-sizing:border-box";
    const pg = PBApp.E.page, isHome = pg && pg.origin && pg.origin.kind === "home";
    let draw = () => {
      const ok = isHome || official(slug, pg);
      m.innerHTML = `<div style="background:#fff;border-radius:18px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:1.2rem;box-shadow:0 30px 80px rgba(0,0,0,.4)">${ok ? "" : `<div style="background:#fff4e5;border:1px solid #f5d199;border-radius:10px;padding:.6rem .8rem;margin-bottom:.7rem;font-size:.85rem">⚠️ هذه ليست الصفحة الرسمية للمنتج، فتُعرض بياناته للقراءة فقط.<br><button data-a="mkoff" style="margin-top:.4rem;border:0;background:#173f35;color:#fff;border-radius:8px;padding:.35rem .8rem;font:inherit;font-weight:800;cursor:pointer">📄 اجعل هذه الصفحة هي الرسمية</button></div>`}
<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0;color:#173f35">🔗 بيانات المنتج</h3><button data-a="done" style="border:0;background:#173f35;color:#fff;border-radius:10px;padding:.45rem 1rem;font:inherit;font-weight:800;cursor:pointer">تم ✓</button></div>
<p style="margin:.3rem 0 .8rem;color:#666;font-size:.82rem">هذه بيانات المنتج نفسه: ما تغيّره هنا يظهر في الصفحة فوراً، وعند «حفظ ونشر» يتغيّر المنتج في المتجر والطلبات وكل مكان.</p>
<label style="font-weight:700;font-size:.85rem">الاسم</label><input data-f="title" value="${esc(p.title)}" style="${inp};margin-bottom:.6rem">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.6rem"><div><label style="font-weight:700;font-size:.85rem">السعر (دج)</label><input data-f="price" type="number" value="${esc(p.price)}" style="${inp}"></div><div><label style="font-weight:700;font-size:.85rem">السعر القديم (اختياري)</label><input data-f="old" type="number" value="${esc(p.old || "")}" style="${inp}"></div></div>
<b style="font-size:.85rem">العروض</b>${(p.offers || []).map((o, i) => `<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:.4rem;margin:.3rem 0;align-items:center"><input data-o="${i}" data-k="qty" type="number" value="${esc(o.qty)}" title="الكمية" style="${inp}"><input data-o="${i}" data-k="price" type="number" value="${esc(o.price)}" title="السعر" style="${inp}"><input data-o="${i}" data-k="free" type="number" value="${esc(o.free || 0)}" title="مجاني" style="${inp}"><button data-a="odel" data-i="${i}" style="border:0;background:#fbe9e7;color:#b3261e;border-radius:8px;padding:.4rem .6rem;cursor:pointer">✕</button></div>`).join("")}<div style="font-size:.72rem;color:#888">الكمية · السعر · عدد المجاني</div><button data-a="oadd" style="margin:.3rem 0 .8rem;border:1.5px dashed #bbb;background:#faf8f3;border-radius:8px;padding:.35rem .8rem;cursor:pointer;font:inherit">＋ عرض</button>
<div style="background:#f4efe6;border-radius:10px;padding:.6rem .8rem;font-size:.82rem;color:#555;margin-top:.4rem">🖼️ صورة المنتج وصور معرضه تُختار من <b>إعدادات المنتج</b> فقط — وصور هذه الصفحة مستقلة عنها.<br><button data-a="prodset" style="margin-top:.4rem;border:0;background:#173f35;color:#fff;border-radius:8px;padding:.35rem .8rem;font:inherit;font-weight:800;cursor:pointer">⚙️ فتح إعدادات المنتج</button></div></div>`;
    };
    const refresh = () => { try { PBApp.renderCanvas(); PBApp.E.dirty = true; } catch (e) { } };
    m.addEventListener("input", e => { const t = e.target; if (t.dataset.f) { p[t.dataset.f] = t.type === "number" ? (t.value === "" ? "" : +t.value) : t.value; if (t.dataset.f === "old" && t.value === "") delete p.old; } else if (t.dataset.o !== undefined) { p.offers[+t.dataset.o][t.dataset.k] = +t.value; } else return; if (t.dataset.f === "price" || t.dataset.f === "title" || t.dataset.f === "old" || t.dataset.o !== undefined) refresh(); });
    m.addEventListener("click", async e => { const b = e.target.closest("button"); if (!b) { if (e.target === m) m.remove(); return; } const a = b.dataset.a, i = +b.dataset.i;
      if (a === "done") { m.remove(); return; }
      if (a === "mkoff") { if (pg.origin) delete p.officialPage; else p.officialPage = pg.slug; draw(); refresh(); return; }
      if (a === "oadd") (p.offers = p.offers || []).push({ qty: 1, price: p.price }); else if (a === "odel") p.offers.splice(i, 1);
      else if (a === "prodset") { try { Admin.tab("products", [...document.querySelectorAll(".nav-btn")].find(x => /المنتجات/.test(x.textContent))); } catch (e) { } try { Admin.editProduct(slug); } catch (e) { } return; }
      draw(); refresh(); });
    const draw0 = draw; draw = () => { draw0(); if (!(isHome || official(slug, pg))) m.querySelectorAll("input,[data-a=oadd],[data-a=odel]").forEach(x => { x.disabled = true; x.style.opacity = ".55"; }); };
    document.body.appendChild(m); draw();
  }
  /* عند الحفظ: يكتب التغييرات في المنتج نفسه (data.js) */
  async function commit() {
    const A = prods(); let n = 0;
    Object.keys(cache).forEach(slug => { if (JSON.stringify(cache[slug]) !== orig[slug]) { const i = A.findIndex(x => x.slug === slug); if (i >= 0) { A[i] = cache[slug]; n++; } } });
    if (!n) return;
    const ok = await Admin.publishDataJs(); if (ok) { try { Admin.renderAll && Admin.renderAll(); } catch (e) { } toast("✅ تحدّثت بيانات " + n + " منتج في المتجر كله"); }
    Object.keys(cache).forEach(slug => { orig[slug] = JSON.stringify(cache[slug]); });
  }
  const reset = () => { cache = {}; orig = {}; };
  const list = () => prods().map(x => cache[x.slug] || x);
  /* نسخة من الصفحة بقيم المنتج مثبّتة داخل أكواد HTML (لنشر صفحات الهبوط المرتبطة بمنتج) */
  function bakePage(P) {
    const og = bindOf(P); if (!og || P.origin) return P; const c = JSON.parse(JSON.stringify(P));
    (c.sections || []).forEach(sec => (sec.cols || []).forEach(col => (col.widgets || []).forEach(w => { if (w.type === "html" && w.set && w.set.code) w.set.code = bake(w.set.code, Object.assign({}, og, { kind: "product" })); })));
    return c;
  }
  return { after, bake, bakePage, commit, reset, openModal, list };
})();

/* ═════════════════════════════════════════════════════════════════
   PBEd — تعديل عناصر الصفحة الأصلية في مكانها دون المساس بهيكلها
   انقر أي عنصر (نص/صورة/زر/رابط/صندوق) داخل كتلة من الصفحة الأصلية فتظهر لوحة «العنصر المحدد»: النص، الصورة، الرابط، الألوان، الحجم، الإخفاء،
   التحريك والتكرار والحذف. نقرتان على نص = تعديله مباشرة. كل تعديل يُكتب في كود الكتلة نفسه فيبقى الهيكل كما هو.
   ═════════════════════════════════════════════════════════════════ */
const PBEd = (() => {
  const A = () => PBApp, esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const INL = /^(B|STRONG|I|EM|U|SPAN|SMALL|MARK|BR|S|DEL|SUB|SUP|CODE|LABEL)$/, toast = m => { try { window.toast(m); } catch (e) { } };
  let sel = null, root = null, panel = null, hv = null, tm = 0, guard = 0, mob = false;
  /* «الجوال فقط»: تُكتب القيمة في قاعدة @media داخل <style data-pbm-css> في كتلة الصفحة، وتُربط بالعنصر عبر data-pbm */
  const kebab = k => k.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
  const mobMap = tpl => { const st = tpl.querySelector(":scope > style[data-pbm-css]"); let m = {}; if (st) { try { m = JSON.parse(st.getAttribute("data-map") || "{}"); } catch (e) { } } return m; };
  const mobSave = (tpl, m) => {
    let st = tpl.querySelector(":scope > style[data-pbm-css]"); Object.keys(m).forEach(id => { if (!Object.keys(m[id]).length) delete m[id]; });
    if (!Object.keys(m).length) { if (st) st.remove(); return; }
    if (!st) { st = document.createElement("style"); st.setAttribute("data-pbm-css", ""); tpl.appendChild(st); }
    st.setAttribute("data-map", JSON.stringify(m));
    st.textContent = "@media(max-width:" + PB.BP.m + "px){" + Object.entries(m).map(([id, p]) => `html body [data-pbm="${id}"][data-pbm="${id}"][data-pbm="${id}"]{` + Object.entries(p).map(([k, v]) => k + ":" + v + "!important").join(";") + "}").join("") + "}";
  };
  const mobSet = (el, tpl, css, val) => {
    const m = mobMap(tpl); let id = el.getAttribute("data-pbm"); if (!id) { id = "m" + Math.random().toString(36).slice(2, 7); el.setAttribute("data-pbm", id); }
    m[id] = m[id] || {}; val === "" || val == null ? delete m[id][css] : m[id][css] = val; if (!Object.keys(m[id]).length) el.removeAttribute("data-pbm"); mobSave(tpl, m);
  };
  const mobGet = (el, tpl, css) => { const id = el.getAttribute("data-pbm"); return id ? ((mobMap(tpl)[id] || {})[css] || "") : ""; };
  const kidsOf = el => [...el.children].filter(c => c.tagName !== "SCRIPT" && !c.hasAttribute("data-pbm-css"));
  const rawOf = el => el.closest && el.closest(".pb-raw");
  const widOf = r => { const w = r.closest("[data-pb]"); return w ? w.getAttribute("data-pb") : null; };
  const isOrig = wid => { const inf = wid && A().find(wid); return !!(inf && inf.node.type === "html"); };      // أي كتلة HTML (أصلية أو منسوخة أو مضافة) تُعدَّل عناصرها بالنقر
  const pathOf = (el, r) => { const p = []; while (el && el !== r) { const par = el.parentElement; p.unshift(kidsOf(par).indexOf(el)); el = par; } return p; };
  const resolve = (base, path) => { let el = base; for (const i of path) { el = kidsOf(el)[i]; if (!el) return null; } return el; };
  const inlineOnly = el => [...el.children].every(c => INL.test(c.tagName) || c.tagName === "A");
  const hex = c => { const m = String(c || "").match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] === 0)) return ""; return "#" + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, "0")).join(""); };
  const clean = html => { const d = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html"); d.body.querySelectorAll("script,iframe,object,embed").forEach(n => n.remove()); d.body.querySelectorAll("*").forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name); })); return d.body.innerHTML; };
  const pick = (t, r) => { let el = t; while (el && el !== r && INL.test(el.tagName) && el.parentElement && el.parentElement !== r) el = el.parentElement; return el === r ? null : el; };
  const canvasEl = () => { if (!sel || !root) return null; const r = root.querySelector(`[data-pb="${sel.wid}"] .pb-raw`); return r ? resolve(r, sel.path) : null; };
  const codeDom = wid => { const inf = A().find(wid); if (!inf) return null; const tpl = document.createElement("div"); tpl.innerHTML = inf.node.set.code || ""; return { inf, tpl }; };
  function mutate(fn, keepPanel) {
    if (!sel) return; const c = codeDom(sel.wid); if (!c) return; const el = resolve(c.tpl, sel.path); if (!el) return;
    fn(el, c.tpl); c.inf.node.set.code = c.tpl.innerHTML; A().E.dirty = true; guard = Date.now(); A().commitAfter(sel.wid); if (!keepPanel) show();
  }
  function mark() {
    if (!root) return; root.querySelectorAll(".pbed-sel").forEach(x => x.classList.remove("pbed-sel"));
    const ce = canvasEl(); if (ce) ce.classList.add("pbed-sel");
  }
  function select(wid, path) { sel = { wid, path }; mark(); show(); }
  function hide() { sel = null; if (root) root.querySelectorAll(".pbed-sel,.pbed-hv").forEach(x => x.classList.remove("pbed-sel", "pbed-hv")); if (panel) { panel.remove(); panel = null; } }
  const colorRow = (k, lbl, val, def) => `<div class="pe-f"><span>${lbl}</span><div class="pe-c"><input type="color" data-k="${k}" value="${/^#[0-9a-f]{6}$/i.test(val || def) ? (val || def) : "#000000"}"><button type="button" data-clr="${k}" title="إرجاع الافتراضي">افتراضي</button><i>${val || "—"}</i></div></div>`;
  function show() {
    if (!sel) return; const c = codeDom(sel.wid); const el = c && resolve(c.tpl, sel.path); if (!el) return hide();
    const sv = k => mob ? mobGet(el, c.tpl, kebab(k)) : el.style[k];
    const ce = canvasEl(), cs = ce ? ce.ownerDocument.defaultView.getComputedStyle(ce) : null, tag = el.tagName;
    const isImg = tag === "IMG", isA = tag === "A", textual = !isImg && inlineOnly(el) && (el.textContent || "").trim().length > 0 && tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA";
    const crumbs = []; { let p = sel.path.slice(); const names = []; let cur = c.tpl; names.push("كتلة"); p.forEach(i => { cur = kidsOf(cur)[i]; names.push(cur ? cur.tagName.toLowerCase() : "?"); }); crumbs.push(names.slice(-4).join(" › ")); }
    const html = `<div class="pe-h"><b>🎯 العنصر المحدد</b><code dir="ltr">${esc(crumbs[0])}</code><button type="button" data-a="x" title="إغلاق">✕</button></div>
<label class="pe-k pe-mob${mob ? " on" : ""}"><input type="checkbox" data-mob${mob ? " checked" : ""}> 📱 تغيير على الجوال فقط</label>${mob ? '<div class="pe-n" style="margin:-.2rem 0 .3rem">الألوان والأحجام والإخفاء التي تغيّرها الآن تنطبق على شاشة الجوال وحدها؛ النص والصورة والرابط يبقون واحداً للجميع.</div>' : ""}
${textual ? `<label class="pe-l">النص (يقبل <b>غامق</b> وروابط)<textarea data-k="html" rows="3"${mob ? " disabled" : ""}>${esc(el.innerHTML)}</textarea></label>` : ""}
${isImg ? `<label class="pe-l">الصورة<input data-k="src"${mob ? " disabled" : ""} dir="ltr" value="${esc(el.getAttribute("src") || "")}"></label><div class="pe-r"><button type="button" data-a="lib">📚 المكتبة</button><button type="button" data-a="up">⬆ رفع صورة</button></div><label class="pe-l">نص بديل (SEO)<input data-k="alt"${mob ? " disabled" : ""} value="${esc(el.getAttribute("alt") || "")}"></label>` : ""}
${isA || el.querySelector(":scope > a") ? "" : ""}${isA ? `<label class="pe-l">الرابط<input data-k="href"${mob ? " disabled" : ""} dir="ltr" value="${esc(el.getAttribute("href") || "")}"></label>` : ""}
<div class="pe-g">${colorRow("color", "لون النص", sv("color") ? hex(sv("color")) || sv("color") : "", cs ? hex(cs.color) : "#000000")}${colorRow("backgroundColor", "لون الخلفية", sv("backgroundColor") ? hex(sv("backgroundColor")) || sv("backgroundColor") : "", cs ? hex(cs.backgroundColor) : "#ffffff")}</div>
<div class="pe-g"><label class="pe-l">حجم الخط (px)<input data-k="fontSize" type="number" min="8" max="120" value="${parseFloat(sv("fontSize")) || ""}" placeholder="${cs ? Math.round(parseFloat(cs.fontSize)) : ""}"></label>
<label class="pe-l">السماكة<select data-k="fontWeight">${[["", "—"], ["400", "عادي"], ["600", "شبه عريض"], ["700", "عريض"], ["900", "أسود"]].map(o => `<option value="${o[0]}"${sv("fontWeight") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
<label class="pe-l">المحاذاة<select data-k="textAlign">${[["", "—"], ["start", "بداية"], ["center", "وسط"], ["end", "نهاية"]].map(o => `<option value="${o[0]}"${sv("textAlign") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
<label class="pe-l">تدوير الزوايا (px)<input data-k="borderRadius" type="number" min="0" max="200" value="${parseFloat(sv("borderRadius")) || ""}"></label>
<label class="pe-l">العرض (مثل 320px أو 60%)<input data-k="width" dir="ltr" value="${esc(sv("width"))}" placeholder="${ce ? Math.round(ce.getBoundingClientRect().width) + "px" : ""}"></label>
<label class="pe-l">الارتفاع<input data-k="height" dir="ltr" value="${esc(sv("height"))}" placeholder="${ce ? Math.round(ce.getBoundingClientRect().height) + "px" : ""}"></label>
<label class="pe-l">مسافة داخلية (px)<input data-k="padding" type="number" min="0" max="200" value="${parseFloat(sv("padding")) || ""}"></label>
<label class="pe-l">مسافة خارجية علوية (px)<input data-k="marginTop" type="number" min="-100" max="300" value="${sv("marginTop") ? parseFloat(sv("marginTop")) : ""}"></label></div>
<label class="pe-k"><input type="checkbox" data-k="hide"${sv("display") === "none" ? " checked" : ""}> إخفاء هذا العنصر</label>
<div class="pe-r"><button type="button" data-a="up1" title="تحريك لأعلى (قبل الأخ السابق)">▲</button><button type="button" data-a="dn1" title="تحريك لأسفل">▼</button><button type="button" data-a="dup" title="تكرار">⧉ تكرار</button><button type="button" data-a="par" title="تحديد العنصر الأب">⬆ الأب</button><button type="button" data-a="del" class="red" title="حذف">🗑 حذف</button></div>
<div class="pe-n">نقرتان على النص = تعديله مباشرة. العناصر المرتبطة بالمنتج (الاسم والسعر والعروض) تفتح «بيانات المنتج».</div>`;
    if (!panel) { panel = document.createElement("div"); panel.id = "pbed"; document.body.appendChild(panel); wire(); }
    panel.innerHTML = html;
  }
  function wire() {
    if (!document.getElementById("pbed-css")) { const st = document.createElement("style"); st.id = "pbed-css"; st.textContent = `#pbed{position:fixed;left:8px;top:74px;width:304px;max-height:calc(100vh - 90px);overflow:auto;z-index:10030;background:#fff;border:2px solid #0e9f8e;border-radius:14px;padding:.6rem .7rem;direction:rtl;font-family:inherit;font-size:.82rem;box-shadow:0 12px 40px rgba(0,0,0,.3)}
#pbed .pe-h{display:flex;align-items:center;gap:.4rem;margin-bottom:.4rem}#pbed .pe-h code{flex:1;font-size:.66rem;color:#0e9f8e;background:#e8f7f5;border-radius:6px;padding:.1rem .35rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#pbed .pe-h button{border:0;background:#f1efe9;border-radius:50%;width:26px;height:26px;cursor:pointer}
#pbed .pe-l{display:block;font-weight:700;color:#173f35;margin:.3rem 0 0;font-size:.74rem}#pbed .pe-l input,#pbed .pe-l textarea,#pbed .pe-l select{display:block;width:100%;box-sizing:border-box;border:1.5px solid #d9d2c2;border-radius:7px;padding:.3rem .4rem;font:inherit;font-weight:400;margin-top:.12rem}
#pbed .pe-g{display:grid;grid-template-columns:1fr 1fr;gap:0 .5rem}#pbed .pe-f{margin-top:.3rem;grid-column:span 2}#pbed .pe-f>span{font-weight:700;color:#173f35;font-size:.74rem;display:block}#pbed .pe-c{display:flex;align-items:center;gap:.4rem}#pbed .pe-c input{width:42px;height:28px;padding:0;border:1px solid #d9d2c2;border-radius:6px}#pbed .pe-c button{border:0;background:#f1efe9;border-radius:6px;padding:.2rem .5rem;cursor:pointer;font:inherit;font-size:.7rem}#pbed .pe-c i{font-size:.68rem;color:#888;font-style:normal;direction:ltr}
#pbed .pe-k{display:flex;gap:.4rem;align-items:center;margin:.5rem 0;font-weight:700}#pbed .pe-r{display:flex;flex-wrap:wrap;gap:.3rem;margin:.35rem 0}#pbed .pe-r button{flex:1;border:1.5px solid #d9d2c2;background:#faf8f3;border-radius:8px;padding:.3rem .4rem;cursor:pointer;font:inherit;font-weight:700;white-space:nowrap}#pbed .pe-r button.red{color:#b3261e;border-color:#f0c4c0;background:#fdf1f0}#pbed .pe-mob{background:#eef6ff;border-radius:8px;padding:.35rem .5rem}#pbed .pe-mob.on{background:#ffe9cc}#pbed .pe-n{font-size:.68rem;color:#8a8472;line-height:1.6;margin-top:.3rem}`; document.head.appendChild(st); }
    const dbn = (fn) => { clearTimeout(tm); tm = setTimeout(fn, 350); };
    panel.addEventListener("change", e => { if (e.target.dataset && e.target.dataset.mob !== undefined) { mob = e.target.checked; try { A().setDev(mob ? "m" : "d"); } catch (x) { } show(); } });
    panel.addEventListener("input", e => {
      const t = e.target, k = t.dataset && t.dataset.k; if (!k) return;
      if (t.type === "color") { const i = t.parentNode.querySelector("i"); if (i) i.textContent = t.value; }
      const run = () => mutate((el, tpl) => {
        if (k === "html") el.innerHTML = clean(t.value);
        else if (k === "src") { el.setAttribute("src", t.value.trim()); el.removeAttribute("srcset"); el.removeAttribute("sizes"); const pic = el.parentElement; if (pic && pic.tagName === "PICTURE") pic.querySelectorAll("source").forEach(s => s.remove()); }
        else if (k === "alt") el.setAttribute("alt", t.value);
        else if (k === "href") el.setAttribute("href", t.value.trim());
        else if (mob && k === "hide") { mobSet(el, tpl, "display", t.checked ? "none" : ""); }
        else if (k === "hide") { t.checked ? el.style.setProperty("display", "none") : el.style.removeProperty("display"); }
        else if (mob) { let v = t.value; if (["fontSize", "borderRadius", "padding", "marginTop"].includes(k) && v !== "") v += "px"; mobSet(el, tpl, kebab(k), v); }
        else { let v = t.value; if (["fontSize", "borderRadius", "padding", "marginTop"].includes(k) && v !== "") v += "px"; const css = k.replace(/[A-Z]/g, m => "-" + m.toLowerCase()); v === "" ? el.style.removeProperty(css) : el.style.setProperty(css, v); if (!el.getAttribute("style")) el.removeAttribute("style"); }
      }, true);
      t.tagName === "SELECT" || t.type === "checkbox" || t.type === "color" ? run() : dbn(run);
    });
    panel.addEventListener("click", async e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.clr) { const css = b.dataset.clr.replace(/[A-Z]/g, m => "-" + m.toLowerCase()); mutate((el, tpl) => { if (mob) return mobSet(el, tpl, css, ""); el.style.removeProperty(css); if (!el.getAttribute("style")) el.removeAttribute("style"); }); return; }
      const a = b.dataset.a; if (!a) return;
      if (a === "x") return hide();
      if (a === "lib") { const r = await A().openLibrary(false); if (r && r[0]) mutate(el => { el.setAttribute("src", r[0]); el.removeAttribute("srcset"); el.removeAttribute("sizes"); const pic = el.parentElement; if (pic && pic.tagName === "PICTURE") pic.querySelectorAll("source").forEach(s => s.remove()); }); return; }
      if (a === "up") { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = async () => { const f = inp.files[0]; if (!f) return; toast("⏳ جارِ رفع الصورة…"); try { const pth = await A().uploadBlob(f, "pg-" + Date.now().toString(36), { max: 1800, q: .88 }); mutate(el => { el.setAttribute("src", pth); el.removeAttribute("srcset"); el.removeAttribute("sizes"); const pic = el.parentElement; if (pic && pic.tagName === "PICTURE") pic.querySelectorAll("source").forEach(s => s.remove()); }); toast("✅ رُفعت الصورة"); } catch (er) { toast("❌ " + er.message); } }; inp.click(); return; }
      if (a === "par") { if (sel.path.length) { sel.path = sel.path.slice(0, -1); mark(); show(); } return; }
      if (a === "del") { const p = sel.path.slice(); mutate(el => { el.remove(); }, true); sel.path = p.slice(0, -1); if (!p.length) return hide(); mark(); show(); return; }
      if (a === "dup") { mutate(el => { const cl = el.cloneNode(true); cl.removeAttribute("id"); cl.querySelectorAll("[id]").forEach(n => n.removeAttribute("id")); el.after(cl); }, true); sel.path = sel.path.slice(0, -1).concat(sel.path[sel.path.length - 1] + 1); mark(); show(); return; }
      if (a === "up1" || a === "dn1") { const d = a === "up1" ? -1 : 1, last = sel.path[sel.path.length - 1]; let moved = false; mutate(el => { const ks = kidsOf(el.parentElement), j = ks.indexOf(el) + d; if (j < 0 || j >= ks.length) return; d < 0 ? ks[j].before(el) : ks[j].after(el); moved = true; }, true); if (moved) sel.path = sel.path.slice(0, -1).concat(last + d); mark(); show(); }
    });
    const iv = setInterval(() => { if (!panel) return clearInterval(iv); const on = document.getElementById("pb-app"); if (!on || !on.classList.contains("on")) hide(); }, 800);
  }
  function target(e) { const t = e.target; if (!t || !t.closest) return null; const r = rawOf(t); if (!r) return null; const wid = widOf(r); if (!wid || !isOrig(wid)) return null; if (t.closest("[data-pbbind]")) return null; return { t, r, wid }; }
  function onClick(e) {
    const x = target(e); if (!x || x.t.closest("[contenteditable=true]")) return;
    const el = pick(x.t, x.r); if (!el) return; e.preventDefault(); select(x.wid, pathOf(el, x.r));
  }
  function onDbl(e) {
    const x = target(e); if (!x) return; const el = pick(x.t, x.r); if (!el || !inlineOnly(el) || !(el.textContent || "").trim() || el.tagName === "IMG") return;
    e.preventDefault(); e.stopPropagation(); const path = pathOf(el, x.r); select(x.wid, path);
    el.setAttribute("contenteditable", "true"); el.focus();
    const done = () => { el.removeEventListener("blur", done); el.removeAttribute("contenteditable"); const html = clean(el.innerHTML); sel = { wid: x.wid, path }; mutate(c => { c.innerHTML = html; }); };
    el.addEventListener("blur", done); el.addEventListener("keydown", k => { if (k.key === "Escape") el.blur(); });
  }
  function onOver(e) { const x = target(e); if (hv) { hv.classList.remove("pbed-hv"); hv = null; } if (!x) return; const el = pick(x.t, x.r); if (el && !el.classList.contains("pbed-sel")) { el.classList.add("pbed-hv"); hv = el; } }
  function after(rt, page) {
    if (!page) { if (panel) hide(); return; }
    root = rt; const d = rt.ownerDocument;
    if (!d.getElementById("pbed-css")) { const st = d.createElement("style"); st.id = "pbed-css"; st.textContent = ".pbed-sel{outline:2px solid #0e9f8e!important;outline-offset:2px;position:relative}.pbed-hv{outline:1.5px dashed #f59e0b!important;outline-offset:1px;cursor:pointer}[contenteditable=true]{outline:2px solid #f59e0b!important;background:rgba(245,158,11,.08)!important;cursor:text!important}"; d.head.appendChild(st); }
    if (!rt._ped) { rt._ped = true; rt.addEventListener("click", onClick, true); rt.addEventListener("dblclick", onDbl, true); rt.addEventListener("mouseover", onOver); }
    if (sel) { if (!isOrig(sel.wid)) hide(); else mark(); }
  }
  return { after, hide, select };
})();
