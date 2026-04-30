-- ============================================================
-- GLIVAC — Aislamiento por negocio (store isolation)
-- Ejecutar en Supabase > SQL Editor DESPUÉS de fix_rls_final.sql
-- ============================================================
-- Resultado:
--   · Empleados ven y modifican SOLO los datos de su local
--   · Admins ven y modifican TODO
-- ============================================================

-- Helper: devuelve el store_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_my_store_id()
RETURNS uuid
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM user_profiles WHERE id = auth.uid();
$$;

-- ── products ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products
  FOR SELECT USING (
    is_admin() OR store_id = get_my_store_id()
  );

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products
  FOR UPDATE
  USING    (is_admin() OR store_id = get_my_store_id())
  WITH CHECK (is_admin() OR store_id = get_my_store_id());

-- ── sales ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales
  FOR SELECT USING (
    is_admin() OR store_id = get_my_store_id()
  );

-- ── purchases ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchases_select" ON purchases;
CREATE POLICY "purchases_select" ON purchases
  FOR SELECT USING (
    is_admin() OR store_id = get_my_store_id()
  );

DROP POLICY IF EXISTS "purchases_update" ON purchases;
CREATE POLICY "purchases_update" ON purchases
  FOR UPDATE
  USING    (is_admin() OR store_id = get_my_store_id())
  WITH CHECK (is_admin() OR store_id = get_my_store_id());

-- ── fiados ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fiados_select" ON fiados;
CREATE POLICY "fiados_select" ON fiados
  FOR SELECT USING (
    is_admin() OR store_id = get_my_store_id()
  );

-- ── shift_logs ────────────────────────────────────────────────
-- fix_rls_final.sql borra las políticas pero no las recrea.
-- Sin esto, el cierre de turno falla silenciosamente.
ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_logs_select" ON shift_logs;
CREATE POLICY "shift_logs_select" ON shift_logs
  FOR SELECT USING (
    is_admin() OR store_id = get_my_store_id()
  );

DROP POLICY IF EXISTS "shift_logs_insert" ON shift_logs;
CREATE POLICY "shift_logs_insert" ON shift_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── INSERT enforcement para empleados ─────────────────────────
-- Impide que un empleado inserte una venta/fiado con store_id
-- incorrecto o nulo. El frontend ya lo garantiza, esto lo refuerza.
DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    (is_admin() OR store_id = get_my_store_id())
  );

DROP POLICY IF EXISTS "fiados_insert" ON fiados;
CREATE POLICY "fiados_insert" ON fiados
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    (is_admin() OR store_id = get_my_store_id())
  );
