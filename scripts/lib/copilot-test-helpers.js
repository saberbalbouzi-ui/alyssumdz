/* مساعدات مشتركة لاختبارات Copilot (تُحقن داخل الصفحة): بيانات المستخدم التجارية، غلاف أوامر تصميم نموذجي، محوّلات وهمية، وأدوات مقارنة. */
module.exports = `
window.__T = (() => {
  const FACTS = { product: "عسل التركيز", currency: "دج", price: 1800, oldPrice: 3100, offers: [{ label: "قارورة واحدة", qty: 1, price: 1800 }, { label: "قارورتان + قارورة هدية", qty: 3, price: 3200, free: 1 }] };
  const png = () => new Promise(r => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#c8a24b"; x.fillRect(0, 0, 64, 64); c.toBlob(r, "image/png"); });
  /* غلاف أوامر لتصميم قسم عرض كامل: يستعمل رموز {{...}} فقط للأسعار */
  const designOps = () => ({ v: 1, ops: [
    { id: "o1", op: "section.add", args: { name: "offer", as: "offer", height: 760, after: "@first" } },
    { id: "o1b", op: "page.background", args: { sections: ["$offer"], stops: [{ c: "#F8F4E9", p: 0 }, { c: "#F8F4E9", p: 60 }, { c: "#102B4C", p: 100 }] } },
    { id: "o2", op: "layer.add", args: { section: "$offer", as: "bg", layer: { type: "shape", shape: "ellipse", x: 120, y: 60, w: 688, h: 560, fill: "#f5e3b0", opacity: 0.45, blur: 30, z: 1 } } },
    { id: "o3", op: "layer.add", args: { section: "$offer", as: "title", layer: { type: "heading", tag: "h2", text: "عرض {{product}} الخاص", x: 80, y: 80, w: 768, h: 90, z: 5, font: { size: 54, weight: "900", color: "#3b2a05", align: "center" }, effects: [{ type: "fadeUp", delay: 0.1 }] } } },
    { id: "o4", op: "layer.add", args: { section: "$offer", as: "price", layer: { type: "text", text: "السعر: {{price}}", x: 80, y: 200, w: 768, h: 70, z: 5, font: { size: 44, weight: "800", color: "#1b5e20", align: "center" } } } },
    { id: "o5", op: "layer.add", args: { section: "$offer", as: "old", layer: { type: "text", text: "بدل {{old_price}} — وفّر {{save}} ({{save_pct}})", x: 80, y: 280, w: 768, h: 50, z: 5, font: { size: 26, weight: "600", color: "#7a6a3a", align: "center" } } } },
    { id: "o6", op: "layer.add", args: { section: "$offer", as: "off2", layer: { type: "text", text: "{{offer2.label}}: {{offer2.price}} فقط", x: 80, y: 350, w: 768, h: 60, z: 5, font: { size: 32, weight: "700", color: "#3b2a05", align: "center" } } } },
    { id: "o7", op: "layer.add", args: { section: "$offer", as: "jar", layer: { type: "image", prompt: "جرة عسل ذهبية على طاولة خشبية مع ملعقة عسل", x: 260, y: 430, w: 400, h: 220, z: 4, cutout: true, fit: "contain" } } },
    { id: "o8", op: "layer.add", args: { section: "$offer", as: "cta", layer: { type: "button", text: "اطلب الآن", link: "#pb-order", x: 300, y: 660, w: 330, h: 70, z: 6, bg: "#2e7d32" } } },
    { id: "o9", op: "layer.add", args: { section: "$offer", as: "spark", layer: { type: "image", prompt: "ورق نبات أخضر طازج بخلفية بيضاء", x: 60, y: 440, w: 160, h: 160, z: 3, cutout: true } } },
    { id: "o10", op: "effect.set", args: { ref: "$cta", continuous: ["pulse"], shadow: { y: 6, blur: 18, color: "rgba(0,0,0,.3)" } } },
    { id: "o11", op: "effect.set", args: { ref: "$jar", entrance: "zoomIn", continuous: ["float"] } },
    { id: "o12", op: "layer.group", args: { refs: ["$title", "$price"] } },
    { id: "o13", op: "layer.reorder", args: { ref: "$bg", how: "back" } }
  ] });
  const mkAdapters = (extra) => {
    const calls = { plan: 0, ops: 0, edit: 0, img: 0, upload: 0, charge: 0, removeBg: 0 }, uploads = [];
    const a = { mock: true, calls, uploads, store: PBCopilot.stores.mem(),
      llm: { plan: async () => { calls.plan++; return { sections: ["offer"] }; }, ops: async () => { calls.ops++; return designOps(); }, edit: async () => { calls.edit++; return { v: 1, ops: [] }; } },
      img: { generate: async (o) => { calls.img++; return { blob: await png() }; } },
      removeBg: async (b) => { calls.removeBg++; return b; },
      upload: async (b, name) => { calls.upload++; const p = "assets/img/pages/" + name + ".webp"; uploads.push(p); return p; },
      guard: { charge: async (k) => { calls.charge++; return { ok: true }; } } };
    return Object.assign(a, extra || {});
  };
  const open = async () => { PBApp.open(JSON.parse(JSON.stringify(window.__PAGE))); await new Promise(r => setTimeout(r, 2200)); return PBApp.E; };
  const widgets = (page) => { const o = []; page.sections.forEach(s => { (s.free || []).forEach(w => o.push(w)); (s.cols || []).forEach(c => (c.widgets || []).forEach(w => o.push(w))); }); return o; };
  const textOf = w => w.set.text || String(w.set.html || "").replace(/<[^>]+>/g, "");
  const sig = page => widgets(page).map(w => w.type + "|" + (w.set.aiKey || "") + "|" + textOf(w) + "|" + (w.set.src || "")).sort().join("\\n");
  return { FACTS, designOps, mkAdapters, open, widgets, textOf, sig, png };
})();`;
