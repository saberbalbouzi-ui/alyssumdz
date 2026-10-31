// موزّع المستأجرين: يحدّد موقع الزبون من اسم المضيف (Host) ويقدّم محتواه.
// المصادر: gh:owner/repo ← GitHub Pages لمستودع الزبون (المرحلة 1)،
//          sb:<معرّف> ← مخزن مركزي في Supabase Storage (حاوية tenants العامة، المرحلة 4) فلا مستودع ولا CNAME لكل زبون.
// لا يمسّ هذا الملف أي موقع حالي؛ المضيف غير المعروف يعرض صفحة «غير موجود».
const LOOKUP_TTL = 60_000;          // مدة تخزين نتيجة البحث في الذاكرة
const CONTENT_TTL = 300;            // ثوانٍ (Cache API)
const memo = new Map();             // host -> {t, v} — LRU محدود الحجم (E-03): الأقدم استعمالاً يُزال عند بلوغ MEMO_MAX
const MEMO_MAX = 500, UNKNOWN_TTL = 10_000, HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const page = (title, msg, status) => new Response(
  `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${title}</title><body style="font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#0b1f17;color:#fff;text-align:center">` +
  `<div><h1 style="font-size:22px">${title}</h1><p style="opacity:.8">${msg}</p></div></body></html>`,
  { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

const TYPES = { html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", webmanifest: "application/manifest+json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", ico: "image/x-icon", avif: "image/avif", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", zip: "application/zip" };

// يحوّل مسار الطلب إلى مسار ملف داخل المخزن (المجلد ← index.html)؛ null للمسارات الخطرة.
export function storePath(pathname) {
  let p; try { p = decodeURIComponent(pathname); } catch (_) { return null; }
  if (p.includes("\\") || p.includes("\0") || p.split("/").some(s => s === "..")) return null;
  if (p.endsWith("/")) p += "index.html";
  return p.replace(/^\/+/, "");
}
export const typeOf = path => TYPES[(path.split(".").pop() || "").toLowerCase()] || "application/octet-stream";

export function parseSource(src) {
  const sb = /^sb:([A-Za-z0-9._-]{1,64})$/.exec(src || "");
  if (sb) return { sb: sb[1] };
  const m = /^gh:([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(src || "");
  if (!m) return null;
  const [, owner, repo] = m;
  const root = repo.toLowerCase() === `${owner}.github.io`.toLowerCase();
  return { base: `https://${owner}.github.io`, prefix: root ? "" : `/${repo}` };
}

// PLATFORM_DOMAIN يقبل دومينًا واحدًا أو عدة دومينات مفصولة بفواصل (للانتقال من دومين منصة إلى آخر دون انقطاع).
export const _memoSize = () => memo.size, _lookup = (env, host) => lookup(env, host);
export function subOf(host, platform) {
  for (const raw of String(platform || "").split(",")) {
    const p = raw.trim().toLowerCase().replace(/^\./, "");
    if (!p) continue;
    const suf = "." + p;
    if (host.endsWith(suf)) { const s = host.slice(0, -suf.length); return s && !s.includes(".") ? s : null; }
  }
  return null;
}

async function lookup(env, host) {
  if (host.length > 253 || !HOST_RE.test(host)) return { known: false };      // صيغة مضيف غير صالحة: لا استعلام ولا تخزين
  const hit = memo.get(host);
  if (hit && Date.now() - hit.t < (hit.v && hit.v.known ? LOOKUP_TTL : UNKNOWN_TTL)) { memo.delete(host); memo.set(host, hit); return hit.v; }      // إعادة إدراج = الأحدث استعمالاً
  let v = { known: false, error: true };
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/saas_site_by_host`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_host: host, p_sub: subOf(host, env.PLATFORM_DOMAIN) }),
    });
    if (r.ok) v = await r.json();
  } catch (_) { /* يبقى v خطأً مؤقتاً */ }
  if (!v.error) { memo.delete(host); memo.set(host, { t: Date.now(), v }); while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value); }
  return v;
}

// المخزن المركزي: https://<مشروع>.supabase.co/storage/v1/object/public/tenants/<معرّف>/<مسار>
async function serveStore(req, env, ctx, id, url) {
  const path = storePath(url.pathname);
  if (path === null) return page("طلب غير صالح", "المسار غير مسموح.", 400);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const tryGet = async rel => {
    const target = `${env.SUPABASE_URL}/storage/v1/object/public/tenants/${id}/${rel.split("/").map(encodeURIComponent).join("/")}`;
    const key = new Request(target, { method: "GET" });
    if (cache) { const c = await cache.match(key); if (c) return c; }
    const up = await fetch(target, { headers: { "user-agent": "alyssum-tenant-router" } });
    if (up.status !== 200) return null;
    const h = new Headers();
    h.set("content-type", typeOf(rel));                     // Supabase يقدّم HTML كنص عادي، فنضبط النوع بالامتداد
    h.set("cache-control", `public, max-age=${CONTENT_TTL}`);
    h.set("x-content-type-options", "nosniff");
    h.set("x-frame-options", "SAMEORIGIN");
    const res = new Response(up.body, { status: 200, headers: h });
    if (cache) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  };
  let res = await tryGet(path);
  if (!res && !path.endsWith("index.html") && !/\.[A-Za-z0-9]{1,8}$/.test(path)) res = await tryGet(path + "/index.html");   // /shop ← /shop/index.html
  if (!res) {
    const nf = await tryGet("404.html");
    return nf ? new Response(await nf.text(), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }) : page("الصفحة غير موجودة", "تأكد من الرابط.", 404);
  }
  return req.method === "HEAD" ? new Response(null, { status: 200, headers: res.headers }) : res;
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

    if (src.sb) return serveStore(req, env, ctx, src.sb, url);

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
