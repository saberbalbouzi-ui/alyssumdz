import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { localPhone, hmacHex, maskPhone, maskName, seesPii, strictCfg, safeEq } from "../util.js";

/** التجارة: كتالوج + مخزون + طلبات بتحقق خادمي. الوضع observe (افتراضي): يقبل ويسجّل العلامات بلا حجز؛ enforce: يرفض المخالف ويحجز المخزون ذرّياً.
 *  الضبط في settings المستأجر: order_mode = observe|enforce، max_fee (افتراضي 3000). */
const clean = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const int = (v, d = 0) => { const n = Math.round(+v); return Number.isFinite(n) ? n : d; };
const FATAL = ["price_mismatch", "subtotal_mismatch", "total_mismatch", "unknown_product", "inactive", "coupon_mismatch", "fee_out_of_range", "fee_mismatch", "discount_unverified", "qty_invalid"];

/** وحدات السعر المسموحة لسطر: سعر الـSKU وسعر الوحدة في كل عرض (يُضرب بنسبة التنويع إن وُجدت). */
export function allowedUnits(sku, base, offers) {
  const u = new Set([sku.price]); const ratio = base && sku.vkey !== "" && base.price > 0 ? sku.price / base.price : 1;
  for (const o of offers ?? []) if (o.qty > 0 && o.price > 0) u.add(Math.round((o.price / o.qty) * ratio * 100) / 100);
  return [...u];
}
/** تحقق نقي من حمولة طلب مقابل الكتالوج. */
/** اسم ولاية/بلدية مطبَّع للمطابقة (حروف لاتينية صغيرة وأرقام فقط) */
export const normPlace = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0600-\u06ff]/g, "");
export function verifyOrder({ lines, skus, offers, subtotal, discount, fee, total, coupon, couponRow, maxFee = 3000, now = 0, rate = null, dtype = "home", digitalAll = false }) {
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
  /* A-01: إن وُجد سعر موثوق للوجهة فالرسم يجب أن يطابقه (±1) أو يكون صفراً بسبب مبرّر خادمياً (كود توصيل مجاني، صنف بشحن مجاني، حدّ الشحن المجاني)؛ بلا سعر موثوق للوجهة يبقى السلوك القديم (نطاق max_fee فقط) */
  if (rate && !digitalAll) { const want = dtype === "stop" ? rate.stop : rate.home, freeOk = (coupon && couponRow?.type === "freeship" && couponRow.active) || (out.length > 0 && out.every((l) => l.sku.freeShip)) || (rate.free_over > 0 && sum >= rate.free_over);
    if (!(Math.abs(fee - want) <= 1 || (fee === 0 && freeOk))) flags.push("fee_mismatch"); }
  if (Math.abs(total - (subtotal - discount + fee)) > 1) flags.push("total_mismatch");
  return { flags, lines: out, serverSubtotal: sum };
}


/* ───── التحقق الصارم (المرحلتان 0 و1): الخادم يحسب السعر النهائي بنفسه ولا يثق بسعر/خصم/مجموع المتصفح ─────
   السعر المقبول لسطر = ما يثبته الخادم لكمية السطر بالضبط: كمية × سعر الـSKU، أو سعر العرض الذي كميته (شاملةً الهدايا) تساوي الكمية تماماً (× نسبة التنويع)،
   أو — بشروط صريحة — السعر السابق المسجَّل في cm_price_hist ضمن مهلة قصيرة. كل ما عدا ذلك يُرفض (في الوضع الصارم) أو يُسجَّل فقط (في وضع الظل). */
