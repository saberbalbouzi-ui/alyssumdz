-- مخطط بوابة الشحن على Cloudflare D1 (SQLite). يُطبَّق مرة واحدة؛ كله IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS gw_plans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  orders_hour INTEGER NOT NULL, orders_day INTEGER NOT NULL, track_min INTEGER NOT NULL,
  vault_max INTEGER NOT NULL DEFAULT 0, webhooks INTEGER NOT NULL DEFAULT 0, price_dzd INTEGER NULL
);
CREATE TABLE IF NOT EXISTS gw_tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, site_ref TEXT NULL,   -- site_ref = saas_sites.id للمنصة
  plan TEXT NOT NULL REFERENCES gw_plans(id), status TEXT NOT NULL DEFAULT 'active',
  webhook_url TEXT NULL, webhook_secret_enc TEXT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_gw_tenants_site ON gw_tenants (site_ref) WHERE site_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS gw_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES gw_tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, mode TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, last_used_at TEXT NULL, revoked_at TEXT NULL
);
CREATE TABLE IF NOT EXISTS gw_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE,
  tenant_id INTEGER NOT NULL REFERENCES gw_tenants(id) ON DELETE CASCADE, carrier_code TEXT NOT NULL,
  credentials_enc TEXT NOT NULL, key_id TEXT NOT NULL, base_url TEXT NULL, webhook_token_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, carrier_code)
);
CREATE TABLE IF NOT EXISTS gw_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES gw_tenants(id) ON DELETE CASCADE,
  courier TEXT NOT NULL, reference TEXT NOT NULL, tracking TEXT NULL, status TEXT NOT NULL DEFAULT 'pending', raw_status TEXT NULL,
  via TEXT NOT NULL DEFAULT 'inline',
  request_hash TEXT NOT NULL, response_json TEXT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, courier, reference), UNIQUE (tenant_id, courier, tracking)
);
CREATE INDEX IF NOT EXISTS ix_gw_orders_status ON gw_orders (via, status);
CREATE TABLE IF NOT EXISTS gw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, order_id INTEGER NOT NULL,
  type TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_gw_events_due ON gw_events (state, next_at);
CREATE TABLE IF NOT EXISTS gw_usage (
  tenant_id INTEGER NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, day, kind)
);
CREATE TABLE IF NOT EXISTS gw_audit (   -- سجلّ تدقيق إجراءات الإدارة (بلا أسرار): من فعل ماذا ومتى
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NULL, detail TEXT NULL
);
CREATE TABLE IF NOT EXISTS gw_rl (k TEXT NOT NULL, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_gw_rl ON gw_rl (k, t);
CREATE TABLE IF NOT EXISTS gw_profiles (   -- ملف معايرة حساب الشركة (يُبنى عند أول ربط ويصحّح البلديات والمكاتب والحالات لهذا الحساب)
  connection_id INTEGER PRIMARY KEY, profile_json TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO gw_plans (id,name,orders_hour,orders_day,track_min,vault_max,webhooks,price_dzd) VALUES
 ('free','مجانية',20,100,30,0,0,NULL),
 ('pro','احترافية',200,2000,120,5,1,NULL),
 ('business','أعمال',1000,10000,600,50,1,NULL);
