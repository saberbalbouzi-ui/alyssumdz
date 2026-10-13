import { nowStr, randHex, safeEq, sha256Hex } from "./util.js";

/** أخطاء HTTP موحّدة: { error: { code, message, fields? } } */
export class HttpError extends Error {
  constructor(status, code, message, fields = null, headers = {}) { super(message); this.status = status; this.code = code; this.fields = fields; this.headers = headers; }
}
export const ok = (b, status = 200, headers = {}) => ({ status, headers, body: JSON.stringify(b) });

/** غلاف رفيع على D1 */
export class DB {
  constructor(d1) { this.d1 = d1; }
  stmt(sql, a) { return this.d1.prepare(sql).bind(...a); }
  async one(sql, ...a) { return (await this.stmt(sql, a).first()) ?? null; }
  async all(sql, ...a) { return (await this.stmt(sql, a).all()).results ?? []; }
  async run(sql, ...a) { const r = await this.stmt(sql, a).run(); return { id: r.meta?.last_row_id ?? 0, changes: r.meta?.changes ?? 0 }; }
  async val(sql, ...a) { const r = await this.one(sql, ...a); return r ? Object.values(r)[0] : null; }
  static isUnique(e) { return /UNIQUE|constraint/i.test(String(e?.message || e)); }
}

/**
 * نواة المنصة (طبقات): Router ← Controller (وحدات) ← Service (منطق نقي) ← Repository (SQL) ← Adapter (خدمات خارجية).
 * handle() نقية: لا تقرأ Request ولا البيئة، فتُختبر بلا خادم. الوحدة = { id, routes(r, ctx), cron?(ctx), on?: { [eventType]: handler } }.
 * r.get/post/put/delete(pattern, { auth: "public" | "tenant" | "admin", scope?, limit?: {key,max,win} }, handler(req, ctx)).
 */
/** المفاتيح العامة (pk_pub_) للمتصفح: نطاقات محصورة بهذه القائمة + أصل (Origin) مسموح من إعدادات المستأجر `origins` */
export const PUBLIC_SCOPES = ["ab:assign", "ab:track", "fraud:check", "cart:capture", "order:create"];
/** مساعد ترقيم بمؤشر: rows مرتبة تنازلياً بـid وطلب limit+1 ← { items, next } */
export function paginate(rows, limit, idKey = "id") { const more = rows.length > limit, items = rows.slice(0, limit); return { items, next: more ? items[items.length - 1][idKey] : null }; }
export const clampLimit = (v, def = 50, max = 100) => Math.max(1, Math.min(max, Math.floor(+v) || def));

