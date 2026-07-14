// Placeholder bench scene for the auth landing background — CSS shapes only,
// no art assets yet. Renders inside a fixed-height middle region between the
// logo and the button panel (see AuthLanding), so it always has guaranteed
// clearance and can never end up hidden behind either. Swap for a real
// illustrated background later; recommended canvas 1080×720px, since it now
// only needs to cover the middle strip, not the full 9:16 screen.
function Silhouette({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 80" className={className} aria-hidden="true">
      <circle cx="30" cy="18" r="14" fill="currentColor" />
      <path d="M8 80V56c0-13 10-22 22-22s22 9 22 22v24H8z" fill="currentColor" />
    </svg>
  )
}

export function AuthScene() {
  return (
    <div className="absolute inset-0">
      <div className="absolute right-6 top-4 h-14 w-14 rounded-full bg-amber-100/90 shadow-[0_0_32px_10px_rgba(251,191,36,0.2)]" />

      <div className="absolute inset-x-0 bottom-0 flex h-24 items-end opacity-40">
        {[38, 56, 44, 70, 50, 62, 40].map((h, i) => (
          <div
            key={i}
            className="mx-0.5 flex-1 rounded-t-sm bg-[#0d0620]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <div className="absolute bottom-6 left-1/2 h-2 w-32 -translate-x-1/2 rounded-full bg-black/30 blur-sm" />
      <div className="absolute bottom-5 left-1/2 h-1.5 w-36 -translate-x-1/2 rounded-full bg-[#3a2a5c]" />

      <Silhouette className="absolute bottom-5 left-1/2 h-14 w-14 -translate-x-[80%] text-[#7c5cb8]/70" />
      <Silhouette className="absolute bottom-5 left-1/2 h-14 w-14 -translate-x-[15%] text-[#c084fc]/70" />
    </div>
  )
}
