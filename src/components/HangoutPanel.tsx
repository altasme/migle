import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { listFriends, type Friend } from '../lib/friends'
import { FriendInviteList } from './FriendInviteList'
import {
  createHangout,
  getMyActiveRoom,
  getInvitedFriendIds,
  inviteFriendToRoom,
  type MyRoom,
} from '../lib/hangouts'

export function HangoutPanel() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)
  const username = useAuthStore((s) => s.profile?.username)

  const [myRoom, setMyRoom] = useState<MyRoom | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [topicInput, setTopicInput] = useState('')

  useEffect(() => {
    if (!userId) return
    Promise.all([getMyActiveRoom(userId), listFriends(userId)]).then(([room, f]) => {
      setMyRoom(room)
      setFriends(f)
      setLoading(false)
    })
  }, [userId])

  useEffect(() => {
    if (!myRoom) {
      setInvitedIds(new Set())
      return
    }
    getInvitedFriendIds(myRoom.id).then(setInvitedIds)
  }, [myRoom])

  async function handleCreate() {
    if (!userId || !username) return
    setError(null)
    setCreating(true)
    try {
      const room = await createHangout(userId, username, nameInput, topicInput)
      setMyRoom(room)
    } catch (err) {
      const e = err as { code?: string; message?: string }
      setError(e.code === '23505' ? 'You already have an active hangout.' : e.message ?? 'Something went wrong.')
    } finally {
      setCreating(false)
    }
  }

  async function handleClose() {
    if (!myRoom) return
    setClosing(true)
    await supabase.from('rooms').update({ is_active: false }).eq('id', myRoom.id)
    setMyRoom(null)
    setShowInvite(false)
    setClosing(false)
  }

  async function handleInvite(friendId: string) {
    if (!myRoom) return
    setInvitingId(friendId)
    setError(null)
    try {
      await inviteFriendToRoom(myRoom.id, friendId)
      setInvitedIds((prev) => new Set(prev).add(friendId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setInvitingId(null)
    }
  }

  if (loading) return null

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <span>🏠</span>
        Your hangout
      </h2>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      {!myRoom ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={username ? `${username}'s Hangout` : 'Room name'}
            maxLength={40}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="Topic (optional)"
            maxLength={60}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? 'Starting…' : 'Start a hangout'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{myRoom.name}</p>
              {myRoom.topic && <p className="text-xs text-zinc-400">{myRoom.topic}</p>}
              <p className="text-xs text-zinc-500">Friends only. They can drop in anytime</p>
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
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowInvite((v) => !v)}
            className="text-left text-sm text-purple-400 hover:underline"
          >
            {showInvite ? 'Hide friends list' : 'Invite friends →'}
          </button>

          {showInvite && (
            <FriendInviteList
              friends={friends}
              invitedIds={invitedIds}
              invitingId={invitingId}
              onInvite={handleInvite}
            />
          )}
        </div>
      )}
    </section>
  )
}
