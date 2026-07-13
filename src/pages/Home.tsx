import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slug'
import { useAuthStore } from '../store/authStore'

export function Home() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [joinSlug, setJoinSlug] = useState('')

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
      setCreateError(error.message)
      setCreating(false)
      return
    }

    navigate(`/r/${slug}`)
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!joinSlug.trim()) return
    navigate(`/r/${joinSlug.trim()}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">@{profile?.username}</h1>
        <button
          type="button"
          onClick={signOut}
          className="mt-1 text-sm text-zinc-400 hover:text-white"
        >
          Log out
        </button>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2">
        <label className="text-sm text-zinc-400">Create a room</label>
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
          className="rounded-lg bg-purple-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create room'}
        </button>
      </form>

      <form onSubmit={handleJoin} className="flex flex-col gap-2">
        <label className="text-sm text-zinc-400">Join by room code</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="night-owls-a1b2"
            value={joinSlug}
            onChange={(e) => setJoinSlug(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:text-white"
          >
            Join
          </button>
        </div>
      </form>
    </div>
  )
}
