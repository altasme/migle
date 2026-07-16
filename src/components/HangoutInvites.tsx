import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { listMyHangoutInvites, type HangoutInvite } from '../lib/hangouts'

const POLL_MS = 15_000

export function HangoutInvites() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const [invites, setInvites] = useState<HangoutInvite[]>([])

  useEffect(() => {
    if (!userId) return
    function refresh() {
      listMyHangoutInvites(userId!).then(setInvites)
    }
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [userId])

  if (invites.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-zinc-400">Hangout invites</h2>
      <div className="flex flex-col gap-2">
        {invites.map((i) => (
          <Link
            key={i.roomId}
            to={`/r/${i.roomSlug}`}
            className="flex items-center justify-between rounded-lg border border-purple-800/50 bg-purple-950/30 px-4 py-2 text-sm"
          >
            <span className="text-zinc-200">
              <span className="font-medium text-white">{i.inviterUsername}</span> invited you to{' '}
              {i.roomName}
            </span>
            <span className="text-purple-400">Join →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
