import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { getFollowingIds } from '../lib/follows'
import { isOnline } from '../lib/presence'

export type OnlineFriend = { id: string; username: string; equipped: Record<string, string> }
export type FriendInRoom = { username: string; roomName: string; roomSlug: string }

const POLL_MS = 20_000

export function useHomeSocial() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([])
  const [friendInRoom, setFriendInRoom] = useState<FriendInRoom | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const followingIds = await getFollowingIds(userId)
    if (followingIds.size === 0) {
      setOnlineFriends([])
      setFriendInRoom(null)
      setLoading(false)
      return
    }
    const ids = [...followingIds]

    const [{ data: profs }, { data: memberRows }] = await Promise.all([
      supabase.from('profiles').select('id, username, equipped, last_seen_at').in('id', ids),
      supabase.from('room_members').select('user_id, room_id').in('user_id', ids),
    ])

    setOnlineFriends(
      (profs ?? [])
        .filter((p) => isOnline(p.last_seen_at))
        .map((p) => ({ id: p.id, username: p.username, equipped: p.equipped })),
    )

    let friendRoom: FriendInRoom | null = null
    if (memberRows && memberRows.length > 0) {
      const roomIds = [...new Set(memberRows.map((m) => m.room_id))]
      const { data: activeRooms } = await supabase
        .from('rooms')
        .select('id, slug, name')
        .in('id', roomIds)
        .eq('is_active', true)
        .limit(1)
      const room = activeRooms?.[0]
      if (room) {
        const memberRow = memberRows.find((m) => m.room_id === room.id)
        const friendProfile = (profs ?? []).find((p) => p.id === memberRow?.user_id)
        if (friendProfile) {
          friendRoom = { username: friendProfile.username, roomName: room.name, roomSlug: room.slug }
        }
      }
    }
    setFriendInRoom(friendRoom)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { onlineFriends, friendInRoom, loading, refresh }
}
