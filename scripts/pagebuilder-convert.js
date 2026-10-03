/* ═════════════════════════════════════════════════════════════════
   تحويل صفحة المنتج أو الصفحة الرئيسية إلى صفحة في «مطوّر الصفحات» (PBConvert)
   • زر «تعديل» في شريط المعاينة العلوي ← يُحمِّل الصفحة، يحوّل محتواها المرئي إلى أقسام وعناصر قابلة للتحرير، ويفتحها في المطوّر.
   • «حفظ ونشر» ← خياران: حفظ مباشر (يستبدل الصفحة الأصلية بعد حفظ نسخة منها للاسترجاع) أو نسخة جديدة (/lp/…).
   ═════════════════════════════════════════════════════════════════ */
const PBConvert = (() => {
  const { mkW, mkC, mkS, newPage, esc } = PB;
  const toast = m => { try { window.toast(m); } catch (e) { } };
  const hex = c => { const m = String(c || "").match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (!m) return ""; if (m[4] !== undefined && +m[4] < .5) return ""; return "#" + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, "0")).join(""); };
  const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const SKIP = "script,style,noscript,template,link,meta,header.site,footer.site,.topbar,.drawer,.drawer-bg,#drawer,#drawer-bg,#agent,[id^=agent],.acc-btn,.cart-btn,.crumbs,.sr-only,.ch-share-btn,#ch-float,#ch-share,.sticky-order,.pbx-ov,.sticky-cta";
  const key = (kind, slug) => kind === "home" ? "home" : "p-" + slug;
  const path = (kind, slug) => kind === "home" ? "index.html" : "p/" + slug + "/index.html";

  /* ── التحويل: DOM مرسوم (داخل iframe خفي بعرض الحاسوب) ← صفحة مطوّر ── */
  function convert(doc, o) {
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

    function widgetsOf(el, out) {
      if (skip(el)) return;
      const tag = el.tagName;
      if (o.kind === "product" && isOrder(el)) { if (!sawOrder) { sawOrder = true; out.push(mkW("orderorig", { prod: o.slug })); } return; }
      if (/^H[1-6]$/.test(tag)) { const t = txt(el); if (!t) return; const w = mkW("heading", { text: t, tag: tag.toLowerCase(), fs: { d: px(el, 32), m: Math.max(18, Math.round(px(el, 32) * (px(el, 32) > 30 ? .72 : .9))) }, ta: { d: ta(el) } }); const c = colorOf(el); if (c) w.set.color = c; out.push(w); return; }
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
      const cols = columnsOf(inner); let cs_;
      if (cols) cs_ = cols.map(w => mkC(w)); else { const w = []; widgetsOf(inner, w); if (!w.length) return null; cs_ = [mkC(w)]; }
      const s = cs(el), set = {}, bg = hex(s.backgroundColor) || (hint && hint.bg) || ""; const gi = /gradient\(/.test(s.backgroundImage) ? ([...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => m[0]).filter(c => hex(c)).pop() || "") : ""; const b2 = bg || hex(gi);
      if (b2) set.bg = b2;
      const pt = Math.round(parseFloat(s.paddingTop) || 0), pb = Math.round(parseFloat(s.paddingBottom) || 0); set.pad = { d: [Math.max(16, pt), 20, Math.max(16, pb), 20], m: [Math.max(14, Math.round(pt * .6)), 16, Math.max(14, Math.round(pb * .6)), 16] };
      return mkS(cs_, set);
    }
    const root = doc.querySelector("main") || doc.body, secs = [];
    let loose = [];
    const flush = () => { if (!loose.length) return; const w = []; loose.forEach(c => widgetsOf(c, w)); if (w.length) secs.push(mkS([mkC(w)], {})); loose = []; };
    const top = kids(root).flatMap(c => (c.matches(".container,#main,div") && kids(c).length > 1 && kids(c).every(x => x.matches("section,.hero,div[class*=sec],.container")) ) ? kids(c) : [c]);
    top.forEach(c => { if (c.matches("section") || hex(cs(c).backgroundColor) || /gradient/.test(cs(c).backgroundImage) || c.matches(".hero,[class*=hero]")) { flush(); const s = sectionOf(c); if (s) secs.push(s); } else loose.push(c); });
    flush();
    if (o.kind === "product" && !sawOrder) secs.push(mkS([mkC([mkW("orderorig", { prod: o.slug })])], {}));
    const page = newPage(o.title || o.slug || "الصفحة الرئيسية", o.kind === "home" ? "home" : o.slug);
    page.sections = secs.length ? secs : [mkS([mkC([mkW("heading", { text: o.title || "صفحة" })])], {})];
    page.header = false; page.footer = false; page.bg = hex(cs(doc.body).backgroundColor) || "#ffffff";
    const ff = cs(doc.body).fontFamily; if (ff) page.ff = ff;
    const t = doc.title || ""; if (t) { page.seoTitle = t.replace(/\s+—.*$/, ""); }
    const md = doc.querySelector('meta[name="description"]'); if (md) page.desc = md.content || "";
    if (o.kind === "product") page.product = o.slug;
    page.sections.forEach(s => (s.cols || []).forEach(c => (c.widgets || []).forEach(w => { delete w._auto; })));
    page.origin = { kind: o.kind, slug: o.slug || "", direct: false };
    return page;
  }
  /* يرسم الصفحة في iframe خفي بعرض الحاسوب (لتشغيل جافاسكربتها وقراءة الأنماط المحسوبة) */
  async function render(url) {
    const fr = document.createElement("iframe"); fr.setAttribute("aria-hidden", "true"); fr.style.cssText = "position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0;visibility:hidden";
    document.body.appendChild(fr);
    try { await new Promise((res, rej) => { fr.onload = res; fr.onerror = rej; fr.src = url + (url.includes("?") ? "&" : "?") + "preview=" + Date.now(); setTimeout(res, 12000); }); await new Promise(r => setTimeout(r, 2200)); fr.style.visibility = "visible"; fr.style.visibility = "hidden"; return fr; }
    catch (e) { fr.remove(); throw e; }
  }
  const dec = f => decodeURIComponent(escape(atob((f.content || "").replace(/\n/g, ""))));
  /* زر «تعديل» ← يفتح الصفحة في المطوّر */
  async function edit(kind, slug) {
    if (kind === "home") slug = "";
    try { SitePreview.close(); } catch (e) { }
    toast("⏳ جارِ فتح الصفحة في المطوّر…");
    try {
      const k = key(kind, slug); let page = null;
      try { const f = await GH.getFile("assets/pages/_conv/" + k + ".json"); const p = JSON.parse(dec(f)); if (p && p.origin && p.origin.direct) page = p; } catch (e) { }      // نسخة محفوظة سابقاً (تُستعمل ما دامت هي المنشورة)
      if (!page) {
        const pr = kind === "product" ? (Admin.products || []).find(x => x.slug === slug) : null;
        if (kind === "product" && !pr) throw new Error("المنتج غير موجود");
        const url = kind === "home" ? "index.html" : "p/" + slug + "/", fr = await render(url);
        try { page = convert(fr.contentDocument, { kind, slug, title: pr ? pr.title : "الصفحة الرئيسية" }); } finally { fr.remove(); }
      }
      PBApp.open(page, page.slug, true); PBApp.E.dirty = true;
      toast("✅ فُتحت في المطوّر — عدّل ما تشاء ثم «حفظ ونشر»");
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
  /* ── حفظ مباشر: يستبدل الصفحة الأصلية (بعد نسخها احتياطياً أول مرة) ── */
  async function saveDirect(P, ctx) {
    const o = P.origin, k = key(o.kind, o.slug), pth = path(o.kind, o.slug), put = PBApp.putJson;
    let cur = null; try { cur = await GH.getFile(pth); } catch (e) { }
    if (!o.direct && cur) {
      let has = false; try { await GH.getFile("assets/pages/_conv/" + k + ".orig.html"); has = true; } catch (e) { }
      if (!has) await GH.putFile("assets/pages/_conv/" + k + ".orig.html", cur.content.replace(/\n/g, ""), undefined, "نسخة احتياطية من الأصل قبل التحرير بالمطوّر: " + pth);
      if (o.kind === "product") {
        let cl = false; try { await GH.getFile("p/" + o.slug + "/classic/index.html"); cl = true; } catch (e) { }
        if (!cl) { const orig = dec(cur).replace(/(["'(])\.\.\/\.\.\//g, "$1../../../").replace("<head>", '<head><meta name="robots" content="noindex">'); await GH.putFile("p/" + o.slug + "/classic/index.html", btoa(unescape(encodeURIComponent(orig))), undefined, "الصفحة الأصلية للمنتج (تُضمَّن نموذج الطلب): " + o.slug); }
      }
    }
    P.origin = Object.assign({}, o, { direct: true });
    let html = PB.fullHtml(P, Object.assign({ base: o.kind === "home" ? "" : "../../", path: o.kind === "home" ? "" : "p/" + o.slug + "/" }, ctx));
    if (o.kind === "product") html = html.split("p/" + o.slug + "/?embed=1").join("p/" + o.slug + "/classic/?embed=1");
    await GH.putFile(pth, btoa(unescape(encodeURIComponent(html))), cur && cur.sha, "نشر " + (o.kind === "home" ? "الصفحة الرئيسية" : "صفحة المنتج " + o.slug) + " من المطوّر");
    await put("assets/pages/_conv/" + k + ".json", P, "مصدر تصميم المطوّر: " + k);
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
  return { convert, render, edit, ask, saveDirect, restore };
})();
