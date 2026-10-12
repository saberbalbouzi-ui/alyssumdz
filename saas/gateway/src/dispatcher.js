import { hmacHex, nowStr, safeHttpsUrl } from "./util.js";
const BACKOFF = [60, 300, 1800, 7200, 43200];
/** إرسال أحداث الحالة إلى webhook العميل: توقيع HMAC بطابع زمني + إعادة محاولة بتباعد. */
export class Dispatcher {
  constructor(db, tenants, fetchFn = fetch, clock = () => Date.now()) { this.db = db; this.tenants = tenants; this.fetchFn = fetchFn; this.clock = clock; }
  async enqueue(tenantId, orderId, type, data, plan) {
    if (!plan?.webhooks || !(await this.tenants.webhook(tenantId))) return;
    const now = Math.floor(this.clock() / 1000);
    await this.db.run("INSERT INTO gw_events (tenant_id,order_id,type,payload,state,attempts,next_at,created_at) VALUES (?,?,?,?,?,0,?,?)", tenantId, orderId, type, JSON.stringify(data), "pending", now, nowStr(this.clock()));
  }
  static async sign(secret, ts, body) { return `t=${ts},v1=${await hmacHex(secret, ts + "." + body)}`; }
  async deliverDue(limit = 25) {
    const rows = await this.db.all("SELECT * FROM gw_events WHERE state='pending' AND next_at<=? ORDER BY id LIMIT ?", Math.floor(this.clock() / 1000), limit); let sent = 0, failed = 0;
    for (const e of rows) {
      const wh = await this.tenants.webhook(e.tenant_id);
      if (!wh) { await this.db.run("UPDATE gw_events SET state='failed', last_error='no_webhook' WHERE id=?", e.id); continue; }
      const body = JSON.stringify({ id: "evt_" + e.id, type: e.type, created: Math.floor(Date.parse(e.created_at.replace(" ", "T") + "Z") / 1000), data: JSON.parse(e.payload) });
      const ts = Math.floor(this.clock() / 1000); let status = 0, err = "";
      if (!safeHttpsUrl(wh.url)) err = "insecure_url";
      else { try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
        const r = await this.fetchFn(wh.url, { method: "POST", redirect: "manual", signal: ctl.signal, headers: { "Content-Type": "application/json", "X-Gateway-Signature": await Dispatcher.sign(wh.secret, ts, body), "X-Gateway-Event": e.type, "User-Agent": "shipgw-webhook/1" }, body });
        clearTimeout(t); status = r.status; } catch (x) { err = "network"; } }
      const n = e.attempts + 1;
      if (status >= 200 && status < 300) { await this.db.run("UPDATE gw_events SET state='sent', attempts=?, last_error=NULL WHERE id=?", n, e.id); sent++; continue; }
      failed++; const msg = status ? "HTTP " + status : err || "network";
      if (n > BACKOFF.length) await this.db.run("UPDATE gw_events SET state='failed', attempts=?, last_error=? WHERE id=?", n, msg, e.id);
      else await this.db.run("UPDATE gw_events SET attempts=?, next_at=?, last_error=? WHERE id=?", n, ts + BACKOFF[n - 1], msg, e.id);
    }
    return { sent, failed };
  }
}
