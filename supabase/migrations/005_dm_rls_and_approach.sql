-- dm_threads/dm_messages had NO RLS at all — any authenticated user could
-- read or write anyone's private DMs directly via the API. This locks
-- both down to participants only.
alter table dm_threads enable row level security;
alter table dm_messages enable row level security;

drop policy if exists read_own_threads on dm_threads;
create policy read_own_threads on dm_threads for select
  using (user_a = auth.uid() or user_b = auth.uid());

-- No insert policy: threads are only created via approach_user() below,
-- so canonical ordering (user_a < user_b) and the approach cost are
-- always enforced, never trusted to the client.
drop policy if exists update_own_threads on dm_threads;
create policy update_own_threads on dm_threads for update
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists read_own_messages on dm_messages;
create policy read_own_messages on dm_messages for select
  using (exists (
    select 1 from dm_threads t
    where t.id = dm_messages.thread_id
      and (t.user_a = auth.uid() or t.user_b = auth.uid())
  ));

drop policy if exists send_own_messages on dm_messages;
create policy send_own_messages on dm_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from dm_threads t
      where t.id = thread_id
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

-- Creates (or returns the existing) thread with the other user, charging
-- app_config.dm_approach_cost_coins if it's ever turned above 0. Canonical
-- ordering (user_a = the smaller uuid) means the unique(user_a, user_b)
-- constraint always catches duplicates regardless of who approaches whom.
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
