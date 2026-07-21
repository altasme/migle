// Forcibly disconnects a participant from LiveKit — the hard-enforcement
// half of owner_kick_member(). That RPC removes the DB membership row,
// which the kicked user's own client notices and self-disconnects on,
// but that depends on their client still being responsive. This ends
// their actual LiveKit session server-side, regardless.
//
//   supabase secrets set LIVEKIT_URL=wss://your-project.livekit.cloud
//   supabase functions deploy livekit-kick
//
// (LIVEKIT_API_KEY/LIVEKIT_API_SECRET should already be set from livekit-token.)

import { RoomServiceClient } from 'https://esm.sh/livekit-server-sdk@2.7.2';
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

  const { roomId, targetUserId } = await req.json();
  if (!roomId || !targetUserId) return json({ error: 'roomId and targetUserId required' }, 400);

  // Never trust a client-side "I'm the owner" claim. Room mates get the
  // same kick authority as the owner (never over the owner themself),
  // matching owner_kick_member() on the DB side.
  const { data: room } = await supabase
    .from('rooms')
    .select('id, owner_id')
    .eq('id', roomId)
    .single();

  if (!room) return json({ error: 'room not found' }, 404);

  if (room.owner_id === targetUserId) {
    return json({ error: 'cannot kick the room owner' }, 403);
  }

  let authorized = room.owner_id === user.id;
  if (!authorized) {
    const { data: member } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle();
    authorized = member?.role === 'roommate';
  }
  if (!authorized) {
    return json({ error: 'not authorized' }, 403);
  }

  const livekitHost = Deno.env.get('LIVEKIT_URL')!
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://');

  const svc = new RoomServiceClient(
    livekitHost,
    Deno.env.get('LIVEKIT_API_KEY')!,
    Deno.env.get('LIVEKIT_API_SECRET')!,
  );

  try {
    await svc.removeParticipant(room.id, targetUserId);
  } catch (err) {
    // Not fatal — they may already be disconnected.
    console.error('removeParticipant failed', err);
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
