import { HttpError, ok } from "../core.js";

const HOSTS = ["script.google.com", "script.googleusercontent.com"];
const EVENTS = ["order.created", "order.confirmed", "order.status_changed", "order.delivered", "order.returned", "order.customer_confirmed", "order.customer_cancelled"];
const okUrl = (u) => { try { const p = new URL(u); return p.protocol === "https:" && HOSTS.includes(p.hostname) && !p.username; } catch { return false; } };
/** صف الجدول من حدث الطلب (حقول مسطّحة؛ الهاتف للمركز الاتصال فقط) */
export function toRow(type, d) {
  return { order_id: d.order_id, event: type, status: d.status ?? ({ "order.created": "nouvelle", "order.confirmed": "confirmee", "order.delivered": "livree", "order.returned": "echec", "order.customer_confirmed": "confirmee_client", "order.customer_cancelled": "annulee_client" }[type] ?? ""),
    date: d.date ?? "", name: d.customer?.name ?? "", phone: d.customer?.phone ?? "", wilaya: d.customer?.wilaya ?? "", commune: d.customer?.commune ?? d.customer?.city ?? "", address: d.customer?.address ?? "",
    items: (d.items ?? []).map((i) => `${i.title ?? i.id} ×${i.qty ?? 1}`).join("، "), total: d.total ?? "", note: d.note ?? "" };
}
export const sheets = {
  id: "sheets", providers: ["sheets"],
  routes(r, ctx) {
    // الاتجاه العائد: مركز الاتصال يعدّل الحالة في الجدول ← نص Apps Script يرسل هنا (مفتاح API بنطاق sheets:inbound) ← حدث order.sheet_update يقرؤه المتجر
    r.post("/v1/sheets/inbound", { scope: "sheets:inbound", idem: true, limit: { key: "sh", max: 120, win: 60 }, summary: "تحديثات الحالة القادمة من Google Sheets" }, async (req) => {
      const b = req.json(), ups = Array.isArray(b.updates) ? b.updates.slice(0, 100) : null; if (!ups) throw new HttpError(400, "validation_error", "updates مصفوفة مطلوبة", { updates: "[{order_id,status,attempt?,note?,v}]" });
      let n = 0, bad = 0;
      for (const u of ups) {
        const id = String(u?.order_id ?? ""), st = String(u?.status ?? ""); if (!/^[A-Za-z0-9._-]{1,64}$/.test(id) || !/^[a-z_]{3,30}$/.test(st)) { bad++; continue; }
        const data = { order_id: id, status: st, attempt: Math.min(3, Math.max(0, Math.floor(+u.attempt) || 0)), note: String(u.note ?? "").slice(0, 300), source: "sheets" };
        if (req.mode === "live" && (await ctx.emit(req.tenant.id, "order.sheet_update", data, `sheet:${id}:${st}:${data.attempt}:${String(u.v ?? "").slice(0, 40)}`))) n++;
      }
      return ok({ accepted: n, rejected: bad });
    });
  },
  on: Object.fromEntries(EVENTS.map((t) => [t, async (e, ctx) => {
    const integ = await ctx.integration(e.tenantId, "sheets"); if (!integ || integ.config.enabled === false || !okUrl(integ.config.script_url) || !e.data.order_id) return;
    const res = await ctx.fetchFn(integ.config.script_url, { method: "POST", redirect: "follow", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: integ.secrets.shared_secret ?? "", action: "upsert", row: toRow(e.type, e.data) }) });
    if (res.status >= 400 && res.status < 500 && res.status !== 429) return;   // رابط/صلاحية خاطئة: لا فائدة من الإعادة
    if (res.status >= 400) throw new Error("sheets HTTP " + res.status);
  }])),
};
