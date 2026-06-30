-- Broker CSV import fields and idempotent import batches.

create table transaction_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_hash text not null,
  transaction_type text not null check (transaction_type in ('buy', 'sell')),
  filename text,
  row_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, content_hash)
);

create index transaction_import_batches_user_idx on transaction_import_batches (user_id, created_at desc);

alter table transactions
  add column if not exists market text,
  add column if not exists house_account text,
  add column if not exists commission_amount numeric(14, 4) not null default 0,
  add column if not exists cvt_wht numeric(14, 4) not null default 0,
  add column if not exists secp_laga numeric(14, 4) not null default 0,
  add column if not exists psx_laga numeric(14, 4) not null default 0,
  add column if not exists sales_tax numeric(14, 4) not null default 0,
  add column if not exists nccpl numeric(14, 4) not null default 0,
  add column if not exists advance_tax numeric(14, 4) not null default 0,
  add column if not exists cdc_charges numeric(14, 4) not null default 0,
  add column if not exists gross_amount numeric(14, 4),
  add column if not exists source text not null default 'manual' check (source in ('manual', 'csv')),
  add column if not exists import_batch_id uuid references transaction_import_batches(id) on delete set null,
  add column if not exists row_fingerprint text;

create unique index transactions_user_row_fingerprint_idx
  on transactions (user_id, row_fingerprint)
  where row_fingerprint is not null;

alter table transaction_import_batches enable row level security;

create policy "users manage own import batches"
  on transaction_import_batches for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
