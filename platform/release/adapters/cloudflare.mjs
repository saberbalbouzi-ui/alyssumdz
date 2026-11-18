/* محوّل Cloudflare/Supabase الحقيقي لنشر Beta — نفس عقد المحاكي (adapters/sim.mjs). حواجز: حساب غير معروف كحساب Production، لا مورد باسم Production، مرجع Supabase = المسجَّل لـBeta.
   الـWorkers تُرفع بأدوات النشر القائمة (platform/api|gateway/tools/deploy.mjs --env beta worker)؛ الرجوع بنشرة نسخة سابقة (Workers Versions)؛ الواجهة/القوالب بمحتوى معنوَن بالبصمة في KV + مؤشر ذرّي.
   ⚠ مسارات Time Travel لـD1 وإصدارات Workers وترويسات الصحة كُتبت من الوثائق وتُختبَر هنا ببروتوكول محاكى فقط؛ لم تُجرَّب على Cloudflare الحقيقي بعد. */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { snapshot, staticPlan, sha256 } from "../release-lib.mjs";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
export const KNOWN_PRODUCTION_ACCOUNTS = ["1dffae72b40ca6558da19b84eff8c864"];   // من deploy.mjs (PROD_DEFAULT) — لا يُنشَر Beta عليه أبداً
export const defaultRunTool = (cmd, args, env) => new Promise((res, rej) => execFile(cmd, args, { env, cwd: ROOT, maxBuffer: 16e6 }, (e, so, se) => (e ? rej(new Error(String(se || so || e.message).slice(-600))) : res(String(so)))));
const API = "https://api.cloudflare.com/client/v4";

