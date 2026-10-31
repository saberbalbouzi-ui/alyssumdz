/** حدود الاستعمال: نوافذ في gw_rl وعدّادات يومية في gw_usage (أساس الفوترة). */
export class Limiter {
  constructor(db, clock = () => Date.now()) { this.db = db; this.clock = clock; }
  /** نافذة ذرّية: إدراج مشروط بجملة SQL واحدة فلا تتجاوز الطلبات المتزامنة السقف */
  async window(key, max, win, now = Math.floor(this.clock() / 1000)) {
    const ins = await this.db.run("INSERT INTO gw_rl (k,t) SELECT ?,? WHERE (SELECT COUNT(*) FROM gw_rl WHERE k=? AND t>?) < ?", key, now, key, now - win, max);
    if (ins.changes === 0) { const r = await this.db.one("SELECT MIN(t) AS o FROM gw_rl WHERE k=? AND t>?", key, now - win); return Math.max(1, (r?.o ?? now) + win - now); }
    if (Math.random() < 0.01) await this.db.run("DELETE FROM gw_rl WHERE t<?", now - 7200);
    return null;
  }
  async consume(tenant, plan, mode, kind) {
    const now = Math.floor(this.clock() / 1000), tid = tenant.id, win = kind === "track" ? 60 : 3600;
    const max = mode === "test" ? 60 : kind === "track" ? plan.track_min : plan.orders_hour;
    const w = await this.window(`t${tid}:${kind}`, max, win, now); if (w !== null) return w;
    if (kind === "order" && mode === "live") {
      const n = await this.db.val("SELECT n FROM gw_usage WHERE tenant_id=? AND day=? AND kind='order'", tid, this.day());
      if ((n ?? 0) >= plan.orders_day) { const d = new Date(this.clock()); d.setUTCHours(24, 0, 0, 0); return Math.max(60, Math.floor(d.getTime() / 1000) - now); }
    }
    return null;
  }
  day() { return new Date(this.clock()).toISOString().slice(0, 10); }
  count(tenantId, kind) { return this.db.run("INSERT INTO gw_usage (tenant_id,day,kind,n) VALUES (?,?,?,1) ON CONFLICT(tenant_id,day,kind) DO UPDATE SET n=n+1", tenantId, this.day(), kind); }
  async today(tenantId) { const rows = await this.db.all("SELECT kind,n FROM gw_usage WHERE tenant_id=? AND day=?", tenantId, this.day()); return Object.fromEntries(rows.map((r) => [r.kind, r.n])); }
}
