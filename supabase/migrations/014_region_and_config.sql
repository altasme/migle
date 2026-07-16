-- Regional matching bucket. A correctable guess only, never shown to
-- other users or exposed anywhere in the UI — it's a matching key, not a
-- location feature.
alter table profiles
  add column if not exists region text not null default 'GLOBAL'
    check (region in ('PH', 'GLOBAL'));

-- Ships OFF, no UI toggle yet. The match queue reads this directly.
insert into app_config (key, value)
values ('allow_cross_region_match', 'false'::jsonb)
on conflict (key) do nothing;
