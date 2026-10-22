// وسيط جلب صفحات المنتجات للوحة (منشئ الصفحات بالذكاء): يجلب HTML أو صورة من الخادم فلا يحجبه CORS ولا حماية «منع الوسطاء».
// آمن: لمدير مسجَّل الدخول فقط (is_admin)، http/https على منفذ افتراضي فقط، يرفض العناوين الداخلية/الخاصة (SSRF) ويعيد فحص كل تحويل، بحدّ حجم ومهلة.
// النشر: functions/deploy?slug=page-fetch مع إطفاء Verify JWT (الدالة تتحقق بنفسها). بلا أسرار.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX_HTML = 3 * 1048576, MAX_IMG = 8 * 1048576;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function privateHost(h: string): boolean {
  h = h.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  if (h.includes(":")) return true;                                    // IPv6 حرفي: مرفوض
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) { const [a, b] = [+m[1], +m[2]]; return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127); }
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true;                  // عناوين رقمية ملتبسة
  return !h.includes(".");
}
async function guardedFetch(start: string, accept: string): Promise<Response> {
  let u = new URL(start);
  for (let i = 0; i < 5; i++) {
    if (!/^https?:$/.test(u.protocol) || (u.port && u.port !== "80" && u.port !== "443") || u.username || u.password || privateHost(u.hostname)) throw new Error("host_not_allowed");
    const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "ar,fr;q=0.8,en;q=0.7" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { u = new URL(r.headers.get("location")!, u); continue; }
    return r;
  }
  throw new Error("too_many_redirects");
}
async function readCapped(r: Response, max: number): Promise<Uint8Array | null> {
  const reader = r.body?.getReader(); if (!reader) return new Uint8Array(0);
  const parts: Uint8Array[] = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.byteLength; if (n > max) { try { await reader.cancel(); } catch { /* */ } return null; } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.byteLength; } return out;
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: ANON, Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let url: string; try { url = new URL(String(b.url)).href; } catch { return json({ error: "bad_url" }, 400); }
  try {
    if (b.op === "html") {
      const r = await guardedFetch(url, "text/html,application/xhtml+xml,*/*;q=0.8");
      if (!r.ok) return json({ error: "upstream", status: r.status }, 502);
      const buf = await readCapped(r, MAX_HTML); if (!buf) return json({ error: "too_large" }, 413);
      return json({ ok: true, url: r.url || url, html: new TextDecoder("utf-8", { fatal: false }).decode(buf) });
    }
    if (b.op === "img") {
      const r = await guardedFetch(url, "image/avif,image/webp,image/*,*/*;q=0.8");
      if (!r.ok) return json({ error: "upstream", status: r.status }, 502);
      const ct = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(ct)) return json({ error: "not_image" }, 415);
      const buf = await readCapped(r, MAX_IMG); if (!buf) return json({ error: "too_large" }, 413);
      return json({ ok: true, type: ct, b64: b64(buf) });
    }
    return json({ error: "bad_op" }, 400);
  } catch (e) { return json({ error: String(e).includes("host_not_allowed") ? "host_not_allowed" : "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
