import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { localPhone, e164, hmacHex, safeHttpsUrl } from "../util.js";

/** وحدة SMS بمحوّل HTTP عام (مزوّد غير محسوم): الرابط وطريقة التوثيق وأسماء الحقول من إعداد المستأجر، فيعمل مع أي مزوّد له REST.
 *  الرصيد بشرائح الرسائل (GSM‑7: 160 حرفاً للشريحة الواحدة و153 عند التقسيم؛ UCS‑2 للعربية: 70 و67)، يُخصم قبل الإرسال ويُرد عند الفشل النهائي. */
export const EVENTS = ["order.created", "order.confirmed", "order.shipped", "order.delivered", "order.cancelled", "payment.confirmed"];
const GSM = /^[\n\r\x20-\x7E£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà€]*$/;
export function segments(text) {
  const t = String(text ?? ""), n = [...t].length; if (!n) return 0;
  return GSM.test(t) ? (n <= 160 ? 1 : Math.ceil(n / 153)) : (n <= 70 ? 1 : Math.ceil(n / 67));
}
export function render(tpl, d) {
  const v = { name: d.customer?.name ?? "", order_id: d.order_id ?? "", total: d.total ?? d.amount ?? "", tracking: d.tracking ?? "", store: d.store ?? "", city: d.customer?.city ?? "" };
  return String(tpl ?? "").replace(/\{(name|order_id|total|tracking|store|city)\}/g, (_, k) => String(v[k] ?? "")).replace(/\s+/g, " ").trim();
}
/** ضمن نافذة الإرسال (توقيت الجزائر UTC+1)؟ الإشعارات المعاملاتية خارج النافذة تُؤجَّل بإعادة محاولة الحدث. */
export function inWindow(ms, from = 8, to = 21) { const h = (new Date(ms).getUTCHours() + 1) % 24; return h >= from && h < to; }

function build(cfg, secrets, to, text) {
  const f = cfg.fields ?? {}, body = { ...(cfg.extra ?? {}), [f.to ?? "to"]: to, [f.message ?? "message"]: text }; if (cfg.sender) body[f.sender ?? "sender"] = cfg.sender;
  let url = cfg.url; const headers = {}, key = secrets.api_key;
  if (cfg.auth === "bearer") headers.Authorization = "Bearer " + key; else if (cfg.auth === "header") headers[cfg.auth_name || "X-Api-Key"] = key;
  else if (cfg.auth === "query") url += (url.includes("?") ? "&" : "?") + encodeURIComponent(cfg.auth_name || "api_key") + "=" + encodeURIComponent(key);
  else if (cfg.auth === "body") body[cfg.auth_name || "api_key"] = key;
  if (cfg.format === "form") { headers["Content-Type"] = "application/x-www-form-urlencoded"; return { url, init: { method: "POST", headers, body: new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString() } }; }
  headers["Content-Type"] = "application/json"; return { url, init: { method: "POST", headers, body: JSON.stringify(body) } };
}

