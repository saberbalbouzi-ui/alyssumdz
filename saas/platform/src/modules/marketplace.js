import { HttpError, ok, paginate, clampLimit } from "../core.js";
import { localPhone, randHex, safeHttpsUrl } from "../util.js";

/** السوق المشترك — دروبشيبينغ محلي / شبكة أفلييت B2B فوق المنصة.
 *  المورّد (أي متجر) يدرج منتجه في كتالوج مركزي بثلاثة أرقام: سعر المورّد، السعر العام المقترح، وعمولة ثابتة للقطعة. الأفلييت (متجر آخر) يستورد المنتج بنقرة فيصير منتجاً في كتالوجه (علاقة mk_imports)
 *  بسعر بيعه، ويبقى مخزونه مرآة لمخزون المورّد. عند طلب على متجر الأفلييت: يتحقق «حارس الطلب» (ctx.orderGuards) أن المورّد يملك مخزوناً ورصيداً لدفع العمولة ثم يحجزها من متاحه إلى mk_escrow
 *  (وإلا يُرفض الطلب ويُنبَّه المورّد)، ويُوجَّه الطلب للمورّد ليشحنه ويحصّل ثمنه من الزبون (COD). عند «مُسلَّم» تُنقل العمولة من escrow المورّد إلى متاح الأفلييت، وعند «مرتجع» تعود لمتاح المورّد.
 *  المال لا يتحرك هنا: كل شيء عبر خدمات ctx.wallet (mkHold/mkOut/mkIn/mkBack) التي تقيّد في الدفتر المزدوج. حالة العمولة (mk_orders.state): pending ← available | returned | return_claimed(بانتظار المزوّد) | rejected. */
const SLUG = /^[A-Za-z0-9._-]{1,80}$/, MAX_PRICE = 100_000_000, REF_RE = /^MKO-(\d{1,12})$/;
const txt = (v, n) => String(v ?? "").replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const int = (v) => { const n = Math.round(+v); return Number.isSafeInteger(n) ? n : NaN; };
const imgUrl = (u) => (u && safeHttpsUrl(String(u)) && String(u).length <= 600 ? String(u) : "");
/** الحد الأدنى لسعر بيع الأفلييت: يغطي سعر المورّد + العمولة (الباقي هامش المورّد) */
export const minPrice = (p) => p.supplier_price + p.commission;
/** رسم المنصة من العمولة المحرَّرة (نسبة) */
export const feeOfCommission = (amount, pct) => Math.min(amount, Math.max(0, Math.round(amount * (+pct || 0) / 100)));
/** مرجع الطلب عند المورّد (يستعمله في بوابة الشحن/اللوحة كمرجع للطرد): MKO-<id> */
export const supplierRef = (id) => `MKO-${id}`;
const pubProduct = (p, extra = {}) => ({ id: p.id, slug: p.slug, title: p.title, descr: p.descr, image: p.image, images: JSON.parse(p.images || "[]"), category: p.category, supplier_price: p.supplier_price, rrp: p.rrp, commission: p.commission, min_price: minPrice(p), stock: p.stock, status: p.status, ...extra });

