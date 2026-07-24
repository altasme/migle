import { SocialLogin } from '@capgo/capacitor-social-login'
import { supabase } from './supabase'

// Must be the Google Cloud "Web application" OAuth client ID - the same one
// pasted into Supabase Dashboard -> Authentication -> Providers -> Google.
// NOT the Android client: Google matches that one automatically via package
// name + SHA-1 (Credential Manager), it's never passed as a client ID here.
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID

let initialized = false

async function ensureInitialized() {
  if (initialized) return
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Google sign-in is not configured (missing VITE_GOOGLE_WEB_CLIENT_ID).')
  }
  await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } })
  initialized = true
}

// Native Google Sign-In (Android Credential Manager) instead of a browser
// redirect - this opens Google's own account-picker UI, not a browser tab,
// so no URL or domain is ever shown to the user.
export async function signInWithGoogle() {
  await ensureInitialized()
  const { result } = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  })
  if (result.responseType !== 'online' || !result.idToken) {
    throw new Error('Google did not return an ID token.')
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: result.idToken })
  if (error) throw error
}
