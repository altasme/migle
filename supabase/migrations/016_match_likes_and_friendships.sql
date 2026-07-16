-- Mutual "heart" during a match: this IS the "Friends — when BOTH accept"
-- mechanic from CLAUDE.md Part 4, triggered from the match screen instead
-- of a separate flow.
alter table match_sessions
  add column if not exists liked_a boolean not null default false,
  add column if not exists liked_b boolean not null default false;

-- Persistent, mutual friendship — distinct from the old one-way `follows`
-- table (unused since the relaunch) and from `relationships` (which is
-- specifically the ring/romantic-partner mechanic). No insert policy:
-- only created via like_match_partner() below.
create table if not exists friendships (
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  source_session_id uuid references match_sessions(id),
  primary key (user_a, user_b),
  constraint friendship_ordered check (user_a < user_b)
);

alter table friendships enable row level security;

create policy read_own_friendships on friendships for select
  using (user_a = auth.uid() or user_b = auth.uid());

-- Sets the caller's like flag on their session; if both are now true,
-- records the friendship (idempotent — on_conflict do nothing, since
-- either side could theoretically call this twice).
create or replace function like_match_partner(p_session_id uuid)
returns match_sessions
language plpgsql security definer as $$
declare
  v_session match_sessions;
  v_a uuid;
  v_b uuid;
begin
  select * into v_session from match_sessions where id = p_session_id;
  if not found or (v_session.user_a <> auth.uid() and v_session.user_b <> auth.uid()) then
    raise exception 'not your session';
  end if;

  if v_session.user_a = auth.uid() then
    update match_sessions set liked_a = true where id = p_session_id returning * into v_session;
  else
    update match_sessions set liked_b = true where id = p_session_id returning * into v_session;
  end if;

  if v_session.liked_a and v_session.liked_b then
    v_a := least(v_session.user_a, v_session.user_b);
    v_b := greatest(v_session.user_a, v_session.user_b);
    insert into friendships (user_a, user_b, source_session_id)
    values (v_a, v_b, p_session_id)
    on conflict (user_a, user_b) do nothing;
  end if;

  return v_session;
end;
$$;
