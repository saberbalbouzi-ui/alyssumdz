/* الأيقونات العائمة في الموقع: واتساب / اتصال هاتفي / ماسنجر.
   الإعداد في assets/data/float-icons.json ويُحرَّر من لوحة التحكم ← تطبيقات ← الأيقونات العائمة؛ يُحمَّل هذا الملف في صفحات الموقع من app.js
   وفي اللوحة (للمعاينة). تعطيل التطبيق كله من assets/data/apps.json (المعرّف floaters). */
window.FloatIcons = (function () {
  const PHONE = "M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z";
  const META = {
    wa: { n: "واتساب", color: "#25D366", bottom: 20, icon: "whatsapp", label: "تواصل معنا" },
    tel: { n: "اتصال هاتفي", color: "#2563eb", bottom: 88, icon: null, label: "اتصل بنا" },
    msgr: { n: "ماسنجر", color: "#0084ff", bottom: 156, icon: "messenger", label: "راسلنا" }
  };
  const KEYS = ["wa", "tel", "msgr"];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function defaults() {
    const base = k => ({ on: false, side: "left", bottom: META[k].bottom, edge: 20, size: 56, shape: "circle", color: META[k].color, iconColor: "#ffffff", anim: k === "wa" ? "pulse" : "none", label: META[k].label, showLabel: "no", delay: 0, scroll: 0, device: "all", pages: { home: true, product: true, shop: true, other: true }, shadow: true });
    return { v: 1, wa: Object.assign(base("wa"), { number: "", msg: "مرحباً، أريد الاستفسار عن منتجاتكم" }), tel: Object.assign(base("tel"), { number: "" }), msgr: Object.assign(base("msgr"), { page: "" }) };
  }
  function norm(c) {
    const d = defaults(), o = c && typeof c === "object" ? c : {};
    KEYS.forEach(k => { d[k] = Object.assign(d[k], o[k] || {}); d[k].pages = Object.assign(defaults()[k].pages, (o[k] || {}).pages || {}); });
    return d;
  }
  function telHref(n) { const d = String(n || "").replace(/[^\d+]/g, ""); if (!d) return ""; if (d.startsWith("+")) return "tel:" + d; if (d.startsWith("213")) return "tel:+" + d; if (d.startsWith("0") && d.length >= 9) return "tel:+213" + d.slice(1); return "tel:" + d; }
  function waNum(c) { const g = String(c.number || "").replace(/\D/g, ""); if (g) return g.startsWith("0") ? "213" + g.slice(1) : g; return (typeof WA_NUMBER !== "undefined" && WA_NUMBER) || ((typeof CONFIG !== "undefined" && CONFIG.SITE && CONFIG.SITE.waNumber) || ""); }
  function href(k, c) {
    if (k === "wa") { const n = waNum(c); return n ? "https://wa.me/" + n + (c.msg ? "?text=" + encodeURIComponent(c.msg) : "") : ""; }
    if (k === "tel") return telHref(c.number);
    const p = String(c.page || "").trim().replace(/^(https?:\/\/)?(www\.)?(m\.me|facebook\.com|fb\.com)\//i, "").replace(/^\/+|\/+$/g, ""); return p ? "https://m.me/" + p : "";
  }
  function glyph(k, size) {
    const S = window.SocialIcons, id = META[k].icon;
    if (id && S && S.byId && S.byId[id]) return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" aria-hidden="true"><path d="' + S.byId[id].path + '"/></svg>';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" aria-hidden="true"><path d="' + PHONE + '"/></svg>';
  }
  const CSS = ".fli{position:fixed;z-index:9990;display:flex;align-items:center;gap:8px;text-decoration:none;font-family:inherit;opacity:0;transform:translateY(14px) scale(.9);transition:opacity .35s,transform .35s;pointer-events:none}.fli.in{opacity:1;transform:none;pointer-events:auto}.fli.left{flex-direction:row}.fli.right{flex-direction:row-reverse}" +
    ".fli-c{display:grid;place-items:center;flex:none;transition:transform .2s,filter .2s}.fli:hover .fli-c{transform:translateY(-3px) scale(1.06);filter:brightness(1.06)}.fli-t{font-size:.85rem;font-weight:800;padding:.4rem .8rem;border-radius:999px;background:#fff;color:#111;box-shadow:0 4px 14px rgba(0,0,0,.18);white-space:nowrap;direction:rtl}" +
    ".fli.hov .fli-t{max-width:0;padding-inline:0;overflow:hidden;opacity:0;transition:max-width .25s,opacity .2s,padding .25s}.fli.hov:hover .fli-t{max-width:240px;padding-inline:.8rem;opacity:1}" +
    ".fli.shd .fli-c{box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.18),0 6px 16px rgba(0,0,0,.28)}" +
    "@keyframes flp{0%{box-shadow:0 0 0 0 var(--fc,#25D366)}70%{box-shadow:0 0 0 16px transparent}100%{box-shadow:0 0 0 0 transparent}}@keyframes flb{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@keyframes fls{0%,88%,100%{transform:rotate(0)}91%{transform:rotate(-12deg)}94%{transform:rotate(12deg)}97%{transform:rotate(-8deg)}}@keyframes flg{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25) drop-shadow(0 0 8px var(--fc,#25D366))}}" +
    ".fli.a-pulse .fli-c{animation:flp 2s infinite}.fli.a-bounce .fli-c{animation:flb 1.8s ease-in-out infinite}.fli.a-shake .fli-c{animation:fls 3.5s infinite}.fli.a-glow .fli-c{animation:flg 2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.fli .fli-c{animation:none!important}}" +
    ".fli.pv{position:absolute}";
  function css() { if (document.getElementById("fli-css")) return; const s = document.createElement("style"); s.id = "fli-css"; s.textContent = CSS; document.head.appendChild(s); }
  /* عنصر أيقونة واحدة (preview=true: يُوضع داخل صندوق المعاينة ويظهر فوراً) */
  function el(k, c, preview) {
    const h = preview ? "#" : href(k, c); if (!h && !preview) return null;
    const a = document.createElement("a"); a.className = "fli " + c.side + (c.shadow ? " shd" : "") + (c.anim && c.anim !== "none" ? " a-" + c.anim : "") + (c.showLabel === "hover" ? " hov" : "") + (preview ? " pv in" : "");
    a.href = h || "#"; a.setAttribute("aria-label", META[k].n); a.dataset.k = k; if (!preview && k !== "tel") { a.target = "_blank"; a.rel = "noopener noreferrer"; } if (preview) a.addEventListener("click", e => e.preventDefault());
    a.style.cssText = "bottom:" + (+c.bottom || 0) + "px;" + c.side + ":" + (+c.edge || 0) + "px;--fc:" + c.color + ";";
    const sz = Math.max(36, Math.min(96, +c.size || 56)), rad = c.shape === "circle" ? "50%" : c.shape === "rounded" ? Math.round(sz * .28) + "px" : "6px";
    const lab = c.showLabel !== "no" && c.label ? '<span class="fli-t">' + esc(c.label) + '</span>' : "";
    a.innerHTML = '<span class="fli-c" style="width:' + sz + 'px;height:' + sz + 'px;border-radius:' + rad + ';background:' + esc(c.color) + ';color:' + esc(c.iconColor) + '">' + glyph(k, Math.round(sz * .5)) + '</span>' + lab;
    return a;
  }
  function pageType() { const p = location.pathname.replace(/index\.html$/, ""), parts = p.split("/").filter(Boolean); if (!parts.length) return "home"; if (parts.indexOf("p") >= 0) return "product"; if (/shop\.html|account\.html|cart/.test(p)) return "shop"; return "other"; }
  function deviceOk(d) { const m = window.matchMedia && window.matchMedia("(max-width:767px)").matches; return d === "all" || (d === "mobile" && m) || (d === "desktop" && !m); }
  async function init(rel) {
    try {
      if (window.parent !== window || /admin\.html/.test(location.pathname)) return;
      rel = rel || (typeof REL !== "undefined" ? REL : "");
      let off = []; try { const r = await fetch(rel + "assets/data/apps.json", { cache: "no-store" }); if (r.ok) off = (await r.json()).off || []; } catch (e) { }
      if (off.indexOf("floaters") >= 0) return;
      let cfg = null; try { const r = await fetch(rel + "assets/data/float-icons.json", { cache: "no-store" }); if (r.ok) cfg = await r.json(); } catch (e) { }
      if (!cfg) return; cfg = norm(cfg); css(); const pt = pageType(), els = [];
      KEYS.forEach(k => {
        const c = cfg[k]; if (!c.on || !c.pages[pt] || !deviceOk(c.device)) return;
        const a = el(k, c, false); if (!a) return; document.body.appendChild(a); els.push([a, c]);
        const show = () => { setTimeout(() => a.classList.add("in"), Math.max(0, (+c.delay || 0) * 1000)); };
        if (+c.scroll > 0) { const on = () => { if (window.scrollY >= +c.scroll) { removeEventListener("scroll", on); show(); } }; addEventListener("scroll", on, { passive: true }); on(); } else show();
      });
      addEventListener("resize", () => els.forEach(([a, c]) => { a.style.display = deviceOk(c.device) ? "" : "none"; }));
    } catch (e) { }
  }
  return { META, KEYS, defaults, norm, el, css, href, init, esc };
})();
