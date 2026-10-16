import { HttpError, ok } from "../core.js";

/**
 * إنفاق الإعلانات (Facebook/Instagram Ads وTikTok Ads): يسحب الإنفاق اليومي لكل حملة بالقراءة فقط ويخزّنه بعملة الحساب،
 * ويُحوَّل إلى الدينار عند القراءة بسعر صرف يضبطه التاجر (fx) — فتغيير السعر يسري على التاريخ كله. الرمز مشفّر بالخزنة.
 * الدوال النقية (parseMeta/parseTikTok/validateAccount) مصدَّرة للاختبار؛ الشبكة عبر ctx.fetchFn فقط.
 * صيغ الواجهتين من وثائقهما العامة ولم تُجرَّب على حساب إعلاني حقيقي بعد.
 */
export const PROVIDERS = ["meta", "tiktok"];
export const MAX_ACCOUNTS = 6;
const PAGES_PER_RUN = 6, DAY = 86400, FIRST_DAYS = 60, REFRESH_DAYS = 7;
const txt = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const ymd = (s) => new Date(s * 1000).toISOString().slice(0, 10);

/* ───────── نقية ───────── */
/** ردّ Meta Insights (level=campaign, time_increment=1) ← صفوف {day,campaign_id,campaign_name,spend,impressions,clicks} */
export function parseMeta(j) {
  const rows = [];
  for (const r of j?.data ?? []) {
    const day = String(r.date_start ?? "").slice(0, 10), id = String(r.campaign_id ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !id) continue;
    rows.push({ day, campaign_id: id, campaign_name: txt(r.campaign_name, 120), spend: num(r.spend), impressions: Math.round(num(r.impressions)), clicks: Math.round(num(r.clicks)) });
  }
  return rows;
}
/** ردّ TikTok report/integrated/get (AUCTION_CAMPAIGN × stat_time_day) */
export function parseTikTok(j) {
  const rows = [];
  for (const r of j?.data?.list ?? []) {
    const d = r.dimensions ?? {}, m = r.metrics ?? {}, day = String(d.stat_time_day ?? "").slice(0, 10), id = String(d.campaign_id ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !id) continue;
    rows.push({ day, campaign_id: id, campaign_name: txt(m.campaign_name ?? d.campaign_name, 120), spend: num(m.spend), impressions: Math.round(num(m.impressions)), clicks: Math.round(num(m.clicks)) });
  }
  return rows;
}
export function validateAccount(provider, accountIn, cfgIn = {}, secIn = {}, existing = null) {
  const bad = (field, msg) => { throw new HttpError(400, "validation_error", msg, { [field]: msg }); };
  if (!PROVIDERS.includes(provider)) bad("provider", "المنصة meta أو tiktok");
  let id = String(accountIn ?? existing?.account_id ?? "").trim().replace(/^act_/i, ""); if (!/^\d{5,20}$/.test(id)) bad("account_id", provider === "meta" ? "معرّف الحساب الإعلاني أرقام فقط (act_123… بلا act_)" : "Advertiser ID أرقام فقط");
  const cur = String(cfgIn.currency ?? existing?.currency ?? "USD").toUpperCase(); if (!/^[A-Z]{3}$/.test(cur)) bad("currency", "عملة الحساب بثلاثة أحرف (USD, EUR, DZD)");
  let fx = cfgIn.fx !== undefined ? num(cfgIn.fx) : (existing?.fx ?? (cur === "DZD" ? 1 : 0)); if (cur === "DZD") fx = 1;
  if (!(fx > 0 && fx < 100000)) bad("fx", "سعر الصرف إلى الدينار مطلوب (مثلاً 1 USD = 245 دج)");
  const sec = {}; if (secIn.token !== undefined) { const t = String(secIn.token).trim(); if (!/^[A-Za-z0-9_\-.|]{20,600}$/.test(t)) bad("token", "رمز الوصول غير صالح"); sec.token = t; }
  return { account_id: id, currency: cur, fx, sec };
}

