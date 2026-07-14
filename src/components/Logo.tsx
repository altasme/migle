// Placeholder logo mark: a rounded "M" with a heart-speech-bubble accent.
// Swap for real art later — recommended canvas: 512×512px PNG, transparent
// background, mark centered with ~15% padding so it crops cleanly at small
// sizes (favicon, splash, app icon).
export function Logo({ size = 96, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Mingle"
    >
      <defs>
        <linearGradient id="mingle-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="26" fill="url(#mingle-logo-grad)" />
      <path
        d="M27 68V34.5c0-1.9 2.2-3 3.7-1.8L50 48l19.3-15.3c1.5-1.2 3.7-.1 3.7 1.8V68"
        fill="none"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="78" cy="22" r="14" fill="#f472b6" />
      <path
        d="M78 30c-4.4 0-8-3.1-8-7 0-3.5 3.1-6 6.6-6 1 0 1.9.3 2.7.8.8-.5 1.7-.8 2.7-.8 3.5 0 6.6 2.5 6.6 6 0 3.9-3.6 7-8 7z"
        fill="#fff"
        opacity="0.95"
      />
    </svg>
  )
}
