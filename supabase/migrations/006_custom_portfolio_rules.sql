-- Custom portfolio remainder rules live in portfolio_settings.rules jsonb:
-- rest_distribution: 'equal' | 'custom'
-- custom_rest_weights: { "SYMBOL": 25, ... }  (percent of remainder bucket, sum = 100)

comment on column portfolio_settings.rules is
  'Per-index rules: top_n_count, top_n_budget_pct, enabled, rest_distribution, custom_rest_weights';
