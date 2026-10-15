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

const KTXT = {
  ar: { subject: "بيانات طلبك الرقمي", body: "شكراً لشرائك. هذه بيانات طلبك، احتفظ بها في مكان آمن ولا تشاركها مع أحد:", links: "روابط التنزيل" },
  fr: { subject: "Les accès de votre commande", body: "Merci pour votre achat. Voici vos accès, gardez-les en lieu sûr et ne les partagez pas :", links: "Liens de téléchargement" },
  en: { subject: "Your digital order details", body: "Thanks for your purchase. Here are your details; keep them safe and do not share them:", links: "Download links" },
};
/** بريد التسليم: روابط التنزيل + المفاتيح/الحسابات. كل قيمة مهرَّبة؛ المفاتيح في صناديق من اليسار لليمين */
export function deliveryHtml(lang, name, links, keyBlocks) {
  const L = KTXT[lang] ? lang : "ar", t = KTXT[L], dir = L === "ar" ? "rtl" : "ltr";
  const lk = links.length ? `<p><b>${t.links}</b></p><ul>${links.map((l) => `<li><a href="${escHtml(l.url)}">${escHtml(l.name)}</a> — ${l.h} ${TXT[L].h} · ${l.n} ${TXT[L].n}</li>`).join("")}</ul>` : "";
  const ks = keyBlocks.map((b) => `<p><b>${escHtml(b.name)}</b></p>${b.values.map((v) => `<pre dir="ltr" style="background:#f3f4f6;padding:8px;border-radius:6px;white-space:pre-wrap;word-break:break-all">${escHtml(v)}</pre>`).join("")}`).join("");
  return `<div dir="${dir}" style="font-family:Arial,sans-serif"><p>${TXT[L].hello}${name ? " " + escHtml(name) : ""}،</p><p>${t.body}</p>${lk}${ks}</div>`;
}
const cleanKey = (v) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
const okEmail = (v) => { const e = String(v ?? "").trim().toLowerCase(); return e.length <= 120 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e) ? e : ""; };

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

    /* ───── مخزن المفاتيح والحسابات (serial keys / user:pass): يلصق التاجر قائمة، وكل مفتاح يُسلَّم لطلب واحد فقط ───── */
    r.post("/v1/digital/keys", { scope: "digital:write", limit: { key: "dgk", max: 60, win: 3600 }, summary: "إضافة مفاتيح/حسابات لمنتج: { sku, keys:[…] أو text بسطر لكل مفتاح } — حتى 1000 في الطلب، المكرَّر يُتجاهل" }, async (req) => {
      needVault(); const b = req.json(), sku = String(b.sku ?? "").trim(); if (!/^[A-Za-z0-9._-]{1,80}$/.test(sku)) throw new HttpError(400, "validation_error", "sku غير صالح", { sku: "A-Z a-z 0-9 . _ -" });
      const raw = Array.isArray(b.keys) ? b.keys : String(b.text ?? "").split(/\r?\n/), list = raw.map(cleanKey).filter(Boolean);
      if (!list.length) throw new HttpError(400, "validation_error", "لا مفاتيح للإضافة"); if (list.length > 1000) throw new HttpError(400, "validation_error", "حتى 1000 مفتاح في الطلب"); if (list.some((k) => k.length > 300)) throw new HttpError(400, "validation_error", "المفتاح الواحد حتى 300 حرف");
      if ((await db.val("SELECT COUNT(*) FROM dg_keys WHERE tenant_id=?", req.tenant.id)) + list.length > 50000) throw new HttpError(402, "plan_limit", "حدّ 50000 مفتاح");
      let added = 0, dup = 0, now = ctx.nowS();
      for (const k of list) { const h = await hmacHex(ctx.secret, `dgk:${req.tenant.id}:${sku}:${k}`);
        if (await db.val("SELECT 1 FROM dg_keys WHERE tenant_id=? AND sku=? AND secret_h=?", req.tenant.id, sku, h)) { dup++; continue; }
        await db.run("INSERT INTO dg_keys (tenant_id,sku,secret_enc,secret_h,state,created_at) VALUES (?,?,?,?,'available',?)", req.tenant.id, sku, await ctx.vault.encrypt(k, `dgk:${req.tenant.id}`), h, now); added++; }
      const retried = added ? await retryShort(ctx, req.tenant, sku) : 0;
      return ok({ ok: true, added, duplicates: dup, delivered_waiting: retried }, 201);
    });
    r.get("/v1/digital/keys", { scope: "digital:read", summary: "مخزون المفاتيح لكل sku (متاح/مباع) — بلا أي قيمة سرّية" }, async (req) => ok({ skus: (await db.all("SELECT sku, SUM(state='available') available, SUM(state='sold') sold FROM dg_keys WHERE tenant_id=? GROUP BY sku ORDER BY sku", req.tenant.id)).map((x) => ({ sku: x.sku, available: x.available ?? 0, sold: x.sold ?? 0 })) }));
    r.delete("/v1/digital/keys/:sku", { scope: "digital:write", summary: "حذف المفاتيح المتاحة (غير المباعة) لمنتج" }, async (req) => ok({ ok: true, removed: (await db.run("DELETE FROM dg_keys WHERE tenant_id=? AND sku=? AND state='available'", req.tenant.id, req.params.sku)).changes }));
    r.get("/v1/digital/orders", { scope: "digital:read", summary: "طلبات المنتجات الرقمية (?state=awaiting|short|ready|delivered) — بلا أسرار" }, async (req) => {
      const lim = clampLimit(req.query.limit), a = [req.tenant.id]; let q = "SELECT order_ref,items,name,paid,state,detail,created_at,delivered_at,(email_enc IS NOT NULL) has_email FROM dg_orders WHERE tenant_id=?";
      if (["awaiting", "short", "ready", "delivered"].includes(req.query.state)) { q += " AND state=?"; a.push(req.query.state); }
      return ok({ orders: (await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim)).map((o) => ({ order_ref: o.order_ref, items: JSON.parse(o.items), name: o.name, paid: !!o.paid, state: o.state, detail: o.detail, has_email: !!o.has_email, created_at: o.created_at, delivered_at: o.delivered_at })) });
    });
    r.get("/v1/digital/orders/:ref", { scope: "digital:write", limit: { key: "dgo", max: 120, win: 3600 }, summary: "المفاتيح المخصَّصة لطلب مدفوع (للتاجر فقط، لإرسالها يدوياً عبر واتساب عند تعذّر البريد)" }, async (req) => {
      needVault(); const o = await db.one("SELECT paid,state FROM dg_orders WHERE tenant_id=? AND order_ref=?", req.tenant.id, req.params.ref); if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود");
      if (!o.paid) throw new HttpError(409, "not_paid", "الطلب غير مدفوع بعد");
      const rows = await db.all("SELECT sku, secret_enc FROM dg_keys WHERE tenant_id=? AND order_ref=? ORDER BY id", req.tenant.id, req.params.ref), by = {};
      for (const k of rows) (by[k.sku] ??= []).push(await ctx.vault.decrypt(k.secret_enc, `dgk:${req.tenant.id}`));
      return ok({ order_ref: req.params.ref, state: o.state, keys: Object.entries(by).map(([sku, values]) => ({ sku, values })) });
    });
    r.post("/v1/digital/orders/:ref/deliver", { scope: "digital:write", limit: { key: "dgd", max: 120, win: 3600 }, summary: "إعادة محاولة التسليم لطلب مدفوع (بعد إضافة مخزون أو ضبط البريد)" }, async (req) => {
      const o = await db.one("SELECT * FROM dg_orders WHERE tenant_id=? AND order_ref=?", req.tenant.id, req.params.ref); if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود");
      if (!o.paid) throw new HttpError(409, "not_paid", "الطلب غير مدفوع بعد"); if (o.state === "delivered") return ok({ ok: true, state: "delivered", duplicate: true });
      return ok({ ok: true, state: await deliver(ctx, req.tenant, o) });
    });
    r.post("/v1/digital/orders/:ref/sent", { scope: "digital:write", summary: "تأكيد أنك أرسلت المفاتيح للزبون يدوياً (واتساب) ← الطلب يصير مُسلَّماً" }, async (req) => {
      const o = await db.one("SELECT * FROM dg_orders WHERE tenant_id=? AND order_ref=?", req.tenant.id, req.params.ref); if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود");
      if (o.state !== "ready") throw new HttpError(409, "bad_transition", "الحالة الحالية لا تسمح بهذا الإجراء");
      await db.run("UPDATE dg_orders SET state='delivered', delivered_at=? WHERE id=? AND state='ready'", ctx.nowS(), o.id); await markDelivered(ctx, o.tenant_id, o.order_ref, "manual"); return ok({ ok: true, state: "delivered" });
    });

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
    /** طلب جديد يحوي منتجاً رقمياً (ملف أو مفاتيح) ← يُسجَّل بانتظار الدفع. الطلبات العادية لا تُخزَّن هنا */
    "order.created": async (e, ctx) => {
      const d = e.data ?? {}, ref = String(d.order_id ?? "").slice(0, 80); if (!ref || !Array.isArray(d.items)) return; const items = [];
      for (const it of d.items.slice(0, 30)) { const sku = String(it?.id ?? "").slice(0, 80); if (!sku) continue;
        if (await ctx.db.val("SELECT 1 FROM dg_assets WHERE tenant_id=? AND sku=? AND active=1", e.tenantId, sku) || await ctx.db.val("SELECT 1 FROM dg_keys WHERE tenant_id=? AND sku=? LIMIT 1", e.tenantId, sku)) items.push({ sku, qty: Math.max(1, Math.min(50, Math.round(+it.qty) || 1)), title: String(it.title ?? "").slice(0, 120) }); }
      if (!items.length || !ctx.vault) return; const em = okEmail(d.customer?.email);
      await ctx.db.run("INSERT OR IGNORE INTO dg_orders (tenant_id,order_ref,items,name,email_enc,paid,state,created_at) VALUES (?,?,?,?,?,0,'awaiting',?)", e.tenantId, ref, JSON.stringify(items), String(d.customer?.name ?? "").slice(0, 80), em ? await ctx.vault.encrypt(em, `dgo:${e.tenantId}`) : null, ctx.nowS());
    },
    /** الدفع المؤكَّد (Chargily أو موافقة التاجر على دفع يدوي): طلب مسجَّل رقمياً ← تخصيص المفاتيح + روابط التنزيل + تسليم؛ وإلا المسار القديم بعناصر الحدث. */
    "payment.confirmed": async (e, ctx) => {
      const ref0 = String(e.data?.order_id ?? "").slice(0, 80), rec = ref0 ? await ctx.db.one("SELECT * FROM dg_orders WHERE tenant_id=? AND order_ref=?", e.tenantId, ref0) : null;
      if (rec) { await ctx.db.run("UPDATE dg_orders SET paid=1 WHERE id=?", rec.id); if (rec.state === "delivered" || rec.state === "ready") return;
        const tn = await ctx.db.one("SELECT * FROM pf_tenants WHERE id=?", e.tenantId); if (!tn) return; tn.settings = JSON.parse(tn.settings || "{}"); await deliver(ctx, tn, { ...rec, paid: 1 }); return; }
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
async function markDelivered(ctx, tid, ref, channel) {
  await ctx.emit(tid, "digital.delivered", { order_id: ref, channel }, `digital:del:${ref}`);
  await ctx.emit(tid, "order.delivered", { order_id: ref, source: "digital" }, `dg:${ref}`);          // بادئة dg: لا يولّدها /v1/events فلا ينتحلها تاجر
}
/** تخصيص المفاتيح والروابط لطلب مدفوع. الكل أو لا شيء لكل طلب؛ الإخفاق بنفاد المخزون ← state=short ويُعاد تلقائياً عند إضافة مفاتيح. يُرجع الحالة الجديدة */
async function deliver(ctx, tenant, o) {
  const { db } = ctx, tid = tenant.id, ref = o.order_ref, items = JSON.parse(o.items), claim = randHex(8), links = [], keyBlocks = [], created = [];
  const undo = async () => { await db.run("UPDATE dg_keys SET state='available', order_ref=NULL, claim=NULL, sold_at=NULL WHERE tenant_id=? AND claim=?", tid, claim); for (const id of created) await db.run("DELETE FROM dg_grants WHERE id=?", id); };
  let shortSku = null;
  try {
    for (const it of items) {
      const sku = it.sku, qty = Math.max(1, Math.min(50, it.qty | 0)), a = await db.one("SELECT * FROM dg_assets WHERE tenant_id=? AND sku=? AND active=1", tid, sku);
      if (a && !(await db.one("SELECT 1 FROM dg_grants WHERE tenant_id=? AND order_ref=? AND asset_id=?", tid, ref, a.id))) { const g = await issue(ctx, tenant, a, { orderRef: ref }); created.push(g.id); links.push({ url: g.url, name: a.name, h: g.expires_hours, n: g.max_downloads }); }
      if (await db.val("SELECT 1 FROM dg_keys WHERE tenant_id=? AND sku=? LIMIT 1", tid, sku)) {
        let mine = await db.all("SELECT id,secret_enc FROM dg_keys WHERE tenant_id=? AND sku=? AND order_ref=? ORDER BY id", tid, sku, ref);
        if (mine.length < qty) {
          await db.run("UPDATE dg_keys SET state='sold', order_ref=?, claim=?, sold_at=? WHERE id IN (SELECT id FROM dg_keys WHERE tenant_id=? AND sku=? AND state='available' ORDER BY id LIMIT ?)", ref, claim, ctx.nowS(), tid, sku, qty - mine.length);
          mine = await db.all("SELECT id,secret_enc FROM dg_keys WHERE tenant_id=? AND sku=? AND order_ref=? ORDER BY id", tid, sku, ref);
          if (mine.length < qty) { shortSku = sku; break; }
        }
        const values = []; for (const k of mine) values.push(await ctx.vault.decrypt(k.secret_enc, `dgk:${tid}`)); keyBlocks.push({ name: a?.name ?? it.title ?? sku, values });
      }
    }
    if (shortSku) {
      await undo(); await db.run("UPDATE dg_orders SET state='short', detail=? WHERE tenant_id=? AND order_ref=?", shortSku, tid, ref);
      await ctx.emit(tid, "digital.short", { order_id: ref, sku: shortSku }, `digital:short:${ref}:${shortSku}`); return "short";
    }
    let sent = false;
    if ((links.length || keyBlocks.length) && o.email_enc) {
      const email = await ctx.vault.decrypt(o.email_enc, `dgo:${tid}`), lang = tenant.settings?.lang;
      sent = await sendEmail(ctx, tid, { to: email, subject: (KTXT[lang] ?? KTXT.ar).subject, html: deliveryHtml(lang, o.name, links, keyBlocks) });
    }
    const state = sent ? "delivered" : "ready";
    await db.run("UPDATE dg_orders SET state=?, detail=NULL, delivered_at=? WHERE tenant_id=? AND order_ref=?", state, sent ? ctx.nowS() : null, tid, ref);
    if (sent) await markDelivered(ctx, tid, ref, "email"); else await ctx.emit(tid, "digital.ready", { order_id: ref }, `digital:ready:${ref}`);
    return state;
  } catch (x) { for (const id of created) await db.run("DELETE FROM dg_grants WHERE id=?", id); throw x; }       // المفاتيح المخصَّصة تبقى للطلب (إعادة المحاولة تجدها)، والروابط تُلغى لأنها لا تُسترد
}
/** بعد إضافة مفاتيح: يعيد تسليم الطلبات المدفوعة التي تعثّرت بنفاد المخزون (الأقدم أولاً) */
async function retryShort(ctx, tenant, sku) {
  let n = 0; for (const o of await ctx.db.all("SELECT * FROM dg_orders WHERE tenant_id=? AND state='short' AND paid=1 AND detail=? ORDER BY id LIMIT 20", tenant.id, sku)) { try { if ((await deliver(ctx, tenant, o)) !== "short") n++; else break; } catch { break; } }
  return n;
}
async function issue(ctx, tenant, a, { orderRef, email, hours, max }) {
  const cfg = { ...DEF, ...(tenant.settings.digital ?? {}) }, h = Math.min(24 * 30, Math.max(1, Math.floor(+hours) || cfg.expires_hours)), n = Math.min(20, Math.max(1, Math.floor(+max) || cfg.max_downloads));
  const token = randHex(32); let id;
  try { id = (await ctx.db.run("INSERT INTO dg_grants (tenant_id,asset_id,token_hash,order_ref,email_h,expires_at,max_downloads,downloads,created_at) VALUES (?,?,?,?,?,?,?,0,?)", tenant.id, a.id, await sha256Hex(token), orderRef, email ? await hmacHex(ctx.secret, "em:" + String(email).toLowerCase().trim()) : null, ctx.nowS() + h * 3600, n, nowStr(ctx.clock()))).id; }
  catch (e) { if (/UNIQUE|constraint/i.test(String(e.message))) throw new HttpError(409, "already_granted", "منحة هذا الطلب لهذا الملف موجودة سابقاً"); throw e; }
  return { id, url: `${ctx.baseUrl}/d/${token}`, expires_hours: h, max_downloads: n, note: "الرابط يظهر مرة واحدة" };
}
