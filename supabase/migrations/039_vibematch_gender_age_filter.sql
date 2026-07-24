-- Free match preferences: who you want to be paired with (gender) and
-- within what age range. Deliberately NOT region/interest/personality
-- filters and NOT gated behind any paid tier - see CLAUDE.md Part 5/6 on
-- why those stay off the table for now. Filtering is mutual: a candidate
-- only pairs with you if they satisfy YOUR preference AND you satisfy
-- THEIRS, so nobody surfaces to someone whose criteria they don't meet.
alter table match_queue
  add column if not exists gender_pref text,
  add column if not exists min_age integer not null default 18,
  add column if not exists max_age integer not null default 69;

alter table match_queue drop constraint if exists match_queue_gender_pref_check;
alter table match_queue
  add constraint match_queue_gender_pref_check check (gender_pref is null or gender_pref in ('male', 'female'));

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

  select region, gender, date_part('year', age(current_date, birthdate))::int
    into v_region, v_my_gender, v_my_age
    from profiles where id = auth.uid();

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
    join profiles p on p.id = q.user_id
   where q.mode = p_mode
     and (v_cross_region or q.region = v_region)
     and q.user_id <> auth.uid()
     and not is_blocked_pair(auth.uid(), q.user_id)
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
