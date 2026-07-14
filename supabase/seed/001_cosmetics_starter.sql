-- Starter cosmetic_items rows for the Avatars step. Matches the IDs and
-- values in seed.sql exactly (safe to run whether or not seed.sql already
-- ran — ON CONFLICT DO NOTHING). These are the free/cheap coin-priced
-- items; premium gems-only slots (frame/entrance/wings/aura/pet) are not
-- included since gems don't exist in v1.
insert into cosmetic_items (id, name, slot, z_index, asset_path, price_coins) values
  ('body_01', 'Body — Light',  'body', 20, '/cos/body_01.png', 0),
  ('body_02', 'Body — Tan',    'body', 20, '/cos/body_02.png', 0),
  ('body_03', 'Body — Brown',  'body', 20, '/cos/body_03.png', 0),
  ('body_04', 'Body — Deep',   'body', 20, '/cos/body_04.png', 0)
on conflict (id) do nothing;

insert into cosmetic_items (id, name, slot, z_index, asset_path, price_coins) values
  ('hair_01', 'Short Black',  'hair_front', 90, '/cos/hair_01.png', 0),
  ('hair_02', 'Long Black',   'hair_front', 90, '/cos/hair_02.png', 0)
on conflict (id) do nothing;

insert into cosmetic_items (id, name, slot, z_index, asset_path, price_coins) values
  ('face_01', 'Calm',  'face', 70, '/cos/face_01.png', 0),
  ('face_02', 'Happy', 'face', 70, '/cos/face_02.png', 0)
on conflict (id) do nothing;

insert into cosmetic_items (id, name, slot, z_index, asset_path, price_coins) values
  ('top_01', 'White Tee',    'top', 50, '/cos/top_01.png', 0),
  ('top_02', 'Black Hoodie', 'top', 50, '/cos/top_02.png', 0)
on conflict (id) do nothing;

insert into cosmetic_items (id, name, slot, z_index, asset_path, hides_slots, price_coins) values
  ('hat_01', 'Cap', 'hat', 110, '/cos/hat_01.png', '{hair_front}', 250)
on conflict (id) do nothing;
