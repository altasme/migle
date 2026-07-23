import { OAuthRow } from './OAuthRow'

export function AuthLanding({ onPick }: { onPick: (mode: 'signup' | 'login') => void }) {
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

      <div className="flex flex-col gap-4 px-6 pb-10">
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
