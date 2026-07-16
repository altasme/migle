import { supabase } from './supabase'

export async function followUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId })
  if (error) throw error
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
}

export async function getFollowingIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  return new Set((data ?? []).map((r) => r.following_id as string))
}

export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}
