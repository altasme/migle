-- Makes the room itself the source of truth for an in-progress Watch
-- Party/Karaoke Mode session, instead of it living only in the owner's
-- live browser memory + realtime broadcasts. Whoever joins (or rejoins)
-- reads this straight off the room row, no round-trip to a possibly-not-
-- listening owner required.
--
-- No new RLS policy needed: rooms already has an owner-scoped update
-- policy (the same one room naming/theme already uses), so the owner's
-- client can write these columns directly and everyone else is denied by
-- the existing policy.
alter table rooms
  add column if not exists watch_party_video_id text,
  add column if not exists watch_party_mode text
    check (watch_party_mode in ('karaoke', 'together')),
  add column if not exists watch_party_position_seconds numeric not null default 0,
  add column if not exists watch_party_is_playing boolean not null default true,
  add column if not exists watch_party_updated_at timestamptz;
