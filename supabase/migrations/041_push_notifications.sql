-- Real-time push notifications (new DM message, new friend, hangout
-- invite) via FCM. These are the "not counted against the promotional cap"
-- notifications from the notification-strategy doc - the ones tied
-- directly to something already happening in the app, not a re-engagement
-- campaign. The campaign/library piece is deliberately out of scope here;
-- see CLAUDE.md Part 12 - that's V2+ work once there's usage data to tell
-- which copy actually works.
--
-- One device can only ever belong to one user at a time in this table, so
-- a phone that logs into a second account doesn't keep getting the first
-- account's pushes.
create table if not exists push_tokens (
  user_id uuid not null references profiles(id) on delete cascade,
  token text primary key,
  platform text not null default 'android',
  created_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

drop policy if exists manage_own_push_tokens on push_tokens;
create policy manage_own_push_tokens on push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- pg_net lets a trigger fire an async HTTP call without blocking the
-- write that triggered it. Ships with every Supabase project.
create extension if not exists pg_net;

-- The send-push Edge Function's URL and the shared secret it checks live
-- in Vault, not in this file - both get set once via:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<random-string>', 'push_webhook_secret');
-- (also set PUSH_WEBHOOK_SECRET to the same random string as a secret on
-- the send-push function itself). Until both exist this silently no-ops
-- instead of failing the insert that triggered it - push notifications
-- are a nice-to-have, never a reason a message/friend/invite fails to save.
create or replace function notify_push(p_kind text, p_payload jsonb)
returns void language plpgsql security definer as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('kind', p_kind, 'payload', p_payload)
  );
end;
$$;

-- New DM message (covers both stranger DMs and friend chat, including the
-- match-chat-carried-over thread from migration 040).
create or replace function trg_notify_dm_message()
returns trigger language plpgsql as $$
declare
  v_thread dm_threads;
begin
  select * into v_thread from dm_threads where id = new.thread_id;
  perform notify_push('dm_message', jsonb_build_object(
    'recipient_id', case when v_thread.user_a = new.sender_id then v_thread.user_b else v_thread.user_a end,
    'sender_id', new.sender_id,
    'thread_id', new.thread_id,
    'body', left(new.body, 120)
  ));
  return new;
end;
$$;

drop trigger if exists on_dm_message_push on dm_messages;
create trigger on_dm_message_push after insert on dm_messages
for each row execute function trg_notify_dm_message();

-- New friendship (a VibeMatch mutual like, per migration 016). Both sides
-- find out live in-app while the match is still open, but this is the one
-- that matters if either side has already left - it's the actual outcome
-- the whole product measures itself against (Friendships Created Per Day).
create or replace function trg_notify_friendship()
returns trigger language plpgsql as $$
begin
  perform notify_push('new_friend', jsonb_build_object(
    'user_a', new.user_a,
    'user_b', new.user_b
  ));
  return new;
end;
$$;

drop trigger if exists on_friendship_push on friendships;
create trigger on_friendship_push after insert on friendships
for each row execute function trg_notify_friendship();

-- Hangout invite (room_invites, migration 019 - also covers Watch Together
-- and Karaoke since they're just rooms with an activity attached).
create or replace function trg_notify_room_invite()
returns trigger language plpgsql as $$
begin
  perform notify_push('room_invite', jsonb_build_object(
    'recipient_id', new.invited_user_id,
    'inviter_id', new.invited_by,
    'room_id', new.room_id
  ));
  return new;
end;
$$;

drop trigger if exists on_room_invite_push on room_invites;
create trigger on_room_invite_push after insert on room_invites
for each row execute function trg_notify_room_invite();
