-- النسخة SQLite من المخطط (الاختبارات والاستضافات الصغيرة). المعنى نفسه كما في schema.sql.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS user_carriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  carrier_code TEXT NOT NULL,
  credentials_enc TEXT NOT NULL,
  key_id TEXT NOT NULL,
  base_url TEXT NULL,
  webhook_token_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, carrier_code)
);
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id INTEGER NOT NULL REFERENCES user_carriers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  order_ref TEXT NOT NULL,
  carrier_code TEXT NOT NULL,
  tracking TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_status TEXT NULL,
  cod_amount INTEGER NOT NULL DEFAULT 0,
  last_event_at TEXT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (connection_id, order_ref),
  UNIQUE (connection_id, tracking)
);
CREATE INDEX IF NOT EXISTS ix_user_status ON shipments (user_id, status);
CREATE TABLE IF NOT EXISTS shipment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  raw_status TEXT NOT NULL,
  status TEXT NOT NULL,
  event_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
