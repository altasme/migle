import { useWallet } from '../hooks/useWallet'

export function TopBar() {
  const wallet = useWallet()

  return (
    <header className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
        Mingle
      </span>
      {wallet && (
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300">
          <span className="flex items-center gap-1">
            <span>🪙</span>
            {wallet.coins}
          </span>
          <span className="h-3 w-px bg-zinc-700" />
          <span className="flex items-center gap-1">
            <span>💎</span>
            {wallet.gems}
          </span>
        </div>
      )}
    </header>
  )
}
