import { supabase } from './supabase'

export const ONLINE_WINDOW_MINUTES = 5

export function isOnline(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MINUTES * 60_000
}

export async function pingPresence(userId: string) {
  await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
}