/* ───────── الجلب ───────── */
async function getJson(ctx, url, init) {
  let r; try { r = await ctx.fetchFn(url, { ...init, signal: AbortSignal.timeout(20000) }); } catch (e) { throw new Error("تعذّر الاتصال بمنصة الإعلانات: " + String(e?.message || e).slice(0, 80)); }
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* غير JSON */ }
  if (r.status < 200 || r.status >= 300) { const m = j?.error?.message || j?.message; const e = new Error(m ? "رفضت المنصة الطلب: " + String(m).slice(0, 140) : "ردّ غير متوقع من المنصة (" + r.status + ")"); e.status = r.status; e.code = j?.error?.code ?? null; throw e; }
  if (j === null) throw new Error("ردّ غير صالح من منصة الإعلانات");
  return j;
}
/** يجلب الإنفاق اليومي بين since..until (YYYY-MM-DD). صفحات متتالية بحدّ PAGES_PER_RUN */
export async function pullSpend(ctx, acc, token, since, until, version = "v21.0") {
  const rows = [];
  if (acc.provider === "meta") {
    let url = `https://graph.facebook.com/${version}/act_${acc.account_id}/insights?level=campaign&fields=${encodeURIComponent("campaign_id,campaign_name,spend,impressions,clicks")}&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=500`;
    for (let p = 0; p < PAGES_PER_RUN && url; p++) {
      let u; try { u = new URL(url); } catch { throw new Error("رابط تصفح غير صالح"); } if (u.protocol !== "https:" || u.hostname !== "graph.facebook.com") throw new Error("رابط تصفح من نطاق غير متوقع");
      const j = await getJson(ctx, url, { headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      rows.push(...parseMeta(j)); url = j?.paging?.next ?? null;
    }
  } else {
    for (let page = 1; page <= PAGES_PER_RUN; page++) {
      const qs = new URLSearchParams({ advertiser_id: acc.account_id, report_type: "BASIC", data_level: "AUCTION_CAMPAIGN", dimensions: JSON.stringify(["campaign_id", "stat_time_day"]), metrics: JSON.stringify(["campaign_name", "spend", "impressions", "clicks"]), start_date: since, end_date: until, page: String(page), page_size: "200" });
      const j = await getJson(ctx, `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${qs}`, { headers: { "Access-Token": token, Accept: "application/json" } });
      if (j.code !== undefined && j.code !== 0) { const e = new Error("رفضت TikTok الطلب: " + String(j.message ?? j.code).slice(0, 140)); e.status = 400; throw e; }
      rows.push(...parseTikTok(j)); const tp = j?.data?.page_info?.total_page ?? 1; if (page >= tp) break;
    }
  }
  return rows;
}
/** يزامن حساباً: الأول 60 يوماً ثم آخر 7 أيام (الإنفاق يُعدَّل بعد النشر). لا يرمي: يحفظ الخطأ في last_error */
export async function syncAccount(ctx, acc) {
  const { db } = ctx, now = ctx.nowS();
  try {
    if (!ctx.vault || !acc.secret_enc) throw new Error("رمز الوصول غير محفوظ");
    const sec = await ctx.vault.decryptJson(acc.secret_enc, `ads:${acc.tenant_id}:${acc.id}`), cfg = JSON.parse(acc.config || "{}");
    const since = ymd(now - (acc.last_ok_at ? REFRESH_DAYS : FIRST_DAYS) * DAY), until = ymd(now);
    const rows = await pullSpend(ctx, acc, sec.token, since, until, cfg.api_version);
    const stmts = rows.map((r) => ["INSERT INTO ad_spend (tenant_id,account_id,day,campaign_id,campaign_name,spend,impressions,clicks,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id,day,campaign_id) DO UPDATE SET campaign_name=excluded.campaign_name, spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks, updated_at=excluded.updated_at",
      acc.tenant_id, acc.id, r.day, r.campaign_id, r.campaign_name, r.spend, r.impressions, r.clicks, now]);
    if (stmts.length) await db.batch(stmts);
    await db.run("UPDATE ad_accounts SET last_sync_at=?, last_ok_at=?, last_error=NULL WHERE id=?", now, now, acc.id);
    return { ok: true, rows: rows.length };
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 200); await db.run("UPDATE ad_accounts SET last_sync_at=?, last_error=? WHERE id=?", now, msg, acc.id);
    if (e?.code === 190) { const oid = Number(JSON.parse(acc.config || "{}").oauth) || 0; if (oid) await db.run("UPDATE ad_oauth SET status='expired', last_error=? WHERE id=? AND status='active'", msg, oid).catch(() => {}); }   // رمز Facebook منتهٍ/مُبطَل ← يظهر «أعد الربط»
    return { ok: false, error: msg, status: e?.status ?? null };
  }
}

/* ───────── المسارات ───────── */
const pub = (a) => ({ id: a.id, provider: a.provider, account_id: a.account_id, name: a.name, currency: a.currency, fx: a.fx, status: a.status, has_token: !!a.secret_enc, last_sync_at: a.last_sync_at, last_ok_at: a.last_ok_at, last_error: a.last_error });

export const ads = {
  id: "ads",
  routes(r, ctx) {
    const { db } = ctx;
    const own = async (tid, id) => { const a = await db.one("SELECT * FROM ad_accounts WHERE id=? AND tenant_id=?", +id, tid); if (!a) throw new HttpError(404, "not_found", "الحساب الإعلاني غير موجود"); return a; };
    r.get("/v1/ads/accounts", { scope: "ads:read", summary: "حسابات الإعلانات المربوطة (Meta/TikTok) بحالة آخر مزامنة — بلا رموز" }, async (req) =>
      ok({ providers: PROVIDERS, accounts: (await db.all("SELECT * FROM ad_accounts WHERE tenant_id=? ORDER BY id", req.tenant.id)).map(pub) }));
    r.put("/v1/ads/accounts", { scope: "ads:write", limit: { key: "adsacc", max: 20, win: 60 }, summary: "ربط/تعديل حساب إعلاني: {id?, provider, account_id, name, config:{currency,fx}, secrets:{token}} — الرمز مشفّر ولا يُعرض" }, async (req) => {
      const b = req.json(), tid = req.tenant.id; let ex = null;
      if (b.id !== undefined && b.id !== null) { ex = await own(tid, b.id); if (b.provider && b.provider !== ex.provider) throw new HttpError(400, "validation_error", "لا يمكن تغيير المنصة"); }
      const provider = ex ? ex.provider : String(b.provider ?? ""), name = txt(b.name ?? ex?.name ?? "", 60) || (provider === "meta" ? "Facebook Ads" : "TikTok Ads");
      const v = validateAccount(provider, b.account_id, b.config && typeof b.config === "object" ? b.config : {}, b.secrets && typeof b.secrets === "object" ? b.secrets : {}, ex);
      if (!ex && !v.sec.token) throw new HttpError(400, "validation_error", "رمز الوصول مطلوب", { token: "Access token" });
      if (!ex && (await db.val("SELECT COUNT(*) FROM ad_accounts WHERE tenant_id=?", tid)) >= MAX_ACCOUNTS) throw new HttpError(409, "limit_reached", `الحد الأقصى ${MAX_ACCOUNTS} حسابات`);
      if (v.sec.token && !ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم");
      if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      let id;
      if (ex) {
        await db.run("UPDATE ad_accounts SET name=?, account_id=?, currency=?, fx=?, status='active', last_error=NULL" + (v.sec.token ? ", secret_enc=?, last_ok_at=NULL" : "") + " WHERE id=?", name, v.account_id, v.currency, v.fx, ...(v.sec.token ? [await ctx.vault.encrypt(v.sec, `ads:${tid}:${ex.id}`)] : []), ex.id); id = ex.id;
      } else {
        if (await db.one("SELECT id FROM ad_accounts WHERE tenant_id=? AND provider=? AND account_id=?", tid, provider, v.account_id)) throw new HttpError(409, "duplicate", "هذا الحساب مربوط من قبل");
        id = (await db.run("INSERT INTO ad_accounts (tenant_id,provider,account_id,name,currency,fx,status,created_at) VALUES (?,?,?,?,?,?,'active',?)", tid, provider, v.account_id, name, v.currency, v.fx, ctx.now())).id;
        await db.run("UPDATE ad_accounts SET secret_enc=? WHERE id=?", await ctx.vault.encrypt(v.sec, `ads:${tid}:${id}`), id);
      }
      await ctx.audit("tenant:" + tid, ex ? "ads.update" : "ads.add", id, { provider });
      return ok({ ok: true, id }, ex ? 200 : 201);
    });
    r.post("/v1/ads/accounts/:id/sync", { scope: "ads:write", limit: { key: "adssync", max: 10, win: 60 }, summary: "مزامنة فورية للإنفاق (آخر 7 أيام، أو 60 يوماً أول مرة)" }, async (req) => {
      const a = await own(req.tenant.id, req.params.id); if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      const res = await syncAccount(ctx, a); return ok({ ...res, account: pub(await db.one("SELECT * FROM ad_accounts WHERE id=?", a.id)) });
    });
    r.post("/v1/ads/accounts/:id/pause", { scope: "ads:write", summary: "إيقاف/استئناف المزامنة التلقائية {paused:boolean}" }, async (req) => {
      const a = await own(req.tenant.id, req.params.id); await db.run("UPDATE ad_accounts SET status=? WHERE id=?", req.json().paused === false ? "active" : "paused", a.id); return ok({ ok: true });
    });
    r.delete("/v1/ads/accounts/:id", { scope: "ads:write", summary: "فصل حساب إعلاني وحذف إنفاقه المخزَّن هنا (الحساب الإعلاني نفسه لا يتأثر)" }, async (req) => {
      const a = await own(req.tenant.id, req.params.id); await db.run("DELETE FROM ad_spend WHERE account_id=?", a.id); await db.run("DELETE FROM ad_accounts WHERE id=?", a.id);
      await ctx.audit("tenant:" + req.tenant.id, "ads.delete", a.id, { provider: a.provider }); return ok({ ok: true });
    });
    r.get("/v1/ads/spend", { scope: "ads:read", summary: "الإنفاق اليومي لكل حملة بين since وuntil (YYYY-MM-DD، شاملين) مع القيمة بالدينار (spend × fx)" }, async (req) => {
      const q = req.query, d = (x, def) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x ?? "")) ? String(x) : def), until = d(q.until, ymd(ctx.nowS())), since = d(q.since, ymd(ctx.nowS() - 29 * DAY));
      const rows = await db.all("SELECT s.day, s.campaign_id, s.campaign_name, s.spend, s.impressions, s.clicks, a.id AS account_id, a.provider, a.currency, a.fx, a.name AS account_name FROM ad_spend s JOIN ad_accounts a ON a.id=s.account_id WHERE s.tenant_id=? AND s.day>=? AND s.day<=? ORDER BY s.day DESC, s.spend DESC LIMIT 20000", req.tenant.id, since, until);
      const out = rows.map((x) => ({ day: x.day, account_id: x.account_id, provider: x.provider, account_name: x.account_name, campaign_id: x.campaign_id, campaign_name: x.campaign_name, currency: x.currency, spend: x.spend, spend_dzd: Math.round(x.spend * x.fx * 100) / 100, impressions: x.impressions, clicks: x.clicks }));
      return ok({ since, until, total_dzd: Math.round(out.reduce((t, x) => t + x.spend_dzd, 0)), spend: out });
    });
  },
  /** cron: يزامن حتى حسابين مستحقين لكل نبضة (فاصل ساعتين) */
  async cron(ctx) {
    const now = ctx.nowS(), rows = await ctx.db.all("SELECT * FROM ad_accounts WHERE status='active' AND secret_enc IS NOT NULL ORDER BY COALESCE(last_sync_at,0) ASC LIMIT 20"), due = rows.filter((a) => !a.last_sync_at || now - a.last_sync_at >= 7200).slice(0, 2);
    let synced = 0, failed = 0, n = 0; for (const a of due) { const r = await syncAccount(ctx, a); synced++; if (!r.ok) failed++; else n += r.rows; }
    return { synced, failed, rows: n };
  },
};
