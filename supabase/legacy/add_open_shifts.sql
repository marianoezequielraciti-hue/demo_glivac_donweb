-- ============================================================
-- GLIVAC — Tabla open_shifts
-- Rastrear turnos abiertos en tiempo real (cross-device)
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS open_shifts (
  id        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id  uuid        REFERENCES stores(id) ON DELETE CASCADE,
  cajero    text        NOT NULL,
  inicio    timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE open_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_shifts_select" ON open_shifts;
CREATE POLICY "open_shifts_select" ON open_shifts
  FOR SELECT USING (is_admin() OR store_id = get_my_store_id());

DROP POLICY IF EXISTS "open_shifts_insert" ON open_shifts;
CREATE POLICY "open_shifts_insert" ON open_shifts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "open_shifts_delete" ON open_shifts;
CREATE POLICY "open_shifts_delete" ON open_shifts
  FOR DELETE USING (is_admin() OR store_id = get_my_store_id());
