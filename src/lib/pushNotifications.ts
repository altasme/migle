import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

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
