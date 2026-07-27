-- Strategic re-engagement pushes: a 7-day rotating inactivity campaign,
-- morning + evening only (never more than 2/day, always inside a fixed
-- delivery window, always >=6h apart - all three are true automatically
-- here since there are only ever two fixed windows and they're >10h apart).
--
-- Deliberately smaller than the "600 templates + ML-learned send times"
-- version floated earlier: this is 70 hand-written lines (7 days x
-- morning/evening x 5 variants), picked at random per send so the same
-- line doesn't repeat constantly. Worth writing 600 once there's CTR data
-- to know which ones actually work - guessing at that scale blind isn't a
-- good use of effort pre-launch. Per-user learned active-hours is out of
-- scope too, for the same reason (no usage history to learn from yet);
-- this uses one project-wide timezone and the doc's own fixed windows
-- instead. Both are easy to layer on top of this table/function shape
-- later without changing the delivery mechanics.
--
-- "Stop immediately when the user opens the app" and "reset the cycle
-- after they come back" both fall out for free: campaign_day is
-- recomputed fresh from profiles.last_seen_at (already kept warm by
-- PresenceHeartbeat) on every sweep, so the moment they're active again
-- they drop out of the eligible set, and a future lapse always restarts
-- at day 1 - no separate "cancel" or "reset" bookkeeping needed.
create table if not exists push_promo_copy (
  id serial primary key,
  campaign_day int not null check (campaign_day between 1 and 7),
  slot text not null check (slot in ('morning', 'evening')),
  title text not null,
  body text not null
);

-- One row per send: enforces the 2/day cap and the "don't resend the same
-- slot on the next cron tick within the same window" dedup. No RLS
-- policies on purpose - nobody needs client access to this, it's sweep
-- bookkeeping only.
create table if not exists push_promo_log (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  campaign_day int not null,
  slot text not null,
  sent_at timestamptz not null default now()
);

create index if not exists push_promo_log_user_sent_idx on push_promo_log (user_id, sent_at desc);

alter table push_promo_log enable row level security;
alter table push_promo_copy enable row level security;

-- One project-wide timezone for now (PH is the only live matching region
-- per CLAUDE.md Part 6) rather than per-user, which would need collecting
-- a timezone at signup - a real future improvement, not needed to ship
-- delivery-window-correct pushes today.
insert into app_config (key, value)
values ('notification_timezone', '"Asia/Manila"'::jsonb)
on conflict (key) do nothing;

-- The two windows from the delivery-windows spec doubling as this
-- campaign's morning/evening slots. Cron ticks every 15 minutes; a run
-- outside both windows (or outside 7:30am-10pm entirely) is a no-op.
create or replace function run_promo_push_sweep()
returns void language plpgsql security definer as $$
declare
  v_tz text;
  v_local_time time;
  v_slot text;
  v_candidate record;
  v_inactive_hours numeric;
  v_campaign_day int;
  v_copy record;
begin
  select coalesce((value #>> '{}'), 'Asia/Manila') into v_tz from app_config where key = 'notification_timezone';
  v_local_time := (now() at time zone v_tz)::time;

  if v_local_time between time '07:30' and time '08:30' then
    v_slot := 'morning';
  elsif v_local_time between time '19:00' and time '21:00' then
    v_slot := 'evening';
  else
    return;
  end if;

  for v_candidate in
    select p.id, p.last_seen_at
    from profiles p
    where p.is_banned = false
      and p.last_seen_at is not null
      and p.last_seen_at < now() - interval '20 hours'
      and exists (select 1 from push_tokens t where t.user_id = p.id)
      and not exists (
        select 1 from push_promo_log l
        where l.user_id = p.id
          and l.slot = v_slot
          and (l.sent_at at time zone v_tz)::date = (now() at time zone v_tz)::date
      )
      and (
        select count(*) from push_promo_log l2
        where l2.user_id = p.id
          and (l2.sent_at at time zone v_tz)::date = (now() at time zone v_tz)::date
      ) < 2
      and not exists (
        select 1 from push_promo_log l3
        where l3.user_id = p.id and l3.sent_at > now() - interval '6 hours'
      )
  loop
    v_inactive_hours := extract(epoch from (now() - v_candidate.last_seen_at)) / 3600.0;
    v_campaign_day := ((greatest(1, ceil(v_inactive_hours / 24.0)::int) - 1) % 7) + 1;

    select title, body into v_copy
    from push_promo_copy
    where campaign_day = v_campaign_day and slot = v_slot
    order by random()
    limit 1;

    if v_copy.title is not null then
      perform notify_push('promo', jsonb_build_object(
        'recipient_id', v_candidate.id,
        'title', v_copy.title,
        'body', v_copy.body
      ));
      insert into push_promo_log (user_id, campaign_day, slot) values (v_candidate.id, v_campaign_day, v_slot);
    end if;
  end loop;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule('promo-push-sweep', '*/15 * * * *', $$select run_promo_push_sweep()$$);
insert into push_promo_copy (campaign_day, slot, title, body) values
(1, 'morning', 'Good morning', 'Someone new is probably awake right now too.'),
(1, 'morning', 'A fresh start', 'New day, new person to meet. Takes seconds.'),
(1, 'morning', 'Coffee and company', 'A quick hello costs nothing and might turn into something good.'),
(1, 'morning', 'Right on time', 'Mornings tend to have good conversations. Worth a look.'),
(1, 'morning', 'One tap away', 'A stranger somewhere is also just starting their day.'),
(1, 'evening', 'Winding down', 'A short chat can be a nice way to close the day.'),
(1, 'evening', 'Tonight''s still young', 'Plenty of people online right now looking to talk.'),
(1, 'evening', 'End on a good note', 'One conversation can turn an ordinary night around.'),
(1, 'evening', 'Evenings hit different', 'This is usually when the best matches happen.'),
(1, 'evening', 'Quiet night?', 'Not for long. Someone out there is up for a chat.'),
(2, 'morning', 'New faces', 'A different region, a different vibe. Worth a peek.'),
(2, 'morning', 'Meet someone new', 'You haven''t talked to everyone yet. Promise.'),
(2, 'morning', 'Fresh matches', 'The pool refills every day. Today''s crop is waiting.'),
(2, 'morning', 'Try voice today', 'Text is nice. A real voice hits different.'),
(2, 'morning', 'Somebody''s online', 'Good odds someone interesting is free right now.'),
(2, 'evening', 'Still exploring?', 'Plenty of people haven''t crossed your path yet.'),
(2, 'evening', 'Switch it up', 'Try voice tonight instead of text. See what changes.'),
(2, 'evening', 'New pool, new people', 'A different set of strangers is just a tap away.'),
(2, 'evening', 'Tonight''s roulette', 'Every match is a new person. Never the same twice.'),
(2, 'evening', 'One more try', 'The right match might be the very next one.'),
(3, 'morning', 'Guess who''s online', 'Can''t tell you. That''s kind of the whole point.'),
(3, 'morning', 'Something''s different today', 'The match pool looks good this morning.'),
(3, 'morning', 'Curious?', 'So is everyone else in the queue right now.'),
(3, 'morning', 'A little mystery', 'You won''t know who until you say hello.'),
(3, 'morning', 'Worth checking', 'Today''s matches might surprise you.'),
(3, 'evening', 'Tonight''s a wildcard', 'Could be anyone. That''s the fun part.'),
(3, 'evening', 'One question', 'Who''s out there tonight? Only one way to find out.'),
(3, 'evening', 'The unknown', 'Every match starts as a mystery. Some turn into friends.'),
(3, 'evening', 'Still wondering?', 'The queue''s active. Someone''s wondering the same thing.'),
(3, 'evening', 'A small risk', 'Worst case, a quick hello. Best case, a lot more.'),
(4, 'morning', 'Friendships start small', 'A hello this morning could be the start of something.'),
(4, 'morning', 'One ''yes'' away', 'From match to friend, it just takes both sides agreeing.'),
(4, 'morning', 'Someone''s looking too', 'Somewhere, someone wants a real friend just like you do.'),
(4, 'morning', 'Small talk, big outcome', 'Some of the best friendships started as small talk.'),
(4, 'morning', 'Today could be the day', 'Every friend you have now was a stranger once.'),
(4, 'evening', 'Tonight''s friend-shaped', 'The right conversation could turn into a real friendship.'),
(4, 'evening', 'Two people, one yes each', 'That''s all it takes to make a friend here.'),
(4, 'evening', 'Worth a shot', 'Somebody out there is hoping for the same thing you are.'),
(4, 'evening', 'Friendship doesn''t wait', 'It starts with one conversation. Maybe tonight''s the one.'),
(4, 'evening', 'Not just a chat', 'Sometimes a random match turns into someone who sticks around.'),
(5, 'morning', 'Bring a friend along', 'Hangouts are more fun with people you already know.'),
(5, 'morning', 'Watch something together', 'Watch Together works better when someone''s actually there.'),
(5, 'morning', 'Karaoke''s better with friends', 'Grab someone and make it a duet.'),
(5, 'morning', 'Start a hangout', 'A private space for you and your friends, whenever you want.'),
(5, 'morning', 'Today''s a hangout day', 'No plans yet? Start one and see who shows up.'),
(5, 'evening', 'Tonight, invite someone', 'A hangout''s better when it''s not just you.'),
(5, 'evening', 'Karaoke night?', 'Someone on your friends list is probably down.'),
(5, 'evening', 'Watch Together, tonight', 'Pick something, invite a friend, press play.'),
(5, 'evening', 'Your hangout''s still there', 'Waiting for someone to walk back in.'),
(5, 'evening', 'Low effort, good time', 'Invite a friend, put something on, talk through it.'),
(6, 'morning', 'You''re better at this than you think', 'Most people feel awkward the first few matches too.'),
(6, 'morning', 'It gets easier', 'Every conversation gets a little more natural than the last.'),
(6, 'morning', 'Small steps count', 'One hello today is enough. That''s the whole ask.'),
(6, 'morning', 'You''ve got this', 'The hardest part is just saying hi. You already know how.'),
(6, 'morning', 'No pressure today', 'Just see who''s around. That''s it.'),
(6, 'evening', 'One more try tonight', 'It only takes one good match to make it worth it.'),
(6, 'evening', 'You''re allowed to be picky', 'Next exists for a reason. Keep going until it clicks.'),
(6, 'evening', 'Progress, not perfection', 'Every match teaches you something for the next one.'),
(6, 'evening', 'Tonight, just show up', 'The rest tends to follow on its own.'),
(6, 'evening', 'Good things take a few tries', 'Tonight might be the one that works.'),
(7, 'morning', 'Thanks for being here', 'Mingleverse is better with you in it.'),
(7, 'morning', 'Glad you''re part of this', 'Even on quiet weeks, you''re still welcome anytime.'),
(7, 'morning', 'No rush', 'Whenever you''re ready, the queue''s still here.'),
(7, 'morning', 'Appreciate you', 'Whenever it feels right, we''ll be here.'),
(7, 'morning', 'Thank you for this', 'Being part of a stranger''s day matters more than it seems.'),
(7, 'evening', 'Thank you for trying this out', 'Whether you match daily or once a month, glad you''re here.'),
(7, 'evening', 'This one''s just a thank you', 'No ask, just appreciate you giving this a shot.'),
(7, 'evening', 'Take your time', 'Mingleverse isn''t going anywhere. Neither is the queue.'),
(7, 'evening', 'Grateful for you', 'Hope some of the matches so far were worth it.'),
(7, 'evening', 'Just a thank you tonight', 'For giving strangers a chance to become friends.');

-- total rows: 70
