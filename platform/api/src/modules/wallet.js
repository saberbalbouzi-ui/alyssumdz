import { DB, HttpError, ok, paginate, clampLimit } from "../core.js";
import { hmacHex, parseProof, randHex, safeEq, safeHttpsUrl } from "../util.js";

/** المحفظة والدفتر (Wallet & Ledger) — قلب الأموال في المنصة.
 *  دفتر قيد مزدوج غير قابل للتعديل: كل معاملة `wl_tx` لها أرجل `wl_legs` مجموعها صفر لكل عملة، والأرصدة المخزَّنة نسخة محسوبة منها.
 *  حسابات المستأجر (لا تنزل تحت الصفر): available · escrow · withdraw_hold · ads_credit. حسابات النظام (مستأجر 0، قد تنزل): ext_payments · ext_deposits · ext_payouts ·
 *  ext_refunds · ext_ad_spend · fx_clearing · platform_fees. إشارة الرصيد: الرصيد الموجب لحساب المستأجر = ما تدين به المنصة له.
 *  الوحدات الأخرى لا تلمس الأموال أبداً: تُصدر أحداثاً (payment.confirmed / order.delivered…) وهذه الوحدة تستمع وتقيّد. المبالغ صحيحة بأصغر وحدة (دج، سنت). */
export const MINOR = { DZD: 1, USD: 100, EUR: 100 };
export const TENANT_ACCTS = ["available", "escrow", "withdraw_hold", "ads_credit", "mk_escrow"];       // mk_escrow: عمولات السوق المشترك المحجوزة عند المورّد حتى «تسليم» الطلب
/** بادئات extId للمزوّدين الداخليين الموثوقين (payments.js يولّد `chargily:<حدث>:<حالة>`) */
export const TRUSTED_PAYMENT_SOURCES = ["chargily:"];
const METHODS = ["ccp", "baridimob", "bank", "redotpay", "paypal"], MAX = 1_000_000_000;
const intOk = (n) => Number.isSafeInteger(n) && n !== 0 && Math.abs(n) <= MAX * 100;

/** تحقق نقي من أرجل قيد: ≥2 أرجل، مبالغ صحيحة غير صفرية، عملات معروفة، والمجموع صفر لكل عملة. يرجع نص الخطأ أو "" */
export function checkLegs(legs) {
  if (!Array.isArray(legs) || legs.length < 2) return "قيد بأقل من رجلين";
  const sum = {}; for (const l of legs) { if (!(l.ccy in MINOR)) return "عملة غير معروفة"; if (!intOk(l.amount)) return "مبلغ غير صالح"; if (!/^[a-z_]{3,24}$/.test(l.code)) return "حساب غير صالح"; sum[l.ccy] = (sum[l.ccy] ?? 0) + l.amount; }
  return Object.values(sum).every((v) => v === 0) ? "" : "القيد غير متوازن";
}
/** رسم المنصة على مبلغ محرَّر: نسبة + ثابت، لا يتجاوز المبلغ */
export const feeOf = (amount, w = {}) => Math.min(amount, Math.max(0, Math.round(amount * (+w.fee_pct || 0) / 100) + Math.max(0, Math.floor(+w.fee_fixed) || 0)));

/** يقيّد معاملة بأرجلها ذرّياً بقدر الإمكان: الخصم أولاً (فشل الرصيد لا يترك أثراً)، وأي فشل يُعكَس. ref فريد لكل مستأجر = عدم تكرار القيد. */
export async function post(ctx, tid, { ref, kind, memo = "", order_id = null, legs }) {
  const bad = checkLegs(legs); if (bad) throw new HttpError(500, "ledger_invalid", bad);
  let txId; try { txId = (await ctx.db.run("INSERT INTO wl_tx (tenant_id,ref,kind,memo,order_id,created_at) VALUES (?,?,?,?,?,?)", tid, String(ref).slice(0, 120), kind, String(memo).slice(0, 200), order_id, ctx.nowS())).id; }
  catch (e) { if (DB.isUnique(e)) return { duplicate: true }; throw e; }
  const applied = [];
  try {
    for (const l of [...legs].sort((a, b) => a.amount - b.amount)) {
      const tenantOwned = TENANT_ACCTS.includes(l.code), owner = tenantOwned ? tid : 0;
      await ctx.db.run("INSERT OR IGNORE INTO wl_accounts (tenant_id,code,currency,balance) VALUES (?,?,?,0)", owner, l.code, l.ccy);
      const a = await ctx.db.one("SELECT id FROM wl_accounts WHERE tenant_id=? AND code=? AND currency=?", owner, l.code, l.ccy);
      const x = tenantOwned && l.amount < 0 ? await ctx.db.run("UPDATE wl_accounts SET balance=balance+? WHERE id=? AND balance+?>=0", l.amount, a.id, l.amount) : await ctx.db.run("UPDATE wl_accounts SET balance=balance+? WHERE id=?", l.amount, a.id);
      if (!x.changes) throw new HttpError(409, "insufficient_funds", "الرصيد غير كافٍ");
      applied.push({ id: a.id, amount: l.amount }); await ctx.db.run("INSERT INTO wl_legs (tx_id,account_id,amount) VALUES (?,?,?)", txId, a.id, l.amount);
    }
  } catch (e) { for (const a of applied) await ctx.db.run("UPDATE wl_accounts SET balance=balance-? WHERE id=?", a.amount, a.id); await ctx.db.run("DELETE FROM wl_legs WHERE tx_id=?", txId); await ctx.db.run("DELETE FROM wl_tx WHERE id=?", txId); throw e; }
  return { id: txId };
}
/** إعدادات المحفظة في جدول الوحدة نفسها wl_settings؛ القراءة تعود إلى pf_tenants.settings.wallet القديمة (قراءة فقط) */
const walletSettings = async (ctx, tid) => { const own = await ctx.db.val("SELECT settings FROM wl_settings WHERE tenant_id=?", tid); if (own) return JSON.parse(own); return JSON.parse((await ctx.db.val("SELECT settings FROM pf_tenants WHERE id=?", tid)) || "{}").wallet ?? {}; };

