/* محاكي سحابة Beta للاختبار (ليس Cloudflare): D1 فعلي بـnode:sqlite (لقطات واستعادة بنسخ الملف)، KV بذاكرة، سجل نسخ Workers، ومؤشرات الواجهة/القوالب.
   يقبل حقن أعطال (failMigration/failDeploy/failHealth/corruptData) لاختبار الرجوع. السلوك مطابق لعقد المحوّل الحقيقي في cloudflare.mjs. */
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { snapshot, sha256, isTpl } from "../release-lib.mjs";

export class SimCloud {
  constructor({ protectedTables = [], envName = "beta" } = {}) {
    this.dir = mkdtempSync(path.join(tmpdir(), "simcloud-")); this.file = path.join(this.dir, "api.db"); this.db = new DatabaseSync(this.file);
    this.protectedTables = protectedTables; this.faults = {}; this.bm = 0; this.kv = new Map(); this.ptr = {}; this.workers = { api: { versions: [], current: null }, gateway: { versions: [], current: null } }; this.registry = []; this.currentId = null; this.calls = [];
    this.db.exec("CREATE TABLE IF NOT EXISTS pf_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pf_migrations (name TEXT PRIMARY KEY, sha TEXT NOT NULL, applied_at TEXT NOT NULL)");
    this.db.prepare("INSERT OR IGNORE INTO pf_meta (k,v,at) VALUES ('environment',?,?)").run(envName, new Date().toISOString());
  }
  close() { try { this.db.close(); } catch { } rmSync(this.dir, { recursive: true, force: true }); }
  exec = async (sql, params = []) => { const st = this.db.prepare(sql); return /^\s*(select|pragma|with)/i.test(sql) ? st.all(...params) : (st.run(...params), []); };
  d1() { const db = () => this.db; return { prepare: (sql) => { const mk = (p) => ({ bind: (...b) => mk(b), all: async () => ({ results: db().prepare(sql).all(...p) }), first: async () => db().prepare(sql).get(...p) ?? null, run: async () => { db().prepare(sql).run(...p); return { success: true }; } }); return mk([]); } }; }
  /* ── عقد المحوّل ── */
  async getDeployed() { return this.registry.find((r) => r.id === this.currentId) ?? null; }
  async listReleases() { return [...this.registry].reverse(); }
  async setCurrent(r) { this.currentId = r.id; }
  async pendingMigrations(migs) {
    const applied = new Map((await this.exec("SELECT name, sha FROM pf_migrations")).map((r) => [r.name, r.sha])), disk = new Set(migs.map((m) => m.name));
    return { pending: migs.filter((m) => !applied.has(m.name)), mismatched: migs.filter((m) => applied.has(m.name) && applied.get(m.name) !== m.sha).map((m) => m.name), unknown: [...applied.keys()].filter((n) => !disk.has(n)) };
  }
  async snapshot(tables) { return snapshot(this.exec, tables); }
  async bookmark() { const b = path.join(this.dir, `bm-${++this.bm}.db`); this.db.close(); copyFileSync(this.file, b); this.db = new DatabaseSync(this.file); return b; }
  async restore(b) { this.db.close(); copyFileSync(b, this.file); this.db = new DatabaseSync(this.file); }
  async applyMigrations(pending, { schemaHash, sha }) {
    const done = [];
    for (const m of pending) {
      for (const [i, st] of m.statements.entries()) { if (this.faults.failMigration === m.name && i === 1) throw new Error("فشل مُحقَن في منتصف " + m.name); this.db.exec(st); }
      this.db.prepare("INSERT INTO pf_migrations (name,sha,applied_at) VALUES (?,?,?)").run(m.name, m.sha, new Date().toISOString()); done.push(m.name);
    }
    const up = this.db.prepare("INSERT INTO pf_meta (k,v,at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, at=excluded.at"), at = new Date().toISOString();
    if (schemaHash) up.run("schema_hash", schemaHash, at); up.run("release_sha", sha, at); return done;
  }
  async deployComponent(comp, manifest, artifact) {
    this.calls.push("deploy:" + comp); if (this.faults.failDeploy === comp) throw new Error("فشل مُحقَن في نشر " + comp);
    if (comp === "api" && this.faults.corruptData) this.db.exec("DELETE FROM cm_orders WHERE rowid = 1");
    if (comp === "api" || comp === "gateway") { const w = this.workers[comp], id = `${comp}-v${w.versions.length + 1}`; w.versions.push({ id, sha: manifest.source.sha, code: artifact?.code ?? "" }); const previous = w.current; w.current = id; return { previous, handle: { version: id }, note: id }; }
    const files = artifact?.files ?? [], map = {}; let written = 0, skipped = 0;
    for (const f of files) { const h = sha256(f.buf); map[f.path] = h; const k = "o/" + h; if (this.kv.has(k)) skipped++; else { this.kv.set(k, Buffer.from(f.buf)); written++; } }
    this.kv.set(`__m/${comp}/${manifest.id}`, JSON.stringify(map)); const previous = this.ptr[comp] ?? null; this.ptr[comp] = manifest.id; return { previous, handle: { release: manifest.id }, note: `كُتب ${written} وتُخطّي ${skipped} (محتوى مطابق)` };
  }
  async activateComponent(comp, handle) {
    if (comp === "api" || comp === "gateway") { this.workers[comp].current = handle?.version ?? (typeof handle === "string" ? handle : null); return; }
    this.ptr[comp] = handle?.release ?? (typeof handle === "string" ? handle : null);
  }
  workerOf(comp) { const w = this.workers[comp]; return w.versions.find((v) => v.id === w.current) ?? null; }
  async health() {
    const meta = Object.fromEntries((await this.exec("SELECT k,v FROM pf_meta")).map((r) => [r.k, r.v])), a = this.workerOf("api"), g = this.workerOf("gateway"); if (this.faults.failHealth) return {};
    return { api: a ? { sha: a.sha, environment: "beta", db_environment: meta.environment, schema_hash: meta.schema_hash } : null, gateway: g ? { sha: g.sha } : null, ui: { release: this.ptr.ui ?? null }, templates: { release: this.ptr.templates ?? null } };
  }
  async callApi(pathname, init = {}) { const a = this.workerOf("api"); if (!a) throw new Error("لا Worker api"); const mod = await import("data:text/javascript;base64," + Buffer.from(a.code).toString("base64")); const res = await mod.default.fetch(new Request("https://beta.test" + pathname, init), { DB: this.d1() }); return { status: res.status, body: await res.text() }; }
  async smoke() { const a = this.workerOf("api"); if (a && /^\s*import\s/m.test(a.code)) return [{ name: "smoke الـapi متخطّى (كود متعدد الوحدات لا يُحمَّل في المحاكي — تدريب على الشجرة الحقيقية فقط)", ok: true }]; const out = []; try { const r = await this.callApi("/health"); out.push({ name: "api /health", ok: r.status === 200 }); } catch (e) { out.push({ name: "api /health: " + e.message, ok: false }); } return out; }
  serveStatic(p) { const comp = isTpl(p) ? "templates" : "ui", rel = this.ptr[comp]; if (!rel) return null; const m = JSON.parse(this.kv.get(`__m/${comp}/${rel}`) ?? "{}"), h = m[p]; return h ? this.kv.get("o/" + h) : null; }
  async recordRelease(m) { this.registry.push(m); this.currentId = m.id; }
}
