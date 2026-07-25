import { useState, type ReactNode } from 'react'

// Small non-interactive recreations of the real screens Ming is talking
// about, built from the same visual language (gradient hero card, chat
// bubbles, seat grid, safety button row) rather than a screenshot - so
// people see what she means instead of just hearing her say it.
function VibeMatchMockup() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-3 shadow-lg shadow-purple-950/30">
      <p className="text-xs font-semibold text-white">✨ Start Mingling</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-black/20 p-2 text-center text-[10px] font-medium text-white">💬 Chat</div>
        <div className="rounded-lg bg-black/20 p-2 text-center text-[10px] font-medium text-white">🎤 Voice Chat</div>
      </div>
    </div>
  )
}

function FriendsMockup() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-col gap-1.5">
        <span className="self-start rounded-lg bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200">Hey, nice to meet you!</span>
        <span className="self-end rounded-lg bg-purple-600 px-2 py-1 text-[10px] text-white">You too! 😊</span>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-pink-950/40 py-1.5 text-[10px] font-medium text-pink-300">
        🤍 Like → 🎉 You're friends!
      </div>
    </div>
  )
}

function HangoutsMockup() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">🎙️ Your hangout</p>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-8 w-8 rounded-full ${
              i < 2 ? 'bg-purple-800 ring-2 ring-purple-400' : 'border-2 border-dashed border-zinc-700'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function SafetyMockup() {
  return (
    <div className="flex gap-1.5">
      <div className="flex-1 rounded-lg bg-purple-600 py-2 text-center text-[10px] font-medium text-white">Next</div>
      <div className="flex-1 rounded-lg border border-zinc-700 py-2 text-center text-[10px] font-medium text-zinc-300">🚫 Block</div>
      <div className="flex-1 rounded-lg border border-zinc-700 py-2 text-center text-[10px] font-medium text-zinc-300">🚩 Report</div>
    </div>
  )
}

function WelcomeMockup() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-purple-800/40 bg-gradient-to-br from-purple-950/60 to-pink-950/40 p-4 text-2xl">
      🪐 ✨ 💜 ✨ 🪐
    </div>
  )
}

function CelebrationMockup() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-purple-800/40 bg-gradient-to-br from-purple-950/60 to-pink-950/40 p-4 text-2xl">
      🎉 🥳 💜 🥳 🎉
    </div>
  )
}

type Slide = { emoji: string; text: string; mockup: ReactNode }

const SLIDES: Slide[] = [
  {
    emoji: '👋',
    text: "Hiii, I'm Ming, your Mingleverse buddy! Everything's set up. Want the super quick tour before you dive in?",
    mockup: <WelcomeMockup />,
  },
  {
    emoji: '✨',
    text: 'This is Start Mingling on your Home screen. Tap it and boom, you\'re instantly talking to someone new. Text or voice, totally your call!',
    mockup: <VibeMatchMockup />,
  },
  {
    emoji: '💜',
    text: "Vibing with someone? Tap Like at the end of your chat. If they like you back too, you're friends! No searching for them again, ever.",
    mockup: <FriendsMockup />,
  },
  {
    emoji: '🏠',
    text: 'Friends can hang out in your own private room. Chat, play music, watch stuff together. Just you and your people, nobody else invited.',
    mockup: <HangoutsMockup />,
  },
  {
    emoji: '🛡️',
    text: "You're always in control. Next, Block, and Report are always on screen, one tap away. That's not optional, that's a promise.",
    mockup: <SafetyMockup />,
  },
  {
    emoji: '🎉',
    text: "That's it, you're officially a Mingler! Go say hi to someone new. I'll be cheering for you the whole way. Let's go!",
    mockup: <CelebrationMockup />,
  },
]

// The tutorial is narrated by a mascot who tours you around the app - each
// slide pairs Ming's commentary with a small recreation of the actual
// screen she's talking about, instead of just her and a dialogue bubble.
export function TutorialStep({ onFinish, busy }: { onFinish: () => void; busy: boolean }) {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  return (
    <div className="page-enter mx-auto flex h-svh w-full max-w-sm flex-col justify-center gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div key={index} className="page-enter">
        {slide.mockup}
      </div>

      <div className="flex items-end gap-3">
        <div className="relative shrink-0">
          <div className="absolute bottom-1 h-4 w-16 rounded-full bg-purple-600/25 blur-lg" />
          <img src="/mascot-guide.png" alt="Ming" className="relative h-28 w-auto object-contain drop-shadow-[0_6px_12px_rgba(147,51,234,0.35)]" />
          <span className="absolute -right-1 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-base shadow-lg ring-2 ring-purple-500/40">
            {slide.emoji}
          </span>
        </div>
        <div key={`bubble-${index}`} className="page-enter relative flex-1 rounded-2xl border border-purple-800/40 bg-zinc-900/80 p-3">
          <span className="absolute -left-1.5 bottom-4 h-3 w-3 rotate-45 border-b border-l border-purple-800/40 bg-zinc-900" />
          <p className="text-xs font-medium leading-relaxed text-zinc-100">{slide.text}</p>
        </div>
      </div>

      <div className="flex justify-center gap-1.5">
        {SLIDES.map((_, i) => (
          <div key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-purple-400' : 'bg-zinc-700'}`} />
        ))}
      </div>

      <button
        onClick={() => (isLast ? onFinish() : setIndex((i) => i + 1))}
        disabled={busy}
        className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? 'Getting things ready…' : isLast ? "Let's go! 🚀" : 'Next'}
      </button>
      {!isLast && (
        <button onClick={onFinish} disabled={busy} className="-mt-2 text-center text-xs text-zinc-500 hover:text-zinc-300">
          Skip the tour
        </button>
      )}
    </div>
  )
}
