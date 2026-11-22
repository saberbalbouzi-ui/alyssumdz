/* إجراءات LAURA التي تنفّذها لوحة التحكم في متصفح المستخدم (exec:"client").
   السبب: مصدر حقيقة المنتجات ملفات المتجر نفسه (assets/js/data.js) لا قاعدة الخادم؛ فيتحقق الخادم من الوسائط ويطلب موافقة المستخدم ويُصدر أمراً موقَّعاً مرة واحدة،
   وتنفّذه اللوحة بجلسة المستخدم وصلاحياتها ودوالّها الحالية (Admin.setStock/setPrice ثم النشر الحالي) ثم **تقرأ الملف المنشور من جديد** وتعيد ما رأته؛ الخادم هو من يطابقه مع المطلوب.
   لا يُنفَّذ هنا أي شيء لم يأتِ في ردّ موافقة الخادم، ويُعاد فحص الوسائط محلياً (لا ثقة بنص النموذج).
   السياق: لوحة التحكم ← Admin وGH في الصفحة نفسها؛ Spatial Core ← من إطار لوح جاهز (نفس الأصل). حدود: منتجات بسيطة فقط (بلا تنويعات/مجمّعة)، والسعر الأساسي لا عروض الكميات. */
(() => {
  "use strict";
  if (window.LauraActions) return;
  const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/, sleep = ms => new Promise(r => setTimeout(r, ms));
  /* Admin وGH ثوابت عامة وليست على window: نصل إليهما مباشرة في لوحة التحكم، وبـeval في إطار Spatial */
  function pair(w) { try { const r = w.eval('typeof Admin !== "undefined" && typeof GH !== "undefined" && Admin && Array.isArray(Admin.products) ? [Admin, GH] : null'); return r ? { A: r[0], GH: r[1] } : null; } catch (_) { return null; } }
  function ctx() {
    try {
      if (typeof Admin !== "undefined" && typeof GH !== "undefined" && Admin && Array.isArray(Admin.products)) return { A: Admin, GH };
      const S = window.SpatialOS; if (!S) return null; const fs = []; if (S.spare && S.spare.frame) fs.push(S.spare.frame); if (S.panels) S.panels.forEach(p => { if (p.fr) fs.push(p.fr); });
      for (const f of fs) { try { const c = pair(f.contentWindow); if (c) return c; } catch (_) { } }
    } catch (_) { }
    return null;
  }
  /* جاهزية التنفيذ: لوحة محمَّلة بمنتجات ودوال التعديل متوفرة (وإلا لا تُعلَن القدرة للخادم) */
  const available = () => { const c = ctx(); return !!(c && c.A.products.length && typeof c.A.setStock === "function" && typeof c.A.setPrice === "function" && typeof c.GH.getFile === "function"); };
  const simple = p => !(p.type === "variable" || p.type === "grouped" || (Array.isArray(p.variants) && p.variants.length) || (Array.isArray(p.variations) && p.variations.length));
  /* نشر فوري عبر آلية اللوحة نفسها (تجاوز مهلة التأخير) مع إعادة محاولة واحدة */
  async function publish(A) {
    for (let k = 0; k < 2; k++) {
      clearTimeout(A._stockTimer); A._stockDirty = true; const t0 = Date.now();
      while (A._stockBusy && Date.now() - t0 < 30000) await sleep(250);
      try { await A.flushStockPublish(); } catch (_) { }
      const t1 = Date.now(); while (A._stockBusy && Date.now() - t1 < 30000) await sleep(250);
      if (!A._stockDirty && !A._stockBusy) return true;
    }
    return false;
  }
  /* قراءة الملف المنشور (GitHub أو ملفات المتجر) لا ذاكرة اللوحة */
  async function readBack(GH, slug) {
    const f = await GH.getFile("assets/js/data.js"); const b64 = String(f && f.content || "").replace(/\s/g, ""); if (!b64) throw new Error("empty");
    const raw = decodeURIComponent(escape(atob(b64))), ip = raw.indexOf("var PRODUCTS = "); if (ip < 0) throw new Error("format");
    const list = JSON.parse(raw.slice(ip + 15, raw.lastIndexOf(";\n"))); return (list.find(x => x.slug === slug)) || null;
  }
  async function apply(kind, a) {
    const c = ctx(); if (!c) return { ok: false, code: "no_session" }; const { A, GH } = c;
    if (!a || !SLUG.test(String(a.slug || ""))) return { ok: false, code: "invalid" };
    if (kind === "stock") { if (!a.unlimited && !(Number.isInteger(a.stock) && a.stock >= 0 && a.stock <= 1000000)) return { ok: false, code: "invalid" }; }
    else if (!(Number.isInteger(a.price) && a.price >= 1 && a.price <= 10000000)) return { ok: false, code: "invalid" };
    const p = A.products.find(x => x.slug === a.slug); if (!p) return { ok: false, code: "not_found" }; if (!simple(p)) return { ok: false, code: "has_variants" };
    try { const cfg = GH.cfg(); if (!cfg || !cfg.token) return { ok: false, code: "no_publish" }; } catch (_) { return { ok: false, code: "no_publish" }; }
    const before = kind === "stock" ? p.stock : p.price;
    try { if (kind === "stock") A.setStock(a.slug, a.unlimited ? "" : a.stock); else A.setPrice(a.slug, a.price); } catch (_) { return { ok: false, code: "exception" }; }
    const pub = await publish(A);
    if (!pub) { if (kind === "stock") p.stock = before; else p.price = before; A._stockDirty = false; try { A.renderProducts && A.renderProducts(); } catch (_) { } return { ok: false, code: "publish_failed" }; }
    let np = null, source = "store_file"; try { np = await readBack(GH, a.slug); } catch (_) { np = null; }
    if (!np) { np = p; source = "memory"; }
    const num = v => (v === null || v === undefined || v === "") ? null : Number(v);
    return { ok: true, observed: kind === "stock" ? { slug: a.slug, stock: num(np.stock), source } : { slug: a.slug, price: num(np.price), source } };
  }
  async function run(action) {
    try {
      if (!action || typeof action !== "object") return { ok: false, code: "unsupported" };
      if (action.tool === "product_set_stock") return await apply("stock", action.args);
      if (action.tool === "product_set_price") return await apply("price", action.args);
      return { ok: false, code: "unsupported" };
    } catch (_) { return { ok: false, code: "exception" }; }
  }
  window.LauraActions = { available, run, ctx };
})();
