/* تقييم صفحة المنتج (PageRater): يفحص منتجاً من متجرك أو رابط صفحة أي موقع ويعطي درجة لأربع فئات — تنوّع الصور، جودة الصور، معلومات المنتج، اتساق العلامة —
   مع ما يجب إصلاحه أولاً والأداة التي تعالجه. قراءة فقط، بلا ذكاء ولا تكلفة. حدود صريحة: لا يحكم على الإضاءة ولا الحدّة ولا نوع الزاوية (يعدّ الصور ويقيس أبعادها)،
   واتساق العلامة يخصّ منتجات متجرك فقط (يقارن بخلفيات أغلفة بقية المنتجات). صفحات الجافاسكربت الكاملة قد تظهر بصور أقل من الحقيقة عند الجلب من رابط خارجي. */
const PageRater = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PROXIES = [u => u, u => "https://corsproxy.io/?url=" + encodeURIComponent(u), u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u)];
  /* كلمات المعلومات الأساسية (عربي/فرنسي/إنجليزي) */
  const INFO = [
    ["material", "المكوّنات أو الخامة", /مكونات|مكوّنات|تركيبة|يحتوي|خامة|قماش|مصنوع|مادة|ingr[ée]dient|compos|mat[ée]riau|made of|material|contains|cotton|leather|جلد|قطن|عسل|زيت/i],
    ["size", "المقاس أو الحجم أو الوزن", /مقاس|حجم|وزن|سم\b|غرام|مل\b|لتر|كلغ|ml\b|cl\b|kg\b|\bg\b|cm\b|taille|poids|size|weight|dimension|\d+\s?(ml|g|kg|cm|mm|l)\b/i],
    ["usage", "طريقة الاستعمال", /طريقة الاستعمال|طريقة الاستخدام|استعمل|يُستعمل|يستعمل|الاستخدام|كيفية|mode d.emploi|utilisation|how to use|directions|usage|apply|مرتين|مرة يوميا|يومياً|يوميا/i],
    ["care", "العناية والتخزين أو الفوائد", /تخزين|احفظ|العناية|غسل|صلاحية|فوائد|يساعد|مفيد|conserv|entretien|lavage|benefit|b[ée]n[ée]fice|care|storage|wash/i]
  ];
  /* مصدر موحَّد للصفحة: {title, desc, images:[{url,w,h}], video:boolean, url} */
  function fromProduct(p) {
    const imgs = []; const seen = new Set(); [p.cover].concat(p.images || []).forEach(u => { if (u && !seen.has(u)) { seen.add(u); imgs.push({ url: u }); } });
    return { title: p.title || "", desc: p.desc || "", images: imgs, video: !!(p.video || p.videoUrl), url: "p/" + p.slug + "/", slug: p.slug, own: true, extra: [p.keywords, p.seoDesc].filter(Boolean).join(" ") };
  }
  function fromHtml(html, base) {
    const doc = new DOMParser().parseFromString(html, "text/html"), abs = u => { try { return new URL(u, base).href; } catch (e) { return ""; } };
    doc.querySelectorAll("script,style,noscript,template").forEach(n => n.remove());
    const meta = n => ((doc.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]') || {}).content || "").trim();
    const title = ((doc.querySelector("h1") || {}).textContent || meta("og:title") || (doc.title || "")).trim().replace(/\s+/g, " ");
    const urls = new Set(); const og = meta("og:image"); if (og) urls.add(abs(og));
    doc.querySelectorAll("img").forEach(im => { const w = +im.getAttribute("width") || 0, h = +im.getAttribute("height") || 0; if ((w && w < 90) || (h && h < 90)) return; let u = im.getAttribute("data-src") || im.getAttribute("data-lazy-src") || im.getAttribute("src") || ""; const ss = im.getAttribute("srcset") || im.getAttribute("data-srcset"); if (ss) { const last = ss.split(",").pop().trim().split(/\s+/)[0]; if (last) u = last; } if (!u || /^data:|logo|icon|sprite|avatar|pixel|\.svg(\?|$)|badge|payment|flag/i.test(u)) return; u = abs(u); if (u) urls.add(u); });
    const text = (doc.body ? doc.body.textContent : "").replace(/\s+/g, " ").trim(), descEl = doc.querySelector('[itemprop="description"],.description,#description,.product-description,.pdesc') , desc = (descEl ? descEl.textContent : meta("og:description") || meta("description")).replace(/\s+/g, " ").trim();
    const video = !!doc.querySelector("video,iframe[src*=youtube],iframe[src*=vimeo],iframe[src*=tiktok]");
    return { title, desc: desc.length > 80 ? desc : (desc + " " + text.slice(0, 4000)).trim(), images: [...urls].slice(0, 24).map(url => ({ url })), video, url: base, own: false, extra: "" };
  }
  const band = s => s >= 8 ? "جيد" : s >= 5 ? "مقبول" : "ضعيف";
  /* نقية: تقيّم صفحة موحَّدة (بعد قياس أبعاد الصور dims = [{w,h}] وخلفية الأغلفة bgs = {mine:{l,transparent}, others:[…]}) */
  function score(pg, dims, bgs) {
    const out = [], n = pg.images.length, vid = pg.video ? 1 : 0;
    /* 1) تنوّع الصور */
    { let s = n >= 6 ? 8 : n >= 4 ? 6.5 : n >= 3 ? 5 : n === 2 ? 3 : n === 1 ? 1.5 : 0; if (vid) s += 1.5; s = Math.min(10, s); const f = [];
      f.push("عدد الصور: " + n + (vid ? " + فيديو" : "")); if (n < 4) f.push("أضف زوايا أخرى: قريبة على التفاصيل، المنتج بالاستعمال، ومنتج بجانب شيء للمقارنة بالحجم"); if (!vid) f.push("لا فيديو — فيديو قصير يرفع الثقة");
      out.push({ id: "variety", name: "تنوّع الصور", score: Math.round(s * 10) / 10, findings: f, fix: n < 4 ? { tool: "pshoot", label: "تصوير المنتج بالذكاء (مشاهد متعددة)" } : !vid ? { tool: "vgen", label: "مولّد الفيديو بالذكاء" } : null }); }
    /* 2) جودة الصور (الأبعاد والصيغة فقط) */
    { const ds = (dims || []).filter(d => d && d.w), f = [];
      if (!ds.length) { out.push({ id: "quality", name: "جودة الصور", score: n ? 5 : 0, findings: [n ? "تعذّر قياس أبعاد الصور (حجبها الموقع)" : "لا صور"], fix: null, partial: true }); }
      else { const mn = ds.map(d => Math.min(d.w, d.h)), small = mn.filter(m => m < 800).length, avg = mn.reduce((a, b) => a + b, 0) / mn.length; let s = avg >= 1200 ? 9 : avg >= 1000 ? 8 : avg >= 800 ? 6.5 : avg >= 600 ? 4.5 : 2.5; if (small) s -= Math.min(2.5, small / ds.length * 3); s = Math.max(0, Math.min(10, s));
        f.push("متوسط أصغر ضلع: " + Math.round(avg) + " بكسل (" + ds.length + " صور مقاسة)"); if (small) f.push(small + " صورة أصغر من 800 بكسل — تبدو ناعمة عند التكبير"); f.push("لا يُحكم هنا على الإضاءة ولا الحدّة؛ راجعها بعينك");
        out.push({ id: "quality", name: "جودة الصور", score: Math.round(s * 10) / 10, findings: f, fix: small ? { tool: "up", label: "تحسين الجودة (تكبير وحدّة)" } : null }); } }
    /* 3) معلومات المنتج */
    { const text = (pg.title + " " + pg.desc + " " + (pg.extra || "")), words = text.split(/\s+/).filter(Boolean).length, have = INFO.filter(i => i[2].test(text)), miss = INFO.filter(i => !i[2].test(text)), f = [];
      let s = Math.min(4, have.length) * 1.7 + (pg.title.length >= 15 && pg.title.length <= 90 ? 1.5 : pg.title ? .7 : 0) + (words >= 80 ? 1.7 : words >= 40 ? 1 : words >= 15 ? .4 : 0); s = Math.min(10, s);
      f.push("طول الوصف: " + words + " كلمة"); if (!pg.title) f.push("لا عنوان للمنتج"); else if (pg.title.length < 15) f.push("العنوان قصير — اذكر النوع والخامة أو الحجم"); if (miss.length) f.push("ينقص أولاً: " + miss[0][1] + (miss.length > 1 ? " (ثم: " + miss.slice(1).map(x => x[1]).join("، ") + ")" : ""));
      out.push({ id: "info", name: "معلومات المنتج", score: Math.round(s * 10) / 10, findings: f, fix: miss.length || words < 40 ? { tool: "seo", label: "حسّن العنوان والوصف (تعديل المنتج ← SEO)" } : null }); }
    /* 4) اتساق العلامة (منتجات المتجر فقط) */
    if (pg.own && bgs && bgs.others && bgs.others.length && bgs.mine) {
      const ls = bgs.others.map(o => o.l), med = ls.slice().sort((a, b) => a - b)[Math.floor(ls.length / 2)], dl = Math.abs(bgs.mine.l - med), trShare = bgs.others.filter(o => o.transparent).length / bgs.others.length, f = [];
      let s = dl < .08 ? 9 : dl < .18 ? 7 : dl < .3 ? 5 : 3; if (!!bgs.mine.transparent !== (trShare >= .5)) s = Math.min(s, 5);
      f.push("خلفية غلاف هذا المنتج " + (bgs.mine.transparent ? "شفافة" : "ملوّنة") + " بينما أغلب منتجاتك " + (trShare >= .5 ? "شفافة" : "ملوّنة")); if (dl >= .18) f.push("درجة سطوع الخلفية تختلف عن بقية المتجر");
      out.push({ id: "brand", name: "اتساق العلامة", score: Math.round(s * 10) / 10, findings: f, fix: s < 7 ? { tool: "catalog", label: "طبّق نمط المتجر على الأغلفة (كتالوج المنتجات)" } : null });
    } else out.push({ id: "brand", name: "اتساق العلامة", score: null, findings: [pg.own ? "لا بيانات كافية لمقارنة أغلفة المتجر" : "يخصّ منتجات متجرك فقط — يقارن غلاف المنتج بأغلفة بقية منتجاتك"], fix: null, na: true });
    const sc = out.filter(c => c.score != null), total = sc.length ? Math.round(sc.reduce((a, c) => a + c.score, 0) / sc.length * 10) : 0;
    const first = sc.slice().sort((a, b) => a.score - b.score)[0];
    return { cats: out.map(c => Object.assign(c, { band: c.score == null ? "" : band(c.score) })), total, first: first && first.score < 8 ? first.id : null };
  }
  const loadDim = u => new Promise(res => { const im = new Image(); const t = setTimeout(() => res(null), 7000); im.onload = () => { clearTimeout(t); res({ w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = u; });
  async function dimsOf(images, cap) { const list = images.slice(0, cap || 8); return Promise.all(list.map(i => loadDim(i.url))); }
  /* خلفية الغلاف: متوسط سطوع الزوايا وهل هي شفافة (صور من نفس الأصل فقط) */
  async function bgOf(url) {
    try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }), c = document.createElement("canvas"), k = 24; c.width = k; c.height = k; const g = c.getContext("2d"); g.drawImage(im, 0, 0, k, k); const px = [[0, 0], [k - 1, 0], [0, k - 1], [k - 1, k - 1]].map(([x, y]) => g.getImageData(x, y, 1, 1).data); const tr = px.filter(d => d[3] < 40).length >= 3; const l = px.reduce((a, d) => a + (.2126 * d[0] + .7152 * d[1] + .0722 * d[2]) / 255, 0) / 4; return { l, transparent: tr }; } catch (e) { return null; }
  }
  async function fetchPage(url) {
    let last = null; for (const px of PROXIES) { try { const r = await fetch(px(url)); if (!r.ok) throw new Error("HTTP " + r.status); const h = await r.text(); if (h && h.length > 200) return h; } catch (e) { last = e; } }
    throw new Error("تعذّر جلب الصفحة (" + (last && last.message || "؟") + "). قد يحجب الموقع الجلب الآلي — جرّب منتجاً من متجرك.");
  }
  async function rateProduct(slug) {
    const p = ((typeof Admin !== "undefined" && Admin.products) || []).find(x => x.slug === slug); if (!p) throw new Error("المنتج غير موجود");
    const pg = fromProduct(p), dims = await dimsOf(pg.images, 10), others = []; const mine = pg.images[0] ? await bgOf(pg.images[0].url) : null;
    for (const q of ((typeof Admin !== "undefined" && Admin.products) || []).filter(x => x.slug !== slug && x.active !== false && (x.cover || (x.images || [])[0])).slice(0, 14)) { const b = await bgOf(q.cover || q.images[0]); if (b) others.push(b); }
    return Object.assign(score(pg, dims, { mine, others }), { page: pg });
  }
  async function rateUrl(url) {
    let u = String(url || "").trim(); if (!u) throw new Error("ألصق رابط صفحة المنتج"); if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { new URL(u); } catch (e) { throw new Error("الرابط غير صالح"); }
    const html = await fetchPage(u), pg = fromHtml(html, u); if (!pg.images.length && !pg.title) throw new Error("لم أجد محتوى منتج في هذه الصفحة (قد تُبنى بالجافاسكربت). جرّب رابط صفحة المنتج نفسه.");
    const dims = await dimsOf(pg.images, 8); return Object.assign(score(pg, dims, null), { page: pg });
  }
  /* درجة الإدراج (Listing Score) لكل منتج في المتجر: تقدّم بنسبة مئوية وما يُحسَّن تالياً — فحص محلي سريع بلا تحميل صور */
  const GENERIC_NAME = /^(img|image|dsc|photo|screenshot|whatsapp|\d+|[a-f0-9-]{12,})[\s_.-]*\d*\.(webp|jpg|jpeg|png)$/i;
  const fileOf = u => String(u || "").split("?")[0].split("/").pop();
  function listing(p) {
    const imgs = [p.cover].concat(p.images || []).filter((u, i, a) => u && a.indexOf(u) === i), words = String(p.desc || "").split(/\s+/).filter(Boolean).length;
    const items = [
      ["cover", "صورة غلاف", 10, !!p.cover || imgs.length > 0, "أضف صورة غلاف واضحة"],
      ["imgs", "3 صور فأكثر", 15, imgs.length >= 3, "أضف زوايا أخرى (قريبة وبالاستعمال) حتى 3 صور على الأقل"],
      ["imgs6", "5 صور فأكثر", 5, imgs.length >= 5, "5 صور أو أكثر تزيد الثقة"],
      ["names", "أسماء ملفات وصفية", 8, imgs.length > 0 && imgs.filter(u => GENERIC_NAME.test(fileOf(u))).length / imgs.length < .5, "أعد تسمية الصور بأسماء وصفية (مثل: عسل-سدر-500غ.webp) لتحسين الظهور في البحث"],
      ["desc", "وصف 40 كلمة فأكثر", 15, words >= 40, "اكتب وصفاً أوفى: المكوّنات، المقاس، الاستعمال"],
      ["info", "مكوّنات/مقاس/استعمال في الوصف", 10, INFO.filter(i => i[2].test(p.desc || "")).length >= 2, "اذكر المكوّنات أو المقاس وطريقة الاستعمال في الوصف"],
      ["seoTitle", "عنوان SEO", 7, !!(p.seoTitle && p.seoTitle.length >= 20), "أضف عنوان SEO من 20 حرفاً فأكثر"],
      ["seoDesc", "وصف SEO", 7, !!(p.seoDesc && p.seoDesc.length >= 70), "أضف وصف SEO من 70 حرفاً فأكثر"],
      ["kw", "كلمات مفتاحية", 5, !!(p.keywords && String(p.keywords).split(/[,،]/).filter(x => x.trim()).length >= 3), "أضف 3 كلمات مفتاحية على الأقل"],
      ["cat", "تصنيف", 5, !!p.cat, "اختر تصنيفاً للمنتج"],
      ["price", "سعر", 5, +p.price > 0, "حدّد السعر"],
      ["offers", "عروض الكمية أو سعر قبل التخفيض", 4, !!((p.offers || []).length > 1 || +p.old > +p.price), "أضف عروض كميات أو سعراً قديماً"],
      ["video", "فيديو", 4, !!(p.video || p.videoUrl), "أضف فيديو قصيراً (من «مولّد الفيديو»)"]
    ];
    const total = items.reduce((a, i) => a + i[2], 0), got = items.reduce((a, i) => a + (i[3] ? i[2] : 0), 0), todo = items.filter(i => !i[3]).sort((a, b) => b[2] - a[2]);
    return { slug: p.slug, title: p.title, score: Math.round(got / total * 100), todo: todo.map(i => ({ id: i[0], label: i[1], tip: i[4], w: i[2] })) };
  }
  const listingAll = prods => (prods || []).filter(p => p && p.active !== false).map(listing).sort((a, b) => a.score - b.score);
  /* تصدير الكتالوج بصيغة CSV لـShopify (Handle, Title, Body, Vendor, Type, Tags, Variant Price, Compare At, Image Src/Position, Status) — الصور بروابط مطلقة */
  function shopifyCsv(prods, base) {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""').replace(/\r?\n/g, " ") + '"', abs = u => /^https?:/.test(u) ? u : String(base || "").replace(/\/+$/, "") + "/" + String(u || "").replace(/^\/+/, "");
    const head = ["Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published", "Variant Price", "Variant Compare At Price", "Variant Inventory Qty", "Image Src", "Image Position", "Status"], rows = [head.map(q).join(",")];
    for (const p of (prods || []).filter(x => x && x.active !== false)) {
      const imgs = [p.cover].concat(p.images || []).filter((u, i, a) => u && a.indexOf(u) === i).map(abs), t = (p.tags || []).join(", "), first = [p.slug, p.title, "<p>" + String(p.desc || "").replace(/</g, "&lt;") + "</p>", "", p.cat || "", t, "true", p.price || 0, +p.old > +p.price ? p.old : "", p.stock == null || p.stock === "" ? "" : p.stock, imgs[0] || "", imgs[0] ? 1 : "", "active"];
      rows.push(first.map(q).join(","));
      imgs.slice(1).forEach((u, i) => rows.push([p.slug, "", "", "", "", "", "", "", "", "", u, i + 2, ""].map(q).join(",")));
    }
    return "\uFEFF" + rows.join("\r\n");
  }
  const S = { res: null, busy: false, msg: "", mode: "store", slug: "", url: "" };
  function ensure() { const tab = $("tab-imgtools"); if (!tab) return null; let c = $("pr-card"); if (!c) { c = document.createElement("div"); c.id = "pr-card"; c.className = "card"; tab.appendChild(c); } return c; }
  const colr = s => s == null ? "#9aa" : s >= 8 ? "#86efac" : s >= 5 ? "#fcd34d" : "#fca5a5";
  function draw() {
    const c = ensure(); if (!c) return; const prods = ((typeof Admin !== "undefined" && Admin.products) || []).filter(p => p && p.active !== false), r = S.res;
    c.innerHTML = `<style>#pr-card .pr-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:.5rem 0}#pr-card .pr-cat{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:.7rem .9rem;margin:.5rem 0}#pr-card .pr-s{font-size:1.4rem;font-weight:900}#pr-card ul{margin:.3rem 0 0;padding-inline-start:1.1rem}</style>
<h3 style="margin:.2rem 0">⭐ تقييم صفحة المنتج</h3><p class="hint" style="margin:.2rem 0 .6rem">قيّم صفحة منتج من متجرك أو برابط أي صفحة: درجة لتنوّع الصور وجودتها ومعلومات المنتج واتساق العلامة، مع ما يُصلَح أولاً والأداة المناسبة. الأداة تعدّ الصور وتقيس أبعادها ولا تحكم على الإضاءة أو الحدّة.</p>
<div class="pr-row"><label><input type="radio" name="pr-m" value="store"${S.mode === "store" ? " checked" : ""}> منتج من متجري</label><label><input type="radio" name="pr-m" value="url"${S.mode === "url" ? " checked" : ""}> رابط صفحة</label></div>
<div class="pr-row">${S.mode === "store" ? `<select id="pr-p" style="min-width:220px">${prods.map(p => `<option value="${esc(p.slug)}"${p.slug === S.slug ? " selected" : ""}>${esc(p.title)}</option>`).join("")}</select>` : `<input id="pr-u" type="url" dir="ltr" placeholder="https://example.com/products/..." value="${esc(S.url)}" style="min-width:280px;flex:1">`}<button type="button" class="btn-add" id="pr-go"${S.busy ? " disabled" : ""}>${S.busy ? "⏳ جارٍ الفحص…" : "قيّم الصفحة"}</button></div>
<div id="pr-msg" class="hint">${esc(S.msg)}</div>
<div class="pr-row"><button type="button" class="btn-add" id="pr-all">📊 درجة الإدراج لكل منتجات المتجر</button><button type="button" class="btn-add" id="pr-csv">⬇ تصدير الكتالوج لـShopify (CSV)</button></div>
${S.all ? `<div class="pr-cat"><b>درجة الإدراج</b> — الأضعف أولاً (اضغط منتجاً لتعديله)<div style="max-height:320px;overflow:auto;margin-top:.4rem">${S.all.map(x => `<div style="display:grid;grid-template-columns:44px 1fr;gap:8px;padding:.35rem 0;border-top:1px solid rgba(255,255,255,.08);cursor:pointer" data-edit="${esc(x.slug)}"><b class="pr-s" style="font-size:1rem;color:${colr(x.score / 10)}">${x.score}%</b><span>${esc(x.title)}<br><small>${x.todo.length ? "التالي: " + esc(x.todo[0].tip) : "مكتمل"}</small></span></div>`).join("")}</div></div>` : ""}
${r ? `<div class="pr-cat"><span class="pr-s" style="color:${colr(r.total / 10)}">${r.total}/100</span> <b>الدرجة الإجمالية</b>${r.first ? ` — ابدأ بـ«${esc((r.cats.find(x => x.id === r.first) || {}).name)}»` : " — صفحتك في وضع جيد"}</div>
${r.cats.map(k => `<div class="pr-cat" data-cat="${k.id}"><div><b>${esc(k.name)}</b> <span class="pr-s" style="color:${colr(k.score)}">${k.score == null ? "—" : k.score + "/10"}</span> <small>${esc(k.band)}</small></div><ul>${k.findings.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${k.fix ? `<div class="pr-row"><button type="button" class="btn-add" data-fix="${k.fix.tool}">${esc(k.fix.label)}</button></div>` : ""}</div>`).join("")}` : ""}`;
    c.querySelectorAll('input[name="pr-m"]').forEach(i => i.onchange = () => { S.mode = i.value; S.res = null; S.msg = ""; draw(); });
    const al = $("pr-all"); if (al) al.onclick = () => { S.all = listingAll((typeof Admin !== "undefined" && Admin.products) || []); draw(); };
    const cv = $("pr-csv"); if (cv) cv.onclick = () => { const base = (typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.domain) ? "https://" + CONFIG.SITE.domain : location.origin, b = new Blob([shopifyCsv((typeof Admin !== "undefined" && Admin.products) || [], base)], { type: "text/csv;charset=utf-8" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "products-shopify.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    c.querySelectorAll("[data-edit]").forEach(d => d.onclick = () => { try { Admin.editProduct(d.dataset.edit); } catch (e) { } });
    const g = $("pr-go"); if (g) g.onclick = run; c.querySelectorAll("[data-fix]").forEach(b => b.onclick = () => fix(b.dataset.fix));
  }
  async function run() {
    if (S.busy) return; const sl = $("pr-p"), ul = $("pr-u"); if (sl) S.slug = sl.value; if (ul) S.url = ul.value; S.busy = true; S.msg = ""; draw();
    try { S.res = S.mode === "store" ? await rateProduct(S.slug) : await rateUrl(S.url); S.msg = ""; } catch (e) { S.res = null; S.msg = "❌ " + e.message; }
    S.busy = false; draw();
  }
  function fix(t) {
    try { if (t === "seo") { const p = S.res && S.res.page && S.res.page.own ? S.res.page.slug : ""; if (p && typeof Admin !== "undefined") { Admin.editProduct(p); return; } Admin.tab("seo"); return; } if (t === "catalog") { Admin.tab("imgtools"); const e = $("iq-card") || $("ib-card"); if (e) e.scrollIntoView({ behavior: "smooth" }); return; } if (typeof AdminNav !== "undefined") AdminNav.deepTool(t); } catch (e) { }
  }
  function init() { if (!$("tab-imgtools")) return setTimeout(init, 300); draw(); const a = typeof Admin !== "undefined" ? Admin : null; if (a && !a.__prWrapped && a.tab) { a.__prWrapped = true; const o = a.tab.bind(a); a.tab = function (t) { const r = o.apply(a, arguments); if (t === "imgtools") draw(); return r; }; } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); else setTimeout(init, 0);
  return { score, fromProduct, fromHtml, rateProduct, rateUrl, draw, S, INFO, listing, listingAll, shopifyCsv };
})();