const getCfg = async (ctx) => { const o = {}; for (const x of await ctx.db.all("SELECT k,v FROM mk_config")) o[x.k] = x.v; return { fee_pct: Math.max(0, Math.min(50, +o.fee_pct || 0)), auto_approve: o.auto_approve === "1" }; };
/** يصدر حدث مرآة المخزون ويعالجه فوراً لأوائل المستوردين (الباقي في نبضة cron التالية) فيتحدّث مخزون الأفلييت لحظياً */
async function emitStock(ctx, i, p, n) {
  const x = `mk:stk:${i.id}:${randHex(4)}`; await ctx.emit(i.tenant_id, "marketplace.stock", { slug: i.slug, stock: p.stock, active: p.status === "active" && !!i.active, mp_id: p.id }, x);
  if (n < 25) { try { await ctx.flush(i.tenant_id, x); } catch { /* cron */ } }
}
/** مرآة المخزون/الحالة عند المستوردين (حدث marketplace.stock ← commerce يحدّث كتالوجهم) */
async function broadcastStock(ctx, p) {
  const imps = await ctx.db.all("SELECT id,tenant_id,slug,active FROM mk_imports WHERE mp_id=? LIMIT 500", p.id); let n = 0;
  for (const i of imps) await emitStock(ctx, i, p, n++);
}
/** تسوية سطر طلب (تُنفَّذ مرة واحدة: الحالة تُحجز قبل نقل المال، والقيود بمراجع فريدة فتُعاد بأمان) */
async function settleLine(ctx, row, outcome) {
  const { db } = ctx, claim = await db.run("UPDATE mk_orders SET state=?, updated_at=? WHERE id=? AND state IN ('pending','return_claimed')", outcome === "delivered" ? "releasing" : "refunding", ctx.nowS(), row.id);
  if (!claim.changes) return null; const total = row.commission;
  try {
    if (outcome === "delivered") {
      const fee = feeOfCommission(total, (await getCfg(ctx)).fee_pct);
      await ctx.wallet.mkOut(row.supplier_id, { ref: `mko:${row.id}:out`, amount: total, memo: `عمولة ${supplierRef(row.id)}` });
      await ctx.wallet.mkIn(row.affiliate_id, { ref: `mko:${row.id}:in`, amount: total, fee });
      await db.run("UPDATE mk_orders SET state='available', ship='delivered', fee=?, updated_at=? WHERE id=?", fee, ctx.nowS(), row.id);
      await ctx.emit(row.affiliate_id, "marketplace.commission_released", { order_id: row.ref, mko: supplierRef(row.id), amount: total, fee, net: total - fee }, `mk:rel:${row.id}`);
      await ctx.emit(row.affiliate_id, "order.delivered", { order_id: row.ref, source: "marketplace" }, `mk:del:${row.id}`); return "available";
    }
    await ctx.wallet.mkBack(row.supplier_id, { ref: `mko:${row.id}:back`, amount: total, memo: `مرتجع ${supplierRef(row.id)}` });
    await db.run("UPDATE mk_products SET stock=stock+?, updated_at=? WHERE id=? AND stock IS NOT NULL", row.qty, ctx.nowS(), row.mp_id);
    await db.run("UPDATE mk_orders SET state='returned', ship='returned', updated_at=? WHERE id=?", ctx.nowS(), row.id);
    await ctx.emit(row.supplier_id, "marketplace.commission_returned", { order_id: supplierRef(row.id), amount: total }, `mk:ret:${row.id}`);
    await ctx.emit(row.affiliate_id, "order.returned", { order_id: row.ref, source: "marketplace" }, `mk:retn:${row.id}`);
    const p = await db.one("SELECT * FROM mk_products WHERE id=?", row.mp_id); if (p) await broadcastStock(ctx, p); return "returned";
  } catch (e) { await db.run("UPDATE mk_orders SET state=? WHERE id=? AND state IN ('releasing','refunding')", row.state, row.id); throw e; }
}

