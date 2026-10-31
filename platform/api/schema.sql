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
-- مخزن المفاتيح/الحسابات الرقمية (خزنة): السرّ مشفّر، والبصمة تمنع التكرار؛ التخصيص ذرّي (available ← sold) ويُسلَّم لكل طلب مرة واحدة
CREATE TABLE IF NOT EXISTS dg_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, sku TEXT NOT NULL, secret_enc TEXT NOT NULL, secret_h TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'available', order_ref TEXT NULL, claim TEXT NULL, sold_at INTEGER NULL, created_at INTEGER NOT NULL, UNIQUE (tenant_id, sku, secret_h)
);
CREATE INDEX IF NOT EXISTS ix_dg_keys ON dg_keys (tenant_id, sku, state, id);
CREATE INDEX IF NOT EXISTS ix_dg_keys_order ON dg_keys (tenant_id, order_ref);
-- طلبات تحوي منتجات رقمية: تُسجَّل عند order.created وتُسلَّم عند payment.confirmed (أي مزوّد: Chargily أو موافقة التاجر على دفع يدوي)
CREATE TABLE IF NOT EXISTS dg_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, order_ref TEXT NOT NULL, items TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', email_enc TEXT NULL,
  paid INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'awaiting', detail TEXT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER NULL, UNIQUE (tenant_id, order_ref)
);
CREATE INDEX IF NOT EXISTS ix_dg_orders ON dg_orders (tenant_id, state, id);
-- هاتف زبون الطلب الرقمي (مشفّر) للتسليم الآلي عبر واتساب؛ جدول مستقل لأن ALTER غير مدعوم في مسار النشر
CREATE TABLE IF NOT EXISTS dg_phone (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, order_ref TEXT NOT NULL, phone_enc TEXT NOT NULL, PRIMARY KEY (tenant_id, order_ref));
-- إعداد التسليم الآلي عبر واتساب للمنتجات الرقمية (يضبطه التاجر من اللوحة؛ الرمز مشفّر ولا يُعرض)
CREATE TABLE IF NOT EXISTS dg_settings (tenant_id INTEGER PRIMARY KEY REFERENCES pf_tenants(id) ON DELETE CASCADE, wa_auto INTEGER NOT NULL DEFAULT 0, wa_template TEXT NULL, wa_pid TEXT NULL, wa_token_enc TEXT NULL, updated_at INTEGER NOT NULL DEFAULT 0);
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
/* حصة التجربة الافتراضية للزبائن (عدّاد فقط — لا تُخزَّن الصور) */
CREATE TABLE IF NOT EXISTS tr_usage (tenant_id INTEGER NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, day));
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
/* جدول رسوم الشحن الموثوق (A-01): سعر المنزل/المكتب لكل (ولاية، بلدية — الفارغ = افتراضي الولاية) يدفعه التاجر من لوحته؛ يتحقق منه الخادم ولا يقبل ما يرسله المتصفح */
CREATE TABLE IF NOT EXISTS cm_ship (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, wilaya TEXT NOT NULL, commune TEXT NOT NULL DEFAULT '', home INTEGER NOT NULL DEFAULT 0, stop INTEGER NOT NULL DEFAULT 0, free_over INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, wilaya, commune));
CREATE TABLE IF NOT EXISTS cm_coupons (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, code TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0, min INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, from_at INTEGER, to_at INTEGER, PRIMARY KEY (tenant_id, code));
CREATE TABLE IF NOT EXISTS cm_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, ref TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'nouvelle', name TEXT NOT NULL DEFAULT '', phone_h TEXT NOT NULL, phone_enc TEXT NOT NULL, wilaya TEXT NOT NULL DEFAULT '', commune TEXT NOT NULL DEFAULT '', dtype TEXT NOT NULL DEFAULT 'home', desk TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, coupon TEXT NOT NULL DEFAULT '', flags TEXT NOT NULL DEFAULT '[]', mode TEXT NOT NULL DEFAULT 'observe', reserved INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (tenant_id, ref));
CREATE INDEX IF NOT EXISTS ix_cm_orders ON cm_orders (tenant_id, id);
-- التحقق الصارم (المرحلتان 0 و1): بيانات وصفية للمنتج، سجلّ تغيّر الأسعار الموقَّع (مهلة سعر قديم محدودة)، وسجلّ الحساب الخادمي (بلا بيانات شخصية: مرجع الطلب والمجاميع والأسباب فقط)
CREATE TABLE IF NOT EXISTS cm_meta (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, slug TEXT NOT NULL, digital INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, slug));
CREATE TABLE IF NOT EXISTS cm_price_hist (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, slug TEXT NOT NULL, vkey TEXT NOT NULL DEFAULT '', old_price INTEGER NOT NULL, new_price INTEGER NOT NULL, changed_at INTEGER NOT NULL, sig TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_cm_price_hist ON cm_price_hist (tenant_id, slug, vkey, id);
CREATE TABLE IF NOT EXISTS cm_calc (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, ref TEXT NOT NULL, at INTEGER NOT NULL, mode TEXT NOT NULL, scope TEXT NOT NULL, pay TEXT NOT NULL DEFAULT '', decision TEXT NOT NULL, reasons TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '[]', expected INTEGER NOT NULL DEFAULT 0, client INTEGER NOT NULL DEFAULT 0, trusted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, ref));
CREATE INDEX IF NOT EXISTS ix_cm_calc ON cm_calc (tenant_id, at);
-- دفتر حجز المخزون (A-05): سطر لكل (طلب، صنف) بحالة pending (محجوز بمهلة) ← committed (أُكّد الطلب فصار الحجز نهائياً) | released (أُعيد للمخزون: إلغاء أو انتهاء مهلة). كل انتقال بتحديث مشروط بالحالة فلا يتكرر خصم ولا إعادة.
CREATE TABLE IF NOT EXISTS cm_resv (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, ref TEXT NOT NULL, slug TEXT NOT NULL, vkey TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (tenant_id, ref, slug, vkey));
CREATE INDEX IF NOT EXISTS ix_cm_resv_due ON cm_resv (state, expires_at);
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