export function createPlatform({ d1, modules = [], secret, adminToken = "", vault = null, files = null, baseUrl = "", clock = () => Date.now(), fetchFn = fetch }) {
  if (!secret || String(secret).length < 16) throw new Error("PLATFORM_SECRET مطلوب (16 حرفاً فأكثر)");
  const db = new DB(d1), routes = [];
  const ctx = { db, clock, fetchFn, secret, vault, files, baseUrl: String(baseUrl).replace(/\/+$/, ""), sha: sha256Hex, now: () => nowStr(clock()), nowS: () => Math.floor(clock() / 1000),
    /** يضيف حدثاً لصندوق الأحداث. extId اختياري: نفس (مستأجر، extId) لا يُدرج مرتين ← يُرجع false */
    async emit(tenantId, type, data, extId = null) {
      try { await db.run("INSERT INTO pf_events (tenant_id,type,payload,ext_id,state,attempts,next_at,created_at) VALUES (?,?,?,?,?,0,?,?)", tenantId, type, JSON.stringify(data), extId, "pending", Math.floor(clock() / 1000), nowStr(clock())); return true; }
      catch (e) { if (extId && DB.isUnique(e)) return false; throw e; }
    },
    /** إعداد مزوّد لمستأجر: { config, secrets } (الأسرار مفكوكة التشفير) أو null */
    async integration(tenantId, provider) {
      const r = await db.one("SELECT config, secret_enc FROM pf_integrations WHERE tenant_id=? AND provider=?", tenantId, provider); if (!r) return null;
      return { config: JSON.parse(r.config || "{}"), secrets: r.secret_enc && vault ? await vault.decryptJson(r.secret_enc, `pf:${tenantId}:${provider}`) : {} };
    },
    async audit(actor, action, target, detail) { await db.run("INSERT INTO pf_audit (at,actor,action,target,detail) VALUES (?,?,?,?,?)", nowStr(clock()), actor, action, target == null ? null : String(target), detail == null ? null : JSON.stringify(detail).slice(0, 500)); },
    async window(key, max, win) { // نافذة معدّل بسيطة (MVP على D1)
      const now = Math.floor(clock() / 1000), r = await db.one("SELECT COUNT(*) AS n, MIN(t) AS o FROM pf_rl WHERE k=? AND t>?", key, now - win);
      if (r.n >= max) return Math.max(1, r.o + win - now);
      await db.run("INSERT INTO pf_rl (k,t) VALUES (?,?)", key, now); if (Math.random() < 0.01) await db.run("DELETE FROM pf_rl WHERE t<?", now - 7200); return null;
    } };
  const compile = (p) => new RegExp("^" + p.replace(/:([a-z]+)/g, "(?<$1>[^/]+)") + "$");
  const add = (method) => (pattern, opts, handler) => routes.push({ method, pattern, re: compile(pattern), opts: { auth: "tenant", ...opts }, handler });
  const r = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE"), patch: add("PATCH") };
  for (const m of modules) m.routes(r, ctx);

  async function authTenant(hd, scope, ip) {
    const b = String(hd.authorization ?? ""), tok = /^bearer /i.test(b) ? b.slice(7).trim() : "";
    const k = /^pk_(live|test|pub)_[0-9a-f]{40}$/.test(tok) ? await db.one("SELECT * FROM pf_keys WHERE key_hash=? AND revoked_at IS NULL", await sha256Hex(tok)) : null;
    const t = k ? await db.one("SELECT * FROM pf_tenants WHERE id=?", k.tenant_id) : null;
    if (!k || !t || t.status !== "active") {
      const w = await ctx.window("bad:" + ip, 30, 60); if (w !== null) throw new HttpError(429, "rate_limited", "محاولات مصادقة فاشلة كثيرة", null, { "Retry-After": String(w) });
      throw new HttpError(401, "unauthorized", "مفتاح API مفقود أو غير صالح", null, { "WWW-Authenticate": "Bearer" });
    }
    const scopes = String(k.scopes).split(",");
    if (scope && !scopes.includes(scope) && !scopes.includes("*")) throw new HttpError(403, "forbidden", `المفتاح لا يملك النطاق ${scope}`);
    const tenant = { ...t, settings: JSON.parse(t.settings || "{}") }, pub = tok.startsWith("pk_pub_"); let origin = null;
    if (pub) { // مفتاح المتصفح: نطاقات عامة محدودة + الأصل يجب أن يكون في قائمة المستأجر
      if (scope && !PUBLIC_SCOPES.includes(scope)) throw new HttpError(403, "forbidden", "هذا المسار لا يقبل مفتاحاً عاماً");
      origin = String(hd.origin ?? ""); if (!origin || !(tenant.settings.origins ?? []).includes(origin)) throw new HttpError(403, "origin_not_allowed", "أصل الطلب غير مسموح لهذا المفتاح");
    }
    await db.run("UPDATE pf_keys SET last_used_at=? WHERE id=?", nowStr(clock()), k.id);
    return { tenant, key: k, pub, origin, mode: tok.startsWith("pk_test_") ? "test" : "live" };
  }
  function authAdmin(hd) { const b = String(hd.authorization ?? ""), tok = /^bearer /i.test(b) ? b.slice(7).trim() : ""; if (!adminToken || !tok || !safeEq(tok, adminToken)) throw new HttpError(401, "unauthorized", "رمز الإدارة غير صالح"); return String(hd["x-actor"] ?? "admin").slice(0, 80); }

  async function handle(method, path, query, headers, raw, ip = "0") {
    const rid = "req_" + randHex(6); let res;
    try { res = await dispatch(method.toUpperCase(), "/" + path.replace(/^\/+|\/+$/g, ""), query ?? {}, headers ?? {}, raw ?? "", ip); }
    catch (e) {
      if (e instanceof HttpError) res = { status: e.status, headers: e.headers, body: JSON.stringify({ error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } }) };
      else { console.error("platform:", e?.stack || e); res = { status: 500, headers: {}, body: '{"error":{"code":"server_error","message":"خطأ داخلي"}}' }; }
    }
    return { status: res.status, headers: { "Content-Type": "application/json; charset=utf-8", "X-Request-Id": rid, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...res.headers }, body: res.body, ...(res.stream ? { stream: res.stream } : {}) };
  }
  /** OpenAPI تلقائي من سجلّ المسارات (الوصف من opts.summary) */
  function openapi() {
    const paths = {}; for (const rt of routes) { if (rt.opts.auth === "admin") continue; const pth = rt.pattern.replace(/:([a-z]+)/g, "{$1}"); (paths[pth] ??= {})[rt.method.toLowerCase()] = { summary: rt.opts.summary ?? "", ...(rt.opts.auth === "tenant" ? { security: [{ bearer: [] }], "x-scope": rt.opts.scope ?? null } : {}), ...(rt.opts.idem ? { "x-idempotent": true } : {}) }; }
    return { openapi: "3.0.3", info: { title: "Alyssum Platform API", version: "1", description: "واجهة موجّهة للجوال أولاً: ترقيم بمؤشر (limit/after)، Idempotency-Key للطلبات المعدِّلة، أخطاء موحّدة، مفاتيح عامة pk_pub_ للمتصفح بنطاقات محدودة." }, components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } }, paths };
  }
  async function dispatch(m, p, q, hd, raw, ip) {
    if (m === "OPTIONS") { // preflight: يُسمح ظاهرياً؛ التحقق الفعلي من الأصل عند الطلب نفسه
      const o = String(hd.origin ?? ""); return { status: 204, headers: o ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type,Idempotency-Key", "Access-Control-Max-Age": "600", Vary: "Origin" } : {}, body: "" };
    }
    if (raw.length > 262144) throw new HttpError(413, "payload_too_large", "الطلب أكبر من 256KB");
    const w = await ctx.window("ip:" + ip, 600, 60); if (w !== null) throw new HttpError(429, "rate_limited", "طلبات كثيرة", null, { "Retry-After": String(w) });
    if (m === "GET" && p === "/health") return ok({ ok: true, modules: modules.map((x) => x.id) });
    if (m === "GET" && p === "/openapi.json") return { status: 200, headers: { "Cache-Control": "public, max-age=300" }, body: JSON.stringify(openapi()) };
    if (m === "POST" && p === "/admin/cron") { const actor = authAdmin(hd); const out = await cron(); await ctx.audit(actor, "cron.manual", null, out); return ok({ ok: true, ...out }); }   // تشغيل يدوي/تشخيص
    for (const rt of routes) {
      if (rt.method !== m) continue; const mm = rt.re.exec(p); if (!mm) continue;
      const req = { method: m, path: p, params: mm.groups ?? {}, query: q, headers: hd, ip, raw, json() { try { const j = JSON.parse(raw); if (j && typeof j === "object" && !Array.isArray(j)) return j; } catch { /* يسقط إلى الخطأ */ } throw new HttpError(400, "validation_error", "جسم الطلب يجب أن يكون JSON"); } };
      if (rt.opts.auth === "admin") req.actor = authAdmin(hd);
      else if (rt.opts.auth === "tenant") {
        const a = await authTenant(hd, rt.opts.scope, ip); req.tenant = a.tenant; req.mode = a.mode; req.pub = a.pub; req.origin = a.origin;
        const lim = rt.opts.limit; if (lim) { const wt = await ctx.window(`t${a.tenant.id}:${lim.key}`, lim.max, lim.win); if (wt !== null) throw new HttpError(429, "rate_limited", "تجاوزت الحدّ المسموح", null, { "Retry-After": String(wt) }); }
      }
      let res;
      if (rt.opts.idem && m !== "GET" && req.tenant && hd["idempotency-key"]) {
        const ik = String(hd["idempotency-key"]).slice(0, 80); if (!/^[A-Za-z0-9._:-]{1,80}$/.test(ik)) throw new HttpError(400, "validation_error", "Idempotency-Key غير صالح");
        const h = await sha256Hex(m + p + raw), ex = await db.one("SELECT * FROM pf_idem WHERE tenant_id=? AND k=?", req.tenant.id, ik);
        if (ex) { if (ex.hash !== h) throw new HttpError(409, "idempotency_conflict", "المفتاح استُعمل لطلب مختلف"); return { status: ex.status, headers: { "Idempotent-Replayed": "true" }, body: ex.body }; }
        res = await rt.handler(req, ctx);
        if (res.status < 500 && typeof res.body === "string") await db.run("INSERT OR IGNORE INTO pf_idem (tenant_id,k,hash,status,body,at) VALUES (?,?,?,?,?,?)", req.tenant.id, ik, h, res.status, res.body, Math.floor(clock() / 1000));
      } else res = await rt.handler(req, ctx);
      if (req.origin) res = { ...res, headers: { ...res.headers, "Access-Control-Allow-Origin": req.origin, Vary: "Origin" } };
      return res;
    }
    // مسار مجهول يتطلب مفتاحاً أولاً (لا تسريب لبنية الواجهة)
    await authTenant(hd, null, ip); throw new HttpError(404, "not_found", `مسار غير موجود: ${m} ${p}`);
  }

  /** للـcron: ينفّذ cron كل وحدة ويوزّع الأحداث المستحقة على معالجات الوحدات (مع إعادة محاولة بتباعد) */
  async function cron() {
    const out = { events: 0, failed: 0 }, handlers = {}; for (const m of modules) for (const [t, h] of Object.entries(m.on ?? {})) (handlers[t] ??= []).push({ mod: m.id, fn: h });
    const rows = await db.all("SELECT * FROM pf_events WHERE state='pending' AND next_at<=? ORDER BY id LIMIT 50", Math.floor(clock() / 1000));
    for (const e of rows) {
      // كل معالج مستقل: ما نجح لا يُعاد عند إعادة المحاولة (done)، وفشل وحدة لا يعطّل بقية الوحدات
      const done = new Set(JSON.parse(e.done || "[]")); let err = null;
      for (const h of [...(handlers[e.type] ?? []), ...(handlers["*"] ?? [])]) {
        const key = h.mod + ":" + (handlers["*"]?.includes(h) ? "*" : e.type); if (done.has(key)) continue;
        try { await h.fn({ id: e.id, tenantId: e.tenant_id, type: e.type, data: JSON.parse(e.payload) }, ctx); done.add(key); } catch (x) { err ??= x; }
      }
      if (!err) { await db.run("UPDATE pf_events SET state='done', attempts=attempts+1, done=? WHERE id=?", JSON.stringify([...done]), e.id); out.events++; continue; }
      out.failed++; const n = e.attempts + 1, back = [60, 300, 1800, 7200, 43200];
      await db.run("UPDATE pf_events SET attempts=?, state=?, next_at=?, last_error=?, done=? WHERE id=?", n, n > back.length ? "failed" : "pending", Math.floor(clock() / 1000) + (back[n - 1] ?? 0), String(err?.message || err).slice(0, 180), JSON.stringify([...done]), e.id);
    }
    for (const m of modules) if (m.cron) Object.assign(out, { [m.id]: await m.cron(ctx) });
    return out;
  }
  return { handle, cron, ctx, db };
}

