import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

// Must exactly match the intent-filter in AndroidManifest.xml (scheme
// com.mingleverse.app, host auth-callback) AND be added as a Redirect URL
// in the Supabase dashboard (Authentication -> URL Configuration) - Supabase
// rejects a redirect to any URL not on that allowlist. Shared with any other
// provider using this same OAuth-redirect approach.
export const OAUTH_REDIRECT_URL = 'com.mingleverse.app://auth-callback'

// Discord (like Facebook) has no native Android SDK that hands Supabase a
// usable token the way Google's Credential Manager does, so this opens the
// system browser for Discord's consent screen and catches the redirect
// back in as a deep link (see registerOAuthDeepLink below). Chosen over
// Facebook: Discord's OAuth app just needs a Client ID/Secret from their
// developer portal, no business verification or app review required for
// basic login scopes.
//
// The deep-link callback only exists inside the installed native app -
// there's no app registered for a custom com.mingleverse.app:// scheme in
// a plain desktop/mobile browser tab, so testing this in a browser would
// otherwise open Discord's page and then hang forever waiting for a
// redirect that can never arrive. On web, skip the native dance entirely
// and let Supabase do an ordinary full-page redirect back to this same
// origin instead - supabase.ts's detectSessionInUrl picks the session up
// from the URL when Discord sends the browser back.
export async function signInWithDiscord() {
  if (!Capacitor.isNativePlatform()) {
    // Explicit redirectTo instead of relying on Supabase's dashboard
    // "Site URL" default - that's easy to leave pointed at a placeholder
    // (e.g. localhost) and get silently redirected somewhere broken after
    // login succeeds. Always come back to wherever this page actually is.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
    return
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
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
