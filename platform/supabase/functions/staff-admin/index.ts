// إدارة فريق العمل (للمالك فقط): إنشاء/تعديل/إيقاف حسابات الموظفين وإعادة ضبط المصادقة الثنائية.
// آمن: لا يعمل إلا لمالك مسجّل الدخول (is_admin بتوكن جلسته، ويشمل شرط aal2)، ومفتاح الخدمة سرّ في الخادم فقط.
// النشر: functions/deploy?slug=staff-admin مع إطفاء Verify JWT (الدالة تتحقق بنفسها).
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ROLES = ["manager", "agent", "support", "accountant", "warehouse"];
// صلاحيات معروفة فقط (الباقي يُرفض): تطابق AdminRoles.PERMS في اللوحة
const PERMS = ["orders", "orders.write", "orders.edit", "orders.create", "orders.delete", "callcenter", "analytics", "customers", "finance", "ship", "products", "marketing", "site", "pack"];
const PRESETS: Record<string, string[]> = {
  manager: ["orders", "orders.write", "orders.edit", "orders.create", "orders.delete", "callcenter", "analytics", "customers"],
  agent: ["orders", "orders.write", "callcenter"],
  support: ["orders", "orders.write", "orders.edit", "callcenter", "customers"],
  accountant: ["orders", "analytics", "finance", "customers"],
  warehouse: ["pack"],
};
const svc = (extra: Record<string, string> = {}) => ({ apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json", ...extra });
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1${path}`, { ...init, headers: svc({ Prefer: "return=representation", ...(init.headers as Record<string, string> ?? {}) }) });
const authAdmin = (path: string, init: RequestInit = {}) => fetch(`${URL_}/auth/v1/admin${path}`, { ...init, headers: svc((init.headers as Record<string, string>) ?? {}) });

async function userByEmail(email: string): Promise<any | null> {
  for (let page = 1; page <= 10; page++) {
    const r = await authAdmin(`/users?page=${page}&per_page=200`);
    if (!r.ok) return null;
    const j = await r.json(); const list = j.users ?? [];
    const u = list.find((x: any) => String(x.email ?? "").toLowerCase() === email);
    if (u) { const one = await authAdmin(`/users/${u.id}`); return one.ok ? await one.json() : u; }       // القائمة لا تتضمن العوامل؛ الجلب المفرد يتضمنها
    if (list.length < 200) break;
  }
  return null;
}
const cleanPerms = (p: unknown, role: string) => {
  const arr = Array.isArray(p) ? p.map(String).filter((x) => PERMS.includes(x)) : PRESETS[role] ?? [];
  const s = new Set(arr); if (s.has("orders.write") || s.has("orders.edit") || s.has("orders.create") || s.has("orders.delete") || s.has("callcenter")) s.add("orders");
  return [...s];
};
const audit = (actor: string, action: string, ref: string, detail: unknown = {}) =>
  rest("/audit_log", { method: "POST", body: JSON.stringify({ actor, role: "owner", action, ref: ref.slice(0, 80), detail }) }).catch(() => {});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const au = req.headers.get("Authorization") ?? "";
  const adm = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: ANON, Authorization: au, "Content-Type": "application/json" }, body: "{}" });
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "unauthorized" }, 401);
  const me = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: au } });
  const actor = me.ok ? String((await me.json()).email ?? "").toLowerCase() : "";
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const act = String(b.action ?? "");
  const email = String(b.email ?? "").trim().toLowerCase();
  const okEmail = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email);

  if (act === "list") {
    const r = await rest("/staff?select=*&order=created_at.asc");
    const rows = r.ok ? await r.json() : [];
    // حالة المصادقة الثنائية لكل موظف
    const out = [];
    for (const s of rows) {
      let mfa = false;
      const u = await userByEmail(String(s.email).toLowerCase());
      if (u) mfa = (u.factors ?? []).some((f: any) => f.status === "verified");
      out.push({ ...s, mfa, user: !!u, last_sign_in: u?.last_sign_in_at ?? null });
    }
    return json({ ok: true, staff: out, presets: PRESETS, perms: PERMS });
  }
  if (!okEmail) return json({ error: "invalid_email" }, 422);
  if (act === "create") {
    const role = String(b.role ?? "agent"); if (!ROLES.includes(role)) return json({ error: "invalid_role" }, 422);
    const pw = String(b.password ?? ""); const name = String(b.name ?? "").slice(0, 80);
    const owner = await fetch(`${URL_}/rest/v1/admins?select=email&email=ilike.${encodeURIComponent(email)}`, { headers: svc() });
    if (owner.ok && (await owner.json()).length) return json({ error: "is_owner" }, 409);
    let u = await userByEmail(email);
    if (!u) {
      if (pw.length < 10) return json({ error: "weak_password", detail: "10 أحرف على الأقل" }, 422);
      const c = await authAdmin("/users", { method: "POST", body: JSON.stringify({ email, password: pw, email_confirm: true }) });
      if (!c.ok) return json({ error: "create_failed", detail: (await c.text()).slice(0, 160) }, 400);
      u = await c.json();
    } else if (pw) {
      if (pw.length < 10) return json({ error: "weak_password", detail: "10 أحرف على الأقل" }, 422);
      await authAdmin(`/users/${u.id}`, { method: "PUT", body: JSON.stringify({ password: pw, ban_duration: "none" }) });
    }
    const perms = cleanPerms(b.perms, role);
    const r = await rest("/staff?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ email, name, role, perms, active: true, created_by: actor }) });
    if (!r.ok) return json({ error: "db_failed", detail: (await r.text()).slice(0, 160) }, 500);
    await audit(actor, "staff.create", email, { role, perms });
    return json({ ok: true });
  }
  const cur = await rest(`/staff?select=*&email=eq.${encodeURIComponent(email)}`);
  const row = cur.ok ? (await cur.json())[0] : null;
  if (!row) return json({ error: "not_found" }, 404);
  const u = await userByEmail(email);
  if (act === "update") {
    const patch: Record<string, unknown> = {};
    if (b.role !== undefined) { if (!ROLES.includes(String(b.role))) return json({ error: "invalid_role" }, 422); patch.role = String(b.role); }
    if (b.name !== undefined) patch.name = String(b.name).slice(0, 80);
    if (b.perms !== undefined || b.role !== undefined) patch.perms = cleanPerms(b.perms, String(patch.role ?? row.role));
    if (b.active !== undefined) patch.active = !!b.active;
    const r = await rest(`/staff?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!r.ok) return json({ error: "db_failed" }, 500);
    if (b.active !== undefined && u) await authAdmin(`/users/${u.id}`, { method: "PUT", body: JSON.stringify({ ban_duration: b.active ? "none" : "876000h" }) });
    await audit(actor, b.active === false ? "staff.disable" : "staff.update", email, patch);
    return json({ ok: true });
  }
  if (act === "password") {
    const pw = String(b.password ?? ""); if (pw.length < 10) return json({ error: "weak_password", detail: "10 أحرف على الأقل" }, 422);
    if (!u) return json({ error: "no_user" }, 404);
    const r = await authAdmin(`/users/${u.id}`, { method: "PUT", body: JSON.stringify({ password: pw }) });
    if (!r.ok) return json({ error: "failed" }, 400);
    await audit(actor, "staff.password", email);
    return json({ ok: true });
  }
  if (act === "reset_mfa") {
    if (!u) return json({ error: "no_user" }, 404);
    let n = 0;
    for (const f of u.factors ?? []) { const r = await authAdmin(`/users/${u.id}/factors/${f.id}`, { method: "DELETE" }); if (r.ok) n++; }
    await audit(actor, "staff.reset_mfa", email, { removed: n });
    return json({ ok: true, removed: n });
  }
  if (act === "delete") {
    await rest(`/staff?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
    if (u) await authAdmin(`/users/${u.id}`, { method: "DELETE" });
    await audit(actor, "staff.delete", email);
    return json({ ok: true });
  }
  return json({ error: "unknown_action" }, 400);
});
