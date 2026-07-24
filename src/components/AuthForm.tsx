import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function AuthForm({ onBack, onSwitchToSignup }: { onBack?: () => void; onSwitchToSignup: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSubmitting(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      {onBack && (
        <button type="button" onClick={onBack} className="self-start text-sm text-zinc-400 hover:text-white">
          ← Back
        </button>
      )}
      <h1 className="text-2xl font-semibold text-white">Log in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-purple-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : 'Log in'}
        </button>
      </form>

      <button type="button" onClick={onSwitchToSignup} className="text-sm text-zinc-400 hover:text-white">
        Don't have an account? Sign up
      </button>
    </div>
  )
}
