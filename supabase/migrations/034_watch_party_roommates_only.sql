-- Correction to 031: watch party/karaoke was opened up to every room
-- member. With room mates (033) now the actual mechanism for
-- owner-delegated authority, watch party/music should sit behind that
-- same gate - owner or roommate only, not every member.
create or replace function start_watch_party(p_room uuid, p_video_id text, p_mode text)
returns void
language plpgsql security definer as $$
begin
  if p_mode not in ('karaoke', 'together') then
    raise exception 'invalid mode';
  end if;
  if not exists (
    select 1 from rooms r
    where r.id = p_room
      and (
        r.owner_id = auth.uid()
        or exists (
          select 1 from room_members m
          where m.room_id = p_room and m.user_id = auth.uid() and m.role = 'roommate'
        )
      )
  ) then
    raise exception 'not authorized';
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

create or replace function stop_watch_party(p_room uuid)
returns void
language plpgsql security definer as $$
begin
  if not exists (
    select 1 from rooms r
    where r.id = p_room
      and (
        r.owner_id = auth.uid()
        or exists (
          select 1 from room_members m
          where m.room_id = p_room and m.user_id = auth.uid() and m.role = 'roommate'
        )
      )
  ) then
    raise exception 'not authorized';
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
