/* مخطط حالة المزامنة + محوّلات قاعدة (D1 binding | D1 REST | node:sqlite للاختبار). كلها بواجهة واحدة: exec/run/all/get.
   الجداول: sync_meta (مؤشرات/قفل)، sync_items (الحالة المطبَّقة لكل مسار + رقم revision)، sync_events (سجل Outbox/Event Log لكل عملية، idempotent)،
   sync_runs (سجل كل تشغيل)، sync_trash (محذوفات قابلة للاستعادة: الكائن يبقى في KV تحت o/<sha>). */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sync_meta (k TEXT PRIMARY KEY, v TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS sync_items (path TEXT PRIMARY KEY, comp TEXT NOT NULL, cls TEXT NOT NULL, src_blob TEXT, out_sha TEXT, rev INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, src_commit TEXT, notes TEXT, reason TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS sync_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, ts TEXT, path TEXT NOT NULL, op TEXT NOT NULL, src_blob TEXT, out_sha TEXT, rev INTEGER, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, src_commit TEXT, idem TEXT UNIQUE)`,
  `CREATE INDEX IF NOT EXISTS sync_events_path ON sync_events (path, seq)`,
  `CREATE TABLE IF NOT EXISTS sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, head TEXT, prev_head TEXT, planned INTEGER, applied INTEGER, failed INTEGER, quarantined INTEGER, diffs INTEGER, ms INTEGER, error TEXT, commits TEXT)`,
  `CREATE TABLE IF NOT EXISTS sync_trash (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, comp TEXT, out_sha TEXT NOT NULL, rev INTEGER, src_commit TEXT, deleted_at TEXT)`,
];

export class D1BindingDb {
  constructor(d1) { this.d = d1; }
  async exec(sql) { await this.d.prepare(sql).run(); }
  async run(sql, p = []) { const r = await this.d.prepare(sql).bind(...p).run(); return { id: r.meta?.last_row_id ?? null, changes: r.meta?.changes ?? 0 }; }
  async all(sql, p = []) { return (await this.d.prepare(sql).bind(...p).all()).results ?? []; }
  async get(sql, p = []) { return (await this.all(sql, p))[0] ?? null; }
}
/** D1 عبر REST (للـCLI/الاختبارات الحيّة): الحساب مفروض أن يكون حساب Beta (يفحصه المستدعي) */
export class D1RestDb {
  constructor({ acc, dbId, token = null, fetchFn = fetch }) { this.u = `https://api.cloudflare.com/client/v4/accounts/${acc}/d1/database/${dbId}/query`; this.t = token; this.f = (...a) => fetchFn(...a); }
  async q(sql, params = []) {
    const r = await this.f(this.u, { method: "POST", headers: { "Content-Type": "application/json", ...(this.t ? { Authorization: "Bearer " + this.t } : {}) }, body: JSON.stringify(params.length ? { sql, params } : { sql }) }); const j = await r.json().catch(() => ({}));
    if (!j.success) throw new Error("d1: " + JSON.stringify(j.errors ?? j).slice(0, 200)); return j.result?.[0] ?? { results: [], meta: {} };
  }
  async exec(sql) { await this.q(sql); }
  async run(sql, p = []) { const r = await this.q(sql, p); return { id: r.meta?.last_row_id ?? null, changes: r.meta?.changes ?? 0 }; }
  async all(sql, p = []) { return (await this.q(sql, p)).results ?? []; }
  async get(sql, p = []) { return (await this.all(sql, p))[0] ?? null; }
}
export async function migrate(db) { for (const s of SCHEMA) await db.exec(s); }
export const meta = {
  async get(db, k, d = null) { const r = await db.get("SELECT v FROM sync_meta WHERE k=?", [k]); return r ? r.v : d; },
  async set(db, k, v) { await db.run("INSERT INTO sync_meta (k,v,updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at", [k, v == null ? null : String(v), new Date().toISOString()]); },
};
