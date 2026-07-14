import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'

const GIFT_EMOJI: Record<string, string> = {
  rose: '🌹',
  coffee: '☕',
  cake: '🎂',
  teddy: '🧸',
  balloons: '🎈',
  fireworks: '🎆',
  ring: '💍',
}

// App-wide listener for things that should notify you no matter which
// screen you're on: a new DM (per-thread unread count) or a gift sent to
// you (toast). Mounted once in AppLayout, so it's live on Home/Rooms/
// Chat/Discover/Profile but not inside a Room or a DM thread — those
// screens already show gifts/messages directly, live, so there's
// nothing to miss.
export function NotificationListener() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const incrementThreadUnread = useNotificationStore((s) => s.incrementThreadUnread)
  const setThreadCounts = useNotificationStore((s) => s.setThreadCounts)
  const showToast = useNotificationStore((s) => s.showToast)
  const clearToast = useNotificationStore((s) => s.clearToast)

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notify:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages' },
        (payload) => {
          // RLS already restricts delivery to messages in threads we're a
          // participant of, so any row here that isn't from us is new.
          const row = payload.new as { thread_id: string; sender_id: string }
          if (row.sender_id !== userId) incrementThreadUnread(row.thread_id)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gifts_sent', filter: `to_user=eq.${userId}` },
        async (payload) => {
          const row = payload.new as { gift_id: string; from_user: string }
          const [{ data: sender }, { data: gift }] = await Promise.all([
            supabase.from('profiles').select('username').eq('id', row.from_user).maybeSingle(),
            supabase.from('gift_catalog').select('name').eq('id', row.gift_id).maybeSingle(),
          ])
          const toast = {
            emoji: GIFT_EMOJI[row.gift_id] ?? '🎁',
            text: `${sender?.username ?? 'Someone'} sent you a ${gift?.name ?? 'gift'}!`,
          }
          showToast(toast)
          setTimeout(() => clearToast(), 4000)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, incrementThreadUnread, showToast, clearToast])

  // Belt-and-suspenders: the realtime push above isn't reliably reaching
  // this listener, so also poll and recompute per-thread counts fresh —
  // self-correcting, no risk of double-counting across ticks.
  useEffect(() => {
    if (!userId) return
    const pollId = setInterval(() => refreshUnreadCounts(userId, setThreadCounts), 5000)
    refreshUnreadCounts(userId, setThreadCounts)
    return () => clearInterval(pollId)
  }, [userId, setThreadCounts])

  return null
}

export async function refreshUnreadCounts(
  userId: string,
  setThreadCounts: (counts: Record<string, number>) => void,
) {
  const { lastReadFor } = useNotificationStore.getState()
  const { data } = await supabase
    .from('dm_messages')
    .select('thread_id, created_at')
    .neq('sender_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!data) return
  const counts: Record<string, number> = {}
  for (const row of data) {
    if (row.created_at > lastReadFor(row.thread_id)) {
      counts[row.thread_id] = (counts[row.thread_id] ?? 0) + 1
    }
  }
  setThreadCounts(counts)
}
