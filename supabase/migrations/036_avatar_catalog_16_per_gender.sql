-- Replaces the old 3-style avatar catalog (Street/Shadow under Male,
-- Sakura under Female - 3 looks total, unevenly split) with a real
-- catalog: 16 looks per gender, 32 total, matching the new art. Old items
-- are deactivated, not deleted, so anyone who already equipped/owns one
-- keeps their look and their inventory row stays intact - same pattern as
-- the LPC->PixelLab retirement in seed 002/003.
update cosmetic_items set is_active = false
 where slot = 'body' and id in (
   'av_male_hoodie_01', 'av_male_hoodie_02', 'av_male_hoodie_03',
   'av_male_dark_01', 'av_male_dark_02', 'av_male_dark_03',
   'av_female_pink_01', 'av_female_pink_02', 'av_female_pink_03'
 );

insert into cosmetic_items (id, name, slot, z_index, asset_path, price_coins) values
  ('av_male_01', 'Look 1', 'body', 20, '/cos/av_male_01.png', 0),
  ('av_male_02', 'Look 2', 'body', 20, '/cos/av_male_02.png', 0),
  ('av_male_03', 'Look 3', 'body', 20, '/cos/av_male_03.png', 0),
  ('av_male_04', 'Look 4', 'body', 20, '/cos/av_male_04.png', 0),
  ('av_male_05', 'Look 5', 'body', 20, '/cos/av_male_05.png', 0),
  ('av_male_06', 'Look 6', 'body', 20, '/cos/av_male_06.png', 0),
  ('av_male_07', 'Look 7', 'body', 20, '/cos/av_male_07.png', 0),
  ('av_male_08', 'Look 8', 'body', 20, '/cos/av_male_08.png', 0),
  ('av_male_09', 'Look 9', 'body', 20, '/cos/av_male_09.png', 0),
  ('av_male_10', 'Look 10', 'body', 20, '/cos/av_male_10.png', 0),
  ('av_male_11', 'Look 11', 'body', 20, '/cos/av_male_11.png', 0),
  ('av_male_12', 'Look 12', 'body', 20, '/cos/av_male_12.png', 0),
  ('av_male_13', 'Look 13', 'body', 20, '/cos/av_male_13.png', 0),
  ('av_male_14', 'Look 14', 'body', 20, '/cos/av_male_14.png', 0),
  ('av_male_15', 'Look 15', 'body', 20, '/cos/av_male_15.png', 0),
  ('av_male_16', 'Look 16', 'body', 20, '/cos/av_male_16.png', 0),
  ('av_female_01', 'Look 1', 'body', 20, '/cos/av_female_01.png', 0),
  ('av_female_02', 'Look 2', 'body', 20, '/cos/av_female_02.png', 0),
  ('av_female_03', 'Look 3', 'body', 20, '/cos/av_female_03.png', 0),
  ('av_female_04', 'Look 4', 'body', 20, '/cos/av_female_04.png', 0),
  ('av_female_05', 'Look 5', 'body', 20, '/cos/av_female_05.png', 0),
  ('av_female_06', 'Look 6', 'body', 20, '/cos/av_female_06.png', 0),
  ('av_female_07', 'Look 7', 'body', 20, '/cos/av_female_07.png', 0),
  ('av_female_08', 'Look 8', 'body', 20, '/cos/av_female_08.png', 0),
  ('av_female_09', 'Look 9', 'body', 20, '/cos/av_female_09.png', 0),
  ('av_female_10', 'Look 10', 'body', 20, '/cos/av_female_10.png', 0),
  ('av_female_11', 'Look 11', 'body', 20, '/cos/av_female_11.png', 0),
  ('av_female_12', 'Look 12', 'body', 20, '/cos/av_female_12.png', 0),
  ('av_female_13', 'Look 13', 'body', 20, '/cos/av_female_13.png', 0),
  ('av_female_14', 'Look 14', 'body', 20, '/cos/av_female_14.png', 0),
  ('av_female_15', 'Look 15', 'body', 20, '/cos/av_female_15.png', 0),
  ('av_female_16', 'Look 16', 'body', 20, '/cos/av_female_16.png', 0)
on conflict (id) do update set
  name = excluded.name,
  asset_path = excluded.asset_path,
  price_coins = excluded.price_coins,
  is_active = true;
