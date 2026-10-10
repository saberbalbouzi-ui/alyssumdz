/* عميل الدعم: يرسل طلبات هذا الموقع (إنشاء موقع، حذف، دومين، دعم فني) إلى لوحة مزوّد المنصة ويتابع الردود.
   المتصفح لا يقرأ أي جدول؛ يستدعي دوالّ محدودة، ورمز كل طلب سرّي يحفظه هذا المتصفح فقط. */
window.SaasClient = (() => {
  const KEY = "alyssum_saas_tickets", SEEN = "alyssum_saas_seen", PING = "alyssum_saas_ping";
  /* المنصة الافتراضية (مفتاح عام آمن للنشر) — يمكن تجاوزها بـ CONFIG.SAAS_URL / SAAS_KEY */
  const DEF = { url: "https://qvdaiundlkfbmjlummni.supabase.co", key: "sb_publishable_1ZtNDbkZ0uLFEdJeGkX0mw_zwXVI59h" };
  const cfg = () => { const c = (typeof CONFIG !== "undefined" && CONFIG) || {}; return { url: String(c.SAAS_URL || DEF.url).replace(/\/+$/, ""), key: c.SAAS_KEY || DEF.key }; };
  const on = () => { const c = cfg(); return !!(c.url && c.key); };
  const mine = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const save = a => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 40))); } catch (e) { } };
  async function rpc(fn, body) {
    const c = cfg(); if (!on()) throw new Error("off");
    const r = await fetch(c.url + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: c.key, Authorization: "Bearer " + c.key, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
    if (!r.ok) { const e = new Error((j && (j.message || j.hint)) || ("HTTP " + r.status)); e.code = j && j.code; throw e; }
    return j;
  }
  /* إرسال طلب: {kind, subject, body, payload, contact, site} ← {ok, id, num} أو {ok:false, err} */
  async function send(o) {
    try {
      const r = await rpc("saas_submit", { p: { kind: o.kind || "support", subject: String(o.subject || "").slice(0, 200), body: String(o.body || "").slice(0, 6000), origin: location.origin, contact: o.contact || {}, site: o.site || {}, payload: o.payload || {} } });
      const a = mine(); a.unshift({ id: r.id, num: r.num, kind: o.kind || "support", subject: String(o.subject || "").slice(0, 120), at: new Date().toISOString() }); save(a);
      try { const s = JSON.parse(localStorage.getItem(SEEN) || "{}"); s[r.id] = 0; localStorage.setItem(SEEN, JSON.stringify(s)); } catch (e) { }
      return { ok: true, id: r.id, num: r.num };
    } catch (e) { return { ok: false, err: e.code === "53400" ? "rate" : (e.message || "err") }; }
  }
  async function list() {
    const a = mine(); if (!a.length || !on()) return [];
    try { return await rpc("saas_ticket_view", { p: { ids: a.map(x => x.id) } }) || []; } catch (e) { return null; }
  }
  async function status() { try { return await rpc("saas_site_status", { p: { origin: location.origin } }); } catch (e) { return null; } }
  async function reply(id, body) { try { await rpc("saas_ticket_reply", { p: { id, body } }); return { ok: true }; } catch (e) { return { ok: false, err: e.message }; } }
  const seenMap = () => { try { return JSON.parse(localStorage.getItem(SEEN) || "{}"); } catch (e) { return {}; } };
  const adminCount = t => (t.messages || []).filter(m => m.author === "admin").length;
  const markSeen = ts => { const s = seenMap(); (ts || []).forEach(t => { s[t.id] = adminCount(t); }); try { localStorage.setItem(SEEN, JSON.stringify(s)); } catch (e) { } };
  const unseen = ts => { const s = seenMap(); return (ts || []).filter(t => adminCount(t) > (s[t.id] || 0)); };
  /* مراقبة الردود: كل دقيقة، ويُستدعى cb(tickets غير المقروءة) */
  let _t = 0;
  function watch(cb) { clearInterval(_t); const tick = async () => { if (document.hidden) return; const ts = await list(); if (!ts) return; const u = unseen(ts); if (u.length) cb(u, ts); }; setTimeout(tick, 4000); _t = setInterval(tick, 60000); }
  /* نبضة يومية: تُعلِم المنصة بأن الموقع يعمل ونسخته */
  function ping(version) { try { if (!on()) return; const d = new Date().toISOString().slice(0, 10); if (localStorage.getItem(PING) === d) return; localStorage.setItem(PING, d); rpc("saas_site_ping", { p: { origin: location.origin, version: version || "" } }).catch(() => { }); } catch (e) { } }
  return { on, send, list, status, reply, mine, watch, markSeen, unseen, ping };
})();
