/* جدول رسوم الشحن الموثوق (A-01): يبني من إعدادات المتجر نفسها ما يدفعه الزبون فعلاً لكل (ولاية، بلدية) في الحالة الافتراضية،
   ليتحقق منه الخادم (PUT /v1/catalog/shipping). هذا نسخ أمين لمنطق shipQuote في app.js (شركة التوصيل الافتراضية أو المناطق، مع
   adj وadjMode وسعر البلدية cp وإضافتها sup والحجب)، ويثبت test-shiptable.js تطابقه مع app.js الحقيقي على كل الولايات والبلديات.
   حدّ: منتج بسعر توصيل خاص (shipCo/shipAdj) أو سلة مختلطة تختلف رسومه عن الجدول — لذا يُبلَّغ عدد هذه المنتجات (`special`). */
const ShipTable = (() => {
  const nk = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  /** حجب الولاية/البلدية: استثناءات المناطق (xw/xc) + بلديات لا توصّل إليها ياليدين (nd في ship-co.json، تُطبَّق في المتجر عند الشركة الافتراضية ياليدين) */
  const blocked = (w, commune, type, co) => {
    if (!w) return true; if (w.xw) return true;
    let m = w.xc && commune ? w.xc[commune] : "";
    if (!m && commune && co && co.def === "yalidine" && co.nd) { const L = co.nd[w.par || w.id]; if (L && L.indexOf(nk(commune)) >= 0) m = "all"; }
    return m === "all" || (m === "home" && type !== "stop");
  };
  /** الرسم الافتراضي كما يحسبه shipQuote(w, commune, type, sub, "", null, undefined) في المتجر */
  function fee(w, commune, type, co) {
    const SHIPCO = co.companies || {}, DEF = co.def || "", SUP = co.sup || {}, CP = co.cp || {};
    let base = type === "stop" ? w.stop : w.home, supAdd = 0;
    const key = DEF, kcm = nk(commune), cfg = key && SHIPCO[key];
    const adjSkip = !!(cfg && cfg.adjMode === "wilaya" && kcm && kcm !== nk(w.name));
    if (key && cfg && cfg.prices) {
      const t = cfg.prices[w.id], v = t ? Number(type === "stop" ? t.stop : t.home) : 0;
      if (v > 0) { base = v; const aj = Number(cfg.adj) || 0; if (aj && !adjSkip) base = Math.max(0, base - aj); }
    }
    const adjOnly = !!(key && cfg && cfg.adjMode === "wilaya" && kcm), cpd = !adjOnly && key === "yalidine" && kcm && CP[w.par || w.id] && CP[w.par || w.id][kcm];
    if (cpd && (type === "stop" ? cpd[1] : cpd[0]) > 0) {
      const aj = Number(cfg && cfg.adj) || 0; base = Math.max(0, Number(type === "stop" ? cpd[1] : cpd[0]) - aj);
    } else if (!adjOnly) {
      const cs = SUP[w.par || w.id], d = cs && kcm && cs[kcm];
      if (d) { const add = Number(type === "stop" ? d[1] : d[0]) || 0; if (add) base = Math.max(0, base + add); }
    }
    return (type === "stop" ? w.fs : w.fh) ? 0 : base;
  }
  /** rates للخادم: صف افتراضي لكل ولاية + صف بلدية فقط حين يختلف رسمها عن الافتراضي */
  function build(wilayas, co) {
    const rates = []; let blockedN = 0;
    for (const w of wilayas || []) {
      if (!w || !w.name || w.hide) continue;
      const home = fee(w, "", "home", co), stop = fee(w, "", "stop", co);
      rates.push({ wilaya: w.name, home, stop, free_over: w.fo > 0 ? Math.round(w.fo) : 0 });
      for (const c of w.communes || []) {
        if (blocked(w, c, "home", co) && blocked(w, c, "stop", co)) { blockedN++; continue; }
        const h = blocked(w, c, "home", co) ? home : fee(w, c, "home", co), s = blocked(w, c, "stop", co) ? stop : fee(w, c, "stop", co);
        if (h !== home || s !== stop) rates.push({ wilaya: w.name, commune: c, home: h, stop: s, free_over: w.fo > 0 ? Math.round(w.fo) : 0 });
      }
    }
    return { rates, blocked: blockedN };
  }
  /** منتجات نشطة برسم توصيل خاص لا يطابق الجدول (تُعاد للتنبيه؛ الخادم لا يستطيع التحقق من رسمها في وضع enforce) */
  const special = (products) => (products || []).filter((p) => p && p.active !== false && ((p.shipCo && p.shipCo !== "") || (p.shipAdj !== undefined && p.shipAdj !== null && p.shipAdj !== ""))).map((p) => p.slug);
  return { build, fee, special };
})();
if (typeof module !== "undefined") module.exports = ShipTable;
