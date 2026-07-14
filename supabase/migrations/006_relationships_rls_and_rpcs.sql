-- relationships had NO RLS at all. Also: the existing partial unique
-- indexes (one_active_partner_a/b) only guard the user_a and user_b
-- columns independently — they don't stop a user from being active as
-- user_a in one relationship AND active as user_b in a different one
-- simultaneously. RPCs below check both columns explicitly as a
-- belt-and-suspenders on top of the indexes; no direct client writes.
alter table relationships enable row level security;

-- Pending/ended rows are private to the two people involved (declining
-- someone shouldn't be public); active relationships are visible to
-- everyone since the CP leaderboard is a public feature.
create policy read_relationships on relationships for select
  using (status = 'active' or user_a = auth.uid() or user_b = auth.uid());

create or replace function propose_relationship(p_to uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_from     uuid := auth.uid();
  v_reverse  uuid;
  v_forward  uuid;
  v_status   text;
begin
  if v_from = p_to then raise exception 'cannot propose to yourself'; end if;

  if exists (select 1 from relationships where status = 'active' and (user_a = v_from or user_b = v_from)) then
    raise exception 'you already have an active partner';
  end if;
  if exists (select 1 from relationships where status = 'active' and (user_a = p_to or user_b = p_to)) then
    raise exception 'they already have an active partner';
  end if;

  -- Mutual match: they already proposed to us — accept immediately.
  select id into v_reverse from relationships
    where user_a = p_to and user_b = v_from and status = 'pending';
  if v_reverse is not null then
    update relationships set status = 'active', started_at = now() where id = v_reverse;
    return jsonb_build_object('ok', true, 'id', v_reverse, 'status', 'active');
  end if;

  select id, status into v_forward, v_status from relationships
    where user_a = v_from and user_b = p_to;

  if v_forward is not null then
    if v_status = 'pending' then
      return jsonb_build_object('ok', true, 'id', v_forward, 'status', 'pending');
    end if;
    -- Re-propose after a previous breakup — reuse the row (unique
    -- constraint on user_a/user_b would block a fresh insert).
    update relationships set status = 'pending', started_at = null where id = v_forward;
    return jsonb_build_object('ok', true, 'id', v_forward, 'status', 'pending');
  end if;

  insert into relationships (user_a, user_b, status) values (v_from, p_to, 'pending')
    returning id into v_forward;
  return jsonb_build_object('ok', true, 'id', v_forward, 'status', 'pending');
end $$;

create or replace function respond_relationship(p_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_row  relationships%rowtype;
begin
  select * into v_row from relationships where id = p_id;
  if not found then raise exception 'not found'; end if;
  if v_row.user_b <> v_user then raise exception 'not your request to respond to'; end if;
  if v_row.status <> 'pending' then raise exception 'already resolved'; end if;

  if p_accept then
    if exists (select 1 from relationships where status = 'active' and (user_a = v_user or user_b = v_user)) then
      raise exception 'you already have an active partner';
    end if;
    if exists (select 1 from relationships where status = 'active' and (user_a = v_row.user_a or user_b = v_row.user_a)) then
      raise exception 'they already have an active partner';
    end if;
    update relationships set status = 'active', started_at = now() where id = p_id;
  else
    update relationships set status = 'ended' where id = p_id;
  end if;

  return jsonb_build_object('ok', true);
end $$;

create or replace function end_relationship()
returns jsonb language plpgsql security definer as $$
begin
  update relationships set status = 'ended'
    where status = 'active' and (user_a = auth.uid() or user_b = auth.uid());
  return jsonb_build_object('ok', true);
end $$;
