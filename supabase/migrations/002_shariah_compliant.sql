-- Shariah compliance: KMI-30 constituents are Shariah compliant.
-- KSE-100 stocks shared with KMI-30 inherit the same flag after sync.

alter table stock_prices
  add column if not exists shariah_compliant boolean not null default false;

create index if not exists stock_prices_shariah_idx on stock_prices (shariah_compliant);
