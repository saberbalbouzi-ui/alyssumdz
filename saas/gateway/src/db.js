/** غلاف رفيع على D1 (أو أي كائن بواجهته): one/all/run + اكتشاف تعارض القيد الفريد. */
export class DB {
  constructor(d1) { this.d1 = d1; }
  stmt(sql, args) { return this.d1.prepare(sql).bind(...args); }
  async one(sql, ...args) { return (await this.stmt(sql, args).first()) ?? null; }
  async all(sql, ...args) { return (await this.stmt(sql, args).all()).results ?? []; }
  async run(sql, ...args) { const r = await this.stmt(sql, args).run(); return { id: r.meta?.last_row_id ?? 0, changes: r.meta?.changes ?? 0 }; }
  async val(sql, ...args) { const r = await this.one(sql, ...args); return r ? Object.values(r)[0] : null; }
  static isUnique(e) { return /UNIQUE|constraint/i.test(String(e?.message || e)); }
}
