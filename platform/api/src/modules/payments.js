import { HttpError, ok } from "../core.js";
import { hmacHex, parseProof, randHex, safeEq, safeHttpsUrl, strictCfg } from "../util.js";

const MANUAL_METHODS = ["baridimob", "ccp"];
export { parseProof };

/** Chargily Pay V2 (موثّق من dev.chargily.com): الاختبار https://pay.chargily.net/test/api/v2 والحيّ https://pay.chargily.net/api/v2،
 *  Authorization: Bearer <مفتاح سرّي>، التوقيع: ترويسة `signature` = HMAC-SHA256(المفتاح السرّي، الجسم الخام) hex. */
export const CHARGILY = { test: "https://pay.chargily.net/test/api/v2", live: "https://pay.chargily.net/api/v2" };
const METHODS = ["edahabia", "cib", "chargily_app"], LOCALES = ["ar", "fr", "en"];
const EVENT = { "checkout.paid": ["paid", "payment.confirmed"], "checkout.failed": ["failed", "payment.failed"], "checkout.canceled": ["canceled", "payment.cancelled"] };

/** إنشاء جلسة دفع Chargily (مشتركة بين المسار الخادمي والمسار العام الذي يأخذ المبلغ من الطلب الموثَّق) */
async function createCheckout(ctx, tenant, a) {
  const { orderId, amount, method, locale } = a, { db } = ctx;
  const integ = await ctx.integration(tenant.id, "chargily"); if (!integ?.secrets.secret_key) throw new HttpError(409, "integration_missing", "فعّل تكامل chargily (secrets.secret_key) أولاً");
  const mode = integ.config.mode === "live" ? "live" : "test";
  const ex = await db.one("SELECT ext_id,url,status,amount FROM pay_checkouts WHERE tenant_id=? AND order_id=? AND provider='chargily' ORDER BY id DESC", tenant.id, orderId);
  if (ex?.status === "paid") throw new HttpError(409, "already_paid", "الطلب مدفوع سابقاً");
  if (ex && ex.status === "pending" && ex.amount === amount && ex.url) return ok({ id: ex.ext_id, status: "pending", checkout_url: ex.url, reused: true });
  let hook = await db.val("SELECT hook_id FROM pay_hooks WHERE tenant_id=?", tenant.id);
  if (!hook) { hook = randHex(12); await db.run("INSERT INTO pay_hooks (tenant_id,hook_id) VALUES (?,?)", tenant.id, hook); }
  const body = { amount, currency: "dzd", payment_method: method, locale, success_url: a.success_url, webhook_endpoint: `${ctx.baseUrl}/v1/payments/hook/${hook}`, metadata: { order_id: orderId } };
  if (a.failure_url) body.failure_url = a.failure_url; if (a.description) body.description = String(a.description).slice(0, 200);
  let res; try { res = await ctx.fetchFn(CHARGILY[mode] + "/checkouts", { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + integ.secrets.secret_key, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new HttpError(502, "provider_unreachable", "تعذّر الاتصال بمزوّد الدفع"); }
  let j = {}; try { j = JSON.parse(await res.text()); } catch { }
  if (res.status < 200 || res.status >= 300 || !j.id || !safeHttpsUrl(j.checkout_url)) throw new HttpError(502, "provider_rejected", "رفض مزوّد الدفع الطلب (HTTP " + res.status + ")");
  const now = ctx.nowS(); await db.run("INSERT INTO pay_checkouts (tenant_id,order_id,provider,ext_id,status,amount,currency,url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", tenant.id, orderId, "chargily", String(j.id), "pending", amount, "dzd", j.checkout_url, now, now);
  return ok({ id: j.id, status: "pending", checkout_url: j.checkout_url, ...(j.qr_code_url ? { qr_code_url: j.qr_code_url } : {}) }, 201);
}
export const payments = {
  id: "payments", providers: ["chargily"],
  routes(r, ctx) {
    const { db } = ctx;
    r.post("/v1/payments/setup", { scope: "integrations:write", summary: "إنشاء/عرض رابط استقبال إشعارات الدفع (يُمرَّر تلقائياً لكل جلسة دفع؛ يمكن وضعه في لوحة Chargily أيضاً)" }, async (req) => {
      let h = await db.val("SELECT hook_id FROM pay_hooks WHERE tenant_id=?", req.tenant.id);
      if (!h) { h = randHex(12); await db.run("INSERT INTO pay_hooks (tenant_id,hook_id) VALUES (?,?)", req.tenant.id, h); }
      return ok({ webhook_url: `${ctx.baseUrl}/v1/payments/hook/${h}` });
    });
    r.post("/v1/payments/checkouts", { scope: "payments:write", idem: true, limit: { key: "pay", max: 60, win: 60 }, summary: "إنشاء رابط دفع إلكتروني لطلب (المبلغ بالدينار صحيحاً) — يُعاد الرابط نفسه إن وُجدت جلسة معلّقة بالمبلغ ذاته" }, async (req) => {
      const b = req.json(), orderId = String(b.order_id ?? "").slice(0, 80), amount = Math.round(+b.amount);
      if (!/^[A-Za-z0-9._:-]{1,80}$/.test(orderId)) throw new HttpError(400, "validation_error", "order_id غير صالح");
      if (!Number.isFinite(amount) || amount < 1 || amount > 10_000_000) throw new HttpError(400, "validation_error", "amount بالدينار (عدد صحيح موجب)");
      if (!safeHttpsUrl(b.success_url)) throw new HttpError(400, "validation_error", "success_url يجب أن يكون https صالحاً");
      if (b.failure_url != null && !safeHttpsUrl(b.failure_url)) throw new HttpError(400, "validation_error", "failure_url يجب أن يكون https صالحاً");
      const method = b.payment_method ?? "edahabia", locale = b.locale ?? "ar"; if (!METHODS.includes(method)) throw new HttpError(400, "validation_error", "payment_method: " + METHODS.join("|")); if (!LOCALES.includes(locale)) throw new HttpError(400, "validation_error", "locale: ar|fr|en");
      if (req.mode !== "live") return ok({ id: "sandbox", status: "pending", checkout_url: "https://pay.chargily.dz/test/sandbox/pay", sandbox: true }, 201);
      return createCheckout(ctx, req.tenant, { orderId, amount, method, locale, success_url: b.success_url, failure_url: b.failure_url, description: b.description });
    });
    r.get("/v1/payments/checkouts/:order", { scope: "payments:read", summary: "حالة جلسات الدفع لطلب" }, async (req) => {
      const rows = await db.all("SELECT ext_id,status,amount,currency,url,created_at,updated_at FROM pay_checkouts WHERE tenant_id=? AND order_id=? ORDER BY id DESC LIMIT 10", req.tenant.id, req.params.order);
      return ok({ order_id: req.params.order, paid: rows.some((x) => x.status === "paid"), checkouts: rows.map((x) => ({ id: x.ext_id, status: x.status, amount: x.amount, currency: x.currency, url: x.url, updated_at: x.updated_at })) });
    });

    /* ───── الدفع اليدوي (BaridiMob / CCP) والدفع الإلكتروني من المتجر: المبلغ يؤخذ دائماً من الطلب الموثَّق في الخادم لا من الزبون ───── */
    const expect = async (tid, oid) => db.one("SELECT amount, method, verified FROM pay_expect WHERE tenant_id=? AND order_id=?", tid, oid);
    const paidAlready = async (tid, oid) => !!(await db.val("SELECT 1 FROM pay_checkouts WHERE tenant_id=? AND order_id=? AND status='paid' LIMIT 1", tid, oid)) || !!(await db.val("SELECT 1 FROM pay_manual WHERE tenant_id=? AND order_id=? AND state='approved' LIMIT 1", tid, oid));
    r.post("/v1/payments/proof", { scope: "payment:proof", limit: { key: "payproof", max: 60, win: 600 }, summary: "(مفتاح عام) رفع إثبات دفع BaridiMob/CCP لطلب سجّله المتجر: { order_id, method, proof: data URL صورة ≤ ~170KB, payer }" }, async (req) => {
      const w = await ctx.window("pp:" + req.ip, 10, 600); if (w !== null) throw new HttpError(429, "rate_limited", "طلبات كثيرة", null, { "Retry-After": String(w) });
      const b = req.json(), oid = String(b.order_id ?? "").slice(0, 80), method = String(b.method ?? ""); if (!/^[A-Za-z0-9._:-]{6,80}$/.test(oid) || !MANUAL_METHODS.includes(method)) throw new HttpError(400, "validation_error", "order_id/method غير صالحين");
      const proof = parseProof(b.proof); if (!proof) throw new HttpError(400, "validation_error", "الإثبات صورة JPEG/PNG/WebP أقل من ~170KB");
      const ex = await expect(req.tenant.id, oid); if (!ex) throw new HttpError(404, "order_not_found", "الطلب غير موجود أو لا ينتظر دفعاً");
      if (strictCfg(req.tenant.settings).reject && ex.verified !== 2) throw new HttpError(409, "amount_unverified", "تعذّر التحقق من مبلغ هذا الطلب في الخادم، تواصل مع المتجر");     // التحقق الصارم: لا إثبات إلا لمبلغ حسبه الخادم
      if (await paidAlready(req.tenant.id, oid)) throw new HttpError(409, "already_paid", "الطلب مدفوع سابقاً");
      if ((await db.val("SELECT COUNT(*) FROM pay_manual WHERE tenant_id=? AND order_id=?", req.tenant.id, oid)) >= 4) throw new HttpError(429, "too_many_proofs", "تجاوزت عدد المحاولات، تواصل مع المتجر");
      await db.run("UPDATE pay_manual SET state='superseded' WHERE tenant_id=? AND order_id=? AND state='pending'", req.tenant.id, oid);
      const now = ctx.nowS(), x = await db.run("INSERT INTO pay_manual (tenant_id,order_id,method,amount,proof,payer,state,created_at) VALUES (?,?,?,?,?,?,'pending',?)", req.tenant.id, oid, method, ex.amount, proof, String(b.payer ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 60), now);
      await ctx.emit(req.tenant.id, "payment.proof_submitted", { order_id: oid, method, amount: ex.amount, proof_id: x.id }, `payproof:${x.id}`);
      return ok({ ok: true, id: x.id, status: "pending" }, 201);
    });
    r.post("/v1/payments/pay", { scope: "payment:init", limit: { key: "payinit", max: 120, win: 600 }, summary: "(مفتاح عام) بدء دفع إلكتروني Chargily لطلب موثَّق في الخادم؛ المبلغ من الطلب لا من الزبون. { order_id, method: edahabia|cib, locale, return_url (من أصول الموقع) }" }, async (req) => {
      const w = await ctx.window("pi:" + req.ip, 20, 600); if (w !== null) throw new HttpError(429, "rate_limited", "طلبات كثيرة", null, { "Retry-After": String(w) });
      const b = req.json(), oid = String(b.order_id ?? "").slice(0, 80), method = b.method ?? "edahabia", locale = b.locale ?? "ar"; if (!/^[A-Za-z0-9._:-]{6,80}$/.test(oid)) throw new HttpError(400, "validation_error", "order_id غير صالح");
      if (!METHODS.includes(method) || !LOCALES.includes(locale)) throw new HttpError(400, "validation_error", "method/locale غير صالحين");
      let ru; try { ru = new URL(String(b.return_url ?? "")); } catch { throw new HttpError(400, "validation_error", "return_url غير صالح"); }
      if (ru.protocol !== "https:" || !(req.tenant.settings.origins ?? []).includes(ru.origin)) throw new HttpError(400, "validation_error", "return_url يجب أن يكون من أصول موقعك");
      if (req.mode !== "live") return ok({ id: "sandbox", status: "pending", checkout_url: "https://pay.chargily.dz/test/sandbox/pay", sandbox: true }, 201);
      const ex = await expect(req.tenant.id, oid); if (!ex || !ex.verified || (strictCfg(req.tenant.settings).reject && ex.verified !== 2)) throw new HttpError(404, "order_not_found", "الطلب غير موجود أو لم يُتحقق منه، تواصل مع المتجر");
      if (await paidAlready(req.tenant.id, oid)) throw new HttpError(409, "already_paid", "الطلب مدفوع سابقاً");
      const u = (st) => { const x = new URL(ru.href); x.searchParams.set("pay", st); x.searchParams.set("order", oid); return x.href; };
      return createCheckout(ctx, req.tenant, { orderId: oid, amount: ex.amount, method, locale, success_url: u("ok"), failure_url: u("fail") });
    });
    r.get("/v1/payments/manual", { scope: "payments:read", summary: "إثباتات الدفع اليدوي (?state=pending|approved|rejected) — بلا الصورة" }, async (req) => {
      const lim = Math.min(100, Math.max(1, +req.query.limit || 50)), a = [req.tenant.id]; let q = "SELECT id,order_id,method,amount,payer,state,note,created_at,decided_at,(proof IS NOT NULL) has_proof FROM pay_manual WHERE tenant_id=?";
      if (["pending", "approved", "rejected"].includes(req.query.state)) { q += " AND state=?"; a.push(req.query.state); } else q += " AND state<>'superseded'";
      return ok({ proofs: (await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim)).map((x) => ({ id: x.id, order_id: x.order_id, method: x.method, amount: x.amount, payer: x.payer, state: x.state, note: x.note, has_proof: !!x.has_proof, created_at: x.created_at, decided_at: x.decided_at })) });
    });
    r.get("/v1/payments/manual/:id/proof", { scope: "payments:read", summary: "صورة إثبات دفع (data URL)" }, async (req) => {
      const x = await db.one("SELECT proof FROM pay_manual WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!x?.proof) throw new HttpError(404, "not_found", "لا صورة");
      return { status: 200, headers: { "Cache-Control": "private, no-store" }, body: JSON.stringify({ proof: x.proof }) };
    });
    const approve = async (req, row) => {
      if (await paidAlready(req.tenant.id, row.order_id)) throw new HttpError(409, "already_paid", "الطلب مدفوع سابقاً");
      await db.run("UPDATE pay_manual SET state='approved', decided_at=?, decided_by=? WHERE id=? AND state IN ('pending','new')", ctx.nowS(), req.actor ?? "merchant", row.id);
      await ctx.emit(req.tenant.id, "payment.confirmed", { order_id: row.order_id, amount: row.amount, currency: "DZD", provider: "manual", method: row.method }, `manual:${row.id}`);
      try { await ctx.flush(req.tenant.id, `manual:${row.id}`); } catch { /* يُعاد في نبضة cron */ }   // التسليم الرقمي فور الموافقة
      // «manual:» غير موثوقة لدى المحفظة: المال لم يمرّ بالمنصة فلا ضمان
      return ok({ ok: true, order_id: row.order_id, amount: row.amount });
    };
    r.post("/v1/payments/manual/:id/approve", { scope: "payments:write", limit: { key: "payappr", max: 300, win: 3600 }, summary: "موافقة التاجر على إثبات دفع بعد تحققه من حسابه ← payment.confirmed فيُسلَّم المنتج الرقمي فوراً" }, async (req) => {
      const x = await db.one("SELECT * FROM pay_manual WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!x) throw new HttpError(404, "not_found", "غير موجود");
      if (x.state !== "pending") throw new HttpError(409, "bad_transition", "الإثبات لم يعد معلّقاً"); return approve(req, x);
    });
    r.post("/v1/payments/manual/:id/reject", { scope: "payments:write", summary: "رفض إثبات دفع بسبب (يظهر للتاجر فقط): { note }" }, async (req) => {
      const x = await db.one("SELECT * FROM pay_manual WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!x) throw new HttpError(404, "not_found", "غير موجود"); if (x.state !== "pending") throw new HttpError(409, "bad_transition", "الإثبات لم يعد معلّقاً");
      await db.run("UPDATE pay_manual SET state='rejected', note=?, decided_at=?, decided_by=? WHERE id=?", String(req.json().note ?? "").replace(/<[^>]*>/g, "").slice(0, 200), ctx.nowS(), req.actor ?? "merchant", x.id);
      await ctx.emit(req.tenant.id, "payment.failed", { order_id: x.order_id, provider: "manual", reason: "rejected" }, `manual:${x.id}:rej`); return ok({ ok: true });
    });
    r.post("/v1/payments/manual/orders/:order/approve", { scope: "payments:write", limit: { key: "payappr", max: 300, win: 3600 }, summary: "موافقة مباشرة على دفع طلب بلا صورة (وصلك التحويل بوسيلة أخرى كواتساب). المبلغ المسجَّل للطلب، وإلا { amount }" }, async (req) => {
      const oid = String(req.params.order).slice(0, 80), ex = await expect(req.tenant.id, oid), amount = ex ? ex.amount : Math.round(+req.json().amount);
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10_000_000) throw new HttpError(404, "order_not_found", "الطلب غير معروف للمنصة؛ مرّر amount صحيحاً");
      if (await paidAlready(req.tenant.id, oid)) throw new HttpError(409, "already_paid", "الطلب مدفوع سابقاً");
      const x = await db.run("INSERT INTO pay_manual (tenant_id,order_id,method,amount,proof,payer,state,created_at) VALUES (?,?,?,?,NULL,'','new',?)", req.tenant.id, oid, MANUAL_METHODS.includes(ex?.method) ? ex.method : "baridimob", amount, ctx.nowS());
      return approve(req, { id: x.id, order_id: oid, amount, method: MANUAL_METHODS.includes(ex?.method) ? ex.method : "baridimob" });
    });
    // إشعار المزوّد: التوقيع إلزامي على الجسم الخام بالمفتاح السرّي للمستأجر
    r.post("/v1/payments/hook/:hook", { auth: "public", limit: { key: "payhook", max: 300, win: 60 }, summary: "إشعارات Chargily (checkout.paid|failed|canceled)" }, async (req) => {
      const row = await db.one("SELECT tenant_id FROM pay_hooks WHERE hook_id=?", req.params.hook), integ = row ? await ctx.integration(row.tenant_id, "chargily") : null;
      if (!integ?.secrets.secret_key) throw new HttpError(401, "unauthorized", "غير مضبوط");
      const sig = req.headers["signature"]; if (!sig) throw new HttpError(400, "bad_request", "ترويسة signature مفقودة");
      if (!safeEq(String(sig), await hmacHex(integ.secrets.secret_key, req.raw))) throw new HttpError(403, "forbidden", "توقيع غير صالح");
      const ev = req.json(), m = EVENT[ev.type]; if (!m || !ev.data?.id) return ok({ ok: true, ignored: true });
      const co = await db.one("SELECT id,order_id,amount,status FROM pay_checkouts WHERE tenant_id=? AND provider='chargily' AND ext_id=?", row.tenant_id, String(ev.data.id));
      if (!co) return ok({ ok: true, ignored: "unknown_checkout" });
      if (co.status === "paid") return ok({ ok: true, duplicate: true });       // المدفوع نهائي
      if (m[0] === "paid" && Math.round(+ev.data.amount) !== co.amount) { await ctx.emit(row.tenant_id, "payment.mismatch", { order_id: co.order_id, expected: co.amount, received: Math.round(+ev.data.amount) || 0, provider: "chargily" }, `chargily:${ev.id ?? ev.data.id}:mismatch`); return ok({ ok: true, mismatch: true }); }
      await db.run("UPDATE pay_checkouts SET status=?, updated_at=? WHERE id=?", m[0], ctx.nowS(), co.id);
      const fresh = await ctx.emit(row.tenant_id, m[1], { order_id: co.order_id, amount: co.amount, currency: "DZD", provider: "chargily", checkout_id: String(ev.data.id) }, `chargily:${ev.id ?? ev.data.id}:${m[0]}`);
      if (fresh && m[0] === "paid") { try { await ctx.flush(row.tenant_id, `chargily:${ev.id ?? ev.data.id}:${m[0]}`); } catch { /* cron */ } }
      return ok({ ok: true, event: m[1], duplicate: !fresh });
    });
  },
  on: {
    /** يسجّل المبلغ الموثَّق للطلبات غير الدفع-عند-الاستلام: أساس المسار العام للدفع الإلكتروني ولموافقة التاجر اليدوية */
    "order.created": async (e, ctx) => {
      const d = e.data ?? {}, oid = String(d.order_id ?? "").slice(0, 80), amount = Math.round(+d.total), pay = d.pay; if (!oid || !["baridimob", "ccp", "chargily"].includes(pay) || !Number.isSafeInteger(amount) || amount < 1 || amount > 10_000_000) return;
      /* verified: 0 غير متحقَّق، 1 تحقق مخفَّف (وضع المراقبة)، 2 مجموع حسبه الخادم نفسه (توقيع HMAC لا يستطيع تزويره عميل أو تاجر عبر /v1/events) */
      const lvl = typeof d.ts === "string" && safeEq(d.ts, await hmacHex(ctx.secret, `trust:${e.tenantId}:${oid}:${amount}`)) ? 2 : d.verified === true ? 1 : 0;
      await ctx.db.run("INSERT OR IGNORE INTO pay_expect (tenant_id,order_id,amount,method,verified,created_at) VALUES (?,?,?,?,?,?)", e.tenantId, oid, amount, pay, lvl, ctx.nowS());
    },
  },
};
