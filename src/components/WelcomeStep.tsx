// Shown once, right after a brand-new sign-in and before Claim Username -
// the very first thing a new account sees, so it's Ming (already the
// friendly face of onboarding elsewhere) instead of jumping straight into
// a form.
export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="page-enter mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="relative">
        <div className="absolute bottom-2 left-1/2 h-6 w-28 -translate-x-1/2 rounded-full bg-purple-600/25 blur-xl" />
        <img
          src="/mascot-guide.png"
          alt="Ming"
          className="relative h-48 w-auto object-contain drop-shadow-[0_8px_16px_rgba(147,51,234,0.35)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white">Welcome to Mingleverse! 💜</h1>
        <p className="text-sm text-zinc-400">Let's get you started</p>
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98]"
      >
        Next
      </button>
    </div>
  )
}
