import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { INTEREST_OPTIONS, MAX_INTERESTS, PERSONALITY_OPTIONS, MAX_PERSONALITY, type PromptAnswer } from '../../lib/tags'
import { AvatarStep } from './AvatarStep'
import { ChipPickerStep } from './ChipPickerStep'
import { PromptsStep } from './PromptsStep'
import { TutorialStep } from './TutorialStep'

type Step = 'avatar' | 'interests' | 'personality' | 'prompts' | 'tutorial'

export function OnboardingFlow() {
  const session = useAuthStore((s) => s.session)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [step, setStep] = useState<Step>('avatar')
  const [interests, setInterests] = useState<string[]>([])
  const [personality, setPersonality] = useState<string[]>([])
  const [promptAnswers, setPromptAnswers] = useState<PromptAnswer[]>([])
  const [finishing, setFinishing] = useState(false)

  // Interests/personality/prompts are collected in local state across
  // steps and written in one update when the tour finishes, rather than a
  // round trip per step - the avatar step is the exception since it
  // already goes through equip()/buy_cosmetic() regardless.
  async function finish() {
    setFinishing(true)
    await supabase
      .from('profiles')
      .update({
        interests,
        personality_traits: personality,
        prompt_answers: promptAnswers,
        onboarded: true,
      })
      .eq('id', session!.user.id)
    await refreshProfile()
    setFinishing(false)
  }

  if (step === 'avatar') {
    return <AvatarStep onNext={() => setStep('interests')} />
  }
  if (step === 'interests') {
    return (
      <ChipPickerStep
        step={2}
        title="What are you into? 🎮"
        subtitle="Pick a few — helps people find common ground with you"
        options={INTEREST_OPTIONS}
        max={MAX_INTERESTS}
        initial={interests}
        onNext={(v) => {
          setInterests(v)
          setStep('personality')
        }}
        onSkip={() => setStep('personality')}
      />
    )
  }
  if (step === 'personality') {
    return (
      <ChipPickerStep
        step={3}
        title="What's your vibe? ✨"
        subtitle="Pick up to 3 that sound like you"
        options={PERSONALITY_OPTIONS}
        max={MAX_PERSONALITY}
        initial={personality}
        onNext={(v) => {
          setPersonality(v)
          setStep('prompts')
        }}
        onSkip={() => setStep('prompts')}
      />
    )
  }
  if (step === 'prompts') {
    return (
      <PromptsStep
        initial={promptAnswers}
        onNext={(v) => {
          setPromptAnswers(v)
          setStep('tutorial')
        }}
        onSkip={() => setStep('tutorial')}
      />
    )
  }
  return <TutorialStep onFinish={finish} busy={finishing} />
}
