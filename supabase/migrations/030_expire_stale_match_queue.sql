-- match_queue rows only stay fresh while the waiting client is actively
-- polling - every request_match() call refreshes the caller's own row's
-- created_at. A row that stops getting refreshed means that client's tab
-- died uncleanly (closed, crashed, lost network) without ever calling
-- end_match() or leaving the queue properly, and it would otherwise sit
-- there forever - every future searcher would instantly "match" with
-- this ghost, skipping the waiting screen entirely, and get stuck since
-- nobody is ever on the other end to complete the ready handshake.
--
-- Sweep anything stale system-wide (not just the caller's own rows, since
-- a ghost can't clean up after itself) before ever considering a partner.
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

  update match_sessions
     set ended_at = now()
   where ended_at is null
     and (user_a = auth.uid() or user_b = auth.uid())
     and created_at < now() - interval '180 seconds';

  delete from match_queue where created_at < now() - interval '15 seconds';

  select region into v_region from profiles where id = auth.uid();

  select * into v_existing from match_sessions
   where ended_at is null and (user_a = auth.uid() or user_b = auth.uid())
   limit 1;
  if found then
    return v_existing;
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
