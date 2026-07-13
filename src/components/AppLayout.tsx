import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-zinc-950">
      <TopBar />
      <main className="mx-auto w-full max-w-md flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
