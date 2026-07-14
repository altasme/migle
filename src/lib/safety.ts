import { supabase } from './supabase'

export async function blockUser(blockedId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedId })
  if (error) throw error
}

export async function unblockUser(blockedId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)
  if (error) throw error
}

export async function isBlocked(otherId: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocked_id', otherId)
    .maybeSingle()
  return !!data
}

// Symmetric: everyone in a block relationship with me, whichever
// direction it was made in — for quietly filtering them out of lists
// (Discover, Rooms), not for showing a "you were blocked" notice.
export async function getBlockedPairIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
  const ids = new Set<string>()
  for (const row of data ?? []) {
    ids.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id)
  }
  return ids
}

export async function reportUser(reportedId: string, reason: string, roomId?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    reported_id: reportedId,
    room_id: roomId ?? null,
    reason,
  })
  if (error) throw error
}
