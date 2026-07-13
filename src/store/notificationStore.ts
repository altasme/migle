import { create } from 'zustand'

type Toast = { emoji: string; text: string }

type NotificationState = {
  hasUnreadDm: boolean
  toast: Toast | null
  lastClearedAt: string
  markDmUnread: () => void
  clearDmUnread: () => void
  showToast: (t: Toast) => void
  clearToast: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  hasUnreadDm: false,
  toast: null,
  // Anything before "now" (app start) is never flagged as unread.
  lastClearedAt: new Date().toISOString(),
  markDmUnread: () => set({ hasUnreadDm: true }),
  clearDmUnread: () => set({ hasUnreadDm: false, lastClearedAt: new Date().toISOString() }),
  showToast: (t) => set({ toast: t }),
  clearToast: () => set({ toast: null }),
}))
