-- Root cause of "blocked user can still join/see the room": RLS policies
-- that check the blocks table run as the CALLING user, who (by the
-- read_own_blocks policy) can only see rows where THEY are the blocker.
-- So when the room owner blocked a visitor, the visitor's own join
-- attempt can't see that row to detect it — the check silently passes.
-- Fix: a security-definer helper that bypasses RLS internally, so the
-- check is accurate no matter who's asking.
create or replace function is_blocked_pair(a uuid, b uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

drop policy if exists join_room on room_members;
create policy join_room on room_members for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from rooms r where r.id = room_id and is_blocked_pair(auth.uid(), r.owner_id)
    )
  );

-- Same bug affected the reverse-direction check here (a recipient who
-- blocked the sender couldn't be detected by the sender's own query).
drop policy if exists send_own_messages on dm_messages;
create policy send_own_messages on dm_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from dm_threads t
      where t.id = thread_id
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
        and not is_blocked_pair(auth.uid(), case when t.user_a = auth.uid() then t.user_b else t.user_a end)
    )
  );

-- Blocking is now visible symmetrically: you can see a block involving
-- you in EITHER role, so Discover/Rooms can hide each other from both
-- sides, not just the blocker's side. (We're not building a "someone
-- blocked you" notification — this only powers quiet list-filtering.)
drop policy if exists read_own_blocks on blocks;
create policy read_own_blocks on blocks for select
  using (blocker_id = auth.uid() or blocked_id = auth.uid());
