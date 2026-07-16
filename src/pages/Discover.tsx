import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { getBlockedPairIds } from '../lib/safety'
import { followUser, unfollowUser, getFollowingIds } from '../lib/follows'

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
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followBusy, setFollowBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const uid = userId
    async function load() {
      const [{ data: profs }, blockedIds, following] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, equipped')
          .neq('id', uid)
          .order('last_seen_at', { ascending: false })
          .limit(50),
        getBlockedPairIds(uid),
        getFollowingIds(uid),
      ])
      setProfiles((profs ?? []).filter((p) => !blockedIds.has(p.id)))
      setFollowingIds(following)
      setLoading(false)
    }
    load()
  }, [userId])

  async function toggleFollow(otherId: string) {
    if (!userId) return
    setFollowBusy(otherId)
    try {
      if (followingIds.has(otherId)) {
        await unfollowUser(userId, otherId)
        setFollowingIds((prev) => {
          const next = new Set(prev)
          next.delete(otherId)
          return next
        })
      } else {
        await followUser(userId, otherId)
        setFollowingIds((prev) => new Set(prev).add(otherId))
      }
    } finally {
      setFollowBusy(null)
    }
  }

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
              <span className="text-sm font-medium text-white">{p.username}</span>
              <button
                onClick={() => approach(p.id)}
                disabled={approaching === p.id}
                className="w-full rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {approaching === p.id ? 'Sending…' : 'Message'}
              </button>
              <button
                onClick={() => toggleFollow(p.id)}
                disabled={followBusy === p.id}
                className={`w-full rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  followingIds.has(p.id)
                    ? 'border border-zinc-700 text-zinc-300'
                    : 'border border-purple-600 text-purple-400'
                }`}
              >
                {followBusy === p.id ? '…' : followingIds.has(p.id) ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
