-- Glivac Demo
-- Bootstrap limpio para una base nueva de Supabase.
-- Este archivo reemplaza los scripts históricos de fixes y migraciones manuales.
-- Ejecutar en una base vacía desde Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists app_roles (
  code text primary key,
  label text not null,
  scope text not null check (scope in ('global', 'store')),
  can_manage_settings boolean not null default false,
  can_view_reports boolean not null default false,
  can_manage_catalog boolean not null default false,
  can_manage_cash_register boolean not null default false,
  can_manage_expenses boolean not null default false,
  sort_order integer not null default 100
);

insert into app_roles (
  code,
  label,
  scope,
  can_manage_settings,
  can_view_reports,
  can_manage_catalog,
  can_manage_cash_register,
  can_manage_expenses,
  sort_order
)
values
  ('owner', 'Owner', 'global', true, true, true, true, true, 10),
  ('admin', 'Administrador', 'global', true, true, true, true, true, 20),
  ('manager', 'Encargado', 'store', false, true, true, true, true, 30),
  ('cashier', 'Cajero', 'store', false, false, false, true, false, 40),
  ('inventory', 'Stock', 'store', false, false, true, false, false, 50),
  ('analyst', 'Analista', 'store', false, true, false, false, false, 60),
  ('employee', 'Empleado', 'store', false, false, false, true, false, 70)
