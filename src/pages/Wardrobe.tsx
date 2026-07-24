import { useNavigate } from 'react-router-dom'

// Full editing (gender-locked look picker) is built but off for now while
// the avatar catalog settles - see AvatarStep for the onboarding version,
// which is where a look actually gets chosen today. This is a placeholder,
// not a route removal, so the "Edit avatar" link on Profile still works.
export function Wardrobe() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <div className="flex items-center gap-3">
        {/* Wardrobe is only ever reached from Profile's "Edit avatar" link,
            so navigate there directly rather than navigate(-1) - relying on
            browser history left the button doing nothing when there was no
            history entry to go back to (e.g. a fresh app resume on this
            route). */}
        <button onClick={() => navigate('/profile')} className="text-zinc-400 hover:text-white">
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-white">Wardrobe</h1>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <span className="text-4xl">🧵</span>
        <p className="text-lg font-semibold text-white">Coming soon</p>
        <p className="text-sm text-zinc-400">
          Wardrobe customization is on the way. For now, your look is set during onboarding.
        </p>
      </div>
    </div>
  )
}
