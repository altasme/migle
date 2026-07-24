import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

// Must exactly match the intent-filter in AndroidManifest.xml (scheme
// com.mingleverse.app, host auth-callback) AND be added as a Redirect URL
// in the Supabase dashboard (Authentication -> URL Configuration) - Supabase
// rejects a redirect to any URL not on that allowlist.
export const GOOGLE_REDIRECT_URL = 'com.mingleverse.app://auth-callback'

// Google blocks its OAuth consent screen from loading inside an embedded
// WebView ("disallowed_useragent"), so this can't just navigate the app's
// own WebView to the auth URL like a normal web app would. Instead it opens
// the system browser via skipBrowserRedirect, and the app listens for the
// redirect back in as a deep link (see registerGoogleAuthDeepLink below).
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: GOOGLE_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  if (data.url) await Browser.open({ url: data.url })
}

// Call once at app startup. Catches the deep link Google's redirect lands
// on, exchanges its auth code for a real session, and closes the in-app
// browser tab that was showing the consent screen.
export function registerGoogleAuthDeepLink() {
  return import('@capacitor/app').then(({ App }) =>
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(GOOGLE_REDIRECT_URL)) return
      try {
        await supabase.auth.exchangeCodeForSession(url)
      } finally {
        await Browser.close().catch(() => {})
      }
    }),
  )
}
