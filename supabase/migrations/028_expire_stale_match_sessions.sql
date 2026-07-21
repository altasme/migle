-- If a match ends uncleanly (tab closed, app backgrounded, network drop -
-- anything that skips the client's normal end_match() call on Next/leave),
-- the session is left dangling with ended_at still null. request_match()
-- always returns the caller's existing active session first (needed for
-- "someone else already matched me while I was polling"), which meant a
-- stale session got resurrected and handed back as if it were fresh - and
-- since its created_at was actually minutes/hours old, the client's
-- 3-minute deadline (MATCH_DEADLINE_SEC in VibeMatch.tsx) read as already
-- expired, dumping the user straight into "Time's up!" instead of ever
-- reaching the real waiting-for-a-partner queue.
create or replace function request_match(p_mode text)
returns match_sessions
language plpgsql security definer as $$
declare
  v_region text;
  v_cross_region boolean;
  v_existing match_sessions;
  v_partner uuid;
  v_session match_sessions;
begin
  if p_mode not in ('text', 'voice') then
    raise exception 'invalid mode';
  end if;

  select region into v_region from profiles where id = auth.uid();

  select * into v_existing from match_sessions
   where ended_at is null and (user_a = auth.uid() or user_b = auth.uid())
   limit 1;
  if found then
    if v_existing.created_at < now() - interval '180 seconds' then
      update match_sessions set ended_at = now() where id = v_existing.id;
    else
      return v_existing;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('match:' || p_mode));

  select coalesce((value #>> '{}')::boolean, false) into v_cross_region
    from app_config where key = 'allow_cross_region_match';

  select q.user_id into v_partner
    from match_queue q
   where q.mode = p_mode
     and (v_cross_region or q.region = v_region)
     and q.user_id <> auth.uid()
     and not is_blocked_pair(auth.uid(), q.user_id)
     and not exists (
       select 1 from match_sessions s
        where s.mode = p_mode
          and s.ended_at > now() - interval '30 seconds'
          and ((s.user_a = auth.uid() and s.user_b = q.user_id)
            or (s.user_b = auth.uid() and s.user_a = q.user_id))
     )
   order by q.created_at asc
   limit 1;

  if v_partner is not null then
    delete from match_queue where user_id in (auth.uid(), v_partner);
    insert into match_sessions (user_a, user_b, mode, region)
    values (auth.uid(), v_partner, p_mode, v_region)
    returning * into v_session;
    return v_session;
  end if;

  insert into match_queue (user_id, mode, region)
  values (auth.uid(), p_mode, v_region)
  on conflict (user_id) do update set mode = excluded.mode, region = excluded.region, created_at = now();

  return null;
end;
$$;
