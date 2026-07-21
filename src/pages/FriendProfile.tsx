import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { getFriendCount, getFriendIds } from '../lib/friends'

type TargetProfile = {
  id: string
  username: string
  equipped: Record<string, string>
  bio: string | null
  interests: string[]
}

// Friends-only, never a public profile browser (CLAUDE.md explicitly
// keeps "public profiles" out of scope) - the friendship check happens
// here in the app, not just by relying on who has a link to this page.
export function FriendProfile() {
  const { userId: targetId } = useParams<{ userId: string }>()
  const myId = useAuthStore((s) => s.session?.user.id)
  const [status, setStatus] = useState<'loading' | 'not-friends' | 'ready'>('loading')
  const [target, setTarget] = useState<TargetProfile | null>(null)
  const [friendCount, setFriendCount] = useState(0)

  useEffect(() => {
    if (!myId || !targetId) return
    setStatus('loading')
    ;(async () => {
      const friendIds = await getFriendIds(myId)
      if (!friendIds.has(targetId)) {
        setStatus('not-friends')
        return
      }
      const [{ data }, count] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, equipped, bio, interests')
          .eq('id', targetId)
          .maybeSingle(),
        getFriendCount(targetId),
      ])
      if (!data) {
        setStatus('not-friends')
        return
      }
      setTarget(data)
      setFriendCount(count)
      setStatus('ready')
    })()
  }, [myId, targetId])

  if (status === 'loading') return null

  if (status === 'not-friends' || !target) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">You can only view friends' profiles.</p>
        <Link to="/friends" className="mt-2 inline-block text-purple-400 hover:underline">
          Back to friends
        </Link>
      </div>
    )
  }

  return (
    <div className="page-enter mx-auto flex w-full max-w-md flex-col gap-6 p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link to="/friends" className="self-start text-sm text-zinc-400 hover:text-white">
        ← Back
      </Link>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-700 to-pink-700 text-2xl font-semibold text-white ring-4 ring-purple-600/20">
          <AvatarImage
            equipped={target.equipped}
            fallbackLetter={target.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
          />
        </span>
        <h1 className="text-2xl font-bold text-white">{target.username}</h1>
        <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-1.5 text-sm">
          <span className="font-semibold text-white">{friendCount}</span>
          <span className="text-zinc-400">Friends</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-sm text-zinc-300">
          {target.bio || <span className="text-zinc-600">No bio yet.</span>}
        </p>
        {target.interests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {target.interests.map((i) => (
              <span
                key={i}
                className="rounded-full border border-purple-500 bg-purple-600 px-3 py-1 text-xs text-white"
              >
                {i}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
