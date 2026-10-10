// موزّع المستأجرين: يحدّد موقع الزبون من اسم المضيف (Host) ويقدّم محتواه.
// المرحلة 1: المحتوى من GitHub Pages لمستودع الزبون (source = "gh:owner/repo").
// لا يمسّ هذا الملف أي موقع حالي؛ المضيف غير المعروف يعرض صفحة «غير موجود».
const LOOKUP_TTL = 60_000;          // مدة تخزين نتيجة البحث في الذاكرة
const CONTENT_TTL = 300;            // ثوانٍ (Cache API)
const memo = new Map();             // host -> {t, v}

const page = (title, msg, status) => new Response(
  `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${title}</title><body style="font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#0b1f17;color:#fff;text-align:center">` +
  `<div><h1 style="font-size:22px">${title}</h1><p style="opacity:.8">${msg}</p></div></body></html>`,
  { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export function parseSource(src) {
  const m = /^gh:([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(src || "");
  if (!m) return null;
  const [, owner, repo] = m;
  const root = repo.toLowerCase() === `${owner}.github.io`.toLowerCase();
  return { base: `https://${owner}.github.io`, prefix: root ? "" : `/${repo}` };
}

export function subOf(host, platform) {
  const p = (platform || "").toLowerCase().replace(/^\./, "");
  if (!p) return null;
  const suf = "." + p;
  if (host.endsWith(suf)) { const s = host.slice(0, -suf.length); return s && !s.includes(".") ? s : null; }
  return null;
}

async function lookup(env, host) {
  const hit = memo.get(host);
  if (hit && Date.now() - hit.t < LOOKUP_TTL) return hit.v;
  let v = { known: false, error: true };
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/saas_site_by_host`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_host: host, p_sub: subOf(host, env.PLATFORM_DOMAIN) }),
    });
    if (r.ok) v = await r.json();
  } catch (_) { /* يبقى v خطأً مؤقتاً */ }
  if (!v.error) memo.set(host, { t: Date.now(), v });
  return v;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const host = url.hostname.toLowerCase();
    if (req.method !== "GET" && req.method !== "HEAD") return page("غير مسموح", "هذا الموقع للقراءة فقط.", 405);

    const site = await lookup(env, host);
    if (site.error) return page("خطأ مؤقت", "تعذّر الاتصال بالمنصة، أعد المحاولة بعد قليل.", 503);
    if (!site.known) return page("الموقع غير موجود", "لم يُربط هذا العنوان بأي موقع بعد.", 404);
    if (site.status !== "active") return page("الموقع متوقف مؤقتاً", "صاحب هذا الموقع أوقفه مؤقتاً. حاول لاحقاً.", 503);
    const src = parseSource(site.source);
    if (!src) return page("الموقع قيد الإعداد", "سيكون جاهزاً قريباً.", 503);

    const target = src.base + src.prefix + url.pathname + url.search;
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const key = new Request(target, { method: "GET" });
    if (cache) { const c = await cache.match(key); if (c) return c; }

    const up = await fetch(target, { method: req.method, redirect: "manual", headers: { "user-agent": "alyssum-tenant-router" } });
    // أعد كتابة التحويلات لتبقى داخل مضيف الزبون
    if (up.status >= 300 && up.status < 400) {
      const loc = up.headers.get("location") || "";
      let rel = loc;
      try {
        const u = new URL(loc, target);
        if (u.origin === src.base && u.pathname.startsWith(src.prefix || "/")) rel = u.pathname.slice(src.prefix.length) + u.search + u.hash || "/";
      } catch (_) { /* اتركه كما هو */ }
      return new Response(null, { status: up.status, headers: { location: rel || "/" } });
    }
    const h = new Headers(up.headers);
    h.set("cache-control", `public, max-age=${CONTENT_TTL}`);
    h.set("x-frame-options", "SAMEORIGIN");
    h.delete("set-cookie");
    const res = new Response(up.body, { status: up.status, headers: h });
    if (cache && req.method === "GET" && up.status === 200) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
