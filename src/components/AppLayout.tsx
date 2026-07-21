import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { NotificationListener } from './NotificationListener'
import { PresenceHeartbeat } from './PresenceHeartbeat'
import { useNotificationStore } from '../store/notificationStore'

function GiftToast() {
  const toast = useNotificationStore((s) => s.toast)
  if (!toast) return null
  return (
    <div className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
      <span className="text-lg">{toast.emoji}</span>
      {toast.text}
    </div>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  // Keying the content on the route re-runs the enter animation on every
  // tab switch - a subtle fade/rise that makes navigation feel responsive
  // instead of pages just swapping in place.
  const location = useLocation()
  return (
    <div className="flex min-h-svh flex-col bg-zinc-950">
      <NotificationListener />
      <PresenceHeartbeat />
      <GiftToast />
      <TopBar />
      <main key={location.pathname} className="page-enter mx-auto w-full max-w-md flex-1 overflow-y-auto pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
