import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'

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

  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return
    supabase
      .from('relationships')
      .select('user_a, user_b, cp_score, streak_days')
      .eq('status', 'active')
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
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
      })
  }, [session?.user.id])

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-purple-900 text-2xl font-semibold text-white">
        <AvatarImage
          equipped={profile?.equipped}
          fallbackLetter={profile?.username[0]?.toUpperCase() ?? '?'}
          className="h-full w-full object-contain"
        />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white">@{profile?.username}</h1>
        <p className="text-sm text-zinc-500">{session?.user.email}</p>
      </div>

      {relationship && (
        <div className="rounded-lg border border-pink-900/50 bg-pink-950/30 px-4 py-2 text-sm">
          <p className="text-pink-400">💍 Partnered with @{relationship.partnerUsername}</p>
          <p className="text-xs text-zinc-400">
            CP {relationship.cp_score} · {relationship.streak_days} day streak
          </p>
        </div>
      )}

      <Link
        to="/wardrobe"
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
      >
        Edit avatar
      </Link>
      <Link to="/leaderboard" className="text-sm text-zinc-400 hover:text-white">
        🏆 CP Leaderboard
      </Link>
      <button
        onClick={signOut}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:text-white"
      >
        Log out
      </button>
    </div>
  )
}
