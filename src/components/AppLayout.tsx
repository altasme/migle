import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { NotificationListener } from './NotificationListener'
import { useNotificationStore } from '../store/notificationStore'

function GiftToast() {
  const toast = useNotificationStore((s) => s.toast)
  if (!toast) return null
  return (
    <div className="fixed left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
      <span className="text-lg">{toast.emoji}</span>
      {toast.text}
    </div>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-zinc-950">
      <NotificationListener />
      <GiftToast />
      <TopBar />
      <main className="mx-auto w-full max-w-md flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
