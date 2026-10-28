// حماية SSRF: لا نسمح بتحليل عناوين داخلية (localhost، الشبكة الخاصة، بيانات السحابة).
import dns from 'node:dns/promises';
import net from 'node:net';

function ipv4ToInt(ip) { return ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0; }
const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([ip, bits]) => [ipv4ToInt(ip), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) { const n = ipv4ToInt(ip); return BLOCKED_V4.some(([base, mask]) => (n & mask) === (base & mask)); }
  if (net.isIPv6(ip)) {
    const g = expandV6(ip);
    if (!g) return true;
    const v4 = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    if (g.every(x => x === 0) || (g.slice(0, 7).every(x => x === 0) && g[7] === 1)) return true;   // :: و ::1
    if (g.slice(0, 5).every(x => x === 0) && g[5] === 0xffff) return isPrivateIp(v4(g[6], g[7]));   // ::ffff:a.b.c.d
    if (g.slice(0, 6).every(x => x === 0)) return isPrivateIp(v4(g[6], g[7]));                       // ::a.b.c.d
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(x => x === 0)) return isPrivateIp(v4(g[6], g[7])); // NAT64
    if (g[0] === 0x2002) return isPrivateIp(v4(g[1], g[2]));                                         // 6to4
    return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00;  // ULA, link-local, multicast
  }
  return true;
}

function expandV6(ip) {
  let v = ip.toLowerCase().split('%')[0];
  const dotted = v.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) { const n = ipv4ToInt(dotted[1]); v = v.slice(0, -dotted[1].length) + ((n >>> 16).toString(16)) + ':' + ((n & 0xffff).toString(16)); }
  const [head, tail] = v.split('::');
  const h = head ? head.split(':') : [], t = tail === undefined ? [] : tail ? tail.split(':') : [];
  const fill = tail === undefined ? 0 : 8 - h.length - t.length;
  const parts = tail === undefined ? h : [...h, ...Array(Math.max(0, fill)).fill('0'), ...t];
  if (parts.length !== 8) return null;
  const nums = parts.map(x => parseInt(x, 16));
  return nums.some(Number.isNaN) ? null : nums;
}

export class UrlRejected extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export async function validateTarget(raw, {allowPrivate = false, allowedPorts = ['80', '443']} = {}) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new UrlRejected('invalid_url', 'العنوان غير صالح'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new UrlRejected('invalid_protocol', 'يُسمح فقط بـ http و https');
  if (u.username || u.password) throw new UrlRejected('credentials_in_url', 'لا يُسمح بكلمات مرور داخل العنوان');
  if (allowPrivate) return u.href;
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  if (!allowedPorts.includes(port)) throw new UrlRejected('port_not_allowed', `المنفذ ${port} غير مسموح`);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new UrlRejected('private_host', 'العناوين الداخلية غير مسموحة');
  let addrs;
  if (net.isIP(host)) addrs = [host];
  else {
    try { addrs = (await dns.lookup(host, {all: true})).map(a => a.address); }
    catch { throw new UrlRejected('dns_failure', 'تعذّر تحليل اسم النطاق'); }
  }
  if (!addrs.length || addrs.some(isPrivateIp)) throw new UrlRejected('private_host', 'العناوين الداخلية غير مسموحة');
  return u.href;
}
