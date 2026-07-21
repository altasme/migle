// Small ambient decorations layered over the static artwork. Positions are
// eyeballed against open-sky areas of splash.jpg (upper starfield band, the
// gap between the two floating islands, and the space around the
// characters) - nudge these percentages if a device shows one landing on
// the logo, the islands, or a character's face.
const STARS = [
  { top: '6%', left: '12%', delay: '0s', size: 'text-xs' },
  { top: '10%', left: '55%', delay: '0.6s', size: 'text-sm' },
  { top: '16%', left: '38%', delay: '1.2s', size: 'text-xs' },
  { top: '9%', left: '82%', delay: '1.8s', size: 'text-sm' },
  { top: '19%', left: '68%', delay: '0.9s', size: 'text-xs' },
]

const HEARTS = [
  { left: '10%', delay: '0s' },
  { left: '50%', delay: '2s' },
  { left: '90%', delay: '4s' },
]

export function SplashScreen() {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#0d0620]">
      <img
        src="/splash.jpg"
        alt="Mingleverse — Meet. Chat. Be Friends."
        className="splash-fade-in h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0">
        {STARS.map((s, i) => (
          <span
            key={i}
            className={`twinkle absolute ${s.size} text-white/90`}
            style={{ top: s.top, left: s.left, animationDelay: s.delay }}
          >
            ✨
          </span>
        ))}

        <span
          className="slow-spin absolute right-[10%] top-[23%] text-xl opacity-70"
        >
          🪐
        </span>

        <span className="drift-cloud absolute left-[8%] top-[36%] text-3xl text-white/15 blur-[1px]">
          ☁️
        </span>
        <span
          className="drift-cloud absolute right-[12%] top-[41%] text-2xl text-white/10 blur-[1px]"
          style={{ animationDelay: '5s' }}
        >
          ☁️
        </span>

        {HEARTS.map((h, i) => (
          <span
            key={i}
            className="drift-heart absolute bottom-[36%] text-lg"
            style={{ left: h.left, animationDelay: h.delay }}
          >
            💜
          </span>
        ))}
      </div>
    </div>
  )
}
