import { Geo } from "./geo.js";
import { DB } from "./db.js";
import { Tenants } from "./tenants.js";
import { Limiter } from "./limiter.js";
import { Dispatcher } from "./dispatcher.js";
import { S, ALL as ALL_STATUS, canTransition } from "./status.js";
import { makeParcel, ValidationError } from "./parcel.js";
import { CARRIERS, catalog, makeAdapter, makeHttp, resolveCarrier, CarrierError, CredentialsError, UnsupportedError, ApiError } from "./carriers.js";
import { nowStr, randHex, safeEq, safeHttpsUrl, sha256Hex } from "./util.js";

const MAX_BODY = 262144;
export class HttpError extends Error {
  constructor(status, code, message, fields = null, headers = {}) { super(message); this.status = status; this.code = code; this.fields = fields; this.headers = headers; }
}
const ok = (b, status = 200, headers = {}) => ({ status, headers, body: JSON.stringify(b) });
const cached = (b) => ({ status: 200, headers: { "Cache-Control": "public, max-age=86400" }, body: JSON.stringify(b) });
const REF = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * بوابة الشحن (Cloudflare Worker + D1). handle() نقية: لا تقرأ كائن Request ولا تعتمد على البيئة فتُختبر بلا خادم.
 * وضعان للمفاتيح: inline (مع كل طلب، لا تُخزَّن) أو vault (مشفّرة في gw_connections).
 */
