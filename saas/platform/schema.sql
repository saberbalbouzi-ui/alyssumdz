-- مخطط منصة API (Cloudflare D1). كله IF NOT EXISTS؛ يُطبَّق عند كل نشر.
-- النواة: مستأجرون ومفاتيح بنطاقات (scopes) وصندوق أحداث.
CREATE TABLE IF NOT EXISTS pf_tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, site_ref TEXT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active',
  settings TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pf_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, last_used_at TEXT NULL, revoked_at TEXT NULL
);
CREATE TABLE IF NOT EXISTS pf_events (          -- صندوق الأحداث (outbox): تعالجه الوحدات في cron
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pf_events_due ON pf_events (state, next_at);
CREATE TABLE IF NOT EXISTS pf_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NULL, detail TEXT NULL);
CREATE TABLE IF NOT EXISTS pf_rl (k TEXT NOT NULL, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_pf_rl ON pf_rl (k, t);
-- وحدة مكافحة الاحتيال: لا يُخزَّن رقم هاتف ولا IP صريحاً أبداً (بصمات HMAC بسرّ الخادم)
CREATE TABLE IF NOT EXISTS fr_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, phone_h TEXT NOT NULL, device_h TEXT NULL, ip_h TEXT NULL,
  total INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL, level TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_fr_checks_phone ON fr_checks (phone_h, at);
CREATE INDEX IF NOT EXISTS ix_fr_checks_device ON fr_checks (device_h, at);
CREATE INDEX IF NOT EXISTS ix_fr_checks_ip ON fr_checks (ip_h, at);
CREATE TABLE IF NOT EXISTS fr_reports (          -- بلاغات المستأجرين عن زبون سيّئ (مشتركة بالبصمة فقط)
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, phone_h TEXT NOT NULL, reason TEXT NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL,
  UNIQUE (tenant_id, phone_h, reason, day)
);
CREATE INDEX IF NOT EXISTS ix_fr_reports_phone ON fr_reports (phone_h);
