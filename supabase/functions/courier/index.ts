// وسيط شركات التوصيل لموقع GitHub+Supabase: يتجاوز حجب المتصفح (CORS) لطلبات ياليدين.
// آمن: لا يعمل إلا لمدير مسجّل الدخول (يتحقق من دالة is_admin بتوكن جلسته)، وhttps فقط، ولمضيفين مسموحين فقط.
// النشر من لوحة Supabase: Edge Functions ← Deploy a new function ← الاسم: courier ← الصق هذا الكود ← Deploy (اترك Verify JWT مفعّلاً).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const HOSTS = (Deno.env.get("COURIER_HOSTS") ?? "api.yalidine.app,yalidine.app").split(",").map((s) => s.trim()).filter(Boolean);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: ANON, Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let u: URL; try { u = new URL(String(b.url ?? "")); } catch { return json({ error: "bad_url" }, 400); }
  if (u.protocol !== "https:" || !HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) return json({ error: "host_not_allowed" }, 400);
  const method = String(b.method ?? "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) return json({ error: "method" }, 400);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries((b.headers ?? {}) as Record<string, unknown>)) if (/^[A-Za-z0-9-]{1,40}$/.test(k) && !/[\r\n]/.test(String(v))) headers[k] = String(v);
  try {
    const r = await fetch(u.toString(), { method, headers, body: method === "GET" || method === "DELETE" ? undefined : (b.body == null ? undefined : String(b.body)), redirect: "manual", signal: AbortSignal.timeout(25000) });
    return json({ ok: true, status: r.status, body: (await r.text()).slice(0, 200000) });
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
