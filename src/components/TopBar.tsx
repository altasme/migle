import { useWallet } from '../hooks/useWallet'

export function TopBar() {
  const wallet = useWallet()

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
      <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-lg font-bold text-transparent">
        Mingle
      </span>
      {wallet && (
        <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
          <span>🪙 {wallet.coins}</span>
          <span>💎 {wallet.gems}</span>
        </div>
      )}
    </header>
  )
}
