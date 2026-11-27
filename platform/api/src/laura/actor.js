/* هوية المستخدم الفعلية (جلسته وصلاحياته) كما تصل للـWorker: الوسيط الموثوق (platform-proxy) يتحقق من جلسة المستخدم ثم يوقّع ادّعاءات قصيرة العمر
   { sub, role, perms[], tid, iat, exp } بـHMAC-SHA256 بسرّ مشترك LAURA_ACTOR_SECRET لا يعرفه المتصفح. الـWorker يرفض أي ادّعاء غير موقَّع/منتهٍ/لمستأجر آخر.
   لا نصّ حرّ ولا قرار من النموذج يدخل هنا: الصلاحيات تأتي من الخادم فقط. */
import { hmacHex, safeEq } from "../util.js";
const te = new TextEncoder(), td = new TextDecoder();
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
export const MAX_TTL = 600;                                          // 10 دقائق كحدّ أقصى لعمر الادّعاء
export async function signActor(secret, claims) {
  const body = b64u(te.encode(JSON.stringify({ v: 1, ...claims }))); return `v1.${body}.${await hmacHex(String(secret), "laura.v1." + body)}`;
}
/** يُرجع { ok:true, claims } أو { ok:false, reason } — لا يرمي */
export async function verifyActor(secret, token, { tenantId, nowS }) {
  try {
    const m = /^v1\.([A-Za-z0-9_-]{8,4096})\.([0-9a-f]{64})$/.exec(String(token ?? "")); if (!m) return { ok: false, reason: "malformed" };
    if (!secret || String(secret).length < 16) return { ok: false, reason: "no_secret" };
    if (!safeEq(await hmacHex(String(secret), "laura.v1." + m[1]), m[2])) return { ok: false, reason: "bad_signature" };
    const c = JSON.parse(td.decode(unb64u(m[1])));
    if (!c || c.v !== 1 || typeof c.sub !== "string" || !c.sub || typeof c.role !== "string" || !Array.isArray(c.perms) || !c.perms.every((p) => typeof p === "string" && p.length <= 40) || c.perms.length > 60) return { ok: false, reason: "bad_claims" };
    if (!Number.isInteger(c.iat) || !Number.isInteger(c.exp) || c.exp - c.iat > MAX_TTL || c.exp <= c.iat) return { ok: false, reason: "bad_ttl" };
    if (nowS > c.exp + 5) return { ok: false, reason: "expired" }; if (c.iat > nowS + 60) return { ok: false, reason: "from_future" };
    if (c.tid !== tenantId) return { ok: false, reason: "tenant_mismatch" };
    return { ok: true, claims: { sub: c.sub.slice(0, 80), role: c.role.slice(0, 30), perms: c.perms, name: typeof c.name === "string" ? c.name.slice(0, 60) : "" } };
  } catch { return { ok: false, reason: "malformed" }; }
}
/** صلاحية لوحة (من admin-roles) — "*" للمالك */
export const hasPerm = (actor, perm) => !perm || actor.perms.includes("*") || actor.perms.includes(perm);
