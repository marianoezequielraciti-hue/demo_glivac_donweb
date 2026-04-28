-- ============================================================
-- FIAMBRERÍAS VALE — Multi-negocio: Fiambrería + Kiosco
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Tabla stores
CREATE TABLE IF NOT EXISTS stores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  type       text CHECK (type IN ('fiambreria','kiosco')),
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_select" ON stores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stores_admin"  ON stores FOR ALL   USING (is_admin()) WITH CHECK (is_admin());

-- 2. Insertar los dos negocios
INSERT INTO stores (name, type) VALUES
  ('Fiambrería', 'fiambreria'),
  ('Kiosco',     'kiosco')
ON CONFLICT DO NOTHING;

-- 3. Agregar store_id a todas las tablas relevantes
ALTER TABLE products      ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE sales         ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE purchases     ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE expenses      ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE fiados        ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE shift_logs    ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);

-- 4. Índices de performance
CREATE INDEX IF NOT EXISTS idx_products_store   ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store      ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_purchases_store  ON purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_store   ON expenses(store_id);

-- 5. Asignar store a empleados existentes
-- IMPORTANTE: corré primero este SELECT para ver los IDs de tus stores:
-- SELECT id, name FROM stores;
-- Luego reemplazá los UUIDs en los UPDATE de abajo.

-- Ejemplo (reemplazá con los UUIDs reales):
-- UPDATE user_profiles SET store_id = '<UUID-FIAMBRERIA>' WHERE email IN ('maia@...', 'mia@...');
-- UPDATE user_profiles SET store_id = '<UUID-KIOSCO>'     WHERE email IN ('empleado-kiosco@...');
-- Los admins (Matias, Lucas) NO necesitan store_id — ven todo.
