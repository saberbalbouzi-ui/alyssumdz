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
/** عنوان IP خاص/محجوز/حلقي/رابط-محلي/metadata (IPv4 وIPv6 بما فيها المُعنوَنة IPv4) */
export function isPrivateIp(ip) {
  const s = String(ip ?? "").trim().toLowerCase();
  const m4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (m4) { const [a, b] = [+m4[1], +m4[2]]; if ([a, b, +m4[3], +m4[4]].some((x) => x > 255)) return true;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && +m4[3] === 0) || (b === 0 && +m4[3] === 2))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && +m4[3] === 100))) || (a === 203 && b === 0 && +m4[3] === 113); }
  if (s.includes(":")) { const v = s.replace(/^\[|\]$/g, ""), mp = /^(?:0{0,4}:){0,5}(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v); if (mp) return isPrivateIp(mp[1]);
    return v === "::" || v === "::1" || /^(fc|fd|fe[89ab])/.test(v) || /^ff/.test(v) || /^2001:(db8|0?:)/.test(v) || /^64:ff9b/.test(v); }
  return true;
}
const WILDCARD_DNS = /(^|\.)(nip\.io|sslip\.io|xip\.io|traefik\.me|localtest\.me|lvh\.me|vcap\.me|lacolhost\.com|localhost\.run)$/;
const BAD_SUFFIX = /(^|\.)(localhost|local|internal|lan|home|corp|intranet|private|arpa|onion)$/;
/** رابط خارجي آمن لاستدعاء الخادم: https على المنفذ الافتراضي، بلا IP مباشر (عشري/سداسي/ثماني) ولا أسماء داخلية ولا خدمات DNS الحرفية. */
export function safeHttpsUrl(u) {
  try { const p = new URL(u); if (p.protocol !== "https:" || p.username || p.password || (p.port && p.port !== "443")) return false; const h = p.hostname.toLowerCase();
    if (h.length > 253 || !h.includes(".") || h.includes(":") || /^[0-9a-fx.]+$/.test(h) || /(^|\.)0x/.test(h) || /\.\d+$/.test(h) || BAD_SUFFIX.test(h) || WILDCARD_DNS.test(h)) return false; return true; } catch { return false; }
}
const dnsMemo = new Map();
/** يتحقق عند الاتصال (لا عند الحفظ فقط) أن اسم المضيف يحلّ إلى عناوين عامة فقط (DoH، ذاكرة 5 دقائق محدودة) ← يغلق DNS rebinding الشائع.
 *  بلا `doh` (دالة fetch) يُعدّ الفحص معطّلاً ويُرجع true. الفشل في الحل = رفض (يُعاد لاحقاً بالتباعد). */
export async function resolvesPublic(host, doh, now = Date.now()) {
  if (!doh) return true; const h = String(host).toLowerCase(), c = dnsMemo.get(h); if (c && now - c.t < 300000) return c.v;
  let v = false;
  try { const out = [];
    for (const type of ["A", "AAAA"]) { const r = await doh(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=${type}`, { headers: { accept: "application/dns-json" } }); if (!r || r.status !== 200) throw new Error("doh"); const j = await r.json(); for (const a of j.Answer ?? []) if (a.type === 1 || a.type === 28) out.push(String(a.data)); }
    v = out.length > 0 && out.every((ip) => !isPrivateIp(ip)); } catch { v = false; }
  if (dnsMemo.size >= 500) dnsMemo.delete(dnsMemo.keys().next().value); dnsMemo.set(h, { t: now, v }); return v;
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

/** إعداد التحقق الصارم لمستأجر (settings.strict). الافتراضي: مطفأ تماماً (السلوك القديم كما هو).
 *  on: تشغيل الحساب الخادمي؛ shadow (افتراضي true): يسجّل القرار المتوقع فقط ولا يرفض أبداً؛ shadow:false = رفض فعلي (يلزم قرار منفصل)؛
 *  pay (افتراضي true): الدفع المسبق ضمن النطاق؛ slugs: منتجات يُفرض عليها النطاق نفسه (فارغة افتراضياً)؛ grace_min: مهلة السعر القديم بعد تغييره (1–60 دقيقة). */
export const strictCfg = (s) => {
  const x = s?.strict; if (!x || x.on !== true) return { on: false, shadow: true, reject: false, pay: false, slugs: [], grace_min: 10 };
  const g = Math.min(60, Math.max(1, Math.round(+x.grace_min) || 10));
  return { on: true, shadow: x.shadow !== false, reject: x.shadow === false, pay: x.pay !== false, slugs: Array.isArray(x.slugs) ? x.slugs.filter((v) => typeof v === "string" && v.length > 0 && v.length <= 80).slice(0, 200) : [], grace_min: g };
};

/** هوية منفّذ الإدارة: بصمة رمز الإدارة (موثوقة) + وسم وصفي من الجهة المُستدعية بعد "/" بعد تنظيفه (لا يحمل # أو / فلا يزوّر البادئة) */
export async function actorOf(token, label) {
  const fp = (await sha256Hex("actor:" + String(token))).slice(0, 8), lb = String(label ?? "").replace(/[^\w.@+ -]/g, "_").trim().slice(0, 60);
  return lb ? `admin#${fp}/${lb}` : `admin#${fp}`;
}
