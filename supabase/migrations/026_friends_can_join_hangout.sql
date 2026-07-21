-- The invite-only model (019) turned out to have no door in when the owner
-- isn't actively online: the only way to create a room_invites row is the
-- owner clicking Invite from their own Home screen, and that's disabled
-- for offline friends. So a friend who wants to join has no path at all
-- unless the owner happens to be online, sees them as online, and invites
-- them at that exact moment.
--
-- Hangouts are meant to be friends-only, not invite-only in that strict a
-- sense - so being an existing friend of the owner is now sufficient on
-- its own. room_invites/invite_friend_to_room stay as-is (a "come join
-- me" nudge), just no longer the only door.
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
          or exists (
            select 1 from friendships f
            where f.user_a = least(r.owner_id, auth.uid())
              and f.user_b = greatest(r.owner_id, auth.uid())
          )
        )
    )
  );
