import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // This module is imported before React mounts, so a bare throw here
  // leaves a completely blank screen with the real cause visible only in
  // devtools - which don't exist on a phone running the APK. Paint the
  // explanation into the page first, then still throw to halt startup.
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML =
      '<div style="display:flex;min-height:100svh;align-items:center;justify-content:center;padding:2rem;background:#09090b;color:#d4d4d8;font-family:system-ui;text-align:center">' +
      '<p>This build is missing its server configuration.<br/>' +
      'Rebuild with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set<br/>' +
      '(repo secrets for CI builds, .env for local ones).</p></div>'
  }
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE for both OAuth paths (see lib/discordAuth.ts): in the native
    // app, Discord's redirect comes back through a custom-scheme deep
    // link, never touching the WebView's own address bar, so
    // detectSessionInUrl has nothing to find there and safely no-ops. On
    // plain web there's no native shell to catch a deep link at all, so
    // that path does an ordinary full-page redirect instead - and THAT is
    // exactly what detectSessionInUrl is for, picking the session back up
    // from the URL Discord/Supabase send the browser back to. Needs to
    // stay on for the web path to work at all.
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
})
