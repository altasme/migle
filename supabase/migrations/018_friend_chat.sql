-- Friends get persistent chat, per CLAUDE.md Part 4 item 4. Reuses the
-- existing dm_threads/dm_messages tables and RLS (block checks etc. all
-- already apply) rather than building a parallel chat system. Unlike
-- approach_user() (stranger DMs, coin cost, starts 'pending'), this
-- requires an existing friendship and skips straight to 'accepted' since
-- consent already happened via the mutual like.
create or replace function open_friend_chat(p_friend uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_me uuid := auth.uid();
  v_a uuid := least(v_me, p_friend);
  v_b uuid := greatest(v_me, p_friend);
  v_thread uuid;
begin
  if not exists (select 1 from friendships where user_a = v_a and user_b = v_b) then
    raise exception 'not friends';
  end if;

  select id into v_thread from dm_threads where user_a = v_a and user_b = v_b;

  if v_thread is null then
    insert into dm_threads (user_a, user_b, initiator, status)
    values (v_a, v_b, v_me, 'accepted')
    returning id into v_thread;
  end if;

  return jsonb_build_object('thread_id', v_thread);
end;
$$;
