// Mints a LiveKit token for a 1:1 voice VibeMatch session. Unlike
// livekit-token (rooms, seat-gated publish), a voice match is always
// symmetric: both participants in an active voice session can publish —
// there's no seat concept here, just two people who got paired.
//
//   supabase functions deploy livekit-match-token
//
// (LIVEKIT_API_KEY/LIVEKIT_API_SECRET already set from livekit-token.)

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

  const { sessionId } = await req.json();
  if (!sessionId) return json({ error: 'sessionId required' }, 400);

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_banned')
    .eq('id', user.id)
    .single();

  if (!profile || profile.is_banned) return json({ error: 'forbidden' }, 403);

  const { data: session } = await supabase
    .from('match_sessions')
    .select('id, user_a, user_b, mode, ended_at')
    .eq('id', sessionId)
    .single();

  if (!session || session.mode !== 'voice' || session.ended_at !== null) {
    return json({ error: 'session not found or not active' }, 404);
  }
  if (session.user_a !== user.id && session.user_b !== user.id) {
    return json({ error: 'not a participant in this session' }, 403);
  }

  const at = new AccessToken(
    Deno.env.get('LIVEKIT_API_KEY')!,
    Deno.env.get('LIVEKIT_API_SECRET')!,
    // A voice match can run indefinitely once both sides have liked each
    // other (see request_match's deadline logic, enforced client-side) —
    // give it the same generous headroom as room tokens, not a short TTL
    // that would cut off a legitimately continuing conversation.
    { identity: user.id, name: profile.username, ttl: '2h' },
  );

  at.addGrant({
    roomJoin: true,
    room: session.id,
    canPublish: true,      // symmetric — both participants can always speak
    canSubscribe: true,
    canPublishData: false, // no LiveKit data channel; matches Supabase Realtime
  });

  return json({ token: await at.toJwt() });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
