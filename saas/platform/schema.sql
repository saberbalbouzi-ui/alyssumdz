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
-- وحدة اختبار A/B: التوزيع حتمي (هاش الزائر) فلا تخزين لكل زائر إلا بصمة المشاهدة/التحويل لمنع التكرار
CREATE TABLE IF NOT EXISTS ab_experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, key TEXT NOT NULL, name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, started_at TEXT NULL, UNIQUE (tenant_id, key)
);
CREATE TABLE IF NOT EXISTS ab_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, exp_id INTEGER NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE, vkey TEXT NOT NULL, weight INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL DEFAULT '{}', ord INTEGER NOT NULL,
  UNIQUE (exp_id, vkey)
);
CREATE TABLE IF NOT EXISTS ab_stats (exp_id INTEGER NOT NULL, vkey TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, conversions INTEGER NOT NULL DEFAULT 0, revenue INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (exp_id, vkey));
CREATE TABLE IF NOT EXISTS ab_seen (exp_id INTEGER NOT NULL, visitor_h TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (exp_id, visitor_h, kind));
-- وحدة الذكاء: حصة يومية لكل مستأجر
CREATE TABLE IF NOT EXISTS ai_usage (tenant_id INTEGER NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, day));
-- وحدة السلال المتروكة: رقم الزبون مشفّر (يُعرض للتاجر فقط) + بصمة للمطابقة؛ تُمحى بعد 30 يوماً
CREATE TABLE IF NOT EXISTS cr_carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, phone_h TEXT NOT NULL, phone_enc TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '', items TEXT NOT NULL DEFAULT '[]', total INTEGER NOT NULL DEFAULT 0, wilaya TEXT NOT NULL DEFAULT '', page TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (tenant_id, phone_h)
);
CREATE INDEX IF NOT EXISTS ix_cr_carts ON cr_carts (tenant_id, status, updated_at);

-- الدفع الإلكتروني (Chargily Pay): جلسات دفع لكل طلب + رابط استقبال الإشعارات
CREATE TABLE IF NOT EXISTS pay_checkouts (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, order_id TEXT NOT NULL, provider TEXT NOT NULL, ext_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'dzd', url TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (tenant_id, provider, ext_id));
CREATE INDEX IF NOT EXISTS ix_pay_order ON pay_checkouts (tenant_id, order_id, id);
CREATE TABLE IF NOT EXISTS pay_hooks (tenant_id INTEGER PRIMARY KEY REFERENCES pf_tenants(id) ON DELETE CASCADE, hook_id TEXT NOT NULL UNIQUE);

-- SMS: رصيد لكل مستأجر (وحدة = شريحة رسالة) + دفتر حركات + سجل إرسال (فريد لكل حدث/قالب)
CREATE TABLE IF NOT EXISTS sms_credits (tenant_id INTEGER PRIMARY KEY REFERENCES pf_tenants(id) ON DELETE CASCADE, balance INTEGER NOT NULL DEFAULT 0, low_notified INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sms_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, delta INTEGER NOT NULL, reason TEXT NOT NULL, ref TEXT, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_sms_ledger ON sms_ledger (tenant_id, id);
CREATE TABLE IF NOT EXISTS sms_log (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, event_id INTEGER NOT NULL, event_type TEXT NOT NULL, to_h TEXT NOT NULL, segments INTEGER NOT NULL, status TEXT NOT NULL, error TEXT, at INTEGER NOT NULL, UNIQUE (tenant_id, event_id, event_type));

-- التجارة (M7): كتالوج ومخزون وطلبات لكل مستأجر مع تحقق خادمي من الأسعار وحجز ذرّي للمخزون
CREATE TABLE IF NOT EXISTS cm_products (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, slug TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, cat TEXT NOT NULL DEFAULT '', free_ship INTEGER NOT NULL DEFAULT 0, offers TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL, PRIMARY KEY (tenant_id, slug));
CREATE TABLE IF NOT EXISTS cm_skus (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, slug TEXT NOT NULL, vkey TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL, stock INTEGER, active INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (tenant_id, slug, vkey));
CREATE TABLE IF NOT EXISTS cm_coupons (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, code TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0, min INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, from_at INTEGER, to_at INTEGER, PRIMARY KEY (tenant_id, code));
CREATE TABLE IF NOT EXISTS cm_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, ref TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'nouvelle', name TEXT NOT NULL DEFAULT '', phone_h TEXT NOT NULL, phone_enc TEXT NOT NULL, wilaya TEXT NOT NULL DEFAULT '', commune TEXT NOT NULL DEFAULT '', dtype TEXT NOT NULL DEFAULT 'home', desk TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, coupon TEXT NOT NULL DEFAULT '', flags TEXT NOT NULL DEFAULT '[]', mode TEXT NOT NULL DEFAULT 'observe', reserved INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (tenant_id, ref));
CREATE INDEX IF NOT EXISTS ix_cm_orders ON cm_orders (tenant_id, id);
-- الهَب المركزي للمصادر: متاجر خارجية (Shopify/WooCommerce/Google Sheets) تُسحب طلباتها للقراءة فقط. الأسرار والهاتف والعنوان مشفّرة.
CREATE TABLE IF NOT EXISTS src_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, kind TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}', secret_enc TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active', cursor TEXT NULL, last_sync_at INTEGER NULL, last_ok_at INTEGER NULL, last_error TEXT NULL, order_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_src_sources_t ON src_sources (tenant_id, status);
CREATE TABLE IF NOT EXISTS src_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, source_id INTEGER NOT NULL REFERENCES src_sources(id) ON DELETE CASCADE, ext_id TEXT NOT NULL, number TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, status TEXT NOT NULL, raw_status TEXT NOT NULL DEFAULT '', paid INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT '', pii_enc TEXT NOT NULL, phone_h TEXT NULL,
  city TEXT NOT NULL DEFAULT '', wilaya TEXT NOT NULL DEFAULT '', items TEXT NOT NULL DEFAULT '[]', total REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'DZD', sig TEXT NOT NULL, imported INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (source_id, ext_id)
);
CREATE INDEX IF NOT EXISTS ix_src_orders_feed ON src_orders (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_src_orders_phone ON src_orders (tenant_id, phone_h);
-- إنفاق الإعلانات (Meta/TikTok): حسابات بأسرار مشفّرة + إنفاق يومي لكل حملة بعملة الحساب (التحويل للدينار عند القراءة بـfx).
CREATE TABLE IF NOT EXISTS ad_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, provider TEXT NOT NULL, account_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD', fx REAL NOT NULL DEFAULT 1, config TEXT NOT NULL DEFAULT '{}', secret_enc TEXT NULL, status TEXT NOT NULL DEFAULT 'active',
  last_sync_at INTEGER NULL, last_ok_at INTEGER NULL, last_error TEXT NULL, created_at TEXT NOT NULL, UNIQUE (tenant_id, provider, account_id)
);
CREATE TABLE IF NOT EXISTS ad_spend (
  tenant_id INTEGER NOT NULL, account_id INTEGER NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE, day TEXT NOT NULL, campaign_id TEXT NOT NULL, campaign_name TEXT NOT NULL DEFAULT '',
  spend REAL NOT NULL DEFAULT 0, impressions INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (account_id, day, campaign_id)
);
CREATE INDEX IF NOT EXISTS ix_ad_spend_t ON ad_spend (tenant_id, day);

