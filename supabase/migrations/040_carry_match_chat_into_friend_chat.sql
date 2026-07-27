-- Text matches that turn into a mutual like hand off to the friend DM
-- thread (see the VibeMatch mutual-like change), but the actual
-- conversation was left behind in match_messages, tied to a session that
-- eventually gets cleaned up - the new thread started empty, looking like
-- the chat had been wiped. Carry it over.
--
-- p_match_session is optional so this stays backward compatible with the
-- existing Friends-list "chat" button, which has no match session to pull
-- from. Only copies once: only when this call is the one that actually
-- creates the thread (v_is_new), which for a mutual like is naturally
-- exactly one of the two participants' near-simultaneous calls - the
-- other finds the thread already exists and skips the copy, so messages
-- never get duplicated.
create or replace function open_friend_chat(p_friend uuid, p_match_session uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_me uuid := auth.uid();
  v_a uuid := least(v_me, p_friend);
  v_b uuid := greatest(v_me, p_friend);
  v_thread uuid;
  v_is_new boolean := false;
begin
  if not exists (select 1 from friendships where user_a = v_a and user_b = v_b) then
    raise exception 'not friends';
  end if;

  select id into v_thread from dm_threads where user_a = v_a and user_b = v_b;

  if v_thread is null then
    insert into dm_threads (user_a, user_b, initiator, status)
    values (v_a, v_b, v_me, 'accepted')
    returning id into v_thread;
    v_is_new := true;
  end if;

  if v_is_new and p_match_session is not null then
    if not exists (
      select 1 from match_sessions
       where id = p_match_session
         and (user_a = v_me or user_b = v_me)
         and (user_a = p_friend or user_b = p_friend)
    ) then
      raise exception 'not a participant in that match session';
    end if;

    insert into dm_messages (thread_id, sender_id, body, created_at)
    select v_thread, sender_id, body, created_at
      from match_messages
     where session_id = p_match_session
     order by created_at asc;
  end if;

  return jsonb_build_object('thread_id', v_thread);
end;
$$;
