-- Migración: crear tablas clients, budgets y client_account_entries
-- Ejecutar en Supabase Dashboard → SQL Editor

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

create table if not exists budgets (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  budget_number     text not null,
  status            text not null default 'draft' check (status in ('draft','sent','approved','rejected','expired')),
  items             jsonb not null default '[]',
  subtotal          numeric not null default 0,
  notes             text default '',
  valid_until       date,
  posted_to_account boolean default false,
  store_id          uuid references stores(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
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

-- Índices
create index if not exists idx_clients_store          on clients(store_id);
create index if not exists idx_clients_active         on clients(active);
create index if not exists idx_budgets_client         on budgets(client_id);
create index if not exists idx_budgets_store          on budgets(store_id);
create index if not exists idx_budgets_created        on budgets(created_at desc);
create index if not exists idx_client_account_client  on client_account_entries(client_id);
create index if not exists idx_client_account_store   on client_account_entries(store_id);
create index if not exists idx_client_account_created on client_account_entries(created_at desc);

-- RLS
alter table clients              enable row level security;
alter table budgets              enable row level security;
alter table client_account_entries enable row level security;

create policy "auth_all_clients"        on clients              for all using (auth.role() = 'authenticated');
create policy "auth_all_budgets"        on budgets              for all using (auth.role() = 'authenticated');
create policy "auth_all_client_account" on client_account_entries for all using (auth.role() = 'authenticated');
