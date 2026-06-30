-- Daily portfolio snapshots and email report preferences.

create table portfolio_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  session text not null check (session in ('open', 'close')),
  total_value numeric(16, 2) not null,
  total_cost numeric(16, 2) not null,
  unrealized_pnl numeric(16, 2) not null,
  holdings jsonb not null default '[]'::jsonb,
  index_metrics jsonb not null default '{}'::jsonb,
  preferred_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date, session)
);

create index portfolio_daily_snapshots_user_date_idx
  on portfolio_daily_snapshots (user_id, snapshot_date desc);

create table user_report_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_reports_enabled boolean not null default true,
  email_address text,
  updated_at timestamptz not null default now()
);

alter table portfolio_daily_snapshots enable row level security;
alter table user_report_settings enable row level security;

create policy "users read own snapshots"
  on portfolio_daily_snapshots for select to authenticated
  using (auth.uid() = user_id);

create policy "users manage own report settings"
  on user_report_settings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
