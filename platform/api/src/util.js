export const enc = new TextEncoder();
export const nowStr = (t = Date.now()) => new Date(t).toISOString().slice(0, 19).replace("T", " ");
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha256Hex = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
export async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
export const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
export function safeEq(a, b) { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; }
/** رقم جزائري محمول بصيغته المحلية 0[567]XXXXXXXX أو null */
export function localPhone(p) { let d = String(p ?? "").replace(/\D/g, ""); if (d.startsWith("00213")) d = d.slice(5); else if (d.startsWith("213")) d = d.slice(3); if (d.length === 9) d = "0" + d; return /^0[567]\d{8}$/.test(d) ? d : null; }
export const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** رابط خارجي آمن لاستدعاء الخادم: https، بلا IP مباشر ولا أسماء داخلية. */
export function safeHttpsUrl(u) {
  try { const p = new URL(u); if (p.protocol !== "https:" || p.username || p.password) return false; const h = p.hostname.toLowerCase();
    if (!h.includes(".") || /^[0-9.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return false; return true; } catch { return false; }
}
/** رقم جزائري بصيغة E.164 بلا + (213551234567) أو null */
export function e164(p) { const l = localPhone(p); return l ? "213" + l.slice(1) : null; }
/** تهريب HTML للقوالب النصية (البريد) */
export const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** إخفاء بيانات الزبون عن تطبيقات الأطراف الثالثة التي لا تملك read_customers: الهاتف يبقى آخر رقمين فقط، والاسم أول حرف */
export const maskPhone = (p) => { const d = String(p ?? ""); return d.length > 2 ? "•".repeat(Math.min(8, d.length - 2)) + d.slice(-2) : "••"; };
export const maskName = (n) => { const t = String(n ?? "").trim(); return t ? t[0] + "•••" : ""; };
export const seesPii = (req) => !req.app || req.app.scopes.includes("read_customers");

const PROOF_MAX = 240_000;
/** صورة إثبات الدفع: data URL لصورة jpeg/png/webp بحجم محدود وبصمة ملف صحيحة (لا يُقبل SVG ولا HTML) */
export function parseProof(v) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=]+)$/.exec(String(v ?? "")); if (!m || v.length > PROOF_MAX) return null;
  let head; try { head = atob(m[2].slice(0, 24)); } catch { return null; }
  const ok = m[1] === "jpeg" ? head.startsWith("\xff\xd8\xff") : m[1] === "png" ? head.startsWith("\x89PNG") : head.startsWith("RIFF") && head.slice(8, 12) === "WEBP";
  return ok ? String(v) : null;
}
