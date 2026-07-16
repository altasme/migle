-- Text VibeMatch: queue + atomic pairing + sessions + ephemeral chat.
--
-- match_queue holds a row ONLY while a user is actively waiting — matching
-- only ever considers rows literally present here right now, never any
-- broader "online" signal (last_seen_at, presence, etc).
create table if not exists match_queue (
  user_id uuid primary key references profiles(id) on delete cascade,
  mode text not null check (mode in ('text', 'voice')),
  region text not null,
  created_at timestamptz not null default now()
);

alter table match_queue enable row level security;

create policy read_own_queue_row on match_queue for select using (user_id = auth.uid());
create policy join_queue on match_queue for insert with check (user_id = auth.uid());
create policy leave_queue on match_queue for delete using (user_id = auth.uid());

-- One row per pairing. ended_at null = still active. No insert/update
-- policy — sessions are only ever created/ended via the RPCs below.
create table if not exists match_sessions (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  mode text not null check (mode in ('text', 'voice')),
  region text not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint match_users_distinct check (user_a <> user_b)
);

alter table match_sessions enable row level security;

create policy read_own_sessions on match_sessions for select
  using (user_a = auth.uid() or user_b = auth.uid());

create index if not exists match_sessions_active_a on match_sessions (user_a) where ended_at is null;
create index if not exists match_sessions_active_b on match_sessions (user_b) where ended_at is null;

-- Ephemeral text-mode chat, scoped strictly to session participants while
-- the session is active. No insert/update policy needed beyond this —
-- messages are never edited, and there's no cross-session read path.
create table if not exists match_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references match_sessions(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table match_messages enable row level security;

create policy read_session_messages on match_messages for select
  using (
    exists (
      select 1 from match_sessions s
      where s.id = session_id and (s.user_a = auth.uid() or s.user_b = auth.uid())
    )
  );

create policy send_session_messages on match_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from match_sessions s
      where s.id = session_id
        and s.ended_at is null
        and (s.user_a = auth.uid() or s.user_b = auth.uid())
    )
  );

-- Reports need to capture which match session a report came from.
alter table reports add column if not exists match_session_id uuid references match_sessions(id);

-- The one RPC the client calls — both to join the queue and to poll for a
-- pairing. Returns the caller's current active session if one already
-- exists (covers "someone else just matched me while I was polling"),
-- otherwise tries to pair from the queue, otherwise upserts the caller
-- into the queue and returns null ("still waiting" — never an error).
--
-- pg_advisory_xact_lock serializes matching attempts per mode so two
-- concurrent callers can never both claim the same candidate (no
-- double-pairing under race) — cheap at launch scale, and correctness
-- here matters more than throughput.
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

-- "Next" / leave: ends the session (if any) and drops the caller from the
-- queue (if present). The partner's next request_match poll will no
-- longer see this session as active and will re-queue on their own.
create or replace function end_match(p_session_id uuid)
returns void
language plpgsql security definer as $$
begin
  update match_sessions
     set ended_at = now()
   where id = p_session_id
     and ended_at is null
     and (user_a = auth.uid() or user_b = auth.uid());

  delete from match_queue where user_id = auth.uid();
end;
$$;

-- Blocking ends any active match session between the pair immediately,
-- same as it already does for room membership and follows.
create or replace function handle_block_ends_match()
returns trigger language plpgsql security definer as $$
begin
  update match_sessions
     set ended_at = now()
   where ended_at is null
     and ((user_a = new.blocker_id and user_b = new.blocked_id)
       or (user_a = new.blocked_id and user_b = new.blocker_id));
  delete from match_queue where user_id in (new.blocker_id, new.blocked_id);
  return new;
end $$;

drop trigger if exists on_block_ends_match on blocks;
create trigger on_block_ends_match
  after insert on blocks
  for each row execute function handle_block_ends_match();
