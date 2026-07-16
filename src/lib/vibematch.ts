import { supabase } from './supabase'
import { getBlockedPairIds } from './safety'

// "VibeMatch" — a lightweight stand-in for the mockup's Random Chat: picks
// a random other user and opens a DM via the existing approach flow, rather
// than a full live matchmaking queue.
export async function findVibeMatch(userId: string): Promise<string> {
  const [{ data: profiles }, blockedIds] = await Promise.all([
    supabase.from('profiles').select('id').neq('id', userId).limit(200),
    getBlockedPairIds(userId),
  ])
  const candidates = (profiles ?? []).map((p) => p.id).filter((id) => !blockedIds.has(id))
  if (candidates.length === 0) throw new Error('No one to match with right now.')

  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  const { data, error } = await supabase.rpc('approach_user', { p_to: pick })
  if (error) throw error
  return data.thread_id as string
}
