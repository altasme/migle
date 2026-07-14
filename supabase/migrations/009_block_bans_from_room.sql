-- Blocking now also functions as a ban from rooms you own: a blocked
-- user can't join (or rejoin) your room, and if they're already in one
-- of your rooms when you block them, they're removed immediately.
drop policy if exists join_room on room_members;
create policy join_room on room_members for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from rooms r
      where r.id = room_id
        and exists (
          select 1 from blocks b
          where (b.blocker_id = r.owner_id and b.blocked_id = auth.uid())
             or (b.blocker_id = auth.uid() and b.blocked_id = r.owner_id)
        )
    )
  );

create or replace function handle_new_block()
returns trigger language plpgsql security definer as $$
begin
  delete from room_members
   where user_id = new.blocked_id
     and room_id in (select id from rooms where owner_id = new.blocker_id);
  return new;
end $$;

drop trigger if exists on_block_created on blocks;
create trigger on_block_created
  after insert on blocks
  for each row execute function handle_new_block();
