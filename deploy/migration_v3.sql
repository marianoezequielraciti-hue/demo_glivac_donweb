-- Categorías de gastos personalizadas
CREATE TABLE IF NOT EXISTS expense_categories (
  id       CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name     VARCHAR(100) NOT NULL,
  store_id CHAR(36)     NULL,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
);
