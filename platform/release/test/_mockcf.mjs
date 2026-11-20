/* محاكي بروتوكول Cloudflare + Supabase (REST فعلي الشكل، مدعوم بـnode:sqlite) لاختبار كود CloudflareAdapter نفسه دون شبكة. ليس Cloudflare الحقيقي. */
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const json = (result, status = 200) => new Response(JSON.stringify({ success: status < 300, result, errors: status < 300 ? [] : [{ message: "mock error" }] }), { status, headers: { "Content-Type": "application/json" } });
export class MockCloudflare {
  constructor({ accountId, registry, repoRoot, extraWorkers = [], extraD1 = [] }) {
    const B = registry.environments.beta; this.acc = accountId; this.B = B; this.repoRoot = repoRoot; this.dir = mkdtempSync(path.join(tmpdir(), "mockcf-"));
    this.file = path.join(this.dir, "api.db"); this.db = new DatabaseSync(this.file); this.sb = new DatabaseSync(":memory:"); this.sb.exec("CREATE TABLE orders (id TEXT PRIMARY KEY, name TEXT); CREATE TABLE admins (email TEXT PRIMARY KEY)");
    this.kv = new Map(); this.nsId = null; this.workers = {}; this.d1names = [B.cf_d1, B.gateway_d1, ...extraD1]; for (const n of extraWorkers) this.workers[n] = { versions: [], deployments: [] };
    this.requests = []; this.faults = {}; this.hooks = {}; this.bm = 0; this.kvWrites = []; this.hostsSeen = new Set();
  }
  close() { try { this.db.close(); } catch { } rmSync(this.dir, { recursive: true, force: true }); }
  worker(n) { return (this.workers[n] ??= { versions: [], deployments: [] }); }
  addVersion(name, sha, code) { const w = this.worker(name), id = `ver-${name.slice(-6)}-${w.versions.length + 1}`; w.versions.push({ id, sha, code }); w.deployments.unshift({ id: "dep-" + id, versions: [{ version_id: id, percentage: 100 }] }); return id; }
  /* أداة نشر Worker المحاكاة (تحلّ محل deploy.mjs --env beta worker) */
  runTool = async (cmd, args, env) => { if (!args.some((a) => /deploy\.mjs$/.test(a)) || !args.includes("worker")) throw new Error("أداة غير متوقعة: " + args.join(" ")); const gw = args.some((a) => /gateway/.test(a)), name = gw ? this.B.gateway_worker : this.B.cf_worker; if (this.faults.failWorkerDeploy === (gw ? "gateway" : "api")) throw new Error("فشل مُحقَن لنشر Worker"); const code = readFileSync(path.join(this.repoRoot, gw ? "platform/gateway/src/index.js" : "platform/api/src/index.js"), "utf8"); this.addVersion(name, env.GIT_SHA, code); return "ok"; };
  meta() { return Object.fromEntries(this.db.prepare("SELECT k,v FROM pf_meta").all().map((r) => [r.k, r.v])); }
  async callApi(p, init = {}) { const w = this.worker(this.B.cf_worker), dep = w.deployments[0], v = w.versions.find((x) => x.id === dep.versions[0].version_id), mod = await import("data:text/javascript;base64," + Buffer.from(v.code).toString("base64")); const db = this.db; const D1 = { prepare: (sql) => { const mk = (b) => ({ bind: (...x) => mk(x), all: async () => ({ results: db.prepare(sql).all(...b) }), run: async () => (db.prepare(sql).run(...b), { success: true }) }); return mk([]); } }; const res = await mod.default.fetch(new Request("https://x.test" + p, init), { DB: D1 }); return { status: res.status, body: await res.text() }; }
  fetch = async (url, init = {}) => {
    const u = new URL(url), method = (init.method || "GET").toUpperCase(); this.requests.push({ method, url: String(url) }); this.hostsSeen.add(u.host);
    if (u.host === "api.supabase.com") { const m = /\/v1\/projects\/([a-z0-9]+)\/database\/query/.exec(u.pathname); if (!m || m[1] !== this.B.supabase_ref) return new Response("forbidden", { status: 403 }); const q = JSON.parse(init.body).query; try { const st = this.sb.prepare(q); return new Response(JSON.stringify(/^\s*select/i.test(q) ? st.all() : (st.run(), [])), { status: 201 }); } catch (e) { return new Response(JSON.stringify({ message: e.message }), { status: 400 }); } }
    if (u.host === this.B.api_host) { if (u.pathname !== "/health") return new Response("nf", { status: 404 }); const w = this.worker(this.B.cf_worker), dep = w.deployments[0]; if (!dep) return new Response("down", { status: 503 }); const v = w.versions.find((x) => x.id === dep.versions[0].version_id), m = this.meta(); return new Response(JSON.stringify({ ok: true, sha: v.sha, environment: "beta", db_environment: m.environment, schema: { actual: m.schema_hash } }), { status: 200 }); }
    if (u.host === this.B.app_host) return this.site(u, method);
    if (u.host !== "api.cloudflare.com") return new Response("blocked", { status: 599 });
    const mm = new RegExp(`^/client/v4/accounts/${this.acc}(/.*)?$`).exec(u.pathname); if (!mm) return json(null, 404); const p = mm[1] || "", q = u.searchParams;
    if (p === "/workers/scripts" && method === "GET") return json(Object.keys(this.workers).map((id) => ({ id })));
    if (p === "/d1/database" && method === "GET") { const nm = q.get("name"); return json(this.d1names.filter((n) => !nm || n === nm).map((n) => ({ name: n, uuid: "uuid-" + n }))); }
    let r;
    if ((r = /^\/d1\/database\/uuid-([^/]+)\/query$/.exec(p)) && method === "POST") { if (r[1] !== this.B.cf_d1) return json(null, 404); const b = JSON.parse(init.body); this.hooks.beforeQuery?.(b.sql, this); try { const st = this.db.prepare(b.sql), pa = b.params ?? []; return json([{ results: /^\s*(select|pragma|with)/i.test(b.sql) ? st.all(...pa) : (st.run(...pa), []) }]); } catch (e) { return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 400 }); } }
    if ((r = /^\/d1\/database\/uuid-([^/]+)\/time_travel\/bookmark$/.exec(p))) { const f = path.join(this.dir, `bm${++this.bm}.db`); this.db.close(); copyFileSync(this.file, f); this.db = new DatabaseSync(this.file); return json({ bookmark: f }); }
    if ((r = /^\/d1\/database\/uuid-([^/]+)\/time_travel\/restore$/.exec(p)) && method === "POST") { const f = q.get("bookmark"); this.db.close(); copyFileSync(f, this.file); this.db = new DatabaseSync(this.file); return json({ ok: true }); }
    if (p === "/storage/kv/namespaces" && method === "GET") return json(this.nsId ? [{ id: this.nsId, title: this.B.static_kv }] : []);
    if (p === "/storage/kv/namespaces" && method === "POST") { this.nsId = "ns-1"; return json({ id: this.nsId }); }
    if ((r = /^\/storage\/kv\/namespaces\/[^/]+\/values\/(.+)$/.exec(p))) { const key = decodeURIComponent(r[1]); if (method === "GET") return this.kv.has(key) ? new Response(this.kv.get(key), { status: 200 }) : new Response("nf", { status: 404 }); if (method === "PUT") { this.kv.set(key, init.body); this.kvWrites.push(key); return json({}); } }
    if (/^\/storage\/kv\/namespaces\/[^/]+\/bulk$/.test(p) && method === "PUT") { for (const it of JSON.parse(init.body)) { this.kv.set(it.key, Buffer.from(it.value, "base64")); this.kvWrites.push(it.key); } return json({}); }
    if ((r = /^\/workers\/scripts\/([^/]+)\/deployments$/.exec(p))) { const w = this.worker(r[1]); if (method === "GET") return json({ deployments: w.deployments }); if (method === "POST") { const b = JSON.parse(init.body); w.deployments.unshift({ id: "dep-rb-" + w.deployments.length, versions: b.versions }); return json({}); } }
    if ((r = /^\/workers\/scripts\/([^/]+)$/.exec(p)) && method === "PUT") { const w = this.worker(r[1]); w.static = true; return json({}); }
    if (/\/subdomain$/.test(p)) return json({});
    return json(null, 404);
  };
  site(u, method) { const p = decodeURIComponent(u.pathname).replace(/^\/+/, "") || "index.html", ptr = (c) => this.kv.get("__ptr/" + c), tpl = /^(assets\/pages\/|assets\/img\/tpl\/)/.test(p), comp = tpl ? "templates" : "ui", hdr = { "x-robots-tag": "noindex, nofollow", ...(ptr("ui") ? { "x-beta-ui": String(ptr("ui")) } : {}), ...(ptr("templates") ? { "x-beta-templates": String(ptr("templates")) } : {}) };
    const rel = ptr(comp), man = rel ? JSON.parse(this.kv.get(`__m/${comp}/${rel}`) ?? "{}") : null, h = man?.[p]; if (!h) return new Response(method === "HEAD" ? null : "nf", { status: p === "index.html" && method === "HEAD" && rel ? 200 : 404, headers: hdr }); return new Response(method === "HEAD" ? null : this.kv.get("o/" + h), { status: 200, headers: hdr }); }
}
