import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { getBlockedPairIds } from '../lib/safety'

type Profile = {
  id: string
  username: string
  equipped: Record<string, string>
}

export function Discover() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [approaching, setApproaching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const uid = userId
    async function load() {
      const [{ data: profs }, blockedIds] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, equipped')
          .neq('id', uid)
          .order('last_seen_at', { ascending: false })
          .limit(50),
        getBlockedPairIds(uid),
      ])
      setProfiles((profs ?? []).filter((p) => !blockedIds.has(p.id)))
      setLoading(false)
    }
    load()
  }, [userId])

  async function approach(otherId: string) {
    setError(null)
    setApproaching(otherId)
    const { data, error } = await supabase.rpc('approach_user', { p_to: otherId })
    setApproaching(null)
    if (error) {
      setError(error.message.includes('coins') ? 'Not enough coins.' : error.message)
      return
    }
    navigate(`/dm/${data.thread_id}`)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-white">Discover</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-zinc-500">No one else has joined yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xl text-white">
                <AvatarImage
                  equipped={p.equipped}
                  fallbackLetter={p.username[0]?.toUpperCase() ?? '?'}
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-sm font-medium text-white">@{p.username}</span>
              <button
                onClick={() => approach(p.id)}
                disabled={approaching === p.id}
                className="w-full rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {approaching === p.id ? 'Sending…' : 'Message'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
