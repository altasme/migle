import type { ReactNode } from 'react'

// Shared shell for every step in the post-signup onboarding wizard: a
// progress bar, headline/subhead, scrollable content area, and a pinned
// footer with Continue + optional Skip. Keeping this one component means
// every step feels like part of the same flow instead of five different
// screens bolted together.
export function OnboardingChrome({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  onSkip,
  busy = false,
}: {
  step: number
  totalSteps: number
  title: string
  subtitle?: string
  children: ReactNode
  onContinue: () => void
  continueLabel?: string
  continueDisabled?: boolean
  onSkip?: () => void
  busy?: boolean
}) {
  return (
    <div className="page-enter mx-auto flex h-svh w-full max-w-sm flex-col p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mb-6 flex gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < step ? 'bg-purple-500' : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>

      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}

      <div className="mt-5 flex-1 overflow-y-auto">{children}</div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          onClick={onContinue}
          disabled={continueDisabled || busy}
          className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Saving…' : continueLabel}
        </button>
        {onSkip && (
          <button onClick={onSkip} className="text-xs text-zinc-500 hover:text-zinc-300">
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}

export function Chip({
  label,
  emoji,
  selected,
  disabled,
  onClick,
}: {
  label: string
  emoji?: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-all active:scale-95 ${
        selected
          ? 'border-purple-500 bg-purple-600 text-white shadow-md shadow-purple-950/30'
          : 'border-zinc-700 bg-zinc-900 text-zinc-300'
      } ${disabled && !selected ? 'opacity-30' : ''}`}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  )
}
