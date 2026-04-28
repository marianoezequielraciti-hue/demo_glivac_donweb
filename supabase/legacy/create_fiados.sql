-- ============================================================
-- FIAMBRERÍAS VALE — Tabla FIADOS
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS fiados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      uuid REFERENCES sales(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  amount       numeric(10,2) NOT NULL DEFAULT 0,
  items        jsonb NOT NULL DEFAULT '[]',
  status       text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
  paid_method  text CHECK (paid_method IN ('efectivo', 'mercadopago')),
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS fiados_status_idx ON fiados(status);
CREATE INDEX IF NOT EXISTS fiados_created_at_idx ON fiados(created_at DESC);

-- RLS
ALTER TABLE fiados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiados_select_auth" ON fiados
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "fiados_insert_auth" ON fiados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "fiados_update_auth" ON fiados
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "fiados_delete_admin" ON fiados
  FOR DELETE USING (is_admin());
