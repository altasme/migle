import { useState } from 'react'
import { OnboardingChrome } from './OnboardingChrome'

const BIO_MAX = 255

export function BioStep({
  initial,
  onNext,
  onSkip,
}: {
  initial: string
  onNext: (bio: string) => void
  onSkip: () => void
}) {
  const [bio, setBio] = useState(initial)

  return (
    <OnboardingChrome
      step={2}
      totalSteps={6}
      title="Tell us about yourself!"
      subtitle="A quick line people will see on your profile. Keep it fun."
      onContinue={() => onNext(bio.trim())}
      continueDisabled={bio.trim().length === 0}
      onSkip={onSkip}
    >
      <div>
        <textarea
          autoFocus
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          maxLength={BIO_MAX}
          rows={5}
          placeholder="I'm probably the friend who..."
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-zinc-600">
          {bio.length}/{BIO_MAX}
        </p>
      </div>
    </OnboardingChrome>
  )
}
