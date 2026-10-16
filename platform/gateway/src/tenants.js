import { nowStr, randHex, sha256Hex } from "./util.js";
/** المستأجرون ومفاتيح API والخطط. المفتاح الصريح يُعرض مرة واحدة؛ تُخزَّن بصمته sha256 فقط. */
export class Tenants {
  constructor(db, vault) { this.db = db; this.vault = vault; }
  async createTenant(name, email, plan = "free", siteRef = null) {
    if (!(await this.plan(plan))) throw new Error("خطة غير معروفة: " + plan);
    const r = await this.db.run("INSERT INTO gw_tenants (name,email,site_ref,plan,status,created_at) VALUES (?,?,?,?,?,?)", String(name).slice(0, 120), String(email).slice(0, 160), siteRef, plan, "active", nowStr());
    return r.id;
  }
  async issueKey(tenantId, mode = "live", label = "") {
    if (!["live", "test"].includes(mode)) throw new Error("mode: live|test");
    const key = `gk_${mode}_${randHex(20)}`;
    await this.db.run("INSERT INTO gw_keys (tenant_id,prefix,key_hash,mode,label,created_at) VALUES (?,?,?,?,?,?)", tenantId, key.slice(0, 12), await sha256Hex(key), mode, String(label).slice(0, 60), nowStr());
    return key;
  }
  revokeKey(id) { return this.db.run("UPDATE gw_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL", nowStr(), id); }
  setStatus(id, status) { return this.db.run("UPDATE gw_tenants SET status=? WHERE id=?", status, id); }
  async setPlan(id, plan) { if (!(await this.plan(plan))) throw new Error("خطة غير معروفة: " + plan); return this.db.run("UPDATE gw_tenants SET plan=? WHERE id=?", plan, id); }
  plan(id) { return this.db.one("SELECT * FROM gw_plans WHERE id=?", id); }
  async authenticate(bearer) {
    if (!/^gk_(live|test)_[0-9a-f]{40}$/.test(bearer)) return null;
    const k = await this.db.one("SELECT * FROM gw_keys WHERE key_hash=? AND revoked_at IS NULL", await sha256Hex(bearer)); if (!k) return null;
    const t = await this.db.one("SELECT * FROM gw_tenants WHERE id=?", k.tenant_id); if (!t || t.status !== "active") return null;
    await this.db.run("UPDATE gw_keys SET last_used_at=? WHERE id=?", nowStr(), k.id);
    return { tenant: t, key: k, plan: await this.plan(t.plan) };
  }
  async setWebhook(tenantId, url) {
    const secret = "whsec_" + randHex(24);
    await this.db.run("UPDATE gw_tenants SET webhook_url=?, webhook_secret_enc=? WHERE id=?", url, await this.vault.encrypt(secret, "gw-webhook:" + tenantId), tenantId); return secret;
  }
  clearWebhook(id) { return this.db.run("UPDATE gw_tenants SET webhook_url=NULL, webhook_secret_enc=NULL WHERE id=?", id); }
  async webhook(tenantId) {
    const r = await this.db.one("SELECT webhook_url, webhook_secret_enc FROM gw_tenants WHERE id=?", tenantId);
    if (!r?.webhook_url || !r.webhook_secret_enc) return null;
    return { url: r.webhook_url, secret: await this.vault.decrypt(r.webhook_secret_enc, "gw-webhook:" + tenantId) };
  }
}
