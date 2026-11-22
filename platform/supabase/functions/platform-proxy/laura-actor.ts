// هوية LAURA الموقَّعة للوسيط: يحوّل جلسة المستخدم (staff_me) إلى ادّعاءات قصيرة العمر يوقّعها HMAC-SHA256 بسرّ LAURA_ACTOR_SECRET المشترك مع الـWorker.
// الصيغة مطابقة لـplatform/api/src/laura/actor.js: v1.<base64url(JSON)>.<hex(HMAC("laura.v1."+body))> — يحرسها اختبار التوافق laura-proxy.test.mjs.
// الصلاحيات تأتي من الخادم فقط: المالك = ["*"]؛ الموظف = perms من جدول staff؛ بلا دور = لا هوية (لا وصول).
export const LAURA_ALLOW: [string, RegExp][] = [
  ["POST", /^\/v1\/laura\/(chat|confirm|reset)$/],
  ["GET", /^\/v1\/laura\/(tools|health|history)$/],
];
export const isLauraPath = (method: string, path: string) => LAURA_ALLOW.some(([m, re]) => m === method && re.test(path));
const te = new TextEncoder();
const b64u = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmacHex(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, te.encode(msg)));
}
export type StaffMe = { owner?: boolean; role?: string | null; name?: string; email?: string; perms?: string[] };
export type Claims = { sub: string; role: string; perms: string[]; tid: number; iat: number; exp: number; name?: string };
/** يبني ادّعاءات الهوية من ردّ staff_me؛ null = لا وصول (بلا دور). TTL افتراضي 5 دقائق (الـWorker يرفض > 10). */
export function claimsFromStaffMe(me: StaffMe | null, tid: number, nowS: number, ttl = 300): Claims | null {
  if (!me || !Number.isInteger(tid) || tid <= 0) return null;
  const email = String(me.email ?? "").toLowerCase().slice(0, 80); if (!email) return null;
  if (me.owner === true) return { sub: email, role: "owner", perms: ["*"], tid, iat: nowS, exp: nowS + ttl, name: String(me.name ?? "").slice(0, 60) };
  if (!me.role) return null;
  const perms = Array.isArray(me.perms) ? me.perms.filter((p) => typeof p === "string" && /^[a-z.]{1,40}$/.test(p)).slice(0, 60) : [];
  return { sub: email, role: String(me.role).slice(0, 30), perms, tid, iat: nowS, exp: nowS + ttl, name: String(me.name ?? "").slice(0, 60) };
}
export async function signActor(secret: string, claims: Claims) {
  const body = b64u(te.encode(JSON.stringify({ v: 1, ...claims })));
  return `v1.${body}.${await hmacHex(secret, "laura.v1." + body)}`;
}
