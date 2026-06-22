-- Full PSX listings indices (all shares + shariah all shares)

insert into indices (code, name) values
  ('ALLSHR', 'KSE All Share Index'),
  ('KMIALLSHR', 'KMI All Share Index')
on conflict (code) do nothing;
