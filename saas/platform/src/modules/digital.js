import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { escHtml, hmacHex, nowStr, randHex, safeHttpsUrl, sha256Hex } from "../util.js";

const DEF = { expires_hours: 72, max_downloads: 3 };
const SAFE_NAME = (n) => String(n ?? "file").replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\.{2,}/g, ".").slice(0, 120) || "file";
const TXT = {
  ar: { subject: "رابط تنزيل طلبك", hello: "مرحباً", body: "شكراً لشرائك. روابط التنزيل أدناه؛ كل رابط صالح لمدة محدودة ولعدد مرات محدود:", h: "ساعة", n: "مرات" },
  fr: { subject: "Vos liens de téléchargement", hello: "Bonjour", body: "Merci pour votre achat. Vos liens ci-dessous sont valables pour une durée et un nombre de téléchargements limités :", h: "h", n: "fois" },
  en: { subject: "Your download links", hello: "Hello", body: "Thanks for your purchase. Each link below is valid for a limited time and a limited number of downloads:", h: "h", n: "times" },
};
/** بريد عبر مزوّد البريد المفعّل للمستأجر (Resend). كل نص ديناميكي مهرَّب. يُرجع true عند النجاح، false إن لم يُفعَّل */
export async function sendEmail(ctx, tenantId, { to, subject, html }) {
  const integ = await ctx.integration(tenantId, "email"); if (!integ || !integ.secrets.api_key || !integ.config.from) return false;
  const res = await ctx.fetchFn("https://api.resend.com/emails", { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + integ.secrets.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ from: integ.config.from, to: [to], subject, html }) });
  if (res.status < 200 || res.status >= 300) throw new Error("email HTTP " + res.status); return true;
}
export function emailHtml(lang, name, links, exp, max) {
  const L = TXT[lang] ? lang : "ar", t = TXT[L], dir = L === "ar" ? "rtl" : "ltr";
  return `<div dir="${dir}" style="font-family:Arial,sans-serif"><p>${t.hello}${name ? " " + escHtml(name) : ""}،</p><p>${t.body}</p><ul>${links.map((l) => `<li><a href="${escHtml(l.url)}">${escHtml(l.name)}</a> — ${exp} ${t.h} · ${max} ${t.n}</li>`).join("")}</ul></div>`;
}

