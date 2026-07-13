import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export type RoomRow = {
  id: string
  slug: string
  name: string
  topic: string | null
  owner_id: string
}

export function useActiveRooms() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rooms')
      .select('id, slug, name, topic, owner_id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setRooms(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userId) refresh()
  }, [userId, refresh])

  const myRoom = rooms.find((r) => r.owner_id === userId) ?? null
  const otherRooms = rooms.filter((r) => r.owner_id !== userId)

  return { myRoom, otherRooms, loading, refresh }
}
