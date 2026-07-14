-- Replaces the flat-color placeholder body/hair items with real,
-- correctly-licensed LPC (Liberated Pixel Cup) art. Body sheets are by
-- Stephen Challener (OGA-BY 3.0); hair sheets are by Manuel Riecke
-- (CC-BY-SA 3.0 / GPL 3.0) — both apply cleanly to these free slots.
-- Old placeholder rows are deactivated (not deleted) so anyone who already
-- equipped one keeps rendering correctly; they just won't appear as a
-- choice in the wardrobe going forward.
update cosmetic_items set is_active = false
  where id in ('body_01', 'body_02', 'body_03', 'body_04', 'hair_01', 'hair_02');

insert into cosmetic_items (id, name, slot, z_index, asset_path, price_coins) values
  ('lpc_body_m', 'Body — M', 'body', 20, '/cos/lpc_body_m.png', 0),
  ('lpc_body_f', 'Body — F', 'body', 20, '/cos/lpc_body_f.png', 0)
on conflict (id) do nothing;

insert into cosmetic_items (id, name, slot, z_index, asset_path, price_coins) values
  ('lpc_hair_m_01', 'Hair M 1', 'hair_front', 90, '/cos/lpc_hair_m_01.png', 0),
  ('lpc_hair_m_02', 'Hair M 2', 'hair_front', 90, '/cos/lpc_hair_m_02.png', 0),
  ('lpc_hair_m_03', 'Hair M 3', 'hair_front', 90, '/cos/lpc_hair_m_03.png', 0),
  ('lpc_hair_m_04', 'Hair M 4', 'hair_front', 90, '/cos/lpc_hair_m_04.png', 0),
  ('lpc_hair_m_05', 'Hair M 5', 'hair_front', 90, '/cos/lpc_hair_m_05.png', 0),
  ('lpc_hair_m_06', 'Hair M 6', 'hair_front', 90, '/cos/lpc_hair_m_06.png', 0),
  ('lpc_hair_m_07', 'Hair M 7', 'hair_front', 90, '/cos/lpc_hair_m_07.png', 0),
  ('lpc_hair_m_08', 'Hair M 8', 'hair_front', 90, '/cos/lpc_hair_m_08.png', 0),
  ('lpc_hair_f_01', 'Hair F 1', 'hair_front', 90, '/cos/lpc_hair_f_01.png', 0),
  ('lpc_hair_f_02', 'Hair F 2', 'hair_front', 90, '/cos/lpc_hair_f_02.png', 0),
  ('lpc_hair_f_03', 'Hair F 3', 'hair_front', 90, '/cos/lpc_hair_f_03.png', 0),
  ('lpc_hair_f_04', 'Hair F 4', 'hair_front', 90, '/cos/lpc_hair_f_04.png', 0),
  ('lpc_hair_f_05', 'Hair F 5', 'hair_front', 90, '/cos/lpc_hair_f_05.png', 0),
  ('lpc_hair_f_06', 'Hair F 6', 'hair_front', 90, '/cos/lpc_hair_f_06.png', 0),
  ('lpc_hair_f_07', 'Hair F 7', 'hair_front', 90, '/cos/lpc_hair_f_07.png', 0)
on conflict (id) do nothing;
