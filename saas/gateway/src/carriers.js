import { pick, safeHttpsUrl } from "./util.js";
import { explain, mapStatus, S } from "./status.js";
import { best as bestCommune, suggest as suggestCommunes } from "./commune.js";

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
  /** عائلة قاموس الحالات (الشركات التي تتشارك المنصة نفسها تتشارك القاموس). */
  family() { return this.code; }
  mapStatus(raw) { return mapStatus(raw, this.family()); }
  async send(method, url, headers = {}, body = null) {
    const r = await this.http(method, url, headers, body);
    if (r.status === 0) throw new ApiError("تعذّر الاتصال بالشركة: " + (r.error || "خطأ شبكة"));
    if (r.status === 401 || r.status === 403) throw new CredentialsError("رفضت الشركة المفاتيح (HTTP " + r.status + ")");
    if (r.status === 429) throw new ApiError("الشركة تطلب التمهل (429): أعد المحاولة بعد قليل");
    return r;
  }
  /** فحص المفاتيح بطلب قراءة فقط: ok=true صالحة، false مرفوضة، null تعذّر الحكم (شبكة/ردّ غير متوقع). */
  async probe(fn) {
    try { const [ok, message] = await fn(); return { ok, message }; }
    catch (e) { return e instanceof CredentialsError ? { ok: false, message: e.message } : { ok: null, message: String(e.message || e) }; }
  }
  async ping() { return { ok: null, message: "الفحص غير مدعوم لهذه الشركة" }; }
  /** يحلّ اسم البلدية على قائمة الشركة: يصحّح التهجئة أو يُرجع {error} واضحاً مع الأقرب. */
  resolveCommune(list, p, label) {
    const m = bestCommune(list, p.commune);
    if (m) return { name: String(m.name), id: m.id };
    return { error: `بلدية «${p.commune}» غير موجودة عند ${label} في ${p.wilayaName} — الأقرب: ${suggestCommunes(list, p.commune).join("، ")}` };
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
const ok = (tracking, labelUrl = null, raw = {}, warn = "") => ({ ok: true, tracking, labelUrl, error: warn, raw });
const fail = (error, raw = {}) => ({ ok: false, tracking: "", labelUrl: null, error, raw });
const httpsOnly = (u) => (typeof u === "string" && u.startsWith("https://") ? u : null);
const clip = (s, n) => String(s ?? "").slice(0, n);
const missing = () => new ApiError("حالة الطرد غير موجودة في ردّ الشركة");

/* ───── Yalidine (مُتحقَّق منه على حساب حقيقي: إنشاء/تتبع/بوليصة/إلغاء) ───── */
class Yalidine extends Adapter {
  static BASE = "https://api.yalidine.app";
  static fields() { return [{ key: "apiId", label: "API ID", secret: false }, { key: "apiToken", label: "API Token", secret: true }, { key: "fromWilaya", label: "ولاية الانطلاق (مثال: Alger)", secret: false, required: false }]; }
  h(json = false) { const h = { "X-API-ID": this.cred.apiId, "X-API-TOKEN": this.cred.apiToken }; return json ? { ...h, "Content-Type": "application/json" } : h; }
  statusText(v) { return v && typeof v === "object" ? String(v.name ?? v.label ?? "").trim() : String(v ?? "").trim(); }
  async ping() {
    return this.probe(async () => { const r = await this.send("GET", Yalidine.BASE + "/v1/wilayas/?page_size=1", this.h()); return r.ok ? [true, "المفاتيح صالحة"] : [null, `ردّ غير متوقع (HTTP ${r.status})`]; });
  }
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
    if (!raw) throw missing(); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
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

/* ───── ZR Express (Procolis القديمة): ترويستا token/key، add_colis {Colis:[…]}، الرفض HTTP 200 + MessageRetour ───── */
class ZRExpress extends Adapter {
  static BASE = "https://procolis.com/api_v1";
  static fields() { return [{ key: "token", label: "Token", secret: true }, { key: "key", label: "Key", secret: true }]; }
  h() { return { token: this.cred.token, key: this.cred.key, "Content-Type": "application/json" }; }
  async ping() {
    return this.probe(async () => {
      const r = await this.send("GET", ZRExpress.BASE + "/token", this.h()); const j = r.json() ?? {}; const s = pick(j, "Statut", "statut", "status");
      if (r.ok && /acc[eè]s activ/iu.test(s)) return [true, "المفاتيح صالحة"];
      return r.ok ? [false, "الحساب غير مفعّل للواجهة البرمجية: " + (s || "ردّ فارغ")] : [null, `ردّ غير متوقع (HTTP ${r.status})`];
    });
  }
  async create(p) {
    const row = { Tracking: "", TypeLivraison: p.stopDesk ? "1" : "0", TypeColis: "0", Confrimee: "1",   // «Confrimee» تهجئة الشركة نفسها
      Client: p.name, MobileA: p.localPhone(), MobileB: p.phone2 ? p.localPhone(p.phone2) : "", Adresse: p.address || p.commune, IDWilaya: String(p.legacyWilaya), Commune: p.commune,
      Total: String(Math.round(p.total)), Note: clip(p.note, 250), TProduit: p.productsText(250), id_Externe: p.orderRef, Source: "Alyssum" };
    const r = await this.send("POST", ZRExpress.BASE + "/add_colis", this.h(), { Colis: [row] }); const j = r.json() ?? {};
    const first = j.Colis?.[0] && typeof j.Colis[0] === "object" ? j.Colis[0] : (j[0] && typeof j[0] === "object" ? j[0] : j);
    const trk = pick(first, "Tracking", "tracking", "tracking_code"), msg = pick(first, "MessageRetour", "message", "status");
    if (msg === "Double Tracking") return fail("طرد مكرّر عند ZR (Double Tracking) — لا يُرسل ثانية", j);
    return r.ok && trk && (msg === "" || msg.toLowerCase() === "good") ? ok(trk, null, j) : fail(msg || "HTTP " + r.status, j);
  }
  async track(trk) {
    const r = await this.send("POST", ZRExpress.BASE + "/lire", this.h(), { Colis: [{ Tracking: trk }] }); const body = String(r.body ?? "").trim();
    if (body === "null" || body === "") throw new ApiError("لم تجد الشركة هذا الطرد");
    const j = r.json() ?? {}; const row = j.Colis?.[0] ?? j[0] ?? j;
    const raw = pick(row && typeof row === "object" ? row : {}, "Situation", "situation", "Statut", "status");
    if (!raw) throw missing(); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
}

/* ───── Maystro: Authorization: Token، معرّف بلدية رقمي من base/communes، products[] وsource ───── */
class Maystro extends Adapter {
  static BASE = "https://backend.maystro-delivery.com/api";
  static fields() {
    return [{ key: "apiKey", label: "API Key (Token)", secret: true },
      { key: "scheme", label: "نمط نوع التوصيل: v2 (1 منزل، 2 مكتب — الافتراضي) أو v1 (0/1)", secret: false, required: false },
      { key: "priceMode", label: "سعر المنتج المرسل: items (بلا التوصيل — الافتراضي) أو total (شاملاً التوصيل)", secret: false, required: false }];
  }
  h() { return { Authorization: "Token " + this.cred.apiKey, "Content-Type": "application/json", Accept: "application/json" }; }
  async ping() {
    return this.probe(async () => { const r = await this.send("GET", Maystro.BASE + "/base/wilayas/?country=1&language=fr", this.h()); return r.ok ? [true, "المفتاح صالح"] : [null, `ردّ غير متوقع (HTTP ${r.status})`]; });
  }
  async communes(w) {
    this._c ??= {}; if (this._c[w]) return this._c[w];
    const j = (await this.send("GET", `${Maystro.BASE}/base/communes/?wilaya=${w}`, this.h())).json() ?? {};
    const rows = Array.isArray(j.results) ? j.results : Array.isArray(j) ? j : [];
    return (this._c[w] = rows.filter((c) => c && typeof c === "object" && c.id !== undefined && c.name !== undefined).map((c) => ({ id: c.id, name: String(c.name) })));
  }
  async create(p) {
    const w = p.legacyWilaya, list = await this.communes(w);
    if (!list.length) return fail(`تعذّر جلب بلديات ولاية ${w} من Maystro (راجع المفتاح أو أعد المحاولة)`);
    const m = this.resolveCommune(list, p, "Maystro"); if (m.error) return fail(m.error);
    const v1 = (this.cred.scheme || "v2") === "v1", price = (this.cred.priceMode || "items") === "total" ? Math.round(p.total) : p.priceWithoutShipping();
    const r = await this.send("POST", Maystro.BASE + "/stores/orders/", this.h(), { wilaya: w, commune: parseInt(m.id, 10), destination_text: p.address ? clip(p.address, 255) : p.commune,
      customer_name: p.name, customer_phone: p.localPhone(), product_price: price, delivery_type: v1 ? (p.stopDesk ? 1 : 0) : (p.stopDesk ? 2 : 1), express: false, note_to_driver: clip(p.note, 250),
      products: [{ logistical_description: p.productsText() || "Produit", quantity: 1 }], source: 4, external_order_id: p.orderRef });
    let j = r.json() ?? {}; if (Array.isArray(j) && j[0] && typeof j[0] === "object") j = j[0];
    const id = pick(j, "id", "order_id");
    if (r.ok && id) return ok(id, null, j);
    const code = parseInt(j.code ?? j.error_code ?? 0, 10) || 0;
    const known = { 40: "الولاية أو البلدية غير موجودة عند Maystro", 45: "هذا النوع من التوصيل غير متاح في هذه البلدية", 50: "منتجات الطلب غير صالحة" };
    return fail(`${known[code] ?? ""} ${pick(j, "detail", "message", "error")}`.trim() || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("GET", `${Maystro.BASE}/stores/orders/${encodeURIComponent(trk)}/`, this.h())).json() ?? {}; const raw = pick(j, "status", "status_name", "state");
    if (!raw) throw missing(); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
  async cancel(trk) { return (await this.send("PATCH", `${Maystro.BASE}/orders/${encodeURIComponent(trk)}/status/`, this.h(), { status: 50 })).ok; }
}

/* ───── NOEST: Bearer + api_token/user_guid في الجسم، الطرد مسوّدة حتى valid/order ───── */
class Noest extends Adapter {
  static BASE = "https://app.noest-dz.com/api/public";
  static fields() {
    return [{ key: "apiToken", label: "api_token", secret: true }, { key: "userGuid", label: "user_guid", secret: true },
      { key: "autoValidate", label: "تصديق الطرد تلقائياً بعد الإنشاء (1 افتراضي، 0 يبقى مسوّدة)", secret: false, required: false }];
  }
  auth(x = {}) { return { api_token: this.cred.apiToken, user_guid: this.cred.userGuid, ...x }; }
  h() { return { Authorization: "Bearer " + this.cred.apiToken, "Content-Type": "application/json", Accept: "application/json" }; }
  async ping() {
    return this.probe(async () => { const r = await this.send("GET", Noest.BASE + "/get/wilayas", this.h()); const j = r.json(); return r.ok && Array.isArray(j) ? [true, "المفتاح صالح"] : [null, `ردّ غير متوقع (HTTP ${r.status})`]; });
  }
  async communes(w) {
    this._c ??= {}; if (this._c[w]) return this._c[w];
    let j; try { j = (await this.send("GET", `${Noest.BASE}/get/communes/${w}`, this.h())).json() ?? []; } catch (e) { if (e instanceof ApiError) return []; throw e; }
    return (this._c[w] = (Array.isArray(j) ? j : []).filter((c) => c && typeof c === "object" && c.nom !== undefined).map((c) => ({ id: String(c.nom), name: String(c.nom) })));
  }
  async create(p) {
    if (p.stopDesk && p.deskCode === "") return fail("NOEST يحتاج رمز مكتب Stop Desk (station_code مثل 16A) — اختر المكتب أو أرسل للمنزل");
    let commune = p.commune; const list = await this.communes(p.legacyWilaya);
    if (list.length) { const m = this.resolveCommune(list, p, "NOEST"); if (m.error) return fail(m.error); commune = m.name; }
    const body = this.auth({ reference: p.orderRef, client: p.name, phone: p.localPhone(), adresse: p.address ? clip(p.address, 255) : p.commune, wilaya_id: p.legacyWilaya, commune, montant: Math.round(p.total),
      produit: clip(p.productsText() || "Produit", 255), type_id: 1, poids: 1, stop_desk: p.stopDesk ? 1 : 0, can_open: p.canOpen ? 1 : 0, stock: 0 });
    if (p.phone2) body.phone_2 = p.localPhone(p.phone2);
    if (p.note) body.remarque = clip(p.note, 255);
    if (p.stopDesk) body.station_code = p.deskCode;
    const r = await this.send("POST", Noest.BASE + "/create/order", this.h(), body); const j = r.json() ?? {}; const trk = pick(j, "tracking", "tracking_number");
    if (r.ok && trk && j.success !== false) {
      let warn = "";
      if ((this.cred.autoValidate ?? "1") !== "0") {
        const v = await this.send("POST", Noest.BASE + "/valid/order", this.h(), this.auth({ tracking: trk })); const vj = v.json() ?? {};
        if (!v.ok || vj.success === false) warn = "أُنشئ الطرد لكن لم يُصدَّق عند الشركة: " + (pick(vj, "message") || "HTTP " + v.status);
      }
      return ok(trk, null, j, warn);
    }
    const msg = pick(j, "message", "error") + (j.errors ? " — " + JSON.stringify(j.errors) : "");
    return fail(msg.trim() || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("POST", Noest.BASE + "/get/trackings/info", this.h(), this.auth({ trackings: [trk] }))).json() ?? {};
    if (j.message !== undefined && j[trk] === undefined) throw new ApiError("لم تجد الشركة الطرد: " + pick(j, "message"));
    const row = j[trk] ?? j.data?.[0] ?? j[0] ?? j; const a = row && typeof row === "object" ? row.activity : null; let raw = "";
    if (Array.isArray(a)) for (const ev of [...a].reverse()) { const k = pick(ev && typeof ev === "object" ? ev : {}, "event_key", "status", "event"); if (k && explain("noest", k)[0] !== "ignore") { raw = k; break; } }
    if (!raw) throw missing(); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
  async cancel(trk) { const r = await this.send("POST", Noest.BASE + "/delete/order", this.h(), this.auth({ tracking: trk })); const j = r.json() ?? {}; return r.ok && j.success !== false; }
}

/* ───── عائلة Ecotrack: محوّل واحد برابط لكل شركة؛ create/order بمعاملات استعلام وبلا جسم ───── */
class Ecotrack extends Adapter {
  constructor(http, code = "ecotrack", base = "") { super(http); this.code = code; this.base = String(base || "").replace(/\/+$/, ""); }
  family() { return "ecotrack"; }
  static fields() {
    return [{ key: "baseUrl", label: "رابط المنصة (مثال: https://dhd.ecotrack.dz)", secret: false, required: false }, { key: "token", label: "API Token (Bearer)", secret: true },
      { key: "boutique", label: "اسم المتجر عند الشركة (اختياري)", secret: false, required: false },
      { key: "autoValidate", label: "تصديق الطرد تلقائياً بعد الإنشاء (1 افتراضي، 0 يبقى مسوّدة)", secret: false, required: false }];
  }
  authenticate(c) { super.authenticate(c); if (this.cred.baseUrl) this.base = this.cred.baseUrl.replace(/\/+$/, ""); if (!safeHttpsUrl(this.base)) throw new CredentialsError("رابط المنصة مطلوب ويبدأ بـ https://"); return this; }
  h() { return { Authorization: "Bearer " + this.cred.token, Accept: "application/json" }; }
  async ping() {
    return this.probe(async () => {
      const j = (await this.send("GET", this.base + "/api/v1/validate/token?api_token=" + encodeURIComponent(this.cred.token), this.h())).json() ?? {}; const m = pick(j, "message");
      if (m === "VALID_TOKEN") return [true, "المفتاح صالح"];
      if (m === "TOKEN_NOT_ALLOWED") return [false, "الواجهة البرمجية غير مفعّلة لحسابك عند الشركة (TOKEN_NOT_ALLOWED)"];
      if (m === "INVALID_TOKEN") return [false, "المفتاح غير صالح (INVALID_TOKEN)"];
      return [null, "ردّ غير متوقع من الشركة: " + (m || "فارغ")];
    });
  }
  async communes(w) {
    this._c ??= {}; if (this._c[w]) return this._c[w];
    let j; try { j = (await this.send("GET", `${this.base}/api/v1/get/communes?wilaya_id=${w}`, this.h())).json() ?? {}; } catch (e) { if (e instanceof ApiError) return []; throw e; }
    return (this._c[w] = Object.values(j).filter((c) => c && typeof c === "object" && c.nom !== undefined).map((c) => ({ id: String(c.nom), name: String(c.nom), desk: String(c.code_postal ?? "") })));
  }
  errorText(j, status) {
    const code = parseInt(j.code ?? j.error_code ?? 0, 10) || 0;
    const known = { 10001: "الطلب مُصدَّق ولا يقبل التعديل", 10002: "الشركة لا توصّل إلى هذه الولاية", 10003: "لا يمكن طلب الإرجاع الآن" };
    const msg = pick(j, "message") + (j.errors ? " — " + JSON.stringify(j.errors) : "");
    return `${known[code] ?? ""} ${msg}`.trim() || "HTTP " + status;
  }
  async create(p) {
    let commune = p.commune; const list = await this.communes(p.legacyWilaya);
    if (list.length) { const m = this.resolveCommune(list, p, "الشركة"); if (m.error) return fail(m.error); commune = m.name; }
    if (p.stopDesk && p.deskCode === "") return fail("Ecotrack يحتاج رمز مكتب Stop Desk (code_postal) — اختر المكتب أو أرسل للمنزل");
    const q = { reference: p.orderRef, nom_client: p.name, telephone: p.localPhone(), telephone_2: p.phone2 ? p.localPhone(p.phone2) : "", adresse: p.address || `${p.commune}، ${p.wilayaName}`, commune,
      code_wilaya: p.legacyWilaya, montant: Math.round(p.total), type: 1, stop_desk: p.stopDesk ? 1 : 0, code_postal: p.stopDesk ? p.deskCode : "", remarque: clip(p.note, 255), produit: clip(p.productsText(), 255), boutique: this.cred.boutique || "" };
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(q)) if (v !== "" && v !== null && v !== undefined) qs.set(k, String(v));
    const r = await this.send("POST", `${this.base}/api/v1/create/order?${qs}`, this.h()); const j = r.json() ?? {};
    const trk = pick(j, "tracking", "tracking_number") || pick(j.data && typeof j.data === "object" ? j.data : {}, "tracking");
    if (r.ok && trk && j.success !== false) {
      let warn = "";
      if ((this.cred.autoValidate ?? "1") !== "0") {
        const v = await this.send("POST", `${this.base}/api/v1/valid/order?tracking=${encodeURIComponent(trk)}`, this.h()); const vj = v.json() ?? {};
        if (!v.ok || vj.success === false) warn = "أُنشئ الطرد لكن لم يُصدَّق عند الشركة: " + (pick(vj, "message") || "HTTP " + v.status);
      }
      return ok(trk, null, j, warn);
    }
    return fail(this.errorText(j, r.status), j);
  }
  async track(trk) {
    const j = (await this.send("GET", `${this.base}/api/v1/get/tracking/info?tracking=${encodeURIComponent(trk)}`, this.h())).json() ?? {};
    const d = j.activity !== undefined ? j : (j.data && typeof j.data === "object" ? j.data : j); const rows = d.activity ?? d.history ?? null; let raw = "";
    if (Array.isArray(rows)) for (const row of [...rows].reverse()) { const c = pick(row && typeof row === "object" ? row : {}, "status", "event"); if (c && explain("ecotrack", c)[0] !== "ignore") { raw = c; break; } }
    if (!raw) raw = pick(d && typeof d === "object" ? d : {}, "status", "last_status");
    if (!raw) throw missing(); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
  async cancel(trk) { const r = await this.send("DELETE", `${this.base}/api/v1/delete/order?tracking=${encodeURIComponent(trk)}`, this.h()); const j = r.json() ?? {}; return r.ok && (j.delete === undefined || j.delete === "success"); }
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
