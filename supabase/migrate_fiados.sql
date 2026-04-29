-- Migración: actualizar tabla fiados al esquema actual
-- Ejecutar en Supabase Dashboard → SQL Editor

-- 1. Agregar columnas nuevas
alter table fiados
  add column if not exists customer_name text,
  add column if not exists sale_id       uuid,
  add column if not exists items         jsonb    default '[]',
  add column if not exists status        text     default 'pendiente',
  add column if not exists paid_method   text,
  add column if not exists paid_at       timestamptz;

-- 2. Migrar datos existentes: client → customer_name, paid → status
update fiados
  set customer_name = client,
      status        = case when paid then 'pagado' else 'pendiente' end
  where customer_name is null;

-- 3. Hacer customer_name NOT NULL ahora que está poblado
alter table fiados alter column customer_name set not null;
