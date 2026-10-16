import { HttpError, ok } from "../core.js";
import { e164, hmacHex, randHex, safeEq } from "../util.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const YES = ["1", "نعم", "اكد", "أكد", "أؤكد", "تأكيد", "تاكيد", "oui", "confirmer", "confirme", "yes", "confirm", "ok", "ايه", "إيه", "واه"];
const NO = ["2", "لا", "الغاء", "إلغاء", "الغ", "non", "annuler", "no", "cancel"];
const fold = (s) => String(s ?? "").trim().toLowerCase().normalize("NFKD").replace(/[ً-ٰٟ]/g, "").replace(/[^\p{L}\p{N}]/gu, "");
/** تصنيف ردّ الزبون: confirm | cancel | null */
export function classifyReply(text) { const t = fold(text); if (!t) return null; if (YES.map(fold).includes(t)) return "confirm"; if (NO.map(fold).includes(t)) return "cancel"; return null; }
/** قيم متغيّرات قالب الرسالة من الطلب، بالترتيب المضبوط في config.params (name|order_id|total|city|items) */
export function templateParams(order, keys = ["name", "order_id", "total"]) {
  const v = { name: order.customer?.name ?? "", order_id: order.order_id, total: order.total, city: order.customer?.city ?? order.customer?.wilaya ?? "", items: (order.items ?? []).map((i) => i.title ?? i.id).join("، ") };
  return keys.map((k) => ({ type: "text", text: String(v[k] ?? "").slice(0, 200) || "-" }));
}

export const whatsapp = {
  id: "whatsapp", providers: ["whatsapp"],
  routes(r, ctx) {
    const { db } = ctx;
    r.post("/v1/wa/setup", { scope: "integrations:write", summary: "إنشاء/عرض رابط استقبال ردود WhatsApp (ضعه في إعدادات Webhook لتطبيق Meta)" }, async (req) => {
      let h = await db.val("SELECT hook_id FROM wa_hooks WHERE tenant_id=?", req.tenant.id);
      if (!h) { h = randHex(12); await db.run("INSERT INTO wa_hooks (tenant_id,hook_id) VALUES (?,?)", req.tenant.id, h); }
      return ok({ webhook_url: `${ctx.baseUrl}/v1/wa/${h}`, note: "أدخل verify_token وapp_secret في تكامل whatsapp (secrets) قبل التحقق من Meta" });
    });
    // تحقق Meta من الرابط (GET) — لا مفتاح API هنا بل verify_token المحفوظ مشفّراً
    r.get("/v1/wa/:hook", { auth: "public", summary: "تحقق Webhook من Meta" }, async (req) => {
      const row = await db.one("SELECT tenant_id FROM wa_hooks WHERE hook_id=?", req.params.hook); const integ = row ? await ctx.integration(row.tenant_id, "whatsapp") : null;
      if (!integ || req.query["hub.mode"] !== "subscribe" || !integ.secrets.verify_token || !safeEq(req.query["hub.verify_token"] ?? "", integ.secrets.verify_token)) throw new HttpError(403, "forbidden", "رمز التحقق غير صحيح");
      return { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: String(req.query["hub.challenge"] ?? "") };
    });
    // الرسائل الواردة: التوقيع X-Hub-Signature-256 على الجسم الخام إلزامي
    r.post("/v1/wa/:hook", { auth: "public", summary: "ردود الزبائن الواردة من WhatsApp" }, async (req) => {
      const row = await db.one("SELECT tenant_id FROM wa_hooks WHERE hook_id=?", req.params.hook); const integ = row ? await ctx.integration(row.tenant_id, "whatsapp") : null;
      if (!integ?.secrets.app_secret) throw new HttpError(401, "unauthorized", "غير مضبوط");
      const sig = String(req.headers["x-hub-signature-256"] ?? ""); if (!safeEq(sig, "sha256=" + (await hmacHex(integ.secrets.app_secret, req.raw)))) throw new HttpError(401, "unauthorized", "توقيع غير صالح");
      const b = req.json(); let n = 0;
      for (const en of b.entry ?? []) for (const ch of en.changes ?? []) for (const m of ch.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.payload ?? m.button?.text ?? m.interactive?.button_reply?.id ?? m.interactive?.button_reply?.title ?? "", kind = classifyReply(text); if (!kind || !m.from) continue;
        const to = await hmacHex(ctx.secret, "wa:" + String(m.from).replace(/\D/g, "")), sent = await db.one("SELECT order_id FROM wa_sent WHERE tenant_id=? AND to_h=? AND at>? ORDER BY id DESC LIMIT 1", row.tenant_id, to, ctx.nowS() - 7 * 86400);
        if (!sent) continue;
        if (await ctx.emit(row.tenant_id, kind === "confirm" ? "order.customer_confirmed" : "order.customer_cancelled", { order_id: sent.order_id, via: "whatsapp" }, `wa:${m.id}`)) n++;
      }
      return ok({ ok: true, events: n });
    });
  },
  on: {
    /** تأكيد تلقائي: قالب معتمد من Meta يُرسل عند إنشاء الطلب؛ نخزّن ربط (رقم مجزّأ ← طلب) لمطابقة الردّ */
    "order.created": async (e, ctx) => {
      const integ = await ctx.integration(e.tenantId, "whatsapp"); if (!integ || integ.config.enabled === false || !integ.config.phone_number_id || !integ.config.template || !integ.secrets.access_token) return;
      const d = e.data, to = e164(d.customer?.phone); if (!d.order_id || !to) return;
      if (await ctx.db.one("SELECT 1 FROM wa_sent WHERE tenant_id=? AND order_id=?", e.tenantId, String(d.order_id))) return;   // أُرسل سابقاً (إعادة محاولة)
      const res = await ctx.fetchFn(`${GRAPH}/${encodeURIComponent(integ.config.phone_number_id)}/messages`, { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + integ.secrets.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: integ.config.template, language: { code: integ.config.lang ?? "ar" }, components: [{ type: "body", parameters: templateParams(d, integ.config.params) }] } }) });
      if (res.status >= 200 && res.status < 300) { await ctx.db.run("INSERT INTO wa_sent (tenant_id,to_h,order_id,at) VALUES (?,?,?,?)", e.tenantId, await hmacHex(ctx.secret, "wa:" + to), String(d.order_id), ctx.nowS()); await ctx.emit(e.tenantId, "whatsapp.sent", { order_id: d.order_id }); }
      else if (res.status !== 400 && res.status !== 403) throw new Error("whatsapp HTTP " + res.status);   // 400/403: قالب/رقم/صلاحية — إعادة المحاولة لا تفيد
    },
  },
};
