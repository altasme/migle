// Placeholder bench scene for the auth landing background — CSS shapes only,
// no art assets yet. Swap the <svg> below for a real illustrated background
// later; recommended canvas 1080×1920px (9:16, matches a phone screen),
// key elements (moon, skyline, bench+characters) kept in the bottom two
// thirds so they aren't hidden behind the logo/buttons on short screens.
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
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1035] via-[#2a1550] to-[#150a28]" />

      <div className="absolute right-8 top-14 h-20 w-20 rounded-full bg-amber-100/90 shadow-[0_0_60px_20px_rgba(251,191,36,0.25)]" />

      <div className="absolute inset-x-0 bottom-0 flex h-40 items-end opacity-40">
        {[38, 56, 44, 70, 50, 62, 40].map((h, i) => (
          <div
            key={i}
            className="mx-0.5 flex-1 rounded-t-sm bg-[#0d0620]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#150a28] to-transparent" />

      <div className="absolute bottom-10 left-1/2 h-2 w-40 -translate-x-1/2 rounded-full bg-black/30 blur-sm" />
      <div className="absolute bottom-9 left-1/2 h-1.5 w-44 -translate-x-1/2 rounded-full bg-[#3a2a5c]" />

      <Silhouette className="absolute bottom-9 left-1/2 h-16 w-16 -translate-x-[85%] text-[#7c5cb8]/70" />
      <Silhouette className="absolute bottom-9 left-1/2 h-16 w-16 -translate-x-[10%] text-[#c084fc]/70" />
    </div>
  )
}
