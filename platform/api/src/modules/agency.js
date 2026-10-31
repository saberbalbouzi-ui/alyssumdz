import { DB, HttpError, ok, paginate, clampLimit } from "../core.js";
import { escHtml, hmacHex, nowStr, safeEq, safeHttpsUrl } from "../util.js";

/** خدمات التسويق بعلامة بيضاء (White Label Agency): التاجر يشتري حساباً إعلانياً (TikTok/Meta…) بمحفظته بالدينار، والمنصة تُنشئ طلباً تلقائياً إلى الوكالة الشريكة.
 *  الدورة: pending (دُفع، الأموال في الضمان) ← processing (أُبلغت الوكالة) ← delivered (يُحرَّر الضمان لرسوم المنصة + رابط دعوة الحساب) | rejected (يُردّ الضمان للمتاح).
 *  الأموال لا تُلمس هنا: تستعمل الوحدة خدمة ctx.wallet (hold/release/refund) التي تسجّلها وحدة المحفظة. اسم الشريك وبياناته لا تظهر للتاجر أبداً. */
export const STATUSES = ["pending", "processing", "delivered", "rejected"];
export const KINDS = ["tiktok", "meta", "google", "snapchat", "other"];
/** الانتقالات المسموحة (نقية): من الحالة الحالية إلى المطلوبة */
export const NEXT = { pending: ["processing", "delivered", "rejected"], processing: ["delivered", "rejected"], delivered: [], rejected: [] };
export const canMove = (from, to) => (NEXT[from] ?? []).includes(to);
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,200}\.[A-Za-z]{2,24}$/;
const BACKOFF = [60, 300, 1800, 7200, 43200];
const AAD = "ag:partner";

/** تحقق نقي من نموذج الشراء. يُرجع { errors, value } */
export function validateOrder(b, svc) {
  const errors = {}, store = String(b?.store_name ?? "").trim(), email = String(b?.client_email ?? "").trim().toLowerCase(), page = String(b?.facebook_page_url ?? "").trim();
  if (store.length < 2 || store.length > 120) errors.store_name = "اسم المتجر 2–120 حرفاً";
  if (!EMAIL.test(email) || email.length > 254) errors.client_email = "بريد غير صالح";
  if (page && (!safeHttpsUrl(page) || page.length > 300)) errors.facebook_page_url = "رابط الصفحة يجب أن يكون https صالحاً";
  if (svc?.needs_page && !page) errors.facebook_page_url = "رابط الصفحة مطلوب لهذه الخدمة";
  return { errors, value: { store_name: store, client_email: email, facebook_page_url: page || null } };
}
/** الحمولة المرسلة للوكالة (JSON) */
export function partnerPayload(o, svc, baseUrl) {
  return { event: "agency.order", order_id: "AG-" + o.id, created_at: o.created_at, service: { code: svc?.code ?? null, name: o.service_name, kind: svc?.kind ?? null }, client: { store_name: o.store_name, email: o.client_email, facebook_page_url: o.facebook_page_url },
    price: o.price, currency: o.currency, callback_url: baseUrl ? baseUrl + "/v1/agency/partner/callback" : null };
}
export function partnerEmailHtml(p) {
  const row = (k, v) => `<tr><td style="padding:4px 10px;border:1px solid #ddd;background:#f6f6f6"><b>${escHtml(k)}</b></td><td style="padding:4px 10px;border:1px solid #ddd">${escHtml(v ?? "—")}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif"><h2>طلب حساب إعلاني جديد — ${escHtml(p.order_id)}</h2><table style="border-collapse:collapse">` + row("الخدمة", p.service.name) + row("اسم المتجر", p.client.store_name) + row("بريد الزبون", p.client.email) + row("صفحة فيسبوك", p.client.facebook_page_url) + row("السعر", `${p.price} ${p.currency}`) + row("التاريخ", p.created_at) +
    `</table><p>عند التسليم أرسل رابط دعوة الحساب إلى ${escHtml(p.callback_url || "الإدارة")} (status=delivered, invite_link=…).</p></div>`;
}
export const SLA_DEFAULT = 24;
/** متأخر: لم يُسلَّم/يُرفض بعد مرور مهلة الخدمة (ساعات). نقية. */
export const isLate = (o, nowMs, slaH = SLA_DEFAULT) => (o.status === "pending" || o.status === "processing") && nowMs - Date.parse(String(o.created_at).replace(" ", "T") + "Z") > slaH * 3600e3;
const pub = (o, late = false) => ({ late, id: o.id, ref: "AG-" + o.id, service_id: o.service_id, service: o.service_name, price: o.price, currency: o.currency, store_name: o.store_name, client_email: o.client_email, facebook_page_url: o.facebook_page_url, status: o.status,
  invite_link: o.status === "delivered" ? o.invite_link : null, note: o.status === "rejected" || o.status === "delivered" ? o.note || null : null, created_at: o.created_at, updated_at: o.updated_at, delivered_at: o.delivered_at });
