import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { refreshUnreadCounts } from '../components/NotificationListener'
import { AvatarImage } from '../components/AvatarImage'
import { getBlockedPairIds } from '../lib/safety'
import { isOnline } from '../lib/presence'
import { formatRelativeTime } from '../lib/time'

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
  otherOnline: boolean
  lastMessage: string | null
  lastMessageAt: string
  lastMessageMine: boolean
}

export function Chat() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)
  const unreadCounts = useNotificationStore((s) => s.unreadCounts)
  const setThreadCounts = useNotificationStore((s) => s.setThreadCounts)
  const [threads, setThreads] = useState<ThreadDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

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
    const rows = (data ?? []) as ThreadRow[]
    if (rows.length === 0) {
      setThreads([])
      setLoading(false)
      return
    }
    const threadIds = rows.map((r) => r.id)
    const otherIds = rows.map((r) => (r.user_a === uid ? r.user_b : r.user_a))
    const [{ data: profs }, blockedIds, { data: lastMessages }] = await Promise.all([
      supabase.from('profiles').select('id, username, equipped, last_seen_at').in('id', otherIds),
      getBlockedPairIds(uid),
      // Recent-first across all my threads, capped rather than unbounded -
      // enough to cover "latest message per thread" at real usage scale
      // without pulling entire histories just to build a preview list.
      supabase
        .from('dm_messages')
        .select('thread_id, sender_id, body, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]))
    const lastByThread = new Map<string, { sender_id: string; body: string; created_at: string }>()
    for (const m of lastMessages ?? []) {
      if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m)
    }
    setThreads(
      rows
        .map((r) => {
          const otherId = r.user_a === uid ? r.user_b : r.user_a
          const prof = profMap.get(otherId)
          const last = lastByThread.get(r.id)
          return {
            ...r,
            otherId,
            otherUsername: prof?.username ?? '?',
            otherEquipped: prof?.equipped ?? {},
            otherOnline: isOnline(prof?.last_seen_at),
            lastMessage: last?.body ?? null,
            lastMessageAt: last?.created_at ?? r.created_at,
            lastMessageMine: last?.sender_id === uid,
          }
        })
        .filter((t) => !blockedIds.has(t.otherId))
        // Most-recent-activity first, Discord/Messenger style - not thread
        // creation order, which would strand an old-but-active chat at the
        // bottom forever.
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
    )
    setLoading(false)
  }

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return threads
    return threads.filter((t) => t.otherUsername.toLowerCase().includes(q))
  }, [threads, query])

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-white">Chat</h1>

      {threads.length > 0 && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          className="w-full rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
        />
      )}

      {loading ? (
        // Skeleton rows shaped like the real list, so the page doesn't
        // jump when content lands.
        <div className="flex flex-col divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="skeleton h-12 w-12 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-2.5 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <span className="text-3xl">💬</span>
          <p className="text-sm text-zinc-500">No conversations yet.</p>
        </div>
      ) : visibleThreads.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No matches for "{query}".</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          {visibleThreads.map((t) => {
            const unread = unreadCounts[t.id] ?? 0
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/dm/${t.id}`)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-zinc-800/60 hover:bg-zinc-800/40"
              >
                <span className="relative shrink-0">
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm text-white">
                    <AvatarImage
                      equipped={t.otherEquipped}
                      fallbackLetter={t.otherUsername[0]?.toUpperCase() ?? '?'}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  {t.otherOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 bg-emerald-500" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm ${unread > 0 ? 'font-semibold text-white' : 'font-medium text-zinc-200'}`}
                    >
                      {t.otherUsername}
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {formatRelativeTime(t.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-xs ${unread > 0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {t.lastMessage
                        ? `${t.lastMessageMine ? 'You: ' : ''}${t.lastMessage}`
                        : 'Say hi 👋'}
                    </p>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[11px] font-medium text-white">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
