// وسيط منصة API لموقع Supabase: يربط لوحة التاجر بالمنصة دون أن يصل مفتاح الخادم إلى المتصفح.
// آمن: لا يعمل إلا لمدير مسجّل الدخول (is_admin بتوكن جلسته)، ومسارات مسموحة فقط، والمفتاح سرّ في الخادم.
// الأسرار: PLATFORM_URL (https://api.alyssumhub.fyi) و PLATFORM_KEY (pk_live_… لهذا الموقع).
// النشر: functions/deploy?slug=platform-proxy مع إطفاء Verify JWT (الدالة تتحقق بنفسها).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const PF = (Deno.env.get("PLATFORM_URL") ?? "").replace(/\/+$/, "");
const KEY = Deno.env.get("PLATFORM_KEY") ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
// (طريقة، مسار) المسموحة للتاجر. مسارات الإدارة /admin/* وتخزين التكاملات ممنوعة هنا.
const ALLOW: [string, RegExp][] = [
  ["GET", /^\/v1\/carts(\/stats)?$/],
  ["PATCH", /^\/v1\/carts\/\d{1,12}$/],
  ["DELETE", /^\/v1\/carts\/phone\/[0-9+]{8,16}$/],
  ["POST", /^\/v1\/events$/],
  ["PUT", /^\/v1\/catalog\/(products|coupons)$/],
  ["GET", /^\/v1\/(catalog\/products|orders|orders\/stats)$/],
  ["POST", /^\/v1\/fraud\/check$/],
  ["POST", /^\/v1\/payments\/(checkouts|setup)$/],
  ["GET", /^\/v1\/payments\/checkouts\/[A-Za-z0-9._:-]{1,80}$/],
  // الهَب المركزي للمصادر (Shopify/WooCommerce/Google Sheets): الأسرار تُرسل من اللوحة مرة واحدة وتُشفَّر في المنصة
  ["GET", /^\/v1\/sources(\/orders|\/stats)?$/],
  ["PUT", /^\/v1\/sources$/],
  ["POST", /^\/v1\/sources\/\d{1,12}\/(sync|pause)$/],
  ["DELETE", /^\/v1\/sources\/\d{1,12}$/],
  ["POST", /^\/v1\/sources\/orders\/\d{1,12}\/imported$/],
  ["GET", /^\/v1\/ads\/(accounts|spend)$/],
  ["PUT", /^\/v1\/ads\/accounts$/],
  ["POST", /^\/v1\/ads\/accounts\/\d{1,12}\/(sync|pause)$/],
  ["DELETE", /^\/v1\/ads\/accounts\/\d{1,12}$/],
  // ربط Facebook بنقرة واحدة (OAuth): البدء/القائمة/ربط حساب/فصل — الرد من Facebook (callback) يصل المنصة مباشرة بلا وسيط
  ["GET", /^\/v1\/ads\/oauth$/],
  ["POST", /^\/v1\/ads\/oauth\/meta\/start$/],
  ["POST", /^\/v1\/ads\/oauth\/\d{1,12}\/link$/],
  ["DELETE", /^\/v1\/ads\/oauth\/\d{1,12}$/],
  // المحفظة (دفتر القيد المزدوج في المنصة): قراءة الأرصدة والضمان والدفتر، طلب سحب/إلغاؤه، شراء رصيد إعلانات. مسارات /admin/wallet/* ممنوعة هنا
  ["GET", /^\/v1\/wallet(\/ledger|\/escrow|\/withdrawals|\/ads-quote)?$/],
  ["POST", /^\/v1\/wallet\/(withdrawals|ads-topup)$/],
  ["DELETE", /^\/v1\/wallet\/withdrawals\/\d{1,12}$/],
  // خدمات التسويق بعلامة بيضاء: قائمة الخدمات وشراؤها بالمحفظة وطلباتي (رد الوكالة يصل المنصة مباشرة بتوقيع، لا عبر هذا الوسيط)
  ["GET", /^\/v1\/agency\/(services|orders)$/],
  ["GET", /^\/v1\/agency\/orders\/\d{1,12}$/],
  ["POST", /^\/v1\/agency\/orders$/],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!PF || !KEY) return json({ error: "not_configured" }, 503);
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: ANON, Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const method = String(b.method ?? "GET").toUpperCase(), path = String(b.path ?? "");
  const q = b.query && typeof b.query === "object" ? new URLSearchParams(Object.entries(b.query).map(([k, v]) => [k, String(v)])).toString() : "";
  if (!ALLOW.some(([m, re]) => m === method && re.test(path))) return json({ error: "path_not_allowed" }, 400);
  try {
    const h: Record<string, string> = { Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
    if (b.idempotencyKey) h["Idempotency-Key"] = String(b.idempotencyKey).slice(0, 120);
    const r = await fetch(PF + path + (q ? "?" + q : ""), { method, headers: h, body: method === "GET" || method === "DELETE" || b.body == null ? undefined : JSON.stringify(b.body), redirect: "manual", signal: AbortSignal.timeout(30000) });
    let data: unknown = null; const t = (await r.text()).slice(0, 500000); try { data = JSON.parse(t); } catch { data = t; }
    return json({ ok: true, status: r.status, data });
  } catch (e) { return json({ error: "upstream_failed", detail: String(e).slice(0, 120) }, 502); }
});
