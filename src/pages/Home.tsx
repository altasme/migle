import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'
import { useActiveRooms } from '../hooks/useActiveRooms'
import { useHomeSocial } from '../hooks/useHomeSocial'
import { findVibeMatch } from '../lib/vibematch'
import { AvatarImage } from '../components/AvatarImage'
import { RoomsIcon, FriendsIcon, VibeMatchIcon } from '../components/icons'

export function Home() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const navigate = useNavigate()
  const { myRoom, otherRooms, refresh } = useActiveRooms()
  const { onlineFriends, friendInRoom } = useHomeSocial()

  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!roomName.trim()) return
    setCreating(true)

    const slug = slugify(roomName)
    const { error } = await supabase.from('rooms').insert({
      slug,
      name: roomName.trim(),
      owner_id: session!.user.id,
    })

    if (error) {
      setCreateError(error.code === '23505' ? 'You already have an active room.' : error.message)
      setCreating(false)
      return
    }

    navigate(`/r/${slug}`)
  }

  async function handleClose() {
    if (!myRoom) return
    setClosing(true)
    await supabase.from('rooms').update({ is_active: false }).eq('id', myRoom.id)
    await refresh()
    setClosing(false)
  }

  async function handleVibeMatch() {
    if (!session) return
    setMatchError(null)
    setMatching(true)
    try {
      const threadId = await findVibeMatch(session.user.id)
      navigate(`/dm/${threadId}`)
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="text-sm text-zinc-400">Welcome back, {profile?.username}</p>

      <section className="grid grid-cols-3 gap-3">
        <Link to="/rooms" className="flex flex-col items-center gap-1.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/20 text-purple-400">
            <RoomsIcon className="h-6 w-6" />
          </span>
          <span className="text-xs text-zinc-300">Join Room</span>
        </Link>
        <button onClick={handleVibeMatch} disabled={matching} className="flex flex-col items-center gap-1.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-600/20 text-pink-400">
            <VibeMatchIcon className="h-6 w-6" />
          </span>
          <span className="text-xs text-zinc-300">{matching ? 'Matching…' : 'VibeMatch'}</span>
        </button>
        <Link to="/following" className="flex flex-col items-center gap-1.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/20 text-purple-400">
            <FriendsIcon className="h-6 w-6" />
          </span>
          <span className="text-xs text-zinc-300">Friends</span>
        </Link>
      </section>
      {matchError && <p className="-mt-4 text-sm text-red-400">{matchError}</p>}

      {friendInRoom && (
        <Link
          to={`/r/${friendInRoom.roomSlug}`}
          className="flex items-center justify-between rounded-lg border border-purple-800/50 bg-purple-950/30 px-4 py-2 text-sm"
        >
          <span className="text-zinc-200">
            🎙️ <span className="font-medium text-white">{friendInRoom.username}</span> is talking in{' '}
            {friendInRoom.roomName}
          </span>
          <span className="text-purple-400">Join →</span>
        </Link>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Your room</h2>
        {myRoom ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{myRoom.name}</p>
              <p className="text-xs text-zinc-500">/r/{myRoom.slug}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/r/${myRoom.slug}`)}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Enter
              </button>
              <button
                onClick={handleClose}
                disabled={closing}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            <input
              type="text"
              required
              placeholder="Room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            {createError && <p className="text-sm text-red-400">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create room'}
            </button>
          </form>
        )}
      </section>

      {onlineFriends.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Friends online</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {onlineFriends.map((f) => (
              <Link key={f.id} to="/following" className="flex flex-shrink-0 flex-col items-center gap-1">
                <span className="relative">
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
                    <AvatarImage
                      equipped={f.equipped}
                      fallbackLetter={f.username[0]?.toUpperCase() ?? '?'}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-500" />
                </span>
                <span className="max-w-14 truncate text-[11px] text-zinc-400">{f.username}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400">Trending rooms</h2>
          <Link to="/rooms" className="text-xs text-purple-400 hover:underline">
            See all
          </Link>
        </div>
        {otherRooms.length === 0 ? (
          <p className="text-sm text-zinc-500">No rooms open right now.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {otherRooms.slice(0, 8).map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/r/${r.slug}`)}
                className="flex w-36 flex-shrink-0 flex-col items-start gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-left hover:border-purple-600"
              >
                <span className="text-sm font-medium text-white">{r.name}</span>
                {r.topic && <span className="text-xs text-zinc-500">{r.topic}</span>}
                <span className="mt-1 text-xs text-purple-400">Join →</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
