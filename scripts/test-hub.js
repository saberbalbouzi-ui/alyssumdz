/* اختبار النشر التلقائي (Hub): الدالة على الخادم (platform/supabase/functions/hub/index.ts) بمحاكاة Supabase وGitHub، والعميل (assets/js/hub.js).
     node scripts/test-hub.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
let fails = 0, total = 0;
const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗", n, x === undefined ? "" : JSON.stringify(x)); } else console.log("✓", n); };

/* ── الخادم ── */
const SRC = fs.readFileSync(path.join(root, "platform/supabase/functions/hub/index.ts"), "utf8");
const TK = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4";
const users = { t_owner: { email: "Owner@x.com", email_confirmed_at: "1" }, t_editor: { email: "ed@x.com", email_confirmed_at: "1" }, t_stranger: { email: "who@x.com", email_confirmed_at: "1" }, t_unconf: { email: "owner@x.com" } };
const roles = { "owner@x.com": "owner", "ed@x.com": "editor" };
const db = { secret: null, siteRow: { id: "alyssum", backend: "github", gh_owner: "own", gh_repo: "rep", gh_branch: "main" } };
const calls = [];
async function mockFetch(url, opt) {
  opt = opt || {}; const u = new URL(url), h = opt.headers || {}; calls.push({ url: String(url), method: opt.method || "GET", headers: h, body: opt.body });
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  if (u.pathname === "/auth/v1/user") { const t = (h.Authorization || "").replace("Bearer ", ""); return users[t] ? J(users[t]) : J({ error: "no" }, 401); }
  if (u.pathname === "/rest/v1/hub_members") { const em = decodeURIComponent(u.searchParams.get("email").replace("eq.", "")); return J(roles[em] ? [{ role: roles[em] }] : []); }
  if (u.pathname === "/rest/v1/hub_sites") { if (opt.method === "PATCH") { Object.assign(db.siteRow, JSON.parse(opt.body)); return J({}); } return J([db.siteRow]); }
  if (u.pathname === "/rest/v1/hub_secrets") { if (opt.method === "POST") { db.secret = JSON.parse(opt.body).gh_token_enc; return J({}); } if (opt.method === "DELETE") { db.secret = null; return J({}); } return J(db.secret ? [{ gh_token_enc: db.secret }] : []); }
  if (u.pathname === "/rest/v1/rpc/hub_my_sites") return J([{ id: "alyssum", linked: !!db.secret, gh_owner: "own", gh_repo: "rep", gh_branch: "main", role: "owner" }]);
  if (u.hostname === "api.github.com") {
    if (u.pathname === "/repos/own/rep") return (h.Authorization === "Bearer " + TK) ? J({ permissions: { push: true } }) : (h.Authorization === "Bearer ghp_readonly0000000000000000" ? J({ permissions: { push: false } }) : J({ message: "Bad credentials" }, 401));
    return J({ upstream: true, path: u.pathname + u.search });
  }
  return J({ error: "unmocked " + url }, 500);
}
let handler = null;
new Function("Deno", "fetch", SRC)({ env: { get: k => ({ SUPABASE_URL: "https://p.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "svc", HUB_KEY: "unit-test-key-0123456789" }[k]) }, serve: h => { handler = h; } }, mockFetch);
const req = (method, p, tok, body) => handler(new Request("https://p.supabase.co/functions/v1/hub" + p, { method, headers: Object.assign({ "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: body == null ? undefined : (typeof body === "string" ? body : JSON.stringify(body)) }));
const gh = (method, rest, tok, body) => req(method, "/gh/alyssum/" + rest, tok, body);

(async () => {
  let r = await req("OPTIONS", "/sites"); ok("CORS: OPTIONS يُجاب بلا مصادقة", r.status === 200 && r.headers.get("access-control-allow-origin") === "*");
  ok("بلا جلسة: 401", (await req("GET", "/sites")).status === 401);
  ok("بريد غير مؤكَّد: 401", (await req("GET", "/sites", "t_unconf")).status === 401);
  ok("غريب عن المتجر: 403 على وسيط النشر", (await gh("GET", "contents/data.js", "t_stranger")).status === 403);
  ok("المتجر غير مربوط: 409", (await gh("GET", "contents/data.js", "t_owner")).status === 409);
  ok("المحرّر (editor) لا يربط الرمز", (await req("POST", "/link", "t_editor", { site: "alyssum", token: TK })).status === 403);
  ok("رمز بصيغة خاطئة يُرفض", (await req("POST", "/link", "t_owner", { site: "alyssum", token: "short" })).status === 400);
  r = await req("POST", "/link", "t_owner", { site: "alyssum", token: "ghp_readonly0000000000000000" }); ok("رمز بلا صلاحية كتابة يُرفض", r.status === 400 && (await r.json()).error === "no_write_permission");
  r = await req("POST", "/link", "t_owner", { site: "alyssum", token: "ghp_wrong00000000000000000000" }); ok("رمز مرفوض عند المستودع يُرفض", r.status === 400);
  r = await req("POST", "/link", "t_owner", { site: "alyssum", token: TK }); ok("ربط الرمز الصحيح ينجح", r.status === 200 && (await r.json()).ok === true);
  ok("الرمز يُحفظ مشفَّراً (لا يظهر نصّه)", db.secret && !db.secret.includes(TK) && db.secret.includes("."), db.secret && db.secret.slice(0, 20));
  r = await req("GET", "/sites", "t_owner"); ok("قائمة متاجري تُظهر الربط بلا أي سرّ", r.status === 200 && (await r.clone().text()).indexOf(TK) < 0 && (await r.json()).sites[0].linked === true);

  calls.length = 0; r = await gh("GET", "contents/assets/js/data.js?ref=main&t=1", "t_owner");
  const up = calls.find(c => c.url.startsWith("https://api.github.com/"));
  ok("تمرير القراءة: المسار والاستعلام صحيحان والرمز المفكوك يُرسل لـGitHub فقط", r.status === 200 && up && up.url === "https://api.github.com/repos/own/rep/contents/assets/js/data.js?ref=main&t=1" && up.headers.Authorization === "Bearer " + TK, up);
  ok("المحرّر (editor) يستطيع النشر", (await gh("PUT", "contents/assets/data/x.json", "t_editor", { message: "m", content: "e30=", branch: "main" })).status === 200);
  calls.length = 0; await gh("PUT", "contents/assets/data/x.json", "t_owner", { message: "m", content: "e30=", branch: "main", sha: "abc" }); const put = calls.find(c => c.method === "PUT");
  ok("جسم الكتابة يُمرَّر كما هو", put && JSON.parse(put.body).content === "e30=");
  ok("النشر الدفعي (blobs/trees/commits/refs) مسموح", (await gh("POST", "git/blobs", "t_owner", { content: "x", encoding: "base64" })).status === 200 && (await gh("POST", "git/trees", "t_owner", { tree: [{ path: "assets/img/a.webp", mode: "100644", type: "blob", sha: "1".repeat(40) }] })).status === 200 && (await gh("PATCH", "git/refs/heads/main", "t_owner", { sha: "1".repeat(40) })).status === 200);
  ok("تشغيل سير عمل للنسخ مسموح", (await gh("POST", "actions/workflows/clone-page.yml/dispatches", "t_owner", { ref: "main" })).status === 200);

  ok("محجوب: إعدادات المستودع/المتعاونون", (await gh("GET", "collaborators", "t_owner")).status === 403 && (await gh("GET", "keys", "t_owner")).status === 403 && (await gh("DELETE", "", "t_owner").catch(() => ({ status: 403 }))).status >= 400);
  ok("محجوب: الكتابة في .github/", (await gh("PUT", "contents/.github/workflows/x.yml", "t_owner", { message: "m", content: "e30=" })).status === 403);
  ok("محجوب: ../ في المسار", (await gh("PUT", "contents/a/../../b", "t_owner", { message: "m", content: "e30=" })).status === 403);
  ok("محجوب: شجرة تحوي .github/", (await gh("POST", "git/trees", "t_owner", { tree: [{ path: ".github/workflows/x.yml", mode: "100644", type: "blob", sha: "1".repeat(40) }] })).status === 403);
  ok("محجوب: تحديث نسخة غير نسخة المتجر", (await gh("PATCH", "git/refs/heads/other", "t_owner", { sha: "1".repeat(40) })).status === 403);
  ok("محجوب: حذف مرجع (refs)", (await gh("DELETE", "git/refs/heads/main", "t_owner")).status === 405);

  r = await req("POST", "/unlink", "t_owner", { site: "alyssum" }); ok("إيقاف الربط يمسح الرمز", r.status === 200 && db.secret === null && (await gh("GET", "contents/x", "t_owner")).status === 409);

  /* ── العميل ── */
  const store = {}, localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const out = []; const win = { fetch: async (u, o) => { out.push({ u: String(u), o }); return new Response(JSON.stringify({ sites: [{ id: "alyssum", linked: true, gh_owner: "own", gh_repo: "rep", gh_branch: "main" }] }), { status: 200 }); } };
  const sbOn = { enabled: () => true, token: async () => "JWT123" };
  const sb = { window: win, localStorage, console, Headers, CONFIG: { HUB_SITE: "alyssum", SUPABASE_URL: "https://p.supabase.co", SUPABASE_ANON_KEY: "anon" }, API: { sb: sbOn }, document: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/hub.js"), "utf8"), sb);
  const Hub = win.Hub; ok("العميل: Hub يعمل حين يُضبط HUB_SITE وSupabase", Hub && Hub.on() === true && Hub.ready() === false);
  out.length = 0; await win.fetch("https://api.github.com/repos/own/rep/contents/a.json?ref=main", { headers: { Authorization: "Bearer ghp_real", Accept: "x" } });
  ok("العميل: بلا ربط تلقائي تمرّ طلبات المستودع كما هي (التوافق مع الرمز اليدوي)", out.length === 1 && out[0].u.startsWith("https://api.github.com/"));
  await Hub.sync(); const c1 = JSON.parse(localStorage.getItem("alyssum_gh_cfg") || "null");
  ok("العميل: المزامنة تضبط الربط التلقائي بلا رمز", c1 && c1.token === "hub" && c1.owner === "own" && c1.repo === "rep" && Hub.ready() === true, c1);
  out.length = 0; await win.fetch("https://api.github.com/repos/own/rep/contents/a.json?ref=main", { method: "PUT", headers: { Authorization: "Bearer hub", Accept: "x", "Content-Type": "application/json" }, body: "{}" });
  const o1 = out[0]; ok("العميل: طلب المستودع يتحوّل للدالة بجلسة المدير لا بالرمز", o1 && o1.u === "https://p.supabase.co/functions/v1/hub/gh/alyssum/contents/a.json?ref=main" && o1.o.headers.Authorization === "Bearer JWT123" && o1.o.headers.apikey === "anon" && o1.o.method === "PUT", o1);
  out.length = 0; await win.fetch("https://api.github.com/repos/other/zzz/contents/a", {}); ok("العميل: مستودع آخر لا يُحوَّل", out[0].u.startsWith("https://api.github.com/repos/other"));
  out.length = 0; await win.fetch("https://example.com/x"); ok("العميل: بقية الطلبات لا تُمسّ", out[0].u === "https://example.com/x");
  console.log(fails ? `✗ فشل ${fails} من ${total}` : `✓ نجح ${total} من ${total}`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
