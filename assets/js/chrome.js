/* الهيدر والفوتر وزر المشاركة — تُدار من لوحة التحكم ← «الهيدر» و«الفوتر» وتُحفظ في assets/data/chrome.json.
   تعمل على الرئيسية وكل صفحات المنتجات (تحمّلها app.js تلقائياً). بلا ملف إعدادات يبقى الموقع كما هو، عدا زر المشاركة الافتراضي.
   تعتمد على assets/js/social-icons.js. تُستعمل كذلك في معاينة اللوحة (Chrome.headerHtml / footerHtml). */
window.Chrome = (function () {
  const SI = () => window.SocialIcons, esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* نص بسيط: **غامق** وأسطر جديدة */
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const abs = u => /^(https?:|\/\/|#|tel:|mailto:|sms:|viber:|\/)/i.test(u || "");
  const url = (u, rel) => !u ? "#" : (abs(u) ? u : (rel || "") + u);

  const HEAD_IDS = ["logo", "menu", "social", "share", "wa", "account", "cart"], FOOT_IDS = ["about", "links", "contact", "social", "custom"];
  const SHARE_ALL = ["whatsapp", "facebook", "messenger", "telegram", "x", "linkedin", "pinterest", "viber", "reddit", "email", "sms"];
  /* القيم الافتراضية = شكل الموقع الحالي، فيتطابق أول حفظ مع الموقع الحالي ثم يعدّل صاحب المتجر ما يشاء */
  function defaults(site) {
    site = site || {};
    return {
      v: 1,
      social: site.instagram ? [{ id: "instagram", url: "https://instagram.com/" + site.instagram }] : [],
      share: { float: false, pos: "bottom-left", channels: ["whatsapp", "facebook", "messenger", "telegram", "x", "email"], text: "", style: "brand" },
      header: {
        sticky: true, bg: "", color: "", pad: "",
        order: HEAD_IDS.slice(),
        topbar: { show: true, text: "🚚 توصيل سريع لـ **58 ولاية** · 💵 **الدفع عند الاستلام** · 🎁 اشترِ **قطعتين** واحصل على **الثالثة مجاناً**", bg: "", color: "", link: "" },
        logo: { show: true },
        menu: { show: true, color: "", items: [{ label: "الفئات", url: "index.html#categories" }, { label: "المنتجات", url: "index.html#products" }, { label: "لماذا نحن؟", url: "index.html#features" }, { label: "الأسئلة الشائعة", url: "index.html#faq" }] },
        social: { show: false, style: "color", shape: "none", size: 18 },
        share: { show: true, style: "soft" },
        wa: { show: true, label: "واتساب" },
        account: { show: true },
        cart: { show: true }
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
    c.header.order = fix(c.header.order, HEAD_IDS); c.footer.order = fix(c.footer.order, FOOT_IDS); return c;
  }

  /* ── مجموعة أيقونات التواصل ── */
  function socials(c, o, place) {
    const L = (c.social || []).filter(s => s && s.id && s.url && SI().byId[s.id]);
    return L.length ? '<div class="ch-soc ' + place + '">' + L.map(s => SI().link(s.id, s.url, o)).join("") + "</div>" : "";
  }
  /* ── الهيدر: ينتج HTML؛ keep = {logo,cart,account} نصوص بديلة (في الصفحة: علامات تُستبدل بالعقد الحقيقية) ── */
  function headerHtml(cfg, ctx, keep) {
    const c = norm(cfg, ctx && ctx.site), h = c.header, rel = (ctx && ctx.rel) || "", wa = (ctx && ctx.wa) || "", k = keep || {};
    const part = {
      logo: () => h.logo.show ? (k.logo || "") : "",
      menu: () => h.menu.show && h.menu.items.length ? '<nav class="menu">' + h.menu.items.map(i => '<a href="' + esc(url(i.url, rel)) + '">' + esc(i.label) + "</a>").join("") + "</nav>" : "",
      social: () => h.social.show ? socials(c, h.social, "hd-soc") : "",
      share: () => h.share.show ? '<button type="button" class="ch-share-btn" data-share aria-label="مشاركة" title="مشاركة">' + SI().icon("share", { size: 18, style: h.share.style || "soft", shape: "round" }) + "</button>" : "",
      wa: () => h.wa.show ? '<a class="hd-wa" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">' + esc(h.wa.label || "واتساب") + "</a>" : "",
      account: () => h.account.show ? (k.account || "") : "",
      cart: () => h.cart.show ? (k.cart || "") : ""
    };
    let out = h.order.map(id => part[id]()).join("");
    if (!/class="menu"/.test(out)) out = out.replace(/(<a class="hd-wa|<div class="ch-soc|<button type="button" class="ch-share-btn)/, '<span class="ch-fill"></span>$1');
    return out;
  }
  function topbarHtml(cfg, ctx) {
    const t = norm(cfg, ctx && ctx.site).header.topbar; if (!t.show || !t.text) return "";
    return t.link ? '<a href="' + esc(url(t.link, ctx && ctx.rel)) + '" style="color:inherit">' + rich(t.text) + "</a>" : rich(t.text);
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
      "footer.site .container{display:block}.ch-share-btn svg{flex:none}.ch-fill{margin-inline-start:auto}.ch-share-btn{background:none;border:0;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;gap:.4rem;padding:0}" +
      ".ch-ftshare{text-align:center}.ch-share-wide{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:.5rem 1.1rem;font-weight:800;margin-top:1.1rem}.ch-share-wide:hover{background:rgba(255,255,255,.18)}" +
      ".ch-rows{display:grid;gap:.45rem;font-size:.95rem}.ch-row{display:flex;gap:.5rem;align-items:center}.ch-row svg{flex:none;opacity:.85}.ch-grid a{color:inherit}.ch-grid p a:hover,.ch-row a:hover{text-decoration:underline}" +
      "@media(max-width:760px){.ch-grid{grid-template-columns:1fr!important}}";
    if (!h.sticky) s += "header.site{position:static!important}";
    if (h.bg) s += "header.site{background:" + h.bg + "!important}";
    if (h.color) s += "header.site .logo,header.site nav.menu a,header.site .ch-share-btn,header.site .ch-soc{color:" + h.color + "}";
    if (h.menu.color) s += "header.site nav.menu a{color:" + h.menu.color + "!important}";
    if (h.pad) s += ".site .container{padding-top:" + h.pad + "px;padding-bottom:" + h.pad + "px}";
    if (tp.bg) s += ".topbar{background:" + tp.bg + "!important}";
    if (tp.color) s += ".topbar,.topbar a{color:" + tp.color + "!important}";
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
    open(cfg) {
      this.close(); const c = norm(cfg || Chrome.cfg, Chrome.ctx().site), sh = c.share, d = this.meta(sh), mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent), ch = (sh.channels || []).filter(x => SHARE_ALL.includes(x));
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
        '<button class="chs-nat" type="button">📤 مشاركة عبر تطبيقات الجهاز</button>' +
        '<div class="chs-url"><input readonly value="' + esc(d.url) + '" aria-label="رابط الصفحة"><button type="button" class="chs-cp">نسخ الرابط</button></div>' +
        '<div class="chs-g">' + ch.map(tile).join("") + '</div><button type="button" class="chs-qrb">▦ رمز QR للمسح بالهاتف</button><div class="chs-qr" hidden></div></div>';
      document.body.appendChild(m);
      m.addEventListener("click", e => { if (e.target === m || e.target.closest(".chs-x")) this.close(); });
      const inp = m.querySelector("input"), cp = m.querySelector(".chs-cp"); inp.onfocus = () => inp.select();
      cp.onclick = async () => { const ok = await this.copy(d.url); cp.textContent = ok ? "تم النسخ ✓" : "انسخ يدوياً"; cp.classList.toggle("ok", ok); if (!ok) inp.select(); setTimeout(() => { cp.textContent = "نسخ الرابط"; cp.classList.remove("ok"); }, 2200); };
      if (navigator.share) { const n = m.querySelector(".chs-nat"); n.style.display = "block"; n.onclick = () => navigator.share({ title: d.title, text: d.text || d.title, url: d.url }).catch(() => { }); }
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
    HEAD_IDS, FOOT_IDS, SHARE_ALL, defaults, norm, headerHtml, topbarHtml, footerHtml, css, Share, cfg: null,
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
        }
        let tb = document.querySelector(".topbar");
        const th = tb && tb.hasAttribute("data-pbw") ? "" : topbarHtml(cfg, ctx);      /* شريط من عنصر المطوّر: لا يُستبدل */
        if (tb && tb.hasAttribute("data-pbw")) { /* يبقى كما صممته */ } else if (th) { if (!tb) { tb = document.createElement("div"); tb.className = "topbar"; document.body.insertBefore(tb, document.body.firstChild); } tb.innerHTML = th; tb.style.display = ""; } else if (tb) tb.style.display = "none";
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
      /* الأزرار الظاهرة */
      if (!this._bound) { this._bound = true; document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-share]"); if (b) { e.preventDefault(); Share.open(); } }); }
      const old = document.getElementById("ch-float"); if (old) old.remove();
      if (c.share.float && !/embed/.test(location.search)) {
        const b = document.createElement("button"); b.id = "ch-float"; b.type = "button"; b.setAttribute("data-share", ""); b.setAttribute("aria-label", "مشاركة");
        const pos = c.share.pos === "bottom-right" ? "right:14px" : "left:14px";
        b.style.cssText = "position:fixed;bottom:84px;" + pos + ";z-index:60;border:0;background:#173f35;color:#fff;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;box-shadow:0 8px 22px rgba(0,0,0,.28);cursor:pointer";
        b.innerHTML = SI().glyph("share", 20); document.body.appendChild(b);
      }
    },
    async init() {
      if (window.parent !== window && /pb-embed/.test(document.documentElement.className)) return;
      let cfg = null;
      try { const r = await fetch((typeof REL !== "undefined" ? REL : "") + "assets/data/chrome.json", { cache: "no-store" }); if (r.ok) cfg = await r.json(); } catch (e) { }
      this.apply(cfg);
    }
  };
  return out;
})();
