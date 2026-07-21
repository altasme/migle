-- Three independent fixes bundled together since they're all small and
-- non-breaking:

-- 1. "Friends can join anytime" (026) turned out to mean anytime FOREVER -
-- once a friend left, they could always let themselves back in even if
-- the owner had long since gone. The room should stay usable by whoever's
-- already inside even after the owner leaves (that's the whole point of
-- 026), but RE-entry - for anyone who isn't the owner - now requires the
-- owner to currently have an active room_members row of their own, i.e.
-- be back in the hangout. The owner's own path is untouched: they can
-- always walk back into their own room to reopen it.
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
          or (
            exists (select 1 from room_members m where m.room_id = room_id and m.user_id = r.owner_id)
            and (
              exists (
                select 1 from room_invites i
                where i.room_id = room_id and i.invited_user_id = auth.uid()
              )
              or exists (
                select 1 from friendships f
                where f.user_a = least(r.owner_id, auth.uid())
                  and f.user_b = greatest(r.owner_id, auth.uid())
              )
            )
          )
        )
    )
  );

-- 2. Hangout invites had no delete policy at all - they accumulated
-- forever and kept showing "X invited you to Y" even after being acted
-- on. Let the invited person clear their own invite once they've seen/
-- used it.
create policy dismiss_own_invite on room_invites for delete
  using (invited_user_id = auth.uid());

-- 3. Bio for the profile page.
alter table profiles
  add column if not exists bio text,
  add constraint bio_length check (bio is null or char_length(bio) <= 255);
