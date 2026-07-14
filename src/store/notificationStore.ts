import { create } from 'zustand'

type Toast = { emoji: string; text: string }

// Anything before "now" (app start) is never counted as unread.
const APP_START = new Date().toISOString()

type NotificationState = {
  unreadCounts: Record<string, number>
  lastReadAt: Record<string, string>
  toast: Toast | null
  setThreadCounts: (counts: Record<string, number>) => void
  incrementThreadUnread: (threadId: string) => void
  clearThreadUnread: (threadId: string) => void
  lastReadFor: (threadId: string) => string
  showToast: (t: Toast) => void
  clearToast: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCounts: {},
  lastReadAt: {},
  toast: null,
  // Merges freshly-computed counts in (from a poll or initial load) —
  // overwrites known threads, doesn't touch threads outside the batch.
  setThreadCounts: (counts) =>
    set((s) => ({ unreadCounts: { ...s.unreadCounts, ...counts } })),
  incrementThreadUnread: (threadId) =>
    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [threadId]: (s.unreadCounts[threadId] ?? 0) + 1 },
    })),
  clearThreadUnread: (threadId) =>
    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [threadId]: 0 },
      lastReadAt: { ...s.lastReadAt, [threadId]: new Date().toISOString() },
    })),
  lastReadFor: (threadId) => get().lastReadAt[threadId] ?? APP_START,
  showToast: (t) => set({ toast: t }),
  clearToast: () => set({ toast: null }),
}))
