/* وحدة Beta (لا تُحمَّل في الإنتاج): مراحل الإطلاق (internal/closed/public)، دعوات، إيقاف التسجيل، تعطيل حساب تجريبي، حدود استخدام، تنبيه Beta، واستقبال تقارير الأخطاء والملاحظات.
   افتراضات آمنة: المرحلة internal والتسجيل **مغلق** (signups_open=0) على قاعدة جديدة؛ كل حساب يُنشأ بمفتاح **تجريبي (pk_test_)** فقط؛ لا يُرسَل أي بريد/رسالة دعوة (الكود يُعرَض مرة واحدة للمشغّل ليسلّمه يدوياً). */
import { HttpError, ok } from "../core.js";
import { hmacHex, randHex, sha256Hex } from "../util.js";
const PHASES = ["internal", "closed", "public"], KINDS = ["bug", "feedback", "error"];
const DEFAULT_LIMITS = { requests_per_day: 5000, orders_per_day: 200 };
const int = (v, lo, hi, name) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw new HttpError(400, "validation_error", `${name}: عدد صحيح بين ${lo} و${hi}`); return n; };
const today = (s) => new Date(s * 1000).toISOString().slice(0, 10);
export const beta = {
  id: "beta",
  routes(r, ctx) {
    const { db } = ctx;
    const get = (k, d = null) => ctx.meta.get(k, d), set = (k, v) => ctx.meta.set(k, v);
    const state = async () => ({ phase: await get("beta.phase", "internal"), signups_open: (await get("beta.signups_open", "0")) === "1", banner: await get("beta.banner", "نسخة تجريبية (Beta): قد تتغير الميزات وتُمسح البيانات التجريبية. أبلِغنا بأي ملاحظة.") });
    /* حدود الاستخدام لكل مستأجر: عدّاد يومي ذرّي (INSERT … ON CONFLICT DO UPDATE … WHERE يمنع تجاوز السقف حتى مع التزامن) */
    ctx.requestGate = async (req) => {
      const lim = req.tenant?.settings?.beta_limits; if (!lim) return; const day = today(ctx.nowS());
      const bump = async (col, max) => { if (!max) return; const x = await db.run(`INSERT INTO beta_usage (tenant_id,day,${col}) VALUES (?,?,1) ON CONFLICT(tenant_id,day) DO UPDATE SET ${col}=${col}+1 WHERE ${col}<?`, req.tenant.id, day, max); if (x.changes !== 1) throw new HttpError(429, "beta_limit_reached", `بلغ حساب Beta الحدّ اليومي (${col === "orders" ? "الطلبات" : "الطلبات البرمجية"}) — يتجدد غداً`, null, { "Retry-After": "3600" }); };
      await bump("requests", lim.requests_per_day); if (req.method === "POST" && req.path === "/v1/orders") await bump("orders", lim.orders_per_day);
    };
    const validInvite = async (code) => {
      if (!/^[A-Za-z0-9-]{12,60}$/.test(String(code ?? ""))) return null;
      return await db.one("SELECT * FROM beta_invites WHERE code_hash=? AND revoked=0 AND uses<max_uses AND (expires_at IS NULL OR expires_at>?)", await sha256Hex("beta-invite:" + code), ctx.nowS());
    };
    /* ── عامّ ── */
    r.get("/v1/beta/status", { auth: "public", summary: "حالة Beta (المرحلة، التسجيل، نص التنبيه)" }, async () => { const s = await state(); return ok({ environment: ctx.environment?.name ?? "beta", phase: s.phase, signups_open: s.signups_open, banner: s.banner, version: ctx.environment?.version ?? null }); });
    r.post("/v1/beta/feedback", { auth: "public", summary: "تقرير خطأ/ملاحظة من مستخدم Beta" }, async (req) => {
      const w = await ctx.window("fb:" + req.ip, 10, 3600); if (w !== null) throw new HttpError(429, "rate_limited", "ملاحظات كثيرة، حاول لاحقاً", null, { "Retry-After": String(w) });
      const b = req.json(), kind = KINDS.includes(b.kind) ? b.kind : "feedback", msg = String(b.message ?? "").trim().slice(0, 2000); if (msg.length < 3) throw new HttpError(400, "validation_error", "message مطلوب (3 أحرف على الأقل)");
      const x = await db.run("INSERT INTO beta_feedback (kind,message,page,contact,version,created_at) VALUES (?,?,?,?,?,?)", kind, msg, String(b.page ?? "").slice(0, 300) || null, String(b.contact ?? "").slice(0, 120) || null, ctx.environment?.sha ?? null, ctx.now());
      return ok({ id: x.id }, 201);
    });
    r.post("/v1/beta/signup", { auth: "public", summary: "تسجيل مستأجر تجريبي (بحسب مرحلة Beta والدعوة)" }, async (req) => {
      const w = await ctx.window("su:" + req.ip, 5, 3600); if (w !== null) throw new HttpError(429, "rate_limited", "محاولات تسجيل كثيرة", null, { "Retry-After": String(w) });
      const s = await state(), b = req.json(), name = String(b.name ?? "").trim().slice(0, 120); if (name.length < 2) throw new HttpError(400, "validation_error", "name مطلوب");
      if (!s.signups_open) throw new HttpError(403, "signups_paused", "التسجيل في Beta متوقف مؤقتاً");
      let inv = null;
      if (s.phase !== "public") { inv = await validInvite(b.invite); if (!inv) throw new HttpError(403, "invite_required", "التسجيل بدعوة صالحة فقط في هذه المرحلة"); if (s.phase === "internal" && !inv.internal) throw new HttpError(403, "beta_internal_only", "المرحلة الحالية للفريق الداخلي فقط"); }
      if (inv) { const c = await db.run("UPDATE beta_invites SET uses=uses+1 WHERE id=? AND revoked=0 AND uses<max_uses AND (expires_at IS NULL OR expires_at>?)", inv.id, ctx.nowS()); if (c.changes !== 1) throw new HttpError(403, "invite_required", "الدعوة غير صالحة أو استُنفدت"); }
      const t = await ctx.provision.createTenant({ name, actor: "beta:signup", settings: { beta: true, beta_phase: s.phase, beta_invite: inv?.id ?? null, beta_limits: { ...DEFAULT_LIMITS } } });
      const key = await ctx.provision.issueKey(t.id ?? t, { scopes: ["*"], label: "beta-test", actor: "beta:signup", mode: "test", allowWildcard: true });
      return ok({ tenant_id: t.id ?? t, key, mode: "test", limits: DEFAULT_LIMITS, phase: s.phase }, 201);
    });
    /* ── إدارة (رمز الإدارة) ── */
    r.get("/admin/beta", { auth: "admin" }, async () => {
      const s = await state(), inv = await db.one("SELECT COUNT(*) AS n, SUM(CASE WHEN revoked=0 AND uses<max_uses AND (expires_at IS NULL OR expires_at>?) THEN 1 ELSE 0 END) AS active FROM beta_invites", ctx.nowS());
      return ok({ ...s, invites: { total: inv?.n ?? 0, active: inv?.active ?? 0 }, feedback_total: (await db.val("SELECT COUNT(*) FROM beta_feedback")) ?? 0, environment: ctx.environment?.name ?? null });
    });
    r.post("/admin/beta/phase", { auth: "admin" }, async (req) => { const b = req.json(); if (!PHASES.includes(b.phase)) throw new HttpError(400, "validation_error", "phase: internal|closed|public"); await set("beta.phase", b.phase); await ctx.audit(req.actor, "beta.phase", null, { phase: b.phase }); return ok({ phase: b.phase }); });
    r.post("/admin/beta/signups", { auth: "admin" }, async (req) => { const b = req.json(); if (typeof b.open !== "boolean") throw new HttpError(400, "validation_error", "open: boolean"); await set("beta.signups_open", b.open ? "1" : "0"); await ctx.audit(req.actor, "beta.signups", null, { open: b.open }); return ok({ signups_open: b.open }); });
    r.post("/admin/beta/banner", { auth: "admin" }, async (req) => { const b = req.json(), t = String(b.text ?? "").trim().slice(0, 300); if (t.length < 5) throw new HttpError(400, "validation_error", "text مطلوب"); await set("beta.banner", t); return ok({ banner: t }); });
    r.post("/admin/beta/invites", { auth: "admin" }, async (req) => {
      const b = req.json(), days = b.expires_days == null ? 14 : int(b.expires_days, 1, 60, "expires_days"), max = b.max_uses == null ? 1 : int(b.max_uses, 1, 50, "max_uses"), code = "BETA-" + randHex(8).toUpperCase() + "-" + randHex(4).toUpperCase();
      const eh = b.email ? await hmacHex(ctx.secret, "beta-email:" + String(b.email).trim().toLowerCase()) : null;
      const x = await db.run("INSERT INTO beta_invites (code_hash,email_h,note,internal,max_uses,expires_at,created_at) VALUES (?,?,?,?,?,?,?)", await sha256Hex("beta-invite:" + code), eh, String(b.note ?? "").slice(0, 120), b.internal ? 1 : 0, max, ctx.nowS() + days * 86400, ctx.now());
      await ctx.audit(req.actor, "beta.invite.create", x.id, { max_uses: max, internal: !!b.internal, days });
      return ok({ id: x.id, code, expires_days: days, max_uses: max, note: "الكود يُعرَض مرة واحدة فقط ولا يُرسَل تلقائياً — سلّمه يدوياً" }, 201);     // لا إرسال بريد/رسالة
    });
    r.get("/admin/beta/invites", { auth: "admin" }, async () => ok({ invites: (await db.all("SELECT id,note,internal,max_uses,uses,revoked,expires_at,created_at FROM beta_invites ORDER BY id DESC LIMIT 200")).map((x) => ({ ...x, active: !x.revoked && x.uses < x.max_uses && (x.expires_at == null || x.expires_at > ctx.nowS()) })) }));
    r.post("/admin/beta/invites/:id/revoke", { auth: "admin" }, async (req) => { const x = await db.run("UPDATE beta_invites SET revoked=1 WHERE id=?", +req.params.id); if (!x.changes) throw new HttpError(404, "not_found", "دعوة غير موجودة"); await ctx.audit(req.actor, "beta.invite.revoke", req.params.id, null); return ok({ revoked: true }); });
    const tenantOf = async (id) => { const t = await db.one("SELECT id,name,status,settings FROM pf_tenants WHERE id=?", +id); if (!t) throw new HttpError(404, "not_found", "مستأجر غير موجود"); return t; };
    r.post("/admin/beta/tenants/:id/disable", { auth: "admin" }, async (req) => { const t = await tenantOf(req.params.id); await ctx.provision.setStatus(t.id, "suspended", req.actor); return ok({ id: t.id, status: "suspended" }); });
    r.post("/admin/beta/tenants/:id/enable", { auth: "admin" }, async (req) => { const t = await tenantOf(req.params.id); await ctx.provision.setStatus(t.id, "active", req.actor); return ok({ id: t.id, status: "active" }); });
    r.post("/admin/beta/tenants/:id/limits", { auth: "admin" }, async (req) => {
      const t = await tenantOf(req.params.id), b = req.json(), cur = { ...DEFAULT_LIMITS, ...(JSON.parse(t.settings || "{}").beta_limits ?? {}) };
      if (b.requests_per_day != null) cur.requests_per_day = int(b.requests_per_day, 1, 1000000, "requests_per_day"); if (b.orders_per_day != null) cur.orders_per_day = int(b.orders_per_day, 1, 100000, "orders_per_day");
      await ctx.provision.mergeSettings(t.id, { beta: true, beta_limits: cur }, req.actor); await ctx.audit(req.actor, "beta.limits", t.id, cur); return ok({ id: t.id, limits: cur });
    });
    r.get("/admin/beta/usage", { auth: "admin" }, async (req) => ok({ usage: await db.all("SELECT tenant_id,day,requests,orders FROM beta_usage WHERE day=? ORDER BY requests DESC LIMIT 200", String(req.query.day || today(ctx.nowS()))) }));
    r.get("/admin/beta/feedback", { auth: "admin" }, async (req) => { const lim = Math.min(200, Math.max(1, +req.query.limit || 50)); return ok({ feedback: await db.all("SELECT id,kind,message,page,contact,version,created_at FROM beta_feedback ORDER BY id DESC LIMIT ?", lim) }); });
  },
};
