import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { useNotificationStore } from '../store/notificationStore'

const TYPE_EMOJI: Record<string, string> = {
  dm: '💬',
  friend: '🎉',
  hangout: '🏠',
  promo: '✨',
}

// Real-time pushes (new message, new friend, hangout invite - migration
// 041) plus the 7-day re-engagement campaign (migration 042). Both kinds
// arrive through the same FCM token and the same tap handler below.
//
// Call once at app startup, same pattern as registerOAuthDeepLink in
// discordAuth.ts: dynamic import so the native plugin never touches the
// web bundle, no-op entirely outside the native app.
export async function registerPushNotifications(
  userId: string,
  navigate: (path: string) => void,
) {
  if (!Capacitor.isNativePlatform()) return () => {}

  const { PushNotifications } = await import('@capacitor/push-notifications')

  const permission = await PushNotifications.checkPermissions()
  if (permission.receive !== 'granted') {
    const requested = await PushNotifications.requestPermissions()
    if (requested.receive !== 'granted') return () => {}
  }

  const listeners = await Promise.all([
    PushNotifications.addListener('registration', async (token) => {
      await supabase
        .from('push_tokens')
        .upsert({ user_id: userId, token: token.value, platform: 'android' })
    }),
    PushNotifications.addListener('registrationError', (err) => {
      console.warn('push registration failed', err)
    }),
    // Android only auto-displays a system notification when the app is
    // backgrounded/killed. With the app open, FCM instead hands the
    // message to this listener and leaves showing it up to us - without
    // this, a push that arrives while the app happens to be open
    // vanishes silently (no system notification, no in-app sign either).
    // Reuses the existing toast used for gifts (see NotificationListener)
    // rather than adding a second native notification on top of a screen
    // the user is already looking at.
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const data = notification.data as Record<string, string> | undefined
      const emoji = TYPE_EMOJI[data?.type ?? ''] ?? '🔔'
      const text = notification.title
        ? notification.body
          ? `${notification.title}: ${notification.body}`
          : notification.title
        : (notification.body ?? 'New notification')
      useNotificationStore.getState().showToast({ emoji, text })
      setTimeout(() => useNotificationStore.getState().clearToast(), 4000)
    }),
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data as Record<string, string> | undefined
      if (!data) return
      if (data.type === 'dm' && data.thread_id) navigate(`/dm/${data.thread_id}`)
      else if (data.type === 'friend' && data.friend_id) navigate(`/friend/${data.friend_id}`)
      else if (data.type === 'hangout' && data.room_slug) navigate(`/r/${data.room_slug}`)
      else if (data.type === 'promo') navigate('/vibematch')
    }),
  ])

  await PushNotifications.register()

  return () => listeners.forEach((l) => l.remove())
}
