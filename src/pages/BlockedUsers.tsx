import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { unblockUser } from '../lib/safety'
import { AvatarImage } from '../components/AvatarImage'

type BlockedProfile = {
  id: string
  username: string
  equipped: Record<string, string>
}

export function BlockedUsers() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)
  const [users, setUsers] = useState<BlockedProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    load()
  }, [userId])

  async function load() {
    setLoading(true)
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId)
    const ids = (blocks ?? []).map((b) => b.blocked_id)
    if (ids.length === 0) {
      setUsers([])
      setLoading(false)
      return
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, equipped')
      .in('id', ids)
    setUsers(profs ?? [])
    setLoading(false)
  }

  async function handleUnblock(id: string) {
    setBusy(id)
    try {
      await unblockUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white">
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-white">Blocked users</h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-zinc-500">You haven't blocked anyone.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
            >
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm text-white">
                <AvatarImage
                  equipped={u.equipped}
                  fallbackLetter={u.username[0]?.toUpperCase() ?? '?'}
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="flex-1 text-sm font-medium text-white">{u.username}</span>
              <button
                onClick={() => handleUnblock(u.id)}
                disabled={busy === u.id}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 disabled:opacity-50"
              >
                {busy === u.id ? 'Unblocking…' : 'Unblock'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
