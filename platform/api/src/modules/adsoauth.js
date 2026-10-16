import { HttpError, ok } from "../core.js";
import { hmacHex, hex, randHex, safeEq } from "../util.js";
import { MAX_ACCOUNTS, validateAccount } from "./ads.js";

/**
 * ربط Facebook بنقرة واحدة (OAuth 2.0) لسحب الإنفاق الإعلاني بالقراءة فقط، بدل لصق الرمز يدوياً.
 * التدفق: start (رابط الموافقة + state موقَّع) ← Facebook ← callback (code ← رمز قصير ← رمز طويل الأمد ≈60 يوماً، مشفّر) ← الواجهة تختار الحسابات
 * (link) ← تُزامَن كالمعتاد. الحسابات المربوطة تنسخ الرمز ويُجدَّد مركزياً (cron) قبل انتهائه، وعند انتهائه/إبطاله يُوسَم الاتصال «expired» ويصدر حدث.
 * سرّا التطبيق META_APP_ID وMETA_APP_SECRET من أسرار الخادم (ctx.config) لا من المستودع؛ بلا ضبطهما تُعيد المسارات oauth_not_configured.
 * مسارات data-deletion/deauth التي تشترطها Meta لنشر التطبيق تتحقق من signed_request بسرّ التطبيق.
 * الصيغ من وثائق Meta العامة وتُختبر هنا بمحاكاة fetch فقط؛ لم تُجرَّب على تطبيق Meta حقيقي بعد.
 */
const GRAPH = "https://graph.facebook.com", DAY = 86400, STATE_TTL = 600, REFRESH_BEFORE = 10 * DAY, WARN_BEFORE = 7 * DAY, DEFAULT_LIFE = 60 * DAY;
const CB = "/v1/ads/oauth/meta/callback";
const txt = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => decodeURIComponent(escape(atob(String(s).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(s).length / 4) * 4, "="))));
const bytesHex = (s) => hex(Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(s).length / 4) * 4, "=")), (c) => c.charCodeAt(0)));
const app = (ctx) => ({ id: String(ctx.config?.META_APP_ID || "").trim(), secret: String(ctx.config?.META_APP_SECRET || "").trim(), ver: String(ctx.config?.META_API_VERSION || "v21.0"), scopes: String(ctx.config?.META_SCOPES || "ads_read,business_management").replace(/\s+/g, "") });
const redirectUri = (ctx) => ctx.config?.META_REDIRECT_URI || ctx.baseUrl + CB;

/* ───────── نقية ───────── */
export async function signState(secret, data) { const p = b64u(JSON.stringify(data)); return p + "." + (await hmacHex(secret, "adsoauth:" + p)).slice(0, 40); }
export async function readState(secret, state, nowS) {
  const [p, sig] = String(state ?? "").split("."); if (!p || !sig) return null;
  if (!safeEq(sig, (await hmacHex(secret, "adsoauth:" + p)).slice(0, 40))) return null;
  let d; try { d = JSON.parse(unb64u(p)); } catch { return null; } return d && d.e > nowS && d.t && d.n ? d : null;
}
/** signed_request من Meta (deauth/data-deletion) ← { user_id } أو null */
export async function readSignedRequest(secret, sr) {
  const [sig, payload] = String(sr ?? "").split("."); if (!sig || !payload) return null;
  let want; try { want = await hmacHex(secret, payload); } catch { return null; }
  let got; try { got = bytesHex(sig); } catch { return null; } if (!safeEq(got, want)) return null;
  try { const d = JSON.parse(unb64u(payload)); return d && d.user_id ? d : null; } catch { return null; }
}
/** ردّ me/adaccounts ← حسابات مختصرة (المعرّف أرقام فقط) */
export function parseAccounts(j) {
  const out = []; for (const a of j?.data ?? []) { const id = String(a.account_id ?? a.id ?? "").replace(/^act_/, ""); if (!/^\d{5,20}$/.test(id)) continue; out.push({ account_id: id, name: txt(a.name || a.business_name, 80) || "Ad account " + id, currency: String(a.currency || "USD").toUpperCase().slice(0, 3), status: Number(a.account_status) || 0 }); }
  return out;
}
const back = (to, kv) => { const u = new URL(to); u.hash = new URLSearchParams(kv).toString(); return { status: 302, headers: { Location: u.toString(), "Cache-Control": "no-store" }, body: "" }; };

