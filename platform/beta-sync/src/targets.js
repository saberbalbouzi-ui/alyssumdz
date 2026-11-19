/* وجهة المزامنة: واجهة Beta الساكنة في KV (alyssum-beta-web-files) — نفس بنية الإصدارات التي يخدمها platform/env/beta/static-worker.js بلا أي تعديل عليه:
     __ptr/<مكوّن> → معرّف الإصدار الحالي | __m/<مكوّن>/<إصدار> → بيان {مسار: sha256} | o/<sha256> → محتوى ثابت (immutable).
   «التطبيق» = رفع كائنات o/<sha> الجديدة أولاً ثم تعديل البيان (كتابة واحدة لكل مكوّن) فلا يرى القارئ مدخلاً بلا كائن. الحذف = إزالة المدخل من البيان (الكائن يبقى فيُستعاد).
   إصدار جديد من الواجهة (release) يستبدل البيان فتختفي التعديلات؛ التسوية في التشغيل التالي تعيد تطبيقها (انحراف البيان عن sync_items يُكتشف دائماً). */
import { sha256Hex } from "./rules.js";
const enc = new TextEncoder();

export class KVTarget {
  /** kv: KV binding | واجهة مماثلة؛ web: { fetch(Request) } (service binding على alyssum-beta-web أو fetch عام) + base لعنوان الواجهة */
  constructor({ kv, web, base = "https://alyssum-beta-web.example", sleep = (ms) => new Promise((r) => setTimeout(r, ms)), verifyTries = 4 }) { this.kv = kv; this.web = web; this.base = base.replace(/\/$/, ""); this.sleep = sleep; this.tries = verifyTries; }
  async manifest(comp) {
    const rel = await this.kv.get("__ptr/" + comp); if (!rel) return { rel: null, map: null };
    const t = await this.kv.get(`__m/${comp}/${rel}`); return { rel, map: t ? JSON.parse(t) : null };
  }
  async setManifest(comp, rel, map) { await this.kv.put(`__m/${comp}/${rel}`, JSON.stringify(map)); }
  async hasObject(sha) { const r = await this.kv.getWithMetadata("o/" + sha, { type: "stream" }); try { await r.value?.cancel?.(); } catch { } return !!r.value; }
  async putObject(sha, bytes) { if (await this.hasObject(sha)) return false; await this.kv.put("o/" + sha, bytes); return true; }
  /** التحقق الفعلي: الواجهة الحيّة تُرجع البايتات المتوقعة (إعادة محاولة: ذاكرة الـWorker الساكن 5ث) */
  async verify(path, sha) {
    let last = "";
    for (let i = 0; i < this.tries; i++) {
      try {
        const r = await this.web.fetch(new Request(`${this.base}/${path.split("/").map(encodeURIComponent).join("/")}?_sync=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }));
        if (r.status === 200) { const h = await sha256Hex(await r.arrayBuffer()); if (h === sha) return { ok: true }; last = "hash مختلف"; } else last = "HTTP " + r.status;
      } catch (e) { last = String(e.message ?? e).slice(0, 80); }
      if (i < this.tries - 1) await this.sleep(2500);
    }
    return { ok: false, why: last };
  }
  /** غياب فعلي بعد الحذف (404) */
  async verifyGone(path) { for (let i = 0; i < this.tries; i++) { try { const r = await this.web.fetch(new Request(`${this.base}/${path.split("/").map(encodeURIComponent).join("/")}?_sync=${Date.now()}`)); if (r.status === 404) return { ok: true }; } catch { } if (i < this.tries - 1) await this.sleep(2500); } return { ok: false, why: "ما زال يُخدَّم" }; }
}

/** KV عبر REST (CLI والاختبارات الحيّة): يفرض حساب Beta وفضاء الأسماء المسمّى لـBeta فقط */
export class RestKV {
  constructor({ acc, nsId, token = null, fetchFn = fetch, productionAccounts = ["1dffae72b40ca6558da19b84eff8c864"] }) {
    if (!/^[0-9a-f]{32}$/.test(acc) || productionAccounts.includes(acc)) throw new Error("guard: حساب غير صالح/Production"); if (!/^[0-9a-f]{32}$/.test(nsId)) throw new Error("guard: معرّف KV غير صالح");
    this.b = `https://api.cloudflare.com/client/v4/accounts/${acc}/storage/kv/namespaces/${nsId}`; this.t = token; this.f = fetchFn;
  }
  get h() { return this.t ? { Authorization: "Bearer " + this.t } : {}; }
  async get(key, type = "text") { const r = await this.f(`${this.b}/values/${encodeURIComponent(key)}`, { headers: this.h }); if (r.status === 404) return null; if (r.status !== 200) throw new Error(`kv get ${key} → ${r.status}`); return type === "arrayBuffer" ? r.arrayBuffer() : r.text(); }
  async getWithMetadata(key) { const r = await this.f(`${this.b}/values/${encodeURIComponent(key)}`, { headers: this.h }); if (r.status === 404) return { value: null }; if (r.status !== 200) throw new Error(`kv has ${key} → ${r.status}`); try { await r.body?.cancel?.(); } catch { } return { value: { cancel() { } } }; }
  async put(key, value) { const r = await this.f(`${this.b}/values/${encodeURIComponent(key)}`, { method: "PUT", headers: { ...this.h, "Content-Type": "application/octet-stream" }, body: typeof value === "string" ? enc.encode(value) : value }); if (r.status !== 200) throw new Error(`kv put ${key} → ${r.status} ${(await r.text()).slice(0, 120)}`); }
}
