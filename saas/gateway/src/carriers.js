import { pick, safeHttpsUrl } from "./util.js";
import { mapStatus, S } from "./status.js";

export class CarrierError extends Error {}
export class CredentialsError extends CarrierError {}
export class ApiError extends CarrierError {}
export class UnsupportedError extends CarrierError {}

/** عميل HTTP: يحوّل الشبكة إلى ردّ موحّد؛ مهلة 25ث؛ لا يتبع التحويلات. */
export function makeHttp(fetchFn = fetch) {
  return async (method, url, headers = {}, body = null) => {
    if (!safeHttpsUrl(url)) return { status: 0, body: "", error: "insecure_url", ok: false, json: () => null };
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetchFn(url, { method, headers: { "User-Agent": "Mozilla/5.0 (compatible; ShippingGateway/1.0)", Accept: "application/json", ...headers }, body: body == null ? undefined : (typeof body === "string" ? body : JSON.stringify(body)), redirect: "manual", signal: ctl.signal });
      const text = (await r.text()).slice(0, 2_000_000);
      return { status: r.status, body: text, error: "", ok: r.status >= 200 && r.status < 300, json: () => { try { const j = JSON.parse(text); return j && typeof j === "object" ? j : null; } catch { return null; } } };
    } catch (e) { return { status: 0, body: "", error: String(e.message || e), ok: false, json: () => null }; }
    finally { clearTimeout(t); }
  };
}

class Adapter {
  constructor(http) { this.http = http; this.cred = {}; }
  static fields() { return []; }
  authenticate(c) {
    for (const f of this.constructor.fields()) if ((f.required ?? true) && !String(c[f.key] ?? "").trim()) throw new CredentialsError("الحقل مطلوب: " + f.label);
    this.cred = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v ?? "").trim()])); return this;
  }
  mapStatus(raw) { return mapStatus(raw); }
  async send(method, url, headers = {}, body = null) {
    const r = await this.http(method, url, headers, body);
    if (r.status === 0) throw new ApiError("تعذّر الاتصال بالشركة: " + (r.error || "خطأ شبكة"));
    if (r.status === 401 || r.status === 403) throw new CredentialsError("رفضت الشركة المفاتيح (HTTP " + r.status + ")");
    return r;
  }
  async cancel() { return false; }
  async labelUrl() { return null; }
  parseWebhook(payload) {
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : payload?.data && typeof payload.data === "object" ? [payload.data] : [payload];
    const out = [];
    for (const it of items) { if (!it || typeof it !== "object") continue;
      const trk = pick(it, "tracking", "tracking_number", "tracking_code"), raw = pick(it, "status", "last_status", "state");
      if (trk && raw) out.push({ tracking: trk, rawStatus: raw, status: this.mapStatus(raw), orderRef: pick(it, "order_id", "reference") }); }
    return out;
  }
}
const ok = (tracking, labelUrl = null, raw = {}) => ({ ok: true, tracking, labelUrl, error: "", raw });
const fail = (error, raw = {}) => ({ ok: false, tracking: "", labelUrl: null, error, raw });
const httpsOnly = (u) => (typeof u === "string" && u.startsWith("https://") ? u : null);

