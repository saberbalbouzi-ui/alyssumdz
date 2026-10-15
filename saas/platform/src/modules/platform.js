import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { nowStr } from "../util.js";

/** وحدة النظام: نقطة دخول الأحداث الموحّدة (المتجر/التطبيق يدفعان أحداثهما هنا) + إعداد المزوّدين الخارجيين لكل مستأجر */
export function platformModule(providers) {
  return {
    id: "platform",
    routes(r, ctx) {
      const { db } = ctx, TYPE = /^[a-z]{2,20}\.[a-z_]{2,30}$/;
      r.post("/v1/events", { scope: "events:write", idem: true, limit: { key: "ev", max: 600, win: 60 }, summary: "إدخال حدث (order.created / order.confirmed / payment.confirmed …) — id لمنع التكرار" }, async (req) => {
        const b = req.json(); if (!TYPE.test(String(b.type ?? ""))) throw new HttpError(400, "validation_error", "type بصيغة وحدة.حدث", { type: "order.created" });
        if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) throw new HttpError(400, "validation_error", "data كائن مطلوب", { data: "object" });
        const id = b.id === undefined ? null : String(b.id); if (id !== null && !/^[A-Za-z0-9._:-]{1,80}$/.test(id)) throw new HttpError(400, "validation_error", "id غير صالح");
        if (JSON.stringify(b.data).length > 60000) throw new HttpError(413, "payload_too_large", "data أكبر من 60KB");
        if (req.mode === "test") return ok({ accepted: true, sandbox: true }, 202);
        const fresh = await ctx.emit(req.tenant.id, b.type, b.data, id ? `${b.type}:${id}` : null);
        return ok({ accepted: fresh, duplicate: !fresh }, fresh ? 202 : 200);
      });
      /** مدخل موثوق لأحداث الشحن من بوابة الشحن (بالرمز الإداري عبر Service Binding): extId يبدأ بـ«gw:» فلا يستطيع تاجر انتحاله (/v1/events يولّد دائماً «نوع.حدث:»). */
      r.post("/admin/events", { auth: "admin", summary: "حدث شحن من البوابة: { site_ref | tenant_id, type: order.shipped|out_for_delivery|delivered|returned, id, data{order_id,…} }" }, async (req) => {
        const b = req.json(), CARRIER = ["order.shipped", "order.out_for_delivery", "order.delivered", "order.returned"];
        if (!CARRIER.includes(b.type)) throw new HttpError(400, "validation_error", "نوع حدث شحن غير مسموح", { type: CARRIER });
        const id = String(b.id ?? ""); if (!/^[A-Za-z0-9._:-]{1,80}$/.test(id)) throw new HttpError(400, "validation_error", "id مطلوب (أحرف وأرقام و . _ : -)");
        if (!b.data || typeof b.data !== "object" || Array.isArray(b.data) || !String(b.data.order_id ?? "").trim()) throw new HttpError(400, "validation_error", "data.order_id مطلوب");
        if (JSON.stringify(b.data).length > 8000) throw new HttpError(413, "payload_too_large", "data كبير");
        const t = b.tenant_id ? await db.one("SELECT id FROM pf_tenants WHERE id=? AND status='active'", +b.tenant_id) : await db.one("SELECT id FROM pf_tenants WHERE site_ref=? AND status='active'", String(b.site_ref ?? "\u0000"));
        if (!t) throw new HttpError(404, "not_found", "مستأجر غير موجود");
        const fresh = await ctx.emit(t.id, b.type, { ...b.data, source: "carrier" }, `gw:${id}`);
        return ok({ accepted: fresh, duplicate: !fresh }, fresh ? 202 : 200);
      });
      r.get("/v1/events", { scope: "events:read", summary: "قراءة الأحداث (تصفّح بمؤشر after) — لمشغّلات Zapier/Make بالاستعلام الدوري" }, async (req) => {
        const lim = clampLimit(req.query.limit), after = +req.query.after || 0, args = [req.tenant.id]; let q = "SELECT id,type,payload,created_at FROM pf_events WHERE tenant_id=?";
        if (after > 0) { q += " AND id<?"; args.push(after); } if (req.query.type) { q += " AND type=?"; args.push(String(req.query.type)); }
        const rows = await db.all(q + " ORDER BY id DESC LIMIT ?", ...args, lim + 1), pg = paginate(rows, lim);
        return ok({ events: pg.items.map((e) => ({ id: e.id, type: e.type, created_at: e.created_at, data: JSON.parse(e.payload) })), next: pg.next });
      });
      r.get("/v1/integrations", { scope: "integrations:read", summary: "المزوّدون المفعّلون (بلا أسرار)" }, async (req) =>
        ok({ available: providers, integrations: (await db.all("SELECT provider, config, secret_enc IS NOT NULL AS has_secrets, updated_at FROM pf_integrations WHERE tenant_id=?", req.tenant.id)).map((x) => ({ provider: x.provider, config: JSON.parse(x.config), hasSecrets: !!x.has_secrets, updated_at: x.updated_at })) }));
      r.put("/v1/integrations/:provider", { scope: "integrations:write", summary: "ضبط مزوّد: config علني + secrets مشفّرة (لا تُعرض بعد الحفظ)" }, async (req) => {
        const prov = req.params.provider; if (!providers.includes(prov)) throw new HttpError(400, "unknown_provider", "مزوّد غير مدعوم", { provider: providers });
        const b = req.json(), cfg = b.config && typeof b.config === "object" && !Array.isArray(b.config) ? b.config : {}, hasNew = b.secrets && typeof b.secrets === "object" && Object.keys(b.secrets).length;
        if (JSON.stringify(cfg).length > 8000) throw new HttpError(413, "payload_too_large", "config كبير");
        const ex = await ctx.integration(req.tenant.id, prov); let enc = null;
        if (hasNew || (ex && Object.keys(ex.secrets).length)) {
          if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم");
          const merged = { ...(ex?.secrets ?? {}), ...(hasNew ? Object.fromEntries(Object.entries(b.secrets).map(([k, v]) => [k, String(v ?? "").slice(0, 4000)])) : {}) };
          enc = await ctx.vault.encrypt(merged, `pf:${req.tenant.id}:${prov}`);
        }
        await db.run("INSERT INTO pf_integrations (tenant_id,provider,config,secret_enc,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,provider) DO UPDATE SET config=excluded.config, secret_enc=excluded.secret_enc, updated_at=excluded.updated_at", req.tenant.id, prov, JSON.stringify(cfg), enc, nowStr(ctx.clock()));
        return ok({ ok: true, provider: prov });
      });
      r.delete("/v1/integrations/:provider", { scope: "integrations:write", summary: "فصل مزوّد وحذف أسراره" }, async (req) => { const x = await db.run("DELETE FROM pf_integrations WHERE tenant_id=? AND provider=?", req.tenant.id, req.params.provider); return ok({ ok: true, removed: x.changes }); });
    },
  };
}
