-- Both sides must confirm they've loaded the match (partner profile
-- fetched, UI ready) before chat opens - otherwise one side can start
-- typing while the other hasn't even rendered them yet.
alter table match_sessions
  add column if not exists ready_a boolean not null default false,
  add column if not exists ready_b boolean not null default false;

create or replace function mark_match_ready(p_session_id uuid)
returns match_sessions
language plpgsql security definer as $$
declare
  v_session match_sessions;
begin
  select * into v_session from match_sessions where id = p_session_id;
  if not found or (v_session.user_a <> auth.uid() and v_session.user_b <> auth.uid()) then
    raise exception 'not your session';
  end if;

  if v_session.user_a = auth.uid() then
    update match_sessions set ready_a = true where id = p_session_id returning * into v_session;
  else
    update match_sessions set ready_b = true where id = p_session_id returning * into v_session;
  end if;

  return v_session;
end;
$$;
