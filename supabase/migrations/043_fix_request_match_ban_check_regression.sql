-- Safety regression fix. 020_safety_pass.sql added an is_banned check and
-- the voice daily-limit check to request_match(p_mode text). 039 later
-- defined request_match(p_mode text, p_gender_pref text, p_min_age int,
-- p_max_age int) for the gender/age filter feature - a DIFFERENT
-- signature, so `create or replace` didn't touch the original, it just
-- added a second overload alongside it. The client calls the 4-arg form
-- (src/lib/match.ts), which never had either check, so since migration
-- 039 shipped, a banned user could still queue and text-chat via
-- VibeMatch, and the 5-voice-mingles/day cap silently stopped applying to
-- anyone. Per CLAUDE.md Part 3B, moderation is the license to operate -
-- this is a launch blocker, not a nice-to-have.
--
-- Fix: drop the orphaned 1-arg overload (nothing calls it - the client
-- only ever calls the 4-arg form) and restore both checks to the version
-- that's actually live, so there's exactly one request_match and it can't
-- silently fork like this again.
drop function if exists request_match(text);

create or replace function request_match(
  p_mode text,
  p_gender_pref text default null,
  p_min_age integer default 18,
  p_max_age integer default 69
)
returns match_sessions
language plpgsql security definer as $$
declare
  v_region text;
  v_my_gender text;
  v_my_age int;
  v_banned boolean;
  v_used_today int;
  v_cross_region boolean;
  v_existing match_sessions;
  v_partner uuid;
  v_session match_sessions;
begin
  if p_mode not in ('text', 'voice') then
    raise exception 'invalid mode';
  end if;
  if p_gender_pref is not null and p_gender_pref not in ('male', 'female') then
    raise exception 'invalid gender preference';
  end if;

  select is_banned into v_banned from profiles where id = auth.uid();
  if coalesce(v_banned, false) then
    raise exception 'account_banned';
  end if;

  select region, gender, date_part('year', age(current_date, birthdate))::int
    into v_region, v_my_gender, v_my_age
    from profiles where id = auth.uid();

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
    join profiles p on p.id = q.user_id
   where q.mode = p_mode
     and (v_cross_region or q.region = v_region)
     and q.user_id <> auth.uid()
     and not is_blocked_pair(auth.uid(), q.user_id)
     and coalesce(p.is_banned, false) = false
     -- candidate satisfies my preference
     and (p_gender_pref is null or p.gender = p_gender_pref)
     and (p.birthdate is null or date_part('year', age(current_date, p.birthdate))::int between p_min_age and p_max_age)
     -- I satisfy the candidate's preference
     and (q.gender_pref is null or v_my_gender = q.gender_pref)
     and (v_my_age is null or v_my_age between q.min_age and q.max_age)
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

  insert into match_queue (user_id, mode, region, gender_pref, min_age, max_age)
  values (auth.uid(), p_mode, v_region, p_gender_pref, p_min_age, p_max_age)
  on conflict (user_id) do update set
    mode = excluded.mode,
    region = excluded.region,
    gender_pref = excluded.gender_pref,
    min_age = excluded.min_age,
    max_age = excluded.max_age,
    created_at = now();

  return null;
end;
$$;

-- A banned user already sitting in the queue from before this fix
-- shouldn't stay eligible until they next call request_match.
delete from match_queue q using profiles p
where q.user_id = p.id and coalesce(p.is_banned, false) = true;
