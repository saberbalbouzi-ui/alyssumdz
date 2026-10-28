// يُستعمل من الخادم فقط (Route Handlers / Server Actions). لا تستورده في مكوّن عميل،
// حتى لا يظهر مفتاح الخدمة في المتصفح.
import 'server-only';

const BASE = process.env.LIGHTHOUSE_API_URL; // مثال: https://lighthouse.example.com
const KEY = process.env.LIGHTHOUSE_API_KEY;

export type Device = 'mobile' | 'desktop';

function cfg() {
  if (!BASE || !KEY) throw new Error('LIGHTHOUSE_API_URL و LIGHTHOUSE_API_KEY غير مضبوطين');
  return {base: BASE.replace(/\/$/, ''), headers: {'x-api-key': KEY}};
}

export async function startAnalysis(input: {url: string; devices?: Device | 'both'; locale?: string; lang?: 'ar' | 'fr' | 'en'; fresh?: boolean}) {
  const {base, headers} = cfg();
  const r = await fetch(`${base}/v1/analyze`, {
    method: 'POST', cache: 'no-store',
    headers: {...headers, 'content-type': 'application/json'},
    body: JSON.stringify({devices: 'both', locale: 'ar', lang: 'ar', ...input}),
  });
  return {status: r.status, body: await r.json()};
}

export async function getAnalysis(id: string, lang: 'ar' | 'fr' | 'en' = 'ar') {
  const {base, headers} = cfg();
  const r = await fetch(`${base}/v1/analyze/${id}?lang=${lang}`, {headers, cache: 'no-store'});
  return {status: r.status, body: await r.json()};
}

export async function getRawReport(id: string, device: Device) {
  const {base, headers} = cfg();
  return fetch(`${base}/v1/analyze/${id}/lhr/${device}`, {headers, cache: 'no-store'});
}
