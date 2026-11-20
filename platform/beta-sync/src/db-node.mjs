/* محوّل node:sqlite لنفس واجهة D1BindingDb — للاختبارات والتشغيل المحلي فقط (لا يُضمَّن في الـWorker). */
import { DatabaseSync } from "node:sqlite";
export class NodeSqliteDb {
  constructor(file = ":memory:") { this.db = new DatabaseSync(file); }
  async exec(sql) { this.db.exec(sql); }
  async run(sql, p = []) { const r = this.db.prepare(sql).run(...p); return { id: Number(r.lastInsertRowid), changes: Number(r.changes) }; }
  async all(sql, p = []) { return this.db.prepare(sql).all(...p).map((x) => ({ ...x })); }
  async get(sql, p = []) { const r = this.db.prepare(sql).get(...p); return r ? { ...r } : null; }
  close() { this.db.close(); }
}
