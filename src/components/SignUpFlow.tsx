import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Step = 'email' | 'password' | 'confirm' | 'sent'

const STEP_INDEX: Record<Step, number> = { email: 1, password: 2, confirm: 3, sent: 4 }

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// Sign Up is a short wizard (email -> password -> confirm password -> "we
// sent you a link") rather than one form with three fields stacked - easier
// to get right one thing at a time on a phone, and it's where the
// "verification email sent" screen naturally lands as its own step.
export function SignUpFlow({ onBack, onSwitchToLogin }: { onBack: () => void; onSwitchToLogin: () => void }) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resent, setResent] = useState(false)

  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    setStep('password')
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError(null)
    setStep('confirm')
  }

  async function handleConfirmSubmit(e: FormEvent) {
    e.preventDefault()
    if (confirm !== password) {
      setError("Passwords don't match.")
      return
    }
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setStep('sent')
  }

  async function handleResend() {
    setSubmitting(true)
    setError(null)
    setResent(false)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setSubmitting(false)
    if (error) setError(error.message)
    else setResent(true)
  }

  function backStep() {
    setError(null)
    if (step === 'password') setStep('email')
    else if (step === 'confirm') setStep('password')
    else onBack()
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      <button type="button" onClick={backStep} className="self-start text-sm text-zinc-400 hover:text-white">
        ← Back
      </button>

      {step !== 'sent' && (
        <div className="mb-1 flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= STEP_INDEX[step] ? 'bg-purple-500' : 'bg-zinc-800'}`}
            />
          ))}
        </div>
      )}

      {step === 'email' && (
        <>
          <h1 className="text-2xl font-semibold text-white">What's your email?</h1>
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" className="rounded-lg bg-purple-600 px-3 py-2 font-medium text-white">
              Continue
            </button>
          </form>
        </>
      )}

      {step === 'password' && (
        <>
          <h1 className="text-2xl font-semibold text-white">Create a password</h1>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              required
              autoFocus
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" className="rounded-lg bg-purple-600 px-3 py-2 font-medium text-white">
              Continue
            </button>
          </form>
        </>
      )}

      {step === 'confirm' && (
        <>
          <h1 className="text-2xl font-semibold text-white">Confirm your password</h1>
          <form onSubmit={handleConfirmSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              required
              autoFocus
              minLength={6}
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-purple-600 px-3 py-2 font-medium text-white disabled:opacity-50"
            >
              {submitting ? 'Creating account…' : 'Sign up'}
            </button>
          </form>
        </>
      )}

      {step === 'sent' && (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">📧</span>
          <h1 className="text-xl font-semibold text-white">Verify your email</h1>
          <p className="text-sm text-zinc-400">
            We sent a verification email to <span className="text-white">{email}</span>. Tap the link inside to
            activate your account, then log in.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {resent && <p className="text-sm text-emerald-400">Verification email resent.</p>}
          <button
            type="button"
            onClick={handleResend}
            disabled={submitting}
            className="text-sm text-purple-400 hover:underline disabled:opacity-50"
          >
            {submitting ? 'Sending…' : "Didn't get it? Resend"}
          </button>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="mt-2 w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white"
          >
            Back to Log In
          </button>
        </div>
      )}

      {step !== 'sent' && (
        <button type="button" onClick={onSwitchToLogin} className="text-sm text-zinc-400 hover:text-white">
          Already have an account? Log in
        </button>
      )}
    </div>
  )
}
