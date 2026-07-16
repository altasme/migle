import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { pingPresence } from '../lib/presence'

const HEARTBEAT_MS = 60_000

// Mounted once in AppLayout — keeps profiles.last_seen_at fresh while the
// app is open, so "online" (see lib/presence) means "recently active", not
// "signed in ever". No realtime presence channel needed for this.
export function PresenceHeartbeat() {
  const userId = useAuthStore((s) => s.session?.user.id)

  useEffect(() => {
    if (!userId) return
    pingPresence(userId)
    const id = setInterval(() => pingPresence(userId), HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [userId])

  return null
}
