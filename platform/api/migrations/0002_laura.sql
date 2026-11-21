-- LAURA (الوكيل التنفيذي): إجراءات بانتظار موافقة المستخدم الصريحة قبل أي تعديل. تُنفَّذ مرة واحدة (claim ذرّي) وتُحذف بعد يوم.
CREATE TABLE IF NOT EXISTS lr_pending (
  id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, key_id INTEGER NOT NULL, actor_sub TEXT NOT NULL DEFAULT '',
  tool TEXT NOT NULL, args TEXT NOT NULL, args_hash TEXT NOT NULL, summary TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'ar',
  state TEXT NOT NULL DEFAULT 'pending', result TEXT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, decided_at INTEGER NULL
);
CREATE INDEX IF NOT EXISTS ix_lr_pending ON lr_pending (tenant_id, state, expires_at);
