import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'
import { useActiveRooms } from '../hooks/useActiveRooms'

export function Home() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const navigate = useNavigate()
  const { myRoom, otherRooms, refresh } = useActiveRooms()

  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

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

  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="text-sm text-zinc-400">Welcome back, @{profile?.username}</p>

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

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400">Trending rooms</h2>
          <Link to="/rooms" className="text-xs text-purple-400 hover:underline">
            See all
          </Link>
        </div>
        {otherRooms.length === 0 ? (
          <p className="text-sm text-zinc-500">No rooms open right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {otherRooms.slice(0, 3).map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => navigate(`/r/${r.slug}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-left hover:border-purple-600"
                >
                  <span>
                    <span className="block text-sm font-medium text-white">{r.name}</span>
                    {r.topic && <span className="block text-xs text-zinc-500">{r.topic}</span>}
                  </span>
                  <span className="text-xs text-purple-400">Join →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
