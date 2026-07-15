-- Interests + "looking for" tags, collected once right after username claim.
-- onboarded gates the new step so it only shows for accounts created after
-- this migration — existing accounts are backfilled to true below so they
-- aren't retroactively sent through it.
alter table profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists looking_for text[] not null default '{}',
  add column if not exists onboarded boolean not null default false;

update profiles set onboarded = true where onboarded = false;
