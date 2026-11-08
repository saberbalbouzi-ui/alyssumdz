// وسيط الفيديو/المجسّمات (v1.89.900): المزوّد يوفّر المفتاح (سرّ FAL_KEY) والزبون يشتري الرصيد (kind=video في saas_ai_charge، platform/sql/ai-video.sql).
// الطلب: POST {token | jwt, action:"submit", model, body} ← يرسل إلى طابور الخدمة ويخصم وحدة رصيد (تُردّ عند الفشل)
//        POST {token | jwt, action:"get", url}            ← قراءة الحالة/النتيجة (روابط الطابور فقط، بلا خصم)
// المدير بجلسته (jwt) لا يُخصم منه. النشر: supabase functions deploy ai-video --no-verify-jwt ، والسرّ: supabase secrets set FAL_KEY=<معرّف:سرّ>
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FKEY = (Deno.env.get("FAL_KEY") ?? "").replace(/\s+/g, "");
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  return r.ok ? await r.json().catch(() => null) : null;
};
async function adminOf(jwt: string): Promise<string> {
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(jwt) || jwt.length > 4000) return "";
  try {
    const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: SRK, Authorization: `Bearer ${jwt}` } });
    if (!u.ok) return "";
    const me = await u.json(), em = String(me?.email ?? "").toLowerCase(); if (!em || !me?.email_confirmed_at) return "";
    const a = await fetch(`${URL_}/rest/v1/admins?select=email`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
    const rows = a.ok ? await a.json() : [];
    return Array.isArray(rows) && rows.some((r: any) => String(r.email ?? "").toLowerCase() === em) ? em : "";
  } catch { return ""; }
}
const MSG: Record<string, string> = {
  rate_limited: "طلبات كثيرة في وقت قصير — انتظر قليلاً", unknown_token: "توكن الموقع غير صالح", suspended: "الخدمة موقوفة لهذا الموقع — تواصل مع المزوّد",
  expired: "انتهت صلاحية اشتراكك — فعّله لمتابعة الاستعمال", no_credits: "انتهى رصيد الفيديو — اشترِ رصيداً إضافياً لمتابعة الاستعمال",
};
const hits = new Map<string, number[]>();
function limited(k: string): boolean {
  const now = Date.now(), a = (hits.get(k) ?? []).filter((t) => now - t < 60_000);
  if (a.length >= 6) { hits.set(k, a); return true; }
  a.push(now); hits.set(k, a); if (hits.size > 2000) hits.delete(hits.keys().next().value as string); return false;
}
// نماذج مسموحة فقط (فيديو ومجسّمات) وروابط الطابور فقط: لا تحويل لأي خدمة أخرى
const MODEL_OK = /^fal-ai\/[a-z0-9][a-z0-9._\-\/]{2,120}$/;
const QUEUE_OK = /^https:\/\/queue\.fal\.run\/fal-ai\/[a-z0-9._\-\/]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!FKEY) return json({ error: "not_configured", message: "خدمة الفيديو غير مفعّلة بعد في الخادم — تواصل مع المزوّد" }, 503);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let token = String(b.token ?? ""); const jwt = String(b.jwt ?? ""), action = String(b.action ?? "");
  let admin = "";
  if (!token && jwt) { admin = await adminOf(jwt); if (!admin) return json({ error: "unauthorized", message: "انتهت جلسة الدخول — أعد تسجيل الدخول" }, 401); token = "admin:" + admin; }
  if (!admin && !/^[a-f0-9]{32,80}$/.test(token)) return json({ error: "bad_request" }, 400);
  const H = { Authorization: "Key " + FKEY, "Content-Type": "application/json", Accept: "application/json" };

  if (action === "get") {
    const u = String(b.url ?? ""); if (!QUEUE_OK.test(u)) return json({ error: "bad_url" }, 400);
    try { const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(60_000) }); return new Response(await r.text(), { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } }); }
    catch { return json({ error: "upstream_unreachable" }, 504); }
  }
  if (action !== "submit") return json({ error: "bad_action" }, 400);
  const model = String(b.model ?? ""); if (!MODEL_OK.test(model)) return json({ error: "bad_model" }, 400);
  const body = JSON.stringify(b.body ?? {}); if (body.length > 12_000_000) return json({ error: "too_large" }, 413);
  if (limited(token)) return json({ error: "rate_limited", message: MSG.rate_limited }, 429);
  const ch = admin ? { ok: true, left: null } : await rpc("saas_ai_charge", { p_token: token, p_kind: "video" });
  if (!ch) return json({ error: "billing_unavailable", message: "تعذّر التحقق من الرصيد — حاول لاحقاً" }, 502);
  if (!ch.ok) return json({ error: ch.reason, message: MSG[ch.reason] ?? "مرفوض" }, ch.reason === "unknown_token" ? 401 : 402);
  try {
    const r = await fetch("https://queue.fal.run/" + model, { method: "POST", headers: H, body, signal: AbortSignal.timeout(110_000) });
    const text = await r.text();
    if (!r.ok) { if (!admin) await rpc("saas_ai_refund", { p_token: token, p_kind: "video" }); return new Response(text, { status: r.status === 401 || r.status === 403 ? 502 : r.status, headers: { ...CORS, "Content-Type": "application/json" } }); }
    let j: any = {}; try { j = JSON.parse(text); } catch { /* */ }
    return json({ ...j, left: ch.left });
  } catch {
    if (!admin) await rpc("saas_ai_refund", { p_token: token, p_kind: "video" });          // لا يُحاسَب الموقع على طلب لم يصل
    return json({ error: "upstream_failed", message: "تعذّرت خدمة الفيديو مؤقتاً — لم يُخصم من رصيدك" }, 502);
  }
});
