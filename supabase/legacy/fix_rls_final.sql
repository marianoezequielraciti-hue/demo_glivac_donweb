-- ============================================================
-- FIAMBRERÍAS VALE — FIX RLS DEFINITIVO
-- Ejecutar en Supabase > SQL Editor
-- Elimina TODAS las políticas existentes y las recrea limpiamente
-- ============================================================

-- 1. Drop ALL existing policies on all tables
DO $drop$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products','sales','expenses','purchases','user_profiles','fiados','shift_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $drop$;

-- 2. Security definer functions (bypass RLS safely)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 3. user_profiles — each user sees their own row; admins see all
CREATE POLICY "profiles_self" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON user_profiles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 4. products — all authenticated users can read; admins can write
CREATE POLICY "products_select" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "products_update" ON products
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "products_delete" ON products
  FOR DELETE USING (is_admin());

-- 5. sales — all authenticated users can read and insert; admins can delete
CREATE POLICY "sales_select" ON sales
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sales_insert" ON sales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "sales_delete" ON sales
  FOR DELETE USING (is_admin());

-- 6. purchases — all authenticated users read/insert; admins delete
CREATE POLICY "purchases_select" ON purchases
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "purchases_insert" ON purchases
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "purchases_update" ON purchases
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "purchases_delete" ON purchases
  FOR DELETE USING (is_admin());

-- 7. expenses — only admins
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (is_admin());

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (is_admin());

-- 8. fiados — all authenticated read/insert; admins delete
ALTER TABLE fiados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiados_select" ON fiados
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "fiados_insert" ON fiados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "fiados_update" ON fiados
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "fiados_delete" ON fiados
  FOR DELETE USING (is_admin());

-- 9. Make expense_id nullable (fix purchases/expenses coupling)
ALTER TABLE purchases ALTER COLUMN expense_id DROP NOT NULL;

-- 10. Add username column to user_profiles if missing
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT;
