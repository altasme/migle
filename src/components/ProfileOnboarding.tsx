import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { INTEREST_OPTIONS, LOOKING_FOR_OPTIONS } from '../lib/tags'

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        selected
          ? 'border-purple-500 bg-purple-600 text-white'
          : 'border-zinc-700 bg-zinc-900 text-zinc-300'
      }`}
    >
      {label}
    </button>
  )
}

export function ProfileOnboarding() {
  const session = useAuthStore((s) => s.session)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const [step, setStep] = useState<'interests' | 'lookingFor'>('interests')
  const [interests, setInterests] = useState<string[]>([])
  const [lookingFor, setLookingFor] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function finish() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ interests, looking_for: lookingFor, onboarded: true })
      .eq('id', session!.user.id)
    await refreshProfile()
    setSaving(false)
  }

  if (step === 'interests') {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold text-white">What are you into?</h1>
        <p className="text-sm text-zinc-400">Pick a few. It helps people find common ground with you.</p>

        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={interests.includes(opt)}
              onClick={() => toggle(interests, setInterests, opt)}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('lookingFor')}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => setStep('lookingFor')}
            className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      <button
        type="button"
        onClick={() => setStep('interests')}
        className="self-start text-sm text-zinc-400 hover:text-white"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-semibold text-white">What are you looking for?</h1>
      <p className="text-sm text-zinc-400">Pick as many as apply.</p>

      <div className="flex flex-wrap gap-2">
        {LOOKING_FOR_OPTIONS.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={lookingFor.includes(opt)}
            onClick={() => toggle(lookingFor, setLookingFor, opt)}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={finish} disabled={saving} className="text-sm text-zinc-400 hover:text-white">
          Skip
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={saving}
          className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Done'}
        </button>
      </div>
    </div>
  )
}
