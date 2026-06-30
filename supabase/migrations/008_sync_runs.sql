-- Scheduled and manual sync audit log.

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by text not null,
  session text check (session in ('open', 'close', 'manual')),
  mode text not null,
  status text not null check (status in ('running', 'success', 'error')),
  counts jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index sync_runs_started_idx on sync_runs (started_at desc);

alter table sync_runs enable row level security;

create policy "sync_runs readable by authenticated users"
  on sync_runs for select to authenticated using (true);
