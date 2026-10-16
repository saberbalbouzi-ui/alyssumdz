import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { hmacHex, localPhone, maskPhone, maskName, seesPii } from "../util.js";

const STATUSES = ["open", "contacted", "recovered", "dismissed"];
const DAY = 86400;
const cleanText = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
/** السلة المتروكة: الزبون كتب رقمه ولم يُكمل الطلب. تُلتقط من المتجر بمفتاح عام (بموافقة معروضة) ويستعيدها التاجر بالاتصال. */
export const carts = {
  id: "carts",
  routes(r, ctx) {
    const { db } = ctx;
    r.post("/v1/carts/capture", { scope: "cart:capture", limit: { key: "cart", max: 60, win: 60 }, summary: "التقاط سلة متروكة (يتطلب consent:true بعد إظهار إشعار للزبون)" }, async (req) => {
      const b = req.json(), phone = localPhone(b.phone); if (b.consent !== true) throw new HttpError(400, "consent_required", "الموافقة مطلوبة (consent:true) بعد إظهار إشعار الخصوصية للزبون");
      if (!phone) throw new HttpError(422, "invalid_phone", "رقم هاتف جزائري محمول غير صالح");
      if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط");
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20).map((i) => ({ id: cleanText(i?.id, 64), title: cleanText(i?.title, 120), qty: Math.min(99, Math.max(1, Math.floor(+i?.qty) || 1)), price: Math.max(0, Math.round(+i?.price) || 0) })).filter((i) => i.id || i.title);
      if (!items.length) throw new HttpError(400, "validation_error", "items مطلوبة", { items: "[{id,title,qty,price}]" });
      const total = Math.min(10_000_000, Math.max(0, Math.round(+b.total) || items.reduce((a, i) => a + i.price * i.qty, 0))), now = ctx.nowS(), ph = await hmacHex(ctx.secret, "cart:" + phone), tid = req.tenant.id;
      if (req.mode !== "live") return ok({ ok: true, sandbox: true });
      const ex = await db.one("SELECT id, status FROM cr_carts WHERE tenant_id=? AND phone_h=?", tid, ph);
      if (ex && ex.status === "recovered") return ok({ ok: true, skipped: "recovered" });      // أكمل الطلب سابقاً
      const enc = await ctx.vault.encrypt(phone, `cart:${tid}`);
      if (ex) await db.run("UPDATE cr_carts SET phone_enc=?, name=?, items=?, total=?, wilaya=?, page=?, status=CASE WHEN status='dismissed' THEN 'dismissed' ELSE status END, updated_at=? WHERE id=?", enc, cleanText(b.name, 80), JSON.stringify(items), total, cleanText(b.wilaya, 40), cleanText(b.page, 200), now, ex.id);
      else await db.run("INSERT INTO cr_carts (tenant_id,phone_h,phone_enc,name,items,total,wilaya,page,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", tid, ph, enc, cleanText(b.name, 80), JSON.stringify(items), total, cleanText(b.wilaya, 40), cleanText(b.page, 200), "open", now, now);
      return ok({ ok: true }, 201);
    });
    r.get("/v1/carts", { scope: "carts:read", summary: "السلال المتروكة (الأقدم من minAge دقيقة فقط، افتراضياً 15)" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, st = STATUSES.includes(req.query.status) ? req.query.status : "open", minAge = (req.query.minAge === undefined || req.query.minAge === "" || !Number.isFinite(+req.query.minAge) ? 15 : Math.min(1440, Math.max(0, Math.floor(+req.query.minAge)))) * 60;
      const a = [req.tenant.id, st, ctx.nowS() - minAge]; let q = "SELECT * FROM cr_carts WHERE tenant_id=? AND status=? AND updated_at<=?"; if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim);
      const out = []; for (const c of pg.items) out.push({ id: c.id, name: seesPii(req) ? c.name : maskName(c.name), phone: seesPii(req) ? await ctx.vault.decrypt(c.phone_enc, `cart:${req.tenant.id}`) : maskPhone(await ctx.vault.decrypt(c.phone_enc, `cart:${req.tenant.id}`)), items: JSON.parse(c.items), total: c.total, wilaya: c.wilaya, page: c.page, status: c.status, updated_at: c.updated_at, age_min: Math.floor((ctx.nowS() - c.updated_at) / 60) });
      return ok({ carts: out, next: pg.next });
    });
    r.patch("/v1/carts/:id", { scope: "carts:write", summary: "تغيير حالة سلة (contacted|recovered|dismissed|open)" }, async (req) => {
      const st = req.json().status; if (!STATUSES.includes(st)) throw new HttpError(400, "validation_error", "status: " + STATUSES.join("|"));
      const x = await db.run("UPDATE cr_carts SET status=?, updated_at=? WHERE id=? AND tenant_id=?", st, ctx.nowS(), +req.params.id, req.tenant.id); if (!x.changes) throw new HttpError(404, "not_found", "غير موجودة"); return ok({ ok: true });
    });
    r.get("/v1/carts/stats", { scope: "carts:read", summary: "أعداد السلال حسب الحالة ونسبة الاسترداد" }, async (req) => {
      const rows = await db.all("SELECT status, COUNT(*) n, COALESCE(SUM(total),0) v FROM cr_carts WHERE tenant_id=? GROUP BY status", req.tenant.id), by = Object.fromEntries(rows.map((x) => [x.status, { n: x.n, value: x.v }]));
      const all = rows.reduce((a, x) => a + x.n, 0); return ok({ by, total: all, recovery_rate: all ? +((by.recovered?.n ?? 0) / all).toFixed(3) : 0 });
    });
    r.delete("/v1/carts/phone/:phone", { scope: "carts:write", summary: "محو سلال رقم بطلب صاحبه" }, async (req) => { const p = localPhone(decodeURIComponent(req.params.phone)); if (!p) throw new HttpError(422, "invalid_phone", "رقم غير صالح"); const x = await db.run("DELETE FROM cr_carts WHERE tenant_id=? AND phone_h=?", req.tenant.id, await hmacHex(ctx.secret, "cart:" + p)); return ok({ ok: true, removed: x.changes }); });
  },
  on: {
    /** الطلب اكتمل: السلة المفتوحة/المتصل بها لهذا الرقم تصير «مستردّة» */
    "order.created": async (e, ctx) => {
      const p = localPhone(e.data?.customer?.phone); if (!p) return;
      await ctx.db.run("UPDATE cr_carts SET status='recovered', updated_at=? WHERE tenant_id=? AND phone_h=? AND status IN ('open','contacted')", ctx.nowS(), e.tenantId, await hmacHex(ctx.secret, "cart:" + p));
    },
  },
  async cron(ctx) { const x = await ctx.db.run("DELETE FROM cr_carts WHERE updated_at<?", ctx.nowS() - 30 * DAY); return { purgedCarts: x.changes }; },
};