-- شحن المحفظة (إيداعات): chargily = حساب المنصة نفسه (سرّ في Worker لا مفتاح التاجر) يُعتمد بالويب هوك الموقَّع وتطابق المبلغ؛ ccp = حوالة بإثبات صورة يوافق عليها المزوّد يدوياً.
-- الحالات pending ← approved | rejected | failed (لا رجوع)؛ chargily_checkout_id فريد لمنع قيد مزدوج؛ proof صورة data URL لا تظهر في القوائم.
CREATE TABLE IF NOT EXISTS wl_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, amount INTEGER NOT NULL, payment_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  proof_image_path TEXT NULL, payer TEXT NOT NULL DEFAULT '', chargily_checkout_id TEXT NULL UNIQUE, checkout_url TEXT NULL, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_wl_dep ON wl_deposits (tenant_id, id);
CREATE INDEX IF NOT EXISTS ix_wl_dep_st ON wl_deposits (status, id);

-- ───────── السوق المشترك: دروبشيبينغ محلي / شبكة أفلييت B2B (وحدة marketplace) ─────────
-- mk_products: كتالوج المورّدين (مستأجر = متجر). سعر المورّد supplier_price هو ما يحصّله المورّد من الزبون عند التسليم ناقصاً العمولة؛ rrp سعر عام مقترح؛ commission مبلغ ثابت للقطعة يدفعه المورّد للأفلييت عند «تسليم».
--   الحالات: pending (بانتظار مراجعة المزوّد) | active | paused (أوقفه المورّد) | rejected | suspended (أوقفه المزوّد). stock NULL = غير محدود.
CREATE TABLE IF NOT EXISTS mk_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', images TEXT NOT NULL DEFAULT '[]', category TEXT NOT NULL DEFAULT '',
  supplier_price INTEGER NOT NULL, rrp INTEGER NOT NULL, commission INTEGER NOT NULL, stock INTEGER NULL, status TEXT NOT NULL DEFAULT 'pending', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS ix_mk_prod ON mk_products (status, id);
