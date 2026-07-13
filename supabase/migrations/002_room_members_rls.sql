-- room_members had RLS disabled entirely, so any authenticated user could
-- write to any other user's row (steal seats, mute/unmute others). This
-- enables RLS with self-scoped policies, matching the profiles pattern.
alter table room_members enable row level security;

create policy read_room_members on room_members for select using (true);

create policy join_room on room_members for insert
  with check (user_id = auth.uid());

create policy update_own_membership on room_members for update
  using (user_id = auth.uid());

create policy leave_room on room_members for delete
  using (user_id = auth.uid());

-- Prevents two users racing for the same mic seat in the same room.
create unique index one_user_per_seat on room_members (room_id, seat_index)
  where seat_index is not null;
