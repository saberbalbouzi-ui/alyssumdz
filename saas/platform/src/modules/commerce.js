import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { localPhone, hmacHex } from "../util.js";

/** التجارة: كتالوج + مخزون + طلبات بتحقق خادمي. الوضع observe (افتراضي): يقبل ويسجّل العلامات بلا حجز؛ enforce: يرفض المخالف ويحجز المخزون ذرّياً.
 *  الضبط في settings المستأجر: order_mode = observe|enforce، max_fee (افتراضي 3000). */
const clean = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const int = (v, d = 0) => { const n = Math.round(+v); return Number.isFinite(n) ? n : d; };
const FATAL = ["price_mismatch", "subtotal_mismatch", "total_mismatch", "unknown_product", "inactive", "coupon_mismatch", "fee_out_of_range", "discount_unverified", "qty_invalid"];

/** وحدات السعر المسموحة لسطر: سعر الـSKU وسعر الوحدة في كل عرض (يُضرب بنسبة التنويع إن وُجدت). */
export function allowedUnits(sku, base, offers) {
  const u = new Set([sku.price]); const ratio = base && sku.vkey !== "" && base.price > 0 ? sku.price / base.price : 1;
  for (const o of offers ?? []) if (o.qty > 0 && o.price > 0) u.add(Math.round((o.price / o.qty) * ratio * 100) / 100);
  return [...u];
}
/** تحقق نقي من حمولة طلب مقابل الكتالوج. */
export function verifyOrder({ lines, skus, offers, subtotal, discount, fee, total, coupon, couponRow, maxFee = 3000, now = 0 }) {
  const flags = [], out = []; let sum = 0;
  for (const l of lines) {
    if (!(l.qty >= 1 && l.qty <= 999)) { flags.push("qty_invalid:" + l.slug); continue; }
    const sku = skus[l.slug + "\u0000" + l.vkey]; if (!sku) { flags.push("unknown_product:" + l.slug); continue; }
    if (!sku.active || sku.pActive === 0) flags.push("inactive:" + l.slug);
    const base = skus[l.slug + "\u0000"], units = allowedUnits(sku, base, offers[l.slug]);
    const near = units.find((x) => Math.abs(x - l.unit) <= 1);
    if (near === undefined) flags.push("price_mismatch:" + l.slug);
    const unit = near ?? sku.price; sum += Math.round(unit * l.qty); out.push({ ...l, unit, sku });
  }
  if (Math.abs(sum - subtotal) > 1 + lines.length) flags.push("subtotal_mismatch");
  if (discount > 0) {
    if (!coupon || !couponRow) flags.push("discount_unverified");
    else if (!couponRow.active || (couponRow.from_at && now < couponRow.from_at) || (couponRow.to_at && now > couponRow.to_at) || sum < couponRow.min) flags.push("coupon_mismatch");
    else { const exp = couponRow.type === "percent" ? Math.round((sum * couponRow.value) / 100) : couponRow.type === "fixed" ? Math.min(couponRow.value, sum) : 0; if (discount > exp + 1) flags.push("coupon_mismatch"); }
  } else if (coupon && couponRow?.type === "freeship" && fee > 0 && couponRow.active) { /* كود توصيل مجاني لم يُطبَّق: لصالح التاجر فلا علامة */ }
  if (fee < 0 || fee > maxFee) flags.push("fee_out_of_range");
  if (Math.abs(total - (subtotal - discount + fee)) > 1) flags.push("total_mismatch");
  return { flags, lines: out, serverSubtotal: sum };
}

