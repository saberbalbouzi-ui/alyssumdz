// وسيط بوابة الشحن لموقع Supabase: يربط لوحة التاجر بخدمة الشحن دون أن يصل مفتاح الخدمة إلى المتصفح.
// آمن: لا يعمل إلا لمدير مسجّل الدخول (is_admin بتوكن جلسته)، ومسارات مسموحة فقط، والمفتاح سرّ في الخادم.
// الأسرار: GATEWAY_URL (مثال https://shipping.alyssumhub.fyi) و GATEWAY_KEY (gk_live_… لهذا الموقع).
// النشر: functions/deploy?slug=ship-gateway مع إطفاء Verify JWT (الدالة تتحقق بنفسها).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const GW = (Deno.env.get("GATEWAY_URL") ?? "").replace(/\/+$/, "");
const KEY = Deno.env.get("GATEWAY_KEY") ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
// (طريقة، مسار) المسموحة للتاجر. مسارات الإدارة /admin/* ممنوعة هنا دائماً.
const ALLOW: [string, RegExp][] = [
  ["GET", /^\/v1\/(couriers|wilayas|communes|usage|orders|connections|webhook)(\/[A-Za-z0-9._-]{1,64})?$/],
  ["POST", /^\/v1\/(orders|validate|track|cancel|label|desks|connections)$/],
  ["DELETE", /^\/v1\/connections\/[a-z0-9_]{2,30}$/],
  ["PUT", /^\/v1\/webhook$/],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GW || !KEY) return json({ error: "not_configured" }, 503);
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: ANON, Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const method = String(b.method ?? "GET").toUpperCase(), path = String(b.path ?? "");
  const q = b.query && typeof b.query === "object" ? new URLSearchParams(Object.entries(b.query).map(([k, v]) => [k, String(v)])).toString() : "";
  if (!ALLOW.some(([m, re]) => m === method && re.test(path))) return json({ error: "path_not_allowed" }, 400);
  try {
    const r = await fetch(GW + path + (q ? "?" + q : ""), { method, headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: method === "GET" || method === "DELETE" || b.body == null ? undefined : JSON.stringify(b.body), redirect: "manual", signal: AbortSignal.timeout(30000) });
    let data: unknown = null; const t = (await r.text()).slice(0, 500000); try { data = JSON.parse(t); } catch { data = t; }
    return json({ ok: true, status: r.status, data });
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