const CLIENT_MAIL = (o, link) => `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>حسابك الإعلاني جاهز ✅</h2><p>الخدمة: <b>${escHtml(o.service_name)}</b><br>المتجر: <b>${escHtml(o.store_name)}</b></p><p>رابط دعوة الحساب الإعلاني:</p><p><a href="${escHtml(link)}">${escHtml(link)}</a></p><p style="color:#666">رقم الطلب AG-${o.id}</p></div>`;

export const agency = {
  id: "agency",
  routes(r, ctx) {
    const { db } = ctx;
    const needWallet = () => { if (!ctx.wallet) throw new HttpError(503, "wallet_unavailable", "المحفظة غير مفعّلة على الخادم"); return ctx.wallet; };
    const needVault = () => { if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط في الخادم"); return ctx.vault; };

    /* ── إعدادات الشريك (منصّة واحدة، مشفّرة) ── */
    async function partner() {
      const row = await db.one("SELECT config, secret_enc FROM agency_settings WHERE id=1"); if (!row) return { config: {}, secrets: {} };
      return { config: JSON.parse(row.config || "{}"), secrets: row.secret_enc && ctx.vault ? await ctx.vault.decryptJson(row.secret_enc, AAD) : {} };
    }
    const slaHours = async () => { const row = await db.one("SELECT config FROM agency_settings WHERE id=1"); const h = +(row ? JSON.parse(row.config || "{}").sla_hours : 0); return h >= 1 ? h : SLA_DEFAULT; };
    /** يرسل الطلب إلى الوكالة: webhook موقَّع و/أو بريد منظَّم (Resend). يُرجع { sent, channels, ref } أو { sent:false, reason } */
    async function notifyPartner(o) {
      const svc = await db.one("SELECT * FROM marketing_services WHERE id=?", o.service_id), { config: c, secrets: s } = await partner(), mode = c.notify || "webhook", payload = partnerPayload(o, svc, ctx.baseUrl), channels = []; let ref = null, last = "";
      const wantHook = (mode === "webhook" || mode === "both") && c.webhook_url, wantMail = (mode === "email" || mode === "both") && c.email_to && s.resend_key && c.email_from;
      if (!wantHook && !wantMail) return { sent: false, reason: "unconfigured" };
      if (wantHook) {
        try {
          if (!safeHttpsUrl(c.webhook_url)) throw new Error("insecure_url");
          if (!(await ctx.publicUrl(c.webhook_url))) throw new Error("private_destination");
          const body = JSON.stringify(payload), ts = ctx.nowS(), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
          const res = await ctx.fetchFn(c.webhook_url, { method: "POST", redirect: "manual", signal: ctl.signal, headers: { "Content-Type": "application/json", "X-Agency-Signature": `t=${ts},v1=${await hmacHex(s.webhook_secret || "", ts + "." + body)}`, "X-Agency-Event": "agency.order", "User-Agent": "alyssum-agency/1" }, body }); clearTimeout(t);
          if (res.status >= 200 && res.status < 300) { channels.push("webhook"); try { const j = JSON.parse(await res.text()); ref = String(j.partner_ref ?? j.reference ?? j.id ?? "").slice(0, 80) || null; } catch { /* الرد غير JSON: لا بأس */ } }
          else last = "webhook HTTP " + res.status;
        } catch (e) { last = "webhook " + String(e?.message || e).slice(0, 80); }
      }
      if (wantMail) {
        try {
          const res = await ctx.fetchFn("https://api.resend.com/emails", { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + s.resend_key, "Content-Type": "application/json" }, body: JSON.stringify({ from: c.email_from, to: [c.email_to], subject: `طلب حساب إعلاني ${payload.order_id} — ${payload.service.name}`, html: partnerEmailHtml(payload) }) });
          if (res.status >= 200 && res.status < 300) channels.push("email"); else last = (last ? last + "; " : "") + "email HTTP " + res.status;
        } catch (e) { last = (last ? last + "; " : "") + "email " + String(e?.message || e).slice(0, 60); }
      }
      return channels.length ? { sent: true, channels, ref } : { sent: false, reason: last || "failed" };
    }
    /** إبلاغ الشريك ثم نقل الحالة إلى processing. آمن للتكرار (حدث + محاولة فورية) */
    async function dispatch(id) {
      const o = await db.one("SELECT * FROM agency_orders WHERE id=?", id); if (!o || o.status !== "pending" || o.partner_state === "sent") return o;
      const claim = await db.run("UPDATE agency_orders SET partner_state='sending', updated_at=? WHERE id=? AND status='pending' AND (partner_state IN ('queued','failed','unconfigured') OR (partner_state='sending' AND updated_at<?))", ctx.nowS(), id, ctx.nowS() - 300); if (!claim.changes) return o;
      let res; try { res = await notifyPartner(o); } catch (e) { res = { sent: false, reason: String(e?.message || e).slice(0, 120) }; }
      if (res.sent) {
        await db.run("UPDATE agency_orders SET partner_state='sent', partner_ref=?, status='processing', partner_attempts=partner_attempts+1, last_error=NULL, updated_at=? WHERE id=?", res.ref, ctx.nowS(), id);
        await ctx.emit(o.tenant_id, "agency.order_processing", { order_id: "AG-" + id, service: o.service_name }, `ag:proc:${id}`);
        return db.one("SELECT * FROM agency_orders WHERE id=?", id);
      }
      await db.run("UPDATE agency_orders SET partner_state=?, partner_attempts=partner_attempts+1, last_error=?, updated_at=? WHERE id=?", res.reason === "unconfigured" ? "unconfigured" : "failed", res.reason, ctx.nowS(), id);
      if (res.reason !== "unconfigured") throw new Error("partner_notify_failed:" + res.reason);      // يُعاد الحدث بتباعد؛ غير المضبوط يبقى للإدارة (مراجعة يدوية)
      return db.one("SELECT * FROM agency_orders WHERE id=?", id);
    }
    ctx.agency = { dispatch };
    /** نقل حالة بالقواعد (للإدارة أو لرد الوكالة): يحجز الحالة أولاً ثم يقيّد المال (idempotent بالمرجع) وعند فشله يعيد الحالة */
    async function move(id, to, { invite_link = null, note = null, partner_ref = null } = {}) {
      const o = await db.one("SELECT * FROM agency_orders WHERE id=?", id); if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود");
      if (o.status === to) return { order: o, unchanged: true };
      if (!canMove(o.status, to)) throw new HttpError(409, "bad_transition", `لا يمكن الانتقال من ${o.status} إلى ${to}`);
      if (to === "delivered") { if (!invite_link || !safeHttpsUrl(invite_link) || invite_link.length > 500) throw new HttpError(400, "validation_error", "التسليم يتطلب رابط دعوة الحساب (https)", { invite_link: "https://…" }); }
      const now = ctx.nowS(), claim = await db.run("UPDATE agency_orders SET status=?, updated_at=? WHERE id=? AND status=?", to, now, id, o.status); if (!claim.changes) throw new HttpError(409, "bad_transition", "تغيّرت حالة الطلب للتو");
      try {
        if (to === "delivered") await needWallet().release(o.tenant_id, { ref: `svc:rel:${id}`, amount: o.price, memo: `${o.service_name} AG-${id}` });
        else if (to === "rejected") await needWallet().refund(o.tenant_id, { ref: `svc:ref:${id}`, amount: o.price, memo: `استرداد AG-${id}` });
      } catch (e) { await db.run("UPDATE agency_orders SET status=?, updated_at=? WHERE id=? AND status=?", o.status, ctx.nowS(), id, to); throw e; }
      await db.run("UPDATE agency_orders SET invite_link=COALESCE(?,invite_link), note=COALESCE(?,note), partner_ref=COALESCE(?,partner_ref), delivered_at=CASE WHEN ?='delivered' THEN ? ELSE delivered_at END WHERE id=?", invite_link, note ? String(note).slice(0, 500) : null, partner_ref, to, now, id);
      await ctx.emit(o.tenant_id, `agency.order_${to}`, { order_id: "AG-" + id, service: o.service_name, ...(to === "delivered" ? { invite_link } : {}), ...(to === "rejected" && note ? { note: String(note).slice(0, 200) } : {}) }, `ag:${to}:${id}`);
      if (to === "delivered") {          // بريد للزبون برابط الدعوة (اختياري، لا يفشل التسليم بسببه)
        try { const { config: c, secrets: sc } = await partner(); if (c.notify_client !== false && sc.resend_key && c.email_from) {
          const res = await ctx.fetchFn("https://api.resend.com/emails", { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + sc.resend_key, "Content-Type": "application/json" }, body: JSON.stringify({ from: c.email_from, to: [o.client_email], subject: `حسابك الإعلاني جاهز — ${o.service_name}`, html: CLIENT_MAIL(o, invite_link) }) });
          if (res.status >= 200 && res.status < 300) await ctx.emit(o.tenant_id, "agency.client_mailed", { order_id: "AG-" + id }, `ag:mail:${id}`);
        } } catch { /* البريد ثانوي */ }
      }
      return { order: await db.one("SELECT * FROM agency_orders WHERE id=?", id) };
    }

    /* ── واجهة التاجر ── */
    r.get("/v1/agency/services", { scope: "agency:read", summary: "خدمات التسويق المتاحة بأسعارها بالدينار" }, async () =>
      ok({ services: (await db.all("SELECT id,code,name,description,kind,price,needs_page FROM marketing_services WHERE active=1 ORDER BY sort,id")).map((s) => ({ ...s, needs_page: !!s.needs_page, currency: "DZD" })) }));
    r.post("/v1/agency/orders", { scope: "agency:write", idem: true, limit: { key: "agord", max: 20, win: 3600 }, summary: "شراء خدمة: { service_id, store_name, client_email, facebook_page_url? } — يُحجز السعر من المحفظة (ضمان) ويُرسل الطلب للوكالة" }, async (req) => {
      const b = req.json(), svc = await db.one("SELECT * FROM marketing_services WHERE id=? AND active=1", +b.service_id || 0); if (!svc) throw new HttpError(404, "not_found", "الخدمة غير متاحة");
      const { errors, value } = validateOrder(b, svc); if (Object.keys(errors).length) throw new HttpError(400, "validation_error", "تحقق من الحقول", errors);
      if (req.mode !== "live") return ok({ ok: true, sandbox: true, service: svc.name, price: svc.price }, 201);
      const wallet = needWallet(), now = ctx.nowS();
      const ins = await db.run("INSERT INTO agency_orders (tenant_id,service_id,service_name,price,currency,store_name,client_email,facebook_page_url,status,partner_state,partner_attempts,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)",
        req.tenant.id, svc.id, svc.name, svc.price, "DZD", value.store_name, value.client_email, value.facebook_page_url, "pending", "queued", nowStr(ctx.clock()), now);
      try { await wallet.hold(req.tenant.id, { ref: `svc:hold:${ins.id}`, amount: svc.price, memo: `${svc.name} AG-${ins.id}` }); }
      catch (e) { await db.run("DELETE FROM agency_orders WHERE id=?", ins.id); throw e; }      // الرصيد غير كافٍ ← لا أثر
      await ctx.emit(req.tenant.id, "agency.order_paid", { order_id: "AG-" + ins.id, id: ins.id, price: svc.price, service: svc.name }, `ag:paid:${ins.id}`);
      try { await dispatch(ins.id); } catch { /* الحدث يعيد المحاولة بتباعد */ }
      return ok({ order: pub(await db.one("SELECT * FROM agency_orders WHERE id=?", ins.id)) }, 201);
    });
    r.get("/v1/agency/orders", { scope: "agency:read", summary: "طلباتك (الأحدث أولاً) — رابط دعوة الحساب يظهر عند التسليم" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = [req.tenant.id]; let q = "SELECT * FROM agency_orders WHERE tenant_id=?";
      if (STATUSES.includes(req.query.status)) { q += " AND status=?"; a.push(req.query.status); } if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim), sla = await slaHours(), now = ctx.clock(); return ok({ orders: pg.items.map((o) => pub(o, isLate(o, now, sla))), sla_hours: sla, next: pg.next });
    });
    r.get("/v1/agency/orders/:id", { scope: "agency:read", summary: "طلب واحد" }, async (req) => {
      const o = await db.one("SELECT * FROM agency_orders WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود"); return ok({ order: pub(o, isLate(o, ctx.clock(), await slaHours())) });
    });

    /* ── رد الوكالة (API): موقَّع بنفس سرّ الـwebhook ── */
    r.post("/v1/agency/partner/callback", { auth: "public", summary: "رد الوكالة: { order_id, status: processing|delivered|rejected, invite_link?, note?, partner_ref? } بالتوقيع X-Agency-Signature" }, async (req) => {
      const w = await ctx.window("agcb:" + req.ip, 60, 60); if (w !== null) throw new HttpError(429, "rate_limited", "طلبات كثيرة", null, { "Retry-After": String(w) });
      const { secrets: s } = await partner(); if (!s.webhook_secret) throw new HttpError(401, "unauthorized", "غير مضبوط");
      const m = /^t=(\d{9,12}),v1=([0-9a-f]{64})$/.exec(String(req.headers["x-agency-signature"] ?? "")); if (!m || Math.abs(ctx.nowS() - +m[1]) > 300 || !safeEq(m[2], await hmacHex(s.webhook_secret, m[1] + "." + req.raw))) throw new HttpError(401, "unauthorized", "توقيع غير صالح");
      const b = req.json(), id = +String(b.order_id ?? "").replace(/^AG-/i, ""); if (!id || !["processing", "delivered", "rejected"].includes(b.status)) throw new HttpError(400, "validation_error", "order_id وstatus مطلوبان");
      const out = await move(id, b.status, { invite_link: b.invite_link ? String(b.invite_link) : null, note: b.note, partner_ref: b.partner_ref ? String(b.partner_ref).slice(0, 80) : null });
      return ok({ ok: true, status: out.order.status });
    });

    /* ── إدارة المزوّد (back-office) ── */
    const svcBody = (b, cur = {}) => {
      const code = String(b.code ?? cur.code ?? "").trim().toLowerCase(), name = String(b.name ?? cur.name ?? "").trim(), price = Math.round(+(b.price ?? cur.price)), kind = String(b.kind ?? cur.kind ?? "other");
      if (!/^[a-z0-9_-]{2,40}$/.test(code)) throw new HttpError(400, "validation_error", "code: حروف لاتينية صغيرة/أرقام/-_", { code: "مثال: tiktok-ads" });
      if (name.length < 2 || name.length > 120) throw new HttpError(400, "validation_error", "الاسم 2–120 حرفاً", { name: "مطلوب" });
      if (!Number.isSafeInteger(price) || price < 1 || price > 100_000_000) throw new HttpError(400, "validation_error", "السعر بالدينار (عدد صحيح موجب)", { price: "دج" });
      if (!KINDS.includes(kind)) throw new HttpError(400, "validation_error", "kind: " + KINDS.join("|"));
      return { code, name, price, kind, description: String(b.description ?? cur.description ?? "").slice(0, 600), needs_page: (b.needs_page ?? cur.needs_page) ? 1 : 0, active: (b.active ?? cur.active ?? 1) ? 1 : 0, sort: Math.max(0, Math.min(9999, Math.floor(+(b.sort ?? cur.sort ?? 100)) || 0)) };
    };
    r.get("/admin/agency/services", { auth: "admin", summary: "كل الخدمات (بما فيها المعطّلة)" }, async () => ok({ services: await db.all("SELECT * FROM marketing_services ORDER BY sort,id") }));
    r.post("/admin/agency/services", { auth: "admin", summary: "إضافة خدمة: { code, name, price (دج), kind, description?, needs_page?, sort? }" }, async (req) => {
      const v = svcBody(req.json());
      try { const x = await db.run("INSERT INTO marketing_services (code,name,description,kind,price,needs_page,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?)", v.code, v.name, v.description, v.kind, v.price, v.needs_page, v.active, v.sort, nowStr(ctx.clock())); await ctx.audit(req.actor, "agency.service_add", x.id, { code: v.code, price: v.price }); return ok({ id: x.id }, 201); }
      catch (e) { if (DB.isUnique(e)) throw new HttpError(409, "code_taken", "الكود مستعمل"); throw e; }
    });
    r.put("/admin/agency/services/:id", { auth: "admin", summary: "تعديل خدمة (السعر الجديد لا يمسّ الطلبات السابقة)" }, async (req) => {
      const cur = await db.one("SELECT * FROM marketing_services WHERE id=?", +req.params.id); if (!cur) throw new HttpError(404, "not_found", "الخدمة غير موجودة"); const v = svcBody(req.json(), cur);
      try { await db.run("UPDATE marketing_services SET code=?,name=?,description=?,kind=?,price=?,needs_page=?,active=?,sort=? WHERE id=?", v.code, v.name, v.description, v.kind, v.price, v.needs_page, v.active, v.sort, cur.id); }
      catch (e) { if (DB.isUnique(e)) throw new HttpError(409, "code_taken", "الكود مستعمل"); throw e; }
      await ctx.audit(req.actor, "agency.service_edit", cur.id, { price: v.price, active: v.active }); return ok({ ok: true });
    });
    r.get("/admin/agency/orders", { auth: "admin", summary: "كل الطلبات (?status=&after=) مع بيانات المتجر والتاجر وحالة إبلاغ الوكالة" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = []; let q = "SELECT o.*, t.name AS tenant_name FROM agency_orders o LEFT JOIN pf_tenants t ON t.id=o.tenant_id WHERE 1=1";
      if (STATUSES.includes(req.query.status)) { q += " AND o.status=?"; a.push(req.query.status); } if (after) { q += " AND o.id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY o.id DESC LIMIT ?", ...a, lim + 1), lim); const sla = await slaHours(), now = ctx.clock(); return ok({ orders: pg.items.map((o) => ({ ...o, late: isLate(o, now, sla) })), sla_hours: sla, next: pg.next });
    });
    r.patch("/admin/agency/orders/:id", { auth: "admin", summary: "تحديث الحالة: { status: processing|delivered|rejected, invite_link? (إلزامي عند delivered), note? } — delivered يحرّر الضمان، rejected يردّه للتاجر" }, async (req) => {
      const b = req.json(); if (!["processing", "delivered", "rejected"].includes(b.status)) throw new HttpError(400, "validation_error", "status: processing|delivered|rejected");
      const out = await move(+req.params.id, b.status, { invite_link: b.invite_link ? String(b.invite_link) : null, note: b.note }); await ctx.audit(req.actor, "agency.order_" + b.status, req.params.id, null); return ok({ order: out.order, unchanged: !!out.unchanged });
    });
    r.post("/admin/agency/orders/:id/resend", { auth: "admin", summary: "إعادة إبلاغ الوكالة بطلب لم يصل (أو بعد ضبط إعدادات الشريك)" }, async (req) => {
      const id = +req.params.id, o = await db.one("SELECT * FROM agency_orders WHERE id=?", id); if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود"); if (o.status !== "pending") throw new HttpError(409, "bad_transition", "الطلب ليس بانتظار الإبلاغ");
      await db.run("UPDATE agency_orders SET partner_state='queued' WHERE id=? AND partner_state IN ('failed','unconfigured')", id);
      try { const n = await dispatch(id); return ok({ order: n, sent: n.partner_state === "sent" }); } catch (e) { return ok({ sent: false, error: String(e.message).replace(/^partner_notify_failed:/, "") }); }
    });
    r.get("/admin/agency/partner", { auth: "admin", summary: "إعدادات الشريك (بلا أسرار)" }, async () => { const { config: c, secrets: s } = await partner(); return ok({ config: c, has_webhook_secret: !!s.webhook_secret, has_resend_key: !!s.resend_key }); });
    r.put("/admin/agency/partner", { auth: "admin", summary: "ضبط الشريك: { notify: webhook|email|both, webhook_url?, webhook_secret?, email_to?, email_from?, resend_key? } — الأسرار تُشفَّر ولا تُعرض" }, async (req) => {
      needVault(); const b = req.json(), cur = await partner(), notify = ["webhook", "email", "both"].includes(b.notify) ? b.notify : cur.config.notify || "webhook";
      const url = b.webhook_url === undefined ? cur.config.webhook_url ?? "" : String(b.webhook_url).trim(); if (url && (!safeHttpsUrl(url) || url.length > 300)) throw new HttpError(400, "validation_error", "webhook_url يجب أن يكون https صالحاً", { webhook_url: "https://…" });
      const to = b.email_to === undefined ? cur.config.email_to ?? "" : String(b.email_to).trim(), from = b.email_from === undefined ? cur.config.email_from ?? "" : String(b.email_from).trim();
      if (to && !EMAIL.test(to)) throw new HttpError(400, "validation_error", "email_to غير صالح", { email_to: "بريد" });
      const sec = { ...cur.secrets }; if (b.webhook_secret) sec.webhook_secret = String(b.webhook_secret).slice(0, 200); if (b.resend_key) sec.resend_key = String(b.resend_key).slice(0, 200);
      const sla = b.sla_hours === undefined ? cur.config.sla_hours ?? SLA_DEFAULT : Math.floor(+b.sla_hours); if (!(sla >= 1 && sla <= 720)) throw new HttpError(400, "validation_error", "sla_hours بين 1 و720", { sla_hours: "ساعات" });
      const config = { notify, webhook_url: url, email_to: to, email_from: from.slice(0, 200), sla_hours: sla, notify_client: b.notify_client === undefined ? cur.config.notify_client !== false : !!b.notify_client }, enc = await ctx.vault.encrypt(JSON.stringify(sec), AAD);
      await db.run("INSERT INTO agency_settings (id,config,secret_enc,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config, secret_enc=excluded.secret_enc, updated_at=excluded.updated_at", JSON.stringify(config), enc, ctx.nowS());
      const re = await db.run("UPDATE agency_orders SET partner_state='queued', partner_attempts=0 WHERE status='pending' AND partner_state='unconfigured'");   // طلبات انتظرت ضبط الشريك تُرسل الآن
      await ctx.audit(req.actor, "agency.partner_set", null, { notify, requeued: re.changes }); return ok({ ok: true, requeued: re.changes });
    });
  },
  /** cron: يعيد إبلاغ الوكالة بالطلبات المعلّقة بتباعد (لا يتجاوز 5 طلبات في النبضة). الفشل المؤقت يُعاد حتى ~7 محاولات ثم يبقى للإدارة (زر إعادة الإرسال) */
  async cron(ctx) {
    const rows = await ctx.db.all("SELECT id, partner_attempts, updated_at FROM agency_orders WHERE status='pending' AND (partner_state IN ('queued','failed') OR (partner_state='sending' AND updated_at<?)) ORDER BY id LIMIT 5", ctx.nowS() - 300); let sent = 0, failed = 0;
    for (const o of rows) {
      if (o.partner_attempts > 0 && ctx.nowS() < o.updated_at + (BACKOFF[Math.min(o.partner_attempts - 1, BACKOFF.length - 1)])) continue;
      if (o.partner_attempts > BACKOFF.length + 2) continue;
      try { const res = await ctx.agency.dispatch(o.id); if (res?.partner_state === "sent") sent++; } catch { failed++; }
    }
    return { sent, failed };
  },
};
