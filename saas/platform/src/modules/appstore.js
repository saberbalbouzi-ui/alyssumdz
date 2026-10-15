import { DB, HttpError, ok, paginate, clampLimit, moduleOff } from "../core.js";
import { hmacHex, maskName, nowStr, randHex, safeEq, safeHttpsUrl, sha256Hex } from "../util.js";

/** متجر التطبيقات (Marketplace) لمطوّرين خارجيين: OAuth 2.0 بنطاقات دقيقة، سوق ببطاقات التطبيقات، فوترة بتقاسم الإيراد عبر المحفظة، وwebhooks صادرة موقَّعة.
 *  مبادئ الأمان: (1) كتالوج نطاقات مغلق لا يشمل المحفظة ولا المفاتيح ولا التكاملات؛ (2) رموز معتمة تُخزَّن مجزَّأة فقط وتدور (refresh rotation + كشف إعادة الاستعمال)؛
 *  (3) بيانات الزبائن مخفية افتراضياً (read_customers نطاق حسّاس يوافق عليه التاجر صراحةً)؛ (4) حدّ معدّل لكل تثبيت؛ (5) زرّ إيقاف فوري (تعليق التطبيق/إلغاء التثبيت يُبطل الرموز لحظياً)؛
 *  (6) مراجعة يدوية من الإدارة قبل الظهور؛ (7) الأموال عبر خدمة ctx.wallet فقط. */
export const APP_SCOPES = {
  read_orders: { internal: ["orders:read"], label: "قراءة الطلبات والمنتجات المطلوبة (بلا أسماء الزبائن وهواتفهم)" },
  read_customers: { internal: [], label: "الاطلاع على أسماء الزبائن وأرقام هواتفهم في الطلبات والسلال", sensitive: true },
  read_products: { internal: ["catalog:read"], label: "قراءة المنتجات والأسعار والمخزون" },
  write_products: { internal: ["catalog:write"], label: "تعديل المنتجات وأكواد الخصم" },
  read_carts: { internal: ["carts:read"], label: "قراءة السلال المتروكة (الهواتف مخفية دون read_customers)" },
};
/** نطاق التطبيق اللازم لتلقّي حدث (غير المذكور لا يُرسل أبداً: المحفظة والاحتيال والإعلانات... مستبعدة) */
export const eventScope = (type) => (/^(order|payment)\.[a-z_]+$/.test(type) ? "read_orders" : null);
export const LIFECYCLE = ["appstore.installed", "appstore.uninstalled", "appstore.suspended"];
const PII_KEYS = new Set(["name", "phone", "email", "customer", "address", "commune", "ip", "ua", "client", "buyer", "whatsapp"]);
/** نسخة من بيانات الحدث بلا حقول الزبون إن لم يملك التطبيق read_customers (عمق محدود) */
export function redact(data, appScopes, depth = 0) {
  if (appScopes.includes("read_customers") || depth > 6) return data;
  if (Array.isArray(data)) return data.map((x) => redact(x, appScopes, depth + 1));
  if (data && typeof data === "object") { const o = {}; for (const [k, v] of Object.entries(data)) if (!PII_KEYS.has(k.toLowerCase())) o[k] = redact(v, appScopes, depth + 1); return o; }
  return data;
}
const BACKOFF = [60, 300, 1800, 7200, 43200];
const TTL = { code: 600, access: 3600, refresh: 30 * 86400, grace: 3 * 86400, month: 30 * 86400 };
const EVENT_RE = /^(order|payment)\.[a-z_]+$/;
const STATUSES = ["draft", "pending", "approved", "rejected", "suspended"];

/** تحقق نقي من تعريف التطبيق. partial=true للتعديل (الحقول الغائبة تُهمل). */
export function validateApp(b, cur = null) {
  const errors = {}, out = {}, has = (k) => b[k] !== undefined;
  if (!cur) { const slug = String(b.slug ?? "").trim().toLowerCase(); if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) errors.slug = "3–40 حرفاً لاتينياً/أرقاماً/-"; out.slug = slug; }
  if (!cur || has("name")) { const n = String(b.name ?? "").trim(); if (n.length < 2 || n.length > 80) errors.name = "الاسم 2–80 حرفاً"; out.name = n; }
  if (!cur || has("description")) out.description = String(b.description ?? "").slice(0, 600);
  if (has("icon_url")) { const u = String(b.icon_url ?? "").trim(); if (u && (!safeHttpsUrl(u) || u.length > 300)) errors.icon_url = "رابط https"; out.icon_url = u || null; }
  if (!cur || has("price")) { const p = Math.round(+(b.price ?? 0)); if (!Number.isSafeInteger(p) || p < 0 || p > 10_000_000) errors.price = "السعر بالدينار (0 = مجاني)"; out.price = p; }
  if (!cur || has("billing")) { const bl = String(b.billing ?? "once"); if (!["once", "monthly"].includes(bl)) errors.billing = "once|monthly"; out.billing = bl; }
  if (!cur || has("scopes")) { const sc = Array.isArray(b.scopes) ? [...new Set(b.scopes.map(String))] : []; if (!sc.length || sc.length > 8 || !sc.every((s) => s in APP_SCOPES)) errors.scopes = "اختر من: " + Object.keys(APP_SCOPES).join(", "); out.scopes = sc; }
  if (!cur || has("redirect_uris")) { const r = Array.isArray(b.redirect_uris) ? [...new Set(b.redirect_uris.map(String))] : []; if (!r.length || r.length > 3 || !r.every((u) => safeHttpsUrl(u) && u.length <= 300 && !u.includes("#"))) errors.redirect_uris = "من 1 إلى 3 روابط https بلا #"; out.redirect_uris = r; }
  if (!cur || has("webhook_url")) { const u = String(b.webhook_url ?? "").trim(); if (u && (!safeHttpsUrl(u) || u.length > 300)) errors.webhook_url = "رابط https"; out.webhook_url = u || null; }
  if (!cur || has("events")) { const ev = Array.isArray(b.events) ? [...new Set(b.events.map(String))] : []; if (ev.length > 20 || !ev.every((e) => EVENT_RE.test(e))) errors.events = "أحداث order.* أو payment.* فقط"; out.events = ev; }
  const scopes = out.scopes ?? JSON.parse(cur?.scopes ?? "[]"), events = out.events ?? JSON.parse(cur?.events ?? "[]"), hook = out.webhook_url !== undefined ? out.webhook_url : cur?.webhook_url;
  if (events.length && !scopes.includes("read_orders") && !errors.scopes) errors.events = "أحداث الطلبات والدفع تتطلب النطاق read_orders";
  if (events.length && !hook && !errors.webhook_url) errors.webhook_url = "مطلوب لاستقبال الأحداث";
  return { errors, value: out };
}
const SENSITIVE = ["price", "billing", "scopes", "redirect_uris", "webhook_url", "events"];
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };
const REFUND_DAYS = 7;
const pubApp = (a, dev, m = {}) => ({ rating: m.rating ?? null, rating_count: m.rating_count ?? 0, featured: !!m.featured, domain_verified: !!(m.domain_host && m.domain_host === hostOf(a.webhook_url)), id: a.id, slug: a.slug, name: a.name, description: a.description, icon_url: a.icon_url, price: a.price, billing: a.billing, currency: "DZD", developer: dev ?? null,
  scopes: JSON.parse(a.scopes).map((s) => ({ id: s, label: APP_SCOPES[s]?.label ?? s, sensitive: !!APP_SCOPES[s]?.sensitive })), events: JSON.parse(a.events) });
