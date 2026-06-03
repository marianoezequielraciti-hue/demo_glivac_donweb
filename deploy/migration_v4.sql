-- ============================================================
-- Migration v4: Price lists, recovery email, password reset
-- ============================================================

-- 1. Tres listas de precios por producto
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_cash     DECIMAL(15,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_card     DECIMAL(15,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_transfer DECIMAL(15,2) DEFAULT NULL;

-- 2. Email de recuperación de contraseña por usuario
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(255) DEFAULT NULL;

-- 3. Tokens para reseteo de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id    CHAR(36)     NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME(3)  NOT NULL,
  used       TINYINT(1)   DEFAULT 0,
  created_at DATETIME(3)  DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token);
