import { HttpError, ok } from "../core.js";
import { hmacHex, randHex, safeEq, safeHttpsUrl } from "../util.js";

/** Chargily Pay V2 (موثّق من dev.chargily.com): الاختبار https://pay.chargily.net/test/api/v2 والحيّ https://pay.chargily.net/api/v2،
 *  Authorization: Bearer <مفتاح سرّي>، التوقيع: ترويسة `signature` = HMAC-SHA256(المفتاح السرّي، الجسم الخام) hex. */
export const CHARGILY = { test: "https://pay.chargily.net/test/api/v2", live: "https://pay.chargily.net/api/v2" };
const METHODS = ["edahabia", "cib", "chargily_app"], LOCALES = ["ar", "fr", "en"];
const EVENT = { "checkout.paid": ["paid", "payment.confirmed"], "checkout.failed": ["failed", "payment.failed"], "checkout.canceled": ["canceled", "payment.cancelled"] };

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
      const integ = await ctx.integration(req.tenant.id, "chargily"); if (!integ?.secrets.secret_key) throw new HttpError(409, "integration_missing", "فعّل تكامل chargily (secrets.secret_key) أولاً");
      const mode = integ.config.mode === "live" ? "live" : "test";
      const ex = await db.one("SELECT ext_id,url,status,amount FROM pay_checkouts WHERE tenant_id=? AND order_id=? AND provider='chargily' ORDER BY id DESC", req.tenant.id, orderId);
      if (ex?.status === "paid") throw new HttpError(409, "already_paid", "الطلب مدفوع سابقاً");
      if (ex && ex.status === "pending" && ex.amount === amount && ex.url) return ok({ id: ex.ext_id, status: "pending", checkout_url: ex.url, reused: true });
      let hook = await db.val("SELECT hook_id FROM pay_hooks WHERE tenant_id=?", req.tenant.id);
      if (!hook) { hook = randHex(12); await db.run("INSERT INTO pay_hooks (tenant_id,hook_id) VALUES (?,?)", req.tenant.id, hook); }
      const body = { amount, currency: "dzd", payment_method: method, locale, success_url: b.success_url, webhook_endpoint: `${ctx.baseUrl}/v1/payments/hook/${hook}`, metadata: { order_id: orderId } };
      if (b.failure_url) body.failure_url = b.failure_url; if (b.description) body.description = String(b.description).slice(0, 200);
      let res; try { res = await ctx.fetchFn(CHARGILY[mode] + "/checkouts", { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + integ.secrets.secret_key, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      catch { throw new HttpError(502, "provider_unreachable", "تعذّر الاتصال بمزوّد الدفع"); }
      let j = {}; try { j = JSON.parse(await res.text()); } catch { }
      if (res.status < 200 || res.status >= 300 || !j.id || !safeHttpsUrl(j.checkout_url)) throw new HttpError(502, "provider_rejected", "رفض مزوّد الدفع الطلب (HTTP " + res.status + ")");
      const now = ctx.nowS(); await db.run("INSERT INTO pay_checkouts (tenant_id,order_id,provider,ext_id,status,amount,currency,url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", req.tenant.id, orderId, "chargily", String(j.id), "pending", amount, "dzd", j.checkout_url, now, now);
      return ok({ id: j.id, status: "pending", checkout_url: j.checkout_url, ...(j.qr_code_url ? { qr_code_url: j.qr_code_url } : {}) }, 201);
    });
    r.get("/v1/payments/checkouts/:order", { scope: "payments:read", summary: "حالة جلسات الدفع لطلب" }, async (req) => {
      const rows = await db.all("SELECT ext_id,status,amount,currency,url,created_at,updated_at FROM pay_checkouts WHERE tenant_id=? AND order_id=? ORDER BY id DESC LIMIT 10", req.tenant.id, req.params.order);
      return ok({ order_id: req.params.order, paid: rows.some((x) => x.status === "paid"), checkouts: rows.map((x) => ({ id: x.ext_id, status: x.status, amount: x.amount, currency: x.currency, url: x.url, updated_at: x.updated_at })) });
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
      return ok({ ok: true, event: m[1], duplicate: !fresh });
    });
  },
};