/** إدارة المستأجرين والمفاتيح (للمزوّد): تُسجَّل كوحدة نظام */
export const adminModule = {
  id: "admin",
  routes(r, ctx) {
    const { db } = ctx;
    r.post("/admin/tenants", { auth: "admin" }, async (req) => {
      const b = req.json(); if (!String(b.name ?? "").trim()) throw new HttpError(400, "validation_error", "name مطلوب");
      try { const x = await db.run("INSERT INTO pf_tenants (name,site_ref,status,settings,created_at) VALUES (?,?,?,?,?)", String(b.name).slice(0, 120), b.site_ref ?? null, "active", JSON.stringify(b.settings ?? {}), ctx.now()); await ctx.audit(req.actor, "tenant.create", x.id, { site_ref: b.site_ref ?? null }); return ok({ id: x.id }, 201); }
      catch (e) { if (DB.isUnique(e)) throw new HttpError(409, "site_ref_taken", "هذا الموقع مرتبط بمستأجر آخر"); throw e; }
    });
    r.post("/admin/tenants/:id/keys", { auth: "admin" }, async (req) => {
      const b = req.json(), id = +req.params.id, scopes = Array.isArray(b.scopes) && b.scopes.length ? b.scopes.map(String) : ["*"], mode = ["test", "pub"].includes(b.mode) ? b.mode : "live";
      if (!(await db.one("SELECT id FROM pf_tenants WHERE id=?", id))) throw new HttpError(404, "not_found", "مستأجر غير موجود");
      if (!scopes.every((s) => s === "*" || /^[a-z]+:[a-z]+$/.test(s))) throw new HttpError(400, "validation_error", "scopes: * أو وحدة:إجراء");
      if (mode === "pub" && !scopes.every((x) => PUBLIC_SCOPES.includes(x))) throw new HttpError(400, "validation_error", "المفتاح العام يقبل فقط: " + PUBLIC_SCOPES.join(", "));
      const key = `pk_${mode}_${randHex(20)}`; await db.run("INSERT INTO pf_keys (tenant_id,prefix,key_hash,scopes,label,created_at) VALUES (?,?,?,?,?,?)", id, key.slice(0, 12), await sha256Hex(key), scopes.join(","), String(b.label ?? "").slice(0, 60), ctx.now());
      await ctx.audit(req.actor, "key.issue", id, { scopes, mode }); return ok({ key, scopes, note: "يظهر مرة واحدة" }, 201);
    });
    r.delete("/admin/keys/:id", { auth: "admin" }, async (req) => { await db.run("UPDATE pf_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL", ctx.now(), +req.params.id); await ctx.audit(req.actor, "key.revoke", req.params.id); return ok({ ok: true }); });
    r.patch("/admin/tenants/:id", { auth: "admin" }, async (req) => {
      const b = req.json(), id = +req.params.id; if (b.status && !["active", "suspended"].includes(b.status)) throw new HttpError(400, "validation_error", "status: active|suspended");
      if (!(await db.one("SELECT id FROM pf_tenants WHERE id=?", id))) throw new HttpError(404, "not_found", "مستأجر غير موجود");
      if (b.status) await db.run("UPDATE pf_tenants SET status=? WHERE id=?", b.status, id);
      if (b.settings && typeof b.settings === "object") await db.run("UPDATE pf_tenants SET settings=? WHERE id=?", JSON.stringify(b.settings), id);
      await ctx.audit(req.actor, "tenant.update", id, { status: b.status ?? null }); return ok({ ok: true });
    });
    r.get("/admin/audit", { auth: "admin" }, async () => ok({ audit: await db.all("SELECT id,at,actor,action,target,detail FROM pf_audit ORDER BY id DESC LIMIT 200") }));
  },
};
