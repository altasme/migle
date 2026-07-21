import { useState } from 'react'
import { emojiFor } from '../../lib/tags'
import { OnboardingChrome, Chip } from './OnboardingChrome'

// Shared shape for Interests and Personality - both are "pick up to N from
// a fixed list of chips," just with different copy and a different cap.
export function ChipPickerStep({
  step,
  title,
  subtitle,
  options,
  max,
  initial,
  onNext,
  onSkip,
}: {
  step: number
  title: string
  subtitle: string
  options: string[]
  max: number
  initial: string[]
  onNext: (selected: string[]) => void
  onSkip: () => void
}) {
  const [selected, setSelected] = useState<string[]>(initial)

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : prev.length < max ? [...prev, value] : prev,
    )
  }

  return (
    <OnboardingChrome
      step={step}
      totalSteps={5}
      title={title}
      subtitle={`${subtitle} (${selected.length}/${max})`}
      onContinue={() => onNext(selected)}
      continueDisabled={selected.length === 0}
      onSkip={onSkip}
    >
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            emoji={emojiFor(opt)}
            selected={selected.includes(opt)}
            disabled={selected.length >= max}
            onClick={() => toggle(opt)}
          />
        ))}
      </div>
    </OnboardingChrome>
  )
}