/* ───────── الشبكة ───────── */
async function fb(ctx, method, path, { token, form, query } = {}) {
  const a = app(ctx), url = new URL(/^https:/.test(path) ? path : `${GRAPH}/${a.ver}${path}`); if (url.hostname !== "graph.facebook.com") throw new Error("رابط من نطاق غير متوقع"); for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const init = { method, headers: { Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, signal: AbortSignal.timeout(20000) };
  if (form) { init.body = new URLSearchParams(form).toString(); init.headers["Content-Type"] = "application/x-www-form-urlencoded"; }
  let r; try { r = await ctx.fetchFn(url.toString(), init); } catch (e) { const er = new Error("تعذّر الاتصال بـ Facebook"); er.net = true; throw er; }
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* غير JSON */ }
  if (r.status < 200 || r.status >= 300 || j?.error) { const e = new Error(j?.error?.message ? "رفضت Facebook الطلب: " + String(j.error.message).slice(0, 140) : "ردّ غير متوقع من Facebook (" + r.status + ")"); e.code = j?.error?.code ?? null; e.status = r.status; throw e; }
  return j ?? {};
}
const exchange = (ctx, form) => { const a = app(ctx); return fb(ctx, "POST", "/oauth/access_token", { form: { client_id: a.id, client_secret: a.secret, ...form } }); };
/** رمز قصير ← طويل الأمد { token, expires_at } */
async function longLived(ctx, shortToken) {
  const j = await exchange(ctx, { grant_type: "fb_exchange_token", fb_exchange_token: shortToken }); if (!j.access_token) throw new Error("لم تُرجع Facebook رمزاً طويل الأمد");
  return { token: j.access_token, expires_at: ctx.nowS() + (Number(j.expires_in) > 0 ? Number(j.expires_in) : DEFAULT_LIFE) };
}
async function listAccounts(ctx, token) {
  const out = []; let j = await fb(ctx, "GET", "/me/adaccounts", { token, query: { fields: "account_id,name,business_name,currency,account_status", limit: "100" } });
  out.push(...parseAccounts(j)); for (let i = 0; i < 3 && j?.paging?.next; i++) { j = await fb(ctx, "GET", j.paging.next, { token }); out.push(...parseAccounts(j)); }
  return out;
}
const pubConn = (c, linked, now) => ({ id: c.id, provider: c.provider, fb_user_name: c.fb_user_name, status: c.status === "active" && c.expires_at <= now ? "expired" : c.status, expires_at: c.expires_at, days_left: Math.max(0, Math.floor((c.expires_at - now) / DAY)), last_error: c.last_error,
  accounts: JSON.parse(c.accounts || "[]").map((a) => ({ ...a, linked: linked.includes(a.account_id) })) });

