import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { getFriendIds } from '../lib/friends'
import { isOnline } from '../lib/presence'

export type OnlineFriend = { id: string; username: string; equipped: Record<string, string> }
export type FriendHangout = { ownerUsername: string; roomName: string; roomSlug: string }

const POLL_MS = 20_000

export function useHomeSocial() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([])
  const [friendHangouts, setFriendHangouts] = useState<FriendHangout[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const friendIds = await getFriendIds(userId)
    if (friendIds.size === 0) {
      setOnlineFriends([])
      setFriendHangouts([])
      setLoading(false)
      return
    }
    const ids = [...friendIds]

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, equipped, last_seen_at')
      .in('id', ids)

    setOnlineFriends(
      (profs ?? [])
        .filter((p) => isOnline(p.last_seen_at))
        .map((p) => ({ id: p.id, username: p.username, equipped: p.equipped })),
    )

    // "Open" means the hangout is active AND the owner is actually back
    // inside it right now - matches the join_room policy's own rule, so
    // this list never advertises a hangout a friend can't actually get
    // into.
    const { data: ownedRooms } = await supabase
      .from('rooms')
      .select('id, slug, name, owner_id')
      .in('owner_id', ids)
      .eq('is_active', true)
    if (!ownedRooms || ownedRooms.length === 0) {
      setFriendHangouts([])
      setLoading(false)
      return
    }
    const { data: presentOwners } = await supabase
      .from('room_members')
      .select('room_id, user_id')
      .in(
        'room_id',
        ownedRooms.map((r) => r.id),
      )
    const openRoomIds = new Set(
      (presentOwners ?? [])
        .filter((m) => ownedRooms.some((r) => r.id === m.room_id && r.owner_id === m.user_id))
        .map((m) => m.room_id),
    )
    const profsById = new Map((profs ?? []).map((p) => [p.id, p.username]))
    setFriendHangouts(
      ownedRooms
        .filter((r) => openRoomIds.has(r.id))
        .map((r) => ({
          ownerUsername: profsById.get(r.owner_id) ?? '?',
          roomName: r.name,
          roomSlug: r.slug,
        })),
    )
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { onlineFriends, friendHangouts, loading, refresh }
}