on conflict (code) do update set
  label = excluded.label,
  scope = excluded.scope,
  can_manage_settings = excluded.can_manage_settings,
  can_view_reports = excluded.can_view_reports,
  can_manage_catalog = excluded.can_manage_catalog,
  can_manage_cash_register = excluded.can_manage_cash_register,
  can_manage_expenses = excluded.can_manage_expenses,
  sort_order = excluded.sort_order;

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('fiambreria', 'kiosco')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null references app_roles(code) on update cascade,
  username text,
  store_id uuid references stores(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_profiles_store_role_guard check (
    (role in ('owner', 'admin') and store_id is null)
    or
    (role not in ('owner', 'admin'))
  )
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  barcode text,
  name text not null,
  category text default 'Otros',
  unit text default 'unidad',
  current_stock numeric not null default 0,
  min_stock numeric not null default 0,
  purchase_price numeric not null default 0,
  sale_price numeric not null default 0,
  allow_negative_stock boolean not null default true,
  active boolean not null default true,
  expiration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  sale_number text not null,
  items jsonb not null default '[]',
  total numeric not null default 0,
  payment_method text not null default 'efectivo',
  cashier text not null,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  description text not null,
  amount numeric not null default 0,
  category text not null default 'Otros',
  expense_type text not null default 'variable',
  date date not null default current_date,
  notes text default '',
  purchase_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  supplier text default '',
  invoice_number text default '',
  items jsonb not null default '[]',
  total numeric not null default 0,
  notes text default '',
  expense_id uuid references expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists fiados (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  sale_id uuid references sales(id) on delete set null,
  customer_name text not null,
  amount numeric(10,2) not null default 0,
  items jsonb not null default '[]',
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado')),
  paid_method text check (paid_method in ('efectivo', 'mercadopago')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists shift_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  cajero text not null,
  inicio timestamptz not null,
  fin timestamptz not null,
  monto_inicial numeric not null default 0,
  monto_esperado numeric not null default 0,
  monto_real numeric not null default 0,
  diferencia numeric not null default 0,
  total_ventas integer not null default 0,
  total_recaudado numeric not null default 0,
  total_efectivo numeric not null default 0,
  total_digital numeric not null default 0,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists open_shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  cajero text not null,
  inicio timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists products_store_barcode_unique
  on products(store_id, barcode)
  where barcode is not null;

create index if not exists idx_products_store on products(store_id);
create index if not exists idx_products_active on products(active);
create index if not exists idx_sales_store on sales(store_id);
create index if not exists idx_sales_created on sales(created_at desc);
create index if not exists idx_expenses_store on expenses(store_id);
create index if not exists idx_expenses_date on expenses(date desc);
create index if not exists idx_purchases_store on purchases(store_id);
create index if not exists idx_purchases_created on purchases(created_at desc);
create index if not exists idx_fiados_store on fiados(store_id);
create index if not exists idx_shift_logs_store on shift_logs(store_id);
create index if not exists idx_open_shifts_store on open_shifts(store_id);
create index if not exists idx_user_profiles_role on user_profiles(role);

insert into stores (name, type)
values
  ('Casa Central', 'fiambreria'),
  ('Kiosco Demo', 'kiosco')
on conflict do nothing;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_touch_updated_at on products;
create trigger trg_products_touch_updated_at
before update on products
for each row
execute function touch_updated_at();

alter table app_roles enable row level security;
alter table stores enable row level security;
alter table user_profiles enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
alter table purchases enable row level security;
alter table fiados enable row level security;
alter table shift_logs enable row level security;
alter table open_shifts enable row level security;

create or replace function get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from user_profiles
  where id = auth.uid();
$$;

create or replace function get_my_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id
  from user_profiles
  where id = auth.uid();
$$;

create or replace function has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case permission_name
      when 'manage_settings' then app_roles.can_manage_settings
      when 'view_reports' then app_roles.can_view_reports
      when 'manage_catalog' then app_roles.can_manage_catalog
      when 'manage_cash_register' then app_roles.can_manage_cash_register
      when 'manage_expenses' then app_roles.can_manage_expenses
      else false
    end,
    false
  )
  from user_profiles
  join app_roles on app_roles.code = user_profiles.role
  where user_profiles.id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_permission('manage_settings');
$$;

create or replace function ensure_my_profile(preferred_role text default 'cashier')
returns user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
begin
  current_email := coalesce(auth.jwt() ->> 'email', '');

  insert into user_profiles (id, email, role)
  values (auth.uid(), current_email, preferred_role)
  on conflict (id) do update
    set email = excluded.email;

  return (
    select up
    from user_profiles up
    where up.id = auth.uid()
  );
end;
$$;

create or replace view role_catalog as
select
  code,
  label,
  scope,
  can_manage_settings,
  can_view_reports,
  can_manage_catalog,
  can_manage_cash_register,
  can_manage_expenses,
  sort_order
from app_roles;

do $drop$
declare row record;
begin
  for row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_roles',
        'stores',
        'user_profiles',
        'products',
        'sales',
        'expenses',
        'purchases',
        'fiados',
        'shift_logs',
        'open_shifts'
      )
  loop
    execute format('drop policy if exists %I on %I', row.policyname, row.tablename);
  end loop;
end $drop$;

create policy "app_roles_select" on app_roles
  for select using (auth.role() = 'authenticated');

create policy "app_roles_admin" on app_roles
  for all using (is_admin()) with check (is_admin());

create policy "stores_select" on stores
  for select using (auth.role() = 'authenticated');

create policy "stores_admin" on stores
  for all using (is_admin()) with check (is_admin());

create policy "profiles_self" on user_profiles
  for select using (auth.uid() = id);

create policy "profiles_admin_all" on user_profiles
  for all using (is_admin()) with check (is_admin());

create policy "products_select" on products
  for select using (is_admin() or store_id = get_my_store_id());

create policy "products_insert" on products
  for insert with check (
    (is_admin() and store_id is not null)
    or
    (store_id = get_my_store_id())
  );

create policy "products_update" on products
  for update using (is_admin() or store_id = get_my_store_id())
  with check (is_admin() or store_id = get_my_store_id());

create policy "products_delete" on products
  for delete using (is_admin());

create policy "sales_select" on sales
  for select using (is_admin() or store_id = get_my_store_id());

create policy "sales_insert" on sales
  for insert with check (
    auth.role() = 'authenticated'
    and (
      (is_admin() and store_id is not null)
      or
      store_id = get_my_store_id()
    )
  );

create policy "sales_delete" on sales
  for delete using (is_admin());

create policy "purchases_select" on purchases
  for select using (is_admin() or store_id = get_my_store_id());

create policy "purchases_insert" on purchases
  for insert with check (
    auth.role() = 'authenticated'
    and (
      (is_admin() and store_id is not null)
      or
      store_id = get_my_store_id()
    )
  );

create policy "purchases_update" on purchases
  for update using (is_admin() or store_id = get_my_store_id())
  with check (is_admin() or store_id = get_my_store_id());

create policy "purchases_delete" on purchases
  for delete using (is_admin());

create policy "expenses_select" on expenses
  for select using (is_admin() or store_id = get_my_store_id());

create policy "expenses_insert" on expenses
  for insert with check (
    (is_admin() and store_id is not null)
    or
    store_id = get_my_store_id()
  );

create policy "expenses_update" on expenses
  for update using (is_admin() or store_id = get_my_store_id())
  with check (is_admin() or store_id = get_my_store_id());

create policy "expenses_delete" on expenses
  for delete using (is_admin());

create policy "fiados_select" on fiados
  for select using (is_admin() or store_id = get_my_store_id());

create policy "fiados_insert" on fiados
  for insert with check (
    auth.role() = 'authenticated'
    and (
      (is_admin() and store_id is not null)
      or
      store_id = get_my_store_id()
    )
  );

create policy "fiados_update" on fiados
  for update using (is_admin() or store_id = get_my_store_id())
  with check (is_admin() or store_id = get_my_store_id());

create policy "fiados_delete" on fiados
  for delete using (is_admin());

create policy "shift_logs_select" on shift_logs
  for select using (is_admin() or store_id = get_my_store_id());

create policy "shift_logs_insert" on shift_logs
  for insert with check (
    auth.role() = 'authenticated'
    and (
      (is_admin() and store_id is not null)
      or
      store_id = get_my_store_id()
    )
  );

create policy "open_shifts_select" on open_shifts
  for select using (is_admin() or store_id = get_my_store_id());

create policy "open_shifts_insert" on open_shifts
  for insert with check (
    auth.role() = 'authenticated'
    and (
      (is_admin() and store_id is not null)
      or
      store_id = get_my_store_id()
    )
  );

create policy "open_shifts_delete" on open_shifts
  for delete using (is_admin() or store_id = get_my_store_id());
