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
  function pair(w) { try { const r = w.eval('typeof Admin !== "undefined" && typeof GH !== "undefined" && Admin && Array.isArray(Admin.products) ? [Admin, GH, typeof AdminStores !== "undefined" ? AdminStores : null, typeof AdminZones !== "undefined" ? AdminZones : null] : null'); return r ? { A: r[0], GH: r[1], AS: r[2], AZ: r[3], CA: w.ChromeAdmin || null, doc: w.document, win: w } : null; } catch (_) { return null; } }
  function ctx() {
    try {
      if (typeof Admin !== "undefined" && typeof GH !== "undefined" && Admin && Array.isArray(Admin.products)) return { A: Admin, GH, AS: typeof AdminStores !== "undefined" ? AdminStores : null, AZ: typeof AdminZones !== "undefined" ? AdminZones : null, CA: window.ChromeAdmin || null, doc: document, win: window };
      const S = window.SpatialOS; if (!S) return null; const fs = []; if (S.spare && S.spare.frame) fs.push(S.spare.frame); if (S.panels) S.panels.forEach(p => { if (p.fr) fs.push(p.fr); });
      for (const f of fs) { try { const c = pair(f.contentWindow); if (c) return c; } catch (_) { } }
    } catch (_) { }
    return null;
  }
  /* جاهزية التنفيذ: لوحة محمَّلة بمنتجات ودوال التعديل متوفرة (وإلا لا تُعلَن القدرة للخادم) */
  const available = () => { const c = ctx(); return !!(c && typeof c.A.setStock === "function" && typeof c.A.setPrice === "function" && typeof c.GH.getFile === "function"); };
  /* كل صفحات لوحة التحكم المفتوحة (الصفحة نفسها أو إطارات Spatial) لفحص محرر مفتوح بتعديلات غير محفوظة */
  function allDocs(c) { const out = [c.doc]; try { const S = window.SpatialOS; if (S) { const fs = []; if (S.spare && S.spare.frame) fs.push(S.spare.frame); if (S.panels) S.panels.forEach(p => { if (p.fr) fs.push(p.fr); }); fs.forEach(f => { try { if (f.contentDocument && out.indexOf(f.contentDocument) < 0) out.push(f.contentDocument); } catch (_) { } }); } } catch (_) { } return out; }
  const editorOpen = (c, ids) => allDocs(c).some(d => ids.some(id => { const e = d.getElementById(id); return !!e && !e.classList.contains("hidden") && e.offsetParent !== null; }));
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
  async function readJson(GH, path) { const f = await GH.getFile(path), b64 = String(f && f.content || "").replace(/\s/g, ""); if (!b64) throw new Error("empty"); return JSON.parse(decodeURIComponent(escape(atob(b64)))); }
  /* لقطة الإعدادات (قراءة فقط) من الملفات المنشورة نفسها: تُرسل مع رسالة LAURA فتعرض القيمة الحالية قبل أي تعديل؛ مخزَّنة 45ث */
  let snapAt = 0, snapV = null;
  async function settingsSnapshot() {
    if (Date.now() - snapAt < 45000) return snapV; const c = ctx(); if (!c || !c.GH || typeof c.GH.getFile !== "function") return null; snapAt = Date.now(); snapV = null;
    try {
      const st = await readJson(c.GH, "assets/data/store.json").catch(() => null); let ch = null; try { ch = await readJson(c.GH, "assets/data/chrome.json"); } catch (_) { ch = null; }
      let tb = null; try { const C = c.win.Chrome, cfg = C && C.norm ? C.norm(ch && !ch.off ? ch : null, (typeof c.win.CONFIG !== "undefined" && c.win.CONFIG.SITE) || {}) : null; tb = cfg && cfg.header && cfg.header.topbar; } catch (_) { tb = null; }
      let shipping; try { const A = c.A, ps = A.pricingState ? A.pricingState() : { company: false }; if (Array.isArray(A.fees) && A.fees.length) shipping = { source: ps.company ? "company" : "zones", company: String(ps.name || ""), fees: A.fees.map(w => ({ id: w.id, name: String(w.name || ""), home: Number(w.home) || 0, desk: Number(w.stop) || 0, zone: String(w.zn || "") })), zones: ((c.AZ && c.AZ.S && c.AZ.S.zones) || []).map(z => ({ id: String(z.id || ""), name: String(z.name || ""), home: Number(z.home) || 0, desk: Number(z.stop) || 0, free_home: !!z.freeHome, free_desk: !!z.freeStop, free_over: Number(z.freeOver) || 0, wilayas: (z.wilayas || []).slice() })) }; } catch (_) { shipping = undefined; }
      if (!st && !tb) return null;
      snapV = { shipping, taken_at: Math.floor(Date.now() / 1000), maintenance: { on: !!(st && st.maintenance), msg: String(st && st.maintMsg || "") }, announcement: { show: !!(tb && tb.show), text: String(tb && tb.text || ""), bg: String(tb && tb.bg || ""), color: String(tb && tb.color || "") } };
    } catch (_) { snapV = null; }
    return snapV;
  }
  /* wilayas.js يحمل `var WILAYAS = [...]` ثم `var SHIPPING = {...}` (المناطق) */
  async function readWilayas(GH) {
    const f = await GH.getFile("assets/js/wilayas.js"), b64 = String(f && f.content || "").replace(/\s/g, ""), raw = decodeURIComponent(escape(atob(b64))), ip = raw.indexOf("var WILAYAS = "); if (ip < 0) throw new Error("format");
    const is = raw.indexOf(";\nvar SHIPPING = "), W = JSON.parse(raw.slice(ip + 14, is > 0 ? is : raw.lastIndexOf(";\n"))), SH = is > 0 ? JSON.parse(raw.slice(is + 17, raw.lastIndexOf(";\n"))) : {};
    return { W, SH };
  }
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
  const BAD = /[<>\u0000-\u001f]/, HEX = /^(#[0-9a-fA-F]{6})?$/;
  async function maintenance(c, a) {
    const { GH, AS, doc } = c; if (!AS || typeof AS.patch !== "function") return { ok: false, code: "unsupported" };
    if (!a || typeof a.on !== "boolean" || (a.message !== undefined && (typeof a.message !== "string" || a.message.length > 200 || BAD.test(a.message)))) return { ok: false, code: "invalid" };
    try { const cfg = GH.cfg(); if (!cfg || !cfg.token) return { ok: false, code: "no_publish" }; } catch (_) { return { ok: false, code: "no_publish" }; }
    if (editorOpen(c, ["tab-store"])) return { ok: false, code: "editor_open" };
    try { await AS.load(); } catch (_) { }
    const patch = { maintenance: a.on }; if (a.message !== undefined) patch.maintMsg = a.message;
    try { const cb = doc.getElementById("stp-maintenance"); if (cb) cb.checked = a.on; const mm = doc.getElementById("stp-maintMsg"); if (mm && a.message !== undefined) mm.value = a.message; } catch (_) { }   /* collect() يقرأ النموذج إن وُجد فلا يطغى على التعديل */
    try { await AS.patch(patch); } catch (_) { return { ok: false, code: "publish_failed" }; }
    try { const f = await readJson(GH, "assets/data/store.json"); return { ok: true, observed: { maintenance: !!f.maintenance, maintMsg: String(f.maintMsg || ""), source: "store_file" } }; }
    catch (_) { return { ok: true, observed: { maintenance: a.on, maintMsg: a.message === undefined ? "" : a.message, source: "memory" } }; }
  }
  async function announcement(c, a) {
    const { GH, CA } = c; if (!CA || !CA.state || typeof CA.open !== "function" || typeof CA.save !== "function") return { ok: false, code: "unsupported" };
    if (!a || typeof a !== "object" || (a.show === undefined && a.text === undefined && a.bg === undefined && a.color === undefined) || (a.show !== undefined && typeof a.show !== "boolean") || (a.text !== undefined && (typeof a.text !== "string" || a.text.length > 240 || BAD.test(a.text))) || (a.bg !== undefined && !HEX.test(String(a.bg))) || (a.color !== undefined && !HEX.test(String(a.color)))) return { ok: false, code: "invalid" };
    try { const cfg = GH.cfg(); if (!cfg || !cfg.token) return { ok: false, code: "no_publish" }; } catch (_) { return { ok: false, code: "no_publish" }; }
    if (editorOpen(c, ["tab-chromeh", "tab-chromef"])) return { ok: false, code: "editor_open" };
    try {
      CA.state.cfg = null; await CA.open("header");                                                       /* حالة جديدة من الملف (لا تعديلات قديمة في الذاكرة) */
      const t = CA.state.cfg && CA.state.cfg.header && CA.state.cfg.header.topbar; if (!t) return { ok: false, code: "exception" };
      if (a.show !== undefined) t.show = a.show; if (a.text !== undefined) t.text = a.text; if (a.bg !== undefined) t.bg = a.bg; if (a.color !== undefined) t.color = a.color;
      await CA.save();
    } catch (_) { return { ok: false, code: "publish_failed" }; }
    try { const f = await readJson(GH, "assets/data/chrome.json"), tb = f && f.header && f.header.topbar; if (!tb) throw new Error("none"); return { ok: true, observed: { show: !!tb.show, text: String(tb.text || ""), bg: String(tb.bg || ""), color: String(tb.color || ""), source: "store_file" } }; }
    catch (_) { const t = CA.state.cfg.header.topbar; return { ok: true, observed: { show: !!t.show, text: String(t.text || ""), bg: String(t.bg || ""), color: String(t.color || ""), source: "memory" } }; }
  }
  async function shippingFee(c, a) {
    const { A, GH, win } = c, num = v => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 100000);
    if (!a || !Number.isInteger(a.wilaya) || a.wilaya < 1 || a.wilaya > 58 || !num(a.home) || !num(a.desk) || (a.home === undefined && a.desk === undefined)) return { ok: false, code: "invalid" };
    try { const cfg = GH.cfg(); if (!cfg || !cfg.token) return { ok: false, code: "no_publish" }; } catch (_) { return { ok: false, code: "no_publish" }; }
    if (!Array.isArray(A.fees) || !A.fees.length || typeof A.publishWilayasJs !== "function") return { ok: false, code: "unsupported" };
    try { if (A.pricingState && A.pricingState().company) return { ok: false, code: "company_pricing" }; } catch (_) { }
    if (c.AZ && !A.__znWrap) return { ok: false, code: "unsupported" };                                  /* وحدة المناطق لم تُغلِّف النشر بعد: نشر wilayas.js الأصلي كان سيُسقط SHIPPING */
    const sig = L => (L || []).map(w => w.id + ":" + w.home + ":" + w.stop).join("|"); if (sig(A.fees) !== sig(A.feesOriginal)) return { ok: false, code: "editor_open" };     /* تعديلات رسوم غير محفوظة في اللوحة: لا نمسّها */
    const w = A.fees.find(x => x.id === a.wilaya); if (!w) return { ok: false, code: "wilaya_not_found" }; if (w.zn) return { ok: false, code: "zone_managed" };
    const before = { home: w.home, stop: w.stop }; if (a.home !== undefined) w.home = a.home; if (a.desk !== undefined) w.stop = a.desk;
    try { const api = win.eval('typeof API !== "undefined" && API.saveFees ? API : null'); if (api) api.saveFees(A.key, A.fees); } catch (_) { }      /* سجل تاريخي كما يفعل زرّ الحفظ */
    A.feesOriginal = JSON.parse(JSON.stringify(A.fees)); try { win.WILAYAS = A.fees; } catch (_) { } try { A.renderFees && A.renderFees(); } catch (_) { }
    let ok = false; try { ok = await A.publishWilayasJs(); } catch (_) { ok = false; }
    if (!ok) { w.home = before.home; w.stop = before.stop; A.feesOriginal = JSON.parse(JSON.stringify(A.fees)); try { win.WILAYAS = A.fees; A.renderFees && A.renderFees(); } catch (_) { } return { ok: false, code: "publish_failed" }; }
    try {
      const { W } = await readWilayas(GH), nw = W.find(x => x.id === a.wilaya); if (!nw) throw new Error("none");
      return { ok: true, observed: { wilaya: a.wilaya, home: Number(nw.home), desk: Number(nw.stop), source: "store_file" } };
    } catch (_) { return { ok: true, observed: { wilaya: a.wilaya, home: Number(w.home), desk: Number(w.stop), source: "memory" } }; }
  }
  async function shippingZone(c, a) {
    const { A, GH, AZ } = c, num = v => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 100000);
    if (!a || !/^[A-Za-z0-9_-]{1,24}$/.test(String(a.zone || "")) || !num(a.home) || !num(a.desk) || (a.free_home !== undefined && typeof a.free_home !== "boolean") || (a.free_desk !== undefined && typeof a.free_desk !== "boolean") || (a.free_over !== undefined && !(Number.isInteger(a.free_over) && a.free_over >= 0 && a.free_over <= 10000000)) || ["home", "desk", "free_home", "free_desk", "free_over"].every(k => a[k] === undefined)) return { ok: false, code: "invalid" };
    try { const cfg = GH.cfg(); if (!cfg || !cfg.token) return { ok: false, code: "no_publish" }; } catch (_) { return { ok: false, code: "no_publish" }; }
    if (!AZ || !AZ.S || typeof AZ.apply !== "function" || !Array.isArray(A.fees) || typeof A.publishWilayasJs !== "function") return { ok: false, code: "unsupported" };
    try { if (A.pricingState && A.pricingState().company) return { ok: false, code: "company_pricing" }; } catch (_) { }
    if (c.AZ && !A.__znWrap) return { ok: false, code: "unsupported" };                                  /* وحدة المناطق لم تُغلِّف النشر بعد: نشر wilayas.js الأصلي كان سيُسقط SHIPPING */
    const sig = L => (L || []).map(w => w.id + ":" + w.home + ":" + w.stop).join("|"); if (sig(A.fees) !== sig(A.feesOriginal)) return { ok: false, code: "editor_open" };
    const z = AZ.S.zones.find(q => q.id === a.zone); if (!z) return { ok: false, code: "zone_not_found" };
    const before = { home: z.home, stop: z.stop, freeHome: z.freeHome, freeStop: z.freeStop, freeOver: z.freeOver }, feesBefore = JSON.parse(JSON.stringify(A.fees));
    if (a.home !== undefined) z.home = a.home; if (a.desk !== undefined) z.stop = a.desk; if (a.free_home !== undefined) z.freeHome = a.free_home; if (a.free_desk !== undefined) z.freeStop = a.free_desk; if (a.free_over !== undefined) z.freeOver = a.free_over;
    const restore = () => { Object.assign(z, before); A.fees = feesBefore; A.feesOriginal = JSON.parse(JSON.stringify(feesBefore)); try { c.win.WILAYAS = A.fees; A.renderFees && A.renderFees(); } catch (_) { } };
    try { AZ.apply(); } catch (_) { restore(); return { ok: false, code: "exception" }; }
    try { const api = c.win.eval('typeof API !== "undefined" && API.saveFees ? API : null'); if (api) api.saveFees(A.key, A.fees); } catch (_) { }
    A.feesOriginal = JSON.parse(JSON.stringify(A.fees)); try { c.win.WILAYAS = A.fees; A.renderFees && A.renderFees(); } catch (_) { }
    let ok = false; try { ok = await A.publishWilayasJs(); } catch (_) { ok = false; } if (!ok) { restore(); return { ok: false, code: "publish_failed" }; }
    try {
      const { W, SH } = await readWilayas(GH), nz = (SH.zones || []).find(q => q.id === a.zone); if (!nz) throw new Error("none");
      const derived = (nz.wilayas || []).every(id => { const w = W.find(x => x.id === id); return !!w && (a.home === undefined || Number(w.home) === a.home) && (a.desk === undefined || Number(w.stop) === a.desk); });
      return { ok: true, observed: { zone: a.zone, home: Number(nz.home), desk: Number(nz.stop), free_home: !!nz.freeHome, free_desk: !!nz.freeStop, free_over: Number(nz.freeOver) || 0, derived_ok: derived, source: "store_file" } };
    } catch (_) { return { ok: true, observed: { zone: a.zone, home: Number(z.home), desk: Number(z.stop), free_home: !!z.freeHome, free_desk: !!z.freeStop, free_over: Number(z.freeOver) || 0, derived_ok: false, source: "memory" } }; }
  }
  async function freeShip(c, a) {
    const { A, GH } = c; if (!a || !SLUG.test(String(a.slug || "")) || typeof a.free !== "boolean") return { ok: false, code: "invalid" };
    const p = A.products.find(x => x.slug === a.slug); if (!p) return { ok: false, code: "not_found" };
    try { const cfg = GH.cfg(); if (!cfg || !cfg.token) return { ok: false, code: "no_publish" }; } catch (_) { return { ok: false, code: "no_publish" }; }
    const before = p.freeShip; p.freeShip = a.free; try { A.renderProducts && A.renderProducts(); } catch (_) { }
    const pub = await publish(A); if (!pub) { if (before === undefined) delete p.freeShip; else p.freeShip = before; A._stockDirty = false; try { A.renderProducts && A.renderProducts(); } catch (_) { } return { ok: false, code: "publish_failed" }; }
    let np = null, source = "store_file"; try { np = await readBack(GH, a.slug); } catch (_) { np = null; } if (!np) { np = p; source = "memory"; }
    return { ok: true, observed: { slug: a.slug, freeShip: !!np.freeShip, source } };
  }
  async function run(action) {
    snapAt = 0;                                                                                          /* بعد أي تنفيذ تُقرأ اللقطة من جديد */
    try {
      if (!action || typeof action !== "object") return { ok: false, code: "unsupported" };
      if (action.tool === "product_set_stock") return await apply("stock", action.args);
      if (action.tool === "product_set_price") return await apply("price", action.args);
      if (action.tool === "shipping_fee_set" || action.tool === "shipping_zone_set" || action.tool === "product_set_free_shipping") { const c = ctx(); if (!c) return { ok: false, code: "no_session" }; return action.tool === "shipping_fee_set" ? await shippingFee(c, action.args) : action.tool === "shipping_zone_set" ? await shippingZone(c, action.args) : await freeShip(c, action.args); }
      if (action.tool === "maintenance_set" || action.tool === "announcement_set") { const c = ctx(); if (!c) return { ok: false, code: "no_session" }; return action.tool === "maintenance_set" ? await maintenance(c, action.args) : await announcement(c, action.args); }
      return { ok: false, code: "unsupported" };
    } catch (_) { return { ok: false, code: "exception" }; }
  }
  window.LauraActions = { available, run, ctx, settingsSnapshot, invalidate: () => { snapAt = 0; } };
})();
