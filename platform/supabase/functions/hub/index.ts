// النشر التلقائي (Hub): المدير يدخل ببريده وكلمة مروره فقط، وهذه الدالة تنشر على موقعه نيابةً عنه
// بالرمز المحفوظ مشفَّراً عندها (لا يراه العميل ولا يُكتب في المتصفح).
// النشر: Edge Functions ← الاسم hub ← الصق الكود ← أطفئ «Verify JWT» (الدالة تتحقق بنفسها من الجلسة والعضوية)
// أسرار الدالة: HUB_KEY (نص عشوائي طويل لتشفير الرموز). المتغيرات SUPABASE_URL/ANON/SERVICE تأتي تلقائياً.
// الجداول والدوال: platform/supabase/hub.sql
// ملاحظة: الكود بلا صيغة TypeScript عمداً ليُختبر بـNode في scripts/test-hub.js

const URL_ = Deno.env.get("SUPABASE_URL");
const ANON = Deno.env.get("SUPABASE_ANON_KEY");
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const HUB_KEY = Deno.env.get("HUB_KEY") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, x-github-api-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/* ── ما يُسمح بتمريره إلى واجهة GitHub (مستودع المتجر فقط) ── */
const ALLOW = [
  /^contents\/.+/,
  /^git\/(blobs|trees|commits)(\/[0-9a-f]{40})?$/,
  /^git\/refs\/heads\/[A-Za-z0-9._\/-]+$/,
  /^git\/ref\/heads\/[A-Za-z0-9._\/-]+$/,
  /^actions\/workflows\/(clone-page|release)\.yml\/(dispatches|runs)$/,       // قائمة بيضاء: لا تشغيل لسكربتات الأسرار (publish-site/social-publish) من الحساب المشترك
  /^actions\/runs(\/[0-9]+)?$/,
  /^(commits|branches)(\/[A-Za-z0-9._\/-]+)?$/,
];
const BLOCKED_PATH = /^(\.github\/|\.git\/|api\/_data\/|api\/config|CNAME$|scripts\/|platform\/|saas\/|supabase\/|php-edition\/|extension\/)/i;     // لا كتابة في مسارات تتيح رفع صلاحيات أو تغيير النطاق
const okPath = (p) => typeof p === "string" && !p.includes("..") && !p.startsWith("/") && !BLOCKED_PATH.test(p);

/* ── تشفير الرمز AES-GCM ── */
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function aesKey() { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(HUB_KEY)); return crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]); }
async function enc(text) { const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(text))); return b64(iv) + "." + b64(ct); }
async function dec(s) { const [a, c] = String(s).split("."); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(a) }, await aesKey(), unb64(c))); }

