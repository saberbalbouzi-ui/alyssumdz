import { HttpError, ok } from "../core.js";
import { hmacHex, nowStr, randHex, safeHttpsUrl } from "../util.js";

const BACKOFF = [60, 300, 1800, 7200, 43200];
export const hooks = {
  id: "hooks",
  routes(r, ctx) {
    const { db } = ctx, aad = (t, id) => `hk:${t}:${id}`;
    r.post("/v1/hooks/endpoints", { scope: "hooks:write", summary: "تسجيل webhook صادر لأحداث محددة أو * (يُرجع سرّ التوقيع مرة واحدة)" }, async (req) => {
      if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم");
      const b = req.json(); if (!safeHttpsUrl(String(b.url ?? "")) || String(b.url).length > 300) throw new HttpError(400, "validation_error", "url يجب أن يكون https صالحاً", { url: "https://…" });
      const ev = Array.isArray(b.events) && b.events.length ? b.events.map(String) : ["*"]; if (!ev.every((x) => x === "*" || /^[a-z]{2,20}\.[a-z_*]{1,30}$/.test(x))) throw new HttpError(400, "validation_error", "events غير صالحة");
      if ((await db.val("SELECT COUNT(*) FROM hk_endpoints WHERE tenant_id=? AND active=1", req.tenant.id)) >= 10) throw new HttpError(402, "plan_limit", "حدّ 10 نقاط webhook");
      const secret = "whsec_" + randHex(24), x = await db.run("INSERT INTO hk_endpoints (tenant_id,url,events,secret_enc,active,created_at) VALUES (?,?,?,?,1,?)", req.tenant.id, b.url, JSON.stringify(ev), "pending", nowStr(ctx.clock()));
      await db.run("UPDATE hk_endpoints SET secret_enc=? WHERE id=?", await ctx.vault.encrypt(secret, aad(req.tenant.id, x.id)), x.id);
      return ok({ id: x.id, url: b.url, events: ev, secret, note: "السرّ يوقّع كل تسليم (X-Platform-Signature: t=…,v1=hmac_sha256(secret, t.body)) — يظهر مرة واحدة" }, 201);
    });
    r.get("/v1/hooks/endpoints", { scope: "hooks:read", summary: "نقاط webhook (بلا أسرار)" }, async (req) => ok({ endpoints: (await db.all("SELECT id,url,events,active,created_at FROM hk_endpoints WHERE tenant_id=?", req.tenant.id)).map((e) => ({ ...e, events: JSON.parse(e.events), active: !!e.active })) }));
    r.delete("/v1/hooks/endpoints/:id", { scope: "hooks:write", summary: "حذف نقطة webhook" }, async (req) => ok({ ok: true, removed: (await db.run("DELETE FROM hk_endpoints WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id)).changes }));
    r.post("/v1/hooks/endpoints/:id/test", { scope: "hooks:write", summary: "إرسال حدث اختباري ping" }, async (req) => {
      const e = await db.one("SELECT * FROM hk_endpoints WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!e) throw new HttpError(404, "not_found", "غير موجود");
      await db.run("INSERT INTO hk_deliveries (tenant_id,endpoint_id,event_id,type,payload,state,attempts,next_at,created_at) VALUES (?,?,0,?,?,?,0,?,?)", req.tenant.id, e.id, "platform.ping", JSON.stringify({ ping: true }), "pending", ctx.nowS(), nowStr(ctx.clock())); return ok({ queued: true }, 202);
    });
  },
  on: {
    /** يفرّع الحدث إلى تسليم مستقل لكل نقطة مشترِكة (فشل نقطة لا يعطّل غيرها ولا بقية الوحدات) */
    "*": async (e, ctx) => {
      for (const ep of await ctx.db.all("SELECT id, events FROM hk_endpoints WHERE tenant_id=? AND active=1", e.tenantId)) {
        const subs = JSON.parse(ep.events); if (!subs.some((s) => s === "*" || s === e.type || (s.endsWith(".*") && e.type.startsWith(s.slice(0, -1))))) continue;
        await ctx.db.run("INSERT INTO hk_deliveries (tenant_id,endpoint_id,event_id,type,payload,state,attempts,next_at,created_at) VALUES (?,?,?,?,?,?,0,?,?)", e.tenantId, ep.id, e.id, e.type, JSON.stringify(e.data), "pending", ctx.nowS(), nowStr(ctx.clock()));
      }
    },
  },
  async cron(ctx) {
    const rows = await ctx.db.all("SELECT * FROM hk_deliveries WHERE state='pending' AND next_at<=? ORDER BY id LIMIT 40", ctx.nowS()); let sent = 0, failed = 0;
    for (const d of rows) {
      const ep = await ctx.db.one("SELECT * FROM hk_endpoints WHERE id=?", d.endpoint_id);
      if (!ep || !ep.active || !ctx.vault) { await ctx.db.run("UPDATE hk_deliveries SET state='failed', last_error='endpoint_gone' WHERE id=?", d.id); continue; }
      const secret = await ctx.vault.decrypt(ep.secret_enc, `hk:${ep.tenant_id}:${ep.id}`), ts = ctx.nowS();
      const body = JSON.stringify({ id: "evt_" + d.id, type: d.type, created: Math.floor(Date.parse(d.created_at.replace(" ", "T") + "Z") / 1000), data: JSON.parse(d.payload) });
      let status = 0, err = "";
      if (!safeHttpsUrl(ep.url)) err = "insecure_url";
      else if (!(await ctx.publicUrl(ep.url))) err = "private_destination";
      else { try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
        const res = await ctx.fetchFn(ep.url, { method: "POST", redirect: "manual", signal: ctl.signal, headers: { "Content-Type": "application/json", "X-Platform-Signature": `t=${ts},v1=${await hmacHex(secret, ts + "." + body)}`, "X-Platform-Event": d.type, "User-Agent": "alyssum-platform-webhook/1" }, body }); clearTimeout(t); status = res.status; } catch { err = "network"; } }
      const n = d.attempts + 1;
      if (status >= 200 && status < 300) { await ctx.db.run("UPDATE hk_deliveries SET state='sent', attempts=?, last_error=NULL WHERE id=?", n, d.id); sent++; continue; }
      failed++; const msg = status ? "HTTP " + status : err || "network";
      if (n > BACKOFF.length) await ctx.db.run("UPDATE hk_deliveries SET state='failed', attempts=?, last_error=? WHERE id=?", n, msg, d.id); else await ctx.db.run("UPDATE hk_deliveries SET attempts=?, next_at=?, last_error=? WHERE id=?", n, ts + BACKOFF[n - 1], msg, d.id);
    }
    return { sent, failed };
  },
};
