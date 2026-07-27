import { supabase } from './supabase'

export type Friend = {
  id: string
  username: string
  equipped: Record<string, string>
  last_seen_at: string | null
}

export async function listFriends(userId: string): Promise<Friend[]> {
  const { data: links } = await supabase
    .from('friendships')
    .select('user_a, user_b')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
  const ids = (links ?? []).map((r) => (r.user_a === userId ? r.user_b : r.user_a))
  if (ids.length === 0) return []

  const { data: profs } = await supabase
    .from('profiles')
    .select('id, username, equipped, last_seen_at')
    .in('id', ids)
  return (profs ?? []) as Friend[]
}

export async function getFriendIds(userId: string): Promise<Set<string>> {
  const { data: links } = await supabase
    .from('friendships')
    .select('user_a, user_b')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
  return new Set((links ?? []).map((r) => (r.user_a === userId ? r.user_b : r.user_a)))
}

export async function getFriendCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('friendships')
    .select('user_a', { count: 'exact', head: true })
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
  return count ?? 0
}

// matchSessionId: when a text match turns into a mutual like, the RPC
// carries that session's messages into the (newly created) thread instead
// of starting it empty. Only has an effect the one time it actually
// creates the thread - a no-op extra param for the plain Friends-list
// "chat" button, which has no match session to pass.
export async function openFriendChat(friendId: string, matchSessionId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_friend_chat', {
    p_friend: friendId,
    p_match_session: matchSessionId ?? null,
  })
  if (error) throw error
  return data.thread_id as string
}