export const sms = {
  id: "sms", providers: ["sms"],
  routes(r, ctx) {
    const { db } = ctx;
    r.get("/v1/sms/balance", { scope: "sms:read", summary: "رصيد SMS (شرائح) وآخر الحركات" }, async (req) => {
      const bal = (await db.val("SELECT balance FROM sms_credits WHERE tenant_id=?", req.tenant.id)) ?? 0, led = await db.all("SELECT delta,reason,ref,at FROM sms_ledger WHERE tenant_id=? ORDER BY id DESC LIMIT 20", req.tenant.id);
      return ok({ balance: bal, ledger: led });
    });
    r.get("/v1/sms/log", { scope: "sms:read", summary: "سجل الإرسال (بلا أرقام)" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = [req.tenant.id]; let q = "SELECT id,event_type,segments,status,error,at FROM sms_log WHERE tenant_id=?"; if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim); return ok({ log: pg.items, next: pg.next });
    });
    r.post("/v1/sms/preview", { scope: "sms:read", summary: "معاينة نص القالب وعدد الشرائح" }, async (req) => { const b = req.json(), t = render(b.template, b.data ?? {}); return ok({ text: t, segments: segments(t), chars: [...t].length }); });
    // شحن الرصيد: للمزوّد فقط (تسعير/فوترة خارج المنصة حالياً)
    r.post("/admin/tenants/:id/sms-credits", { auth: "admin" }, async (req) => {
      const n = Math.trunc(+req.json().credits); if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1_000_000) throw new HttpError(400, "validation_error", "credits عدد صحيح غير صفري");
      const tid = +req.params.id; if (!(await db.one("SELECT id FROM pf_tenants WHERE id=?", tid))) throw new HttpError(404, "not_found", "مستأجر غير موجود");
      await db.run("INSERT INTO sms_credits (tenant_id,balance) VALUES (?,0) ON CONFLICT(tenant_id) DO NOTHING", tid);
      if (n < 0) { const x = await db.run("UPDATE sms_credits SET balance=balance+? WHERE tenant_id=? AND balance>=?", n, tid, -n); if (!x.changes) throw new HttpError(409, "insufficient", "الرصيد أقل من المبلغ المخصوم"); }
      else await db.run("UPDATE sms_credits SET balance=balance+?, low_notified=0 WHERE tenant_id=?", n, tid);
      await db.run("INSERT INTO sms_ledger (tenant_id,delta,reason,ref,at) VALUES (?,?,?,?,?)", tid, n, n > 0 ? "topup" : "adjust", String(req.json().ref ?? "").slice(0, 80) || null, ctx.nowS());
      await ctx.audit(req.actor, "sms.credits", tid, { credits: n }); return ok({ ok: true, balance: await db.val("SELECT balance FROM sms_credits WHERE tenant_id=?", tid) });
    });
  },
  on: Object.fromEntries(EVENTS.map((t) => [t, async (e, ctx) => {
    const { db } = ctx, integ = await ctx.integration(e.tenantId, "sms"); if (!integ || integ.config.enabled === false || !integ.secrets.api_key || !safeHttpsUrl(integ.config.url)) return;
    const tpl = integ.config.templates?.[t]; if (!tpl) return;
    const d = e.data ?? {}, ph = localPhone(d.customer?.phone), to = e164(d.customer?.phone); if (!ph || !to) return;
    if (!inWindow(ctx.clock(), integ.config.window_from ?? 8, integ.config.window_to ?? 21)) throw new Error("خارج نافذة الإرسال — تأجيل");
    const text = render(tpl, d), seg = segments(text); if (!seg) return;
    const toH = await hmacHex(ctx.secret, "sms:" + ph), now = ctx.nowS();
    // حجز فريد لكل (حدث، نوع): إعادة المحاولة لا ترسل ثانية
    const ins = await db.run("INSERT INTO sms_log (tenant_id,event_id,event_type,to_h,segments,status,at) VALUES (?,?,?,?,?,'sending',?) ON CONFLICT(tenant_id,event_id,event_type) DO NOTHING", e.tenantId, e.id, t, toH, seg, now);
    if (!ins.changes) { const ex = await db.val("SELECT status FROM sms_log WHERE tenant_id=? AND event_id=? AND event_type=?", e.tenantId, e.id, t); if (ex === "sending") throw new Error("إرسال سابق غير محسوم"); return; }
    const dec = await db.run("UPDATE sms_credits SET balance=balance-? WHERE tenant_id=? AND balance>=?", seg, e.tenantId, seg);
    if (!dec.changes) { await db.run("UPDATE sms_log SET status='no_credit' WHERE tenant_id=? AND event_id=? AND event_type=?", e.tenantId, e.id, t); if (!(await db.val("SELECT low_notified FROM sms_credits WHERE tenant_id=?", e.tenantId))) { await db.run("UPDATE sms_credits SET low_notified=1 WHERE tenant_id=?", e.tenantId); await ctx.emit(e.tenantId, "sms.credit_empty", {}, `smsempty:${e.tenantId}:${now}`); } return; }
    await db.run("INSERT INTO sms_ledger (tenant_id,delta,reason,ref,at) VALUES (?,?,?,?,?)", e.tenantId, -seg, "send", `${t}:${d.order_id ?? ""}`, now);
    let status = "sent", err = null, retry = false;
    try { const { url, init } = build(integ.config, integ.secrets, to, text), res = await ctx.fetchFn(url, { ...init, redirect: "manual" }); if (res.status < 200 || res.status >= 300) { status = "failed"; err = "HTTP " + res.status; retry = res.status >= 500 || res.status === 429; } }
    catch { status = "failed"; err = "network"; retry = true; }
    if (status === "failed") { await db.run("UPDATE sms_credits SET balance=balance+? WHERE tenant_id=?", seg, e.tenantId); await db.run("INSERT INTO sms_ledger (tenant_id,delta,reason,ref,at) VALUES (?,?,?,?,?)", e.tenantId, seg, "refund", `${t}:${d.order_id ?? ""}`, now); }
    if (status === "failed" && retry) { await db.run("DELETE FROM sms_log WHERE tenant_id=? AND event_id=? AND event_type=?", e.tenantId, e.id, t); throw new Error("sms " + err); }   // يُعاد الحدث لاحقاً
    await db.run("UPDATE sms_log SET status=?, error=? WHERE tenant_id=? AND event_id=? AND event_type=?", status, err, e.tenantId, e.id, t);
  }])),
};