export const digital = {
  id: "digital", providers: ["email"],
  routes(r, ctx) {
    const { db } = ctx, needVault = () => { if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم"); };
    const locOk = (l) => (/^r2:[A-Za-z0-9._\/-]{1,200}$/.test(l) && !!ctx.files) || (safeHttpsUrl(l) && l.length <= 1000);

    r.post("/v1/digital/assets", { scope: "digital:write", summary: "تسجيل ملف رقمي (sku يطابق معرّف المنتج في الحدث). الموقع: رابط https أو r2:المفتاح" }, async (req) => {
      needVault(); const b = req.json(), sku = String(b.sku ?? "").trim(); if (!/^[A-Za-z0-9._-]{1,64}$/.test(sku)) throw new HttpError(400, "validation_error", "sku غير صالح", { sku: "A-Z a-z 0-9 . _ -" });
      if (!locOk(String(b.location ?? ""))) throw new HttpError(400, "validation_error", "location: رابط https صالح أو r2:المفتاح (إن كان R2 مفعّلاً)", { location: "https://… | r2:key" });
      const name = String(b.name ?? sku).slice(0, 120);
      try { const x = await db.run("INSERT INTO dg_assets (tenant_id,sku,name,location_enc,file_name,content_type,active,created_at) VALUES (?,?,?,?,?,?,1,?)", req.tenant.id, sku, name, "pending", SAFE_NAME(b.file_name ?? name), String(b.content_type ?? "application/octet-stream").slice(0, 100), nowStr(ctx.clock()));
        await db.run("UPDATE dg_assets SET location_enc=? WHERE id=?", await ctx.vault.encrypt(String(b.location), `dg:${req.tenant.id}:${x.id}`), x.id); return ok({ id: x.id, sku }, 201); }
      catch (e) { if (/UNIQUE|constraint/i.test(String(e.message))) throw new HttpError(409, "sku_taken", "sku مسجَّل سابقاً"); throw e; }
    });
    r.get("/v1/digital/assets", { scope: "digital:read", summary: "الملفات الرقمية (بلا مواقعها)" }, async (req) => ok({ assets: (await db.all("SELECT id,sku,name,file_name,content_type,active,created_at FROM dg_assets WHERE tenant_id=? ORDER BY id DESC", req.tenant.id)).map((a) => ({ ...a, active: !!a.active })) }));
    r.delete("/v1/digital/assets/:id", { scope: "digital:write", summary: "تعطيل ملف (تتوقف كل روابطه)" }, async (req) => ok({ ok: true, removed: (await db.run("UPDATE dg_assets SET active=0 WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id)).changes }));

    r.post("/v1/digital/grants", { scope: "digital:write", idem: true, summary: "إصدار رابط تنزيل يدوي (يُرسل بالبريد إن طُلب وفُعِّل البريد)" }, async (req) => {
      const b = req.json(); const a = await db.one("SELECT * FROM dg_assets WHERE tenant_id=? AND active=1 AND (sku=? OR id=?)", req.tenant.id, String(b.sku ?? ""), +b.asset_id || 0); if (!a) throw new HttpError(404, "not_found", "الملف غير موجود");
      const out = await issue(ctx, req.tenant, a, { orderRef: b.order_ref ?? null, email: b.email, hours: b.expires_hours, max: b.max_downloads });
      let emailed = false; if (b.email) emailed = await sendEmail(ctx, req.tenant.id, { to: String(b.email), subject: (TXT[req.tenant.settings.lang] ?? TXT.ar).subject, html: emailHtml(req.tenant.settings.lang, b.name, [{ url: out.url, name: a.name }], out.expires_hours, out.max_downloads) });
      return ok({ ...out, emailed }, 201);
    });
    r.get("/v1/digital/grants", { scope: "digital:read", summary: "المنح حسب order_ref (بلا الروابط — تظهر مرة واحدة عند الإصدار)" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = [req.tenant.id]; let q = "SELECT g.id,a.sku,g.order_ref,g.expires_at,g.max_downloads,g.downloads,g.revoked_at,g.created_at FROM dg_grants g JOIN dg_assets a ON a.id=g.asset_id WHERE g.tenant_id=?";
      if (req.query.order_ref) { q += " AND g.order_ref=?"; a.push(String(req.query.order_ref)); } if (after) { q += " AND g.id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY g.id DESC LIMIT ?", ...a, lim + 1), lim); return ok({ grants: pg.items, next: pg.next });
    });
    r.delete("/v1/digital/grants/:id", { scope: "digital:write", summary: "إلغاء رابط" }, async (req) => ok({ ok: true, revoked: (await db.run("UPDATE dg_grants SET revoked_at=? WHERE id=? AND tenant_id=? AND revoked_at IS NULL", nowStr(ctx.clock()), +req.params.id, req.tenant.id)).changes }));

    /* التنزيل: عام، الرمز هو الصلاحية. العدّ ذرّي قبل البثّ ويُردّ عند فشل المصدر */
    r.get("/d/:token", { auth: "public", summary: "تنزيل بالرمز" }, async (req) => {
      const w = await ctx.window("dl:" + req.ip, 60, 60); if (w !== null) throw new HttpError(429, "rate_limited", "طلبات كثيرة", null, { "Retry-After": String(w) });
      if (!/^[0-9a-f]{64}$/.test(req.params.token)) throw new HttpError(404, "not_found", "الرابط غير صالح");
      const g = await db.one("SELECT * FROM dg_grants WHERE token_hash=?", await sha256Hex(req.params.token)); if (!g) throw new HttpError(404, "not_found", "الرابط غير صالح");
      const now = ctx.nowS(), a = await db.one("SELECT * FROM dg_assets WHERE id=?", g.asset_id), t = await db.one("SELECT status FROM pf_tenants WHERE id=?", g.tenant_id);
      if (g.revoked_at || !a || !a.active || !t || t.status !== "active") throw new HttpError(410, "revoked", "الرابط ملغى");
      if (g.expires_at <= now) throw new HttpError(410, "expired", "انتهت صلاحية الرابط");
      const got = await db.run("UPDATE dg_grants SET downloads=downloads+1, last_download_at=? WHERE id=? AND downloads<max_downloads AND revoked_at IS NULL AND expires_at>?", now, g.id, now);
      if (!got.changes) throw new HttpError(410, "limit_reached", "استُنفد عدد مرات التنزيل");
      const refund = () => db.run("UPDATE dg_grants SET downloads=MAX(0,downloads-1) WHERE id=?", g.id);
      let stream = null;
      try {
        const loc = await ctx.vault.decrypt(a.location_enc, `dg:${a.tenant_id}:${a.id}`);
        if (loc.startsWith("r2:")) { const o = ctx.files ? await ctx.files.get(loc.slice(3)) : null; stream = o ? o.body : null; }
        else if (safeHttpsUrl(loc)) { const res = await ctx.fetchFn(loc, { method: "GET", redirect: "manual" }); stream = res.status === 200 ? res.body : null; }
      } catch { stream = null; }
      if (!stream) { await refund(); throw new HttpError(502, "source_unavailable", "تعذّر جلب الملف، لم يُحتسب التنزيل"); }
      return { status: 200, stream, headers: { "Content-Type": a.content_type, "Content-Disposition": `attachment; filename="${SAFE_NAME(a.file_name)}"`, "X-Robots-Tag": "noindex", "Cache-Control": "private, no-store" }, body: "" };
    });
  },
  on: {
    /** الدفع المؤكَّد: لكل بند sku مسجَّل ← منحة + بريد. فشل البريد يلغي ما أُنشئ ويُعاد الحدث (فلا منحة بلا رابط واصل) */
    "payment.confirmed": async (e, ctx) => {
      const d = e.data, items = Array.isArray(d.items) ? d.items : [], email = d.customer?.email; if (!d.order_id || !items.length) return;
      const tenant = await ctx.db.one("SELECT * FROM pf_tenants WHERE id=?", e.tenantId); if (!tenant) return; tenant.settings = JSON.parse(tenant.settings || "{}");
      const links = [], created = [];
      try {
        for (const it of items) {
          const a = await ctx.db.one("SELECT * FROM dg_assets WHERE tenant_id=? AND sku=? AND active=1", e.tenantId, String(it.id)); if (!a) continue;
          if (await ctx.db.one("SELECT 1 FROM dg_grants WHERE tenant_id=? AND order_ref=? AND asset_id=?", e.tenantId, String(d.order_id), a.id)) continue;   // مُنحت سابقاً
          const g = await issue(ctx, tenant, a, { orderRef: String(d.order_id), email }); created.push(g.id); links.push({ url: g.url, name: a.name, h: g.expires_hours, n: g.max_downloads });
        }
        if (links.length && email) {
          const sent = await sendEmail(ctx, e.tenantId, { to: String(email), subject: (TXT[tenant.settings.lang] ?? TXT.ar).subject, html: emailHtml(tenant.settings.lang, d.customer?.name, links, links[0].h, links[0].n) });
          if (sent) await ctx.emit(e.tenantId, "digital.delivered", { order_id: d.order_id, count: links.length });
        }
      } catch (x) { for (const id of created) await ctx.db.run("DELETE FROM dg_grants WHERE id=?", id); throw x; }
    },
  },
};
async function issue(ctx, tenant, a, { orderRef, email, hours, max }) {
  const cfg = { ...DEF, ...(tenant.settings.digital ?? {}) }, h = Math.min(24 * 30, Math.max(1, Math.floor(+hours) || cfg.expires_hours)), n = Math.min(20, Math.max(1, Math.floor(+max) || cfg.max_downloads));
  const token = randHex(32); let id;
  try { id = (await ctx.db.run("INSERT INTO dg_grants (tenant_id,asset_id,token_hash,order_ref,email_h,expires_at,max_downloads,downloads,created_at) VALUES (?,?,?,?,?,?,?,0,?)", tenant.id, a.id, await sha256Hex(token), orderRef, email ? await hmacHex(ctx.secret, "em:" + String(email).toLowerCase().trim()) : null, ctx.nowS() + h * 3600, n, nowStr(ctx.clock()))).id; }
  catch (e) { if (/UNIQUE|constraint/i.test(String(e.message))) throw new HttpError(409, "already_granted", "منحة هذا الطلب لهذا الملف موجودة سابقاً"); throw e; }
  return { id, url: `${ctx.baseUrl}/d/${token}`, expires_hours: h, max_downloads: n, note: "الرابط يظهر مرة واحدة" };
}
