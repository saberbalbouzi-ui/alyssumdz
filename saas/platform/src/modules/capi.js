import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { e164, nowStr, sha256Hex } from "../util.js";

export const CAPI_PROVIDERS = ["meta", "tiktok", "snapchat"];
const DEFAULT_MAP = {
  meta: { "order.created": "Lead", "order.confirmed": "Purchase" },
  tiktok: { "order.created": "SubmitForm", "order.confirmed": "CompletePayment" },
  snapchat: { "order.created": "SIGN_UP", "order.confirmed": "PURCHASE" },
};
/** تطبيع ثم SHA-256 كما تشترط المنصات (أحرف صغيرة بلا مسافات؛ الهاتف E.164 بلا +) */
const norm = (s) => String(s ?? "").trim().toLowerCase();
const hashOpt = async (v) => (v ? sha256Hex(v) : undefined);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)));
const splitName = (n) => { const w = norm(n).split(/\s+/).filter(Boolean); return [w[0], w.length > 1 ? w.slice(1).join("") : undefined]; };

/** بناء الحمولات — دوال نقية (تُختبر بلا شبكة). ev = حدث الطلب، name = اسم الحدث لدى المنصة */
export async function buildMeta(ev, name, cfg) {
  const c = ev.customer ?? {}, k = ev.click ?? {}, [fn, ln] = splitName(c.name), time = Math.floor((ev.event_time ? Date.parse(ev.event_time) : Date.now()) / 1000);
  const ph = e164(c.phone);
  return clean({ data: [clean({
    event_name: name, event_time: time, event_id: ev.event_id, action_source: "website", event_source_url: k.url,
    user_data: clean({ ph: ph ? [await sha256Hex(ph)] : undefined, em: c.email ? [await sha256Hex(norm(c.email))] : undefined, fn: fn ? [await sha256Hex(fn)] : undefined, ln: ln ? [await sha256Hex(ln)] : undefined,
      ct: c.city ? [await sha256Hex(norm(c.city).replace(/\s+/g, ""))] : undefined, country: [await sha256Hex("dz")], external_id: c.id ? [await sha256Hex(String(c.id))] : undefined,
      client_ip_address: k.ip, client_user_agent: k.user_agent, fbc: k.fbc, fbp: k.fbp }),
    custom_data: clean({ currency: ev.currency ?? "DZD", value: ev.total, order_id: ev.order_id, content_type: "product", content_ids: (ev.items ?? []).map((i) => String(i.id)), contents: (ev.items ?? []).map((i) => ({ id: String(i.id), quantity: i.qty ?? 1, item_price: i.price })), num_items: (ev.items ?? []).reduce((a, i) => a + (i.qty ?? 1), 0) || undefined }) })],
    test_event_code: cfg.test_event_code });
}
export async function buildTikTok(ev, name, cfg) {
  const c = ev.customer ?? {}, k = ev.click ?? {}, ph = e164(c.phone);
  return clean({ event_source: "web", event_source_id: cfg.pixel_id, test_event_code: cfg.test_event_code, data: [clean({
    event: name, event_time: Math.floor((ev.event_time ? Date.parse(ev.event_time) : Date.now()) / 1000), event_id: ev.event_id,
    user: clean({ phone_number: await hashOpt(ph ? "+" + ph : ""), email: await hashOpt(norm(c.email)), external_id: await hashOpt(c.id ? String(c.id) : ""), ip: k.ip, user_agent: k.user_agent, ttclid: k.ttclid, ttp: k.ttp }),
    page: clean({ url: k.url }), properties: clean({ currency: ev.currency ?? "DZD", value: ev.total, order_id: ev.order_id, content_type: "product", contents: (ev.items ?? []).map((i) => ({ content_id: String(i.id), quantity: i.qty ?? 1, price: i.price })) }) })] });
}
export async function buildSnap(ev, name) {
  const c = ev.customer ?? {}, k = ev.click ?? {}, ph = e164(c.phone);
  return { data: [clean({ event_name: name, action_source: "WEB", event_time: ev.event_time ? Date.parse(ev.event_time) : Date.now(), event_source_url: k.url, event_id: ev.event_id,
    user_data: clean({ ph: ph ? [await sha256Hex(ph)] : undefined, em: c.email ? [await sha256Hex(norm(c.email))] : undefined, client_ip_address: k.ip, client_user_agent: k.user_agent, sc_click_id: k.sc_click_id }),
    custom_data: clean({ currency: ev.currency ?? "DZD", value: ev.total, order_id: ev.order_id, content_ids: (ev.items ?? []).map((i) => String(i.id)), num_items: (ev.items ?? []).reduce((a, i) => a + (i.qty ?? 1), 0) || undefined }) })] };
}
const ENDPOINT = {
  meta: (cfg, tok) => ({ url: `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.pixel_id)}/events?access_token=${encodeURIComponent(tok)}`, headers: {} }),
  tiktok: (cfg, tok) => ({ url: "https://business-api.tiktok.com/open_api/v1.3/event/track/", headers: { "Access-Token": tok } }),
  snapchat: (cfg, tok) => ({ url: `https://tr.snapchat.com/v3/${encodeURIComponent(cfg.pixel_id)}/events?access_token=${encodeURIComponent(tok)}`, headers: {} }),
};
const BUILD = { meta: buildMeta, tiktok: buildTikTok, snapchat: buildSnap };

