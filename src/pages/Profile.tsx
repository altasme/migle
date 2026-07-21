import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { getFriendCount } from '../lib/friends'
import { ECONOMY_ENABLED } from '../lib/featureFlags'

type ActiveRelationship = {
  partnerUsername: string
  cp_score: number
  streak_days: number
}

export function Profile() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)
  const [relationship, setRelationship] = useState<ActiveRelationship | null>(null)
  const [friendCount, setFriendCount] = useState(0)

  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return
    getFriendCount(uid).then(setFriendCount)
  }, [session?.user.id])

  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return

    async function refresh() {
      const { data } = await supabase
        .from('relationships')
        .select('user_a, user_b, cp_score, streak_days')
        .eq('status', 'active')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .maybeSingle()
      if (!data) {
        setRelationship(null)
        return
      }
      const partnerId = data.user_a === uid ? data.user_b : data.user_a
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', partnerId)
        .maybeSingle()
      setRelationship({
        partnerUsername: prof?.username ?? '?',
        cp_score: data.cp_score,
        streak_days: data.streak_days,
      })
    }

    refresh()
    // Partner could end things from their side while we're just sitting
    // on this page — poll so it doesn't go stale.
    const pollId = setInterval(refresh, 5000)
    return () => clearInterval(pollId)
  }, [session?.user.id])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-700 to-pink-700 text-2xl font-semibold text-white ring-4 ring-purple-600/20">
          <AvatarImage
            equipped={profile?.equipped}
            fallbackLetter={profile?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
          />
        </span>
        <h1 className="text-2xl font-bold text-white">{profile?.username}</h1>
        <Link
          to="/friends"
          className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-1.5 text-sm"
        >
          <span className="font-semibold text-white">{friendCount}</span>
          <span className="text-zinc-400">Friends</span>
        </Link>
      </div>

      {ECONOMY_ENABLED && relationship && (
        <div className="rounded-xl border border-pink-900/50 bg-pink-950/30 px-4 py-3 text-center text-sm">
          <p className="text-pink-400">💍 Partnered with {relationship.partnerUsername}</p>
          <p className="text-xs text-zinc-400">
            CP {relationship.cp_score} · {relationship.streak_days} day streak
          </p>
        </div>
      )}

      <Link
        to="/wardrobe"
        className="rounded-xl bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98]"
      >
        🎨 Edit avatar
      </Link>

      <div className="flex flex-col divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <Link to="/blocked" className="px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white">
          🚫 Blocked users
        </Link>
        {profile?.is_admin && (
          <Link
            to="/admin/reports"
            className="px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
          >
            🛡️ Reports (admin)
          </Link>
        )}
      </div>

      <button
        onClick={signOut}
        className="rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-400 hover:text-white"
      >
        Log out
      </button>
    </div>
  )
}
