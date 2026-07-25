import { useState } from 'react'
import { signInWithGoogle } from '../lib/googleAuth'
import { OAuthRow } from './OAuthRow'

export function AuthLanding({ onPick }: { onPick: (mode: 'signup' | 'login') => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      // Success: signInWithIdToken() already created the session, and
      // authStore's onAuthStateChange listener picks it up automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col overflow-hidden bg-gradient-to-b from-[#1a1035] via-[#2a1550] to-[#150a28]">
      <div className="flex flex-col items-center gap-1 px-6 pt-10 text-center">
        {/* Wide wordmark with the tagline baked in - sized by width, not
            square. Tagline text lives in the art now, no separate <p>. */}
        <img src="/logo.png" alt="Mingleverse: A universe where strangers become friends." className="w-[22rem]" />
      </div>

      <div className="relative min-h-[140px] flex-1">
        <img
          src="/auth-scene.png"
          alt=""
          className="absolute inset-0 h-full w-full origin-bottom scale-125 object-contain object-bottom"
        />
      </div>

      <div className="flex flex-col gap-3 px-6 pb-10">
        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        {/* Google is the primary, lead sign-up path - full-width button up
            top rather than a small icon buried below the email options. */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex items-center justify-center gap-2.5 rounded-full bg-white px-4 py-3 text-center font-semibold text-zinc-900 shadow-lg shadow-black/30 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.68-.06-1.32-.17-1.94H12v3.9h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.49z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.6-4.11H3.05v2.58A10 10 0 0 0 12 22z"
            />
            <path fill="#FBBC05" d="M6.4 13.92a5.99 5.99 0 0 1 0-3.84V7.5H3.05a10 10 0 0 0 0 9l3.35-2.58z" />
            <path
              fill="#EA4335"
              d="M12 5.98c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.96 9.96 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.35 2.58c.8-2.36 3-4.1 5.6-4.1z"
            />
          </svg>
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-zinc-500">or use email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={() => onPick('signup')}
          className="rounded-full bg-purple-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-purple-900/40"
        >
          Create Account
        </button>
        <button
          type="button"
          onClick={() => onPick('login')}
          className="rounded-full bg-white/10 px-4 py-3 text-center font-semibold text-white backdrop-blur-sm"
        >
          Log In
        </button>

        <OAuthRow />
      </div>
    </div>
  )
}
