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
  function payload(o) {
    let items = []; try { items = (typeof Admin !== "undefined" && Admin.orderLines ? Admin.orderLines(o) : []).map(l => ({ id: l.p.slug, title: l.p.title, qty: l.qty, price: l.qty ? Math.round(l.total / l.qty) : l.total })); } catch (e) { }
    return { order_id: String(o.id), total: Math.round(+o.total || 0), currency: "DZD", event_time: new Date(ts(o) || Date.now()).toISOString(), customer: { name: o.name || "", phone: o.phone || "", city: o.wilaya || "" }, items, event_id: String(o.id) };
  }
  async function emit(o, type) {
    if (S.off || !type || typeof AdminCarts === "undefined") return false;
    const r = await AdminCarts.call("POST", "/v1/events", { type, id: String(o.id), data: payload(o) });
    if (!r.ok && (AdminCarts._s.off || r.st === 401)) { S.off = true; return false; }
    return r.ok;
  }
  async function tick() {
    if (S.off || S.busy || document.hidden || typeof Admin === "undefined" || !Array.isArray(Admin.orders)) return;
    S.busy = true;
    try {
      const m = sent(), now = Date.now(); let n = 0;
      for (const o of Admin.orders) {
        if (n >= MAX) break; const type = TYPE[o.status]; if (!type || !o.id || (o.note && /🗑/.test(o.note))) continue;
        const k = o.id + ":" + type; if (m[k] || (ts(o) && now - ts(o) > AGE)) continue;
        // الطلب الذي تجاوز «جديد» يُرسل حدث إنشائه أيضاً ليُحسب في الإعلانات مرة واحدة
        if (type !== "order.created" && !m[o.id + ":order.created"]) { if (await emit(o, "order.created")) m[o.id + ":order.created"] = 1; else if (S.off) break; }
        if (await emit(o, type)) { m[k] = 1; n++; } else if (S.off) break;
      }
      save(m);
    } finally { S.busy = false; }
  }
  function init() { setTimeout(tick, 20000); setInterval(tick, 90000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { tick, payload, _s: S };
})();
