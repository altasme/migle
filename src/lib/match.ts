import { supabase } from './supabase'

export type MatchSession = {
  id: string
  user_a: string
  user_b: string
  mode: 'text' | 'voice'
  region: string
  created_at: string
  ended_at: string | null
  liked_a: boolean
  liked_b: boolean
  ready_a: boolean
  ready_b: boolean
}

export type MatchMessage = {
  id: string
  session_id: string
  sender_id: string
  body: string
  created_at: string
}

// Both "join the queue" and "poll for a pairing" go through this one call.
// Never throws for "still waiting" — that's a null return, not an error.
export async function requestMatch(mode: 'text' | 'voice'): Promise<MatchSession | null> {
  const { data, error } = await supabase.rpc('request_match', { p_mode: mode })
  if (error) throw error
  return data
}

export async function endMatch(sessionId: string) {
  const { error } = await supabase.rpc('end_match', { p_session_id: sessionId })
  if (error) throw error
}

export async function likeMatchPartner(sessionId: string): Promise<MatchSession> {
  const { data, error } = await supabase.rpc('like_match_partner', { p_session_id: sessionId })
  if (error) throw error
  return data
}

export async function getMyVoiceMinglesRemaining(): Promise<number> {
  const { data, error } = await supabase.rpc('my_voice_mingles_remaining')
  if (error) throw error
  return data as number
}

export async function markMatchReady(sessionId: string): Promise<MatchSession> {
  const { data, error } = await supabase.rpc('mark_match_ready', { p_session_id: sessionId })
  if (error) throw error
  return data
}

export async function getSessionState(
  sessionId: string,
): Promise<Pick<MatchSession, 'ended_at' | 'liked_a' | 'liked_b' | 'ready_a' | 'ready_b'> | null> {
  // Was silently swallowing errors before (data came back undefined on
  // failure, indistinguishable from "row not found yet"). That made a
  // persistent RLS/network failure here look identical to "still
  // syncing," which is exactly the stuck-on-Connecting symptom - throw
  // so callers can tell the two apart and surface it.
  const { data, error } = await supabase
    .from('match_sessions')
    .select('ended_at, liked_a, liked_b, ready_a, ready_b')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchMatchMessages(sessionId: string): Promise<MatchMessage[]> {
  const { data } = await supabase
    .from('match_messages')
    .select('id, session_id, sender_id, body, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function sendMatchMessage(sessionId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from('match_messages')
    .insert({ session_id: sessionId, sender_id: senderId, body })
  if (error) throw error
}