const oerr = (status, error, desc) => ({ status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" }, body: JSON.stringify({ error, error_description: desc }) });
const period = (ms) => new Date(ms).toISOString().slice(0, 7);

export const appstore = {
  id: "appstore",
  routes(r, ctx) {
    const { db } = ctx;
    const needWallet = () => { if (!ctx.wallet) throw new HttpError(503, "wallet_unavailable", "المحفظة غير مفعّلة على الخادم"); return ctx.wallet; };
    const needVault = () => { if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم"); return ctx.vault; };
    const commission = async () => { const v = await db.val("SELECT commission_pct FROM app_settings WHERE id=1"); return v == null ? 20 : v; };
    const whAad = (id) => `app:${id}:wh`;

    /* ───────── مزوّد مصادقة رموز OAuth للنواة ───────── */
    ctx.authProviders.push({
      prefix: "at_",
      async resolve(tok) {
        const now = ctx.nowS(), row = await db.one(`SELECT t.id tid, t.scopes tscopes, t.expires_at, t.revoked_at, i.id iid, i.tenant_id, i.status ist, i.scopes iscopes, a.id app_id, a.slug, a.status ast, a.approved_once
          FROM oauth_access_tokens t JOIN app_installations i ON i.id=t.installation_id JOIN apps a ON a.id=i.app_id WHERE t.token_hash=?`, await sha256Hex(tok));
        if (!row || row.revoked_at || row.expires_at <= now || !["active", "past_due"].includes(row.ist) || !(row.ast === "approved" || (row.ast === "pending" && row.approved_once))) return null;
        const t = await db.one("SELECT * FROM pf_tenants WHERE id=?", row.tenant_id); if (!t || t.status !== "active") return null;
        const tenant = { ...t, settings: JSON.parse(t.settings || "{}") }; if (moduleOff(tenant.settings, "appstore")) return null;
        const inst = new Set(JSON.parse(row.iscopes)), app = JSON.parse(row.tscopes).filter((s) => inst.has(s) && s in APP_SCOPES);      // تقليص أذونات التثبيت يسري فوراً على الرموز القائمة
        await db.run("UPDATE oauth_access_tokens SET last_used_at=? WHERE id=?", now, row.tid);
        return { tenant, scopes: [...new Set(app.flatMap((s) => APP_SCOPES[s].internal)), "appstore:self"], app: { id: row.app_id, slug: row.slug, installation_id: row.iid, scopes: app } };
      },
    });

    /* ───────── إصدار الرموز ───────── */
    async function issueTokens(inst, clientId, family = randHex(12)) {
      const now = ctx.nowS(), at = "at_" + randHex(24), rt = "rt_" + randHex(24);
      await db.run("INSERT INTO oauth_access_tokens (installation_id,client_id,token_hash,refresh_hash,family,scopes,expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        inst.id, clientId, await sha256Hex(at), await sha256Hex(rt), family, inst.scopes, now + TTL.access, now + TTL.refresh, now);
      return { family, body: { access_token: at, token_type: "Bearer", expires_in: TTL.access, refresh_token: rt, scope: JSON.parse(inst.scopes).join(" ") } };
    }
    const revokeInstallation = (iid) => db.run("UPDATE oauth_access_tokens SET revoked_at=? WHERE installation_id=? AND revoked_at IS NULL", ctx.nowS(), iid);
    const revokeFamily = (fam) => db.run("UPDATE oauth_access_tokens SET revoked_at=? WHERE family=? AND revoked_at IS NULL", ctx.nowS(), fam);

    /** رمز تفويض أحادي الاستعمال + رابط إعادة توجيه موقَّع (shop/code/installation/timestamp + توقيع بسرّ الـwebhook) */
    async function authorizeUrl(app, inst, tenant, clientId) {
      const code = "ac_" + randHex(16), redirect = JSON.parse(app.redirect_uris)[0];
      await db.run("INSERT INTO oauth_codes (code_hash,installation_id,client_id,redirect_uri,expires_at) VALUES (?,?,?,?,?)", await sha256Hex(code), inst.id, clientId, redirect, ctx.nowS() + TTL.code);
      const q = { code, installation: String(inst.id), shop: tenant.site_ref || "t" + tenant.id, timestamp: String(ctx.nowS()) };
      if (ctx.vault && app.webhook_secret_enc) { const secret = await ctx.vault.decrypt(app.webhook_secret_enc, whAad(app.id)); q.signature = await hmacHex(secret, Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join("&")); }
      return redirect + (redirect.includes("?") ? "&" : "?") + new URLSearchParams(q).toString();
    }
    const clientOf = (appId) => db.one("SELECT client_id FROM oauth_clients WHERE app_id=? AND revoked_at IS NULL ORDER BY id DESC", appId);

    /* ───────── الفوترة وتقاسم الإيراد ───────── */
    async function settle(rev) {
      const claim = await db.run("UPDATE platform_revenues SET state='settling' WHERE id=? AND state='pending'", rev.id); if (!claim.changes) return false;
      try {
        const w = needWallet();
        if (rev.net > 0) await w.payout(rev.developer_id, { ref: `app:dev:${rev.ref}`, amount: rev.net, memo: `حصة المطوّر ${rev.period}` });
        if (rev.fee > 0) await w.fee(rev.tenant_id, { ref: `app:fee:${rev.ref}`, amount: rev.fee, memo: `عمولة المنصة ${rev.period}` });
        await db.run("UPDATE platform_revenues SET state='settled', settled_at=? WHERE id=?", ctx.nowS(), rev.id); return true;
      } catch (e) { await db.run("UPDATE platform_revenues SET state='pending' WHERE id=? AND state='settling'", rev.id); throw e; }
    }
    /** يخصم ثمن التطبيق من متاح التاجر ويسجّل الإيراد ثم يقسّمه (80% للمطوّر/20% للمنصة افتراضياً). ref فريد لكل (تثبيت، فترة) فلا يُخصم مرتين. */
    async function bill(app, inst, per) {
      const price = inst.price, w = needWallet(), pct = await commission(), fee = Math.floor(price * pct / 100), ref = `${inst.id}:${per}`;
      const p = await w.charge(inst.tenant_id, { ref: `app:buy:${ref}`, amount: price, memo: `${app.name} (${per === "once" ? "شراء" : per})` });
      if (!p.duplicate) {
        try { await db.run("INSERT INTO platform_revenues (installation_id,app_id,developer_id,tenant_id,period,gross,fee,net,ref,state,created_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',?)", inst.id, app.id, app.developer_id, inst.tenant_id, per, price, fee, price - fee, ref, ctx.nowS()); }
        catch (e) { if (!DB.isUnique(e)) throw e; }
      }
      const rev = await db.one("SELECT * FROM platform_revenues WHERE ref=?", ref); if (rev) { try { await settle(rev); } catch { /* يُعاد في cron */ } }
    }

    /* ───────── OAuth 2.0 (نقاط عامة) ───────── */
    const bodyOf = (req) => { const raw = req.raw || ""; if (/json/i.test(String(req.headers["content-type"] ?? "")) || raw.trim().startsWith("{")) { try { return JSON.parse(raw) || {}; } catch { return {}; } } const o = {}; for (const [k, v] of new URLSearchParams(raw)) o[k] = v; return o; };
    async function authClient(req, b) {
      let id = b.client_id, secret = b.client_secret; const ba = /^basic (.+)$/i.exec(String(req.headers.authorization ?? ""));
      if (ba) { try { const d = atob(ba[1]), i = d.indexOf(":"); id = decodeURIComponent(d.slice(0, i)); secret = decodeURIComponent(d.slice(i + 1)); } catch { return null; } }
      if (!id || !secret || String(id).length > 64 || String(secret).length > 128) return null;
      const c = await db.one("SELECT c.*, a.status ast, a.id app_id FROM oauth_clients c JOIN apps a ON a.id=c.app_id WHERE c.client_id=? AND c.revoked_at IS NULL", String(id));
      if (!c || !safeEq(c.secret_hash, await sha256Hex(String(secret)))) return null; return c;
    }
    r.post("/oauth/token", { auth: "public", summary: "تبادل OAuth 2.0: grant_type=authorization_code|refresh_token مع client_id/client_secret (Basic أو جسم)" }, async (req) => {
      const w = await ctx.window("oat:" + req.ip, 90, 60); if (w !== null) return { ...oerr(429, "temporarily_unavailable", "طلبات كثيرة"), headers: { "Retry-After": String(w), "Cache-Control": "no-store" } };
      const b = bodyOf(req), c = await authClient(req, b);
      if (!c) { await ctx.window("oatf:" + req.ip, 25, 600); return { ...oerr(401, "invalid_client", "بيانات العميل غير صحيحة"), headers: { "WWW-Authenticate": 'Basic realm="oauth"', "Cache-Control": "no-store" } }; }
      if (c.ast !== "approved" && !(c.ast === "pending")) return oerr(400, "unauthorized_client", "التطبيق غير معتمد");
      if (b.grant_type === "authorization_code") {
        const h = await sha256Hex(String(b.code ?? "")), row = await db.one("SELECT * FROM oauth_codes WHERE code_hash=?", h);
        if (!row || row.client_id !== c.client_id) return oerr(400, "invalid_grant", "رمز التفويض غير صالح");
        const claim = await db.run("UPDATE oauth_codes SET used=1 WHERE code_hash=? AND used=0 AND expires_at>?", h, ctx.nowS());
        if (!claim.changes) { if (row.used && row.family) await revokeFamily(row.family); return oerr(400, "invalid_grant", "رمز التفويض مستعمل أو منتهٍ"); }      // إعادة استعمال الرمز ⇒ إبطال ما صدر منه
        if (String(b.redirect_uri ?? "") !== row.redirect_uri) return oerr(400, "invalid_grant", "redirect_uri لا يطابق");
        const inst = await db.one("SELECT * FROM app_installations WHERE id=?", row.installation_id); if (!inst || !["active", "past_due"].includes(inst.status)) return oerr(400, "invalid_grant", "التثبيت غير نشط");
        const t = await issueTokens(inst, c.client_id); await db.run("UPDATE oauth_codes SET family=? WHERE code_hash=?", t.family, h); return { status: 200, headers: { "Cache-Control": "no-store", Pragma: "no-cache" }, body: JSON.stringify(t.body) };
      }
      if (b.grant_type === "refresh_token") {
        const h = await sha256Hex(String(b.refresh_token ?? "")), row = await db.one("SELECT * FROM oauth_access_tokens WHERE refresh_hash=?", h);
        if (!row || row.client_id !== c.client_id) return oerr(400, "invalid_grant", "رمز التجديد غير صالح");
        const claim = await db.run("UPDATE oauth_access_tokens SET refresh_used=1, revoked_at=COALESCE(revoked_at,?) WHERE id=? AND refresh_used=0 AND revoked_at IS NULL AND refresh_expires_at>?", ctx.nowS(), row.id, ctx.nowS());
        if (!claim.changes) { if (row.refresh_used) await revokeFamily(row.family); return oerr(400, "invalid_grant", "رمز التجديد مستعمل أو ملغى أو منتهٍ"); }      // إعادة استعمال رمز تجديد دوّار ⇒ تسريب محتمل ⇒ تُبطَل السلسلة كلها
        const inst = await db.one("SELECT * FROM app_installations WHERE id=?", row.installation_id); if (!inst || !["active", "past_due"].includes(inst.status)) return oerr(400, "invalid_grant", "التثبيت غير نشط");
        const t = await issueTokens(inst, c.client_id, row.family); return { status: 200, headers: { "Cache-Control": "no-store", Pragma: "no-cache" }, body: JSON.stringify(t.body) };
      }
      return oerr(400, "unsupported_grant_type", "authorization_code أو refresh_token فقط");
    });
    r.post("/oauth/revoke", { auth: "public", summary: "إبطال رمز وصول أو تجديد (وسلسلته كاملة) بمصادقة العميل — يرد 200 دائماً" }, async (req) => {
      const w = await ctx.window("oar:" + req.ip, 60, 60); if (w !== null) return oerr(429, "temporarily_unavailable", "طلبات كثيرة");
      const b = bodyOf(req), c = await authClient(req, b); if (!c) return oerr(401, "invalid_client", "بيانات العميل غير صحيحة");
      const h = await sha256Hex(String(b.token ?? "")), row = await db.one("SELECT family, client_id FROM oauth_access_tokens WHERE token_hash=? OR refresh_hash=?", h, h);
      if (row && row.client_id === c.client_id) await revokeFamily(row.family); return { status: 200, headers: { "Cache-Control": "no-store" }, body: "{}" };
    });
    r.get("/v1/appstore/me", { scope: "appstore:self", summary: "للتطبيق (برمز OAuth): هوية المتجر والتثبيت والنطاقات الممنوحة" }, async (req) => {
      if (!req.app) throw new HttpError(404, "not_found", "هذا المسار لرموز التطبيقات");
      return ok({ shop: { id: req.tenant.id, domain: req.tenant.site_ref ?? null, name: req.tenant.name }, app: { id: req.app.id, slug: req.app.slug }, installation: { id: req.app.installation_id, scopes: req.app.scopes } });
    });

    /* ───────── واجهة التاجر: التصفح والتثبيت ───────── */
    const devName = async (id) => (await db.val("SELECT name FROM pf_tenants WHERE id=?", id)) ?? null;
    /** تقييم ووسم «مميّز» وتوثيق النطاق لكل تطبيق (جداول app_reviews/app_flags) */
    const metaOf = async (id) => { const rt = await db.one("SELECT AVG(stars) avg, COUNT(*) n FROM app_reviews WHERE app_id=?", id), fl = await db.one("SELECT featured, domain_host FROM app_flags WHERE app_id=?", id);
      return { rating: rt && rt.n ? Math.round(rt.avg * 10) / 10 : null, rating_count: rt ? rt.n : 0, featured: !!(fl && fl.featured), domain_host: fl ? fl.domain_host : null }; };
    r.get("/v1/appstore/apps", { scope: "appstore:read", summary: "التطبيقات المعتمدة في المتجر (المميّزة أولاً)" }, async () => {
      const rows = await db.all("SELECT * FROM apps WHERE status='approved' ORDER BY id DESC LIMIT 100"), out = []; for (const a of rows) out.push(pubApp(a, await devName(a.developer_id), await metaOf(a.id)));
      out.sort((x, y) => (y.featured - x.featured) || ((y.rating ?? 0) - (x.rating ?? 0))); return ok({ apps: out, commission_pct: await commission(), refund_days: REFUND_DAYS });
    });
    r.get("/v1/appstore/apps/:id", { scope: "appstore:read", summary: "تفاصيل تطبيق معتمد" }, async (req) => {
      const a = await db.one("SELECT * FROM apps WHERE id=? AND status='approved'", +req.params.id); if (!a) throw new HttpError(404, "not_found", "التطبيق غير موجود"); return ok({ app: pubApp(a, await devName(a.developer_id), await metaOf(a.id)) });
    });
    r.get("/v1/appstore/apps/:id/reviews", { scope: "appstore:read", summary: "آخر تقييمات تطبيق (اسم المتجر مقنَّع)" }, async (req) => {
      if (!(await db.one("SELECT id FROM apps WHERE id=? AND status='approved'", +req.params.id))) throw new HttpError(404, "not_found", "التطبيق غير موجود");
      const rows = await db.all("SELECT v.stars, v.comment, v.created_at, t.name FROM app_reviews v LEFT JOIN pf_tenants t ON t.id=v.tenant_id WHERE v.app_id=? ORDER BY v.id DESC LIMIT 20", +req.params.id);
      return ok({ reviews: rows.map((x) => ({ stars: x.stars, comment: x.comment, shop: maskName(x.name), at: x.created_at })) });
    });
    r.post("/v1/appstore/apps/:id/review", { scope: "appstore:write", limit: { key: "apprev", max: 20, win: 3600 }, summary: "تقييم تطبيق ثبّتَّه: { stars: 1..5, comment? } (تقييم واحد لكل متجر يُحدَّث)" }, async (req) => {
      if (req.app) throw new HttpError(403, "forbidden", "غير متاح لرموز التطبيقات");
      const b = req.json(), stars = Math.round(+b.stars); if (!(stars >= 1 && stars <= 5)) throw new HttpError(400, "validation_error", "النجوم من 1 إلى 5", { stars: "1..5" });
      const inst = await db.one("SELECT id FROM app_installations WHERE tenant_id=? AND app_id=? AND installed_at IS NOT NULL", req.tenant.id, +req.params.id); if (!inst) throw new HttpError(403, "not_installed", "قيّم تطبيقاً ثبّتَّه فقط");
      if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      const comment = String(b.comment ?? "").replace(/[<>]/g, "").trim().slice(0, 400) || null;
      await db.run("INSERT INTO app_reviews (app_id,tenant_id,stars,comment,created_at) VALUES (?,?,?,?,?) ON CONFLICT(app_id,tenant_id) DO UPDATE SET stars=excluded.stars, comment=excluded.comment, created_at=excluded.created_at", +req.params.id, req.tenant.id, stars, comment, ctx.nowS());
      return ok({ ok: true, ...(await metaOf(+req.params.id)) });
    });
    r.post("/v1/appstore/apps/:id/install", { scope: "appstore:write", idem: true, limit: { key: "appinst", max: 20, win: 3600 }, summary: "تثبيت تطبيق: { scopes: [...] } يجب أن تطابق النطاقات المطلوبة تماماً (موافقة التاجر). المدفوع يُخصم من المتاح." }, async (req) => {
      if (req.app) throw new HttpError(403, "forbidden", "لا تُثبَّت التطبيقات برمز تطبيق");
      const app = await db.one("SELECT * FROM apps WHERE id=? AND status='approved'", +req.params.id); if (!app) throw new HttpError(404, "not_found", "التطبيق غير متاح");
      const want = JSON.parse(app.scopes), got = Array.isArray(req.json().scopes) ? [...new Set(req.json().scopes.map(String))] : [];
      if (got.length !== want.length || !want.every((s) => got.includes(s))) throw new HttpError(409, "consent_mismatch", "يجب الموافقة على النطاقات المطلوبة كما هي", { scopes: want.join(",") });
      if (req.mode !== "live") return ok({ ok: true, sandbox: true, app: pubApp(app) }, 201);
      const tid = req.tenant.id, now = ctx.nowS(); let inst = await db.one("SELECT * FROM app_installations WHERE tenant_id=? AND app_id=?", tid, app.id), fresh = false;
      if (inst && ["active", "past_due"].includes(inst.status)) throw new HttpError(409, "already_installed", "التطبيق مثبّت");
      if (!inst) { const x = await db.run("INSERT INTO app_installations (tenant_id,app_id,status,scopes,price,billing,paid_once) VALUES (?,?,'pending',?,?,?,0)", tid, app.id, app.scopes, app.price, app.billing); inst = await db.one("SELECT * FROM app_installations WHERE id=?", x.id); fresh = true; }
      else { await db.run("UPDATE app_installations SET status='pending', scopes=?, price=?, billing=? WHERE id=?", app.scopes, app.price, app.billing, inst.id); inst = await db.one("SELECT * FROM app_installations WHERE id=?", inst.id); }
      const monthly = inst.billing === "monthly", needPay = inst.price > 0 && (monthly || !inst.paid_once);
      if (needPay) {
        try { const nrf = await db.val("SELECT COUNT(*) FROM app_refunds WHERE installation_id=?", inst.id); await bill(app, inst, (monthly ? period(ctx.clock()) : "once") + (nrf ? `-r${nrf}` : "")); }       // بعد استرداد يلزم مرجع جديد وإلا عُدّ الدفع مكرراً فلا يُخصم
        catch (e) { if (fresh) await db.run("DELETE FROM app_installations WHERE id=?", inst.id); else await db.run("UPDATE app_installations SET status='uninstalled' WHERE id=?", inst.id); throw e; }      // الرصيد غير كافٍ ⇒ لا أثر
      }
      await db.run("UPDATE app_installations SET status='active', installed_at=?, uninstalled_at=NULL, paid_once=?, next_charge_at=? WHERE id=?", now, inst.price > 0 && !monthly ? 1 : inst.paid_once, monthly && inst.price > 0 ? now + TTL.month : null, inst.id);
      inst = await db.one("SELECT * FROM app_installations WHERE id=?", inst.id);
      await ctx.emit(tid, "appstore.installed", { app_id: app.id, installation_id: inst.id, scopes: JSON.parse(inst.scopes) }, `app:inst:${inst.id}:${now}`);
      const cl = await clientOf(app.id), redirect_to = cl ? await authorizeUrl(app, inst, req.tenant, cl.client_id) : null;
      return ok({ installation: { id: inst.id, status: inst.status, scopes: JSON.parse(inst.scopes), price: inst.price, billing: inst.billing }, redirect_to }, 201);
    });
    /** قابل للاسترداد: آخر دفعة مسوّاة وعمرها أقل من 7 أيام ولم تُسترد */
    const refundInfo = async (inst) => { if (!["active", "past_due"].includes(inst.status)) return null;
      const rev = await db.one("SELECT * FROM platform_revenues WHERE installation_id=? ORDER BY id DESC LIMIT 1", inst.id); if (!rev || rev.state !== "settled") return null;
      if (ctx.nowS() - rev.created_at > REFUND_DAYS * 86400 || (await db.one("SELECT id FROM app_refunds WHERE revenue_id=?", rev.id))) return null; return rev; };
    r.get("/v1/appstore/installations", { scope: "appstore:read", summary: "تطبيقاتي المثبّتة" }, async (req) => {
      const rows = await db.all("SELECT i.*, a.name, a.slug, a.icon_url FROM app_installations i JOIN apps a ON a.id=i.app_id WHERE i.tenant_id=? AND i.status<>'pending' ORDER BY i.id DESC", req.tenant.id), my = new Set((await db.all("SELECT app_id FROM app_reviews WHERE tenant_id=?", req.tenant.id)).map((x) => x.app_id)), ref = {};
      for (const i of rows) ref[i.id] = !!(await refundInfo(i));
      return ok({ installations: rows.map((i) => ({ refundable: ref[i.id], reviewed: my.has(i.app_id), id: i.id, app_id: i.app_id, name: i.name, slug: i.slug, icon_url: i.icon_url, status: i.status, scopes: JSON.parse(i.scopes), price: i.price, billing: i.billing, next_charge_at: i.next_charge_at, installed_at: i.installed_at, uninstalled_at: i.uninstalled_at })) });
    });
    r.post("/v1/appstore/installations/:id/authorize", { scope: "appstore:write", limit: { key: "appauth", max: 30, win: 3600 }, summary: "رمز تفويض جديد لتثبيت قائم (إعادة ربط التطبيق)" }, async (req) => {
      if (req.app) throw new HttpError(403, "forbidden", "غير متاح لرموز التطبيقات");
      const inst = await db.one("SELECT * FROM app_installations WHERE id=? AND tenant_id=? AND status IN ('active','past_due')", +req.params.id, req.tenant.id); if (!inst) throw new HttpError(404, "not_found", "التثبيت غير موجود");
      const app = await db.one("SELECT * FROM apps WHERE id=?", inst.app_id), cl = await clientOf(app.id); if (!cl) throw new HttpError(409, "no_client", "التطبيق بلا عميل OAuth");
      return ok({ redirect_to: await authorizeUrl(app, inst, req.tenant, cl.client_id) });
    });
    r.delete("/v1/appstore/installations/:id", { scope: "appstore:write", summary: "إلغاء تثبيت تطبيق: يُبطل كل رموزه فوراً ويُبلَّغ بـappstore.uninstalled" }, async (req) => {
      if (req.app) throw new HttpError(403, "forbidden", "غير متاح لرموز التطبيقات");
      const inst = await db.one("SELECT * FROM app_installations WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!inst) throw new HttpError(404, "not_found", "التثبيت غير موجود");
      if (inst.status === "uninstalled") return ok({ ok: true, unchanged: true });
      await db.run("UPDATE app_installations SET status='uninstalled', uninstalled_at=?, next_charge_at=NULL WHERE id=?", ctx.nowS(), inst.id); await revokeInstallation(inst.id);
      await ctx.emit(req.tenant.id, "appstore.uninstalled", { app_id: inst.app_id, installation_id: inst.id }, `app:unin:${inst.id}:${ctx.nowS()}`); return ok({ ok: true });
    });

    r.post("/v1/appstore/installations/:id/refund", { scope: "appstore:write", idem: true, limit: { key: "apprefund", max: 10, win: 3600 }, summary: "استرداد ثمن التطبيق خلال 7 أيام من الدفع: يُسحب نصيب المطوّر وتُعاد العمولة ويُردّ المبلغ كاملاً لمتاحك ويُلغى التثبيت" }, async (req) => {
      if (req.app) throw new HttpError(403, "forbidden", "غير متاح لرموز التطبيقات");
      const inst = await db.one("SELECT * FROM app_installations WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!inst) throw new HttpError(404, "not_found", "التثبيت غير موجود");
      if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      const rev = await refundInfo(inst); if (!rev) throw new HttpError(409, "not_refundable", `الاسترداد متاح خلال ${REFUND_DAYS} أيام من آخر دفعة فقط، ولمرة واحدة`);
      const w = needWallet(), memo = `استرداد ${rev.period}`;
      try { if (rev.net > 0) await w.clawback(rev.developer_id, { ref: `app:cb:${rev.ref}`, amount: rev.net, memo }); }
      catch (e) { if (e?.code === "insufficient_funds") throw new HttpError(409, "refund_unavailable", "تعذّر الاسترداد الآلي لأن المطوّر سحب حصته — تواصل مع الدعم"); throw e; }
      if (rev.fee > 0) await w.feeback(rev.tenant_id, { ref: `app:fb:${rev.ref}`, amount: rev.fee, memo });
      await w.unwind(rev.tenant_id, { ref: `app:rf:${rev.ref}`, amount: rev.gross, memo });
      await db.run("INSERT OR IGNORE INTO app_refunds (revenue_id,installation_id,tenant_id,amount,created_at) VALUES (?,?,?,?,?)", rev.id, inst.id, inst.tenant_id, rev.gross, ctx.nowS());
      await db.run("UPDATE platform_revenues SET state='refunded' WHERE id=?", rev.id);
      await db.run("UPDATE app_installations SET status='uninstalled', uninstalled_at=?, next_charge_at=NULL, paid_once=0 WHERE id=?", ctx.nowS(), inst.id); await revokeInstallation(inst.id);
      await ctx.emit(req.tenant.id, "appstore.uninstalled", { app_id: inst.app_id, installation_id: inst.id, refunded: true }, `app:unin:${inst.id}:${ctx.nowS()}`);
      return ok({ ok: true, refunded: rev.gross });
    });

    /* ───────── واجهة المطوّر (مفتاح مستأجر المطوّر + نطاق appstore:dev) ───────── */
    const needDev = async (req) => { if (req.app) throw new HttpError(403, "forbidden", "غير متاح لرموز التطبيقات"); const d = await db.one("SELECT status FROM app_developers WHERE tenant_id=?", req.tenant.id); if (!d || d.status !== "active") throw new HttpError(403, "not_a_developer", "حسابك غير مفعّل كمطوّر — تواصل مع الإدارة"); };
    const myApp = async (req) => { const a = await db.one("SELECT * FROM apps WHERE id=? AND developer_id=?", +req.params.id, req.tenant.id); if (!a) throw new HttpError(404, "not_found", "التطبيق غير موجود"); return a; };
    const secrets = async (appId) => { const client_secret = "cs_" + randHex(24), webhook_secret = "whsec_app_" + randHex(16); return { client_secret, webhook_secret, hash: await sha256Hex(client_secret), enc: await needVault().encrypt(webhook_secret, whAad(appId)) }; };
    r.post("/v1/appstore/dev/apps", { scope: "appstore:dev", limit: { key: "appnew", max: 20, win: 3600 }, summary: "إنشاء تطبيق (مسودة) ← { client_id, client_secret, webhook_secret } تظهر مرة واحدة" }, async (req) => {
      await needDev(req); needVault(); const { errors, value: v } = validateApp(req.json()); if (Object.keys(errors).length) throw new HttpError(400, "validation_error", "تحقق من الحقول", errors);
      if ((await db.val("SELECT COUNT(*) FROM apps WHERE developer_id=?", req.tenant.id)) >= 20) throw new HttpError(402, "plan_limit", "حدّ 20 تطبيقاً");
      let id; try { id = (await db.run("INSERT INTO apps (developer_id,slug,name,description,icon_url,price,billing,webhook_url,events,scopes,redirect_uris,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)",
        req.tenant.id, v.slug, v.name, v.description, v.icon_url ?? null, v.price, v.billing, v.webhook_url, JSON.stringify(v.events), JSON.stringify(v.scopes), JSON.stringify(v.redirect_uris), nowStr(ctx.clock()), ctx.nowS())).id; }
      catch (e) { if (DB.isUnique(e)) throw new HttpError(409, "slug_taken", "المعرّف مستعمل"); throw e; }
      const s = await secrets(id), client_id = "ci_" + randHex(12);
      await db.run("UPDATE apps SET webhook_secret_enc=? WHERE id=?", s.enc, id); await db.run("INSERT INTO oauth_clients (app_id,client_id,secret_hash,created_at) VALUES (?,?,?,?)", id, client_id, s.hash, nowStr(ctx.clock()));
      return ok({ id, status: "draft", client_id, client_secret: s.client_secret, webhook_secret: s.webhook_secret, note: "الأسرار تظهر مرة واحدة فقط" }, 201);
    });
    r.get("/v1/appstore/dev/apps", { scope: "appstore:dev", summary: "تطبيقاتي" }, async (req) => { await needDev(req); const rows = await db.all("SELECT * FROM apps WHERE developer_id=? ORDER BY id DESC", req.tenant.id); const apps = []; for (const a of rows) apps.push({ ...pubApp(a, null, await metaOf(a.id)), status: a.status, review_note: a.review_note, webhook_url: a.webhook_url, redirect_uris: JSON.parse(a.redirect_uris) }); return ok({ apps }); });
    r.put("/v1/appstore/dev/apps/:id", { scope: "appstore:dev", summary: "تعديل تطبيق. الحقول الحسّاسة (السعر/النطاقات/الروابط/الأحداث) على تطبيق معتمد تعيده للمراجعة ويتوقف إرسال webhooks حتى الاعتماد" }, async (req) => {
      await needDev(req); const a = await myApp(req), b = req.json(); delete b.slug;
      const { errors, value: v } = validateApp(b, a); if (Object.keys(errors).length) throw new HttpError(400, "validation_error", "تحقق من الحقول", errors);
      const sens = SENSITIVE.some((k) => v[k] !== undefined && JSON.stringify(v[k]) !== JSON.stringify(["scopes", "redirect_uris", "events"].includes(k) ? JSON.parse(a[k]) : a[k])), status = a.status === "approved" && sens ? "pending" : a.status;
      const j = (k) => (v[k] !== undefined ? JSON.stringify(v[k]) : a[k]);
      await db.run("UPDATE apps SET name=?,description=?,icon_url=?,price=?,billing=?,webhook_url=?,events=?,scopes=?,redirect_uris=?,status=?,updated_at=? WHERE id=?", v.name ?? a.name, v.description ?? a.description, v.icon_url !== undefined ? v.icon_url : a.icon_url, v.price ?? a.price, v.billing ?? a.billing,
        v.webhook_url !== undefined ? v.webhook_url : a.webhook_url, j("events"), j("scopes"), j("redirect_uris"), status, ctx.nowS(), a.id);
      return ok({ ok: true, status, resubmitted: status !== a.status });
    });
    r.post("/v1/appstore/dev/apps/:id/submit", { scope: "appstore:dev", summary: "إرسال التطبيق للمراجعة (draft|rejected ← pending)" }, async (req) => {
      await needDev(req); const a = await myApp(req); if (!["draft", "rejected"].includes(a.status)) throw new HttpError(409, "bad_transition", "الحالة الحالية لا تسمح بالإرسال");
      await db.run("UPDATE apps SET status='pending', review_note=NULL, updated_at=? WHERE id=?", ctx.nowS(), a.id); return ok({ ok: true, status: "pending" });
    });
    r.post("/v1/appstore/dev/apps/:id/rotate-secrets", { scope: "appstore:dev", limit: { key: "approt", max: 10, win: 3600 }, summary: "تدوير client_secret وwebhook_secret (القديمان يبطلان فوراً)" }, async (req) => {
      await needDev(req); const a = await myApp(req), s = await secrets(a.id); await db.run("UPDATE apps SET webhook_secret_enc=? WHERE id=?", s.enc, a.id);
      await db.run("UPDATE oauth_clients SET secret_hash=? WHERE app_id=? AND revoked_at IS NULL", s.hash, a.id); return ok({ client_secret: s.client_secret, webhook_secret: s.webhook_secret, note: "تظهر مرة واحدة" });
    });
    r.get("/v1/appstore/dev/deliveries", { scope: "appstore:dev", summary: "سجلّ تسليمات webhooks لتطبيقاتي (?app_id= &state=pending|sent|failed)" }, async (req) => {
      await needDev(req); const lim = clampLimit(req.query.limit), a = [req.tenant.id]; let q = "SELECT d.id, d.app_id, d.type, d.state, d.attempts, d.last_error, d.created_at, d.next_at, ap.name FROM app_deliveries d JOIN apps ap ON ap.id=d.app_id WHERE ap.developer_id=?";
      if (req.query.app_id) { q += " AND d.app_id=?"; a.push(+req.query.app_id); } if (["pending", "sent", "failed"].includes(req.query.state)) { q += " AND d.state=?"; a.push(req.query.state); }
      return ok({ deliveries: (await db.all(q + " ORDER BY d.id DESC LIMIT ?", ...a, lim)).map((x) => ({ id: x.id, app: x.name, app_id: x.app_id, type: x.type, state: x.state, attempts: x.attempts, error: x.last_error, created_at: x.created_at })) });
    });
    r.post("/v1/appstore/dev/deliveries/:id/retry", { scope: "appstore:dev", limit: { key: "appretry", max: 60, win: 3600 }, summary: "إعادة إرسال تسليم فاشل فوراً" }, async (req) => {
      await needDev(req); const d = await db.one("SELECT d.id, d.state FROM app_deliveries d JOIN apps a ON a.id=d.app_id WHERE d.id=? AND a.developer_id=?", +req.params.id, req.tenant.id); if (!d) throw new HttpError(404, "not_found", "التسليم غير موجود");
      if (d.state !== "failed") throw new HttpError(409, "bad_transition", "تُعاد التسليمات الفاشلة فقط");
      await db.run("UPDATE app_deliveries SET state='pending', attempts=0, next_at=?, last_error=NULL WHERE id=?", ctx.nowS(), d.id); return ok({ ok: true });
    });
    r.post("/v1/appstore/dev/apps/:id/verify-domain", { scope: "appstore:dev", limit: { key: "appvd", max: 10, win: 3600 }, summary: "توثيق ملكية نطاق webhook: انشر https://<نطاقك>/.well-known/alyssum-app.json بمحتوى {\"client_id\":\"ci_…\"} ثم استدعِ هذا المسار" }, async (req) => {
      await needDev(req); const a = await myApp(req), host = hostOf(a.webhook_url); if (!host) throw new HttpError(400, "validation_error", "حدّد webhook_url أولاً");
      const cl = await clientOf(a.id); let got = null, err = "";
      try { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000), res = await ctx.fetchFn(`https://${host}/.well-known/alyssum-app.json`, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "alyssum-appstore/1" } }); clearTimeout(to);
        if (res.status === 200) got = JSON.parse(await res.text()); else err = "HTTP " + res.status; } catch (e) { err = String(e?.message || e).slice(0, 60); }
      if (!cl || !got || typeof got.client_id !== "string" || !safeEq(got.client_id, cl.client_id)) throw new HttpError(422, "verification_failed", `لم يُعثر على الملف الصحيح في https://${host}/.well-known/alyssum-app.json${err ? " (" + err + ")" : ""}`);
      await db.run("INSERT INTO app_flags (app_id,domain_host,domain_checked_at) VALUES (?,?,?) ON CONFLICT(app_id) DO UPDATE SET domain_host=excluded.domain_host, domain_checked_at=excluded.domain_checked_at", a.id, host, ctx.nowS()); return ok({ verified: true, host });
    });
    r.get("/v1/appstore/dev/earnings", { scope: "appstore:dev", summary: "إيراداتي من التطبيقات (إجمالي/عمولة/صافي) — الصافي يُقيَّد في محفظتي" }, async (req) => {
      await needDev(req); const rows = await db.all("SELECT r.*, a.name FROM platform_revenues r JOIN apps a ON a.id=r.app_id WHERE r.developer_id=? ORDER BY r.id DESC LIMIT 100", req.tenant.id);
      const sum = await db.one("SELECT COALESCE(SUM(gross),0) gross, COALESCE(SUM(fee),0) fee, COALESCE(SUM(net),0) net FROM platform_revenues WHERE developer_id=?", req.tenant.id);
      return ok({ totals: sum, revenues: rows.map((x) => ({ id: x.id, app: x.name, period: x.period, gross: x.gross, fee: x.fee, net: x.net, state: x.state, created_at: x.created_at })) });
    });

    /* ───────── إدارة المزوّد ───────── */
    r.post("/admin/appstore/developers", { auth: "admin", summary: "تفعيل/إيقاف حساب مطوّر: { tenant_id, status: active|suspended }" }, async (req) => {
      const b = req.json(), tid = +b.tenant_id, st = b.status === "suspended" ? "suspended" : "active"; if (!(await db.one("SELECT id FROM pf_tenants WHERE id=?", tid))) throw new HttpError(404, "not_found", "مستأجر غير موجود");
      await db.run("INSERT INTO app_developers (tenant_id,status,created_at) VALUES (?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET status=excluded.status", tid, st, nowStr(ctx.clock())); await ctx.audit(req.actor, "appstore.developer", tid, { status: st }); return ok({ ok: true });
    });
    r.get("/admin/appstore/apps", { auth: "admin", summary: "كل التطبيقات (?status=)" }, async (req) => {
      const lim = clampLimit(req.query.limit), a = []; let q = "SELECT a.*, t.name dev_name FROM apps a LEFT JOIN pf_tenants t ON t.id=a.developer_id WHERE 1=1"; if (STATUSES.includes(req.query.status)) { q += " AND a.status=?"; a.push(req.query.status); }
      const rows = await db.all(q + " ORDER BY a.id DESC LIMIT ?", ...a, lim), apps = []; for (const x of rows) apps.push({ ...pubApp(x, x.dev_name, await metaOf(x.id)), status: x.status, developer_id: x.developer_id, webhook_url: x.webhook_url, redirect_uris: JSON.parse(x.redirect_uris), review_note: x.review_note }); return ok({ apps });
    });
    r.post("/admin/appstore/apps/:id/review", { auth: "admin", summary: "قرار المراجعة: { status: approved|rejected|suspended, note } — suspended يُبطل رموز التطبيق فوراً" }, async (req) => {
      const b = req.json(), to = b.status, a = await db.one("SELECT * FROM apps WHERE id=?", +req.params.id); if (!a) throw new HttpError(404, "not_found", "التطبيق غير موجود");
      if (!["approved", "rejected", "suspended"].includes(to)) throw new HttpError(400, "validation_error", "status: approved|rejected|suspended");
      if (to === "approved" && !["pending", "suspended"].includes(a.status)) throw new HttpError(409, "bad_transition", "الاعتماد من pending أو suspended فقط");
      if (to === "rejected" && a.status !== "pending") throw new HttpError(409, "bad_transition", "الرفض من pending فقط");
      await db.run("UPDATE apps SET status=?, approved_once=CASE WHEN ?='approved' THEN 1 ELSE approved_once END, review_note=?, updated_at=? WHERE id=?", to, to, String(b.note ?? "").slice(0, 300) || null, ctx.nowS(), a.id);
      if (to === "suspended") { await db.run("UPDATE oauth_access_tokens SET revoked_at=? WHERE revoked_at IS NULL AND installation_id IN (SELECT id FROM app_installations WHERE app_id=?)", ctx.nowS(), a.id); }
      await ctx.audit(req.actor, "appstore.review", a.id, { status: to }); return ok({ ok: true, status: to });
    });
    r.post("/admin/appstore/apps/:id/feature", { auth: "admin", summary: "تمييز تطبيق في السوق: { featured: true|false }" }, async (req) => {
      const a = await db.one("SELECT id FROM apps WHERE id=?", +req.params.id); if (!a) throw new HttpError(404, "not_found", "التطبيق غير موجود"); const f = req.json().featured ? 1 : 0;
      await db.run("INSERT INTO app_flags (app_id,featured) VALUES (?,?) ON CONFLICT(app_id) DO UPDATE SET featured=excluded.featured", a.id, f); await ctx.audit(req.actor, "appstore.feature", a.id, { featured: f }); return ok({ ok: true, featured: !!f });
    });
    r.get("/admin/appstore/settings", { auth: "admin", summary: "نسبة عمولة المنصة" }, async () => ok({ commission_pct: await commission() }));
    r.put("/admin/appstore/settings", { auth: "admin", summary: "ضبط العمولة: { commission_pct: 0..50 } (تسري على الاشتراءات القادمة)" }, async (req) => {
      const p = Math.round(+req.json().commission_pct); if (!(p >= 0 && p <= 50)) throw new HttpError(400, "validation_error", "commission_pct بين 0 و50");
      await db.run("INSERT INTO app_settings (id,commission_pct,updated_at) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET commission_pct=excluded.commission_pct, updated_at=excluded.updated_at", p, ctx.nowS()); await ctx.audit(req.actor, "appstore.commission", null, { p }); return ok({ ok: true, commission_pct: p });
    });
    r.get("/admin/appstore/revenues", { auth: "admin", summary: "ملخص الإيرادات والعمولات" }, async () => ok({ totals: await db.one("SELECT COALESCE(SUM(gross),0) gross, COALESCE(SUM(fee),0) fee, COALESCE(SUM(net),0) net, SUM(CASE WHEN state<>'settled' THEN 1 ELSE 0 END) unsettled FROM platform_revenues"), commission_pct: await commission() }));
    r.get("/admin/appstore/installations", { auth: "admin", summary: "التثبيتات (?app_id=)" }, async (req) => {
      const rows = await db.all("SELECT i.*, t.name tenant_name, a.name app_name FROM app_installations i LEFT JOIN pf_tenants t ON t.id=i.tenant_id LEFT JOIN apps a ON a.id=i.app_id WHERE (?=0 OR i.app_id=?) ORDER BY i.id DESC LIMIT 200", +req.query.app_id || 0, +req.query.app_id || 0); return ok({ installations: rows });
    });

    ctx.appstore = { settle, bill };
  },

  on: {
    /** يحوّل أحداث المتجر إلى تسليمات webhook لكل تطبيق مثبّت ومعتمد يشترك بالحدث وله النطاق اللازم (والبيانات مفلترة). أحداث دورة الحياة تذهب لصاحبها فقط. */
    "*": async (e, ctx) => {
      const lifecycle = LIFECYCLE.includes(e.type), need = lifecycle ? null : eventScope(e.type); if (!lifecycle && !need) return;
      const rows = await ctx.db.all(`SELECT i.id iid, i.scopes iscopes, a.id app_id, a.events, a.webhook_url FROM app_installations i JOIN apps a ON a.id=i.app_id
        WHERE i.tenant_id=? AND (i.status IN ('active','past_due') OR ?=1) AND a.status='approved' AND a.webhook_url IS NOT NULL ${lifecycle ? "AND a.id=?" : ""}`, e.tenantId, lifecycle ? 1 : 0, ...(lifecycle ? [+e.data?.app_id || 0] : []));
      for (const x of rows) {
        const sc = JSON.parse(x.iscopes); if (!lifecycle && (!sc.includes(need) || !JSON.parse(x.events).some((p) => p === e.type))) continue;
        if (lifecycle && e.data?.installation_id !== x.iid) continue;
        const data = lifecycle ? e.data : redact(e.data, sc);
        await ctx.db.run("INSERT INTO app_deliveries (app_id,installation_id,tenant_id,event_id,type,payload,state,attempts,next_at,created_at) VALUES (?,?,?,?,?,?,'pending',0,?,?)", x.app_id, x.iid, e.tenantId, e.id, e.type, JSON.stringify(data), ctx.nowS(), nowStr(ctx.clock()));
      }
    },
  },

  /** cron: تسليم webhooks التطبيقات بتباعد، تسوية الإيرادات المعلّقة، والفوترة الشهرية (مع مهلة سماح 3 أيام ثم تعليق التثبيت) */
  async cron(ctx) {
    const out = { sent: 0, failed: 0, billed: 0, past_due: 0, settled: 0 }, db = ctx.db, now = ctx.nowS();
    for (const d of await db.all("SELECT d.*, a.webhook_url, a.webhook_secret_enc, a.status ast FROM app_deliveries d JOIN apps a ON a.id=d.app_id WHERE d.state='pending' AND d.next_at<=? ORDER BY d.id LIMIT 30", now)) {
      if (!d.webhook_url || !ctx.vault || !safeHttpsUrl(d.webhook_url) || d.ast !== "approved") { await db.run("UPDATE app_deliveries SET state='failed', last_error='endpoint_unavailable' WHERE id=?", d.id); continue; }
      const t = await db.one("SELECT name, site_ref FROM pf_tenants WHERE id=?", d.tenant_id), secret = await ctx.vault.decrypt(d.webhook_secret_enc, `app:${d.app_id}:wh`), ts = now;
      const body = JSON.stringify({ id: "adl_" + d.id, type: d.type, created: ts, shop: { id: d.tenant_id, domain: t?.site_ref ?? null }, data: JSON.parse(d.payload) });
      let status = 0, err = ""; try { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000);
        const res = await ctx.fetchFn(d.webhook_url, { method: "POST", redirect: "manual", signal: ctl.signal, headers: { "Content-Type": "application/json", "X-App-Signature": `t=${ts},v1=${await hmacHex(secret, ts + "." + body)}`, "X-App-Event": d.type, "X-App-Delivery": String(d.id), "User-Agent": "alyssum-appstore/1" }, body }); clearTimeout(to); status = res.status; } catch (x) { err = String(x?.message || x).slice(0, 80); }
      const n = d.attempts + 1;
      if (status >= 200 && status < 300) { await db.run("UPDATE app_deliveries SET state='sent', attempts=?, last_error=NULL WHERE id=?", n, d.id); out.sent++; continue; }
      out.failed++; const msg = status ? "HTTP " + status : err || "network";
      if (n > BACKOFF.length) await db.run("UPDATE app_deliveries SET state='failed', attempts=?, last_error=? WHERE id=?", n, msg, d.id); else await db.run("UPDATE app_deliveries SET attempts=?, next_at=?, last_error=? WHERE id=?", n, now + BACKOFF[n - 1], msg, d.id);
    }
    if (ctx.wallet && ctx.appstore) {
      for (const rev of await db.all("SELECT * FROM platform_revenues WHERE state='pending' ORDER BY id LIMIT 20")) { try { if (await ctx.appstore.settle(rev)) out.settled++; } catch { /* يُعاد */ } }
      for (const i of await db.all("SELECT * FROM app_installations WHERE status IN ('active','past_due') AND billing='monthly' AND price>0 AND next_charge_at IS NOT NULL AND next_charge_at<=? ORDER BY id LIMIT 10", now)) {
        const app = await db.one("SELECT * FROM apps WHERE id=?", i.app_id); if (!app) continue;
        try { await ctx.appstore.bill(app, i, period(i.next_charge_at * 1000)); await db.run("UPDATE app_installations SET status='active', next_charge_at=? WHERE id=?", i.next_charge_at + TTL.month, i.id); out.billed++; }
        catch (e) {
          if (e?.code !== "insufficient_funds") continue;
          if (now > i.next_charge_at + TTL.grace) { await db.run("UPDATE app_installations SET status='suspended', next_charge_at=NULL WHERE id=?", i.id); await db.run("UPDATE oauth_access_tokens SET revoked_at=? WHERE installation_id=? AND revoked_at IS NULL", now, i.id); await ctx.emit(i.tenant_id, "appstore.suspended", { app_id: i.app_id, installation_id: i.id, reason: "payment_failed" }, `app:susp:${i.id}:${now}`); }
          else if (i.status !== "past_due") { await db.run("UPDATE app_installations SET status='past_due' WHERE id=?", i.id); out.past_due++; }
        }
      }
    }
    return out;
  },
};
