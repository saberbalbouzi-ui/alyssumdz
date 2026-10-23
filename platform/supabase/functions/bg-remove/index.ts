// وسيط قصّ الخلفية المتخصص (Matting) للوحة: يحمل مفتاح مزوّد القصّ كسرّ في الخادم فلا يظهر في أي ملف أمامي.
// آمن: لمدير مسجَّل الدخول فقط (is_admin)؛ يقبل PNG/JPEG/WebP بفحص البصمة وبحدّ حجم؛ حدّ معدّل لكل جلسة؛ لا يخزّن الصورة ولا القناع.
// الأسرار (Supabase ← Edge Functions ← Secrets): BG_PROVIDER = removebg | photoroom ، و REMOVEBG_API_KEY أو PHOTOROOM_API_KEY.
// بلا مفتاح تردّ {op:"status"} بـ503 not_configured فتخفي اللوحة هذا المحرّك. النشر: functions/deploy?slug=bg-remove مع إطفاء Verify JWT (الدالة تتحقق بنفسها).
// تنبيه: صيغ واجهات المزوّدين أدناه مكتوبة من وثائقهم المعروفة ولم تُجرَّب بمفتاح حقيقي.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const PROVIDER = (Deno.env.get("BG_PROVIDER") || "removebg").toLowerCase();
const KEY = PROVIDER === "photoroom" ? Deno.env.get("PHOTOROOM_API_KEY") : Deno.env.get("REMOVEBG_API_KEY");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX_BYTES = 10 * 1048576, LIMIT = 20, WINDOW = 60_000;
const hits = new Map<string, number[]>();            // حدّ معدّل لكل جلسة (في ذاكرة النسخة)

function sniff(u: Uint8Array): string | null {
  if (u.length > 12 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "image/png";
  if (u.length > 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "image/jpeg";
  if (u.length > 12 && String.fromCharCode(...u.subarray(0, 4)) === "RIFF" && String.fromCharCode(...u.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}
const fromB64 = (b: string) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < u.length; i++) u[i] = s.charCodeAt(i); return u; };
const toB64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

async function cut(img: Uint8Array, type: string): Promise<Uint8Array> {
  const f = new FormData(); f.append("image_file", new Blob([img], { type }), "in." + type.split("/")[1]);
  let r: Response;
  if (PROVIDER === "photoroom") {
    f.append("format", "png"); f.append("size", "full");
    r = await fetch("https://sdk.photoroom.com/v1/segment", { method: "POST", headers: { "x-api-key": KEY! }, body: f, signal: AbortSignal.timeout(90000) });
  } else {
    f.append("size", "auto"); f.append("format", "png");
    r = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": KEY! }, body: f, signal: AbortSignal.timeout(90000) });
  }
  if (!r.ok) throw new Error("provider_" + r.status);
  const out = new Uint8Array(await r.arrayBuffer()); if (out.length < 100 || sniff(out) !== "image/png") throw new Error("provider_bad_output"); return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!KEY) return json({ error: "not_configured" }, 503);
  if (b.op === "status") return json({ ok: true, provider: PROVIDER });
  if (b.op !== "cut") return json({ error: "bad_op" }, 400);
  const now = Date.now(), arr = (hits.get(auth) || []).filter((t) => now - t < WINDOW);
  if (arr.length >= LIMIT) return json({ error: "rate_limited" }, 429);
  arr.push(now); hits.set(auth, arr);
  if (typeof b.b64 !== "string" || b.b64.length > MAX_BYTES * 1.4) return json({ error: "too_large" }, 413);
  let img: Uint8Array; try { img = fromB64(b.b64); } catch { return json({ error: "bad_b64" }, 400); }
  if (img.length > MAX_BYTES) return json({ error: "too_large" }, 413);
  const type = sniff(img); if (!type) return json({ error: "bad_type" }, 415);
  try { const out = await cut(img, type); return json({ ok: true, type: "image/png", b64: toB64(out) }); }
  catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 80) }, 502); }
});
