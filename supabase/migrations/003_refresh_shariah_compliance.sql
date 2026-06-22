-- Refresh Shariah compliance flags from KMI-30 symbol list on every sync.

create or replace function refresh_shariah_compliance(p_kmi30_symbols text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Single update with WHERE satisfies Supabase pg_safeupdate (bare UPDATE is rejected).
  update stock_prices
    set shariah_compliant = (symbol = any(p_kmi30_symbols))
    where symbol is not null;
end;
$$;