export const STRICT_MSG = {
  qty_fractional: "الكمية غير صالحة", qty_invalid: "الكمية غير صالحة", unknown_product: "أحد المنتجات لم يعد متاحاً", inactive: "أحد المنتجات لم يعد متاحاً", catalog_invalid: "تعذّر التحقق من بيانات المنتج، تواصل مع المتجر",
  price_mismatch: "السعر المرسل لا يطابق سعر المنتج الحالي — حدّث الصفحة وأعد المحاولة", subtotal_mismatch: "مجموع الطلب لا يطابق الأسعار الحالية — حدّث الصفحة وأعد المحاولة", total_mismatch: "إجمالي الطلب لا يطابق الأسعار الحالية — حدّث الصفحة وأعد المحاولة",
  discount_unverified: "تعذّر التحقق من الخصم المطبّق على الطلب — أزل الكود أو تواصل مع المتجر", discount_mismatch: "قيمة الخصم لا تطابق الكود المُدخل — حدّث الصفحة وأعد المحاولة", coupon_invalid: "كود التخفيض غير صالح لهذا الطلب",
  fee_unverifiable: "تعذّر التحقق من رسوم التوصيل لهذا الطلب — تواصل مع المتجر", fee_mismatch: "رسوم التوصيل لا تطابق هذا الطلب — حدّث الصفحة وأعد المحاولة", fee_out_of_range: "رسوم التوصيل غير صالحة",
};
const PREPAID = ["baridimob", "ccp", "chargily"];
export function strictScope(sc, { pay, lines, digital }) {
  if (!sc.on || !lines.length) return "out";
  if (lines.every((l) => digital[l.slug])) return "digital";
  if (sc.pay && PREPAID.includes(pay)) return "prepaid";
  if (sc.slugs.length && lines.every((l) => sc.slugs.includes(l.slug))) return "slugs";
  return "out";
}
/** حساب خادمي نقي. hist: { "slug\0vkey": { old, new, at } } (مُتحقَّق من توقيعها قبل التمرير). */
export function priceOrder({ lines, skus, offers, subtotal, discount, fee, total, coupon, couponRow, digital = {}, hist = {}, graceS = 600, maxFee = 3000, now = 0 }) {
  const reasons = [], notes = [], out = []; let sub = 0;
  const near = (x, y, t = 1) => Math.abs(x - y) <= t;
  for (const l of lines) {
    if (!Number.isInteger(l.rawQty)) { reasons.push("qty_fractional:" + l.slug); continue; }
    if (!(l.qty >= 1 && l.qty <= 999)) { reasons.push("qty_invalid:" + l.slug); continue; }
    const sku = skus[l.slug + "\u0000" + l.vkey]; if (!sku) { reasons.push("unknown_product:" + l.slug); continue; }
    if (!sku.active || sku.pActive === 0) reasons.push("inactive:" + l.slug);
    const base = skus[l.slug + "\u0000"], ofs = offers[l.slug];
    if (ofs === null || !(sku.price > 0) || (l.vkey !== "" && !(base && base.price > 0))) { reasons.push("catalog_invalid:" + l.slug); continue; }
    const ratio = l.vkey !== "" ? sku.price / base.price : 1, cands = [l.qty * sku.price];
    for (const o of ofs ?? []) if (o.qty === l.qty && o.price > 0) cands.push(Math.round(o.price * ratio));
    const client = Math.round(l.unit * l.qty), tol = 1 + Math.ceil(l.qty * 0.005);
    let line = cands.filter((c) => near(c, client, tol)).sort((a, b) => Math.abs(a - client) - Math.abs(b - client))[0];
    if (line === undefined) {
      const h = hist[l.slug + "\u0000" + l.vkey];                    // مهلة السعر القديم: نفس المنتج/التنويع، توقيع سليم، سعره الحالي هو الجديد المسجَّل، ضمن المهلة، ولا تمسّ تحقق الكمية والعرض (السعر الأساسي × الكمية فقط)
      if (h && h.new === sku.price && h.at <= now && now - h.at <= graceS && near(l.qty * h.old, client, tol)) { line = l.qty * h.old; notes.push("grace_old_price:" + l.slug); }
      else { reasons.push("price_mismatch:" + l.slug); line = Math.min(...cands); }
    }
    sub += line; out.push({ slug: l.slug, vkey: l.vkey, qty: l.qty, line, unit: Math.round((line / l.qty) * 100) / 100, sku });
  }
  if (!near(sub, subtotal, 1 + lines.length) && !reasons.some((r) => /^(qty_|unknown_|catalog_)/.test(r))) reasons.push("subtotal_mismatch");
  /* الخصم: يُقبل فقط ما يثبته كود معروف في cm_coupons؛ ما سواه (عروض تلقائية، إضافات، أكواد مقيّدة أو شخصية) غير قابل للإثبات ⇒ يصير صفراً ويُسجَّل سبب */
  let disc = 0, freeShipCoupon = false;
  const okC = couponRow && couponRow.active && !(couponRow.from_at && now < couponRow.from_at) && !(couponRow.to_at && now > couponRow.to_at) && sub >= couponRow.min;
  if (coupon && couponRow && okC) {
    if (couponRow.type === "freeship") freeShipCoupon = true;
    else { disc = couponRow.type === "percent" ? Math.round((sub * couponRow.value) / 100) : Math.min(couponRow.value, sub); if (!near(disc, discount)) reasons.push("discount_mismatch"); }
  } else if (discount > 0) reasons.push(coupon && couponRow ? "coupon_invalid" : "discount_unverified");
  /* رسوم التوصيل: قابلة للإثبات فقط حين تكون صفراً بالضرورة (كل الأسطر رقمية، أو كلها شحن مجاني، أو كود توصيل مجاني صالح)؛ غير ذلك لا يملك الخادم جدول الرسوم فلا يُعدّ الإجمالي موثوقاً */
  const all = (f) => out.length === lines.length && out.every(f);
  let sf;
  if (lines.length && (all((o) => digital[o.slug]) || all((o) => o.sku.freeShip) || freeShipCoupon)) { sf = 0; if (fee !== 0) reasons.push("fee_mismatch"); }
  else { sf = Math.max(0, fee); if (fee < 0 || fee > maxFee) reasons.push("fee_out_of_range"); reasons.push("fee_unverifiable"); }
  const st = sub - disc + sf; if (!near(st, total, 1) && !reasons.some((r) => /^(qty_|unknown_|catalog_)/.test(r))) reasons.push("total_mismatch");
  return { ok: reasons.length === 0, reasons, notes, lines: out, subtotal: sub, discount: disc, fee: sf, total: st };
}
const histSig = (ctx, tid, h) => hmacHex(ctx.secret, `ph:${tid}:${h.slug}:${h.vkey}:${h.old_price}:${h.new_price}:${h.changed_at}`);
const trustSig = (ctx, tid, ref, total) => hmacHex(ctx.secret, `trust:${tid}:${ref}:${total}`);
export { trustSig };

