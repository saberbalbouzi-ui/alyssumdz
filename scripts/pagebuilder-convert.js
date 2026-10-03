/* ═════════════════════════════════════════════════════════════════
   فتح صفحة المنتج أو الصفحة الرئيسية في «مطوّر الصفحات» بشكلها الأصلي (PBConvert)
   • زر «تعديل» في شريط المعاينة وفي قائمة الصفحات ← تُفتح الصفحة كما هي: كل كتلة من الصفحة (الشريط العلوي، الهيدر، أقسام المحتوى، الفوتر)
     قسم في المطوّر يحمل HTML الأصل نفسه وأنماطه، فيطابق الشكل الأصلي، ويمكن تحريك الأقسام وحذفها وتعديل كودها وإضافة عناصر المطوّر بينها.
   • «حفظ ونشر» ← حفظ مباشر (يُعاد بناء الصفحة الأصلية نفسها بالأقسام المعدَّلة مع بقاء رأسها وسكربتاتها: السلة والمعرض وغيرها)
     أو نسخة جديدة /lp/… أو استرجاع الأصل.
   ═════════════════════════════════════════════════════════════════ */
const PBBind_after = (root, page) => PBBind.after(root, page);
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
  /* يقرأ الصفحة الأصلية (ملفها كما هو) ويحوّلها إلى صفحة مطوّر: قسم لكل كتلة بنفس HTML الأصل + أنماطها */
  /* يرسم الصفحة في iframe خفي بعرض الحاسوب (لتشغيل جافاسكربتها وقراءة الأنماط المحسوبة) */
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
    const rel = u => { try { const x = new URL(u, doc.baseURI); if (x.origin !== new URL(doc.baseURI).origin) return x.href; return decodeURIComponent(x.pathname.replace(/^\//, "")) + x.search; } catch (e) { return u; } };
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
    const rawKeep = c => !!c.querySelector("#grid,#bestsellers-grid,.shop-cats");

    function widgetsOf(el, out) {
      if (skip(el)) return;
      const tag = el.tagName;
      if (o.kind === "product" && isOrder(el)) { if (!sawOrder) { sawOrder = true; out.push(mkW("orderorig", { prod: o.slug, raw: rawOrder })); } return; }
      if (o.kind === "product") {
        if (el.id === "offers" || (el.querySelector("#offers") && !el.querySelector("h1,h2,form,#gmain,#pprice") && txt(el).length < 400)) { out.push(mkW("poffers", { prod: o.slug })); return; }
        if (el.id === "pprice" || (el.querySelector("#pprice") && !el.querySelector("h1,h2,img,#offers,form") && txt(el).length < 120)) { out.push(mkW("pprice", { prod: o.slug })); return; }
        if (el.querySelector("#gmain") && !el.querySelector("h1,h2,form,#offers,#pprice")) { out.push(mkW("pgallery", { prod: o.slug })); return; }
      }
      if (/^H[1-6]$/.test(tag)) { const t = txt(el); if (!t) return; const w = mkW("heading", { text: t, tag: tag.toLowerCase(), bindTitle: o.kind === "product" && tag === "H1", prod: o.kind === "product" ? o.slug : "", fs: { d: px(el, 32), m: Math.max(18, Math.round(px(el, 32) * (px(el, 32) > 30 ? .72 : .9))) }, ta: { d: ta(el) } }); const c = colorOf(el); if (c) w.set.color = c; out.push(w); return; }
      if (tag === "IMG") { const r = el.getBoundingClientRect(); const src = el.currentSrc || el.src || ""; if (!src || r.width < 110 || el.closest("[class*=thumb]") || seen.has(src) || /placeholder|\.svg(\?|$)|data:image\/svg/i.test(src)) return; seen.add(src); out.push(mkW("image", { src: rel(src), alt: el.alt || "", fit: "cover" })); return; }
      if (tag === "PICTURE") { const i = el.querySelector("img"); if (i) widgetsOf(i, out); return; }
      if (tag === "VIDEO" || (tag === "IFRAME" && /youtube|vimeo/i.test(el.src))) { const u = el.src || (el.querySelector("source") || {}).src || ""; if (u) out.push(mkW("video", { url: u, ratio: "16/9" })); return; }
      if (tag === "UL" || tag === "OL") { const li = [...el.children].filter(c => c.tagName === "LI" && txt(c)); if (li.length && li.every(x => !hasBlock(x))) { out.push(mkW("bullets", { items: li.map(txt).join("\n"), mk: tag === "OL" ? "dec" : "check", fs: { d: px(li[0], 17) } })); return; } }
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
      const s = cs(el), k = kids(el);
      if (k.length < 2 || k.length > 4) return null;
      const row = (s.display === "grid" && s.gridTemplateColumns.split(" ").length >= 2) || (s.display === "flex" && !/column/.test(s.flexDirection));
      if (!row) return null;
      const cols = k.map(c => { const w = []; widgetsOf(c, w); return w; }).filter(w => w.length);
      return cols.length >= 2 ? cols : null;
    }
    function sectionOf(el, hint) {
      let inner = el, safe = 0;
      while (safe++ < 4) { const k = kids(inner); if (k.length === 1 && !/^(IMG|H[1-6]|P|UL|OL|FORM)$/.test(k[0].tagName) && !isOrder(k[0])) inner = k[0]; else break; }
      let cols = columnsOf(inner); let cs_;
      if (!cols) { let found = null; const ks = kids(inner), gi = ks.findIndex(k => (found = columnsOf(k))); if (gi >= 0 && ks.length > 1) {      // قسم يضم كتلة أعمدة بين عناصر أخرى ← أقسام متتالية: ما قبلها، الأعمدة، ما بعدها
        const mk = (list) => { const w = []; list.forEach(c => widgetsOf(c, w)); return w.length ? mkS([mkC(w)], {}) : null; };
        const secsOut = [mk(ks.slice(0, gi)), mkS(found.map(w => mkC(w)), {}), mk(ks.slice(gi + 1))].filter(Boolean);
        const bg0 = hex(cs(el).backgroundColor); if (bg0) secsOut.forEach(x => { x.set.bg = bg0; }); return secsOut; } }
      if (cols) cs_ = cols.map(w => mkC(w)); else { const w = []; widgetsOf(inner, w); if (!w.length) return null; cs_ = [mkC(w)]; }
      const s = cs(el), set = {}, bg = hex(s.backgroundColor) || (hint && hint.bg) || ""; const gi = /gradient\(/.test(s.backgroundImage) ? ([...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => m[0]).filter(c => hex(c)).pop() || "") : ""; const b2 = bg || hex(gi);
      if (b2) set.bg = b2;
      const pt = Math.round(parseFloat(s.paddingTop) || 0), pb = Math.round(parseFloat(s.paddingBottom) || 0); set.pad = { d: [Math.max(16, pt), 20, Math.max(16, pb), 20], m: [Math.max(14, Math.round(pt * .6)), 16, Math.max(14, Math.round(pb * .6)), 16] };
      return mkS(cs_, set);
    }
    const root = doc.querySelector("main") || doc.body, secs = [];
    const rawSec = (c, idx) => { let el = c.id ? fdoc.getElementById(c.id) : null; if (!el) { const m = fdoc.querySelector("main"); el = m && m.children[idx]; } if (!el) return null; const sec = mkS([mkC([mkW("html", { code: el.outerHTML, src: "orig" })])], { layout: "full", pad: { d: [0, 0, 0, 0], m: [0, 0, 0, 0] }, gap: { d: 0 } }); sec.grp = "main"; return sec; };
    let loose = [];
    const flush = () => { if (!loose.length) return; const w = []; loose.forEach(c => widgetsOf(c, w)); if (w.length) secs.push(mkS([mkC(w)], {})); loose = []; };
    const all = [...root.children], top = all.flatMap(c => (c.matches(".container,#main,div") && kids(c).length > 1 && kids(c).every(x => x.matches("section,.hero,div[class*=sec],.container"))) ? kids(c) : [c]);
    top.forEach(c => {
      if (skip(c)) return;
      if (o.kind === "home" && rawKeep(c)) { flush(); const r = rawSec(c, all.indexOf(c)); if (r) secs.push(r); return; }
      if (c.matches("section,.container") || hex(cs(c).backgroundColor) || /gradient/.test(cs(c).backgroundImage) || c.matches(".hero,[class*=hero]")) { flush(); const s = sectionOf(c); if (s) secs.push(...[].concat(s)); } else loose.push(c);
    });
    flush();
    if (o.kind === "product" && !sawOrder) secs.push(mkS([mkC([mkW("orderorig", { prod: o.slug, raw: rawOrder })])], {}));
    secs.forEach(s => (s.cols || []).forEach(c => (c.widgets || []).forEach(w => { delete w._auto; })));
    return secs;
  }

  /* يقرأ الصفحة الأصلية: الشريط العلوي والهيدر والفوتر كتل HTML أصلية (تبقى بسلتها وقائمتها)، وأقسام المحتوى تُحوَّل إلى عناصر المطوّر القابلة للتعديل (مع ربطها ببيانات المنتج) */
  async function build(kind, slug, title) {
    const pth = path(kind, slug), f = await GH.getFile(pth), text = dec(f), doc = new DOMParser().parseFromString(text, "text/html"), from = siteBase() + pth;
    let css = "";
    doc.head.querySelectorAll("style").forEach(st => { css += absCss(st.textContent, from) + "\n"; });
    for (const l of doc.head.querySelectorAll('link[rel="stylesheet"]')) {
      const h = l.getAttribute("href") || ""; if (!h || /^(https?:)?\/\//.test(h)) continue;
      try { const u = new URL(h, from).href, r = await fetch(u); if (r.ok) css += absCss(await r.text(), u) + "\n"; } catch (e) { }
    }
    const AG = "#agent,[id^=agent],[class*=agent],#avatar,.avatar-bubble";      // الوكيل الذكي يُستثنى من المطوّر
    const raw = (grp, el) => { const sec = mkS([mkC([mkW("html", { code: el.outerHTML, src: "orig" })])], { layout: "full", pad: { d: [0, 0, 0, 0], m: [0, 0, 0, 0] }, gap: { d: 0 } }); sec.grp = grp; return sec; };
    const top = [], bot = [];
    [...doc.body.children].forEach(el => { if (el.matches("script,style,link,noscript,template," + AG)) return; const g = GROUP(el); if (g === "top") top.push(raw("top", el)); else if (g === "bot") bot.push(raw("bot", el)); });
    const fr = await render(kind === "home" ? "index.html" : "p/" + slug + "/");
    let main = []; try { main = convertMain(fr.contentDocument, { kind, slug }, doc); } finally { fr.remove(); }
    main.forEach(s => { s.grp = s.grp || "main"; });
    const page = newPage(title || "الصفحة الرئيسية", kind === "home" ? "home" : slug);
    page.sections = top.concat(main, bot); if (!page.sections.length) page.sections = [mkS([mkC([mkW("heading", { text: title || "صفحة" })])], {})];
    page.header = false; page.footer = false; page.css = css; page.bg = "transparent";
    const t = doc.title || ""; if (t) page.seoTitle = t.replace(/\s+—.*$/, "");
    const md = doc.querySelector('meta[name="description"]'); if (md) page.desc = md.content || "";
    if (kind === "product") page.product = slug;
    page.shell = text; page.origin = { kind, slug: kind === "home" ? "" : slug, direct: false, raw: false, native: true };
    return page;
  }
  /* زر «تعديل» ← يفتح الصفحة في المطوّر */
  async function edit(kind, slug) {
    if (kind === "home") slug = "";
    try { SitePreview.close(); } catch (e) { }
    toast("⏳ جارِ فتح الصفحة في المطوّر…");
    try {
      PBBind.reset(); const k = key(kind, slug); let page = null;
      try { const f = await GH.getFile("assets/pages/_conv/" + k + ".json"); const p = JSON.parse(dec(f)); if (p && p.origin && p.origin.direct && p.shell) page = p; } catch (e) { }      // نسخة محفوظة سابقاً (تُستعمل ما دامت هي المنشورة)
      if (!page) {
        const pr = kind === "product" ? (Admin.products || []).find(x => x.slug === slug) : null;
        if (kind === "product" && !pr) throw new Error("المنتج غير موجود");
        page = await build(kind, slug, pr ? pr.title : "الصفحة الرئيسية");
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
    if (o.kind === "product") {
      const p = get(o.slug); if (!p) return;
      const h1 = o.noTitle ? null : root.querySelector("h1"); if (h1 && p.title) { h1.textContent = p.title; mk(h1, o.slug); }
      if (simple(p)) {
        const pp = root.querySelector("#pprice"), po = root.querySelector("#pold"), ps = root.querySelector("#psave"), has = p.old && p.old > p.price;
        if (pp) { pp.textContent = fmt(p.price); mk(pp, o.slug); }
        if (po) { po.textContent = has ? fmt(p.old) : ""; po.style.display = has ? "" : "none"; mk(po, o.slug); }
        if (ps) { ps.textContent = has ? "وفّر " + Math.round((1 - p.price / p.old) * 100) + "%" : ""; ps.style.display = has ? "" : "none"; mk(ps, o.slug); }
      }
      const of = root.querySelector("#offers"); if (of && (p.offers || []).length) { of.innerHTML = offerCards(p); mk(of, o.slug); }
      const th = root.querySelector(".gthumbs"), main = root.querySelector("#gmain");
      if (th && !th.hasAttribute("data-static") && (p.images || []).length) { if (main) { main.src = o.rel + encodeURI(p.images[0]); mk(main, o.slug); } th.innerHTML = (p.images || []).map((s, i) => `<img src="${esc(o.rel + encodeURI(s))}" alt="${esc(p.title)}"${i === 0 ? ' class="on"' : ""}>`).join(""); mk(th, o.slug); }
      else if (main && (p.images || [])[0] && !(th && th.hasAttribute("data-static"))) { main.src = o.rel + encodeURI(p.images[0]); mk(main, o.slug); }
    } else {
      const ids = [["#bestsellers-grid", ps => ps.filter(p => (p.tags || []).includes("best")).slice(0, 8)], ["#grid", ps => ps]];
      ids.forEach(([sel, f]) => { const g = root.querySelector(sel); if (!g) return; const list = f(prods().map(x => get(x.slug)).filter(x => x && x.active !== false)); g.innerHTML = ""; list.forEach(p => { const a = document.createElement("div"); a.className = "card"; a.innerHTML = card(p, o.rel); if (o.mark) { a.setAttribute("data-pbbind", p.slug); a.classList.add("pbbind"); if (o.ro) a.classList.add("pbbind-ro"); } g.appendChild(a); }); });
    }
  }
  /* أي صفحة مرتبطة بمنتج (أصلية مفتوحة من المنتج/الرئيسية، أو صفحة هبوط «مرتبطة بمنتج») تُربط عناصرها ببيانات ذلك المنتج */
  const bindOf = page => { if (!page) return null; if (page.origin && (page.origin.raw || page.origin.native)) return page.origin; if (page.product) return { kind: "product", slug: page.product, raw: true, noTitle: true }; return null; };
  /* بعد كل رسم للقماش */
  function after(root, page) {
    const og = bindOf(page); if (!og) return;
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
<br><b style="font-size:.85rem">الصور (الأولى هي الغلاف)</b><div style="display:flex;flex-wrap:wrap;gap:.5rem;margin:.4rem 0">${(p.images || []).map((s, i) => `<div style="width:84px;text-align:center"><img src="${esc(s)}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid #ddd"><div style="display:flex;justify-content:center;gap:2px;margin-top:2px"><button data-a="imv" data-i="${i}" data-d="-1" style="border:0;background:#eee;border-radius:5px;cursor:pointer">◀</button><button data-a="imv" data-i="${i}" data-d="1" style="border:0;background:#eee;border-radius:5px;cursor:pointer">▶</button><button data-a="idel" data-i="${i}" style="border:0;background:#fbe9e7;color:#b3261e;border-radius:5px;cursor:pointer">✕</button></div></div>`).join("")}</div><button data-a="iadd" style="border:1.5px dashed #bbb;background:#faf8f3;border-radius:8px;padding:.35rem .8rem;cursor:pointer;font:inherit">＋ صورة من المكتبة / رفع</button></div>`;
    };
    const refresh = () => { try { PBApp.renderCanvas(); PBApp.E.dirty = true; } catch (e) { } };
    m.addEventListener("input", e => { const t = e.target; if (t.dataset.f) { p[t.dataset.f] = t.type === "number" ? (t.value === "" ? "" : +t.value) : t.value; if (t.dataset.f === "old" && t.value === "") delete p.old; } else if (t.dataset.o !== undefined) { p.offers[+t.dataset.o][t.dataset.k] = +t.value; } else return; if (t.dataset.f === "price" || t.dataset.f === "title" || t.dataset.f === "old" || t.dataset.o !== undefined) refresh(); });
    m.addEventListener("click", async e => { const b = e.target.closest("button"); if (!b) { if (e.target === m) m.remove(); return; } const a = b.dataset.a, i = +b.dataset.i;
      if (a === "done") { m.remove(); return; }
      if (a === "mkoff") { if (pg.origin) delete p.officialPage; else p.officialPage = pg.slug; draw(); refresh(); return; }
      if (a === "oadd") (p.offers = p.offers || []).push({ qty: 1, price: p.price }); else if (a === "odel") p.offers.splice(i, 1);
      else if (a === "idel") p.images.splice(i, 1); else if (a === "imv") { const j = i + +b.dataset.d; if (j >= 0 && j < p.images.length) [p.images[i], p.images[j]] = [p.images[j], p.images[i]]; }
      else if (a === "iadd") { const r = await PBApp.openLibrary(true); (r || []).forEach(x => { (p.images = p.images || []).push(x); }); }
      if (a !== "iadd" || true) { p.cover = (p.images || [])[0] || p.cover; draw(); refresh(); } });
    const draw0 = draw; draw = () => { draw0(); if (!(isHome || official(slug, pg))) m.querySelectorAll("input,[data-a=oadd],[data-a=odel],[data-a=iadd],[data-a=imv],[data-a=idel]").forEach(x => { x.disabled = true; x.style.opacity = ".55"; }); };
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
