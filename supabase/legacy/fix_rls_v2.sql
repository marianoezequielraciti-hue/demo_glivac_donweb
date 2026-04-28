-- ============================================================
-- FIAMBRERÍAS VALE — FIX COMPLETO v2
-- Ejecutar COMPLETO en Supabase > SQL Editor
-- BORRA TODAS LAS POLÍTICAS EXISTENTES antes de recrearlas
-- ============================================================

-- ============================================================
-- 1. BORRAR TODAS LAS POLÍTICAS SIN IMPORTAR EL NOMBRE
--    (esto evita el conflicto con políticas viejas que quedaron)
-- ============================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_profiles','products','sales','expenses','purchases')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 2. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. FUNCIONES AUXILIARES (security definer → bypasea RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'employee')
  FROM user_profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- ============================================================
-- 4. USER_PROFILES — solo lectura del propio perfil
--    (admin ve todos los perfiles vía la función get_all_profiles)
-- ============================================================
CREATE POLICY "up_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "up_insert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "up_update_admin" ON user_profiles
  FOR UPDATE USING (is_admin());

CREATE POLICY "up_delete_admin" ON user_profiles
  FOR DELETE USING (is_admin());

-- Función para que Settings pueda listar todos los perfiles
-- sin depender de una política recursiva
CREATE OR REPLACE FUNCTION get_all_profiles()
RETURNS SETOF user_profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM user_profiles ORDER BY role, email
$$;

-- ============================================================
-- 5. PRODUCTS — políticas explícitas por operación
-- ============================================================
CREATE POLICY "prod_select_auth" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "prod_insert_auth" ON products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "prod_update_auth" ON products
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "prod_delete_auth" ON products
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 6. SALES
-- ============================================================
CREATE POLICY "sales_select_auth" ON sales
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sales_insert_auth" ON sales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "sales_update_auth" ON sales
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 7. EXPENSES — empleados insertan, solo admin lee/modifica
-- ============================================================
CREATE POLICY "exp_insert_auth" ON expenses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "exp_select_admin" ON expenses
  FOR SELECT USING (is_admin());

CREATE POLICY "exp_update_admin" ON expenses
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "exp_delete_admin" ON expenses
  FOR DELETE USING (is_admin());

-- ============================================================
-- 8. PURCHASES
-- ============================================================
CREATE POLICY "pur_select_auth" ON purchases
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pur_insert_auth" ON purchases
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pur_update_auth" ON purchases
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pur_delete_auth" ON purchases
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 9. INSERTAR / ACTUALIZAR PERFILES DE USUARIOS
-- ============================================================
INSERT INTO user_profiles (id, email, role, created_at)
VALUES
  ('6bc4d000-6cfe-407f-82eb-02a006e52da8', 'matias.0122.vazquez@gmail.com', 'admin',    now()),
  ('017d3a7b-ba09-4ffa-9f6e-643b2bbb820c', 'lukiitas.lev@gmail.com',        'admin',    now()),
  ('f24a6990-f5a7-4d04-aacb-0ebd0c669c8a', 'maiasolomare27@gmail.com',      'employee', now()),
  ('31168ea8-c0a3-47d1-a8a2-c3e30e3ec1d2', 'miasolanagomez46@gmail.com',    'employee', now())
ON CONFLICT (id) DO UPDATE SET
  role  = EXCLUDED.role,
  email = EXCLUDED.email;

-- ============================================================
-- 10. LIMPIAR PRODUCTO TEST (barcode "1234" si existe)
-- ============================================================
DELETE FROM products WHERE barcode = '1234';

-- ============================================================
-- VERIFICACIÓN (corré por separado)
-- ============================================================
-- SELECT id, email, role FROM user_profiles ORDER BY role;
-- SELECT policyname, tablename, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