export const capi = {
  id: "capi", providers: CAPI_PROVIDERS,
  routes(r, ctx) {
    r.get("/v1/capi/log", { scope: "capi:read", summary: "آخر إرسالات CAPI (بلا بيانات شخصية)" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = [req.tenant.id]; let q = "SELECT id,provider,event_name,event_id,http,ok,at FROM cp_log WHERE tenant_id=?"; if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await ctx.db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim); return ok({ log: pg.items.map((x) => ({ ...x, ok: !!x.ok })), next: pg.next });
    });
  },
  on: {
    "order.created": handle, "order.confirmed": handle,
  },
};
/** يرسل الحدث لكل مزوّد مفعّل للمستأجر؛ أي فشل يرمي ليُعاد بتباعد، ونجاح مزوّد لا يُعاد عند فشل آخر (event_id يمنع التكرار لدى المنصة أيضاً) */
async function handle(e, ctx) {
  const ev = { ...e.data }; if (!ev.order_id) return;
  let firstErr = null;
  for (const prov of CAPI_PROVIDERS) {
    const integ = await ctx.integration(e.tenantId, prov); if (!integ || integ.config.enabled === false) continue;
    const name = { ...DEFAULT_MAP[prov], ...(integ.config.event_map ?? {}) }[e.type]; if (!name) continue;
    const tok = integ.secrets.access_token; if (!integ.config.pixel_id || !tok) continue;
    ev.event_id = ev.event_id ? String(ev.event_id) : `${ev.order_id}_${name}`;
    if (await ctx.db.one("SELECT 1 FROM cp_log WHERE tenant_id=? AND provider=? AND event_id=? AND ok=1", e.tenantId, prov, ev.event_id)) continue;   // أُرسل سابقاً (إعادة محاولة لمزوّد آخر)
    try {
      const body = await BUILD[prov]({ ...ev, event_id: ev.event_id }, name, integ.config), { url, headers } = ENDPOINT[prov](integ.config, tok);
      const res = await ctx.fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), redirect: "manual" });
      const good = res.status >= 200 && res.status < 300;
      await ctx.db.run("INSERT INTO cp_log (tenant_id,provider,event_name,event_id,http,ok,at) VALUES (?,?,?,?,?,?,?)", e.tenantId, prov, name, ev.event_id, res.status, good ? 1 : 0, nowStr(ctx.clock()));
      if (!good && res.status !== 400) firstErr ??= new Error(`${prov} HTTP ${res.status}`);   // 400 = حمولة مرفوضة: إعادة المحاولة لا تفيد
    } catch (x) { firstErr ??= new Error(`${prov}: ${String(x?.message || x).slice(0, 80)}`); }
  }
  if (firstErr) throw firstErr;
}
