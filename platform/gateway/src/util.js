export const enc = new TextEncoder();
export const nowStr = (t = Date.now()) => new Date(t).toISOString().slice(0, 19).replace("T", " ");
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const sha256Hex = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
export async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
export const randHex = (nBytes) => hex(crypto.getRandomValues(new Uint8Array(nBytes)));
export function safeEq(a, b) {
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
export const pick = (o, ...keys) => { for (const k of keys) { const v = o && o[k]; if (v !== undefined && v !== null && typeof v !== "object" && String(v) !== "") return String(v); } return ""; };
export function levenshtein(a, b) {
  if (a === b) return 0; const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
/** رابط خارجي آمن لاستدعاء الخادم: https، بلا IP مباشر ولا أسماء داخلية. */
export function safeHttpsUrl(u) {
  try { const p = new URL(u); if (p.protocol !== "https:" || p.username || p.password) return false; const h = p.hostname.toLowerCase();
    if (!h.includes(".") || /^[0-9.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return false; return true; } catch { return false; }
}
