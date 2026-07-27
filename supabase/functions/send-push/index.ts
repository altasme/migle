// Sends a push notification via FCM's HTTP v1 API. Called by pg_net
// triggers on dm_messages/friendships/room_invites inserts (see migration
// 041) with a shared secret header, never by a client directly - there's
// no user JWT here, just a server-to-server call, so it uses the service
// role key to read push_tokens/profiles across all users.
//
//   supabase functions deploy send-push
//
// Secrets this function needs (supabase secrets set ...):
//   PUSH_WEBHOOK_SECRET      - matches the 'push_webhook_secret' Vault entry
//   FCM_SERVICE_ACCOUNT_JSON - the full JSON key downloaded from Firebase
//                              Console -> Project Settings -> Service accounts
//                              (Cloud Messaging API access), as one string.
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Kind = 'dm_message' | 'new_friend' | 'room_invite';

type Notification = {
  recipientId: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }

  const { kind, payload } = (await req.json()) as { kind: Kind; payload: Record<string, string> };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const notifications = await buildNotifications(supabase, kind, payload);
  if (notifications.length === 0) {
    return json({ ok: true, sent: 0 });
  }

  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', notifications.map((n) => n.recipientId));

  if (!tokenRows || tokenRows.length === 0) {
    return json({ ok: true, sent: 0 });
  }

  const accessToken = await getFcmAccessToken();
  const projectId = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')!).project_id;

  const staleTokens: string[] = [];
  let sent = 0;

  for (const { user_id, token } of tokenRows) {
    const notif = notifications.find((n) => n.recipientId === user_id);
    if (!notif) continue;

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: notif.title, body: notif.body },
          data: notif.data,
        },
      }),
    });
    if (res.ok) {
      sent++;
    } else if (res.status === 404 || res.status === 400) {
      // Uninstalled app / stale token - FCM will keep 404ing on it forever.
      staleTokens.push(token);
    }
  }

  if (staleTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', staleTokens);
  }

  return json({ ok: true, sent });
});

async function buildNotifications(
  supabase: ReturnType<typeof createClient>,
  kind: Kind,
  payload: Record<string, string>,
): Promise<Notification[]> {
  if (kind === 'dm_message') {
    const { data: sender } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', payload.sender_id)
      .single();
    return [
      {
        recipientId: payload.recipient_id,
        title: sender?.username ?? 'New message',
        body: payload.body,
        data: { type: 'dm', thread_id: payload.thread_id },
      },
    ];
  }

  if (kind === 'new_friend') {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', [payload.user_a, payload.user_b]);
    const byId = new Map((profs ?? []).map((p) => [p.id, p.username as string]));
    const otherOf = (id: string) => (id === payload.user_a ? payload.user_b : payload.user_a);

    return [payload.user_a, payload.user_b].map((recipientId) => ({
      recipientId,
      title: 'New friend!',
      body: `You and ${byId.get(otherOf(recipientId)) ?? 'someone new'} are now friends`,
      data: { type: 'friend', friend_id: otherOf(recipientId) },
    }));
  }

  // room_invite
  const [{ data: inviter }, { data: room }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', payload.inviter_id).single(),
    supabase.from('rooms').select('name, slug').eq('id', payload.room_id).single(),
  ]);
  return [
    {
      recipientId: payload.recipient_id,
      title: 'Hangout invite',
      body: `${inviter?.username ?? 'Someone'} invited you to ${room?.name ?? 'their hangout'}`,
      data: { type: 'hangout', room_slug: room?.slug ?? '' },
    },
  ];
}

async function getFcmAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const serviceAccount = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')!);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64urlFromBuffer(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);

  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

function base64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromBuffer(buf: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buf)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