export const commerce = {
  id: "commerce",
  routes(r, ctx) {
    const { db } = ctx;
    const loadSkus = async (tid, slugs) => {
      const skus = {}, offers = {}; if (!slugs.length) return { skus, offers };
      const ph = slugs.map(() => "?").join(",");
      for (const s of await db.all(`SELECT k.slug,k.vkey,k.label,k.price,k.stock,k.active,p.active AS pa,p.title AS pt FROM cm_skus k JOIN cm_products p ON p.tenant_id=k.tenant_id AND p.slug=k.slug WHERE k.tenant_id=? AND k.slug IN (${ph})`, tid, ...slugs)) skus[s.slug + "\u0000" + s.vkey] = { slug: s.slug, vkey: s.vkey, label: s.label, price: s.price, stock: s.stock, active: !!s.active, pActive: s.pa, ptitle: s.pt };
      for (const o of await db.all(`SELECT slug,offers FROM cm_products WHERE tenant_id=? AND slug IN (${ph})`, tid, ...slugs)) offers[o.slug] = JSON.parse(o.offers);
      return { skus, offers };
    };
    r.put("/v1/catalog/products", { scope: "catalog:write", limit: { key: "cat", max: 30, win: 60 }, summary: "مزامنة المنتجات (upsert بالـslug؛ replace:true يعطّل الغائب؛ keep_stock:true لا يمسّ المخزون)" }, async (req) => {
      const b = req.json(), list = Array.isArray(b.products) ? b.products : null; if (!list || list.length > 500) throw new HttpError(400, "validation_error", "products مصفوفة حتى 500 منتج");
      const tid = req.tenant.id, now = ctx.nowS(), seen = []; let n = 0;
      for (const p of list) {
        const slug = clean(p?.slug, 80); if (!/^[A-Za-z0-9._-]{1,80}$/.test(slug)) continue; const price = int(p.price, -1); if (price < 0) continue;
        const offers = (Array.isArray(p.offers) ? p.offers : []).slice(0, 12).map((o) => ({ qty: int(o?.qty), price: int(o?.price), free: int(o?.free) })).filter((o) => o.qty > 0 && o.price > 0);
        await db.run("INSERT INTO cm_products (tenant_id,slug,title,active,cat,free_ship,offers,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,slug) DO UPDATE SET title=excluded.title,active=excluded.active,cat=excluded.cat,free_ship=excluded.free_ship,offers=excluded.offers,updated_at=excluded.updated_at", tid, slug, clean(p.title, 160), p.active === false ? 0 : 1, clean(p.cat, 60), p.freeShip ? 1 : 0, JSON.stringify(offers), now);
        const vs = (Array.isArray(p.variations) ? p.variations : []).slice(0, 200).filter((v) => v && v.id != null);
        const rows = [{ vkey: "", label: "", price, stock: p.stock == null || p.stock === "" ? null : int(p.stock), active: 1 }, ...vs.map((v) => ({ vkey: clean(v.id, 60), label: clean(v.label, 120), price: int(v.price, price), stock: v.stock == null || v.stock === "" ? null : int(v.stock), active: v.active === false ? 0 : 1 }))];
        const keep = [];
        for (const k of rows) { keep.push(k.vkey);
          if (b.keep_stock) await db.run("INSERT INTO cm_skus (tenant_id,slug,vkey,label,price,stock,active) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,slug,vkey) DO UPDATE SET label=excluded.label,price=excluded.price,active=excluded.active", tid, slug, k.vkey, k.label, k.price, k.stock, k.active);
          else await db.run("INSERT INTO cm_skus (tenant_id,slug,vkey,label,price,stock,active) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,slug,vkey) DO UPDATE SET label=excluded.label,price=excluded.price,stock=excluded.stock,active=excluded.active", tid, slug, k.vkey, k.label, k.price, k.stock, k.active); }
        await db.run(`UPDATE cm_skus SET active=0 WHERE tenant_id=? AND slug=? AND vkey NOT IN (${keep.map(() => "?").join(",")})`, tid, slug, ...keep);
        seen.push(slug); n++;
      }
      if (b.replace && seen.length) await db.run(`UPDATE cm_products SET active=0 WHERE tenant_id=? AND slug NOT IN (${seen.map(() => "?").join(",")})`, tid, ...seen);
      return ok({ ok: true, products: n });
    });
    r.get("/v1/catalog/products", { scope: "catalog:read", summary: "الكتالوج المتزامن" }, async (req) => {
      const lim = clampLimit(req.query.limit), rows = await db.all("SELECT slug,title,active,cat,offers FROM cm_products WHERE tenant_id=? ORDER BY slug LIMIT ?", req.tenant.id, lim);
      const out = []; for (const p of rows) out.push({ slug: p.slug, title: p.title, active: !!p.active, cat: p.cat, offers: JSON.parse(p.offers), skus: (await db.all("SELECT vkey,label,price,stock,active FROM cm_skus WHERE tenant_id=? AND slug=?", req.tenant.id, p.slug)).map((s) => ({ ...s, active: !!s.active })) });
      return ok({ products: out });
    });
    r.put("/v1/catalog/coupons", { scope: "catalog:write", summary: "مزامنة أكواد التخفيض البسيطة (percent|fixed|freeship)" }, async (req) => {
      const list = req.json().coupons; if (!Array.isArray(list) || list.length > 300) throw new HttpError(400, "validation_error", "coupons مصفوفة حتى 300"); let n = 0;
      await db.run("DELETE FROM cm_coupons WHERE tenant_id=?", req.tenant.id);
      for (const c of list) { const code = clean(c?.code, 40).toUpperCase(); const type = ["percent", "fixed", "freeship"].includes(c?.type) ? c.type : null; if (!code || !type) continue;
        await db.run("INSERT OR REPLACE INTO cm_coupons (tenant_id,code,type,value,min,active,from_at,to_at) VALUES (?,?,?,?,?,?,?,?)", req.tenant.id, code, type, Math.max(0, int(c.value)), Math.max(0, int(c.min)), c.active === false ? 0 : 1, c.from ? int(c.from) : null, c.to ? int(c.to) : null); n++; }
      return ok({ ok: true, coupons: n });
    });
    r.post("/v1/orders", { scope: "order:create", limit: { key: "ord", max: 30, win: 60 }, summary: "إنشاء طلب بتحقق خادمي من الأسعار والمخزون (ref فريد من المتجر)" }, async (req) => {
      const b = req.json(), tid = req.tenant.id, ref = String(b.ref ?? "").slice(0, 80); if (!/^[A-Za-z0-9._:-]{6,80}$/.test(ref)) throw new HttpError(400, "validation_error", "ref (6–80 حرفاً) مطلوب");
      const phone = localPhone(b.customer?.phone); if (!phone) throw new HttpError(422, "invalid_phone", "رقم هاتف جزائري غير صالح"); if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط");
      const lines = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => ({ slug: clean(i?.slug, 80), vkey: clean(i?.vid ?? i?.vkey ?? "", 60), qty: int(i?.qty), unit: +i?.price || 0, title: clean(i?.title, 160) }));
      if (!lines.length) throw new HttpError(400, "validation_error", "items مطلوبة");
      const subtotal = int(b.subtotal), discount = Math.max(0, int(b.discount)), fee = int(b.fee), total = int(b.total), coupon = clean(b.coupon, 40).toUpperCase();
      if (req.mode !== "live") return ok({ ok: true, sandbox: true }, 201);
      const dup = await db.one("SELECT ref,flags FROM cm_orders WHERE tenant_id=? AND ref=?", tid, ref); if (dup) return ok({ ok: true, ref, duplicate: true });
      const mode = req.tenant.settings?.order_mode === "enforce" ? "enforce" : "observe", maxFee = int(req.tenant.settings?.max_fee, 3000) || 3000;
      const { skus, offers } = await loadSkus(tid, [...new Set(lines.map((l) => l.slug))]);
      const couponRow = coupon ? await db.one("SELECT * FROM cm_coupons WHERE tenant_id=? AND code=?", tid, coupon) : null;
      const v = verifyOrder({ lines, skus, offers, subtotal, discount, fee, total, coupon, couponRow, maxFee, now: ctx.nowS() });
      // المخزون: observe يعلّم فقط، enforce يحجز ذرّياً (خصم مشروط ثم تعويض عند فشل سطر)
      const short = []; for (const l of v.lines) if (l.sku.stock != null && l.sku.stock < l.qty) short.push(l.slug);
      if (short.length) for (const s of short) v.flags.push("stock_short:" + s);
      let reserved = 0;
      if (mode === "enforce") {
        const bad = v.flags.filter((f) => FATAL.includes(f.split(":")[0]));
        if (bad.length) throw new HttpError(422, "order_rejected", "الطلب لا يطابق الأسعار أو الشروط", { flags: bad });
        const done = [];
        for (const l of v.lines) { if (l.sku.stock == null) continue;
          const x = await db.run("UPDATE cm_skus SET stock=stock-? WHERE tenant_id=? AND slug=? AND vkey=? AND stock IS NOT NULL AND stock>=?", l.qty, tid, l.slug, l.vkey, l.qty);
          if (!x.changes) { for (const d of done) await db.run("UPDATE cm_skus SET stock=stock+? WHERE tenant_id=? AND slug=? AND vkey=?", d.qty, tid, d.slug, d.vkey); throw new HttpError(409, "out_of_stock", "الكمية غير متوفرة", { slug: l.slug }); }
          done.push(l); }
        reserved = 1;
      }
      const now = ctx.nowS(), enc = await ctx.vault.encrypt(phone, `ord:${tid}`), ph = await hmacHex(ctx.secret, "ord:" + phone);
      const items = v.lines.map((l) => ({ id: l.slug, vkey: l.vkey, title: clean((l.sku.ptitle || l.title) + (l.sku.label ? " — " + l.sku.label : ""), 200), qty: l.qty, price: l.unit }));
      try { await db.run("INSERT INTO cm_orders (tenant_id,ref,status,name,phone_h,phone_enc,wilaya,commune,dtype,desk,items,subtotal,discount,fee,total,coupon,flags,mode,reserved,created_at,updated_at) VALUES (?,?,'nouvelle',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", tid, ref, clean(b.customer?.name, 80), ph, enc, clean(b.wilaya, 40), clean(b.commune, 60), b.dtype === "stop" ? "stop" : "home", clean(b.desk, 80), JSON.stringify(items), subtotal, discount, fee, total, coupon, JSON.stringify(v.flags), mode, reserved, now, now); }
      catch (e) { if (reserved) for (const l of v.lines) if (l.sku.stock != null) await db.run("UPDATE cm_skus SET stock=stock+? WHERE tenant_id=? AND slug=? AND vkey=?", l.qty, tid, l.slug, l.vkey); if (/UNIQUE|constraint/i.test(String(e?.message))) return ok({ ok: true, ref, duplicate: true }); throw e; }
      await ctx.emit(tid, "order.created", { order_id: ref, total, currency: "DZD", customer: { name: clean(b.customer?.name, 80), phone, city: clean(b.wilaya, 40) }, items: items.map((i) => ({ id: i.id, title: i.title, qty: i.qty, price: i.price })), verified: v.flags.length === 0 }, `order.created:${ref}`);
      return ok({ ok: true, ref, verified: v.flags.length === 0, mode }, 201);
    });
    r.get("/v1/orders", { scope: "orders:read", summary: "الطلبات (flagged=1 للمخالفة فقط)" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = [req.tenant.id]; let q = "SELECT * FROM cm_orders WHERE tenant_id=?";
      if (req.query.status) { q += " AND status=?"; a.push(String(req.query.status)); } if (req.query.flagged === "1") q += " AND flags<>'[]'"; if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim), out = [];
      for (const o of pg.items) out.push({ ref: o.ref, status: o.status, name: o.name, phone: await ctx.vault.decrypt(o.phone_enc, `ord:${req.tenant.id}`), wilaya: o.wilaya, items: JSON.parse(o.items), subtotal: o.subtotal, discount: o.discount, fee: o.fee, total: o.total, coupon: o.coupon, flags: JSON.parse(o.flags), mode: o.mode, reserved: !!o.reserved, created_at: o.created_at });
      return ok({ orders: out, next: pg.next });
    });
    r.get("/v1/orders/stats", { scope: "orders:read", summary: "عدد الطلبات والمخالفات" }, async (req) => {
      const row = await db.one("SELECT COUNT(*) n, SUM(CASE WHEN flags<>'[]' THEN 1 ELSE 0 END) flagged, COALESCE(SUM(total),0) value FROM cm_orders WHERE tenant_id=?", req.tenant.id);
      return ok({ orders: row.n, flagged: row.flagged ?? 0, value: row.value, mode: req.tenant.settings?.order_mode === "enforce" ? "enforce" : "observe" });
    });
  },
  on: Object.fromEntries([["order.confirmed", "confirmee"], ["order.delivered", "livree"], ["order.failed", "echec"], ["order.cancelled", "annulee"]].map(([t, st]) => [t, async (e, ctx) => {
    const ref = String(e.data?.order_id ?? ""); if (!ref) return; const o = await ctx.db.one("SELECT id,reserved,items FROM cm_orders WHERE tenant_id=? AND ref=?", e.tenantId, ref); if (!o) return;
    await ctx.db.run("UPDATE cm_orders SET status=?, updated_at=? WHERE id=?", st, ctx.nowS(), o.id);
    if (st === "annulee" && o.reserved) {                                         // إلغاء: إعادة المحجوز مرة واحدة فقط
      const x = await ctx.db.run("UPDATE cm_orders SET reserved=0 WHERE id=? AND reserved=1", o.id);
      if (x.changes) for (const i of JSON.parse(o.items)) await ctx.db.run("UPDATE cm_skus SET stock=stock+? WHERE tenant_id=? AND slug=? AND vkey=? AND stock IS NOT NULL", i.qty, e.tenantId, i.id, i.vkey ?? "");
    }
  }])),
};
