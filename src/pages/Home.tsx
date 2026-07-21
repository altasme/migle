import { Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const { onlineFriends } = useHomeSocial()

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900">
          <AvatarImage
            equipped={profile?.equipped}
            fallbackLetter={profile?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
            variant="full"
          />
        </span>
        <div>
          <p className="text-xl font-semibold text-white">
            Hey there, <span className="text-purple-400">{profile?.username}</span>
          </p>
          <p className="text-sm text-zinc-400">Every adventure starts with a hello 💜</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-5 shadow-lg shadow-purple-950/40">
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-lg font-semibold text-white">✨ Start Mingling</p>
        <p className="mt-1 text-sm text-white/80">Meet someone new. Start a conversation in seconds.</p>
        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/vibematch', { state: { mode: 'text' } })}
            className="flex flex-col items-start gap-1 rounded-xl bg-black/20 p-3 text-left transition-transform active:scale-95"
          >
            <span className="text-2xl">💬</span>
            <span className="text-sm font-semibold text-white">Text Chat</span>
            <span className="text-xs text-white/70">Match via messages</span>
          </button>
          <button
            onClick={() => navigate('/vibematch', { state: { mode: 'voice' } })}
            className="flex flex-col items-start gap-1 rounded-xl bg-black/20 p-3 text-left transition-transform active:scale-95"
          >
            <span className="text-2xl">🎤</span>
            <span className="text-sm font-semibold text-white">Voice Chat</span>
            <span className="text-xs text-white/70">Talk face to face</span>
          </button>
        </div>
      </div>

      <HangoutInvites />
      <HangoutPanel />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <FriendsIcon className="h-3.5 w-3.5" />
            Friends
          </h2>
          <Link to="/friends" className="text-xs font-medium text-purple-400 hover:underline">
            View all →
          </Link>
        </div>
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
          <Link to="/vibematch" className="flex flex-shrink-0 flex-col items-center gap-1">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-lg text-zinc-500">
              +
            </span>
            <span className="text-[11px] text-zinc-500">Add Friends</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
