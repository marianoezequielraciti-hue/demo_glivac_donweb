-- ============================================================
-- GLIVAC DEMO — Bootstrap completo desde cero
-- Ejecutar en Supabase > SQL Editor sobre una base vacía
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EXTENSIONES
-- ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 2. TABLAS
-- ────────────────────────────────────────────────────────────

create table if not exists stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text check (type in ('local','deposito','otro')),
  active     boolean default true,
  created_at timestamptz default now()
);

create table if not exists user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  role       text not null default 'employee' check (role in ('admin','employee')),
  store_id   uuid references stores(id),
  created_at timestamptz default now()
);

create table if not exists products (
  id                   uuid primary key default gen_random_uuid(),
  barcode              text,
  name                 text not null,
  category             text default 'Otros',
  unit                 text default 'unidad',
  current_stock        numeric default 0,
  min_stock            numeric default 0,
  purchase_price       numeric default 0,
  sale_price           numeric not null default 0,
  allow_negative_stock boolean default true,
  active               boolean default true,
  store_id             uuid references stores(id),
  expiration_date      date,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique (barcode, store_id)
);

create table if not exists sales (
  id             uuid primary key default gen_random_uuid(),
  sale_number    text not null,
  items          jsonb not null default '[]',
  total          numeric not null default 0,
  payment_method text not null default 'efectivo',
  cashier        text not null,
  notes          text default '',
  store_id       uuid references stores(id),
  created_at     timestamptz default now()
);

create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  amount       numeric not null default 0,
  category     text not null default 'Otros',
  expense_type text not null default 'variable',
  date         date not null default current_date,
  notes        text default '',
  purchase_id  uuid,
  store_id     uuid references stores(id),
  created_at   timestamptz default now()
);

create table if not exists purchases (
  id             uuid primary key default gen_random_uuid(),
  supplier       text default '',
  invoice_number text default '',
  items          jsonb not null default '[]',
  total          numeric not null default 0,
  notes          text default '',
  expense_id     uuid references expenses(id) on delete set null,
  store_id       uuid references stores(id),
  created_at     timestamptz default now()
);

create table if not exists fiados (
  id         uuid primary key default gen_random_uuid(),
  client     text not null,
  amount     numeric not null default 0,
  paid       boolean default false,
  notes      text default '',
  store_id   uuid references stores(id),
  created_at timestamptz default now()
);

create table if not exists shift_logs (
  id             uuid primary key default gen_random_uuid(),
  cashier        text not null,
  opened_at      timestamptz default now(),
  closed_at      timestamptz,
  opening_amount numeric default 0,
  closing_amount numeric,
  store_id       uuid references stores(id)
);

-- ────────────────────────────────────────────────────────────
-- 3. ÍNDICES
-- ────────────────────────────────────────────────────────────
create index if not exists idx_products_active    on products(active);
create index if not exists idx_products_store     on products(store_id);
create index if not exists idx_products_barcode   on products(barcode);
create index if not exists idx_sales_created      on sales(created_at desc);
create index if not exists idx_sales_store        on sales(store_id);
create index if not exists idx_expenses_date      on expenses(date desc);
create index if not exists idx_expenses_store     on expenses(store_id);
create index if not exists idx_purchases_created  on purchases(created_at desc);
create index if not exists idx_purchases_store    on purchases(store_id);

-- ────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
alter table stores        enable row level security;
alter table user_profiles disable row level security;
alter table products      enable row level security;
alter table sales         enable row level security;
alter table expenses      enable row level security;
alter table purchases     enable row level security;
alter table fiados        enable row level security;
alter table shift_logs    enable row level security;

create policy "stores_select"      on stores      for select using (auth.role() = 'authenticated');
create policy "auth_all_products"  on products    for all    using (auth.role() = 'authenticated');
create policy "auth_all_sales"     on sales       for all    using (auth.role() = 'authenticated');
create policy "auth_all_expenses"  on expenses    for all    using (auth.role() = 'authenticated');
create policy "auth_all_purchases" on purchases   for all    using (auth.role() = 'authenticated');
create policy "auth_all_fiados"    on fiados      for all    using (auth.role() = 'authenticated');
create policy "auth_all_shiftlogs" on shift_logs  for all    using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 5. FUNCIONES DE ROL
-- ────────────────────────────────────────────────────────────
create or replace function get_my_role()
  returns text language sql security definer as $$
  select role from user_profiles where id = auth.uid();
$$;

