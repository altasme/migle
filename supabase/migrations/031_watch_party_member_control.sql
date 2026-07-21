-- Watch Party / Karaoke Mode could only ever be driven by the room owner,
-- because writing watch_party_* state went straight through the rooms
-- table's owner-only UPDATE policy (see 024's comment). Hangouts are
-- friends-only already (joining requires an existing friendship or a live
-- invite) - there's no reason only whoever happens to own the room can
-- start one. "Play music" needed no change (it's pure LiveKit publish +
-- realtime broadcast, no rooms-table write), but this one did.
--
-- watch_party_host_id tracks who's currently driving it (independent of
-- room ownership) - a client that reloads the page needs this to know
-- whether IT is the one that should resume sending the sync heartbeat,
-- same way watch_party_video_id already tells a fresh client what's
-- playing.
alter table rooms
  add column if not exists watch_party_host_id uuid references profiles(id);

-- Any current room member may now drive watch party state. Split into
-- three RPCs matching the three call sites exactly, rather than one
-- generic "update these columns" RPC - the sync-heartbeat write only ever
-- touches position/is_playing (video_id/mode must stay untouched, and the
-- heartbeat's closure over those can go stale), so a single do-everything
-- RPC risked a stale call clobbering the video mid-party.
create or replace function start_watch_party(p_room uuid, p_video_id text, p_mode text)
returns void
language plpgsql security definer as $$
begin
  if p_mode not in ('karaoke', 'together') then
    raise exception 'invalid mode';
  end if;
  if not exists (select 1 from room_members where room_id = p_room and user_id = auth.uid()) then
    raise exception 'not a member of this room';
  end if;

  update rooms
     set watch_party_video_id = p_video_id,
         watch_party_mode = p_mode,
         watch_party_position_seconds = 0,
         watch_party_is_playing = true,
         watch_party_updated_at = now(),
         watch_party_host_id = auth.uid()
   where id = p_room;
end;
$$;

-- Only the current host's heartbeat should be able to move the
-- authoritative position - guard in the WHERE (a no-op update for anyone
-- else) rather than raising, since a client can briefly still believe
-- it's host right after someone else takes over.
create or replace function sync_watch_party_position(p_room uuid, p_position_seconds numeric, p_is_playing boolean)
returns void
language plpgsql security definer as $$
begin
  update rooms
     set watch_party_position_seconds = p_position_seconds,
         watch_party_is_playing = p_is_playing,
         watch_party_updated_at = now()
   where id = p_room
     and watch_party_host_id = auth.uid();
end;
$$;

create or replace function stop_watch_party(p_room uuid)
returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from room_members where room_id = p_room and user_id = auth.uid()) then
    raise exception 'not a member of this room';
  end if;

  update rooms
     set watch_party_video_id = null,
         watch_party_mode = null,
         watch_party_position_seconds = 0,
         watch_party_is_playing = true,
         watch_party_updated_at = null,
         watch_party_host_id = null
   where id = p_room;
end;
$$;
