-- ============================================================
-- FIAMBRERÍAS VALE — Script de corrección completa
-- Ejecutar en Supabase > SQL Editor (todo junto de una vez)
-- ============================================================

-- ============================================================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================
alter table if exists user_profiles enable row level security;
alter table if exists products      enable row level security;
alter table if exists sales         enable row level security;
alter table if exists expenses      enable row level security;
alter table if exists purchases     enable row level security;

-- ============================================================
-- 2. FUNCIÓN AUXILIAR: obtener rol sin recursión (security definer
--    corre como el dueño de la función → bypasea RLS)
-- ============================================================
create or replace function get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(role, 'employee')
  from user_profiles
  where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- ============================================================
-- 3. POLÍTICAS user_profiles
-- ============================================================
drop policy if exists "user_read_own_profile"     on user_profiles;
drop policy if exists "admin_read_all_profiles"   on user_profiles;
drop policy if exists "user_insert_own_profile"   on user_profiles;
drop policy if exists "admin_update_profiles"     on user_profiles;
drop policy if exists "admin_delete_profiles"     on user_profiles;
-- Limpiamos cualquier política legacy
drop policy if exists "Allow individual read access"  on user_profiles;
drop policy if exists "Allow individual insert access" on user_profiles;
drop policy if exists "Allow individual update access" on user_profiles;

-- Cada usuario puede leer su propio perfil
create policy "user_read_own_profile" on user_profiles
  for select using (auth.uid() = id);

-- Admin puede ver todos los perfiles
create policy "admin_read_all_profiles" on user_profiles
  for select using (is_admin());

-- Cada usuario puede insertar su propio perfil (primera vez)
create policy "user_insert_own_profile" on user_profiles
  for insert with check (auth.uid() = id);

-- Admin puede actualizar cualquier perfil
create policy "admin_update_profiles" on user_profiles
  for update using (is_admin());

-- Admin puede eliminar perfiles
create policy "admin_delete_profiles" on user_profiles
  for delete using (is_admin());

-- ============================================================
-- 4. POLÍTICAS products
-- ============================================================
drop policy if exists "authenticated_read_products"  on products;
drop policy if exists "authenticated_write_products" on products;
drop policy if exists "productos_select_autenticados" on products;
drop policy if exists "productos_escritura_admin"     on products;

-- Todos los autenticados leen productos
create policy "authenticated_read_products" on products
  for select using (auth.role() = 'authenticated');

-- Todos los autenticados pueden crear/editar/eliminar productos
create policy "authenticated_write_products" on products
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 5. POLÍTICAS sales
-- ============================================================
drop policy if exists "authenticated_read_sales"   on sales;
drop policy if exists "authenticated_insert_sales" on sales;
drop policy if exists "authenticated_update_sales" on sales;

create policy "authenticated_read_sales" on sales
  for select using (auth.role() = 'authenticated');

create policy "authenticated_insert_sales" on sales
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated_update_sales" on sales
  for update using (auth.role() = 'authenticated');

-- ============================================================
-- 6. POLÍTICAS expenses
-- ============================================================
drop policy if exists "authenticated_insert_expenses" on expenses;
drop policy if exists "admin_read_expenses"           on expenses;
drop policy if exists "admin_modify_expenses"         on expenses;
drop policy if exists "admin_delete_expenses"         on expenses;

-- Todos pueden insertar gastos (empleados pueden cargar)
create policy "authenticated_insert_expenses" on expenses
  for insert with check (auth.role() = 'authenticated');

-- Solo admins leen los gastos
create policy "admin_read_expenses" on expenses
  for select using (is_admin());

-- Solo admins modifican gastos
create policy "admin_modify_expenses" on expenses
  for update using (is_admin());

create policy "admin_delete_expenses" on expenses
  for delete using (is_admin());

-- ============================================================
-- 7. POLÍTICAS purchases
-- ============================================================
drop policy if exists "authenticated_read_purchases"  on purchases;
drop policy if exists "authenticated_write_purchases" on purchases;

create policy "authenticated_read_purchases" on purchases
  for select using (auth.role() = 'authenticated');

create policy "authenticated_write_purchases" on purchases
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- 8. INSERTAR / ACTUALIZAR PERFILES DE USUARIOS
--    (matias y lucas = admin, maia y mia solana = employee)
-- ============================================================
insert into user_profiles (id, email, role, created_at)
values
  ('6bc4d000-6cfe-407f-82eb-02a006e52da8', 'matias.0122.vazquez@gmail.com', 'admin',    now()),
  ('017d3a7b-ba09-4ffa-9f6e-643b2bbb820c', 'lukiitas.lev@gmail.com',        'admin',    now()),
  ('f24a6990-f5a7-4d04-aacb-0ebd0c669c8a', 'maiasolomare27@gmail.com',      'employee', now()),
  ('31168ea8-c0a3-47d1-a8a2-c3e30e3ec1d2', 'miasolanagomez46@gmail.com',    'employee', now())
on conflict (id) do update set
  role       = excluded.role,
  email      = excluded.email;

-- ============================================================
-- VERIFICACIÓN — corré esto por separado para confirmar
-- ============================================================
-- select id, email, role from user_profiles order by role;
