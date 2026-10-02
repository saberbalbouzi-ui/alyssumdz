/* ══════════════════════════════════════════════════════════════════════════════
   PB — منشئ الصفحات المتقدم (مشابه لـ Elementor): أقسام ← أعمدة ← عناصر، مع إعدادات متجاوبة لكل جهاز
   (المكتب d / التابلت t / الهاتف m)، تحرير مباشر على الصفحة، تغيير حجم بالسحب، وتصدير صفحة ثابتة سريعة.
   المصدر الوحيد: scripts/pagebuilder.js — يُحقن داخل admin.html بين علامتي PB:start وPB:end
   عبر scripts/build-admin-pb.py (لا تعدّل النسخة المحقونة يدوياً).
   ══════════════════════════════════════════════════════════════════════════════ */
const PB = (() => {
  const DEVS = ["d", "t", "m"], BP = { t: 1024, m: 767 }, DEVNAME = { d: "المكتب", t: "التابلت", m: "الهاتف" }, DEVIC = { d: "🖥️", t: "📱", m: "📲" };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const num = v => (v === "" || v == null || isNaN(Number(v))) ? null : Number(v);

  /* ───── القيم المتجاوبة: set[k] = {d,t,m}؛ التابلت يرث المكتب والهاتف يرث التابلت ───── */
  const own = (set, k, dev) => { const v = set[k]; return isObj(v) ? v[dev] : (dev === "d" ? v : undefined); };
  const eff = (set, k, dev) => { const v = set[k]; if (!isObj(v)) return v; if (v[dev] !== undefined) return v[dev]; if (dev === "m" && v.t !== undefined) return v.t; return v.d; };
  const setR = (set, k, dev, val) => {
    let v = set[k]; if (!isObj(v)) v = set[k] = (v === undefined || v === "" ? {} : { d: v });
    if (val === undefined || val === "" || val === null) delete v[dev]; else v[dev] = val;
    if (!Object.keys(v).length) delete set[k];
  };

  /* ───── مولّد CSS: يجمع القواعد في 3 صناديق (أساس / تابلت / هاتف) ثم يخرجها بالترتيب الصحيح ───── */
  const newCss = () => ({ d: [], t: [], m: [] });
  const dimsDecl = (prop, a) => !Array.isArray(a) ? "" : ["top", "right", "bottom", "left"].map((s, i) => (a[i] === "" || a[i] == null || isNaN(Number(a[i]))) ? "" : `${prop}-${s}:${Number(a[i])}px;`).join("");
  /* specs: [مفتاح, دالة(قيمة,set) ← إعلان CSS] */
  function emit(css, sel, set, specs) {
    DEVS.forEach(dev => {
      let d = "";
      specs.forEach(([k, fn]) => { const v = own(set, k, dev); if (v !== undefined && v !== "" && v !== null) d += fn(v, set, dev) || ""; });
      if (d) css[dev].push(`${sel}{${d}}`);
    });
  }
  const px = p => v => num(v) == null ? "" : `${p}:${num(v)}px;`;
  const pc = p => v => num(v) == null ? "" : `${p}:${num(v)}%;`;
  const raw = p => v => `${p}:${v};`;
  const SHADOWS = { "": "", sm: "0 2px 8px rgba(0,0,0,.12)", md: "0 8px 24px rgba(0,0,0,.16)", lg: "0 18px 48px rgba(0,0,0,.22)", glow: "0 0 24px rgba(200,162,75,.6)" };
  const TYPO = [["color", raw("color")], ["fs", px("font-size")], ["fw", raw("font-weight")], ["ff", raw("font-family")], ["lh", raw("line-height")], ["ls", px("letter-spacing")], ["tt", raw("text-transform")], ["ta", raw("text-align")]];
  const BOX = [["mar", v => dimsDecl("margin", v)], ["pad", v => dimsDecl("padding", v)], ["rad", px("border-radius")]];
  /* الخلفية/الحدود غير المتجاوبة (قيمة واحدة) */
  function boxStatic(css, sel, s) {
    let d = "";
    if (s.bg) d += `background-color:${s.bg};`;
    if (s.grad1 && s.grad2) d += `background-image:linear-gradient(${num(s.gradAng) ?? 135}deg,${s.grad1},${s.grad2});`;
    if (s.bgImg) { d += `background-image:${(s.grad1 && s.grad2) ? "linear-gradient(" + (num(s.gradAng) ?? 135) + "deg," + s.grad1 + "," + s.grad2 + ")," : ""}url('${/^(https?:|data:|\/)/.test(s.bgImg) ? s.bgImg : (css.base || "") + s.bgImg}');background-size:${s.bgSize || "cover"};background-position:${s.bgPos || "center"};background-repeat:no-repeat;`; if (s.bgFixed) d += "background-attachment:fixed;"; }
    if (num(s.bw)) d += `border:${num(s.bw)}px ${s.bs || "solid"} ${s.bc || "#ddd"};`;
    if (s.shadow && SHADOWS[s.shadow]) d += `box-shadow:${SHADOWS[s.shadow]};`;
    if (s.op !== undefined && s.op !== "" && num(s.op) != null) d += `opacity:${num(s.op)};`;
    if (num(s.z)) d += `z-index:${num(s.z)};position:relative;`;
    if (d) css.d.push(`${sel}{${d}}`);
  }
  function hideRules(css, sel, s, edit) {
    DEVS.forEach(dev => { if (s["h" + dev]) css[dev].push(edit ? `${sel}{opacity:.25;outline:2px dashed #b83232}` : `${sel}{display:none!important}`); });
  }
  function customCss(css, sel, s) { if (s.css && String(s.css).trim()) css.d.push(String(s.css).replace(/selector/g, sel)); }
  function finishCss(css, base) {
    return css.d.join("\n") + `\n@media(max-width:${BP.t}px){\n${css.t.join("\n")}\n}\n@media(max-width:${BP.m}px){\n.pb-sec .pb-col{width:100%;flex:0 0 100%;max-width:100%}\n${css.m.join("\n")}\n}`;
  }
  const ANIMS = [["", "بدون"], ["fadeIn", "ظهور تدريجي"], ["fadeUp", "صعود"], ["fadeDown", "نزول"], ["zoomIn", "تكبير"], ["slideStart", "انزلاق من الجانب"]];
  const animAttr = s => s.anim ? ` data-anim="${esc(s.anim)}" style="--ad:${num(s.animDur) ?? .6}s;--ade:${num(s.animDelay) ?? 0}s"` : "";
  const cleanHtml = html => {
    const d = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    d.body.querySelectorAll("script,style,iframe,object,embed,link,meta,form").forEach(n => n.remove());
    d.body.querySelectorAll("*").forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name); }));
    return d.body.innerHTML;
  };
  const formatNum = n => Number(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");

  /* ───── شبكة المنتجات: دالة مستقلة (تُحقن كما هي داخل الصفحة المنشورة لتحديث الأسعار تلقائياً) ───── */
  function productsHtml(s, products, base) {
    const f = n => Number(n).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " دج";
    const e = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    let list = (products || []).filter(p => p.active !== false);
    const val = String(s.val || "").trim();
    if (s.mode === "tag" && val) list = list.filter(p => (p.tags || []).includes(val));
    else if (s.mode === "cat" && val) list = list.filter(p => p.cat === val);
    else if (s.mode === "slugs" && val) { const arr = val.split(/[\s,،]+/).filter(Boolean); list = arr.map(x => list.find(p => p.slug === x)).filter(Boolean); }
    const lim = Number(s.limit) || 0; if (lim > 0) list = list.slice(0, lim);
    if (!list.length) return '<div class="pb-empty-note">لا توجد منتجات مطابقة</div>';
    return '<div class="pb-pgrid">' + list.map(p => {
      const img = p.cover || (p.images && p.images[0]) || "";
      const disc = (p.old && p.old > p.price) ? Math.round((1 - p.price / p.old) * 100) : 0;
      return '<a class="pb-pc" href="' + e(base) + 'p/' + e(p.slug) + '/">' +
        '<div class="pb-pci">' + (disc ? '<span class="pb-pcd">-' + disc + '%</span>' : '') + (img ? '<img loading="lazy" decoding="async" src="' + e(base + img) + '" alt="' + e(p.title) + '">' : '') + '</div>' +
        '<h3>' + e(p.title) + '</h3><div class="pb-pcp"><b>' + f(p.price) + '</b>' + ((s.showOld !== false && p.old && p.old > p.price) ? '<s>' + f(p.old) + '</s>' : '') + '</div>' +
        '<span class="pb-pcb">' + e(s.btn || "اطلب الآن") + '</span></a>';
    }).join("") + '</div>';
  }

  /* ═════════════════ تعريف العناصر (Widgets) ═════════════════ */
  const F_FONT = [["", "الافتراضي (Cairo)"], ["Georgia,'Times New Roman',serif", "Serif"], ["system-ui,sans-serif", "System"], ["'Courier New',monospace", "Mono"]];
  const F_W = [["", "افتراضي"], ["400", "عادي"], ["600", "متوسط"], ["700", "عريض"], ["800", "عريض جداً"], ["900", "أسود"]];
  const AL = [["start", "⇥ بداية"], ["center", "↔ وسط"], ["end", "⇤ نهاية"]];
  const typoCtl = (extra) => [
    { k: "color", l: "لون النص", t: "color", tab: "s" },
    { k: "fs", l: "حجم الخط (px)", t: "num", r: 1, min: 8, max: 160, tab: "s" },
    { k: "fw", l: "الوزن", t: "select", o: F_W, tab: "s" },
    { k: "ff", l: "العائلة", t: "select", o: F_FONT, tab: "s" },
    { k: "lh", l: "ارتفاع السطر", t: "num", r: 1, min: .8, max: 3, step: .1, tab: "s" },
    { k: "ls", l: "تباعد الحروف (px)", t: "num", r: 1, min: -5, max: 20, step: .5, tab: "s" },
    { k: "tt", l: "حالة الأحرف", t: "select", o: [["", "افتراضي"], ["uppercase", "كبيرة"], ["capitalize", "أول حرف"], ["none", "بدون"]], tab: "s" },
    { k: "ta", l: "محاذاة النص", t: "align", r: 1, tab: "s" },
  ].concat(extra || []);

  const WIDGETS = {
    heading: {
      label: "عنوان", ic: "🔠", def: { text: "عنوان رائع هنا", tag: "h2", fs: { d: 38, m: 28 }, fw: "800", ta: { d: "center" } },
      ctl: [{ k: "text", l: "النص", t: "text", tab: "c" }, { k: "tag", l: "وسم HTML", t: "select", o: [["h1", "H1"], ["h2", "H2"], ["h3", "H3"], ["h4", "H4"], ["div", "DIV"], ["p", "P"]], tab: "c" }, { k: "link", l: "رابط (اختياري)", t: "text", tab: "c" }].concat(typoCtl()),
      html: (s, id) => { const t = ["h1", "h2", "h3", "h4", "h5", "h6", "div", "p"].includes(s.tag) ? s.tag : "h2"; const inner = `<span data-edit="text">${esc(s.text)}</span>`; return `<${t} class="pb-t pb-hd">${s.link ? `<a href="${esc(s.link)}" style="color:inherit">${inner}</a>` : inner}</${t}>`; },
      css: (c, sel, s) => emit(c, sel + " .pb-t", s, TYPO),
    },
    text: {
      label: "نص", ic: "📝", def: { html: "<p>اكتب نصك هنا. انقر مرتين على النص لتعديله مباشرة وتنسيقه (عريض، رابط، قائمة...).</p>", fs: { d: 17 }, lh: { d: 1.8 }, ta: { d: "start" } },
      ctl: [{ k: "html", l: "المحتوى (HTML)", t: "rich", tab: "c" }].concat(typoCtl()),
      html: s => `<div class="pb-t pb-tx" data-edit="html">${cleanHtml(s.html)}</div>`,
      css: (c, sel, s) => emit(c, sel + " .pb-t", s, TYPO),
    },
    image: {
      label: "صورة", ic: "🖼️", def: { src: "", alt: "", fit: "cover" },
      ctl: [{ k: "src", l: "الصورة", t: "image", tab: "c" }, { k: "alt", l: "نص بديل (SEO)", t: "text", tab: "c" }, { k: "link", l: "رابط عند النقر", t: "text", tab: "c" }, { k: "fit", l: "ملاءمة الصورة", t: "select", o: [["cover", "تغطية (cover)"], ["contain", "احتواء (contain)"], ["fill", "تمديد"]], tab: "s" }, { k: "rad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 500, tab: "s" }],
      html: (s, id, ctx) => { const src = s.src ? (/^(https?:|data:|\/)/.test(s.src) ? s.src : ctx.base + s.src) : ""; const im = src ? `<img src="${esc(src)}" alt="${esc(s.alt)}" loading="lazy" decoding="async">` : `<div class="pb-ph">🖼️ اختر صورة من الإعدادات</div>`; return s.link ? `<a href="${esc(s.link)}">${im}</a>` : im; },
      css: (c, sel, s) => { emit(c, sel + " img", s, [["rad", px("border-radius")], ["mh", v => `height:${num(v)}px;`]]); c.d.push(`${sel} img{width:100%;object-fit:${s.fit || "cover"};display:block}`); },
    },
    button: {
      label: "زر", ic: "🔘", def: { text: "اطلب الآن", kind: "link", link: "#", bgc: "#157a55", color: "#ffffff", hbg: "#0f5a3e", fs: { d: 18 }, fw: "800", brad: { d: 12 }, bpad: { d: [14, 32, 14, 32] }, al: { d: "center" } },
      ctl: [{ k: "text", l: "نص الزر", t: "text", tab: "c" }, { k: "kind", l: "نوع الزر", t: "select", o: [["link", "رابط"], ["whatsapp", "واتساب"], ["call", "اتصال هاتفي"]], tab: "c" }, { k: "link", l: "الرابط", t: "text", tab: "c" }, { k: "phone", l: "رقم (واتساب/اتصال) بصيغة دولية", t: "text", tab: "c" }, { k: "msg", l: "رسالة واتساب", t: "text", tab: "c" }, { k: "newTab", l: "فتح في تبويب جديد", t: "switch", tab: "c" },
        { k: "bgc", l: "لون الزر", t: "color", tab: "s" }, { k: "hbg", l: "لون الخلفية عند المرور", t: "color", tab: "s" }, { k: "color", l: "لون النص", t: "color", tab: "s" }, { k: "fs", l: "حجم الخط (px)", t: "num", r: 1, min: 10, max: 60, tab: "s" }, { k: "fw", l: "الوزن", t: "select", o: F_W, tab: "s" }, { k: "bpad", l: "حشو الزر", t: "dims", r: 1, tab: "s" }, { k: "brad", l: "تدوير زوايا الزر (px)", t: "num", r: 1, min: 0, max: 100, tab: "s" }, { k: "full", l: "عرض كامل", t: "switch", r: 1, tab: "s" }],
      html: (s, id, ctx) => { let href = s.link || "#", ex = ""; if (s.kind === "whatsapp") href = "https://wa.me/" + String(s.phone || ctx.wa || "").replace(/\D/g, "") + (s.msg ? "?text=" + encodeURIComponent(s.msg) : ""); else if (s.kind === "call") href = "tel:" + String(s.phone || "").replace(/[^\d+]/g, ""); if (s.newTab || s.kind === "whatsapp") ex = ' target="_blank" rel="noopener"'; return `<a class="pb-btn" href="${esc(href)}"${ex}><span data-edit="text">${esc(s.text)}</span></a>`; },
      css: (c, sel, s) => { emit(c, sel + " .pb-btn", s, [["bgc", raw("background")], ["color", raw("color")], ["fs", px("font-size")], ["fw", raw("font-weight")], ["bpad", v => dimsDecl("padding", v)], ["brad", px("border-radius")], ["full", v => v ? "display:block;width:100%;" : "display:inline-block;width:auto;"]]); if (s.hbg) c.d.push(`${sel} .pb-btn:hover{background:${s.hbg}!important}`); },
    },
    spacer: {
      label: "فراغ", ic: "↕️", def: { mh: { d: 40, m: 24 } }, ctl: [{ k: "mh", l: "الارتفاع (px)", t: "num", r: 1, min: 0, max: 600, tab: "c" }],
      html: () => `<div class="pb-sp"></div>`, css: (c, sel, s) => emit(c, sel + " .pb-sp", s, [["mh", px("height")]]), noMh: 1,
    },
    divider: {
      label: "فاصل", ic: "➖", def: { bs: "solid", bw: 2, bc: "#d9d2c3", dw: { d: 100 } },
      ctl: [{ k: "bs", l: "النمط", t: "select", o: [["solid", "متصل"], ["dashed", "متقطع"], ["dotted", "نقطي"], ["double", "مزدوج"]], tab: "c" }, { k: "bw", l: "السماكة (px)", t: "num", min: 1, max: 20, tab: "c" }, { k: "bc", l: "اللون", t: "color", tab: "c" }, { k: "dw", l: "العرض (%)", t: "num", r: 1, min: 5, max: 100, tab: "c" }],
      html: () => `<hr class="pb-hr">`, css: (c, sel, s) => { c.d.push(`${sel} .pb-hr{border:0;border-top:${num(s.bw) || 2}px ${s.bs || "solid"} ${s.bc || "#d9d2c3"};margin:0 auto}`); emit(c, sel + " .pb-hr", s, [["dw", pc("width")]]); },
    },
    video: {
      label: "فيديو", ic: "▶️", def: { url: "", ratio: "16/9" },
      ctl: [{ k: "url", l: "رابط YouTube / Vimeo / ملف mp4", t: "text", tab: "c" }, { k: "ratio", l: "النسبة", t: "select", o: [["16/9", "16:9"], ["4/3", "4:3"], ["1/1", "1:1"], ["9/16", "9:16 (عمودي)"]], tab: "c" }, { k: "rad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 100, tab: "s" }],
      html: s => { const u = String(s.url || "").trim(); let m; if (!u) return `<div class="pb-ph">▶️ ألصق رابط الفيديو في الإعدادات</div>`; if ((m = u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/))) return `<iframe class="pb-vid" src="https://www.youtube-nocookie.com/embed/${m[1]}" loading="lazy" allowfullscreen title="فيديو"></iframe>`; if ((m = u.match(/vimeo\.com\/(\d+)/))) return `<iframe class="pb-vid" src="https://player.vimeo.com/video/${m[1]}" loading="lazy" allowfullscreen title="فيديو"></iframe>`; if (/\.(mp4|webm)(\?|$)/i.test(u)) return `<video class="pb-vid" src="${esc(u)}" controls playsinline preload="metadata"></video>`; return `<div class="pb-ph">رابط فيديو غير مدعوم</div>`; },
      css: (c, sel, s) => { c.d.push(`${sel} .pb-vid{width:100%;aspect-ratio:${s.ratio || "16/9"};border:0;display:block;background:#000}`); emit(c, sel + " .pb-vid", s, [["rad", px("border-radius")]]); },
    },
    html: {
      label: "HTML مخصص", ic: "🧩", def: { code: "<div style=\"padding:20px;text-align:center\">HTML مخصص</div>" }, ctl: [{ k: "code", l: "الكود", t: "rich", tab: "c" }],
      html: s => `<div class="pb-raw">${s.code || ""}</div>`, css: () => { },
    },
    iconlist: {
      label: "قائمة أيقونات", ic: "✅", def: { items: "طبيعي 100%\nدفع عند الاستلام\nتوصيل لكل الولايات", icon: "✅", ic_c: "#157a55", fs: { d: 18 }, gap: { d: 10 } },
      ctl: [{ k: "items", l: "العناصر (سطر لكل عنصر)", t: "textarea", tab: "c" }, { k: "icon", l: "الأيقونة (إيموجي)", t: "text", tab: "c" }, { k: "ic_c", l: "لون الأيقونة", t: "color", tab: "s" }, { k: "gap", l: "التباعد (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }].concat(typoCtl().filter(c => c.k !== "ta")),
      html: s => `<ul class="pb-il">${String(s.items || "").split("\n").filter(x => x.trim()).map(x => `<li><i>${esc(s.icon || "✅")}</i><span>${esc(x)}</span></li>`).join("")}</ul>`,
      css: (c, sel, s) => { emit(c, sel + " .pb-il", s, TYPO.filter(x => x[0] !== "ta")); emit(c, sel + " .pb-il li", s, [["gap", px("margin-bottom")]]); if (s.ic_c) c.d.push(`${sel} .pb-il i{color:${s.ic_c}}`); },
    },
    iconbox: {
      label: "صندوق أيقونة", ic: "💠", def: { icon: "🌿", title: "ميزة رائعة", text: "وصف قصير يشرح الميزة للزبون.", al: { d: "center" }, isz: { d: 44 }, tc: "#173F35", xc: "#555555" },
      ctl: [{ k: "icon", l: "الأيقونة (إيموجي أو رمز)", t: "text", tab: "c" }, { k: "title", l: "العنوان", t: "text", tab: "c" }, { k: "text", l: "الوصف", t: "textarea", tab: "c" }, { k: "link", l: "رابط (اختياري)", t: "text", tab: "c" }, { k: "isz", l: "حجم الأيقونة (px)", t: "num", r: 1, min: 16, max: 140, tab: "s" }, { k: "tc", l: "لون العنوان", t: "color", tab: "s" }, { k: "xc", l: "لون الوصف", t: "color", tab: "s" }, { k: "tfs", l: "حجم العنوان (px)", t: "num", r: 1, min: 12, max: 60, tab: "s" }],
      html: s => { const b = `<div class="pb-ib"><div class="pb-ibi">${esc(s.icon)}</div><h3 data-edit="title">${esc(s.title)}</h3><p data-edit="text">${esc(s.text)}</p></div>`; return s.link ? `<a href="${esc(s.link)}" style="color:inherit;text-decoration:none">${b}</a>` : b; },
      css: (c, sel, s) => { emit(c, sel + " .pb-ibi", s, [["isz", px("font-size")]]); emit(c, sel + " .pb-ib h3", s, [["tfs", px("font-size")]]); if (s.tc) c.d.push(`${sel} .pb-ib h3{color:${s.tc}}`); if (s.xc) c.d.push(`${sel} .pb-ib p{color:${s.xc}}`); },
    },
    accordion: {
      label: "أسئلة شائعة", ic: "❓", def: { items: [{ q: "كيف أطلب المنتج؟", a: "اضغط على زر اطلب الآن واملأ بياناتك، ونتصل بك للتأكيد." }, { q: "هل الدفع عند الاستلام؟", a: "نعم، تدفع فقط عند وصول الطلب إليك." }], first: true, qbg: "#faf6ec", qc: "#173F35", ac: "#444444" },
      ctl: [{ k: "items", l: "الأسئلة", t: "rep", f: [["q", "السؤال"], ["a", "الجواب"]], tab: "c" }, { k: "first", l: "فتح الأول افتراضياً", t: "switch", tab: "c" }, { k: "qbg", l: "خلفية السؤال", t: "color", tab: "s" }, { k: "qc", l: "لون السؤال", t: "color", tab: "s" }, { k: "ac", l: "لون الجواب", t: "color", tab: "s" }, { k: "qfs", l: "حجم السؤال (px)", t: "num", r: 1, min: 12, max: 40, tab: "s" }],
      html: s => `<div class="pb-acc">${(s.items || []).map((it, i) => `<details${(s.first && i === 0) ? " open" : ""}><summary>${esc(it.q)}</summary><div>${esc(it.a)}</div></details>`).join("")}</div>`,
      css: (c, sel, s) => { if (s.qbg) c.d.push(`${sel} .pb-acc summary{background:${s.qbg}}`); if (s.qc) c.d.push(`${sel} .pb-acc summary{color:${s.qc}}`); if (s.ac) c.d.push(`${sel} .pb-acc details>div{color:${s.ac}}`); emit(c, sel + " .pb-acc summary", s, [["qfs", px("font-size")]]); },
    },
    counter: {
      label: "عدّاد", ic: "🔢", def: { n: 5000, pre: "+", suf: "", label: "زبون سعيد", fs: { d: 52 }, color: "#8a6a1a", lc: "#555555" },
      ctl: [{ k: "n", l: "الرقم", t: "num", tab: "c" }, { k: "pre", l: "قبل الرقم", t: "text", tab: "c" }, { k: "suf", l: "بعد الرقم", t: "text", tab: "c" }, { k: "label", l: "الوصف", t: "text", tab: "c" }, { k: "fs", l: "حجم الرقم (px)", t: "num", r: 1, min: 12, max: 160, tab: "s" }, { k: "color", l: "لون الرقم", t: "color", tab: "s" }, { k: "lc", l: "لون الوصف", t: "color", tab: "s" }],
      html: s => `<div class="pb-ct"><div class="pb-ctn"><span>${esc(s.pre)}</span><b data-count="${num(s.n) || 0}">${formatNum(num(s.n) || 0)}</b><span>${esc(s.suf)}</span></div><div class="pb-ctl" data-edit="label">${esc(s.label)}</div></div>`,
      css: (c, sel, s) => { emit(c, sel + " .pb-ctn", s, [["fs", px("font-size")], ["color", raw("color")]]); if (s.lc) c.d.push(`${sel} .pb-ctl{color:${s.lc}}`); },
    },
    countdown: {
      label: "عدّ تنازلي", ic: "⏳", def: { mode: "daily", end: "", cbg: "#173F35", color: "#ffffff", fs: { d: 34 }, crad: { d: 12 } },
      ctl: [{ k: "mode", l: "النوع", t: "select", o: [["daily", "يتجدد يومياً (حتى منتصف الليل)"], ["date", "حتى تاريخ محدد"]], tab: "c" }, { k: "end", l: "تاريخ الانتهاء", t: "datetime", tab: "c" }, { k: "cbg", l: "خلفية المربعات", t: "color", tab: "s" }, { k: "color", l: "لون الأرقام", t: "color", tab: "s" }, { k: "fs", l: "حجم الأرقام (px)", t: "num", r: 1, min: 14, max: 120, tab: "s" }, { k: "crad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }],
      html: s => { const b = (l) => `<div class="pb-cdb"><b data-u="${l[0]}">00</b><small>${l[1]}</small></div>`; return `<div class="pb-cd" data-mode="${esc(s.mode)}" data-end="${esc(s.end)}">${b(["d", "يوم"])}${b(["h", "ساعة"])}${b(["m", "دقيقة"])}${b(["s", "ثانية"])}</div>`; },
      css: (c, sel, s) => { emit(c, sel + " .pb-cdb", s, [["cbg", raw("background")], ["crad", px("border-radius")]]); emit(c, sel + " .pb-cdb b", s, [["color", raw("color")], ["fs", px("font-size")]]); },
    },
    testimonial: {
      label: "رأي زبون", ic: "💬", def: { img: "", name: "اسم الزبون", role: "ولاية الجزائر", text: "منتج رائع وتوصيل سريع، أنصح به بشدة.", stars: 5, tbg: "#ffffff", rad: { d: 16 } },
      ctl: [{ k: "img", l: "صورة الزبون", t: "image", tab: "c" }, { k: "name", l: "الاسم", t: "text", tab: "c" }, { k: "role", l: "الصفة/الولاية", t: "text", tab: "c" }, { k: "text", l: "الرأي", t: "textarea", tab: "c" }, { k: "stars", l: "النجوم (0-5)", t: "num", min: 0, max: 5, tab: "c" }, { k: "tbg", l: "الخلفية", t: "color", tab: "s" }, { k: "rad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }],
      html: (s, id, ctx) => `<div class="pb-ts"><div class="pb-tss">${"★".repeat(Math.max(0, Math.min(5, num(s.stars) ?? 5)))}</div><p data-edit="text">${esc(s.text)}</p><div class="pb-tsw">${s.img ? `<img src="${esc(/^(https?:|data:|\/)/.test(s.img) ? s.img : ctx.base + s.img)}" alt="" loading="lazy">` : ""}<div><b data-edit="name">${esc(s.name)}</b><small data-edit="role">${esc(s.role)}</small></div></div></div>`,
      css: (c, sel, s) => emit(c, sel + " .pb-ts", s, [["tbg", raw("background")], ["rad", px("border-radius")]]),
    },
    gallery: {
      label: "معرض صور", ic: "🏞️", def: { imgs: "", cols: { d: 3, t: 2, m: 2 }, gap: { d: 12 }, ratio: "1/1", rad: { d: 12 } },
      ctl: [{ k: "imgs", l: "روابط الصور (سطر لكل صورة)", t: "gallery", tab: "c" }, { k: "cols", l: "عدد الأعمدة", t: "num", r: 1, min: 1, max: 8, tab: "s" }, { k: "gap", l: "التباعد (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }, { k: "ratio", l: "نسبة الصورة", t: "select", o: [["1/1", "1:1"], ["4/3", "4:3"], ["3/4", "3:4"], ["16/9", "16:9"], ["auto", "أصلية"]], tab: "s" }, { k: "rad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }],
      html: (s, id, ctx) => { const L = String(s.imgs || "").split("\n").map(x => x.trim()).filter(Boolean); return L.length ? `<div class="pb-gal">${L.map(u => `<img src="${esc(/^(https?:|data:|\/)/.test(u) ? u : ctx.base + u)}" alt="" loading="lazy" decoding="async">`).join("")}</div>` : `<div class="pb-ph">🏞️ أضف صور المعرض من الإعدادات</div>`; },
      css: (c, sel, s) => { emit(c, sel + " .pb-gal", s, [["cols", v => `grid-template-columns:repeat(${Math.max(1, num(v) || 1)},1fr);`], ["gap", px("gap")]]); emit(c, sel + " .pb-gal img", s, [["rad", px("border-radius")]]); c.d.push(`${sel} .pb-gal img{width:100%;aspect-ratio:${s.ratio || "1/1"};object-fit:cover;display:block}`); },
    },
    products: {
      label: "منتجات المتجر", ic: "🛍️", def: { mode: "all", val: "", limit: 6, btn: "اطلب الآن", showOld: true, cols: { d: 3, t: 2, m: 2 }, gap: { d: 16 }, rad: { d: 16 }, cbg: "#ffffff", bbg: "#157a55" },
      ctl: [{ k: "mode", l: "المصدر", t: "select", o: [["all", "كل المنتجات"], ["tag", "حسب التبويب (best/hot/sale/new)"], ["cat", "حسب القسم (cat)"], ["slugs", "منتجات محددة (slugs)"]], tab: "c" }, { k: "val", l: "القيمة (وسم/قسم/قائمة slugs)", t: "text", tab: "c" }, { k: "limit", l: "الحد الأقصى للعدد (0 = الكل)", t: "num", min: 0, max: 60, tab: "c" }, { k: "btn", l: "نص الزر", t: "text", tab: "c" }, { k: "showOld", l: "إظهار السعر القديم", t: "switch", tab: "c" }, { k: "cols", l: "عدد الأعمدة", t: "num", r: 1, min: 1, max: 6, tab: "s" }, { k: "gap", l: "التباعد (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }, { k: "rad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }, { k: "cbg", l: "خلفية البطاقة", t: "color", tab: "s" }, { k: "bbg", l: "لون الزر", t: "color", tab: "s" }],
      html: (s, id, ctx) => `<div class="pb-prod" data-pbp='${esc(JSON.stringify({ mode: s.mode, val: s.val, limit: s.limit, btn: s.btn, showOld: s.showOld }))}'>${productsHtml(s, ctx.products, ctx.base)}</div>`,
      css: (c, sel, s) => { emit(c, sel + " .pb-pgrid", s, [["cols", v => `grid-template-columns:repeat(${Math.max(1, num(v) || 1)},1fr);`], ["gap", px("gap")]]); emit(c, sel + " .pb-pc", s, [["rad", px("border-radius")]]); if (s.cbg) c.d.push(`${sel} .pb-pc{background:${s.cbg}}`); if (s.bbg) c.d.push(`${sel} .pb-pcb{background:${s.bbg}}`); },
    },
    orderform: {
      label: "نموذج طلب سريع", ic: "🛒", def: { prod: "", title: "اطلب الآن — الدفع عند الاستلام", btn: "تأكيد الطلب", ok: "✅ تم استلام طلبك! سنتصل بك قريباً لتأكيده.", dt: true, bbg: "#157a55", fbg: "#ffffff", rad: { d: 16 }, pad: { d: [22, 22, 22, 22] } },
      ctl: [{ k: "prod", l: "المنتج", t: "select", o: () => [["", "— اختر المنتج —"]].concat(((typeof Admin !== "undefined" && Admin.products) || []).map(p => [p.slug, p.title])), tab: "c" }, { k: "title", l: "عنوان النموذج", t: "text", tab: "c" }, { k: "btn", l: "نص الزر", t: "text", tab: "c" }, { k: "ok", l: "رسالة النجاح", t: "textarea", tab: "c" }, { k: "dt", l: "اختيار نوع التوصيل (منزل/مكتب)", t: "switch", tab: "c" }, { k: "bbg", l: "لون الزر", t: "color", tab: "s" }, { k: "fbg", l: "خلفية النموذج", t: "color", tab: "s" }, { k: "rad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 60, tab: "s" }],
      html: (s, id, ctx) => { const p = (ctx.products || []).find(x => x.slug === s.prod); return `<form class="pb-of" data-prod="${esc(s.prod)}" data-dt="${s.dt === false ? 0 : 1}" data-ok="${esc(s.ok)}" novalidate onsubmit="return false"><h3>${esc(s.title)}</h3><div class="pb-of-prod">${p ? `<b>${esc(p.title)}</b> — ${formatNum(p.price)} دج` : "اختر منتجاً من الإعدادات"}</div><div class="pb-of-offers"></div><input name="name" placeholder="الاسم الكامل" autocomplete="name"><input name="phone" inputmode="numeric" placeholder="رقم الهاتف 05XXXXXXXX" autocomplete="tel-national"><select name="wilaya"><option value="">اختر الولاية</option></select><input name="commune" placeholder="البلدية"><div class="pb-of-dtype"></div><div class="pb-of-sum"></div><input class="pb-hp" name="website_url" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit" class="pb-of-btn">${esc(s.btn)}</button><div class="pb-of-msg" role="status"></div></form>`; },
      css: (c, sel, s) => { emit(c, sel + " .pb-of", s, [["rad", px("border-radius")]]); if (s.fbg) c.d.push(`${sel} .pb-of{background:${s.fbg}}`); if (s.bbg) c.d.push(`${sel} .pb-of-btn{background:${s.bbg}}`); },
    },
  };
  const ORDER = ["heading", "text", "image", "button", "products", "orderform", "iconbox", "iconlist", "gallery", "video", "accordion", "testimonial", "counter", "countdown", "divider", "spacer", "html"];

  /* ═════════════════ تعريف الأقسام/الأعمدة + الإعدادات المشتركة ═════════════════ */
  const common = (kind) => {
    const a = [
      { k: "mar", l: "الهامش الخارجي (px)", t: "dims", r: 1, tab: "s" },
      { k: "pad", l: "الحشو الداخلي (px)", t: "dims", r: 1, tab: "s" },
      { k: "bg", l: "لون الخلفية", t: "color", tab: "s" },
      { k: "grad1", l: "تدرّج: اللون الأول", t: "color", tab: "s" }, { k: "grad2", l: "تدرّج: اللون الثاني", t: "color", tab: "s" }, { k: "gradAng", l: "زاوية التدرّج", t: "num", min: 0, max: 360, tab: "s" },
      { k: "bgImg", l: "صورة الخلفية", t: "image", tab: "s" },
      { k: "bgSize", l: "حجم الخلفية", t: "select", o: [["cover", "تغطية"], ["contain", "احتواء"], ["auto", "أصلي"]], tab: "s" },
      { k: "bgPos", l: "موضع الخلفية", t: "select", o: [["center", "وسط"], ["top", "أعلى"], ["bottom", "أسفل"], ["left", "يسار"], ["right", "يمين"]], tab: "s" },
      { k: "bgFixed", l: "خلفية ثابتة (Parallax)", t: "switch", tab: "s" },
      { k: "bw", l: "سماكة الحد (px)", t: "num", min: 0, max: 40, tab: "s" }, { k: "bs", l: "نمط الحد", t: "select", o: [["solid", "متصل"], ["dashed", "متقطع"], ["dotted", "نقطي"]], tab: "s" }, { k: "bc", l: "لون الحد", t: "color", tab: "s" },
      { k: "rad", l: "تدوير الزوايا (px)", t: "num", r: 1, min: 0, max: 500, tab: "s" },
      { k: "shadow", l: "الظل", t: "select", o: [["", "بدون"], ["sm", "خفيف"], ["md", "متوسط"], ["lg", "كبير"], ["glow", "توهج"]], tab: "s" },
      { k: "op", l: "الشفافية (0-1)", t: "num", min: 0, max: 1, step: .05, tab: "s" },
    ];
    if (kind === "widget") a.unshift({ k: "w", l: "العرض (%)", t: "num", r: 1, min: 5, max: 100, tab: "s" }, { k: "mh", l: "الارتفاع الأدنى (px)", t: "num", r: 1, min: 0, max: 1200, tab: "s", skipFor: ["spacer", "image"] }, { k: "al", l: "موضع العنصر داخل العمود", t: "align", r: 1, tab: "s" });
    return a.concat([
      { k: "hd", l: "إخفاء على المكتب", t: "switch", tab: "a" }, { k: "ht", l: "إخفاء على التابلت", t: "switch", tab: "a" }, { k: "hm", l: "إخفاء على الهاتف", t: "switch", tab: "a" },
      { k: "anim", l: "حركة الظهور", t: "select", o: ANIMS, tab: "a" }, { k: "animDur", l: "مدة الحركة (ثانية)", t: "num", min: .1, max: 3, step: .1, tab: "a" }, { k: "animDelay", l: "تأخير الحركة (ثانية)", t: "num", min: 0, max: 5, step: .1, tab: "a" },
      { k: "z", l: "z-index", t: "num", min: 0, max: 999, tab: "a" },
      { k: "cls", l: "CSS Class", t: "text", tab: "a" }, { k: "cid", l: "CSS ID", t: "text", tab: "a" },
      { k: "css", l: "CSS مخصص (استعمل selector)", t: "textarea", tab: "a" },
    ]);
  };
  const SEC_CTL = [
    { k: "layout", l: "نوع التخطيط", t: "select", o: [["boxed", "محدود العرض"], ["full", "عرض كامل"]], tab: "c" },
    { k: "cw", l: "عرض المحتوى (px)", t: "num", r: 1, min: 280, max: 2000, tab: "c" },
    { k: "mh", l: "الارتفاع الأدنى (px)", t: "num", r: 1, min: 0, max: 1600, tab: "c" },
    { k: "va", l: "المحاذاة العمودية للأعمدة", t: "select", r: 1, o: [["flex-start", "أعلى"], ["center", "وسط"], ["flex-end", "أسفل"], ["stretch", "تمديد"]], tab: "c" },
    { k: "gap", l: "المسافة بين الأعمدة (px)", t: "num", r: 1, min: 0, max: 120, tab: "c" },
    { k: "rev", l: "عكس ترتيب الأعمدة", t: "switch", r: 1, tab: "c" },
    { k: "tag", l: "وسم HTML", t: "select", o: [["section", "section"], ["div", "div"], ["header", "header"], ["footer", "footer"]], tab: "c" },
    { k: "ovl", l: "طبقة فوق الخلفية (لون)", t: "color", tab: "s" }, { k: "ovlOp", l: "شفافية الطبقة (0-1)", t: "num", min: 0, max: 1, step: .05, tab: "s" },
  ];
  const COL_CTL = [
    { k: "w", l: "العرض (%)", t: "num", r: 1, min: 5, max: 100, tab: "c" },
    { k: "va", l: "محاذاة المحتوى عمودياً", t: "select", r: 1, o: [["flex-start", "أعلى"], ["center", "وسط"], ["flex-end", "أسفل"]], tab: "c" },
    { k: "ta", l: "محاذاة النص داخل العمود", t: "align", r: 1, tab: "c" },
  ];

  /* ═════════════════ النموذج + قوالب جاهزة ═════════════════ */
  const mkW = (type, set) => ({ id: uid(), type, set: Object.assign(clone(WIDGETS[type].def), set || {}) });
  const mkC = (widgets, set) => ({ id: uid(), set: set || {}, widgets: widgets || [] });
  const mkS = (cols, set) => ({ id: uid(), set: Object.assign({ layout: "boxed", cw: { d: 1140 }, pad: { d: [60, 20, 60, 20], m: [36, 16, 36, 16] }, gap: { d: 20 } }, set || {}), cols: cols || [mkC([])] });
  const TPLS = {
    hero: { n: "🚀 قسم رئيسي (Hero)", f: () => mkS([mkC([mkW("heading", { text: "منتجات طبيعية أصلية توصلك حتى الباب", tag: "h1", color: "#ffffff", fs: { d: 46, m: 28 } }), mkW("text", { html: "<p>الدفع عند الاستلام · توصيل لكل الولايات</p>", color: "#f1ebdd", ta: { d: "center" }, fs: { d: 20, m: 16 } }), mkW("button", { text: "تسوّق الآن" }), ])], { grad1: "#173F35", grad2: "#2f5d4f", gradAng: 135, pad: { d: [110, 20, 110, 20], m: [64, 16, 64, 16] }, mh: { d: 480, m: 360 }, va: { d: "center" } }) },
    features: { n: "✨ 3 مزايا", f: () => mkS([0, 1, 2].map(i => mkC([mkW("iconbox", { icon: ["🌿", "🚚", "💵"][i], title: ["طبيعي 100%", "توصيل سريع", "دفع عند الاستلام"][i] })])), {}) },
    products: { n: "🛍️ شبكة منتجات", f: () => mkS([mkC([mkW("heading", { text: "منتجاتنا", fs: { d: 34, m: 26 } }), mkW("products", {})])], { bg: "#F4EFE6" }) },
    testimonials: { n: "💬 آراء الزبائن", f: () => mkS([mkC([mkW("heading", { text: "ماذا قال زبائننا؟", fs: { d: 34, m: 26 } })])].concat([]), {}) },
    reviews3: { n: "⭐ 3 آراء", f: () => mkS([0, 1, 2].map(i => mkC([mkW("testimonial", { name: ["أمينة", "كريم", "سارة"][i], role: ["الجزائر", "وهران", "قسنطينة"][i] })])), { bg: "#faf6ec" }) },
    counters: { n: "🔢 أرقام وإنجازات", f: () => mkS([mkC([mkW("counter", { n: 5000, label: "زبون سعيد" })]), mkC([mkW("counter", { n: 58, pre: "", label: "ولاية نغطيها" })]), mkC([mkW("counter", { n: 30, pre: "+", label: "منتج طبيعي" })])], { bg: "#ffffff" }) },
    cta: { n: "🔥 عرض محدود + عدّ تنازلي", f: () => mkS([mkC([mkW("heading", { text: "عرض ينتهي قريباً!", color: "#ffffff" }), mkW("countdown", { cbg: "#ffffff", color: "#173F35" }), mkW("button", { text: "احجز طلبك الآن", bgc: "#C8A24B", color: "#173F35" })])], { bg: "#b83232", pad: { d: [60, 20, 60, 20] } }) },
    faq: { n: "❓ الأسئلة الشائعة", f: () => mkS([mkC([mkW("heading", { text: "أسئلة شائعة", fs: { d: 34, m: 26 } }), mkW("accordion", {})])], { cw: { d: 820 } }) },
    split: { n: "🪟 صورة + نص", f: () => mkS([mkC([mkW("image", {})], { w: { d: 45 } }), mkC([mkW("heading", { text: "لماذا نحن؟", ta: { d: "start" }, fs: { d: 32, m: 24 } }), mkW("text", {}), mkW("iconlist", {}), mkW("button", { text: "اطلب الآن", al: { d: "start" } })], { w: { d: 55 }, va: { d: "center" } })], { va: { d: "center" } }) },
  };
  const newPage = (title, slug) => ({ v: 1, title: title || "صفحة جديدة", slug: slug || "", desc: "", bg: "#ffffff", ff: "", header: true, footer: true, css: "", sections: [TPLS.hero.f()] });

  /* ═════════════════ المُصيِّر (Renderer): نفس الدالة للمحرر وللصفحة المنشورة ═════════════════ */
  function renderSections(page, ctx) {
    const css = newCss(); css.base = ctx.base;
    const edit = !!ctx.edit;
    const attrs = (n, kind, s) => `${edit ? ` data-pb="${n.id}" data-kind="${kind}"` : ""}${s.cid ? ` id="${esc(s.cid)}"` : ""}${edit ? "" : animAttr(s)}`;
    const common2 = (sel, s, spec) => { boxStatic(css, sel, s); emit(css, sel, s, spec); hideRules(css, sel, s, edit); customCss(css, sel, s); };
    const html = page.sections.map(sec => {
      const s = sec.set, sx = `.pb-sec.x-${sec.id}`, inx = `${sx}>.pb-in`;
      common2(sx, s, [["mar", v => dimsDecl("margin", v)], ["pad", v => dimsDecl("padding", v)], ["rad", px("border-radius")], ["mh", px("min-height")]]);
      if (s.ovl) css.d.push(`${sx}>.pb-ov{position:absolute;inset:0;background:${s.ovl};opacity:${num(s.ovlOp) ?? .5};pointer-events:none}`);
      if (s.mh) css.d.push(`${sx}{display:flex;flex-direction:column;justify-content:center}`);
      css.d.push(`${inx}{display:flex;flex-wrap:wrap;margin:0 auto;width:100%;position:relative}`);
      css.d.push(`${inx}{max-width:${s.layout === "full" ? "none" : (num(own(s, "cw", "d")) || 1140) + "px"}}`);
      if (s.layout !== "full") emit(css, inx, s, [["cw", v => `max-width:${num(v)}px;`]]);
      emit(css, inx, s, [["va", raw("align-items")], ["rev", (v, st, dev) => v ? (dev === "m" ? "flex-direction:column-reverse;flex-wrap:nowrap;" : "flex-direction:row-reverse;") : "flex-direction:row;flex-wrap:wrap;"]]);
      emit(css, `${sx}>.pb-in>.pb-col`, s, [["gap", v => `padding-left:${(num(v) || 0) / 2}px;padding-right:${(num(v) || 0) / 2}px;`]]);
      const cols = sec.cols.map(col => {
        const cs = col.set, cx = `.pb-col.x-${col.id}`, cin = `${cx}>.pb-colin`;
        css.d.push(`${cx}{flex:1 1 0;min-width:0;display:flex}`);
        css.d.push(`${cin}{width:100%;display:flex;flex-direction:column}`);
        boxStatic(css, cin, cs); emit(css, cin, cs, [["mar", v => dimsDecl("margin", v)], ["pad", v => dimsDecl("padding", v)], ["rad", px("border-radius")], ["va", raw("justify-content")], ["ta", raw("text-align")]]);
        emit(css, cx, cs, [["w", v => `flex:0 0 ${num(v)}%;width:${num(v)}%;max-width:${num(v)}%;`]]);
        hideRules(css, cx, cs, edit); customCss(css, cx, cs);
        const ws = col.widgets.map(w => {
          const def = WIDGETS[w.type]; if (!def) return ""; const wsx = `.pb-w.x-${w.id}`, s2 = w.set;
          boxStatic(css, wsx, s2);
          emit(css, wsx, s2, [["w", v => `width:${num(v)}%;`], ["mar", v => dimsDecl("margin", v)], ["pad", v => dimsDecl("padding", v)], ["rad", px("border-radius")], ["mh", v => (def.noMh || w.type === "image") ? "" : `min-height:${num(v)}px;`],
            ["al", v => (v === "center" ? "margin-left:auto;margin-right:auto;" : v === "end" ? "margin-inline-start:auto;margin-inline-end:0;" : "margin-inline-end:auto;margin-inline-start:0;") + `text-align:${v === "center" ? "center" : v === "end" ? "end" : "start"};`]]);
          def.css(css, wsx, s2);
          if (w.type === "image") emit(css, wsx + " img", s2, [["mh", px("height")]]);
          hideRules(css, wsx, s2, edit); customCss(css, wsx, s2);
          return `<div class="pb-w x-${w.id}${s2.cls ? " " + esc(s2.cls) : ""}"${attrs(w, "widget", s2)} data-type="${w.type}">${def.html(s2, w.id, ctx)}</div>`;
        }).join("");
        return `<div class="pb-col x-${col.id}${cs.cls ? " " + esc(cs.cls) : ""}"${attrs(col, "column", cs)}><div class="pb-colin">${ws || (edit ? '<div class="pb-empty">＋ اسحب عنصراً إلى هنا</div>' : "")}</div></div>`;
      }).join("");
      const tag = ["section", "div", "header", "footer"].includes(s.tag) ? s.tag : "section";
      return `<${tag} class="pb-sec x-${sec.id}${s.cls ? " " + esc(s.cls) : ""}"${attrs(sec, "section", s)}>${s.ovl ? '<div class="pb-ov"></div>' : ""}<div class="pb-in">${cols}</div></${tag}>`;
    }).join("");
    return { html, css: finishCss(css) };
  }

  /* CSS الأساسي للمكوّنات (مشترك بين المحرر والصفحة المنشورة) */
  const BASE_CSS = `
*{box-sizing:border-box}
.pb-page{margin:0;font-family:'Cairo','Segoe UI',Tahoma,sans-serif;color:#1c2420;line-height:1.6;-webkit-font-smoothing:antialiased}
.pb-page img{max-width:100%}
.pb-sec{position:relative}
.pb-w{margin-bottom:16px;max-width:100%}.pb-colin>.pb-w:last-child{margin-bottom:0}
.pb-t{margin:0}.pb-tx p{margin:0 0 .8em}.pb-tx>:last-child{margin-bottom:0}
.pb-btn{display:inline-block;text-decoration:none;text-align:center;cursor:pointer;transition:background .2s,transform .15s}.pb-btn:hover{transform:translateY(-2px)}
.pb-ph{background:#f1ede2;border:2px dashed #cfc6b0;color:#8a8472;padding:28px;text-align:center;border-radius:12px;font-size:.95rem}
.pb-hr{height:0}.pb-il{list-style:none;margin:0;padding:0}.pb-il li{display:flex;gap:.6rem;align-items:flex-start}.pb-il li:last-child{margin-bottom:0!important}
.pb-ib{padding:8px}.pb-ibi{line-height:1.1;margin-bottom:.4rem}.pb-ib h3{margin:0 0 .4rem;font-size:1.25rem;font-weight:800}.pb-ib p{margin:0}
.pb-acc details{margin-bottom:10px;border:1px solid #e6dfcf;border-radius:12px;overflow:hidden;background:#fff}.pb-acc summary{cursor:pointer;padding:14px 18px;font-weight:800;list-style:none}.pb-acc summary::-webkit-details-marker{display:none}.pb-acc summary:after{content:'＋';float:inline-end}.pb-acc details[open] summary:after{content:'－'}.pb-acc details>div{padding:14px 18px;line-height:1.8}
.pb-ct{text-align:center}.pb-ctn{font-weight:900;line-height:1.1}.pb-ctl{font-weight:700;margin-top:.3rem}
.pb-cd{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.pb-cdb{padding:12px 16px;text-align:center;min-width:76px}.pb-cdb b{display:block;font-weight:900;line-height:1.1}.pb-cdb small{font-size:.75rem;opacity:.85}
.pb-ts{padding:22px;box-shadow:0 6px 24px rgba(0,0,0,.07);height:100%}.pb-tss{color:#e0a800;letter-spacing:2px;margin-bottom:.4rem}.pb-ts p{margin:0 0 .8rem;line-height:1.8}.pb-tsw{display:flex;gap:.7rem;align-items:center}.pb-tsw img{width:46px;height:46px;border-radius:50%;object-fit:cover}.pb-tsw small{display:block;color:#777}
.pb-gal{display:grid}
.pb-pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.pb-pc{background:#fff;border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;box-shadow:0 6px 20px rgba(0,0,0,.07);transition:transform .2s}.pb-pc:hover{transform:translateY(-4px)}.pb-pci{position:relative;aspect-ratio:1/1;background:#f4efe6}.pb-pci img{width:100%;height:100%;object-fit:cover}.pb-pcd{position:absolute;top:10px;right:10px;background:#b83232;color:#fff;font-weight:800;font-size:.8rem;border-radius:999px;padding:.2rem .6rem;z-index:1}.pb-pc h3{margin:.8rem .9rem .3rem;font-size:1.02rem;font-weight:800}.pb-pcp{margin:0 .9rem .6rem}.pb-pcp b{color:#157a55;font-size:1.1rem}.pb-pcp s{color:#777;margin-inline-start:.5rem;font-size:.9rem}.pb-pcb{margin:auto .9rem .9rem;background:#157a55;color:#fff;text-align:center;border-radius:10px;padding:.55rem;font-weight:800}
.pb-of{box-shadow:0 8px 28px rgba(0,0,0,.1);display:flex;flex-direction:column;gap:10px}.pb-of h3{margin:0 0 4px;font-size:1.25rem;font-weight:900;color:#173f35}.pb-of input,.pb-of select{width:100%;border:1.5px solid #ddd5c3;border-radius:10px;padding:.7rem .8rem;font:inherit;background:#fff}.pb-of .pb-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}.pb-of-prod{background:#faf6ec;border-radius:10px;padding:.6rem .8rem;font-size:.95rem}.pb-of-offers label,.pb-of-dtype label{display:flex;gap:.5rem;align-items:center;padding:.45rem .6rem;border:1.5px solid #e6dfcf;border-radius:10px;margin-bottom:6px;cursor:pointer;font-weight:700}.pb-of-offers input,.pb-of-dtype input{width:auto}.pb-of-sum{font-weight:800;color:#173f35}.pb-of-btn{border:0;color:#fff;font:inherit;font-weight:900;padding:.85rem;border-radius:12px;cursor:pointer;font-size:1.05rem}.pb-of-btn:disabled{opacity:.6}.pb-of-msg{font-weight:800;text-align:center}.pb-of-msg.bad{color:#b83232}.pb-of-msg.good{color:#157a55}
.pb-empty-note{padding:24px;text-align:center;color:#888}
.pb-vid{display:block}
.pb-hdr{background:#fff;border-bottom:1px solid #eae3d6;position:sticky;top:0;z-index:50}.pb-hdr div{max-width:1140px;margin:0 auto;padding:.8rem 20px;display:flex;align-items:center;justify-content:space-between}.pb-hdr a.lg{font-weight:900;font-size:1.4rem;color:#173f35;text-decoration:none}.pb-hdr a.wa{background:#157a55;color:#fff;border-radius:10px;padding:.45rem 1rem;text-decoration:none;font-weight:800}
.pb-ftr{background:#0f2e26;color:#c7d3cd;text-align:center;padding:24px 16px;font-size:.9rem}.pb-ftr a{color:#f0d39d}
[data-anim]{opacity:0;transition:opacity var(--ad,.6s) ease var(--ade,0s),transform var(--ad,.6s) ease var(--ade,0s)}[data-anim=fadeUp]{transform:translateY(30px)}[data-anim=fadeDown]{transform:translateY(-30px)}[data-anim=zoomIn]{transform:scale(.88)}[data-anim=slideStart]{transform:translateX(40px)}[data-anim].pb-in-view{opacity:1;transform:none}
@media(max-width:${BP.m}px){.pb-hdr a.wa{display:none}}
@media(prefers-reduced-motion:reduce){[data-anim]{opacity:1!important;transform:none!important;transition:none}}`;

  /* سكربت الصفحة المنشورة: حركات الظهور + العدّادات + العدّ التنازلي + تحديث الأسعار من data.js */
  const RUNTIME_JS = `(function(){
var $=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('pb-in-view');io.unobserve(e.target);var c=e.target.querySelector('[data-count]');if(c&&!c.dataset.done){c.dataset.done=1;var to=+c.dataset.count,t0=performance.now();(function f(t){var p=Math.min(1,(t-t0)/1200);c.textContent=Math.round(to*p).toLocaleString('fr-FR');if(p<1)requestAnimationFrame(f)})(t0)}}})},{threshold:.15});$('[data-anim],.pb-ct').forEach(function(n){io.observe(n)})}else{$('[data-anim]').forEach(function(n){n.classList.add('pb-in-view')})}
function tick(){$('.pb-cd').forEach(function(el){var end;if(el.dataset.mode==='date'&&el.dataset.end){end=new Date(el.dataset.end).getTime()}else{var d=new Date();d.setHours(23,59,59,999);end=d.getTime()}var s=Math.max(0,Math.floor((end-Date.now())/1000)),v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};for(var k in v){var b=el.querySelector('[data-u='+k+']');if(b)b.textContent=('0'+v[k]).slice(-2)}})}
tick();setInterval(tick,1000);
if(window.PRODUCTS){$('.pb-prod').forEach(function(n){try{n.innerHTML=__pbProducts(JSON.parse(n.getAttribute('data-pbp')),window.PRODUCTS,__pbBase)}catch(e){}})}
})();`;

  const ORDER_JS = String.raw`(function(){
var forms=[].slice.call(document.querySelectorAll('.pb-of'));if(!forms.length)return;
var guard={};try{fetch(__pbBase+'assets/data/checkout.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():{}}).then(function(j){guard=(j&&j.guard)||{}}).catch(function(){})}catch(e){}
function fmt(n){return Number(n).toLocaleString('fr-FR')+' دج'}
function normPhone(v){var d=String(v||'').replace(/\D/g,'');if(d.indexOf('00213')===0)d='0'+d.slice(5);else if(d.indexOf('213')===0&&d.length>10)d='0'+d.slice(3);return d.slice(0,10)}
forms.forEach(function(f){
 var P=(window.PRODUCTS||[]).filter(function(x){return x.slug===f.getAttribute('data-prod')})[0],W=window.WILAYAS||[];
 var q=function(n){return f.querySelector('[name='+n+']')},ws=q('wilaya'),sum=f.querySelector('.pb-of-sum'),msg=f.querySelector('.pb-of-msg'),btn=f.querySelector('.pb-of-btn');
 if(!P){msg.textContent='اختر منتجاً للنموذج';return}
 ws.innerHTML='<option value="">اختر الولاية</option>'+W.map(function(w){return '<option value="'+w.id+'">'+w.id+' - '+w.name+'</option>'}).join('');
 var offers=(P.offers&&P.offers.length?P.offers:[{qty:1,price:P.price,free:0}]);
 var ob=f.querySelector('.pb-of-offers');if(offers.length>1){ob.innerHTML=offers.map(function(o,i){var n=o.qty+(o.free||0);return '<label><input type="radio" name="offer" value="'+i+'"'+(i===0?' checked':'')+'> '+n+' قطع'+(o.free?' (منها '+o.free+' مجاناً)':'')+' — '+fmt(o.price)+'</label>'}).join('')}
 var db=f.querySelector('.pb-of-dtype');if(f.getAttribute('data-dt')==='1'){db.innerHTML='<label><input type="radio" name="dtype" value="home" checked> توصيل للمنزل</label><label><input type="radio" name="dtype" value="stop"> استلام من مكتب التوصيل</label>'}
 function cur(){var r=f.querySelector('[name=offer]:checked'),o=offers[r?+r.value:0],w=W.filter(function(x){return String(x.id)===ws.value})[0],dt=(f.querySelector('[name=dtype]:checked')||{}).value||'home';var fee=(P.freeShip||!w)?0:(dt==='stop'?w.stop:w.home);return {o:o,w:w,dt:dt,fee:fee,total:o.price+fee}}
 function upd(){var c=cur();sum.textContent=c.w?('المنتج: '+fmt(c.o.price)+' + التوصيل: '+(c.fee?fmt(c.fee):'مجاني')+' = الإجمالي '+fmt(c.total)):'اختر الولاية لحساب التوصيل'}
 f.addEventListener('change',upd);upd();
 q('phone').addEventListener('input',function(){this.value=normPhone(this.value)});
 f.addEventListener('submit',async function(e){e.preventDefault();msg.className='pb-of-msg';
  var name=q('name').value.trim(),phone=normPhone(q('phone').value),c=cur();
  if(!name||!phone||!c.w){msg.className='pb-of-msg bad';msg.textContent='يرجى ملء الاسم والهاتف والولاية';return}
  if(!/^0[567]\d{8}$/.test(phone)&&(window.CONFIG&&CONFIG.SITE&&CONFIG.SITE.country||'DZ')==='DZ'&&guard.phoneDz!==false){msg.className='pb-of-msg bad';msg.textContent='رقم الهاتف يجب أن يتكون من 10 أرقام ويبدأ بـ 05 أو 06 أو 07';return}
  var n=c.o.qty+(c.o.free||0),order={name:name,phone:phone,wilaya:c.w.name,commune:q('commune').value.trim(),dtype:c.dt,items:[{slug:P.slug,title:P.title,qty:n,price:Math.round(c.o.price/n)}],subtotal:c.o.price,fee:c.fee,total:c.total,coupon:'',discount:0,extra:{'📄 صفحة هبوط':location.pathname}};
  btn.disabled=true;
  try{
   if(guard.antibot){var t='';try{t=await API.formToken()}catch(x){}order.hp=q('website_url').value;order.ftok=t||''}
   var r=await API.submitOrderChecked(order);
   if(r&&r.error){msg.className='pb-of-msg bad';msg.textContent=({duplicate_order:'لقد أرسلتَ طلباً لهذا المنتج مؤخراً ✅ سنتواصل معك قريباً.',bot:'تعذّر إرسال الطلب، أعد المحاولة.',rate_limited:'محاولات كثيرة، انتظر قليلاً.',invalid_phone:'رقم الهاتف غير صالح.'})[r.error]||'تعذّر الإرسال';btn.disabled=false;return}
   msg.className='pb-of-msg good';msg.textContent=f.getAttribute('data-ok')||'✅ تم استلام طلبك';f.querySelectorAll('input,select').forEach(function(i){i.disabled=true});
  }catch(err){msg.className='pb-of-msg bad';msg.textContent='تعذّر الإرسال، أعد المحاولة أو راسلنا على واتساب';btn.disabled=false}
 });
});
})();`;

  function fullHtml(page, ctx) {
    const r = renderSections(page, Object.assign({ base: "../../", edit: false }, ctx));
    const site = ctx.site || {}, url = (site.domain ? "https://" + site.domain : "") + "/lp/" + page.slug + "/";
    const hdr = page.header ? `<header class="pb-hdr"><div><a class="lg" href="${esc(ctx.base)}">${esc(site.name || "المتجر")}</a>${site.wa ? `<a class="wa" href="https://wa.me/${esc(String(site.wa).replace(/\D/g, ""))}" target="_blank" rel="noopener">واتساب</a>` : ""}</div></header>` : "";
    const ftr = page.footer ? `<footer class="pb-ftr">© ${new Date().getFullYear()} ${esc(site.name || "")} — جميع الحقوق محفوظة · <a href="${esc(ctx.base)}">العودة للمتجر</a></footer>` : "";
    const hasProd = JSON.stringify(page.sections).includes('"type":"products"');
    const hasOrder = JSON.stringify(page.sections).includes('"type":"orderform"');
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${ctx.baseHref ? `<base href="${esc(ctx.baseHref)}">` : ""}
<title>${esc(page.title)}${site.name ? " — " + esc(site.name) : ""}</title>
<meta name="description" content="${esc(page.desc || "")}">
<link rel="canonical" href="${esc(url)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.desc || "")}"><meta property="og:url" content="${esc(url)}">
<link rel="icon" href="${esc(ctx.base)}assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<style>${BASE_CSS}
.pb-page{background:${esc(page.bg || "#fff")}${page.ff ? ";font-family:" + page.ff : ""}}
${r.css}
${page.css || ""}</style></head>
<body class="pb-page">${hdr}<main>${r.html}</main>${ftr}
${(hasProd || hasOrder) ? `<script src="${esc(ctx.base)}assets/js/data.js"><\/script>` : ""}${hasOrder ? ["config", "wilayas", "api"].map(n => `<script src="${esc(ctx.base)}assets/js/${n}.js"><\/script>`).join("") : ""}
<script>var __pbBase=${JSON.stringify(ctx.base)};${hasProd ? "var __pbProducts=" + productsHtml.toString() + ";" : ""}${RUNTIME_JS}${hasOrder ? ";var REL=__pbBase;" + ORDER_JS : ""}<\/script>
</body></html>`;
  }

  return { DEVS, BP, DEVNAME, DEVIC, uid, esc, clone, isObj, num, own, eff, setR, WIDGETS, ORDER, TPLS, SEC_CTL, COL_CTL, common, mkW, mkC, mkS, newPage, renderSections, fullHtml, BASE_CSS, RUNTIME_JS, productsHtml, cleanHtml };
})();
