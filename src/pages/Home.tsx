import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useHomeSocial } from '../hooks/useHomeSocial'
import { AvatarImage } from '../components/AvatarImage'
import { FriendsIcon } from '../components/icons'
import { HangoutPanel } from '../components/HangoutPanel'
import { HangoutInvites } from '../components/HangoutInvites'

// Open room browsing was pulled from here per the regional-match relaunch
// spec — the launch product is 1:1 random match. Hangouts are back, but
// invite-only and friends-only, never publicly discoverable.
export function Home() {
  const profile = useAuthStore((s) => s.profile)
  const { onlineFriends } = useHomeSocial()

  return (
    <div className="flex flex-col gap-7 p-4">
      <p className="text-xl font-semibold text-white">
        Welcome back, <span className="text-purple-400">{profile?.username}</span>
      </p>

      <Link
        to="/vibematch"
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-center shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98]"
      >
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-lg font-semibold text-white">✨ Let's start Mingling!</p>
        <p className="mt-1 text-sm text-white/80">Meet someone new, right now.</p>
      </Link>

      <Link to="/friends" className="flex w-fit flex-col items-center gap-1.5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/20 text-purple-400">
          <FriendsIcon className="h-6 w-6" />
        </span>
        <span className="text-xs font-medium text-zinc-300">Friends</span>
      </Link>

      <HangoutInvites />
      <HangoutPanel />

      {onlineFriends.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Friends online
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {onlineFriends.map((f) => (
              <Link key={f.id} to="/friends" className="flex flex-shrink-0 flex-col items-center gap-1">
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
    </div>
  )
}