/** ينسخ رمز الاتصال إلى كل حساب إعلاني مربوط به (aad كالمعتاد: ads:<tenant>:<id>) */
async function pushToken(ctx, conn, token) {
  const linked = await ctx.db.all("SELECT id FROM ad_accounts WHERE tenant_id=? AND json_extract(config,'$.oauth')=?", conn.tenant_id, conn.id);
  for (const a of linked) await ctx.db.run("UPDATE ad_accounts SET secret_enc=?, status=CASE WHEN status='paused' THEN status ELSE 'active' END, last_error=NULL WHERE id=?", await ctx.vault.encrypt({ token }, `ads:${conn.tenant_id}:${a.id}`), a.id);
}
/** يجدّد رمز اتصال (يُستدعى من cron). لا يرمي. */
export async function refreshConn(ctx, conn) {
  const now = ctx.nowS();
  try {
    const cur = (await ctx.vault.decryptJson(conn.token_enc, `adsoauth:${conn.tenant_id}:${conn.id}`)).token, nt = await longLived(ctx, cur);
    await ctx.db.run("UPDATE ad_oauth SET token_enc=?, expires_at=?, last_refresh_at=?, status='active', last_error=NULL, warned=0 WHERE id=?", await ctx.vault.encrypt({ token: nt.token }, `adsoauth:${conn.tenant_id}:${conn.id}`), nt.expires_at, now, conn.id);
    await pushToken(ctx, conn, nt.token); return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 200);
    if (e?.code === 190 || e?.code === 102) { await ctx.db.run("UPDATE ad_oauth SET status='expired', last_error=?, last_refresh_at=? WHERE id=?", msg, now, conn.id); return { ok: false, expired: true }; }
    await ctx.db.run("UPDATE ad_oauth SET last_error=?, last_refresh_at=? WHERE id=?", msg, now, conn.id); return { ok: false, error: msg };   // خطأ شبكة/مؤقت: تبقى فعّالة ويُعاد لاحقاً
  }
}
/** يفصل كل ما يخص مستخدم Facebook (deauth/حذف بيانات) */
async function dropFbUser(ctx, fbUserId) {
  const conns = await ctx.db.all("SELECT * FROM ad_oauth WHERE fb_user_id=?", String(fbUserId));
  for (const c of conns) { await ctx.db.run("UPDATE ad_accounts SET secret_enc=NULL, status='paused', last_error=? WHERE tenant_id=? AND json_extract(config,'$.oauth')=?", "فُصل الربط من جهة Facebook", c.tenant_id, c.id); await ctx.db.run("DELETE FROM ad_oauth WHERE id=?", c.id); await ctx.audit("fb:" + fbUserId, "adsoauth.deauth", c.id, { tenant: c.tenant_id }); }
  return conns.length;
}