/* ───── دفتر حجز المخزون (A-05): pending ← committed | released؛ كل انتقال تحديث مشروط بالحالة (idempotent تحت التزامن وإعادة المعالجة) ───── */
const HOLD_DEFAULT_H = 72;
export const holdHours = (settings) => { const h = Math.round(+settings?.hold_hours); return Number.isFinite(h) && h >= 1 && h <= 720 ? h : HOLD_DEFAULT_H; };
const restoreQty = (db, tid, r) => db.run("UPDATE cm_skus SET stock=stock+? WHERE tenant_id=? AND slug=? AND vkey=? AND stock IS NOT NULL", r.qty, tid, r.slug, r.vkey);
/** يحرّر سطور الحجز من الحالات `from` إلى released ويعيد مخزونها مرة واحدة لكل سطر. يعيد عدد ما حُرِّر. */
async function releaseRows(db, rows, from, now) {
  let n = 0;
  for (const r of rows) { const x = await db.run(`UPDATE cm_resv SET state='released', updated_at=? WHERE id=? AND state IN (${from.map(() => "?").join(",")})`, now, r.id, ...from); if (x.changes) { await restoreQty(db, r.tenant_id, r); n++; } }
  return n;
}
/** يعيد حجز سطور released (طلب انتهت مهلته ثم أُكّد): كل سطر يُحجز ذرّياً بشرط الكفاية؛ إن نقص أيٌّ منها يُتراجع عن الكل ويعيد false. */
async function reacquireRows(db, rows, now) {
  const got = [];
  for (const r of rows) {
    const claim = await db.run("UPDATE cm_resv SET state='committed', updated_at=? WHERE id=? AND state='released'", now, r.id); if (!claim.changes) continue;      // سبقه معالج آخر
    const x = await db.run("UPDATE cm_skus SET stock=stock-? WHERE tenant_id=? AND slug=? AND vkey=? AND stock IS NOT NULL AND stock>=?", r.qty, r.tenant_id, r.slug, r.vkey, r.qty);
    if (x.changes) { got.push(r); continue; }
    const k = await db.one("SELECT stock FROM cm_skus WHERE tenant_id=? AND slug=? AND vkey=?", r.tenant_id, r.slug, r.vkey);
    if (k && k.stock == null) continue;                                          // صار غير متتبَّع: لا حاجة لحجز
    await db.run("UPDATE cm_resv SET state='released', updated_at=? WHERE id=? AND state='committed'", now, r.id);        // لم يكفِ: أعد السطر released وتراجع عن ما سبق
    for (const g of got) { const y = await db.run("UPDATE cm_resv SET state='released', updated_at=? WHERE id=? AND state='committed'", now, g.id); if (y.changes) await restoreQty(db, g.tenant_id, g); }
    return false;
  }
  return true;
}
async function addFlag(db, orderId, flag) {
  const o = await db.one("SELECT flags FROM cm_orders WHERE id=?", orderId); if (!o) return; const f = JSON.parse(o.flags || "[]"); if (f.includes(flag)) return;
  f.push(flag); await db.run("UPDATE cm_orders SET flags=? WHERE id=?", JSON.stringify(f), orderId);
}

