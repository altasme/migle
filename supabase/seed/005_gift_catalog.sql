-- Starter gift catalog for the Gifts step. Matches seed.sql exactly —
-- safe to run whether or not seed.sql already ran.
insert into gift_catalog (id, name, price_coins, anim_path) values
  ('rose',      'Rose',       10,  '/anim/rose.json'),
  ('coffee',    'Coffee',     25,  '/anim/coffee.json'),
  ('cake',      'Cake',       50,  '/anim/cake.json'),
  ('teddy',     'Teddy Bear', 100, '/anim/teddy.json'),
  ('balloons',  'Balloons',   250, '/anim/balloons.json'),
  ('fireworks', 'Fireworks',  500, '/anim/fireworks.json')
on conflict (id) do nothing;