-- mk_imports: علاقة الاستيراد (marketplace_product_id) بين منتج المورّد ومنتج متجر الأفلييت وسعر بيعه
CREATE TABLE IF NOT EXISTS mk_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, mp_id INTEGER NOT NULL, slug TEXT NOT NULL, price INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, slug), UNIQUE (tenant_id, mp_id)
);
CREATE INDEX IF NOT EXISTS ix_mk_imp ON mk_imports (mp_id);
-- mk_orders: سطر طلب موجَّه (مرجع طلب الأفلييت ref × منتج). state = حالة العمولة: pending (محجوزة في escrow المورّد) | available (حُرّرت للأفلييت عند «مُسلَّم») | returned (عادت للمورّد) | return_claimed (ادّعى المورّد إرجاعاً بلا تأكيد ناقل — ينتظر قرار المزوّد) | rejected (رُفض الطلب).
CREATE TABLE IF NOT EXISTS mk_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL, affiliate_id INTEGER NOT NULL, supplier_id INTEGER NOT NULL, mp_id INTEGER NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL, unit_price INTEGER NOT NULL,
  supplier_price INTEGER NOT NULL, commission INTEGER NOT NULL, fee INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending', ship TEXT NOT NULL DEFAULT 'new', detail TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '', phone_enc TEXT NULL, wilaya TEXT NOT NULL DEFAULT '', commune TEXT NOT NULL DEFAULT '', dtype TEXT NOT NULL DEFAULT 'home', desk TEXT NOT NULL DEFAULT '', order_total INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (affiliate_id, ref, mp_id)
);
CREATE INDEX IF NOT EXISTS ix_mk_ord_sup ON mk_orders (supplier_id, id);
CREATE INDEX IF NOT EXISTS ix_mk_ord_aff ON mk_orders (affiliate_id, id);
CREATE TABLE IF NOT EXISTS mk_config (k TEXT PRIMARY KEY, v TEXT NOT NULL);

-- mk_sellers: ملف البائع في السوق (جملة/تجزئة) وطلبات انضمام الموردين الخارجيين (مراجعة يدوية؛ الاعتماد ينشئ مستأجراً بمفتاح محدود النطاق). tenant_id يُملأ عند الاعتماد أو للمورّد الداخلي.
CREATE TABLE IF NOT EXISTS mk_sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER, kind TEXT NOT NULL DEFAULT 'retail', name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '', phone_h TEXT NOT NULL DEFAULT '', phone_enc TEXT,
  wilaya TEXT NOT NULL DEFAULT '', reg_no TEXT NOT NULL DEFAULT '', about TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', note TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'portal', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mk_sel_t ON mk_sellers (tenant_id);
CREATE INDEX IF NOT EXISTS ix_mk_sel_s ON mk_sellers (status, id);
-- mk_images: صور منتجات المورّدين الخارجيين (بلا استضافة خاصة): JPEG/PNG/WebP ≤240KB بصيغة base64
CREATE TABLE IF NOT EXISTS mk_images (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);

-- ───────── وكالة التسويق بعلامة بيضاء (وحدة agency) ─────────
-- marketing_services: كتالوج المنصة (يديره المزوّد) بالدينار؛ agency_orders: طلبات التجار (السعر لقطة وقت الشراء). الحالات: pending ← processing ← delivered | rejected.
CREATE TABLE IF NOT EXISTS marketing_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'other',
  price INTEGER NOT NULL, needs_page INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 100, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agency_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, service_id INTEGER NOT NULL, service_name TEXT NOT NULL, price INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'DZD',
  store_name TEXT NOT NULL, client_email TEXT NOT NULL, facebook_page_url TEXT, status TEXT NOT NULL DEFAULT 'pending',
  invite_link TEXT, note TEXT, partner_state TEXT NOT NULL DEFAULT 'queued', partner_ref TEXT, partner_attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
  created_at TEXT NOT NULL, updated_at INTEGER NOT NULL, delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS ix_agency_orders_t ON agency_orders (tenant_id, id);
CREATE INDEX IF NOT EXISTS ix_agency_orders_s ON agency_orders (status, id);
CREATE TABLE IF NOT EXISTS agency_settings (id INTEGER PRIMARY KEY CHECK (id=1), config TEXT NOT NULL, secret_enc TEXT, updated_at INTEGER NOT NULL);

