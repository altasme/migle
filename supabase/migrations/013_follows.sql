-- Friends graph: simple asymmetric follow (like Followers/Following), no
-- accept/request step. Counts and lists derive directly from this table.
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

alter table follows enable row level security;

create policy read_all_follows on follows for select using (true);

create policy follow_as_self on follows for insert
  with check (follower_id = auth.uid() and not is_blocked_pair(auth.uid(), following_id));

create policy unfollow_as_self on follows for delete
  using (follower_id = auth.uid());

-- Blocking severs any existing follow in either direction, same as it
-- already does for room membership (see 009_block_bans_from_room.sql).
create or replace function handle_block_removes_follows()
returns trigger language plpgsql security definer as $$
begin
  delete from follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end $$;

drop trigger if exists on_block_removes_follows on blocks;
create trigger on_block_removes_follows
  after insert on blocks
  for each row execute function handle_block_removes_follows();
