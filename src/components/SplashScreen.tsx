export function SplashScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1a1035] via-[#2a1550] to-[#150a28]">
      <img src="/logo.png" alt="Mingleverse" className="h-56 w-56 animate-pulse" />
      <p className="text-sm text-zinc-400">Meet. Chat. Play. Belong.</p>
    </div>
  )
}
