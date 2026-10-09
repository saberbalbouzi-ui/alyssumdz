/* الهيدر والفوتر وزر المشاركة — تُدار من لوحة التحكم ← «الهيدر» و«الفوتر» وتُحفظ في assets/data/chrome.json.
   تعمل على الرئيسية وكل صفحات المنتجات (تحمّلها app.js تلقائياً). بلا ملف إعدادات يبقى الموقع كما هو، عدا زر المشاركة الافتراضي.
   تعتمد على assets/js/social-icons.js. تُستعمل كذلك في معاينة اللوحة (Chrome.headerHtml / footerHtml). */
window.Chrome = (function () {
  const SI = () => window.SocialIcons, esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* نص بسيط: **غامق** وأسطر جديدة */
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const abs = u => /^(https?:|\/\/|#|tel:|mailto:|sms:|viber:|\/)/i.test(u || "");
  const url = (u, rel) => !u ? "#" : (abs(u) ? u : (rel || "") + u);

  const HEAD_IDS = ["logo", "menu", "social", "share", "cart"], FOOT_IDS = ["about", "links", "contact", "social", "custom"];

  /* ── عناوين القائمة الذكية: الرئيسية / التصنيفات / المتجر / الفئات / المنتجات / حسابي ──
     التصنيفات والفئات والمنتجات تفتح قائمة منسدلة تحت العنوان؛ المتجر صفحة كل المنتجات (shop.html)، وحسابي صفحة الدخول/التسجيل (account.html) */
  const HIDE_OPTS = [["", "تظهر في كل الأجهزة"], ["d", "إخفاء في المكتب"], ["t", "إخفاء في التابلت"], ["m", "إخفاء في الهاتف"], ["tm", "إخفاء في التابلت والهاتف"], ["dt", "إخفاء في المكتب والتابلت"], ["dm", "إخفاء في المكتب والهاتف"]];
  const MK = { home: ["الرئيسية", "index.html"], shop: ["المتجر", "shop.html"], cats: ["التصنيفات", "index.html#categories", 1], sets: ["الفئات", "shop.html", 1], prods: ["المنتجات", "index.html#products", 1], acct: ["حسابي", "account.html"] };
  const MK_LIST = [["home", "🏠 الرئيسية"], ["cats", "🗂️ التصنيفات (قائمة منسدلة بتصنيفات المتجر)"], ["shop", "🛍️ المتجر (صفحة كل المنتجات)"], ["sets", "⭐ الفئات (الأكثر طلباً / تخفيضات / جديدة)"], ["prods", "📦 المنتجات (قائمة منسدلة)"], ["acct", "👤 حسابي (دخول / حساب جديد)"]];
  const DEF_SETS = [{ key: "best", label: "الأكثر مبيعاً" }, { key: "hot", label: "الأكثر طلباً" }, { key: "sale", label: "التخفيضات" }, { key: "new", label: "المنتجات الجديدة" }];
  const prodHref = (p, rel) => typeof productHref === "function" ? productHref(p) : (rel || "") + "p/" + p.slug + "/";
  /* محتوى القائمة المنسدلة (d = {cats, prods, sets}: تُمرَّر من منشئ الصفحات أو تُقرأ وقت التشغيل من data.js) */
  function popHtml(kind, slugs, rel, d) {
    d = d || {}; const lab = t => typeof ModernIcons !== "undefined" ? ModernIcons.html(esc(t)) : esc(t), A = (h, t) => '<a href="' + esc(url(h, rel)) + '" role="menuitem">' + lab(t) + "</a>", all = A("shop.html", "عرض الكل ←");
    if (kind === "cats") { const c = d.cats || {}, ks = Object.keys(c); return all + ks.map(k => A("shop.html?cat=" + encodeURIComponent(k), c[k])).join(""); }
    if (kind === "sets") return all + (d.sets && d.sets.length ? d.sets : DEF_SETS).map(x => A("shop.html?c=" + encodeURIComponent(x.key), x.label)).join("");
    if (kind === "prods") { let L = (d.prods || []).filter(p => p && p.slug && p.active !== false); if (slugs && slugs.length) L = slugs.map(sl => L.find(p => p.slug === sl)).filter(Boolean); const mega = !(slugs && slugs.length), img = p => { const m = p.cover || (p.images && p.images[0]); return m ? '<img src="' + esc(url(m, rel)) + '" alt="" width="44" height="44" loading="lazy">' : ""; }; return all + L.map(p => '<a href="' + esc(prodHref(p, rel)) + '" role="menuitem">' + (mega ? img(p) + "<span>" + lab(p.title) + "</span>" : lab(p.title)) + "</a>").join(""); }
    return "";
  }
  function menuItem(it, rel, d) {
    const m = MK[it.kind], vh = it.vh ? ' data-vh="' + esc(it.vh) + '"' : "";
    if (!m) return '<a' + vh + ' href="' + esc(url(it.url, rel)) + '">' + esc(it.label) + "</a>";
    const label = it.label || m[0];
    if (!m[2]) return '<a' + vh + ' href="' + esc(url(m[1], rel)) + '">' + esc(label) + "</a>";
    const sl = Array.isArray(it.slugs) ? it.slugs : [];
    return '<div class="mi-dd' + (it.kind === "prods" && !sl.length ? " mi-mega" : "") + '"' + vh + ' data-dd="' + it.kind + '"' + (sl.length ? ' data-slugs="' + esc(sl.join(",")) + '"' : "") + '><a href="' + esc(url(m[1], rel)) + '" class="mi-t" aria-haspopup="true" aria-expanded="false">' + (typeof ModernIcons !== "undefined" ? ModernIcons.html(esc(label)) : esc(label)) + ' <i class="mi-c" aria-hidden="true">▾</i></a><div class="mi-pop" role="menu">' + popHtml(it.kind, sl, rel, d) + "</div></div>";
  }
  const BURGER = '<button type="button" class="mb-burger" aria-label="القائمة" aria-expanded="false"><svg class="b1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="b2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  const menuNav = (items, rel, d) => { const L = (items || []).filter(i => i && !i.h && (MK[i.kind] || (i.label && i.url))); return L.length ? BURGER + '<nav class="menu">' + L.map(i => menuItem(i, rel, d)).join("") + "</nav>" : ""; };
  /* تعبئة القوائم المنسدلة وقت التشغيل من بيانات الموقع الحالية */
  async function fillMenus(root) {
    const els = (root || document).querySelectorAll(".mi-dd[data-dd]"); if (!els.length) return;
    const d = {}; try { if (typeof CATEGORIES !== "undefined") d.cats = CATEGORIES; } catch (e) { } try { if (typeof PRODUCTS !== "undefined") d.prods = PRODUCTS; } catch (e) { }
    if (d.prods && typeof loadCollections === "function") { try { const cs = (await loadCollections()).filter(c => c.enabled !== false && d.prods.some(p => p.active !== false && (p.tags || []).includes(c.key))); if (cs.length) d.sets = cs.map(c => ({ key: c.key, label: c.label || c.title })); } catch (e) { } }
    const rel = typeof REL !== "undefined" ? REL : "";
    els.forEach(el => { const k = el.dataset.dd, sl = (el.dataset.slugs || "").split(",").filter(Boolean), dd = k === "cats" && !d.cats ? null : k === "prods" && !d.prods ? null : d; if (!dd) return; const pop = el.querySelector(".mi-pop"); if (pop) pop.innerHTML = popHtml(k, sl, rel, dd); });
  }
  const hov = () => { try { return matchMedia("(hover:hover)").matches; } catch (e) { return false; } };
  function bindMenus() {
    if (Chrome._mb) return; Chrome._mb = true;
    document.addEventListener("click", e => {
      const bg = e.target.closest && e.target.closest(".mb-burger");
      document.querySelectorAll("nav.menu.mob-open").forEach(n => { const own = bg && bg.parentNode.contains(n); if (!own && !(e.target.closest && e.target.closest("nav.menu"))) { n.classList.remove("mob-open"); const b = n.parentNode.querySelector(".mb-burger"); if (b) { b.classList.remove("on"); b.setAttribute("aria-expanded", "false"); } } });
      if (bg) { const nav = bg.parentNode.querySelector("nav.menu"); if (nav) { const on = nav.classList.toggle("mob-open"); bg.classList.toggle("on", on); bg.setAttribute("aria-expanded", on ? "true" : "false"); } return; }
      const t = e.target.closest && e.target.closest(".mi-dd > .mi-t");
      document.querySelectorAll(".mi-dd.open").forEach(x => { if (!t || x !== t.parentNode) { x.classList.remove("open"); const a = x.querySelector(".mi-t"); if (a) a.setAttribute("aria-expanded", "false"); } });
      if (t) { e.preventDefault(); if (hov() && !t.closest("nav.menu.mob-open")) return; const dd = t.parentNode, on = dd.classList.toggle("open"); t.setAttribute("aria-expanded", on ? "true" : "false"); }      /* بالفأرة تُفتح القائمة بالمرور وتُغلق بمغادرتها؛ بالنقر فقط في اللمس ولوحة الجوال */
    });
    document.addEventListener("mouseout", e => { const dd = e.target.closest && e.target.closest(".mi-dd"); if (dd && hov() && !dd.closest("nav.menu.mob-open") && !(e.relatedTarget && dd.contains(e.relatedTarget))) { dd.classList.remove("open"); const a = dd.querySelector(".mi-t"); if (a) a.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".mi-dd.open").forEach(x => x.classList.remove("open")); });
  }
  const MENU_CSS = "@media(min-width:1025px){body:not(.pb-edit) [data-vh*=\"d\"]{display:none!important}}@media(min-width:768px) and (max-width:1024px){body:not(.pb-edit) [data-vh*=\"t\"]{display:none!important}}@media(max-width:767px){body:not(.pb-edit) [data-vh*=\"m\"]{display:none!important}}" + ".mi-dd{position:relative;display:inline-flex;align-items:center}.mi-dd .mi-t{display:inline-flex;align-items:center;gap:.28rem;cursor:pointer}.mi-c{font-style:normal;font-size:.68em;opacity:.7;transition:transform .2s}.mi-dd.open .mi-c{transform:rotate(180deg)}" +
    ".mi-pop{display:none;position:absolute;top:100%;inset-inline-start:0;min-width:210px;max-width:320px;max-height:68vh;overflow:auto;background:#fff;border:1px solid #eae3d6;border-radius:14px;box-shadow:0 18px 40px rgba(20,30,25,.16);padding:.35rem;z-index:80}" +
    ".mi-pop a{display:block;padding:.5rem .8rem;border-radius:9px;color:#1c2420!important;opacity:1!important;font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mi-pop a:first-child{color:#8a6a1a!important;border-bottom:1px solid #f0e9d8;border-radius:9px 9px 0 0;margin-bottom:.15rem}.mi-pop a:hover{background:#f4efe6}" +
    ".mi-dd.open>.mi-pop{display:block}@media(hover:hover){.mi-dd:hover>.mi-pop{display:block}.mi-dd:hover .mi-c{transform:rotate(180deg)}}" +
    /* قائمة «المنتجات» (الكل): لوحة عريضة بعرض الهيدر كله، منتجاتها في سطور وأعمدة بصور مصغّرة */
    ".mi-dd.mi-mega{position:static}.mi-mega>.mi-pop{inset-inline:0;min-width:0;max-width:none;width:auto;border-radius:0 0 20px 20px;border-inline:0;padding:1rem max(16px,calc((100% - 1240px)/2)) 1.2rem;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.3rem .8rem;max-height:70vh}.mi-mega.open>.mi-pop{display:grid}@media(hover:hover){.mi-mega:hover>.mi-pop{display:grid}}" +
    ".mi-mega .mi-pop a{display:flex;align-items:center;gap:.6rem;white-space:normal;line-height:1.5;padding:.45rem .6rem}.mi-mega .mi-pop a img{width:44px;height:44px;border-radius:10px;object-fit:cover;flex:none;background:#f4efe6}.mi-mega .mi-pop a:first-child{grid-column:1/-1;border-radius:9px}" +
    /* قائمة الجوال: زر ☰ يفتح لوحة تحت الهيدر، والقوائم المنسدلة تتحول إلى أقسام تُفتح بالنقر */
    ".mb-burger{display:none;background:none;border:0;color:inherit;cursor:pointer;padding:.3rem .4rem;margin-inline-start:auto;line-height:0;align-items:center}.mb-burger .b2{display:none}.mb-burger.on .b1{display:none}.mb-burger.on .b2{display:block}" +
    "@media(max-width:860px){.mb-burger{display:inline-flex}header nav.menu.mob-open{display:flex!important;flex-direction:column;align-items:stretch;gap:0!important;position:absolute;top:100%;left:0;right:0;margin:0!important;background:#fff;border-bottom:1px solid #eae3d6;box-shadow:0 18px 30px rgba(20,30,25,.14);max-height:calc(100vh - 72px);overflow:auto;padding:.3rem 1rem .6rem;z-index:90}" +
    "header nav.menu.mob-open>a,header nav.menu.mob-open .mi-t{display:flex;justify-content:space-between;align-items:center;color:#1c2420!important;opacity:1!important;font-size:1rem!important;padding:.85rem .2rem;border-bottom:1px solid #f3eddf}header nav.menu.mob-open .mi-dd{display:block}" +
    "header nav.menu.mob-open .mi-pop{position:static;box-shadow:none;border:0;max-height:none;min-width:0;max-width:none;padding:0 .7rem .4rem;background:#faf7f0;border-radius:10px;margin-bottom:.3rem}header nav.menu.mob-open .mi-dd:hover>.mi-pop{display:none}header nav.menu.mob-open .mi-dd.open>.mi-pop{display:block}header nav.menu.mob-open .mi-mega:hover>.mi-pop{display:none}header nav.menu.mob-open .mi-mega.open>.mi-pop{display:block}header nav.menu.mob-open .mi-mega .mi-pop a{padding:.5rem .3rem}}";
  /* أيقونات سلة عصرية (خطّية بلون النص) */
  const CART_ICONS = {
    cart: ["سلة تسوّق", '<path d="M3 4h2.2l2.3 11a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.55-1.2L20.7 8.2H6.2"/><circle cx="9.6" cy="20" r="1.35"/><circle cx="17" cy="20" r="1.35"/>'],
    bag: ["كيس تسوّق", '<path d="M6.2 7.5h11.6l1.1 12.5H5.1z"/><path d="M9 7.5a3 3 0 0 1 6 0"/>'],
    bag2: ["كيس مبتسم", '<path d="M5.4 8h13.2l1 12H4.4z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M9.2 13.6c1.2 1.5 4.4 1.5 5.6 0"/>'],
    basket: ["سلّة", '<path d="M2.8 10h18.4l-1.9 9.2H4.7z"/><path d="M8 10l3-5.5M16 10l-3-5.5"/><path d="M9.2 13.4v2.8M12 13.4v2.8M14.8 13.4v2.8"/>'],
    trolley: ["عربة", '<path d="M2.5 3.5h3l3 11.5h10.2L21 7.5H6.5"/><circle cx="9.8" cy="19.6" r="1.3"/><circle cx="17" cy="19.6" r="1.3"/>'],
    tote: ["حقيبة", '<path d="M4.8 9h14.4l.8 11H4z"/><path d="M8.6 9V6.8a3.4 3.4 0 0 1 6.8 0V9"/>']
  };
  const cartIcon = (id, size) => CART_ICONS[id] ? '<svg class="ch-ci" width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CART_ICONS[id][1] + "</svg>" : "";
  const SHARE_ALL = ["whatsapp", "facebook", "messenger", "telegram", "x", "linkedin", "pinterest", "viber", "reddit", "email", "sms"];
  /* القيم الافتراضية = شكل الموقع الحالي، فيتطابق أول حفظ مع الموقع الحالي ثم يعدّل صاحب المتجر ما يشاء */
  function defaults(site) {
    site = site || {};
    return {
      v: 1,
      links: [{ label: "الرئيسية", url: "index.html" }, { label: "الفئات", url: "index.html#categories" }, { label: "المنتجات", url: "index.html#products" }, { label: "لماذا نحن؟", url: "index.html#features" }, { label: "الأسئلة الشائعة", url: "index.html#faq" }],      /* عناوين الموقع المتاحة: تُختار منها روابط القوائم (الهيدر/الفوتر/المطوّر) وتُدار من إعدادات الموقع */
      social: site.instagram ? [{ id: "instagram", url: "https://instagram.com/" + site.instagram }] : [],
      share: { float: false, pos: "bottom-left", channels: ["whatsapp", "facebook", "messenger", "telegram", "x", "email"], text: "", style: "brand" },
      header: {
        sticky: true, bg: "", color: "", pad: "",
        order: HEAD_IDS.slice(),
        topbar: { show: true, text: "🚚 توصيل سريع لـ **58 ولاية** · 💵 **الدفع عند الاستلام** · 🎁 اشترِ **قطعتين** واحصل على **الثالثة مجاناً**", bg: "", color: "", link: "", accent: "", fs: "", fw: "", align: "center", padY: "", pos: "above", effect: "fade", rot: 4, hide: false, anns: [] },
        logo: { show: true, text: true, image: true, link: "home", split: true },
        menu: { show: true, color: "", items: [{ label: "الفئات", url: "index.html#categories" }, { label: "المنتجات", url: "index.html#products" }, { label: "لماذا نحن؟", url: "index.html#features" }, { label: "الأسئلة الشائعة", url: "index.html#faq" }] },
        social: { show: false, style: "color", shape: "none", size: 18 },
        share: { show: true, style: "soft", mode: "icon", label: "انشر" },
        wa: { show: true, label: "واتساب", mode: "icon", style: "brand", size: 24 },
        account: { show: true },
        cart: { show: true, icon: "cart" }
      },
      footer: {
        show: true, bg: "", color: "", headColor: "",
        order: FOOT_IDS.slice(),
        about: { show: true, title: site.name || "أليسوم ALYSSUM", text: "متجرك الجزائري للمنتجات الطبيعية الأصلية: زيوت، أعشاب، عسل فاخر ومنتجات الرقية الشرعية. جودة مضمونة والدفع عند الاستلام." },
        links: { show: true, title: "روابط سريعة", tracking: true, items: [{ label: "الفئات", url: "index.html#categories" }, { label: "المنتجات", url: "index.html#products" }, { label: "المميزات", url: "index.html#features" }, { label: "الأسئلة", url: "index.html#faq" }] },
        contact: { show: true, title: "تواصل معنا", wa: true, phone: "", email: "", hours: "السبت – الخميس: 9ص – 6م", address: "الجزائر" },
        social: { show: true, title: "تابعنا", style: "brand", shape: "round", size: 18 },
        custom: { show: false, title: "", text: "" },
        share: { show: true },
        copy: { show: true, text: "© " + new Date().getFullYear() + " " + (site.name || "أليسوم") + " — جميع الحقوق محفوظة" }
      }
    };
  }
  /* دمج عميق للإعداد المحفوظ فوق الافتراضي (المصفوفات تُستبدل كما هي) */
  function merge(a, b) {
    if (Array.isArray(a) || typeof a !== "object" || !a) return b === undefined ? a : b;
    const o = {}; for (const k in a) o[k] = merge(a[k], b && b[k]); if (b) for (const k in b) if (!(k in o)) o[k] = b[k]; return o;
  }
  function norm(cfg, site) {
    const c = merge(defaults(site), cfg || {});
    const fix = (ord, all) => { ord = (ord || []).filter(x => all.includes(x)); all.forEach(x => { if (!ord.includes(x)) ord.push(x); }); return ord; };
    const hh = c.header; if (hh.social.ids === undefined) {      /* ترقية: زر واتساب صار أيقونة ضمن «أيقونات التواصل» (قائمة اختيار) */
      const ids = [], waOn = !hh.wa || hh.wa.show !== false; if (waOn) ids.push("whatsapp"); if (hh.social.show) (c.social || []).forEach(s => { if (s && s.id && s.url && !ids.includes(s.id)) ids.push(s.id); });
      hh.social.ids = ids; if (!hh.social.show && ids.length) { hh.social.show = true; if (hh.wa) { hh.social.style = hh.wa.style || "brand"; hh.social.shape = "round"; hh.social.size = +hh.wa.size || 24; } }
    }
    if (!hh.account.moved) { if (hh.account.show !== false && Array.isArray(hh.menu.items) && !hh.menu.items.some(i => i && i.kind === "acct")) hh.menu.items = hh.menu.items.concat([{ kind: "acct", label: "" }]); hh.account = { show: false, moved: true }; }      /* زر «حسابي» المستقل صار عنواناً في قائمة العناوين */
    c.header.order = fix(c.header.order, HEAD_IDS); c.footer.order = fix(c.footer.order, FOOT_IDS); return c;
  }

  /* ── مجموعة أيقونات التواصل ── */
  function socials(c, o, place) {
    const L = (c.social || []).filter(s => s && s.id && s.url && SI().byId[s.id]);
    return L.length ? '<div class="ch-soc ' + place + '">' + L.map(s => SI().link(s.id, s.url, o)).join("") + "</div>" : "";
  }
  /* أيقونات الهيدر: المختارة من القائمة (ids)؛ واتساب من رقم المتجر إن لم يكن له رابط مخصص */
  function socialsSel(c, o, wa) {
    const g = (c.social || []).filter(s => s && s.id && s.url), L = (o.ids || []).map(id => id === "whatsapp" ? (g.find(s => s.id === id) || (wa ? { id, url: "https://wa.me/" + wa } : null)) : g.find(s => s.id === id)).filter(s => s && SI().byId[s.id]);
    return L.length ? '<div class="ch-soc hd-soc">' + L.map(s => SI().link(s.id, s.url, o)).join("") + "</div>" : "";
  }
  /* ── الهيدر: ينتج HTML؛ keep = {logo,cart,account} نصوص بديلة (في الصفحة: علامات تُستبدل بالعقد الحقيقية) ── */
  function headerHtml(cfg, ctx, keep) {
    const c = norm(cfg, ctx && ctx.site), h = c.header, rel = (ctx && ctx.rel) || "", wa = (ctx && ctx.wa) || "", k = keep || {};
    const part = {
      logo: () => h.logo.show ? (k.logo || "") : "",
      menu: () => h.menu.show ? menuNav(h.menu.items, rel, ctx && ctx.menuData) : "",
      social: () => h.social.show ? socialsSel(c, h.social, wa) : "",
      share: () => !h.share.show ? "" : h.share.mode === "text" ? '<button type="button" class="ch-share-btn ch-share-txt" data-share aria-label="مشاركة" title="مشاركة">' + esc(h.share.label || "انشر") + "</button>" : '<button type="button" class="ch-share-btn" data-share aria-label="مشاركة" title="مشاركة">' + SI().icon("share", { size: +h.share.size || 18, style: h.share.style || "soft", shape: "round" }) + "</button>",
      cart: () => h.cart.show ? (k.cart || "") : ""
    };
    let out = h.order.map(id => part[id]()).join("");
    if (!/class="menu"/.test(out)) out = out.replace(/(<a class="hd-wa|<div class="ch-soc|<button type="button" class="ch-share-btn)/, '<span class="ch-fill"></span>$1');
    return out;
  }
  /* الشريط العلوي: نص أول + إعلانات أخرى (لكل إعلان ألوانه وخطه) + تناوب (تلاشي/انزلاق/شريط متحرك) + سحب تلقائي؛ نفس خيارات عنصر المطوّر */
  const hex = v => /^#[0-9a-f]{3,8}$/i.test(v || "") ? v : "";
  const TP_CSS = ".topbar.ch-tp{--hc:#E4C87F;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;transition:max-height .35s ease,padding .35s ease,opacity .3s ease}.topbar.ch-tp a{color:inherit;text-decoration:none}.topbar.ch-tp b{color:var(--hc)}.ch-tp-i{display:block;box-sizing:border-box}.ch-tp-m,.topbar.ch-tp a{display:contents}.ch-tp-r{display:grid}.ch-tp-r .ch-tp-i{grid-area:1/1;visibility:hidden}.ch-tp-r .ch-tp-i.on{visibility:visible;animation:chTpIn .45s ease}.ch-eff-slide .ch-tp-i.on{animation:chTpDown .55s cubic-bezier(.2,.8,.2,1)}.ch-tp-t{white-space:nowrap}.ch-tp-mq{display:flex;width:max-content;animation:chTpMq var(--tpq,20s) linear infinite}.ch-tp-mq:hover{animation-play-state:paused}.ch-tp-tr{display:flex;flex:none}.ch-tp-t .ch-tp-i{display:inline-block;padding-inline:2.4rem}.topbar.ch-tp.ch-tp-h{max-height:0!important;padding-top:0!important;padding-bottom:0!important;opacity:0}@keyframes chTpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes chTpDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}@keyframes chTpMq{from{transform:translateX(0)}to{transform:translateX(50%)}}@media(prefers-reduced-motion:reduce){.ch-tp-mq{animation:none}}";
  function topbarItems(t, ctx) {
    const L = String(t.text || "").split("\n").map(x => x.trim()).filter(Boolean), A = (Array.isArray(t.anns) ? t.anns : []).filter(a => a && String(a.txt || "").trim());
    const eff = ["slide", "ticker"].includes(t.effect) ? t.effect : "fade", rot0 = +t.rot || 0, multi = (L.length + A.length) > 1 && (rot0 > 0 || A.length > 0 || eff === "ticker"), rot = rot0 > 0 ? rot0 : 4, rel = ctx && ctx.rel;
    const mk = (x, i, st, lnk, cls) => { const tx = '<span class="ch-tp-i' + (cls || "") + (i === 0 ? " on" : "") + '"' + (st ? ' style="' + st + '"' : "") + ">" + rich(x) + "</span>"; return lnk ? '<a href="' + esc(url(lnk, rel)) + '">' + tx + "</a>" : tx; };
    const main = multi ? L.map((x, i) => mk(x, i, "", t.link)).join("") : mk(L.join(" "), 0, "", t.link);
    const extra = multi ? A.map((a, j) => { const st = [hex(a.tbg) && "background:" + hex(a.tbg), hex(a.ttc) && "color:" + hex(a.ttc), hex(a.tbc) && "--hc:" + hex(a.tbc), +a.fs && "font-size:" + (+a.fs) + "px", a.ff && /^[\w\s,'"-]+$/.test(a.ff) && "font-family:" + a.ff, a.fw && /^\d{3}$/.test(a.fw) && "font-weight:" + a.fw].filter(Boolean).join(";"); return mk(String(a.txt).trim().split("\n").join(" "), L.length + j, st, a.link, " ch-tp-a"); }).join("") : "";
    return { main, extra, multi, eff, rot, n: L.length + A.length };
  }
  function topbarHtml(cfg, ctx) {     /* المحتوى الداخلي فقط (للتوافق) */
    const t = norm(cfg, ctx && ctx.site).header.topbar; if (!t.show || !(t.text || (t.anns || []).length)) return "";
    const it = topbarItems(t, ctx); return '<span class="ch-tp-m">' + it.main + "</span>" + it.extra;
  }
  function topbarEl(cfg, ctx) {       /* عنصر الشريط كاملاً بصنفه وسماته */
    const t = norm(cfg, ctx && ctx.site).header.topbar; if (!t.show || !(t.text || (t.anns || []).length)) return "";
    const it = topbarItems(t, ctx), all = '<span class="ch-tp-m">' + it.main + "</span>" + it.extra, hd = t.hide ? ' data-ch-hide="1"' : "";
    if (it.multi && it.eff === "ticker") { const dur = Math.max(6, Math.round(it.rot * it.n * 2)); return '<div class="topbar ch-tp ch-tp-t"' + hd + ' style="--tpq:' + dur + 's"><div class="ch-tp-mq"><div class="ch-tp-tr">' + all + '</div><div class="ch-tp-tr" aria-hidden="true">' + it.main + it.extra + "</div></div></div>"; }
    return '<div class="topbar ch-tp' + (it.multi ? " ch-tp-r ch-eff-" + it.eff : "") + '"' + (it.multi ? ' data-ch-rot="' + it.rot + '"' : "") + hd + ">" + all + "</div>";
  }
  /* تشغيل التناوب والسحب التلقائي لشريط (يعمل أيضاً على عنصر داخل iframe المعاينة) */
  function tpRun(tb) {
    if (!tb) return; if (tb.__tpT) { clearInterval(tb.__tpT); tb.__tpT = 0; }
    const r = +tb.getAttribute("data-ch-rot") || 0, items = [].slice.call(tb.querySelectorAll(".ch-tp-i"));
    if (r > 0 && items.length > 1) { let i = 0; tb.__tpT = setInterval(() => { if (!tb.isConnected) { clearInterval(tb.__tpT); return; } items[i].classList.remove("on"); i = (i + 1) % items.length; items[i].classList.add("on"); }, r * 1000); }
    if (tb.hasAttribute("data-ch-hide") && !tb.__tpH) {
      tb.__tpH = 1; const w = tb.ownerDocument.defaultView === window ? window : window; let hs = 0;
      window.addEventListener("scroll", () => { if (!tb.isConnected) return; const y = window.pageYOffset || document.documentElement.scrollTop || 0; if (y > 80 && !hs) { hs = 1; tb.style.maxHeight = tb.offsetHeight + "px"; void tb.offsetHeight; tb.classList.add("ch-tp-h"); } else if (y < 20 && hs) { hs = 0; tb.classList.remove("ch-tp-h"); tb.style.maxHeight = ""; } }, { passive: true });
    }
  }
  /* ── الفوتر ── */
  function footerHtml(cfg, ctx) {
    const c = norm(cfg, ctx && ctx.site), f = c.footer, rel = (ctx && ctx.rel) || "", wa = (ctx && ctx.wa) || "";
    const col = {
      about: () => f.about.show ? '<div><h3 class="ft-h">' + esc(f.about.title) + "</h3><p>" + rich(f.about.text) + "</p></div>" : "",
      links: () => {
        if (!f.links.show) return "";
        const li = f.links.items.map(i => '<a href="' + esc(url(i.url, rel)) + '">' + esc(i.label) + "</a>");
        if (f.links.tracking) li.push('<a href="#" class="ft-trk">📦 تتبّع طلبك</a>', '<a href="#" class="ft-acc">👤 حسابي</a>');
        return '<div><h3 class="ft-h">' + esc(f.links.title) + "</h3><p>" + li.join("<br>") + "</p></div>";
      },
      contact: () => {
        const t = f.contact; if (!t.show) return ""; const rows = [], G = k => SI().glyph(k, 15);
        const ic = (g, h) => '<span class="ch-row">' + g + "<span>" + h + "</span></span>";
        if (t.wa && wa) rows.push(ic(G("whatsapp"), '<a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">' + esc(wa.replace(/^213/, "0").replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4")) + "</a>"));
        if (t.phone) rows.push(ic(G("phone"), '<a href="tel:' + esc(t.phone.replace(/\s/g, "")) + '">' + esc(t.phone) + "</a>"));
        if (t.email) rows.push(ic(G("email"), '<a href="mailto:' + esc(t.email) + '">' + esc(t.email) + "</a>"));
        if (t.hours) rows.push(ic('<span aria-hidden="true">🕐</span>', esc(t.hours)));
        if (t.address) rows.push(ic(G("location"), esc(t.address)));
        return '<div><h3 class="ft-h">' + esc(t.title) + '</h3><div class="ch-rows">' + rows.join("") + "</div></div>";
      },
      social: () => {
        if (!f.social.show) return ""; const s = socials(c, f.social, "ft-soc"); if (!s) return "";
        return "<div>" + (f.social.title ? '<h3 class="ft-h">' + esc(f.social.title) + "</h3>" : "") + s + "</div>";
      },
      custom: () => f.custom.show && (f.custom.title || f.custom.text) ? "<div>" + (f.custom.title ? '<h3 class="ft-h">' + esc(f.custom.title) + "</h3>" : "") + "<p>" + rich(f.custom.text) + "</p></div>" : ""
    };
    const cols = f.order.map(id => col[id]()).filter(Boolean);
    const share = f.share.show ? '<div class="ch-ftshare"><button type="button" class="ch-share-btn ch-share-wide" data-share>' + SI().glyph("share", 16) + " شارك الموقع</button></div>" : "";
    const copy = f.copy.show && f.copy.text ? '<div class="copy">' + rich(f.copy.text) + "</div>" : "";
    return '<div class="fgrid ch-grid" style="grid-template-columns:repeat(' + Math.max(1, Math.min(4, cols.length)) + ',minmax(0,1fr))">' + cols.join("") + "</div>" + share + copy;
  }
  /* ── أنماط (صفحة + معاينة اللوحة) ── */
  function css(cfg, ctx) {
    const c = norm(cfg, ctx && ctx.site), h = c.header, f = c.footer, tp = h.topbar;
    let s = ".si-a{display:inline-flex;transition:transform .15s}.si-a:hover{transform:translateY(-2px)}.ch-soc{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}" +
      "footer.site .container{display:block}.ch-share-btn svg{flex:none}.ch-fill{margin-inline-start:auto}header.site .hd-wa.hd-wa-ic{background:none!important;padding:0!important;border-radius:0!important;box-shadow:none!important;display:inline-flex;align-items:center;margin-inline-start:0}.ch-share-btn{background:none;border:0;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;gap:.4rem;padding:0}" +
      ".ch-ftshare{text-align:center}.ch-share-wide{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:.5rem 1.1rem;font-weight:800;margin-top:1.1rem}.ch-share-wide:hover{background:rgba(255,255,255,.18)}" +
      ".ch-rows{display:grid;gap:.45rem;font-size:.95rem}.ch-row{display:flex;gap:.5rem;align-items:center}.ch-row svg{flex:none;opacity:.85}.ch-grid a{color:inherit}.ch-grid p a:hover,.ch-row a:hover{text-decoration:underline}" +
      "@media(max-width:760px){.ch-grid{grid-template-columns:1fr!important}}";
    if (!h.sticky) s += "header.site{position:static!important}";
    if (h.bg) s += "header.site{background:" + h.bg + "!important}";
    if (h.color) s += "header.site .logo,header.site nav.menu a,header.site .ch-share-btn,header.site .ch-soc{color:" + h.color + "}";
    if (h.menu.color) s += "header.site nav.menu a{color:" + h.menu.color + "!important}";
    s += MENU_CSS + ".logo[data-nolink]{pointer-events:none;cursor:default}header.site .ch-share-txt{background:#173f35;color:#fff!important;border-radius:999px;padding:.45rem 1rem;font-weight:800;font-size:.88rem}header.site .ch-ci{display:block}";
    if (h.logo.text === false) s += "header.site .logo{font-size:0!important}header.site .logo span{display:none!important}";
    else if (h.logo.image === false) s += "header.site .logo{background-image:none!important;font-size:" + (+h.logo.size || 24) + "px!important;line-height:normal!important;width:auto!important;height:auto!important}";
    if (h.logo.split === false) s += "header.site .logo span{color:inherit!important}"; else if (h.logo.accent) s += "header.site .logo span{color:" + h.logo.accent + "!important}";
    if (h.logo.color && h.logo.text !== false) s += "header.site .logo{color:" + h.logo.color + "}";
    if (h.logo.size && h.logo.text !== false && h.logo.image !== false) s += "header.site .logo{font-size:" + (+h.logo.size) + "px}";
    if (h.menu.weight) s += "header.site nav.menu>a,header.site nav.menu .mi-t{font-weight:" + h.menu.weight + "}";
    if (h.menu.gap !== undefined && h.menu.gap !== "") s += "header.site nav.menu{gap:" + (+h.menu.gap) + "px}";
    if (h.menu.hover) s += "header.site nav.menu>a:hover,header.site nav.menu .mi-t:hover{color:" + h.menu.hover + "!important;opacity:1}";
    if (h.menu.popbg) s += "header.site .mi-pop{background:" + h.menu.popbg + "}";
    if (h.menu.popcolor) s += "header.site .mi-pop a{color:" + h.menu.popcolor + "!important}";
    if (h.menu.size) s += "header.site nav.menu>a,header.site nav.menu .mi-t{font-size:" + (+h.menu.size) + "px}";
    if (h.social.color) s += "header.site .hd-soc{color:" + h.social.color + "}";
    if (h.share.color) s += "header.site .ch-share-btn{color:" + h.share.color + "!important}";
    if (h.share.bg) s += "header.site .ch-share-txt{background:" + h.share.bg + "}";
    if (h.cart.bg) s += "header.site .cart-btn{background:" + h.cart.bg + "}";
    if (h.cart.color) s += "header.site .cart-btn{color:" + h.cart.color + "}";
    if (h.pad) s += ".site .container{padding-top:" + h.pad + "px;padding-bottom:" + h.pad + "px}";
    s += TP_CSS;
    if (tp.bg) s += ".topbar{background:" + tp.bg + "!important}";
    if (tp.color) s += ".topbar,.topbar a{color:" + tp.color + "!important}";
    if (hex(tp.accent)) s += ".topbar.ch-tp{--hc:" + tp.accent + "}";
    if (+tp.fs) s += ".topbar.ch-tp{font-size:" + (+tp.fs) + "px}";
    if (/^\d{3}$/.test(tp.fw || "")) s += ".topbar.ch-tp{font-weight:" + tp.fw + "}";
    if (tp.align === "start" || tp.align === "end") s += ".topbar.ch-tp{justify-content:flex-" + tp.align + ";text-align:" + (tp.align === "start" ? "right" : "left") + "}";
    if (tp.padY !== "" && tp.padY != null && !isNaN(+tp.padY)) s += ".topbar.ch-tp .ch-tp-i{padding-top:" + (+tp.padY) + "px;padding-bottom:" + (+tp.padY) + "px}";
    if (hex(h.menu.mbg) || hex(h.menu.mtc)) s += "@media(max-width:860px){" + (hex(h.menu.mbg) ? "header nav.menu.mob-open{background:" + h.menu.mbg + "!important}" : "") + (hex(h.menu.mtc) ? "header nav.menu.mob-open>a,header nav.menu.mob-open .mi-t{color:" + h.menu.mtc + "!important}" : "") + "}";
    if (hex(h.menu.bbc)) s += "header .mb-burger{color:" + h.menu.bbc + "}";
    if (+h.menu.bbs) s += "header .mb-burger svg{width:" + (+h.menu.bbs) + "px;height:" + (+h.menu.bbs) + "px}";
    if (f.bg) s += "footer.site{background:" + f.bg + "!important}";
    if (f.color) s += "footer.site,footer.site a{color:" + f.color + "}";
    if (f.headColor) s += "footer.site .ft-h{color:" + f.headColor + "}";
    return s;
  }

  /* ── المشاركة ── */
  const Share = {
    meta(p) { const q = n => { const m = document.querySelector('meta[property="og:' + n + '"],meta[name="' + n + '"]'); return m ? m.content : ""; }; return { url: location.href.split("#")[0], title: (document.querySelector("h1") && document.querySelector("h1").textContent.trim()) || q("title") || document.title, image: q("image"), text: (p && p.text) || "" }; },
    links(id, d, mobile) {
      const u = encodeURIComponent(d.url), t = encodeURIComponent(d.title), full = encodeURIComponent((d.text ? d.text + " " : d.title + " ") + d.url);
      return ({
        whatsapp: "https://wa.me/?text=" + full, facebook: "https://www.facebook.com/sharer/sharer.php?u=" + u,
        messenger: mobile ? "fb-messenger://share/?link=" + u : "https://www.facebook.com/sharer/sharer.php?u=" + u,
        telegram: "https://t.me/share/url?url=" + u + "&text=" + t, x: "https://twitter.com/intent/tweet?url=" + u + "&text=" + t,
        linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + u, pinterest: "https://pinterest.com/pin/create/button/?url=" + u + "&media=" + encodeURIComponent(d.image || "") + "&description=" + t,
        viber: "viber://forward?text=" + full, reddit: "https://www.reddit.com/submit?url=" + u + "&title=" + t,
        email: "mailto:?subject=" + t + "&body=" + full, sms: "sms:?&body=" + full
      })[id];
    },
    async copy(txt) { try { await navigator.clipboard.writeText(txt); return true; } catch (e) { try { const a = document.createElement("textarea"); a.value = txt; a.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(a); a.select(); const ok = document.execCommand("copy"); a.remove(); return ok; } catch (e2) { return false; } } },
    close() { const m = document.getElementById("ch-share"); if (m) m.remove(); document.removeEventListener("keydown", Share._k); },
    /* النشر: تفتح نافذة الجهاز الأصلية (كل التطبيقات المثبّتة + نسخ الرابط)؛ وإن لم يدعمها المتصفح تظهر نافذة بديلة بنسخ الرابط وكل أدوات المشاركة */
    open(cfg, forceModal) {
      this.close(); const c = norm(cfg || Chrome.cfg, Chrome.ctx().site), sh = c.share, d = this.meta(sh), mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent), ch = SHARE_ALL.slice();
      if (navigator.share && !forceModal) { navigator.share({ title: d.title, text: d.text || d.title, url: d.url }).catch(e => { if (!e || e.name !== "AbortError") Share.open(cfg, true); }); return; }
      const names = { whatsapp: "واتساب", facebook: "فيسبوك", messenger: "ماسنجر", telegram: "تيليغرام", x: "إكس", linkedin: "لينكدإن", pinterest: "بنترست", viber: "فايبر", reddit: "ريديت", email: "بريد", sms: "رسالة" };
      const tile = id => '<a class="chs-t" href="' + esc(this.links(id, d, mobile)) + '" target="_blank" rel="noopener noreferrer" data-ch="' + id + '">' + (id === "email" ? SI().icon("email", { size: 22, style: "brand", shape: "round" }).replace("background:transparent", "background:#6b7280") : id === "sms" ? SI().icon("sms", { size: 22, style: "brand", shape: "round" }).replace("background:transparent", "background:#16a34a") : SI().icon(id, { size: 22, style: "brand", shape: "round" })) + "<span>" + names[id] + "</span></a>";
      const m = document.createElement("div"); m.id = "ch-share"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "مشاركة");
      m.innerHTML = '<style>#ch-share{position:fixed;inset:0;z-index:2147483000;background:rgba(15,25,21,.55);display:grid;place-items:center;padding:16px;animation:chf .18s}@keyframes chf{from{opacity:0}}#ch-share .chs-box{background:#fff;color:#1c2420;border-radius:20px;width:min(440px,100%);padding:1.2rem 1.2rem 1.3rem;box-shadow:0 30px 80px rgba(0,0,0,.35);font-family:inherit;direction:rtl}' +
        '#ch-share .chs-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem}#ch-share .chs-h b{font-size:1.1rem}#ch-share .chs-x{background:#f1efe9;border:0;border-radius:50%;width:34px;height:34px;font-size:1.2rem;cursor:pointer;line-height:1}' +
        '#ch-share .chs-pv{display:flex;gap:.7rem;align-items:center;background:#faf8f3;border:1px solid #eae3d6;border-radius:12px;padding:.55rem;margin-bottom:.9rem}#ch-share .chs-pv img{width:52px;height:52px;object-fit:cover;border-radius:8px;flex:none}#ch-share .chs-pv span{font-weight:700;font-size:.92rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
        '#ch-share .chs-url{display:flex;gap:.4rem;margin-bottom:1rem}#ch-share .chs-url input{flex:1;min-width:0;border:1px solid #d9d2c2;border-radius:10px;padding:.6rem .7rem;font:inherit;font-size:.85rem;direction:ltr;background:#fff;color:#1c2420}' +
        '#ch-share .chs-url button,#ch-share .chs-nat{border:0;border-radius:10px;background:#173f35;color:#fff;font:inherit;font-weight:800;padding:.6rem 1rem;cursor:pointer;white-space:nowrap}#ch-share .chs-url button.ok{background:#157a55}' +
        '#ch-share .chs-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:.7rem .4rem}#ch-share .chs-t{display:flex;flex-direction:column;align-items:center;gap:.35rem;text-decoration:none;color:#1c2420;font-size:.78rem;font-weight:700}#ch-share .chs-t:hover .si-ic{transform:scale(1.08)}#ch-share .si-ic{transition:transform .15s}#ch-share .chs-nat{width:100%;margin-bottom:.9rem;display:none}#ch-share .chs-qrb{width:100%;margin-top:1rem;border:1.5px dashed #d9d2c2;background:#faf8f3;border-radius:10px;padding:.55rem;font:inherit;font-weight:800;color:#173f35;cursor:pointer}#ch-share .chs-qr{text-align:center;margin-top:.8rem}#ch-share .chs-qr svg{width:180px;height:180px;background:#fff;padding:8px;border:1px solid #eae3d6;border-radius:12px}</style>' +
        '<div class="chs-box"><div class="chs-h"><b>مشاركة</b><button class="chs-x" type="button" aria-label="إغلاق">×</button></div>' +
        '<div class="chs-pv">' + (d.image ? '<img src="' + esc(d.image) + '" alt="">' : "") + "<span>" + esc(d.title) + "</span></div>" +
        '<div class="chs-url"><input readonly value="' + esc(d.url) + '" aria-label="رابط الصفحة"><button type="button" class="chs-cp">نسخ الرابط</button></div>' +
        '<div class="chs-g">' + ch.map(tile).join("") + '</div><button type="button" class="chs-qrb">▦ رمز QR للمسح بالهاتف</button><div class="chs-qr" hidden></div></div>';
      document.body.appendChild(m);
      m.addEventListener("click", e => { if (e.target === m || e.target.closest(".chs-x")) this.close(); });
      const inp = m.querySelector("input"), cp = m.querySelector(".chs-cp"); inp.onfocus = () => inp.select();
      cp.onclick = async () => { const ok = await this.copy(d.url); cp.textContent = ok ? "تم النسخ ✓" : "انسخ يدوياً"; cp.classList.toggle("ok", ok); if (!ok) inp.select(); setTimeout(() => { cp.textContent = "نسخ الرابط"; cp.classList.remove("ok"); }, 2200); };
      const qb = m.querySelector(".chs-qrb"), qa = m.querySelector(".chs-qr");
      qb.onclick = async () => {
        if (!qa.hidden) { qa.hidden = true; return; }
        qa.hidden = false; qa.textContent = "جارِ التوليد…";
        try {
          if (!window.qrcode) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
          const q = qrcode(0, "M"); q.addData(d.url); q.make(); qa.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        } catch (e) { qa.textContent = "تعذّر توليد الرمز (تحقق من الإنترنت)"; }
      };
      this._k = e => { if (e.key === "Escape") Share.close(); }; document.addEventListener("keydown", this._k);
      (m.querySelector(".chs-cp")).focus();
    }
  };

  /* ── تطبيق على الصفحة ── */
  const out = {
    HEAD_IDS, FOOT_IDS, SHARE_ALL, HIDE_OPTS, MK, MK_LIST, DEF_SETS, CART_ICONS, cartIcon, menuNav, menuItem, popHtml, fillMenus, bindMenus, MENU_CSS, defaults, norm, headerHtml, topbarHtml, topbarEl, tpRun, footerHtml, css, Share, cfg: null,
    ctx() { return { rel: typeof REL !== "undefined" ? REL : "", wa: typeof WA_NUMBER !== "undefined" ? WA_NUMBER : "", site: (typeof CONFIG !== "undefined" && CONFIG.SITE) || {} }; },
    apply(cfg) {
      if (cfg && cfg.off) cfg = null;      /* «استرجاع الافتراضي» من اللوحة يكتب {"off":true} */
      this.cfg = cfg || null; const ctx = this.ctx(), has = !!cfg, c = norm(cfg, ctx.site);
      let st = document.getElementById("__ch_css"); if (!st) { st = document.createElement("style"); st.id = "__ch_css"; document.head.appendChild(st); }
      st.textContent = css(has ? cfg : { header: { sticky: true }, footer: {} }, ctx);
      if (has) {
        const hd = document.querySelector("header.site:not([data-pbw]) .container");
        if (hd) {
          const keep = { logo: hd.querySelector(".logo"), cart: hd.querySelector(".cart-btn"), account: hd.querySelector(".acc-btn") };
          hd.innerHTML = headerHtml(cfg, ctx, { logo: '<i data-keep="logo"></i>', cart: '<i data-keep="cart"></i>', account: '<i data-keep="account"></i>' });
          hd.querySelectorAll("[data-keep]").forEach(ph => { const n = keep[ph.dataset.keep]; n ? ph.replaceWith(n) : ph.remove(); });
          const lg = hd.querySelector(".logo"); if (lg) { if (c.header.logo.link === "none") { lg.removeAttribute("href"); lg.setAttribute("data-nolink", "1"); } else { lg.removeAttribute("data-nolink"); if (!lg.getAttribute("href")) lg.setAttribute("href", ctx.rel + "index.html"); } }
          const ct = hd.querySelector(".cart-btn"); if (ct && CART_ICONS[c.header.cart.icon]) { const sp = ct.querySelector("span[aria-hidden]"); if (sp) sp.innerHTML = cartIcon(c.header.cart.icon, 22); }
          hd.setAttribute("data-noacc", "1");
        }
        let tb = document.querySelector(".topbar");
        if (tb && tb.hasAttribute("data-pbw")) { /* شريط من عنصر المطوّر: يبقى كما صممته */ }
        else {
          const el = topbarEl(cfg, ctx), tmp = document.createElement("div"); tmp.innerHTML = el;
          const nt = tmp.firstElementChild, hdr = document.querySelector("header.site");
          if (nt) { if (tb) tb.replaceWith(nt); else { (hdr && hdr.parentNode ? hdr.parentNode : document.body).insertBefore(nt, hdr || document.body.firstChild); } tb = nt; }
          else if (tb) { tb.style.display = "none"; }
          if (tb && nt) { if (hdr && hdr.parentNode) { if (c.header.topbar.pos === "below") hdr.after(tb); else hdr.before(tb); } tpRun(tb); }
        }
        const ft = document.querySelector("footer.site");
        if (ft) {
          if (!c.footer.show) ft.style.display = "none";
          else {
            const ct = ft.querySelector(".container"); if (ct) { ct.removeAttribute("style"); ct.innerHTML = footerHtml(cfg, ctx); }
            const tr = ft.querySelector(".ft-trk"), ac = ft.querySelector(".ft-acc");
            if (tr) tr.onclick = e => { e.preventDefault(); try { Track.open(); } catch (x) { } };
            if (ac) ac.onclick = e => { e.preventDefault(); try { Account.open(); } catch (x) { } };
          }
        }
        try { if (typeof Account !== "undefined") Account.init(); } catch (e) { }
      }
      if (!has) {      /* بلا إعداد محفوظ: يبقى الهيدر كما هو وتُضاف أيقونة المشاركة قبل زر السلة */
        const hd = document.querySelector("header.site:not([data-pbw]) .container");
        if (hd && !hd.querySelector(".ch-share-btn")) { const t = document.createElement("div"); t.innerHTML = headerHtml({ header: { logo: { show: false }, menu: { show: false }, wa: { show: false }, account: { show: false }, cart: { show: false } } }, ctx); const b = t.querySelector(".ch-share-btn"); if (b) { const cart = hd.querySelector(".cart-btn"); cart ? hd.insertBefore(b, cart) : hd.appendChild(b); } }
      }
      document.querySelectorAll("header.site:not([data-pbw]) .container").forEach(hd => { const nav = hd.querySelector("nav.menu"); if (nav && !hd.querySelector(".mb-burger")) nav.insertAdjacentHTML("beforebegin", BURGER); });      /* هيدر ثابت بلا إعداد محفوظ: يحصل على زر ☰ للجوال */
      bindMenus(); fillMenus();
      /* الأزرار الظاهرة */
      this.bindShare();
      const old = document.getElementById("ch-float"); if (old) old.remove();
    },
    bindShare() { if (!this._bound) { this._bound = true; document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-share]"); if (b) { e.preventDefault(); Share.open(); } }); } },
    async init() {
      if (window.parent !== window && /pb-embed/.test(document.documentElement.className)) return;
      let cfg = null;
      try { const r = await fetch((typeof REL !== "undefined" ? REL : "") + "assets/data/chrome.json", { cache: "no-store" }); if (r.ok) cfg = await r.json(); } catch (e) { }
      this.apply(cfg);
    }
  };
  return out;
})();
