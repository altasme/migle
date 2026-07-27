// Shown once, right after a brand-new sign-in and before Claim Username -
// the very first thing a new account sees. Ming (already the friendly face
// of onboarding elsewhere) stands on the commissioned background's floating
// island rather than a new character, per the owner's call to keep her
// consistent across the app instead of introducing a second mascot.
const FEATURES = [
  { icon: '/icon-chat.png', label: 'Chat', desc: 'Text anyone around the world' },
  { icon: '/icon-voice-match.png', label: 'Voice Match', desc: 'Talk in voice and connect' },
  { icon: '/icon-hangouts.png', label: 'Hangouts', desc: 'Join rooms and make new friends' },
  { icon: '/icon-watch-together.png', label: 'Watch Together', desc: 'Watch, react, and enjoy' },
  { icon: '/icon-karaoke.png', label: 'Karaoke', desc: 'Sing your heart out together' },
]

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="page-enter relative min-h-svh overflow-y-auto">
      <img src="/welcome-bg.jpg" alt="" className="fixed inset-0 -z-10 h-full w-full object-cover" />

      <div className="relative mx-auto flex w-full max-w-sm flex-col items-center gap-6 px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))] text-center">
        {/* Hero: Ming standing on the background's island, speech bubble
            above her head. Sized/positioned relative to this block rather
            than the whole viewport, so it holds up across phone heights. */}
        <div className="relative flex min-h-[46vh] w-full flex-col items-center justify-end">
          <div className="absolute left-2 top-4 max-w-[11rem] rounded-2xl border border-purple-500/50 bg-zinc-950/70 px-3 py-2 text-left text-sm font-medium text-purple-200 backdrop-blur-sm">
            Your adventure starts here! 💜
            <span className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 border-b border-r border-purple-500/50 bg-zinc-950/70" />
          </div>

          <div className="relative">
            <div className="absolute bottom-2 left-1/2 h-6 w-28 -translate-x-1/2 rounded-full bg-purple-950/40 blur-xl" />
            <img
              src="/mascot-guide.png"
              alt="Ming"
              className="relative h-52 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold leading-tight text-white">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mingleverse!
            </span>{' '}
            💜
          </h1>
          <p className="text-sm text-zinc-300">
            A universe where strangers become friends.
            <br />
            Chat, hang out, and create <span className="text-purple-300">amazing memories</span>.
          </p>
        </div>

        <div className="flex w-full flex-wrap justify-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 backdrop-blur-sm">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex w-[28%] min-w-[5.5rem] flex-col items-center gap-1 text-center">
              <img src={f.icon} alt="" className="h-11 w-11 object-contain" />
              <span className="text-xs font-semibold text-white">{f.label}</span>
              <span className="text-[10px] leading-tight text-zinc-400">{f.desc}</span>
            </div>
          ))}
        </div>

        <div className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3 text-left backdrop-blur-sm">
          <span className="text-xl">⭐</span>
          <p className="text-xs text-zinc-300">
            <span className="font-semibold text-white">Be yourself, be kind, and enjoy the journey.</span> Your next
            best friend might be just one "Hi" away.
          </p>
          <span className="text-xl">💜</span>
        </div>

        <button
          onClick={onNext}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98]"
        >
          Let's get started
          <span aria-hidden>→</span>
        </button>
        <p className="-mt-3 text-xs text-zinc-500">Next: Choose your username</p>
      </div>
    </div>
  )
}
