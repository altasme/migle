-- Safety pass (build step 7): closes the gaps found auditing block
-- enforcement, report logging, and the ban path.

-- 1. Banned users could still queue/chat via text VibeMatch — voice was
-- already denied at the edge-function level, text never checked at all.
create or replace function request_match(p_mode text)
returns match_sessions
language plpgsql security definer as $$
declare
  v_region text;
  v_cross_region boolean;
  v_existing match_sessions;
  v_partner uuid;
  v_session match_sessions;
  v_used_today int;
  v_banned boolean;
begin
  if p_mode not in ('text', 'voice') then
    raise exception 'invalid mode';
  end if;

  select is_banned into v_banned from profiles where id = auth.uid();
  if coalesce(v_banned, false) then
    raise exception 'account_banned';
  end if;

  select region into v_region from profiles where id = auth.uid();

  select * into v_existing from match_sessions
   where ended_at is null and (user_a = auth.uid() or user_b = auth.uid())
   limit 1;
  if found then
    return v_existing;
  end if;

  if p_mode = 'voice' then
    select case when voice_mingles_date = current_date then voice_mingles_used else 0 end
      into v_used_today
      from profiles where id = auth.uid();
    if v_used_today >= 5 then
      raise exception 'voice_limit_reached';
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

    if p_mode = 'voice' then
      update profiles set
        voice_mingles_used = case when voice_mingles_date = current_date then voice_mingles_used + 1 else 1 end,
        voice_mingles_date = current_date
      where id in (auth.uid(), v_partner);
    end if;

    return v_session;
  end if;

  insert into match_queue (user_id, mode, region)
  values (auth.uid(), p_mode, v_region)
  on conflict (user_id) do update set mode = excluded.mode, region = excluded.region, created_at = now();

  return null;
end;
$$;

-- 2. Blocking now also severs any existing friendship and pending hangout
-- invites between the pair, same pattern as the room/follow/match triggers.
create or replace function handle_block_severs_friendship()
returns trigger language plpgsql security definer as $$
begin
  delete from friendships
   where (user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id));
  delete from room_invites
   where (invited_user_id = new.blocked_id and invited_by = new.blocker_id)
      or (invited_user_id = new.blocker_id and invited_by = new.blocked_id);
  return new;
end $$;

drop trigger if exists on_block_severs_friendship on blocks;
create trigger on_block_severs_friendship
  after insert on blocks
  for each row execute function handle_block_severs_friendship();

-- 3. Can't invite someone you've blocked (or who's blocked you) to a
-- hangout, even if a friendship row still technically exists.
create or replace function invite_friend_to_room(p_room uuid, p_friend uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_a uuid := least(auth.uid(), p_friend);
  v_b uuid := greatest(auth.uid(), p_friend);
begin
  if not exists (select 1 from rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'not the room owner';
  end if;
  if not exists (select 1 from friendships where user_a = v_a and user_b = v_b) then
    raise exception 'not friends';
  end if;
  if is_blocked_pair(auth.uid(), p_friend) then
    raise exception 'cannot invite this user';
  end if;

  insert into room_invites (room_id, invited_user_id, invited_by)
  values (p_room, p_friend, auth.uid())
  on conflict (room_id, invited_user_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

-- 4. The actual ban mechanism — previously is_banned had no way to ever
-- become true outside a manual SQL update. Admin-only (checked
-- server-side, never trust a client-side "I'm an admin" claim), and
-- immediately cuts the banned user out of the match queue and any
-- active match session.
create or replace function ban_user(p_user uuid)
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not an admin';
  end if;

  update profiles set is_banned = true where id = p_user;
  delete from match_queue where user_id = p_user;
  update match_sessions set ended_at = now()
   where ended_at is null and (user_a = p_user or user_b = p_user);

  return jsonb_build_object('ok', true);
end;
$$;
