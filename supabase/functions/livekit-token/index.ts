// Mints a LiveKit token for a REAL, authenticated user.
// Unlike the spike, this verifies who you are and whether you may speak.
//
//   supabase secrets set LIVEKIT_API_KEY=xxx LIVEKIT_API_SECRET=yyy
//   supabase functions deploy livekit-token
//
// NOTE: no --no-verify-jwt this time. Auth is the point.

import { AccessToken } from 'https://esm.sh/livekit-server-sdk@2.7.2';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { roomSlug } = await req.json();

  // Banned users get nothing.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_banned')
    .eq('id', user.id)
    .single();

  if (!profile || profile.is_banned) return json({ error: 'forbidden' }, 403);

  const { data: room } = await supabase
    .from('rooms')
    .select('id, is_active')
    .eq('slug', roomSlug)
    .single();

  if (!room?.is_active) return json({ error: 'room not found' }, 404);

  // Seat check: only users on a mic seat may PUBLISH. Everyone else listens.
  // This is the mic-seat model — it is also your first line of moderation.
  const { data: member } = await supabase
    .from('room_members')
    .select('seat_index, is_muted')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const canPublish = member?.seat_index !== null &&
                     member?.seat_index !== undefined &&
                     !member.is_muted;

  const at = new AccessToken(
    Deno.env.get('LIVEKIT_API_KEY')!,
    Deno.env.get('LIVEKIT_API_SECRET')!,
    { identity: user.id, name: profile.username, ttl: '4h' },
  );

  at.addGrant({
    roomJoin: true,
    room: room.id,          // room id, not slug — slugs can change
    canPublish,             // ← the mic seat, enforced server-side
    canSubscribe: true,     // everyone can always listen
    canPublishData: false,  // chat goes through Supabase, not LiveKit
  });

  return json({ token: await at.toJwt(), canPublish });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
