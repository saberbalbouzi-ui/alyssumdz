// إدارة محفظة المنصة من لوحة مزوّد المنصة: للمدير فقط (is_saas_admin بتوكن جلسته) ومسارات /admin/wallet/* المسموحة فقط.
// رمز الإدارة PLATFORM_ADMIN_TOKEN سرّ في الخادم لا يصل المتصفح؛ يُرسل اسم الفاعل (بريد المدير) ليُسجَّل في pf_audit.
// الأسرار: PLATFORM_URL و PLATFORM_ADMIN_TOKEN. النشر: functions/deploy?slug=platform-admin مع إطفاء Verify JWT (الدالة تتحقق بنفسها).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const PF = (Deno.env.get("PLATFORM_URL") ?? "").replace(/\/+$/, "");
const TOKEN = Deno.env.get("PLATFORM_ADMIN_TOKEN") ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ALLOW: [string, RegExp][] = [
  ["GET", /^\/admin\/wallet\/(summary|tenants)$/], ["GET", /^\/admin\/wallet\/withdrawals\/list(\?status=[a-z]{4,10})?$/], ["GET", /^\/admin\/wallet\/\d+$/],
  ["PUT", /^\/admin\/wallet\/\d+\/settings$/], ["POST", /^\/admin\/wallet\/\d+\/(deposit|fee|ads-spend)$/],
  ["POST", /^\/admin\/wallet\/withdrawals\/\d+\/(approve|pay|reject)$/],
];
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!PF || !TOKEN) return json({ error: "not_configured" }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_saas_admin`, { method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const method = String(b.method ?? "GET").toUpperCase(), path = String(b.path ?? "");
  if (!ALLOW.some(([m, re]) => m === method && re.test(path))) return json({ error: "path_not_allowed" }, 400);
  let actor = "provider"; try { const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } }); if (u.ok) actor = String((await u.json()).email ?? actor).slice(0, 80); } catch { /* يبقى الاسم العام */ }
  try {
    const r = await fetch(PF + path, { method, headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json", "X-Actor": actor }, body: method === "GET" || b.body == null ? undefined : JSON.stringify(b.body), redirect: "manual", signal: AbortSignal.timeout(30000) });
    let data: unknown = null; const t = (await r.text()).slice(0, 500000); try { data = JSON.parse(t); } catch { data = t; }
    return json({ ok: true, status: r.status, data });
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
