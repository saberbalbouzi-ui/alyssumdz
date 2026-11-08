import { b64, enc, hmacHex, pick, safeEq, safeHttpsUrl, unb64 } from "./util.js";
import { ALL, explain, mapStatus, normText, S } from "./status.js";
import { best as bestCommune, suggest as suggestCommunes, normalize as ck } from "./commune.js";

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
      const loc = r.headers?.get?.("location") ?? "";
      return { status: r.status, body: text, error: "", ok: r.status >= 200 && r.status < 300, headers: { location: loc }, json: () => { try { const j = JSON.parse(text); return j && typeof j === "object" ? j : null; } catch { return null; } } };
    } catch (e) { return { status: 0, body: "", error: String(e.message || e), ok: false, json: () => null }; }
    finally { clearTimeout(t); }
  };
}

class Adapter {
  constructor(http) { this.http = http; this.cred = {}; this.profile = {}; this.pause = null; }
  static fields() { return []; }
  authenticate(c) {
    for (const f of this.constructor.fields()) if ((f.required ?? true) && !String(c[f.key] ?? "").trim()) throw new CredentialsError("الحقل مطلوب: " + f.label);
    this.cred = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v ?? "").trim()])); return this;
  }
  /** عائلة قاموس الحالات (الشركات التي تتشارك المنصة نفسها تتشارك القاموس). */
  family() { return this.code; }
  /** ملف المعايرة الخاص بحساب هذه الشركة (بلديات/مكاتب/حالات مثبَّتة). */
  withProfile(p) { this.profile = p ?? {}; return this; }
  /** fixes = قرارات إدارة المنصة (تسبق)، status_overrides = ما ثبّتته معايرة هذا الحساب. */
  override(raw) {
    const n = normText(raw);
    for (const k of ["fixes", "status_overrides"]) { const ov = this.profile?.[k]?.[n]; if (typeof ov === "string" && ALL.includes(ov)) return ov; }
    return null;
  }
  mapStatus(raw) { return this.override(raw) ?? mapStatus(raw, this.family()); }
  explainStatus(raw) { const ov = this.override(raw); return ov ? [ov, "override"] : explain(this.family(), raw); }
  /** التحقق من توقيع الـwebhook إن زوّد التاجر سرّ التوقيع: null = لا سرّ مضبوط، true/false = صحيح/خاطئ. */
  async verifyWebhook(raw, headers = {}) {
    const secret = String(this.cred.webhookSecret ?? ""); if (!secret) return null;
    const want = await hmacHex(secret, raw);
    for (const h of ["x-yalidine-signature", "x-signature", "x-hub-signature-256", "x-webhook-signature"]) {
      let v = String(headers[h] ?? "").trim().toLowerCase(); if (!v) continue; if (v.startsWith("sha256=")) v = v.slice(7);
      if (safeEq(want, v)) return true;
    }
    return false;
  }
  async breath(ms = 250) { if (this.pause) await this.pause(ms); }
  static emptyDiscovery(notes = []) { return { communes: {}, desks: {}, fees: {}, statuses: {}, trackings: [], notes }; }
  /** اكتشاف حساب الشركة بقراءة فقط للمعايرة (الافتراضي: غير متاح). */
  async discover() { return Adapter.emptyDiscovery(["الشركة لا توفّر واجهة قراءة للمعايرة"]); }
  /** GET يعيد JSON مع إعادة محاولة (حتى 3) عند 429 (حدود المعدّل أثناء الاكتشاف). */
  async getJson(url, headers) {
    for (let i = 0; ; i++) {
      try { return (await this.send("GET", url, headers)).json() ?? {}; }
      catch (e) { if (!(e instanceof ApiError) || i >= 3 || !String(e.message).includes("429")) throw e; await this.breath([2500, 6000, 15000][i]); }   // تمهّل متصاعد عند حدّ المعدّل
    }
  }
  /** قرار البلدية من ملف المعايرة: {name,id,block} — مطابق لـAbstractAdapter::profileCommune في PHP. */
  profileCommune(legacyWilaya, commune, wilayaName) {
    const w = this.profile?.communes?.[String(legacyWilaya)];
    if (!w || typeof w !== "object") return { name: null, id: null, block: null };
    const k = ck(commune); let name = w.map?.[k] ?? null;
    if (name === null && (w.n ?? 0) > 0) name = commune;
    const id = name !== null ? (w.ids?.[ck(String(name))] ?? null) : null;
    if ((w.undeliverable ?? []).map(ck).includes(k)) return { name, id, block: `الشركة لا توصّل حالياً إلى بلدية «${commune}» في ${wilayaName} (حسب معايرة حسابك)` };
    if ((w.unmatched ?? []).map(ck).includes(k)) return { name: null, id: null, block: `بلدية «${commune}» غير موجودة في قائمة الشركة لولاية ${wilayaName} (حسب معايرة حسابك) — اختر بلدية أخرى أو راجع الشركة` };
    return { name, id, block: null };
  }
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
  static fields() { return [{ key: "apiId", label: "API ID", secret: false }, { key: "apiToken", label: "API Token", secret: true }, { key: "fromWilaya", label: "ولاية الانطلاق (مثال: Alger)", secret: false, required: false },
    { key: "webhookSecret", label: "المفتاح السرّي للـwebhook (من حسابك لدى الشركة، اختياري — للتحقق من توقيع الإشعارات)", secret: true, required: false }]; }
  h(json = false) { const h = { "X-API-ID": this.cred.apiId, "X-API-TOKEN": this.cred.apiToken }; return json ? { ...h, "Content-Type": "application/json" } : h; }
  statusText(v) { return v && typeof v === "object" ? String(v.name ?? v.label ?? "").trim() : String(v ?? "").trim(); }
  async ping() {
    return this.probe(async () => { const r = await this.send("GET", Yalidine.BASE + "/v1/wilayas/?page_size=1", this.h()); return r.ok ? [true, "المفاتيح صالحة"] : [null, `ردّ غير متوقع (HTTP ${r.status})`]; });
  }
  async create(p) {
    const [first, family] = p.nameParts(), price = p.priceWithoutShipping();
    if (p.stopDesk && !p.deskId) return fail("مكتب Stop Desk غير محدد");
    const pc = this.profileCommune(p.legacyWilaya, p.commune, p.wilayaName); if (pc.block !== null) return fail(pc.block);   // تصحيح حسابك من المعايرة (إن وُجدت)
    const known = this.profile?.desks?.[String(p.legacyWilaya)];
    if (p.stopDesk && Array.isArray(known) && known.length && !known.map((d) => String(d.id)).includes(String(p.deskId))) return fail(`مكتب Stop Desk رقم ${p.deskId} غير موجود عند الشركة في ${p.wilayaName} (حسب معايرة حسابك)`);
    const from = this.cred.fromWilaya || "Alger";   // الاسم؛ الطبقة العليا تحوّل الرقم إلى اسم
    const body = { order_id: p.orderRef, from_wilaya_name: from, firstname: first, familyname: family, contact_phone: p.localPhone(), address: p.address || `${p.commune}، ${p.wilayaName}`,
      to_commune_name: pc.name ?? p.commune, to_wilaya_name: p.legacyName, product_list: p.productsText(), price, do_insurance: true, declared_value: price, freeshipping: p.shippingFee <= 0,
      is_stopdesk: p.stopDesk, has_exchange: false, opening_decision: p.canOpen ? "accept" : "reject" };
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
  async pages(path, sep = "?") {
    const rows = [];
    for (let page = 1; page <= 6; page++) {
      const j = await this.getJson(Yalidine.BASE + path + sep + "page_size=100&page=" + page, this.h());
      for (const r of Array.isArray(j.data) ? j.data : []) if (r && typeof r === "object") rows.push(r);
      if (!j.has_more) break; await this.breath();
    }
    return rows;
  }
  async discover(wilayas, want = {}) {
    const d = Adapter.emptyDiscovery();
    try {
      if (want.communes) for (const w of wilayas) {
        await this.breath(); const list = [];
        for (const r of await this.pages("/v1/communes/?wilaya_id=" + (+w), "&")) { const nm = String(r.name ?? "").trim(); if (!nm) continue; const dv = r.is_deliverable ?? 1; list.push({ name: nm, deliverable: !(dv === 0 || dv === false || dv === "0") }); }
        d.communes[+w] = list;
      }
      if (want.desks) for (const w of wilayas) {
        await this.breath(); const list = [];
        for (const r of await this.pages("/v1/centers/?wilaya_id=" + (+w), "&")) { if (r.center_id === undefined || r.center_id === null) continue; list.push({ id: String(r.center_id), name: String(r.name ?? ""), commune: String(r.commune_name ?? "") }); }
        d.desks[+w] = list;
      }
      if (want.fees) for (const r of await this.pages("/v1/deliveryfees/")) { const id = +(r.wilaya_id ?? 0); if (id < 1) continue; d.fees[id] = { home: +(r.home_fee ?? 0), stop: +(r.desk_fee ?? r.stop_fee ?? 0) }; }
      if (want.statuses) {
        const j = await this.getJson(Yalidine.BASE + "/v1/parcels/?page_size=100&order_by=date_creation&order=desc", this.h());
        for (const r of Array.isArray(j.data) ? j.data : []) {
          if (!r || typeof r !== "object") continue; const st = this.statusText(r.last_status ?? ""); if (st) d.statuses[st] = (d.statuses[st] ?? 0) + 1;
          const t = String(r.tracking ?? ""); if (t && d.trackings.length < 3 && !d.trackings.includes(t)) d.trackings.push(t);
        }
      }
    } catch (e) { if (e instanceof ApiError) d.notes.push(e.message); else throw e; }
    return d;
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

/* ───── WeCan Service: POST /api/v1/parcels (مصفوفة بصيغة ياليدين) ← «Commandes»؛ POST /orders لا يُستعمل (Commandes d'entrepôt) ───── */
class WeCan extends Adapter {
  static BASE = "https://wecanservices.com/api/v1";
  static fields() { return [{ key: "apiKey", label: "X-API-Key", secret: false }, { key: "apiSecret", label: "X-API-Secret", secret: true }, { key: "fromWilaya", label: "ولاية الانطلاق (مثال: Alger)", secret: false, required: false },
    { key: "webhookSecret", label: "سرّ توقيع الـwebhook (اختياري)", secret: true, required: false }]; }
  family() { return "wecan"; }
  h(json = false) { const h = { "X-API-Key": this.cred.apiKey, "X-API-Secret": this.cred.apiSecret, Accept: "application/json" }; return json ? { ...h, "Content-Type": "application/json" } : h; }
  async ping() {
    return this.probe(async () => { const r = await this.send("GET", WeCan.BASE + "/locations/states", this.h()); return r.ok ? [true, "المفاتيح صالحة"] : [null, `ردّ غير متوقع (HTTP ${r.status})`]; });
  }
  async create(p) {
    const [first, family] = p.nameParts(), price = p.priceWithoutShipping();   // WeCan: Sous-total = price ثم تضيف «Frais de livraison» من تعريفتها
    if (p.stopDesk && !p.deskId) return fail("مكتب Stop Desk غير محدد");
    const pc = this.profileCommune(p.legacyWilaya, p.commune, p.wilayaName); if (pc.block !== null) return fail(pc.block);
    const body = { order_id: p.orderRef, firstname: first, familyname: family, contact_phone: p.localPhone(), address: p.address || `${p.commune}، ${p.wilayaName}`,
      to_commune_name: pc.name ?? p.commune, to_wilaya_name: p.legacyName, product_list: p.productsText(), price, do_insurance: false, declared_value: price,
      freeshipping: p.shippingFee <= 0, delivery_fee: Math.max(0, Math.trunc(p.shippingFee)), shipping_type: p.stopDesk ? "express_desk" : "express_home",
      is_stopdesk: p.stopDesk, has_exchange: false, length: 10, width: 10, height: 10, weight: 1, from_wilaya_name: this.cred.fromWilaya || "Alger" };
    if (p.stopDesk) body.stopdesk_id = +p.deskId;
    const r = await this.send("POST", WeCan.BASE + "/parcels", this.h(true), [body]); const j = r.json() ?? {};
    const row = j[p.orderRef] ?? (Array.isArray(j.data) ? j.data[0] : null) ?? {}; let trk = String(row.tracking ?? "");
    if (!trk && row.success === true) trk = String(row.order_id ?? p.orderRef);   // «A vérifier»: بلا تتبع بعد ← نحفظ رقم الطلب
    if (r.ok && row.success !== false && trk) return ok(trk, httpsOnly(row.label), j);
    return fail(String(row.message || j.message || "") || "HTTP " + r.status, j);
  }
  async track(trk) {
    const j = (await this.send("GET", `${WeCan.BASE}/parcels/${encodeURIComponent(trk)}`, this.h())).json() ?? {}; const d = j.data?.[0] ?? j; const raw = String(d.last_status ?? "").trim();
    if (!raw) throw missing(); return { tracking: trk, rawStatus: raw, status: this.mapStatus(raw), raw: j };
  }
  async cancel(trk) { return (await this.send("DELETE", `${WeCan.BASE}/parcels/${encodeURIComponent(trk)}`, this.h())).ok; }
  async labelUrl(trk) { const j = (await this.send("GET", `${WeCan.BASE}/parcels/${encodeURIComponent(trk)}`, this.h())).json() ?? {}; const d = j.data?.[0] ?? j; return httpsOnly(d.label); }
  parseWebhook(payload) {
    const items = payload?.data !== undefined ? (Array.isArray(payload.data) ? payload.data : [payload.data]) : Array.isArray(payload) ? payload : [payload];
    const out = [];
    for (const it of items) { if (!it || typeof it !== "object") continue;
      const a = it.attributes && typeof it.attributes === "object" ? it.attributes : it;
      const trk = pick(a, "tracking", "tracking_number") || pick(it, "tracking", "tracking_number");
      const raw = String(a.last_status ?? a.status ?? it.last_status ?? "").trim();
      if (trk && raw) out.push({ tracking: trk, rawStatus: raw, status: this.mapStatus(raw), orderRef: pick(a, "order_id", "external_id") }); }
    return out;
  }
}

/* ───── ZR Express (Procolis القديمة): ترويستا token/key، add_colis {Colis:[…]}، الرفض HTTP 200 + MessageRetour ───── */
class ZRExpress extends Adapter {
  static BASE = "https://procolis.com/api_v1";
  static fields() { return [{ key: "token", label: "Token", secret: true }, { key: "key", label: "Key", secret: true }]; }
  async discover() { return Adapter.emptyDiscovery(["ZR Express (Procolis) لا توفّر واجهة قراءة للبلديات أو الطرود: تُتحقَّق الحساب بفحص المفاتيح فقط"]); }
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

/* ───── ZR Express — المنصة الجديدة api.zrexpress.app: X-Api-Key + X-Tenant، أقاليم UUID، الطرد يُنشأ «استلام الطلب» حتى يُعيَّن stateId الجاهز للإرسال ───── */
class ZRExpressApp extends Adapter {
  static BASE = "https://api.zrexpress.app/api/v1";
  static fields() {
    return [{ key: "apiKey", label: "X-Api-Key (اللوحة ← API Rest ← Token API)", secret: true }, { key: "tenant", label: "X-Tenant (معرّف الحساب)", secret: false },
      { key: "autoDispatch", label: "جعل الطرد «جاهز للإرسال» تلقائياً بعد إنشائه (1 افتراضي، 0 يبقى «استلام الطلب»)", secret: false, required: false },
      { key: "webhookSecret", label: "سرّ توقيع الـwebhook (whsec_… من لوحة ZR، اختياري — للتحقق من توقيع الإشعارات)", secret: true, required: false }];
  }
  family() { return "zrexpress"; }
  /** توقيع Svix: HMAC-SHA256(مفتاح whsec مفكوك base64، `${id}.${ts}.${body}`) ← "v1,<base64>"؛ المهلة 10 دقائق ضد إعادة الإرسال. null = لا سرّ مضبوط. */
  async verifyWebhook(raw, headers = {}) {
    const secret = String(this.cred.webhookSecret ?? ""); if (!secret) return null;
    const id = String(headers["svix-id"] ?? ""), ts = String(headers["svix-timestamp"] ?? ""), sigs = String(headers["svix-signature"] ?? "");
    if (!id || !ts || !sigs || Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false;
    let key; try { key = unb64(secret.replace(/^whsec_/, "")); } catch { return false; }
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = b64(await crypto.subtle.sign("HMAC", k, enc.encode(`${id}.${ts}.${raw}`)));
    return sigs.split(" ").some((x) => safeEq(x.replace(/^v1,/, ""), mac));
  }
  h() { return { "X-Api-Key": this.cred.apiKey, "X-Tenant": this.cred.tenant, "Content-Type": "application/json", Accept: "application/json" }; }
  async ping() {
    return this.probe(async () => {
      const r = await this.send("POST", ZRExpressApp.BASE + "/territories/search", this.h(), { pageNumber: 1, pageSize: 1 });
      return r.ok ? [true, "المفتاح صالح"] : [null, `ردّ غير متوقع (HTTP ${r.status})`];
    });
  }
  /** كل الأقاليم (ولايات وبلديات) في طلب واحد ثم تُخزَّن في ذاكرة المحوّل: [{id, code, name, level, parentId, home, desk}] */
  /** ذاكرة مشتركة بين الطلبات (ساعة): حدود ZR 200 طلب/دقيقة للمفتاح و600/5 دقائق للعنوان، فلا نعيد جلب الأقاليم وسير العمل مع كل طرد */
  static memo = new Map();
  memoGet(k) { const e = ZRExpressApp.memo.get(`${this.cred.tenant}|${k}`); return e && Date.now() - e.at < 3_600_000 ? e.v : undefined; }
  memoSet(k, v) { if (ZRExpressApp.memo.size > 50) ZRExpressApp.memo.clear(); ZRExpressApp.memo.set(`${this.cred.tenant}|${k}`, { v, at: Date.now() }); return v; }
  async territories() {
    if (this._t) return this._t;
    const hit = this.memoGet("t"); if (hit) return (this._t = hit);
    const rows = [];   // الواجهة تقصّ الصفحة عند 1000 إقليم رغم طلب أكثر: نتصفّح حتى hasNext=false
    for (let page = 1; page <= 15; page++) {
      const j = (await this.send("POST", ZRExpressApp.BASE + "/territories/search", this.h(), { pageNumber: page, pageSize: 250, orderBy: ["code asc"] })).json() ?? {};
      if (Array.isArray(j.items)) rows.push(...j.items);
      if (!j.hasNext || !Array.isArray(j.items) || !j.items.length) break;
      await this.breath(150);
    }
    const list = rows.filter((t) => t && typeof t === "object" && t.id).map((t) => ({ id: String(t.id), code: t.code ?? null, name: String(t.name ?? ""), level: String(t.level ?? "").toLowerCase(),
      parentId: t.parentId ? String(t.parentId) : null, home: (t.delivery ?? t.deliveryCapability ?? {}).hasHomeDelivery !== false }));
    return (this._t = list.length ? this.memoSet("t", list) : list);
  }
  /** «Commande reçue» (OrderReceived) هي حالة ZR الأولى قبل الجاهزية: قيد الانتظار (ثبتت على طرد حقيقي) */
  mapStatus(raw) { return /^(commande recue|order ?received)$/.test(String(raw ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s-]+/g, " ").trim()) ? "pending" : super.mapStatus(raw); }
  isWilaya(t) { return /wilaya|city|province/.test(t.level) || (t.parentId === null && !/commun|district/.test(t.level)); }
  wilayaOf(ts, p) {
    const ws = ts.filter((t) => this.isWilaya(t));
    return ws.find((t) => +t.code === +p.wilayaCode) ?? ws.find((t) => +t.code === +p.legacyWilaya) ?? ws.find((t) => ck(t.name) === ck(p.wilayaName)) ?? null;
  }
  async discover(wilayas, want = {}) {
    const d = Adapter.emptyDiscovery(["ZR Express الجديدة: الأقاليم تُجلب بطلب واحد؛ الطرود غير مقروءة بعد (تجريبي)"]);
    try {
      if (want.communes) { const ts = await this.territories(); for (const w of wilayas) { const wt = ts.find((t) => this.isWilaya(t) && +t.code === +w); if (wt) d.communes[+w] = ts.filter((t) => t.parentId === wt.id).map((t) => ({ name: t.name, id: t.id })); } }
      if (want.desks) {                                                                       // نقاط الاستلام: POST /hubs/search (id من نوع UUID يُرسل hubId)
        const ts = await this.territories(), ws = ts.filter((t) => this.isWilaya(t));
        for (const h of await this.hubs()) {
          const a = h.address ?? {}, t = ts.find((x) => x.id === String(a.cityTerritoryId ?? "")), w = (t && +t.code >= 1 && +t.code <= 58 ? t : ws.find((x) => ck(x.name) === ck(String(a.city ?? ""))));
          const wid = w ? +w.code : 0; if (!(wid >= 1 && wid <= 58) || (wilayas.length && !wilayas.map(Number).includes(wid))) continue;
          (d.desks[wid] ??= []).push({ id: String(h.id), name: String(h.name ?? ""), commune: String(a.district ?? a.city ?? "") });
        }
      }
      if (want.fees) {                                                                        // تعريفة الحساب: GET /delivery-pricing/rates (مستوى الولاية؛ الجزائر 16 تُسعَّر ببلدياتها)
        const j = (await this.send("GET", ZRExpressApp.BASE + "/delivery-pricing/rates", this.h())).json() ?? {}, communes = new Set();
        const px = (r, t) => { const x = (r.deliveryPrices ?? []).find((y) => y && y.deliveryType === t); const v = x ? +(x.discountedPrice ?? x.price) : 0; return Number.isFinite(v) && v > 0 ? v : 0; };
        for (const r of Array.isArray(j.rates) ? j.rates : []) {
          const lv = String(r?.toTerritoryLevel ?? "").toLowerCase();
          if (lv === "commune") { communes.add(px(r, "home") + "/" + px(r, "pickup-point")); continue; }
          if (lv !== "wilaya") continue;
          const id = +r.toTerritoryCode; if (!(id >= 1 && id <= 58)) continue;
          const home = px(r, "home"), stop = px(r, "pickup-point"); if (home || stop) d.fees[id] = { home: home || stop, stop: stop || 0 };
        }
        if (!d.fees[16] && communes.size === 1) { const [h, s] = [...communes][0].split("/").map(Number); if (h || s) d.fees[16] = { home: h || s, stop: s || 0 }; }
      }
    } catch (e) { if (e instanceof ApiError) d.notes.push(e.message); else throw e; }
    return d;
  }
  /** نقاط الاستلام المرئية (Stop Desk): POST /hubs/search بصفحات 100 */
  async hubs() {
    const rows = [];
    for (let page = 1; page <= 10; page++) {
      const j = (await this.send("POST", ZRExpressApp.BASE + "/hubs/search", this.h(), { pageNumber: page, pageSize: 100 })).json() ?? {};
      for (const h of Array.isArray(j.items) ? j.items : []) if (h && h.id && h.isPickupPoint !== false && h.isVisible !== false && h.address) rows.push(h);
      if (!j.hasNext || !Array.isArray(j.items) || !j.items.length) break; await this.breath(150);
    }
    return rows;
  }
  /** بوردرو ZR الأصلي: POST /parcels/labels/individual ← {parcelLabelFiles:[{fileUrl}]} (ملف رسمي بـ4 بطاقات A6 في A4) */
  async labelUrl(trk) {
    const j = (await this.send("POST", ZRExpressApp.BASE + "/parcels/labels/individual", this.h(), { trackingNumbers: [String(trk)] })).json() ?? {};
    const f = Array.isArray(j.parcelLabelFiles) ? j.parcelLabelFiles[0] : null; return httpsOnly(f ? f.fileUrl : null);
  }
  /** معرّف الحالة «جاهز للإرسال» من سير العمل الافتراضي، أو null إن لم يُعثر عليه (يُنشأ الطرد عندئذٍ «استلام الطلب» مع تنبيه) */
  async readyStateId() {
    if (this._rs !== undefined) return this._rs;
    const hit = this.memoGet("rs"); if (hit !== undefined) return (this._rs = hit || null);
    this._rs = null;
    try {
      const r = await this.send("POST", ZRExpressApp.BASE + "/workflows/search", this.h(), { pageNumber: 1, pageSize: 20, onlyDefault: true });
      const wfs = Array.isArray(r.json()?.items) ? r.json().items : [];
      for (const w of wfs) for (const st of Array.isArray(w?.states) ? w.states : []) {
        const t = `${st.name ?? ""} ${st.description ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ");
        if (/ready ?to ?dispatch|pret a (expedier|dispatch|etre)/.test(t)) { this._rs = String(st.id); this.memoSet("rs", this._rs); return this._rs; }
      }
      this.memoSet("rs", "");
    } catch (e) { if (!(e instanceof ApiError)) throw e; }
    return this._rs;
  }
  async create(p) {
    if (p.stopDesk && !p.deskCode) return fail("لم يُحدَّد مكتب Stop Desk لـZR Express — اختر نقطة استلام من قائمتها أو حوّل التوصيل إلى المنزل");
    if (Math.round(p.total) > 150000) return fail("ZR Express تقبل 150,000 دج كحدّ أقصى للطرد (شاملاً التوصيل)");
    const ts = await this.territories();
    if (!ts.length) return fail("تعذّر جلب أقاليم ZR Express (راجع المفتاح ومعرّف الحساب أو أعد المحاولة)");
    const w = this.wilayaOf(ts, p); if (!w) return fail(`ولاية ${p.wilayaName} غير موجودة في قائمة ZR Express`);
    const list = ts.filter((t) => t.parentId === w.id).map((t) => ({ name: t.name, id: t.id }));
    const m = list.length ? this.resolveCommune(list, p, "ZR Express") : { name: p.commune, id: w.id }; if (m.error) return fail(m.error);
    const items = p.productsText(250) || "Produit", price = p.priceWithoutShipping() || Math.round(p.total);
    const body = { customer: { customerId: crypto.randomUUID(), name: p.name, phone: { number1: "+213" + p.localPhone().slice(1), ...(p.phone2 ? { number2: "+213" + p.localPhone(p.phone2).slice(1) } : {}) } },
      deliveryAddress: { cityTerritoryId: w.id, districtTerritoryId: m.id, street: clip(p.address || p.commune, 250) },
      orderedProducts: [{ productName: clip(items, 100), unitPrice: price, quantity: 1, stockType: "none" }], deliveryType: p.stopDesk ? "pickup-point" : "home",
      description: clip(`${items}${p.note ? " — " + p.note : ""}`, 250).padEnd(2, "."), amount: Math.round(p.total), ExternalId: clip(p.orderRef, 100) };
    if (p.stopDesk) body.hubId = p.deskCode;                                       // نقطة الاستلام (UUID من hubs/search)
    let warn = "";
    if ((this.cred.autoDispatch ?? "1") !== "0") { const sid = await this.readyStateId(); if (sid) body.stateId = sid; else warn = "أُنشئ الطرد بحالة «استلام الطلب» — حوّله إلى «جاهز للإرسال» من لوحة ZR ليقبله المركز"; }
    const r = await this.send("POST", ZRExpressApp.BASE + "/parcels", this.h(), body); const j = r.json() ?? {};
    if (r.status === 400 || r.status === 404 || r.status === 409) { const why = (Array.isArray(j.errors) ? j.errors.map((e) => e.description).filter(Boolean).join(" — ") : "") || pick(j, "detail", "title"); return fail(why || "HTTP " + r.status, j); }
    const id = pick(j, "id"); if (!(r.ok && id)) return fail(pick(j, "detail", "title", "message") || "HTTP " + r.status, j);
    let trk = ""; try { trk = pick((await this.send("GET", `${ZRExpressApp.BASE}/parcels/${encodeURIComponent(id)}`, this.h())).json() ?? {}, "trackingNumber"); } catch (e) { if (!(e instanceof ApiError)) throw e; }
    return ok(trk || id, null, j, trk ? warn : (warn ? warn + " — " : "") + "لم يصل رقم التتبع بعد: يُستعمل معرّف الطرد مؤقتاً");
  }
  async track(trk) {
    const r = await this.send("GET", `${ZRExpressApp.BASE}/parcels/${encodeURIComponent(trk)}`, this.h());
    if (r.status === 404) throw new ApiError("لم تجد الشركة هذا الطرد");
    const j = r.json() ?? {}; const st = j.state && typeof j.state === "object" ? j.state : {}, sit = j.situation && typeof j.situation === "object" ? j.situation : {};
    const raw = String(st.description || st.name || "").trim(); if (!raw) throw missing();
    return { tracking: pick(j, "trackingNumber") || trk, rawStatus: raw, status: this.mapStatus(raw), raw: j, note: String(sit.name ?? "") };
  }
  async cancel(trk) {
    const g = await this.send("GET", `${ZRExpressApp.BASE}/parcels/${encodeURIComponent(trk)}`, this.h()); const id = pick(g.json() ?? {}, "id"); if (!g.ok || !id) return false;
    return (await this.send("DELETE", `${ZRExpressApp.BASE}/parcels/${encodeURIComponent(id)}`, this.h())).ok;
  }
  parseWebhook(payload) {
    const evt = String(payload?.eventType ?? "");
    if (evt && !["parcel.state.updated", "parcel.isReturn.updated"].includes(evt)) return [];    // الحالات الفرعية (parcel.state.situation.created) لا تغيّر الحالة
    const d = payload?.data && typeof payload.data === "object" ? payload.data : payload; if (!d || typeof d !== "object") return [];
    const st = d.state && typeof d.state === "object" ? d.state : {}, raw = (String(st.description || st.name || "").trim() + (d.isReturn === true ? " retour" : "")).trim(), trk = pick(d, "trackingNumber");
    return trk && raw ? [{ tracking: trk, rawStatus: raw, status: this.mapStatus(raw), orderRef: pick(d, "externalId") }] : [];
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
  async discover(wilayas, want = {}) {
    const d = Adapter.emptyDiscovery(["Maystro لا تعرض مكاتبها ولا تعريفتها عبر الواجهة العامة"]);
    try { if (want.communes) for (const w of wilayas) { await this.breath(); d.communes[+w] = (await this.communes(+w)).map((c) => ({ name: c.name, id: c.id })); } }
    catch (e) { if (e instanceof ApiError) d.notes.push(e.message); else throw e; }
    return d;
  }
  async create(p) {
    const w = p.legacyWilaya;
    const pc = this.profileCommune(w, p.commune, p.wilayaName); if (pc.block !== null) return fail(pc.block);
    let m;
    if (pc.id !== null) m = { id: pc.id, name: String(pc.name) };           // معرّف البلدية جاهز من ملف المعايرة
    else {
      const list = await this.communes(w);
      if (!list.length) return fail(`تعذّر جلب بلديات ولاية ${w} من Maystro (راجع المفتاح أو أعد المحاولة)`);
      m = this.resolveCommune(list, p, "Maystro"); if (m.error) return fail(m.error);
    }
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
  async discover(wilayas, want = {}) {
    const d = Adapter.emptyDiscovery(["NOEST لا تعرض مكاتبها ولا قائمة طرودها عبر الواجهة العامة"]);
    try {
      if (want.communes) for (const w of wilayas) {
        await this.breath(); const j = await this.getJson(`${Noest.BASE}/get/communes/${+w}`, this.h()); const list = [];
        for (const c of Array.isArray(j) ? j : []) { if (!c || typeof c !== "object" || c.nom === undefined) continue; const on = c.is_active ?? 1; list.push({ name: String(c.nom), deliverable: !(on === 0 || on === false || on === "0") }); }
        d.communes[+w] = list;
      }
      if (want.fees) {                                                                          // تعريفة الحساب: GET /fees ← tarifs.delivery (لا «return»)
        const f = await this.getJson(Noest.BASE + "/fees", this.h());
        for (const [k, r] of Object.entries(f?.tarifs?.delivery ?? {})) {
          if (!r || typeof r !== "object") continue;
          const id = +(r.wilaya_id ?? k), home = +(r.tarif ?? 0) || 0, stop = +(r.tarif_stopdesk ?? 0) || 0;
          if (id >= 1 && id <= 58 && (home > 0 || stop > 0)) d.fees[id] = { home: home > 0 ? home : stop, stop: stop > 0 ? stop : 0 };
        }
      }
    } catch (e) { if (e instanceof ApiError) d.notes.push(e.message); else throw e; }
    return d;
  }
  /** بوردرو NOEST الأصلي: GET get/order/label يحوّل (302) إلى رابط PDF موقَّع قصير العمر؛ المفاتيح تبقى في الخادم. */
  async labelUrl(trk) {
    const q = new URLSearchParams({ api_token: this.cred.apiToken, user_guid: this.cred.userGuid, tracking: trk }).toString();
    const r = await this.send("GET", `${Noest.BASE}/get/order/label?${q}`, this.h()); const loc = String(r.headers?.location ?? "");
    return r.status >= 300 && r.status < 400 ? httpsOnly(loc) : null;
  }
  async create(p) {
    if (p.stopDesk && p.deskCode === "") return fail("NOEST يحتاج رمز مكتب Stop Desk (station_code مثل 16A) — اختر المكتب أو أرسل للمنزل");
    const pc = this.profileCommune(p.legacyWilaya, p.commune, p.wilayaName); if (pc.block !== null) return fail(pc.block);
    let commune = p.commune;
    if (pc.name !== null) commune = String(pc.name);
    else { const list = await this.communes(p.legacyWilaya); if (list.length) { const m = this.resolveCommune(list, p, "NOEST"); if (m.error) return fail(m.error); commune = m.name; } }
    const body = this.auth({ reference: p.orderRef.length < 5 ? "ALY-" + p.orderRef : p.orderRef, client: p.name, phone: p.localPhone(), adresse: p.address ? clip(p.address, 255) : p.commune, wilaya_id: p.legacyWilaya, commune, montant: Math.round(p.total),
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
    if (Array.isArray(a)) for (const ev of [...a].reverse()) {                                  // الردّ الرسمي v2.3: event (نص فرنسي) وقد يغيب event_key
      const e = ev && typeof ev === "object" ? ev : {}, k = pick(e, "event_key"), l = pick(e, "event", "status");
      const KL = { "uploade sur le systeme": "upload", valide: "customer_validation", "colis ramasse": "validation_collect_colis", "reception valide": "validation_reception_admin", "enleve par le livreur": "validation_reception", "en livraison": "fdr_activated",
        "envoye en redispatch": "sent_to_redispatch", suspendu: "colis_suspendu", "tentative de livraison": "mise_a_jour", "retour demande par le partenaire": "return_asked_by_customer", "retour en transit": "return_asked_by_hub", "retour transmis au partenaire": "return_dispatched_to_partenaire",
        "colis retour transmis au partenaire": "colis_retour_transmit_to_partner", "retour recu par le partenaire": "livraison_echoue_recu", "retour valide par le partenaire": "return_validated_by_partener", "retour remis en livraison": "return_redispatched_to_livraison", "retour transmis vers entrepot": "return_dispatched_to_warehouse", livre: "livre", "demande de suppression": "ask_to_delete_by_admin" };
      const c = k || KL[normText(l)] || l; if (c && explain("noest", c)[0] !== "ignore") { raw = c; break; } }
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
  async discover(wilayas, want = {}) {
    const d = Adapter.emptyDiscovery();
    try {
      if (want.communes || want.desks) for (const w of wilayas) {
        await this.breath(); const j = await this.getJson(`${this.base}/api/v1/get/communes?wilaya_id=${+w}`, this.h()); const list = [], desks = [];
        for (const c of Object.values(j)) { if (!c || typeof c !== "object" || c.nom === undefined) continue; list.push({ name: String(c.nom) }); if (c.has_stop_desk && String(c.code_postal ?? "") !== "") desks.push({ id: String(c.code_postal), name: String(c.nom), commune: String(c.nom) }); }
        if (want.communes) d.communes[+w] = list; if (want.desks) d.desks[+w] = desks;
      }
    } catch (e) { if (e instanceof ApiError) d.notes.push(e.message); else throw e; }
    return d;
  }
  async create(p) {
    const pc = this.profileCommune(p.legacyWilaya, p.commune, p.wilayaName); if (pc.block !== null) return fail(pc.block);
    let commune = p.commune;
    if (pc.name !== null) commune = String(pc.name);                        // من ملف المعايرة: بلا طلب إضافي للقائمة
    else { const list = await this.communes(p.legacyWilaya); if (list.length) { const m = this.resolveCommune(list, p, "الشركة"); if (m.error) return fail(m.error); commune = m.name; } }
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
  zrexpress: { label: "ZR Express (Procolis القديمة)", cls: ZRExpress, maturity: "experimental", aliases: ["zr", "procolis"] },
  zrexpress_app: { label: "ZR Express (المنصة الجديدة)", cls: ZRExpressApp, maturity: "experimental", aliases: ["zr2", "zrexpress-app", "zrexpress_new", "zr_app"] },
  maystro: { label: "Maystro Delivery", cls: Maystro, maturity: "experimental" },
  noest: { label: "NOEST Express", cls: Noest, maturity: "experimental" },
  wecan: { label: "WeCan Service", cls: WeCan, maturity: "experimental", aliases: ["wecanservice", "wecan_service", "wecan-service"] },
  ecotrack: E("Ecotrack (منصة عامة)"), dhd: E("DHD Livraison", "https://dhd.ecotrack.dz", true, ["dhd_livraison"]), conexlog: E("Conexlog"), zimou: E("Zimou Express"), hhd: E("HHD Express"),
  anderson: E("Anderson Delivery"), ecom_delivery: E("E-com Delivery"), elogistia: E("Elogistia"), "48h": E("48H Express"),
  mylers: { label: "Mylers", cls: null, maturity: "planned" },
};
/** يفرّغ الذاكرة المشتركة بين الطلبات (للاختبارات). */
export function resetCaches() { ZRExpressApp.memo.clear(); }
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
