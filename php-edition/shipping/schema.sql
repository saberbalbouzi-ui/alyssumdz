-- مخطط MySQL/MariaDB (InnoDB, utf8mb4) لوحدة تجميع شركات التوصيل.
-- للـSQLite استعمل schema.sqlite.sql. المفاتيح تُخزَّن مشفَّرة AES-256-GCM (انظر CredentialVault) — لا نص صريح أبداً.

CREATE TABLE IF NOT EXISTS user_carriers (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id        CHAR(24)     NOT NULL,                 -- معرّف عام عشوائي يظهر في رابط الـwebhook (لا يكشف user_id)
  user_id          BIGINT UNSIGNED NOT NULL,              -- التاجر/المتجر
  carrier_code     VARCHAR(32)  NOT NULL,                 -- yalidine, zrexpress, maystro, noest, ecotrack, dhd, …
  credentials_enc  TEXT         NOT NULL,                 -- ظرف AES-256-GCM: {"v":1,"kid":"k1","iv":"..","tag":"..","ct":".."}
  key_id           VARCHAR(16)  NOT NULL,                 -- معرّف مفتاح التشفير المستعمل (للتدوير)
  base_url         VARCHAR(255) NULL,                     -- رابط المنصة لشركات Ecotrack (غير سرّي)
  webhook_token_hash CHAR(64)   NOT NULL,                 -- sha256 لسرّ الـwebhook (السرّ نفسه يُعرض مرة واحدة فقط)
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL,
  updated_at       DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_carrier (user_id, carrier_code),
  UNIQUE KEY uq_public (public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shipments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  connection_id BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  order_ref     VARCHAR(64)  NOT NULL,                    -- رقم طلب المتجر
  carrier_code  VARCHAR(32)  NOT NULL,
  tracking      VARCHAR(64)  NULL,                        -- NULL أثناء حجز الإرسال (قبل ردّ الشركة)
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending|shipped|out_for_delivery|delivered|failed_attempt|returned|cancelled
  raw_status    VARCHAR(190) NULL,
  cod_amount    INT UNSIGNED NOT NULL DEFAULT 0,
  last_event_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conn_order (connection_id, order_ref),    -- طرد واحد لكل طلب: عدم تكرار الإرسال على مستوى الخادم
  UNIQUE KEY uq_conn_tracking (connection_id, tracking),
  KEY ix_user_status (user_id, status),
  CONSTRAINT fk_ship_conn FOREIGN KEY (connection_id) REFERENCES user_carriers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shipment_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shipment_id BIGINT UNSIGNED NOT NULL,
  raw_status  VARCHAR(190) NOT NULL,
  status      VARCHAR(20)  NOT NULL,
  event_hash  CHAR(40)     NOT NULL,                      -- sha1 للحدث الوارد: يتجاهل إعادات الإرسال المتطابقة
  created_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event (event_hash),
  KEY ix_ship (shipment_id),
  CONSTRAINT fk_ev_ship FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
