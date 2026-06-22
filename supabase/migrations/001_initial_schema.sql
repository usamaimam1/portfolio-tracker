-- PSX Portfolio Tracker — initial schema

create table indices (
  code text primary key,
  name text not null
);

insert into indices (code, name) values
  ('KMI30', 'KMI-30 Index'),
  ('KSE100', 'KSE-100 Index');

create table index_syncs (
  id uuid primary key default gen_random_uuid(),
  index_code text not null references indices(code),
  synced_at timestamptz not null default now()
);

create index index_syncs_code_synced_idx on index_syncs (index_code, synced_at desc);

create table index_constituents (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid not null references index_syncs(id) on delete cascade,
  symbol text not null,
  name text not null,
  weight_pct numeric(10, 4) not null,
  price numeric(14, 4) not null,
  prev_close numeric(14, 4),
  volume bigint,
  market_cap_m numeric(16, 2),
  unique (sync_id, symbol)
);

create table stock_prices (
  symbol text primary key,
  name text,
  price numeric(14, 4) not null,
  prev_close numeric(14, 4),
  updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  type text not null check (type in ('buy', 'sell')),
  quantity numeric(14, 4) not null check (quantity > 0),
  price_per_share numeric(14, 4) not null check (price_per_share > 0),
  fees numeric(14, 4) not null default 0,
  trade_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on transactions (user_id, trade_date desc);

-- RLS
alter table index_syncs enable row level security;
alter table index_constituents enable row level security;
alter table stock_prices enable row level security;
alter table transactions enable row level security;
alter table indices enable row level security;

create policy "indices are readable by authenticated users"
  on indices for select to authenticated using (true);

create policy "index_syncs are readable by authenticated users"
  on index_syncs for select to authenticated using (true);

create policy "index_constituents are readable by authenticated users"
  on index_constituents for select to authenticated using (true);

create policy "stock_prices are readable by authenticated users"
  on stock_prices for select to authenticated using (true);

create policy "users manage own transactions"
  on transactions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role bypasses RLS for sync function writes

create or replace function get_latest_sync_id(p_index_code text)
returns uuid
language sql
stable
as $$
  select id from index_syncs
  where index_code = p_index_code
  order by synced_at desc
  limit 1;
$$;
