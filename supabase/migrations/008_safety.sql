-- blocks/reports had no RLS at all — anyone could read who blocked/
-- reported whom, or forge a block/report on someone else's behalf.
alter table blocks enable row level security;
alter table reports enable row level security;

-- You can only see who YOU blocked, not who blocked you (privacy for
-- the blocker's decision) and not anyone else's block list.
create policy read_own_blocks on blocks for select
  using (blocker_id = auth.uid());

create policy create_own_block on blocks for insert
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

create policy delete_own_block on blocks for delete
  using (blocker_id = auth.uid());

-- Reports are only visible to the person who filed them — not the
-- accused, not other users. No update/delete: moderation review of the
-- `status` field is a future admin-tooling concern, not a client write.
create policy read_own_reports on reports for select
  using (reporter_id = auth.uid());

create policy create_own_report on reports for insert
  with check (reporter_id = auth.uid() and reported_id <> auth.uid());

-- Room owner can mute or remove a member. Checked server-side against
-- rooms.owner_id — never trust a client-side "I'm the owner" claim.
create or replace function owner_mute_member(p_room uuid, p_user uuid, p_muted boolean)
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'not the room owner';
  end if;
  update room_members set is_muted = p_muted where room_id = p_room and user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function owner_kick_member(p_room uuid, p_user uuid)
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'not the room owner';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot kick yourself';
  end if;
  delete from room_members where room_id = p_room and user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

-- Block-aware DM approach: can't start (or restart) a conversation with
-- someone who has blocked you, or whom you've blocked.
create or replace function approach_user(p_to uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_from   uuid := auth.uid();
  v_cost   int;
  v_a      uuid;
  v_b      uuid;
  v_thread uuid;
begin
  if v_from = p_to then raise exception 'cannot approach yourself'; end if;

  if exists (
    select 1 from blocks
    where (blocker_id = v_from and blocked_id = p_to)
       or (blocker_id = p_to and blocked_id = v_from)
  ) then
    raise exception 'cannot approach this user';
  end if;

  select (value #>> '{}')::int into v_cost from app_config where key = 'dm_approach_cost_coins';
  v_cost := coalesce(v_cost, 0);

  v_a := least(v_from, p_to);
  v_b := greatest(v_from, p_to);

  select id into v_thread from dm_threads where user_a = v_a and user_b = v_b;

  if v_thread is not null then
    return jsonb_build_object('ok', true, 'thread_id', v_thread, 'spent', 0);
  end if;

  if v_cost > 0 then
    update wallets set coins = coins - v_cost where user_id = v_from;
    insert into transactions (user_id, currency, amount, source)
      values (v_from, 'coins', -v_cost, 'dm_approach');
  end if;

  insert into dm_threads (user_a, user_b, initiator, status)
    values (v_a, v_b, v_from, 'pending')
    returning id into v_thread;

  return jsonb_build_object('ok', true, 'thread_id', v_thread, 'spent', v_cost);
end $$;

-- Extend existing DM RLS to also hide/block messages between users who
-- have blocked each other, in either direction.
drop policy if exists read_own_messages on dm_messages;
create policy read_own_messages on dm_messages for select
  using (
    exists (
      select 1 from dm_threads t
      where t.id = dm_messages.thread_id
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
    and not exists (
      select 1 from blocks where blocker_id = auth.uid() and blocked_id = dm_messages.sender_id
    )
  );

drop policy if exists send_own_messages on dm_messages;
create policy send_own_messages on dm_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from dm_threads t
      where t.id = thread_id
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
        and not exists (
          select 1 from blocks b
          where (b.blocker_id = auth.uid()
                 and b.blocked_id = (case when t.user_a = auth.uid() then t.user_b else t.user_a end))
             or (b.blocked_id = auth.uid()
                 and b.blocker_id = (case when t.user_a = auth.uid() then t.user_b else t.user_a end))
        )
    )
  );
