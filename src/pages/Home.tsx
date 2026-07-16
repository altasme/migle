import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useHomeSocial } from '../hooks/useHomeSocial'
import { AvatarImage } from '../components/AvatarImage'
import { FriendsIcon } from '../components/icons'

// Rooms/browse/VibeMatch were pulled from here per the regional-match
// relaunch spec — the launch product is 1:1 random match, not open rooms.
// This page is intentionally sparse until that match flow lands.
export function Home() {
  const profile = useAuthStore((s) => s.profile)
  const { onlineFriends } = useHomeSocial()

  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="text-sm text-zinc-400">Welcome back, {profile?.username}</p>

      <section className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-6 text-center">
        <p className="font-medium text-white">Random match is coming here</p>
        <p className="mt-1 text-sm text-zinc-500">1:1 text and voice matching, launching soon.</p>
      </section>

      <Link to="/following" className="flex w-fit flex-col items-center gap-1.5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/20 text-purple-400">
          <FriendsIcon className="h-6 w-6" />
        </span>
        <span className="text-xs text-zinc-300">Friends</span>
      </Link>

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
    </div>
  )
}
