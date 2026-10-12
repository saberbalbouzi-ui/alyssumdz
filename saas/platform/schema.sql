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
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, ext_id TEXT NULL, done TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pf_events_due ON pf_events (state, next_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pf_events_ext ON pf_events (tenant_id, ext_id) WHERE ext_id IS NOT NULL;   -- منع تكرار الحدث نفسه
CREATE TABLE IF NOT EXISTS pf_integrations (     -- إعداد كل مزوّد خارجي لكل مستأجر؛ الأسرار مشفّرة (AES-GCM بـaad=مستأجر|مزوّد)
  tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, provider TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}', secret_enc TEXT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, provider)
);
CREATE TABLE IF NOT EXISTS pf_idem (             -- Idempotency-Key للطلبات المعدِّلة (تطبيق الجوال يعيد الإرسال عند ضعف الشبكة)
  tenant_id INTEGER NOT NULL, k TEXT NOT NULL, hash TEXT NOT NULL, status INTEGER NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (tenant_id, k)
);
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
-- وحدة CAPI: سجلّ الإرسال (بلا بيانات شخصية)
CREATE TABLE IF NOT EXISTS cp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, provider TEXT NOT NULL, event_name TEXT NOT NULL, event_id TEXT NOT NULL, http INTEGER NOT NULL, ok INTEGER NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cp_log ON cp_log (tenant_id, id);
-- وحدة hooks: webhooks صادرة موقَّعة (Zapier/Make/أي خادم)
CREATE TABLE IF NOT EXISTS hk_endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, url TEXT NOT NULL, events TEXT NOT NULL, secret_enc TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hk_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, endpoint_id INTEGER NOT NULL, event_id INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_hk_due ON hk_deliveries (state, next_at);
-- وحدة المنتجات الرقمية: الأصول، المنح (روابط تنزيل بمدة وعدد محدودين). الرمز يُخزَّن مجزّأً، والبريد لا يُخزَّن (بصمة فقط)
CREATE TABLE IF NOT EXISTS dg_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, sku TEXT NOT NULL, name TEXT NOT NULL,
  location_enc TEXT NOT NULL, file_name TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'application/octet-stream', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
  UNIQUE (tenant_id, sku)
);
CREATE TABLE IF NOT EXISTS dg_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, asset_id INTEGER NOT NULL REFERENCES dg_assets(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE,
  order_ref TEXT NULL, email_h TEXT NULL, expires_at INTEGER NOT NULL, max_downloads INTEGER NOT NULL, downloads INTEGER NOT NULL DEFAULT 0, last_download_at INTEGER NULL,
  created_at TEXT NOT NULL, revoked_at TEXT NULL, UNIQUE (tenant_id, order_ref, asset_id)
);
-- وحدة WhatsApp: ربط المستلم بالطلب لمطابقة ردّ «نعم/لا»، ونقطة استقبال لكل مستأجر
CREATE TABLE IF NOT EXISTS wa_hooks (tenant_id INTEGER PRIMARY KEY REFERENCES pf_tenants(id) ON DELETE CASCADE, hook_id TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS wa_sent (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, to_h TEXT NOT NULL, order_id TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_wa_sent ON wa_sent (tenant_id, to_h, at);