create or replace function is_admin()
  returns boolean language sql security definer as $$
  select exists (
    select 1 from user_profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Crea o actualiza el perfil del usuario al loguear
create or replace function ensure_my_profile(preferred_role text default 'employee')
  returns user_profiles language plpgsql security definer as $$
declare
  v_email text := current_setting('request.jwt.claims.email', true);
begin
  insert into user_profiles (id, email, role)
    values (auth.uid(), coalesce(v_email, ''), preferred_role)
    on conflict (id) do update
      set email = coalesce(v_email, user_profiles.email);
  return (select * from user_profiles where id = auth.uid());
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. STORE DEMO
-- ────────────────────────────────────────────────────────────
insert into stores (id, name, type) values
  ('00000000-0000-0000-0000-000000000001', 'Glivac Demo', 'local')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- 7. PRODUCTOS DEMO (26 productos en 6 categorías)
-- ────────────────────────────────────────────────────────────
insert into products (barcode, name, category, unit, current_stock, min_stock, purchase_price, sale_price, store_id) values
  -- Bebidas
  ('7790070010007', 'Coca-Cola 600ml',          'Bebidas',    'unidad', 48,  12,  850, 1200, '00000000-0000-0000-0000-000000000001'),
  ('7790070010014', 'Sprite 600ml',             'Bebidas',    'unidad', 36,  12,  820, 1150, '00000000-0000-0000-0000-000000000001'),
  ('7790070020003', 'Agua Mineral 500ml',       'Bebidas',    'unidad', 60,  24,  400,  650, '00000000-0000-0000-0000-000000000001'),
  -- Lácteos
  ('7790710600010', 'Leche Entera 1L',          'Lácteos',   'unidad', 30,  10,  980, 1350, '00000000-0000-0000-0000-000000000001'),
  ('7790040010010', 'Yogur Natural 190g',       'Lácteos',   'unidad', 20,   6,  450,  700, '00000000-0000-0000-0000-000000000001'),
  ('7798042480127', 'Manteca 200g',             'Lácteos',   'unidad', 15,   5, 1100, 1500, '00000000-0000-0000-0000-000000000001'),
  -- Almacén
  ('7790580000014', 'Aceite Girasol 900ml',     'Almacén',   'unidad', 20,   6, 1800, 2400, '00000000-0000-0000-0000-000000000001'),
  ('7790380010016', 'Arroz Largo Fino 1kg',     'Almacén',   'unidad', 25,   8,  950, 1300, '00000000-0000-0000-0000-000000000001'),
  ('7790380020015', 'Fideos Spaghetti 500g',    'Almacén',   'unidad', 30,  10,  600,  900, '00000000-0000-0000-0000-000000000001'),
  ('7790040030012', 'Harina 000 1kg',           'Almacén',   'unidad', 20,   8,  700, 1000, '00000000-0000-0000-0000-000000000001'),
  ('7790040040011', 'Azúcar 1kg',               'Almacén',   'unidad', 18,   6,  900, 1250, '00000000-0000-0000-0000-000000000001'),
  ('7790480000018', 'Sal Fina 500g',            'Almacén',   'unidad', 15,   5,  350,  550, '00000000-0000-0000-0000-000000000001'),
  -- Limpieza
  ('7791290000015', 'Lavandina 1L',             'Limpieza',  'unidad', 24,   8,  550,  850, '00000000-0000-0000-0000-000000000001'),
  ('7793640000017', 'Detergente 500ml',         'Limpieza',  'unidad', 18,   6,  700, 1050, '00000000-0000-0000-0000-000000000001'),
  ('7793200000010', 'Jabón en Polvo 500g',      'Limpieza',  'unidad', 12,   4, 1200, 1700, '00000000-0000-0000-0000-000000000001'),
  -- Snacks
  ('7790580010013', 'Papas Fritas 100g',        'Snacks',    'unidad', 40,  12,  550,  850, '00000000-0000-0000-0000-000000000001'),
  ('7790580010020', 'Galletas Dulces 200g',     'Snacks',    'unidad', 30,  10,  600,  900, '00000000-0000-0000-0000-000000000001'),
  ('7790930000013', 'Alfajor Triple',           'Snacks',    'unidad', 50,  20,  380,  600, '00000000-0000-0000-0000-000000000001'),
  ('7790930000020', 'Chocolate con Leche 100g', 'Snacks',    'unidad', 35,  12,  700, 1100, '00000000-0000-0000-0000-000000000001'),
  -- Fiambrería
  (null, 'Jamón Cocido (kg)',                   'Fiambrería','kg',      8,    2, 4500, 6500, '00000000-0000-0000-0000-000000000001'),
  (null, 'Salame (kg)',                         'Fiambrería','kg',      5,    2, 5000, 7200, '00000000-0000-0000-0000-000000000001'),
  (null, 'Queso Cremoso (kg)',                  'Fiambrería','kg',      6,    2, 5500, 8000, '00000000-0000-0000-0000-000000000001'),
  (null, 'Queso Sardo (kg)',                    'Fiambrería','kg',      4,    1, 6000, 8500, '00000000-0000-0000-0000-000000000001'),
  -- Verdulería
  (null, 'Tomate (kg)',                         'Verdulería','kg',     10,    3,  800, 1200, '00000000-0000-0000-0000-000000000001'),
  (null, 'Papa (kg)',                           'Verdulería','kg',     15,    5,  600,  950, '00000000-0000-0000-0000-000000000001'),
  (null, 'Cebolla (kg)',                        'Verdulería','kg',     12,    4,  500,  800, '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- 8. USUARIOS ADMIN
-- ────────────────────────────────────────────────────────────
insert into user_profiles (id, email, role, store_id) values
  ('0896d672-7fcb-489e-92a9-16aaa06526c1', 'alignac@gmail.com',                'admin', '00000000-0000-0000-0000-000000000001'),
  ('f54a64bb-6b6c-4845-bc1e-b3aca734680d', 'demoglivac@gmail.com',             'admin', '00000000-0000-0000-0000-000000000001'),
  ('0b4a3883-b56e-4aad-9f9c-6b6e9892ca88', 'marianoezequielraciti@gmail.com',  'admin', '00000000-0000-0000-0000-000000000001'),
  ('a89e7fed-1cba-4378-9113-877230a654b0', 'matias.0122.vazquez@gmail.com',    'admin', '00000000-0000-0000-0000-000000000001')
on conflict (id) do update set role = 'admin';

-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ────────────────────────────────────────────────────────────
-- select count(*) from products;   -- 26
-- select * from stores;
-- select name, role from user_profiles;