-- ربط Facebook بنقرة واحدة (OAuth): رمز مستخدم طويل الأمد مشفّر لكل اتصال + قائمة الحسابات الإعلانية التي يراها؛ الحسابات المربوطة تنسخ الرمز وتُجدَّد معه.
CREATE TABLE IF NOT EXISTS ad_oauth (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, provider TEXT NOT NULL DEFAULT 'meta', nonce TEXT NOT NULL UNIQUE,
  fb_user_id TEXT NOT NULL, fb_user_name TEXT NOT NULL DEFAULT '', token_enc TEXT NULL, expires_at INTEGER NOT NULL, accounts TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active', last_refresh_at INTEGER NULL, last_error TEXT NULL, warned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_ad_oauth_t ON ad_oauth (tenant_id);
CREATE INDEX IF NOT EXISTS ix_ad_oauth_fb ON ad_oauth (fb_user_id);

-- المحفظة والدفتر (Wallet & Ledger): قيد مزدوج غير قابل للتعديل. tenant_id=0 لحسابات النظام (المنصة/العالم الخارجي). المبالغ صحيحة بأصغر وحدة (دج، سنت).
CREATE TABLE IF NOT EXISTS wl_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, code TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'DZD', balance INTEGER NOT NULL DEFAULT 0, UNIQUE (tenant_id, code, currency)
);
CREATE TABLE IF NOT EXISTS wl_tx (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, ref TEXT NOT NULL, kind TEXT NOT NULL, memo TEXT NOT NULL DEFAULT '', order_id TEXT NULL, created_at INTEGER NOT NULL, UNIQUE (tenant_id, ref)
);
CREATE INDEX IF NOT EXISTS ix_wl_tx_t ON wl_tx (tenant_id, id);
CREATE TABLE IF NOT EXISTS wl_legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tx_id INTEGER NOT NULL REFERENCES wl_tx(id), account_id INTEGER NOT NULL REFERENCES wl_accounts(id), amount INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_wl_legs_tx ON wl_legs (tx_id);
CREATE TABLE IF NOT EXISTS wl_escrow (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, order_id TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'DZD', state TEXT NOT NULL DEFAULT 'held',
  fee INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, settled_at INTEGER NULL, UNIQUE (tenant_id, order_id)
);
CREATE TABLE IF NOT EXISTS wl_settings (tenant_id INTEGER PRIMARY KEY, settings TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wl_orders (tenant_id INTEGER NOT NULL, order_id TEXT NOT NULL, outcome TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (tenant_id, order_id));
CREATE TABLE IF NOT EXISTS wl_withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'DZD', method TEXT NOT NULL, dest_enc TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested',
  note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_wl_wd ON wl_withdrawals (tenant_id, id);
