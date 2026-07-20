-- Private hangouts: invite-only, friends-only. The old open-room model let
-- anyone with a slug join; this closes that gap so a room can only be
-- joined by its owner or someone explicitly invited.
create table if not exists room_invites (
  room_id uuid not null references rooms(id) on delete cascade,
  invited_user_id uuid not null references profiles(id) on delete cascade,
  invited_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, invited_user_id)
);

alter table room_invites enable row level security;

create policy read_relevant_invites on room_invites for select
  using (invited_user_id = auth.uid() or invited_by = auth.uid());

-- No insert/update/delete policy - only via invite_friend_to_room() below.

-- Host-only, friends-only: you can't invite a stranger, and you can't
-- invite someone to a room you don't own.
create or replace function invite_friend_to_room(p_room uuid, p_friend uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_a uuid := least(auth.uid(), p_friend);
  v_b uuid := greatest(auth.uid(), p_friend);
begin
  if not exists (select 1 from rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'not the room owner';
  end if;
  if not exists (select 1 from friendships where user_a = v_a and user_b = v_b) then
    raise exception 'not friends';
  end if;

  insert into room_invites (room_id, invited_user_id, invited_by)
  values (p_room, p_friend, auth.uid())
  on conflict (room_id, invited_user_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

-- Joining now requires being the owner or explicitly invited, on top of
-- the existing block check.
drop policy if exists join_room on room_members;
create policy join_room on room_members for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from rooms r where r.id = room_id and is_blocked_pair(auth.uid(), r.owner_id)
    )
    and exists (
      select 1 from rooms r
      where r.id = room_id
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from room_invites i
            where i.room_id = room_id and i.invited_user_id = auth.uid()
          )
        )
    )
  );