export const adsOauth = {
  id: "adsoauth",
  routes(r, ctx) {
    const { db } = ctx;
    const need = () => { const a = app(ctx); if (!a.id || !a.secret) throw new HttpError(503, "oauth_not_configured", "الربط عبر Facebook غير مفعّل بعد"); if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم"); return a; };
    const own = async (tid, id) => { const c = await db.one("SELECT * FROM ad_oauth WHERE id=? AND tenant_id=?", +id, tid); if (!c) throw new HttpError(404, "not_found", "الاتصال غير موجود"); return c; };

    r.get("/v1/ads/oauth", { scope: "ads:read", summary: "اتصالات Facebook (OAuth) وحساباتها الإعلانية المتاحة للربط — بلا رموز" }, async (req) => {
      const a = app(ctx), now = ctx.nowS(), rows = await db.all("SELECT * FROM ad_oauth WHERE tenant_id=? ORDER BY id", req.tenant.id), out = [];
      for (const c of rows) { const linked = (await db.all("SELECT account_id FROM ad_accounts WHERE tenant_id=? AND provider='meta' AND json_extract(config,'$.oauth')=?", req.tenant.id, c.id)).map((x) => x.account_id); out.push(pubConn(c, linked, now)); }
      return ok({ configured: !!(a.id && a.secret && ctx.vault), connections: out });
    });
    r.post("/v1/ads/oauth/meta/start", { scope: "ads:write", limit: { key: "adsoauth", max: 20, win: 60 }, summary: "يبدأ ربط Facebook: {return_to} صفحة اللوحة (أصل من origins) ← { url } للتحويل إليه" }, async (req) => {
      const a = need(), b = req.json(); let to; try { to = new URL(String(b.return_to ?? "")); } catch { throw new HttpError(400, "validation_error", "return_to غير صالح", { return_to: "رابط صفحة اللوحة" }); }
      if (to.protocol !== "https:" || !(req.tenant.settings.origins ?? []).includes(to.origin)) throw new HttpError(400, "validation_error", "return_to يجب أن يكون من أصول الموقع المسموحة", { return_to: "أصل غير مسموح" });
      if (req.mode !== "live") return ok({ url: "https://www.facebook.com/", sandbox: true });
      const state = await signState(ctx.secret, { t: req.tenant.id, n: randHex(12), e: ctx.nowS() + STATE_TTL, r: to.origin + to.pathname });
      const u = new URL(`https://www.facebook.com/${a.ver}/dialog/oauth`); u.searchParams.set("client_id", a.id); u.searchParams.set("redirect_uri", redirectUri(ctx)); u.searchParams.set("state", state); u.searchParams.set("scope", a.scopes); u.searchParams.set("response_type", "code");
      return ok({ url: u.toString() });
    });
    /* يستدعيه متصفح الزائر بعد موافقته: لا مفتاح، فالحماية بـstate الموقَّع (10 دقائق) وحدّ المعدل لكل IP */
    r.get(CB, { auth: "public", summary: "عودة Facebook بعد الموافقة (يحوّل إلى اللوحة)" }, async (req) => {
      const q = req.query, st = await readState(ctx.secret, q.state, ctx.nowS());
      if (!st) throw new HttpError(400, "invalid_state", "رابط الربط منتهٍ أو غير صالح — ابدأ من لوحة التحكم");
      const t = await db.one("SELECT * FROM pf_tenants WHERE id=?", st.t), settings = t ? JSON.parse(t.settings || "{}") : {};
      if (!t || t.status !== "active" || !(settings.origins ?? []).includes(new URL(st.r).origin)) throw new HttpError(400, "invalid_state", "الموقع غير مسموح");
      const fail = (m) => back(st.r, { ads_oauth: "err", m });
      if (q.error) return fail(q.error === "access_denied" ? "أُلغي الربط من Facebook" : "رفضت Facebook الربط");
      if (!q.code) return fail("لم يصل رمز التفويض");
      let a; try { a = need(); } catch (e) { return fail(e.message); }
      if (await db.one("SELECT id FROM ad_oauth WHERE nonce=?", st.n)) return fail("استُعمل هذا الرابط من قبل — ابدأ من جديد");
      try {
        const sh = await exchange(ctx, { redirect_uri: redirectUri(ctx), code: String(q.code) }); if (!sh.access_token) throw new Error("لم تُرجع Facebook رمزاً");
        const ll = await longLived(ctx, sh.access_token), me = await fb(ctx, "GET", "/me", { token: ll.token, query: { fields: "id,name" } });
        const perms = await fb(ctx, "GET", "/me/permissions", { token: ll.token }).catch(() => null);
        if (perms && !(perms.data ?? []).some((p) => p.permission === "ads_read" && p.status === "granted")) return fail("لم تمنح صلاحية قراءة الإعلانات — أعد الربط ووافق عليها");
        const accounts = await listAccounts(ctx, ll.token), now = ctx.nowS(), fbId = String(me.id ?? ""); if (!fbId) throw new Error("تعذّرت قراءة حساب Facebook");
        let ex = await db.one("SELECT * FROM ad_oauth WHERE tenant_id=? AND fb_user_id=?", t.id, fbId), id;
        if (ex) {   // إعادة ربط لنفس المستخدم: نحدّث الاتصال الموجود فتبقى الحسابات المربوطة
          id = ex.id; await db.run("UPDATE ad_oauth SET nonce=?, fb_user_name=?, token_enc=?, expires_at=?, accounts=?, status='active', last_refresh_at=?, last_error=NULL, warned=0 WHERE id=?", st.n, txt(me.name, 80), await ctx.vault.encrypt({ token: ll.token }, `adsoauth:${t.id}:${id}`), ll.expires_at, JSON.stringify(accounts), now, id);
          await pushToken(ctx, ex, ll.token);
        } else {
          id = (await db.run("INSERT INTO ad_oauth (tenant_id,provider,nonce,fb_user_id,fb_user_name,expires_at,accounts,status,last_refresh_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", t.id, "meta", st.n, fbId, txt(me.name, 80), ll.expires_at, JSON.stringify(accounts), "active", now, now)).id;
          await db.run("UPDATE ad_oauth SET token_enc=? WHERE id=?", await ctx.vault.encrypt({ token: ll.token }, `adsoauth:${t.id}:${id}`), id);
        }
        await ctx.audit("tenant:" + t.id, ex ? "adsoauth.reconnect" : "adsoauth.connect", id, { accounts: accounts.length });
        return back(st.r, { ads_oauth: "ok", c: String(id), n: String(accounts.length) });
      } catch (e) { return fail(e?.net ? "تعذّر الاتصال بـ Facebook، أعد المحاولة" : String(e?.message || e).slice(0, 140)); }
    });
    r.post("/v1/ads/oauth/:id/link", { scope: "ads:write", limit: { key: "adsoauthlink", max: 20, win: 60 }, summary: "يربط حساباً إعلانياً من اتصال Facebook: {account_id, fx, name?} (العملة من Facebook)" }, async (req) => {
      need(); const c = await own(req.tenant.id, req.params.id), b = req.json(), tid = req.tenant.id;
      if (c.status !== "active" || c.expires_at <= ctx.nowS()) throw new HttpError(409, "oauth_expired", "انتهى ربط Facebook — أعد الربط أولاً");
      const aid = String(b.account_id ?? "").replace(/^act_/i, "").trim(), acc = JSON.parse(c.accounts || "[]").find((x) => x.account_id === aid);
      if (!acc) throw new HttpError(400, "validation_error", "هذا الحساب غير متاح في اتصالك", { account_id: "حساب غير موجود في اتصال Facebook" });
      const v = validateAccount("meta", aid, { currency: acc.currency, fx: b.fx }, {}, null), name = txt(b.name, 60) || acc.name;
      if ((await db.val("SELECT COUNT(*) FROM ad_accounts WHERE tenant_id=?", tid)) >= MAX_ACCOUNTS) throw new HttpError(409, "limit_reached", `الحد الأقصى ${MAX_ACCOUNTS} حسابات`);
      if (await db.one("SELECT id FROM ad_accounts WHERE tenant_id=? AND provider='meta' AND account_id=?", tid, v.account_id)) throw new HttpError(409, "duplicate", "هذا الحساب مربوط من قبل");
      if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      const token = (await ctx.vault.decryptJson(c.token_enc, `adsoauth:${tid}:${c.id}`)).token;
      const id = (await db.run("INSERT INTO ad_accounts (tenant_id,provider,account_id,name,currency,fx,config,status,created_at) VALUES (?,?,?,?,?,?,?,'active',?)", tid, "meta", v.account_id, name, v.currency, v.fx, JSON.stringify({ oauth: c.id }), ctx.now())).id;
      await db.run("UPDATE ad_accounts SET secret_enc=? WHERE id=?", await ctx.vault.encrypt({ token }, `ads:${tid}:${id}`), id);
      await ctx.audit("tenant:" + tid, "adsoauth.link", id, { conn: c.id }); return ok({ ok: true, id }, 201);
    });
    r.delete("/v1/ads/oauth/:id", { scope: "ads:write", summary: "فصل اتصال Facebook: تُوقَف حساباته المربوطة (يبقى إنفاقها المخزَّن) ويُحذف الرمز" }, async (req) => {
      const c = await own(req.tenant.id, req.params.id); if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      try { if (c.token_enc && ctx.vault && app(ctx).id) await fb(ctx, "DELETE", "/me/permissions", { token: (await ctx.vault.decryptJson(c.token_enc, `adsoauth:${c.tenant_id}:${c.id}`)).token }); } catch { /* الإبطال من جهتنا يكفي */ }
      await db.run("UPDATE ad_accounts SET secret_enc=NULL, status='paused', last_error=? WHERE tenant_id=? AND json_extract(config,'$.oauth')=?", "فُصل ربط Facebook", c.tenant_id, c.id);
      await db.run("DELETE FROM ad_oauth WHERE id=?", c.id); await ctx.audit("tenant:" + req.tenant.id, "adsoauth.disconnect", c.id, null); return ok({ ok: true });
    });
    /* نداءات Meta الإلزامية للتطبيقات المنشورة: إلغاء التفويض + طلب حذف البيانات (signed_request موقَّع بسرّ التطبيق) */
    const sr = async (req) => {
      const a = app(ctx); if (!a.secret) throw new HttpError(503, "oauth_not_configured", "غير مفعّل");
      let raw = ""; try { raw = new URLSearchParams(req.raw).get("signed_request") || req.json().signed_request || ""; } catch { try { raw = req.json().signed_request || ""; } catch { /* فارغ */ } }
      const d = await readSignedRequest(a.secret, raw); if (!d) throw new HttpError(400, "invalid_signature", "توقيع غير صالح"); return d;
    };
    r.post("/v1/ads/oauth/meta/deauth", { auth: "public", summary: "إشعار Meta بإلغاء المستخدم تفويض التطبيق" }, async (req) => { const d = await sr(req); await dropFbUser(ctx, d.user_id); return ok({ ok: true }); });
    r.post("/v1/ads/oauth/meta/deletion", { auth: "public", summary: "طلب حذف بيانات من Meta ← { url, confirmation_code }" }, async (req) => {
      const d = await sr(req), code = "del_" + randHex(8); await dropFbUser(ctx, d.user_id); await ctx.audit("fb:" + d.user_id, "adsoauth.deletion", code, null);
      return ok({ url: `${ctx.baseUrl}/v1/ads/oauth/meta/deletion?code=${code}`, confirmation_code: code });
    });
    r.get("/v1/ads/oauth/meta/deletion", { auth: "public", summary: "حالة طلب حذف البيانات" }, async (req) => ok({ status: "completed", confirmation_code: txt(req.query.code, 40), message: "حُذفت بيانات ربط Facebook المرتبطة بحسابك." }));
  },
  /** cron: يجدّد الرموز التي تقترب من الانتهاء (≤10 أيام، مرة كل 24 ساعة) ويُصدر تنبيهاً عند ≤7 أيام وعند الانتهاء */
  async cron(ctx) {
    if (!ctx.vault) return { refreshed: 0 };
    const now = ctx.nowS(), due = await ctx.db.all("SELECT * FROM ad_oauth WHERE status='active' AND token_enc IS NOT NULL AND expires_at-?<? AND (last_refresh_at IS NULL OR ?-last_refresh_at>=?) ORDER BY expires_at LIMIT 5", now, REFRESH_BEFORE, now, DAY);
    let refreshed = 0, failed = 0; for (const c of due) { const x = await refreshConn(ctx, c); if (x.ok) refreshed++; else failed++; }
    const open = await ctx.db.all("SELECT * FROM ad_oauth WHERE warned<2 AND (status='expired' OR expires_at-?<?) LIMIT 20", now, WARN_BEFORE); let alerts = 0;
    for (const c of open) {
      const expired = c.status === "expired" || c.expires_at <= now, stage = expired ? 2 : 1; if (c.warned >= stage) continue;
      await ctx.emit(c.tenant_id, expired ? "ads.token_expired" : "ads.token_expiring", { provider: "meta", connection_id: c.id, fb_user: c.fb_user_name, days_left: Math.max(0, Math.floor((c.expires_at - now) / DAY)) }, `adsoauth:${c.id}:${stage}:${c.expires_at}`);
      await ctx.db.run("UPDATE ad_oauth SET warned=? WHERE id=?", stage, c.id); alerts++;
    }
    return { refreshed, failed, alerts };
  },
};
