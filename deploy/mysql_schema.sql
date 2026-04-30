-- ============================================================
-- GLIVAC — Schema MySQL para Hostinger
-- Ejecutar en phpMyAdmin sobre la base de datos del proyecto
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS stores (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  name       TEXT         NOT NULL,
  type       VARCHAR(20)  DEFAULT 'local' CHECK (type IN ('local','deposito','otro')),
  active     TINYINT(1)   DEFAULT 1,
  created_at DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- users: reemplaza GoTrue/auth.users de Supabase
CREATE TABLE IF NOT EXISTS users (
  id                 CHAR(36)     NOT NULL PRIMARY KEY,
  email              VARCHAR(255) NOT NULL UNIQUE,
  encrypted_password VARCHAR(255) NOT NULL,
  created_at         DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_profiles (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  role       VARCHAR(20)  NOT NULL DEFAULT 'employee',
  username   VARCHAR(255),
  store_id   CHAR(36),
  created_at DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (id)       REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id                   CHAR(36)      NOT NULL PRIMARY KEY,
  barcode              VARCHAR(255),
  name                 TEXT          NOT NULL,
  category             VARCHAR(100)  DEFAULT 'Otros',
  unit                 VARCHAR(50)   DEFAULT 'unidad',
  current_stock        DECIMAL(15,3) DEFAULT 0,
  min_stock            DECIMAL(15,3) DEFAULT 0,
  purchase_price       DECIMAL(15,2) DEFAULT 0,
  sale_price           DECIMAL(15,2) NOT NULL DEFAULT 0,
  allow_negative_stock TINYINT(1)    DEFAULT 1,
  active               TINYINT(1)    DEFAULT 1,
  store_id             CHAR(36),
  expiration_date      DATE,
  created_at           DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_barcode_store (barcode, store_id),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  full_name   TEXT         NOT NULL,
  phone       VARCHAR(50),
  email       VARCHAR(255),
  document_id VARCHAR(50),
  address     TEXT,
  notes       TEXT         DEFAULT '',
  active      TINYINT(1)   DEFAULT 1,
  store_id    CHAR(36),
  created_at  DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  sale_number    VARCHAR(50)  NOT NULL,
  items          JSON         NOT NULL,
  total          DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50)  NOT NULL DEFAULT 'efectivo',
  cashier        TEXT         NOT NULL,
  notes          TEXT         DEFAULT '',
  store_id       CHAR(36),
  created_at     DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  client_id         CHAR(36)      NOT NULL,
  budget_number     VARCHAR(50)   NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft',
  items             JSON          NOT NULL,
  subtotal          DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes             TEXT          DEFAULT '',
  valid_until       DATE,
  posted_to_account TINYINT(1)    DEFAULT 0,
  store_id          CHAR(36),
  created_at        DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id)  REFERENCES stores(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id           CHAR(36)      NOT NULL PRIMARY KEY,
  description  TEXT          NOT NULL,
  amount       DECIMAL(15,2) NOT NULL DEFAULT 0,
  category     VARCHAR(100)  NOT NULL DEFAULT 'Otros',
  expense_type VARCHAR(50)   NOT NULL DEFAULT 'variable',
  date         DATE          NOT NULL DEFAULT (CURDATE()),
  notes        TEXT          DEFAULT '',
  purchase_id  CHAR(36),
  store_id     CHAR(36),
  created_at   DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_account_entries (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  client_id     CHAR(36)      NOT NULL,
  budget_id     CHAR(36),
  movement_type VARCHAR(10)   NOT NULL,
  amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
  description   TEXT          NOT NULL,
  store_id      CHAR(36),
  created_at    DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (client_id) REFERENCES clients(id)  ON DELETE CASCADE,
  FOREIGN KEY (budget_id) REFERENCES budgets(id)  ON DELETE SET NULL,
  FOREIGN KEY (store_id)  REFERENCES stores(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchases (
  id             CHAR(36)      NOT NULL PRIMARY KEY,
  supplier       VARCHAR(255)  DEFAULT '',
  invoice_number VARCHAR(100)  DEFAULT '',
  items          JSON          NOT NULL,
  total          DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes          TEXT          DEFAULT '',
  expense_id     CHAR(36),
  store_id       CHAR(36),
  created_at     DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
  FOREIGN KEY (store_id)   REFERENCES stores(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fiados (
  id         CHAR(36)      NOT NULL PRIMARY KEY,
  client     TEXT          NOT NULL,
  amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid       TINYINT(1)    DEFAULT 0,
  notes      TEXT          DEFAULT '',
  store_id   CHAR(36),
  created_at DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shift_logs (
  id              CHAR(36)      NOT NULL PRIMARY KEY,
  cajero          TEXT          NOT NULL,
  inicio          DATETIME(3),
  fin             DATETIME(3),
  monto_inicial   DECIMAL(15,2) DEFAULT 0,
  monto_esperado  DECIMAL(15,2) DEFAULT 0,
  monto_real      DECIMAL(15,2) DEFAULT 0,
  diferencia      DECIMAL(15,2) DEFAULT 0,
  total_ventas    INT           DEFAULT 0,
  total_recaudado DECIMAL(15,2) DEFAULT 0,
  total_efectivo  DECIMAL(15,2) DEFAULT 0,
  total_digital   DECIMAL(15,2) DEFAULT 0,
  observaciones   TEXT          DEFAULT '',
  store_id        CHAR(36),
  created_at      DATETIME(3)   DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS open_shifts (
  id       CHAR(36)    NOT NULL PRIMARY KEY,
  store_id CHAR(36),
  cajero   TEXT        NOT NULL,
  inicio   DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Índices
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_store    ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode  ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_clients_store     ON clients(store_id);
CREATE INDEX IF NOT EXISTS idx_clients_active    ON clients(active);
CREATE INDEX IF NOT EXISTS idx_sales_created     ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_store       ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_budgets_client    ON budgets(client_id);
CREATE INDEX IF NOT EXISTS idx_budgets_store     ON budgets(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_store    ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_purchases_store   ON purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_fiados_store      ON fiados(store_id);
CREATE INDEX IF NOT EXISTS idx_shiftlogs_store   ON shift_logs(store_id);

SET FOREIGN_KEY_CHECKS = 1;

-- Store demo inicial
INSERT IGNORE INTO stores (id, name, type)
VALUES ('00000000-0000-0000-0000-000000000001', 'Glivac', 'local');
