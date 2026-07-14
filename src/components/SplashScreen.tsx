import { Logo } from './Logo'

export function SplashScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1a1035] via-[#2a1550] to-[#150a28]">
      <Logo size={112} className="animate-pulse" />
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-3xl font-bold text-white">Mingle</h1>
        <p className="text-sm text-zinc-400">Meet. Chat. Play. Belong.</p>
      </div>
    </div>
  )
}
