import { create } from 'zustand'

type Toast = { emoji: string; text: string }

type NotificationState = {
  hasUnreadDm: boolean
  toast: Toast | null
  markDmUnread: () => void
  clearDmUnread: () => void
  showToast: (t: Toast) => void
  clearToast: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  hasUnreadDm: false,
  toast: null,
  markDmUnread: () => set({ hasUnreadDm: true }),
  clearDmUnread: () => set({ hasUnreadDm: false }),
  showToast: (t) => set({ toast: t }),
  clearToast: () => set({ toast: null }),
}))