/* ── قاعدة البيانات (service_role داخل الدالة فقط) ── */
const rest = (path, opt = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...opt, headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", ...(opt.headers || {}) } });
async function who(req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim(); if (!t) return null;
  const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${t}` } }); if (!r.ok) return null;
  const u = await r.json(); if (!u || !u.email || !(u.email_confirmed_at || u.confirmed_at)) return null; return { email: String(u.email).toLowerCase(), id: u.id };
}
async function member(site, email) {
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(site || "")) return null;
  const m = await rest(`hub_members?site_id=eq.${site}&email=eq.${encodeURIComponent(email)}&select=role`).then((r) => r.json()).catch(() => []);
  if (!Array.isArray(m) || !m.length) return null;
  const s = await rest(`hub_sites?id=eq.${site}&select=*`).then((r) => r.json()).catch(() => []);
  return s && s[0] ? { role: m[0].role, site: s[0] } : null;
}
async function token(site) { const r = await rest(`hub_secrets?site_id=eq.${site}&select=gh_token_enc`).then((x) => x.json()).catch(() => []); return r && r[0] && r[0].gh_token_enc ? dec(r[0].gh_token_enc) : null; }

async function handle(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url), path = u.pathname.replace(/^\/functions\/v1\/hub/, "").replace(/^\/hub/, "") || "/";
  const me = await who(req); if (!me) return json({ error: "unauthorized" }, 401);

  /* قائمة متاجري (للواجهة) */
  if (path === "/sites" && req.method === "GET") {
    const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const r = await fetch(`${URL_}/rest/v1/rpc/hub_my_sites`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: "{}" });
    return json({ sites: r.ok ? await r.json() : [] });
  }

  /* ربط الرمز مرة واحدة: يُتحقَّق منه عند GitHub ثم يُحفظ مشفَّراً */
  if (path === "/link" && req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const m = await member(b.site, me.email); if (!m || m.role !== "owner") return json({ error: "forbidden" }, 403);
    if (!HUB_KEY) return json({ error: "hub_not_configured" }, 503);
    const tk = String(b.token || "").trim(), owner = String(b.owner || m.site.gh_owner || "").trim(), repo = String(b.repo || m.site.gh_repo || "").trim(), branch = String(b.branch || m.site.gh_branch || "main").trim();
    if (!/^[A-Za-z0-9_\-.]{20,255}$/.test(tk) || !/^[A-Za-z0-9._-]{1,100}$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(repo) || !/^[A-Za-z0-9._\/-]{1,100}$/.test(branch)) return json({ error: "bad_input" }, 400);
    const g = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { Authorization: `Bearer ${tk}`, Accept: "application/vnd.github+json", "User-Agent": "hub" } });
    if (!g.ok) return json({ error: "github_rejected", status: g.status }, 400);
    const gj = await g.json(); if (!gj.permissions || !gj.permissions.push) return json({ error: "no_write_permission" }, 400);
    await rest(`hub_sites?id=eq.${m.site.id}`, { method: "PATCH", body: JSON.stringify({ gh_owner: owner, gh_repo: repo, gh_branch: branch }) });
    const e = await enc(tk);
    await rest(`hub_secrets`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ site_id: m.site.id, gh_token_enc: e, updated_at: new Date().toISOString() }) });
    return json({ ok: true, owner, repo, branch });
  }
  if (path === "/unlink" && req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const m = await member(b.site, me.email); if (!m || m.role !== "owner") return json({ error: "forbidden" }, 403);
    await rest(`hub_secrets?site_id=eq.${m.site.id}`, { method: "DELETE" }); return json({ ok: true });
  }

  /* وسيط GitHub: /gh/<site>/<مسار داخل المستودع> */
  const g = /^\/gh\/([a-z0-9-]+)\/(.+)$/.exec(path);
  if (g) {
    const m = await member(g[1], me.email); if (!m) return json({ error: "forbidden" }, 403);
    if (m.site.backend !== "github" || !m.site.gh_owner) return json({ error: "no_backend" }, 400);
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return json({ error: "method" }, 405);
    const rest_ = g[2];
    if (!ALLOW.some((rx) => rx.test(rest_))) return json({ error: "path_not_allowed" }, 403);
    if (/^git\/refs\/heads\//.test(rest_) && rest_ !== `git/refs/heads/${m.site.gh_branch}`) return json({ error: "ref_not_allowed" }, 403);
    if (req.method === "DELETE" && !/^contents\//.test(rest_)) return json({ error: "method" }, 405);
    let body; const hasBody = !["GET", "DELETE"].includes(req.method) || /^contents\//.test(rest_);
    if (req.method !== "GET") { body = await req.text(); }
    if (/^contents\//.test(rest_)) { if (!okPath(decodeURIComponent(rest_.slice(9)))) return json({ error: "path_blocked" }, 403); }
    if (rest_ === "git/trees" && req.method === "POST") {
      try { const j = JSON.parse(body || "{}"); if (!Array.isArray(j.tree) || j.tree.some((x) => !okPath(x.path))) return json({ error: "path_blocked" }, 403); } catch { return json({ error: "bad_json" }, 400); }
    }
    const tk = await token(m.site.id); if (!tk) return json({ error: "not_linked" }, 409);
    const up = await fetch(`https://api.github.com/repos/${m.site.gh_owner}/${m.site.gh_repo}/${rest_}${u.search}`, {
      method: req.method, headers: { Authorization: `Bearer ${tk}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "hub", "X-GitHub-Api-Version": "2022-11-28" }, body: req.method === "GET" || !hasBody ? undefined : body,
    });
    const txt = await up.text();
    return new Response(txt, { status: up.status, headers: { ...CORS, "Content-Type": up.headers.get("content-type") || "application/json" } });
  }
  return json({ error: "not_found" }, 404);
}
Deno.serve(handle);