export const commerce = {
  id: "commerce",
  routes(r, ctx) {
    const { db } = ctx;
    const loadSkus = async (tid, slugs) => {
      const skus = {}, offers = {}; if (!slugs.length) return { skus, offers };
      const ph = slugs.map(() => "?").join(",");
      for (const s of await db.all(`SELECT k.slug,k.vkey,k.label,k.price,k.stock,k.active,p.active AS pa,p.title AS pt,p.free_ship AS fs FROM cm_skus k JOIN cm_products p ON p.tenant_id=k.tenant_id AND p.slug=k.slug WHERE k.tenant_id=? AND k.slug IN (${ph})`, tid, ...slugs)) skus[s.slug + "\u0000" + s.vkey] = { slug: s.slug, vkey: s.vkey, label: s.label, price: s.price, stock: s.stock, active: !!s.active, pActive: s.pa, ptitle: s.pt, freeShip: !!s.fs };
      for (const o of await db.all(`SELECT slug,offers FROM cm_products WHERE tenant_id=? AND slug IN (${ph})`, tid, ...slugs)) offers[o.slug] = (() => { try { const a = JSON.parse(o.offers); return Array.isArray(a) ? a.filter((x) => x && Number.isFinite(+x.qty) && Number.isFinite(+x.price)).map((x) => ({ qty: +x.qty, price: +x.price, free: +x.free || 0 })) : null; } catch { return null; } })();
      return { skus, offers };
    };
    r.put("/v1/catalog/shipping", { scope: "catalog:write", limit: { key: "cat", max: 30, win: 60 }, summary: "مزامنة جدول رسوم الشحن الموثوق: rates[{wilaya,commune?,home,stop,free_over?}] (replace:true يستبدل الجدول كله)" }, async (req) => {
      const b = req.json(), tid = req.tenant.id, list = Array.isArray(b.rates) ? b.rates.slice(0, 5000) : null; if (!list) throw new HttpError(400, "validation_error", "rates مصفوفة مطلوبة");
      const rows = []; for (const x of list) { const w = normPlace(x?.wilaya); if (!w || w.length > 60) continue; const home = int(x.home), stop = int(x.stop); if (home < 0 || stop < 0 || home > 20000 || stop > 20000) throw new HttpError(422, "validation_error", "سعر غير معقول", { wilaya: String(x.wilaya).slice(0, 40) }); rows.push([w, normPlace(x.commune).slice(0, 60), home, stop, Math.max(0, int(x.free_over))]); }
      const now = ctx.nowS(), st = [];
      if (b.replace === true) st.push(["DELETE FROM cm_ship WHERE tenant_id=?", tid]);
      for (const [w, c, h, s2, f] of rows) st.push(["INSERT INTO cm_ship (tenant_id,wilaya,commune,home,stop,free_over,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,wilaya,commune) DO UPDATE SET home=excluded.home,stop=excluded.stop,free_over=excluded.free_over,updated_at=excluded.updated_at", tid, w, c, h, s2, f, now]);
      for (let i = 0; i < st.length; i += 50) await db.batch(st.slice(i, i + 50), { atomic: !!ctx.db.d1.batch });
      return ok({ ok: true, rates: rows.length, total: await db.val("SELECT COUNT(*) FROM cm_ship WHERE tenant_id=?", tid) });
    });
    r.get("/v1/catalog/shipping", { scope: "catalog:read", summary: "عدّاد جدول الرسوم الموثوق" }, async (req) => ok({ rates: await db.val("SELECT COUNT(*) FROM cm_ship WHERE tenant_id=?", req.tenant.id), wilayas: await db.val("SELECT COUNT(DISTINCT wilaya) FROM cm_ship WHERE tenant_id=?", req.tenant.id) }));
    r.put("/v1/catalog/products", { scope: "catalog:write", limit: { key: "cat", max: 30, win: 60 }, summary: "مزامنة المنتجات (upsert بالـslug؛ replace:true يعطّل الغائب؛ keep_stock:true لا يمسّ المخزون)" }, async (req) => {
      const b = req.json(), list = Array.isArray(b.products) ? b.products : null; if (!list || list.length > 500) throw new HttpError(400, "validation_error", "products مصفوفة حتى 500 منتج");
      const tid = req.tenant.id, now = ctx.nowS(), seen = []; let n = 0;
      const soft = async (f) => { try { await f(); } catch { /* ميزة التحقق الصارم اختيارية: لا تُفشل مزامنة الكتالوج (مثلاً قبل تطبيق المخطط الجديد) */ } };
      await soft(() => db.run("DELETE FROM cm_price_hist WHERE tenant_id=? AND changed_at<?", tid, now - 86400));      // سجلّ الأسعار لا يُحتفظ به أكثر من يوم (المهلة القصوى 60 دقيقة)
      for (const p of list) {
        const slug = clean(p?.slug, 80); if (!/^[A-Za-z0-9._-]{1,80}$/.test(slug)) continue; const price = int(p.price, -1); if (price < 0) continue;
        const offers = (Array.isArray(p.offers) ? p.offers : []).slice(0, 12).map((o) => ({ qty: int(o?.qty), price: int(o?.price), free: int(o?.free) })).filter((o) => o.qty > 0 && o.price > 0);
        await db.run("INSERT INTO cm_products (tenant_id,slug,title,active,cat,free_ship,offers,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,slug) DO UPDATE SET title=excluded.title,active=excluded.active,cat=excluded.cat,free_ship=excluded.free_ship,offers=excluded.offers,updated_at=excluded.updated_at", tid, slug, clean(p.title, 160), p.active === false ? 0 : 1, clean(p.cat, 60), p.freeShip ? 1 : 0, JSON.stringify(offers), now);
        const vs = (Array.isArray(p.variations) ? p.variations : []).slice(0, 200).filter((v) => v && v.id != null);
        const rows = [{ vkey: "", label: "", price, stock: p.stock == null || p.stock === "" ? null : int(p.stock), active: 1 }, ...vs.map((v) => ({ vkey: clean(v.id, 60), label: clean(v.label, 120), price: int(v.price, price), stock: v.stock == null || v.stock === "" ? null : int(v.stock), active: v.active === false ? 0 : 1 }))];
        const keep = [], prior = new Map((await db.all("SELECT vkey,price FROM cm_skus WHERE tenant_id=? AND slug=?", tid, slug)).map((x) => [x.vkey, x.price]));
        if (p.digital !== undefined) await soft(() => db.run("INSERT INTO cm_meta (tenant_id,slug,digital) VALUES (?,?,?) ON CONFLICT(tenant_id,slug) DO UPDATE SET digital=excluded.digital", tid, slug, p.digital === true ? 1 : 0));
        for (const k of rows) { keep.push(k.vkey);
          if (prior.has(k.vkey) && prior.get(k.vkey) !== k.price && prior.get(k.vkey) > 0) { const h = { slug, vkey: k.vkey, old_price: prior.get(k.vkey), new_price: k.price, changed_at: now }; await soft(async () => db.run("INSERT INTO cm_price_hist (tenant_id,slug,vkey,old_price,new_price,changed_at,sig) VALUES (?,?,?,?,?,?,?)", tid, h.slug, h.vkey, h.old_price, h.new_price, h.changed_at, await histSig(ctx, tid, h))); }
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
      const lines = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => ({ slug: clean(i?.slug, 80), vkey: clean(i?.vid ?? i?.vkey ?? "", 60), qty: int(i?.qty), rawQty: Number(i?.qty), unit: +i?.price || 0, title: clean(i?.title, 160) }));
      if (!lines.length) throw new HttpError(400, "validation_error", "items مطلوبة");
      const subtotal = int(b.subtotal), discount = Math.max(0, int(b.discount)), fee = int(b.fee), total = int(b.total), coupon = clean(b.coupon, 40).toUpperCase();
      if (req.mode !== "live") return ok({ ok: true, sandbox: true }, 201);
      const dup = await db.one("SELECT ref,flags FROM cm_orders WHERE tenant_id=? AND ref=?", tid, ref); if (dup) return ok({ ok: true, ref, duplicate: true });
      const mode = req.tenant.settings?.order_mode === "enforce" ? "enforce" : "observe", maxFee = int(req.tenant.settings?.max_fee, 3000) || 3000;
      const { skus, offers } = await loadSkus(tid, [...new Set(lines.map((l) => l.slug))]);
      const couponRow = coupon ? await db.one("SELECT * FROM cm_coupons WHERE tenant_id=? AND code=?", tid, coupon) : null;
      const wk = normPlace(b.wilaya), ck = normPlace(b.commune), shipRows = wk ? await db.all("SELECT commune,home,stop,free_over FROM cm_ship WHERE tenant_id=? AND (commune='' OR commune=?) AND wilaya=?", tid, ck, wk) : [], rate = shipRows.find((r) => r.commune === ck && ck) ?? shipRows.find((r) => r.commune === "") ?? null, slugsAll = [...new Set(lines.map((l) => l.slug))], digMap = {}; for (const m of await db.all(`SELECT slug,digital FROM cm_meta WHERE tenant_id=? AND slug IN (${slugsAll.map(() => "?").join(",")})`, tid, ...slugsAll)) digMap[m.slug] = !!m.digital;
      const digitalAll = lines.length > 0 && lines.every((l) => digMap[l.slug]);
      const v = verifyOrder({ lines, skus, offers, subtotal, discount, fee, total, coupon, couponRow, maxFee, now: ctx.nowS(), rate, dtype: b.dtype === "stop" ? "stop" : "home", digitalAll });
      /* التحقق الصارم (مطفأ افتراضياً لكل المستأجرين): يحسب الخادم السعر بنفسه. وضع الظل يسجّل القرار المتوقع في cm_calc ولا يرفض ولا يغيّر شيئاً؛ الرفض الفعلي لا يعمل إلا بـstrict.shadow=false */
      const sc = strictCfg(req.tenant.settings), payV = ["cod", "baridimob", "ccp", "chargily"].includes(b.pay) ? b.pay : "";
      let sv = null, trusted = false;
      if (sc.on) {
        const now0 = ctx.nowS(), slugs = [...new Set(lines.map((l) => l.slug))];
        try {
          const ph = slugs.map(() => "?").join(","), digital = {}, hist = {};
          for (const m of await db.all(`SELECT slug,digital FROM cm_meta WHERE tenant_id=? AND slug IN (${ph})`, tid, ...slugs)) digital[m.slug] = !!m.digital;
          for (const h of await db.all(`SELECT slug,vkey,old_price,new_price,changed_at,sig FROM cm_price_hist WHERE tenant_id=? AND slug IN (${ph}) AND changed_at>=? ORDER BY id DESC`, tid, ...slugs, now0 - sc.grace_min * 60)) {
            const k = h.slug + "\u0000" + h.vkey; if (hist[k]) continue;                                   // الأحدث فقط
            if (safeEq(h.sig, await histSig(ctx, tid, h))) hist[k] = { old: h.old_price, new: h.new_price, at: h.changed_at };        // سلامة السجل: توقيع HMAC
          }
          const scope = strictScope(sc, { pay: payV, lines, digital });
          const r0 = priceOrder({ lines, skus, offers, subtotal, discount, fee, total, coupon, couponRow, digital, hist, graceS: sc.grace_min * 60, maxFee, now: now0 });
          const rejecting = sc.reject && scope !== "out" && !r0.ok;
          await db.run("INSERT OR IGNORE INTO cm_calc (tenant_id,ref,at,mode,scope,pay,decision,reasons,notes,expected,client,trusted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", tid, ref, now0, sc.reject ? "reject" : "shadow", scope, payV, rejecting ? "reject" : r0.ok ? "accept" : "would_reject", JSON.stringify(r0.reasons.slice(0, 20)), JSON.stringify(r0.notes.slice(0, 20)), r0.total, total, sc.reject && scope !== "out" && r0.ok ? 1 : 0);
          if (now0 % 40 === 0) await db.run("DELETE FROM cm_calc WHERE tenant_id=? AND at<?", tid, now0 - 60 * 86400);
          if (rejecting) { const first = r0.reasons[0].split(":")[0]; throw new HttpError(422, "order_rejected", STRICT_MSG[first] || "تعذّر التحقق من الطلب", { flags: r0.reasons }); }
          if (sc.reject && scope !== "out" && r0.ok) { sv = r0; trusted = true; }
        } catch (e) { if (e instanceof HttpError) throw e; if (sc.reject) throw new HttpError(503, "verification_unavailable", "تعذّر التحقق من الطلب مؤقتاً، حاول لاحقاً"); }
      }
      const fSub = sv ? sv.subtotal : subtotal, fDisc = sv ? sv.discount : discount, fFee = sv ? sv.fee : fee, fTotal = sv ? sv.total : total;
      /* حرّاس الطلب (ctx.orderGuards: خطّاف نواة تسجّله وحدة كالسوق المشترك): يرفضون الطلب قبل أي حجز بـHttpError، وكل حارس قد يعيد دالة تراجع تُنفَّذ إن فشل ما بعدها */
      const undos = []; try { for (const g of ctx.orderGuards) { const u = await g(tid, { ref, lines, customer: b.customer ?? {}, wilaya: clean(b.wilaya, 40), commune: clean(b.commune, 60), dtype: b.dtype === "stop" ? "stop" : "home", desk: clean(b.desk, 80), total, fee }); if (typeof u === "function") undos.push(u); } }
      catch (e) { for (const u of undos.reverse()) { try { await u(); } catch { } } throw e; }
      try {
      // المخزون: observe يعلّم فقط، enforce يحجز ذرّياً (خصم مشروط ثم تعويض عند فشل سطر)
      const short = []; for (const l of v.lines) if (l.sku.stock != null && l.sku.stock < l.qty) short.push(l.slug);
      if (short.length) for (const s of short) v.flags.push("stock_short:" + s);
      let reserved = 0, holdRows = [];
      if (mode === "enforce") {
        const bad = v.flags.filter((f) => FATAL.includes(f.split(":")[0]));
        if (bad.length) throw new HttpError(422, "order_rejected", "الطلب لا يطابق الأسعار أو الشروط", { flags: bad });
        /* حجز ذرّي بجملة SQL واحدة (A-05): تُخصم كل الأسطر أو لا شيء؛ الشرط يفحص كفاية جميع الأسطر على لقطة واحدة، فلا يبقى حجز جزئي ولا يلزم تعويض عند نفاد سطر لاحق */
        const need = new Map(); for (const l of v.lines) { if (l.sku.stock == null) continue; const k = l.slug + "\u0000" + l.vkey, c = need.get(k); need.set(k, { slug: l.slug, vkey: l.vkey, qty: (c ? c.qty : 0) + l.qty }); }
        const L = [...need.values()]; holdRows = L;
        if (L.length) {
          const caseOf = (al) => "CASE " + L.map(() => `WHEN ${al}slug=? AND ${al}vkey=? THEN ?`).join(" ") + " END", cargs = L.flatMap((x) => [x.slug, x.vkey, x.qty]), keys = L.map(() => "(?,?)").join(","), kargs = L.flatMap((x) => [x.slug, x.vkey]);
          const x = await db.run(`UPDATE cm_skus SET stock=stock-(${caseOf("")}) WHERE tenant_id=? AND stock IS NOT NULL AND (slug,vkey) IN (VALUES ${keys}) AND (SELECT COUNT(*) FROM cm_skus k WHERE k.tenant_id=? AND k.stock IS NOT NULL AND (k.slug,k.vkey) IN (VALUES ${keys}) AND k.stock>=(${caseOf("k.")}))=${L.length}`, ...cargs, tid, ...kargs, tid, ...kargs, ...cargs);
          if (x.changes !== L.length) { const bad = L.find((q) => v.lines.some((l) => l.slug === q.slug && l.vkey === q.vkey && l.sku.stock != null && l.sku.stock < q.qty)) ?? L[0]; throw new HttpError(409, "out_of_stock", "الكمية غير متوفرة", { slug: bad.slug }); }
        }
        reserved = 1;
      }
      const email = (() => { const e = String(b.customer?.email ?? "").trim().toLowerCase(); return e.length <= 120 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e) ? e : ""; })(), pay = payV;
      const now = ctx.nowS(), enc = await ctx.vault.encrypt(phone, `ord:${tid}`), ph = await hmacHex(ctx.secret, "ord:" + phone);
      const items = (sv ? sv.lines.map((l) => ({ ...l, title: lines.find((x) => x.slug === l.slug && x.vkey === l.vkey)?.title })) : v.lines).map((l) => ({ id: l.slug, vkey: l.vkey, title: clean((l.sku.ptitle || l.title) + (l.sku.label ? " — " + l.sku.label : ""), 200), qty: l.qty, price: l.unit }));
      const orderSql = "INSERT INTO cm_orders (tenant_id,ref,status,name,phone_h,phone_enc,wilaya,commune,dtype,desk,items,subtotal,discount,fee,total,coupon,flags,mode,reserved,created_at,updated_at) VALUES (?,?,'nouvelle',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", orderArgs = [tid, ref, clean(b.customer?.name, 80), ph, enc, clean(b.wilaya, 40), clean(b.commune, 60), b.dtype === "stop" ? "stop" : "home", clean(b.desk, 80), JSON.stringify(items), fSub, fDisc, fFee, fTotal, coupon, JSON.stringify(v.flags), mode, reserved, now, now];
      try {
        if (reserved && holdRows.length) {          // الطلب وسطور الحجز في معاملة واحدة: لا حجز بلا طلب ولا العكس
          const exp = now + holdHours(req.tenant.settings) * 3600;
          await db.batch([[orderSql, ...orderArgs], ...holdRows.map((q) => ["INSERT INTO cm_resv (tenant_id,ref,slug,vkey,qty,state,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?)", tid, ref, q.slug, q.vkey, q.qty, exp, now, now])], { atomic: true });
        } else await db.run(orderSql, ...orderArgs);
      }
      catch (e) { if (reserved) for (const l of v.lines) if (l.sku.stock != null) await db.run("UPDATE cm_skus SET stock=stock+? WHERE tenant_id=? AND slug=? AND vkey=?", l.qty, tid, l.slug, l.vkey); if (/UNIQUE|constraint/i.test(String(e?.message))) return ok({ ok: true, ref, duplicate: true }); throw e; }
      await ctx.emit(tid, "order.created", { order_id: ref, total: fTotal, currency: "DZD", customer: { name: clean(b.customer?.name, 80), phone, city: clean(b.wilaya, 40), ...(email ? { email } : {}) }, ...(pay ? { pay } : {}), items: items.map((i) => ({ id: i.id, ...(i.vkey ? { vkey: i.vkey } : {}), title: i.title, qty: i.qty, price: i.price })), verified: v.flags.length === 0, ...(trusted ? { ts: await trustSig(ctx, tid, ref, fTotal) } : {}) }, `order.created:${ref}`);
      if (pay && pay !== "cod") { try { await ctx.flush(tid, `order.created:${ref}`); } catch { /* يُعاد في نبضة cron */ } }      // الدفع المسبق (رقمي): يلزم تسجيل المبلغ المتوقع قبل أن يرفع الزبون إثباتاً أو يبدأ الدفع
      return ok({ ok: true, ref, verified: v.flags.length === 0, mode }, 201);
      } catch (e) { for (const u of undos.reverse()) { try { await u(); } catch { } } throw e; }
    });
    r.get("/v1/orders", { scope: "orders:read", summary: "الطلبات (flagged=1 للمخالفة فقط)" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = [req.tenant.id]; let q = "SELECT * FROM cm_orders WHERE tenant_id=?";
      if (req.query.status) { q += " AND status=?"; a.push(String(req.query.status)); } if (req.query.flagged === "1") q += " AND flags<>'[]'"; if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim), out = [];
      const phoneOf = async (o) => { try { return await ctx.vault.decrypt(o.phone_enc, `ord:${req.tenant.id}`); } catch { return ""; } };   // صف تالف/منقول من مستأجر آخر: يُعرض بلا هاتف بدل إسقاط القائمة كلها (V-01)
      for (const o of pg.items) out.push({ ref: o.ref, status: o.status, name: seesPii(req) ? o.name : maskName(o.name), phone: seesPii(req) ? await phoneOf(o) : maskPhone(await phoneOf(o)), wilaya: o.wilaya, items: JSON.parse(o.items), subtotal: o.subtotal, discount: o.discount, fee: o.fee, total: o.total, coupon: o.coupon, flags: JSON.parse(o.flags), mode: o.mode, reserved: !!o.reserved, created_at: o.created_at });
      return ok({ orders: out, next: pg.next });
    });
    r.get("/v1/orders/strict-report", { scope: "orders:read", summary: "تقرير وضع الظل للتحقق الصارم (?days=1..30؛ افتراضي 7): المعدلات والأسباب والحالات المحتمل أنها مشروعة — أرقام مجمّعة بلا بيانات شخصية" }, async (req) => {
      const tid = req.tenant.id, days = Math.min(30, Math.max(1, Math.round(+req.query.days) || 7)), since = ctx.nowS() - days * 86400, sc = strictCfg(req.tenant.settings);
      const rows = await db.all("SELECT ref,at,mode,scope,pay,decision,reasons,notes,expected,client FROM cm_calc WHERE tenant_id=? AND at>=? ORDER BY at DESC LIMIT 5000", tid, since);
      const agg = (f) => { const m = {}; for (const x of rows) { const k = f(x); m[k] = (m[k] ?? 0) + 1; } return m; };
      const inScope = rows.filter((x) => x.scope !== "out"), bad = (xs) => xs.filter((x) => x.decision !== "accept");
      const byReason = {}, byNote = {}, byDay = {};
      for (const x of rows) { if (x.decision === "accept") continue; for (const r of new Set(JSON.parse(x.reasons).map((r) => r.split(":")[0]))) byReason[r] = (byReason[r] ?? 0) + 1; }
      for (const x of rows) for (const r of new Set(JSON.parse(x.notes).map((r) => r.split(":")[0]))) byNote[r] = (byNote[r] ?? 0) + 1;
      for (const x of rows) { const d = new Date(x.at * 1000).toISOString().slice(0, 10); byDay[d] ??= { day: d, n: 0, would_reject: 0 }; byDay[d].n++; if (x.decision !== "accept") byDay[d].would_reject++; }
      /* مشبوه التلاعب = العميل دفع أقل من حساب الخادم؛ والباقي (أعلى، أو رسوم/خصم غير قابلين للإثبات) «محتمل المشروعية» ويحتاج مراجعة قبل أي رفض */
      const wr = bad(rows), tamper = wr.filter((x) => x.client < x.expected - 1), rate = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
      return ok({ strict: sc, days, since, total: rows.length, in_scope: inScope.length, out_of_scope: rows.length - inScope.length,
        would_reject: wr.length, would_reject_in_scope: bad(inScope).length, rate_pct: rate(wr.length, rows.length), rate_in_scope_pct: rate(bad(inScope).length, inScope.length),
        tamper_like: tamper.length, likely_legit: wr.length - tamper.length, by_scope: agg((x) => x.scope), by_pay: agg((x) => x.pay || "none"), by_reason: byReason, notes: byNote, by_day: Object.values(byDay).sort((a, b) => a.day < b.day ? -1 : 1),
        samples: wr.slice(0, 20).map((x) => ({ ref: x.ref, at: x.at, scope: x.scope, pay: x.pay, reasons: JSON.parse(x.reasons), expected: x.expected, client: x.client })) });
    });
    r.get("/v1/orders/stats", { scope: "orders:read", summary: "عدد الطلبات والمخالفات" }, async (req) => {
      const row = await db.one("SELECT COUNT(*) n, SUM(CASE WHEN flags<>'[]' THEN 1 ELSE 0 END) flagged, COALESCE(SUM(total),0) value FROM cm_orders WHERE tenant_id=?", req.tenant.id);
      const holds = { pending: 0, committed: 0, released: 0 }; for (const h of await db.all("SELECT state, COUNT(*) n FROM cm_resv WHERE tenant_id=? GROUP BY state", req.tenant.id)) holds[h.state] = h.n;
      const nx = await db.one("SELECT MIN(expires_at) e FROM cm_resv WHERE tenant_id=? AND state='pending'", req.tenant.id);
      return ok({ orders: row.n, flagged: row.flagged ?? 0, value: row.value, mode: req.tenant.settings?.order_mode === "enforce" ? "enforce" : "observe", holds, hold_hours: holdHours(req.tenant.settings), next_expiry: nx?.e ?? null });
    });
  },
  /** cron: يحرّر الحجوزات pending المنتهية المهلة (طلبات لم تُؤكَّد في الوقت) فيعود مخزونها للبيع، ويوسم الطلب `reservation_expired`؛ يُنظَّف الدفتر الأقدم من 90 يوماً. حتى 200 سطر في النبضة. */
  async cron(ctx) {
    const db = ctx.db, now = ctx.nowS(), due = await db.all("SELECT * FROM cm_resv WHERE state='pending' AND expires_at<=? ORDER BY expires_at LIMIT 200", now);
    const n = await releaseRows(db, due, ["pending"], now), seen = new Set();
    for (const r of due) { const k = r.tenant_id + "\u0000" + r.ref; if (seen.has(k)) continue; seen.add(k);
      if (!(await db.one("SELECT 1 AS x FROM cm_resv WHERE tenant_id=? AND ref=? AND state IN ('pending','committed') LIMIT 1", r.tenant_id, r.ref))) {
        const o = await db.one("SELECT id FROM cm_orders WHERE tenant_id=? AND ref=?", r.tenant_id, r.ref); if (o) { await db.run("UPDATE cm_orders SET reserved=0 WHERE id=?", o.id); await addFlag(db, o.id, "reservation_expired"); } } }
    if (now % 50 < 5) await db.run("DELETE FROM cm_resv WHERE state IN ('committed','released') AND updated_at<?", now - 90 * 86400);
    return { expired: n };
  },
  on: {
    ...Object.fromEntries([["order.confirmed", "confirmee"], ["order.delivered", "livree"], ["order.failed", "echec"], ["order.returned", "echec"], ["order.cancelled", "annulee"]].map(([t, st]) => [t, async (e, ctx) => {
    const ref = String(e.data?.order_id ?? ""); if (!ref) return; const o = await ctx.db.one("SELECT id,reserved,items FROM cm_orders WHERE tenant_id=? AND ref=?", e.tenantId, ref); if (!o) return;
    const db = ctx.db, now = ctx.nowS();
    await db.run("UPDATE cm_orders SET status=?, updated_at=? WHERE id=?", st, now, o.id);
    const rows = await db.all("SELECT * FROM cm_resv WHERE tenant_id=? AND ref=?", e.tenantId, ref);
    if (st === "annulee") {                                                       // إلغاء: يُحرَّر pending/committed ويُعاد المخزون مرة واحدة لكل سطر
      if (rows.length) { await releaseRows(db, rows, ["pending", "committed"], now); await db.run("UPDATE cm_orders SET reserved=0 WHERE id=?", o.id); }
      else if (o.reserved) {                                                      // طلبات سبقت الدفتر (حجز بلا سطور): الإعادة من بنود الطلب كما كانت
        const x = await db.run("UPDATE cm_orders SET reserved=0 WHERE id=? AND reserved=1", o.id);
        if (x.changes) for (const i of JSON.parse(o.items)) await db.run("UPDATE cm_skus SET stock=stock+? WHERE tenant_id=? AND slug=? AND vkey=? AND stock IS NOT NULL", i.qty, e.tenantId, i.id, i.vkey ?? "");
      }
    } else if ((st === "confirmee" || st === "livree") && rows.length) {         // تأكيد/تسليم: الحجز نهائي. إن انتهت مهلته قبل التأكيد يُعاد حجزه ذرّياً، وإن نقص المخزون يُوسَم الطلب للمراجعة
      const lost = rows.filter((r) => r.state === "released");
      await db.run("UPDATE cm_resv SET state='committed', updated_at=? WHERE tenant_id=? AND ref=? AND state='pending'", now, e.tenantId, ref);
      if (lost.length) { if (await reacquireRows(db, lost, now)) await db.run("UPDATE cm_orders SET reserved=1 WHERE id=?", o.id); else await addFlag(db, o.id, "reservation_lost"); }
    }
  }])),
    /* السوق المشترك (وحدة marketplace): منتج مستورد يصل كتالوج المتجر كنسخة قابلة للبيع، ومخزونه مرآة لمخزون المورّد (يُحدَّث لحظياً بـmarketplace.stock) */
    "marketplace.imported": async (e, ctx) => {
      const d = e.data ?? {}, slug = String(d.slug ?? "").slice(0, 80); if (!/^[A-Za-z0-9._-]{1,80}$/.test(slug)) return; const price = Math.max(0, Math.round(+d.price) || 0), stock = d.stock == null ? null : Math.max(0, Math.round(+d.stock) || 0), now = ctx.nowS();
      await ctx.db.run("INSERT INTO cm_products (tenant_id,slug,title,active,cat,free_ship,offers,updated_at) VALUES (?,?,?,1,?,0,'[]',?) ON CONFLICT(tenant_id,slug) DO UPDATE SET title=excluded.title,active=1,cat=excluded.cat,updated_at=excluded.updated_at", e.tenantId, slug, String(d.title ?? slug).slice(0, 200), String(d.category ?? "").slice(0, 60), now);
      await ctx.db.run("INSERT INTO cm_skus (tenant_id,slug,vkey,label,price,stock,active) VALUES (?,?,'','',?,?,1) ON CONFLICT(tenant_id,slug,vkey) DO UPDATE SET price=excluded.price,stock=excluded.stock,active=1", e.tenantId, slug, price, stock);
    },
    "marketplace.stock": async (e, ctx) => {
      const d = e.data ?? {}, slug = String(d.slug ?? "").slice(0, 80); if (!slug) return; const stock = d.stock == null ? null : Math.max(0, Math.round(+d.stock) || 0), active = d.active === false ? 0 : 1;
      await ctx.db.run("UPDATE cm_skus SET stock=?, active=? WHERE tenant_id=? AND slug=? AND vkey=''", stock, active, e.tenantId, slug); await ctx.db.run("UPDATE cm_products SET active=?, updated_at=? WHERE tenant_id=? AND slug=?", active, ctx.nowS(), e.tenantId, slug);
    },
  },
};
