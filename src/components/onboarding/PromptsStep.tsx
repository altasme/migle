import { useState } from 'react'
import { PROMPT_OPTIONS, PROMPT_COUNT, PROMPT_ANSWER_MAX, type PromptAnswer } from '../../lib/tags'
import { OnboardingChrome } from './OnboardingChrome'

// Instead of a blank "write your bio" box, pick 3 prompt cards and answer
// each in a sentence - much lower effort to fill out, and far more
// readable on someone else's profile than a wall of free text.
export function PromptsStep({
  initial,
  onNext,
  onSkip,
}: {
  initial: PromptAnswer[]
  onNext: (answers: PromptAnswer[]) => void
  onSkip: () => void
}) {
  const [chosen, setChosen] = useState<string[]>(initial.map((p) => p.question))
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((p) => [p.question, p.answer])),
  )

  function toggleQuestion(q: string) {
    setChosen((prev) =>
      prev.includes(q) ? prev.filter((v) => v !== q) : prev.length < PROMPT_COUNT ? [...prev, q] : prev,
    )
  }

  const allAnswered = chosen.length === PROMPT_COUNT && chosen.every((q) => (answers[q] ?? '').trim().length > 0)

  function handleContinue() {
    onNext(chosen.map((q) => ({ question: q, answer: (answers[q] ?? '').trim() })))
  }

  return (
    <OnboardingChrome
      step={5}
      totalSteps={6}
      title="Answer 3 question cards 💭"
      subtitle={`Pick ${PROMPT_COUNT} and answer in a sentence. (${chosen.length}/${PROMPT_COUNT})`}
      onContinue={handleContinue}
      continueDisabled={!allAnswered}
      onSkip={onSkip}
    >
      <div className="flex flex-col gap-2">
        {PROMPT_OPTIONS.map((q) => {
          const isChosen = chosen.includes(q)
          return (
            <div
              key={q}
              className={`rounded-xl border p-3 transition-colors ${
                isChosen ? 'border-purple-500 bg-purple-950/30' : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <button
                onClick={() => toggleQuestion(q)}
                disabled={!isChosen && chosen.length >= PROMPT_COUNT}
                className="flex w-full items-center justify-between text-left disabled:opacity-30"
              >
                <span className="text-sm font-medium text-white">{q}</span>
                <span className={`text-lg ${isChosen ? 'text-purple-400' : 'text-zinc-600'}`}>
                  {isChosen ? '✓' : '+'}
                </span>
              </button>
              {isChosen && (
                <div className="mt-2">
                  <input
                    type="text"
                    autoFocus
                    maxLength={PROMPT_ANSWER_MAX}
                    value={answers[q] ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                    placeholder="Your answer…"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </OnboardingChrome>
  )
}