export const marketplace = {
  id: "marketplace",
  routes(r, ctx) {
    const { db } = ctx, sandbox = (req) => req.mode !== "live";
    const needVault = () => { if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط"); };

    const cfg = () => getCfg(ctx), broadcast = (p) => broadcastStock(ctx, p), settle = (row, outcome) => settleLine(ctx, row, outcome);

    /* ───── حارس الطلب: يُستدعى من commerce قبل أي حجز ───── */
    ctx.orderGuards.push(async (tid, o) => {
      const slugs = [...new Set(o.lines.map((l) => l.slug))]; if (!slugs.length) return;
      const rows = await db.all(`SELECT i.id iid, i.slug islug, i.price iprice, i.active iactive, p.* FROM mk_imports i JOIN mk_products p ON p.id=i.mp_id WHERE i.tenant_id=? AND i.slug IN (${slugs.map(() => "?").join(",")})`, tid, ...slugs);
      if (!rows.length) return; needVault();
      const phone = localPhone(o.customer?.phone), enc = await ctx.vault.encrypt(phone ?? "", `mk:`), done = [];       // done: ما أُنجز لكل سطر لتراجع كامل عند فشل لاحق
      const undo = async () => { for (const d of done.reverse()) {
        if (d.held) { try { await ctx.wallet.mkBack(d.p.tenant_id, { ref: `mkh:${tid}:${o.ref}:${d.p.id}:undo`, amount: d.commission }); } catch { } }
        if (d.stock) await db.run("UPDATE mk_products SET stock=stock+? WHERE id=? AND stock IS NOT NULL", d.qty, d.p.id);
        if (d.rowId) await db.run("DELETE FROM mk_orders WHERE id=?", d.rowId); } };
      try {
        for (const p of rows) {
          const ln = o.lines.filter((l) => l.slug === p.islug); const qty = ln.reduce((a, l) => a + (l.qty >= 1 && l.qty <= 999 ? l.qty : NaN), 0), unit = p.iprice;      // السعر المعتمد = سعر الاستيراد (لا ما يدّعيه العميل؛ المخالفة تعلّمها commerce)
          if (!Number.isSafeInteger(qty)) throw new HttpError(422, "invalid_quantity", "كمية غير صالحة");
          if (ln.some((l) => l.vkey)) throw new HttpError(422, "variant_unsupported", "منتجات السوق المشترك لا تدعم التنويعات");
          if (!p.iactive || p.status !== "active") throw new HttpError(409, "supplier_unavailable", "هذا المنتج غير متاح حالياً");
          if (p.tenant_id === tid) throw new HttpError(409, "own_product", "لا يمكن بيع منتجك عبر السوق المشترك");
          if (unit < minPrice(p)) throw new HttpError(422, "price_too_low", "سعر البيع أقل من الحد الأدنى للمنتج", { min_price: minPrice(p) });
          const prev = await db.one("SELECT id,state FROM mk_orders WHERE affiliate_id=? AND ref=? AND mp_id=?", tid, o.ref, p.id);
          if (prev && prev.state !== "rejected") continue;           // سبق توجيهه (إعادة محاولة)
          if (prev) await db.run("DELETE FROM mk_orders WHERE id=?", prev.id);
          const d = { p, qty, commission: p.commission * qty, stock: false, held: false, rowId: 0 }; done.push(d);
          if (p.stock != null) { const x = await db.run("UPDATE mk_products SET stock=stock-?, updated_at=? WHERE id=? AND stock>=?", qty, ctx.nowS(), p.id, qty); if (!x.changes) throw new HttpError(409, "out_of_stock", "نفد مخزون هذا المنتج لدى المورّد", { slug: p.islug }); d.stock = true; }
          try { await ctx.wallet.mkHold(p.tenant_id, { ref: `mkh:${tid}:${o.ref}:${p.id}`, amount: d.commission, memo: `عمولة طلب ${o.ref}` }); d.held = true; }
          catch (e) {
            if (e instanceof HttpError && e.code === "insufficient_funds") {          // رصيد المورّد لا يكفي عمولة الطلب ← يُرفض الطلب ويُنبَّه المورّد (رصيد بلا تفاصيل للزبون)
              const now = ctx.nowS(); await db.run("INSERT OR REPLACE INTO mk_orders (ref,affiliate_id,supplier_id,mp_id,slug,title,qty,unit_price,supplier_price,commission,state,detail,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'rejected','supplier_funds',?,?)", o.ref, tid, p.tenant_id, p.id, p.islug, p.title, qty, unit, p.supplier_price, d.commission, now, now);
              await ctx.emit(p.tenant_id, "marketplace.supplier_low_funds", { product: p.title, slug: p.slug, needed: d.commission, affiliate_order: o.ref }, `mk:low:${tid}:${o.ref}:${p.id}`);
              throw new HttpError(409, "supplier_unavailable", "هذا المنتج غير متاح حالياً");
            } throw e; }
          const now = ctx.nowS(), x = await db.run("INSERT INTO mk_orders (ref,affiliate_id,supplier_id,mp_id,slug,title,qty,unit_price,supplier_price,commission,state,name,phone_enc,wilaya,commune,dtype,desk,order_total,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?)",
            o.ref, tid, p.tenant_id, p.id, p.islug, p.title, qty, unit, p.supplier_price, d.commission, txt(o.customer?.name, 80), enc, o.wilaya, o.commune, o.dtype, o.desk, int(o.total) || 0, now, now); d.rowId = x.id;
        }
      } catch (e) { await undo(); throw e; }
      return undo;
    });

    /* ═════════ المورّد: قائمة منتجاتي ═════════ */
    const productInput = (b, cur = null) => {
      const slug = cur ? cur.slug : txt(b.slug, 80); if (!SLUG.test(slug)) throw new HttpError(400, "validation_error", "slug: A-Z a-z 0-9 . _ -", { slug: "A-Za-z0-9._-" });
      const title = txt(b.title ?? cur?.title, 160); if (title.length < 3) throw new HttpError(400, "validation_error", "عنوان المنتج (3 أحرف على الأقل)", { title: "required" });
      const sp = int(b.supplier_price ?? cur?.supplier_price), cm = int(b.commission ?? cur?.commission), rrp = int(b.rrp ?? cur?.rrp ?? NaN);
      if (!(sp >= 1 && sp <= MAX_PRICE)) throw new HttpError(400, "validation_error", "supplier_price: سعر المورّد بالدينار", { supplier_price: "1..1e8" });
      if (!(cm >= 1 && cm <= MAX_PRICE)) throw new HttpError(400, "validation_error", "commission: عمولة الأفلييت للقطعة بالدينار", { commission: "1..1e8" });
      if (!(rrp >= sp + cm && rrp <= MAX_PRICE)) throw new HttpError(400, "validation_error", "rrp: السعر العام المقترح لا يقل عن سعر المورّد + العمولة", { rrp: `≥ ${sp + cm}` });
      const st = b.stock === undefined ? (cur?.stock ?? null) : (b.stock === null || b.stock === "" ? null : int(b.stock)); if (st !== null && !(st >= 0 && st <= 10_000_000)) throw new HttpError(400, "validation_error", "stock: عدد صحيح ≥ 0 أو null", { stock: "0.." });
      const images = (Array.isArray(b.images) ? b.images : JSON.parse(cur?.images ?? "[]")).map(imgUrl).filter(Boolean).slice(0, 8), image = imgUrl(b.image) || (b.image === undefined ? cur?.image : "") || images[0] || "";
      return { slug, title, descr: txt(b.descr ?? cur?.descr, 4000), image, images: JSON.stringify(images), category: txt(b.category ?? cur?.category, 60), supplier_price: sp, rrp, commission: cm, stock: st };
    };
    r.post("/v1/marketplace/products", { scope: "marketplace:write", limit: { key: "mkp", max: 60, win: 3600 }, summary: "إدراج/تعديل منتج في كتالوج السوق (upsert بالـslug): { slug, title, descr, image (https), images[], category, supplier_price, rrp, commission, stock|null }. الجديد ينتظر موافقة المزوّد" }, async (req) => {
      const b = req.json(), tid = req.tenant.id, slug = txt(b.slug, 80), cur = await db.one("SELECT * FROM mk_products WHERE tenant_id=? AND slug=?", tid, slug), d = productInput(b, cur);
      if (!cur && (await db.val("SELECT COUNT(*) FROM mk_products WHERE tenant_id=?", tid)) >= 200) throw new HttpError(402, "plan_limit", "حدّ 200 منتج في السوق");
      if (sandbox(req)) return ok({ ok: true, sandbox: true }, 201); const now = ctx.nowS();
      if (cur) {
        const st = cur.status === "rejected" ? ((await cfg()).auto_approve ? "active" : "pending") : cur.status;
        await db.run("UPDATE mk_products SET title=?,descr=?,image=?,images=?,category=?,supplier_price=?,rrp=?,commission=?,stock=?,status=?,updated_at=? WHERE id=?", d.title, d.descr, d.image, d.images, d.category, d.supplier_price, d.rrp, d.commission, d.stock, st, now, cur.id);
        const p = await db.one("SELECT * FROM mk_products WHERE id=?", cur.id); await broadcast(p); return ok({ id: cur.id, status: st });
      }
      const st = (await cfg()).auto_approve ? "active" : "pending";
      const x = await db.run("INSERT INTO mk_products (tenant_id,slug,title,descr,image,images,category,supplier_price,rrp,commission,stock,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", tid, d.slug, d.title, d.descr, d.image, d.images, d.category, d.supplier_price, d.rrp, d.commission, d.stock, st, now, now);
      await ctx.emit(tid, "marketplace.listed", { id: x.id, slug: d.slug, title: d.title, status: st }, `mk:list:${x.id}`); return ok({ id: x.id, status: st }, 201);
    });
    r.get("/v1/marketplace/products", { scope: "marketplace:read", summary: "منتجاتي المدرجة في السوق مع عدد المستوردين والطلبات" }, async (req) => {
      const rows = await db.all("SELECT * FROM mk_products WHERE tenant_id=? ORDER BY id DESC LIMIT 200", req.tenant.id), out = [];
      for (const p of rows) out.push(pubProduct(p, { note: p.note, importers: await db.val("SELECT COUNT(*) FROM mk_imports WHERE mp_id=? AND active=1", p.id), pending_orders: await db.val("SELECT COUNT(*) FROM mk_orders WHERE mp_id=? AND state='pending'", p.id) }));
      return ok({ products: out });
    });
    r.patch("/v1/marketplace/products/:id", { scope: "marketplace:write", limit: { key: "mkpp", max: 120, win: 3600 }, summary: "تحديث المخزون أو إيقاف/استئناف الإدراج: { stock?, status?: active|paused }" }, async (req) => {
      const p = await db.one("SELECT * FROM mk_products WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!p) throw new HttpError(404, "not_found", "المنتج غير موجود"); const b = req.json(); let st = p.status, stock = p.stock;
      if (b.stock !== undefined) { stock = b.stock === null || b.stock === "" ? null : int(b.stock); if (stock !== null && !(stock >= 0 && stock <= 10_000_000)) throw new HttpError(400, "validation_error", "stock غير صالح", { stock: "0.." }); }
      if (b.status !== undefined) { if (!["active", "paused"].includes(b.status)) throw new HttpError(400, "validation_error", "status: active|paused"); if (!["active", "paused"].includes(p.status)) throw new HttpError(409, "bad_state", "المنتج بانتظار المراجعة أو موقوف من الإدارة"); st = b.status; }
      await db.run("UPDATE mk_products SET stock=?, status=?, updated_at=? WHERE id=?", stock, st, ctx.nowS(), p.id); await broadcast({ ...p, stock, status: st }); return ok({ ok: true, stock, status: st });
    });

    /* ═════════ الأفلييت: الكتالوج والاستيراد ═════════ */
    r.get("/v1/marketplace/catalog", { scope: "marketplace:read", summary: "كتالوج السوق (منتجات نشطة من متاجر أخرى): ?q=&category=&sort=new|commission|price&limit=&after=" }, async (req) => {
      const lim = clampLimit(req.query.limit, 24, 60), a = [req.tenant.id], w = ["p.status='active'", "p.tenant_id<>?"];
      const q = txt(req.query.q, 60); if (q) { w.push("(p.title LIKE ? OR p.descr LIKE ?)"); a.push(`%${q}%`, `%${q}%`); }
      const cat = txt(req.query.category, 60); if (cat) { w.push("p.category=?"); a.push(cat); }
      const sort = req.query.sort === "commission" ? "p.commission DESC, p.id DESC" : req.query.sort === "price" ? "p.supplier_price ASC, p.id DESC" : "p.id DESC", off = Math.max(0, Math.floor(+req.query.offset) || 0);
      const rows = await db.all(`SELECT p.*, t.name supplier_name, (SELECT i.id FROM mk_imports i WHERE i.mp_id=p.id AND i.tenant_id=?) imported_id FROM mk_products p JOIN pf_tenants t ON t.id=p.tenant_id WHERE ${w.join(" AND ")} ORDER BY ${sort} LIMIT ? OFFSET ?`, req.tenant.id, ...a, lim + 1, off);
      const more = rows.length > lim; return ok({ products: rows.slice(0, lim).map((p) => pubProduct(p, { supplier: p.supplier_name, imported: !!p.imported_id })), next_offset: more ? off + lim : null });
    });
    r.post("/v1/marketplace/imports", { scope: "marketplace:write", limit: { key: "mki", max: 60, win: 3600 }, summary: "استيراد منتج من الكتالوج بنقرة: { mp_id, price? (افتراضي السعر المقترح، ≥ الحد الأدنى), slug? }. يعيد بيانات المنتج لإنشائه في متجرك" }, async (req) => {
      const b = req.json(), tid = req.tenant.id, p = await db.one("SELECT * FROM mk_products WHERE id=? AND status='active'", int(b.mp_id)); if (!p) throw new HttpError(404, "not_found", "المنتج غير موجود أو غير متاح");
      if (p.tenant_id === tid) throw new HttpError(409, "own_product", "هذا منتجك أنت"); const price = b.price === undefined ? p.rrp : int(b.price);
      if (!(price >= minPrice(p) && price <= MAX_PRICE)) throw new HttpError(400, "validation_error", `السعر لا يقل عن ${minPrice(p)} دج (سعر المورّد + العمولة)`, { price: `≥ ${minPrice(p)}` });
      const slug = b.slug === undefined ? `mp-${p.slug}`.slice(0, 80) : txt(b.slug, 80); if (!SLUG.test(slug)) throw new HttpError(400, "validation_error", "slug غير صالح", { slug: "A-Za-z0-9._-" });
      if (sandbox(req)) return ok({ ok: true, sandbox: true }, 201);
      const ex = await db.one("SELECT * FROM mk_imports WHERE tenant_id=? AND mp_id=?", tid, p.id), now = ctx.nowS(); let id;
      if (ex) { await db.run("UPDATE mk_imports SET price=?, active=1 WHERE id=?", price, ex.id); id = ex.id; }
      else { if ((await db.val("SELECT COUNT(*) FROM mk_imports WHERE tenant_id=?", tid)) >= 300) throw new HttpError(402, "plan_limit", "حدّ 300 منتج مستورد");
        try { id = (await db.run("INSERT INTO mk_imports (tenant_id,mp_id,slug,price,active,created_at) VALUES (?,?,?,?,1,?)", tid, p.id, slug, price, now)).id; } catch (e) { if (/UNIQUE|constraint/i.test(String(e?.message))) throw new HttpError(409, "slug_taken", "هذا الـslug مستعمل لديك"); throw e; } }
      const imp = await db.one("SELECT * FROM mk_imports WHERE id=?", id);
      await ctx.emit(tid, "marketplace.imported", { mp_id: p.id, slug: imp.slug, title: p.title, price, stock: p.stock, category: p.category }, `mk:imp:${id}:${randHex(4)}`);
      return ok({ id, slug: imp.slug, price, product: pubProduct(p) }, ex ? 200 : 201);
    });
    r.get("/v1/marketplace/imports", { scope: "marketplace:read", summary: "منتجاتي المستوردة مع مخزون المورّد الحيّ وحالته (للتزامن مع كتالوج المتجر)" }, async (req) => {
      const rows = await db.all("SELECT i.id,i.slug,i.price,i.active,i.mp_id,i.created_at, p.title,p.descr,p.image,p.images,p.category,p.supplier_price,p.rrp,p.commission,p.stock,p.status FROM mk_imports i JOIN mk_products p ON p.id=i.mp_id WHERE i.tenant_id=? ORDER BY i.id DESC LIMIT 300", req.tenant.id);
      return ok({ imports: rows.map((x) => ({ id: x.id, slug: x.slug, price: x.price, active: !!x.active, mp_id: x.mp_id, min_price: x.supplier_price + x.commission, sellable: x.status === "active" && !!x.active && (x.stock == null || x.stock > 0) && x.price >= x.supplier_price + x.commission,
        title: x.title, descr: x.descr, image: x.image, images: JSON.parse(x.images || "[]"), category: x.category, rrp: x.rrp, commission: x.commission, stock: x.stock, product_status: x.status })) });
    });
    r.patch("/v1/marketplace/imports/:id", { scope: "marketplace:write", limit: { key: "mkip", max: 120, win: 3600 }, summary: "تغيير سعر بيع منتج مستورد أو إيقافه/استئنافه: { price?, active? }" }, async (req) => {
      const i = await db.one("SELECT i.*, p.supplier_price, p.commission, p.stock, p.status, p.title, p.category FROM mk_imports i JOIN mk_products p ON p.id=i.mp_id WHERE i.id=? AND i.tenant_id=?", +req.params.id, req.tenant.id); if (!i) throw new HttpError(404, "not_found", "غير موجود"); const b = req.json();
      let price = i.price, active = i.active; if (b.price !== undefined) { price = int(b.price); if (!(price >= i.supplier_price + i.commission && price <= MAX_PRICE)) throw new HttpError(400, "validation_error", `السعر لا يقل عن ${i.supplier_price + i.commission} دج`, { price: `≥ ${i.supplier_price + i.commission}` }); }
      if (b.active !== undefined) active = b.active ? 1 : 0; await db.run("UPDATE mk_imports SET price=?, active=? WHERE id=?", price, active, i.id);
      await ctx.emit(req.tenant.id, "marketplace.imported", { mp_id: i.mp_id, slug: i.slug, title: i.title, price, stock: i.stock, category: i.category }, `mk:imp:${i.id}:${randHex(4)}`);
      await ctx.emit(req.tenant.id, "marketplace.stock", { slug: i.slug, stock: i.stock, active: !!active && i.status === "active", mp_id: i.mp_id }, `mk:stk:${i.id}:${randHex(4)}`); return ok({ ok: true, price, active: !!active });
    });

    /* ═════════ الطلبات الموجَّهة ═════════ */
    const orderOut = async (o, role) => {
      const base = { id: o.id, mko: supplierRef(o.id), ref: o.ref, title: o.title, slug: o.slug, qty: o.qty, unit_price: o.unit_price, supplier_price: o.supplier_price, commission: o.commission, fee: o.fee, net_commission: o.commission - o.fee, state: o.state, ship: o.ship, detail: o.detail, order_total: o.order_total, created_at: o.created_at, updated_at: o.updated_at };
      if (role === "supplier" && o.state !== "rejected") return { ...base, customer: { name: o.name, phone: o.phone_enc ? await ctx.vault.decrypt(o.phone_enc, `mk:`) : "", wilaya: o.wilaya, commune: o.commune, dtype: o.dtype, desk: o.desk }, collect: o.order_total };
      return role === "supplier" ? base : { ...base, customer: { name: o.name, wilaya: o.wilaya } };
    };
    r.get("/v1/marketplace/orders", { scope: "marketplace:read", summary: "الطلبات الموجَّهة: ?role=supplier (للشحن، ببيانات الزبون) | affiliate (عمولاتي) &state=" }, async (req) => {
      needVault(); const role = req.query.role === "supplier" ? "supplier" : "affiliate", lim = clampLimit(req.query.limit, 50, 100), after = +req.query.after || 0, a = [req.tenant.id];
      let q = `SELECT * FROM mk_orders WHERE ${role === "supplier" ? "supplier_id" : "affiliate_id"}=?`; if (["pending", "available", "returned", "return_claimed", "rejected"].includes(req.query.state)) { q += " AND state=?"; a.push(req.query.state); } if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim), out = []; for (const o of pg.items) out.push(await orderOut(o, role)); return ok({ orders: out, next: pg.next });
    });
    r.post("/v1/marketplace/orders/:id/status", { scope: "marketplace:write", limit: { key: "mkos", max: 300, win: 3600 }, summary: "المورّد يحدّث الطلب: { status: shipped|delivered|cancelled|returned }. delivered ← تُحرَّر العمولة للأفلييت؛ cancelled قبل الشحن ← تعود للمورّد؛ returned ← تنتظر تأكيد الناقل/المزوّد" }, async (req) => {
      const o = await db.one("SELECT * FROM mk_orders WHERE id=? AND supplier_id=?", +req.params.id, req.tenant.id); if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود"); const st = String(req.json().status ?? "");
      if (!["shipped", "delivered", "cancelled", "returned"].includes(st)) throw new HttpError(400, "validation_error", "status: shipped|delivered|cancelled|returned"); if (o.state !== "pending") throw new HttpError(409, "bad_state", "الطلب مُسوّى أو بانتظار قرار الإدارة");
      if (st === "shipped") { if (o.ship !== "new") throw new HttpError(409, "bad_state", "الطلب شُحن سابقاً"); await db.run("UPDATE mk_orders SET ship='shipped', updated_at=? WHERE id=?", ctx.nowS(), o.id); await ctx.emit(o.affiliate_id, "order.shipped", { order_id: o.ref, source: "marketplace" }, `mk:shp:${o.id}`); return ok({ ok: true, ship: "shipped" }); }
      if (st === "delivered") return ok({ ok: true, state: await settle(o, "delivered") });
      if (st === "cancelled" && o.ship === "new") return ok({ ok: true, state: await settle(o, "returned") });         // لم يُشحن: لا ضرر على الأفلييت سوى فقدان البيع
      await db.run("UPDATE mk_orders SET state='return_claimed', updated_at=? WHERE id=? AND state='pending'", ctx.nowS(), o.id);          // ادّعاء مورّد بلا ناقل: العمولة تبقى محجوزة حتى قرار المزوّد
      await ctx.emit(o.supplier_id, "marketplace.return_claimed", { order_id: supplierRef(o.id) }, `mk:rc:${o.id}`); return ok({ ok: true, state: "return_claimed", note: "العمولة محجوزة حتى تأكيد الناقل أو قرار الإدارة" });
    });
    r.get("/v1/marketplace/wallet", { scope: "marketplace:read", summary: "ملخص السوق للمحفظة: متاحي، محجوز كمورّد (mk_escrow)، عمولاتي المعلّقة والمحرَّرة كأفلييت" }, async (req) => {
      const tid = req.tenant.id, sum = async (col, state) => Number(await db.val(`SELECT COALESCE(SUM(commission-fee*(${state === "available" ? 1 : 0})),0) FROM mk_orders WHERE ${col}=? AND state=?`, tid, state)) || 0;
      return ok({ available: await ctx.wallet.balance(tid, "available"), supplier_escrow: await ctx.wallet.balance(tid, "mk_escrow"), affiliate: { pending: await sum("affiliate_id", "pending"), available: await sum("affiliate_id", "available"), returned: await sum("affiliate_id", "returned") },
        supplier: { rejected_for_funds: await db.val("SELECT COUNT(*) FROM mk_orders WHERE supplier_id=? AND state='rejected' AND detail='supplier_funds' AND created_at>?", tid, ctx.nowS() - 7 * 86400), to_ship: await db.val("SELECT COUNT(*) FROM mk_orders WHERE supplier_id=? AND state='pending' AND ship='new'", tid) } });
    });

    /* ═════════ إدارة المزوّد ═════════ */
    r.get("/admin/marketplace/products", { auth: "admin", summary: "منتجات السوق للمراجعة (?status=pending|active|paused|rejected|suspended)" }, async (req) => {
      const st = ["pending", "active", "paused", "rejected", "suspended"].includes(req.query.status) ? req.query.status : "pending";
      return ok({ products: (await db.all("SELECT p.*, t.name supplier FROM mk_products p JOIN pf_tenants t ON t.id=p.tenant_id WHERE p.status=? ORDER BY p.id LIMIT 100", st)).map((p) => pubProduct(p, { tenant_id: p.tenant_id, supplier: p.supplier, note: p.note })) });
    });
    const modTo = (action, from, to) => async (req) => {
      const p = await db.one("SELECT * FROM mk_products WHERE id=?", +req.params.id); if (!p) throw new HttpError(404, "not_found", "غير موجود");
      const c = await db.run(`UPDATE mk_products SET status=?, note=?, updated_at=? WHERE id=? AND status IN (${from.map(() => "?").join(",")})`, to, txt(req.json().note, 200), ctx.nowS(), p.id, ...from); if (!c.changes) throw new HttpError(409, "bad_state", "الحالة الحالية لا تسمح بهذا الإجراء");
      await ctx.audit(req.actor, "marketplace.product." + action, p.tenant_id, { id: p.id }); await broadcast({ ...p, status: to }); await ctx.emit(p.tenant_id, "marketplace.product_" + to, { id: p.id, slug: p.slug, note: txt(req.json().note, 200) }, `mk:mod:${p.id}:${to}:${randHex(4)}`); return ok({ ok: true, status: to });
    };
    r.post("/admin/marketplace/products/:id/approve", { auth: "admin", summary: "اعتماد منتج للظهور في الكتالوج" }, modTo("approve", ["pending", "rejected", "suspended"], "active"));
    r.post("/admin/marketplace/products/:id/reject", { auth: "admin", summary: "رفض منتج: { note }" }, modTo("reject", ["pending", "active", "paused"], "rejected"));
    r.post("/admin/marketplace/products/:id/suspend", { auth: "admin", summary: "إيقاف منتج نشط من الإدارة: { note }" }, modTo("suspend", ["active", "paused"], "suspended"));
    r.get("/admin/marketplace/orders", { auth: "admin", summary: "الطلبات الموجَّهة (?state=return_claimed بانتظار القرار | pending | available | returned | rejected)" }, async (req) => {
      const st = ["pending", "available", "returned", "return_claimed", "rejected"].includes(req.query.state) ? req.query.state : "return_claimed";
      return ok({ orders: (await db.all("SELECT id,ref,affiliate_id,supplier_id,mp_id,title,qty,commission,fee,state,ship,detail,created_at,updated_at FROM mk_orders WHERE state=? ORDER BY id DESC LIMIT 100", st)).map((o) => ({ ...o, mko: supplierRef(o.id) })) });
    });
    r.post("/admin/marketplace/orders/:id/resolve", { auth: "admin", summary: "حسم نزاع طلب (return_claimed أو pending): { outcome: delivered|returned } — delivered يحرّر العمولة للأفلييت، returned تعود للمورّد" }, async (req) => {
      const o = await db.one("SELECT * FROM mk_orders WHERE id=?", +req.params.id); if (!o) throw new HttpError(404, "not_found", "غير موجود"); const outcome = req.json().outcome; if (!["delivered", "returned"].includes(outcome)) throw new HttpError(400, "validation_error", "outcome: delivered|returned");
      const s = await settle(o, outcome); if (!s) throw new HttpError(409, "bad_state", "الطلب مُسوّى"); await ctx.audit(req.actor, "marketplace.order.resolve", o.supplier_id, { id: o.id, outcome }); return ok({ ok: true, state: s });
    });
    r.get("/admin/marketplace/settings", { auth: "admin", summary: "إعدادات السوق: fee_pct (رسم المنصة من العمولة المحرَّرة 0–50) · auto_approve" }, async () => ok(await cfg()));
    r.put("/admin/marketplace/settings", { auth: "admin", summary: "ضبط fee_pct و/أو auto_approve" }, async (req) => {
      const b = req.json(); if (b.fee_pct !== undefined) { const v = +b.fee_pct; if (!Number.isFinite(v) || v < 0 || v > 50) throw new HttpError(400, "validation_error", "fee_pct بين 0 و50"); await db.run("INSERT INTO mk_config (k,v) VALUES ('fee_pct',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", String(v)); }
      if (b.auto_approve !== undefined) await db.run("INSERT INTO mk_config (k,v) VALUES ('auto_approve',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", b.auto_approve ? "1" : "0"); await ctx.audit(req.actor, "marketplace.settings", 0, b); return ok(await cfg());
    });
  },
  on: {
    /** طلب جديد على متجر أفلييت: يُبلَّغ المورّد (حدث ← مستمعون كالـwebhooks) ويُحدَّث مخزون المرآة عند كل المستوردين */
    "order.created": async (e, ctx) => {
      const ref = String(e.data?.order_id ?? ""); if (!ref) return; const rows = await ctx.db.all("SELECT * FROM mk_orders WHERE affiliate_id=? AND ref=? AND state='pending'", e.tenantId, ref);
      for (const o of rows) {
        await ctx.emit(o.supplier_id, "marketplace.order_routed", { order_id: supplierRef(o.id), title: o.title, qty: o.qty, commission: o.commission, collect: o.order_total }, `mk:routed:${o.id}`);
        const p = await ctx.db.one("SELECT * FROM mk_products WHERE id=?", o.mp_id); if (!p) continue;
        await broadcastStock(ctx, p);
      }
    },
    /** حالة الشحن من بوابة الشحن أو المورّد (order_id = MKO-<id> على مستأجر المورّد): delivered تحرّر العمولة؛ cancelled/returned/failed تُعاد للمورّد فقط من ناقل موثوق (gw:) أو قبل الشحن، وإلا تنتظر قرار المزوّد */
    ...Object.fromEntries([["order.delivered", "delivered"], ["order.returned", "returned"], ["order.cancelled", "returned"], ["order.failed", "returned"]].map(([t, outcome]) => [t, async (e, ctx) => {
      const m = REF_RE.exec(String(e.data?.order_id ?? "")); if (!m) return; const o = await ctx.db.one("SELECT * FROM mk_orders WHERE id=? AND supplier_id=?", +m[1], e.tenantId); if (!o || o.state !== "pending") return;
      const src = String((await ctx.db.val("SELECT ext_id FROM pf_events WHERE id=?", e.id)) ?? ""), carrier = src.startsWith("gw:");
      if (outcome === "delivered" || carrier || (t !== "order.returned" && o.ship === "new")) return void (await settleLine(ctx, o, outcome));
      await ctx.db.run("UPDATE mk_orders SET state='return_claimed', updated_at=? WHERE id=? AND state='pending'", ctx.nowS(), o.id);
      await ctx.emit(o.supplier_id, "marketplace.return_claimed", { order_id: supplierRef(o.id) }, `mk:rc:${o.id}`);
    }])),
  },
};
