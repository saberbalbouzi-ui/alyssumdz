// وسيط Pixabay للمنصة: مفتاح Pixabay سرّ في الخادم (PIXABAY_KEY) فلا يحتاج التاجر مفتاحاً، والتنزيل يمرّ بالوسيط فلا يحجبه CORS.
// آمن: لمدير مسجَّل الدخول فقط (is_admin بتوكن جلسته)، والتنزيل مقصور على نطاقات Pixabay وبحدّ حجم، والبحث يُخزَّن 24 ساعة (شرط Pixabay).
// النشر: functions/deploy?slug=pixabay-proxy مع إطفاء Verify JWT (الدالة تتحقق بنفسها). السرّ: PIXABAY_KEY (مفتاح مجاني من pixabay.com/api/docs).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KEY = Deno.env.get("PIXABAY_KEY") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";   // يحقنها Supabase في الدالة؛ لكاش البحث المركزي (جدول pixabay_cache) فقط
const TTL = 24 * 3600 * 1000;                                  // شرط Pixabay: تخزين نتائج البحث 24 ساعة
const MEM = new Map<string, { body: string; exp: number }>();  // طبقة ذاكرة داخل النسخة الحيّة للدالة
const sbh = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };
async function sha(t: string) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function cacheGet(k: string): Promise<string | null> {
  const m = MEM.get(k); if (m && m.exp > Date.now()) return m.body;
  if (!SRK) return null;
  try {
    const r = await fetch(`${URL_}/rest/v1/pixabay_cache?k=eq.${k}&exp=gt.${encodeURIComponent(new Date().toISOString())}&select=body`, { headers: sbh, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null; const a = await r.json(); if (!a[0]) return null;
    MEM.set(k, { body: a[0].body, exp: Date.now() + 3600000 }); return a[0].body;
  } catch { return null; }
}
async function cachePut(k: string, body: string) {
  MEM.set(k, { body, exp: Date.now() + TTL }); if (MEM.size > 300) MEM.delete(MEM.keys().next().value as string);
  if (!SRK) return;
  try {
    await fetch(`${URL_}/rest/v1/pixabay_cache?on_conflict=k`, { method: "POST", headers: { ...sbh, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k, body, exp: new Date(Date.now() + TTL).toISOString() }), signal: AbortSignal.timeout(4000) });
    if (Math.random() < 0.02) await fetch(`${URL_}/rest/v1/pixabay_cache?exp=lt.${encodeURIComponent(new Date().toISOString())}`, { method: "DELETE", headers: sbh, signal: AbortSignal.timeout(4000) });   // تنظيف انتهازي
  } catch { /* الكاش اختياري */ }
}
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX = 14 * 1048576;                       // أكبر ملف يُنزَّل (فيديو مضغوط/صورة كبيرة)
const HOST = /^(?:[a-z0-9-]+\.)?pixabay\.com$/i; // pixabay.com وcdn.pixabay.com وما شابه
const PARAMS = new Set(["q", "lang", "id", "image_type", "video_type", "orientation", "category", "min_width", "min_height", "colors", "editors_choice", "safesearch", "order", "page", "per_page"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!KEY) return json({ error: "not_configured" }, 503);
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: ANON, Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  try {
    if (b.op === "search") {
      const kind = b.kind === "videos" ? "videos/" : "";
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(b.query ?? {})) if (PARAMS.has(k)) p.set(k, String(v).slice(0, 100));
      p.set("per_page", String(Math.min(60, Number(p.get("per_page")) || 30)));
      p.sort(); const ck = await sha(kind + p.toString()), hit = await cacheGet(ck);
      if (hit) return new Response(hit, { status: 200, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "private, max-age=3600", "X-Cache": "HIT" } });
      const r = await fetch(`https://pixabay.com/api/${kind}?key=${encodeURIComponent(KEY)}&${p}`, { signal: AbortSignal.timeout(20000) });
      if (r.status === 429) return json({ error: "rate_limited" }, 429);
      if (!r.ok) return json({ error: "upstream", status: r.status }, 502);
      const txt = await r.text(); await cachePut(ck, txt);
      return new Response(txt, { status: 200, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "private, max-age=3600", "X-Cache": "MISS" } });
    }
    if (b.op === "dl") {
      let u: URL; try { u = new URL(String(b.url)); } catch { return json({ error: "bad_url" }, 400); }
      if (u.protocol !== "https:" || !HOST.test(u.hostname)) return json({ error: "host_not_allowed" }, 400);
      const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(45000) });
      if (!r.ok) return json({ error: "upstream", status: r.status }, 502);
      if (!HOST.test(new URL(r.url).hostname)) return json({ error: "host_not_allowed" }, 400);   // لا نتبع تحويلاً خارج Pixabay
      const len = Number(r.headers.get("content-length") ?? 0);
      if (len > MAX) return json({ error: "too_large" }, 413);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.byteLength > MAX) return json({ error: "too_large" }, 413);
      return new Response(buf, { status: 200, headers: { ...CORS, "Content-Type": r.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
    }
    return json({ error: "bad_op" }, 400);
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
