import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

// Must exactly match the intent-filter in AndroidManifest.xml (scheme
// com.mingleverse.app, host auth-callback) AND be added as a Redirect URL
// in the Supabase dashboard (Authentication -> URL Configuration) - Supabase
// rejects a redirect to any URL not on that allowlist. Shared with any other
// provider using this same OAuth-redirect approach (Discord, if added later).
export const OAUTH_REDIRECT_URL = 'com.mingleverse.app://auth-callback'

// Facebook's native Android SDK doesn't hand back an ID token the way
// Google's Credential Manager does (its Limited Login OIDC token is
// effectively iOS-only), so there's no clean native path here - this opens
// the system browser for Facebook's consent screen and catches the
// redirect back in as a deep link (see registerOAuthDeepLink below).
export async function signInWithFacebook() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: OAUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  if (data.url) await Browser.open({ url: data.url })
}

// Call once at app startup. Catches the deep link an OAuth provider's
// redirect lands on, exchanges its auth code for a real session, and closes
// the in-app browser tab that was showing the consent screen.
export function registerOAuthDeepLink() {
  return import('@capacitor/app').then(({ App }) =>
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(OAUTH_REDIRECT_URL)) return
      try {
        await supabase.auth.exchangeCodeForSession(url)
      } finally {
        await Browser.close().catch(() => {})
      }
    }),
  )
}
