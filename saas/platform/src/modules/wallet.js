import { DB, HttpError, ok, paginate, clampLimit } from "../core.js";
import { randHex } from "../util.js";

/** المحفظة والدفتر (Wallet & Ledger) — قلب الأموال في المنصة.
 *  دفتر قيد مزدوج غير قابل للتعديل: كل معاملة `wl_tx` لها أرجل `wl_legs` مجموعها صفر لكل عملة، والأرصدة المخزَّنة نسخة محسوبة منها.
 *  حسابات المستأجر (لا تنزل تحت الصفر): available · escrow · withdraw_hold · ads_credit. حسابات النظام (مستأجر 0، قد تنزل): ext_payments · ext_deposits · ext_payouts ·
 *  ext_refunds · ext_ad_spend · fx_clearing · platform_fees. إشارة الرصيد: الرصيد الموجب لحساب المستأجر = ما تدين به المنصة له.
 *  الوحدات الأخرى لا تلمس الأموال أبداً: تُصدر أحداثاً (payment.confirmed / order.delivered…) وهذه الوحدة تستمع وتقيّد. المبالغ صحيحة بأصغر وحدة (دج، سنت). */
export const MINOR = { DZD: 1, USD: 100, EUR: 100 };
export const TENANT_ACCTS = ["available", "escrow", "withdraw_hold", "ads_credit"];
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
const terminal = (outcome) => async (e, ctx) => {
  const oid = String(e.data?.order_id ?? "").slice(0, 80); if (!oid) return;
  await ctx.db.run("INSERT OR IGNORE INTO wl_orders (tenant_id,order_id,outcome,at) VALUES (?,?,?,?)", e.tenantId, oid, outcome, ctx.nowS());      // أول حالة نهائية تُعتمد
  const o = await ctx.db.val("SELECT outcome FROM wl_orders WHERE tenant_id=? AND order_id=?", e.tenantId, oid); await settle(ctx, e.tenantId, oid, o);
};

export const wallet = {
  id: "wallet",
  routes(r, ctx) {
    const { db } = ctx, sandbox = (req) => req.mode !== "live";
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

    // ───────── إدارة المزوّد ─────────
    const needTenant = async (id) => { const t = await db.one("SELECT id,name FROM pf_tenants WHERE id=?", +id); if (!t) throw new HttpError(404, "not_found", "مستأجر غير موجود"); return t; };
    const amountOf = (b, field = "amount") => { const n = Math.round(+b[field]); if (!Number.isFinite(n) || n < 1 || n > MAX) throw new HttpError(400, "validation_error", field + " صحيح موجب"); return n; };
    const refOf = (b) => { const s = String(b.ref ?? ""); if (!/^[A-Za-z0-9._:-]{3,80}$/.test(s)) throw new HttpError(400, "validation_error", "ref فريد مطلوب (مرجع الحوالة/الفاتورة)"); return s; };
    r.get("/admin/wallet/summary", { auth: "admin", summary: "ملخص المنصة + فحص توازن الدفتر (مجموع كل الأرصدة لكل عملة = 0)" }, async () => {
      const rows = await db.all("SELECT currency, SUM(balance) s FROM wl_accounts GROUP BY currency"), fees = await db.all("SELECT currency, balance FROM wl_accounts WHERE tenant_id=0 AND code='platform_fees'"), hold = await db.all("SELECT currency, SUM(balance) s FROM wl_accounts WHERE code IN ('available','escrow','withdraw_hold','ads_credit') AND tenant_id>0 GROUP BY currency");
      return ok({ balanced: rows.every((x) => x.s === 0), by_currency: rows, platform_fees: fees, owed_to_tenants: hold, pending_withdrawals: await db.val("SELECT COUNT(*) FROM wl_withdrawals WHERE status IN ('requested','approved')") });
    });
    r.get("/admin/wallet/:tid", { auth: "admin", summary: "محفظة مستأجر" }, async (req) => { await needTenant(req.params.tid); return ok({ balances: await balances(+req.params.tid), settings: await walletSettings(ctx, +req.params.tid) }); });
    r.put("/admin/wallet/:tid/settings", { auth: "admin", summary: "إعدادات محفظة المستأجر: fee_pct (0–50) · fee_fixed · usd_rate · min_withdrawal" }, async (req) => {
      const tid = +req.params.tid; await needTenant(tid); const b = req.json(), w = { ...(await walletSettings(ctx, tid)) };
      const num = (k, lo, hi) => { if (b[k] === undefined) return; const v = +b[k]; if (!Number.isFinite(v) || v < lo || v > hi) throw new HttpError(400, "validation_error", `${k} بين ${lo} و${hi}`); w[k] = v; };
      num("fee_pct", 0, 50); num("fee_fixed", 0, 100000); num("usd_rate", 1, 1000); num("min_withdrawal", 1, MAX);
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
    "order.delivered": terminal("delivered"), "order.cancelled": terminal("cancelled"), "order.failed": terminal("cancelled"),
  },
};
const pickSettings = (w) => ({ fee_pct: +w.fee_pct || 0, fee_fixed: +w.fee_fixed || 0, usd_rate: +w.usd_rate || null, min_withdrawal: +w.min_withdrawal || 1000 });
export { settle };
