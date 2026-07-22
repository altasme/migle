import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

function eighteenYearsAgo() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
}

export function UsernameClaim() {
  const session = useAuthStore((s) => s.session)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const signOut = useAuthStore((s) => s.signOut)

  const [username, setUsername] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (username.length < 3 || username.length > 16) {
      setError('Username must be 3–16 characters.')
      return
    }
    if (!birthdate || birthdate > eighteenYearsAgo()) {
      setError('You must be 18 or older to use Mingleverse.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('profiles').insert({
      id: session!.user.id,
      username,
      birthdate,
    })

    if (error) {
      if (error.code === '23505') {
        setError('That username is taken.')
      } else if (error.message.includes('adults_only')) {
        setError('You must be 18 or older to use Mingleverse.')
      } else if (error.message.includes('username')) {
        setError('Username must be 3–16 characters.')
      } else {
        setError(error.message)
      }
      setSubmitting(false)
      return
    }

    await refreshProfile()
    setSubmitting(false)
    // The insert above succeeded, so a profile row now genuinely exists -
    // if the store still doesn't have it, refreshProfile's own fetch
    // failed (e.g. a schema mismatch) and silently staying on this screen
    // forever is exactly the "nothing happens" trap that already bit
    // real users once. Say so instead of pretending nothing went wrong.
    if (!useAuthStore.getState().profile) {
      setError("Your account was created, but something went wrong loading it. Please try again in a moment.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold text-white">Claim your username</h1>
      <p className="text-sm text-zinc-400">{session?.user.email}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          required
          minLength={3}
          maxLength={16}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
        />
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Birthdate
          <input
            type="date"
            required
            max={eighteenYearsAgo()}
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-purple-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </form>

      <button type="button" onClick={signOut} className="text-sm text-zinc-400 hover:text-white">
        Log out
      </button>
    </div>
  )
}
