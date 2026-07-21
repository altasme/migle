-- Watch Party: owner can hand the mic to someone in the room (a listener,
-- not yet seated) instead of them having to self-seat, so a hosted karaoke
-- night can be curated rather than first-come-first-seated. Same pattern as
-- owner_mute_member/owner_kick_member - room_members' update policy is
-- self-scoped (user_id = auth.uid()), so assigning a SEAT for someone else
-- has to go through a security definer RPC, checked server-side against
-- rooms.owner_id.
create or replace function owner_pass_mic(p_room uuid, p_user uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_max_seats int;
  v_seat int;
begin
  if not exists (select 1 from rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'not the room owner';
  end if;
  if not exists (select 1 from room_members where room_id = p_room and user_id = p_user) then
    raise exception 'that user is not in this room';
  end if;

  select max_seats into v_max_seats from rooms where id = p_room;

  select gs.seat into v_seat
  from generate_series(0, v_max_seats - 1) as gs(seat)
  where gs.seat not in (
    select seat_index from room_members
    where room_id = p_room and seat_index is not null
  )
  order by gs.seat
  limit 1;

  if v_seat is null then
    raise exception 'no free mic seats';
  end if;

  update room_members set seat_index = v_seat, is_muted = false
    where room_id = p_room and user_id = p_user;

  return jsonb_build_object('ok', true, 'seat', v_seat);
end $$;
