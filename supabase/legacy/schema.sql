create extension if not exists "uuid-ossp";

create table products (
  id               uuid primary key default uuid_generate_v4(),
  barcode          text unique,
  name             text not null,
  category         text default 'Otros',
  unit             text default 'unidad',
  current_stock    numeric default 0,
  min_stock        numeric default 0,
  purchase_price   numeric default 0,
  sale_price       numeric not null default 0,
  allow_negative_stock boolean default true,
  active           boolean default true,
  expiration_date  date,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table sales (
  id             uuid primary key default uuid_generate_v4(),
  sale_number    text not null,
  items          jsonb not null default '[]',
  total          numeric not null default 0,
  payment_method text not null default 'efectivo',
  cashier        text not null,
  notes          text default '',
  created_at     timestamptz default now()
);

create table expenses (
  id           uuid primary key default uuid_generate_v4(),
  description  text not null,
  amount       numeric not null default 0,
  category     text not null default 'Otros',
  expense_type text not null default 'variable',
  date         date not null default current_date,
  notes        text default '',
  purchase_id  uuid,
  created_at   timestamptz default now()
);

create table purchases (
  id             uuid primary key default uuid_generate_v4(),
  supplier       text default '',
  invoice_number text default '',
  items          jsonb not null default '[]',
  total          numeric not null default 0,
  notes          text default '',
  expense_id     uuid references expenses(id) on delete set null,
  created_at     timestamptz default now()
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin','employee')),
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "profiles_select_self" on user_profiles
  for select using (auth.uid() = id);

create policy "profiles_admins" on user_profiles
  for select using (exists (
    select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin'
  ));

alter table products  enable row level security;
alter table sales     enable row level security;
alter table expenses  enable row level security;
alter table purchases enable row level security;

create policy "auth_all_products"  on products  for all using (auth.role() = 'authenticated');
create policy "auth_all_sales"     on sales     for all using (auth.role() = 'authenticated');
create policy "auth_all_expenses"  on expenses  for all using (auth.role() = 'authenticated');
create policy "auth_all_purchases" on purchases for all using (auth.role() = 'authenticated');

create index idx_sales_created     on sales(created_at desc);
create index idx_expenses_date     on expenses(date desc);
create index idx_purchases_created on purchases(created_at desc);
create index idx_products_active   on products(active);
create index idx_products_barcode  on products(barcode);
