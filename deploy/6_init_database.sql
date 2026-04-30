-- ============================================================
-- GLIVAC — Schema completo para PostgreSQL self-hosted
-- Ejecutar DENTRO del contenedor db:
--   docker compose exec db psql -U postgres -f /docker-entrypoint-initdb.d/99_glivac_schema.sql
-- O copiar este archivo como init.sql en el mismo directorio del compose
-- ============================================================

-- Extensiones requeridas por Supabase self-hosted
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- SCHEMA DE PRODUCCIÓN
-- ────────────────────────────────────────────────────────────

create table if not exists stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text check (type in ('local','deposito','otro')),
  active     boolean default true,
  created_at timestamptz default now()
);

-- user_profiles referencia auth.users (tabla del sistema Supabase/GoTrue)
create table if not exists user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  role       text not null default 'employee' check (role in ('admin','employee')),
  username   text,
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

create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text,
  email       text,
  document_id text,
  address     text,
  notes       text default '',
  active      boolean default true,
  store_id    uuid references stores(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
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

create table if not exists budgets (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  budget_number     text not null,
  status            text not null default 'draft'
    check (status in ('draft','sent','approved','rejected','expired')),
  items             jsonb not null default '[]',
  subtotal          numeric not null default 0,
  notes             text default '',
  valid_until       date,
  posted_to_account boolean default false,
  store_id          uuid references stores(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
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

create table if not exists client_account_entries (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  budget_id     uuid references budgets(id) on delete set null,
  movement_type text not null check (movement_type in ('debit','credit')),
  amount        numeric not null default 0,
  description   text not null,
  store_id      uuid references stores(id),
  created_at    timestamptz default now()
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

-- shift_logs con campos extendidos para POSv2
create table if not exists shift_logs (
  id               uuid primary key default gen_random_uuid(),
  cajero           text not null,
  inicio           timestamptz,
  fin              timestamptz,
  monto_inicial    numeric default 0,
  monto_esperado   numeric default 0,
  monto_real       numeric default 0,
  diferencia       numeric default 0,
  total_ventas     int default 0,
  total_recaudado  numeric default 0,
  total_efectivo   numeric default 0,
  total_digital    numeric default 0,
  observaciones    text default '',
  store_id         uuid references stores(id),
  created_at       timestamptz default now()
);

create table if not exists open_shifts (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid references stores(id),
  cajero     text not null,
  inicio     timestamptz default now()
);

-- ── Índices ───────────────────────────────────────────────────────
create index if not exists idx_products_active        on products(active);
create index if not exists idx_products_store         on products(store_id);
create index if not exists idx_products_barcode       on products(barcode);
create index if not exists idx_clients_store          on clients(store_id);
create index if not exists idx_clients_active         on clients(active);
create index if not exists idx_sales_created          on sales(created_at desc);
create index if not exists idx_sales_store            on sales(store_id);
create index if not exists idx_budgets_client         on budgets(client_id);
create index if not exists idx_budgets_store          on budgets(store_id);
create index if not exists idx_budgets_created        on budgets(created_at desc);
create index if not exists idx_expenses_date          on expenses(date desc);
create index if not exists idx_expenses_store         on expenses(store_id);
create index if not exists idx_client_account_client  on client_account_entries(client_id);
create index if not exists idx_client_account_store   on client_account_entries(store_id);
create index if not exists idx_client_account_created on client_account_entries(created_at desc);
create index if not exists idx_purchases_created      on purchases(created_at desc);
create index if not exists idx_purchases_store        on purchases(store_id);
create index if not exists idx_fiados_store           on fiados(store_id);
create index if not exists idx_shiftlogs_store        on shift_logs(store_id);

-- ── Row Level Security ─────────────────────────────────────────────
alter table stores               enable row level security;
alter table user_profiles        disable row level security;
alter table products             enable row level security;
alter table clients              enable row level security;
alter table sales                enable row level security;
alter table budgets              enable row level security;
alter table expenses             enable row level security;
alter table client_account_entries enable row level security;
alter table purchases            enable row level security;
alter table fiados               enable row level security;
alter table shift_logs           enable row level security;
alter table open_shifts          enable row level security;

create policy "stores_auth"         on stores       for select using (auth.role() = 'authenticated');
create policy "auth_all_products"   on products     for all    using (auth.role() = 'authenticated');
create policy "auth_all_clients"    on clients      for all    using (auth.role() = 'authenticated');
create policy "auth_all_sales"      on sales        for all    using (auth.role() = 'authenticated');
create policy "auth_all_budgets"    on budgets      for all    using (auth.role() = 'authenticated');
create policy "auth_all_expenses"   on expenses     for all    using (auth.role() = 'authenticated');
create policy "auth_all_cc"         on client_account_entries for all using (auth.role() = 'authenticated');
create policy "auth_all_purchases"  on purchases    for all    using (auth.role() = 'authenticated');
create policy "auth_all_fiados"     on fiados       for all    using (auth.role() = 'authenticated');
create policy "auth_all_shiftlogs"  on shift_logs   for all    using (auth.role() = 'authenticated');
create policy "auth_all_openshifts" on open_shifts  for all    using (auth.role() = 'authenticated');

-- ── Funciones ──────────────────────────────────────────────────────
create or replace function is_admin()
  returns boolean language sql security definer as $$
  select exists (
    select 1 from user_profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function get_my_role()
  returns text language sql security definer as $$
  select role from user_profiles where id = auth.uid();
$$;

-- ── Store demo ─────────────────────────────────────────────────────
insert into stores (id, name, type) values
  ('00000000-0000-0000-0000-000000000001', 'Glivac', 'local')
on conflict do nothing;
