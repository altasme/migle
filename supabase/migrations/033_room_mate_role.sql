-- Room mates: owner-delegated authority. The owner can promote any
-- current member to "roommate," who then gets the same moderation
-- authority as the owner (mute, kick, invite friends) EXCEPT they can
-- never mute/kick/demote the actual owner. No cap on how many.
alter table room_members
  add column if not exists role text not null default 'member' check (role in ('member', 'roommate'));

-- Owner-only: promote/demote a current member. Can't be used on the
-- owner themself (they're not a "member" role to begin with - ownership
-- is tracked on rooms.owner_id, not here).
create or replace function set_room_mate(p_room uuid, p_user uuid, p_is_roommate boolean)
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'not the room owner';
  end if;
  if exists (select 1 from rooms where id = p_room and owner_id = p_user) then
    raise exception 'the owner cannot be a roommate';
  end if;
  update room_members
     set role = case when p_is_roommate then 'roommate' else 'member' end
   where room_id = p_room and user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

-- Owner OR any current roommate may moderate - but never the owner
-- themself, even if the caller is a roommate.
create or replace function owner_mute_member(p_room uuid, p_user uuid, p_muted boolean)
returns jsonb language plpgsql security definer as $$
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
  if exists (select 1 from rooms where id = p_room and owner_id = p_user) then
    raise exception 'cannot moderate the room owner';
  end if;
  update room_members set is_muted = p_muted where room_id = p_room and user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function owner_kick_member(p_room uuid, p_user uuid)
returns jsonb language plpgsql security definer as $$
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
  if p_user = auth.uid() then
    raise exception 'cannot kick yourself';
  end if;
  if exists (select 1 from rooms where id = p_room and owner_id = p_user) then
    raise exception 'cannot kick the room owner';
  end if;
  delete from room_members where room_id = p_room and user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

-- Roommates can invite friends too, same as the owner.
create or replace function invite_friend_to_room(p_room uuid, p_friend uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_a uuid := least(auth.uid(), p_friend);
  v_b uuid := greatest(auth.uid(), p_friend);
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
  if not exists (select 1 from friendships where user_a = v_a and user_b = v_b) then
    raise exception 'not friends';
  end if;
  if is_blocked_pair(auth.uid(), p_friend) then
    raise exception 'cannot invite this user';
  end if;

  insert into room_invites (room_id, invited_user_id, invited_by)
  values (p_room, p_friend, auth.uid())
  on conflict (room_id, invited_user_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

-- Room settings (name/topic/theme) previously went through a direct
-- table UPDATE relying on the owner-only RLS policy on rooms - same gap
-- watch party had. Roommates get this too ("same authority... except
-- kick and ban the owner").
create or replace function update_room_settings(p_room uuid, p_name text, p_topic text, p_theme text)
returns void language plpgsql security definer as $$
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
  if p_name is null or trim(p_name) = '' then
    raise exception 'name required';
  end if;

  update rooms
     set name = trim(p_name),
         topic = nullif(trim(coalesce(p_topic, '')), ''),
         theme = coalesce(p_theme, theme)
   where id = p_room;
end $$;
