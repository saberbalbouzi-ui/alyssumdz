/* مزامنة الطلبات مع منصة API: كل طلب جديد وكل تغيّر حالة (تأكيد/تسليم/إلغاء) يُرسَل كحدث (order.created|confirmed|delivered|cancelled)
   فتعمل عليه الخدمات المفعّلة (الإعلانات من الخادم، تأكيد واتساب، جدول الطلبات). المعرّف ثابت لكل (طلب، نوع) فلا يتكرر.
   تعمل فقط إن كانت الخدمة مفعّلة على الموقع؛ وإلا تتوقف بصمت. لا تُرسل طلبات أقدم من 72 ساعة. */
const PlatformSync = (() => {
  const KEY = "alyssum_pf_sent", MAX = 40, AGE = 72 * 3600 * 1000;
  const S = { off: false, busy: false };
  const sent = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  const save = m => { try { const k = Object.keys(m); if (k.length > 1500) k.slice(0, k.length - 1000).forEach(x => delete m[x]); localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { } };
  const TYPE = { nouvelle: "order.created", confirmee: "order.confirmed", livree: "order.delivered", annulee: "order.cancelled", echec: "order.failed" };
  const ts = o => { const t = Date.parse(o.date || o.created_at || ""); return isFinite(t) ? t : 0; };
  /** مرجع الطلب في المنصة: المرجع الذي أنشأه المتجر (extra) وإلا معرّف الطلب — فلا يتكرر حدث الإنشاء من المتجر واللوحة */
  const refOf = o => String((o && o.extra && typeof o.extra === "object" && o.extra["🔗 مرجع"]) || (o && o.id) || "");
  function payload(o) {
    let items = []; try { items = (typeof Admin !== "undefined" && Admin.orderLines ? Admin.orderLines(o) : []).map(l => ({ id: l.p.slug, title: l.p.title, qty: l.qty, price: l.qty ? Math.round(l.total / l.qty) : l.total })); } catch (e) { }
    return { order_id: refOf(o), total: Math.round(+o.total || 0), currency: "DZD", event_time: new Date(ts(o) || Date.now()).toISOString(), customer: { name: o.name || "", phone: o.phone || "", city: o.wilaya || "" }, items, event_id: refOf(o) };
  }
  async function emit(o, type) {
    if (S.off || !type || typeof AdminCarts === "undefined") return false;
    const r = await AdminCarts.call("POST", "/v1/events", { type, id: refOf(o), data: payload(o) });
    if (!r.ok && (AdminCarts._s.off || r.st === 401)) { S.off = true; return false; }
    return r.ok;
  }
  /** مزامنة الكتالوج (أسعار، عروض، تنويعات، مخزون) وأكواد التخفيض البسيطة؛ لا تُرسل إلا عند تغيّر المحتوى */
  function catalogPayload() {
    const a = typeof Admin !== "undefined" ? Admin : null; if (!a || !Array.isArray(a.products)) return null;
    const lab = (p, v) => { try { return typeof variationLabel === "function" ? variationLabel(p, v) : ""; } catch (e) { return ""; } };
    return { replace: true, products: a.products.filter(p => p && p.slug).map(p => ({ slug: p.slug, title: p.title, price: Math.round(+p.price || 0), stock: p.stock == null ? null : p.stock, active: p.active !== false, cat: p.cat || "", freeShip: !!p.freeShip,
      offers: (p.offers || []).map(o => ({ qty: o.qty, price: o.price, free: o.free || 0 })), variations: (p.variations || []).map(v => ({ id: v.id, price: Math.round(+v.price || 0), stock: v.stock == null ? null : v.stock, active: v.active !== false, label: lab(p, v) })) })) };
  }
  async function syncCatalog() {
    const body = catalogPayload(); if (!body || !body.products.length) return;
    const cps = (Array.isArray(Admin.coupons) ? Admin.coupons : []).filter(c => c && c.code && ["percent", "fixed", "freeship"].includes(c.type)).map(c => ({ code: c.code, type: c.type, value: +c.value || 0, min: +c.min || 0, active: c.active !== false, from: c.from ? Math.floor(Date.parse(c.from) / 1000) || null : null, to: c.to ? Math.floor(Date.parse(c.to) / 1000) || null : null }));
    const sig = JSON.stringify([body, cps]); let h = 0; for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
    let last = ""; try { last = localStorage.getItem("alyssum_pf_cat") || ""; } catch (e) { }
    if (last === String(h)) return;
    const r = await AdminCarts.call("PUT", "/v1/catalog/products", body); if (!r.ok) { if (AdminCarts._s.off || r.st === 401) S.off = true; return; }
    await AdminCarts.call("PUT", "/v1/catalog/coupons", { coupons: cps });
    try { localStorage.setItem("alyssum_pf_cat", String(h)); } catch (e) { }
  }
  async function tick() {
    if (S.off || S.busy || document.hidden || typeof Admin === "undefined" || !Array.isArray(Admin.orders)) return;
    S.busy = true;
    try {
      await syncCatalog();
      const m = sent(), now = Date.now(); let n = 0;
      for (const o of Admin.orders) {
        if (n >= MAX) break; const type = TYPE[o.status]; if (!type || !o.id || (o.note && /🗑/.test(o.note))) continue;
        const k = refOf(o) + ":" + type; if (m[k] || (ts(o) && now - ts(o) > AGE)) continue;
        // الطلب الذي تجاوز «جديد» يُرسل حدث إنشائه أيضاً ليُحسب في الإعلانات مرة واحدة
        if (type !== "order.created" && !m[refOf(o) + ":order.created"]) { if (await emit(o, "order.created")) m[refOf(o) + ":order.created"] = 1; else if (S.off) break; }
        if (await emit(o, type)) { m[k] = 1; n++; } else if (S.off) break;
      }
      save(m);
    } finally { S.busy = false; }
  }
  function init() { setTimeout(tick, 20000); setInterval(tick, 90000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { tick, payload, syncCatalog, catalogPayload, refOf, _s: S };
})();
