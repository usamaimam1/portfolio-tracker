-- Per-user portfolio metric rules (top-N concentration, primary index).

create table portfolio_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_index text not null default 'KMI30' references indices(code),
  rules jsonb not null default '{
    "KMI30": {"top_n_count": 15, "top_n_budget_pct": 80, "enabled": true},
    "KSE100": {"top_n_count": 15, "top_n_budget_pct": 80, "enabled": true}
  }'::jsonb,
  updated_at timestamptz not null default now()
);

alter table portfolio_settings enable row level security;

create policy "users manage own portfolio settings"
  on portfolio_settings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