/* ───── Yalidine (مُتحقَّق منه على حساب حقيقي: إنشاء/تتبع/بوليصة/إلغاء) ───── */
class Yalidine extends Adapter {
  static BASE = "https://api.yalidine.app";
  static fields() { return [{ key: "apiId", label: "API ID", secret: false }, { key: "apiToken", label: "API Token", secret: true }, { key: "fromWilaya", label: "ولاية الانطلاق (مثال: Alger)", secret: false, required: false }]; }
  h(json = false) { const h = { "X-API-ID": this.cred.apiId, "X-API-TOKEN": this.cred.apiToken }; return json ? { ...h, "Content-Type": "application/json" } : h; }
  statusText(v) { return v && typeof v === "object" ? String(v.name ?? v.label ?? "").trim() : String(v ?? "").trim(); }
  async create(p) {
    const [first, family] = p.nameParts(), price = p.priceWithoutShipping();
    if (p.stopDesk && !p.deskId) return fail("مكتب Stop Desk غير محدد");
    const from = this.cred.fromWilaya || "Alger";   // الاسم؛ الطبقة العليا تحوّل الرقم إلى اسم
    const body = { order_id: p.orderRef, from_wilaya_name: from, firstname: first, familyname: family, contact_phone: p.localPhone(), address: p.address || `${p.commune}، ${p.wilayaName}`,
      to_commune_name: p.commune, to_wilaya_name: p.legacyName, product_list: p.productsText(), price, do_insurance: true, declared_value: price, freeshipping: p.shippingFee <= 0,
      is_stopdesk: p.stopDesk, has_exchange: false, can_open: p.canOpen, weight: 1 };
    if (p.stopDesk) body.stopdesk_id = +p.deskId;
    const r = await this.send("POST", Yalidine.BASE + "/v1/parcels/", this.h(true), [body]); const j = r.json() ?? {};
    const row = j[p.orderRef] ?? (Array.isArray(j.data) ? j.data[0] : null) ?? {}; const trk = String(row.tracking ?? "");
    if (r.ok && row.success !== false && trk) return ok(trk, httpsOnly(row.label), j);
    return fail(String(row.message || "") || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("GET", `${Yalidine.BASE}/v1/parcels/${encodeURIComponent(trk)}`, this.h())).json() ?? {}; const d = j.data?.[0] ?? j; const raw = this.statusText(d.last_status);
    if (!raw) throw new ApiError("حالة الطرد غير موجودة في ردّ الشركة"); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
  async cancel(trk) { return (await this.send("DELETE", `${Yalidine.BASE}/v1/parcels/${encodeURIComponent(trk)}`, this.h())).ok; }
  async labelUrl(trk) { const j = (await this.send("GET", `${Yalidine.BASE}/v1/parcels/${encodeURIComponent(trk)}`, this.h())).json() ?? {}; const d = j.data?.[0] ?? j; return httpsOnly(d.label ?? d.labels); }
  parseWebhook(payload) {
    const type = String(payload?.type ?? payload?.event ?? payload?.event_type ?? "");
    if (type && !["parcel_status_updated", "parcel_payment_updated", "parcel_edited"].includes(type)) return [];
    const items = payload?.data !== undefined ? (Array.isArray(payload.data) ? payload.data : [payload.data]) : Array.isArray(payload) ? payload : [payload];
    const out = [];
    for (const it of items) { if (!it || typeof it !== "object") continue;
      const trk = pick(it, "tracking", "tracking_number") || pick(it.parcel ?? {}, "tracking");
      const raw = this.statusText(it.last_status ?? it.status ?? it.event_status ?? it.parcel?.last_status ?? payload.last_status ?? payload.status ?? "");
      if (trk && raw) out.push({ tracking: trk, rawStatus: raw, status: this.mapStatus(raw), orderRef: pick(it, "order_id") }); }
    return out;
  }
}

/* ───── ZR Express (Procolis) — تجريبي ───── */
class ZRExpress extends Adapter {
  static BASE = "https://procolis.com/api_v1";
  static fields() { return [{ key: "token", label: "Token", secret: true }, { key: "key", label: "Key", secret: true }]; }
  h() { return { token: this.cred.token, key: this.cred.key, "Content-Type": "application/json" }; }
  async create(p) {
    const row = { Tracking: p.orderRef, TypeLivraison: p.stopDesk ? "1" : "0", TypeColis: "0", Confrimee: "1", Client: p.name, MobileA: p.localPhone(), MobileB: p.phone2 ? p.localPhone(p.phone2) : "",
      Adresse: p.address || p.wilayaName, IDWilaya: String(p.legacyWilaya), Commune: p.commune, Total: String(Math.round(p.total)), Note: p.note, TProduit: p.productsText() };
    const r = await this.send("POST", ZRExpress.BASE + "/add_colis", this.h(), { Colis: [row] }); const j = r.json() ?? {}; const first = j.Colis?.[0] ?? j[0] ?? j;
    const f = first && typeof first === "object" ? first : {}; const trk = pick(f, "Tracking", "tracking", "tracking_code");
    if (r.ok && trk && !/erreur|error|fail/i.test(pick(f, "MessageRetour", "message", "status"))) return ok(trk, null, j);
    return fail(pick(f, "MessageRetour", "message", "error") || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("POST", ZRExpress.BASE + "/lire", this.h(), { Colis: [{ Tracking: trk }] })).json() ?? {}; const row = j.Colis?.[0] ?? j[0] ?? j;
    const raw = pick(row && typeof row === "object" ? row : {}, "Situation", "situation", "Statut", "status");
    if (!raw) throw new ApiError("حالة الطرد غير موجودة في ردّ الشركة"); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
}

/* ───── Maystro — تجريبي ───── */
class Maystro extends Adapter {
  static BASE = "https://backend.maystro-delivery.com/api";
  static fields() { return [{ key: "apiKey", label: "API Key", secret: true }]; }
  h() { return { Authorization: "Token " + this.cred.apiKey, "Content-Type": "application/json" }; }
  async create(p) {
    const r = await this.send("POST", Maystro.BASE + "/stores/orders/", this.h(), { external_order_id: p.orderRef, customer_name: p.name, customer_phone: p.localPhone(), wilaya: p.wilayaCode, commune: p.commune,
      destination_text: p.address || p.wilayaName, product_price: Math.round(p.total), delivery_type: p.stopDesk ? 1 : 0, note_to_driver: p.note, product_name: p.productsText() });
    const j = r.json() ?? {}; const trk = pick(j, "display_id", "tracking", "id", "order_id");
    return r.ok && trk ? ok(trk, null, j) : fail(pick(j, "detail", "message", "error") || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("GET", `${Maystro.BASE}/stores/orders/${encodeURIComponent(trk)}/`, this.h())).json() ?? {}; const raw = pick(j, "status_name", "status", "state");
    if (!raw) throw new ApiError("حالة الطرد غير موجودة في ردّ الشركة"); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
}

/* ───── NOEST — تجريبي ───── */
class Noest extends Adapter {
  static BASE = "https://app.noest-dz.com/api/public";
  static fields() { return [{ key: "apiToken", label: "api_token", secret: true }, { key: "userGuid", label: "user_guid", secret: true }]; }
  auth(x = {}) { return { api_token: this.cred.apiToken, user_guid: this.cred.userGuid, ...x }; }
  async create(p) {
    const r = await this.send("POST", Noest.BASE + "/create/order", { "Content-Type": "application/json" }, this.auth({ reference: p.orderRef, client: p.name, phone: p.localPhone(), phone_2: p.phone2 ? p.localPhone(p.phone2) : "",
      adresse: p.address || p.wilayaName, wilaya_id: p.legacyWilaya, commune: p.commune, montant: Math.round(p.total), produit: p.productsText(), remarque: p.note, stop_desk: p.stopDesk ? 1 : 0, stock: 0 }));
    const j = r.json() ?? {}; const trk = pick(j, "tracking", "tracking_number");
    return r.ok && trk && j.success !== false ? ok(trk, null, j) : fail(pick(j, "message", "error") || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("POST", Noest.BASE + "/get/trackings/info", { "Content-Type": "application/json" }, this.auth({ trackings: [trk] }))).json() ?? {};
    const row = j[trk] ?? j.data?.[0] ?? j[0] ?? j; const a = row && typeof row === "object" ? row.activity : null; const last = Array.isArray(a) && a.length ? a[a.length - 1] : null;
    const raw = pick(last ?? {}, "status", "event") || pick(row && typeof row === "object" ? row : {}, "status", "last_status");
    if (!raw) throw new ApiError("حالة الطرد غير موجودة في ردّ الشركة"); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
  async cancel(trk) { return (await this.send("POST", Noest.BASE + "/delete/order", { "Content-Type": "application/json" }, this.auth({ tracking: trk }))).ok; }
}

/* ───── عائلة Ecotrack: محوّل واحد برابط لكل شركة — تجريبي ───── */
class Ecotrack extends Adapter {
  constructor(http, code = "ecotrack", base = "") { super(http); this.code = code; this.base = String(base || "").replace(/\/+$/, ""); }
  static fields() { return [{ key: "baseUrl", label: "رابط المنصة (مثال: https://dhd.ecotrack.dz)", secret: false, required: false }, { key: "token", label: "API Token (Bearer)", secret: true }, { key: "boutique", label: "اسم المتجر عند الشركة (اختياري)", secret: false, required: false }]; }
  authenticate(c) { super.authenticate(c); if (this.cred.baseUrl) this.base = this.cred.baseUrl.replace(/\/+$/, ""); if (!safeHttpsUrl(this.base)) throw new CredentialsError("رابط المنصة مطلوب ويبدأ بـ https://"); return this; }
  h(json = false) { const h = { Authorization: "Bearer " + this.cred.token, Accept: "application/json" }; return json ? { ...h, "Content-Type": "application/json" } : h; }
  async create(p) {
    const r = await this.send("POST", this.base + "/api/v1/create/order", this.h(true), { reference: p.orderRef, nom_client: p.name, telephone: p.localPhone(), telephone_2: p.phone2 ? p.localPhone(p.phone2) : "",
      adresse: p.address || `${p.commune}، ${p.wilayaName}`, code_postal: "", commune: p.commune, code_wilaya: p.legacyWilaya, montant: Math.round(p.total), remarque: p.note, produit: p.productsText(),
      boutique: this.cred.boutique || "", type: 1, stop_desk: p.stopDesk ? 1 : 0, quantite: 1 });
    const j = r.json() ?? {}; const trk = pick(j, "tracking", "tracking_number") || pick(j.data ?? {}, "tracking");
    if (r.ok && trk) return ok(trk, null, j);
    return fail((pick(j, "message") + (j.errors ? " — " + JSON.stringify(j.errors) : "")).trim() || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("GET", `${this.base}/api/v1/get/tracking/info?tracking=${encodeURIComponent(trk)}`, this.h())).json() ?? {}; const d = j.activity ? j : (j.data ?? j);
    const a = d.activity ?? d.history ?? null; const last = Array.isArray(a) && a.length ? a[a.length - 1] : null;
    const raw = pick(last ?? {}, "status", "event") || pick(d && typeof d === "object" ? d : {}, "status", "last_status");
    if (!raw) throw new ApiError("حالة الطرد غير موجودة في ردّ الشركة"); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
  async cancel(trk) { return (await this.send("DELETE", `${this.base}/api/v1/delete/order?tracking=${encodeURIComponent(trk)}`, this.h())).ok; }
}

const E = (label, base = null, verified = false, aliases = []) => ({ label, cls: "eco", maturity: "experimental", base, base_verified: verified, aliases });
export const CARRIERS = {
  yalidine: { label: "Yalidine", cls: Yalidine, maturity: "verified" },
  zrexpress: { label: "ZR Express", cls: ZRExpress, maturity: "experimental", aliases: ["zr", "procolis"] },
  maystro: { label: "Maystro Delivery", cls: Maystro, maturity: "experimental" },
  noest: { label: "NOEST Express", cls: Noest, maturity: "experimental" },
  ecotrack: E("Ecotrack (منصة عامة)"), dhd: E("DHD Livraison", "https://dhd.ecotrack.dz", true, ["dhd_livraison"]), conexlog: E("Conexlog"), zimou: E("Zimou Express"), hhd: E("HHD Express"),
  anderson: E("Anderson Delivery"), ecom_delivery: E("E-com Delivery"), elogistia: E("Elogistia"), "48h": E("48H Express"),
  mylers: { label: "Mylers", cls: null, maturity: "planned" },
};
export function resolveCarrier(code) {
  const c = String(code ?? "").toLowerCase().trim(); if (CARRIERS[c]) return c;
  for (const [k, m] of Object.entries(CARRIERS)) if ((m.aliases ?? []).includes(c)) return k; return null;
}
export function makeAdapter(code, http, baseOverride = null) {
  const k = resolveCarrier(code); if (!k) throw new UnsupportedError("شركة غير معروفة: " + code);
  const m = CARRIERS[k]; if (!m.cls) throw new UnsupportedError(m.label + " غير مدعومة بعد (لا توثيق API مؤكَّد)");
  if (m.cls === "eco") return Object.assign(new Ecotrack(http, k, baseOverride || m.base || ""), { code: k });
  return Object.assign(new m.cls(http), { code: k });
}
export function carrierFields(code) { const m = CARRIERS[resolveCarrier(code)]; if (!m?.cls) return []; return (m.cls === "eco" ? Ecotrack : m.cls).fields(); }
export function catalog() {
  return Object.entries(CARRIERS).map(([code, m]) => ({ code, label: m.label, maturity: m.maturity, activatable: !!m.cls, gateway: false, needs_base_url: m.cls === "eco" && !m.base, fields: carrierFields(code) }));
}
export { Adapter, ok as okResult, fail as failResult };
