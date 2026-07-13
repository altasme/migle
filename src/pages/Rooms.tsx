import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveRooms } from '../hooks/useActiveRooms'

export function Rooms() {
  const { myRoom, otherRooms, loading } = useActiveRooms()
  const navigate = useNavigate()
  const [joinSlug, setJoinSlug] = useState('')

  function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!joinSlug.trim()) return
    navigate(`/r/${joinSlug.trim()}`)
  }

  const rooms = myRoom ? [myRoom, ...otherRooms] : otherRooms

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-white">Rooms</h1>

      <form onSubmit={handleJoin} className="flex gap-2">
        <input
          type="text"
          placeholder="Have a room code?"
          value={joinSlug}
          onChange={(e) => setJoinSlug(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:text-white"
        >
          Join
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No rooms open right now. Be the first — create one from Home.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rooms.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => navigate(`/r/${r.slug}`)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left hover:border-purple-600"
              >
                <span>
                  <span className="block text-sm font-medium text-white">
                    {r.name}
                    {r.id === myRoom?.id && <span className="ml-2 text-xs text-purple-400">(yours)</span>}
                  </span>
                  {r.topic && <span className="block text-xs text-zinc-500">{r.topic}</span>}
                </span>
                <span className="text-xs text-purple-400">Join →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
