import { useState } from 'react'
import { signInWithGoogle } from '../lib/googleAuth'
import { signInWithDiscord } from '../lib/discordAuth'
import { OAuthRow } from './OAuthRow'

export function AuthLanding() {
  const [busy, setBusy] = useState<'google' | 'discord' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setError(null)
    setBusy('google')
    try {
      await signInWithGoogle()
      // Success: signInWithIdToken() already created the session, and
      // authStore's onAuthStateChange listener picks it up automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
      setBusy(null)
    }
  }

  async function handleDiscord() {
    setError(null)
    setBusy('discord')
    try {
      await signInWithDiscord()
      // Success continues via the appUrlOpen deep-link handler in App.tsx.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discord sign-in failed.')
      setBusy(null)
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

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy !== null}
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
          {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          onClick={handleDiscord}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2.5 rounded-full bg-[#5865F2] px-4 py-3 text-center font-semibold text-white shadow-lg shadow-black/30 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
            <path d="M19.5 5.4A17.6 17.6 0 0 0 15.3 4c-.2.4-.4.9-.6 1.3a16.3 16.3 0 0 0-4.9 0A9 9 0 0 0 9.2 4c-1.4.2-2.8.7-4.2 1.4C2.4 9.3 1.7 13 2 16.7a17.7 17.7 0 0 0 5.4 2.7c.4-.6.8-1.2 1.1-1.9-.6-.2-1.2-.5-1.7-.9l.4-.3c3.4 1.6 7 1.6 10.3 0l.4.3c-.5.4-1.1.7-1.7.9.3.7.7 1.3 1.1 1.9a17.6 17.6 0 0 0 5.4-2.7c.4-4.3-.7-8-2.7-11.3zM9 14.6c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2zm6 0c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2z" />
          </svg>
          {busy === 'discord' ? 'Opening Discord…' : 'Continue with Discord'}
        </button>

        <OAuthRow />

        <p className="mt-1 text-center text-[11px] text-zinc-500">
          By continuing, you agree to our{' '}
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-300">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-300">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  )
}
