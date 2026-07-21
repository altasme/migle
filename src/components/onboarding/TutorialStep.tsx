import { useState } from 'react'

type Slide = { text: string; emoji: string }

const SLIDES: Slide[] = [
  {
    emoji: '👋',
    text: "Hiii, I'm Ming — your Mingleverse buddy! Everything's set up. Want the super-quick tour before you dive in?",
  },
  {
    emoji: '✨',
    text: 'See that ✨ Start Mingling ✨ card on Home? Tap it and BOOM — you\'re instantly talking to someone new. Text or voice, totally your call!',
  },
  {
    emoji: '💜',
    text: "Vibing with someone? Tap Like at the end of your chat. If they like you back too... you're friends! No searching for them again, ever.",
  },
  {
    emoji: '🏠',
    text: 'Friends can hang out in your own private room — chat, play music, watch stuff together. Just you and your people, nobody else invited.',
  },
  {
    emoji: '🛡️',
    text: "You're always in control. Next, Block, and Report are ALWAYS on screen, one tap away. That's not optional — that's a promise.",
  },
  {
    emoji: '🎉',
    text: "That's it, you're officially a Mingler! Go say hi to someone new. I'll be cheering for you the whole way. Let's go!",
  },
]

// The tutorial is narrated by a mascot instead of a wall of onboarding
// copy - a lifted crop of the existing chibi art (public/mascot-guide.png,
// from auth-scene.png) rather than new artwork, kept consistent with the
// rest of the app's illustrated style.
export function TutorialStep({ onFinish, busy }: { onFinish: () => void; busy: boolean }) {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  return (
    <div className="page-enter mx-auto flex h-svh w-full max-w-sm flex-col items-center justify-center gap-6 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-purple-600/30 to-pink-600/30 blur-xl" />
        <div className="relative h-40 w-40 overflow-hidden rounded-full ring-4 ring-purple-500/40">
          <img src="/mascot-guide.png" alt="Ming" className="h-full w-full object-cover" />
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-2xl ring-2 ring-zinc-950">
          {slide.emoji}
        </span>
      </div>

      <div key={index} className="page-enter relative w-full rounded-2xl border border-purple-800/40 bg-zinc-900/80 p-4">
        <span className="absolute -top-2 left-8 h-4 w-4 rotate-45 border-l border-t border-purple-800/40 bg-zinc-900" />
        <p className="text-sm font-medium leading-relaxed text-zinc-100">{slide.text}</p>
      </div>

      <div className="flex gap-1.5">
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
        <button onClick={onFinish} disabled={busy} className="text-xs text-zinc-500 hover:text-zinc-300">
          Skip the tour
        </button>
      )}
    </div>
  )
}