export class CloudflareAdapter {
  constructor({ accountId, token = null, fetchFn = fetch, runTool = defaultRunTool, registry, contracts, supabase = null, env = process.env }) {
    const B = registry.environments.beta, P = registry.environments.production; this.B = B; this.P = P; this.acc = accountId; this.token = token && token !== "proxy-injected" ? token : null; this.fetch = fetchFn; this.runTool = runTool; this.env = env; this.contracts = contracts; this.sb = supabase;
    if (!/^[0-9a-f]{32}$/.test(String(accountId || ""))) throw new Error("guard: CF_ACCOUNT_ID غير صالح (32 خانة hex)");
    if (KNOWN_PRODUCTION_ACCOUNTS.includes(accountId)) throw new Error("guard: هذا حساب Production — نشر Beta عليه محظور");
    const prodNames = new Set([P.cf_worker, P.cf_d1, P.gateway_worker, P.gateway_d1, "alyssum-tenant-router"].filter(Boolean)); this.prodNames = prodNames;
    for (const n of [B.cf_worker, B.gateway_worker, B.static_worker, B.static_kv, B.cf_d1, B.gateway_d1]) if (!n || prodNames.has(n) || !/beta/.test(n)) throw new Error("guard: اسم مورد Beta غير صالح/يطابق Production: " + n);
    this.auth = this.token ? { Authorization: "Bearer " + this.token } : {}; this._d1 = {}; this._ns = null; this._verSha = {}; this.protectedTables = contracts.protected_tables.d1_api;
  }
  /* ── REST ── */
  async cf(method, p, body, headers = {}) {
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    const r = await this.fetch(`${API}/accounts/${this.acc}${p}`, { method, headers: { ...this.auth, ...(body && !form ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? (form ? body : JSON.stringify(body)) : undefined });
    const j = await r.json().catch(() => ({})); if (!j.success) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`); return j.result;
  }
  /** حارس الحساب: لا Worker/D1 بأسماء Production داخله (يُشغَّل قبل أي كتابة) */
  async assertAccountClean() {
    const ws = (await this.cf("GET", "/workers/scripts")) ?? [], ds = (await this.cf("GET", "/d1/database?per_page=100")) ?? [], names = [...ws.map((w) => w.id ?? w.name), ...ds.map((d) => d.name)];
    const hit = names.filter((n) => this.prodNames.has(n)); if (hit.length) throw new Error("guard: الحساب يحوي موارد Production: " + hit.join("، ")); return { workers: ws.length, d1: ds.length };
  }
  async d1Id(name) { if (this._d1[name]) return this._d1[name]; const l = (await this.cf("GET", `/d1/database?name=${encodeURIComponent(name)}`)) ?? [], d = l.find((x) => x.name === name); if (!d) throw new Error("قاعدة D1 غير موجودة: " + name); return (this._d1[name] = d.uuid); }
  exec = async (sql, params = []) => { const id = await this.d1Id(this.B.cf_d1); const r = await this.cf("POST", `/d1/database/${id}/query`, params.length ? { sql, params } : { sql }); return r?.[0]?.results ?? []; };
  async sbExec(query) { if (!this.sb) return []; const r = await this.fetch(`https://api.supabase.com/v1/projects/${this.sb.ref}/database/query`, { method: "POST", headers: { "Content-Type": "application/json", ...(this.sb.pat ? { Authorization: "Bearer " + this.sb.pat } : {}) }, body: JSON.stringify({ query }) }); if (r.status >= 300) throw new Error("supabase query HTTP " + r.status); return r.json(); }
  /* ── KV ── */
  async kvNs() { if (this._ns) return this._ns; const l = (await this.cf("GET", "/storage/kv/namespaces?per_page=100")) ?? []; let ns = l.find((n) => n.title === this.B.static_kv)?.id; if (!ns) ns = (await this.cf("POST", "/storage/kv/namespaces", { title: this.B.static_kv })).id; return (this._ns = ns); }
  async kvGet(key) { const ns = await this.kvNs(), r = await this.fetch(`${API}/accounts/${this.acc}/storage/kv/namespaces/${ns}/values/${encodeURIComponent(key)}`, { headers: this.auth }); if (r.status === 404) return null; if (r.status !== 200) throw new Error(`KV GET ${key} → ${r.status}`); return r.text(); }
  async kvHas(key) { const ns = await this.kvNs(), r = await this.fetch(`${API}/accounts/${this.acc}/storage/kv/namespaces/${ns}/values/${encodeURIComponent(key)}`, { headers: this.auth }); await r.arrayBuffer?.(); return r.status === 200; }
  async kvPut(key, value) { const ns = await this.kvNs(), r = await this.fetch(`${API}/accounts/${this.acc}/storage/kv/namespaces/${ns}/values/${encodeURIComponent(key)}`, { method: "PUT", headers: { ...this.auth, "Content-Type": "text/plain" }, body: value }); if (r.status >= 300) throw new Error(`KV PUT ${key} → ${r.status}`); }
  async kvBulk(items) { const ns = await this.kvNs(); const r = await this.fetch(`${API}/accounts/${this.acc}/storage/kv/namespaces/${ns}/bulk`, { method: "PUT", headers: { ...this.auth, "Content-Type": "application/json" }, body: JSON.stringify(items) }); if (r.status >= 300) throw new Error("KV bulk → " + r.status); }
  /* ── سجل الإصدارات (KV: __registry/*) ── */
  async getDeployed() { const id = await this.kvGet("__registry/current"); if (!id) return null; const t = await this.kvGet("__registry/" + id); return t ? JSON.parse(t) : null; }
  async listReleases() { const ids = JSON.parse((await this.kvGet("__registry/index")) ?? "[]"), out = []; for (const id of ids) { const t = await this.kvGet("__registry/" + id); if (t) out.push(JSON.parse(t)); } return out; }
  async recordRelease(m) { await this.kvPut("__registry/" + m.id, JSON.stringify(m)); const ids = JSON.parse((await this.kvGet("__registry/index")) ?? "[]").filter((x) => x !== m.id); ids.unshift(m.id); await this.kvPut("__registry/index", JSON.stringify(ids.slice(0, 20))); await this.kvPut("__registry/current", m.id); }
  async setCurrent(m) { await this.kvPut("__registry/current", m.id); }
  /* ── الترحيلات والبيانات ── */
  /** يضمن جداول التتبع وهوية القاعدة (beta فقط) قبل أي قراءة/كتابة — مطابق لـmigrate-lib: قاعدة بهوية أخرى ⇒ توقف */
  async ensureIdentity() {
    await this.exec("CREATE TABLE IF NOT EXISTS pf_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, at TEXT NOT NULL)"); await this.exec("CREATE TABLE IF NOT EXISTS pf_migrations (name TEXT PRIMARY KEY, sha TEXT NOT NULL, applied_at TEXT NOT NULL)");
    const id = (await this.exec("SELECT v FROM pf_meta WHERE k='environment'"))[0]?.v; if (id == null) await this.exec("INSERT OR IGNORE INTO pf_meta (k,v,at) VALUES ('environment','beta',?)", [new Date().toISOString()]); else if (id !== "beta") throw new Error(`guard: هوية القاعدة '${id}' ≠ 'beta' — أُوقف`);
  }
  async pendingMigrations(migs) {
    await this.ensureIdentity(); let rows = []; try { rows = await this.exec("SELECT name, sha FROM pf_migrations"); } catch { rows = []; }
    const applied = new Map(rows.map((r) => [r.name, r.sha])), disk = new Set(migs.map((m) => m.name));
    return { pending: migs.filter((m) => !applied.has(m.name)), mismatched: migs.filter((m) => applied.has(m.name) && applied.get(m.name) !== m.sha).map((m) => m.name), unknown: [...applied.keys()].filter((n) => !disk.has(n)) };
  }
  async snapshot(tables) {
    const d1 = await snapshot(this.exec, tables), out = { ...d1 };
    if (this.sb) { const cols = this.contracts.protected_tables.supabase, sb = await snapshot(async (q) => this.sbExec(q), Object.keys(cols), { idCols: cols }); for (const [t, v] of Object.entries(sb)) out["sb:" + t] = v; }
    return out;
  }
  async bookmark() { const id = await this.d1Id(this.B.cf_d1), r = await this.cf("GET", `/d1/database/${id}/time_travel/bookmark`); return r.bookmark; }
  async restore(bm) { const id = await this.d1Id(this.B.cf_d1); await this.cf("POST", `/d1/database/${id}/time_travel/restore?bookmark=${encodeURIComponent(bm)}`); }
  async applyMigrations(pending, { schemaHash, sha }) {
    const done = [];
    for (const m of pending) { for (const st of m.statements) await this.exec(st); await this.exec("INSERT INTO pf_migrations (name,sha,applied_at) VALUES (?,?,?)", [m.name, m.sha, new Date().toISOString()]); done.push(m.name); }
    const up = "INSERT INTO pf_meta (k,v,at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, at=excluded.at", at = new Date().toISOString();
    if (schemaHash) await this.exec(up, ["schema_hash", schemaHash, at]); await this.exec(up, ["release_sha", sha, at]); return done;
  }
  /* ── المكوّنات ── */
  async currentVersion(name) { const d = await this.cf("GET", `/workers/scripts/${name}/deployments`), list = d?.deployments ?? d ?? []; return list[0]?.versions?.[0]?.version_id ?? null; }
  async deployComponent(comp, manifest, artifact) {
    if (comp === "api" || comp === "gateway") {
      const name = comp === "api" ? this.B.cf_worker : this.B.gateway_worker, tool = comp === "api" ? "platform/api/tools/deploy.mjs" : "platform/gateway/tools/deploy.mjs", prev = await this.currentVersion(name);
      await this.runTool("node", [tool, "--env", "beta", "worker"], { ...this.env, CF_ACCOUNT_ID: this.acc, CF_ZONE_ID: this.env.BETA_CF_ZONE_ID || "workers-dev-no-zone", GIT_SHA: manifest.source.sha, ...(this.token ? { CF_API_TOKEN: this.token } : {}) });
      const now = await this.currentVersion(name); if (!now || now === prev) throw new Error(`لم تظهر نسخة Worker جديدة لـ${name}`); this._verSha[now] = manifest.source.sha; return { previous: prev ? { version: prev } : null, handle: { version: now }, note: now };
    }
    const files = [...(artifact?.files ?? [])]; if (comp === "ui") { await this.deployStaticWorker(); const { handles, ...pub } = manifest; files.push({ path: "beta-release.json", buf: Buffer.from(JSON.stringify(pub)) }); }
    const { map, objects } = staticPlan(files), hashes = [...objects.keys()], missing = [];
    for (let i = 0; i < hashes.length; i += 16) { const r = await Promise.all(hashes.slice(i, i + 16).map((h) => this.kvHas("o/" + h))); r.forEach((has, k) => { if (!has) missing.push(hashes[i + k]); }); }
    let batch = [], size = 0; const flush = async () => { if (batch.length) await this.kvBulk(batch); batch = []; size = 0; };
    for (const h of missing) { const v = objects.get(h).toString("base64"); if (size + v.length > 40e6 || batch.length >= 5000) await flush(); batch.push({ key: "o/" + h, value: v, base64: true }); size += v.length; } await flush();
    await this.kvPut(`__m/${comp}/${manifest.id}`, JSON.stringify(map)); const previous = await this.kvGet(`__ptr/${comp}`); await this.kvPut(`__ptr/${comp}`, manifest.id);
    return { previous: previous ? { release: previous } : null, handle: { release: manifest.id }, note: `كُتب ${missing.length} كائناً وتُخطّي ${hashes.length - missing.length} (محتوى مطابق)` };
  }
  async deployStaticWorker() {
    const ns = await this.kvNs(), src = readFileSync(path.join(ROOT, "platform/env/beta/static-worker.js"), "utf8"), fd = new FormData();
    fd.append("metadata", new Blob([JSON.stringify({ main_module: "index.js", compatibility_date: "2026-01-01", bindings: [{ type: "kv_namespace", name: "FILES", namespace_id: ns }, { type: "plain_text", name: "ENVIRONMENT", text: "beta" }] })], { type: "application/json" }));
    fd.append("index.js", new Blob([src], { type: "application/javascript+module" }), "index.js"); fd.append("overrides.js", new Blob(["export default {};"], { type: "application/javascript+module" }), "overrides.js");
    await this.cf("PUT", `/workers/scripts/${this.B.static_worker}`, fd); await this.cf("POST", `/workers/scripts/${this.B.static_worker}/subdomain`, { enabled: true, previews_enabled: false });
  }
  async activateComponent(comp, handle) {
    if (comp === "api" || comp === "gateway") { const v = handle?.version ?? (typeof handle === "string" ? handle : null); if (!v) return; const name = comp === "api" ? this.B.cf_worker : this.B.gateway_worker; await this.cf("POST", `/workers/scripts/${name}/deployments`, { strategy: "percentage", versions: [{ version_id: v, percentage: 100 }], annotations: { "workers/message": "beta-release rollback/activate" } }); return; }
    const rel = handle?.release ?? (typeof handle === "string" ? handle : null); if (rel) await this.kvPut(`__ptr/${comp}`, rel);
  }
  /* ── صحة ودخان ── */
  async getJson(url) { const r = await this.fetch(url); if (r.status !== 200) throw new Error(`${url} → ${r.status}`); return r.json(); }
  async health() {
    const out = {};
    try { const j = await this.getJson(`https://${this.B.api_host}/health`); out.api = { sha: j.sha, environment: j.environment, db_environment: j.db_environment, schema_hash: j.schema?.actual }; } catch { out.api = null; }
    try { const v = await this.currentVersion(this.B.gateway_worker), rel = this._verSha[v] ? [] : await this.listReleases(), hit = rel.find((r) => r.handles?.gateway?.version === v); out.gateway = { sha: this._verSha[v] ?? hit?.deployed_in?.gateway ?? null }; } catch { out.gateway = null; }
    try { const r = await this.fetch(`https://${this.B.app_host}/`, { method: "HEAD" }); out.ui = { release: r.headers.get("x-beta-ui") }; out.templates = { release: r.headers.get("x-beta-templates") }; } catch { out.ui = { release: null }; out.templates = { release: null }; }
    return out;
  }
  async smoke() {
    const c = [], g = async (name, url, test) => { try { const r = await this.fetch(url); c.push({ name, ok: await test(r) }); } catch (e) { c.push({ name: name + ": " + e.message, ok: false }); } };
    await g("api /health", `https://${this.B.api_host}/health`, async (r) => r.status === 200 && (await r.json()).environment === "beta");
    for (const p of ["/", "/admin.html", "/beta-start.html"]) await g("الواجهة " + p, `https://${this.B.app_host}${p}`, async (r) => r.status === 200);
    await g("الواجهة noindex", `https://${this.B.app_host}/`, async (r) => /noindex/.test(r.headers.get("x-robots-tag") || ""));
    return c;
  }
}
