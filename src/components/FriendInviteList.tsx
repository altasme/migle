import { isOnline } from '../lib/presence'
import type { Friend } from '../lib/friends'

export function FriendInviteList({
  friends,
  invitedIds,
  invitingId,
  onInvite,
}: {
  friends: Friend[]
  invitedIds: Set<string>
  invitingId: string | null
  onInvite: (friendId: string) => void
}) {
  if (friends.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No friends yet. Like each other in a Mingling match first.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {friends.map((f) => {
        const online = isOnline(f.last_seen_at)
        const invited = invitedIds.has(f.id)
        return (
          <div key={f.id} className="flex items-center justify-between text-sm">
            <span className="text-zinc-200">
              {f.username}
              {!online && <span className="ml-2 text-xs text-zinc-500">Offline</span>}
            </span>
            <button
              onClick={() => onInvite(f.id)}
              disabled={!online || invited || invitingId === f.id}
              title={!online ? "Can't invite offline friends" : undefined}
              className="rounded-lg border border-purple-600 px-2.5 py-1 text-xs text-purple-400 disabled:border-zinc-700 disabled:text-zinc-500"
            >
              {invited ? 'Invited' : invitingId === f.id ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
