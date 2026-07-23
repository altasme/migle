import { useState } from 'react'
import { emojiFor } from '../../lib/tags'
import { OnboardingChrome, Chip } from './OnboardingChrome'

// Shared shape for Interests and Personality - both are "pick exactly N
// from a fixed list of chips," just with different copy and a different N.
export function ChipPickerStep({
  step,
  title,
  subtitle,
  options,
  required,
  initial,
  onNext,
}: {
  step: number
  title: string
  subtitle: string
  options: string[]
  required: number
  initial: string[]
  onNext: (selected: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(initial)

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : prev.length < required ? [...prev, value] : prev,
    )
  }

  return (
    <OnboardingChrome
      step={step}
      totalSteps={6}
      title={title}
      subtitle={`${subtitle} (${selected.length}/${required})`}
      onContinue={() => onNext(selected)}
      continueDisabled={selected.length !== required}
    >
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            emoji={emojiFor(opt)}
            selected={selected.includes(opt)}
            disabled={selected.length >= required}
            onClick={() => toggle(opt)}
          />
        ))}
      </div>
    </OnboardingChrome>
  )
}