-- ───────── متجر التطبيقات (وحدة appstore): OAuth 2.0 + سوق + فوترة بتقاسم الإيراد + webhooks صادرة ─────────
CREATE TABLE IF NOT EXISTS app_developers (tenant_id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, developer_id INTEGER NOT NULL, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon_url TEXT,
  price INTEGER NOT NULL DEFAULT 0, billing TEXT NOT NULL DEFAULT 'once', webhook_url TEXT, webhook_secret_enc TEXT, events TEXT NOT NULL DEFAULT '[]', scopes TEXT NOT NULL DEFAULT '[]',
  redirect_uris TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', approved_once INTEGER NOT NULL DEFAULT 0, review_note TEXT, created_at TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_apps_dev ON apps (developer_id, id);
CREATE TABLE IF NOT EXISTS oauth_clients (id INTEGER PRIMARY KEY AUTOINCREMENT, app_id INTEGER NOT NULL, client_id TEXT NOT NULL UNIQUE, secret_hash TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
CREATE INDEX IF NOT EXISTS ix_oauth_clients_app ON oauth_clients (app_id);
CREATE TABLE IF NOT EXISTS app_installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, app_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', scopes TEXT NOT NULL DEFAULT '[]',
  price INTEGER NOT NULL DEFAULT 0, billing TEXT NOT NULL DEFAULT 'once', paid_once INTEGER NOT NULL DEFAULT 0, next_charge_at INTEGER, installed_at INTEGER, uninstalled_at INTEGER, UNIQUE (tenant_id, app_id)
);
CREATE INDEX IF NOT EXISTS ix_app_inst_due ON app_installations (status, next_charge_at);
CREATE TABLE IF NOT EXISTS oauth_codes (code_hash TEXT PRIMARY KEY, installation_id INTEGER NOT NULL, client_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, family TEXT);
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT, installation_id INTEGER NOT NULL, client_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, refresh_hash TEXT NOT NULL UNIQUE, family TEXT NOT NULL,
  scopes TEXT NOT NULL, expires_at INTEGER NOT NULL, refresh_expires_at INTEGER NOT NULL, refresh_used INTEGER NOT NULL DEFAULT 0, revoked_at INTEGER, created_at INTEGER NOT NULL, last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS ix_oauth_tok_inst ON oauth_access_tokens (installation_id);
CREATE INDEX IF NOT EXISTS ix_oauth_tok_fam ON oauth_access_tokens (family);
CREATE TABLE IF NOT EXISTS platform_revenues (
  id INTEGER PRIMARY KEY AUTOINCREMENT, installation_id INTEGER NOT NULL, app_id INTEGER NOT NULL, developer_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, period TEXT NOT NULL,
  gross INTEGER NOT NULL, fee INTEGER NOT NULL, net INTEGER NOT NULL, ref TEXT NOT NULL UNIQUE, state TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, settled_at INTEGER
);
CREATE INDEX IF NOT EXISTS ix_platform_rev_dev ON platform_revenues (developer_id, id);
CREATE TABLE IF NOT EXISTS app_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id INTEGER NOT NULL, installation_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, event_id INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_app_deliv_due ON app_deliveries (state, next_at);
CREATE TABLE IF NOT EXISTS app_settings (id INTEGER PRIMARY KEY CHECK (id=1), commission_pct INTEGER NOT NULL DEFAULT 20, updated_at INTEGER NOT NULL);

/* متجر التطبيقات — تقييمات التجار، استردادات الـ7 أيام، وعلامات الإدارة (مميّز/نطاق موثّق) */
CREATE TABLE IF NOT EXISTS app_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, stars INTEGER NOT NULL, comment TEXT, created_at INTEGER NOT NULL, UNIQUE (app_id, tenant_id)
);
CREATE TABLE IF NOT EXISTS app_refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT, revenue_id INTEGER NOT NULL UNIQUE, installation_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, amount INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_flags (
  app_id INTEGER PRIMARY KEY, featured INTEGER NOT NULL DEFAULT 0, domain_host TEXT, domain_checked_at INTEGER
);
-- الدفع اليدوي (BaridiMob/CCP): المبلغ المتوقع يُسجَّل من order.created الموثَّق، والزبون يرفع إثباتاً (صورة مصغّرة) ثم يوافق التاجر يدوياً
CREATE TABLE IF NOT EXISTS pay_expect (tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, order_id TEXT NOT NULL, amount INTEGER NOT NULL, method TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY (tenant_id, order_id));
CREATE TABLE IF NOT EXISTS pay_manual (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES pf_tenants(id) ON DELETE CASCADE, order_id TEXT NOT NULL, method TEXT NOT NULL, amount INTEGER NOT NULL, proof TEXT NULL, payer TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'pending', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, decided_at INTEGER NULL, decided_by TEXT NULL
);
CREATE INDEX IF NOT EXISTS ix_pay_manual ON pay_manual (tenant_id, state, id);
CREATE INDEX IF NOT EXISTS ix_pay_manual_order ON pay_manual (tenant_id, order_id);
