// إدارة بوابة الشحن من لوحة مزوّد المنصة: للمدير فقط (is_saas_admin بتوكن جلسته)، ومسارات /admin/* المسموحة فقط.
// رمز الإدارة ADMIN_TOKEN سرّ في الخادم لا يصل المتصفح؛ يُرسل اسم الفاعل (بريد المدير) ليُسجَّل في سجلّ التدقيق.
// الأسرار: GATEWAY_URL و GATEWAY_ADMIN_TOKEN. النشر: functions/deploy?slug=ship-admin مع إطفاء Verify JWT (الدالة تتحقق بنفسها).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const GW = (Deno.env.get("GATEWAY_URL") ?? "").replace(/\/+$/, "");
const TOKEN = Deno.env.get("GATEWAY_ADMIN_TOKEN") ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ALLOW: [string, RegExp][] = [
  ["GET", /^\/admin\/(summary|tenants|plans|usage|audit)$/],
  ["POST", /^\/admin\/tenants$/], ["POST", /^\/admin\/tenants\/\d+\/keys$/],
  ["PATCH", /^\/admin\/tenants\/\d+$/], ["PUT", /^\/admin\/plans\/[a-z0-9_-]{2,20}$/], ["DELETE", /^\/admin\/keys\/\d+$/],
];
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GW || !TOKEN) return json({ error: "not_configured" }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_saas_admin`, { method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const method = String(b.method ?? "GET").toUpperCase(), path = String(b.path ?? "");
  if (!ALLOW.some(([m, re]) => m === method && re.test(path))) return json({ error: "path_not_allowed" }, 400);
  let actor = "provider"; try { const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } }); if (u.ok) actor = String((await u.json()).email ?? actor).slice(0, 80); } catch { /* يبقى الاسم العام */ }
  try {
    const r = await fetch(GW + path, { method, headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json", "X-Actor": actor }, body: method === "GET" || method === "DELETE" || b.body == null ? undefined : JSON.stringify(b.body), redirect: "manual", signal: AbortSignal.timeout(30000) });
    let data: unknown = null; const t = (await r.text()).slice(0, 500000); try { data = JSON.parse(t); } catch { data = t; }
    return json({ ok: true, status: r.status, data });
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
