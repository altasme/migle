-- Rings become an expensive room-only gift that proposes a relationship,
-- replacing the free DM-based propose_relationship(). Dropping the old
-- function (not just hiding its UI button) — leaving it callable would
-- let anyone propose for free via a direct API call, defeating the
-- "must be expensive, room-only" requirement entirely.
drop function if exists propose_relationship(uuid);

insert into gift_catalog (id, name, price_coins, anim_path) values
  ('ring', 'Ring', 5000, '/anim/ring.json')
on conflict (id) do nothing;

create or replace function send_gift(p_gift_id text, p_to uuid, p_room uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_from    uuid := auth.uid();
  v_price   int;
  v_reverse uuid;
  v_forward uuid;
  v_status  text;
begin
  if v_from = p_to then raise exception 'cannot gift yourself'; end if;

  select price_coins into v_price from gift_catalog where id = p_gift_id;
  if v_price is null then raise exception 'unknown gift'; end if;

  if p_gift_id = 'ring' then
    if p_room is null then
      raise exception 'rings can only be gifted in a room';
    end if;
    if exists (select 1 from relationships where status = 'active' and (user_a = v_from or user_b = v_from)) then
      raise exception 'you already have an active partner';
    end if;
    if exists (select 1 from relationships where status = 'active' and (user_a = p_to or user_b = p_to)) then
      raise exception 'they already have an active partner';
    end if;
  end if;

  -- Atomic debit. The check constraint (coins >= 0) makes overspend impossible.
  update wallets set coins = coins - v_price where user_id = v_from;

  insert into transactions (user_id, currency, amount, source)
    values (v_from, 'coins', -v_price, 'gift_sent');

  insert into gifts_sent (gift_id, from_user, to_user, room_id, value_coins)
    values (p_gift_id, v_from, p_to, p_room, v_price);

  -- Gifting your partner grows the CP score. This is the loop.
  update relationships set cp_score = cp_score + v_price
   where status = 'active'
     and ((user_a = v_from and user_b = p_to) or (user_a = p_to and user_b = v_from));

  if p_gift_id = 'ring' then
    -- Mutual match: they already sent us a ring — activate immediately.
    select id into v_reverse from relationships
      where user_a = p_to and user_b = v_from and status = 'pending';
    if v_reverse is not null then
      update relationships set status = 'active', started_at = now() where id = v_reverse;
    else
      select id, status into v_forward, v_status from relationships
        where user_a = v_from and user_b = p_to;
      if v_forward is not null then
        if v_status <> 'pending' then
          update relationships set status = 'pending', started_at = null where id = v_forward;
        end if;
      else
        insert into relationships (user_a, user_b, status) values (v_from, p_to, 'pending');
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'spent', v_price);
end $$;
