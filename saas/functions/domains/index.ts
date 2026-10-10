// ربط دومينات الزبائن بـCloudflare (Custom Hostnames) — للمدير فقط. يُنشر في مشروع Supabase الخاص بالمنصة:
//   supabase functions deploy domains --project-ref <ref>   (اترك Verify JWT مفعّلاً؛ وتتحقق الدالة أيضاً أن المتصل مدير منصة)
// الأسرار (Edge Functions ← Secrets): CF_API_TOKEN، CF_ZONE_ID (منطقة دومين المنصة)، FALLBACK_ORIGIN (مضيف التحويل، مثل origin.دومين-المنصة).
// الإجراءات (POST JSON): {action:"add", site:<uuid>, hostname} | {action:"status", site} | {action:"remove", site} | {action:"fallback"}
// لا تُكتب الأسرار في المستودع. كل تغيير يُسجَّل في saas_sites (cf_hostname_id/cf_status/ssl_status/domain/domain_status).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CF = Deno.env.get("CF_API_TOKEN") ?? "", ZONE = Deno.env.get("CF_ZONE_ID") ?? "", FALLBACK = Deno.env.get("FALLBACK_ORIGIN") ?? "";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Content-Type": "application/json" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const cf = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method, headers: { Authorization: `Bearer ${CF}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.success !== false, status: r.status, j };
};
const db = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  ...init, headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) } });

async function isAdmin(auth: string) {
  if (!auth) return false;
  const r = await fetch(`${URL_}/rest/v1/rpc/is_saas_admin`, { method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
const getSite = async (id: string) => { const r = await db(`saas_sites?id=eq.${encodeURIComponent(id)}&select=*`); const a = await r.json(); return Array.isArray(a) ? a[0] : null; };
const patch = (id: string, o: Record<string, unknown>) => db(`saas_sites?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(o) });

function mapStatus(h: any) {
  const ssl = h?.ssl?.status ?? null, st = h?.status ?? null;
  return { cf_status: st, ssl_status: ssl, active: st === "active" && ssl === "active" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!CF || !ZONE) return json({ error: "not_configured" }, 500);
  if (!(await isAdmin(req.headers.get("Authorization") ?? ""))) return json({ error: "unauthorized" }, 403);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  if (b.action === "fallback") {
    if (!FALLBACK) return json({ error: "no_fallback_origin" }, 500);
    const r = await cf("PUT", `/zones/${ZONE}/custom_hostnames/fallback_origin`, { origin: FALLBACK });
    return json({ ok: r.ok, result: r.j.result ?? null, errors: r.j.errors ?? null }, r.ok ? 200 : 502);
  }

  const site = b.site ? await getSite(String(b.site)) : null;
  if (!site) return json({ error: "site_not_found" }, 404);

  if (b.action === "add") {
    const hostname = String(b.hostname ?? "").trim().toLowerCase();
    if (!HOST_RE.test(hostname)) return json({ error: "bad_hostname" }, 400);
    if (site.cf_hostname_id) return json({ error: "already_linked", cf_hostname_id: site.cf_hostname_id }, 409);
    const r = await cf("POST", `/zones/${ZONE}/custom_hostnames`, {
      hostname, ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } } });
    if (!r.ok) return json({ ok: false, errors: r.j.errors ?? null }, 502);
    const h = r.j.result, m = mapStatus(h);
    await patch(site.id, { domain: hostname, domain_mode: "own", domain_status: "requested", cf_hostname_id: h.id, cf_status: m.cf_status, ssl_status: m.ssl_status, cf_checked_at: new Date().toISOString() });
    return json({ ok: true, hostname, id: h.id, ...m, ownership: h.ownership_verification ?? null, ssl_validation: h.ssl?.validation_records ?? null, cname_target: FALLBACK || null });
  }

  if (b.action === "status") {
    if (!site.cf_hostname_id) return json({ error: "not_linked" }, 404);
    const r = await cf("GET", `/zones/${ZONE}/custom_hostnames/${site.cf_hostname_id}`);
    if (!r.ok) return json({ ok: false, errors: r.j.errors ?? null }, 502);
    const h = r.j.result, m = mapStatus(h);
    await patch(site.id, { cf_status: m.cf_status, ssl_status: m.ssl_status, cf_checked_at: new Date().toISOString(), domain_status: m.active ? "connected" : (m.cf_status === "pending" ? "dns_ready" : site.domain_status) });
    return json({ ok: true, hostname: h.hostname, ...m, verification_errors: h.verification_errors ?? null, ssl_validation: h.ssl?.validation_records ?? null });
  }

  if (b.action === "remove") {
    if (!site.cf_hostname_id) return json({ error: "not_linked" }, 404);
    const r = await cf("DELETE", `/zones/${ZONE}/custom_hostnames/${site.cf_hostname_id}`);
    if (!r.ok && r.status !== 404) return json({ ok: false, errors: r.j.errors ?? null }, 502);
    await patch(site.id, { cf_hostname_id: null, cf_status: null, ssl_status: null, domain_status: "none", domain: null, domain_mode: "platform" });
    return json({ ok: true });
  }
  return json({ error: "bad_action" }, 400);
});