export function createApp({ d1, vault, fetchFn = fetch, baseUrl = "", adminToken = "", clock = () => Date.now(), geo = new Geo(), docsHtml = "", carrierFetch = null }) {
  const db = new DB(d1), tenants = new Tenants(db, vault), limiter = new Limiter(db, clock), dispatcher = new Dispatcher(db, tenants, fetchFn, clock), http = makeHttp(carrierFetch ?? fetchFn);
  const aadConn = (tid, code) => `tenant:${tid}|carrier:${code}`;

  async function handle(method, path, query, headers, raw, ip = "0") {
    const rid = "req_" + randHex(6); let res;
    try { res = await route(method.toUpperCase(), "/" + path.replace(/^\/+|\/+$/g, ""), query ?? {}, headers ?? {}, raw ?? "", ip); }
    catch (e) {
      if (e instanceof HttpError) res = { status: e.status, headers: e.headers, body: JSON.stringify({ error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } }) };
      else { console.error("gateway:", e?.stack || e); res = { status: 500, headers: {}, body: '{"error":{"code":"server_error","message":"خطأ داخلي"}}' }; }
    }
    return { status: res.status, headers: { "Content-Type": "application/json; charset=utf-8", "X-Request-Id": rid, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...res.headers }, body: res.body };
  }

  async function route(m, p, q, hd, raw, ip) {
    if (raw.length > MAX_BODY) throw new HttpError(413, "payload_too_large", "الطلب أكبر من 256KB");
    const w = await limiter.window("ip:" + ip, 300, 60); if (w !== null) throw new HttpError(429, "rate_limited", "طلبات كثيرة", null, { "Retry-After": String(w) });

    if (m === "GET" && p === "/") return docsHtml ? { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }, body: docsHtml } : ok({ ok: true, service: "shipping-gateway" });
    if (m === "GET" && p === "/health") return ok({ ok: true, version: "1" });
    if (m === "GET" && p === "/openapi.json") return { status: 200, headers: { "Cache-Control": "public, max-age=3600" }, body: JSON.stringify(openapi()) };
    if (m === "GET" && p === "/v1/couriers") return cached(couriers());
    if (m === "GET" && p === "/v1/wilayas") {
      if (q.q !== undefined) { const n = Geo.norm(q.q); return cached(geo.wilayas(true).filter((x) => Geo.norm(x.name).includes(n) || String(x.code) === String(q.q).trim())); }
      return cached(geo.wilayas(q.all !== undefined));
    }
    if (m === "GET" && p === "/v1/communes") {
      if (q.q !== undefined) return cached(geo.searchCommunes(String(q.q)));
      const wc = +q.wilaya || 0; if (!geo.wilaya(wc)) throw new HttpError(400, "validation_error", "wilaya مطلوب (1..69) أو q للبحث");
      return cached({ wilaya: wc, communes: geo.communes(wc) });
    }
    let mm;
    if ((mm = p.match(/^\/v1\/hooks\/([a-f0-9]{24})$/))) return inbound(m, mm[1], q, hd, raw);
    if (p.startsWith("/admin/")) return admin(m, p, hd, raw, ip);

    const auth = await authenticate(hd, ip); const tid = auth.tenant.id, mode = auth.key.mode, plan = auth.plan;
    if (m === "POST" && p === "/v1/orders") return createOrder(auth, hd, json(raw));
    if (m === "POST" && p === "/v1/validate") return validate(json(raw));
    if (m === "POST" && p === "/v1/track") return track(auth, json(raw));
    if (m === "POST" && p === "/v1/cancel") return cancel(auth, json(raw));
    if (m === "POST" && p === "/v1/label") return label(auth, json(raw));
    if (m === "POST" && p === "/v1/desks") return desks(json(raw));
    if (m === "GET" && p === "/v1/orders") return listOrders(tid, q);
    if (m === "GET" && (mm = p.match(/^\/v1\/orders\/([A-Za-z0-9._-]{1,64})$/))) {
      const r = await db.one("SELECT * FROM gw_orders WHERE tenant_id=? AND reference=? ORDER BY id DESC LIMIT 1", tid, mm[1]);
      if (!r) throw new HttpError(404, "not_found", "الطلب غير موجود"); return ok(pubOrder(r));
    }
    if (p === "/v1/connections") {
      if (m === "GET") return ok({ connections: await db.all("SELECT carrier_code, public_id, updated_at FROM gw_connections WHERE tenant_id=? AND is_active=1", tid) });
      if (m === "POST") return connect(auth, json(raw));
    }
    if (m === "DELETE" && (mm = p.match(/^\/v1\/connections\/([a-z0-9_]{2,30})$/))) {
      await db.run("UPDATE gw_connections SET is_active=0, updated_at=? WHERE tenant_id=? AND carrier_code=?", nowStr(clock()), tid, resolveCarrier(mm[1]) ?? mm[1]); return ok({ ok: true });
    }
    if (p === "/v1/webhook") {
      if (m === "GET") { const wh = await tenants.webhook(tid); return ok({ enabled: !!wh, url: wh?.url ?? null }); }
      if (m === "PUT") return setWebhook(auth, json(raw));
      if (m === "DELETE") { await tenants.clearWebhook(tid); return ok({ ok: true }); }
    }
    if (m === "GET" && p === "/v1/usage") return ok({ plan: { id: plan.id, name: plan.name, orders_hour: plan.orders_hour, orders_day: plan.orders_day, track_min: plan.track_min, vault_max: plan.vault_max, webhooks: !!plan.webhooks }, today: await limiter.today(tid), mode });
    throw new HttpError(404, "not_found", `مسار غير موجود: ${m} ${p}`);
  }

  async function authenticate(hd, ip) {
    const b = String(hd.authorization ?? ""); const tok = /^bearer /i.test(b) ? b.slice(7).trim() : String(hd["x-api-key"] ?? "");
    const a = tok ? await tenants.authenticate(tok) : null;
    if (!a) { const w = await limiter.window("bad:" + ip, 30, 60); if (w !== null) throw new HttpError(429, "rate_limited", "محاولات مصادقة فاشلة كثيرة", null, { "Retry-After": String(w) });
      throw new HttpError(401, "unauthorized", "مفتاح API مفقود أو غير صالح", null, { "WWW-Authenticate": "Bearer" }); }
    return a;
  }
  function json(raw) { let j; try { j = JSON.parse(raw); } catch { j = null; } if (!j || typeof j !== "object" || Array.isArray(j)) throw new HttpError(400, "validation_error", "جسم الطلب يجب أن يكون JSON"); return j; }
  const couriers = () => ({ couriers: [{ courier: "sandbox", label: "Sandbox (تجربة بلا حساب)", maturity: "sandbox", credentials: [], capabilities: { create: true, track: true, cancel: false, label: false } },
    ...catalog().filter((c) => c.activatable).map((c) => ({ courier: c.code, label: c.label, maturity: c.maturity, credentials: c.fields.map((f) => ({ key: f.key, label: f.label, required: f.required ?? true })), needsBaseUrl: c.needs_base_url,
      capabilities: { create: true, track: true, webhook: true, cancel: c.code !== "zrexpress" && c.code !== "maystro", label: c.code === "yalidine" } }))] });

  /* ───── شركة وهمية للتجربة ───── */
  function sandboxAdapter() {
    return {
      code: "sandbox",
      async create(p) {
        const err = [];
        if (!/^0[567]\d{8}$/.test(p.localPhone())) err.push("رقم الهاتف غير صالح");
        if (p.name.length < 2 || p.name.length > 120) err.push("الاسم 2–120 حرفاً");
        if (!p.productsText()) err.push("قائمة المنتجات فارغة");
        if (geo.matchCommune(p.wilayaCode, p.commune).status !== "exact") err.push("بلدية غير معروفة في هذه الولاية");
        if (p.stopDesk && !p.deskId) err.push("مكتب Stop Desk غير محدد");
        if (err.length) return { ok: false, tracking: "", labelUrl: null, error: err.join("، "), raw: {} };
        return { ok: true, tracking: "SBX-" + (await sha256Hex(p.orderRef)).slice(0, 8).toUpperCase(), labelUrl: null, error: "", raw: { sandbox: true } };
      },
      async track(trk) {
        const mt = /^SBX-([0-9A-F]{8})$/.exec(trk); if (!mt) throw new ApiError("رقم تتبع غير موجود");
        const [st, raw] = [[S.PENDING, "created"], [S.SHIPPED, "in_transit"], [S.OUT_FOR_DELIVERY, "out_for_delivery"], [S.DELIVERED, "delivered"]][parseInt(mt[1][7], 16) % 4];
        return { tracking: trk, rawStatus: raw, status: st, raw: { sandbox: true } };
      },
      async cancel() { return false }, async labelUrl() { return null },
    };
  }

  /** @returns {{ad, code, via}} */
  async function adapter(auth, b) {
    const courier = String(b.courier ?? "").toLowerCase().trim();
    if (!courier) throw new HttpError(400, "validation_error", "courier مطلوب", { courier: "مطلوب" });
    if (courier === "sandbox") return { ad: sandboxAdapter(), code: "sandbox", via: "inline" };
    const code = resolveCarrier(courier); if (!code) throw new HttpError(400, "unknown_courier", `شركة غير معروفة: ${courier}`);
    if (auth.key.mode === "test") throw new HttpError(403, "test_key_sandbox_only", "مفتاح الاختبار يعمل مع courier=sandbox فقط");
    const opts = b.options && typeof b.options === "object" ? b.options : {}; const base = opts.baseUrl ? String(opts.baseUrl) : null;
    try {
      if (b.credentials && typeof b.credentials === "object" && Object.keys(b.credentials).length) {
        const cred = Object.fromEntries(Object.entries(b.credentials).map(([k, v]) => [k, typeof v === "string" || typeof v === "number" ? String(v).trim() : ""]));
        if (opts.fromWilaya !== undefined && cred.fromWilaya === undefined) cred.fromWilaya = String(opts.fromWilaya);
        if (/^\d+$/.test(cred.fromWilaya ?? "")) cred.fromWilaya = geo.name(+cred.fromWilaya) ?? cred.fromWilaya;
        return { ad: makeAdapter(code, http, base).authenticate(cred), code, via: "inline" };
      }
      const conn = await db.one("SELECT * FROM gw_connections WHERE tenant_id=? AND carrier_code=?", auth.tenant.id, code);
      if (!conn || !conn.is_active) throw new HttpError(422, "credentials_required", "أرسل credentials أو فعّل الشركة عبر POST /v1/connections");
      return { ad: await adapterForConn(conn), code, via: "vault" };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (e instanceof UnsupportedError) throw new HttpError(422, "not_supported", e.message);
      if (e instanceof CredentialsError) throw new HttpError(422, "invalid_credentials", e.message);
      throw e;
    }
  }
  async function adapterForConn(conn) {
    const cred = await vault.decryptJson(conn.credentials_enc, aadConn(conn.tenant_id, conn.carrier_code));
    if (/^\d+$/.test(cred.fromWilaya ?? "")) cred.fromWilaya = geo.name(+cred.fromWilaya) ?? cred.fromWilaya;
    return makeAdapter(conn.carrier_code, http, conn.base_url).authenticate(cred);
  }

  function phone(p) { let d = String(p ?? "").replace(/\D/g, ""); if (d.startsWith("00213")) d = d.slice(5); else if (d.startsWith("213")) d = d.slice(3); if (d.length === 9) d = "0" + d; return /^0[567]\d{8}$/.test(d) ? d : null; }

  function normalizeOrder(b) {
    const o = b.order; const f = {};
    if (!o || typeof o !== "object") throw new HttpError(400, "validation_error", "order مطلوب", { order: "مطلوب" });
    const r = o.recipient && typeof o.recipient === "object" ? o.recipient : {};
    const name = String(r.fullName ?? "").trim(); if (name.length < 2 || name.length > 120) f["order.recipient.fullName"] = "2–120 حرفاً";
    const w = +r.wilayaCode || 0; if (!geo.wilaya(w)) f["order.recipient.wilayaCode"] = "1..69";
    const commune = String(r.communeName ?? "").trim(); if (!commune) f["order.recipient.communeName"] = "مطلوب";
    const type = String(o.deliveryType ?? "home"); if (!["home", "stopdesk"].includes(type)) f["order.deliveryType"] = "home أو stopdesk";
    const prod = String(o.productList ?? "").trim(); if (!prod) f["order.productList"] = "مطلوب";
    const cod = o.codAmount; if (typeof cod === "boolean" || cod === null || cod === undefined || cod === "" || !isFinite(+cod) || +cod < 0 || +cod > 1_000_000) f["order.codAmount"] = "عدد صحيح بالدينار (0 = مدفوع مسبقاً)";
    const ref = String(o.reference ?? ""); if (ref && !REF.test(ref)) f["order.reference"] = "أحرف وأرقام و . _ - (حتى 64)";
    if (Object.keys(f).length) throw new HttpError(400, "validation_error", "حقول غير صالحة", f);
    const ph = phone(r.phone); if (!ph) throw new HttpError(422, "invalid_phone", "رقم هاتف جزائري محمول غير صالح (05/06/07…)", { "order.recipient.phone": "غير صالح" });
    const alt = r.phoneAlt ? phone(r.phoneAlt) : null; const corr = []; const mc = geo.matchCommune(w, commune);
    if (mc.status === "unknown") throw new HttpError(422, "unknown_commune", "بلدية غير معروفة في هذه الولاية" + (mc.suggestions.length ? " — هل تقصد: " + mc.suggestions.join("، ") : ""), { "order.recipient.communeName": mc.suggestions });
    if (mc.commune !== commune) corr.push({ field: "order.recipient.communeName", from: commune, to: mc.commune });
    const desk = o.stopDeskId !== undefined && o.stopDeskId !== "" && o.stopDeskId !== null ? String(o.stopDeskId) : null;
    if (type === "stopdesk" && desk === null) throw new HttpError(422, "validation_error", "stopDeskId مطلوب مع stopdesk", { "order.stopDeskId": "مطلوب" });
    return [{ reference: ref, name, phone: ph, phoneAlt: alt ?? "", wilaya: w, commune: mc.commune, address: String(r.addressLine ?? "").trim(), type, desk, products: prod, cod: Math.round(+cod),
      notes: String(o.notes ?? "").trim().slice(0, 200), canOpen: !("hasOpenPackage" in o) || !!o.hasOpenPackage }, corr];
  }

  const pubOrder = (r) => ({ reference: r.reference, courier: r.courier, trackingNumber: r.tracking, status: r.status, rawStatus: r.raw_status, via: r.via, createdAt: r.created_at, updatedAt: r.updated_at });

  async function createOrder(auth, hd, b) {
    const [n, corr] = normalizeOrder(b); const tid = auth.tenant.id, mode = auth.key.mode;
    const { ad, code: courier, via } = await adapter(auth, b);
    let ref = n.reference || String(hd["idempotency-key"] ?? "");
    if (ref && !REF.test(ref)) throw new HttpError(400, "validation_error", "Idempotency-Key غير صالح");
    if (!ref) ref = "GW-" + randHex(5).toUpperCase(); n.reference = ref;
    const hash = await sha256Hex(JSON.stringify([courier, n]));
    const w = await limiter.consume(auth.tenant, auth.plan, mode, "order"); if (w !== null) throw new HttpError(429, "rate_limited", "تجاوزت حدّ خطتك للطلبات", null, { "Retry-After": String(w) });
    // حجز المرجع أولاً: التكرار/التزامن يصطدم بالقيد الفريد بدل إنشاء طرد ثانٍ
    const nowS = nowStr(clock()); let id;
    try { id = (await db.run("INSERT INTO gw_orders (tenant_id,courier,reference,tracking,status,via,request_hash,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?,?,?)", tid, courier, ref, S.PENDING, via, hash, nowS, nowS)).id; }
    catch (e) {
      if (!DB.isUnique(e)) throw e;
      const ex = await db.one("SELECT * FROM gw_orders WHERE tenant_id=? AND courier=? AND reference=?", tid, courier, ref);
      if (!ex || ex.request_hash !== hash) throw new HttpError(409, "reference_conflict", "المرجع مستعمل لطلب مختلف");
      if (ex.tracking === null) throw new HttpError(409, "in_progress", "الإرسال جارٍ لهذا المرجع، أعد المحاولة بعد قليل", null, { "Retry-After": "3" });
      return ok(JSON.parse(ex.response_json || "null") ?? pubOrder(ex), 200, { "Idempotent-Replayed": "true" });
    }
    const release = () => db.run("DELETE FROM gw_orders WHERE id=?", id);
    let res;
    try {
      if (n.type === "stopdesk" && !/^\d+$/.test(n.desk)) { await release(); throw new HttpError(422, "not_supported", "معرّف المكتب غير رقمي: هذه الشركة لا تدعمه بعد في البوابة"); }
      res = await ad.create(makeParcel(geo, { orderRef: ref, name: n.name, phone: n.phone, wilayaCode: n.wilaya, commune: n.commune, address: n.address, total: n.cod, shippingFee: 0, products: n.products, phone2: n.phoneAlt, stopDesk: n.type === "stopdesk", deskId: n.desk, note: n.notes, canOpen: n.canOpen }));
    } catch (e) {
      if (!(e instanceof HttpError)) await release();
      if (e instanceof HttpError) throw e;
      if (e instanceof ValidationError) throw new HttpError(400, "validation_error", e.message);
      if (e instanceof CredentialsError) throw new HttpError(422, "invalid_credentials", e.message);
      if (e instanceof CarrierError) throw new HttpError(502, "courier_error", e.message);
      throw e;
    }
    if (!res.ok) { await release(); throw new HttpError(502, "courier_error", res.error || "رفضت الشركة الطلب"); }
    const out = { reference: ref, courier, trackingNumber: res.tracking, status: S.PENDING, labelUrl: res.labelUrl, sandbox: courier === "sandbox", ...(corr.length ? { corrections: corr } : {}) };
    await db.run("UPDATE gw_orders SET tracking=?, response_json=?, updated_at=? WHERE id=?", res.tracking, JSON.stringify(out), nowStr(clock()), id);
    if (mode === "live") await limiter.count(tid, "order");
    return ok(out, 201);
  }

  function validate(b) {
    const [n, corr] = normalizeOrder(b);
    return ok({ valid: true, normalized: { phone: n.phone, wilayaCode: n.wilaya, shipAs: geo.legacyCode(n.wilaya), communeName: n.commune, codAmount: n.cod }, corrections: corr });
  }

  async function advance(row, status, raw, plan) {
    if (!canTransition(row.status, status)) return false;
    await db.run("UPDATE gw_orders SET status=?, raw_status=?, updated_at=? WHERE id=?", status, String(raw).slice(0, 190), nowStr(clock()), row.id);
    await dispatcher.enqueue(row.tenant_id, row.id, "shipment.status_changed", { reference: row.reference, courier: row.courier, trackingNumber: row.tracking, status, previousStatus: row.status, rawStatus: raw }, plan);
    return true;
  }

  async function track(auth, b) {
    const trk = String(b.trackingNumber ?? "").trim(); if (!/^[A-Za-z0-9._-]{3,64}$/.test(trk)) throw new HttpError(400, "validation_error", "trackingNumber غير صالح", { trackingNumber: "مطلوب" });
    const { ad, code } = await adapter(auth, b);
    const w = await limiter.consume(auth.tenant, auth.plan, auth.key.mode, "track"); if (w !== null) throw new HttpError(429, "rate_limited", "تجاوزت حدّ التتبع", null, { "Retry-After": String(w) });
    let r; try { r = await ad.track(trk); } catch (e) { throw carrierToHttp(e); }
    const row = await db.one("SELECT * FROM gw_orders WHERE tenant_id=? AND courier=? AND tracking=?", auth.tenant.id, code, trk);
    if (row) await advance(row, r.status, r.rawStatus, auth.plan);
    return ok({ trackingNumber: trk, courier: code, status: r.status, rawStatus: r.rawStatus });
  }
  function carrierToHttp(e) {
    if (e instanceof CredentialsError) return new HttpError(422, "invalid_credentials", e.message);
    if (e instanceof CarrierError) return new HttpError(502, "courier_error", e.message);
    return e;
  }
  async function cancel(auth, b) {
    const trk = String(b.trackingNumber ?? "").trim(); if (!/^[A-Za-z0-9._-]{3,64}$/.test(trk)) throw new HttpError(400, "validation_error", "trackingNumber غير صالح", { trackingNumber: "مطلوب" });
    const { ad, code } = await adapter(auth, b); let done; try { done = await ad.cancel(trk); } catch (e) { throw carrierToHttp(e); }
    if (!done) throw new HttpError(409, "cancel_refused", "رفضت الشركة الإلغاء أو لا تدعمه (غالباً بعد خروج الطرد)");
    const row = await db.one("SELECT * FROM gw_orders WHERE tenant_id=? AND courier=? AND tracking=?", auth.tenant.id, code, trk);
    if (row) await advance(row, S.CANCELLED, "cancelled", auth.plan);
    return ok({ ok: true, trackingNumber: trk, status: S.CANCELLED });
  }
  async function label(auth, b) {
    const trk = String(b.trackingNumber ?? "").trim(); if (!/^[A-Za-z0-9._-]{3,64}$/.test(trk)) throw new HttpError(400, "validation_error", "trackingNumber غير صالح", { trackingNumber: "مطلوب" });
    const { ad } = await adapter(auth, b); let url; try { url = await ad.labelUrl(trk); } catch (e) { throw carrierToHttp(e); }
    if (!url) throw new HttpError(404, "label_unavailable", "لا توجد بوليصة لهذه الشركة عبر البوابة"); return ok({ trackingNumber: trk, labelUrl: url });
  }
  function desks(b) {
    const w = +b.wilayaCode || 0; if (!geo.wilaya(w)) throw new HttpError(400, "validation_error", "wilayaCode (1..69) مطلوب", { wilayaCode: "مطلوب" });
    return ok({ wilayaCode: w, desks: geo.desks(w), source: "catalog", note: "كتالوج شبكة ياليدين وشبيهاتها؛ استعمل id المكتب مع deliveryType=stopdesk" });
  }
  async function listOrders(tid, q) {
    const lim = Math.max(1, Math.min(100, +q.limit || 50)), after = +q.after || 0; const st = ALL_STATUS.includes(q.status) ? q.status : null;
    const args = [tid]; let sql = "SELECT * FROM gw_orders WHERE tenant_id=? AND tracking IS NOT NULL";
    if (after > 0) { sql += " AND id<?"; args.push(after); } if (st) { sql += " AND status=?"; args.push(st); }
    sql += " ORDER BY id DESC LIMIT ?"; args.push(lim + 1);
    let rows = await db.all(sql, ...args); const more = rows.length > lim; rows = rows.slice(0, lim);
    return ok({ orders: rows.map(pubOrder), next: more ? rows[rows.length - 1].id : null });
  }

  /* ───── الخزنة والـwebhook ───── */
  async function connect(auth, b) {
    if (auth.key.mode === "test") throw new HttpError(403, "test_key_sandbox_only", "غير متاح بمفتاح الاختبار");
    const tid = auth.tenant.id, code = resolveCarrier(b.courier); if (!code) throw new HttpError(400, "unknown_courier", `شركة غير معروفة: ${b.courier}`);
    const had = await db.one("SELECT * FROM gw_connections WHERE tenant_id=? AND carrier_code=?", tid, code);
    const n = await db.val("SELECT COUNT(*) FROM gw_connections WHERE tenant_id=? AND is_active=1", tid);
    if ((!had || !had.is_active) && n >= auth.plan.vault_max) throw new HttpError(402, "plan_limit", "خطتك لا تسمح بمزيد من الشركات المحفوظة");
    const cred = Object.fromEntries(Object.entries(b.credentials && typeof b.credentials === "object" ? b.credentials : {}).map(([k, v]) => [k, typeof v === "string" || typeof v === "number" ? String(v).trim() : ""]));
    const base = b.baseUrl ? String(b.baseUrl) : null; if (base !== null && !safeHttpsUrl(base)) throw new HttpError(400, "validation_error", "baseUrl يجب أن يبدأ بـ https://");
    try { makeAdapter(code, http, base).authenticate(cred); } catch (e) { if (e instanceof UnsupportedError) throw new HttpError(422, "not_supported", e.message); if (e instanceof CredentialsError) throw new HttpError(422, "invalid_credentials", e.message); throw e; }
    const enc = await vault.encrypt(cred, aadConn(tid, code)), secret = randHex(24), hash = await sha256Hex(secret), now = nowStr(clock());
    let pub;
    if (had) { pub = had.public_id; await db.run("UPDATE gw_connections SET credentials_enc=?, key_id=?, base_url=?, webhook_token_hash=?, is_active=1, updated_at=? WHERE id=?", enc, vault.kid, base, hash, now, had.id); }
    else { pub = randHex(12); await db.run("INSERT INTO gw_connections (public_id,tenant_id,carrier_code,credentials_enc,key_id,base_url,webhook_token_hash,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)", pub, tid, code, enc, vault.kid, base, hash, now, now); }
    return ok({ ok: true, courier: code, carrierWebhookUrl: `${baseUrl.replace(/\/+$/, "")}/v1/hooks/${pub}?t=${secret}`, note: "ضع هذا الرابط في حسابك لدى الشركة لتصلك حالات الطرود لحظياً — يظهر هذه المرة فقط" }, 201);
  }
  async function setWebhook(auth, b) {
    if (!auth.plan.webhooks) throw new HttpError(402, "plan_limit", "الـwebhook غير متاح في خطتك");
    const url = String(b.url ?? ""); if (!safeHttpsUrl(url) || url.length > 300) throw new HttpError(400, "validation_error", "url يجب أن يكون https صالحاً", { url: "https://…" });
    const secret = await tenants.setWebhook(auth.tenant.id, url);
    return ok({ ok: true, url, secret, note: "السرّ يوقّع كل حدث (X-Gateway-Signature: t=…,v1=hmac_sha256(secret, t.body)) — يظهر هذه المرة فقط" });
  }
  async function inbound(m, publicId, q, hd, raw) {
    if (m === "GET") return q.subscribe !== undefined && q.crc_token !== undefined ? { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: String(q.crc_token) } : ok({ ok: true, webhook: "ready" });
    if (m !== "POST") throw new HttpError(405, "method_not_allowed", "POST فقط");
    const conn = await db.one("SELECT * FROM gw_connections WHERE public_id=? AND is_active=1", publicId);
    if (!conn || !safeEq(conn.webhook_token_hash, await sha256Hex(String(q.t ?? "")))) throw new HttpError(401, "unauthorized", "رابط غير صالح");
    let p; try { p = JSON.parse(raw); } catch { p = null; } if (!p || typeof p !== "object") throw new HttpError(400, "validation_error", "JSON غير صالح");
    const plan = await tenants.plan((await db.val("SELECT plan FROM gw_tenants WHERE id=?", conn.tenant_id)) ?? "free"); let events = [];
    try { events = makeAdapter(conn.carrier_code, http, conn.base_url).parseWebhook(p, hd); } catch (e) { if (!(e instanceof UnsupportedError)) throw e; }
    let n = 0;
    for (const e of events) { const row = await db.one("SELECT * FROM gw_orders WHERE tenant_id=? AND courier=? AND tracking=?", conn.tenant_id, conn.carrier_code, e.tracking); if (row && await advance(row, e.status, e.rawStatus, plan)) n++; }
    return ok({ ok: true, received: events.length, updated: n });
  }

  /* ───── إدارة الخدمة (لصاحب المنصة): Bearer ADMIN_TOKEN ───── */
  async function admin(m, p, hd, raw, ip) {
    const tok = /^bearer /i.test(String(hd.authorization ?? "")) ? String(hd.authorization).slice(7).trim() : "";
    if (!adminToken || !tok || !safeEq(tok, adminToken)) {
      const w = await limiter.window("adm:" + ip, 20, 60); if (w !== null) throw new HttpError(429, "rate_limited", "محاولات كثيرة", null, { "Retry-After": String(w) });
      throw new HttpError(401, "unauthorized", "رمز الإدارة غير صالح");
    }
    let mm;
    if (m === "GET" && p === "/admin/tenants") return ok({ tenants: await db.all("SELECT t.id,t.name,t.email,t.site_ref,t.plan,t.status,t.created_at,(SELECT COUNT(*) FROM gw_orders o WHERE o.tenant_id=t.id) AS orders,(SELECT COUNT(*) FROM gw_keys k WHERE k.tenant_id=t.id AND k.revoked_at IS NULL) AS keys FROM gw_tenants t ORDER BY t.id") });
    if (m === "POST" && p === "/admin/tenants") {
      const b = json(raw); if (!String(b.name ?? "").trim()) throw new HttpError(400, "validation_error", "name مطلوب");
      try { const id = await tenants.createTenant(b.name, b.email ?? "", b.plan ?? "free", b.site_ref ?? null); return ok({ id }, 201); }
      catch (e) { if (DB.isUnique(e)) throw new HttpError(409, "site_ref_taken", "هذا الموقع مرتبط بمستأجر آخر"); throw new HttpError(400, "validation_error", e.message); }
    }
    if (m === "POST" && (mm = p.match(/^\/admin\/tenants\/(\d+)\/keys$/))) { const b = raw ? json(raw) : {}; return ok({ key: await tenants.issueKey(+mm[1], b.mode ?? "live", b.label ?? ""), note: "يظهر مرة واحدة" }, 201); }
    if (m === "PATCH" && (mm = p.match(/^\/admin\/tenants\/(\d+)$/))) {
      const b = json(raw);
      if (b.plan) { try { await tenants.setPlan(+mm[1], b.plan); } catch (e) { throw new HttpError(400, "validation_error", e.message); } }
      if (b.status) { if (!["active", "suspended"].includes(b.status)) throw new HttpError(400, "validation_error", "status: active|suspended"); await tenants.setStatus(+mm[1], b.status); }
      return ok({ ok: true });
    }
    if (m === "DELETE" && (mm = p.match(/^\/admin\/keys\/(\d+)$/))) { await tenants.revokeKey(+mm[1]); return ok({ ok: true }); }
    if (m === "PUT" && (mm = p.match(/^\/admin\/plans\/([a-z0-9_-]{2,20})$/))) {
      const b = json(raw), cur = await tenants.plan(mm[1]); if (!cur) throw new HttpError(404, "not_found", "خطة غير موجودة");
      const num = (v, d) => (v === undefined ? d : Math.max(0, Math.floor(+v) || 0));
      await db.run("UPDATE gw_plans SET name=?, orders_hour=?, orders_day=?, track_min=?, vault_max=?, webhooks=?, price_dzd=? WHERE id=?", b.name ?? cur.name, num(b.orders_hour, cur.orders_hour), num(b.orders_day, cur.orders_day), num(b.track_min, cur.track_min), num(b.vault_max, cur.vault_max), b.webhooks === undefined ? cur.webhooks : (b.webhooks ? 1 : 0), b.price_dzd === undefined ? cur.price_dzd : (b.price_dzd === null ? null : num(b.price_dzd, 0)), mm[1]);
      return ok({ ok: true });
    }
    if (m === "GET" && p === "/admin/plans") return ok({ plans: await db.all("SELECT * FROM gw_plans") });
    if (m === "GET" && p === "/admin/usage") return ok({ usage: await db.all("SELECT tenant_id,day,kind,n FROM gw_usage ORDER BY day DESC, tenant_id LIMIT 200") });
    throw new HttpError(404, "not_found", "مسار إدارة غير موجود");
  }

  /** للـcron: يزامن طرود الخزنة غير النهائية ثم يرسل الأحداث المستحقة. */
  async function cron(syncLimit = 50) {
    const rows = await db.all("SELECT * FROM gw_orders WHERE via='vault' AND tracking IS NOT NULL AND status NOT IN ('delivered','returned','cancelled') ORDER BY updated_at ASC LIMIT ?", syncLimit); let checked = 0, changed = 0, errors = 0;
    for (const row of rows) {
      checked++;
      try {
        const conn = await db.one("SELECT * FROM gw_connections WHERE tenant_id=? AND carrier_code=?", row.tenant_id, row.courier); if (!conn || !conn.is_active) continue;
        const r = await (await adapterForConn(conn)).track(row.tracking); const plan = await tenants.plan((await db.val("SELECT plan FROM gw_tenants WHERE id=?", row.tenant_id)) ?? "free");
        if (await advance(row, r.status, r.rawStatus, plan)) changed++; else await db.run("UPDATE gw_orders SET updated_at=? WHERE id=?", nowStr(clock()), row.id);
      } catch { errors++; }
    }
    return { checked, changed, errors, ...(await dispatcher.deliverDue()) };
  }

  function openapi() {
    const sec = [{ bearer: [] }], s = (x) => ({ summary: x, security: sec });
    return { openapi: "3.0.3", info: { title: "Shipping Gateway", version: "1", description: "طلب واحد لكل شركات التوصيل الجزائرية. المصادقة: Authorization: Bearer gk_live_… (أو gk_test_… للتجربة مع courier=sandbox)." }, components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
      paths: { "/v1/orders": { post: s("إنشاء طرد (idempotent بالمرجع)"), get: s("قائمة طلباتك") }, "/v1/orders/{reference}": { get: s("طلب بمرجعه") }, "/v1/validate": { post: s("تحقق جاف وتصحيح العنوان") }, "/v1/track": { post: s("حالة طرد") },
        "/v1/cancel": { post: s("إلغاء طرد (حسب الشركة)") }, "/v1/label": { post: s("رابط البوليصة (حسب الشركة)") }, "/v1/desks": { post: s("مكاتب Stop Desk لولاية") }, "/v1/connections": { get: s("الشركات المحفوظة"), post: s("حفظ مفاتيح شركة مشفّرة") },
        "/v1/webhook": { get: s("إعداد webhook الصادر"), put: s("ضبط رابط webhook الصادر"), delete: s("حذفه") }, "/v1/usage": { get: s("الاستعمال والحدود") }, "/v1/couriers": { get: { summary: "الشركات المدعومة" } }, "/v1/wilayas": { get: { summary: "الولايات" } }, "/v1/communes": { get: { summary: "البلديات" } }, "/health": { get: { summary: "الحالة" } } } };
  }
  return { handle, cron, tenants, limiter, dispatcher, geo, db };
}
