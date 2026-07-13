import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'

type ThreadRow = {
  id: string
  user_a: string
  user_b: string
  status: string
  initiator: string
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
  const [threads, setThreads] = useState<ThreadDisplay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    load(userId)
  }, [userId])

  async function load(uid: string) {
    setLoading(true)
    const { data } = await supabase
      .from('dm_threads')
      .select('id, user_a, user_b, status, initiator, created_at')
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as ThreadRow[]
    if (rows.length === 0) {
      setThreads([])
      setLoading(false)
      return
    }
    const otherIds = rows.map((r) => (r.user_a === uid ? r.user_b : r.user_a))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, equipped')
      .in('id', otherIds)
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]))
    setThreads(
      rows.map((r) => {
        const otherId = r.user_a === uid ? r.user_b : r.user_a
        const prof = profMap.get(otherId)
        return {
          ...r,
          otherId,
          otherUsername: prof?.username ?? '?',
          otherEquipped: prof?.equipped ?? {},
        }
      }),
    )
    setLoading(false)
  }

  const requests = threads.filter((t) => t.status === 'pending' && t.initiator !== userId)
  const chats = threads.filter((t) => !(t.status === 'pending' && t.initiator !== userId))

  function ThreadRowItem({ t }: { t: ThreadDisplay }) {
    return (
      <button
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
        <span className="text-sm font-medium text-white">@{t.otherUsername}</span>
        {t.status === 'pending' && t.initiator === userId && (
          <span className="ml-auto text-xs text-zinc-500">Pending</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold text-white">Chat</h1>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          {requests.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Requests
              </h2>
              <div className="flex flex-col gap-2">
                {requests.map((t) => (
                  <ThreadRowItem key={t.id} t={t} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Chats
            </h2>
            {chats.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No conversations yet — find someone in Discover.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {chats.map((t) => (
                  <ThreadRowItem key={t.id} t={t} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
