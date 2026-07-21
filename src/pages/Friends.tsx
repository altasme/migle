import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { listFriends, openFriendChat, type Friend } from '../lib/friends'

export function Friends() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    listFriends(userId).then((f) => {
      setFriends(f)
      setLoading(false)
    })
  }, [userId])

  async function chat(friendId: string) {
    setError(null)
    setOpeningId(friendId)
    try {
      const threadId = await openFriendChat(friendId)
      navigate(`/dm/${threadId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setOpeningId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link to="/profile" className="text-sm text-zinc-400 hover:text-white">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-white">Friends</h1>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : friends.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <span className="text-3xl">🤝</span>
          <p className="text-sm text-zinc-500">
            No friends yet. Like each other in a Mingling match to become friends.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {friends.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <Link to={`/friend/${f.id}`} className="flex flex-1 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
                  <AvatarImage
                    equipped={f.equipped}
                    fallbackLetter={f.username[0]?.toUpperCase() ?? '?'}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="text-sm font-medium text-white">{f.username}</span>
              </Link>
              <button
                onClick={() => chat(f.id)}
                disabled={openingId === f.id}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-transform active:scale-95 disabled:opacity-50"
              >
                {openingId === f.id ? 'Opening…' : 'Chat'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