/** تسوية ضمان طلب: delivered ← تحرير للمتاح بعد رسم المنصة، cancelled ← استرداد مستحق للزبون. يحجز الصف أولاً فلا تُنفَّذ مرتان. */
async function settle(ctx, tid, orderId, outcome) {
  const esc = await ctx.db.one("SELECT * FROM wl_escrow WHERE tenant_id=? AND order_id=? AND state='held'", tid, orderId); if (!esc) return null;
  const claim = await ctx.db.run("UPDATE wl_escrow SET state=? WHERE id=? AND state='held'", outcome === "delivered" ? "releasing" : "refunding", esc.id); if (!claim.changes) return null;
  try {
    if (outcome === "delivered") {
      const fee = feeOf(esc.amount, await walletSettings(ctx, tid)), legs = [{ code: "escrow", ccy: esc.currency, amount: -esc.amount }, { code: "available", ccy: esc.currency, amount: esc.amount - fee }];
      if (fee) legs.push({ code: "platform_fees", ccy: esc.currency, amount: fee }); if (esc.amount - fee === 0) legs.splice(1, 1);
      await post(ctx, tid, { ref: `release:${orderId}`, kind: "escrow_release", order_id: orderId, memo: fee ? `رسم المنصة ${fee}` : "", legs });
      await ctx.db.run("UPDATE wl_escrow SET state='released', fee=?, settled_at=? WHERE id=?", fee, ctx.nowS(), esc.id);
      await ctx.emit(tid, "wallet.escrow_released", { order_id: orderId, amount: esc.amount, fee, net: esc.amount - fee, currency: esc.currency }, `wl:rel:${orderId}`); return "released";
    }
    await post(ctx, tid, { ref: `refund:${orderId}`, kind: "escrow_refund", order_id: orderId, legs: [{ code: "escrow", ccy: esc.currency, amount: -esc.amount }, { code: "ext_refunds", ccy: esc.currency, amount: esc.amount }] });
    await ctx.db.run("UPDATE wl_escrow SET state='refunded', settled_at=? WHERE id=?", ctx.nowS(), esc.id);
    await ctx.emit(tid, "wallet.refund_due", { order_id: orderId, amount: esc.amount, currency: esc.currency }, `wl:ref:${orderId}`); return "refunded";
  } catch (e) { await ctx.db.run("UPDATE wl_escrow SET state='held' WHERE id=? AND state IN ('releasing','refunding')", esc.id); throw e; }
}
/** بوابة الشحن (extId «gw:…» عبر /admin/events فقط) هي المصدر الموثوق للتسليم؛ مع wallet.require_carrier لا يحرّر الضمان إلا هي (حدث التاجر من /v1/events لا يكفي) */
const CARRIER_PREFIXES = ["gw:", "dg:"];       // gw: بوابة الشحن، dg: تسليم رقمي من وحدة digital (كلاهما لا يولّدهما /v1/events)
const terminal = (outcome) => async (e, ctx) => {
  const oid = String(e.data?.order_id ?? "").slice(0, 80); if (!oid) return;
  if (outcome === "delivered" && (await walletSettings(ctx, e.tenantId)).require_carrier) { const src = String((await ctx.db.val("SELECT ext_id FROM pf_events WHERE id=?", e.id)) ?? ""); if (!CARRIER_PREFIXES.some((p) => src.startsWith(p))) return; }
  await ctx.db.run("INSERT OR IGNORE INTO wl_orders (tenant_id,order_id,outcome,at) VALUES (?,?,?,?)", e.tenantId, oid, outcome, ctx.nowS());      // أول حالة نهائية تُعتمد
  const o = await ctx.db.val("SELECT outcome FROM wl_orders WHERE tenant_id=? AND order_id=?", e.tenantId, oid); await settle(ctx, e.tenantId, oid, o);
};

