import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { INTEREST_OPTIONS, MAX_INTERESTS, PERSONALITY_OPTIONS, MAX_PERSONALITY, type PromptAnswer } from '../../lib/tags'
import { AvatarStep } from './AvatarStep'
import { BioStep } from './BioStep'
import { ChipPickerStep } from './ChipPickerStep'
import { PromptsStep } from './PromptsStep'
import { TutorialStep } from './TutorialStep'

type Step = 'avatar' | 'bio' | 'interests' | 'personality' | 'prompts' | 'tutorial'

export function OnboardingFlow() {
  const session = useAuthStore((s) => s.session)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [step, setStep] = useState<Step>('avatar')
  const [bio, setBio] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [personality, setPersonality] = useState<string[]>([])
  const [promptAnswers, setPromptAnswers] = useState<PromptAnswer[]>([])
  const [finishing, setFinishing] = useState(false)

  // Bio/interests/personality/prompts are collected in local state across
  // steps and written in one update when the tour finishes, rather than a
  // round trip per step - the avatar step is the exception since it
  // already goes through equip()/buy_cosmetic() regardless.
  async function finish() {
    setFinishing(true)
    await supabase
      .from('profiles')
      .update({
        bio: bio.trim() || null,
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
    return <AvatarStep onNext={() => setStep('bio')} />
  }
  if (step === 'bio') {
    return (
      <BioStep
        initial={bio}
        onNext={(v) => {
          setBio(v)
          setStep('interests')
        }}
        onSkip={() => setStep('interests')}
      />
    )
  }
  if (step === 'interests') {
    return (
      <ChipPickerStep
        step={3}
        title="What are you into? 🎮"
        subtitle="Pick your interests, helps people find common ground with you"
        options={INTEREST_OPTIONS}
        required={MAX_INTERESTS}
        initial={interests}
        onNext={(v) => {
          setInterests(v)
          setStep('personality')
        }}
      />
    )
  }
  if (step === 'personality') {
    return (
      <ChipPickerStep
        step={4}
        title="What's your vibe? ✨"
        subtitle="Pick 3 that sound like you"
        options={PERSONALITY_OPTIONS}
        required={MAX_PERSONALITY}
        initial={personality}
        onNext={(v) => {
          setPersonality(v)
          setStep('prompts')
        }}
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
