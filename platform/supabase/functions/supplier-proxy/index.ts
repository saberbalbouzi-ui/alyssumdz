// وسيط بوابة المورّد الخارجي: صفحة saas/supplier.html تكلّم المنصة عبره (المنصة لا تُرجع ترويسات CORS لمفاتيح الخادم).
// لا يحمل أي سرّ: مفتاح المورّد (pk_live_…، محدود النطاق: سوق + محفظة) يصل في الترويسة X-Supplier-Key ويُمرَّر كما هو والمنصة هي التي تتحقق منه.
// مسار التقديم العام /v1/marketplace/apply بلا مفتاح. المسارات مسموحة بقائمة؛ لا /admin ولا غيرها.
// الأسرار: PLATFORM_URL (نفس سرّ platform-proxy). النشر: functions/deploy?slug=supplier-proxy مع إطفاء Verify JWT.
const PF = (Deno.env.get("PLATFORM_URL") ?? "").replace(/\/+$/, "");
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supplier-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ALLOW: [string, RegExp][] = [
  ["GET", /^\/v1\/marketplace\/(products|catalog|imports|orders|wallet|profile|stats)$/],
  ["POST", /^\/v1\/marketplace\/(products|images)$/],
  ["PATCH", /^\/v1\/marketplace\/products\/\d{1,12}$/],
  ["PUT", /^\/v1\/marketplace\/profile$/],
  ["POST", /^\/v1\/marketplace\/orders\/\d{1,12}\/status$/],
  ["GET", /^\/v1\/wallet(\/ledger|\/withdrawals|\/deposits)?$/],
  ["POST", /^\/v1\/wallet\/(withdrawals|deposits)$/],
  ["DELETE", /^\/v1\/wallet\/withdrawals\/\d{1,12}$/],
];
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!PF) return json({ error: "not_configured" }, 503);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const method = String(b.method ?? "GET").toUpperCase(), path = String(b.path ?? "");
  const q = b.query && typeof b.query === "object" ? new URLSearchParams(Object.entries(b.query).map(([k, v]) => [k, String(v)])).toString() : "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (method === "POST" && path === "/v1/marketplace/apply") { /* تقديم عام بلا مفتاح */ }
  else {
    if (!ALLOW.some(([m, re]) => m === method && re.test(path))) return json({ error: "path_not_allowed" }, 400);
    const key = (req.headers.get("x-supplier-key") ?? "").trim();
    if (!/^pk_live_[0-9a-f]{40}$/.test(key)) return json({ error: "unauthorized" }, 401);
    h["Authorization"] = "Bearer " + key; if (b.idempotencyKey) h["Idempotency-Key"] = String(b.idempotencyKey).slice(0, 120);
  }
  try {
    const r = await fetch(PF + path + (q ? "?" + q : ""), { method, headers: h, body: method === "GET" || method === "DELETE" || b.body == null ? undefined : JSON.stringify(b.body), redirect: "manual", signal: AbortSignal.timeout(30000) });
    let data: unknown = null; const t = (await r.text()).slice(0, 500000); try { data = JSON.parse(t); } catch { data = t; }
    return json({ ok: true, status: r.status, data });
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