export const wallet = {
  id: "wallet",
  routes(r, ctx) {
    const { db } = ctx, sandbox = (req) => req.mode !== "live";
    /** خدمة شراء الخدمات للوحدات الأخرى (الاستثناء الموثّق الوحيد لقاعدة «لا استدعاء مباشر بين الوحدات»، انظر ARCHITECTURE.md §3):
     *  المبلغ يُحجز من المتاح إلى الضمان ثم يُحرَّر لرسوم المنصة عند التسليم أو يُردّ للمتاح عند الرفض. كل قيد مرجعه فريد فلا يتكرر. */
    const svc = (kind, from, to) => (tid, { ref, amount, memo = "" }) => {
      const n = Math.round(+amount); if (!Number.isSafeInteger(n) || n < 1 || n > MAX) throw new HttpError(400, "validation_error", "مبلغ غير صالح");
      return post(ctx, tid, { ref: String(ref), kind, memo, legs: [{ code: from, ccy: "DZD", amount: -n }, { code: to, ccy: "DZD", amount: n }] });
    };
    ctx.wallet = { hold: svc("service_hold", "available", "escrow"), release: svc("service_sale", "escrow", "platform_fees"), refund: svc("service_refund", "escrow", "available"),
      /* متجر التطبيقات (تقاسم الإيراد): charge يخصم من متاح المشتري إلى حساب وسيط app_clearing، ثم payout يوزّع منه نصيب المطوّر (متاح المطوّر) وfee عمولة المنصة، أو unwind يعيده للمشتري */
      charge: svc("app_purchase", "available", "app_clearing"), payout: svc("app_revenue", "app_clearing", "available"), fee: svc("app_commission", "app_clearing", "platform_fees"), unwind: svc("app_refund", "app_clearing", "available"),
      /* استرداد ثمن تطبيق: clawback يسحب حصة المطوّر من متاحه (يفشل إن سحبها)، feeback يعيد عمولة المنصة، ثم unwind يردّ المجموع للمشتري */
      clawback: svc("app_clawback", "available", "app_clearing"), feeback: svc("app_commission_back", "platform_fees", "app_clearing") };
    /* السوق المشترك (وحدة marketplace) — ضمان العمولات: المورّد يحجز العمولة من متاحه إلى mk_escrow عند الطلب، وتُحرَّر للأفلييت عند «مُسلَّم» أو تعود للمورّد عند «مرتجع».
       الانتقال بين مستأجرَين يمرّ بحساب وسيط mk_clearing (نظام، قد يهبط تحت الصفر) في قيدين منفصلين لكل منهما مرجع فريد فيُعاد تنفيذه بأمان. */
    const bal = async (tid, code) => Number(await db.val("SELECT balance FROM wl_accounts WHERE tenant_id=? AND code=? AND currency='DZD'", tid, code)) || 0;
    Object.assign(ctx.wallet, {
      balance: bal,
      mkHold: svc("mk_hold", "available", "mk_escrow"), mkBack: svc("mk_back", "mk_escrow", "available"), mkOut: svc("mk_payout_out", "mk_escrow", "mk_clearing"),
      mkIn: (tid, { ref, amount, fee = 0 }) => { const n = Math.round(+amount), f = Math.max(0, Math.min(n, Math.round(+fee) || 0)); if (!Number.isSafeInteger(n) || n < 1 || n > MAX) throw new HttpError(400, "validation_error", "مبلغ غير صالح");
        const legs = [{ code: "mk_clearing", ccy: "DZD", amount: -n }]; if (n - f) legs.push({ code: "available", ccy: "DZD", amount: n - f }); if (f) legs.push({ code: "platform_fees", ccy: "DZD", amount: f });
        return post(ctx, tid, { ref: String(ref), kind: "mk_commission", legs }); },
    });
    const balances = async (tid) => { const out = {}; for (const a of await db.all("SELECT code,currency,balance FROM wl_accounts WHERE tenant_id=?", tid)) (out[a.code] ??= {})[a.currency] = a.balance; for (const c of TENANT_ACCTS) out[c] ??= {}; return out; };

    r.get("/v1/wallet", { scope: "wallet:read", summary: "أرصدة المحفظة: available · escrow · withdraw_hold · ads_credit لكل عملة (أصغر وحدة: دج، سنت)" }, async (req) => ok({ balances: await balances(req.tenant.id), settings: pickSettings(await walletSettings(ctx, req.tenant.id)) }));
    r.get("/v1/wallet/ledger", { scope: "wallet:read", summary: "دفتر الحركات (الأحدث أولاً) مع الأرجل؛ kind اختياري، ترقيم limit/after" }, async (req) => {
      const lim = clampLimit(req.query.limit), after = +req.query.after || 0, a = [req.tenant.id]; let q = "SELECT id,ref,kind,memo,order_id,created_at FROM wl_tx WHERE tenant_id=?";
      if (/^[a-z_]{3,24}$/.test(req.query.kind ?? "")) { q += " AND kind=?"; a.push(req.query.kind); } if (after) { q += " AND id<?"; a.push(after); }
      const pg = paginate(await db.all(q + " ORDER BY id DESC LIMIT ?", ...a, lim + 1), lim), legs = pg.items.length ? await db.all(`SELECT l.tx_id, a.code, a.currency, l.amount FROM wl_legs l JOIN wl_accounts a ON a.id=l.account_id WHERE l.tx_id IN (${pg.items.map(() => "?").join(",")})`, ...pg.items.map((x) => x.id)) : [];
      return ok({ entries: pg.items.map((t) => ({ ...t, legs: legs.filter((l) => l.tx_id === t.id).map(({ code, currency, amount }) => ({ account: code, currency, amount })) })), next: pg.next });
    });
    r.get("/v1/wallet/escrow", { scope: "wallet:read", summary: "الأموال المحجوزة (escrow) حسب الطلب: held|released|refunded" }, async (req) => {
      const st = ["held", "released", "refunded"].includes(req.query.state) ? req.query.state : "held";
      return ok({ escrow: await db.all("SELECT order_id,amount,currency,state,fee,created_at,settled_at FROM wl_escrow WHERE tenant_id=? AND state=? ORDER BY id DESC LIMIT 100", req.tenant.id, st) });
    });

    // ── سحب الأرباح: طلب ← موافقة ← صرف (يحجز المبلغ من المتاح فوراً) ──
    r.post("/v1/wallet/withdrawals", { scope: "wallet:write", idem: true, limit: { key: "wdreq", max: 10, win: 3600 }, summary: "طلب سحب من المتاح: { amount (دج), method: ccp|baridimob|bank|redotpay|paypal, destination }" }, async (req) => {
      const b = req.json(), amount = Math.round(+b.amount), method = String(b.method ?? ""), dest = String(b.destination ?? "").replace(/[<>]/g, "").trim().slice(0, 200), w = await walletSettings(ctx, req.tenant.id), min = Math.max(1, Math.floor(+w.min_withdrawal) || 1000);
      if (!Number.isFinite(amount) || amount < min || amount > MAX) throw new HttpError(400, "validation_error", `amount بالدينار، الحد الأدنى ${min}`); if (!METHODS.includes(method)) throw new HttpError(400, "validation_error", "method: " + METHODS.join("|")); if (dest.length < 4) throw new HttpError(400, "validation_error", "destination مطلوب (رقم الحساب/المحفظة)");
      if (!ctx.vault) throw new HttpError(503, "vault_unavailable", "تخزين الأسرار غير مضبوط"); if (sandbox(req)) return ok({ id: 0, status: "requested", sandbox: true }, 201);
      const now = ctx.nowS(), x = await db.run("INSERT INTO wl_withdrawals (tenant_id,amount,currency,method,dest_enc,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)", req.tenant.id, amount, "DZD", method, await ctx.vault.encrypt(dest, `wl:${req.tenant.id}`), "requested", now, now);
      try { await post(ctx, req.tenant.id, { ref: `wd:${x.id}:req`, kind: "withdrawal_request", legs: [{ code: "available", ccy: "DZD", amount: -amount }, { code: "withdraw_hold", ccy: "DZD", amount }] }); }
      catch (e) { await db.run("DELETE FROM wl_withdrawals WHERE id=?", x.id); throw e; }
      await ctx.emit(req.tenant.id, "wallet.withdrawal_requested", { id: x.id, amount, method, currency: "DZD" }, `wl:wdreq:${x.id}`); return ok({ id: x.id, status: "requested", amount }, 201);
    });
    r.get("/v1/wallet/withdrawals", { scope: "wallet:read", summary: "طلبات السحب" }, async (req) => ok({ withdrawals: await db.all("SELECT id,amount,currency,method,status,note,created_at,updated_at FROM wl_withdrawals WHERE tenant_id=? ORDER BY id DESC LIMIT 100", req.tenant.id) }));
    r.delete("/v1/wallet/withdrawals/:id", { scope: "wallet:write", summary: "إلغاء طلب سحب لم يُعتمد بعد (يعود المبلغ للمتاح)" }, async (req) => {
      const w = await db.one("SELECT * FROM wl_withdrawals WHERE id=? AND tenant_id=?", +req.params.id, req.tenant.id); if (!w) throw new HttpError(404, "not_found", "غير موجود");
      const c = await db.run("UPDATE wl_withdrawals SET status='cancelled', updated_at=? WHERE id=? AND status='requested'", ctx.nowS(), w.id); if (!c.changes) throw new HttpError(409, "not_cancellable", "لا يمكن إلغاؤه بعد المراجعة");
      await post(ctx, req.tenant.id, { ref: `wd:${w.id}:cancel`, kind: "withdrawal_cancel", legs: [{ code: "withdraw_hold", ccy: w.currency, amount: -w.amount }, { code: "available", ccy: w.currency, amount: w.amount }] }); return ok({ ok: true });
    });

    // ── رصيد الإعلانات بالدولار (Marketing/Agency): يُشترى من المتاح بسعر صرف تحدّده الإدارة (يشمل هامشها) ──
    const quote = async (tid, usd) => { const w = await walletSettings(ctx, tid), rate = +w.usd_rate; if (!(rate > 0)) throw new HttpError(409, "rate_not_set", "سعر الدولار لم تحدّده الإدارة بعد"); const cents = Math.round(usd * 100); if (!(cents >= 100 && cents <= 500000)) throw new HttpError(400, "validation_error", "usd بين 1 و5000"); return { cents, dzd: Math.ceil((cents / 100) * rate), rate }; };
    r.get("/v1/wallet/ads-quote", { scope: "wallet:read", summary: "سعر شراء رصيد إعلانات بالدولار: ?usd=" }, async (req) => { const q = await quote(req.tenant.id, +req.query.usd); return ok({ usd: q.cents / 100, dzd: q.dzd, rate: q.rate }); });
    r.post("/v1/wallet/ads-topup", { scope: "wallet:write", idem: true, limit: { key: "adtop", max: 20, win: 3600 }, summary: "شراء رصيد إعلانات بالدولار من المتاح: { usd }" }, async (req) => {
      const q = await quote(req.tenant.id, +req.json().usd); if (sandbox(req)) return ok({ ok: true, sandbox: true, usd: q.cents / 100, dzd: q.dzd }, 201);
      const p = await post(ctx, req.tenant.id, { ref: "ads:" + randHex(8), kind: "ads_topup", memo: `${q.cents / 100}$ بسعر ${q.rate}`, legs: [{ code: "available", ccy: "DZD", amount: -q.dzd }, { code: "fx_clearing", ccy: "DZD", amount: q.dzd }, { code: "fx_clearing", ccy: "USD", amount: -q.cents }, { code: "ads_credit", ccy: "USD", amount: q.cents }] });
      await ctx.emit(req.tenant.id, "wallet.ads_topup", { usd: q.cents / 100, dzd: q.dzd, rate: q.rate }, `wl:ads:${p.id}`); return ok({ ok: true, usd: q.cents / 100, dzd: q.dzd }, 201);
    });

    // ── شحن المحفظة: Chargily (حساب المنصة) أو حوالة CCP بإثبات ──
    const DEP_MIN = 500, DEP_MAX = 5_000_000, CHARGILY_BASE = { test: "https://pay.chargily.net/test/api/v2", live: "https://pay.chargily.net/api/v2" };
    const depPub = (d) => ({ id: d.id, amount: d.amount, method: d.payment_method, status: d.status, has_proof: !!d.proof_image_path, checkout_url: d.status === "pending" ? d.checkout_url : null, note: d.note, created_at: d.created_at, updated_at: d.updated_at });
    /** يعتمد إيداعاً pending ← approved ويقيّده في المتاح مرة واحدة (المرجع فريد والحالة تُحجز قبل القيد) */
    const creditDeposit = async (dep, actor) => {
      const claim = await db.run("UPDATE wl_deposits SET status='approved', updated_at=? WHERE id=? AND status='pending'", ctx.nowS(), dep.id); if (!claim.changes) return false;
      try { await post(ctx, dep.tenant_id, { ref: `dep:wd:${dep.id}`, kind: "deposit", memo: `${dep.payment_method} #${dep.id}`, legs: [{ code: "ext_deposits", ccy: "DZD", amount: -dep.amount }, { code: "available", ccy: "DZD", amount: dep.amount }] }); }
      catch (e) { await db.run("UPDATE wl_deposits SET status='pending' WHERE id=? AND status='approved'", dep.id); throw e; }
      if (actor) await ctx.audit(actor, "wallet.deposit.approve", dep.tenant_id, { id: dep.id, amount: dep.amount, method: dep.payment_method });
      await ctx.emit(dep.tenant_id, "wallet.deposit", { amount: dep.amount, currency: "DZD", ref: `wd:${dep.id}`, method: dep.payment_method }, `wl:dep:wd${dep.id}`); return true;
    };
    r.post("/v1/wallet/deposits", { scope: "wallet:write", idem: true, limit: { key: "wdep", max: 20, win: 3600 }, summary: "طلب شحن المحفظة: { amount (دج), method: chargily|ccp }؛ chargily ← يعيد checkout_url (حساب المنصة)، ccp ← proof صورة الوصل ويوافق عليها المزوّد" }, async (req) => {
      const b = req.json(), tid = req.tenant.id, amount = Math.round(+b.amount), method = String(b.method ?? "");
      if (!Number.isFinite(amount) || amount < DEP_MIN || amount > DEP_MAX) throw new HttpError(400, "validation_error", `amount بالدينار بين ${DEP_MIN} و${DEP_MAX}`); if (!["chargily", "ccp"].includes(method)) throw new HttpError(400, "validation_error", "method: chargily|ccp");
      const now = ctx.nowS();
      if (method === "ccp") {
        const proof = parseProof(b.proof); if (!proof) throw new HttpError(400, "validation_error", "proof: صورة وصل JPEG/PNG/WebP بحجم صغير"); if (sandbox(req)) return ok({ id: 0, status: "pending", sandbox: true }, 201);
        if ((await db.val("SELECT COUNT(*) FROM wl_deposits WHERE tenant_id=? AND payment_method='ccp' AND status='pending'", tid)) >= 3) throw new HttpError(429, "too_many_pending", "لديك 3 حوالات قيد المراجعة؛ انتظر قرار الإدارة");
        const x = await db.run("INSERT INTO wl_deposits (tenant_id,amount,payment_method,status,proof_image_path,payer,created_at,updated_at) VALUES (?,?,'ccp','pending',?,?,?,?)", tid, amount, proof, String(b.payer ?? "").replace(/[<>]/g, "").slice(0, 80), now, now);
        await ctx.emit(tid, "wallet.deposit_submitted", { id: x.id, amount, method: "ccp" }, `wl:depsub:${x.id}`); return ok({ id: x.id, status: "pending", amount }, 201);
      }
      const key = ctx.config.CHARGILY_SECRET_KEY; if (!key) throw new HttpError(503, "provider_not_configured", "الدفع بالبطاقة غير مفعّل بعد على المنصة — استعمل حوالة CCP");
      const origins = req.tenant.settings?.origins ?? [], ret = safeHttpsUrl(b.return_url) ? String(b.return_url) : ""; let okUrl = false; try { okUrl = !!ret && (origins.includes(new URL(ret).origin) || !origins.length); } catch { }
      if (!okUrl) throw new HttpError(400, "validation_error", "return_url: رابط https من أصول موقعك"); if (sandbox(req)) return ok({ id: 0, status: "pending", checkout_url: "https://pay.chargily.dz/test/sandbox/pay", sandbox: true }, 201);
      const x = await db.run("INSERT INTO wl_deposits (tenant_id,amount,payment_method,status,created_at,updated_at) VALUES (?,?,'chargily','pending',?,?)", tid, amount, now, now);
      const pm = ["edahabia", "cib"].includes(b.payment_method) ? b.payment_method : "edahabia", mode = ctx.config.CHARGILY_MODE === "live" ? "live" : "test";
      const body = { amount, currency: "dzd", payment_method: pm, locale: "ar", success_url: ret, failure_url: ret, webhook_endpoint: `${ctx.baseUrl}/v1/wallet/chargily-webhook`, description: "شحن المحفظة", metadata: { deposit_id: x.id, tenant_id: tid } };
      let res, j = {}; try { res = await ctx.fetchFn(CHARGILY_BASE[mode] + "/checkouts", { method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(body) }); j = JSON.parse(await res.text()); } catch { }
      if (!res || res.status < 200 || res.status >= 300 || !j.id || !safeHttpsUrl(j.checkout_url)) { await db.run("UPDATE wl_deposits SET status='failed', updated_at=? WHERE id=?", ctx.nowS(), x.id); throw new HttpError(502, "provider_rejected", "تعذّر إنشاء جلسة الدفع"); }
      try { await db.run("UPDATE wl_deposits SET chargily_checkout_id=?, checkout_url=? WHERE id=?", String(j.id), j.checkout_url, x.id); }
      catch (e) { if (DB.isUnique(e)) { await db.run("UPDATE wl_deposits SET status='failed', updated_at=? WHERE id=?", ctx.nowS(), x.id); throw new HttpError(502, "provider_rejected", "تعذّر إنشاء جلسة الدفع"); } throw e; }
      return ok({ id: x.id, status: "pending", checkout_url: j.checkout_url }, 201);
    });
    r.get("/v1/wallet/deposits", { scope: "wallet:read", summary: "طلبات شحن المحفظة (بلا صور الإثبات)" }, async (req) => ok({ deposits: (await db.all("SELECT * FROM wl_deposits WHERE tenant_id=? ORDER BY id DESC LIMIT 50", req.tenant.id)).map(depPub), min: DEP_MIN, chargily: !!ctx.config.CHARGILY_SECRET_KEY }));
    // إشعار Chargily: التوقيع إلزامي (HMAC-SHA256 للجسم الخام) والمبلغ يطابق المسجَّل وإلا يُتجاهل؛ الاعتماد مرة واحدة
    r.post("/v1/wallet/chargily-webhook", { auth: "public", limit: { key: "wdhook", max: 300, win: 60 }, summary: "إشعارات Chargily لشحن المحفظة (checkout.paid|failed|canceled)" }, async (req) => {
      const secret = ctx.config.CHARGILY_WEBHOOK_SECRET || ctx.config.CHARGILY_SECRET_KEY; if (!secret) throw new HttpError(401, "unauthorized", "غير مضبوط");
      const sig = req.headers["signature"]; if (!sig) throw new HttpError(400, "bad_request", "ترويسة signature مفقودة"); if (!safeEq(String(sig), await hmacHex(secret, req.raw))) throw new HttpError(403, "forbidden", "توقيع غير صالح");
      const ev = req.json(), id = String(ev?.data?.id ?? ""); if (!id || !["checkout.paid", "checkout.failed", "checkout.canceled"].includes(ev.type)) return ok({ ok: true, ignored: true });
      const dep = await db.one("SELECT * FROM wl_deposits WHERE chargily_checkout_id=?", id); if (!dep) return ok({ ok: true, ignored: "unknown_checkout" }); if (dep.status !== "pending") return ok({ ok: true, duplicate: true });
      if (ev.type !== "checkout.paid") { await db.run("UPDATE wl_deposits SET status='failed', updated_at=? WHERE id=? AND status='pending'", ctx.nowS(), dep.id); return ok({ ok: true, status: "failed" }); }
      if (Math.round(+ev.data.amount) !== dep.amount) { await ctx.emit(dep.tenant_id, "wallet.deposit_mismatch", { id: dep.id, expected: dep.amount, received: Math.round(+ev.data.amount) || 0 }, `wl:depmm:${dep.id}`); return ok({ ok: true, ignored: "amount_mismatch" }); }
      await creditDeposit(dep, null); return ok({ ok: true, status: "approved" });
    });

    // ───────── إدارة المزوّد ─────────
    const needTenant = async (id) => { const t = await db.one("SELECT id,name FROM pf_tenants WHERE id=?", +id); if (!t) throw new HttpError(404, "not_found", "مستأجر غير موجود"); return t; };
    const amountOf = (b, field = "amount") => { const n = Math.round(+b[field]); if (!Number.isFinite(n) || n < 1 || n > MAX) throw new HttpError(400, "validation_error", field + " صحيح موجب"); return n; };
    const refOf = (b) => { const s = String(b.ref ?? ""); if (!/^[A-Za-z0-9._:-]{3,80}$/.test(s)) throw new HttpError(400, "validation_error", "ref فريد مطلوب (مرجع الحوالة/الفاتورة)"); return s; };
    r.get("/admin/wallet/summary", { auth: "admin", summary: "ملخص المنصة + فحص توازن الدفتر (مجموع كل الأرصدة لكل عملة = 0)" }, async () => {
      const rows = await db.all("SELECT currency, SUM(balance) s FROM wl_accounts GROUP BY currency"), fees = await db.all("SELECT currency, balance FROM wl_accounts WHERE tenant_id=0 AND code='platform_fees'"), hold = await db.all("SELECT currency, SUM(balance) s FROM wl_accounts WHERE code IN ('available','escrow','withdraw_hold','ads_credit') AND tenant_id>0 GROUP BY currency");
      return ok({ balanced: rows.every((x) => x.s === 0), by_currency: rows, platform_fees: fees, owed_to_tenants: hold, pending_withdrawals: await db.val("SELECT COUNT(*) FROM wl_withdrawals WHERE status IN ('requested','approved')") });
    });
    r.get("/admin/wallet/tenants", { auth: "admin", summary: "كل المستأجرين بأرصدتهم (المتاح · الضمان · محجوز السحب · رصيد الإعلانات) + عدد السحوبات المعلّقة" }, async () => {
      const ts = await db.all("SELECT id,name,site_ref FROM pf_tenants ORDER BY id LIMIT 500"), out = [];
      for (const t of ts) out.push({ id: t.id, name: t.name, site_ref: t.site_ref, balances: await balances(t.id), pending_withdrawals: await db.val("SELECT COUNT(*) FROM wl_withdrawals WHERE tenant_id=? AND status IN ('requested','approved')", t.id) });
      return ok({ tenants: out });
    });
    r.get("/admin/wallet/:tid", { auth: "admin", summary: "محفظة مستأجر" }, async (req) => { await needTenant(req.params.tid); return ok({ balances: await balances(+req.params.tid), settings: await walletSettings(ctx, +req.params.tid) }); });
    r.put("/admin/wallet/:tid/settings", { auth: "admin", summary: "إعدادات محفظة المستأجر: fee_pct (0–50) · fee_fixed · usd_rate · min_withdrawal · require_carrier (true = لا يُحرَّر الضمان إلا بتسليم مؤكَّد من بوابة الشحن)" }, async (req) => {
      const tid = +req.params.tid; await needTenant(tid); const b = req.json(), w = { ...(await walletSettings(ctx, tid)) };
      const num = (k, lo, hi) => { if (b[k] === undefined) return; const v = +b[k]; if (!Number.isFinite(v) || v < lo || v > hi) throw new HttpError(400, "validation_error", `${k} بين ${lo} و${hi}`); w[k] = v; };
      num("fee_pct", 0, 50); num("fee_fixed", 0, 100000); num("usd_rate", 1, 1000); num("min_withdrawal", 1, MAX); if (b.require_carrier !== undefined) w.require_carrier = !!b.require_carrier;
      await db.run("INSERT INTO wl_settings (tenant_id,settings) VALUES (?,?) ON CONFLICT(tenant_id) DO UPDATE SET settings=excluded.settings", tid, JSON.stringify(w)); await ctx.audit(req.actor, "wallet.settings", tid, w); return ok({ ok: true, settings: w });
    });
    r.post("/admin/wallet/:tid/deposit", { auth: "admin", summary: "تأكيد إيداع وصل فعلاً (حوالة/RedotPay/PayPal) ← المتاح: { amount, ref, memo }" }, async (req) => {
      const tid = +req.params.tid; await needTenant(tid); const b = req.json(), amount = amountOf(b), ref = refOf(b);
      const p = await post(ctx, tid, { ref: "dep:" + ref, kind: "deposit", memo: b.memo ?? "", legs: [{ code: "ext_deposits", ccy: "DZD", amount: -amount }, { code: "available", ccy: "DZD", amount }] });
      if (!p.duplicate) { await ctx.audit(req.actor, "wallet.deposit", tid, { amount, ref }); await ctx.emit(tid, "wallet.deposit", { amount, currency: "DZD", ref }, `wl:dep:${ref}`); } return ok({ ok: true, duplicate: !!p.duplicate });
    });
    r.post("/admin/wallet/:tid/fee", { auth: "admin", summary: "قيد رسم/اشتراك على المتاح لصالح المنصة: { amount, ref, kind: subscription|fee, memo }" }, async (req) => {
      const tid = +req.params.tid; await needTenant(tid); const b = req.json(), amount = amountOf(b), ref = refOf(b), kind = b.kind === "subscription" ? "subscription" : "platform_fee";
      const p = await post(ctx, tid, { ref: "fee:" + ref, kind, memo: b.memo ?? "", legs: [{ code: "available", ccy: "DZD", amount: -amount }, { code: "platform_fees", ccy: "DZD", amount }] });
      if (!p.duplicate) await ctx.audit(req.actor, "wallet." + kind, tid, { amount, ref }); return ok({ ok: true, duplicate: !!p.duplicate });
    });
    r.post("/admin/wallet/:tid/ads-spend", { auth: "admin", summary: "قيد إنفاق إعلاني فعلي على Business Manager الرئيسي من رصيد المستأجر بالدولار: { usd, ref, memo }" }, async (req) => {
      const tid = +req.params.tid; await needTenant(tid); const b = req.json(), cents = Math.round(+b.usd * 100), ref = refOf(b); if (!(cents >= 1 && cents <= 50_000_000)) throw new HttpError(400, "validation_error", "usd موجب");
      const p = await post(ctx, tid, { ref: "adspend:" + ref, kind: "ads_spend", memo: b.memo ?? "", legs: [{ code: "ads_credit", ccy: "USD", amount: -cents }, { code: "ext_ad_spend", ccy: "USD", amount: cents }] });
      if (!p.duplicate) await ctx.audit(req.actor, "wallet.ads_spend", tid, { usd: cents / 100, ref }); return ok({ ok: true, duplicate: !!p.duplicate });
    });
    r.get("/admin/wallet/deposits/list", { auth: "admin", summary: "طلبات الشحن (?status=pending|approved|rejected|failed&method=) بلا الصور" }, async (req) => {
      const st = ["pending", "approved", "rejected", "failed"].includes(req.query.status) ? req.query.status : "pending", a = [st]; let q = "SELECT * FROM wl_deposits WHERE status=?"; if (["chargily", "ccp"].includes(req.query.method)) { q += " AND payment_method=?"; a.push(req.query.method); }
      return ok({ deposits: (await db.all(q + " ORDER BY id LIMIT 100", ...a)).map((d) => ({ ...depPub(d), tenant_id: d.tenant_id, payer: d.payer })) });
    });
    r.get("/admin/wallet/deposits/:id/proof", { auth: "admin", summary: "صورة وصل CCP لإيداع" }, async (req) => { const d = await db.one("SELECT proof_image_path p FROM wl_deposits WHERE id=?", +req.params.id); if (!d) throw new HttpError(404, "not_found", "غير موجود"); return ok({ proof: d.p }); });
    r.post("/admin/wallet/deposits/:id/approve", { auth: "admin", summary: "اعتماد إيداع CCP بعد التحقق من وصول الحوالة ← يُقيَّد في متاح المستأجر" }, async (req) => {
      const d = await db.one("SELECT * FROM wl_deposits WHERE id=?", +req.params.id); if (!d) throw new HttpError(404, "not_found", "غير موجود"); if (d.payment_method !== "ccp") throw new HttpError(409, "bad_method", "إيداعات Chargily تُعتمد آلياً بالإشعار فقط");
      if (!(await creditDeposit(d, req.actor))) throw new HttpError(409, "bad_state", "الحالة الحالية لا تسمح بالاعتماد"); return ok({ ok: true });
    });
    r.post("/admin/wallet/deposits/:id/reject", { auth: "admin", summary: "رفض إيداع CCP: { note }" }, async (req) => {
      const d = await db.one("SELECT * FROM wl_deposits WHERE id=?", +req.params.id); if (!d) throw new HttpError(404, "not_found", "غير موجود");
      const c = await db.run("UPDATE wl_deposits SET status='rejected', note=?, updated_at=? WHERE id=? AND status='pending' AND payment_method='ccp'", String(req.json().note ?? "").replace(/[<>]/g, "").slice(0, 200), ctx.nowS(), d.id); if (!c.changes) throw new HttpError(409, "bad_state", "الحالة الحالية لا تسمح بالرفض");
      await ctx.audit(req.actor, "wallet.deposit.reject", d.tenant_id, { id: d.id }); await ctx.emit(d.tenant_id, "wallet.deposit_rejected", { id: d.id, amount: d.amount }, `wl:deprej:${d.id}`); return ok({ ok: true });
    });
    r.get("/admin/wallet/withdrawals/list", { auth: "admin", summary: "كل طلبات السحب (?status=)" }, async (req) => {
      const st = ["requested", "approved", "paid", "rejected", "cancelled"].includes(req.query.status) ? req.query.status : "requested", rows = await db.all("SELECT * FROM wl_withdrawals WHERE status=? ORDER BY id LIMIT 100", st), out = [];
      for (const w of rows) out.push({ id: w.id, tenant_id: w.tenant_id, amount: w.amount, currency: w.currency, method: w.method, destination: ctx.vault ? await ctx.vault.decrypt(w.dest_enc, `wl:${w.tenant_id}`) : null, status: w.status, note: w.note, created_at: w.created_at });
      return ok({ withdrawals: out });
    });
    const move = (action, from, to, legs, ev) => async (req) => {
      const w = await db.one("SELECT * FROM wl_withdrawals WHERE id=?", +req.params.id); if (!w) throw new HttpError(404, "not_found", "غير موجود");
      const c = await db.run(`UPDATE wl_withdrawals SET status=?, note=?, updated_at=? WHERE id=? AND status IN (${from.map(() => "?").join(",")})`, to, String(req.json().note ?? "").slice(0, 200), ctx.nowS(), w.id, ...from); if (!c.changes) throw new HttpError(409, "bad_state", "الحالة الحالية لا تسمح بهذا الإجراء");
      if (legs) { try { await post(ctx, w.tenant_id, { ref: `wd:${w.id}:${to}`, kind: "withdrawal_" + to, legs: legs(w) }); } catch (e) { await db.run("UPDATE wl_withdrawals SET status=? WHERE id=?", w.status, w.id); throw e; } }
      await ctx.audit(req.actor, "wallet.withdrawal." + action, w.id, { tenant: w.tenant_id, amount: w.amount }); if (ev) await ctx.emit(w.tenant_id, ev, { id: w.id, amount: w.amount, method: w.method, currency: w.currency }, `wl:wd${to}:${w.id}`); return ok({ ok: true });
    };
    r.post("/admin/wallet/withdrawals/:id/approve", { auth: "admin", summary: "اعتماد طلب سحب (قبل الصرف)" }, move("approve", ["requested"], "approved", null, null));
    r.post("/admin/wallet/withdrawals/:id/pay", { auth: "admin", summary: "تأكيد صرف السحب فعلياً (يُخرج المبلغ من المحجوز)" }, move("pay", ["requested", "approved"], "paid", (w) => [{ code: "withdraw_hold", ccy: w.currency, amount: -w.amount }, { code: "ext_payouts", ccy: w.currency, amount: w.amount }], "wallet.withdrawal_paid"));
    r.post("/admin/wallet/withdrawals/:id/reject", { auth: "admin", summary: "رفض السحب (يعود المبلغ للمتاح): { note }" }, move("reject", ["requested", "approved"], "rejected", (w) => [{ code: "withdraw_hold", ccy: w.currency, amount: -w.amount }, { code: "available", ccy: w.currency, amount: w.amount }], "wallet.withdrawal_rejected"));
  },
  on: {
    /** الدفع الإلكتروني وصل (وحدة payments): يدخل الضمان حتى يُسلَّم الطلب. الدفع عند الاستلام لا يمرّ بالمنصة فلا ضمان له. */
    "payment.confirmed": async (e, ctx) => {
      /* لا يُقبل إلا حدث ولّدته وحدة مزوّد دفع داخلياً (extId يبدأ ببادئة المزوّد؛ حدث /v1/events يبدأ دائماً بـ«نوع.حدث:») — فلا يستطيع تاجر اختلاق أموال بإرسال payment.confirmed بنفسه */
      const src = String((await ctx.db.val("SELECT ext_id FROM pf_events WHERE id=?", e.id)) ?? ""); if (!TRUSTED_PAYMENT_SOURCES.some((p) => src.startsWith(p))) return;
      const oid = String(e.data?.order_id ?? "").slice(0, 80), amount = Math.round(+e.data?.amount), ccy = String(e.data?.currency ?? "DZD").toUpperCase(); if (!oid || !Number.isSafeInteger(amount) || amount < 1 || amount > MAX || !(ccy in MINOR)) return;
      try { await ctx.db.run("INSERT INTO wl_escrow (tenant_id,order_id,amount,currency,state,fee,created_at) VALUES (?,?,?,?,?,0,?)", e.tenantId, oid, amount, ccy, "held", ctx.nowS()); } catch (x) { if (DB.isUnique(x)) return; throw x; }
      try { await post(ctx, e.tenantId, { ref: `hold:${oid}`, kind: "escrow_hold", order_id: oid, legs: [{ code: "ext_payments", ccy, amount: -amount }, { code: "escrow", ccy, amount }] }); }
      catch (x) { await ctx.db.run("DELETE FROM wl_escrow WHERE tenant_id=? AND order_id=? AND state='held'", e.tenantId, oid); throw x; }
      await ctx.emit(e.tenantId, "wallet.escrow_held", { order_id: oid, amount, currency: ccy }, `wl:hold:${oid}`);
      const o = await ctx.db.val("SELECT outcome FROM wl_orders WHERE tenant_id=? AND order_id=?", e.tenantId, oid); if (o) await settle(ctx, e.tenantId, oid, o);   // وصل الحدث النهائي قبل الدفع
    },
    "order.delivered": terminal("delivered"), "order.cancelled": terminal("cancelled"), "order.failed": terminal("cancelled"), "order.returned": terminal("cancelled"),   // طرد مرتجع من البوابة ← استرداد الضمان
  },
};
const pickSettings = (w) => ({ fee_pct: +w.fee_pct || 0, fee_fixed: +w.fee_fixed || 0, usd_rate: +w.usd_rate || null, min_withdrawal: +w.min_withdrawal || 1000, require_carrier: !!w.require_carrier });
export { settle };
