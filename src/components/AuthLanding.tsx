import { Logo } from './Logo'
import { AuthScene } from './AuthScene'
import { OAuthRow } from './OAuthRow'

export function AuthLanding({ onPick }: { onPick: (mode: 'signup' | 'login') => void }) {
  return (
    <div className="relative flex min-h-svh flex-col justify-end overflow-hidden">
      <AuthScene />

      <div className="relative z-10 flex flex-col items-center gap-1 px-6 pb-8 pt-24 text-center">
        <Logo size={72} />
        <h1 className="mt-2 text-3xl font-bold text-white">Mingle</h1>
        <p className="text-sm text-zinc-300">Meet. Chat. Play. Belong.</p>
      </div>

      <div className="relative z-10 flex flex-col gap-4 px-6 pb-10">
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
