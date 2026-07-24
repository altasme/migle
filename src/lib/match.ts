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

export type MatchPreferences = {
  genderPref: 'male' | 'female' | null
  minAge: number
  maxAge: number
}

export const DEFAULT_MATCH_PREFERENCES: MatchPreferences = { genderPref: null, minAge: 18, maxAge: 69 }

// Both "join the queue" and "poll for a pairing" go through this one call.
// Never throws for "still waiting" — that's a null return, not an error.
export async function requestMatch(
  mode: 'text' | 'voice',
  prefs: MatchPreferences = DEFAULT_MATCH_PREFERENCES,
): Promise<MatchSession | null> {
  const { data, error } = await supabase.rpc('request_match', {
    p_mode: mode,
    p_gender_pref: prefs.genderPref,
    p_min_age: prefs.minAge,
    p_max_age: prefs.maxAge,
  })
  if (error) throw error
  // request_match() is declared to return a match_sessions row, and does
  // `return null;` in plpgsql for "no partner yet." A plpgsql function
  // returning a row type doesn't carry that across the RPC/JSON boundary
  // as a true JSON null though - it arrives as an object with every field
  // set to null. That object is truthy in JS, so callers checking
  // `if (found)` were treating "still waiting" as a real match and
  // entering a session with a null id - the root cause of the permanent
  // "Connecting you with them..." stuck screen (every follow-up call for
  // that "session" 400s, since no row has a null id).
  if (!data || !data.id) return null
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
