import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { refreshUnreadCounts } from '../components/NotificationListener'
import { AvatarImage } from '../components/AvatarImage'
import { getBlockedPairIds } from '../lib/safety'

type ThreadRow = {
  id: string
  user_a: string
  user_b: string
  created_at: string
}

type ThreadDisplay = ThreadRow & {
  otherId: string
  otherUsername: string
  otherEquipped: Record<string, string>
}

export function Chat() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)
  const unreadCounts = useNotificationStore((s) => s.unreadCounts)
  const setThreadCounts = useNotificationStore((s) => s.setThreadCounts)
  const [threads, setThreads] = useState<ThreadDisplay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    load(userId)
    refreshUnreadCounts(userId, setThreadCounts)
  }, [userId, setThreadCounts])

  async function load(uid: string) {
    setLoading(true)
    const { data } = await supabase
      .from('dm_threads')
      .select('id, user_a, user_b, created_at')
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as ThreadRow[]
    if (rows.length === 0) {
      setThreads([])
      setLoading(false)
      return
    }
    const otherIds = rows.map((r) => (r.user_a === uid ? r.user_b : r.user_a))
    const [{ data: profs }, blockedIds] = await Promise.all([
      supabase.from('profiles').select('id, username, equipped').in('id', otherIds),
      getBlockedPairIds(uid),
    ])
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]))
    setThreads(
      rows
        .map((r) => {
          const otherId = r.user_a === uid ? r.user_b : r.user_a
          const prof = profMap.get(otherId)
          return {
            ...r,
            otherId,
            otherUsername: prof?.username ?? '?',
            otherEquipped: prof?.equipped ?? {},
          }
        })
        .filter((t) => !blockedIds.has(t.otherId)),
    )
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-white">Chat</h1>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-zinc-500">No conversations yet — find someone in Discover.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {threads.map((t) => {
            const unread = unreadCounts[t.id] ?? 0
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/dm/${t.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left hover:border-purple-600"
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm text-white">
                  <AvatarImage
                    equipped={t.otherEquipped}
                    fallbackLetter={t.otherUsername[0]?.toUpperCase() ?? '?'}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span
                  className={`text-sm ${unread > 0 ? 'font-semibold text-white' : 'font-medium text-zinc-300'}`}
                >
                  {t.otherUsername}
                </span>
                {unread > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1.5 text-xs font-medium text-white">
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
