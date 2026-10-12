import { enc, b64, unb64 } from "./util.js";
/** خزنة المفاتيح: AES-256-GCM عبر WebCrypto. الظرف JSON {v,kid,iv,ct} (ct يشمل وسم التوثيق). aad يربط النص بسياقه. */
export class Vault {
  constructor(keys, kid) {
    this.keys = keys; this.kid = kid; this.cache = {};
    if (!keys[kid]) throw new Error("مفتاح التشفير الحالي غير موجود");
    for (const [k, v] of Object.entries(keys)) if (v.length !== 32) throw new Error(`المفتاح ${k} ليس 32 بايت`);
  }
  static fromEnv(env) {
    const kid = env.APP_ENCRYPTION_KID || "k1"; const keys = {};
    if (env.APP_ENCRYPTION_KEYS) for (const [id, v] of Object.entries(JSON.parse(env.APP_ENCRYPTION_KEYS))) keys[id] = unb64(v);
    else if (env.APP_ENCRYPTION_KEY) keys.k1 = unb64(env.APP_ENCRYPTION_KEY);
    if (!Object.keys(keys).length) throw new Error("APP_ENCRYPTION_KEY غير مضبوط");
    return new Vault(keys, Object.keys(keys).includes(kid) ? kid : Object.keys(keys)[0]);
  }
  async key(kid) { return this.cache[kid] ??= await crypto.subtle.importKey("raw", this.keys[kid], "AES-GCM", false, ["encrypt", "decrypt"]); }
  async encrypt(data, aad = "") {
    const plain = typeof data === "string" ? data : JSON.stringify(data); const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad), tagLength: 128 }, await this.key(this.kid), enc.encode(plain));
    return JSON.stringify({ v: 1, kid: this.kid, iv: b64(iv), ct: b64(ct) });
  }
  async decrypt(envelope, aad = "") {
    let e; try { e = JSON.parse(envelope); } catch { throw new Error("صيغة مشفَّرة غير صالحة"); }
    if (!e || e.v !== 1 || !e.kid || !e.iv || !e.ct) throw new Error("صيغة مشفَّرة غير صالحة");
    if (!this.keys[e.kid]) throw new Error("مفتاح التشفير " + e.kid + " غير متوفر");
    try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv), additionalData: enc.encode(aad), tagLength: 128 }, await this.key(e.kid), unb64(e.ct))); }
    catch { throw new Error("تعذّر فكّ التشفير (مفتاح خاطئ أو بيانات معدَّلة)"); }
  }
  async decryptJson(envelope, aad = "") { return JSON.parse(await this.decrypt(envelope, aad)); }
}
